---
name: feudal-game-balance
description: Reference map of all tunable game constants and their locations. Production timing, costs, unit speeds, combat math, territory, spawning, logistics, map generation, AI thresholds.
---

# Game Balance Reference

## When to Use
- Tuning production times, costs, or rates
- Adjusting combat math or military balance
- Changing map generation parameters
- Tweaking AI difficulty
- Investigating why a production chain is bottlenecked

## Production Timing

**Location:** `src/game/BuildingType.ts` → `BUILDING_DEFINITIONS` → `production.productionTime`

| Building | Output | Time (s) | Effective Rate |
|----------|--------|----------|----------------|
| WoodcutterHut | Wood | Variable* | ~1/8-15s |
| ForesterHut | (plants trees) | Variable* | ~1/15s |
| Quarry | Stone | Variable* | ~1/10-15s |
| FishermanHut | Fish | Variable* | ~1/12s |
| Farm | Grain | 20s | 1/20s |
| Sawmill | Planks | 12s | 1/12s |
| Windmill | Flour | 10s | 1/10s |
| Bakery | Bread | 15s | 1/15s |
| PigFarm | Pigs | 25s | 1/25s |
| Slaughterhouse | Meat | 12s | 1/12s |
| IronSmelter | Iron Bars | 20s | 1/20s |
| ToolmakerWorkshop | Tools | 15s | 1/15s |
| BlacksmithArmory | Swords/Shields | 20s | 1/20s |
| GoldsmithMint | Gold Bars | 25s | 1/25s |

*Variable = gathering buildings affected by distance multiplier.

**Distance multiplier formula:**
```
Location: src/game/BuildingType.ts or ProductionManager
multiplier = min(3.0, 1.0 + max(0, distance - 1) * 0.25)
effectiveTime = baseTime * multiplier
```

## Hunger & Feeding

**Location:** `src/game/data/balanceConstants.ts` (constants), `src/game/FeedingManager.ts` (logic)

| Constant | Value | Effect |
|----------|-------|--------|
| HUNGER_DECAY_RATE | 0.001/s | Full→empty in 1000s (16.7 min) |
| HUNGER_WORKING_MULTIPLIER | 1.0 | No extra penalty for working |
| HUNGER_GARRISONED_MULTIPLIER | 0.5 | Knights in garrison decay slower |
| HUNGER_FOOD_PRODUCER_MULTIPLIER | 0.5 | Food chain workers decay at 0.0005/s |
| HUNGER_HUNGRY_THRESHOLD | 0.35 | Amber bar / hungry penalties |
| HUNGER_STARVING_THRESHOLD | 0.15 | Red bar / starving penalties |
| Feed threshold | 0.80 | Units eat when satiation < this |
| FEEDING_INTERVAL | 5.0s | How often feeding is checked |

**Food satiation values** (`src/game/ResourceType.ts`):
Fish 0.50, Fruit 0.45, Beer 0.30, Wine 0.35, Cheese 0.60, Bread 0.70, Meat 0.90

**Feed priority**: Knights (0) > Miners (1) > Food producers (1.5) > Workers (2) > Idle (4)

> Penalty functions exist but are NOT wired into ProductionManager or UnitManager. See `docs/food-system.md`.

## Construction Costs

**Location:** `src/game/BuildingType.ts` → `BUILDING_DEFINITIONS` → `cost[]`

Typical ranges:
- Tier 1: 2-3 Planks, 1-2 Stone
- Tier 2: 3-4 Planks, 2-3 Stone
- Tier 3: 4-6 Planks, 3-5 Stone

## Construction Time

**Location:** `src/game/BuildingType.ts` → `BUILDING_DEFINITIONS` → `constructionTime`

Typical range: 20-40 seconds. Castle: instant (starting building).

## Unit Speeds

**Location:** `src/game/UnitType.ts` → `UNIT_DEFINITIONS` → `moveSpeed`

| Unit | Speed (units/s) |
|------|----------------|
| Transporter | 2.0 |
| Builder | 1.5 |
| Knight | 1.8 |
| Most workers | 1.5 |

## Combat Math

**Location:** `src/game/CombatManager.ts`

