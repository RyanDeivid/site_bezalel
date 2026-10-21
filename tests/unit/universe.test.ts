import type { BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { routes } from '@/app/router';
import { messages } from '@/i18n';
import { universeContent } from '@/features/universe/universe-content';
import { AIR_ROUTES, airPose, createAirTraffic, sampleAir } from '@/features/universe/world/air';
import {
  BILLBOARDS,
  BLOCKS,
  blockBounds,
  BUILDINGS,
  CEILING,
  cityTowers,
  citySolids,
  DISTRICTS,
  GROUND,
  groundHeight,
  insideSolid,
  MIN_ALTITUDE,
  PLACES,
  ROAD_WIDTH,
  skybridges,
  SPAWN,
  STREET_LINES,
  towerSolids,
  WORLD_HALF,
  TOWER_VARIANTS,
  cubeOnVertex,
  type Quality,
  type Solid,
} from '@/features/universe/world/city';
import { CINEMA_SHOTS, cinemaLength, cinemaPose, shotPose } from '@/features/universe/world/cinema';
import { createPedestrians, pedestrianPose } from '@/features/universe/world/pedestrians';
import { HQ } from '@/features/universe/scene/landmarkGeometry';
import { buildTowerGeometry } from '@/features/universe/scene/towerGeometry';
import { designCar } from '@/features/universe/scene/carDesign';
import { autopilotInput, createCraft, planAutopilot, resolveCollisions, stepCraft } from '@/features/universe/world/flight';
import { PRODUCTS, productText } from '@/features/universe/world/products';
import { cancelAutopilot, createUniverseRuntime, driveInput, goToPlace, manualInput, nearestVehicle, requestExit, tryEnter, updatePlayer, vehicleBodies, vehicleById, vehiclePose } from '@/features/universe/world/runtime';
import { createTraffic, CRUISE_SPEED, ROUTES, sampleRoute, stepTraffic, TRAFFIC_STEP } from '@/features/universe/world/traffic';
import { CAR_SPECS, createCar, exitSpot, NO_DRIVE, stepCar, stopInput } from '@/features/universe/world/vehicles';
import { createWalker, PERSON_RADIUS, RUN_SPEED, stepWalker, WALK_SPEED, walkerSpeed } from '@/features/universe/world/walker';

const QUALITIES: Quality[] = ['low', 'medium', 'high', 'ultra'];
const inside = (x: number, z: number, s: Solid, margin = 0) => x > s.minX - margin && x < s.maxX + margin && z > s.minZ - margin && z < s.maxZ + margin;
/** Distância de um valor à linha de rua mais próxima. */
const toStreet = (v: number) => Math.min(...STREET_LINES.map((l) => Math.abs(v - l)));
const overlap = (a: Solid, b: Solid) => a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;
const solids = citySolids('high');

describe('Universe — cidade', () => {
  it('é uma grade de 5 × 5 quadras', () => {
    expect(BLOCKS).toBe(5);
    expect(STREET_LINES).toHaveLength(6);
  });

  it('nenhum edifício, torre, telão ou passarela invade rua ou calçada', () => {
    for (const s of solids) {
      for (const x of [s.minX, s.maxX]) expect(toStreet(x), `x=${x}`).toBeGreaterThan(ROAD_WIDTH / 2);
      for (const z of [s.minZ, s.maxZ]) expect(toStreet(z), `z=${z}`).toBeGreaterThan(ROAD_WIDTH / 2);
    }
  });

  for (const q of QUALITIES)
    it(`as torres (${q}) não se sobrepõem, não entram nas quadras institucionais e não encostam nos telões`, () => {
      const towers = cityTowers(q);
      const feet = towers.map((t) => towerSolids(t)[0]!);
      for (let i = 0; i < feet.length; i++) for (let j = i + 1; j < feet.length; j++) expect(overlap(feet[i]!, feet[j]!), `torres ${i} e ${j}`).toBe(false);
      for (const d of DISTRICTS) for (const f of feet) expect(overlap(f, blockBounds(d.block[0], d.block[1]))).toBe(false);
      for (const b of BILLBOARDS) for (const t of towers) for (const s of towerSolids(t)) expect(inside(b.x, b.z, s, b.w / 2)).toBe(false);
    });

  it('a qualidade muda a densidade da cidade de verdade', () => {
    const n = QUALITIES.map((q) => cityTowers(q).length);
    expect(n[0]).toBeLessThan(n[1]!);
    expect(n[1]).toBeLessThan(n[2]!);
    // O ultra já usa a grade cheia de torres do alto; o que ele acrescenta é trânsito, alcance e nitidez.
    expect(n[3]).toBe(n[2]);
    const cars = QUALITIES.map((q) => createTraffic(q).vehicles.length);
    for (let i = 1; i < cars.length; i++) expect(cars[i]).toBeGreaterThan(cars[i - 1]!);
  });

  it('passarelas ligam duas torres vizinhas, no alto', () => {
    const towers = cityTowers('high');
    const bridges = skybridges(towers);
    expect(bridges.length).toBeGreaterThan(0);
    for (const b of bridges) {
      expect(b.y).toBeGreaterThan(20);
      expect(towers.some((t) => t.x === b.a.x && t.z === b.a.z)).toBe(true);
      expect(towers.some((t) => t.x === b.b.x && t.z === b.b.z)).toBe(true);
    }
  });

  it('cada local tem heliponto livre; o ponto de partida também', () => {
    for (const p of PLACES) for (const s of solids) expect(inside(p.pad.x, p.pad.z, s, 2.2), p.id).toBe(false);
    expect(insideSolid(SPAWN.x, SPAWN.z, 1, PERSON_RADIUS, solids)).toBe(false);
  });

  it('o chão tem alturas de rua, calçada (meio-fio), quadra e praça', () => {
    expect(groundHeight(STREET_LINES[2], 0)).toBe(GROUND.road);
    expect(groundHeight(0, 0)).toBe(GROUND.plaza);
    const b = blockBounds(2, 3);
    expect(groundHeight((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2)).toBe(GROUND.block);
    expect(groundHeight(b.minX - 1, (b.minZ + b.maxZ) / 2)).toBe(GROUND.sidewalk);
  });
});

describe('Universe — produtos e textos', () => {
  const paths = new Set((routes[0]!.children ?? []).map((r) => `/${r.path}`));
  it('todo produto aponta para uma rota que existe no site, com textos nos dois idiomas', () => {
    for (const p of PRODUCTS) expect(paths.has(p.route), p.route).toBe(true);
    for (const locale of ['pt-BR', 'en'] as const)
      for (const p of PRODUCTS) {
        const text = productText(p, messages[locale]);
        expect(text.title.length).toBeGreaterThan(2);
        expect(text.description.length).toBeGreaterThan(20);
      }
  });
  it('as ações dos locais levam a rotas reais; /universe está registrada', () => {
    for (const locale of ['pt-BR', 'en'] as const)
      for (const place of Object.values(universeContent[locale].places)) for (const a of place.actions) expect(a.to === '/' || paths.has(a.to), a.to).toBe(true);
    expect(paths.has('/universe')).toBe(true);
  });
  it('todo veículo do jogador tem nome nos dois idiomas', () => {
    const rt = createUniverseRuntime();
    for (const v of rt.vehicles) for (const locale of ['pt-BR', 'en'] as const) expect(universeContent[locale].vehicles[v.id], v.id).toBeTruthy();
  });
});

describe('Universe — trânsito terrestre', () => {
  it('é determinístico, só terrestre e sempre sobre as ruas', () => {
    const a = createTraffic('high');
    const b = createTraffic('high');
    for (let i = 0; i < 300; i++) {
      stepTraffic(a);
      stepTraffic(b);
    }
    expect(a.vehicles.map((v) => [v.x, v.z])).toEqual(b.vehicles.map((v) => [v.x, v.z]));
    expect(ROUTES.every((r) => r.kind === 'ground')).toBe(true);
    for (const r of a.routes)
      for (let s = 0; s < r.length; s += 2) {
        const p = sampleRoute(r, s);
        expect(Math.min(toStreet(p.x), toStreet(p.z)), `${r.id} em ${s.toFixed(0)} m`).toBeLessThanOrEqual(ROAD_WIDTH / 2);
      }
  });

  it('tem três modelos e velocidades variadas', () => {
    const t = createTraffic('high');
    expect(new Set(t.vehicles.map((v) => v.cls))).toEqual(new Set(['sedan', 'sport', 'taxi']));
    expect(new Set(t.vehicles.map((v) => v.cruise.toFixed(2))).size).toBeGreaterThan(5);
  });

  for (const quality of QUALITIES)
    it(`em 10 minutos (${quality}): nenhum carro encosta em outro e ninguém fica parado para sempre`, () => {
      const t = createTraffic(quality);
      const start = t.vehicles.map((v) => v.s);
      const stopped = t.vehicles.map(() => 0);
      let longestStop = 0;
      let overlaps = 0;
      for (let k = 0; k < 600 / TRAFFIC_STEP; k++) {
        stepTraffic(t);
        t.vehicles.forEach((v, i) => {
          stopped[i] = v.speed < 0.2 ? stopped[i]! + 1 : 0;
          longestStop = Math.max(longestStop, stopped[i]!);
        });
        if (k % 3) continue;
        for (let i = 0; i < t.vehicles.length; i++)
          for (let j = i + 1; j < t.vehicles.length; j++) {
            const a = t.vehicles[i]!;
            const b = t.vehicles[j]!;
            const rx = b.x - a.x;
            const rz = b.z - a.z;
            const dx = Math.sin(a.heading);
            const dz = Math.cos(a.heading);
            if (Math.abs(rx * dx + rz * dz) < 3.9 && Math.abs(rx * dz - rz * dx) < 1.9) overlaps++;
          }
      }
      expect(overlaps).toBe(0);
      expect(longestStop * TRAFFIC_STEP).toBeLessThan(20);
      t.vehicles.forEach((v, i) => expect(v.s - start[i]!).toBeGreaterThan(CRUISE_SPEED * 600 * 0.45));
    });

  it('freia para o jogador parado na faixa e não o atropela', () => {
    const t = createTraffic('low');
    const v = t.vehicles[0]!;
    const route = t.routes[v.route]!;
    const ahead = sampleRoute(route, v.s + 40);
    let minGap = Infinity;
    for (let k = 0; k < 20 / TRAFFIC_STEP; k++) {
      stepTraffic(t, [{ x: ahead.x, z: ahead.z }]);
      minGap = Math.min(minGap, Math.hypot(v.x - ahead.x, v.z - ahead.z));
    }
    expect(minGap).toBeGreaterThan(3);
    expect(v.speed).toBeLessThan(0.5);
  });
});

describe('Universe — trânsito aéreo', () => {
  const air = createAirTraffic('high');

  it('nenhuma rota aérea atravessa ou raspa um edifício', () => {
    for (const r of air.routes)
      for (let s = 0; s < r.length; s += 2) {
        const p = sampleAir(r, s);
        for (const so of solids) {
          if (p.y > so.height + 3 || p.y < (so.base ?? 0) - 3) continue;
          const dx = Math.max(so.minX - p.x, 0, p.x - so.maxX);
          const dz = Math.max(so.minZ - p.z, 0, p.z - so.maxZ);
          expect(Math.hypot(dx, dz), `${r.spec.id} em ${s} m`).toBeGreaterThan(3);
        }
      }
  });

  it('rotas que se cruzam ficam em alturas diferentes (separação ≥ 10 m entre quaisquer duas)', () => {
    for (let i = 0; i < air.routes.length; i++)
      for (let j = i + 1; j < air.routes.length; j++) {
        const A = air.routes[i]!;
        const B = air.routes[j]!;
        for (let s = 0; s < A.length; s += 8)
          for (let u = 0; u < B.length; u += 8) {
            const a = sampleAir(A, s);
            const b = sampleAir(B, u);
            expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z), `${A.spec.id} × ${B.spec.id}`).toBeGreaterThan(10);
          }
      }
  });

  it('tem quatro classes, voa abaixo do teto e acima do chão, e é determinístico no tempo', () => {
    expect(new Set(AIR_ROUTES.map((r) => r.cls))).toEqual(new Set(['taxi', 'private', 'cargo', 'drone']));
    for (const v of air.vehicles)
      for (const t of [0, 13.7, 120]) {
        const p = airPose(air, v, t);
        expect(p.y).toBeGreaterThan(10);
        expect(p.y).toBeLessThan(CEILING);
        expect(airPose(air, v, t)).toEqual(p);
      }
  });

  it('a qualidade muda a quantidade de voadores', () => {
    const n = QUALITIES.map((q) => createAirTraffic(q).vehicles.length);
    for (let i = 1; i < n.length; i++) expect(n[i]).toBeGreaterThan(n[i - 1]!);
  });
});

