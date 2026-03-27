import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { logger } from '../util/Logger';

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
  // Living World: ambient animals + flower decorations
  'deer',
  'rabbit',
  'mountain_goat',
  'fish',
  'flower_patch',
  'bird',
  'bee',
] as const;

export type TerrainModelName = (typeof TERRAIN_MODELS)[number];

/** All building model names that must be loaded */
const BUILDING_MODELS = [
  'castle',
  'woodcutter_hut',
  'foresters_hut',
  'quarry',
  'fisherman_hut',
  'guard_hut',
  'sawmill',
  'farm',
  'geologist_hut',
  'iron_mine',
  'coal_mine',
  'gold_mine',
  'stone_mine',
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
  'harbor',
  'small_house',
  'medium_house',
  'large_house',
  // Expansion buildings
  'well',
  'orchard',
  'vineyard',
  'winery',
  'brewery',
  'dairy_farm',
  'cheese_maker_building',
  'hayfield',
  'tannery',
  'weavers_hut',
  'charcoal_burner',
  'fletchers_workshop',
  'siege_workshop',
  'stable',
  'cattle_ranch',
  'sheep_farm',
  'butchery',
  'fortress',
  'archery_range',
  'torch_tower',
  'inn_tavern',
  'market',
  // Living World buildings
  'hunting_lodge',
  'trappers_hut',
  'furrier',
  'apiary',
  'meadery',
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
  // Expansion units
  'orchardist',
  'vintner',
  'winemaker',
  'brewer',
  'dairymaid',
  'cheese_maker',
  'tanner',
  'weaver',
  'charcoal_burner_unit',
  'fletcher',
  'engineer',
  'stablehand',
  'rancher',
  'shepherd',
  'merchant',
  'archer',
  'cavalry',
  'siege_operator',
  'scout',
  'donkey',
  'horse_transport',
  // Living World units
  'hunter',
  'trapper',
  'furrier',
  'beekeeper',
  'meadmaker',
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
  'swords',
  'shields',
  'axe',
  'pickaxe',
  'saw',
  'scythe',
  'fishing_rod',
  'hammer_tool',
  'shovel',
  'rolling_pin',
  'cleaver',
  'crucible',
  'tongs',
  'pigs',
  // Expansion resources
  'grapes',
  'fruit',
  'water_barrel',
  'milk',
  'hay',
  'wool',
  'raw_leather',
  'wine',
  'beer',
  'cheese',
  'cloth',
  'worked_leather',
  'arrows',
  'bow',
  'siege_ram',
  'cattle',
  'horses',
  // Living World resources
  'game_meat',
  'pelts',
  'fur_coat',
  'honey',
  'mead',
] as const;

export type ResourceModelName = (typeof RESOURCE_MODELS)[number];

/**
 * Loads and caches GLTF models for reuse via cloning.
 * All models are loaded once at startup; instances are cloned per use.
 */
/** Check whether an error looks like a network failure (as opposed to a GLTF parse error). */
function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true; // fetch network errors
  const msg = error instanceof Error ? error.message : String(error);
  return /network|fetch|abort|timeout|ERR_CONNECTION|ECONNREFUSED/i.test(msg);
}

export class AssetLoader {
  private loader = new GLTFLoader();
  private models = new Map<string, THREE.Group>();

  /**
   * Load a GLTF model with retry logic for transient network failures.
   * Retries up to `maxRetries` times with exponential backoff (500ms, 1000ms, ...).
   * Only network errors are retried; parse errors are thrown immediately.
   */
  private async loadWithRetry(url: string, maxRetries = 2): Promise<THREE.Group> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const gltf = await this.loader.loadAsync(url);
        const group = new THREE.Group();
        while (gltf.scene.children.length > 0) {
          group.add(gltf.scene.children[0]);
        }
        return group;
      } catch (error) {
        const shouldRetry = attempt < maxRetries && isNetworkError(error);
        if (!shouldRetry) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt)));
      }
    }
    throw new Error(`Failed to load ${url}`); // unreachable
  }

  /** Normalize PBR materials on loaded GLTF models for consistent appearance. */
  private normalizeGLTFMaterials(group: THREE.Group): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        // Clamp metalness — stylized low-poly models shouldn't be highly metallic
        if (child.material.metalness > 0.5) {
          child.material.metalness = 0.3;
        }
        // Ensure minimum roughness to prevent harsh reflections
        child.material.roughness = Math.max(child.material.roughness, 0.5);
      }
    });
  }

  /** Load a batch of models from a directory. Logs warnings for failed loads. */
  private async loadModels(names: readonly string[], directory: string): Promise<void> {
    const promises = names.map(async (name) => {
      const path = `/models/${directory}/${name}.glb`;
      try {
        const group = await this.loadWithRetry(path);
        group.name = name;
        this.normalizeGLTFMaterials(group);
        this.models.set(name, group);
      } catch (err) {
        logger.warn(`Failed to load model "${path}":`, err);
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

  /** Get the raw (non-cloned) model for instancing. Do NOT modify the returned object. */
  getRawModel(name: string): THREE.Group | null {
    return this.models.get(name) ?? null;
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
