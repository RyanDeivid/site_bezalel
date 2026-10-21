/// <reference lib="webworker" />
import { meshLion, silhouette, type MeshData } from './mesher';
import { buildLion } from './sdf';

/**
 * Esculpe o leão fora da thread principal, na ordem em que os estágios
 * aparecem: o contorno e a armação (instantâneos), o bloco de estudo, a
 * forma em argila e, por último, a escultura final com a oclusão por vértice.
 * Cada parte é enviada assim que fica pronta (os buffers são transferidos,
 * não copiados). Com `linesOnly`, só o contorno (o desenho que fica quando não
 * há 3D).
 */
export type SculptRequest = { finalCell: number; formCell: number; linesOnly?: boolean };

export type SculptMessage =
  | { kind: 'lines'; silhouette: Float32Array; bones: Float32Array }
  | ({ kind: 'mesh'; level: 'block' | 'form' | 'final' } & MeshData)
  | { kind: 'error'; message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (e: MessageEvent<SculptRequest>) => {
  try {
    const { finalCell, formCell, linesOnly } = e.data;
    const sil = silhouette();
    // Armação: a, b (pontos) e r (espessura) — 7 números por haste.
    const model = buildLion('form');
    const bones = new Float32Array(model.bones.length * 7);
    model.bones.forEach((b, i) => bones.set([...b.a, ...b.b, b.r], i * 7));
    scope.postMessage({ kind: 'lines', silhouette: sil, bones } satisfies SculptMessage, [sil.buffer, bones.buffer]);
    if (linesOnly) return;
    for (const [level, cell, ao] of [
      ['block', 0.045, false],
      ['form', formCell, true],
      ['final', finalCell, true],
    ] as const) {
      const m = meshLion(level, cell, ao);
      scope.postMessage({ kind: 'mesh', level, ...m } satisfies SculptMessage, [m.positions.buffer, m.normals.buffer, m.ao.buffer, m.indices.buffer]);
    }
  } catch (err) {
    scope.postMessage({ kind: 'error', message: String(err) } satisfies SculptMessage);
  }
};
