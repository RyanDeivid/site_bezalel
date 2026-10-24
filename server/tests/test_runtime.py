"""Testes do runtime de agentes: tarefas, execuções, eventos, recuperação, limites, permissões,
aprovações, provedor de modelo e o Site Intelligence Agent sobre sites de teste com problemas conhecidos."""

from __future__ import annotations

import os
import threading
import time
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.runtime import approvals as ap
from app.runtime import store
from app.runtime.agents import DEFINITIONS, SITE_INTELLIGENCE, Limits, describe, register_definitions
from app.runtime.auth import hash_token
from app.runtime.db import connect, migrate
from app.runtime.evaluation import EVALUATOR, evaluate_site_report, record_evaluation
from app.runtime.executor import Executor
from app.runtime.llm import AnthropicProvider, Completion, ModelError, ProviderConfig, UnconfiguredProvider, provider_from_env
from app.runtime.metrics import operational_metrics, tower_status
from app.runtime.schedules import add_schedule, tick_schedules
from app.runtime.tools import CommandResult

ENV = "test"

# ---- Ambiente de teste -------------------------------------------------------------------------------


def page(title: str | None, desc: str, canonical: str, body: str = "") -> str:
    t = f"<title>{title}</title>" if title is not None else ""
    return f'<!doctype html><html lang="pt-BR"><head>{t}<meta name="description" content="{desc}"><link rel="canonical" href="{canonical}"></head><body><h1>Página</h1>{body}</body></html>'


