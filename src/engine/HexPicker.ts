import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import type { HexCoord } from '../game/HexGrid';

/**
 * Converts screen coordinates to hex grid coordinates via raycasting
 * onto the XZ ground plane (y=0).
 */
export class HexPicker {
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private mouse = new THREE.Vector2();

  /**
   * Convert a screen position (e.g., mouse event) to a hex coordinate.
   * Returns null if the ray doesn't hit the ground plane.
   */
  screenToHex(
    screenX: number,
    screenY: number,
    camera: THREE.Camera,
    canvas: HTMLCanvasElement,
  ): HexCoord | null {
    // Convert to normalized device coordinates (-1 to +1)
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((screenX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((screenY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, camera);

    const intersection = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, intersection);
    if (!hit) return null;

    return HexGrid.worldToHex(intersection.x, intersection.z);
  }
}
