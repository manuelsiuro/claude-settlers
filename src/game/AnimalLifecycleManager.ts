import type { GameState } from './GameState';
import type { RoadNetwork } from './RoadNetwork';
import type { TransporterManager } from './TransporterManager';
import type { Unit } from './Unit';
import { BuildingType } from './BuildingType';
import { BuildingState, removeFromInventory, getInventoryAmount } from './Building';
import { ANIMAL_SPECS, ANIMAL_FEED_INTERVAL } from './data/balanceConstants';

/**
 * Manages the lifecycle of transport animals (Donkey, HorseTransport).
 *
 * Responsibilities:
 *   - Age tracking: animals have finite lifespans
 *   - Feeding: consumes Hay/Grain from Castle/Warehouse periodically
 *   - Starvation: animals die if unfed for too long
 *   - Death: removes unit, drops cargo at nearest flag, frees road assignment
 */
export class AnimalLifecycleManager {
  private gameState: GameState;
  private roadNetwork: RoadNetwork;
  private transporterManager: TransporterManager;
  private feedCooldown = ANIMAL_FEED_INTERVAL;

  /** Callback when an animal dies (for notifications) */
  onAnimalDied: ((unit: Unit, cause: 'starvation' | 'old_age') => void) | null = null;

  constructor(gameState: GameState, roadNetwork: RoadNetwork, transporterManager: TransporterManager) {
    this.gameState = gameState;
    this.roadNetwork = roadNetwork;
    this.transporterManager = transporterManager;
  }

  update(deltaTime: number): void {
    const units = this.gameState.getAllUnits();
    const toRemove: { unit: Unit; cause: 'starvation' | 'old_age' }[] = [];

    for (const unit of units) {
      const spec = ANIMAL_SPECS[unit.type];
      if (!spec) continue; // not a tracked animal

      // Age the animal
      unit.animalAge += deltaTime;
      unit.animalHungerTimer += deltaTime;

      // Check lifespan
      if (unit.animalAge >= spec.lifespan) {
        toRemove.push({ unit, cause: 'old_age' });
        continue;
      }

      // Check starvation
      if (unit.animalHungerTimer >= spec.starvationTime) {
        toRemove.push({ unit, cause: 'starvation' });
      }
    }

    // Feed animals periodically
    this.feedCooldown -= deltaTime;
    if (this.feedCooldown <= 0) {
      this.feedCooldown += ANIMAL_FEED_INTERVAL;
      this.feedAnimals();
    }

    // Remove dead animals
    for (const { unit, cause } of toRemove) {
      this.killAnimal(unit, cause);
    }
  }

  /** Feed hungry animals from Castle/Warehouse inventories */
  private feedAnimals(): void {
    const byPlayer = new Map<number, Unit[]>();
    for (const unit of this.gameState.getAllUnits()) {
      const spec = ANIMAL_SPECS[unit.type];
      if (!spec) continue;
      if (unit.animalHungerTimer < spec.feedRate * 0.5) continue; // not hungry yet
      const list = byPlayer.get(unit.playerId) ?? [];
      list.push(unit);
      byPlayer.set(unit.playerId, list);
    }

    for (const [playerId, animals] of byPlayer) {
      // Sort by hunger urgency (most hungry first)
      animals.sort((a, b) => b.animalHungerTimer - a.animalHungerTimer);

      const storages = this.gameState.getBuildingsByPlayer(playerId)
        .filter(b => b.state === BuildingState.Active &&
          (b.type === BuildingType.Castle || b.type === BuildingType.Warehouse));

      for (const animal of animals) {
        const spec = ANIMAL_SPECS[animal.type];
        if (!spec) continue;

        // Try to find and consume feed from storage
        let fed = false;
        for (const storage of storages) {
          for (const feedRes of spec.feedResources) {
            if (getInventoryAmount(storage.outputInventory, feedRes) >= 1) {
              removeFromInventory(storage.outputInventory, feedRes, 1);
              animal.animalHungerTimer = 0; // reset hunger
              fed = true;
              break;
            }
          }
          if (fed) break;
        }
      }
    }
  }

  /** Kill an animal: drop cargo, release road, remove unit */
  private killAnimal(unit: Unit, cause: 'starvation' | 'old_age'): void {
    // Drop cargo at the nearest flag
    if (unit.cargo.length > 0) {
      const flag = this.roadNetwork.getFlagAt(unit.coord.q, unit.coord.r);
      if (flag) {
        for (const item of unit.cargo) {
          // Push as FlagGood with empty destination (will be re-routed by logistics)
          flag.goods.push({ resource: item.resource, destinationFlagId: '' });
        }
      }
    }

    // Release from road assignment
    this.transporterManager.releaseTransporter(unit.id);

    // Fire callback
    this.onAnimalDied?.(unit, cause);

    // Remove from game
    this.gameState.removeUnit(unit.id);
  }

  _getState(): { feedCooldown: number } {
    return { feedCooldown: this.feedCooldown };
  }

  _loadState(state: { feedCooldown: number }): void {
    this.feedCooldown = state.feedCooldown;
  }
}
