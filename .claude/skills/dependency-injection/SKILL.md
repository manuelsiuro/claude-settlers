---
name: dependency-injection
description: Introduce lightweight dependency injection for manager classes. Game.ts manually creates 18 managers with hand-wired dependencies. Use when adding managers or improving testability.
---

# Lightweight Dependency Injection

## When to Use
- Adding a new manager and the Game.ts constructor is getting unwieldy
- Writing tests that need to mock specific managers
- Two managers have a circular dependency that's hard to wire
- You want to swap implementations (e.g., AI vs human input) without changing Game.ts

## Prerequisites
- Read `safe-refactoring` skill
- Read `refactor-god-class` skill (DI complements class decomposition)
- Build/test/lint clean

## Current Dependency Graph

Game.ts constructor manually creates managers in order. Simplified dependency tree:

```
GameState (foundation — no deps)
├── HexGrid
├── RoadNetwork(gameState, grid)
├── TerritoryManager(gameState, grid)
├── UnitManager(gameState, grid)
├── ConstructionManager(gameState, grid, roadNetwork)
├── ProductionManager(gameState, grid, roadNetwork, territoryManager)
├── TransporterManager(gameState, roadNetwork)
├── LogisticsManager(gameState, roadNetwork, territoryManager)
├── HarborManager(gameState, roadNetwork, grid)
├── KnightManager(gameState)
├── CombatManager(gameState, territoryManager)
├── AttackManager(gameState, territoryManager, combatManager)
├── DuelAnimationManager()
├── VictoryManager(gameState, territoryManager)
├── GeologistManager(gameState, grid)
├── TreeManager(gameState, grid)
├── WoodcutterManager(gameState, grid, treeManager)
├── ForesterManager(gameState, grid, treeManager)
├── UpgradeManager(gameState)
├── FogOfWarManager(grid, territoryManager)
└── EconomyTracker()
```

## Step-by-Step Implementation

### Step 1: Define Service Interfaces

Create `src/game/interfaces/` directory with interfaces for cross-referenced managers:

```typescript
// src/game/interfaces/IGameState.ts
import type { Building, Unit, HexCoord } from '../GameState';
import type { BuildingType } from '../BuildingType';

export interface IGameState {
  getAllBuildings(): Building[];
  getBuilding(id: string): Building | undefined;
  getBuildingAt(q: number, r: number): Building | undefined;
  getBuildingsByPlayer(playerId: number): Building[];
  placeBuilding(type: BuildingType, coord: HexCoord, playerId: number): unknown;
  // ... other public methods
}
```

Only extract interfaces for managers that are cross-referenced (used as dependencies by other managers). Not every class needs an interface.

**Priority interfaces:**
- `IGameState` — used by nearly every manager
- `ITerritoryManager` — used by 5+ managers
- `IRoadNetwork` — used by 4+ managers
- `IGrid` — used by 8+ managers

### Step 2: Create a Service Container

```typescript
// src/game/ServiceContainer.ts
export class ServiceContainer {
  private services = new Map<string, unknown>();

  register<T>(key: string, service: T): void {
    this.services.set(key, service);
  }

  get<T>(key: string): T {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`Service '${key}' not registered`);
    }
    return service as T;
  }

  has(key: string): boolean {
    return this.services.has(key);
  }
}
```

**Design choices:**
- No external dependencies (no inversify, tsyringe, etc.)
- String keys (simple, debuggable)
- Eager registration (no lazy factories — keep it simple)
- No decorators (not supported with `erasableSyntaxOnly: true`)

### Step 3: Register Services in Order

```typescript
// In Game.ts or ManagerFactory:
const container = new ServiceContainer();

// Foundation
container.register('grid', grid);
container.register('gameState', gameState);

// Infrastructure
container.register('roadNetwork', new RoadNetwork(
  container.get<IGameState>('gameState'),
  container.get<IGrid>('grid')
));

container.register('territoryManager', new TerritoryManager(
  container.get<IGameState>('gameState'),
  container.get<IGrid>('grid')
));

// ... etc, in dependency order
```

### Step 4: Migrate Managers Gradually

For each manager, one at a time:

1. **Extract interface** (if cross-referenced)
2. **Update constructor** to accept interfaces instead of concrete classes
3. **Register in container** instead of manual `new` in Game.ts
4. **Build + test** after each migration

### Step 5: Testing Benefits

With DI, tests can inject mocks:

```typescript
// Before DI: hard to test CombatManager without real TerritoryManager
const combat = new CombatManager(realGameState, realTerritoryManager);

// After DI: inject a mock
const mockTerritory: ITerritoryManager = {
  getOwner: vi.fn().mockReturnValue(1),
  recalculate: vi.fn(),
  // ... only mock what's needed
};
const combat = new CombatManager(mockGameState, mockTerritory);
```

## When NOT to Use DI

- For simple value objects or data types
- For renderers (they depend on Three.js scene, not on other renderers)
- For UI modules (they have their own initialization pattern)
- If the class has only 1-2 dependencies — just pass them directly

## Anti-Patterns to Avoid

1. **Service locator in business logic** — Don't pass the container itself to managers. Pass resolved dependencies.
2. **Over-abstraction** — Don't create interfaces for classes with only one implementation unless you need it for testing.
3. **Lazy resolution** — Keep it eager. Lazy factories add complexity without benefit here.
4. **Decorator-based DI** — Not compatible with `erasableSyntaxOnly: true`.

## Key Files
- `src/engine/Game.ts` — Current manual wiring (constructor)
- `src/game/GameState.ts` — Most-referenced dependency
- `src/game/TerritoryManager.ts` — Cross-referenced by 5+ managers
- `src/game/RoadNetwork.ts` — Cross-referenced by 4+ managers

## Verification
1. `npm run build` — interfaces and container compile correctly
2. `npm run test` — tests pass (update tests to use interfaces where needed)
3. `npm run lint` — clean
4. Game plays normally
5. New manager tests are easier to write with mock injection
