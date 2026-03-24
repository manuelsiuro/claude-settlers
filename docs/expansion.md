# Game Expansion Analysis: Feudal Realm Manager

## Executive Summary

This document proposes 10 interconnected expansion systems for Feudal Realm Manager, adding strategic depth through hunger management, population housing, day/night gameplay effects, advanced transport, ~20 new buildings, ~20 new unit types, ~16 new resources, expanded production chains, a morale system, and comprehensive balance considerations. All systems are designed to integrate with the existing codebase architecture and maintain mobile performance.

**Guiding principles:**
- Every new system must hook into existing manager update loops (`Game.ts` animate cycle)
- New resources, buildings, and units extend the existing `const object + type alias` pattern
- Mobile-first: no new systems that require heavy per-frame computation
- Incremental adoption: each system can be implemented independently, with clear dependency ordering

---

## System 1: Unit Hunger Management

### Overview

All units gain a `satiation` field (0.0–1.0) that decays over time. When satiation drops, units suffer movement speed and production penalties. Units must be fed to maintain peak performance.

### Data Model Changes

**`Unit` interface** (`src/game/Unit.ts`) — add:

```typescript
/** Satiation level 0.0–1.0 (1.0 = fully fed) */
satiation: number;
```

Default: `1.0` on creation.

### Hunger Levels

| Level | Satiation Range | Effect |
|-------|----------------|--------|
| Well-Fed | 0.35–1.0 | No penalty |
| Hungry | 0.15–0.34 | -10% move speed, -5% production speed |
| Starving | 0.00–0.14 | -25% move speed, -15% production speed |

> **Note:** Penalty functions (`getHungerSpeedMultiplier`, `getHungerProductionMultiplier`) exist in `FeedingManager.ts` but are not yet wired into `ProductionManager` or `UnitManager`. Hunger currently only affects UI display (satiation bar colors).

### Decay Formula

```
satiation -= DECAY_RATE * multiplier * deltaTime
```

- **DECAY_RATE:** `0.001` per second (full → starving in ~1000 seconds / 16.7 minutes)
- Working units: no extra penalty (`multiplier = 1.0`)
- Knights in garrison (idle in military building): `multiplier = 0.5` (decay 50% slower)
- **Food producer workers**: additional `0.5x` multiplier (effective rate `0.0005/s`, 33 min to starve)
- Feeding threshold: units are fed when satiation drops below `0.80`

### Food Quality Tiers

Each food type restores a different amount of satiation when consumed:

| Food | Satiation Restored | Production Chain Complexity |
|------|-------------------|---------------------------|
| Fish | 0.50 | Tier 1 (direct gathering, 14s) |
| Fruit | 0.45 | Tier 1 (direct gathering, 16s) |
| Beer | 0.30 | Tier 2 (Grain → Beer, 18s) — also morale |
| Wine | 0.35 | Tier 3 (Grapes → Wine, 20s) — also morale |
| Cheese | 0.60 | Tier 2 (Hay → Milk → Cheese, 16s) |
| Bread | 0.70 | Tier 3 (Grain → Flour → Bread, 14s) |
| Meat | 0.90 | Tier 3 (Grain → Pigs → Meat, 15s) |

### Feeding Priority

`FeedingManager` feeds units from Castle/Warehouse inventories every 5 seconds:

1. **Knights** (priority 0) — military must eat
2. **Miners** (priority 1) — resource extraction critical
3. **Food producer workers** (priority 1.5) — prevents starvation spiral
4. **Other working units** (priority 2)
5. **Idle units** (priority 4) — lowest priority

Food selection: cheapest satiation value first (preserves high-value foods). See `docs/food-system.md` for the full system guide.

### Integration Point

- `FeedingManager.update()` decays satiation and feeds units each frame
- Production timer in `ProductionManager` multiplied by `getHungerProductionMultiplier(unit.satiation)` *(not yet wired)*
- Movement speed in `UnitManager` multiplied by `getHungerSpeedMultiplier(unit.satiation)` *(not yet wired)*

---

## System 2: Population & Housing

### Overview

Population is capped by housing capacity. The Castle provides a base capacity, and House buildings increase the cap. Units cannot be spawned when population equals capacity.

