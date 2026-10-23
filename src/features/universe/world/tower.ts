import type { Solid } from './city';

/**
 * Torre Bezalel: a sede da cidade como edifício que se percorre por dentro. Funções puras sobre dados
 * declarativos (testadas sem navegador): a planta de cada andar, o registro dos andares e dos setores, as
 * paredes de colisão e o elevador.
 *
 * Coordenadas do Universe (metros, x leste, z sul, y para cima), as mesmas da sede (`HQ` em
 * landmarkGeometry.ts):
 * - pódio de 40 × 26 m centrado em (0, −80), do chão da quadra (0,3) a 9,3 m, com o saguão envidraçado
 *   recuado em z = −68,4 e voltado para a praça;
 * - a torre afunila de 22 × 16 m (em 9,3 m) a 19 × 13,5 m (em 57,3 m), centrada em (0, −82).
 *
 * Andares: o térreo (recepção) dentro do pódio e doze andares de 4 m na torre; o 12º é a presidência.
 * A fachada da torre só tem a face de fora: de dentro, ela some, e a cidade de verdade aparece pelas
 * janelas (com o vidro interno da cena por cima).
 */

export const TOWER = {
  x: 0,
  /** Eixo da torre (o pódio fica 2 m mais ao sul, em −80). */
  z: -82,
  podium: { minX: -20, maxX: 20, minZ: -93, maxZ: -67, top: 9.3 },
  /** Vidro do saguão (recuado sob a marquise) e o vão da porta nele. */
  lobby: { glassZ: -68.4, halfWidth: 17, top: 7.7, doorHalf: 2.2 },
  /** Chão do térreo (o da quadra) e o teto do salão da recepção. */
  ground: 0.3,
  lobbyCeiling: 7.4,
  towerBase: 9.3,
  towerTop: 57.3,
  floorHeight: 4,
  /** Pé-direito útil de um andar da torre (o resto é laje e forro). */
  clearHeight: 3.55,
  /** Planta da torre na base e no topo (ela afunila). */
  footprint: { base: { w: 22, d: 16 }, top: { w: 19, d: 13.5 } },
  /** Núcleo de circulação (pedra) e a cabina do elevador dentro dele, com a porta para o sul. */
  core: { minX: -3, maxX: 3, minZ: -88, maxZ: -82 },
  cabin: { minX: -1.25, maxX: 1.25, minZ: -85.5, maxZ: -82.2, doorHalf: 0.85, height: 2.6 },
  /** Espessura das paredes de colisão. */
  wall: 0.3,
} as const;

/** Setores da organização (a visão de expansão: nem todos têm andar ainda). */
export type SectorId = 'reception' | 'engineering' | 'marketing' | 'content' | 'legal' | 'intelligence' | 'education' | 'commercial' | 'presidency';

/**
 * Um andar no registro. Para acrescentar um setor, basta preencher o andar dele aqui (e o interior na
 * cena): o elevador, o painel e as colisões leem esta lista.
 */
export interface TowerFloor {
  /** 0 = térreo; 1…12 na torre. */
  index: number;
  sector: SectorId | null;
  /** `open`: dá para descer e andar nele. `planned`: existe no prédio, mas o interior ainda não foi feito. */
  status: 'open' | 'planned';
}

export const TOP_FLOOR = 12;

/** Até que distância (m, no chão) da torre os interiores são desenhados (de longe, a fachada basta). */
export const INTERIOR_REVEAL = 70;

/**
 * Distribuição inicial: a recepção no térreo, a Engenharia no 3º (o primeiro andar operacional, perto do
 * chão: é a que constrói os demais) e a presidência no topo, com a vista. Os demais setores já têm andar
 * reservado, de baixo para cima, do que mais recebe visitantes ao que mais trabalha internamente. Fica
 * para decidir com o crescimento: os andares 1, 2 e 10–11 estão livres.
 */
export const FLOORS: TowerFloor[] = [
  { index: 0, sector: 'reception', status: 'open' },
  { index: 1, sector: null, status: 'planned' },
  { index: 2, sector: null, status: 'planned' },
  { index: 3, sector: 'engineering', status: 'open' },
  { index: 4, sector: 'education', status: 'planned' },
  { index: 5, sector: 'commercial', status: 'planned' },
  { index: 6, sector: 'marketing', status: 'planned' },
  { index: 7, sector: 'content', status: 'planned' },
  { index: 8, sector: 'intelligence', status: 'planned' },
  { index: 9, sector: 'legal', status: 'planned' },
  { index: 10, sector: null, status: 'planned' },
  { index: 11, sector: null, status: 'planned' },
  { index: TOP_FLOOR, sector: 'presidency', status: 'open' },
];

