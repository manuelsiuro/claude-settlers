# Project Progress

## Current Phase: Living World — Complete

## Task Board

### Living World Feature [COMPLETE]
- [DONE] Design document — Created `docs/living-world.md` covering ambient visuals (6 systems) and gameplay content (5 buildings, 5 resources, 5 units). Updated `docs/buildings.md`, `docs/resources.md`, `docs/units.md`. — 2026-03-24
- [DONE] Data layer — Added 5 resources (GameMeat, Pelts, FurCoat, Honey, Mead) with `isLuxury` field on ResourceProperties. Added 5 units (Hunter, Trapper, Furrier, Beekeeper, Meadmaker). Added 5 buildings (HuntingLodge, TrappersHut, Furrier, Apiary, Meadery) with `inputCategory` field on ProductionRecipe. Registered all in AssetLoader, BuildingModels, UnitModels, BuildingRenderer. 779 tests passing. — 2026-03-24
- [DONE] Gameplay logic — Fixed InnTavern bug (never consumed Beer due to empty outputs skip). Added data-driven `inputCategory` on ProductionRecipe for generic service buildings. Created `TerrainGatheringManager` (single data-driven manager for terrain gatherers). Updated MoraleManager with luxury goods tracking. Updated FeedingManager, AI build orders, SaveLoad v13. 779 tests passing. — 2026-03-24
- [DONE] 3D models — Created 20 Blender models: 5 buildings, 5 units, 5 resources, 4 terrain animals (deer, rabbit, mountain_goat, fish), 1 flower_patch. Added Bees particle effect to ParticleSystem for Apiary. — 2026-03-24
- [DONE] Ambient sky systems — Created CloudRenderer (30 billboard clouds with ground shadows, procedural Canvas2D textures, camera-relative wrapping, night tint). Created BirdFlockRenderer (5 GPU-driven flocks with V-shape shader birds, wing flap animation, flight patterns). Added `ambientLife` graphics setting. — 2026-03-24
- [DONE] Ambient ground & water systems — Created WaterEffectRenderer (sun sparkle points on water tiles, day/night scaling). Created WildAnimalRenderer (20 ambient animals with state machine: deer, rabbits, goats, fish). Created FlowerButterflyRenderer (25 GPU-driven butterflies with wing flap shader, daytime only). 779 tests passing. — 2026-03-24

