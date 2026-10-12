import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { AgentId } from '@/types/domain';
import { constrainToFloor, INTERACT_DISTANCE, LAB_RADIUS, nearestStation, SECTOR_SIZE, STATIONS, type LabRuntime } from '../layout';

const SPEED = 6;
const PITCH_MIN = 0.38;
const PITCH_MAX = 1.25;
const DIST_MIN = 5;
const DIST_MAX = 34;

const FORWARD = new Set(['w', 'arrowup']);
const BACK = new Set(['s', 'arrowdown']);
const LEFT = new Set(['a', 'arrowleft']);
const RIGHT = new Set(['d', 'arrowright']);

interface PlayerProps {
  runtime: LabRuntime;
  inputEnabled: boolean;
  effects: boolean;
  onNearChange: (id: AgentId | null) => void;
}

/**
 * Visitante + câmera. Movimento relativo à câmera (W afasta-se dela),
 * clique no piso para caminhar até um ponto, arraste para girar, roda/pinça
 * para aproximar. Câmera com amortecimento exponencial: confortável e sem
 * trancos. Não usa pointer lock (funciona igual em mouse e toque).
 */
export function Player({ runtime, inputEnabled, effects, onNearChange }: PlayerProps) {
  const body = useRef<THREE.Group>(null);
  const marker = useRef<THREE.Mesh>(null);
  const markerMat = useRef<THREE.MeshBasicMaterial>(null);
  const arrow = useRef<THREE.Mesh>(null);
  const { camera, gl } = useThree();
  const velocity = useRef(new THREE.Vector2());
  const camState = useRef({ yaw: runtime.camera.yaw, pitch: runtime.camera.pitch, distance: runtime.camera.distance });
  const focus = useMemo(() => new THREE.Vector3(runtime.player.x, 1.2, runtime.player.z), [runtime]);
  const goal = useMemo(() => new THREE.Vector3(), []);
  const lastNear = useRef<AgentId | null>(null);
  const t = useRef(0);

  // Teclado
  useEffect(() => {
    const isFormField = (el: Element | null) => !!el?.closest('input, textarea, select, [contenteditable], dialog[open]');
    const down = (e: KeyboardEvent) => {
      if (!inputEnabled || isFormField(document.activeElement)) return;
      const k = e.key.toLowerCase();
      if (FORWARD.has(k) || BACK.has(k) || LEFT.has(k) || RIGHT.has(k)) {
        runtime.keys.add(k);
        runtime.target = null;
        if (k.startsWith('arrow')) e.preventDefault();
      }
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

  // Arraste para girar a câmera, roda e pinça para zoom.
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
        runtime.camera.yaw -= (e.clientX - prev.x) * 0.006;
        runtime.camera.pitch = THREE.MathUtils.clamp(runtime.camera.pitch + (e.clientY - prev.y) * 0.004, PITCH_MIN, PITCH_MAX);
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinchStart > 0) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        runtime.camera.distance = THREE.MathUtils.clamp(pinchDist * (pinchStart / Math.max(1, d)), DIST_MIN, DIST_MAX);
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = 0;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      runtime.camera.distance = THREE.MathUtils.clamp(runtime.camera.distance * Math.exp(e.deltaY * 0.0012), DIST_MIN, DIST_MAX);
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
    if (effects) t.current += dt;
    const keys = runtime.keys;
    let ix = 0;
    let iz = 0;
    if (inputEnabled) {
      for (const k of keys) {
        if (FORWARD.has(k)) iz += 1;
        if (BACK.has(k)) iz -= 1;
        if (LEFT.has(k)) ix -= 1;
        if (RIGHT.has(k)) ix += 1;
      }
      ix += runtime.joystick.x;
      iz += runtime.joystick.y;
    }
    const yaw = camState.current.yaw;
    // Frente = direção da câmera para o visitante, projetada no piso.
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    let dx = fx * iz + rx * ix;
    let dz = fz * iz + rz * ix;

    if (dx === 0 && dz === 0 && runtime.target && inputEnabled) {
      const tx = runtime.target.x - runtime.player.x;
      const tz = runtime.target.z - runtime.player.z;
      const d = Math.hypot(tx, tz);
      if (d < 0.25) runtime.target = null;
      else {
        dx = tx / d;
        dz = tz / d;
      }
    }
    const len = Math.hypot(dx, dz);
    if (len > 1) {
      dx /= len;
      dz /= len;
    }
    const k = 1 - Math.exp(-dt * 10);
    velocity.current.x += (dx * SPEED - velocity.current.x) * k;
    velocity.current.y += (dz * SPEED - velocity.current.y) * k;
    const next = constrainToFloor(runtime.player.x + velocity.current.x * dt, runtime.player.z + velocity.current.y * dt);
    runtime.player.x = next.x;
    runtime.player.z = next.z;
    const speed = velocity.current.length();
    if (speed > 0.2) {
      const targetHeading = Math.atan2(velocity.current.x, velocity.current.y);
      const diff = Math.atan2(Math.sin(targetHeading - runtime.player.heading), Math.cos(targetHeading - runtime.player.heading));
      runtime.player.heading += diff * Math.min(1, dt * 10);
    }

    if (body.current) {
      body.current.position.set(runtime.player.x, Math.sin(t.current * 3) * 0.05, runtime.player.z);
      body.current.rotation.y = runtime.player.heading;
      body.current.rotation.z = THREE.MathUtils.clamp(-velocity.current.x * 0.01, -0.08, 0.08);
    }
    if (arrow.current) arrow.current.position.y = 2.45 + Math.sin(t.current * 2.4) * 0.08;

    // Marcador de destino
    if (marker.current && markerMat.current) {
      if (runtime.target) {
        marker.current.position.set(runtime.target.x, 0.04, runtime.target.z);
        markerMat.current.opacity = 0.8;
        marker.current.scale.setScalar(1 + Math.sin(t.current * 6) * 0.08);
      } else markerMat.current.opacity = Math.max(0, markerMat.current.opacity - dt * 2);
    }

    // Câmera amortecida
    const cs = camState.current;
    const kr = 1 - Math.exp(-dt * 8);
    cs.yaw += (runtime.camera.yaw - cs.yaw) * kr;
    cs.pitch += (runtime.camera.pitch - cs.pitch) * kr;
    cs.distance += (runtime.camera.distance - cs.distance) * (1 - Math.exp(-dt * 6));
    focus.lerp(goal.set(runtime.player.x, 1.2, runtime.player.z), 1 - Math.exp(-dt * 7));
    // A câmera nunca sai do anel de pilares: encurta a distância horizontal se preciso.
    let hd = Math.cos(cs.pitch) * cs.distance;
    for (let i = 0; i < 24 && Math.hypot(focus.x + Math.sin(cs.yaw) * hd, focus.z + Math.cos(cs.yaw) * hd) > LAB_RADIUS - 0.8; i++) hd *= 0.9;
    const camX = focus.x + Math.sin(cs.yaw) * hd;
    const camZ = focus.z + Math.cos(cs.yaw) * hd;
    let camY = focus.y + Math.sin(cs.pitch) * cs.distance;
    // Sobre um pavilhão, a câmera sobe para não atravessar os monitores e o robô.
    const over = SECTOR_SIZE + 0.6;
    for (const s of STATIONS) {
      const d = Math.hypot(camX - s.x, camZ - s.z);
      if (d < over) camY = Math.max(camY, 4.8 + (over - d) * 0.5);
    }
    camera.position.set(camX, camY, camZ);
    camera.lookAt(focus);

    // Proximidade das estações
    const near = nearestStation(runtime.player.x, runtime.player.z);
    const nearId = near.distance < INTERACT_DISTANCE ? near.id : null;
    if (nearId !== lastNear.current) {
      lastNear.current = nearId;
      runtime.near = nearId;
      onNearChange(nearId);
    }
  });

  return (
    <>
      <group ref={body}>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.45, 32]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.85, 0]}>
          <capsuleGeometry args={[0.24, 0.5, 6, 14]} />
          <meshStandardMaterial color="#f2e8d5" metalness={0.3} roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.42, 0]}>
          <sphereGeometry args={[0.22, 20, 16]} />
          <meshStandardMaterial color="#f6f1e7" metalness={0.25} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.44, 0.17]}>
          <boxGeometry args={[0.3, 0.08, 0.08]} />
          <meshBasicMaterial color="#c7a86a" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.32, 0.03, 8, 32]} />
          <meshBasicMaterial color="#c7a86a" toneMapped={false} />
        </mesh>
        <mesh ref={arrow} position={[0, 2.45, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.13, 0.26, 4]} />
          <meshBasicMaterial color="#c7a86a" toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={marker} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.42, 32]} />
        <meshBasicMaterial ref={markerMat} color="#c7a86a" transparent opacity={0} toneMapped={false} depthWrite={false} />
      </mesh>
    </>
  );
}

/** Observa o FPS e avisa uma vez se o desempenho ficar baixo por alguns segundos. */
export function PerformanceWatch({ onLow }: { onLow: () => void }) {
  const acc = useRef({ frames: 0, time: 0, strikes: 0, fired: false });
  useFrame((_, dt) => {
    const a = acc.current;
    if (a.fired) return;
    a.frames += 1;
    a.time += dt;
    if (a.time >= 2.5) {
      const fps = a.frames / a.time;
      a.strikes = fps < 28 ? a.strikes + 1 : 0;
      a.frames = 0;
      a.time = 0;
      if (a.strikes >= 2) {
        a.fired = true;
        onLow();
      }
    }
  });
  return null;
}
