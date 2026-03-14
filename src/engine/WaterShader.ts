import * as THREE from 'three';

/**
 * Animated water material using custom ShaderMaterial.
 * Gentle vertex wave displacement + color cycling between shallow/deep hues.
 * Supports Three.js fog via built-in shader chunks.
 */

const waterVertexShader = /* glsl */ `
  #include <fog_pars_vertex>

  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vPos;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Two overlapping sine waves for organic movement
    float wave1 = sin(pos.x * 4.0 + uTime * 1.5) * 0.02;
    float wave2 = sin(pos.z * 3.0 + uTime * 1.2 + 1.5) * 0.015;
    pos.y += wave1 + wave2;

    vWave = wave1 + wave2;
    vPos = pos;

    #ifdef USE_INSTANCING
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
    #else
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    #endif
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`;

const waterFragmentShader = /* glsl */ `
  #include <fog_pars_fragment>

  uniform float uTime;
  uniform vec3 uColorShallow;
  uniform vec3 uColorDeep;
  uniform float uOpacity;

  varying vec2 vUv;
  varying float vWave;
  varying vec3 vPos;

  void main() {
    // Mix between shallow and deep color based on wave height + subtle animation
    float mixFactor = 0.5 + vWave * 8.0 + sin(vUv.x * 6.0 + uTime * 0.8) * 0.15;
    mixFactor = clamp(mixFactor, 0.0, 1.0);

    vec3 color = mix(uColorDeep, uColorShallow, mixFactor);

    // Subtle foam highlights on wave peaks
    float foam = smoothstep(0.025, 0.035, vWave);
    color = mix(color, vec3(0.85, 0.95, 1.0), foam * 0.4);

    // Blinn-Phong specular highlights
    // Compute wave-perturbed normal from analytical partial derivatives
    float dydx = cos(vPos.x * 4.0 + uTime * 1.5) * 4.0 * 0.02
               + 0.0; // wave2 has no x dependency
    float dydz = 0.0   // wave1 has no z dependency
               + cos(vPos.z * 3.0 + uTime * 1.2 + 1.5) * 3.0 * 0.015;
    vec3 normal = normalize(vec3(-dydx, 1.0, -dydz));

    // Fixed isometric view direction and light direction (sun)
    vec3 viewDir = normalize(vec3(-1.0, 1.0, -1.0));
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.75)); // directional sun
    vec3 halfDir = normalize(lightDir + viewDir);

    float specAngle = max(dot(normal, halfDir), 0.0);
    float specular = pow(specAngle, 64.0);

    vec3 sunColor = vec3(1.0, 0.95, 0.8);
    color += sunColor * specular * 0.4;

    gl_FragColor = vec4(color, uOpacity);

    #include <fog_fragment>
  }
`;

/** Create an animated water ShaderMaterial */
export function createWaterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsLib.fog,
      uTime: { value: 0 },
      uColorShallow: { value: new THREE.Color(0x40e0d0) }, // turquoise
      uColorDeep: { value: new THREE.Color(0x2090a0) },    // deeper teal
      uOpacity: { value: 0.82 },
    },
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    fog: true,
  });
}

import { shaderTimeManager } from './ShaderTimeManager';

/** Register a water material for time updates */
export function registerWaterMaterial(mat: THREE.ShaderMaterial): void {
  shaderTimeManager.register(mat as Parameters<typeof shaderTimeManager.register>[0]);
}

/** Unregister a water material (call on dispose to prevent leaks) */
export function unregisterWaterMaterial(mat: THREE.ShaderMaterial): void {
  shaderTimeManager.unregister(mat as Parameters<typeof shaderTimeManager.unregister>[0]);
}

