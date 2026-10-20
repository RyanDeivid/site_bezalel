import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BLOCKS, blockBounds, BUILDINGS, DISTRICTS, PLACES, PLAZA_RADIUS, ROAD_WIDTH, SIDEWALK, STREET_LINES } from '../world/city';
import type { Quality, UniverseAssets } from './assets';
import { boxWithMeterUVs } from './textures';

const ROAD_LENGTH = STREET_LINES[STREET_LINES.length - 1]! - STREET_LINES[0] + ROAD_WIDTH;
const LAWN_BLOCKS = new Set(DISTRICTS.map((d) => d.block.join(',')));

/** Escreve as matrizes de um InstancedMesh uma vez (os objetos da cidade são estáticos). */
function useInstanceMatrices(ref: React.RefObject<THREE.InstancedMesh | null>, matrices: THREE.Matrix4[]) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.count = matrices.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, matrices]);
}

const compose = (x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz));

/** Placa (caixa com UVs em metros) já posicionada, para mesclar em uma geometria só. */
function slab(minX: number, maxX: number, minZ: number, maxZ: number, top: number, thickness: number, tile: number) {
  const g = boxWithMeterUVs(maxX - minX, thickness, maxZ - minZ, tile, tile);
  g.translate((minX + maxX) / 2, top - thickness / 2, (minZ + maxZ) / 2);
  return g;
}

/** Ponto livre para árvore: fora de prédios, pads, praça e caminhos. */
function treeFree(x: number, z: number): boolean {
  if (Math.hypot(x, z) < PLAZA_RADIUS + 3) return false;
  if (Math.abs(x) < 4 && Math.abs(z) < 40) return false;
  if (Math.abs(z) < 4 && Math.abs(x) < 40) return false;
  for (const p of PLACES) if (Math.hypot(x - p.pad.x, z - p.pad.z) < 12) return false;
  for (const b of BUILDINGS) for (const s of b.solids) if (x > s.minX - 4 && x < s.maxX + 4 && z > s.minZ - 4 && z < s.maxZ + 4) return false;
  return true;
}

