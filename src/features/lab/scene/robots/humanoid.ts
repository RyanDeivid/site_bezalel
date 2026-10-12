import * as THREE from 'three';

/**
 * Robôs humanoides articulados feitos em código (sem modelos externos):
 * quadril, tronco, pescoço e cabeça com visor; pernas com quadril, joelho e
 * tornozelo; braços com ombro, cotovelo e punho; mãos com palma, três dedos e
 * polegar. A pose sai de poucos parâmetros (`HumanoidPose`): passada, carga
 * nos braços, digitação e para onde a cabeça olha.
 *
 * Desempenho: como os braços da Forja (`robot-arm.ts`), cada robô é só um
 * esqueleto (Object3D sem malha); a frota inteira é desenhada com uma malha
 * instanciada por tipo de peça — ~16 chamadas de desenho para todos os robôs.
 */

export const HIP_Y = 0.95;
const THIGH = 0.44;
const SHIN = 0.44;
const UPPER_ARM = 0.3;
const FOREARM = 0.28;

type PartKey =
  | 'pelvis'
  | 'torso'
  | 'chest'
  | 'neck'
  | 'head'
  | 'visor'
  | 'antenna'
  | 'thigh'
  | 'shin'
  | 'foot'
  | 'upperArm'
  | 'forearm'
  | 'joint'
  | 'palm'
  | 'finger'
  | 'crate';

interface Part {
  key: PartKey;
  anchor: THREE.Object3D;
  /** Peças de brilho levam a cor do robô (ou do registro, no caso da caixa). */
  glow: boolean;
}

export interface HumanoidPose {
  /** 0 = parado, 1 = caminhando. */
  walk: number;
  /** Fase da passada (rad); avança com a distância percorrida. */
  phase: number;
  /** 0 = braços livres, 1 = carregando a caixa com as duas mãos. */
  carry: number;
  /** 0 = parado, 1 = digitando no console. */
  type: number;
  /** Tempo (s) para a digitação e a respiração. */
  time: number;
  /** Rotação da cabeça (rad, relativa ao corpo). */
  look: number;
}

export const restPose = (): HumanoidPose => ({ walk: 0, phase: 0, carry: 0, type: 0, time: 0, look: 0 });

interface Leg {
  hip: THREE.Group;
  knee: THREE.Group;
  ankle: THREE.Group;
}

interface Arm {
  shoulder: THREE.Group;
  elbow: THREE.Group;
  wrist: THREE.Group;
  fingers: THREE.Object3D[];
  thumb: THREE.Object3D;
  side: 1 | -1;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class Humanoid {
  readonly root = new THREE.Group();
  readonly parts: Part[] = [];
  readonly color: THREE.Color;
  private readonly pelvis = new THREE.Group();
  private readonly spine = new THREE.Group();
  private readonly neck = new THREE.Group();
  private readonly legs: Leg[] = [];
  private readonly arms: Arm[] = [];
  private readonly crate: THREE.Object3D;

  constructor(color: THREE.ColorRepresentation) {
    this.color = new THREE.Color(color);
    const part = (key: PartKey, parent: THREE.Object3D, setup?: (o: THREE.Object3D) => void, glow = false) => {
      const anchor = new THREE.Object3D();
      setup?.(anchor);
      parent.add(anchor);
      this.parts.push({ key, anchor, glow });
      return anchor;
    };
    const joint = (parent: THREE.Object3D, scale: number) => part('joint', parent, (o) => o.scale.setScalar(scale));

    this.root.add(this.pelvis);
    this.pelvis.position.y = HIP_Y;
    part('pelvis', this.pelvis);

    // Pernas: quadril → coxa → joelho → canela → tornozelo → pé.
    for (const side of [1, -1] as const) {
      const hip = new THREE.Group();
      hip.position.set(0.11 * side, -0.04, 0);
      this.pelvis.add(hip);
      joint(hip, 1.05);
      part('thigh', hip);
      const knee = new THREE.Group();
      knee.position.y = -THIGH;
      hip.add(knee);
      joint(knee, 0.9);
      part('shin', knee);
      const ankle = new THREE.Group();
      ankle.position.y = -SHIN;
      knee.add(ankle);
      part('foot', ankle);
      this.legs.push({ hip, knee, ankle });
    }

    // Tronco, peito luminoso, pescoço e cabeça.
    this.spine.position.y = 0.06;
    this.pelvis.add(this.spine);
    part('torso', this.spine);
    part('chest', this.spine, (o) => o.position.set(0, 0.36, 0.165), true);
    this.neck.position.y = 0.6;
    this.spine.add(this.neck);
    part('neck', this.neck);
    part('head', this.neck, (o) => (o.position.y = 0.17));
    part('visor', this.neck, (o) => o.position.set(0, 0.18, 0.135), true);
    part('antenna', this.neck, (o) => (o.position.y = 0.37), true);

    // Braços: ombro → braço → cotovelo → antebraço → punho → mão.
    for (const side of [1, -1] as const) {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.27 * side, 0.5, 0);
      this.spine.add(shoulder);
      joint(shoulder, 0.95);
      part('upperArm', shoulder);
      const elbow = new THREE.Group();
      elbow.position.y = -UPPER_ARM;
      shoulder.add(elbow);
      joint(elbow, 0.75);
      part('forearm', elbow);
      const wrist = new THREE.Group();
      wrist.position.y = -FOREARM;
      elbow.add(wrist);
      part('palm', wrist);
      const fingers = [-0.026, 0, 0.026].map((x) => part('finger', wrist, (o) => o.position.set(x, -0.1, 0.004)));
      const thumb = part('finger', wrist, (o) => {
        o.position.set(-0.045 * side, -0.05, 0.012);
        o.scale.set(1.1, 0.75, 1);
      });
      this.arms.push({ shoulder, elbow, wrist, fingers, thumb, side });
    }

    // Caixa de registro carregada à frente do peito (some quando não há carga).
    this.crate = part('crate', this.spine, (o) => o.position.set(0, 0.28, 0.42), true);
    this.apply(restPose());
  }

