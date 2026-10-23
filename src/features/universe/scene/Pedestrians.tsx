import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Quality } from '../world/city';
import { createPedestrians, pedestrianPose } from '../world/pedestrians';
import type { UniverseRuntime } from '../world/runtime';
import { contactShadowGeometry, contactShadowMaterial } from './contactShadow';

/** Roupas: tons urbanos variados (casacos escuros, bege, marinho, vinho, branco, verde-oliva). */
const CLOTHES = ['#2c3340', '#c9b48f', '#1f2d4a', '#6e2c35', '#e6e2da', '#4c5a3c', '#3a3a3f', '#8a5a3a'].map((c) => new THREE.Color(c));

/**
 * Corpo de um pedestre (1,7 m), em peças marcadas por um número no vértice:
 * 0 tronco (cor da roupa), 1–2 pernas, 3–4 braços (roupa), 5 quadril e sapatos
 * (escuros), 6 cabeça (tom de pele). O andar é feito no shader: pernas e braços
 * giram em volta do quadril e do ombro, em oposição, e o corpo sobe e desce um
 * pouco — sem esqueleto e sem custo de CPU.
 */
function body() {
  const parts: Array<[THREE.BufferGeometry, number, THREE.Color]> = [];
  const pants = new THREE.Color('#25272d');
  const white = new THREE.Color('#ffffff');
  parts.push([new THREE.CylinderGeometry(0.19, 0.15, 0.62, 8).translate(0, 1.13, 0), 0, white]);
  parts.push([new THREE.CylinderGeometry(0.155, 0.15, 0.16, 8).translate(0, 0.83, 0), 5, pants]);
  parts.push([new THREE.SphereGeometry(0.115, 10, 8).translate(0, 1.6, 0), 6, white]);
  for (const [s, part] of [
    [-1, 1],
    [1, 2],
  ] as const) {
    parts.push([new THREE.CylinderGeometry(0.068, 0.055, 0.78, 6).translate(s * 0.085, 0.41, 0), part, pants]);
    parts.push([new THREE.BoxGeometry(0.1, 0.07, 0.24).translate(s * 0.085, 0.035, 0.05), part, new THREE.Color('#15161a')]);
  }
  for (const [s, part] of [
    [-1, 3],
    [1, 4],
  ] as const)
    parts.push([new THREE.CylinderGeometry(0.05, 0.042, 0.6, 6).translate(s * 0.245, 1.12, 0), part, white]);
  const list = parts.map(([g, part, color]) => {
    g.deleteAttribute('uv');
    const n = g.attributes.position!.count;
    g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(n).fill(part), 1));
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    return g.index ? g.toNonIndexed() : g;
  });
  const g = mergeGeometries(list)!;
  list.forEach((x) => x.dispose());
  return g;
}

/**
 * Pedestres da região principal (calçadas das quadras do centro e anéis da
 * praça), todos numa malha instanciada. Entram nas colisões como o trânsito:
 * o jogador não os atravessa. Param com "Pausar animações".
 */
