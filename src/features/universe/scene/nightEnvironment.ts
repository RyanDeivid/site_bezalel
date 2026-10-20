import * as THREE from 'three';

/**
 * Cena que vira o mapa de reflexos do Universe (desenhada uma vez num cubo e
 * filtrada; depois é descartada). Antes era o estúdio do three
 * (RoomEnvironment): carros e vidros refletiam painéis de luz de estúdio no
 * meio da cidade à noite — manchas brancas que nada na cena justificava.
 *
 * Aqui o reflexo é a própria noite da Bezalel: o mesmo gradiente do céu, o
 * brilho da cidade no horizonte, silhuetas de prédios em volta com faixas de
 * janelas acesas (quentes e frias, irregulares) e alguns pontos de luz de rua.
 * Pintura e vidro passam a refletir o que existe em volta deles.
 */
export function nightCityEnvironment(): THREE.Scene {
  const scene = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { zenith: { value: new THREE.Color('#1a2646') }, horizon: { value: new THREE.Color('#7d6e9c') }, glow: { value: new THREE.Color('#e0a58e') }, ground: { value: new THREE.Color('#3a3038') } },
      vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform vec3 zenith; uniform vec3 horizon; uniform vec3 glow; uniform vec3 ground;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 c = mix(horizon, zenith, smoothstep(0.0, 0.7, h));
          c += glow * exp(-abs(h) * 10.0) * 0.6;
          c = mix(ground, c, smoothstep(-0.12, 0.0, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  scene.add(sky);

  // Prédios em volta: volumes escuros com faixas de janelas acesas (determinístico).
  let seed = 11;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const dark = new THREE.MeshBasicMaterial({ color: '#0b0f18' });
  const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd7a0').multiplyScalar(1.6) });
  const cool = new THREE.MeshBasicMaterial({ color: new THREE.Color('#bcd2ff').multiplyScalar(1.4) });
  const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf8a').multiplyScalar(3) });
  const geo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rand() * 0.08;
    const dist = 26 + rand() * 12;
    const w = 3 + rand() * 4;
    const h = 6 + rand() * 18;
    const b = new THREE.Mesh(geo, dark);
    b.scale.set(w, h, w);
    b.position.set(Math.cos(a) * dist, h / 2 - 3, Math.sin(a) * dist);
    b.lookAt(0, h / 2 - 3, 0);
    scene.add(b);
    // Algumas faixas de janelas por prédio (nem todas acesas).
    const floors = Math.floor(h / 1.6);
    for (let f = 1; f < floors; f++) {
      if (rand() > 0.55) continue;
      const strip = new THREE.Mesh(geo, rand() < 0.6 ? warm : cool);
      strip.scale.set(w * (0.3 + rand() * 0.6), 0.28, 0.1);
      strip.position.set(Math.cos(a) * (dist - w / 2 - 0.06), f * 1.6 - 3, Math.sin(a) * (dist - w / 2 - 0.06));
      strip.lookAt(0, f * 1.6 - 3, 0);
      scene.add(strip);
    }
  }
  // Pontos de luz de rua, baixos, perto do horizonte.
  const dot = new THREE.SphereGeometry(0.35, 8, 6);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const m = new THREE.Mesh(dot, lamp);
    m.position.set(Math.cos(a) * 14, -1.2, Math.sin(a) * 14);
    scene.add(m);
  }
  return scene;
}

export function disposeScene(scene: THREE.Object3D) {
  const seen = new Set<unknown>();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && !seen.has(m.geometry)) {
      seen.add(m.geometry);
      m.geometry.dispose();
    }
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats)
      if (!seen.has(mat)) {
        seen.add(mat);
        mat.dispose();
      }
  });
}
