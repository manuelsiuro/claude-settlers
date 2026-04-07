import * as THREE from 'three';
import type { Game } from './Game';
import { HexPicker } from './HexPicker';
import { HexGrid } from '../game/HexGrid';
import type { HexCoord } from '../game/HexGrid';
import { MapRenderer } from './MapRenderer';
import type { Flag } from '../game/RoadNetwork';

const CLICK_THRESHOLD = 5;

export type RoadPlacementMode = 'flag' | 'road' | null;

/**
 * Handles flag placement and road building.
 *
 * Flag mode: click any valid hex → place a flag.
 * Road mode: click a flag → then click an adjacent hex → auto-place flag if needed → connect.
 */
export class RoadPlacementController {
  private game: Game;
  private picker: HexPicker;
  private canvas: HTMLCanvasElement;

  private mode: RoadPlacementMode = null;
  private selectedFlag: Flag | null = null;
  private highlightMeshes: THREE.Mesh[] = [];
  private previewHex: HexCoord | null = null;
  private previewMesh: THREE.Mesh | null = null;

  // Track mouse for click vs drag detection
  private mouseDownPos = { x: 0, y: 0 };
  private mouseIsDown = false;

  /** Callback when placement mode changes */
  onModeChanged: ((mode: RoadPlacementMode) => void) | null = null;
  /** Callback when a flag is placed */
  onFlagPlaced: ((flag: Flag) => void) | null = null;
  /** Callback when a road is built */
  onRoadBuilt: (() => void) | null = null;

  constructor(game: Game) {
    this.game = game;
    this.picker = new HexPicker();
    this.canvas = game.getRenderer().domElement;
    this.bindEvents();
  }

  get currentMode(): RoadPlacementMode {
    return this.mode;
  }

  get isActive(): boolean {
    return this.mode !== null;
  }

  /** Enter flag placement mode */
  startFlagMode(): void {
    this.cancel();
    this.mode = 'flag';
    this.canvas.style.cursor = 'crosshair';
    this.onModeChanged?.(this.mode);
  }

  /** Enter road building mode */
  startRoadMode(): void {
    this.cancel();
    this.mode = 'road';
    this.canvas.style.cursor = 'crosshair';
    this.onModeChanged?.(this.mode);
  }

  /** Cancel current mode */
  cancel(): void {
    this.mode = null;
    this.selectedFlag = null;
    this.clearHighlights();
    this.clearPreview();
    this.canvas.style.cursor = '';
    this.onModeChanged?.(null);
  }

