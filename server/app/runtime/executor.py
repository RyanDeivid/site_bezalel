"""Executor (worker): pega tarefas elegíveis, executa com limites, persiste o resultado e se recupera.

Garantias:
- **Sem execução duplicada:** a tarefa é pega com uma posse (lease) numa transação de escrita
  (``store.claim_next``); a posse é renovada a cada passo. Outro worker nunca pega uma tarefa 'running'.
- **Recuperação explícita e idempotente:** tarefa 'running' com posse vencida foi interrompida (o worker
  morreu). Agente idempotente (``recovery='retry'``) volta à fila e gasta uma tentativa; os demais
  terminam 'failed' esperando uma pessoa. Rodar a recuperação duas vezes não muda nada.
- **Limites:** tempo total (``timeout_s``), passos (``max_steps``), tentativas (``max_attempts``, com
  espera exponencial entre elas), chamadas e custo de modelo.
- **Cancelamento:** visto num passo seguro (entre ferramentas). Desligar o worker devolve a tarefa à fila
  sem gastar tentativa.
- **Sem laço infinito:** cada execução tem plano fixo e número máximo de passos; o agente não chama o
  modelo para "melhorar a própria resposta".
"""

from __future__ import annotations

import socket
import threading
import time
from datetime import timedelta
from typing import Any, Callable

from pydantic import ValidationError

from . import store
from .agents import DEFINITIONS, INPUT_MODELS, AgentDefinition, availability
from .db import transaction
from .llm import ModelProvider, provider_from_env
from .schedules import tick_schedules
from .site_agent import run_site_intelligence
from .store import iso, utcnow
from .tools import BudgetExceeded, Cancelled, ToolContext, ToolInputError, ToolNotAllowed, ToolTimeout

RUNNERS: dict[str, Callable[[ToolContext, Any], dict[str, Any]]] = {"site-intelligence": run_site_intelligence}

# Erros permanentes: repetir não adianta (e pode ser perigoso). Os demais são tentados de novo.
PERMANENT = (ToolNotAllowed, ToolInputError, ValidationError, BudgetExceeded, KeyError)


