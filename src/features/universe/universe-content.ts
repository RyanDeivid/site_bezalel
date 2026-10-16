import type { Locale } from '@/types/domain';
import type { PlaceId } from './world/city';
import type { ProductGroup } from './world/products';

/**
 * Textos do Bezalel Universe. Ficam no chunk da página — fora do i18n global,
 * que vai no JS inicial. Nada aqui anuncia produto, parceiro ou agente que não
 * exista: os produtos vêm de `world/products.ts` (rotas reais) e o trânsito é
 * dito ilustrativo.
 */

export interface PlaceAction {
  label: string;
  to: string;
}

export interface PlaceText {
  name: string;
  kicker: string;
  description: string;
  actions: PlaceAction[];
}

const pt = {
  eyebrow: 'Bezalel Universe · primeira área',
  title: 'Uma cidade para explorar o que a Bezalel constrói.',
  lead: 'Pilote um carro voador por uma praça futurista e visite a sede, o laboratório de IA e o centro de produtos. Cada edifício leva a uma parte real do site.',
  note: 'Experiência em construção: a cidade e o trânsito são ilustrativos; os produtos e links são reais.',
  launcher: {
    enter3d: 'Pilotar em 3D',
    open2d: 'Ver o mapa da cidade',
    mapLead: 'A mesma cidade em planta: os locais, o que há em cada um e os links — sem 3D.',
    webglOk: 'Seu navegador suporta WebGL.',
    webglMissing: 'WebGL indisponível neste navegador: use o mapa da cidade.',
    lowPower: 'Aparelho modesto detectado: começamos na qualidade baixa (dá para trocar).',
    reducedMotion: 'Movimento reduzido ativo: o trânsito fica parado e o piloto automático leva você direto ao local.',
    sizeNote: 'A cena é baixada só agora (cerca de 250 kB comprimidos, junto com o motor 3D).',
    loading: 'Montando a cidade…',
    rotateTip: 'No celular, deite o aparelho e use a tela cheia: mais cidade na tela e os controles ao alcance dos polegares.',
  },
  rotate: {
    title: 'Gire o celular',
    body: 'O Universe fica melhor com o celular deitado: mais cidade na tela e o controle de voo e os botões de subir e descer ao alcance dos dois polegares.',
    fullscreen: 'Tela cheia na horizontal',
    dismiss: 'Continuar assim',
  },
  hud: {
    badge: 'Experiência 3D · em construção',
    places: 'Locais',
    goTo: (name: string) => `Voar até: ${name}`,
    open: (name: string) => `Abrir: ${name}`,
    near: (name: string) => `Entrar: ${name}`,
    pressE: 'E',
    tap: 'Toque',
    home: 'Voltar ao início',
    help: 'Controles',
    pause: 'Pausar animações',
    resume: 'Retomar animações',
    qualityLow: 'Mudar para qualidade baixa',
    qualityHigh: 'Mudar para qualidade alta',
    quality: (q: 'high' | 'low'): string => (q === 'high' ? 'Qualidade alta' : 'Qualidade baixa'),
    map: 'Ver o mapa (2D)',
    fullscreen: 'Tela cheia',
    exitFullscreen: 'Sair da tela cheia',
    exit: 'Sair do Universe',
    joystick: 'Controle de voo: arraste para cima para acelerar, para os lados para virar',
    up: 'Subir',
    down: 'Descer',
    boost: 'Turbo',
    flying: (name: string) => `Piloto automático: ${name}`,
    cancel: 'Assumir o controle',
    altitude: (m: number) => `${m} m`,
    lowFps: 'A cena estava lenta: mudamos para a qualidade baixa.',
    lost: 'O 3D parou de responder neste aparelho. Mostrando o mapa da cidade.',
    paused: 'Animações pausadas',
  },
  help: {
    title: 'Como pilotar',
    lead: 'Você está num carro voador, no parque de chegada, de frente para a praça. Os edifícios com sinalização dourada são interativos.',
    keyboard: 'Teclado',
    keys: [
      ['W / ↑', 'acelerar'],
      ['S / ↓', 'frear e dar ré'],
      ['A D / ← →', 'virar'],
      ['Espaço / R', 'subir'],
      ['C / F', 'descer'],
      ['Shift', 'turbo'],
      ['E', 'entrar no local próximo'],
      ['H', 'voltar ao início'],
    ] as Array<[string, string]>,
    mouse: 'Mouse: arraste para olhar em volta, use a roda para aproximar e clique num edifício para abrir.',
    touch: 'Toque: o controle circular pilota; Subir e Descer ficam ao lado; toque num edifício para abrir.',
    places: 'Prefere não pilotar? Em “Locais”, escolha um destino e o piloto automático leva você.',
    start: 'Começar a explorar',
  },
  map: {
    title: 'Mapa da cidade',
    lead: 'A primeira área do Universe: a praça no centro, a sede ao norte, o laboratório a leste, o centro de produtos a oeste e o parque de chegada ao sul.',
    label: 'Planta da primeira área do Bezalel Universe',
    switch3d: 'Pilotar em 3D',
  },
  panel: {
    flyHere: 'Voar até aqui',
    products: { learn: 'Para aprender', intelligence: 'Inteligência' } satisfies Record<ProductGroup, string>,
    live: 'Disponível',
    facts: (agents: number, courses: number) => `${agents} agentes representados · ${courses} cursos verificados no catálogo`,
    labFooter: (courses: number) => `Agentes simulados · ${courses} cursos verificados`,
    productsFooter: 'Disponíveis neste site · sem cadastro',
  },
  places: {
    'bezalel-hq': {
      name: 'Sede Bezalel',
      kicker: 'Edifício principal',
      description:
        'A casa da Bezalel: uma plataforma de inteligência educacional que conecta pessoas a cursos, certificações e competências, com transparência sobre cada fonte. A coroa da torre é o símbolo da marca.',
      actions: [
        { label: 'Conhecer a Bezalel', to: '/about' },
        { label: 'Como verificamos cada curso', to: '/methodology' },
      ],
    },
    'ai-lab': {
      name: 'Laboratório de IA',
      kicker: 'Experimentação',
      description:
        'Onde ficam as estações dos agentes da Bezalel — descobrir, verificar, reconferir e conectar cursos. Neste site, a atividade dos agentes é simulada localmente; os cursos são reais.',
      actions: [
        { label: 'Entrar no laboratório 3D', to: '/lab' },
        { label: 'Conhecer os agentes', to: '/agents' },
      ],
    },
    'products-center': {
      name: 'Centro de Produtos',
      kicker: 'Produtos',
      description: 'As ferramentas que já funcionam neste site — sem cadastro, com cursos verificados na fonte.',
      actions: [],
    },
    plaza: {
      name: 'Praça Bezalel',
      kicker: 'Ponto de encontro',
      description:
        'O centro da cidade. No monumento, o símbolo da marca em três faces: a dourada é Descobrir, a das camadas é Aprender e a de aço é Construir.',
      actions: [{ label: 'Ver a Forja na página inicial', to: '/' }],
    },
    arrival: {
      name: 'Parque de chegada',
      kicker: 'Início',
      description: 'Onde todo voo começa. “Voltar ao início” traz você para cá a qualquer momento.',
      actions: [{ label: 'Voltar ao site', to: '/' }],
    },
  } satisfies Record<PlaceId, PlaceText>,
};

