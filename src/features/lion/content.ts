import type { Widen } from '@/i18n/types';
import type { Locale } from '@/types/domain';
import type { ActId } from './journey';

/*
 * Textos da experiência "O Leão da tribo de Judá". Ficam no chunk da página
 * (fora do i18n global, que vai no JS inicial). O inglês é obrigado pelo tipo
 * a ter as mesmas chaves do português.
 *
 * Três vozes, sempre separadas e rotuladas: o texto bíblico (citação literal,
 * com a tradução indicada — ACF em português, KJV em inglês), o contexto
 * (explicação, com as referências) e a interpretação artística (o que a cena é
 * e o que ela não é). Nos atos da rolagem, só citação literal e a referência;
 * trechos omitidos aparecem como […].
 */
const ptBR = {
  eyebrow: 'Experiência · Apocalipse 5',
  title: 'O Leão da tribo de Judá',
  lead: 'Role para atravessar a cena: um livro selado com sete selos, a poeira de luz que vira leão, os selos que se rompem. Mova o cursor — a luz responde.',
  stageLabel: 'Apocalipse 5 em luz: o livro dos sete selos e o Leão da tribo de Judá',
  scrollHint: 'Role para começar',
  pointerHint: 'Mova o cursor sobre a luz',
  skip: 'Pular para o texto',
  progress: 'Progresso da cena',
  acts: {
    book: { ref: 'Apocalipse 5:1', quote: 'E vi na destra do que estava assentado sobre o trono um livro escrito por dentro e por fora, selado com sete selos.' },
    worthy: { ref: 'Apocalipse 5:2–3', quote: 'Quem é digno de abrir o livro e de desatar os seus selos? E ninguém no céu, nem na terra, nem debaixo da terra, podia abrir o livro, nem olhar para ele.' },
    weep: { ref: 'Apocalipse 5:4–5', quote: 'E eu chorava muito […]. E disse-me um dos anciãos: Não chores;' },
    lion: { ref: 'Apocalipse 5:5', quote: 'eis aqui o Leão da tribo de Judá, a raiz de Davi,' },
    seals: { ref: 'Apocalipse 5:5', quote: 'que venceu, para abrir o livro e desatar os seus sete selos.' },
    lamb: { ref: 'Apocalipse 5:6', quote: 'E olhei, e eis que estava no meio do trono […] um Cordeiro, como havendo sido morto.' },
  } satisfies Record<ActId, { ref: string; quote: string }>,
  noWebgl: 'Este aparelho não mostra a cena em 3D. O texto de cada momento e as explicações continuam aqui.',
  software: 'Sem aceleração de vídeo, a cena em 3D ficaria lenta demais. O texto de cada momento e as explicações continuam aqui.',
  still: 'Com “reduzir movimento” ativo, a cena aparece no seu último momento, parada. O texto de cada momento segue abaixo.',

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
    'A cena é uma interpretação artística do capítulo, feita para esta página. O leão é luz, não um retrato: não é um retrato de Jesus, não pretende representá-lo literalmente e não é uma imagem de culto. Quem está sentado no trono não é mostrado — o texto diz apenas que o livro está na sua mão.',
    'A poeira de luz que gira em volta do livro é a mesma que forma o leão: ele não aparece pronto, é composto diante de você. Os selos se rompem um a um, como no texto, e o livro se abre aceso por dentro. As linhas escritas na folha são abstratas — não reproduzem nenhum texto.',
    'Tudo é gerado em código no seu aparelho: a forma do leão é um campo de distância convertido em pontos, e cada partícula faz o seu caminho na placa de vídeo. Nenhum modelo ou imagem é baixado da internet.',
  ],

  whyTitle: 'Por que no Bezalel',
  why: 'Bezalel, o artesão que construiu o Tabernáculo, era “da tribo de Judá” (Êxodo 31:2). O leão é o símbolo dessa tribo. A origem do nome conta a história do artesão; esta experiência mostra, em luz, a imagem da tribo de onde ele veio.',
  whyLink: 'Ler a origem do nome',
};

export type LionContent = Widen<typeof ptBR>;

const en: LionContent = {
  eyebrow: 'Experience · Revelation 5',
  title: 'The Lion of the tribe of Judah',
  lead: 'Scroll through the scene: a book sealed with seven seals, the dust of light that becomes a lion, the seals that break. Move the cursor — the light answers.',
  stageLabel: 'Revelation 5 in light: the book of seven seals and the Lion of the tribe of Judah',
  scrollHint: 'Scroll to begin',
  pointerHint: 'Move the cursor over the light',
  skip: 'Skip to the text',
  progress: 'Scene progress',
  acts: {
    book: { ref: 'Revelation 5:1', quote: 'And I saw in the right hand of him that sat on the throne a book written within and on the backside, sealed with seven seals.' },
    worthy: { ref: 'Revelation 5:2–3', quote: 'Who is worthy to open the book, and to loose the seals thereof? And no man in heaven, nor in earth, neither under the earth, was able to open the book, neither to look thereon.' },
    weep: { ref: 'Revelation 5:4–5', quote: 'And I wept much […]. And one of the elders saith unto me, Weep not:' },
    lion: { ref: 'Revelation 5:5', quote: 'behold, the Lion of the tribe of Judah, the Root of David,' },
    seals: { ref: 'Revelation 5:5', quote: 'hath prevailed to open the book, and to loose the seven seals thereof.' },
    lamb: { ref: 'Revelation 5:6', quote: 'And I beheld, and, lo, in the midst of the throne […] stood a Lamb as it had been slain.' },
  },
  noWebgl: 'This device cannot show the scene in 3D. The text of each moment and the explanations are still here.',
  software: 'Without graphics acceleration, the 3D scene would be too slow. The text of each moment and the explanations are still here.',
  still: 'With “reduce motion” on, the scene shows its last moment, still. The text of each moment follows below.',

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
    'The scene is an artistic interpretation of the chapter, made for this page. The lion is light, not a portrait: it is not a portrait of Jesus, it does not claim to represent him literally and it is not an object of worship. The one seated on the throne is not shown — the text only says the book is in his hand.',
    'The dust of light swirling around the book is the same that forms the lion: it does not appear ready-made, it is composed before you. The seals break one by one, as in the text, and the book opens lit from within. The lines written on the page are abstract — they reproduce no text.',
    'Everything is generated in code on your device: the lion’s form is a distance field turned into points, and each particle travels its own path on the graphics card. No model or image is downloaded from the internet.',
  ],

  whyTitle: 'Why at Bezalel',
  why: 'Bezalel, the craftsman who built the Tabernacle, was “of the tribe of Judah” (Exodus 31:2). The lion is that tribe’s symbol. The origin of the name tells the craftsman’s story; this experience shows, in light, the image of the tribe he came from.',
  whyLink: 'Read the origin of the name',
};

export const lionContent: Record<Locale, LionContent> = { 'pt-BR': ptBR, en };
