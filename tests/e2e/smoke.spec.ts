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
  ['trail/', /Quatro perguntas, uma trilha de cursos reais/],
  ['skills/', /O que você aprende, ligado ao que vem depois/],
  ['universe/', /Uma cidade para explorar o que a Bezalel constrói/],
  ['saved/', /Seus cursos, seu ritmo/],
  ['compare/', /Lado a lado, só com o que a fonte declara/],
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
  // Catálogo real ampliado na Fase 2 (mais de 100 registros verificados).
  await expect(heading).toHaveText(/\b\d{3,} oportunidades/);
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
  // Sem placa de vídeo (CI) o campus é desenhado por software: quadros lentos.
  test.setTimeout(90_000);
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

test('laboratório 2D: o Vigia mostra os prazos reais de reconferência', async ({ page }) => {
  await gotoReady(page, 'lab/');
  await page.getByRole('button', { name: 'Abrir versão 2D' }).click();
  // Seis setores na planta, um por agente.
  for (const name of ['Scout', 'Verifier', 'Vigia', 'Atlas', 'Trend', 'Sol']) await expect(page.getByRole('button', { name: new RegExp(`Abrir estação ${name}`) })).toBeVisible();
  await page.getByRole('button', { name: /Abrir estação Vigia/ }).click();
  await expect(page.getByRole('heading', { name: 'Estação Vigia' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Catálogo verificado' })).toBeVisible();
  await expect(page.getByText(/Regra: um registro é atual/)).toBeVisible();
});

test('laboratório 3D: ?setor=vigia começa de frente para o setor do Vigia', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Coberto no desktop.');
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await gotoReady(page, 'lab/?setor=vigia');
  const enter = page.getByRole('button', { name: 'Entrar no laboratório 3D' });
  test.skip(await enter.isDisabled(), 'WebGL indisponível neste navegador de teste.');
  await enter.click();
  // O visitante nasce no setor: o aviso de proximidade aparece sem andar.
  await expect(page.getByRole('button', { name: /^E\s*Abrir estação Vigia$/ })).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press('e');
  await expect(page.getByRole('heading', { name: 'Estação Vigia' })).toBeVisible();
  expect(errors.filter((e) => !/GPU|WebGL|GL_/.test(e))).toEqual([]);
});

test('laboratório 2D: o tour guiado percorre a Central e os setores (botões e teclado)', async ({ page }) => {
  await gotoReady(page, 'lab/');
  await page.getByRole('button', { name: 'Abrir versão 2D' }).click();
  await page.getByRole('button', { name: 'Tour guiado' }).click();
  const tour = page.getByRole('region', { name: 'Tour guiado pelo campus' });
  await expect(tour.getByRole('heading', { name: 'A Central de Operações' })).toBeVisible();
  await expect(tour.getByText('Parada 1 de 7')).toBeVisible();
  await tour.getByRole('button', { name: 'Próxima parada' }).click();
  await expect(tour.getByRole('heading', { name: 'Scout descobre' })).toBeVisible();
  // Número ao vivo do setor (simulação) junto da explicação.
  await expect(tour.getByText(/Oportunidades descobertas: \d+/)).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(tour.getByRole('heading', { name: 'Verifier valida' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tour).toHaveCount(0);
});

test('seguir um curso: da página do curso ao laboratório, com os dados reais em cada parada', async ({ page }) => {
  await gotoReady(page, 'course/harvard-cs50x/');
  await page.getByRole('link', { name: 'Seguir no laboratório' }).click();
  await expect(page).toHaveURL(/\/lab\/?\?curso=harvard-cs50x$/);
  await expect(page.getByText(/Seguindo um curso: CS50/)).toBeVisible();
  await page.getByRole('button', { name: 'Abrir versão 2D' }).click();
  const panel = page.getByRole('region', { name: 'Seguindo um curso pelo pipeline' });
  await expect(panel.getByRole('heading', { name: 'Descoberto na fonte' })).toBeVisible();
  await expect(panel.getByText(/cs50\.harvard\.edu/)).toBeVisible();
  await panel.getByRole('button', { name: 'Próxima parada' }).click();
  await expect(panel.getByRole('heading', { name: 'Validado' })).toBeVisible();
  await expect(panel.getByText(/^Verificado em /)).toBeVisible();
  // Escolha pelo seletor também funciona.
  await panel.getByRole('button', { name: 'Sair' }).click();
  await page.getByRole('button', { name: 'Seguir um curso' }).click();
  const picker = page.getByRole('dialog', { name: 'Escolha um curso para seguir' });
  await picker.getByLabel('Buscar no catálogo verificado').fill('cs50 python');
  await picker.getByRole('button', { name: /CS50's Introduction to Programming with Python/ }).click();
  await expect(page.getByRole('region', { name: 'Seguindo um curso pelo pipeline' }).getByText("CS50's Introduction to Programming with Python")).toBeVisible();
});

test('laboratório 3D: o guia leva o visitante até o setor (efeitos pausados = corte direto)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Coberto no desktop.');
  // No CI não há placa de vídeo: o WebGL roda em software e cada quadro do campus demora.
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await gotoReady(page, 'lab/');
  const enter = page.getByRole('button', { name: 'Entrar no laboratório 3D' });
  test.skip(await enter.isDisabled(), 'WebGL indisponível neste navegador de teste.');
  await enter.click();
  await expect(page.locator('section canvas:not([role])')).toBeVisible({ timeout: 20_000 });
  // Teclado em vez de clique: o clique espera a página pintar um quadro, e com
  // WebGL por software isso pode estourar o tempo (como no teste 3D acima).
  const press = async (name: string) => {
    await page.getByRole('button', { name, exact: true }).focus();
    await page.keyboard.press('Enter');
  };
  // Sem animação o guia (e o visitante atrás dele) chega na hora.
  await press('Pausar efeitos');
  await press('Tour guiado');
  const tour = page.getByRole('region', { name: 'Tour guiado pelo campus' });
  await expect(tour.getByRole('heading', { name: 'A Central de Operações' })).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press('ArrowRight');
  await expect(tour.getByRole('heading', { name: 'Scout descobre' })).toBeVisible({ timeout: 20_000 });
  await expect(tour.getByText('A caminho…')).toHaveCount(0, { timeout: 30_000 });
  await page.keyboard.press('e');
  await expect(page.getByRole('heading', { name: 'Estação Scout' })).toBeVisible({ timeout: 20_000 });
  expect(errors.filter((e) => !/GPU|WebGL|GL_/.test(e))).toEqual([]);
});

test('Agentes: o Vigia está entre os seis agentes e leva ao seu setor no laboratório', async ({ page }) => {
  await gotoReady(page, 'agents/');
  await expect(page.getByRole('heading', { level: 3, name: 'Vigia' })).toBeVisible();
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { level: 3, name: 'Vigia' }) });
  await card.getByRole('button', { name: 'Ver perfil' }).click();
  await expect(page.getByRole('link', { name: 'Ver estação no laboratório' })).toHaveAttribute('href', /\/lab\?setor=vigia$/);
});

test('sem rolagem horizontal acidental', async ({ page }) => {
  for (const path of ['', 'explore/', 'insights/', 'agents/', 'lab/', 'methodology/', 'trail/', 'skills/', 'universe/', 'saved/', 'compare/']) {
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
  await expect(page.getByText(/\d+ competências ligadas a \d{3,} cursos em \d+ conexões/)).toBeVisible();
});

test('Forja: interesses escolhidos personalizam a estrutura final', async ({ page }) => {
  await gotoReady(page, '');
  await scrollForja(page, 0.2);
  // Escolha por temas (7) em vez de 21 áreas soltas.
  await page.getByRole('button', { name: 'Tecnologia', exact: true }).click();
  await page.getByRole('button', { name: 'Saúde e bem-estar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tecnologia', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await scrollForja(page, 0.8);
  await expect(page.getByRole('heading', { level: 3, name: /Sua estrutura: \d+ cursos verificados em Tecnologia \+ Saúde e bem-estar\./ })).toBeVisible();
  const cta = page.getByRole('link', { name: 'Ver meus cursos' });
  await expect(cta).toHaveAttribute('href', /cat=ai-ml/);
  // A escolha fica guardada para a próxima visita.
  expect(await page.evaluate(() => localStorage.getItem('bz-interest-groups'))).toBe('tech,health');
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

// ---- A origem (Sobre): a manivela -----------------------------------------------------

test('Sobre: a manivela constrói a história capítulo a capítulo', async ({ page }) => {
  const errors = trackErrors(page);
  await gotoReady(page, 'about/');
  const dial = page.getByRole('slider', { name: 'Manivela da história de Bezalel' });
  await dial.scrollIntoViewIfNeeded();
  await expect(dial).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByRole('heading', { level: 3, name: 'Tudo começa como matéria espalhada.' })).toBeVisible();
  await dial.focus();
  await page.keyboard.press('PageUp');
  await expect(dial).toHaveAttribute('aria-valuenow', '1');
  await expect(dial).toHaveAttribute('aria-valuetext', 'Capítulo 1 de 7: Um nome que é sombra');
  await expect(page.getByRole('heading', { level: 3, name: 'Um nome que é sombra' })).toBeVisible();
  // A planta (canvas) é carregada quando a seção chega à tela.
  await expect(page.locator('#origem')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('End');
  await expect(dial).toHaveAttribute('aria-valuenow', '7', { timeout: 10_000 });
  await expect(page.getByRole('heading', { level: 3, name: 'O que fica de pé' })).toBeVisible();
  await expect(page.locator('#origem').getByRole('link', { name: 'Explorar cursos' })).toBeVisible();
  // Recomeçar gira de volta ao início.
  await page.locator('#origem').getByRole('button', { name: 'Recomeçar' }).click();
  await expect(dial).toHaveAttribute('aria-valuenow', '0', { timeout: 10_000 });
  expect(errors).toEqual([]);
});

test('Sobre: arrastar a manivela em círculo avança a história', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Arraste com mouse coberto no desktop; no celular o mesmo código recebe toque.');
  await gotoReady(page, 'about/');
  const dial = page.getByRole('slider', { name: 'Manivela da história de Bezalel' });
  await dial.scrollIntoViewIfNeeded();
  const box = (await dial.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = box.width * 0.4;
  await page.mouse.move(cx, cy - r);
  await page.mouse.down();
  for (let i = 0; i <= 48; i++) {
    const a = -Math.PI / 2 + (i / 48) * Math.PI * 2 * 1.35;
    await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  await page.mouse.up();
  // Mais de uma volta no sentido horário: encaixa no capítulo 2 (ou além, pelo embalo).
  await expect.poll(async () => Number(await dial.getAttribute('aria-valuenow')), { timeout: 8_000 }).toBeGreaterThanOrEqual(2);
});

test('Sobre: com movimento reduzido a manivela encaixa na hora', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await gotoReady(page, 'about/');
  const dial = page.getByRole('slider', { name: 'Manivela da história de Bezalel' });
  await dial.focus();
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp');
  await expect(dial).toHaveAttribute('aria-valuenow', '2', { timeout: 1_000 });
  await context.close();
});

test('Sobre: sem JavaScript a história inteira aparece como lista', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('about/');
  for (const title of ['Um nome que é sombra', 'O Tabernáculo, medida por medida', 'As letras da criação', 'O que fica de pé']) {
    await expect(page.getByRole('heading', { level: 3, name: title })).toBeVisible();
  }
  await expect(page.getByRole('slider')).toHaveCount(0);
  await context.close();
});


// ---- Fase 4 · Ferramentas -------------------------------------------------------------

test('trilha: quatro respostas montam uma trilha real e o link reabre a mesma trilha', async ({ page, browser }) => {
  await gotoReady(page, 'trail/');
  await page.getByRole('button', { name: /^Tecnologia/ }).click();
  await expect(page.getByRole('heading', { name: 'Qual é o seu objetivo agora?' })).toBeFocused();
  await page.getByRole('button', { name: /^Começar do zero/ }).click();
  await page.getByRole('button', { name: /^5 horas por semana/ }).click();
  await page.getByLabel('Com certificado confirmado').check();
  await page.getByRole('button', { name: 'Montar minha trilha' }).click();
  await expect(page.getByRole('heading', { level: 2, name: /cursos em Tecnologia/ })).toBeVisible();
  await expect(page).toHaveURL(/trail\/?\?t=tech&g=start&h=5&o=c&c=[a-z0-9-]+(,[a-z0-9-]+)+$/);
  const titles = await page.locator('ol h3').allInnerTexts();
  expect(titles.length).toBeGreaterThanOrEqual(2);
  // O link basta: outra pessoa (outro navegador) vê a mesma trilha.
  const other = await browser.newContext();
  const shared = await other.newPage();
  await shared.goto(page.url());
  await expect(shared.locator('ol h3')).toHaveText(titles);
  await other.close();
});

test('estante: salvar, marcar progresso, comparar, baixar o plano (.ics) e somar horas', async ({ page }) => {
  // Dois cursos reais com carga em horas e certificado confirmados: 3 h (Kaggle) e 10 h (Enap).
  for (const [slug, title] of [
    ['kaggle-intro-to-machine-learning', 'Intro to Machine Learning'],
    ['enap-introducao-lgpd', 'Introdução à Lei Brasileira de Proteção de Dados Pessoais'],
  ]) {
    await gotoReady(page, `course/${slug}/`);
    await page.getByRole('button', { name: `Salvar na estante: ${title}`, exact: true }).click();
    await expect(page.getByRole('button', { name: `Salvo. Remover da estante: ${title}`, exact: true })).toBeVisible();
  }
  await page.goto('saved/');
  await expect(page.getByRole('heading', { name: '2 cursos salvos' })).toBeVisible();
  // Progresso: o de 3 h concluído.
  await page.getByRole('group', { name: 'Progresso: Intro to Machine Learning' }).getByText('Concluído').click();
  await expect(page.getByText('1 de 2 concluídos')).toBeVisible();
  // Horas complementares: 13 h no total, 3 h contando só os concluídos.
  await page.getByLabel('Horas exigidas pela sua instituição').fill('20');
  await expect(page.getByText('13 h que podem ser comprovadas')).toBeVisible();
  await expect(page.getByText('faltam 7 h para a meta')).toBeVisible();
  await page.getByLabel('só os concluídos').check();
  await expect(page.getByText('3 h que podem ser comprovadas')).toBeVisible();
  // Plano de estudos: só o que falta (10 h em sessões de 60 min, seg–qua).
  await expect(page.getByText(/^10 sessões/)).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar plano (.ics)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('bezalel-plano-de-estudos.ics');
  const text = (await import('node:fs')).readFileSync((await file.path())!, 'utf8');
  expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(10);
  // Linhas longas vêm dobradas (RFC 5545): desdobra antes de procurar.
  expect(text.replace(/\r\n /g, '')).toContain('SUMMARY:Estudar: Introdução à Lei Brasileira de Proteção de Dados Pessoais (1/10)');
  // Comparador com os dois.
  for (const box of await page.getByRole('checkbox', { name: /Selecionar para comparar/ }).all()) await box.check();
  await page.getByRole('link', { name: 'Comparar selecionados (2)' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveCount(3);
  await expect(page.getByRole('row', { name: /Carga horária/ })).toContainText('3 horas');
  await expect(page.getByRole('row', { name: /Carga horária/ })).toContainText('10 horas');
});

test('Ctrl+K abre a paleta e leva a um curso pelo teclado', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Atalho de teclado: coberto no desktop.');
  await gotoReady(page, '');
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox', { name: 'Buscar cursos, páginas e ações' });
  await expect(input).toBeFocused();
  await input.fill('cs50 python');
  // Desce com as setas até o curso e abre com Enter (padrão combobox/listbox).
  const options = page.getByRole('option');
  await expect(options.filter({ hasText: "CS50's Introduction to Programming with Python" })).toHaveCount(1);
  const labels = await options.allInnerTexts();
  const target = labels.findIndex((l) => l.includes("CS50's Introduction to Programming with Python"));
  for (let i = 0; i < target; i++) await page.keyboard.press('ArrowDown');
  await expect(options.nth(target)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/course\/harvard-cs50p\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: "CS50's Introduction to Programming with Python" })).toBeVisible();
});


// ---- Fase 5 · Psicologia aplicada com ética (docs/ETHICS.md) -------------------------

const TRAIL_2 = 'trail/?t=tech&g=start&h=5&c=kaggle-intro-to-machine-learning,enap-introducao-lgpd';

test('pico-final: concluir a trilha mostra o fechamento e um próximo passo sem repetir cursos', async ({ page }) => {
  await gotoReady(page, TRAIL_2);
  for (const title of ['Intro to Machine Learning', 'Introdução à Lei Brasileira de Proteção de Dados Pessoais']) {
    await page.getByRole('group', { name: `Progresso: ${title}` }).getByText('Concluído').click();
  }
  await expect(page.getByRole('heading', { name: 'Trilha concluída.' })).toBeVisible();
  await expect(page.getByText(/Você marcou 2 cursos como concluídos, 13 h declaradas pelas fontes/)).toBeVisible();
  await page.getByRole('button', { name: 'Aprofundar em Tecnologia' }).click();
  await expect(page).toHaveURL(/g=deepen/);
  const next = await page.locator('ol h3').allInnerTexts();
  expect(next.length).toBeGreaterThan(0);
  expect(next).not.toContain('Intro to Machine Learning');
  expect(next).not.toContain('Introdução à Lei Brasileira de Proteção de Dados Pessoais');
});

test('gradiente de meta: a home lembra a trilha e o curso em andamento (só para quem volta)', async ({ page }) => {
  await gotoReady(page, '');
  await expect(page.getByRole('heading', { name: 'Continue de onde parou' })).toHaveCount(0);
  await page.goto(TRAIL_2);
  await page.getByRole('group', { name: 'Progresso: Intro to Machine Learning' }).getByText('Em andamento').click();
  await page.goto('');
  const box = page.getByRole('region', { name: 'Continue de onde parou' });
  await expect(box.getByRole('link', { name: 'Intro to Machine Learning' })).toBeVisible();
  await expect(box.getByText('Sua trilha: 0 de 2 concluídos')).toBeVisible();
  await box.getByRole('link', { name: 'Voltar à trilha' }).click();
  await expect(page).toHaveURL(/trail\/?\?t=tech&g=start&h=5&c=kaggle-intro-to-machine-learning,enap-introducao-lgpd$/);
});

test('curiosidade com números reais: cada escolha do questionário mostra quantos cursos sobram', async ({ page }) => {
  await gotoReady(page, 'trail/');
  await expect(page.getByRole('button', { name: /^Tecnologia.*· \d+ cursos$/ })).toBeVisible();
  await page.getByRole('button', { name: /^Tecnologia/ }).click();
  await page.getByRole('button', { name: /^Começar do zero/ }).click();
  await page.getByRole('button', { name: /^5 horas por semana/ }).click();
  const live = page.getByText(/^Com essas preferências: \d+ cursos? verificados?\.$/);
  const before = Number((await live.innerText()).match(/\d+/)![0]);
  await page.getByLabel('Só em português').check();
  await expect.poll(async () => Number(((await live.innerText()).match(/\d+/) ?? ['0'])[0])).toBeLessThan(before);
});

test('polegar: no celular, as ações do curso voltam ao rodapé depois que o topo sai da tela', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'A barra só existe no celular.');
  await gotoReady(page, 'course/harvard-cs50x/');
  const bar = page.getByRole('navigation', { name: 'Ações do curso' });
  await expect(bar).toBeHidden();
  await page.mouse.wheel(0, 900);
  await expect(bar).toBeVisible();
  await expect(bar.getByRole('link', { name: /Acessar fonte oficial/ })).toHaveAttribute('href', /^https:\/\//);
  await bar.getByRole('button', { name: /^Salvar na estante: / }).click();
  await expect(bar.getByRole('button', { name: /^Remover da estante: / })).toBeVisible();
});


test('poucas escolhas por vez: filtros mostram 7 temas e as áreas abrem sob demanda', async ({ page, isMobile }) => {
  test.skip(isMobile, 'No celular os mesmos filtros ficam na gaveta (coberto abaixo).');
  await gotoReady(page, 'explore/');
  const aside = page.getByRole('complementary', { name: 'Filtros' });
  const area = aside.getByRole('button', { name: /^IA e Machine Learning/ });
  await expect(area).toBeHidden();
  await aside.getByText('Tecnologia', { exact: true }).click();
  await area.click();
  await expect(page).toHaveURL(/cat=ai-ml/);
  await expect(aside.getByText('Tecnologia (1)')).toBeVisible();
  // Filtros menos decisivos ficam em "Mais filtros".
  await expect(aside.getByRole('button', { name: /^Iniciante/ })).toBeHidden();
  await aside.getByText('Mais filtros').click();
  await expect(aside.getByRole('button', { name: /^Iniciante/ })).toBeVisible();
});

test('pico-final no catálogo: o fim da lista leva à trilha já no tema filtrado', async ({ page }) => {
  await gotoReady(page, 'explore/?cat=ai-ml');
  const next = page.getByRole('region', { name: 'Não sabe por onde começar?' });
  await expect(next.getByRole('link', { name: 'Descobrir minha trilha' })).toHaveAttribute('href', /\/trail\?tema=tech$/);
  await next.getByRole('link', { name: 'Descobrir minha trilha' }).click();
  // A pergunta do tema já está respondida.
  await expect(page.getByText('Pergunta 2 de 4')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Qual é o seu objetivo agora?' })).toBeVisible();
});

test('pico-final no curso: montar trilha no tema ou comparar com os relacionados', async ({ page }) => {
  await gotoReady(page, 'course/harvard-cs50x/');
  const next = page.getByRole('region', { name: 'Siga em Tecnologia' });
  await expect(next.getByRole('link', { name: 'Montar trilha em Tecnologia' })).toHaveAttribute('href', /\/trail\?tema=tech$/);
  await next.getByRole('link', { name: 'Comparar com os relacionados' }).click();
  await expect(page.getByRole('columnheader')).toHaveCount(4);
});

test('polegar no catálogo: no celular, "Filtros" fica ao alcance depois da busca', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'A barra só existe no celular.');
  await gotoReady(page, 'explore/');
  const bar = page.getByRole('navigation', { name: 'Ações do catálogo' });
  await expect(bar).toBeHidden();
  await page.mouse.wheel(0, 1200);
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: /^Filtros/ }).click();
  await expect(page.getByRole('dialog', { name: 'Filtros' })).toBeVisible();
});

