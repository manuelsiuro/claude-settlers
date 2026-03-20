import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import type { Flag, Road } from '../game/RoadNetwork';
import type { RoadNetwork } from '../game/RoadNetwork';
import type { Unit } from '../game/Unit';
import { MapRenderer } from './MapRenderer';
import { assetLoader } from './AssetLoader';
import type { ResourceModelName } from './AssetLoader';

/** Flag pole height */
const FLAG_HEIGHT = 0.6;
/** Flag banner color */
const FLAG_COLOR = 0xdd3333;
/** Flag pole color */
const POLE_COLOR = 0x8b4513;
/** Road base colors by quality level (0=path, 1=dirt, 2=stone, 3=paved) */
const ROAD_QUALITY_COLORS = [0xc4a060, 0xb08840, 0x909090, 0x707878];
/** Road tube radius by quality level */
const ROAD_QUALITY_RADII = [0.035, 0.045, 0.055, 0.065];
/** Road color when transporter is actively carrying goods */
const ROAD_COLOR_ACTIVE = 0x4caf50;
/** Road color when no transporter is assigned yet */
const ROAD_COLOR_UNASSIGNED = 0x999999;

/** Traffic state for a road segment */
type TrafficState = 'unassigned' | 'idle' | 'active';

/** Lookup function to get a unit by ID */
export type UnitLookup = (id: string) => (Pick<Unit, 'carryingResource'>) | undefined;
/** Scale for resource models at flags */
const FLAG_RESOURCE_SCALE = 0.9;
/** Y offset for resource models at flags */
const FLAG_RESOURCE_Y = 0.02;
/** Radius of the circle resources are arranged in around flag pole */
const FLAG_RESOURCE_RADIUS = 0.18;

/**
 * Renders flags and roads on the hex map.
 * Flags are simple pole + banner meshes.
 * Roads are lines/tubes connecting flag positions.
 */
export class RoadRenderer {
  private flagGroup: THREE.Group;
  private roadGroup: THREE.Group;
  private flagMeshes: Map<string, THREE.Group> = new Map();
  private roadMeshes: Map<string, THREE.Mesh> = new Map();
  private flagResourceMeshes: Map<string, THREE.Group> = new Map();
  private flagResourceFingerprints: Map<string, string> = new Map();
  /** Cached traffic state per road to avoid unnecessary material updates */
  private roadTrafficStates: Map<string, TrafficState> = new Map();
  /** Cached road quality to detect upgrades and rebuild mesh */
  private roadQualities: Map<string, number> = new Map();
  private grid: HexGrid;

  constructor() {
    this.flagGroup = new THREE.Group();
    this.flagGroup.name = 'flags';
    this.roadGroup = new THREE.Group();
    this.roadGroup.name = 'roads';
    this.grid = new HexGrid(1, 1);
  }

  addToScene(scene: THREE.Scene, grid: HexGrid): void {
    this.grid = grid;
    scene.add(this.flagGroup);
    scene.add(this.roadGroup);
  }

  /**
   * Sync the 3D scene with the current road network state.
   * Call each frame or when the network changes.
   * @param unitLookup Optional function to look up units by ID for traffic coloring.
   *   When provided, roads are colored based on traffic activity:
   *   - Green: transporter actively carrying goods
   *   - Default (sandy): transporter assigned but idle
   *   - Grey: no transporter assigned yet
   */
  sync(network: RoadNetwork, unitLookup?: UnitLookup): void {
    const flags = network.getAllFlags();
    const roads = network.getAllRoads();
    this.syncFlags(flags);
    this.syncRoads(roads, network);
    if (unitLookup) {
      this.syncRoadTraffic(roads, unitLookup);
    }
    this.syncFlagResources(flags);
  }

  private syncFlags(flags: Flag[]): void {
    const currentIds = new Set(flags.map((f) => f.id));

    // Add new flags
    for (const flag of flags) {
      if (!this.flagMeshes.has(flag.id)) {
        this.addFlag(flag);
      }
    }

    // Remove deleted flags
    for (const id of this.flagMeshes.keys()) {
      if (!currentIds.has(id)) {
        this.removeFlag(id);
      }
    }
  }

