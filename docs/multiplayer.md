# Multiplayer Architecture: Feudal Realm Manager

Design document for adding LAN and Internet multiplayer (human vs human) to Feudal Realm Manager. Recommends **deterministic lockstep simulation with a server relay** — the proven architecture used by Age of Empires, StarCraft, and Factorio. Covers four implementation phases from determinism foundations to polish, identifies all codebase changes with file-level impact analysis, and provides testing and verification strategies.

## Guiding Principles

- **Single-player must not regress.** Multiplayer is additive — single-player runs the same simulation through a `LocalAdapter` that executes commands immediately.
- **All determinism work benefits single-player too.** Seeded RNG and the command pattern enable replays, deterministic saves, and debugging.
- **Mobile-first.** Lockstep sends only player commands (~1 KB/s per player), making it viable on mobile networks.
- **Incremental adoption.** Each implementation phase is independently useful and shippable.
- **Existing saves are preserved.** Multiplayer adds new config fields via the established save migration chain (v14 → v15).

---

## 1. Current Architecture Analysis

### 1.1 Game Loop

The game loop in `src/engine/Game.ts:558-650` runs via `requestAnimationFrame`. Each frame:

1. Compute `rawDelta` (capped at 100ms)
2. Update camera and atmosphere (even when paused)
3. Compute `deltaTime = paused ? 0 : rawDelta * gameSpeed`
4. Update 21+ managers sequentially in a fixed order
5. Sync renderers and visual systems

**Key issue:** `deltaTime` is variable — it depends on frame rate, which differs per machine. Two clients running the same game will diverge within seconds because floating-point accumulation of variable deltas produces different results.

### 1.2 State Management

Full game state is serializable through `SaveData` (v14) in `src/game/SaveLoad.ts:56-205`:

- **ID counters:** `nextBuildingId`, `nextUnitId`, `nextFlagId`, `nextRoadId`
- **Core entities:** Buildings, Units, Flags, Roads
- **19+ manager states:** Each manager serializes via `_getState()` / `_loadState()`
- **Terrain overrides:** Forest/grassland changes from forestry
- **AI state:** Build order index, cooldowns, attack timers
- **Total save size:** ~10-15 KB for a 4-player medium map (JSON)

This existing serialization is the foundation for multiplayer state snapshots (reconnection, desync recovery).

### 1.3 ID Generation

Sequential module-level counters in four locations:

| File | Counter | Format |
|------|---------|--------|
| `src/game/Building.ts:79` | `nextBuildingId` | `building_N` |
| `src/game/Unit.ts:63` | `nextUnitId` | `unit_N` |
| `src/game/RoadNetwork.ts:43-44` | `nextFlagId`, `nextRoadId` | `flag_N`, `road_N` |
| `src/game/TreeManager.ts` | `nextTreeId` | `tree_N` |

**Problem:** Independent counters per client diverge if entity creation order differs across the network. Needs deterministic or server-coordinated ID allocation.

### 1.4 Randomness

`Math.random()` is used in game logic in two patterns:

**Injectable property (already prepared for override):**

| File | Line | Usage |
|------|------|-------|
| `src/game/CombatManager.ts` | 51 | `random: () => number = Math.random` — duel outcomes |
| `src/game/RandomEventManager.ts` | 182 | `random: () => number = Math.random` — event timing and selection |

**Direct calls (need refactoring):**

| File | Lines | Usage |
|------|-------|-------|
| `src/game/AIPlayer.ts` | 102, 158, 184 | Diplomacy cooldown, decision skip chance |
| `src/game/AIPlayer.ts` | 611-612, 618, 651 | Placement jitter, hex shuffling |

**Visual-only (safe to keep):**

| File | Line | Usage |
|------|------|-------|
| `src/game/CombatAnimationState.ts` | 69 | Clash count (rendering only, does not affect game state) |

**Existing asset:** `src/game/noise.ts` already provides a seeded Mulberry32 PRNG via `createRng(seed)` — used for map generation, ready for reuse.

### 1.5 Player Input Flow

Currently, player actions mutate state directly with no indirection:

```
UI click → PlacementController.onBuildingPlaced callback
  → Game.placeBuilding() → GameState.placeBuilding() → state mutated immediately

AI decision → AIPlayer.update()
  → gameState.placeBuilding() → state mutated immediately
```

There are no command objects, no action queue, and no ability to serialize, replay, or validate player actions before execution.

### 1.6 Communication Patterns

38+ scattered callback properties across managers (`onBuildingPlaced`, `onDuelResolved`, `onTerrainChanged`, etc.). Notifications fire through `game.onNotification?.()` in `src/engine/GameNotifications.ts`. No centralized event bus.

### 1.7 Strengths for Multiplayer

The codebase has several properties that make multiplayer feasible:

- **Clean logic/render separation:** `src/game/` (68 files, pure logic) vs `src/engine/` (47 files, Three.js rendering). Game logic can run headless.
- **Integer coordinates:** Hex grid uses `{q, r}` integers. No floating-point spatial coordinates in game logic.
- **Integer resources:** All resource quantities are whole numbers.
- **Seeded map generation:** `SeededNoise` in `src/game/noise.ts` ensures identical maps from the same seed.
- **Injectable randomness:** CombatManager and RandomEventManager already accept a `random` function.
- **Full state serialization:** The save/load system provides complete state snapshots.
- **Per-player fog of war:** `FogOfWarManager` already tracks visibility per player.
- **Sequential manager updates:** The update order in `Game.ts:603-650` is deterministic (hardcoded sequence).

---

## 2. Networking Model

### 2.1 Architecture Comparison

