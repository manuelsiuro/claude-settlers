import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import { generateMap } from '../game/MapGenerator';
import { buildGridFromMapData } from '../game/MapData';
import type { MapData } from '../game/MapData';
import { getMap } from '../editor/MapStorage';
import { applyBalanceOverrides } from '../game/data/balanceConstants';
import { BuildingType } from '../game/BuildingType';
import { BUILDING_DEFINITIONS } from '../game/BuildingType';
import { initializeCastleResources, transferStorageInputs } from '../game/Building';
import { BuildingState } from '../game/Building';
import { GameState } from '../game/GameState';
import { AIPlayer } from '../game/AIPlayer';
import type { GameConfig, GraphicsSettings } from '../game/GameConfig';
import { DEFAULT_CONFIG, SCENARIO_TERRAIN_BALANCE } from '../game/GameConfig';
import { MapRenderer } from './MapRenderer';
import { PlacementController } from './PlacementController';
import { SelectionController } from './SelectionController';
import { RoadPlacementController } from './RoadPlacementController';
import { CameraController } from './CameraController';
import { assetLoader } from './AssetLoader';
import { shaderTimeManager } from './ShaderTimeManager';
import type { SaveData } from '../game/SaveLoad';
import { serializeGame, deserializeGame } from '../game/SaveLoad';
import { AtmosphereController } from './AtmosphereController';
import type { ColorGradingParams } from './AtmosphereController';
import type { GoodsDistributionSettings } from '../game/GoodsDistribution';

// Manager types (for getter return types)
import type { UnitManager } from '../game/UnitManager';
import type { RoadNetwork } from '../game/RoadNetwork';
import type { TerritoryManager } from '../game/TerritoryManager';
import type { KnightManager } from '../game/KnightManager';
import type { CombatManager } from '../game/CombatManager';
import type { AttackManager } from '../game/AttackManager';
import type { VictoryManager } from '../game/VictoryManager';
import type { GeologistManager } from '../game/GeologistManager';
import type { TreeManager } from '../game/TreeManager';
import type { WoodcutterManager } from '../game/WoodcutterManager';
import type { ForesterManager } from '../game/ForesterManager';
import type { EconomyTracker } from '../game/EconomyTracker';
import type { UpgradeManager } from '../game/UpgradeManager';
import type { ToolProductionManager } from '../game/ToolProductionManager';
import type { FogOfWarManager } from '../game/FogOfWarManager';
import type { PopulationManager } from '../game/PopulationManager';
import type { FeedingManager } from '../game/FeedingManager';
import type { MoraleManager } from '../game/MoraleManager';
import type { MarketplaceManager } from '../game/MarketplaceManager';
import type { DashboardTracker } from '../game/DashboardTracker';

// Renderer types (for getter return types)
import type { BuildingRenderer } from './BuildingRenderer';
import type { UnitRenderer } from './UnitRenderer';
import type { DepositRenderer } from './DepositRenderer';
import type { RoadRenderer } from './RoadRenderer';
import type { ParticleSystem } from './ParticleSystem';
import type { BuildingAnimator } from './BuildingAnimator';
import type { BuildingStatusOverlay } from './BuildingStatusOverlay';
import type { CombatRenderer } from './CombatRenderer';
import type { ProductionChainOverlay } from './ProductionChainOverlay';
import type { FogOfWarRenderer } from './FogOfWarRenderer';
import type { PostProcessing } from './PostProcessing';
import type { WeatherController } from './WeatherController';

import type { GameNotification } from './GameNotifications';
import { wireGameCallbacks } from './GameNotifications';
import { createManagers, createRenderers, applyGraphicsSettings as applyGraphicsSettingsFn } from './GameSystems';
import type { GameManagers, GameRenderers } from './GameSystems';

// Re-export notification types for backward compatibility
export type { GameNotificationType, GameNotification } from './GameNotifications';

