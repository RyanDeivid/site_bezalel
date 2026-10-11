import type { CategoryId, Course, Duration, Level } from '../../../types/domain.ts';

/**
 * Ampliação do catálogo (v2 · Fase 2), conferida em 11/10/2026.
 *
 * Mesmas regras da curadoria original (ver courses.ts): só preenchemos o que
 * a fonte declara; descrições são resumos nossos, não cópias; competências
 * são classificação da Bezalel. Os ajudantes abaixo só evitam repetir os
 * campos comuns de cada fonte — os valores continuam vindo da conferência.
 */
export const CHECKED_V2 = '2026-10-11';

interface Base {
  slug: string;
  title: string;
  description: string;
  category: CategoryId;
  skills: string[];
  topics: string[];
}

const stamp = (at: string) => ({
  sourceVerifiedAt: at,
  lastCheckedAt: at,
  publicationStatus: 'published' as const,
  origin: 'curated' as const,
  createdAt: at,
  updatedAt: at,
});

/**
 * Escola Virtual.Gov (Enap). Fonte: exportação pública do catálogo oficial
 * (escolavirtual.gov.br/catalogo/exportar/csv) + página de cada curso,
 * baixada e conferida (título, carga horária, gratuidade, certificado).
 */
export function evg(
  d: Base & {
    id: number;
    contentAuthor: string;
    hours: number;
    days: number;
    /** A página declara "gratuito"? (algumas dizem só "Curso Aberto"). */
    free: boolean;
    audience: string;
    level?: Level;
    languages?: string[];
  },
): Course {
  const { id, hours, days, free, audience, level, languages, ...rest } = d;
  return {
    id: `crs-${d.slug}`,
    ...rest,
    provider: { name: 'Enap — Escola Virtual.Gov', url: 'https://www.escolavirtual.gov.br' },
    type: 'course',
    level: level ?? 'unknown',
    priceType: free ? 'free' : 'unknown',
    ...(free ? {} : { priceNote: 'A página indica "Curso Aberto" com certificado, mas não declara a gratuidade explicitamente.' }),
    duration: { value: hours, unit: 'hours', note: `Acesso por ${days} dias após a inscrição` },
    certificateType: 'free-certificate',
    certificateNote: free ? 'Curso aberto, gratuito e com certificado (certificadora: Enap).' : 'Certificado disponível ao concluir (certificadora: Enap).',
    languages: languages ?? ['pt-BR'],
    modality: 'online-self-paced',
    sourceUrl: `https://www.escolavirtual.gov.br/curso/${id}`,
    sourceName: 'Escola Virtual.Gov — página do curso',
    verificationStatus: free ? 'verified' : 'partially-verified',
    verificationNote: `Catálogo oficial da Escola Virtual.Gov (exportação pública) e página do curso conferidos em ${CHECKED_V2}: ${
      free ? 'curso aberto, gratuito e com certificado' : 'curso aberto e com certificado (gratuidade não declarada na página)'
    }, carga de ${hours} h, acesso por ${days} dias. Público principal declarado: ${audience}.`,
    ...stamp(CHECKED_V2),
  };
}

/**
 * Fundação Bradesco — Escola Virtual. Fonte: página do curso + Termos de Uso
 * (cursos "integralmente gratuitos"; aprovação com 70% na avaliação final;
 * certificado digital válido por 2 anos; 60 dias para concluir).
 */
export function bradesco(
  d: Base & { path: string; hours: number; level: Level; minAge: number; partner?: string; /** A página diz "não há pré-requisitos". */ noPrereq?: boolean },
): Course {
  const { path, hours, level, minAge, partner, noPrereq, ...rest } = d;
  return {
    id: `crs-${d.slug}`,
    ...rest,
    provider: { name: 'Fundação Bradesco — Escola Virtual', url: 'https://www.ev.org.br' },
    ...(partner ? { contentAuthor: partner } : {}),
    type: 'course',
    level,
    levelSource: 'stated',
    priceType: 'free',
    duration: { value: hours, unit: 'hours', note: '60 dias para concluir após a matrícula' },
    certificateType: 'free-certificate',
    certificateNote: 'Certificado digital gratuito com aproveitamento mínimo de 70% na avaliação final; válido por 2 anos, com código de autenticidade.',
    prerequisites: [...(noPrereq ? ['Nenhum pré-requisito de conteúdo'] : []), `Idade mínima: ${minAge} anos`],
    languages: ['pt-BR'],
    modality: 'online-self-paced',
    sourceUrl: `https://www.ev.org.br/cursos/${path}`,
    sourceName: 'Fundação Bradesco — Escola Virtual, página do curso',
    verificationStatus: 'verified',
    verificationNote: `Página do curso e Termos de Uso da Escola Virtual conferidos em ${CHECKED_V2}: gratuidade (Termos), carga de ${hours} h, nível declarado, certificado com 70% de aproveitamento e prazo de 60 dias.`,
    ...stamp(CHECKED_V2),
  };
}

/**
 * Coursera. Fonte: página do curso. A página não declara acesso gratuito ao
 * conteúdo (salvo quando `free` é informado); o certificado exige a compra da
 * "experiência com certificado", sem preço exibido.
 */
export function coursera(
  d: Base & {
    path: string;
    institution: string;
    duration: Duration;
    level?: Level;
    /** Nível deduzido (ex.: pela descrição), quando a página não o declara. */
    levelInferred?: boolean;
    free?: boolean;
    prerequisites?: string[];
    instructors?: string;
    license?: string;
  },
): Course {
  const { path, institution, duration, level, levelInferred, free, prerequisites, instructors, ...rest } = d;
  return {
    id: `crs-${d.slug}`,
    ...rest,
    provider: { name: `${institution} (via Coursera)`, url: 'https://www.coursera.org' },
    ...(instructors ? { contentAuthor: instructors } : {}),
    type: 'course',
    level: level ?? 'unknown',
    ...(level ? { levelSource: levelInferred ? ('inferred' as const) : ('stated' as const) } : {}),
    priceType: free ? 'free-with-paid-certificate' : 'unknown',
    ...(free
      ? {}
      : { priceNote: 'A página não declara acesso gratuito ao conteúdo; o certificado exige a compra da experiência com certificado (preço não exibido).' }),
    duration,
    certificateType: 'paid-certificate',
    certificateNote: 'Certificado compartilhável mediante compra da experiência com certificado (preço não exibido na página).',
    ...(prerequisites ? { prerequisites } : {}),
    languages: ['en'],
    modality: 'online-self-paced',
    sourceUrl: `https://www.coursera.org/learn/${path}`,
    sourceName: `Coursera — ${institution}, página do curso`,
    verificationStatus: free ? 'verified' : 'partially-verified',
    verificationNote: `Página do curso conferida em ${CHECKED_V2}: conteúdo, módulos, carga estimada, idioma (inglês, com legendas em vários idiomas) e certificado pago confirmados.${
      free ? ' A página declara o curso aberto e disponível gratuitamente.' : ' Gratuidade do conteúdo não declarada — exibida como "Não informado".'
    }`,
    ...stamp(CHECKED_V2),
  };
}
