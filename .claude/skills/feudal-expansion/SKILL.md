---
name: feudal-expansion
description: Orchestrate expansion feature implementation from docs/expansion.md. 10 systems, 23 new buildings, 20 new units, 17 new resources across 5 implementation phases.
---

# Expansion Feature Implementation

## When to Use
When implementing features from `docs/expansion.md`. This skill provides the orchestration plan — it delegates to other skills for specific tasks.

## Prerequisites
- Read `docs/expansion.md` thoroughly — it defines 10 interconnected systems
- All 9 base game phases complete
- Build/test/lint clean

## Expansion Overview

| System | Key Content |
|--------|-------------|
| 1. Unit Hunger | Satiation decay, food tiers, FeedingManager |
| 2. Population & Housing | Castle 15 cap, Small/Medium/Large Houses, spawn gate |
| 3. Day/Night Gameplay | Nightness affects speed, production, vision |
| 4. Advanced Transport | Donkey (3 items), Cart (6), Horse Cart (8), road quality |
| 5. New Buildings | 23 new (food, crafting, military, animal, housing, special) |
| 6. New Units | 20 new (14 civilian, 4 military, 2 transport animals) |
| 7. New Resources | 17 new (7 raw, 7 processed, 2 animals) |
| 8. Expanded Chains | Food, material, military production chains |
| 9. Morale System | Inn/Tavern + Beer/Wine → production & combat bonus |
| 10. Balance | Full dependency graph, competition matrix |

## 5-Phase Implementation Plan

### Phase A: Foundation (4 small changes to existing systems)

These changes prepare existing code for expansion features without adding new content:

**A1. Terrain-weighted pathfinding**
- Modify pathfinding cost function to consider terrain type
- Grassland: 1.0x, Forest: 1.3x, Mountain: 2.0x, Desert: 1.2x
- Reference: RoadNetwork pathfinding code

**A2. Unit satiation field**
- Add `satiation: number` to Unit interface (default 1.0)
- No gameplay effect yet — just the data field
- Update SaveLoad (see `saveload-migration` skill)
- Skills: `feudal-new-manager` for FeedingManager skeleton

**A3. Building upgrade framework extension**
- Extend UpgradeManager to support new upgrade types (worker speed, recipe efficiency)
- No new upgrades yet — just the framework

**A4. Road quality data model**
- Add `quality: 'dirt' | 'cobblestone' | 'paved'` to road segments
- Default all existing roads to 'dirt'
- No gameplay effect yet

### Phase B: Core Mechanics (3 new files/systems)

**B1. FeedingManager** (`src/game/FeedingManager.ts`) — **IMPLEMENTED**
- Satiation decay: 0.001/s per unit (1.0x working, 0.5x garrisoned, 0.5x food producers)
- Food consumption from Castle/Warehouse every 5s when satiation < 0.80
- Food tiers: Fish (0.50), Fruit (0.45), Beer (0.30), Wine (0.35), Cheese (0.60), Bread (0.70), Meat (0.90)
- Hungry at 0.35, starving at 0.15 (penalties defined but not yet wired)
- Food producer workers get reduced decay and priority feeding
- See `docs/food-system.md` for full system guide

**B2. HousingManager** (`src/game/HousingManager.ts`)
- Castle: 15 population cap
- Small House: +5, Medium House: +10, Large House: +15
- Spawn gate: UnitManager checks housing capacity
- Skills: `feudal-new-manager`, `feudal-new-building`

**B3. MoraleManager** (`src/game/MoraleManager.ts`)
- Inn/Tavern buildings consume Beer/Wine
- Drink variety (1-3 types) + volume → morale bonus
- Gold Bars in Treasury → additional bonus
- Morale → production speed multiplier + combat bonus
- Skills: `feudal-new-manager`

### Phase C: New Content (batch model creation)

**C1. New Resources (17)**
Add to ResourceType.ts, create 3D models, register in AssetLoader.
- Raw: Grapes, Hops, Flax, Clay, Copper Ore, Tin Ore, Horses
- Processed: Wine, Beer, Cloth, Leather, Pottery, Bronze Bars, Arrows
- Animals: Sheep, Cattle
- Skills: `feudal-production-chain`, `feudal-3d-asset-pipeline`

**C2. New Buildings (23)**
Add to BuildingType.ts, create 3D models, register in all systems.
- Food: Vineyard, Brewery, Orchard, Dairy, Herbalist, Bakery II, Kitchen
- Crafting: Weaver, Tanner, Potter, Charcoal Burner, Bronze Smelter
- Military: Archer Range, Stable, Siege Workshop
- Animal: Sheep Farm, Cattle Ranch, Horse Breeder
- Housing: Small House, Medium House, Large House
- Special: Inn, Tavern
- Skills: `feudal-new-building`, `feudal-3d-asset-pipeline`

