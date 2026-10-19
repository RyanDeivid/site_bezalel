import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { TowerMaterial, TowerVariant } from '../world/city';
import { boxWithMeterUVs } from './textures';

/** Materiais das torres; `slab` são as lajes salientes, `glow` as faixas de luz. */
export type Slot = TowerMaterial | 'slab' | 'glow' | 'roofGlow' | 'green';

const box = (w: number, h: number, d: number, x: number, y: number, z: number, tileW = 12, tileH = 14) => boxWithMeterUVs(w, h, d, tileW, tileH).translate(x, y, z);

/**
 * Monta uma linguagem arquitetônica como geometrias mescladas por material:
 * os volumes (com UVs em metros, para as janelas não esticarem), as aletas
 * verticais e as lajes que avançam da fachada (profundidade de verdade, não
 * só textura), a faixa de LED e o coroamento.
 */
export function buildTowerGeometry(v: TowerVariant, detail: boolean): Map<Slot, THREE.BufferGeometry> {
  const parts = new Map<Slot, THREE.BufferGeometry[]>();
  const add = (slot: Slot, g: THREE.BufferGeometry) => parts.set(slot, [...(parts.get(slot) ?? []), g]);
  let y = 0;
  let top = v.parts[0]!;
  for (const p of v.parts) {
    const cx = p.dx ?? 0;
    const cz = p.dz ?? 0;
    add(p.material, box(p.w, p.h, p.d, cx, y + p.h / 2, cz));
    if (detail && p.fins) {
      // Aletas verticais nas quatro faces, a cada 2,5 m.
      for (let x = -p.w / 2 + 1.25; x < p.w / 2 - 0.5; x += 2.5)
        for (const s of [1, -1]) add('frame', box(0.22, p.h, 0.55, cx + x, y + p.h / 2, cz + s * (p.d / 2 + 0.25)));
      for (let z = -p.d / 2 + 1.25; z < p.d / 2 - 0.5; z += 2.5) for (const s of [1, -1]) add('frame', box(0.55, p.h, 0.22, cx + s * (p.w / 2 + 0.25), y + p.h / 2, cz + z));
    }
    if (detail && p.bands) {
      // Lajes/varandas: avançam 0,6 m a cada 3,5 m de altura.
      for (let h = 3.5; h < p.h - 0.5; h += 3.5) add('slab', box(p.w + 1.2, 0.28, p.d + 1.2, cx, y + h, cz, 4, 4));
    }
    // Arremate de topo de cada volume (recuo marcado).
    add('slab', box(p.w + 0.4, 0.45, p.d + 0.4, cx, y + p.h + 0.22, cz, 4, 4));
    y += p.h;
    top = p;
  }
  if (v.led) {
    const main = v.parts.reduce((a, b) => (b.h > a.h ? b : a));
    const mainY = v.parts.slice(0, v.parts.indexOf(main)).reduce((h, p) => h + p.h, 0);
    add('glow', box(0.35, main.h * 0.92, 0.12, main.dx ?? 0, mainY + main.h / 2, (main.dz ?? 0) + main.d / 2 + 0.62));
  }
  const tx = top.dx ?? 0;
  const tz = top.dz ?? 0;
  switch (v.roof) {
    case 'antenna':
      add('frame', new THREE.CylinderGeometry(0.12, 0.2, 9, 6).translate(tx, y + 4.5, tz));
      add('roofGlow', new THREE.SphereGeometry(0.3, 8, 6).translate(tx, y + 9.2, tz));
      break;
    case 'helipad':
      add('frame', new THREE.CylinderGeometry(top.w * 0.42, top.w * 0.42, 0.3, 24).translate(tx, y + 0.6, tz));
      add('roofGlow', new THREE.TorusGeometry(top.w * 0.36, 0.08, 4, 32).rotateX(Math.PI / 2).translate(tx, y + 0.8, tz));
      break;
    case 'units':
      for (const [x, z, w] of [
        [-top.w * 0.25, 0, 3],
        [top.w * 0.2, -top.d * 0.15, 2.2],
        [top.w * 0.2, top.d * 0.22, 1.6],
      ] as const)
        add('frame', box(w, 1.8, w, tx + x, y + 1.35, tz + z, 4, 4));
      break;
    case 'garden':
      add('green', box(top.w * 0.8, 0.6, top.d * 0.8, tx, y + 0.75, tz, 4, 4));
      break;
    case 'spire':
      add('frame', new THREE.ConeGeometry(top.w * 0.32, 10, 4).rotateY(Math.PI / 4).translate(tx, y + 5.4, tz));
      add('roofGlow', new THREE.SphereGeometry(0.25, 8, 6).translate(tx, y + 10.5, tz));
      break;
  }
  const out = new Map<Slot, THREE.BufferGeometry>();
  for (const [slot, list] of parts) {
    // Todas indexadas e com o mesmo conjunto de atributos (posição, normal, uv): mesclam sem conversão.
    out.set(slot, mergeGeometries(list)!);
    list.forEach((g) => g.dispose());
  }
  return out;
}
