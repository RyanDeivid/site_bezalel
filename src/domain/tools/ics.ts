/**
 * Planejador de estudos: distribui as horas declaradas de cada curso em
 * sessões nos dias da semana escolhidos e gera um arquivo .ics (RFC 5545)
 * que qualquer agenda importa. Tudo acontece no navegador — nada é enviado.
 *
 * Os horários são "flutuantes" (sem fuso): 19h00 aparece às 19h00 na agenda
 * de quem importar, onde quer que esteja.
 */

export interface PlanItem {
  id: string;
  title: string;
  /** Horas a cumprir (declaradas pela fonte). */
  hours: number;
  url: string;
}

export interface PlanOptions {
  /** Primeiro dia possível (data local). */
  start: Date;
  /** Dias da semana (0 = domingo … 6 = sábado). */
  weekdays: number[];
  /** Duração de cada sessão, em minutos. */
  sessionMinutes: number;
  /** Início das sessões, "HH:MM". */
  time: string;
}

export interface PlanSession {
  courseId: string;
  title: string;
  url: string;
  start: Date;
  end: Date;
  /** n-ésima sessão do curso (1…total). */
  index: number;
  total: number;
}

/** Limite de sessões num arquivo (uma trilha longa num ritmo lento ainda cabe). */
export const MAX_SESSIONS = 400;

const parseTime = (time: string): [number, number] => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  const h = m ? Math.min(23, Number(m[1])) : 19;
  const min = m ? Math.min(59, Number(m[2])) : 0;
  return [h, min];
};

/** Sessões em sequência: termina um curso e começa o próximo, um por dia de estudo. */
export function planSessions(items: readonly PlanItem[], opts: PlanOptions): PlanSession[] {
  const days = [...new Set(opts.weekdays.filter((d) => d >= 0 && d <= 6))];
  const minutes = Math.max(15, Math.min(240, Math.round(opts.sessionMinutes)));
  if (!days.length || !items.length) return [];
  const [h, min] = parseTime(opts.time);
  const sessions: PlanSession[] = [];
  const day = new Date(opts.start.getFullYear(), opts.start.getMonth(), opts.start.getDate());
  for (const item of items) {
    const total = Math.ceil((item.hours * 60) / minutes);
    for (let index = 1; index <= total && sessions.length < MAX_SESSIONS; index++) {
      while (!days.includes(day.getDay())) day.setDate(day.getDate() + 1);
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min);
      sessions.push({ courseId: item.id, title: item.title, url: item.url, start, end: new Date(start.getTime() + minutes * 60_000), index, total });
      day.setDate(day.getDate() + 1);
    }
  }
  return sessions;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Data/hora local flutuante: 20261012T190000. */
const floating = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
/** Data/hora UTC: 20261012T120000Z. */
const utc = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** Escapa texto de propriedade (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Dobra linhas com mais de 75 octetos (RFC 5545 §3.1), sem partir caracteres. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const bytes = enc.encode(ch).length;
    const limit = out.length ? 74 : 75; // linhas de continuação começam com um espaço
    if (size + bytes > limit) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += bytes;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function toICS(sessions: readonly PlanSession[], opts: { calendarName: string; summary: (s: PlanSession) => string; description: (s: PlanSession) => string; now?: Date }): string {
  const stamp = utc(opts.now ?? new Date());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bezalel//Planejador de estudos//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(opts.calendarName)}`];
  for (const s of sessions) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.courseId}-${s.index}-${floating(s.start)}@bezalel`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${floating(s.start)}`,
      `DTEND:${floating(s.end)}`,
      `SUMMARY:${escapeText(opts.summary(s))}`,
      `DESCRIPTION:${escapeText(opts.description(s))}`,
      ...(s.url.startsWith('https://') ? [`URL:${s.url}`] : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
