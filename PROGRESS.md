# Project Progress

## Current Phase: Phase 3 COMPLETE — Ready for Phase 4

## Task Board

### Phase 1: Project Scaffolding [COMPLETE]
- [DONE] Initialize project (Vite + TypeScript + Three.js + MDUI for Material 3) — 2026-03-10
- [DONE] Basic Three.js renderer setup (isometric camera, resize handling, render loop) — 2026-03-10
- [DONE] Dev server, build, and lint configuration — 2026-03-10
- [DONE] Mobile-responsive canvas + Material 3 UI shell (app bar, side panel placeholder) — 2026-03-10

### Phase 2: Terrain & Map System [COMPLETE]
- [DONE] 2.1 Hex tile data model + terrain types + map data structure — 2026-03-10
- [DONE] 2.2 Seeded procedural map generation (noise-based terrain distribution) — 2026-03-10
- [DONE] 2.3 Hex grid 3D rendering — ground tiles for all 5 terrain types — 2026-03-10
- [DONE] 2.4 Terrain decorations — trees, mountains, rocks, water effects — 2026-03-10
- [DONE] 2.5 World wrapping logic (8 ghost copies for seamless edges) — 2026-03-10
- [DONE] 2.6 Camera controls — pan/zoom for desktop + touch — 2026-03-10
- [DONE] 2.7 Blender GLTF asset pipeline — all terrain models created in Blender, loaded via GLTFLoader — 2026-03-10

### Phase 3: Buildings & Placement [COMPLETE]
- [DONE] 3.1 Building type data model — all 24 types with costs, inputs, outputs, workers, terrain rules — 2026-03-10
- [DONE] 3.2 Building instance state — placed buildings with position, construction progress, inventory, workers — 2026-03-10
- [DONE] 3.3 Building 3D models — Core (Castle, Woodcutter, Forester, Quarry, Fisherman, Guard Hut) — 2026-03-10
- [DONE] 3.4 Building 3D models — Tier 2 (Sawmill, Farm, Geologist, Mine, Watchtower) — 2026-03-10
- [DONE] 3.5 Building 3D models — Tier 3 (Windmill, Bakery, Pig Farm, Slaughterhouse, Smelter, Toolmaker, Goldsmith, Blacksmith, Barracks) — 2026-03-10
- [DONE] 3.6 Building 3D models — Logistics (Warehouse) — 2026-03-10
- [DONE] 3.7 BuildingRenderer — render placed buildings on the hex map — 2026-03-10
- [DONE] 3.8 Building placement system — UI for selecting, previewing, validating, and placing buildings — 2026-03-10

### Phase 4–8: Not yet broken into tasks
> Note: Construction process (builder + resources → building over time) moved to Phase 5 — depends on serfs (Phase 4) and logistics (Phase 5).
> Tasks will be detailed when the phase becomes active. See `CLAUDE.md` for phase overview.

## Completed
- **2026-03-10**: Phase 3 tasks 3.1–3.8 complete. ResourceType (17 types), BuildingType (24 types with costs/production/terrain rules), Building instance state, GameState with placement validation, 21 Blender GLTF building models, BuildingRenderer with world wrapping, PlacementController with ghost preview + hex highlight + terrain validation, Material 3 build panel UI with tier-organized building list. Castle auto-placed at map center on start. 88 tests passing, 0 errors.
- **2026-03-10**: Phase 2 atmosphere polish. Animated water shader (vertex wave displacement + color cycling + foam). Exponential fog for atmospheric depth. Hemisphere light (sky blue + ground green) + warm directional sunlight. 52 FPS, 27 tests passing.
- **2026-03-10**: Phase 2 visual polish. Added elevation-based Y offsets (water depressed, mountains raised). Scaled up small decorations (cacti, rocks, bushes) for visibility. Tested shadows but dropped them (halved FPS with minimal visual gain — deferred to Phase 8). 64 FPS, 27 tests passing.
- **2026-03-10**: Fixed broken 3D models. Rebuilt cactus with L-shaped arms at final vertex positions (rotation_euler broke during GLTF export). Created integrated mountain_peak_snow.glb replacing floating snow_cap. Added water_waves decoration. 11 models total, 54 FPS, 27 tests passing.
- **2026-03-10**: Phase 2 Blender retrofit. Replaced all primitive Three.js shapes with Blender-created GLTF models (11 models: hex_tile, tree_deciduous, tree_conifer, mountain_peak, mountain_peak_snow, boulder, cactus, dune, bush, rock_small, water_waves). Added AssetLoader with async loading.
- **2026-03-10**: Phase 2 complete. Hex grid (axial coords, pointy-top), 5 terrain types with decorations per terrains.md. Seeded procedural map gen (dual-noise elevation+moisture, percentile terrain assignment). 32x32 default map. World wrapping via 8 ghost group clones. Camera: mouse drag pan, scroll zoom, WASD/arrow keys, touch drag + pinch zoom. 60 FPS verified. 27 tests passing.
- **2026-03-10**: Phase 1 complete. Vite + TypeScript + Three.js + MDUI.

## Decisions & Notes
- **Material 3 library**: MDUI (actively maintained, web components, TypeScript-first)
- **Icons**: @mdui/icons (tree-shakable SVG, no font dependency)
- **Terrain enum**: Using `const` object + type alias pattern instead of TS `enum` (required by `erasableSyntaxOnly`)
- **Hex grid**: Axial coordinates (q, r), flat-top orientation, HEX_SIZE = 1.0
- **Map generation**: Dual Perlin noise layers (elevation + moisture), percentile-based terrain assignment for consistent proportions
- **World wrapping**: 8 cloned groups offset by map dimensions (simple, 60 FPS at 32x32)
- **Elevation rendering**: Per-tile Y offset based on elevation value. Water=-0.1, others=elevation*0.2. Creates natural terrain stepping.
- **Shadows**: Tested but deferred to Phase 8. Shadow mapping halved FPS (~30 vs 64) with minimal visual benefit at isometric zoom. Will revisit with instanced meshes.
- **Water shader**: Custom ShaderMaterial with vertex wave displacement, shallow/deep color mixing, foam highlights, fog support
- **Fog**: FogExp2 density 0.012, softens distant terrain and hides world-wrap seams
- **Lighting**: HemisphereLight (sky 0x87ceeb / ground 0x4a7c3f, intensity 0.7) + DirectionalLight (warm 0xfff4e0, intensity 0.9)
- **3D assets**: All created in Blender via MCP, exported as GLTF/GLB to `public/models/terrain/`, loaded via AssetLoader + GLTFLoader
- **Package manager**: npm
- **Node**: v23.9.0

## Blockers
_None._
