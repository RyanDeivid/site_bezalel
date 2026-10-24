"""Tarefas, execuções e eventos: o estado persistente do runtime e as transições válidas.

Conceitos (cada um na sua tabela, ver db.py):
- **Task**: a unidade de trabalho (objetivo, agente, entrada, estado, tentativas, resultado).
- **Execution**: uma tentativa concreta de executar uma tarefa (quem, quando, passos, consumo, erro).
- **Event**: o registro de cada mudança de estado, passo de ferramenta ou resultado (auditoria).
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from .db import transaction

TaskState = str  # 'queued' | 'running' | 'waiting_approval' | 'succeeded' | 'failed' | 'cancelled'

# Transições permitidas. Terminais (succeeded, failed, cancelled) não saem mais: uma tarefa cancelada
# nunca volta a rodar; para repetir, cria-se uma tarefa nova (com o mesmo correlation_id, se for o caso).
TRANSITIONS: dict[str, set[str]] = {
    "queued": {"running", "cancelled"},
    "running": {"succeeded", "failed", "queued", "waiting_approval", "cancelled"},
    "waiting_approval": {"queued", "cancelled", "failed"},
    "succeeded": set(),
    "failed": set(),
    "cancelled": set(),
}
TERMINAL = {"succeeded", "failed", "cancelled"}
ACTIVE = {"queued", "running", "waiting_approval"}


class InvalidTransition(Exception):
    pass


class NotFound(Exception):
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_iso(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:20]}"


def _json(v: Any) -> str:
    return json.dumps(v, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def row_to_task(r: sqlite3.Row) -> dict[str, Any]:
    d = dict(r)
    d["input"] = json.loads(d["input"])
    d["result"] = json.loads(d["result"]) if d["result"] else None
    d["cancel_requested"] = bool(d["cancel_requested"])
    return d


# ---- Eventos -------------------------------------------------------------------------------------


def append_event(
    conn: sqlite3.Connection,
    type: str,
    summary: str,
    *,
    actor: str,
    result: str = "info",
    task_id: str | None = None,
    execution_id: str | None = None,
    correlation_id: str | None = None,
    data: dict[str, Any] | None = None,
    environment: str = "live",
    at: datetime | None = None,
) -> str:
    """Acrescenta um evento (só acrescenta: a trilha não se edita). Deve rodar dentro da mesma transação
    da mudança que ele descreve, para nunca haver estado sem evento ou evento sem estado."""
    if environment not in ("live", "test"):
        raise ValueError("eventos do runtime são reais ('live') ou de teste; demonstração não entra aqui")
    eid = new_id("evt")
    conn.execute(
        "INSERT INTO events (id, type, at, actor, task_id, execution_id, correlation_id, result, summary, data, environment) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (eid, type, iso(at or utcnow()), actor, task_id, execution_id, correlation_id, result, summary[:500], _json(data) if data else None, environment),
    )
    return eid


def list_events(conn: sqlite3.Connection, *, task_id: str | None = None, after: int = 0, limit: int = 100) -> list[dict[str, Any]]:
    q = "SELECT * FROM events WHERE seq > ?"
    args: list[Any] = [after]
    if task_id:
        q += " AND task_id = ?"
        args.append(task_id)
    q += " ORDER BY seq LIMIT ?"
    args.append(limit)
    out = []
    for r in conn.execute(q, args):
        d = dict(r)
        d["data"] = json.loads(d["data"]) if d["data"] else None
        out.append(d)
    return out


# ---- Tarefas -------------------------------------------------------------------------------------


def create_task(
    conn: sqlite3.Connection,
    *,
    agent_id: str,
    agent_version: int,
    objective: str,
    input: dict[str, Any],
    max_attempts: int,
    created_by: str,
    correlation_id: str | None = None,
    dedupe_key: str | None = None,
    deadline: datetime | None = None,
    schedule_id: str | None = None,
    environment: str = "live",
) -> dict[str, Any]:
    """Cria uma tarefa na fila. Com ``dedupe_key``, uma tarefa igual ainda ativa é devolvida em vez de
    duplicada (idempotência de quem pede)."""
    tid = new_id("task")
    corr = correlation_id or new_id("corr")
    now = iso(utcnow())
    with transaction(conn):
        if dedupe_key:
            existing = conn.execute("SELECT * FROM tasks WHERE dedupe_key = ? AND state IN ('queued','running','waiting_approval')", (dedupe_key,)).fetchone()
            if existing:
                return row_to_task(existing)
        conn.execute(
            "INSERT INTO tasks (id, agent_id, agent_version, objective, input, state, attempts, max_attempts, correlation_id, dedupe_key, created_by, created_at, deadline, schedule_id, environment) VALUES (?,?,?,?,?,'queued',0,?,?,?,?,?,?,?,?)",
            (tid, agent_id, agent_version, objective[:500], _json(input), max_attempts, corr, dedupe_key, created_by, now, iso(deadline) if deadline else None, schedule_id, environment),
        )
        append_event(conn, "task.created", f"Tarefa criada para {agent_id}: {objective[:120]}", actor=created_by, task_id=tid, correlation_id=corr, data={"agent": agent_id, "version": agent_version}, environment=environment)
    return get_task(conn, tid)


def get_task(conn: sqlite3.Connection, task_id: str) -> dict[str, Any]:
    r = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not r:
        raise NotFound(task_id)
    return row_to_task(r)


def list_tasks(conn: sqlite3.Connection, *, state: str | None = None, agent_id: str | None = None, limit: int = 50, offset: int = 0) -> tuple[list[dict[str, Any]], int]:
    where, args = [], []
    if state:
        where.append("state = ?")
        args.append(state)
    if agent_id:
        where.append("agent_id = ?")
        args.append(agent_id)
    w = f" WHERE {' AND '.join(where)}" if where else ""
    total = conn.execute(f"SELECT COUNT(*) FROM tasks{w}", args).fetchone()[0]
    rows = conn.execute(f"SELECT * FROM tasks{w} ORDER BY created_at DESC, id LIMIT ? OFFSET ?", [*args, limit, offset]).fetchall()
    return [row_to_task(r) for r in rows], total


def transition(conn: sqlite3.Connection, task_id: str, to: str, *, actor: str, summary: str, outcome: str = "info", data: dict[str, Any] | None = None, environment: str = "live", **fields: Any) -> dict[str, Any]:
    """Muda o estado de uma tarefa, se a transição for válida, e registra o evento — na mesma transação
    do banco. ``outcome`` é o resultado do evento (success, failure, warning, info); campos extras
    (``fields``, inclusive ``result``, o relatório da tarefa) são gravados junto."""
    with transaction(conn):
        r = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if not r:
            raise NotFound(task_id)
        frm = r["state"]
        if to not in TRANSITIONS[frm]:
            raise InvalidTransition(f"{frm} → {to} não é permitido")
        sets = ["state = ?"]
        vals: list[Any] = [to]
        for k, v in fields.items():
            sets.append(f"{k} = ?")
            vals.append(_json(v) if k == "result" and v is not None else v)
        if to in TERMINAL:
            sets.append("finished_at = ?")
            vals.append(iso(utcnow()))
            sets.append("lease_owner = NULL")
            sets.append("lease_until = NULL")
        conn.execute(f"UPDATE tasks SET {', '.join(sets)} WHERE id = ? AND state = ?", [*vals, task_id, frm])
        append_event(conn, f"task.{to}", summary, actor=actor, result=outcome, task_id=task_id, correlation_id=r["correlation_id"], data={"from": frm, "to": to, **(data or {})}, environment=environment)
    return get_task(conn, task_id)


def request_cancel(conn: sqlite3.Connection, task_id: str, *, actor: str, environment: str = "live") -> dict[str, Any]:
    """Cancela já se a tarefa ainda não começou; se estiver rodando, pede o cancelamento e o executor o
    aplica no próximo passo seguro (nunca no meio de uma ferramenta)."""
    task = get_task(conn, task_id)
    if task["state"] in TERMINAL:
        raise InvalidTransition(f"a tarefa já terminou ({task['state']})")
    if task["state"] in ("queued", "waiting_approval"):
        return transition(conn, task_id, "cancelled", actor=actor, summary="Tarefa cancelada antes de rodar", environment=environment)
    with transaction(conn):
        conn.execute("UPDATE tasks SET cancel_requested = 1 WHERE id = ?", (task_id,))
        append_event(conn, "task.cancel_requested", "Cancelamento pedido: aplicado no próximo passo seguro", actor=actor, task_id=task_id, correlation_id=task["correlation_id"], environment=environment)
    return get_task(conn, task_id)


# ---- Fila: pegar uma tarefa sem duplicar a execução ------------------------------------------------


def claim_next(conn: sqlite3.Connection, worker: str, lease_seconds: int, agent_ids: Iterable[str], environment: str = "live") -> tuple[dict[str, Any], str] | None:
    """Pega a próxima tarefa elegível e abre uma execução, atomicamente. Duas threads ou dois processos
    nunca pegam a mesma: a escolha e a mudança para 'running' acontecem na mesma transação de escrita,
    e o UPDATE só vale se o estado ainda for 'queued'."""
    ids = list(agent_ids)
    if not ids:
        return None
    now = utcnow()
    with transaction(conn):
        marks = ",".join("?" * len(ids))
        r = conn.execute(
            f"SELECT * FROM tasks WHERE state = 'queued' AND agent_id IN ({marks}) AND (not_before IS NULL OR not_before <= ?) ORDER BY created_at, id LIMIT 1",
            [*ids, iso(now)],
        ).fetchone()
        if not r:
            return None
        attempt = r["attempts"] + 1
        updated = conn.execute(
            "UPDATE tasks SET state = 'running', attempts = ?, started_at = COALESCE(started_at, ?), lease_owner = ?, lease_until = ? WHERE id = ? AND state = 'queued'",
            (attempt, iso(now), worker, iso(now + timedelta(seconds=lease_seconds)), r["id"]),
        ).rowcount
        if updated != 1:
            return None
        exec_id = new_id("exec")
        conn.execute("INSERT INTO executions (id, task_id, attempt, worker, state, started_at) VALUES (?,?,?,?, 'running', ?)", (exec_id, r["id"], attempt, worker, iso(now)))
        append_event(conn, "task.running", f"Tentativa {attempt} de {r['max_attempts']} iniciada", actor=f"worker:{worker}", task_id=r["id"], execution_id=exec_id, correlation_id=r["correlation_id"], data={"from": "queued", "to": "running", "attempt": attempt}, environment=environment)
    return get_task(conn, r["id"]), exec_id


def renew_lease(conn: sqlite3.Connection, task_id: str, worker: str, lease_seconds: int) -> bool:
    """Renova a posse da tarefa (o executor faz isso entre os passos). False: perdeu a posse."""
    with transaction(conn):
        n = conn.execute("UPDATE tasks SET lease_until = ? WHERE id = ? AND state = 'running' AND lease_owner = ?", (iso(utcnow() + timedelta(seconds=lease_seconds)), task_id, worker)).rowcount
    return n == 1


def finish_execution(conn: sqlite3.Connection, exec_id: str, state: str, *, steps: int, usage: dict[str, Any] | None = None, error: str | None = None) -> None:
    u = usage or {}
    with transaction(conn):
        conn.execute(
            "UPDATE executions SET state = ?, finished_at = ?, steps = ?, model_calls = ?, input_tokens = ?, output_tokens = ?, cost_usd = ?, error = ? WHERE id = ? AND state = 'running'",
            (state, iso(utcnow()), steps, u.get("model_calls", 0), u.get("input_tokens", 0), u.get("output_tokens", 0), u.get("cost_usd", 0.0), (error or "")[:2000] or None, exec_id),
        )


def list_executions(conn: sqlite3.Connection, task_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in conn.execute("SELECT * FROM executions WHERE task_id = ? ORDER BY attempt", (task_id,))]


def stale_running(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Tarefas 'running' cuja posse expirou: o worker morreu ou reiniciou no meio."""
    now = iso(utcnow())
    return [row_to_task(r) for r in conn.execute("SELECT * FROM tasks WHERE state = 'running' AND lease_until < ?", (now,))]
