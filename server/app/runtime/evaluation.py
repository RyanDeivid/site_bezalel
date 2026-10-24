"""Avaliação (Evaluation): medir o trabalho do agente independentemente do que ele diz de si.

O avaliador é outro código (``evaluator:site-intelligence/1``), não o agente. Ele mede:
- **evidência suficiente:** fração dos achados com evidência observável;
- **contabilidade das verificações:** toda verificação com estado e, se não rodou, com o motivo;
- **cobertura:** verificações que de fato rodaram, sobre as pedidas;
- **precisão e revocação:** contra um gabarito, em casos controlados (sites de teste com problemas
  conhecidos); fora deles, não há gabarito e essas métricas ficam ausentes, não inventadas;
- **reprodutibilidade:** semelhança entre os achados de duas execuções sobre o mesmo build;
- **tempo e custo:** os medidos na execução.
Utilidade das recomendações precisa de julgamento humano: o contrato tem o campo, preenchido por pessoa.
"""

from __future__ import annotations

import json
import sqlite3
from typing import Any

from .db import transaction
from .store import append_event, iso, new_id, utcnow

EVALUATOR = "evaluator:site-intelligence/1"


def finding_keys(report: dict[str, Any]) -> set[str]:
    return {f"{f['check']}:{f['kind']}" for f in report.get("findings", [])}


def evaluate_site_report(report: dict[str, Any], *, expected: set[str] | None = None, previous: dict[str, Any] | None = None) -> dict[str, Any]:
    findings = report.get("findings", [])
    checks = report.get("checks", [])
    with_evidence = sum(1 for f in findings if f.get("evidence"))
    accounted = sum(1 for c in checks if c["status"] in ("passed", "failed") or (c["status"] in ("not_run", "error") and c.get("reason")))
    ran = sum(1 for c in checks if c["status"] in ("passed", "failed"))
    scores: dict[str, Any] = {
        "evidence_sufficiency": round(with_evidence / len(findings), 3) if findings else 1.0,
        "checks_accounted": round(accounted / len(checks), 3) if checks else 0.0,
        "coverage": round(ran / len(checks), 3) if checks else 0.0,
        "duration_ms": report.get("duration_ms"),
        "cost_usd": (report.get("usage") or {}).get("cost_usd", 0.0),
        "findings": len(findings),
    }
    if expected is not None:
        got = finding_keys(report)
        tp = len(got & expected)
        scores["precision"] = round(tp / len(got), 3) if got else (1.0 if not expected else 0.0)
        scores["recall"] = round(tp / len(expected), 3) if expected else 1.0
        scores["false_positives"] = sorted(got - expected)
        scores["missed"] = sorted(expected - got)
    if previous is not None:
        a, b = finding_keys(report), finding_keys(previous)
        scores["reproducibility"] = round(len(a & b) / len(a | b), 3) if a | b else 1.0
    return scores


def record_evaluation(conn: sqlite3.Connection, task: dict[str, Any], scores: dict[str, Any], notes: str = "", evaluator: str = EVALUATOR, environment: str = "live") -> str:
    if evaluator.startswith("agent:"):
        raise ValueError("um agente não avalia o próprio trabalho")
    eid = new_id("eval")
    with transaction(conn):
        conn.execute(
            "INSERT INTO evaluations (id, task_id, agent_id, agent_version, evaluator, at, scores, notes) VALUES (?,?,?,?,?,?,?,?)",
            (eid, task["id"], task["agent_id"], task["agent_version"], evaluator, iso(utcnow()), json.dumps(scores, ensure_ascii=False), notes[:1000]),
        )
        append_event(conn, "evaluation.recorded", f"Avaliação registrada por {evaluator}", actor=evaluator, task_id=task["id"], data={"evaluation": eid, "scores": {k: v for k, v in scores.items() if isinstance(v, (int, float))}}, environment=environment)
    return eid


def list_evaluations(conn: sqlite3.Connection, agent_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
    q = "SELECT * FROM evaluations" + (" WHERE agent_id = ?" if agent_id else "") + " ORDER BY at DESC LIMIT ?"
    out = []
    for r in conn.execute(q, ([agent_id] if agent_id else []) + [limit]):
        d = dict(r)
        d["scores"] = json.loads(d["scores"])
        out.append(d)
    return out
