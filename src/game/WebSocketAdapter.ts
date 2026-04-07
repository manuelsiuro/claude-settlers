/**
 * WebSocket network adapter for multiplayer lockstep.
 *
 * Connects to the relay server, sends commands per turn,
 * receives turn packets, and handles lobby/sync messages.
 */

import type { GameCommand } from './Command';
import type { NetworkAdapter } from './NetworkAdapter';
import type { TurnPacket, PlayerInfo, SerializedCommand } from '../../shared/types';
import type { ClientMessage, ServerMessage } from '../../shared/protocol';

export class WebSocketAdapter implements NetworkAdapter {
  private ws: WebSocket | null = null;
  private commandLog: GameCommand[] = [];
  private turnPacketQueue: TurnPacket[] = [];
  private latency = 0;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  /** Our player ID assigned by the server */
  playerId = 0;

  /** Room code we're in */
  roomCode = '';

  // ── Callbacks ───────────────────────────────────────────────────────

  onTurnPacket: ((packet: TurnPacket) => void) | null = null;
  onPlayerJoined: ((player: PlayerInfo) => void) | null = null;
  onPlayerLeft: ((playerId: number) => void) | null = null;
  onGameStart: ((config: { seed: number; playerAssignments: { playerId: number; name: string; isHuman: boolean }[] }) => void) | null = null;
  onDesyncDetected: ((turnNumber: number, affectedPlayers: number[]) => void) | null = null;
  onStateSnapshot: ((turnNumber: number, data: unknown) => void) | null = null;
  onError: ((message: string) => void) | null = null;
  onRoomCreated: ((roomCode: string) => void) | null = null;
  onRoomJoined: ((roomCode: string, players: PlayerInfo[]) => void) | null = null;
  onWaitingForPlayer: ((playerId: number) => void) | null = null;
  onChat: ((playerId: number, name: string, message: string) => void) | null = null;
  onDisconnected: (() => void) | null = null;

  // ── NetworkAdapter interface ────────────────────────────────────────

  submitCommands(commands: GameCommand[]): void {
    this.commandLog.push(...commands);
  }

  getCommandsForTick(): GameCommand[] {
    // In multiplayer, commands come from turn packets, not local buffer
    return [];
  }

  isLocal(): boolean {
    return false;
  }

  getCommandLog(): GameCommand[] {
    return this.commandLog;
  }

  // ── Connection ──────────────────────────────────────────────────────

  connect(address: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(address);
      } catch (e) {
        reject(new Error(`Failed to connect: ${e}`));
        return;
      }

      this.ws.onopen = () => {
        this.startPing();
        resolve();
      };

      this.ws.onerror = (e) => {
        reject(new Error(`WebSocket error: ${e}`));
      };

      this.ws.onclose = () => {
        this.stopPing();
        this.onDisconnected?.();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data as string);
      };
    });
  }

  disconnect(): void {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getLatency(): number {
    return this.latency;
  }

  // ── Room operations ─────────────────────────────────────────────────

  createRoom(config: { maxPlayers: number; mapSeed: number; mapSize: number; scenario: string; difficulty: string }, playerName: string): void {
    this.send({ type: 'CREATE_ROOM', config, playerName });
  }

  joinRoom(roomCode: string, playerName: string): void {
    this.send({ type: 'JOIN_ROOM', roomCode, playerName });
  }

  setReady(): void {
    this.send({ type: 'READY' });
  }

  // ── Turn commands ───────────────────────────────────────────────────

  sendTurnCommands(turnNumber: number, commands: GameCommand[]): void {
    const cmds: SerializedCommand[] = commands.map(c => c as unknown as SerializedCommand);
    this.send({ type: 'COMMANDS', turn: turnNumber, cmds });
    this.commandLog.push(...commands);
  }

  hasTurnPacket(): boolean {
    return this.turnPacketQueue.length > 0;
  }

  getTurnPacket(): TurnPacket | null {
    return this.turnPacketQueue.shift() ?? null;
  }

  // ── Sync ────────────────────────────────────────────────────────────

  sendChecksum(turnNumber: number, checksum: number): void {
    this.send({ type: 'CHECKSUM', turn: turnNumber, hash: checksum });
  }

  sendStateSnapshot(turnNumber: number, data: unknown): void {
    this.send({ type: 'STATE_SNAPSHOT', turn: turnNumber, data });
  }

  sendChat(message: string): void {
    this.send({ type: 'CHAT', message });
  }

  // ── Internal ────────────────────────────────────────────────────────

  private send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(data: string): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(data) as ServerMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case 'ROOM_CREATED':
        this.roomCode = msg.roomCode;
        this.playerId = msg.playerId;
        this.onRoomCreated?.(msg.roomCode);
        break;

      case 'ROOM_JOINED':
        this.roomCode = msg.roomCode;
        this.playerId = msg.yourPlayerId;
        this.onRoomJoined?.(msg.roomCode, msg.players);
        break;

      case 'PLAYER_JOINED':
        this.onPlayerJoined?.(msg.player);
        break;

      case 'PLAYER_LEFT':
        this.onPlayerLeft?.(msg.playerId);
        break;

      case 'GAME_START':
        this.onGameStart?.({
          seed: msg.seed,
          playerAssignments: msg.playerAssignments,
        });
        break;

      case 'TURN_PACKET':
        this.turnPacketQueue.push({
          turnNumber: msg.turn,
          commandsByPlayer: msg.cmdsByPlayer,
        });
        this.onTurnPacket?.({
          turnNumber: msg.turn,
          commandsByPlayer: msg.cmdsByPlayer,
        });
        break;

      case 'DESYNC_DETECTED':
        this.onDesyncDetected?.(msg.turn, msg.affectedPlayers);
        break;

      case 'STATE_SNAPSHOT':
        this.onStateSnapshot?.(msg.turn, msg.data);
        break;

      case 'CHAT':
        this.onChat?.(msg.playerId, msg.playerName, msg.message);
        break;

      case 'PONG':
        this.latency = Date.now() - msg.timestamp;
        break;

      case 'WAITING_FOR_PLAYER':
        this.onWaitingForPlayer?.(msg.playerId);
        break;

      case 'ERROR':
        this.onError?.(msg.message);
        break;
    }
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'PING', timestamp: Date.now() });
    }, 2000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
