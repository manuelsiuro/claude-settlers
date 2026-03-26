# Food & Hunger System Guide

This document is the single reference for the food/hunger system. Consult it before tuning constants, adding food types, or wiring up hunger penalties.

---

## Architecture Overview

```
FeedingManager (src/game/FeedingManager.ts)
├── decaySatiation()    — reduces unit.satiation every frame
├── feedUnits()         — consumes food from Castle/Warehouse every 5s
├── getUnitFeedPriority() — determines who eats first
└── findBestFood()      — picks cheapest food from storage

Constants: src/game/data/balanceConstants.ts
Food values: src/game/ResourceType.ts → RESOURCE_PROPERTIES[x].satiationValue
Food buildings: src/game/data/buildingDefinitions.ts → production.productionTime
Balance JSON: tools/balance-data.json (must stay in sync)
Tests: src/game/FeedingManager.test.ts, src/game/data/BalanceConfig.test.ts
```

---

## Constants Reference

All hunger constants live in `src/game/data/balanceConstants.ts`:

| Constant | Value | Description |
|----------|-------|-------------|
| `HUNGER_DECAY_RATE` | 0.001/s | Base satiation loss per second. Full→empty in 1000s (16.7 min) |
| `HUNGER_WORKING_MULTIPLIER` | 1.0 | Multiplier for units in Working state (no extra penalty) |
| `HUNGER_GARRISONED_MULTIPLIER` | 0.5 | Multiplier for knights garrisoned in military buildings |
| `HUNGER_FOOD_PRODUCER_MULTIPLIER` | 0.5 | Additional multiplier for workers in food-producing buildings |
| `HUNGER_HUNGRY_THRESHOLD` | 0.35 | Satiation below this → "Hungry" status, amber bar |
| `HUNGER_STARVING_THRESHOLD` | 0.15 | Satiation below this → "Starving" status, red bar |
| `HUNGER_SPEED_PENALTY_HUNGRY` | 0.10 | Speed reduction when hungry (not yet wired) |
| `HUNGER_SPEED_PENALTY_STARVING` | 0.25 | Speed reduction when starving (not yet wired) |
| `HUNGER_PRODUCTION_PENALTY_HUNGRY` | 0.05 | Production reduction when hungry (not yet wired) |
| `HUNGER_PRODUCTION_PENALTY_STARVING` | 0.15 | Production reduction when starving (not yet wired) |

**FeedingManager constants** (hardcoded in `FeedingManager.ts`):

| Constant | Value | Description |
|----------|-------|-------------|
| `FEEDING_INTERVAL` | 5.0s | How often the system attempts to feed units |
| Feed threshold | 0.80 | Units are fed only when satiation drops below this |

---

## Food Resources

Defined in `src/game/ResourceType.ts` → `RESOURCE_PROPERTIES`:

| Resource | Satiation | isDrink | isLuxury | Production Chain |
|----------|-----------|---------|----------|-----------------|
| Fish | 0.50 | No | No | Fisherman's Hut (14s, no inputs) |
| Honey | 0.40 | No | No | Apiary (22s, no inputs). Dual-use: eat directly or process into Mead |
| Fruit | 0.45 | No | No | Orchard (16s, no inputs) |
| Game Meat | 0.55 | No | No | Hunting Lodge (20s, Forest, requires Bow tool) |
| Beer | 0.30 | Yes | No | Grain + Water → Brewery (18s) |
| Wine | 0.35 | Yes | No | Grapes → Winery (20s) |
| Mead | 0.25 | Yes | No | Honey → Meadery (18s). Third morale drink alongside Beer/Wine |
| Cheese | 0.60 | No | No | Hay → Milk → Cheese Maker (16s) |
| Bread | 0.70 | No | No | Grain → Flour → Bakery (14s) |
| Meat | 0.90 | No | No | Grain → Pigs → Slaughterhouse (15s) |
| Fur Coat | 0 | No | Yes | Pelts → Furrier (20s). Luxury good — boosts morale at Inn/Tavern |

Resources with `satiationValue > 0` are automatically classified as food. The `isDrink` flag marks items consumed by the morale system (Inn/Tavern requires drinks via `inputCategories`). The `isLuxury` flag marks luxury goods that provide an optional morale bonus when available at the Inn/Tavern.

### Living World Food Chains

```
Forest → Hunting Lodge [Hunter + Bow] → Game Meat (0.55 sat)
Grassland → Apiary [Beekeeper] → Honey (0.40 sat) → Meadery → Mead (drink, 0.25 sat)
Forest → Trapper's Hut [Trapper] → Pelts → Furrier → Fur Coat (luxury morale)
```

Hunting Lodge and Apiary workers are in `FOOD_PRODUCER_BUILDINGS` — they get reduced hunger decay (0.5x) and priority feeding.

---

## Decay Mechanics

Every frame, `FeedingManager.decaySatiation()` reduces each unit's satiation:

```
satiation -= HUNGER_DECAY_RATE × multiplier × deltaTime
```

**Multiplier stacking:**

| Unit state | Multiplier | Effective rate | Time to starve |
|------------|-----------|----------------|----------------|
| Idle | 1.0 | 0.001/s | 16.7 min |
| Working | 1.0 | 0.001/s | 16.7 min |
| Garrisoned knight | 0.5 | 0.0005/s | 33.3 min |
| Food producer (working) | 1.0 × 0.5 = 0.5 | 0.0005/s | 33.3 min |
| Food producer (idle) | 1.0 × 0.5 = 0.5 | 0.0005/s | 33.3 min |

