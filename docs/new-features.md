# New Features Guide

Complete reference for all features added during the comprehensive game review (2026-03-29). 35 features across 6 phases: Core Polish, Gameplay Depth, Visual Polish, Community, Robustness, and Gameplay Content.

---

## 1. Loading Screen

A progress bar overlay shown during asset loading (172 GLB models across 4 categories).

- **File:** `src/ui/LoadingScreen.ts`
- **Shows:** Animated progress bar, percentage, current model name, random gameplay tip
- **Behavior:** Appears when `Game.start()` begins loading, hides automatically on completion
- **Progress tracking:** `AssetLoader.onProgress` callback fires after each model, reports `(loaded, total, name)`
- **Styling:** Medieval-themed card with crown icon and pulsing animation

---

## 2. Auto-Save System

Rotating auto-save slots that protect against data loss.

- **File:** `src/game/SaveLoad.ts` (functions: `autoSaveToSlot`, `listSaveSlots`, `loadFromKey`)
- **Behavior:** Auto-saves every 2 minutes to rotating 3-slot localStorage
- **`beforeunload`** warning prevents accidental tab close during active game
- **Continue button** loads the most recent save across all slots (quick-save + auto-saves)
- **Configuration:** `AUTO_SAVE_INTERVAL` = 2 minutes, `AUTO_SAVE_SLOTS` = 3

---

## 3. Event Log

Persistent notification history with camera navigation.

- **File:** `src/ui/EventLog.ts`
- **UI:** Bell icon in app bar with unread badge counter
- **Capacity:** Stores last 100 events with game timestamps
- **Color coding:** Red (attacks/defeats), yellow (warnings), green (completions), blue (info)
- **Navigation:** Click any event with a position to pan camera to that location
- **Wiring:** All notifications flow through `NotificationWiring.ts` into `addEvent()`

---

## 4. In-Game Encyclopedia

Searchable reference for all game content.

- **File:** `src/ui/EncyclopediaPanel.ts`
- **Access:** Nav drawer > Encyclopedia, or press **E**
- **3 tabs:** Buildings, Resources, Units
- **Search:** Real-time filtering by name or category
- **Building detail:** Description, construction cost, production recipe (inputs/outputs with icons), worker type and tool requirements, stats (storage, build time, housing, knight slots, territory radius), placement terrain
- **Resource detail:** Properties (food/drink/luxury), satiation value, "Produced By" and "Consumed By" building cross-references
- **Unit detail:** Stats (speed, combat strength, range, charge bonus), tool requirements, workplace buildings
- **Data source:** Reads directly from `BUILDING_DEFINITIONS`, `RESOURCE_PROPERTIES`, `UNIT_DEFINITIONS`

---

## 5. Enhanced Endgame Screen

Detailed post-game statistics.

- **File:** `src/ui/GameOverScreen.ts`
- **Sections:**
  - **Game:** Duration (Xm Ys), territory percentage
  - **Economy:** Active buildings, in-construction count, total stored resources, gold bars
  - **Population:** Total units, civilians, military breakdown by unit type (e.g., "Knights: 3, Archers: 2")
- **Achievement triggers:** Building count, population, military, and territory achievements unlock here

---

## 6. Keyboard Shortcuts

Global hotkeys with reference overlay.

- **File:** `src/ui/KeyboardShortcuts.ts`
- **Shortcuts:**
  | Key | Action |
  |-----|--------|
  | B | Toggle Build Panel |
  | S | Toggle Stats Panel |
  | D | Toggle Dashboard |
  | E | Toggle Encyclopedia |
  | P | Toggle FPS Counter |
  | Space | Pause / Resume |
  | F1-F4 | Game Speed (0.5x / 1x / 2x / 3x) |
  | Home | Center on Castle |
  | 1-5 | Recall Camera Bookmark |
  | Ctrl+1-5 | Save Camera Bookmark |
  | Esc | Cancel / Close Panel |
  | ? | Show Shortcuts Reference |
