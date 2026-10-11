import type { Widen } from '@/i18n/types';
import type { Locale } from '@/types/domain';

/*
 * Textos da "origem" (página Sobre). Ficam no chunk da página — não no i18n
 * global, que vai no JS inicial de todo o site. O inglês é obrigado pelo tipo
 * a ter as mesmas chaves do português.
 *
 * Narrativa parafraseada (sem citação longa de tradução protegida); cada
 * capítulo indica a referência para quem quiser ler na fonte.
 */
const ptBR = {
  eyebrow: 'A origem',
  title: 'Gire a manivela. Construa a história por trás do nome.',
  lead: 'Bezalel é o artesão que a Bíblia descreve construindo o Tabernáculo. Sete voltas, sete capítulos: a cada volta, uma parte dessa história ganha forma na planta.',
  introTitle: 'Tudo começa como matéria espalhada.',
  introText: 'Você é quem constrói. Gire a manivela no sentido horário — ou use as setas do teclado.',
  hint: 'Gire',
  dial: 'Manivela da história de Bezalel',
  valueText: (n: number, total: number, title: string) => (n === 0 ? 'Início: gire para começar' : `Capítulo ${n} de ${total}: ${title}`),
  chapterLabel: (roman: string) => `Capítulo ${roman}`,
  sheet: 'Folha',
  sheetTitle: 'Projeto: a obra de Bezalel',
  prev: 'Capítulo anterior',
  next: 'Próximo capítulo',
  play: 'Girar para mim',
  pause: 'Pausar',
  sound: 'Som da catraca',
  restart: 'Recomeçar',
  explore: 'Explorar cursos',
  source: 'Fonte',
  note: 'Narrativa parafraseada a partir dos textos indicados; não é citação literal de nenhuma tradução.',
  chapters: [
    {
      kicker: 'O nome',
      title: 'Um nome que é sombra',
      text: 'Em hebraico, Bezalel (בְּצַלְאֵל) quer dizer “à sombra de Deus”. O texto o apresenta com a família inteira — filho de Uri, filho de Hur, da tribo de Judá — e diz que ele foi chamado pelo nome para uma obra.',
      ref: 'Êxodo 31:2 · 1 Crônicas 2:20',
    },
    {
      kicker: 'Os dons',
      title: 'Sabedoria, entendimento, conhecimento',
      text: 'É a primeira vez que a Bíblia diz que alguém foi cheio do espírito de Deus — e o motivo é o ofício: sabedoria, entendimento e conhecimento para todo tipo de trabalho. Três dons que lemos como três verbos: descobrir, aprender, construir.',
      ref: 'Êxodo 31:3',
    },
    {
      kicker: 'A matéria',
      title: 'Do projeto à matéria',
      text: 'Ele sabia conceber projetos e executá-los: trabalhar o ouro, a prata e o bronze, lapidar pedras para engaste e entalhar madeira. Desenho e execução na mesma pessoa.',
      ref: 'Êxodo 31:4–5',
    },
    {
      kicker: 'A obra',
      title: 'O Tabernáculo, medida por medida',
      text: 'Com sua equipe, ergueu o Tabernáculo. O próprio texto guarda as medidas: um pátio de 100 por 50 côvados cercado de cortinas e colunas, o altar de bronze de 5 por 5 côvados e a arca de 2,5 por 1,5 côvados — que, diz o texto, o próprio Bezalel fez.',
      ref: 'Êxodo 37:1 · 38:1–20',
    },
    {
      kicker: 'O ensino',
      title: 'Um saber que se multiplica',
      text: 'Ele recebeu também o dom de ensinar, ao lado de Aoliabe, da tribo de Dã. A obra não foi de um homem só: todos os artesãos habilidosos trabalharam com eles.',
      ref: 'Êxodo 35:34 · 36:1–2',
    },
    {
      kicker: 'As letras',
      title: 'As letras da criação',
      text: 'Séculos depois, os sábios do Talmud disseram que Bezalel sabia combinar as letras com que o céu e a terra foram criados. Combinar símbolos para fazer algo existir: hoje, chamamos isso de código.',
      ref: 'Talmud Babilônico, Berakhot 55a',
    },
    {
      kicker: 'O legado',
      title: 'O que fica de pé',
      text: 'Gerações depois, no tempo de Salomão, o altar de bronze feito por Bezalel ainda estava diante do Tabernáculo, em Gibeão. É a ideia que a Bezalel carrega — e que a marca desenha: um bloco, a menor peça de qualquer construção. Descobrir, aprender, construir.',
      ref: '2 Crônicas 1:3–5',
    },
  ],
  labels: {
    latinName: 'B E Z A L E L',
    meaning: '“à sombra de Deus”',
    gifts: ['Sabedoria', 'Entendimento', 'Conhecimento'],
    verbs: ['descobrir', 'aprender', 'construir'],
    materials: ['Ouro', 'Prata', 'Bronze', 'Pedras', 'Madeira'],
    court: 'pátio · 100 × 50 côvados',
    altar: 'altar · 5 × 5 × 3',
    ark: 'arca · 2,5 × 1,5 × 1,5',
    holy: 'Santo dos Santos',
    teacher: 'Bezalel',
    partner: 'Aoliabe',
    learners: 'artesãos que aprenderam',
    code: 'combinar símbolos → criar',
    faces: ['Descobrir', 'Aprender', 'Construir'],
  },
};

