# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Feudal Realm Manager** — a browser-based (including mobile) real-time strategy and city-building game inspired by The Settlers series. Built with **Three.js** for 3D rendering and **Tailwind CSS v4** for UI styling.

## Game Design Documents

All design specs live in `docs/`:

- `docs/game.md` — Master game design document: core gameplay loop, mechanics (resource management, building system, transportation/logistics, territory expansion, combat, economic management), progression tree, UI layout, win conditions
- `docs/buildings.md` — Visual designs for all 55 building types with specific colors and style references
- `docs/resources.md` — Visual designs for all 49 resource types (raw materials, processed goods, animals, tools)
- `docs/units.md` — Visual designs for all 45 unit types (civilian professions, military, transport)
- `docs/terrains.md` — Visual designs for 5 terrain types (grassland, forest, mountain, water, desert) with hex colors and decoration styles
- `docs/living-world.md` — Living World feature: ambient visual systems (clouds, birds, wildlife, water effects, butterflies, bees) and new production chains (hunting, trapping, beekeeping)
- `docs/audio-generator.md` — Audio Generator tool: installation, usage, AI models (EzAudio/MusicGen), catalog management, export pipeline, in-game spatial audio system
- `docs/tools.md` — Developer tools reference (Balance Tool, Thumbnail Generator, Audio Generator)
- `docs/new-features.md` — Comprehensive guide to all 35 features added in the game review: loading screen, auto-save, event log, encyclopedia, achievements, campaign mode, diplomacy, sandbox, combat counters, AI personalities, keyboard shortcuts, visual polish, accessibility, and more

**Always read the relevant design doc before implementing a feature.** The docs specify exact shapes, colors, and behaviors.

## Key Design Constraints

- **Browser + mobile**: must be playable on both desktop browsers and mobile phones
- **Blender 3D models**: all visual assets (buildings, units, resources, terrain decorations) are created in Blender via the Blender MCP, exported as GLTF/GLB, and loaded into Three.js. Use a stylized low-poly aesthetic with the colors and styles described in the design docs.
- **Asset pipeline**: Blender → export GLTF/GLB to `public/models/` → load in Three.js via GLTFLoader. Keep models lightweight for mobile performance.
- **Isometric perspective**: main game view is isometric, scrollable, and zoomable
- **Tailwind CSS v4**: utility-first CSS via `@tailwindcss/vite` plugin. UI uses plain HTML elements with custom component classes (`.icon-btn`, `.btn-filled`, `.btn-outlined`, `.btn-text`, `.btn-danger`, `.nav-drawer`) defined in `src/ui/styles.css`. Icons are inline SVGs from `src/ui/icons.ts`. Semantic status colors via CSS variables (`--color-positive`, `--color-negative`, `--color-warning`, `--color-critical`) with utility classes (`.text-positive`, `.text-negative`, `.text-warning`, `.text-critical`). Day/night theme support via `html[data-theme="night"]`.
- **Bounded map**: maps are finite with water borders at the edges. Camera is clamped to map bounds. No world wrapping.

## Architecture Notes

### Core Game Systems (from design doc)

