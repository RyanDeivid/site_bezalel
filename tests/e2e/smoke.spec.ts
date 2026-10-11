import { expect, test, type Page } from '@playwright/test';

/**
 * Testes de navegador contra o build de produção servido em /site_bezalel/
 * (mesmo cenário do GitHub Pages): deep links, assets, console, filtros,
 * laboratório (2D e 3D) e responsividade.
 */

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().includes('/site_bezalel/assets/')) errors.push(`${res.status()} ${res.url()}`);
  });
  return errors;
}

const ROUTES: Array<[string, RegExp]> = [
  ['', /Inteligência para descobrir o que vale aprender/],
  ['explore/', /Explore oportunidades/],
  ['course/harvard-cs50x/', /CS50's Introduction to Computer Science/],
  ['insights/', /Competências observadas/],
  ['agents/', /Agentes especializados/],
  ['lab/', /O laboratório dos agentes/],
  ['assistant/', /^Sol$/],
  ['about/', /Conhecimento só se completa/],
  ['methodology/', /Como cada informação chega/],
  ['privacy/', /Política de privacidade/],
  ['terms/', /Termos de uso/],
];

/** Espera o React assumir a página (o HTML pré-renderizado aparece antes de ser interativo). */
async function gotoReady(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.hydrated), undefined, { timeout: 15_000 });
}

/** Divergências entre o HTML pré-renderizado e o primeiro render do React (src/main.tsx). */
async function hydrationReport(page: Page) {
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.hydrated), undefined, { timeout: 15_000 });
  return page.evaluate(() => ({
    mode: document.documentElement.dataset.hydrated,
    errors: (window as Window & { __bzRecoverableErrors?: string[] }).__bzRecoverableErrors ?? [],
  }));
}

for (const [path, title] of ROUTES) {
  test(`deep link /${path} carrega sem erros e hidrata o HTML pré-renderizado`, async ({ page, request }) => {
    // O HTML já traz a página completa (antes do JavaScript).
    const html = await (await request.get(path)).text();
    expect(html).toContain('data-ssr="1"');
    const errors = trackErrors(page);
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    expect(await hydrationReport(page)).toEqual({ mode: 'true', errors: [] });
    expect(errors).toEqual([]);
  });
}

test('conteúdo principal aparece sem JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('course/harvard-cs50x/');
  await expect(page.getByRole('heading', { level: 1, name: "CS50's Introduction to Computer Science" })).toBeVisible();
  await page.goto('');
  await expect(page.getByRole('heading', { level: 1, name: /Inteligência para descobrir/ })).toBeVisible();
  await context.close();
});

test('barra de ações do celular aparece depois da Forja e some no rodapé', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Somente em viewport móvel.');
  await gotoReady(page, '');
  // Escondida, a barra fica `inert` (fora da árvore de acessibilidade): localizar por CSS.
  const bar = page.locator('nav.bz-mobile-bar');
  await expect(bar).not.toHaveAttribute('data-shown');
  await expect(bar).toHaveAttribute('inert', '');
  // Dentro da Forja os atos têm as próprias chamadas; a barra vem depois dela.
  await page.evaluate(() => {
    const forja = document.getElementById('forja')!;
    window.scrollTo(0, forja.getBoundingClientRect().bottom + window.scrollY + 200);
  });
  await expect(bar).toHaveAttribute('data-shown', '');
  await expect(page.getByRole('navigation', { name: 'Ações rápidas' }).getByRole('link', { name: 'Buscar cursos' })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(bar).not.toHaveAttribute('data-shown');
  await expect(bar).toHaveAttribute('inert', '');
});

test('rota inexistente mostra a página 404 da aplicação', async ({ page }) => {
  await page.goto('nao-existe/');
  await expect(page.getByRole('heading', { level: 1, name: /Esta página não existe/ })).toBeVisible();
});

test('metadados por rota estão no HTML estático', async ({ request }) => {
  const res = await request.get('course/harvard-cs50x/');
  const html = await res.text();
  expect(html).toContain('<title>CS50&#39;s Introduction to Computer Science · Bezalel</title>');
  expect(html).toContain('application/ld+json');
  expect(html).toContain('rel="canonical"');
  const sitemap = await (await request.get('sitemap.xml')).text();
  expect(sitemap).toContain('/site_bezalel/course/harvard-cs50x/');
});

