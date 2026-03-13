import type { ResourceType } from './ResourceType';

/** Time window for rolling rate calculations (seconds) */
const RATE_WINDOW = 300; // 5 minutes

/** Max history points for sparklines */
const MAX_HISTORY = 10;

/** Sample interval for history snapshots (seconds) */
const HISTORY_INTERVAL = 30;

interface ResourceEvent {
  resource: ResourceType;
  amount: number;
  timestamp: number;
}

/**
 * Tracks production and consumption events over a rolling time window.
 * Provides rates, net balance, bottleneck detection, and sparkline history.
 */
export class EconomyTracker {
  private productionEvents: ResourceEvent[] = [];
  private consumptionEvents: ResourceEvent[] = [];
  private gameTime = 0;
  private historyTimer = 0;

  /** Rolling history snapshots for sparklines: resource → number[] */
  private productionHistory: Map<string, number[]> = new Map();
  private consumptionHistory: Map<string, number[]> = new Map();

  /** Record a production event (building produced output) */
  recordProduction(resource: ResourceType, amount = 1): void {
    this.productionEvents.push({ resource, amount, timestamp: this.gameTime });
  }

  /** Record a consumption event (building consumed input) */
  recordConsumption(resource: ResourceType, amount = 1): void {
    this.consumptionEvents.push({ resource, amount, timestamp: this.gameTime });
  }

  /** Update time and prune old events */
  update(deltaTime: number): void {
    this.gameTime += deltaTime;

    // Prune events older than the rate window
    const cutoff = this.gameTime - RATE_WINDOW;
    this.productionEvents = this.productionEvents.filter((e) => e.timestamp >= cutoff);
    this.consumptionEvents = this.consumptionEvents.filter((e) => e.timestamp >= cutoff);

    // Snapshot history periodically
    this.historyTimer += deltaTime;
    if (this.historyTimer >= HISTORY_INTERVAL) {
      this.historyTimer -= HISTORY_INTERVAL;
      this.snapshotHistory();
    }
  }

  /** Get production rate per minute for a resource */
  getProductionRate(resource: ResourceType): number {
    const events = this.productionEvents.filter((e) => e.resource === resource);
    const total = events.reduce((sum, e) => sum + e.amount, 0);
    const elapsed = Math.min(this.gameTime, RATE_WINDOW);
    return elapsed > 0 ? (total / elapsed) * 60 : 0;
  }

  /** Get consumption rate per minute for a resource */
  getConsumptionRate(resource: ResourceType): number {
    const events = this.consumptionEvents.filter((e) => e.resource === resource);
    const total = events.reduce((sum, e) => sum + e.amount, 0);
    const elapsed = Math.min(this.gameTime, RATE_WINDOW);
    return elapsed > 0 ? (total / elapsed) * 60 : 0;
  }

  /** Get net balance (production - consumption) per minute */
  getNetBalance(resource: ResourceType): number {
    return this.getProductionRate(resource) - this.getConsumptionRate(resource);
  }

  /** Get all resources with negative net balance (bottlenecks) */
  getBottlenecks(): ResourceType[] {
    const resources = new Set<ResourceType>();
    for (const e of this.consumptionEvents) resources.add(e.resource);

    const bottlenecks: ResourceType[] = [];
    for (const r of resources) {
      if (this.getNetBalance(r) < -0.1) {
        bottlenecks.push(r);
      }
    }
    return bottlenecks;
  }

  /** Get production history for sparkline (array of up to MAX_HISTORY values) */
  getProductionHistory(resource: ResourceType): number[] {
    return this.productionHistory.get(resource) ?? [];
  }

  /** Get consumption history for sparkline */
  getConsumptionHistory(resource: ResourceType): number[] {
    return this.consumptionHistory.get(resource) ?? [];
  }

  /** Get all resources that have any activity */
  getActiveResources(): ResourceType[] {
    const resources = new Set<ResourceType>();
    for (const e of this.productionEvents) resources.add(e.resource);
    for (const e of this.consumptionEvents) resources.add(e.resource);
    return Array.from(resources);
  }

  private snapshotHistory(): void {
    const resources = this.getActiveResources();
    for (const r of resources) {
      const prodRate = this.getProductionRate(r);
      const consRate = this.getConsumptionRate(r);

      const prodHist = this.productionHistory.get(r) ?? [];
      prodHist.push(prodRate);
      if (prodHist.length > MAX_HISTORY) prodHist.shift();
      this.productionHistory.set(r, prodHist);

      const consHist = this.consumptionHistory.get(r) ?? [];
      consHist.push(consRate);
      if (consHist.length > MAX_HISTORY) consHist.shift();
      this.consumptionHistory.set(r, consHist);
    }
  }
}
