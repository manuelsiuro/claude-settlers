import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import { TerrainType } from '../game/TerrainType';
import { generateMap } from '../game/MapGenerator';
import { MapRenderer } from '../engine/MapRenderer';
import { CameraController } from '../engine/CameraController';
import type { CameraHost } from '../engine/CameraController';
import { HexPicker } from '../engine/HexPicker';
import { assetLoader } from '../engine/AssetLoader';
import type { MapData, StartingPosition, MapBuildingData, MapFlagData, MapRoadData } from '../game/MapData';
import { buildGridFromMapData, exportGridToMapData } from '../game/MapData';
import { UndoManager } from './UndoManager';
import type { TileSnapshot } from './UndoManager';
import type { Scenario } from '../game/GameConfig';
import { SCENARIO_TERRAIN_BALANCE } from '../game/GameConfig';
import type { BalanceConfigOverrides } from '../game/data/balanceConstants';
import { TreeManager } from '../game/TreeManager';
import { TreeRenderer } from '../engine/TreeRenderer';
import { BuildingRenderer } from '../engine/BuildingRenderer';
import { RoadRenderer } from '../engine/RoadRenderer';
import { RoadNetwork } from '../game/RoadNetwork';
import type { Building } from '../game/Building';
import { createBuilding, BuildingState } from '../game/Building';
import type { BuildingType } from '../game/BuildingType';

const PLAYER_COLORS = [0x4488ff, 0xff4444, 0x44cc44, 0xffcc00];

/**
 * Lightweight Three.js editor scene — no game managers/logic.
 * Reuses MapRenderer, HexPicker, and CameraController.
 */
export class MapEditor implements CameraHost {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private container: HTMLElement;
  private animationId: number | null = null;
  private mapRenderer: MapRenderer;
  private treeManager: TreeManager;
  private treeRenderer: TreeRenderer;
  private buildingRenderer: BuildingRenderer;
  private roadRenderer: RoadRenderer;
  private roadNetwork: RoadNetwork;
  private cameraController: CameraController | null = null;
  private hexPicker: HexPicker;
  private grid: HexGrid;
  private frustum = 10;
  private width: number;
  private height: number;

  // Editor state
  readonly undoManager = new UndoManager();
  private startingPositions: StartingPosition[] = [];
  private editorBuildings: Map<string, { building: Building; data: MapBuildingData }> = new Map();
  private nextEditorBuildingId = 1;
  private startMarkerMeshes: THREE.Mesh[] = [];
  private mapId: string;
  private mapName = 'Untitled Map';
  private mapDescription = '';
  private balanceConfig: BalanceConfigOverrides | undefined;
  private createdAtTime: number;

  // Pointer callbacks (set by MapEditorTools)
  onPointerDown: ((q: number, r: number, altKey: boolean) => void) | null = null;
  onPointerMove: ((q: number, r: number, altKey: boolean) => void) | null = null;
  onPointerUp: (() => void) | null = null;
  onHoverHex: ((q: number, r: number) => void) | null = null;

  /** Fires when the map is modified (for UI status updates) */
  onMapChanged: (() => void) | null = null;

  private isPointerDown = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.width = container.clientWidth || window.innerWidth;
    this.height = container.clientHeight || window.innerHeight;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setSize(this.width, this.height);
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    const fogColor = 0xc8dce8;
    this.scene.fog = new THREE.FogExp2(fogColor, 0.01);
    this.renderer.setClearColor(fogColor);

