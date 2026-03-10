# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Feudal Realm Manager** — a browser-based (including mobile) real-time strategy and city-building game inspired by The Settlers series. Built with **Three.js** for 3D rendering and **Material 3** for UI components and icons. The project is in its early/design phase with no code yet — only game design documents exist.

## Game Design Documents

All design specs live in `docs/`:

- `docs/game.md` — Master game design document: core gameplay loop, mechanics (resource management, building system, transportation/logistics, territory expansion, combat, economic management), progression tree, UI layout, win conditions
- `docs/buildings.md` — Visual designs for all 23 building types using simple 3D geometric shapes (cubes, cuboids, pyramids, cylinders) with specific colors
- `docs/resources.md` — Visual designs for all 17 resource types (raw materials, processed goods, animals) using simple 3D shapes
- `docs/units.md` — Visual designs for all serf professions (18 types) and knights, built on a shared base model with profession-specific additions
- `docs/terrains.md` — Visual designs for 5 terrain types (grassland, forest, mountain, water, desert) with specific Three.js geometry types and hex colors

**Always read the relevant design doc before implementing a feature.** The docs specify exact shapes, colors, and behaviors.

## Key Design Constraints

- **Browser + mobile**: must be playable on both desktop browsers and mobile phones
- **Simple 3D shapes only**: all visuals use basic Three.js geometries (BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, PlaneGeometry) — no complex models or textures
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

### Blender MCP Integration

A Blender MCP server is configured (`.mcp.json`) providing direct access to Blender for creating and manipulating 3D models. Available capabilities:

- **Execute Blender code** (`mcp__blender__execute_blender_code`): run Python scripts in Blender to create/modify 3D models programmatically
- **Scene inspection**: get scene info, object info, and viewport screenshots
- **Asset sourcing**: search/download assets from Polyhaven and Sketchfab
- **AI model generation**: generate 3D models via Hyper3D (text or image input) and Hunyuan3D, then import them into the scene

Use Blender MCP to prototype and create 3D assets for the game (buildings, units, resources, terrain elements).

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
- Construction process (builder + resources → building over time)

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

Claude Code cannot see the browser. Every task must be verified through a combination of these methods:

**Automated (Claude does these):**
- `npm run build` — TypeScript compilation, no errors
- `npm run lint` — no lint violations
- `npm run test` — Vitest unit tests for all game logic (resource chains, combat math, pathfinding, territory, production timers, etc.)
- `npm run dev` + `WebFetch http://localhost:5173` — dev server responds, HTML loads without errors

**Visual verification (user does this):**
- After any task that changes rendering (new 3D models, camera changes, UI components, terrain), ask the user to check the browser and share a screenshot if something looks wrong
- Keep visual changes small and incremental so issues are easy to spot

**Rule: never skip `build` + `test` before marking a task as done.**

### Task Granularity Rules

- Each task in `PROGRESS.md` should be completable in a single session
- If a task feels too large, break it into subtasks before starting
- Each task must include: what to implement, which design doc to reference, and how to verify it works
- After each task, the game should still run without errors
