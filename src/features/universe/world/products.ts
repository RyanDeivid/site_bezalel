import type { Messages } from '@/i18n';

/**
 * Produtos apresentados no Centro de Produtos do Universe.
 *
 * Só entra aqui o que existe e funciona neste site: cada produto aponta para
 * uma rota real e usa o título e a descrição que a própria página já declara
 * (`messages.meta`), para que o Universe nunca diga algo diferente do produto.
 *
 * Para cadastrar um produto novo: crie a página (rota + `meta` no i18n) e
 * acrescente uma entrada abaixo. `status: 'live'` é o único estado usado hoje;
 * `'planned'` existe para quando houver anúncios oficiais — nunca para
 * inventar produto.
 */

type MetaKey = keyof Messages['meta'];

export type ProductId = 'catalog' | 'trail' | 'skills' | 'shelf' | 'compare' | 'insights' | 'assistant' | 'lab';
export type ProductGroup = 'learn' | 'intelligence';

export interface ProductEntry {
  id: ProductId;
  route: string;
  /** De onde vêm o nome e a descrição (os metadados da própria página). */
  meta: Extract<MetaKey, 'explore' | 'trail' | 'skills' | 'saved' | 'compare' | 'insights' | 'assistant' | 'lab'>;
  group: ProductGroup;
  status: 'live' | 'planned';
}

export const PRODUCTS: ProductEntry[] = [
  { id: 'catalog', route: '/explore', meta: 'explore', group: 'learn', status: 'live' },
  { id: 'trail', route: '/trail', meta: 'trail', group: 'learn', status: 'live' },
  { id: 'skills', route: '/skills', meta: 'skills', group: 'learn', status: 'live' },
  { id: 'shelf', route: '/saved', meta: 'saved', group: 'learn', status: 'live' },
  { id: 'compare', route: '/compare', meta: 'compare', group: 'learn', status: 'live' },
  { id: 'insights', route: '/insights', meta: 'insights', group: 'intelligence', status: 'live' },
  { id: 'assistant', route: '/assistant', meta: 'assistant', group: 'intelligence', status: 'live' },
  { id: 'lab', route: '/lab', meta: 'lab', group: 'intelligence', status: 'live' },
];

/** Nome e descrição do produto no idioma atual, direto dos metadados da página. */
export function productText(p: ProductEntry, m: Messages): { title: string; description: string } {
  const meta = m.meta[p.meta] as { title: string; description: string };
  return { title: meta.title, description: meta.description };
}
