"""Registro de agentes (Agent Definitions): identidade, missão, ferramentas permitidas, limites e critérios.

Estar registrado não faz de um agente "operacional": a disponibilidade é calculada (depende das
ferramentas e credenciais de que ele precisa) e o que ele produz só conta depois de avaliado.
Definições são versionadas; uma tarefa guarda a versão com que foi criada.
"""

from __future__ import annotations

import json
import sqlite3
from typing import Any, Callable, Literal

from pydantic import BaseModel, Field

from .db import transaction
from .store import iso, utcnow

Autonomy = Literal["A", "B", "C", "D"]
LEVEL_ORDER = {"A": 0, "B": 1, "C": 2, "D": 3}


class Limits(BaseModel):
    timeout_s: int = Field(ge=1, le=3600)
    max_steps: int = Field(ge=1, le=200)
    max_attempts: int = Field(ge=1, le=10)
    max_model_calls: int = Field(ge=0, le=50)
    max_cost_usd: float = Field(ge=0, le=50)
    backoff_base_s: int = Field(default=30, ge=1, le=3600)


class AgentDefinition(BaseModel):
    id: str = Field(pattern=r"^[a-z][a-z0-9-]{2,40}$")
    version: int = Field(ge=1)
    name: str
    description: str
    objective: str
    sector: str
    autonomy: Autonomy
    tools: list[str]
    limits: Limits
    success_criteria: list[str]
    evaluation_criteria: list[str]
    # Política de recuperação depois de uma execução interrompida (worker reiniciou no meio):
    # 'retry' só para agentes idempotentes (somente leitura); 'manual' exige uma pessoa decidir.
    recovery: Literal["retry", "manual"]
    needs_model: bool = False
    enabled: bool = True


class SiteIntelligenceInput(BaseModel):
    """Entrada validada da tarefa do Site Intelligence Agent."""

    target: Literal["dist"] = "dist"
    base_path: str = Field(default="/site_bezalel/", pattern=r"^/([a-zA-Z0-9_-]+/)*$")
    # Verificações do projeto (npm run …): demoram minutos; só com pedido explícito.
    project_checks: list[Literal["typecheck", "lint", "test", "check:models", "check:budget"]] = Field(default_factory=list)
    # Resumo em texto por um modelo (só se houver provedor configurado e orçamento).
    summarize: bool = False
    max_pages: int = Field(default=400, ge=1, le=2000)


SITE_INTELLIGENCE = AgentDefinition(
    id="site-intelligence",
    # v2: sem os falsos positivos achados na revisão da v1 (a base sem barra como link quebrado; canonical e
    # sitemap exigidos de páginas noindex).
    version=2,
    name="Site Intelligence Agent",
    description="Inspeciona o build do site Bezalel e produz um relatório de qualidade técnica, SEO e oportunidades, com evidências.",
    objective="Encontrar problemas demonstráveis no site (rotas, metadados, sitemap/robots, links internos, acessibilidade estática, tamanho do bundle, verificações do projeto) e priorizá-los, sem alterar nada.",
    sector="engineering",
    autonomy="A",
    tools=["site.build_artifacts", "site.pages_meta", "site.sitemap_robots", "site.internal_links", "site.a11y_static", "project.run_check", "model.summarize"],
    limits=Limits(timeout_s=1800, max_steps=20, max_attempts=3, max_model_calls=1, max_cost_usd=0.05, backoff_base_s=30),
    success_criteria=[
        "Toda verificação termina como passed, failed, not_run ou error, com o motivo",
        "Todo problema tem evidência (arquivo, página, trecho ou saída do comando)",
        "Nenhum arquivo é alterado e nenhum serviço externo é chamado",
    ],
    evaluation_criteria=["precisão dos achados", "evidência suficiente", "falsos positivos", "cobertura", "reprodutibilidade", "tempo", "custo", "utilidade das recomendações"],
    recovery="retry",
    needs_model=False,
)

DEFINITIONS: dict[str, AgentDefinition] = {SITE_INTELLIGENCE.id: SITE_INTELLIGENCE}
INPUT_MODELS: dict[str, type[BaseModel]] = {SITE_INTELLIGENCE.id: SiteIntelligenceInput}


def register_definitions(conn: sqlite3.Connection, definitions: dict[str, AgentDefinition] | None = None) -> None:
    """Grava uma cópia de cada versão das definições (auditoria: o que o agente podia fazer em cada data)."""
    with transaction(conn):
        for d in (definitions or DEFINITIONS).values():
            conn.execute(
                "INSERT OR IGNORE INTO agent_definitions (id, version, definition, registered_at) VALUES (?,?,?,?)",
                (d.id, d.version, d.model_dump_json(), iso(utcnow())),
            )


def availability(d: AgentDefinition, model_available: bool) -> str:
    if not d.enabled:
        return "disabled"
    if d.needs_model and not model_available:
        return "requires_credentials"
    return "available"


def describe(d: AgentDefinition, model_available: bool) -> dict[str, Any]:
    # "available" diz só que ele pode rodar; se o trabalho presta, quem diz são as avaliações.
    return {**json.loads(d.model_dump_json()), "availability": availability(d, model_available)}


AgentRunner = Callable[..., dict[str, Any]]
