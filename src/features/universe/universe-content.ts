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
  eyebrow: 'Bezalel Universe 2.0 · mundo aberto',
  title: 'Uma cidade para explorar o que a Bezalel constrói.',
  lead: 'Caminhe pela cidade, entre num carro futurista e dirija, ou pegue o carro voador. Veja o trânsito nas ruas e no céu e visite a sede, o laboratório de IA e o centro de produtos — cada edifício leva a uma parte real do site.',
  note: 'Experiência em construção: a cidade, os veículos e o trânsito são ilustrativos; os produtos e links são reais.',
  launcher: {
    enter3d: 'Explorar em 3D',
    open2d: 'Ver o mapa da cidade',
    mapLead: 'A mesma cidade em planta: os locais, o que há em cada um e os links — sem 3D.',
    webglOk: 'Seu navegador suporta WebGL.',
    webglMissing: 'WebGL indisponível neste navegador: use o mapa da cidade.',
    lowPower: 'Aparelho modesto detectado: a qualidade começa mais leve e se ajusta sozinha (dá para trocar).',
    reducedMotion: 'Movimento reduzido ativo: o trânsito fica parado, a câmera não muda o campo de visão e o transporte para os locais é direto.',
    sizeNote: 'A cena é baixada só agora (cerca de 270 kB comprimidos, junto com o motor 3D).',
    loading: 'Montando a cidade…',
    preparing: 'Preparando a cidade para rodar liso…',
    rotateTip: 'No celular, deite o aparelho e use a tela cheia: mais cidade na tela e os controles ao alcance dos polegares.',
  },
  rotate: {
    title: 'Gire o celular',
    body: 'O Universe fica melhor com o celular deitado: mais cidade na tela, o controle de movimento num polegar e os pedais e botões no outro.',
    fullscreen: 'Tela cheia na horizontal',
    dismiss: 'Continuar assim',
  },
  hud: {
    badge: 'Mundo aberto · em construção',
    places: 'Locais',
    open: (name: string) => `Abrir: ${name}`,
    near: (name: string) => `Abrir: ${name}`,
    enter: (name: string) => `Entrar: ${name}`,
    exitVehicle: 'Sair do veículo',
    pressE: 'E',
    tap: 'Toque',
    home: 'Voltar ao início',
    help: 'Controles',
    pause: 'Pausar animações',
    resume: 'Retomar animações',
    quality: 'Qualidade gráfica',
    qualityNames: { low: 'Baixa', medium: 'Média', high: 'Alta', ultra: 'Ultra' } as Record<'low' | 'medium' | 'high' | 'ultra', string>,
    qualityAuto: 'Auto',
    qualityAutoNow: (level: string) => `Automática — agora: ${level}`,
    highFps: (level: string) => `Seu aparelho tem fôlego de sobra: a qualidade subiu para ${level}.`,
    trialFailed: (level: string) => `${level} não ficou liso neste aparelho: voltamos para o nível anterior.`,
    map: 'Ver o mapa (2D)',
    fullscreen: 'Tela cheia',
    exitFullscreen: 'Sair da tela cheia',
    liftHint: 'sobe/desce',
    exit: 'Sair do Universe',
    joystick: 'Controle de movimento: arraste na direção em que quer ir',
    steering: 'Volante: arraste para os lados para virar',
    up: 'Subir',
    down: 'Descer',
    boost: 'Turbo',
    run: 'Correr',
    gas: 'Acelerar',
    brake: 'Frear / ré',
    handbrake: 'Freio de mão',
    flying: (name: string) => `Piloto automático: ${name}`,
    cancel: 'Assumir o controle',
    modes: { foot: 'A pé', car: (name: string) => `Dirigindo: ${name}`, hover: 'Pilotando o carro voador' },
    speed: (kmh: number) => `${kmh} km/h`,
    altitude: (m: number) => `${m} m`,
    notices: {
      blocked: 'Não há espaço livre para descer aqui: mova o veículo um pouco.',
      braking: 'Parando para você descer…',
      landing: 'Pousando para você descer…',
    } as Record<'blocked' | 'braking' | 'landing', string>,
    lowFps: 'A cena estava lenta: baixamos a qualidade gráfica um nível.',
    lost: 'O 3D parou de responder neste aparelho. Mostrando o mapa da cidade.',
    paused: 'Animações pausadas',
    present: 'Apresentação',
    mute: 'Desligar o som',
    viewInside: 'Ver de dentro',
    viewOutside: 'Ver de fora',
    unmute: 'Ligar o som',
    exitPresent: 'Sair da apresentação',
    cinemaShots: {
      avenue: 'Avenida Bezalel',
      plaza: 'Praça Bezalel',
      hq: 'Sede Bezalel',
      lab: 'Laboratório de IA',
      products: 'Centro de Produtos',
      aerial: 'A cidade vista do alto',
    } as Record<'avenue' | 'plaza' | 'hq' | 'lab' | 'products' | 'aerial', string>,
  },
  vehicles: {
    aurora: 'Sedã Aurora',
    vento: 'Esportivo Vento',
    'taxi-1': 'Táxi autônomo',
    'taxi-2': 'Táxi autônomo',
    marinho: 'Sedã Marinho',
    grafite: 'Esportivo Grafite',
    hover: 'Carro voador',
  } as Record<string, string>,
  help: {
    title: 'Como jogar',
    lead: 'Você chega a pé ao parque de chegada, de frente para a praça. Ao lado há carros (sedã, esportivo e táxi) e, no heliponto, o carro voador. Edifícios com sinalização dourada são interativos.',
    sections: [
      {
        title: 'A pé',
        keys: [
          ['W A S D / setas', 'andar (na direção da câmera)'],
          ['Shift', 'correr'],
          ['E', 'entrar no veículo ou abrir o local próximo'],
        ],
      },
      {
        title: 'Dirigindo',
        keys: [
          ['W / ↑', 'acelerar'],
          ['S / ↓', 'frear; parado, dá ré'],
          ['A D / ← →', 'virar (o volante volta sozinho)'],
          ['Espaço', 'freio de mão (curvas fechadas)'],
          ['E', 'sair do veículo'],
        ],
      },
      {
        title: 'Carro voador',
        keys: [
          ['W S  ·  A D / ← →', 'acelerar, frear · virar'],
          ['↑ ↓  ·  Espaço / C', 'subir · descer'],
          ['Shift', 'turbo'],
          ['E', 'pousar e sair'],
        ],
      },
    ] as Array<{ title: string; keys: Array<[string, string]> }>,
    general: [
      ['H', 'voltar ao início'],
      ['F', 'tela cheia'],
      ['Arrastar / roda', 'olhar em volta / aproximar'],
    ] as Array<[string, string]>,
    gamepad: 'Controle (Xbox/PlayStation): analógico esquerdo move e vira; RT acelera; LT freia; A entra, sai e abre; B freio de mão; analógico direito gira a câmera.',
    touch: 'Toque: o controle circular move (a pé) ou vira (no carro); os botões à direita correm, aceleram, freiam ou sobem e descem; o botão central entra, sai e abre.',
    places: 'Prefere ir direto? Em “Locais”, escolha um destino.',
    start: 'Começar a explorar',
  },
  map: {
    title: 'Mapa da cidade',
    lead: 'O coração do Universe: a praça no centro, a sede ao norte, o laboratório a leste, o centro de produtos a oeste e o parque de chegada ao sul — com a cidade em volta.',
    label: 'Planta da primeira área do Bezalel Universe',
    switch3d: 'Explorar em 3D',
  },
  panel: {
    flyHere: 'Ir até aqui',
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
      description: 'Onde a visita começa: carros estacionados e o carro voador no heliponto. “Voltar ao início” traz você para cá a qualquer momento.',
      actions: [{ label: 'Voltar ao site', to: '/' }],
    },
  } satisfies Record<PlaceId, PlaceText>,
};