// ---- Constelação de competências ---------------------------------------------------

test('constelação: do curso para a competência, com quem a ensina', async ({ page }) => {
  await gotoReady(page, 'course/harvard-cs50x/');
  await page.getByRole('link', { name: 'Ver na constelação de competências' }).click();
  await expect(page).toHaveURL(/\/skills\/?\?skill=[a-z0-9-]+$/);
  const detail = page.getByRole('region').filter({ has: page.locator('#sky-detail') });
  await expect(detail.getByRole('link', { name: /CS50/ }).first()).toBeVisible();
  await expect(page.getByRole('img', { name: /Mapa de \d+ competências/ })).toBeVisible();
});

test('constelação: a estante acende o céu e sugere próximos passos; o tema aproxima', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bz-shelf-v1', JSON.stringify({ v: 1, saved: [], progress: { 'crs-harvard-cs50x': 'done' } })));
  await gotoReady(page, 'skills/');
  const mine = page.getByRole('region', { name: 'Sua constelação' });
  await expect(mine).toContainText(/competências? acesas?/);
  const suggestion = mine.getByRole('listitem').first().getByRole('button');
  const name = (await suggestion.textContent())!.trim();
  await suggestion.click();
  await expect(page.locator('#sky-detail')).toHaveText(name);

  const map = page.getByRole('img', { name: /Mapa de/ });
  const full = await map.getAttribute('viewBox');
  await page.getByRole('group', { name: 'Tema' }).getByRole('button', { name: 'Saúde e bem-estar' }).click();
  await expect(page).toHaveURL(/tema=health/);
  expect(await map.getAttribute('viewBox')).not.toBe(full);
  // A lista acessível mostra só o tema escolhido, já aberto.
  await expect(page.getByRole('region', { name: 'Todas as competências' }).locator('details[open]')).toHaveCount(1);
});

