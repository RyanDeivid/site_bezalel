import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BILLBOARDS, TOWER_VARIANTS, type Quality, type Skybridge, type TowerSpec } from '../world/city';
import type { UniverseAssets } from './assets';
import { PALETTE } from './textures';
import { buildTowerGeometry, type Slot } from './towerGeometry';

function slotMaterial(slot: Slot, assets: UniverseAssets): THREE.Material {
  const m = assets.materials;
  switch (slot) {
    case 'concrete':
      return m.podiumDark;
    case 'facadeA':
      return m.facadeA;
    case 'facadeB':
      return m.facadeB;
    case 'facadeC':
      return m.facadeC;
    case 'darkGlass':
      return m.facadeDark;
    case 'frame':
      return m.steel;
    case 'slab':
      return m.stoneLight;
    case 'glow':
      return m.glowGoldSoft;
    case 'roofGlow':
      return m.glowBlue;
    case 'green':
      return m.foliage;
  }
}

const SHADOW_SLOTS = new Set<Slot>(['concrete', 'facadeA', 'facadeB', 'facadeC', 'darkGlass']);

/** Torres da cidade: uma InstancedMesh por (linguagem × material), todas estáticas. */
export function Towers({ assets, quality, towers }: { assets: UniverseAssets; quality: Quality; towers: TowerSpec[] }) {
  const detail = quality !== 'low';
  const groups = useMemo(
    () =>
      TOWER_VARIANTS.map((v, variant) => ({
        items: towers.filter((t) => t.variant === variant),
        geos: buildTowerGeometry(v, detail),
      })).filter((g) => g.items.length > 0),
    [towers, detail],
  );
  useEffect(() => () => groups.forEach((g) => g.geos.forEach((geo) => geo.dispose())), [groups]);
  return (
    <>
      {groups.flatMap((g, gi) => [...g.geos.entries()].map(([slot, geo]) => <TowerSlot key={`${gi}-${slot}`} geo={geo} material={slotMaterial(slot, assets)} items={g.items} shadow={quality === 'high' && SHADOW_SLOTS.has(slot)} />))}
    </>
  );
}

function TowerSlot({ geo, material, items, shadow }: { geo: THREE.BufferGeometry; material: THREE.Material; items: TowerSpec[]; shadow: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    items.forEach((t, i) => mesh.setMatrixAt(i, m.makeRotationY(t.rotation).setPosition(t.x, 0.3, t.z)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geo, material, items.length]} castShadow={shadow} receiveShadow={shadow} />;
}

/** Passarelas envidraçadas entre torres (tubo de vidro com piso e filetes de luz). */
export function Skybridges({ assets, bridges }: { assets: UniverseAssets; bridges: Skybridge[] }) {
  const m = assets.materials;
  return (
    <>
      {bridges.map((b, i) => {
        const len = Math.abs(b.b.x - b.a.x);
        const cx = (b.a.x + b.b.x) / 2;
        return (
          <group key={i} position={[cx, b.y + 0.3, b.a.z]}>
            <mesh material={m.steel} position={[0, 0.15, 0]}>
              <boxGeometry args={[len, 0.3, b.width]} />
            </mesh>
            <mesh material={m.glass} position={[0, 1.6, 0]}>
              <boxGeometry args={[len, 2.6, b.width]} />
            </mesh>
            <mesh material={m.steel} position={[0, 2.95, 0]}>
              <boxGeometry args={[len, 0.2, b.width + 0.2]} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} material={m.glowBlue} position={[0, 0.32, (s * b.width) / 2]}>
                <boxGeometry args={[len, 0.06, 0.06]} />
              </mesh>
            ))}
          </group>
        );
      })}
    </>
  );
}

/**
 * Telões de LED: alternam, a cada poucos segundos, os produtos reais do site
 * e a marca. A textura só é redesenhada quando a mensagem muda (não por quadro).
 */
export function Billboards({ assets, messages, animate }: { assets: UniverseAssets; messages: Array<{ title: string; line: string }>; animate: boolean }) {
  const m = assets.materials;
  const screens = useMemo(
    () =>
      BILLBOARDS.map(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 292;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return { canvas, texture, ctx: canvas.getContext('2d')! };
      }),
    [],
  );
  useEffect(() => () => screens.forEach((s) => s.texture.dispose()), [screens]);
  const shown = useRef(-1);
  const clock = useRef(0);
  const draw = (k: number) => {
    screens.forEach((s, i) => {
      const msg = messages[(k + i) % Math.max(1, messages.length)];
      const { ctx, canvas } = s;
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
      ctx.fillText(msg?.title ?? '', 32, 140, canvas.width - 64);
      ctx.font = "400 26px 'Geist Variable', system-ui, sans-serif";
      ctx.fillStyle = '#c9ccd2';
      ctx.fillText(msg?.line ?? '', 32, 196, canvas.width - 64);
      s.texture.needsUpdate = true;
    });
  };
  useFrame((_, dt) => {
    if (shown.current === -1) {
      shown.current = 0;
      draw(0);
    }
    if (!animate) return;
    clock.current += Math.min(dt, 0.1);
    const k = Math.floor(clock.current / 5);
    if (k !== shown.current) {
      shown.current = k;
      draw(k);
    }
  });
  return (
    <>
      {BILLBOARDS.map((b, i) => (
        <group key={i} position={[b.x, 0.3, b.z]} rotation={[0, b.facing, 0]}>
          <mesh material={m.steel} position={[0, (b.y - b.h / 2) / 2, 0]}>
            <boxGeometry args={[1.4, b.y - b.h / 2, 1.4]} />
          </mesh>
          <mesh material={m.steel} position={[0, b.y, -0.25]}>
            <boxGeometry args={[b.w + 0.6, b.h + 0.6, 0.4]} />
          </mesh>
          <mesh position={[0, b.y, 0]}>
            <planeGeometry args={[b.w, b.h]} />
            <meshBasicMaterial map={screens[i]!.texture} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}
