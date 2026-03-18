# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Feudal Realm Manager** — a browser-based (including mobile) real-time strategy and city-building game inspired by The Settlers series. Built with **Three.js** for 3D rendering and **Tailwind CSS v4** for UI styling.

## Game Design Documents

All design specs live in `docs/`:

- `docs/game.md` — Master game design document: core gameplay loop, mechanics (resource management, building system, transportation/logistics, territory expansion, combat, economic management), progression tree, UI layout, win conditions
- `docs/buildings.md` — Visual designs for all 23 building types with specific colors and style references
- `docs/resources.md` — Visual designs for all 17 resource types (raw materials, processed goods, animals)
- `docs/units.md` — Visual designs for all serf professions (18 types) and knights, built on a shared base model with profession-specific additions
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

- **Resource chain economy**: multi-step production chains (e.g., Grain → Flour → Bread; Iron Ore → Iron Bars → Tools/Weapons). Buildings have explicit inputs/outputs.
- **Flag-and-road logistics**: players place Flags to define paths; Transporters carry goods between Flags. Only one Transporter per road segment between two Flags.
- **Indirect unit control**: players don't command individual serfs — they create jobs via buildings. Serfs auto-assign. Knights are the exception (directable for attacks).
- **Territory system**: military buildings (Guard Hut, Watchtower, Barracks) project areas of influence that define borders.
- **Knight recruitment**: a serf delivering a Sword+Shield set to a military building with an empty slot becomes a Knight. Knights gain ranks (1-5) through combat; Gold Bars provide a global combat bonus.
- **Goods distribution**: per-resource priority (1-5) and per-building importance (1-5) control routing scores. `LogisticsManager` uses composite `importance × priority / distance` when deciding where to send output goods.
- **Economy tracking**: `EconomyTracker` maintains a rolling 5-minute window of production/consumption events, providing per-resource rates, net balance, and bottleneck detection.

### Visual & Animation Systems

`src/engine/` contains 18+ renderers and visual systems (particles, building animations, tree sway shader, combat renderer, overlays, flag lights, atmosphere, post-processing, etc.). All follow the same integration pattern: instantiated in `Game` constructor, added to scene in `start()`, updated in the animate loop (after manager updates, before render), and disposed in `dispose()`. Read the source files for implementation details, or use the `feudal-new-renderer` skill when adding new ones.

### UI Panel Update Pattern

Live-updating panels (`InfoPanel`, `StatsPanel`, `BuildPanel`) use `PanelUpdater` (`src/ui/PanelUpdater.ts`) for flicker-free DOM updates. Instead of rebuilding `innerHTML` every tick, each panel computes a **structure key** (fingerprint of which sections/rows exist) and calls `updater.update(key, renderHTML, updateValues)`:
- **Structure key changed** → full `innerHTML` rebuild with scroll position preservation
- **Structure key same** → targeted patches via `data-field` attributes using `setText`/`setWidth`/`setClass`

New panels should follow this pattern: add `data-field="..."` to dynamic elements in the HTML template, create a structure key function, and create a value updater function.

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

Phases 1–9 are all complete. See `PROGRESS.md` for current status and `git log` for history. Next work is expansion features from `docs/expansion.md` — use the `feudal-expansion` skill.

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
