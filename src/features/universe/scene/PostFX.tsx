import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { BloomPipeline, registerPost, type BloomSettings } from './bloom';

/**
 * Liga o brilho (bloom.ts) ao laço do React Three Fiber: com prioridade 1, o
 * R3F deixa de desenhar sozinho e o desenho passa por aqui (cena na textura
 * HDR → brilho → tela). Registrado antes do Warmup, que prepara os shaders
 * para o mesmo destino.
 */
export function PostFX({ strength, threshold, knee, levels, antialias, sharpen, multisample, scale = 1 }: BloomSettings & { /** O nível permite antisserrilhado por amostras (MSAA). */ multisample: boolean; /** Escala inicial da resolução dinâmica. */ scale?: number }) {
  const gl = useThree((s) => s.gl);
  const pipeline = useMemo(() => {
    const p = new BloomPipeline(gl, { strength, threshold, knee, levels, antialias, sharpen }, multisample);
    p.scale = scale;
    return p;
    // A escala inicial vale só na criação (depois a resolução adaptativa a ajusta).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, strength, threshold, knee, levels, antialias, sharpen, multisample]);
  useLayoutEffect(() => {
    registerPost(gl, pipeline);
    return () => {
      registerPost(gl, null);
      pipeline.dispose();
    };
  }, [gl, pipeline]);
  useFrame(({ scene, camera }) => pipeline.render(scene, camera), 1);
  return null;
}
