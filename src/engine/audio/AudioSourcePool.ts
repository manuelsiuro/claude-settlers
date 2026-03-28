/**
 * AudioSourcePool — Manages and limits concurrent Web Audio sources.
 *
 * When the pool is full, the lowest-priority (farthest) source is evicted
 * to make room. Building sounds use composite keys to prevent duplicates.
 */

export interface ActiveSource {
  id: string;
  soundId: string;
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  pannerNode: PannerNode;
  priority: number;
  loop: boolean;
}

export class AudioSourcePool {
  private active = new Map<string, ActiveSource>();
  private maxConcurrent: number;
  private ctx: AudioContext;

  constructor(ctx: AudioContext, maxConcurrent: number) {
    this.ctx = ctx;
    this.maxConcurrent = maxConcurrent;
  }

  /** Create and register a new spatial audio source. Returns null if eviction fails. */
  acquire(
    id: string,
    soundId: string,
    buffer: AudioBuffer,
    loop: boolean,
    worldX: number,
    worldZ: number,
    volume: number,
    priority: number,
    spatialGain: GainNode,
    isDesktop: boolean,
  ): ActiveSource | null {
    // Already playing this ID
    if (this.active.has(id)) return null;

    // Evict if full
    if (this.active.size >= this.maxConcurrent) {
      const evicted = this.evictLowest(priority);
      if (!evicted) return null; // all sources are higher priority
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = volume;

    const pannerNode = this.ctx.createPanner();
    pannerNode.panningModel = isDesktop ? 'HRTF' : 'equalpower';
    pannerNode.distanceModel = 'inverse';
    pannerNode.refDistance = 1;
    pannerNode.maxDistance = 30;
    pannerNode.rolloffFactor = 2;
    pannerNode.positionX.value = worldX;
    pannerNode.positionY.value = 0;
    pannerNode.positionZ.value = worldZ;

    source.connect(gainNode).connect(pannerNode).connect(spatialGain);

    const entry: ActiveSource = {
      id,
      soundId,
      source,
      gainNode,
      pannerNode,
      priority,
      loop,
    };

    this.active.set(id, entry);

    // Auto-release on completion (one-shot sounds)
    if (!loop) {
      source.addEventListener('ended', () => {
        this.active.delete(id);
      });
    }

    source.start();
    return entry;
  }

  /** Stop and release a source by ID. Optionally fade out. */
  release(id: string, fadeMs = 0): void {
    const entry = this.active.get(id);
    if (!entry) return;

    if (fadeMs > 0) {
      const t = this.ctx.currentTime;
      entry.gainNode.gain.setValueAtTime(entry.gainNode.gain.value, t);
      entry.gainNode.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
      entry.source.stop(t + fadeMs / 1000 + 0.05);
    } else {
      try {
        entry.source.stop();
      } catch {
        // Already stopped
      }
    }

    this.active.delete(id);
  }

  /** Update the position of an active source (for moving units). */
  updatePosition(id: string, worldX: number, worldZ: number): void {
    const entry = this.active.get(id);
    if (!entry) return;
    entry.pannerNode.positionX.value = worldX;
    entry.pannerNode.positionZ.value = worldZ;
  }

  /** Update the volume of an active source. */
  updateVolume(id: string, volume: number): void {
    const entry = this.active.get(id);
    if (!entry) return;
    entry.gainNode.gain.value = volume;
  }

  /** Update priority of an active source. */
  updatePriority(id: string, priority: number): void {
    const entry = this.active.get(id);
    if (entry) entry.priority = priority;
  }

  /** Check if a source ID is currently active. */
  has(id: string): boolean {
    return this.active.has(id);
  }

  /** Get the number of active sources. */
  getActiveCount(): number {
    return this.active.size;
  }

  /** Get all active source IDs. */
  getActiveIds(): string[] {
    return Array.from(this.active.keys());
  }

  /** Release all sources immediately. */
  releaseAll(): void {
    for (const [id] of this.active) {
      this.release(id);
    }
  }

  /** Evict the lowest-priority source if its priority is below minPriority. */
  private evictLowest(minPriority: number): boolean {
    let lowestKey = '';
    let lowestPriority = Infinity;

    for (const [key, entry] of this.active) {
      if (entry.priority < lowestPriority) {
        lowestPriority = entry.priority;
        lowestKey = key;
      }
    }

    if (!lowestKey || lowestPriority >= minPriority) return false;

    this.release(lowestKey, 100); // Quick 100ms fade
    return true;
  }
}
