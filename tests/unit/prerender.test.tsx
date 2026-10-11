import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@/entry-server';
import { useAsync } from '@/hooks/useAsync';
import { combine, peek, resolved } from '@/lib/sync-promise';
import { createLocalServices } from '@/services/local';
import { ServicesProvider } from '@/services/ServicesProvider';

const base = import.meta.env.BASE_URL;
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

describe('promessas legíveis na hora (lib/sync-promise)', () => {
  it('resolved é uma Promise comum e expõe o valor de forma síncrona', async () => {
    const p = resolved(42);
    expect(peek(p)).toEqual({ value: 42 });
    await expect(p).resolves.toBe(42);
  });

  it('promessas comuns não têm valor síncrono', () => {
    expect(peek(Promise.resolve(1))).toBeUndefined();
  });

  it('combine preserva a leitura síncrona só quando todas as entradas a têm', async () => {
    const both = combine([resolved(2), resolved(3)] as const, ([a, b]) => a * b);
    expect(peek(both)).toEqual({ value: 6 });
    const mixed = combine([resolved(2), Promise.resolve(3)] as const, ([a, b]) => a * b);
    expect(peek(mixed)).toBeUndefined();
    await expect(mixed).resolves.toBe(6);
  });
});

describe('useAsync com serviços locais', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <ServicesProvider services={createLocalServices(new Date('2026-10-10T12:00:00Z'))}>{children}</ServicesProvider>;

  it('entrega o dado já no primeiro render, sem estado de carregamento', () => {
    const { result } = renderHook(() => useAsync(() => resolved('pronto'), []), { wrapper });
    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe('pronto');
  });

  it('com promessa assíncrona continua passando por "loading"', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve('depois'), []), { wrapper });
    expect(result.current.status).toBe('loading');
    await expect.poll(() => result.current.status).toBe('success');
  });
});

describe('pré-renderização (entry-server)', () => {
  it('a home sai com título, busca e seções — sem depender de JavaScript', async () => {
    const html = await render(base);
    expect(html).not.toBeNull();
    const t = text(html!);
    expect(t).toContain('Inteligência para descobrir o que vale aprender');
    expect(html).toContain('role="search"');
    expect(t).toContain('Explore por área');
    // A história da Forja também está no HTML (leitores de tela, busca, sem JS).
    expect(t).toContain('Tudo começa espalhado.');
    expect(t).toContain('Só o que é confirmado vira estrutura.');
    // Dados do catálogo já presentes (não um esqueleto de carregamento).
    expect(t).toMatch(/\d+ registros?/);
  });

  it('a página de um curso traz os dados verificados no HTML', async () => {
    const html = await render(`${base}course/harvard-cs50x/`);
    const t = text(html!);
    expect(t).toContain("CS50's Introduction to Computer Science");
    expect(t).toContain('Harvard University');
    expect(t).not.toContain('Carregando');
  });

  it('o catálogo pré-renderizado lista cursos', async () => {
    const html = await render(`${base}explore/`);
    expect(text(html!)).toContain('CS50');
  });
});
