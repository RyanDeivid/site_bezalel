import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { curatedCourses } from '@/data/catalog/courses';
import { categories } from '@/data/catalog/taxonomy';
import { complementaryHours } from '@/domain/tools/hours';
import { escapeText, foldLine, MAX_SESSIONS, planSessions, toICS } from '@/domain/tools/ics';
import { EMPTY_SHELF, MAX_SAVED, parseShelf, progressOf, progressSummary, saveAll, serializeShelf, setProgress, toggleSaved } from '@/domain/tools/shelf';
import { buildTrail, statedHours, TRAIL_SIZE, trailCandidates, trailFromParams, trailQuery, type TrailAnswers } from '@/domain/tools/trail';
import { resetShelfCache, useShelf } from '@/hooks/useShelf';
import type { CategoryId, Course } from '@/types/domain';

const groupOf = (id: CategoryId) => categories.find((c) => c.id === id)!.group;
const published = curatedCourses.filter((c) => c.publicationStatus === 'published');
const answers = (patch: Partial<TrailAnswers> = {}): TrailAnswers => ({ group: 'tech', goal: 'start', pace: 5, freeOnly: false, certificate: false, portugueseOnly: false, ...patch });

describe('Minha estante', () => {
  it('salva, remove e marca progresso sem mutar o estado anterior', () => {
    const a = toggleSaved(EMPTY_SHELF, 'x');
    const b = toggleSaved(a, 'y');
    expect(b.saved).toEqual(['y', 'x']);
    expect(toggleSaved(b, 'x').saved).toEqual(['y']);
    const c = setProgress(b, 'x', 'done');
    expect(progressOf(c, 'x')).toBe('done');
    expect(progressOf(b, 'x')).toBe('todo');
    expect(setProgress(c, 'x', 'todo').progress).toEqual({});
    expect(progressSummary(setProgress(c, 'y', 'doing'), ['x', 'y', 'z'])).toEqual({ done: 1, doing: 1, total: 3 });
    expect(saveAll(b, ['x', 'z']).saved).toEqual(['z', 'y', 'x']);
  });

  it('lê com tolerância: lixo, duplicados e valores inválidos são descartados', () => {
    expect(parseShelf(null)).toEqual(EMPTY_SHELF);
    expect(parseShelf('{oops')).toEqual(EMPTY_SHELF);
    const shelf = parseShelf(JSON.stringify({ saved: ['a', 'a', 3, '', 'b'], progress: { a: 'done', b: 'weird', c: 'doing' } }));
    expect(shelf).toEqual({ saved: ['a', 'b'], progress: { a: 'done', c: 'doing' } });
    expect(parseShelf(serializeShelf(shelf))).toEqual(shelf);
    const many = Array.from({ length: MAX_SAVED + 50 }, (_, i) => `c${i}`);
    expect(parseShelf(JSON.stringify({ saved: many })).saved).toHaveLength(MAX_SAVED);
  });

  it('o hook grava no navegador e avisa os componentes', () => {
    resetShelfCache();
    const { result } = renderHook(() => useShelf());
    expect(result.current[0].saved).toEqual([]);
    act(() => result.current[1]((s) => toggleSaved(s, 'harvard-cs50x')));
    expect(result.current[0].saved).toEqual(['harvard-cs50x']);
    expect(parseShelf(localStorage.getItem('bz-shelf-v1')).saved).toEqual(['harvard-cs50x']);
    resetShelfCache();
  });
});

