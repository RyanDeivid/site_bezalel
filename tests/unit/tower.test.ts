import { describe, expect, it } from 'vitest';
import { citySolids, insideSolid } from '@/features/universe/world/city';
import { CAR_SPECS, createCar, stepCar } from '@/features/universe/world/vehicles';
import { createWalker, stepWalker } from '@/features/universe/world/walker';
import { ceilingY, createElevator, floorBounds, floorByIndex, floorSolids, FLOORS, floorY, footprintAt, insideCabin, requestFloor, SECTOR_CAMERAS, SECTOR_STATUS, stepElevator, TOP_FLOOR, TOWER } from '@/features/universe/world/tower';
import { callElevator, chooseFloor, createTowerRuntime, stepTower, towerContext } from '@/features/universe/world/towerRuntime';

const solids = citySolids('ultra');
const DT = 1 / 60;
type Tower = ReturnType<typeof createTowerRuntime>;
type Walker = ReturnType<typeof createWalker>;

/** Anda o visitante (com a Torre) por `seconds`, na direção dada. */
function walk(t: Tower, w: Walker, dir: { x: number; z: number }, seconds: number) {
  for (let s = 0; s < seconds; s += DT) {
    const c = towerContext(t, w, solids);
    stepWalker(w, { x: dir.x, z: dir.z, run: false }, DT, c.solids, [], c.floor ?? undefined);
    stepTower(t, w, DT, true);
  }
}

/** Espera parado (o elevador anda). */
const wait = (t: Tower, w: Walker, seconds: number) => walk(t, w, { x: 0, z: 0 }, seconds);

describe('Torre Bezalel: o edifício', () => {
  it('andares empilhados de 4 m, do térreo à presidência no topo da torre; a planta afunila', () => {
    expect(floorY(0)).toBe(TOWER.ground);
    expect(floorY(1)).toBe(TOWER.towerBase);
    expect(floorY(TOP_FLOOR) + TOWER.floorHeight).toBeCloseTo(TOWER.towerTop, 5);
    expect(ceilingY(TOP_FLOOR)).toBeLessThan(TOWER.towerTop);
    expect(footprintAt(TOWER.towerTop).hw).toBeLessThan(footprintAt(TOWER.towerBase).hw);
    // Registro: índices únicos e em ordem, a presidência no topo, a recepção no térreo.
    expect(FLOORS.map((f) => f.index)).toEqual([...Array(TOP_FLOOR + 1).keys()]);
    expect(floorByIndex(0)?.sector).toBe('reception');
    expect(floorByIndex(TOP_FLOOR)?.sector).toBe('presidency');
    // Todo andar da torre tem planta que contém o núcleo do elevador.
    for (const f of FLOORS.filter((x) => x.index > 0)) {
      const b = floorBounds(f.index);
      expect(b.minX).toBeLessThan(TOWER.core.minX);
      expect(b.maxX).toBeGreaterThan(TOWER.core.maxX);
      expect(b.minZ).toBeLessThan(TOWER.core.minZ);
      expect(b.maxZ).toBeGreaterThan(TOWER.core.maxZ);
    }
  });

  it('entra a pé pela porta do saguão (entre as balizas); o carro fica do lado de fora', () => {
    const t = createTowerRuntime();
    const w = createWalker({ x: 0.05, z: -60, yaw: Math.PI });
    walk(t, w, { x: 0, z: -1 }, 5);
    expect(w.z).toBeLessThan(TOWER.lobby.glassZ - 1);
    expect(t.level).toBe(0);
    const car = createCar({ x: 0, z: -58, heading: Math.PI });
    for (let s = 0; s < 5; s += DT) stepCar(car, CAR_SPECS.sedan, { throttle: 1, brake: 0, steer: 0, handbrake: false }, DT, solids);
    expect(car.z).toBeGreaterThan(TOWER.lobby.glassZ + 1);
  });

  it('a porta fechada do elevador não deixa passar; a câmera não atravessa o teto da recepção', () => {
    const t = createTowerRuntime();
    const w = createWalker({ x: 0, z: -79, yaw: Math.PI });
    walk(t, w, { x: 0, z: -1 }, 3);
    expect(insideCabin(w.x, w.z)).toBe(false);
    expect(insideSolid(0, -80, TOWER.lobbyCeiling + 0.5, 0.1, solids)).toBe(true);
    expect(insideSolid(0, -80, 3, 0.1, solids)).toBe(false);
  });
});

