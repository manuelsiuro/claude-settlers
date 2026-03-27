import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import { TerrainType } from '../game/TerrainType';
import { MapRenderer } from './MapRenderer';
import { assetLoader } from './AssetLoader';
import { createRng } from '../game/noise';
import {
  BEE_MODEL_SCALE, BEE_MAX_COUNT_DESKTOP, BEE_MAX_COUNT_MOBILE,
  BEE_WING_FLAP_FREQ, BEE_WING_FLAP_AMPLITUDE,
  BEE_WANDER_RADIUS, BEE_HOVER_HEIGHT,
  BEE_NIGHTNESS_FADE_START, BEE_NIGHTNESS_FADE_END,
} from '../game/data/balanceConstants';

// ── Types ──

interface SubMeshInfo {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  localMatrix: THREE.Matrix4;
  name: string;
}

/** Smooth interpolation matching GLSL smoothstep */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Renders ambient bees near grassland flower positions using 3D .glb models
 * via InstancedMesh. Wings flap at high frequency. Bees wander near their
 * home position using composite sine waves and fade out at night.
 */
export class BeeRenderer {
  private meshes: THREE.InstancedMesh[] = [];
  private subMeshInfos: SubMeshInfo[] = [];
  private wingLeftIndices: number[] = [];
  private wingRightIndices: number[] = [];
  private homePositions: THREE.Vector3[] = [];
  private beePhases: Float32Array = new Float32Array(0);
  private beeCount = 0;
  private elapsedTime = 0;
  private enabled = true;
  private windDirection = new THREE.Vector2(1.0, 0.3).normalize();
  private scene: THREE.Scene | null = null;

  // Scratch objects
  private readonly _matrix = new THREE.Matrix4();
  private readonly _localMatrix = new THREE.Matrix4();
  private readonly _wingRot = new THREE.Matrix4();
  private readonly _position = new THREE.Vector3();
  private readonly _quaternion = new THREE.Quaternion();
  private readonly _euler = new THREE.Euler();
  private readonly _scale = new THREE.Vector3();

  addToScene(scene: THREE.Scene, grid: HexGrid): void {
    this.scene = scene;
    const isMobile = window.innerWidth <= 768;
    const maxCount = isMobile ? BEE_MAX_COUNT_MOBILE : BEE_MAX_COUNT_DESKTOP;

    this.homePositions = this.findGrasslandPositions(grid, maxCount);
    this.beeCount = this.homePositions.length;
    if (this.beeCount === 0) return;

    // Initialize per-bee phases
    const rng = createRng(8888);
    this.beePhases = new Float32Array(this.beeCount);
    for (let i = 0; i < this.beeCount; i++) {
      this.beePhases[i] = rng() * Math.PI * 2;
    }

    this.buildMeshes();
  }

  setNightness(nightness: number): void {
    const alpha = smoothstep(BEE_NIGHTNESS_FADE_END, BEE_NIGHTNESS_FADE_START, nightness);
    for (const mesh of this.meshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = alpha;
      mat.transparent = alpha < 1;
    }
  }

