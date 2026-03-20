import type { GameState } from './GameState';
import type { PopulationManager } from './PopulationManager';
import type { MoraleManager } from './MoraleManager';
import { BuildingState, hasRequiredInputs, hasOutputSpace } from './Building';
import type { Building } from './Building';
import { BUILDING_DEFINITIONS } from './BuildingType';
import { UNIT_DEFINITIONS } from './UnitType';
import { UnitState } from './Unit';
import type { ResourceType } from './ResourceType';

/** Fixed-capacity circular buffer backed by Float32Array */
export class RingBuffer {
  private data: Float32Array;
  private head = 0;
  private count = 0;

  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.data = new Float32Array(capacity);
  }

  push(value: number): void {
    this.data[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /** Return values oldest-first */
  toArray(): number[] {
    const result: number[] = [];
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      result.push(this.data[(start + i) % this.capacity]);
    }
    return result;
  }

  latest(): number {
    if (this.count === 0) return 0;
    return this.data[(this.head - 1 + this.capacity) % this.capacity];
  }

  get length(): number {
    return this.count;
  }
}

/** Snapshot interval in game-seconds */
const SNAPSHOT_INTERVAL = 30;
/** Max snapshot points (30s × 120 = 60 minutes) */
const MAX_POINTS = 120;

export interface EfficiencySnapshot {
  producing: number;
  waitingInput: number;
  waitingOutput: number;
  noWorker: number;
  paused: number;
  total: number;
}

/**
 * Periodically samples aggregate game stats for dashboard charts.
 * Takes a snapshot every 30 game-seconds, storing up to 120 points (60 minutes).
 */
export class DashboardTracker {
  private gameState: GameState;
  private populationManager: PopulationManager;
  private moraleManager: MoraleManager;
  private playerId: number;

  private timer = 0;
  private initialized = false;

  // Time-series ring buffers
  private populationHistory = new RingBuffer(MAX_POINTS);
  private populationCapHistory = new RingBuffer(MAX_POINTS);
  private satiationHistory = new RingBuffer(MAX_POINTS);
  private moraleHistory = new RingBuffer(MAX_POINTS);
  private militaryCountHistory = new RingBuffer(MAX_POINTS);
  private militaryRankHistory = new RingBuffer(MAX_POINTS);
  private stockHistories = new Map<string, RingBuffer>();

  // Building efficiency (latest snapshot)
  private _efficiency: EfficiencySnapshot = {
    producing: 0, waitingInput: 0, waitingOutput: 0,
    noWorker: 0, paused: 0, total: 0,
  };
  private efficiencyHistory = new RingBuffer(MAX_POINTS);

  update(deltaTime: number): void {
    if (deltaTime <= 0) return;

    // Initial snapshot at t=0
    if (!this.initialized) {
      this.initialized = true;
      this.takeSnapshot();
      return;
    }

    this.timer += deltaTime;
    if (this.timer >= SNAPSHOT_INTERVAL) {
      this.timer -= SNAPSHOT_INTERVAL;
      this.takeSnapshot();
    }
  }

  constructor(
    gameState: GameState,
    populationManager: PopulationManager,
    moraleManager: MoraleManager,
    playerId: number,
  ) {
    this.gameState = gameState;
    this.populationManager = populationManager;
    this.moraleManager = moraleManager;
    this.playerId = playerId;
  }

  private takeSnapshot(): void {
    const pid = this.playerId;
    const buildings = this.gameState.getBuildingsByPlayer(pid);
    const units = this.gameState.getUnitsByPlayer(pid);

    // Population
    this.populationHistory.push(this.populationManager.getCurrentPopulation(pid));
    this.populationCapHistory.push(this.populationManager.getCapacity(pid));

    // Satiation
    if (units.length > 0) {
      const avgSat = units.reduce((sum, u) => sum + u.satiation, 0) / units.length;
      this.satiationHistory.push(avgSat);
    } else {
      this.satiationHistory.push(1);
    }

    // Morale
    this.moraleHistory.push(this.moraleManager.getMorale(pid));

    // Military
    const military = units.filter(u => UNIT_DEFINITIONS[u.type].category === 'military');
    this.militaryCountHistory.push(military.length);
    if (military.length > 0) {
      const avgRank = military.reduce((sum, u) => sum + u.knightRank, 0) / military.length;
      this.militaryRankHistory.push(avgRank);
    } else {
      this.militaryRankHistory.push(0);
    }

    // Stock levels + building efficiency (single pass through buildings)
    const stocks = new Map<string, number>();
    let producing = 0, waitingInput = 0, waitingOutput = 0, noWorker = 0, paused = 0, totalProd = 0;

    for (const building of buildings) {
      // Stock levels
      for (const inv of [building.inputInventory, building.outputInventory]) {
        for (const [res, amount] of Object.entries(inv)) {
          if (amount && amount > 0) {
            stocks.set(res, (stocks.get(res) ?? 0) + amount);
          }
        }
      }

      // Efficiency categorization (active production buildings only)
      if (building.state !== BuildingState.Active) continue;
      const def = BUILDING_DEFINITIONS[building.type];
      if (!def.production) continue;
      totalProd++;

      if (building.productionPaused) {
        paused++;
      } else if (!this.isWorkerActive(building)) {
        noWorker++;
      } else if (def.production.inputs.length > 0 && !hasRequiredInputs(building)) {
        waitingInput++;
      } else if (!hasOutputSpace(building)) {
        waitingOutput++;
      } else {
        producing++;
      }
    }

    // Store stock histories
    for (const [res, amount] of stocks) {
      let buf = this.stockHistories.get(res);
      if (!buf) {
        buf = new RingBuffer(MAX_POINTS);
        this.stockHistories.set(res, buf);
      }
      buf.push(amount);
    }
    // Push 0 for tracked resources that had no stock this snapshot
    for (const [res, buf] of this.stockHistories) {
      if (!stocks.has(res)) {
        buf.push(0);
      }
    }

    this._efficiency = { producing, waitingInput, waitingOutput, noWorker, paused, total: totalProd };
    const effPct = totalProd > 0 ? producing / totalProd : 0;
    this.efficiencyHistory.push(effPct);
  }

  private isWorkerActive(building: Building): boolean {
    const worker = this.gameState.getWorkerForBuilding(building.id);
    return worker !== undefined && worker.state === UnitState.Working;
  }

  // ---- Public getters ----

  getPopulationHistory(): number[] { return this.populationHistory.toArray(); }
  getPopulationCapHistory(): number[] { return this.populationCapHistory.toArray(); }
  getSatiationHistory(): number[] { return this.satiationHistory.toArray(); }
  getMoraleHistory(): number[] { return this.moraleHistory.toArray(); }
  getMilitaryCountHistory(): number[] { return this.militaryCountHistory.toArray(); }
  getMilitaryRankHistory(): number[] { return this.militaryRankHistory.toArray(); }
  getEfficiencyHistory(): number[] { return this.efficiencyHistory.toArray(); }

  getStockHistory(resource: ResourceType): number[] {
    return this.stockHistories.get(resource)?.toArray() ?? [];
  }

  /** Get all resources that have stock history data */
  getTrackedResources(): ResourceType[] {
    return Array.from(this.stockHistories.keys()) as ResourceType[];
  }

  getEfficiency(): EfficiencySnapshot { return this._efficiency; }

  getSnapshotCount(): number { return this.populationHistory.length; }
}