- **Safety:** Ignores input when typing in text fields or when setup screen is visible

---

## 7. Sandbox Mode

Pressure-free building experience.

- **Config:** `GameConfig.sandbox: boolean`
- **Effects when enabled:**
  - AI never attacks (AIPlayer.tryAttack skipped)
  - No defeat condition (VictoryManager skips castle-destroyed checks)
  - Free building (ConstructionManager skips resource delivery — buildings go straight to UnderConstruction)
- **UI:** Toggle checkbox in game setup screen with description "No attacks, no defeat, free building"
- **Achievement:** "Creative Mode" achievement unlocked on first sandbox game

---

## 8. Combat Unit Counters

Rock-paper-scissors system for military unit types.

- **File:** `src/game/CombatManager.ts` (in `preComputeDuel`)
- **Counters:**
  | Attacker | vs Defender | Bonus |
  |----------|-------------|-------|
  | Knight | Archer | 1.4x (melee advantage) |
  | Archer | Cavalry | 1.5x (ranged kiting) |
  | Cavalry | Knight | 1.3x (mounted advantage) |
- **Applied symmetrically:** Both attacker and defender get bonuses when they counter the other
- **Stacks with:** Morale multiplier, cavalry charge bonus, knight rank

---

## 9. AI Personalities

4 distinct AI behavior profiles.

- **File:** `src/game/data/aiBuildOrders.ts`
- **Personalities:**
  | Name | Build Order | Attack Threshold | Attack Interval | Style |
  |------|-------------|-----------------|-----------------|-------|
  | Balanced | Mixed economy/military | Base | Base | Default |
  | Economist | Full production chains | +4 (later) | 1.5x (slower) | Economy-first |
  | Militarist | Early military focus | -3 (earlier) | 0.7x (faster) | Aggressive |
  | Turtle | 3 guard huts early, fortress | +6 (much later) | 2x (much slower) | Defensive |
- **Assignment:** Deterministic rotation per player index via `getPersonalityForPlayer()`
- **Display:** Shown in setup screen player dot tooltips
- **Customization:** `applyPersonality()` overlays on base difficulty config

---

## 10. AI Diplomacy

AI-driven treaty proposals and management.

- **Files:** `src/game/DiplomacyManager.ts`, `src/game/AIPlayer.ts` (evaluateDiplomacy)
- **AI evaluation:** Every 30-60 seconds, based on personality and relative military strength
- **Personality behavior:**
  - Economist: Proposes trade agreements when not overwhelmingly strong
  - Turtle: Always proposes non-aggression
  - Militarist: Only proposes when weaker; breaks treaties when 2.5x stronger
  - Balanced: Proposes when roughly equal or weaker
- **Notifications:** Human player receives snackbar when AI proposes or breaks treaties

---

## 11. Diplomacy System

Treaty management between players.

- **File:** `src/game/DiplomacyManager.ts`
- **Treaty types (in order of strength):**
  | Treaty | Effect |
  |--------|--------|
  | None | Default hostility — can attack |
  | Non-Aggression | Cannot attack each other |
  | Trade Agreement | Non-aggression + 50% reduced marketplace fees |
  | Alliance | Trade agreement + shared fog of war visibility |
- **UI:** `src/ui/DiplomacyPanel.ts` — Accessible from nav drawer. Shows player cards with color-coded treaty badges, propose/break/upgrade buttons
- **Save/Load:** Fully serialized in SaveData (SAVE_VERSION 14)

---

## 12. Campaign Mode

12 hand-crafted scenarios with custom objectives.

