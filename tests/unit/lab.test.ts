import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { curatedCourses } from '@/data/catalog/courses';
import { AGENT_IDS } from '@/domain/operations';
import { assessFreshness, MAX_RECORD_AGE_DAYS, RECHECK_WINDOW_DAYS } from '@/domain/pipeline';
import {
  constrainToFloor,
  deliveryFor,
  ENTRANCE_ANGLE,
  HUB_RADIUS,
  INTERACT_DISTANCE,
  LAB_RADIUS,
  nearestStation,
  OBSTACLES,
  PLAZA_RADIUS,
  parkingSpot,
  pathLength,
  pointAlong,
  routePath,
  SECTOR_RADIUS,
  SECTOR_SIZE,
  SPAWN,
  STATIONS,
  travelPath,
  type Place,
  type Point2,
} from '@/features/lab/layout';
import { COURSE_STOPS, courseFacts, guideTo, journeyStops, stopPose, TOUR_STOPS } from '@/features/lab/journey';
import { Humanoid, restPose } from '@/features/lab/scene/robots/humanoid';

const angleGap = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** Menor folga (m) entre um ponto e a borda dos equipamentos. */
const clearance = (p: Point2) => Math.min(...OBSTACLES.map((o) => Math.hypot(p.x - o.x, p.z - o.z) - o.r));

/** Pontos a cada `step` metros ao longo de um caminho. */
function sample(path: Point2[], step = 0.2): Point2[] {
  const total = pathLength(path);
  const out: Point2[] = [];
  for (let d = 0; d <= total; d += step) out.push(pointAlong(path, d));
  return out;
}

describe('campus do laboratório (v2 · Fase 3)', () => {
  it('tem ~3× a área do laboratório da v1 e um setor por agente', () => {
    expect((LAB_RADIUS / 16) ** 2).toBeGreaterThan(2.8);
    expect((LAB_RADIUS / 16) ** 2).toBeLessThan(3.3);
    expect(STATIONS.map((s) => s.id).sort()).toEqual([...AGENT_IDS].sort());
    for (const s of STATIONS) expect(Math.hypot(s.x, s.z)).toBeCloseTo(SECTOR_RADIUS, 6);
    // Pavilhões inteiros dentro do campus e sem se sobrepor.
    expect(SECTOR_RADIUS + SECTOR_SIZE).toBeLessThan(LAB_RADIUS - 1);
    for (const a of STATIONS) for (const b of STATIONS) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(2 * SECTOR_SIZE);
  });

  it('a entrada fica livre e o visitante nasce fora dos setores', () => {
    // Corredor da entrada (do portal até a praça) com folga de 2 m de cada pavilhão.
    for (let r = PLAZA_RADIUS; r <= LAB_RADIUS; r += 0.5) {
      const p = { x: Math.cos(ENTRANCE_ANGLE) * r, z: Math.sin(ENTRANCE_ANGLE) * r };
      for (const s of STATIONS) expect(Math.hypot(p.x - s.x, p.z - s.z)).toBeGreaterThan(SECTOR_SIZE + 2);
    }
    expect(constrainToFloor(SPAWN.x, SPAWN.z)).toEqual(SPAWN);
    expect(nearestStation(SPAWN.x, SPAWN.z).distance).toBeGreaterThan(INTERACT_DISTANCE);
  });

  it('o Vigia é vizinho do Verifier (para quem devolve os vencidos)', () => {
    const vigia = STATIONS.find((s) => s.id === 'vigia')!;
    const verifier = STATIONS.find((s) => s.id === 'verifier')!;
    expect(angleGap(vigia.angle, verifier.angle)).toBeCloseTo(Math.PI / 3, 6);
  });

  it('colisão: caminhando, o visitante não entra em console, máquina, monitores nem na Central', () => {
    // Como no jogo: a cada quadro, um passo curto em direção ao alvo, corrigido pela colisão.
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    let p = { ...SPAWN };
    let minClear = Infinity;
    let minR = Infinity;
    let maxR = 0;
    for (let walk = 0; walk < 160; walk++) {
      const target = { x: rand() * LAB_RADIUS, z: rand() * LAB_RADIUS };
      for (let step = 0; step < 300; step++) {
        const dx = target.x - p.x;
        const dz = target.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.2) break;
        p = constrainToFloor(p.x + (dx / d) * 0.1, p.z + (dz / d) * 0.1);
        const r = Math.hypot(p.x, p.z);
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minClear = Math.min(minClear, clearance(p));
      }
    }
    expect(maxR).toBeLessThanOrEqual(LAB_RADIUS - 1.4 + 1e-9);
    expect(minR).toBeGreaterThan(HUB_RADIUS + 0.5);
    expect(minClear).toBeGreaterThan(0.2);
  });
});

