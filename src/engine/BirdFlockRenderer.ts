import * as THREE from 'three';
import { shaderTimeManager } from './ShaderTimeManager';

// ── Shaders ──

const BIRD_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uFrustum;
  uniform float uNightness;
  uniform vec3 uFlockCenters[6];
  attribute float aFlockId;
  attribute float aPhase;
  attribute vec2 aOffset;
  varying float vAlpha;
  varying float vWingPhase;

  void main() {
    int fid = int(aFlockId);
    vec3 flockCenter = uFlockCenters[fid];
    // Add per-bird offset + slight sine drift for organic movement
    vec3 pos = flockCenter + vec3(
      aOffset.x + sin(uTime * 0.5 + aPhase) * 0.3,
      sin(uTime * 0.3 + aPhase * 2.0) * 0.2,
      aOffset.y + cos(uTime * 0.4 + aPhase) * 0.3
    );
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (8.0 + sin(uTime * 6.0 + aPhase) * 2.0) * (10.0 / uFrustum);
    vAlpha = smoothstep(0.7, 0.5, uNightness);
    vWingPhase = uTime * 6.0 + aPhase;
  }
`;

const BIRD_FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying float vWingPhase;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    // Draw V-shape bird silhouette
    float wingAngle = 0.3 + sin(vWingPhase) * 0.15;
    float leftWing = abs(uv.y - wingAngle * uv.x);
    float rightWing = abs(uv.y + wingAngle * uv.x);
    float body = min(leftWing, rightWing);
    float bird = 1.0 - smoothstep(0.05, 0.15, body);
    bird *= step(uv.y, 0.3); // cut off top
    if (bird < 0.1 || vAlpha < 0.01) discard;
    gl_FragColor = vec4(0.15, 0.12, 0.1, bird * vAlpha);
  }
`;

// ── Types ──

interface FlockData {
  center: THREE.Vector3;
  direction: THREE.Vector2;
  speed: number;
  birdCount: number;
  height: number;
  pattern: 'linear' | 'circling';
  circleCenter?: THREE.Vector2;
  circleRadius?: number;
  circleAngle?: number;
}

// ── Constants ──

const FLOCK_COUNT = 5;
const MIN_BIRDS_PER_FLOCK = 3;
const MAX_BIRDS_PER_FLOCK = 8;
const FLOCK_SPREAD = 2.0;
const MIN_HEIGHT = 6;
const MAX_HEIGHT = 12;
const MIN_SPEED = 1.5;
const MAX_SPEED = 3.0;
const WRAP_DISTANCE = 20;
const CIRCLE_RADIUS_MIN = 4;
const CIRCLE_RADIUS_MAX = 8;
const CIRCLE_ANGULAR_SPEED = 0.3;

/**
 * GPU-driven bird flock renderer.
 * Renders 4-6 flocks of V-shaped bird silhouettes flying across the sky.
 * CPU updates only flock centers (4-6 vec3 per frame);
 * individual bird positions are GPU-computed via per-bird attributes.
 */
export class BirdFlockRenderer {
  private points: THREE.Points | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private flocks: FlockData[] = [];
  private nightness = 0;
  private enabled = true;
  private totalBirds = 0;
  private maxBirds: number;

  constructor(maxBirds = 40) {
    this.maxBirds = maxBirds;
  }

  addToScene(scene: THREE.Scene): void {
    this.initFlocks();
    this.createGeometry();
    if (this.points) {
      scene.add(this.points);
    }
  }

  setNightness(nightness: number): void {
    this.nightness = nightness;
    if (this.material) {
      this.material.uniforms.uNightness.value = nightness;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.points) {
      this.points.visible = enabled;
    }
  }

