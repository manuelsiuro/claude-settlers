---
name: saveload-migration
description: Add versioned schema migration to save/load. SaveLoad.ts has SAVE_VERSION=7 with ad-hoc backward-compat patches. Use when adding state fields or changing save data structures.
---

# Save/Load Versioned Migration

## When to Use
- Adding a new field to SaveData that old saves won't have
- Changing the shape of a manager's serialized state
- Removing or renaming a field in saved data
- Old saves are crashing on load due to missing data

## Prerequisites
- Read `safe-refactoring` skill
- Understand the current SaveLoad.ts structure (SAVE_VERSION = 7)
- Build/test/lint clean

## Current Save System

### SaveLoad.ts Structure
- `SAVE_VERSION = 7` — current format version
- `SaveData` interface — full game state snapshot
- `serializeGame()` — creates SaveData from live game
- `deserializeGame()` — restores game from SaveData
- Backward compat: version < 3 or > SAVE_VERSION → discard
- Ad-hoc patches in `deserializeGame()` for missing fields

### Current Ad-Hoc Patches
In `deserializeGame()`, buildings are patched inline:
```typescript
// Missing fields get defaults:
building.upgradeLevels ??= { production: 0, storage: 0 };
building.activeUpgrade ??= null;
building.extraWorkerIds ??= [];
building.productionPaused ??= false;
```

This approach doesn't scale. Each new field adds another patch, and there's no clear mapping of which version introduced which field.

## Migration System Design

### Step 1: Define Migration Interface

```typescript
// In SaveLoad.ts or a new src/game/migrations.ts:

interface SaveMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate(data: Record<string, unknown>): Record<string, unknown>;
}
```

### Step 2: Create Ordered Migration Array

```typescript
const MIGRATIONS: SaveMigration[] = [
  {
    fromVersion: 3,
    toVersion: 4,
    description: 'Add building upgrade fields',
    migrate(data) {
      for (const b of (data.buildings as Array<Record<string, unknown>>)) {
        b.upgradeLevels ??= { production: 0, storage: 0 };
        b.activeUpgrade ??= null;
      }
      data.version = 4;
      return data;
    },
  },
  {
    fromVersion: 4,
    toVersion: 5,
    description: 'Add extra worker support and production pause',
    migrate(data) {
      for (const b of (data.buildings as Array<Record<string, unknown>>)) {
        b.extraWorkerIds ??= [];
        b.productionPaused ??= false;
      }
      data.version = 5;
      return data;
    },
  },
  {
    fromVersion: 5,
    toVersion: 6,
    description: 'Add fog of war manager state',
    migrate(data) {
      data.fogOfWarManager ??= null;
      data.version = 6;
      return data;
    },
  },
  {
    fromVersion: 6,
    toVersion: 7,
    description: 'Add harbor manager state',
    migrate(data) {
      data.harborManager ??= null;
      data.version = 7;
      return data;
    },
  },
  // Future migrations go here
];
```

### Step 3: Create Migration Runner

```typescript
function runMigrations(data: Record<string, unknown>): Record<string, unknown> {
  let currentVersion = (data.version as number) ?? 3;

  if (currentVersion < 3) {
    throw new Error(`Save version ${currentVersion} is too old to migrate`);
  }

  for (const migration of MIGRATIONS) {
    if (currentVersion === migration.fromVersion) {
      console.log(`Migrating save: v${migration.fromVersion} → v${migration.toVersion}: ${migration.description}`);
      data = migration.migrate(data);
      currentVersion = migration.toVersion;
    }
  }

  if (currentVersion !== SAVE_VERSION) {
    throw new Error(`Migration failed: reached v${currentVersion}, expected v${SAVE_VERSION}`);
  }

  return data;
}
```

### Step 4: Integrate with Load Functions

```typescript
// In loadFromLocalStorage():
export function loadFromLocalStorage(): SaveData | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  const data = JSON.parse(raw) as Record<string, unknown>;
  const version = (data.version as number) ?? 0;

  if (version < 3 || version > SAVE_VERSION) {
    console.warn(`Discarding save: version ${version} not supported`);
    return null;
  }

  if (version < SAVE_VERSION) {
    const migrated = runMigrations(data);
    // Optionally re-save the migrated version:
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated as SaveData;
  }

  return data as SaveData;
}

// Same pattern for loadFromFile()
```

### Step 5: Remove Ad-Hoc Patches

Once the migration array covers all version transitions (3→4→5→6→7), remove the inline `??=` patches from `deserializeGame()`. The migration runner handles them.

## Adding a New Version

Every time you add a new field to SaveData or change state shape:

1. **Bump SAVE_VERSION** (e.g., 7 → 8)
2. **Add a migration** to the MIGRATIONS array:
   ```typescript
   {
     fromVersion: 7,
     toVersion: 8,
     description: 'Add feeding manager state for unit hunger',
     migrate(data) {
       data.feedingManager ??= { unitSatiation: {} };
       data.version = 8;
       return data;
     },
   },
   ```
3. **Update SaveData interface** with the new field (optional `?` for the interface, migration ensures it exists)
4. **Write a test** for the migration

## Test Fixtures

Create test saves for each version:

```typescript
// src/game/__tests__/migrations.test.ts
import { describe, it, expect } from 'vitest';

const V3_SAVE = {
  version: 3,
  buildings: [{ id: 'b1', type: 'castle', /* v3 fields only */ }],
  // ... minimal v3 data
};

describe('Save migrations', () => {
  it('should migrate v3 to current version', () => {
    const result = runMigrations(structuredClone(V3_SAVE));
    expect(result.version).toBe(SAVE_VERSION);
    // Verify all migrated fields exist
    const building = (result.buildings as Array<Record<string, unknown>>)[0];
    expect(building.upgradeLevels).toBeDefined();
    expect(building.extraWorkerIds).toBeDefined();
    expect(building.productionPaused).toBe(false);
  });

  it('should handle each version step correctly', () => {
    // Test each individual migration in isolation
  });

  it('should reject saves older than v3', () => {
    expect(() => runMigrations({ version: 2 })).toThrow();
  });
});
```

## Key Files
- `src/game/SaveLoad.ts` — Save/load system (SAVE_VERSION = 7, ~495 lines)
- `src/engine/Game.ts` — Calls save/load during start() and on user action
- `src/game/GameState.ts` — Building/unit data structures that get serialized

## Verification
1. `npm run build` — compiles
2. `npm run test` — migration tests pass, existing save/load tests pass
3. Save a game, load it — works normally
4. Manually edit a save file to version 3 — loads correctly after migration
5. Check console for migration log messages
