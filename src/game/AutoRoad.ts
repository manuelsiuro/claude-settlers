import type { HexCoord } from './HexGrid';
import { HexGrid } from './HexGrid';
import type { RoadNetwork } from './RoadNetwork';
import { TerrainType } from './TerrainType';

/**
 * Automatically connects a building's flag to the nearest existing connected flag
 * by placing intermediate flags and roads along the shortest hex path.
 *
 * Used by both AI (as a necessity — AI never builds roads manually) and
 * can also be offered as a convenience feature for human players.
 *
 * @returns true if a road path was successfully created
 */
export function autoConnectBuilding(
  buildingCoord: HexCoord,
  playerId: number,
  roadNetwork: RoadNetwork,
  grid: HexGrid,
): boolean {
  // Ensure the building has a flag (create one if LogisticsManager hasn't yet)
  let buildingFlag = roadNetwork.getFlagAt(buildingCoord.q, buildingCoord.r);
  if (!buildingFlag) {
    buildingFlag = roadNetwork.placeFlag(buildingCoord, playerId) ?? undefined;
  }
  if (!buildingFlag) return false;

  // If the flag is already connected, nothing to do
  const connected = roadNetwork.getConnectedFlags(buildingFlag.id);
  if (connected.length > 0) return false;

  // Find the nearest existing flag that's connected to the road network
  // (i.e., has at least one road or is the Castle flag)
  const targetFlag = findNearestConnectedFlag(buildingCoord, playerId, roadNetwork);
  if (!targetFlag) return false;

  // BFS on hex grid to find shortest path from building to target flag
  const path = findHexPath(buildingCoord, targetFlag, grid);
  if (path.length < 2) return false;

  // Place intermediate flags every 2 hexes along the path and connect them
  return buildRoadAlongPath(path, playerId, roadNetwork, grid);
}

/**
 * Find the nearest flag belonging to this player that is already connected
 * to the road network (has at least one road connection).
 */
function findNearestConnectedFlag(
  from: HexCoord,
  playerId: number,
  roadNetwork: RoadNetwork,
): HexCoord | null {
  const allFlags = roadNetwork.getAllFlags();

  let bestFlag: HexCoord | null = null;
  let bestDist = Infinity;

  for (const flag of allFlags) {
    if (flag.playerId !== playerId) continue;
    if (flag.coord.q === from.q && flag.coord.r === from.r) continue;

    // Must be connected to something (not an orphan)
    const connections = roadNetwork.getConnectedFlags(flag.id);
    if (connections.length === 0) continue;

    const dist = HexGrid.hexDistance(from, flag.coord);
    if (dist < bestDist) {
      bestDist = dist;
      bestFlag = flag.coord;
    }
  }

  // Fallback: try any flag owned by this player (even unconnected)
  // This handles the Castle case when no roads exist yet
  if (!bestFlag) {
    for (const flag of allFlags) {
      if (flag.playerId !== playerId) continue;
      if (flag.coord.q === from.q && flag.coord.r === from.r) continue;

      const dist = HexGrid.hexDistance(from, flag.coord);
      if (dist < bestDist) {
        bestDist = dist;
        bestFlag = flag.coord;
      }
    }
  }

  return bestFlag;
}

/**
 * BFS on the hex grid to find the shortest walkable path between two hexes.
 * Returns an array of hex coordinates (including start and end).
 * Avoids water tiles.
 */
function findHexPath(from: HexCoord, to: HexCoord, grid: HexGrid): HexCoord[] {
  if (!grid.isInBounds(from.q, from.r) || !grid.isInBounds(to.q, to.r)) return [];
  const endKey = HexGrid.key(to.q, to.r);

  const visited = new Set<string>();
  const parent = new Map<string, HexCoord>();
  const queue: HexCoord[] = [from];
  visited.add(HexGrid.key(from.q, from.r));

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = HexGrid.key(current.q, current.r);

    if (currentKey === endKey) {
      // Reconstruct path
      const path: HexCoord[] = [current];
      let node = current;
      let nodeKey = HexGrid.key(node.q, node.r);
      while (parent.has(nodeKey)) {
        node = parent.get(nodeKey)!;
        nodeKey = HexGrid.key(node.q, node.r);
        path.unshift(node);
      }
      return path;
    }

    const neighbors = grid.getNeighbors(current.q, current.r);
    for (const n of neighbors) {
      const nKey = HexGrid.key(n.coord.q, n.coord.r);
      if (visited.has(nKey)) continue;
      visited.add(nKey);

      // Skip water tiles
      if (n.terrain === TerrainType.Water) continue;

      parent.set(nKey, current);
      queue.push(n.coord);
    }
  }

  return []; // No path found
}

/**
 * Place flags and roads along a hex path.
 * Places a flag at each hex along the path (every step), connecting adjacent ones with roads.
 */
function buildRoadAlongPath(
  path: HexCoord[],
  playerId: number,
  roadNetwork: RoadNetwork,
  grid: HexGrid,
): boolean {
  if (path.length < 2) return false;

  // Ensure flags exist at strategic points along the path
  // For short paths (<=3 hexes), place at every hex
  // For longer paths, place every 2 hexes
  const flagInterval = path.length <= 4 ? 1 : 2;
  const flagCoords: HexCoord[] = [];

  for (let i = 0; i < path.length; i++) {
    if (i === 0 || i === path.length - 1 || i % flagInterval === 0) {
      flagCoords.push(path[i]);
    }
  }

  // Ensure the last coord is always included
  const last = path[path.length - 1];
  if (flagCoords[flagCoords.length - 1] !== last) {
    flagCoords.push(last);
  }

  // Place flags and connect them
  let prevFlagId: string | null = null;
  let anyConnected = false;

  for (const coord of flagCoords) {
    // Get or create flag at this coordinate
    const existingFlag = roadNetwork.getFlagAt(coord.q, coord.r);
    let flag = existingFlag ?? null;
    if (!flag) {
      // Check the tile is walkable
      const tile = grid.getTile(coord.q, coord.r);
      if (!tile || tile.terrain === TerrainType.Water) continue;
      flag = roadNetwork.placeFlag(coord, playerId);
    }
    if (!flag) continue;

    if (prevFlagId && prevFlagId !== flag.id) {
      // Connect to previous flag — but they must be neighbors
      const prevFlag = roadNetwork.getFlag(prevFlagId);
      if (prevFlag) {
        const prevNeighbors = grid.getNeighbors(prevFlag.coord.q, prevFlag.coord.r);
        const isNeighbor = prevNeighbors.some(
          (n) => n.coord.q === flag!.coord.q && n.coord.r === flag!.coord.r,
        );

        if (isNeighbor) {
          const road = roadNetwork.connectFlags(prevFlagId, flag.id);
          if (road) anyConnected = true;
        } else {
          // Not adjacent — need to fill the gap with intermediate flags
          const subPath = findHexPath(prevFlag.coord, coord, grid);
          if (subPath.length >= 2) {
            let subPrev = prevFlagId;
            for (let j = 1; j < subPath.length; j++) {
              const existingSub = roadNetwork.getFlagAt(subPath[j].q, subPath[j].r);
              let subFlag = existingSub ?? null;
              if (!subFlag) {
                subFlag = roadNetwork.placeFlag(subPath[j], playerId);
              }
              if (!subFlag) continue;
              if (subPrev !== subFlag.id) {
                const road = roadNetwork.connectFlags(subPrev, subFlag.id);
                if (road) anyConnected = true;
              }
              subPrev = subFlag.id;
            }
          }
        }
      }
    }

    prevFlagId = flag.id;
  }

  return anyConnected;
}
