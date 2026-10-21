/**
 * Pós-build para hospedagem estática (GitHub Pages).
 *
 * O GitHub Pages não executa servidor: sem isto, links diretos como
 * /site_bezalel/course/harvard-cs50x devolveriam 404 e robôs veriam sempre
 * o mesmo <title>. Este script, executado após `vite build`:
 *
 *  1. gera dist/<rota>/index.html para cada rota (inclusive cada curso), com
 *     título, descrição, canonical, Open Graph e JSON-LD próprios e o HTML
 *     COMPLETO da página pré-renderizado pelo React (dist-ssr/entry-server.js,
 *     gerado por `vite build --ssr`) — o navegador pinta o conteúdo antes de o
 *     JavaScript chegar, e o React depois hidrata (src/main.tsx). Se uma rota
 *     não puder ser pré-renderizada, cai para um resumo estático;
 *  1b. pré-carrega as fontes da primeira dobra (sem troca tardia de fonte);
 *  2. gera 404.html (SPA fallback com noindex);
 *  3. gera sitemap.xml e robots.txt com URLs absolutas;
 *  4. injeta uma Content-Security-Policy por <meta> com o hash do script
 *     inline de tema (o único script inline do site).
 *
 * Executado com o suporte nativo do Node a TypeScript (type stripping): os
 * módulos importados aqui usam apenas `import type` ou caminhos relativos.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCatalog } from '../src/data/catalog/store.ts';
import { buildCourseJsonLd } from '../src/features/catalog/json-ld.ts';
import { common } from '../src/i18n/pt-BR/common.ts';
import type { Course } from '../src/types/domain.ts';

// O JSON-LD usa os nomes das competências, que vêm com o chunk do catálogo.
const curatedCourses = await loadCatalog();

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

// A base real é a que o Vite usou no build (vite.config.ts): lida do próprio
// index.html gerado. VITE_BASE_PATH só vale se o HTML não indicar outra.
const builtBase = readFileSync(join(dist, 'index.html'), 'utf8').match(/<script[^>]+src="([^"]*?)assets\//)?.[1];
const rawBase = builtBase ?? process.env.VITE_BASE_PATH ?? '/';
const base = rawBase === '/' ? '/' : `/${rawBase.replace(/^\/+|\/+$/g, '')}/`;
const origin = (process.env.VITE_SITE_ORIGIN ?? 'http://localhost:4173').replace(/\/+$/, '');
const apiOrigin = (() => {
  try {
    return process.env.VITE_DATA_MODE === 'api' && process.env.VITE_API_BASE_URL ? new URL(process.env.VITE_API_BASE_URL).origin : '';
  } catch {
    return '';
  }
})();

const meta = common.meta;
const BUILD_DATE = new Date().toISOString().slice(0, 10);

interface PageSpec {
  path: string; // sem base, ex.: "/explore"
  title: string;
  description: string;
  jsonLd?: Record<string, unknown> | null;
  /** Página pessoal (estante, comparação): fora do sitemap e dos buscadores. */
  noindex?: boolean;
  /** HTML estático (seguro) colocado dentro de #root. */
  body: string;
  priority: number;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const absolute = (path: string) => `${origin}${base}${path === '/' ? '' : `${path.replace(/^\/+|\/+$/g, '')}/`}`;
const href = (path: string) => `${base}${path === '/' ? '' : `${path.replace(/^\/+/, '')}/`}`;

function nav(): string {
  const links: Array<[string, string]> = [
    ['/', common.nav.home],
    ['/explore', common.nav.explore],
    ['/insights', common.nav.insights],
    ['/agents', common.nav.agents],
    ['/lab', common.nav.lab],
    ['/assistant', common.nav.assistantLong],
    ['/about', common.nav.about],
    ['/methodology', common.nav.methodology],
  ];
  return `<nav aria-label="${escapeHtml(common.nav.primary)}"><ul>${links.map(([p, l]) => `<li><a href="${href(p)}">${escapeHtml(l)}</a></li>`).join('')}</ul></nav>`;
}

function shell(h1: string, inner: string): string {
  return `<div class="bz-prerender">${nav()}<main><h1>${escapeHtml(h1)}</h1>${inner}</main></div>`;
}

function courseBody(c: Course): string {
  const facts: Array<[string, string]> = [
    ['Instituição', c.provider.name],
    ['Preço', common.enums.priceType[c.priceType]],
    ['Nível', common.enums.level[c.level]],
    ['Certificado', c.certificateType ? common.enums.certificateType[c.certificateType] : common.common.notInformed],
    ['Última conferência', c.lastCheckedAt],
    ['Estado da verificação', common.enums.verificationStatus[c.verificationStatus]],
  ];
  return shell(
    c.title,
    `<p>${escapeHtml(c.description)}</p><dl>${facts.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>` +
      `<p><a href="${escapeHtml(c.sourceUrl)}" rel="noopener noreferrer">${escapeHtml(common.common.viewSource)}</a></p>`,
  );
}

