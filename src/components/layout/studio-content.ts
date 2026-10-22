import type { Widen } from '@/i18n/types';
import type { Locale } from '@/types/domain';

/*
 * Textos do mapa "um estúdio, várias obras" e da ponte da origem para o Leão.
 * Ficam num chunk compartilhado só pelas páginas que os mostram (Sobre e o
 * Leão), fora do i18n global — que vai no JS inicial de todo o site.
 */
const ptBR = {
  eyebrow: 'Um estúdio, várias obras',
  title: 'A Bezalel constrói produtos e experiências.',
  lead: 'O catálogo verificado e as ferramentas de estudo são o produto que você usa no dia a dia. Em volta dele, cada experiência mostra uma face do mesmo ofício — cada uma com a sua linguagem.',
  current: 'Você está aqui',
  items: {
    forja: { name: 'A Forja', kind: 'Construção', text: 'A estrutura da Bezalel montada pela rolagem, com os dados reais do catálogo.' },
    origem: { name: 'A origem', kind: 'História', text: 'A história do artesão Bezalel, erguida volta a volta com uma manivela.' },
    lion: { name: 'O Leão de Judá', kind: 'Luz', text: 'Apocalipse 5 ao rolar: o livro dos sete selos e o leão que se forma de poeira de luz.' },
    lab: { name: 'Laboratório', kind: 'Processos', text: 'Os agentes trabalhando num campus 3D: descobrir, verificar, organizar.' },
    universe: { name: 'Bezalel Universe', kind: 'Exploração', text: 'A cidade da Bezalel para percorrer a pé, de carro ou voando.' },
  },
  bridge: {
    eyebrow: 'Da origem à tribo',
    title: 'Bezalel era da tribo de Judá. O símbolo dela é o leão.',
    text: 'O texto apresenta o artesão como “filho de Uri, filho de Hur, da tribo de Judá” (Êxodo 31:2). Séculos depois, o Apocalipse chama de “Leão da tribo de Judá” aquele que venceu para abrir o livro (Apocalipse 5:5). Uma cena em luz conta essa passagem, conduzida pela rolagem.',
    cta: 'Entrar na cena do Leão de Judá',
  },
};

export type StudioContent = Widen<typeof ptBR>;

const en: StudioContent = {
  eyebrow: 'One studio, several works',
  title: 'Bezalel builds products and experiences.',
  lead: 'The verified catalog and the study tools are the product you use every day. Around it, each experience shows one face of the same craft — each in its own language.',
  current: 'You are here',
  items: {
    forja: { name: 'The Forge', kind: 'Construction', text: 'Bezalel’s structure assembled as you scroll, with the catalog’s real data.' },
    origem: { name: 'The origin', kind: 'Story', text: 'The story of the craftsman Bezalel, raised turn by turn with a crank.' },
    lion: { name: 'The Lion of Judah', kind: 'Light', text: 'Revelation 5 as you scroll: the book of seven seals and the lion formed from dust of light.' },
    lab: { name: 'Lab', kind: 'Processes', text: 'The agents at work on a 3D campus: discover, verify, organize.' },
    universe: { name: 'Bezalel Universe', kind: 'Exploration', text: 'Bezalel’s city to roam on foot, by car or flying.' },
  },
  bridge: {
    eyebrow: 'From the origin to the tribe',
    title: 'Bezalel was of the tribe of Judah. Its symbol is the lion.',
    text: 'The text introduces the craftsman as “the son of Uri, the son of Hur, of the tribe of Judah” (Exodus 31:2). Centuries later, Revelation calls the one who prevailed to open the book “the Lion of the tribe of Judah” (Revelation 5:5). A scene of light tells that passage, driven by your scroll.',
    cta: 'Enter the scene of the Lion of Judah',
  },
};

export const studioContent: Record<Locale, StudioContent> = { 'pt-BR': ptBR, en };
