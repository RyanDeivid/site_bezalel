# Publicação

## GitHub Pages (padrão, sem custo)

### Configuração única

1. Repositório `RyanDeivid/site_bezalel` → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. (Opcional) **Settings → Environments → github-pages**: restringir a publicação à branch `main`.

### Publicar

Cada push na `main` dispara [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):

1. `npm ci` e `npm test`;
2. `actions/configure-pages` informa `base_path` (ex.: `/site_bezalel`) e `origin` (`https://ryandeivid.github.io`);
3. `npm run build` com `VITE_BASE_PATH` e `VITE_SITE_ORIGIN` vindos desse passo;
4. upload de `dist/` e `actions/deploy-pages`.

Também pode ser disparado manualmente em **Actions → Deploy — GitHub Pages → Run workflow**.

Endereço esperado: `https://ryandeivid.github.io/site_bezalel/`.

O workflow [`ci.yml`](../.github/workflows/ci.yml) roda em push e pull request: tipos, lint, testes, build em subcaminho, Playwright (Chromium) e testes do backend.

### Base URL

| Cenário | `VITE_BASE_PATH` |
|---|---|
| Site de projeto do GitHub Pages | `/site_bezalel/` (automático no workflow) |
| Domínio próprio ou `usuario.github.io` | `/` (o `configure-pages` devolve base vazia) |
| Desenvolvimento local | `/` (padrão) |

O valor alimenta o `base` do Vite (assets), o `basename` do roteador e as URLs absolutas do pós-build. Para testar localmente exatamente como no Pages:

```bash
npm run build:pages
npm run preview:pages      # http://localhost:4173/site_bezalel/
```

Se o repositório for renomeado, o deploy continua correto (a base vem do GitHub); ajuste apenas `build:pages`/`preview:pages` no `package.json` e `playwright.config.ts`, usados localmente e no CI.

### Domínio próprio (opcional)

1. **Settings → Pages → Custom domain** e DNS (CNAME para `ryandeivid.github.io`).
2. A base passa a ser `/` automaticamente; marque **Enforce HTTPS**.

## O que o pós-build gera (`scripts/postbuild.ts`)

- `dist/<rota>/index.html` para as 10 rotas e para cada um dos 105 cursos, com `<title>`, descrição, Open Graph, canonical e JSON-LD próprios, além de um resumo estático em `#root` (para robôs e navegação sem JavaScript);
- `404.html` com `noindex` (o roteador da SPA mostra a página 404);
- `sitemap.xml` com URLs absolutas e `robots.txt`;
- `.nojekyll`;
- uma `Content-Security-Policy` via `<meta>` com o hash SHA-256 do único script inline (tema).

## Limitações de SEO da hospedagem estática

- **Conteúdo renderizado no cliente**: o HTML pré-gerado traz metadados e um resumo; o restante da página é montado pelo React. Robôs modernos executam JavaScript, mas indexação de conteúdo dinâmico pode ser mais lenta.
- **`robots.txt` em subcaminho é ignorado** pelos buscadores (só vale na raiz do domínio). Em `ryandeivid.github.io/site_bezalel/`, envie o sitemap pelo Google Search Console. Com domínio próprio, o arquivo passa a valer.
- **Cabeçalhos HTTP não configuráveis** no GitHub Pages: CSP vai por `<meta>` (sem `frame-ancestors`), e não há HSTS próprio nem compressão Brotli customizada.
- **Página 404 com status 404** para rotas inexistentes (correto), mas rotas dinâmicas novas exigem novo build para ganhar HTML próprio.
- **Idioma**: o HTML estático é em português; a versão em inglês é aplicada no cliente (sem URLs separadas por idioma).

## Backend (opcional)

O site não precisa de backend. Para ativar a API de referência numa VM da Oracle Cloud, siga [`server/README.md`](../server/README.md) e depois defina, em **Settings → Secrets and variables → Actions → Variables**:

- `VITE_DATA_MODE` = `api`
- `VITE_API_BASE_URL` = `https://api.seudominio.com`

(São *variables*, não *secrets*: os valores vão para o JavaScript público.)
