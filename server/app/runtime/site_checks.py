"""Verificações do site sobre o build (somente leitura, sem rede).

Cada verificação devolve um ``CheckResult`` com o estado (passed, failed, not_run, error), as evidências e
os achados. Um achado sempre traz evidência observável (arquivo, página, trecho); nada de pontuação
inventada. Conteúdo das páginas é dado, nunca instrução: nada do que está no HTML é executado ou seguido.
"""

from __future__ import annotations

import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Callable
from urllib.parse import unquote, urlparse

Severity = str  # 'critical' | 'high' | 'medium' | 'low' | 'info'


@dataclass
class Finding:
    check: str
    kind: str
    severity: Severity
    confidence: str  # 'high' | 'medium' | 'low'
    impact: str
    title: str
    evidence: list[str]
    recommendation: str
    pages: list[str] = field(default_factory=list)

    def key(self) -> str:
        return f"{self.check}:{self.kind}:{','.join(sorted(self.pages))}"


@dataclass
class CheckResult:
    id: str
    title: str
    status: str  # 'passed' | 'failed' | 'not_run' | 'error'
    duration_ms: int = 0
    evidence: list[str] = field(default_factory=list)
    findings: list[Finding] = field(default_factory=list)
    reason: str | None = None  # por que não rodou / deu erro


# ---- Leitura do build -----------------------------------------------------------------------------


class _Page(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.lang: str | None = None
        self.title = ""
        self._in_title = False
        self.meta: dict[str, str] = {}
        self.canonical: str | None = None
        self.links: list[str] = []
        self.imgs: list[dict[str, str | None]] = []
        self.h1 = 0
        self.buttons_without_name = 0
        self._button_depth = 0
        self._button_text = ""
        self._button_label = False
        self.anchors_without_name = 0
        self._a_depth = 0
        self._a_text = ""
        self._a_label = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k: (v or "") for k, v in attrs}
        if tag == "html":
            self.lang = a.get("lang") or None
        elif tag == "title":
            self._in_title = True
        elif tag == "meta":
            key = a.get("name") or a.get("property")
            if key:
                self.meta[key.lower()] = a.get("content", "")
        elif tag == "link" and "canonical" in a.get("rel", "").split():
            self.canonical = a.get("href")
        elif tag == "a":
            if a.get("href"):
                self.links.append(a["href"])
            self._a_depth += 1
            self._a_text = ""
            self._a_label = bool(a.get("aria-label") or a.get("title") or a.get("aria-labelledby"))
        elif tag == "img":
            self.imgs.append({"src": a.get("src"), "alt": a.get("alt") if "alt" in a else None, "hidden": a.get("aria-hidden")})
            if self._a_depth and (a.get("alt") or ""):
                self._a_text += "img"
        elif tag == "h1":
            self.h1 += 1
        elif tag == "button":
            self._button_depth += 1
            self._button_text = ""
            self._button_label = bool(a.get("aria-label") or a.get("title") or a.get("aria-labelledby"))
        elif tag == "svg" and (self._button_depth or self._a_depth) and a.get("aria-label"):
            self._button_text += "svg"
            self._a_text += "svg"

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        elif tag == "button" and self._button_depth:
            self._button_depth -= 1
            if not self._button_label and not self._button_text.strip():
                self.buttons_without_name += 1
        elif tag == "a" and self._a_depth:
            self._a_depth -= 1
            if not self._a_label and not self._a_text.strip():
                self.anchors_without_name += 1

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        if self._button_depth:
            self._button_text += data
        if self._a_depth:
            self._a_text += data


@dataclass
class Site:
    root: Path
    base_path: str
    pages: dict[str, _Page]  # rota (ex.: '/explore/') -> página
    page_files: dict[str, Path]

    def route_of(self, file: Path) -> str:
        rel = file.relative_to(self.root).as_posix()
        if rel == "index.html":
            return "/"
        if rel.endswith("/index.html"):
            return "/" + rel[: -len("index.html")]
        return "/" + rel