export const floorByIndex = (i: number) => FLOORS.find((f) => f.index === i) ?? null;

/** Altura do piso de um andar. */
export function floorY(index: number): number {
  return index === 0 ? TOWER.ground : TOWER.towerBase + (index - 1) * TOWER.floorHeight;
}

/** Altura do teto (o que a câmera não atravessa). */
export function ceilingY(index: number): number {
  return index === 0 ? TOWER.lobbyCeiling : floorY(index) + TOWER.clearHeight;
}

/** Planta (meia-largura e meia-profundidade) da torre numa altura: ela afunila linearmente. */
export function footprintAt(y: number): { hw: number; hd: number } {
  const { base, top } = TOWER.footprint;
  const k = Math.min(1, Math.max(0, (y - TOWER.towerBase) / (TOWER.towerTop - TOWER.towerBase)));
  return { hw: (base.w + (top.w - base.w) * k) / 2, hd: (base.d + (top.d - base.d) * k) / 2 };
}

/** Planta útil de um andar da torre (por dentro da fachada, na altura do piso). */
export function floorBounds(index: number): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const { hw, hd } = footprintAt(floorY(index) + TOWER.clearHeight);
  const t = TOWER.wall + 0.15;
  return { minX: TOWER.x - hw + t, maxX: TOWER.x + hw - t, minZ: TOWER.z - hd + t, maxZ: TOWER.z + hd - t };
}

const box = (minX: number, maxX: number, minZ: number, maxZ: number, base: number, height: number): Solid => ({ minX, maxX, minZ, maxZ, base, height });

/**
 * Paredes do núcleo num andar: três blocos maciços em volta da cabina e as ombreiras da porta. A porta
 * fechada é um sólido à parte (`doorSolid`).
 */
function coreSolids(base: number, top: number): Solid[] {
  const { core: c, cabin: k } = TOWER;
  return [
    box(c.minX, k.minX, c.minZ, c.maxZ, base, top),
    box(k.maxX, c.maxX, c.minZ, c.maxZ, base, top),
    box(k.minX, k.maxX, c.minZ, k.minZ, base, top),
    box(k.minX, -k.doorHalf, k.maxZ, c.maxZ, base, top),
    box(k.doorHalf, k.maxX, k.maxZ, c.maxZ, base, top),
  ];
}

/** O núcleo inteiro como um bloco (para a câmera de quem está fora dele: ela não entra pelo vão da porta). */
export function coreBlock(base: number, top: number): Solid {
  const c = TOWER.core;
  return box(c.minX, c.maxX, c.minZ, c.maxZ, base, top);
}

/** A porta do elevador fechada (ou quase): ninguém passa. */
export function doorSolid(base: number): Solid {
  const { cabin: k, core: c } = TOWER;
  return box(-k.doorHalf, k.doorHalf, k.maxZ, c.maxZ, base, base + k.height);
}

/**
 * Colisões da sede vista da rua (entram na lista da cidade): o pódio oco, com o vidro do saguão, a porta
 * no meio e as balizas na frente dela (gente passa entre elas, carro não); a laje de cima e o núcleo do
 * elevador no térreo; a torre maciça acima do pódio (para quem voa). Quem anda na rua não bate na torre:
 * a base dela está acima da cabeça.
 */
