---
name: feudal-production-chain
description: Design and implement new resource production chains. Covers ResourceType.ts, building recipes, logistics routing, goods distribution, economy tracking, and balance verification.
---

# Add a New Production Chain

## When to Use
When adding a new resource flow: raw material → processing → final product → consumer. Examples from expansion: Grapes → Wine, Hops → Beer, Leather → Armor.

## Prerequisites
- Read `docs/game.md` for existing chain patterns
- Read `docs/expansion.md` for planned chains
- Plan the full chain before implementing any part

## Chain Planning Template

Before writing code, map out the complete chain:

```
[Source] ─── Resource A ───> [Processor 1] ─── Resource B ───> [Processor 2] ─── Resource C ───> [Consumer]

Example: Grain chain
[Farm] ─── Grain ───> [Windmill] ─── Flour ───> [Bakery] ─── Bread ───> [Castle/Military]
```

Document for each step:
1. Source building (new or existing?)
2. Resource produced (new or existing?)
3. Processing building (new or existing?)
4. Final consumer (which buildings accept the output?)
5. Production times (balance against existing chains)

## Step-by-Step Implementation

### Step 1: Add New Resources

In `src/game/ResourceType.ts`:

```typescript
export const ResourceType = {
  // ... existing types
  NewResource: 'new_resource',
} as const;
```

Add to `RESOURCE_PROPERTIES`:
```typescript
[ResourceType.NewResource]: {
  label: 'New Resource',
  category: 'raw' | 'processed' | 'animal',
  isFood: false,  // true if consumed by units/military
},
```

### Step 2: Create Resource 3D Models

For each new resource, create a small 3D model via Blender MCP:
1. Read `docs/resources.md` for visual style
2. Create model (small, recognizable from isometric view)
3. Export to `public/models/resources/new_resource.glb`
4. Register in `AssetLoader.ts` (`ResourceModelName` type + `loadResourceModels()`)

### Step 3: Add/Update Building Definitions

For each building in the chain, either:

**New building** — follow `feudal-new-building` skill (13-step checklist)

**Existing building with new recipe** — update `BUILDING_DEFINITIONS`:
```typescript
production: {
  inputs: [
    { resource: ResourceType.ExistingInput, amount: 1 },
    { resource: ResourceType.NewResource, amount: 1 },  // New input
  ],
  outputs: [{ resource: ResourceType.Output, amount: 1 }],
  productionTime: 15,
},
```

### Step 4: Verify Logistics Routing

The `LogisticsManager` routes goods based on `importance × priority / distance`. For the new chain to work:

1. **Source building** must produce the resource (output in recipe)
2. **Consumer building** must declare the resource as input
3. **Road network** must connect source to consumer via flags
4. **Goods distribution** defaults should be reasonable

Test in-game:
1. Place source building
2. Place consumer building
3. Connect with roads/flags
4. Verify resource flows from source → flag → transporter → flag → consumer

### Step 5: Set Goods Distribution Defaults

In `src/game/GoodsDistribution.ts`, ensure the new resource has default priority:

```typescript
// New resources default to priority 3 (medium)
// Adjust if the resource is critical (food → higher) or optional (luxury → lower)
```

The `GoodsDistributionSettings` auto-initializes new resources to default values. Verify the priority panel shows the new resource.

### Step 6: Update Economy Tracking

`EconomyTracker` in `src/game/EconomyTracker.ts` automatically tracks all production/consumption events. No changes needed unless the new chain has special tracking requirements.

Verify via evaluate_script:
```javascript
game.getEconomyTracker().getProductionRate('new_resource')
game.getEconomyTracker().getConsumptionRate('new_resource')
game.getEconomyTracker().getNetBalance('new_resource')
```

### Step 7: Balance Verification

Compare production rates against existing chains:

| Chain | Production Time | Effective Rate |
|-------|----------------|----------------|
| Wood → Planks (Sawmill) | 12s | 1 Planks/12s |
| Iron Ore → Iron Bars (Smelter) | 20s | 1 Iron Bar/20s |
| Grain → Flour (Windmill) | 10s | 1 Flour/10s |
| Flour → Bread (Bakery) | 15s | 1 Bread/15s |
| **New chain** | Xs | ? |

**Balance rules:**
- Raw material gathering: 8–15s per unit
- Processing: 10–20s per unit
- Multi-input processing: 15–25s per unit
- Consumer demand should not exceed supply capacity
- Distance penalty applies to gathering buildings (see `harvestTerrain`)

### Step 8: Write Tests

```typescript
describe('New Production Chain', () => {
  it('should define new resources', () => {
    expect(RESOURCE_PROPERTIES[ResourceType.NewResource]).toBeDefined();
  });

  it('should have valid building recipe', () => {
    const def = BUILDING_DEFINITIONS[BuildingType.NewProcessor];
    expect(def.production.inputs).toContainEqual(
      expect.objectContaining({ resource: ResourceType.NewResource })
    );
  });

  it('should produce output when inputs available', () => {
    // Set up building with inputs, run production cycle, check output
  });

  it('should route resources through logistics', () => {
    // Place buildings, connect with roads, verify delivery
  });
});
```

## Existing Production Chains Reference

```
Wood Chain:      [WoodcutterHut] → Wood → [Sawmill] → Planks → (construction)
Food Chain:      [Farm] → Grain → [Windmill] → Flour → [Bakery] → Bread
Meat Chain:      [Farm] → Grain → [PigFarm] → Pigs → [Slaughterhouse] → Meat
Iron Chain:      [IronMine] → IronOre + [CoalMine] → CoalOre → [IronSmelter] → IronBars
Tool Chain:      IronBars → [ToolmakerWorkshop] → Tools
Weapon Chain:    IronBars + CoalOre → [BlacksmithArmory] → Swords + Shields
Gold Chain:      [GoldMine] → GoldOre + CoalOre → [GoldsmithMint] → GoldBars
Fish Chain:      [FishermanHut] → Fish → (food)
Stone Chain:     [Quarry] → Stone → (construction)
```

## Key Files
- `src/game/ResourceType.ts` — Resource types and properties
- `src/game/BuildingType.ts` — Building definitions with recipes
- `src/game/ProductionManager.ts` — Production cycle logic
- `src/game/LogisticsManager.ts` — Goods routing
- `src/game/GoodsDistribution.ts` — Priority settings
- `src/game/EconomyTracker.ts` — Rate tracking
- `src/engine/AssetLoader.ts` — Resource model loading

## Verification
1. `npm run build` — compiles (Record completeness)
2. `npm run test` — chain tests pass
3. `npm run lint` — clean
4. In-game: place full chain, connect with roads, watch resources flow
5. Economy tracker: production/consumption rates are non-zero
6. Priority panel: new resource appears with adjustable priority
