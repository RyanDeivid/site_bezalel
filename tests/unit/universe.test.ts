import { describe, expect, it } from 'vitest';
import { routes } from '@/app/router';
import { messages } from '@/i18n';
import { universeContent } from '@/features/universe/universe-content';
import { blockBounds, BUILDINGS, citySolids, CEILING, MIN_ALTITUDE, PLACES, ROAD_WIDTH, SPAWN, STREET_LINES, WORLD_HALF, type Solid } from '@/features/universe/world/city';
import { autopilotInput, createCraft, planAutopilot, resolveCollisions, stepCraft } from '@/features/universe/world/flight';
import { PRODUCTS, productText } from '@/features/universe/world/products';
import { cancelAutopilot, createUniverseRuntime, manualInput } from '@/features/universe/world/runtime';
import { createTraffic, CRUISE_SPEED, ROUTES, sampleRoute, stepTraffic, TRAFFIC_STEP } from '@/features/universe/world/traffic';

const inside = (x: number, z: number, s: Solid, margin = 0) => x > s.minX - margin && x < s.maxX + margin && z > s.minZ - margin && z < s.maxZ + margin;
/** Distância de um ponto à linha de rua mais próxima (em x ou em z). */
const toStreet = (v: number) => Math.min(...STREET_LINES.map((l) => Math.abs(v - l)));

describe('Universe — planta da cidade', () => {
  it('nenhum prédio invade rua ou calçada, e cada um fica dentro da própria quadra', () => {
    for (const b of BUILDINGS)
      for (const s of b.solids) {
        for (const x of [s.minX, s.maxX]) expect(toStreet(x), `${b.id} x=${x}`).toBeGreaterThan(ROAD_WIDTH / 2);
        for (const z of [s.minZ, s.maxZ]) expect(toStreet(z), `${b.id} z=${z}`).toBeGreaterThan(ROAD_WIDTH / 2);
      }
  });

  it('cada local tem heliponto livre (fora de prédios e torres) e dentro da cidade', () => {
    const solids = citySolids('high');
    for (const p of PLACES) {
      for (const s of solids) expect(inside(p.pad.x, p.pad.z, s, 2.2), `${p.id} dentro de um sólido`).toBe(false);
      expect(Math.abs(p.pad.x)).toBeLessThan(WORLD_HALF);
      expect(Math.abs(p.pad.z)).toBeLessThan(WORLD_HALF);
    }
    expect(new Set(PLACES.map((p) => p.id)).size).toBe(PLACES.length);
  });

  it('as torres da cidade não se sobrepõem nem invadem as quadras dos edifícios', () => {
    const towers = citySolids('high').slice(BUILDINGS.flatMap((b) => b.solids).length + 1);
    for (let i = 0; i < towers.length; i++)
      for (let j = i + 1; j < towers.length; j++) {
        const a = towers[i]!;
        const b = towers[j]!;
        const overlap = a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;
        expect(overlap, `torres ${i} e ${j}`).toBe(false);
      }
    const central = [blockBounds(1, 0), blockBounds(1, 1), blockBounds(2, 1), blockBounds(0, 1), blockBounds(1, 2)];
    for (const t of towers) for (const c of central) expect(t.minX < c.maxX && c.minX < t.maxX && t.minZ < c.maxZ && c.minZ < t.maxZ).toBe(false);
  });

  it('o ponto de partida fica no parque de chegada, livre', () => {
    for (const s of citySolids('high')) expect(inside(SPAWN.x, SPAWN.z, s, 2.2)).toBe(false);
  });
});

describe('Universe — produtos e textos', () => {
  const paths = new Set((routes[0]!.children ?? []).map((r) => `/${r.path}`));

  it('todo produto aponta para uma rota que existe no site', () => {
    for (const p of PRODUCTS) expect(paths.has(p.route), p.route).toBe(true);
  });

  it('nome e descrição de cada produto vêm dos metadados da própria página, nos dois idiomas', () => {
    for (const locale of ['pt-BR', 'en'] as const)
      for (const p of PRODUCTS) {
        const text = productText(p, messages[locale]);
        expect(text.title.length).toBeGreaterThan(2);
        expect(text.description.length).toBeGreaterThan(20);
      }
  });

  it('as ações dos locais levam a rotas reais', () => {
    for (const locale of ['pt-BR', 'en'] as const)
      for (const place of Object.values(universeContent[locale].places)) for (const a of place.actions) expect(a.to === '/' || paths.has(a.to), a.to).toBe(true);
  });

  it('a rota /universe está registrada', () => {
    expect(paths.has('/universe')).toBe(true);
  });
});

