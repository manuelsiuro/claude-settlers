---
name: refactor-god-class
description: Decompose oversized classes. Covers Game.ts (1,212 lines, 18 managers, 19 renderers) and AIPlayer.ts (557 lines). Use when a class has too many responsibilities.
---

# Refactor God Classes

## When to Use
- A class exceeds 500 lines
- A constructor has 40+ field assignments
- A class has more than 5 distinct responsibilities
- You need to test one part of a class in isolation but can't

## Prerequisites
- Read `safe-refactoring` skill — god class decomposition is high-risk
- Build/test/lint clean
- Understand the class's full responsibility set before planning the split

## Diagnosis Checklist

A class is a "god class" if it has:
- [ ] 500+ lines of code
- [ ] 40+ instance fields
- [ ] 100+ line constructor
- [ ] Methods that don't use most of the class's fields (low cohesion)
- [ ] Multiple unrelated responsibilities (e.g., initialization + game loop + event wiring)

## Target 1: Game.ts (~750+ lines)

### Current Responsibilities
1. **Manager creation** — Instantiates 18+ managers with dependency wiring
2. **Renderer creation** — Instantiates 18+ renderers
3. **Event wiring** — Connects manager callbacks to other managers/renderers
4. **Scene setup** — Three.js scene, camera, lights, controls
5. **Game loop** — `animate()` method calling all updates in order
6. **Public API** — Getters, game controls (pause/resume/speed), settings
7. **Asset loading** — Orchestrates AssetLoader in `start()`
8. **AI initialization** — Creates AI players based on config

### Decomposition Plan: 4 Extracted Classes

**Extract 1: `ManagerFactory`** (creation + dependency resolution)
```
src/engine/ManagerFactory.ts
- createManagers(gameState, grid, config): ManagerSet
- ManagerSet interface (all 18+ manager fields)
- Dependency ordering logic
```

**Extract 2: `GameEventWiring`** (callback connections)
```
src/engine/GameEventWiring.ts
- wireEvents(managers, renderers, game): void
- All onX callback assignments moved here
- Clear documentation of event flow
```

**Extract 3: `RendererFactory`** (renderer creation + scene setup)
```
src/engine/RendererFactory.ts
- createRenderers(config): RendererSet
- RendererSet interface (all renderer fields)
- addAllToScene(scene): void
```

**Extract 4: `GameLoop`** (update orchestration)
```
src/engine/GameLoop.ts
- update(deltaTime, managers, renderers): void
- Manager update ordering
- Renderer update ordering
- Timing logic
```

**Remaining in Game.ts:**
- Constructor calls factories, wiring, and loop setup
- Public API (getters, pause/resume, settings)
- `start()` and `dispose()` orchestration

### Step-by-Step Extraction Protocol

For each extraction:

1. **Create the new class** with methods that contain the extracted logic
2. **Pass dependencies** via constructor or method parameters (no global access)
3. **Call the new class** from Game.ts where the code used to be inline
4. **Build + test** — must compile and pass
5. **Verify visually** — take screenshot, check console

**Order matters:** Extract `ManagerFactory` first (simplest, no cross-references), then `RendererFactory`, then `GameEventWiring` (needs both manager and renderer references), then `GameLoop` last (needs everything).

## Target 2: AIPlayer.ts (~557 lines)

### Current Responsibilities
1. **Build order data** — Static arrays of building sequences
2. **Economy decisions** — When to place which building
3. **Military decisions** — When to attack, which target
4. **Hex selection** — Finding valid placement locations
5. **Threat response** — Reacting to attacks

### Decomposition Plan: Data + 2 Planners

**Extract 1: Build Order Data** (see `extract-data-files` skill)
```
src/game/data/aiBuildOrders.ts
- ECONOMIC_BUILD_ORDER, BALANCED_BUILD_ORDER, AGGRESSIVE_BUILD_ORDER
- DifficultyConfig interface and configs
```

**Extract 2: `AIEconomyPlanner`**
```
src/game/AIEconomyPlanner.ts
- decideBuild(gameState, budget, buildOrder, step): BuildDecision | null
- findValidHex(buildingType, territory): HexCoord | null
- Stateless — takes current state, returns decision
```

**Extract 3: `AIMilitaryPlanner`**
```
src/game/AIMilitaryPlanner.ts
- shouldAttack(gameState, knightCount, threshold): boolean
- selectTarget(gameState, playerId): Building | null
- Stateless — pure analysis functions
```

**Remaining in AIPlayer.ts:**
- `update()` method orchestrating planners
- State tracking (current step, cooldowns)
- `_getState()` / `_loadState()` for serialization

## General God Class Extraction Protocol

For any class that needs decomposition:

### 1. Map Responsibilities
List every distinct responsibility the class handles. Group related methods and fields.

### 2. Identify Seams
Find natural boundaries where responsibilities don't share fields:
- Methods that only use a subset of fields → candidate for extraction
- Code blocks in the constructor that could be a factory call
- Sequential code in update loops that could be separate update calls

### 3. Extract Bottom-Up
Start with the most independent responsibility (fewest dependencies on other parts of the class):
1. Create new class
2. Move methods + related fields
3. Pass remaining dependencies as constructor/method params
4. Update the original class to delegate

### 4. Preserve Public API
The original class should still expose the same public interface. Internal decomposition should be invisible to callers.

## Key Files
- `src/engine/Game.ts` — Primary god class (~750+ lines)
- `src/game/AIPlayer.ts` — Secondary god class (~557 lines)
- `src/game/BuildingType.ts` — Data god class (see `extract-data-files`)

## Verification
1. `npm run build` — compiles (most important — type checking catches broken references)
2. `npm run test` — all tests pass
3. `npm run lint` — clean
4. Game plays normally — screenshot, console check
5. Line counts: original class should be <300 lines after extraction
6. Each extracted class should have a single clear responsibility