describe('Universe — direção', () => {
  const spec = CAR_SPECS.sedan;
  const drive = (c: ReturnType<typeof createCar>, input: typeof NO_DRIVE, seconds: number, world: Solid[] = []) => {
    for (let t = 0; t < seconds; t += 1 / 60) stepCar(c, spec, input, 1 / 60, world);
  };

  it('acelera progressivamente até a velocidade máxima, sem passar dela', () => {
    const c = createCar({ x: 0, z: 0, heading: 0 });
    drive(c, { ...NO_DRIVE, throttle: 1 }, 1);
    const early = c.speed;
    drive(c, { ...NO_DRIVE, throttle: 1 }, 30);
    expect(early).toBeGreaterThan(4);
    expect(c.speed).toBeLessThanOrEqual(spec.maxSpeed);
    expect(c.speed).toBeGreaterThan(spec.maxSpeed * 0.9);
  });

  it('S freia até parar e, parado, engata a ré; solto, o carro para sozinho', () => {
    const c = createCar({ x: 0, z: 0, heading: 0 });
    drive(c, { ...NO_DRIVE, throttle: 1 }, 4);
    drive(c, { ...NO_DRIVE, brake: 1 }, 1.5);
    expect(c.speed).toBeLessThan(1);
    drive(c, { ...NO_DRIVE, brake: 1 }, 3);
    expect(c.speed).toBeLessThan(-3);
    expect(c.speed).toBeGreaterThanOrEqual(-spec.reverseSpeed);
    drive(c, NO_DRIVE, 10);
    expect(Math.abs(c.speed)).toBeLessThan(0.01);
  });

  it('vira para o lado pedido, menos em alta velocidade, e sem escorregar de lado', () => {
    const turnRate = (speed: number) => {
      const c = createCar({ x: 0, z: 0, heading: 0 });
      c.speed = speed;
      const h0 = c.heading;
      drive(c, { ...NO_DRIVE, throttle: 0.3, steer: 1 }, 0.5);
      return { dh: c.heading - h0, slide: c.slide };
    };
    const slow = turnRate(8);
    const fast = turnRate(30);
    // Direita com o carro indo para o sul (+z) = rumo ao oeste: a direção diminui.
    expect(slow.dh).toBeLessThan(0);
    expect(Math.abs(fast.dh) / 30).toBeLessThan(Math.abs(slow.dh) / 8);
    expect(slow.slide).toBe(0);
  });

  it('freio de mão faz a traseira escorregar (curva fechada)', () => {
    const c = createCar({ x: 0, z: 0, heading: 0 });
    c.speed = 20;
    drive(c, { ...NO_DRIVE, steer: 1, handbrake: true }, 0.6);
    expect(Math.abs(c.slide)).toBeGreaterThan(0.5);
  });

  it('não atravessa uma parede: bate e perde a velocidade', () => {
    const wall: Solid = { minX: -10, maxX: 10, minZ: 30, maxZ: 32, height: 20 };
    const c = createCar({ x: 0, z: 0, heading: 0 });
    let impact = 0;
    for (let t = 0; t < 8; t += 1 / 60) impact = Math.max(impact, stepCar(c, spec, { ...NO_DRIVE, throttle: 1 }, 1 / 60, [wall]));
    expect(c.z + spec.length / 2).toBeLessThanOrEqual(wall.minZ + 0.01);
    expect(impact).toBeGreaterThan(5);
  });

  it('saída segura: pelo lado do motorista; se bloqueado, pelo outro lado ou por trás; encaixotado, não sai', () => {
    const c = { x: 0, z: 0, heading: 0 };
    const free = exitSpot(c, spec, [], []);
    // Indo para o sul, a esquerda do motorista é o leste (+x).
    expect(free!.x).toBeGreaterThan(spec.width / 2);
    const leftWall: Solid = { minX: 1, maxX: 4, minZ: -10, maxZ: 10, height: 10 };
    const other = exitSpot(c, spec, [leftWall], []);
    expect(other!.x).toBeLessThan(0);
    const box: Solid[] = [leftWall, { minX: -4, maxX: -1, minZ: -10, maxZ: 10, height: 10 }, { minX: -4, maxX: 4, minZ: 3, maxZ: 9, height: 10 }, { minX: -4, maxX: 4, minZ: -9, maxZ: -3, height: 10 }];
    expect(exitSpot(c, spec, box, [])).toBeNull();
    // Nunca dentro de outro veículo.
    const spot = exitSpot(c, spec, [], [{ x: free!.x, z: free!.z, r: 1 }]);
    expect(Math.hypot(spot!.x - free!.x, spot!.z - free!.z)).toBeGreaterThan(1);
  });
});

