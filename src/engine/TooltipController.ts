import * as THREE from 'three';
import type { Game } from './Game';
import type { Building } from '../game/Building';
import { BuildingState } from '../game/Building';
import { BUILDING_DEFINITIONS } from '../game/BuildingType';
import { getMaxWorkers } from '../game/BuildingUpgrade';
import { HexGrid } from '../game/HexGrid';

/**
 * Shows floating tooltip when hovering over buildings.
 * Uses 3D→screen projection (no CSS2DRenderer needed).
 * Mobile: long-press (500ms) to show.
 */
export class TooltipController {
  private game: Game;
  private element: HTMLElement;
  private canvas: HTMLCanvasElement;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private currentBuildingId: string | null = null;
  private throttleTimer = 0;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private enabled = true;

  constructor(game: Game, tooltipElement: HTMLElement) {
    this.game = game;
    this.element = tooltipElement;
    this.canvas = game.getRenderer().domElement;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Desktop: mousemove
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mouseleave', this.onMouseLeave);

    // Mobile: long-press
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
    this.canvas.addEventListener('touchend', this.onTouchEnd);
    this.canvas.addEventListener('touchmove', this.onTouchCancel);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.hide();
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.enabled) return;

    // Throttle to 100ms
    const now = Date.now();
    if (now - this.throttleTimer < 100) return;
    this.throttleTimer = now;

    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.checkHover(e.clientX, e.clientY);
  };

  private onMouseLeave = (): void => {
    this.hide();
  };

  private onTouchStart = (e: TouchEvent): void => {
    if (!this.enabled) return;
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const mx = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

    this.mouse.set(mx, my);

    this.longPressTimer = setTimeout(() => {
      this.checkHover(touch.clientX, touch.clientY);
    }, 500);
  };

  private onTouchEnd = (): void => {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.hide();
  };

  private onTouchCancel = (): void => {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  };

  private checkHover(screenX: number, screenY: number): void {
    // Raycast to find building under cursor
    this.raycaster.setFromCamera(this.mouse, this.game.getCamera());
    const grid = this.game.getGrid();

    // Intersect with ground plane to find hex coord
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, intersection);

    if (!intersection) {
      this.hide();
      return;
    }

    const hexCoord = HexGrid.worldToHex(intersection.x, intersection.z);
    const q = Math.round(hexCoord.q);
    const r = Math.round(hexCoord.r);
    if (!grid.isInBounds(q, r)) {
      this.hide();
      return;
    }

    // Find building at this hex
    const gameState = this.game.getGameState();
    const building = gameState.getBuildingAt(q, r);

    if (!building || building.state === BuildingState.Destroyed) {
      this.hide();
      return;
    }

    // Skip enemy buildings hidden by fog of war
    const humanId = this.game.getHumanPlayerId();
    if (building.playerId !== humanId) {
      const fogMgr = this.game.getFogOfWarManager();
      if (!fogMgr.isExplored(q, r, humanId)) {
        this.hide();
        return;
      }
    }

    if (building.id === this.currentBuildingId) return; // Same building

    this.currentBuildingId = building.id;
    this.showTooltip(building, screenX, screenY);
  }

  private showTooltip(building: Building, screenX: number, screenY: number): void {
    const def = BUILDING_DEFINITIONS[building.type];

    let html = `<strong>${def.label}</strong>`;

    // Status
    const statusLabels: Record<string, string> = {
      planned: 'Planned',
      under_construction: 'Under Construction',
      active: 'Active',
    };
    html += `<br><span style="color:#aaa">${statusLabels[building.state] ?? building.state}</span>`;

    // Worker
    if (def.worker) {
      const gameState = this.game.getGameState();
      const primaryWorker = gameState.getWorkerForBuilding(building.id);
      const maxW = getMaxWorkers(building);
      const assignedCount = (primaryWorker ? 1 : 0) + (building.extraWorkerIds ?? []).filter((id) => gameState.getUnit(id)).length;
      html += `<br>Workers: ${assignedCount}/${maxW}`;
    }

    // Production progress
    if (building.state === BuildingState.Active && building.productionProgress > 0) {
      const pct = Math.round(building.productionProgress * 100);
      html += `<br>Production: ${pct}%`;
    }

    // Construction progress
    if (building.state === BuildingState.UnderConstruction) {
      const pct = Math.round(building.constructionProgress * 100);
      html += `<br>Construction: ${pct}%`;
    }

    // Inventory summary
    const inputs = Object.entries(building.inputInventory).filter(([, v]) => v && v > 0);
    const outputs = Object.entries(building.outputInventory).filter(([, v]) => v && v > 0);

    if (inputs.length > 0) {
      const items = inputs.map(([r, a]) => `${r}: ${a}`).join(', ');
      html += `<br>In: ${items}`;
    }
    if (outputs.length > 0) {
      const items = outputs.map(([r, a]) => `${r}: ${a}`).join(', ');
      html += `<br>Out: ${items}`;
    }

    // Knights
    if (building.knightIds.length > 0) {
      html += `<br>Knights: ${building.knightIds.length}/${def.knightSlots}`;
    }

    // Upgrade levels
    if (building.upgradeLevels) {
      const upgrades = Object.entries(building.upgradeLevels).filter(([, v]) => v > 0);
      if (upgrades.length > 0) {
        const labels: Record<string, string> = { storage: 'Storage', production: 'Speed', workers: 'Workers' };
        const items = upgrades.map(([axis, level]) => `${labels[axis] ?? axis} Lv.${level}`).join(', ');
        html += `<br><span style="color:#4caf50">${items}</span>`;
      }
    }

    // Active upgrade
    if (building.activeUpgrade) {
      const pct = Math.round((building.activeUpgrade.constructionProgress ?? 0) * 100);
      html += `<br>Upgrading: ${pct}%`;
    }

    this.element.innerHTML = html;
    this.element.style.display = 'block';

    // Position near cursor
    const tooltipW = this.element.offsetWidth;
    const viewportW = window.innerWidth;
    let left = screenX + 12;
    if (left + tooltipW > viewportW - 8) {
      left = screenX - tooltipW - 12;
    }
    this.element.style.left = `${left}px`;
    this.element.style.top = `${screenY + 12}px`;
  }

  private hide(): void {
    this.currentBuildingId = null;
    this.element.style.display = 'none';
  }

  dispose(): void {
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mouseleave', this.onMouseLeave);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchmove', this.onTouchCancel);
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    this.hide();
  }
}