describe('rotas dos robôs carregadores', () => {
  const places: Place[] = ['hub', ...AGENT_IDS];

  it('ligam quaisquer dois lugares sem atravessar equipamentos nem a Central', () => {
    for (const from of places) {
      for (const to of places) {
        if (from === to) continue;
        const path = routePath(from, to);
        expect(path.length).toBeGreaterThan(1);
        const pts = sample(path);
        const radii = pts.map((p) => Math.hypot(p.x, p.z));
        expect(Math.min(...radii)).toBeGreaterThan(HUB_RADIUS + 1.5);
        expect(Math.max(...radii)).toBeLessThan(LAB_RADIUS - 2);
        expect(Math.min(...pts.map(clearance))).toBeGreaterThan(0.3);
      }
    }
  });

  it('seguem o anel pelo lado mais curto', () => {
    expect(pathLength(routePath('verifier', 'vigia'))).toBeLessThan(pathLength(routePath('scout', 'vigia')));
    expect(pathLength(routePath('scout', 'verifier'))).toBeCloseTo(pathLength(routePath('verifier', 'scout')), 6);
  });

  it('da vaga até qualquer ponto de coleta também é um caminho livre', () => {
    for (let i = 0; i < 6; i++) {
      for (const from of places) {
        for (const to of places) {
          if (from === to) continue;
          const pts = sample(travelPath(parkingSpot(i), routePath(from, to)[0]!));
          expect(Math.min(...pts.map((p) => Math.hypot(p.x, p.z)))).toBeGreaterThan(HUB_RADIUS + 1.5);
          expect(Math.min(...pts.map(clearance))).toBeGreaterThan(0.3);
        }
      }
    }
  });

  it('pointAlong anda do início ao fim e aponta na direção do trecho', () => {
    const path = [
      { x: 0, z: 0 },
      { x: 0, z: 2 },
      { x: 3, z: 2 },
    ];
    expect(pointAlong(path, 0)).toMatchObject({ x: 0, z: 0 });
    expect(pointAlong(path, 1)).toMatchObject({ x: 0, z: 1, heading: 0 });
    expect(pointAlong(path, 3.5).x).toBeCloseTo(1.5);
    expect(pointAlong(path, 3.5).heading).toBeCloseTo(Math.PI / 2);
    expect(pointAlong(path, 99)).toMatchObject({ x: 3, z: 2 });
  });

  it('cada evento vira a entrega certa (ou nenhuma)', () => {
    expect(deliveryFor({ agentId: 'scout', type: 'opportunity.discovered' })).toEqual({ from: 'scout', to: 'verifier' });
    expect(deliveryFor({ agentId: 'verifier', type: 'record.published' })).toEqual({ from: 'verifier', to: 'hub' });
    expect(deliveryFor({ agentId: 'vigia', type: 'record.outdated' })).toEqual({ from: 'vigia', to: 'verifier' });
    expect(deliveryFor({ agentId: 'atlas', type: 'graph.linked', entityLabel: 'skill-graph' })).toEqual({ from: 'atlas', to: 'hub' });
    expect(deliveryFor({ agentId: 'atlas', type: 'graph.linked', entityLabel: 'CS50x' })).toEqual({ from: 'hub', to: 'atlas' });
    expect(deliveryFor({ agentId: 'scout', type: 'source.checked' })).toBeNull();
  });
});

