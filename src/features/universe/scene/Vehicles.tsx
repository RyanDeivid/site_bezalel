import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { makeGlowTexture } from '@/features/lab/scene/textures';
import type { PlayerVehicle, UniverseRuntime } from '../world/runtime';
import { CAR_SPECS, type CarClass } from '../world/vehicles';
import type { UniverseAssets } from './assets';
import type { CarMaterials, CarModel, CarSlot } from './carModels';

interface Props {
  runtime: UniverseRuntime;
  models: Record<CarClass, CarModel>;
  materials: CarMaterials;
  assets: UniverseAssets;
  effects: boolean;
}

/** Veículos que o jogador pode usar: os carros (com volante e suspensão visíveis) e o carro voador. */
export function PlayerVehicles({ runtime, models, materials, assets, effects }: Props) {
  return (
    <>
      {runtime.vehicles.map((v) =>
        v.kind === 'car' ? <PlayerCar key={v.id} vehicle={v} model={models[v.cls]} materials={materials} /> : <HoverCar key={v.id} vehicle={v} assets={assets} effects={effects} />,
      )}
    </>
  );
}

function PlayerCar({ vehicle, model, materials }: { vehicle: Extract<PlayerVehicle, { kind: 'car' }>; model: CarModel; materials: CarMaterials }) {
  const spec = CAR_SPECS[vehicle.cls];
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const wheels = useRef<Array<THREE.Group | null>>([]);
  const spinners = useRef<Array<THREE.Group | null>>([]);
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

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const c = vehicle.car;
    if (root.current) {
      root.current.position.set(c.x, c.y, c.z);
      root.current.rotation.y = c.heading;
    }
    // Suspensão: mergulha ao frear, "senta" ao acelerar, inclina na curva.
    const accel = (c.speed - prevSpeed.current) / Math.max(dt, 1e-3);
    prevSpeed.current = c.speed;
    pitch.current += (THREE.MathUtils.clamp(accel * 0.0045, -0.05, 0.05) - pitch.current) * Math.min(1, dt * 8);
    const lateral = (c.speed * Math.tan(c.steer)) / spec.wheelbase;
    roll.current += (THREE.MathUtils.clamp(lateral * c.speed * 0.0016, -0.06, 0.06) - roll.current) * Math.min(1, dt * 6);
    if (body.current) body.current.rotation.set(pitch.current, 0, roll.current);
    wheels.current.forEach((w, i) => w && (w.rotation.y = i < 2 ? -c.steer : 0));
    spinners.current.forEach((s) => s && (s.rotation.x = c.wheelSpin));
    own.tail.color.set(c.braking ? '#ff5a3a' : '#a8341f');
  });

  const material = (slot: CarSlot) => (slot === 'paint' ? own.paint : slot === 'tail' ? own.tail : materials[slot]);
  return (
    <group ref={root}>
      <group ref={body}>
        {[...model.slots.entries()].map(([slot, geo]) => (
          <mesh key={slot} geometry={geo} material={material(slot)} castShadow={slot === 'paint'} />
        ))}
      </group>
      {model.wheels.map((p, i) => (
        <group key={i} ref={(g) => void (wheels.current[i] = g)} position={p}>
          <group ref={(g) => void (spinners.current[i] = g)}>
            <mesh geometry={model.tire} material={materials.tire} castShadow />
            <mesh geometry={model.rim} material={materials.rim} />
          </group>
        </group>
      ))}
    </group>
  );
}

/** O carro voador da fase 1 (casco perolado, cabine escura, quatro propulsores). */
function HoverCar({ vehicle, assets, effects }: { vehicle: Extract<PlayerVehicle, { kind: 'hover' }>; assets: UniverseAssets; effects: boolean }) {
  const car = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const glows = useRef<Array<THREE.Sprite | null>>([]);
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
    glows.current.forEach((g) => g?.scale.setScalar(1.3 * pulse));
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
          <mesh material={m.pearl} scale={[1.2, 0.34, 2.55]} castShadow>
            <sphereGeometry args={[1, 32, 16]} />
          </mesh>
          <mesh material={m.darkGlass} position={[0, 0.22, 0.45]} scale={[0.66, 0.3, 1.25]}>
            <sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
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
          <mesh material={m.glowIvory} position={[0, 0.04, 2.5]}>
            <boxGeometry args={[0.9, 0.07, 0.06]} />
          </mesh>
          <mesh material={m.glowBrake} position={[0, 0.1, -2.5]}>
            <boxGeometry args={[1.3, 0.08, 0.06]} />
          </mesh>
          {pods.map(([x, z], i) => (
            <group key={i} position={[x, -0.22, z]}>
              <mesh material={m.steelLight} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.42, 0.42, 0.85, 16]} />
              </mesh>
              <mesh material={m.glowBlue} position={[0, -0.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.34, 0.05, 6, 20]} />
              </mesh>
              <sprite ref={(s) => void (glows.current[i] = s)} position={[0, -0.45, 0]}>
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
