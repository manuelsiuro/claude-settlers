import { BuildingType, BUILDING_DEFINITIONS } from './BuildingType';
import { BuildingState } from './Building';
import type { Building } from './Building';
import type { HexGrid, HexCoord } from './HexGrid';
import type { GameState } from './GameState';
import type { TerritoryManager } from './TerritoryManager';
import type { AttackManager } from './AttackManager';
import type { KnightManager } from './KnightManager';
import { Difficulty } from './GameConfig';
import { UnitType } from './UnitType';
import { UnitState } from './Unit';
import type { ResourceType } from './ResourceType';

/** Callback to render a newly placed building. */
export type BuildingPlacedCallback = (building: Building, grid: HexGrid) => void;

/**
 * Build order for the AI economy.
 * Mountain-specific buildings (GeologistHut, IronMine, CoalMine, GoldMine) will be
 * skipped automatically if no mountain tiles exist in the AI's territory.
 * FishermanHut will be skipped if no water-adjacent tiles are available.
 */
const ECONOMY_BUILD_ORDER: BuildingType[] = [
  // ── Tier 1: basic economy ───────────────────────────────────────────────
  BuildingType.WoodcutterHut,
  BuildingType.ForesterHut,
  BuildingType.WoodcutterHut,
  BuildingType.Quarry,
  BuildingType.Sawmill,
  BuildingType.FishermanHut,       // skipped if no water-adjacent hex in territory
  BuildingType.GuardHut,           // placed at border to expand territory

  // ── Tier 2: food & resource extraction ─────────────────────────────────
  BuildingType.Farm,
  BuildingType.GuardHut,           // border expansion
  BuildingType.Warehouse,          // overflow storage before mining chain saturates Castle
  BuildingType.IronMine,           // skipped if no mountain in territory
  BuildingType.CoalMine,           // skipped if no mountain in territory

  // ── Tier 3: processing & military arms ─────────────────────────────────
  BuildingType.Windmill,
  BuildingType.Bakery,
  BuildingType.GuardHut,           // border expansion
  BuildingType.IronSmelter,
  BuildingType.ToolmakerWorkshop,
  BuildingType.BlacksmithArmory,
  BuildingType.Barracks,           // placed at border for max influence
  BuildingType.Watchtower,         // border

  // ── Late game: gold economy + extra military ────────────────────────────
  BuildingType.GoldMine,           // skipped if no mountain in territory
  BuildingType.GoldsmithMint,
  BuildingType.Barracks,
  BuildingType.Barracks,
];

/** Consecutive "no valid hex" ticks before a building is skipped. */
const MAX_HEX_RETRIES = 3;

/**
 * Heuristic AI controller for a non-human player.
 *
 * Decision priorities (evaluated each tick):
 *   1. Economy: follow ECONOMY_BUILD_ORDER, placing buildings when affordable
 *   2. Military: attack the weakest enemy military building with available knights
 *
 * Territory expansion is handled implicitly via GuardHuts in the build order.
 * Difficulty scales decision speed (decisionInterval).
 */
export class AIPlayer {
  private readonly playerId: number;
  private readonly gameState: GameState;
  private readonly territoryManager: TerritoryManager;
  private readonly attackManager: AttackManager;
  private readonly knightManager: KnightManager;
  private readonly onBuildingPlaced: BuildingPlacedCallback;

  /** Current position in ECONOMY_BUILD_ORDER */
  private buildOrderIndex = 0;

  /** Consecutive ticks where the current building had no valid hex */
  private hexRetryCount = 0;

  /** Seconds between economy decisions */
  readonly decisionInterval: number;
  private decisionCooldown: number;

  /** Seconds between attack attempts (set in constructor based on difficulty) */
  readonly attackInterval: number;
  private attackCooldown: number;

