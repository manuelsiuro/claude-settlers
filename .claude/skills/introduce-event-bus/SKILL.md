---
name: introduce-event-bus
description: Replace callback properties with a typed pub/sub event system. This codebase has 38+ callback properties scattered across managers. Use when adding cross-cutting events or decoupling systems.
---

# Introduce a Typed Event Bus

## When to Use
- Adding a new event that multiple systems need to react to
- Decoupling two managers that currently communicate via direct callback wiring in Game.ts
- The callback wiring in Game.ts constructor is becoming unwieldy
- A new feature needs to observe events without modifying existing managers

## Prerequisites
- Read `safe-refactoring` skill first — this is a structural change
- Build/test/lint must be green before starting
- Understand the current callback wiring in `src/engine/Game.ts` constructor

## Current Callback Inventory

Callbacks are wired in `Game.ts` constructor. Key patterns:

**Manager → Manager callbacks:**
- `constructionManager.onBuildingCompleted` → triggers `productionManager`, `territoryManager`, `unitManager`
- `combatManager.onDuelResolved` → triggers `attackManager`, `knightManager`
- `attackManager.onBuildingCaptured` → triggers `territoryManager`, `gameState`
- `knightManager.onKnightRecruited` → triggers `unitManager`
- `victoryManager.onPlayerEliminated` → triggers AI cleanup

**Manager → Renderer callbacks:**
- `constructionManager.onBuildingCompleted` → triggers `buildingAnimator.onBuildingActivated`
- `combatManager.onDuelResolved` → triggers `combatRenderer`
- `treeManager.onTreeRemoved` → triggers `treeRenderer`, `particleSystem`

**Manager → UI callbacks (via Game properties):**
- `game.onNotification` → triggers UI snackbar
- Various state changes → UI panel updates

## Step-by-Step Implementation

### Step 1: Design the Event Map

Create `src/game/EventBus.ts`:

```typescript
import type { Building } from './GameState';
import type { ResourceType } from './ResourceType';
import type { BuildingType } from './BuildingType';

// Define all event types and their payloads
export interface GameEventMap {
  // Construction
  'building:completed': { building: Building };
  'building:demolished': { building: Building; refund: Map<ResourceType, number> };
  'building:placed': { building: Building };

  // Production
  'production:started': { buildingId: string; recipe: string };
  'production:completed': { buildingId: string; outputs: { resource: ResourceType; amount: number }[] };

  // Combat
  'duel:resolved': { winnerId: string; loserId: string; buildingId: string };
  'building:captured': { buildingId: string; oldOwner: number; newOwner: number };
  'attack:started': { attackerId: number; targetBuildingId: string };

  // Military
  'knight:recruited': { unitId: string; buildingId: string };
  'knight:promoted': { unitId: string; newRank: number };

  // Resources
  'resource:delivered': { resource: ResourceType; amount: number; toBuildingId: string };

  // Territory
  'territory:changed': { playerId: number };

  // Victory
  'player:eliminated': { playerId: number };

  // UI notifications
  'notification': { type: string; message: string };
}

type EventCallback<T> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<EventCallback<unknown>>>();

  on<K extends keyof GameEventMap>(event: K, callback: EventCallback<GameEventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const cbs = this.listeners.get(event)!;
    cbs.add(callback as EventCallback<unknown>);

    // Return unsubscribe function
    return () => { cbs.delete(callback as EventCallback<unknown>); };
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of cbs) {
        cb(payload);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
```

### Step 2: Integrate into Game.ts

```typescript
// In Game constructor:
this.eventBus = new EventBus();

// Pass to managers that need to emit:
// (Gradually — one manager at a time)
```

### Step 3: Migrate One Callback at a Time

**Migration protocol for each callback:**

1. **Identify the callback:** e.g., `constructionManager.onBuildingCompleted`
2. **Find all subscribers:** Grep for where it's assigned in Game.ts
3. **Add EventBus emission** in the manager alongside the existing callback:
   ```typescript
   // In ConstructionManager:
   if (this.onBuildingCompleted) this.onBuildingCompleted(building);
   this.eventBus?.emit('building:completed', { building });
   ```
4. **Move subscribers to EventBus** one by one:
   ```typescript
   // In Game constructor, replace:
   this.constructionManager.onBuildingCompleted = (b) => {
     this.territoryManager.recalculate(b.playerId);
   };
   // With:
   this.eventBus.on('building:completed', ({ building }) => {
     this.territoryManager.recalculate(building.playerId);
   });
   ```
5. **Remove the old callback property** once all subscribers are migrated
6. **Build + test + verify** after each callback migration

### Step 4: Adapt Tests

Tests that relied on callback properties need updating:

```typescript
// Old pattern:
manager.onSomething = vi.fn();
manager.doThing();
expect(manager.onSomething).toHaveBeenCalled();

// New pattern:
const handler = vi.fn();
eventBus.on('something:happened', handler);
manager.doThing();
expect(handler).toHaveBeenCalledWith({ /* payload */ });
```

## Migration Priority

Migrate in this order (least coupled → most coupled):

1. **Notification events** — pure UI, no game logic dependencies
2. **Tree events** — `onTreeRemoved`, `onTreePlanted` — simple, few subscribers
3. **Construction events** — `onBuildingCompleted` — many subscribers but well-defined
4. **Combat events** — `onDuelResolved`, `onBuildingCaptured` — complex chain
5. **Territory events** — after combat, since they often trigger together

## Key Files
- `src/engine/Game.ts` — Current callback wiring hub (constructor)
- `src/game/ConstructionManager.ts` — Example callback source
- `src/game/CombatManager.ts` — Complex callback chains
- `src/game/AttackManager.ts` — Attack/capture events

## Verification
1. `npm run build` — compiles
2. `npm run test` — all tests pass (update test patterns as needed)
3. `npm run lint` — clean
4. Play the game — buildings complete, combat resolves, territory updates, no regressions
5. Count remaining callback properties — should decrease with each migration batch
