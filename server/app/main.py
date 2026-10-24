"""Bezalel API — backend de referência (somente leitura).

Implementa o contrato consumido por ``src/services/http`` no frontend
(docs/ARCHITECTURE.md › Contratos de API). Nesta versão:

* serve o catálogo curado exportado por ``npm run export:data``;
* NÃO executa agentes: ``/v1/events`` fica vazio até que agentes reais
  (contratos em ``src/domain/pipeline/contracts.ts``) sejam implementados;
* o assistente com LLM responde 501 enquanto não houver provedor
  configurado — a chave de IA, quando existir, fica SÓ neste servidor.

Mesma linha do backend de feedback do TWSLink: FastAPI, um worker,
atrás de um reverse proxy com TLS (deploy/), segredos só via ambiente.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import unicodedata
from collections import defaultdict, deque
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

DATA_FILE = Path(os.environ.get("BEZALEL_DATA_FILE", Path(__file__).resolve().parent.parent / "data" / "catalog.json"))
# Origens do frontend autorizadas (ex.: https://ryandeivid.github.io). Nunca "*" em produção.
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:4173").split(",") if o.strip()]
ENVIRONMENT_MODE = "production" if os.environ.get("BEZALEL_ENV") == "production" else "demo"

ASSISTANT_RATE_LIMIT = 20  # perguntas…
ASSISTANT_RATE_WINDOW = 60 * 60  # …por hora, por IP (estado em memória → manter 1 worker)

STOPWORDS = {
    "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "para", "por", "com", "um", "uma",
    "the", "of", "and", "to", "in", "for", "with", "an", "on", "curso", "cursos", "course", "courses",
}


def load_data() -> dict[str, Any]:
    with DATA_FILE.open(encoding="utf-8") as fh:
        return json.load(fh)


DATA = load_data()
COURSES: list[dict[str, Any]] = DATA["courses"]
SKILLS: list[dict[str, Any]] = DATA["skills"]
SKILL_NAMES = {s["id"]: [s["name"]["pt-BR"], s["name"]["en"]] for s in SKILLS}
SKILL_CATEGORY = {s["id"]: s["category"] for s in SKILLS}


def normalize(text: str) -> str:
    folded = unicodedata.normalize("NFD", text)
    folded = "".join(ch for ch in folded if unicodedata.category(ch) != "Mn").lower()
    return " ".join("".join(ch if ch.isalnum() or ch in "+#." else " " for ch in folded).split())


def tokenize(text: str) -> list[str]:
    return [t.strip(".-") for t in normalize(text).split() if len(t.strip(".-")) > 1 and t not in STOPWORDS]


FIELD_WEIGHTS = {"title": 6, "skills": 4, "provider": 3, "topics": 2, "description": 1}


def course_tokens(course: dict[str, Any]) -> dict[str, list[str]]:
    skills = " ".join([s.replace("-", " ") + " " + " ".join(SKILL_NAMES.get(s, [])) for s in course["skills"]])
    return {
        "title": tokenize(course["title"]),
        "skills": tokenize(skills),
        "provider": tokenize(course["provider"]["name"] + " " + course.get("contentAuthor", "")),
        "topics": tokenize(" ".join(course.get("topics", []))),
        "description": tokenize(course["description"]),
    }


def term_matches(term: str, tokens: list[str]) -> bool:
    if len(term) >= 3:
        return any(t.startswith(term) or (len(t) >= 4 and term.startswith(t)) for t in tokens)
    return term in tokens


def score(course: dict[str, Any], terms: list[str]) -> tuple[int, list[str]] | None:
    if not terms:
        return 0, []
    tokens = course_tokens(course)
    total, matched = 0, set()
    for term in terms:
        best = 0
        for field, weight in FIELD_WEIGHTS.items():
            if term_matches(term, tokens[field]):
                best = max(best, weight)
                matched.add(field)
        if best == 0:
            return None
        total += best
    return total, sorted(matched)


def split_param(value: str | None) -> list[str]:
    return [v for v in (value or "").split(",") if v]


def visible(course: dict[str, Any]) -> bool:
    return course.get("publicationStatus") in {"published", "outdated"}


app = FastAPI(title="Bezalel API", version="1.0.0", docs_url="/docs", redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Accept", "Authorization"],
)


# Runtime de agentes (docs/AGENT-RUNTIME.md): rotas próprias, todas com token e papel.
from .runtime.api import router as runtime_router  # noqa: E402

app.include_router(runtime_router)


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "courses": len(COURSES), "environmentMode": ENVIRONMENT_MODE}


@app.get("/v1/courses")
def list_courses(
    q: str = Query("", max_length=120),
    cat: str | None = None,
    price: str | None = None,
    level: str | None = None,
    mode: str | None = None,
    type: str | None = None,  # noqa: A002 — nome do parâmetro faz parte do contrato
    cert: str | None = None,
    sort: str = "relevance",
    page: int = Query(1, ge=1, le=100),
    pageSize: int = Query(12, ge=1, le=60),  # noqa: N803
) -> dict[str, Any]:
    terms = tokenize(q)
    filters = {"category": split_param(cat), "priceType": split_param(price), "level": split_param(level), "modality": split_param(mode), "type": split_param(type)}
    hits = []
    for course in COURSES:
        if not visible(course):
            continue
        if any(values and course.get(field) not in values for field, values in filters.items()):
            continue
        if cert == "1" and course.get("certificateType") in (None, "none-stated"):
            continue
        result = score(course, terms)
        if result is None:
            continue
        hits.append({"course": course, "score": result[0], "matchedFields": result[1]})

    if sort == "title":
        hits.sort(key=lambda h: h["course"]["title"].lower())
    elif sort == "updated":
        hits.sort(key=lambda h: (h["course"]["lastCheckedAt"], h["course"]["title"]), reverse=True)
    else:
        hits.sort(key=lambda h: (-h["score"], h["course"]["verificationStatus"] != "verified", h["course"]["title"].lower()))

    shown = hits[: page * pageSize]
    return {"hits": shown, "total": len(hits), "page": page, "pageSize": pageSize, "hasMore": len(shown) < len(hits)}


def find_course(slug: str) -> dict[str, Any] | None:
    return next((c for c in COURSES if c["slug"] == slug), None)


@app.get("/v1/courses/{slug}")
def get_course(slug: str) -> dict[str, Any]:
    course = find_course(slug)
    if course is None:
        raise HTTPException(status_code=404, detail="Oportunidade não encontrada")
    return course


@app.get("/v1/courses/{slug}/related")
def related(slug: str, limit: int = Query(3, ge=1, le=12)) -> list[dict[str, Any]]:
    base = find_course(slug)
    if base is None:
        raise HTTPException(status_code=404, detail="Oportunidade não encontrada")
    scored = []
    for c in COURSES:
        if c["id"] == base["id"] or c.get("publicationStatus") != "published":
            continue
        s = 2 * len(set(c["skills"]) & set(base["skills"])) + (3 if c["category"] == base["category"] else 0)
        if s > 0:
            scored.append((s, c))
    scored.sort(key=lambda x: (-x[0], x[1]["title"]))
    return [c for _, c in scored[:limit]]


def count_by(items: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    counts: dict[str, int] = defaultdict(int)
    for item in items:
        counts[item[key]] += 1
    return sorted(({"value": k, "count": v} for k, v in counts.items()), key=lambda x: -x["count"])


@app.get("/v1/catalog/facets")
def facets() -> dict[str, Any]:
    pool = [c for c in COURSES if visible(c)]
    return {
        "categories": count_by(pool, "category"),
        "priceTypes": count_by(pool, "priceType"),
        "levels": count_by(pool, "level"),
        "modalities": count_by(pool, "modality"),
        "types": count_by(pool, "type"),
        "providers": len({c["provider"]["name"] for c in pool}),
        "total": len(pool),
        "withCertificate": sum(1 for c in pool if c.get("certificateType") not in (None, "none-stated")),
        "lastCheckedAt": max((c["lastCheckedAt"] for c in pool), default=None),
    }


@app.get("/v1/registry")
def registry() -> list[dict[str, Any]]:
    return COURSES


@app.get("/v1/agents")
def agents() -> list[dict[str, Any]]:
    # Sem agentes executando neste servidor: o modo reflete o ambiente real.
    return [{**a, "mode": ENVIRONMENT_MODE, "status": "offline" if ENVIRONMENT_MODE == "production" else a["status"]} for a in DATA["agents"]]


@app.get("/v1/agents/{agent_id}")
def agent(agent_id: str) -> dict[str, Any]:
    found = next((a for a in agents() if a["id"] == agent_id), None)
    if found is None:
        raise HTTPException(status_code=404, detail="Agente não encontrado")
    return found


@app.get("/v1/events")
def events(limit: int = Query(120, ge=1, le=500)) -> list[dict[str, Any]]:
    # Trilha de eventos real ainda não existe: nada é inventado aqui.
    _ = limit
    return []


@app.get("/v1/events/stream")
async def events_stream(request: Request) -> StreamingResponse:
    """Canal SSE. Hoje só envia comentários de keep-alive; agentes reais publicarão eventos aqui."""

    async def gen():
        while not await request.is_disconnected():
            yield ": keep-alive\n\n"
            await asyncio.sleep(15)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/v1/skills")
def skills() -> list[dict[str, Any]]:
    published = [c for c in COURSES if c.get("publicationStatus") == "published"]
    return [
        {
            **s,
            "relatedCourseIds": [c["id"] for c in published if s["id"] in c["skills"]],
            "evidenceSources": [{"kind": "catalog", "label": "Catálogo curado Bezalel", "origin": "curated"}],
        }
        for s in SKILLS
    ]


@app.get("/v1/insights")
def insights(category: str | None = None) -> dict[str, Any]:
    pool = [c for c in COURSES if c.get("publicationStatus") == "published" and (not category or c["category"] == category)]
    per_skill: dict[str, dict[str, Any]] = {}
    for c in pool:
        for sid in c["skills"]:
            entry = per_skill.setdefault(sid, {"skillId": sid, "category": SKILL_CATEGORY.get(sid, c["category"]), "courseCount": 0, "freeCourseCount": 0, "courseIds": [], "providers": []})
            entry["courseCount"] += 1
            entry["freeCourseCount"] += 1 if c["priceType"] == "free" else 0
            entry["courseIds"].append(c["id"])
            if c["provider"]["name"] not in entry["providers"]:
                entry["providers"].append(c["provider"]["name"])
    cats: dict[str, dict[str, Any]] = {}
    for c in pool:
        e = cats.setdefault(c["category"], {"category": c["category"], "courseCount": 0, "skills": set()})
        e["courseCount"] += 1
        e["skills"].update(c["skills"])
    dates = sorted(c["lastCheckedAt"] for c in pool)
    return {
        "skills": sorted(per_skill.values(), key=lambda s: (-s["courseCount"], s["skillId"])),
        "categories": [{"category": k, "courseCount": v["courseCount"], "skillCount": len(v["skills"])} for k, v in sorted(cats.items(), key=lambda kv: -kv[1]["courseCount"])],
        "pairs": [],
        "price": count_by(pool, "priceType"),
        "levels": count_by(pool, "level"),
        # Sem coleta de menções no servidor: a série fica vazia (nunca inventada).
        "mentions": {"periods": [], "skills": [], "points": [], "origin": "demo"},
        "jobs": {"available": False},
        "totalCourses": len(pool),
        "periodChecked": {"from": dates[0] if dates else None, "to": dates[-1] if dates else None},
    }


@app.get("/v1/sources")
def sources() -> list[dict[str, Any]]:
    return DATA["sources"]


class AssistantQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    locale: str = Field(default="pt-BR", pattern=r"^(pt-BR|en)$")


_assistant_log: dict[str, deque[float]] = defaultdict(deque)


def check_rate_limit(key: str) -> None:
    now = time.monotonic()
    log = _assistant_log[key]
    while log and now - log[0] > ASSISTANT_RATE_WINDOW:
        log.popleft()
    if len(log) >= ASSISTANT_RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Limite de perguntas atingido. Tente mais tarde.")
    log.append(now)


@app.post("/v1/assistant")
def assistant(body: AssistantQuestion, request: Request) -> dict[str, Any]:
    check_rate_limit(request.client.host if request.client else "unknown")
    if not os.environ.get("LLM_API_KEY"):
        # Honestidade: sem provedor configurado, não simulamos um modelo de linguagem.
        raise HTTPException(status_code=501, detail="Assistente com modelo de linguagem não configurado neste servidor.")
    # Ponto de integração: chamar o provedor de LLM aqui, com o catálogo como
    # contexto (RAG) e a mesma política de transparência do motor local.
    raise HTTPException(status_code=501, detail="Integração com LLM ainda não implementada.")
