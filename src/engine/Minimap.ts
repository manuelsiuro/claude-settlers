import type { Game } from './Game';
import { HexGrid, HEX_WIDTH } from '../game/HexGrid';
import { TerrainType } from '../game/TerrainType';
import { ResourceType } from '../game/ResourceType';
import { BuildingState } from '../game/Building';
import { PLAYER_TERRITORY_CSS } from './PlayerColors';

/** Fixed color map for minimap terrain */
const TERRAIN_MINIMAP_COLORS: Record<string, string> = {
  [TerrainType.Grassland]: '#5cb85c',
  [TerrainType.Forest]: '#2d6a2d',
  [TerrainType.Mountain]: '#888888',
  [TerrainType.Water]: '#4a9bd9',
  [TerrainType.Desert]: '#d2b48c',
};

const BUILDING_COLOR = '#ffffff';
const ENEMY_BUILDING_COLOR = '#ff6666';
const CAMERA_RECT_COLOR = '#ffcc00';
const UNIT_OWN_COLOR = '#cccccc';
const UNIT_ENEMY_COLOR = '#ff4444';
const CONSTRUCTION_COLOR = '#ffcc00';

/** Minimap colors for revealed resource deposits */
const DEPOSIT_COLORS: Partial<Record<ResourceType, string>> = {
  [ResourceType.IronOre]: '#888888',
  [ResourceType.CoalOre]: '#333333',
  [ResourceType.GoldOre]: '#ffd700',
};

/** Throttle interval for minimap redraws (ms) */
const REDRAW_INTERVAL = 200;

/**
 * A 2D canvas minimap showing terrain, buildings, territory, and camera viewport.
 */
