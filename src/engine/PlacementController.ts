import * as THREE from 'three';
import type { Game } from './Game';
import { HexPicker } from './HexPicker';
import { HexGrid } from '../game/HexGrid';
import type { HexCoord } from '../game/HexGrid';
import type { BuildingType } from '../game/BuildingType';
import { BUILDING_DEFINITIONS } from '../game/BuildingType';
import { getDistanceMultiplier, getDistanceRating } from '../game/ProductionManager';
import { assetLoader } from './AssetLoader';
import { BUILDING_MODEL_MAP } from './BuildingModels';
import { MapRenderer } from './MapRenderer';

const VALID_COLOR = 0x00ff00;
const INVALID_COLOR = 0xff0000;
const GHOST_OPACITY = 0.5;
const CLICK_THRESHOLD = 5; // pixels — if mouse moves less than this, it's a click

/**
 * Manages the building placement flow:
 * - Select a building type to enter placement mode
 * - Ghost preview follows the cursor on valid hex tiles
 * - Click to confirm placement
 * - Escape or right-click to cancel
 */
export class PlacementController {
  private game: Game;
  private picker: HexPicker;
  private canvas: HTMLCanvasElement;

  private selectedType: BuildingType | null = null;
  private ghostMesh: THREE.Group | null = null;
  private highlightMesh: THREE.Mesh | null = null;
  private currentHex: HexCoord | null = null;
  private canPlaceHere = false;
  private currentPlacementError: string | null = null;

  // Distance-based placement info
  private _placementDistance: number | null = null;
  private _placementRating: { label: string; color: string } | null = null;

  // Track mouse for click vs drag detection
  private mouseDownPos = { x: 0, y: 0 };
  private mouseIsDown = false;

  // Callback when a building is placed
  onBuildingPlaced: ((type: BuildingType, coord: HexCoord) => void) | null = null;
  // Callback when placement mode changes
  onModeChanged: ((active: boolean) => void) | null = null;
  // Callback when preview position updates (for UI distance display)
  onPreviewUpdated: (() => void) | null = null;
  // Callback when placement fails
  onPlacementError: ((error: string, type: BuildingType) => void) | null = null;

  constructor(game: Game) {
    this.game = game;
    this.picker = new HexPicker();
    this.canvas = game.getRenderer().domElement;
    this.bindEvents();
  }

  /** Enter placement mode with a building type */
  selectBuilding(type: BuildingType): void {
    this.cancel();
    this.selectedType = type;
    this.canvas.style.cursor = 'crosshair';
    this.onModeChanged?.(true);
  }

  /** Cancel placement mode */
  cancel(): void {
    this.selectedType = null;
    this.removeGhost();
    this.removeHighlight();
    this.currentHex = null;
    this.canPlaceHere = false;
    this.currentPlacementError = null;
    this._placementDistance = null;
    this._placementRating = null;
    this.canvas.style.cursor = '';
    this.onModeChanged?.(false);
  }

  /** Whether placement mode is active */
  get isActive(): boolean {
    return this.selectedType !== null;
  }

  get selectedBuildingType(): BuildingType | null {
    return this.selectedType;
  }

  get placementDistance(): number | null {
    return this._placementDistance;
  }

  get placementRating(): { label: string; color: string } | null {
    return this._placementRating;
  }

