import { ArrowLeft, ArrowRight, ArrowUpRight, Check, MessageCircle, Pause, Play, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { AGENT_COLOR } from '@/components/agents/AgentGlyph';
import { Button, IconButton } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { skillName } from '@/data/catalog/store';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { normalizeText } from '@/lib/text';
import type { AgentId, Course } from '@/types/domain';
import { coursePath } from '../catalog/present';
import { journeyContent } from './journey-content';
import type { CourseFacts, JourneyKind } from './journey';
import type { Place } from './layout';

export interface LiveMetric {
  label: string;
  value: string;
  detail: string;
}

interface JourneyPanelProps {
  kind: JourneyKind;
  step: number;
  total: number;
  place: Place;
  arrived: boolean;
  playing: boolean;
  course?: Course;
  facts?: CourseFacts;
  /** Indicador ao vivo do setor (tour). */
  live?: LiveMetric | null;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
  onTogglePlay: () => void;
  onOpenStation: (id: AgentId) => void;
  className?: string;
}

/** Texto de uma parada do "seguir um curso", montado com os dados reais do registro. */
function CourseStop({ place, facts, course }: { place: Place; facts: CourseFacts; course: Course }) {
  const { m, locale } = usePreferences();
  const f = journeyContent[locale].follow;
  const list = (fields: string[]) => fields.map((x) => f.fields[x as keyof typeof f.fields]).join(', ');
  const date = (iso: string) => formatDate(iso, locale) ?? iso;
  const lines: ReactNode[] = [];
  switch (place) {
    case 'scout':
      lines.push(f.source(facts.source.provider, facts.source.sourceName, facts.source.host));
      break;
    case 'verifier':
      lines.push(f.verified(m.enums.verificationStatus[facts.verify.status], date(facts.verify.checkedAt)));
      if (facts.verify.stated.length) lines.push(f.stated(list(facts.verify.stated)));
      if (facts.verify.inferred.length) lines.push(f.inferred(list(facts.verify.inferred)));
      if (facts.verify.missing.length) lines.push(f.missing(list(facts.verify.missing)));
      break;
    case 'hub':
      lines.push(facts.publish.published ? f.published(m.enums.category[facts.publish.category]) : f.notPublished);
      break;
    case 'atlas':
      lines.push(f.skills(facts.skills.length, facts.skills.map((s) => skillName(s.id, locale)).join(', ')));
      break;
    case 'trend': {
      const top = facts.skills[0];
      lines.push(top ? f.trend(skillName(top.id, locale), top.courses) : f.trendNone);
      break;
    }
    case 'vigia':
      lines.push(f.recheck(date(facts.recheck.dueAt), facts.recheck.daysLeft));
      break;
    case 'sol':
      lines.push(f.ask);
      break;
  }
  return (
    <>
      {lines.map((l, i) => (
        <p key={i} className="mt-1.5 text-sm leading-relaxed text-fg-muted">
          {l}
        </p>
      ))}
      {place === 'sol' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={`/assistant?q=${encodeURIComponent(facts.ask.query)}`} className="inline-flex items-center gap-1.5 text-sm text-accent-text hover:underline">
            <MessageCircle aria-hidden className="size-3.5" /> {f.askSol}
          </Link>
          <Link to={coursePath(course)} className="inline-flex items-center gap-1.5 text-sm text-accent-text hover:underline">
            <ArrowUpRight aria-hidden className="size-3.5" /> {f.openCourse}
          </Link>
        </div>
      )}
    </>
  );
}

/**
 * Painel de uma jornada guiada: em que parada estamos, o que acontece ali e
 * os controles (anterior, próxima, avançar sozinho, sair). O conteúdo é uma
 * região viva — leitores de tela anunciam cada parada.
 */
