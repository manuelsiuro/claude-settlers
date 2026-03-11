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

/** All building model names that must be loaded */
const BUILDING_MODELS = [
  'castle',
  'woodcutter_hut',
  'forester_hut',
  'quarry',
  'fisherman_hut',
  'guard_hut',
  'sawmill',
  'farm',
  'geologist_hut',
  'mine',
  'watchtower',
  'windmill',
  'bakery',
  'pig_farm',
  'slaughterhouse',
  'iron_smelter',
  'toolmaker_workshop',
  'goldsmith_mint',
  'blacksmith_armory',
  'barracks',
  'warehouse',
] as const;

export type BuildingModelName = (typeof BUILDING_MODELS)[number];

/** All unit model names that must be loaded */
const UNIT_MODELS = [
  'serf_base',
  'transporter',
  'builder',
  'woodcutter',
  'forester',
  'stonemason',
  'fisherman',
  'miner',
  'farmer',
  'geologist',
  'sawmill_worker',
  'miller',
  'baker',
  'pig_farmer',
  'butcher',
  'smelter_worker',
  'goldsmith',
  'toolmaker',
  'blacksmith',
  'knight',
] as const;

export type UnitModelName = (typeof UNIT_MODELS)[number];

/** All resource model names that must be loaded */
const RESOURCE_MODELS = [
  'wood',
  'stone',
  'grain',
  'fish',
  'iron_ore',
  'coal_ore',
  'gold_ore',
  'planks',
  'flour',
  'bread',
  'meat',
  'iron_bars',
  'gold_bars',
  'tools',
  'swords',
  'shields',
  'pigs',
] as const;

export type ResourceModelName = (typeof RESOURCE_MODELS)[number];

/**
 * Loads and caches GLTF models for reuse via cloning.
 * All models are loaded once at startup; instances are cloned per use.
 */
export class AssetLoader {
  private loader = new GLTFLoader();
  private models = new Map<string, THREE.Group>();

  /** Load a batch of models from a directory. Logs warnings for failed loads. */
  private async loadModels(names: readonly string[], directory: string): Promise<void> {
    const promises = names.map(async (name) => {
      const path = `/models/${directory}/${name}.glb`;
      try {
        const gltf = await this.loader.loadAsync(path);
        const group = new THREE.Group();
        while (gltf.scene.children.length > 0) {
          group.add(gltf.scene.children[0]);
        }
        group.name = name;
        this.models.set(name, group);
      } catch (err) {
        console.warn(`Failed to load model "${path}":`, err);
      }
    });

    await Promise.all(promises);
  }

  /** Load all terrain models. Call once before rendering. */
  async loadTerrainModels(): Promise<void> {
    await this.loadModels(TERRAIN_MODELS, 'terrain');
  }

  /** Load all building models. Call once before rendering. */
  async loadBuildingModels(): Promise<void> {
    await this.loadModels(BUILDING_MODELS, 'buildings');
  }

  /** Load all unit models. Call once before rendering. */
  async loadUnitModels(): Promise<void> {
    await this.loadModels(UNIT_MODELS, 'units');
  }

  /** Load all resource models. Call once before rendering. */
  async loadResourceModels(): Promise<void> {
    await this.loadModels(RESOURCE_MODELS, 'resources');
  }

  /** Get a clone of a loaded terrain model */
  getModel(name: TerrainModelName): THREE.Group {
    const original = this.models.get(name);
    if (!original) {
      throw new Error(`Model "${name}" not loaded. Call loadTerrainModels() first.`);
    }
    return original.clone();
  }

  /** Get a clone of a loaded building model */
  getBuildingModel(name: BuildingModelName): THREE.Group {
    const original = this.models.get(name);
    if (!original) {
      throw new Error(`Building model "${name}" not loaded. Call loadBuildingModels() first.`);
    }
    return original.clone();
  }

  /** Get a clone of a loaded unit model */
  getUnitModel(name: UnitModelName): THREE.Group {
    const original = this.models.get(name);
    if (!original) {
      throw new Error(`Unit model "${name}" not loaded. Call loadUnitModels() first.`);
    }
    return original.clone();
  }

  /** Get a clone of a loaded resource model */
  getResourceModel(name: ResourceModelName): THREE.Group | null {
    const original = this.models.get(name);
    if (!original) return null;
    return original.clone();
  }

  /** Check if all terrain models are loaded */
  get loaded(): boolean {
    return TERRAIN_MODELS.every((name) => this.models.has(name));
  }

  /** Check if all building models are loaded */
  get buildingsLoaded(): boolean {
    return BUILDING_MODELS.every((name) => this.models.has(name));
  }

  /** Check if all unit models are loaded */
  get unitsLoaded(): boolean {
    return UNIT_MODELS.every((name) => this.models.has(name));
  }
}

/** Singleton instance */
export const assetLoader = new AssetLoader();