describe('reconferência de 180 dias (agente Vigia)', () => {
  const NOW = new Date('2026-10-11T12:00:00Z');
  const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

  it('separa vencidos, perto do prazo e em dia, do mais urgente ao menos', () => {
    const report = assessFreshness(
      [
        { id: 'a', title: 'Em dia', lastCheckedAt: daysAgo(10) },
        { id: 'b', title: 'Perto', lastCheckedAt: daysAgo(MAX_RECORD_AGE_DAYS - 5) },
        { id: 'c', title: 'Mais perto', lastCheckedAt: daysAgo(MAX_RECORD_AGE_DAYS - 1) },
        { id: 'd', title: 'Vencido', lastCheckedAt: daysAgo(MAX_RECORD_AGE_DAYS + 20) },
        { id: 'e', title: 'Sem data legível', lastCheckedAt: 'não informado' },
      ],
      NOW,
    );
    expect(report.total).toBe(5);
    expect(report.overdue.map((i) => i.id)).toEqual(['e', 'd']);
    expect(report.dueSoon.map((i) => i.id)).toEqual(['c', 'b']);
    expect(report.oldestAge).toBe(MAX_RECORD_AGE_DAYS + 20);
    expect(report.windowDays).toBe(RECHECK_WINDOW_DAYS);
  });

  it('a confirmação na fonte vale mais que a data de revisão interna', () => {
    const report = assessFreshness([{ id: 'a', title: 'A', lastCheckedAt: daysAgo(1), sourceVerifiedAt: daysAgo(MAX_RECORD_AGE_DAYS + 1) }], NOW);
    expect(report.overdue).toHaveLength(1);
  });

  it('no catálogo real, nada vence logo depois da curadoria (10–11/10/2026)', () => {
    const report = assessFreshness(curatedCourses, NOW);
    expect(report.total).toBe(curatedCourses.length);
    expect(report.overdue).toHaveLength(0);
    expect(report.dueSoon).toHaveLength(0);
  });
});

describe('robôs humanoides articulados', () => {
  const world = (robot: Humanoid, key: string) => robot.parts.filter((p) => p.key === key).map((p) => p.anchor.getWorldPosition(new THREE.Vector3()));

  it('em repouso, fica de pé com os pés no chão e a cabeça no alto', () => {
    const robot = new Humanoid('#ffffff');
    robot.apply(restPose());
    robot.root.updateMatrixWorld(true);
    for (const foot of world(robot, 'foot')) expect(Math.abs(foot.y)).toBeLessThan(0.06);
    expect(world(robot, 'head')[0]!.y).toBeGreaterThan(1.6);
  });

  it('a caixa só aparece quando carrega, à frente do peito e entre as mãos', () => {
    const robot = new Humanoid('#ffffff');
    const crate = robot.parts.find((p) => p.key === 'crate')!.anchor;
    robot.apply(restPose());
    expect(crate.scale.x).toBeLessThan(0.01);
    robot.apply({ ...restPose(), carry: 1 });
    robot.root.updateMatrixWorld(true);
    expect(crate.scale.x).toBe(1);
    expect(crate.getWorldPosition(new THREE.Vector3()).z).toBeGreaterThan(0.3);
    const hands = world(robot, 'palm');
    expect(hands[0]!.z).toBeGreaterThan(0.3);
    expect(Math.sign(hands[0]!.x)).toBe(-Math.sign(hands[1]!.x));
  });

  it('caminhando, as pernas se alternam', () => {
    const robot = new Humanoid('#ffffff');
    robot.apply({ ...restPose(), walk: 1, phase: Math.PI / 2 });
    robot.root.updateMatrixWorld(true);
    const [a, b] = world(robot, 'foot');
    // Um pé à frente, o outro atrás.
    expect(Math.sign(a!.z)).toBe(-Math.sign(b!.z));
  });
});

