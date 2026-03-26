# Living World Feature

## Executive Summary

A two-pillar expansion that transforms the game world from a static map into a living ecosystem:

1. **Ambient Visual Systems** — Clouds, birds, water effects, wild animals, flowers, butterflies, and bee swarms that react to time of day, weather, and wind. Purely cosmetic, no game state.
2. **New Production Chains** — 5 buildings (Hunting Lodge, Trapper's Hut, Furrier, Apiary, Meadery), 5 resources (GameMeat, Pelts, FurCoat, Honey, Mead), and 5 units (Hunter, Trapper, Furrier, Beekeeper, Meadmaker) that tie gameplay to the ambient world.

**Guiding principles:**
- All new gameplay data is defined in existing type files — zero special-case logic
- `inputCategory` on `ProductionRecipe` enables generic service buildings (fixes existing InnTavern bug)
- `TerrainGatheringManager` is a single data-driven manager replacing per-building manager files
- Ambient systems are GPU-driven (shaders, instancing) with mobile budgets
- All constants live in `balanceConstants.ts` as overrideable `let` values

---

## System 1: Ambient Visual Systems

Six visual systems, each following the renderer pattern: `constructor → addToScene(scene) → update(deltaTime) → dispose()`.

### 1.1 CloudRenderer

| Parameter | Value |
|-----------|-------|
| Max clouds | 30 desktop / 15 mobile |
| Height | Y = 12–18 |
| Drift speed | 0.3–0.8 units/sec |
| Opacity | 0.4–0.7 |
| Shadow opacity | 0.15 |
| Draw calls | 2 (clouds + shadows) |

- InstancedMesh with PlaneGeometry tilted to isometric camera angle
- Procedural Canvas2D textures (128×128, soft radial gradients, 3–4 variants)
- Ground shadows via second InstancedMesh, offset by `AtmosphereController._currentSunAngle`
- Camera-relative wrapping (same pattern as `WeatherController`)
- Night tint: white → grey-blue (nightness 0→1), pink at dawn/dusk via atmosphere warm tint
- Material: `MeshBasicMaterial`, transparent, depthWrite false

### 1.2 BirdFlockRenderer

| Parameter | Value |
|-----------|-------|
| Flocks | 4–6 desktop / 3 mobile |
| Birds per flock | 3–8 |
| Max birds | 40 desktop / 15 mobile |
| Height | Y = 8–14 |
| Draw calls | 1 |

- `THREE.Points` with custom vertex/fragment shader
- Fragment: V-shape from `gl_PointCoord`, wing flap via `sin(uTime*6 + aPhase)`
- CPU updates flock centers only (4–6 vec3/frame); individual bird offsets GPU-computed
- Flight patterns: `linear` (cross map), `circling` (orbit forest/lake), `swooping` (sine wave)
- `uTime` via `ShaderTimeManager`; `uFrustum` for point size scaling
- Fade to alpha 0 at nightness > 0.7

### 1.3 WaterEffectRenderer

| Parameter | Value |
|-----------|-------|
| Sparkle points | 50–80 desktop / 0 mobile |
| Draw calls | 1 (sparkles only) |

- **Water shader**: Custom `ShaderMaterial` replacing flat blue `MeshLambertMaterial` on water InstancedMesh in `MapRenderer`. Animated UV ripple via two overlapping sine waves, `uTime`-driven.
- **Sun sparkles**: `THREE.Points` on water tiles near camera. Bright white dots, spawn rate scales with sun angle (more at dawn/golden hour, none at night).
- `MapRenderer.ts` modified to accept external water material.

### 1.4 WildAnimalRenderer

| Parameter | Value |
|-----------|-------|
| Max animals | 20 desktop / 12 mobile |
| Types | deer, rabbit, mountain_goat, fish |
| Draw calls | 4 (one InstancedMesh per model type) |

- Deer (4–6): forest-adjacent grassland tiles
- Rabbits (4–6): grassland tiles
- Mountain goats (2–3): mountain tiles
- Fish (4–6): water tiles (jump above surface 0.5s, then invisible 5–15s)
- State machine: `idle` (3–8s) → `grazing` (2–5s) → `walking` (2–4s, lerp to nearby position)
- Deterministic spawn via seeded RNG — regenerated each game start, no save/load
- Distance culling: only update/render within 15 hexes of camera center
- Blender models: `deer.glb`, `rabbit.glb`, `mountain_goat.glb`, `fish.glb` → `public/models/terrain/`

### 1.5 FlowerButterflyRenderer

| Parameter | Value |
|-----------|-------|
| Flower coverage | 25% of grassland tiles without rocks/bushes |
| Max butterflies | 20–30 desktop / 15 mobile |
| Draw calls | 1 |

- **Flowers**: Added to `MapRenderer.getGrasslandPlacements()` as static InstancedMesh decoration
- **Butterflies**: `THREE.Points` anchored near flower positions, GPU-driven wandering via sine waves
- Colors: white, yellow, light blue, orange (per-instance attribute)
- Fade out at nightness > 0.3 (daytime only)
- Drift with wind direction
- Blender model: `flower_patch.glb` → `public/models/terrain/`

### 1.6 Bee Particle Effect

Implemented via existing `ParticleSystem.ts` — new `Bees` effect type:
- Color: yellow (#FFD700) → dark yellow (#B8860B)
- Size: 0.015 (constant, small dots)
- Lifetime: 2–4s
- Rate: 8/sec per active Apiary
- Building emitter in `BUILDING_EMITTERS` map

### Performance Budget

| System | Draw Calls | Instances/Points | Mobile |
|--------|-----------|-------------------|--------|
| Clouds | 2 | 30 + 30 shadows | 15 + 15 |
| Birds | 1 | 40 points | 15 |
| Water sparkle | 1 | 80 points | 0 |
| Wild animals | 4 | 20 instances | 12 |
| Butterflies | 1 | 30 points | 15 |
| **Total** | **9** | **230** | **72** |

### Shared Systems

- **Wind state**: `{ direction: Vector2, speed: number }` extracted from `WeatherController`, passed to clouds, butterflies, birds each frame
- **Graphics setting**: `ambientLife: 'off' | 'minimal' | 'full'` in `GameConfig.ts`. `minimal` = clouds only; `full` = all systems
- **Timing**: All ambient renderers use `rawDelta` (animate even when paused). Exception: wild animals use game-speed-scaled `deltaTime`

---

## System 2: New Production Chains

### Chain Diagrams

```
HUNTING CHAIN:
  Forest ─→ Hunting Lodge [Hunter + Bow] ─→ GameMeat (0.55 satiation)

TRAPPING CHAIN:
  Forest ─→ Trapper's Hut [Trapper] ─→ Pelts ─→ Furrier ─→ FurCoat (luxury, morale)

BEEKEEPING CHAIN:
  Grassland ─→ Apiary [Beekeeper] ─→ Honey (0.40 satiation)
                                         ↓
                                    Meadery [Meadmaker] ─→ Mead (drink, morale)
                                                              ↓
                                                          Inn/Tavern (morale boost)
```

### New Resources

| Resource | Type | Category | Satiation | isDrink | isLuxury |
|----------|------|----------|-----------|---------|----------|
| GameMeat | `game_meat` | raw | 0.55 | false | false |
| Pelts | `pelts` | raw | 0 | false | false |
| FurCoat | `fur_coat` | processed | 0 | false | true |
| Honey | `honey` | raw | 0.40 | false | false |
| Mead | `mead` | processed | 0.25 | true | false |

### New Units

| Unit | Type | Category | Required Tool | Move Speed |
|------|------|----------|---------------|------------|
| Hunter | `hunter` | civilian | Bow | 1.0 |
| Trapper | `trapper` | civilian | — | 0.9 |
| Furrier | `furrier` | civilian | — | 1.0 |
| Beekeeper | `beekeeper` | civilian | — | 1.0 |
| Meadmaker | `meadmaker` | civilian | — | 1.0 |

### New Buildings

| Building | Type | Tier | Category | Worker | Cost | Production | Terrain | Adjacent | workRadius |
|----------|------|------|----------|--------|------|------------|---------|----------|------------|
| Hunting Lodge | `hunting_lodge` | 2 | gathering | Hunter | 3W 2P 1S | → GameMeat ×1 (20s) | Grassland | Forest | 5 |
| Trapper's Hut | `trappers_hut` | 2 | gathering | Trapper | 3W 1P | → Pelts ×1 (25s) | Grassland | Forest | 4 |
| Furrier | `furrier` | 3 | processing | Furrier | 3W 2S 1P | Pelts ×1 → FurCoat ×1 (20s) | Grassland | — | 0 |
| Apiary | `apiary` | 2 | gathering | Beekeeper | 3W 2P | → Honey ×1 (22s) | Grassland | — | 0 |
| Meadery | `meadery` | 3 | processing | Meadmaker | 3W 2S 2P | Honey ×1 → Mead ×1 (18s) | Grassland | — | 0 |

### Balance Rationale

- **GameMeat (0.55)**: Between Fish (0.50) and Cheese (0.60). Raw food, no processing needed. Gated by Bow tool (Fletcher's Workshop → iron chain). Forest-adjacency limits placement.
- **Honey (0.40)**: Dual-use — eat directly for moderate food, or process into Mead. No tool/adjacency = easy early access.
- **Mead (0.25 satiation, isDrink)**: Third drink type for morale variety. Chain time: Apiary 22s + Meadery 18s = 40s. Compare: Beer 45s (two inputs), Wine 48s. Fastest morale path but weakest food value.
- **Pelts → FurCoat**: Material chain. Pelts have no direct use except Furrier processing and Marketplace trading. FurCoat is `isLuxury: true` — provides morale bonus at Inn/Tavern.
- **Trapper (no tool)**: Most accessible new building — no iron chain dependency, just 3 Wood + 1 Planks. Gives immediate Marketplace trade goods.

---

## System 3: Data-Driven Service Buildings

### Problem: InnTavern Bug

`ProductionManager` line 64 skips all buildings where `outputs.length === 0`. The InnTavern has `outputs: []`, so it **never processes Beer** and the `onProductionComplete` morale callback never fires.

### Solution: `inputCategories` on ProductionRecipe

Extend `ProductionRecipe` with an array of category entries, each with a `required` flag:

```typescript
interface ProductionRecipe {
  inputs: { resource: ResourceType; amount: number }[];
  outputs: { resource: ResourceType; amount: number }[];
  productionTime: number;
  inputCategories?: { category: 'drink' | 'luxury'; required: boolean }[];
}
```

When `inputCategories` is set:
1. `ProductionManager.update()` does NOT skip the building (even with empty outputs)
2. For `required: true` categories: production blocks if no matching resource in `inputInventory`
3. For `required: false` categories: consumed as a bonus if available, does not block production
4. `completeProduction()` iterates all categories, consumes one matching resource per category
5. Reports all consumed resources in `onProductionComplete` callback

### Updated InnTavern Definition

```typescript
production: {
  inputs: [],
  outputs: [],
  productionTime: 15,
  inputCategories: [
    { category: 'drink', required: true },   // Beer, Wine, or Mead required
    { category: 'luxury', required: false },  // FurCoat consumed as bonus if available
  ],
}
```

This is fully data-driven: adding a new category (e.g., `'spice'`) requires only a `ResourceProperties` flag and a category entry — zero `ProductionManager` changes.

### `isLuxury` on ResourceProperties

```typescript
interface ResourceProperties {
  label: string;
  category: 'raw' | 'processed' | 'animal';
  satiationValue: number;
  isDrink: boolean;
  isLuxury: boolean;  // luxury goods boost morale
}
```

Only `FurCoat` has `isLuxury: true`. All other resources get `isLuxury: false`.

### MoraleManager Luxury Tracking

Add `recordLuxuryServed(playerId, resourceType)` alongside existing `recordDrinkServed()`. Luxury variety/volume contribute to morale via new balance constants:

```typescript
export let MORALE_LUXURY_VARIETY_PER_TYPE = 0.05;
export let MORALE_LUXURY_VARIETY_MAX = 0.10;
export let MORALE_LUXURY_VOLUME_PER_ITEM = 0.008;
export let MORALE_LUXURY_VOLUME_MAX = 0.08;
```

---

## System 4: TerrainGatheringManager

### Problem

WoodcutterManager, ForesterManager, and GeologistManager each have unique terrain interactions (tree removal, tree planting, deposit scanning). Creating separate HunterManager + TrapperManager files for nearly identical "walk to terrain, work, return" behavior is code duplication.

### Solution

A single `TerrainGatheringManager` handles buildings where `gatheringStyle === 'walk'` on `BuildingDefinition`. This field explicitly opts buildings into the walk-to-terrain state machine. Currently set on HuntingLodge and TrappersHut. `ProductionManager` skips these buildings (`if (def.gatheringStyle === 'walk') continue`). All pre-existing gathering buildings (FishermanHut, Quarry, Farm, Mines) remain handled by `ProductionManager` — they have no `gatheringStyle` field.

### State Machine

```
idle_at_building → walking_to_terrain → gathering → walking_to_building → depositing
```

### Data Sources (all from BuildingDefinition)

| Parameter | Source |
|-----------|--------|
| Target terrain | `def.harvestTerrain` |
| Search radius | `def.workRadius` |
| Gathering duration | `def.production.productionTime × TERRAIN_GATHERING_WORK_FRACTION` |
| Output resource | `def.production.outputs[0]` |
| Idle cooldown | `TERRAIN_GATHERING_IDLE_COOLDOWN` (balance constant) |

### ProductionManager Skip

```typescript
// Skip terrain-gathering buildings — handled by TerrainGatheringManager
if (def.harvestTerrain && def.production.inputs.length === 0
    && building.type !== BuildingType.WoodcutterHut) continue;
```

---

## System 5: Balance Constants

All new constants in `balanceConstants.ts`:

```typescript
// Terrain gathering
export let TERRAIN_GATHERING_WORK_FRACTION = 0.4;
export let TERRAIN_GATHERING_IDLE_COOLDOWN = 3;

// Luxury morale
export let MORALE_LUXURY_VARIETY_PER_TYPE = 0.05;
export let MORALE_LUXURY_VARIETY_MAX = 0.10;
export let MORALE_LUXURY_VOLUME_PER_ITEM = 0.008;
export let MORALE_LUXURY_VOLUME_MAX = 0.08;
```

---

## System 6: Graphics Settings

```typescript
interface GraphicsSettings {
  // ... existing fields
  ambientLife: 'off' | 'minimal' | 'full';
}
```

- `off`: No ambient visual systems
- `minimal`: Clouds only (cheapest, biggest visual impact)
- `full`: All ambient systems enabled

Wired in `Game.applyGraphicsSettings()` to call `setEnabled(bool)` on each ambient renderer.

---

## Appendix A: File Change Checklist

### New Files
| File | Purpose |
|------|---------|
| `src/engine/CloudRenderer.ts` | Billboard cloud system |
| `src/engine/BirdFlockRenderer.ts` | GPU-driven bird flocks |
| `src/engine/WaterEffectRenderer.ts` | Water shader + sparkles |
| `src/engine/WildAnimalRenderer.ts` | Ambient terrain creatures |
| `src/engine/FlowerButterflyRenderer.ts` | Flower decorations + butterflies |
| `src/game/TerrainGatheringManager.ts` | Data-driven terrain gathering |
| `src/game/TerrainGatheringManager.test.ts` | Tests |

### Modified Files
| File | Changes |
|------|---------|
| `src/game/ResourceType.ts` | 5 resources + `isLuxury` field |
| `src/game/UnitType.ts` | 5 units |
| `src/game/BuildingType.ts` | 5 buildings + `inputCategory` field |
| `src/game/data/buildingDefinitions.ts` | 5 definitions + InnTavern fix |
| `src/game/data/balanceConstants.ts` | Gathering + luxury constants |
| `src/game/data/aiBuildOrders.ts` | AI build orders |
| `src/game/FeedingManager.ts` | Food producer buildings |
| `src/game/ProductionManager.ts` | Category-based input consumption |
| `src/game/MoraleManager.ts` | Luxury goods tracking |
| `src/game/SaveLoad.ts` | Version bump + manager state |
| `src/game/GameConfig.ts` | `ambientLife` setting |
| `src/engine/Game.ts` | All new managers + renderers |
| `src/engine/AssetLoader.ts` | 20 model registrations |
| `src/engine/BuildingModels.ts` | 5 model mappings |
| `src/engine/UnitModels.ts` | 5 model mappings |
| `src/engine/BuildingRenderer.ts` | 5 BUILDING_SCALE entries |
| `src/engine/ParticleSystem.ts` | Bees effect + emitter |
| `src/engine/MapRenderer.ts` | Water material + flower decorations |

### New 3D Models (20)
- Buildings: `hunting_lodge`, `trappers_hut`, `furrier`, `apiary`, `meadery`
- Units: `hunter`, `trapper`, `furrier`, `beekeeper`, `meadmaker`
- Resources: `game_meat`, `pelts`, `fur_coat`, `honey`, `mead`
- Terrain: `deer`, `rabbit`, `mountain_goat`, `fish`, `flower_patch`

## Appendix B: AI Build Order Placements

**Balanced/Economic:**
```
... existing entries ...
BuildingType.HuntingLodge,    // forest food source
BuildingType.Apiary,          // honey production
BuildingType.TrappersHut,     // pelts for trade/crafting
BuildingType.Meadery,         // honey → mead (morale variety)
BuildingType.Furrier,         // pelts → fur coat (luxury morale)
```

Aggressive build order: no changes (skips luxury/morale buildings).