type Content = typeof pt;

const en: Content = {
  eyebrow: 'Bezalel Universe 2.0 · open world',
  title: 'A city to explore what Bezalel builds.',
  lead: 'Walk around the city, get into a futuristic car and drive, or take the hover car. Watch traffic on the streets and in the sky and visit the headquarters, the AI lab and the products center — every building leads to a real part of the site.',
  note: 'Work in progress: the city, the vehicles and the traffic are illustrative; the products and links are real.',
  launcher: {
    enter3d: 'Explore in 3D',
    open2d: 'See the city map',
    mapLead: 'The same city as a plan: the places, what each one holds and the links — no 3D.',
    webglOk: 'Your browser supports WebGL.',
    webglMissing: 'WebGL is unavailable in this browser: use the city map.',
    lowPower: 'Modest device detected: quality starts lighter and adjusts itself (you can switch).',
    reducedMotion: 'Reduced motion is on: traffic stays parked, the camera keeps its field of view and travel to places is instant.',
    sizeNote: 'The scene is downloaded only now (about 270 kB compressed, with the 3D engine).',
    loading: 'Building the city…',
    preparing: 'Getting the city ready to run smoothly…',
    rotateTip: 'On a phone, turn it sideways and go full screen: more city on screen and the controls under both thumbs.',
  },
  rotate: {
    title: 'Turn your phone',
    body: 'The Universe works best with the phone sideways: more city on screen, the movement control under one thumb and the pedals and buttons under the other.',
    fullscreen: 'Full screen, landscape',
    dismiss: 'Keep it this way',
  },
  hud: {
    badge: 'Open world · in progress',
    places: 'Places',
    open: (name) => `Open: ${name}`,
    near: (name) => `Open: ${name}`,
    enter: (name) => `Get in: ${name}`,
    exitVehicle: 'Get out',
    pressE: 'E',
    tap: 'Tap',
    home: 'Back to start',
    help: 'Controls',
    pause: 'Pause animations',
    resume: 'Resume animations',
    quality: 'Graphics quality',
    qualityNames: { low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' },
    qualityAuto: 'Auto',
    qualityAutoNow: (level) => `Automatic — now: ${level}`,
    highFps: (level) => `Your device has power to spare: quality went up to ${level}.`,
    trialFailed: (level) => `${level} wasn't smooth on this device: we went back one level.`,
    map: 'See the map (2D)',
    fullscreen: 'Full screen',
    exitFullscreen: 'Exit full screen',
    liftHint: 'up/down',
    exit: 'Leave the Universe',
    joystick: 'Movement control: drag in the direction you want to go',
    steering: 'Steering: drag sideways to turn',
    up: 'Up',
    down: 'Down',
    boost: 'Boost',
    run: 'Run',
    gas: 'Accelerate',
    brake: 'Brake / reverse',
    handbrake: 'Handbrake',
    flying: (name) => `Autopilot: ${name}`,
    cancel: 'Take control',
    modes: { foot: 'On foot', car: (name) => `Driving: ${name}`, hover: 'Flying the hover car' },
    speed: (kmh) => `${kmh} km/h`,
    altitude: (m) => `${m} m`,
    notices: {
      blocked: 'No free space to get out here: move the vehicle a little.',
      braking: 'Stopping so you can get out…',
      landing: 'Landing so you can get out…',
    },
    lowFps: 'The scene was slow: we lowered the graphics quality one level.',
    lost: '3D stopped responding on this device. Showing the city map.',
    paused: 'Animations paused',
    present: 'Presentation',
    mute: 'Mute sound',
    viewInside: 'Inside view',
    viewOutside: 'Outside view',
    unmute: 'Turn sound on',
    exitPresent: 'Leave the presentation',
    cinemaShots: {
      avenue: 'Bezalel Avenue',
      plaza: 'Bezalel Plaza',
      hq: 'Bezalel HQ',
      lab: 'AI Lab',
      products: 'Products Center',
      aerial: 'The city from above',
    },
  },
  vehicles: {
    aurora: 'Aurora sedan',
    vento: 'Vento sports car',
    'taxi-1': 'Autonomous taxi',
    'taxi-2': 'Autonomous taxi',
    marinho: 'Marinho sedan',
    grafite: 'Grafite sports car',
    hover: 'Hover car',
  },
  help: {
    title: 'How to play',
    lead: 'You arrive on foot at the arrival park, facing the plaza. Next to you there are cars (sedan, sports car and taxi) and, on the helipad, the hover car. Buildings with gold signage are interactive.',
    sections: [
      {
        title: 'On foot',
        keys: [
          ['W A S D / arrows', 'walk (where the camera faces)'],
          ['Shift', 'run'],
          ['E', 'get in the vehicle or open the nearby place'],
        ],
      },
      {
        title: 'Driving',
        keys: [
          ['W / ↑', 'accelerate'],
          ['S / ↓', 'brake; when stopped, reverse'],
          ['A D / ← →', 'steer (the wheel re-centers by itself)'],
          ['Space', 'handbrake (tight turns)'],
          ['E', 'get out'],
        ],
      },
      {
        title: 'Hover car',
        keys: [
          ['W S  ·  A D / ← →', 'speed up, brake · turn'],
          ['↑ ↓  ·  Space / C', 'up · down'],
          ['Shift', 'boost'],
          ['E', 'land and get out'],
        ],
      },
    ],
    general: [
      ['H', 'back to start'],
      ['F', 'full screen'],
      ['Drag / wheel', 'look around / zoom'],
    ],
    gamepad: 'Gamepad (Xbox/PlayStation): left stick moves and steers; RT accelerates; LT brakes; A gets in, out and opens; B handbrake; right stick turns the camera.',
    touch: 'Touch: the round control moves (on foot) or steers (in the car); the buttons on the right run, accelerate, brake or go up and down; the center button gets in, out and opens.',
    places: 'Rather go straight there? In “Places”, pick a destination.',
    start: 'Start exploring',
  },
  map: {
    title: 'City map',
    lead: 'The heart of the Universe: the plaza at the center, the headquarters to the north, the lab to the east, the products center to the west and the arrival park to the south — surrounded by the city.',
    label: 'Plan of the first area of the Bezalel Universe',
    switch3d: 'Explore in 3D',
  },
  panel: {
    flyHere: 'Go here',
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
      description: 'Where the visit begins: parked cars and the hover car on the helipad. “Back to start” brings you here at any time.',
      actions: [{ label: 'Back to the site', to: '/' }],
    },
  },
};

export const universeContent: Record<Locale, Content> = { 'pt-BR': pt, en };
