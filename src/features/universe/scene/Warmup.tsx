import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createEnvironmentAsync } from '@/components/three/environment';
import { MaterialSplitter } from './materialSplit';
import { ShadowDepth } from './shadowDepth';
import { disposeScene, nightCityEnvironment } from './nightEnvironment';
import { postFor } from './bloom';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Desenha a cena inteira uma vez (atrás da tela de carregamento): liga o que está escondido, desliga o
 * descarte por enquadramento (também o da passada de sombras) e dá uma instância aos conjuntos vazios.
 * Depois devolve tudo como estava.
 */
function drawEverything(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, post: ReturnType<typeof postFor>) {
  const restore: Array<() => void> = [];
  scene.traverse((o) => {
    if (!o.visible) {
      o.visible = true;
      restore.push(() => (o.visible = false));
    }
    if (o.frustumCulled) {
      o.frustumCulled = false;
      restore.push(() => (o.frustumCulled = true));
    }
    const im = o as THREE.InstancedMesh;
    if (im.isInstancedMesh && im.count === 0) {
      im.count = 1;
      restore.push(() => (im.count = 0));
    }
  });
  // Num alvo minúsculo do mesmo tipo do destino real (HDR com o brilho): os shaders saem iguais aos do
  // jogo, a geometria sobe toda, e quase não há pixels a pintar — sem placa de vídeo (CI, aparelhos
  // muito fracos), desenhar a cidade inteira na tela cheia travaria a página por segundos.
  const tiny = post
    ? new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace, depthBuffer: true })
    : null;
  const before = gl.getRenderTarget();
  try {
    gl.shadowMap.needsUpdate = true;
    gl.setRenderTarget(tiny);
    gl.render(scene, camera);
  } finally {
    gl.setRenderTarget(before);
    tiny?.dispose();
    restore.forEach((f) => f());
  }
}

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
 *  6. um quadro com a cidade **inteira** é desenhado escondido: tudo visível,
 *     sem descartar o que está fora da câmera (nem da área das sombras), os
 *     níveis de detalhe escondidos e os conjuntos instanciados vazios também.
 *     Assim sobe toda a geometria para a placa e compila o que só o quadro
 *     real usa (as variantes da passada de sombras). Antes, só ia o que estava
 *     na frente da câmera inicial: o resto subia na primeira vez que aparecia,
 *     em pleno jogo — travadas de 50 a 90 ms ao virar para a Sede ou subir para
 *     a vista aérea (medido no modo apresentação). Desenhar uma parte por
 *     quadro foi testado e descartado: com partes escondidas o three cria
 *     outras variantes de shader (36 → 63 programas);
 *  7. um quadro normal, escondido, para fechar.
 * Só então o laço começa. Medido num Intel Iris Xe com o cache de shaders frio,
 * o primeiro quadro travava de 3 a 9 s antes deste preparo.
 */
export function Warmup({ envIntensity, envSize, onReady }: { envIntensity: number; envSize: number; onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const splitter = useMemo(() => new MaterialSplitter(), []);
  const shadowDepth = useMemo(() => new ShadowDepth(), []);
  // Durante o jogo, confere de novo a cada ~2 s (um componente pode recriar uma malha com o material original).
  const since = useRef(0);
  useFrame((_, dt) => {
    since.current += dt;
    if (since.current < 2) return;
    since.current = 0;
    splitter.split(scene);
    shadowDepth.apply(scene);
  });
  useEffect(() => {
    let cancelled = false;
    let env: THREE.Texture | null = null;
    void (async () => {
      // Deixa a tela de carregamento pintar antes de qualquer trabalho pesado.
      await nextFrame();
      try {
        // Reflexos da própria noite da cidade (não um estúdio de luz).
        const night = nightCityEnvironment();
        env = await createEnvironmentAsync(gl, { size: envSize, blur: 0.02, scene: night });
        disposeScene(night);
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
      shadowDepth.apply(scene);
      // Com brilho, a cena é desenhada numa textura HDR (sem tone mapping, cor linear): o three gera
      // shaders diferentes para esse destino. Compila para o destino real, e as passadas do brilho também.
      const post = postFor(gl);
      try {
        if (post) {
          const passes = new THREE.Scene();
          post.materials().forEach((m) => passes.add(new THREE.Mesh(new THREE.PlaneGeometry(), m)));
          gl.setRenderTarget(post.target);
          const sceneReady = gl.compileAsync(scene, camera);
          const passesReady = gl.compileAsync(passes, camera);
          gl.setRenderTarget(null);
          await Promise.all([sceneReady, passesReady]);
          passes.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
        } else await gl.compileAsync(scene, camera);
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
      drawEverything(gl, scene, camera, post);
      await nextFrame();
      // Os programas que só o quadro inteiro criou (sombras) também recebem o primeiro uso agora.
      for (const program of [...(gl.info.programs ?? [])]) (program as unknown as { getUniforms: () => unknown }).getUniforms();
      if (cancelled) return;
      if (post) post.render(scene, camera);
      else gl.render(scene, camera);
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
      shadowDepth.dispose();
    };
    // Uma vez por canvas (trocar a qualidade recria o canvas e repete o preparo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
