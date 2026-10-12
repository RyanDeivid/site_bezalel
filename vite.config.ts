import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Base pública do site. No GitHub Pages de projeto o site vive em
 * `/<repositório>/` — o workflow de deploy injeta `VITE_BASE_PATH` a partir
 * de `actions/configure-pages`. Localmente o padrão é `/`.
 */

export default defineConfig({
  base: '/site_bezalel/',
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
    rolldownOptions: {
      output: {
        codeSplitting: {
          // Tudo o que a primeira carga já importa estaticamente vai num pacote
          // só. Sem isto, cada módulo pequeno compartilhado com uma página
          // preguiçosa (preferências, taxonomia, formatação, ícones…) virava um
          // arquivo de 0,2–3 kB — e, no celular com rede lenta, cada arquivo a
          // mais na primeira carga custa uma ida e volta (medido: 5 a 11
          // requisições extras e LCP ~0,3 s pior). Páginas, catálogo e 3D
          // continuam em chunks próprios, baixados sob demanda.
          groups: [{ name: 'app', tags: ['$initial'] }],
        },
      },
    },
  },
});
