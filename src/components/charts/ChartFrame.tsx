import { Table2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ChartFrameProps {
  title: string;
  lead?: ReactNode;
  badge?: ReactNode;
  footer?: ReactNode;
  /** Visão em tabela equivalente — obrigatória: tooltips nunca são a única forma de ler um valor. */
  table: { label: string; head: string[]; rows: Array<Array<string | number>> };
  children: ReactNode;
  className?: string;
  demo?: boolean;
}

/** Moldura padrão de gráfico: título, contexto, gráfico e tabela acessível. */
export function ChartFrame({ title, lead, badge, footer, table, children, className, demo }: ChartFrameProps) {
  return (
    <figure className={cn('panel flex flex-col overflow-hidden', demo && 'border-demo/35', className)}>
      <figcaption className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          {lead && <p className="mt-1 text-sm text-fg-muted">{lead}</p>}
        </div>
        {badge}
      </figcaption>
      <div className={cn('relative px-3 pb-2 pt-5', demo && 'hatch-demo')}>{children}</div>
      <details className="group border-t border-line px-5 py-3 text-sm">
        <summary className="inline-flex cursor-pointer items-center gap-2 text-fg-muted hover:text-fg">
          <Table2 aria-hidden className="size-4" /> {table.label}
        </summary>
        <div className="mt-3 max-h-72 overflow-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wider text-fg-subtle">
              <tr>
                {table.head.map((h) => (
                  <th key={h} scope="col" className="py-2 pr-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={cn('py-2 pr-4', j === 0 ? 'text-fg' : 'text-fg-muted')}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {footer && <div className="border-t border-line px-5 py-3 text-xs text-fg-subtle">{footer}</div>}
    </figure>
  );
}

/** Tooltip escuro/claro coerente com os tokens. Texto sempre em cor de texto, nunca na cor da série. */
export function ChartTooltipBox({ title, rows }: { title: string; rows: Array<{ label: string; value: string | number; color?: string }> }) {
  return (
    <div className="min-w-40 rounded-lg border border-line-strong bg-bg-abyss/95 px-3 py-2 text-xs shadow-3 backdrop-blur">
      <p className="mb-1.5 font-medium text-fg">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-4 text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            {r.color && <span aria-hidden className="size-2 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="font-mono text-fg">{r.value}</span>
        </p>
      ))}
    </div>
  );
}
