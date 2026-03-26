import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import { TerrainType } from '../game/TerrainType';
import { MapRenderer } from './MapRenderer';
import { assetLoader } from './AssetLoader';
import { createRng } from '../game/noise';

// ── Types ──

type AnimalType = 'deer' | 'rabbit' | 'mountain_goat' | 'fish';
type AnimalState = 'idle' | 'walking' | 'grazing' | 'jumping' | 'hidden';

interface WildAnimal {
  type: AnimalType;
  position: THREE.Vector3;
  targetPosition: THREE.Vector3;
  state: AnimalState;
  stateTimer: number;
  rotation: number;
  speed: number;
  baseY: number;
  /** Tile coordinate for finding walkable neighbors */
  tileQ: number;
  tileR: number;
}

/** Sub-mesh info extracted from a GLTF model Group */
interface SubMeshInfo {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** Local transform of this sub-mesh within the GLTF hierarchy */
  localMatrix: THREE.Matrix4;
}

// ── Constants ──

const ANIMAL_SCALES: Record<AnimalType, number> = {
  deer: 0.15,
  rabbit: 0.08,
  mountain_goat: 0.12,
  fish: 0.10,
};

const ANIMAL_SPEEDS: Record<AnimalType, number> = {
  deer: 0.4,
  rabbit: 0.6,
  mountain_goat: 0.3,
  fish: 0.0, // Fish don't walk
};

/** Distance in hex units within which animals are updated and visible */
const CULL_DISTANCE = 15;
/** Hex size for distance conversion */
const HEX_WORLD_SIZE = 1.732; // approx sqrt(3) * HEX_SIZE

// ── Renderer ──

/**
 * Renders ambient wild animals on the map terrain.
 * Uses InstancedMesh per model type with distance culling.
 * Animals follow a simple state machine: idle -> grazing -> walking.
 * Fish have a special hidden -> jumping cycle.
 */
export class WildAnimalRenderer {
  private animals: WildAnimal[] = [];
  private meshMap: Map<AnimalType, THREE.InstancedMesh[]> = new Map();
  /** Sub-mesh local transforms per animal type (parallel to meshMap) */
  private subMeshInfoMap: Map<AnimalType, SubMeshInfo[]> = new Map();
  private scene: THREE.Scene | null = null;
  private grid: HexGrid | null = null;
  private enabled = true;
  private maxAnimals: number;

  /** Reusable scratch objects for per-frame matrix composition */
  private readonly _matrix = new THREE.Matrix4();
  private readonly _localMatrix = new THREE.Matrix4();
  private readonly _position = new THREE.Vector3();
  private readonly _quaternion = new THREE.Quaternion();
  private readonly _euler = new THREE.Euler();
  private readonly _scale = new THREE.Vector3();

  constructor(maxAnimals = 20) {
    this.maxAnimals = maxAnimals;
  }

  addToScene(scene: THREE.Scene, grid: HexGrid): void {
    this.scene = scene;
    this.grid = grid;

    // Detect mobile — reduce animal count
    const isMobile = window.innerWidth <= 768;
    const totalBudget = isMobile ? Math.min(this.maxAnimals, 12) : this.maxAnimals;

    // Spawn animals deterministically from grid seed
    this.spawnAnimals(grid, totalBudget);

    // Create InstancedMeshes per animal type
    this.buildMeshes();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    for (const meshes of this.meshMap.values()) {
      for (const mesh of meshes) {
        mesh.visible = enabled;
      }
    }
  }