### Housing Tiers

| Building | Population Capacity | Cost | Construction Time | Tier |
|----------|-------------------|------|------------------|------|
| Castle (existing) | 15 | — | — | 0 |
| Small House (new) | 8 | 3 Wood, 2 Planks | 20s | 1 |
| Medium House (new) | 16 | 4 Wood, 3 Planks, 2 Stone | 35s | 2 |
| Large House (new) | 25 | 5 Wood, 4 Planks, 4 Stone, 2 Iron Bars | 50s | 3 |

### Data Model Changes

**`BuildingDefinition`** (`src/game/BuildingType.ts`) — add:

```typescript
/** Population capacity this building provides (0 for non-housing) */
populationCapacity: number;
```

### Population Mechanics

- **Total capacity** = sum of `populationCapacity` across all completed buildings
- **Current population** = count of all living units owned by the player
- **Spawn gate**: Castle `UnitSpawner` checks `currentPopulation < totalCapacity` before spawning
- **No night return**: housing is an abstract capacity system, not a physical destination. Units never walk home to houses.
- **Housing destruction**: if a house is destroyed and population exceeds new cap, no units die immediately, but no new units can spawn until capacity is restored

### Building Category

Houses use a new category: `'housing'`.

```typescript
export type BuildingCategory = 'core' | 'gathering' | 'processing' | 'military' | 'logistics' | 'housing';
```

### UI Integration

- Population counter in the top HUD: `Population: 23/40`
- Warning notification when population reaches 90% capacity
- House buildings appear in a new "Housing" tab in the construction menu

---

## System 3: Day/Night Gameplay Effects

### Overview

The existing `AtmosphereController` provides a `nightness` factor (0.0 = full day, 1.0 = full night) that drives visual lighting. This system extends `nightness` to affect gameplay: unit speeds, production rates, and visibility.

### Speed Penalties

```
effectiveSpeed = baseSpeed × (1 - nightness × maxPenalty)
```

| Unit Category | Max Night Penalty | Formula at nightness=1.0 |
|---------------|-------------------|-------------------------|
| Civilian workers | 40% | `speed × 0.60` |
| Transporters | 35% | `speed × 0.65` |
| Knights | 15% | `speed × 0.85` |
| Builders | 30% | `speed × 0.70` |

### Production Slowdown

```
effectiveProductionTime = baseProductionTime / (1 - nightness × 0.25)
```

At full night, production takes 33% longer (1/0.75 = 1.33×).

### Vision Reduction

```
effectiveVisionRadius = baseVisionRadius × (1 - nightness × 0.30)
```

Military buildings see 30% less at night. Compensated by the existing `FlagLightSystem` which illuminates road networks.

### Integration Points

- `AtmosphereController.onNightnessUpdate` callback already fires each frame with the interpolated nightness value
- `Game.ts` stores `currentNightness` and passes it to `UnitManager`, `ProductionManager`, and `TerritoryManager`
- No new systems needed — just multipliers applied in existing update loops

### Torches & Lighting Mitigation

- Buildings within range of a flag with a streetlight (existing `FlagLightSystem`) get a 50% reduction in night penalty
- New building: **Torch Tower** (see System 5) — a cheap military-adjacent building that provides a light radius, reducing night penalties for nearby units

---

## System 4: Advanced Transport

### Overview

Replace the current single-item-per-transporter model with a tiered transport system using animals and vehicles, gated by road quality.

### Transport Tiers

| Tier | Transport Method | Carry Capacity | Base Speed (hex/s) | Required Road |
|------|-----------------|---------------|-------------------|---------------|
| 0 | Foot (current) | 1 item | 0.55 | Any path |
| 1 | Donkey | 3 items | 0.45 | Dirt road+ |
| 2 | Cart (hand-pulled) | 6 items | 0.35 | Stone road+ |
| 3 | Horse Cart | 8 items | 0.60 | Paved road |

### Road Quality System

Roads gain a `quality` level that determines which transport types can use them:

| Road Level | Name | Cost per Segment | Build Time | Visual |
|------------|------|-----------------|------------|--------|
| 0 | Path | Free (current) | Instant | Dirt trail |
| 1 | Dirt Road | 1 Planks | 5s | Packed earth |
| 2 | Stone Road | 2 Stone | 10s | Cobblestone |
| 3 | Paved Road | 2 Stone, 1 Planks | 15s | Smooth stone |

