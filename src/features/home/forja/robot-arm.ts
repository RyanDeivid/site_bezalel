import * as THREE from 'three';
import { solveTwoBone } from './timeline';

/**
 * Braço robótico industrial feito em código (sem modelos externos): base com
 * anel de status, torre giratória, ombro, braço, cotovelo, antebraço, punho e
 * garra de dois dedos com ponteira emissiva. Movimento por cinemática inversa
 * analítica (ver `solveTwoBone`): basta dizer onde a ponta deve estar.
 *
 * Geometrias e materiais são compartilhados entre braços (um único conjunto
 * por cena) para manter memória e trocas de estado baixas.
 */

export interface ArmKit {
  shell: THREE.Material;
  joint: THREE.Material;
  dark: THREE.Material;
  glow: (color: THREE.ColorRepresentation) => THREE.Material;
  geo: {
    base: THREE.BufferGeometry;
    baseRing: THREE.BufferGeometry;
    turret: THREE.BufferGeometry;
    shoulder: THREE.BufferGeometry;
    jointDisc: THREE.BufferGeometry;
    upper: THREE.BufferGeometry;
    fore: THREE.BufferGeometry;
    stripe: THREE.BufferGeometry;
    wrist: THREE.BufferGeometry;
    finger: THREE.BufferGeometry;
    tip: THREE.BufferGeometry;
  };
  dispose(): void;
}

export const UPPER = 2.05;
export const FORE = 1.8;
const SHOULDER_H = 0.62;

export function createArmKit(envMap: THREE.Texture | null): ArmKit {
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xe9edf2, metalness: 0.25, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25, envMap, envMapIntensity: 1 });
  const joint = new THREE.MeshStandardMaterial({ color: 0x2a3446, metalness: 0.85, roughness: 0.32, envMap, envMapIntensity: 1.1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111a28, metalness: 0.6, roughness: 0.5, envMap, envMapIntensity: 0.6 });
  const glows = new Map<string, THREE.Material>();
  const glow = (color: THREE.ColorRepresentation) => {
    const key = new THREE.Color(color).getHexString();
    let m = glows.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      glows.set(key, m);
    }
    return m;
  };
  // Segmentos deitados ao longo de +X (o "plano do braço" é XY do ombro).
  const upper = new THREE.CapsuleGeometry(0.15, UPPER - 0.3, 6, 18).rotateZ(-Math.PI / 2).translate(UPPER / 2, 0, 0);
  const fore = new THREE.CapsuleGeometry(0.115, FORE - 0.26, 6, 16).rotateZ(-Math.PI / 2).translate(FORE / 2, 0, 0);
  const geo = {
    base: new THREE.CylinderGeometry(0.5, 0.58, 0.2, 40),
    baseRing: new THREE.TorusGeometry(0.52, 0.018, 8, 64).rotateX(Math.PI / 2),
    turret: new THREE.CylinderGeometry(0.3, 0.36, 0.42, 32),
    shoulder: new THREE.SphereGeometry(0.25, 24, 16),
    jointDisc: new THREE.CylinderGeometry(0.2, 0.2, 0.34, 28).rotateX(Math.PI / 2),
    upper,
    fore,
    stripe: new THREE.BoxGeometry(UPPER * 0.62, 0.035, 0.31).translate(UPPER * 0.5, 0.11, 0),
    wrist: new THREE.SphereGeometry(0.13, 18, 12),
    finger: new THREE.BoxGeometry(0.2, 0.05, 0.06).translate(0.1, 0, 0),
    tip: new THREE.SphereGeometry(0.05, 12, 8),
  };
  return {
    shell,
    joint,
    dark,
    glow,
    geo,
    dispose() {
      Object.values(geo).forEach((g) => g.dispose());
      shell.dispose();
      joint.dispose();
      dark.dispose();
      glows.forEach((m) => m.dispose());
    },
  };
}

export class RobotArm {
  readonly root = new THREE.Group();
  private readonly turret = new THREE.Group();
  private readonly shoulder = new THREE.Group();
  private readonly elbow = new THREE.Group();
  private readonly wrist = new THREE.Group();
  private readonly fingerA: THREE.Mesh;
  private readonly fingerB: THREE.Mesh;
  /** Ponteira emissiva (laser, solda). */
  readonly tip: THREE.Mesh;
  private yaw = 0;
  private sh = 1.2;
  private el = -2.2;
  private readonly local = new THREE.Vector3();

  constructor(kit: ArmKit, color: THREE.ColorRepresentation) {
    const m = (g: THREE.BufferGeometry, mat: THREE.Material) => new THREE.Mesh(g, mat);
    const { geo } = kit;
    const base = m(geo.base, kit.dark);
    base.position.y = 0.1;
    const ring = m(geo.baseRing, kit.glow(color));
    ring.position.y = 0.21;
    this.root.add(base, ring, this.turret);

    const turretBody = m(geo.turret, kit.shell);
    turretBody.position.y = 0.41;
    this.turret.add(turretBody, this.shoulder);
    this.shoulder.position.y = SHOULDER_H;

    const shoulderBall = m(geo.shoulder, kit.joint);
    const shoulderDisc = m(geo.jointDisc, kit.joint);
    const shoulderAccent = m(geo.baseRing, kit.glow(color));
    shoulderAccent.scale.setScalar(0.42);
    shoulderAccent.rotation.x = Math.PI / 2;
    shoulderAccent.position.z = 0.18;
    this.shoulder.add(shoulderBall, shoulderDisc, shoulderAccent, m(geo.upper, kit.shell), m(geo.stripe, kit.dark), this.elbow);

    this.elbow.position.x = UPPER;
    const elbowDisc = m(geo.jointDisc, kit.joint);
    elbowDisc.scale.setScalar(0.82);
    this.elbow.add(elbowDisc, m(geo.fore, kit.shell), this.wrist);

    this.wrist.position.x = FORE;
    this.fingerA = m(geo.finger, kit.joint);
    this.fingerB = m(geo.finger, kit.joint);
    this.fingerA.position.set(0.12, 0.06, 0);
    this.fingerB.position.set(0.12, -0.06, 0);
    this.tip = m(geo.tip, kit.glow(color));
    this.tip.position.x = 0.3;
    this.wrist.add(m(geo.wrist, kit.joint), this.fingerA, this.fingerB, this.tip);
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
    const h = this.local.y - (0.41 + SHOULDER_H);
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

function shortestAngle(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
