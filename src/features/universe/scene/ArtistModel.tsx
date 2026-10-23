import { useThree } from '@react-three/fiber';
import { useEffect, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { modelById, modelForSlot, PLACEMENTS, type ModelEntry, type ModelSlot } from '../assets/manifest';

/**
 * Modelos de artistas (glTF/GLB) no Universe, por cima do procedural.
 *
 * - `ArtistSlot`: mostra o modelo registrado para um encaixe; enquanto ele não
 *   chega (ou se falhar), mostra os filhos — a peça procedural de sempre.
 * - `ArtistPlacements`: os objetos posicionados no mundo (`PLACEMENTS`).
 *
 * Os carregadores (GLTFLoader, KTX2Loader e MeshoptDecoder, do próprio three)
 * só são baixados quando existe algum modelo registrado — sem modelos, o custo
 * é zero. Cada arquivo é carregado uma vez e compartilhado; o último a sair
 * libera geometrias, materiais e texturas.
 */

type Loaded = { scene: THREE.Object3D; users: number };
const cache = new Map<string, Promise<Loaded>>();
let loaders: Promise<{ load: (url: string) => Promise<THREE.Object3D> }> | null = null;

function getLoaders(gl: THREE.WebGLRenderer) {
  loaders ??= (async () => {
    const [{ GLTFLoader }, { KTX2Loader }, { MeshoptDecoder }] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/loaders/KTX2Loader.js'),
      import('three/addons/libs/meshopt_decoder.module.js'),
    ]);
    const base = import.meta.env.BASE_URL;
    // Transcodificador Basis (texturas KTX2): servido de public/basis/ (copiado de three/examples/jsm/libs/basis
    // quando o primeiro modelo com KTX2 entrar — ver docs/BLENDER-PIPELINE.md).
    const ktx2 = new KTX2Loader().setTranscoderPath(`${base}basis/`).detectSupport(gl);
    const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
    return { load: (url: string) => loader.loadAsync(`${base}${url}`).then((g) => g.scene) };
  })();
  return loaders;
}

function acquire(url: string, gl: THREE.WebGLRenderer): Promise<Loaded> {
  let p = cache.get(url);
  if (!p) {
    p = getLoaders(gl).then(async (l) => ({ scene: await l.load(url), users: 0 }));
    cache.set(url, p);
    p.catch(() => cache.delete(url));
  }
  return p.then((x) => {
    x.users++;
    return x;
  });
}

function release(url: string) {
  void cache.get(url)?.then((x) => {
    if (--x.users > 0) return;
    cache.delete(url);
    x.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) {
        for (const v of Object.values(mat)) if ((v as THREE.Texture | null)?.isTexture) (v as THREE.Texture).dispose();
        mat.dispose();
      }
    });
  });
}

/** Monta o objeto de um modelo: os níveis de detalhe num `THREE.LOD`, com escala, deslocamento e sombras. */
function useModel(entry: ModelEntry | null): THREE.Object3D | null {
  const gl = useThree((s) => s.gl);
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    if (!entry) return;
    let alive = true;
    const urls = entry.lods.map((l) => l.url);
    Promise.all(urls.map((u) => acquire(u, gl)))
      .then((levels) => {
        if (!alive) return;
        const lod = new THREE.LOD();
        levels.forEach((lv, i) => {
          const copy = lv.scene.clone(true);
          copy.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) {
              o.castShadow = entry.shadows ?? true;
              o.receiveShadow = entry.shadows ?? true;
            }
          });
          lod.addLevel(copy, i === 0 ? 0 : entry.lods[i - 1]!.upTo);
        });
        const root = new THREE.Group();
        root.add(lod);
        lod.scale.setScalar(entry.scale ?? 1);
        if (entry.offset) lod.position.set(...entry.offset);
        lod.rotation.y = entry.rotationY ?? 0;
        root.userData.dynamic = true;
        setObject(root);
      })
      .catch((err) => {
        // Sem o modelo, a peça procedural continua: o mundo não fica com buraco.
        if (import.meta.env.DEV) console.warn(`modelo ${entry.id} não carregou:`, err);
      });
    return () => {
      alive = false;
      setObject(null);
      urls.forEach(release);
    };
  }, [entry, gl]);
  return object;
}

/** O modelo do encaixe, se houver (e já carregado); senão, a peça procedural (`children`). */
export function ArtistSlot({ slot, children }: { slot: ModelSlot; children: ReactNode }) {
  const entry = modelForSlot(slot);
  const object = useModel(entry);
  if (object) return <primitive object={object} />;
  // Com modelo registrado, a peça procedural fica fora da junção de peças estáticas (`userData.dynamic`):
  // senão ela continuaria desenhada, juntada à malha da cidade, por baixo do modelo quando ele chegasse.
  return entry ? <group userData={{ dynamic: true }}>{children}</group> : <>{children}</>;
}

function Placed({ id, position, rotationY, scale }: { id: string; position: [number, number, number]; rotationY: number; scale: number }) {
  // Os níveis de detalhe escolhem pela câmera a cada quadro (o three faz isso sozinho para `LOD`).
  const object = useModel(modelById(id));
  return object ? <primitive object={object} position={position} rotation={[0, rotationY, 0]} scale={scale} /> : null;
}

/** Os objetos posicionados no mundo pelo Blender (`PLACEMENTS`). Sem posições, não renderiza nada. */
export function ArtistPlacements() {
  if (!PLACEMENTS.length) return null;
  return (
    <group name="placements">
      {PLACEMENTS.map((p, i) => (
        <Placed key={i} id={p.model} position={[p.x, p.y, p.z]} rotationY={p.rotationY} scale={p.scale ?? 1} />
      ))}
    </group>
  );
}
