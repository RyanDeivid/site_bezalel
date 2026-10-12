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
| **Canvas 2D próprio** (rede de partículas; usada nas aberturas de páginas internas e no 404) | Experiência visual leve sem three.js. Na v1 também havia um icosaedro projetado à mão no hero, substituído pela Forja na Fase 1. Na v2 a rede de partículas roda num **Web Worker com OffscreenCanvas** (`components/visual/particles/`), com traços agrupados por opacidade e 30 fps em celular; sem suporte, o mesmo motor roda na página. |
| **Animações decorativas só no compositor** (v2 · Fase 0) | Medido num celular médio simulado (CPU 4× mais lenta), traços SVG com `stroke-dashoffset` e SMIL ocupavam ~98% da thread principal mesmo com a página parada. Regra: efeito contínuo usa só `transform`/`opacity` em elementos HTML; SVG fica estático. `useAnimationGate` pausa CSS e SMIL fora da tela e respeita "reduzir movimento" (o SMIL ignorava). |
| **A Forja: three.js puro na home** (v2 · Fase 1) | A abertura da home é uma construção em 3D dirigida pela rolagem (`features/home/forja/`): faísca → partículas por área chegando → triagem com braços robóticos (aprovadas viram estrutura, reprovadas caem) → arestas e o grafo real curso↔competência → placas encaixando até a pose exata do símbolo da marca → mergulho no núcleo. Sem React/R3F na cena (controle fino do laço de renderização); partículas movidas só por shader. O palco fica preso à tela (`position: sticky` num trilho que é **elemento**, não padding — sticky só prende na área de conteúdo do pai) e o hero rola por cima. |
| **Dois modos da Forja, decididos antes da pintura** | O script do `index.html` grava `data-forja="full"` (3D com rolagem conduzida) ou deixa o padrão — história em cartões — para sem JavaScript, movimento reduzido, economia de dados ou aparelho fraco. A marcação pré-renderizada é a mesma nos dois; só o CSS muda, então não há salto de layout nem divergência de hidratação. |
| **3D só quando vale a pena** | Ocioso: só pré-carrega o módulo. A cena é montada na primeira interação; no primeiro ato ela "dorme" (pôster em CSS). Em repouso o desktop segue a 20–24 quadros/s e o celular congela no último quadro. Sem placa de vídeo (WebGL por software, ex.: SwiftShader/llvmpipe) a cena não roda — fica o pôster e o texto dos atos. Braços desenhados por instâncias (11 chamadas de desenho em vez de 56) e shaders compilados em paralelo na montagem (`compileAsync`), para não travar a estreia de cada ato. |
| **A origem: manivela em vez de rolagem** (v2 · Fase 2b) | Na página Sobre a dinâmica é outra: o visitante constrói com a mão. `features/about/origem/`: `crank.ts` (física pura e testada — ângulo acumulado, volante, encaixe por capítulo na direção do gesto, cliques da catraca), `formations.ts` (as 8 folhas da planta: alvos das partículas, traços na ordem do desenho e rótulos; o Tabernáculo em isométrica com as medidas do texto), `blueprint.ts` (canvas 2D carregado perto da tela; as mesmas partículas viajam de folha em folha; um preenchimento por cor) e `OrigemSection.tsx` (engrenagens em SVG giradas só por `transform`, `role="slider"`). Os textos ficam em `content.ts`, no chunk da página — fora do i18n global, que vai no JS inicial. Sem JS, a história é uma lista; com movimento reduzido, a planta pula de capítulo pronto em capítulo pronto. Em tela de toque a planta congela parada e usa menos partículas. |
| **Catálogo num chunk próprio** (v2 · Fase 2) | Cursos (`courses.ts` + `expansion/`) e definições de competências (`skills.ts`) ficam num chunk separado, pré-carregado com `<link rel="modulepreload">` em toda página e aguardado (`loadCatalog()`) antes do primeiro render, da pré-renderização e dos testes. O resto do app lê por acessores síncronos (`curated()`, `skills()`, `skillName()`); nada no bundle principal importa esses arquivos — senão o Rollup os puxaria de volta para o JS inicial. Assim o catálogo pode crescer sem pesar no primeiro carregamento. |
| **21 áreas em 7 temas** (v2 · Fase 2) | Com 21 áreas, toda escolha é feita primeiro por tema (lei de Hick): a home mostra 7 cartões com as áreas dentro, os filtros e o seletor de Insights agrupam por tema, e a Forja oferece os 7 temas como interesses. A ordem das áreas segue os temas, então áreas de um mesmo tema recebem cores vizinhas na cena. |
| **Robôs feitos em código** | `robot-arm.ts`: braço industrial (base, torre, ombro, braço, cotovelo, antebraço, punho, garra) com cinemática inversa analítica de dois segmentos (testada pela cinemática direta). Reaproveitado no laboratório (Fase 3), na esteira do Verifier. |
| **Campus do laboratório em funções puras** (v2 · Fase 3) | `features/lab/layout.ts` é a única fonte de posições para a cena 3D, a planta 2D e o minimapa: raio 16 → 28 m (~3× a área), seis setores a 17 m da Central (o Vigia ao lado do Verifier, para quem devolve os vencidos), entrada ao sul, anel de circulação a 10,6 m. Colisão por círculos de equipamento (console, máquina, monitores) com passadas repetidas para empurrões em cadeia. As rotas dos carregadores (`routePath`, `travelPath`) vão do balcão à doca, pelo anel no sentido mais curto, e são testadas contra todos os equipamentos. `deliveryFor` diz que entrega cada evento representa (descoberta: Scout → Verifier; publicado: Verifier → Central; vencido: Vigia → Verifier…). |
| **Humanoides articulados por instâncias** (v2 · Fase 3) | `scene/robots/humanoid.ts`: quadril, tronco, cabeça com visor, pernas (quadril/joelho/tornozelo), braços (ombro/cotovelo/punho) e mãos com três dedos e polegar — a pose sai de poucos números (passada, carga, digitação, olhar). Como os braços da Forja, cada robô é só um esqueleto; a frota inteira (6 operadores + 6 carregadores, 3 em qualidade reduzida) é desenhada com uma malha instanciada por tipo de peça (~16 chamadas de desenho). |
| **PBR e bloom no laboratório** (v2 · Fase 3) | Reflexos por um mapa de ambiente pré-filtrado (PMREM) gerado uma vez de uma sala procedural (`RoomEnvironment`) — nada de imagem baixada. O bloom (`scene/post/`) só monta em aparelho forte, com qualidade alta e efeitos ligados; o módulo de pós-processamento é um chunk à parte, baixado nessa hora. As telas dos setores são canvas redesenhados só quando o conteúdo serializado muda (o relógio do feed recria as métricas a cada segundo). |
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

