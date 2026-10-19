import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Auditoria automática de acessibilidade (v2 · Fase 6): axe-core em todas as
 * rotas, nos dois temas e nos dois tamanhos de tela (projetos desktop e
 * mobile), mais os estados que só existem depois de uma interação (paleta,
 * menu, trilha pronta, competência aberta). Qualquer violação das regras WCAG
 * 2.2 A/AA falha o teste — com a lista do que corrigir na mensagem.
 *
 * O axe não substitui o teste com leitor de tela e teclado (ver
 * docs/ACCESSIBILITY.md); ele garante que o que já foi corrigido não volte.
 */

const ROUTES = [
  '',
  'explore/',
  'course/harvard-cs50x/',
  'trail/',
  'trail/?t=tech&g=start&h=5&c=kaggle-intro-to-machine-learning,enap-introducao-lgpd',
  'skills/',
  'skills/?skill=python&tema=tech',
  'saved/',
  'compare/?c=harvard-cs50x,kaggle-intro-to-machine-learning',
  'insights/',
  'agents/',
  'lab/',
  'universe/',
  'assistant/',
  'about/',
  'methodology/',
  'privacy/',
  'terms/',
  'nao-existe/',
];

const THEMES = ['dark', 'light'] as const;

async function audit(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    // O canvas 3D e o worker de partículas não têm DOM a auditar.
    .exclude('canvas')
    .analyze();
  const report = violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.slice(0, 4).map((n) => `   · ${n.target.join(' ')} — ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`).join('\n')}`);
  expect(report, `violações em ${label}`).toEqual([]);
}

async function ready(page: Page, path: string, theme: (typeof THEMES)[number]) {
  await page.addInitScript((t) => {
    localStorage.setItem('bz-theme', t);
    // Estante com um curso concluído e um salvo: as partes pessoais (estante,
    // "Continue de onde parou", constelação acesa) também são auditadas.
    localStorage.setItem('bz-shelf-v1', JSON.stringify({ v: 1, saved: ['crs-harvard-cs50x', 'crs-kaggle-intro-to-machine-learning'], progress: { 'crs-harvard-cs50x': 'done' } }));
  }, theme);
  await page.goto(path);
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.hydrated), undefined, { timeout: 20_000 });
  // As revelações ao rolar e as transições terminam antes da medição de contraste.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(400);
}

for (const theme of THEMES) {
  for (const path of ROUTES) {
    test(`a11y: /${path} — tema ${theme}`, async ({ page }) => {
      test.setTimeout(90_000);
      await ready(page, path, theme);
      await audit(page, `/${path} (${theme})`);
    });
  }

  test(`a11y: paleta Ctrl+K aberta — tema ${theme}`, async ({ page }) => {
    await ready(page, '', theme);
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('combobox')).toBeFocused();
    await page.keyboard.type('python');
    await expect(page.getByRole('option').first()).toBeVisible();
    await audit(page, `paleta (${theme})`);
  });

  test(`a11y: Universe — mapa da cidade (2D) — tema ${theme}`, async ({ page }) => {
    test.setTimeout(90_000);
    await ready(page, 'universe/', theme);
    await page.getByRole('button', { name: 'Ver o mapa da cidade' }).click();
    await expect(page.getByRole('group', { name: /Planta da primeira área/ })).toBeVisible();
    await audit(page, `Universe 2D (${theme})`);
  });

  test(`a11y: Universe — HUD do 3D e painel de um local — tema ${theme}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => localStorage.setItem('bz-universe-help-v2', 'seen'));
    await ready(page, 'universe/', theme);
    const enter = page.getByRole('button', { name: 'Explorar em 3D' });
    test.skip(await enter.isDisabled(), 'WebGL indisponível neste navegador de teste.');
    await enter.click();
    await expect(page.locator('section[data-universe-stage] canvas')).toBeVisible({ timeout: 30_000 });
    await audit(page, `Universe 3D HUD (${theme})`);
    await page.getByRole('button', { name: 'Locais' }).click();
    await page.getByRole('navigation', { name: 'Locais' }).getByRole('button', { name: /Centro de Produtos/ }).click();
    await expect(page.getByRole('dialog', { name: 'Centro de Produtos' })).toBeVisible();
    await audit(page, `Universe painel (${theme})`);
  });

  test(`a11y: menu do celular aberto — tema ${theme}`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'O menu só existe no celular.');
    await ready(page, '', theme);
    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await audit(page, `menu (${theme})`);
  });
}
