import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { atLeast, BILLBOARDS, TOWER_VARIANTS, type Quality, type Skybridge, type TowerSpec } from '../world/city';
import type { UniverseAssets } from './assets';
import { FACADE_TILE, PALETTE } from './textures';
import { buildTowerGeometry, FACADE_SLOTS, type Slot } from './towerGeometry';
import { towerSlotMaterial } from './towerMaterial';

/**
 * Cada torre desloca a textura da fachada por módulos e andares inteiros (a
 * partir da sua semente): duas torres da mesma família não têm as mesmas
 * janelas acesas, e os montantes continuam alinhados às aletas.
 */
function shiftUVs(geo: THREE.BufferGeometry, slot: Slot, seed: number) {
  const store = slot === 'storefront';
  const du = store ? ((seed % 8) * 2) / 16 : ((seed % 16) * FACADE_TILE.module) / FACADE_TILE.w;
  const dv = store ? 0 : (Math.floor(seed / 16) % 8) / 8;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv);
}

/**
 * Torres da cidade, estáticas: as torres de cada quadrante da cidade (4) são
 * juntadas numa malha por material, com as posições já aplicadas — até ~10
 * malhas por quadrante, e os quadrantes fora da visão (ou da área das
 * sombras) não são desenhados. Sete famílias arquitetônicas (`TOWER_VARIANTS`),
 * cada uma com seu sistema de fachada, detalhes e coroamento.
 */
export function Towers({ assets, quality, towers }: { assets: UniverseAssets; quality: Quality; towers: TowerSpec[] }) {
  // Detalhe por importância: o anel em volta da praça (a região de demonstração) tem aletas, varandas,
  // diagrid e marquises a partir da Média; o horizonte (fundo, visto de longe) só na Alta e na Ultra.
  const chunks = useMemo(() => {
    const detailFor = (t: TowerSpec) => (t.ring === 'midtown' ? quality !== 'low' : atLeast(quality, 'high'));
    const simple = TOWER_VARIANTS.map((v) => buildTowerGeometry(v, false));
    const detailed = quality === 'low' ? simple : TOWER_VARIANTS.map((v) => buildTowerGeometry(v, true));
    const out: Array<{ slot: Slot; geo: THREE.BufferGeometry }> = [];
    const m = new THREE.Matrix4();
    for (const qx of [-1, 1])
      for (const qz of [-1, 1]) {
        const inQuadrant = towers.filter((t) => Math.sign(t.x || 1) === qx && Math.sign(t.z || 1) === qz);
        const parts = new Map<Slot, THREE.BufferGeometry[]>();
        for (const t of inQuadrant) {
          m.makeRotationY(t.rotation).setPosition(t.x, 0.3, t.z);
          for (const [slot, geo] of (detailFor(t) ? detailed : simple)[t.variant]!) {
            const g = geo.clone().applyMatrix4(m);
            if (FACADE_SLOTS.has(slot)) shiftUVs(g, slot, t.seed);
            parts.set(slot, [...(parts.get(slot) ?? []), g]);
          }
        }
        for (const [slot, list] of parts) {
          const geo = mergeGeometries(list)!;
          geo.computeBoundingSphere();
          out.push({ slot, geo });
          list.forEach((g) => g.dispose());
        }
      }
    for (const set of new Set([simple, detailed])) set.forEach((map) => map.forEach((g) => g.dispose()));
    return out;
  }, [towers, quality]);
  useEffect(() => () => chunks.forEach((c) => c.geo.dispose()), [chunks]);
  // Estáticas: projetam e recebem sombra em todo nível (na Baixa e na Média, com o mapa em cache).
  const shadow = true;
  return (
    <>
      {chunks.map((c, i) => (
        <mesh
          key={i}
          geometry={c.geo}
          material={towerSlotMaterial(c.slot, assets)}
          castShadow={shadow && FACADE_SLOTS.has(c.slot)}
          receiveShadow={shadow && (FACADE_SLOTS.has(c.slot) || c.slot === 'matte')}
        />
      ))}
    </>
  );
}

/**
 * Passarelas envidraçadas entre torres (tubo de vidro com piso, teto e filetes
 * de luz): todas as passarelas numa malha por material — 3 chamadas de desenho
 * em vez de 5 por passarela.
 */
export function Skybridges({ assets, bridges }: { assets: UniverseAssets; bridges: Skybridge[] }) {
  const m = assets.materials;
  const geos = useMemo(() => {
    const steel: THREE.BufferGeometry[] = [];
    const glass: THREE.BufferGeometry[] = [];
    const glow: THREE.BufferGeometry[] = [];
    for (const b of bridges) {
      const len = Math.abs(b.b.x - b.a.x);
      const cx = (b.a.x + b.b.x) / 2;
      const y = b.y + 0.3;
      steel.push(new THREE.BoxGeometry(len, 0.3, b.width).translate(cx, y + 0.15, b.a.z), new THREE.BoxGeometry(len, 0.2, b.width + 0.2).translate(cx, y + 2.95, b.a.z));
      glass.push(new THREE.BoxGeometry(len, 2.6, b.width).translate(cx, y + 1.6, b.a.z));
      for (const s of [-1, 1]) glow.push(new THREE.BoxGeometry(len, 0.06, 0.06).translate(cx, y + 0.32, b.a.z + (s * b.width) / 2));
    }
    const merge = (list: THREE.BufferGeometry[]) => {
      const g = list.length ? mergeGeometries(list) : null;
      list.forEach((x) => x.dispose());
      return g;
    };
    return { steel: merge(steel), glass: merge(glass), glow: merge(glow) };
  }, [bridges]);
  useEffect(() => () => Object.values(geos).forEach((g) => g?.dispose()), [geos]);
  return (
    <>
      {geos.steel && <mesh geometry={geos.steel} material={m.steel} />}
      {geos.glass && <mesh geometry={geos.glass} material={m.glass} />}
      {geos.glow && <mesh geometry={geos.glow} material={m.glowBlue} />}
    </>
  );
}

