import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@/styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não encontrado.');

// O HTML pré-gerado por rota (scripts/postbuild.ts) traz um resumo estático
// dentro de #root para robôs e navegação sem JavaScript; o React o substitui.
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
