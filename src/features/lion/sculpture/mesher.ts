import { buildLion, primIndex, type Level, type LionModel } from './sdf';

/**
 * Transforma o campo de distância numa malha de triângulos por "surface nets":
 * um vértice por célula da grade que a superfície atravessa (na média dos
 * cruzamentos das arestas, depois puxado para a superfície por um passo de
 * Newton) e um quadrilátero por aresta cruzada. Dá superfícies lisas com bem
 * menos vértices que o marching cubes, e sem tabelas.
 *
 * Para ficar rápido, a grade é percorrida em blocos de 8³ células: um bloco
 * longe da superfície (pela distância no centro) nem é amostrado.
 */
export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  /** Oclusão do ambiente por vértice (1 = exposto, 0 = fundo de uma reentrância). */
  ao: Float32Array;
  indices: Uint32Array;
}

const BLOCK = 4;

export function meshLion(level: Level, cell: number, withAo: boolean, model: LionModel = buildLion(level)): MeshData {
  const { min, max } = model.bounds;
  const pad = cell * 2;
  const ox = min[0] - pad;
  // O chão (y = 0) cai no meio de uma camada de células: os vértices do corte ficam em y ≈ 0 (as patas tocam o
  // pedestal) em qualquer resolução.
  const oy = -2.5 * cell;
  const oz = min[2] - pad;
  const nx = Math.ceil((max[0] - min[0] + 2 * pad) / cell);
  const ny = Math.ceil((max[1] + pad) / cell) + 3;
  const nz = Math.ceil((max[2] - min[2] + 2 * pad) / cell);
  // Valores nos cantos: (nx+1)(ny+1)(nz+1).
  const sx = nx + 1;
  const sy = ny + 1;
  const sz = nz + 1;
  const field = new Float32Array(sx * sy * sz).fill(1);
  // Faixa de interesse: só importa o valor certo perto da superfície (para o sinal e o cruzamento das arestas).
  // A lista de um bloco vem da célula do índice que contém o centro dele (as grades não se alinham): a folga
  // cobre o bloco inteiro, senão peças perto dos cantos ficariam de fora.
  const index = primIndex(model, Math.max(0.08, BLOCK * cell), cell * 2 + BLOCK * cell * 0.9);
  // Primeiro uma grade 4× mais grossa; depois, só os blocos de 4³ células perto da superfície recebem os
  // valores finos. Um bloco cujos 8 cantos estão longe da superfície (mais que meia diagonal, com folga: a
  // distância do elipsoide é aproximada) não tem superfície dentro: herda o sinal.
  const cx = Math.ceil(nx / BLOCK);
  const cy = Math.ceil(ny / BLOCK);
  const cz = Math.ceil(nz / BLOCK);
  const coarse = new Float32Array((cx + 1) * (cy + 1) * (cz + 1));
  for (let i = 0; i <= cx; i++)
    for (let j = 0; j <= cy; j++)
      for (let k = 0; k <= cz; k++) coarse[(i * (cy + 1) + j) * (cz + 1) + k] = index.distance(ox + i * BLOCK * cell, oy + j * BLOCK * cell, oz + k * BLOCK * cell);
  const reach = ((BLOCK * cell * Math.sqrt(3)) / 2) * 1.35 + cell;
  for (let bi = 0; bi < cx; bi++)
    for (let bj = 0; bj < cy; bj++)
      for (let bk = 0; bk < cz; bk++) {
        let near = false;
        let neg = 0;
        for (let c = 0; c < 8; c++) {
          const v = coarse[((bi + (c & 1)) * (cy + 1) + bj + ((c >> 1) & 1)) * (cz + 1) + bk + ((c >> 2) & 1)]!;
          if (Math.abs(v) < reach) near = true;
          if (v < 0) neg++;
        }
        const i0 = bi * BLOCK;
        const j0 = bj * BLOCK;
        const k0 = bk * BLOCK;
        const i1 = Math.min(i0 + BLOCK, nx);
        const j1 = Math.min(j0 + BLOCK, ny);
        const k1 = Math.min(k0 + BLOCK, nz);
        if (!near) {
          if (neg >= 4) for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) field[(i * sy + j) * sz + k] = -1;
          continue;
        }
        const list = index.at(ox + (i0 + BLOCK / 2) * cell, oy + (j0 + BLOCK / 2) * cell, oz + (k0 + BLOCK / 2) * cell);
        for (let i = i0; i <= i1; i++)
          for (let j = j0; j <= j1; j++)
            for (let k = k0; k <= k1; k++) field[(i * sy + j) * sz + k] = index.with(list, ox + i * cell, oy + j * cell, oz + k * cell);
      }
  // O chão corta a escultura (as patas assentam no pedestal, sem a parte de baixo arredondada).
  for (let i = 0; i < sx; i++)
    for (let j = 0; j < sy; j++) {
      const y = oy + j * cell;
      if (y >= 0) continue;
      for (let k = 0; k < sz; k++) {
        const f = (i * sy + j) * sz + k;
        field[f] = Math.max(field[f]!, -y);
      }
    }

  // ---- Vértices: um por célula cruzada ----
  const cellIndex = new Int32Array(nx * ny * nz).fill(-1);
  const pos: number[] = [];
  const corner = new Float32Array(8);
  const EDGES = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [0, 2],
    [1, 3],
    [4, 6],
    [5, 7],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ] as const;
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++)
      for (let k = 0; k < nz; k++) {
        let inside = 0;
        for (let c = 0; c < 8; c++) {
          const v = field[((i + (c & 1)) * sy + (j + ((c >> 1) & 1))) * sz + (k + ((c >> 2) & 1))]!;
          corner[c] = v;
          if (v < 0) inside++;
        }
        if (inside === 0 || inside === 8) continue;
        let ax = 0;
        let ay = 0;
        let az = 0;
        let n = 0;
        for (const [a, b] of EDGES) {
          const va = corner[a]!;
          const vb = corner[b]!;
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          ax += (a & 1) + ((b & 1) - (a & 1)) * t;
          ay += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
          az += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t;
          n++;
        }
        cellIndex[(i * ny + j) * nz + k] = pos.length / 3;
        pos.push(ox + (i + ax / n) * cell, oy + (j + ay / n) * cell, oz + (k + az / n) * cell);
      }

  // ---- Faces: um quadrilátero por aresta da grade que a superfície cruza ----
  const idx: number[] = [];
  const cellAt = (i: number, j: number, k: number) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? -1 : cellIndex[(i * ny + j) * nz + k]!);
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c);
    else idx.push(a, b, c, a, c, d);
  };
  for (let i = 0; i < sx; i++)
    for (let j = 0; j < sy; j++)
      for (let k = 0; k < sz; k++) {
        const v0 = field[(i * sy + j) * sz + k]!;
        const inside = v0 < 0;
        if (i + 1 < sx && inside !== field[((i + 1) * sy + j) * sz + k]! < 0) quad(cellAt(i, j - 1, k - 1), cellAt(i, j, k - 1), cellAt(i, j, k), cellAt(i, j - 1, k), !inside);
        if (j + 1 < sy && inside !== field[(i * sy + j + 1) * sz + k]! < 0) quad(cellAt(i - 1, j, k - 1), cellAt(i - 1, j, k), cellAt(i, j, k), cellAt(i, j, k - 1), !inside);
        if (k + 1 < sz && inside !== field[(i * sy + j) * sz + k + 1]! < 0) quad(cellAt(i - 1, j - 1, k), cellAt(i, j - 1, k), cellAt(i, j, k), cellAt(i - 1, j, k), !inside);
      }

  // ---- Refino, normais e oclusão (pelo próprio campo) ----
  const count = pos.length / 3;
  const positions = new Float32Array(pos);
  const normals = new Float32Array(count * 3);
  const ao = new Float32Array(count).fill(1);
  // Para o refino e a oclusão, a faixa vai até onde a oclusão amostra (9 cm).
  const fine = primIndex(model, 0.08, withAo ? 0.08 : cell * 2);
  const e = cell * 0.35;
  for (let v = 0; v < count; v++) {
    let x = positions[v * 3]!;
    let y = positions[v * 3 + 1]!;
    let z = positions[v * 3 + 2]!;
    const list = fine.at(x, y, z);
    const D = (px: number, py: number, pz: number) => Math.max(fine.with(list, px, py, pz), -py);
    // Gradiente por diferenças à frente (a normal) e um passo de Newton até a superfície (no máximo meia célula).
    const d = D(x, y, z);
    const gx = D(x + e, y, z) - d;
    const gy = D(x, y + e, z) - d;
    const gz = D(x, y, z + e) - d;
    const gl = Math.hypot(gx, gy, gz) || 1;
    const step = Math.max(-cell * 0.5, Math.min(cell * 0.5, d));
    x -= (gx / gl) * step;
    y -= (gy / gl) * step;
    z -= (gz / gl) * step;
    positions[v * 3] = x;
    positions[v * 3 + 1] = y;
    positions[v * 3 + 2] = z;
    const n0 = gx / gl;
    const n1 = gy / gl;
    const n2 = gz / gl;
    normals[v * 3] = n0;
    normals[v * 3 + 1] = n1;
    normals[v * 3 + 2] = n2;
    if (withAo) {
      // Oclusão pelo campo (Quilez): o quanto a distância ao longo da normal fica abaixo do esperado.
      let occ = 0;
      let w = 1;
      for (let s = 1; s <= 4; s++) {
        const h = 0.02 * s;
        occ += (h - D(x + n0 * h, y + n1 * h, z + n2 * h)) * w;
        w *= 0.6;
      }
      ao[v] = Math.max(0, Math.min(1, 1 - occ * 12));
    }
  }
  // Cada triângulo de frente para fora (o mesmo lado do gradiente do campo).
  const indices = new Uint32Array(idx);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t]! * 3;
    const b = indices[t + 1]! * 3;
    const c = indices[t + 2]! * 3;
    const ux = positions[b]! - positions[a]!;
    const uy = positions[b + 1]! - positions[a + 1]!;
    const uz = positions[b + 2]! - positions[a + 2]!;
    const vx = positions[c]! - positions[a]!;
    const vy = positions[c + 1]! - positions[a + 1]!;
    const vz = positions[c + 2]! - positions[a + 2]!;
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    const nx = normals[a]! + normals[b]! + normals[c]!;
    const ny = normals[a + 1]! + normals[b + 1]! + normals[c + 1]!;
    const nz = normals[a + 2]! + normals[b + 2]! + normals[c + 2]!;
    if (cx * nx + cy * ny + cz * nz < 0) {
      const tmp = indices[t + 1]!;
      indices[t + 1] = indices[t + 2]!;
      indices[t + 2] = tmp;
    }
  }
  return { positions, normals, ao, indices };
}

