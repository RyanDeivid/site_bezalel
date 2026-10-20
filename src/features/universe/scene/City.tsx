import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { atLeast, BLOCKS, blockBounds, BUILDINGS, DISTRICTS, PLACES, PLAZA_RADIUS, ROAD_WIDTH, SIDEWALK, STREET_LINES } from '../world/city';
import type { Quality, UniverseAssets } from './assets';
import { CROWN_Y, treeCrown, treeTrunk, type TreeKind } from './treeGeometry';
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

export function City({ assets, quality, pools }: { assets: UniverseAssets; quality: Quality; /** Poças de luz dos postes no chão (médio para cima). */ pools: boolean }) {
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
    const out: Array<{ x: number; z: number; s: number; kind: TreeKind }> = [];
    let k = 0;
    for (const d of DISTRICTS) {
      const b = blockBounds(d.block[0], d.block[1]);
      const step = hi ? 8 : 13;
      for (let x = b.minX + 3; x <= b.maxX - 3; x += step)
        for (const z of [b.minZ + 3, b.maxZ - 3]) if (treeFree(x, z)) out.push({ x, z, s: 0.85 + ((k * 37) % 10) / 25, kind: k++ % 3 === 2 ? 'columnar' : 'round' });
      for (let z = b.minZ + 3 + step; z <= b.maxZ - 3 - step; z += step)
        for (const x of [b.minX + 3, b.maxX - 3]) if (treeFree(x, z)) out.push({ x, z, s: 0.85 + ((k * 37) % 10) / 25, kind: k++ % 3 === 2 ? 'columnar' : 'round' });
    }
    return out;
  }, [hi]);
  // Duas espécies (copa redonda e colunar): copa de cachos irregulares com a cor nos vértices e tronco com galhos.
  // Copas mais lisas (cachos subdivididos) na Alta e na Ultra; na Baixa e na Média, cachos facetados.
  const treeDetail = atLeast(quality, 'high');
  const treeGeos = useMemo(() => {
    const d = treeDetail ? 1 : 0;
    return { round: { crown: treeCrown('round', d), trunk: treeTrunk('round') }, columnar: { crown: treeCrown('columnar', d), trunk: treeTrunk('columnar') } };
  }, [treeDetail]);
  useEffect(
    () => () =>
      Object.values(treeGeos).forEach((t) => {
        t.crown.dispose();
        t.trunk.dispose();
      }),
    [treeGeos],
  );
  const roundTrunkRef = useRef<THREE.InstancedMesh>(null);
  const roundCrownRef = useRef<THREE.InstancedMesh>(null);
  const colTrunkRef = useRef<THREE.InstancedMesh>(null);
  const colCrownRef = useRef<THREE.InstancedMesh>(null);
  const treeM = useMemo(() => {
    const of = (kind: TreeKind) => trees.filter((t) => t.kind === kind);
    const trunk = (kind: TreeKind) => of(kind).map((t, i) => compose(t.x, 0.3, t.z, i * 1.7, t.s, t.s, t.s));
    const crown = (kind: TreeKind) => of(kind).map((t, i) => compose(t.x, 0.3 + CROWN_Y[kind] * t.s, t.z, i * 2.3, t.s, t.s, t.s));
    return { roundTrunk: trunk('round'), roundCrown: crown('round'), colTrunk: trunk('columnar'), colCrown: crown('columnar') };
  }, [trees]);
  useInstanceMatrices(roundTrunkRef, treeM.roundTrunk);
  useInstanceMatrices(roundCrownRef, treeM.roundCrown);
  useInstanceMatrices(colTrunkRef, treeM.colTrunk);
  useInstanceMatrices(colCrownRef, treeM.colCrown);

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
  // ---- Meio-fio: borda de concreto claro em volta de cada calçada (uma malha só) ----
  const curbs = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let bx = 0; bx < BLOCKS; bx++)
      for (let bz = 0; bz < BLOCKS; bz++) {
        const b = blockBounds(bx, bz);
        const x0 = b.minX - SIDEWALK;
        const x1 = b.maxX + SIDEWALK;
        const z0 = b.minZ - SIDEWALK;
        const z1 = b.maxZ + SIDEWALK;
        const w = x1 - x0;
        const d = z1 - z0;
        parts.push(new THREE.BoxGeometry(w, 0.26, 0.24).translate((x0 + x1) / 2, 0.13, z0), new THREE.BoxGeometry(w, 0.26, 0.24).translate((x0 + x1) / 2, 0.13, z1));
        parts.push(new THREE.BoxGeometry(0.24, 0.26, d).translate(x0, 0.13, (z0 + z1) / 2), new THREE.BoxGeometry(0.24, 0.26, d).translate(x1, 0.13, (z0 + z1) / 2));
      }
    const g = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    return g;
  }, []);
  const curbMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8b8d92', roughness: 0.82, metalness: 0 }), []);

  // ---- Poças de luz: um disco aditivo no chão da rua, à frente de cada poste ----
  const poolRef = useRef<THREE.InstancedMesh>(null);
  const poolM = useMemo(() => lamps.map((l) => compose(l.x + Math.sin(l.r) * 3.2, 0.055, l.z + Math.cos(l.r) * 3.2, 0, 1, 1, 1)), [lamps]);
  useInstanceMatrices(poolRef, poolM);
  const pool = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,214,160,1)');
    g.addColorStop(0.35, 'rgba(255,200,140,0.55)');
    g.addColorStop(1, 'rgba(255,190,130,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.42, 0.36, 0.3), toneMapped: false });
    return { texture, material, geometry: new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2) };
  }, []);
  useEffect(
    () => () => {
      curbs.dispose();
      curbMat.dispose();
      pool.texture.dispose();
      pool.material.dispose();
      pool.geometry.dispose();
    },
    [curbs, curbMat, pool],
  );

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
      {/* O meio-fio (26 cm) não projeta sombra que se veja: fica fora da passada de sombras. */}
      <mesh geometry={curbs} material={curbMat} receiveShadow />
      {pools && <instancedMesh ref={poolRef} args={[pool.geometry, pool.material, poolM.length]} renderOrder={7} frustumCulled={false} />}
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

      {/* Só as copas projetam sombra (o tronco fino não faz diferença no chão). */}
      <instancedMesh ref={roundTrunkRef} args={[treeGeos.round.trunk, m.trunk, treeM.roundTrunk.length]} />
      <instancedMesh ref={roundCrownRef} args={[treeGeos.round.crown, m.foliage, treeM.roundCrown.length]} castShadow={hi} />
      <instancedMesh ref={colTrunkRef} args={[treeGeos.columnar.trunk, m.trunk, treeM.colTrunk.length]} />
      <instancedMesh ref={colCrownRef} args={[treeGeos.columnar.crown, m.foliage, treeM.colCrown.length]} castShadow={hi} />

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
