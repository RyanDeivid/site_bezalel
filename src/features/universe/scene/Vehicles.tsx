import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeGlowTexture } from '@/features/lab/scene/textures';
import type { PlayerVehicle, UniverseRuntime } from '../world/runtime';
import { CAR_SPECS, type CarClass } from '../world/vehicles';
import type { UniverseAssets } from './assets';
import { buildAirModel, type AirSlot } from './airModels';
import { carInterior, dashboardScreen, HOVER_SCALE, hoverInterior, paintCenter, paintCluster, type Interior } from './interior';
import type { CarMaterials, CarModel, CarSlot, FarCarModel } from './carModels';

interface Props {
  runtime: UniverseRuntime;
  models: Record<CarClass, CarModel>;
  /** Nível intermediário (o mesmo do trânsito de perto). */
  midModels: Record<CarClass, CarModel>;
  farModels: Record<CarClass, FarCarModel>;
  materials: CarMaterials;
  assets: UniverseAssets;
  effects: boolean;
  /** Até que distância da câmera (m) o carro estacionado usa um modelo com rodas e peças (completo até NEAR_CAR). */
  lodDistance: number;
  /** Facho dos faróis no asfalto, aceso no carro em uso (da Média para cima). */
  beam?: { geometry: THREE.BufferGeometry; material: THREE.Material } | null;
}

/** Até esta distância da câmera (m), o carro estacionado usa o modelo completo; depois, o intermediário. */
const NEAR_CAR = 18;

/** Veículos que o jogador pode usar: os carros (com volante e suspensão visíveis) e o carro voador. */
export function PlayerVehicles({ runtime, models, midModels, farModels, materials, assets, effects, lodDistance, beam }: Props) {
  return (
    <>
      {runtime.vehicles.map((v) =>
        v.kind === 'car' ? (
          <PlayerCar key={v.id} runtime={runtime} vehicle={v} model={models[v.cls]} mid={midModels[v.cls]} far={farModels[v.cls]} materials={materials} lodDistance={lodDistance} beam={beam ?? null} />
        ) : (
          <HoverCar key={v.id} runtime={runtime} vehicle={v} assets={assets} effects={effects} />
        ),
      )}
    </>
  );
}

