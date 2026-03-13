/**
 * Shared player color definitions used across TerritoryRenderer, Minimap, UnitRenderer, etc.
 */

export const PLAYER_COLORS: Record<number, number> = {
  1: 0x4488ff, // blue
  2: 0xff4444, // red
  3: 0x44cc44, // green
  4: 0xffcc00, // yellow
};

export const DEFAULT_PLAYER_COLOR = 0xaaaaaa;

/** Get the hex color for a player (with fallback) */
export function getPlayerColor(playerId: number): number {
  return PLAYER_COLORS[playerId] ?? DEFAULT_PLAYER_COLOR;
}

/** Per-player territory overlay colors for minimap (semi-transparent CSS strings) */
export const PLAYER_TERRITORY_CSS: Record<number, string> = {
  1: 'rgba(60, 120, 255, 0.3)',   // blue
  2: 'rgba(255, 80, 80, 0.25)',   // red
  3: 'rgba(80, 200, 80, 0.25)',   // green
  4: 'rgba(255, 200, 40, 0.25)',  // yellow
};
