import type { Locale } from '@/types/domain';
import type { CourseField } from './journey';
import type { Place } from './layout';

/**
 * Textos do tour guiado e do "seguir um curso". Ficam no chunk da página do
 * laboratório (fora do i18n global, que vai no JS inicial de todo o site).
 */

interface StopText {
  title: string;
  text: string;
}

const pt = {
  tour: {
    start: 'Tour guiado',
    region: 'Tour guiado pelo campus',
    eyebrow: 'Tour guiado',
    stops: {
      hub: {
        title: 'A Central de Operações',
        text: 'Toda ação dos agentes vira um evento registrado aqui, no centro do campus. Os eventos desta versão vêm de uma simulação local; as regras do pipeline e os números do catálogo são reais.',
      },
      scout: {
        title: 'Scout descobre',
        text: 'A antena procura oportunidades em fontes autorizadas. Cada descoberta vira um registro que um robô leva ao Verifier — repare nos carregadores saindo daqui.',
      },
      verifier: {
        title: 'Verifier valida',
        text: 'Os braços robóticos fazem a triagem: aprovados seguem para o catálogo na Central; reprovados e duplicados ficam no setor. Os critérios são os da metodologia, com nota mínima de 70.',
      },
      vigia: {
        title: 'Vigia reconfere',
        text: 'A torre acompanha a idade de cada conferência. Passou de 180 dias sem nova confirmação na fonte, o registro é marcado como desatualizado e volta ao Verifier.',
      },
      atlas: {
        title: 'Atlas relaciona',
        text: 'O holograma representa o grafo competência → curso. As relações são as da curadoria do catálogo verificado.',
      },
      trend: {
        title: 'Trend analisa',
        text: 'As barras são as competências mais frequentes no catálogo verificado. É contagem de cursos — não mede demanda de mercado.',
      },
      sol: {
        title: 'Sol ajuda',
        text: 'O assistente responde com regras locais transparentes, sempre citando a fonte — e diz quando os dados não bastam.',
      },
    } satisfies Record<Place, StopText>,
    live: 'Agora no setor',
  },
  follow: {
    start: 'Seguir um curso',
    region: 'Seguindo um curso pelo pipeline',
    eyebrow: 'Seguindo um curso',
    pickTitle: 'Escolha um curso para seguir',
    pickLead: 'Um robô leva o registro de setor em setor. Em cada parada você vê os dados reais dele.',
    search: 'Buscar no catálogo verificado',
    empty: 'Nenhum curso encontrado com esse termo.',
    more: (n: number) => `e mais ${n} — refine a busca`,
    note: 'Dados reais do registro. Na v1 a conferência foi manual; o trajeto mostra as etapas por onde um registro passa.',
    stops: {
      scout: { title: 'Descoberto na fonte', text: '' },
      verifier: { title: 'Validado', text: '' },
      hub: { title: 'Publicado no catálogo', text: '' },
      atlas: { title: 'Ligado às competências', text: '' },
      trend: { title: 'Contado nas análises', text: '' },
      vigia: { title: 'Na fila de reconferência', text: '' },
      sol: { title: 'Pronto para consulta', text: '' },
    } satisfies Record<Place, StopText>,
    source: (provider: string, source: string, host: string | null) =>
      `Oferecido por ${provider}. Fonte oficial: ${source}${host ? ` (${host})` : ''}. Na v1 a curadoria leu esta página — nenhum robô a coletou.`,
    verified: (status: string, date: string) => `${status} em ${date}.`,
    stated: (fields: string) => `Confirmado na fonte: ${fields}.`,
    inferred: (fields: string) => `Inferido (sinalizado): ${fields}.`,
    missing: (fields: string) => `Não informado pela fonte: ${fields} — a Bezalel não supõe.`,
    published: (area: string) => `Publicado no catálogo verificado, na área ${area}.`,
    notPublished: 'Este registro não está publicado.',
    skills: (n: number, names: string) => (n ? `Ligado a ${n} competência(s): ${names}.` : 'Sem competências classificadas.'),
    trend: (skill: string, n: number) => `“${skill}” aparece em ${n} curso(s) do catálogo verificado — contagem de cursos, não demanda.`,
    trendNone: 'Sem competência para contar.',
    recheck: (due: string, days: number) =>
      days >= 0
        ? `Próxima reconferência até ${due} (faltam ${days} dia(s)). Sem nova confirmação até lá, o registro volta ao Verifier.`
        : `Prazo de reconferência vencido em ${due}: o registro deve ser marcado como desatualizado.`,
    ask: 'Pergunte ao Sol sobre este curso ou abra a página dele.',
    askSol: 'Perguntar ao Sol',
    openCourse: 'Abrir página do curso',
    fields: { price: 'preço', certificate: 'certificado', duration: 'duração', level: 'nível', prerequisites: 'requisitos' } satisfies Record<CourseField, string>,
  },
  step: (n: number, total: number) => `Parada ${n} de ${total}`,
  prev: 'Parada anterior',
  next: 'Próxima parada',
  finish: 'Concluir',
  exit: 'Sair',
  play: 'Avançar sozinho',
  pause: 'Pausar',
  walking: 'A caminho…',
  keys: '← → para navegar · Esc para sair',
};

