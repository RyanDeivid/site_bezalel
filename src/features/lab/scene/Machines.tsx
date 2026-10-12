import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type JSX } from 'react';
import * as THREE from 'three';
import { ArmFleet, RobotArm } from '@/features/home/forja/robot-arm';
import type { AgentId } from '@/types/domain';

/**
 * A máquina de cada setor, feita em código: o que o agente faz, em forma de
 * equipamento. Coordenadas locais do setor: +Z aponta para a Central, Y = 0 é
 * o piso do pavilhão. Metais em PBR refletem o ambiente da cena.
 */

interface MachineProps {
  agent: AgentId;
  color: string;
  active: boolean;
  effects: boolean;
  quality: 'high' | 'low';
  /** Alturas relativas (0–1) das barras do Trend: contagem real do catálogo. */
  bars: number[];
}

const METAL = { color: '#2b3a52', metalness: 0.85, roughness: 0.26 } as const;
const STEEL = { color: '#c9d1dc', metalness: 0.7, roughness: 0.22 } as const;

function Base({ r = 0.75, h = 0.24 }: { r?: number; h?: number }) {
  return (
    <mesh position={[0, h / 2, 0]}>
      <cylinderGeometry args={[r * 0.9, r, h, 32]} />
      <meshStandardMaterial {...METAL} />
    </mesh>
  );
}

/** Scout: antena parabólica girando à procura de fontes. */
function ScoutMachine({ color, active, effects }: MachineProps) {
  const head = useRef<THREE.Group>(null);
  const lights = useRef<THREE.MeshBasicMaterial>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!effects) return;
    t.current += dt;
    if (head.current) head.current.rotation.y += dt * (active ? 1.2 : 0.35);
    if (lights.current) lights.current.opacity = active ? 0.55 + Math.abs(Math.sin(t.current * 5)) * 0.45 : 0.4;
  });
  return (
    <group>
      <Base />
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 2.1, 12]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      <group ref={head} position={[0, 2.3, 0]}>
        <mesh>
          <sphereGeometry args={[0.16, 16, 12]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
        <group rotation={[-0.55, 0, 0]} position={[0, 0.25, 0.1]}>
          {/* Prato: calota esférica com a concavidade para a frente. */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.85]}>
            <sphereGeometry args={[1, 36, 10, 0, Math.PI * 2, 0, 0.62]} />
            <meshStandardMaterial {...STEEL} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
            <meshStandardMaterial {...METAL} />
          </mesh>
          <mesh position={[0, 0, 0.4]}>
            <sphereGeometry args={[0.06, 12, 8]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        </group>
      </group>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.62, 0.3, Math.sin(a) * 0.62]}>
            <sphereGeometry args={[0.05, 10, 8]} />
            <meshBasicMaterial ref={i === 0 ? lights : undefined} color={color} transparent opacity={0.6} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Verifier: esteira de registros com dois braços robóticos triando (aprovados → verde, reprovados → vermelho). */