export function City({ assets, quality }: { assets: UniverseAssets; quality: Quality }) {
  const m = assets.materials;
  // Médio e alto: mobiliário urbano denso; baixo: metade.
  const hi = quality !== 'low';

  // ---- Ruas: 8 faixas longas (4 em cada eixo) e 16 cruzamentos -------------------------
  const roadRef = useRef<THREE.InstancedMesh>(null);
  const crossRef = useRef<THREE.InstancedMesh>(null);
  const roadMatrices = useMemo(
    () => [...STREET_LINES.map((z) => compose(0, 0.03, z)), ...STREET_LINES.map((x) => compose(x, 0.031, 0, Math.PI / 2))],
    [],
  );
  const crossMatrices = useMemo(() => STREET_LINES.flatMap((x) => STREET_LINES.map((z) => compose(x, 0.04, z))), []);
  useInstanceMatrices(roadRef, roadMatrices);
  useInstanceMatrices(crossRef, crossMatrices);
  const roadGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(ROAD_LENGTH, ROAD_WIDTH);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (ROAD_LENGTH / ROAD_WIDTH));
    return g;
  }, []);
  const crossGeo = useMemo(() => new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_WIDTH).rotateX(-Math.PI / 2), []);

  // ---- Quadras: calçadas, jardins e pátios (geometrias mescladas: 1 chamada cada) -----------
  const { sidewalks, lawns, corners } = useMemo(() => {
    const side: THREE.BufferGeometry[] = [];
    const lawn: THREE.BufferGeometry[] = [];
    const corner: THREE.BufferGeometry[] = [];
    for (let bx = 0; bx < BLOCKS; bx++)
      for (let bz = 0; bz < BLOCKS; bz++) {
        const b = blockBounds(bx, bz);
        side.push(slab(b.minX - SIDEWALK, b.maxX + SIDEWALK, b.minZ - SIDEWALK, b.maxZ + SIDEWALK, 0.22, 0.22, 4));
        (LAWN_BLOCKS.has(`${bx},${bz}`) ? lawn : corner).push(slab(b.minX, b.maxX, b.minZ, b.maxZ, 0.3, 0.1, 6));
      }
    const merged = { sidewalks: mergeGeometries(side)!, lawns: mergeGeometries(lawn)!, corners: mergeGeometries(corner)! };
    [...side, ...lawn, ...corner].forEach((g) => g.dispose());
    return merged;
  }, []);

  // Caminhos da praça até as quatro ruas e, no parque de chegada, do heliponto até a rua.
  const paths = useMemo(() => {
    const plaza = DISTRICTS.find((d) => d.id === 'plaza')!.block;
    const b = blockBounds(plaza[0], plaza[1]);
    const south = DISTRICTS.find((d) => d.id === 'arrival')!.block;
    const arrival = blockBounds(south[0], south[1]);
    const pad = PLACES.find((p) => p.id === 'arrival')!.pad;
    return mergeGeometries([
      slab(-3, 3, b.minZ, -PLAZA_RADIUS + 1, 0.34, 0.04, 6),
      slab(-3, 3, PLAZA_RADIUS - 1, b.maxZ, 0.34, 0.04, 6),
      slab(b.minX, -PLAZA_RADIUS + 1, -3, 3, 0.34, 0.04, 6),
      slab(PLAZA_RADIUS - 1, b.maxX, -3, 3, 0.34, 0.04, 6),
      slab(-2.5, 2.5, arrival.minZ, pad.z - 6, 0.34, 0.04, 6),
    ])!;
  }, []);

  // ---- Árvores, postes, bancos e balizas -------------------------------------------------
  const trees = useMemo(() => {
    const out: Array<{ x: number; z: number; s: number }> = [];
    let k = 0;
    for (const d of DISTRICTS) {
      const b = blockBounds(d.block[0], d.block[1]);
      const step = hi ? 8 : 13;
      for (let x = b.minX + 3; x <= b.maxX - 3; x += step)
        for (const z of [b.minZ + 3, b.maxZ - 3]) if (treeFree(x, z)) out.push({ x, z, s: 0.85 + ((k++ * 37) % 10) / 25 });
      for (let z = b.minZ + 3 + step; z <= b.maxZ - 3 - step; z += step)
        for (const x of [b.minX + 3, b.maxX - 3]) if (treeFree(x, z)) out.push({ x, z, s: 0.85 + ((k++ * 37) % 10) / 25 });
    }
    return out;
  }, [hi]);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const trunkM = useMemo(() => trees.map((t) => compose(t.x, 0.3 + 1.4 * t.s, t.z, 0, t.s, t.s, t.s)), [trees]);
  const crownM = useMemo(() => trees.map((t, i) => compose(t.x, 0.3 + 3.9 * t.s, t.z, i, t.s, t.s * 1.5, t.s)), [trees]);
  useInstanceMatrices(trunkRef, trunkM);
  useInstanceMatrices(crownRef, crownM);

  const lamps = useMemo(() => {
    const out: Array<{ x: number; z: number; r: number }> = [];
    const step = hi ? 16 : 26;
    for (let bx = 0; bx < BLOCKS; bx++)
      for (let bz = 0; bz < BLOCKS; bz++) {
        const b = blockBounds(bx, bz);
        const e = SIDEWALK - 1;
        for (let x = b.minX + 4; x <= b.maxX - 4; x += step) {
          out.push({ x, z: b.minZ - e, r: Math.PI });
          out.push({ x, z: b.maxZ + e, r: 0 });
        }
        for (let z = b.minZ + 4; z <= b.maxZ - 4; z += step) {
          out.push({ x: b.minX - e, z, r: -Math.PI / 2 });
          out.push({ x: b.maxX + e, z, r: Math.PI / 2 });
        }
      }
    return out;
  }, [hi]);
  const poleRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const poleM = useMemo(() => lamps.map((l) => compose(l.x, 3.2, l.z)), [lamps]);
  // A cabeça do poste avança sobre a rua (direção `r`).
  const headM = useMemo(() => lamps.map((l) => compose(l.x + Math.sin(l.r) * 0.7, 6.3, l.z + Math.cos(l.r) * 0.7, l.r)), [lamps]);
  useInstanceMatrices(poleRef, poleM);
  useInstanceMatrices(headRef, headM);

  const benchRef = useRef<THREE.InstancedMesh>(null);
  const bollardRef = useRef<THREE.InstancedMesh>(null);
  const bollardCapRef = useRef<THREE.InstancedMesh>(null);
  const benchM = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
        return compose(Math.cos(a) * 19, 0.75, Math.sin(a) * 19, -a);
      }),
    [],
  );
  const bollards = useMemo(
    () =>
      Array.from({ length: hi ? 40 : 20 }, (_, i) => {
        const a = (i / (hi ? 40 : 20)) * Math.PI * 2;
        return { x: Math.cos(a) * (PLAZA_RADIUS - 0.8), z: Math.sin(a) * (PLAZA_RADIUS - 0.8) };
      }).filter((p) => Math.abs(p.x) > 4 && Math.abs(p.z) > 4),
    [hi],
  );
  // Balizas também em volta do heliponto de chegada.
  const allBollards = useMemo(() => {
    const pad = PLACES.find((p) => p.id === 'arrival')!.pad;
    const ring = Array.from({ length: 12 }, (_, i) => ({ x: pad.x + Math.cos((i / 12) * Math.PI * 2) * 7.5, z: pad.z + Math.sin((i / 12) * Math.PI * 2) * 7.5 }));
    return [...bollards, ...ring];
  }, [bollards]);
  const bollardM = useMemo(() => allBollards.map((p) => compose(p.x, 0.85, p.z)), [allBollards]);
  const bollardCapM = useMemo(() => allBollards.map((p) => compose(p.x, 1.42, p.z)), [allBollards]);
  useInstanceMatrices(benchRef, benchM);
  useInstanceMatrices(bollardRef, bollardM);
  useInstanceMatrices(bollardCapRef, bollardCapM);

  useLayoutEffect(
    () => () => {
      [roadGeo, crossGeo, sidewalks, lawns, corners, paths].forEach((g) => g.dispose());
    },
    [roadGeo, crossGeo, sidewalks, lawns, corners, paths],
  );

  // Ordem de desenho do chão, de cima para baixo (praça e jardins → calçadas → cruzamentos → ruas →
  // terreno), depois de prédios e veículos (ordem 0). As camadas se sobrepõem; desenhando a de cima
  // primeiro, o teste de profundidade descarta os pixels de baixo antes de calcular o material e as
  // sombras deles. Medido no Intel Iris Xe: o chão era a parte mais cara do quadro.
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={m.ground} receiveShadow renderOrder={6}>
        <planeGeometry args={[420, 420]} />
      </mesh>
      <instancedMesh ref={roadRef} args={[roadGeo, m.road, roadMatrices.length]} receiveShadow renderOrder={5} />
      <instancedMesh ref={crossRef} args={[crossGeo, m.intersection, crossMatrices.length]} receiveShadow renderOrder={4} />
      <mesh geometry={sidewalks} material={m.sidewalk} receiveShadow renderOrder={3} />
      <mesh geometry={lawns} material={m.lawn} receiveShadow renderOrder={2} />
      <mesh geometry={corners} material={m.corner} receiveShadow renderOrder={2} />

      {/* Praça: piso, espelho d'água e caminhos */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.36, 0]} material={m.plaza} receiveShadow renderOrder={1}>
        <circleGeometry args={[PLAZA_RADIUS, hi ? 96 : 48]} />
      </mesh>
      <mesh geometry={paths} material={m.path} receiveShadow renderOrder={1} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.37, 0]} material={m.water}>
        <ringGeometry args={[9.4, 12.6, hi ? 96 : 48]} />
      </mesh>
      {[9.2, 12.8].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.39, 0]} material={m.glowGoldSoft}>
          <ringGeometry args={[r - 0.12, r + 0.12, hi ? 96 : 48]} />
        </mesh>
      ))}

      <instancedMesh ref={trunkRef} args={[undefined, m.trunk, trunkM.length]} castShadow={hi}>
        <cylinderGeometry args={[0.18, 0.26, 2.8, 6]} />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[undefined, m.foliage, crownM.length]} castShadow={hi}>
        <icosahedronGeometry args={[1.45, 0]} />
      </instancedMesh>

      <instancedMesh ref={poleRef} args={[undefined, m.steel, poleM.length]}>
        <cylinderGeometry args={[0.09, 0.13, 6.4, 6]} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, m.glowWarm, headM.length]}>
        <boxGeometry args={[0.32, 0.12, 1.5]} />
      </instancedMesh>

      <instancedMesh ref={benchRef} args={[undefined, m.steelLight, benchM.length]} castShadow={hi}>
        <boxGeometry args={[0.7, 0.45, 3.2]} />
      </instancedMesh>
      <instancedMesh ref={bollardRef} args={[undefined, m.steel, bollardM.length]}>
        <cylinderGeometry args={[0.16, 0.2, 1.1, 8]} />
      </instancedMesh>
      <instancedMesh ref={bollardCapRef} args={[undefined, m.glowIvory, bollardCapM.length]}>
        <cylinderGeometry args={[0.17, 0.17, 0.08, 8]} />
      </instancedMesh>

    </group>
  );
}
