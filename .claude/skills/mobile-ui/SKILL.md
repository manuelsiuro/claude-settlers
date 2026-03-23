---
name: mobile-ui
description: Mobile UI patterns — bottom sheets, toolbar, touch targets, panel transitions, placement touch handling. Use when adding or modifying mobile-facing UI features.
---

# Mobile UI Patterns

## When to Use
- Adding a new panel that needs to work on mobile
- Adding interactive elements to the mobile toolbar
- Modifying touch interaction behavior
- Creating mobile-specific UI (quick actions, detail sheets)
- Debugging mobile layout or touch issues

## Architecture Overview

Mobile UI is gated behind two mechanisms:
- **CSS**: `@media (max-width: 768px)` for styling, `@media (min-width: 769px)` for desktop-only
- **JS**: `isDesktop` flag from `window.matchMedia('(min-width: 769px)')` — see `BuildPanel.ts:67` and `InfoPanel.ts:92` for the pattern

Desktop UI is never affected by mobile changes. All mobile additions must be invisible at `≥769px`.

### Z-Index Stack (mobile)
```
minimap: 10 < placement-bar: 15 < panels: 20 < building-detail-sheet: 21 < fab: 25 < toolbar: 26 < tooltip: 30
```

### Key Files
| File | Mobile Role |
|------|------------|
| `src/ui/BottomSheetController.ts` | Gesture-driven bottom sheet engine |
| `src/ui/styles.css` | All responsive breakpoints, `.mobile-toolbar`, `.bottom-sheet-handle` |
| `src/main.ts` | Mobile toolbar HTML, wiring, Capacitor back button |
| `src/ui/BuildPanel.ts` | Detail sheet, recents system, mobile tile click |
| `src/ui/InfoPanel.ts` | Bottom sheet integration, quick actions |
| `src/engine/PlacementController.ts` | `touchmove` handler for ghost preview |
| `src/engine/CameraController.ts` | `placementActive` flag for pan suppression |

## Making a Panel Mobile-Compatible

### Step 1: Add drag handle to HTML (`main.ts`)
```html
<div id="my-panel" class="my-panel hidden">
  <div class="bottom-sheet-handle"></div>  <!-- Add this -->
  <div class="my-panel-header">...</div>
  <div id="my-panel-content" class="my-panel-content">...</div>
</div>
```

### Step 2: Add mobile CSS override (`styles.css`)
```css
/* Mobile hidden state — use transform, not display:none */
@media (max-width: 768px) {
  .my-panel.hidden {
    display: flex;
    transform: translateY(100%);
    visibility: hidden;
    pointer-events: none;
  }
}
```
The base mobile panel styles (position, max-height, border-radius) are shared via the existing rule at `styles.css:2294` — add `.my-panel` to that selector list.

### Step 3: Integrate BottomSheetController
```typescript
import { BottomSheetController } from './BottomSheetController';

let bottomSheet: BottomSheetController | null = null;
let isDesktop = false;

// In init function:
const mq = window.matchMedia('(min-width: 769px)');
isDesktop = mq.matches;
mq.addEventListener('change', (e) => {
  isDesktop = e.matches;
  if (isDesktop) {
    bottomSheet?.destroy();
    bottomSheet = null;
    // Clear inline styles left by controller
    panel.style.transform = '';
    panel.style.visibility = '';
    panel.style.pointerEvents = '';
    panel.style.transition = '';
    panel.style.maxHeight = '';
  } else if (!bottomSheet) {
    bottomSheet = new BottomSheetController(panel, {
      snapPoints: [30, 75],  // vh values: peek at 30vh, expanded at 75vh
      onDismiss: () => { /* cleanup: stop updates, deselect, etc. */ },
    });
  }
  closePanel();
});
if (!isDesktop) { /* create bottomSheet */ }
```

### Step 4: Update show/close functions
```typescript
function showPanel(): void {
  if (!isDesktop && bottomSheet) {
    bottomSheet.open(0);  // 0 = peek snap
  } else {
    panel.classList.remove('hidden');
  }
}

function closePanel(): void {
  if (!isDesktop && bottomSheet?.isOpen) {
    bottomSheet.dismiss();  // Animated; onDismiss handles cleanup
  } else {
    panel.classList.add('hidden');
    // ... cleanup
  }
}
```

### Step 5: Update Capacitor back button (`main.ts:22-50`)
Add the panel ID to the priority close list in the back button handler.

## BottomSheetController API

```typescript
const sheet = new BottomSheetController(element, {
  snapPoints: [30, 75],           // Visible heights in vh
  onStateChange: (snapIndex) => {},  // -1 = hidden, 0 = first snap, etc.
  onDismiss: () => {},               // Called after dismiss transition
});

sheet.open(0);          // Open at snap index (0 = peek)
sheet.snapTo(1);        // Snap to expanded
sheet.dismiss();        // Animated close
sheet.getCurrentSnap(); // -1, 0, 1, ...
sheet.isOpen;           // boolean
sheet.destroy();        // Remove event listeners
```

