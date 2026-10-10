/** Remove acentos, baixa caixa e colapsa espaços — base de busca e deduplicação. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'por', 'com', 'um', 'uma',
  'no', 'na', 'nos', 'nas', 'ao', 'aos', 'que', 'se', 'sobre', 'curso', 'cursos',
  'the', 'of', 'and', 'to', 'in', 'for', 'with', 'an', 'on', 'course', 'courses',
]);

/** Quebra um texto em termos significativos (sem stopwords). */
export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[+#.]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

/** Detecta conteúdo potencialmente executável em texto vindo de fontes externas. */
export function containsUnsafeMarkup(value: string): boolean {
  return /<\s*\/?\s*(script|iframe|object|embed|style)\b|javascript:|on\w+\s*=/i.test(value);
}
