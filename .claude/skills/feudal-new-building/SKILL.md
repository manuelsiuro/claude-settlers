---
name: feudal-new-building
description: End-to-end guide for adding a new building type. 13-step checklist covering BuildingType.ts, Blender model, AssetLoader, BuildingModels, BuildingRenderer, animations, particles, SaveLoad, and tests.
---

# Add a New Building Type

## When to Use
When adding a new building to the game — whether from the expansion plan (`docs/expansion.md`) or a custom addition.

## Prerequisites
- Read the design doc for the building's visual style (`docs/buildings.md`)
- Read the game design doc for the building's mechanics (`docs/game.md` or `docs/expansion.md`)
- Know the building's: category, tier, cost, worker type, production recipe, allowed terrain

## 13-Step Checklist

### Step 1: Design Doc Check
Read the relevant design doc and note:
- Visual appearance (colors, shape, size, style references)
- Production recipe (inputs, outputs, timing)
- Construction cost (resources needed)
- Worker type (which serf profession operates it)
- Placement rules (terrain, adjacency, territory)

### Step 2: Add to BuildingType

In `src/game/BuildingType.ts`:

**a) Add type constant:**
```typescript
export const BuildingType = {
  // ... existing types
  NewBuilding: 'new_building',
} as const;
```

**b) Add full definition to BUILDING_DEFINITIONS:**
```typescript
[BuildingType.NewBuilding]: {
  type: BuildingType.NewBuilding,
  label: 'New Building',
  description: 'Description of what it does',
  category: 'gathering' | 'processing' | 'military' | 'logistics',
  tier: 1 | 2 | 3,
  cost: [
    { resource: ResourceType.Planks, amount: 2 },
    { resource: ResourceType.Stone, amount: 1 },
  ],
  worker: 'Worker Label',      // Must match a key in WORKER_TO_UNIT_TYPE
  workerTool: ResourceType.X,  // or null if no tool needed
  production: {
    inputs: [{ resource: ResourceType.X, amount: 1 }],
    outputs: [{ resource: ResourceType.Y, amount: 1 }],
    productionTime: 15,        // seconds
  },
  allowedTerrain: ['grassland', 'forest'], // or null for any
  adjacentTerrain: null,       // or terrain type required adjacent
  harvestTerrain: null,        // for gathering buildings: terrain to harvest from
  knightSlots: 0,              // for military buildings
  influenceRadius: 0,          // for military buildings (territory projection)
  visionRadius: 5,
  storageCapacity: 6,
  constructionTime: 30,        // seconds
},
```

**c) Build to verify Record completeness:** `npm run build`

### Step 3: Create 3D Model

Use the Blender MCP to create the building model:

1. Read `docs/buildings.md` for visual specs
2. Use `mcp__blender__execute_blender_code` to create the model in Blender Python
3. Use `mcp__blender__get_viewport_screenshot` to verify appearance
4. Export to `public/models/buildings/new_building.glb`

See `feudal-3d-asset-pipeline` skill for detailed Blender workflow.

### Step 4: Register in AssetLoader

In `src/engine/AssetLoader.ts`:

**a) Add to BuildingModelName type:**
```typescript
export type BuildingModelName = /* ... existing */ | 'new_building';
```

**b) Add to loadBuildingModels():**
```typescript
'new_building',  // Add to the array of model names
```

### Step 5: Map Type to Model in BuildingModels

In `src/engine/BuildingModels.ts` (or wherever the BuildingType → model name mapping lives):

```typescript
[BuildingType.NewBuilding]: 'new_building',
```

### Step 6: Set Scale in BuildingRenderer

In `src/engine/BuildingRenderer.ts`, add to `BUILDING_SCALE`:

```typescript
[BuildingType.NewBuilding]: 0.15,  // Adjust based on model size vs hex width
```

Test visually — the building should fit on a hex tile without overlapping neighbors. Typical range: 0.08–0.25.

### Step 7: Cross-Reference Worker Type

