import * as THREE from 'three';
import type { Game } from './Game';
import { HexPicker } from './HexPicker';
import { HexGrid } from '../game/HexGrid';
import type { HexCoord } from '../game/HexGrid';
import { MapRenderer } from './MapRenderer';
import type { Building } from '../game/Building';

const CLICK_THRESHOLD = 5; // pixels — if mouse moves less than this, it's a click

/**
 * Handles building selection when not in placement mode.
 * Click on a hex with a building → selects it.
 * Click on empty hex or Escape → deselects.
 */
export class SelectionController {
  private game: Game;
  private picker: HexPicker;
  private canvas: HTMLCanvasElement;

  private selectedBuilding: Building | null = null;
  private highlightMesh: THREE.Mesh | null = null;

  // Track mouse for click vs drag detection
  private mouseDownPos = { x: 0, y: 0 };
  private mouseIsDown = false;

  /** Callback when a building is selected or deselected */
  onSelectionChanged: ((building: Building | null) => void) | null = null;

  constructor(game: Game) {
    this.game = game;
    this.picker = new HexPicker();
    this.canvas = game.getRenderer().domElement;
    this.bindEvents();
  }

  get selected(): Building | null {
    return this.selectedBuilding;
  }

  /** Select a building programmatically */
  select(building: Building | null): void {
    this.removeHighlight();
    this.selectedBuilding = building;
    if (building) {
      this.showHighlight(building.coord);
    }
    this.onSelectionChanged?.(building);
  }

  /** Deselect current building */
  deselect(): void {
    this.select(null);
  }

  private bindEvents(): void {
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('keydown', this.onKeyDown);
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd);
  }

  private onMouseDown = (e: MouseEvent): void => {
    this.mouseDownPos = { x: e.clientX, y: e.clientY };
    this.mouseIsDown = true;
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (!this.mouseIsDown) return;
    this.mouseIsDown = false;

    // Skip if in placement mode or road placement mode
    const placement = this.game.getPlacementController();
    if (placement?.isActive) return;
    const roadCtrl = this.game.getRoadPlacementController();
    if (roadCtrl?.isActive) return;

    // Only handle as click if mouse didn't move much
    const dx = e.clientX - this.mouseDownPos.x;
    const dy = e.clientY - this.mouseDownPos.y;
    if (Math.hypot(dx, dy) > CLICK_THRESHOLD) return;

    if (e.button === 0) {
      this.handleClick(e.clientX, e.clientY);
    }
  };

  private onTouchStart = (e: TouchEvent): void => {
    const touch = e.touches[0];
    this.mouseDownPos = { x: touch.clientX, y: touch.clientY };
    this.mouseIsDown = true;
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (!this.mouseIsDown) return;
    this.mouseIsDown = false;

    const placement = this.game.getPlacementController();
    if (placement?.isActive) return;
    const roadCtrl = this.game.getRoadPlacementController();
    if (roadCtrl?.isActive) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - this.mouseDownPos.x;
    const dy = touch.clientY - this.mouseDownPos.y;
    if (Math.hypot(dx, dy) > CLICK_THRESHOLD) return;

    this.handleClick(touch.clientX, touch.clientY);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.selectedBuilding) {
      this.deselect();
    }
  };

  private handleClick(screenX: number, screenY: number): void {
    const camera = this.game.getCamera();
    const coord = this.picker.screenToHex(screenX, screenY, camera, this.canvas);
    if (!coord) {
      this.deselect();
      return;
    }

    const grid = this.game.getGrid();
    if (!grid.isInBounds(coord.q, coord.r)) {
      this.deselect();
      return;
    }
    const gameState = this.game.getGameState();
    const building = gameState.getBuildingAt(coord.q, coord.r);

    if (building) {
      this.select(building);
    } else {
      this.deselect();
    }
  }

  private showHighlight(coord: HexCoord): void {
    this.removeHighlight();
    const grid = this.game.getGrid();
    const { x, z } = HexGrid.hexToWorld(coord.q, coord.r);
    const tile = grid.getTile(coord.q, coord.r);
    const y = tile ? MapRenderer.getTileY(tile) : 0;

    const ringGeometry = new THREE.RingGeometry(0.85, 0.98, 6);
    ringGeometry.rotateX(-Math.PI / 2);
    ringGeometry.rotateY(Math.PI / 6);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    this.highlightMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    this.highlightMesh.position.set(x, y + 0.03, z);
    this.game.getScene().add(this.highlightMesh);
  }

  private removeHighlight(): void {
    if (this.highlightMesh) {
      this.game.getScene().remove(this.highlightMesh);
      this.highlightMesh.geometry.dispose();
      (this.highlightMesh.material as THREE.Material).dispose();
      this.highlightMesh = null;
    }
  }

  dispose(): void {
    this.removeHighlight();
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('keydown', this.onKeyDown);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
  }
}