Road upgrades are performed by Builders. Higher quality roads also reduce travel time for foot transporters:

```
footSpeedMultiplier = 1.0 + roadLevel × 0.10
```

### Terrain-Weighted Pathfinding

The existing `Pathfinding.ts` uses a flat `cost = 1` per hex (line 78). The `TerrainType.ts` already defines `movementCost` per terrain:

| Terrain | movementCost |
|---------|-------------|
| Grassland | 1.0 |
| Forest | 1.5 |
| Mountain | 3.0 |
| Desert | 2.0 |
| Water | Infinity |

**Change required** in `findPath()`:

```typescript
// Line 78: replace flat cost
// FROM: const tentativeG = currentG + 1;
// TO:
const terrainCost = TERRAIN_PROPERTIES[neighborTile.terrain].movementCost;
const tentativeG = currentG + terrainCost;
```

This single-line change activates terrain-weighted pathfinding for all units.

### Animal Lifecycle

Donkeys and horses are living units that require maintenance:

| Animal | Feed | Feed Rate | Lifespan | Death If Starved |
|--------|------|-----------|----------|-----------------|
| Donkey | Hay or Grain | 1 unit / 120s | 20 min | After 60s unfed |
| Horse | Hay and Grain | 1 each / 90s | 15 min | After 45s unfed |

- Animals are bred at the **Stable** (new building, see System 5)
- Dead animals are removed; their cargo drops at the nearest flag
- Animals count toward population cap

### Multi-Item Carrying

The `Unit` interface gains:

```typescript
/** Items currently being carried (replaces carryingResource for multi-carry) */
cargo: { resource: ResourceType; amount: number }[];
/** Max items this unit can carry */
carryCapacity: number;
```

The existing `carryingResource: ResourceType | null` is replaced by the `cargo` array. Backward compatibility: foot transporters have `carryCapacity: 1`.

---

## System 5: New Buildings

### Food & Farming (~7 buildings)

| # | Building | Category | Tier | Worker | Inputs | Outputs | Cost | Time |
|---|----------|----------|------|--------|--------|---------|------|------|
| 1 | **Orchard** | gathering | 2 | Orchardist | — | 1 Fruit | 3 Wood, 2 Planks | 25s |
| 2 | **Vineyard** | gathering | 2 | Vintner | — | 1 Grapes | 3 Wood, 2 Planks | 30s |
| 3 | **Winery** | processing | 3 | Winemaker | 1 Grapes | 1 Wine | 3 Wood, 2 Stone, 2 Planks | 35s |
| 4 | **Brewery** | processing | 2 | Brewer | 1 Grain, 1 Water Barrel | 1 Beer | 3 Wood, 2 Planks | 30s |
| 5 | **Dairy Farm** | gathering | 2 | Dairymaid | 1 Grain (feed) | 1 Milk | 4 Wood, 2 Planks | 30s |
| 6 | **Cheese Maker** | processing | 3 | Cheese Maker | 1 Milk | 1 Cheese | 3 Wood, 2 Stone | 25s |
| 7 | **Well** | gathering | 1 | — | — | 1 Water Barrel | 2 Wood, 1 Stone | 15s |

### Crafting & Industry (~5 buildings)

| # | Building | Category | Tier | Worker | Inputs | Outputs | Cost | Time |
|---|----------|----------|------|--------|--------|---------|------|------|
| 8 | **Tannery** | processing | 3 | Tanner | 1 Leather (raw) | 1 Leather (worked) | 3 Wood, 2 Stone, 1 Planks | 30s |
| 9 | **Weaver's Hut** | processing | 3 | Weaver | 1 Wool | 1 Cloth | 3 Wood, 2 Planks | 25s |
| 10 | **Charcoal Burner** | processing | 2 | Charcoal Burner | 2 Wood | 1 Coal | 2 Wood, 1 Stone | 20s |
| 11 | **Fletcher's Workshop** | processing | 3 | Fletcher | 1 Wood, 1 Iron Bars | 4 Arrows | 3 Wood, 2 Stone, 2 Planks | 30s |
| 12 | **Siege Workshop** | processing | 3 | Engineer | 3 Wood, 2 Iron Bars | 1 Siege Ram | 5 Wood, 4 Stone, 3 Planks | 50s |