- **Resource chain economy**: multi-step production chains (e.g., Grain → Flour → Bread; Iron Ore → Iron Bars → Tools/Weapons; Hay → Dairy Farm → Milk → Cheese). 55 building types with explicit inputs/outputs across 49 resource types.
- **Flag-and-road logistics**: players place Flags to define paths; Transporters carry goods between Flags. Road quality (Path/Dirt/Stone/Paved) determines transport type: foot (1 item), Donkey (3 items), HorseTransport (8 items). Road upgrades via building/flag InfoPanel.
- **Indirect unit control**: players don't command individual serfs — they create jobs via buildings. Serfs auto-assign. Military units (Knights, Archers, Cavalry, Siege Operators, Scouts) are the exception (directable for attacks).
- **Territory system**: military buildings (Guard Hut, Watchtower, Barracks, Fortress) project areas of influence that define borders. Fortress has 20 slots and radius 10.
- **Military recruitment**: type-aware recruitment at military buildings. Knights (Sword+Shield), Archers (Bow+Arrows at ArcheryRange), Cavalry (Horse+Sword+Shield at Barracks/Fortress), Siege Operators (SiegeRam), Scouts (serf promotion). Ranks 1-5 through combat; Gold Bars provide global combat bonus.
- **Combat system**: 1v1 probability-based duels for all military types. Cavalry charge bonus (1.3x first engagement). Siege Operators deal 3x building damage (building HP system). Archers have 3-hex range with 0.6x melee strength.
- **Hunger & feeding**: `FeedingManager` decays unit satiation over time (0.001/s base, 1.0x working, 0.5x garrisoned, 0.5x food producers). Feeds from Castle/Warehouse every 5s when satiation < 0.80. Food producer workers (fishermen, farmers, bakers, etc.) get reduced decay and higher feed priority. Hunger thresholds: hungry at 0.35, starving at 0.15. Penalty functions exist but are not yet wired into gameplay. See `docs/food-system.md` for full details.
- **Morale system**: `MoraleManager` tracks drink service (Beer/Wine/Mead via Inn/Tavern) and luxury goods (Fur Coat). Inn/Tavern uses `inputCategories: [{ category: 'drink', required: true }, { category: 'luxury', required: false }]` to accept any `isDrink` resource (required) and `isLuxury` resource (optional bonus). Morale = base(0.5) + drink variety + drink volume + luxury variety + luxury volume + gold bonuses. Affects production (+32% max) and combat multipliers.
- **Day/night effects**: night production slowdown (25%), civilian speed penalty (40%), torch tower mitigation (50% reduction in 5-hex radius).
- **Animal lifecycle**: `AnimalLifecycleManager` tracks Donkey/HorseTransport feeding, aging, starvation death. Cargo drops at nearest flag on death.
- **Goods distribution**: per-resource priority (1-5) and per-building importance (1-5) control routing scores. `LogisticsManager` uses composite `importance × priority / distance` when deciding where to send output goods.
- **Economy tracking**: `EconomyTracker` maintains a rolling 5-minute window of production/consumption events, providing per-resource rates, net balance, and bottleneck detection. Stores up to 120 history snapshots (60 minutes at 30s intervals) for dashboard charts.
- **Dashboard analytics**: `DashboardTracker` takes periodic aggregate snapshots every 30 game-seconds into `RingBuffer` (Float32Array-backed circular buffers, 120 points). Tracks: population & capacity, average satiation, morale, military count & rank, per-resource stock levels, and building efficiency (producing/waitingInput/waitingOutput/noWorker/paused). `DashboardPanel` renders a fullscreen 5-tab overlay (Overview, Economy, Resources, Population, Buildings) with Canvas-based charts (`ChartRenderer`: line charts, dual bar charts, donut charts). Updates every 2s when visible.
- **Marketplace & barter trading**: `MarketplaceManager` provides resource-for-resource trading with dynamic supply/demand pricing. Two venues: Market building (10% fee, Merchant worker required) and Castle (25% fee, emergency fallback). NPC virtual stock restocks every 60s. Traveling merchants arrive every 5 min with 3 special deals. Auto-trade rules (max 8) automate routine trades. All 25+ constants in `balanceConstants.ts` are data-driven and overrideable. AI players trade via `AIPlayer.tryTrade()`. Trades record in `EconomyTracker` for Dashboard charts. UI: `TradePanel.ts` integrates into InfoPanel with resource selectors, amount controls, exchange preview, merchant deals, NPC stock, auto-trade editor, and price trends. See `docs/marketplace.md` for full design.
- **Random events**: `RandomEventManager` fires periodic events every 180-360s: positive (Bumper Harvest, Traveling Craftsman, Lucky Find), negative (Building Fire, Harsh Weather, Supply Shortage), neutral (Wandering Merchant). Each has a duration and applies production/speed multipliers. 50% positive, 35% negative, 15% neutral distribution.
- **Tutorial system**: `TutorialSystem.ts` provides 5-step onboarding for new players (Build Woodcutter → Connect Flag+Road → Build Sawmill → Wait for Production → Build Guard Hut). Polls game state every 1s. Persistent blue banner with Skip button. First-time detection via `localStorage('feudal-tutorial-completed')`.
- **Diplomacy system**: `DiplomacyManager.ts` tracks treaties between player pairs (none/non_aggression/trade_agreement/alliance). Non-aggression blocks attacks, trade agreement reduces marketplace fees, alliance shares fog of war. AI evaluates diplomacy every 30-60s based on personality. `DiplomacyPanel.ts` provides UI. Serialized in SaveData v14.
- **Campaign mode**: `CampaignData.ts` defines 12 hand-crafted scenarios with custom objectives (buildings, population, territory, gold, military, time_survive). Campaign tab in setup screen. VictoryManager checks objectives each tick. Completion persisted in localStorage.
- **Achievements**: `Achievements.ts` tracks 24 cross-game achievements across 5 categories (Victory, Economy, Military, Exploration, Misc). Persisted in localStorage. Unlocked via game events. Gallery in nav drawer.
- **AI personalities**: 4 types (Balanced, Economist, Militarist, Turtle) defined in `aiBuildOrders.ts`. Each has distinct build order, attack threshold, and decision timing. `applyPersonality()` overlays on difficulty config. AI diplomacy behavior varies by personality.
- **Combat unit counters**: Rock-paper-scissors in `CombatManager.preComputeDuel`: Knight beats Archer (1.4x), Archer beats Cavalry (1.5x), Cavalry beats Knight (1.3x).
- **Sandbox mode**: `GameConfig.sandbox` disables AI attacks, defeat conditions, and construction resource costs. Toggle in setup screen.
- **Auto-save**: Rotating 3-slot auto-save every 2 minutes via `autoSaveToSlot()`. `beforeunload` warning. `listSaveSlots()` and `loadFromKey()` for slot management.
- **Event log**: `EventLog.ts` stores last 100 notifications with timestamps. Bell icon with unread badge. Click to navigate camera. Wired into `NotificationWiring.ts`.
- **Encyclopedia**: `EncyclopediaPanel.ts` with 3 searchable tabs (Buildings, Resources, Units). Full detail views with cross-references. Press E or use nav drawer.
- **Save migration chain**: `SaveLoad.ts` has `MIGRATIONS` record mapping version→migration function. `migrateSaveData()` runs all needed migrations sequentially. SAVE_VERSION=14.
- **Error boundaries**: `Game.ts` `safeRender()` wraps 14 visual system updates in try/catch. Crashed renderers are disabled, game continues.

