import * as THREE from 'three';
import type { Building } from '../game/Building';
import { BuildingState } from '../game/Building';
import { BUILDING_DEFINITIONS } from '../game/BuildingType';
import type { GameState } from '../game/GameState';
import { HexGrid } from '../game/HexGrid';
import { MapRenderer } from './MapRenderer';

/**
 * Shows animated dashed lines between a selected building and its
 * upstream (input sources) and downstream (output consumers).
 *
 * Max ~10 connections. Removed on deselect.
 */
export class ProductionChainOverlay {
  private scene: THREE.Scene | null = null;
  private grid: HexGrid | null = null;
  private lines: THREE.Line[] = [];
  private arrows: THREE.Mesh[] = [];
  private selectedBuildingId: string | null = null;
  private dashOffset = 0;
  private enabled = true;

  addToScene(scene: THREE.Scene, grid: HexGrid): void {
    this.scene = scene;
    this.grid = grid;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  /** Update dash animation */
  update(deltaTime: number): void {
    this.dashOffset += deltaTime * 2.0;
    for (const line of this.lines) {
      const mat = line.material as THREE.LineDashedMaterial;
      mat.dashSize = 0.15;
      mat.gapSize = 0.1;
    }
  }

  /** Show production chain for a building */
  show(building: Building, gameState: GameState): void {
    if (!this.scene || !this.grid || !this.enabled) return;

    this.clear();
    this.selectedBuildingId = building.id;

    const def = BUILDING_DEFINITIONS[building.type];
    if (!def.production) return;

    const allBuildings = gameState.getAllBuildings();
    let connectionCount = 0;

    // Upstream: buildings that produce our inputs
    for (const input of def.production.inputs) {
      for (const other of allBuildings) {
        if (other.id === building.id) continue;
        if (other.state !== BuildingState.Active) continue;
        if (connectionCount >= 10) break;

        const otherDef = BUILDING_DEFINITIONS[other.type];
        if (!otherDef.production) continue;
        const producesInput = otherDef.production.outputs.some((o) => o.resource === input.resource);
        if (!producesInput) continue;

        this.addLine(other, building, 0x44aaff); // Blue for inputs
        connectionCount++;
      }
      if (connectionCount >= 10) break;
    }

    // Downstream: buildings that consume our outputs
    for (const output of def.production.outputs) {
      for (const other of allBuildings) {
        if (other.id === building.id) continue;
        if (other.state !== BuildingState.Active) continue;
        if (connectionCount >= 10) break;

        const otherDef = BUILDING_DEFINITIONS[other.type];
        if (!otherDef.production) continue;
        const consumesOutput = otherDef.production.inputs.some((i) => i.resource === output.resource);
        if (!consumesOutput) continue;

        this.addLine(building, other, 0xff8844); // Orange for outputs
        connectionCount++;
      }
      if (connectionCount >= 10) break;
    }
  }

  private addLine(from: Building, to: Building, color: number): void {
    if (!this.scene || !this.grid) return;

    const fromWorld = HexGrid.hexToWorld(from.coord.q, from.coord.r);
    const toWorld = HexGrid.hexToWorld(to.coord.q, to.coord.r);
    const fromTile = this.grid.getTile(from.coord.q, from.coord.r);
    const toTile = this.grid.getTile(to.coord.q, to.coord.r);
    const fromY = fromTile ? MapRenderer.getTileY(fromTile) + 0.5 : 0.5;
    const toY = toTile ? MapRenderer.getTileY(toTile) + 0.5 : 0.5;

    const points = [
      new THREE.Vector3(fromWorld.x, fromY, fromWorld.z),
      new THREE.Vector3(toWorld.x, toY, toWorld.z),
    ];

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color,
      dashSize: 0.15,
      gapSize: 0.1,
      transparent: true,
      opacity: 0.6,
    });

    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    this.scene.add(line);
    this.lines.push(line);

    // Small cone arrow at destination
    const dir = new THREE.Vector3(toWorld.x - fromWorld.x, 0, toWorld.z - fromWorld.z).normalize();
    const arrowGeom = new THREE.ConeGeometry(0.06, 0.15, 4);
    const arrowMat = new THREE.MeshBasicMaterial({ color });
    const arrow = new THREE.Mesh(arrowGeom, arrowMat);
    arrow.position.set(toWorld.x - dir.x * 0.3, toY, toWorld.z - dir.z * 0.3);
    arrow.lookAt(new THREE.Vector3(toWorld.x, toY, toWorld.z));
    arrow.rotateX(Math.PI / 2);
    this.scene.add(arrow);
    this.arrows.push(arrow);
  }

  /** Remove all chain lines */
  clear(): void {
    for (const line of this.lines) {
      line.removeFromParent();
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.lines = [];

    for (const arrow of this.arrows) {
      arrow.removeFromParent();
      arrow.geometry.dispose();
      (arrow.material as THREE.Material).dispose();
    }
    this.arrows = [];

    this.selectedBuildingId = null;
  }

  /** Get currently shown building ID (for checking if we need to update) */
  getSelectedBuildingId(): string | null {
    return this.selectedBuildingId;
  }

  dispose(): void {
    this.clear();
  }
}
