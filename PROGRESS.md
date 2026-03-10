# Project Progress

## Current Phase: Phase 2 COMPLETE — Ready for Phase 3

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

### Phase 3–8: Not yet broken into tasks
> Tasks will be detailed when the phase becomes active. See `CLAUDE.md` for phase overview.

## Completed
- **2026-03-10**: Phase 2 Blender retrofit. Replaced all primitive Three.js shapes with Blender-created GLTF models (10 models: hex_tile, tree_deciduous, tree_conifer, mountain_peak, snow_cap, boulder, cactus, dune, bush, rock_small). Added AssetLoader with async loading. 61 FPS, 27 tests passing.
- **2026-03-10**: Phase 2 complete. Hex grid (axial coords, pointy-top), 5 terrain types with decorations per terrains.md. Seeded procedural map gen (dual-noise elevation+moisture, percentile terrain assignment). 32x32 default map. World wrapping via 8 ghost group clones. Camera: mouse drag pan, scroll zoom, WASD/arrow keys, touch drag + pinch zoom. 60 FPS verified. 27 tests passing.
- **2026-03-10**: Phase 1 complete. Vite + TypeScript + Three.js + MDUI.

## Decisions & Notes
- **Material 3 library**: MDUI (actively maintained, web components, TypeScript-first)
- **Icons**: @mdui/icons (tree-shakable SVG, no font dependency)
- **Terrain enum**: Using `const` object + type alias pattern instead of TS `enum` (required by `erasableSyntaxOnly`)
- **Hex grid**: Axial coordinates (q, r), flat-top orientation, HEX_SIZE = 1.0
- **Map generation**: Dual Perlin noise layers (elevation + moisture), percentile-based terrain assignment for consistent proportions
- **World wrapping**: 8 cloned groups offset by map dimensions (simple, 60 FPS at 32x32)
- **3D assets**: All created in Blender via MCP, exported as GLTF/GLB to `public/models/terrain/`, loaded via AssetLoader + GLTFLoader
- **Package manager**: npm
- **Node**: v23.9.0

## Blockers
_None._
