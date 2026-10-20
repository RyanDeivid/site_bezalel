import type * as THREE from 'three';

/**
 * O three guarda, por material, o estado do último objeto que o usou
 * (instanciado ou não, cor por instância, recebe sombra, esqueleto…). Quando o
 * mesmo material serve a objetos que pedem shaders diferentes, cada alternância
 * no quadro o faz recalcular qual programa usar (`getProgram` →
 * `getParameters` → chave do cache): medido no Intel Iris Xe, ~1,5 s de CPU a
 * cada 3 s de jogo, quase metade do quadro.
 *
 * Aqui cada material ganha uma cópia por combinação de uso — a primeira
 * combinação fica com o original. As cópias compartilham as mesmas texturas
 * (`clone` copia referências), então não pesam na memória da placa de vídeo, e
 * reaproveitam os mesmos programas já compilados.
 *
 * Seguro enquanto os materiais compartilhados não forem alterados durante o
 * jogo (as alterações em tempo real usam materiais próprios: luzes de
 * navegação, freio, sombra do voador). `splitSharedMaterials` pode rodar de
 * novo a qualquer momento: só cria cópias para usos novos.
 */
type Splittable = THREE.Mesh & { isInstancedMesh?: boolean; instanceColor?: unknown; isSkinnedMesh?: boolean };

const signature = (o: Splittable) => {
  const g = o.geometry as THREE.BufferGeometry | undefined;
  const color = g?.attributes?.color as THREE.BufferAttribute | undefined;
  return [o.isInstancedMesh ? 'inst' : 'mesh', o.instanceColor ? 'cor' : '', o.receiveShadow ? 'recebe' : '', o.isSkinnedMesh ? 'pele' : '', g?.morphAttributes?.position ? 'morph' : '', color?.itemSize === 4 ? 'rgba' : ''].join('|');
};

export class MaterialSplitter {
  private owner = new Map<THREE.Material, string>();
  private copies = new Map<string, THREE.Material>();
  private made: THREE.Material[] = [];

  /** Passa pela cena e troca materiais compartilhados entre usos incompatíveis por cópias. Devolve quantas trocas fez. */
  split(scene: THREE.Object3D): number {
    let swaps = 0;
    scene.traverse((obj) => {
      const o = obj as Splittable;
      if (!o.isMesh || !o.material) return;
      const sig = signature(o);
      const fix = (m: THREE.Material) => {
        const original = (m.userData.bzSplitFrom as THREE.Material | undefined) ?? m;
        const first = this.owner.get(original);
        if (first === undefined) {
          this.owner.set(original, sig);
          return m;
        }
        if (first === sig) return original;
        const key = `${original.uuid}#${sig}`;
        let copy = this.copies.get(key);
        if (!copy) {
          copy = original.clone();
          copy.userData.bzSplitFrom = original;
          this.copies.set(key, copy);
          this.made.push(copy);
        }
        return copy;
      };
      if (Array.isArray(o.material)) {
        const next = o.material.map(fix);
        if (next.some((m, i) => m !== (o.material as THREE.Material[])[i])) {
          o.material = next;
          swaps++;
        }
      } else {
        const next = fix(o.material);
        if (next !== o.material) {
          o.material = next;
          swaps++;
        }
      }
    });
    return swaps;
  }

  dispose() {
    this.made.forEach((m) => m.dispose());
    this.made = [];
    this.copies.clear();
    this.owner.clear();
  }
}