export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private game: Game;
  private animationId: number | null = null;

  /** Pixel size per hex cell */
  private cellSize: number;
  private mapWidth: number;
  private mapHeight: number;

  /** Throttle: last draw timestamp */
  private lastDrawTime = 0;

  /** Cached terrain image — terrain never changes */
  private terrainCache: ImageData | null = null;

  /** Layer visibility toggles */
  private layers = {
    territory: true,
    buildings: true,
    units: true,
    deposits: true,
    fog: true,
  };

  constructor(game: Game, container: HTMLElement) {
    this.game = game;

    const grid = game.getGrid();
    this.mapWidth = grid.width;
    this.mapHeight = grid.height;

    // Calculate cell size to fit in container
    const maxDim = Math.max(this.mapWidth, this.mapHeight);
    this.cellSize = Math.max(2, Math.floor(180 / maxDim));

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.mapWidth * this.cellSize;
    this.canvas.height = this.mapHeight * this.cellSize;
    this.canvas.style.width = '100%';
    this.canvas.style.height = 'auto';
    this.canvas.style.borderRadius = '8px';
    this.canvas.style.cursor = 'pointer';
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;

    // Click to move camera
    this.canvas.addEventListener('click', this.onClick);
    this.canvas.addEventListener('touchstart', this.onTouch, { passive: false });

    this.startLoop();
  }

  private onClick = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    this.moveCameraTo(px, py);
  };

  private onTouch = (e: TouchEvent): void => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const px = (touch.clientX - rect.left) * scaleX;
    const py = (touch.clientY - rect.top) * scaleY;
    this.moveCameraTo(px, py);
  };

  private moveCameraTo(px: number, py: number): void {
    // Convert pixel to hex coords
    const q = Math.floor(px / this.cellSize);
    const r = Math.floor(py / this.cellSize);

    // Convert hex to world position
    const { x, z } = HexGrid.hexToWorld(q, r);

    // Move camera to target position
    const camera = this.game.getCamera();
    const currentLookAt = this.estimateLookAt();

    const dx = x - currentLookAt.x;
    const dz = z - currentLookAt.z;

    camera.position.x += dx;
    camera.position.z += dz;
  }

  /**
   * Estimate the world point the camera is looking at.
   * Camera is positioned at lookAt + (h, h, h) for isometric view,
   * so lookAt = position - (h, h, h) where h = position.y.
   */
  private estimateLookAt(): { x: number; z: number } {
    const pos = this.game.getCamera().position;
    return { x: pos.x - pos.y, z: pos.z - pos.y };
  }

  private startLoop(): void {
    const render = (): void => {
      this.animationId = requestAnimationFrame(render);

      // Throttle redraws — minimap doesn't need 60 FPS
      const now = performance.now();
      if (now - this.lastDrawTime < REDRAW_INTERVAL) return;
      this.lastDrawTime = now;

      this.draw();
    };
    render();
  }

  private draw(): void {
    const { ctx, cellSize } = this;
    const gameState = this.game.getGameState();
    const humanId = this.game.getHumanPlayerId();
    const grid = this.game.getGrid();

    // Draw cached terrain (only compute once)
    if (!this.terrainCache) {
      this.drawTerrain();
      this.terrainCache = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    } else {
      ctx.putImageData(this.terrainCache, 0, 0);
    }

    // Draw territory overlay (all players)
    if (this.layers.territory) {
      const territoryMgr = this.game.getTerritoryManager();
      for (let r = 0; r < this.mapHeight; r++) {
        for (let q = 0; q < this.mapWidth; q++) {
          const owner = territoryMgr.getOwner(q, r);
          if (owner === null) continue;
          ctx.fillStyle = PLAYER_TERRITORY_CSS[owner] ?? 'rgba(170, 170, 170, 0.2)';
          ctx.fillRect(q * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    }

    // Draw fog of war overlay
    if (this.layers.fog) {
      const fogMgr = this.game.getFogOfWarManager();
      for (let r = 0; r < this.mapHeight; r++) {
        for (let q = 0; q < this.mapWidth; q++) {
          const vis = fogMgr.getVisibility(q, r, humanId);
          if (vis === 2) continue; // Visible — no fog overlay
          ctx.fillStyle = vis === 0 ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.45)';
          ctx.fillRect(q * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    }

    // Draw buildings (all players)
    const allBuildings = gameState.getAllBuildings();
    if (this.layers.buildings) {
      for (const b of allBuildings) {
        if (b.state === BuildingState.Destroyed) continue;
        ctx.fillStyle = b.playerId === humanId ? BUILDING_COLOR : ENEMY_BUILDING_COLOR;
        const px = b.coord.q * cellSize + cellSize / 2;
        const py = b.coord.r * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(2, cellSize / 2 - 1), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw resource deposit markers (revealed but unclaimed)
    if (this.layers.deposits) {
      const depositRadius = Math.max(1, cellSize / 3);
      for (let r = 0; r < this.mapHeight; r++) {
        for (let q = 0; q < this.mapWidth; q++) {
          const tile = grid.getTile(q, r);
          if (!tile?.deposit) continue;
          if (!tile.deposit.revealed || tile.deposit.claimed) continue;
          const color = DEPOSIT_COLORS[tile.deposit.resource];
          if (!color) continue;
          ctx.fillStyle = color;
          const dx = q * cellSize + cellSize / 2;
          const dy = r * cellSize + cellSize / 2;
          ctx.beginPath();
          ctx.arc(dx, dy, depositRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw units
    if (this.layers.units) {
      const allUnits = gameState.getAllUnits();
      for (const u of allUnits) {
        ctx.fillStyle = u.playerId === humanId ? UNIT_OWN_COLOR : UNIT_ENEMY_COLOR;
        const ux = u.coord.q * cellSize + cellSize / 2;
        const uy = u.coord.r * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.arc(ux, uy, Math.max(1, cellSize / 4), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw construction indicators (yellow pulsing dots)
    if (this.layers.buildings) {
      for (const b of allBuildings) {
        if (b.state !== BuildingState.UnderConstruction) continue;
        if (b.playerId !== humanId) continue;
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.005);
        ctx.fillStyle = CONSTRUCTION_COLOR;
        ctx.globalAlpha = pulse;
        const cx = b.coord.q * cellSize + cellSize / 2;
        const cy = b.coord.r * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(2, cellSize / 2 - 1), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
    }

    // Draw camera viewport rectangle
    this.drawCameraRect();
  }

  /** Draw terrain tiles — called once and cached */
  private drawTerrain(): void {
    const { ctx, cellSize } = this;
    const grid = this.game.getGrid();

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let r = 0; r < this.mapHeight; r++) {
      for (let q = 0; q < this.mapWidth; q++) {
        const tile = grid.getTile(q, r);
        if (!tile) continue;
        ctx.fillStyle = TERRAIN_MINIMAP_COLORS[tile.terrain] ?? '#333';
        ctx.fillRect(q * cellSize, r * cellSize, cellSize, cellSize);
      }
    }
  }

  private drawCameraRect(): void {
    const { ctx, cellSize } = this;
    const lookAt = this.estimateLookAt();
    const frustum = this.game.getFrustum();

    // Convert world look-at to hex coords
    const centerHex = HexGrid.worldToHex(lookAt.x, lookAt.z);

    // Approximate visible area in hex units
    // Ortho camera: frustum = half-height in world units
    // For isometric view at 45°, the ground footprint is larger by sqrt(2)
    const canvas3d = this.game.getRenderer().domElement;
    const aspect = canvas3d.width / canvas3d.height;
    const isoScale = Math.sqrt(2);
    const visibleWorldW = frustum * 2 * aspect * isoScale;
    const visibleWorldH = frustum * 2 * isoScale;

    // Convert world size to hex grid units
    // World X: HEX_WIDTH per hex column, World Z: 1.5 * HEX_SIZE per hex row
    const visibleHexW = visibleWorldW / HEX_WIDTH;
    const visibleHexH = visibleWorldH / 1.5;

    const rx = (centerHex.q - visibleHexW / 2) * cellSize;
    const ry = (centerHex.r - visibleHexH / 2) * cellSize;
    const rw = visibleHexW * cellSize;
    const rh = visibleHexH * cellSize;

    ctx.strokeStyle = CAMERA_RECT_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, rw, rh);
  }

  /** Toggle visibility of a minimap layer */
  setLayerVisible(layer: keyof typeof this.layers, visible: boolean): void {
    if (layer in this.layers) {
      this.layers[layer] = visible;
    }
  }

  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    this.canvas.removeEventListener('click', this.onClick);
    this.canvas.removeEventListener('touchstart', this.onTouch);
    this.canvas.remove();
  }
}
