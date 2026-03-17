---
name: feudal-3d-asset-pipeline
description: Blender MCP to Three.js asset pipeline. Model creation in Blender Python, GLTF export, AssetLoader registration, type-to-model mapping, scale configuration, troubleshooting.
---

# 3D Asset Pipeline (Blender → Three.js)

## When to Use
When creating any new 3D model for the game — buildings, units, resources, terrain decorations, or props.

## Prerequisites
- Blender MCP server running (configured in `.mcp.json`)
- Read the relevant design doc for visual specs:
  - Buildings: `docs/buildings.md`
  - Units: `docs/units.md`
  - Resources: `docs/resources.md`
  - Terrain: `docs/terrains.md`

## 8-Step Workflow

### Step 1: Read Design Doc

Before opening Blender, read the design doc and note:
- **Colors** (hex codes for each part)
- **Shape** (proportions, distinctive features)
- **Size** (relative to hex tile and other models)
- **Style** (low-poly, stylized — consistent with existing models)

### Step 2: Create in Blender

Use `mcp__blender__execute_blender_code` to create the model via Python:

```python
import bpy
import bmesh

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Create base mesh
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.5))
obj = bpy.context.active_object
obj.name = 'model_name'

# Add materials with specific colors
mat = bpy.data.materials.new(name='WallColor')
mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.76, 0.60, 0.42, 1.0)  # From design doc
bsdf.inputs['Roughness'].default_value = 0.8  # Keep rough for stylized look
bsdf.inputs['Metallic'].default_value = 0.0   # Low metalness unless metal
obj.data.materials.append(mat)

# Add more geometry for details...
# Use primitive operations: cube, cylinder, cone, sphere, plane
# Combine with boolean operations or manual vertex editing
```

**Model Guidelines:**
- **Low poly** — minimize vertex count (buildings: 200-500 verts, units: 100-300)
- **Solid colors** — use materials with flat Base Color, no textures
- **High roughness** (0.7-0.9) — prevents unrealistic shininess
- **Low metalness** (0.0-0.1) — unless the object is actually metal
- **Y-up** — Blender uses Z-up, Three.js uses Y-up. GLTF export handles the conversion
- **Origin at base** — center the model at (0, 0) with bottom at Z=0

### Step 3: Verify Visually

Use `mcp__blender__get_viewport_screenshot` to check the model:
- Correct proportions?
- Colors match design doc?
- Recognizable from isometric view?
- Low-poly aesthetic maintained?

Iterate with `execute_blender_code` until satisfied.

### Step 4: Export as GLB

```python
import bpy

# Select all objects in the model
bpy.ops.object.select_all(action='SELECT')

# Export as GLB (binary GLTF — smaller file size)
bpy.ops.export_scene.gltf(
    filepath='/path/to/project/public/models/<category>/<name>.glb',
    export_format='GLB',
    use_selection=True,
    export_materials='EXPORT',
    export_colors=True,
)
```

**Export path convention:**
- Buildings: `public/models/buildings/<building_name>.glb`
- Units: `public/models/units/<unit_name>.glb`
- Resources: `public/models/resources/<resource_name>.glb`
- Terrain: `public/models/terrain/<terrain_name>.glb`

### Step 5: Register in AssetLoader

In `src/engine/AssetLoader.ts`:

**a) Add to the appropriate model name type:**
```typescript
export type BuildingModelName = /* existing */ | 'new_model';
// or UnitModelName, ResourceModelName, TerrainModelName
```

**b) Add to the load function's model list:**
```typescript
// In loadBuildingModels() / loadUnitModels() / loadResourceModels():
'new_model',
```

### Step 6: Map Type to Model

In the appropriate mapping:
- Buildings: `src/engine/BuildingModels.ts` or inline in `BuildingRenderer.ts`
- Units: mapping in `UnitRenderer.ts`
- Resources: mapping in resource rendering code

```typescript
[BuildingType.NewBuilding]: 'new_model',
```

### Step 7: Set Scale

In the appropriate renderer:
- Buildings: `BUILDING_SCALE` in `BuildingRenderer.ts`
- Units: scale in `UnitRenderer.ts`

```typescript
[BuildingType.NewBuilding]: 0.15,  // Adjust by trial and error
```

**Scale calibration:**
1. Start with 0.15 (typical building scale)
2. Take screenshot in-game
3. Adjust up/down until the model fits the hex tile properly
4. Typical range: 0.08 (small buildings) to 0.25 (large buildings)

### Step 8: Verify In-Game

1. Start dev server: `npm run dev`
2. Navigate to game, place the building/spawn the unit
3. `take_screenshot` — verify model appears correctly
4. Check from multiple angles (zoom/rotate)
5. `list_console_messages` — no "model not found" warnings

## Troubleshooting

### Model Not Showing
- Check file path matches AssetLoader registration exactly
- Check model name mapping (type → model name)
- Check `list_console_messages` for loading errors
- Verify the GLB file exists in `public/models/`

### Model Too Shiny/Metallic
The AssetLoader normalizes PBR materials, but source models should have:
```python
bsdf.inputs['Roughness'].default_value = 0.8
bsdf.inputs['Metallic'].default_value = 0.0
```

### Model Wrong Size
Adjust the scale in the renderer's scale map. If the Blender model itself is wrong:
```python
# In Blender: scale the object
obj.scale = (0.5, 0.5, 0.5)
bpy.ops.object.transform_apply(scale=True)  # Apply scale
```

### Model Wrong Orientation
GLTF export converts Blender's Z-up to Three.js Y-up automatically. If still wrong:
```python
# In Blender: rotate before export
obj.rotation_euler = (radians(angle), 0, 0)
bpy.ops.object.transform_apply(rotation=True)
```

### Colors Don't Match
Check that materials use `Principled BSDF` with Base Color set to the exact hex from the design doc. Convert hex to normalized RGB:
```python
# Hex #C29A6B → RGB (194, 154, 107) → Normalized (0.76, 0.60, 0.42)
color = (0x_C2/255, 0x_9A/255, 0x_6B/255, 1.0)
```

## Batch Model Creation

When creating multiple models (e.g., all expansion buildings):

1. Create a Blender Python script that generates all models in sequence
2. Clear scene between each model
3. Export each with the correct filename
4. Register all in AssetLoader at once
5. Map all types to models
6. Set all scales

## Key Files
- `src/engine/AssetLoader.ts` — Model loading + caching
- `src/engine/BuildingRenderer.ts` — Building model scale + rendering
- `src/engine/UnitRenderer.ts` — Unit model rendering
- `public/models/` — All GLTF/GLB model files
- `docs/buildings.md`, `docs/units.md`, `docs/resources.md`, `docs/terrains.md` — Visual specs

## Verification
1. `npm run build` — compiles (type names valid)
2. Model appears in-game at correct position and scale
3. Colors match design doc
4. No console errors or warnings
5. Model is recognizable from isometric zoom level
