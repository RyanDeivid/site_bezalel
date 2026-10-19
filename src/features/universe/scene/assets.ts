import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { facadeTextures, intersectionTexture, stonePanelTexture, storefrontTextures, layersTexture, padTexture, PALETTE, paverTexture, plazaTexture, roadTexture, skyTexture } from './textures';

import type { Quality } from '../world/city';

export type { Quality };

/**
 * Materiais e texturas da cidade, criados uma vez por nível de qualidade e
 * compartilhados por todos os objetos (poucos materiais = menos trocas de
 * estado na GPU). Tudo é descartado ao sair da cena ou trocar a qualidade.
 */
export function createUniverseAssets(quality: Quality) {
  // Médio e alto usam texturas maiores; o alto, as maiores de todas.
  const hi = quality !== 'low';
  const tex = quality === 'high' ? 1024 : 512;
  const facadeA = facadeTextures(hi ? 512 : 256, 11, 0.8);
  const facadeB = facadeTextures(hi ? 512 : 256, 29, 0.55);
  const facadeC = facadeTextures(hi ? 512 : 256, 43, 0.92);
  const facadeDark = facadeTextures(hi ? 512 : 256, 71, 0.4);
  const facadeHq = facadeTextures(hi ? 512 : 256, 5, 0.9);
  const textures = {
    road: roadTexture(hi ? 512 : 256),
    intersection: intersectionTexture(hi ? 512 : 256),
    plaza: plazaTexture(tex),
    sidewalk: paverTexture(hi ? 256 : 128, PALETTE.sidewalk, 'rgba(8,14,24,0.5)', 4),
    corner: paverTexture(hi ? 256 : 128, '#172238', 'rgba(8,14,24,0.6)', 3),
    pad: padTexture(hi ? 512 : 256),
    sky: skyTexture(),
    layers: layersTexture(256),
    facadeA,
    facadeB,
    facadeC,
    facadeDark,
    facadeHq,
    storefront: storefrontTextures(hi ? 1024 : 512),
    stoneDark: stonePanelTexture(hi ? 512 : 256, PALETTE.surface, 'rgba(199,168,106,0.22)'),
    stoneLight: stonePanelTexture(hi ? 512 : 256, '#bfb49c', 'rgba(16,27,43,0.28)'),
  };
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  const basic = (color: string, extra: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });
  const facade = (f: { map: THREE.Texture; emissive: THREE.Texture }, tint = '#ffffff') =>
    std({ map: f.map, emissiveMap: f.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.1, color: tint, roughness: 0.35, metalness: 0.55, envMapIntensity: 0.9 });

  const materials = {
    ground: std({ color: '#0a111c', roughness: 0.95, metalness: 0 }),
    road: std({ map: textures.road, roughness: 0.82, metalness: 0.05 }),
    intersection: std({ map: textures.intersection, roughness: 0.82, metalness: 0.05 }),
    sidewalk: std({ map: textures.sidewalk, roughness: 0.75, metalness: 0.05 }),
    corner: std({ map: textures.corner, roughness: 0.8, metalness: 0.05 }),
    lawn: std({ color: '#10262a', roughness: 0.95, metalness: 0 }),
    plaza: std({ map: textures.plaza, roughness: 0.55, metalness: 0.12, envMapIntensity: 0.5 }),
    path: std({ color: '#2b3753', roughness: 0.6, metalness: 0.1 }),
    water: std({ color: '#0a1830', roughness: 0.06, metalness: 0.9, envMapIntensity: 1.4 }),
    stone: std({ color: PALETTE.surface, roughness: 0.6, metalness: 0.25 }),
    stoneLight: std({ color: '#c3b9a3', roughness: 0.55, metalness: 0.1 }),
    podiumDark: std({ map: textures.stoneDark, roughness: 0.55, metalness: 0.3 }),
    podiumLight: std({ map: textures.stoneLight, roughness: 0.6, metalness: 0.1 }),
    storefront: std({ map: textures.storefront.map, emissiveMap: textures.storefront.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.5, roughness: 0.12, metalness: 0.6, envMapIntensity: 1.2 }),
    steel: std({ color: PALETTE.steel, roughness: 0.32, metalness: 0.75 }),
    steelLight: std({ color: '#2b4466', roughness: 0.28, metalness: 0.8 }),
    bronze: std({ color: '#8a7448', roughness: 0.32, metalness: 0.85 }),
    gold: std({ color: PALETTE.gold, roughness: 0.22, metalness: 1, envMapIntensity: 1.2 }),
    pearl: std({ color: '#ebe4d6', roughness: 0.22, metalness: 0.55, envMapIntensity: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: '#6f95c9', transparent: true, opacity: 0.24, roughness: 0.04, metalness: 0.2, envMapIntensity: 1.5, depthWrite: false, side: THREE.DoubleSide }),
    darkGlass: std({ color: '#0b1526', roughness: 0.08, metalness: 0.85, envMapIntensity: 1.3 }),
    layers: std({ map: textures.layers, roughness: 0.4, metalness: 0.2 }),
    foliage: std({ color: '#24463f', roughness: 0.85, metalness: 0, flatShading: true }),
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
    pad: new THREE.MeshBasicMaterial({ map: textures.pad, transparent: true, toneMapped: false, depthWrite: false }),
    sky: new THREE.MeshBasicMaterial({ map: textures.sky, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false }),
    glowGold: basic(PALETTE.gold),
    glowGoldSoft: basic(PALETTE.goldLight, { transparent: true, opacity: 0.85 }),
    glowIvory: basic(PALETTE.ivory),
    glowBlue: basic(PALETTE.blueSoft),
    glowWarm: basic('#ffe2b0'),
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

export function useUniverseAssets(quality: Quality): UniverseAssets {
  const assets = useMemo(() => createUniverseAssets(quality), [quality]);
  useEffect(() => () => assets.dispose(), [assets]);
  return assets;
}
