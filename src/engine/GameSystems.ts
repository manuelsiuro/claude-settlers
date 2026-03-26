import { HexGrid } from '../game/HexGrid';
import { MapRenderer } from './MapRenderer';
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
import { DuelAnimationManager } from '../game/DuelAnimationManager';
import { VictoryManager } from '../game/VictoryManager';
import { GeologistManager } from '../game/GeologistManager';
import { TreeManager } from '../game/TreeManager';
import { WoodcutterManager } from '../game/WoodcutterManager';
import { ForesterManager } from '../game/ForesterManager';
import { HarborManager } from '../game/HarborManager';
import { EconomyTracker } from '../game/EconomyTracker';
import { UpgradeManager } from '../game/UpgradeManager';
import { ToolProductionManager } from '../game/ToolProductionManager';
import { FogOfWarManager } from '../game/FogOfWarManager';
import { PopulationManager } from '../game/PopulationManager';
import { FeedingManager } from '../game/FeedingManager';
import { MoraleManager } from '../game/MoraleManager';
import { MarketplaceManager } from '../game/MarketplaceManager';
import { AnimalLifecycleManager } from '../game/AnimalLifecycleManager';
import { TerrainGatheringManager } from '../game/TerrainGatheringManager';
import { DashboardTracker } from '../game/DashboardTracker';
import { createDefaultDistribution } from '../game/GoodsDistribution';
import type { GoodsDistributionSettings } from '../game/GoodsDistribution';
import type { GameConfig, GraphicsSettings } from '../game/GameConfig';
import { DEFAULT_VICTORY_CONFIG } from '../game/GameConfig';
import { BuildingRenderer } from './BuildingRenderer';
import { UnitRenderer } from './UnitRenderer';
import { DepositRenderer } from './DepositRenderer';
import { TreeRenderer } from './TreeRenderer';
import { RoadRenderer } from './RoadRenderer';
import { TerritoryRenderer } from './TerritoryRenderer';
import { ParticleSystem } from './ParticleSystem';
import { BuildingAnimator } from './BuildingAnimator';
import { BuildingStatusOverlay } from './BuildingStatusOverlay';
import { CombatRenderer } from './CombatRenderer';
import { ProductionChainOverlay } from './ProductionChainOverlay';
import { FogOfWarRenderer } from './FogOfWarRenderer';
import { BlobShadowRenderer } from './BlobShadowRenderer';
import { PerformanceMonitor } from './PerformanceMonitor';
import { PostProcessing } from './PostProcessing';
import { WeatherController } from './WeatherController';
import { CloudRenderer } from './CloudRenderer';
import { BirdFlockRenderer } from './BirdFlockRenderer';
import { WaterEffectRenderer } from './WaterEffectRenderer';
import { WildAnimalRenderer } from './WildAnimalRenderer';
import { FlowerButterflyRenderer } from './FlowerButterflyRenderer';
import { FlagLightSystem } from './FlagLightSystem';
import { WorkAreaRenderer } from './WorkAreaRenderer';
import type { AtmosphereController, ColorGradingParams } from './AtmosphereController';
import type * as THREE from 'three';

export interface GameManagers {
  populationManager: PopulationManager;
  feedingManager: FeedingManager;
  moraleManager: MoraleManager;
  marketplaceManager: MarketplaceManager;
  unitManager: UnitManager;
  productionManager: ProductionManager;
  constructionManager: ConstructionManager;
  roadNetwork: RoadNetwork;
  transporterManager: TransporterManager;
  animalLifecycleManager: AnimalLifecycleManager;
  logisticsManager: LogisticsManager;
  harborManager: HarborManager;
  territoryManager: TerritoryManager;
  knightManager: KnightManager;
  combatManager: CombatManager;
  duelAnimationManager: DuelAnimationManager;
  attackManager: AttackManager;
  victoryManager: VictoryManager;
  geologistManager: GeologistManager;
  treeManager: TreeManager;
  woodcutterManager: WoodcutterManager;
  foresterManager: ForesterManager;
  terrainGatheringManager: TerrainGatheringManager;
  economyTracker: EconomyTracker;
  upgradeManager: UpgradeManager;
  toolProductionManager: ToolProductionManager;
  fogOfWarManager: FogOfWarManager;
  distributionSettings: GoodsDistributionSettings;
  dashboardTracker: DashboardTracker;
}

