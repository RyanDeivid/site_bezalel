import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { makeGlowTexture } from '@/features/lab/scene/textures';
import { PLACES, type PlaceId, type Solid } from '../world/city';
import { autopilotInput, stepCraft } from '../world/flight';
import { CAMERA_DISTANCE, CAMERA_PITCH, hasManualInput, isFlightKey, manualInput, type UniverseRuntime } from '../world/runtime';
import type { UniverseAssets } from './assets';

interface Props {
  runtime: UniverseRuntime;
  assets: UniverseAssets;
  solids: Solid[];
  inputEnabled: boolean;
  effects: boolean;
  onNearChange: (id: PlaceId | null) => void;
  onAutopilotEnd: () => void;
}

/** Quão alto o carro pode estar e ainda "chegar" a um local. */
const NEAR_ALTITUDE = 26;

const isTyping = (el: Element | null) => !!el?.closest('input, textarea, select, [contenteditable], dialog[open]');
/** Espaço e setas só viram comando de voo quando o foco não está num botão/link do HUD. */
const focusOnStage = () => {
  const el = document.activeElement;
  if (!el || el === document.body || el.tagName === 'CANVAS') return true;
  if (el.closest('button, a, input, select, textarea, [role="button"], [role="application"]')) return false;
  return !!el.closest('[data-universe-stage]');
};

/**
 * O carro voador do visitante e a câmera que o acompanha (terceira pessoa).
 * A câmera fica atrás do carro, amortecida; arrastar gira em volta dele, a
 * roda/pinça aproxima. Nunca entra num prédio: se o ponto desejado cair
 * dentro de um volume, ela sobe acima do telhado.
 */
