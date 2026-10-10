/**
 * Pós-build para hospedagem estática (GitHub Pages).
 *
 * O GitHub Pages não executa servidor: sem isto, links diretos como
 * /site_bezalel/course/harvard-cs50x devolveriam 404 e robôs veriam sempre
 * o mesmo <title>. Este script, executado após `vite build`:
 *
 *  1. gera dist/<rota>/index.html para cada rota (inclusive cada curso), com
 *     título, descrição, canonical, Open Graph e JSON-LD próprios, e um
 *     resumo estático do conteúdo dentro de #root (substituído pelo React);
 *  2. gera 404.html (SPA fallback com noindex);
 *  3. gera sitemap.xml e robots.txt com URLs absolutas;
 *  4. injeta uma Content-Security-Policy por <meta> com o hash do script
 *     inline de tema (o único script inline do site).
 *
 * Executado com o suporte nativo do Node a TypeScript (type stripping): os
 * módulos importados aqui usam apenas `import type` ou caminhos relativos.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { curatedCourses } from '../src/data/catalog/courses.ts';
import { buildCourseJsonLd } from '../src/features/catalog/json-ld.ts';
import { common } from '../src/i18n/pt-BR/common.ts';
import type { Course } from '../src/types/domain.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const rawBase = process.env.VITE_BASE_PATH ?? '/';
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
  ...(['insights', 'agents', 'lab', 'assistant', 'about', 'methodology', 'privacy', 'terms'] as const).map((key) => ({
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

function renderPage(template: string, page: PageSpec, options: { noindex?: boolean } = {}): string {
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
  return html.replace('<!--bz:prerender-->', page.body);
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

async function main() {
  const template = withCsp(await readFile(join(dist, 'index.html'), 'utf8'));

  for (const page of pages) {
    const file = page.path === '/' ? join(dist, 'index.html') : join(dist, page.path.replace(/^\//, ''), 'index.html');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, renderPage(template, page), 'utf8');
  }

  await writeFile(
    join(dist, '404.html'),
    renderPage(template, { path: '/404', title: meta.notFound.title, description: meta.notFound.description, body: '', priority: 0 }, { noindex: true }),
    'utf8',
  );

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((p) => `  <url><loc>${absolute(p.path)}</loc><lastmod>${BUILD_DATE}</lastmod><priority>${p.priority.toFixed(1)}</priority></url>`)
    .join('\n')}\n</urlset>\n`;
  await writeFile(join(dist, 'sitemap.xml'), sitemap, 'utf8');

  // Atenção: robots.txt só é lido na raiz do domínio. Em um site de projeto do
  // GitHub Pages (/site_bezalel/) ele é informativo; ver docs/DEPLOYMENT.md.
  await writeFile(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${origin}${base}sitemap.xml\n`, 'utf8');

  // Impede o processamento Jekyll no GitHub Pages (pastas iniciadas por "_" etc.).
  await writeFile(join(dist, '.nojekyll'), '', 'utf8');

  console.log(`postbuild: ${pages.length} páginas pré-geradas · base "${base}" · origem ${origin}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
