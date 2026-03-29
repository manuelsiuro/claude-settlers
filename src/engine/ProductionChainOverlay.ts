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
  private dotBuildings: Set<string> = new Set();

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

  /** Show production chain for a building with status-based coloring */
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

        // Color by source building health
        const color = this.getBuildingHealthColor(other);
        this.addLine(other, building, color);
        this.addStatusDot(other);
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

        const color = this.getBuildingHealthColor(other);
        this.addLine(building, other, color);
        this.addStatusDot(other);
        connectionCount++;
      }
      if (connectionCount >= 10) break;
    }

    // Status dot for the selected building itself
    this.addStatusDot(building);
  }

  /** Get a color indicating building production health */
  private getBuildingHealthColor(building: Building): number {
    if (!building.hasWorker) return 0xff4444; // red — no worker
    if (building.productionPaused) return 0x888888; // gray — paused

    const def = BUILDING_DEFINITIONS[building.type];
    if (def.production && def.production.inputs.length > 0) {
      // Check if any input is missing
      const hasMissing = def.production.inputs.some(
        inp => (building.inputInventory[inp.resource] ?? 0) < inp.amount
      );
      if (hasMissing) return 0xffaa00; // yellow — waiting for input
    }

    if (building.productionProgress > 0) return 0x44cc44; // green — producing
    return 0x44aaff; // blue — idle/ready
  }

  /** Add a floating status dot above a building */
  private addStatusDot(building: Building): void {
    if (!this.scene || !this.grid) return;
    // Don't duplicate dots
    if (this.dotBuildings.has(building.id)) return;
    this.dotBuildings.add(building.id);

    const world = HexGrid.hexToWorld(building.coord.q, building.coord.r);
    const tile = this.grid.getTile(building.coord.q, building.coord.r);
    const y = tile ? MapRenderer.getTileY(tile) + 1.2 : 1.2;
    const color = this.getBuildingHealthColor(building);

    const dotGeom = new THREE.SphereGeometry(0.08, 6, 6);
    const dotMat = new THREE.MeshBasicMaterial({ color });
    const dot = new THREE.Mesh(dotGeom, dotMat);
    dot.position.set(world.x, y, world.z);
    this.scene.add(dot);
    this.arrows.push(dot); // reuse arrows array for cleanup
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
    this.dotBuildings.clear();
  }

  /** Get currently shown building ID (for checking if we need to update) */
  getSelectedBuildingId(): string | null {
    return this.selectedBuildingId;
  }

  dispose(): void {
    this.clear();
  }
}