  update(deltaTime: number, cameraPosition: THREE.Vector3): void {
    if (!this.enabled || this.animals.length === 0) return;

    const camX = cameraPosition.x;
    const camZ = cameraPosition.z;
    const cullDistWorld = CULL_DISTANCE * HEX_WORLD_SIZE;
    const cullDistSq = cullDistWorld * cullDistWorld;

    // Update animal states for visible animals
    for (const animal of this.animals) {
      const dx = animal.position.x - camX;
      const dz = animal.position.z - camZ;
      const distSq = dx * dx + dz * dz;

      // Only update animals within cull distance
      if (distSq > cullDistSq) continue;

      this.updateAnimalState(animal, deltaTime);
    }

    // Update instance matrices for each type
    for (const [type, meshes] of this.meshMap) {
      if (meshes.length === 0) continue;

      let instanceIdx = 0;
      for (const animal of this.animals) {
        if (animal.type !== type) continue;

        const dx = animal.position.x - camX;
        const dz = animal.position.z - camZ;
        const distSq = dx * dx + dz * dz;
        if (distSq > cullDistSq) continue;

        // Skip hidden fish
        if (animal.state === 'hidden') continue;

        const scale = ANIMAL_SCALES[type];
        let yOffset = 0;

        // Fish jumping arc
        if (animal.type === 'fish' && animal.state === 'jumping') {
          const jumpProgress = 1.0 - (animal.stateTimer / 0.5);
          yOffset = Math.sin(jumpProgress * Math.PI) * 0.3;
        }

        // Grazing slight downward offset
        if (animal.state === 'grazing') {
          yOffset = -0.02;
        }

        this._euler.set(0, animal.rotation, 0);
        this._quaternion.setFromEuler(this._euler);
        this._scale.set(scale, scale, scale);
        this._position.set(
          animal.position.x,
          animal.baseY + yOffset,
          animal.position.z,
        );

        // Compose world matrix from animal position/rotation/scale
        this._matrix.compose(this._position, this._quaternion, this._scale);

        // Apply to all sub-meshes, incorporating each sub-mesh's local transform
        const subInfos = this.subMeshInfoMap.get(type) ?? [];
        for (let mi = 0; mi < meshes.length; mi++) {
          if (mi < subInfos.length) {
            this._localMatrix.multiplyMatrices(this._matrix, subInfos[mi].localMatrix);
            meshes[mi].setMatrixAt(instanceIdx, this._localMatrix);
          } else {
            meshes[mi].setMatrixAt(instanceIdx, this._matrix);
          }
        }
        instanceIdx++;
      }

      // Update instance counts and mark for GPU upload
      for (const mesh of meshes) {
        mesh.count = instanceIdx;
        if (instanceIdx > 0) {
          mesh.instanceMatrix.needsUpdate = true;
        }
      }
    }
  }

  dispose(): void {
    for (const meshes of this.meshMap.values()) {
      for (const mesh of meshes) {
        mesh.removeFromParent();
        mesh.dispose();
      }
    }
    this.subMeshInfoMap.clear();
    this.meshMap.clear();
    this.animals = [];
    this.scene = null;
    this.grid = null;
  }

  // ── Private Methods ──

  private spawnAnimals(grid: HexGrid, totalBudget: number): void {
    const rng = createRng(42); // Deterministic seed
    const tiles = grid.getAllTiles();

    // Classify tiles by terrain and adjacency
    const grasslandTiles: { q: number; r: number; nearForest: boolean }[] = [];
    const mountainTiles: { q: number; r: number }[] = [];
    const waterTiles: { q: number; r: number }[] = [];

    for (const tile of tiles) {
      if (tile.terrain === TerrainType.Grassland) {
        const neighbors = grid.getNeighbors(tile.coord.q, tile.coord.r);
        const nearForest = neighbors.some((n) => n.terrain === TerrainType.Forest);
        grasslandTiles.push({ q: tile.coord.q, r: tile.coord.r, nearForest });
      } else if (tile.terrain === TerrainType.Mountain) {
        mountainTiles.push({ q: tile.coord.q, r: tile.coord.r });
      } else if (tile.terrain === TerrainType.Water) {
        waterTiles.push({ q: tile.coord.q, r: tile.coord.r });
      }
    }

    // Shuffle candidate tiles with seeded RNG
    const shuffle = <T>(arr: T[]): T[] => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    shuffle(grasslandTiles);
    shuffle(mountainTiles);
    shuffle(waterTiles);

    // Budget allocation: deer 25%, rabbit 25%, goat 15%, fish 35%
    const deerBudget = Math.max(2, Math.round(totalBudget * 0.25));
    const rabbitBudget = Math.max(2, Math.round(totalBudget * 0.25));
    const goatBudget = Math.max(1, Math.round(totalBudget * 0.15));
    const fishBudget = Math.max(2, totalBudget - deerBudget - rabbitBudget - goatBudget);

    // Spawn deer on grassland tiles near forest
    const forestGrassland = grasslandTiles.filter((t) => t.nearForest);
    const deerCount = Math.min(deerBudget, forestGrassland.length);
    for (let i = 0; i < deerCount; i++) {
      const t = forestGrassland[i];
      this.spawnAnimal('deer', t.q, t.r, grid, rng);
    }

    // Spawn rabbits on any grassland
    const rabbitCount = Math.min(rabbitBudget, grasslandTiles.length);
    for (let i = 0; i < rabbitCount; i++) {
      const t = grasslandTiles[i];
      this.spawnAnimal('rabbit', t.q, t.r, grid, rng);
    }

    // Spawn mountain goats
    const goatCount = Math.min(goatBudget, mountainTiles.length);
    for (let i = 0; i < goatCount; i++) {
      const t = mountainTiles[i];
      this.spawnAnimal('mountain_goat', t.q, t.r, grid, rng);
    }

    // Spawn fish
    const fishCount = Math.min(fishBudget, waterTiles.length);
    for (let i = 0; i < fishCount; i++) {
      const t = waterTiles[i];
      this.spawnAnimal('fish', t.q, t.r, grid, rng);
    }
  }

