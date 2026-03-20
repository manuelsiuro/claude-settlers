import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';

const PAN_SPEED = 0.02;
const ZOOM_SPEED = 0.5;
const MIN_FRUSTUM = 2;
const TOUCH_PAN_SPEED = 0.03;

/** Minimal interface for anything that can host a CameraController (Game or MapEditor) */
export interface CameraHost {
  getCamera(): THREE.OrthographicCamera;
  getRenderer(): THREE.WebGLRenderer;
  getGrid(): HexGrid;
  getFrustum(): number;
  setFrustum(f: number): void;
}

interface TouchState {
  id: number;
  x: number;
  y: number;
}

/**
 * Handles camera pan (mouse drag / touch drag / keyboard arrows)
 * and zoom (scroll wheel / pinch).
 */
export class CameraController {
  private game: CameraHost;
  private canvas: HTMLCanvasElement;
  private isDragging = false;
  private lastMouse = { x: 0, y: 0 };
  private activeTouches: TouchState[] = [];
  private lastPinchDist = 0;
  private keys = new Set<string>();

  // Camera target point (what the camera looks at)
  private target: THREE.Vector3;
  // Isometric direction vector (normalized)
  private isoDir: THREE.Vector3;
  // Hex grid Z range and per-row X range for parallelogram clamping
  private mapMinZ: number;
  private mapMaxZ: number;
  private mapRowWidth: number;   // world-space width of one hex row
  private mapSkewFactor: number; // X offset per unit Z (hex grid shears right)
  // Dynamic max frustum (zoom out limit based on map size)
  private maxFrustum: number;
  // Camera basis vectors projected to XZ (fixed for isometric view)
  private camRightXZ = { x: 0, z: 0 };
  private camUpXZ = { x: 0, z: 0 };
  // Fixed offset from target to camera position (isometric direction)
  private cameraOffset: THREE.Vector3;

  constructor(game: CameraHost) {
    this.game = game;
    this.canvas = game.getRenderer().domElement;

    const camera = game.getCamera();
    this.target = new THREE.Vector3();
    camera.getWorldDirection(this.isoDir = new THREE.Vector3()).negate();

    // Compute initial target: intersect camera ray with Y=0 ground plane
    const tRay = camera.position.y / this.isoDir.y;
    this.target.copy(camera.position).sub(this.isoDir.clone().multiplyScalar(tRay));
    this.target.y = 0;

    // Store fixed offset from target to camera (preserved during all panning)
    this.cameraOffset = camera.position.clone().sub(this.target);

    // Compute hex grid parallelogram bounds for pan clamping
    const grid = game.getGrid();
    const topLeft = HexGrid.hexToWorld(0, 0);
    const topRight = HexGrid.hexToWorld(grid.width - 1, 0);
    const bottomRight = HexGrid.hexToWorld(grid.width - 1, grid.height - 1);
    this.mapMinZ = topLeft.z;
    this.mapMaxZ = bottomRight.z;
    this.mapRowWidth = topRight.x - topLeft.x; // width of a single row
    // How much X shifts per unit Z (hex rows skew right)
    const bottomLeft = HexGrid.hexToWorld(0, grid.height - 1);
    this.mapSkewFactor = this.mapMaxZ > 0 ? bottomLeft.x / this.mapMaxZ : 0;

    // Dynamic max zoom: cap so max zoom-out shows roughly the full map
    const mapWorldW = bottomRight.x - topLeft.x;
    const mapWorldH = bottomRight.z - topLeft.z;
    this.maxFrustum = Math.max(MIN_FRUSTUM, Math.min(50, Math.max(mapWorldW, mapWorldH) / 2 + 2));

    // Compute camera basis vectors in XZ (these are fixed for isometric view)
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    right.crossVectors(forward, camera.up).normalize();
    up.crossVectors(right, forward).normalize();
    this.camRightXZ = { x: right.x, z: right.z };
    this.camUpXZ = { x: up.x, z: up.z };

    this.bindEvents();
  }