def load_site(root: Path, base_path: str, max_pages: int) -> Site:
    pages: dict[str, _Page] = {}
    files: dict[str, Path] = {}
    site = Site(root=root, base_path=base_path, pages=pages, page_files=files)
    html_files = sorted(p for p in root.rglob("*.html") if "assets" not in p.relative_to(root).parts)
    for f in html_files[:max_pages]:
        route = site.route_of(f)
        p = _Page()
        try:
            p.feed(f.read_text(encoding="utf-8", errors="replace"))
        except Exception:  # HTML malformado: a página entra sem metadados (e vira achado)
            pass
        pages[route] = p
        files[route] = f
    return site


def _timed(fn: Callable[[], CheckResult]) -> CheckResult:
    t = time.perf_counter()
    try:
        r = fn()
    except Exception as e:  # a verificação não pôde terminar: é "error", não "failed"
        r = CheckResult(id=getattr(fn, "check_id", "unknown"), title=getattr(fn, "check_title", "?"), status="error", reason=f"{type(e).__name__}: {e}"[:300])
    r.duration_ms = int((time.perf_counter() - t) * 1000)
    return r


def _sample(items: list[str], n: int = 8) -> list[str]:
    return items[:n] + ([f"… e mais {len(items) - n}"] if len(items) > n else [])


# ---- Verificações ---------------------------------------------------------------------------------


def check_build_artifacts(root: Path, src_root: Path | None) -> CheckResult:
    r = CheckResult(id="build.artifacts", title="Artefatos do build", status="passed")
    if not root.is_dir():
        r.status, r.reason = "not_run", f"diretório do build não existe ({root.name}/): rode o build antes"
        return r
    index = root / "index.html"
    assets = list((root / "assets").glob("*")) if (root / "assets").is_dir() else []
    total = sum(p.stat().st_size for p in assets)
    r.evidence += [f"index.html: {'presente' if index.exists() else 'ausente'}", f"assets/: {len(assets)} arquivos, {total / 1024:.0f} KiB (sem compressão)"]
    if not index.exists():
        r.status = "failed"
        r.findings.append(Finding("build.artifacts", "missing-index", "critical", "high", "O site não abre na raiz", "index.html ausente no build", [f"{root.name}/index.html não encontrado"], "Refazer o build e conferir o passo de pré-renderização (scripts/postbuild.ts)."))
    built_at = index.stat().st_mtime if index.exists() else 0
    r.evidence.append(f"build gerado em {time.strftime('%Y-%m-%d %H:%M', time.localtime(built_at))}" if built_at else "sem data de build")
    if src_root and src_root.is_dir() and built_at:
        newest = max((p.stat().st_mtime for p in src_root.rglob("*") if p.is_file()), default=0)
        if newest > built_at + 1:
            r.findings.append(Finding("build.artifacts", "stale-build", "medium", "high", "O relatório pode não refletir o código atual", "Build mais antigo que o código-fonte", [f"arquivo mais novo em src/: {time.strftime('%Y-%m-%d %H:%M', time.localtime(newest))}"], "Refazer o build antes de confiar nas demais verificações."))
    return r


