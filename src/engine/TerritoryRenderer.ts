import * as THREE from 'three';
import { HexGrid, HEX_SIZE } from '../game/HexGrid';
import type { TerritoryManager } from '../game/TerritoryManager';
import { MapRenderer } from './MapRenderer';
import { PLAYER_COLORS, DEFAULT_PLAYER_COLOR } from './PlayerColors';

/** Territory border line thickness */
const BORDER_WIDTH = 0.06;
/** Territory border height above ground */
const BORDER_Y_OFFSET = 0.08;
/** Territory fill opacity */
const FILL_OPACITY = 0.12;

/**
 * 6 edges of a pointy-top hex, as pairs of vertex indices.
 * Vertex i is at angle (30° + 60°*i) from the +x axis.
 *
 * Pointy-top vertex positions (x, z) for HEX_SIZE=1:
 *   v0: ( 0.866,  0.5)  — 30°
 *   v1: ( 0,      1.0)  — 90°
 *   v2: (-0.866,  0.5)  — 150°
 *   v3: (-0.866, -0.5)  — 210°
 *   v4: ( 0,     -1.0)  — 270°
 *   v5: ( 0.866, -0.5)  — 330°
 *
 * Each edge's outward normal matches a neighbor direction:
 *   Edge 0 (v0→v1): outward at  60° → neighbor (q+0, r+1)   +z direction
 *   Edge 1 (v1→v2): outward at 120° → neighbor (q-1, r+1)
 *   Edge 2 (v2→v3): outward at 180° → neighbor (q-1, r+0)   -x direction
 *   Edge 3 (v3→v4): outward at 240° → neighbor (q+0, r-1)
 *   Edge 4 (v4→v5): outward at 300° → neighbor (q+1, r-1)
 *   Edge 5 (v5→v0): outward at   0° → neighbor (q+1, r+0)   +x direction
 */
const EDGE_NEIGHBORS = [
  { dq: 0, dr: 1 },   // edge 0 (v0→v1): outward 60°
  { dq: -1, dr: 1 },  // edge 1 (v1→v2): outward 120°
  { dq: -1, dr: 0 },  // edge 2 (v2→v3): outward 180°
  { dq: 0, dr: -1 },  // edge 3 (v3→v4): outward 240°
  { dq: 1, dr: -1 },  // edge 4 (v4→v5): outward 300°
  { dq: 1, dr: 0 },   // edge 5 (v5→v0): outward 0°
];

/** Compute hex vertex position for pointy-top hex */
function hexVertex(index: number): { x: number; z: number } {
  const angle = (Math.PI / 180) * (60 * index + 30); // pointy-top: start at 30°
  return {
    x: HEX_SIZE * Math.cos(angle),
    z: HEX_SIZE * Math.sin(angle),
  };
}

// Precompute vertices
const HEX_VERTICES = Array.from({ length: 6 }, (_, i) => hexVertex(i));

/**
 * Renders territory borders and fill overlays on the hex map.
 * Borders appear on hex edges that separate territory from non-territory
 * or from another player's territory.
 */
