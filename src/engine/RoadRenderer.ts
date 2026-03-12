import * as THREE from 'three';
import { HexGrid } from '../game/HexGrid';
import type { Flag, Road } from '../game/RoadNetwork';
import type { RoadNetwork } from '../game/RoadNetwork';
import { MapRenderer } from './MapRenderer';
import { assetLoader } from './AssetLoader';
import type { ResourceModelName } from './AssetLoader';

/** Flag pole height */
const FLAG_HEIGHT = 0.6;
/** Flag banner color */
const FLAG_COLOR = 0xdd3333;
/** Flag pole color */
const POLE_COLOR = 0x8b4513;
/** Road line color */
const ROAD_COLOR = 0xc4a060;
/** Road line width - used for tube radius */
const ROAD_RADIUS = 0.04;
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
  private wrapGroups: { flags: THREE.Group; roads: THREE.Group }[] = [];
  private flagMeshes: Map<string, THREE.Group> = new Map();
  private roadMeshes: Map<string, THREE.Mesh> = new Map();
  private flagResourceMeshes: Map<string, THREE.Group> = new Map();
  private flagResourceFingerprints: Map<string, string> = new Map();
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

    // World wrapping
    const { wrapQ, wrapR } = grid.getWrapVectors();
    const multipliers = [
      { mq: -1, mr: 0 }, { mq: 1, mr: 0 },
      { mq: 0, mr: -1 }, { mq: 0, mr: 1 },
      { mq: -1, mr: -1 }, { mq: 1, mr: -1 },
      { mq: -1, mr: 1 }, { mq: 1, mr: 1 },
    ];

    for (const { mq, mr } of multipliers) {
      const flagGhost = new THREE.Group();
      const roadGhost = new THREE.Group();
      const offset = new THREE.Vector3(
        mq * wrapQ.x + mr * wrapR.x,
        0,
        mq * wrapQ.z + mr * wrapR.z,
      );
      flagGhost.position.copy(offset);
      roadGhost.position.copy(offset);
      flagGhost.name = `flags_ghost_${mq}_${mr}`;
      roadGhost.name = `roads_ghost_${mq}_${mr}`;
      scene.add(flagGhost);
      scene.add(roadGhost);
      this.wrapGroups.push({ flags: flagGhost, roads: roadGhost });
    }
  }

  /**
   * Sync the 3D scene with the current road network state.
   * Call each frame or when the network changes.
   */
  sync(network: RoadNetwork): void {
    const flags = network.getAllFlags();
    this.syncFlags(flags);
    this.syncRoads(network.getAllRoads(), network);
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

    // Add new roads
    for (const road of roads) {
      if (!this.roadMeshes.has(road.id)) {
        this.addRoad(road, network);
      }
    }

    // Remove deleted roads
    for (const id of this.roadMeshes.keys()) {
      if (!currentIds.has(id)) {
        this.removeRoad(id);
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

    // Ghost clones
    for (const { flags: ghost } of this.wrapGroups) {
      const clone = group.clone();
      clone.position.copy(group.position);
      ghost.add(clone);
    }
  }

  private removeFlag(id: string): void {
    const mesh = this.flagMeshes.get(id);
    if (mesh) {
      this.flagGroup.remove(mesh);
      this.disposeMesh(mesh);
      this.flagMeshes.delete(id);
    }

    // Remove from ghosts and dispose
    for (const { flags: ghost } of this.wrapGroups) {
      const child = ghost.children.find((c) => c.name === `flag_${id}`);
      if (child) {
        ghost.remove(child);
        if (child instanceof THREE.Group) this.disposeMesh(child);
      }
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

    // Create a tube between the two points
    const start = new THREE.Vector3(posA.x, yA, posA.z);
    const end = new THREE.Vector3(posB.x, yB, posB.z);
    const path = new THREE.LineCurve3(start, end);
    const tubeGeom = new THREE.TubeGeometry(path, 1, ROAD_RADIUS, 4, false);
    const tubeMat = new THREE.MeshLambertMaterial({ color: ROAD_COLOR });
    const mesh = new THREE.Mesh(tubeGeom, tubeMat);
    mesh.name = `road_${road.id}`;

    this.roadGroup.add(mesh);
    this.roadMeshes.set(road.id, mesh);

    // Ghost clones
    for (const { roads: ghost } of this.wrapGroups) {
      const clone = mesh.clone();
      ghost.add(clone);
    }
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
    }

    for (const { roads: ghost } of this.wrapGroups) {
      const child = ghost.children.find((c) => c.name === `road_${id}`);
      if (child) {
        ghost.remove(child);
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (child.material instanceof THREE.Material) child.material.dispose();
        }
      }
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

    // Ghost clones
    for (const { flags: ghost } of this.wrapGroups) {
      const clone = container.clone();
      clone.position.copy(container.position);
      ghost.add(clone);
    }
  }

  private removeFlagResources(flagId: string): void {
    const container = this.flagResourceMeshes.get(flagId);
    if (container) {
      this.flagGroup.remove(container);
      this.disposeMesh(container);
      this.flagResourceMeshes.delete(flagId);
    }

    // Remove from ghosts
    const name = `flag_resources_${flagId}`;
    for (const { flags: ghost } of this.wrapGroups) {
      const child = ghost.children.find((c) => c.name === name);
      if (child) {
        ghost.remove(child);
        if (child instanceof THREE.Group) this.disposeMesh(child);
      }
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

    this.flagGroup.removeFromParent();
    this.roadGroup.removeFromParent();
    for (const { flags, roads } of this.wrapGroups) {
      flags.removeFromParent();
      roads.removeFromParent();
    }
    this.wrapGroups = [];
  }
}
