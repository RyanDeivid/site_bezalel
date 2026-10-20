import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * O mesmo mapa de ambiente, para quem prepara a cena antes do primeiro quadro
 * (o Warmup do Universe). Gerar o PMREM em si custa ~4 ms; o que pesa é
 * compilar o shader do filtro GGX (256 amostras), que o three faz de forma
 * síncrona: ~1,5 s num Intel Iris Xe com o cache de shaders frio, quase nada
 * nas visitas seguintes (o navegador guarda os shaders compilados). Por isso
 * roda sob a tela de carregamento, depois de ela pintar, e antes de compilar o
 * resto da cena — o mapa muda os shaders de todos os materiais.
 */
export async function createEnvironmentAsync(gl: THREE.WebGLRenderer, { size = 256, blur = 0.04 }: { size?: number; blur?: number } = {}): Promise<THREE.Texture> {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  const pmrem = new THREE.PMREMGenerator(gl);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, blur, 0.1, 100, { size }).texture;
  room.dispose();
  pmrem.dispose();
  return env;
}