export const ShadowQuality = {
  Off: 'off',
  BlobOnly: 'blob_only',
  Low: 'low',
  High: 'high',
} as const;
export type ShadowQuality = (typeof ShadowQuality)[keyof typeof ShadowQuality];

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private container: HTMLElement;
  private animationId: number | null = null;

  // Managers (created by factory)
  private mgrs: GameManagers;

  // Renderers (created by factory)
  private rnds: GameRenderers;

  private aiPlayers: AIPlayer[] = [];
  private cameraController: CameraController | null = null;
  private placementController: PlacementController | null = null;
  private selectionController: SelectionController | null = null;
  private roadPlacementController: RoadPlacementController | null = null;
  private grid: HexGrid;
  private gameState: GameState;
  private frustum = 10;
  private directionalLight: THREE.DirectionalLight;
  private config: GameConfig;
  private customMapData: MapData | null = null;
  private atmosphereController: AtmosphereController;

  /** Cached base color grading params from AtmosphereController (before weather overlay) */
  private baseColorGrading: ColorGradingParams = { warmTint: [1.02, 1.0, 0.96], contrast: 1.08, saturation: 1.1 };
  /** Cached base atmosphere values for weather overlay */
  private baseFogDensity = 0.008;
  private baseSunIntensity = 1.2;
  private baseExposure = 1.0;

  /** Current shadow quality setting (default: BlobOnly — matches original behavior) */
  private _shadowQuality: ShadowQuality = ShadowQuality.BlobOnly;

  /** The human player's ID (always 1 for now) */
  private humanPlayerId = 1;

  /** Game speed multiplier (0.5 = slow, 1 = normal, 2 = fast, 3 = fastest) */
  private _gameSpeed = 1;

  /** Whether the game is paused */
  private _paused = false;

  /** Current nightness level 0.0–1.0 from atmosphere controller */
  private currentNightness = 0;

  /** Whether WebGL context is currently lost (Android backgrounding) */
  private contextLost = false;

  /** Stored WebGL context event handlers for cleanup */
  private handleContextLost: (e: Event) => void = () => {};
  private handleContextRestored: () => void = () => {};

  /** Notification callback — subscribe to receive game event alerts */
  onNotification: ((notification: GameNotification) => void) | null = null;

  /** Callback fired when pause or speed changes */
  onSpeedChange: ((paused: boolean, speed: number) => void) | null = null;

  constructor(container: HTMLElement, config?: Partial<GameConfig>) {
    this.container = container;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // Handle WebGL context loss (Android may kill context when backgrounded)
    this.handleContextLost = (e: Event) => {
      e.preventDefault();
      this.contextLost = true;
      if (this.animationId !== null) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    };
    this.handleContextRestored = () => {
      this.contextLost = false;
      this.setupEnvironment();
      this.renderer.shadowMap.needsUpdate = true;
    };
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    // Scene with fog for atmospheric depth
    this.scene = new THREE.Scene();
    const fogColor = 0xc8dce8;
    this.scene.fog = new THREE.FogExp2(fogColor, 0.010);
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
      0x6a9c5f, // ground color (earthy green)
      1.0
    );
    this.scene.add(hemiLight);

    this.directionalLight = new THREE.DirectionalLight(0xfff4e0, 1.2); // warm sunlight
    this.directionalLight.position.set(10, 20, 10);
    this.scene.add(this.directionalLight);
    this.scene.add(this.directionalLight.target);

    // Atmosphere controller (time-of-day lighting presets)
    this.atmosphereController = new AtmosphereController(
      hemiLight, this.directionalLight,
      this.scene.fog as THREE.FogExp2, this.renderer,
    );
    this.atmosphereController.onPresetChanged = () => this.setupEnvironment();

    // Generate procedural environment map from scene lights for PBR materials
    this.setupEnvironment();

    // Grid, game state (map built after assets load)
    if (this.config.customMapId) {
      const mapData = getMap(this.config.customMapId);
      if (mapData) {
        this.grid = buildGridFromMapData(mapData);
        this.customMapData = mapData;
        // Apply map-specific balance overrides (after global loadBalanceConfig)
        if (mapData.balanceConfig) {
          applyBalanceOverrides(mapData.balanceConfig);
        }
      } else {
        // Fallback to procedural generation if map was deleted
        this.grid = generateMap({
          width: this.config.mapSize,
          height: this.config.mapSize,
          seed: this.config.seed,
        });
      }
    } else {
      const terrainBalance = SCENARIO_TERRAIN_BALANCE[this.config.scenario];
      this.grid = generateMap({
        width: this.config.mapSize,
        height: this.config.mapSize,
        seed: this.config.seed,
        terrainBalance: terrainBalance ?? undefined,
      });
    }
    this.gameState = new GameState(this.grid);

    // Create all managers via factory
    this.mgrs = createManagers({
      gameState: this.gameState,
      grid: this.grid,
      config: this.config,
      humanPlayerId: this.humanPlayerId,
    });

    // Create all renderers via factory
    this.rnds = createRenderers({
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      atmosphereController: this.atmosphereController,
      onColorGradingUpdate: (params) => {
        // Cache base params; weather overlay is applied per-frame in animate loop
        this.baseColorGrading = { ...params, warmTint: [...params.warmTint] };
        this.applyColorGradingWithWeather(params);
      },
      onNightnessUpdate: (nightness) => {
        this.currentNightness = nightness;
      },
    });

    // Wire all manager/notification callbacks
    wireGameCallbacks({
      productionManager: this.mgrs.productionManager,
      toolProductionManager: this.mgrs.toolProductionManager,
      victoryManager: this.mgrs.victoryManager,
      constructionManager: this.mgrs.constructionManager,
      unitManager: this.mgrs.unitManager,
      gameState: this.gameState,
      territoryManager: this.mgrs.territoryManager,
      knightManager: this.mgrs.knightManager,
      combatManager: this.mgrs.combatManager,
      attackManager: this.mgrs.attackManager,
      geologistManager: this.mgrs.geologistManager,
      economyTracker: this.mgrs.economyTracker,
      moraleManager: this.mgrs.moraleManager,
      feedingManager: this.mgrs.feedingManager,
      populationManager: this.mgrs.populationManager,
      buildingAnimator: this.rnds.buildingAnimator,
      combatRenderer: this.rnds.combatRenderer,
      depositRenderer: this.rnds.depositRenderer,
      particleSystem: this.rnds.particleSystem,
      mapRenderer: this.rnds.mapRenderer,
      upgradeManager: this.mgrs.upgradeManager,
      buildingRenderer: this.rnds.buildingRenderer,
      grid: this.grid,
      humanPlayerId: this.humanPlayerId,
      aiPlayers: this.aiPlayers,
      getNotification: () => this.onNotification,
    });

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
    this.rnds.postProcessing.resize(this.width, this.height);
  }

  async start(savedData?: SaveData): Promise<void> {
    // Load all GLTF assets before building the map
    await Promise.all([
      assetLoader.loadTerrainModels(),
      assetLoader.loadBuildingModels(),
      assetLoader.loadUnitModels(),
      assetLoader.loadResourceModels(),
    ]);

    // Build terrain
    this.rnds.mapRenderer.render(this.grid, this.scene);

    // Set up building renderer with world wrapping
    this.rnds.buildingRenderer.addToScene(this.scene, this.grid);

    // Set up unit renderer with world wrapping
    this.rnds.unitRenderer.addToScene(this.scene, this.grid);

    // Set up road renderer with world wrapping
    this.rnds.roadRenderer.addToScene(this.scene, this.grid);

    // Set up territory renderer with world wrapping
    this.rnds.territoryRenderer.addToScene(this.scene, this.grid);

    // Set up deposit renderer with world wrapping
    this.rnds.depositRenderer.addToScene(this.scene, this.grid);

    // Set up tree renderer
    this.rnds.treeRenderer.addToScene(this.scene);

    // Set up particle system
    this.rnds.particleSystem.addToScene(this.scene);

    // Set up combat renderer
    this.rnds.combatRenderer.addToScene(this.scene, this.grid);

    // Set up production chain overlay
    this.rnds.productionChainOverlay.addToScene(this.scene, this.grid);

    // Set up blob shadows
    this.rnds.blobShadowRenderer.addToScene(this.scene, this.grid);

    // Set up flag light system (nighttime lanterns)
    this.rnds.flagLightSystem.addToScene(this.scene);

    // Set up work area renderer (building selection overlay)
    this.rnds.workAreaRenderer.addToScene(this.scene);

    // Set up weather controller
    this.rnds.weatherController.addToScene(this.scene);

    // Set up cloud renderer (billboard clouds + ground shadows)
    this.rnds.cloudRenderer.addToScene(this.scene);

    // Set up bird flock renderer (GPU-driven flocks)
    this.rnds.birdFlockRenderer.addToScene(this.scene);

    // Set up water effect renderer (sun sparkles on water tiles)
    this.rnds.waterEffectRenderer.addToScene(this.scene);
    this.rnds.waterEffectRenderer.initWaterPositions(this.grid);

    // Set up wild animal renderer (ambient terrain creatures)
    this.rnds.wildAnimalRenderer.addToScene(this.scene, this.grid);

    // Set up flower butterfly renderer (GPU-driven butterflies near grassland)
    this.rnds.flowerButterflyRenderer.addToScene(this.scene, this.grid);

    // Set up fog of war renderer + wire into unit/building renderers
    this.rnds.fogOfWarRenderer.addToScene(this.scene, this.grid);
    this.rnds.fogOfWarRenderer.setPlayerId(this.humanPlayerId);
    this.rnds.unitRenderer.setFogOfWar(this.mgrs.fogOfWarManager, this.humanPlayerId);
    this.rnds.buildingRenderer.setFogOfWar(this.mgrs.fogOfWarManager, this.humanPlayerId);

    if (savedData) {
      // Restore saved state
      this.initAIPlayers();
      const restoredDistribution = deserializeGame(
        savedData,
        this.gameState,
        this.mgrs.roadNetwork,
        {
          constructionManager: this.mgrs.constructionManager,
          transporterManager: this.mgrs.transporterManager,
          unitManager: this.mgrs.unitManager,
          combatManager: this.mgrs.combatManager,
          attackManager: this.mgrs.attackManager,
          territoryManager: this.mgrs.territoryManager,
          logisticsManager: this.mgrs.logisticsManager,
          knightManager: this.mgrs.knightManager,
          victoryManager: this.mgrs.victoryManager,
          geologistManager: this.mgrs.geologistManager,
          treeManager: this.mgrs.treeManager,
          woodcutterManager: this.mgrs.woodcutterManager,
          foresterManager: this.mgrs.foresterManager,
          upgradeManager: this.mgrs.upgradeManager,
          fogOfWarManager: this.mgrs.fogOfWarManager,
          harborManager: this.mgrs.harborManager,
          feedingManager: this.mgrs.feedingManager,
          moraleManager: this.mgrs.moraleManager,
          marketplaceManager: this.mgrs.marketplaceManager,
          animalLifecycleManager: this.mgrs.animalLifecycleManager,
          terrainGatheringManager: this.mgrs.terrainGatheringManager,
        },
        this.aiPlayers,
      );

      // Restore goods distribution settings if present
      if (restoredDistribution) {
        this.mgrs.distributionSettings = restoredDistribution;
        this.mgrs.logisticsManager.setDistributionSettings(restoredDistribution);
      }

      // Rebuild renderers from restored state
      for (const building of this.gameState.getAllBuildings()) {
        this.rnds.buildingRenderer.addBuilding(building, this.grid);
      }
      this.rnds.roadRenderer.sync(this.mgrs.roadNetwork, (id) => this.gameState.getUnit(id));
      this.rnds.territoryRenderer.sync(this.mgrs.territoryManager);

      // Transfer any misplaced entities (buildings in wrong player's territory)
      this.mgrs.attackManager.checkTerritoryTransfers();

      // Rebuild deposit markers from revealed deposits
      for (const tile of this.grid.getAllTiles()) {
        if (tile.deposit?.revealed && !tile.deposit.claimed) {
          this.rnds.depositRenderer.addMarker(tile.coord, tile.deposit.resource, this.grid);
        }
      }

      // Restore camera
      this.frustum = savedData.frustum;
      this.onResize();
      this.camera.position.set(
        savedData.cameraPosition.x,
        savedData.cameraPosition.y,
        savedData.cameraPosition.z,
      );
      this.camera.lookAt(
        savedData.cameraTarget.x,
        savedData.cameraTarget.y,
        savedData.cameraTarget.z,
      );
    } else {
      // New game: initialize tree entities from forest tiles
      this.mgrs.treeManager.initializeFromMap(this.grid);

      // New game: place starting Castles and create AI controllers
      this.placeStartingCastles();
      this.restorePrePlacedContent();
      this.initAIPlayers();

      // Position camera at human player's Castle (or map center as fallback)
      const castle1 = this.gameState.findCastle(this.humanPlayerId);
      let lookAt: THREE.Vector3;
      if (castle1) {
        const { x, z } = HexGrid.hexToWorld(castle1.coord.q, castle1.coord.r);
        lookAt = new THREE.Vector3(x, 0, z);
      } else {
        lookAt = this.rnds.mapRenderer.getMapCenter(this.grid);
      }
      const camOffset = new THREE.Vector3(20, 20, 20);
      this.camera.position.copy(lookAt).add(camOffset);
      this.camera.lookAt(lookAt);
    }

    // Wire tree/forestry callbacks
    this.mgrs.treeManager.onTreeChanged = () => this.rnds.treeRenderer.markDirty();
    this.mgrs.woodcutterManager.onTerrainChanged = () => this.rnds.mapRenderer.rebuild();
    this.mgrs.foresterManager.onTerrainChanged = () => this.rnds.mapRenderer.rebuild();

    // Initial tree render
    this.rnds.treeRenderer.markDirty();
    this.rnds.treeRenderer.sync(this.mgrs.treeManager, this.grid);

    // Camera controls (must be created AFTER camera is positioned so
    // CameraController computes the correct initial target)
    this.cameraController = new CameraController(this);

    // Placement controller
    this.placementController = new PlacementController(this);

    // Selection controller (building click-to-select)
    this.selectionController = new SelectionController(this);

    // Road placement controller (flag & road building)
    this.roadPlacementController = new RoadPlacementController(this);

    const clock = new THREE.Clock();
    const animate = (): void => {
      this.animationId = requestAnimationFrame(animate);
      if (this.contextLost) return;
      this.rnds.performanceMonitor.tick();
      const rawDelta = Math.min(clock.getDelta(), 0.1); // Cap at 100ms to prevent teleporting

      // Camera and shader time always update (even when paused)
      this.cameraController?.update();
      const elapsed = clock.getElapsedTime();
      shaderTimeManager.update(elapsed);

      // Restore base atmosphere values before atmosphere update
      // (removes any weather overlay applied on the previous frame)
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = this.baseFogDensity;
      }
      this.directionalLight.intensity = this.baseSunIntensity;
      this.renderer.toneMappingExposure = this.baseExposure;

      // Atmosphere always updates (even paused) for smooth transitions
      this.atmosphereController.update(rawDelta);

      // Snapshot clean base values (atmosphere may have changed them during a transition)
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.baseFogDensity = this.scene.fog.density;
      }
      this.baseSunIntensity = this.directionalLight.intensity;
      this.baseExposure = this.renderer.toneMappingExposure;

      // Pass nightness to weather controller for rain vs snow selection
      this.rnds.weatherController.setNightness(this.atmosphereController.getCycleState().nightness);

      // Scale delta by game speed; zero when paused
      const deltaTime = this._paused ? 0 : rawDelta * this._gameSpeed;

      // Transfer storage building inputs → outputs (Castle/Warehouse accept delivered goods)
      const allBuildings = this.gameState.getAllBuildings();
      for (const b of allBuildings) {
        if (b.type !== BuildingType.Castle && b.type !== BuildingType.Warehouse) continue;
        if (b.state !== BuildingState.Active) continue;
        transferStorageInputs(b);
      }

      const prevTerritoryVersion = this.mgrs.territoryManager.getVersion();
      this.mgrs.territoryManager.update();
      // Check for territory transfers when territory changes (passive expansion)
      if (this.mgrs.territoryManager.getVersion() !== prevTerritoryVersion) {
        this.mgrs.attackManager.checkTerritoryTransfers();
      }
      // Pass nightness to managers for day/night gameplay effects
      this.mgrs.unitManager.nightness = this.currentNightness;
      this.mgrs.productionManager.nightness = this.currentNightness;
      this.updateLightMitigation();
      this.mgrs.unitManager.update(deltaTime);
      this.mgrs.constructionManager.update(deltaTime);
      this.mgrs.upgradeManager.update(deltaTime);
      this.mgrs.productionManager.update(deltaTime);
      this.mgrs.toolProductionManager.update(deltaTime);
      this.mgrs.geologistManager.update(deltaTime);
      this.mgrs.treeManager.update(deltaTime);
      this.mgrs.woodcutterManager.update(deltaTime);
      this.mgrs.terrainGatheringManager.update(deltaTime);
      this.mgrs.foresterManager.update(deltaTime);
      this.rnds.treeRenderer.sync(this.mgrs.treeManager, this.grid);
      this.mgrs.logisticsManager.update(deltaTime);
      this.mgrs.harborManager.update(deltaTime);
      this.mgrs.transporterManager.update(deltaTime);
      this.mgrs.knightManager.update(deltaTime);
      this.mgrs.attackManager.update(deltaTime);
      this.mgrs.combatManager.cleanupStaleData();
      this.mgrs.victoryManager.update(deltaTime);
      for (const ai of this.aiPlayers) {
        ai.update(deltaTime);
      }
      this.mgrs.feedingManager.update(deltaTime);
      this.mgrs.moraleManager.update(deltaTime);
      this.mgrs.marketplaceManager.update(deltaTime);
      this.mgrs.animalLifecycleManager.update(deltaTime);
      this.mgrs.economyTracker.update(deltaTime);
      this.mgrs.dashboardTracker.update(deltaTime);
      this.rnds.roadRenderer.sync(this.mgrs.roadNetwork, (id) => this.gameState.getUnit(id));
      this.rnds.territoryRenderer.sync(this.mgrs.territoryManager);
      this.mgrs.fogOfWarManager.markDirty(); // Units move every frame
      this.mgrs.fogOfWarManager.update();
      this.rnds.fogOfWarRenderer.sync(this.mgrs.fogOfWarManager);
      this.rnds.buildingRenderer.updateFogVisibility(allBuildings);
      const allUnits = this.gameState.getAllUnits();
      this.rnds.unitRenderer.syncUnits(allUnits);
      this.rnds.unitRenderer.updatePositions(allUnits, deltaTime);

      // Visual systems (shadows, particles, animations, overlays)
      this.rnds.blobShadowRenderer.update(allBuildings, allUnits);
      this.rnds.flagLightSystem.update(
        deltaTime,
        this.mgrs.roadNetwork.getAllFlags(),
        allBuildings,
        this.grid,
        (id) => this.rnds.buildingRenderer.getMesh(id),
      );
      this.rnds.particleSystem.update(deltaTime, allBuildings, this.grid, this.frustum);
      this.rnds.buildingAnimator.update(
        deltaTime,
        allBuildings,
        (id) => this.rnds.buildingRenderer.getMesh(id),
      );
      this.rnds.buildingStatusOverlay.update(
        deltaTime,
        allBuildings,
        this.gameState,
        (id) => this.rnds.buildingRenderer.getMesh(id),
      );
      this.rnds.combatRenderer.update(
        deltaTime,
        this.mgrs.duelAnimationManager.getActiveDuels(),
        (id) => this.rnds.unitRenderer.getMesh(id),
      );
      this.rnds.productionChainOverlay.update(deltaTime);
      this.rnds.weatherController.update(rawDelta, this.camera.position, this.frustum);
      // Pass dynamic wind direction from weather to ambient renderers
      const wind = this.rnds.weatherController.getWindDirection();
      this.rnds.cloudRenderer.setWindDirection(wind);
      this.rnds.flowerButterflyRenderer.setWindDirection(wind);
      this.rnds.cloudRenderer.update(rawDelta, this.camera.position, this.frustum);
      this.rnds.birdFlockRenderer.update(rawDelta, this.camera.position, this.frustum);
      this.rnds.waterEffectRenderer.update(rawDelta, this.camera.position, this.frustum);
      this.rnds.wildAnimalRenderer.update(deltaTime, this.camera.position);
      this.rnds.flowerButterflyRenderer.update(rawDelta, this.camera.position, this.frustum);

      // Apply weather atmosphere overlay
      const wt = this.rnds.weatherController.getWeatherType();
      const t = this.rnds.weatherController.getTransitionOpacity();
      if (t > 0 && wt !== 'none') {
        const isRain = wt === 'rain';
        // Fog density increase
        if (this.scene.fog instanceof THREE.FogExp2) {
          this.scene.fog.density = this.baseFogDensity + (isRain ? 0.005 : 0.003) * t;
        }
        // Sun intensity reduction
        this.directionalLight.intensity = this.baseSunIntensity * (1 - (isRain ? 0.3 : 0.15) * t);
        // Exposure reduction
        this.renderer.toneMappingExposure = this.baseExposure * (1 - (isRain ? 0.1 : 0.05) * t);
        // Color grading overlay (saturation reduction + cool tint shift)
        this.applyColorGradingWithWeather(this.baseColorGrading);
      }

      this.rnds.postProcessing.render();
    };
    animate();
  }

  /** Create AI controllers for all non-human players (player IDs 2..N). */
  private initAIPlayers(): void {
    for (let i = 2; i <= this.config.numPlayers; i++) {
      const ai = new AIPlayer(
        i,
        this.config.difficulty,
        this.gameState,
        this.mgrs.territoryManager,
        this.mgrs.attackManager,
        this.mgrs.knightManager,
        this.mgrs.upgradeManager,
        this.mgrs.roadNetwork,
        this.mgrs.populationManager,
        (building, grid) => {
          this.rnds.buildingRenderer.addBuilding(building, grid);
        },
      );
      ai.setMarketplaceManager(this.mgrs.marketplaceManager);
      this.aiPlayers.push(ai);
    }
  }

  /** Place starting Castles for all players, spread across the map */
  private placeStartingCastles(): void {
    // Use custom map starting positions if available
    if (this.customMapData?.startingPositions.length) {
      const n = this.config.numPlayers;
      const mapPositions = this.customMapData.startingPositions;
      for (let i = 0; i < Math.min(n, mapPositions.length); i++) {
        const sp = mapPositions[i];
        this.placeCastleNear(sp.q, sp.r, sp.playerId);
      }
      return;
    }

    const w = this.grid.width;
    const h = this.grid.height;
    const n = this.config.numPlayers;

    // Compute starting positions: spread players across map quadrants
    const positions = this.getStartingPositions(w, h, n);

    for (let i = 0; i < n; i++) {
      const playerId = i + 1;
      const { q: targetQ, r: targetR } = positions[i];
      this.placeCastleNear(targetQ, targetR, playerId);
    }
  }

  /**
   * Get starting positions spread across the map for N players.
   * Uses positions that maximize toroidal (wrapping) distance between players
   * so territories don't wrap across the map seam.
   */
  private getStartingPositions(
    w: number,
    h: number,
    n: number,
  ): { q: number; r: number }[] {
    const qQuarter = Math.floor(w / 4);
    const rQuarter = Math.floor(h / 4);
    const qHalf = Math.floor(w / 2);
    const rHalf = Math.floor(h / 2);
    const q3Quarter = Math.floor((3 * w) / 4);
    const r3Quarter = Math.floor((3 * h) / 4);

    switch (n) {
      case 1:
        return [{ q: qHalf, r: rHalf }];
      case 2:
        // Half-map separation on a torus
        return [
          { q: qQuarter, r: rQuarter },
          { q: q3Quarter, r: r3Quarter },
        ];
      case 3:
        // Triangular placement
        return [
          { q: Math.floor(w / 6), r: rHalf },
          { q: qHalf, r: Math.floor(h / 6) },
          { q: Math.floor((5 * w) / 6), r: Math.floor((5 * h) / 6) },
        ];
      case 4:
        // 2x2 grid
        return [
          { q: qQuarter, r: rQuarter },
          { q: q3Quarter, r: rQuarter },
          { q: qQuarter, r: r3Quarter },
          { q: q3Quarter, r: r3Quarter },
        ];
      default: {
        // Clamp to valid range and recurse
        const clamped = Math.max(1, Math.min(4, n));
        return this.getStartingPositions(w, h, clamped);
      }
    }
  }

  /** Spiral outward from target to place a Castle on grassland */
  private placeCastleNear(targetQ: number, targetR: number, playerId: number): void {
    const maxRadius = 8;
    for (let radius = 0; radius <= maxRadius; radius++) {
      for (let dq = -radius; dq <= radius; dq++) {
        for (let dr = -radius; dr <= radius; dr++) {
          if (Math.abs(dq) + Math.abs(dr) + Math.abs(-dq - dr) > 2 * radius) continue;
          const q = targetQ + dq;
          const r = targetR + dr;
          if (!this.grid.isInBounds(q, r)) continue;
          const result = this.gameState.placeBuilding(
            BuildingType.Castle,
            { q, r },
            playerId,
          );
          if (result.ok) {
            initializeCastleResources(result.building, this.config.difficulty);
            this.rnds.buildingRenderer.addBuilding(result.building, this.grid);
            this.mgrs.territoryManager.markDirty();
            return;
          }
        }
      }
    }
  }

  /** Restore pre-placed buildings, flags, and roads from custom map data */
  private restorePrePlacedContent(): void {
    if (!this.customMapData) return;

    // Restore pre-placed buildings (non-Castle, since castles are placed separately)
    if (this.customMapData.buildings) {
      for (const b of this.customMapData.buildings) {
        // Skip Castles — those are handled by placeStartingCastles
        if (b.type === BuildingType.Castle) continue;
        const result = this.gameState.placeBuilding(
          b.type as BuildingType,
          { q: b.q, r: b.r },
          b.playerId,
        );
        if (result.ok) {
          // Mark as active and fully built
          result.building.state = BuildingState.Active;
          result.building.constructionProgress = 1;
          this.rnds.buildingRenderer.addBuilding(result.building, this.grid);
          this.mgrs.territoryManager.markDirty();
        }
      }
    }

    // Restore flags
    if (this.customMapData.flags) {
      for (const f of this.customMapData.flags) {
        this.mgrs.roadNetwork.placeFlag({ q: f.q, r: f.r }, f.playerId);
      }
    }

    // Restore roads
    if (this.customMapData.roads) {
      for (const r of this.customMapData.roads) {
        const flagA = this.mgrs.roadNetwork.getFlagAt(r.flagA.q, r.flagA.r);
        const flagB = this.mgrs.roadNetwork.getFlagAt(r.flagB.q, r.flagB.r);
        if (flagA && flagB) {
          this.mgrs.roadNetwork.connectFlags(flagA.id, flagB.id);
        }
      }
    }
  }

  /** Whether the game is currently paused */
  get paused(): boolean {
    return this._paused;
  }

  /** Toggle pause on/off. Returns new paused state. */
  togglePause(): boolean {
    this._paused = !this._paused;
    this.onSpeedChange?.(this._paused, this._gameSpeed);
    return this._paused;
  }

  /** Set paused state explicitly */
  setPaused(paused: boolean): void {
    if (this._paused !== paused) {
      this._paused = paused;
      this.onSpeedChange?.(this._paused, this._gameSpeed);
    }
  }

  /** Current game speed multiplier (0.5, 1, 2, or 3) */
  get gameSpeed(): number {
    return this._gameSpeed;
  }

  /** Cycle game speed: 0.5 → 1 → 2 → 3 → 0.5 */
  cycleSpeed(): number {
    const speeds = [0.5, 1, 2, 3];
    const idx = speeds.indexOf(this._gameSpeed);
    this._gameSpeed = idx >= 0 ? speeds[(idx + 1) % speeds.length] : speeds[0];
    this.onSpeedChange?.(this._paused, this._gameSpeed);
    return this._gameSpeed;
  }

  /** Set game speed directly (clamped to 0.5-3, rounded to nearest 0.5) */
  setGameSpeed(speed: number): void {
    const clamped = Math.max(0.5, Math.min(3, Math.round(speed * 2) / 2));
    if (this._gameSpeed !== clamped) {
      this._gameSpeed = clamped;
      this.onSpeedChange?.(this._paused, this._gameSpeed);
    }
  }

  /** Get current shadow quality */
  getShadowQuality(): ShadowQuality {
    return this._shadowQuality;
  }

  /** Set shadow quality at runtime */
  setShadowQuality(quality: ShadowQuality): void {
    if (this._shadowQuality === quality) return;
    this._shadowQuality = quality;

    switch (quality) {
      case ShadowQuality.Off:
        this.renderer.shadowMap.enabled = false;
        this.directionalLight.castShadow = false;
        this.rnds.blobShadowRenderer.setEnabled(false);
        this.rnds.buildingRenderer.setCastShadow(false);
        this.rnds.mapRenderer.setReceiveShadow(false);
        break;

      case ShadowQuality.BlobOnly:
        this.renderer.shadowMap.enabled = false;
        this.directionalLight.castShadow = false;
        this.rnds.blobShadowRenderer.setEnabled(true);
        this.rnds.buildingRenderer.setCastShadow(false);
        this.rnds.mapRenderer.setReceiveShadow(false);
        break;

      case ShadowQuality.Low:
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        this.configureShadowCamera(512);
        this.rnds.blobShadowRenderer.setEnabled(false);
        this.rnds.buildingRenderer.setCastShadow(true);
        this.rnds.mapRenderer.setReceiveShadow(true);
        break;

      case ShadowQuality.High:
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.configureShadowCamera(1024);
        this.rnds.blobShadowRenderer.setEnabled(false);
        this.rnds.buildingRenderer.setCastShadow(true);
        this.rnds.mapRenderer.setReceiveShadow(true);
        break;
    }

    // Force shadow map recompilation when toggling
    this.renderer.shadowMap.needsUpdate = true;
  }

  /** Configure directional light shadow camera for real-time shadows */
  private configureShadowCamera(mapSize: number): void {
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.set(mapSize, mapSize);
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 100;

    // Fit shadow camera frustum to visible area
    const bounds = this.frustum * 2;
    this.directionalLight.shadow.camera.left = -bounds;
    this.directionalLight.shadow.camera.right = bounds;
    this.directionalLight.shadow.camera.top = bounds;
    this.directionalLight.shadow.camera.bottom = -bounds;
    this.directionalLight.shadow.camera.updateProjectionMatrix();

    // Dispose old shadow map so it gets recreated at the new size
    if (this.directionalLight.shadow.map) {
      this.directionalLight.shadow.map.dispose();
      this.directionalLight.shadow.map = null;
    }
  }

  /** Generate a procedural environment map from the scene's lights for PBR ambient lighting. */
  private setupEnvironment(): void {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    // Dispose previous env map if regenerating
    if (this.scene.environment) {
      this.scene.environment.dispose();
    }

    // Generate environment from scene lights (no HDRI file needed)
    this.scene.environment = pmremGenerator.fromScene(this.scene, 0, 0.1, 100).texture;
    pmremGenerator.dispose();
  }

  /** Apply color grading with weather overlay multipliers */
  private applyColorGradingWithWeather(base: ColorGradingParams): void {
    const wt = this.rnds.weatherController.getWeatherType();
    const t = this.rnds.weatherController.getTransitionOpacity();

    if (t <= 0 || wt === 'none') {
      this.rnds.postProcessing.setColorGradingParams(base);
      return;
    }

    const isRain = wt === 'rain';
    const satMul = 1 - (isRain ? 0.15 : 0.08) * t;
    // Cool tint shift: rain shifts toward blue, snow toward white (reduce warm)
    const tintShift = isRain ? -0.06 * t : -0.03 * t;

    this.rnds.postProcessing.setColorGradingParams({
      warmTint: [
        base.warmTint[0] + tintShift, // reduce red warmth
        base.warmTint[1],
        base.warmTint[2] - tintShift, // boost blue coolness
      ],
      contrast: base.contrast,
      saturation: base.saturation * satMul,
    });
  }

  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', this.onResize);
    this.roadPlacementController?.dispose();
    this.selectionController?.dispose();
    this.placementController?.dispose();
    this.cameraController?.dispose();
    this.rnds.performanceMonitor.dispose();
    this.rnds.blobShadowRenderer.dispose();
    this.rnds.fogOfWarRenderer.dispose();
    this.rnds.productionChainOverlay.dispose();
    this.rnds.combatRenderer.dispose();
    this.rnds.buildingStatusOverlay.dispose();
    this.rnds.buildingAnimator.dispose();
    this.rnds.flagLightSystem.dispose();
    this.rnds.workAreaRenderer.dispose();
    this.rnds.weatherController.dispose();
    this.rnds.cloudRenderer.dispose();
    this.rnds.birdFlockRenderer.dispose();
    this.rnds.waterEffectRenderer.dispose();
    this.rnds.wildAnimalRenderer.dispose();
    this.rnds.flowerButterflyRenderer.dispose();
    this.rnds.particleSystem.dispose();
    this.rnds.treeRenderer.dispose();
    this.rnds.depositRenderer.dispose();
    this.rnds.territoryRenderer.dispose();
    this.rnds.roadRenderer.dispose();
    this.rnds.unitRenderer.dispose();
    this.rnds.buildingRenderer.dispose();
    this.rnds.mapRenderer.dispose();
    this.rnds.postProcessing.dispose();
    if (this.scene.environment) {
      this.scene.environment.dispose();
      this.scene.environment = null;
    }
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.renderer.dispose();
    this.renderer.domElement.remove();

    this.aiPlayers = [];

    // Clean up manager callbacks to prevent memory leaks
    this.mgrs.productionManager.onProductionComplete = null;
    this.mgrs.feedingManager.onFoodConsumed = null;
    this.mgrs.constructionManager.onBuildingActivated = null;
    this.gameState.onBuildingRemoved = null;
    this.gameState.onMinePlaced = null;
    this.mgrs.geologistManager.onDepositRevealed = null;
    this.mgrs.treeManager.onTreeChanged = null;
    this.mgrs.woodcutterManager.onTerrainChanged = null;
    this.mgrs.foresterManager.onTerrainChanged = null;
    this.mgrs.knightManager.onKnightRecruited = null;
    this.mgrs.combatManager.onDuelResolved = null;
    this.mgrs.attackManager.onBuildingUnderAttack = null;
    this.mgrs.attackManager.onBuildingCaptured = null;
    this.mgrs.attackManager.onTerritoryChanged = null;
    this.mgrs.victoryManager.onVictory = null;
    this.mgrs.victoryManager.onDefeat = null;
    this.onNotification = null;
    this.onSpeedChange = null;
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
    return this.rnds.mapRenderer;
  }

  getBuildingRenderer(): BuildingRenderer {
    return this.rnds.buildingRenderer;
  }

  getUnitRenderer(): UnitRenderer {
    return this.rnds.unitRenderer;
  }

  getUnitManager(): UnitManager {
    return this.mgrs.unitManager;
  }

  getFeedingManager(): FeedingManager {
    return this.mgrs.feedingManager;
  }

  getMoraleManager(): MoraleManager {
    return this.mgrs.moraleManager;
  }

  getMarketplaceManager(): MarketplaceManager {
    return this.mgrs.marketplaceManager;
  }

  getGameState(): GameState {
    return this.gameState;
  }

  getRoadNetwork(): RoadNetwork {
    return this.mgrs.roadNetwork;
  }

  getTerritoryManager(): TerritoryManager {
    return this.mgrs.territoryManager;
  }

  getKnightManager(): KnightManager {
    return this.mgrs.knightManager;
  }

  getCombatManager(): CombatManager {
    return this.mgrs.combatManager;
  }

  getAttackManager(): AttackManager {
    return this.mgrs.attackManager;
  }

  getConfig(): GameConfig {
    return this.config;
  }

  getHumanPlayerId(): number {
    return this.humanPlayerId;
  }

  /** Get current nightness level 0.0–1.0 */
  getNightness(): number {
    return this.currentNightness;
  }

  getVictoryManager(): VictoryManager {
    return this.mgrs.victoryManager;
  }

  getRoadRenderer(): RoadRenderer {
    return this.rnds.roadRenderer;
  }

  getPlacementController(): PlacementController | null {
    return this.placementController;
  }

  getSelectionController(): SelectionController | null {
    return this.selectionController;
  }

  getRoadPlacementController(): RoadPlacementController | null {
    return this.roadPlacementController;
  }

  getGeologistManager(): GeologistManager {
    return this.mgrs.geologistManager;
  }

  getTreeManager(): TreeManager {
    return this.mgrs.treeManager;
  }

  getWoodcutterManager(): WoodcutterManager {
    return this.mgrs.woodcutterManager;
  }

  getForesterManager(): ForesterManager {
    return this.mgrs.foresterManager;
  }

  getDepositRenderer(): DepositRenderer {
    return this.rnds.depositRenderer;
  }

  getParticleSystem(): ParticleSystem {
    return this.rnds.particleSystem;
  }

  getBuildingAnimator(): BuildingAnimator {
    return this.rnds.buildingAnimator;
  }

  getBuildingStatusOverlay(): BuildingStatusOverlay {
    return this.rnds.buildingStatusOverlay;
  }

  getCombatRenderer(): CombatRenderer {
    return this.rnds.combatRenderer;
  }

  getProductionChainOverlay(): ProductionChainOverlay {
    return this.rnds.productionChainOverlay;
  }

  getUpgradeManager(): UpgradeManager {
    return this.mgrs.upgradeManager;
  }

  getToolProductionManager(): ToolProductionManager {
    return this.mgrs.toolProductionManager;
  }

  getCameraController(): CameraController | null {
    return this.cameraController;
  }

  getEconomyTracker(): EconomyTracker {
    return this.mgrs.economyTracker;
  }

  getDashboardTracker(): DashboardTracker {
    return this.mgrs.dashboardTracker;
  }

  /** Get the count of idle (unassigned) serfs at the Castle */
  getIdleSerfCount(): number {
    return this.gameState.getIdleUnitsAtCastle(this.humanPlayerId).length;
  }

  getAtmosphereController(): AtmosphereController {
    return this.atmosphereController;
  }

  getWeatherController(): WeatherController {
    return this.rnds.weatherController;
  }

  getPostProcessing(): PostProcessing {
    return this.rnds.postProcessing;
  }

  getFogOfWarRenderer(): FogOfWarRenderer {
    return this.rnds.fogOfWarRenderer;
  }

  /** Show work area overlay for a building (if it has a work radius) */
  showWorkArea(building: import('../game/Building').Building): void {
    if (BUILDING_DEFINITIONS[building.type].workRadius > 0) {
      this.rnds.workAreaRenderer.show(building, this.grid);
    } else {
      this.rnds.workAreaRenderer.hide();
    }
  }

  /** Hide the work area overlay */
  hideWorkArea(): void {
    this.rnds.workAreaRenderer.hide();
  }

  getPopulationManager(): PopulationManager {
    return this.mgrs.populationManager;
  }

  getFogOfWarManager(): FogOfWarManager {
    return this.mgrs.fogOfWarManager;
  }

  /** Apply all graphics settings at once (called on startup and from UI) */
  applyGraphicsSettings(settings: GraphicsSettings): void {
    applyGraphicsSettingsFn(
      settings,
      this.rnds,
      this.atmosphereController,
      this.mgrs.fogOfWarManager,
      this.humanPlayerId,
      (q) => this.setShadowQuality(q as ShadowQuality),
    );
  }

  getDistributionSettings(): GoodsDistributionSettings {
    return this.mgrs.distributionSettings;
  }

  setDistributionSettings(settings: GoodsDistributionSettings): void {
    this.mgrs.distributionSettings = settings;
    this.mgrs.logisticsManager.setDistributionSettings(settings);
  }

  /** Serialize the full game state for save/load */
  /**
   * Compute TorchTower light mitigation for nearby buildings.
   * Buildings within TORCH_TOWER_LIGHT_RADIUS of an active TorchTower
   * get 50% reduction in night penalties.
   */
  private updateLightMitigation(): void {
    this.mgrs.productionManager.lightMitigation.clear();
    if (this.currentNightness <= 0) return;

    const allBuildings = this.gameState.getAllBuildings();
    const torchTowers = allBuildings.filter(
      b => b.type === BuildingType.TorchTower && b.state === BuildingState.Active,
    );
    if (torchTowers.length === 0) return;

    const LIGHT_RADIUS = 5; // TORCH_TOWER_LIGHT_RADIUS from balanceConstants
    for (const building of allBuildings) {
      if (building.state !== BuildingState.Active) continue;
      for (const tower of torchTowers) {
        if (tower.playerId !== building.playerId) continue;
        const dist = HexGrid.hexDistance(building.coord, tower.coord);
        if (dist <= LIGHT_RADIUS) {
          this.mgrs.productionManager.lightMitigation.set(building.id, 0.5);
          break;
        }
      }
    }
  }

  serialize(): SaveData {
    // Compute camera target (point the camera is looking at)
    const target = new THREE.Vector3();
    this.camera.getWorldDirection(target);
    target.multiplyScalar(50).add(this.camera.position);

    return serializeGame(
      this.config,
      this.gameState,
      this.mgrs.roadNetwork,
      {
        constructionManager: this.mgrs.constructionManager,
        transporterManager: this.mgrs.transporterManager,
        unitManager: this.mgrs.unitManager,
        combatManager: this.mgrs.combatManager,
        attackManager: this.mgrs.attackManager,
        territoryManager: this.mgrs.territoryManager,
        logisticsManager: this.mgrs.logisticsManager,
        knightManager: this.mgrs.knightManager,
        victoryManager: this.mgrs.victoryManager,
        geologistManager: this.mgrs.geologistManager,
        treeManager: this.mgrs.treeManager,
        woodcutterManager: this.mgrs.woodcutterManager,
        foresterManager: this.mgrs.foresterManager,
        upgradeManager: this.mgrs.upgradeManager,
        fogOfWarManager: this.mgrs.fogOfWarManager,
        harborManager: this.mgrs.harborManager,
        feedingManager: this.mgrs.feedingManager,
        moraleManager: this.mgrs.moraleManager,
        marketplaceManager: this.mgrs.marketplaceManager,
        animalLifecycleManager: this.mgrs.animalLifecycleManager,
        terrainGatheringManager: this.mgrs.terrainGatheringManager,
      },
      this.aiPlayers,
      {
        frustum: this.frustum,
        position: {
          x: this.camera.position.x,
          y: this.camera.position.y,
          z: this.camera.position.z,
        },
        target: {
          x: target.x,
          y: target.y,
          z: target.z,
        },
      },
      this.mgrs.distributionSettings,
    );
  }

  /** Get AI players (for serialization) */
  getAIPlayers(): AIPlayer[] {
    return this.aiPlayers;
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
