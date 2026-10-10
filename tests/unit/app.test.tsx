import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { PreferencesProvider } from '@/app/PreferencesProvider';
import { routes } from '@/app/router';
import { ToastProvider } from '@/components/ui/Toast';
import { createLocalServices } from '@/services/local';
import { ServicesProvider } from '@/services/ServicesProvider';

function renderAt(path: string) {
  // Sem abertura animada da marca nos testes.
  window.sessionStorage.setItem('bz-intro-seen', '1');
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <PreferencesProvider>
      <ServicesProvider services={createLocalServices(new Date('2026-10-10T12:00:00Z'))}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ServicesProvider>
    </PreferencesProvider>,
  );
  return { ...utils, router };
}

describe('rotas', () => {
  it.each([
    ['/', /Inteligência para descobrir/],
    ['/explore', /Explore oportunidades/],
    ['/insights', /Competências observadas/],
    ['/agents', /Agentes especializados/],
    ['/lab', /O laboratório dos agentes/],
    ['/assistant', /^Sol$/],
    ['/about', /Conhecimento só se completa/],
    ['/methodology', /Como cada informação chega/],
    ['/privacy', /Política de privacidade/],
    ['/terms', /Termos de uso/],
    ['/rota-que-nao-existe', /Esta página não existe/],
  ])('%s renderiza o título principal', async (path, title) => {
    renderAt(path);
    expect(await screen.findByRole('heading', { level: 1, name: title }, { timeout: 12000 })).toBeInTheDocument();
  });

  it('a navegação principal leva às rotas', async () => {
    const user = userEvent.setup();
    const { router } = renderAt('/');
    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
    await user.click(within(nav).getByRole('link', { name: 'Agentes' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/agents'));
  });
});

describe('catálogo', () => {
  it('filtros modificam os resultados e a URL', async () => {
    const user = userEvent.setup();
    const { router } = renderAt('/explore');
    const heading = await screen.findByRole('heading', { name: /oportunidades/, level: 2 }, { timeout: 12000 });
    const total = Number(heading.textContent?.match(/\d+/)?.[0]);
    expect(total).toBe(19);

    const aside = screen.getByRole('complementary', { name: 'Filtros' });
    await user.click(within(aside).getByRole('button', { name: /Certificação/ }));
    await waitFor(() => expect(router.state.location.search).toContain('type=certification'));
    await waitFor(() => {
      const n = Number(screen.getByRole('heading', { name: /oportunidade/, level: 2 }).textContent?.match(/\d+/)?.[0]);
      expect(n).toBeLessThan(total);
    });
  });

  it('busca textual sem resultado mostra estado vazio', async () => {
    renderAt('/explore?q=zzzinexistente');
    expect(await screen.findByText('Nenhuma oportunidade encontrada', {}, { timeout: 12000 })).toBeInTheDocument();
  });

  it('detalhe mostra "Não informado" para campos que a fonte não declara', async () => {
    renderAt('/course/google-machine-learning-crash-course');
    expect(await screen.findByRole('heading', { level: 1, name: 'Machine Learning Crash Course' }, { timeout: 12000 })).toBeInTheDocument();
    expect(screen.getAllByText('Não informado').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Google for Developers — Machine Learning Crash Course/ })).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('detalhe de slug inexistente mostra estado de não encontrado', async () => {
    renderAt('/course/nao-existe');
    expect(await screen.findByText('Oportunidade não encontrada', {}, { timeout: 12000 })).toBeInTheDocument();
  });
});

describe('laboratório sem WebGL', () => {
  it('desativa o 3D e oferece uma versão 2D utilizável', async () => {
    const user = userEvent.setup();
    renderAt('/lab');
    expect(await screen.findByText(/WebGL indisponível/, {}, { timeout: 12000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar no laboratório 3D' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Abrir versão 2D' }));
    const scout = await screen.findByRole('button', { name: /Abrir estação Scout/ });
    await user.click(scout);
    expect(await screen.findByRole('heading', { name: 'Estação Scout' })).toBeInTheDocument();
    expect(screen.getAllByText(/Simulação local/).length).toBeGreaterThan(0);
  });
});

describe('agentes', () => {
  it('lista os cinco agentes, todos em modo demonstração', async () => {
    renderAt('/agents');
    for (const name of ['Scout', 'Verifier', 'Atlas', 'Trend', 'Sol']) {
      expect(await screen.findByRole('heading', { level: 3, name }, { timeout: 12000 })).toBeInTheDocument();
    }
    expect(screen.getAllByText('Demo').length).toBeGreaterThanOrEqual(5);
  });
});

describe('preferências', () => {
  it('alterna idioma para inglês', async () => {
    const user = userEvent.setup();
    renderAt('/about');
    await screen.findByRole('heading', { level: 1 }, { timeout: 12000 });
    await user.click(screen.getByRole('button', { name: 'Switch to English' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Knowledge is only complete/ })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });
});
