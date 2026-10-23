import type * as THREE from 'three';

interface RenderItem {
  id: number;
  groupOrder: number;
  renderOrder: number;
  material: THREE.Material;
  z: number;
}

/**
 * Ordem dos opacos agrupada por programa de shader. O padrão do three ordena por material, e materiais de
 * tipos diferentes se intercalam (padrão, físico, básico…). A cada troca de programa ele religa o shader e
 * reenvia câmera, luzes, névoa e reflexos. Agrupando primeiro pelo programa já compilado (e depois pelo
 * material e pela profundidade, como antes), as trocas caem a uma por programa. É custo do processador
 * por quadro, e é o gargalo medido nos celulares. Os transparentes ficam na ordem padrão (de trás para a
 * frente), que a mistura de cores exige.
 */
export function installProgramSort(gl: THREE.WebGLRenderer): void {
  const props = (gl as unknown as { properties: { get: (m: THREE.Material) => { currentProgram?: { id: number } } } }).properties;
  const program = (m: THREE.Material) => props.get(m).currentProgram?.id ?? 0;
  gl.setOpaqueSort(((a: RenderItem, b: RenderItem) => {
    if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
    if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
    if (a.material !== b.material) {
      const pa = program(a.material);
      const pb = program(b.material);
      if (pa !== pb) return pa - pb;
      return (a.material as unknown as { id: number }).id - (b.material as unknown as { id: number }).id;
    }
    if (a.z !== b.z) return a.z - b.z;
    return a.id - b.id;
  }) as unknown as Parameters<THREE.WebGLRenderer['setOpaqueSort']>[0]);
}
