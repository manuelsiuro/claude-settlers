/**
 * AudioAssetLoader — Loads audio manifest and lazily fetches/decodes AudioBuffers.
 *
 * Reads `public/audio/manifest.json` at startup. Individual .ogg files are
 * fetched on demand and cached with an LRU eviction policy.
 * Returns null gracefully for missing files so the game works with zero audio.
 */

export interface ManifestEntry {
  file: string;
  duration: number;
  loop: boolean;
  category: string;
  gameType?: string;
  gameTypeKind?: string;
  timeOfDay?: string[];
  terrain?: string;
}

export interface AudioManifest {
  version: number;
  files: Record<string, ManifestEntry>;
}

interface CacheEntry {
  buffer: AudioBuffer;
  size: number;
  lastUsed: number;
}

const MAX_CACHE_BYTES = 50 * 1024 * 1024; // 50MB
const AUDIO_BASE_PATH = 'audio/';

export class AudioAssetLoader {
  private ctx: AudioContext;
  private manifest: AudioManifest | null = null;
  private cache = new Map<string, CacheEntry>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private totalCacheSize = 0;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  /** Load the audio manifest. Safe to call multiple times. */
  async loadManifest(): Promise<void> {
    if (this.manifest) return;
    try {
      const resp = await fetch(AUDIO_BASE_PATH + 'manifest.json');
      if (!resp.ok) {
        this.manifest = { version: 1, files: {} };
        return;
      }
      this.manifest = await resp.json();
    } catch {
      // No manifest = no spatial audio, game continues normally
      this.manifest = { version: 1, files: {} };
    }
  }

  /** Check if manifest has any audio files. */
  hasAudio(): boolean {
    return this.manifest !== null && Object.keys(this.manifest.files).length > 0;
  }

  /** Get a manifest entry by sound ID. */
  getEntry(soundId: string): ManifestEntry | null {
    return this.manifest?.files[soundId] ?? null;
  }

  /** Get all manifest entries. */
  getAllEntries(): Record<string, ManifestEntry> {
    return this.manifest?.files ?? {};
  }

  /** Get entries matching a filter. */
  getEntriesByKind(gameTypeKind: string): [string, ManifestEntry][] {
    if (!this.manifest) return [];
    return Object.entries(this.manifest.files).filter(
      ([, e]) => e.gameTypeKind === gameTypeKind,
    );
  }

  /** Get entries by category. */
  getEntriesByCategory(category: string): [string, ManifestEntry][] {
    if (!this.manifest) return [];
    return Object.entries(this.manifest.files).filter(
      ([, e]) => e.category === category,
    );
  }

  /** Check if a sound ID is already loaded. */
  isLoaded(soundId: string): boolean {
    return this.cache.has(soundId);
  }

  /**
   * Get an AudioBuffer for a sound ID. Lazy-loads from network if not cached.
   * Returns null if the sound doesn't exist or fails to load.
   */
  async getBuffer(soundId: string): Promise<AudioBuffer | null> {
    // Return from cache
    const cached = this.cache.get(soundId);
    if (cached) {
      cached.lastUsed = performance.now();
      return cached.buffer;
    }

    // Deduplicate in-flight fetches
    const existing = this.loading.get(soundId);
    if (existing) return existing;

    const entry = this.getEntry(soundId);
    if (!entry) return null;

    const promise = this.fetchAndDecode(entry.file, soundId);
    this.loading.set(soundId, promise);

    try {
      return await promise;
    } finally {
      this.loading.delete(soundId);
    }
  }

  /** Preload a list of sound IDs (fire-and-forget). */
  preload(soundIds: string[]): void {
    for (const id of soundIds) {
      if (!this.cache.has(id) && !this.loading.has(id)) {
        this.getBuffer(id); // don't await
      }
    }
  }

  private async fetchAndDecode(
    filePath: string,
    soundId: string,
  ): Promise<AudioBuffer | null> {
    try {
      const resp = await fetch(AUDIO_BASE_PATH + filePath);
      if (!resp.ok) return null;

      const arrayBuffer = await resp.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

      const size = arrayBuffer.byteLength;
      this.evictIfNeeded(size);

      this.cache.set(soundId, {
        buffer: audioBuffer,
        size,
        lastUsed: performance.now(),
      });
      this.totalCacheSize += size;

      return audioBuffer;
    } catch {
      return null;
    }
  }

  /** Evict LRU entries until there's room for `neededBytes`. */
  private evictIfNeeded(neededBytes: number): void {
    while (this.totalCacheSize + neededBytes > MAX_CACHE_BYTES && this.cache.size > 0) {
      // Find least recently used
      let oldestKey = '';
      let oldestTime = Infinity;
      for (const [key, entry] of this.cache) {
        if (entry.lastUsed < oldestTime) {
          oldestTime = entry.lastUsed;
          oldestKey = key;
        }
      }
      if (!oldestKey) break;
      const entry = this.cache.get(oldestKey)!;
      this.totalCacheSize -= entry.size;
      this.cache.delete(oldestKey);
    }
  }

  dispose(): void {
    this.cache.clear();
    this.loading.clear();
    this.totalCacheSize = 0;
    this.manifest = null;
  }
}