describe('Universe — a pé', () => {
  it('acelera e desacelera com suavidade; correr é mais rápido que andar', () => {
    const w = createWalker({ x: 0, z: 0, yaw: 0 });
    stepWalker(w, { x: 0, z: 1, run: false }, 1 / 60, []);
    expect(walkerSpeed(w)).toBeLessThan(WALK_SPEED);
    for (let t = 0; t < 2; t += 1 / 60) stepWalker(w, { x: 0, z: 1, run: false }, 1 / 60, []);
    expect(walkerSpeed(w)).toBeCloseTo(WALK_SPEED, 1);
    for (let t = 0; t < 2; t += 1 / 60) stepWalker(w, { x: 0, z: 1, run: true }, 1 / 60, []);
    expect(walkerSpeed(w)).toBeCloseTo(RUN_SPEED, 1);
    stepWalker(w, { x: 0, z: 0, run: false }, 1 / 60, []);
    expect(walkerSpeed(w)).toBeGreaterThan(0);
    for (let t = 0; t < 1; t += 1 / 60) stepWalker(w, { x: 0, z: 0, run: false }, 1 / 60, []);
    expect(walkerSpeed(w)).toBe(0);
  });

  it('não entra em prédios nem atravessa carros', () => {
    const hq = BUILDINGS[0]!.solids[0]!;
    const w = createWalker({ x: 0, z: hq.maxZ + 5, yaw: Math.PI });
    for (let t = 0; t < 6; t += 1 / 60) stepWalker(w, { x: 0, z: -1, run: true }, 1 / 60, solids);
    expect(w.z).toBeGreaterThanOrEqual(hq.maxZ + PERSON_RADIUS - 0.01);
    const w2 = createWalker({ x: 0, z: -10, yaw: 0 });
    for (let t = 0; t < 6; t += 1 / 60) stepWalker(w2, { x: 0, z: 1, run: false }, 1 / 60, [], [{ x: 0, z: 0, r: 1 }]);
    expect(Math.hypot(w2.x, w2.z)).toBeGreaterThanOrEqual(1 + PERSON_RADIUS - 0.01);
  });

  it('entra no Laboratório de IA pela porta (entre as balizas) e não pelas paredes; o carro fica do lado de fora', () => {
    const door = createWalker({ x: 58, z: -0.05, yaw: Math.PI / 2 });
    for (let t = 0; t < 6; t += 1 / 60) stepWalker(door, { x: 1, z: 0, run: true }, 1 / 60, solids);
    expect(door.x).toBeGreaterThan(70);
    const wall = createWalker({ x: 58, z: 8, yaw: Math.PI / 2 });
    for (let t = 0; t < 6; t += 1 / 60) stepWalker(wall, { x: 1, z: 0, run: true }, 1 / 60, solids);
    expect(wall.x).toBeLessThan(66);
    const car = createCar({ x: 52, z: -0.05, heading: Math.PI / 2 });
    for (let t = 0; t < 5; t += 1 / 60) stepCar(car, CAR_SPECS.sedan, { throttle: 1, brake: 0, steer: 0, handbrake: false }, 1 / 60, solids);
    expect(car.x).toBeLessThan(62.5);
  });
});

