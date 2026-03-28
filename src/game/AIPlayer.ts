import { BuildingType, BUILDING_DEFINITIONS } from './BuildingType';
import { BuildingState, getInventoryTotal, getInventoryAmount } from './Building';
import type { Building } from './Building';
import type { HexGrid, HexCoord } from './HexGrid';
import type { GameState } from './GameState';
import type { TerritoryManager } from './TerritoryManager';
import type { AttackManager } from './AttackManager';
import type { KnightManager } from './KnightManager';
import type { UpgradeManager } from './UpgradeManager';
import { Difficulty } from './GameConfig';
import { DIFFICULTY_CONFIGS, MAX_HEX_RETRIES } from './data/aiBuildOrders';
import type { DifficultyConfig } from './data/aiBuildOrders';
import { UnitType } from './UnitType';
import { UnitState } from './Unit';
import type { ResourceType } from './ResourceType';
import {
  UpgradeAxis,
  canUpgrade,
  getUpgradeCost,
  getEffectiveStorageCapacity,
} from './BuildingUpgrade';
import { autoConnectBuilding } from './AutoRoad';
import type { RoadNetwork } from './RoadNetwork';
import type { PopulationManager } from './PopulationManager';
import type { MarketplaceManager } from './MarketplaceManager';
import {
  AI_TRADE_CHECK_INTERVAL,
  AI_TRADE_SURPLUS_THRESHOLD,
  AI_TRADE_SHORTAGE_THRESHOLD,
  AI_TRADE_PRICE_SENSITIVITY,
} from './data/balanceConstants';

/** Callback to render a newly placed building. */
export type BuildingPlacedCallback = (building: Building, grid: HexGrid) => void;

/**
 * Heuristic AI controller for a non-human player.
 *
 * Three strategy templates are selected based on difficulty:
 *   - Easy → Economic (full chains, delayed military, attacks at step 16, skips 30% of ticks)
 *   - Normal → Balanced (mixed economy/military, attacks at step 12)
 *   - Hard → Aggressive (fewer eco buildings, early military, attacks at step 8, sends 2 knights)
 *
 * Decision priorities (evaluated each tick):
 *   1. Economy: follow the selected build order, placing buildings when affordable
 *   2. Military: attack the weakest enemy military building with available knights
 *
 * Threat response: when `onUnderAttack()` is called, the next attack cooldown is halved.
 * Territory expansion is handled implicitly via GuardHuts in the build order.
 */
export class AIPlayer {
  private readonly playerId: number;
  private readonly difficulty: Difficulty;
  private readonly gameState: GameState;
  private readonly territoryManager: TerritoryManager;
  private readonly attackManager: AttackManager;
  private readonly knightManager: KnightManager;
  private readonly upgradeManager: UpgradeManager;
  private readonly roadNetwork: RoadNetwork;
  private readonly populationManager: PopulationManager;
  private readonly onBuildingPlaced: BuildingPlacedCallback;
  private readonly config: DifficultyConfig;

  /** Strategy-specific build order (selected based on difficulty). */
  private readonly buildOrder: BuildingType[];

  /** Current position in the build order */
  private buildOrderIndex = 0;

  /** Consecutive ticks where the current building had no valid hex */
  private hexRetryCount = 0;

  /** Seconds between economy decisions */
  readonly decisionInterval: number;
  private decisionCooldown: number;

  /** Seconds between attack attempts (set in constructor based on difficulty) */
  readonly attackInterval: number;
  private attackCooldown: number;

  /** Set to true when the AI is under attack; halves attack cooldown for one cycle. */
  private underThreat = false;

  /** Marketplace manager reference (set after construction) */
  private marketplaceManager: MarketplaceManager | null = null;

  /** Timer for AI trade evaluations */
  private tradeCooldown = AI_TRADE_CHECK_INTERVAL;

