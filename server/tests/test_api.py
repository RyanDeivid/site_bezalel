from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["courses"] == 19


def test_list_courses_contract():
    data = client.get("/v1/courses").json()
    assert data["total"] == 19
    assert data["page"] == 1 and data["pageSize"] == 12
    assert len(data["hits"]) == 12 and data["hasMore"] is True
    assert {"course", "score", "matchedFields"} <= set(data["hits"][0])


def test_search_ignores_accents_and_requires_all_terms():
    a = client.get("/v1/courses", params={"q": "proteção de dados"}).json()["total"]
    b = client.get("/v1/courses", params={"q": "PROTECAO DE DADOS"}).json()["total"]
    assert a == b and a > 0
    assert client.get("/v1/courses", params={"q": "linux zzzinexistente"}).json()["total"] == 0


def test_filters_restrict_results():
    data = client.get("/v1/courses", params={"price": "free", "pageSize": 60}).json()
    assert data["total"] > 0
    assert all(h["course"]["priceType"] == "free" for h in data["hits"])
    certs = client.get("/v1/courses", params={"type": "certification", "pageSize": 60}).json()
    assert all(h["course"]["type"] == "certification" for h in certs["hits"])


def test_course_detail_and_404():
    assert client.get("/v1/courses/harvard-cs50x").json()["title"].startswith("CS50")
    assert client.get("/v1/courses/nao-existe").status_code == 404


def test_related_excludes_itself():
    rel = client.get("/v1/courses/harvard-cs50x/related").json()
    assert rel and all(c["slug"] != "harvard-cs50x" for c in rel)


def test_facets():
    f = client.get("/v1/catalog/facets").json()
    assert f["total"] == 19 and f["providers"] > 5


def test_agents_are_never_presented_as_production_by_default():
    agents = client.get("/v1/agents").json()
    assert len(agents) == 5
    assert all(a["mode"] == "demo" for a in agents)


def test_events_are_empty_until_real_agents_exist():
    assert client.get("/v1/events").json() == []


def test_insights_keep_indicators_separate():
    data = client.get("/v1/insights").json()
    assert data["jobs"] == {"available": False}
    assert data["mentions"]["points"] == []
    python = next(s for s in data["skills"] if s["skillId"] == "python")
    assert python["courseCount"] >= 1


def test_assistant_without_llm_is_honest():
    res = client.post("/v1/assistant", json={"question": "cursos de python", "locale": "pt-BR"})
    assert res.status_code == 501


def test_assistant_validates_input():
    assert client.post("/v1/assistant", json={"question": "", "locale": "pt-BR"}).status_code == 422
    assert client.post("/v1/assistant", json={"question": "x", "locale": "fr"}).status_code == 422


def test_cors_allows_only_configured_origins():
    ok = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    blocked = client.get("/health", headers={"Origin": "https://malicioso.example"})
    assert "access-control-allow-origin" not in blocked.headers
