import { BuildingType } from './BuildingType';
import { BuildingState } from './Building';
import type { GameState } from './GameState';
import type { RoadNetwork } from './RoadNetwork';
import type { HexGrid } from './HexGrid';

export interface WaterRoute {
  harborAId: string; // building ID
  harborBId: string; // building ID
  roadId: string;    // virtual road ID
}

/**
 * Manages virtual water routes between pairs of harbors.
 * Every CHECK_INTERVAL seconds, scans for active harbor pairs
 * connected by a contiguous water body, and creates/removes
 * virtual roads in the RoadNetwork accordingly.
 */
export class HarborManager {
  private waterRoutes: WaterRoute[] = [];
  private checkCooldown = 0;
  private static CHECK_INTERVAL = 2.0;

  private gameState: GameState;
  private roadNetwork: RoadNetwork;
  private grid: HexGrid;

  constructor(gameState: GameState, roadNetwork: RoadNetwork, grid: HexGrid) {
    this.gameState = gameState;
    this.roadNetwork = roadNetwork;
    this.grid = grid;
  }

  update(deltaTime: number): void {
    this.checkCooldown -= deltaTime;
    if (this.checkCooldown > 0) return;
    this.checkCooldown = HarborManager.CHECK_INTERVAL;
    this.syncWaterRoutes();
  }

  private syncWaterRoutes(): void {
    // 1. Remove routes where a harbor is gone/inactive/captured
    this.waterRoutes = this.waterRoutes.filter((route) => {
      const a = this.gameState.getBuilding(route.harborAId);
      const b = this.gameState.getBuilding(route.harborBId);
      if (
        !a || !b ||
        a.state !== BuildingState.Active ||
        b.state !== BuildingState.Active ||
        a.type !== BuildingType.Harbor ||
        b.type !== BuildingType.Harbor ||
        a.playerId !== b.playerId
      ) {
        this.roadNetwork.removeVirtualRoad(route.roadId);
        return false;
      }
      return true;
    });

    // 2. Collect active harbors grouped by player
    const harborsByPlayer = new Map<number, typeof buildings>();
    const buildings = this.gameState.getAllBuildings().filter(
      (b) => b.type === BuildingType.Harbor && b.state === BuildingState.Active,
    );
    for (const harbor of buildings) {
      let list = harborsByPlayer.get(harbor.playerId);
      if (!list) {
        list = [];
        harborsByPlayer.set(harbor.playerId, list);
      }
      list.push(harbor);
    }

    // Track existing routes for quick lookup
    const existingPairs = new Set(
      this.waterRoutes.map((r) => this.makePairKey(r.harborAId, r.harborBId)),
    );

    // 3. For each player, check all harbor pairs
    for (const harbors of harborsByPlayer.values()) {
      for (let i = 0; i < harbors.length; i++) {
        for (let j = i + 1; j < harbors.length; j++) {
          const a = harbors[i];
          const b = harbors[j];
          const pairKey = this.makePairKey(a.id, b.id);
          if (existingPairs.has(pairKey)) continue;

          // Check water connectivity
          if (!this.grid.findWaterConnection(a.coord, b.coord)) continue;

          // Get flags for both harbors
          const flagA = this.roadNetwork.getFlagAt(a.coord.q, a.coord.r);
          const flagB = this.roadNetwork.getFlagAt(b.coord.q, b.coord.r);
          if (!flagA || !flagB) continue;

          const road = this.roadNetwork.createVirtualRoad(flagA.id, flagB.id);
          if (road) {
            this.waterRoutes.push({
              harborAId: a.id,
              harborBId: b.id,
              roadId: road.id,
            });
          }
        }
      }
    }
  }

  private makePairKey(idA: string, idB: string): string {
    return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
  }

  /** Serialization: get internal state for save */
  _getState(): { waterRoutes: WaterRoute[] } {
    return { waterRoutes: [...this.waterRoutes] };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: { waterRoutes: WaterRoute[] }): void {
    this.waterRoutes = state.waterRoutes ?? [];
  }
}
