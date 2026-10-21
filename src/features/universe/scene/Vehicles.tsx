import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeGlowTexture } from '@/features/lab/scene/textures';
import type { PlayerVehicle, UniverseRuntime } from '../world/runtime';
import { CAR_SPECS, type CarClass } from '../world/vehicles';
import type { UniverseAssets } from './assets';
import { buildAirModel, type AirSlot } from './airModels';
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
}

/** Até esta distância da câmera (m), o carro estacionado usa o modelo completo; depois, o intermediário. */
const NEAR_CAR = 18;

/** Veículos que o jogador pode usar: os carros (com volante e suspensão visíveis) e o carro voador. */
export function PlayerVehicles({ runtime, models, midModels, farModels, materials, assets, effects, lodDistance }: Props) {
  return (
    <>
      {runtime.vehicles.map((v) =>
        v.kind === 'car' ? (
          <PlayerCar key={v.id} runtime={runtime} vehicle={v} model={models[v.cls]} mid={midModels[v.cls]} far={farModels[v.cls]} materials={materials} lodDistance={lodDistance} />
        ) : (
          <HoverCar key={v.id} vehicle={v} assets={assets} effects={effects} />
        ),
      )}
    </>
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
}: {
  runtime: UniverseRuntime;
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
function HoverCar({ vehicle, assets, effects }: { vehicle: Extract<PlayerVehicle, { kind: 'hover' }>; assets: UniverseAssets; effects: boolean }) {
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
        <group ref={body} scale={0.85}>
          {parts.map(([slot, mat, cast]) => {
            const geo = model.slots.get(slot);
            return geo ? <mesh key={slot} geometry={geo} material={mat} castShadow={cast} /> : null;
          })}
          <mesh geometry={model.lights} material={local.lights} />
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
