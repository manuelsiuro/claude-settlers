import * as THREE from 'three';
import { HexGrid, HEX_SIZE } from '../game/HexGrid';
import type { HexCoord } from '../game/HexGrid';
import type { Building } from '../game/Building';
import { getEffectiveWorkRadius } from '../game/BuildingUpgrade';
import { MapRenderer } from './MapRenderer';

/** Fill color (teal) */
const FILL_COLOR = 0x00bfa5;
/** Fill opacity */
const FILL_OPACITY = 0.08;
/** Y offset above terrain to avoid z-fighting */
const Y_OFFSET = 0.04;

/** Compute hex vertex position for pointy-top hex */
function hexVertex(index: number): { x: number; z: number } {
  const angle = (Math.PI / 180) * (60 * index + 30);
  return {
    x: HEX_SIZE * Math.cos(angle),
    z: HEX_SIZE * Math.sin(angle),
  };
}

const HEX_VERTICES = Array.from({ length: 6 }, (_, i) => hexVertex(i));

/** Create 6-triangle fan vertices for one hex fill */
function createFillVertices(cx: number, y: number, cz: number): Float32Array {
  const verts = new Float32Array(6 * 3 * 3); // 6 triangles, 3 verts each, 3 components
  for (let i = 0; i < 6; i++) {
    const v0 = HEX_VERTICES[i];
    const v1 = HEX_VERTICES[(i + 1) % 6];
    const offset = i * 9;
    // Center
    verts[offset] = cx;
    verts[offset + 1] = y;
    verts[offset + 2] = cz;
    // Vertex i
    verts[offset + 3] = cx + v0.x;
    verts[offset + 4] = y;
    verts[offset + 5] = cz + v0.z;
    // Vertex i+1
    verts[offset + 6] = cx + v1.x;
    verts[offset + 7] = y;
    verts[offset + 8] = cz + v1.z;
  }
  return verts;
}

/**
 * Renders a semi-transparent hex overlay showing a building's work area.
 * Shows when a building with workRadius > 0 is selected, hides on deselect.
 */
export class WorkAreaRenderer {
  private mesh: THREE.Mesh | null = null;
  private scene: THREE.Scene | null = null;

  addToScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  /** Show work area overlay for a building */
  show(building: Building, grid: HexGrid): void {
    this.hide();
    if (!this.scene) return;

    const radius = getEffectiveWorkRadius(building);
    if (radius <= 0) return;

    // BFS from building coord to collect all hex coords within radius
    const coords: HexCoord[] = [];
    const visited = new Set<string>();
    const originKey = HexGrid.key(building.coord.q, building.coord.r);
    visited.add(originKey);
    coords.push(building.coord);

    let frontier: HexCoord[] = [building.coord];
    for (let dist = 1; dist <= radius; dist++) {
      const nextFrontier: HexCoord[] = [];
      for (const pos of frontier) {
        const neighbors = grid.getNeighbors(pos.q, pos.r);
        for (const neighbor of neighbors) {
          const key = HexGrid.key(neighbor.coord.q, neighbor.coord.r);
          if (visited.has(key)) continue;
          visited.add(key);
          coords.push(neighbor.coord);
          nextFrontier.push(neighbor.coord);
        }
      }
      frontier = nextFrontier;
      if (frontier.length === 0) break;
    }

    // Build merged vertex array
    const vertArrays: Float32Array[] = [];
    for (const coord of coords) {
      const tile = grid.getTile(coord.q, coord.r);
      if (!tile) continue;
      const { x, z } = HexGrid.hexToWorld(coord.q, coord.r);
      const y = MapRenderer.getTileY(tile) + Y_OFFSET;
      vertArrays.push(createFillVertices(x, y, z));
    }

    if (vertArrays.length === 0) return;

    // Merge into single buffer
    const totalVerts = vertArrays.reduce((sum, a) => sum + a.length, 0);
    const merged = new Float32Array(totalVerts);
    let offset = 0;
    for (const arr of vertArrays) {
      merged.set(arr, offset);
      offset += arr.length;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(merged, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      color: FILL_COLOR,
      transparent: true,
      opacity: FILL_OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'work-area-overlay';
    this.scene.add(this.mesh);
  }

  /** Hide the work area overlay */
  hide(): void {
    if (this.mesh && this.scene) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }
  }

  dispose(): void {
    this.hide();
    this.scene = null;
  }
}