  private bindEvents(): void {
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('keydown', this.onKeyDown);
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd);
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.mode) return;
    this.updatePreview(e.clientX, e.clientY);
  };

  private onMouseDown = (e: MouseEvent): void => {
    this.mouseDownPos = { x: e.clientX, y: e.clientY };
    this.mouseIsDown = true;
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (!this.mouseIsDown) return;
    this.mouseIsDown = false;
    if (!this.mode) return;

    const dx = e.clientX - this.mouseDownPos.x;
    const dy = e.clientY - this.mouseDownPos.y;
    if (Math.hypot(dx, dy) > CLICK_THRESHOLD) return;

    if (e.button === 2) {
      e.preventDefault();
      this.cancel();
      return;
    }

    if (e.button === 0) {
      this.handleClick(e.clientX, e.clientY);
    }
  };

  private onTouchStart = (e: TouchEvent): void => {
    if (!this.mode) return;
    const touch = e.touches[0];
    this.mouseDownPos = { x: touch.clientX, y: touch.clientY };
    this.mouseIsDown = true;
    this.updatePreview(touch.clientX, touch.clientY);
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (!this.mouseIsDown || !this.mode) return;
    this.mouseIsDown = false;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - this.mouseDownPos.x;
    const dy = touch.clientY - this.mouseDownPos.y;
    if (Math.hypot(dx, dy) > CLICK_THRESHOLD) return;

    this.handleClick(touch.clientX, touch.clientY);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.mode) {
      this.cancel();
    }
  };

  private getHexAtScreen(screenX: number, screenY: number): HexCoord | null {
    const camera = this.game.getCamera();
    const coord = this.picker.screenToHex(screenX, screenY, camera, this.canvas);
    if (!coord) return null;
    if (!this.game.getGrid().isInBounds(coord.q, coord.r)) return null;
    return coord;
  }

  private updatePreview(screenX: number, screenY: number): void {
    const hex = this.getHexAtScreen(screenX, screenY);
    if (!hex) {
      this.clearPreview();
      this.previewHex = null;
      return;
    }

    // Skip if same hex
    if (this.previewHex && this.previewHex.q === hex.q && this.previewHex.r === hex.r) return;
    this.previewHex = hex;
    this.clearPreview();

    if (this.mode === 'flag') {
      this.showFlagPreview(hex);
    } else if (this.mode === 'road') {
      this.showRoadPreview(hex);
    }
  }

  private showFlagPreview(hex: HexCoord): void {
    const roadNet = this.game.getRoadNetwork();
    const existingFlag = roadNet.getFlagAt(hex.q, hex.r);
    const tile = this.game.getGrid().getTile(hex.q, hex.r);
    const valid = !existingFlag && tile && tile.terrain !== 'water';

    this.previewMesh = this.createHexRing(hex, valid ? 0xffaa00 : 0xff4444);
  }

  private showRoadPreview(hex: HexCoord): void {
    if (!this.selectedFlag) {
      // Highlight existing flags — show preview of whether this hex has a flag
      const roadNet = this.game.getRoadNetwork();
      const flag = roadNet.getFlagAt(hex.q, hex.r);
      const color = flag ? 0x00aaff : 0x666666;
      this.previewMesh = this.createHexRing(hex, color);
    } else {
      // Show preview of road target
      const grid = this.game.getGrid();
      const neighbors = grid.getNeighbors(this.selectedFlag.coord.q, this.selectedFlag.coord.r);
      const isNeighbor = neighbors.some((n) => n.coord.q === hex.q && n.coord.r === hex.r);
      const tile = grid.getTile(hex.q, hex.r);
      const valid = isNeighbor && tile && tile.terrain !== 'water';
      this.previewMesh = this.createHexRing(hex, valid ? 0x00ff44 : 0xff4444);
    }
  }

  private handleClick(screenX: number, screenY: number): void {
    const hex = this.getHexAtScreen(screenX, screenY);
    if (!hex) return;

    if (this.mode === 'flag') {
      this.handleFlagClick(hex);
    } else if (this.mode === 'road') {
      this.handleRoadClick(hex);
    }
  }

  private handleFlagClick(hex: HexCoord): void {
    const result = this.game.executeCommand({
      type: 'PlaceFlag',
      playerId: this.game.getHumanPlayerId(),
      coord: hex,
    });
    if (result.success) {
      const flag = result.data as Flag;
      this.onFlagPlaced?.(flag);
    }
    // Stay in flag mode for quick multi-placement
    this.clearPreview();
    this.previewHex = null;
  }

  private handleRoadClick(hex: HexCoord): void {
    const roadNet = this.game.getRoadNetwork();

    if (!this.selectedFlag) {
      // Step 1: Select a starting flag
      const flag = roadNet.getFlagAt(hex.q, hex.r);
      if (flag) {
        this.selectedFlag = flag;
        this.showSelectedFlagHighlight();
      }
      return;
    }

    // Step 2: Select target hex
    const grid = this.game.getGrid();
    const neighbors = grid.getNeighbors(this.selectedFlag.coord.q, this.selectedFlag.coord.r);
    const isNeighbor = neighbors.some((n) => n.coord.q === hex.q && n.coord.r === hex.r);
    if (!isNeighbor) {
      // Clicked non-neighbor — if it's a flag, start new selection
      const flag = roadNet.getFlagAt(hex.q, hex.r);
      if (flag) {
        this.clearHighlights();
        this.selectedFlag = flag;
        this.showSelectedFlagHighlight();
      }
      return;
    }

    const tile = grid.getTile(hex.q, hex.r);
    if (!tile || tile.terrain === 'water') return;

    // Auto-place flag at target if needed
    let targetFlag: Flag | undefined = roadNet.getFlagAt(hex.q, hex.r);
    if (!targetFlag) {
      const flagResult = this.game.executeCommand({
        type: 'PlaceFlag',
        playerId: this.game.getHumanPlayerId(),
        coord: hex,
      });
      if (!flagResult.success) return;
      const newFlag = flagResult.data as Flag;
      this.onFlagPlaced?.(newFlag);
      targetFlag = newFlag;
    }

    // Connect the flags
    const connectResult = this.game.executeCommand({
      type: 'ConnectFlags',
      playerId: this.game.getHumanPlayerId(),
      flagAId: this.selectedFlag.id,
      flagBId: targetFlag.id,
    });
    if (connectResult.success) {
      this.onRoadBuilt?.();
    }

    // Move selection to target flag for chain building
    this.clearHighlights();
    this.selectedFlag = targetFlag;
    this.showSelectedFlagHighlight();
    this.clearPreview();
    this.previewHex = null;
  }

  private showSelectedFlagHighlight(): void {
    if (!this.selectedFlag) return;

    // Highlight selected flag
    const mesh = this.createHexRing(this.selectedFlag.coord, 0x00aaff);
    this.highlightMeshes.push(mesh);

    // Highlight valid neighbor hexes
    const grid = this.game.getGrid();
    const neighbors = grid.getNeighbors(
      this.selectedFlag.coord.q,
      this.selectedFlag.coord.r,
    );
    for (const n of neighbors) {
      if (n.terrain === 'water') continue;
      const neighborMesh = this.createHexDot(n.coord, 0x00aaff);
      this.highlightMeshes.push(neighborMesh);
    }
  }

  private createHexRing(coord: HexCoord, color: number): THREE.Mesh {
    const { x, z } = HexGrid.hexToWorld(coord.q, coord.r);
    const tile = this.game.getGrid().getTile(coord.q, coord.r);
    const y = tile ? MapRenderer.getTileY(tile) : 0;

    const geo = new THREE.RingGeometry(0.75, 0.88, 6);
    geo.rotateX(-Math.PI / 2);
    geo.rotateY(Math.PI / 6);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + 0.04, z);
    this.game.getScene().add(mesh);
    return mesh;
  }

  private createHexDot(coord: HexCoord, color: number): THREE.Mesh {
    const { x, z } = HexGrid.hexToWorld(coord.q, coord.r);
    const tile = this.game.getGrid().getTile(coord.q, coord.r);
    const y = tile ? MapRenderer.getTileY(tile) : 0;

    const geo = new THREE.CircleGeometry(0.15, 8);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + 0.04, z);
    this.game.getScene().add(mesh);
    return mesh;
  }

  private clearHighlights(): void {
    for (const mesh of this.highlightMeshes) {
      this.game.getScene().remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.highlightMeshes = [];
  }

  private clearPreview(): void {
    if (this.previewMesh) {
      this.game.getScene().remove(this.previewMesh);
      this.previewMesh.geometry.dispose();
      (this.previewMesh.material as THREE.Material).dispose();
      this.previewMesh = null;
    }
  }

  dispose(): void {
    this.cancel();
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('keydown', this.onKeyDown);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
  }
}