  private syncRoads(roads: Road[], network: RoadNetwork): void {
    const currentIds = new Set(roads.map((r) => r.id));

    // Add new roads or rebuild if quality changed
    for (const road of roads) {
      const existingQuality = this.roadQualities.get(road.id);
      if (!this.roadMeshes.has(road.id)) {
        this.addRoad(road, network);
        this.roadQualities.set(road.id, road.quality);
      } else if (existingQuality !== undefined && existingQuality !== road.quality) {
        // Quality changed — rebuild mesh with new radius/color
        this.removeRoad(road.id);
        this.addRoad(road, network);
        this.roadQualities.set(road.id, road.quality);
      }
    }

    // Remove deleted roads
    for (const id of this.roadMeshes.keys()) {
      if (!currentIds.has(id)) {
        this.removeRoad(id);
        this.roadQualities.delete(id);
      }
    }
  }

  /** Determine the traffic state for a road segment */
  private getTrafficState(road: Road, unitLookup: UnitLookup): TrafficState {
    if (!road.transporterId) return 'unassigned';
    const unit = unitLookup(road.transporterId);
    if (unit?.carryingResource) return 'active';
    return 'idle';
  }

  /** Get the color for a given traffic state and road quality */
  private getTrafficColor(state: TrafficState, quality: number): number {
    switch (state) {
      case 'active': return ROAD_COLOR_ACTIVE;
      case 'unassigned': return ROAD_COLOR_UNASSIGNED;
      default: return ROAD_QUALITY_COLORS[quality] ?? ROAD_QUALITY_COLORS[0];
    }
  }

  /**
   * Update road colors based on transporter traffic activity.
   * Only updates materials when the traffic state actually changes.
   */
  private syncRoadTraffic(roads: Road[], unitLookup: UnitLookup): void {
    for (const road of roads) {
      const mesh = this.roadMeshes.get(road.id);
      if (!mesh) continue;

      const newState = this.getTrafficState(road, unitLookup);
      const oldState = this.roadTrafficStates.get(road.id);

      if (newState === oldState) continue;

      this.roadTrafficStates.set(road.id, newState);
      const color = this.getTrafficColor(newState, road.quality ?? 0);

      // Update main mesh material color
      if (mesh.material instanceof THREE.MeshLambertMaterial) {
        mesh.material.color.setHex(color);
      }
    }
  }

