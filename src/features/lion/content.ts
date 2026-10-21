import type { Widen } from '@/i18n/types';
import type { Locale } from '@/types/domain';

/*
 * Textos da experiência "O Leão da tribo de Judá". Ficam no chunk da página
 * (fora do i18n global, que vai no JS inicial). O inglês é obrigado pelo tipo
 * a ter as mesmas chaves do português.
 *
 * Três vozes, sempre separadas e rotuladas: o texto bíblico (citação literal,
 * com a tradução indicada), o contexto (explicação, com as referências) e a
 * interpretação artística (o que a escultura é e o que ela não é).
 */
const ptBR = {
  eyebrow: 'Experiência · Apocalipse 5:5',
  title: 'O Leão da tribo de Judá',
  lead: 'Uma escultura que se forma diante de você — do traço ao bronze —, inspirada num versículo do Apocalipse. Gire, aproxime, percorra os estágios da construção e leia o texto que a inspirou.',
  stageLabel: 'Escultura do Leão da tribo de Judá',
  stages: [
    { name: 'Silhueta', text: 'Antes da matéria, o desenho: o contorno do leão traçado na prancheta.' },
    { name: 'Estrutura', text: 'A armação de hastes que sustenta a obra — coluna, patas, cauda e as linhas da juba.' },
    { name: 'Volumes', text: 'O bloco de estudo em gesso: só as massas principais, ainda facetadas.' },
    { name: 'Cabeça e juba', text: 'A forma em argila: o rosto, os músculos e a juba em mechas.' },
    { name: 'Materiais', text: 'A fundição em bronze, com a pátina escurecendo as reentrâncias e o polido no que é exposto.' },
    { name: 'A obra', text: 'A escultura acabada sobre o pedestal, sob a luz de museu.' },
  ],
  stageStatus: (n: number, total: number, name: string) => `Estágio ${n} de ${total}: ${name}`,
  sculpting: 'Esculpindo…',
  prev: 'Estágio anterior',
  next: 'Próximo estágio',
  restart: 'Reiniciar a sequência',
  pause: 'Pausar a sequência',
  play: 'Continuar a sequência',
  stagesNav: 'Estágios da construção',
  views: 'Explorar detalhes',
  viewNames: { full: 'Vista completa', head: 'Cabeça', mane: 'Juba', paws: 'Patas', tail: 'Cauda' },
  hint: 'Arraste para girar · role ou pince para aproximar · setas e + / − no teclado',
  touchStart: 'Tocar para girar a escultura',
  touchDone: 'Concluir',
  noWebgl: 'Este aparelho não mostra a escultura em 3D. O desenho do contorno e todo o texto continuam aqui.',
  software: 'Sem aceleração de vídeo, a escultura em 3D ficaria lenta demais. O desenho do contorno e todo o texto continuam aqui.',
  plaque: ['O Leão da tribo de Judá', 'APOCALIPSE 5:5'] as [string, string],

  textTitle: 'O texto',
  textBadge: 'Texto bíblico',
  verse:
    'E disse-me um dos anciãos: Não chores; eis aqui o Leão da tribo de Judá, a raiz de Davi, que venceu, para abrir o livro e desatar os seus sete selos.',
  verseRef: 'Apocalipse 5:5',
  verseNext:
    'E olhei, e eis que estava no meio do trono e dos quatro animais viventes e entre os anciãos um Cordeiro, como havendo sido morto, e tinha sete chifres e sete olhos, que são os sete espíritos de Deus enviados a toda a terra.',
  verseNextRef: 'Apocalipse 5:6',
  translation: 'Tradução: Almeida Corrigida Fiel (ACF).',

  contextTitle: 'O contexto',
  contextBadge: 'Explicação',
  context: [
    'No capítulo 5 do Apocalipse, João vê um livro em forma de rolo, selado com sete selos, na mão daquele que está sentado no trono. Ninguém é achado digno de abri-lo, e João chora. Um dos anciãos o consola: o Leão da tribo de Judá venceu e pode abrir o livro.',
    'As duas imagens vêm de textos mais antigos. Na bênção de Jacó, Judá é comparado a um leão, e dele não se afastaria o cetro (Gênesis 49:9–10). “Raiz de Davi” retoma a profecia do rebento que brotaria da linhagem de Jessé, o pai de Davi (Isaías 11:1, 10).',
    'Logo em seguida, quando João olha, o que ele vê não é um leão, mas um Cordeiro, “como havendo sido morto” (5:6). Na leitura cristã tradicional, as duas imagens falam de Jesus: a vitória anunciada como a de um leão acontece pelo sacrifício do cordeiro.',
  ],
  contextRefs: 'Gênesis 49:9–10 · Isaías 11:1, 10 · Apocalipse 5:1–6',

  artTitle: 'A interpretação artística',
  artBadge: 'Interpretação artística',
  art: [
    'A escultura é uma interpretação artística do símbolo do leão de Judá, feita para esta página. Não é um retrato de Jesus, não pretende representá-lo literalmente e não é uma imagem de culto.',
    'O leão está de pé, com uma pata dianteira avançada — a postura do “leão passante” dos brasões — e a cabeça erguida, voltada para quem olha. A sequência mostra as etapas de uma obra de escultura: desenho, armação, estudo de volumes, modelagem, fundição e acabamento.',
    'A escultura é gerada em código no seu aparelho (um campo de distância convertido em malha), sem modelo baixado da internet. As proporções são estilizadas, não anatômicas.',
  ],

  whyTitle: 'Por que no Bezalel',
  why: 'Bezalel, o artesão que construiu o Tabernáculo, era “da tribo de Judá” (Êxodo 31:2). O leão é o símbolo dessa tribo. A origem do nome conta a história do artesão; esta experiência mostra, em escultura, o símbolo da tribo de onde ele veio.',
  whyLink: 'Ler a origem do nome',
};

