import * as THREE from 'three';
import type { Game } from './Game';

const PAN_SPEED = 0.02;
const ZOOM_SPEED = 0.5;
const MIN_FRUSTUM = 4;
const MAX_FRUSTUM = 30;
const TOUCH_PAN_SPEED = 0.03;

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
  private game: Game;
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

  constructor(game: Game) {
    this.game = game;
    this.canvas = game.getRenderer().domElement;

    const camera = game.getCamera();
    this.target = new THREE.Vector3();
    camera.getWorldDirection(this.isoDir = new THREE.Vector3()).negate();

    // Compute initial target from camera position
    this.target.copy(camera.position).sub(
      this.isoDir.clone().multiplyScalar(
        camera.position.length() / this.isoDir.length()
      )
    );
    this.target.y = 0;

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
    camera.position.x += dx;
    camera.position.z += dz;
    this.target.x += dx;
    this.target.z += dz;
  }

  private zoom(delta: number): void {
    const frustum = this.game.getFrustum();
    const newFrustum = Math.max(MIN_FRUSTUM, Math.min(MAX_FRUSTUM, frustum + delta));
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
