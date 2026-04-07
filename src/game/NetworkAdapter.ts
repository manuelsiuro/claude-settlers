/**
 * Transport-agnostic network adapter for the command system.
 *
 * LocalAdapter — single-player (Phase 1). Commands execute immediately.
 * WebSocketAdapter — multiplayer lockstep (Phase 2). Commands are
 * sent to the relay server and return as turn packets.
 */

import type { GameCommand } from './Command';
import type { TurnPacket, PlayerInfo } from '../../shared/types';

export interface NetworkAdapter {
  /** Buffer commands (for replay logging or network send). */
  submitCommands(commands: GameCommand[]): void;

  /** Drain buffered commands for this tick. */
  getCommandsForTick(): GameCommand[];

  /** Whether this is a local (single-player) adapter. */
  isLocal(): boolean;

  /** Get the full command log (for replay). */
  getCommandLog(): GameCommand[];

  // ── Multiplayer (optional for LocalAdapter) ───────────────────────

  /** Connect to a relay server. */
  connect?(address: string): Promise<void>;

  /** Disconnect from the relay server. */
  disconnect?(): void;

  /** Whether connected to a server. */
  isConnected?(): boolean;

  /** Send commands for the current turn to the server. */
  sendTurnCommands?(turnNumber: number, commands: GameCommand[]): void;

  /** Check if a turn packet is ready. */
  hasTurnPacket?(): boolean;

  /** Get the next turn packet (blocking in multiplayer). */
  getTurnPacket?(): TurnPacket | null;

  /** Send a state checksum for desync detection. */
  sendChecksum?(turnNumber: number, checksum: number): void;

  /** Get current latency to server in ms. */
  getLatency?(): number;

  // ── Callbacks (set by Game) ───────────────────────────────────────

  onTurnPacket?: ((packet: TurnPacket) => void) | null;
  onPlayerJoined?: ((player: PlayerInfo) => void) | null;
  onPlayerLeft?: ((playerId: number) => void) | null;
  onGameStart?: ((config: { seed: number; playerAssignments: { playerId: number; name: string; isHuman: boolean }[] }) => void) | null;
  onDesyncDetected?: ((turnNumber: number, affectedPlayers: number[]) => void) | null;
  onStateSnapshot?: ((turnNumber: number, data: unknown) => void) | null;
  onError?: ((message: string) => void) | null;
}

/**
 * Local adapter for single-player. Commands are logged for future
 * replay support but otherwise pass through immediately.
 */
export class LocalAdapter implements NetworkAdapter {
  private pending: GameCommand[] = [];
  private log: GameCommand[] = [];

  submitCommands(commands: GameCommand[]): void {
    this.pending.push(...commands);
    this.log.push(...commands);
    // Cap log to prevent unbounded memory growth
    if (this.log.length > 10000) {
      this.log = this.log.slice(-10000);
    }
  }

  getCommandsForTick(): GameCommand[] {
    const cmds = this.pending;
    this.pending = [];
    return cmds;
  }

  isLocal(): boolean {
    return true;
  }

  getCommandLog(): GameCommand[] {
    return this.log;
  }
}
