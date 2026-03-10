import { BuildingType } from '../game/BuildingType';
import type { BuildingModelName } from './AssetLoader';

/**
 * Maps each BuildingType to its GLTF model filename.
 * Shared between BuildingRenderer and PlacementController.
 * All 4 mine types share the same 'mine' model.
 */
export const BUILDING_MODEL_MAP: Record<BuildingType, BuildingModelName> = {
  [BuildingType.Castle]: 'castle',
  [BuildingType.WoodcutterHut]: 'woodcutter_hut',
  [BuildingType.ForesterHut]: 'forester_hut',
  [BuildingType.Quarry]: 'quarry',
  [BuildingType.FishermanHut]: 'fisherman_hut',
  [BuildingType.GuardHut]: 'guard_hut',
  [BuildingType.Sawmill]: 'sawmill',
  [BuildingType.Farm]: 'farm',
  [BuildingType.GeologistHut]: 'geologist_hut',
  [BuildingType.IronMine]: 'mine',
  [BuildingType.CoalMine]: 'mine',
  [BuildingType.GoldMine]: 'mine',
  [BuildingType.StoneMine]: 'mine',
  [BuildingType.Watchtower]: 'watchtower',
  [BuildingType.Windmill]: 'windmill',
  [BuildingType.Bakery]: 'bakery',
  [BuildingType.PigFarm]: 'pig_farm',
  [BuildingType.Slaughterhouse]: 'slaughterhouse',
  [BuildingType.IronSmelter]: 'iron_smelter',
  [BuildingType.ToolmakerWorkshop]: 'toolmaker_workshop',
  [BuildingType.GoldsmithMint]: 'goldsmith_mint',
  [BuildingType.BlacksmithArmory]: 'blacksmith_armory',
  [BuildingType.Barracks]: 'barracks',
  [BuildingType.Warehouse]: 'warehouse',
};
