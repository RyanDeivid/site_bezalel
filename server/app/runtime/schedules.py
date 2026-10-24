"""Agendamentos (Schedules): regras persistentes de quando uma tarefa pode começar.

Intervalo mínimo de 1 hora (garantido pelo banco). A cada passada do worker, um agendamento vencido
cria uma tarefa com ``dedupe_key`` próprio: se a anterior ainda estiver ativa, não duplica. Janelas
perdidas (worker parado) não se acumulam: a próxima fica para "agora + intervalo".
Nenhum serviço permanente é instalado na máquina: quem roda o worker decide quando ele fica ligado.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import timedelta
from typing import Any

from .db import transaction
from .store import append_event, create_task, iso, new_id, parse_iso, utcnow

MIN_INTERVAL_S = 3600


def add_schedule(conn: sqlite3.Connection, defs: dict[str, Any], *, agent_id: str, objective: str, input: dict[str, Any], interval_seconds: int, created_by: str, environment: str = "live") -> dict[str, Any]:
    from .agents import INPUT_MODELS

    if agent_id not in defs:
        raise ValueError("agente desconhecido")
    if interval_seconds < MIN_INTERVAL_S:
        raise ValueError("intervalo mínimo de 1 hora")
    valid = INPUT_MODELS[agent_id].model_validate(input).model_dump()
    sid = new_id("sched")
    now = utcnow()
    with transaction(conn):
        conn.execute(
            "INSERT INTO schedules (id, agent_id, objective, input, interval_seconds, enabled, next_run_at, created_by, created_at) VALUES (?,?,?,?,?,1,?,?,?)",
            (sid, agent_id, objective[:500], json.dumps(valid, sort_keys=True), interval_seconds, iso(now + timedelta(seconds=interval_seconds)), created_by, iso(now)),
        )
        append_event(conn, "schedule.created", f"Agendamento a cada {interval_seconds // 3600} h para {agent_id}", actor=created_by, data={"schedule": sid}, environment=environment)
    return dict(conn.execute("SELECT * FROM schedules WHERE id = ?", (sid,)).fetchone())


def set_enabled(conn: sqlite3.Connection, schedule_id: str, enabled: bool, by: str, environment: str = "live") -> None:
    with transaction(conn):
        conn.execute("UPDATE schedules SET enabled = ? WHERE id = ?", (1 if enabled else 0, schedule_id))
        append_event(conn, "schedule.enabled" if enabled else "schedule.disabled", f"Agendamento {'ligado' if enabled else 'desligado'}", actor=by, data={"schedule": schedule_id}, environment=environment)


def tick_schedules(conn: sqlite3.Connection, defs: dict[str, Any], now=None, environment: str = "live") -> list[str]:
    """Cria as tarefas dos agendamentos vencidos. Devolve os ids das tarefas (novas ou já ativas)."""
    now = now or utcnow()
    created = []
    for s in conn.execute("SELECT * FROM schedules WHERE enabled = 1 AND next_run_at <= ?", (iso(now),)).fetchall():
        d = defs.get(s["agent_id"])
        if not d or not d.enabled:
            continue
        task = create_task(
            conn,
            agent_id=d.id,
            agent_version=d.version,
            objective=s["objective"],
            input=json.loads(s["input"]),
            max_attempts=d.limits.max_attempts,
            created_by=f"schedule:{s['id']}",
            dedupe_key=f"schedule:{s['id']}",
            schedule_id=s["id"],
            environment=environment,
        )
        nxt = max(parse_iso(s["next_run_at"]), now) + timedelta(seconds=s["interval_seconds"])
        with transaction(conn):
            conn.execute("UPDATE schedules SET next_run_at = ?, last_task_id = ? WHERE id = ?", (iso(nxt), task["id"], s["id"]))
        created.append(task["id"])
    return created