  apply(p: HumanoidPose): void {
    const walk = p.walk;
    const carry = p.carry;
    const type = p.type * (1 - carry);

    // Pernas: balanço do quadril, joelho dobrando na fase de avanço, pé acompanhando.
    this.legs.forEach((leg, i) => {
      const ph = p.phase + i * Math.PI;
      const swing = Math.sin(ph) * 0.48 * walk;
      leg.hip.rotation.x = -swing;
      leg.knee.rotation.x = walk * 0.8 * Math.max(0, Math.cos(ph)) + 0.04;
      leg.ankle.rotation.x = swing * 0.35 - walk * 0.15 * Math.max(0, Math.cos(ph));
    });

    // Corpo sobe quando as pernas se cruzam e desce na passada aberta.
    const breathe = Math.sin(p.time * 1.7) * 0.006;
    this.pelvis.position.y = HIP_Y - 0.03 * walk + Math.abs(Math.cos(p.phase)) * 0.035 * walk + breathe;
    this.spine.rotation.y = Math.sin(p.phase) * 0.08 * walk;
    this.spine.rotation.x = 0.05 * walk + 0.08 * type;
    this.neck.rotation.y = p.look;
    this.neck.rotation.x = 0.18 * type - 0.04 * carry;

    // Braços: balanço oposto às pernas → carregar (frente) → digitar (console).
    this.arms.forEach((arm, i) => {
      const legPhase = p.phase + i * Math.PI;
      const free = -Math.sin(legPhase) * 0.5 * walk;
      let sx = lerp(-free, -1.0, carry);
      let sz = lerp(0.07, 0.12, carry) * arm.side;
      let ex = lerp(-0.12 - 0.25 * walk, -0.62, carry);
      let wx = lerp(0, 0.25, carry);
      if (type > 0) {
        // Digitação: cada mão bate num ritmo próprio.
        const tap = Math.sin(p.time * (11 + i * 1.7) + i * 1.3) * 0.06;
        sx = lerp(sx, -0.62 + tap, type);
        sz = lerp(sz, 0.16 * arm.side, type);
        ex = lerp(ex, -1.05 - tap * 0.6, type);
        wx = lerp(wx, 0.45 + tap * 2, type);
      }
      arm.shoulder.rotation.set(sx, 0, sz);
      arm.elbow.rotation.x = ex;
      arm.wrist.rotation.x = wx;
      const grip = Math.max(carry, 0.25 + type * 0.2);
      for (const f of arm.fingers) f.rotation.x = -grip * 1.1;
      arm.thumb.rotation.set(-grip * 0.5, 0, grip * 0.6 * arm.side);
    });

    const s = Math.max(0.0001, Math.min(1, (carry - 0.15) / 0.5));
    this.crate.scale.setScalar(s);
  }
}

/** Desenha vários humanoides com uma malha instanciada por tipo de peça. */
export class HumanoidFleet {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<PartKey, THREE.InstancedMesh>();
  private readonly materials: THREE.Material[];
  private readonly geometries: THREE.BufferGeometry[];
  private readonly robots: Humanoid[];
  /** Índice da instância da caixa de cada robô (para recolorir). */
  private readonly crateIndex = new Map<Humanoid, number>();