export function towerStreetSolids(): Solid[] {
  const { podium: p, lobby: l, wall: t, ground: g } = TOWER;
  const top = p.top;
  const glass = l.glassZ;
  const { hw, hd } = footprintAt(TOWER.towerBase);
  return [
    // Paredes de pedra do pódio (oeste, leste, norte) e os dois trechos da frente ao lado do saguão.
    box(p.minX, p.minX + t, p.minZ, p.maxZ, 0, top),
    box(p.maxX - t, p.maxX, p.minZ, p.maxZ, 0, top),
    box(p.minX, p.maxX, p.minZ, p.minZ + t, 0, top),
    box(p.minX, -l.halfWidth, p.maxZ - t, p.maxZ, 0, top),
    box(l.halfWidth, p.maxX, p.maxZ - t, p.maxZ, 0, top),
    // Os retornos do recuo, do vidro até a frente.
    box(-l.halfWidth - t, -l.halfWidth, glass, p.maxZ, 0, top),
    box(l.halfWidth, l.halfWidth + t, glass, p.maxZ, 0, top),
    // O vidro do saguão, com o vão da porta no centro, e a faixa de pedra acima dele.
    box(-l.halfWidth, -l.doorHalf, glass - t / 2, glass + t / 2, 0, l.top),
    box(l.doorHalf, l.halfWidth, glass - t / 2, glass + t / 2, 0, l.top),
    box(-l.halfWidth, l.halfWidth, glass - t / 2, p.maxZ, l.top, top),
    // Balizas na frente da porta: vãos de 1 m (passa uma pessoa, não passa um carro).
    ...[-1.95, -0.65, 0.65, 1.95].map((x) => box(x - 0.15, x + 0.15, glass + 1.1, glass + 1.4, 0, 1.2)),
    // Laje do teto do salão e o núcleo do elevador no térreo.
    box(p.minX, p.maxX, p.minZ, glass, TOWER.lobbyCeiling, top),
    ...coreSolids(g - 0.3, TOWER.lobbyCeiling),
    // Balcão da recepção (em frente ao núcleo, com passagem dos dois lados).
    ...receptionSolids(),
    // A torre acima do pódio, maciça para quem voa.
    box(TOWER.x - hw, TOWER.x + hw, TOWER.z - hd, TOWER.z + hd, top, TOWER.towerTop),
  ];
}

/** Balcão da recepção: um arco reto de 7 m, a meio caminho entre a porta e o elevador. */
export const RECEPTION_DESK = { x: 0, z: -75.5, halfWidth: 3.5, depth: 0.9, height: 1.1 } as const;

function receptionSolids(): Solid[] {
  const d = RECEPTION_DESK;
  return [box(d.x - d.halfWidth, d.x + d.halfWidth, d.z - d.depth / 2, d.z + d.depth / 2, 0, d.height)];
}

/** Móveis com colisão por andar (o interior da cena desenha os mesmos números). */
export const FURNITURE: Partial<Record<number, Array<{ minX: number; maxX: number; minZ: number; maxZ: number; height: number }>>> = {
  // Engenharia: duas fileiras de bancadas, a leste e a oeste do núcleo.
  3: [
    { minX: -9, maxX: -5, minZ: -80.2, maxZ: -78.8, height: 0.78 },
    { minX: -9, maxX: -5, minZ: -77.2, maxZ: -75.8, height: 0.78 },
    { minX: 5, maxX: 9, minZ: -80.2, maxZ: -78.8, height: 0.78 },
    { minX: 5, maxX: 9, minZ: -77.2, maxZ: -75.8, height: 0.78 },
  ],
  // Presidência: a mesa (de frente para a cidade, ao sul) e a mesa de reuniões a oeste.
  12: [
    { minX: -2.6, maxX: 2.6, minZ: -77.9, maxZ: -76.7, height: 0.76 },
    { minX: -8.4, maxX: -5.2, minZ: -85.6, maxZ: -80.4, height: 0.74 },
  ],
};

/** Colisões de um andar da torre: a fachada por dentro, o núcleo, a porta (se fechada) e os móveis. */
export function floorSolids(index: number, doorOpen: boolean): Solid[] {
  const y = floorY(index);
  const top = y + TOWER.clearHeight;
  const b = floorBounds(index);
  const t = TOWER.wall;
  const out: Solid[] = [
    box(b.minX - t, b.minX, b.minZ - t, b.maxZ + t, y, top),
    box(b.maxX, b.maxX + t, b.minZ - t, b.maxZ + t, y, top),
    box(b.minX, b.maxX, b.minZ - t, b.minZ, y, top),
    box(b.minX, b.maxX, b.maxZ, b.maxZ + t, y, top),
    ...coreSolids(y, top),
    ...(FURNITURE[index] ?? []).map((f) => box(f.minX, f.maxX, f.minZ, f.maxZ, y, y + f.height)),
  ];
  if (!doorOpen) out.push(doorSolid(y));
  return out;
}

/** Colisões de quem está dentro da cabina (paredes dela e a porta, se fechada). */
export function cabinSolids(y: number, doorOpen: boolean): Solid[] {
  const out = coreSolids(y, y + TOWER.cabin.height);
  if (!doorOpen) out.push(doorSolid(y));
  return out;
}

export const insideCabin = (x: number, z: number) => x > TOWER.cabin.minX && x < TOWER.cabin.maxX && z > TOWER.cabin.minZ && z < TOWER.cabin.maxZ;