export type OriginContent = Widen<typeof ptBR>;

const en: OriginContent = {
  eyebrow: 'The origin',
  title: 'Turn the crank. Build the story behind the name.',
  lead: 'Bezalel is the craftsman the Bible describes building the Tabernacle. Seven turns, seven chapters: with each turn, part of that story takes shape on the blueprint.',
  introTitle: 'Everything starts as scattered matter.',
  introText: 'You are the builder. Turn the crank clockwise — or use the arrow keys.',
  hint: 'Turn',
  dial: 'Crank of the Bezalel story',
  valueText: (n: number, total: number, title: string) => (n === 0 ? 'Start: turn to begin' : `Chapter ${n} of ${total}: ${title}`),
  chapterLabel: (roman: string) => `Chapter ${roman}`,
  sheet: 'Sheet',
  sheetTitle: 'Project: the work of Bezalel',
  prev: 'Previous chapter',
  next: 'Next chapter',
  play: 'Turn it for me',
  pause: 'Pause',
  sound: 'Ratchet sound',
  restart: 'Start over',
  explore: 'Explore courses',
  source: 'Source',
  note: 'Narrative paraphrased from the texts cited; not a literal quotation of any translation.',
  chapters: [
    {
      kicker: 'The name',
      title: 'A name that is a shadow',
      text: 'In Hebrew, Bezalel (בְּצַלְאֵל) means “in the shadow of God”. The text introduces him with his whole family — son of Uri, son of Hur, of the tribe of Judah — and says he was called by name for a work.',
      ref: 'Exodus 31:2 · 1 Chronicles 2:20',
    },
    {
      kicker: 'The gifts',
      title: 'Wisdom, understanding, knowledge',
      text: 'It is the first time the Bible says someone was filled with the spirit of God — and the reason is craft: wisdom, understanding and knowledge for every kind of work. Three gifts we read as three verbs: discover, learn, build.',
      ref: 'Exodus 31:3',
    },
    {
      kicker: 'The matter',
      title: 'From design to matter',
      text: 'He could conceive designs and carry them out: work gold, silver and bronze, cut stones for setting and carve wood. Drawing and making in one person.',
      ref: 'Exodus 31:4–5',
    },
    {
      kicker: 'The work',
      title: 'The Tabernacle, measure by measure',
      text: 'With his team he raised the Tabernacle. The text keeps the measurements: a 100 by 50 cubit court enclosed by curtains and pillars, the 5 by 5 cubit bronze altar and the 2.5 by 1.5 cubit ark — which, the text says, Bezalel made himself.',
      ref: 'Exodus 37:1 · 38:1–20',
    },
    {
      kicker: 'The teaching',
      title: 'Knowledge that multiplies',
      text: 'He was also given the gift of teaching, alongside Oholiab of the tribe of Dan. The work was not one man’s: every skilled craftsperson worked with them.',
      ref: 'Exodus 35:34 · 36:1–2',
    },
    {
      kicker: 'The letters',
      title: 'The letters of creation',
      text: 'Centuries later, the sages of the Talmud said Bezalel knew how to combine the letters with which heaven and earth were created. Combining symbols to make something exist: today we call it code.',
      ref: 'Babylonian Talmud, Berakhot 55a',
    },
    {
      kicker: 'The legacy',
      title: 'What stays standing',
      text: 'Generations later, in Solomon’s time, the bronze altar Bezalel made still stood before the Tabernacle at Gibeon. That is the idea Bezalel carries — and the mark draws: a block, the smallest piece of any construction. Discover, learn, build.',
      ref: '2 Chronicles 1:3–5',
    },
  ],
  labels: {
    latinName: 'B E Z A L E L',
    meaning: '“in the shadow of God”',
    gifts: ['Wisdom', 'Understanding', 'Knowledge'],
    verbs: ['discover', 'learn', 'build'],
    materials: ['Gold', 'Silver', 'Bronze', 'Stones', 'Wood'],
    court: 'court · 100 × 50 cubits',
    altar: 'altar · 5 × 5 × 3',
    ark: 'ark · 2.5 × 1.5 × 1.5',
    holy: 'Holy of Holies',
    teacher: 'Bezalel',
    partner: 'Oholiab',
    learners: 'craftspeople who learned',
    code: 'combine symbols → create',
    faces: ['Discover', 'Learn', 'Build'],
  },
};

export const originContent: Record<Locale, OriginContent> = { 'pt-BR': ptBR, en };
