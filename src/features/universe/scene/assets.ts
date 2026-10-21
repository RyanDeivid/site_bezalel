import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { facadeSystem, facadeTextures, intersectionTexture, lobbyTexture, washTexture, stonePanelTexture, storefrontTextures, layersTexture, padTexture, PALETTE, paverTexture, plazaTexture, roadTexture } from './textures';

import { atLeast, type Quality } from '../world/city';

export type { Quality };

/**
 * Materiais e texturas da cidade, criados uma vez por nível de qualidade e
 * compartilhados por todos os objetos (poucos materiais = menos trocas de
 * estado na GPU). Tudo é descartado ao sair da cena ou trocar a qualidade.
 */
export function createUniverseAssets(quality: Quality, anisotropy = 1) {
  // Médio, alto e ultra usam texturas maiores; alto e ultra, as maiores de todas.
  const hi = quality !== 'low';
  const tex = atLeast(quality, 'high') ? 1024 : 512;
  const facadeA = facadeTextures(hi ? 512 : 256, 11, 0.8);
  const facadeB = facadeTextures(hi ? 512 : 256, 29, 0.55);
  const facadeC = facadeTextures(hi ? 512 : 256, 43, 0.92);
  const facadeDark = facadeTextures(hi ? 512 : 256, 71, 0.4);
  const facadeHq = facadeTextures(hi ? 512 : 256, 5, 0.9);
  const fs = hi ? 512 : 256;
  const textures = {
    road: roadTexture(hi ? 512 : 256),
    intersection: intersectionTexture(hi ? 512 : 256),
    plaza: plazaTexture(tex),
    sidewalk: paverTexture(hi ? 256 : 128, PALETTE.sidewalk, 'rgba(18,20,24,0.45)', 4),
    corner: paverTexture(hi ? 256 : 128, '#3d4048', 'rgba(14,16,20,0.55)', 3),
    pad: padTexture(hi ? 512 : 256),
    layers: layersTexture(256),
    facadeA,
    facadeB,
    facadeC,
    facadeDark,
    facadeHq,
    glassBlue: facadeSystem('glassBlue', fs, 101),
    glassBronze: facadeSystem('glassBronze', fs, 211),
    whiteConcrete: facadeSystem('whiteConcrete', fs, 307),
    charcoal: facadeSystem('charcoal', fs, 401),
    metalPanel: facadeSystem('metalPanel', fs, 503),
    darkGlass: facadeSystem('darkGlass', fs, 601),
    champagne: facadeSystem('champagne', fs, 709),
    lobby: lobbyTexture(hi ? 1024 : 512),
    wash: washTexture(64),
    storefront: storefrontTextures(hi ? 1024 : 512),
    stoneDark: stonePanelTexture(hi ? 512 : 256, PALETTE.surface, 'rgba(199,168,106,0.22)'),
    stoneLight: stonePanelTexture(hi ? 512 : 256, '#bfb49c', 'rgba(16,27,43,0.28)'),
  };
  // Filtragem anisotrópica: chão, ruas e fachadas continuam nítidos vistos de lado (custo pequeno na GPU).
  for (const t of Object.values(textures).flatMap((v) => (v instanceof THREE.Texture ? [v] : Object.values(v as Record<string, THREE.Texture>))))
    if (t instanceof THREE.Texture) t.anisotropy = anisotropy;
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  const basic = (color: string, extra: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });
  const facade = (f: { map: THREE.Texture; emissive: THREE.Texture }, tint = '#ffffff') =>
    std({ map: f.map, emissiveMap: f.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.1, color: tint, roughness: 0.35, metalness: 0.55, envMapIntensity: 0.9 });

  const materials = {
    ground: std({ color: '#1d1f24', roughness: 0.95, metalness: 0 }),
    road: std({ map: textures.road, roughness: 0.78, metalness: 0.02 }),
    intersection: std({ map: textures.intersection, roughness: 0.78, metalness: 0.02 }),
    sidewalk: std({ map: textures.sidewalk, roughness: 0.75, metalness: 0.05 }),
    corner: std({ map: textures.corner, roughness: 0.8, metalness: 0.05 }),
    lawn: std({ color: '#203a32', roughness: 0.95, metalness: 0 }),
    plaza: std({ map: textures.plaza, roughness: 0.55, metalness: 0.12, envMapIntensity: 0.5 }),
    path: std({ color: '#4c505b', roughness: 0.6, metalness: 0.05 }),
    water: std({ color: '#0a1830', roughness: 0.06, metalness: 0.9, envMapIntensity: 1.4 }),
    stone: std({ color: PALETTE.surface, roughness: 0.6, metalness: 0.25 }),
    stoneLight: std({ color: '#c3b9a3', roughness: 0.55, metalness: 0.1 }),
    podiumDark: std({ map: textures.stoneDark, roughness: 0.55, metalness: 0.3 }),
    podiumLight: std({ map: textures.stoneLight, roughness: 0.6, metalness: 0.1 }),
    storefront: std({ map: textures.storefront.map, emissiveMap: textures.storefront.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1, roughness: 0.12, metalness: 0.6, envMapIntensity: 1.2 }),
    steel: std({ color: PALETTE.steel, roughness: 0.32, metalness: 0.75 }),
    steelLight: std({ color: '#2b4466', roughness: 0.28, metalness: 0.8 }),
    bronze: std({ color: '#8a7448', roughness: 0.32, metalness: 0.85 }),
    gold: std({ color: PALETTE.gold, roughness: 0.22, metalness: 1, envMapIntensity: 1.2 }),
    pearl: std({ color: '#ebe4d6', roughness: 0.22, metalness: 0.55, envMapIntensity: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: '#6f95c9', transparent: true, opacity: 0.24, roughness: 0.04, metalness: 0.2, envMapIntensity: 1.5, depthWrite: false, side: THREE.DoubleSide }),
    darkGlass: std({ color: '#0b1526', roughness: 0.08, metalness: 0.85, envMapIntensity: 1.3 }),
    layers: std({ map: textures.layers, roughness: 0.4, metalness: 0.2 }),
    // Estacionamentos do parque de chegada: asfalto liso, faixas brancas e a baia dourada do táxi.
    lot: std({ color: '#2b2d32', roughness: 0.88, metalness: 0 }),
    paint: std({ color: '#d9d6cc', roughness: 0.7, metalness: 0 }),
    paintGold: std({ color: PALETTE.gold, roughness: 0.5, metalness: 0.2, emissive: new THREE.Color(PALETTE.gold), emissiveIntensity: 0.18 }),
    // Copas com a cor nos vértices (mais escuras embaixo, mais claras no alto).
    foliage: (() => {
      // Vento: as copas balançam devagar, cada árvore no seu tempo (fase pela posição), mais no alto da copa.
      const mat = std({ vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.4 });
      const uTime = { value: 0 };
      mat.userData.uTime = uTime;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = uTime;
        shader.vertexShader = `uniform float uTime;
${shader.vertexShader}`.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
          vec2 treePos = instanceMatrix[3].xz;
          #else
          vec2 treePos = vec2(0.0);
          #endif
          float sway = sin(uTime * 1.1 + treePos.x * 0.35 + treePos.y * 0.21) * 0.045 + sin(uTime * 2.3 + treePos.x * 0.9) * 0.015;
          float reach = clamp(position.y + 1.2, 0.0, 4.0);
          transformed.x += sway * reach;
          transformed.z += sway * 0.6 * reach;`,
        );
      };
      mat.customProgramCacheKey = () => 'foliage-wind';
      return mat;
    })(),
    trunk: std({ color: '#2a2622', roughness: 0.9, metalness: 0 }),
    facadeA: facade(facadeA),
    facadeB: facade(facadeB, '#d8dde6'),
    // Residencial: caixilhos claros, luz quente.
    facadeC: facade(facadeC, '#efe3cc'),
    // Corporativa: vidro escuro espelhado, poucas janelas acesas.
    facadeDark: (() => {
      const mat = facade(facadeDark, '#7f93b3');
      mat.roughness = 0.12;
      mat.metalness = 0.85;
      mat.emissiveIntensity = 0.75;
      return mat;
    })(),
    facadeHq: facade(facadeHq),
    // Torres da cidade: um material por sistema de fachada (o vidro reflete a noite; o concreto e a pedra, não).
    towerGlassBlue: std({ map: textures.glassBlue.map, emissiveMap: textures.glassBlue.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.5, roughness: 0.1, metalness: 0.85, envMapIntensity: 1.25 }),
    towerGlassBronze: std({ map: textures.glassBronze.map, emissiveMap: textures.glassBronze.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.5, roughness: 0.14, metalness: 0.85, envMapIntensity: 1.2 }),
    towerDarkGlass: std({ map: textures.darkGlass.map, emissiveMap: textures.darkGlass.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.3, roughness: 0.06, metalness: 0.9, envMapIntensity: 1.35 }),
    towerWhite: std({ map: textures.whiteConcrete.map, emissiveMap: textures.whiteConcrete.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.4, roughness: 0.82, metalness: 0, envMapIntensity: 0.4 }),
    towerCharcoal: std({ map: textures.charcoal.map, emissiveMap: textures.charcoal.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.5, roughness: 0.6, metalness: 0.15, envMapIntensity: 0.8 }),
    towerMetal: std({ map: textures.metalPanel.map, emissiveMap: textures.metalPanel.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.4, roughness: 0.38, metalness: 0.65, envMapIntensity: 1 }),
    // Sede: vidro champanhe (o único da cidade), saguão aceso e os refletores que lavam o pódio.
    towerChampagne: std({ map: textures.champagne.map, emissiveMap: textures.champagne.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.6, roughness: 0.12, metalness: 0.8, envMapIntensity: 1.3 }),
    lobby: std({ map: textures.lobby.map, emissiveMap: textures.lobby.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.85, roughness: 0.08, metalness: 0.5, envMapIntensity: 0.8 }),
    wash: new THREE.MeshBasicMaterial({ map: textures.wash, color: new THREE.Color(1, 0.74, 0.46).multiplyScalar(0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    // Acabamentos com a cor no vértice: aletas e caixilhos (metal), lajes e coberturas (fosco), LEDs e coroas (luz).
    trimMetal: std({ vertexColors: true, roughness: 0.35, metalness: 0.8, envMapIntensity: 1.1 }),
    trimMatte: std({ vertexColors: true, roughness: 0.85, metalness: 0, envMapIntensity: 0.5 }),
    trimGlow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    pad: new THREE.MeshBasicMaterial({ map: textures.pad, transparent: true, toneMapped: false, depthWrite: false }),
    glowGold: basic(PALETTE.gold),
    glowGoldSoft: basic(PALETTE.goldLight, { transparent: true, opacity: 0.85 }),
    glowIvory: basic(PALETTE.ivory),
    glowBlue: basic(PALETTE.blueSoft),
    // Luminárias acima de 1 (HDR): com o brilho ligado, os postes acendem de verdade.
    glowWarm: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2b0').multiplyScalar(3), toneMapped: false }),
    glowBrake: basic(PALETTE.brake),
    beam: basic(PALETTE.gold, { transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    shadowBlob: new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.4, depthWrite: false }),
  };
  return {
    quality,
    textures,
    materials,
    dispose() {
      Object.values(materials).forEach((m) => m.dispose());
      for (const t of Object.values(textures)) {
        if (t instanceof THREE.Texture) t.dispose();
        else {
          t.map.dispose();
          t.emissive.dispose();
        }
      }
    },
  };
}

export type UniverseAssets = ReturnType<typeof createUniverseAssets>;

export function useUniverseAssets(quality: Quality, anisotropy = 1): UniverseAssets {
  const assets = useMemo(() => createUniverseAssets(quality, anisotropy), [quality, anisotropy]);
  useEffect(() => () => assets.dispose(), [assets]);
  return assets;
}
