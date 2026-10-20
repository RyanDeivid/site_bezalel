import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/** Direção do luar (de onde a luz vem), a mesma da fase 1. */
const FROM = new THREE.Vector3(-120, 170, 90).normalize();
const DISTANCE = 260;

/**
 * Luz principal (luar frio) com sombras que acompanham a câmera.
 *
 * Antes, o mapa de sombras cobria a cidade inteira (460 m em 2048 px: 22 cm por
 * texel, borrado) e redesenhava todas as torres a cada quadro. Agora ele cobre
 * só `range` metros em volta do ponto à frente da câmera — 2,5 a 3× mais nítido
 * com o mesmo tamanho de mapa — e o centro é "encaixado" na grade de texels do
 * espaço da luz, para as bordas das sombras não tremerem com o movimento.
 * `every` > 1 redesenha o mapa a cada N quadros (as sombras dos carros atrasam
 * um quadro; quase imperceptível e economiza a passada inteira).
 */
export function Sun({ mapSize, range, every }: { mapSize: number; range: number; every: number }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const gl = useThree((s) => s.gl);
  const tmp = useMemo(() => ({ center: new THREE.Vector3(), fwd: new THREE.Vector3(), rot: new THREE.Matrix4(), inv: new THREE.Matrix4(), p: new THREE.Vector3() }), []);
  const frame = useRef(0);
  const shadows = mapSize > 0;

  useLayoutEffect(() => {
    const l = light.current;
    if (!l) return;
    // Orientação fixa da luz (só a posição acompanha): base para encaixar na grade de texels.
    tmp.rot.lookAt(FROM, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
    tmp.inv.copy(tmp.rot).invert();
    l.target.position.set(0, 0, 0);
    l.position.copy(FROM).multiplyScalar(DISTANCE);
    if (shadows) {
      const cam = l.shadow.camera;
      cam.left = -range;
      cam.right = range;
      cam.top = range;
      cam.bottom = -range;
      cam.near = 10;
      cam.far = DISTANCE * 2;
      cam.updateProjectionMatrix();
    }
    gl.shadowMap.autoUpdate = every <= 1;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl, range, every, shadows, tmp]);

  useFrame(({ camera }) => {
    const l = light.current;
    if (!l || !shadows) return;
    // Centro: um pouco à frente da câmera (onde está o que se vê), no chão.
    camera.getWorldDirection(tmp.fwd);
    tmp.fwd.y = 0;
    if (tmp.fwd.lengthSq() < 1e-6) tmp.fwd.set(0, 0, -1);
    tmp.fwd.normalize();
    tmp.center.copy(camera.position).addScaledVector(tmp.fwd, range * 0.45);
    tmp.center.y = 0;
    // Encaixa o centro na grade de texels, no espaço da luz.
    const texel = (2 * range) / mapSize;
    tmp.p.copy(tmp.center).applyMatrix4(tmp.inv);
    tmp.p.x = Math.round(tmp.p.x / texel) * texel;
    tmp.p.y = Math.round(tmp.p.y / texel) * texel;
    tmp.p.applyMatrix4(tmp.rot);
    l.target.position.copy(tmp.p);
    l.target.updateMatrixWorld();
    l.position.copy(tmp.p).addScaledVector(FROM, DISTANCE);
    if (every > 1 && ++frame.current % every === 0) gl.shadowMap.needsUpdate = true;
  });

  return (
    <directionalLight
      ref={light}
      intensity={1.25}
      color="#cfd9ff"
      castShadow={shadows}
      shadow-mapSize={[mapSize || 512, mapSize || 512]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.04}
    >
      {/* O alvo precisa estar na cena para a matriz dele ser atualizada. */}
      <object3D attach="target" />
    </directionalLight>
  );
}
