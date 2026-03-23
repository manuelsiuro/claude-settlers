# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Feudal Realm Manager** — a browser-based (including mobile) real-time strategy and city-building game inspired by The Settlers series. Built with **Three.js** for 3D rendering and **Tailwind CSS v4** for UI styling.

## Game Design Documents

All design specs live in `docs/`:

- `docs/game.md` — Master game design document: core gameplay loop, mechanics (resource management, building system, transportation/logistics, territory expansion, combat, economic management), progression tree, UI layout, win conditions
- `docs/buildings.md` — Visual designs for all 50 building types with specific colors and style references
- `docs/resources.md` — Visual designs for all 44 resource types (raw materials, processed goods, animals, tools)
- `docs/units.md` — Visual designs for all 39 unit types (civilian professions, military, transport)
- `docs/terrains.md` — Visual designs for 5 terrain types (grassland, forest, mountain, water, desert) with hex colors and decoration styles

**Always read the relevant design doc before implementing a feature.** The docs specify exact shapes, colors, and behaviors.

## Key Design Constraints

- **Browser + mobile**: must be playable on both desktop browsers and mobile phones
- **Blender 3D models**: all visual assets (buildings, units, resources, terrain decorations) are created in Blender via the Blender MCP, exported as GLTF/GLB, and loaded into Three.js. Use a stylized low-poly aesthetic with the colors and styles described in the design docs.
- **Asset pipeline**: Blender → export GLTF/GLB to `public/models/` → load in Three.js via GLTFLoader. Keep models lightweight for mobile performance.
- **Isometric perspective**: main game view is isometric, scrollable, and zoomable
- **Tailwind CSS v4**: utility-first CSS via `@tailwindcss/vite` plugin. UI uses plain HTML elements with custom component classes (`.icon-btn`, `.btn-filled`, `.btn-outlined`, `.btn-text`, `.nav-drawer`) defined in `src/ui/styles.css`. Icons are inline SVGs from `src/ui/icons.ts`.
- **Bounded map**: maps are finite with water borders at the edges. Camera is clamped to map bounds. No world wrapping.

## Architecture Notes

### Core Game Systems (from design doc)

- **Resource chain economy**: multi-step production chains (e.g., Grain → Flour → Bread; Iron Ore → Iron Bars → Tools/Weapons; Hay → Dairy Farm → Milk → Cheese). 50 building types with explicit inputs/outputs across 44 resource types.
- **Flag-and-road logistics**: players place Flags to define paths; Transporters carry goods between Flags. Road quality (Path/Dirt/Stone/Paved) determines transport type: foot (1 item), Donkey (3 items), HorseTransport (8 items). Road upgrades via building/flag InfoPanel.
- **Indirect unit control**: players don't command individual serfs — they create jobs via buildings. Serfs auto-assign. Military units (Knights, Archers, Cavalry, Siege Operators, Scouts) are the exception (directable for attacks).
- **Territory system**: military buildings (Guard Hut, Watchtower, Barracks, Fortress) project areas of influence that define borders. Fortress has 20 slots and radius 10.
- **Military recruitment**: type-aware recruitment at military buildings. Knights (Sword+Shield), Archers (Bow+Arrows at ArcheryRange), Cavalry (Horse+Sword+Shield at Barracks/Fortress), Siege Operators (SiegeRam), Scouts (serf promotion). Ranks 1-5 through combat; Gold Bars provide global combat bonus.
- **Combat system**: 1v1 probability-based duels for all military types. Cavalry charge bonus (1.3x first engagement). Siege Operators deal 3x building damage (building HP system). Archers have 3-hex range with 0.6x melee strength.
- **Hunger & feeding**: `FeedingManager` decays unit satiation over time (0.005/s base, 1.2x working, 0.5x garrisoned). Feeds from Castle/Warehouse every 5s. Hunger penalties: speed (-20%/-40%), production (-15%/-30%).
- **Morale system**: `MoraleManager` tracks drink service (Beer/Wine via Inn/Tavern). Morale = base(0.5) + variety + volume + gold bonuses. Affects production (+32% max) and combat multipliers.
- **Day/night effects**: night production slowdown (25%), civilian speed penalty (40%), torch tower mitigation (50% reduction in 5-hex radius).
- **Animal lifecycle**: `AnimalLifecycleManager` tracks Donkey/HorseTransport feeding, aging, starvation death. Cargo drops at nearest flag on death.
- **Goods distribution**: per-resource priority (1-5) and per-building importance (1-5) control routing scores. `LogisticsManager` uses composite `importance × priority / distance` when deciding where to send output goods.
- **Economy tracking**: `EconomyTracker` maintains a rolling 5-minute window of production/consumption events, providing per-resource rates, net balance, and bottleneck detection. Stores up to 120 history snapshots (60 minutes at 30s intervals) for dashboard charts.
- **Dashboard analytics**: `DashboardTracker` takes periodic aggregate snapshots every 30 game-seconds into `RingBuffer` (Float32Array-backed circular buffers, 120 points). Tracks: population & capacity, average satiation, morale, military count & rank, per-resource stock levels, and building efficiency (producing/waitingInput/waitingOutput/noWorker/paused). `DashboardPanel` renders a fullscreen 5-tab overlay (Overview, Economy, Resources, Population, Buildings) with Canvas-based charts (`ChartRenderer`: line charts, dual bar charts, donut charts). Updates every 2s when visible.

