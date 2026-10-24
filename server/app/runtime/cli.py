"""Linha de comando do runtime (rodar de dentro de ``server/``).

    python -m app.runtime.cli migrate
    python -m app.runtime.cli enqueue site-intelligence [--check typecheck --check lint …] [--summarize]
    python -m app.runtime.cli worker [--once]          # sem --once, roda até Ctrl+C (desligamento gracioso)
    python -m app.runtime.cli recover                  # trata execuções interrompidas
    python -m app.runtime.cli show <tarefa>            # estado, execuções e eventos
    python -m app.runtime.cli report <tarefa>          # o relatório em texto
    python -m app.runtime.cli evaluate <tarefa> [--previous <tarefa>]
    python -m app.runtime.cli schedule <agente> --every-hours 24
    python -m app.runtime.cli token <nome> <papel>     # gera um token e a linha para o .env
    python -m app.runtime.cli retention [--events-days 90] [--tasks-days 180] [--dry-run]

Nenhum comando instala serviço permanente: o worker roda enquanto o terminal (ou o serviço que o
proprietário configurar) estiver ligado.
"""

from __future__ import annotations

import argparse
import json
import signal
import sys
from datetime import timedelta

from . import store
from .agents import DEFINITIONS, INPUT_MODELS, register_definitions
from .auth import ROLES, hash_token, new_token
from .db import connect, db_path, migrate, transaction
from .evaluation import evaluate_site_report, record_evaluation
from .executor import Executor
from .schedules import add_schedule
from .store import iso, utcnow


def _conn():
    c = connect()
    migrate(c)
    register_definitions(c)
    return c


def cmd_enqueue(a: argparse.Namespace) -> int:
    conn = _conn()
    d = DEFINITIONS[a.agent]
    inp = INPUT_MODELS[d.id].model_validate({"project_checks": a.check or [], "summarize": a.summarize}).model_dump()
    t = store.create_task(conn, agent_id=d.id, agent_version=d.version, objective=a.objective, input=inp, max_attempts=d.limits.max_attempts, created_by="user:cli", dedupe_key=a.dedupe)
    print(json.dumps({"task": t["id"], "state": t["state"], "correlation_id": t["correlation_id"]}, ensure_ascii=False))
    return 0


def cmd_worker(a: argparse.Namespace) -> int:
    ex = Executor(_conn)
    signal.signal(signal.SIGINT, lambda *_: ex.stop.set())
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, lambda *_: ex.stop.set())
    if a.once:
        ex.recover()
        tid = ex.run_once()
        print(json.dumps({"ran": tid}))
        return 0
    print(f"worker {ex.worker} rodando (Ctrl+C para parar no próximo passo seguro)", file=sys.stderr)
    ex.run_forever(poll_seconds=a.poll)
    return 0


def cmd_recover(_: argparse.Namespace) -> int:
    print(json.dumps({"recovered": Executor(_conn).recover()}))
    return 0


def cmd_show(a: argparse.Namespace) -> int:
    conn = _conn()
    t = store.get_task(conn, a.task)
    t.pop("result", None)
    print(json.dumps({"task": t, "executions": store.list_executions(conn, a.task), "events": store.list_events(conn, task_id=a.task, limit=500)}, ensure_ascii=False, indent=2))
    return 0


def cmd_report(a: argparse.Namespace) -> int:
    conn = _conn()
    t = store.get_task(conn, a.task)
    r = t["result"]
    if not r:
        print(f"tarefa {t['id']} sem relatório (estado: {t['state']}{', erro: ' + t['error'] if t['error'] else ''})")
        return 1
    print(f"# Relatório {r['schema']} — {r['task_id']}\n{r['started_at']} → {r['finished_at']} ({r['duration_ms']} ms) · agente {r['agent']['id']} v{r['agent']['version']}\n")
    print("## Verificações")
    for c in r["checks"]:
        print(f"- [{c['status']}] {c['title']} ({c['duration_ms']} ms){' — ' + c['reason'] if c.get('reason') else ''}")
        for e in c["evidence"][:4]:
            print(f"    · {e}")
    print("\n## Achados")
    for f in r["findings"]:
        print(f"- ({f['severity']}, confiança {f['confidence']}) {f['title']}\n    impacto: {f['impact']}\n    evidência: {' | '.join(f['evidence'][:3])}\n    ação: {f['recommendation']}")
    print("\n## Limitações")
    for item in r["limitations"]:
        print(f"- {item}")
    ms = r.get("model_summary", {})
    print(f"\n## Resumo por modelo: {ms.get('status')}{' — ' + ms['reason'] if ms.get('reason') else ''}")
    print(f"\nConsumo: {json.dumps(r['usage'])}")
    return 0


def cmd_evaluate(a: argparse.Namespace) -> int:
    conn = _conn()
    t = store.get_task(conn, a.task)
    if not t["result"]:
        print("sem relatório para avaliar")
        return 1
    prev = store.get_task(conn, a.previous)["result"] if a.previous else None
    scores = evaluate_site_report(t["result"], previous=prev)
    eid = record_evaluation(conn, t, scores)
    print(json.dumps({"evaluation": eid, "scores": scores}, ensure_ascii=False, indent=2))
    return 0