def check_pages_meta(site: Site) -> CheckResult:
    r = CheckResult(id="site.pages_meta", title="Títulos, descrições, canonical e idioma", status="passed")
    pages = {k: v for k, v in site.pages.items() if k != "/404.html"}
    r.evidence.append(f"{len(pages)} páginas HTML lidas")
    missing_title = [k for k, p in pages.items() if not p.title.strip()]
    long_title = [f"{k} ({len(p.title.strip())} caracteres)" for k, p in pages.items() if len(p.title.strip()) > 70]
    missing_desc = [k for k, p in pages.items() if not p.meta.get("description", "").strip()]
    bad_desc = [f"{k} ({len(p.meta['description'])} caracteres)" for k, p in pages.items() if p.meta.get("description") and not 50 <= len(p.meta["description"]) <= 170]
    # Página com noindex (ex.: as pessoais, como "salvos") fica fora do índice de propósito: não se
    # exige canonical dela (falso positivo encontrado na revisão do primeiro relatório real).
    missing_canon = [k for k, p in pages.items() if not p.canonical and "noindex" not in p.meta.get("robots", "")]
    missing_lang = [k for k, p in pages.items() if not p.lang]
    noindex = [k for k, p in pages.items() if "noindex" in p.meta.get("robots", "")]
    hosts = sorted({urlparse(p.canonical).netloc for p in pages.values() if p.canonical})
    wrong_canon = []
    for k, p in pages.items():
        if p.canonical:
            path = urlparse(p.canonical).path
            expected = site.base_path.rstrip("/") + k
            if path.rstrip("/") != expected.rstrip("/"):
                wrong_canon.append(f"{k} → {p.canonical}")
    titles: dict[str, list[str]] = {}
    for k, p in pages.items():
        titles.setdefault(p.title.strip(), []).append(k)
    dup_titles = [f"“{t}”: {len(v)} páginas" for t, v in titles.items() if t and len(v) > 1]
    r.evidence.append(f"domínios nos canonical: {', '.join(hosts) or 'nenhum'}")

    def add(items: list[str], kind: str, sev: str, conf: str, impact: str, title: str, rec: str) -> None:
        if items:
            r.findings.append(Finding(r.id, kind, sev, conf, impact, f"{title} ({len(items)})", _sample(items), rec, pages=[i.split(" ")[0] for i in items]))

    add(missing_title, "missing-title", "high", "high", "Página sem título nos resultados de busca e na aba", "Páginas sem <title>", "Definir o título em useDocumentMeta da página.")
    add(missing_desc, "missing-description", "medium", "high", "O buscador escolhe um trecho qualquer como descrição", "Páginas sem meta description", "Definir a descrição em useDocumentMeta.")
    add(bad_desc, "description-length", "low", "medium", "Descrição cortada ou curta demais nos resultados", "Descrições fora de 50–170 caracteres", "Ajustar o texto (referência usual, não regra do buscador).")
    add(long_title, "title-length", "low", "medium", "Título cortado nos resultados", "Títulos com mais de 70 caracteres", "Encurtar o título.")
    add(missing_canon, "missing-canonical", "medium", "high", "Risco de páginas duplicadas no índice", "Páginas sem link canonical", "Emitir o canonical no pré-render.")
    add(wrong_canon, "canonical-mismatch", "medium", "high", "Canonical apontando para outra página", "Canonical diferente da rota da página", "Conferir a montagem do canonical com a base do site.")
    add(missing_lang, "missing-lang", "medium", "high", "Leitores de tela e buscadores sem o idioma", "Páginas sem <html lang>", "Definir o atributo lang.")
    add(noindex, "noindex", "info", "high", "Página fora do índice (pode ser intencional)", "Páginas com robots noindex", "Confirmar se é intencional.")
    add(dup_titles, "duplicate-title", "low", "high", "Resultados de busca indistinguíveis", "Títulos repetidos em várias páginas", "Dar a cada página um título próprio.")
    if any(h.startswith(("localhost", "127.0.0.1")) for h in hosts):
        r.findings.append(Finding(r.id, "local-origin", "info", "high", "Este é um build local: em produção os endereços são outros", "Canonical aponta para localhost", [f"domínios: {', '.join(hosts)}"], "Analisar o build de produção (npm run build:pages) para conferir os endereços públicos."))
    if any(f.severity in ("critical", "high", "medium") for f in r.findings):
        r.status = "failed"
    return r