describe('Universe — entrar e sair dos veículos', () => {
  const step = (rt: ReturnType<typeof createUniverseRuntime>, seconds: number, drive = NO_DRIVE) => {
    for (let t = 0; t < seconds; t += 1 / 60) {
      const forced = updatePlayer(rt, 1 / 60, solids);
      const v = vehicleById(rt, rt.active);
      if (rt.mode === 'driving' && v?.kind === 'car') stepCar(v.car, CAR_SPECS[v.cls], forced?.brake ? stopInput(v.car) : drive, 1 / 60, solids);
      if (rt.mode === 'driving' && v?.kind === 'hover') stepCraft(v.craft, { throttle: 0, turn: 0, lift: forced?.descend ? -1 : 0, boost: false }, 1 / 60, solids);
    }
  };

  it('começa a pé, longe de tudo; só entra quando há um veículo ao alcance', () => {
    const rt = createUniverseRuntime();
    expect(rt.mode).toBe('foot');
    rt.walker.x = 100;
    rt.walker.z = 100;
    expect(tryEnter(rt)).toBe(false);
  });

  it('a pé → entrando → dirigindo; dirige; sai num lugar livre; o carro fica no mundo; volta a andar', () => {
    const rt = createUniverseRuntime();
    const car = vehicleById(rt, 'aurora')!;
    if (car.kind !== 'car') throw new Error('aurora deveria ser um carro');
    rt.walker.x = car.car.x + 2.2;
    rt.walker.z = car.car.z;
    expect(nearestVehicle(rt)?.id).toBe('aurora');
    expect(tryEnter(rt)).toBe(true);
    expect(rt.mode).toBe('entering');
    step(rt, 1);
    expect(rt.mode).toBe('driving');
    // Acelera e vira (comandos do teclado).
    rt.keys.add('w');
    rt.keys.add('d');
    const start = { x: car.car.x, z: car.car.z, heading: car.car.heading };
    step(rt, 1.5, driveInput(rt));
    rt.keys.clear();
    expect(Math.hypot(car.car.x - start.x, car.car.z - start.z)).toBeGreaterThan(3);
    expect(car.car.heading).not.toBe(start.heading);
    // Pede para sair em movimento: o carro freia primeiro e só então o jogador desce.
    requestExit(rt);
    step(rt, 0.05);
    expect(rt.notice === 'braking' || rt.mode === 'exiting').toBe(true);
    step(rt, 4);
    expect(rt.mode).toBe('foot');
    expect(rt.active).toBeNull();
    const parked = vehiclePose(car);
    expect(rt.vehicles).toContain(car);
    expect(Math.abs(car.car.speed)).toBeLessThan(0.01);
    // Desceu fora de paredes e de veículos, ao lado do carro.
    expect(insideSolid(rt.walker.x, rt.walker.z, 0.9, PERSON_RADIUS, solids)).toBe(false);
    for (const v of rt.vehicles) for (const b of vehicleBodies(v)) expect(Math.hypot(rt.walker.x - b.x, rt.walker.z - b.z)).toBeGreaterThan(b.r + PERSON_RADIUS - 0.01);
    expect(Math.hypot(rt.walker.x - parked.x, rt.walker.z - parked.z)).toBeLessThan(5);
  });

  it('sair em ré: o carro freia a ré (não acelera) e o jogador desce', () => {
    const rt = createUniverseRuntime();
    const car = vehicleById(rt, 'aurora')!;
    if (car.kind !== 'car') throw new Error('aurora deveria ser um carro');
    rt.walker.x = car.car.x + 2.2;
    rt.walker.z = car.car.z;
    tryEnter(rt);
    step(rt, 1);
    // Segura S: freia e, parado, engata a ré até a velocidade máxima de ré.
    step(rt, 3, { ...NO_DRIVE, brake: 1 });
    expect(car.car.speed).toBeLessThan(-5);
    requestExit(rt);
    step(rt, 3);
    expect(rt.mode).toBe('foot');
    expect(Math.abs(car.car.speed)).toBeLessThan(0.01);
  });

  it('no carro voador, sair no alto primeiro pousa', () => {
    const rt = createUniverseRuntime();
    const hover = vehicleById(rt, 'hover')!;
    if (hover.kind !== 'hover') throw new Error('hover deveria ser o voador');
    rt.walker.x = hover.craft.x + 2;
    rt.walker.z = hover.craft.z;
    expect(tryEnter(rt)).toBe(true);
    step(rt, 1);
    hover.craft.y = 30;
    requestExit(rt);
    step(rt, 0.1);
    expect(rt.notice).toBe('landing');
    step(rt, 8);
    expect(rt.mode).toBe('foot');
    expect(hover.craft.y).toBeLessThan(2.5);
  });

  it('"Ir até" a pé leva ao local; de carro, ele fica estacionado onde estava', () => {
    const rt = createUniverseRuntime();
    expect(goToPlace(rt, 'ai-lab', solids, false)).toBe('travelled');
    const lab = PLACES.find((p) => p.id === 'ai-lab')!;
    expect(Math.hypot(rt.walker.x - lab.pad.x, rt.walker.z - lab.pad.z)).toBeLessThan(6);
    const car = vehicleById(rt, 'taxi-2')!;
    rt.walker.x = vehiclePose(car).x + 2;
    rt.walker.z = vehiclePose(car).z + 2;
    tryEnter(rt);
    step(rt, 1);
    const at = vehiclePose(car);
    goToPlace(rt, 'plaza', solids, false);
    expect(rt.mode).toBe('foot');
    expect(vehiclePose(car)).toEqual(at);
  });
});