### Military (~3 buildings)

| # | Building | Category | Tier | Knight Slots | Influence | Cost | Time |
|---|----------|----------|------|-------------|-----------|------|------|
| 13 | **Fortress** | military | 3 | 20 | 10 | 8 Wood, 8 Stone, 5 Planks, 3 Iron Bars | 80s |
| 14 | **Archery Range** | military | 2 | 6 (archers) | 5 | 4 Wood, 3 Stone, 2 Planks | 35s |
| 15 | **Torch Tower** | military | 1 | 0 | 2 | 2 Wood, 1 Stone | 15s |

The **Torch Tower** has no knight slots but projects a light radius that mitigates night penalties within range (see System 3). The **Fortress** is the ultimate military building, stronger than Barracks.

### Animal Husbandry (~3 buildings)

| # | Building | Category | Tier | Worker | Inputs | Outputs | Cost | Time |
|---|----------|----------|------|--------|--------|---------|------|------|
| 16 | **Stable** | processing | 2 | Stablehand | 2 Grain, 1 Hay | 1 Horse or 1 Donkey | 4 Wood, 3 Planks | 35s |
| 17 | **Cattle Ranch** | gathering | 2 | Rancher | 1 Grain (feed) | 1 Cattle | 4 Wood, 2 Planks | 40s |
| 18 | **Sheep Farm** | gathering | 2 | Shepherd | — | 1 Wool | 3 Wood, 2 Planks | 30s |

### Housing (~3 buildings)

| # | Building | Category | Tier | Pop Capacity | Cost | Time |
|---|----------|----------|------|-------------|------|------|
| 19 | **Small House** | housing | 1 | 8 | 3 Wood, 2 Planks | 20s |
| 20 | **Medium House** | housing | 2 | 16 | 4 Wood, 3 Planks, 2 Stone | 35s |
| 21 | **Large House** | housing | 3 | 25 | 5 Wood, 4 Planks, 4 Stone, 2 Iron Bars | 50s |

### Special (~2 buildings)

| # | Building | Category | Tier | Function | Cost | Time |
|---|----------|----------|------|----------|------|------|
| 22 | **Inn / Tavern** | processing | 2 | Consumes Beer/Wine, generates morale (see System 9) | 4 Wood, 3 Planks, 2 Stone | 35s |
| 23 | **Market** | logistics | 3 | Auto-distributes food to nearby buildings within radius | 5 Wood, 4 Stone, 3 Planks | 40s |

**Total new buildings: 23**, bringing the grand total from 23 to **46 building types**.

---

## System 6: New Units

### New Civilian Workers (~14 types)

| # | Unit Type | Category | Required Tool | Move Speed | Associated Building |
|---|-----------|----------|--------------|------------|-------------------|
| 1 | Orchardist | civilian | Tools | 1.0 | Orchard |
| 2 | Vintner | civilian | Tools | 1.0 | Vineyard |
| 3 | Winemaker | civilian | — | 1.0 | Winery |
| 4 | Brewer | civilian | — | 1.0 | Brewery |
| 5 | Dairymaid | civilian | — | 1.0 | Dairy Farm |
| 6 | Cheese Maker | civilian | — | 1.0 | Cheese Maker |
| 7 | Tanner | civilian | Tools | 1.0 | Tannery |
| 8 | Weaver | civilian | — | 1.0 | Weaver's Hut |
| 9 | Charcoal Burner | civilian | — | 0.9 | Charcoal Burner |
| 10 | Fletcher | civilian | Tools | 1.0 | Fletcher's Workshop |
| 11 | Engineer | civilian | Tools | 0.8 | Siege Workshop |
| 12 | Stablehand | civilian | — | 1.0 | Stable |
| 13 | Rancher | civilian | — | 1.0 | Cattle Ranch |
| 14 | Shepherd | civilian | — | 1.0 | Sheep Farm |

### New Military Units (~4 types)

