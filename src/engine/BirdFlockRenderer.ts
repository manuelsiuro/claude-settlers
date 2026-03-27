import * as THREE from 'three';
import { assetLoader } from './AssetLoader';
import {
  BIRD_MODEL_SCALE, BIRD_FLOCK_COUNT, BIRD_MIN_PER_FLOCK, BIRD_MAX_PER_FLOCK,
  BIRD_FLOCK_SPREAD, BIRD_MIN_HEIGHT, BIRD_MAX_HEIGHT, BIRD_MIN_SPEED,
  BIRD_MAX_SPEED, BIRD_WING_FLAP_FREQ, BIRD_WING_FLAP_AMPLITUDE,
  BIRD_WRAP_DISTANCE, BIRD_NIGHTNESS_FADE_START, BIRD_NIGHTNESS_FADE_END,
} from '../game/data/balanceConstants';

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

interface SubMeshInfo {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  localMatrix: THREE.Matrix4;
  name: string;
}

// ── Constants ──

const CIRCLE_RADIUS_MIN = 4;
const CIRCLE_RADIUS_MAX = 8;
const CIRCLE_ANGULAR_SPEED = 0.3;

/** Smooth interpolation matching GLSL smoothstep */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Renders bird flocks in the sky using 3D .glb models via InstancedMesh.
 * Wings flap via per-instance rotation each frame.
 * Preserves flock behavior: linear flight, circling, and camera-relative wrapping.
 */
export class BirdFlockRenderer {
  private meshes: THREE.InstancedMesh[] = [];
  private subMeshInfos: SubMeshInfo[] = [];
  private wingLeftIndices: number[] = [];
  private wingRightIndices: number[] = [];
  private flocks: FlockData[] = [];
  private birdPhases: Float32Array = new Float32Array(0);
  private birdOffsets: Float32Array = new Float32Array(0);
  private birdFlockIds: Float32Array = new Float32Array(0);
  private totalBirds = 0;
  private maxBirds: number;
  private elapsedTime = 0;
  private enabled = true;
  private scene: THREE.Scene | null = null;

  // Scratch objects — zero per-frame allocation
  private readonly _matrix = new THREE.Matrix4();
  private readonly _localMatrix = new THREE.Matrix4();
  private readonly _wingRot = new THREE.Matrix4();
  private readonly _position = new THREE.Vector3();
  private readonly _quaternion = new THREE.Quaternion();
  private readonly _euler = new THREE.Euler();
  private readonly _scale = new THREE.Vector3();

  constructor(maxBirds = 40) {
    this.maxBirds = maxBirds;
  }

  addToScene(scene: THREE.Scene): void {
    this.scene = scene;
    const isMobile = window.innerWidth <= 768;
    if (isMobile) this.maxBirds = Math.min(this.maxBirds, 15);

    this.initFlocks();
    this.buildMeshes();
  }