/**
 * Telões de LED: alternam, a cada poucos segundos, os produtos reais do site
 * e a marca. Cada mensagem vira uma textura **uma vez**, no carregamento, e o
 * telão só troca qual textura mostra. Antes, a cada 5 s o canvas era
 * redesenhado e reenviado à placa de vídeo — enviar um canvas acelerado para o
 * WebGL obriga o navegador a lê-lo de volta da GPU: 50–80 ms de travada a cada
 * troca, bem visível na vista aérea (medido). Pilares e molduras: uma malha só.
 */
export function Billboards({ assets, messages, animate }: { assets: UniverseAssets; messages: Array<{ title: string; line: string }>; animate: boolean }) {
  const m = assets.materials;
  const gl = useThree((st) => st.gl);
  const list = useMemo(() => (messages.length ? messages : [{ title: '', line: '' }]), [messages]);
  const textures = useMemo(
    () =>
      list.map(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 292;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return { canvas, texture };
      }),
    [list],
  );
  useEffect(() => {
    let alive = true;
    const draw = () => {
      textures.forEach(({ canvas, texture }, k) => {
        const msg = list[k]!;
        const ctx = canvas.getContext('2d')!;
        const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        g.addColorStop(0, '#0b1730');
        g.addColorStop(1, '#14223a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = PALETTE.gold;
        ctx.fillRect(0, 0, canvas.width, 8);
        ctx.font = "500 22px 'Geist Mono Variable', ui-monospace, monospace";
        ctx.fillStyle = '#8f9aab';
        ctx.fillText('BEZALEL', 32, 56);
        ctx.font = "600 44px 'Geist Variable', system-ui, sans-serif";
        ctx.fillStyle = PALETTE.ivory;
        ctx.fillText(msg.title, 32, 140, canvas.width - 64);
        ctx.font = "400 26px 'Geist Variable', system-ui, sans-serif";
        ctx.fillStyle = '#c9ccd2';
        ctx.fillText(msg.line, 32, 196, canvas.width - 64);
        texture.needsUpdate = true;
        // Sobe já (ainda sob a tela de carregamento), não na primeira vez que a mensagem aparecer.
        gl.initTexture(texture);
      });
    };
    // Com as fontes do site prontas (o desenho sem elas sairia com a fonte do sistema).
    void (document.fonts?.ready ?? Promise.resolve()).then(() => alive && draw());
    return () => {
      alive = false;
      textures.forEach((t) => t.texture.dispose());
    };
  }, [textures, list, gl]);
  const screens = useMemo(() => BILLBOARDS.map((_, i) => new THREE.MeshBasicMaterial({ map: textures[i % textures.length]!.texture, toneMapped: false })), [textures]);
  useEffect(() => () => screens.forEach((s) => s.dispose()), [screens]);
  const frames = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const mtx = new THREE.Matrix4();
    for (const b of BILLBOARDS) {
      mtx.makeRotationY(b.facing).setPosition(b.x, 0.3, b.z);
      const pole = b.y - b.h / 2;
      parts.push(new THREE.BoxGeometry(1.4, pole, 1.4).translate(0, pole / 2, 0).applyMatrix4(mtx));
      parts.push(new THREE.BoxGeometry(b.w + 0.6, b.h + 0.6, 0.4).translate(0, b.y, -0.25).applyMatrix4(mtx));
    }
    const g = mergeGeometries(parts)!;
    parts.forEach((x) => x.dispose());
    return g;
  }, []);
  useEffect(() => () => frames.dispose(), [frames]);
  const shown = useRef(0);
  const clock = useRef(0);
  useFrame((_, dt) => {
    if (!animate) return;
    clock.current += Math.min(dt, 0.1);
    const k = Math.floor(clock.current / 5);
    if (k === shown.current) return;
    shown.current = k;
    screens.forEach((mat, i) => (mat.map = textures[(k + i) % textures.length]!.texture));
  });
  return (
    <>
      <mesh geometry={frames} material={m.steel} />
      {BILLBOARDS.map((b, i) => (
        <mesh key={i} position={[b.x, 0.3 + b.y, b.z]} rotation={[0, b.facing, 0]} material={screens[i]}>
          <planeGeometry args={[b.w, b.h]} />
        </mesh>
      ))}
    </>
  );
}
