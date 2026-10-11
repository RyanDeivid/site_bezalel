import * as THREE from 'three';
import { solveTwoBone } from './timeline';

/**
 * Braços robóticos industriais feitos em código (sem modelos externos): base
 * com anel de status, torre giratória, ombro, braço, cotovelo, antebraço,
 * punho e garra de dois dedos com ponteira emissiva. Movimento por
 * cinemática inversa analítica (`solveTwoBone`): basta dizer onde a ponta
 * deve estar.
 *
 * Desempenho: cada braço é só um "esqueleto" (Object3D sem malha). Todos os
 * braços são desenhados por uma frota instanciada — uma chamada de desenho por
 * tipo de peça (11) em vez de uma por peça (14 por braço). Medido num celular
 * médio simulado, o custo por quadro era dominado pelo número de chamadas de
 * desenho, não pela conta da animação.
 */

export const UPPER = 2.05;
export const FORE = 1.8;
/** Altura do ombro (topo da torre) em relação à base. */
const SHOULDER_Y = 0.62;

type PartKey = 'base' | 'ring' | 'turret' | 'ball' | 'disc' | 'upper' | 'stripe' | 'fore' | 'wrist' | 'finger' | 'tip';

interface Part {
  key: PartKey;
  anchor: THREE.Object3D;
  /** Peças "brilho" levam a cor do braço. */
  glow: boolean;
}

export class RobotArm {
  readonly root = new THREE.Group();
  readonly parts: Part[] = [];
  readonly color: THREE.Color;
  private readonly turret = new THREE.Group();
  private readonly shoulder = new THREE.Group();
  private readonly elbow = new THREE.Group();
  private readonly wrist = new THREE.Group();
  private readonly fingerA: THREE.Object3D;
  private readonly fingerB: THREE.Object3D;
  private readonly tip: THREE.Object3D;
  private yaw = 0;
  private sh = 1.2;
  private el = -2.2;
  private readonly local = new THREE.Vector3();

  constructor(color: THREE.ColorRepresentation) {
    this.color = new THREE.Color(color);
    const part = (key: PartKey, parent: THREE.Object3D, setup?: (o: THREE.Object3D) => void, glow = false) => {
      const anchor = new THREE.Object3D();
      setup?.(anchor);
      parent.add(anchor);
      this.parts.push({ key, anchor, glow });
      return anchor;
    };
    part('base', this.root, (o) => (o.position.y = 0.1));
    part('ring', this.root, (o) => (o.position.y = 0.21), true);
    this.root.add(this.turret);

    part('turret', this.turret, (o) => (o.position.y = 0.41));
    this.turret.add(this.shoulder);
    this.shoulder.position.y = SHOULDER_Y;

    part('ball', this.shoulder);
    part('disc', this.shoulder);
    part(
      'ring',
      this.shoulder,
      (o) => {
        o.scale.setScalar(0.42);
        o.rotation.x = Math.PI / 2;
        o.position.z = 0.18;
      },
      true,
    );
    part('upper', this.shoulder);
    part('stripe', this.shoulder);
    this.shoulder.add(this.elbow);

    this.elbow.position.x = UPPER;
    part('disc', this.elbow, (o) => o.scale.setScalar(0.82));
    part('fore', this.elbow);
    this.elbow.add(this.wrist);

    this.wrist.position.x = FORE;
    part('wrist', this.wrist);
    this.fingerA = part('finger', this.wrist, (o) => o.position.set(0.12, 0.06, 0));
    this.fingerB = part('finger', this.wrist, (o) => o.position.set(0.12, -0.06, 0));
    this.tip = part('tip', this.wrist, (o) => (o.position.x = 0.3), true);
    this.apply();
  }

  /** Posição de mundo da ponteira (para feixes e faíscas). */
  tipWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.tip.getWorldPosition(out);
  }

  /**
   * Aproxima a ponta do alvo (coordenadas de mundo). `follow` (0–1) suaviza
   * o movimento por quadro; `grip` abre (0) ou fecha (1) a garra.
   */
  reach(target: THREE.Vector3, follow: number, grip = 0.4) {
    this.root.updateWorldMatrix(true, false);
    this.local.copy(target);
    this.root.worldToLocal(this.local);
    const dx = this.local.x;
    const dz = this.local.z;
    const r = Math.hypot(dx, dz);
    const h = this.local.y - SHOULDER_Y;
    const yaw = Math.atan2(-dz, dx);
    // Recuo para a ponteira (garra) não atravessar o alvo.
    const ik = solveTwoBone(Math.max(0.05, r - 0.32), h, UPPER, FORE);
    this.yaw += shortestAngle(this.yaw, yaw) * follow;
    this.sh += (ik.shoulder - this.sh) * follow;
    this.el += (ik.elbow - this.el) * follow;
    const open = 0.07 - grip * 0.045;
    this.fingerA.position.y = open;
    this.fingerB.position.y = -open;
    this.apply();
  }

  /** Pose recolhida (antes de entrar em cena e ao sair). */
  rest(follow: number) {
    this.sh += (1.35 - this.sh) * follow;
    this.el += (-2.55 - this.el) * follow;
    this.apply();
  }

  private apply() {
    this.turret.rotation.y = this.yaw;
    this.shoulder.rotation.z = this.sh;
    this.elbow.rotation.z = this.el;
    // Punho mantém a ferramenta apontando para a frente/baixo.
    this.wrist.rotation.z = -(this.sh + this.el) - 0.35;
  }
}