  setNightness(nightness: number): void {
    const alpha = smoothstep(BIRD_NIGHTNESS_FADE_END, BIRD_NIGHTNESS_FADE_START, nightness);
    for (const mesh of this.meshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = alpha;
      mat.transparent = alpha < 1;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    for (const mesh of this.meshes) {
      mesh.visible = enabled;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(deltaTime: number, cameraPosition: THREE.Vector3, _frustum: number): void {
    if (!this.enabled || this.flocks.length === 0 || this.meshes.length === 0) return;

    this.elapsedTime += deltaTime;

    // Update flock centers on CPU
    for (const flock of this.flocks) {
      if (flock.pattern === 'linear') {
        flock.center.x += flock.direction.x * flock.speed * deltaTime;
        flock.center.z += flock.direction.y * flock.speed * deltaTime;

        const dx = flock.center.x - cameraPosition.x;
        const dz = flock.center.z - cameraPosition.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > BIRD_WRAP_DISTANCE) {
          const angle = Math.atan2(-flock.direction.y, -flock.direction.x);
          const spawnDist = 15 + Math.random() * 5;
          flock.center.x = cameraPosition.x + Math.cos(angle) * spawnDist + (Math.random() - 0.5) * 6;
          flock.center.z = cameraPosition.z + Math.sin(angle) * spawnDist + (Math.random() - 0.5) * 6;
          flock.center.y = flock.height;
          const newAngle = angle + Math.PI + (Math.random() - 0.5) * 0.4;
          flock.direction.set(Math.cos(newAngle), Math.sin(newAngle));
        }
      } else {
        flock.circleAngle! += CIRCLE_ANGULAR_SPEED * deltaTime;
        const angle = flock.circleAngle!;
        const radius = flock.circleRadius!;
        flock.center.x = flock.circleCenter!.x + Math.cos(angle) * radius;
        flock.center.z = flock.circleCenter!.y + Math.sin(angle) * radius;

        const cdx = flock.circleCenter!.x - cameraPosition.x;
        const cdz = flock.circleCenter!.y - cameraPosition.z;
        const cdist = Math.sqrt(cdx * cdx + cdz * cdz);
        if (cdist > BIRD_WRAP_DISTANCE) {
          flock.circleCenter!.set(
            cameraPosition.x + (Math.random() - 0.5) * 10,
            cameraPosition.z + (Math.random() - 0.5) * 10,
          );
        }
      }
    }

    // Update instance matrices for each bird
    const time = this.elapsedTime;
    let instanceIdx = 0;

    for (let bi = 0; bi < this.totalBirds; bi++) {
      const flockId = this.birdFlockIds[bi];
      const flock = this.flocks[flockId];
      if (!flock) continue;

      const phase = this.birdPhases[bi];
      const offX = this.birdOffsets[bi * 2];
      const offZ = this.birdOffsets[bi * 2 + 1];

      // Position: flock center + offset + sine drift (identical to old vertex shader)
      const px = flock.center.x + offX + Math.sin(time * 0.5 + phase) * 0.3;
      const py = flock.center.y + Math.sin(time * 0.3 + phase * 2.0) * 0.2;
      const pz = flock.center.z + offZ + Math.cos(time * 0.4 + phase) * 0.3;

      // Face flight direction (model faces -Z after Blender Y-up → GLTF conversion)
      const yaw = Math.atan2(flock.direction.x, flock.direction.y) + Math.PI;
      this._position.set(px, py, pz);
      this._euler.set(0, yaw, 0);
      this._quaternion.setFromEuler(this._euler);
      this._scale.set(BIRD_MODEL_SCALE, BIRD_MODEL_SCALE, BIRD_MODEL_SCALE);
      this._matrix.compose(this._position, this._quaternion, this._scale);

      // Wing flap angle
      const flapAngle = Math.sin(time * BIRD_WING_FLAP_FREQ + phase) * BIRD_WING_FLAP_AMPLITUDE;

      for (let mi = 0; mi < this.meshes.length; mi++) {
        const isWingLeft = this.wingLeftIndices.includes(mi);
        const isWingRight = this.wingRightIndices.includes(mi);

        if (isWingLeft || isWingRight) {
          // Wing: localMatrix × flapRotation around local Z axis
          const angle = isWingLeft ? flapAngle : -flapAngle;
          this._wingRot.makeRotationZ(angle);
          this._localMatrix.multiplyMatrices(this.subMeshInfos[mi].localMatrix, this._wingRot);
          this._localMatrix.premultiply(this._matrix);
          this.meshes[mi].setMatrixAt(instanceIdx, this._localMatrix);
        } else {
          // Body: worldMatrix × localMatrix
          this._localMatrix.multiplyMatrices(this._matrix, this.subMeshInfos[mi].localMatrix);
          this.meshes[mi].setMatrixAt(instanceIdx, this._localMatrix);
        }
      }
      instanceIdx++;
    }

    for (const mesh of this.meshes) {
      mesh.count = instanceIdx;
      if (instanceIdx > 0) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    this.meshes = [];
    this.subMeshInfos = [];
    this.wingLeftIndices = [];
    this.wingRightIndices = [];
    this.flocks = [];
    this.scene = null;
  }

  // ── Private Methods ──

  private initFlocks(): void {
    this.flocks = [];
    let totalBirds = 0;

    for (let i = 0; i < BIRD_FLOCK_COUNT; i++) {
      const remaining = this.maxBirds - totalBirds;
      if (remaining <= 0) break;
      const birdCount = Math.min(
        BIRD_MIN_PER_FLOCK + Math.floor(Math.random() * (BIRD_MAX_PER_FLOCK - BIRD_MIN_PER_FLOCK + 1)),
        remaining,
      );

      const height = BIRD_MIN_HEIGHT + Math.random() * (BIRD_MAX_HEIGHT - BIRD_MIN_HEIGHT);
      const speed = BIRD_MIN_SPEED + Math.random() * (BIRD_MAX_SPEED - BIRD_MIN_SPEED);
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

    // Initialize per-bird attributes
    this.birdPhases = new Float32Array(totalBirds);
    this.birdOffsets = new Float32Array(totalBirds * 2);
    this.birdFlockIds = new Float32Array(totalBirds);

    let birdIndex = 0;
    for (let fi = 0; fi < this.flocks.length; fi++) {
      const flock = this.flocks[fi];
      for (let bi = 0; bi < flock.birdCount; bi++) {
        this.birdFlockIds[birdIndex] = fi;
        this.birdPhases[birdIndex] = Math.random() * Math.PI * 2;
        this.birdOffsets[birdIndex * 2] = (Math.random() - 0.5) * BIRD_FLOCK_SPREAD * 2;
        this.birdOffsets[birdIndex * 2 + 1] = (Math.random() - 0.5) * BIRD_FLOCK_SPREAD * 2;
        birdIndex++;
      }
    }
  }

  private buildMeshes(): void {
    if (!this.scene || this.totalBirds === 0) return;

    this.subMeshInfos = this.getSubMeshes();
    if (this.subMeshInfos.length === 0) {
      this.createFallbackMesh();
      return;
    }

    // Identify wing sub-meshes by name
    for (let i = 0; i < this.subMeshInfos.length; i++) {
      const name = this.subMeshInfos[i].name.toLowerCase();
      if (name.includes('wing_left') || name.includes('wing_l')) {
        this.wingLeftIndices.push(i);
      } else if (name.includes('wing_right') || name.includes('wing_r')) {
        this.wingRightIndices.push(i);
      }
    }

    for (const sub of this.subMeshInfos) {
      const mat = (sub.material as THREE.MeshStandardMaterial).clone();
      mat.transparent = true;
      const instMesh = new THREE.InstancedMesh(sub.geometry, mat, this.totalBirds);
      instMesh.frustumCulled = false;
      instMesh.count = 0;
      const identity = new THREE.Matrix4();
      for (let i = 0; i < this.totalBirds; i++) {
        instMesh.setMatrixAt(i, identity);
      }
      instMesh.instanceMatrix.needsUpdate = true;
      this.scene.add(instMesh);
      this.meshes.push(instMesh);
    }
  }

  private getSubMeshes(): SubMeshInfo[] {
    const model = assetLoader.getRawModel('bird');
    if (!model) return [];
    model.updateWorldMatrix(true, true);
    const results: SubMeshInfo[] = [];
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        results.push({
          geometry: child.geometry,
          material: child.material as THREE.Material,
          localMatrix: child.matrixWorld.clone(),
          name: child.name,
        });
      }
    });
    return results;
  }

  private createFallbackMesh(): void {
    if (!this.scene) return;
    const geo = new THREE.BoxGeometry(0.3, 0.1, 0.15);
    const mat = new THREE.MeshLambertMaterial({ color: 0x3a3530, transparent: true });
    const mesh = new THREE.InstancedMesh(geo, mat, this.totalBirds);
    mesh.frustumCulled = false;
    mesh.count = 0;
    const identity = new THREE.Matrix4();
    for (let i = 0; i < this.totalBirds; i++) {
      mesh.setMatrixAt(i, identity);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);
    this.subMeshInfos.push({
      geometry: geo,
      material: mat,
      localMatrix: new THREE.Matrix4(),
      name: 'fallback_body',
    });
  }
}
