import { describe, it, expect } from 'vitest';
import { EconomyTracker } from './EconomyTracker';
import { ResourceType } from './ResourceType';

describe('EconomyTracker', () => {
  it('should track production rate', () => {
    const tracker = new EconomyTracker();
    tracker.update(60); // advance 60 seconds

    tracker.recordProduction(ResourceType.Wood, 1);
    tracker.recordProduction(ResourceType.Wood, 1);
    tracker.recordProduction(ResourceType.Wood, 1);

    // 3 items in 60s = 3/min
    const rate = tracker.getProductionRate(ResourceType.Wood);
    expect(rate).toBeCloseTo(3.0, 0);
  });

  it('should track consumption rate', () => {
    const tracker = new EconomyTracker();
    tracker.update(60);

    tracker.recordConsumption(ResourceType.Planks, 2);
    tracker.recordConsumption(ResourceType.Planks, 1);

    // 3 items in 60s = 3/min
    const rate = tracker.getConsumptionRate(ResourceType.Planks);
    expect(rate).toBeCloseTo(3.0, 0);
  });

  it('should compute net balance', () => {
    const tracker = new EconomyTracker();
    tracker.update(60);

    tracker.recordProduction(ResourceType.Wood, 5);
    tracker.recordConsumption(ResourceType.Wood, 2);

    const net = tracker.getNetBalance(ResourceType.Wood);
    expect(net).toBeCloseTo(3.0, 0);
  });

  it('should detect bottleneck resources', () => {
    const tracker = new EconomyTracker();
    tracker.update(60);

    tracker.recordConsumption(ResourceType.IronOre, 5);
    tracker.recordProduction(ResourceType.IronOre, 1);

    const bottlenecks = tracker.getBottlenecks();
    expect(bottlenecks).toContain(ResourceType.IronOre);
  });

  it('should prune old events after window', () => {
    const tracker = new EconomyTracker();
    tracker.recordProduction(ResourceType.Wood, 1);
    tracker.update(301); // past the 300s window

    const rate = tracker.getProductionRate(ResourceType.Wood);
    expect(rate).toBe(0); // Old event pruned
  });

  it('should return zero rates for unknown resources', () => {
    const tracker = new EconomyTracker();
    expect(tracker.getProductionRate(ResourceType.GoldBars)).toBe(0);
    expect(tracker.getConsumptionRate(ResourceType.GoldBars)).toBe(0);
  });

  it('should list active resources', () => {
    const tracker = new EconomyTracker();
    tracker.update(10);
    tracker.recordProduction(ResourceType.Wood, 1);
    tracker.recordConsumption(ResourceType.Stone, 1);

    const active = tracker.getActiveResources();
    expect(active).toContain(ResourceType.Wood);
    expect(active).toContain(ResourceType.Stone);
  });
});
