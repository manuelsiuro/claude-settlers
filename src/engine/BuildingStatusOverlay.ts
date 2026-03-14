import * as THREE from 'three';
import type { Building } from '../game/Building';
import { BuildingState } from '../game/Building';
import { BUILDING_DEFINITIONS } from '../game/BuildingType';
import type { GameState } from '../game/GameState';
import { getEffectiveStorageCapacity } from '../game/BuildingUpgrade';

/**
 * Status types in priority order (highest first).
 */
export const StatusType = {
  NoWorker: 'no_worker',
  MissingInputs: 'missing_inputs',
  StorageFull: 'storage_full',
  Paused: 'paused',
  Upgrading: 'upgrading',
  Producing: 'producing',
  Construction: 'construction',
  None: 'none',
} as const;

export type StatusType = (typeof StatusType)[keyof typeof StatusType];

/** Colors for each status type */
const STATUS_COLORS: Record<string, number> = {
  [StatusType.NoWorker]: 0xff3333,
  [StatusType.MissingInputs]: 0xffaa00,
  [StatusType.StorageFull]: 0xff8800,
  [StatusType.Paused]: 0x888888,
  [StatusType.Upgrading]: 0x2196f3,
  [StatusType.Producing]: 0x44cc44,
  [StatusType.Construction]: 0x4488ff,
};

/** Cached canvas textures (one per status type) */
const textureCache = new Map<string, THREE.CanvasTexture>();

function getStatusTexture(status: StatusType): THREE.CanvasTexture {
  const cached = textureCache.get(status);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;

  const color = STATUS_COLORS[status] ?? 0xffffff;
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const cssColor = `rgb(${r},${g},${b})`;

  ctx.clearRect(0, 0, 32, 32);

  switch (status) {
    case StatusType.NoWorker:
      // Red X
      ctx.strokeStyle = cssColor;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(8, 8);
      ctx.lineTo(24, 24);
      ctx.moveTo(24, 8);
      ctx.lineTo(8, 24);
      ctx.stroke();
      break;
    case StatusType.MissingInputs:
      // Amber hourglass
      ctx.fillStyle = cssColor;
      ctx.beginPath();
      ctx.moveTo(10, 4);
      ctx.lineTo(22, 4);
      ctx.lineTo(16, 16);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(10, 28);
      ctx.lineTo(22, 28);
      ctx.lineTo(16, 16);
      ctx.closePath();
      ctx.fill();
      break;
    case StatusType.StorageFull:
      // Orange warning triangle
      ctx.fillStyle = cssColor;
      ctx.beginPath();
      ctx.moveTo(16, 4);
      ctx.lineTo(28, 28);
      ctx.lineTo(4, 28);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 16, 20);
      break;
    case StatusType.Paused:
      // Grey pause bars
      ctx.fillStyle = cssColor;
      ctx.fillRect(9, 6, 5, 20);
      ctx.fillRect(18, 6, 5, 20);
      break;
    case StatusType.Upgrading:
      // Blue upward arrow
      ctx.fillStyle = cssColor;
      ctx.beginPath();
      ctx.moveTo(16, 4);
      ctx.lineTo(26, 16);
      ctx.lineTo(20, 16);
      ctx.lineTo(20, 28);
      ctx.lineTo(12, 28);
      ctx.lineTo(12, 16);
      ctx.lineTo(6, 16);
      ctx.closePath();
      ctx.fill();
      break;
    case StatusType.Producing:
      // Green checkmark
      ctx.strokeStyle = cssColor;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(8, 16);
      ctx.lineTo(14, 24);
      ctx.lineTo(24, 8);
      ctx.stroke();
      break;
    case StatusType.Construction:
      // Blue hammer
      ctx.fillStyle = cssColor;
      ctx.fillRect(14, 8, 4, 16);
      ctx.fillRect(8, 4, 16, 6);
      break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  textureCache.set(status, texture);
  return texture;
}