  private bindEvents(): void {
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('keydown', this.onKeyDown);
    // Touch support
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd);
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.selectedType) return;
    this.updatePreview(e.clientX, e.clientY);
  };

  private onMouseDown = (e: MouseEvent): void => {
    this.mouseDownPos = { x: e.clientX, y: e.clientY };
    this.mouseIsDown = true;
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (!this.mouseIsDown) return;
    this.mouseIsDown = false;

    // Only handle as click if mouse didn't move much (not a drag)
    const dx = e.clientX - this.mouseDownPos.x;
    const dy = e.clientY - this.mouseDownPos.y;
    if (Math.hypot(dx, dy) > CLICK_THRESHOLD) return;

    if (e.button === 2) {
      // Right-click cancels
      if (this.selectedType) {
        e.preventDefault();
        this.cancel();
      }
      return;
    }

    if (e.button === 0 && this.selectedType && this.currentHex) {
      if (this.canPlaceHere) {
        this.confirmPlacement();
      } else if (this.currentPlacementError) {
        this.onPlacementError?.(this.currentPlacementError, this.selectedType);
      }
    }
  };

  private onTouchStart = (e: TouchEvent): void => {
    if (!this.selectedType) return;
    const touch = e.touches[0];
    this.mouseDownPos = { x: touch.clientX, y: touch.clientY };
    this.mouseIsDown = true;
    this.updatePreview(touch.clientX, touch.clientY);
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (!this.mouseIsDown || !this.selectedType) return;
    this.mouseIsDown = false;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - this.mouseDownPos.x;
    const dy = touch.clientY - this.mouseDownPos.y;
    if (Math.hypot(dx, dy) > CLICK_THRESHOLD) return;

    if (this.currentHex) {
      if (this.canPlaceHere) {
        this.confirmPlacement();
      } else if (this.currentPlacementError && this.selectedType) {
        this.onPlacementError?.(this.currentPlacementError, this.selectedType);
      }
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.selectedType) {
      this.cancel();
    }
  };

  private updatePreview(screenX: number, screenY: number): void {
    if (!this.selectedType) return;

    const camera = this.game.getCamera();
    const coord = this.picker.screenToHex(screenX, screenY, camera, this.canvas);
    if (!coord) {
      this.removeGhost();
      this.removeHighlight();
      this.currentHex = null;
      return;
    }

    // Check bounds
    const grid = this.game.getGrid();
    if (!grid.isInBounds(coord.q, coord.r)) {
      this.removeGhost();
      this.removeHighlight();
      this.currentHex = null;
      return;
    }

    // Skip if same hex as before
    if (this.currentHex && this.currentHex.q === coord.q && this.currentHex.r === coord.r) {
      return;
    }
    this.currentHex = coord;

    // Check placement validity
    const gameState = this.game.getGameState();
    const error = gameState.canPlace(this.selectedType, coord, this.game.getHumanPlayerId());
    this.canPlaceHere = error === null;
    this.currentPlacementError = error;

    // Compute distance rating for gathering buildings
    const def = BUILDING_DEFINITIONS[this.selectedType];
    this._placementDistance = null;
    this._placementRating = null;
    let ghostColor = this.canPlaceHere ? VALID_COLOR : INVALID_COLOR;

    if (def.harvestTerrain && this.canPlaceHere) {
      const dist = grid.findNearestTerrain(coord, def.harvestTerrain);
      const multiplier = getDistanceMultiplier(dist);
      const rating = getDistanceRating(multiplier);
      this._placementDistance = dist;
      this._placementRating = rating;
      // Override ghost color based on distance rating
      ghostColor = parseInt(rating.color.slice(1), 16);
    }

    // Update ghost building
    this.removeGhost();
    this.removeHighlight();

    const { x, z } = HexGrid.hexToWorld(coord.q, coord.r);
    const tile = grid.getTile(coord.q, coord.r);
    const y = tile ? MapRenderer.getTileY(tile) : 0;

    // Ghost building mesh
    const modelName = BUILDING_MODEL_MAP[this.selectedType];
    if (modelName) {
      this.ghostMesh = assetLoader.getBuildingModel(modelName);
      this.ghostMesh.position.set(x, y, z);
      this.ghostMesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          child.material = mat.clone();
          (child.material as THREE.MeshStandardMaterial).transparent = true;
          (child.material as THREE.MeshStandardMaterial).opacity = GHOST_OPACITY;
          (child.material as THREE.MeshStandardMaterial).color.set(ghostColor);
        }
      });
      this.game.getScene().add(this.ghostMesh);
    }

    // Hex highlight ring
    const ringGeometry = new THREE.RingGeometry(0.85, 0.95, 6);
    ringGeometry.rotateX(-Math.PI / 2);
    ringGeometry.rotateY(Math.PI / 6); // Align with pointy-top hex
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: ghostColor,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    this.highlightMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    this.highlightMesh.position.set(x, y + 0.02, z);
    this.game.getScene().add(this.highlightMesh);

    this.onPreviewUpdated?.();
  }

  private confirmPlacement(): void {
    if (!this.selectedType || !this.currentHex) return;

    const gameState = this.game.getGameState();
    const result = gameState.placeBuilding(this.selectedType, this.currentHex, this.game.getHumanPlayerId());

    if (result.ok) {
      const buildingRenderer = this.game.getBuildingRenderer();
      buildingRenderer.addBuilding(result.building, this.game.getGrid());
      this.onBuildingPlaced?.(this.selectedType, this.currentHex);
    } else {
      this.onPlacementError?.(result.error, this.selectedType);
    }

    // Stay in placement mode for quick multi-placement
    this.removeGhost();
    this.removeHighlight();
    this.currentHex = null;
  }

  private removeGhost(): void {
    if (this.ghostMesh) {
      this.game.getScene().remove(this.ghostMesh);
      this.ghostMesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
      this.ghostMesh = null;
    }
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
    this.cancel();
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('keydown', this.onKeyDown);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
  }
}
