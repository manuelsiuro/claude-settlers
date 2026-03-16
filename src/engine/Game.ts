import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import { generateMap } from '../game/MapGenerator';
import { BuildingType } from '../game/BuildingType';
import { initializeCastleResources, transferStorageInputs } from '../game/Building';
import { BuildingState } from '../game/Building';
import { GameState } from '../game/GameState';
import { UnitManager } from '../game/UnitManager';
import { ProductionManager } from '../game/ProductionManager';
import { ConstructionManager } from '../game/ConstructionManager';
import { RoadNetwork } from '../game/RoadNetwork';
import { TransporterManager } from '../game/TransporterManager';
import { LogisticsManager } from '../game/LogisticsManager';
import { TerritoryManager } from '../game/TerritoryManager';
import { KnightManager } from '../game/KnightManager';
import { CombatManager } from '../game/CombatManager';
import { AttackManager } from '../game/AttackManager';
import { VictoryManager } from '../game/VictoryManager';
import { AIPlayer } from '../game/AIPlayer';
import { GeologistManager } from '../game/GeologistManager';
import { TreeManager } from '../game/TreeManager';
import { WoodcutterManager } from '../game/WoodcutterManager';
import { ForesterManager } from '../game/ForesterManager';
import { DepositRenderer } from './DepositRenderer';
import { TreeRenderer } from './TreeRenderer';
import type { GameConfig, GraphicsSettings } from '../game/GameConfig';
import { DEFAULT_CONFIG, SCENARIO_TERRAIN_BALANCE } from '../game/GameConfig';
import { RoadRenderer } from './RoadRenderer';
import { TerritoryRenderer } from './TerritoryRenderer';
import { MapRenderer } from './MapRenderer';
import { BuildingRenderer } from './BuildingRenderer';
import { UnitRenderer } from './UnitRenderer';
import { PlacementController } from './PlacementController';
import { SelectionController } from './SelectionController';
import { RoadPlacementController } from './RoadPlacementController';
import { CameraController } from './CameraController';
import { assetLoader } from './AssetLoader';
import { shaderTimeManager } from './ShaderTimeManager';
import { BUILDING_DEFINITIONS } from '../game/BuildingType';
import type { SaveData } from '../game/SaveLoad';
import { serializeGame, deserializeGame } from '../game/SaveLoad';
import { ParticleSystem, ParticleEffect } from './ParticleSystem';
import { BuildingAnimator } from './BuildingAnimator';
import { BuildingStatusOverlay } from './BuildingStatusOverlay';
import { CombatRenderer } from './CombatRenderer';
import { ProductionChainOverlay } from './ProductionChainOverlay';
import { EconomyTracker } from '../game/EconomyTracker';
import { UpgradeManager } from '../game/UpgradeManager';
import { FogOfWarManager } from '../game/FogOfWarManager';
import { FogOfWarRenderer } from './FogOfWarRenderer';
import { BlobShadowRenderer } from './BlobShadowRenderer';
import { AtmosphereController } from './AtmosphereController';
import { createDefaultDistribution } from '../game/GoodsDistribution';
import type { GoodsDistributionSettings } from '../game/GoodsDistribution';
import { PerformanceMonitor } from './PerformanceMonitor';
import { PostProcessing } from './PostProcessing';
import { WeatherController } from './WeatherController';

export const ShadowQuality = {
  Off: 'off',
  BlobOnly: 'blob_only',
  Low: 'low',
  High: 'high',
} as const;
export type ShadowQuality = (typeof ShadowQuality)[keyof typeof ShadowQuality];

export type GameNotificationType =
  | 'building_complete'
  | 'knight_recruited'
  | 'under_attack'
  | 'building_captured'
  | 'building_destroyed'
  | 'combat_result'
  | 'victory'
  | 'defeat';

