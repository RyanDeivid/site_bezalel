import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { AGENT_HEX } from '@/components/agents/AgentGlyph';
import type { AgentId, AgentStatus } from '@/types/domain';
import { deliveryFor, parkingSpot, pathLength, pointAlong, routePath, SECTOR_SPOTS, sectorPoint, STATIONS, travelPath, type LabPulse, type LabRuntime, type Point2 } from '../layout';
import { Humanoid, HumanoidFleet, restPose, type HumanoidPose } from './robots/humanoid';

const SPEED = 2.3; // m/s
const STRIDE = Math.PI / 0.72; // rad de passada por metro (meia passada ≈ 0,72 m)
const HANDOFF_S = 0.75; // pegar/soltar a caixa
const MAX_QUEUE = 4;
const CARRIER_COLOR = '#ead9b2';

interface Leg {
  path: Point2[];
  length: number;
  /** Carrega a caixa neste trecho? */
  loaded: boolean;
}

interface Carrier {
  robot: Humanoid;
  pose: HumanoidPose;
  home: Point2;
  x: number;
  z: number;
  heading: number;
  legs: Leg[];
  leg: number;
  dist: number;
  /** Tempo restante parado (pegando ou soltando a caixa). */
  hold: number;
}

interface Operator {
  robot: Humanoid;
  pose: HumanoidPose;
  id: AgentId;
  heading: number;
}

/** Cor do registro carregado: entra no catálogo (ouro), vencido (âmbar) ou a cor do agente. */
function crateColor(e: LabPulse): string {
  if (e.type === 'record.published') return '#ead9b2';
  if (e.type === 'record.outdated') return '#e3b35a';
  return AGENT_HEX[e.agentId];
}

const leg = (path: Point2[], loaded: boolean): Leg => ({ path, length: pathLength(path), loaded });
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Robôs do campus: um operador por setor (digita no console quando o agente
 * está ativo e olha para o visitante que se aproxima) e uma equipe de
 * carregadores que leva cada registro de um setor a outro quando o evento
 * correspondente acontece (ex.: oportunidade descoberta → Scout leva ao
 * Verifier; publicado → Verifier leva à Central; vencido → Vigia devolve ao
 * Verifier). Tudo desenhado por uma única frota instanciada.
 */
