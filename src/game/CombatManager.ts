import type { GameState } from './GameState';
import type { KnightManager } from './KnightManager';
import type { Unit } from './Unit';
import { UnitType } from './UnitType';

/**
 * Result of a single 1v1 duel between two knights.
 */
export interface DuelResult {
  winnerId: string;
  loserId: string;
  /** Whether the winner gained a rank from this duel */
  rankUp: boolean;
}

/**
 * Manages 1v1 combat between knights.
 *
 * Combat rules:
 *   - Each knight's effective strength = rank × goldBonus
 *   - Higher strength has a higher probability of winning
 *   - Probability = attackerStrength / (attackerStrength + defenderStrength)
 *   - Winner gains XP — every 2 combat wins advances rank (up to 5)
 *   - Loser is removed from the game
 */
export class CombatManager {
  private gameState: GameState;
  private knightManager: KnightManager;

  /** Track combat wins per knight for rank advancement */
  private combatWins: Map<string, number> = new Map();

  /** Wins required per rank advancement */
  private static WINS_PER_RANK = 2;

  /** Random function (injectable for testing) */
  random: () => number = Math.random;

  constructor(gameState: GameState, knightManager: KnightManager) {
    this.gameState = gameState;
    this.knightManager = knightManager;
  }

  /**
   * Resolve a 1v1 duel between two knights.
   * The knight with higher strength has a higher probability of winning.
   * The loser is removed from the game.
   * The winner may gain a rank.
   */
  resolveDuel(attackerId: string, defenderId: string): DuelResult | null {
    const attacker = this.gameState.getUnit(attackerId);
    const defender = this.gameState.getUnit(defenderId);

    if (!attacker || !defender) return null;
    if (attacker.type !== UnitType.Knight || defender.type !== UnitType.Knight) return null;

    const attackerStrength = this.knightManager.getKnightStrength(attackerId);
    const defenderStrength = this.knightManager.getKnightStrength(defenderId);

    // Probability that attacker wins
    const totalStrength = attackerStrength + defenderStrength;
    const attackerWinProb = totalStrength > 0 ? attackerStrength / totalStrength : 0.5;

    const roll = this.random();
    const attackerWins = roll < attackerWinProb;

    const winnerId = attackerWins ? attackerId : defenderId;
    const loserId = attackerWins ? defenderId : attackerId;
    const winner = attackerWins ? attacker : defender;

    // Remove loser
    this.removeCombatant(loserId);

    // Award win and check rank up
    const rankUp = this.awardWin(winner);

    return { winnerId, loserId, rankUp };
  }

  /**
   * Remove a knight from the game and its building's knight list.
   */
  private removeCombatant(knightId: string): void {
    const knight = this.gameState.getUnit(knightId);
    if (!knight) return;

    // Remove from building's knight list
    if (knight.assignedBuildingId) {
      const building = this.gameState.getBuilding(knight.assignedBuildingId);
      if (building) {
        building.knightIds = building.knightIds.filter((id) => id !== knightId);
      }
    }

    this.gameState.removeUnit(knightId);
    this.combatWins.delete(knightId);
  }

  /**
   * Award a combat win and potentially advance rank.
   * Returns true if the knight ranked up.
   */
  private awardWin(knight: Unit): boolean {
    const wins = (this.combatWins.get(knight.id) ?? 0) + 1;
    this.combatWins.set(knight.id, wins);

    if (wins >= CombatManager.WINS_PER_RANK && knight.knightRank < 5) {
      knight.knightRank++;
      this.combatWins.set(knight.id, 0); // reset counter
      return true;
    }

    return false;
  }

  /** Get a knight's combat wins toward next rank */
  getCombatWins(knightId: string): number {
    return this.combatWins.get(knightId) ?? 0;
  }

  /** Clean up combat tracking data for a removed knight */
  removeKnightData(knightId: string): void {
    this.combatWins.delete(knightId);
  }
}
