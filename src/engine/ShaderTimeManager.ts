import type * as THREE from 'three';

/**
 * Centralized manager for updating uTime uniforms on ShaderMaterials.
 * Replaces per-shader register/unregister/updateTime boilerplate
 * (previously duplicated in WaterShader.ts and TreeSwayShader.ts).
 */

type TimedMaterial = THREE.ShaderMaterial & { uniforms: { uTime: { value: number } } };

class ShaderTimeManager {
  private materials: Set<TimedMaterial> = new Set();

  /** Register a material so its uTime uniform is updated each frame. */
  register(material: TimedMaterial): void {
    this.materials.add(material);
  }

  /** Unregister a material (call on dispose to prevent leaks). */
  unregister(material: TimedMaterial): void {
    this.materials.delete(material);
  }

  /** Update uTime on all registered materials. Call once per frame. */
  update(elapsedTime: number): void {
    for (const material of this.materials) {
      material.uniforms.uTime.value = elapsedTime;
    }
  }
}

export const shaderTimeManager = new ShaderTimeManager();
