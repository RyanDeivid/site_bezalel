# Bezalel

**Discover. Learn. Build.**

Plataforma de inteligência educacional que conecta pessoas a cursos, certificações e competências — com cada informação ligada à sua fonte oficial, ao estado de verificação e à data da última conferência. Agentes de IA especializados (Scout, Verifier, Atlas, Trend e Sol) descobrem, validam e organizam oportunidades, e um laboratório 3D torna esse trabalho visível.

> **Versão 1.0 — modo demonstração.** O catálogo traz **105 cursos e certificações reais em 21 áreas** (saúde, educação física, nutrição, saúde mental, educação, idiomas, negócios, finanças, carreira, design, marketing, engenharia, meio ambiente, gestão pública e tecnologia), conferidos manualmente nas páginas oficiais em 10 e 11/10/2026. Os agentes, seus eventos e a série temporal de menções são **simulados localmente** e sempre rotulados como tal. Nenhum agente autônomo está em produção.

## Principais rotas

| Rota | Conteúdo |
|---|---|
| `/` | A Forja (abertura em 3D conduzida pela rolagem, personalizável pelos interesses), busca, destaques, áreas agrupadas em 7 temas, competências, agentes, prévia do laboratório, indicadores e validação |
| `/explore` | Catálogo com busca, filtros (categoria, preço, nível, modalidade, tipo, certificado), ordenação, "carregar mais" e visualização rápida |
| `/course/:slug` | Detalhe com fonte oficial, estado de verificação, "Não informado" para campos ausentes e relacionados |
| `/insights` | Competências por número de cursos, categorias, grafo competência→curso, série temporal **demonstrativa** e painel de vagas indisponível |
| `/agents` | Perfis, estados ao vivo (ativo/ocioso/com falha/demo), fluxo entre agentes e trilha de eventos |
| `/lab` | Laboratório 3D explorável (WASD/setas, clique, toque) com Central de Operações, e versão 2D completa |
| `/assistant` | Assistente Sol com regras locais transparentes |
| `/about` | "A origem": a história de Bezalel construída pelo visitante com uma manivela (7 voltas, 7 capítulos), missão e compromissos |
| `/methodology`, `/privacy`, `/terms` | Institucional (privacidade e termos são rascunhos preliminares) |

## Stack

Vite 8.3 · React 19.3 · TypeScript 6.0 (strict) · React Router 8.4 · Tailwind CSS 4.3 · three.js 0.186 + React Three Fiber 9.8 · Recharts 3.10 · Lucide · Vitest 5 + Testing Library · Playwright 1.64 · GitHub Actions. Backend de referência opcional em FastAPI (`server/`).

Por que essas escolhas: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Começando

Requisitos: **Node.js ≥ 22.22** (recomendado 24, ver `.nvmrc`) e npm.

```bash
npm ci
npm run dev            # http://localhost:5173
```

Nenhuma credencial é necessária: o modo demonstração é 100% local.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run typecheck` | Verificação de tipos (TypeScript estrito) |
| `npm run lint` | ESLint (inclui regras do React Compiler) |
| `npm test` | Testes unitários e de componentes (Vitest + jsdom) |
| `npm run build` | Build de produção + pré-renderização de cada rota (HTML completo, hidratado pelo React), sitemap, robots, 404, CSP e service worker |
| `npm run build:pages` | Build com a base do GitHub Pages (`/site_bezalel/`) |
| `npm run preview:pages` | Serve o build em `http://localhost:4173/site_bezalel/` |
| `npm run test:e2e` | Testes de navegador (Playwright) contra o build em subdiretório |
| `npm run check:budget` | Orçamento de tamanho (gzip) da primeira carga — falha se estourar |
| `npm run serve:dist` | Serve `dist/` em `/site_bezalel/` com gzip, como o GitHub Pages |
| `npm run lighthouse` | Lighthouse CI em modo celular (home, catálogo e um curso) |
| `npm run check` | typecheck + lint + testes + build |
| `npm run assets` | Regera ícones PNG e a imagem Open Graph |
| `npm run export:data` | Exporta o catálogo para o backend (`server/data/catalog.json`) |

Os testes de navegador usam o **Edge instalado** por padrão (`PW_CHANNEL=msedge`), sem baixar navegadores. Para usar o Chromium do Playwright: `npx playwright install chromium` e `PW_CHANNEL=chromium npm run test:e2e`.

## Publicação no GitHub Pages

1. No repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions** (uma única vez).
2. Faça push na `main`. O workflow [`deploy.yml`](.github/workflows/deploy.yml) testa, gera o build com a base correta e publica.
3. Endereço padrão: `https://ryandeivid.github.io/site_bezalel/`.

Detalhes, base URL, domínio próprio e limitações de SEO: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## O que é real e o que é demonstração

| Real | Demonstração (sempre rotulada) |
|---|---|
| 105 cursos/certificações verificados na fonte | Atividade dos agentes e eventos da Central de Operações |
| Busca, filtros, detalhes, relacionados | Registros fictícios do pipeline (domínios `example.org`) |
| Insights sobre o catálogo verificado | Série temporal de menções |
| Assistente com regras locais | Estados "ativo/ocioso/com falha" derivados da simulação |
| Pipeline de validação (código real, testado) | — |

## Documentação

- [Arquitetura e decisões](docs/ARCHITECTURE.md)
- [Modelo de dados](docs/DATA_MODEL.md)
- [Agentes e pipeline](docs/AGENTS.md)
- [Publicação](docs/DEPLOYMENT.md)
- [Roadmap](docs/ROADMAP.md)
- [Segurança](docs/SECURITY.md)
- [Contribuição](docs/CONTRIBUTING.md)
- [Backend de referência](server/README.md)

## Licença

**Decisão pendente.** Nenhuma licença foi escolhida ainda; até lá, todos os direitos são reservados ao titular do projeto. O conteúdo dos cursos listados pertence às respectivas instituições.
