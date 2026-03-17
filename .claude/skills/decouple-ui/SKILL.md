---
name: decouple-ui
description: Decouple UI layer from game engine. main.ts (503 lines) has inline HTML, UI modules use singleton closures, panels cross-reference each other. Use when adding UI features or testing UI.
---

# Decouple UI Layer

## When to Use
- Adding a new UI panel and struggling with the initialization order in main.ts
- Writing tests for UI behavior but can't because of global dependencies
- UI modules need to react to game events but are tightly coupled to specific managers
- main.ts is growing and hard to navigate

## Prerequisites
- Read `safe-refactoring` skill
- Build/test/lint clean
- Understand the current UI initialization flow in `src/main.ts`

## Current Architecture Problems

### 1. Inline HTML Template in main.ts
`main.ts` contains the full HTML template as a string literal (~100 lines of HTML). This mixes concerns and makes the template hard to edit.

### 2. Singleton Closures in UI Modules
Each UI module (`src/ui/buildPanel.ts`, `src/ui/infoPanel.ts`, etc.) exports an `init*()` function that captures `getGame` and other closures. This makes testing impossible without a running game.

### 3. Panel Cross-References
Panels reference each other for mutual exclusion (opening build panel closes info panel and vice versa). This creates a web of dependencies passed through init functions:

```typescript
initInfoPanel(getGame, closeBuildPanel, closeStatsPanel, closePriorityPanel)
initBuildPanel(getGame, closeInfoPanel, closeStatsPanel, closePriorityPanel)
```

### 4. Direct Game Access
UI modules call `getGame()` to access the game instance directly, then reach into managers. No abstraction layer.

## 4-Phase Decoupling Plan

### Phase 1: Extract HTML Template

Create `src/ui/template.ts`:

```typescript
export function createGameTemplate(): string {
  return `
    <nav class="nav-drawer" id="navDrawer">...</nav>
    <header class="app-bar" id="appBar">...</header>
    <div id="game-container">...</div>
    <!-- ... rest of UI structure -->
  `;
}
```

Update `main.ts` to call `createGameTemplate()` instead of inline HTML.

**Verification:** Build + visual screenshot — identical rendering.

### Phase 2: Create UIContext Interface

Replace scattered `getGame` closures with a typed context:

```typescript
// src/ui/UIContext.ts
import type { Game } from '../engine/Game';

export interface UIContext {
  getGame(): Game;
  showNotification(message: string, type?: string): void;
  playSound(sound: string): void;
}
```

Update each UI module's init function to accept `UIContext` instead of individual closures:

```typescript
// Before:
export function initBuildPanel(getGame, closeInfoPanel, closeStatsPanel, closePriorityPanel)

// After:
export function initBuildPanel(ctx: UIContext, panelManager: PanelManager)
```

**Migrate one module at a time.** Build + test after each.

### Phase 3: Create PanelManager

Replace mutual-exclusion closures with a central panel manager:

```typescript
// src/ui/PanelManager.ts
export type PanelId = 'build' | 'info' | 'stats' | 'priority';

export class PanelManager {
  private panels = new Map<PanelId, { open: () => void; close: () => void }>();
  private activePanel: PanelId | null = null;

  register(id: PanelId, handlers: { open: () => void; close: () => void }): void {
    this.panels.set(id, handlers);
  }

  open(id: PanelId): void {
    // Close current panel if different
    if (this.activePanel && this.activePanel !== id) {
      this.panels.get(this.activePanel)?.close();
    }
    this.panels.get(id)?.open();
    this.activePanel = id;
  }

  close(id: PanelId): void {
    this.panels.get(id)?.close();
    if (this.activePanel === id) {
      this.activePanel = null;
    }
  }

  closeAll(): void {
    for (const [id, panel] of this.panels) {
      panel.close();
    }
    this.activePanel = null;
  }

  getActive(): PanelId | null {
    return this.activePanel;
  }
}
```

This eliminates the cross-reference web between panels.

### Phase 4: Event-Driven UI Updates

Once `introduce-event-bus` skill is applied, UI can subscribe to game events:

```typescript
// In UI initialization:
eventBus.on('building:completed', ({ building }) => {
  showNotification(`${building.label} completed!`);
  if (activePanel === 'info' && selectedBuilding?.id === building.id) {
    refreshInfoPanel();
  }
});

eventBus.on('notification', ({ message, type }) => {
  showSnackbar(message, type);
});
```

This decouples UI from polling game state — it reacts to events instead.

## Testing Setup for UI

### jsdom Environment for Vitest

```typescript
// vitest.config.ts — add a separate test environment for UI:
// Create src/ui/__tests__/ with:
// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { PanelManager } from '../PanelManager';

describe('PanelManager', () => {
  let pm: PanelManager;

  beforeEach(() => {
    pm = new PanelManager();
    pm.register('build', { open: vi.fn(), close: vi.fn() });
    pm.register('info', { open: vi.fn(), close: vi.fn() });
  });

  it('should close active panel when opening a different one', () => {
    pm.open('build');
    pm.open('info');
    expect(pm.getActive()).toBe('info');
    // Verify build panel's close was called
  });
});
```

## Migration Order

1. **Phase 1** (template extraction) — standalone, no dependencies
2. **Phase 2** (UIContext) — one module at a time, backward compatible
3. **Phase 3** (PanelManager) — after all modules use UIContext
4. **Phase 4** (event-driven) — after EventBus is in place (see `introduce-event-bus`)

## Key Files
- `src/main.ts` — UI initialization hub (503 lines)
- `src/ui/buildPanel.ts` — Build menu panel
- `src/ui/infoPanel.ts` — Building info panel
- `src/ui/statsPanel.ts` — Global statistics panel
- `src/ui/priorityPanel.ts` — Goods distribution panel
- `src/ui/appBar.ts` — Top navigation bar
- `src/ui/styles.css` — Tailwind CSS v4 component classes

## Verification
1. `npm run build` — compiles
2. `npm run test` — all tests pass, new UI tests pass
3. `npm run lint` — clean
4. Visual screenshot — UI looks identical
5. Test panel interactions — mutual exclusion works
6. Check main.ts line count — should decrease significantly
