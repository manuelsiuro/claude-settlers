---
name: feudal-new-renderer
description: Create a new Three.js renderer or visual effect system. Template with addToScene/update/dispose, plus performance guidelines (instancing, no PointLights, particle pooling).
---

# Add a New Renderer / Visual Effect System

## When to Use
When adding a new visual layer to the game — building decorations, environmental effects, UI overlays in 3D space, new entity types, or shader effects.

## Prerequisites
- Read the relevant design doc for visual specs (colors, sizes, styles)
- Identify what game data drives the visuals (buildings, units, flags, terrain)
- Choose the rendering approach (see Approach Selection below)

## Approach Selection

| Approach | When to Use | Example |
|----------|-------------|---------|
| Individual `THREE.Mesh` | Few unique objects (<50) | `BuildingRenderer` |
| `THREE.InstancedMesh` | Many identical objects (>50) | `FlagLightSystem` (500 max) |
| `THREE.Points` | Particles, dots, markers | `ParticleSystem` (800 budget) |
| `THREE.Sprite` | Billboard overlays | `BuildingStatusOverlay` |
| `THREE.Line` / `LineDashedMaterial` | Connections, paths | `ProductionChainOverlay` |
| Custom `ShaderMaterial` | GPU-driven animation | `TreeSwayShader` |

## Renderer Template

Create `src/engine/<RendererName>.ts`:

```typescript
import * as THREE from 'three';

export class <RendererName> {
  private group: THREE.Group;
  // Add meshes, materials, geometry as needed

  constructor() {
    this.group = new THREE.Group();
    this.group.name = '<RendererName>';
    // Initialize materials, geometry, etc.
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.group);
  }

  update(deltaTime: number, /* game data params */): void {
    // Sync visuals with game state each frame
    // deltaTime is in seconds
  }

  dispose(): void {
    // Clean up all Three.js resources
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    this.group.removeFromParent();
  }
}
```

## 5-Step Integration

### Step 1: Create the Renderer File
Write the class in `src/engine/<RendererName>.ts` following the template.

### Step 2: Instantiate in Game.ts Constructor
```typescript
private <rendererName>: <RendererName>;

// In constructor:
this.<rendererName> = new <RendererName>(/* config */);
```

### Step 3: Add to Scene in start()
In `Game.start()`, after scene setup:
```typescript
this.<rendererName>.addToScene(this.scene);
```

### Step 4: Update in Animate Loop
In `Game.animate()`, after manager updates but before render:
```typescript
this.<rendererName>.update(deltaTime, /* pass relevant game data */);
```

**Update ordering:**
1. Manager updates (game logic)
2. Mesh renderers (BuildingRenderer, UnitRenderer, TreeRenderer)
3. Effect renderers (ParticleSystem, BuildingAnimator)
4. Overlay renderers (BuildingStatusOverlay, ProductionChainOverlay)
5. Atmosphere/post-processing (AtmosphereController, PostProcessing)

### Step 5: Dispose in dispose()
In `Game.dispose()`:
```typescript
this.<rendererName>.dispose();
```

## Performance Guidelines

### Hard Rules
- **Zero PointLights** — use emissive materials, sprites, or instanced meshes for glow effects
- **Particle budget** — max 800 particles across all effects (shared with ParticleSystem)
- **Draw call budget** — each InstancedMesh = 1 draw call. Keep total under 50
- **No per-frame allocations** — reuse vectors, matrices, colors:
  ```typescript
  // BAD: allocates every frame
  const pos = new THREE.Vector3(x, y, z);

  // GOOD: reuse scratch objects
  private static readonly _scratch = new THREE.Vector3();
  // In update:
  <RendererName>._scratch.set(x, y, z);
  ```

### Optimization Patterns

**Instanced Rendering** (for repeated identical geometry):
```typescript
const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
const material = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
const instances = new THREE.InstancedMesh(geometry, material, MAX_COUNT);
instances.count = 0; // Set actual count each frame

// Per-instance transform:
private static readonly _matrix = new THREE.Matrix4();
// In update:
_matrix.makeTranslation(x, y, z);
instances.setMatrixAt(index, _matrix);
instances.instanceMatrix.needsUpdate = true;
```

**Dirty Flag Pattern** (skip updates when nothing changed):
```typescript
private dirty = true;

markDirty(): void { this.dirty = true; }

update(deltaTime: number): void {
  if (!this.dirty) return;
  this.dirty = false;
  // Expensive rebuild
}
```

**LOD / Distance Culling:**
```typescript
// Hide objects far from camera
const distSq = camera.position.distanceToSquared(obj.position);
obj.visible = distSq < MAX_VISIBLE_DIST_SQ;
```

**Sprite Overlays** (always face camera):
```typescript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d')!;
// Draw icon/text on canvas
const texture = new THREE.CanvasTexture(canvas);
const sprite = new THREE.Sprite(
  new THREE.SpriteMaterial({ map: texture, depthTest: false })
);
```

## Reference Examples by Type

| Type | File | Pattern |
|------|------|---------|
| Mesh renderer | `BuildingRenderer.ts` | Individual meshes per entity, fog filtering |
| Instanced renderer | `FlagLightSystem.ts` | InstancedMesh for lanterns + sprites for glow |
| Particle system | `ParticleSystem.ts` | Pool-based Points with custom GLSL shaders |
| Overlay (sprite) | `BuildingStatusOverlay.ts` | CanvasTexture sprites, priority-based status |
| Overlay (lines) | `ProductionChainOverlay.ts` | LineDashedMaterial with cone arrows |
| Shader effect | `TreeSwayShader.ts` | Custom ShaderMaterial, GPU-driven animation |
| Shadow | `BlobShadowRenderer.ts` | Soft blob shadows under entities |
| Atmosphere | `AtmosphereController.ts` | Time-of-day lighting, nightness factor |

## Key Files
- `src/engine/Game.ts` — Renderer instantiation, scene setup, animate loop, dispose
- `src/engine/AssetLoader.ts` — Loading 3D models (if renderer uses GLTF assets)
- `src/engine/BuildingRenderer.ts` — Reference for mesh-based rendering
- `src/engine/FlagLightSystem.ts` — Reference for instanced rendering
- `src/engine/ParticleSystem.ts` — Reference for particle effects

## Verification
1. `npm run build` — compiles without errors
2. `npm run lint` — no violations
3. Start dev server, navigate to game
4. `take_screenshot` — verify the visual effect renders correctly
5. `list_console_messages` — no Three.js warnings or errors
6. Check FPS — no significant performance drop (should stay above 30fps on mobile)
7. Test dispose — navigate away and back, verify no memory leaks
