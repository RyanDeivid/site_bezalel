import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { insideSolid, PLACES, type PlaceId, type Solid } from '../world/city';
import { cinemaPose } from '../world/cinema';
import { autopilotInput, stepCraft } from '../world/flight';
import { carInterior, HOVER_SCALE, hoverInterior } from './interior';
import {
  CAMERA_DISTANCE,
  CAMERA_PITCH,
  driveInput,
  hasManualInput,
  isControlKey,
  manualInput,
  nearestVehicle,
  axes,
  updatePlayer,
  vehicleBodies,
  vehicleById,
  vehiclePose,
  type UniverseRuntime,
} from '../world/runtime';
import { CAR_SPECS, forwardOf, rightOf, stepCar, stopInput, type Body } from '../world/vehicles';
import { advance, capturePoses, renderVehicle, renderWalker, type Pose } from '../world/simulation';
import { stepWalker } from '../world/walker';

interface Props {
  runtime: UniverseRuntime;
  solids: Solid[];
  inputEnabled: boolean;
  /** Movimento reduzido: sem mudança de campo de visão nem tremor de batida. */
  calmCamera: boolean;
  onNearChange: (id: PlaceId | null) => void;
  onNearVehicleChange: (id: string | null) => void;
  onAutopilotEnd: () => void;
  /** Botão "A" do controle (mesma ação da tecla E). */
  onInteract: () => void;
}

/** Até que altura o carro voador ainda "chega" a um local. */
const NEAR_ALTITUDE = 26;

const isTyping = (el: Element | null) => !!el?.closest('input, textarea, select, [contenteditable], dialog[open]');
/**
 * Setas e Espaço viram comando do jogo quando o foco está no palco. Depois de
 * clicar num botão do HUD (tela cheia, entrar, locais…) o foco fica nele: as
 * setas continuam indo para o jogo (nenhum botão do HUD as usa), mas o Espaço
 * fica com o botão, que é como ele se aciona pelo teclado. Fora do palco (menu
 * do site, campos), nada é capturado.
 */
const keyForGame = (k: string) => {
  const el = document.activeElement;
  if (!el || el === document.body || el.tagName === 'CANVAS') return true;
  if (!el.closest('[data-universe-stage]')) return false;
  return k !== ' ' || !el.closest('button, a, [role="button"], [role="radio"]');
};

/** Controle (gamepad) no padrão dos consoles: analógico esquerdo, gatilhos RT/LT, A = interagir, B = freio de mão. */
function readGamepad() {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads?.find((p) => p && p.connected);
  if (!gp) return null;
  const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
  return {
    lx: dz(gp.axes[0] ?? 0),
    ly: dz(gp.axes[1] ?? 0),
    rx: dz(gp.axes[2] ?? 0),
    ry: dz(gp.axes[3] ?? 0),
    rt: gp.buttons[7]?.value ?? 0,
    lt: gp.buttons[6]?.value ?? 0,
    a: !!gp.buttons[0]?.pressed,
    b: !!gp.buttons[1]?.pressed,
    lb: !!gp.buttons[4]?.pressed,
    rb: !!gp.buttons[5]?.pressed,
  };
}

/**
 * O jogador em todos os modos: lê teclado, mouse/toque e controle; anda,
 * dirige ou voa; e move a câmera.
 *
 * Câmera (uma só, com metas por modo — a troca de modo é um deslize suave
 * entre metas, nunca um corte):
 *  - a pé: orbita o personagem; quem anda segue a direção da câmera;
 *  - dirigindo: atrás do carro, com atraso de mola na direção; afasta e abre o
 *    campo de visão com a velocidade (sensação de velocidade sem exagero);
 *  - voando: como na fase 1.
 * Nunca atravessa prédios: se o caminho até o ponto desejado cruza um volume,
 * ela se aproxima do jogador.
 */
