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
| **Pré-renderização completa (SSG) + hidratação** (v2 · Fase 0) | `src/entry-server.tsx` é compilado com `vite build --ssr`; o pós-build renderiza cada rota com `createStaticHandler`/`StaticRouterProvider` e grava o HTML completo dentro de `#root` (`data-ssr="1"`). O navegador pinta o conteúdo antes do JavaScript; `main.tsx` carrega as rotas preguiçosas da URL atual e chama `hydrateRoot`. Hidrata só quando a página bate com o HTML (sem filtros na URL, idioma e movimento padrão); senão renderiza do zero por cima. Divergências ficam em `window.__bzRecoverableErrors`, e os testes de navegador exigem zero. |
| **Dados locais legíveis no primeiro render** (`lib/sync-promise.ts`) | No modo demonstração os serviços devolvem promessas já resolvidas e marcadas; o `useAsync` lê o valor na hora. Resultado: HTML pré-gerado com os dados reais (não esqueletos), hidratação sem troca de conteúdo e CLS zero. No modo API nada muda (a requisição começa no efeito). |
| **Tailwind CSS 4 com tokens em CSS** | Tokens semânticos em `styles/tokens.css` (`--bg`, `--accent`, `--ok`…), mapeados com `@theme inline`: troca de tema em runtime sem recompilar. |
| **three.js + React Three Fiber, sem drei** | Laboratório declarativo; helpers próprios (texturas em canvas, câmera) evitam dependências e downloads extras de fontes. |
| **Sem pós-processamento (bloom)** — revisada na v2 | Na v1, brilho só com materiais emissivos e sprites aditivos. Na v2 o bloom foi aprovado **apenas em aparelhos fortes** (Fase 3 — laboratório), em meia resolução, desligado em celular e em qualidade reduzida. |
| **Canvas 2D próprio na home** (rede de partículas e icosaedro projetado à mão) | Experiência visual forte sem baixar three.js na página de entrada. Na v2 a rede de partículas roda num **Web Worker com OffscreenCanvas** (`components/visual/particles/`), com traços agrupados por opacidade e 30 fps em celular; sem suporte, o mesmo motor roda na página. |
| **Animações decorativas só no compositor** (v2 · Fase 0) | Medido num celular médio simulado (CPU 4× mais lenta), traços SVG com `stroke-dashoffset` e SMIL ocupavam ~98% da thread principal mesmo com a página parada. Regra: efeito contínuo usa só `transform`/`opacity` em elementos HTML; SVG fica estático. `useAnimationGate` pausa CSS e SMIL fora da tela e respeita "reduzir movimento" (o SMIL ignorava). |
| **Sem `backdrop-filter` em telas de toque nem sobre canvas animado** | O desfoque é refeito a cada quadro de rolagem; em `pointer: coarse` as superfícies ficam quase opacas. |
| **Recharts só na rota /insights** | Chunk carregado sob demanda. Paleta categórica validada (contraste e daltonismo) com o validador da skill de dataviz; toda visualização tem visão em tabela. |
| **i18n próprio (objetos tipados)** | Português e inglês com garantia estrutural: o tipo `Widen<typeof ptBR>` obriga o inglês a ter as mesmas chaves; um teste compara as formas. Sem dependência extra. |
| **`<dialog>` nativo** para modais e gavetas | Foco preso, Esc e fundo inerte pelo navegador. |
| **Fontes auto-hospedadas** (Geist, Geist Mono, Instrument Serif via Fontsource) | Sem requisições a terceiros (privacidade, CSP mais estrita). |
| **Lucide** | Ícones de interface consistentes; glifos dos agentes e símbolo da marca são SVG próprios. |

## Desempenho

### Medição (v2 · Fase 0, 11/10/2026)

Mesmas condições para antes e depois: build servido localmente com gzip (como o GitHub Pages), Lighthouse 12 em modo celular (mediana de 3 rodadas) e traço da thread principal com CPU 4× mais lenta em viewport de celular. Scripts de medição: `npm run serve:dist`, `npm run lighthouse`, `npm run check:budget`.

| Métrica | v1.0 | v2 · Fase 0 |
|---|---|---|
| Lighthouse Performance — home | 64–70 | **83–92** |
| Total Blocking Time — home | 971–1573 ms | **175–444 ms** |
| CLS — página de curso | 0,564 | **0** |
| Thread principal com a home parada no topo | 81–98% | **6–9%** |
| Thread principal com seções do meio da home na tela | ~98% | **1–21%** (validação: 40% enquanto visível) |
| Tarefas longas ao rolar a home | 27–57 | **13** |

### Orçamento (CI — `scripts/check-budget.ts`)

| Recurso (gzip) | Teto | Hoje |
|---|---|---|
| HTML da home (pré-renderizado) | 40 kB | ~19 kB |
| CSS de entrada | 20 kB | ~16 kB |
| JS de entrada da home | 195 kB | ~185 kB |
| `LabScene` (sob demanda) | 300 kB | ~240 kB |
| `InsightsPage` (sob demanda) | 130 kB | ~111 kB |

### Técnicas em uso

- **SSG + hidratação em etapas**: cada seção abaixo da dobra é um `<Suspense>`; o React hidrata o topo primeiro e as seções em tarefas separadas.
- **`content-visibility: auto`** nas seções abaixo da dobra (`.bz-defer`): estilo, layout e pintura adiados até a seção se aproximar da tela.
- **Revelação ao rolar sem esconder o HTML**: só o que está abaixo da tela após a hidratação é recolhido (classificação por IntersectionObserver, sem `getBoundingClientRect`, para não forçar layout de seções adiadas); a camada da GPU é liberada ao fim da transição.
- **Fontes da primeira dobra pré-carregadas** (`<link rel="preload">` gerado no pós-build).
- **Simulação de eventos começa ociosa** na home (`requestIdleCallback`); tokens da busca são calculados uma vez por curso.
- **Service worker** (`scripts/sw-template.js`): rede primeiro para páginas, cache primeiro para `/assets/` (imutáveis); páginas vistas funcionam sem rede.
- Animações pausam fora da viewport e com a aba oculta; `prefers-reduced-motion` e o botão "Reduzir animações" desligam CSS, canvas e SMIL; a abertura da marca (só CSS, já no HTML) é omitida.
- No 3D: `dpr` limitado, geometria instanciada, sem sombras dinâmicas, detecção de FPS baixo com redução automática de qualidade, fallback 2D em perda de contexto WebGL.
- Metas: LCP < 2,5 s, CLS < 0,1, INP < 200 ms — verificadas no CI pelo Lighthouse (acessibilidade e CLS bloqueiam; desempenho avisa, pela variação da máquina do CI).

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