export interface GameRenderers {
  mapRenderer: MapRenderer;
  buildingRenderer: BuildingRenderer;
  unitRenderer: UnitRenderer;
  depositRenderer: DepositRenderer;
  treeRenderer: TreeRenderer;
  roadRenderer: RoadRenderer;
  territoryRenderer: TerritoryRenderer;
  particleSystem: ParticleSystem;
  buildingAnimator: BuildingAnimator;
  buildingStatusOverlay: BuildingStatusOverlay;
  combatRenderer: CombatRenderer;
  productionChainOverlay: ProductionChainOverlay;
  fogOfWarRenderer: FogOfWarRenderer;
  blobShadowRenderer: BlobShadowRenderer;
  performanceMonitor: PerformanceMonitor;
  postProcessing: PostProcessing;
  weatherController: WeatherController;
  cloudRenderer: CloudRenderer;
  birdFlockRenderer: BirdFlockRenderer;
  waterEffectRenderer: WaterEffectRenderer;
  wildAnimalRenderer: WildAnimalRenderer;
  flowerButterflyRenderer: FlowerButterflyRenderer;
  flagLightSystem: FlagLightSystem;
  workAreaRenderer: WorkAreaRenderer;
}

export interface CreateManagersParams {
  gameState: GameState;
  grid: HexGrid;
  config: GameConfig;
  humanPlayerId: number;
}

/**
 * Create all game managers in the correct dependency order.
 * Some managers depend on others, so the instantiation order matters.
 */
export function createManagers(params: CreateManagersParams): GameManagers {
  const { gameState, grid, config, humanPlayerId } = params;

  const populationManager = new PopulationManager(gameState);
  const feedingManager = new FeedingManager(gameState);
  const moraleManager = new MoraleManager(gameState);
  const marketplaceManager = new MarketplaceManager(gameState);
  const unitManager = new UnitManager(gameState, populationManager);
  const productionManager = new ProductionManager(gameState);
  const constructionManager = new ConstructionManager(gameState, populationManager);
  const roadNetwork = new RoadNetwork(grid);
  const transporterManager = new TransporterManager(gameState, roadNetwork, populationManager);
  const animalLifecycleManager = new AnimalLifecycleManager(gameState, roadNetwork, transporterManager);
  const logisticsManager = new LogisticsManager(gameState, roadNetwork);
  const harborManager = new HarborManager(gameState, roadNetwork, grid);
  const territoryManager = new TerritoryManager(gameState);
  const knightManager = new KnightManager(gameState);
  const combatManager = new CombatManager(gameState, knightManager);
  const duelAnimationManager = new DuelAnimationManager();
  const attackManager = new AttackManager(
    gameState,
    combatManager,
    territoryManager,
    duelAnimationManager,
    (q, r) => {
      const tile = grid.getTile(q, r);
      return tile ? MapRenderer.getTileY(tile) : 0;
    },
    roadNetwork,
  );

  const playerIds = Array.from({ length: config.numPlayers }, (_, i) => i + 1);
  const vc = { ...(config.victory ?? DEFAULT_VICTORY_CONFIG) };
  if (config.numPlayers <= 1) vc.elimination = false;
  const victoryManager = new VictoryManager(gameState, territoryManager, playerIds, vc);

  const geologistManager = new GeologistManager(gameState);
  const treeManager = new TreeManager();
  const woodcutterManager = new WoodcutterManager(gameState, treeManager);
  const foresterManager = new ForesterManager(gameState, treeManager);
  const terrainGatheringManager = new TerrainGatheringManager(gameState);
  const economyTracker = new EconomyTracker();
  marketplaceManager.setEconomyTracker(economyTracker);
  const upgradeManager = new UpgradeManager(gameState);
  const toolProductionManager = new ToolProductionManager(gameState);
  const fogOfWarManager = new FogOfWarManager(gameState);
  const distributionSettings = createDefaultDistribution();
  logisticsManager.setDistributionSettings(distributionSettings);

  const dashboardTracker = new DashboardTracker(
    gameState, populationManager, moraleManager, humanPlayerId,
  );

  return {
    populationManager,
    feedingManager,
    moraleManager,
    marketplaceManager,
    unitManager,
    productionManager,
    constructionManager,
    roadNetwork,
    transporterManager,
    animalLifecycleManager,
    logisticsManager,
    harborManager,
    territoryManager,
    knightManager,
    combatManager,
    duelAnimationManager,
    attackManager,
    victoryManager,
    geologistManager,
    treeManager,
    woodcutterManager,
    foresterManager,
    terrainGatheringManager,
    economyTracker,
    upgradeManager,
    toolProductionManager,
    fogOfWarManager,
    distributionSettings,
    dashboardTracker,
  };
}

export interface CreateRenderersParams {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  atmosphereController: AtmosphereController;
  /** Callback to cache base color grading params and apply with weather overlay */
  onColorGradingUpdate: (params: ColorGradingParams) => void;
  /** Callback to propagate nightness to dependent systems */
  onNightnessUpdate: (nightness: number) => void;
}

/**
 * Create all renderer/visual systems.
 * The atmosphere callbacks are wired in here because several renderers
 * depend on color grading and nightness updates.
 */
