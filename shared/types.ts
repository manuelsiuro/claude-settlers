/**
 * Shared types for multiplayer client and relay server.
 */

export interface PlayerInfo {
  playerId: number;
  name: string;
  ready: boolean;
  /** Latency in ms (updated periodically via ping/pong) */
  latency: number;
}

export interface PlayerAssignment {
  playerId: number;
  name: string;
  isHuman: boolean;
}

export interface RoomConfig {
  maxPlayers: number;
  mapSeed: number;
  mapSize: number;
  scenario: string;
  difficulty: string;
}

export interface TurnPacket {
  turnNumber: number;
  /** Commands grouped by player ID */
  commandsByPlayer: Record<number, SerializedCommand[]>;
}

/**
 * Serialized command — a JSON-safe representation of a GameCommand.
 * The full GameCommand types live in the client; the server only
 * forwards these opaquely.
 */
export interface SerializedCommand {
  type: string;
  playerId: number;
  [key: string]: unknown;
}