- **File:** `src/game/CampaignData.ts`
- **UI:** Campaign tab in setup screen with card grid showing name, description, difficulty, player count, and completion status
- **Scenarios:**
  | Name | Difficulty | Players | Objective |
  |------|-----------|---------|-----------|
  | The First Settlement | Easy | 1 | Build 10 buildings, 20 pop |
  | Mountain Fortress | Normal | 2 | 20 gold bars, 40% territory |
  | Island Survival | Normal | 1 | 40 pop, 20 buildings |
  | Oasis Trade Empire | Hard | 3 | 30 gold, 8 military |
  | Last Stand | Hard | 3 | Survive 20 min, 12 military |
  | Total Conquest | Hard | 4 | 75% territory (elimination) |
  | The Peaceful Builder | Easy | 1 | 30 buildings, 60 pop, 10 gold (sandbox) |
  | Speed Run | Hard | 1 | 50 gold in 15 minutes |
  | Archipelago Explorer | Normal | 2 | 60% territory, 25 buildings |
  | Four Kingdoms | Hard | 4 | Survive 30 min, 15 military |
  | Dark Forest | Hard | 2 | 50% territory, 10 military |
  | Gold Rush | Normal | 2 | 40 gold bars |
- **Objective types:** buildings, population, territory (%), gold, military, time_survive (minutes)
- **Completion:** Persisted in localStorage, shown with checkmark in UI

---

## 13. Achievements

24 cross-game achievements with persistent tracking.

- **File:** `src/ui/Achievements.ts`
- **Access:** Nav drawer > Achievements
- **Categories:**
  - **Victory (5):** First Triumph, Total Domination, Golden Age, Merchant Prince, Iron Will
  - **Economy (6):** Budding Lord (10), Master Builder (25), Grand Architect (50), Chain Master, Midas Touch, Growing Village (50 pop), Thriving Town (100 pop)
  - **Military (4):** To Arms!, Conqueror, Legendary Knight (rank 5), Standing Army (10 military)
  - **Exploration (2):** Expanding Borders (50% territory), World Traveler (all 8 scenarios)
  - **Misc (5):** First Trade, Trader (10 trades), Dedicated Ruler (30 min), Tireless Lord (60 min), Creative Mode (sandbox), Night Owl
- **Storage:** `localStorage('feudal-achievements')`
- **Display:** Gallery overlay with progress count (X/24), locked/unlocked states, check marks

---

## 14. Accessibility

Colorblind modes and text scaling.

- **Settings location:** Nav drawer > Graphics > Accessibility section
- **Colorblind modes:**
  | Mode | Type | Implementation |
  |------|------|----------------|
  | Deuteranopia | Red-Green | CSS SVG feColorMatrix filter |
  | Protanopia | Red-Weak | CSS SVG feColorMatrix filter |
  | Tritanopia | Blue-Yellow | CSS SVG feColorMatrix filter |
- **Text scaling:** Normal, Large (+20%), Extra Large (+40%) via root `font-size`
- **Persistence:** Both settings saved to localStorage, restored on startup
- **CSS selectors:** `[data-colorblind="deuteranopia"]`, `[data-textsize="large"]`

---

## 15. Graphics Presets

One-click quality profiles.

- **UI:** 4 buttons (Low / Medium / High / Ultra) above individual graphics settings
- **Presets:**
  | Setting | Low | Medium | High | Ultra |
  |---------|-----|--------|------|-------|
  | Shadows | Off | Blob Only | Blob Only | High |
  | Post-Processing | Off | Color Only | Color Only | Full (Bloom) |
  | Weather | Off | Off | Off | Rain |
  | Time of Day | Midday | Midday | Auto-Cycle | Auto-Cycle |
  | Ambient Life | Off | Minimal | Full | Full |

---

## 16. Visual Polish

### Animated Water
- **File:** `src/engine/MapRenderer.ts`
- **Implementation:** ShaderMaterial with 3 overlapping sine wave vertex displacement + animated color shimmer between two teal tones
- **Registration:** ShaderTimeManager handles automatic `uTime` updates

