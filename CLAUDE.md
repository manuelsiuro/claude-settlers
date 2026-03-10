# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Feudal Realm Manager** — a browser-based (including mobile) real-time strategy and city-building game inspired by The Settlers series. Built with **Three.js** for 3D rendering and **Material 3** for UI components and icons.

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
- **Material 3**: all UI components and icons must use the Material 3 design library
- **World wrapping**: maps wrap around — units/expansion going off one edge appear on the opposite side

## Architecture Notes

### Core Game Systems (from design doc)

- **Resource chain economy**: multi-step production chains (e.g., Grain → Flour → Bread; Iron Ore → Iron Bars → Tools/Weapons). Buildings have explicit inputs/outputs.
- **Flag-and-road logistics**: players place Flags to define paths; Transporters carry goods between Flags. Only one Transporter per road segment between two Flags.
- **Indirect unit control**: players don't command individual serfs — they create jobs via buildings. Serfs auto-assign. Knights are the exception (directable for attacks).
- **Territory system**: military buildings (Guard Hut, Watchtower, Barracks) project areas of influence that define borders.
- **Knight recruitment**: a serf delivering a Sword+Shield set to a military building with an empty slot becomes a Knight. Knights gain ranks (1-5) through combat; Gold Bars provide a global combat bonus.

### Blender MCP Integration — Primary 3D Asset Pipeline

A Blender MCP server is configured (`.mcp.json`) providing direct access to Blender for creating **all** 3D models used in the game. This is the primary asset creation tool.

**Workflow for every 3D asset:**
1. Read the relevant design doc (`docs/buildings.md`, `docs/units.md`, `docs/resources.md`, `docs/terrains.md`) for colors, style, and proportions
2. Use `mcp__blender__execute_blender_code` to create the model in Blender via Python scripts
3. Use `mcp__blender__get_viewport_screenshot` to visually verify the model
4. Export as GLTF/GLB to `public/models/<category>/<name>.glb` (e.g., `public/models/terrain/tree_deciduous.glb`)
5. Load in Three.js using GLTFLoader

**Available capabilities:**
- **Execute Blender code** (`mcp__blender__execute_blender_code`): run Python scripts to create/modify 3D models programmatically
- **Scene inspection**: get scene info, object info, and viewport screenshots
- **Asset sourcing**: search/download assets from Polyhaven and Sketchfab
- **AI model generation**: generate 3D models via Hyper3D (text or image input) and Hunyuan3D

**Model guidelines:**
- Use a stylized low-poly aesthetic — keep vertex counts low for mobile performance
- Bake colors into vertex colors or use simple solid-color materials (no heavy textures)
- Organize models: `public/models/terrain/`, `public/models/buildings/`, `public/models/units/`, `public/models/resources/`
- Each model should be self-contained with materials embedded in the GLB file

### Chrome DevTools MCP Integration

A Chrome DevTools MCP server is configured (`.mcp.json`) providing direct browser access for testing and visual verification. Key capabilities:

- **`take_screenshot`**: capture the rendered game — verify 3D scene, UI, and layout visually after every change
- **`take_snapshot`**: accessibility tree snapshot — verify UI structure and element presence
- **`navigate_page` / `new_page`**: open the dev server URL to test the running app
- **`evaluate_script`**: execute JS in the page — assert game state (scene objects, renderer, FPS)
- **`list_console_messages`**: catch runtime errors, Three.js warnings, failed resource loads
- **`emulate`**: test mobile viewports, dark mode, CPU throttling, network conditions
- **`performance_start_trace` / `lighthouse_audit`**: measure Core Web Vitals and run accessibility/SEO audits
- **`take_memory_snapshot`**: detect memory leaks in the render loop

This replaces manual browser checking — Claude can now fully self-verify both logic and visuals.

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

Each phase must be fully working and tested before moving to the next. Within each phase, work task-by-task — complete one before starting another.

#### Phase 1: Project Scaffolding
- Initialize project (Vite + TypeScript + Three.js + Material 3)
- Basic renderer setup (isometric camera, resize handling, render loop)
- Mobile-responsive canvas and UI shell
- Dev server, build, and lint configuration

#### Phase 2: Terrain & Map System
- Hex/tile grid system with world wrapping
- Terrain type rendering (grassland, forest, mountain, water, desert) per `docs/terrains.md`
- Map generation from seed
- Camera controls (pan, zoom) for desktop and touch

#### Phase 3: Buildings & Placement
- Building data model (costs, inputs, outputs, worker types) from `docs/game.md`
- Building 3D models per `docs/buildings.md`
- Placement system with terrain validation

#### Phase 4: Units & AI
- Base serf model + profession variants per `docs/units.md`
- Serf spawning from Castle, auto-assignment to jobs
- Pathfinding on the road/flag network
- Unit animation (walk cycles, work cycles)

#### Phase 5: Resource & Logistics System
- Resource data model (all 17 types) per `docs/resources.md`
- Resource 3D models
- Flag placement and road network
- Transporter logic (pick up → carry → deliver between flags)
- Construction process (builder + resources → building over time)
- Production chains: building inputs/outputs, processing timers
- Storage system (building inventory, warehouses)

#### Phase 6: Territory & Military
- Territory influence system (military buildings project borders)
- Guard Hut / Watchtower / Barracks with knight slots
- Knight recruitment (serf + sword + shield → knight)
- Knight ranks, gold bonus
- Attack orders and 1v1 combat resolution
- Building capture logic

#### Phase 7: Economy & UI
- Construction menu (Material 3)
- Building info panels (status, inventory, workers)
- Global statistics panel (resources, population, military)
- Goods distribution/priority settings
- Minimap
- Alerts and notifications

#### Phase 8: Polish & Multiplayer Foundation
- AI opponent (basic)
- Map scenarios / random generation with seeds
- Performance optimization (instancing, LOD, culling)
- Sound effects and music
- Save/load system
- Win/defeat conditions

### Verification & Testing Strategy

Every task must be verified through a combination of these methods:

**Build & logic (run after every task):**
- `npm run build` — TypeScript compilation, no errors
- `npm run lint` — no lint violations
- `npm run test` — Vitest unit tests for all game logic (resource chains, combat math, pathfinding, territory, production timers, etc.)

**Visual verification via Chrome MCP (run after any rendering/UI change):**
1. Start dev server: `npm run dev` (background)
2. `navigate_page` to `http://localhost:5173`
3. `take_screenshot` — verify the 3D scene renders correctly
4. `take_snapshot` — check the accessibility tree for UI elements
5. `list_console_messages` — ensure no runtime errors or warnings
6. `evaluate_script` — run JS assertions in the page (e.g., check scene.children.length, renderer state)
7. `emulate` — test mobile viewport sizes and touch responsiveness

**Performance checks (run at phase milestones):**
- `performance_start_trace` / `performance_stop_trace` — measure Core Web Vitals (LCP, INP, CLS)
- `lighthouse_audit` — accessibility, SEO, best practices
- `take_memory_snapshot` — check for memory leaks in the render loop

**Rule: never skip `build` + `test` + `take_screenshot` before marking a visual task as done.**

### Git Workflow

After each phase is fully complete and verified (build + lint + test + visual), commit all changes and push to remote. Use a descriptive commit message summarizing the phase.

### Task Granularity Rules

- Each task in `PROGRESS.md` should be completable in a single session
- If a task feels too large, break it into subtasks before starting
- Each task must include: what to implement, which design doc to reference, and how to verify it works
- After each task, the game should still run without errors
