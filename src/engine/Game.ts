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
import type { GameConfig } from '../game/GameConfig';
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
import { updateWaterTime } from './WaterShader';
import { BUILDING_DEFINITIONS } from '../game/BuildingType';
import type { SaveData } from '../game/SaveLoad';
import { serializeGame, deserializeGame } from '../game/SaveLoad';

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

  /** The human player's ID (always 1 for now) */
  private humanPlayerId = 1;

  /** Game speed multiplier (1 = normal, 2 = fast, 3 = fastest) */
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
    this.victoryManager.onVictory = (result) => {
      const conditionLabels = {
        elimination: 'All enemies defeated',
        domination: 'Territorial domination',
        economic: 'Economic supremacy',
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
      if (building.playerId === this.humanPlayerId) {
        const def = BUILDING_DEFINITIONS[building.type];
        this.onNotification?.({ type: 'under_attack', message: `${def.label} is under attack!` });
      }
    };
    this.attackManager.onBuildingCaptured = (building, byPlayerId, oldPlayerId) => {
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

    if (savedData) {
      // Restore saved state
      this.initAIPlayers();
      deserializeGame(
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
        },
        this.aiPlayers,
      );

      // Rebuild renderers from restored state
      for (const building of this.gameState.getAllBuildings()) {
        this.buildingRenderer.addBuilding(building, this.grid);
      }
      this.roadRenderer.sync(this.roadNetwork);
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
      const rawDelta = Math.min(clock.getDelta(), 0.1); // Cap at 100ms to prevent teleporting

      // Camera and water always update (even when paused)
      this.cameraController?.update();
      updateWaterTime(clock.getElapsedTime());

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
      this.roadRenderer.sync(this.roadNetwork);
      this.territoryRenderer.sync(this.territoryManager);
      const allUnits = this.gameState.getAllUnits();
      this.unitRenderer.syncUnits(allUnits);
      this.unitRenderer.updatePositions(allUnits, deltaTime);
      this.renderer.render(this.scene, this.camera);
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

  /** Get starting positions spread across the map for N players */
  private getStartingPositions(
    w: number,
    h: number,
    n: number,
  ): { q: number; r: number }[] {
    const margin = Math.max(3, Math.floor(w * 0.15));
    switch (n) {
      case 1:
        return [{ q: Math.floor(w / 2), r: Math.floor(h / 2) }];
      case 2:
        return [
          { q: margin, r: margin },
          { q: w - margin - 1, r: h - margin - 1 },
        ];
      case 3:
        return [
          { q: margin, r: margin },
          { q: w - margin - 1, r: margin },
          { q: Math.floor(w / 2), r: h - margin - 1 },
        ];
      case 4:
      default:
        return [
          { q: margin, r: margin },
          { q: w - margin - 1, r: margin },
          { q: margin, r: h - margin - 1 },
          { q: w - margin - 1, r: h - margin - 1 },
        ];
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
          if (q < 0 || q >= this.grid.width || r < 0 || r >= this.grid.height) continue;
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

  /** Current game speed multiplier (1, 2, or 3) */
  get gameSpeed(): number {
    return this._gameSpeed;
  }

  /** Cycle game speed: 1 → 2 → 3 → 1 */
  cycleSpeed(): number {
    this._gameSpeed = this._gameSpeed >= 3 ? 1 : this._gameSpeed + 1;
    this.onSpeedChange?.(this._paused, this._gameSpeed);
    return this._gameSpeed;
  }

  /** Set game speed directly (clamped to 1-3) */
  setGameSpeed(speed: number): void {
    const clamped = Math.max(1, Math.min(3, Math.round(speed)));
    if (this._gameSpeed !== clamped) {
      this._gameSpeed = clamped;
      this.onSpeedChange?.(this._paused, this._gameSpeed);
    }
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
    this.treeRenderer.dispose();
    this.depositRenderer.dispose();
    this.territoryRenderer.dispose();
    this.roadRenderer.dispose();
    this.unitRenderer.dispose();
    this.buildingRenderer.dispose();
    this.mapRenderer.dispose();
    this.renderer.dispose();

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