def cmd_schedule(a: argparse.Namespace) -> int:
    conn = _conn()
    s = add_schedule(conn, DEFINITIONS, agent_id=a.agent, objective=a.objective, input={}, interval_seconds=int(a.every_hours * 3600), created_by="user:cli")
    print(json.dumps(s, ensure_ascii=False))
    return 0


def cmd_token(a: argparse.Namespace) -> int:
    if a.role not in ROLES:
        print(f"papel inválido; use um de {ROLES}")
        return 2
    tok = new_token()
    print("Token (mostrado uma vez; guarde num cofre):\n  " + tok)
    print("Acrescente ao .env do servidor (só o hash fica no servidor):\n  BEZALEL_RUNTIME_TOKENS=" + f"{a.name}:{a.role}:{hash_token(tok)}")
    return 0


def cmd_retention(a: argparse.Namespace) -> int:
    """Política de retenção: eventos e execuções de tarefas terminadas há mais de N dias; tarefas (com o
    relatório) há mais de M dias. O registro de consumo fica 400 dias (conferência de custos)."""
    conn = _conn()
    ev_cut = iso(utcnow() - timedelta(days=a.events_days))
    tk_cut = iso(utcnow() - timedelta(days=a.tasks_days))
    us_cut = iso(utcnow() - timedelta(days=400))
    old_tasks = "SELECT id FROM tasks WHERE state IN ('succeeded','failed','cancelled') AND finished_at < ?"
    counts = {
        "events": conn.execute(f"SELECT COUNT(*) FROM events WHERE at < ? AND (task_id IS NULL OR task_id IN ({old_tasks}))", (ev_cut, ev_cut)).fetchone()[0],
        "executions": conn.execute(f"SELECT COUNT(*) FROM executions WHERE task_id IN ({old_tasks})", (tk_cut,)).fetchone()[0],
        "tasks": conn.execute(old_tasks.replace("SELECT id", "SELECT COUNT(*)"), (tk_cut,)).fetchone()[0],
    }
    if not a.dry_run:
        with transaction(conn):
            conn.execute(f"DELETE FROM events WHERE at < ? AND (task_id IS NULL OR task_id IN ({old_tasks}))", (ev_cut, ev_cut))
            conn.execute(f"DELETE FROM evaluations WHERE task_id IN ({old_tasks})", (tk_cut,))
            conn.execute(f"DELETE FROM executions WHERE task_id IN ({old_tasks})", (tk_cut,))
            conn.execute(f"UPDATE approvals SET task_id = NULL WHERE task_id IN ({old_tasks})", (tk_cut,))
            conn.execute("DELETE FROM tasks WHERE state IN ('succeeded','failed','cancelled') AND finished_at < ?", (tk_cut,))
            conn.execute("DELETE FROM usage_ledger WHERE at < ?", (us_cut,))
            store.append_event(conn, "retention.applied", "Política de retenção aplicada", actor="user:cli", data=counts)
    print(json.dumps({"dry_run": a.dry_run, "would_delete" if a.dry_run else "deleted": counts}))
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m app.runtime.cli", description="Runtime de agentes do Bezalel")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("migrate").set_defaults(fn=lambda a: (_conn(), print(f"esquema em dia ({db_path()})"), 0)[2])
    e = sub.add_parser("enqueue")
    e.add_argument("agent", choices=list(DEFINITIONS))
    e.add_argument("--objective", default="Relatório de qualidade técnica e SEO do build do site")
    e.add_argument("--check", action="append", choices=["typecheck", "lint", "test", "check:models", "check:budget"])
    e.add_argument("--summarize", action="store_true")
    e.add_argument("--dedupe")
    e.set_defaults(fn=cmd_enqueue)
    w = sub.add_parser("worker")
    w.add_argument("--once", action="store_true")
    w.add_argument("--poll", type=float, default=2.0)
    w.set_defaults(fn=cmd_worker)
    sub.add_parser("recover").set_defaults(fn=cmd_recover)
    for name, fn in (("show", cmd_show), ("report", cmd_report)):
        s = sub.add_parser(name)
        s.add_argument("task")
        s.set_defaults(fn=fn)
    ev = sub.add_parser("evaluate")
    ev.add_argument("task")
    ev.add_argument("--previous")
    ev.set_defaults(fn=cmd_evaluate)
    sc = sub.add_parser("schedule")
    sc.add_argument("agent", choices=list(DEFINITIONS))
    sc.add_argument("--every-hours", type=float, required=True)
    sc.add_argument("--objective", default="Relatório recorrente de qualidade técnica e SEO")
    sc.set_defaults(fn=cmd_schedule)
    tk = sub.add_parser("token")
    tk.add_argument("name")
    tk.add_argument("role")
    tk.set_defaults(fn=cmd_token)
    rt = sub.add_parser("retention")
    rt.add_argument("--events-days", type=int, default=90)
    rt.add_argument("--tasks-days", type=int, default=180)
    rt.add_argument("--dry-run", action="store_true")
    rt.set_defaults(fn=cmd_retention)
    a = p.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
