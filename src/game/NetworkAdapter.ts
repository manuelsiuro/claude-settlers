/**
 * Transport-agnostic network adapter for the command system.
 *
 * Phase 1: Only LocalAdapter exists — commands execute immediately
 * and are logged for future replay support.
 *
 * Phase 2 will add WebSocketAdapter for multiplayer lockstep.
 */

import type { GameCommand } from './Command';

/**
 * Minimal adapter interface for Phase 1.
 * Phase 2 will extend with connect/disconnect, lobby events,
 * checksum sync, and state snapshot transfer.
 */
export interface NetworkAdapter {
  /** Buffer commands (for replay logging or network send). */
  submitCommands(commands: GameCommand[]): void;

  /** Drain buffered commands for this tick. */
  getCommandsForTick(): GameCommand[];

  /** Whether this is a local (single-player) adapter. */
  isLocal(): boolean;

  /** Get the full command log (for replay). */
  getCommandLog(): GameCommand[];
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