export function PlayerController({ runtime, solids, inputEnabled, calmCamera, onNearChange, onNearVehicleChange, onAutopilotEnd, onInteract }: Props) {
  const { camera, gl } = useThree();
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const goal = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const aim = useMemo(() => new THREE.Vector3(), []);
  const init = useRef(false);
  const chaseYaw = useRef(runtime.camera.yaw);
  const lastMode = useRef(runtime.mode);
  const lastNear = useRef<PlaceId | null>(null);
  const lastNearVehicle = useRef<string | null>(null);
  const shake = useRef(0);
  const padA = useRef(false);
  const bodies = useMemo<Body[]>(() => [], []);
  const persp = camera as THREE.PerspectiveCamera;

  // Teclado
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!inputEnabled || isTyping(document.activeElement)) return;
      const k = e.key.toLowerCase();
      if (!isControlKey(k)) return;
      if ((k === ' ' || k.startsWith('arrow')) && !keyForGame(k)) return;
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

  // Arrastar olha em volta; roda e pinça aproximam.
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
        const dx = (e.clientX - prev.x) * 0.006;
        if (runtime.mode === 'foot') runtime.camera.yaw -= dx;
        else runtime.camera.orbit -= dx;
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

  const poseA = useMemo<Pose>(() => ({ x: 0, y: 0, z: 0, heading: 0 }), []);
  const poseW = useMemo<Pose>(() => ({ x: 0, y: 0, z: 0, heading: 0 }), []);
  useFrame((_, rawDt) => {
    // Tempo do quadro: suaviza a câmera (a física usa o passo fixo, abaixo).
    const dt = Math.min(0.05, rawDt);
    const rt = runtime;
    const gp = inputEnabled ? readGamepad() : null;
    if (gp) {
      // Botão A: borda de subida = uma interação.
      if (gp.a && !padA.current) onInteract();
      padA.current = gp.a;
      if (gp.rx) {
        if (rt.mode === 'foot') rt.camera.yaw -= gp.rx * dt * 2.4;
        else rt.camera.orbit -= gp.rx * dt * 2.4;
      }
      if (gp.ry) rt.camera.pitch = THREE.MathUtils.clamp(rt.camera.pitch + gp.ry * dt * 1.6, CAMERA_PITCH.min, CAMERA_PITCH.max);
    }

    // Distância de câmera adequada a cada modo, ao trocar de modo.
    if (rt.mode !== lastMode.current) {
      const v = vehicleById(rt, rt.active);
      if (rt.mode === 'driving' && v) {
        rt.camera.distance = v.kind === 'car' ? 8.6 : 15;
        rt.camera.pitch = v.kind === 'car' ? 0.17 : 0.32;
        chaseYaw.current = vehiclePose(v).heading;
      }
      if (rt.mode === 'foot' && lastMode.current === 'exiting') {
        rt.camera.distance = CAMERA_DISTANCE.start;
        rt.camera.pitch = CAMERA_PITCH.start;
      }
      lastMode.current = rt.mode;
    }

    // Física em passo fixo (SIM_STEP), separada do quadro; o desenho lê a pose interpolada.
    const simulate = (dt: number) => {
      const forced = updatePlayer(rt, dt, solids);
      const active = vehicleById(rt, rt.active);

      // Corpos com que o jogador colide: os outros veículos e o trânsito.
      bodies.length = 0;
      for (const v of rt.vehicles) if (v !== active) bodies.push(...vehicleBodies(v));
      bodies.push(...rt.traffic);

      if (rt.mode === 'foot') {
        const a = inputEnabled ? axes(rt) : { forward: 0, side: 0, lift: 0, run: false, space: false };
        const fwd = Math.max(-1, Math.min(1, a.forward + (gp ? -gp.ly : 0)));
        const side = Math.max(-1, Math.min(1, a.side + (gp ? gp.lx : 0)));
        const f = forwardOf(rt.camera.yaw);
        const r = rightOf(rt.camera.yaw);
        stepWalker(rt.walker, { x: f.x * fwd + r.x * side, z: f.z * fwd + r.z * side, run: a.run || !!gp?.rb }, dt, solids, bodies);
      } else if (rt.mode === 'driving' && active?.kind === 'car') {
        let input = inputEnabled ? driveInput(rt) : { throttle: 0, brake: 0, steer: 0, handbrake: false };
        if (gp) {
          input.throttle = Math.max(input.throttle, gp.rt);
          input.brake = Math.max(input.brake, gp.lt);
          input.steer = Math.max(-1, Math.min(1, input.steer + gp.lx));
          input.handbrake = input.handbrake || gp.b;
        }
        if (forced?.brake) input = stopInput(active.car);
        const impact = stepCar(active.car, CAR_SPECS[active.cls], input, dt, solids, bodies);
        if (impact > 6 && !calmCamera) shake.current = Math.min(0.6, impact * 0.03);
      } else if (rt.mode === 'driving' && active?.kind === 'hover') {
        const c = active.craft;
        const manual = inputEnabled ? manualInput(rt) : { throttle: 0, turn: 0, lift: 0, boost: false };
        if (gp) {
          manual.throttle = Math.max(-1, Math.min(1, manual.throttle + gp.rt - gp.lt));
          manual.turn = Math.max(-1, Math.min(1, manual.turn + gp.lx));
          manual.lift = Math.max(-1, Math.min(1, manual.lift + (gp.rb ? 1 : 0) - (gp.lb ? 1 : 0)));
        }
        let input = manual;
        if (forced) input = { throttle: 0, turn: 0, lift: forced.descend ? -1 : 0, boost: false };
        else if (rt.autopilot) {
          if (hasManualInput(manual)) {
            rt.autopilot = null;
            onAutopilotEnd();
          } else {
            const auto = autopilotInput(c, rt.autopilot);
            if (auto) input = auto;
            else {
              rt.autopilot = null;
              onAutopilotEnd();
            }
          }
        }
        stepCraft(c, input, dt, solids);
      }
    };
    advance(rt.clock, rawDt, (step) => {
      capturePoses(rt);
      simulate(step);
    });
    const active = vehicleById(rt, rt.active);

    // ---- Câmera ---------------------------------------------------------------------
    // Primeira pessoa: os olhos do motorista dentro da cabine; arrastar olha em volta (o olhar volta
    // para a frente sozinho com o veículo andando). Sem amortecimento de posição: ela anda com o veículo.
    if (rt.camera.view === 'first' && rt.mode === 'driving' && active && !rt.cinema && !rt.shot) {
      const p = renderVehicle(active, rt.clock, poseA);
      const speed = active.kind === 'car' ? active.car.speed : active.craft.speed;
      if (Math.abs(speed) > 2) rt.camera.orbit *= Math.exp(-dt * 0.9);
      rt.camera.orbit = THREE.MathUtils.clamp(rt.camera.orbit, -2.3, 2.3);
      const head = active.kind === 'car' ? carInterior(active.cls).head : hoverInterior().head;
      const k = active.kind === 'car' ? 1 : HOVER_SCALE;
      const f = forwardOf(p.heading);
      const r = rightOf(p.heading);
      // No carro, +x local é a esquerda (lado do motorista): no mundo, o oposto de `rightOf`.
      const x = p.x - r.x * head[0] * k + f.x * head[2] * k;
      const z = p.z - r.z * head[0] * k + f.z * head[2] * k;
      const y = p.y + head[1] * k;
      const yaw = p.heading + rt.camera.orbit;
      // Olhar levemente para baixo (o painel e a rua à frente); arrastar para cima/baixo inclina a partir daí.
      const base = active.kind === 'car' ? 0.17 : 0.32;
      // Quanto cada cabine olha para baixo de saída: o táxi é alto, o esportivo é baixo.
      const down = active.kind === 'hover' ? 0.22 : active.cls === 'taxi' ? 0.22 : active.cls === 'sport' ? 0.05 : 0.08;
      const tilt = THREE.MathUtils.clamp((base - rt.camera.pitch) * 0.9 - down, -0.75, 0.45);
      camera.position.set(x, y, z);
      camera.lookAt(x + Math.sin(yaw) * Math.cos(tilt), y + Math.sin(tilt), z + Math.cos(yaw) * Math.cos(tilt));
      camPos.copy(camera.position);
      look.set(x + Math.sin(yaw), y, z + Math.cos(yaw));
      const fpFov = active.kind === 'car' ? 70 + Math.min(10, Math.abs(speed) * 0.25) : 72;
      if (Math.abs(persp.fov - fpFov) > 0.05) {
        persp.fov += (fpFov - persp.fov) * (1 - Math.exp(-dt * 4));
        persp.updateProjectionMatrix();
      }
    } else {
      const pitch = rt.camera.pitch;
      let fov = 55;
      if ((rt.mode === 'driving' || rt.mode === 'entering' || rt.mode === 'exiting') && active) {
        const p = renderVehicle(active, rt.clock, poseA);
        const speed = active.kind === 'car' ? active.car.speed : active.craft.speed;
        const desired = p.heading + rt.camera.orbit;
        chaseYaw.current += Math.atan2(Math.sin(desired - chaseYaw.current), Math.cos(desired - chaseYaw.current)) * (1 - Math.exp(-dt * (active.kind === 'car' ? 3.2 : 4)));
        // Ao pilotar, o giro manual da câmera volta aos poucos para trás do veículo.
        if (Math.abs(speed) > 2) rt.camera.orbit *= Math.exp(-dt * 0.9);
        const dist = rt.camera.distance + Math.abs(speed) * (active.kind === 'car' ? 0.05 : 0.12);
        const lift = active.kind === 'car' ? 1.3 : 1.5;
        target.set(p.x, p.y + lift, p.z);
        goal.set(p.x - Math.sin(chaseYaw.current) * Math.cos(pitch) * dist, p.y + lift + Math.sin(pitch) * dist, p.z - Math.cos(chaseYaw.current) * Math.cos(pitch) * dist);
        const f = forwardOf(p.heading);
        look.lerp(aim.set(p.x + f.x * 4, p.y + lift, p.z + f.z * 4), 1 - Math.exp(-dt * 8));
        if (!calmCamera && active.kind === 'car') fov = 56 + Math.min(16, Math.abs(speed) * 0.4);
      } else {
        const w = renderWalker(rt, rt.clock, poseW);
        const dist = rt.camera.distance;
        target.set(w.x, w.y + 1.55, w.z);
        goal.set(w.x - Math.sin(rt.camera.yaw) * Math.cos(pitch) * dist, w.y + 1.55 + Math.sin(pitch) * dist, w.z - Math.cos(rt.camera.yaw) * Math.cos(pitch) * dist);
        const f = forwardOf(rt.camera.yaw);
        look.lerp(aim.set(w.x + f.x * 1.2, w.y + 1.45, w.z + f.z * 1.2), 1 - Math.exp(-dt * 10));
      }
      // Não atravessa prédios: percorre do jogador até o ponto desejado e para antes do primeiro volume.
      const steps = 12;
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        const x = target.x + (goal.x - target.x) * k;
        const y = target.y + (goal.y - target.y) * k;
        const z = target.z + (goal.z - target.z) * k;
        if (insideSolid(x, z, y, 0.35, solids)) {
          const back = Math.max(0, (i - 1) / steps - 0.02);
          goal.set(target.x + (goal.x - target.x) * back, target.y + (goal.y - target.y) * back, target.z + (goal.z - target.z) * back);
          break;
        }
      }
      goal.y = Math.max(goal.y, 0.8);
      if (!init.current) {
        camPos.copy(goal);
        look.copy(target);
        init.current = true;
      } else camPos.lerp(goal, 1 - Math.exp(-dt * (rt.mode === 'foot' ? 7 : 6)));
      camera.position.copy(camPos);
      if (rt.cinema) {
        // Modo apresentação: as tomadas de cinema da região principal (o jogador fica parado onde estava).
        const c = rt.cinema;
        if (!c.hold) c.t += Math.min(dt, 0.1);
        const s = cinemaPose(c.t, calmCamera);
        c.fade = s.fade;
        c.shot = s.shot;
        camera.position.set(s.x, s.y, s.z);
        camera.lookAt(s.tx, s.ty, s.tz);
        if (Math.abs(persp.fov - s.fov) > 0.05) {
          persp.fov = s.fov;
          persp.updateProjectionMatrix();
        }
      } else if (rt.shot) {
        // Vista fixa (apresentação / capturas): ignora a câmera do jogo.
        const s = rt.shot;
        camera.position.set(s.x, s.y, s.z);
        camera.lookAt(s.tx, s.ty, s.tz);
        if (s.fov && Math.abs(persp.fov - s.fov) > 0.05) {
          persp.fov = s.fov;
          persp.updateProjectionMatrix();
        }
      } else {
        if (shake.current > 0.001) {
          camera.position.x += (Math.random() - 0.5) * shake.current;
          camera.position.y += (Math.random() - 0.5) * shake.current;
          shake.current *= Math.exp(-dt * 8);
        }
        camera.lookAt(look);
        if (Math.abs(persp.fov - fov) > 0.05) {
          persp.fov += (fov - persp.fov) * (1 - Math.exp(-dt * 3));
          persp.updateProjectionMatrix();
        }
      }
    }

    // ---- Proximidade: locais e veículos -----------------------------------------------
    let px = rt.walker.x;
    let pz = rt.walker.z;
    let py = 0;
    if (rt.mode !== 'foot' && active) {
      const p = vehiclePose(active);
      px = p.x;
      pz = p.z;
      py = p.y;
    }
    let near: PlaceId | null = null;
    let best = Infinity;
    if (py < NEAR_ALTITUDE && rt.mode !== 'entering' && rt.mode !== 'exiting')
      for (const p of PLACES) {
        const d = Math.hypot(p.pad.x - px, p.pad.z - pz);
        if (d < p.reach && d < best) {
          best = d;
          near = p.id;
        }
      }
    if (near !== lastNear.current) {
      lastNear.current = near;
      rt.near = near;
      onNearChange(near);
    }
    const nv = rt.mode === 'foot' ? (nearestVehicle(rt)?.id ?? null) : null;
    if (nv !== lastNearVehicle.current) {
      lastNearVehicle.current = nv;
      rt.nearVehicle = nv;
      onNearVehicleChange(nv);
    }
    // Antes dos veículos (prioridade −1): a física e a câmera andam primeiro, e o carro é desenhado já na
    // posição nova — senão, em primeira pessoa, os olhos ficavam um quadro à frente do carro (dentro do painel).
  }, -1);

  return null;
}
