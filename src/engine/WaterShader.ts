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

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Two overlapping sine waves for organic movement
    float wave1 = sin(pos.x * 4.0 + uTime * 1.5) * 0.02;
    float wave2 = sin(pos.z * 3.0 + uTime * 1.2 + 1.5) * 0.015;
    pos.y += wave1 + wave2;

    vWave = wave1 + wave2;

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

  void main() {
    // Mix between shallow and deep color based on wave height + subtle animation
    float mixFactor = 0.5 + vWave * 8.0 + sin(vUv.x * 6.0 + uTime * 0.8) * 0.15;
    mixFactor = clamp(mixFactor, 0.0, 1.0);

    vec3 color = mix(uColorDeep, uColorShallow, mixFactor);

    // Subtle foam highlights on wave peaks
    float foam = smoothstep(0.025, 0.035, vWave);
    color = mix(color, vec3(0.85, 0.95, 1.0), foam * 0.4);

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

/** Shared water materials that get updated each frame */
const waterMaterials: THREE.ShaderMaterial[] = [];

/** Register a water material for time updates */
export function registerWaterMaterial(mat: THREE.ShaderMaterial): void {
  waterMaterials.push(mat);
}

/** Unregister a water material (call on dispose to prevent leaks) */
export function unregisterWaterMaterial(mat: THREE.ShaderMaterial): void {
  const idx = waterMaterials.indexOf(mat);
  if (idx !== -1) waterMaterials.splice(idx, 1);
}

/** Call each frame to animate all water materials */
export function updateWaterTime(time: number): void {
  for (const mat of waterMaterials) {
    mat.uniforms.uTime.value = time;
  }
}
