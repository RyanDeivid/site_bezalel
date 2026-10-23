import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { AgentId } from '@/types/domain';
import { VisitorBody, type VisitorFrame } from '@/features/universe/scene/VisitorBody';
import { stepMotion, VISITOR_CAMERA, WALK_SPEED } from '@/features/universe/world/visitor';
import { constrainToFloor, EXIT_DOOR, EXIT_REACH, INTERACT_DISTANCE, LAB_RADIUS, nearestStation, SECTOR_SIZE, STATIONS, type LabRuntime } from '../layout';

const CAM = VISITOR_CAMERA;
const FORWARD = new Set(['w', 'arrowup']);
const BACK = new Set(['s', 'arrowdown']);
const LEFT = new Set(['a', 'arrowleft']);
const RIGHT = new Set(['d', 'arrowright']);
const RUN = 'shift';

interface PlayerProps {
  runtime: LabRuntime;
  inputEnabled: boolean;
  effects: boolean;
  onNearChange: (id: AgentId | null) => void;
  /** Chegou ou saiu da porta do portal (saída para o Universe). */
  onNearExitChange?: (near: boolean) => void;
}

/**
 * Visitante + câmera, os mesmos do Universe: o robô explorador dourado, que acelera com peso, corre com Shift
 * (ou o botão de toque) e anda relativo à câmera; a câmera fica atrás do ombro, mira um pouco à frente dele e
 * segue amortecida, com as mesmas sensibilidades de arraste, roda e pinça. O que é só do laboratório: clique
 * no piso para caminhar até um ponto, o guia que o visitante acompanha, a câmera que não sai do anel de
 * pilares e sobe sobre os pavilhões. Não usa pointer lock (funciona igual em mouse e toque).
 */