describe('Universe — voo (carro voador)', () => {
  it('no teclado, ↑/↓ sobem e descem; W/S aceleram e freiam; ←/→ viram', () => {
    const rt = createUniverseRuntime();
    const with_ = (...keys: string[]) => {
      rt.keys.clear();
      keys.forEach((k) => rt.keys.add(k));
      return manualInput(rt);
    };
    expect(with_('arrowup')).toMatchObject({ lift: 1, throttle: 0 });
    expect(with_('arrowdown')).toMatchObject({ lift: -1, throttle: 0 });
    expect(with_(' ')).toMatchObject({ lift: 1 });
    expect(with_('c')).toMatchObject({ lift: -1 });
    expect(with_('arrowup', ' ')).toMatchObject({ lift: 1 });
    expect(with_('w')).toMatchObject({ throttle: 1, lift: 0 });
    expect(with_('s')).toMatchObject({ throttle: -1, lift: 0 });
    expect(with_('arrowleft').turn).toBe(-1);
    expect(with_('d').turn).toBe(1);
    // No carro e a pé, as setas continuam sendo frente e trás.
    expect(driveInput(Object.assign(rt, { keys: new Set(['arrowup']) })).throttle).toBe(1);
  });

  it('não atravessa prédios; respeita chão, teto e limites', () => {
    const hq = BUILDINGS[0]!.solids[1]!;
    const c = { x: (hq.minX + hq.maxX) / 2, y: 20, z: hq.maxZ - 1 };
    resolveCollisions(c, solids, 2.2, 20);
    expect(inside(c.x, c.z, hq, 2.19) && c.y < hq.height).toBe(false);
    const craft = createCraft({ x: 0, y: 4, z: 78, yaw: 0 });
    for (let i = 0; i < 900; i++) stepCraft(craft, { throttle: 1, turn: 0, lift: 1, boost: true }, 1 / 60, []);
    expect(craft.y).toBeLessThanOrEqual(CEILING);
    expect(craft.z).toBeLessThanOrEqual(WORLD_HALF);
    for (let i = 0; i < 900; i++) stepCraft(craft, { throttle: 0, turn: 0, lift: -1, boost: false }, 1 / 60, []);
    expect(craft.y).toBeGreaterThanOrEqual(MIN_ALTITUDE);
  });

  it('o piloto automático chega a todos os locais sem bater; assumir o controle o desliga', () => {
    const starts = PLACES.map((p) => ({ x: p.pad.x, y: p.padAltitude, z: p.pad.z, yaw: p.padHeading }));
    for (const from of starts)
      for (const to of PLACES) {
        const c = createCraft(from);
        const ap = planAutopilot(c, { x: to.pad.x, z: to.pad.z, y: to.padAltitude, yaw: to.padHeading }, solids);
        let t = 0;
        let hits = 0;
        for (; t < 60; t += 1 / 60) {
          const input = autopilotInput(c, ap);
          if (!input) break;
          if (stepCraft(c, input, 1 / 60, solids)) hits++;
        }
        expect(t, `até ${to.id}`).toBeLessThan(60);
        expect(hits).toBe(0);
      }
    const rt = createUniverseRuntime();
    rt.autopilot = { ...planAutopilot(createCraft({ x: 0, y: 4, z: 0, yaw: 0 }), { x: 0, z: 0, y: 5, yaw: 0 }, []), place: 'plaza' };
    cancelAutopilot(rt);
    expect(rt.autopilot).toBeNull();
  });
});

