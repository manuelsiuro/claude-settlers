import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import type { Unit } from '../game/Unit';
import { getUnitWorldPosition, UnitState } from '../game/Unit';
import { assetLoader } from './AssetLoader';
import { UNIT_MODEL_MAP } from './UnitModels';
import { MapRenderer } from './MapRenderer';

/** Scale for unit models (units are small relative to buildings) */
const UNIT_SCALE = 0.6;

/** Work animation: bob amplitude and speed */
const WORK_BOB_AMPLITUDE = 0.03;
const WORK_BOB_SPEED = 4.0;
const WORK_ROTATE_AMPLITUDE = 0.15;
const WORK_ROTATE_SPEED = 3.0;

/** Walk animation: bob during walking */
const WALK_BOB_AMPLITUDE = 0.02;
const WALK_BOB_SPEED = 8.0;

/**
 * Renders units on the hex map.
 * Each frame, updates unit positions based on their movement state.
 * Supports world wrapping via ghost groups (same pattern as BuildingRenderer).
 */
export class UnitRenderer {
  private unitGroup: THREE.Group;
  private wrapGroups: THREE.Group[] = [];
  private unitMeshes: Map<string, THREE.Group> = new Map();
  private wrapClones: Map<string, THREE.Group[]> = new Map();
  private grid: HexGrid;
  private elapsedTime = 0;

  constructor() {
    this.unitGroup = new THREE.Group();
    this.unitGroup.name = 'units';
    this.grid = new HexGrid(1, 1); // Placeholder, set properly in addToScene
  }