describe('Universe — trânsito', () => {
  it('é determinístico', () => {
    const a = createTraffic('high');
    const b = createTraffic('high');
    for (let i = 0; i < 300; i++) {
      stepTraffic(a);
      stepTraffic(b);
    }
    expect(a.vehicles.map((v) => [v.x, v.z, v.speed])).toEqual(b.vehicles.map((v) => [v.x, v.z, v.speed]));
  });

  it('todas as rotas são terrestres nesta fase e seguem a faixa da direita, sobre as ruas', () => {
    const t = createTraffic('high');
    expect(ROUTES.every((r) => r.kind === 'ground')).toBe(true);
    for (const r of t.routes)
      for (let s = 0; s < r.length; s += 2) {
        const p = sampleRoute(r, s);
        // Sempre sobre uma rua: perto de uma linha de rua em x ou em z.
        expect(Math.min(toStreet(p.x), toStreet(p.z)), `${r.id} em ${s.toFixed(0)} m`).toBeLessThanOrEqual(ROAD_WIDTH / 2);
      }
  });

  for (const quality of ['high', 'low'] as const)
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
            // Caixa do carro: 4,1 m × 1,9 m.
            if (Math.abs(rx * dx + rz * dz) < 3.9 && Math.abs(rx * dz - rz * dx) < 1.9) overlaps++;
          }
      }
      expect(overlaps).toBe(0);
      expect(longestStop * TRAFFIC_STEP).toBeLessThan(20);
      // Todos andaram pelo menos metade do que andariam sem parar nunca.
      t.vehicles.forEach((v, i) => expect(v.s - start[i]!).toBeGreaterThan(CRUISE_SPEED * 600 * 0.5));
    });
});

describe('Universe — voo', () => {
  it('o carro não atravessa prédios: é empurrado para fora ou pousa no telhado', () => {
    const solids = citySolids('high');
    const hq = BUILDINGS[0]!.solids[1]!;
    const c = { x: (hq.minX + hq.maxX) / 2, y: 20, z: hq.maxZ - 1 };
    resolveCollisions(c, solids, 2.2, 20);
    expect(inside(c.x, c.z, hq, 2.19) && c.y < hq.height).toBe(false);
    const roof = { x: (hq.minX + hq.maxX) / 2, y: hq.height + 1, z: (hq.minZ + hq.maxZ) / 2 };
    resolveCollisions(roof, solids, 2.2, hq.height + 4);
    expect(roof.y).toBeGreaterThanOrEqual(hq.height + 2.2 - 1e-9);
  });

  it('respeita o chão, o teto e os limites da cidade', () => {
    const c = createCraft({ x: 0, y: 4, z: 78, yaw: 0 });
    for (let i = 0; i < 600; i++) stepCraft(c, { throttle: 1, turn: 0, lift: 1, boost: true }, 1 / 60, []);
    expect(c.y).toBeLessThanOrEqual(CEILING);
    expect(c.z).toBeLessThanOrEqual(WORLD_HALF);
    for (let i = 0; i < 600; i++) stepCraft(c, { throttle: 0, turn: 0, lift: -1, boost: false }, 1 / 60, []);
    expect(c.y).toBeGreaterThanOrEqual(MIN_ALTITUDE);
  });

  it('o piloto automático chega a todos os locais, de qualquer ponto de partida, sem bater', () => {
    const solids = citySolids('high');
    const starts = [{ ...SPAWN }, ...PLACES.map((p) => ({ x: p.pad.x, y: p.padAltitude, z: p.pad.z, yaw: p.padHeading }))];
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
        expect(t, `de (${from.x}, ${from.z}) até ${to.id}`).toBeLessThan(60);
        expect(hits, `colisões até ${to.id}`).toBe(0);
        expect(Math.hypot(c.x - to.pad.x, c.z - to.pad.z)).toBeLessThan(4);
      }
  });

  it('comando manual combina teclado, joystick e botões; "assumir o controle" desliga o piloto', () => {
    const rt = createUniverseRuntime();
    rt.keys.add('w');
    rt.joystick.x = 0.5;
    rt.buttons.up = true;
    expect(manualInput(rt)).toEqual({ throttle: 1, turn: 0.5, lift: 1, boost: false });
    rt.autopilot = { ...planAutopilot(rt.craft, { x: 0, z: 0, y: 5, yaw: 0 }, []), place: 'plaza' };
    cancelAutopilot(rt);
    expect(rt.autopilot).toBeNull();
  });
});
