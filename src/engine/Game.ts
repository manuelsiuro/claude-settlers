import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import { generateMap } from '../game/MapGenerator';
import { MapRenderer } from './MapRenderer';
import { CameraController } from './CameraController';

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private container: HTMLElement;
  private animationId: number | null = null;
  private mapRenderer: MapRenderer;
  private cameraController: CameraController | null = null;
  private grid: HexGrid;
  private frustum = 10;

  constructor(container: HTMLElement) {
    this.container = container;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x87ceeb); // sky blue background
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();

    // Isometric orthographic camera
    const aspect = this.width / this.height;
    this.camera = new THREE.OrthographicCamera(
      -this.frustum * aspect,
      this.frustum * aspect,
      this.frustum,
      -this.frustum,
      0.1,
      1000
    );

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);

    // Generate map
    this.grid = generateMap({ width: 32, height: 32, seed: 42 });
    this.mapRenderer = new MapRenderer();
    this.mapRenderer.render(this.grid, this.scene);

    // Position camera to look at map center
    const center = this.mapRenderer.getMapCenter(this.grid);
    const camOffset = new THREE.Vector3(20, 20, 20);
    this.camera.position.copy(center).add(camOffset);
    this.camera.lookAt(center);

    // Camera controls
    this.cameraController = new CameraController(this);

    // Handle resize
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
    this.onResize();
  }

  private get width(): number {
    return this.container.clientWidth || window.innerWidth;
  }

  private get height(): number {
    return this.container.clientHeight || window.innerHeight;
  }

  private onResize(): void {
    const aspect = this.width / this.height;

    this.camera.left = -this.frustum * aspect;
    this.camera.right = this.frustum * aspect;
    this.camera.top = this.frustum;
    this.camera.bottom = -this.frustum;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
  }

  start(): void {
    const animate = (): void => {
      this.animationId = requestAnimationFrame(animate);
      this.cameraController?.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', this.onResize);
    this.cameraController?.dispose();
    this.mapRenderer.dispose();
    this.renderer.dispose();
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  getCamera(): THREE.OrthographicCamera {
    return this.camera;
  }

  getGrid(): HexGrid {
    return this.grid;
  }

  getMapRenderer(): MapRenderer {
    return this.mapRenderer;
  }

  /** Update camera frustum (for zoom) */
  setFrustum(frustum: number): void {
    this.frustum = frustum;
    this.onResize();
  }

  getFrustum(): number {
    return this.frustum;
  }
}