/**
 * Contorno do leão visto de lado (projeção em z): o desenho do primeiro
 * estágio. Marching squares sobre o mínimo da distância ao longo de z;
 * devolve segmentos (x1, y1, x2, y2), na ordem da grade (de baixo para cima,
 * que é a ordem em que o traço é desenhado).
 */
export function silhouette(cell = 0.012): Float32Array {
  const model = buildLion('form');
  const index = primIndex(model, 0.1, cell * 2);
  const { min, max } = model.bounds;
  const ox = min[0] - cell * 2;
  const oy = -cell;
  const nx = Math.ceil((max[0] - min[0]) / cell) + 4;
  const ny = Math.ceil((max[1] + cell * 2) / cell) + 2;
  const zs: number[] = [];
  for (let z = min[2]; z <= max[2]; z += 0.04) zs.push(z);
  const f = new Float32Array((nx + 1) * (ny + 1));
  for (let i = 0; i <= nx; i++)
    for (let j = 0; j <= ny; j++) {
      const x = ox + i * cell;
      const y = oy + j * cell;
      let d = 1;
      for (const z of zs) {
        d = Math.min(d, index.distance(x, y, z));
        if (d < -cell) break;
      }
      f[i * (ny + 1) + j] = Math.max(d, -y);
    }
  const out: number[] = [];
  const P = (i: number, j: number) => f[i * (ny + 1) + j]!;
  const lerp = (a: number, b: number) => a / (a - b);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = P(i, j);
      const b = P(i + 1, j);
      const c = P(i + 1, j + 1);
      const d = P(i, j + 1);
      const pts: Array<[number, number]> = [];
      if (a < 0 !== b < 0) pts.push([i + lerp(a, b), j]);
      if (b < 0 !== c < 0) pts.push([i + 1, j + lerp(b, c)]);
      if (c < 0 !== d < 0) pts.push([i + 1 - lerp(c, d), j + 1]);
      if (d < 0 !== a < 0) pts.push([i, j + 1 - lerp(d, a)]);
      for (let s = 0; s + 1 < pts.length; s += 2) out.push(ox + pts[s]![0] * cell, oy + pts[s]![1] * cell, ox + pts[s + 1]![0] * cell, oy + pts[s + 1]![1] * cell);
    }
  return new Float32Array(out);
}
