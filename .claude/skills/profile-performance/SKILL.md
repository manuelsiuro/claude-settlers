---
name: profile-performance
description: Identify and fix performance bottlenecks in the game loop. 18 managers and 15 renderers update every frame. Use when FPS drops, memory grows, or optimizing for mobile.
---

# Profile & Optimize Performance

## When to Use
- FPS drops below 30 on mobile or 60 on desktop
- Memory usage grows over time (leak suspicion)
- Adding a new system and want to verify its performance impact
- Preparing for a milestone and need to optimize

## Prerequisites
- Dev server running: `npm run dev`
- Chrome DevTools MCP available for profiling

## Quick Performance Check

### Step 1: Baseline Measurement

```javascript
// Via evaluate_script in Chrome DevTools MCP:

// FPS counter
const game = window.__game; // If exposed, or use requestAnimationFrame timing
let frames = 0;
let lastTime = performance.now();
function countFPS() {
  frames++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    console.log(`FPS: ${frames}`);
    frames = 0;
    lastTime = now;
  }
  requestAnimationFrame(countFPS);
}
countFPS();
```

### Step 2: Profile via Chrome DevTools MCP

```
1. performance_start_trace — record 5 seconds of gameplay
2. performance_stop_trace — get trace results
3. performance_analyze_insight — identify hotspots
4. take_memory_snapshot — check heap size and object counts
```

### Step 3: Lighthouse Audit

```
lighthouse_audit with categories: ['performance']
```

Key metrics:
- **LCP** (Largest Contentful Paint) — initial load
- **INP** (Interaction to Next Paint) — input responsiveness
- **TBT** (Total Blocking Time) — main thread blocking

## Known Optimization Opportunities

### 1. Per-Frame Array Allocations

**Problem:** Creating arrays in hot paths (called every frame):

```typescript
// BAD: allocates new array every frame
update(deltaTime: number): void {
  const buildings = this.gameState.getAllBuildings().filter(b => b.status === 'active');
  // ...
}
```

**Fix:** Cache results, use dirty flags:

```typescript
// GOOD: only recompute when buildings change
private activeBuildings: Building[] = [];
private dirty = true;

markDirty(): void { this.dirty = true; }

update(deltaTime: number): void {
  if (this.dirty) {
    this.activeBuildings = this.gameState.getAllBuildings().filter(b => b.status === 'active');
    this.dirty = false;
  }
  // Use this.activeBuildings
}
```

### 2. Scratch Vector Reuse

**Problem:** Creating temporary Three.js objects in update loops:

```typescript
// BAD: allocates every frame
const pos = new THREE.Vector3(x, y, z);
const color = new THREE.Color(r, g, b);
```

**Fix:** Static scratch objects:

```typescript
// GOOD: reuse static objects
private static readonly _scratchVec = new THREE.Vector3();
private static readonly _scratchColor = new THREE.Color();

update(): void {
  MyClass._scratchVec.set(x, y, z);
  MyClass._scratchColor.setRGB(r, g, b);
}
```

### 3. InstancedMesh for Repeated Geometry

**Problem:** Individual meshes for many identical objects (>50):

```typescript
// BAD: 200 separate meshes = 200 draw calls
for (const flag of flags) {
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
}
```

**Fix:** InstancedMesh (1 draw call):

```typescript
// GOOD: single draw call for all instances
const instances = new THREE.InstancedMesh(geometry, material, MAX_COUNT);
instances.count = flags.length;
for (let i = 0; i < flags.length; i++) {
  matrix.makeTranslation(flags[i].x, flags[i].y, flags[i].z);
  instances.setMatrixAt(i, matrix);
}
instances.instanceMatrix.needsUpdate = true;
```

Reference: `src/engine/FlagLightSystem.ts` uses this pattern.

### 4. Particle Pool Budget

The `ParticleSystem` has an 800-particle budget shared across all effects. If you add new particle effects:
- Check current utilization
- Reduce rates on existing effects if needed
- Never exceed the budget (causes visual popping)

### 5. Throttled Updates

Not every system needs per-frame updates:

```typescript
// Update every 500ms instead of every frame
private updateTimer = 0;

update(deltaTime: number): void {
  this.updateTimer += deltaTime;
  if (this.updateTimer < 0.5) return;
  this.updateTimer = 0;
  // Expensive update logic
}
```

Reference: `BuildingStatusOverlay` updates every 500ms.

### 6. Frustum Culling

Three.js handles frustum culling automatically for most objects, but custom systems (particles, overlays) may need manual culling:

```typescript
// Only update objects visible to the camera
if (!frustum.containsPoint(objectPosition)) continue;
```

### 7. Texture Atlas for Sprites

If multiple sprite types use separate textures, consider a texture atlas (single texture with UV regions) to reduce draw calls.

## Memory Leak Detection

### Common Leak Sources
1. **Event listeners not removed** in `dispose()`
2. **Three.js geometries/materials not disposed**
3. **Growing arrays** (particle pools, entity lists) without cleanup
4. **Closures capturing large objects** in callbacks

### Detection via Chrome DevTools MCP

```
1. take_memory_snapshot — baseline
2. Play game for 2 minutes (create buildings, units, combat)
3. take_memory_snapshot — after activity
4. Compare: look for growing object counts
```

Key objects to watch:
- `THREE.BufferGeometry` count
- `THREE.Material` count
- `THREE.Texture` count
- Array buffer sizes

### Dispose Protocol

Every renderer must implement proper disposal:

```typescript
dispose(): void {
  // Remove from scene
  this.group.removeFromParent();

  // Dispose Three.js resources
  this.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });

  // Remove event listeners
  // Clear internal collections
}
```

## Performance Budget

| Metric | Target (Desktop) | Target (Mobile) |
|--------|-------------------|-----------------|
| FPS | 60 | 30 |
| Draw calls | <50 | <30 |
| Triangles | <100K | <50K |
| Memory | <200MB | <100MB |
| Load time | <3s | <5s |

## Key Files
- `src/engine/Game.ts` — Animate loop (all updates happen here)
- `src/engine/ParticleSystem.ts` — Particle budget reference
- `src/engine/FlagLightSystem.ts` — InstancedMesh reference
- `src/engine/BuildingStatusOverlay.ts` — Throttled update reference
- `src/engine/PostProcessing.ts` — Post-processing overhead

## Verification
1. FPS meets target after optimization
2. Memory snapshot shows no growing object counts
3. `npm run build` — compiles
4. `npm run test` — passes
5. Visual screenshot — no rendering regressions
