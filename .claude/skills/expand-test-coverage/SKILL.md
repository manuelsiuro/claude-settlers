---
name: expand-test-coverage
description: Add tests for untested layers (engine/, ui/). Currently 39 test files in src/game/ only. Zero UI tests. Use when writing new tests or improving coverage.
---

# Expand Test Coverage

## When to Use
- Writing tests for a new feature
- Improving coverage for an existing module
- Setting up test infrastructure for the engine or UI layers
- Understanding existing test conventions before writing new tests

## Prerequisites
- `npm run test` passes (don't add tests on a broken baseline)
- Understand Vitest configuration and conventions used in this project

## Current Coverage Map

| Layer | Directory | Test Files | Status |
|-------|-----------|------------|--------|
| Game logic | `src/game/__tests__/` | ~39 files | Good coverage |
| Engine | `src/engine/__tests__/` | ~2 files | Minimal |
| UI | `src/ui/__tests__/` | 0 files | None |

### Existing Test Conventions (from src/game/__tests__/)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SomeClass } from '../SomeClass';

describe('SomeClass', () => {
  let instance: SomeClass;

  beforeEach(() => {
    instance = new SomeClass(/* minimal deps */);
  });

  describe('methodName', () => {
    it('should do expected behavior', () => {
      // Arrange
      // Act
      const result = instance.methodName(args);
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

**Patterns observed:**
- `vi.fn()` for callback mocks
- `beforeEach` for fresh instance per test
- Descriptive `it('should ...')` names
- Minimal dependency setup (create only what's needed)
- No snapshot tests
- No integration tests (all unit)

## Priority Targets by Tier

### Tier 1: Pure Logic (easiest, highest value)

These functions have no Three.js or DOM dependencies:

| File | What to Test | Complexity |
|------|-------------|------------|
| `src/game/EconomyTracker.ts` | Rolling window, rates, bottlenecks | Low |
| `src/game/GoodsDistribution.ts` | Routing scores, priority math | Low |
| `src/game/CombatAnimationState.ts` | Phase transitions, timing | Low |
| `src/game/VictoryManager.ts` | Win conditions, elimination | Medium |
| `src/game/UpgradeManager.ts` | Upgrade costs, level effects | Medium |
| `src/game/HarborManager.ts` | Water route finding, transport | Medium |

### Tier 2: Controller Logic (needs mocks)

These depend on other managers but logic is testable with mocks:

| File | What to Test | Mock Needs |
|------|-------------|------------|
| `src/game/LogisticsManager.ts` | Goods routing decisions | GameState, RoadNetwork |
| `src/game/WoodcutterManager.ts` | State machine transitions | GameState, TreeManager |
| `src/game/ForesterManager.ts` | Planting logic | GameState, TreeManager |
| `src/game/KnightManager.ts` | Recruitment, rank-up | GameState |
| `src/game/AttackManager.ts` | Target selection, march | GameState, TerritoryManager |

### Tier 3: Engine Layer (needs Three.js mocks)

| File | What to Test | Setup Needed |
|------|-------------|-------------|
| `src/engine/BuildingAnimator.ts` | Animation triggers, timing | Mock THREE.Group |
| `src/engine/ParticleSystem.ts` | Emitter binding, particle lifecycle | Mock THREE.Scene |
| `src/engine/TooltipController.ts` | Hover detection, content generation | Mock DOM + camera |
| `src/engine/FlagLightSystem.ts` | Nightness response, instance count | Mock THREE.Scene |

### Tier 4: UI Layer (needs jsdom)

| File | What to Test | Setup Needed |
|------|-------------|-------------|
| `src/ui/PanelManager.ts` | Mutual exclusion (after decoupling) | None |
| `src/ui/buildPanel.ts` | Category filtering, item rendering | jsdom + mock game |
| `src/ui/infoPanel.ts` | Building data display, updates | jsdom + mock game |

## Three.js Mock Patterns

For engine tests that reference Three.js objects:

```typescript
// Minimal THREE.Group mock
function createMockGroup(): THREE.Group {
  const group = new THREE.Group();
  return group;
}

// Or for tests that don't need real Three.js:
vi.mock('three', () => ({
  Group: vi.fn().mockImplementation(() => ({
    position: { x: 0, y: 0, z: 0, set: vi.fn() },
    add: vi.fn(),
    remove: vi.fn(),
    traverse: vi.fn(),
    children: [],
  })),
  Scene: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    remove: vi.fn(),
  })),
  // ... add mocks as needed
}));
```

**Prefer real Three.js objects** when possible (they're lightweight in Node). Only mock when Three.js tries to access WebGL or canvas.

## jsdom Setup for UI Tests

```typescript
// At the top of UI test files:
// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';

describe('buildPanel', () => {
  beforeEach(() => {
    // Set up minimal DOM
    document.body.innerHTML = '<div id="build-panel"></div>';
  });

  it('should render building categories', () => {
    // Test DOM manipulation
  });
});
```

## Writing Effective Tests

### Do Test
- Business logic: production calculations, combat math, routing scores
- State transitions: building states, unit states, construction progress
- Edge cases: empty inputs, boundary values, error conditions
- Serialization round-trips: `_getState()` → `_loadState()` → verify

### Don't Test
- Three.js rendering output (use visual verification via Chrome DevTools MCP)
- Exact animation values (brittle, better verified visually)
- Private implementation details (test through public API)
- Framework behavior (Three.js, Vite)

### Test Naming
```typescript
it('should [expected behavior] when [condition]', () => { ... });
// Examples:
it('should produce planks when wood is available', () => { ... });
it('should reject placement outside territory', () => { ... });
it('should migrate v3 saves to current version', () => { ... });
```

## Key Files
- `src/game/__tests__/` — Existing test directory (39 files, reference for conventions)
- `vitest.config.ts` — Test configuration
- `package.json` — `npm run test` command

## Verification
1. `npm run test` — all tests pass (existing + new)
2. `npm run build` — compiles
3. New tests cover the identified priority targets
4. No flaky tests (tests should be deterministic)
