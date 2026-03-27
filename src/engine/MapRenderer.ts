import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import type { HexTile } from '../game/HexGrid';
import { TerrainType } from '../game/TerrainType';
import { getTerrainColor } from './TerrainColors';
import { createRng } from '../game/noise';
import { assetLoader } from './AssetLoader';
import {
  FLOWER_PATCHES_MIN, FLOWER_PATCHES_MAX,
  FLOWER_PATCH_SCALE_MIN, FLOWER_PATCH_SCALE_MAX, FLOWER_PATCH_SPREAD,
} from '../game/data/balanceConstants';

/** Decoration placement data (no Three.js objects) */
interface DecorationPlacement {
  modelName: string;
  localX: number;
  localZ: number;
  localY: number;
  rotationY: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

/** Sub-mesh info extracted from a GLTF model Group */
interface SubMeshInfo {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  localMatrix: THREE.Matrix4;
}

/**
 * Renders a HexGrid as 3D terrain using InstancedMesh for performance.
 * Terrain tiles: 1 InstancedMesh per color group (+ 1 for water).
 * Decorations: 1 InstancedMesh per model sub-mesh type.
 */
export class MapRenderer {
  private instancedMeshes: THREE.InstancedMesh[] = [];
  /** Materials we created (and must dispose). Excludes shared materials from AssetLoader. */
  private ownedMaterials: THREE.Material[] = [];

  constructor() {
    // no-op
  }

  private scene: THREE.Scene | null = null;
  private grid: HexGrid | null = null;

  /** Build all instanced meshes for the grid and add to scene */
  render(grid: HexGrid, scene: THREE.Scene): void {
    this.dispose();
    this.scene = scene;
    this.grid = grid;

    const tiles = grid.getAllTiles();

    // Build terrain tile instances
    this.buildTerrainInstances(tiles, scene);

    // Build decoration instances
    this.buildDecorationInstances(tiles, scene);
  }

  /** Rebuild all terrain meshes (e.g., after terrain type changes) */
  rebuild(): void {
    if (this.scene && this.grid) {
      this.render(this.grid, this.scene);
    }
  }

  /** Compute Y offset for a tile based on terrain type and elevation */
  static getTileY(tile: HexTile): number {
    if (tile.terrain === TerrainType.Water) return -0.1;
    return tile.elevation * 0.2;
  }

  /** Compute the center of the map in world coordinates */
  getMapCenter(grid: HexGrid): THREE.Vector3 {
    const centerQ = grid.width / 2;
    const centerR = grid.height / 2;
    const { x, z } = HexGrid.hexToWorld(centerQ, centerR);
    return new THREE.Vector3(x, 0, z);
  }

  /** Extract geometry from the hex_tile GLTF model */
  private getHexGeometry(): THREE.BufferGeometry {
    const raw = assetLoader.getRawModel('hex_tile');
    if (!raw) throw new Error('hex_tile model not loaded');
    let geo: THREE.BufferGeometry | null = null;
    raw.traverse((child) => {
      if (!geo && child instanceof THREE.Mesh) {
        geo = child.geometry;
      }
    });
    if (!geo) throw new Error('hex_tile has no mesh geometry');
    return geo;
  }

