/**
 * WebSocket protocol messages between client and relay server.
 *
 * The server is a thin relay — it collects commands per turn,
 * broadcasts turn packets, and compares checksums. It runs no game logic.
 */

import type { PlayerInfo, PlayerAssignment, RoomConfig, SerializedCommand } from './types';

// ── Client → Server ─────────────────────────────────────────────────────

export type ClientMessage =
  | { type: 'CREATE_ROOM'; config: RoomConfig; playerName: string }
  | { type: 'JOIN_ROOM'; roomCode: string; playerName: string }
  | { type: 'READY' }
  | { type: 'COMMANDS'; turn: number; cmds: SerializedCommand[] }
  | { type: 'CHECKSUM'; turn: number; hash: number }
  | { type: 'STATE_SNAPSHOT'; turn: number; data: unknown }
  | { type: 'CHAT'; message: string }
  | { type: 'PING'; timestamp: number };

// ── Server → Client ─────────────────────────────────────────────────────

export type ServerMessage =
  | { type: 'ROOM_CREATED'; roomCode: string; playerId: number }
  | { type: 'ROOM_JOINED'; roomCode: string; players: PlayerInfo[]; yourPlayerId: number }
  | { type: 'PLAYER_JOINED'; player: PlayerInfo }
  | { type: 'PLAYER_LEFT'; playerId: number }
  | {
      type: 'GAME_START';
      config: RoomConfig;
      seed: number;
      playerAssignments: PlayerAssignment[];
    }
  | {
      type: 'TURN_PACKET';
      turn: number;
      cmdsByPlayer: Record<number, SerializedCommand[]>;
    }
  | { type: 'DESYNC_DETECTED'; turn: number; affectedPlayers: number[] }
  | { type: 'STATE_SNAPSHOT'; turn: number; data: unknown }
  | { type: 'CHAT'; playerId: number; playerName: string; message: string }
  | { type: 'PONG'; timestamp: number; serverTime: number }
  | { type: 'WAITING_FOR_PLAYER'; playerId: number; turn: number }
  | { type: 'PLAYER_LAGGING'; playerId: number; lagTurns: number }
  | { type: 'ERROR'; message: string };