GOOD_DESC = "Descrição de teste com tamanho adequado para os resultados de busca do site."


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """Um repositório de mentira com um build com problemas CONHECIDOS (o gabarito do avaliador)."""
    r = tmp_path / "repo"
    (r / "src").mkdir(parents=True)
    (r / "src" / "a.ts").write_text("export {}")
    old = time.time() - 3600
    os.utime(r / "src" / "a.ts", (old, old))
    d = r / "dist"
    (d / "explore").mkdir(parents=True)
    (d / "about").mkdir()
    (d / "assets").mkdir()
    (d / "assets" / "app.js").write_text("console.log(1)")
    base = "https://exemplo.dev/site_bezalel"
    (d / "index.html").write_text(page("Início · Bezalel", GOOD_DESC, f"{base}/", '<a href="/site_bezalel/explore/">ok</a><a href="/site_bezalel/sumiu/">quebrado</a><img src="/x.png">'), encoding="utf-8")
    (d / "explore" / "index.html").write_text(page(None, GOOD_DESC, f"{base}/explore/", '<a href="/site_bezalel/">início</a>'), encoding="utf-8")
    (d / "about" / "index.html").write_text(page("Sobre · Bezalel", GOOD_DESC, f"{base}/about/", '<a href="https://externo.org/">fora</a><a href="/site_bezalel">início sem barra</a>'), encoding="utf-8")
    # Página pessoal com noindex, sem canonical e fora do sitemap: tudo de propósito (não é problema).
    (d / "saved").mkdir()
    (d / "saved" / "index.html").write_text('<!doctype html><html lang="pt-BR"><head><title>Salvos · Bezalel</title><meta name="description" content="' + GOOD_DESC + '"><meta name="robots" content="noindex"></head><body><h1>Salvos</h1></body></html>', encoding="utf-8")
    (d / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {base}/sitemap.xml\n")
    (d / "sitemap.xml").write_text(
        '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"<url><loc>{base}/</loc></url><url><loc>{base}/explore/</loc></url><url><loc>{base}/fantasma/</loc></url></urlset>"
    )
    return r


# O gabarito inclui o noindex como informação; não inclui falsos positivos conhecidos (a base sem barra
# como link quebrado, canonical ou sitemap exigidos de página noindex).
EXPECTED = {
    "site.pages_meta:noindex",
    "site.pages_meta:missing-title",
    "site.internal_links:broken-internal-link",
    "site.a11y_static:img-no-alt",
    "site.sitemap_robots:sitemap-dead-url",
    "site.sitemap_robots:sitemap-missing-page",
}


@pytest.fixture
def db(tmp_path: Path) -> Path:
    p = tmp_path / "runtime.db"
    c = connect(p)
    migrate(c)
    register_definitions(c)
    c.close()
    return p


def make_executor(db: Path, repo: Path, **kw) -> Executor:
    overrides = {"repo_root": repo, **kw.pop("overrides", {})}
    return Executor(lambda: connect(db), environment=ENV, provider=kw.pop("provider", UnconfiguredProvider()), tool_overrides=overrides, **kw)


def enqueue(conn, **inp) -> dict:
    d = SITE_INTELLIGENCE
    return store.create_task(conn, agent_id=d.id, agent_version=d.version, objective="Relatório de teste", input={"project_checks": [], "summarize": False, "target": "dist", "base_path": "/site_bezalel/", "max_pages": 400, **inp}, max_attempts=d.limits.max_attempts, created_by="user:teste", environment=ENV)


class FakeProvider:
    """Provedor de teste (dublê declarado): devolve o que o teste manda, ou falha como o teste manda."""

    name = "fake"
    model = "fake-model"

    def __init__(self, text="Resumo.", error: Exception | None = None, cost=0.001, estimate=0.001):
        self.text, self.error, self.cost, self.estimate, self.calls = text, error, cost, estimate, 0

    def available(self) -> bool:
        return True

    def estimate_max_cost(self, prompt_chars: int, max_tokens: int) -> float:
        return self.estimate

    def complete(self, system, prompt, *, max_tokens, timeout_s):
        self.calls += 1
        if self.error:
            raise self.error
        return Completion(self.text, self.model, 100, 50, self.cost)


# ---- Registro de agentes -----------------------------------------------------------------------------


def test_registry_definitions_are_versioned_and_registration_is_idempotent(db):
    c = connect(db)
    register_definitions(c)
    register_definitions(c)
    rows = c.execute("SELECT id, version FROM agent_definitions").fetchall()
    assert [(r["id"], r["version"]) for r in rows] == [("site-intelligence", SITE_INTELLIGENCE.version)]
    desc = describe(SITE_INTELLIGENCE, model_available=False)
    # Registrado e disponível para rodar não quer dizer que o trabalho presta: não há campo "operacional".
    assert desc["availability"] == "available" and "operational" not in desc
    assert desc["autonomy"] == "A" and "project.run_check" in desc["tools"]
    needs = SITE_INTELLIGENCE.model_copy(update={"needs_model": True})
    assert describe(needs, model_available=False)["availability"] == "requires_credentials"


# ---- Tarefas e transições ------------------------------------------------------------------------------


def test_task_transitions_valid_and_invalid(db):
    c = connect(db)
    t = enqueue(c)
    assert t["state"] == "queued"
    with pytest.raises(store.InvalidTransition):
        store.transition(c, t["id"], "succeeded", actor="teste", summary="pular a execução", environment=ENV)
    store.request_cancel(c, t["id"], actor="user:teste", environment=ENV)
    assert store.get_task(c, t["id"])["state"] == "cancelled"
    # Cancelada não volta a rodar, por nenhum caminho.
    for to in ("queued", "running", "succeeded"):
        with pytest.raises(store.InvalidTransition):
            store.transition(c, t["id"], to, actor="teste", summary="ressuscitar", environment=ENV)
    with pytest.raises(store.InvalidTransition):
        store.request_cancel(c, t["id"], actor="user:teste", environment=ENV)


def test_dedupe_key_returns_the_active_task_instead_of_duplicating(db):
    c = connect(db)
    d = SITE_INTELLIGENCE
    a = store.create_task(c, agent_id=d.id, agent_version=d.version, objective="x", input={}, max_attempts=1, created_by="t", dedupe_key="k1", environment=ENV)
    b = store.create_task(c, agent_id=d.id, agent_version=d.version, objective="x", input={}, max_attempts=1, created_by="t", dedupe_key="k1", environment=ENV)
    assert a["id"] == b["id"]


def test_demo_events_never_enter_the_runtime_trail(db):
    c = connect(db)
    with pytest.raises(ValueError):
        store.append_event(c, "x", "demonstração", actor="system", environment="demo")


# ---- Execução completa do Site Intelligence Agent --------------------------------------------------------


def test_site_intelligence_full_run_with_real_evidence_and_independent_evaluation(db, repo):
    c = connect(db)
    t = enqueue(c)
    ex = make_executor(db, repo)
    assert ex.run_once() == t["id"]
    done = store.get_task(c, t["id"])
    assert done["state"] == "succeeded" and done["attempts"] == 1
    r = done["result"]
    assert r["schema"] == "site-intelligence-report/1" and r["task_id"] == t["id"] and r["duration_ms"] >= 0
    keys = {f"{f['check']}:{f['kind']}" for f in r["findings"]}
    assert EXPECTED <= keys
    assert all(f["evidence"] for f in r["findings"])
    statuses = {c_["id"]: c_["status"] for c_ in r["checks"]}
    assert statuses["build.artifacts"] == "passed"
    assert statuses["site.internal_links"] == "failed"
    # O que não foi pedido ou não pôde ser feito aparece como limitação, não como resultado.
    assert any("rede" in item for item in r["limitations"])
    assert r["model_summary"]["status"] == "not_requested"
    assert r["usage"]["cost_usd"] == 0
    # Um link externo existe, mas não é acessado (rede não autorizada): só é contado.
    links = next(x for x in r["checks"] if x["id"] == "site.internal_links")
    assert any("domínios externos" in e for e in links["evidence"])
    # Eventos na ordem, todos do ambiente de teste.
    evs = store.list_events(c, task_id=t["id"], limit=500)
    types = [e["type"] for e in evs]
    assert types[0] == "task.created" and types[1] == "task.running" and types[-1] == "task.succeeded"
    assert types.count("tool.started") == 5 == types.count("tool.finished")
    assert {e["environment"] for e in evs} == {"test"}
    # Avaliação independente: precisão e revocação contra o gabarito.
    scores = evaluate_site_report(r, expected=EXPECTED)
    assert scores["recall"] == 1.0 and scores["evidence_sufficiency"] == 1.0 and scores["checks_accounted"] == 1.0
    assert scores["false_positives"] == []
    record_evaluation(c, done, scores, environment=ENV)
    with pytest.raises(ValueError):
        record_evaluation(c, done, scores, evaluator="agent:site-intelligence", environment=ENV)
    # Reprodutível: a segunda execução sobre o mesmo build acha o mesmo.
    t2 = enqueue(c)
    make_executor(db, repo).run_once()
    assert evaluate_site_report(store.get_task(c, t2["id"])["result"], previous=r)["reproducibility"] == 1.0
    assert EVALUATOR.startswith("evaluator:")


def test_site_intelligence_without_build_says_so_instead_of_inventing(db, tmp_path):
    empty = tmp_path / "vazio"
    (empty / "src").mkdir(parents=True)
    c = connect(db)
    t = enqueue(c)
    make_executor(db, empty).run_once()
    r = store.get_task(c, t["id"])["result"]
    assert r["findings"] == []
    assert all(x["status"] == "not_run" and x["reason"] for x in r["checks"])
    assert evaluate_site_report(r, expected=set())["coverage"] == 0.0
    assert any("não rodou" in item for item in r["limitations"])


# ---- Persistência, duplicação e recuperação --------------------------------------------------------------


def test_task_survives_restart_and_runs_in_a_new_worker(db, repo):
    c = connect(db)
    t = enqueue(c)
    c.close()
    # "Reinício": conexões e executor novos sobre o mesmo arquivo.
    c2 = connect(db)
    assert store.get_task(c2, t["id"])["state"] == "queued"
    make_executor(db, repo).run_once()
    assert store.get_task(connect(db), t["id"])["state"] == "succeeded"


def test_two_workers_never_claim_the_same_task(db, repo):
    c = connect(db)
    enqueue(c)
    results = []
    barrier = threading.Barrier(2)

    def worker(name):
        conn = connect(db)
        barrier.wait()
        results.append(store.claim_next(conn, name, 60, ["site-intelligence"], ENV))

    threads = [threading.Thread(target=worker, args=(f"w{i}",)) for i in range(2)]
    [th.start() for th in threads]
    [th.join() for th in threads]
    assert sum(1 for x in results if x) == 1
    assert c.execute("SELECT COUNT(*) FROM executions").fetchone()[0] == 1


def test_recovery_after_crash_is_explicit_and_idempotent(db, repo):
    c = connect(db)
    t = enqueue(c)
    claimed = store.claim_next(c, "morto", 60, ["site-intelligence"], ENV)
    assert claimed
    # O worker "morreu": a posse venceu sem renovação.
    c.execute("UPDATE tasks SET lease_until = ? WHERE id = ?", (store.iso(store.utcnow() - timedelta(seconds=5)), t["id"]))
    ex = make_executor(db, repo)
    assert ex.recover() == [t["id"]]
    assert ex.recover() == []  # idempotente
    after = store.get_task(c, t["id"])
    assert after["state"] == "queued" and after["attempts"] == 1
    assert store.list_executions(c, t["id"])[0]["state"] == "interrupted"
    ex.run_once()
    final = store.get_task(c, t["id"])
    assert final["state"] == "succeeded" and final["attempts"] == 2


def test_non_idempotent_agent_is_not_retried_after_crash(db, repo):
    manual = SITE_INTELLIGENCE.model_copy(update={"recovery": "manual"})
    c = connect(db)
    t = enqueue(c)
    store.claim_next(c, "morto", 60, ["site-intelligence"], ENV)
    c.execute("UPDATE tasks SET lease_until = ? WHERE id = ?", (store.iso(store.utcnow() - timedelta(seconds=5)), t["id"]))
    make_executor(db, repo, definitions={manual.id: manual}).recover()
    after = store.get_task(c, t["id"])
    assert after["state"] == "failed" and "manual" in after["error"]


# ---- Tempo limite, tentativas, cancelamento ----------------------------------------------------------------


def test_command_timeout_is_reported_as_error_not_as_failure(db, repo):
    c = connect(db)
    t = enqueue(c, project_checks=["lint"])
    slow = lambda argv, cwd, timeout: CommandResult(None, "…", True, int(timeout * 1000))  # noqa: E731
    make_executor(db, repo, overrides={"run_command": slow}).run_once()
    r = store.get_task(c, t["id"])["result"]
    lint = next(x for x in r["checks"] if x["id"] == "project.lint")
    assert lint["status"] == "error" and "tempo limite" in lint["reason"]


def test_project_check_only_runs_the_fixed_list(db, repo):
    seen = []

    def runner(argv, cwd, timeout):
        seen.append(argv[1:])
        return CommandResult(1, "erro de tipos em x.ts", False, 10)

    c = connect(db)
    t = enqueue(c, project_checks=["typecheck"])
    make_executor(db, repo, overrides={"run_command": runner}).run_once()
    assert seen == [["run", "typecheck"]]
    r = store.get_task(c, t["id"])["result"]
    tc = next(x for x in r["checks"] if x["id"] == "project.typecheck")
    assert tc["status"] == "failed" and any(f["kind"] == "check-failed" for f in r["findings"])
    with pytest.raises(Exception):
        enqueue(c, project_checks=["rm -rf"])  # nem entra: a entrada é validada pelo esquema
        make_executor(db, repo).run_once()
        raise AssertionError


def test_execution_deadline_retries_with_backoff_then_fails(db, repo):
    # 2 s de prazo; o primeiro comando leva 2,2 s: a ferramenta seguinte já encontra o prazo vencido.
    quick = SITE_INTELLIGENCE.model_copy(update={"limits": Limits(timeout_s=2, max_steps=20, max_attempts=2, max_model_calls=0, max_cost_usd=0, backoff_base_s=30)})

    def slow(argv, cwd, timeout):
        time.sleep(2.2)
        return CommandResult(0, "ok", False, 2200)

    c = connect(db)
    t = store.create_task(c, agent_id=quick.id, agent_version=quick.version, objective="x", input={"project_checks": ["lint", "test"]}, max_attempts=2, created_by="t", environment=ENV)
    ex = make_executor(db, repo, definitions={quick.id: quick}, overrides={"run_command": slow})
    ex.run_once()
    t1 = store.get_task(c, t["id"])
    assert t1["state"] == "queued" and t1["not_before"] is not None and t1["attempts"] == 1
    assert store.list_executions(c, t["id"])[0]["state"] == "timed_out"
    assert ex.run_once() is None  # ainda esperando o backoff
    c.execute("UPDATE tasks SET not_before = NULL WHERE id = ?", (t["id"],))
    ex.run_once()
    t2 = store.get_task(c, t["id"])
    assert t2["state"] == "failed" and t2["attempts"] == 2


def test_cancel_running_task_at_next_safe_step(db, repo):
    c = connect(db)
    t = enqueue(c, project_checks=["lint"])

    def cancel_midway(argv, cwd, timeout):
        store.request_cancel(connect(db), t["id"], actor="user:teste", environment=ENV)
        return CommandResult(0, "ok", False, 5)

    make_executor(db, repo, overrides={"run_command": cancel_midway}).run_once()
    final = store.get_task(c, t["id"])
    assert final["state"] == "cancelled"
    assert store.list_executions(c, t["id"])[0]["state"] == "cancelled"


def test_worker_shutdown_returns_task_without_spending_attempt(db, repo):
    c = connect(db)
    t = enqueue(c)
    ex = make_executor(db, repo)
    ex.stop.set()
    claimed = store.claim_next(ex.conn, ex.worker, 60, ["site-intelligence"], ENV)
    ex._execute(*claimed)
    after = store.get_task(c, t["id"])
    assert after["state"] == "queued" and after["attempts"] == 0


# ---- Permissões das ferramentas ---------------------------------------------------------------------------


def test_tool_outside_the_agent_list_is_denied_and_fails_the_task(db, repo):
    restricted = SITE_INTELLIGENCE.model_copy(update={"tools": ["site.build_artifacts"]})
    c = connect(db)
    t = enqueue(c)
    make_executor(db, repo, definitions={restricted.id: restricted}).run_once()
    final = store.get_task(c, t["id"])
    assert final["state"] == "failed" and "ToolNotAllowed" in final["error"]
    assert any(e["type"] == "tool.denied" for e in store.list_events(c, task_id=t["id"]))


def test_tool_level_above_agent_autonomy_is_denied(db, repo, monkeypatch):
    from app.runtime import tools

    spec = tools.TOOLS["site.pages_meta"]
    monkeypatch.setitem(tools.TOOLS, "site.pages_meta", tools.ToolSpec(spec.name, "C", spec.description, spec.input_model, spec.timeout_s, spec.run))
    c = connect(db)
    t = enqueue(c)
    make_executor(db, repo).run_once()
    final = store.get_task(c, t["id"])
    assert final["state"] == "failed" and "exige nível C" in final["error"]


# ---- Provedor de modelo, credenciais e custos --------------------------------------------------------------


def test_no_credentials_means_unavailable_never_simulated(db, repo, monkeypatch):
    for k in ("BEZALEL_LLM_PROVIDER", "ANTHROPIC_API_KEY", "BEZALEL_LLM_DAILY_BUDGET_USD"):
        monkeypatch.delenv(k, raising=False)
    assert isinstance(provider_from_env(), UnconfiguredProvider)
    monkeypatch.setenv("BEZALEL_LLM_PROVIDER", "anthropic")
    p = provider_from_env()
    assert isinstance(p, AnthropicProvider) and not p.available()  # sem chave, sem preço, sem orçamento
    monkeypatch.setenv("ANTHROPIC_API_KEY", "x")
    assert not provider_from_env().available()  # chave sem orçamento explícito: chamada paga não acontece
    c = connect(db)
    t = enqueue(c, summarize=True)
    make_executor(db, repo).run_once()
    r = store.get_task(c, t["id"])["result"]
    assert r["model_summary"]["status"] == "not_run" and "provedor" in r["model_summary"]["reason"]
    assert store.get_task(c, t["id"])["state"] == "succeeded"  # o determinístico segue funcionando


def test_provider_failure_does_not_break_the_report(db, repo, monkeypatch):
    monkeypatch.setenv("BEZALEL_LLM_DAILY_BUDGET_USD", "1")
    c = connect(db)
    t = enqueue(c, summarize=True)
    fake = FakeProvider(error=ModelError("HTTP 429 do provedor", retryable=True))
    make_executor(db, repo, provider=fake).run_once()
    r = store.get_task(c, t["id"])["result"]
    assert store.get_task(c, t["id"])["state"] == "succeeded"
    assert r["model_summary"]["status"] == "not_run" and "429" in r["model_summary"]["reason"]


def test_model_cost_is_recorded_and_budget_is_checked_before_the_call(db, repo, monkeypatch):
    monkeypatch.setenv("BEZALEL_LLM_DAILY_BUDGET_USD", "1")
    c = connect(db)
    t = enqueue(c, summarize=True)
    fake = FakeProvider(text="Três problemas altos.", cost=0.002)
    make_executor(db, repo, provider=fake).run_once()
    done = store.get_task(c, t["id"])
    assert done["result"]["model_summary"]["status"] == "done"
    assert done["result"]["usage"] == {"model_calls": 1, "input_tokens": 100, "output_tokens": 50, "cost_usd": 0.002}
    assert abs(done["cost_usd"] - 0.002) < 1e-9
    assert c.execute("SELECT COUNT(*) FROM usage_ledger").fetchone()[0] == 1
    # Estimativa acima do orçamento da tarefa (US$ 0,05): o modelo nem é chamado.
    t2 = enqueue(c, summarize=True)
    pricey = FakeProvider(estimate=0.5)
    make_executor(db, repo, provider=pricey).run_once()
    r2 = store.get_task(c, t2["id"])["result"]
    assert pricey.calls == 0 and r2["model_summary"]["status"] == "not_run" and "orçamento" in r2["model_summary"]["reason"]
    # Orçamento diário esgotado: também não chama.
    monkeypatch.setenv("BEZALEL_LLM_DAILY_BUDGET_USD", "0.001")
    t3 = enqueue(c, summarize=True)
    third = FakeProvider()
    make_executor(db, repo, provider=third).run_once()
    assert third.calls == 0 and "orçamento" in store.get_task(c, t3["id"])["result"]["model_summary"]["reason"]


def test_anthropic_cost_estimate_uses_configured_prices():
    p = AnthropicProvider(ProviderConfig("anthropic", "k", "m", 3.0, 15.0, 1.0, 600, 30))
    assert p.available()
    assert abs(p.estimate_max_cost(3000, 600) - (1000 / 1e6 * 3 + 600 / 1e6 * 15)) < 1e-12


# ---- Aprovações ---------------------------------------------------------------------------------------------


def test_approval_is_bound_to_exact_action_and_expires(db):
    c = connect(db)
    a = ap.request_approval(c, agent_id="site-intelligence", action="publish.post", params={"text": "olá"}, destination="conta-teste", risks="nenhum", expected_effects="um post", ttl_seconds=60, environment=ENV)
    with pytest.raises(ap.ApprovalError):
        ap.decide(c, a["id"], approver="agent:site-intelligence", approve=True, environment=ENV)  # agente não aprova
    ap.decide(c, a["id"], approver="ryan", approve=True, environment=ENV)
    with pytest.raises(ap.ApprovalError):
        ap.consume(c, a["id"], action="publish.post", params={"text": "outro texto"}, destination="conta-teste", environment=ENV)
    ap.consume(c, a["id"], action="publish.post", params={"text": "olá"}, destination="conta-teste", environment=ENV)
    with pytest.raises(ap.ApprovalError):
        ap.consume(c, a["id"], action="publish.post", params={"text": "olá"}, destination="conta-teste", environment=ENV)  # uma vez só
    b = ap.request_approval(c, agent_id="site-intelligence", action="x", params={}, destination="d", risks="r", expected_effects="e", ttl_seconds=60, environment=ENV)
    ap.decide(c, b["id"], approver="ryan", approve=True, environment=ENV)
    c.execute("UPDATE approvals SET expires_at = ? WHERE id = ?", (store.iso(store.utcnow() - timedelta(seconds=1)), b["id"]))
    with pytest.raises(ap.ApprovalError):
        ap.consume(c, b["id"], action="x", params={}, destination="d", environment=ENV)
    assert ap.get_approval(c, b["id"])["state"] == "expired"
    r = ap.request_approval(c, agent_id="site-intelligence", action="y", params={}, destination="d", risks="r", expected_effects="e", ttl_seconds=60, environment=ENV)
    ap.decide(c, r["id"], approver="ryan", approve=True, environment=ENV)
    ap.revoke(c, r["id"], by="ryan", environment=ENV)
    with pytest.raises(ap.ApprovalError):
        ap.consume(c, r["id"], action="y", params={}, destination="d", environment=ENV)


# ---- Agendamentos ------------------------------------------------------------------------------------------


def test_schedule_creates_one_task_per_window_without_duplicates(db):
    c = connect(db)
    with pytest.raises(ValueError):
        add_schedule(c, DEFINITIONS, agent_id="site-intelligence", objective="x", input={}, interval_seconds=60, created_by="t", environment=ENV)
    s = add_schedule(c, DEFINITIONS, agent_id="site-intelligence", objective="recorrente", input={}, interval_seconds=3600, created_by="t", environment=ENV)
    later = store.utcnow() + timedelta(hours=2)
    first = tick_schedules(c, DEFINITIONS, now=later, environment=ENV)
    again = tick_schedules(c, DEFINITIONS, now=later + timedelta(hours=2), environment=ENV)
    assert len(first) == 1 and again == first  # a anterior ainda está na fila: não duplica
    assert c.execute("SELECT COUNT(*) FROM tasks WHERE schedule_id = ?", (s["id"],)).fetchone()[0] == 1


# ---- API: autenticação e autorização ------------------------------------------------------------------------


@pytest.fixture
def api(db, monkeypatch):
    tokens = {"leitor": "tok-leitor", "operador": "tok-operador", "aprovador": "tok-aprovador"}
    roles = {"leitor": "reader", "operador": "operator", "aprovador": "approver"}
    monkeypatch.setenv("BEZALEL_RUNTIME_DB", str(db))
    monkeypatch.setenv("BEZALEL_RUNTIME_TOKENS", ",".join(f"{n}:{roles[n]}:{hash_token(t)}" for n, t in tokens.items()))
    monkeypatch.setenv("BEZALEL_RUNTIME_ALLOW_REMOTE_WRITES", "1")
    from app.main import app

    client = TestClient(app)
    h = {n: {"Authorization": f"Bearer {t}"} for n, t in tokens.items()}
    return client, h


def test_api_is_closed_without_tokens(monkeypatch, db):
    monkeypatch.setenv("BEZALEL_RUNTIME_DB", str(db))
    monkeypatch.delenv("BEZALEL_RUNTIME_TOKENS", raising=False)
    from app.main import app

    assert TestClient(app).get("/v1/runtime/agents").status_code == 503


def test_api_authentication_and_authorization_per_action(api, monkeypatch):
    client, h = api
    assert client.get("/v1/runtime/agents").status_code == 401
    assert client.get("/v1/runtime/agents", headers={"Authorization": "Bearer errado"}).status_code == 401
    agents = client.get("/v1/runtime/agents", headers=h["leitor"]).json()
    assert agents[0]["id"] == "site-intelligence"
    body = {"agent_id": "site-intelligence", "objective": "Relatório pela API", "input": {}}
    assert client.post("/v1/runtime/tasks", json=body, headers=h["leitor"]).status_code == 403
    created = client.post("/v1/runtime/tasks", json=body, headers=h["operador"])
    assert created.status_code == 201 and created.json()["state"] == "queued"
    tid = created.json()["id"]
    assert client.post("/v1/runtime/tasks", json={**body, "input": {"project_checks": ["rm -rf /"]}}, headers=h["operador"]).status_code == 422
    assert client.post("/v1/runtime/tasks", json={**body, "agent_id": "nao-existe"}, headers=h["operador"]).status_code == 404
    listing = client.get("/v1/runtime/tasks", params={"limit": 1}, headers=h["leitor"]).json()
    assert listing["total"] == 1 and listing["limit"] == 1 and "result" not in listing["items"][0]
    evs = client.get("/v1/runtime/events", params={"task_id": tid}, headers=h["leitor"]).json()
    assert evs["items"][0]["type"] == "task.created" and evs["next_after"] >= 1
    assert client.post(f"/v1/runtime/tasks/{tid}/cancel", headers=h["leitor"]).status_code == 403
    assert client.post(f"/v1/runtime/tasks/{tid}/cancel", headers=h["operador"]).json()["state"] == "cancelled"
    assert client.post(f"/v1/runtime/tasks/{tid}/cancel", headers=h["operador"]).status_code == 409
    # Escrita de fora da máquina, sem a liberação consciente: recusada.
    monkeypatch.delenv("BEZALEL_RUNTIME_ALLOW_REMOTE_WRITES")
    assert client.post("/v1/runtime/tasks", json=body, headers=h["operador"]).status_code == 403
    # Indicadores e a visão da Torre: dados do runtime, marcados como tal.
    m = client.get("/v1/runtime/metrics", headers=h["leitor"]).json()
    assert m["source"] == "runtime" and m["business_metrics"] == []
    tw = client.get("/v1/runtime/tower", headers=h["leitor"]).json()
    assert tw["source"] == "runtime" and tw["sectors"][0]["source"] == "live"


def test_api_approval_decision_requires_approver(api, db):
    client, h = api
    a = ap.request_approval(connect(db), agent_id="site-intelligence", action="x", params={}, destination="d", risks="r", expected_effects="e", ttl_seconds=600, environment=ENV)
    url = f"/v1/runtime/approvals/{a['id']}/decision"
    assert client.post(url, json={"approve": True}, headers=h["operador"]).status_code == 403
    ok = client.post(url, json={"approve": True, "note": "ok"}, headers=h["aprovador"])
    assert ok.status_code == 200 and ok.json()["state"] == "approved" and ok.json()["decided_by"] == "aprovador"
    assert client.post(url, json={"approve": True}, headers=h["aprovador"]).status_code == 409


def test_product_agents_stay_demo_and_runtime_metrics_are_real(db, repo):
    from app.main import app

    product = TestClient(app).get("/v1/agents").json()
    assert all(a["mode"] == "demo" for a in product)  # os agentes de produto continuam demonstração
    c = connect(db)
    enqueue(c)
    make_executor(db, repo).run_once()
    m = operational_metrics(c, environment=ENV)
    assert m["last_30_days"]["succeeded"] == 1 and m["last_30_days"]["success_rate"] == 1.0
    tw = tower_status(c, environment=ENV)
    eng = next(s for s in tw["sectors"] if s["sector"] == "engineering")
    assert eng["recent_results"][0]["state"] == "succeeded" and eng["last_activity_at"]
    # O que os testes gravam não aparece como atividade real (ambiente 'live').
    live = next(s for s in tower_status(c)["sectors"] if s["sector"] == "engineering")
    assert live["recent_results"] == [] and live["last_activity_at"] is None
    assert operational_metrics(c)["last_30_days"]["finished"] == 0
