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

for (const [path, title] of ROUTES) {
  test(`deep link /${path} carrega sem erros`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

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
  await page.goto('explore/');
  const heading = page.getByRole('heading', { level: 2, name: /oportunidades?/ });
  await expect(heading).toContainText('19');
  await page.getByLabel('Buscar no catálogo').fill('linux');
  await expect(page).toHaveURL(/q=linux/);
  await expect(heading).toContainText('1 oportunidade');
  await page.getByRole('link', { name: 'Introduction to Linux (LFS101)' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Introduction to Linux (LFS101)' })).toBeVisible();
});

test('assistente responde com cursos do catálogo', async ({ page }) => {
  await page.goto('assistant/');
  await page.getByLabel('Sua pergunta').fill('cursos gratuitos de Python');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText(/oportunidades? no catálogo verificado/)).toBeVisible();
});

test('laboratório 2D é utilizável', async ({ page }) => {
  await page.goto('lab/');
  await page.getByRole('button', { name: 'Abrir versão 2D' }).click();
  await page.getByRole('button', { name: /Abrir estação Verifier/ }).click();
  await expect(page.getByRole('heading', { name: 'Estação Verifier' })).toBeVisible();
  await expect(page.getByText('Simulação local').first()).toBeVisible();
});

test('laboratório 3D carrega a cena e a Central de Operações', async ({ page, isMobile }) => {
  test.skip(isMobile, 'O fluxo 3D com teclado é coberto no desktop.');
  const errors = trackErrors(page);
  await page.goto('lab/');
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
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `rolagem horizontal em /${path}`).toBeLessThanOrEqual(1);
  }
});

test('menu móvel abre e navega', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Somente em viewport móvel.');
  await page.goto('');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Insights' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Competências observadas/ })).toBeVisible();
});
