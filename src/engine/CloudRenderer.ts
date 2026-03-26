import * as THREE from 'three';

/** Per-cloud state */
interface CloudData {
  x: number;
  y: number;
  z: number;
  speed: number;
  scale: number;
  opacity: number;
  /** Random rotation for visual variety (radians) */
  rotation: number;
}

/** Texture resolution */
const TEX_SIZE = 128;

/**
 * Renders billboard clouds drifting across the sky with ground shadows.
 * Uses two InstancedMesh draw calls (clouds + shadows) for minimal overhead.
 * Clouds wrap camera-relative so they always fill the view.
 */
export class CloudRenderer {
  private cloudMesh: THREE.InstancedMesh | null = null;
  private shadowMesh: THREE.InstancedMesh | null = null;
  private cloudMaterial: THREE.MeshBasicMaterial | null = null;
  private shadowMaterial: THREE.MeshBasicMaterial | null = null;
  private clouds: CloudData[] = [];
  private nightness = 0;
  private enabled = true;
  private windDirection = new THREE.Vector2(1, 0.3).normalize();
  private shadowTexture: THREE.CanvasTexture | null = null;
  /** Reusable matrix for setMatrixAt — zero allocations per frame */
  private readonly _matrix = new THREE.Matrix4();
  private readonly _position = new THREE.Vector3();
  private readonly _scale = new THREE.Vector3();
  private readonly _quaternion = new THREE.Quaternion();
  /** Scratch quaternion for per-cloud rotation variety */
  private readonly _rotQuat = new THREE.Quaternion();

  /** Pre-computed billboard rotation: tilted ~60° to face the isometric camera */
  private readonly _billboardQuat: THREE.Quaternion;

  /** View range for camera-relative wrapping */
  private readonly viewRange = 40;

  /** Sun offset direction for shadow projection (normalized XZ) */
  private readonly sunOffsetX = 3;
  private readonly sunOffsetZ = 2;

  private maxClouds: number;

  constructor(maxClouds = 30) {
    this.maxClouds = maxClouds;
    // Pre-compute a quaternion that tilts the plane ~60° from horizontal
    // to face an isometric camera looking down at roughly 30° elevation
    const euler = new THREE.Euler(-Math.PI / 3, 0, 0);
    this._billboardQuat = new THREE.Quaternion().setFromEuler(euler);
  }

  addToScene(scene: THREE.Scene): void {
    // Detect mobile — reduce cloud count
    const isMobile = window.innerWidth <= 768;
    const count = isMobile ? Math.min(this.maxClouds, 15) : this.maxClouds;

    // Shadow texture: dark soft blob
    this.shadowTexture = this.createShadowTexture();

    // Cloud geometry: a plane that will be billboard-rotated
    const cloudGeom = new THREE.PlaneGeometry(1, 1);

    // Cloud material — uses first texture; all variants share same material
    // since InstancedMesh requires a single material. We use a single merged texture.
    const mergedTexture = this.createMergedCloudTexture();
    this.cloudMaterial = new THREE.MeshBasicMaterial({
      map: mergedTexture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });

    this.cloudMesh = new THREE.InstancedMesh(cloudGeom, this.cloudMaterial, count);
    this.cloudMesh.frustumCulled = false;
    this.cloudMesh.name = 'clouds';
    this.cloudMesh.renderOrder = 900; // Render after most objects but before UI

    // Shadow geometry: flat plane on the ground
    const shadowGeom = new THREE.PlaneGeometry(1, 1);
    shadowGeom.rotateX(-Math.PI / 2); // Lay flat on XZ plane

    this.shadowMaterial = new THREE.MeshBasicMaterial({
      map: this.shadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.15,
      fog: false,
    });

    this.shadowMesh = new THREE.InstancedMesh(shadowGeom, this.shadowMaterial, count);
    this.shadowMesh.frustumCulled = false;
    this.shadowMesh.name = 'cloud_shadows';
    this.shadowMesh.renderOrder = 1; // Render early, on ground

    // Initialize cloud data
    this.clouds = [];
    for (let i = 0; i < count; i++) {
      this.clouds.push({
        x: (Math.random() - 0.5) * this.viewRange * 2,
        y: 12 + Math.random() * 6, // Y 12-18
        z: (Math.random() - 0.5) * this.viewRange * 2,
        speed: 0.3 + Math.random() * 0.5, // 0.3-0.8 units/sec
        scale: 3 + Math.random() * 4, // Scale 3-7
        opacity: 0.3 + Math.random() * 0.4, // Opacity 0.3-0.7
        rotation: Math.random() * Math.PI * 2, // Random rotation for visual variety
      });
    }

    // Set initial instance colors for opacity (using alpha via color trick won't work;
    // instead we bake opacity per-instance via setColorAt)
    // Since InstancedMesh doesn't support per-instance opacity natively,
    // we encode opacity in instance color brightness (white * opacity)
    for (let i = 0; i < count; i++) {
      const c = this.clouds[i];
      this.cloudMesh.setColorAt(i, new THREE.Color(c.opacity, c.opacity, c.opacity));
    }
    if (this.cloudMesh.instanceColor) {
      this.cloudMesh.instanceColor.needsUpdate = true;
    }

    scene.add(this.cloudMesh);
    scene.add(this.shadowMesh);

    // Initial matrix setup
    this.updateMatrices();
  }

  setNightness(nightness: number): void {
    this.nightness = nightness;
  }

