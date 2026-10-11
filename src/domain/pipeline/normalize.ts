import { containsUnsafeMarkup, normalizeText, slugify } from '@/lib/text';
import type { CategoryId, CertificateType, Duration, Level, PriceType } from '@/types/domain';
import { normalizeUrl, recordFingerprint } from './dedupe';
import type { NormalizedRecord, RawRecord } from './types';

/**
 * Etapa 3 — Normalização.
 *
 * Converte textos livres das fontes em valores do modelo de domínio. Quando
 * um valor não é reconhecido, o resultado é `unknown`/ausente e uma nota é
 * registrada — nunca um palpite.
 */

export interface ParsedPrice {
  priceType: PriceType;
  priceAmount?: number;
  currency?: string;
}

const FREE_RE = /\b(gratuit[oa]s?|gratis|free|sem custo|no cost|custo zero)\b|\$\s?0(?![\d.,])/;
const PAID_CERT_RE = /(certificad[oa]|certificate)[^.]*\b(pag[oa]|paid)\b|\b(pag[oa]|paid)\b[^.]*(certificad[oa]|certificate)/;
const VARIES_RE = /\b(varia|varies|depende|depends)\b/;

export function parsePrice(text: string | undefined): ParsedPrice {
  if (!text) return { priceType: 'unknown' };
  const t = normalizeText(text.replace(/\$/g, ' $ ')).replace(/ \$ /g, '$');
  const raw = text.toLowerCase();
  if (VARIES_RE.test(t)) return { priceType: 'varies' };
  const amount = raw.match(/(r\$|us\$|usd|brl|\$|€|eur)\s?(\d{1,6}(?:[.,]\d{1,2})?)/);
  if (FREE_RE.test(t) || /\$\s?0(?![\d.,])/.test(raw)) {
    return PAID_CERT_RE.test(t) ? { priceType: 'free-with-paid-certificate' } : { priceType: 'free' };
  }
  if (amount) {
    const symbol = amount[1] ?? '';
    const value = Number((amount[2] ?? '0').replace(',', '.'));
    const currency = symbol.startsWith('r') || symbol === 'brl' ? 'BRL' : symbol === '€' || symbol === 'eur' ? 'EUR' : 'USD';
    if (value === 0) return { priceType: 'free', priceAmount: 0, currency };
    return { priceType: 'paid', priceAmount: value, currency };
  }
  if (/\b(pago|paid|assinatura|subscription)\b/.test(t)) return { priceType: 'paid' };
  return { priceType: 'unknown' };
}

export function parseLevel(text: string | undefined): Level {
  if (!text) return 'unknown';
  const t = normalizeText(text);
  if (/todos os niveis|all levels|qualquer nivel/.test(t)) return 'all-levels';
  if (/avancad|advanced|expert/.test(t)) return 'advanced';
  if (/intermediar|intermediate/.test(t)) return 'intermediate';
  if (/inician|basic|introdut|beginner|introductory|fundament/.test(t)) return 'beginner';
  return 'unknown';
}

export function parseDuration(text: string | undefined): Duration | undefined {
  if (!text) return undefined;
  const t = normalizeText(text);
  const m = t.match(/(\d{1,4})(?:[.,](\d))?\s*(h\b|hora|horas|hour|hours|semana|semanas|week|weeks|aula|aulas|lesson|lessons|modulo|modulos|module|modules)/);
  if (!m) return undefined;
  const value = Number(`${m[1]}${m[2] ? `.${m[2]}` : ''}`);
  const unitText = m[3] ?? '';
  const unit: Duration['unit'] = /semana|week/.test(unitText)
    ? 'weeks'
    : /aula|lesson/.test(unitText)
      ? 'lessons'
      : /modul/.test(unitText)
        ? 'modules'
        : 'hours';
  return { value, unit };
}

export function parseCertificate(text: string | undefined): CertificateType | undefined {
  if (!text) return undefined;
  const t = normalizeText(text);
  if (/sem certificado|no certificate|nao emite/.test(t)) return 'none-stated';
  if (/badge|selo/.test(t)) return 'digital-badge';
  const free = /gratuit|free/.test(t);
  const paid = /pag[oa]|paid|verified|verificado/.test(t);
  if (free && paid) return 'free-and-paid-options';
  if (paid) return 'paid-certificate';
  if (free) return 'free-certificate';
  // "Certificado incluso" sem dizer se é gratuito: tipo desconhecido, não inventamos.
  return undefined;
}