export function Pedestrians({ quality, runtime, running, shadows = false }: { quality: Quality; runtime: UniverseRuntime; running: boolean; /** Projetam sombra no mapa (só com as sombras dinâmicas). */ shadows?: boolean }) {
  const specs = useMemo(() => createPedestrians(quality), [quality]);
  const geometry = useMemo(() => {
    const g = body();
    const n = specs.length;
    const tint = new Float32Array(n * 3);
    const phase = new Float32Array(n);
    const rate = new Float32Array(n);
    const skin = new Float32Array(n);
    specs.forEach((p, i) => {
      const c = CLOTHES[p.tint % CLOTHES.length]!;
      tint.set([c.r, c.g, c.b], i * 3);
      phase[i] = (p.start * 7.3) % (Math.PI * 2);
      // Cadência: ~1,8 passos por segundo a 1,3 m/s.
      rate[i] = p.speed * 4.4;
      skin[i] = p.skin;
    });
    g.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    g.setAttribute('aRate', new THREE.InstancedBufferAttribute(rate, 1));
    g.setAttribute('aSkin', new THREE.InstancedBufferAttribute(skin, 1));
    return g;
  }, [specs]);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, envMapIntensity: 0.5 });
    const uTime = { value: 0 };
    m.userData.uTime = uTime;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime;
      shader.vertexShader = `uniform float uTime;
attribute float aPart;
attribute vec3 aTint;
attribute float aPhase;
attribute float aRate;
attribute float aSkin;
${shader.vertexShader}`
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float swing = sin(uTime * aRate + aPhase);
          if (aPart > 0.5 && aPart < 2.5) {
            float a = swing * 0.42 * (aPart < 1.5 ? 1.0 : -1.0);
            vec3 q = transformed - vec3(0.0, 0.82, 0.0);
            transformed = vec3(q.x, q.y * cos(a) - q.z * sin(a), q.y * sin(a) + q.z * cos(a)) + vec3(0.0, 0.82, 0.0);
          } else if (aPart > 2.5 && aPart < 4.5) {
            float a = -swing * 0.32 * (aPart < 3.5 ? 1.0 : -1.0);
            vec3 q = transformed - vec3(0.0, 1.4, 0.0);
            transformed = vec3(q.x, q.y * cos(a) - q.z * sin(a), q.y * sin(a) + q.z * cos(a)) + vec3(0.0, 1.4, 0.0);
          }
          transformed.y += abs(swing) * 0.025;`,
        )
        .replace(
          '#include <color_vertex>',
          `#include <color_vertex>
          #ifdef USE_COLOR
          if (aPart < 0.5 || (aPart > 2.5 && aPart < 4.5)) vColor.rgb *= aTint;
          if (aPart > 5.5) vColor.rgb = mix(vec3(0.86, 0.66, 0.52), vec3(0.36, 0.23, 0.16), aSkin);
          #endif`,
        );
    };
    m.customProgramCacheKey = () => 'pedestrian';
    return m;
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  const mesh = useRef<THREE.InstancedMesh>(null);
  // Sombra de contato de cada pedestre (a mesma matriz: a escala pela altura vale para ela também).
  const contact = useRef<THREE.InstancedMesh>(null);
  const contactParts = useMemo(() => ({ geometry: contactShadowGeometry(0.42, 0.36, 0.006), material: contactShadowMaterial(quality === 'low' ? 0.6 : 0.42) }), [quality]);
  useEffect(
    () => () => {
      contactParts.geometry.dispose();
      contactParts.material.dispose();
    },
    [contactParts],
  );
  const clock = useRef(0);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);
  const bodies = useMemo(() => specs.map(() => ({ x: 0, z: 0, r: 0.32 })), [specs]);
  // Depois do trânsito (que zera a lista de corpos a cada quadro): entra nas colisões do jogador.
  useFrame((_, dt) => {
    if (running) clock.current += Math.min(dt, 0.1);
    const t = clock.current;
    (material.userData.uTime as { value: number }).value = t;
    const m = mesh.current;
    if (!m) return;
    specs.forEach((p, i) => {
      const pose = pedestrianPose(p, t);
      tmp.q.setFromAxisAngle(tmp.up, pose.heading);
      tmp.m.compose(tmp.p.set(pose.x, pose.y, pose.z), tmp.q, tmp.s.setScalar(p.height));
      m.setMatrixAt(i, tmp.m);
      contact.current?.setMatrixAt(i, tmp.m);
      const b = bodies[i]!;
      b.x = pose.x;
      b.z = pose.z;
      runtime.traffic.push(b);
    });
    m.instanceMatrix.needsUpdate = true;
    if (contact.current) contact.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={mesh} args={[geometry, material, specs.length]} frustumCulled={false} castShadow={shadows} />
      <instancedMesh ref={contact} args={[contactParts.geometry, contactParts.material, specs.length]} frustumCulled={false} renderOrder={6} />
    </>
  );
}
