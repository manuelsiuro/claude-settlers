import type { GameState } from './GameState';
import type { KnightManager } from './KnightManager';
import type { Unit } from './Unit';
import { UnitType, UNIT_DEFINITIONS } from './UnitType';
import { COMBAT_WINS_PER_RANK } from './data/balanceConstants';

/**
 * Result of a single 1v1 duel between two military units.
 */
export interface DuelResult {
  winnerId: string;
  loserId: string;
  /** Player ID of the winner */
  winnerPlayerId: number;
  /** Player ID of the loser (captured before removal) */
  loserPlayerId: number;
  /** Whether the winner gained a rank from this duel */
  rankUp: boolean;
}

/** Check if a unit type is a military combatant */
function isMilitaryCombatant(type: UnitType): boolean {
  const def = UNIT_DEFINITIONS[type];
  return def.category === 'military';
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
  private static WINS_PER_RANK = COMBAT_WINS_PER_RANK;

  /** Optional callback when a duel is resolved */
  onDuelResolved: ((result: DuelResult) => void) | null = null;

  /** Random function (injectable for testing) */
  random: () => number = Math.random;

  /** Morale combat multiplier per player (set by Game each frame) */
  moraleMultipliers: Map<number, number> = new Map();

  constructor(gameState: GameState, knightManager: KnightManager) {
    this.gameState = gameState;
    this.knightManager = knightManager;
  }

  /** Serialization: get internal state for save */
  _getState(): { combatWins: [string, number][] } {
    return { combatWins: Array.from(this.combatWins.entries()) };
  }

  /** Serialization: restore internal state from save */
  _loadState(state: { combatWins: [string, number][] }): void {
    this.combatWins = new Map(state.combatWins);
  }

  /**
   * Pre-compute the outcome of a 1v1 duel without applying side effects.
   * Returns the result (winner/loser/rankUp) or null if invalid.
   */
  preComputeDuel(attackerId: string, defenderId: string): DuelResult | null {
    const attacker = this.gameState.getUnit(attackerId);
    const defender = this.gameState.getUnit(defenderId);

    if (!attacker || !defender) return null;
    if (attackerId === defenderId) return null;
    if (!isMilitaryCombatant(attacker.type) || !isMilitaryCombatant(defender.type)) return null;

    let attackerStrength = this.knightManager.getKnightStrength(attackerId);
    let defenderStrength = this.knightManager.getKnightStrength(defenderId);

    // Apply morale combat multiplier
    attackerStrength *= this.moraleMultipliers.get(attacker.playerId) ?? 1.0;
    defenderStrength *= this.moraleMultipliers.get(defender.playerId) ?? 1.0;

    // Apply cavalry charge bonus on first engagement
    const attackerDef = UNIT_DEFINITIONS[attacker.type];
    const defenderDef = UNIT_DEFINITIONS[defender.type];
    if (attackerDef.chargeMultiplier && (this.combatWins.get(attackerId) ?? 0) === 0) {
      attackerStrength *= attackerDef.chargeMultiplier;
    }
    if (defenderDef.chargeMultiplier && (this.combatWins.get(defenderId) ?? 0) === 0) {
      defenderStrength *= defenderDef.chargeMultiplier;
    }

    // Probability that attacker wins
    const totalStrength = attackerStrength + defenderStrength;
    const attackerWinProb = totalStrength > 0 ? attackerStrength / totalStrength : 0.5;

    const roll = this.random();
    const attackerWins = roll < attackerWinProb;

    const winnerId = attackerWins ? attackerId : defenderId;
    const loserId = attackerWins ? defenderId : attackerId;
    const winner = attackerWins ? attacker : defender;
    const loser = attackerWins ? defender : attacker;

    // Capture player IDs before removal
    const winnerPlayerId = winner.playerId;
    const loserPlayerId = loser.playerId;

    // Check if winner would rank up (peek at current wins)
    const currentWins = this.combatWins.get(winnerId) ?? 0;
    const rankUp = currentWins + 1 >= CombatManager.WINS_PER_RANK && winner.knightRank < 5;

    return { winnerId, loserId, winnerPlayerId, loserPlayerId, rankUp };
  }

  /**
   * Apply a pre-computed duel result: remove loser, award win to winner.
   */
  applyDuelResult(result: DuelResult): void {
    this.removeCombatant(result.loserId);

    const winner = this.gameState.getUnit(result.winnerId);
    if (winner) {
      this.awardWin(winner);
    }

    this.onDuelResolved?.(result);
  }

  /**
   * Resolve a 1v1 duel between two knights.
   * The knight with higher strength has a higher probability of winning.
   * The loser is removed from the game.
   * The winner may gain a rank.
   */
  resolveDuel(attackerId: string, defenderId: string): DuelResult | null {
    const result = this.preComputeDuel(attackerId, defenderId);
    if (!result) return null;
    this.applyDuelResult(result);
    return result;
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

  /** Prune combatWins entries for knights that no longer exist */
  cleanupStaleData(): void {
    for (const knightId of this.combatWins.keys()) {
      if (!this.gameState.getUnit(knightId)) {
        this.combatWins.delete(knightId);
      }
    }
  }

  /**
   * Apply siege damage to a building from a siege unit.
   * Returns the new HP value (0 = building destroyed/capturable).
   */
  applySiegeDamage(unitId: string, building: import('./Building').Building): number {
    const unit = this.gameState.getUnit(unitId);
    if (!unit) return building.hp;
    const unitDef = UNIT_DEFINITIONS[unit.type];
    const buildingDmg = unitDef.buildingDamage ?? 0;
    if (buildingDmg <= 0) return building.hp;

    const damage = 0.1 * buildingDmg; // 0.1 base per tick × multiplier
    building.hp = Math.max(0, building.hp - damage);
    return building.hp;
  }
}