If the building requires a new worker profession:
1. Add to `UnitType` in `src/game/UnitType.ts`
2. Add to `UNIT_DEFINITIONS`
3. Add mapping in `WORKER_TO_UNIT_TYPE`
4. See `feudal-new-unit` skill for the full unit workflow

If using an existing worker type, just ensure the `worker` field in BuildingDefinition matches a key in `WORKER_TO_UNIT_TYPE`.

### Step 8: Add Specialized Manager Logic (if needed)

Some buildings need specialized manager logic beyond ProductionManager:

| Building Type | Specialized Manager | Example |
|---------------|-------------------|---------|
| Gathering (harvest terrain) | Dedicated manager (like WoodcutterManager) | State machine: idle → walk → harvest → return |
| Military (knight slots) | KnightManager integration | Knight slot count, recruitment |
| Logistics (storage) | TransporterManager routes | Warehouse-like behavior |
| Processing (standard recipe) | ProductionManager handles it | No extra manager needed |

If a new manager is needed, see `feudal-new-manager` skill.

### Step 9: Add Building Animations (if applicable)

In `src/engine/BuildingAnimator.ts`, add animation rules:

```typescript
// For smoke/chimney buildings:
// Add to the furnace glow set, or add custom animation

// For buildings with moving parts:
// Add rotation/oscillation logic similar to windmill/sawmill
```

### Step 10: Add Particle Effects (if applicable)

In `src/engine/ParticleSystem.ts`, add to `BUILDING_EMITTERS`:

```typescript
[BuildingType.NewBuilding]: [
  { effect: ParticleEffect.Smoke, rate: 3, offsetY: 0.5 },
],
```

Stay within the 800 particle budget.

### Step 11: Verify UI Auto-Discovery

The build panel auto-discovers buildings from `BUILDING_DEFINITIONS` by category and tier. No manual UI registration needed. Verify:
- Building appears in the correct category tab
- Icon/label display correctly
- Cost tooltip shows correct resources

### Step 12: SaveLoad Backward Compatibility

If you only added a new BuildingType value (no structural changes to SaveData), no migration is needed — old saves simply won't contain the new building type.

If you changed the BuildingDefinition interface or SaveData structure, see `saveload-migration` skill.

### Step 13: Write Tests

Create or update tests in `src/game/__tests__/`:

```typescript
it('should define NewBuilding with correct properties', () => {
  const def = BUILDING_DEFINITIONS[BuildingType.NewBuilding];
  expect(def.category).toBe('processing');
  expect(def.production).toBeDefined();
  expect(def.cost.length).toBeGreaterThan(0);
});

it('should place NewBuilding on valid terrain', () => {
  // Test placement validation
});

it('should produce output when inputs are available', () => {
  // Test production cycle
});
```

## Quick Reference: Existing Buildings by Category

| Category | Buildings |
|----------|-----------|
| Core | Castle |
| Gathering | WoodcutterHut, ForesterHut, Quarry, FishermanHut, Farm, IronMine, CoalMine, GoldMine, StoneMine |
| Processing | Sawmill, Windmill, Bakery, PigFarm, Slaughterhouse, IronSmelter, ToolmakerWorkshop, GoldsmithMint, BlacksmithArmory |
| Military | GuardHut, Watchtower, Barracks |
| Logistics | Warehouse, Harbor |

## Key Files
- `src/game/BuildingType.ts` — Type enum + definitions (770 lines)
- `src/engine/AssetLoader.ts` — Model registration
- `src/engine/BuildingRenderer.ts` — Scale config + mesh management
- `src/engine/BuildingAnimator.ts` — Animation rules
- `src/engine/ParticleSystem.ts` — Particle emitter bindings
- `src/game/ProductionManager.ts` — Standard production logic
- `docs/buildings.md` — Visual design specs

## Verification
1. `npm run build` — Record completeness check passes
2. `npm run test` — new and existing tests pass
3. `npm run lint` — clean
4. Visual: building renders correctly on the map (screenshot)
5. Gameplay: building can be placed, worker arrives, production runs
6. Console: no errors or missing model warnings
