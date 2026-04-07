/**
 * Room — manages a single multiplayer game session.
 *
 * Lifecycle: CREATE → players JOIN → all READY → GAME_START →
 * turn-by-turn COMMANDS collection → TURN_PACKET broadcast →
 * periodic CHECKSUM comparison → game over or all leave → destroy.
 */

import type { WebSocket } from 'ws';
import type { PlayerInfo, PlayerAssignment, RoomConfig, SerializedCommand } from '../shared/types';
import type { ClientMessage, ServerMessage } from '../shared/protocol';

interface ConnectedPlayer {
  ws: WebSocket;
  info: PlayerInfo;
  /** Commands submitted for the current turn (null = not yet submitted) */
  pendingCommands: SerializedCommand[] | null;
  /** Checksum for the current checksum turn (null = not yet submitted) */
  pendingChecksum: number | null;
  /** Number of consecutive turns this player hasn't sent commands */
  lagCount: number;
  /** Whether this player has been marked as disconnected */
  disconnected: boolean;
}

/** How long to wait for a player's commands before advancing the turn (ms) */
const TURN_TIMEOUT_MS = 3000;
/** After this many consecutive lagging turns, mark player as disconnected */
const MAX_LAG_TURNS = 10;
/** Check checksums every N turns */
const CHECKSUM_INTERVAL = 10;

export class Room {
  readonly code: string;
  readonly config: RoomConfig;
  private players = new Map<number, ConnectedPlayer>();
  private nextPlayerId = 1;
  private started = false;
  private currentTurn = 0;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  /** Called when the room should be cleaned up */
  onDestroy: (() => void) | null = null;

  constructor(code: string, config: RoomConfig) {
    this.code = code;
    this.config = config;
  }

  get playerCount(): number {
    return this.players.size;
  }

  get isStarted(): boolean {
    return this.started;
  }

  // ── Player management ───────────────────────────────────────────────

  addPlayer(ws: WebSocket, name: string): number | null {
    if (this.started) return null;
    if (this.players.size >= this.config.maxPlayers) return null;

    const playerId = this.nextPlayerId++;
    const player: ConnectedPlayer = {
      ws,
      info: { playerId, name, ready: false, latency: 0 },
      pendingCommands: null,
      pendingChecksum: null,
      lagCount: 0,
      disconnected: false,
    };
    this.players.set(playerId, player);
    return playerId;
  }

  removePlayer(playerId: number): void {
    const player = this.players.get(playerId);
    if (!player) return;

    if (!this.started) {
      // Pre-game: fully remove
      this.players.delete(playerId);
    } else {
      // In-game: mark as disconnected (AI takeover)
      player.disconnected = true;
      player.pendingCommands = []; // Submit empty commands so turns can advance
    }

    this.broadcast({ type: 'PLAYER_LEFT', playerId });

    // Destroy room if empty
    if (this.getActivePlayerCount() === 0) {
      this.destroy();
    }

    // Check if all remaining players have submitted commands
    if (this.started) {
      this.checkTurnComplete();
    }
  }

  // ── Message handling ────────────────────────────────────────────────

  handleMessage(playerId: number, msg: ClientMessage): void {
    const player = this.players.get(playerId);
    if (!player) return;

    switch (msg.type) {
      case 'READY':
        player.info.ready = true;
        this.checkAllReady();
        break;

      case 'COMMANDS':
        if (!this.started) break;
        if (msg.turn !== this.currentTurn) break; // Ignore stale/future commands
        player.pendingCommands = msg.cmds;
        player.lagCount = 0;
        this.checkTurnComplete();
        break;

      case 'CHECKSUM':
        player.pendingChecksum = msg.hash;
        this.checkChecksums();
        break;

      case 'STATE_SNAPSHOT':
        // Forward state snapshot to all other players (for desync recovery)
        this.broadcastExcept(playerId, {
          type: 'STATE_SNAPSHOT',
          turn: msg.turn,
          data: msg.data,
        });
        break;

      case 'CHAT':
        this.broadcast({
          type: 'CHAT',
          playerId,
          playerName: player.info.name,
          message: msg.message,
        });
        break;

      case 'PING':
        this.send(player, {
          type: 'PONG',
          timestamp: msg.timestamp,
          serverTime: Date.now(),
        });
        break;
    }
  }

  // ── Game start ──────────────────────────────────────────────────────