/** Na frente da porta do elevador (onde se chama), num andar. */
export const atCoreDoor = (x: number, z: number) => Math.abs(x - TOWER.x) < 2 && z > TOWER.core.maxZ && z < TOWER.core.maxZ + 2.6;

/** Dentro do pódio (o salão da recepção), ao nível do chão. */
export const insideLobby = (x: number, z: number) => x > TOWER.podium.minX && x < TOWER.podium.maxX && z > TOWER.podium.minZ && z < TOWER.lobby.glassZ;

/** Dentro da planta de um andar da torre. */
export function insideFloor(index: number, x: number, z: number): boolean {
  const b = floorBounds(index);
  return x > b.minX - 0.5 && x < b.maxX + 0.5 && z > b.minZ - 0.5 && z < b.maxZ + 0.5;
}

// ---- Elevador -------------------------------------------------------------------------------------

export type ElevatorPhase = 'idle' | 'opening' | 'open' | 'closing' | 'moving';

/**
 * Uma cabina, um poço. Máquina de estados:
 *
 *   parada (porta fechada) ──chamada / destino──▶ fechando ──▶ andando ──▶ abrindo ──▶ aberta
 *        ▲                                                                                  │
 *        └──────────────────────── (sem ninguém na porta, depois de um tempo) fechando ◀───┘
 *
 * A porta não fecha com alguém no vão (volta a abrir). Destino em planejamento ou inexistente é
 * recusado (o painel mostra o motivo). O movimento acelera, cruza e freia para parar exatamente no andar.
 */
export interface ElevatorState {
  phase: ElevatorPhase;
  /** Andar onde a cabina está (ou o último por onde passou). */
  floor: number;
  /** Para onde vai (null: sem destino). */
  target: number | null;
  /** Altura do piso da cabina e velocidade vertical (m/s). */
  y: number;
  v: number;
  /** Abertura da porta (0 fechada … 1 aberta). */
  door: number;
  /** Tempo com a porta aberta (fecha sozinha depois de `HOLD_OPEN`). */
  openFor: number;
}

export const ELEVATOR = {
  /** Velocidade de cruzeiro e aceleração: do térreo à presidência (53 m), ~10 s com as portas. */
  speed: 7,
  accel: 2.5,
  /** Tempo para abrir ou fechar a porta. */
  doorTime: 1.1,
  holdOpen: 5,
} as const;

export function createElevator(floor = 0): ElevatorState {
  return { phase: 'idle', floor, target: null, y: floorY(floor), v: 0, door: 0, openFor: 0 };
}

export type ElevatorRequest = 'ok' | 'here' | 'unavailable' | 'busy';

/** Pede um andar (pelo painel da cabina ou pelo botão de chamada). */
export function requestFloor(e: ElevatorState, index: number): ElevatorRequest {
  const f = floorByIndex(index);
  if (!f || f.status !== 'open') return 'unavailable';
  if (e.phase === 'moving') return 'busy';
  if (index === e.floor) {
    if (e.phase !== 'open') e.phase = 'opening';
    e.openFor = 0;
    return 'here';
  }
  e.target = index;
  if (e.phase === 'idle') e.phase = 'moving';
  else e.phase = 'closing';
  return 'ok';
}

/**
 * Avança o elevador. `doorway`: alguém está no vão da porta (não fecha). Devolve o evento do passo, para
 * o som e o painel: chegou, porta abriu, porta fechou.
 */
