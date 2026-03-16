import { BuildingType } from '../game/BuildingType';
import type { BuildingModelName } from './AssetLoader';

/**
 * Maps each BuildingType to its GLTF model filename.
 * Shared between BuildingRenderer and PlacementController.
 */
export const BUILDING_MODEL_MAP: Record<BuildingType, BuildingModelName> = {
  [BuildingType.Castle]: 'castle',
  [BuildingType.WoodcutterHut]: 'woodcutter_hut',
  [BuildingType.ForesterHut]: 'foresters_hut',
  [BuildingType.Quarry]: 'quarry',
  [BuildingType.FishermanHut]: 'fisherman_hut',
  [BuildingType.GuardHut]: 'guard_hut',
  [BuildingType.Sawmill]: 'sawmill',
  [BuildingType.Farm]: 'farm',
  [BuildingType.GeologistHut]: 'geologist_hut',
  [BuildingType.IronMine]: 'iron_mine',
  [BuildingType.CoalMine]: 'coal_mine',
  [BuildingType.GoldMine]: 'gold_mine',
  [BuildingType.StoneMine]: 'stone_mine',
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
  [BuildingType.Harbor]: 'harbor',
};
