import * as THREE from 'three';

/**
 * Custom ShaderMaterial for GPU-driven tree wind sway animation.
 * Follows the same pattern as WaterShader.ts: uniform time update + registration.
 *
 * Displaces vertices above a Y threshold to create treetop sway while the trunk stays still.
 * Uses instanced rendering for zero CPU cost per tree.
 */

const treeSwayVertexShader = /* glsl */ `
  #include <fog_pars_vertex>

  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal2;

  void main() {
    vUv = uv;
    vNormal2 = normal;
    vec3 pos = position;

    // Compute a per-instance phase offset from instance position
    #ifdef USE_INSTANCING
      vec4 worldPos4 = instanceMatrix * vec4(pos, 1.0);
      float phase = worldPos4.x * 1.7 + worldPos4.z * 2.3;
    #else
      float phase = pos.x * 1.7 + pos.z * 2.3;
    #endif

    // Only sway vertices above Y threshold (treetop sways, trunk stays)
    float swayAmount = max(0.0, (pos.y - 0.2) * 0.3);
    pos.x += sin(uTime * 1.2 + phase) * swayAmount * 0.03;
    pos.z += cos(uTime * 0.9 + phase * 0.7) * swayAmount * 0.02;

    #ifdef USE_INSTANCING
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
    #else
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    #endif
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`;

const treeSwayFragmentShader = /* glsl */ `
  #include <fog_pars_fragment>

  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vNormal2;

  void main() {
    // Simple directional lighting
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
    float light = max(dot(vNormal2, lightDir), 0.0) * 0.5 + 0.5;

    gl_FragColor = vec4(uColor * light, uOpacity);

    #include <fog_fragment>
  }
`;

/** Create a tree sway ShaderMaterial that can be used with InstancedMesh */
export function createTreeSwayMaterial(
  color: THREE.Color,
  opacity = 1.0,
): THREE.ShaderMaterial {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsLib.fog,
      uTime: { value: 0 },
      uColor: { value: color },
      uOpacity: { value: opacity },
    },
    vertexShader: treeSwayVertexShader,
    fragmentShader: treeSwayFragmentShader,
    transparent: opacity < 1.0,
    side: THREE.DoubleSide,
    fog: true,
  });
  return mat;
}

import { shaderTimeManager } from './ShaderTimeManager';

/** Register a tree sway material for time updates */
export function registerTreeSwayMaterial(mat: THREE.ShaderMaterial): void {
  shaderTimeManager.register(mat as Parameters<typeof shaderTimeManager.register>[0]);
}

/** Unregister a tree sway material (call on dispose) */
export function unregisterTreeSwayMaterial(mat: THREE.ShaderMaterial): void {
  shaderTimeManager.unregister(mat as Parameters<typeof shaderTimeManager.unregister>[0]);
}