// ---- Bezalel Universe ---------------------------------------------------------------

test('Universe 2D: mapa da cidade com os locais e links reais', async ({ page }) => {
  await gotoReady(page, 'universe/');
  await page.getByRole('button', { name: 'Ver o mapa da cidade' }).click();
  await expect(page.getByRole('group', { name: /Planta da primeira área/ })).toBeVisible();
  const lab = page.locator('#universe-ai-lab');
  await expect(lab.getByRole('heading', { name: 'Laboratório de IA' })).toBeVisible();
  await expect(lab.getByRole('link', { name: 'Entrar no laboratório 3D' })).toHaveAttribute('href', /\/lab$/);
  // Centro de Produtos: só produtos que existem no site.
  const products = page.locator('#universe-products-center');
  await expect(products.getByRole('link', { name: /Descubra sua trilha/ })).toHaveAttribute('href', /\/trail$/);
  await expect(products.getByRole('link', { name: /Constelação de competências/ })).toHaveAttribute('href', /\/skills$/);
});

test('laboratório: o Bezalel Universe está a um clique (tela de entrada e mapa 2D)', async ({ page }) => {
  await gotoReady(page, 'lab/');
  const link = page.getByRole('link', { name: 'Explorar o Bezalel Universe' });
  await expect(link.first()).toBeVisible();
  await link.first().click();
  await expect(page).toHaveURL(/\/universe\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Uma cidade para explorar/);
});

