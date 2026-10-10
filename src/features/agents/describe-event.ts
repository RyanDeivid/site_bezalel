import type { Messages } from '@/i18n';
import type { AgentEvent, Locale } from '@/types/domain';

/**
 * Texto de um evento no idioma da interface. Usa o modelo por tipo com o
 * rótulo e os metadados estruturados; se faltar informação (ex.: evento de
 * um backend futuro com tipo novo), cai no `summary` original.
 */
export function describeEvent(event: AgentEvent, m: Messages, _locale: Locale): string {
  const template = m.events.describe[event.type];
  if (!template || !event.entityLabel) return event.summary;
  return template(event.entityLabel, event.meta ?? {});
}
