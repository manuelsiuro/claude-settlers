import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** All terrain model names that must be loaded */
const TERRAIN_MODELS = [
  'hex_tile',
  'tree_deciduous',
  'tree_conifer',
  'mountain_peak',
  'mountain_peak_snow',
  'boulder',
  'cactus',
  'dune',
  'bush',
  'rock_small',
  'water_waves',
] as const;

export type TerrainModelName = (typeof TERRAIN_MODELS)[number];

/**
 * Loads and caches GLTF models for reuse via cloning.
 * All models are loaded once at startup; decorations are cloned per tile.
 */
export class AssetLoader {
  private loader = new GLTFLoader();
  private models = new Map<string, THREE.Group>();

  /** Load all terrain models. Call once before rendering. */
  async loadTerrainModels(): Promise<void> {
    const promises = TERRAIN_MODELS.map(async (name) => {
      const path = `/models/terrain/${name}.glb`;
      const gltf = await this.loader.loadAsync(path);
      const group = new THREE.Group();
      // Move all children from the scene into our group
      while (gltf.scene.children.length > 0) {
        group.add(gltf.scene.children[0]);
      }
      group.name = name;
      this.models.set(name, group);
    });

    await Promise.all(promises);
  }

  /** Get a clone of a loaded model */
  getModel(name: TerrainModelName): THREE.Group {
    const original = this.models.get(name);
    if (!original) {
      throw new Error(`Model "${name}" not loaded. Call loadTerrainModels() first.`);
    }
    return original.clone();
  }

  /** Check if all models are loaded */
  get loaded(): boolean {
    return this.models.size === TERRAIN_MODELS.length;
  }
}

/** Singleton instance */
export const assetLoader = new AssetLoader();