export function JourneyPanel(props: JourneyPanelProps) {
  const { kind, step, total, place, arrived, playing, course, facts, live } = props;
  const { m, locale } = usePreferences();
  const jc = journeyContent[locale];
  const text = kind === 'tour' ? jc.tour : jc.follow;
  const stop = text.stops[place];
  const last = step === total - 1;
  const accent = place === 'hub' ? 'var(--accent)' : AGENT_COLOR[place];
  // O botão que iniciou a jornada some: o foco do teclado vem para o painel.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label={text.region}
      className={cn('glass rounded-2xl border-t-2 p-4 shadow-3 outline-none', props.className)}
      style={{ borderTopColor: accent }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-accent-text">
            {text.eyebrow} · {jc.step(step + 1, total)}
          </p>
          {kind === 'course' && course && <p className="mt-1 truncate text-sm font-medium">{course.title}</p>}
        </div>
        <IconButton label={jc.exit} size="sm" onClick={props.onExit}>
          <X className="size-4" />
        </IconButton>
      </div>

      <div aria-live="polite" className="mt-2">
        <h2 className="text-lg font-semibold">{stop.title}</h2>
        {kind === 'tour' ? <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{jc.tour.stops[place].text}</p> : facts && course && <CourseStop place={place} facts={facts} course={course} />}
        {kind === 'tour' && live && (
          <p className="mt-2 rounded-lg border border-line bg-bg/40 px-3 py-2 text-xs text-fg-muted">
            <span className="font-mono uppercase tracking-wider text-fg-subtle">{jc.tour.live}</span> · {live.label}: <span className="font-mono text-fg">{live.value}</span> — {live.detail}
          </p>
        )}
        {kind === 'course' && <p className="mt-2 text-xs text-fg-subtle">{jc.follow.note}</p>}
      </div>

      {/* Progresso: uma marca por parada */}
      <ol aria-hidden className="mt-3 flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <li key={i} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-accent' : 'bg-line-strong')} />
        ))}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <IconButton label={jc.prev} size="sm" onClick={props.onPrev} disabled={step === 0} className="border-line">
          <ArrowLeft className="size-4" />
        </IconButton>
        {kind === 'tour' && (
          <IconButton label={playing ? jc.pause : jc.play} size="sm" onClick={props.onTogglePlay} active={playing} className="border-line">
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </IconButton>
        )}
        <Button size="sm" onClick={props.onNext} iconRight={last ? <Check className="size-4" /> : <ArrowRight className="size-4" />}>
          {last ? jc.finish : jc.next}
        </Button>
        {place !== 'hub' && (
          <Button size="sm" variant="ghost" onClick={() => props.onOpenStation(place)}>
            {m.lab.hud.openStation(place[0]!.toUpperCase() + place.slice(1))}
          </Button>
        )}
        {!arrived && <span className="text-xs text-fg-subtle">{jc.walking}</span>}
      </div>
      <p className="mt-2 hidden text-[0.7rem] text-fg-subtle md:block">{jc.keys}</p>
    </section>
  );
}

/** Escolha do curso a seguir: busca simples (título e instituição) no catálogo verificado. */
export function CoursePicker({ open, courses, onClose, onPick }: { open: boolean; courses: Course[]; onClose: () => void; onPick: (course: Course) => void }) {
  const { locale } = usePreferences();
  const f = journeyContent[locale].follow;
  const [query, setQuery] = useState('');
  const limit = 12;
  const matches = useMemo(() => {
    const terms = normalizeText(query).split(' ').filter(Boolean);
    return courses.filter((c) => {
      const hay = normalizeText(`${c.title} ${c.provider.name}`);
      return terms.every((t) => hay.includes(t));
    });
  }, [courses, query]);
  return (
    <Dialog open={open} onClose={onClose} title={f.pickTitle} description={f.pickLead}>
      <label className="block text-sm text-fg-muted">
        {f.search}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-1 block h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-fg"
          autoComplete="off"
        />
      </label>
      <ul className="mt-4 max-h-[50vh] space-y-1 overflow-y-auto">
        {matches.slice(0, limit).map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onPick(c)} className="w-full rounded-lg px-3 py-2 text-left hover:bg-surface-2 focus-visible:bg-surface-2">
              <span className="block truncate text-sm font-medium">{c.title}</span>
              <span className="block truncate text-xs text-fg-muted">{c.provider.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {!matches.length && <p className="mt-2 text-sm text-fg-subtle">{f.empty}</p>}
      {matches.length > limit && <p className="mt-2 text-xs text-fg-subtle">{f.more(matches.length - limit)}</p>}
    </Dialog>
  );
}
