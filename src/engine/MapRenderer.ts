import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import type { HexTile } from '../game/HexGrid';
import { TerrainType } from '../game/TerrainType';
import { createHexTileMesh, createDecorations } from './TerrainMeshFactory';

/**
 * Renders a HexGrid as 3D terrain in a Three.js scene.
 * Supports world wrapping via ghost copies offset by hex grid wrapping vectors.
 */
export class MapRenderer {
  private mapGroup: THREE.Group;
  private wrapGroups: THREE.Group[] = [];

  constructor() {
    this.mapGroup = new THREE.Group();
    this.mapGroup.name = 'map';
  }

  /** Build all meshes for the grid and add to scene */
  render(grid: HexGrid, scene: THREE.Scene): void {
    this.dispose();

    this.buildTileGroup(grid, this.mapGroup);
    scene.add(this.mapGroup);

    // World wrapping: 8 ghost copies using hex grid wrapping vectors
    const { wrapQ, wrapR } = grid.getWrapVectors();

    // All 8 neighbor offsets as combinations of wrapQ and wrapR
    const multipliers = [
      { mq: -1, mr: 0 },
      { mq: 1, mr: 0 },
      { mq: 0, mr: -1 },
      { mq: 0, mr: 1 },
      { mq: -1, mr: -1 },
      { mq: 1, mr: -1 },
      { mq: -1, mr: 1 },
      { mq: 1, mr: 1 },
    ];

    for (const { mq, mr } of multipliers) {
      const offsetX = mq * wrapQ.x + mr * wrapR.x;
      const offsetZ = mq * wrapQ.z + mr * wrapR.z;
      const ghost = this.mapGroup.clone();
      ghost.position.set(offsetX, 0, offsetZ);
      ghost.name = `map_ghost_${mq}_${mr}`;
      scene.add(ghost);
      this.wrapGroups.push(ghost);
    }
  }

  /** Compute Y offset for a tile based on terrain type and elevation */
  private static getTileY(tile: HexTile): number {
    if (tile.terrain === TerrainType.Water) return -0.1;
    // Elevation naturally maps: desert~low, grassland~mid, forest~mid-high, mountain~high
    return tile.elevation * 0.2;
  }

  private buildTileGroup(grid: HexGrid, group: THREE.Group): void {
    const tiles = grid.getAllTiles();

    for (const tile of tiles) {
      const { x, z } = HexGrid.hexToWorld(tile.coord.q, tile.coord.r);
      const y = MapRenderer.getTileY(tile);

      // Ground hex tile
      const hexMesh = createHexTileMesh(tile);
      hexMesh.position.set(x, y, z);
      hexMesh.name = `tile_${tile.coord.q}_${tile.coord.r}`;
      group.add(hexMesh);

      // Decorations
      const decorations = createDecorations(tile);
      if (decorations) {
        decorations.position.set(x, y, z);
        group.add(decorations);
      }
    }
  }

  /** Get the map group for camera targeting */
  getMapGroup(): THREE.Group {
    return this.mapGroup;
  }

  /** Compute the center of the map in world coordinates */
  getMapCenter(grid: HexGrid): THREE.Vector3 {
    const centerQ = grid.width / 2;
    const centerR = grid.height / 2;
    const { x, z } = HexGrid.hexToWorld(centerQ, centerR);
    return new THREE.Vector3(x, 0, z);
  }

  /** Clean up all meshes */
  dispose(): void {
    const disposeGroup = (group: THREE.Group) => {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
          if (child.geometry) {
            child.geometry.dispose();
          }
        }
      });
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
      group.removeFromParent();
    };

    disposeGroup(this.mapGroup);
    for (const ghost of this.wrapGroups) {
      disposeGroup(ghost);
    }
    this.wrapGroups = [];
  }
}