def check_sitemap_robots(site: Site) -> CheckResult:
    r = CheckResult(id="site.sitemap_robots", title="sitemap.xml e robots.txt", status="passed")
    robots = site.root / "robots.txt"
    sitemap = site.root / "sitemap.xml"
    if not robots.exists():
        r.findings.append(Finding(r.id, "missing-robots", "medium", "high", "Buscadores sem as regras de rastreamento e sem o endereço do sitemap", "robots.txt ausente", ["robots.txt não encontrado no build"], "Gerar robots.txt no pós-build."))
    else:
        text = robots.read_text(encoding="utf-8", errors="replace")
        r.evidence.append("robots.txt: " + " | ".join(line.strip() for line in text.splitlines() if line.strip())[:300])
        if re.search(r"^\s*Disallow:\s*/\s*$", text, re.M | re.I):
            r.findings.append(Finding(r.id, "robots-disallow-all", "critical", "high", "O site inteiro fica fora dos buscadores", "robots.txt bloqueia tudo", ["Disallow: /"], "Remover o bloqueio total."))
        if "sitemap:" not in text.lower():
            r.findings.append(Finding(r.id, "robots-no-sitemap", "low", "high", "O buscador não descobre o sitemap pelo robots", "robots.txt sem a linha Sitemap", ["sem 'Sitemap:'"], "Acrescentar a linha Sitemap."))
    if not sitemap.exists():
        r.findings.append(Finding(r.id, "missing-sitemap", "medium", "high", "Descoberta de páginas mais lenta", "sitemap.xml ausente", ["sitemap.xml não encontrado"], "Gerar o sitemap no pós-build."))
    else:
        try:
            tree = ET.parse(sitemap)
        except ET.ParseError as e:
            r.findings.append(Finding(r.id, "sitemap-invalid", "high", "high", "O buscador descarta o sitemap", "sitemap.xml inválido", [str(e)[:200]], "Corrigir a geração do XML."))
            tree = None
        if tree is not None:
            ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            locs = [e.text or "" for e in tree.getroot().findall("s:url/s:loc", ns)]
            r.evidence.append(f"sitemap.xml: {len(locs)} URLs")
            listed = set()
            missing_files = []
            for loc in locs:
                path = unquote(urlparse(loc).path)
                if not path.startswith(site.base_path):
                    missing_files.append(f"{loc} (fora da base {site.base_path})")
                    continue
                route = "/" + path[len(site.base_path):]
                listed.add(route if route.endswith("/") or route.endswith(".html") else route + "/")
                if (route if route.endswith((".html", "/")) else route + "/") not in site.pages:
                    missing_files.append(f"{loc}")
            if missing_files:
                r.findings.append(Finding(r.id, "sitemap-dead-url", "high", "high", "O sitemap anuncia páginas que não existem", f"URLs do sitemap sem página no build ({len(missing_files)})", _sample(missing_files), "Gerar o sitemap a partir das páginas pré-renderizadas.", pages=missing_files))
            # Fora do sitemap de propósito: a 404 e as páginas com noindex.
            unlisted = [k for k, pg in site.pages.items() if k not in listed and k != "/404.html" and "noindex" not in pg.meta.get("robots", "")]
            if unlisted:
                r.findings.append(Finding(r.id, "sitemap-missing-page", "low", "medium", "Páginas que o buscador pode demorar a descobrir (algumas podem ser intencionais)", f"Páginas fora do sitemap ({len(unlisted)})", _sample(unlisted), "Conferir se devem entrar no sitemap.", pages=unlisted))
            hosts = sorted({urlparse(l).netloc for l in locs})
            r.evidence.append(f"domínios no sitemap: {', '.join(hosts)}")
    if any(f.severity in ("critical", "high", "medium") for f in r.findings):
        r.status = "failed"
    return r


def check_internal_links(site: Site) -> CheckResult:
    r = CheckResult(id="site.internal_links", title="Links internos", status="passed")
    broken: dict[str, list[str]] = {}
    external: set[str] = set()
    checked = 0
    for route, page in site.pages.items():
        for href in page.links:
            u = urlparse(href)
            if u.scheme in ("mailto", "tel", "javascript") or href.startswith("#"):
                continue
            if u.scheme in ("http", "https") and u.netloc and not u.netloc.startswith(("localhost", "127.0.0.1")):
                external.add(u.netloc)
                continue
            path = unquote(u.path)
            if not path:
                continue
            if not path.startswith("/"):
                path = site.base_path.rstrip("/") + route.rsplit("/", 1)[0] + "/" + path
            # "/site_bezalel" (sem a barra) é a raiz: o servidor redireciona para "/site_bezalel/"
            # (falso positivo encontrado na revisão do primeiro relatório real).
            if path == site.base_path.rstrip("/"):
                path = site.base_path
            if not path.startswith(site.base_path):
                broken.setdefault(href, []).append(route)
                continue
            checked += 1
            rel = path[len(site.base_path):]
            target = site.root / rel
            ok = target.is_file() or (target / "index.html").is_file() or Path(str(target) + ".html").is_file()
            if not ok:
                broken.setdefault(href, []).append(route)
    r.evidence.append(f"{checked} links internos conferidos em {len(site.pages)} páginas")
    r.evidence.append(f"{len(external)} domínios externos (não acessados: rede externa não autorizada nesta etapa)")
    if broken:
        items = [f"{href} (em {', '.join(sorted(set(src))[:3])})" for href, src in sorted(broken.items())]
        r.findings.append(Finding(r.id, "broken-internal-link", "high", "high", "Visitante cai numa página inexistente", f"Links internos sem destino no build ({len(broken)})", _sample(items), "Corrigir o destino ou criar a página.", pages=sorted({s for v in broken.values() for s in v})))
        r.status = "failed"
    return r