export class TerritoryRenderer {
  private group: THREE.Group;
  private wrapGroups: THREE.Group[] = [];
  private grid: HexGrid;
  private borderMeshes: THREE.Mesh[] = [];
  private fillMeshes: THREE.Mesh[] = [];
  private lastTerritoryVersion = -1;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'territory';
    this.grid = new HexGrid(1, 1);
  }

  addToScene(scene: THREE.Scene, grid: HexGrid): void {
    this.grid = grid;
    scene.add(this.group);

    // World wrapping ghost copies
    const { wrapQ, wrapR } = grid.getWrapVectors();
    const multipliers = [
      { mq: -1, mr: 0 }, { mq: 1, mr: 0 },
      { mq: 0, mr: -1 }, { mq: 0, mr: 1 },
      { mq: -1, mr: -1 }, { mq: 1, mr: -1 },
      { mq: -1, mr: 1 }, { mq: 1, mr: 1 },
    ];

    for (const { mq, mr } of multipliers) {
      const ghost = new THREE.Group();
      ghost.position.set(
        mq * wrapQ.x + mr * wrapR.x,
        0,
        mq * wrapQ.z + mr * wrapR.z,
      );
      ghost.name = `territory_ghost_${mq}_${mr}`;
      scene.add(ghost);
      this.wrapGroups.push(ghost);
    }
  }

  /**
   * Rebuild territory visualization when territory changes.
   * Call each frame — internally tracks version to avoid redundant rebuilds.
   */
  sync(territoryManager: TerritoryManager): void {
    const version = territoryManager.getVersion();
    if (version === this.lastTerritoryVersion) return;
    this.lastTerritoryVersion = version;

    this.rebuild(territoryManager.getTerritoryMap());
  }

  private rebuild(territoryMap: ReadonlyMap<string, number>): void {
    // Clear existing meshes
    this.clearMeshes();

    if (territoryMap.size === 0) return;

    // Group borders and fills by player for batching
    const playerBorders: Map<number, Float32Array[]> = new Map();
    const playerFills: Map<number, Float32Array[]> = new Map();

    for (const [key, playerId] of territoryMap) {
      const [q, r] = key.split(',').map(Number);
      const { x, z } = HexGrid.hexToWorld(q, r);
      const tile = this.grid.getTile(q, r);
      const y = tile ? MapRenderer.getTileY(tile) : 0;

      // Add fill overlay
      if (!playerFills.has(playerId)) playerFills.set(playerId, []);
      playerFills.get(playerId)!.push(this.createFillVertices(x, y + 0.02, z));

      // Check each edge for border
      for (let edge = 0; edge < 6; edge++) {
        const neighbor = EDGE_NEIGHBORS[edge];
        const nq = q + neighbor.dq;
        const nr = r + neighbor.dr;
        const wrapped = this.grid.wrap(nq, nr);
        const nKey = HexGrid.key(wrapped.q, wrapped.r);
        const neighborOwner = territoryMap.get(nKey);

        // Draw border if neighbor is unowned or owned by another player
        if (neighborOwner !== playerId) {
          if (!playerBorders.has(playerId)) playerBorders.set(playerId, []);
          playerBorders.get(playerId)!.push(
            this.createBorderVertices(x, y + BORDER_Y_OFFSET, z, edge),
          );
        }
      }
    }

    // Create merged meshes per player
    for (const [playerId, borderArrays] of playerBorders) {
      const color = PLAYER_COLORS[playerId] ?? DEFAULT_PLAYER_COLOR;
      const mesh = this.createMergedMesh(borderArrays, color, 0.8);
      this.group.add(mesh);
      this.borderMeshes.push(mesh);

      // Ghost clones
      for (const ghost of this.wrapGroups) {
        const clone = mesh.clone();
        ghost.add(clone);
      }
    }

    for (const [playerId, fillArrays] of playerFills) {
      const color = PLAYER_COLORS[playerId] ?? DEFAULT_PLAYER_COLOR;
      const mesh = this.createMergedMesh(fillArrays, color, FILL_OPACITY);
      this.group.add(mesh);
      this.fillMeshes.push(mesh);

      // Ghost clones
      for (const ghost of this.wrapGroups) {
        const clone = mesh.clone();
        ghost.add(clone);
      }
    }
  }

  /** Create 6 triangle vertices for hex fill */
  private createFillVertices(cx: number, y: number, cz: number): Float32Array {
    // 6 triangles (fan from center)
    const verts = new Float32Array(6 * 3 * 3); // 6 triangles * 3 vertices * 3 components
    for (let i = 0; i < 6; i++) {
      const v0 = HEX_VERTICES[i];
      const v1 = HEX_VERTICES[(i + 1) % 6];
      const offset = i * 9;
      // center
      verts[offset] = cx;
      verts[offset + 1] = y;
      verts[offset + 2] = cz;
      // v0
      verts[offset + 3] = cx + v0.x;
      verts[offset + 4] = y;
      verts[offset + 5] = cz + v0.z;
      // v1
      verts[offset + 6] = cx + v1.x;
      verts[offset + 7] = y;
      verts[offset + 8] = cz + v1.z;
    }
    return verts;
  }

  /** Create a thick border segment (quad = 2 triangles) for one hex edge */
  private createBorderVertices(cx: number, y: number, cz: number, edge: number): Float32Array {
    const v0 = HEX_VERTICES[edge];
    const v1 = HEX_VERTICES[(edge + 1) % 6];

    // Compute outward normal direction for thickness
    const midX = (v0.x + v1.x) / 2;
    const midZ = (v0.z + v1.z) / 2;
    const len = Math.sqrt(midX * midX + midZ * midZ);
    const nx = (midX / len) * BORDER_WIDTH;
    const nz = (midZ / len) * BORDER_WIDTH;

    // Inner and outer edge points
    const ax = cx + v0.x - nx;
    const az = cz + v0.z - nz;
    const bx = cx + v1.x - nx;
    const bz = cz + v1.z - nz;
    const cx2 = cx + v1.x + nx;
    const cz2 = cz + v1.z + nz;
    const dx = cx + v0.x + nx;
    const dz = cz + v0.z + nz;

    // 2 triangles for the quad
    return new Float32Array([
      ax, y, az, bx, y, bz, cx2, y, cz2,
      ax, y, az, cx2, y, cz2, dx, y, dz,
    ]);
  }

  /** Merge multiple Float32Arrays into one BufferGeometry mesh */
  private createMergedMesh(
    vertexArrays: Float32Array[],
    color: number,
    opacity: number,
  ): THREE.Mesh {
    const totalLength = vertexArrays.reduce((sum, arr) => sum + arr.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const arr of vertexArrays) {
      merged.set(arr, offset);
      offset += arr.length;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(merged, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    return new THREE.Mesh(geometry, material);
  }

  private clearMeshes(): void {
    for (const mesh of [...this.borderMeshes, ...this.fillMeshes]) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) mesh.material.dispose();
    }
    this.borderMeshes = [];
    this.fillMeshes = [];

    // Clear ghost groups
    for (const ghost of this.wrapGroups) {
      while (ghost.children.length > 0) {
        const child = ghost.children[0];
        ghost.remove(child);
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (child.material instanceof THREE.Material) child.material.dispose();
        }
      }
    }
  }

  dispose(): void {
    this.clearMeshes();
    this.group.removeFromParent();
    for (const ghost of this.wrapGroups) {
      ghost.removeFromParent();
    }
    this.wrapGroups = [];
  }
}
