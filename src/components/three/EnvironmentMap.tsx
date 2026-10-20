import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * Reflexos PBR: um mapa de ambiente pré-filtrado (PMREM) gerado uma vez a
 * partir de uma sala de estúdio procedural — metais, vidros e vernizes
 * refletem algo coerente sem baixar imagens. Usado pelo laboratório e pelo
 * Universe.
 */
export function EnvironmentMap({ intensity, size = 256, blur = 0.04 }: { intensity: number; /** Lado do cubo (px): 128 custa ~4× menos para gerar. */ size?: number; blur?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, blur, 0.1, 100, { size }).texture;
    scene.environment = env;
    scene.environmentIntensity = intensity;
    room.dispose();
    pmrem.dispose();
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene, intensity, size, blur]);
  return null;
}