**Internals:**
- Drag only from top 56px (handle + header region)
- Velocity threshold: 0.4 px/ms for fling detection
- Content scrolling enabled only at max snap point
- Uses `transform: translateY()` exclusively (GPU-composited)
- Transition: `0.3s cubic-bezier(0.2, 0, 0, 1)`
- Fallback `setTimeout(400ms)` if `transitionend` doesn't fire

## Adding Mobile Toolbar Buttons

The toolbar is in `main.ts` HTML (`#mobile-toolbar`). To add a button:

```html
<button class="mobile-toolbar-btn" id="mt-mybutton" title="My Action">
  ${icon('icon_name')}
  <span class="mobile-toolbar-label">Label</span>
</button>
```

Wire in the mobile toolbar section of `main.ts` (~line 595):
```typescript
document.getElementById('mt-mybutton')!.addEventListener('click', () => {
  audioManager.play('ui_click');
  // action
});
```

## Recent Buildings System

`BuildPanel.ts` exports:
- `getRecentBuildings(): BuildingType[]` — last 5 placed types
- `addToRecents(type)` — called automatically by `startPlacement()`
- Persisted to `localStorage('feudal-recent-buildings')`
- Toolbar thumbnails updated via `updateMobileToolbarRecents()`

To add recents for a new entity type, follow the same pattern: module-level array, localStorage key, export getter, update toolbar on change.

## Adding Quick Actions to a Panel

Quick actions are horizontal pill buttons shown only on mobile. Pattern from `InfoPanel.ts`:

```typescript
function generateQuickActionsHTML(entity: Entity): string {
  if (isDesktop) return '';
  const actions: string[] = [];
  actions.push(`<button class="info-quick-action" data-action="my-action" data-id="${entity.id}">
    ${icon('icon_name')} <span>Label</span>
  </button>`);
  return `<div class="info-quick-actions">${actions.join('')}</div>`;
}
```

Handle via event delegation:
```typescript
panelContent.addEventListener('click', (e) => {
  const qa = (e.target as HTMLElement).closest('.info-quick-action') as HTMLElement | null;
  if (qa?.dataset.action === 'my-action') { /* handle */ return; }
});
```

CSS classes: `.info-quick-actions` (flex container), `.info-quick-action` (pill button), `.info-quick-action-danger` (red variant for destructive actions).

## Touch Target Rules

| Standard | Minimum | Source |
|----------|---------|--------|
| Apple HIG | 44x44 pt | Required |
| Material Design 3 | 48x48 dp | Recommended |
| WCAG 2.5.8 | 44x44 CSS px | AAA |

- `.icon-btn` is 44px on mobile (40px desktop) — `styles.css:194`
- `.mobile-toolbar-btn` is 48x48px
- Minimum 8px gap between adjacent touch targets
- All build grid tiles are ~65px wide (adequate)

## Touch Event Coordination

### PlacementController + CameraController
When placement mode is active:
1. `PlacementController.onTouchMove` calls `updatePreview()` and `preventDefault()`
2. `CameraController.onTouchMove` checks `this.placementActive` — skips single-finger pan if true
3. Two-finger pinch zoom still works during placement

The flag is set via `main.ts`:
```typescript
placement.onModeChanged = (active) => {
  const cam = game?.getCameraController();
  if (cam) cam.placementActive = active;
};
```

### Bottom Sheet Drag vs Content Scroll
`BottomSheetController` only handles drag from the top 56px (handle + header). Touches on panel content pass through normally. Content `overflow-y: auto` is only enabled at the max snap point.

## Building Detail Sheet Pattern

For showing entity details before an action (like placing a building):

1. Add HTML element in `main.ts` with `.bottom-sheet-handle` + content div
2. CSS: `position: fixed; bottom: 0; z-index: calc(var(--z-panels) + 1)` — sits above the grid panel
3. Show: populate innerHTML + `classList.remove('hidden')`
4. Hide: `classList.add('hidden')`
5. Action button in content triggers the action + closes both detail sheet and parent panel

See `BuildPanel.ts:showBuildingDetail()` and `#building-detail-sheet` for the reference implementation.

## Common Mistakes

1. **Using `display: none` on mobile panels** — Use `transform: translateY(100%)` + `visibility: hidden` instead. `display: none` skips CSS transitions.
2. **Forgetting `--safe-bottom` padding** — All bottom-positioned elements need `padding-bottom: var(--safe-bottom)` for iOS home indicator.
3. **Touch targets under 44px** — Check with DevTools; increase via mobile media query.
4. **Not gating mobile code with `isDesktop`** — Always check before using `bottomSheet` or generating mobile-only HTML.
5. **Overwriting `onModeChanged` callbacks** — These are set by `main.ts` after Game creates controllers. Chain behavior, don't replace.
6. **Animating `height` or `top`** — Only animate `transform` and `opacity` on mobile. Layout properties cause jank.
