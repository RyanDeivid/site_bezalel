# Bezalel API — backend de referência

API **somente leitura** em FastAPI que implementa o mesmo contrato consumido pelo frontend em modo `api` (`src/services/http`). Serve de ponto de partida para o backend real com agentes, banco de dados e tempo real.

> **Não executado em produção ainda.** O frontend publicado no GitHub Pages funciona 100% sem este servidor (modo demonstração). Este diretório fica pronto para quando a VM existir — mesmo padrão do backend de feedback do TWSLink (Oracle Cloud Free Tier, um worker, reverse proxy com TLS).

## O que faz hoje

| Endpoint | Descrição |
|---|---|
| `GET /health` | Saúde do serviço |
| `GET /v1/courses` | Busca + filtros (`q`, `cat`, `price`, `level`, `mode`, `type`, `cert`, `sort`, `page`, `pageSize`) |
| `GET /v1/courses/{slug}` · `/related` | Detalhe (404 se não existir) e relacionados |
| `GET /v1/catalog/facets` | Contagens por categoria, preço, nível… |
| `GET /v1/registry` | Todos os registros (auditoria) |
| `GET /v1/agents` · `/{id}` | Perfis; `mode` reflete o ambiente (`demo` por padrão) |
| `GET /v1/events` · `/v1/events/stream` | Trilha de eventos (vazia: nenhum agente real roda aqui ainda) e canal SSE |
| `GET /v1/skills` · `/v1/insights` | Competências e insights sobre o catálogo real |
| `GET /v1/sources` | Fontes consultadas |
| `POST /v1/assistant` | **501** enquanto não houver provedor de LLM configurado |

Documentação interativa: `http://localhost:8100/docs`.

O que ele **não** faz, de propósito: inventar eventos, simular agentes ou fingir que um modelo de linguagem está conectado.

## Rodar localmente

```bash
cd server
python -m venv .venv
.venv/Scripts/activate        # Windows (PowerShell: .venv\Scripts\Activate.ps1)
source .venv/bin/activate     # Linux/macOS
pip install -r requirements-dev.txt
cp .env.example .env          # ajuste ALLOWED_ORIGINS
uvicorn app.main:app --reload --port 8100
pytest -q
```

Para o frontend usar a API: `VITE_DATA_MODE=api VITE_API_BASE_URL=http://localhost:8100 npm run dev`.

Os dados vêm de `data/catalog.json`, gerado a partir do catálogo curado do frontend:

```bash
npm run export:data   # na raiz do repositório
```

## Deploy na Oracle Cloud (Free Tier)

Duas opções equivalentes; a API escuta só em `127.0.0.1:8100` e o **Caddy** fala HTTPS com o mundo.

**Docker**

```bash
git clone https://github.com/RyanDeivid/site_bezalel.git /opt/bezalel
cd /opt/bezalel/server && cp .env.example .env   # preencher
docker compose up -d --build
```

**systemd**

```bash
sudo useradd --system --home /opt/bezalel bezalel
git clone https://github.com/RyanDeivid/site_bezalel.git /opt/bezalel
cd /opt/bezalel/server && cp .env.example .env
sudo cp deploy/bezalel-api.service /etc/systemd/system/ && sudo systemctl enable --now bezalel-api
./deploy/deploy.sh    # atualizações futuras
```

**TLS**: instale o Caddy, use `deploy/Caddyfile.example` (troque o domínio) e libere as portas 80/443 na *security list* da VCN da Oracle e no firewall da VM.

Depois, no repositório do GitHub, defina as *variables* `VITE_DATA_MODE=api` e `VITE_API_BASE_URL=https://api.seudominio.com` e inclua a origem do Pages em `ALLOWED_ORIGINS`.

## Segurança

- Segredos apenas em `.env` (ignorado pelo Git) ou variáveis do sistema; nunca na imagem nem no frontend.
- CORS restrito às origens configuradas; sem credenciais/cookies.
- Somente leitura: nenhum endpoint altera dados. Escrita futura exigirá autenticação real (ver `docs/SECURITY.md`).
- Rate limit em memória no assistente → mantenha **1 worker** (ou migre para Redis antes de escalar).

## Runtime de agentes (`app/runtime`)

O backend também abriga o núcleo operacional dos funcionários digitais: agentes registrados, tarefas
persistentes (SQLite em `var/`), um worker com recuperação e limites, ferramentas com permissões,
eventos de auditoria, aprovações e avaliações. O primeiro agente real é o **Site Intelligence Agent**,
somente leitura.

```bash
python -m app.runtime.cli enqueue site-intelligence
python -m app.runtime.cli worker --once
python -m app.runtime.cli report <id>
```

As rotas `/v1/runtime/*` exigem token e papel, e ficam fechadas (503) sem `BEZALEL_RUNTIME_TOKENS`. Ver
`docs/AGENT-RUNTIME.md` e `docs/AGENT-OPERATIONS.md`.
