"""API do runtime (``/v1/runtime``): consultar agentes, tarefas, execuções, eventos, aprovações e
indicadores; criar e cancelar tarefas; decidir aprovações. Toda rota exige token e papel.

A API não executa nada: ela registra pedidos e lê estado. Quem executa é o worker (``cli worker``), com
as ferramentas da lista fixa. Não há rota que rode código, comando de terminal ou ferramenta livre.
"""

from __future__ import annotations

import sqlite3
from typing import Any, Iterator, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, ValidationError

from . import approvals as ap
from . import store
from .agents import DEFINITIONS, INPUT_MODELS, describe, register_definitions
from .auth import Principal, require
from .db import connect, db_path, migrate
from .evaluation import list_evaluations
from .llm import provider_from_env
from .metrics import operational_metrics, tower_status

router = APIRouter(prefix="/v1/runtime", tags=["runtime"])
_ready: set[str] = set()


def get_conn() -> Iterator[sqlite3.Connection]:
    path = str(db_path())
    conn = connect(path)
    try:
        if path not in _ready:
            migrate(conn)
            register_definitions(conn)
            _ready.add(path)
        yield conn
    finally:
        conn.close()


def page(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0, le=100_000)) -> tuple[int, int]:
    return limit, offset


@router.get("/status")
def status(p: Principal = Depends(require("reader")), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    v = conn.execute("SELECT version FROM schema_version").fetchone()[0]
    last_worker = conn.execute("SELECT type, at FROM events WHERE type LIKE 'worker.%' ORDER BY seq DESC LIMIT 1").fetchone()
    return {
        "schema_version": v,
        "model_provider": {"available": provider_from_env().available()},
        "worker": dict(last_worker) if last_worker else None,
        "principal": {"name": p.name, "role": p.role},
    }


@router.get("/agents")
def agents(_: Principal = Depends(require("reader"))) -> list[dict[str, Any]]:
    avail = provider_from_env().available()
    return [describe(d, avail) for d in DEFINITIONS.values()]


class TaskIn(BaseModel):
    agent_id: str = Field(max_length=60)
    objective: str = Field(min_length=3, max_length=500)
    input: dict[str, Any] = Field(default_factory=dict)
    dedupe_key: str | None = Field(default=None, max_length=120, pattern=r"^[a-zA-Z0-9:._-]+$")


@router.post("/tasks", status_code=201)
def create_task(body: TaskIn, p: Principal = Depends(require("operator", write=True)), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    d = DEFINITIONS.get(body.agent_id)
    if not d or not d.enabled:
        raise HTTPException(status_code=404, detail="Agente não encontrado ou desligado")
    try:
        valid = INPUT_MODELS[d.id].model_validate(body.input).model_dump()
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=[{"loc": err["loc"], "msg": err["msg"]} for err in e.errors()]) from None
    return store.create_task(conn, agent_id=d.id, agent_version=d.version, objective=body.objective, input=valid, max_attempts=d.limits.max_attempts, created_by=f"user:{p.name}", dedupe_key=body.dedupe_key)


TaskState = Literal["queued", "running", "waiting_approval", "succeeded", "failed", "cancelled"]


@router.get("/tasks")
def tasks(state: TaskState | None = None, agent_id: str | None = Query(None, max_length=60), pg: tuple[int, int] = Depends(page), _: Principal = Depends(require("reader")), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    items, total = store.list_tasks(conn, state=state, agent_id=agent_id, limit=pg[0], offset=pg[1])
    for t in items:
        t.pop("result", None)  # a listagem é leve; o relatório vem em /tasks/{id}
    return {"items": items, "total": total, "limit": pg[0], "offset": pg[1]}


@router.get("/tasks/{task_id}")
def task(task_id: str, _: Principal = Depends(require("reader")), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    try:
        return store.get_task(conn, task_id)
    except store.NotFound:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada") from None


@router.get("/tasks/{task_id}/executions")
def executions(task_id: str, _: Principal = Depends(require("reader")), conn: sqlite3.Connection = Depends(get_conn)) -> list[dict[str, Any]]:
    task(task_id, _, conn)
    return store.list_executions(conn, task_id)


@router.post("/tasks/{task_id}/cancel")
def cancel(task_id: str, p: Principal = Depends(require("operator", write=True)), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    try:
        return store.request_cancel(conn, task_id, actor=f"user:{p.name}")
    except store.NotFound:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada") from None
    except store.InvalidTransition as e:
        raise HTTPException(status_code=409, detail=str(e)) from None


@router.get("/events")
def events(task_id: str | None = Query(None, max_length=60), after: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500), _: Principal = Depends(require("reader")), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    items = store.list_events(conn, task_id=task_id, after=after, limit=limit)
    return {"items": items, "next_after": items[-1]["seq"] if items else after}


@router.get("/approvals")
def approvals(state: Literal["pending", "approved", "rejected", "revoked", "expired", "consumed"] | None = None, _: Principal = Depends(require("reader")), conn: sqlite3.Connection = Depends(get_conn)) -> list[dict[str, Any]]:
    return ap.list_approvals(conn, state)


class DecisionIn(BaseModel):
    approve: bool
    note: str = Field(default="", max_length=500)


@router.post("/approvals/{approval_id}/decision")
def decide(approval_id: str, body: DecisionIn, p: Principal = Depends(require("approver", write=True)), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    try:
        return ap.decide(conn, approval_id, approver=p.name, approve=body.approve, note=body.note)
    except ap.ApprovalError as e:
        raise HTTPException(status_code=409, detail=str(e)) from None


@router.post("/approvals/{approval_id}/revoke")
def revoke(approval_id: str, p: Principal = Depends(require("approver", write=True)), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    try:
        return ap.revoke(conn, approval_id, by=p.name)
    except ap.ApprovalError as e:
        raise HTTPException(status_code=409, detail=str(e)) from None


@router.get("/metrics")
def metrics(_: Principal = Depends(require("reader")), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return operational_metrics(conn)


@router.get("/evaluations")
def evaluations(agent_id: str | None = Query(None, max_length=60), _: Principal = Depends(require("reader")), conn: sqlite3.Connection = Depends(get_conn)) -> list[dict[str, Any]]:
    return list_evaluations(conn, agent_id)


@router.get("/tower")
def tower(_: Principal = Depends(require("reader")), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return tower_status(conn)