  private addFlag(flag: Flag): void {
    const group = new THREE.Group();

    // Pole
    const poleGeom = new THREE.CylinderGeometry(0.02, 0.02, FLAG_HEIGHT, 4);
    const poleMat = new THREE.MeshLambertMaterial({ color: POLE_COLOR });
    const pole = new THREE.Mesh(poleGeom, poleMat);
    pole.position.y = FLAG_HEIGHT / 2;
    group.add(pole);

    // Banner (small triangular flag)
    const bannerGeom = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, FLAG_HEIGHT, 0,           // top of pole
      0.15, FLAG_HEIGHT - 0.05, 0, // right tip
      0, FLAG_HEIGHT - 0.12, 0,    // bottom
    ]);
    bannerGeom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    bannerGeom.computeVertexNormals();
    const bannerMat = new THREE.MeshLambertMaterial({ color: FLAG_COLOR, side: THREE.DoubleSide });
    const banner = new THREE.Mesh(bannerGeom, bannerMat);
    group.add(banner);

    // Position on hex
    const { x, z } = HexGrid.hexToWorld(flag.coord.q, flag.coord.r);
    const tile = this.grid.getTile(flag.coord.q, flag.coord.r);
    const y = tile ? MapRenderer.getTileY(tile) : 0;
    group.position.set(x, y, z);
    group.name = `flag_${flag.id}`;

    this.flagGroup.add(group);
    this.flagMeshes.set(flag.id, group);
  }

  private removeFlag(id: string): void {
    const mesh = this.flagMeshes.get(id);
    if (mesh) {
      this.flagGroup.remove(mesh);
      this.disposeMesh(mesh);
      this.flagMeshes.delete(id);
    }
  }

  private addRoad(road: Road, network: RoadNetwork): void {
    const flagA = network.getFlag(road.flagA);
    const flagB = network.getFlag(road.flagB);
    if (!flagA || !flagB) return;

    const posA = HexGrid.hexToWorld(flagA.coord.q, flagA.coord.r);
    const posB = HexGrid.hexToWorld(flagB.coord.q, flagB.coord.r);
    const tileA = this.grid.getTile(flagA.coord.q, flagA.coord.r);
    const tileB = this.grid.getTile(flagB.coord.q, flagB.coord.r);
    const yA = tileA ? MapRenderer.getTileY(tileA) + 0.03 : 0.03;
    const yB = tileB ? MapRenderer.getTileY(tileB) + 0.03 : 0.03;

    // Create a tube between the two points, sized/colored by road quality
    const quality = road.quality ?? 0;
    const radius = ROAD_QUALITY_RADII[quality] ?? ROAD_QUALITY_RADII[0];
    const baseColor = ROAD_QUALITY_COLORS[quality] ?? ROAD_QUALITY_COLORS[0];
    const start = new THREE.Vector3(posA.x, yA, posA.z);
    const end = new THREE.Vector3(posB.x, yB, posB.z);
    const path = new THREE.LineCurve3(start, end);
    const segments = quality >= 2 ? 3 : 1; // smoother tubes for stone/paved
    const tubeGeom = new THREE.TubeGeometry(path, segments, radius, quality >= 2 ? 6 : 4, false);
    const tubeMat = new THREE.MeshLambertMaterial({ color: baseColor });
    const mesh = new THREE.Mesh(tubeGeom, tubeMat);
    mesh.name = `road_${road.id}`;

    this.roadGroup.add(mesh);
    this.roadMeshes.set(road.id, mesh);
  }

  private removeRoad(id: string): void {
    const mesh = this.roadMeshes.get(id);
    if (mesh) {
      this.roadGroup.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
      this.roadMeshes.delete(id);
      this.roadTrafficStates.delete(id);
    }
  }

  private syncFlagResources(flags: Flag[]): void {
    const currentIds = new Set<string>();

    for (const flag of flags) {
      currentIds.add(flag.id);

      // Build fingerprint from sorted resource types
      const fingerprint = flag.goods.length > 0
        ? flag.goods.map((g) => g.resource).sort().join(',')
        : '';

      const cached = this.flagResourceFingerprints.get(flag.id);
      if (cached === fingerprint) continue; // No change

      // Remove old resource meshes
      this.removeFlagResources(flag.id);

      if (fingerprint) {
        this.addFlagResources(flag);
        this.flagResourceFingerprints.set(flag.id, fingerprint);
      } else {
        this.flagResourceFingerprints.delete(flag.id);
      }
    }

    // Remove resources for deleted flags
    for (const id of this.flagResourceFingerprints.keys()) {
      if (!currentIds.has(id)) {
        this.removeFlagResources(id);
        this.flagResourceFingerprints.delete(id);
      }
    }
  }

  private addFlagResources(flag: Flag): void {
    const container = new THREE.Group();
    container.name = `flag_resources_${flag.id}`;

    const { x, z } = HexGrid.hexToWorld(flag.coord.q, flag.coord.r);
    const tile = this.grid.getTile(flag.coord.q, flag.coord.r);
    const y = tile ? MapRenderer.getTileY(tile) : 0;
    container.position.set(x, y, z);

    const count = flag.goods.length;
    for (let i = 0; i < count; i++) {
      const good = flag.goods[i];
      const mesh = assetLoader.getResourceModel(good.resource as ResourceModelName);
      if (!mesh) continue;

      mesh.scale.setScalar(FLAG_RESOURCE_SCALE);

      // Arrange in a circle around the flag pole
      const angle = (i / count) * Math.PI * 2;
      mesh.position.set(
        Math.cos(angle) * FLAG_RESOURCE_RADIUS,
        FLAG_RESOURCE_Y,
        Math.sin(angle) * FLAG_RESOURCE_RADIUS,
      );

      container.add(mesh);
    }

    this.flagGroup.add(container);
    this.flagResourceMeshes.set(flag.id, container);
  }

  private removeFlagResources(flagId: string): void {
    const container = this.flagResourceMeshes.get(flagId);
    if (container) {
      this.flagGroup.remove(container);
      this.disposeMesh(container);
      this.flagResourceMeshes.delete(flagId);
    }
  }

  private disposeMesh(group: THREE.Group): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }

  dispose(): void {
    for (const mesh of this.flagMeshes.values()) {
      this.disposeMesh(mesh);
    }
    this.flagMeshes.clear();

    for (const mesh of this.roadMeshes.values()) {
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    }
    this.roadMeshes.clear();

    for (const mesh of this.flagResourceMeshes.values()) {
      this.disposeMesh(mesh);
    }
    this.flagResourceMeshes.clear();
    this.flagResourceFingerprints.clear();
    this.roadTrafficStates.clear();
    this.roadQualities.clear();

    this.flagGroup.removeFromParent();
    this.roadGroup.removeFromParent();
  }
}
