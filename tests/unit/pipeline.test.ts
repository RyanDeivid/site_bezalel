import { describe, expect, it } from 'vitest';
import { buildDemoRawRecords, demoSources } from '@/data/demo/pipeline-fixtures';
import {
  assessQuality,
  canTransition,
  createDedupeIndex,
  findDuplicate,
  InvalidTransitionError,
  normalizeRecord,
  normalizeUrl,
  parseCertificate,
  parseDuration,
  parseLevel,
  parsePrice,
  registerInIndex,
  runPipeline,
  sanitizePlainText,
  transition,
  validateRecord,
  type RawRecord,
} from '@/domain/pipeline';

const NOW = new Date('2026-10-10T12:00:00Z');

const raw = (patch: Partial<RawRecord> = {}): RawRecord => ({
  sourceId: 'demo-src-aurora',
  url: 'https://aurora.example.org/c/1',
  title: 'Curso de Teste Completo',
  provider: 'Instituto Teste',
  description: 'Descrição longa o suficiente para passar no critério de tamanho mínimo da validação, com detalhes do conteúdo e da proposta pedagógica.',
  categoryHint: 'Dados',
  levelText: 'Iniciante',
  priceText: 'Gratuito',
  durationText: '10 horas',
  certificateText: 'Certificado gratuito',
  skills: ['python'],
  collectedAt: NOW.toISOString(),
  updatedAtSource: NOW.toISOString(),
  ...patch,
});

describe('normalização', () => {
  it('interpreta preços em texto livre', () => {
    expect(parsePrice('Gratuito').priceType).toBe('free');
    expect(parsePrice('Free').priceType).toBe('free');
    expect(parsePrice('Gratuito, certificado pago opcional').priceType).toBe('free-with-paid-certificate');
    expect(parsePrice('R$ 89,90')).toEqual({ priceType: 'paid', priceAmount: 89.9, currency: 'BRL' });
    expect(parsePrice('US$ 0')).toMatchObject({ priceType: 'free' });
    expect(parsePrice('Preço varia por país').priceType).toBe('varies');
    expect(parsePrice('Consulte').priceType).toBe('unknown');
    expect(parsePrice(undefined).priceType).toBe('unknown');
  });

  it('interpreta nível, duração e certificado sem inventar', () => {
    expect(parseLevel('Básico')).toBe('beginner');
    expect(parseLevel('Advanced')).toBe('advanced');
    expect(parseLevel('???')).toBe('unknown');
    expect(parseDuration('20h')).toEqual({ value: 20, unit: 'hours' });
    expect(parseDuration('6 semanas')).toEqual({ value: 6, unit: 'weeks' });
    expect(parseDuration('em breve')).toBeUndefined();
    expect(parseCertificate('Badge digital')).toBe('digital-badge');
    expect(parseCertificate('Certificado incluso')).toBeUndefined();
  });

  it('remove marcação e caracteres de controle de texto externo', () => {
    expect(sanitizePlainText('<b>Olá</b>\u0007 mundo  ')).toBe('Olá mundo');
  });

  it('marca registros com marcação executável', () => {
    const r = normalizeRecord(raw({ description: 'Texto <script>alert(1)</script> fim, com conteúdo suficiente para validar o tamanho mínimo.' }));
    expect(r.notes).toContain('unsafe-markup');
    expect(r.description).not.toMatch(/<script/);
  });
});

describe('deduplicação', () => {
  it('normaliza URLs: www, barra final, fragmento e rastreamento', () => {
    expect(normalizeUrl('https://www.Exemplo.org/curso/?utm_source=x&b=2&a=1#topo')).toBe('exemplo.org/curso?a=1&b=2');
    expect(normalizeUrl('http://exemplo.org/curso')).toBe(normalizeUrl('https://exemplo.org/curso/'));
    expect(normalizeUrl('https://exemplo.org/curso/index.html')).toBe('exemplo.org/curso');
  });

  it('detecta duplicatas por URL e por impressão digital', () => {
    const index = createDedupeIndex();
    const a = normalizeRecord(raw());
    registerInIndex(a, index);
    expect(findDuplicate(normalizeRecord(raw({ url: 'https://aurora.example.org/c/1/?utm_medium=email' })), index)?.reason).toBe('url');
    expect(findDuplicate(normalizeRecord(raw({ url: 'https://aurora.example.org/outra' })), index)?.reason).toBe('fingerprint');
    expect(findDuplicate(normalizeRecord(raw({ url: 'https://aurora.example.org/x', title: 'Outro título' })), index)).toBeNull();
  });
});

