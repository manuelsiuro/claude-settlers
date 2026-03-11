# Project Progress

## Current Phase: Phase 7 — Economy & UI [COMPLETE]

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

### Phase 6: Territory & Military [COMPLETE]
- [DONE] 6.1 Territory influence system — TerritoryManager: BFS flood-fill from military buildings (Castle r=8, Guard Hut r=4, Watchtower r=6, Barracks r=8). Water blocks expansion. Dirty flag for lazy recalculation. Closest building wins overlaps. 13 tests — 2026-03-11
- [DONE] 6.2 Territory rendering — TerritoryRenderer: blue border lines on territory edges, subtle fill overlay on owned hexes. Per-player colors. World wrapping ghosts. Lazy rebuild on territory change. Visually verified — 2026-03-11
- [DONE] 6.3 Knight slot management — knightIds[] on Building, KnightManager: auto-recruits when Sword+Shield in military building with empty slot. Gold bonus (5%/bar, 50% cap). Knight strength = rank × goldBonus. Dead knight cleanup. 10 tests — 2026-03-11
- [DONE] 6.4 Combat system — CombatManager: 1v1 duels, probability-based (strength ratio). Rank advancement (2 wins → rank up, cap 5). Gold bonus factored in. Loser removed, winner tracks wins. 8 tests — 2026-03-11
- [DONE] 6.5 Attack orders & building capture — AttackManager: order knight to attack enemy military building, pathfind to target, fight defenders 1v1, capture on victory, flip territory, transfer civilian buildings. 7 tests — 2026-03-11
- [DONE] 6.6 Territory-gated building placement — territoryCheck callback on GameState, 'outside_territory' error. Castle exempt. canPlace + placeBuilding both check. PlacementController passes playerId. 2 tests — 2026-03-11
- [DONE] 6.7 Integration test — Full chain verified: knight recruitment, territory projection, building capture + territory flip, territory-gated placement. 4 tests — 2026-03-11

### Phase 7: Economy & UI [COMPLETE]
- [DONE] 7.1 Building selection & info panel — SelectionController: click-to-select buildings (HexPicker + click/touch), blue highlight ring, Escape to deselect. Info panel shows status, construction progress, worker info, production recipe + progress, knight slots, inventory (input/output), capacity, position. Live updates every 500ms. 298 tests passing — 2026-03-11
- [DONE] 7.2 Enhanced construction menu — getPlayerResources() sums Castle+Warehouse inventories. Cost items colored green (affordable) or red (short). Unaffordable buildings dimmed at 45% opacity. Production recipe summaries in italic (e.g., "Iron Ore + Coal → Iron Bars"). Panel refreshes on open to reflect current state. 298 tests passing — 2026-03-11
- [DONE] 7.3 Flag & road placement UI — RoadPlacementController: Flag mode (click hex → place flag) and Road mode (click flag → click adjacent hex → auto-place flag + connect). Chain building: auto-selects target flag for continuous extension. Blue highlight + cyan neighbor dots for valid targets. Logistics section in build panel. Snackbar notifications. 298 tests passing — 2026-03-11
- [DONE] 7.4 Global statistics panel — Stats panel via nav drawer "Statistics" item. Shows: resource stockpiles (raw + processed, all buildings), population by profession, buildings count by type (active vs constructing), military overview (knights, gold bars, avg rank). Live updates every 1s. 298 tests passing — 2026-03-11
- [DONE] 7.5 Minimap — 2D canvas minimap in top-right corner. Shows terrain colors, territory overlay (blue), building dots (white), camera viewport rect (yellow). Click-to-navigate moves camera. Auto-updates via requestAnimationFrame. 298 tests passing — 2026-03-11
- [DONE] 7.6 Military management UI — Info panel shows knight slots (stationed/total), individual knight ranks, red "Attack Enemy Building" button. Attack targeting mode: overrides selection to pick enemy military building, sends first available knight via AttackManager. CSS styled attack button. 298 tests passing — 2026-03-11
- [DONE] 7.7 Alerts & notification system — GameNotification type on Game with onNotification callback. Manager callbacks updated to pass context (ConstructionManager→building, KnightManager→building). New callbacks: CombatManager.onDuelResolved, AttackManager.onBuildingCaptured/onBuildingUnderAttack. 6 notification types: building_complete, knight_recruited, under_attack, building_captured, building_destroyed, combat_result. Color-coded snackbar (green/blue/red/orange/purple). 298 tests passing — 2026-03-11
- [DONE] 7.8 Integration test — 6 new tests: onBuildingActivated fires with building, onKnightRecruited fires with building, onDuelResolved fires with result, onBuildingUnderAttack + onBuildingCaptured fire during attack workflow, onBuildingRemoved fires with building, player resource aggregation across Castle+Warehouse. 304 tests passing — 2026-03-11

### Phase 8: Not yet broken into tasks
> See `CLAUDE.md` for phase overview.

## Completed
- **2026-03-11**: Phase 7 tasks 7.1–7.8 complete. SelectionController (click-to-select buildings, blue highlight ring). Info panel (status, construction progress, worker info, production recipe+progress, knight slots+ranks, inventory, capacity, position). Enhanced build menu (cost availability coloring green/red, affordability dimming, production summaries). RoadPlacementController (flag+road placement with chain building). Statistics panel (resource stockpiles, population, buildings, military overview). Minimap (2D canvas, terrain+territory+buildings+camera rect, click-to-navigate). Military management UI (knight slots display, attack targeting mode). GameNotification system (6 event types: building_complete, knight_recruited, under_attack, building_captured, building_destroyed, combat_result; color-coded snackbar). Manager callbacks updated to pass context (building, DuelResult). 6 Phase 7 integration tests. 304 tests passing, 0 errors.
- **2026-03-11**: Phase 6 tasks 6.1–6.7 complete. TerritoryManager (BFS flood-fill from military buildings, water blocks, dirty flag, closest-wins overlap). TerritoryRenderer (border lines + fill overlay per player, world wrapping). KnightManager (auto-recruit when Sword+Shield in military building, gold bonus 5%/bar capped at 50%). CombatManager (1v1 probability-based duels, rank advancement every 2 wins, cap at rank 5). AttackManager (order attacks, knight pathfinding, sequential combat, building capture, territory flip, civilian building transfer). Territory-gated building placement (Castle exempt). 4 military integration tests. 298 tests passing, 0 errors.
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