| # | Unit Type | Category | Move Speed | HP | Attack | Range | Special |
|---|-----------|----------|------------|-----|--------|-------|---------|
| 15 | **Archer** | military | 1.0 | 0.7× Knight | 0.6× Knight | 3 hexes | Ranged attack, requires Bow+Arrows |
| 16 | **Cavalry** | military | 1.8 | 1.0× Knight | 1.3× Knight | melee | Requires Horse+Sword+Shield, charge bonus |
| 17 | **Siege Operator** | military | 0.6 | 0.5× Knight | 3.0× vs buildings | melee | Requires Siege Ram, only attacks buildings |
| 18 | **Scout** | military | 2.0 | 0.3× Knight | 0.2× Knight | melee | Fast, large vision radius (12 hexes) |

### Transport Animals (~2 types)

| # | Unit Type | Category | Move Speed | Carry Capacity | Lifespan |
|---|-----------|----------|------------|---------------|----------|
| 19 | **Donkey** | transport | 0.45 | 3 | 20 min |
| 20 | **Horse (transport)** | transport | 0.60 | 5 | 15 min |

**Total new unit types: 20**, bringing the grand total from 19 to **39 unit types**.

### Military Recruitment

Extending the existing Knight recruitment pattern (serf + Sword + Shield → Knight at military building):

| Military Unit | Recruitment Items | Building |
|---------------|------------------|----------|
| Knight (existing) | 1 Sword + 1 Shield | Guard Hut / Watchtower / Barracks / Fortress |
| Archer | 1 Bow + 4 Arrows | Archery Range |
| Cavalry | 1 Horse + 1 Sword + 1 Shield | Barracks / Fortress |
| Siege Operator | 1 Siege Ram | Barracks / Fortress |
| Scout | — (just a serf promotion) | Guard Hut+ |

---

## System 7: New Resources

### New Raw Materials (~7 types)

| # | Resource | Category | Source | isFood |
|---|----------|----------|--------|--------|
| 1 | **Grapes** | raw | Vineyard | false |
| 2 | **Fruit** | raw | Orchard | true |
| 3 | **Water Barrel** | raw | Well | false |
| 4 | **Milk** | raw | Dairy Farm | false |
| 5 | **Hay** | raw | Farm (alternate output) | false |
| 6 | **Wool** | raw | Sheep Farm | false |
| 7 | **Leather (raw)** | raw | Cattle Ranch (byproduct of Slaughterhouse) | false |

### New Processed Goods (~7 types)

| # | Resource | Category | Source Building | isFood |
|---|----------|----------|----------------|--------|
| 8 | **Wine** | processed | Winery | true |
| 9 | **Beer** | processed | Brewery | true |
| 10 | **Cheese** | processed | Cheese Maker | true |
| 11 | **Cloth** | processed | Weaver's Hut | false |
| 12 | **Leather (worked)** | processed | Tannery | false |
| 13 | **Arrows** | processed | Fletcher's Workshop | false |
| 14 | **Bow** | processed | Fletcher's Workshop | false |
| 15 | **Siege Ram** | processed | Siege Workshop | false |

### New Animals (~2 types)

| # | Resource | Category | Source | isFood |
|---|----------|----------|--------|--------|
| 16 | **Cattle** | animal | Cattle Ranch | false |
| 17 | **Horses** | animal | Stable | false |

**Total new resources: 17**, bringing the grand total from 17 to **34 resource types**.

### Resource Properties Extension

The `ResourceProperties` interface (`src/game/ResourceType.ts`) gains:

```typescript
export interface ResourceProperties {
  label: string;
  category: 'raw' | 'processed' | 'animal';
  isFood: boolean;
  /** Satiation restored when consumed as food (0 if not food) */
  satiationValue: number;
  /** Whether this resource counts as a drink for morale (Inn/Tavern) */
  isDrink: boolean;
}
```

---

## System 8: Expanded Resource Chains

### Food Chains

