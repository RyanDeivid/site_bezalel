type ClassValue = string | false | null | undefined | 0;

/** Junta classes condicionais. Ex.: cn('a', active && 'b') */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
