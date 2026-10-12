import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { AgentId } from '@/types/domain';
import { AGENT_HEX } from '@/components/agents/AgentGlyph';
import { dockOf, SECTOR_SPOTS, sectorPoint, STATION_LINKS, STATIONS, type LabPulse } from '../layout';

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
export function Flows({ effects, quality, pulse }: { effects: boolean; quality: 'high' | 'low'; pulse: LabPulse | null }) {
  const flows = useMemo<FlowDef[]>(() => {
    // Do topo do console de cada setor até o núcleo da Central, em arco alto.
    const toHub = STATIONS.map((s) => {
      const p = sectorPoint(s, SECTOR_SPOTS.console);
      const start = new THREE.Vector3(p.x, 1.4, p.z);
      const end = new THREE.Vector3(0, 2.6, 0);
      const mid = start.clone().lerp(end, 0.5).setY(7.5);
      return { key: `${s.id}-hub`, agent: s.id, curve: new THREE.QuadraticBezierCurve3(start, mid, end) };
    });
    // Entre setores vizinhos do pipeline: arcos baixos por cima do anel de circulação.
    const links = STATION_LINKS.map(([a, b]) => {
      const da = dockOf(a);
      const db = dockOf(b);
      const start = new THREE.Vector3(da.x, 0.3, da.z);
      const end = new THREE.Vector3(db.x, 0.3, db.z);
      const mid = start.clone().lerp(end, 0.5);
      mid.setLength(Math.max(mid.length(), 4) * 1.18).setY(2.4);
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
    const idx = flows.findIndex((f) => f.key === `${pulse.agentId}-hub`);
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
