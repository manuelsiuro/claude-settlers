/**
 * Feudal Realm Manager — Multiplayer Relay Server
 *
 * Minimal relay for deterministic lockstep multiplayer.
 * Runs no game logic — only collects commands per turn,
 * broadcasts turn packets, and compares checksums.
 *
 * Usage:
 *   npx tsx server/index.ts [port]
 *   npm run dev (from server/)
 */

import { createServer } from 'http';
import { WebSocketServer, type WebSocket } from 'ws';
import { Room } from './Room';
import type { ClientMessage } from '../shared/protocol';

const PORT = parseInt(process.argv[2] ?? '9876', 10);

// ── Room management ─────────────────────────────────────────────────────

const rooms = new Map<string, Room>();

/** Player → room mapping for cleanup on disconnect */
const playerRooms = new Map<WebSocket, { room: Room; playerId: number }>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars (0/O, 1/I)
  let code: string;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

// ── HTTP server ─────────────────────────────────────────────────────────

const httpServer = createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      rooms: rooms.size,
      players: playerRooms.size,
    }));
    return;
  }

  // Room info endpoint
  if (req.url?.startsWith('/room/')) {
    const code = req.url.slice(6).toUpperCase();
    const room = rooms.get(code);
    if (room) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        code: room.code,
        players: room.getPlayerList(),
        started: room.isStarted,
      }));
    } else {
      res.writeHead(404);
      res.end('Room not found');
    }
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Feudal Realm Manager — Multiplayer Relay Server');
});

// ── WebSocket server ────────────────────────────────────────────────────

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (data: Buffer) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data.toString()) as ClientMessage;
    } catch {
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid JSON' }));
      return;
    }

    switch (msg.type) {
      case 'CREATE_ROOM': {
        const code = generateRoomCode();
        const room = new Room(code, msg.config);
        room.onDestroy = () => rooms.delete(code);
        rooms.set(code, room);

        const playerId = room.addPlayer(ws, msg.playerName);
        if (playerId === null) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Failed to create room' }));
          return;
        }
        playerRooms.set(ws, { room, playerId });

        ws.send(JSON.stringify({
          type: 'ROOM_CREATED',
          roomCode: code,
          playerId,
        }));
        console.log(`[Room ${code}] Created by "${msg.playerName}" (player ${playerId})`);
        break;
      }

      case 'JOIN_ROOM': {
        const code = msg.roomCode.toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' }));
          return;
        }
        if (room.isStarted) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Game already started' }));
          return;
        }

        const playerId = room.addPlayer(ws, msg.playerName);
        if (playerId === null) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Room is full' }));
          return;
        }
        playerRooms.set(ws, { room, playerId });

        ws.send(JSON.stringify({
          type: 'ROOM_JOINED',
          roomCode: code,
          players: room.getPlayerList(),
          yourPlayerId: playerId,
        }));

        // Notify other players
        room.handleMessage(playerId, { type: 'READY' }); // Auto-notify (player list changed)
        console.log(`[Room ${code}] "${msg.playerName}" joined (player ${playerId})`);
        break;
      }

      default: {
        // Route all other messages to the room
        const entry = playerRooms.get(ws);
        if (!entry) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Not in a room' }));
          return;
        }
        entry.room.handleMessage(entry.playerId, msg);
        break;
      }
    }
  });

  ws.on('close', () => {
    const entry = playerRooms.get(ws);
    if (entry) {
      console.log(`[Room ${entry.room.code}] Player ${entry.playerId} disconnected`);
      entry.room.removePlayer(entry.playerId);
      playerRooms.delete(ws);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
});

// ── Start ───────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`🏰 Feudal Realm Server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
});
