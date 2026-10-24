"""Provedor de modelos de IA: uma abstração com limites, orçamento e registro de consumo.

- A chave fica só no servidor (variável de ambiente). Nunca em VITE_*, no frontend ou no repositório.
- Sem chave, sem provedor ou sem orçamento configurado, o provedor fica indisponível e quem depende
  dele recebe ``ModelUnavailable``: nada é simulado.
- Chamada paga só com orçamento diário explícito (> 0) e dentro do orçamento da tarefa.
"""

from __future__ import annotations

import json
import os
import sqlite3
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Protocol

from .db import transaction
from .store import iso, utcnow


class ModelUnavailable(Exception):
    """Não há provedor configurado (ou o orçamento não permite): a etapa que depende dele não roda."""


class ModelError(Exception):
    """O provedor respondeu com erro, limite de taxa ou resposta inválida."""

    def __init__(self, message: str, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


@dataclass
class Completion:
    text: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float


class ModelProvider(Protocol):
    name: str
    model: str

    def available(self) -> bool: ...
    def estimate_max_cost(self, prompt_chars: int, max_tokens: int) -> float: ...
    def complete(self, system: str, prompt: str, *, max_tokens: int, timeout_s: float) -> Completion: ...


@dataclass
class ProviderConfig:
    provider: str | None
    api_key: str | None = field(repr=False)
    model: str
    price_in_per_mtok: float
    price_out_per_mtok: float
    daily_budget_usd: float
    max_tokens: int
    timeout_s: float

    @staticmethod
    def from_env() -> "ProviderConfig":
        f = lambda k, d: float(os.environ.get(k, d))  # noqa: E731
        return ProviderConfig(
            provider=os.environ.get("BEZALEL_LLM_PROVIDER") or None,
            api_key=os.environ.get("ANTHROPIC_API_KEY") or None,
            model=os.environ.get("BEZALEL_LLM_MODEL", "claude-sonnet-5"),
            price_in_per_mtok=f("BEZALEL_LLM_PRICE_IN_PER_MTOK", "0"),
            price_out_per_mtok=f("BEZALEL_LLM_PRICE_OUT_PER_MTOK", "0"),
            daily_budget_usd=f("BEZALEL_LLM_DAILY_BUDGET_USD", "0"),
            max_tokens=int(os.environ.get("BEZALEL_LLM_MAX_TOKENS", "800")),
            timeout_s=f("BEZALEL_LLM_TIMEOUT_S", "60"),
        )


class UnconfiguredProvider:
    """O que existe quando nenhum provedor foi configurado: informa a indisponibilidade."""

    name = "none"
    model = "none"

    def available(self) -> bool:
        return False

    def estimate_max_cost(self, prompt_chars: int, max_tokens: int) -> float:
        return 0.0

    def complete(self, system: str, prompt: str, *, max_tokens: int, timeout_s: float) -> Completion:
        raise ModelUnavailable("Nenhum provedor de modelo configurado neste servidor (BEZALEL_LLM_PROVIDER e a chave).")


class AnthropicProvider:
    """Messages API da Anthropic, pela biblioteca padrão (sem dependência nova)."""

    name = "anthropic"
    URL = "https://api.anthropic.com/v1/messages"

    def __init__(self, cfg: ProviderConfig):
        self.cfg = cfg
        self.model = cfg.model

    def available(self) -> bool:
        # Preço e orçamento explícitos: sem eles, não há como respeitar o teto de custo.
        return bool(self.cfg.api_key) and self.cfg.daily_budget_usd > 0 and self.cfg.price_in_per_mtok > 0 and self.cfg.price_out_per_mtok > 0

    def estimate_max_cost(self, prompt_chars: int, max_tokens: int) -> float:
        # Teto pessimista (antes da chamada): ~1 token a cada 3 caracteres de entrada + o máximo de saída.
        return (prompt_chars / 3) / 1e6 * self.cfg.price_in_per_mtok + max_tokens / 1e6 * self.cfg.price_out_per_mtok

    def complete(self, system: str, prompt: str, *, max_tokens: int, timeout_s: float) -> Completion:
        if not self.available():
            raise ModelUnavailable("Provedor Anthropic sem chave, preço ou orçamento diário configurado.")
        body = json.dumps({"model": self.model, "max_tokens": max_tokens, "system": system, "messages": [{"role": "user", "content": prompt}]}).encode()
        req = urllib.request.Request(self.URL, data=body, method="POST", headers={"content-type": "application/json", "x-api-key": self.cfg.api_key or "", "anthropic-version": "2023-06-01"})
        try:
            with urllib.request.urlopen(req, timeout=timeout_s) as res:
                data = json.loads(res.read().decode())
        except urllib.error.HTTPError as e:
            raise ModelError(f"HTTP {e.code} do provedor", retryable=e.code in (429, 500, 502, 503, 529)) from None
        except (urllib.error.URLError, TimeoutError) as e:
            raise ModelError(f"provedor inacessível: {type(e).__name__}", retryable=True) from None
        except json.JSONDecodeError:
            raise ModelError("resposta do provedor não é JSON") from None
        try:
            text = "".join(b.get("text", "") for b in data["content"] if b.get("type") == "text")
            u = data["usage"]
            tin, tout = int(u["input_tokens"]), int(u["output_tokens"])
        except (KeyError, TypeError, ValueError):
            raise ModelError("resposta do provedor fora do formato esperado") from None
        cost = tin / 1e6 * self.cfg.price_in_per_mtok + tout / 1e6 * self.cfg.price_out_per_mtok
        return Completion(text=text, model=data.get("model", self.model), input_tokens=tin, output_tokens=tout, cost_usd=round(cost, 6))


def provider_from_env() -> ModelProvider:
    cfg = ProviderConfig.from_env()
    if cfg.provider == "anthropic":
        return AnthropicProvider(cfg)
    return UnconfiguredProvider()


def spent_today(conn: sqlite3.Connection) -> float:
    day = iso(utcnow())[:10]
    return float(conn.execute("SELECT COALESCE(SUM(cost_usd), 0) FROM usage_ledger WHERE day = ?", (day,)).fetchone()[0])


def record_usage(conn: sqlite3.Connection, c: Completion, provider: str, task_id: str | None, execution_id: str | None) -> None:
    now = iso(utcnow())
    with transaction(conn):
        conn.execute(
            "INSERT INTO usage_ledger (at, day, task_id, execution_id, provider, model, input_tokens, output_tokens, cost_usd) VALUES (?,?,?,?,?,?,?,?,?)",
            (now, now[:10], task_id, execution_id, provider, c.model, c.input_tokens, c.output_tokens, c.cost_usd),
        )


def daily_budget() -> float:
    return ProviderConfig.from_env().daily_budget_usd