| Architecture | Bandwidth | Server Cost | Input Latency | Cheat Resistance | Best For |
|---|---|---|---|---|---|
| **Lockstep + relay (recommended)** | ~1 KB/s/player | Minimal (relay only) | 100-200ms (turn-based) | Moderate (checksums) | RTS with many entities |
| Client-server authoritative | ~50 KB/s/player | Heavy (runs full sim) | Low (prediction) | High | FPS, MOBA |
| State sync (Colyseus-style) | ~10 KB/s/player | Heavy | Low (interpolation) | High | Moderate entity counts |
| P2P mesh (no server) | ~1 KB/s/player | None | Variable | Low | Casual LAN |

### 2.2 Why Lockstep with Server Relay

**Lockstep** is the proven architecture for real-time strategy games because:

1. **Bandwidth scales with player actions, not entity count.** Feudal Realm Manager can have 400+ buildings, 800+ units, and complex logistics — sending state updates for all of these each tick is prohibitive. Lockstep sends only player commands (~20-50 per turn, <100 bytes each).

2. **All clients run the full simulation.** No server CPU bottleneck. A relay server is a trivial ~200-line Node.js process.

3. **RTS input latency is acceptable.** Players issue strategic commands (place buildings, order attacks), not twitch inputs. A 150ms turn delay is imperceptible compared to FPS gameplay.

4. **Free replay system.** Recording the command log automatically gives deterministic replays — no additional work needed.

5. **Proven at scale.** Age of Empires supported 8 players with 500+ units on 56k modems using this exact architecture.

**The server's role is minimal:** collect commands from all players per turn, package them into a `TurnPacket`, and broadcast to all clients. It runs no game logic.

### 2.3 How Lockstep Works

```
                    ┌─────────────────┐
                    │   Relay Server   │
                    │  (collects &     │
                    │   broadcasts)    │
                    └───┬─────────┬───┘
                        │         │
              Commands  │         │  Commands
              + Turns   │         │  + Turns
                        │         │
                   ┌────▼──┐  ┌──▼────┐
                   │Client │  │Client │
                   │  A    │  │  B    │
                   │(full  │  │(full  │
                   │ sim)  │  │ sim)  │
                   └───────┘  └───────┘
```

Each game "turn" is a fixed time interval (e.g., 150ms):

1. Client collects local player commands during the turn (build, attack, demolish, etc.)
2. At turn boundary, client sends pending commands to the relay server
3. Server waits until it has commands from **all players** for turn N
4. Server packages all commands into a `TurnPacket` and broadcasts to all clients
5. All clients execute the same commands in the same deterministic order
6. Simulation advances by exactly one fixed timestep (the turn duration)
7. Repeat

If a player's commands haven't arrived, the simulation pauses — the classic "Waiting for Player..." screen. This ensures all clients stay perfectly synchronized.

### 2.4 Turn Length

| Environment | Turn Length | Effective Tick Rate | Feel |
|---|---|---|---|
| LAN (<5ms RTT) | 100ms | 10 ticks/sec | Very responsive |
| Internet (<100ms RTT) | 150ms | ~6.7 ticks/sec | Responsive |
| High latency (>200ms RTT) | 200-250ms | 4-5 ticks/sec | Noticeable but playable |

The turn length should adapt based on measured round-trip time: `turnLength = max(playerRTTs) + 50ms margin`.

### 2.5 Input Delay Mitigation

Player commands execute on a future turn (typically N+2), not immediately. To keep the game feeling responsive:

- **Immediate visual feedback:** Show a ghost/preview of the building placement or a command indicator before the turn executes.
- **Sound effects play immediately:** Audio confirmation on click, not on execution.
- **"Thinking ahead" UX:** The player's road placement mode, building catalog, and attack targeting all happen locally before the command is sent.

This matches the existing UX — the `PlacementController` already shows a ghost mesh before placement is confirmed.

---

## 3. Determinism Strategy

For lockstep to work, all clients must produce **identical simulation results** from the same inputs. Here is what needs to change.

### 3.1 Seeded PRNG

Replace all `Math.random()` in game logic with a shared seeded PRNG.

**Implementation:** Create a `GameRng` class wrapping the existing `createRng()` from `src/game/noise.ts`:

```typescript
// src/game/GameRng.ts
import { createRng } from './noise';

export class GameRng {
  private rng: () => number;

  constructor(seed: number) {
    this.rng = createRng(seed);
  }

  /** Returns a value in [0, 1) */
  next(): number {
    return this.rng();
  }

  /** Returns an integer in [0, max) */
  nextInt(max: number): number {
    return Math.floor(this.rng() * max);
  }

  /** Fisher-Yates shuffle (deterministic) */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
```

**Files to modify:**

| File | Change | Effort |
|------|--------|--------|
| `src/game/CombatManager.ts:51` | Change default: `random = gameRng.next.bind(gameRng)` | Trivial (already injectable) |
| `src/game/RandomEventManager.ts:182` | Same pattern | Trivial (already injectable) |
| `src/game/AIPlayer.ts:102,158,184,611,612,618,651` | Replace 7 `Math.random()` calls with `gameRng` methods | Low |
| `src/game/CombatAnimationState.ts:69` | **No change needed** — visual only | None |

**Seed source:** `GameConfig.seed` (already exists, used for map generation). For multiplayer, all clients receive the same seed at game start.

### 3.2 Fixed Timestep Simulation

Replace the variable `deltaTime` with fixed-step accumulator pattern in `src/engine/Game.ts`:

```typescript
const FIXED_STEP = 0.05; // 50ms = 20 simulation ticks per second
let accumulator = 0;

const animate = (): void => {
  requestAnimationFrame(animate);
  const rawDelta = Math.min(clock.getDelta(), 0.1);

  // Camera, atmosphere, shaders always update with real time
  updateVisuals(rawDelta);

  if (!paused) {
    accumulator += rawDelta * gameSpeed;
    while (accumulator >= FIXED_STEP) {
      simulationTick(FIXED_STEP); // All 21+ manager updates
      accumulator -= FIXED_STEP;
    }
  }

  // Renderers interpolate for smooth visuals
  render();
};
```

