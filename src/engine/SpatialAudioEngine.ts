/**
 * SpatialAudioEngine — Manifest-driven spatial audio for buildings, units, and ambience.
 *
 * Reads public/audio/manifest.json at startup, indexes entries by gameType,
 * and plays positioned sounds based on camera proximity. Zero TypeScript
 * mappings needed — adding new sounds is purely data-driven.
 *
 * Integration: instantiated in GameSystems.createRenderers(), updated in
 * Game.ts animate loop after ambient renderers (~line 635).
 */

import * as THREE from 'three';
import type { AudioManager } from './AudioManager';
import { AudioAssetLoader, type ManifestEntry } from './AudioAssetLoader';
import { AudioSourcePool } from './audio/AudioSourcePool';
import { AmbientSoundscape } from './audio/AmbientSoundscape';
import type { GameState } from '../game/GameState';
import { BuildingState } from '../game/Building';
import { UnitState } from '../game/Unit';
import { HexGrid } from '../game/HexGrid';

/** Desktop vs mobile performance tier. */
const isDesktop =
  typeof window !== 'undefined' && !('ontouchstart' in window) && window.innerWidth > 768;

const MAX_SOURCES = isDesktop ? 48 : 24;
const CULL_DISTANCE = isDesktop ? 15 : 10;
const UPDATE_INTERVAL = isDesktop ? 10 : 15; // frames between full scans

export class SpatialAudioEngine {
  private audioManager: AudioManager;
  private assetLoader: AudioAssetLoader;
  private sourcePool: AudioSourcePool;
  private ambientSoundscape: AmbientSoundscape;

  // Manifest-driven indexes (built from manifest.json at load time)
  private buildingSoundMap = new Map<string, ManifestEntry & { soundId: string }>();
  private unitSoundMap = new Map<string, ManifestEntry & { soundId: string }>();

  // State tracking
  private enabled = true;
  private initialized = false;
  private frameCounter = 0;

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager;