### Visual & Animation Systems

`src/engine/` contains 18+ renderers and visual systems (particles, building animations, tree sway shader, combat renderer, overlays, flag lights, atmosphere, post-processing, etc.). All follow the same integration pattern: instantiated in `Game` constructor, added to scene in `start()`, updated in the animate loop (after manager updates, before render), and disposed in `dispose()`. Read the source files for implementation details, or use the `feudal-new-renderer` skill when adding new ones.

### UI Panel Update Pattern

Live-updating panels (`InfoPanel`, `StatsPanel`, `BuildPanel`) use `PanelUpdater` (`src/ui/PanelUpdater.ts`) for flicker-free DOM updates. Instead of rebuilding `innerHTML` every tick, each panel computes a **structure key** (fingerprint of which sections/rows exist) and calls `updater.update(key, renderHTML, updateValues)`:
- **Structure key changed** → full `innerHTML` rebuild with scroll position preservation
- **Structure key same** → targeted patches via `data-field` attributes using `setText`/`setWidth`/`setClass`

New panels should follow this pattern: add `data-field="..."` to dynamic elements in the HTML template, create a structure key function, and create a value updater function.

### Mobile UI Architecture

The mobile UI (≤768px) uses a distinct interaction model from desktop, gated behind `@media (max-width: 768px)` CSS and `isDesktop` JS flags:

- **BottomSheetController** (`src/ui/BottomSheetController.ts`): Gesture-driven bottom sheet with configurable snap points (peek/expanded), velocity-based fling, and swipe-to-dismiss. Uses `transform: translateY()` for GPU-composited animations. Content scrolling only enabled at max snap to prevent scroll-vs-drag conflicts.
- **Mobile Bottom Toolbar** (`#mobile-toolbar` in `main.ts`): 5-button toolbar at bottom edge replacing FABs — Build, Stats, Recents (3 recent building thumbnails), Speed, Menu. 48px touch targets, translucent blur background.
- **Building Detail Sheet** (`#building-detail-sheet`): Slides up when tapping a building tile on mobile, showing cost/production/military info + Place button. Replaces the desktop inline-expand pattern.
- **Recent Buildings**: `BuildPanel.ts` tracks last 5 placed buildings in `localStorage('feudal-recent-buildings')`, renders thumbnails in the mobile toolbar for 2-tap repeat placement.
- **Quick Actions**: Mobile info panel shows a horizontal row of action buttons (Pause/Resume, Attack, Demolish) at the top for one-tap access.
- **Placement Touch**: `PlacementController` has a `touchmove` handler so the ghost preview follows the finger. `CameraController.placementActive` flag suppresses single-finger pan during placement while preserving pinch-to-zoom.
- **Panel Transitions**: Mobile panels use `transform: translateY()` instead of `display: none` for smooth CSS-animated slide-up/down. Each panel has a `.bottom-sheet-handle` div for drag interaction.

### MCP Integrations

- **Blender MCP** (`.mcp.json`): Primary 3D asset creation tool. See `feudal-3d-asset-pipeline` skill for the full workflow.
- **Chrome DevTools MCP** (`.mcp.json`): Browser testing and visual verification. See `feudal-game-debug` skill for debugging workflows.

## Skills Reference

30 specialized skills in `.claude/skills/` provide focused guidance for common tasks. Skills auto-load based on context or can be invoked manually with `/<skill-name>`.

### Three.js Reference Skills (10)

