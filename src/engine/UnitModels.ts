import { UnitType } from '../game/UnitType';
import type { UnitModelName } from './AssetLoader';

/**
 * Maps each UnitType to its GLTF model filename.
 * Used by UnitRenderer to look up the correct 3D model.
 */
export const UNIT_MODEL_MAP: Record<UnitType, UnitModelName> = {
  [UnitType.Transporter]: 'transporter',
  [UnitType.Builder]: 'builder',
  [UnitType.Woodcutter]: 'woodcutter',
  [UnitType.Forester]: 'forester',
  [UnitType.Stonemason]: 'stonemason',
  [UnitType.Fisherman]: 'fisherman',
  [UnitType.Miner]: 'miner',
  [UnitType.Farmer]: 'farmer',
  [UnitType.Geologist]: 'geologist',
  [UnitType.SawmillWorker]: 'sawmill_worker',
  [UnitType.Miller]: 'miller',
  [UnitType.Baker]: 'baker',
  [UnitType.PigFarmer]: 'pig_farmer',
  [UnitType.Butcher]: 'butcher',
  [UnitType.SmelterWorker]: 'smelter_worker',
  [UnitType.Goldsmith]: 'goldsmith',
  [UnitType.Toolmaker]: 'toolmaker',
  [UnitType.Blacksmith]: 'blacksmith',
  [UnitType.Knight]: 'knight',
};