```
NEW CHAINS:
  Orchard ──────────────────────────────── Fruit (food, 0.35 satiation)
  Vineyard → Winery ─────────────────────── Wine (food+drink, 0.30 satiation)
  Farm → Brewery ────────────────────────── Beer (food+drink, 0.25 satiation)
       ↘ Well provides Water Barrel
  Dairy Farm ──→ Cheese Maker ───────────── Cheese (food, 0.55 satiation)
       (needs Grain feed)

EXISTING CHAINS (unchanged):
  Fisherman's Hut ──────────────────────── Fish (food, 0.40 satiation)
  Farm → Windmill → Bakery ──────────────── Bread (food, 0.60 satiation)
  Farm → Pig Farm → Slaughterhouse ──────── Meat (food, 0.80 satiation)
```

### Material Chains

```
NEW CHAINS:
  Sheep Farm ──→ Weaver's Hut ──────────── Cloth
  Cattle Ranch ──→ Slaughterhouse ────────── Meat + Leather (raw)
                        ↓
                   Tannery ─────────────── Leather (worked)
  Woodcutter ──→ Charcoal Burner ─────────── Coal (alternate to Coal Mine)

EXISTING CHAINS (unchanged):
  Woodcutter → Sawmill ──────────────────── Planks
  Iron Mine → Iron Smelter ──────────────── Iron Bars
  Gold Mine → Goldsmith/Mint ────────────── Gold Bars
```

### Military Chains

```
NEW CHAINS:
  Wood + Iron Bars → Fletcher's Workshop ── Arrows + Bow
  Wood + Iron Bars → Siege Workshop ──────── Siege Ram
  Grain + Hay → Stable ──────────────────── Horse / Donkey

EXISTING CHAINS (unchanged):
  Iron Bars + Coal + Planks → Blacksmith ── Swords + Shields
  Iron Bars + Planks → Toolmaker ─────────── Tools
```

### Transport Chain

```
  Farm → (Grain + Hay) → Stable → Donkey → assigned to road network
                                 → Horse → Cavalry recruitment OR transport
```

### Full Dependency Graph (Build Order)

```
Tier 0: Castle
  ↓
Tier 1: Woodcutter, Forester, Quarry, Fisherman, Guard Hut, Well, Small House, Torch Tower
  ↓
Tier 2: Sawmill, Farm, Mines, Watchtower, Warehouse, Harbor, Orchard, Vineyard,
        Dairy Farm, Brewery, Charcoal Burner, Stable, Cattle Ranch, Sheep Farm,
        Medium House, Inn/Tavern, Archery Range
  ↓
Tier 3: Windmill, Bakery, Pig Farm, Slaughterhouse, Smelter, Toolmaker,
        Goldsmith, Blacksmith, Barracks, Winery, Cheese Maker, Tannery,
        Weaver's Hut, Fletcher's Workshop, Siege Workshop, Fortress,
        Large House, Market
```

---

## System 9: Morale System

### Overview

The **Inn / Tavern** building consumes drinks (Beer, Wine) and generates a **morale bonus** for the settlement. Higher morale increases global production speed and knight combat effectiveness.

### Morale Calculation

```
baseMorale = 0.5 (neutral)
drinkVarietyBonus = uniqueDrinkTypesServedLast5Min × 0.10
                    (max 0.20 for 2 drink types: Beer + Wine)
drinkVolumeBonus  = min(0.15, drinksServedLast5Min × 0.01)
goldBonus         = min(0.10, goldBarsInTreasury × 0.005)

totalMorale = clamp(baseMorale + drinkVarietyBonus + drinkVolumeBonus + goldBonus, 0.0, 1.0)
```

### Morale Effects

| Morale Range | Label | Production Bonus | Knight Combat Bonus |
|-------------|-------|-----------------|-------------------|
| 0.00–0.29 | Low | -10% | -10% |
| 0.30–0.49 | Normal | 0% | 0% |
| 0.50–0.69 | Good | +5% | +5% |
| 0.70–0.89 | High | +10% | +10% |
| 0.90–1.00 | Excellent | +15% | +15% |

### Inn/Tavern Mechanics

- The Inn consumes 1 Beer or 1 Wine every 20 seconds
- Each consumption event generates morale
- Serving both Beer AND Wine in the same 5-minute window triggers the variety bonus
- The Inn has a worker (Innkeeper unit type — reuses existing civilian pattern)
- Radius: morale applies globally (entire settlement), not locally

### Integration