### Module Organization

Large files have been split into focused sub-modules with thin re-export facades for backward compatibility:

- **`src/engine/Game.ts`** (~1,365 lines) — Core orchestrator. Factory functions in `GameSystems.ts`, callback wiring in `GameNotifications.ts`.
- **`src/game/data/buildings/`** — Building definitions split by category: `core.ts`, `gathering.ts`, `processing.ts`, `food.ts`, `military.ts`, `housing.ts`, `logistics.ts`, `livingWorld.ts`. Composed via `index.ts`, re-exported from `buildingDefinitions.ts`.
- **`src/game/marketplace/`** — `MarketplaceManager.ts` (core), `PriceEngine.ts` (stateless pricing), `TravelingMerchantEngine.ts` (merchant spawning/deals), `AutoTradeEvaluator.ts` (rule evaluation), `types.ts` (shared interfaces).
- **`src/ui/infopanel/`** — `InfoPanelController.ts` (orchestrator), `BuildingInfoRenderer.ts` (HTML generation), `RoadInfoRenderer.ts` (road/flag display), `InfoPanelValues.ts` (DOM patching).
- **`src/ui/buildpanel/`** — `BuildPanelController.ts` (orchestrator), `BuildingCatalog.ts` (list/filter/HTML), `AttackMode.ts` (attack targeting).
- **`src/ui/dashboard/`** — `DashboardController.ts` + 5 tab modules (`OverviewTab`, `EconomyTab`, `ResourcesTab`, `PopulationTab`, `BuildingsTab`) + `dashboardHelpers.ts`.
- **`src/ui/statspanel/`** — `StatsPanelController.ts` + 4 stat modules (`BuildingStats`, `ResourceStats`, `PopulationStats`, `MilitaryStats`).
- **`src/ui/GameHTML.ts`** — HTML template extracted from `main.ts`. `GameWiring.ts` — mobile toolbar + game controller wiring.
- **`src/editor/`** — Map editor: `MapEditor.ts` (Three.js scene, grid/building/road management), `MapEditorUI.ts` (full UI with toolbar, building catalog with thumbnails, dev tools dropdown, properties panel), `MapEditorTools.ts` (9 tool implementations), `MapEditorState.ts` (state interface + enums), `MapStorage.ts` (localStorage/file I/O), `ThumbnailGenerator.ts` (2D canvas map thumbnails), `UndoManager.ts` (command-pattern undo/redo), `editorUtils.ts` (shared utilities like `generateId()`).

All original import paths continue to work via re-export facades. When adding new code, import from the sub-module directly for clarity.

### Visual & Animation Systems

