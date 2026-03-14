import * as THREE from 'three';
import { HexGrid, HEX_SIZE } from '../game/HexGrid';
import type { FogOfWarManager } from '../game/FogOfWarManager';
import { MapRenderer } from './MapRenderer';

/** Precompute hex vertices for pointy-top hex */
const HEX_VERTICES: { x: number; z: number }[] = [];
for (let i = 0; i < 6; i++) {
  const angle = (Math.PI / 180) * (60 * i + 30);
  HEX_VERTICES.push({
    x: HEX_SIZE * Math.cos(angle),
    z: HEX_SIZE * Math.sin(angle),
  });
}

/**
 * Renders fog of war overlay on the hex map.
 *
 * - Unexplored hexes: nearly opaque black (opacity 0.95)
 * - Explored hexes: dimmed dark overlay (opacity 0.4)
 * - Visible hexes: no overlay rendered
 *
 * Uses merged geometry (same pattern as TerritoryRenderer) with
 * world wrapping ghost copies. Rebuilds only when FogOfWarManager
 * version changes.
 */
export class FogOfWarRenderer {
  private group: THREE.Group;
  private wrapGroups: THREE.Group[] = [];
  private grid: HexGrid;
  private unexploredMesh: THREE.Mesh | null = null;
  private exploredMesh: THREE.Mesh | null = null;
  private lastVersion = -1;
  private playerId = 1;
  private _enabled = true;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'fog_of_war';
    this.grid = new HexGrid(1, 1);
  }

  setPlayerId(playerId: number): void {
    this.playerId = playerId;
    this.lastVersion = -1; // Force rebuild
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    this.group.visible = enabled;
    for (const g of this.wrapGroups) g.visible = enabled;
    if (!enabled) {
      this.clearMeshes();
    } else {
      this.lastVersion = -1; // Force rebuild on next sync
    }
  }

  isEnabled(): boolean {
    return this._enabled;
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
      ghost.name = `fog_ghost_${mq}_${mr}`;
      scene.add(ghost);
      this.wrapGroups.push(ghost);
    }
  }

  /**
   * Rebuild fog overlay when visibility changes.
   * Call each frame — internally tracks version to avoid redundant rebuilds.
   */
  sync(fogManager: FogOfWarManager): void {
    if (!this._enabled) return;
    const version = fogManager.getVersion();
    if (version === this.lastVersion) return;
    this.lastVersion = version;

    this.rebuild(fogManager);
  }

  private rebuild(fogManager: FogOfWarManager): void {
    this.clearMeshes();

    const unexploredVerts: Float32Array[] = [];
    const exploredVerts: Float32Array[] = [];

    for (let q = 0; q < this.grid.width; q++) {
      for (let r = 0; r < this.grid.height; r++) {
        const vis = fogManager.getVisibility(q, r, this.playerId);
        if (vis === 2) continue; // Visible — no overlay

        const { x, z } = HexGrid.hexToWorld(q, r);
        const tile = this.grid.getTile(q, r);
        const y = (tile ? MapRenderer.getTileY(tile) : 0) + 0.15;

        const verts = this.createHexFillVertices(x, y, z);

        if (vis === 0) {
          unexploredVerts.push(verts);
        } else {
          exploredVerts.push(verts);
        }
      }
    }

    if (unexploredVerts.length > 0) {
      this.unexploredMesh = this.createMergedMesh(unexploredVerts, 0x000000, 0.92);
      this.group.add(this.unexploredMesh);
      for (const ghost of this.wrapGroups) {
        ghost.add(this.unexploredMesh.clone());
      }
    }

    if (exploredVerts.length > 0) {
      this.exploredMesh = this.createMergedMesh(exploredVerts, 0x111111, 0.45);
      this.group.add(this.exploredMesh);
      for (const ghost of this.wrapGroups) {
        ghost.add(this.exploredMesh.clone());
      }
    }
  }

  /** Create 6 triangle vertices for hex fill (fan from center) */
  private createHexFillVertices(cx: number, y: number, cz: number): Float32Array {
    const verts = new Float32Array(6 * 3 * 3); // 6 triangles * 3 vertices * 3 coords
    for (let i = 0; i < 6; i++) {
      const v0 = HEX_VERTICES[i];
      const v1 = HEX_VERTICES[(i + 1) % 6];
      const offset = i * 9;
      verts[offset] = cx;
      verts[offset + 1] = y;
      verts[offset + 2] = cz;
      verts[offset + 3] = cx + v0.x;
      verts[offset + 4] = y;
      verts[offset + 5] = cz + v0.z;
      verts[offset + 6] = cx + v1.x;
      verts[offset + 7] = y;
      verts[offset + 8] = cz + v1.z;
    }
    return verts;
  }

  /** Merge multiple Float32Arrays into one mesh */
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
    const disposeMesh = (mesh: THREE.Mesh | null) => {
      if (!mesh) return;
      this.group.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) mesh.material.dispose();
    };

    disposeMesh(this.unexploredMesh);
    disposeMesh(this.exploredMesh);
    this.unexploredMesh = null;
    this.exploredMesh = null;

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
