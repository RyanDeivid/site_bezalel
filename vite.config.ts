import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Base pública do site. No GitHub Pages de projeto o site vive em
 * `/<repositório>/` — o workflow de deploy injeta `VITE_BASE_PATH` a partir
 * de `actions/configure-pages`. Localmente o padrão é `/`.
 */
function normalizeBase(raw: string | undefined): string {
  if (!raw || raw === '/') return '/';
  const trimmed = raw.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}

export default defineConfig({
  base: normalizeBase(process.env.VITE_BASE_PATH),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    // O laboratório 3D (three + R3F) é carregado sob demanda em um chunk
    // próprio; o aviso padrão de 500 kB dispararia só por ele.
    chunkSizeWarningLimit: 1000,
  },
});
