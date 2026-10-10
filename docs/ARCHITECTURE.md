# Arquitetura

## Visão geral

```
┌──────────────────────────── Navegador (site estático) ────────────────────────────┐
│  Páginas (features/*)  →  hooks (useAsync, useEventFeed)  →  useServices()         │
│                                                     │                              │
│                       ┌─────────────────────────────┴───────────────┐              │
│                       │  Services (contratos em services/types.ts)  │              │
│                       ├──────────────────────┬──────────────────────┤              │
│                       │ local (modo demo)    │ http (modo api)      │              │
│                       │ catálogo curado +    │ fetch + guards +     │──── HTTPS ──▶ server/ (FastAPI)
│                       │ simulação de eventos │ EventSource (SSE)    │              │   ou backend próprio/Supabase
│                       └──────────┬───────────┴──────────────────────┘              │
│                                  │                                                  │
│               domain/ (funções puras: busca, pipeline, insights, operações, Sol)    │
│               data/   (catalog = real verificado · demo = fictício rotulado)        │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Princípios:

1. **Componentes não leem dados diretamente.** Toda página usa `useServices()`; a implementação (local ou HTTP) é escolhida em `services/index.ts` por `VITE_DATA_MODE`.
2. **Lógica de domínio é pura e testada** (`src/domain`): busca, validação, deduplicação, máquina de estados, insights, métricas e o motor do Sol não dependem de React.
3. **Dado real e dado de demonstração nunca se misturam**: origem (`curated` / `demo` / `production`) é um campo obrigatório e sempre exibido.
4. **Honestidade sobre o que roda**: o navegador não coleta páginas de terceiros nem finge executar agentes; a simulação é determinística e rotulada.

## Estrutura de pastas

```
src/
  app/            providers (preferências, i18n), roteador
  components/     ui/ (botões, diálogos, toasts…), layout/, brand/, agents/, data/, charts/, visual/
  features/       home, catalog, insights, agents, lab (scene/ = 3D, hud/), assistant, pages
  domain/         catalog/ (busca, filtros na URL), pipeline/ (etapas e contratos), insights, operations, assistant
  services/       types.ts (contratos), local.ts, http/, catalog/, events/
  data/           catalog/ (real, verificado), demo/ (fictício)
  i18n/           pt-BR/ (fonte de verdade), en/ (mesmas chaves, verificado por tipo e teste)
  hooks/ lib/ styles/ types/
