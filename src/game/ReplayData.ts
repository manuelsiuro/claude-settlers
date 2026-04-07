/**
 * Replay data format for recording and replaying multiplayer games.
 *
 * After a game ends, the full command log can be saved as a replay file.
 * To replay, the game is re-created from the same config/seed and commands
 * are fed back in turn order to reproduce the exact same game.
 */

import type { GameConfig } from './GameConfig';
import type { GameCommand } from './Command';

export const REPLAY_VERSION = 1;

export interface PlayerAssignment {
  playerId: number;
  name: string;
  isHuman: boolean;
}

export interface ReplayData {
  version: number;
  config: GameConfig;
  seed: number;
  playerAssignments: PlayerAssignment[];
  /** Commands grouped by turn number */
  commandsByTurn: Record<number, GameCommand[]>;
  totalTurns: number;
}

/**
 * Build a ReplayData object from the game's command log.
 *
 * In multiplayer lockstep, each simulation tick = one turn.
 * In single-player, we group commands by the tick they were executed in.
 * The command log is a flat array — we assign each command to the turn
 * it was submitted on, based on the order they appear.
 */
export function buildReplayData(
  config: GameConfig,
  seed: number,
  assignments: PlayerAssignment[],
  commandLog: GameCommand[],
  totalTurns: number,
): ReplayData {
  // For the replay, all commands go into turn 0 for single-player
  // (they execute immediately). For multiplayer, the relay server
  // sequences them into turns via turn packets — but the local
  // command log is flat. We assign all to turn 0 so the replay
  // player can feed them in order.
  const commandsByTurn: Record<number, GameCommand[]> = {};
  if (commandLog.length > 0) {
    commandsByTurn[0] = [...commandLog];
  }

  return {
    version: REPLAY_VERSION,
    config,
    seed,
    playerAssignments: assignments,
    commandsByTurn,
    totalTurns,
  };
}

/** Serialize replay data to a JSON string. */
export function serializeReplay(data: ReplayData): string {
  return JSON.stringify(data);
}

/** Deserialize a JSON string into ReplayData. Throws on invalid input. */
export function deserializeReplay(json: string): ReplayData {
  const data = JSON.parse(json) as ReplayData;
  if (!data.version || !data.config || !data.seed || !data.playerAssignments) {
    throw new Error('Invalid replay data: missing required fields');
  }
  return data;
}
