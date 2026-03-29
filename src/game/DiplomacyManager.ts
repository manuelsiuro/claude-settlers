/** Manages diplomatic relations between players */

export type TreatyType = 'none' | 'non_aggression' | 'trade_agreement' | 'alliance';

/** Treaty between two players */
export interface Treaty {
  type: TreatyType;
  /** Game time (seconds) when treaty was established */
  establishedAt: number;
}

/** Diplomatic relation key (sorted player pair) */
function relationKey(p1: number, p2: number): string {
  return p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
}

/**
 * DiplomacyManager tracks treaties between player pairs.
 *
 * Treaty types (in order of strength):
 * - none: default hostility
 * - non_aggression: cannot attack each other
 * - trade_agreement: non_aggression + reduced marketplace fee (-50%)
 * - alliance: trade_agreement + shared fog of war visibility
 */
export class DiplomacyManager {
  private treaties: Map<string, Treaty> = new Map();

  /** Callback when a treaty changes */
  onTreatyChanged: ((p1: number, p2: number, treaty: TreatyType) => void) | null = null;

  /** Get the treaty between two players */
  getTreaty(p1: number, p2: number): TreatyType {
    return this.treaties.get(relationKey(p1, p2))?.type ?? 'none';
  }

  /** Set a treaty between two players */
  setTreaty(p1: number, p2: number, type: TreatyType, gameTime: number): void {
    const key = relationKey(p1, p2);
    if (type === 'none') {
      this.treaties.delete(key);
    } else {
      this.treaties.set(key, { type, establishedAt: gameTime });
    }
    this.onTreatyChanged?.(p1, p2, type);
  }

  /** Check if attacks are allowed between two players */
  canAttack(attackerId: number, defenderId: number): boolean {
    const treaty = this.getTreaty(attackerId, defenderId);
    return treaty === 'none';
  }

  /** Check if players have a trade agreement (reduced fees) */
  hasTradeAgreement(p1: number, p2: number): boolean {
    const treaty = this.getTreaty(p1, p2);
    return treaty === 'trade_agreement' || treaty === 'alliance';
  }

  /** Check if players share fog of war visibility */
  sharesVisibility(p1: number, p2: number): boolean {
    return this.getTreaty(p1, p2) === 'alliance';
  }

  /** Get all allies (alliance or non-aggression) for a player */
  getAllies(playerId: number): number[] {
    const allies: number[] = [];
    for (const [key, treaty] of this.treaties) {
      if (treaty.type === 'none') continue;
      const [a, b] = key.split('-').map(Number);
      if (a === playerId) allies.push(b);
      else if (b === playerId) allies.push(a);
    }
    return allies;
  }

  /** Get all players with shared visibility (alliance only) */
  getVisibilityPartners(playerId: number): number[] {
    const partners: number[] = [];
    for (const [key, treaty] of this.treaties) {
      if (treaty.type !== 'alliance') continue;
      const [a, b] = key.split('-').map(Number);
      if (a === playerId) partners.push(b);
      else if (b === playerId) partners.push(a);
    }
    return partners;
  }

  /** Serialization */
  _getState(): { treaties: [string, Treaty][] } {
    return { treaties: Array.from(this.treaties.entries()) };
  }

  _loadState(state: { treaties: [string, { type: string; establishedAt: number }][] }): void {
    this.treaties = new Map(state.treaties as [string, Treaty][]);
  }
}