describe('validação e qualidade', () => {
  const source = demoSources[0];

  it('aprova um registro completo de fonte de demonstração no modo demo', () => {
    const rec = normalizeRecord(raw());
    const v = validateRecord(rec, { source, env: 'demo', now: NOW });
    expect(v.valid).toBe(true);
    const q = assessQuality(rec, v);
    expect(q.score).toBe(100);
    expect(q.meetsPublicationCriteria).toBe(true);
  });

  it('recusa fonte de demonstração em produção', () => {
    const v = validateRecord(normalizeRecord(raw()), { source, env: 'production', now: NOW });
    expect(v.failedBlocking).toContain('trusted-source');
  });

  it('recusa HTTP sem TLS, conteúdo inseguro e registros desatualizados', () => {
    const v1 = validateRecord(normalizeRecord(raw({ url: 'http://aurora.example.org/c/2' })), { source, env: 'demo', now: NOW });
    expect(v1.failedBlocking).toContain('https-url');
    const v2 = validateRecord(normalizeRecord(raw({ title: 'Curso <script>x</script>' })), { source, env: 'demo', now: NOW });
    expect(v2.failedBlocking).toContain('safe-content');
    const v3 = validateRecord(normalizeRecord(raw({ updatedAtSource: '2025-01-01T00:00:00Z' })), { source, env: 'demo', now: NOW });
    expect(v3.failedBlocking).toContain('fresh');
  });

  it('avisos reduzem a nota e podem impedir a publicação', () => {
    const rec = normalizeRecord(raw({ priceText: 'Consulte', description: 'Curta.', levelText: undefined, durationText: undefined, certificateText: undefined }));
    const v = validateRecord(rec, { source, env: 'demo', now: NOW });
    expect(v.valid).toBe(true);
    expect(v.warnings).toEqual(expect.arrayContaining(['price-declared', 'description-length']));
    expect(assessQuality(rec, v).meetsPublicationCriteria).toBe(false);
  });
});

describe('máquina de estados de publicação', () => {
  it('permite apenas transições explícitas', () => {
    expect(canTransition('found', 'validating')).toBe(true);
    expect(canTransition('found', 'published')).toBe(false);
    expect(transition(['found', 'validating'], 'approved')).toEqual(['found', 'validating', 'approved']);
    expect(() => transition(['found'], 'published')).toThrow(InvalidTransitionError);
    expect(() => transition(['removed'], 'validating')).toThrow(InvalidTransitionError);
  });
});

describe('execução do pipeline (fixtures de demonstração)', () => {
  const run = () =>
    runPipeline({ runId: 't', environmentMode: 'demo', now: NOW, sources: demoSources, collected: buildDemoRawRecords(NOW) });

  it('é determinística', () => {
    expect(run()).toEqual(run());
  });

  it('produz cada resultado pelas regras, não por sorteio', () => {
    const byTitle = Object.fromEntries(run().outcomes.map((o) => [o.record.title + (o.duplicateOf ? ' (dup)' : ''), o]));
    expect(byTitle['Fundamentos de Análise de Dados com Python']?.status).toBe('published');
    expect(byTitle['Introdução a Redes Neurais']?.status).toBe('published');
    expect(byTitle['Análise de Dados com Python — turma de outubro (dup)']?.duplicateOf?.reason).toBe('url');
    expect(byTitle['Segurança da Informação Essencial (dup)']?.duplicateOf?.reason).toBe('fingerprint');
    expect(byTitle['Oficina de Escrita de Prompts']?.validation?.failedBlocking).toContain('https-url');
    expect(byTitle['Governança de Dados no Setor Público']?.validation?.failedBlocking).toContain('fresh');
    expect(byTitle['Automação de Tarefas com Scripts']?.validation?.failedBlocking).toContain('safe-content');
    expect(byTitle['Desenvolvimento Web Moderno']?.status).toBe('rejected');
  });

  it('nunca consulta fontes sem permissão', () => {
    expect(run().events.some((e) => e.entityId === 'demo-src-sem-permissao')).toBe(false);
  });

  it('registra falha de fonte e segue com as demais', () => {
    const r = runPipeline({
      runId: 'f',
      environmentMode: 'demo',
      now: NOW,
      sources: demoSources,
      collected: buildDemoRawRecords(NOW),
      failedSources: new Set(['demo-src-meridiano']),
    });
    expect(r.events.some((e) => e.type === 'agent.error' && e.entityId === 'demo-src-meridiano')).toBe(true);
    expect(r.outcomes.some((o) => o.record.sourceId === 'demo-src-meridiano')).toBe(false);
    expect(r.outcomes.some((o) => o.status === 'published')).toBe(true);
  });

  it('todo registro publicado passou por descoberta, validação e aprovação', () => {
    const r = run();
    for (const o of r.outcomes.filter((x) => x.status === 'published')) {
      expect(o.history).toEqual(['found', 'validating', 'approved', 'published']);
      const types = r.events.filter((e) => e.entityId === o.record.key).map((e) => e.type);
      expect(types.indexOf('opportunity.discovered')).toBeLessThan(types.indexOf('validation.started'));
      expect(types.indexOf('validation.passed')).toBeLessThan(types.indexOf('record.published'));
    }
  });
});
