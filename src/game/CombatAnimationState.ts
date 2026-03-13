/**
 * Tracks visual state for active combat duels.
 * The actual game logic (winner/loser) is pre-computed, but visual resolution
 * plays out over ~2 seconds with approach → clash → recoil → result phases.
 */

export const DuelPhase = {
  Approach: 'approach',
  Clash: 'clash',
  Recoil: 'recoil',
  Result: 'result',
  Done: 'done',
} as const;

export type DuelPhase = (typeof DuelPhase)[keyof typeof DuelPhase];

export interface ActiveDuel {
  /** Attacking knight ID */
  attackerId: string;
  /** Defending knight ID */
  defenderId: string;
  /** Pre-computed winner ID */
  winnerId: string;
  /** Pre-computed loser ID */
  loserId: string;
  /** Current animation phase */
  phase: DuelPhase;
  /** Time spent in current phase */
  phaseTimer: number;
  /** Which clash hit we're on (0-based) */
  clashIndex: number;
  /** Total clash hits (2-4) */
  clashCount: number;
  /** Whether the winner ranked up */
  rankUp: boolean;
  /** World position of the duel (midpoint) */
  worldX: number;
  worldZ: number;
  worldY: number;
}

/** Phase durations in seconds */
const PHASE_DURATIONS: Record<string, number> = {
  [DuelPhase.Approach]: 0.5,
  [DuelPhase.Clash]: 0.3,
  [DuelPhase.Recoil]: 0.2,
  [DuelPhase.Result]: 0.8,
};

/** Create a new active duel */
export function createActiveDuel(
  attackerId: string,
  defenderId: string,
  winnerId: string,
  loserId: string,
  rankUp: boolean,
  worldX: number,
  worldZ: number,
  worldY: number,
): ActiveDuel {
  return {
    attackerId,
    defenderId,
    winnerId,
    loserId,
    phase: DuelPhase.Approach,
    phaseTimer: 0,
    clashIndex: 0,
    clashCount: 2 + Math.floor(Math.random() * 3), // 2-4 clashes
    rankUp,
    worldX,
    worldZ,
    worldY,
  };
}

/**
 * Advance the duel animation by deltaTime.
 * Returns true when the duel reaches Done phase.
 */
export function tickActiveDuel(duel: ActiveDuel, deltaTime: number): boolean {
  if (duel.phase === DuelPhase.Done) return true;

  duel.phaseTimer += deltaTime;
  const duration = PHASE_DURATIONS[duel.phase] ?? 0.5;

  if (duel.phaseTimer >= duration) {
    duel.phaseTimer -= duration;
    // Advance to next phase
    switch (duel.phase) {
      case DuelPhase.Approach:
        duel.phase = DuelPhase.Clash;
        break;
      case DuelPhase.Clash:
        duel.clashIndex++;
        if (duel.clashIndex >= duel.clashCount) {
          duel.phase = DuelPhase.Recoil;
        }
        // else stay in Clash for next hit
        break;
      case DuelPhase.Recoil:
        duel.phase = DuelPhase.Result;
        break;
      case DuelPhase.Result:
        duel.phase = DuelPhase.Done;
        return true;
    }
  }

  return false;
}

/** Get normalized progress within current phase (0..1) */
export function getDuelPhaseProgress(duel: ActiveDuel): number {
  const duration = PHASE_DURATIONS[duel.phase] ?? 0.5;
  return Math.min(1.0, duel.phaseTimer / duration);
}