def check_a11y_static(site: Site) -> CheckResult:
    r = CheckResult(id="site.a11y_static", title="Acessibilidade no HTML estático", status="passed")
    no_alt = []
    no_h1 = []
    many_h1 = []
    unnamed_buttons = []
    unnamed_links = []
    for route, p in site.pages.items():
        if route == "/404.html":
            continue
        for img in p.imgs:
            if img["alt"] is None and img["hidden"] != "true":
                no_alt.append(f"{route}: {img['src']}")
        if p.h1 == 0:
            no_h1.append(route)
        elif p.h1 > 1:
            many_h1.append(f"{route} ({p.h1})")
        if p.buttons_without_name:
            unnamed_buttons.append(f"{route} ({p.buttons_without_name})")
        if p.anchors_without_name:
            unnamed_links.append(f"{route} ({p.anchors_without_name})")
    r.evidence.append("Só o HTML pré-renderizado: o que a página monta depois no navegador não entra (a auditoria axe do CI cobre isso).")

    def add(items: list[str], kind: str, sev: str, conf: str, impact: str, title: str, rec: str) -> None:
        if items:
            r.findings.append(Finding(r.id, kind, sev, conf, impact, f"{title} ({len(items)})", _sample(items), rec, pages=[i.split(":")[0].split(" ")[0] for i in items]))

    add(no_alt, "img-no-alt", "medium", "high", "Leitor de tela não descreve a imagem", "Imagens sem atributo alt", "Dar alt (vazio se for decorativa).")
    add(no_h1, "no-h1", "low", "medium", "Página sem título principal para quem navega por cabeçalhos", "Páginas sem <h1> no HTML pré-renderizado", "Conferir se o h1 só aparece depois do carregamento.")
    add(many_h1, "many-h1", "low", "medium", "Estrutura de cabeçalhos confusa", "Páginas com mais de um <h1>", "Manter um h1 por página.")
    add(unnamed_buttons, "button-no-name", "medium", "medium", "Botão sem nome para leitores de tela", "Botões sem texto nem aria-label", "Dar texto ou aria-label.")
    add(unnamed_links, "link-no-name", "medium", "medium", "Link sem nome para leitores de tela", "Links sem texto nem aria-label", "Dar texto ou aria-label.")
    if any(f.severity in ("critical", "high", "medium") for f in r.findings):
        r.status = "failed"
    return r


def timed(fn: Callable[[], CheckResult], check_id: str, title: str) -> CheckResult:
    setattr(fn, "check_id", check_id)
    setattr(fn, "check_title", title)
    return _timed(fn)


def finding_dict(f: Finding) -> dict[str, Any]:
    return {"check": f.check, "kind": f.kind, "severity": f.severity, "confidence": f.confidence, "impact": f.impact, "title": f.title, "evidence": f.evidence, "recommendation": f.recommendation, "pages": f.pages[:50]}


def result_dict(r: CheckResult) -> dict[str, Any]:
    return {"id": r.id, "title": r.title, "status": r.status, "duration_ms": r.duration_ms, "evidence": r.evidence, "reason": r.reason, "findings": len(r.findings)}

