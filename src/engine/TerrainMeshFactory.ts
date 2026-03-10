import * as THREE from 'three';
import { TerrainType } from '../game/TerrainType';
import type { HexTile } from '../game/HexGrid';
import { HEX_SIZE } from '../game/HexGrid';
import { getTerrainColor } from './TerrainColors';
import { createRng } from '../game/noise';
import { assetLoader } from './AssetLoader';
import { createWaterMaterial, registerWaterMaterial } from './WaterShader';

/**
 * Creates 3D meshes for terrain using Blender GLTF models.
 * Models are cloned from the AssetLoader cache per tile.
 */

/** Create a hex ground tile mesh from the loaded GLTF model */
export function createHexTileMesh(tile: HexTile): THREE.Group {
  const color = getTerrainColor(tile.terrain, tile.coord.q, tile.coord.r);
  const group = assetLoader.getModel('hex_tile');
  const isWater = tile.terrain === TerrainType.Water;

  // Single-material hex tile — set color on all faces
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (isWater) {
        const waterMat = createWaterMaterial();
        registerWaterMaterial(waterMat);
        child.material = waterMat;
      } else {
        child.material = new THREE.MeshLambertMaterial({
          color,
          side: THREE.DoubleSide,
        });
      }
    }
  });

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
    case TerrainType.Water:
      return createWaterDecorations(tile);
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

  // Use snow variant for high-elevation mountains
  const modelName = tile.elevation > 0.7 ? 'mountain_peak_snow' : 'mountain_peak';
  const peak = assetLoader.getModel(modelName);
  const peakScale = 0.7 + tile.elevation * 0.6;
  peak.scale.setScalar(peakScale);
  peak.rotation.y = rng() * Math.PI * 2;
  group.add(peak);

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

  // Dune (60% chance)
  if (rng() > 0.4) {
    const dune = assetLoader.getModel('dune');
    const dScale = 0.8 + rng() * 0.5;
    dune.scale.set(dScale * (1 + rng() * 0.3), dScale * (0.5 + rng() * 0.3), dScale * (0.8 + rng() * 0.3));
    dune.position.set((rng() - 0.5) * 0.3, 0, (rng() - 0.5) * 0.3);
    dune.rotation.y = rng() * Math.PI * 2;
    group.add(dune);
  }

  // Occasional cactus (35% chance)
  if (rng() > 0.65) {
    const cactus = assetLoader.getModel('cactus');
    const angle = rng() * Math.PI * 2;
    const dist = rng() * 0.4;
    cactus.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    cactus.rotation.y = rng() * Math.PI * 2;
    const cScale = 1.5 + rng() * 0.7;
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
    const rScale = 1.2 + rng() * 0.8;
    rock.scale.setScalar(rScale);
    group.add(rock);
  } else {
    // Small bush
    const bush = assetLoader.getModel('bush');
    bush.position.set((rng() - 0.5) * 0.5, 0, (rng() - 0.5) * 0.5);
    const bScale = 1.4 + rng() * 0.6;
    bush.scale.setScalar(bScale);
    group.add(bush);
  }

  return group;
}

function createWaterDecorations(tile: HexTile): THREE.Group | null {
  const rng = createRng(tile.coord.q * 5000 + tile.coord.r);

  // 40% of water tiles get wave decorations
  if (rng() > 0.4) return null;

  const waves = assetLoader.getModel('water_waves');
  waves.rotation.y = rng() * Math.PI * 2;
  const wScale = 0.7 + rng() * 0.4;
  waves.scale.setScalar(wScale);
  waves.position.y = 0.03; // slightly above tile surface

  // Make wave materials transparent
  waves.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mat = child.material as THREE.MeshStandardMaterial;
      if (mat.color) {
        const isLight = mat.color.r > 0.7; // foam spots
        child.material = new THREE.MeshLambertMaterial({
          color: isLight ? 0xd8f0ff : 0x60c8d8,
          transparent: true,
          opacity: isLight ? 0.5 : 0.35,
          side: THREE.DoubleSide,
        });
      }
    }
  });

  return waves;
}