export function Craft({ runtime, assets, solids, inputEnabled, effects, onNearChange, onAutopilotEnd }: Props) {
  const { camera, gl } = useThree();
  const car = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const glows = useRef<Array<THREE.Sprite | null>>([]);
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  const goal = useMemo(() => new THREE.Vector3(), []);
  const camInit = useRef(false);
  const lastNear = useRef<PlaceId | null>(null);
  const t = useRef(0);
  const prevSpeed = useRef(0);
  const glow = useMemo(() => makeGlowTexture('rgba(127,166,245,0.9)'), []);
  const shadowMat = useMemo(() => assets.materials.shadowBlob.clone(), [assets]);
  useEffect(
    () => () => {
      glow.dispose();
      shadowMat.dispose();
    },
    [glow, shadowMat],
  );

  // Teclado
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!inputEnabled || isTyping(document.activeElement)) return;
      const k = e.key.toLowerCase();
      if (!isFlightKey(k)) return;
      // Espaço e setas rolariam a página; só os capturamos fora de botões e links.
      if ((k === ' ' || k.startsWith('arrow')) && !focusOnStage()) return;
      if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
      runtime.keys.add(k);
    };
    const up = (e: KeyboardEvent) => runtime.keys.delete(e.key.toLowerCase());
    const blur = () => runtime.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      runtime.keys.clear();
    };
  }, [inputEnabled, runtime]);

  // Arraste gira a câmera em volta do carro; roda e pinça aproximam.
  useEffect(() => {
    const el = gl.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart = 0;
    let pinchDist = runtime.camera.distance;
    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        pinchDist = runtime.camera.distance;
      }
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      if (pointers.size === 1) {
        runtime.camera.orbit -= (e.clientX - prev.x) * 0.006;
        runtime.camera.pitch = THREE.MathUtils.clamp(runtime.camera.pitch + (e.clientY - prev.y) * 0.004, CAMERA_PITCH.min, CAMERA_PITCH.max);
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinchStart > 0) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        runtime.camera.distance = THREE.MathUtils.clamp(pinchDist * (pinchStart / Math.max(1, d)), CAMERA_DISTANCE.min, CAMERA_DISTANCE.max);
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = 0;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      runtime.camera.distance = THREE.MathUtils.clamp(runtime.camera.distance * Math.exp(e.deltaY * 0.0012), CAMERA_DISTANCE.min, CAMERA_DISTANCE.max);
    };
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [gl, runtime]);

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    t.current += effects ? dt : 0;
    const c = runtime.craft;

    // Comandos: manual (teclado/joystick/botões) tem prioridade e cancela o piloto automático.
    const manual = inputEnabled ? manualInput(runtime) : { throttle: 0, turn: 0, lift: 0, boost: false };
    let input = manual;
    if (runtime.autopilot) {
      if (hasManualInput(manual)) {
        runtime.autopilot = null;
        onAutopilotEnd();
      } else {
        const auto = autopilotInput(c, runtime.autopilot);
        if (auto) input = auto;
        else {
          runtime.autopilot = null;
          onAutopilotEnd();
        }
      }
    }
    stepCraft(c, input, dt, solids);
    // Ao pilotar, a câmera volta aos poucos para trás do carro.
    if (input.throttle !== 0 || input.turn !== 0) runtime.camera.orbit *= Math.exp(-dt * 1.2);

    // Carro: inclina nas curvas, empina ao acelerar, flutua de leve.
    const accel = (c.speed - prevSpeed.current) / Math.max(dt, 1e-3);
    prevSpeed.current = c.speed;
    if (car.current) {
      car.current.position.set(c.x, c.y + (effects ? Math.sin(t.current * 2.2) * 0.08 : 0), c.z);
      car.current.rotation.y = c.yaw;
    }
    if (body.current) {
      body.current.rotation.z = THREE.MathUtils.lerp(body.current.rotation.z, THREE.MathUtils.clamp(c.turnRate * 0.32, -0.4, 0.4), 1 - Math.exp(-dt * 6));
      body.current.rotation.x = THREE.MathUtils.lerp(body.current.rotation.x, THREE.MathUtils.clamp(-accel * 0.012 - c.climb * 0.02, -0.18, 0.18), 1 - Math.exp(-dt * 5));
    }
    // Sombra de contato no chão: ajuda a perceber a altura.
    if (shadow.current) {
      shadow.current.position.set(c.x, 0.45, c.z);
      const k = THREE.MathUtils.clamp(1 - c.y / 40, 0.15, 1);
      shadow.current.scale.setScalar(1.6 - k * 0.6);
      shadowMat.opacity = 0.45 * k;
    }
    const pulse = 0.85 + Math.abs(c.speed) / 60 + (effects ? Math.sin(t.current * 9) * 0.05 : 0);
    glows.current.forEach((g) => g?.scale.setScalar(1.3 * pulse));

    // Câmera de perseguição amortecida.
    const yaw = c.yaw + runtime.camera.orbit;
    const pitch = runtime.camera.pitch;
    const dist = runtime.camera.distance + Math.abs(c.speed) * 0.12;
    goal.set(c.x - Math.sin(yaw) * Math.cos(pitch) * dist, c.y + 1.5 + Math.sin(pitch) * dist, c.z - Math.cos(yaw) * Math.cos(pitch) * dist);
    for (const s of solids) if (goal.x > s.minX - 1 && goal.x < s.maxX + 1 && goal.z > s.minZ - 1 && goal.z < s.maxZ + 1 && goal.y < s.height + 1.5) goal.y = s.height + 1.5;
    goal.y = Math.max(goal.y, 1.2);
    if (!camInit.current) {
      camPos.copy(goal);
      camInit.current = true;
    } else camPos.lerp(goal, 1 - Math.exp(-dt * 5));
    lookAt.lerp(goal.set(c.x + Math.sin(c.yaw) * 4, c.y + 1, c.z + Math.cos(c.yaw) * 4), 1 - Math.exp(-dt * 8));
    camera.position.copy(camPos);
    camera.lookAt(lookAt);

    // Proximidade dos locais.
    let near: PlaceId | null = null;
    let best = Infinity;
    if (c.y < NEAR_ALTITUDE)
      for (const p of PLACES) {
        const d = Math.hypot(p.pad.x - c.x, p.pad.z - c.z);
        if (d < p.reach && d < best) {
          best = d;
          near = p.id;
        }
      }
    if (near !== lastNear.current) {
      lastNear.current = near;
      runtime.near = near;
      onNearChange(near);
    }
  });

  const m = assets.materials;
  const pods: Array<[number, number]> = [
    [-1.25, 1.25],
    [1.25, 1.25],
    [-1.25, -1.35],
    [1.25, -1.35],
  ];
  return (
    <>
      <group ref={car}>
        <group ref={body}>
          {/* Casco perolado, cabine de vidro escuro, friso dourado */}
          <mesh material={m.pearl} scale={[1.2, 0.34, 2.55]} castShadow>
            <sphereGeometry args={[1, 32, 16]} />
          </mesh>
          <mesh material={m.darkGlass} position={[0, 0.22, 0.45]} scale={[0.66, 0.3, 1.25]}>
            <sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          {/* Aletas traseiras com ponta dourada */}
          {[-0.62, 0.62].map((x) => (
            <group key={x} position={[x, 0.32, -1.85]} rotation={[0.35, 0, x > 0 ? -0.25 : 0.25]}>
              <mesh material={m.pearl}>
                <boxGeometry args={[0.08, 0.55, 0.7]} />
              </mesh>
              <mesh material={m.glowGold} position={[0, 0.28, -0.05]}>
                <boxGeometry args={[0.09, 0.05, 0.62]} />
              </mesh>
            </group>
          ))}
          <group position={[0, 0.02, 0]} scale={[1.22, 1, 2.57]}>
            <mesh material={m.gold} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[1, 0.025, 6, 48]} />
            </mesh>
          </group>
          {/* Faróis e lanterna */}
          <mesh material={m.glowIvory} position={[0, 0.04, 2.5]}>
            <boxGeometry args={[0.9, 0.07, 0.06]} />
          </mesh>
          <mesh material={m.glowBrake} position={[0, 0.1, -2.5]}>
            <boxGeometry args={[1.3, 0.08, 0.06]} />
          </mesh>
          {/* Quatro propulsores com brilho por baixo */}
          {pods.map(([x, z], i) => (
            <group key={i} position={[x, -0.22, z]}>
              <mesh material={m.steelLight} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.42, 0.42, 0.85, 16]} />
              </mesh>
              <mesh material={m.glowBlue} position={[0, -0.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.34, 0.05, 6, 20]} />
              </mesh>
              <sprite ref={(s) => (glows.current[i] = s)} position={[0, -0.45, 0]}>
                <spriteMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
              </sprite>
            </group>
          ))}
        </group>
      </group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} material={shadowMat}>
        <circleGeometry args={[2.2, 32]} />
      </mesh>
    </>
  );
}
