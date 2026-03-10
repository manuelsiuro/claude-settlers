import * as THREE from 'three';
import { TerrainType } from '../game/TerrainType';
import type { HexTile } from '../game/HexGrid';
import { HEX_SIZE } from '../game/HexGrid';
import { getTerrainColor } from './TerrainColors';
import { createRng } from '../game/noise';

/**
 * Creates 3D meshes for terrain decorations per docs/terrains.md.
 * Uses basic Three.js geometries only.
 */

// Shared geometries (reused across tiles for performance)
const hexShape = createHexShape(HEX_SIZE);
const hexGeometry = new THREE.ShapeGeometry(hexShape);

// Tree geometries
const trunkGeometry = new THREE.CylinderGeometry(0.04, 0.06, 0.4, 6);
const canopyGeometry = new THREE.SphereGeometry(0.18, 6, 4);
const coniferGeometry = new THREE.ConeGeometry(0.15, 0.45, 6);

// Mountain geometries
const peakGeometry = new THREE.ConeGeometry(0.25, 0.6, 5);
const boulderGeometry = new THREE.BoxGeometry(0.12, 0.1, 0.12);

// Desert geometries
const cactusBodyGeometry = new THREE.CylinderGeometry(0.03, 0.04, 0.3, 5);
const cactusArmGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.12, 4);
const duneGeometry = new THREE.SphereGeometry(0.3, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);

// Shared materials
const waterMaterial = new THREE.MeshLambertMaterial({
  color: 0x40e0d0,
  transparent: true,
  opacity: 0.8,
});

function createHexShape(size: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    // Flat-top hex: first vertex at 0°
    const angle = (Math.PI / 3) * i;
    const x = size * Math.cos(angle);
    const y = size * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

/** Create a hex ground tile mesh */
export function createHexTileMesh(tile: HexTile): THREE.Mesh {
  const color = getTerrainColor(tile.terrain, tile.coord.q, tile.coord.r);
  const material = tile.terrain === TerrainType.Water
    ? waterMaterial
    : new THREE.MeshLambertMaterial({ color });

  const mesh = new THREE.Mesh(hexGeometry, material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
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
    const tree = new THREE.Group();
    const isConifer = rng() > 0.5;

    // Trunk
    const trunkMaterial = new THREE.MeshLambertMaterial({
      color: rng() > 0.5 ? 0x8b4513 : 0xa0522d,
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 0.2;
    tree.add(trunk);

    // Canopy
    if (isConifer) {
      const coniferMaterial = new THREE.MeshLambertMaterial({ color: 0x013220 });
      const canopy = new THREE.Mesh(coniferGeometry, coniferMaterial);
      canopy.position.y = 0.55;
      tree.add(canopy);
    } else {
      const canopyMaterial = new THREE.MeshLambertMaterial({
        color: rng() > 0.5 ? 0x2e8b57 : 0x008000,
      });
      const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
      canopy.position.y = 0.5;
      tree.add(canopy);
    }

    // Position within hex (keep inside radius)
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
  const peakMaterial = new THREE.MeshLambertMaterial({
    color: rng() > 0.5 ? 0x808080 : 0xa9a9a9,
  });
  const peak = new THREE.Mesh(peakGeometry, peakMaterial);
  const peakHeight = 0.4 + tile.elevation * 0.4;
  peak.position.y = peakHeight / 2;
  peak.scale.y = peakHeight / 0.6;
  group.add(peak);

  // Optional snow cap
  if (tile.elevation > 0.7) {
    const snowMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const snowCap = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.15, 5),
      snowMaterial
    );
    snowCap.position.y = peakHeight + 0.05;
    group.add(snowCap);
  }

  // Boulders
  const boulderCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < boulderCount; i++) {
    const boulderMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });
    const boulder = new THREE.Mesh(boulderGeometry, boulderMaterial);
    const angle = rng() * Math.PI * 2;
    const dist = 0.3 + rng() * 0.3;
    boulder.position.set(Math.cos(angle) * dist, 0.05, Math.sin(angle) * dist);
    boulder.rotation.y = rng() * Math.PI;
    group.add(boulder);
  }

  return group;
}

function createDesertDecorations(tile: HexTile): THREE.Group {
  const group = new THREE.Group();
  const rng = createRng(tile.coord.q * 3000 + tile.coord.r);

  // Dune
  if (rng() > 0.4) {
    const duneMaterial = new THREE.MeshLambertMaterial({ color: 0xe4a672 });
    const dune = new THREE.Mesh(duneGeometry, duneMaterial);
    dune.scale.set(1 + rng() * 0.5, 0.3 + rng() * 0.2, 0.8 + rng() * 0.4);
    dune.position.set((rng() - 0.5) * 0.3, 0, (rng() - 0.5) * 0.3);
    group.add(dune);
  }

  // Occasional cactus
  if (rng() > 0.65) {
    const cactusMaterial = new THREE.MeshLambertMaterial({ color: 0x228b22 });
    const cactus = new THREE.Group();

    const body = new THREE.Mesh(cactusBodyGeometry, cactusMaterial);
    body.position.y = 0.15;
    cactus.add(body);

    // Arm
    const arm = new THREE.Mesh(cactusArmGeometry, cactusMaterial);
    arm.position.set(0.05, 0.2, 0);
    arm.rotation.z = -Math.PI / 4;
    cactus.add(arm);

    const angle = rng() * Math.PI * 2;
    const dist = rng() * 0.4;
    cactus.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
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
    const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });
    const rock = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.06, 0.08),
      rockMaterial
    );
    rock.position.set((rng() - 0.5) * 0.5, 0.03, (rng() - 0.5) * 0.5);
    rock.rotation.y = rng() * Math.PI;
    group.add(rock);
  } else {
    // Small bush
    const bushMaterial = new THREE.MeshLambertMaterial({ color: 0x006400 });
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 5, 3),
      bushMaterial
    );
    bush.position.set((rng() - 0.5) * 0.5, 0.06, (rng() - 0.5) * 0.5);
    group.add(bush);
  }

  return group;
}
