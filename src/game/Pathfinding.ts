import { HexGrid } from './HexGrid';
import type { HexCoord } from './HexGrid';
import { TerrainType } from './TerrainType';

/** Terrain types that units can walk on */
const WALKABLE_TERRAIN: Set<string> = new Set([
  TerrainType.Grassland,
  TerrainType.Forest,
  TerrainType.Desert,
  TerrainType.Mountain,
]);

/**
 * A* pathfinding on the hex grid.
 * Finds the shortest walkable path between two hex coordinates.
 * Respects world wrapping. Avoids water tiles.
 *
 * @returns Array of HexCoord from start to goal (inclusive), or empty array if no path.
 */
export function findPath(
  grid: HexGrid,
  start: HexCoord,
  goal: HexCoord,
  maxSteps = 200,
): HexCoord[] {
  const startWrapped = grid.wrap(start.q, start.r);
  const goalWrapped = grid.wrap(goal.q, goal.r);

  const startKey = HexGrid.key(startWrapped.q, startWrapped.r);
  const goalKey = HexGrid.key(goalWrapped.q, goalWrapped.r);

  // Trivial case
  if (startKey === goalKey) return [startWrapped];

  // Check goal is walkable
  const goalTile = grid.getTile(goalWrapped.q, goalWrapped.r);
  if (!goalTile || !WALKABLE_TERRAIN.has(goalTile.terrain)) return [];

  // A* with binary heap for O(log n) open set operations
  const gScore: Map<string, number> = new Map();
  const cameFrom: Map<string, HexCoord> = new Map();
  const closedSet: Set<string> = new Set();

  const startF = hexDistance(startWrapped, goalWrapped, grid);
  gScore.set(startKey, 0);

  // Binary min-heap: [fScore, key]
  const heap: [number, string][] = [[startF, startKey]];
  const inOpen: Set<string> = new Set([startKey]);

  let steps = 0;

  while (heap.length > 0 && steps < maxSteps) {
    steps++;

    // Pop min fScore from heap
    const [, currentKey] = heapPop(heap);
    if (!inOpen.has(currentKey)) continue; // stale entry
    inOpen.delete(currentKey);

    if (currentKey === goalKey) {
      return reconstructPath(cameFrom, goalWrapped);
    }

    closedSet.add(currentKey);

    const [cq, cr] = currentKey.split(',').map(Number);
    const currentCoord = { q: cq, r: cr };
    const currentG = gScore.get(currentKey) ?? Infinity;

    // Explore neighbors
    const neighbors = grid.getNeighbors(currentCoord.q, currentCoord.r);
    for (const neighborTile of neighbors) {
      const nKey = HexGrid.key(neighborTile.coord.q, neighborTile.coord.r);

      if (closedSet.has(nKey)) continue;
      if (!WALKABLE_TERRAIN.has(neighborTile.terrain)) continue;

      // Movement cost: 1 for all walkable terrain (could be weighted later)
      const tentativeG = currentG + 1;
      const existingG = gScore.get(nKey) ?? Infinity;

      if (tentativeG < existingG) {
        cameFrom.set(nKey, currentCoord);
        gScore.set(nKey, tentativeG);
        const f = tentativeG + hexDistance(neighborTile.coord, goalWrapped, grid);
        heapPush(heap, [f, nKey]);
        inOpen.add(nKey);
      }
    }
  }

  // No path found
  return [];
}

/**
 * Hex distance heuristic for A*.
 * Accounts for world wrapping by checking all wrap-around routes
 * and returning the minimum distance.
 */
export function hexDistance(a: HexCoord, b: HexCoord, grid: HexGrid): number {
  // Direct distance
  let minDist = cubeDistance(a, b);

  // Check wrapped distances (shifting b by grid dimensions)
  const offsets = [
    { dq: grid.width, dr: 0 },
    { dq: -grid.width, dr: 0 },
    { dq: 0, dr: grid.height },
    { dq: 0, dr: -grid.height },
    { dq: grid.width, dr: grid.height },
    { dq: -grid.width, dr: grid.height },
    { dq: grid.width, dr: -grid.height },
    { dq: -grid.width, dr: -grid.height },
  ];

  for (const { dq, dr } of offsets) {
    const dist = cubeDistance(a, { q: b.q + dq, r: b.r + dr });
    if (dist < minDist) minDist = dist;
  }

  return minDist;
}

/** Cube distance between two hex coords (without wrapping) */
function cubeDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Binary min-heap push */
function heapPush(heap: [number, string][], item: [number, string]): void {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (heap[parent][0] <= heap[i][0]) break;
    [heap[parent], heap[i]] = [heap[i], heap[parent]];
    i = parent;
  }
}

/** Binary min-heap pop */
function heapPop(heap: [number, string][]): [number, string] {
  const top = heap[0];
  const last = heap.pop()!;
  if (heap.length > 0) {
    heap[0] = last;
    let i = 0;
    const n = heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && heap[left][0] < heap[smallest][0]) smallest = left;
      if (right < n && heap[right][0] < heap[smallest][0]) smallest = right;
      if (smallest === i) break;
      [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
      i = smallest;
    }
  }
  return top;
}

/** Reconstruct path from cameFrom map */
function reconstructPath(
  cameFrom: Map<string, HexCoord>,
  goal: HexCoord,
): HexCoord[] {
  const path: HexCoord[] = [goal];
  let currentKey = HexGrid.key(goal.q, goal.r);

  while (cameFrom.has(currentKey)) {
    const prev = cameFrom.get(currentKey)!;
    path.unshift(prev);
    currentKey = HexGrid.key(prev.q, prev.r);
  }

  return path;
}
