import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { PreferencesProvider } from '@/app/PreferencesProvider';
import { curatedCourses } from '@/data/catalog/courses';
import { categories } from '@/data/catalog/taxonomy';
import { serializeShelf } from '@/domain/tools/shelf';
import { buildTrail, LAST_TRAIL_KEY, trailQuery, type TrailAnswers } from '@/domain/tools/trail';
import ContinueSection from '@/features/home/ContinueSection';
import { ProgressControl } from '@/features/tools/parts';
import { resetShelfCache } from '@/hooks/useShelf';
import type { CategoryId } from '@/types/domain';

/** Fase 5 — psicologia aplicada com ética (docs/ETHICS.md). */

const groupOf = (id: CategoryId) => categories.find((c) => c.id === id)!.group;
const answers: TrailAnswers = { group: 'tech', goal: 'start', pace: 5, freeOnly: false, certificate: false, portugueseOnly: false };
const course = (slug: string) => curatedCourses.find((c) => c.slug === slug)!;

const wrap = (ui: React.ReactNode) =>
  render(
    <PreferencesProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </PreferencesProvider>,
  );

beforeEach(() => resetShelfCache());

describe('pico-final: o próximo passo depois de concluir a trilha', () => {
  it('a trilha seguinte não repete os cursos já feitos', () => {
    const first = buildTrail(answers, curatedCourses, groupOf);
    const done = new Set(first.steps.map((s) => s.course.id));
    const next = buildTrail({ ...answers, goal: 'deepen' }, curatedCourses, groupOf, 4, done);
    expect(next.steps.length).toBeGreaterThan(0);
    for (const s of next.steps) expect(done.has(s.course.id)).toBe(false);
  });

  it('concluir um curso é reconhecido na hora — e só quando o visitante acabou de marcar', async () => {
    const user = userEvent.setup();
    const c = course('kaggle-intro-to-machine-learning');
    wrap(<ProgressControl course={c} />);
    expect(screen.getByRole('status')).toHaveTextContent('');
    await user.click(screen.getByLabelText('Concluído'));
    expect(screen.getByRole('status')).toHaveTextContent('mais uma peça da sua construção');
    await user.click(screen.getByLabelText('Em andamento'));
    expect(screen.getByRole('status')).toHaveTextContent('');
  });
});

describe('gradiente de meta: "continue de onde parou"', () => {
  it('quem chega pela primeira vez não vê nada (nada inventado para parecer ativo)', () => {
    const { container } = wrap(<ContinueSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('quem volta vê o curso em andamento e quanto falta da trilha — com os dados que marcou', () => {
    const a = course('kaggle-intro-to-machine-learning');
    const b = course('enap-introducao-lgpd');
    const c = course('linux-foundation-lfs101-introduction-to-linux');
    localStorage.setItem('bz-shelf-v1', serializeShelf({ saved: [a.id], progress: { [a.id]: 'done', [b.id]: 'doing' } }));
    localStorage.setItem(LAST_TRAIL_KEY, trailQuery(answers, [a.slug, b.slug, c.slug]));
    wrap(<ContinueSection />);
    expect(screen.getByRole('heading', { name: 'Continue de onde parou' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: b.title })).toHaveAttribute('href', `/course/${b.slug}`);
    expect(screen.getByText('Sua trilha: 1 de 3 concluídos · faltam 2')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progresso da sua trilha' })).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('link', { name: 'Voltar à trilha' })).toHaveAttribute('href', `/trail?${trailQuery(answers, [a.slug, b.slug, c.slug])}`);
    expect(screen.getByRole('link', { name: /Minha estante \(1\)/ })).toBeInTheDocument();
  });
});
