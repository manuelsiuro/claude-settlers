import type { Building } from './Building';
import { BuildingState, getInventoryAmount, removeFromInventory } from './Building';
import { BuildingType, BUILDING_DEFINITIONS } from './BuildingType';
import { ResourceType } from './ResourceType';
import type { GameState } from './GameState';
import { UnitType, UNIT_DEFINITIONS } from './UnitType';
import { UnitState } from './Unit';
import { COMBAT_GOLD_BONUS_PER_BAR, COMBAT_MAX_GOLD_BONUS } from './data/balanceConstants';

/**
 * Mapping from building type to the military unit type it recruits.
 * Buildings not listed here use the default Knight recruitment.
 */
const BUILDING_RECRUIT_TYPE: Partial<Record<string, UnitType>> = {
  [BuildingType.ArcheryRange]: UnitType.Archer,
  // Guard huts, watchtowers, barracks, fortress recruit Knights by default
  // Barracks and Fortress can also recruit Cavalry and Siege (checked below)
};

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
  onKnightRecruited: ((building: Building) => void) | null = null;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  /** Serialization: get internal state for save */
  _getState(): { recruitCooldown: number } {
    return { recruitCooldown: this.recruitCooldown };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: { recruitCooldown: number }): void {
    this.recruitCooldown = state.recruitCooldown;
  }

  update(deltaTime: number): void {
    this.recruitCooldown -= deltaTime;
    if (this.recruitCooldown > 0) return;
    this.recruitCooldown = KnightManager.RECRUIT_INTERVAL;

    this.recruitKnights();
    this.cleanupDeadKnights();
  }

  /**
   * Determine which unit type a military building should recruit.
   * Barracks/Fortress check for Cavalry (Horse+Sword+Shield) and Siege (SiegeRam)
   * before falling back to Knight (Sword+Shield).
   */
  private getRecruitType(building: Building): UnitType | null {
    // ArcheryRange always recruits Archers
    const fixedType = BUILDING_RECRUIT_TYPE[building.type];
    if (fixedType) return fixedType;

    // Guard huts only recruit Knights and Scouts
    if (building.type === BuildingType.GuardHut || building.type === BuildingType.Watchtower) {
      // Scout: no items needed (serf promotion)
      const scoutDef = UNIT_DEFINITIONS[UnitType.Scout];
      if (scoutDef.recruitmentItems && scoutDef.recruitmentItems.length === 0) {
        // Only recruit scout if we don't have enough items for a knight
        const knightDef = UNIT_DEFINITIONS[UnitType.Knight];
        const canKnight = knightDef.recruitmentItems?.every(
          item => getInventoryAmount(building.inputInventory, item.resource) >= item.amount,
        );
        if (!canKnight) return null; // Don't auto-recruit scouts — only knights at guard huts
      }
      return UnitType.Knight;
    }

    // Barracks/Fortress: try Cavalry first, then Siege, then Knight
    if (building.type === BuildingType.Barracks || building.type === BuildingType.Fortress) {
      // Check Cavalry requirements (Horse + Sword + Shield)
      const cavalryDef = UNIT_DEFINITIONS[UnitType.Cavalry];
      const canCavalry = cavalryDef.recruitmentItems?.every(
        item => getInventoryAmount(building.inputInventory, item.resource) >= item.amount,
      );
      if (canCavalry) return UnitType.Cavalry;

      // Check Siege requirements (SiegeRam)
      const siegeDef = UNIT_DEFINITIONS[UnitType.SiegeOperator];
      const canSiege = siegeDef.recruitmentItems?.every(
        item => getInventoryAmount(building.inputInventory, item.resource) >= item.amount,
      );
      if (canSiege) return UnitType.SiegeOperator;
    }

    // Default: Knight
    return UnitType.Knight;
  }

  /**
   * Check all active military buildings for recruitment opportunities.
   * Each building type recruits a specific military unit based on available items.
   */
  private recruitKnights(): void {
    const buildings = this.gameState.getAllBuildings();

    for (const building of buildings) {
      if (building.state !== BuildingState.Active) continue;

      const def = BUILDING_DEFINITIONS[building.type];
      if (def.knightSlots <= 0) continue;

      // Check for available slots
      if (building.knightIds.length >= def.knightSlots) continue;

      // Determine which unit type to recruit
      const recruitType = this.getRecruitType(building);
      if (!recruitType) continue;

      const unitDef = UNIT_DEFINITIONS[recruitType];
      const items = unitDef.recruitmentItems ?? [];

      // Check all required items are available
      const canRecruit = items.every(
        item => getInventoryAmount(building.inputInventory, item.resource) >= item.amount,
      );
      if (!canRecruit) continue;

      // Consume resources
      for (const item of items) {
        removeFromInventory(building.inputInventory, item.resource, item.amount);
      }

      // Spawn military unit at the building
      const unit = this.gameState.spawnUnit(
        recruitType,
        { ...building.coord },
        building.playerId,
      );
      unit.assignedBuildingId = building.id;
      unit.state = UnitState.Working; // stationed

      building.knightIds.push(unit.id);

      this.onKnightRecruited?.(building);
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

    return 1.0 + Math.min(totalGold * COMBAT_GOLD_BONUS_PER_BAR, COMBAT_MAX_GOLD_BONUS);
  }

  /**
   * Calculate a military unit's combat strength.
   * Base strength from rank × unit combat modifier × gold bonus.
   * Works for Knights, Archers, Cavalry, Siege Operators, and Scouts.
   */
  getKnightStrength(knightId: string): number {
    const unit = this.gameState.getUnit(knightId);
    if (!unit) return 0;
    const unitDef = UNIT_DEFINITIONS[unit.type];
    if (unitDef.category !== 'military') return 0;

    const baseStrength = unit.knightRank; // rank 1-5
    const combatMod = unitDef.combatStrength ?? 1.0;
    const goldBonus = this.getGoldBonus(unit.playerId);

    return baseStrength * combatMod * goldBonus;
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