General Three.js knowledge — `threejs-fundamentals`, `threejs-animation`, `threejs-geometry`, `threejs-interaction`, `threejs-lighting`, `threejs-loaders`, `threejs-materials`, `threejs-postprocessing`, `threejs-shaders`, `threejs-textures`.

### Code Architecture & Refactoring Skills (10)

| Skill | Use When |
|-------|----------|
| `safe-refactoring` | Before any structural change (auto-loaded, not user-invocable) |
| `code-quality-audit` | Periodic code health review (`/code-quality-audit`, user-invocable only) |
| `introduce-event-bus` | Adding cross-cutting events or decoupling callback-wired managers |
| `refactor-god-class` | Decomposing Game.ts (750+ lines) or AIPlayer.ts (557 lines) |
| `dependency-injection` | Adding managers or improving testability with mock injection |
| `extract-data-files` | Moving data out of BuildingType.ts (770 lines) or AI build orders |
| `decouple-ui` | Adding UI features, testing UI, or reducing main.ts coupling |
| `saveload-migration` | Adding fields to SaveData or changing serialized state shape |
| `expand-test-coverage` | Writing tests for engine/ or ui/ layers (currently minimal/zero coverage) |
| `profile-performance` | FPS drops, memory growth, or mobile optimization |

### Game Domain Skills (10)

| Skill | Use When |
|-------|----------|
| `feudal-new-building` | Adding a building type (13-step checklist across 8+ files) |
| `feudal-new-unit` | Adding a serf profession or military unit (9-step checklist) |
| `feudal-production-chain` | Designing resource flows: source → processing → consumer |
| `feudal-game-balance` | Tuning constants (production times, costs, speeds, combat, AI) |
| `feudal-new-manager` | Creating a game manager with update loop, save/load, Game.ts integration |
| `feudal-new-renderer` | Creating a Three.js renderer with performance guidelines |
| `feudal-3d-asset-pipeline` | Blender MCP → GLTF export → AssetLoader → renderer (8-step workflow) |
| `feudal-game-debug` | Diagnosing production stops, stuck resources, missing workers via Chrome MCP |
| `feudal-map-generation` | Extending terrain types, scenarios, deposits, or generation balance |
| `feudal-expansion` | Orchestrating expansion features from `docs/expansion.md` (5 phases) |

### Skill Design Conventions

- Each skill is a self-contained `SKILL.md` under 500 lines in `.claude/skills/<name>/`
- Skills reference actual file paths, class names, and codebase patterns
- Game domain skills cross-reference each other (e.g., `feudal-expansion` delegates to `feudal-new-building`)
- Architecture skills follow the `safe-refactoring` protocol for incremental, verified changes

## Development Workflow

### Progress Tracking

This project uses `PROGRESS.md` at the repo root as the single source of truth for project status. It tracks:
- Current phase and active tasks
- Completed work (with dates)
- Blockers and decisions pending user input

**Session protocol:**
1. **Start of session**: Read `PROGRESS.md` to understand current state before doing anything
2. **Before starting a task**: Mark it as `[IN PROGRESS]` in `PROGRESS.md`
3. **After completing a task**: Mark it as `[DONE]` with the date, and add any notes about decisions made or issues found
4. **End of session**: Update `PROGRESS.md` with a summary of what was accomplished and what comes next

### Development Phases

Phases 1–9 and all expansion phases (A–J) are complete. The game now has 50 building types, 44 resource types, 39 unit types, hunger/morale systems, military expansion (5 unit types), advanced transport (multi-carry, road quality tiers), animal lifecycle, balance tuning, a full statistics dashboard with Canvas-based charts, standalone app packaging (Capacitor/Tauri/PWA), and a comprehensive mobile UI overhaul (bottom sheets, toolbar, streamlined build flow, touch-optimized placement). See `PROGRESS.md` for full history. 745 tests passing.

### Verification

**After every task:** `npm run build && npm run lint && npm run test`

**After rendering/UI changes:** Use Chrome DevTools MCP — `take_screenshot`, `list_console_messages`, `evaluate_script`. See `feudal-game-debug` skill for details.

**Rule: never skip `build` + `test` + `take_screenshot` before marking a visual task as done.**

### Git Workflow

After each phase is fully complete and verified (build + lint + test + visual), commit all changes and push to remote. Use a descriptive commit message summarizing the phase.

### Task Granularity Rules

- Each task in `PROGRESS.md` should be completable in a single session
- If a task feels too large, break it into subtasks before starting
- Each task must include: what to implement, which design doc to reference, and how to verify it works
- After each task, the game should still run without errors
