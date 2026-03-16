import type { DuelResult } from './CombatManager';
import type { CombatManager } from './CombatManager';
import type { GameState } from './GameState';
import type { ActiveDuel } from './CombatAnimationState';
import { createActiveDuel, tickActiveDuel } from './CombatAnimationState';
import { HexGrid } from './HexGrid';
import { UnitState } from './Unit';

/**
 * Bridges AttackManager (game logic) and CombatRenderer (visuals) by managing
 * animated duel lifecycles. Pre-computes duel outcomes, plays ~2s animations,
 * then returns completed results for the caller to apply.
 */
export class DuelAnimationManager {
  /** Active duels the CombatRenderer consumes */
  private activeDuels: ActiveDuel[] = [];

  /** Pre-computed results keyed by attackerId */
  private pendingResults: Map<string, DuelResult> = new Map();

  /** Knight IDs currently in an animated duel */
  private duelParticipants: Set<string> = new Set();

  /**
   * Start an animated duel between two knights.
   * Pre-computes the outcome but defers applying it until the animation completes.
   *
   * @returns true if the duel was started, false if invalid
   */
  startDuel(
    attackerId: string,
    defenderId: string,
    combatManager: CombatManager,
    gameState: GameState,
    getWorldY: (q: number, r: number) => number,
  ): boolean {
    // Don't start if either knight is already in a duel
    if (this.duelParticipants.has(attackerId) || this.duelParticipants.has(defenderId)) {
      return false;
    }

    const result = combatManager.preComputeDuel(attackerId, defenderId);
    if (!result) return false;

    // Compute world midpoint between the two knights
    const attacker = gameState.getUnit(attackerId);
    const defender = gameState.getUnit(defenderId);
    if (!attacker || !defender) return false;

    const posA = HexGrid.hexToWorld(attacker.coord.q, attacker.coord.r);
    const posD = HexGrid.hexToWorld(defender.coord.q, defender.coord.r);
    const worldX = (posA.x + posD.x) / 2;
    const worldZ = (posA.z + posD.z) / 2;

    // Use average of both positions for Y
    const yA = getWorldY(attacker.coord.q, attacker.coord.r);
    const yD = getWorldY(defender.coord.q, defender.coord.r);
    const worldY = (yA + yD) / 2;

    const duel = createActiveDuel(
      attackerId,
      defenderId,
      result.winnerId,
      result.loserId,
      result.rankUp,
      worldX,
      worldZ,
      worldY,
    );

    this.activeDuels.push(duel);
    this.pendingResults.set(attackerId, result);
    this.duelParticipants.add(attackerId);
    this.duelParticipants.add(defenderId);

    // Set both units to Fighting state
    attacker.state = UnitState.Fighting;
    defender.state = UnitState.Fighting;

    return true;
  }

  /**
   * Tick all active duels. Returns completed duels whose results
   * should be applied by the caller.
   */
  update(deltaTime: number): { attackerId: string; result: DuelResult }[] {
    const completed: { attackerId: string; result: DuelResult }[] = [];

    for (let i = this.activeDuels.length - 1; i >= 0; i--) {
      const duel = this.activeDuels[i];
      // tickActiveDuel only advances one phase transition per call,
      // so loop to consume all leftover time (e.g. large deltaTime values).
      // Limit iterations to prevent infinite loops.
      let done = tickActiveDuel(duel, deltaTime);
      if (!done) {
        for (let j = 0; j < 20 && !done; j++) {
          const prevTimer = duel.phaseTimer;
          done = tickActiveDuel(duel, 0);
          // If phaseTimer didn't change and not done, no more progress possible
          if (!done && duel.phaseTimer === prevTimer) break;
        }
      }

      if (done) {
        const result = this.pendingResults.get(duel.attackerId);
        if (result) {
          completed.push({ attackerId: duel.attackerId, result });
          this.pendingResults.delete(duel.attackerId);
        }
        this.duelParticipants.delete(duel.attackerId);
        this.duelParticipants.delete(duel.defenderId);
        this.activeDuels.splice(i, 1);
      }
    }

    return completed;
  }

  /** Check if a knight is currently in an animated duel */
  isInDuel(knightId: string): boolean {
    return this.duelParticipants.has(knightId);
  }

  /** Get the active duels array for CombatRenderer to consume */
  getActiveDuels(): readonly ActiveDuel[] {
    return this.activeDuels;
  }

  /** Serialization: duels are ephemeral (~2s), safe to discard */
  _getState(): Record<string, never> {
    return {};
  }

  /** Serialization: no-op, duels are ephemeral */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _loadState(_state: Record<string, never>): void {
    // Duels are ~2s ephemeral animations; safe to discard on save/load
  }
}