---

## Food Producer Buildings

Workers in these buildings get the `HUNGER_FOOD_PRODUCER_MULTIPLIER` (0.5x decay) and feed priority 1.5:

```typescript
// Defined in FeedingManager.ts as FOOD_PRODUCER_BUILDINGS
FishermanHut, Orchard, Farm, Windmill, Bakery, PigFarm,
Slaughterhouse, DairyFarm, CheeseMakerBuilding, Hayfield,
Brewery, Winery, Vineyard, CattleRanch, Butchery
```

This prevents the **starvation spiral**: food workers starving → slower food production → less food → more starvation.

---

## Feeding Mechanics

Every `FEEDING_INTERVAL` (5s), `feedUnits()` runs for each player:

1. **Filter**: Skip units with satiation >= 0.80
2. **Sort by priority** (lower = fed first), ties broken by lowest satiation:
   - 0: Knights
   - 1: Miners
   - 1.5: Food producer workers
   - 2: Other working units
   - 3: Other
   - 4: Idle units
3. **Find food**: For each hungry unit, search Castle/Warehouse `outputInventory`
4. **Select cheapest**: `findBestFood()` picks the food with the **lowest** satiation value to preserve high-value food (e.g., uses Fish before Meat)
5. **Apply**: `unit.satiation = min(1.0, satiation + food.satiationValue)`

---

## Penalty System (Not Yet Active)

Two helper functions exist but are **not called** by `ProductionManager` or `UnitManager`:

```typescript
getHungerSpeedMultiplier(satiation)      // movement speed multiplier
getHungerProductionMultiplier(satiation)  // production speed multiplier
```

| Satiation | Status | Speed | Production |
|-----------|--------|-------|------------|
| >= 0.35 | Well-fed | 1.0 | 1.0 |
| 0.15–0.34 | Hungry | 0.90 | 0.95 |
| < 0.15 | Starving | 0.75 | 0.85 |

### To wire up penalties

1. In `ProductionManager.ts`, multiply production timer by `getHungerProductionMultiplier(worker.satiation)`
2. In `UnitManager.ts`, multiply movement speed by `getHungerSpeedMultiplier(unit.satiation)`
3. Update tests for the affected managers
4. Consider exempting food producers from production penalties to avoid death spirals

---

## Food Economy Math

Key ratios for balance verification:

| Metric | Formula | Current Value |
|--------|---------|---------------|
| Feeding frequency | (1.0 - feedThreshold) / decayRate | 1 per 200s |
| Food drain (N workers) | N / feedingFrequency | 15 workers = 1 per 13.3s |
| Fisherman throughput | 1 / productionTime | 1 fish per 14s |
| Units fed per Fisherman | feedingFrequency / productionTime | ~14 (theoretical) |
| Units fed per Fisherman (with transport) | ~60-70% of theoretical | ~8-10 |

---

## How to Tune

### Make food easier
- Decrease `HUNGER_DECAY_RATE` (less hunger per second)
- Increase feed threshold (units eat less often, but waste more satiation)
- Increase `satiationValue` on food resources (each meal lasts longer)
- Decrease `productionTime` on food buildings (more food produced)
- Decrease `HUNGER_FOOD_PRODUCER_MULTIPLIER` (food workers nearly immune)

### Make food harder
- Increase `HUNGER_DECAY_RATE`
- Lower feed threshold
- Decrease `satiationValue` on food resources
- Increase `productionTime` on food buildings
- Wire up the penalty functions (see above)

### After any change
1. Update `resetBalanceDefaults()` in `balanceConstants.ts` to match new values
2. Update `tools/balance-data.json` to stay in sync
3. Update tests in `FeedingManager.test.ts` and `BalanceConfig.test.ts`
4. Run `npm run build && npm run lint && npm run test`
5. Verify in-game with Chrome DevTools: `game.gameState.getAllUnits().map(u => u.satiation)`

---

## Adding a New Food Resource

1. Add to `ResourceType` enum in `src/game/ResourceType.ts`
2. Add entry to `RESOURCE_PROPERTIES` with `satiationValue > 0` (and `isDrink: true` if it's a drink)
3. Create a building that produces it in `src/game/data/buildingDefinitions.ts`
4. If the building is part of the food chain, add its `BuildingType` to the `FOOD_PRODUCER_BUILDINGS` set in `FeedingManager.ts`
5. `findBestFood()` will automatically pick it up since it checks `satiationValue > 0`
6. No changes needed to `FeedingManager` logic — it's generic over all food types

---

## Design History

**2026-03-23 — Food System Rebalance**

Players reported food management was too difficult. Root causes:
- Decay rate 0.002/s meant units starved in 8 min; food consumed every 50s per unit
- Working multiplier 1.2x penalized productive workers
- "Hungry" amber bar appeared at 50% satiation (just 4 min), creating visual panic
- Food producers had no special treatment

Changes: halved decay, removed working penalty, added food producer protection (0.5x decay + priority feeding), lowered feed threshold (0.90→0.80), boosted satiation values, sped up primary food buildings, lowered warning thresholds. Net effect: 4x reduction in food consumption rate.

**Original implementation (2026-03-19 — Expansion Phase B1)**

Initial FeedingManager with 0.005/s decay, 1.2x working, 0.5x garrisoned. Penalty functions created but not wired into gameplay.