export function Robots({
  runtime,
  statuses,
  near,
  pulse,
  effects,
  carriers: carrierCount,
}: {
  runtime: LabRuntime;
  statuses: Record<AgentId, AgentStatus>;
  near: AgentId | null;
  pulse: LabPulse | null;
  effects: boolean;
  carriers: number;
}) {
  const statusRef = useRef(statuses);
  const nearRef = useRef(near);
  useEffect(() => {
    statusRef.current = statuses;
    nearRef.current = near;
  }, [statuses, near]);

  const { fleet, operators, carriers } = useMemo(() => {
    const operators: Operator[] = STATIONS.map((s) => {
      const robot = new Humanoid(AGENT_HEX[s.id]);
      const p = sectorPoint(s, SECTOR_SPOTS.operator);
      // Plataforma do pavilhão tem 0,25 m de altura.
      robot.root.position.set(p.x, 0.25, p.z);
      const heading = Math.atan2(-Math.cos(s.angle), -Math.sin(s.angle));
      robot.root.rotation.y = heading;
      return { robot, pose: { ...restPose(), time: s.angle * 3 }, id: s.id, heading };
    });
    const carriers: Carrier[] = Array.from({ length: carrierCount }, (_, i) => {
      const robot = new Humanoid(CARRIER_COLOR);
      const home = parkingSpot(i);
      const heading = Math.atan2(-home.x, -home.z);
      robot.root.position.set(home.x, 0, home.z);
      robot.root.rotation.y = heading;
      return { robot, pose: { ...restPose(), time: i }, home, x: home.x, z: home.z, heading, legs: [], leg: 0, dist: 0, hold: 0 };
    });
    const fleet = new HumanoidFleet([...operators.map((o) => o.robot), ...carriers.map((c) => c.robot)]);
    return { fleet, operators, carriers };
  }, [carrierCount]);

  useEffect(() => () => fleet.dispose(), [fleet]);

  // Primeira pose (também quando os efeitos estão pausados).
  useEffect(() => {
    operators.forEach((o) => o.robot.apply(o.pose));
    carriers.forEach((c) => c.robot.apply(c.pose));
    fleet.sync();
  }, [fleet, operators, carriers]);

  // Novo evento com entrega → um carregador livre vai buscar o registro.
  const queue = useRef<LabPulse[]>([]);
  useEffect(() => {
    if (!pulse || !deliveryFor(pulse)) return;
    queue.current = [...queue.current.slice(-(MAX_QUEUE - 1)), pulse];
  }, [pulse]);

  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rawDt) => {
    if (!effects) return;
    const dt = Math.min(0.05, rawDt);

    // Despacho: o carregador livre mais próximo do ponto de coleta.
    while (queue.current.length) {
      const free = carriers.filter((c) => c.legs.length === 0);
      if (!free.length) break;
      const event = queue.current.shift()!;
      const delivery = deliveryFor(event)!;
      const route = routePath(delivery.from, delivery.to);
      const start = route[0]!;
      const end = route[route.length - 1]!;
      const c = free.reduce((best, x) => (Math.hypot(x.x - start.x, x.z - start.z) < Math.hypot(best.x - start.x, best.z - start.z) ? x : best));
      c.legs = [leg(travelPath({ x: c.x, z: c.z }, start), false), leg(route, true), leg(travelPath(end, c.home), false)];
      c.leg = 0;
      c.dist = 0;
      c.hold = 0;
      fleet.setCrateColor(c.robot, crateColor(event));
    }

    for (const c of carriers) {
      c.pose.time += dt;
      const current = c.legs[c.leg];
      let walking = false;
      if (current) {
        if (c.hold > 0) {
          c.hold -= dt;
          // Pegando (antes do trecho carregado) ou soltando (depois dele).
          const target = current.loaded ? 1 : 0;
          c.pose.carry += (target - c.pose.carry) * Math.min(1, dt * 6);
        } else {
          c.dist += SPEED * dt;
          const p = pointAlong(current.path, c.dist);
          c.x = p.x;
          c.z = p.z;
          c.heading += wrap(p.heading - c.heading) * Math.min(1, dt * 8);
          c.pose.phase += SPEED * dt * STRIDE;
          walking = true;
          if (c.dist >= current.length) {
            c.leg += 1;
            c.dist = 0;
            const next = c.legs[c.leg];
            if (!next) c.legs = [];
            else if (next.loaded !== current.loaded) c.hold = HANDOFF_S;
          }
        }
      } else {
        // Na vaga: vira para a Central e descansa.
        c.heading += wrap(Math.atan2(-c.x, -c.z) - c.heading) * Math.min(1, dt * 3);
        c.pose.carry += (0 - c.pose.carry) * Math.min(1, dt * 6);
      }
      c.pose.walk += ((walking ? 1 : 0) - c.pose.walk) * Math.min(1, dt * 7);
      c.robot.root.position.set(c.x, 0, c.z);
      c.robot.root.rotation.y = c.heading;
      c.robot.apply(c.pose);
    }

    for (const o of operators) {
      o.pose.time += dt;
      const active = statusRef.current[o.id] === 'active';
      o.pose.type += ((active ? 1 : 0.3) - o.pose.type) * Math.min(1, dt * 3);
      let look = Math.sin(o.pose.time * 0.4) * 0.25;
      if (nearRef.current === o.id) {
        o.robot.root.getWorldPosition(tmp);
        look = THREE.MathUtils.clamp(wrap(Math.atan2(runtime.player.x - tmp.x, runtime.player.z - tmp.z) - o.heading), -0.9, 0.9);
      }
      o.pose.look += (look - o.pose.look) * Math.min(1, dt * 4);
      o.robot.apply(o.pose);
    }
    fleet.sync();
  });

  return <primitive object={fleet.group} />;
}
