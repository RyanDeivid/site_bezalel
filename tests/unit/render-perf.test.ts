import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { installProgramSort } from '@/features/universe/scene/renderSort';
import { shareMatrices } from '@/features/universe/scene/sharedInstances';

describe('Universe: menos trabalho por quadro', () => {
  it('as peças de um conjunto passam a usar um só buffer de matrizes (uma escrita, um envio)', () => {
    const geo = new THREE.BoxGeometry();
    const mat = new THREE.MeshBasicMaterial();
    const parts = [new THREE.InstancedMesh(geo, mat, 8), null, new THREE.InstancedMesh(geo, mat, 8), new THREE.InstancedMesh(geo, mat, 8)];
    const lead = shareMatrices(parts)!;
    expect(lead).toBe(parts[0]);
    expect(parts[2]!.instanceMatrix).toBe(lead.instanceMatrix);
    expect(parts[3]!.instanceMatrix).toBe(lead.instanceMatrix);
    lead.setMatrixAt(3, new THREE.Matrix4().makeTranslation(1, 2, 3));
    const m = new THREE.Matrix4();
    parts[3]!.getMatrixAt(3, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).toArray()).toEqual([1, 2, 3]);
    // Idempotente, e não junta buffers de capacidades diferentes (pneus: 4 por carro).
    expect(shareMatrices(parts)).toBe(lead);
    const tires = new THREE.InstancedMesh(geo, mat, 32);
    shareMatrices([lead, tires]);
    expect(tires.instanceMatrix).not.toBe(lead.instanceMatrix);
    expect(shareMatrices([null, undefined])).toBeNull();
  });

  it('opacos agrupados por programa de shader, depois por material e profundidade', () => {
    let sort: ((a: unknown, b: unknown) => number) | null = null;
    const programs = new Map<THREE.Material, number>();
    const gl = { properties: { get: (m: THREE.Material) => ({ currentProgram: { id: programs.get(m) ?? 0 } }) }, setOpaqueSort: (f: typeof sort) => (sort = f) };
    installProgramSort(gl as unknown as THREE.WebGLRenderer);
    // Materiais de tipos alternados (ids crescentes): A e C usam o programa 2; B e D, o programa 1.
    const [a, b, c, d] = [new THREE.MeshStandardMaterial(), new THREE.MeshBasicMaterial(), new THREE.MeshStandardMaterial(), new THREE.MeshBasicMaterial()];
    programs.set(a, 2).set(b, 1).set(c, 2).set(d, 1);
    const item = (material: THREE.Material, z: number, renderOrder = 0, id = z) => ({ id, groupOrder: 0, renderOrder, material, z });
    const list = [item(a, 5), item(b, 4), item(c, 3), item(d, 2), item(a, 1), item(b, 9, 1)];
    list.sort(sort!);
    expect(list.map((i) => programs.get(i.material))).toEqual([1, 1, 2, 2, 2, 1]);
    // Dentro do mesmo material, mais perto primeiro; a ordem de desenho pedida continua mandando.
    expect(list.slice(2, 4).map((i) => i.z)).toEqual([1, 5]);
    expect(list.at(-1)!.renderOrder).toBe(1);
  });
});
