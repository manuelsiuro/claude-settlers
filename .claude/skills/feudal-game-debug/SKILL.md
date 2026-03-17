---
name: feudal-game-debug
description: Debug common game issues using Chrome DevTools MCP. Diagnose production stops, worker assignment, pathfinding, logistics routing, rendering, and performance via live game state inspection.
---

# Debug Game Issues

## When to Use
- A building is not producing and you don't know why
- Workers aren't arriving at buildings
- Resources are stuck and not being transported
- Knights aren't recruiting
- Visual rendering issues (missing models, wrong positions)
- Performance degradation

## Prerequisites
- Dev server running: `npm run dev`
- Chrome DevTools MCP available
- Game loaded and running

## Quick Check Workflow

### 1. Navigate and Screenshot
```
navigate_page → http://localhost:5173
take_screenshot → verify game renders
list_console_messages → check for errors
```

### 2. Game State Summary
```javascript
// evaluate_script:
const gs = window.__game?.getGameState(); // If game is exposed globally
// Or access through the debug console if available

JSON.stringify({
  buildings: gs.getAllBuildings().length,
  units: gs.getAllUnits().length,
  activeBuildings: gs.getAllBuildings().filter(b => b.status === 'active').length,
  constructing: gs.getAllBuildings().filter(b => b.status === 'constructing').length,
  waitingResources: gs.getAllBuildings().filter(b => b.status === 'waiting_resources').length,
})
```

## Debugging Specific Issues

### Building Not Producing

**Symptoms:** Building is active but not generating output.

**Investigation:**
```javascript
// Check specific building
const building = gs.getBuilding('building_id');
JSON.stringify({
  status: building.status,
  worker: gs.getWorkerForBuilding(building.id)?.id,
  inventory: building.inventory,
  productionProgress: building.productionProgress,
  productionPaused: building.productionPaused,
})
```

**Common causes:**
| Symptom | Cause | Fix |
|---------|-------|-----|
| status: 'constructing' | Not built yet | Wait or check builder |
| status: 'waiting_resources' | Construction needs resources | Check logistics routing |
| No worker assigned | UnitManager hasn't spawned one | Check population cap |
| Worker assigned but no progress | Missing input resources | Check supply chain |
| productionPaused: true | Player paused it | Unpause |
| inventory full | Output not being picked up | Check downstream demand |

### Worker Not Arriving

**Symptoms:** Building placed but no worker walks to it.

**Investigation:**
```javascript
// Check if worker exists
const worker = gs.getWorkerForBuilding('building_id');
if (worker) {
  JSON.stringify({
    id: worker.id,
    type: worker.type,
    state: worker.state,
    position: worker.position,
    targetPosition: worker.targetPosition,
    path: worker.path?.length,
  })
} else {
  'No worker assigned'
}

// Check population
const units = gs.getAllUnits();
JSON.stringify({
  total: units.length,
  idle: units.filter(u => u.state === 'idle').length,
  types: Object.fromEntries(
    Object.entries(
      units.reduce((acc, u) => { acc[u.type] = (acc[u.type] || 0) + 1; return acc; }, {})
    )
  ),
})
```

**Common causes:**
- No idle serfs → population cap reached or all assigned
- Path not found → building not connected to road network
- Building outside territory → shouldn't have been placeable

### Resources Stuck (Not Being Transported)

**Symptoms:** Resources pile up at a flag or building.

**Investigation:**
```javascript
// Check road network
const rn = window.__game?.getRoadNetwork?.();
// Check flags near the building
// Check if transporters are assigned to the road segment

// Check logistics
const lm = window.__game?.getLogisticsManager?.();
// Check pending deliveries for the resource type
```

**Common causes:**
- No road connection between source and destination
- Transporter missing on road segment (only 1 per segment)
- Destination building is full (storage capacity reached)
- Low priority in goods distribution settings

### Knight Not Recruiting

**Symptoms:** Military building has empty slots, sword + shield available, but no knight appears.

**Investigation:**
```javascript
// Check military building
const milBuilding = gs.getBuilding('building_id');
JSON.stringify({
  type: milBuilding.type,
  knights: milBuilding.knights,
  knightSlots: milBuilding.knightSlots,
  inventory: milBuilding.inventory, // Check for sword + shield
})

// Check if idle serfs available
const idle = gs.getAllUnits().filter(u => u.state === 'idle' && u.type === 'transporter');
'Idle serfs: ' + idle.length
```

**Requirements for recruitment:**
1. Military building (GuardHut/Watchtower/Barracks) with empty slot
2. Sword delivered to building
3. Shield delivered to building
4. Idle serf available
5. All conditions met simultaneously

### Building Stuck in "Planned" State

**Symptoms:** Ghost mesh visible but construction never starts.

**Investigation:**
```javascript
const building = gs.getBuilding('building_id');
JSON.stringify({
  status: building.status,
  constructionProgress: building.constructionProgress,
  // Check if builder is assigned
  builder: gs.getAllUnits().find(u => u.targetBuildingId === building.id),
  // Check if construction resources are available
  cost: BUILDING_DEFINITIONS[building.type].cost,
})
```

**Common causes:**
- No builder unit available
- Construction resources (planks, stone) not delivered
- Building outside territory (territory shrunk after placement)

### Rendering Issues

**Investigation:**
```javascript
// Check scene objects
const scene = window.__game?.scene;
scene?.children.length

// Check for missing models
// Look in console for: "Failed to load model" or "model not found"
```

```
list_console_messages → look for Three.js warnings
take_screenshot → verify visual state
```

### Performance Issues

```
performance_start_trace → record 5 seconds
performance_stop_trace → analyze
performance_analyze_insight → get hotspots

take_memory_snapshot → check for leaks
```

See `profile-performance` skill for detailed optimization.

## Debug Console Cheatsheet

```javascript
// Game speed
game.setGameSpeed(3); // Speed up for testing

// Spawn resources (if debug API exists)
// Check if there's a debug/cheat interface

// Force territory recalculation
game.getTerritoryManager()?.recalculateAll();

// Force logistics update
game.getLogisticsManager()?.update(1.0);
```

## Key Files
- `src/engine/Game.ts` — Game instance, manager access
- `src/game/GameState.ts` — Building/unit queries
- `src/game/ProductionManager.ts` — Production logic
- `src/game/UnitManager.ts` — Worker spawning/assignment
- `src/game/LogisticsManager.ts` — Goods routing
- `src/game/KnightManager.ts` — Knight recruitment
- `src/game/ConstructionManager.ts` — Building construction

## Verification
After fixing an issue:
1. `npm run build` + `npm run test` — no regressions
2. Reproduce the original issue — confirm it's fixed
3. `take_screenshot` — visual confirmation
4. `list_console_messages` — no new errors
