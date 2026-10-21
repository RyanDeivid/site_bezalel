import { describe, expect, it } from 'vitest';
import { nextStepContent } from '@/components/layout/next-step-content';
import { studioContent } from '@/components/layout/studio-content';
import { originContent } from '@/features/about/origem/content';
import { continueText } from '@/features/home/continue-content';
import { journeyContent } from '@/features/lab/journey-content';
import { lionContent } from '@/features/lion/content';
import { toolsContent } from '@/features/tools/content';
import { constellationContent } from '@/features/tools/constellation-content';
import { universeContent } from '@/features/universe/universe-content';
import { messages } from '@/i18n';

/**
 * Guarda ética (v2 · Fase 5 — docs/ETHICS.md): nenhum texto da interface pode
 * usar escassez, urgência, prova social inventada ou "confirmshaming". O teste
 * percorre TODOS os textos em pt-BR e en — inclusive os gerados por funções,
 * chamadas com argumentos de exemplo — e falha apontando a frase.
 */

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const DARK_PATTERNS: Array<[string, RegExp]> = [
  // Escassez e urgência fabricadas.
  ['escassez', /\b(ultimas? vagas?|ultima chance|ultima oportunidade|restam (apenas |so )?\d|resta(m)? (apenas|so)\b|esgotando|vagas? (esgot\w*|acabando)|antes que acabe|vagas limitadas)\b/],
  ['urgência', /\b(so hoje|somente hoje|por tempo limitado|oferta (relampago|exclusiva|termina)|acaba (hoje|em \d)|garanta (ja|agora|a sua|sua vaga)|corra\b|nao perca|agora ou nunca)/],
  ['scarcity', /\b(only \d+ left|last chance|limited time|hurry|don'?t miss|ends (today|soon|in \d)|act now|selling fast|almost gone|now or never)\b/],
  // Prova social inventada (não temos contas nem analytics — qualquer "N pessoas…" seria falso).
  ['prova social', /\b(\d+ pessoas|pessoas (estao|est[aã]o) (vendo|olhando)|mais vendido|todo mundo esta|alunos (estao|acabaram))/],
  ['social proof', /\b(\d+ (people|users|students) (are|just|have)|people are (viewing|watching|looking)|bestseller|everyone is)\b/],
  // Confirmshaming: fazer a recusa soar vergonhosa.
  ['confirmshaming', /\b(nao,? (obrigado,? )?(eu )?(prefiro (continuar|ficar)|nao quero (aprender|crescer|melhorar))|no,? thanks,? i (don'?t|prefer))/],
];

/** Todos os textos alcançáveis de um objeto de mensagens (funções chamadas com argumentos de exemplo). */
function collect(value: unknown, path: string, out: Array<[string, string]>, depth = 0) {
  if (depth > 12) return;
  if (typeof value === 'string') out.push([path, value]);
  else if (typeof value === 'function') {
    for (const args of [
      [3, 7, 2],
      ['Tecnologia', 'Saúde', 'X'],
    ]) {
      try {
        collect((value as (...a: unknown[]) => unknown)(...args), `${path}()`, out, depth + 1);
      } catch {
        /* função que espera outro tipo de argumento: a outra amostra cobre */
      }
    }
  } else if (Array.isArray(value)) value.forEach((v, i) => collect(v, `${path}[${i}]`, out, depth + 1));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) collect(v, `${path}.${k}`, out, depth + 1);
}

const sources: Record<string, unknown> = {
  'i18n.pt-BR': messages['pt-BR'],
  'i18n.en': messages.en,
  tools: toolsContent,
  constellation: constellationContent,
  universe: universeContent,
  lion: lionContent,
  studio: studioContent,
  journeys: journeyContent,
  origem: originContent,
  continue: continueText,
  nextStep: nextStepContent,
};

describe('guarda ética dos textos', () => {
  const texts: Array<[string, string]> = [];
  for (const [name, value] of Object.entries(sources)) collect(value, name, texts);

  it('há textos de verdade para conferir (o teste não está vazio)', () => {
    expect(texts.length).toBeGreaterThan(800);
  });

  it.each(DARK_PATTERNS)('nenhum texto usa %s', (_name, pattern) => {
    const hits = texts.filter(([, text]) => pattern.test(normalize(text))).map(([path, text]) => `${path}: “${text}”`);
    expect(hits).toEqual([]);
  });

  it('os padrões pegam o que devem pegar (o teste não é cego)', () => {
    const bad = ['Vagas esgotando!', 'Últimas vagas!', 'Só hoje: corra', 'Restam 3 vagas', '1.234 pessoas estão vendo este curso', 'Only 2 left — hurry!', 'Não, obrigado, prefiro continuar sem aprender', 'People are viewing this'];
    for (const b of bad) expect(DARK_PATTERNS.some(([, p]) => p.test(normalize(b))), b).toBe(true);
    // "esgotado" de tempo de resposta (erro técnico) não é escassez.
    const fine = ['Tempo de resposta esgotado', '105 cursos verificados na fonte', 'Faltam 2 cursos para concluir a trilha', 'Gratuito', 'Conferido em 10/10/2026'];
    for (const f of fine) expect(DARK_PATTERNS.some(([, p]) => p.test(normalize(f))), f).toBe(false);
  });
});