describe('Descubra sua trilha', () => {
  it('só usa cursos reais publicados que atendem às restrições', () => {
    const trail = buildTrail(answers({ freeOnly: true, certificate: true, portugueseOnly: true }), curatedCourses, groupOf);
    expect(trail.steps.length).toBeGreaterThan(0);
    for (const { course } of trail.steps) {
      expect(course.origin).toBe('curated');
      expect(course.publicationStatus).toBe('published');
      expect(groupOf(course.category)).toBe('tech');
      expect(['free', 'free-with-paid-certificate']).toContain(course.priceType);
      expect(course.certificateType && course.certificateType !== 'none-stated').toBeTruthy();
      expect(course.languages.some((l) => l.startsWith('pt'))).toBe(true);
    }
  });

  it('é determinística, do tamanho pedido e sem repetir cursos', () => {
    const a = buildTrail(answers(), curatedCourses, groupOf);
    const b = buildTrail(answers(), curatedCourses, groupOf);
    expect(a.steps.map((s) => s.course.id)).toEqual(b.steps.map((s) => s.course.id));
    expect(a.steps).toHaveLength(TRAIL_SIZE);
    expect(new Set(a.steps.map((s) => s.course.id)).size).toBe(TRAIL_SIZE);
  });

  it('para quem está começando, nada de intermediário antes de introdutório', () => {
    const trail = buildTrail(answers({ group: 'any', goal: 'start' }), curatedCourses, groupOf);
    const rank = { beginner: 0, 'all-levels': 1, unknown: 1, intermediate: 2, advanced: 3 } as const;
    const levels = trail.steps.map((s) => rank[s.course.level]);
    expect(levels).toEqual([...levels].sort((x, y) => x - y));
    expect(trail.steps[0]!.reasons).toContain('beginner');
  });

  it('explorar espalha a trilha por áreas diferentes', () => {
    const trail = buildTrail(answers({ group: 'any', goal: 'explore' }), curatedCourses, groupOf);
    expect(new Set(trail.steps.map((s) => s.course.category)).size).toBeGreaterThanOrEqual(3);
  });

  it('as contas usam só horas declaradas; o resto é contado como "não informado"', () => {
    const trail = buildTrail(answers({ group: 'any' }), curatedCourses, groupOf);
    const known = trail.steps.reduce((n, s) => n + (statedHours(s.course) ?? 0), 0);
    expect(trail.knownHours).toBe(known);
    expect(trail.unknownHours).toBe(trail.steps.filter((s) => statedHours(s.course) === null).length);
    expect(trail.weeks).toBe(known ? Math.ceil(known / 5) : null);
  });

  it('com restrições impossíveis devolve trilha vazia (sem inventar)', () => {
    const none = buildTrail(answers({ group: 'production', certificate: true, freeOnly: true }), [], groupOf);
    expect(none.steps).toEqual([]);
    expect(none.candidates).toBe(0);
    expect(trailCandidates(answers(), published, groupOf).every((c) => groupOf(c.category) === 'tech')).toBe(true);
  });

  it('vai e volta pelo endereço (trilha compartilhável) e ignora parâmetros estranhos', () => {
    const a = answers({ group: 'health', goal: 'certify', pace: 10, freeOnly: true, portugueseOnly: true });
    const query = trailQuery(a, ['x-1', 'y-2', 'Bad slug']);
    expect(query).toBe('t=health&g=certify&h=10&o=fp&c=x-1,y-2');
    expect(trailFromParams(new URLSearchParams(query))).toEqual({ answers: a, slugs: ['x-1', 'y-2'] });
    const weird = trailFromParams(new URLSearchParams('c=ok-1,<script>,BAD&t=zzz&g=nope&h=99'));
    expect(weird).toEqual({ answers: answers({ group: 'any' }), slugs: ['ok-1'] });
    expect(trailFromParams(new URLSearchParams('t=tech'))).toBeNull();
  });
});

