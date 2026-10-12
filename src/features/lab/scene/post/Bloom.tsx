import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import type * as Passes from './bloom-passes';

function BloomRenderer({ passes }: { passes: typeof Passes }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const composer = useMemo(() => passes.createBloom(gl, scene, camera), [passes, gl, scene, camera]);
  useEffect(() => composer.setSize(size.width, size.height), [composer, size]);
  useEffect(() => () => composer.dispose(), [composer]);
  // Prioridade > 0: o R3F deixa de renderizar sozinho e o compositor assume.
  useFrame(() => composer.render(), 1);
  return null;
}

/**
 * Bloom só em aparelho forte (decidido por quem monta a cena). O módulo de
 * pós-processamento é baixado sob demanda; até lá, a cena aparece normal.
 */
export function Bloom() {
  const [passes, setPasses] = useState<typeof Passes | null>(null);
  useEffect(() => {
    let alive = true;
    import('./bloom-passes')
      .then((mod) => alive && setPasses(mod))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return passes ? <BloomRenderer passes={passes} /> : null;
}