/** Estado do jogo exposto pelo gancho de testes (`bz-universe-debug`). */
interface UniverseProbe {
  mode: string;
  active: string | null;
  walker: { x: number; y: number; z: number };
  vehicles: Array<{ id: string; x: number; y: number; z: number; heading: number; speed: number }>;
  traffic: number;
  nearVehicle: string | null;
}
type UniverseWindow = Window & {
  __bzUniverse?: { state: () => UniverseProbe; placeWalker: (x: number, z: number, yaw?: number) => void; placeVehicle: (id: string, x: number, z: number, heading: number) => void };
  __rafCount?: number;
};

/** Entra no 3D com o gancho de inspeção ligado; devolve a leitura do estado. */
async function enterUniverse3d(page: Page, quality: 'low' | 'medium' | 'high' = 'low') {
  await page.addInitScript((q) => {
    localStorage.setItem('bz-universe-help-v2', 'seen');
    localStorage.setItem('bz-universe-debug', '1');
    sessionStorage.setItem('bz-universe-quality', q);
  }, quality);
  await gotoReady(page, 'universe/');
  const enter = page.getByRole('button', { name: 'Explorar em 3D' });
  test.skip(await enter.isDisabled(), 'WebGL indisponível neste navegador de teste.');
  await enter.click();
  await expect(page.locator('section[data-universe-stage] canvas')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => Boolean((window as UniverseWindow).__bzUniverse), undefined, { timeout: 30_000 });
  return () => page.evaluate(() => (window as UniverseWindow).__bzUniverse!.state());
}