  /** Add to scene and set up world wrapping */
  addToScene(scene: THREE.Scene, grid: HexGrid): void {
    this.grid = grid;
    scene.add(this.unitGroup);

    // World wrapping: 8 ghost copies matching MapRenderer/BuildingRenderer
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
      ghost.name = `units_ghost_${mq}_${mr}`;
      scene.add(ghost);
      this.wrapGroups.push(ghost);
    }
  }

  /** Add a unit mesh to the scene */
  addUnit(unit: Unit): void {
    const modelName = UNIT_MODEL_MAP[unit.type];
    if (!modelName) return;

    let mesh: THREE.Group;
    try {
      mesh = assetLoader.getUnitModel(modelName);
    } catch {
      // Model not loaded — skip silently rather than crashing
      console.warn(`Unit model not found: ${modelName}, skipping unit ${unit.id}`);
      return;
    }
    mesh.scale.setScalar(UNIT_SCALE);

    // Position on hex tile
    const { x, z } = HexGrid.hexToWorld(unit.coord.q, unit.coord.r);
    const tile = this.grid.getTile(unit.coord.q, unit.coord.r);
    const y = tile ? MapRenderer.getTileY(tile) : 0;

    mesh.position.set(x, y, z);
    mesh.name = `unit_${unit.id}`;
    mesh.userData.unitId = unit.id;

    this.unitGroup.add(mesh);
    this.unitMeshes.set(unit.id, mesh);

    // Add clones to ghost groups for world wrapping
    const clones: THREE.Group[] = [];
    for (const ghost of this.wrapGroups) {
      const clone = mesh.clone();
      clone.position.copy(mesh.position);
      clone.userData.unitId = unit.id;
      ghost.add(clone);
      clones.push(clone);
    }
    this.wrapClones.set(unit.id, clones);
  }

  /** Remove a unit mesh from the scene */
  removeUnit(unitId: string): void {
    const mesh = this.unitMeshes.get(unitId);
    if (!mesh) return;

    this.unitGroup.remove(mesh);
    this.disposeMesh(mesh);
    this.unitMeshes.delete(unitId);

    // Remove ghost clones
    const clones = this.wrapClones.get(unitId);
    if (clones) {
      for (let i = 0; i < clones.length; i++) {
        this.wrapGroups[i].remove(clones[i]);
        this.disposeMesh(clones[i]);
      }
      this.wrapClones.delete(unitId);
    }
  }

  /**
   * Sync 3D meshes with the current unit list.
   * Adds meshes for new units, removes meshes for deleted units.
   */
  syncUnits(units: Unit[]): void {
    const currentIds = new Set(units.map((u) => u.id));

    // Add meshes for new units
    for (const unit of units) {
      if (!this.unitMeshes.has(unit.id)) {
        this.addUnit(unit);
      }
    }

    // Remove meshes for units that no longer exist
    for (const id of this.unitMeshes.keys()) {
      if (!currentIds.has(id)) {
        this.removeUnit(id);
      }
    }
  }

  /**
   * Update unit positions and animations each frame.
   * Call this from the main game loop with the current list of units.
   */
  updatePositions(units: Unit[], deltaTime: number): void {
    this.elapsedTime += deltaTime;

    for (const unit of units) {
      const mesh = this.unitMeshes.get(unit.id);
      if (!mesh) continue;

      // Get interpolated position (fractional hex coords during movement)
      const interpCoord = getUnitWorldPosition(unit);
      const { x, z } = HexGrid.hexToWorld(interpCoord.q, interpCoord.r);

      // Get Y from the nearest tile
      const nearestCoord = this.grid.wrap(
        Math.round(interpCoord.q),
        Math.round(interpCoord.r),
      );
      const tile = this.grid.getTile(nearestCoord.q, nearestCoord.r);
      const baseY = tile ? MapRenderer.getTileY(tile) : 0;

      // Per-unit time offset to avoid synchronized animations (simple string hash)
      let hash = 0;
      for (let i = 0; i < unit.id.length; i++) {
        hash = ((hash << 5) - hash + unit.id.charCodeAt(i)) | 0;
      }
      const timeOffset = (Math.abs(hash) % 1000) * 0.00628; // 0–6.28 range (full cycle)
      const t = this.elapsedTime + timeOffset;

      let yOffset = 0;
      let rotY = 0;
      let rotZ = 0;

      if (unit.state === UnitState.Working) {
        // Work animation: gentle bob + body sway
        yOffset = Math.sin(t * WORK_BOB_SPEED) * WORK_BOB_AMPLITUDE;
        rotZ = Math.sin(t * WORK_ROTATE_SPEED) * WORK_ROTATE_AMPLITUDE;
      } else if (unit.state === UnitState.WalkingToWork || unit.state === UnitState.WalkingHome) {
        // Walk animation: quick bob
        yOffset = Math.abs(Math.sin(t * WALK_BOB_SPEED)) * WALK_BOB_AMPLITUDE;

        // Face movement direction
        if (unit.path.length > 0 && unit.pathIndex < unit.path.length - 1) {
          const from = unit.path[unit.pathIndex];
          const to = unit.path[unit.pathIndex + 1];
          const fromWorld = HexGrid.hexToWorld(from.q, from.r);
          const toWorld = HexGrid.hexToWorld(to.q, to.r);
          rotY = Math.atan2(toWorld.x - fromWorld.x, toWorld.z - fromWorld.z);
        }
      }

      mesh.position.set(x, baseY + yOffset, z);
      mesh.rotation.set(0, rotY, rotZ);

      // Update ghost clones
      const clones = this.wrapClones.get(unit.id);
      if (clones) {
        for (const clone of clones) {
          clone.position.copy(mesh.position);
          clone.rotation.copy(mesh.rotation);
        }
      }
    }
  }

  /** Get the 3D mesh for a unit */
  getMesh(unitId: string): THREE.Group | undefined {
    return this.unitMeshes.get(unitId);
  }

  private disposeMesh(group: THREE.Group): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }

  /** Clean up everything */
  dispose(): void {
    for (const mesh of this.unitMeshes.values()) {
      this.disposeMesh(mesh);
    }
    this.unitMeshes.clear();
    this.wrapClones.clear();

    const disposeGroup = (group: THREE.Group) => {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
      group.removeFromParent();
    };

    disposeGroup(this.unitGroup);
    for (const ghost of this.wrapGroups) {
      disposeGroup(ghost);
    }
    this.wrapGroups = [];
  }
}
