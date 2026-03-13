import * as THREE from 'three';
import type { ActiveDuel } from '../game/CombatAnimationState';
import { DuelPhase, getDuelPhaseProgress } from '../game/CombatAnimationState';
import { HexGrid } from '../game/HexGrid';
import type { Building } from '../game/Building';
import { MapRenderer } from './MapRenderer';
import { getPlayerColor } from './PlayerColors';

/**
 * Manages visual effects during active combat duels and attack warnings.
 *
 * - Approach: Interpolate knights toward midpoint
 * - Clash: Rotate units ±30°, flash on impact
 * - Recoil: Bounce apart
 * - Result: Winner scale pulse, loser falls
 * - Attack warning: Pulsing red ring + exclamation on attacked buildings
 */
export class CombatRenderer {
  private scene: THREE.Scene | null = null;
  private grid: HexGrid | null = null;
  private elapsedTime = 0;

  /** Active attack warning rings: buildingId → { ring, timer, icon } */
  private attackWarnings: Map<string, { ring: THREE.Mesh; icon: THREE.Group; timer: number }> = new Map();

  /** Capture banner animations: { mesh, timer } */
  private captureBanners: { mesh: THREE.Mesh; timer: number; targetY: number }[] = [];

  addToScene(scene: THREE.Scene, grid: HexGrid): void {
    this.scene = scene;
    this.grid = grid;
  }