Key parameters:
- Knight base attack/defense values
- Rank bonuses (ranks 1-5, earned through combat victories)
- Gold Bar global combat bonus
- Duel resolution formula

**Rank system:**
- Rank 1: base stats
- Each rank: bonus to attack/defense
- Promoted after winning a duel

**Gold bonus:**
- Each Gold Bar delivered to military building provides global combat buff
- Applied to all knights of that player

## Territory Influence

**Location:** `src/game/BuildingType.ts` → `influenceRadius`

| Building | Influence Radius |
|----------|-----------------|
| Castle | Large (starting territory) |
| GuardHut | Small |
| Watchtower | Medium |
| Barracks | Large |

**Location:** `src/game/TerritoryManager.ts`

Territory recalculates when military buildings are placed, completed, or destroyed.

## Knight Recruitment

**Location:** `src/game/KnightManager.ts`

Requirements:
- Military building with empty knight slot
- Sword + Shield delivered to the building
- Idle serf available
- Serf walks to building → becomes Knight

## Spawning & Population

**Location:** `src/game/UnitManager.ts`

- Serfs spawn from Castle
- Spawn interval: configurable (check UnitManager for exact timing)
- Population cap: depends on Castle + housing (expansion adds houses)

## Starting Resources

**Location:** `src/engine/Game.ts` or `src/game/GameState.ts`

Castle starts with initial inventory — check the starting resources in Game.start() or the config.

## Logistics Config

**Location:** `src/game/LogisticsManager.ts` and `src/game/GoodsDistribution.ts`

- Routing score: `importance × priority / distance`
- Resource priority: 1-5 (per resource type)
- Building importance: 1-5 (per building)
- One transporter per road segment between two flags

## Map Generation

**Location:** Map generation files (likely `src/game/MapGenerator.ts` or similar)

Key parameters:
- Map size (hex grid dimensions)
- Terrain distribution (DEFAULT_BALANCE percentages)
- Noise layers (elevation, moisture)
- Mineral deposit distribution
- Water border width
- Castle placement algorithm

## AI Parameters

**Location:** `src/game/AIPlayer.ts`

| Parameter | Easy | Normal | Hard |
|-----------|------|--------|------|
| Build order | Economic | Balanced | Aggressive |
| Attack threshold step | 16 | 12 | 8 |
| Knights per attack | 1 | 1 | 2 |
| Skip chance | 30% | 0% | 0% |
| Attack cooldown | Standard | Standard | Halved on threat |

## Balance Testing Methodology

### Via Chrome DevTools MCP

```javascript
// Check production rates
game.getEconomyTracker().getProductionRate('planks')
game.getEconomyTracker().getConsumptionRate('planks')
game.getEconomyTracker().getNetBalance('planks')
game.getEconomyTracker().getBottlenecks()

// Check building states
game.getGameState().getAllBuildings().filter(b => b.status === 'active').length
game.getGameState().getAllBuildings().filter(b => b.status === 'waiting_resources').length

// Check unit counts
game.getGameState().getAllUnits().length
game.getGameState().getUnitsByType('knight').length

// Check territory
game.getTerritoryManager().getTerritory(1).size // Player 1 territory hexes
```

### Balance Indicators

- **Bottleneck:** Consumption rate > production rate for a resource
- **Oversupply:** Net balance consistently positive (wasted capacity)
- **Starvation:** Buildings waiting for resources indefinitely
- **Rush imbalance:** One strategy dominates regardless of map

## Key Files
- `src/game/BuildingType.ts` — Production times, costs, recipes
- `src/game/UnitType.ts` — Unit speeds, tool requirements
- `src/game/CombatManager.ts` — Combat formulas
- `src/game/KnightManager.ts` — Recruitment mechanics
- `src/game/TerritoryManager.ts` — Influence calculation
- `src/game/LogisticsManager.ts` — Routing formula
- `src/game/AIPlayer.ts` — AI difficulty parameters
- `src/game/EconomyTracker.ts` — Rate tracking for verification

## Verification
After any balance change:
1. `npm run build` + `npm run test` — no regressions
2. Play 5 minutes — watch economy tracker for bottlenecks
3. Test all 3 AI difficulties — verify reasonable difficulty curve
4. Check that no single strategy dominates
