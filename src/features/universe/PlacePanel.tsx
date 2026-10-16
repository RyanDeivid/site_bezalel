import { ArrowRight, Navigation } from 'lucide-react';
import { Link } from 'react-router';
import { usePreferences } from '@/app/preferences-context';
import { Button, ButtonLink } from '@/components/ui/Button';
import { universeContent } from './universe-content';
import type { PlaceId } from './world/city';
import { PRODUCTS, productText, type ProductGroup } from './world/products';

/**
 * O que se vê ao "entrar" num local: nome, descrição e as ações reais (links
 * do site). O mesmo conteúdo aparece no painel do modo 3D e nos cartões do
 * mapa 2D.
 */
export function PlaceBody({ id, facts, onFly }: { id: PlaceId; facts?: string; onFly?: () => void }) {
  const { m, locale } = usePreferences();
  const t = universeContent[locale];
  const place = t.places[id];
  const groups: ProductGroup[] = ['learn', 'intelligence'];
  return (
    <div className="space-y-5">
      <p className="text-fg-muted">{place.description}</p>
      {id === 'ai-lab' && facts && <p className="text-sm font-medium">{facts}</p>}
      {id === 'products-center' &&
        groups.map((g) => (
          <section key={g} aria-label={t.panel.products[g]}>
            <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-fg-subtle">{t.panel.products[g]}</h3>
            <ul className="mt-2 space-y-2">
              {PRODUCTS.filter((p) => p.group === g && p.status === 'live').map((p) => {
                const text = productText(p, m);
                return (
                  <li key={p.id}>
                    <Link to={p.route} className="group block rounded-xl border border-line p-3 transition-colors hover:border-accent/60">
                      <span className="flex items-center justify-between gap-2 font-medium group-hover:text-accent-text">
                        {text.title}
                        <ArrowRight aria-hidden className="size-4 shrink-0" />
                      </span>
                      <span className="mt-1 block text-sm text-fg-muted">{text.description}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      {(place.actions.length > 0 || onFly) && (
        <div className="flex flex-wrap gap-2">
          {place.actions.map((a, i) => (
            <ButtonLink key={a.to} to={a.to} variant={i === 0 ? 'primary' : 'secondary'} iconRight={i === 0 ? <ArrowRight className="size-4" /> : undefined}>
              {a.label}
            </ButtonLink>
          ))}
          {onFly && (
            <Button variant="ghost" onClick={onFly} iconLeft={<Navigation className="size-4" />}>
              {t.panel.flyHere}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