describe('Universe — arquitetura (famílias e marcos)', () => {
  it('sete famílias com silhueta própria; alturas em andares inteiros (3,5 m), para os andares baterem com a fachada', () => {
    expect(TOWER_VARIANTS).toHaveLength(7);
    expect(new Set(TOWER_VARIANTS.map((v) => v.roof)).size).toBeGreaterThanOrEqual(6);
    // (O embasamento de lojas tem a sua textura ajustada à altura dele.)
    for (const v of TOWER_VARIANTS) for (const p of v.parts) if (p.material !== 'storefront') expect((p.h / 3.5) % 1, `${v.name}: ${p.h}`).toBeCloseTo(0, 6);
    // Pegadas de até 15 m: cabem nas células de 17 m das quadras.
    for (const v of TOWER_VARIANTS) for (const p of v.parts) expect(Math.max(p.w, p.d) + 2 * Math.max(Math.abs(p.dx ?? 0), Math.abs(p.dz ?? 0))).toBeLessThanOrEqual(17);
  });

  it('a geometria de cada família é válida (sem NaN) e os acabamentos levam cor por vértice', () => {
    for (const detail of [false, true])
      for (const v of TOWER_VARIANTS) {
        const parts = buildTowerGeometry(v, detail);
        for (const [slot, g] of parts) {
          const pos = g.attributes.position!.array as Float32Array;
          expect(pos.every(Number.isFinite), `${v.name}/${slot}`).toBe(true);
          expect(g.index!.count % 3).toBe(0);
          expect(!!g.attributes.color, `${v.name}/${slot}`).toBe(slot === 'metal' || slot === 'matte' || slot === 'glow');
          g.dispose();
        }
      }
  });

  it('a sede é o marco mais alto da região, e os sólidos de colisão seguem as medidas desenhadas', () => {
    const hq = BUILDINGS.find((b) => b.id === 'bezalel-hq')!;
    expect(hq.height).toBeGreaterThan(Math.max(...BUILDINGS.filter((b) => b !== hq).map((b) => b.height)));
    expect(hq.solids[0]!.height).toBeCloseTo(HQ.podiumTop, 6);
    expect(hq.solids[1]!.height).toBeCloseTo(HQ.towerTop, 6);
    // O cubo da coroa (lado 10, apoiado num vértice) cabe no último sólido.
    expect(HQ.cubeY + cubeOnVertex(10).height / 2).toBeLessThanOrEqual(hq.solids[2]!.height);
  });
});