  setWindDirection(dir: THREE.Vector2): void {
    this.windDirection.copy(dir).normalize();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    for (const mesh of this.meshes) {
      mesh.visible = enabled;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(deltaTime: number, _cameraPosition: THREE.Vector3, _frustum: number): void {
    if (!this.enabled || this.beeCount === 0 || this.meshes.length === 0) return;

    this.elapsedTime += deltaTime;
    const time = this.elapsedTime;
    const windX = this.windDirection.x;
    const windZ = this.windDirection.y;

    let instanceIdx = 0;

    for (let bi = 0; bi < this.beeCount; bi++) {
      const home = this.homePositions[bi];
      const phase = this.beePhases[bi];
      const t = time * 0.8 + phase;

      // Wandering position (same formulas as old vertex shader, with bounded wind)
      const windOffset = Math.sin(time * 0.1 + phase) * BEE_WANDER_RADIUS;
      const px = home.x + Math.sin(t * 1.1) * BEE_WANDER_RADIUS + Math.sin(t * 0.3 + phase) * 0.3 + windX * windOffset;
      const py = home.y + BEE_HOVER_HEIGHT + Math.sin(t * 1.5 + phase * 3.0) * 0.15 + Math.abs(Math.sin(t * 0.7)) * 0.1;
      const pz = home.z + Math.cos(t * 0.9 + phase * 2.0) * BEE_WANDER_RADIUS + Math.sin(t * 0.4) * 0.3 + windZ * windOffset;

      // Compute facing direction from movement (use slight time offset for derivative)
      const dt = 0.01;
      const t2 = t + dt;
      const windOffset2 = Math.sin((time + dt) * 0.1 + phase) * BEE_WANDER_RADIUS;
      const nx = home.x + Math.sin(t2 * 1.1) * BEE_WANDER_RADIUS + Math.sin(t2 * 0.3 + phase) * 0.3 + windX * windOffset2;
      const nz = home.z + Math.cos(t2 * 0.9 + phase * 2.0) * BEE_WANDER_RADIUS + Math.sin(t2 * 0.4) * 0.3 + windZ * windOffset2;
      // Model faces -Z after Blender Y-up → GLTF conversion
      const yaw = Math.atan2(nx - px, nz - pz) + Math.PI;

      this._position.set(px, py, pz);
      this._euler.set(0, yaw, 0);
      this._quaternion.setFromEuler(this._euler);
      this._scale.set(BEE_MODEL_SCALE, BEE_MODEL_SCALE, BEE_MODEL_SCALE);
      this._matrix.compose(this._position, this._quaternion, this._scale);

      // Wing flap (fast frequency for bees)
      const flapAngle = Math.sin(time * BEE_WING_FLAP_FREQ + phase * 5.0) * BEE_WING_FLAP_AMPLITUDE;

      for (let mi = 0; mi < this.meshes.length; mi++) {
        const isWingLeft = this.wingLeftIndices.includes(mi);
        const isWingRight = this.wingRightIndices.includes(mi);

        if (isWingLeft || isWingRight) {
          const angle = isWingLeft ? flapAngle : -flapAngle;
          this._wingRot.makeRotationZ(angle);
          this._localMatrix.multiplyMatrices(this.subMeshInfos[mi].localMatrix, this._wingRot);
          this._localMatrix.premultiply(this._matrix);
          this.meshes[mi].setMatrixAt(instanceIdx, this._localMatrix);
        } else {
          this._localMatrix.multiplyMatrices(this._matrix, this.subMeshInfos[mi].localMatrix);
          this.meshes[mi].setMatrixAt(instanceIdx, this._localMatrix);
        }
      }
      instanceIdx++;
    }

    for (const mesh of this.meshes) {
      mesh.count = instanceIdx;
      if (instanceIdx > 0) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    this.meshes = [];
    this.subMeshInfos = [];
    this.wingLeftIndices = [];
    this.wingRightIndices = [];
    this.homePositions = [];
    this.scene = null;
  }

  // ── Private Methods ──

  private findGrasslandPositions(grid: HexGrid, count: number): THREE.Vector3[] {
    const rng = createRng(7777);
    const tiles = grid.getAllTiles();
    const grasslandTiles = tiles.filter((t) => t.terrain === TerrainType.Grassland);

    if (grasslandTiles.length === 0) return [];

    for (let i = grasslandTiles.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [grasslandTiles[i], grasslandTiles[j]] = [grasslandTiles[j], grasslandTiles[i]];
    }

    const positions: THREE.Vector3[] = [];
    const numPositions = Math.min(count, grasslandTiles.length);

    for (let i = 0; i < numPositions; i++) {
      const tile = grasslandTiles[i];
      const { x, z } = HexGrid.hexToWorld(tile.coord.q, tile.coord.r);
      const y = MapRenderer.getTileY(tile);
      positions.push(new THREE.Vector3(
        x + (rng() - 0.5) * 0.6,
        y + 0.15,
        z + (rng() - 0.5) * 0.6,
      ));
    }

    return positions;
  }

  private buildMeshes(): void {
    if (!this.scene || this.beeCount === 0) return;

    this.subMeshInfos = this.getSubMeshes();
    if (this.subMeshInfos.length === 0) {
      this.createFallbackMesh();
      return;
    }

    for (let i = 0; i < this.subMeshInfos.length; i++) {
      const name = this.subMeshInfos[i].name.toLowerCase();
      if (name.includes('wing_left') || name.includes('wing_l')) {
        this.wingLeftIndices.push(i);
      } else if (name.includes('wing_right') || name.includes('wing_r')) {
        this.wingRightIndices.push(i);
      }
    }

    for (const sub of this.subMeshInfos) {
      const mat = (sub.material as THREE.MeshStandardMaterial).clone();
      mat.transparent = true;
      const instMesh = new THREE.InstancedMesh(sub.geometry, mat, this.beeCount);
      instMesh.frustumCulled = false;
      instMesh.count = 0;
      const identity = new THREE.Matrix4();
      for (let i = 0; i < this.beeCount; i++) {
        instMesh.setMatrixAt(i, identity);
      }
      instMesh.instanceMatrix.needsUpdate = true;
      this.scene.add(instMesh);
      this.meshes.push(instMesh);
    }
  }

  private getSubMeshes(): SubMeshInfo[] {
    const model = assetLoader.getRawModel('bee');
    if (!model) return [];
    model.updateWorldMatrix(true, true);
    const results: SubMeshInfo[] = [];
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        results.push({
          geometry: child.geometry,
          material: child.material as THREE.Material,
          localMatrix: child.matrixWorld.clone(),
          name: child.name,
        });
      }
    });
    return results;
  }

  private createFallbackMesh(): void {
    if (!this.scene) return;
    const geo = new THREE.BoxGeometry(0.1, 0.08, 0.06);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffd700, transparent: true });
    const mesh = new THREE.InstancedMesh(geo, mat, this.beeCount);
    mesh.frustumCulled = false;
    mesh.count = 0;
    const identity = new THREE.Matrix4();
    for (let i = 0; i < this.beeCount; i++) {
      mesh.setMatrixAt(i, identity);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);
    this.subMeshInfos.push({
      geometry: geo,
      material: mat,
      localMatrix: new THREE.Matrix4(),
      name: 'fallback_body',
    });
  }
}