const pages: PageSpec[] = [
  {
    path: '/',
    title: meta.home.title,
    description: meta.home.description,
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Bezalel', url: absolute('/'), inLanguage: 'pt-BR', description: meta.home.description },
    body: shell(meta.home.title, `<p>${escapeHtml(meta.home.description)}</p>`),
    priority: 1,
  },
  {
    path: '/explore',
    title: meta.explore.title,
    description: meta.explore.description,
    body: shell(
      meta.explore.title,
      `<p>${escapeHtml(meta.explore.description)}</p><ul>${curatedCourses
        .map((c) => `<li><a href="${href(`/course/${c.slug}`)}">${escapeHtml(c.title)}</a> — ${escapeHtml(c.provider.name)}</li>`)
        .join('')}</ul>`,
    ),
    priority: 0.9,
  },
  ...(['trail', 'skills', 'saved', 'compare'] as const).map((key) => ({
    path: `/${key}`,
    title: meta[key].title,
    description: meta[key].description,
    body: shell(meta[key].title, `<p>${escapeHtml(meta[key].description)}</p>`),
    priority: 0.8,
    noindex: key === 'saved' || key === 'compare',
  })),
  ...(['insights', 'agents', 'lab', 'universe', 'lion', 'assistant', 'about', 'methodology', 'privacy', 'terms'] as const).map((key) => ({
    path: `/${key}`,
    title: meta[key].title,
    description: meta[key].description,
    body: shell(meta[key].title, `<p>${escapeHtml(meta[key].description)}</p>`),
    priority: key === 'privacy' || key === 'terms' ? 0.3 : 0.7,
  })),
  ...curatedCourses
    .filter((c) => c.publicationStatus === 'published')
    .map((c) => ({
      path: `/course/${c.slug}`,
      title: c.title,
      description: meta.courseDescription(c.title, c.provider.name),
      jsonLd: buildCourseJsonLd(c),
      body: courseBody(c),
      priority: 0.8,
    })),
];

function setTag(html: string, pattern: RegExp, replacement: string): string {
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', `    ${replacement}\n  </head>`);
}

function renderPage(template: string, page: PageSpec, options: { noindex?: boolean; ssr?: string | null } = {}): string {
  const fullTitle = page.path === '/' ? page.title : `${page.title} · ${meta.siteName}`;
  const url = absolute(page.path);
  let html = template;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(fullTitle)}</title>`);
  html = setTag(html, /<meta\s+name="description"[\s\S]*?\/>/, `<meta name="description" content="${escapeHtml(page.description)}" />`);
  html = setTag(html, /<meta property="og:title"[\s\S]*?\/>/, `<meta property="og:title" content="${escapeHtml(fullTitle)}" />`);
  html = setTag(html, /<meta\s+property="og:description"[\s\S]*?\/>/, `<meta property="og:description" content="${escapeHtml(page.description)}" />`);
  html = setTag(html, /<meta property="og:image"[\s\S]*?\/>/, `<meta property="og:image" content="${origin}${base}og-image.png" />`);
  html = setTag(html, /<meta name="robots"[\s\S]*?\/>/, `<meta name="robots" content="${options.noindex ? 'noindex' : 'index, follow'}" />`);
  if (!options.noindex) {
    html = html.replace('</head>', `    <meta property="og:url" content="${url}" />\n    <link rel="canonical" href="${url}" />\n  </head>`);
  }
  if (page.jsonLd) {
    const json = JSON.stringify(page.jsonLd).replace(/</g, '\\u003c');
    html = html.replace('</head>', `    <script type="application/ld+json" id="bz-jsonld">${json}</script>\n  </head>`);
  }
  if (options.ssr) return html.replace('<div id="root"><!--bz:prerender--></div>', () => `<div id="root" data-ssr="1">${options.ssr}</div>`);
  return html.replace('<!--bz:prerender-->', () => page.body);
}

function withCsp(html: string): string {
  // Hash de cada script inline executável (o script de tema). JSON-LD não executa.
  const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${createHash('sha256').update(m[1] ?? '').digest('base64')}'`);
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ''}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
}

/** Fontes usadas na primeira dobra: texto (Geist), rótulos (Geist Mono) e o acento itálico do título. */
const CRITICAL_FONTS = [/^geist-latin-wght-normal-.*\.woff2$/, /^geist-mono-latin-wght-normal-.*\.woff2$/, /^instrument-serif-latin-400-italic-.*\.woff2$/];