  setWindDirection(dir: THREE.Vector2): void {
    this.windDirection.copy(dir).normalize();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.cloudMesh) this.cloudMesh.visible = enabled;
    if (this.shadowMesh) this.shadowMesh.visible = enabled;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(deltaTime: number, cameraPosition: THREE.Vector3, _frustum: number): void {
    if (!this.enabled || !this.cloudMesh || !this.shadowMesh) return;

    const windX = this.windDirection.x;
    const windZ = this.windDirection.y;
    const camX = cameraPosition.x;
    const camZ = cameraPosition.z;
    const range = this.viewRange;

    // Move each cloud along wind direction
    for (const cloud of this.clouds) {
      cloud.x += windX * cloud.speed * deltaTime;
      cloud.z += windZ * cloud.speed * deltaTime;

      // Camera-relative wrapping: when cloud exits view bounds, wrap to opposite side
      const dx = cloud.x - camX;
      const dz = cloud.z - camZ;

      if (dx > range) cloud.x -= range * 2;
      else if (dx < -range) cloud.x += range * 2;

      if (dz > range) cloud.z -= range * 2;
      else if (dz < -range) cloud.z += range * 2;
    }

    // Update night tint — white by day, grey-blue by night
    if (this.cloudMaterial) {
      const r = 1.0 - this.nightness * 0.5;
      const g = 1.0 - this.nightness * 0.45;
      const b = 1.0 - this.nightness * 0.2;
      this.cloudMaterial.color.setRGB(r, g, b);
    }

    // Update shadow opacity: fade out at night
    if (this.shadowMaterial) {
      this.shadowMaterial.opacity = 0.15 * (1 - this.nightness);
    }

    this.updateMatrices();
  }

  dispose(): void {
    if (this.cloudMesh) {
      this.cloudMesh.geometry.dispose();
      this.cloudMesh.removeFromParent();
      this.cloudMesh = null;
    }
    if (this.shadowMesh) {
      this.shadowMesh.geometry.dispose();
      this.shadowMesh.removeFromParent();
      this.shadowMesh = null;
    }
    if (this.cloudMaterial) {
      this.cloudMaterial.map?.dispose();
      this.cloudMaterial.dispose();
      this.cloudMaterial = null;
    }
    if (this.shadowMaterial) {
      this.shadowMaterial.map?.dispose();
      this.shadowMaterial.dispose();
      this.shadowMaterial = null;
    }
    if (this.shadowTexture) {
      this.shadowTexture.dispose();
      this.shadowTexture = null;
    }
    this.clouds = [];
  }

  // ── Private Methods ──

  /** Update instance matrices for cloud and shadow meshes */
  private updateMatrices(): void {
    if (!this.cloudMesh || !this.shadowMesh) return;

    const matrix = this._matrix;
    const pos = this._position;
    const scale = this._scale;
    const quat = this._billboardQuat;

    for (let i = 0; i < this.clouds.length; i++) {
      const cloud = this.clouds[i];

      // Cloud billboard with per-cloud rotation for visual variety
      scale.set(cloud.scale, cloud.scale * 0.6, 1); // Wider than tall
      pos.set(cloud.x, cloud.y, cloud.z);
      this._rotQuat.copy(quat);
      this._quaternion.setFromAxisAngle(pos.set(0, 0, 1), cloud.rotation);
      this._rotQuat.multiply(this._quaternion);
      pos.set(cloud.x, cloud.y, cloud.z);
      matrix.compose(pos, this._rotQuat, scale);
      this.cloudMesh.setMatrixAt(i, matrix);

      // Ground shadow — flat on XZ, offset by sun angle
      const shadowScale = cloud.scale * 1.2; // Shadows slightly larger
      scale.set(shadowScale, 1, shadowScale * 0.8);
      pos.set(
        cloud.x + this.sunOffsetX,
        0.02, // Just above ground to prevent z-fighting
        cloud.z + this.sunOffsetZ,
      );
      matrix.compose(pos, this._quaternion.identity(), scale);
      this.shadowMesh.setMatrixAt(i, matrix);
    }

    this.cloudMesh.count = this.clouds.length;
    this.cloudMesh.instanceMatrix.needsUpdate = true;
    this.shadowMesh.count = this.clouds.length;
    this.shadowMesh.instanceMatrix.needsUpdate = true;
  }

  /** Create a merged cloud texture with all variants in a single atlas-like texture */
  private createMergedCloudTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d')!;

    // Draw a fluffy cloud using overlapping radial gradients
    ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);

    const cx = TEX_SIZE / 2;
    const cy = TEX_SIZE / 2;

    // Multiple overlapping soft circles for a fluffy look
    const blobs = [
      { x: cx - 15, y: cy, r: 35 },
      { x: cx + 15, y: cy - 5, r: 30 },
      { x: cx, y: cy + 5, r: 38 },
      { x: cx - 25, y: cy + 8, r: 25 },
      { x: cx + 25, y: cy + 3, r: 28 },
    ];

    for (const blob of blobs) {
      const gradient = ctx.createRadialGradient(
        blob.x, blob.y, 0,
        blob.x, blob.y, blob.r,
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)');
      gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /** Create a dark soft shadow texture */
  private createShadowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);

    const cx = TEX_SIZE / 2;
    const cy = TEX_SIZE / 2;

    // Soft dark radial gradient matching cloud shape
    const blobs = [
      { x: cx - 10, y: cy, r: 35 },
      { x: cx + 10, y: cy, r: 30 },
      { x: cx, y: cy, r: 40 },
    ];

    for (const blob of blobs) {
      const gradient = ctx.createRadialGradient(
        blob.x, blob.y, 0,
        blob.x, blob.y, blob.r,
      );
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
      gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }
}
