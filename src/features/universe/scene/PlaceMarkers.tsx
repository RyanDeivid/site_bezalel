import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { drawLabel, makeCanvasTexture } from '@/features/lab/scene/textures';
import type { PlaceId } from '../world/city';
import type { UniverseAssets } from './assets';
import { PALETTE } from './textures';

export interface MarkerPlace {
  id: PlaceId;
  x: number;
  z: number;
  /** Altura do heliponto (a praça é um pouco mais alta). */
  ground: number;
  name: string;
  /** O visitante está nele (ou os marcadores estão desligados): feixe, losango e nome somem. */
  active: boolean;
}

type PointerProps = { onClick: (e: ThreeEvent<MouseEvent>) => void; onPointerOver: (e: ThreeEvent<PointerEvent>) => void; onPointerOut: (e: ThreeEvent<PointerEvent>) => void };

const LABEL = { w: 640, h: 112, pad: 8, size: [7.2, 1.26] as const };
const BEAM_Y = 13;
const MARK_Y = 10.5;
const LABEL_Y = 13.4;

/**
 * Os marcadores de todos os locais com quatro chamadas de desenho no total (antes, quatro por local):
 * - os helipontos numa malha só;
 * - feixes e losangos em conjuntos instanciados;
 * - os nomes numa textura única (um nome por faixa), num plano instanciado que encara a câmera como o
 *   sprite fazia e sofre a mesma névoa.
 * Cada chamada a menos é tempo de processador poupado em todo quadro, e os marcadores são vistos de
 * qualquer ponto da cidade. O clique continua por local (colunas invisíveis, que não são desenhadas).
 */