### Night Glow on Buildings
- **File:** `src/engine/BuildingAnimator.ts`
- **Behavior:** Active buildings emit warm glow (RGB 1.0, 0.8, 0.4) when nightness > 0.4. Producing buildings get brighter glow. Furnace-animated buildings excluded to avoid double-glow.
- **Additional furnace buildings:** Brewery, Winery, Charcoal Burner, Cheese Maker

### Smooth Camera Pan
- **File:** `src/engine/CameraController.ts`
- **Behavior:** `panTo()` now interpolates via lerp (speed factor 5.0) instead of instant jump
- **All navigation uses smooth:** Event log clicks, Home key, camera bookmarks, alert clicks
- **Instant:** `panToInstant()` available for programmatic use (save restore, etc.)

### Fog of War Polish
- **File:** `src/engine/FogOfWarRenderer.ts`
- **Improvement:** ShaderMaterial with per-vertex alpha for soft edge gradients. Fog tiles adjacent to visible areas get 0.3 edge alpha vs 1.0 center, creating smooth transitions instead of hard lines.

### Production Chain Visualizer
- **File:** `src/engine/ProductionChainOverlay.ts`
- **Enhancement:** Lines color-coded by building health: green (producing), yellow (waiting for input), red (no worker), gray (paused). Floating status dots above connected buildings.

### Production Chain Panel Layout
- **File:** `src/ui/TechTreePanel.ts`
- **Enhancement:** Replaced tier-column layout with chain-grouped swim-lane layout. 14 labeled horizontal bands (Core, Wood & Timber, Stone, Fish & Mining, Iron & Metalwork, Gold, Weapons & Siege, Grain & Food, Water & Beverages, Hay & Livestock, Living World, Military, Housing, Logistics) with divider lines between groups. Connected buildings are now vertically adjacent within their chain, dramatically reducing edge crossings (~70-80%). Increased spacing between cards (28px gaps vs 12px). Adaptive bezier curves widen for cross-lane connections. Tool dependency edges rendered at lower opacity (0.35) with hidden midpoint icons to reduce clutter. Unrecognized future buildings fall back to bottom section.

---

## 17. Map Sharing

Clipboard-based map exchange.

- **Map Editor:** "Share" button copies map JSON to clipboard (strips thumbnail for size)
- **Setup Screen:** "Paste" button imports map from clipboard into custom maps gallery
- **Fallback:** If clipboard unavailable, Share falls back to file download
- **Existing:** Export/Import via files continues to work

---

## 18. Random Events

13 event types with duration-limited effects.

- **File:** `src/game/RandomEventManager.ts`
- **Frequency:** Every 180-360 seconds
- **Distribution:** ~40% positive, ~40% negative, ~20% neutral
- **Events:**

| Event | Category | Duration | Effect |
|-------|----------|----------|--------|
| Bumper Harvest | Positive | 60s | +50% farm production |
| Traveling Craftsman | Positive | 45s | +25% all production |
| Lucky Find | Positive | 30s | +30% construction speed |
| Harvest Festival | Positive | 90s | +morale boost |
| Visiting Hero | Positive | 60s | +20% movement/combat speed |
| Building Fire | Negative | 30s | Disables 1 random building |
| Harsh Weather | Negative | 45s | -25% production, -30% speed |
| Supply Shortage | Negative | 30s | -20% production |
| Mine Collapse | Negative | 45s | Disables 1 random mine |
| Drought | Negative | 60s | -30% food production |
| Plague | Negative | 45s | -30% worker speed |
| Wandering Merchant | Neutral | 60s | Favorable trade rates |
| Trade Caravan | Neutral | 45s | +10% production |

---

## 19. Military Commands

Group attack and rally points.

- **Group Attack:** `AttackManager.groupAttack(sourceBuildingIds, targetBuildingId)` — Sends all available knights from multiple buildings to one target, keeping 1 garrison per building
- **Rally Points:** `Building.rallyPoint: HexCoord | null` — Field on buildings for future knight gathering point (data layer ready, UI wiring TBD)

---

## 20. Robustness