export function Player({ runtime, inputEnabled, effects, onNearChange, onNearExitChange }: PlayerProps) {
  const marker = useRef<THREE.Mesh>(null);
  const markerMat = useRef<THREE.MeshBasicMaterial>(null);
  const { camera, gl } = useThree();
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const aim = useMemo(() => new THREE.Vector3(), []);
  const goal = useMemo(() => new THREE.Vector3(), []);
  const placed = useRef(false);
  const lastNear = useRef<AgentId | null>(null);
  const t = useRef(0);

  // Teclado
  useEffect(() => {
    const isFormField = (el: Element | null) => !!el?.closest('input, textarea, select, [contenteditable], dialog[open]');
    const down = (e: KeyboardEvent) => {
      if (!inputEnabled || isFormField(document.activeElement)) return;
      const k = e.key.toLowerCase();
      if (k === RUN) runtime.keys.add(k);
      else if (FORWARD.has(k) || BACK.has(k) || LEFT.has(k) || RIGHT.has(k)) {
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

  // Arraste para girar a câmera, roda e pinça para zoom (as sensibilidades do Universe).
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
        runtime.camera.yaw -= (e.clientX - prev.x) * CAM.drag.yaw;
        runtime.camera.pitch = THREE.MathUtils.clamp(runtime.camera.pitch + (e.clientY - prev.y) * CAM.drag.pitch, CAM.pitch.min, CAM.pitch.max);
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinchStart > 0) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        runtime.camera.distance = THREE.MathUtils.clamp(pinchDist * (pinchStart / Math.max(1, d)), CAM.distance.min, CAM.distance.max);
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = 0;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      runtime.camera.distance = THREE.MathUtils.clamp(runtime.camera.distance * Math.exp(e.deltaY * CAM.wheel), CAM.distance.min, CAM.distance.max);
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
    const p = runtime.player;
    let ix = 0;
    let iz = 0;
    if (inputEnabled) {
      for (const k of runtime.keys) {
        if (FORWARD.has(k)) iz += 1;
        if (BACK.has(k)) iz -= 1;
        if (LEFT.has(k)) ix -= 1;
        if (RIGHT.has(k)) ix += 1;
      }
      ix += runtime.joystick.x;
      iz += runtime.joystick.y;
    }
    const yaw = runtime.camera.yaw;
    // Frente = direção da câmera para o visitante, projetada no piso.
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    let dx = fx * iz + Math.cos(yaw) * ix;
    let dz = fz * iz - Math.sin(yaw) * ix;
    let run = inputEnabled && (runtime.keys.has(RUN) || runtime.run);

    // Com guia (tour / "seguir um curso"), o visitante anda logo atrás dele.
    const guide = runtime.guide;
    if (guide) {
      runtime.target = null;
      const gx = guide.x - Math.sin(guide.heading) * 1.6;
      const gz = guide.z - Math.cos(guide.heading) * 1.6;
      const d = Math.hypot(gx - p.x, gz - p.z);
      if (!effects) {
        // Movimento reduzido: cola no guia.
        const at = constrainToFloor(gx, gz);
        p.x = at.x;
        p.z = at.z;
        p.vx = 0;
        p.vz = 0;
        dx = 0;
        dz = 0;
      } else {
        // Acompanha no passo dele (e corre se ficou para trás).
        const k = d > 0.15 ? Math.min(1, d / 1.2) : 0;
        dx = d > 1e-3 ? ((gx - p.x) / d) * k : 0;
        dz = d > 1e-3 ? ((gz - p.z) / d) * k : 0;
        run = d > 3;
      }
    } else if (dx === 0 && dz === 0 && runtime.target && inputEnabled) {
      const tx = runtime.target.x - p.x;
      const tz = runtime.target.z - p.z;
      const d = Math.hypot(tx, tz);
      if (d < 0.25) runtime.target = null;
      else {
        // Desacelera ao chegar (sem passar do ponto).
        const k = Math.min(1, d / 1.2);
        dx = (tx / d) * k;
        dz = (tz / d) * k;
      }
    }
    stepMotion(p, { x: dx, z: dz, run }, dt, (q) => {
      const c = constrainToFloor(q.x, q.z);
      q.x = c.x;
      q.z = c.z;
    });

    // Marcador de destino
    if (marker.current && markerMat.current) {
      if (runtime.target) {
        marker.current.position.set(runtime.target.x, 0.04, runtime.target.z);
        markerMat.current.opacity = 0.8;
        marker.current.scale.setScalar(1 + Math.sin(t.current * 6) * 0.08);
      } else markerMat.current.opacity = Math.max(0, markerMat.current.opacity - dt * 2);
    }

    // Câmera do Universe: atrás do ombro, mirando um pouco à frente; amortecida.
    const { pitch, distance } = runtime.camera;
    let hd = Math.cos(pitch) * distance;
    // A câmera nunca sai do anel de pilares: encurta a distância horizontal se preciso.
    for (let i = 0; i < 24 && Math.hypot(p.x + Math.sin(yaw) * hd, p.z + Math.cos(yaw) * hd) > LAB_RADIUS - 0.8; i++) hd *= 0.9;
    const cx = p.x + Math.sin(yaw) * hd;
    const cz = p.z + Math.cos(yaw) * hd;
    let cy = CAM.eye + Math.sin(pitch) * distance;
    // Sobre um pavilhão, a câmera sobe para não atravessar os monitores e o robô.
    const over = SECTOR_SIZE + 0.6;
    for (const s of STATIONS) {
      const d = Math.hypot(cx - s.x, cz - s.z);
      if (d < over) cy = Math.max(cy, 4.8 + (over - d) * 0.5);
    }
    goal.set(cx, Math.max(cy, 0.8), cz);
    aim.set(p.x + fx * CAM.aim.ahead, CAM.aim.height, p.z + fz * CAM.aim.ahead);
    if (!placed.current) {
      placed.current = true;
      camPos.copy(goal);
      look.copy(aim);
    } else {
      camPos.lerp(goal, 1 - Math.exp(-dt * CAM.follow));
      look.lerp(aim, 1 - Math.exp(-dt * CAM.look));
    }
    camera.position.copy(camPos);
    camera.lookAt(look);

    // Proximidade das estações
    const near = nearestStation(p.x, p.z);
    const nearId = near.distance < INTERACT_DISTANCE ? near.id : null;
    const atExit = Math.hypot(p.x - EXIT_DOOR.x, p.z - EXIT_DOOR.z) < EXIT_REACH;
    if (atExit !== runtime.nearExit) {
      runtime.nearExit = atExit;
      onNearExitChange?.(atExit);
    }
    if (nearId !== lastNear.current) {
      lastNear.current = nearId;
      runtime.near = nearId;
      onNearChange(nearId);
    }
  });

  const frame = (_dt: number, out: VisitorFrame) => {
    const p = runtime.player;
    out.x = p.x;
    out.y = 0;
    out.z = p.z;
    out.heading = p.heading;
    out.scale = 1;
    out.walk = Math.min(1, Math.hypot(p.vx, p.vz) / WALK_SPEED);
    out.phase = p.stride;
  };

  return (
    <>
      <VisitorBody effects={effects} frame={frame} />
      <mesh ref={marker} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.42, 32]} />
        <meshBasicMaterial ref={markerMat} color="#c7a86a" transparent opacity={0} toneMapped={false} depthWrite={false} />
      </mesh>
    </>
  );
}