describe('Universe — modo apresentação', () => {
  it('nenhuma tomada atravessa um prédio, uma torre ou o chão, em nenhuma qualidade', () => {
    for (const q of QUALITIES) {
      const all = citySolids(q);
      for (const s of CINEMA_SHOTS)
        for (let k = 0; k <= 1.0001; k += 0.02) {
          const p = shotPose(s, k);
          expect(insideSolid(p.x, p.z, p.y, 2, all), `${q}/${s.id} k=${k.toFixed(2)}`).toBe(false);
          expect(p.y).toBeGreaterThan(2);
          expect(Math.abs(p.x)).toBeLessThan(WORLD_HALF);
          expect(Math.abs(p.z)).toBeLessThan(WORLD_HALF);
        }
    }
  });

  it('percorre as tomadas em ordem, com fusão nas trocas; com movimento reduzido, planos fixos sem fusão', () => {
    let t = 0;
    const seen: number[] = [];
    for (const s of CINEMA_SHOTS) {
      expect(cinemaPose(t + 0.01, false).fade).toBeGreaterThan(0.9);
      expect(cinemaPose(t + s.seconds / 2, false).fade).toBe(0);
      seen.push(cinemaPose(t + s.seconds / 2, false).shot);
      t += s.seconds;
    }
    expect(seen).toEqual(CINEMA_SHOTS.map((_, i) => i));
    expect(cinemaPose(cinemaLength(false) + 1, false).shot).toBe(0);
    const a = cinemaPose(1, true);
    const b = cinemaPose(5, true);
    expect([a.x, a.y, a.z, a.fade]).toEqual([b.x, b.y, b.z, 0]);
  });
});