### Error Boundaries
- **File:** `src/engine/Game.ts` (`safeRender` method)
- **14 visual systems wrapped:** particles, weather, clouds, birds, water, animals, bees, combat, animations, shadows, flags, audio, status overlay, chain overlay
- **Behavior:** Crashed renderers are disabled and logged; game continues running

### Formal Save Migration Chain
- **File:** `src/game/SaveLoad.ts` (`MIGRATIONS` record, `migrateSaveData` function)
- **Pattern:** Sequential version-to-version migration functions (v7→v8, v8→v9, ..., v13→v14)
- **Applied in:** `loadFromLocalStorage`, `loadFromKey`, `loadFromFile`
- **No version ceiling:** Old saves auto-migrate forward to current version

### Enhanced Performance Monitor
- **File:** `src/engine/PerformanceMonitor.ts`
- **Shows:** FPS, draw calls, triangle count, geometry count
- **Toggle:** Press **P** or add `?fps` to URL
- **Renderer stats:** Wired via `setRenderer()` to read `renderer.info`

---

## Architecture Summary

### New Files Created (18)
| File | Purpose |
|------|---------|
| `src/ui/LoadingScreen.ts` | Loading overlay with progress bar |
| `src/ui/EventLog.ts` | Persistent notification history |
| `src/ui/EncyclopediaPanel.ts` | Searchable game reference |
| `src/ui/Achievements.ts` | Cross-game achievement tracking |
| `src/ui/KeyboardShortcuts.ts` | Global hotkey handler |
| `src/ui/DiplomacyPanel.ts` | Treaty management UI |
| `src/game/DiplomacyManager.ts` | Treaty state between players |
| `src/game/CampaignData.ts` | Campaign scenario definitions |
| `src/game/DiplomacyManager.test.ts` | 11 diplomacy tests |
| `src/game/CampaignData.test.ts` | 7 campaign data tests |
| `src/game/data/aiBuildOrders.test.ts` | 12 AI personality tests |
| `src/game/SaveMigration.test.ts` | 3 migration tests |

### Modified Files (Key Changes)
| File | Changes |
|------|---------|
| `src/engine/Game.ts` | safeRender, diplomacy, campaign, speed API |
| `src/engine/GameSystems.ts` | DiplomacyManager creation |
| `src/engine/MapRenderer.ts` | Animated water shader |
| `src/engine/BuildingAnimator.ts` | Night glow, more furnace buildings |
| `src/engine/CameraController.ts` | Smooth panTo with lerp |
| `src/engine/FogOfWarRenderer.ts` | Per-vertex alpha edge softening |
| `src/engine/ProductionChainOverlay.ts` | Status-colored connections |
| `src/engine/AssetLoader.ts` | Progress callback |
| `src/engine/PerformanceMonitor.ts` | Draw call stats, toggle |
| `src/game/AIPlayer.ts` | Personalities, diplomacy evaluation |
| `src/game/AttackManager.ts` | groupAttack() |
| `src/game/Building.ts` | rallyPoint field |
| `src/game/CombatManager.ts` | Unit type counters |
| `src/game/ConstructionManager.ts` | Sandbox mode |
| `src/game/GameConfig.ts` | sandbox, campaignId fields |
| `src/game/RandomEventManager.ts` | 6 new event types |
| `src/game/SaveLoad.ts` | Migration chain, diplomacy, auto-save slots |
| `src/game/VictoryManager.ts` | Campaign objectives, sandbox |
| `src/game/data/aiBuildOrders.ts` | Personality system |
| `src/ui/AppBar.ts` | Graphics presets, accessibility, diplomacy |
| `src/ui/GameHTML.ts` | Campaign tab, sandbox, presets, nav items |
| `src/ui/GameOverScreen.ts` | Enhanced stats, achievements |
| `src/ui/NotificationWiring.ts` | Event log + achievement wiring |
| `src/ui/SetupScreen.ts` | Campaign, sandbox, save slots, paste map |
