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
 * - Unexplored hexes: dark blue-grey tint (opacity 0.70)
 * - Explored hexes: subtle blue-grey tint (opacity 0.25)
 * - Visible hexes: no overlay rendered
 *
 * Uses merged geometry (same pattern as TerritoryRenderer).
 * Rebuilds only when FogOfWarManager version changes.
 */
export class FogOfWarRenderer {
  private group: THREE.Group;
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
    const unexploredAlphas: Float32Array[] = [];
    const exploredVerts: Float32Array[] = [];
    const exploredAlphas: Float32Array[] = [];

    for (let q = 0; q < this.grid.width; q++) {
      for (let r = 0; r < this.grid.height; r++) {
        const vis = fogManager.getVisibility(q, r, this.playerId);
        if (vis === 2) continue; // Visible — no overlay

        const { x, z } = HexGrid.hexToWorld(q, r);
        const tile = this.grid.getTile(q, r);
        const y = (tile ? MapRenderer.getTileY(tile) : 0) + 0.15;

        // Check if any neighbor is visible (for edge softening)
        const hasVisibleNeighbor = this.hasVisibleNeighbor(q, r, fogManager);

        const verts = this.createHexFillVertices(x, y, z);
        // Edge softening: hex tiles adjacent to visible tiles get softer edges
        const alphas = this.createHexAlphas(hasVisibleNeighbor);

        if (vis === 0) {
          unexploredVerts.push(verts);
          unexploredAlphas.push(alphas);
        } else {
          exploredVerts.push(verts);
          exploredAlphas.push(alphas);
        }
      }
    }

    if (unexploredVerts.length > 0) {
      this.unexploredMesh = this.createMergedMeshWithAlpha(unexploredVerts, unexploredAlphas, 0x111828, 0.75);
      this.group.add(this.unexploredMesh);
    }

    if (exploredVerts.length > 0) {
      // Explored-but-not-visible: desaturated blue-grey, lower opacity
      this.exploredMesh = this.createMergedMeshWithAlpha(exploredVerts, exploredAlphas, 0x283040, 0.20);
      this.group.add(this.exploredMesh);
    }
  }

  /** Check if any hex neighbor is visible (for edge softening) */
  private hasVisibleNeighbor(q: number, r: number, fogManager: FogOfWarManager): boolean {
    // Hex neighbor offsets (pointy-top)
    const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
    for (const [dq, dr] of neighbors) {
      const nq = q + dq;
      const nr = r + dr;
      if (nq >= 0 && nq < this.grid.width && nr >= 0 && nr < this.grid.height) {
        if (fogManager.getVisibility(nq, nr, this.playerId) === 2) return true;
      }
    }
    return false;
  }

  /** Create per-vertex alpha multipliers for edge softening */
  private createHexAlphas(hasVisibleNeighbor: boolean): Float32Array {
    const alphas = new Float32Array(6 * 3); // 6 triangles * 3 vertices
    const centerAlpha = 1.0;
    const edgeAlpha = hasVisibleNeighbor ? 0.3 : 1.0; // Soften edges near visible tiles
    for (let i = 0; i < 6; i++) {
      const offset = i * 3;
      alphas[offset] = centerAlpha; // center vertex
      alphas[offset + 1] = edgeAlpha; // edge vertex 1
      alphas[offset + 2] = edgeAlpha; // edge vertex 2
    }
    return alphas;
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

  /** Merge vertex arrays with per-vertex alpha for edge softening */
  private createMergedMeshWithAlpha(
    vertexArrays: Float32Array[],
    alphaArrays: Float32Array[],
    color: number,
    baseOpacity: number,
  ): THREE.Mesh {
    const totalVerts = vertexArrays.reduce((sum, arr) => sum + arr.length, 0);
    const mergedPos = new Float32Array(totalVerts);
    let posOffset = 0;
    for (const arr of vertexArrays) {
      mergedPos.set(arr, posOffset);
      posOffset += arr.length;
    }

    const totalAlphas = alphaArrays.reduce((sum, arr) => sum + arr.length, 0);
    const mergedAlpha = new Float32Array(totalAlphas);
    let alphaOffset = 0;
    for (const arr of alphaArrays) {
      mergedAlpha.set(arr, alphaOffset);
      alphaOffset += arr.length;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(mergedAlpha, 1));

    const col = new THREE.Color(color);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: col },
        uOpacity: { value: baseOpacity },
      },
      vertexShader: `
        attribute float aAlpha;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(uColor, uOpacity * vAlpha);
        }
      `,
      transparent: true,
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
  }

  dispose(): void {
    this.clearMeshes();
    this.group.removeFromParent();
  }
}