export function createRenderers(params: CreateRenderersParams): GameRenderers {
  const { renderer, scene, camera, atmosphereController, onColorGradingUpdate, onNightnessUpdate } = params;

  const mapRenderer = new MapRenderer();
  const buildingRenderer = new BuildingRenderer();
  const unitRenderer = new UnitRenderer();
  const depositRenderer = new DepositRenderer();
  const treeRenderer = new TreeRenderer();
  const roadRenderer = new RoadRenderer();
  const territoryRenderer = new TerritoryRenderer();
  const particleSystem = new ParticleSystem();
  const buildingAnimator = new BuildingAnimator();
  const buildingStatusOverlay = new BuildingStatusOverlay();
  const combatRenderer = new CombatRenderer();
  const productionChainOverlay = new ProductionChainOverlay();
  const fogOfWarRenderer = new FogOfWarRenderer();
  const blobShadowRenderer = new BlobShadowRenderer();
  const performanceMonitor = new PerformanceMonitor();
  const postProcessing = new PostProcessing(renderer, scene, camera);

  atmosphereController.onColorGradingUpdate = (cgParams) => {
    onColorGradingUpdate(cgParams);
  };

  const weatherController = new WeatherController();
  const cloudRenderer = new CloudRenderer();
  const birdFlockRenderer = new BirdFlockRenderer();
  const waterEffectRenderer = new WaterEffectRenderer();
  const wildAnimalRenderer = new WildAnimalRenderer();
  const flowerButterflyRenderer = new FlowerButterflyRenderer();
  const flagLightSystem = new FlagLightSystem();
  const workAreaRenderer = new WorkAreaRenderer();

  atmosphereController.onNightnessUpdate = (nightness) => {
    onNightnessUpdate(nightness);
    flagLightSystem.setNightness(nightness);
    cloudRenderer.setNightness(nightness);
    birdFlockRenderer.setNightness(nightness);
    waterEffectRenderer.setNightness(nightness);
    flowerButterflyRenderer.setNightness(nightness);
    postProcessing.setBloomStrength(0.3 + 0.2 * nightness);
  };

  return {
    mapRenderer,
    buildingRenderer,
    unitRenderer,
    depositRenderer,
    treeRenderer,
    roadRenderer,
    territoryRenderer,
    particleSystem,
    buildingAnimator,
    buildingStatusOverlay,
    combatRenderer,
    productionChainOverlay,
    fogOfWarRenderer,
    blobShadowRenderer,
    performanceMonitor,
    postProcessing,
    weatherController,
    cloudRenderer,
    birdFlockRenderer,
    waterEffectRenderer,
    wildAnimalRenderer,
    flowerButterflyRenderer,
    flagLightSystem,
    workAreaRenderer,
  };
}

/** Apply all graphics settings at once (called on startup and from UI) */
export function applyGraphicsSettings(
  settings: GraphicsSettings,
  renderers: GameRenderers,
  atmosphereController: AtmosphereController,
  fogOfWarManager: FogOfWarManager,
  humanPlayerId: number,
  setShadowQuality: (quality: string) => void,
): void {
  setShadowQuality(settings.shadows);
  renderers.postProcessing.setMode(settings.postProcessing);
  if (settings.weather !== 'none') {
    renderers.weatherController.setWeather(settings.weather as 'none' | 'rain' | 'snow');
  } else if (settings.timeOfDay === 'auto') {
    renderers.weatherController.setAutoSchedule(true);
  } else {
    renderers.weatherController.setWeather('none');
  }

  // Fog of war
  renderers.fogOfWarRenderer.setEnabled(settings.fogOfWar);
  if (settings.fogOfWar) {
    renderers.unitRenderer.setFogOfWar(fogOfWarManager, humanPlayerId);
    renderers.buildingRenderer.setFogOfWar(fogOfWarManager, humanPlayerId);
  } else {
    renderers.unitRenderer.setFogOfWar(null!, humanPlayerId);
    renderers.buildingRenderer.setFogOfWar(null!, humanPlayerId);
  }

  // Time of day / atmosphere
  if (settings.timeOfDay === 'auto') {
    atmosphereController.setAutoCycle(true);
  } else {
    atmosphereController.setAutoCycle(false);
    atmosphereController.setPreset(settings.timeOfDay);
  }

  // Ambient life (clouds, birds, water sparkles, wild animals, butterflies)
  const ambient = settings.ambientLife;
  renderers.cloudRenderer.setEnabled(ambient !== 'off');
  renderers.birdFlockRenderer.setEnabled(ambient === 'full');
  renderers.waterEffectRenderer.setEnabled(ambient === 'full');
  renderers.wildAnimalRenderer.setEnabled(ambient === 'full');
  renderers.flowerButterflyRenderer.setEnabled(ambient === 'full');
}
