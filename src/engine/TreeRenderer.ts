import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import type { TreeManager } from '../game/TreeManager';
import { MapRenderer } from './MapRenderer';
import { assetLoader } from './AssetLoader';

/** World-wrap offset multipliers (8 neighbors) */
const WRAP_MULTIPLIERS = [
  { mq: -1, mr: 0 }, { mq: 1, mr: 0 },
  { mq: 0, mr: -1 }, { mq: 0, mr: 1 },
  { mq: -1, mr: -1 }, { mq: 1, mr: -1 },
  { mq: -1, mr: 1 }, { mq: 1, mr: 1 },
];

/** Growth stage → visual scale multiplier */
const GROWTH_SCALE: Record<string, number> = {
  sapling: 0.4,
  young: 0.7,
  mature: 1.0,
};

/** Sub-mesh info extracted from a GLTF model Group */
interface SubMeshInfo {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  localMatrix: THREE.Matrix4;
}

/**
 * Renders tree entities as InstancedMeshes, separate from MapRenderer decorations.
 * Uses dirty-flag + full rebuild strategy: when markDirty() is called, the next
 * sync() call rebuilds all tree instances.
 */
export class TreeRenderer {
  dirty = false;
  private instancedMeshes: THREE.InstancedMesh[] = [];
  private ghostMeshes: THREE.InstancedMesh[] = [];
  private scene: THREE.Scene | null = null;

  addToScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  markDirty(): void {
    this.dirty = true;
  }

  /** Rebuild tree instances if dirty */
  sync(treeManager: TreeManager, grid: HexGrid): void {
    if (!this.dirty || !this.scene) return;
    this.dirty = false;

    // Remove old meshes
    this.removeAllMeshes();

    const trees = treeManager.getAllTrees();
    if (trees.length === 0) return;

    const wrapOffsets = this.getWrapOffsets(grid);

    // Group trees by (modelType) → list of placement matrices
    const placementsByModel = new Map<string, THREE.Matrix4[]>();

    for (const tree of trees) {
      const { x, z } = HexGrid.hexToWorld(tree.tileCoord.q, tree.tileCoord.r);
      const tile = grid.getTile(tree.tileCoord.q, tree.tileCoord.r);
      const y = tile ? MapRenderer.getTileY(tile) : 0;

      const growthMult = GROWTH_SCALE[tree.growthStage] ?? 1.0;
      const finalScale = tree.scale * growthMult;

      const matrix = new THREE.Matrix4();
      const pos = new THREE.Vector3(x + tree.localX, y, z + tree.localZ);
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, tree.rotationY, 0));
      const scl = new THREE.Vector3(finalScale, finalScale, finalScale);
      matrix.compose(pos, quat, scl);

      let list = placementsByModel.get(tree.modelType);
      if (!list) {
        list = [];
        placementsByModel.set(tree.modelType, list);
      }
      list.push(matrix);
    }

    // Create InstancedMeshes
    const combinedMatrix = new THREE.Matrix4();

    for (const [modelName, instanceMatrices] of placementsByModel) {
      const subMeshes = this.getSubMeshes(modelName);
      if (subMeshes.length === 0) continue;

      for (const sub of subMeshes) {
        const count = instanceMatrices.length;
        const instMesh = new THREE.InstancedMesh(sub.geometry, sub.material, count);

        for (let i = 0; i < count; i++) {
          combinedMatrix.multiplyMatrices(instanceMatrices[i], sub.localMatrix);
          instMesh.setMatrixAt(i, combinedMatrix);
        }
        instMesh.instanceMatrix.needsUpdate = true;
        this.computeInstancedBounds(instMesh);
        this.scene.add(instMesh);
        this.instancedMeshes.push(instMesh);

        // Ghost copies for world wrapping
        for (const offset of wrapOffsets) {
          const ghost = instMesh.clone();
          ghost.position.set(offset.x, 0, offset.z);
          this.scene.add(ghost);
          this.ghostMeshes.push(ghost);
        }
      }
    }
  }

  dispose(): void {
    this.removeAllMeshes();
    this.scene = null;
  }

  private removeAllMeshes(): void {
    for (const mesh of this.instancedMeshes) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    this.instancedMeshes = [];

    for (const ghost of this.ghostMeshes) {
      ghost.removeFromParent();
      ghost.dispose();
    }
    this.ghostMeshes = [];
  }

  private getWrapOffsets(grid: HexGrid): { x: number; z: number }[] {
    const { wrapQ, wrapR } = grid.getWrapVectors();
    return WRAP_MULTIPLIERS.map(({ mq, mr }) => ({
      x: mq * wrapQ.x + mr * wrapR.x,
      z: mq * wrapQ.z + mr * wrapR.z,
    }));
  }

  private getSubMeshes(modelName: string): SubMeshInfo[] {
    const model = assetLoader.getRawModel(modelName);
    if (!model) return [];
    model.updateWorldMatrix(true, true);
    const results: SubMeshInfo[] = [];
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        results.push({
          geometry: child.geometry,
          material: child.material as THREE.Material,
          localMatrix: child.matrixWorld.clone(),
        });
      }
    });
    return results;
  }

  private computeInstancedBounds(mesh: THREE.InstancedMesh): void {
    if (!mesh.geometry.boundingSphere) {
      mesh.geometry.computeBoundingSphere();
    }
    const geoRadius = mesh.geometry.boundingSphere!.radius;

    const box = new THREE.Box3();
    const tempMatrix = new THREE.Matrix4();
    const tempPos = new THREE.Vector3();
    let maxScale = 1;

    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, tempMatrix);
      tempPos.setFromMatrixPosition(tempMatrix);
      box.expandByPoint(tempPos);

      const e = tempMatrix.elements;
      const sx = Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
      const sy = Math.sqrt(e[4] * e[4] + e[5] * e[5] + e[6] * e[6]);
      const sz = Math.sqrt(e[8] * e[8] + e[9] * e[9] + e[10] * e[10]);
      const s = Math.max(sx, sy, sz);
      if (s > maxScale) maxScale = s;
    }

    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    sphere.radius += geoRadius * maxScale;
    mesh.boundingSphere = sphere;
  }
}
