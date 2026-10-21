import * as THREE from 'three';

/**
 * Sombra de contato: uma mancha escura e macia no chão, embaixo de carros,
 * do visitante e dos pedestres. É o que "assenta" um objeto no chão — sem ela,
 * na Baixa (que não tem mapa de sombras), tudo parece flutuar. Custa um plano
 * por objeto (instanciado: uma chamada de desenho por conjunto), sem luz nem
 * profundidade. Nas qualidades com sombras de verdade, ela faz o papel da
 * oclusão do ambiente, a penumbra que fica onde o objeto encosta no chão.
 */
let texture: THREE.CanvasTexture | null = null;

/** Retângulo de cantos redondos que se esvai para as bordas (o mesmo para tudo: o plano dá a proporção). */
function shadowTexture() {
  if (texture) return texture;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      // Distância a um retângulo arredondado no centro (0 dentro do miolo, 1 na borda da imagem).
      const u = Math.abs((x + 0.5) / size - 0.5) * 2;
      const v = Math.abs((y + 0.5) / size - 0.5) * 2;
      const du = Math.max(0, u - 0.45) / 0.55;
      const dv = Math.max(0, v - 0.45) / 0.55;
      const d = Math.min(1, Math.hypot(du, dv));
      const a = (1 - d) ** 2.2;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 0;
      img.data[i + 3] = Math.round(255 * a);
    }
  ctx.putImageData(img, 0, 0);
  texture = new THREE.CanvasTexture(c);
  return texture;
}

/** Material da sombra (escurece o chão; sem tone mapping, para o preto ser preto). */
export function contactShadowMaterial(opacity: number) {
  return new THREE.MeshBasicMaterial({ map: shadowTexture(), color: '#000000', transparent: true, opacity, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}

/** Plano deitado (largura × comprimento, em metros), logo acima do chão local. */
export function contactShadowGeometry(width: number, length: number, lift = 0.012) {
  return new THREE.PlaneGeometry(width, length).rotateX(-Math.PI / 2).translate(0, lift, 0);
}
