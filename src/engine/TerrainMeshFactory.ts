import * as THREE from 'three';
import { TerrainType } from '../game/TerrainType';
import type { HexTile } from '../game/HexGrid';
import { HEX_SIZE } from '../game/HexGrid';
import { getTerrainColor } from './TerrainColors';
import { createRng } from '../game/noise';
import { assetLoader } from './AssetLoader';

/**
 * Creates 3D meshes for terrain using Blender GLTF models.
 * Models are cloned from the AssetLoader cache per tile.
 */

/** Water material (shared, transparent) */
const waterMaterial = new THREE.MeshLambertMaterial({
  color: 0x40e0d0,
  transparent: true,
  opacity: 0.8,
});

/** Create a hex ground tile mesh from the loaded GLTF model */
export function createHexTileMesh(tile: HexTile): THREE.Group {
  const color = getTerrainColor(tile.terrain, tile.coord.q, tile.coord.r);
  const group = assetLoader.getModel('hex_tile');

  // Apply terrain color to all meshes in the model
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (tile.terrain === TerrainType.Water) {
        child.material = waterMaterial.clone();
        child.material.side = THREE.DoubleSide;
      } else {
        child.material = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
      }
    }
  });

  // GLTF export converts Blender Z-up → Y-up, so hex arrives in XZ plane already.
  // No rotation needed.
  return group;
}

/** Create decoration group for a tile */
export function createDecorations(tile: HexTile): THREE.Group | null {
  switch (tile.terrain) {
    case TerrainType.Forest:
      return createForestDecorations(tile);
    case TerrainType.Mountain:
      return createMountainDecorations(tile);
    case TerrainType.Desert:
      return createDesertDecorations(tile);
    case TerrainType.Grassland:
      return createGrasslandDecorations(tile);
    default:
      return null;
  }
}

function createForestDecorations(tile: HexTile): THREE.Group {
  const group = new THREE.Group();
  const rng = createRng(tile.coord.q * 1000 + tile.coord.r);
  const treeCount = 2 + Math.floor(rng() * 3); // 2-4 trees

  for (let i = 0; i < treeCount; i++) {
    const isConifer = rng() > 0.5;
    const tree = assetLoader.getModel(isConifer ? 'tree_conifer' : 'tree_deciduous');

    // Slight scale variation
    const scale = 0.8 + rng() * 0.4;
    tree.scale.setScalar(scale);

    // Random rotation
    tree.rotation.y = rng() * Math.PI * 2;

    // Position within hex
    const angle = rng() * Math.PI * 2;
    const dist = rng() * HEX_SIZE * 0.55;
    tree.position.x = Math.cos(angle) * dist;
    tree.position.z = Math.sin(angle) * dist;

    group.add(tree);
  }

  return group;
}

function createMountainDecorations(tile: HexTile): THREE.Group {
  const group = new THREE.Group();
  const rng = createRng(tile.coord.q * 2000 + tile.coord.r);

  // Main peak
  const peak = assetLoader.getModel('mountain_peak');
  const peakScale = 0.7 + tile.elevation * 0.6;
  peak.scale.set(peakScale, peakScale, peakScale);
  // Slight random tilt for variety
  peak.rotation.y = rng() * Math.PI * 2;

  // Tint the peak (grey variation)
  const greyVal = 0.4 + rng() * 0.3;
  peak.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = new THREE.MeshLambertMaterial({
        color: new THREE.Color(greyVal, greyVal, greyVal),
      });
    }
  });
  group.add(peak);

  // Optional snow cap
  if (tile.elevation > 0.7) {
    const snowCap = assetLoader.getModel('snow_cap');
    const peakHeight = 0.4 + tile.elevation * 0.4;
    snowCap.position.y = peakHeight + 0.05;
    snowCap.scale.setScalar(peakScale * 0.8);
    group.add(snowCap);
  }

  // Boulders
  const boulderCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < boulderCount; i++) {
    const boulder = assetLoader.getModel('boulder');
    const angle = rng() * Math.PI * 2;
    const dist = 0.3 + rng() * 0.3;
    boulder.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    boulder.rotation.y = rng() * Math.PI;
    const bScale = 0.7 + rng() * 0.6;
    boulder.scale.setScalar(bScale);
    group.add(boulder);
  }

  return group;
}

function createDesertDecorations(tile: HexTile): THREE.Group {
  const group = new THREE.Group();
  const rng = createRng(tile.coord.q * 3000 + tile.coord.r);

  // Dune
  if (rng() > 0.4) {
    const dune = assetLoader.getModel('dune');
    const dScale = 0.8 + rng() * 0.5;
    dune.scale.set(dScale * (1 + rng() * 0.3), dScale * (0.5 + rng() * 0.3), dScale * (0.8 + rng() * 0.3));
    dune.position.set((rng() - 0.5) * 0.3, 0, (rng() - 0.5) * 0.3);
    dune.rotation.y = rng() * Math.PI * 2;
    group.add(dune);
  }

  // Occasional cactus
  if (rng() > 0.65) {
    const cactus = assetLoader.getModel('cactus');
    const angle = rng() * Math.PI * 2;
    const dist = rng() * 0.4;
    cactus.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    cactus.rotation.y = rng() * Math.PI * 2;
    const cScale = 0.8 + rng() * 0.4;
    cactus.scale.setScalar(cScale);
    group.add(cactus);
  }

  return group;
}

function createGrasslandDecorations(tile: HexTile): THREE.Group | null {
  const rng = createRng(tile.coord.q * 4000 + tile.coord.r);

  // Only occasionally add rocks or bushes (sparse)
  if (rng() > 0.2) return null;

  const group = new THREE.Group();

  if (rng() > 0.5) {
    // Small rock
    const rock = assetLoader.getModel('rock_small');
    rock.position.set((rng() - 0.5) * 0.5, 0, (rng() - 0.5) * 0.5);
    rock.rotation.y = rng() * Math.PI;
    const rScale = 0.7 + rng() * 0.6;
    rock.scale.setScalar(rScale);
    group.add(rock);
  } else {
    // Small bush
    const bush = assetLoader.getModel('bush');
    bush.position.set((rng() - 0.5) * 0.5, 0, (rng() - 0.5) * 0.5);
    const bScale = 0.8 + rng() * 0.4;
    bush.scale.setScalar(bScale);
    group.add(bush);
  }

  return group;
}