`src/engine/` contains 23+ renderers and visual systems (particles, building animations, tree sway shader, combat renderer, overlays, flag lights, atmosphere, post-processing, ambient life, etc.). All follow the same integration pattern: instantiated via `GameSystems.createRenderers()`, added to scene in `start()`, updated in the animate loop (after manager updates, before render), and disposed in `dispose()`. Read the source files for implementation details, or use the `feudal-new-renderer` skill when adding new ones.
- **Ambient life systems** (Living World): `CloudRenderer` (billboard clouds + ground shadows), `BirdFlockRenderer` (GPU-driven shader birds), `WaterEffectRenderer` (sparkle points on water), `WildAnimalRenderer` (deer/rabbits/goats/fish via InstancedMesh), `FlowerButterflyRenderer` (GPU-driven butterflies). Controlled via `ambientLife` graphics setting (`off`/`minimal`/`full`). Use `rawDelta` (animate even when paused). See `docs/living-world.md` for specs.
- **Spatial audio system**: `SpatialAudioEngine` reads `public/audio/manifest.json` at startup, auto-indexes sounds by `gameType`, plays proximity-based building/unit sounds via Web Audio API `PannerNode` (HRTF desktop, equalpower mobile). `AudioAssetLoader` lazy-loads OGG files with 50MB LRU cache. `AudioSourcePool` limits concurrent sources (48 desktop, 24 mobile) with priority-based eviction. `AmbientSoundscape` cross-fades environmental sounds by time of day/weather. Audio files generated by the Python tool at `tools/audio-generator/`. Adding new sounds is data-driven: add to `audio_catalog.json` → generate → export → game auto-discovers from manifest. See `docs/audio-generator.md`.
- **TerrainGatheringManager**: Data-driven manager for buildings with `gatheringStyle: 'walk'` (Hunting Lodge, Trapper's Hut). Worker walks to `harvestTerrain` tiles within `workRadius`, gathers for `productionTime × TERRAIN_GATHERING_WORK_FRACTION`, returns with output. Adding future terrain-walkers requires only setting `gatheringStyle: 'walk'` on the definition — zero code changes.

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

31 specialized skills in `.claude/skills/` provide focused guidance for common tasks. Skills auto-load based on context or can be invoked manually with `/<skill-name>`.

### Three.js Reference Skills (10)

General Three.js knowledge — `threejs-fundamentals`, `threejs-animation`, `threejs-geometry`, `threejs-interaction`, `threejs-lighting`, `threejs-loaders`, `threejs-materials`, `threejs-postprocessing`, `threejs-shaders`, `threejs-textures`.

### Code Architecture & Refactoring Skills (11)

| Skill | Use When |
|-------|----------|
| `safe-refactoring` | Before any structural change (auto-loaded, not user-invocable) |
| `code-quality-audit` | Periodic code health review (`/code-quality-audit`, user-invocable only) |
| `introduce-event-bus` | Adding cross-cutting events or decoupling callback-wired managers |
| `refactor-god-class` | Decomposing large classes (Game.ts, AIPlayer.ts) |
| `dependency-injection` | Adding managers or improving testability with mock injection |
| `extract-data-files` | Moving data out of code files or AI build orders |
| `decouple-ui` | Adding UI features, testing UI, or reducing coupling |
| `mobile-ui` | Adding or modifying mobile-facing UI (bottom sheets, toolbar, touch targets, panel transitions) |
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

Phases 1–9 and all expansion phases (A–J) are complete, plus a comprehensive game review that added 35 features. The game now has 55 building types, 49 resource types, 45 unit types, hunger/morale systems (wired to production and combat), military expansion (5 unit types with rock-paper-scissors counters), advanced transport (multi-carry, road quality tiers), animal lifecycle, balance tuning, a full statistics dashboard with Canvas-based charts, standalone app packaging (Capacitor/Tauri/PWA), a comprehensive mobile UI overhaul, a barter marketplace with dynamic pricing and AI trading, a Living World feature with 6 ambient visual systems, spatial audio system, a polished map editor with map sharing (clipboard export/import), a 5-step interactive tutorial, building status diagnostics, 8 map scenarios, camera bookmarks, 13 random event types, adaptive AI with 4 personalities (Balanced/Economist/Militarist/Turtle), a diplomacy system (treaties: non-aggression/trade/alliance), 12 campaign scenarios with custom objectives, 24 cross-game achievements, sandbox mode, in-game encyclopedia, event log with camera navigation, loading screen with progress bar, auto-save (3 rotating slots), keyboard shortcuts (B/S/D/E/P/F1-F4/?), graphics presets (Low/Medium/High/Ultra), accessibility (3 colorblind modes + text scaling), animated water shader, night glow on buildings, smooth camera pan, fog of war edge softening, production chain status visualizer, production chain panel with swim-lane layout (14 chain groups), error boundaries for renderers, formal save migration chain (v3→v14), enhanced FPS counter with draw call stats, group attack commands, rally point support, and a comprehensive UI polish pass (softened close buttons, encyclopedia card layout, semantic status color system with theme-aware CSS variables, ~30 inline hardcoded colors replaced, focus-visible outlines). See `docs/new-features.md` for the full guide and `PROGRESS.md` for history. 843 tests passing.

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