- `MoraleManager` tracks drink consumption events in a rolling 5-minute window (same pattern as `EconomyTracker`)
- `ProductionManager` applies morale multiplier alongside night and hunger multipliers
- `CombatManager` applies morale bonus to knight strength calculation (additive with existing gold bonus)

---

## System 10: Balance Analysis

### Early Game (0–5 minutes)

**Current state:** Castle → Woodcutter → Quarry → Sawmill → Farm → Guard Hut.

**With expansion:**
- Hunger pressure is low (decay takes 3.3 min to reach starving)
- Castle provides 15 pop capacity — enough for ~10 initial serfs
- Players should build a Small House early (Tier 1, cheap) to sustain growth
- Fisherman remains the critical early food source (Tier 1, isFood, 0.40 satiation)
- Well is Tier 1, enabling early Brewery setup if desired

**Pacing goal:** Players feel gentle hunger pressure by minute 3, motivating food production without punishing slow starts.

### Mid Game (5–15 minutes)

**Key tensions:**
- **Food vs. materials:** Grain is needed for Bread, Pig Farm, Beer, Dairy Farm, and Stable. This creates meaningful resource competition.
- **Housing vs. military:** Stone is needed for houses, military buildings, and road upgrades.
- **Transport bottleneck:** Players upgrading to Donkey transport need Stable + Grain + Hay, competing with food chains.

**Day/night cycle** (18 min full cycle) means players experience ~1 full cycle in mid-game. Night penalties push players to:
1. Build Torch Towers along critical routes
2. Upgrade roads to compensate speed loss
3. Front-load production during daytime

### Late Game (15+ minutes)

**Military diversification:** Archers (ranged), Cavalry (fast/strong), Siege (anti-building) create rock-paper-scissors dynamics:
- Archers counter Cavalry (damage before charge)
- Cavalry counter Siege (fast enough to engage)
- Siege counters fortified positions (3× building damage)
- Knights remain the balanced generalist

**Economy peaks:**
- Full food chain (all 7 food types) provides hunger resilience
- Morale from Inn/Tavern (+15% at Excellent) is a meaningful late-game advantage
- Horse Cart transport (8 items, fast) on Paved Roads creates logistics superiority

### Resource Competition Matrix

| Resource | Competing Uses |
|----------|---------------|
| Grain | Bread chain, Pig Farm, Beer, Dairy Farm feed, Stable feed |
| Wood | Construction, Planks, Charcoal, Arrows, Siege |
| Iron Bars | Tools, Swords/Shields, Arrows, Siege Ram |
| Stone | Construction, Roads, Houses, Military buildings |
| Coal | Smelting, Baking, Goldsmithing (also from Charcoal Burner) |

### Knight Balance with New Military Units

| Unit | Relative Strength | Counter | Cost (resources) |
|------|------------------|---------|-----------------|
| Knight (rank 1) | 1.0× | — | Sword + Shield |
| Archer | 0.6× melee, 0.6× at range | Knights (close gap) | Bow + 4 Arrows |
| Cavalry | 1.3× with charge | Archers (kiting) | Horse + Sword + Shield |
| Siege | 0.5× vs units, 3.0× vs buildings | Any combat unit | Siege Ram |
| Scout | 0.2× | Everything | Free (serf promotion) |

---

## Implementation Roadmap

### Phase A: Foundation (Prerequisites)

**Priority: Must be done first.**

1. **Terrain-weighted pathfinding** — Change line 78 in `Pathfinding.ts` from flat cost to `TERRAIN_PROPERTIES[terrain].movementCost`. Single-line change, minimal risk.
2. **Population capacity field** — Add `populationCapacity` to `BuildingDefinition`, set to 0 for all existing buildings except Castle (15).
3. **Satiation field** — Add `satiation: number` to `Unit` interface, initialize to 1.0.
4. **Night gameplay hook** — Store `currentNightness` in `Game.ts` from existing `onNightnessUpdate` callback. Pass to managers.

**Estimated scope:** 4 small changes, no new files.

### Phase B: Core Mechanics

**Depends on: Phase A.**

