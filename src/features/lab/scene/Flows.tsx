import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { AgentId } from '@/types/domain';
import { AGENT_HEX } from '@/components/agents/AgentGlyph';
import { STATION_LINKS, STATIONS, stationById } from '../layout';

interface FlowDef {
  key: string;
  agent: AgentId;
  curve: THREE.QuadraticBezierCurve3;
}

const MAX_PULSES = 10;

/**
 * Fluxos de dados: arcos de cada estação até a Central e entre estações do
 * pipeline. Partículas discretas circulam continuamente; cada evento novo
 * dispara um pulso brilhante no arco do agente que o produziu.
 */
export function Flows({ effects, quality, pulse }: { effects: boolean; quality: 'high' | 'low'; pulse: { id: string; agent: AgentId } | null }) {
  const flows = useMemo<FlowDef[]>(() => {
    const toHub = STATIONS.map((s) => {
      const start = new THREE.Vector3(s.x * 0.86, 1.1, s.z * 0.86);
      const end = new THREE.Vector3(0, 1.4, 0);
      const mid = start.clone().lerp(end, 0.5).setY(4.6);
      return { key: `${s.id}-hub`, agent: s.id, curve: new THREE.QuadraticBezierCurve3(start, mid, end) };
    });
    const links = STATION_LINKS.map(([a, b]) => {
      const sa = stationById(a);
      const sb = stationById(b);
      const start = new THREE.Vector3(sa.x * 0.9, 0.2, sa.z * 0.9);
      const end = new THREE.Vector3(sb.x * 0.9, 0.2, sb.z * 0.9);
      const mid = start.clone().lerp(end, 0.5).multiplyScalar(1.12).setY(1.6);
      return { key: `${a}-${b}`, agent: a, curve: new THREE.QuadraticBezierCurve3(start, mid, end) };
    });
    return [...toHub, ...links];
  }, []);

  const lines = useMemo(
    () =>
      flows.map((f) => {
        const geo = new THREE.BufferGeometry().setFromPoints(f.curve.getPoints(64));
        const mat = new THREE.LineBasicMaterial({ color: AGENT_HEX[f.agent], transparent: true, opacity: 0.28 });
        return new THREE.Line(geo, mat);
      }),
    [flows],
  );

  const perFlow = quality === 'high' ? 3 : 1;
  const ambientCount = flows.length * perFlow;
  const total = ambientCount + MAX_PULSES;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const pulses = useRef<Array<{ flow: number; t: number }>>([]);
  const time = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const c = new THREE.Color();
    for (let i = 0; i < total; i++) {
      const flow = flows[i < ambientCount ? Math.floor(i / perFlow) : 0]!;
      c.set(i < ambientCount ? AGENT_HEX[flow.agent] : '#ead9b2');
      mesh.setColorAt(i, c);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [flows, total, ambientCount, perFlow]);

  // Novo evento → pulso no arco do agente até a Central.
  useEffect(() => {
    if (!pulse) return;
    const idx = flows.findIndex((f) => f.key === `${pulse.agent}-hub`);
    if (idx < 0) return;
    pulses.current = [...pulses.current.slice(-(MAX_PULSES - 1)), { flow: idx, t: 0 }];
  }, [pulse, flows]);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (effects) time.current += dt;
    for (let i = 0; i < ambientCount; i++) {
      const flow = flows[Math.floor(i / perFlow)]!;
      const offset = (i % perFlow) / perFlow;
      const p = flow.curve.getPointAt((time.current * 0.12 + offset + (i * 0.37) % 1) % 1);
      dummy.position.copy(p);
      dummy.scale.setScalar(0.07);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    pulses.current = pulses.current.filter((pl) => (pl.t += dt * 0.55) < 1);
    for (let k = 0; k < MAX_PULSES; k++) {
      const pl = pulses.current[k];
      if (pl) {
        const flow = flows[pl.flow]!;
        dummy.position.copy(flow.curve.getPointAt(pl.t));
        dummy.scale.setScalar(0.16 + Math.sin(pl.t * Math.PI) * 0.1);
      } else {
        dummy.position.set(0, -50, 0);
        dummy.scale.setScalar(0.0001);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(ambientCount + k, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {lines.map((line, i) => (
        <primitive key={flows[i]!.key} object={line} />
      ))}
      <instancedMesh ref={meshRef} args={[undefined, undefined, total]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
