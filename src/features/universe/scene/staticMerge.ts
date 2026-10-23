import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Camada que nem a câmera desenha nem o raio dos cliques testa: onde ficam as peças originais. */
const HIDDEN_LAYER = 31;

/**
 * Junta as peças estáticas e opacas de um grupo numa malha por material (e por
 * combinação de sombra), com as posições já aplicadas. Cada chamada de desenho
 * custa ~23 µs de CPU no Intel Iris Xe (shader, matrizes e uniforms passando
 * pelo Direct3D); os edifícios institucionais eram ~130 peças pequenas.
 *
 * Ficam de fora: o que tem `userData.dynamic` (e tudo dentro), malhas
 * instanciadas, linhas, sprites e materiais usados por uma peça só (não há o
 * que juntar). Transparentes entram quando a ordem não importa — brilho
 * aditivo (luz que se soma) ou sem escrita de profundidade — e ficam com a
 * mesma ordem de desenho (`renderOrder`) das peças de origem. As
 * originais continuam na cena, mas vão para uma camada invisível à câmera, às
 * sombras e aos cliques — o grupo continua clicável pelas malhas novas, que são
 * filhas dele. Devolve a função que desfaz tudo.
 */
export function mergeStatic(root: THREE.Object3D): () => void {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const buckets = new Map<string, { material: THREE.Material; cast: boolean; receive: boolean; order: number; meshes: THREE.Mesh[] }>();
  const visit = (o: THREE.Object3D) => {
    if (o.userData.dynamic) return;
    const mesh = o as THREE.Mesh & { isInstancedMesh?: boolean; isSkinnedMesh?: boolean };
    const mat = mesh.material as THREE.Material;
    const orderFree = !!mat && (!mat.transparent || mat.blending === THREE.AdditiveBlending || !mat.depthWrite);
    if (mesh.isMesh && !mesh.isInstancedMesh && !mesh.isSkinnedMesh && mesh.visible && !Array.isArray(mesh.material) && orderFree) {
      const g = mesh.geometry;
      const attrs = Object.keys(g.attributes).sort().join(',');
      const key = `${mat.uuid}|${mesh.castShadow}|${mesh.receiveShadow}|${mesh.renderOrder}|${attrs}|${g.morphAttributes.position ? 'm' : ''}`;
      const b = buckets.get(key) ?? { material: mat, cast: mesh.castShadow, receive: mesh.receiveShadow, order: mesh.renderOrder, meshes: [] };
      b.meshes.push(mesh);
      buckets.set(key, b);
    }
    for (const c of o.children) visit(c);
  };
  visit(root);

  const merged: THREE.Mesh[] = [];
  const hidden: THREE.Object3D[] = [];
  for (const b of buckets.values()) {
    if (b.meshes.length < 2) continue;
    const parts = b.meshes.map((m) => {
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(toRoot.clone().multiply(m.matrixWorld));
      return g;
    });
    const geo = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    if (!geo) continue;
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, b.material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.renderOrder = b.order;
    mesh.name = 'merged';
    root.add(mesh);
    merged.push(mesh);
    for (const m of b.meshes) {
      m.layers.set(HIDDEN_LAYER);
      hidden.push(m);
    }
  }
  return () => {
    for (const m of merged) {
      root.remove(m);
      m.geometry.dispose();
    }
    for (const m of hidden) m.layers.set(0);
  };
}
