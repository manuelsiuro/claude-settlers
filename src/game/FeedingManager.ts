import type { GameState } from './GameState';
import type { Unit } from './Unit';
import { UnitState } from './Unit';
import { UnitType } from './UnitType';
import { BuildingType } from './BuildingType';
import { BuildingState, removeFromInventory } from './Building';
import { RESOURCE_PROPERTIES } from './ResourceType';
import type { ResourceType } from './ResourceType';
import {
  HUNGER_DECAY_RATE,
  HUNGER_WORKING_MULTIPLIER,
  HUNGER_GARRISONED_MULTIPLIER,
  HUNGER_FOOD_PRODUCER_MULTIPLIER,
  HUNGER_HUNGRY_THRESHOLD,
  HUNGER_STARVING_THRESHOLD,
  HUNGER_SPEED_PENALTY_HUNGRY,
  HUNGER_SPEED_PENALTY_STARVING,
  HUNGER_PRODUCTION_PENALTY_HUNGRY,
  HUNGER_PRODUCTION_PENALTY_STARVING,
} from './data/balanceConstants';

/** How often to attempt feeding (seconds) */
const FEEDING_INTERVAL = 5.0;

/** Buildings whose workers get reduced hunger decay to prevent food-chain starvation spiral */
const FOOD_PRODUCER_BUILDINGS: ReadonlySet<string> = new Set([
  BuildingType.FishermanHut,
  BuildingType.Orchard,
  BuildingType.Farm,
  BuildingType.Windmill,
  BuildingType.Bakery,
  BuildingType.PigFarm,
  BuildingType.Slaughterhouse,
  BuildingType.DairyFarm,
  BuildingType.CheeseMakerBuilding,
  BuildingType.Hayfield,
  BuildingType.Brewery,
  BuildingType.Winery,
  BuildingType.Vineyard,
  BuildingType.CattleRanch,
  BuildingType.Butchery,
  BuildingType.HuntingLodge,
  BuildingType.Apiary,
]);

/**
 * FeedingManager: decays unit satiation over time and feeds units from
 * nearby Castle/Warehouse inventories.
 */
export class FeedingManager {
  private gameState: GameState;
  private feedingCooldown = FEEDING_INTERVAL;

  /** Callback fired when food is consumed from storage (for economy tracking) */
  onFoodConsumed: ((resource: ResourceType, amount: number) => void) | null = null;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  update(deltaTime: number): void {
    const units = this.gameState.getAllUnits();

    for (const unit of units) {
      this.decaySatiation(unit, deltaTime);
    }

    this.feedingCooldown -= deltaTime;
    if (this.feedingCooldown <= 0) {
      this.feedingCooldown += FEEDING_INTERVAL; // Accumulate deficit for correct long-term rate
      this.feedUnits(units);
    }
  }

  private decaySatiation(unit: Unit, deltaTime: number): void {
    let multiplier = 1.0;

    if (unit.state === UnitState.Working) {
      multiplier = HUNGER_WORKING_MULTIPLIER;
    } else if (unit.type === UnitType.Knight && unit.state === UnitState.Idle && unit.assignedBuildingId) {
      multiplier = HUNGER_GARRISONED_MULTIPLIER;
    }

    // Food producer workers decay slower to prevent food-chain starvation spiral
    if (unit.assignedBuildingId) {
      const building = this.gameState.getBuilding(unit.assignedBuildingId);
      if (building && FOOD_PRODUCER_BUILDINGS.has(building.type)) {
        multiplier *= HUNGER_FOOD_PRODUCER_MULTIPLIER;
      }
    }

    unit.satiation = Math.max(0, unit.satiation - HUNGER_DECAY_RATE * multiplier * deltaTime);
  }

  private feedUnits(units: Unit[]): void {
    const byPlayer = new Map<number, Unit[]>();
    for (const unit of units) {
      if (unit.satiation >= 0.80) continue;
      const list = byPlayer.get(unit.playerId) ?? [];
      list.push(unit);
      byPlayer.set(unit.playerId, list);
    }

    for (const [playerId, playerUnits] of byPlayer) {
      if (playerUnits.length > 1) {
        playerUnits.sort((a, b) => {
          const aPrio = this.getUnitFeedPriority(a);
          const bPrio = this.getUnitFeedPriority(b);
          if (aPrio !== bPrio) return aPrio - bPrio;
          return a.satiation - b.satiation;
        });
      }

      const storageBuildings = this.gameState.getBuildingsByPlayer(playerId)
        .filter(b => b.state === BuildingState.Active && (
          b.type === BuildingType.Castle ||
          b.type === BuildingType.Warehouse
        ));

      for (const unit of playerUnits) {
        if (unit.satiation >= 0.80) continue;

        for (const storage of storageBuildings) {
          const foodResource = this.findBestFood(storage.outputInventory);
          if (foodResource) {
            const props = RESOURCE_PROPERTIES[foodResource];
            removeFromInventory(storage.outputInventory, foodResource, 1);
            unit.satiation = Math.min(1.0, unit.satiation + props.satiationValue);
            this.onFoodConsumed?.(foodResource, 1);
            break;
          }
        }
      }
    }
  }

  private getUnitFeedPriority(unit: Unit): number {
    if (unit.type === UnitType.Knight) return 0;
    if (unit.type === UnitType.Miner) return 1;
    // Food producer workers get priority between miners and other workers
    if (unit.assignedBuildingId) {
      const building = this.gameState.getBuilding(unit.assignedBuildingId);
      if (building && FOOD_PRODUCER_BUILDINGS.has(building.type)) return 1.5;
    }
    if (unit.state === UnitState.Working) return 2;
    if (unit.state === UnitState.Idle) return 4;
    return 3;
  }

  private findBestFood(inventory: Partial<Record<ResourceType, number>>): ResourceType | null {
    let bestFood: ResourceType | null = null;
    let bestValue = Infinity;

    for (const [resource, amount] of Object.entries(inventory)) {
      if (!amount || amount <= 0) continue;
      const props = RESOURCE_PROPERTIES[resource as ResourceType];
      if (props && props.satiationValue > 0 && props.satiationValue < bestValue) {
        bestFood = resource as ResourceType;
        bestValue = props.satiationValue;
      }
    }

    return bestFood;
  }

  _getState(): { feedingCooldown: number } {
    return { feedingCooldown: this.feedingCooldown };
  }

  _loadState(state: { feedingCooldown: number }): void {
    this.feedingCooldown = state.feedingCooldown;
  }
}

/** Get a hunger-based multiplier given two penalty tiers */
function getHungerMultiplier(satiation: number, hungryPenalty: number, starvingPenalty: number): number {
  if (satiation < HUNGER_STARVING_THRESHOLD) return 1.0 - starvingPenalty;
  if (satiation < HUNGER_HUNGRY_THRESHOLD) return 1.0 - hungryPenalty;
  return 1.0;
}

/** Get movement speed multiplier based on satiation level */
export function getHungerSpeedMultiplier(satiation: number): number {
  return getHungerMultiplier(satiation, HUNGER_SPEED_PENALTY_HUNGRY, HUNGER_SPEED_PENALTY_STARVING);
}

/** Get production speed multiplier based on satiation level */
export function getHungerProductionMultiplier(satiation: number): number {
  return getHungerMultiplier(satiation, HUNGER_PRODUCTION_PENALTY_HUNGRY, HUNGER_PRODUCTION_PENALTY_STARVING);
}