In multiplayer mode, the simulation advances exactly one fixed step per turn (lockstep). In single-player, the accumulator pattern preserves the current smooth feel while ensuring determinism.

**Key change:** All 21 manager `.update(deltaTime)` calls in `Game.ts:619-650` move into `simulationTick()`, receiving a constant `FIXED_STEP` instead of a variable `deltaTime`.

### 3.3 Deterministic Update Order

The current manager update order in `Game.ts:603-650` is already deterministic (hardcoded sequence). This is preserved as-is. However, within each manager, we must ensure:

- **Map iteration order:** JavaScript `Map` iterates in insertion order (ES2015+ spec). Since entities are created deterministically (seeded RNG, command order), iteration order is deterministic.
- **Entity processing order:** If a manager processes entities from `gameState.getAllBuildings()`, the order depends on the `Map` insertion order. This is deterministic as long as buildings are created in the same order on all clients.
- **Tie-breaking:** Pathfinding and logistics routing must break ties deterministically (e.g., by entity ID string comparison, not by arbitrary Map ordering).

### 3.4 Deterministic ID Generation

**Recommended approach: Turn-scoped deterministic IDs.**

IDs include the turn number and a per-turn sequence counter:

```typescript
// Format: entityType_turnNumber_sequenceInTurn
"building_T42_1"  // First building created in turn 42
"unit_T42_2"      // Second unit created in turn 42
```

Since all clients execute the same commands in the same order per turn, the sequence counter increments identically across clients.

**Files to modify:**
- `src/game/Building.ts:79-87` — `createBuilding()` ID generation
- `src/game/Unit.ts:63-71` — `createUnit()` ID generation
- `src/game/RoadNetwork.ts:43-44,82` — `placeFlag()`, `connectFlags()` ID generation
- `src/game/TreeManager.ts` — `createTree()` ID generation

**Alternative:** Server-assigned IDs. Simpler but adds latency (command must round-trip before entity appears). Not recommended for lockstep.

### 3.5 Checksum Validation

Periodic state checksums detect desync early:

```typescript
function computeChecksum(gameState: GameState, managers: GameManagers): number {
  let hash = 0;
  hash = hashCombine(hash, gameState.getAllBuildings().length);
  hash = hashCombine(hash, gameState.getAllUnits().length);
  hash = hashCombine(hash, managers.territoryManager.getVersion());
  // ... hash key numerical values from each manager
  return hash;
}
```

- **Frequency:** Every 10 turns (~1-1.5 seconds)
- **Comparison:** Server collects checksums from all clients. If they diverge, trigger recovery.
- **Recovery:** The host (player 1) serializes full game state via `serializeGame()` and sends it to the desynced client, who restores via `deserializeGame()`.

### 3.6 Floating-Point Safety

JavaScript uses IEEE 754 double-precision on all platforms (V8, SpiderMonkey, JavaScriptCore). For basic arithmetic (`+`, `-`, `*`, `/`), results are deterministic across browsers on the same data.

**Risks remain with:**
- `Math.sin()`, `Math.cos()` — implementation-defined precision. Not used in game logic (only rendering).
- Accumulated floating-point drift — mitigated by fixed timestep and periodic checksum validation.
- Different evaluation order — mitigated by the same JavaScript source code on all clients.

**The hex grid's integer coordinates and integer resource quantities are the strongest determinism guarantee.** Production timers use floating-point accumulation (`progress += deltaTime / productionTime`), but with a fixed `deltaTime` (from fixed timestep), all clients will accumulate identically.

---

## 4. Command System Design

### 4.1 Command Interface

```typescript
// src/game/Command.ts

interface GameCommand {
  type: CommandType;
  playerId: number;
  turnNumber: number;
}

type CommandType =
  | 'PlaceBuilding'
  | 'PlaceFlag'
  | 'ConnectFlags'
  | 'DemolishBuilding'
  | 'DemolishRoad'
  | 'DemolishFlag'
  | 'AttackBuilding'
  | 'GroupAttack'
  | 'SetRallyPoint'
  | 'ToggleBuildingPause'
  | 'StartUpgrade'
  | 'SetGoodsDistribution'
  | 'MarketplaceTrade'
  | 'SetAutoTrade'
  | 'ProposeTreaty'
  | 'RespondTreaty'
  | 'SetToolQueue'
  | 'UpgradeRoad'
  | 'SetGameSpeed'
  | 'TogglePause';
```

### 4.2 Command Types

| Command | Current Code Path | Payload |
|---|---|---|
| `PlaceBuilding` | `GameState.placeBuilding()` | `buildingType, coord: {q,r}` |
| `PlaceFlag` | `RoadNetwork.placeFlag()` | `coord: {q,r}` |
| `ConnectFlags` | `RoadNetwork.connectFlags()` | `flagACoord, flagBCoord, path: {q,r}[]` |
| `DemolishBuilding` | `GameState.removeBuilding()` | `buildingId` |
| `DemolishRoad` | `RoadNetwork.removeRoad()` | `roadId` |
| `DemolishFlag` | `RoadNetwork.removeFlag()` | `flagId` |
| `AttackBuilding` | `AttackManager.launchAttack()` | `knightIds[], targetBuildingId` |
| `GroupAttack` | `AttackManager.groupAttack()` | `knightIds[], targetBuildingId` |
| `SetRallyPoint` | Direct `building.rallyPoint = ...` | `buildingId, coord: {q,r} \| null` |
| `ToggleBuildingPause` | Direct `building.productionPaused = ...` | `buildingId` |
| `StartUpgrade` | `UpgradeManager.startUpgrade()` | `buildingId, upgradeAxis` |
| `SetGoodsDistribution` | `LogisticsManager.setDistributionSettings()` | `resourceType, settings` |
| `MarketplaceTrade` | `MarketplaceManager.executeTrade()` | `buyResource, sellResource, amount, venue` |
| `SetAutoTrade` | `MarketplaceManager.setAutoTradeRule()` | `ruleIndex, rule` |
| `ProposeTreaty` | `DiplomacyManager.proposeTreaty()` | `targetPlayerId, treatyType` |
| `RespondTreaty` | `DiplomacyManager.respondTreaty()` | `proposerId, accept` |
| `SetToolQueue` | Direct mutation on building | `buildingId, toolQueue[]` |
| `UpgradeRoad` | Direct mutation on road | `roadId, quality` |
| `SetGameSpeed` | `Game.setSpeed()` | `speed: number` (multiplayer: requires all players to agree) |
| `TogglePause` | `Game.togglePause()` | (multiplayer: requires all players to agree) |

