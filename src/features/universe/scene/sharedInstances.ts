import type * as THREE from 'three';

/**
 * As peças de um mesmo conjunto (lataria, vidro, luzes de um modelo de carro ou de voador) têm as mesmas
 * matrizes por instância. Cada uma com o próprio buffer, o quadro reenviava a mesma lista várias vezes à
 * placa de vídeo e o laço as escrevia várias vezes. Compartilhando o buffer da primeira peça, o three envia
 * uma vez por quadro (ele só reenvia um atributo cuja versão mudou) e o laço escreve uma vez.
 * Idempotente: pode ser chamado a cada quadro (cobre peças montadas depois).
 */
export function shareMatrices(list: ReadonlyArray<THREE.InstancedMesh | null | undefined>): THREE.InstancedMesh | null {
  let first: THREE.InstancedMesh | null = null;
  for (const m of list) {
    if (!m) continue;
    if (!first) first = m;
    else if (m.instanceMatrix !== first.instanceMatrix && m.instanceMatrix.count === first.instanceMatrix.count) m.instanceMatrix = first.instanceMatrix;
  }
  return first;
}
