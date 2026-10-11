import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { loadCatalog } from '@/data/catalog/store';

// Os serviços locais leem o catálogo carregado sob demanda (como no navegador).
await loadCatalog();

// O jsdom não implementa algumas APIs de layout/gráficos usadas pela interface.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);
window.scrollTo = (() => {}) as typeof window.scrollTo;
Element.prototype.scrollTo = function scrollTo() {};
// Sem WebGL/Canvas no jsdom: getContext devolve null (os componentes tratam isso).
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
