"""Indicadores operacionais (calculados da trilha real) e o contrato de Business Metric.

Business Metric só existe com fonte identificada e cálculo reproduzível. Nesta etapa não há nenhuma
fonte de negócio ligada (tráfego, vendas, anúncios): a lista volta vazia, nunca inventada.
"""

from __future__ import annotations

import sqlite3
from datetime import timedelta
from typing import Any

from pydantic import BaseModel

from .agents import DEFINITIONS
from .store import iso, utcnow


class BusinessMetric(BaseModel):
    id: str
    name: str
    definition: str  # como é calculado
    source: str  # de onde vem o dado (sistema, consulta)
    value: float
    unit: str
    computed_at: str
    period: str


def business_metrics(conn: sqlite3.Connection) -> list[BusinessMetric]:
    _ = conn
    return []  # nenhuma fonte de negócio ligada nesta etapa


def operational_metrics(conn: sqlite3.Connection, environment: str = "live") -> dict[str, Any]:
    now = utcnow()
    since = iso(now - timedelta(days=30))
    day = iso(now)[:10]
    by_state = {r["state"]: r["n"] for r in conn.execute("SELECT state, COUNT(*) AS n FROM tasks WHERE environment = ? GROUP BY state", (environment,))}
    done = conn.execute("SELECT state, COUNT(*) AS n FROM tasks WHERE environment = ? AND finished_at >= ? GROUP BY state", (environment, since)).fetchall()
    finished = {r["state"]: r["n"] for r in done}
    total_done = sum(finished.values())
    dur = conn.execute("SELECT AVG((julianday(e.finished_at) - julianday(e.started_at)) * 86400000) FROM executions e JOIN tasks t ON t.id = e.task_id WHERE t.environment = ? AND e.state = 'succeeded' AND e.started_at >= ?", (environment, since)).fetchone()[0]
    cost_today = conn.execute("SELECT COALESCE(SUM(cost_usd), 0) FROM usage_ledger WHERE day = ?", (day,)).fetchone()[0]
    cost_30 = conn.execute("SELECT COALESCE(SUM(cost_usd), 0) FROM usage_ledger WHERE at >= ?", (since,)).fetchone()[0]
    failures_24h = conn.execute("SELECT COUNT(*) FROM events WHERE environment = ? AND result = 'failure' AND at >= ?", (environment, iso(now - timedelta(hours=24)))).fetchone()[0]
    return {
        "source": "runtime",
        "environment": environment,
        "computed_at": iso(now),
        "tasks_by_state": by_state,
        "last_30_days": {
            "finished": total_done,
            "succeeded": finished.get("succeeded", 0),
            "failed": finished.get("failed", 0),
            "cancelled": finished.get("cancelled", 0),
            "success_rate": round(finished.get("succeeded", 0) / total_done, 3) if total_done else None,
            "mean_duration_ms": round(dur) if dur else None,
            "cost_usd": round(cost_30, 6),
        },
        "cost_today_usd": round(cost_today, 6),
        "failure_events_24h": failures_24h,
        "business_metrics": [m.model_dump() for m in business_metrics(conn)],
    }


def tower_status(conn: sqlite3.Connection, environment: str = "live") -> dict[str, Any]:
    """O que o painel de um setor da Torre pode mostrar: dados reais do runtime, separados da demonstração.
    Animação de robô ou mudança de tela não é evidência: só tarefas, execuções e eventos gravados."""
    sectors: dict[str, dict[str, Any]] = {}
    for d in DEFINITIONS.values():
        s = sectors.setdefault(d.sector, {"sector": d.sector, "source": environment, "agents": [], "running": 0, "queued": 0, "last_activity_at": None, "recent_results": [], "failures_24h": 0, "cost_30d_usd": 0.0})
        s["agents"].append({"id": d.id, "name": d.name, "version": d.version, "autonomy": d.autonomy, "enabled": d.enabled})
        for st in ("running", "queued"):
            s[st] += conn.execute("SELECT COUNT(*) FROM tasks WHERE agent_id = ? AND state = ? AND environment = ?", (d.id, st, environment)).fetchone()[0]
        last = conn.execute("SELECT MAX(at) FROM events WHERE actor = ? AND environment = ?", (f"agent:{d.id}", environment)).fetchone()[0]
        if last and (s["last_activity_at"] is None or last > s["last_activity_at"]):
            s["last_activity_at"] = last
        for r in conn.execute("SELECT id, state, finished_at, objective FROM tasks WHERE agent_id = ? AND environment = ? AND state IN ('succeeded','failed','cancelled') ORDER BY finished_at DESC LIMIT 5", (d.id, environment)):
            s["recent_results"].append(dict(r))
        s["failures_24h"] += conn.execute(
            "SELECT COUNT(*) FROM events e JOIN tasks t ON t.id = e.task_id WHERE t.agent_id = ? AND t.environment = ? AND e.result = 'failure' AND e.at >= ?", (d.id, environment, iso(utcnow() - timedelta(hours=24)))
        ).fetchone()[0]
        s["cost_30d_usd"] += conn.execute("SELECT COALESCE(SUM(u.cost_usd), 0) FROM usage_ledger u JOIN tasks t ON t.id = u.task_id WHERE t.agent_id = ? AND t.environment = ? AND u.at >= ?", (d.id, environment, iso(utcnow() - timedelta(days=30)))).fetchone()[0]
    return {"source": "runtime", "note": "Dados reais do runtime. Os painéis de demonstração da Torre são outra fonte e continuam marcados como demonstração.", "computed_at": iso(utcnow()), "sectors": list(sectors.values())}