  /** Extract sub-mesh info from a GLTF model Group */
  private getSubMeshes(modelName: string): SubMeshInfo[] {
    const model = assetLoader.getRawModel(modelName);
    if (!model) return [];
    model.updateWorldMatrix(true, true);
    const results: SubMeshInfo[] = [];
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        results.push({
          geometry: child.geometry,
          material: child.material as THREE.Material,
          localMatrix: child.matrixWorld.clone(),
        });
      }
    });
    return results;
  }

  // ── Terrain tiles ──────────────────────────────────────────────

  /** Compute ambient occlusion factor for a tile based on neighbor elevations.
   *  Lower tiles relative to neighbors get darkened (0.85–1.0). Baked at build time. */
  private computeAOFactor(tile: HexTile, grid: HexGrid): number {
    const neighbors = grid.getNeighbors(tile.coord.q, tile.coord.r);
    if (neighbors.length === 0) return 1.0;
    let sum = 0;
    for (const n of neighbors) sum += n.elevation;
    const avg = sum / neighbors.length;
    // clamp(0.85, 0.95 + (tileElev - avgNeighborElev) * 0.1, 1.0)
    const raw = 0.95 + (tile.elevation - avg) * 0.1;
    return Math.max(0.85, Math.min(1.0, raw));
  }

  private buildTerrainInstances(
    tiles: HexTile[],
    scene: THREE.Scene,
  ): void {
    const hexGeo = this.getHexGeometry();
    const grid = this.grid!;

    // Group non-water tiles by color, storing AO factor per instance
    const colorGroups = new Map<number, { x: number; y: number; z: number; ao: number }[]>();
    const waterEntries: { x: number; y: number; z: number }[] = [];

    for (const tile of tiles) {
      const { x, z } = HexGrid.hexToWorld(tile.coord.q, tile.coord.r);
      const y = MapRenderer.getTileY(tile);

      if (tile.terrain === TerrainType.Water) {
        waterEntries.push({ x, y, z });
      } else {
        const color = getTerrainColor(tile.terrain, tile.coord.q, tile.coord.r);
        let list = colorGroups.get(color);
        if (!list) {
          list = [];
          colorGroups.set(color, list);
        }
        const ao = this.computeAOFactor(tile, grid);
        list.push({ x, y, z, ao });
      }
    }

    const matrix = new THREE.Matrix4();
    const instanceColor = new THREE.Color();

    // Land tiles: 1 InstancedMesh per color, with per-instance AO darkening
    for (const [color, entries] of colorGroups) {
      const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
      this.ownedMaterials.push(mat);
      const mesh = new THREE.InstancedMesh(hexGeo, mat, entries.length);

      for (let i = 0; i < entries.length; i++) {
        matrix.identity().setPosition(entries[i].x, entries[i].y, entries[i].z);
        mesh.setMatrixAt(i, matrix);
        // Instance color acts as a multiplier on material color.
        // White (1,1,1) = no change; gray = darkened by AO factor.
        const ao = entries[i].ao;
        instanceColor.setRGB(ao, ao, ao);
        mesh.setColorAt(i, instanceColor);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.needsUpdate = true;
      this.computeInstancedBounds(mesh);
      scene.add(mesh);
      this.instancedMeshes.push(mesh);
    }

    // Water tiles: 1 InstancedMesh with flat blue material
    if (waterEntries.length > 0) {
      const waterMat = new THREE.MeshLambertMaterial({ color: 0x3399cc, transparent: true, opacity: 0.85 });
      this.ownedMaterials.push(waterMat);
      const waterMesh = new THREE.InstancedMesh(hexGeo, waterMat, waterEntries.length);

      for (let i = 0; i < waterEntries.length; i++) {
        matrix.identity().setPosition(waterEntries[i].x, waterEntries[i].y, waterEntries[i].z);
        waterMesh.setMatrixAt(i, matrix);
      }
      waterMesh.instanceMatrix.needsUpdate = true;
      this.computeInstancedBounds(waterMesh);
      scene.add(waterMesh);
      this.instancedMeshes.push(waterMesh);
    }
  }

  // ── Decorations ────────────────────────────────────────────────

  private buildDecorationInstances(
    tiles: HexTile[],
    scene: THREE.Scene,
  ): void {
    // Collect all decoration placements grouped by model name
    const placementsByModel = new Map<string, THREE.Matrix4[]>();

    for (const tile of tiles) {
      const placements = getDecorationPlacements(tile);
      if (placements.length === 0) continue;

      const { x, z } = HexGrid.hexToWorld(tile.coord.q, tile.coord.r);
      const y = MapRenderer.getTileY(tile);

      for (const p of placements) {
        const matrix = new THREE.Matrix4();
        const pos = new THREE.Vector3(x + p.localX, y + p.localY, z + p.localZ);
        const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.rotationY, 0));
        const scl = new THREE.Vector3(p.scaleX, p.scaleY, p.scaleZ);
        matrix.compose(pos, quat, scl);

        let list = placementsByModel.get(p.modelName);
        if (!list) {
          list = [];
          placementsByModel.set(p.modelName, list);
        }
        list.push(matrix);
      }
    }

    // Create InstancedMeshes for each model type
    const combinedMatrix = new THREE.Matrix4();

    for (const [modelName, instanceMatrices] of placementsByModel) {
      const subMeshes = this.getSubMeshes(modelName);
      if (subMeshes.length === 0) continue;

      for (const sub of subMeshes) {
        // Use original material from AssetLoader (shared, NOT owned by us)
        const mat = sub.material;

        const count = instanceMatrices.length;
        const instMesh = new THREE.InstancedMesh(sub.geometry, mat, count);

        for (let i = 0; i < count; i++) {
          combinedMatrix.multiplyMatrices(instanceMatrices[i], sub.localMatrix);
          instMesh.setMatrixAt(i, combinedMatrix);
        }
        instMesh.instanceMatrix.needsUpdate = true;
        this.computeInstancedBounds(instMesh);
        scene.add(instMesh);
        this.instancedMeshes.push(instMesh);
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────

  /** Compute bounding sphere that encompasses all instances for proper frustum culling */
  private computeInstancedBounds(mesh: THREE.InstancedMesh): void {
    if (!mesh.geometry.boundingSphere) {
      mesh.geometry.computeBoundingSphere();
    }
    const geoRadius = mesh.geometry.boundingSphere!.radius;

    const box = new THREE.Box3();
    const tempMatrix = new THREE.Matrix4();
    const tempPos = new THREE.Vector3();
    let maxScale = 1;

    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, tempMatrix);
      tempPos.setFromMatrixPosition(tempMatrix);
      box.expandByPoint(tempPos);

      // Extract max scale from matrix columns for correct radius
      const e = tempMatrix.elements;
      const sx = Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
      const sy = Math.sqrt(e[4] * e[4] + e[5] * e[5] + e[6] * e[6]);
      const sz = Math.sqrt(e[8] * e[8] + e[9] * e[9] + e[10] * e[10]);
      const s = Math.max(sx, sy, sz);
      if (s > maxScale) maxScale = s;
    }

    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    sphere.radius += geoRadius * maxScale;
    mesh.boundingSphere = sphere;
  }

  /** Enable or disable receiveShadow on all terrain InstancedMeshes */
  setReceiveShadow(enabled: boolean): void {
    for (const mesh of this.instancedMeshes) {
      mesh.receiveShadow = enabled;
    }
  }

  /** Clean up all meshes */
  dispose(): void {
    // Remove + dispose all InstancedMeshes (releases GPU instanceMatrix buffers)
    // Note: geometry and non-owned materials are shared from AssetLoader — do NOT dispose those
    for (const mesh of this.instancedMeshes) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    this.instancedMeshes = [];

    // Dispose only materials we created (NOT shared AssetLoader materials/geometries)
    for (const mat of this.ownedMaterials) {
      mat.dispose();
    }
    this.ownedMaterials = [];

  }
}

