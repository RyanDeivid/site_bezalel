import { FileText } from 'lucide-react';
import { useT } from '@/app/preferences-context';
import { PageHero } from '@/components/layout/PageHero';
import { Badge } from '@/components/ui/Badge';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

interface LegalContent {
  eyebrow: string;
  title: string;
  sections: Array<{ title: string; body: string[] }>;
}

/** Página legal preliminar: aviso de rascunho em destaque, sem entidade inventada. */
export function LegalPage({ content, meta, path }: { content: LegalContent; meta: { title: string; description: string }; path: string }) {
  const m = useT();
  useDocumentMeta({ title: meta.title, description: meta.description, path });
  return (
    <>
      <PageHero eyebrow={content.eyebrow} title={content.title} particles={false}>
        <Badge tone="warn" icon={<FileText />} size="md">
          {m.legal.draftBadge}
        </Badge>
      </PageHero>
      <div className="container-page grid grid-cols-1 gap-12 py-16 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <div className="sticky top-[calc(var(--header-h)+1.5rem)] rounded-xl border border-warn/35 bg-warn-soft p-5 text-sm leading-relaxed">
            <p>{m.legal.draftNotice}</p>
            <p className="mt-3 font-mono text-xs text-fg-subtle">{m.legal.updated}</p>
          </div>
        </aside>
        <div className="space-y-10 lg:col-span-8">
          {content.sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-xl font-semibold">{s.title}</h2>
              {s.body.map((p) => (
                <p key={p} className="mt-3 max-w-prose leading-relaxed text-fg-muted">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
