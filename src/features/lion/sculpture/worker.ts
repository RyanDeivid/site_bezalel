/// <reference lib="webworker" />
import { meshLion, sampleSurface, silhouette } from './mesher';

/**
 * Trabalho pesado fora da thread principal:
 * - `samples`: a forma do leão em pontos — a superfície do campo de distância
 *   vira malha e a malha é amostrada por área (posição, normal e oclusão de
 *   cada ponto). São os alvos das partículas que formam o leão de luz.
 * - `outline`: só o contorno de lado (o desenho que fica quando não há 3D).
 * Os buffers são transferidos, não copiados.
 */
export type SculptRequest = { kind: 'samples'; count: number; cell: number; seed: number } | { kind: 'outline' };

export type SculptMessage =
  | { kind: 'samples'; positions: Float32Array; normals: Float32Array; shade: Float32Array }
  | { kind: 'outline'; silhouette: Float32Array }
  | { kind: 'error'; message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (e: MessageEvent<SculptRequest>) => {
  try {
    const req = e.data;
    if (req.kind === 'outline') {
      const sil = silhouette();
      scope.postMessage({ kind: 'outline', silhouette: sil } satisfies SculptMessage, [sil.buffer]);
      return;
    }
    const s = sampleSurface(meshLion('final', req.cell, true), req.count, req.seed);
    scope.postMessage({ kind: 'samples', ...s } satisfies SculptMessage, [s.positions.buffer, s.normals.buffer, s.shade.buffer]);
  } catch (err) {
    scope.postMessage({ kind: 'error', message: String(err) } satisfies SculptMessage);
  }
};
