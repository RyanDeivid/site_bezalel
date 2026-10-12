import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * Pós-processamento do laboratório (chunk próprio, baixado só em aparelho
 * forte): cena → brilho (bloom em meia resolução, só no que passa do limiar:
 * telas, filetes, visores, núcleo da Central) → tom e espaço de cor.
 */
export function createBloom(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.38, 0.93);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {
    render: () => composer.render(),
    setSize(width: number, height: number) {
      composer.setSize(width, height);
      bloom.resolution.set(width / 2, height / 2);
    },
    dispose() {
      bloom.dispose();
      composer.dispose();
    },
  };
}

export type BloomComposer = ReturnType<typeof createBloom>;