**C3. New Units (20)**
Add to UnitType.ts, create 3D models, register in all systems.
- Civilian: Vintner, Brewer, Herbalist, Weaver, Tanner, Potter, CharcoalBurner, BronzeSmelter, DairyWorker, Shepherd, Rancher, HorseBreeder, Innkeeper, Cook
- Military: Archer, Cavalry, SiegeOperator, Scout
- Transport: Donkey, HorseCart
- Skills: `feudal-new-unit`, `feudal-3d-asset-pipeline`

### Phase D: Advanced Systems

**D1. Road Quality System**
- Dirt (1.0x speed) → Cobblestone (1.3x, costs 2 Stone) → Paved (1.6x, costs 3 Stone + 1 Planks)
- Upgrade via road context menu
- Transporters move faster on better roads
- Visual: different road textures per quality level

**D2. Multi-Item Transport**
- Donkey: carries 3 items, moves at 1.5x transporter speed
- Cart: carries 6 items, requires cobblestone+ roads
- Horse Cart: carries 8 items, requires paved roads
- New unit rendering for transport animals

**D3. Day/Night Gameplay Effects**
- Night penalty: production time +33%, unit speed -40%, vision radius -30%
- Already have AtmosphereController with `nightness` factor
- Wire nightness into ProductionManager, UnitManager, FogOfWarManager

**D4. Animal System**
- Sheep → Wool (Weaver → Cloth)
- Cattle → Leather (Tanner → armor)
- Horses → Cavalry, Horse Cart
- Animal unit rendering, grazing behavior

### Phase E: Military Expansion

**E1. Archer**
- Ranged unit (2-hex range)
- Recruited at Archer Range (Bow + Arrows)
- Weak in melee, strong at range
- New combat resolution for ranged vs melee

**E2. Cavalry**
- Fast unit (2.5x knight speed)
- Recruited at Stable (Horse + Sword + Shield)
- Charge bonus on first attack
- New combat animation for mounted combat

**E3. Siege Equipment**
- Siege Ram: slow, high damage vs buildings
- Recruited at Siege Workshop (Planks + Iron Bars)
- Building siege mechanic (reduces building HP over time)

**E4. Scout**
- Fast exploration unit (3x speed, no combat)
- Reveals fog of war in large radius
- Recruited at Barracks (no equipment needed)

## Cross-Cutting Concerns Checklist

For every new building/unit/resource, verify these systems are updated:

- [ ] **SaveLoad** — New fields serialized, version bumped if needed (`saveload-migration`)
- [ ] **AI** — AIPlayer knows about new buildings/units (`AIPlayer.ts` build orders)
- [ ] **UI** — Build panel shows new buildings, info panel handles new data
- [ ] **3D Models** — Created and registered (`feudal-3d-asset-pipeline`)
- [ ] **Economy Tracker** — New resources tracked automatically
- [ ] **Goods Distribution** — New resources have default priorities
- [ ] **Fog of War** — New units/buildings visible when in territory
- [ ] **Minimap** — New buildings/units appear on minimap

## Implementation Order

```
Phase A (foundation) → Phase B (core mechanics) → Phase C (content) → Phase D (advanced) → Phase E (military)
```

Within each phase, implement in the listed order. Each sub-task should be independently committable and testable.

## Key Files
- `docs/expansion.md` — Full expansion specification
- `src/game/BuildingType.ts` — Building definitions
- `src/game/UnitType.ts` — Unit definitions
- `src/game/ResourceType.ts` — Resource definitions
- `src/engine/Game.ts` — Manager/renderer integration
- `src/game/SaveLoad.ts` — Serialization
- `src/game/AIPlayer.ts` — AI build orders

## Related Skills
- `feudal-new-building` — 13-step building checklist
- `feudal-new-unit` — 9-step unit checklist
- `feudal-production-chain` — Chain design + implementation
- `feudal-new-manager` — Manager template + integration
- `feudal-new-renderer` — Renderer template + performance
- `feudal-3d-asset-pipeline` — Blender → Three.js workflow
- `feudal-game-balance` — Balance constant reference
- `saveload-migration` — Version migration system

## Verification
After each sub-phase:
1. `npm run build` — compiles
2. `npm run test` — all tests pass
3. `npm run lint` — clean
4. Play the game — new content works, existing content unbroken
5. Save/load — new state persists correctly
6. AI — handles new content without crashing