// ── Decoration placement data extraction ───────────────────────

function getDecorationPlacements(tile: HexTile): DecorationPlacement[] {
  switch (tile.terrain) {
    case TerrainType.Forest: return []; // Trees rendered by TreeRenderer
    case TerrainType.Mountain: return getMountainPlacements(tile);
    case TerrainType.Desert: return getDesertPlacements(tile);
    case TerrainType.Grassland: return getGrasslandPlacements(tile);
    case TerrainType.Water: return [];
    default: return [];
  }
}

function getMountainPlacements(tile: HexTile): DecorationPlacement[] {
  const placements: DecorationPlacement[] = [];
  const rng = createRng(tile.coord.q * 2000 + tile.coord.r);

  const modelName = tile.elevation > 0.7 ? 'mountain_peak_snow' : 'mountain_peak';
  const peakScale = 0.7 + tile.elevation * 0.6;
  placements.push({
    modelName,
    localX: 0, localZ: 0, localY: 0,
    rotationY: rng() * Math.PI * 2,
    scaleX: peakScale, scaleY: peakScale, scaleZ: peakScale,
  });

  const boulderCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < boulderCount; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 0.3 + rng() * 0.3;
    const bScale = 0.7 + rng() * 0.6;
    placements.push({
      modelName: 'boulder',
      localX: Math.cos(angle) * dist,
      localZ: Math.sin(angle) * dist,
      localY: 0,
      rotationY: rng() * Math.PI,
      scaleX: bScale, scaleY: bScale, scaleZ: bScale,
    });
  }
  return placements;
}