    const ctx = audioManager.getContext();
    this.assetLoader = new AudioAssetLoader(ctx);
    this.sourcePool = new AudioSourcePool(ctx, MAX_SOURCES);
    this.ambientSoundscape = new AmbientSoundscape(
      ctx,
      audioManager.getAmbientGain(),
      this.assetLoader,
    );
  }

  /** Initialize: load manifest and build indexes. */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.assetLoader.loadManifest();

    if (!this.assetLoader.hasAudio()) {
      // No audio files — engine becomes a no-op
      this.initialized = true;
      return;
    }

    // Build building sound index from manifest
    for (const [soundId, entry] of this.assetLoader.getEntriesByKind('building')) {
      if (entry.gameType) {
        this.buildingSoundMap.set(entry.gameType, { ...entry, soundId });
      }
    }

    // Build unit sound index from manifest
    for (const [soundId, entry] of this.assetLoader.getEntriesByKind('unit')) {
      if (entry.gameType) {
        // Use the first match per gameType (production > ambient > combat)
        if (!this.unitSoundMap.has(entry.gameType)) {
          this.unitSoundMap.set(entry.gameType, { ...entry, soundId });
        }
      }
    }

    this.initialized = true;
  }

  /**
   * Main update — called every frame from Game.ts animate loop.
   *
   * Spatial scans happen every UPDATE_INTERVAL frames for performance.
   * Ambient soundscape updates every call (lightweight).
   */
  update(
    _rawDelta: number,
    _deltaTime: number,
    cameraPosition: THREE.Vector3,
    gameState: GameState,
    phase: string,
    nightness: number,
    weather: string,
    paused: boolean,
  ): void {
    if (!this.enabled || !this.initialized || !this.assetLoader.hasAudio()) return;

    // Ambient soundscape updates every frame (lightweight cross-fading)
    this.ambientSoundscape.update(phase, weather, nightness);

    // Spatial sounds: throttled scan
    this.frameCounter++;
    if (this.frameCounter >= UPDATE_INTERVAL) {
      this.frameCounter = 0;
      this.updateSpatialSounds(cameraPosition, gameState, paused, nightness);
    }
  }

  /** Scan nearby buildings and units, start/stop spatial sounds. */
  private updateSpatialSounds(
    cameraPosition: THREE.Vector3,
    gameState: GameState,
    paused: boolean,
    nightness: number,
  ): void {
    const camX = cameraPosition.x;
    const camZ = cameraPosition.z;

    // --- Building sounds ---
    this.updateBuildingSounds(gameState, camX, camZ, paused, nightness);

    // --- Unit sounds ---
    this.updateUnitSounds(gameState, camX, camZ, paused);
  }

  private updateBuildingSounds(
    gameState: GameState,
    camX: number,
    camZ: number,
    paused: boolean,
    nightness: number,
  ): void {
    const buildings = gameState.getAllBuildings();
    const activeBuildingIds = new Set<string>();

    for (const building of buildings) {
      const soundEntry = this.buildingSoundMap.get(building.type);
      if (!soundEntry) continue;

      const world = HexGrid.hexToWorld(building.coord.q, building.coord.r);
      const dx = world.x - camX;
      const dz = world.z - camZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > CULL_DISTANCE * 1.732) continue; // hex units to world approx

      const poolKey = `building_${building.id}`;
      activeBuildingIds.add(poolKey);

      // Should this building be making sound?
      const isActive = building.state === BuildingState.Active;
      const shouldPlay = isActive && !paused;

      if (shouldPlay && !this.sourcePool.has(poolKey)) {
        // Start playing
        const priority = 1.0 / (1.0 + dist);
        const volume = this.calcVolume(dist, nightness);

        this.startSound(
          poolKey,
          soundEntry.soundId,
          soundEntry.loop,
          world.x,
          world.z,
          volume,
          priority,
        );
      } else if (shouldPlay && this.sourcePool.has(poolKey)) {
        // Update volume/priority based on new distance
        const priority = 1.0 / (1.0 + dist);
        const volume = this.calcVolume(dist, nightness);
        this.sourcePool.updateVolume(poolKey, volume);
        this.sourcePool.updatePriority(poolKey, priority);
      } else if (!shouldPlay && this.sourcePool.has(poolKey)) {
        // Fade out
        this.sourcePool.release(poolKey, 200);
      }
    }

    // Stop sounds for buildings that are gone or out of range
    for (const activeId of this.sourcePool.getActiveIds()) {
      if (activeId.startsWith('building_') && !activeBuildingIds.has(activeId)) {
        this.sourcePool.release(activeId, 200);
      }
    }
  }

  private updateUnitSounds(
    gameState: GameState,
    camX: number,
    camZ: number,
    paused: boolean,
  ): void {
    const units = gameState.getAllUnits();
    const activeUnitIds = new Set<string>();

    for (const unit of units) {
      const soundEntry = this.unitSoundMap.get(unit.type);
      if (!soundEntry) continue;

      const world = HexGrid.hexToWorld(unit.coord.q, unit.coord.r);
      const dx = world.x - camX;
      const dz = world.z - camZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > CULL_DISTANCE * 1.732) continue;

      const poolKey = `unit_${unit.id}`;
      activeUnitIds.add(poolKey);

      // Units make sound when working (not walking, idle, etc.)
      const isWorking = unit.state === UnitState.Working || unit.state === UnitState.Fighting;
      const shouldPlay = isWorking && !paused;

      if (shouldPlay && !this.sourcePool.has(poolKey)) {
        const priority = 1.0 / (1.0 + dist);
        const volume = this.calcVolume(dist, 0); // Units not affected by nightness

        this.startSound(
          poolKey,
          soundEntry.soundId,
          soundEntry.loop,
          world.x,
          world.z,
          volume,
          priority,
        );
      } else if (shouldPlay && this.sourcePool.has(poolKey)) {
        const priority = 1.0 / (1.0 + dist);
        const volume = this.calcVolume(dist, 0);
        this.sourcePool.updatePosition(poolKey, world.x, world.z);
        this.sourcePool.updateVolume(poolKey, volume);
        this.sourcePool.updatePriority(poolKey, priority);
      } else if (!shouldPlay && this.sourcePool.has(poolKey)) {
        this.sourcePool.release(poolKey, 100);
      }
    }

    // Stop sounds for units that are gone or out of range
    for (const activeId of this.sourcePool.getActiveIds()) {
      if (activeId.startsWith('unit_') && !activeUnitIds.has(activeId)) {
        this.sourcePool.release(activeId, 100);
      }
    }
  }

  /** Start a spatial sound via the source pool. */
  private async startSound(
    poolKey: string,
    soundId: string,
    loop: boolean,
    worldX: number,
    worldZ: number,
    volume: number,
    priority: number,
  ): Promise<void> {
    const buffer = await this.assetLoader.getBuffer(soundId);
    if (!buffer) return;

    this.sourcePool.acquire(
      poolKey,
      soundId,
      buffer,
      loop,
      worldX,
      worldZ,
      volume,
      priority,
      this.audioManager.getSpatialGain(),
      isDesktop,
    );
  }

  /** Calculate volume with quadratic distance falloff and night reduction. */
  private calcVolume(dist: number, nightness: number): number {
    const maxDist = CULL_DISTANCE * 1.732;
    const normalized = Math.min(dist / maxDist, 1.0);
    const distVolume = (1.0 - normalized) * (1.0 - normalized); // Quadratic falloff

    // Night: buildings at 75% volume (matching 25% production slowdown)
    const nightFactor = 1.0 - 0.25 * nightness;

    return distVolume * nightFactor;
  }

  /** Play a one-shot spatial sound at a world position (e.g., combat). */
  async playSpatialOneShot(
    soundId: string,
    worldX: number,
    worldZ: number,
  ): Promise<void> {
    if (!this.enabled || !this.initialized) return;

    const buffer = await this.assetLoader.getBuffer(soundId);
    if (!buffer) return;

    const poolKey = `oneshot_${soundId}_${Date.now()}`;
    this.sourcePool.acquire(
      poolKey,
      soundId,
      buffer,
      false,
      worldX,
      worldZ,
      0.8,
      0.5,
      this.audioManager.getSpatialGain(),
      isDesktop,
    );
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.ambientSoundscape.setEnabled(enabled);
    if (!enabled) {
      this.sourcePool.releaseAll();
    }
  }

  dispose(): void {
    this.sourcePool.releaseAll();
    this.ambientSoundscape.dispose();
    this.assetLoader.dispose();
  }
}
