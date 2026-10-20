import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { createEnvironmentAsync } from '@/components/three/environment';
import { MaterialSplitter } from './materialSplit';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Prepara a cena antes do primeiro quadro, para a entrada não travar.
 *
 * O canvas nasce com o laço de quadros parado (`frameloop="never"`). Aqui, com
 * a tela de carregamento por cima:
 *  1. o mapa de reflexos é gerado sem travar (`createEnvironmentAsync`): ele
 *     entra antes da compilação, porque muda os shaders de todos os materiais;
 *  2. materiais compartilhados entre usos incompatíveis ganham cópias
 *     (`MaterialSplitter`: sem isso o three recalcula o programa a cada uso,
 *     metade do custo de CPU do quadro);
 *  3. os shaders de todos os materiais são compilados com `compileAsync`
 *     (KHR_parallel_shader_compile: em paralelo, sem bloquear);
 *  4. cada programa recebe o seu "primeiro uso" (`getUniforms`), um por
 *     quadro: no Windows (ANGLE sobre Direct3D 11) a compilação de verdade só
 *     termina nesse momento;
 *  5. as texturas sobem para a placa de vídeo aos poucos;
 *  6. um quadro completo é desenhado escondido: sobe a geometria para a placa
 *     e compila o que só o quadro real usa (a passada de sombras). Desenhar uma
 *     parte por quadro foi testado e descartado: com partes escondidas o three
 *     cria outras variantes de shader (36 → 63 programas).
 * Só então o laço começa. Medido num Intel Iris Xe com o cache de shaders frio,
 * o primeiro quadro travava de 3 a 9 s antes deste preparo.
 */
export function Warmup({ envIntensity, envSize, onReady }: { envIntensity: number; envSize: number; onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const splitter = useMemo(() => new MaterialSplitter(), []);
  // Durante o jogo, confere de novo a cada ~2 s (um componente pode recriar uma malha com o material original).
  const since = useRef(0);
  useFrame((_, dt) => {
    since.current += dt;
    if (since.current < 2) return;
    since.current = 0;
    splitter.split(scene);
  });
  useEffect(() => {
    let cancelled = false;
    let env: THREE.Texture | null = null;
    void (async () => {
      // Deixa a tela de carregamento pintar antes de qualquer trabalho pesado.
      await nextFrame();
      try {
        env = await createEnvironmentAsync(gl, { size: envSize });
        if (cancelled) return;
        scene.environment = env;
        scene.environmentIntensity = envIntensity;
      } catch {
        // Sem reflexos o jogo funciona igual.
      }
      // Dá à placa de vídeo uns quadros para terminar o filtro do mapa: a compilação a seguir esperaria por ela
      // (e os dois trabalhos virariam uma trava só).
      for (let i = 0; i < 3; i++) await nextFrame();
      if (cancelled) return;
      splitter.split(scene);
      try {
        await gl.compileAsync(scene, camera);
      } catch {
        // Sem compileAsync: o primeiro quadro compila, como antes.
      }
      if (cancelled) return;
      for (const program of [...(gl.info.programs ?? [])]) {
        (program as unknown as { getUniforms: () => unknown }).getUniforms();
        await nextFrame();
        if (cancelled) return;
      }
      const textures = new Set<THREE.Texture>();
      scene.traverse((o) => {
        const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        for (const m of Array.isArray(mat) ? mat : mat ? [mat] : [])
          for (const v of Object.values(m)) if ((v as THREE.Texture | null)?.isTexture) textures.add(v as THREE.Texture);
      });
      let k = 0;
      for (const t of textures) {
        gl.initTexture(t);
        if (++k % 4 === 0) await nextFrame();
        if (cancelled) return;
      }
      gl.render(scene, camera);
      await nextFrame();
      if (cancelled) return;
      setFrameloop('always');
      onReady();
    })();
    return () => {
      cancelled = true;
      if (scene.environment === env) scene.environment = null;
      env?.dispose();
      splitter.dispose();
    };
    // Uma vez por canvas (trocar a qualidade recria o canvas e repete o preparo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