function VerifierMachine({ color, active, effects }: MachineProps) {
  const crates = useRef<THREE.InstancedMesh>(null);
  const t = useRef(0);
  const { fleet, arms } = useMemo(() => {
    const arms = [new RobotArm(color), new RobotArm(color)];
    arms.forEach((arm, i) => {
      arm.root.position.set(i === 0 ? -0.62 : 0.62, 0, -0.62);
      arm.root.scale.setScalar(0.4);
    });
    return { fleet: new ArmFleet(arms, null), arms };
  }, [color]);
  useEffect(() => () => fleet.dispose(), [fleet]);

  const target = useMemo(() => new THREE.Vector3(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  // Pontos da triagem (locais): coleta na esteira → ergue → solta no cesto.
  const pick = useMemo(() => [new THREE.Vector3(-0.35, 0.82, 0.32), new THREE.Vector3(0.45, 0.82, 0.32)], []);
  const bins = useMemo(() => [new THREE.Vector3(-1.25, 0.75, -0.35), new THREE.Vector3(1.25, 0.75, -0.35)], []);

  const pose = (time: number) => {
    arms.forEach((arm, i) => {
      const period = 3.4;
      const u = (((time + i * period * 0.5) % period) + period) % period / period;
      const s = (a: number, b: number) => THREE.MathUtils.smoothstep(u, a, b);
      const from = pick[i]!;
      const to = bins[i]!;
      // 0–0,3 desce na esteira · 0,3–0,4 pega · 0,4–0,75 leva ao cesto · 0,75–0,85 solta · volta.
      const go = s(0.4, 0.75) - s(0.88, 1);
      target.lerpVectors(from, to, go);
      target.y += Math.sin(Math.PI * go) * 0.55 + (1 - s(0.15, 0.3)) * 0.35 * (1 - go);
      const grip = s(0.3, 0.4) - s(0.75, 0.85);
      arm.reach(target, 1, grip);
    });
    fleet.sync();
  };

  useLayoutEffect(() => {
    pose(0);
    const mesh = crates.current;
    if (!mesh) return;
    const c = new THREE.Color();
    for (let i = 0; i < 5; i++) mesh.setColorAt(i, c.set(i % 3 === 2 ? '#e57465' : i % 2 ? '#5cc8a1' : '#ead9b2'));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  useFrame((_, dt) => {
    if (!effects) return;
    t.current += dt * (active ? 1.25 : 0.7);
    pose(t.current);
    const mesh = crates.current;
    if (!mesh) return;
    for (let i = 0; i < 5; i++) {
      const u = (t.current * 0.16 + i / 5) % 1;
      dummy.position.set(-1.05 + u * 2.1, 0.86, 0.32);
      dummy.scale.setScalar(u > 0.92 ? Math.max(0.001, (1 - u) / 0.08) : 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* Esteira */}
      <mesh position={[0, 0.72, 0.32]}>
        <boxGeometry args={[2.4, 0.08, 0.5]} />
        <meshStandardMaterial color="#0f1a2b" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.77, 0.32]}>
        <boxGeometry args={[2.4, 0.01, 0.44]} />
        <meshStandardMaterial color="#1c2a40" emissive={color} emissiveIntensity={active ? 0.25 : 0.08} />
      </mesh>
      {[-1.05, 1.05].map((x) => (
        <mesh key={x} position={[x, 0.36, 0.32]}>
          <boxGeometry args={[0.08, 0.72, 0.4]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}
      <instancedMesh ref={crates} args={[undefined, undefined, 5]} frustumCulled={false}>
        <boxGeometry args={[0.2, 0.14, 0.2]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* Cestos: reprovados (esq.) e aprovados (dir.) */}
      {(
        [
          [-1.25, '#e57465'],
          [1.25, '#5cc8a1'],
        ] as const
      ).map(([x, c]) => (
        <group key={x} position={[x, 0, -0.35]}>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial {...METAL} />
          </mesh>
          <mesh position={[0, 0.61, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.22, 0.28, 4, 1, Math.PI / 4]} />
            <meshBasicMaterial color={c} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <primitive object={fleet.group} />
    </group>
  );
}

/** Vigia: torre com farol varrendo o campus e um relógio no piso (o prazo de 180 dias). */
function VigiaMachine({ color, active, effects }: MachineProps) {
  const head = useRef<THREE.Group>(null);
  const hand = useRef<THREE.Group>(null);
  const beam = useRef<THREE.MeshBasicMaterial>(null);
  const ticks = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ticks.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      d.position.set(Math.sin(a) * 1.18, 0.03, Math.cos(a) * 1.18);
      d.rotation.set(0, a, 0);
      d.scale.set(1, 1, i % 3 === 0 ? 2.2 : 1);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame((_, dt) => {
    if (!effects) return;
    if (head.current) head.current.rotation.y += dt * (active ? 0.9 : 0.3);
    if (hand.current) hand.current.rotation.y -= dt * ((Math.PI * 2) / 18);
    if (beam.current) beam.current.opacity += ((active ? 0.16 : 0.08) - beam.current.opacity) * Math.min(1, dt * 3);
  });
  return (
    <group>
      <Base r={0.6} />
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.1, 0.17, 3.6, 14]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      {[1.1, 2.2, 3.3].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.02, 8, 24]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
      <group ref={head} position={[0, 3.9, 0]}>
        <mesh>
          <sphereGeometry args={[0.26, 20, 14]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
        <mesh position={[0, 0, 0.24]}>
          <circleGeometry args={[0.15, 20]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        {/* Feixe: cone aberto, com o vértice no farol, apontando para a frente e para baixo. */}
        <group rotation={[-1.05, 0, 0]}>
          <mesh position={[0, -2.3, 0]}>
            <coneGeometry args={[1.5, 4.6, 24, 1, true]} />
            <meshBasicMaterial ref={beam} color={color} transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        </group>
      </group>
      {/* Relógio no piso */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.26, 1.32, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} toneMapped={false} />
      </mesh>
      <instancedMesh ref={ticks} args={[undefined, undefined, 12]}>
        <boxGeometry args={[0.04, 0.02, 0.12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </instancedMesh>
      <group ref={hand}>
        <mesh position={[0, 0.04, 0.55]}>
          <boxGeometry args={[0.05, 0.03, 0.9]} />
          <meshBasicMaterial color="#ead9b2" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/** Atlas: holograma do grafo de competências girando sobre um projetor. */
function AtlasMachine({ color, active, effects }: MachineProps) {
  const holo = useRef<THREE.Group>(null);
  const nodes = useRef<THREE.InstancedMesh>(null);
  const { points, edges } = useMemo(() => {
    const n = 34;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      // Esfera de Fibonacci: nós bem distribuídos.
      const y = 1 - (2 * (i + 0.5)) / n;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.399963;
      pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(0.95));
    }
    const pos: number[] = [];
    pts.forEach((p, i) => {
      const nearest = pts
        .map((q, j) => [j, p.distanceTo(q)] as const)
        .filter(([j]) => j !== i)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 2);
      for (const [j] of nearest) if (j > i) pos.push(p.x, p.y, p.z, pts[j]!.x, pts[j]!.y, pts[j]!.z);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return { points: pts, edges: geo };
  }, []);
  useEffect(() => () => edges.dispose(), [edges]);
  useLayoutEffect(() => {
    const mesh = nodes.current;
    if (!mesh) return;
    const d = new THREE.Object3D();
    points.forEach((p, i) => {
      d.position.copy(p);
      d.scale.setScalar(i % 5 === 0 ? 1.6 : 1);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [points]);
  useFrame((_, dt) => {
    if (!effects || !holo.current) return;
    holo.current.rotation.y += dt * (active ? 0.6 : 0.2);
    holo.current.rotation.x = Math.sin(holo.current.rotation.y * 0.5) * 0.15;
  });
  return (
    <group>
      <Base r={0.55} h={0.5} />
      <mesh position={[0, 0.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.32, 32]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.85, 0.2, 1.4, 24, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <group ref={holo} position={[0, 2.15, 0]}>
        <instancedMesh ref={nodes} args={[undefined, undefined, points.length]}>
          <sphereGeometry args={[0.045, 10, 8]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </instancedMesh>
        <lineSegments geometry={edges}>
          <lineBasicMaterial color={color} transparent opacity={0.55} />
        </lineSegments>
      </group>
    </group>
  );
}

/** Trend: gráfico de barras em 3D com as competências mais frequentes do catálogo verificado. */
function TrendMachine({ color, active, effects, bars }: MachineProps) {
  const group = useRef<THREE.Group>(null);
  const grow = useRef(0);
  const t = useRef(0);
  const heights = bars.length ? bars : [1, 0.8, 0.6, 0.5, 0.4, 0.3];
  useFrame((_, dt) => {
    if (effects) {
      t.current += dt;
      grow.current = Math.min(1, grow.current + dt * 0.6);
    } else grow.current = 1;
    const g = group.current;
    if (!g) return;
    g.children.forEach((bar, i) => {
      const h = 0.25 + (heights[i] ?? 0) * 1.75;
      const breathe = active && effects ? 1 + Math.sin(t.current * 2 + i) * 0.03 : 1;
      bar.scale.y = Math.max(0.001, THREE.MathUtils.smootherstep(grow.current, i * 0.08, 0.6 + i * 0.08) * h * breathe);
    });
  });
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[2.3, 0.2, 1.1]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <group ref={group} position={[0, 0.2, 0]}>
        {heights.slice(0, 6).map((_, i) => (
          <group key={i} position={[-0.95 + i * 0.38, 0, 0]}>
            <mesh position={[0, 0.5, 0]}>
              <boxGeometry args={[0.26, 1, 0.5]} />
              <meshStandardMaterial color="#1e3149" metalness={0.6} roughness={0.25} emissive={color} emissiveIntensity={0.12} />
            </mesh>
            <mesh position={[0, 1.005, 0]}>
              <boxGeometry args={[0.27, 0.012, 0.51]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** Sol: um pequeno sol flutuante com órbitas — o ponto de ajuda do campus. */
function SolMachine({ color, active, effects }: MachineProps) {
  const sun = useRef<THREE.Group>(null);
  const r1 = useRef<THREE.Mesh>(null);
  const r2 = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!effects) return;
    t.current += dt;
    if (sun.current) {
      sun.current.position.y = 1.95 + Math.sin(t.current * 1.3) * 0.08;
      sun.current.rotation.y += dt * (active ? 0.8 : 0.25);
    }
    if (r1.current) r1.current.rotation.z += dt * 0.5;
    if (r2.current) r2.current.rotation.z -= dt * 0.35;
  });
  return (
    <group>
      <Base r={0.6} />
      <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.4, 40]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <group ref={sun} position={[0, 1.95, 0]}>
        <mesh>
          <icosahedronGeometry args={[0.36, 2]} />
          <meshStandardMaterial color="#ffd9b8" emissive={color} emissiveIntensity={1.6} roughness={0.4} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62]} rotation={[0, -a, Math.PI / 2]}>
              <cylinderGeometry args={[0.015, 0.03, 0.26, 6]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
          );
        })}
        <mesh ref={r1} rotation={[Math.PI / 2.3, 0.3, 0]}>
          <torusGeometry args={[0.85, 0.012, 8, 80]} />
          <meshBasicMaterial color="#ead9b2" toneMapped={false} />
        </mesh>
        <mesh ref={r2} rotation={[Math.PI / 1.8, -0.5, 0]}>
          <torusGeometry args={[1.05, 0.01, 8, 80]} />
          <meshBasicMaterial color={color} transparent opacity={0.7} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

const MACHINES: Record<AgentId, (p: MachineProps) => JSX.Element> = {
  scout: ScoutMachine,
  verifier: VerifierMachine,
  vigia: VigiaMachine,
  atlas: AtlasMachine,
  trend: TrendMachine,
  sol: SolMachine,
};

export function Machine(props: MachineProps) {
  const Component = MACHINES[props.agent];
  return <Component {...props} />;
}