test('busca e filtros alteram os resultados', async ({ page }) => {
  await gotoReady(page, 'explore/');
  const heading = page.getByRole('heading', { level: 2, name: /oportunidades?/ });
  await expect(heading).toContainText('19');
  await page.getByLabel('Buscar no catálogo').fill('linux');
  await expect(page).toHaveURL(/q=linux/);
  await expect(heading).toContainText('1 oportunidade');
  await page.getByRole('link', { name: 'Introduction to Linux (LFS101)' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Introduction to Linux (LFS101)' })).toBeVisible();
});

test('assistente responde com cursos do catálogo', async ({ page }) => {
  await gotoReady(page, 'assistant/');
  await page.getByLabel('Sua pergunta').fill('cursos gratuitos de Python');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText(/oportunidades? no catálogo verificado/)).toBeVisible();
});

test('laboratório 2D é utilizável', async ({ page }) => {
  await gotoReady(page, 'lab/');
  await page.getByRole('button', { name: 'Abrir versão 2D' }).click();
  await page.getByRole('button', { name: /Abrir estação Verifier/ }).click();
  await expect(page.getByRole('heading', { name: 'Estação Verifier' })).toBeVisible();
  await expect(page.getByText('Simulação local').first()).toBeVisible();
});

test('laboratório 3D carrega a cena e a Central de Operações', async ({ page, isMobile }) => {
  test.skip(isMobile, 'O fluxo 3D com teclado é coberto no desktop.');
  const errors = trackErrors(page);
  await gotoReady(page, 'lab/');
  const enter = page.getByRole('button', { name: 'Entrar no laboratório 3D' });
  test.skip(await enter.isDisabled(), 'WebGL indisponível neste navegador de teste.');
  await enter.click();
  await expect(page.locator('section canvas:not([role])')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('region', { name: 'Central de Operações' }).first()).toBeVisible();
  // Acesso por teclado às estações (lista visível ao receber foco).
  const scoutButton = page.getByRole('navigation', { name: /Estações/ }).getByRole('button', { name: /Abrir estação Scout/ });
  await scoutButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Estação Scout' })).toBeVisible();
  expect(errors.filter((e) => !/GPU|WebGL|GL_/.test(e))).toEqual([]);
});

test('sem rolagem horizontal acidental', async ({ page }) => {
  for (const path of ['', 'explore/', 'insights/', 'agents/', 'lab/', 'methodology/']) {
    await page.goto(path);
    await page.waitForFunction(() => Boolean(document.documentElement.dataset.hydrated));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `rolagem horizontal em /${path}`).toBeLessThanOrEqual(1);
  }
});

test('menu móvel abre e navega', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Somente em viewport móvel.');
  await gotoReady(page, '');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Insights' }).click();
  // Insights carrega o chunk de gráficos sob demanda; com a suíte em paralelo pode passar de 5 s.
  await expect(page.getByRole('heading', { level: 1, name: /Competências observadas/ })).toBeVisible({ timeout: 15_000 });
});

// ---- A Forja (home) -------------------------------------------------------------

/** Rola até um ponto da linha do tempo da Forja (mesma geometria do componente). */
async function scrollForja(page: Page, p: number) {
  await page.evaluate((p) => {
    const s = document.getElementById('forja')!;
    const hero = s.querySelector<HTMLElement>('.bz-forja-hero')!;
    const vh = window.innerHeight;
    const total = s.offsetHeight - vh;
    const heroOut = Math.min(total * 0.5, Math.max(1, hero.offsetHeight - vh * 0.06));
    const scrolled = p <= 0.12 ? (p / 0.12) * heroOut : heroOut + ((p - 0.12) / 0.88) * (total - heroOut);
    window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY + scrolled);
  }, p);
}

test('Forja: a rolagem conduz os atos com números do catálogo', async ({ page }) => {
  await gotoReady(page, '');
  await expect(page.locator('html')).toHaveAttribute('data-forja', 'full');
  const forja = page.locator('#forja');
  await expect(forja).toHaveAttribute('data-act', '0');
  for (const [p, act, title] of [
    [0.2, '1', 'Tudo começa espalhado.'],
    [0.45, '2', 'Só o que é confirmado vira estrutura.'],
    [0.62, '3', 'Cada curso se liga ao que ensina.'],
    [0.8, '4', 'A estrutura ganha forma.'],
    [0.97, '5', 'Agora, entre onde a estrutura é construída.'],
  ] as const) {
    await scrollForja(page, p);
    await expect(forja).toHaveAttribute('data-act', act);
    await expect(page.getByRole('heading', { level: 3, name: title })).toBeInViewport();
  }
  // Números reais do catálogo verificado (não inventados).
  await scrollForja(page, 0.62);
  await expect(page.getByText(/\d+ competências ligadas a 19 cursos em \d+ conexões/)).toBeVisible();
});