/** Materiais do interior (um conjunto para todos os veículos do jogador). */
function useInteriorMaterials() {
  const mats = useMemo(
    () => ({
      // As paredes por dentro: a carroceria pelo avesso, num acabamento escuro e fosco.
      shell: new THREE.MeshStandardMaterial({ color: '#17191e', roughness: 0.9, metalness: 0, side: THREE.BackSide }),
      leather: new THREE.MeshStandardMaterial({ color: '#2d2622', roughness: 0.62, metalness: 0 }),
      trim: new THREE.MeshStandardMaterial({ color: '#23262c', roughness: 0.45, metalness: 0.35, envMapIntensity: 0.8 }),
      wheel: new THREE.MeshStandardMaterial({ color: '#15161a', roughness: 0.55, metalness: 0.2 }),
      glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return mats;
}

/**
 * Cabine vista de dentro: bancos, painel, volante que gira com o esterço e as
 * duas telas — o quadro de instrumentos (velocidade, marcha, bateria ou
 * altitude) e a tela central (hora e a "navegação" da cidade). Só aparece em
 * primeira pessoa, no veículo em uso; as telas só são redesenhadas quando o
 * valor mostrado muda.
 */
function Cockpit({
  interior,
  shell,
  visible,
  read,
}: {
  interior: Interior;
  /** Peças da carroceria que viram as paredes por dentro. */
  shell: THREE.BufferGeometry[];
  /** Mostra a cabine agora? (lido a cada quadro) */
  visible: () => boolean;
  /** O que o quadro mostra: km/h, máximo, marcha, extra, esterço. */
  read: () => { kmh: number; max: number; gear: string; extra: { label: string; value: string; share: number }; steer: number };
}) {
  const mats = useInteriorMaterials();
  const group = useRef<THREE.Group>(null);
  const wheel = useRef<THREE.Group>(null);
  const screens = useMemo(() => ({ cluster: dashboardScreen(512, 192), center: dashboardScreen(256, 160) }), []);
  const screenMats = useMemo(
    () => ({ cluster: new THREE.MeshBasicMaterial({ map: screens.cluster.texture, toneMapped: false }), center: new THREE.MeshBasicMaterial({ map: screens.center.texture, toneMapped: false }) }),
    [screens],
  );
  useEffect(
    () => () => {
      screens.cluster.texture.dispose();
      screens.center.texture.dispose();
      screenMats.cluster.dispose();
      screenMats.center.dispose();
    },
    [screens, screenMats],
  );
  const since = useRef(1);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    g.visible = visible();
    if (!g.visible) return;
    const r = read();
    if (wheel.current) wheel.current.rotation.z = -r.steer * 2.4;
    // Telas: no máximo 10 atualizações por segundo (cada uma é um canvas enviado à placa de vídeo).
    since.current += dt;
    if (since.current < 0.1) return;
    since.current = 0;
    screens.cluster.draw(`${Math.round(r.kmh)}|${r.gear}|${r.extra.value}`, (ctx, w, h) => paintCluster(ctx, w, h, r.kmh, r.max, r.gear, r.extra));
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    screens.center.draw(time, (ctx, w, h) => paintCenter(ctx, w, h, time, 'BEZALEL · UNIVERSE'));
  });
  const { wheelAt, cluster, screen } = interior;
  return (
    <group ref={group} visible={false}>
      {shell.map((geo, i) => (
        <mesh key={i} geometry={geo} material={mats.shell} />
      ))}
      <mesh geometry={interior.leather} material={mats.leather} />
      <mesh geometry={interior.trim} material={mats.trim} />
      <mesh geometry={interior.glow} material={mats.glow} />
      <group position={wheelAt.position} rotation={[wheelAt.tilt, 0, 0]}>
        <group ref={wheel}>
          <mesh geometry={interior.wheel} material={mats.wheel} />
        </group>
      </group>
      {[
        [cluster, screenMats.cluster],
        [screen, screenMats.center],
      ].map(([at, mat], i) => {
        const a = at as Interior['cluster'];
        return (
          <group key={i} position={a.position} rotation={[a.tilt, 0, 0]}>
            <mesh rotation={[0, Math.PI, 0]} material={mat as THREE.Material}>
              <planeGeometry args={a.size} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/**
 * Carro do jogador. Perto da câmera (ou sendo dirigido), o modelo detalhado com
 * volante, suspensão e lanterna de freio; longe, a versão de 3 malhas (de ~20
 * chamadas de desenho, contando as sombras, para 3).
 */
const BRAKE_ON = new THREE.Color('#ff5a3a').multiplyScalar(3.6);
const BRAKE_OFF = new THREE.Color('#d8452a').multiplyScalar(1.7);

function PlayerCar({
  runtime,
  vehicle,
  model,
  mid,
  far,
  materials,
  lodDistance,
  beam,
}: {
  runtime: UniverseRuntime;
  beam: { geometry: THREE.BufferGeometry; material: THREE.Material } | null;
  vehicle: Extract<PlayerVehicle, { kind: 'car' }>;
  model: CarModel;
  mid: CarModel;
  far: FarCarModel;
  materials: CarMaterials;
  lodDistance: number;
}) {
  const spec = CAR_SPECS[vehicle.cls];
  const root = useRef<THREE.Group>(null);
  const detailed = useRef<THREE.Group>(null);
  const simple = useRef<THREE.Group>(null);
  const lit = useRef<THREE.Mesh>(null);
  const near = useRef(true);
  const full = useRef(true);
  // Peças dos dois níveis com rodas (completo e intermediário): só um dos dois fica visível.
  const fullParts = useRef<Array<THREE.Object3D | null>>([]);
  const midParts = useRef<Array<THREE.Object3D | null>>([]);
  const body = useRef<THREE.Group>(null);
  // Rodas: um conjunto instanciado de pneus e um de aros (4 cada) por nível — 2 chamadas de desenho em vez de 8.
  const tires = useRef<Array<THREE.InstancedMesh | null>>([]);
  const rims = useRef<Array<THREE.InstancedMesh | null>>([]);
  const wheelTmp = useMemo(() => ({ m: new THREE.Matrix4(), r: new THREE.Matrix4() }), []);
  // Pintura e lanternas próprias (cor do carro; lanternas mais fortes ao frear).
  const own = useMemo(() => {
    const paint = materials.paint.clone();
    (paint as THREE.MeshStandardMaterial).color.set(vehicle.paint);
    const tail = (materials.tail as THREE.MeshBasicMaterial).clone();
    return { paint, tail };
  }, [materials, vehicle.paint]);
  useEffect(() => () => [own.paint, own.tail].forEach((m) => m.dispose()), [own]);
  const prevSpeed = useRef(0);
  const pitch = useRef(0);
  const roll = useRef(0);

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const c = vehicle.car;
    if (root.current) {
      root.current.position.set(c.x, c.y, c.z);
      root.current.rotation.y = c.heading;
    }
    // Nível de detalhe (com margem, para não trocar na fronteira); o carro em uso é sempre o detalhado.
    const d2 = (c.x - camera.position.x) ** 2 + (c.z - camera.position.z) ** 2;
    near.current = runtime.active === vehicle.id || (near.current ? d2 < (lodDistance * 1.12) ** 2 : d2 < lodDistance ** 2);
    // Facho dos faróis no asfalto: só no carro em uso (os estacionados ficam com o farol apagado no chão).
    if (lit.current) lit.current.visible = runtime.active === vehicle.id;
    if (detailed.current) detailed.current.visible = near.current;
    if (simple.current) simple.current.visible = !near.current;
    if (!near.current) return;
    full.current = runtime.active === vehicle.id || (full.current ? d2 < (NEAR_CAR * 1.15) ** 2 : d2 < NEAR_CAR ** 2);
    fullParts.current.forEach((o) => o && (o.visible = full.current));
    midParts.current.forEach((o) => o && (o.visible = !full.current));
    // Suspensão: mergulha ao frear, "senta" ao acelerar, inclina na curva.
    const accel = (c.speed - prevSpeed.current) / Math.max(dt, 1e-3);
    prevSpeed.current = c.speed;
    pitch.current += (THREE.MathUtils.clamp(accel * 0.0045, -0.05, 0.05) - pitch.current) * Math.min(1, dt * 8);
    const lateral = (c.speed * Math.tan(c.steer)) / spec.wheelbase;
    roll.current += (THREE.MathUtils.clamp(lateral * c.speed * 0.0016, -0.06, 0.06) - roll.current) * Math.min(1, dt * 6);
    if (body.current) body.current.rotation.set(pitch.current, 0, roll.current);
    // Rodas: posição, esterço (só as da frente) e giro, nos dois níveis (só um está visível).
    model.wheels.forEach((wp, i) => {
      wheelTmp.m.makeRotationY(i < 2 ? -c.steer : 0).setPosition(wp[0], wp[1], wp[2]);
      wheelTmp.m.multiply(wheelTmp.r.makeRotationX(c.wheelSpin));
      for (const set of [tires.current, rims.current]) for (const mesh of set) mesh?.setMatrixAt(i, wheelTmp.m);
    });
    for (const set of [tires.current, rims.current]) for (const mesh of set) if (mesh) mesh.instanceMatrix.needsUpdate = true;
    // Freio: a lanterna acende mais forte (HDR: com o brilho ligado, ela "estoura").
    own.tail.color.copy(c.braking ? BRAKE_ON : BRAKE_OFF);
  });
  const interior = useMemo(() => carInterior(vehicle.cls), [vehicle.cls]);
  const shell = useMemo(() => (['paint', 'trim'] as const).flatMap((k) => (model.slots.get(k) ? [model.slots.get(k)!] : [])), [model]);

  const material = (slot: CarSlot) => (slot === 'paint' ? own.paint : slot === 'tail' ? own.tail : materials[slot]);
  return (
    <group ref={root}>
      <group ref={detailed}>
        <group ref={body}>
          <group ref={(g) => void (fullParts.current[0] = g)}>
            {[...model.slots.entries()].map(([slot, geo]) => (
              <mesh key={slot} geometry={geo} material={material(slot)} castShadow={slot === 'paint'} />
            ))}
          </group>
          <Cockpit
            interior={interior}
            shell={shell}
            visible={() => runtime.active === vehicle.id && runtime.mode === 'driving' && runtime.camera.view === 'first'}
            read={() => {
              const c = vehicle.car;
              const kmh = Math.abs(c.speed) * 3.6;
              // Elétricos (sedã e táxi) mostram D/R; o esportivo, a "marcha" do ronco.
              const gear = c.speed < -0.3 ? 'R' : Math.abs(c.speed) < 0.3 ? 'P' : vehicle.cls === 'sport' ? String(Math.min(7, 1 + Math.floor(Math.abs(c.speed) / 11))) : 'D';
              const battery = vehicle.id.length * 7 + 40;
              return { kmh, max: spec.maxSpeed * 3.6, gear, extra: { label: 'BAT', value: `${battery}%`, share: battery / 100 }, steer: c.steer };
            }}
          />
          <group ref={(g) => void (midParts.current[0] = g)} visible={false}>
            {[...mid.slots.entries()].map(([slot, geo]) => (
              <mesh key={slot} geometry={geo} material={material(slot)} castShadow={slot === 'paint'} />
            ))}
          </group>
        </group>
        {[model, mid].map((lod, k) => (
          <group key={k} ref={(g) => void ((k ? midParts : fullParts).current[1] = g)} visible={k === 0}>
            <instancedMesh ref={(m) => void (tires.current[k] = m)} args={[lod.tire, materials.tire, 4]} castShadow frustumCulled={false} />
            <instancedMesh ref={(m) => void (rims.current[k] = m)} args={[lod.rim, materials.rim, 4]} frustumCulled={false} />
          </group>
        ))}
      </group>
      {beam && <mesh ref={lit} geometry={beam.geometry} material={beam.material} renderOrder={7} visible={false} />}
      <group ref={simple} visible={false}>
        <mesh geometry={far.paint} material={own.paint} />
        <mesh geometry={far.rest} material={materials.farRest} />
        <mesh geometry={far.lights} material={materials.farLights} />
      </group>
    </group>
  );
}

/** Luzes do carro voador (HDR: com o brilho ligado, acendem de verdade). */
const HOVER_LIGHTS: Partial<Record<AirSlot, [number, number, number]>> = {
  thrust: [0.55, 0.78, 1.6],
  navRed: [2.4, 0.2, 0.15],
  navGreen: [0.2, 2.2, 0.6],
  navWhite: [2.2, 2.2, 2.2],
};

/**
 * O carro voador do jogador: um eVTOL da mesma família do táxi aéreo (casco em
 * gota, cabine envidraçada, esquis, quatro rotores carenados), em pérola com
 * frisos dourados — a pintura da Bezalel — e sem o letreiro de táxi. As peças
 * vêm juntas por material (6 chamadas de desenho; o da fase 1 tinha ~25) e as
 * luzes (propulsores e navegação) numa malha só, com a cor no vértice. Escala
 * 0,85: a largura com os rotores fica no raio de colisão do voo (2,2 m).
 */
function HoverCar({ runtime, vehicle, assets, effects }: { runtime: UniverseRuntime; vehicle: Extract<PlayerVehicle, { kind: 'hover' }>; assets: UniverseAssets; effects: boolean }) {
  const car = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const glows = useRef<Array<THREE.Sprite | null>>([]);
  const t = useRef(0);
  const prevSpeed = useRef(0);
  const glow = useMemo(() => makeGlowTexture('rgba(127,166,245,0.9)'), []);
  const shadowMat = useMemo(() => assets.materials.shadowBlob.clone(), [assets]);
  const model = useMemo(() => {
    const m = buildAirModel('taxi');
    const lights: THREE.BufferGeometry[] = [];
    for (const [slot, rgb] of Object.entries(HOVER_LIGHTS) as Array<[AirSlot, [number, number, number]]>) {
      const g = m.slots.get(slot);
      if (!g) continue;
      const out = g.clone();
      const n = out.attributes.position!.count;
      const colors = new Float32Array(n * 3);
      for (let v = 0; v < n; v++) colors.set(rgb, v * 3);
      out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      lights.push(out);
    }
    const lit = mergeGeometries(lights)!;
    lights.forEach((g) => g.dispose());
    return { slots: m.slots, lights: lit };
  }, []);
  const local = useMemo(
    () => ({
      rotor: new THREE.MeshBasicMaterial({ color: '#c9d3e0', transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
      lights: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    }),
    [],
  );
  useEffect(
    () => () => {
      glow.dispose();
      shadowMat.dispose();
      model.slots.forEach((g) => g.dispose());
      model.lights.dispose();
      local.rotor.dispose();
      local.lights.dispose();
    },
    [glow, shadowMat, model, local],
  );
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (effects) t.current += dt;
    const c = vehicle.craft;
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
    if (shadow.current) {
      shadow.current.position.set(c.x, 0.45, c.z);
      const k = THREE.MathUtils.clamp(1 - c.y / 40, 0.15, 1);
      shadow.current.scale.setScalar(1.6 - k * 0.6);
      shadowMat.opacity = 0.45 * k;
    }
    const pulse = 0.85 + Math.abs(c.speed) / 60 + (effects ? Math.sin(t.current * 9) * 0.05 : 0);
    glows.current.forEach((g) => g?.scale.setScalar(1.1 * pulse));
  });
  const m = assets.materials;
  const parts: Array<[AirSlot, THREE.Material, boolean]> = [
    ['hull', m.pearl, true],
    ['glass', m.darkGlass, false],
    ['gold', m.gold, false],
    ['frame', m.steel, false],
    ['rotor', local.rotor, false],
  ];
  // Centros dos rotores do táxi aéreo (os brilhos dos propulsores ficam embaixo de cada um).
  const pods: Array<[number, number]> = [
    [1.95, 1.15],
    [-1.95, 1.15],
    [1.95, -1.35],
    [-1.95, -1.35],
  ];
  return (
    <>
      <group ref={car}>
        <group ref={body} scale={HOVER_SCALE}>
          {parts.map(([slot, mat, cast]) => {
            const geo = model.slots.get(slot);
            return geo ? <mesh key={slot} geometry={geo} material={mat} castShadow={cast} /> : null;
          })}
          <mesh geometry={model.lights} material={local.lights} />
          <Cockpit
            interior={hoverInterior()}
            // Sem parede por dentro: o casco é fechado e taparia a vista; a cúpula fica aberta (o friso dourado marca a borda).
            shell={[]}
            visible={() => runtime.active === vehicle.id && runtime.mode === 'driving' && runtime.camera.view === 'first'}
            read={() => {
              const c = vehicle.craft;
              const alt = Math.max(0, Math.round(c.y - 1.8));
              return { kmh: Math.abs(c.speed) * 3.6, max: 180, gear: c.climb > 0.5 ? '↑' : c.climb < -0.5 ? '↓' : 'H', extra: { label: 'ALT', value: `${alt} m`, share: alt / 110 }, steer: c.turnRate * 0.25 };
            }}
          />
          {pods.map(([x, z], i) => (
            <sprite key={i} ref={(sp) => void (glows.current[i] = sp)} position={[x, -0.35, z]}>
              <spriteMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </sprite>
          ))}
        </group>
      </group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} material={shadowMat}>
        <circleGeometry args={[2.2, 32]} />
      </mesh>
    </>
  );
}
