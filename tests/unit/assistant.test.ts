import { describe, expect, it } from 'vitest';
import { createLocalServices } from '@/services/local';

const services = createLocalServices(new Date('2026-10-10T12:00:00Z'));
const ask = (q: string, locale: 'pt-BR' | 'en' = 'pt-BR') => services.assistant.ask(q, locale);

describe('assistente Sol (regras locais)', () => {
  it('declara que não há modelo de linguagem conectado', () => {
    expect(services.assistant.engine).toBe('local-rules');
  });

  it('saúda e explica capacidades', async () => {
    const r = await ask('Olá');
    expect(r.kind).toBe('greeting');
    expect(r.suggestions.length).toBeGreaterThan(0);
  });

  it('busca no catálogo aplicando filtros extraídos da pergunta', async () => {
    const r = await ask('cursos gratuitos de inteligência artificial para iniciantes');
    expect(r.kind).toBe('answer');
    expect(r.courses.length).toBeGreaterThan(0);
    for (const c of r.courses) {
      expect(['free', 'free-with-paid-certificate']).toContain(c.priceType);
      expect(c.category).toBe('ai-ml');
    }
    expect(r.sources.length).toBeGreaterThan(0);
    expect(r.suggestions[0]?.to).toMatch(/^\/explore\?/);
  });

  it('explica um curso específico citando a fonte e a conferência', async () => {
    const r = await ask('O CS50x tem certificado?');
    expect(r.courses[0]?.slug).toBe('harvard-cs50x');
    expect(r.paragraphs.join(' ')).toMatch(/Certificado/);
    expect(r.sources[0]?.url).toBe('https://cs50.harvard.edu/x/');
  });

  it('diz quando a fonte não informa um campo, em vez de supor', async () => {
    const r = await ask('Quanto custa o Machine Learning Crash Course?');
    expect(r.paragraphs.join(' ')).toMatch(/não informa/);
  });

  it('recusa aconselhamento de carreira, vagas e dados em tempo real', async () => {
    expect((await ask('Qual carreira devo seguir?')).kind).toBe('out-of-scope');
    expect((await ask('Quantas vagas existem para Python?')).kind).toBe('out-of-scope');
    expect((await ask('Quais as notícias de hoje?')).kind).toBe('out-of-scope');
  });

  it('informa dados insuficientes quando nada é encontrado', async () => {
    const r = await ask('curso de culinária molecular');
    expect(r.kind).toBe('insufficient-data');
    expect(r.courses).toHaveLength(0);
  });

  it('responde em inglês e expõe a regra usada', async () => {
    const r = await ask('free AI courses for beginners', 'en');
    expect(r.paragraphs[0]).toMatch(/verified catalog/);
    expect(r.rule).toMatch(/Local search/);
  });
});