const aurora = (s: UniverseProbe) => s.vehicles.find((v) => v.id === 'aurora')!;

test('Universe 3D: anda, entra no carro, dirige, sai em lugar seguro e volta a andar', async ({ page, isMobile }) => {
  test.skip(isMobile, 'O fluxo com teclado é coberto no desktop (o celular tem teste próprio).');
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  const state = await enterUniverse3d(page);
  const stage = page.locator('section[data-universe-stage]');
  // Começa a pé e anda (W): a posição muda.
  await expect(stage).toHaveAttribute('data-player-mode', 'foot');
  const start = (await state()).walker;
  await page.mouse.move(640, 400);
  await page.keyboard.down('w');
  await expect.poll(async () => { const w = (await state()).walker; return Math.hypot(w.x - start.x, w.z - start.z); }, { timeout: 15_000 }).toBeGreaterThan(1.5);
  await page.keyboard.up('w');
  // O trânsito autônomo está na cena (os corpos dele entram nas colisões do jogador).
  expect((await state()).traffic).toBeGreaterThan(0);
  // Perto do sedã, o HUD oferece a ação.
  await page.evaluate(() => (window as UniverseWindow).__bzUniverse!.placeWalker(-8.6, 86, -Math.PI / 2));
  await expect(page.getByRole('button', { name: /Entrar: Sedã Aurora/ })).toBeVisible({ timeout: 10_000 });
  // Entra (E): o modo passa a dirigindo e o HUD troca de modo.
  await page.keyboard.press('e');
  await expect(stage).toHaveAttribute('data-player-mode', 'car', { timeout: 10_000 });
  await expect(page.getByRole('status').filter({ hasText: 'Dirigindo: Sedã Aurora' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sair do veículo' })).toBeVisible();
  // Acelera (W), vira (D) e freia (S).
  const car0 = aurora(await state());
  await page.keyboard.down('w');
  await expect.poll(async () => aurora(await state()).speed, { timeout: 15_000 }).toBeGreaterThan(3);
  await page.keyboard.down('d');
  await expect.poll(async () => Math.abs(aurora(await state()).heading - car0.heading), { timeout: 15_000 }).toBeGreaterThan(0.05);
  await page.keyboard.up('d');
  await page.keyboard.up('w');
  // S freia e, com o carro parado, engata a ré: velocidade (com sinal) abaixo de 0,5 = parou ou já está em ré.
  await page.keyboard.down('s');
  await expect.poll(async () => aurora(await state()).speed, { timeout: 15_000 }).toBeLessThan(0.5);
  await page.keyboard.up('s');
  // Sai (E): volta a pé, ao lado do carro, que continua no mundo, parado onde ficou.
  await page.keyboard.press('e');
  await expect(stage).toHaveAttribute('data-player-mode', 'foot', { timeout: 15_000 });
  await expect.poll(async () => (await state()).mode, { timeout: 10_000 }).toBe('foot');
  const after = await state();
  const car = aurora(after);
  expect(Math.hypot(car.x - car0.x, car.z - car0.z)).toBeGreaterThan(1);
  const gap = Math.hypot(after.walker.x - car.x, after.walker.z - car.z);
  expect(gap).toBeGreaterThan(1.2);
  expect(gap).toBeLessThan(4);
  // Volta a andar; o carro fica.
  const parked = after.walker;
  await page.keyboard.down('w');
  await expect.poll(async () => { const w = (await state()).walker; return Math.hypot(w.x - parked.x, w.z - parked.z); }, { timeout: 15_000 }).toBeGreaterThan(1);
  await page.keyboard.up('w');
  expect(aurora(await state())).toMatchObject({ x: car.x, z: car.z });
  expect(errors.filter((e) => !/GPU|WebGL|GL_/.test(e))).toEqual([]);
});

test('Universe 3D no computador: carro voador sobe e desce com ↑/↓; botão e tecla F de tela cheia', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Teclado e tela cheia do computador.');
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  const state = await enterUniverse3d(page);
  const stage = page.locator('section[data-universe-stage]');
  const hover = async () => (await state()).vehicles.find((v) => v.id === 'hover')!;
  // Tela cheia: botão com nome visível e atalho F.
  const fs = page.getByRole('button', { name: 'Tela cheia' });
  await expect(fs).toBeVisible();
  await expect(fs).toHaveAttribute('aria-keyshortcuts', 'F');
  await page.mouse.move(640, 400);
  await page.keyboard.press('f');
  await expect(page.getByRole('button', { name: 'Sair da tela cheia' })).toBeVisible({ timeout: 10_000 });
  expect(await page.evaluate(() => document.fullscreenElement?.hasAttribute('data-universe-stage'))).toBe(true);
  await page.keyboard.press('f');
  await expect(page.getByRole('button', { name: 'Tela cheia' })).toBeVisible({ timeout: 10_000 });
  // Clicar no botão também alterna (e o foco fica nele: as setas precisam continuar indo para o jogo).
  await page.getByRole('button', { name: 'Tela cheia' }).click();
  await expect(page.getByRole('button', { name: 'Sair da tela cheia' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Sair da tela cheia' }).click();
  await expect(page.getByRole('button', { name: 'Tela cheia' })).toBeFocused();
  // Entra no carro voador e sobe com ↑, sem andar para a frente.
  await page.evaluate(() => (window as UniverseWindow).__bzUniverse!.placeWalker(-2.5, 78, Math.PI / 2));
  await expect(page.getByRole('button', { name: /Entrar: / })).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('e');
  await expect(stage).toHaveAttribute('data-player-mode', 'hover', { timeout: 10_000 });
  const ground = await hover();
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await hover()).y, { timeout: 15_000 }).toBeGreaterThan(ground.y + 4);
  await page.keyboard.up('ArrowUp');
  const high = await hover();
  expect(Math.hypot(high.x - ground.x, high.z - ground.z)).toBeLessThan(3);
  // ↓ desce.
  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await hover()).y, { timeout: 15_000 }).toBeLessThan(high.y - 2);
  await page.keyboard.up('ArrowDown');
  expect(errors.filter((e) => !/GPU|WebGL|GL_/.test(e))).toEqual([]);
});

test('Universe 3D: abre um local pelo teclado, troca a qualidade e sai sem deixar o jogo rodando', async ({ page, isMobile }) => {
  test.skip(isMobile, 'O fluxo com teclado é coberto no desktop.');
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  // Conta os quadros pedidos (requestAnimationFrame) para provar que o laço para ao sair.
  await page.addInitScript(() => {
    const w = window as UniverseWindow;
    const raf = window.requestAnimationFrame.bind(window);
    w.__rafCount = 0;
    window.requestAnimationFrame = (cb) => {
      w.__rafCount! += 1;
      return raf(cb);
    };
  });
  await enterUniverse3d(page, 'medium');
  // Interface dos edifícios: Locais → Laboratório de IA, pelo teclado.
  const places = page.getByRole('button', { name: 'Locais' });
  await places.focus();
  await page.keyboard.press('Enter');
  const item = page.getByRole('navigation', { name: 'Locais' }).getByRole('button', { name: /Laboratório de IA/ });
  await item.focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('dialog', { name: 'Laboratório de IA' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/6 agentes representados/)).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Ir até aqui' })).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Entrar no laboratório 3D' })).toHaveAttribute('href', /\/lab$/);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  // Qualidade: o canvas é recriado com a configuração nova.
  const quality = page.getByRole('radiogroup', { name: 'Qualidade' });
  const canvas = page.locator('section[data-universe-stage] canvas');
  await canvas.evaluate((c) => c.setAttribute('data-probe', 'old'));
  await quality.getByRole('radio', { name: 'Alta' }).click();
  await expect(quality.getByRole('radio', { name: 'Alta' })).toHaveAttribute('aria-checked', 'true');
  // Lido logo após o clique: com WebGL por software, o rebaixamento automático (< 28 fps) pode descer o nível depois.
  expect(await page.evaluate(() => sessionStorage.getItem('bz-universe-quality'))).toBe('high');
  await expect(page.locator('section[data-universe-stage] canvas[data-probe="old"]')).toHaveCount(0, { timeout: 15_000 });
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  // Sai do Universe por um link do site: canvas, gancho e laço de quadros somem.
  await page.getByRole('link', { name: 'Metodologia' }).first().click();
  await expect(page).toHaveURL(/\/methodology\/?$/);
  // (o fundo de partículas do cabeçalho das páginas é outro canvas, animado num worker)
  await expect(page.locator('section[data-universe-stage], section[data-universe-stage] canvas')).toHaveCount(0);
  expect(await page.evaluate(() => (window as UniverseWindow).__bzUniverse)).toBeUndefined();
  const before = await page.evaluate(() => (window as UniverseWindow).__rafCount!);
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => (window as UniverseWindow).__rafCount!);
  expect(after - before).toBeLessThan(10);
  expect(errors.filter((e) => !/GPU|WebGL|GL_/.test(e))).toEqual([]);
});