  constructor(
    playerId: number,
    difficulty: Difficulty,
    gameState: GameState,
    territoryManager: TerritoryManager,
    attackManager: AttackManager,
    knightManager: KnightManager,
    upgradeManager: UpgradeManager,
    roadNetwork: RoadNetwork,
    populationManager: PopulationManager,
    onBuildingPlaced: BuildingPlacedCallback,
  ) {
    this.playerId = playerId;
    this.difficulty = difficulty;
    this.gameState = gameState;
    this.territoryManager = territoryManager;
    this.attackManager = attackManager;
    this.knightManager = knightManager;
    this.upgradeManager = upgradeManager;
    this.roadNetwork = roadNetwork;
    this.populationManager = populationManager;
    this.onBuildingPlaced = onBuildingPlaced;

    this.config = DIFFICULTY_CONFIGS[difficulty];
    this.buildOrder = this.config.buildOrder;
    this.decisionInterval = this.config.decisionInterval;
    this.attackInterval = this.config.attackInterval;

    // Stagger initial decision so multiple AIs don't all act on the same tick.
    // Uses a deterministic offset based on playerId to avoid random seeding issues in tests.
    this.decisionCooldown = this.decisionInterval * (0.5 + (playerId % 4) * 0.1);
    this.attackCooldown = this.attackInterval * 0.6; // first attack slightly before the full interval
  }

  /** Set the marketplace manager for AI trading. */
  setMarketplaceManager(mp: MarketplaceManager): void {
    this.marketplaceManager = mp;
  }

  update(deltaTime: number): void {
    this.decisionCooldown -= deltaTime;
    this.attackCooldown -= deltaTime;

    if (this.decisionCooldown <= 0) {
      this.decisionCooldown = this.decisionInterval;

      // Some difficulties skip a fraction of decision ticks
      if (this.config.skipChance === 0 || Math.random() >= this.config.skipChance) {
        this.checkHousingNeeds();
        this.checkMilitaryBalance();
        this.tryBuildNext();
        this.manageToolQueue();
        // Only try upgrades once economy is established
        if (this.buildOrderIndex > 8) {
          this.tryUpgrade();
        }
      }
    }

    if (this.attackCooldown <= 0) {
      // When under threat, halve the attack cooldown for faster response
      this.attackCooldown = this.underThreat
        ? this.attackInterval * 0.5
        : this.attackInterval;
      // Reset threat flag after one attack cycle
      this.underThreat = false;
      this.tryAttack();
    }

    // Trade evaluation
    if (this.marketplaceManager) {
      this.tradeCooldown -= deltaTime;
      if (this.tradeCooldown <= 0) {
        this.tradeCooldown = AI_TRADE_CHECK_INTERVAL;
        this.tryTrade();
      }
    }
  }

  /**
   * Reactively build housing when population usage is high.
   * Tries the best affordable house (Large > Medium > Small).
   */
  private checkHousingNeeds(): void {
    if (this.populationManager.getUsageRatio(this.playerId) < 0.8) return;

    const housePriority: BuildingType[] = [
      BuildingType.LargeHouse,
      BuildingType.MediumHouse,
      BuildingType.SmallHouse,
    ];

    for (const type of housePriority) {
      if (!this.canAfford(type)) continue;
      const coord = this.findValidHex(type);
      if (!coord) continue;

      const result = this.gameState.placeBuilding(type, coord, this.playerId);
      if (result.ok) {
        this.onBuildingPlaced(result.building, this.gameState.getGrid());
        this.territoryManager.markDirty();
        autoConnectBuilding(coord, this.playerId, this.roadNetwork, this.gameState.getGrid());
        return;
      }
    }
  }

