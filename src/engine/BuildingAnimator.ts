import * as THREE from 'three';
import type { Building } from '../game/Building';
import { BuildingState } from '../game/Building';
import { BuildingType } from '../game/BuildingType';

/**
 * Animates building sub-meshes per frame.
 * Windmill sails rotate, furnaces glow, sawmill blades oscillate.
 */
export class BuildingAnimator {
  private elapsedTime = 0;

  /** Current nightness level 0.0–1.0 for night glow effects */
  nightness = 0;

  /** Track buildings pending destruction animation: buildingId → { mesh, timer } */
  private destroyAnimations: Map<string, { mesh: THREE.Group; timer: number; startScale: THREE.Vector3 }> = new Map();

  /** Track buildings that recently activated: buildingId → timer */
  private completionGlows: Map<string, number> = new Map();

  /**
   * Update building animations each frame.
   * @param deltaTime Frame delta in seconds
   * @param buildings All game buildings
   * @param getMesh Function to get 3D mesh by building ID
   */
  update(
    deltaTime: number,
    buildings: readonly Building[],
    getMesh: (id: string) => THREE.Group | undefined,
  ): void {
    this.elapsedTime += deltaTime;
    const t = this.elapsedTime;

    for (const building of buildings) {
      if (building.state !== BuildingState.Active) continue;

      const mesh = getMesh(building.id);
      if (!mesh) continue;

      const isProducing = building.productionProgress > 0;

      switch (building.type) {
        case BuildingType.Windmill:
          this.animateWindmill(mesh, t, isProducing);
          break;
        case BuildingType.IronSmelter:
        case BuildingType.BlacksmithArmory:
        case BuildingType.Bakery:
        case BuildingType.GoldsmithMint:
        case BuildingType.Brewery:
        case BuildingType.Winery:
        case BuildingType.CharcoalBurner:
        case BuildingType.CheeseMakerBuilding:
          this.animateFurnace(mesh, t, isProducing);
          break;
        case BuildingType.Sawmill:
          this.animateSawmill(mesh, t, isProducing);
          break;
      }

      // Night glow: warm window light on active buildings at night
      if (this.nightness > 0.4 && !isProducing) {
        const nightIntensity = Math.min(1.0, (this.nightness - 0.4) / 0.3) * 0.08;
        this.setEmissive(mesh, 1.0, 0.8, 0.4, nightIntensity);
      } else if (this.nightness > 0.4 && isProducing) {
        // Producing buildings get a slightly brighter warm glow at night
        const nightIntensity = Math.min(1.0, (this.nightness - 0.4) / 0.3) * 0.12;
        // Only apply if not already handled by furnace animation
        if (building.type !== BuildingType.IronSmelter &&
            building.type !== BuildingType.BlacksmithArmory &&
            building.type !== BuildingType.Bakery &&
            building.type !== BuildingType.GoldsmithMint &&
            building.type !== BuildingType.Brewery &&
            building.type !== BuildingType.Winery &&
            building.type !== BuildingType.CharcoalBurner &&
            building.type !== BuildingType.CheeseMakerBuilding) {
          this.setEmissive(mesh, 1.0, 0.7, 0.3, nightIntensity);
        }
      } else if (this.nightness <= 0.4 && !isProducing) {
        // Reset emissive when not night and not producing
        this.resetEmissive(mesh);
      }

      // Completion glow
      const glowTimer = this.completionGlows.get(building.id);
      if (glowTimer !== undefined) {
        const newTimer = glowTimer - deltaTime;
        if (newTimer <= 0) {
          this.completionGlows.delete(building.id);
          this.resetEmissive(mesh);
        } else {
          this.completionGlows.set(building.id, newTimer);
          const intensity = newTimer > 1.0 ? 0.3 : 0.3 * (newTimer / 1.0);
          this.setEmissive(mesh, 0.2, 1.0, 0.2, intensity);
        }
      }
    }

    // Construction opacity
    for (const building of buildings) {
      if (building.state !== BuildingState.UnderConstruction && building.state !== BuildingState.Planned) continue;
      const mesh = getMesh(building.id);
      if (!mesh) continue;

      if (building.state === BuildingState.Planned) {
        this.setOpacity(mesh, 0.2);
      } else {
        // Ramp from 30% to 100% based on construction progress
        const opacity = 0.3 + 0.7 * building.constructionProgress;
        this.setOpacity(mesh, opacity);
      }
    }

    // Destruction animations
    for (const [id, anim] of this.destroyAnimations) {
      anim.timer -= deltaTime;
      if (anim.timer <= 0) {
        anim.mesh.removeFromParent();
        this.destroyAnimations.delete(id);
        continue;
      }
      const progress = 1.0 - anim.timer / 1.0; // 0→1
      anim.mesh.scale.set(
        anim.startScale.x * (1.0 + progress * 0.3),
        anim.startScale.y * (1.0 - progress),
        anim.startScale.z * (1.0 + progress * 0.3),
      );
      anim.mesh.rotation.z = progress * 0.3;
      this.setOpacity(anim.mesh, 1.0 - progress);
    }
  }

  /** Notify that a building just became Active (for completion glow) */
  onBuildingActivated(buildingId: string): void {
    this.completionGlows.set(buildingId, 2.0); // 2 second glow
  }

  /** Start destruction animation for a building mesh */
  startDestroyAnimation(buildingId: string, mesh: THREE.Group): void {
    this.destroyAnimations.set(buildingId, {
      mesh,
      timer: 1.0,
      startScale: mesh.scale.clone(),
    });
  }

  private animateWindmill(mesh: THREE.Group, t: number, isProducing: boolean): void {
    // Find sails child mesh
    const sails = mesh.getObjectByName('sails') ?? this.findChildByIndex(mesh);
    if (sails) {
      const targetSpeed = isProducing ? 2.0 : 0;
      // Simple approach: always rotate when producing
      if (isProducing) {
        sails.rotation.z = t * targetSpeed;
      }
    }
  }

  private animateFurnace(mesh: THREE.Group, t: number, isProducing: boolean): void {
    if (!isProducing) return;
    // Pulse emissive on all meshes with warm colors
    const intensity = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(t * 3.0));
    this.setEmissive(mesh, 1.0, 0.4, 0.1, intensity * 0.15);
  }

  private animateSawmill(mesh: THREE.Group, t: number, isProducing: boolean): void {
    if (!isProducing) return;
    // Find saw blade child or use first child
    const blade = mesh.getObjectByName('saw_blade') ?? this.findChildByIndex(mesh);
    if (blade) {
      blade.rotation.x = Math.sin(t * 6.0) * 0.5;
    }
  }

  /** Find a plausible child mesh by name hint (fallback for unnamed Blender exports) */
  private findChildByIndex(group: THREE.Group): THREE.Object3D | null {
    // For unnamed meshes, try the topmost child that isn't the base
    if (group.children.length > 1) {
      return group.children[group.children.length - 1];
    }
    return null;
  }

  private setEmissive(group: THREE.Group, r: number, g: number, b: number, intensity: number): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.emissive.setRGB(r * intensity, g * intensity, b * intensity);
      }
    });
  }

  private resetEmissive(group: THREE.Group): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.emissive.setRGB(0, 0, 0);
      }
    });
  }

  private setOpacity(group: THREE.Group, opacity: number): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
        child.material.transparent = opacity < 1.0;
        child.material.opacity = opacity;
      }
    });
  }

  dispose(): void {
    for (const anim of this.destroyAnimations.values()) {
      anim.mesh.removeFromParent();
    }
    this.destroyAnimations.clear();
    this.completionGlows.clear();
  }
}