export function stepElevator(e: ElevatorState, dt: number, doorway: boolean): 'arrived' | 'opened' | 'closed' | null {
  const rate = dt / ELEVATOR.doorTime;
  switch (e.phase) {
    case 'opening':
      e.door = Math.min(1, e.door + rate);
      if (e.door >= 1) {
        e.phase = 'open';
        e.openFor = 0;
        return 'opened';
      }
      return null;
    case 'open':
      e.openFor += dt;
      if (doorway) e.openFor = 0;
      if (e.target !== null || e.openFor >= ELEVATOR.holdOpen) e.phase = 'closing';
      return null;
    case 'closing':
      // Alguém no vão: a porta volta a abrir (nunca fecha em cima do visitante).
      if (doorway) {
        e.phase = 'opening';
        return null;
      }
      e.door = Math.max(0, e.door - rate);
      if (e.door <= 0) {
        e.phase = e.target !== null ? 'moving' : 'idle';
        return 'closed';
      }
      return null;
    case 'moving': {
      if (e.target === null) {
        e.phase = 'idle';
        return null;
      }
      const goal = floorY(e.target);
      const dir = Math.sign(goal - e.y);
      const dist = Math.abs(goal - e.y);
      // Perfil trapezoidal: freia a tempo de parar no andar (v² = 2·a·d).
      const stop = Math.sqrt(2 * ELEVATOR.accel * dist);
      const want = Math.min(ELEVATOR.speed, stop);
      const speed = Math.abs(e.v);
      const next = want > speed ? Math.min(want, speed + ELEVATOR.accel * dt) : Math.max(want, speed - ELEVATOR.accel * dt * 1.5);
      const step = Math.min(dist, Math.max(next, 0.05) * dt);
      e.y += dir * step;
      e.v = dir * next;
      // Por qual andar está passando (o mostrador da cabina).
      e.floor = nearestFloor(e.y);
      if (dist - step < 0.005) {
        e.y = goal;
        e.v = 0;
        e.floor = e.target;
        e.target = null;
        e.phase = 'opening';
        return 'arrived';
      }
      return null;
    }
    default:
      return null;
  }
}

/** Andar mais próximo de uma altura (o mostrador durante a viagem). */
export function nearestFloor(y: number): number {
  let best = 0;
  let bestD = Infinity;
  for (const f of FLOORS) {
    const d = Math.abs(floorY(f.index) - y);
    if (d < bestD) {
      bestD = d;
      best = f.index;
    }
  }
  return best;
}

// ---- Câmeras dos setores ---------------------------------------------------------------------------

/**
 * Câmeras virtuais dos ambientes: renderizam o ambiente 3D de verdade (não são câmeras de segurança de
 * lugar nenhum). A presidência mostra a imagem delas numa tela, atualizada poucas vezes por segundo e só
 * com o visitante lá.
 */
export interface SectorCamera {
  id: string;
  sector: SectorId;
  floor: number;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export const SECTOR_CAMERAS: SectorCamera[] = [
  // No canto nordeste da Engenharia, alto, olhando as bancadas e o núcleo.
  { id: 'ENG-01', sector: 'engineering', floor: 3, position: [9.2, floorY(3) + 3.1, -76.2], target: [-2, floorY(3) + 0.9, -80.5], fov: 62 },
];

// ---- Estado dos setores ----------------------------------------------------------------------------

/**
 * O que a presidência mostra de cada setor. Vem de uma fonte própria, não da cena: a Torre só
 * representa. Hoje a fonte é esta lista local, e tudo nela é `demo` (dados de demonstração, marcados
 * na tela) ou `planned` (o setor ainda não existe). Um serviço real preencheria o mesmo contrato, com
 * `source: 'live'` e a data da última atualização.
 */
export interface SectorStatus {
  sector: SectorId;
  availability: 'planned' | 'demo' | 'operational' | 'unavailable';
  /** Agentes de produto ligados ao setor (os do site: Scout, Verifier…), não os de desenvolvimento. */
  agents: string[];
  tasks: Array<{ title: string; state: 'queued' | 'running' | 'done' | 'failed' }>;
  alerts: string[];
  /** ISO; null enquanto não houver fonte real. */
  updatedAt: string | null;
  source: 'demo' | 'live' | 'none';
}

export const SECTOR_STATUS: SectorStatus[] = [
  { sector: 'engineering', availability: 'demo', agents: [], tasks: [{ title: 'tower-v1', state: 'running' }], alerts: [], updatedAt: null, source: 'demo' },
  { sector: 'intelligence', availability: 'demo', agents: ['Scout', 'Verifier', 'Vigia'], tasks: [], alerts: [], updatedAt: null, source: 'demo' },
  { sector: 'education', availability: 'demo', agents: ['Atlas', 'Trend', 'Sol'], tasks: [], alerts: [], updatedAt: null, source: 'demo' },
  { sector: 'commercial', availability: 'planned', agents: [], tasks: [], alerts: [], updatedAt: null, source: 'none' },
  { sector: 'marketing', availability: 'planned', agents: [], tasks: [], alerts: [], updatedAt: null, source: 'none' },
  { sector: 'content', availability: 'planned', agents: [], tasks: [], alerts: [], updatedAt: null, source: 'none' },
  { sector: 'legal', availability: 'planned', agents: [], tasks: [], alerts: [], updatedAt: null, source: 'none' },
];