  constructor(robots: Humanoid[], opts: { envIntensity?: number } = {}) {
    this.robots = robots;
    const env = opts.envIntensity ?? 1;
    // PBR: casco branco com verniz (reflete o ambiente), juntas de metal escovado.
    const shell = new THREE.MeshPhysicalMaterial({ color: 0xc3ccd8, metalness: 0.3, roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.25, envMapIntensity: 0.8 * env });
    const metal = new THREE.MeshStandardMaterial({ color: 0x2c3648, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.2 * env });
    const dark = new THREE.MeshStandardMaterial({ color: 0x141d2c, metalness: 0.5, roughness: 0.55, envMapIntensity: 0.6 * env });
    const glow = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const crate = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.92 });
    this.materials = [shell, metal, dark, glow, crate];

    const capsuleDown = (r: number, len: number) => new THREE.CapsuleGeometry(r, len - 2 * r, 6, 14).translate(0, -len / 2, 0);
    const geo: Record<PartKey, [THREE.BufferGeometry, THREE.Material]> = {
      pelvis: [new THREE.CylinderGeometry(0.17, 0.15, 0.16, 20), dark],
      torso: [new THREE.CapsuleGeometry(0.2, 0.26, 6, 18).scale(1, 1, 0.74).translate(0, 0.3, 0), shell],
      chest: [new THREE.CircleGeometry(0.05, 20), glow],
      neck: [new THREE.CylinderGeometry(0.05, 0.06, 0.12, 12).translate(0, 0.04, 0), metal],
      head: [new THREE.SphereGeometry(0.16, 22, 16).scale(1, 0.94, 1.06), shell],
      visor: [new THREE.BoxGeometry(0.24, 0.06, 0.05), glow],
      antenna: [new THREE.SphereGeometry(0.028, 10, 8), glow],
      thigh: [capsuleDown(0.075, THIGH), shell],
      shin: [capsuleDown(0.064, SHIN), shell],
      foot: [new THREE.BoxGeometry(0.12, 0.06, 0.26).translate(0, -0.02, 0.05), dark],
      upperArm: [capsuleDown(0.056, UPPER_ARM), shell],
      forearm: [capsuleDown(0.05, FOREARM), shell],
      joint: [new THREE.SphereGeometry(0.07, 14, 10), metal],
      palm: [new THREE.BoxGeometry(0.085, 0.1, 0.035).translate(0, -0.05, 0), metal],
      finger: [new THREE.BoxGeometry(0.018, 0.07, 0.02).translate(0, -0.035, 0), metal],
      crate: [new THREE.BoxGeometry(0.46, 0.28, 0.32), crate],
    };
    this.geometries = Object.values(geo).map(([g]) => g);
    const counts = new Map<PartKey, number>();
    for (const p of robots[0]?.parts ?? []) counts.set(p.key, (counts.get(p.key) ?? 0) + robots.length);
    for (const [key, n] of counts) {
      const [g, m] = geo[key];
      const mesh = new THREE.InstancedMesh(g, m, n);
      mesh.frustumCulled = false;
      this.meshes.set(key, mesh);
      this.group.add(mesh);
    }
    const cursor = new Map<PartKey, number>();
    for (const robot of robots) {
      for (const p of robot.parts) {
        const i = cursor.get(p.key) ?? 0;
        cursor.set(p.key, i + 1);
        if (p.key === 'crate') this.crateIndex.set(robot, i);
        if (p.glow) this.meshes.get(p.key)!.setColorAt(i, robot.color);
      }
    }
    this.meshes.forEach((m) => {
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
  }

  /** Cor da caixa (registro) que um robô carrega. */
  setCrateColor(robot: Humanoid, color: THREE.ColorRepresentation): void {
    const i = this.crateIndex.get(robot);
    const mesh = this.meshes.get('crate');
    if (i === undefined || !mesh) return;
    mesh.setColorAt(i, new THREE.Color(color));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /** Copia a pose de cada esqueleto para as instâncias. */
  sync(): void {
    const cursor = new Map<PartKey, number>();
    for (const robot of this.robots) {
      robot.root.updateMatrixWorld(true);
      for (const p of robot.parts) {
        const i = cursor.get(p.key) ?? 0;
        cursor.set(p.key, i + 1);
        this.meshes.get(p.key)!.setMatrixAt(i, p.anchor.matrixWorld);
      }
    }
    this.meshes.forEach((m) => (m.instanceMatrix.needsUpdate = true));
  }

  dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.meshes.forEach((m) => m.dispose());
  }
}