describe('horas complementares', () => {
  const course = (patch: Partial<Course>) => ({ ...published[0]!, ...patch }) as Course;

  it('conta só carga em horas declarada E certificado confirmado', () => {
    const r = complementaryHours(
      [
        course({ id: 'a', duration: { value: 40, unit: 'hours' }, certificateType: 'free-certificate' }),
        course({ id: 'b', duration: { value: 30, unit: 'hours' }, certificateType: undefined }),
        course({ id: 'c', duration: { value: 6, unit: 'weeks' }, certificateType: 'free-certificate' }),
        course({ id: 'd', duration: undefined, certificateType: 'paid-certificate' }),
        course({ id: 'e', duration: { value: 20, unit: 'hours' }, certificateType: 'paid-certificate' }),
      ],
      100,
    );
    expect(r.lines.map((l) => l.status)).toEqual(['counted', 'no-certificate', 'no-hours', 'no-hours', 'counted']);
    expect(r.total).toBe(60);
    expect(r.remaining).toBe(40);
    expect(r.covered).toBeCloseTo(0.6);
  });

  it('meta inválida ou já cumprida não gera números estranhos', () => {
    const one = [course({ duration: { value: 50, unit: 'hours' }, certificateType: 'free-certificate' })];
    expect(complementaryHours(one, Number.NaN)).toMatchObject({ required: 0, remaining: 0, covered: 0 });
    expect(complementaryHours(one, 30)).toMatchObject({ remaining: 0, covered: 1 });
  });
});

describe('planejador de estudos (.ics)', () => {
  const items = [
    { id: 'a', title: 'Curso A', hours: 3, url: 'https://example.edu/a' },
    { id: 'b', title: 'Curso B', hours: 1, url: 'https://example.edu/b' },
  ];
  // Segunda-feira, 12/10/2026, hora local.
  const start = new Date(2026, 9, 12);

  it('distribui as sessões nos dias escolhidos, um curso depois do outro', () => {
    const s = planSessions(items, { start, weekdays: [1, 3], sessionMinutes: 90, time: '19:30' });
    expect(s).toHaveLength(3); // A: 2 sessões de 90 min; B: 1
    expect(s.map((x) => [x.courseId, x.index, x.total])).toEqual([
      ['a', 1, 2],
      ['a', 2, 2],
      ['b', 1, 1],
    ]);
    expect(s.map((x) => x.start.getDay())).toEqual([1, 3, 1]);
    expect(s[0]!.start.getHours()).toBe(19);
    expect(s[0]!.start.getMinutes()).toBe(30);
    expect(s[0]!.end.getTime() - s[0]!.start.getTime()).toBe(90 * 60_000);
    expect(s[2]!.start.getDate()).toBe(19);
  });

  it('sem dias ou sem cursos não há sessões; o total tem teto', () => {
    expect(planSessions(items, { start, weekdays: [], sessionMinutes: 60, time: '08:00' })).toEqual([]);
    const big = planSessions([{ id: 'x', title: 'X', hours: 10_000, url: '' }], { start, weekdays: [0, 1, 2, 3, 4, 5, 6], sessionMinutes: 60, time: '08:00' });
    expect(big).toHaveLength(MAX_SESSIONS);
  });

  it('gera um .ics válido: CRLF, escapes, linhas dobradas e um evento por sessão', () => {
    const s = planSessions([{ id: 'a', title: 'Ética, transparência; e mais', hours: 1, url: 'https://example.edu/a' }], { start, weekdays: [1], sessionMinutes: 60, time: '07:00' });
    const ics = toICS(s, {
      calendarName: 'Bezalel — estudos',
      summary: (x) => `Estudar: ${x.title} (${x.index}/${x.total})`,
      description: () => `Uma descrição bem longa para forçar a dobra da linha acima de setenta e cinco octetos — com acentuação: ação, coração.`,
      now: new Date(Date.UTC(2026, 9, 12, 12, 0, 0)),
    });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain('DTSTART:20261012T070000');
    expect(ics).toContain('DTEND:20261012T080000');
    expect(ics).toContain('DTSTAMP:20261012T120000Z');
    expect(ics).toContain('SUMMARY:Estudar: Ética\\, transparência\\; e mais (1/1)');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    // Desdobrar devolve o texto original.
    expect(ics.replace(/\r\n /g, '')).toContain('com acentuação: ação\\, coração.');
  });

  it('escape e dobra seguem a RFC 5545', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
    const folded = foldLine('X'.repeat(160));
    expect(folded.split('\r\n ').map((l) => l.length)).toEqual([75, 74, 11]);
  });
});