5. **Hunger system** — `FeedingManager`, satiation decay, speed/production multipliers.
6. **Housing buildings** — Small/Medium/Large House definitions, spawn gate, UI counter.
7. **Night speed penalties** — Apply nightness multipliers in `UnitManager` and `ProductionManager`.
8. **Food quality tiers** — Add `satiationValue` to `ResourceProperties`, update feeding logic.

**Estimated scope:** 3 new files, 5 modified files.

### Phase C: New Content

**Depends on: Phase B.**

9. **New resources** — Add ~17 resource types to `ResourceType.ts`.
10. **New buildings** — Add ~23 building definitions to `BuildingType.ts`.
11. **New unit types** — Add ~20 unit types to `UnitType.ts`.
12. **3D models** — Create Blender models for all new buildings, units, and resources.
13. **Production chains** — Wire up all new building inputs/outputs.

**Estimated scope:** 3 major file extensions, ~40 Blender model sessions.

### Phase D: Advanced Systems

**Depends on: Phase C.**

14. **Road quality system** — Road levels, upgrade mechanics, visual differences.
15. **Advanced transport** — Donkey/Cart/Horse Cart units, multi-item carrying, cargo array.
16. **Animal lifecycle** — Feeding, lifespan timers, death/removal.
17. **Morale system** — `MoraleManager`, Inn/Tavern consumption, global bonuses.

**Estimated scope:** 4 new files, extensive integration.

### Phase E: Military Expansion

**Depends on: Phase C + D.**

18. **Archer unit** — Ranged attack system, Archery Range building.
19. **Cavalry unit** — Charge mechanic, Horse requirement.
20. **Siege unit** — Building damage multiplier, Siege Workshop.
21. **Scout unit** — Large vision radius, fast movement.
22. **Fortress building** — Ultimate military building.

**Estimated scope:** Combat system extensions, new animation phases.

### Phase F: Polish & Balance

**Depends on: All above.**

23. **Balance tuning** — Playtest all numbers, adjust decay rates, costs, timers.
24. **UI for new systems** — Hunger bar on unit tooltip, morale indicator, transport info.
25. **AI adaptation** — Teach AI opponent to use new buildings, units, and systems.
26. **Performance audit** — Ensure mobile performance with doubled content.

---

## Constraints & Risks

### Performance

- **Doubled entity count:** ~46 building types, ~39 unit types, ~34 resources. The existing instanced rendering and pool systems should handle this, but test on mobile.
- **Hunger updates:** Per-unit satiation decay is O(n) per frame. With ~200 units, this is negligible.
- **Morale manager:** Rolling 5-minute window mirrors `EconomyTracker` — proven performant.
- **Multi-item cargo:** Array of {resource, amount} per transporter is negligible memory.

### Complexity

- **Food chain depth:** 7 food types may overwhelm new players. Consider progressive unlocking (Tier 1 food only for first 3 minutes).
- **Road quality:** 4 road levels add UI complexity. Ensure clear visual distinction.
- **Animal lifecycle:** Dying transport animals could frustrate players. Consider a warning system 30 seconds before starvation.

### Mobile Compatibility

- **Touch targets:** New construction categories (Housing, Food) need adequate button sizes.
- **UI density:** Population counter, hunger indicators, morale display — ensure they don't clutter the mobile HUD.
- **Model count:** 40+ new 3D models must be low-poly. Target <500 vertices per model.

### Backward Compatibility

- **Save/load:** New fields (`satiation`, `populationCapacity`, `cargo`) need deserialization defaults for old saves.
- **Existing balance:** Hunger and night penalties change the difficulty of existing content. Ensure a "Classic Mode" toggle is available that disables hunger/night/morale systems.
- **API stability:** All new types extend existing `const object` patterns — no breaking changes to existing code consumers.

### Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Hunger too punishing for casual play | Medium | High | Configurable decay rate; "Easy" mode with 50% decay |
| Night penalties feel unfair | Medium | Medium | Torch Tower is cheap Tier 1; streetlights already exist |
| Transport complexity overwhelms | Low | Medium | Start with foot only; unlock tiers via buildings |
| Animal death frustrates players | Medium | Medium | Warning icons, generous starvation timer |
| Mobile performance regression | Low | High | Budget: <500 verts/model, <800 particles, profile monthly |