export interface GameNotification {
  type: GameNotificationType;
  message: string;
}

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
  private territoryManager: TerritoryManager;
  private knightManager: KnightManager;
  private combatManager: CombatManager;
  private attackManager: AttackManager;
  private victoryManager: VictoryManager;
  private geologistManager: GeologistManager;
  private treeManager: TreeManager;
  private treeRenderer: TreeRenderer;
  private woodcutterManager: WoodcutterManager;
  private foresterManager: ForesterManager;
  private depositRenderer: DepositRenderer;
  private particleSystem: ParticleSystem;
  private buildingAnimator: BuildingAnimator;
  private buildingStatusOverlay: BuildingStatusOverlay;
  private combatRenderer: CombatRenderer;
  private productionChainOverlay: ProductionChainOverlay;
  private economyTracker: EconomyTracker;
  private upgradeManager: UpgradeManager;
  private fogOfWarManager: FogOfWarManager;
  private fogOfWarRenderer: FogOfWarRenderer;
  private blobShadowRenderer: BlobShadowRenderer;
  private atmosphereController: AtmosphereController;
  private distributionSettings: GoodsDistributionSettings;
  private performanceMonitor: PerformanceMonitor;
  private postProcessing: PostProcessing;
  private weatherController: WeatherController;
  private aiPlayers: AIPlayer[] = [];
  private roadRenderer: RoadRenderer;
  private territoryRenderer: TerritoryRenderer;
  private cameraController: CameraController | null = null;
  private placementController: PlacementController | null = null;
  private selectionController: SelectionController | null = null;
  private roadPlacementController: RoadPlacementController | null = null;
  private grid: HexGrid;
  private gameState: GameState;
  private frustum = 10;
  private directionalLight: THREE.DirectionalLight;
  private config: GameConfig;

  /** Current shadow quality setting (default: BlobOnly — matches original behavior) */
  private _shadowQuality: ShadowQuality = ShadowQuality.BlobOnly;

  /** The human player's ID (always 1 for now) */
  private humanPlayerId = 1;

  /** Game speed multiplier (0.5 = slow, 1 = normal, 2 = fast, 3 = fastest) */
  private _gameSpeed = 1;

  /** Whether the game is paused */
  private _paused = false;

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
    this.renderer.toneMapping = THREE.NoToneMapping;
    container.appendChild(this.renderer.domElement);

    // Scene with fog for atmospheric depth
    this.scene = new THREE.Scene();
    //const fogColor = 0xc8dce8;
    //this.scene.fog = new THREE.FogExp2(fogColor, 0.012);
    //this.renderer.setClearColor(fogColor);

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

    // Atmosphere controller (time-of-day lighting presets)
    this.atmosphereController = new AtmosphereController(
      hemiLight, this.directionalLight,
      this.scene.fog as THREE.FogExp2, this.renderer,
    );
    this.atmosphereController.onPresetChanged = () => this.setupEnvironment();

    // Generate procedural environment map from scene lights for PBR materials
    this.setupEnvironment();

    // Grid, game state, and renderers (map built after assets load)
    const terrainBalance = SCENARIO_TERRAIN_BALANCE[this.config.scenario];
    this.grid = generateMap({
      width: this.config.mapSize,
      height: this.config.mapSize,
      seed: this.config.seed,
      terrainBalance: terrainBalance ?? undefined,
    });
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
    this.territoryManager = new TerritoryManager(this.gameState);
    this.knightManager = new KnightManager(this.gameState);
    this.combatManager = new CombatManager(this.gameState, this.knightManager);
    this.attackManager = new AttackManager(this.gameState, this.combatManager, this.territoryManager);
    const playerIds = Array.from({ length: this.config.numPlayers }, (_, i) => i + 1);
    this.victoryManager = new VictoryManager(this.gameState, this.territoryManager, playerIds);
    this.geologistManager = new GeologistManager(this.gameState);
    this.treeManager = new TreeManager();
    this.treeRenderer = new TreeRenderer();
    this.woodcutterManager = new WoodcutterManager(this.gameState, this.treeManager);
    this.foresterManager = new ForesterManager(this.gameState, this.treeManager);
    this.depositRenderer = new DepositRenderer();
    this.particleSystem = new ParticleSystem();
    this.buildingAnimator = new BuildingAnimator();
    this.buildingStatusOverlay = new BuildingStatusOverlay();
    this.combatRenderer = new CombatRenderer();
    this.productionChainOverlay = new ProductionChainOverlay();
    this.economyTracker = new EconomyTracker();
    this.upgradeManager = new UpgradeManager(this.gameState);
    this.fogOfWarManager = new FogOfWarManager(this.gameState);
    this.fogOfWarRenderer = new FogOfWarRenderer();
    this.blobShadowRenderer = new BlobShadowRenderer();
    this.distributionSettings = createDefaultDistribution();
    this.logisticsManager.setDistributionSettings(this.distributionSettings);
    this.performanceMonitor = new PerformanceMonitor();
    this.postProcessing = new PostProcessing(this.renderer, this.scene, this.camera);
    this.weatherController = new WeatherController();
    // Wire production events to economy tracker
    this.productionManager.onProductionComplete = (inputs, outputs) => {
      for (const input of inputs) {
        this.economyTracker.recordConsumption(input.resource, input.amount);
      }
      for (const output of outputs) {
        this.economyTracker.recordProduction(output.resource, output.amount);
      }
    };
    this.victoryManager.onVictory = (result) => {
      const conditionLabels: Record<string, string> = {
        elimination: 'All enemies defeated',
        domination: 'Territorial domination',
        economic: 'Economic supremacy',
        timed: 'Time limit reached',
        peaceful: 'Trade empire',
      };
      const label = conditionLabels[result.condition] ?? result.condition;
      if (result.winnerId === this.humanPlayerId) {
        this.onNotification?.({ type: 'victory', message: `Victory! ${label}!` });
      } else {
        this.onNotification?.({ type: 'defeat', message: `Defeat! Player ${result.winnerId} achieved ${label}` });
      }
    };
    this.victoryManager.onDefeat = (result) => {
      if (result.playerId === this.humanPlayerId) {
        this.onNotification?.({ type: 'defeat', message: 'Your Castle has been destroyed! Defeat!' });
      }
    };
    this.constructionManager.onBuildingActivated = (building) => {
      this.territoryManager.markDirty();
      this.buildingAnimator.onBuildingActivated(building.id);
      // Completion particle burst
      const { x, z } = HexGrid.hexToWorld(building.coord.q, building.coord.r);
      const tile = this.grid.getTile(building.coord.q, building.coord.r);
      const y = tile ? MapRenderer.getTileY(tile) : 0;
      this.particleSystem.emitBurst(x, y + 0.3, z, ParticleEffect.CompletionFlash, 20);
      if (building.playerId === this.humanPlayerId) {
        const def = BUILDING_DEFINITIONS[building.type];
        this.onNotification?.({ type: 'building_complete', message: `${def.label} construction complete` });
      }
    };
    this.gameState.territoryCheck = (q, r, playerId) => this.territoryManager.isOwnedBy(q, r, playerId);
    this.gameState.onBuildingRemoved = (building) => {
      this.territoryManager.markDirty();
      if (building.playerId === this.humanPlayerId) {
        const def = BUILDING_DEFINITIONS[building.type];
        this.onNotification?.({ type: 'building_destroyed', message: `${def.label} destroyed` });
      }
    };
    this.knightManager.onKnightRecruited = (building) => {
      this.territoryManager.markDirty();
      if (building.playerId === this.humanPlayerId) {
        const def = BUILDING_DEFINITIONS[building.type];
        this.onNotification?.({ type: 'knight_recruited', message: `Knight recruited at ${def.label}` });
      }
    };
    this.combatManager.onDuelResolved = (result) => {
      if (result.winnerPlayerId === this.humanPlayerId) {
        const winner = this.gameState.getUnit(result.winnerId);
        const msg = result.rankUp && winner
          ? `Knight victorious — promoted to rank ${winner.knightRank}!`
          : 'Knight won the duel!';
        this.onNotification?.({ type: 'combat_result', message: msg });
      } else if (result.loserPlayerId === this.humanPlayerId) {
        this.onNotification?.({ type: 'combat_result', message: 'Your knight was defeated' });
      }
      // NPC-vs-NPC duels: no notification for human player
    };
    this.attackManager.onBuildingUnderAttack = (building) => {
      this.combatRenderer.showAttackWarning(building);
      if (building.playerId === this.humanPlayerId) {
        const def = BUILDING_DEFINITIONS[building.type];
        this.onNotification?.({ type: 'under_attack', message: `${def.label} is under attack!` });
      }
      // Notify AI player of the attack so it can respond
      for (const ai of this.aiPlayers) {
        if (ai.getPlayerId() === building.playerId) {
          ai.onUnderAttack(building.id);
        }
      }
    };
    this.attackManager.onBuildingCaptured = (building, byPlayerId, oldPlayerId) => {
      this.combatRenderer.showCaptureBanner(building, byPlayerId);
      const def = BUILDING_DEFINITIONS[building.type];
      if (byPlayerId === this.humanPlayerId) {
        this.onNotification?.({ type: 'building_captured', message: `${def.label} captured!` });
      } else if (oldPlayerId === this.humanPlayerId) {
        this.onNotification?.({ type: 'building_captured', message: `Enemy captured your ${def.label}!` });
      }
    };
    // Wire geologist deposit reveal → deposit renderer
    this.geologistManager.onDepositRevealed = (coord, deposit) => {
      this.depositRenderer.addMarker(coord, deposit.resource, this.grid);
      const resourceLabels: Record<string, string> = {
        iron_ore: 'Iron',
        coal_ore: 'Coal',
        gold_ore: 'Gold',
      };
      const label = resourceLabels[deposit.resource] ?? deposit.resource;
      this.onNotification?.({ type: 'building_complete', message: `${label} deposit discovered!` });
    };

    // Wire mine placement → remove deposit marker + rebuild map
    this.gameState.onMinePlaced = (coord) => {
      this.depositRenderer.removeMarker(coord);
      this.mapRenderer.rebuild();
    };

    this.roadRenderer = new RoadRenderer();
    this.territoryRenderer = new TerritoryRenderer();

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
    this.postProcessing.resize(this.width, this.height);
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
    this.mapRenderer.render(this.grid, this.scene);

    // Set up building renderer with world wrapping
    this.buildingRenderer.addToScene(this.scene, this.grid);

    // Set up unit renderer with world wrapping
    this.unitRenderer.addToScene(this.scene, this.grid);

    // Set up road renderer with world wrapping
    this.roadRenderer.addToScene(this.scene, this.grid);

    // Set up territory renderer with world wrapping
    this.territoryRenderer.addToScene(this.scene, this.grid);

    // Set up deposit renderer with world wrapping
    this.depositRenderer.addToScene(this.scene, this.grid);

    // Set up tree renderer
    this.treeRenderer.addToScene(this.scene);

    // Set up particle system
    this.particleSystem.addToScene(this.scene);

    // Set up combat renderer
    this.combatRenderer.addToScene(this.scene, this.grid);

    // Set up production chain overlay
    this.productionChainOverlay.addToScene(this.scene, this.grid);

    // Set up blob shadows
    this.blobShadowRenderer.addToScene(this.scene, this.grid);

    // Set up weather controller
    this.weatherController.addToScene(this.scene);

    // Set up fog of war renderer + wire into unit/building renderers
    this.fogOfWarRenderer.addToScene(this.scene, this.grid);
    this.fogOfWarRenderer.setPlayerId(this.humanPlayerId);
    this.unitRenderer.setFogOfWar(this.fogOfWarManager, this.humanPlayerId);
    this.buildingRenderer.setFogOfWar(this.fogOfWarManager, this.humanPlayerId);

    if (savedData) {
      // Restore saved state
      this.initAIPlayers();
      const restoredDistribution = deserializeGame(
        savedData,
        this.gameState,
        this.roadNetwork,
        {
          constructionManager: this.constructionManager,
          transporterManager: this.transporterManager,
          unitManager: this.unitManager,
          combatManager: this.combatManager,
          attackManager: this.attackManager,
          territoryManager: this.territoryManager,
          logisticsManager: this.logisticsManager,
          knightManager: this.knightManager,
          victoryManager: this.victoryManager,
          geologistManager: this.geologistManager,
          treeManager: this.treeManager,
          woodcutterManager: this.woodcutterManager,
          foresterManager: this.foresterManager,
          upgradeManager: this.upgradeManager,
          fogOfWarManager: this.fogOfWarManager,
        },
        this.aiPlayers,
      );

      // Restore goods distribution settings if present
      if (restoredDistribution) {
        this.distributionSettings = restoredDistribution;
        this.logisticsManager.setDistributionSettings(restoredDistribution);
      }

      // Rebuild renderers from restored state
      for (const building of this.gameState.getAllBuildings()) {
        this.buildingRenderer.addBuilding(building, this.grid);
      }
      this.roadRenderer.sync(this.roadNetwork, (id) => this.gameState.getUnit(id));
      this.territoryRenderer.sync(this.territoryManager);

      // Rebuild deposit markers from revealed deposits
      for (const tile of this.grid.getAllTiles()) {
        if (tile.deposit?.revealed && !tile.deposit.claimed) {
          this.depositRenderer.addMarker(tile.coord, tile.deposit.resource, this.grid);
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
      this.treeManager.initializeFromMap(this.grid);

      // New game: place starting Castles and create AI controllers
      this.placeStartingCastles();
      this.initAIPlayers();

      // Position camera at human player's Castle (or map center as fallback)
      const castle1 = this.gameState.findCastle(this.humanPlayerId);
      let lookAt: THREE.Vector3;
      if (castle1) {
        const { x, z } = HexGrid.hexToWorld(castle1.coord.q, castle1.coord.r);
        lookAt = new THREE.Vector3(x, 0, z);
      } else {
        lookAt = this.mapRenderer.getMapCenter(this.grid);
      }
      const camOffset = new THREE.Vector3(20, 20, 20);
      this.camera.position.copy(lookAt).add(camOffset);
      this.camera.lookAt(lookAt);
    }

    // Wire tree/forestry callbacks
    this.treeManager.onTreeChanged = () => this.treeRenderer.markDirty();
    this.woodcutterManager.onTerrainChanged = () => this.mapRenderer.rebuild();
    this.foresterManager.onTerrainChanged = () => this.mapRenderer.rebuild();

    // Initial tree render
    this.treeRenderer.markDirty();
    this.treeRenderer.sync(this.treeManager, this.grid);

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
      this.performanceMonitor.tick();
      const rawDelta = Math.min(clock.getDelta(), 0.1); // Cap at 100ms to prevent teleporting

      // Camera and shader time always update (even when paused)
      this.cameraController?.update();
      const elapsed = clock.getElapsedTime();
      shaderTimeManager.update(elapsed);

      // Atmosphere always updates (even paused) for smooth transitions
      this.atmosphereController.update(rawDelta);

      // Scale delta by game speed; zero when paused
      const deltaTime = this._paused ? 0 : rawDelta * this._gameSpeed;

      // Transfer storage building inputs → outputs (Castle/Warehouse accept delivered goods)
      const allBuildings = this.gameState.getAllBuildings();
      for (const b of allBuildings) {
        if (b.type !== BuildingType.Castle && b.type !== BuildingType.Warehouse) continue;
        if (b.state !== BuildingState.Active) continue;
        transferStorageInputs(b);
      }

      this.territoryManager.update();
      this.unitManager.update(deltaTime);
      this.constructionManager.update(deltaTime);
      this.upgradeManager.update(deltaTime);
      this.productionManager.update(deltaTime);
      this.geologistManager.update(deltaTime);
      this.treeManager.update(deltaTime);
      this.woodcutterManager.update(deltaTime);
      this.foresterManager.update(deltaTime);
      this.treeRenderer.sync(this.treeManager, this.grid);
      this.logisticsManager.update(deltaTime);
      this.transporterManager.update(deltaTime);
      this.knightManager.update(deltaTime);
      this.attackManager.update();
      this.combatManager.cleanupStaleData();
      this.victoryManager.update(deltaTime);
      for (const ai of this.aiPlayers) {
        ai.update(deltaTime);
      }
      this.economyTracker.update(deltaTime);
      this.roadRenderer.sync(this.roadNetwork, (id) => this.gameState.getUnit(id));
      this.territoryRenderer.sync(this.territoryManager);
      this.fogOfWarManager.markDirty(); // Units move every frame
      this.fogOfWarManager.update();
      this.fogOfWarRenderer.sync(this.fogOfWarManager);
      this.buildingRenderer.updateFogVisibility(allBuildings);
      const allUnits = this.gameState.getAllUnits();
      this.unitRenderer.syncUnits(allUnits);
      this.unitRenderer.updatePositions(allUnits, deltaTime);

      // Visual systems (shadows, particles, animations, overlays)
      this.blobShadowRenderer.update(allBuildings, allUnits);
      this.particleSystem.update(deltaTime, allBuildings, this.grid, this.frustum);
      this.buildingAnimator.update(
        deltaTime,
        allBuildings,
        (id) => this.buildingRenderer.getMesh(id),
      );
      this.buildingStatusOverlay.update(
        deltaTime,
        allBuildings,
        this.gameState,
        (id) => this.buildingRenderer.getMesh(id),
      );
      this.combatRenderer.update(
        deltaTime,
        [],
        (id) => this.unitRenderer.getMesh(id),
      );
      this.productionChainOverlay.update(deltaTime);
      this.weatherController.update(rawDelta, this.camera.position);

      this.postProcessing.render();
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
        this.territoryManager,
        this.attackManager,
        this.knightManager,
        this.upgradeManager,
        this.roadNetwork,
        (building, grid) => {
          this.buildingRenderer.addBuilding(building, grid);
        },
      );
      this.aiPlayers.push(ai);
    }
  }

  /** Place starting Castles for all players, spread across the map */
  private placeStartingCastles(): void {
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
            initializeCastleResources(result.building);
            this.buildingRenderer.addBuilding(result.building, this.grid);
            this.territoryManager.markDirty();
            return;
          }
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
        this.blobShadowRenderer.setEnabled(false);
        this.buildingRenderer.setCastShadow(false);
        this.mapRenderer.setReceiveShadow(false);
        break;

      case ShadowQuality.BlobOnly:
        this.renderer.shadowMap.enabled = false;
        this.directionalLight.castShadow = false;
        this.blobShadowRenderer.setEnabled(true);
        this.buildingRenderer.setCastShadow(false);
        this.mapRenderer.setReceiveShadow(false);
        break;

      case ShadowQuality.Low:
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        this.configureShadowCamera(512);
        this.blobShadowRenderer.setEnabled(false);
        this.buildingRenderer.setCastShadow(true);
        this.mapRenderer.setReceiveShadow(true);
        break;

      case ShadowQuality.High:
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.configureShadowCamera(1024);
        this.blobShadowRenderer.setEnabled(false);
        this.buildingRenderer.setCastShadow(true);
        this.mapRenderer.setReceiveShadow(true);
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

  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', this.onResize);
    this.roadPlacementController?.dispose();
    this.selectionController?.dispose();
    this.placementController?.dispose();
    this.cameraController?.dispose();
    this.performanceMonitor.dispose();
    this.blobShadowRenderer.dispose();
    this.fogOfWarRenderer.dispose();
    this.productionChainOverlay.dispose();
    this.combatRenderer.dispose();
    this.buildingStatusOverlay.dispose();
    this.buildingAnimator.dispose();
    this.weatherController.dispose();
    this.particleSystem.dispose();
    this.treeRenderer.dispose();
    this.depositRenderer.dispose();
    this.territoryRenderer.dispose();
    this.roadRenderer.dispose();
    this.unitRenderer.dispose();
    this.buildingRenderer.dispose();
    this.mapRenderer.dispose();
    this.postProcessing.dispose();
    if (this.scene.environment) {
      this.scene.environment.dispose();
      this.scene.environment = null;
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();

    this.aiPlayers = [];

    // Clean up manager callbacks to prevent memory leaks
    this.constructionManager.onBuildingActivated = null;
    this.gameState.onBuildingRemoved = null;
    this.gameState.onMinePlaced = null;
    this.geologistManager.onDepositRevealed = null;
    this.treeManager.onTreeChanged = null;
    this.woodcutterManager.onTerrainChanged = null;
    this.foresterManager.onTerrainChanged = null;
    this.knightManager.onKnightRecruited = null;
    this.combatManager.onDuelResolved = null;
    this.attackManager.onBuildingUnderAttack = null;
    this.attackManager.onBuildingCaptured = null;
    this.attackManager.onTerritoryChanged = null;
    this.victoryManager.onVictory = null;
    this.victoryManager.onDefeat = null;
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

  getTerritoryManager(): TerritoryManager {
    return this.territoryManager;
  }

  getKnightManager(): KnightManager {
    return this.knightManager;
  }

  getCombatManager(): CombatManager {
    return this.combatManager;
  }

  getAttackManager(): AttackManager {
    return this.attackManager;
  }

  getConfig(): GameConfig {
    return this.config;
  }

  getHumanPlayerId(): number {
    return this.humanPlayerId;
  }

  getVictoryManager(): VictoryManager {
    return this.victoryManager;
  }

  getRoadRenderer(): RoadRenderer {
    return this.roadRenderer;
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
    return this.geologistManager;
  }

  getTreeManager(): TreeManager {
    return this.treeManager;
  }

  getWoodcutterManager(): WoodcutterManager {
    return this.woodcutterManager;
  }

  getForesterManager(): ForesterManager {
    return this.foresterManager;
  }

  getDepositRenderer(): DepositRenderer {
    return this.depositRenderer;
  }

  getParticleSystem(): ParticleSystem {
    return this.particleSystem;
  }

  getBuildingAnimator(): BuildingAnimator {
    return this.buildingAnimator;
  }

  getBuildingStatusOverlay(): BuildingStatusOverlay {
    return this.buildingStatusOverlay;
  }

  getCombatRenderer(): CombatRenderer {
    return this.combatRenderer;
  }

  getProductionChainOverlay(): ProductionChainOverlay {
    return this.productionChainOverlay;
  }

  getUpgradeManager(): UpgradeManager {
    return this.upgradeManager;
  }

  getEconomyTracker(): EconomyTracker {
    return this.economyTracker;
  }

  /** Get the count of idle (unassigned) serfs at the Castle */
  getIdleSerfCount(): number {
    return this.gameState.getIdleUnitsAtCastle(this.humanPlayerId).length;
  }

  getAtmosphereController(): AtmosphereController {
    return this.atmosphereController;
  }

  getWeatherController(): WeatherController {
    return this.weatherController;
  }

  getPostProcessing(): PostProcessing {
    return this.postProcessing;
  }

  getFogOfWarRenderer(): FogOfWarRenderer {
    return this.fogOfWarRenderer;
  }

  getFogOfWarManager(): FogOfWarManager {
    return this.fogOfWarManager;
  }

  /** Apply all graphics settings at once (called on startup and from UI) */
  applyGraphicsSettings(settings: GraphicsSettings): void {
    this.setShadowQuality(settings.shadows as ShadowQuality);
    this.postProcessing.setMode(settings.postProcessing);
    this.weatherController.setWeather(settings.weather as 'none' | 'rain' | 'snow');

    // Fog of war
    this.fogOfWarRenderer.setEnabled(settings.fogOfWar);
    if (settings.fogOfWar) {
      this.unitRenderer.setFogOfWar(this.fogOfWarManager, this.humanPlayerId);
      this.buildingRenderer.setFogOfWar(this.fogOfWarManager, this.humanPlayerId);
    } else {
      this.unitRenderer.setFogOfWar(null!, this.humanPlayerId);
      this.buildingRenderer.setFogOfWar(null!, this.humanPlayerId);
    }

    // Time of day / atmosphere
    if (settings.timeOfDay === 'auto') {
      this.atmosphereController.setAutoCycle(true);
    } else {
      this.atmosphereController.setAutoCycle(false);
      this.atmosphereController.setPreset(settings.timeOfDay);
    }
  }

  getDistributionSettings(): GoodsDistributionSettings {
    return this.distributionSettings;
  }

  setDistributionSettings(settings: GoodsDistributionSettings): void {
    this.distributionSettings = settings;
    this.logisticsManager.setDistributionSettings(settings);
  }

  /** Serialize the full game state for save/load */
  serialize(): SaveData {
    // Compute camera target (point the camera is looking at)
    const target = new THREE.Vector3();
    this.camera.getWorldDirection(target);
    target.multiplyScalar(50).add(this.camera.position);

    return serializeGame(
      this.config,
      this.gameState,
      this.roadNetwork,
      {
        constructionManager: this.constructionManager,
        transporterManager: this.transporterManager,
        unitManager: this.unitManager,
        combatManager: this.combatManager,
        attackManager: this.attackManager,
        territoryManager: this.territoryManager,
        logisticsManager: this.logisticsManager,
        knightManager: this.knightManager,
        victoryManager: this.victoryManager,
        geologistManager: this.geologistManager,
        treeManager: this.treeManager,
        woodcutterManager: this.woodcutterManager,
        foresterManager: this.foresterManager,
        upgradeManager: this.upgradeManager,
        fogOfWarManager: this.fogOfWarManager,
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
      this.distributionSettings,
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
