/**
 * Generates thumbnail-data.json from game source files.
 * Run: npm run thumbnail-data
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { RESOURCE_PROPERTIES } from '../src/game/ResourceType';
import { UNIT_DEFINITIONS } from '../src/game/UnitType';
import { BUILDING_DEFINITIONS } from '../src/game/data/buildingDefinitions';
import { BUILDING_MODEL_MAP } from '../src/engine/BuildingModels';
import { UNIT_MODEL_MAP } from '../src/engine/UnitModels';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Config (drives all rendering behavior in the HTML tool) ──────
const config = {
  size: 256,
  camera: {
    angle: [1, 1, 1],
    padding: 1.15,
  },
  lighting: {
    ambient: { color: '#ffffff', intensity: 0.6 },
    main: { color: '#fff5e6', intensity: 0.9, position: [5, 8, 5] },
    rim: { color: '#aaccff', intensity: 0.3, position: [-3, 2, -5] },
  },
  materials: {
    maxMetalness: 0.3,
    minRoughness: 0.5,
  },
  output: {
    format: 'png',
    directory: 'public/thumbnails',
  },
};

// ── Buildings ────────────────────────────────────────────────────
const buildingItems: unknown[] = [];
for (const [type, def] of Object.entries(BUILDING_DEFINITIONS)) {
  const modelFile = BUILDING_MODEL_MAP[type as keyof typeof BUILDING_MODEL_MAP];
  if (!modelFile) continue;
  buildingItems.push({
    id: type,
    label: def.label,
    category: def.category,
    tier: def.tier,
    modelFile: `${modelFile}.glb`,
  });
}

// ── Units ────────────────────────────────────────────────────────
const unitItems: unknown[] = [];
for (const [type, def] of Object.entries(UNIT_DEFINITIONS)) {
  const modelFile = UNIT_MODEL_MAP[type as keyof typeof UNIT_MODEL_MAP];
  if (!modelFile) continue;
  unitItems.push({
    id: type,
    label: def.label,
    category: def.category,
    modelFile: `${modelFile}.glb`,
  });
}
// serf_base exists in UNIT_MODELS but has no UnitType — include as extra entry
unitItems.push({
  id: 'serf_base',
  label: 'Serf',
  category: 'civilian',
  modelFile: 'serf_base.glb',
});

// ── Resources ────────────────────────────────────────────────────
const resourceItems: unknown[] = [];
for (const [type, props] of Object.entries(RESOURCE_PROPERTIES)) {
  // The ResourceType value IS the model filename (e.g., 'wood', 'hammer_tool')
  resourceItems.push({
    id: type,
    label: props.label,
    category: props.category,
    modelFile: `${type}.glb`,
  });
}

// ── Output ───────────────────────────────────────────────────────
const output = {
  generatedAt: new Date().toISOString(),
  config,
  categories: {
    buildings: {
      modelDir: 'buildings',
      items: buildingItems,
    },
    units: {
      modelDir: 'units',
      items: unitItems,
    },
    resources: {
      modelDir: 'resources',
      items: resourceItems,
    },
  },
};

const outPath = path.resolve(__dirname, 'thumbnail_generator', 'thumbnail-data.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

const bCount = buildingItems.length;
const uCount = unitItems.length;
const rCount = resourceItems.length;
console.log(`Generated ${outPath}`);
console.log(`  ${bCount} buildings, ${uCount} units, ${rCount} resources (${bCount + uCount + rCount} total)`);