scripts/          postbuild.ts, generate-assets.ts, export-data.ts
tests/            unit/ (Vitest), e2e/ (Playwright)
server/           backend de referência (FastAPI) + deploy Oracle Cloud
```

## Decisões técnicas

| Decisão | Motivo |
|---|---|
| **Vite + React + TS estrito** | Preferência do briefing; build estático rápido; tipagem forte do domínio. |
| **TypeScript 6.0 (não 7.0)** | `typescript-eslint` 8.71 só suporta TS < 6.1 — incompatibilidade conhecida verificada antes da instalação. |
| **React Router 8 (data router)** | Rotas com `lazy` para code splitting por página; `basename` = `import.meta.env.BASE_URL` para o subcaminho do Pages. Transições com a View Transitions API (`viewTransition`). |
| **BrowserRouter + HTML pré-gerado por rota** (em vez de HashRouter) | URLs limpas e indexáveis. O pós-build cria `dist/<rota>/index.html` com metadados próprios; o GitHub Pages serve cada um diretamente — sem o truque de redirecionar o 404. |
| **Tailwind CSS 4 com tokens em CSS** | Tokens semânticos em `styles/tokens.css` (`--bg`, `--accent`, `--ok`…), mapeados com `@theme inline`: troca de tema em runtime sem recompilar. |
| **three.js + React Three Fiber, sem drei** | Laboratório declarativo; helpers próprios (texturas em canvas, câmera) evitam dependências e downloads extras de fontes. |
| **Sem pós-processamento (bloom)** | Brilho com materiais emissivos e sprites aditivos: visual de laboratório sem o custo de `@react-three/postprocessing`. |
| **Canvas 2D próprio na home** (rede de partículas e icosaedro projetado à mão) | Experiência visual forte sem baixar three.js na página de entrada. |
| **Recharts só na rota /insights** | Chunk carregado sob demanda. Paleta categórica validada (contraste e daltonismo) com o validador da skill de dataviz; toda visualização tem visão em tabela. |
| **i18n próprio (objetos tipados)** | Português e inglês com garantia estrutural: o tipo `Widen<typeof ptBR>` obriga o inglês a ter as mesmas chaves; um teste compara as formas. Sem dependência extra. |
| **`<dialog>` nativo** para modais e gavetas | Foco preso, Esc e fundo inerte pelo navegador. |
| **Fontes auto-hospedadas** (Geist, Geist Mono, Instrument Serif via Fontsource) | Sem requisições a terceiros (privacidade, CSP mais estrita). |
| **Lucide** | Ícones de interface consistentes; glifos dos agentes e símbolo da marca são SVG próprios. |

## Desempenho

Medido no build de produção (gzip):

| Recurso | Tamanho | Quando carrega |
|---|---|---|
| Bundle inicial (React, roteador, home, serviços, dados) | ~145 kB JS + 15 kB CSS | Sempre |
| `InsightsPage` (Recharts) | ~115 kB | Só em `/insights` |
| `LabScene` (three.js + R3F) | ~248 kB | Só ao escolher o modo 3D |
| Demais páginas | 0,2–9 kB cada | Por rota |

Metas e medidas no código:

- Animações pausam fora da viewport e com a aba oculta; densidade/resolução se ajustam ao dispositivo (`useDeviceProfile`).
- `prefers-reduced-motion` e o botão "Reduzir animações" desligam animações (CSS e canvas); a abertura da marca é omitida.
- No 3D: `dpr` limitado, geometria instanciada (pilares, partículas), sem sombras dinâmicas, detecção de FPS baixo com redução automática de qualidade, fallback 2D em perda de contexto WebGL.
- `useAsync` só mostra esqueleto se a resposta demorar mais de 160 ms (sem "piscar").
- Metas de Core Web Vitals para o lançamento: LCP < 2,5 s, CLS < 0,1, INP < 200 ms (a medir no ambiente publicado com Lighthouse/PageSpeed — não medido neste ambiente).

## Contratos de API (modo `api`)

Implementação de referência: `server/app/main.py`. Cliente: `src/services/http`.

| Operação | Método e caminho | Resposta |
|---|---|---|
| Buscar catálogo | `GET /v1/courses?q&cat&price&level&mode&type&cert&demo&sort&page&pageSize` | `CatalogResult` (`hits[{course,score,matchedFields}]`, `total`, `page`, `pageSize`, `hasMore`) |
| Detalhe | `GET /v1/courses/{slug}` | `Course` · 404 se não existir |
| Relacionados | `GET /v1/courses/{slug}/related?limit` | `Course[]` |
| Facetas | `GET /v1/catalog/facets?demo` | `CatalogFacets` |
| Registro completo | `GET /v1/registry` | `Course[]` (todos os estados) |
| Agentes | `GET /v1/agents`, `GET /v1/agents/{id}` | `Agent[]`, `Agent` |
| Eventos recentes | `GET /v1/events?limit` | `AgentEvent[]` |
| Eventos em tempo real | `GET /v1/events/stream` (SSE) | mensagens `data: <AgentEvent JSON>` |
| Competências / insights | `GET /v1/skills`, `GET /v1/insights?category&period` | `Skill[]`, `InsightsData` |
| Fontes | `GET /v1/sources` | `Source[]` |
| Assistente (LLM no servidor) | `POST /v1/assistant {question, locale}` | `AssistantReply` · 501 sem provedor |

Todas as respostas são validadas no cliente (`services/http/guards.ts`) antes de chegar à interface. Os parâmetros de filtro são os mesmos da URL do catálogo (`domain/catalog/query-params.ts`).

### Supabase (opcional, futuro)

O mesmo contrato pode ser servido por funções do Supabase (Edge Functions) sobre tabelas `courses`, `skills`, `sources`, `agents` e `agent_events`. Requisitos antes de ativar: RLS habilitado com políticas **somente leitura** para `anon` nas visões públicas, escrita apenas por funções com a chave `service_role` no servidor, e Realtime/SSE para `agent_events`. Ver `docs/SECURITY.md`.

## Identidade visual

- **Símbolo**: bloco isométrico de três faces — superior dourada (*Discover*), esquerda em traço com camadas (*Learn*), direita em aço (*Build*) — unidas por um nó central. Referência sutil ao artesão-construtor: a ideia está na geometria, não em iconografia religiosa.
- **Logotipo**: "BEZALEL" em Geist, caixa alta, espaçamento 0,32em.
- **Paleta**: navy `#101B2B`, aço `#263B54`, ouro `#C7A86A`, marfim `#F2E8D5`, com tokens semânticos para claro/escuro e estados (ok, aviso, erro, info, demo — o "demo" tem hachura própria).
- **Tipografia**: Geist (interface), Geist Mono (dados e rótulos técnicos), Instrument Serif itálico (acentos expressivos).
- **Movimento**: abertura da marca, rede de partículas com pulsos de informação, núcleo geométrico, fluxos luminosos em SVG, revelação ao rolar, contadores, estados de pipeline animados, microinterações — tudo respeitando movimento reduzido.