  private checkAllReady(): void {
    if (this.started) return;
    if (this.players.size < 2) return;

    const allReady = Array.from(this.players.values()).every(p => p.info.ready);
    if (!allReady) return;

    this.started = true;
    this.currentTurn = 0;

    const assignments: PlayerAssignment[] = Array.from(this.players.values()).map(p => ({
      playerId: p.info.playerId,
      name: p.info.name,
      isHuman: true,
    }));

    this.broadcast({
      type: 'GAME_START',
      config: this.config,
      seed: this.config.mapSeed,
      playerAssignments: assignments,
    });

    // Start first turn
    this.startTurnTimer();
  }

  // ── Turn management ─────────────────────────────────────────────────

  private checkTurnComplete(): void {
    // Check if all active players have submitted commands
    for (const [, player] of this.players) {
      if (player.disconnected) continue;
      if (player.pendingCommands === null) return; // Still waiting
    }

    // All commands received — broadcast turn packet
    this.advanceTurn();
  }

  private advanceTurn(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }

    const cmdsByPlayer: Record<number, SerializedCommand[]> = {};
    for (const [pid, player] of this.players) {
      cmdsByPlayer[pid] = player.pendingCommands ?? [];

      // Track lagging
      if (!player.disconnected && player.pendingCommands === null) {
        player.lagCount++;
        if (player.lagCount >= MAX_LAG_TURNS) {
          player.disconnected = true;
          this.broadcast({ type: 'PLAYER_LEFT', playerId: pid });
        } else {
          this.broadcast({
            type: 'PLAYER_LAGGING',
            playerId: pid,
            lagTurns: player.lagCount,
          });
        }
      }
    }

    this.broadcast({
      type: 'TURN_PACKET',
      turn: this.currentTurn,
      cmdsByPlayer,
    });

    // Reset for next turn
    this.currentTurn++;
    for (const [, player] of this.players) {
      player.pendingCommands = player.disconnected ? [] : null;
    }

    this.startTurnTimer();
  }

  private startTurnTimer(): void {
    this.turnTimer = setTimeout(() => {
      // Timeout: advance turn with empty commands for missing players
      for (const [pid, player] of this.players) {
        if (!player.disconnected && player.pendingCommands === null) {
          this.send(player, {
            type: 'WAITING_FOR_PLAYER',
            playerId: pid,
            turn: this.currentTurn,
          });
        }
      }
      this.advanceTurn();
    }, TURN_TIMEOUT_MS);
  }

  // ── Checksum ────────────────────────────────────────────────────────

  private checkChecksums(): void {
    if (this.currentTurn % CHECKSUM_INTERVAL !== 0) return;

    const checksums = new Map<number, number>();
    for (const [pid, player] of this.players) {
      if (player.disconnected) continue;
      if (player.pendingChecksum === null) return; // Still waiting
      checksums.set(pid, player.pendingChecksum);
    }

    // All checksums received — compare
    const values = Array.from(checksums.values());
    const allMatch = values.every(v => v === values[0]);

    if (!allMatch) {
      // Find which players differ from the host (player 1)
      const hostChecksum = checksums.get(1) ?? values[0];
      const affected: number[] = [];
      for (const [pid, hash] of checksums) {
        if (hash !== hostChecksum) affected.push(pid);
      }
      this.broadcast({
        type: 'DESYNC_DETECTED',
        turn: this.currentTurn,
        affectedPlayers: affected,
      });
    }

    // Reset checksums
    for (const [, player] of this.players) {
      player.pendingChecksum = null;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  getPlayerList(): PlayerInfo[] {
    return Array.from(this.players.values()).map(p => p.info);
  }

  private getActivePlayerCount(): number {
    let count = 0;
    for (const [, p] of this.players) {
      if (!p.disconnected) count++;
    }
    return count;
  }

  private send(player: ConnectedPlayer, msg: ServerMessage): void {
    if (player.ws.readyState === 1) { // OPEN
      player.ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const [, player] of this.players) {
      if (!player.disconnected && player.ws.readyState === 1) {
        player.ws.send(data);
      }
    }
  }

  private broadcastExcept(excludeId: number, msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const [pid, player] of this.players) {
      if (pid !== excludeId && !player.disconnected && player.ws.readyState === 1) {
        player.ws.send(data);
      }
    }
  }

  private destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.onDestroy?.();
  }
}