  private bindEvents(): void {
    // Mouse
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });

    // Touch
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd);

    // Keyboard
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  /** Call each frame to apply keyboard panning */
  update(): void {
    const speed = 0.15;
    const camera = this.game.getCamera();

    // Get camera's right and "forward" vectors projected onto XZ plane
    const right = new THREE.Vector3();
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    right.crossVectors(forward, camera.up).normalize();
    forward.crossVectors(camera.up, right).normalize();

    let dx = 0, dz = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('a')) dx -= speed;
    if (this.keys.has('ArrowRight') || this.keys.has('d')) dx += speed;
    if (this.keys.has('ArrowUp') || this.keys.has('w')) dz -= speed;
    if (this.keys.has('ArrowDown') || this.keys.has('s')) dz += speed;

    if (dx !== 0 || dz !== 0) {
      const move = right.multiplyScalar(dx).add(forward.multiplyScalar(dz));
      this.panBy(move.x, move.z);
    }
  }

  private panBy(dx: number, dz: number): void {
    const camera = this.game.getCamera();

    let newX = this.target.x + dx;
    let newZ = this.target.z + dz;

    // Find the nearest map point to the proposed target (on the hex parallelogram)
    const nearZ = Math.max(this.mapMinZ, Math.min(this.mapMaxZ, newZ));
    const skewX = nearZ * this.mapSkewFactor;
    const nearX = Math.max(skewX, Math.min(this.mapRowWidth + skewX, newX));

    // Offset from nearest map point to proposed target
    let offX = newX - nearX;
    let offZ = newZ - nearZ;

    // Project offset onto camera axes to check frustum containment
    const camX = offX * this.camRightXZ.x + offZ * this.camRightXZ.z;
    const camY = offX * this.camUpXZ.x + offZ * this.camUpXZ.z;

    // Clamp so nearest map point stays well within the camera frustum
    // Use 75% of frustum so map edge is clearly visible, not at pixel boundary
    const limitW = camera.right * 0.75;
    const limitH = camera.top * 0.75;
    const scaleW = limitW / Math.max(Math.abs(camX), 0.001);
    const scaleH = limitH / Math.max(Math.abs(camY), 0.001);
    const scale = Math.min(scaleW, scaleH, 1.0);

    if (scale < 1.0) {
      offX *= scale;
      offZ *= scale;
    }

    newX = nearX + offX;
    newZ = nearZ + offZ;

    this.target.x = newX;
    this.target.z = newZ;

    // Set camera position absolutely from target + fixed offset (prevents drift)
    camera.position.x = newX + this.cameraOffset.x;
    camera.position.y = this.cameraOffset.y;
    camera.position.z = newZ + this.cameraOffset.z;
  }

  private zoom(delta: number): void {
    const frustum = this.game.getFrustum();
    const newFrustum = Math.max(MIN_FRUSTUM, Math.min(this.maxFrustum, frustum + delta));
    this.game.setFrustum(newFrustum);
  }

  // --- Mouse handlers ---

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0 || e.button === 2) {
      this.isDragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;
    const dx = (e.clientX - this.lastMouse.x) * PAN_SPEED;
    const dy = (e.clientY - this.lastMouse.y) * PAN_SPEED;

    // Map screen movement to world XZ movement
    const camera = this.game.getCamera();
    const right = new THREE.Vector3();
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    right.crossVectors(forward, camera.up).normalize();
    forward.crossVectors(camera.up, right).normalize();

    const move = right.multiplyScalar(-dx).add(forward.multiplyScalar(dy));
    this.panBy(move.x, move.z);

    this.lastMouse = { x: e.clientX, y: e.clientY };
  };

  private onMouseUp = (): void => {
    this.isDragging = false;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.zoom(e.deltaY > 0 ? ZOOM_SPEED : -ZOOM_SPEED);
  };

  // --- Touch handlers ---

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    for (const touch of Array.from(e.changedTouches)) {
      this.activeTouches.push({ id: touch.identifier, x: touch.clientX, y: touch.clientY });
    }
    if (this.activeTouches.length === 2) {
      this.lastPinchDist = this.getPinchDist();
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();

    if (this.activeTouches.length === 1) {
      // Single finger: pan
      const touch = e.changedTouches[0];
      const prev = this.activeTouches[0];
      const dx = (touch.clientX - prev.x) * TOUCH_PAN_SPEED;
      const dy = (touch.clientY - prev.y) * TOUCH_PAN_SPEED;

      const camera = this.game.getCamera();
      const right = new THREE.Vector3();
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      right.crossVectors(forward, camera.up).normalize();
      forward.crossVectors(camera.up, right).normalize();

      const move = right.multiplyScalar(-dx).add(forward.multiplyScalar(dy));
      this.panBy(move.x, move.z);

      prev.x = touch.clientX;
      prev.y = touch.clientY;
    } else if (this.activeTouches.length === 2) {
      // Two fingers: pinch zoom
      for (const touch of Array.from(e.changedTouches)) {
        const state = this.activeTouches.find(t => t.id === touch.identifier);
        if (state) {
          state.x = touch.clientX;
          state.y = touch.clientY;
        }
      }
      const newDist = this.getPinchDist();
      const delta = (this.lastPinchDist - newDist) * 0.02;
      this.zoom(delta);
      this.lastPinchDist = newDist;
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    for (const touch of Array.from(e.changedTouches)) {
      this.activeTouches = this.activeTouches.filter(t => t.id !== touch.identifier);
    }
  };

  private getPinchDist(): number {
    if (this.activeTouches.length < 2) return 0;
    const [a, b] = this.activeTouches;
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  // --- Keyboard handlers ---

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.key);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key);
  };

  /** Smoothly pan camera to a world position */
  panTo(x: number, z: number): void {
    const dx = x - this.target.x;
    const dz = z - this.target.z;
    this.panBy(dx, dz);
  }

  /** Get the camera look-at target position */
  getTarget(): THREE.Vector3 {
    return this.target;
  }

  dispose(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