/**
 * Renders status icon sprites above buildings.
 * Uses THREE.Sprite with cached CanvasTextures (shared across all instances).
 */
export class BuildingStatusOverlay {
  /** buildingId → { sprite, lastStatus } */
  private sprites: Map<string, { sprite: THREE.Sprite; lastStatus: StatusType }> = new Map();
  private updateCooldown = 0;
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      for (const { sprite } of this.sprites.values()) {
        sprite.visible = false;
      }
    }
  }

  /**
   * Update status icons. Call each frame; internally throttled to 500ms.
   */
  update(
    deltaTime: number,
    buildings: readonly Building[],
    gameState: GameState,
    getMesh: (id: string) => THREE.Group | undefined,
  ): void {
    this.updateCooldown -= deltaTime;
    if (this.updateCooldown > 0) return;
    this.updateCooldown = 0.5;

    if (!this.enabled) return;

    const activeIds = new Set<string>();

    for (const building of buildings) {
      if (building.state === BuildingState.Destroyed) continue;
      if (building.state === BuildingState.Planned) continue;

      const mesh = getMesh(building.id);
      if (!mesh) continue;

      const status = this.computeStatus(building, gameState);
      if (status === StatusType.None) {
        this.removeSprite(building.id);
        continue;
      }

      activeIds.add(building.id);

      const existing = this.sprites.get(building.id);
      if (existing && existing.lastStatus === status) continue;

      // Create or update sprite
      if (existing) {
        existing.sprite.material.map = getStatusTexture(status);
        existing.sprite.material.needsUpdate = true;
        existing.lastStatus = status;
      } else {
        const spriteMat = new THREE.SpriteMaterial({
          map: getStatusTexture(status),
          transparent: true,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(0.25, 0.25, 1);
        sprite.position.set(0, 0.8, 0);
        mesh.add(sprite);
        this.sprites.set(building.id, { sprite, lastStatus: status });
      }
    }

    // Remove sprites for buildings that no longer qualify
    for (const id of this.sprites.keys()) {
      if (!activeIds.has(id)) {
        this.removeSprite(id);
      }
    }
  }

  private computeStatus(building: Building, gameState: GameState): StatusType {
    const def = BUILDING_DEFINITIONS[building.type];

    if (building.state === BuildingState.UnderConstruction) {
      return StatusType.Construction;
    }

    if (building.state !== BuildingState.Active) return StatusType.None;

    // No-worker check (buildings that need workers) — use canonical truth from gameState
    if (def.worker && !gameState.getWorkerForBuilding(building.id)) {
      return StatusType.NoWorker;
    }

    // Production paused
    if (building.productionPaused) {
      return StatusType.Paused;
    }

    // Missing inputs check
    if (def.production && def.production.inputs.length > 0) {
      for (const input of def.production.inputs) {
        const available = building.inputInventory[input.resource] ?? 0;
        if (available < input.amount) {
          return StatusType.MissingInputs;
        }
      }
    }

    // Storage full check (use effective capacity from upgrades)
    if (def.storageCapacity > 0) {
      let total = 0;
      for (const amount of Object.values(building.outputInventory)) {
        total += amount ?? 0;
      }
      const effectiveCap = getEffectiveStorageCapacity(building);
      if (total >= effectiveCap) {
        return StatusType.StorageFull;
      }
    }

    // Upgrading check (lower priority than storage/inputs issues)
    if (building.activeUpgrade) {
      return StatusType.Upgrading;
    }

    // Producing
    if (building.productionProgress > 0) {
      return StatusType.Producing;
    }

    return StatusType.None;
  }

  private removeSprite(buildingId: string): void {
    const entry = this.sprites.get(buildingId);
    if (entry) {
      entry.sprite.removeFromParent();
      entry.sprite.material.dispose();
      this.sprites.delete(buildingId);
    }
  }

  dispose(): void {
    for (const { sprite } of this.sprites.values()) {
      sprite.removeFromParent();
      sprite.material.dispose();
    }
    this.sprites.clear();
  }
}