async function withFontPreloads(html: string): Promise<string> {
  const files = await readdir(join(dist, 'assets'));
  const links = CRITICAL_FONTS.map((re) => files.find((f) => re.test(f)))
    .filter((f): f is string => Boolean(f))
    .map((f) => `<link rel="preload" href="${base}assets/${f}" as="font" type="font/woff2" crossorigin />`);
  // Catálogo curado: chunk próprio (data/catalog/store.ts), necessário antes
  // da hidratação — baixado em paralelo com o bundle principal.
  const catalog = files.find((f) => /^courses-[\w-]+\.js$/.test(f));
  if (catalog) links.push(`<link rel="modulepreload" crossorigin href="${base}assets/${catalog}" />`);
  return html.replace('<meta name="viewport"', `${links.join('\n    ')}\n    <meta name="viewport"`);
}

/**
 * Service worker (scripts/sw-template.js): pré-guarda o essencial da primeira
 * visita — HTML da home, JS/CSS de entrada, fontes críticas, ícone e manifesto —
 * para visitas seguintes instantâneas e navegação básica sem rede. A versão
 * muda a cada build (hash dos arquivos de entrada), o que descarta o cache antigo.
 */
async function writeServiceWorker(template: string) {
  const refs = [...template.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1] ?? '')
    .filter((u) => u.startsWith(base) && /\.(js|css|woff2|svg|webmanifest)$/.test(u));
  const precache = [...new Set([base, ...refs])];
  const version = createHash('sha256').update(precache.join('|')).digest('hex').slice(0, 12);
  const sw = (await readFile(join(root, 'scripts', 'sw-template.js'), 'utf8'))
    .replace("'__VERSION__'", JSON.stringify(version))
    .replace("'__BASE__'", JSON.stringify(base))
    .replace('__PRECACHE__', JSON.stringify(precache));
  await writeFile(join(dist, 'sw.js'), sw, 'utf8');
  console.log(`postbuild: service worker ${version} · ${precache.length} arquivos pré-guardados`);
}

type SsrRender = (path: string) => Promise<string | null>;

async function loadRenderer(): Promise<SsrRender | null> {
  try {
    const mod = (await import(pathToFileURL(join(root, 'dist-ssr', 'entry-server.js')).href)) as { render: SsrRender };
    return mod.render;
  } catch (err) {
    console.warn('postbuild: pré-renderização indisponível (rode `vite build --ssr`); usando resumos estáticos.', err);
    return null;
  }
}

async function main() {
  const template = await withFontPreloads(withCsp(await readFile(join(dist, 'index.html'), 'utf8')));
  const render = await loadRenderer();
  let rendered = 0;

  for (const page of pages) {
    const file = page.path === '/' ? join(dist, 'index.html') : join(dist, page.path.replace(/^\//, ''), 'index.html');
    await mkdir(dirname(file), { recursive: true });
    let ssr: string | null = null;
    try {
      ssr = render ? await render(href(page.path)) : null;
    } catch (err) {
      console.warn(`postbuild: falha ao pré-renderizar ${page.path}; usando resumo estático.`, err);
    }
    if (ssr) rendered++;
    await writeFile(file, renderPage(template, page, { ssr, noindex: page.noindex }), 'utf8');
  }

  await writeFile(
    join(dist, '404.html'),
    renderPage(template, { path: '/404', title: meta.notFound.title, description: meta.notFound.description, body: '', priority: 0 }, { noindex: true }),
    'utf8',
  );

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .filter((p) => !p.noindex)
    .map((p) => `  <url><loc>${absolute(p.path)}</loc><lastmod>${BUILD_DATE}</lastmod><priority>${p.priority.toFixed(1)}</priority></url>`)
    .join('\n')}\n</urlset>\n`;
  await writeFile(join(dist, 'sitemap.xml'), sitemap, 'utf8');

  // Atenção: robots.txt só é lido na raiz do domínio. Em um site de projeto do
  // GitHub Pages (/site_bezalel/) ele é informativo; ver docs/DEPLOYMENT.md.
  await writeFile(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${origin}${base}sitemap.xml\n`, 'utf8');

  await writeServiceWorker(template);

  // Impede o processamento Jekyll no GitHub Pages (pastas iniciadas por "_" etc.).
  await writeFile(join(dist, '.nojekyll'), '', 'utf8');

  console.log(`postbuild: ${pages.length} páginas geradas (${rendered} pré-renderizadas pelo React) · base "${base}" · origem ${origin}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
