---
name: extract-data-files
description: Move static data definitions out of TypeScript code. Targets BuildingType.ts (770 lines, 23 inline definitions) and AI build orders. Use when data needs frequent editing or balance tuning.
---

# Extract Data Files

## When to Use
- Editing game balance (production times, costs, resource amounts) and the data is buried in large TypeScript files
- Adding new building/unit/resource types and the definition file is unwieldy
- AI build orders need tuning without touching logic code
- Data should be editable without understanding the surrounding TypeScript logic

## Prerequisites
- Read `safe-refactoring` skill — this changes high-fan-out files
- `npm run build && npm run test` must pass
- Understand the `Record<SomeType, Definition>` completeness requirement

## Primary Targets

### Target 1: BuildingType.ts (770 lines → ~200 logic + data file)

**Current structure:**
```
src/game/BuildingType.ts
├── BuildingType const (23 keys)
├── BuildingCost interface
├── ProductionRecipe interface
├── BuildingDefinition interface
├── BUILDING_DEFINITIONS Record (23 full definitions, ~550 lines)
├── getBuildingsByCategory()
└── getBuildingsByTier()
```

**Proposed split:**
```
src/game/BuildingType.ts          — Types, interfaces, helper functions (~200 lines)
src/game/data/buildingDefinitions.ts — BUILDING_DEFINITIONS Record (~550 lines)
```

### Target 2: AI Build Orders (in AIPlayer.ts, ~557 lines)

**Current structure:**
```
src/game/AIPlayer.ts
├── ECONOMIC_BUILD_ORDER array
├── BALANCED_BUILD_ORDER array
├── AGGRESSIVE_BUILD_ORDER array
├── Difficulty-to-strategy mapping
└── AIPlayer class logic
```

**Proposed split:**
```
src/game/AIPlayer.ts              — AIPlayer class logic only
src/game/data/aiBuildOrders.ts    — Build order arrays + difficulty config
```

### Target 3: Unit Definitions (smaller, ~210 lines)

**Current structure:**
```
src/game/UnitType.ts
├── UnitType const (19 keys)
├── UnitDefinition interface
├── UNIT_DEFINITIONS Record
├── WORKER_TO_UNIT_TYPE map
└── getWorkerUnitType()
```

This file is smaller and may not need extraction yet, but follow the same pattern if it grows.

## Step-by-Step Extraction

### Approach: Separate TypeScript Data Module

Use a `.ts` file (not JSON) so you get type checking and can reference other types:

#### Step 1: Create the Data File

```typescript
// src/game/data/buildingDefinitions.ts
import type { BuildingDefinition } from '../BuildingType';
import { BuildingType } from '../BuildingType';
import { ResourceType } from '../ResourceType';

export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  [BuildingType.Castle]: {
    type: BuildingType.Castle,
    label: 'Castle',
    // ... full definition
  },
  // ... all 23 buildings
};
```

#### Step 2: Update the Source File

```typescript
// src/game/BuildingType.ts — now contains only types and helpers
export const BuildingType = { /* ... */ } as const;
export type BuildingType = (typeof BuildingType)[keyof typeof BuildingType];

export interface BuildingCost { /* ... */ }
export interface ProductionRecipe { /* ... */ }
export interface BuildingDefinition { /* ... */ }

// Re-export data for backward compatibility
export { BUILDING_DEFINITIONS } from './data/buildingDefinitions';

// Helper functions stay here
export function getBuildingsByCategory(category: string): BuildingDefinition[] {
  return Object.values(BUILDING_DEFINITIONS).filter(b => b.category === category);
}
```

#### Step 3: Verify All Importers Still Work

```bash
# Find all files importing from BuildingType
grep -r "from '.*BuildingType'" src/ --include="*.ts"
```

Because we re-export `BUILDING_DEFINITIONS` from the original file, **no downstream files need changing**. This is the key benefit of the re-export approach.

#### Step 4: Build + Test + Verify

```bash
npm run build   # Must compile — Record completeness checked at compile time
npm run test    # All existing tests pass unchanged
npm run lint    # No violations
```

### For AI Build Orders

#### Step 1: Create Data File

```typescript
// src/game/data/aiBuildOrders.ts
import { BuildingType } from '../BuildingType';

export const ECONOMIC_BUILD_ORDER: BuildingType[] = [
  BuildingType.WoodcutterHut,
  BuildingType.ForesterHut,
  // ...
];

export const BALANCED_BUILD_ORDER: BuildingType[] = [ /* ... */ ];
export const AGGRESSIVE_BUILD_ORDER: BuildingType[] = [ /* ... */ ];

export interface DifficultyConfig {
  buildOrder: BuildingType[];
  attackThresholdStep: number;
  knightsPerAttack: number;
  skipChance: number;
}

export const DIFFICULTY_CONFIGS: Record<string, DifficultyConfig> = {
  easy: { buildOrder: ECONOMIC_BUILD_ORDER, attackThresholdStep: 16, knightsPerAttack: 1, skipChance: 0.3 },
  normal: { buildOrder: BALANCED_BUILD_ORDER, attackThresholdStep: 12, knightsPerAttack: 1, skipChance: 0 },
  hard: { buildOrder: AGGRESSIVE_BUILD_ORDER, attackThresholdStep: 8, knightsPerAttack: 2, skipChance: 0 },
};
```

#### Step 2: Update AIPlayer.ts

Replace inline arrays with imports from the data file. Class logic stays.

## Impact Analysis

### BuildingType.ts Importers (20+ files)
With the re-export approach, **zero files need updating** for the initial extraction. The re-export preserves the existing public API.

Only remove the re-export later if you want to enforce direct imports from the data file (optional cleanup).

### Record Completeness Safety
TypeScript enforces `Record<BuildingType, BuildingDefinition>` covers all 23 keys. If a new building is added to `BuildingType` but not to the data file, the build will fail with a clear error. This is a safety net.

## Key Files
- `src/game/BuildingType.ts` — Primary extraction target (770 lines)
- `src/game/AIPlayer.ts` — AI build orders extraction target
- `src/game/UnitType.ts` — Secondary target (210 lines)
- `src/game/ResourceType.ts` — Smallest, may not need extraction (60 lines)

## Verification
1. `npm run build` — Record completeness verified at compile time
2. `npm run test` — all tests pass unchanged (re-export preserves API)
3. `npm run lint` — clean
4. Grep for imports — confirm no broken references
5. Play the game — buildings, AI, production chains all work
