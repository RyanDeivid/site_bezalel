"""Aprovações (Approvals): a decisão humana registrada antes de uma ação que exige autorização.

A aprovação vale para exatamente uma ação: o hash de ação + parâmetros + destino é gravado no pedido e
conferido no uso. Expirada, revogada, rejeitada, já usada ou com parâmetros diferentes: não executa.
Nesta etapa nenhuma ação externa está ligada; o mecanismo fica pronto e testado para os departamentos.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import timedelta
from typing import Any

from .db import transaction
from .store import append_event, iso, new_id, parse_iso, utcnow


class ApprovalError(Exception):
    pass


def action_hash(action: str, params: dict[str, Any], destination: str) -> str:
    canon = json.dumps({"action": action, "params": params, "destination": destination}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canon.encode()).hexdigest()


def request_approval(
    conn: sqlite3.Connection,
    *,
    agent_id: str,
    action: str,
    params: dict[str, Any],
    destination: str,
    risks: str,
    expected_effects: str,
    ttl_seconds: int,
    task_id: str | None = None,
    environment: str = "live",
) -> dict[str, Any]:
    if not 60 <= ttl_seconds <= 7 * 24 * 3600:
        raise ApprovalError("validade fora do intervalo permitido (1 min a 7 dias)")
    aid = new_id("appr")
    now = utcnow()
    with transaction(conn):
        conn.execute(
            "INSERT INTO approvals (id, task_id, agent_id, action, params, destination, risks, expected_effects, action_hash, state, requested_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?,'pending',?,?)",
            (aid, task_id, agent_id, action, json.dumps(params, ensure_ascii=False, sort_keys=True), destination, risks, expected_effects, action_hash(action, params, destination), iso(now), iso(now + timedelta(seconds=ttl_seconds))),
        )
        append_event(conn, "approval.requested", f"{agent_id} pede aprovação: {action} → {destination}", actor=f"agent:{agent_id}", task_id=task_id, data={"approval": aid, "action": action, "destination": destination}, environment=environment)
    return get_approval(conn, aid)


def get_approval(conn: sqlite3.Connection, approval_id: str) -> dict[str, Any]:
    r = conn.execute("SELECT * FROM approvals WHERE id = ?", (approval_id,)).fetchone()
    if not r:
        raise ApprovalError("aprovação não encontrada")
    d = dict(r)
    d["params"] = json.loads(d["params"])
    return d


def list_approvals(conn: sqlite3.Connection, state: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
    expire_due(conn)
    q = "SELECT id FROM approvals" + (" WHERE state = ?" if state else "") + " ORDER BY requested_at DESC LIMIT ?"
    return [get_approval(conn, r["id"]) for r in conn.execute(q, ([state] if state else []) + [limit])]


def expire_due(conn: sqlite3.Connection, environment: str = "live") -> int:
    now = iso(utcnow())
    with transaction(conn):
        rows = conn.execute("SELECT id, agent_id, task_id FROM approvals WHERE state IN ('pending','approved') AND expires_at <= ?", (now,)).fetchall()
        for r in rows:
            conn.execute("UPDATE approvals SET state = 'expired' WHERE id = ?", (r["id"],))
            append_event(conn, "approval.expired", "Aprovação expirou sem ser usada", actor="system", task_id=r["task_id"], result="warning", data={"approval": r["id"]}, environment=environment)
    return len(rows)


def decide(conn: sqlite3.Connection, approval_id: str, *, approver: str, approve: bool, note: str = "", environment: str = "live") -> dict[str, Any]:
    expire_due(conn, environment)
    with transaction(conn):
        r = conn.execute("SELECT * FROM approvals WHERE id = ?", (approval_id,)).fetchone()
        if not r:
            raise ApprovalError("aprovação não encontrada")
        if r["state"] != "pending":
            raise ApprovalError(f"aprovação não está pendente ({r['state']})")
        if approver.startswith("agent:"):
            raise ApprovalError("agente não aprova ação (nem a própria nem a de outro)")
        state = "approved" if approve else "rejected"
        conn.execute("UPDATE approvals SET state = ?, decided_by = ?, decided_at = ?, decision_note = ? WHERE id = ?", (state, approver, iso(utcnow()), note[:500], approval_id))
        append_event(conn, f"approval.{state}", f"Aprovação {'concedida' if approve else 'negada'} por {approver}", actor=f"user:{approver}", task_id=r["task_id"], result="success" if approve else "warning", data={"approval": approval_id}, environment=environment)
    return get_approval(conn, approval_id)


def revoke(conn: sqlite3.Connection, approval_id: str, *, by: str, environment: str = "live") -> dict[str, Any]:
    with transaction(conn):
        r = conn.execute("SELECT * FROM approvals WHERE id = ?", (approval_id,)).fetchone()
        if not r or r["state"] not in ("pending", "approved"):
            raise ApprovalError("só se revoga uma aprovação pendente ou concedida e ainda não usada")
        conn.execute("UPDATE approvals SET state = 'revoked', decided_by = ?, decided_at = ? WHERE id = ?", (by, iso(utcnow()), approval_id))
        append_event(conn, "approval.revoked", f"Aprovação revogada por {by}", actor=f"user:{by}", task_id=r["task_id"], result="warning", data={"approval": approval_id}, environment=environment)
    return get_approval(conn, approval_id)


def consume(conn: sqlite3.Connection, approval_id: str, *, action: str, params: dict[str, Any], destination: str, environment: str = "live") -> dict[str, Any]:
    """Usa a aprovação para executar exatamente a ação aprovada (uma vez). Qualquer diferença recusa."""
    expire_due(conn, environment)
    with transaction(conn):
        r = conn.execute("SELECT * FROM approvals WHERE id = ?", (approval_id,)).fetchone()
        if not r:
            raise ApprovalError("aprovação não encontrada")
        if r["state"] != "approved":
            raise ApprovalError(f"aprovação não está concedida ({r['state']})")
        if parse_iso(r["expires_at"]) <= utcnow():
            raise ApprovalError("aprovação expirada")
        if r["action_hash"] != action_hash(action, params, destination):
            append_event(conn, "approval.mismatch", "Tentativa de usar a aprovação para outra ação ou outros parâmetros", actor="system", task_id=r["task_id"], result="failure", data={"approval": approval_id}, environment=environment)
            raise ApprovalError("a ação, os parâmetros ou o destino diferem do que foi aprovado")
        conn.execute("UPDATE approvals SET state = 'consumed', executed_at = ? WHERE id = ? AND state = 'approved'", (iso(utcnow()), approval_id))
        append_event(conn, "approval.consumed", f"Aprovação usada: {action} → {destination}", actor="system", task_id=r["task_id"], result="info", data={"approval": approval_id}, environment=environment)
    return get_approval(conn, approval_id)


def record_execution_result(conn: sqlite3.Connection, approval_id: str, result: str) -> None:
    with transaction(conn):
        conn.execute("UPDATE approvals SET execution_result = ? WHERE id = ? AND state = 'consumed'", (result[:1000], approval_id))