export function PlaceMarkers({ places, assets, scale, effects, pointerFor, hitbox }: { places: MarkerPlace[]; assets: UniverseAssets; scale: number; effects: boolean; pointerFor: (id: PlaceId) => PointerProps; hitbox: THREE.BufferGeometry }) {
  const m = assets.materials;
  const n = places.length;
  const names = places.map((p) => p.name).join('|');

  const pads = useMemo(() => {
    const list = places.map((p) => new THREE.CircleGeometry(5, 48).rotateX(-Math.PI / 2).translate(p.x, p.ground, p.z));
    const g = mergeGeometries(list)!;
    list.forEach((x) => x.dispose());
    return g;
    // A posição dos locais é fixa; só o estado "ativo" muda (e ele não mexe nos helipontos).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  useEffect(() => () => pads.dispose(), [pads]);

  const parts = useMemo(() => {
    // Materiais próprios: usados em malhas instanciadas pedem outro shader, e dividir um material entre os
    // dois jeitos faz o three recompilar o programa a cada alternância.
    const gold = (m.gold as THREE.MeshStandardMaterial).clone();
    const beam = (m.beam as THREE.MeshBasicMaterial).clone();
    return { beamGeo: new THREE.CylinderGeometry(0.6, 0.6, 26, 16, 1, true), markGeo: new THREE.OctahedronGeometry(0.95, 0), labelGeo: new THREE.PlaneGeometry(1, 1), gold, beam };
  }, [m.gold, m.beam]);
  useEffect(
    () => () => {
      parts.beamGeo.dispose();
      parts.markGeo.dispose();
      parts.labelGeo.dispose();
      parts.gold.dispose();
      parts.beam.dispose();
    },
    [parts],
  );

  const label = useMemo(() => {
    const w = Math.round(LABEL.w * scale);
    const h = Math.round(LABEL.h * scale);
    const pad = Math.round(LABEL.pad * scale);
    const row = h + pad * 2;
    const { ctx, texture } = makeCanvasTexture(w, row * n);
    names.split('|').forEach((name, i) => {
      ctx.save();
      ctx.translate(0, i * row + pad);
      drawLabel(ctx, w, h, name, PALETTE.gold);
      ctx.restore();
    });
    texture.flipY = false;
    texture.needsUpdate = true;
    const material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, size: { value: new THREE.Vector2(...LABEL.size) }, rows: { value: n }, inset: { value: pad / row } }]),
      vertexShader: /* glsl */ `
        attribute float aRow;
        uniform vec2 size;
        uniform float rows;
        uniform float inset;
        varying vec2 vUv;
        #include <fog_pars_vertex>
        void main() {
          // Encara a câmera (como um sprite): o centro vem da instância, o retângulo é montado na tela.
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          mvPosition.xy += position.xy * size;
          // Faixa da textura com o nome deste local (sem a margem entre as faixas).
          vUv = vec2(uv.x, (aRow + inset + (1.0 - uv.y) * (1.0 - 2.0 * inset)) / rows);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        varying vec2 vUv;
        #include <fog_pars_fragment>
        void main() {
          gl_FragColor = texture2D(map, vUv);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    material.uniforms.map!.value = texture;
    return { texture, material };
  }, [names, n, scale]);
  useEffect(
    () => () => {
      label.texture.dispose();
      label.material.dispose();
    },
    [label],
  );
  const rowAttr = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(n), 1), [n]);
  useLayoutEffect(() => {
    parts.labelGeo.setAttribute('aRow', rowAttr);
  }, [parts, rowAttr]);

  const beams = useRef<THREE.InstancedMesh>(null);
  const marks = useRef<THREE.InstancedMesh>(null);
  const labels = useRef<THREE.InstancedMesh>(null);
  const t = useRef(0);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), up: new THREE.Vector3(0, 1, 0) }), []);
  const shown = useRef('');

  useFrame((_, dt) => {
    const b = beams.current;
    const k = marks.current;
    const l = labels.current;
    if (!b || !k || !l) return;
    // Quem aparece (os ativos somem): só reescreve feixes e nomes quando isso muda.
    const key = places.map((p) => (p.active ? '0' : '1')).join('');
    const changed = key !== shown.current;
    if (changed) {
      shown.current = key;
      let c = 0;
      places.forEach((p, i) => {
        if (p.active) return;
        b.setMatrixAt(c, tmp.m.makeTranslation(p.x, BEAM_Y, p.z));
        l.setMatrixAt(c, tmp.m.makeTranslation(p.x, LABEL_Y, p.z));
        rowAttr.setX(c, i);
        c++;
      });
      for (const mesh of [b, l]) {
        mesh.count = c;
        mesh.visible = c > 0;
        mesh.instanceMatrix.needsUpdate = true;
      }
      k.count = c;
      k.visible = c > 0;
      rowAttr.needsUpdate = true;
    }
    // Losangos girando e flutuando (cada um na sua fase); parados sem efeitos (e sem reenvio).
    if (!effects && !changed) return;
    if (effects) t.current += Math.min(dt, 0.05);
    let c = 0;
    places.forEach((p, i) => {
      if (p.active) return;
      const time = t.current + i;
      tmp.q.setFromAxisAngle(tmp.up, time * 0.8);
      tmp.p.set(p.x, MARK_Y + Math.sin(time * 1.6) * 0.3, p.z);
      k.setMatrixAt(c++, tmp.m.compose(tmp.p, tmp.q, tmp.s));
    });
    if (c) k.instanceMatrix.needsUpdate = true;
  });

  return (
    <group userData={{ dynamic: true }}>
      {/* Alvos do clique: uma coluna invisível por local, no lugar do heliponto, do feixe e do nome. */}
      {places.map((p) => (
        <mesh key={p.id} visible={false} position={[p.x, 7, p.z]} scale={[10, 14, 10]} geometry={hitbox} material={m.glowGold} {...pointerFor(p.id)} />
      ))}
      <mesh geometry={pads} material={m.pad} />
      {/* Feixes e nomes por último entre os transparentes (encostados um no outro, no mesmo eixo). */}
      <instancedMesh ref={beams} args={[parts.beamGeo, parts.beam, n]} count={0} frustumCulled={false} renderOrder={5} />
      <instancedMesh ref={marks} args={[parts.markGeo, parts.gold, n]} count={0} frustumCulled={false} />
      <instancedMesh ref={labels} args={[parts.labelGeo, label.material, n]} count={0} frustumCulled={false} renderOrder={5} />
    </group>
  );
}
