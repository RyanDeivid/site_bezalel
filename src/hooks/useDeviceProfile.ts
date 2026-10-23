import { useMemo } from 'react';
import { useMediaQuery } from './useMediaQuery';

export type DeviceTier = 'low' | 'medium' | 'high';

interface NavigatorHints {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
}

/** Testa suporte real a WebGL criando um contexto descartável. */
export function detectWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const ok = !!gl;
    (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

let software: boolean | undefined;
/**
 * WebGL por software (SwiftShader, llvmpipe…: sem placa de vídeo, como no CI)? Detectado uma vez por sessão,
 * pelo nome do renderizador de um contexto descartável.
 */
export function softwareWebGL(): boolean {
  if (software !== undefined) return software;
  software = false;
  if (typeof document === 'undefined') return false;
  try {
    const gl = (document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      software = /swiftshader|llvmpipe|softpipe|software|basic render driver/i.test(name);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    software = false;
  }
  return software;
}

let webglSupport: boolean | undefined;
/** Detecta WebGL uma única vez por sessão (o teste cria um contexto descartável). */
export function hasWebGL(): boolean {
  webglSupport ??= detectWebGL();
  return webglSupport;
}

/**
 * Estima a capacidade do dispositivo para dosar efeitos: partículas,
 * resolução do canvas e recomendação 3D/2D no laboratório.
 */
export function useDeviceProfile() {
  const coarse = useMediaQuery('(pointer: coarse)');
  const small = useMediaQuery('(max-width: 767px)');

  return useMemo(() => {
    const nav = (typeof navigator !== 'undefined' ? navigator : {}) as Navigator & NavigatorHints;
    const cores = nav.hardwareConcurrency ?? 4;
    const memory = nav.deviceMemory ?? 4;
    const saveData = nav.connection?.saveData === true;
    let tier: DeviceTier = 'high';
    if (saveData || cores <= 2 || memory <= 2) tier = 'low';
    else if (cores <= 4 || memory <= 4 || coarse) tier = 'medium';
    return { tier, coarse, small, saveData };
  }, [coarse, small]);
}
