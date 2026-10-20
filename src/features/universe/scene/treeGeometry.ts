import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export type TreeKind = 'round' | 'columnar';

/** Pseudo-ruído determinístico a partir da posição (o mesmo vértice sempre se desloca igual: sem rachaduras). */
const hash = (x: number, y: number, z: number) => {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
};

/** Copas: cachos sobrepostos (centro e raio, em metros), de baixo para cima. */
const CLUSTERS: Record<TreeKind, Array<[number, number, number, number]>> = {
  round: [
    [0, 0, 0, 1.55],
    [0.95, 0.25, 0.35, 1.1],
    [-0.85, 0.35, -0.45, 1.15],
    [0.25, 1.05, -0.3, 1.05],
    [-0.35, -0.35, 0.85, 0.95],
    [0.5, 0.6, 0.9, 0.8],
  ],
  columnar: [
    [0, -0.6, 0, 1.0],
    [0.2, 0.4, 0.1, 0.95],
    [-0.15, 1.35, -0.1, 0.85],
    [0.1, 2.2, 0.05, 0.7],
    [0, 2.9, 0, 0.5],
  ],
};

const DARK = new THREE.Color('#1c3326');
const LIGHT = new THREE.Color('#4f7a4c');

/**
 * Copa de árvore: cachos de folhagem com a superfície irregular (não um
 * poliedro liso), sombreada de dentro para fora — mais escura embaixo e no
 * miolo, mais clara no alto, onde pega a luz —, com a cor em cada vértice.
 * `detail` 1 no médio para cima, 0 no baixo (cachos mais simples).
 */
export function treeCrown(kind: TreeKind, detail: 0 | 1): THREE.BufferGeometry {
  const parts = CLUSTERS[kind].map(([cx, cy, cz, r], i) => {
    let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(r, detail);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    g = mergeVertices(g);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k);
      const y = pos.getY(k);
      const z = pos.getZ(k);
      const d = 1 + (hash(x + i, y, z) - 0.5) * 0.34;
      pos.setXYZ(k, cx + x * d, cy + y * d * 0.9, cz + z * d);
    }
    g.computeVertexNormals();
    return g;
  });
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  g.computeBoundingBox();
  const box = g.boundingBox!;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const h = (pos.getY(k) - box.min.y) / (box.max.y - box.min.y);
    // Mais claro no alto e nas faces voltadas para cima; um pouco de variação por folha.
    const t = THREE.MathUtils.clamp(h * 0.7 + Math.max(0, nor.getY(k)) * 0.35 + (hash(pos.getX(k), pos.getY(k), pos.getZ(k)) - 0.5) * 0.18, 0, 1);
    c.copy(DARK).lerp(LIGHT, t);
    colors.set([c.r, c.g, c.b], k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Tronco com dois galhos que entram na copa. Base no chão (y = 0). */
export function treeTrunk(kind: TreeKind): THREE.BufferGeometry {
  const h = kind === 'round' ? 2.9 : 2.2;
  const parts = [
    new THREE.CylinderGeometry(0.12, 0.2, h, 7).translate(0, h / 2, 0),
    new THREE.CylinderGeometry(0.05, 0.09, 1.3, 5)
      .translate(0, 0.65, 0)
      .rotateZ(-0.7)
      .translate(0.05, h - 0.45, 0),
    new THREE.CylinderGeometry(0.05, 0.08, 1.1, 5)
      .translate(0, 0.55, 0)
      .rotateX(0.75)
      .translate(0, h - 0.25, 0.05),
  ];
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}

/** Altura do centro da copa acima do chão, para cada espécie (em escala 1). */
export const CROWN_Y: Record<TreeKind, number> = { round: 3.9, columnar: 3.4 };
