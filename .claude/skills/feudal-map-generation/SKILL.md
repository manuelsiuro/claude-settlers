---
name: feudal-map-generation
description: Extend procedural map generation. Covers terrain distribution, noise layers, deposit system, new terrain types, scenarios, castle placement, and border enforcement.
---

# Extend Map Generation

## When to Use
- Adding a new terrain type
- Tweaking terrain distribution balance
- Adding new mineral deposits or resource placement
- Creating new map scenarios
- Fixing map generation issues (bad castle placement, unplayable maps)

## Prerequisites
- Understand the current map generation pipeline
- Read `docs/terrains.md` for terrain visual specs
- Read `docs/game.md` for terrain gameplay rules

## Map Generation Architecture

### Pipeline Overview
```
Seed → SeededNoise → Elevation Layer → Moisture Layer → Terrain Assignment → Deposits → Castles → Border
```

### Key Components

**SeededNoise:** Deterministic noise from seed value. Same seed always produces the same map.

**Elevation Layer:** Perlin/simplex noise controlling height:
- Low elevation → water
- Medium → grassland/desert
- High → mountain

**Moisture Layer:** Second noise layer:
- High moisture + medium elevation → forest
- Low moisture + medium elevation → desert/grassland

**Terrain Assignment:** Percentile-rank based. `DEFAULT_BALANCE` defines target percentages:
```
Typical distribution:
- Water: ~15% (borders + lakes)
- Grassland: ~35%
- Forest: ~25%
- Mountain: ~10%
- Desert: ~15%
```

**Deposit System:** Mineral deposits (iron, coal, gold, stone) placed on specific terrain types:
- Mountain terrain → iron, coal, gold deposits
- Any non-water → stone deposits
- Distribution percentages control density

**Castle Placement:** Starting positions for each player:
- Must be on grassland
- Minimum distance from other castles
- Sufficient buildable area nearby
- Connected to resource variety

**Border Enforcement:** Water tiles at map edges create natural boundaries. Camera clamped to map bounds.

## Adding a New Terrain Type

Requires changes in 4 files:

### Step 1: Define Terrain Type
In the terrain type definition file:
```typescript
export const TerrainType = {
  // ... existing
  Swamp: 'swamp',
} as const;
```

### Step 2: Add Generation Rules
In the map generator, add conditions for the new terrain:
```typescript
// Where terrain is assigned based on elevation/moisture:
if (elevation < SWAMP_THRESHOLD && moisture > SWAMP_MOISTURE) {
  return TerrainType.Swamp;
}
```

Or adjust `DEFAULT_BALANCE` to include the new type's percentage.

### Step 3: Add Rendering
In `src/engine/MapRenderer.ts`:
- Add terrain color/material for the new type
- Add decorations (if any)
- Read `docs/terrains.md` for visual specs

### Step 4: Add Gameplay Rules
In `src/game/BuildingType.ts`:
- Update `allowedTerrain` for buildings that can/cannot be placed on the new terrain
- Update `harvestTerrain` if gathering buildings can harvest from it
- Update `adjacentTerrain` if any buildings need it adjacent

## Adding a New Scenario

Scenarios are predefined map configurations:

### Step 1: Define Scenario Data
```typescript
interface MapScenario {
  name: string;
  description: string;
  size: { width: number; height: number };
  playerCount: number;
  terrainOverrides?: Map<string, TerrainType>; // Fixed terrain at specific coords
  depositOverrides?: Map<string, DepositType>; // Fixed deposits
  startingPositions: HexCoord[]; // Castle locations per player
  balance?: Partial<TerrainBalance>; // Custom terrain percentages
}
```

### Step 2: Create Scenario
Define the specific map layout, starting positions, and any terrain overrides.

### Step 3: Integrate with Setup Screen
Add the scenario to the list in the setup UI so players can select it.

## Adjusting Terrain Distribution

In `DEFAULT_BALANCE` (or equivalent):

```typescript
const DEFAULT_BALANCE = {
  water: 0.15,
  grassland: 0.35,
  forest: 0.25,
  mountain: 0.10,
  desert: 0.15,
};
```

**Rules:**
- Values should sum to 1.0
- Water needs at least ~10% for borders
- Grassland needs at least ~25% for building space
- Forest needs at least ~15% for wood economy
- Mountain needs at least ~5% for mining

## Deposit Distribution

```typescript
// Typical deposit densities:
// Iron: 3-5 per mountain cluster
// Coal: 3-5 per mountain cluster
// Gold: 1-2 per mountain cluster (rare)
// Stone: scattered on grassland/mountain edges
```

## Castle Placement Algorithm

The algorithm ensures fair starting positions:

1. Divide map into player-count sectors
2. For each sector, find the best grassland hex:
   - Maximum buildable area in radius
   - Access to forest (wood), mountain (mining), water (fish)
   - Minimum distance from other castles
3. Validate: all castles must be reachable (no isolated islands)

## Testing

### Determinism Test
```typescript
it('should produce identical maps from the same seed', () => {
  const map1 = generateMap(seed: 12345, size: 'medium');
  const map2 = generateMap(seed: 12345, size: 'medium');
  expect(map1.terrain).toEqual(map2.terrain);
  expect(map1.deposits).toEqual(map2.deposits);
});
```

### Distribution Test
```typescript
it('should match target terrain distribution within 5%', () => {
  const map = generateMap(seed: 12345, size: 'large');
  const distribution = countTerrainTypes(map);
  expect(distribution.grassland).toBeCloseTo(0.35, 1);
  // etc.
});
```

### Visual Verification
```
1. Generate map with known seed
2. take_screenshot
3. Verify terrain variety, deposit placement, castle positions
4. Check border water ring
```

## Key Files
- Map generation source (search for `MapGenerator` or `generateMap`)
- `src/engine/MapRenderer.ts` — Terrain rendering
- `src/game/BuildingType.ts` — Terrain placement rules
- `docs/terrains.md` — Terrain visual design

## Verification
1. `npm run build` — compiles
2. `npm run test` — determinism + distribution tests pass
3. Generate maps with 5 different seeds — all playable
4. Visual screenshot — terrain looks correct
5. Play a game — building placement respects terrain rules