/** Desenha vários braços com uma malha instanciada por tipo de peça. */
export class ArmFleet {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<PartKey, THREE.InstancedMesh>();
  private readonly materials: THREE.Material[];
  private readonly geometries: THREE.BufferGeometry[];
  private readonly arms: RobotArm[];

  constructor(arms: RobotArm[], envMap: THREE.Texture | null) {
    this.arms = arms;
    const shell = new THREE.MeshPhysicalMaterial({ color: 0xc9d1dc, metalness: 0.2, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3, envMap, envMapIntensity: 0.65 });
    const joint = new THREE.MeshStandardMaterial({ color: 0x2a3446, metalness: 0.85, roughness: 0.32, envMap, envMapIntensity: 1.1 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x111a28, metalness: 0.6, roughness: 0.5, envMap, envMapIntensity: 0.6 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.materials = [shell, joint, dark, glow];
    // Segmentos deitados ao longo de +X (o "plano do braço" é XY do ombro).
    const geo: Record<PartKey, [THREE.BufferGeometry, THREE.Material]> = {
      base: [new THREE.CylinderGeometry(0.5, 0.58, 0.2, 40), dark],
      ring: [new THREE.TorusGeometry(0.52, 0.018, 8, 64).rotateX(Math.PI / 2), glow],
      turret: [new THREE.CylinderGeometry(0.3, 0.36, 0.42, 32), shell],
      ball: [new THREE.SphereGeometry(0.25, 24, 16), joint],
      disc: [new THREE.CylinderGeometry(0.2, 0.2, 0.34, 28).rotateX(Math.PI / 2), joint],
      upper: [new THREE.CapsuleGeometry(0.15, UPPER - 0.3, 6, 18).rotateZ(-Math.PI / 2).translate(UPPER / 2, 0, 0), shell],
      stripe: [new THREE.BoxGeometry(UPPER * 0.62, 0.035, 0.31).translate(UPPER * 0.5, 0.11, 0), dark],
      fore: [new THREE.CapsuleGeometry(0.115, FORE - 0.26, 6, 16).rotateZ(-Math.PI / 2).translate(FORE / 2, 0, 0), shell],
      wrist: [new THREE.SphereGeometry(0.13, 18, 12), joint],
      finger: [new THREE.BoxGeometry(0.2, 0.05, 0.06).translate(0.1, 0, 0), joint],
      tip: [new THREE.SphereGeometry(0.05, 12, 8), glow],
    };
    this.geometries = Object.values(geo).map(([g]) => g);
    const counts = new Map<PartKey, number>();
    for (const p of arms[0]?.parts ?? []) counts.set(p.key, (counts.get(p.key) ?? 0) + arms.length);
    for (const [key, n] of counts) {
      const [g, m] = geo[key];
      const mesh = new THREE.InstancedMesh(g, m, n);
      mesh.frustumCulled = false;
      this.meshes.set(key, mesh);
      this.group.add(mesh);
    }
    // Cor de cada braço nas peças de brilho (instanceColor).
    const cursor = new Map<PartKey, number>();
    for (const arm of arms) {
      for (const p of arm.parts) {
        const i = cursor.get(p.key) ?? 0;
        cursor.set(p.key, i + 1);
        if (p.glow) this.meshes.get(p.key)!.setColorAt(i, arm.color);
      }
    }
    this.meshes.forEach((m) => {
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
  }

  /** Copia a pose de cada esqueleto para as instâncias. */
  sync() {
    const cursor = new Map<PartKey, number>();
    for (const arm of this.arms) {
      arm.root.updateMatrixWorld(true);
      for (const p of arm.parts) {
        const i = cursor.get(p.key) ?? 0;
        cursor.set(p.key, i + 1);
        this.meshes.get(p.key)!.setMatrixAt(i, p.anchor.matrixWorld);
      }
    }
    this.meshes.forEach((m) => (m.instanceMatrix.needsUpdate = true));
  }

  dispose() {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.meshes.forEach((m) => m.dispose());
  }
}

function shortestAngle(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
