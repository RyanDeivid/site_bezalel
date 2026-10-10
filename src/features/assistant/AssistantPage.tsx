import { ArrowUpRight, Check, ChevronDown, CircleOff, RotateCcw, Send, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { AGENT_COLOR, AgentGlyph } from '@/components/agents/AgentGlyph';
import { OriginBadge } from '@/components/data/DataBadges';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ExternalLink } from '@/components/ui/ExternalLink';
import { ProcessingIndicator } from '@/components/ui/StateView';
import { coursePath, priceLabel } from '@/features/catalog/present';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { cn } from '@/lib/cn';
import { useServices } from '@/services/context';
import type { AssistantReply } from '@/services/types';

type Message = { id: number; role: 'user'; text: string } | { id: number; role: 'sol'; reply: AssistantReply } | { id: number; role: 'error'; text: string };

function SolReply({ reply }: { reply: AssistantReply }) {
  const { m, locale } = usePreferences();
  const s = m.assistant;
  return (
    <div className="space-y-3">
      {(reply.kind === 'insufficient-data' || reply.kind === 'out-of-scope') && (
        <Badge tone="warn" icon={<CircleOff />}>
          {reply.kind === 'insufficient-data' ? s.insufficient : s.outOfScope}
        </Badge>
      )}
      {reply.paragraphs.map((p) => (
        <p key={p} className="leading-relaxed">
          {p}
        </p>
      ))}
      {reply.courses.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {reply.courses.map((c) => (
            <li key={c.id}>
              <Link to={coursePath(c)} className="group flex h-full flex-col rounded-xl border border-line bg-bg/60 p-3 transition-colors hover:border-accent/50">
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium group-hover:text-accent-text">{c.title}</span>
                  <ArrowUpRight aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                </span>
                <span className="mt-1 text-xs text-fg-muted">{c.provider.name}</span>
                <span className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <OriginBadge origin={c.origin} />
                  <span className="text-fg-muted">{priceLabel(c, m, locale)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {reply.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {reply.suggestions.map((sg) => (
            <Link key={sg.to + sg.label} to={sg.to} className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-xs text-fg hover:border-accent">
              {sg.label} <ArrowUpRight aria-hidden className="size-3" />
            </Link>
          ))}
        </div>
      )}
      {reply.sources.length > 0 && (
        <div className="text-xs text-fg-subtle">
          <span className="font-mono uppercase tracking-wider">{s.sources}: </span>
          {reply.sources.map((src, i) => (
            <span key={src.url}>
              {i > 0 && ' · '}
              <ExternalLink href={src.url} className="text-fg-muted hover:text-accent-text">
                {src.name}
              </ExternalLink>
            </span>
          ))}
        </div>
      )}
      <details className="group text-xs text-fg-subtle">
        <summary className="inline-flex cursor-pointer items-center gap-1 hover:text-fg">
          <ChevronDown aria-hidden className="size-3 transition-transform group-open:rotate-180" /> {s.howGenerated}
        </summary>
        <p className="mt-1.5 rounded-md border border-line bg-bg/50 px-2.5 py-1.5 font-mono">{reply.rule}</p>
      </details>
    </div>
  );
}

export default function AssistantPage() {
  const { m, locale } = usePreferences();
  const s = m.assistant;
  const services = useServices();
  const [params, setParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useDocumentMeta({ title: m.meta.assistant.title, description: m.meta.assistant.description, path: '/assistant' });

  async function ask(question: string) {
    const q = question.trim().slice(0, 500);
    if (!q || busy) return;
    seq.current += 1;
    const userMsg: Message = { id: seq.current, role: 'user', text: q };
    setMessages((list) => [...list, userMsg]);
    setInput('');
    setBusy(true);
    try {
      // Pausa curta e honesta: o indicador mostra que a consulta está acontecendo.
      const [reply] = await Promise.all([services.assistant.ask(q, locale), new Promise((r) => setTimeout(r, 350))]);
      seq.current += 1;
      setMessages((list) => [...list, { id: seq.current, role: 'sol', reply }]);
    } catch {
      seq.current += 1;
      setMessages((list) => [...list, { id: seq.current, role: 'error', text: s.error }]);
    } finally {
      setBusy(false);
    }
  }

  // Pergunta vinda de outra página (?q=...), ex.: "Perguntar ao Sol sobre este curso".
  const initial = useRef(params.get('q'));
  useEffect(() => {
    const q = initial.current;
    if (!q) return;
    initial.current = null;
    setParams({}, { replace: true });
    void ask(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  const llm = services.assistant.engine === 'llm-backend';

  return (
    <div className="container-page grid grid-cols-1 gap-8 py-10 lg:grid-cols-12 lg:py-14">
      <aside className="space-y-5 lg:col-span-4">
        <div className="page-enter">
          <p className="eyebrow">{s.eyebrow}</p>
          <div className="mt-5 flex items-center gap-4">
            <span className="relative grid size-16 place-items-center rounded-2xl border" style={{ color: AGENT_COLOR.sol, borderColor: AGENT_COLOR.sol }}>
              <span aria-hidden className="absolute inset-0 rounded-2xl opacity-25 blur-xl" style={{ background: AGENT_COLOR.sol }} />
              <AgentGlyph agent="sol" className="relative size-8" />
            </span>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">{s.title}</h1>
              <Badge tone={llm ? 'info' : 'accent'} className="mt-1.5">
                {llm ? s.llmBadge : s.engineBadge}
              </Badge>
            </div>
          </div>
          <p className="mt-5 text-fg-muted">{s.lead}</p>
        </div>
        {!llm && <p className="rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-fg-muted">{s.engineNote}</p>}
        <div className="panel p-5">
          <h2 className="text-sm font-semibold">{s.canTitle}</h2>
          <ul className="mt-3 space-y-2">
            {s.can.map((c) => (
              <li key={c} className="flex items-start gap-2.5 text-sm text-fg-muted">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-ok" />
                {c}
              </li>
            ))}
          </ul>
          <h2 className="mt-5 text-sm font-semibold">{s.cannotTitle}</h2>
          <ul className="mt-3 space-y-2">
            {s.cannot.map((c) => (
              <li key={c} className="flex items-start gap-2.5 text-sm text-fg-muted">
                <CircleOff aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section aria-label={s.title} className="flex min-h-[70dvh] flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:col-span-8">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <span className="flex items-center gap-2 text-sm text-fg-muted">
            <span className="status-pulse size-2 rounded-full bg-ok text-ok" aria-hidden />
            {s.sol}
          </span>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setMessages([])} iconLeft={<RotateCcw className="size-3.5" />}>
              {s.clear}
            </Button>
          )}
        </div>

        <div ref={listRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-6 md:px-6" aria-live="polite" aria-busy={busy}>
          <div className="flex gap-3">
            <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg border border-line" style={{ color: AGENT_COLOR.sol }}>
              <AgentGlyph agent="sol" className="size-4" />
            </span>
            <div className="max-w-[44rem] rounded-2xl rounded-tl-sm border border-line bg-surface-2 px-4 py-3 text-sm">{s.welcome}</div>
          </div>
          {messages.map((msg) =>
            msg.role === 'user' ? (
              <div key={msg.id} className="page-enter flex justify-end">
                <p className="max-w-[36rem] rounded-2xl rounded-tr-sm bg-accent px-4 py-2.5 text-sm text-accent-fg">
                  <span className="sr-only">{s.you}: </span>
                  {msg.text}
                </p>
              </div>
            ) : (
              <div key={msg.id} className="page-enter flex gap-3">
                <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg border border-line" style={{ color: AGENT_COLOR.sol }}>
                  <AgentGlyph agent="sol" className="size-4" />
                </span>
                <div className={cn('min-w-0 max-w-[44rem] flex-1 rounded-2xl rounded-tl-sm border px-4 py-3 text-sm', msg.role === 'error' ? 'border-danger/40 bg-danger-soft' : 'border-line bg-surface-2')}>
                  <span className="sr-only">{s.sol}: </span>
                  {msg.role === 'sol' ? <SolReply reply={msg.reply} /> : msg.text}
                </div>
              </div>
            ),
          )}
          {busy && (
            <div className="flex gap-3">
              <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg border border-line" style={{ color: AGENT_COLOR.sol }}>
                <AgentGlyph agent="sol" className="size-4" />
              </span>
              <ProcessingIndicator label={s.thinking} className="py-2" />
            </div>
          )}
        </div>

        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-3 md:px-6">
            {s.starters.map((st) => (
              <button key={st} type="button" onClick={() => void ask(st)} className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs text-fg-muted transition-colors hover:border-accent/50 hover:text-fg">
                <Sparkles aria-hidden className="size-3 text-accent-text" />
                {st}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit} className="border-t border-line p-3 md:p-4">
          <label htmlFor="sol-input" className="sr-only">
            {s.inputLabel}
          </label>
          <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-bg/60 p-2 focus-within:border-accent/60">
            <textarea
              ref={inputRef}
              id="sol-input"
              rows={1}
              value={input}
              maxLength={500}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void ask(input);
                }
              }}
              placeholder={s.placeholder}
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm focus:outline-none"
            />
            <Button type="submit" disabled={!input.trim() || busy} iconRight={<Send className="size-4" />}>
              {s.send}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