export type LionContent = Widen<typeof ptBR>;

const en: LionContent = {
  eyebrow: 'Experience · Revelation 5:5',
  title: 'The Lion of the tribe of Judah',
  lead: 'A sculpture that takes shape before you — from line drawing to bronze — inspired by a verse from Revelation. Turn it, zoom in, step through the stages of its making and read the text that inspired it.',
  stageLabel: 'Sculpture of the Lion of the tribe of Judah',
  stages: [
    { name: 'Silhouette', text: 'Before matter, the drawing: the outline of the lion traced on the drafting board.' },
    { name: 'Structure', text: 'The armature of rods that holds the work up — spine, legs, tail and the lines of the mane.' },
    { name: 'Volumes', text: 'The plaster study block: only the main masses, still faceted.' },
    { name: 'Head and mane', text: 'The clay form: the face, the muscles and the mane in locks.' },
    { name: 'Materials', text: 'The bronze cast, with patina darkening the hollows and polish on what is exposed.' },
    { name: 'The work', text: 'The finished sculpture on its pedestal, under museum light.' },
  ],
  stageStatus: (n: number, total: number, name: string) => `Stage ${n} of ${total}: ${name}`,
  sculpting: 'Sculpting…',
  prev: 'Previous stage',
  next: 'Next stage',
  restart: 'Restart the sequence',
  pause: 'Pause the sequence',
  play: 'Resume the sequence',
  stagesNav: 'Stages of the making',
  views: 'Explore details',
  viewNames: { full: 'Full view', head: 'Head', mane: 'Mane', paws: 'Paws', tail: 'Tail' },
  hint: 'Drag to turn · scroll or pinch to zoom · arrow keys and + / − on the keyboard',
  touchStart: 'Tap to turn the sculpture',
  touchDone: 'Done',
  noWebgl: 'This device cannot show the sculpture in 3D. The outline drawing and the full text are still here.',
  software: 'Without graphics acceleration, the 3D sculpture would be too slow. The outline drawing and the full text are still here.',
  plaque: ['The Lion of the tribe of Judah', 'REVELATION 5:5'] as [string, string],

  textTitle: 'The text',
  textBadge: 'Biblical text',
  verse:
    'And one of the elders saith unto me, Weep not: behold, the Lion of the tribe of Judah, the Root of David, hath prevailed to open the book, and to loose the seven seals thereof.',
  verseRef: 'Revelation 5:5',
  verseNext:
    'And I beheld, and, lo, in the midst of the throne and of the four beasts, and in the midst of the elders, stood a Lamb as it had been slain, having seven horns and seven eyes, which are the seven Spirits of God sent forth into all the earth.',
  verseNextRef: 'Revelation 5:6',
  translation: 'Translation: King James Version (KJV).',

  contextTitle: 'The context',
  contextBadge: 'Explanation',
  context: [
    'In chapter 5 of Revelation, John sees a scroll sealed with seven seals in the hand of the one seated on the throne. No one is found worthy to open it, and John weeps. One of the elders comforts him: the Lion of the tribe of Judah has prevailed and can open the scroll.',
    'Both images come from older texts. In Jacob’s blessing, Judah is compared to a lion, and the scepter would not depart from him (Genesis 49:9–10). “Root of David” echoes the prophecy of the shoot that would spring from the line of Jesse, David’s father (Isaiah 11:1, 10).',
    'Right after that, when John looks, what he sees is not a lion but a Lamb, “as it had been slain” (5:6). In traditional Christian reading, both images speak of Jesus: the victory announced as a lion’s comes through the sacrifice of the lamb.',
  ],
  contextRefs: 'Genesis 49:9–10 · Isaiah 11:1, 10 · Revelation 5:1–6',

  artTitle: 'The artistic interpretation',
  artBadge: 'Artistic interpretation',
  art: [
    'The sculpture is an artistic interpretation of the symbol of the lion of Judah, made for this page. It is not a portrait of Jesus, it does not claim to represent him literally and it is not an object of worship.',
    'The lion stands with one front paw forward — the posture of the heraldic “lion passant” — and its head raised, turned toward the viewer. The sequence follows the steps of a sculptural work: drawing, armature, volume study, modelling, casting and finishing.',
    'The sculpture is generated in code on your device (a distance field turned into a mesh), with no model downloaded from the internet. Its proportions are stylized, not anatomical.',
  ],

  whyTitle: 'Why at Bezalel',
  why: 'Bezalel, the craftsman who built the Tabernacle, was “of the tribe of Judah” (Exodus 31:2). The lion is that tribe’s symbol. The origin of the name tells the craftsman’s story; this experience shows, in sculpture, the symbol of the tribe he came from.',
  whyLink: 'Read the origin of the name',
};

export const lionContent: Record<Locale, LionContent> = { 'pt-BR': ptBR, en };
