import type { StarState } from '@/domain/tools/constellation';
import type { Locale } from '@/types/domain';

/**
 * Textos da constelação de competências. Ficam no chunk da página — fora do
 * i18n global, que vai no JS inicial.
 */

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

const pt = {
  eyebrow: 'Constelação de competências',
  title: 'O que você aprende, ligado ao que vem depois.',
  lead: 'Cada estrela é uma competência ensinada por cursos verificados; duas se ligam quando um mesmo curso ensina as duas. Os cursos que você salva e conclui acendem a sua parte do céu — tudo calculado neste navegador.',
  stats: (skills: number, links: number, courses: number) => `${plural(skills, 'competência', 'competências')} · ${plural(links, 'ligação', 'ligações')} · ${plural(courses, 'curso verificado', 'cursos verificados')}`,
  mapLabel: (skills: number, links: number) => `Mapa de ${skills} competências e ${links} ligações entre elas, agrupadas por tema. A lista abaixo do mapa traz as mesmas informações.`,
  filter: 'Tema',
  zoomHint: 'Escolha um tema para aproximar a constelação.',
  all: 'Todos os temas',
  legend: 'Legenda',
  states: {
    have: 'Já tenho',
    learning: 'Aprendendo',
    next: 'Próximo passo',
  } satisfies Record<StarState, string>,
  stateHint: {
    have: 'de cursos que você marcou como concluídos',
    learning: 'de cursos salvos ou em andamento',
    next: 'ligadas às suas, ainda não começadas',
  } satisfies Record<StarState, string>,
  size: 'Tamanho = número de cursos',
  mine: {
    title: 'Sua constelação',
    summary: (have: number, learning: number) =>
      have || learning
        ? `${have ? plural(have, 'competência acesa', 'competências acesas') : 'Nenhuma competência concluída ainda'}${learning ? ` · ${plural(learning, 'em andamento', 'em andamento')}` : ''}.`
        : '',
    emptyTitle: 'Seu céu ainda está apagado',
    empty: 'Salve cursos na sua estante ou monte uma trilha: as competências deles acendem aqui, e a constelação sugere o que costuma vir junto.',
    emptyTrail: 'Descobrir minha trilha',
    emptyExplore: 'Explorar o catálogo',
    nextTitle: 'Próximos passos sugeridos',
    nextLead: 'Competências que aparecem nos mesmos cursos que as suas. Toque em uma para ver quem ensina.',
    shelf: 'Abrir minha estante',
  },
  detail: {
    hint: 'Escolha uma estrela no mapa ou na lista para ver quem a ensina.',
    area: (theme: string, area: string) => `${theme} · ${area}`,
    taught: (n: number) => (n ? `Ensinada em ${plural(n, 'curso verificado', 'cursos verificados')}` : 'Nenhum curso publicado ensina esta competência ainda'),
    together: 'Aparece junto com',
    together0: 'Nenhum curso publicado a ensina junto com outra competência.',
    sharedCourses: (n: number) => plural(n, 'curso em comum', 'cursos em comum'),
    search: 'Buscar no catálogo',
    close: 'Limpar seleção',
    state: (s: string) => `Na sua constelação: ${s}`,
  },
  list: {
    title: 'Todas as competências',
    lead: 'A mesma informação do mapa, em lista. Os temas abrem sob demanda.',
    courses: (n: number) => plural(n, 'curso', 'cursos'),
    select: (name: string, n: number) => `${name}: ${plural(n, 'curso', 'cursos')}`,
  },
};

type Content = typeof pt;

const en: Content = {
  eyebrow: 'Skill constellation',
  title: 'What you learn, linked to what comes next.',
  lead: 'Each star is a skill taught by verified courses; two stars link when the same course teaches both. The courses you save and finish light up your part of the sky — all computed in this browser.',
  stats: (skills, links, courses) => `${plural(skills, 'skill', 'skills')} · ${plural(links, 'link', 'links')} · ${plural(courses, 'verified course', 'verified courses')}`,
  mapLabel: (skills, links) => `Map of ${skills} skills and ${links} links between them, grouped by theme. The list below the map carries the same information.`,
  filter: 'Theme',
  zoomHint: 'Pick a theme to zoom into its constellation.',
  all: 'All themes',
  legend: 'Legend',
  states: { have: 'I have it', learning: 'Learning', next: 'Next step' },
  stateHint: {
    have: 'from courses you marked as finished',
    learning: 'from saved or in-progress courses',
    next: 'linked to yours, not started yet',
  },
  size: 'Size = number of courses',
  mine: {
    title: 'Your constellation',
    summary: (have, learning) =>
      have || learning
        ? `${have ? plural(have, 'skill lit', 'skills lit') : 'No finished skills yet'}${learning ? ` · ${learning} in progress` : ''}.`
        : '',
    emptyTitle: 'Your sky is still dark',
    empty: 'Save courses to your shelf or build a path: their skills light up here, and the constellation suggests what usually comes along.',
    emptyTrail: 'Find my path',
    emptyExplore: 'Explore the catalog',
    nextTitle: 'Suggested next steps',
    nextLead: 'Skills that show up in the same courses as yours. Tap one to see who teaches it.',
    shelf: 'Open my shelf',
  },
  detail: {
    hint: 'Pick a star on the map or in the list to see who teaches it.',
    area: (theme, area) => `${theme} · ${area}`,
    taught: (n) => (n ? `Taught in ${plural(n, 'verified course', 'verified courses')}` : 'No published course teaches this skill yet'),
    together: 'Shows up with',
    together0: 'No published course teaches it together with another skill.',
    sharedCourses: (n) => plural(n, 'shared course', 'shared courses'),
    search: 'Search the catalog',
    close: 'Clear selection',
    state: (s) => `In your constellation: ${s}`,
  },
  list: {
    title: 'All skills',
    lead: 'The same information as the map, as a list. Themes open on demand.',
    courses: (n) => plural(n, 'course', 'courses'),
    select: (name, n) => `${name}: ${plural(n, 'course', 'courses')}`,
  },
};

export const constellationContent: Record<Locale, Content> = { 'pt-BR': pt, en };
