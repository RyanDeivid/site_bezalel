/// <reference lib="webworker" />
/**
 * Worker da rede de partículas: recebe o canvas (OffscreenCanvas) uma vez e
 * passa a desenhar fora da thread principal. A página só manda mensagens
 * curtas (tamanho, ponteiro, pausa, cores).
 */
import { ParticleEngine, type ParticleMessage } from './engine';

let engine: ParticleEngine | null = null;

self.onmessage = (e: MessageEvent<ParticleMessage>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    const ctx = msg.canvas?.getContext('2d');
    if (msg.canvas && ctx) engine = new ParticleEngine(msg.canvas, ctx, msg.options);
    return;
  }
  engine?.handle(msg);
  if (msg.type === 'destroy') {
    engine = null;
    self.close();
  }
};
