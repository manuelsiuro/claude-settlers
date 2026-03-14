import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Color grading shader — always-on post-processing pass.
 *
 * Applies three adjustments in order:
 *  1. Warm tint  — multiply by vec3(1.05, 1.0, 0.92)
 *  2. Contrast   — mix(0.5, color, 1.15)
 *  3. Saturation — mix(luminance, color, 1.1)
 */
const ColorGradingShader = {
  name: 'ColorGradingShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    warmTint: { value: new THREE.Vector3(1.05, 1.0, 0.92) },
    contrast: { value: 1.15 },
    saturation: { value: 1.1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 warmTint;
    uniform float contrast;
    uniform float saturation;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = texel.rgb;

      // 1. Warm tint
      color *= warmTint;

      // 2. Contrast enhancement
      color = mix(vec3(0.5), color, contrast);

      // 3. Saturation boost
      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(vec3(luma), color, saturation);

      gl_FragColor = vec4(color, texel.a);
    }
  `,
};

/**
 * Post-processing pipeline for the game.
 *
 * Always-on: color grading (warm tint, contrast, saturation).
 * Optional:  UnrealBloomPass for selective bloom on emissive objects.
 */
export class PostProcessing {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass | null = null;
  private colorGradingPass: ShaderPass;
  private outputPass: OutputPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    this.composer = new EffectComposer(renderer);

    // 1. Render the scene
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // 2. Color grading (always on)
    this.colorGradingPass = new ShaderPass(ColorGradingShader);
    this.composer.addPass(this.colorGradingPass);

    // 3. Output pass (handles color-space conversion for correct sRGB output)
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  /** Enable or disable bloom. Creates the bloom pass lazily on first enable. */
  setBloomEnabled(enabled: boolean): void {
    if (enabled && !this.bloomPass) {
      // Create bloom pass with conservative settings
      const size = this.composer.renderer.getSize(new THREE.Vector2());
      this.bloomPass = new UnrealBloomPass(
        size,
        0.3,  // strength — subtle glow
        0.4,  // radius
        0.85, // threshold — only bright/emissive objects bloom
      );

      // Insert bloom after color grading, before output
      // Passes order: RenderPass(0), ColorGrading(1), [Bloom(2)], Output(last)
      this.composer.removePass(this.outputPass);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(this.outputPass);
    }

    if (this.bloomPass) {
      this.bloomPass.enabled = enabled;
    }
  }

  /** Render the scene with post-processing applied. */
  render(): void {
    this.composer.render();
  }

  /** Update internal render targets when the window resizes. */
  resize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  /** Clean up all GPU resources. */
  dispose(): void {
    this.composer.dispose();
  }
}