test('Universe no celular: sugere deitar o aparelho, joystick a pé, pedais e volante no carro', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Só no celular.');
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem('bz-universe-help-v2', 'seen');
    localStorage.setItem('bz-universe-debug', '1');
    // O aviso de demonstração empurra o palco para baixo e tiraria os pedais da tela.
    localStorage.setItem('bz-demo-banner-v1', 'dismissed');
    sessionStorage.setItem('bz-universe-quality', 'low');
  });
  await gotoReady(page, 'universe/');
  const enter = page.getByRole('button', { name: 'Explorar em 3D' });
  test.skip(await enter.isDisabled(), 'WebGL indisponível neste navegador de teste.');
  await expect(page.getByText(/deite o aparelho e use a tela cheia/)).toBeVisible();
  await enter.click();
  const hint = page.getByRole('dialog', { name: 'Gire o celular' });
  await expect(hint).toBeVisible();
  await hint.getByRole('button', { name: 'Continuar assim' }).click();
  await expect(hint).toBeHidden();
  // A pé: joystick de movimento e botão de correr.
  await expect(page.getByRole('application', { name: /Controle de movimento/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Correr' })).toBeVisible();
  await page.waitForFunction(() => Boolean((window as UniverseWindow).__bzUniverse), undefined, { timeout: 30_000 });
  const state = () => page.evaluate(() => (window as UniverseWindow).__bzUniverse!.state());
  // Perto do carro, o botão da ação (o mesmo que a tecla E) entra nele.
  await page.evaluate(() => (window as UniverseWindow).__bzUniverse!.placeWalker(-8.6, 86, -Math.PI / 2));
  await page.getByRole('button', { name: /Entrar: Sedã Aurora/ }).click();
  const stage = page.locator('section[data-universe-stage]');
  await expect(stage).toHaveAttribute('data-player-mode', 'car', { timeout: 10_000 });
  // No carro: volante (o mesmo joystick), acelerador, freio e freio de mão.
  await expect(page.getByRole('application', { name: /volante/i })).toBeVisible();
  const gas = page.getByRole('button', { name: 'Acelerar' });
  await expect(gas).toBeVisible();
  await expect(page.getByRole('button', { name: 'Frear / ré' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Freio de mão' })).toBeVisible();
  // Segurar o acelerador move o carro.
  await gas.scrollIntoViewIfNeeded();
  const box = (await gas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(async () => aurora(await state()).speed, { timeout: 15_000 }).toBeGreaterThan(2);
  await page.mouse.up();
  await page.getByRole('button', { name: 'Sair do veículo' }).click();
  await expect(stage).toHaveAttribute('data-player-mode', 'foot', { timeout: 15_000 });
});