### 4.3 Command Executor

A `CommandExecutor` class provides a single entry point for all state mutations:

```typescript
// src/game/CommandExecutor.ts

class CommandExecutor {
  constructor(
    private gameState: GameState,
    private roadNetwork: RoadNetwork,
    private managers: GameManagers,
  ) {}

  execute(command: GameCommand): CommandResult {
    // 1. Validate (is it this player's building? valid coords? enough resources?)
    const validation = this.validate(command);
    if (!validation.ok) return { success: false, error: validation.error };

    // 2. Execute (call the appropriate manager method)
    switch (command.type) {
      case 'PlaceBuilding':
        return this.placeBuilding(command as PlaceBuildingCommand);
      case 'PlaceFlag':
        return this.placeFlag(command as PlaceFlagCommand);
      // ... all command types
    }
  }
}
```

This replaces all direct mutation paths. Both human and AI actions go through the executor.

### 4.4 AI Command Generation

`src/game/AIPlayer.ts` currently calls `gameState.placeBuilding()` directly. Refactor to emit commands into the same queue:

```typescript
// Before (direct mutation):
this.gameState.placeBuilding(buildingType, coord, this.playerId);

// After (command emission):
this.commandQueue.push({
  type: 'PlaceBuilding',
  playerId: this.playerId,
  turnNumber: this.currentTurn,
  buildingType,
  coord,
});
```

AI commands are processed identically to human commands — they enter the command queue and execute during the turn.

### 4.5 Command Serialization

Commands are small (~50-100 bytes each) and serialize to JSON or MessagePack:

```typescript
// Example PlaceBuilding command on the wire:
{
  "t": "PB",              // type (abbreviated)
  "p": 1,                 // playerId
  "n": 42,                // turnNumber
  "bt": "Farm",           // buildingType
  "c": [3, 7]             // coord [q, r]
}
```

Typical bandwidth: 20-50 commands per turn * ~80 bytes = ~1-4 KB/turn = ~10-30 KB/s total. Negligible for any network.

---

## 5. Network Layer

### 5.1 Network Adapter Abstraction

A transport-agnostic interface allows the game to work with different networking backends:

```typescript
// src/game/NetworkAdapter.ts

interface NetworkAdapter {
  // Connection lifecycle
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  // Game commands
  sendCommands(turnNumber: number, commands: GameCommand[]): void;
  onTurnPacket(callback: (packet: TurnPacket) => void): void;

  // Lobby events
  onPlayerJoined(callback: (player: PlayerInfo) => void): void;
  onPlayerLeft(callback: (playerId: number) => void): void;
  onGameStart(callback: (config: MultiplayerGameConfig) => void): void;

  // Sync
  sendChecksum(turnNumber: number, checksum: number): void;
  onDesyncDetected(callback: (turnNumber: number) => void): void;
  sendStateSnapshot(state: SaveData): void;
  onStateSnapshot(callback: (state: SaveData) => void): void;

  // Diagnostics
  getLatency(): number;
}

interface TurnPacket {
  turnNumber: number;
  commandsByPlayer: Map<number, GameCommand[]>;
}
```

**Three implementations:**

| Adapter | Transport | Use Case |
|---|---|---|
| `LocalAdapter` | In-memory | Single-player (preserves current behavior) |
| `WebSocketAdapter` | WebSocket (ws) | LAN and Internet multiplayer |
| `WebRTCAdapter` | WebRTC DataChannel (PeerJS) | Future: serverless LAN P2P |

### 5.2 WebSocket Protocol

Message types between client and relay server:

```typescript
// Client → Server
type ClientMessage =
  | { type: 'JOIN_ROOM'; roomCode: string; playerName: string }
  | { type: 'CREATE_ROOM'; config: GameConfig; playerName: string }
  | { type: 'READY' }
  | { type: 'COMMANDS'; turn: number; cmds: GameCommand[] }
  | { type: 'CHECKSUM'; turn: number; hash: number }
  | { type: 'STATE_SNAPSHOT'; turn: number; data: SaveData }
  | { type: 'CHAT'; message: string }
  | { type: 'PING'; timestamp: number };

// Server → Client
type ServerMessage =
  | { type: 'ROOM_JOINED'; roomCode: string; players: PlayerInfo[]; yourPlayerId: number }
  | { type: 'PLAYER_JOINED'; player: PlayerInfo }
  | { type: 'PLAYER_LEFT'; playerId: number }
  | { type: 'GAME_START'; config: GameConfig; seed: number; playerAssignments: PlayerAssignment[] }
  | { type: 'TURN_PACKET'; turn: number; cmdsByPlayer: Record<number, GameCommand[]> }
  | { type: 'DESYNC_DETECTED'; turn: number; affectedPlayers: number[] }
  | { type: 'STATE_SNAPSHOT'; turn: number; data: SaveData }
  | { type: 'CHAT'; playerId: number; playerName: string; message: string }
  | { type: 'PONG'; timestamp: number; serverTime: number }
  | { type: 'ERROR'; message: string };
```