test('Forja: interesses escolhidos personalizam a estrutura final', async ({ page }) => {
  await gotoReady(page, '');
  await scrollForja(page, 0.2);
  await page.getByRole('button', { name: 'IA e Machine Learning' }).click();
  await page.getByRole('button', { name: 'Segurança e Privacidade' }).click();
  await expect(page.getByRole('button', { name: 'IA e Machine Learning' })).toHaveAttribute('aria-pressed', 'true');
  await scrollForja(page, 0.8);
  await expect(page.getByRole('heading', { level: 3, name: /Sua estrutura: \d+ cursos verificados em IA e Machine Learning \+ Segurança e Privacidade\./ })).toBeVisible();
  const cta = page.getByRole('link', { name: 'Ver meus cursos' });
  await expect(cta).toHaveAttribute('href', /cat=ai-ml/);
  // A escolha fica guardada para a próxima visita.
  expect(await page.evaluate(() => localStorage.getItem('bz-interests'))).toBe('ai-ml,security-privacy');
});

test('Forja: "Pular" leva para depois da animação', async ({ page }) => {
  await gotoReady(page, '');
  await scrollForja(page, 0.3);
  await page.locator('.bz-forja-skip').click();
  // Fim da Forja logo abaixo do cabeçalho fixo (scroll-padding-top respeitado).
  await expect.poll(() => page.evaluate(() => document.getElementById('forja')!.getBoundingClientRect().bottom)).toBeLessThan(120);
  await expect(page.getByRole('heading', { level: 2, name: /Mais que um catálogo/ })).toBeInViewport();
});

test('Forja: com movimento reduzido vira história em cartões, sem 3D', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await gotoReady(page, '');
  await expect(page.locator('html')).toHaveAttribute('data-forja', 'lite');
  await expect(page.locator('.bz-forja-canvas')).toBeHidden();
  await expect(page.getByRole('heading', { level: 2, name: 'Como a Bezalel constrói' })).toBeVisible();
  for (const title of ['Tudo começa espalhado.', 'Só o que é confirmado vira estrutura.', 'Cada curso se liga ao que ensina.']) {
    await expect(page.getByRole('heading', { level: 3, name: title })).toBeVisible();
  }
  await context.close();
});

test('Forja: sem placa de vídeo fica o pôster estático (sem 3D por software)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Coberto no desktop.');
  await gotoReady(page, '');
  await page.mouse.wheel(0, 400);
  const software = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return /swiftshader|llvmpipe|software/i.test(String(info ? gl!.getParameter(info.UNMASKED_RENDERER_WEBGL) : ''));
  });
  test.skip(!software, 'Este navegador de teste tem aceleração de vídeo.');
  await expect(page.locator('#forja')).toHaveAttribute('data-no3d', '', { timeout: 15_000 });
  await expect(page.locator('.bz-forja-canvas')).not.toHaveAttribute('data-loaded', '');
});

test('Forja: a cena 3D carrega depois da primeira interação', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Coberto no desktop.');
  const errors = trackErrors(page);
  // O navegador de teste não tem placa de vídeo: ?forja3d aceita WebGL por software.
  await gotoReady(page, '?forja3d');
  const canvas = page.locator('.bz-forja-canvas');
  await expect(canvas).not.toHaveAttribute('data-ready', '');
  await page.mouse.wheel(0, 400);
  const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  test.skip(!webgl, 'WebGL indisponível neste navegador de teste.');
  await expect(canvas).toHaveAttribute('data-loaded', '', { timeout: 15_000 });
  // No hero a cena dorme (pôster em CSS); entrando na história, ela aparece.
  await scrollForja(page, 0.3);
  await expect(canvas).toHaveAttribute('data-ready', '');
  await scrollForja(page, 0);
  await expect(canvas).not.toHaveAttribute('data-ready', '');
  expect(errors.filter((e) => !/GPU|WebGL|GL_|X4122/.test(e))).toEqual([]);
});