  private spawnAnimal(
    type: AnimalType,
    tileQ: number,
    tileR: number,
    grid: HexGrid,
    rng: () => number,
  ): void {
    const tile = grid.getTile(tileQ, tileR);
    if (!tile) return;

    const { x, z } = HexGrid.hexToWorld(tileQ, tileR);
    const y = MapRenderer.getTileY(tile);

    // Small random offset within hex
    const offsetX = (rng() - 0.5) * 0.6;
    const offsetZ = (rng() - 0.5) * 0.6;

    const animal: WildAnimal = {
      type,
      position: new THREE.Vector3(x + offsetX, y, z + offsetZ),
      targetPosition: new THREE.Vector3(x + offsetX, y, z + offsetZ),
      state: type === 'fish' ? 'hidden' : 'idle',
      stateTimer: rng() * 5 + 2, // Stagger initial timers
      rotation: rng() * Math.PI * 2,
      speed: ANIMAL_SPEEDS[type],
      baseY: y,
      tileQ,
      tileR,
    };

    this.animals.push(animal);
  }

  private buildMeshes(): void {
    if (!this.scene) return;

    // Count max possible visible per type
    const countByType = new Map<AnimalType, number>();
    for (const animal of this.animals) {
      countByType.set(animal.type, (countByType.get(animal.type) ?? 0) + 1);
    }

    for (const [type, count] of countByType) {
      if (count === 0) continue;

      const subMeshes = this.getSubMeshes(type);
      if (subMeshes.length === 0) {
        // Fallback: create a simple colored box geometry
        const meshes = this.createFallbackMesh(type, count);
        this.meshMap.set(type, meshes);
        this.subMeshInfoMap.set(type, []);
        continue;
      }

      this.subMeshInfoMap.set(type, subMeshes);
      const meshes: THREE.InstancedMesh[] = [];
      for (const sub of subMeshes) {
        const instMesh = new THREE.InstancedMesh(sub.geometry, sub.material, count);
        instMesh.frustumCulled = false;
        instMesh.count = 0; // Start with nothing visible

        // Set identity for all slots
        const identity = new THREE.Matrix4();
        for (let i = 0; i < count; i++) {
          instMesh.setMatrixAt(i, identity);
        }
        instMesh.instanceMatrix.needsUpdate = true;

        this.scene!.add(instMesh);
        meshes.push(instMesh);
      }
      this.meshMap.set(type, meshes);
    }
  }

