# Project Progress

## Current Phase: Phase 5 — Resources & Logistics

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

### Phase 4: Units & AI [COMPLETE]
- [DONE] 4.1 Unit data model — UnitType (19 types: 18 professions + Knight), Unit instance (position, state, path, assignment), GameState extended with unit management — 2026-03-10
- [DONE] 4.2 Base serf 3D model in Blender — body + head + arms + legs, 106 verts, exported as serf_base.glb — 2026-03-10
- [DONE] 4.3 Profession variant models (batch 1) — Transporter, Builder, Woodcutter, Forester, Stonemason, Fisherman — 2026-03-10
- [DONE] 4.4 Profession variant models (batch 2) — Miner, Farmer, Miller, Baker, Pig Farmer, Butcher, Sawmill Worker — 2026-03-10
- [DONE] 4.5 Profession variant models (batch 3) — Smelter Worker, Goldsmith, Toolmaker, Blacksmith, Geologist, Knight — 2026-03-10
- [DONE] 4.6 UnitRenderer — 20 unit GLTF models loaded via AssetLoader, UnitRenderer with world wrapping, integrated into Game loop — 2026-03-10
- [DONE] 4.7 Hex pathfinding (A*) — A* on hex grid with world-wrapping heuristic, avoids water, 14 tests — 2026-03-10
- [DONE] 4.8 Serf spawning & job assignment — UnitManager spawns serfs from Castle, auto-assigns to buildings, pathfinds to workplace, integrated into Game loop — 2026-03-10
- [DONE] 4.9 Unit movement system — path-based movement with speed-scaled interpolation between hexes, arrival detection, state transitions — 2026-03-10
- [DONE] 4.10 Work cycle system — procedural animations: work bob+sway, walk bob+facing direction — 2026-03-10

### Phase 5: Resources & Logistics [COMPLETE]
- [DONE] 5.1 Production system — ProductionManager: active buildings with workers consume inputs, advance productionProgress, produce outputs on timer. 16 tests — 2026-03-10
- [DONE] 5.2 Castle starting resources & resource helpers — inventory helpers (add/remove/get), Castle starts with wood(12)/stone(8)/planks(6)/tools(4)/fish(4)/bread(4). 9 tests — 2026-03-10
- [DONE] 5.3 Construction process — ConstructionManager: Planned → deliver resources from Castle → UnderConstruction → builder spawns/walks/builds → Active → builder goes home. Full lifecycle verified in-game. 9 tests — 2026-03-10
- [DONE] 5.4 Flag & road data model — RoadNetwork: Flag placement, Road connections between adjacent flags, adjacency graph, BFS route finding, flag/road removal with cleanup. 25 tests — 2026-03-10
- [DONE] 5.5 Flag & road rendering — RoadRenderer: 3D flag meshes (pole+banner), road tubes between flags, world wrapping, sync with RoadNetwork. Integrated into Game loop. Visually verified — 2026-03-10
- [DONE] 5.6 Transporter system — TransporterManager: auto-spawns transporter per road segment, picks up goods at flags, carries toward destination via BFS routing, delivers to building input or leaves at intermediate flags. 10 tests — 2026-03-11
- [DONE] 5.7 Resource delivery routing — LogisticsManager: auto-creates flags for buildings, moves outputInventory → flag goods with destination routing (nearest consumer first, Castle/Warehouse fallback), 8-good flag cap, over-supply prevention. 10 tests — 2026-03-11
- [DONE] 5.8 Resource 3D models — 17 Blender GLTF models (wood, stone, grain, fish, iron/coal/gold ore, planks, flour, bread, meat, iron/gold bars, tools, swords, shields, pigs). AssetLoader loads them; UnitRenderer shows carried resources above units. Visually verified — 2026-03-11
- [DONE] 5.9 Integration test — Full chain verified: Wood production → logistics routing → transport → Sawmill input → Planks output. Construction lifecycle, transporter spawning. 4 tests — 2026-03-11

### Phase 6–8: Not yet broken into tasks
> See `CLAUDE.md` for phase overview.

## Completed
- **2026-03-11**: Phase 5 tasks 5.1–5.9 complete. ProductionManager (input consumption, output production, timers). Castle starting resources + inventory helpers. ConstructionManager (Planned → deliver resources → UnderConstruction → builder → Active). Flag & road network (RoadNetwork with BFS routing, 25 tests). Flag & road 3D rendering (RoadRenderer). TransporterManager (auto-spawn per road, pick up/carry/deliver goods, relay through intermediate flags). LogisticsManager (auto-create building flags, route outputInventory → flags with destination routing). 17 resource GLTF models. UnitRenderer shows carried resources. Integration test: full Wood → Sawmill → Planks chain verified. 251 tests passing, 0 errors.
- **2026-03-10**: Phase 4 tasks 4.1–4.10 complete. UnitType (19 types: 18 professions + Knight), Unit instance model with state machine (idle → walking_to_work → working → walking_home), UnitDefinition with move speed and tool requirements. WORKER_TO_UNIT_TYPE mapping links buildings to professions. 20 Blender GLTF unit models (base serf + 19 profession variants with tools, hats, aprons per docs/units.md). UnitRenderer with world wrapping and per-frame sync. A* pathfinding on hex grid with world-wrapping heuristic, avoids water. UnitManager: auto-spawns serfs from Castle when buildings need workers, assigns, pathfinds, manages movement interpolation and arrival. Procedural animations: work bob+sway, walk bob+facing. Game loop integrated. 163 tests passing, 0 errors.
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
- **Unit data model**: Same const+type alias pattern as BuildingType. 19 UnitTypes (18 professions + Knight). UnitState: idle/walking_to_work/working/walking_home.
- **Unit models**: 20 GLTF models in public/models/units/. All share base serf body (cylinder torso, sphere head, cylinder arms+legs). Professions distinguished by tools, hats, aprons, color accents per docs/units.md.
- **Pathfinding**: A* on hex grid. World-wrapping heuristic checks 8 offset distances. Avoids water. Max 200 steps per search.
- **Unit spawning**: UnitManager runs each frame. Spawns one serf at Castle per 2-second cooldown when active buildings need workers. Auto-assigns and pathfinds.
- **Unit animations**: Procedural — no skeletal animation. Work state: bob + body sway. Walk state: step bob + face direction. Per-unit time offset prevents sync.
- **Game debugging**: window.__game exposed for console access to GameState, UnitManager, renderers.
- **Package manager**: npm
- **Node**: v23.9.0

## Blockers
_None._