describe('Torre Bezalel: o elevador', () => {
  it('acelera, cruza e freia até parar exatamente no andar; abre a porta ao chegar', () => {
    const e = createElevator(0);
    expect(requestFloor(e, TOP_FLOOR)).toBe('ok');
    let arrived = false;
    let top = 0;
    for (let s = 0; s < 30 && !arrived; s += DT) {
      arrived = stepElevator(e, DT, false) === 'arrived';
      top = Math.max(top, Math.abs(e.v));
    }
    expect(arrived).toBe(true);
    expect(e.y).toBeCloseTo(floorY(TOP_FLOOR), 5);
    expect(e.floor).toBe(TOP_FLOOR);
    expect(top).toBeLessThanOrEqual(7 + 1e-6);
    expect(e.phase).toBe('opening');
  });

  it('recusa andar em planejamento ou inexistente; com a cabina viajando, pede para esperar', () => {
    const e = createElevator(0);
    expect(requestFloor(e, 5)).toBe('unavailable');
    expect(requestFloor(e, 99)).toBe('unavailable');
    requestFloor(e, 3);
    stepElevator(e, DT, false);
    expect(e.phase).toBe('moving');
    expect(requestFloor(e, TOP_FLOOR)).toBe('busy');
  });

  it('não fecha a porta com alguém no vão: volta a abrir', () => {
    const e = createElevator(0);
    requestFloor(e, 0);
    for (let s = 0; s < 2; s += DT) stepElevator(e, DT, false);
    expect(e.phase).toBe('open');
    requestFloor(e, 3);
    stepElevator(e, DT, false);
    expect(e.phase).toBe('closing');
    stepElevator(e, DT, true);
    expect(e.phase).toBe('opening');
  });

  it('do saguão à presidência e de volta, a pé: chama, entra, escolhe, viaja dentro da cabina, sai no andar', () => {
    const t = createTowerRuntime();
    const w = createWalker({ x: 0, z: -79.5, yaw: Math.PI });
    // Na frente da porta: a ação é chamar.
    stepTower(t, w, DT, true);
    expect(t.prompt).toBe('call');
    expect(callElevator(t)).toBe('here');
    wait(t, w, 1.5);
    // Porta aberta: entra na cabina.
    walk(t, w, { x: 0, z: -1 }, 2.2);
    expect(insideCabin(w.x, w.z)).toBe(true);
    expect(t.prompt).toBe('panel');
    expect(chooseFloor(t, TOP_FLOOR)).toBe('ok');
    wait(t, w, 3);
    expect(t.riding).toBe(true);
    // Viajando: o visitante sobe com a cabina, sem atravessar as paredes dela.
    wait(t, w, 12);
    expect(t.elevator.floor).toBe(TOP_FLOOR);
    expect(w.y).toBeCloseTo(floorY(TOP_FLOOR), 3);
    expect(insideCabin(w.x, w.z)).toBe(true);
    // Porta aberta: sai para a presidência.
    walk(t, w, { x: 0, z: 1 }, 2.5);
    expect(t.riding).toBe(false);
    expect(t.level).toBe(TOP_FLOOR);
    expect(insideCabin(w.x, w.z)).toBe(false);
    // As paredes da presidência seguram o visitante dentro da planta (a fachada por dentro).
    walk(t, w, { x: 0.3, z: 1 }, 6);
    expect(w.z).toBeLessThan(floorBounds(TOP_FLOOR).maxZ);
    expect(w.y).toBeCloseTo(floorY(TOP_FLOOR), 3);
    // E de volta ao térreo.
    const back = createWalker({ x: 0, z: -80.2, yaw: Math.PI });
    back.y = floorY(TOP_FLOOR);
    stepTower(t, back, DT, true);
    expect(t.prompt).toBe('call');
    callElevator(t);
    walk(t, back, { x: 0, z: -1 }, 3);
    expect(insideCabin(back.x, back.z)).toBe(true);
    chooseFloor(t, 0);
    wait(t, back, 16);
    expect(t.level).toBe(0);
    expect(back.y).toBeCloseTo(TOWER.ground, 3);
  });

  it('posto dentro de um móvel, sai dele sem ser arremessado pela parede ao lado (a parede só tira velocidade)', () => {
    const t = createTowerRuntime();
    t.level = TOP_FLOOR;
    const w = createWalker({ x: 0, z: -77.2, yaw: 0 });
    w.y = floorY(TOP_FLOOR);
    wait(t, w, 1);
    expect(t.level).toBe(TOP_FLOOR);
    expect(w.z).toBeLessThan(floorBounds(TOP_FLOOR).maxZ);
    expect(w.z).toBeGreaterThan(-76.7);
    expect(Math.hypot(w.vx, w.vz)).toBeLessThan(0.01);
  });

  it('a câmera ENG-01 fica dentro do andar dela; o estado dos setores é honesto (demonstração ou planejado)', () => {
    for (const c of SECTOR_CAMERAS) {
      const b = floorBounds(c.floor);
      expect(c.position[0]).toBeGreaterThan(b.minX);
      expect(c.position[0]).toBeLessThan(b.maxX);
      expect(c.position[2]).toBeGreaterThan(b.minZ);
      expect(c.position[2]).toBeLessThan(b.maxZ);
      expect(c.position[1]).toBeLessThan(ceilingY(c.floor));
      expect(floorByIndex(c.floor)?.status).toBe('open');
    }
    for (const s of SECTOR_STATUS) {
      expect(s.source).not.toBe('live');
      expect(s.availability).not.toBe('operational');
    }
    expect(floorSolids(3, false).length).toBeGreaterThan(8);
  });
});