    // Isometric orthographic camera
    const aspect = this.width / this.height;
    this.camera = new THREE.OrthographicCamera(
      -this.frustum * aspect,
      this.frustum * aspect,
      this.frustum,
      -this.frustum,
      0.1,
      1000,
    );

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x6a9c5f, 1.0);
    this.scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xfff4e0, 1.2);
    dirLight.position.set(10, 20, 10);
    this.scene.add(dirLight);

    this.mapRenderer = new MapRenderer();
    this.treeManager = new TreeManager();
    this.treeRenderer = new TreeRenderer();
    this.buildingRenderer = new BuildingRenderer();
    this.roadRenderer = new RoadRenderer();
    this.hexPicker = new HexPicker();

    // Start with a blank 32x32 grid
    this.grid = this.createBlankGrid(32);
    this.roadNetwork = new RoadNetwork(this.grid);
    this.mapId = crypto.randomUUID();
    this.createdAtTime = Date.now();

    // Pointer events
    this.bindPointerEvents();

    // Resize
    window.addEventListener('resize', this.onResize);
  }

  // ─── CameraHost interface ──────────────────────────────────────────────

  getCamera(): THREE.OrthographicCamera {
    return this.camera;
  }
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }
  getGrid(): HexGrid {
    return this.grid;
  }
  getFrustum(): number {
    return this.frustum;
  }
  setFrustum(f: number): void {
    this.frustum = f;
    this.onResize();
  }

  // ─── Public API ────────────────────────────────────────────────────────

  getHexPicker(): HexPicker {
    return this.hexPicker;
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getStartingPositions(): StartingPosition[] {
    return this.startingPositions;
  }

  setStartingPositions(positions: StartingPosition[]): void {
    this.startingPositions = positions;
    this.rebuildStartMarkers();
    this.onMapChanged?.();
  }

  getMapName(): string {
    return this.mapName;
  }
  setMapName(name: string): void {
    this.mapName = name;
  }

  getMapDescription(): string {
    return this.mapDescription;
  }
  setMapDescription(desc: string): void {
    this.mapDescription = desc;
  }

  getMapId(): string {
    return this.mapId;
  }

  getBalanceConfig(): BalanceConfigOverrides | undefined {
    return this.balanceConfig;
  }
  setBalanceConfig(config: BalanceConfigOverrides | undefined): void {
    this.balanceConfig = config;
  }

  getRoadNetwork(): RoadNetwork {
    return this.roadNetwork;
  }

  // ─── Building API ─────────────────────────────────────────────────────

  /** Place a building in the editor. Returns the building key or null. */
  placeBuilding(type: BuildingType, q: number, r: number, playerId: number): string | null {
    // Check tile is valid
    const tile = this.grid.getTile(q, r);
    if (!tile) return null;

    // Check no existing building at this coord
    for (const entry of this.editorBuildings.values()) {
      if (entry.data.q === q && entry.data.r === r) return null;
    }

    const building = createBuilding(type, { q, r }, playerId);
    building.state = BuildingState.Active;
    building.constructionProgress = 1;
    building.hasWorker = true;
    const key = `editor_building_${this.nextEditorBuildingId++}`;
    building.id = key;

    const data: MapBuildingData = { type, q, r, playerId };
    this.editorBuildings.set(key, { building, data });
    this.buildingRenderer.addBuilding(building, this.grid);
    this.onMapChanged?.();
    return key;
  }

  /** Remove a building by its coordinate */
  removeBuildingAt(q: number, r: number): boolean {
    for (const [key, entry] of this.editorBuildings) {
      if (entry.data.q === q && entry.data.r === r) {
        this.buildingRenderer.removeBuilding(key);
        this.editorBuildings.delete(key);
        this.onMapChanged?.();
        return true;
      }
    }
    return false;
  }

  /** Get building at a coordinate */
  getBuildingAt(q: number, r: number): MapBuildingData | null {
    for (const entry of this.editorBuildings.values()) {
      if (entry.data.q === q && entry.data.r === r) return entry.data;
    }
    return null;
  }

  /** Get all editor buildings */
  getEditorBuildings(): MapBuildingData[] {
    return Array.from(this.editorBuildings.values()).map((e) => e.data);
  }

  // ─── Flag & Road API ──────────────────────────────────────────────────

  /** Place a flag at a hex coordinate. Returns true if successful. */
  placeFlag(q: number, r: number, playerId: number): boolean {
    const flag = this.roadNetwork.placeFlag({ q, r }, playerId);
    if (!flag) return false;
    this.onMapChanged?.();
    return true;
  }

  /** Remove a flag and its roads. Returns true if successful. */
  removeFlagAt(q: number, r: number): boolean {
    const flag = this.roadNetwork.getFlagAt(q, r);
    if (!flag) return false;
    this.roadNetwork.removeFlag(flag.id);
    this.onMapChanged?.();
    return true;
  }

  /** Connect two adjacent flags with a road. Returns true if successful. */
  connectFlags(q1: number, r1: number, q2: number, r2: number): boolean {
    const flagA = this.roadNetwork.getFlagAt(q1, r1);
    const flagB = this.roadNetwork.getFlagAt(q2, r2);
    if (!flagA || !flagB) return false;
    const road = this.roadNetwork.connectFlags(flagA.id, flagB.id);
    if (!road) return false;
    this.onMapChanged?.();
    return true;
  }

  /** Get flag/road data for export */
  getEditorFlags(): MapFlagData[] {
    return this.roadNetwork.getAllFlags().map((f) => ({
      q: f.coord.q,
      r: f.coord.r,
      playerId: f.playerId,
    }));
  }

  getEditorRoads(): MapRoadData[] {
    return this.roadNetwork.getAllRoads().map((r) => {
      const flagA = this.roadNetwork.getFlag(r.flagA);
      const flagB = this.roadNetwork.getFlag(r.flagB);
      return {
        flagA: { q: flagA!.coord.q, r: flagA!.coord.r },
        flagB: { q: flagB!.coord.q, r: flagB!.coord.r },
        quality: r.quality,
      };
    });
  }

  /** Create a new blank map (all grassland, elevation 0.3) */
  newMap(size: number): void {
    this.grid = this.createBlankGrid(size);
    this.startingPositions = [];
    this.clearEditorBuildings();
    this.roadNetwork = new RoadNetwork(this.grid);
    this.mapId = crypto.randomUUID();
    this.mapName = 'Untitled Map';
    this.mapDescription = '';
    this.balanceConfig = undefined;
    this.createdAtTime = Date.now();
    this.undoManager.clear();
    this.rebuildAll();
  }

  /** Create a map from procedural generation, then allow editing */
  newMapFromSeed(size: number, seed: number, scenario: Scenario): void {
    const terrainBalance = SCENARIO_TERRAIN_BALANCE[scenario];
    this.grid = generateMap({
      width: size,
      height: size,
      seed,
      terrainBalance: terrainBalance ?? undefined,
    });
    this.startingPositions = [];
    this.clearEditorBuildings();
    this.roadNetwork = new RoadNetwork(this.grid);
    this.mapId = crypto.randomUUID();
    this.mapName = 'Untitled Map';
    this.mapDescription = '';
    this.balanceConfig = undefined;
    this.createdAtTime = Date.now();
    this.undoManager.clear();
    this.rebuildAll();
  }

  /** Load an existing map for editing */
  loadMap(data: MapData): void {
    this.grid = buildGridFromMapData(data);
    this.startingPositions = [...data.startingPositions];
    this.clearEditorBuildings();
    this.roadNetwork = new RoadNetwork(this.grid);
    this.mapId = data.id;
    this.mapName = data.name;
    this.mapDescription = data.description;
    this.balanceConfig = data.balanceConfig;
    this.createdAtTime = data.createdAt;
    this.undoManager.clear();
    this.rebuildAll();

    // Restore pre-placed buildings
    if (data.buildings) {
      for (const b of data.buildings) {
        this.placeBuilding(b.type as BuildingType, b.q, b.r, b.playerId);
      }
    }
    // Restore flags and roads
    if (data.flags) {
      for (const f of data.flags) {
        this.placeFlag(f.q, f.r, f.playerId);
      }
    }
    if (data.roads) {
      for (const r of data.roads) {
        this.connectFlags(r.flagA.q, r.flagA.r, r.flagB.q, r.flagB.r);
      }
    }
  }

  /** Export current state as MapData */
  getMapData(thumbnail?: string): MapData {
    const data = exportGridToMapData(this.grid, {
      id: this.mapId,
      name: this.mapName,
      description: this.mapDescription,
      startingPositions: this.startingPositions,
      buildings: this.getEditorBuildings(),
      flags: this.getEditorFlags(),
      roads: this.getEditorRoads(),
      balanceConfig: this.balanceConfig,
      thumbnail,
    });
    data.createdAt = this.createdAtTime;
    return data;
  }

  /** Initialize: load assets, render map, set up camera */
  async start(): Promise<void> {
    await Promise.all([
      assetLoader.loadTerrainModels(),
      assetLoader.loadBuildingModels(),
    ]);
    this.mapRenderer.render(this.grid, this.scene);

    // Initialize trees from forest tiles
    this.treeRenderer.addToScene(this.scene);
    this.rebuildTrees();

    // Initialize building and road renderers
    this.buildingRenderer.addToScene(this.scene, this.grid);
    this.roadRenderer.addToScene(this.scene, this.grid);

    this.rebuildStartMarkers();

    // Position camera at map center
    const center = this.mapRenderer.getMapCenter(this.grid);
    const camOffset = new THREE.Vector3(20, 20, 20);
    this.camera.position.copy(center).add(camOffset);
    this.camera.lookAt(center);

    this.cameraController = new CameraController(this);

    // Start render loop
    const animate = (): void => {
      this.animationId = requestAnimationFrame(animate);
      this.cameraController?.update();
      // Sync trees if dirty (after terrain edits)
      this.treeRenderer.sync(this.treeManager, this.grid);
      // Sync roads each frame (lightweight if unchanged)
      this.roadRenderer.sync(this.roadNetwork);
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  /** Rebuild terrain after tile changes */
  rebuildTerrain(): void {
    this.mapRenderer.rebuild();
    this.rebuildTrees();
    this.onMapChanged?.();
  }

  /** Full rebuild (terrain + trees + buildings + roads + start markers + camera) */
  private rebuildAll(): void {
    if (this.cameraController) {
      this.cameraController.dispose();
      this.cameraController = null;
    }
    this.mapRenderer.render(this.grid, this.scene);
    this.rebuildTrees();

    // Re-init building and road renderers for the new grid
    this.buildingRenderer.addToScene(this.scene, this.grid);
    this.roadRenderer.addToScene(this.scene, this.grid);

    this.rebuildStartMarkers();

    const center = this.mapRenderer.getMapCenter(this.grid);
    const camOffset = new THREE.Vector3(20, 20, 20);
    this.camera.position.copy(center).add(camOffset);
    this.camera.lookAt(center);

    this.cameraController = new CameraController(this);
    this.onMapChanged?.();
  }

  /** Remove all editor buildings from the renderer */
  private clearEditorBuildings(): void {
    for (const key of this.editorBuildings.keys()) {
      this.buildingRenderer.removeBuilding(key);
    }
    this.editorBuildings.clear();
    this.nextEditorBuildingId = 1;
  }

  /** Reinitialize tree entities from forest tiles and trigger render sync */
  private rebuildTrees(): void {
    this.treeManager.initializeFromMap(this.grid);
    this.treeRenderer.markDirty();
  }

  /** Apply undo/redo tile snapshots to the grid */
  applySnapshots(snapshots: TileSnapshot[]): void {
    for (const snap of snapshots) {
      const deposit = snap.deposit
        ? { resource: snap.deposit.resource as import('../game/ResourceType').ResourceType, revealed: false, claimed: false }
        : undefined;
      this.grid.setTile(snap.q, snap.r, snap.terrain, snap.elevation, deposit);
    }
    this.rebuildTerrain();
  }

  /** Get a tile snapshot for undo tracking */
  getTileSnapshot(q: number, r: number): TileSnapshot | null {
    const tile = this.grid.getTile(q, r);
    if (!tile) return null;
    return {
      q: tile.coord.q,
      r: tile.coord.r,
      terrain: tile.terrain,
      elevation: tile.elevation,
      deposit: tile.deposit ? { resource: tile.deposit.resource } : undefined,
    };
  }

  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.cameraController?.dispose();
    this.mapRenderer.dispose();
    this.treeRenderer.dispose();
    this.buildingRenderer.dispose();
    this.roadRenderer.dispose();
    this.clearStartMarkers();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
    window.removeEventListener('resize', this.onResize);
    this.unbindPointerEvents();
  }

  // ─── Start Position Markers ────────────────────────────────────────────

  private clearStartMarkers(): void {
    for (const mesh of this.startMarkerMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.startMarkerMeshes = [];
  }

  private rebuildStartMarkers(): void {
    this.clearStartMarkers();
    for (const sp of this.startingPositions) {
      const { x, z } = HexGrid.hexToWorld(sp.q, sp.r);
      const tile = this.grid.getTile(sp.q, sp.r);
      const y = tile ? MapRenderer.getTileY(tile) + 0.15 : 0.15;

      const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.05, 16);
      const color = PLAYER_COLORS[sp.playerId - 1] ?? 0xffffff;
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.startMarkerMeshes.push(mesh);

      // Number label via sprite
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(sp.playerId), 32, 32);
      const tex = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(x, y + 0.5, z);
      sprite.scale.set(0.6, 0.6, 1);
      this.scene.add(sprite);
      // Store for cleanup (we'll treat sprites as mesh-like for disposal)
      this.startMarkerMeshes.push(sprite as unknown as THREE.Mesh);
    }
  }

  // ─── Pointer Events ───────────────────────────────────────────────────

  private pointerDownHandler = (e: PointerEvent): void => {
    if (e.button !== 0) return; // left click only
    const hex = this.hexPicker.screenToHex(
      e.clientX,
      e.clientY,
      this.camera,
      this.renderer.domElement,
    );
    if (hex && this.grid.isInBounds(hex.q, hex.r)) {
      this.isPointerDown = true;
      this.onPointerDown?.(hex.q, hex.r, e.altKey);
    }
  };

  private pointerMoveHandler = (e: PointerEvent): void => {
    const hex = this.hexPicker.screenToHex(
      e.clientX,
      e.clientY,
      this.camera,
      this.renderer.domElement,
    );
    if (hex && this.grid.isInBounds(hex.q, hex.r)) {
      this.onHoverHex?.(hex.q, hex.r);
      if (this.isPointerDown) {
        this.onPointerMove?.(hex.q, hex.r, e.altKey);
      }
    }
  };

  private pointerUpHandler = (): void => {
    if (this.isPointerDown) {
      this.isPointerDown = false;
      this.onPointerUp?.();
    }
  };

  private bindPointerEvents(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.pointerDownHandler);
    window.addEventListener('pointermove', this.pointerMoveHandler);
    window.addEventListener('pointerup', this.pointerUpHandler);
  }

  private unbindPointerEvents(): void {
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.pointerDownHandler);
    window.removeEventListener('pointermove', this.pointerMoveHandler);
    window.removeEventListener('pointerup', this.pointerUpHandler);
  }

  // ─── Resize ───────────────────────────────────────────────────────────

  private onResize = (): void => {
    this.width = this.container.clientWidth || window.innerWidth;
    this.height = this.container.clientHeight || window.innerHeight;
    const aspect = this.width / this.height;
    this.camera.left = -this.frustum * aspect;
    this.camera.right = this.frustum * aspect;
    this.camera.top = this.frustum;
    this.camera.bottom = -this.frustum;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  };

  // ─── Helpers ──────────────────────────────────────────────────────────

  private createBlankGrid(size: number): HexGrid {
    const grid = new HexGrid(size, size);
    for (let r = 0; r < size; r++) {
      for (let q = 0; q < size; q++) {
        grid.setTile(q, r, TerrainType.Grassland, 0.3);
      }
    }
    return grid;
  }
}