  constructor(
    playerId: number,
    difficulty: Difficulty,
    gameState: GameState,
    territoryManager: TerritoryManager,
    attackManager: AttackManager,
    knightManager: KnightManager,
    onBuildingPlaced: BuildingPlacedCallback,
  ) {
    this.playerId = playerId;
    this.gameState = gameState;
    this.territoryManager = territoryManager;
    this.attackManager = attackManager;
    this.knightManager = knightManager;
    this.onBuildingPlaced = onBuildingPlaced;

    switch (difficulty) {
      case Difficulty.Easy:
        this.decisionInterval = 10.0;
        this.attackInterval = 20.0;
        break;
      case Difficulty.Hard:
        this.decisionInterval = 2.5;
        this.attackInterval = 8.0;
        break;
      default: // Normal
        this.decisionInterval = 5.0;
        this.attackInterval = 15.0;
    }

    // Stagger initial decision so multiple AIs don't all act on the same tick.
    // Uses a deterministic offset based on playerId to avoid random seeding issues in tests.
    this.decisionCooldown = this.decisionInterval * (0.5 + (playerId % 4) * 0.1);
    this.attackCooldown = this.attackInterval * 0.6; // first attack slightly before the full interval
  }

  update(deltaTime: number): void {
    this.decisionCooldown -= deltaTime;
    this.attackCooldown -= deltaTime;

    if (this.decisionCooldown <= 0) {
      this.decisionCooldown = this.decisionInterval;
      this.tryBuildNext();
    }

    if (this.attackCooldown <= 0) {
      this.attackCooldown = this.attackInterval;
      this.tryAttack();
    }
  }

  /**
   * Attempt to build the next building in the economy build order.
   * - Waits if the AI cannot afford the building.
   * - Skips the building after MAX_HEX_RETRIES if no valid placement hex exists.
   */
  private tryBuildNext(): void {
    if (this.buildOrderIndex >= ECONOMY_BUILD_ORDER.length) return;

    const type = ECONOMY_BUILD_ORDER[this.buildOrderIndex];

    // Wait for resources if we can't afford it yet.
    // Reset hexRetryCount so resource-wait periods don't consume the retry budget.
    if (!this.canAfford(type)) {
      this.hexRetryCount = 0;
      return;
    }

    // Military buildings (GuardHut, Watchtower, Barracks) go at territory borders
    // to maximise the new area they bring under influence.
    const def = BUILDING_DEFINITIONS[type];
    const coord =
      def.influenceRadius > 0 ? this.findBorderHex(type) : this.findValidHex(type);
    if (!coord) {
      this.hexRetryCount++;
      if (this.hexRetryCount >= MAX_HEX_RETRIES) {
        // Can't place on this map — skip to next
        this.buildOrderIndex++;
        this.hexRetryCount = 0;
      }
      return;
    }

    const result = this.gameState.placeBuilding(type, coord, this.playerId);
    if (result.ok) {
      this.onBuildingPlaced(result.building, this.gameState.getGrid());
      this.territoryManager.markDirty();
      this.buildOrderIndex++;
      this.hexRetryCount = 0;
    } else {
      // canPlace passed but placeBuilding failed — treat as a failed hex attempt
      this.hexRetryCount++;
      if (this.hexRetryCount >= MAX_HEX_RETRIES) {
        this.buildOrderIndex++;
        this.hexRetryCount = 0;
      }
    }
  }

