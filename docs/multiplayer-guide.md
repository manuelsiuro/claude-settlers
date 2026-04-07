# LAN Multiplayer Guide

Play Feudal Realm Manager with friends on the same local network.

## Quick Start

### Hosting a Game

1. Run `npm run dev` — this starts both the game server and the multiplayer relay server automatically.
2. Open the game in your browser (`http://localhost:5173`).
3. Scroll down on the setup screen and click **Multiplayer (LAN)**.
4. Enter your name on the **Host Game** tab and click **Create Game**.
5. Share the room code or invite link with your friend.

### Joining a Game

**Option A — Room Code:**

1. Open the game in your browser (use the same URL as the host, or the host's LAN IP shown in the terminal: `http://192.168.x.x:5173`).
2. Click **Multiplayer (LAN)** → **Join Game** tab.
3. Enter your name, type the 4-character room code, and click **Join Game**.

**Option B — Invite Link:**

1. The host clicks **Copy Link** in the lobby — this copies a URL with the room code and server address embedded.
2. Paste the link in your browser. The game opens and auto-joins the lobby.

**Option C — QR Code (mobile):**

1. The host's lobby shows a QR code.
2. Scan it with your phone camera — it opens the game and auto-joins.

### Starting the Match

Once both players are in the lobby:
- The host sees a **Start Game** button (enabled when 2+ players are present).
- The host clicks **Start Game** — both clients load the game simultaneously.
- Both players start with a Castle on the same map (same seed, different positions).

---

## How It Works

### Architecture

Feudal Realm Manager uses **deterministic lockstep** — the same architecture used by Age of Empires, StarCraft, and Factorio.

- All game logic runs on **both clients simultaneously**.
- Only player commands are sent over the network (~1-4 KB/s per player).
- A lightweight **relay server** collects commands per turn, packages them, and broadcasts to all clients.
- The server runs **no game logic** — it's a ~300-line Node.js process.

### Determinism

For lockstep to work, both clients must produce identical simulation results:

- **Seeded PRNG**: All game-logic randomness uses `GameRng` (mulberry32), seeded from the map seed. No `Math.random()` in game logic.
- **Fixed timestep**: Simulation runs at exactly 20 ticks/second (50ms per tick), regardless of frame rate. Visual systems interpolate smoothly.
- **Command system**: All 20 state-mutation types (building placement, attacks, trades, etc.) flow through `CommandExecutor`, ensuring identical execution order.
- **Checksum validation**: Every 10 turns, both clients compute a state hash and the server compares them. Mismatches trigger desync detection.

### Network Protocol

```
Client A                Relay Server              Client B
   |                        |                        |
   |-- COMMANDS (turn N) -->|                        |
   |                        |<-- COMMANDS (turn N) --|
   |                        |                        |
   |<-- TURN_PACKET (N) ----|---- TURN_PACKET (N) -->|
   |                        |                        |
   Both execute same commands, run one simulation tick
```

Each turn:
1. Both clients collect local player commands during the turn.
2. Both send their commands to the relay server.
3. Server waits until it has commands from **all players**.
4. Server packages all commands into a `TurnPacket` and broadcasts.
5. Both clients execute the same commands in the same order, then advance one tick.

---

## Setup Details

### Development Mode

`npm run dev` automatically starts:
- **Vite dev server** on port 5173 (game client with hot-reload)
- **Relay server** on port 9876 (multiplayer relay)

The relay server address (`ws://<LAN IP>:9876`) is auto-injected into the game client — no manual configuration needed.

### Production / Standalone Server

To run the relay server independently:

```bash
cd server
npm install
npx tsx index.ts [port]   # default: 9876
```

The server exposes:
- `ws://host:9876` — WebSocket endpoint for game clients
- `http://host:9876/health` — Health check (JSON: rooms, players)
- `http://host:9876/room/CODE` — Room info (players, started status)

### Firewall

Both players must be able to reach the relay server:
- **Same machine**: `ws://localhost:9876` (automatic)
- **Same LAN**: `ws://192.168.x.x:9876` (auto-detected by Vite)
- Ensure port 9876 is not blocked by your firewall

---

## In-Game

### Fog of War

Each player sees only their own territory. The opponent's buildings and units are hidden by fog of war unless you expand your territory near them.

### Game Speed

In multiplayer, game speed is fixed at 1x. Speed controls are local-only (they do not affect the lockstep simulation).

### Waiting for Opponent

If your opponent's client is slow or their connection lags, you'll see a "Waiting for opponent..." overlay with a spinner. The game pauses until the turn packet arrives. Normal play resumes automatically.

### Disconnection

If the connection drops:
- The game attempts to auto-reconnect (3 tries with exponential backoff: 1s, 2s, 4s).
- If reconnection succeeds, play continues seamlessly.
- If all retries fail, a "Connection Lost" overlay appears with a "Return to Menu" button.

### Leaving

Click the **Leave** button in the lobby to return to the setup screen. During a game, closing the browser tab will disconnect you from the room.

---

## Lobby Features

| Feature | Description |
|---------|-------------|
| Room code | 4-character alphanumeric code (no ambiguous chars like 0/O, 1/I) |
| QR code | Scannable QR containing the full join URL — great for mobile |
| Copy Link | Copies invite URL to clipboard (includes room code + server address) |
| Join via URL | `http://host:5173?join=CODE&server=ws://host:9876` — auto-joins |
| Player list | Shows all players with color dots and host badge |
| Connection indicator | Green dot in lobby header shows active server connection |

---

## Troubleshooting

### "Room not found"
The room code is case-insensitive but must match exactly. Codes expire when all players leave or the server restarts.

### "Failed to connect"
- Is the relay server running? Check `http://localhost:9876/health`.
- Are both players on the same network?
- Is port 9876 open? Try `curl http://<host-ip>:9876/health` from the joining player's machine.

### Game seems frozen
This is the "Waiting for opponent" state — the other player's client hasn't sent their turn commands yet. Check their connection. If persistent, the server will eventually time out the lagging player (30 seconds).

### Visual differences between clients
The game state (buildings, units, resources) should be identical. Visual differences (weather, particle effects, cloud positions) are cosmetic and don't affect gameplay — they use `Math.random()` independently on each client.

---

## Technical Reference

| Component | File | Description |
|-----------|------|-------------|
| Relay server | `server/index.ts` | HTTP + WebSocket entry point (~120 lines) |
| Room logic | `server/Room.ts` | Room lifecycle, turn collection, checksums (~250 lines) |
| Protocol types | `shared/protocol.ts` | ClientMessage, ServerMessage definitions |
| Shared types | `shared/types.ts` | PlayerInfo, TurnPacket, RoomConfig |
| WebSocket adapter | `src/game/WebSocketAdapter.ts` | Client-side WebSocket with reconnection |
| Network adapter | `src/game/NetworkAdapter.ts` | Interface + LocalAdapter (single-player) |
| Command types | `src/game/Command.ts` | 20 game command definitions |
| Command executor | `src/game/CommandExecutor.ts` | Single entry point for state mutations |
| Seeded PRNG | `src/game/GameRng.ts` | Mulberry32 with serializable state |
| Lobby UI | `src/ui/LobbyPanel.ts` | Room create/join, player list, QR |
| Multiplayer overlay | `src/ui/MultiplayerOverlay.ts` | Waiting + disconnected overlays |
| Setup panel | `src/ui/SetupScreen.ts` | Host/Join tabs, form inputs |
| Game loop | `src/engine/Game.ts` | `processMultiplayerTurn()` lockstep loop |
| Design doc | `docs/multiplayer.md` | Full architecture design (4 phases) |