  /** Create a simple fallback mesh when the GLTF model isn't loaded */
  private createFallbackMesh(type: AnimalType, count: number): THREE.InstancedMesh[] {
    const colors: Record<AnimalType, number> = {
      deer: 0x8b6914,
      rabbit: 0xc0a080,
      mountain_goat: 0xa0a0a0,
      fish: 0x6699cc,
    };
    const sizes: Record<AnimalType, [number, number, number]> = {
      deer: [0.3, 0.25, 0.15],
      rabbit: [0.12, 0.1, 0.08],
      mountain_goat: [0.25, 0.2, 0.12],
      fish: [0.2, 0.06, 0.06],
    };

    const [sx, sy, sz] = sizes[type];
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mat = new THREE.MeshLambertMaterial({ color: colors[type] });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    mesh.count = 0;

    const identity = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, identity);
    }
    mesh.instanceMatrix.needsUpdate = true;

    this.scene!.add(mesh);
    return [mesh];
  }

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

  private updateAnimalState(animal: WildAnimal, deltaTime: number): void {
    animal.stateTimer -= deltaTime;

    if (animal.type === 'fish') {
      this.updateFishState(animal, deltaTime);
      return;
    }

    switch (animal.state) {
      case 'idle':
        if (animal.stateTimer <= 0) {
          // Transition to grazing or walking
          if (Math.random() < 0.5) {
            animal.state = 'grazing';
            animal.stateTimer = 2 + Math.random() * 3;
          } else {
            animal.state = 'walking';
            animal.stateTimer = 2 + Math.random() * 2;
            this.pickNewTarget(animal);
          }
        }
        break;

      case 'grazing':
        if (animal.stateTimer <= 0) {
          animal.state = 'idle';
          animal.stateTimer = 3 + Math.random() * 5;
        }
        break;

      case 'walking':
        if (animal.stateTimer <= 0) {
          animal.state = 'idle';
          animal.stateTimer = 3 + Math.random() * 5;
        } else {
          // Lerp toward target
          const dx = animal.targetPosition.x - animal.position.x;
          const dz = animal.targetPosition.z - animal.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          if (dist > 0.05) {
            const step = Math.min(animal.speed * deltaTime, dist);
            animal.position.x += (dx / dist) * step;
            animal.position.z += (dz / dist) * step;
            // Face movement direction
            animal.rotation = Math.atan2(dx, dz);
          } else {
            // Reached target, go idle
            animal.state = 'idle';
            animal.stateTimer = 3 + Math.random() * 5;
          }
        }
        break;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private updateFishState(animal: WildAnimal, _deltaTime: number): void {
    switch (animal.state) {
      case 'hidden':
        if (animal.stateTimer <= 0) {
          animal.state = 'jumping';
          animal.stateTimer = 0.5;
          // Randomize rotation for the jump
          animal.rotation = Math.random() * Math.PI * 2;
        }
        break;

      case 'jumping':
        if (animal.stateTimer <= 0) {
          animal.state = 'hidden';
          animal.stateTimer = 5 + Math.random() * 10;
          // Shift position slightly for next jump
          animal.position.x += (Math.random() - 0.5) * 0.3;
          animal.position.z += (Math.random() - 0.5) * 0.3;
        }
        break;

      default:
        // Fish shouldn't be in other states, reset
        animal.state = 'hidden';
        animal.stateTimer = 5 + Math.random() * 10;
        break;
    }
  }

  private pickNewTarget(animal: WildAnimal): void {
    if (!this.grid) return;

    // Pick a random position within or near current tile
    const tile = this.grid.getTile(animal.tileQ, animal.tileR);
    if (!tile) return;

    // 50% chance to walk within current tile, 50% to adjacent tile of same terrain
    if (Math.random() < 0.5) {
      // Walk within current tile
      const { x, z } = HexGrid.hexToWorld(animal.tileQ, animal.tileR);
      animal.targetPosition.set(
        x + (Math.random() - 0.5) * 0.8,
        animal.baseY,
        z + (Math.random() - 0.5) * 0.8,
      );
    } else {
      // Walk to an adjacent tile of the same terrain
      const neighbors = this.grid.getNeighbors(animal.tileQ, animal.tileR);
      const sameTerrain = neighbors.filter((n) => {
        // Deer can walk on grassland or near forest
        if (animal.type === 'deer') {
          return n.terrain === TerrainType.Grassland;
        }
        return n.terrain === tile.terrain;
      });

      if (sameTerrain.length > 0) {
        const target = sameTerrain[Math.floor(Math.random() * sameTerrain.length)];
        const { x, z } = HexGrid.hexToWorld(target.coord.q, target.coord.r);
        const y = MapRenderer.getTileY(target);
        animal.targetPosition.set(
          x + (Math.random() - 0.5) * 0.5,
          y,
          z + (Math.random() - 0.5) * 0.5,
        );
        // Update tile tracking
        animal.tileQ = target.coord.q;
        animal.tileR = target.coord.r;
        animal.baseY = y;
      } else {
        // Fallback: stay within current tile
        const { x, z } = HexGrid.hexToWorld(animal.tileQ, animal.tileR);
        animal.targetPosition.set(
          x + (Math.random() - 0.5) * 0.8,
          animal.baseY,
          z + (Math.random() - 0.5) * 0.8,
        );
      }
    }
  }
}
