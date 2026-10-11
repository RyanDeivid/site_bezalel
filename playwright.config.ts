import { defineConfig, devices } from '@playwright/test';

/**
 * Testes de navegador. Rodam contra o build de produção servido em
 * subdiretório (`/site_bezalel/`) — o mesmo cenário do GitHub Pages.
 *
 * Localmente usamos o Edge/Chrome já instalado (`PW_CHANNEL`, padrão
 * `msedge`), sem baixar navegadores. No CI o workflow instala o Chromium do
 * Playwright e define `PW_CHANNEL=chromium`.
 */
const channel = process.env.PW_CHANNEL ?? 'msedge';
const base = '/site_bezalel/';
const port = 4173;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // A home tem cena 3D e páginas pesadas: mais navegadores em paralelo só
  // disputam CPU (sem placa de vídeo, o WebGL do teste roda em software).
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}${base}`,
    trace: 'retain-on-failure',
    ...(channel === 'chromium' ? {} : { channel }),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...(channel === 'chromium' ? {} : { channel }) } },
    { name: 'mobile', use: { ...devices['Pixel 7'], ...(channel === 'chromium' ? {} : { channel }) } },
  ],
  webServer: {
    command: `npx vite preview --base ${base} --port ${port} --strictPort`,
    url: `http://localhost:${port}${base}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
