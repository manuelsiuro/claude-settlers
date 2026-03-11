import { BuildingState, getInventoryAmount, removeFromInventory } from './Building';
import { BUILDING_DEFINITIONS } from './BuildingType';
import { ResourceType } from './ResourceType';
import type { GameState } from './GameState';
import { UnitType } from './UnitType';
import { UnitState } from './Unit';

/**
 * Manages knight recruitment and stationing in military buildings.
 *
 * When a military building has:
 *   - An empty knight slot
 *   - A Sword and Shield in its inputInventory
 *
 * A Knight unit is spawned at the building and stationed there.
 *
 * Gold bars stored in Castle/Warehouses provide a global combat bonus
 * (calculated on demand, not tracked in state).
 */
export class KnightManager {
  private gameState: GameState;

  /** Seconds between recruitment checks */
  private static RECRUIT_INTERVAL = 1.0;
  private recruitCooldown = 0;

  /** Optional callback when a knight is recruited (for territory recalculation) */
  onKnightRecruited: (() => void) | null = null;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  update(deltaTime: number): void {
    this.recruitCooldown -= deltaTime;
    if (this.recruitCooldown > 0) return;
    this.recruitCooldown = KnightManager.RECRUIT_INTERVAL;

    this.recruitKnights();
    this.cleanupDeadKnights();
  }

  /**
   * Check all active military buildings for recruitment opportunities.
   * Requires: Sword + Shield in building's inputInventory, empty knight slot.
   */
  private recruitKnights(): void {
    const buildings = this.gameState.getAllBuildings();

    for (const building of buildings) {
      if (building.state !== BuildingState.Active) continue;

      const def = BUILDING_DEFINITIONS[building.type];
      if (def.knightSlots <= 0) continue;

      // Check for available slots
      if (building.knightIds.length >= def.knightSlots) continue;

      // Check for Sword + Shield in input inventory
      const swords = getInventoryAmount(building.inputInventory, ResourceType.Swords);
      const shields = getInventoryAmount(building.inputInventory, ResourceType.Shields);

      if (swords < 1 || shields < 1) continue;

      // Consume resources
      removeFromInventory(building.inputInventory, ResourceType.Swords, 1);
      removeFromInventory(building.inputInventory, ResourceType.Shields, 1);

      // Spawn knight at the building
      const knight = this.gameState.spawnUnit(
        UnitType.Knight,
        { ...building.coord },
        building.playerId,
      );
      knight.assignedBuildingId = building.id;
      knight.state = UnitState.Working; // stationed

      building.knightIds.push(knight.id);

      this.onKnightRecruited?.();
    }
  }

  /**
   * Remove references to knights that no longer exist (e.g., killed in combat).
   */
  private cleanupDeadKnights(): void {
    const buildings = this.gameState.getAllBuildings();

    for (const building of buildings) {
      if (building.knightIds.length === 0) continue;

      building.knightIds = building.knightIds.filter((id) => {
        return this.gameState.getUnit(id) !== undefined;
      });
    }
  }

  /**
   * Calculate the global gold bonus for a player.
   * Each Gold Bar stored in Castle/Warehouses adds to combat strength.
   *
   * @returns bonus multiplier (e.g., 1.0 = no bonus, 1.5 = +50%)
   */
  getGoldBonus(playerId: number): number {
    const buildings = this.gameState.getBuildingsByPlayer(playerId);
    let totalGold = 0;

    for (const building of buildings) {
      if (building.state !== BuildingState.Active) continue;
      const def = BUILDING_DEFINITIONS[building.type];
      // Only Castle and Warehouse count as treasury
      if (def.category !== 'core' && def.category !== 'logistics') continue;
      totalGold += getInventoryAmount(building.outputInventory, ResourceType.GoldBars);
    }

    // Each gold bar adds 5% bonus, up to 50% max
    return 1.0 + Math.min(totalGold * 0.05, 0.5);
  }

  /**
   * Calculate a knight's combat strength.
   * Base strength from rank + global gold bonus.
   */
  getKnightStrength(knightId: string): number {
    const knight = this.gameState.getUnit(knightId);
    if (!knight || knight.type !== UnitType.Knight) return 0;

    const baseStrength = knight.knightRank; // rank 1-5
    const goldBonus = this.getGoldBonus(knight.playerId);

    return baseStrength * goldBonus;
  }

  /**
   * Get the number of knights stationed in a building.
   */
  getStationedCount(buildingId: string): number {
    const building = this.gameState.getBuilding(buildingId);
    if (!building) return 0;
    return building.knightIds.length;
  }

  /**
   * Get available knight slots in a building.
   */
  getAvailableSlots(buildingId: string): number {
    const building = this.gameState.getBuilding(buildingId);
    if (!building) return 0;
    const def = BUILDING_DEFINITIONS[building.type];
    return Math.max(0, def.knightSlots - building.knightIds.length);
  }
}