describe('Universe — orçamento dos carros por nível de detalhe', () => {
  const tris = (g: BufferGeometry) => (g.index ? g.index.count : g.attributes.position!.count) / 3;
  const total = (cls: 'sedan' | 'sport' | 'taxi', lod: 'near' | 'mid' | 'far') => {
    const d = designCar(cls, lod);
    let t = 0;
    for (const g of d.parts.values()) t += tris(g);
    return t + d.wheels.length * (tris(d.tire) + tris(d.rim));
  };
  it('completo ≤ 24 mil triângulos, intermediário (trânsito de perto) ≤ 9 mil, de longe ≤ 2,5 mil', () => {
    for (const cls of ['sedan', 'sport', 'taxi'] as const) {
      const [near, mid, far] = [total(cls, 'near'), total(cls, 'mid'), total(cls, 'far')];
      expect(near, cls).toBeLessThanOrEqual(24_000);
      expect(mid, cls).toBeLessThanOrEqual(9_000);
      expect(far, cls).toBeLessThanOrEqual(2_500);
      expect(mid, cls).toBeLessThan(near / 2.4);
    }
  });
});

describe('Universe — pedestres', () => {
  it('andam só pelas calçadas da região principal e pela praça, longe dos postes e fora de qualquer edifício', () => {
    for (const q of QUALITIES) {
      const all = citySolids(q);
      for (const p of createPedestrians(q))
        for (let t = 0; t < 600; t += 3.7) {
          const pose = pedestrianPose(p, t);
          const ground = groundHeight(pose.x, pose.z);
          if (p.route.kind === 'plaza') expect(ground).toBe(GROUND.plaza);
          else expect(ground, `${pose.x.toFixed(1)},${pose.z.toFixed(1)}`).toBe(GROUND.sidewalk);
          expect(insideSolid(pose.x, pose.z, 1, 0.3, all)).toBe(false);
          expect(Number.isFinite(pose.heading)).toBe(true);
        }
    }
  });

  it('são determinísticos, mais numerosos nas qualidades maiores e andam na velocidade de gente', () => {
    const n = QUALITIES.map((q) => createPedestrians(q).length);
    expect(n).toEqual([...n].sort((a, b) => a - b));
    const ps = createPedestrians('high');
    expect(pedestrianPose(ps[3]!, 12.5)).toEqual(pedestrianPose(createPedestrians('high')[3]!, 12.5));
    for (const p of ps) {
      const a = pedestrianPose(p, 10);
      const b = pedestrianPose(p, 11);
      const v = Math.hypot(b.x - a.x, b.z - a.z);
      expect(v).toBeGreaterThan(0.6);
      expect(v).toBeLessThan(1.7);
    }
  });
});