const CATEGORY_HINTS: Array<[RegExp, CategoryId]> = [
  [/\b(ia|ai|inteligencia artificial|artificial intelligence|machine learning|aprendizado de maquina|deep learning|llm)\b/, 'ai-ml'],
  [/\b(web|front.?end|back.?end|html|css|javascript|react|full.?stack)\b/, 'web-development'],
  [/\b(dados|data|analise|analytics|planilha|excel|sql|bi)\b/, 'data'],
  [/\b(seguranca|security|privacidade|privacy|lgpd|ciberseguranca|cybersecurity)\b/, 'security-privacy'],
  [/\b(nuvem|cloud|linux|devops|infraestrutura|redes|network)\b/, 'cloud-infra'],
  [/\b(governo|government|setor publico|public sector)\b/, 'digital-government'],
  [/\b(programacao|programming|algoritmos|computacao|computer science|python)\b/, 'computer-science'],
  [/\b(saude mental|mental health|bem.?estar|well.?being|psicolog\w*|psycholog\w*|mindfulness)\b/, 'mental-health'],
  [/\b(educacao fisica|physical education|exercicio|exercise|esporte|sports?|fitness)\b/, 'physical-education'],
  [/\b(nutricao|nutrition|alimentacao|alimentos|food)\b/, 'nutrition'],
  [/\b(financas|finance|financeira|financial|orcamento|budget)\b/, 'finance'],
  [/\b(saude|health|epidemiologia|epidemiology|sus)\b/, 'health'],
  [/\b(educacao|education|docencia|teaching|pedagogia|professores|teachers)\b/, 'education'],
  [/\b(idiomas|languages|ingles|english|libras|mandarim|chinese)\b/, 'languages'],
  [/\b(empreendedorismo|entrepreneurship|negocios|business|projetos|projects|agil|agile)\b/, 'business'],
  [/\b(carreira|career|lideranca|leadership|negociacao|negotiation)\b/, 'career'],
  [/\b(design|ux|experiencia do usuario|user experience)\b/, 'design'],
  [/\b(marketing|comunicacao|communication)\b/, 'marketing'],
  [/\b(engenharia|engineering|industria|industry|energia|energy)\b/, 'industry'],
  [/\b(agro|agricultura|agriculture|meio ambiente|environment|clima|climate|sustentabilidade|sustainability)\b/, 'agro-environment'],
  [/\b(licitacoes|procurement|direito|law|etica|ethics|transparencia|transparency)\b/, 'public-admin-law'],
];

export function mapCategory(...hints: Array<string | undefined>): CategoryId | null {
  const text = normalizeText(hints.filter(Boolean).join(' '));
  for (const [re, id] of CATEGORY_HINTS) if (re.test(text)) return id;
  return null;
}

/** Remove marcação HTML e espaços excedentes de um texto não confiável. */
export function sanitizePlainText(value: string | undefined, maxLength = 2000): string {
  if (!value) return '';
  // Remove caracteres de controle (exceto tab e quebras de linha).
  const withoutControl = [...value]
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('');
  return withoutControl
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function normalizeRecord(raw: RawRecord): NormalizedRecord {
  const notes: string[] = [];
  // Detecta ANTES de sanitizar: a marcação é removida, mas o registro fica
  // marcado e a validação o reprova (dado externo não confiável).
  if ([raw.title, raw.provider, raw.description ?? '', raw.url].some(containsUnsafeMarkup)) notes.push('unsafe-markup');
  const title = sanitizePlainText(raw.title, 200);
  const provider = sanitizePlainText(raw.provider, 120);
  const description = sanitizePlainText(raw.description);
  const price = parsePrice(raw.priceText);
  if (raw.priceText && price.priceType === 'unknown') notes.push('price-unrecognized');
  const level = parseLevel(raw.levelText);
  if (raw.levelText && level === 'unknown') notes.push('level-unrecognized');
  const category = mapCategory(raw.categoryHint, title);
  if (!category) notes.push('category-unmapped');

  return {
    key: normalizeUrl(raw.url),
    fingerprint: recordFingerprint(provider, title),
    externalId: raw.externalId,
    sourceId: raw.sourceId,
    url: raw.url.trim(),
    slug: slugify(`${provider} ${title}`),
    title,
    provider,
    description,
    category,
    level,
    ...price,
    duration: parseDuration(raw.durationText),
    certificateType: parseCertificate(raw.certificateText),
    skills: (raw.skills ?? []).map((s) => slugify(s)).filter(Boolean),
    languages: raw.language ? [raw.language] : [],
    collectedAt: raw.collectedAt,
    updatedAtSource: raw.updatedAtSource,
    notes,
  };
}