### 5.3 LAN Discovery

**Primary (all platforms): Manual connection with shareable link.**

1. Host creates a game → server starts on a local port (e.g., 9876)
2. Host sees their local IP addresses and a room code: `http://192.168.1.42:9876/join/ABCD`
3. Host shares the link via:
   - **QR code** displayed on screen (great for mobile — use the `qrcode` npm package)
   - **Copyable text** for clipboard/messaging
   - **Room code** (4-6 alphanumeric characters) for manual entry
4. Other players on the same network enter the IP + room code, or scan the QR code

**Enhanced (Tauri desktop app): Automatic LAN discovery.**

The Tauri app can use mDNS/Bonjour or UDP broadcast (via Rust sidecar or Tauri plugin) to advertise and discover games on the local network. Discovered games appear automatically in the lobby UI.

Note: Browsers cannot perform mDNS queries or receive UDP broadcasts directly — this enhancement is only available in the Tauri desktop app, not the plain browser version.

### 5.4 Internet Connectivity

**WebSocket relay server on a VPS.** For lockstep, bandwidth is tiny (~1-4 KB/s per player), so a $5/month VPS easily handles hundreds of concurrent games.

**Connection flow:**
1. Player opens the game → connects to the public relay server via WebSocket
2. Creates or joins a room by code
3. All game traffic flows through the relay server
4. NAT traversal is a non-issue (all clients connect outbound to the server)

**No STUN/TURN needed.** Unlike P2P architectures, a relay server avoids all NAT traversal complexity. Every client connects outbound to a known server address.

---

## 6. Server Architecture

### 6.1 Relay Server Design

The relay server is intentionally minimal — it runs **no game logic**:

```
server/
  index.ts        — Entry point, HTTP + WebSocket server (~100 lines)
  Room.ts         — Room lifecycle, player management, turn collection (~200 lines)
  protocol.ts     — Message type definitions (shared with client) (~50 lines)
  package.json    — Dependencies: ws, @msgpack/msgpack
```

**Room lifecycle:**

```
CREATE_ROOM → Room created, host assigned playerId 1
  ↓
JOIN_ROOM → Players added (up to maxPlayers)
  ↓
All READY → GAME_START broadcast with seed and player assignments
  ↓
Game loop: collect COMMANDS per turn → broadcast TURN_PACKET
  ↓
CHECKSUM comparison every 10 turns → DESYNC_DETECTED if mismatch
  ↓
Player disconnect → PLAYER_LEFT broadcast → AI takeover or pause
  ↓
Game over or all players leave → Room destroyed
```

**Turn collection logic:**

```
For each turn N:
  1. Receive COMMANDS from each player
  2. When all players have sent commands for turn N:
     - Package into TURN_PACKET
     - Broadcast to all players
  3. If a player hasn't sent commands within timeout (3s):
     - Send empty command set for that player
     - Flag them as "lagging"
  4. If a player is lagging for 10+ consecutive turns:
     - Mark as disconnected
```

### 6.2 Technology

| Component | Choice | Rationale |
|---|---|---|
| Runtime | Node.js | Same language as client; shared types |
| WebSocket library | `ws` | Fastest pure-JS implementation, no framework overhead, production-proven |
| Serialization | JSON (initially) → MessagePack (optimization) | JSON for debugging; MessagePack for ~30% size reduction |
| State | In-memory only | Rooms are ephemeral; no database needed |
| Process model | Single process | One VPS handles hundreds of concurrent rooms |

**Why not Colyseus or Nakama?**

- **Colyseus** is designed for state-sync games. Its `@colyseus/schema` system tracks property changes and sends deltas — powerful but unnecessary for lockstep (we only send commands). Using Colyseus as a pure relay wastes its main feature.
- **Nakama** is a full game backend (accounts, matchmaking, leaderboards, chat). Excellent for a production multiplayer game, but overkill for the initial implementation. Consider adopting Nakama in Phase 4 if social features are desired.
- A custom relay on `ws` is ~300 lines of code and does exactly what lockstep needs.

### 6.3 Hosting Options

| Option | Cost | Capacity | Best For |
|---|---|---|---|
| **Peer-hosted** (player runs server locally) | Free | 1 game | LAN play |
| **Fly.io / Railway** (free tier) | Free | ~5 concurrent games | Testing, small community |
| **$5 VPS** (Hetzner, DigitalOcean, Vultr) | $5/month | Hundreds of games | Production |
| **Cloudflare Durable Objects** | ~$0.50/million requests | Auto-scaling | High scale (future) |
| **Managed platform** (Hathora, Edgegap) | Pay-per-use | On-demand | Global low-latency (future) |

**Recommended path:** Start with peer-hosted for LAN (Phase 2), deploy to a $5 VPS for Internet (Phase 3), consider managed platforms only if player count demands it.

### 6.4 Shared Types

Create a `shared/` directory for types used by both client and server:

```
shared/
  protocol.ts     — Message types (ClientMessage, ServerMessage)
  commands.ts     — GameCommand types and payloads
  types.ts        — PlayerInfo, RoomConfig, TurnPacket
```

This avoids duplicating type definitions. Both `server/` and `src/` import from `shared/`.

---

## 7. Implementation Phases

### Phase 1: Determinism Foundation (2-3 weeks)

All changes benefit single-player (replays, deterministic saves). No networking yet.

