---
name: feudal-new-unit
description: End-to-end guide for adding a new unit type (serf profession or military). Covers UnitType.ts, 3D model, AssetLoader, UnitModels, specialized manager, combat integration, and tests.
---

# Add a New Unit Type

## When to Use
When adding a new serf profession (civilian worker) or military unit type to the game.

## Prerequisites
- Read `docs/units.md` for visual design specs (base model + profession-specific additions)
- Read `docs/game.md` or `docs/expansion.md` for the unit's mechanics
- Know whether this is a civilian worker or military unit

## 9-Step Checklist

### Step 1: Add to UnitType

In `src/game/UnitType.ts`:

**a) Add type constant:**
```typescript
export const UnitType = {
  // ... existing types
  NewUnit: 'new_unit',
} as const;
```

**b) Add definition to UNIT_DEFINITIONS:**
```typescript
[UnitType.NewUnit]: {
  type: UnitType.NewUnit,
  label: 'New Unit',
  category: 'civilian',  // or 'military'
  requiredTool: ResourceType.Axe, // specific tool type (see TOOL_TYPES), or null if no tool needed
  moveSpeed: 1.5,  // units per second (Transporter: 2.0, Knight: 1.8, most workers: 1.5)
},
```

**c) Add worker-to-unit mapping** (if this is a building worker):
```typescript
// In WORKER_TO_UNIT_TYPE:
'Worker Label': UnitType.NewUnit,  // Must match BuildingDefinition.worker field
```

**d) Build to verify:** `npm run build`

### Step 2: Create 3D Model

Use the Blender MCP:

1. Read `docs/units.md` for the base serf model specs
2. Create the unit model — start from the base serf shape, add profession-specific elements:
   - **Civilian workers:** Add tool/accessory (e.g., axe for woodcutter, hammer for builder)
   - **Military units:** Add armor, weapon, faction color areas
3. Use `mcp__blender__get_viewport_screenshot` to verify
4. Export to `public/models/units/new_unit.glb`

See `feudal-3d-asset-pipeline` skill for detailed Blender workflow.

### Step 3: Register in AssetLoader

In `src/engine/AssetLoader.ts`:

**a) Add to UnitModelName type:**
```typescript
export type UnitModelName = /* ... existing */ | 'new_unit';
```

**b) Add to loadUnitModels():**
```typescript
'new_unit',  // Add to the array of model names
```

### Step 4: Map Type to Model

In the UnitType → model name mapping (in `src/engine/UnitRenderer.ts` or a separate mapping file):

```typescript
[UnitType.NewUnit]: 'new_unit',
```

### Step 5: Military-Specific Steps (skip for civilians)

If this is a military unit:

**a) Faction color tinting** (in `UnitRenderer.ts`):
Add the unit type to the set of units that receive faction color tinting (40% lerp toward player color).

**b) Combat integration** (in `CombatManager.ts`):
- Define combat stats if different from knights (attack, defense, HP)
- Add to duel resolution logic if combat works differently

**c) Rank system** (if applicable):
- Add rank chevron rendering in `UnitRenderer.ts`
- Add rank-up logic in `KnightManager.ts` or a new manager

**d) Recruitment path:**
- Define what resources/conditions create this unit
- Update `KnightManager` or create dedicated recruitment manager

### Step 6: Wire Worker-to-Building

If this unit is a building worker:

**a) Ensure `BuildingDefinition.worker`** matches the label used in `WORKER_TO_UNIT_TYPE`

**b) Verify UnitManager** spawns the correct unit type when the building needs a worker:
- `UnitManager` uses `getWorkerUnitType(building.worker)` to determine which unit to spawn
- The new mapping in Step 1c ensures this works

**c) Test the flow:**
1. Place the building that needs this worker
2. Verify a unit of the correct type spawns from the Castle
3. Verify the unit walks to the building and starts working

### Step 7: Create Specialized Manager (if needed)

Some unit types need custom behavior beyond walk-to-building-and-work:

| Unit Pattern | Example | Manager Needed |
|-------------|---------|----------------|
| Standard worker | Baker, Miller | None (ProductionManager handles it) |
| Gathering worker | Woodcutter, Miner | Yes — state machine (see WoodcutterManager) |
| Transport unit | Transporter | TransporterManager |
| Military unit | Knight | KnightManager + CombatManager |
| Autonomous unit | Geologist | GeologistManager |

If a new manager is needed, see `feudal-new-manager` skill.

### Step 8: Extend Unit Interface (if needed)

If the new unit type carries extra state (e.g., satiation for hunger system, ammo for archers):

In `src/game/GameState.ts`, extend the `Unit` interface:
```typescript
interface Unit {
  // ... existing fields
  satiation?: number;  // Optional for backward compat
}
```

Update `SaveLoad.ts` to serialize/deserialize the new field.
See `saveload-migration` skill if this requires a version bump.

### Step 9: Write Tests

```typescript
describe('NewUnit', () => {
  it('should be defined in UNIT_DEFINITIONS', () => {
    const def = UNIT_DEFINITIONS[UnitType.NewUnit];
    expect(def).toBeDefined();
    expect(def.category).toBe('civilian');
    expect(def.moveSpeed).toBeGreaterThan(0);
  });

  it('should map from worker label to unit type', () => {
    expect(getWorkerUnitType('Worker Label')).toBe(UnitType.NewUnit);
  });

  it('should spawn when building is placed', () => {
    // Place building, verify unit spawns with correct type
  });
});
```

## Quick Reference: Existing Units

| Category | Units |
|----------|-------|
| Logistics | Transporter, Builder |
| Gathering | Woodcutter, Forester, Stonemason, Miner, Farmer, Fisherman, Geologist |
| Processing | SawmillWorker, Miller, Baker, PigFarmer, Butcher, SmelterWorker, Goldsmith, Toolmaker, Blacksmith |
| Military | Knight |

## Key Files
- `src/game/UnitType.ts` — Type enum + definitions (~210 lines)
- `src/engine/AssetLoader.ts` — Model registration
- `src/engine/UnitRenderer.ts` — Rendering, animations, faction colors, rank chevrons
- `src/game/UnitManager.ts` — Unit spawning and lifecycle
- `src/game/KnightManager.ts` — Military recruitment
- `src/game/CombatManager.ts` — Combat resolution
- `docs/units.md` — Visual design specs

## Verification
1. `npm run build` — Record completeness check passes
2. `npm run test` — new and existing tests pass
3. `npm run lint` — clean
4. Visual: unit renders correctly, walks to building (screenshot)
5. Gameplay: unit spawns, walks, works, carries resources
6. Console: no errors or missing model warnings
