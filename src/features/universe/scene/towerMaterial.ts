import type * as THREE from 'three';
import type { UniverseAssets } from './assets';
import type { Slot } from './towerGeometry';

/** Material de cada parte das torres (e dos marcos montados do mesmo jeito). */
export function towerSlotMaterial(slot: Slot, assets: UniverseAssets): THREE.Material {
  const m = assets.materials;
  switch (slot) {
    case 'glassBlue':
      return m.towerGlassBlue;
    case 'glassBronze':
      return m.towerGlassBronze;
    case 'darkGlass':
      return m.towerDarkGlass;
    case 'whiteConcrete':
      return m.towerWhite;
    case 'charcoal':
      return m.towerCharcoal;
    case 'metalPanel':
      return m.towerMetal;
    case 'storefront':
      return m.storefront;
    case 'metal':
      return m.trimMetal;
    case 'matte':
      return m.trimMatte;
    case 'glow':
      return m.trimGlow;
  }
}