| Step | Files | Description |
|---|---|---|
| 1.1 | New `src/game/GameRng.ts` | Seeded PRNG wrapper using `createRng()` from `noise.ts` |
| 1.2 | `src/game/CombatManager.ts`, `RandomEventManager.ts` | Wire injectable `random` to GameRng |
| 1.3 | `src/game/AIPlayer.ts` | Replace 7 `Math.random()` calls with GameRng |
| 1.4 | `src/engine/Game.ts` | Fixed-timestep accumulator pattern |
| 1.5 | New `src/game/Command.ts` | Command type definitions |
| 1.6 | New `src/game/CommandExecutor.ts` | Single entry point for all state mutations |
| 1.7 | `src/game/GameState.ts`, `src/game/RoadNetwork.ts` | Refactor to accept commands via executor |
| 1.8 | `src/engine/PlacementController.ts`, `RoadPlacementController.ts` | Emit commands instead of direct mutation |
| 1.9 | `src/game/AIPlayer.ts` | Emit commands instead of direct calls |
| 1.10 | New `src/game/NetworkAdapter.ts` | Adapter interface + `LocalAdapter` |
| 1.11 | New `src/game/__tests__/Determinism.test.ts` | Run same seed twice, compare state checksums |

**Acceptance criteria:**
- Game plays identically in single-player (no behavior changes)
- All 843+ existing tests pass
- New determinism test: two parallel simulations with same seed + same commands produce identical serialized state
- `npm run build && npm run lint && npm run test` passes

### Phase 2: LAN Multiplayer (3-4 weeks)

First playable multiplayer experience over local network.

| Step | Files | Description |
|---|---|---|
| 2.1 | New `server/` directory | Relay server with room management (Node.js + ws) |
| 2.2 | New `shared/` directory | Shared protocol and command types |
| 2.3 | New `src/game/WebSocketAdapter.ts` | WebSocket network adapter |
| 2.4 | `src/game/Building.ts`, `Unit.ts`, `RoadNetwork.ts`, `TreeManager.ts` | Turn-scoped deterministic ID generation |
| 2.5 | `src/engine/Game.ts` | Integrate NetworkAdapter into game loop (lockstep turn execution) |
| 2.6 | New `src/ui/LobbyPanel.ts` | Lobby UI: create game, join via IP/code, player list, ready |
| 2.7 | `src/game/GameConfig.ts` | Add multiplayer config fields (`isMultiplayer`, `hostAddress`, `roomCode`) |
| 2.8 | `src/game/SaveLoad.ts` | Save migration v14 → v15 for multiplayer fields |
| 2.9 | `src/game/FogOfWarManager.ts` | Ensure per-player fog works correctly (each client only renders own fog) |
| 2.10 | Checksum system | Periodic desync detection via state hashing |
| 2.11 | Playtesting | 2-player LAN games, various scenarios |

**Acceptance criteria:**
- Two browsers on the same network play a complete game to victory
- Buildings placed by Player A appear on Player B's screen within one turn
- Combat between players resolves identically on both clients
- Disconnection shows "Waiting for Player..." and reconnection resumes the game
- All single-player tests still pass

### Phase 3: Internet Multiplayer (2-3 weeks)

Play over the Internet with public server.

| Step | Files | Description |
|---|---|---|
| 3.1 | `server/` | Deploy relay server to VPS, add room code generation |
| 3.2 | `src/ui/LobbyPanel.ts` | Internet lobby with room codes and player list |
| 3.3 | `src/game/WebSocketAdapter.ts` | Latency measurement, adaptive turn length |
| 3.4 | Checksum + recovery | Full state sync on desync (host sends snapshot) |
| 3.5 | Reconnection | Client rejoins room, receives state snapshot, resumes |
| 3.6 | Disconnect handling | AI takeover when player disconnects, optional pause |
| 3.7 | Testing | Cross-region playtesting (simulated latency) |

**Acceptance criteria:**
- Two players in different locations play a full game over the Internet
- Reconnection after disconnect works (game state preserved)
- Latency up to 200ms feels playable
- Desyncs are detected and recovered automatically

### Phase 4: Polish (2-3 weeks)

Quality-of-life and competitive features.

| Step | Description |
|---|---|
| 4.1 | **Spectator mode** — read-only client, no commands, full map visibility |
| 4.2 | **Replay system** — record command log per game, replay deterministically |
| 4.3 | **In-game chat** — text chat between players (already in protocol) |
| 4.4 | **3-4 player support** — scaling tests, UI for player list, color assignment |
| 4.5 | **Mobile multiplayer optimization** — connection quality indicator, bandwidth monitoring |
| 4.6 | **Matchmaking** — simple public lobby with filters (map size, scenario, player count) |
| 4.7 | **Statistics** — post-game stats screen (buildings, units, resources, combat results) |

---

## 8. Impact Analysis

### 8.1 Files Modified

| File | Lines | Phase | Change Type | Effort |
|---|---|---|---|---|
| `src/engine/Game.ts` | ~1,487 | 1, 2 | Major (fixed timestep, command integration, network adapter) | High |
| `src/game/GameState.ts` | ~423 | 1 | Medium (route mutations through CommandExecutor) | Medium |
| `src/game/CombatManager.ts` | ~240 | 1 | Minor (wire GameRng — already injectable) | Low |
| `src/game/RandomEventManager.ts` | ~324 | 1 | Minor (wire GameRng — already injectable) | Low |
| `src/game/AIPlayer.ts` | ~815 | 1 | Medium (replace Math.random(), emit commands) | Medium |
| `src/game/Building.ts` | ~285 | 2 | Minor (turn-scoped ID generation) | Low |
| `src/game/Unit.ts` | ~180 | 2 | Minor (turn-scoped ID generation) | Low |
| `src/game/RoadNetwork.ts` | ~400 | 1, 2 | Medium (command routing, turn-scoped IDs) | Medium |
| `src/game/TreeManager.ts` | Variable | 2 | Minor (turn-scoped ID generation) | Low |
| `src/engine/PlacementController.ts` | ~300 | 1 | Medium (emit commands instead of direct calls) | Medium |
| `src/engine/RoadPlacementController.ts` | ~200 | 1 | Medium (emit commands instead of direct calls) | Medium |
| `src/game/GameConfig.ts` | ~130 | 2 | Minor (add multiplayer fields) | Low |
| `src/game/SaveLoad.ts` | ~809 | 2 | Minor (v14→v15 migration, snapshot methods) | Low |
| `src/game/FogOfWarManager.ts` | Variable | 2 | Minor (multiplayer client fog filtering) | Low |