### Medição da Fase 1 (Forja), 11/10/2026

Mesmas condições (servidor gzip local, CPU 4× mais lenta em viewport de celular para os traços; Lighthouse celular, mediana de 3).

| Métrica (home) | Fase 0 | Fase 1 |
|---|---|---|
| Lighthouse Performance | 85–93 | 90–92 |
| Total Blocking Time | 72–368 ms | 160–221 ms |
| CLS | 0 | 0 |
| Thread principal no topo, parada | 3–6% | 7% |
| Thread principal rolando | 81% · 13 tarefas longas | 84% · 17 tarefas longas |
| Parada no meio da história (celular) | — | 5–22% (cena congelada) |
| Parada no meio da história (desktop) | — | 7–8% (ambiente a 24 quadros/s) |

### Medição da Fase 2 (catálogo de 19 → 105 cursos), 11/10/2026

Mesmas condições, mediana de 3 rodadas, comparação pareada com a `main` anterior.

| Métrica | Home antes | Home Fase 2 | /explore antes | /explore Fase 2 |
|---|---|---|---|---|
| Lighthouse Performance | 87 | 88 | 87 | 89 |
| LCP | 3,10 s | 3,02 s | 3,27 s | 3,26 s |
| Total Blocking Time | 253 ms | 236 ms | 256 ms | 158 ms |
| CLS / Acessibilidade | 0 / 100 | 0 / 100 | 0 / 100 | 0 / 100 |

O catálogo 5,5× maior não pesou: cursos e competências saíram do JS inicial (185 kB, antes 182 kB com 7 áreas) para o chunk pré-carregado.

### Medição da Fase 2b (A origem), 11/10/2026

Pareada com a `main` anterior (servidor gzip local, mediana de 3). Custo da thread principal medido por `Performance.getMetrics` com a seção na tela, no capítulo IV.

| Métrica | Antes | Fase 2b |
|---|---|---|
| Lighthouse /about/ (celular) | 91 | 92 |
| CLS /about/ · acessibilidade | 0 · 100 | 0 · 100 |
| Thread principal parada, celular (CPU 4×) | — | 0% (planta congelada) |
| Thread principal girando, celular (CPU 4×) | — | 45% |
| Thread principal parada, desktop | — | 2% (tremeluzir a 24 quadros/s) |
| JS inicial | 185,3 kB | 185,3 kB |

### Orçamento (CI — `scripts/check-budget.ts`)

| Recurso (gzip) | Teto | Hoje |
|---|---|---|
| HTML da home (pré-renderizado) | 40 kB | ~24 kB |
| CSS de entrada | 20 kB | ~17 kB |
| JS de entrada da home | 195 kB | ~185 kB |
| Catálogo (cursos + competências, chunk pré-carregado) | 120 kB | ~28 kB (105 cursos, 104 competências) |
| three.js (sob demanda, compartilhado: Forja + laboratório; achado pelo conteúdo — o chunk leva o nome de quem o Rollup juntar a ele, hoje `robot-arm`) | 200 kB | ~183 kB |
| `scene` — Forja (sob demanda, na 1ª interação) | 30 kB | ~13 kB |
| `LabScene` (sob demanda, além do three; Fase 3: campus, setores e robôs) | 100 kB | ~66 kB |
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