  update(deltaTime: number, cameraPosition: THREE.Vector3, frustum: number): void {
    if (!this.enabled || !this.material || this.flocks.length === 0) return;

    // Update frustum uniform
    this.material.uniforms.uFrustum.value = frustum;

    // Update each flock center on CPU
    for (let i = 0; i < this.flocks.length; i++) {
      const flock = this.flocks[i];

      if (flock.pattern === 'linear') {
        // Move center along direction
        flock.center.x += flock.direction.x * flock.speed * deltaTime;
        flock.center.z += flock.direction.y * flock.speed * deltaTime;

        // Wrap when too far from camera
        const dx = flock.center.x - cameraPosition.x;
        const dz = flock.center.z - cameraPosition.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > WRAP_DISTANCE) {
          // Respawn on opposite side of camera from current direction
          const angle = Math.atan2(-flock.direction.y, -flock.direction.x);
          const spawnDist = 15 + Math.random() * 5;
          flock.center.x = cameraPosition.x + Math.cos(angle) * spawnDist + (Math.random() - 0.5) * 6;
          flock.center.z = cameraPosition.z + Math.sin(angle) * spawnDist + (Math.random() - 0.5) * 6;
          flock.center.y = flock.height;
          // Slightly vary direction on respawn
          const newAngle = angle + Math.PI + (Math.random() - 0.5) * 0.4;
          flock.direction.set(Math.cos(newAngle), Math.sin(newAngle));
        }
      } else {
        // Circling pattern — orbit around circleCenter
        flock.circleAngle! += CIRCLE_ANGULAR_SPEED * deltaTime;
        const angle = flock.circleAngle!;
        const radius = flock.circleRadius!;
        flock.center.x = flock.circleCenter!.x + Math.cos(angle) * radius;
        flock.center.z = flock.circleCenter!.y + Math.sin(angle) * radius;

        // If circle center drifts too far from camera, recenter
        const cdx = flock.circleCenter!.x - cameraPosition.x;
        const cdz = flock.circleCenter!.y - cameraPosition.z;
        const cdist = Math.sqrt(cdx * cdx + cdz * cdz);
        if (cdist > WRAP_DISTANCE) {
          flock.circleCenter!.set(
            cameraPosition.x + (Math.random() - 0.5) * 10,
            cameraPosition.z + (Math.random() - 0.5) * 10,
          );
        }
      }

      // Push updated center to uniform array
      this.material.uniforms.uFlockCenters.value[i].copy(flock.center);
    }
  }

  dispose(): void {
    if (this.points) {
      this.points.removeFromParent();
    }
    if (this.material) {
      shaderTimeManager.unregister(
        this.material as THREE.ShaderMaterial & { uniforms: { uTime: { value: number } } },
      );
      this.material.dispose();
    }
    if (this.geometry) {
      this.geometry.dispose();
    }
    this.points = null;
    this.material = null;
    this.geometry = null;
    this.flocks = [];
  }

  // ── Private Methods ──

  private initFlocks(): void {
    this.flocks = [];
    let totalBirds = 0;

    for (let i = 0; i < FLOCK_COUNT; i++) {
      // Determine bird count for this flock, respecting max total
      const remaining = this.maxBirds - totalBirds;
      if (remaining <= 0) break;
      const birdCount = Math.min(
        MIN_BIRDS_PER_FLOCK + Math.floor(Math.random() * (MAX_BIRDS_PER_FLOCK - MIN_BIRDS_PER_FLOCK + 1)),
        remaining,
      );

      const height = MIN_HEIGHT + Math.random() * (MAX_HEIGHT - MIN_HEIGHT);
      const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
      const isCircling = Math.random() < 0.5;
      const angle = Math.random() * Math.PI * 2;

      const flock: FlockData = {
        center: new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          height,
          (Math.random() - 0.5) * 20,
        ),
        direction: new THREE.Vector2(Math.cos(angle), Math.sin(angle)),
        speed,
        birdCount,
        height,
        pattern: isCircling ? 'circling' : 'linear',
      };

      if (isCircling) {
        flock.circleCenter = new THREE.Vector2(flock.center.x, flock.center.z);
        flock.circleRadius = CIRCLE_RADIUS_MIN + Math.random() * (CIRCLE_RADIUS_MAX - CIRCLE_RADIUS_MIN);
        flock.circleAngle = Math.random() * Math.PI * 2;
      }

      this.flocks.push(flock);
      totalBirds += birdCount;
    }

    this.totalBirds = totalBirds;
  }

  private createGeometry(): void {
    if (this.totalBirds === 0) return;

    const aFlockId = new Float32Array(this.totalBirds);
    const aPhase = new Float32Array(this.totalBirds);
    const aOffset = new Float32Array(this.totalBirds * 2);
    const positions = new Float32Array(this.totalBirds * 3); // dummy, required by Three.js

    let birdIndex = 0;
    for (let fi = 0; fi < this.flocks.length; fi++) {
      const flock = this.flocks[fi];
      for (let bi = 0; bi < flock.birdCount; bi++) {
        aFlockId[birdIndex] = fi;
        aPhase[birdIndex] = Math.random() * Math.PI * 2;
        aOffset[birdIndex * 2] = (Math.random() - 0.5) * FLOCK_SPREAD * 2;
        aOffset[birdIndex * 2 + 1] = (Math.random() - 0.5) * FLOCK_SPREAD * 2;
        birdIndex++;
      }
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aFlockId', new THREE.BufferAttribute(aFlockId, 1));
    this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
    this.geometry.setAttribute('aOffset', new THREE.BufferAttribute(aOffset, 2));

    // Initialize uniform array for flock centers (always 6 slots, unused ones stay at origin)
    const flockCentersArray: THREE.Vector3[] = [];
    for (let i = 0; i < 6; i++) {
      flockCentersArray.push(
        i < this.flocks.length ? this.flocks[i].center.clone() : new THREE.Vector3(),
      );
    }

    this.material = new THREE.ShaderMaterial({
      vertexShader: BIRD_VERTEX,
      fragmentShader: BIRD_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uFrustum: { value: 10 },
        uNightness: { value: this.nightness },
        uFlockCenters: { value: flockCentersArray },
      },
    });

    // Register uTime with ShaderTimeManager for automatic updates
    shaderTimeManager.register(
      this.material as THREE.ShaderMaterial & { uniforms: { uTime: { value: number } } },
    );

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }
}