### 8.2 New Files

| File | Phase | Purpose | Est. Lines |
|---|---|---|---|
| `src/game/GameRng.ts` | 1 | Seeded PRNG wrapper | ~40 |
| `src/game/Command.ts` | 1 | Command type definitions | ~150 |
| `src/game/CommandExecutor.ts` | 1 | Command validation and execution | ~300 |
| `src/game/NetworkAdapter.ts` | 1 | Adapter interface + LocalAdapter | ~120 |
| `src/game/WebSocketAdapter.ts` | 2 | WebSocket network adapter | ~250 |
| `src/ui/LobbyPanel.ts` | 2 | Multiplayer lobby UI | ~400 |
| `shared/protocol.ts` | 2 | Shared message types | ~80 |
| `shared/commands.ts` | 2 | Shared command types | ~60 |
| `server/index.ts` | 2 | Relay server entry point | ~120 |
| `server/Room.ts` | 2 | Room lifecycle and turn management | ~250 |
| `server/package.json` | 2 | Server dependencies | ~15 |
| `src/game/__tests__/Determinism.test.ts` | 1 | Determinism verification tests | ~150 |
| `src/game/__tests__/Command.test.ts` | 1 | Command system tests | ~200 |

### 8.3 Files NOT Affected

The following should require **zero changes**, thanks to the existing logic/render separation:

- All renderers in `src/engine/` (BuildingRenderer, UnitRenderer, MapRenderer, ParticleSystem, etc.)
- All UI panels (`src/ui/infopanel/`, `src/ui/buildpanel/`, `src/ui/dashboard/`, `src/ui/statspanel/`)
- Building definitions (`src/game/data/buildings/`)
- Resource/unit type definitions
- Balance constants (`src/game/data/balanceConstants.ts`)
- Map editor (`src/editor/`)
- Three.js shaders and materials
- Audio system
- Tutorial, achievements, campaign, encyclopedia

### 8.4 Estimated Effort Summary

| Phase | Scope | Estimated Duration | Dependencies |
|---|---|---|---|
| Phase 1: Determinism | GameRng, fixed timestep, command pattern, LocalAdapter | 2-3 weeks | None |
| Phase 2: LAN Multiplayer | Relay server, WebSocketAdapter, lobby UI, IDs, checksums | 3-4 weeks | Phase 1 |
| Phase 3: Internet | VPS deployment, reconnection, adaptive latency, AI takeover | 2-3 weeks | Phase 2 |
| Phase 4: Polish | Spectators, replays, chat, 3-4 players, matchmaking | 2-3 weeks | Phase 3 |
| **Total** | | **9-13 weeks** (single developer) | |

---

## 9. Testing Strategy

### 9.1 Determinism Tests

New test file: `src/game/__tests__/Determinism.test.ts`

```typescript
test('two simulations with same seed produce identical state', () => {
  const config = { seed: 12345, mapSize: 32, numPlayers: 2, ... };
  const commands = generateTestCommands(); // Predefined command sequence

  const state1 = runSimulation(config, commands, turns: 100);
  const state2 = runSimulation(config, commands, turns: 100);

  expect(serializeGame(state1)).toEqual(serializeGame(state2));
});

test('AI decisions are deterministic with seeded RNG', () => {
  // Run two games with AI, same seed, verify identical outcomes
});

test('combat outcomes are deterministic with seeded RNG', () => {
  // Set up identical combat scenarios, verify same winner
});
```

### 9.2 Command System Tests

New test file: `src/game/__tests__/Command.test.ts`

- Each command type: verify execution produces expected state change
- Invalid commands: verify rejection (wrong player, invalid coords, occupied hex, etc.)
- Serialization round-trip: `command → JSON → parse → execute` matches direct execution
- AI commands: verify AI produces valid commands that execute correctly

### 9.3 Network Integration Tests

- Two `LocalAdapter` instances in a single test process simulating two clients
- Verify turn synchronization (both advance to the same turn)
- Verify checksum agreement after N turns
- Simulate delayed/reordered messages

### 9.4 Desync Recovery Tests

- Deliberately corrupt one client's state mid-game
- Verify checksum comparison catches the divergence
- Verify state snapshot transfer restores agreement
- Game continues normally after recovery

### 9.5 Manual Playtesting Protocol

| Test | Method | Success Criteria |
|---|---|---|
| Basic LAN game | Two browser windows on localhost | Both clients see identical game state |
| Simultaneous actions | Both players place buildings in the same turn | Both buildings appear on both clients |
| Combat | Players attack each other | Same winner on both clients |
| Disconnect/reconnect | Close one browser, reopen and rejoin | Game state restored, play continues |
| Full game | Play to victory condition | Correct winner on both clients |
| Mobile LAN | Phone + desktop on same WiFi | Smooth gameplay on both |
| Internet latency | Simulated 200ms delay | Playable, no desyncs |

### 9.6 Regression

All 843+ existing tests must pass after every phase. The command pattern and fixed timestep should be transparent to existing game logic tests — `LocalAdapter` executes commands immediately, preserving current single-player behavior.

