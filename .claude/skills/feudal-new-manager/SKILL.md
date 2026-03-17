---
name: feudal-new-manager
description: Create a new game manager class following existing patterns. Template with constructor, _getState/_loadState, update(deltaTime), plus 7-step integration into Game.ts and SaveLoad.ts.
---

# Add a New Game Manager

## When to Use
When adding a new game system that needs per-frame updates, state persistence, and integration with the game loop. Examples: FeedingManager, MoraleManager, HousingManager.

## Prerequisites
- Read the relevant design doc (`docs/game.md` or `docs/expansion.md`) for the system's requirements
- Identify which existing managers the new one depends on
- Identify which managers depend on events from the new one

## Manager Template

Create `src/game/<ManagerName>.ts`:

```typescript
import type { GameState } from './GameState';
// Import other dependencies as needed

export interface <ManagerName>State {
  // Serializable state for save/load
}

export class <ManagerName> {
  private gameState: GameState;
  // Add other dependencies

  // Callbacks for cross-system communication
  onSomethingHappened: ((data: SomeType) => void) | null = null;

  constructor(gameState: GameState /*, other deps */) {
    this.gameState = gameState;
  }

  update(deltaTime: number): void {
    // Called every frame from Game.animate()
    // deltaTime is in seconds, already scaled by game speed
  }

  _getState(): <ManagerName>State {
    // Return serializable snapshot for save
    return {};
  }

  _loadState(state: <ManagerName>State): void {
    // Restore from saved data
  }
}
```

## 7-Step Integration

### Step 1: Create the Manager File
Write the class in `src/game/<ManagerName>.ts` following the template above.

### Step 2: Instantiate in Game.ts Constructor
In `src/engine/Game.ts`, add as a private field and instantiate in the constructor:

```typescript
private <managerName>: <ManagerName>;

// In constructor, after its dependencies are created:
this.<managerName> = new <ManagerName>(this.gameState /*, deps */);
```

**Constructor ordering matters** — managers must be created after their dependencies:
1. GameState, HexGrid (foundation)
2. RoadNetwork, TerritoryManager (infrastructure)
3. UnitManager, ProductionManager, ConstructionManager (core)
4. LogisticsManager, TransporterManager (logistics)
5. KnightManager, CombatManager, AttackManager (military)
6. EconomyTracker (analytics — last)

Place the new manager in the correct position based on its dependencies.

### Step 3: Add to the Animate Loop
In `Game.animate()`, call `update(deltaTime)` in the correct order:

```typescript
// In animate(), at the appropriate position:
this.<managerName>.update(deltaTime);
```

**Update ordering rules:**
- Territory updates first (other systems depend on borders)
- Production/construction before logistics (produce goods, then route them)
- Unit movement after logistics (transporters need assignments)
- Economy tracking last (observes all other systems)

### Step 4: Wire Callbacks
In the Game constructor, wire any cross-system callbacks:

```typescript
// Wire callbacks
this.<managerName>.onSomethingHappened = (data) => {
  this.someOtherManager.handleSomething(data);
};
```

### Step 5: Add to SaveLoad.ts
In `src/game/SaveLoad.ts`:

**a) Extend SaveData interface:**
```typescript
interface SaveData {
  // ... existing fields
  <managerName>?: <ManagerName>State; // Optional for backward compat
}
```

**b) Add to serializeGame:**
```typescript
<managerName>: managers.<managerName>._getState(),
```

**c) Add to deserializeGame:**
```typescript
if (data.<managerName>) {
  managers.<managerName>._loadState(data.<managerName>);
}
```

**d) Bump SAVE_VERSION** if the save format changed in a way that requires migration.

### Step 6: Expose via Game Getters (if UI needs access)
```typescript
get<ManagerName>(): <ManagerName> {
  return this.<managerName>;
}
```

### Step 7: Write Tests
Create `src/game/__tests__/<ManagerName>.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { <ManagerName> } from '../<ManagerName>';
// Mock or create minimal dependencies

describe('<ManagerName>', () => {
  let manager: <ManagerName>;

  beforeEach(() => {
    // Set up with minimal dependencies
    manager = new <ManagerName>(/* deps */);
  });

  it('should initialize with default state', () => {
    const state = manager._getState();
    expect(state).toBeDefined();
  });

  it('should serialize and deserialize correctly', () => {
    // Modify state, serialize, create new instance, deserialize, compare
    const state = manager._getState();
    const newManager = new <ManagerName>(/* deps */);
    newManager._loadState(state);
    expect(newManager._getState()).toEqual(state);
  });

  it('should update correctly', () => {
    manager.update(1.0); // 1 second
    // Assert expected behavior
  });
});
```

## Reference Examples by Complexity

| Complexity | Example | Key Pattern |
|------------|---------|-------------|
| Simple | `ProductionManager` | Timer-based, processes buildings each frame |
| Medium | `LogisticsManager` | Routes goods between buildings via flags |
| Complex | `WoodcutterManager` | State machine per worker (idle → walking → chopping → returning) |
| Analytics | `EconomyTracker` | Rolling window, no mutations, observation only |

## Key Files
- `src/engine/Game.ts` — Manager instantiation, animate loop, callback wiring
- `src/game/SaveLoad.ts` — Serialization/deserialization
- `src/game/GameState.ts` — Central state (buildings, units, workers)
- `src/game/` — All existing managers for reference

## Verification
1. `npm run build` — compiles without errors
2. `npm run test` — new tests pass, existing tests still pass
3. `npm run lint` — no violations
4. Start dev server, play the game — verify the new system works in-game
5. Save and load — verify state persists correctly
