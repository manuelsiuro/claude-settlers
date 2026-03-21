# Developer Tools

Feudal Realm Manager ships two standalone browser tools for game tuning and asset management. Neither requires a build step — they run as plain HTML with CDN dependencies.

---

## 1. Game Balance Tool

An interactive simulator and constant editor for tuning the game's economy, combat, hunger, morale, and production chains.

### Quick Start

```bash
# 1. Regenerate tool data from game source (run after changing game definitions)
npm run balance-data

# 2. Start the dev server
npm run dev

# 3. Open in browser
open http://localhost:5173/tools/balance-tool.html
```

The tool can also be opened directly as a file (`tools/balance-tool.html`) since it has no build dependencies.

### Files

| File | Purpose |
|------|---------|
| `tools/balance-tool.html` | Standalone UI (HTML + inline JS + CDN Tailwind/Chart.js) |
| `tools/balance-data.json` | Generated game data consumed by the tool |
| `tools/generate-balance-data.ts` | Script that reads game source and writes `balance-data.json` |
| `src/game/data/balanceConstants.ts` | Master constant definitions (source of truth) |
| `src/game/data/BalanceConfigLoader.ts` | Runtime loader for exported overrides |
| `public/balance_config.json` | Runtime override file (deployed with the game) |

### Regenerating Data

Run this after editing building definitions, resource types, unit types, or balance constants:

```bash
npm run balance-data
```

This reads from:
- `src/game/data/balanceConstants.ts` — all tunable constants
- `src/game/data/buildingDefinitions.ts` — 50 building types
- `src/game/ResourceType.ts` — 44 resource types
- `src/game/UnitType.ts` — 39 unit types
- `src/game/data/aiBuildOrders.ts` — difficulty configs

And writes `tools/balance-data.json` with constants, buildings, resources, units, roads, starting resources, and difficulty data.

### Tabs

#### Production Chain Simulator
Validate whether a mix of production buildings is sustainable. Pick buildings with count spinners or load presets (Wood Chain, Bread Chain, Iron+Weapons, Full Economy). Set simulation duration (5–60 min) and optionally enable infinite raw resources. Results: resource stock chart, throughput bars, bottleneck table.

#### Combat Simulator
Determine win probability for military duels. Select attacker/defender type, rank (1–5), gold bars, and morale. Runs 10,000 simulated duels. Generates a 5x5 matchup matrix heatmap.

#### Economy Sink/Source Validator
Check if an economy leaks or starves resources. Set population, difficulty, building mix, and toggles for hunger/construction costs. Results: net balance chart, resource stock lines, per-resource status table.

#### Hunger & Feeding Simulator
Calculate how many food buildings are needed for N workers. Set population, working/garrisoned percentages, food buildings, and starting stocks. Results: satiation chart, population status stacked area, summary cards with penalty amounts.

#### Starting Resources Analyzer & Editor
Compare starting resources across difficulties and edit overrides. Editable table with color-coded comparison. Analyze against build order presets. Exports overrides with the main config.

#### Morale & Night Effects
Calculate morale impact and day/night production multipliers. Configure drink types, gold bars, and torch tower coverage. Results: circular morale gauge, formula breakdown, production rate graph across 6 day/night phases.

#### Constants Editor
Edit every tunable game constant in one interface. Organized into 12 sections (Woodcutter, Forester, Combat, Population, Hunger, Night, Morale, Animals, Roads, Victory, Trees, Upgrades). Search box, per-field reset, modified counter. Edits instantly affect all other tab simulators.

### Exporting Changes to the Game

1. Tune constants and starting resources in the tool
2. Click **Export to Game** in the header — downloads `balance_config.json`
3. Place the file at `public/balance_config.json`
4. On game startup, `BalanceConfigLoader` fetches the file, validates its schema, and applies overrides via `applyBalanceOverrides()`
5. Run `npm run build && npm run test` to verify

The export format includes metadata (`generatedAt`), all modified constant sections, and per-difficulty starting resource overrides. Invalid configs fail silently (console warning), and the game falls back to defaults.

---

## 2. Thumbnail Generator

Renders all 134 GLB 3D models (50 buildings, 40 units, 44 resources) into 256px PNG thumbnails used throughout the game UI.

### Quick Start

