import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import { generateMap } from '../game/MapGenerator';
import { BuildingType } from '../game/BuildingType';
import { initializeCastleResources } from '../game/Building';
import { GameState } from '../game/GameState';
import { UnitManager } from '../game/UnitManager';
import { ProductionManager } from '../game/ProductionManager';
import { ConstructionManager } from '../game/ConstructionManager';
import { RoadNetwork } from '../game/RoadNetwork';
import { TransporterManager } from '../game/TransporterManager';
import { LogisticsManager } from '../game/LogisticsManager';
import { RoadRenderer } from './RoadRenderer';
import { MapRenderer } from './MapRenderer';
import { BuildingRenderer } from './BuildingRenderer';
import { UnitRenderer } from './UnitRenderer';
import { PlacementController } from './PlacementController';
import { CameraController } from './CameraController';
import { assetLoader } from './AssetLoader';
import { updateWaterTime } from './WaterShader';

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private container: HTMLElement;
  private animationId: number | null = null;
  private mapRenderer: MapRenderer;
  private buildingRenderer: BuildingRenderer;
  private unitRenderer: UnitRenderer;
  private unitManager: UnitManager;
  private productionManager: ProductionManager;
  private constructionManager: ConstructionManager;
  private roadNetwork: RoadNetwork;
  private transporterManager: TransporterManager;
  private logisticsManager: LogisticsManager;
  private roadRenderer: RoadRenderer;
  private cameraController: CameraController | null = null;
  private placementController: PlacementController | null = null;
  private grid: HexGrid;
  private gameState: GameState;
  private frustum = 10;
  private directionalLight: THREE.DirectionalLight;

  constructor(container: HTMLElement) {
    this.container = container;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    // Scene with fog for atmospheric depth
    this.scene = new THREE.Scene();
    const fogColor = 0xc8dce8;
    this.scene.fog = new THREE.FogExp2(fogColor, 0.012);
    this.renderer.setClearColor(fogColor);

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

    // Lighting — hemisphere for natural sky/ground color + directional for sun
    const hemiLight = new THREE.HemisphereLight(
      0x87ceeb, // sky color (light blue)
      0x4a7c3f, // ground color (earthy green)
      0.7
    );
    this.scene.add(hemiLight);

    this.directionalLight = new THREE.DirectionalLight(0xfff4e0, 0.9); // warm sunlight
    this.directionalLight.position.set(10, 20, 10);
    this.scene.add(this.directionalLight);

    // Grid, game state, and renderers (map built after assets load)
    this.grid = generateMap({ width: 32, height: 32, seed: 42 });
    this.gameState = new GameState(this.grid);
    this.mapRenderer = new MapRenderer();
    this.buildingRenderer = new BuildingRenderer();
    this.unitRenderer = new UnitRenderer();
    this.unitManager = new UnitManager(this.gameState);
    this.productionManager = new ProductionManager(this.gameState);
    this.constructionManager = new ConstructionManager(this.gameState);
    this.roadNetwork = new RoadNetwork(this.grid);
    this.transporterManager = new TransporterManager(this.gameState, this.roadNetwork);
    this.logisticsManager = new LogisticsManager(this.gameState, this.roadNetwork);
    this.roadRenderer = new RoadRenderer();

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

  async start(): Promise<void> {
    // Load all GLTF assets before building the map
    await Promise.all([
      assetLoader.loadTerrainModels(),
      assetLoader.loadBuildingModels(),
      assetLoader.loadUnitModels(),
      assetLoader.loadResourceModels(),
    ]);

    // Build terrain
    this.mapRenderer.render(this.grid, this.scene);

    // Set up building renderer with world wrapping
    this.buildingRenderer.addToScene(this.scene, this.grid);

    // Set up unit renderer with world wrapping
    this.unitRenderer.addToScene(this.scene, this.grid);

    // Set up road renderer with world wrapping
    this.roadRenderer.addToScene(this.scene, this.grid);

    // Place starting Castle at map center on a grassland tile
    this.placeStartingCastle();

    // Position camera to look at map center
    const center = this.mapRenderer.getMapCenter(this.grid);
    const camOffset = new THREE.Vector3(20, 20, 20);
    this.camera.position.copy(center).add(camOffset);
    this.camera.lookAt(center);

    // Camera controls
    this.cameraController = new CameraController(this);

    // Placement controller
    this.placementController = new PlacementController(this);

    const clock = new THREE.Clock();
    const animate = (): void => {
      this.animationId = requestAnimationFrame(animate);
      const deltaTime = Math.min(clock.getDelta(), 0.1); // Cap at 100ms to prevent teleporting
      this.cameraController?.update();
      updateWaterTime(clock.getElapsedTime());
      this.unitManager.update(deltaTime);
      this.constructionManager.update(deltaTime);
      this.productionManager.update(deltaTime);
      this.logisticsManager.update(deltaTime);
      this.transporterManager.update(deltaTime);
      this.roadRenderer.sync(this.roadNetwork);
      const allUnits = this.gameState.getAllUnits();
      this.unitRenderer.syncUnits(allUnits);
      this.unitRenderer.updatePositions(allUnits, deltaTime);
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  /** Find a grassland tile near map center and place the Castle */
  private placeStartingCastle(): void {
    const centerQ = Math.floor(this.grid.width / 2);
    const centerR = Math.floor(this.grid.height / 2);

    // Spiral outward from center to find first grassland tile
    const maxRadius = 5;
    for (let radius = 0; radius <= maxRadius; radius++) {
      for (let dq = -radius; dq <= radius; dq++) {
        for (let dr = -radius; dr <= radius; dr++) {
          if (Math.abs(dq) + Math.abs(dr) + Math.abs(-dq - dr) > 2 * radius) continue;
          const q = centerQ + dq;
          const r = centerR + dr;
          const result = this.gameState.placeBuilding(
            BuildingType.Castle,
            { q, r },
            1,
          );
          if (result.ok) {
            initializeCastleResources(result.building);
            this.buildingRenderer.addBuilding(result.building, this.grid);
            return;
          }
        }
      }
    }
  }

  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', this.onResize);
    this.placementController?.dispose();
    this.cameraController?.dispose();
    this.roadRenderer.dispose();
    this.unitRenderer.dispose();
    this.buildingRenderer.dispose();
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

  getBuildingRenderer(): BuildingRenderer {
    return this.buildingRenderer;
  }

  getUnitRenderer(): UnitRenderer {
    return this.unitRenderer;
  }

  getUnitManager(): UnitManager {
    return this.unitManager;
  }

  getGameState(): GameState {
    return this.gameState;
  }

  getRoadNetwork(): RoadNetwork {
    return this.roadNetwork;
  }

  getRoadRenderer(): RoadRenderer {
    return this.roadRenderer;
  }

  getPlacementController(): PlacementController | null {
    return this.placementController;
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
