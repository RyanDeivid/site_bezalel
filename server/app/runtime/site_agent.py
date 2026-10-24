"""Site Intelligence Agent: o primeiro funcionário digital real do Bezalel (somente leitura).

O plano é fixo e delimitado (não é o modelo que decide quais comandos rodar): ler o build, conferir as
páginas, o sitemap e o robots, os links internos e a acessibilidade estática; opcionalmente rodar
verificações do projeto da lista fixa; opcionalmente pedir um resumo a um modelo. Tudo vira um
relatório estruturado com evidências, prioridades e limitações.
"""

from __future__ import annotations

import time
from typing import Any

from . import site_checks as sc
from .agents import SiteIntelligenceInput
from .llm import ModelError, ModelUnavailable
from .store import iso, utcnow
from .tools import BudgetExceeded, Cancelled, ToolContext, ToolNotAllowed, call_tool

SEVERITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
CONFIDENCE_RANK = {"high": 0, "medium": 1, "low": 2}

SITE_STEPS = ["site.build_artifacts", "site.pages_meta", "site.sitemap_robots", "site.internal_links", "site.a11y_static"]


def run_site_intelligence(ctx: ToolContext, inp: SiteIntelligenceInput) -> dict[str, Any]:
    started = utcnow()
    t0 = time.perf_counter()
    site_args = {"target": inp.target, "base_path": inp.base_path, "max_pages": inp.max_pages}
    results: list[sc.CheckResult] = []
    for name in SITE_STEPS:
        results.append(call_tool(ctx, name, site_args))
    for script in inp.project_checks:
        results.append(call_tool(ctx, "project.run_check", {"script": script}))

    findings = [f for r in results for f in r.findings]
    findings.sort(key=lambda f: (SEVERITY_RANK[f.severity], CONFIDENCE_RANK[f.confidence], f.check, f.kind))
    fdicts = [sc.finding_dict(f) for f in findings]
    checks = [sc.result_dict(r) for r in results]

    limitations = [
        "Lê o build do site (HTML pré-renderizado, sitemap, robots); o que a página monta depois no navegador não entra.",
        "Sem acesso à rede: links externos, tempo de resposta do servidor publicado e posição em buscadores não foram medidos.",
        "Sem dados de tráfego, conversão ou ranking: nenhuma métrica desse tipo aparece no relatório.",
    ]
    if any(f.kind == "local-origin" for f in findings):
        limitations.insert(0, "O build analisado é local (endereços em localhost): canonical e sitemap de produção não foram conferidos.")
    skipped = [s for s in ("typecheck", "lint", "test", "check:models", "check:budget") if s not in inp.project_checks]
    if skipped:
        limitations.append(f"Verificações do projeto não pedidas nesta tarefa: {', '.join(skipped)}.")
    not_run = [r for r in results if r.status in ("not_run", "error")]
    for r in not_run:
        limitations.append(f"{r.title}: {'não rodou' if r.status == 'not_run' else 'erro'} — {r.reason}")

    report: dict[str, Any] = {
        "schema": "site-intelligence-report/1",
        "task_id": ctx.task_id,
        "execution_id": ctx.execution_id,
        "agent": {"id": ctx.agent.id, "version": ctx.agent.version},
        "started_at": iso(started),
        "target": {"dir": inp.target, "base_path": inp.base_path},
        "checks": checks,
        "findings": fdicts,
        "recommendations": recommendations(findings),
        "limitations": limitations,
        "summary": {
            "checks": {s: sum(1 for c in checks if c["status"] == s) for s in ("passed", "failed", "not_run", "error")},
            "findings": {s: sum(1 for f in fdicts if f["severity"] == s) for s in SEVERITY_RANK},
        },
    }

    # Resumo em texto por modelo: opcional; sem provedor, fica registrado que não rodou (nada simulado).
    if inp.summarize:
        try:
            out = call_tool(ctx, "model.summarize", {"findings": fdicts[:60], "checks": checks})
            report["model_summary"] = {"status": "done", "text": out["text"], "model": out["model"], "note": "Texto gerado por modelo a partir do relatório acima; os achados e evidências não dependem dele."}
        except (ModelUnavailable, BudgetExceeded, ModelError, ToolNotAllowed) as e:
            report["model_summary"] = {"status": "not_run", "reason": str(e)}
    else:
        report["model_summary"] = {"status": "not_requested"}

    if ctx.should_stop():
        raise Cancelled()
    report["finished_at"] = iso(utcnow())
    report["duration_ms"] = int((time.perf_counter() - t0) * 1000)
    report["usage"] = ctx.usage.as_dict()
    return report


def recommendations(findings: list[sc.Finding], limit: int = 10) -> list[dict[str, Any]]:
    """Um item por achado relevante, na ordem de gravidade e confiança (sem achado, sem recomendação)."""
    out = []
    for i, f in enumerate([f for f in findings if f.severity != "info"][:limit], start=1):
        out.append({"priority": i, "severity": f.severity, "confidence": f.confidence, "title": f.title, "why": f.impact, "action": f.recommendation, "finding": f"{f.check}:{f.kind}"})
    return out