  /**
   * Update combat visualizations each frame.
   */
  update(
    deltaTime: number,
    activeDuels: readonly ActiveDuel[],
    getUnitMesh: (id: string) => THREE.Group | undefined,
  ): void {
    this.elapsedTime += deltaTime;

    // Update duel visualizations
    for (const duel of activeDuels) {
      this.updateDuelVisual(duel, getUnitMesh);
    }

    // Update attack warning rings
    for (const [id, warning] of this.attackWarnings) {
      warning.timer -= deltaTime;
      if (warning.timer <= 0) {
        warning.ring.removeFromParent();
        warning.ring.geometry.dispose();
        (warning.ring.material as THREE.Material).dispose();
        // Dispose icon child geometries and materials
        warning.icon.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) child.material.dispose();
          }
        });
        warning.icon.removeFromParent();
        this.attackWarnings.delete(id);
        continue;
      }
      // Pulsing opacity (fast 5Hz)
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(this.elapsedTime * Math.PI * 5));
      (warning.ring.material as THREE.MeshBasicMaterial).opacity = pulse;
      // Bob the icon
      warning.icon.position.y = 1.0 + Math.sin(this.elapsedTime * 3) * 0.1;
    }

    // Update capture banners
    for (let i = this.captureBanners.length - 1; i >= 0; i--) {
      const banner = this.captureBanners[i];
      banner.timer -= deltaTime;
      if (banner.timer <= 0) {
        banner.mesh.removeFromParent();
        banner.mesh.geometry.dispose();
        (banner.mesh.material as THREE.Material).dispose();
        this.captureBanners.splice(i, 1);
        continue;
      }
      // Rise from ground
      const progress = 1.0 - banner.timer / 1.0;
      banner.mesh.position.y = 0.1 + progress * banner.targetY;
      (banner.mesh.material as THREE.MeshBasicMaterial).opacity = 1.0 - progress * 0.3;
    }
  }

  private updateDuelVisual(
    duel: ActiveDuel,
    getUnitMesh: (id: string) => THREE.Group | undefined,
  ): void {
    const attackerMesh = getUnitMesh(duel.attackerId);
    const defenderMesh = getUnitMesh(duel.defenderId);
    if (!attackerMesh && !defenderMesh) return;

    const progress = getDuelPhaseProgress(duel);

    switch (duel.phase) {
      case DuelPhase.Approach:
        // Move toward midpoint
        if (attackerMesh) {
          const dx = (duel.worldX - attackerMesh.position.x) * progress * 0.5;
          const dz = (duel.worldZ - attackerMesh.position.z) * progress * 0.5;
          attackerMesh.position.x += dx * 0.02;
          attackerMesh.position.z += dz * 0.02;
        }
        if (defenderMesh) {
          const dx = (duel.worldX - defenderMesh.position.x) * progress * 0.5;
          const dz = (duel.worldZ - defenderMesh.position.z) * progress * 0.5;
          defenderMesh.position.x += dx * 0.02;
          defenderMesh.position.z += dz * 0.02;
        }
        break;

      case DuelPhase.Clash: {
        // Swing rotation
        const swingAngle = Math.sin(progress * Math.PI) * 0.5;
        if (attackerMesh) attackerMesh.rotation.z = swingAngle;
        if (defenderMesh) defenderMesh.rotation.z = -swingAngle;
        break;
      }

      case DuelPhase.Recoil:
        // Bounce apart slightly
        if (attackerMesh) attackerMesh.rotation.z = -0.1 * (1.0 - progress);
        if (defenderMesh) defenderMesh.rotation.z = 0.1 * (1.0 - progress);
        break;

      case DuelPhase.Result: {
        const winnerMesh = getUnitMesh(duel.winnerId);
        const loserMesh = getUnitMesh(duel.loserId);

        // Winner: scale pulse (preserve original scale, default 0.6 from UnitRenderer)
        if (winnerMesh) {
          const scalePulse = 1.0 + 0.1 * Math.sin(progress * Math.PI);
          const baseScale = winnerMesh.userData.originalScale ?? 0.6;
          winnerMesh.scale.setScalar(baseScale * scalePulse);
        }

        // Loser: fall over and fade
        if (loserMesh) {
          loserMesh.rotation.x = progress * Math.PI * 0.5;
          this.setMeshOpacity(loserMesh, 1.0 - progress);
        }
        break;
      }
    }
  }

  /** Show attack warning ring on a building */
  showAttackWarning(building: Building, duration = 5.0): void {
    if (!this.scene || !this.grid) return;
    if (this.attackWarnings.has(building.id)) {
      // Refresh timer
      this.attackWarnings.get(building.id)!.timer = duration;
      return;
    }

    const { x, z } = HexGrid.hexToWorld(building.coord.q, building.coord.r);
    const tile = this.grid.getTile(building.coord.q, building.coord.r);
    const y = tile ? MapRenderer.getTileY(tile) : 0;

    // Red pulsing ring
    const ringGeom = new THREE.RingGeometry(0.5, 0.6, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.05, z);
    this.scene.add(ring);

    // Exclamation mark icon (cylinder + sphere)
    const iconGroup = new THREE.Group();
    const barGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 4);
    const barMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const bar = new THREE.Mesh(barGeom, barMat);
    bar.position.y = 0.15;
    iconGroup.add(bar);

    const dotGeom = new THREE.SphereGeometry(0.04, 6, 6);
    const dot = new THREE.Mesh(dotGeom, barMat);
    dot.position.y = 0;
    iconGroup.add(dot);

    iconGroup.position.set(x, y + 1.0, z);
    this.scene.add(iconGroup);

    this.attackWarnings.set(building.id, { ring, icon: iconGroup, timer: duration });
  }

  /** Show capture banner animation */
  showCaptureBanner(building: Building, playerId: number): void {
    if (!this.scene || !this.grid) return;

    const { x, z } = HexGrid.hexToWorld(building.coord.q, building.coord.r);
    const tile = this.grid.getTile(building.coord.q, building.coord.r);
    const y = tile ? MapRenderer.getTileY(tile) : 0;

    const bannerGeom = new THREE.PlaneGeometry(0.15, 0.3);
    const bannerMat = new THREE.MeshBasicMaterial({
      color: getPlayerColor(playerId),
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
    });
    const banner = new THREE.Mesh(bannerGeom, bannerMat);
    banner.position.set(x + 0.2, y + 0.1, z);
    this.scene.add(banner);

    this.captureBanners.push({ mesh: banner, timer: 1.0, targetY: 0.5 });
  }

  private setMeshOpacity(group: THREE.Group, opacity: number): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
        child.material.transparent = true;
        child.material.opacity = opacity;
      }
    });
  }

  dispose(): void {
    for (const warning of this.attackWarnings.values()) {
      warning.ring.removeFromParent();
      warning.ring.geometry.dispose();
      (warning.ring.material as THREE.Material).dispose();
      warning.icon.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) child.material.dispose();
        }
      });
      warning.icon.removeFromParent();
    }
    this.attackWarnings.clear();

    for (const banner of this.captureBanners) {
      banner.mesh.removeFromParent();
      banner.mesh.geometry.dispose();
      (banner.mesh.material as THREE.Material).dispose();
    }
    this.captureBanners = [];
  }
}