function getDesertPlacements(tile: HexTile): DecorationPlacement[] {
  const placements: DecorationPlacement[] = [];
  const rng = createRng(tile.coord.q * 3000 + tile.coord.r);

  if (rng() > 0.4) {
    const dScale = 0.8 + rng() * 0.5;
    placements.push({
      modelName: 'dune',
      localX: (rng() - 0.5) * 0.3,
      localZ: (rng() - 0.5) * 0.3,
      localY: 0,
      rotationY: rng() * Math.PI * 2,
      scaleX: dScale * (1 + rng() * 0.3),
      scaleY: dScale * (0.5 + rng() * 0.3),
      scaleZ: dScale * (0.8 + rng() * 0.3),
    });
  }

  if (rng() > 0.65) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * 0.4;
    const cScale = 0.5 + rng() * 0.4;
    placements.push({
      modelName: 'cactus',
      localX: Math.cos(angle) * dist,
      localZ: Math.sin(angle) * dist,
      localY: 0,
      rotationY: rng() * Math.PI * 2,
      scaleX: cScale, scaleY: cScale, scaleZ: cScale,
    });
  }
  return placements;
}

function getGrasslandPlacements(tile: HexTile): DecorationPlacement[] {
  const rng = createRng(tile.coord.q * 4000 + tile.coord.r);
  if (rng() > 0.2) return [];

  const roll = rng();
  if (roll > 0.65) {
    // Rock (35%)
    const rScale = 1.2 + rng() * 0.8;
    return [{
      modelName: 'rock_small',
      localX: (rng() - 0.5) * 0.5,
      localZ: (rng() - 0.5) * 0.5,
      localY: 0,
      rotationY: rng() * Math.PI,
      scaleX: rScale, scaleY: rScale, scaleZ: rScale,
    }];
  } else if (roll > 0.30) {
    // Bush (35%)
    const bScale = 1.4 + rng() * 0.6;
    return [{
      modelName: 'bush',
      localX: (rng() - 0.5) * 0.5,
      localZ: (rng() - 0.5) * 0.5,
      localY: 0,
      rotationY: 0,
      scaleX: bScale, scaleY: bScale, scaleZ: bScale,
    }];
  } else {
    // Flower patch — multiple instances for "field of flowers" look
    const placements: DecorationPlacement[] = [];
    const count = FLOWER_PATCHES_MIN + Math.floor(rng() * (FLOWER_PATCHES_MAX - FLOWER_PATCHES_MIN + 1));
    for (let i = 0; i < count; i++) {
      const fScale = FLOWER_PATCH_SCALE_MIN + rng() * (FLOWER_PATCH_SCALE_MAX - FLOWER_PATCH_SCALE_MIN);
      const angle = rng() * Math.PI * 2;
      const dist = rng() * FLOWER_PATCH_SPREAD;
      placements.push({
        modelName: 'flower_patch',
        localX: Math.cos(angle) * dist,
        localZ: Math.sin(angle) * dist,
        localY: 0,
        rotationY: rng() * Math.PI * 2,
        scaleX: fScale, scaleY: fScale, scaleZ: fScale,
      });
    }
    return placements;
  }
}