class Executor:
    def __init__(
        self,
        conn_factory: Callable[[], Any],
        *,
        worker_id: str | None = None,
        provider: ModelProvider | None = None,
        definitions: dict[str, AgentDefinition] | None = None,
        lease_seconds: int = 60,
        environment: str = "live",
        max_running_per_agent: int = 1,
        tool_overrides: dict[str, Any] | None = None,
    ):
        self.conn = conn_factory()
        self.worker = worker_id or f"{socket.gethostname()}-{threading.get_ident()}"
        self.provider = provider or provider_from_env()
        self.defs = definitions or DEFINITIONS
        self.lease = lease_seconds
        self.env = environment
        self.max_running = max_running_per_agent
        self.stop = threading.Event()
        self.tool_overrides = tool_overrides or {}

    # ---- Recuperação ------------------------------------------------------------------------------

    def recover(self) -> list[str]:
        """Trata as tarefas interrompidas (posse vencida). Devolve os ids tratados."""
        done = []
        for t in store.stale_running(self.conn):
            d = self.defs.get(t["agent_id"])
            with transaction(self.conn):
                self.conn.execute("UPDATE executions SET state = 'interrupted', finished_at = ?, error = 'worker interrompido' WHERE task_id = ? AND state = 'running'", (iso(utcnow()), t["id"]))
            try:
                if d and d.recovery == "retry" and t["attempts"] < t["max_attempts"]:
                    store.transition(self.conn, t["id"], "queued", actor="system", summary="Execução interrompida (worker reiniciou): volta à fila", outcome="warning", data={"recovered": True}, environment=self.env, lease_owner=None, lease_until=None, not_before=None)
                elif d and d.recovery == "retry":
                    store.transition(self.conn, t["id"], "failed", actor="system", summary="Execução interrompida e sem tentativas restantes", outcome="failure", environment=self.env, error="interrompida; tentativas esgotadas")
                else:
                    store.transition(self.conn, t["id"], "failed", actor="system", summary="Execução interrompida: o agente não é idempotente, exige decisão manual", outcome="failure", environment=self.env, error="interrompida; recuperação manual")
                done.append(t["id"])
            except store.InvalidTransition:
                pass  # outro processo já tratou (idempotência)
        return done

    # ---- Uma tarefa -------------------------------------------------------------------------------

    def eligible_agents(self) -> list[str]:
        out = []
        for d in self.defs.values():
            if availability(d, self.provider.available()) != "available":
                continue
            running = self.conn.execute("SELECT COUNT(*) FROM tasks WHERE state = 'running' AND agent_id = ?", (d.id,)).fetchone()[0]
            if running < self.max_running:
                out.append(d.id)
        return out

    def run_once(self) -> str | None:
        claimed = store.claim_next(self.conn, self.worker, self.lease, self.eligible_agents(), self.env)
        if not claimed:
            return None
        task, exec_id = claimed
        self._execute(task, exec_id)
        return task["id"]

    def _execute(self, task: dict[str, Any], exec_id: str) -> None:
        d = self.defs[task["agent_id"]]
        tid = task["id"]

        def cancel_requested() -> bool:
            r = self.conn.execute("SELECT cancel_requested FROM tasks WHERE id = ?", (tid,)).fetchone()
            return bool(r and r[0])

        def on_step(kind: str, tool: str, result: str, data: dict[str, Any]) -> None:
            with transaction(self.conn):
                store.append_event(self.conn, kind, f"{tool}: {kind.split('.')[-1]}", actor=f"agent:{d.id}", result=result, task_id=tid, execution_id=exec_id, correlation_id=task["correlation_id"], data={"tool": tool, **data}, environment=self.env)
            if kind == "tool.finished" and not store.renew_lease(self.conn, tid, self.worker, self.lease):
                raise Cancelled()  # perdeu a posse: alguém (recuperação) já tirou a tarefa deste worker

        ctx = ToolContext(
            agent=d,
            task_id=tid,
            execution_id=exec_id,
            deadline=time.monotonic() + d.limits.timeout_s,
            provider=self.provider,
            conn=self.conn,
            should_stop=lambda: self.stop.is_set() or cancel_requested(),
            on_step=on_step,
            **self.tool_overrides,
        )
        try:
            if task["agent_version"] != d.version:
                raise ToolInputError(f"definição v{task['agent_version']} não está mais disponível (atual: v{d.version})")
            inp = INPUT_MODELS[d.id].model_validate(task["input"])
            report = RUNNERS[d.id](ctx, inp)
            store.finish_execution(self.conn, exec_id, "succeeded", steps=ctx.steps, usage=ctx.usage.as_dict())
            s = report.get("summary", {})
            n = sum(s.get("findings", {}).values())
            store.transition(
                self.conn,
                tid,
                "succeeded",
                actor=f"agent:{d.id}",
                summary=f"Relatório pronto: {n} achados em {len(report.get('checks', []))} verificações",
                outcome="success",
                data={"summary": s},
                environment=self.env,
                result=report,
                cost_usd=task["cost_usd"] + ctx.usage.cost_usd,
            )
        except Cancelled:
            if cancel_requested():
                store.finish_execution(self.conn, exec_id, "cancelled", steps=ctx.steps, usage=ctx.usage.as_dict())
                self._safe_transition(tid, "cancelled", "Tarefa cancelada num passo seguro", "warning", cost_usd=task["cost_usd"] + ctx.usage.cost_usd)
            else:
                # Desligamento do worker (ou posse perdida): volta à fila sem gastar a tentativa.
                store.finish_execution(self.conn, exec_id, "interrupted", steps=ctx.steps, usage=ctx.usage.as_dict(), error="worker desligando")
                self._safe_transition(tid, "queued", "Worker desligando: a tarefa volta à fila", "warning", attempts=max(0, task["attempts"] - 1), lease_owner=None, lease_until=None)
        except ToolTimeout as e:
            store.finish_execution(self.conn, exec_id, "timed_out", steps=ctx.steps, usage=ctx.usage.as_dict(), error=str(e))
            self._retry_or_fail(task, d, f"tempo esgotado: {e}", ctx)
        except PERMANENT as e:
            store.finish_execution(self.conn, exec_id, "failed", steps=ctx.steps, usage=ctx.usage.as_dict(), error=f"{type(e).__name__}: {e}")
            self._safe_transition(tid, "failed", f"Falha permanente: {type(e).__name__}", "failure", error=f"{type(e).__name__}: {e}"[:1000], cost_usd=task["cost_usd"] + ctx.usage.cost_usd)
        except Exception as e:  # falha transitória (ou desconhecida): tenta de novo, com espera, até o limite
            store.finish_execution(self.conn, exec_id, "failed", steps=ctx.steps, usage=ctx.usage.as_dict(), error=f"{type(e).__name__}: {e}")
            self._retry_or_fail(task, d, f"{type(e).__name__}: {e}", ctx)

    def _safe_transition(self, tid: str, to: str, summary: str, outcome: str, **fields: Any) -> None:
        try:
            store.transition(self.conn, tid, to, actor=f"worker:{self.worker}", summary=summary, outcome=outcome, environment=self.env, **fields)
        except store.InvalidTransition:
            pass

    def _retry_or_fail(self, task: dict[str, Any], d: AgentDefinition, error: str, ctx: ToolContext) -> None:
        attempt = task["attempts"]
        cost = task["cost_usd"] + ctx.usage.cost_usd
        if attempt < task["max_attempts"]:
            wait = min(3600, d.limits.backoff_base_s * 2 ** (attempt - 1))
            self._safe_transition(task["id"], "queued", f"Falhou ({error[:120]}); nova tentativa em {wait} s", "warning", not_before=iso(utcnow() + timedelta(seconds=wait)), error=error[:1000], cost_usd=cost, lease_owner=None, lease_until=None)
        else:
            self._safe_transition(task["id"], "failed", f"Falhou depois de {attempt} tentativas", "failure", error=error[:1000], cost_usd=cost)

    # ---- Laço -------------------------------------------------------------------------------------

    def run_forever(self, poll_seconds: float = 2.0, recover_every: float = 30.0) -> None:
        """Laço do worker: recuperação periódica, agendamentos e uma tarefa por vez. Para com ``stop``."""
        last_recover = 0.0
        with transaction(self.conn):
            store.append_event(self.conn, "worker.started", f"Worker {self.worker} iniciado", actor=f"worker:{self.worker}", environment=self.env)
        try:
            while not self.stop.is_set():
                if time.monotonic() - last_recover > recover_every:
                    self.recover()
                    last_recover = time.monotonic()
                tick_schedules(self.conn, self.defs, environment=self.env)
                if self.run_once() is None:
                    self.stop.wait(poll_seconds)
        finally:
            with transaction(self.conn):
                store.append_event(self.conn, "worker.stopped", f"Worker {self.worker} parado", actor=f"worker:{self.worker}", environment=self.env)
