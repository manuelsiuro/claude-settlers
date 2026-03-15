import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import type { HexCoord } from '../game/HexGrid';
import { MapRenderer } from './MapRenderer';
import type { ResourceType } from '../game/ResourceType';
import { ResourceType as RT } from '../game/ResourceType';

/** Deposit marker colors by resource type */
const DEPOSIT_COLORS: Partial<Record<ResourceType, number>> = {
  [RT.IronOre]: 0x5a5a5a,  // gray
  [RT.CoalOre]: 0x2a2a2a,  // black
  [RT.GoldOre]: 0xffd700,  // gold
};

const POLE_RADIUS = 0.04;
const POLE_HEIGHT = 0.8;
const FLAG_SIZE = 0.2;

/**
 * Renders small flag markers on revealed deposit mountain tiles.
 * Color-coded by resource type.
 */
export class DepositRenderer {
  private group: THREE.Group;
  private markers: Map<string, THREE.Group> = new Map();

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'deposit_markers';
  }

  /** Add to scene */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addToScene(scene: THREE.Scene, _grid: HexGrid): void {
    scene.add(this.group);
  }

  /** Add a deposit marker at the given hex coordinate */
  addMarker(coord: HexCoord, resourceType: ResourceType, grid: HexGrid): void {
    const key = HexGrid.key(coord.q, coord.r);
    if (this.markers.has(key)) return;

    const color = DEPOSIT_COLORS[resourceType] ?? 0xffffff;
    const markerGroup = this.createMarkerMesh(color);

    // Position on hex tile
    const { x, z } = HexGrid.hexToWorld(coord.q, coord.r);
    const tile = grid.getTile(coord.q, coord.r);
    const y = tile ? MapRenderer.getTileY(tile) : 0;
    markerGroup.position.set(x, y, z);

    this.group.add(markerGroup);
    this.markers.set(key, markerGroup);
  }

  /** Remove a deposit marker (when mine is placed) */
  removeMarker(coord: HexCoord): void {
    const key = HexGrid.key(coord.q, coord.r);
    const marker = this.markers.get(key);
    if (!marker) return;

    this.group.remove(marker);
    this.disposeGroup(marker);
    this.markers.delete(key);
  }

  private createMarkerMesh(color: number): THREE.Group {
    const group = new THREE.Group();

    // Pole
    const poleGeo = new THREE.CylinderGeometry(POLE_RADIUS, POLE_RADIUS, POLE_HEIGHT, 4);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x8b4513 }); // brown
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = POLE_HEIGHT / 2;
    group.add(pole);

    // Diamond/flag on top
    const flagGeo = new THREE.OctahedronGeometry(FLAG_SIZE);
    const flagMat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.y = POLE_HEIGHT + FLAG_SIZE * 0.5;
    group.add(flag);

    return group;
  }

  private disposeGroup(group: THREE.Group): void {
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
    for (const marker of this.markers.values()) {
      this.disposeGroup(marker);
    }
    this.markers.clear();
    this.group.removeFromParent();
  }
}
