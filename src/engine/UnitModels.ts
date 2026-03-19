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
  // Expansion: civilian workers
  [UnitType.Orchardist]: 'orchardist',
  [UnitType.Vintner]: 'vintner',
  [UnitType.Winemaker]: 'winemaker',
  [UnitType.Brewer]: 'brewer',
  [UnitType.Dairymaid]: 'dairymaid',
  [UnitType.CheeseMaker]: 'cheese_maker',
  [UnitType.Tanner]: 'tanner',
  [UnitType.Weaver]: 'weaver',
  [UnitType.CharcoalBurner]: 'charcoal_burner_unit',
  [UnitType.Fletcher]: 'fletcher',
  [UnitType.Engineer]: 'engineer',
  [UnitType.Stablehand]: 'stablehand',
  [UnitType.Rancher]: 'rancher',
  [UnitType.Shepherd]: 'shepherd',
  // Military
  [UnitType.Knight]: 'knight',
  [UnitType.Archer]: 'archer',
  [UnitType.Cavalry]: 'cavalry',
  [UnitType.SiegeOperator]: 'siege_operator',
  [UnitType.Scout]: 'scout',
  // Transport
  [UnitType.Donkey]: 'donkey',
  [UnitType.HorseTransport]: 'horse_transport',
};