  /**
   * Try to send the strongest available knight to attack the weakest enemy
   * military building. Only activates once the economy is established
   * (build order past step 12).
   */
  private tryAttack(): void {
    if (this.buildOrderIndex < 12) return;

    const availableKnights = this.getAvailableKnights();
    if (availableKnights.length === 0) return;

    const targets = this.getEnemyMilitaryBuildings();
    if (targets.length === 0) return;

    // Prefer proper military buildings (Guard Huts, Watchtowers, Barracks) over Castles.
    // Castles have 0 knight slots and would always win a "fewest defenders" comparison,
    // making the AI bypass all defenses and trivially capture the Castle directly.
    const militaryBuildings = targets.filter((b) => {
      const def = BUILDING_DEFINITIONS[b.type];
      return def.knightSlots > 0;
    });
    const targetPool = militaryBuildings.length > 0 ? militaryBuildings : targets;

    // Target weakest building in pool (fewest knights defending)
    const target = targetPool.reduce((weakest, b) =>
      b.knightIds.length < weakest.knightIds.length ? b : weakest,
    );

    // Send strongest knight
    const knight = availableKnights.sort(
      (a, b) =>
        this.knightManager.getKnightStrength(b.id) -
        this.knightManager.getKnightStrength(a.id),
    )[0];

    this.attackManager.orderAttack(knight.id, target.id);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private canAfford(type: BuildingType): boolean {
    const def = BUILDING_DEFINITIONS[type];
    if (def.cost.length === 0) return true;
    const resources = this.getStoredResources();
    for (const cost of def.cost) {
      if ((resources[cost.resource] ?? 0) < cost.amount) return false;
    }
    return true;
  }

  /** Sum outputInventory across Castle and Warehouses for this player. */
  private getStoredResources(): Partial<Record<ResourceType, number>> {
    const totals: Partial<Record<ResourceType, number>> = {};
    for (const building of this.gameState.getBuildingsByPlayer(this.playerId)) {
      if (building.state !== BuildingState.Active) continue;
      const def = BUILDING_DEFINITIONS[building.type];
      if (def.category !== 'core' && def.category !== 'logistics') continue;
      for (const [resource, amount] of Object.entries(building.outputInventory)) {
        const r = resource as ResourceType;
        totals[r] = (totals[r] ?? 0) + (amount ?? 0);
      }
    }
    return totals;
  }

  /**
   * Find a valid hex in the AI's territory where the given building type can be placed.
   * Iterates territory in shuffled order to spread buildings around.
   */
  private findValidHex(type: BuildingType): HexCoord | null {
    const territory = this.territoryManager.getPlayerTerritory(this.playerId);
    if (territory.length === 0) return null;

    // Fisher-Yates shuffle (in-place on the copy returned by getPlayerTerritory)
    for (let i = territory.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [territory[i], territory[j]] = [territory[j], territory[i]];
    }

    for (const coord of territory) {
      if (this.gameState.canPlace(type, coord, this.playerId) === null) {
        return coord;
      }
    }
    return null;
  }

  /**
   * Find a valid hex at the edge of the AI's territory (adjacent to at least one
   * non-owned tile) where the given building type can be placed.
   * Falls back to findValidHex if no border hex is available.
   */
  private findBorderHex(type: BuildingType): HexCoord | null {
    const territory = this.territoryManager.getPlayerTerritory(this.playerId);
    if (territory.length === 0) return null;

    const grid = this.gameState.getGrid();
    const ownedKeys = new Set(territory.map((c) => `${c.q},${c.r}`));

    // Collect border hexes: owned tiles that have at least one non-owned neighbor.
    const border = territory.filter((coord) => {
      const neighbors = grid.getNeighbors(coord.q, coord.r);
      return neighbors.some((n) => !ownedKeys.has(`${n.coord.q},${n.coord.r}`));
    });

    // Shuffle border tiles for variety.
    for (let i = border.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [border[i], border[j]] = [border[j], border[i]];
    }

    for (const coord of border) {
      if (this.gameState.canPlace(type, coord, this.playerId) === null) {
        return coord;
      }
    }

    // No valid border hex — fall back to anywhere in territory.
    return this.findValidHex(type);
  }

  /**
   * Knights stationed in OUR military buildings that aren't already in combat.
   * Excludes knights whose assignedBuildingId points to an enemy building —
   * those are mid-combat (arrived at target, fighting defenders) and must not
   * receive a second attack order or we corrupt the enemy building's knightIds.
   * Knights with no assigned building are treated as available (unstationed).
   */
  private getAvailableKnights() {
    return this.gameState.getUnitsByPlayer(this.playerId).filter((u) => {
      if (u.type !== UnitType.Knight || u.state !== UnitState.Working) return false;
      if (!u.assignedBuildingId) return true; // unassigned — available
      const b = this.gameState.getBuilding(u.assignedBuildingId);
      return !b || b.playerId === this.playerId; // exclude if assigned to enemy building
    });
  }

  private getEnemyMilitaryBuildings(): Building[] {
    return this.gameState.getAllBuildings().filter((b) => {
      if (b.playerId === this.playerId) return false;
      if (b.state !== BuildingState.Active) return false;
      const def = BUILDING_DEFINITIONS[b.type];
      return def.knightSlots > 0 || def.influenceRadius > 0;
    });
  }

  // ─── Accessors ───────────────────────────────────────────────────────────

  /** Current position in the build order (0-based index into ECONOMY_BUILD_ORDER). */
  getBuildOrderIndex(): number {
    return this.buildOrderIndex;
  }

  /** The player ID this AI controls. */
  getPlayerId(): number {
    return this.playerId;
  }

  /**
   * Override the build order position — for testing only.
   * @internal
   */
  _setBuildOrderIndex(index: number): void {
    this.buildOrderIndex = Math.max(0, Math.min(index, ECONOMY_BUILD_ORDER.length));
  }
}