describe('jornadas guiadas (tour e "seguir um curso")', () => {
  const NOW = new Date('2026-10-12T12:00:00Z');

  it('as duas jornadas passam pela Central e pelos seis setores, uma vez cada', () => {
    for (const kind of ['tour', 'course'] as const) {
      const stops = journeyStops(kind);
      expect([...stops].sort()).toEqual(['hub', ...AGENT_IDS].sort());
    }
    expect(TOUR_STOPS[0]).toBe('hub');
    expect(COURSE_STOPS[0]).toBe('scout');
  });

  it('cada parada é piso livre, e o visitante logo atrás do guia fica "no setor"', () => {
    for (const place of TOUR_STOPS) {
      const p = stopPose(place);
      expect(constrainToFloor(p.x, p.z)).toEqual({ x: p.x, z: p.z });
      if (place === 'hub') continue;
      const behind = { x: p.x - Math.sin(p.heading) * 1.6, z: p.z - Math.cos(p.heading) * 1.6 };
      expect(nearestStation(behind.x, behind.z)).toMatchObject({ id: place });
      expect(nearestStation(behind.x, behind.z).distance).toBeLessThan(INTERACT_DISTANCE);
    }
  });

  it('o guia anda de parada em parada sem atravessar equipamentos nem a Central', () => {
    for (const stops of [TOUR_STOPS, COURSE_STOPS]) {
      let from: Point2 = SPAWN;
      for (const place of stops) {
        const guide = guideTo(from, place, false);
        const pts = sample(guide.path);
        expect(Math.min(...pts.map((p) => Math.hypot(p.x, p.z)))).toBeGreaterThan(HUB_RADIUS + 1.5);
        expect(Math.min(...pts.map(clearance))).toBeGreaterThan(0.3);
        from = stopPose(place);
      }
    }
  });

  it('os fatos de um curso real saem dos campos dele e do catálogo publicado', () => {
    const course = curatedCourses.find((c) => c.slug === 'harvard-cs50x')!;
    const facts = courseFacts(course, curatedCourses, NOW);
    expect(facts.source).toMatchObject({ provider: course.provider.name, host: 'cs50.harvard.edu' });
    // Todo campo está em exatamente uma lista: confirmado, inferido ou não informado.
    const all = [...facts.verify.stated, ...facts.verify.inferred, ...facts.verify.missing].sort();
    expect(all).toEqual(['certificate', 'duration', 'level', 'prerequisites', 'price']);
    expect(facts.skills.map((s) => s.id).sort()).toEqual([...course.skills].sort());
    for (let i = 1; i < facts.skills.length; i++) expect(facts.skills[i - 1]!.courses).toBeGreaterThanOrEqual(facts.skills[i]!.courses);
    const python = facts.skills.find((s) => s.id === 'python')!;
    expect(python.courses).toBe(curatedCourses.filter((c) => c.publicationStatus === 'published' && c.skills.includes('python')).length);
    const checked = course.sourceVerifiedAt ?? course.lastCheckedAt;
    expect(Date.parse(facts.recheck.dueAt) - Date.parse(checked)).toBe(MAX_RECORD_AGE_DAYS * 86_400_000);
    expect(facts.recheck.daysLeft).toBeGreaterThan(170);
    expect(facts.ask.query).toBe(course.title);
  });

  it('campo ausente na fonte vai para "não informado"; nível inferido é sinalizado', () => {
    const base = curatedCourses[0]!;
    const facts = courseFacts({ ...base, priceType: 'unknown', certificateType: undefined, level: 'beginner', levelSource: 'inferred' }, curatedCourses, NOW);
    expect(facts.verify.missing).toEqual(expect.arrayContaining(['price', 'certificate']));
    expect(facts.verify.inferred).toEqual(['level']);
    expect(facts.verify.stated).not.toContain('level');
  });
});
