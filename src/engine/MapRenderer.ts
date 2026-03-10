import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import { createHexTileMesh, createDecorations } from './TerrainMeshFactory';

/**
 * Renders a HexGrid as 3D terrain in a Three.js scene.
 * Supports world wrapping by rendering ghost copies at map edges.
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

    // World wrapping: create 8 ghost copies offset in each direction
    const bounds = this.getMapBounds(grid);
    const mapW = bounds.maxX - bounds.minX;
    const mapH = bounds.maxZ - bounds.minZ;

    const offsets = [
      { x: -mapW, z: 0 },
      { x: mapW, z: 0 },
      { x: 0, z: -mapH },
      { x: 0, z: mapH },
      { x: -mapW, z: -mapH },
      { x: mapW, z: -mapH },
      { x: -mapW, z: mapH },
      { x: mapW, z: mapH },
    ];

    for (const offset of offsets) {
      const ghost = this.mapGroup.clone();
      ghost.position.set(offset.x, 0, offset.z);
      ghost.name = `map_ghost_${offset.x}_${offset.z}`;
      scene.add(ghost);
      this.wrapGroups.push(ghost);
    }
  }

  private buildTileGroup(grid: HexGrid, group: THREE.Group): void {
    const tiles = grid.getAllTiles();

    for (const tile of tiles) {
      const { x, z } = HexGrid.hexToWorld(tile.coord.q, tile.coord.r);

      // Ground hex tile
      const hexMesh = createHexTileMesh(tile);
      hexMesh.position.set(x, 0, z);
      hexMesh.name = `tile_${tile.coord.q}_${tile.coord.r}`;
      group.add(hexMesh);

      // Decorations
      const decorations = createDecorations(tile);
      if (decorations) {
        decorations.position.set(x, 0, z);
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

  /** Compute approximate map bounds */
  getMapBounds(grid: HexGrid): { minX: number; maxX: number; minZ: number; maxZ: number } {
    const topLeft = HexGrid.hexToWorld(0, 0);
    const bottomRight = HexGrid.hexToWorld(grid.width - 1, grid.height - 1);
    const padding = 1.5;
    return {
      minX: Math.min(topLeft.x, HexGrid.hexToWorld(0, grid.height - 1).x) - padding,
      maxX: Math.max(bottomRight.x, HexGrid.hexToWorld(grid.width - 1, 0).x) + padding,
      minZ: topLeft.z - padding,
      maxZ: bottomRight.z + padding,
    };
  }

  /** Clean up all meshes */
  dispose(): void {
    const disposeGroup = (group: THREE.Group) => {
      while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        if (child instanceof THREE.Mesh) {
          // Don't dispose shared geometries
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
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
