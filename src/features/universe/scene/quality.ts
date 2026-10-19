import type { Quality } from '../world/city';

/**
 * O que cada nível de qualidade muda de verdade na cena (não é só um rótulo):
 * resolução, antisserrilhado, sombras, distância visível, densidade de prédios
 * e detalhes de fachada, quantidade de carros e de voadores, estrelas.
 */
export const QUALITY_CONFIG: Record<Quality, { dpr: number | [number, number]; antialias: boolean; shadows: 0 | 1024 | 2048; far: number; fog: number; stars: number; envIntensity: number }> = {
  low: { dpr: 0.85, antialias: false, shadows: 0, far: 300, fog: 280, stars: 400, envIntensity: 0.38 },
  medium: { dpr: [1, 1.25], antialias: true, shadows: 1024, far: 420, fog: 380, stars: 800, envIntensity: 0.45 },
  high: { dpr: [1, 1.75], antialias: true, shadows: 2048, far: 600, fog: 520, stars: 1400, envIntensity: 0.5 },
};
