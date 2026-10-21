import * as THREE from 'three';
import { makeCanvasTexture } from '@/features/lab/scene/textures';

/**
 * Luzes "de mentira" que dão a noite de verdade, sem luzes dinâmicas (cada uma
 * custaria em todos os pixels): manchas somadas à imagem, num material sem
 * profundidade nem tons. Todas desenhadas em canvas.
 */

/** Facho dos faróis no asfalto: dois lóbulos que saem dos faróis, se abrem e se fundem, mais fortes perto do carro. */
export function headlightBeam() {
  const { ctx, texture } = makeCanvasTexture(64, 256);
  const img = ctx.createImageData(64, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 64; x++) {
      const along = 1 - y / 255; // 1 perto do carro (no alto da imagem), 0 no fim do facho
      const spread = 0.18 + (1 - along) * 0.32;
      const u = (x / 63) * 2 - 1;
      const lobe = (c: number) => Math.exp(-(((u - c) / spread) ** 2));
      const a = Math.min(1, lobe(-0.42 * along) + lobe(0.42 * along)) * along ** 1.3 * Math.min(1, (1 - along) * 10 + 0.35);
      const i = (y * 64 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * a);
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  texture.needsUpdate = true;
  // Plano no chão, em coordenadas do carro (frente em +z): do para-choque até ~13 m à frente. Deitado, o
  // alto da imagem (o lado forte) fica em −z, colado ao para-choque.
  const geometry = new THREE.PlaneGeometry(4.8, 13).rotateX(-Math.PI / 2).translate(0, 0.07, 2.2 + 6.5);
  const material = new THREE.MeshBasicMaterial({ map: texture, color: new THREE.Color(1, 0.93, 0.82).multiplyScalar(0.95), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  return { geometry, material, texture };
}

/** Holofote: cone aberto, mais forte na boca e sumindo ao longo do facho. */
export function searchlightBeam(length: number) {
  const { ctx, texture } = makeCanvasTexture(8, 256);
  const g = ctx.createLinearGradient(0, 256, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 256);
  texture.needsUpdate = true;
  const geometry = new THREE.CylinderGeometry(length * 0.035, 0.45, length, 20, 1, true).translate(0, length / 2, 0);
  const material = new THREE.MeshBasicMaterial({ map: texture, color: new THREE.Color(1, 0.86, 0.6).multiplyScalar(0.16), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false });
  return { geometry, material, texture };
}