```bash
# 1. Regenerate model metadata from game source
npm run thumbnail-data

# 2. Start the thumbnail tool server
npm run thumbnail-tool

# 3. Open in browser
open http://localhost:3001
```

### Files

| File | Purpose |
|------|---------|
| `tools/thumbnail_generator/index.html` | Browser UI for rendering and previewing thumbnails |
| `tools/thumbnail_generator/server.ts` | Node.js HTTP server (port 3001) — serves files and saves PNGs |
| `tools/thumbnail_generator/thumbnail-data.json` | Generated metadata (entity list + rendering config) |
| `tools/generate-thumbnail-data.ts` | Script that reads game definitions and writes metadata |

### Source Models

| Category | Directory | Count |
|----------|-----------|-------|
| Buildings | `public/models/buildings/*.glb` | 50 |
| Units | `public/models/units/*.glb` | 40 |
| Resources | `public/models/resources/*.glb` | 44 |

### Output Thumbnails

| Category | Directory | Count |
|----------|-----------|-------|
| Buildings | `public/thumbnails/buildings/*.png` | 50 |
| Units | `public/thumbnails/units/*.png` | 40 |
| Resources | `public/thumbnails/resources/*.png` | 44 |

### Regenerating Thumbnails

**Step 1 — Regenerate metadata** (run after adding/removing models or changing game definitions):

```bash
npm run thumbnail-data
```

This reads building, unit, and resource definitions from game source and writes `tools/thumbnail_generator/thumbnail-data.json` with:
- Entity list (type, label, category, model path)
- Rendering config (size, camera angle, padding, lighting, material constraints)

**Step 2 — Start the server and render:**

```bash
npm run thumbnail-tool
```

Open `http://localhost:3001` in a browser. The UI shows:

- **Grid view** of all models with current thumbnail status
- **Progress bar** showing render/save completion
- **Real-time log** panel
- **Category filter** buttons (Buildings, Units, Resources)
- **Output size** selector (128, 256, 512px)
- **Per-item re-render** button for individual failures

Click **Render All** to process all 134 items sequentially. Each model is:
1. Loaded via Three.js GLTFLoader
2. Auto-framed with an orthographic camera (bounding box fit, particle mesh exclusion)
3. Rendered with normalized materials (metalness capped at 0.3, roughness min 0.5)
4. Exported as PNG and POST'd to the server's `/save-thumbnail` endpoint
5. Written to `public/thumbnails/{category}/{type}.png`

The server requires no npm dependencies — it uses only Node.js built-in modules. The browser tool loads Three.js v0.175.0 via CDN importmap.

### Rendering Configuration

Default settings in `thumbnail-data.json`:

```json
{
  "size": 256,
  "camera": { "angle": [1, 1, 1], "padding": 1.15 },
  "lighting": {
    "ambient": { "color": "#ffffff", "intensity": 0.6 },
    "main": { "color": "#fff5e6", "intensity": 0.9, "position": [5, 8, 5] },
    "rim": { "color": "#aaccff", "intensity": 0.3, "position": [-3, 2, -5] }
  },
  "materials": { "maxMetalness": 0.3, "minRoughness": 0.5 }
}
```

### How Thumbnails Are Used in the Game

Three helper functions in `src/ui/icons.ts` return inline `<img>` tags:

```ts
resourceIcon(type, size)  → /thumbnails/resources/{type}.png
buildingIcon(type, size)  → /thumbnails/buildings/{type}.png
unitIcon(type, size)      → /thumbnails/units/{type}.png
```

These are called across 12 UI files: BuildPanel, InfoPanel, StatsPanel, DashboardPanel, TechTreePanel, EconomyPanel, ResourcePriorityPanel, CapacityAlertBar, DemolishDialog, ToolAlertBar, and more.

### When to Regenerate

- After creating or modifying a 3D model in Blender and exporting to `public/models/`
- After adding a new building, unit, or resource type to the game
- After changing the rendering config (lighting, camera, materials)

---

## NPM Scripts Reference

| Script | Command | Purpose |
|--------|---------|---------|
| `balance-data` | `npx tsx tools/generate-balance-data.ts` | Regenerate balance tool data from game source |
| `thumbnail-data` | `npx tsx tools/generate-thumbnail-data.ts` | Regenerate thumbnail tool metadata from game source |
| `thumbnail-tool` | `npx tsx tools/thumbnail_generator/server.ts` | Start thumbnail generator server on port 3001 |