  /**
   * Attempt to build the next building in the economy build order.
   * - Waits if the AI cannot afford the building.
   * - Skips the building after MAX_HEX_RETRIES if no valid placement hex exists.
   */
  private tryBuildNext(): void {
    if (this.buildOrderIndex >= this.buildOrder.length) return;

    const type = this.buildOrder[this.buildOrderIndex];

    // Skip buildings that need terrain the AI doesn't have
    if (this.shouldSkipForTerrain(type)) {
      this.buildOrderIndex++;
      this.hexRetryCount = 0;
      return;
    }

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
      // Auto-connect the new building to the road network
      autoConnectBuilding(coord, this.playerId, this.roadNetwork, this.gameState.getGrid());
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
   * Try to send available knight(s) to attack the weakest enemy military building.
   * Only activates once the economy is established (build order past the
   * strategy's attack threshold). Hard difficulty sends up to 2 knights per attack.
   */
  private tryAttack(): void {
    if (this.buildOrderIndex < this.config.attackThreshold) return;

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

    // Sort by strength descending — send strongest knight(s) first
    availableKnights.sort(
      (a, b) =>
        this.knightManager.getKnightStrength(b.id) -
        this.knightManager.getKnightStrength(a.id),
    );

    const knightsToSend = this.config.knightsPerAttack;
    for (let i = 0; i < Math.min(knightsToSend, availableKnights.length); i++) {
      this.attackManager.orderAttack(availableKnights[i].id, target.id);
    }
  }

  /**
   * Try to upgrade a building. Prioritizes production speed for buildings
   * with production recipes, then storage for buildings that are nearly full.
   */
  private tryUpgrade(): void {
    const resources = this.getStoredResources();
    const myBuildings = this.gameState.getBuildingsByPlayer(this.playerId)
      .filter((b) => b.state === BuildingState.Active && !b.activeUpgrade);

    for (const building of myBuildings) {
      // Try production upgrade first
      if (canUpgrade(building, UpgradeAxis.Production)) {
        const cost = getUpgradeCost(building.type, UpgradeAxis.Production, building.upgradeLevels?.[UpgradeAxis.Production] ?? 0);
        if (cost && this.canAffordCost(resources, cost)) {
          this.upgradeManager.startUpgrade(building.id, UpgradeAxis.Production);
          return;
        }
      }

      // Then storage if output is 80%+ full
      if (canUpgrade(building, UpgradeAxis.Storage)) {
        const cap = getEffectiveStorageCapacity(building);
        const outputTotal = getInventoryTotal(building.outputInventory);
        if (outputTotal >= cap * 0.8) {
          const cost = getUpgradeCost(building.type, UpgradeAxis.Storage, building.upgradeLevels?.[UpgradeAxis.Storage] ?? 0);
          if (cost && this.canAffordCost(resources, cost)) {
            this.upgradeManager.startUpgrade(building.id, UpgradeAxis.Storage);
            return;
          }
        }
      }
    }
  }

  /** Check if stored resources can cover a cost array */
  private canAffordCost(
    resources: Partial<Record<ResourceType, number>>,
    cost: { resource: ResourceType; amount: number }[],
  ): boolean {
    for (const c of cost) {
      if ((resources[c.resource] ?? 0) < c.amount) return false;
    }
    return true;
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

  /**
   * AI trading: sell surplus resources for ones in shortage.
   * Trades via castle (always available) or market (if built).
   */
  private tryTrade(): void {
    const mp = this.marketplaceManager;
    if (!mp) return;

    const stocks = this.getStoredResources();
    const entries = Object.entries(stocks) as [ResourceType, number][];
    if (entries.length < 2) return;

    // Find the resource with the largest surplus
    let surplusRes: ResourceType | null = null;
    let surplusAmount = 0;
    for (const [res, amount] of entries) {
      if (amount > AI_TRADE_SURPLUS_THRESHOLD * 10 && amount > surplusAmount) {
        // Check price sensitivity — don't sell if the price is already crashed
        const mul = mp.getPriceMultiplier(this.playerId, res);
        if (mul >= 1 / AI_TRADE_PRICE_SENSITIVITY) {
          surplusRes = res;
          surplusAmount = amount;
        }
      }
    }

    if (!surplusRes) return;

    // Find the resource with the most critical shortage
    // Prefer food, then construction materials, then tools
    let shortageRes: ResourceType | null = null;
    let lowestStock = Infinity;
    for (const [res, amount] of entries) {
      if (res === surplusRes) continue;
      if (amount < AI_TRADE_SHORTAGE_THRESHOLD * 10 && amount < lowestStock) {
        const mul = mp.getPriceMultiplier(this.playerId, res);
        if (mul <= AI_TRADE_PRICE_SENSITIVITY) {
          shortageRes = res;
          lowestStock = amount;
        }
      }
    }

    if (!shortageRes) return;

    // Determine venue: market if available, otherwise castle
    const hasMarket = this.gameState.getBuildingsByPlayer(this.playerId)
      .some(b => b.type === BuildingType.Market && b.state === BuildingState.Active && b.hasWorker);
    const venue = hasMarket ? 'market' : 'castle';

    // Trade a modest amount (don't go all-in)
    const tradeAmount = Math.min(5, Math.floor(surplusAmount * 0.3));
    if (tradeAmount <= 0) return;

    mp.executeTrade(this.playerId, surplusRes, tradeAmount, shortageRes, venue);
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
   * Skip buildings that require terrain not present in the AI's territory.
   * E.g., skip FishermanHut if no water nearby, skip StoneMine if no mountain.
   */
  /**
   * Skip buildings that require water/desert terrain not present anywhere on the map.
   * Forest/mountain are common enough that we don't skip for them.
   */
  private shouldSkipForTerrain(type: BuildingType): boolean {
    const def = BUILDING_DEFINITIONS[type];
    if (!def.harvestTerrain) return false;
    // Only skip for rare terrain types that may be completely absent
    if (def.harvestTerrain !== 'water' && def.harvestTerrain !== 'desert') return false;

    const grid = this.gameState.getGrid();
    for (let q = 0; q < grid.width; q++) {
      for (let r = 0; r < grid.height; r++) {
        const tile = grid.getTile(q, r);
        if (tile?.terrain === def.harvestTerrain) return false;
      }
    }
    return true;
  }

  /**
   * Reactively build military when the human player has more military presence.
   * Inserts a GuardHut into the build sequence if outmatched.
   */
  private checkMilitaryBalance(): void {
    const myMilitary = this.gameState.getAllUnits().filter(
      u => u.playerId === this.playerId && u.type === UnitType.Knight
    ).length;

    // Count all enemy military buildings
    let enemyMilitaryCount = 0;
    for (const b of this.gameState.getAllBuildings()) {
      if (b.playerId !== this.playerId && b.state === BuildingState.Active) {
        const bdef = BUILDING_DEFINITIONS[b.type];
        if (bdef.knightSlots > 0) enemyMilitaryCount += b.knightIds.length;
      }
    }

    // If enemy has 2+ more military units, try to build a GuardHut
    if (enemyMilitaryCount >= myMilitary + 2) {
      if (this.canAfford(BuildingType.GuardHut)) {
        const coord = this.findBorderHex(BuildingType.GuardHut);
        if (coord) {
          const result = this.gameState.placeBuilding(BuildingType.GuardHut, coord, this.playerId);
          if (result.ok) {
            this.onBuildingPlaced(result.building, this.gameState.getGrid());
            this.territoryManager.markDirty();
            autoConnectBuilding(coord, this.playerId, this.roadNetwork, this.gameState.getGrid());
          }
        }
      }
    }
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
    const militaryTypes: Set<UnitType> = new Set([
      UnitType.Knight, UnitType.Archer, UnitType.Cavalry,
      UnitType.SiegeOperator, UnitType.Scout,
    ]);
    return this.gameState.getUnitsByPlayer(this.playerId).filter((u) => {
      if (!militaryTypes.has(u.type) || u.state !== UnitState.Working) return false;
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

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Called when one of this AI's buildings is under attack.
   * Sets a threat flag that halves the next attack cooldown, causing
   * the AI to counter-attack sooner.
   */
  onUnderAttack(_buildingId: string): void { // eslint-disable-line @typescript-eslint/no-unused-vars
    this.underThreat = true;
  }

  // ─── Accessors ───────────────────────────────────────────────────────────

  /** Current position in the build order (0-based index into the active strategy). */
  getBuildOrderIndex(): number {
    return this.buildOrderIndex;
  }

  /** The player ID this AI controls. */
  getPlayerId(): number {
    return this.playerId;
  }

  /** The difficulty level this AI was created with. */
  getDifficulty(): Difficulty {
    return this.difficulty;
  }

  /**
   * Override the build order position — for testing only.
   * @internal
   */
  _setBuildOrderIndex(index: number): void {
    this.buildOrderIndex = Math.max(0, Math.min(index, this.buildOrder.length));
  }

  /**
   * Manage tool production queue at AI Toolmaker buildings.
   * Looks ahead in build order and queues tools needed by upcoming buildings.
   * Also prioritizes tools for buildings currently waiting.
   */
  private manageToolQueue(): void {
    const buildings = this.gameState.getBuildingsByPlayer(this.playerId);
    const castle = this.gameState.findCastle(this.playerId);
    if (!castle) return;

    // Find active Toolmaker buildings
    const toolmakers = buildings.filter(b => b.toolQueue !== undefined && b.state === BuildingState.Active);
    if (toolmakers.length === 0) return;

    // Count tools needed: from buildings waiting + upcoming build order
    const needed = new Map<ResourceType, number>();

    // Buildings currently waiting for tools get priority
    for (const b of buildings) {
      if (b.waitingForTool) {
        needed.set(b.waitingForTool, (needed.get(b.waitingForTool) ?? 0) + 1);
      }
    }

    // Look ahead 5 buildings in build order
    const lookahead = Math.min(this.buildOrderIndex + 5, this.buildOrder.length);
    for (let i = this.buildOrderIndex; i < lookahead; i++) {
      const type = this.buildOrder[i];
      const def = BUILDING_DEFINITIONS[type];
      if (!def.workerTool) continue;
      const tool = def.workerTool;
      needed.set(tool, (needed.get(tool) ?? 0) + 1);
    }

    // Subtract tools already in Castle stock + already queued
    for (const [tool, count] of needed) {
      const inStock = getInventoryAmount(castle.outputInventory, tool);
      let queued = 0;
      for (const tm of toolmakers) {
        const entry = tm.toolQueue?.find(e => e.toolType === tool);
        queued += entry?.count ?? 0;
      }
      const deficit = count - inStock - queued;
      if (deficit > 0 && toolmakers.length > 0) {
        // Queue deficit at the first active Toolmaker
        const tm = toolmakers[0];
        const entry = tm.toolQueue?.find(e => e.toolType === tool);
        if (entry) {
          entry.count += deficit;
        }
      }
    }
  }

  /** Serialization: get internal state for save */
  _getState(): {
    playerId: number;
    buildOrderIndex: number;
    hexRetryCount: number;
    decisionCooldown: number;
    attackCooldown: number;
  } {
    return {
      playerId: this.playerId,
      buildOrderIndex: this.buildOrderIndex,
      hexRetryCount: this.hexRetryCount,
      decisionCooldown: this.decisionCooldown,
      attackCooldown: this.attackCooldown,
    };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: {
    buildOrderIndex: number;
    hexRetryCount: number;
    decisionCooldown: number;
    attackCooldown: number;
  }): void {
    this.buildOrderIndex = state.buildOrderIndex;
    this.hexRetryCount = state.hexRetryCount;
    this.decisionCooldown = state.decisionCooldown;
    this.attackCooldown = state.attackCooldown;
  }
}