---

## 10. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Floating-point desync** between browsers | Medium | High | Fixed timestep, integer game logic, periodic checksums, state recovery |
| **Hidden `Math.random()` in game logic** | Low | High | Grep audit before each phase, CI lint rule banning `Math.random()` in `src/game/` |
| **Map iteration order divergence** | Low | High | JS Maps guarantee insertion order; document as invariant |
| **Fixed timestep breaks game feel** | Medium | Medium | Tune tick rate (20/s default); single-player uses accumulator for smooth feel |
| **Large state snapshots for reconnection** | Low | Low | Current saves are ~10-15 KB (very manageable even on mobile) |
| **Player disconnect during combat** | High | Medium | AI takeover with 30s timer; option to pause for all |
| **Game speed disagreements** | Certain | Low | Multiplayer game speed requires unanimous vote; fixed speed option |
| **Existing save format breaks** | Certain | Low | Follow established migration chain (v14→v15) per `saveload-migration` pattern |
| **Server scalability** | Low | Low | Relay is trivially lightweight; $5 VPS handles hundreds of games |
| **Mobile battery/network** | Medium | Medium | Lockstep is bandwidth-light; adaptive turn length on poor connections |

---

## 11. Open Questions

Design decisions to resolve before implementation:

### Gameplay

1. **Game speed in multiplayer:** Fixed at 1x? Or allow host to change (all clients must agree)?
2. **Pause in multiplayer:** Allow any player to pause? Require vote? Timeout auto-resume?
3. **Random events:** Enabled in competitive multiplayer? Could be seen as unfair (RNG-dependent). Option to disable.
4. **Sandbox mode in multiplayer:** Allow cooperative sandbox (no AI attacks, free building)?
5. **Diplomacy in 2-player:** Is diplomacy meaningful with only 2 players? Perhaps only enable for 3+ player games.
6. **Save/load in multiplayer:** Allow mid-game saves? Requires all clients to serialize simultaneously.

### Technical

7. **Max player count:** Start with 2, but when to enable 3-4? The existing `numPlayers: 1-4` config supports up to 4.
8. **AI slots in multiplayer:** Can a 2-human game also include AI opponents? (e.g., 2 humans + 2 AI = 4 players total)
9. **Observer/spectator limit:** How many spectators can watch a game?
10. **Disconnect timeout:** How long to wait before AI takes over (30s? 60s? configurable)?
11. **Anti-cheat:** For casual play, checksums are sufficient. For competitive, should the server run a parallel simulation? (Much more complex.)

### UX

12. **Lobby location in UI:** New tab in setup screen? Separate screen accessible from nav drawer?
13. **Player colors:** How are colors assigned? (Currently: player 1 = blue, 2 = red, etc.)
14. **Notification of opponent actions:** Should players see when the opponent places buildings (outside fog)?
15. **End-game screen:** Show both players' stats side by side?

---

## 12. Future Possibilities

Beyond Phase 4, if the multiplayer community grows:

- **Ranked matchmaking** with ELO/Glicko-2 rating system
- **Tournament mode** with brackets and scheduling
- **Team games** (2v2) with shared territory and resources
- **Cooperative PvE** mode with shared economy against AI waves
- **Map editor sharing** for custom multiplayer maps (map export/import already exists)
- **WebRTC P2P** mode for serverless LAN play (via PeerJS)
- **Cross-platform play** (Tauri desktop, Capacitor mobile, PWA browser — all running the same WebSocket client)
- **Nakama backend** for accounts, friends, leaderboards, and persistent stats

---

## 13. References

### Architecture & Networking

- **"1500 Archers on a 28.8"** — Age of Empires networking postmortem (Bettner & Terrano, GDC 2001). The foundational document for RTS lockstep networking.
- **Gaffer On Games** (gafferongames.com) — Glenn Fiedler's essential game networking articles:
  - "Fix Your Timestep" — the accumulator pattern for deterministic simulation
  - "Networked Physics" series — state sync vs deterministic lockstep
  - "Client-Server Game Architecture" — authoritative server patterns
- **Gabriel Gambetta's "Fast-Paced Multiplayer"** (gabrielgambetta.com/client-server-game-architecture.html) — client prediction and server reconciliation
- **Factorio Friday Facts** (factorio.com/blog) — FFF #76, #149, #196 on multiplayer implementation in a complex simulation game

### Technologies

- **ws** (github.com/websockets/ws) — Production WebSocket library for Node.js (~21k stars)
- **PeerJS** (peerjs.com) — Simplified WebRTC for browser P2P (~12k stars)
- **Colyseus** (colyseus.io) — Multiplayer game framework with state sync (reference, not recommended for lockstep)
- **Nakama** (heroiclabs.com) — Open-source game server (reference for future backend)
- **MessagePack** (msgpack.org) — Binary serialization format (~30% smaller than JSON)
- **coturn** (github.com/coturn/coturn) — TURN/STUN server (reference for future WebRTC P2P)

### Open-Source RTS References

- **Screeps** (github.com/screeps/screeps) — Production Node.js RTS server with tick-based simulation
- **0 A.D.** (play0ad.com) — Open-source RTS with lockstep multiplayer (C++ engine, JS game logic)
- **OpenAge** (github.com/SFTtech/openage) — Age of Empires clone with networking documentation

### Internal References

- `docs/game.md` — Core gameplay mechanics and systems
- `docs/expansion.md` — Similar-scope design document (structural reference)
- `docs/marketplace.md` — Complex system design document (structural reference)
- `src/game/noise.ts` — Existing seeded Mulberry32 PRNG (`createRng`)
- `src/game/SaveLoad.ts` — State serialization foundation
- `CLAUDE.md` — Full architecture documentation
