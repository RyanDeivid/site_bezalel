import type { Quality } from '../world/city';
import type { BloomSettings } from './bloom';

export interface QualitySettings {
  /** Faixa da resolução adaptativa (dpr): começa no máximo que a tela permite e desce até `dprMin` se faltar fôlego. */
  dprMin: number;
  dprMax: number;
  antialias: boolean;
  /** Lado do mapa de sombras (0 = sem sombras). */
  shadows: 0 | 1024 | 2048 | 4096;
  /** Meia-largura (m) da área de sombras, que acompanha a câmera. */
  shadowRange: number;
  /** Redesenha o mapa de sombras a cada N quadros. */
  shadowEvery: number;
  far: number;
  fog: number;
  stars: number;
  envIntensity: number;
  /** Lado do mapa de reflexos (px). */
  envSize: number;
  /** Até que distância da câmera (m) carros e voadores usam o modelo detalhado. */
  carLod: number;
  airLod: number;
  /** Filtragem anisotrópica das texturas (nitidez do chão e das fachadas vistos de lado). */
  anisotropy: number;
  /** Densidade da névoa exponencial (profundidade atmosférica). */
  fogDensity: number;
  /** Brilho das luzes (bloom); null = desenho direto, sem pós-processamento. */
  bloom: BloomSettings | null;
  /** Poças de luz no chão (postes, entradas, faróis). */
  lightPools: boolean;
}

/**
 * O que cada nível de qualidade muda de verdade na cena (não é só um rótulo):
 * resolução, antisserrilhado, sombras (tamanho, alcance e frequência),
 * distância visível, densidade de prédios e detalhes de fachada, quantidade de
 * carros e de voadores, distância do nível de detalhe, reflexos e filtragem.
 * O Ultra é para placas de vídeo fortes: pode desenhar acima da resolução da
 * tela (até 2×, um superamostrador) e só chega lá se o aparelho aguentar.
 */
export const QUALITY_CONFIG: Record<Quality, QualitySettings> = {
  low: { dprMin: 0.6, dprMax: 1, antialias: false, shadows: 0, shadowRange: 0, shadowEvery: 1, far: 300, fog: 280, stars: 400, envIntensity: 1.25, envSize: 64, carLod: 28, airLod: 40, anisotropy: 1, fogDensity: 0.0042, bloom: null, lightPools: false },
  medium: { dprMin: 0.7, dprMax: 1.25, antialias: true, shadows: 1024, shadowRange: 70, shadowEvery: 2, far: 420, fog: 380, stars: 800, envIntensity: 1.4, envSize: 128, carLod: 45, airLod: 60, anisotropy: 4, fogDensity: 0.0032, bloom: { strength: 0.55, threshold: 1.3, knee: 0.4, levels: 4 }, lightPools: true },
  high: { dprMin: 0.8, dprMax: 1.75, antialias: true, shadows: 2048, shadowRange: 95, shadowEvery: 1, far: 600, fog: 520, stars: 1400, envIntensity: 1.5, envSize: 256, carLod: 70, airLod: 90, anisotropy: 8, fogDensity: 0.0027, bloom: { strength: 0.65, threshold: 1.3, knee: 0.45, levels: 5 }, lightPools: true },
  ultra: { dprMin: 1, dprMax: 2, antialias: true, shadows: 4096, shadowRange: 130, shadowEvery: 1, far: 750, fog: 650, stars: 2000, envIntensity: 1.55, envSize: 256, carLod: 110, airLod: 140, anisotropy: 16, fogDensity: 0.0023, bloom: { strength: 0.7, threshold: 1.25, knee: 0.45, levels: 6 }, lightPools: true },
};