type Content = typeof pt;

const en: Content = {
  eyebrow: 'Bezalel Universe · first area',
  title: 'A city to explore what Bezalel builds.',
  lead: 'Fly a hover car around a futuristic plaza and visit the headquarters, the AI lab and the products center. Every building leads to a real part of the site.',
  note: 'Work in progress: the city and the traffic are illustrative; the products and links are real.',
  launcher: {
    enter3d: 'Fly in 3D',
    open2d: 'See the city map',
    mapLead: 'The same city as a plan: the places, what each one holds and the links — no 3D.',
    webglOk: 'Your browser supports WebGL.',
    webglMissing: 'WebGL is unavailable in this browser: use the city map.',
    lowPower: 'Modest device detected: we start on low quality (you can switch).',
    reducedMotion: 'Reduced motion is on: traffic stays parked and the autopilot takes you straight to the place.',
    sizeNote: 'The scene is downloaded only now (about 250 kB compressed, with the 3D engine).',
    loading: 'Building the city…',
    rotateTip: 'On a phone, turn it sideways and go full screen: more city on screen and the controls under both thumbs.',
  },
  rotate: {
    title: 'Turn your phone',
    body: 'The Universe works best with the phone sideways: more city on screen, with the flight control and the up/down buttons under both thumbs.',
    fullscreen: 'Full screen, landscape',
    dismiss: 'Keep it this way',
  },
  hud: {
    badge: '3D experience · in progress',
    places: 'Places',
    goTo: (name) => `Fly to: ${name}`,
    open: (name) => `Open: ${name}`,
    near: (name) => `Enter: ${name}`,
    pressE: 'E',
    tap: 'Tap',
    home: 'Back to start',
    help: 'Controls',
    pause: 'Pause animations',
    resume: 'Resume animations',
    qualityLow: 'Switch to low quality',
    qualityHigh: 'Switch to high quality',
    quality: (q) => (q === 'high' ? 'High quality' : 'Low quality'),
    map: 'See the map (2D)',
    fullscreen: 'Full screen',
    exitFullscreen: 'Exit full screen',
    exit: 'Leave the Universe',
    joystick: 'Flight control: drag up to speed up, sideways to turn',
    up: 'Up',
    down: 'Down',
    boost: 'Boost',
    flying: (name) => `Autopilot: ${name}`,
    cancel: 'Take control',
    altitude: (m) => `${m} m`,
    lowFps: 'The scene was slow: we switched to low quality.',
    lost: '3D stopped responding on this device. Showing the city map.',
    paused: 'Animations paused',
  },
  help: {
    title: 'How to fly',
    lead: 'You are in a hover car at the arrival park, facing the plaza. Buildings with gold signage are interactive.',
    keyboard: 'Keyboard',
    keys: [
      ['W / ↑', 'speed up'],
      ['S / ↓', 'brake and reverse'],
      ['A D / ← →', 'turn'],
      ['Space / R', 'go up'],
      ['C / F', 'go down'],
      ['Shift', 'boost'],
      ['E', 'enter the nearby place'],
      ['H', 'back to start'],
    ],
    mouse: 'Mouse: drag to look around, scroll to zoom and click a building to open it.',
    touch: 'Touch: the round control flies; Up and Down sit beside it; tap a building to open it.',
    places: 'Rather not fly? In “Places”, pick a destination and the autopilot takes you there.',
    start: 'Start exploring',
  },
  map: {
    title: 'City map',
    lead: 'The first area of the Universe: the plaza at the center, the headquarters to the north, the lab to the east, the products center to the west and the arrival park to the south.',
    label: 'Plan of the first area of the Bezalel Universe',
    switch3d: 'Fly in 3D',
  },
  panel: {
    flyHere: 'Fly here',
    products: { learn: 'To learn', intelligence: 'Intelligence' },
    live: 'Available',
    facts: (agents, courses) => `${agents} agents represented · ${courses} verified courses in the catalog`,
    labFooter: (courses) => `Simulated agents · ${courses} verified courses`,
    productsFooter: 'Available on this site · no sign-up',
  },
  places: {
    'bezalel-hq': {
      name: 'Bezalel Headquarters',
      kicker: 'Main building',
      description:
        "Bezalel's home: an educational intelligence platform that connects people to courses, certifications and skills, with transparency about every source. The tower's crown is the brand symbol.",
      actions: [
        { label: 'Meet Bezalel', to: '/about' },
        { label: 'How we verify every course', to: '/methodology' },
      ],
    },
    'ai-lab': {
      name: 'AI Lab',
      kicker: 'Experimentation',
      description:
        "Home to the stations of Bezalel's agents — discovering, verifying, rechecking and connecting courses. On this site, agent activity is simulated locally; the courses are real.",
      actions: [
        { label: 'Enter the 3D lab', to: '/lab' },
        { label: 'Meet the agents', to: '/agents' },
      ],
    },
    'products-center': {
      name: 'Products Center',
      kicker: 'Products',
      description: 'The tools that already work on this site — no sign-up, with courses verified at the source.',
      actions: [],
    },
    plaza: {
      name: 'Bezalel Plaza',
      kicker: 'Meeting point',
      description: 'The heart of the city. The monument holds the brand symbol in three faces: gold is Discover, the layered one is Learn and steel is Build.',
      actions: [{ label: 'See the Forge on the home page', to: '/' }],
    },
    arrival: {
      name: 'Arrival park',
      kicker: 'Start',
      description: 'Where every flight begins. “Back to start” brings you here at any time.',
      actions: [{ label: 'Back to the site', to: '/' }],
    },
  },
};

export const universeContent: Record<Locale, Content> = { 'pt-BR': pt, en };