### Marketplace System [COMPLETE]
- [DONE] Design document — Full barter marketplace design at `docs/marketplace.md`. Covers: barter exchange, dynamic pricing, NPC stock, traveling merchants, auto-trade rules, Castle fallback trading, AI integration, data-driven constants, UI design. — 2026-03-23
- [DONE] Phase 1: Core Manager & Data — Created `MarketplaceManager.ts` (barter trades, dynamic pricing, NPC stock restock, traveling merchants, auto-trade rules, save/load). Added 25+ constants to `balanceConstants.ts` with override support. Updated Market building (Merchant worker, storage 20). Added Merchant unit type. Integrated into Game.ts + SaveLoad.ts. 24 new tests. 779 tests passing. — 2026-03-23
- [DONE] Phase 2: Trade UI — Created `TradePanel.ts` with resource selectors, amount controls (+/-5/+/-1), exchange rate preview, price impact indicator, confirm trade button, NPC stock display, traveling merchant deals, and price trends. Integrated into InfoPanel via structure key + HTML generation + event delegation (click + change). Added 180+ lines CSS (responsive: mobile bottom sheet + desktop sidebar). 779 tests passing. — 2026-03-23
- [DONE] Phase 3: Merchant Notifications — Added `onMerchantArrival` callback to MarketplaceManager, wired in main.ts to show snackbar "A traveling merchant has arrived at your Market!" for human player. Updated TradePanel to use proper `showSnackbar` from Snackbar module. — 2026-03-23
- [DONE] Phase 4: Auto-Trade UI — Added auto-trade rule editor section to Market panel: displays existing rules with toggle (✓/○) and delete (×) buttons, add form with action/resource/threshold/exchange dropdowns, "0/8" counter. Rules persist via MarketplaceManager. 100+ lines CSS for rule display, controls, and form layout. 779 tests passing. — 2026-03-23
- [DONE] Phase 5: AI Trading — Added `tryTrade()` to AIPlayer: evaluates surplus/shortage every 30s, trades via market (if built) or castle fallback, respects price sensitivity (won't trade if price multiplier > 1.3x), trades modest amounts (max 5, 30% of surplus). Wired via `setMarketplaceManager()` in Game.ts. — 2026-03-23
- [DONE] Phase 6: Dashboard Integration — Added `setEconomyTracker()` to MarketplaceManager. All trades (manual, merchant deals) record consumption (sold resource) and production (received resource) events in EconomyTracker, so Dashboard charts reflect trade flow alongside production. — 2026-03-23
- [DONE] Phase 7: Visual Polish — Added placeholder merchant.glb model and thumbnail (copies shepherd as base — replace with custom Blender model when Blender MCP is available). Model loads without errors. 779 tests passing. — 2026-03-23

### Food System Rebalance [COMPLETE]
- [DONE] Food system rebalance — Halved decay rate (0.002→0.001), removed working penalty (1.2→1.0), added food producer protection (0.5x decay + priority 1.5 feeding), lowered feed threshold (0.90→0.80), boosted satiation values (Fish 0.50, Bread 0.70, Meat 0.90), sped up primary food buildings (Fisherman 14s, Orchard 16s, Farm 20s), lowered warning thresholds (hungry 0.35, starving 0.15), softened penalties. Net effect: 4x reduction in food consumption, food producers take 33 min to starve. Created `docs/food-system.md` guide. 753 tests passing. — 2026-03-23

### Mobile UI Overhaul [COMPLETE]
- [DONE] Phase 1: BottomSheetController — Created `src/ui/BottomSheetController.ts` with gesture-driven snap points (peek/expanded), velocity-based fling, swipe-to-dismiss. Uses `transform: translateY()` for GPU-composited animations. Wired to InfoPanel as first consumer. Added drag handle elements to all panels. Changed mobile panel show/hide from `display: none` to transform-based transitions. — 2026-03-23
- [DONE] Phase 2: Mobile Bottom Toolbar — Replaced two stacked FABs (Build 56px + Stats 48px) with unified 5-button toolbar at bottom edge (Build, Stats, Recents, Speed, Menu). 48px touch targets, translucent blur background. Hidden on desktop. Moved speed/pause controls into toolbar for thumb-zone accessibility. Repositioned placement bar and snackbar above toolbar. — 2026-03-23
- [DONE] Phase 3: Build Flow Redesign — Reduced building placement from 6 taps to 3 (standard) or 2 (recents). Replaced inline expand-then-place pattern with building detail sheet showing cost/production/military info + "Place" button. Added recent buildings system (max 5, localStorage-persisted) with circular thumbnails in the mobile toolbar. 3-column grid on mobile (up from 2). — 2026-03-23
- [DONE] Phase 4: Placement Touch Fix — Added `touchmove` handler to `PlacementController` so ghost preview follows finger across hexes in real-time. Added `placementActive` flag to `CameraController` to suppress single-finger pan during placement while preserving pinch-to-zoom. — 2026-03-23
- [DONE] Phase 5: Info Panel Quick Actions — Added mobile-only quick actions row (Pause/Resume, Attack, Demolish) to info panel via `generateQuickActionsHTML()`. Event delegation handles toggle-pause, attack targeting, and demolish dialog. Styled as horizontal pill buttons. — 2026-03-23
- [DONE] Phase 6: Polish — Added drag handles to build/stats panels. Moved alert bars from `bottom: 150px` to `top: 56px` on mobile. Increased `.icon-btn` to 44px on mobile (Apple HIG minimum). Updated Capacitor back button to dismiss building detail sheet. Build + lint + 745 tests pass. Desktop UI verified unchanged. — 2026-03-23

### Standalone App Packaging [COMPLETE]
- [DONE] Phase 1: Capacitor (Android + iOS) — Installed @capacitor/core, @capacitor/cli, @capacitor/app, @capacitor/android, @capacitor/ios. Created capacitor.config.ts with https scheme, splash screen, status bar config. Generated android/ and ios/ native projects. Added npm scripts (cap:sync, cap:android, cap:ios, cap:run:android). Added WebGL context loss/restore handlers in Game.ts for Android backgrounding. Added Android back button handler via @capacitor/app to close panels instead of navigating away. — 2026-03-21
- [DONE] Phase 2: Tauri v2 (Desktop) — Created src-tauri/ with tauri.conf.json (1280x720 window, CSP config, all bundle targets), Cargo.toml, main.rs, lib.rs, build.rs. Installed @tauri-apps/cli. Added tauri:dev and tauri:build npm scripts. Note: Rust toolchain needed for actual builds. — 2026-03-21
- [DONE] Phase 3: PWA Enhancement — Replaced manual sw.js stub with vite-plugin-pwa (Workbox auto-generation). Configured globPatterns for all asset types, 10MB size limit for GLB models, CacheFirst strategy for .glb files, autoUpdate registration. Removed manual SW registration from main.ts. — 2026-03-21
- [DONE] .gitignore updated — Added android/, ios/, src-tauri/target/ — 2026-03-21
- [DONE] Build + lint + 745 tests pass — 2026-03-21

### PNG Thumbnail UI Integration [COMPLETE]
- [DONE] Replace SVG resource icons with PNG thumbnails — resourceIcon() now returns `<img>` tags pointing to `/thumbnails/resources/*.png`, deleted ~180 lines of hand-drawn SVG data from icons.ts — 2026-03-21
- [DONE] Add buildingIcon() and unitIcon() helpers — new functions in icons.ts for building and unit PNG thumbnails — 2026-03-21
- [DONE] Add building thumbnails to BuildPanel (48px in tiles, 24px in expanded detail), InfoPanel (24px header), StatsPanel (buildings tab), DashboardPanel (building status/construction), TechTreePanel (node names), ResourcePriorityPanel (consumer rows), CapacityAlertBar (alert chips) — 2026-03-21
- [DONE] Add unit thumbnails to InfoPanel (garrison rows), StatsPanel (population/military tabs), DashboardPanel (unit breakdown) — 2026-03-21
- [DONE] Auto-propagated resource thumbnails to EconomyPanel, DemolishDialog, ToolAlertBar via resourceIcon() change — 2026-03-21
- [DONE] Add .build-tile-thumb CSS, build + lint + 745 tests pass — 2026-03-21

### Map Level Editor [COMPLETE]
- [DONE] Data Layer — MapData.ts (interfaces, validation, grid conversion), MapStorage.ts (localStorage CRUD, file I/O, bundled maps), GameConfig.customMapId — 2026-03-20
- [DONE] CameraHost refactor — Extracted CameraHost interface from CameraController so MapEditor can reuse it — 2026-03-20
- [DONE] Editor Engine — MapEditor.ts (Three.js scene, asset loading, pointer events, start position markers), UndoManager.ts (command-pattern undo/redo) — 2026-03-20
- [DONE] Editor Tools — MapEditorTools.ts with 6 tools: terrain brush, elevation brush, deposit tool, start position, flood fill, eraser. Brush preview overlay. — 2026-03-20
- [DONE] Editor UI — MapEditorUI.ts (full DOM: topbar, toolbar, viewport, properties panel, status bar), MapEditorState.ts, ThumbnailGenerator.ts (2D canvas thumbnails using minimap colors) — 2026-03-20
- [DONE] Game Integration — Game.ts conditional buildGridFromMapData() vs generateMap(), custom castle placement from MapData, SaveLoad v12 (stores all tiles for custom maps), Setup Screen map source tabs + gallery, main.ts editor lifecycle — 2026-03-20
- [DONE] Polish & Tests — MapData.test.ts (8 tests: validation, round-trip, deposits), CSS styles, all 745 tests pass — 2026-03-20

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

### Phase 8: Polish & Multiplayer Foundation [COMPLETE]
- [DONE] 8.1 Win/defeat conditions — VictoryManager: 3 victory types (elimination: last Castle standing; domination: 75%+ claimable land; economic: 50+ gold bars). Defeat on Castle destruction. Stored VictoryResult via getResult(). Game over overlay with stats (buildings, population, knights, gold, territory%). Player 1 defeat shows immediately even in multiplayer. Check interval every 2s. Supports 1-N players with sequential elimination. Mobile-responsive overlay. 17 tests (incl. cooldown blocking, non-active exclusion, defeat-before-victory ordering, deterministic domination). 331 tests passing — 2026-03-11
- [DONE] 8.2 Game setup screen — Pre-game setup overlay with Material 3 styling: seed input with random button, map size (24/32/48/64), players (1-4), scenario (Default/Island/Continent/Archipelago with terrain balance overrides), difficulty (Easy/Normal/Hard). GameConfig type + DEFAULT_CONFIG + SCENARIO_TERRAIN_BALANCE. Game class accepts Partial<GameConfig>, places Castles at spread-out quadrant positions for N players, camera centers on player 1's Castle. VictoryManager initialized with all player IDs. Mobile responsive (single-column on small screens). 18 new tests (GameConfig + GameSetup). 349 tests passing — 2026-03-11. Polish pass 2026-03-11: fixed 8 issues — placeCastleNear bounds check, Minimap leak on restart (store+dispose), seed validation (positive int only), startGame error handling (catch+snackbar+re-show overlay), New Game button on game-over card, z-index stack corrected (setup=2600/game-over=2500 to beat MDUI app-bar=2000/snackbar=2400), CSS --z-setup variable, scenario option title tooltips.
- [DONE] 8.3 AI opponent — AIPlayer class: runs each tick for non-human players (players 2..N). Three heuristic priorities: (1) economy build order (WoodcutterHut→ForesterHut→Quarry→Sawmill→FishermanHut→GuardHut→Farm→Warehouse→IronMine→Windmill→Bakery→IronSmelter→BlacksmithArmory→Barracks→…), (2) territory expansion via GuardHuts in build order, (3) attack weakest enemy military building with strongest available knight (activates at build step 12+). Mountain/water-specific buildings auto-skipped after 3 failed placement attempts. Difficulty scales both decisionInterval (Easy=10s, Normal=5s, Hard=2.5s) and attackInterval (Easy=20s, Normal=15s, Hard=8s). Polish pass 1 2026-03-11: 4 fixes — (1) attack targeting deprioritizes Castle (was trivially "weakest" with 0 knights, now only targeted after all proper military buildings are cleared), (2) attackInterval scales with difficulty, (3) hexRetryCount resets on canAfford block (prevents premature skips during resource waits), (4) defensive hexRetryCount increment on unexpected placeBuilding failure. Polish pass 2 2026-03-11: 3 fixes — (5) removed useless GeologistHut (no production output), (6) added Warehouse at build step 9 (prevents Castle storage cap stalling logistics chain), (7) military buildings (GuardHut/Watchtower/Barracks, influenceRadius>0) placed at territory border via findBorderHex() to maximize new area claimed per building; falls back to findValidHex if no valid border hex. Polish pass 3 2026-03-11: 2 fixes — (8) getAvailableKnights() now excludes knights whose assignedBuildingId points to an enemy building (mid-combat knights were being re-ordered, corrupting enemy building knightIds), (9) fixed 2 inaccurate test comments ("attackCooldown starts at 10" → correct is 9.0 = 15.0 × 0.6). 2 new tests: knight not re-ordered while fighting; GuardHut placed at territory border. Game.ts creates AIPlayer for each non-human player, ticks them in animate loop. 16 tests. 365 tests passing — 2026-03-11.
- [DONE] 8.4 Multi-player state — Removed all hardcoded playerId=1 from managers and UI (19 locations across 6 files). ConstructionManager delivers resources and spawns builders per-player from each player's own Castle. UnitManager spawns workers for all players each tick. TransporterManager uses flag.playerId for transporter ownership. Game.humanPlayerId field replaces all `=== 1` checks in notifications (victory/defeat/combat/attack/capture). PlacementController and Minimap use Game.getHumanPlayerId(). main.ts UI (game-over stats, build menu resources, stats panel, attack targeting, population/military/buildings) all use getHumanPlayerId(). AttackManager.onBuildingCaptured now passes oldPlayerId for correct "enemy captured your building" detection. TerritoryRenderer already supported 1-4 player colors. 5 new integration tests (multi-player construction delivery, worker spawning, transporter ownership, builder spawning, full lifecycle). 370 tests passing — 2026-03-11. Review pass (8.3+8.4) 2026-03-11: 3 fixes — (1) notification spam from AI events: added `building.playerId === humanPlayerId` guards on onBuildingActivated/onKnightRecruited/onBuildingRemoved callbacks, (2) RoadPlacementController had 2 hardcoded `placeFlag(hex, 1)` calls → changed to `getHumanPlayerId()`, (3) Minimap territory now uses per-player color map (blue/red/green/yellow) matching TerritoryRenderer instead of binary own/enemy.
- [DONE] 8.5 Performance optimization — InstancedMesh for terrain tiles (1 InstancedMesh per color group instead of 1 Mesh per tile) and decorations (1 InstancedMesh per model sub-mesh type). Water shader updated with USE_INSTANCING support for instanced water tiles. Ghost copies via InstancedMesh.clone() with position offsets — Three.js frustum culling auto-skips off-screen ghosts. Manual boundingSphere computation ensures correct culling. AssetLoader.getRawModel() for instancing access. Benchmark 64×64 map: 120 FPS desktop, 120 FPS mobile (4× CPU throttle, 375×667 viewport). Scene stats: 48 geometries (was thousands), ~460 InstancedMesh objects (was ~36,000+ individual meshes), ~340 draw calls (was ~36,000+). 370 tests passing — 2026-03-11. Polish pass 2026-03-11: 6 fixes — (1) dispose() was disposing shared AssetLoader geometries (would corrupt models on New Game restart), now only removes InstancedMeshes from scene, (2) dispose() was disposing shared AssetLoader materials for decorations, now tracks ownedMaterials[] separately and only disposes those, (3) waterMaterials[] module-level array leaked on restart — added unregisterWaterMaterial() called in dispose(), (4) removed dead materialOverride field from DecorationPlacement interface, (5) removed dead TerrainMeshFactory.ts (no longer imported after instancing rewrite), (6) removed unused mapGroup/getMapGroup() (no callers). Restart verified: geometry count stable at 44 across dispose+recreate cycles. Polish pass 2 2026-03-11: 2 fixes — (7) dispose() wasn't calling mesh.dispose() on InstancedMeshes — GPU instanceMatrix buffers leaked across restarts, now calls mesh.dispose() for both main and ghost meshes, (8) computeInstancedBounds didn't account for per-instance scale — bounding sphere could be too tight for scaled decorations, now extracts max scale from instance matrices and uses geoRadius × maxScale. Verified: 3 dispose+recreate cycles show stable geometry count (44→48→44), no console errors.
- [DONE] 8.6 Save/load system — Full game state serialization to JSON: GameState (buildings, units, workerByBuilding), RoadNetwork (flags, roads, goods), all 9 manager states (cooldowns, assignments, attacks, territory, combat wins, eliminations), AI player state (buildOrderIndex, cooldowns), ID counters (building/unit/flag/road), camera state (position, target, frustum). Save to localStorage + download as JSON file + load from file. Game.serialize()/start(savedData) for save/load lifecycle. UI: nav drawer items (Save Game, Load Game, Download Save) + "Continue Saved Game" button on setup screen (shown when localStorage save exists). 13 round-trip serialization tests (empty state, buildings with inventories, units with paths, road network with goods, ID counters, manager cooldowns/assignments, territory, combat wins, victory state, AI player state, worker assignments, JSON parse round-trip, transporter state). 383 tests passing — 2026-03-12.
- [DONE] 8.7 Sound effects & music — AudioManager singleton using raw Web Audio API (no dependencies). 13 procedural SFX types synthesised via oscillators + noise: building_placed (low thud), building_complete (ascending chime), flag_placed (soft click), road_built (tap), knight_recruited (trumpet fanfare), combat_clash (metallic noise burst), under_attack (alarm oscillation), building_captured (victory horn), building_destroyed (crash), victory (major arpeggio), defeat (descending minor), ui_click (subtle pulse), notification (bell harmonics). Background ambient music: pentatonic drone (C2/C3/G3/C4 oscillators) with sine+triangle warmth and slow LFO breathing modulation, fade in/out. UI: mute button + music toggle in app bar, 3 volume sliders (Master/SFX/Music) in Settings section of nav drawer. All game events wired: notifications dispatch type-specific SFX, building/flag/road placement, build menu clicks. Volume clamped 0-1. Music auto-stops on mute. 8 unit tests (mute toggle, volume clamping, SFX-while-muted safety, dispose safety). 391 tests passing — 2026-03-12.
- [DONE] 8.8 Game speed & pause — Game class: _paused and _gameSpeed state, togglePause/setPaused/cycleSpeed/setGameSpeed public API, onSpeedChange callback. Animate loop scales deltaTime by gameSpeed (0 when paused); camera/water/renderer still update while paused. App bar: pause/play toggle button + fast-forward speed cycle button + "Nx" speed label. Pause overlay: semi-transparent dark background with "Paused" title, hint text, Resume button. Spacebar keyboard shortcut (guards: skip during input/textarea/select focus, skip when setup overlay visible). Speed cycles 1x → 2x → 3x → 1x. UI resets on new game. 9 new tests (toggle, setPaused, cycleSpeed, setGameSpeed clamp, callback firing, no-op guards, deltaTime math). 400 tests passing — 2026-03-12.
- [DONE] 8.9 Integration test — 3 test suites, 9 tests. (1) Full 2-Player Game Scenario: AI builds economy buildings over time (verifies build order advance + building count), AI territory expands with military buildings (counts owned hexes via _getState), elimination victory on Castle destruction (onVictory + onDefeat callbacks, isGameOver, isEliminated), economic victory at 50+ gold bars, independent units/buildings per player after simulation. (2) Save/Load Round-Trip: serialize → JSON.parse → deserialize into fresh managers, verify all buildings (id, type, playerId, state, coord) and units match; AI state (buildOrderIndex, playerId) survives round-trip; victory state (gameOver, result, eliminated players) survives round-trip. (3) Performance Benchmark: 32×32 map with 12+ buildings, 20 units, road network, AI player — 100 ticks of all managers in <50ms/tick. 409 tests passing — 2026-03-12.

### Polish Phase: Visual Richness & Strategic UX
- [DONE] A1: Particle System Foundation — Pool-based ParticleSystem.ts using THREE.Points (single draw call per pool, 800 particle budget). 6 effect types: chimney smoke (Bakery/Smelter/Blacksmith/Goldsmith), forge sparks (Smelter/Blacksmith), sawmill wood chips, construction dust, tree debris, completion flash. Emitters auto-bind to buildings based on state (Active + producing). Custom vertex/fragment shaders with soft circle falloff and additive blending. Integrated into Game.ts animate loop. — 2026-03-12.
- [DONE] A2: Building Animations — BuildingAnimator.ts: windmill sails rotation, furnace emissive glow pulse, sawmill blade oscillation. Construction opacity ramp (30%→100%). Planned building translucent (20%). Building completion green glow (2s). Destruction animation (scale collapse + tilt + fade over 1s). — 2026-03-12.
- [DONE] A3: Tree Wind Sway — TreeSwayShader.ts: GPU-driven wind animation via custom ShaderMaterial. Per-instance phase offset from world position. Vertex displacement above Y=0.2 threshold (treetop sways, trunk stays). Zero CPU cost. Follows WaterShader.ts pattern with time uniform updates. — 2026-03-12.
- [DONE] B1: Shared Player Colors — PlayerColors.ts: extracted PLAYER_COLORS (blue/red/green/yellow) shared across TerritoryRenderer, Minimap, UnitRenderer, CombatRenderer. Eliminated duplication. — 2026-03-12.
- [DONE] B2: Knight Visual Distinction — Faction coloring: knight meshes tinted 40% toward player color on spawn. Rank chevrons: gold ConeGeometry pyramids on shoulder (1-5 based on knightRank). Updated per frame. Fighting state animation (aggressive bob + wider rotation). — 2026-03-12.
- [DONE] B3: Combat Animation System — CombatAnimationState.ts: ActiveDuel interface with 5 phases (Approach→Clash×N→Recoil→Result→Done). CombatRenderer.ts: visual effects during duels (position interpolation, swing rotation, recoil, winner scale pulse, loser fall+fade). Attack warning rings (pulsing red, 5Hz). Capture banner animation. Unit.ts: added Fighting state. — 2026-03-12.
- [DONE] C1: Goods Distribution Priority — GoodsDistribution.ts: per-resource priority (1-5) and per-building importance (1-5). Composite routing score = importance × priority / distance. LogisticsManager updated to use distribution settings when routing output goods. 5 new tests. — 2026-03-12.
- [DONE] C2: Building Hover Tooltips — TooltipController.ts: mousemove → hex raycast → building lookup → tooltip popup. Shows name, status, worker, production %, inventory summary, knight slots. 3D→screen positioning. Mobile: 500ms long-press. Throttled to 100ms. CSS styled tooltip card. — 2026-03-12.
- [DONE] C3: Building Status Icons — BuildingStatusOverlay.ts: THREE.Sprite with cached CanvasTexture (5 status types). Priority: no-worker (red X) > missing-inputs (amber hourglass) > storage-full (orange warning) > producing (green check) > construction (blue hammer). Updates every 500ms. Sprites are children of building mesh groups. — 2026-03-12.
- [DONE] C4: Economy Dashboard — EconomyTracker.ts: rolling 5-minute window of production/consumption events. Methods: getProductionRate(), getConsumptionRate(), getNetBalance(), getBottlenecks(), getHistory(). 7 new tests. — 2026-03-12.
- [DONE] C5: Production Chain Visualization — ProductionChainOverlay.ts: on building selection, draws dashed lines to upstream (input sources, blue) and downstream (output consumers, orange). Cone arrows at endpoints. Max 10 connections. — 2026-03-12.
- [DONE] C7: Minimap Enhancements — Unit dots (own=white, enemy=red). Construction indicators (yellow pulsing dots). — 2026-03-12.
- [DONE] D1: Pathfinding Optimization — Replaced O(n) open set iteration with binary min-heap (O(log n) push/pop). All 14 pathfinding tests pass. — 2026-03-12.

16 new tests (GoodsDistribution: 5, CombatAnimationState: 4, EconomyTracker: 7). 496 tests passing, 0 errors.

### Post-Phase 8: Gameplay Enhancements
- [DONE] Distance-based production cycles — Gathering buildings (WoodcutterHut, Quarry, FishermanHut, Farm, mines) now scale production time by distance to their harvest terrain. Formula: `effectiveTime = baseTime * min(3.0, 1.0 + max(0, dist-1) * 0.25)`. BFS with world wrapping finds nearest matching terrain. Placement preview: ghost mesh colored green/orange/red by distance rating, placement bar shows "Distance: X tiles — Rating". Info panel: effective cycle time (colored), efficiency %, resource distance for gathering buildings. Progress bar color matches rating. Processing/military/logistics buildings unaffected. 17 new tests (HexGrid.hexDistance, findNearestTerrain with wrapping, distance multiplier formula, distance-scaled production, processing buildings ignore distance). 426 tests passing — 2026-03-12.
- [DONE] Building scale coherence audit & fix — Analyzed all 24 GLB model bounding boxes. 7 buildings had effective footprints under 0.40 (GoldsmithMint 0.24, GuardHut 0.26, IronSmelter 0.29, Bakery 0.29, GeologistHut 0.30, BlacksmithArmory 0.32, Watchtower 0.32). Added per-building scale factors (1.5–2.0×) targeting 0.45–0.55 effective footprint range. Additionally scaled 4 mid-tier buildings slightly undersized (WoodcutterHut 1.15×, ForesterHut 1.15×, ToolmakerWorkshop 1.2×, Slaughterhouse 1.2×) and removed incorrect 0.9× downscale on Warehouse. Single-file change in BuildingRenderer.ts BUILDING_SCALE map. 439 tests passing — 2026-03-12.

### Expansion Phase A+B: Foundation + Core Mechanics [DONE]
- [DONE] A1: Terrain-weighted pathfinding — `findPath()` now uses `TERRAIN_PROPERTIES[].movementCost` (Grassland:1.0, Forest:1.5, Mountain:3.0, Desert:2.0). 2 new pathfinding tests — 2026-03-19
- [DONE] A2: Unit satiation field — `satiation: number` on Unit interface (default 1.0), `satiationValue` and `isDrink` on ResourceProperties, food values (Fish:0.40, Bread:0.60, Meat:0.80, Fruit:0.35, Cheese:0.55, Wine:0.30, Beer:0.25) — 2026-03-19
- [DONE] A3: Night gameplay hook — `currentNightness` stored from AtmosphereController callback, `getNightness()` public getter — 2026-03-19
- [DONE] A4: 17 new resource types — Raw (Grapes, Fruit, WaterBarrel, Milk, Hay, Wool, RawLeather), Processed (Wine, Beer, Cheese, Cloth, WorkedLeather, Arrows, Bow, SiegeRam), Animals (Cattle, Horses). Total: 44 resources — 2026-03-19
- [DONE] A5: 20 new unit types — 14 civilian (Orchardist, Vintner, Winemaker, Brewer, Dairymaid, CheeseMaker, Tanner, Weaver, CharcoalBurner, Fletcher, Engineer, Stablehand, Rancher, Shepherd), 4 military (Archer, Cavalry, SiegeOperator, Scout), 2 transport (Donkey, HorseTransport). Total: 39 units — 2026-03-19
- [DONE] A6: 22 new building types — Food (Well, Orchard, Vineyard, Winery, Brewery, DairyFarm, CheeseMaker, Hayfield), Crafting (Tannery, WeaversHut, CharcoalBurner, FletchersWorkshop, SiegeWorkshop, Stable, CattleRanch, SheepFarm, Butchery), Military (Fortress, ArcheryRange, TorchTower), Special (InnTavern, Market). Full production recipes. Total: 49 buildings — 2026-03-19
- [DONE] B1: FeedingManager — satiation decay (base 0.005/s, 1.2x working, 0.5x garrisoned), periodic feeding from Castle/Warehouse (5s interval), hunger multiplier helpers. 8 tests — 2026-03-19
- [DONE] B4: MoraleManager — rolling 5-min drink event window, getMorale() = base(0.5) + variety + volume + gold, production/combat multipliers. 9 tests — 2026-03-19
- Save version bumped to 10, backward compat for satiation field. AssetLoader, BuildingModels, UnitModels, BuildingRenderer all updated with new types. Balance constants for hunger/night/morale added. 637 tests passing.

### Expansion Phase C-D: Content Integration + UI [DONE]
- [DONE] C1: StatsPanel resource lists — Added 14 raw (Grapes, Fruit, WaterBarrel, Milk, Hay, Wool, RawLeather, Cattle, Horses) and 8 processed (Wine, Beer, Cheese, Cloth, WorkedLeather, Arrows, Bow, SiegeRam) to RAW_RESOURCES/PROCESSED_RESOURCES arrays — 2026-03-19
- [DONE] C2: ResourcePriorityPanel — Added all 17 new resources to ALL_RESOURCES in logical display order (core raw, expansion raw, ores, military, expansion processed, tools, animals) — 2026-03-19
- [DONE] C3: AI build order updates — Aggressive: added FletchersWorkshop, ArcheryRange, Fortress. Balanced: added Well, Brewery, Hayfield, DairyFarm, CheeseMakerBuilding, InnTavern. Economic: added Orchard, Vineyard, Winery, CattleRanch, SheepFarm, Tannery, WeaversHut, Stable, Market — 2026-03-19
- [DONE] C4: InfoPanel satiation display — Worker satiation bar (green >75%, amber 25-75%, red <25%) with live percentage updates — 2026-03-19
- [DONE] D5: Morale HUD indicator — Shield icon + percentage in game controls bar, color-coded (green >=70%, red <40%). 1-second update interval — 2026-03-19
- [DONE] D6: StatsPanel morale section — Military tab: morale bar, production/combat bonus percentages, drink supply count. Population tab: average satiation bar with color coding — 2026-03-19
- [DONE] D7: Production chain verification tests — 11 tests: DAG validity (all inputs have producers), 7 specific chain verifications (Hay→Milk→Cheese, Cattle→Meat+Leather, Charcoal, Vineyard→Wine, Beer morale chain, Wool→Cloth, Fletcher, Stable, SiegeWorkshop), producer coverage — 2026-03-19
- 648 tests passing, build clean, lint clean.

### Expansion Phase E: Military Expansion [DONE]
- [DONE] E1: Scout Unit — Scout UnitType with 12-hex visionRadius, 2.0 moveSpeed, 0.2 combatStrength, empty recruitmentItems (serf promotion). FogOfWarManager now uses UNIT_DEFINITIONS visionRadius for all unit types — 2026-03-20
- [DONE] E2: Archer + Ranged Combat — Archer UnitType with 3-hex attackRange, 0.6 combatStrength, Bow+Arrows recruitment. ArcheryRange building auto-recruits Archers. CombatManager extended for all military unit types (not just Knight) — 2026-03-20
- [DONE] E3: Cavalry + Charge — Cavalry UnitType with 1.3 combatStrength, 1.3 chargeMultiplier (first engagement), 1.8 moveSpeed, Horse+Sword+Shield recruitment. Barracks/Fortress prioritize Cavalry over Knight when Horse available. Charge bonus in CombatManager — 2026-03-20
- [DONE] E4: Siege Operator + Building Damage — SiegeOperator UnitType with 3.0 buildingDamage, 0.5 combatStrength, SiegeRam recruitment. Building.hp field added (default 1.0). CombatManager.applySiegeDamage() reduces building HP. AttackManager siege logic bypasses defenders to damage building directly — 2026-03-20
- [DONE] E5: Fortress Integration — Verified 20 knightSlots, influenceRadius 10, visionRadius 12. Fortress/Barracks recruit Cavalry → Siege → Knight by priority. AttackManager accepts all military types for attack orders — 2026-03-20
- UnitDefinition extended with combatStrength, attackRange, visionRadius, buildingDamage, chargeMultiplier, recruitmentItems. KnightManager refactored for type-aware recruitment. SaveLoad backward compat for building hp field. 21 new tests, 669 total passing.

### Expansion Phase F: Polish & UI Integration [DONE]
- [DONE] F1: AI military adaptation — AIPlayer.getAvailableKnights() now includes all military unit types (Knight, Archer, Cavalry, SiegeOperator, Scout) for attack orders — 2026-03-20
- [DONE] F2: Tooltip satiation — Building tooltips show worker satiation percentage with color coding — 2026-03-20
- [DONE] F3: Tooltip garrison details — Military building tooltips show unit type breakdown (e.g., "2 Knights, 1 Cavalry") instead of just count — 2026-03-20
- [DONE] F4: InfoPanel garrison labels — Military building info panel shows unit type names (Knight/Archer/Cavalry/etc.) instead of generic "Knight" for all — 2026-03-20
- [DONE] F5: StatsPanel military breakdown — Military tab shows unit counts by type (Knights, Archers, Cavalry, etc.) and badge counts all military types — 2026-03-20
- 669 tests passing, build clean, lint clean.

### Expansion Phase G: 3D Models [DONE]
- [DONE] G1: 22 building GLB models — Well, Orchard, Vineyard, Winery, Brewery, Dairy Farm, Cheese Maker, Hayfield, Tannery, Weavers Hut, Charcoal Burner, Fletchers Workshop, Siege Workshop, Stable, Cattle Ranch, Sheep Farm, Butchery, Fortress, Archery Range, Torch Tower, Inn/Tavern, Market — 2026-03-20
- [DONE] G2: 20 unit GLB models — 14 civilian professions + Archer, Cavalry, Siege Operator, Scout, Donkey, Horse Transport — 2026-03-20
- [DONE] G3: 28 resource GLB models — 17 expansion resources + 11 tool types — 2026-03-20
- [DONE] G4: 17 resource icons for StatsPanel/PriorityPanel (colored SVG circles) — 2026-03-20
- Generation script at scripts/generate_expansion_models.py. Low-poly stylized models, 1-34 KB each.

### Expansion Phase H: Advanced Transport [DONE]
- [DONE] H1: Multi-carry cargo — Unit.cargo[] array alongside carryingResource (synced), carryCapacity on UnitDefinition (Transporter=1, Donkey=3, HorseTransport=8) — 2026-03-20
- [DONE] H2: Road quality system — Road.quality 0-3 (Path/Dirt/Stone/Paved), RoadNetwork.upgradeRoad(), upgrade costs in balanceConstants — 2026-03-20
- [DONE] H3: Transport spawning — Road quality determines transport type (0→foot, 1+→Donkey, 3→HorseTransport) — 2026-03-20
- [DONE] H4: Road upgrade UI — Flag InfoPanel + Building InfoPanel show connected roads with upgrade buttons, cost display, affordability — 2026-03-20
- [DONE] H5: Road visual tiers — Quality-based color (#c4a060→#b08840→#909090→#707878), radius (0.035→0.065), auto-rebuild on upgrade — 2026-03-20
- 13 transport tests, 682 total passing. SaveLoad v11 with cargo/quality backward compat.

### Expansion Phase I: Animal Lifecycle [DONE]
- [DONE] I1: AnimalLifecycleManager — Age tracking, hunger timer, periodic feeding from Castle/Warehouse, starvation death, cargo drop on death — 2026-03-20
- [DONE] I2: Animal specs — Donkey (feed Hay/Grain every 120s, lifespan 20min, starve at 60s), HorseTransport (feed every 90s, lifespan 15min, starve at 45s) — 2026-03-20
- [DONE] I3: Integration — Game.ts update loop, SaveLoad serialization, backward compat for animalAge/animalHungerTimer fields — 2026-03-20
- 11 animal lifecycle tests, 693 total passing.

### Expansion Phase J: Balance Tuning [DONE]
- [DONE] J1: Mining bottleneck fix — Iron/Coal Mine 30s→40s (1 fisherman sustains 2 mines) — 2026-03-20
- [DONE] J2: Food chain speedup — Windmill 15s→10s, Bakery 18s→14s (bread chain 58s→49s) — 2026-03-20
- [DONE] J3: Transport speed — Transporter 0.55→0.70 hex/s (27% faster logistics) — 2026-03-20
- [DONE] J4: Hard AI rebalance — Attack threshold 8→10, attack interval 8s→12s — 2026-03-20
- [DONE] J5: Morale scaling — MORALE_MULTIPLIER_SCALE 0.6→0.8 (+32% max bonus) — 2026-03-20
- [DONE] J6: Late-game economy — Gold Mine 35s→28s, Goldsmith 25s→20s, Stable 40s→28s — 2026-03-20
- 693 tests passing.

## Completed
- **2026-03-19**: Population Management System — 10 phases. PopulationManager (stateless query), spawn gating on UnitManager/TransporterManager/ConstructionManager, 3 housing buildings (Small/Medium/Large House), HUD population counter with color states, Housing build tab, enhanced Stats Population tab, AI reactive housing, difficulty-based starting resources, save/load v9, 3 Blender house models. 1 new file, 27 modified, 3 GLB assets. 615 tests passing.
- **2026-03-12**: Polish Phase — Ambient Life, Military Visibility, Economy UX, Performance. 13 new files created, 12 files modified. ParticleSystem (smoke/sparks/dust), BuildingAnimator (windmill/furnace/sawmill/construction/destruction), TreeSwayShader (GPU wind), PlayerColors (shared), Knight visuals (faction color + rank chevrons + Fighting state), CombatAnimationState + CombatRenderer (duel phases, attack warnings, capture banners), GoodsDistribution (priority routing), TooltipController (hover/long-press tooltips), BuildingStatusOverlay (icon sprites), EconomyTracker (production/consumption rates), ProductionChainOverlay (supply chain lines), Minimap enhancements (unit dots + construction), Pathfinding binary heap optimization. 16 new tests, 496 total passing.
- **2026-03-12**: Building scale coherence fix. 12 buildings now have per-model scale factors in BUILDING_SCALE (4 mines at 2.5×, 7 undersized buildings at 1.5–2.0×, 4 mid-tier at 1.1–1.2×). Warehouse 0.9× downscale removed. All buildings now have proportional footprints (0.45–0.75 effective range, Castle 1.14 as landmark).
- **2026-03-12**: Distance-based production cycles. Gathering buildings produce slower when far from their harvest terrain (e.g., Woodcutter far from Forest). `harvestTerrain` field on BuildingDefinition, BFS distance calculation with wrapping on HexGrid, distance multiplier in ProductionManager, colored placement preview + info panel enhancements. 17 new tests.
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
- **Distance-based production**: Gathering buildings have `harvestTerrain` field. Distance computed via BFS at placement time. Multiplier formula: `min(3.0, 1.0 + max(0, dist-1) * 0.25)`. Color thresholds: green ≤1.5x, orange ≤2.0x, red >2.0x. Mines on Mountain get distance 0 (perfect). Fisherman adjacent to Water gets distance 1 (perfect). Processing buildings unaffected.
- **Package manager**: npm
- **Node**: v23.9.0

### Building Upgrade System & Storage Enforcement [COMPLETE]
- [DONE] Phase A: Storage enforcement fix — `hasInputSpace()`, backpressure in TransporterManager, capacity checks in LogisticsManager, `transferStorageInputs()` respects output capacity — 2026-03-13
- [DONE] Phase B: Upgrade data model — `BuildingUpgrade.ts` with config registry, 3 upgrade axes (Storage, Production, Workers), effective capacity/speed/worker helpers — 2026-03-13
- [DONE] Phase C: UpgradeManager — lifecycle manager (resource delivery → builder → progress → completion), save/load integration, save version bumped to 4 — 2026-03-13
- [DONE] Phase D: Production enhancements — multi-worker support via `countActiveWorkers()`, speed multiplier from production upgrades, extra worker spawning in UnitManager, extra worker cleanup in GameState.removeBuilding() — 2026-03-13
- [DONE] Phase E: UI upgrade panel — upgrade section in building info panel with level display, effect values, cost buttons, progress bars; CSS styles for upgrade buttons — 2026-03-13
- [DONE] Phase F: AI upgrades — AI tries production and storage upgrades once economy is established (build order index > 8) — 2026-03-13
- [DONE] Phase G: Polish — "Upgrading" status icon in BuildingStatusOverlay, effective capacity in storage full check, upgrade levels and progress in TooltipController — 2026-03-13

### Resource Distribution Fix, Economy Dashboard & Priority Panel [COMPLETE]
- [DONE] Part 1: Fix resource distribution — Added CategoryWeights to GoodsDistribution (production/construction/storage %), LogisticsManager reservation system with per-tick budgets, smart defaults (Wood 50/40/10, Stone 30/60/10, Planks 40/50/10), ConstructionManager sorts Planned buildings by completion %, SaveLoad v5 with backward compat — 2026-03-13
- [DONE] Part 2: Economy Dashboard UI — EconomyPanel.ts renders production/consumption rates per resource with net balance, bottleneck alerts, sparkline canvases; Sparkline.ts canvas utility with retina support; integrated into Stats panel with live 1-second updates — 2026-03-13
- [DONE] Part 3: Resource Priority Settings Panel — ResourcePriorityPanel.ts with per-resource sliders (production/construction/storage), proportional redistribution on change, reset to defaults; new nav drawer item with tune icon; panel wired into main.ts panel management — 2026-03-13

### Full Code Review & Improvement Plan [IN PROGRESS]

#### Phase 1: Fog of War [DONE]
- [DONE] 1A: FogOfWarManager — per-player Uint8Array (Unexplored/Explored/Visible), vision from military buildings (Castle:10, GuardHut:6, Watchtower:10, Barracks:9) + units (2, knights:3), dirty flag BFS recalc, base64 serialization, save version bumped to 6 — 2026-03-13
- [DONE] 1B: FogOfWarRenderer — merged hex geometry overlay (unexplored: 0.92 opacity black, explored: 0.45 opacity), world wrapping, version-tracked rebuild — 2026-03-13
- [DONE] 1C: Integration — UnitRenderer hides enemy units in non-visible hexes, BuildingRenderer hides enemy buildings in unexplored hexes, Minimap fog overlay, TooltipController skips hidden enemies, Game.ts wiring — 2026-03-13

#### Phase 2: Shadows [DONE]
- [DONE] 2A: Blob Shadows — BlobShadowRenderer with canvas radial gradient texture, 2 InstancedMesh draw calls (buildings + units), proportional sizing per building type — 2026-03-13

#### Phase 3: Auto-Road & AI Road Building [DONE]
- [DONE] 3A: AutoRoad system — autoConnectBuilding() BFS pathfinding to nearest connected flag, intermediate flag placement, road building along path — 2026-03-13
- [DONE] 3B: AI Road Building — AIPlayer calls autoConnectBuilding() after every building placement, making AI logistics functional — 2026-03-13
- [DONE] 3C: Road disconnect check — RoadNetwork.wouldDisconnect() BFS connectivity test before removal — 2026-03-13

#### Phase 4: Building Management [DONE]
- [DONE] 4A: Building Demolition — GameState.demolishBuilding() with 50% cost refund, Castle exempt — 2026-03-13
- [DONE] 4B: Pause Production Toggle — productionPaused field on Building, ProductionManager skips paused, LogisticsManager skips routing to paused, grey "Paused" status icon in overlay, backward compat in SaveLoad — 2026-03-13

#### Phase 5: Lighting & Material Improvements [DONE]
- [DONE] 5A: Water Specular Highlights — Blinn-Phong specular term in WaterShader fragment shader (wave-perturbed normals, power 64, warm sun color, 0.4 intensity) — 2026-03-13
- [DONE] 5B: Metal Material Adjustments — Blacksmith/Smelter/Goldsmith meshes get metalness 0.6, roughness 0.4 — 2026-03-13
- [DONE] 5C: Terrain Edge Ambient Occlusion — per-instance color darkening (0.85-1.0) based on elevation relative to neighbors, baked at map generation time — 2026-03-13

#### Phase 6: Post-Processing [DONE]
- [DONE] 6A+B: EffectComposer + Color Grading — PostProcessing.ts with RenderPass, custom ColorGradingShader (warm tint, contrast 1.15, saturation 1.1), OutputPass — 2026-03-13
- [DONE] 6C: Selective Bloom — UnrealBloomPass (threshold 0.85, strength 0.3, radius 0.4), lazily created, togglable via setBloomEnabled() — 2026-03-13

#### Phase 7: Atmosphere System [DONE]
- [DONE] 7A: Time-of-Day Presets — AtmosphereController with 4 presets (Morning/Midday/Evening/Night), smooth lerp transitions, auto-cycle (5min per preset) or manual — 2026-03-13

#### Phase 9: AI Improvements [DONE]
- [DONE] 9A: Strategy Templates — 3 build orders (Aggressive/Balanced/Economic) selected by difficulty (Hard/Normal/Easy) — 2026-03-13
- [DONE] 9B: AI Threat Response — onUnderAttack() sets underThreat flag, halves next attack cooldown — 2026-03-13
- [DONE] 9C: Enhanced Difficulty Scaling — Easy: skips 30% of decision ticks; Hard: sends 2 knights per attack — 2026-03-13

#### Phase 10: Code Quality [DONE]
- [DONE] 10A: Structured Logger — Logger.ts with LogLevel (Debug/Info/Warn/Error), dev=Debug, prod=Warn — 2026-03-13
- [DONE] 10D: Dev Performance Monitor — PerformanceMonitor.ts FPS overlay, dev mode or ?fps URL param — 2026-03-13

#### Phase 11: Gameplay Polish [DONE]
- [DONE] 11B: Idle Serf Counter — Game.getIdleSerfCount() for UI badge — 2026-03-13
- [DONE] 11C: 0.5x Game Speed — Speed cycle now 0.5→1→2→3→0.5 — 2026-03-13
- [DONE] 11D: More Victory Conditions — Timed (most territory at time limit) and Peaceful (100+ goods in storage), with 12 new tests — 2026-03-13

#### Phase 7: Weather & Seasons [DONE]
- [DONE] 7B: Weather Effects — WeatherController with Rain (fast blue-white particles) and Snow (slow drifting white particles), 2000 particle budget, camera-relative spawning — 2026-03-14
- [DONE] 7C: Seasonal Colors — Season-aware TerrainColors (Spring/Summer/Autumn/Winter), getTreeSeasonColor() for shader uniform — 2026-03-14

#### Phase 8: UI/UX Improvements [DONE]
- [DONE] 8B: Build Menu Category Tabs + Hotkeys — Filter tabs (All/Economy/Processing/Military/Logistics) in build panel, keyboard hotkeys (W/F/Q/G/S/B) — 2026-03-14
- [DONE] 8D: Mobile Bottom Sheets — CSS @media (max-width: 768px) transforms panels into bottom sheets with drag handle — 2026-03-14

#### Phase 10: Code Quality (continued) [DONE]
- [DONE] 10B: Save Format Migration System — MIGRATIONS chain (v3→v4→v5→v6), migrateSaveData() applied in load functions, 5 new tests — 2026-03-14
- [DONE] 10C: Asset Loading Retry — loadWithRetry() with 2 retries + exponential backoff (500ms, 1000ms) — 2026-03-14
- [DONE] 10E: Shader Time Manager — ShaderTimeManager singleton replaces duplicate WaterShader/TreeSwayShader patterns — 2026-03-14

#### Phase 11: Gameplay Polish (continued) [DONE]
- [DONE] 11A: Traffic Visualization — Road tubes colored green (carrying goods), sandy (idle), grey (unassigned) — 2026-03-14

#### Phase 2B: Real-Time Shadows [DONE]
- [DONE] 2B: Real-Time Shadows — ShadowQuality (Off/BlobOnly/Low/High), setShadowQuality() on Game, BuildingRenderer.setCastShadow(), MapRenderer.setReceiveShadow(), BasicShadowMap (512px) for Low, PCFSoftShadowMap (1024px) for High — 2026-03-14

#### Phase 8A: main.ts Refactor [DONE]
- [DONE] 8A: main.ts refactored from 1867 → 443 lines (76% reduction), split into 8 focused UI modules: Snackbar (20), NotificationWiring (50), SetupScreen (98), GameOverScreen (110), AppBar (209), StatsPanel (234), BuildPanel (453), InfoPanel (475) — 2026-03-14

#### Phase 8C: Minimap Enhancements [DONE]
- [DONE] 8C: Minimap deposit dots (iron=grey, coal=dark, gold=yellow) + layer toggles (territory/buildings/units/deposits/fog) via setLayerVisible() — 2026-03-14

All 17 tasks from the improvement plan are now complete. 569 tests passing, 0 errors. Build clean, lint clean.

### Flag Streetlight System [DONE]
- [DONE] Flag Light System — FlagLightSystem.ts: nighttime lantern glows atop flag poles (instanced emissive cubes with per-flag flicker), ground glow pools beneath flags (additive-blend radial gradient sprites), subtle warm emissive tint on active buildings. AtmosphereController extended with `nightness` field per preset (Dawn:0.3, Morning:0.0, Midday:0.0, GoldenHour:0.2, Evening:0.6, Night:1.0) and `onNightnessUpdate` callback with interpolation. PostProcessing.setBloomStrength() for dynamic night bloom boost (0.3→0.5). 2 instanced draw calls, zero PointLights. 595 tests passing — 2026-03-16

### Building Demolish UI [DONE]
- [DONE] Add building demolish UI with confirmation dialog and resource refund — 2026-03-17

### Building Priority Controls in Resource Priority Panel [DONE]
- [DONE] Per-building importance UI — Collapsible "Target Buildings (N)" section under each resource card in the Resource Priority Panel. Shows human player's active buildings that consume that resource, with 5 tappable amber dots (22px, touch-friendly) for importance 1-5. Multi-instance buildings labeled "#1", "#2". "Also uses" hint for multi-input buildings. Importance is global per-building (changing from one card updates all cards for that building). Reset clears importance. Night mode color variants. 3 files changed: icons.ts (+chevron_right), ResourcePriorityPanel.ts (+115 lines: getConsumingBuildings, renderImportanceDots, toggle/dot event handling), styles.css (+110 lines). Backend already complete in GoodsDistribution.ts. 607 tests passing — 2026-03-17

### Panel Flickering Fix [DONE]
- [DONE] Fix panel flickering with PanelUpdater dual-path rendering — 2026-03-18
  - **Root cause**: InfoPanel (500ms), StatsPanel (1000ms), BuildPanel (1000ms) all rebuilt entire DOM via `innerHTML` every tick, destroying and recreating all DOM nodes regardless of what actually changed. Caused visible flickering, scroll position loss, CSS transition re-triggers, and broken hover/focus states.
  - **Fix**: Created shared `PanelUpdater` class (`src/ui/PanelUpdater.ts`, ~60 lines) with dual-path rendering: compares a structure key each tick — full rebuild only when panel structure changes (rare), targeted value patches via `data-field` attributes otherwise (common). Scroll position preserved on full rebuilds.
  - **InfoPanel**: `getInfoStructureKey` captures building state, construction resources, production progress visibility, geologist phase, knight count, inventory keys, upgrade states. `updateInfoValues` patches ~25 data-field elements (progress bars, amounts, capacity, upgrade status).
  - **StatsPanel**: `getStatsStructureKey` captures unit types, building types, constructing flag, knight presence, economy active resources, bottleneck count. `updateStatsValues` patches ~30 fields. Sparklines only redrawn on full rebuilds via `afterRebuild` callback.
  - **BuildPanel**: Structure key is just `buildFilterCategory`. `updateBuildValues` toggles affordability classes on building buttons and cost pills.
  - **EconomyPanel**: Added `data-field` attributes to rate spans and bottleneck alert for targeted patching by StatsPanel.
  - 5 files changed (1 new), 607 tests passing, build clean, lint clean.

### Logistics Deadlock Fix [DONE]
- [DONE] Fix game stuck state caused by Castle flag monopolization — 2026-03-17
  - **Root cause**: Castle flag perpetually full (8/8) with wood+stone bound for Warehouse, blocking coal_ore/fish/iron_ore from reaching production buildings (Iron Smelter starved → no iron_bars → no weapons → no knights)
  - **Fix 1** (LogisticsManager `routeOutputGoods`): Reserve upper half of flag capacity for production-bound goods — storage routing blocked when flag ≥50% full. Per-resource cap lowered from 4 to 2.
  - **Fix 2** (TransporterManager `deliverStrandedGoods`): Rewritten with per-resource caps (inputSpec.amount × 2) to prevent one resource hogging all input capacity. Phase 2 discards surplus stranded goods.
  - **Fix 3** (TransporterManager `update`): Moved `rebalanceBlockedInputs()` to end of update cycle to eliminate oscillation with `deliverStrandedGoods`.
  - **Fix 4** (LogisticsManager `cleanupCongestedFlags`): Rewritten with 4-pass priority removal (orphan → storage-bound → stranded → any) to handle all overflow types.
  - 607 tests passing, build clean, lint clean.

### Tech Tree Draggable Nodes [DONE]
- [DONE] Draggable node cards in Tech Tree panel — 2026-03-18
  - **Problem**: Full `innerHTML` rebuild on every hover event reset any moved positions and prevented interactive graph untangling.
  - **Refactor**: Separated position state (`nodePositions` Map) from rendering. Hover now uses DOM class toggling (`applyHoverHighlight()`) instead of full `render()`. SVG edges tagged with `data-from`/`data-to` and midpoints with `data-edge-mid` for incremental updates.
  - **Drag**: Pointer events (`pointerdown`/`pointermove`/`pointerup`) with `setPointerCapture()` for unified mouse+touch. 5px threshold distinguishes click from drag. `updateEdgesForNode()` recomputes only connected Bezier paths during drag. Canvas auto-grows when nodes dragged beyond bounds.
  - **State lifecycle**: Positions reset on filter change and panel open. Preserved across hover events. Document-level listeners cleaned up on panel close.
  - **CSS**: `.techtree-node` cursor changed to `grab`. New `.techtree-node-dragging` class (grabbing cursor, z-index:10, no transition, elevated shadow).
  - 2 files changed (`TechTreePanel.ts`, `styles.css`), 607 tests passing, build clean, lint clean.

### Weather Effects Overhaul [DONE]
- [DONE] GPU-driven weather shaders — WeatherController rewritten with custom vertex/fragment shaders for rain (elongated streaks, wind drift, ground splash rings) and snow (organic multi-sine drift, size variation, twinkling alpha pulse). Camera-relative spawning via uCamPos uniform. ShaderTimeManager integration for uTime. Smooth fade transitions (2s) between weather states. — 2026-03-19
- [DONE] Weather atmosphere overlay — Rain/snow modulate fog density, sun intensity, exposure, and color grading (saturation reduction + cool tint shift) proportional to transition opacity. Base values cached and restored each frame before atmosphere update. — 2026-03-19
- [DONE] Auto weather scheduling — When time-of-day is "Auto" and weather is "None", WeatherController auto-schedules random weather events. State machine: 90–240s gap → pick rain/snow (nightness > 0.5: 60% snow, else 80% rain) → 60–180s duration → fade out → repeat. Manual weather selection disables auto-scheduling. Game.ts passes nightness from AtmosphereController each frame. — 2026-03-19

### Population Management System [DONE]
- [DONE] Phase 1: Data Model — `populationCapacity` field on BuildingDefinition (all 27 buildings), `pendingDismissal` on Unit, `housing` BuildingCategory, 3 new building types (SmallHouse +8 cap, MediumHouse +16 cap, LargeHouse +25 cap), Castle base capacity 15. Balance constants + difficulty-based starting resources (Easy/Normal/Hard). — 2026-03-19
- [DONE] Phase 2: PopulationManager — Stateless query object: `getCapacity()`, `getCurrentPopulation()`, `canSpawn()`, `getAvailableSlots()`, `getUsageRatio()`. Integrated into Game.ts constructor. — 2026-03-19
- [DONE] Phase 3: Spawn Gating — UnitManager, TransporterManager, ConstructionManager all check `canSpawn()` before spawning. `dismissUnit()` API with `pendingDismissal` flow (walk home → return tool → remove). `releaseTransporter()` for transporter cleanup. Throttled `onPopulationCapReached` callback (30s cooldown). — 2026-03-19
- [DONE] Phase 4: HUD Population Counter — `pop-counter` in game controls bar showing `current/capacity` with color states (green <75%, amber 75-90%, red >90%). 1-second update interval with proper cleanup. — 2026-03-19
- [DONE] Phase 5: Housing UI — Housing tab in desktop/mobile build toolbar. Enhanced Population tab in StatsPanel with capacity bar, housing breakdown, idle count, unit roster. — 2026-03-19
- [DONE] Phase 6: Notifications — `population_cap` notification type wired to SFX + snackbar. Fires on spawn blocked and housing destroyed (when over cap). — 2026-03-19
- [DONE] Phase 7: AI Adaptation — Houses in all 3 build orders (SmallHouse early, MediumHouse mid, LargeHouse late). Reactive `checkHousingNeeds()` builds best affordable house when usage >= 80%. — 2026-03-19
- [DONE] Phase 8: Difficulty Resources — `CASTLE_STARTING_RESOURCES_BY_DIFFICULTY` with Easy (generous) / Normal (default) / Hard (scarce) resource sets. `initializeCastleResources()` accepts `Difficulty`. — 2026-03-19
- [DONE] Phase 9: Save/Load — Version bumped to 9. Backward compat patch for `pendingDismissal` field. Old saves work (no houses but Castle provides capacity). — 2026-03-19
- [DONE] Phase 10: 3D Models — 3 house GLBs created via Blender MCP (Small House 11KB, Medium House 14KB, Large House 16KB). AssetLoader, BuildingModels, BuildingRenderer scale entries. Visual descriptions added to docs/buildings.md. — 2026-03-19

### Statistics Dashboard [DONE]
- [DONE] Phase 1: DashboardTracker data layer — RingBuffer (Float32Array-backed circular buffer), DashboardTracker class (30s snapshots, 120 points = 60min history), tracks population, capacity, satiation, morale, military count/rank, per-resource stock levels, building efficiency (5 categories). EconomyTracker MAX_HISTORY bumped 10→120, added getGameTime() getter. Game.ts wiring. 10 tests. — 2026-03-20
- [DONE] Phase 2: ChartRenderer — Canvas-based chart rendering (DPI-aware, theme-aware): drawLineChart (multi-series, area fill, grid, labels, zero-line), drawDualBarChart (production vs consumption horizontal bars), drawDonutChart (efficiency visualization with center text), generateTimeLabels helper. — 2026-03-20
- [DONE] Phase 3: DashboardPanel — Fullscreen overlay (TechTree pattern) with 5 tabs: Overview (KPI cards, dual bars, pop chart, efficiency donut, bottleneck alerts), Economy (timescale selector, resource filter, dual bars, click-to-drill rate chart), Resources (stock levels line chart top 5, inventory table with trends), Population (pop/morale charts, hunger stats, unit breakdown), Buildings (efficiency donut with legend, status table, construction progress). — 2026-03-20
- [DONE] Phase 4: Integration — Dashboard overlay div in HTML, toolbar button, nav drawer item, StatsPanel/AppBar wiring, 120 lines CSS (responsive: mobile single-column, bottom tabs, 48px touch targets). Day/night theme support. — 2026-03-20

### Balance Tool — Help & Tutorial System [DONE]
- [DONE] Help content data — HELP_CONTENT object with structured help for all 6 tabs (production, combat, economy, hunger, starting, morale): purpose, numbered workflow, results interpretation, tips. — 2026-03-20
- [DONE] Rich help cards — renderHelpCard() generates styled cards (accent border, workflow steps, term/desc pairs, tip box) replacing one-liner placeholders in all 6 tabs. Cards naturally disappear when simulation runs. — 2026-03-20
- [DONE] Header help button + modal — Circular `?` button in header opens modal with current tab's help content. Click-outside and Escape to dismiss. Available after results replace placeholder. — 2026-03-20
- [DONE] Morale auto-calculate removed — setTimeout auto-calculate removed so help card stays visible until user clicks "Calculate", consistent with all other tabs. — 2026-03-20

## Blockers
_None._