type JourneyContent = typeof pt;

const en: JourneyContent = {
  tour: {
    start: 'Guided tour',
    region: 'Guided campus tour',
    eyebrow: 'Guided tour',
    stops: {
      hub: {
        title: 'The Operations Center',
        text: 'Every agent action becomes an event recorded here, at the heart of the campus. In this version the events come from a local simulation; the pipeline rules and the catalog numbers are real.',
      },
      scout: {
        title: 'Scout discovers',
        text: 'The dish searches authorized sources for opportunities. Each finding becomes a record that a robot carries to Verifier — watch the carriers leaving from here.',
      },
      verifier: {
        title: 'Verifier validates',
        text: 'The robotic arms sort records: approved ones go to the catalog at the Center; rejected ones and duplicates stay here. The criteria are the methodology’s, with a minimum score of 70.',
      },
      vigia: {
        title: 'Vigia re-checks',
        text: 'The tower tracks the age of every check. After 180 days without a new confirmation at the source, the record is marked outdated and goes back to Verifier.',
      },
      atlas: {
        title: 'Atlas connects',
        text: 'The hologram represents the skill → course graph. The relations are the verified catalog’s curation.',
      },
      trend: {
        title: 'Trend analyzes',
        text: 'The bars are the most frequent skills in the verified catalog. It is a course count — it does not measure market demand.',
      },
      sol: {
        title: 'Sol helps',
        text: 'The assistant answers with transparent local rules, always citing the source — and says when the data is not enough.',
      },
    },
    live: 'Now in this sector',
  },
  follow: {
    start: 'Follow a course',
    region: 'Following a course through the pipeline',
    eyebrow: 'Following a course',
    pickTitle: 'Pick a course to follow',
    pickLead: 'A robot carries the record from sector to sector. At each stop you see its real data.',
    search: 'Search the verified catalog',
    empty: 'No course found for that term.',
    more: (n: number) => `and ${n} more — refine the search`,
    note: 'Real record data. In v1 the check was manual; the route shows the stages a record goes through.',
    stops: {
      scout: { title: 'Discovered at the source', text: '' },
      verifier: { title: 'Validated', text: '' },
      hub: { title: 'Published in the catalog', text: '' },
      atlas: { title: 'Linked to skills', text: '' },
      trend: { title: 'Counted in the analyses', text: '' },
      vigia: { title: 'In the re-check queue', text: '' },
      sol: { title: 'Ready to be asked about', text: '' },
    },
    source: (provider: string, source: string, host: string | null) =>
      `Offered by ${provider}. Official source: ${source}${host ? ` (${host})` : ''}. In v1 the curators read this page — no robot collected it.`,
    verified: (status: string, date: string) => `${status} on ${date}.`,
    stated: (fields: string) => `Confirmed at the source: ${fields}.`,
    inferred: (fields: string) => `Inferred (flagged): ${fields}.`,
    missing: (fields: string) => `Not stated by the source: ${fields} — Bezalel does not guess.`,
    published: (area: string) => `Published in the verified catalog, in the ${area} area.`,
    notPublished: 'This record is not published.',
    skills: (n: number, names: string) => (n ? `Linked to ${n} skill(s): ${names}.` : 'No classified skills.'),
    trend: (skill: string, n: number) => `“${skill}” appears in ${n} verified catalog course(s) — a course count, not demand.`,
    trendNone: 'No skill to count.',
    recheck: (due: string, days: number) =>
      days >= 0
        ? `Next re-check by ${due} (${days} day(s) left). Without a new confirmation by then, the record goes back to Verifier.`
        : `Re-check deadline passed on ${due}: the record should be marked outdated.`,
    ask: 'Ask Sol about this course or open its page.',
    askSol: 'Ask Sol',
    openCourse: 'Open course page',
    fields: { price: 'price', certificate: 'certificate', duration: 'duration', level: 'level', prerequisites: 'prerequisites' },
  },
  step: (n: number, total: number) => `Stop ${n} of ${total}`,
  prev: 'Previous stop',
  next: 'Next stop',
  finish: 'Finish',
  exit: 'Exit',
  play: 'Advance automatically',
  pause: 'Pause',
  walking: 'On the way…',
  keys: '← → to navigate · Esc to exit',
};

export const journeyContent: Record<Locale, JourneyContent> = { 'pt-BR': pt, en };
