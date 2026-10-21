import * as THREE from 'three';

/**
 * Materiais de profundidade fixos para a passada de sombras.
 *
 * O three desenha todos os objetos que projetam sombra com um único material
 * de profundidade e, a cada objeto, copia para ele a textura, o lado e o
 * instanciamento do material original. Numa cidade em que as fachadas têm
 * textura e os acabamentos não, e em que há malhas comuns e instanciadas, o
 * shader de sombra trocava de variante dezenas de vezes por quadro (o three
 * recalcula a chave do programa a cada troca — custo de CPU em todo quadro) e
 * a variante "com textura" só era compilada na primeira vez que uma fachada
 * entrava na área das sombras: uma travada de ~80 ms em pleno jogo.
 *
 * Aqui cada objeto que projeta sombra recebe um material de profundidade que
 * não aceita essas cópias (textura, máscara e deslocamento ficam sempre vazios,
 * o lado fica sempre o de trás, que evita manchas de sombra na própria
 * superfície), um por tipo de malha — comum, instanciada, instanciada com cor
 * por instância. Nenhum material da cidade usa recorte por transparência, então
 * as sombras ficam iguais.
 */
function lockedDepth() {
  const m = new THREE.MeshDepthMaterial();
  for (const key of ['map', 'alphaMap', 'displacementMap'] as const) Object.defineProperty(m, key, { get: () => null, set: () => {} });
  Object.defineProperty(m, 'side', { get: () => THREE.BackSide, set: () => {} });
  return m;
}

export class ShadowDepth {
  private plain = lockedDepth();
  private instanced = lockedDepth();
  private instancedColor = lockedDepth();

  /** Atribui o material de profundidade a cada malha que projeta sombra (roda de novo para as que surgirem). */
  apply(root: THREE.Object3D) {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.castShadow) return;
      const im = o as THREE.InstancedMesh;
      mesh.customDepthMaterial = !im.isInstancedMesh ? this.plain : im.instanceColor ? this.instancedColor : this.instanced;
    });
  }

  dispose() {
    this.plain.dispose();
    this.instanced.dispose();
    this.instancedColor.dispose();
  }
}
