import type { Locale } from '@/types/domain';

/*
 * Formatadores Intl são caros de criar (dezenas a centenas de µs, bem mais num
 * celular): criamos um por idioma + opções e reaproveitamos.
 */
const dateCache = new Map<string, Intl.DateTimeFormat>();
const relativeCache = new Map<Locale, Intl.RelativeTimeFormat>();
const numberCache = new Map<string, Intl.NumberFormat>();

function numberFormatter(locale: Locale, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options ?? {})}`;
  let f = numberCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    numberCache.set(key, f);
  }
  return f;
}

function dateFormatter(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = dateCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    dateCache.set(key, f);
  }
  return f;
}

/** Datas "AAAA-MM-DD" são tratadas como dia civil (sem deslocamento de fuso). */
function parseIso(iso: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
}

export function formatDate(iso: string | undefined, locale: Locale): string | null {
  if (!iso) return null;
  const d = parseIso(iso);
  if (Number.isNaN(d.getTime())) return null;
  return dateFormatter(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function formatTime(iso: string, locale: Locale): string {
  return dateFormatter(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(parseIso(iso));
}

export function formatRelative(iso: string, locale: Locale, now: Date = new Date()): string {
  const diffSec = Math.round((parseIso(iso).getTime() - now.getTime()) / 1000);
  let rtf = relativeCache.get(locale);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
    relativeCache.set(locale, rtf);
  }
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86_400), 'day');
}

export function formatNumber(value: number, locale: Locale): string {
  return numberFormatter(locale).format(value);
}

export function formatMoney(amount: number, currency: string, locale: Locale): string {
  return numberFormatter(locale, { style: 'currency', currency }).format(amount);
}
