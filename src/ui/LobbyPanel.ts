/**
 * Multiplayer Lobby UI.
 *
 * Shown when the player selects "Multiplayer" from the setup screen.
 * Allows creating a room (host) or joining one (client).
 * Shows player list with ready states.
 * Host starts the game once all players are ready.
 */

import { WebSocketAdapter } from '../game/WebSocketAdapter';
import type { PlayerInfo } from '../../shared/types';
import { showSnackbar } from './Snackbar';
import { showSetupOverlay } from './SetupScreen';

export interface LobbyConfig {
  serverAddress: string;
  mapSeed: number;
  mapSize: number;
  scenario: string;
  difficulty: string;
  maxPlayers: number;
  aiCount: number;
  playerName: string;
}

export interface LobbyResult {
  adapter: WebSocketAdapter;
  playerId: number;
  seed: number;
  playerAssignments: { playerId: number; name: string; isHuman: boolean }[];
}

type OnGameStart = (result: LobbyResult) => void;

let lobbyOverlay: HTMLElement | null = null;
let adapter: WebSocketAdapter | null = null;
let currentPlayers: PlayerInfo[] = [];
let isHost = false;
let onGameStartCallback: OnGameStart | null = null;
let lobbyAiCount = 0;
let lobbyMaxPlayers = 2;

export function showLobby(config: LobbyConfig, onGameStart: OnGameStart): void {
  onGameStartCallback = onGameStart;
  currentPlayers = [];
  isHost = false;
  lobbyAiCount = config.aiCount;
  lobbyMaxPlayers = config.maxPlayers;

  // Create or reuse overlay
  if (!lobbyOverlay) {
    lobbyOverlay = document.createElement('div');
    lobbyOverlay.id = 'multiplayer-lobby';
    lobbyOverlay.className = 'lobby-overlay';
    document.body.appendChild(lobbyOverlay);
  }
  lobbyOverlay.style.display = 'flex';
  lobbyOverlay.innerHTML = renderConnecting();

  // Connect to server
  adapter = new WebSocketAdapter();
  setupCallbacks(config);

  adapter.connect(config.serverAddress).then(() => {
    // Connected — create or join room
    adapter!.createRoom({
      maxPlayers: config.maxPlayers,
      aiCount: config.aiCount,
      mapSeed: config.mapSeed,
      mapSize: config.mapSize,
      scenario: config.scenario,
      difficulty: config.difficulty,
    }, config.playerName);
  }).catch(err => {
    showError(`Failed to connect: ${err.message}`);
  });
}

export function joinLobby(serverAddress: string, roomCode: string, playerName: string, onGameStart: OnGameStart): void {
  onGameStartCallback = onGameStart;
  currentPlayers = [];
  isHost = false;

  if (!lobbyOverlay) {
    lobbyOverlay = document.createElement('div');
    lobbyOverlay.id = 'multiplayer-lobby';
    lobbyOverlay.className = 'lobby-overlay';
    document.body.appendChild(lobbyOverlay);
  }
  lobbyOverlay.style.display = 'flex';
  lobbyOverlay.innerHTML = renderConnecting();

  adapter = new WebSocketAdapter();
  setupCallbacks({ serverAddress, mapSeed: 0, mapSize: 0, scenario: '', difficulty: '', maxPlayers: 0, aiCount: 0, playerName });

  adapter.connect(serverAddress).then(() => {
    adapter!.joinRoom(roomCode, playerName);
  }).catch(err => {
    showError(`Failed to connect: ${err.message}`);
  });
}

export function hideLobby(): void {
  if (lobbyOverlay) {
    lobbyOverlay.style.display = 'none';
  }
}

export function getAdapter(): WebSocketAdapter | null {
  return adapter;
}

// ── Internal ────────────────────────────────────────────────────────────

function setupCallbacks(config: LobbyConfig): void {
  if (!adapter) return;

  adapter.onRoomCreated = (roomCode) => {
    isHost = true;
    currentPlayers = [{ playerId: adapter!.playerId, name: config.playerName, ready: false, latency: 0 }];
    renderLobby(roomCode, config.serverAddress);
  };

  adapter.onRoomJoined = (roomCode, players) => {
    currentPlayers = players;
    renderLobby(roomCode, config.serverAddress);
  };

  adapter.onPlayerJoined = (player) => {
    // Update existing player (ready state change) or add new player
    const existing = currentPlayers.findIndex(p => p.playerId === player.playerId);
    if (existing >= 0) {
      currentPlayers[existing] = player;
    } else {
      currentPlayers.push(player);
      showSnackbar(`${player.name} joined`);
    }
    updatePlayerList();
  };

  adapter.onPlayerLeft = (playerId) => {
    const player = currentPlayers.find(p => p.playerId === playerId);
    currentPlayers = currentPlayers.filter(p => p.playerId !== playerId);
    updatePlayerList();
    if (player) showSnackbar(`${player.name} left`);
  };

  adapter.onGameStart = (startConfig) => {
    hideLobby();
    onGameStartCallback?.({
      adapter: adapter!,
      playerId: adapter!.playerId,
      seed: startConfig.seed,
      playerAssignments: startConfig.playerAssignments,
    });
  };

  adapter.onError = (message) => {
    showSnackbar(`Error: ${message}`);
  };

  adapter.onDisconnected = () => {
    if (lobbyOverlay?.style.display !== 'none') {
      showError('Disconnected from server');
    }
  };
}

function renderConnecting(): string {
  return `
    <div class="lobby-card">
      <div class="lobby-connecting">
        <div class="mp-spinner"></div>
        <h2>Connecting...</h2>
        <p style="opacity:0.6;font-size:0.85rem;">Establishing connection to relay server</p>
      </div>
    </div>
  `;
}

function showError(message: string): void {
  if (!lobbyOverlay) return;
  lobbyOverlay.innerHTML = `
    <div class="lobby-card">
      <h2>Connection Error</h2>
      <p>${message}</p>
      <button class="btn-filled" id="lobby-error-close-btn">Close</button>
    </div>
  `;
  document.getElementById('lobby-error-close-btn')?.addEventListener('click', () => {
    hideLobby();
    showSetupOverlay();
  });
}

function renderLobby(roomCode: string, serverAddress: string): void {
  if (!lobbyOverlay) return;

  // Extract host from ws:// address for display
  const host = serverAddress.replace('ws://', '').replace('wss://', '');

  lobbyOverlay.innerHTML = `
    <div class="lobby-card">
      <h2><span class="lobby-connected-dot"></span>Multiplayer Lobby</h2>

      <div class="lobby-room-info">
        <div class="lobby-label">Room Code</div>
        <div class="lobby-code" id="lobby-room-code">${roomCode}</div>
        <button class="btn-outlined btn-sm" id="lobby-copy-btn">Copy Link</button>
      </div>

      <div class="lobby-qr" id="lobby-qr"></div>

      <div class="lobby-label">Players</div>
      <div id="lobby-player-list" class="lobby-player-list">
        ${renderPlayerList()}
      </div>

      <div class="lobby-actions">
        ${isHost ? '<button class="btn-filled" id="lobby-start-btn" disabled>Start Game</button>' : '<button class="btn-filled" id="lobby-ready-btn">Ready</button>'}
        <button class="btn-outlined" id="lobby-leave-btn">Leave</button>
      </div>
    </div>
  `;

  // Wire buttons
  document.getElementById('lobby-copy-btn')?.addEventListener('click', () => {
    const link = `${window.location.origin}?join=${roomCode}&server=${encodeURIComponent(serverAddress)}`;
    navigator.clipboard.writeText(link).then(() => showSnackbar('Link copied!'));
  });

  document.getElementById('lobby-start-btn')?.addEventListener('click', () => {
    if (isHost && adapter) {
      adapter.setReady();
    }
  });

  document.getElementById('lobby-ready-btn')?.addEventListener('click', () => {
    if (adapter) {
      adapter.setReady();
      const btn = document.getElementById('lobby-ready-btn');
      if (btn) {
        btn.textContent = 'Waiting...';
        (btn as HTMLButtonElement).disabled = true;
      }
    }
  });

  document.getElementById('lobby-leave-btn')?.addEventListener('click', () => {
    adapter?.disconnect();
    hideLobby();
    showSetupOverlay();
  });

  // Generate QR code if the library is available
  generateQR(roomCode, host);

  // Enable start button check
  checkStartEnabled();
}

function renderPlayerList(): string {
  const COLORS = ['#4488ff', '#ff4444', '#44cc44', '#ffcc00'];
  const humanSlots = lobbyMaxPlayers - lobbyAiCount;
  const AI_PERSONALITIES = ['Balanced', 'Economist', 'Militarist', 'Turtle'];

  let html = '';

  // Human player slots
  for (let i = 0; i < humanSlots; i++) {
    const player = currentPlayers[i];
    if (player) {
      html += `
        <div class="lobby-player">
          <span class="lobby-player-dot" style="background:${COLORS[i % COLORS.length]}"></span>
          <span class="lobby-player-name">${player.name}${i === 0 ? ' <span class="lobby-host-badge">Host</span>' : ''}</span>
          <span class="lobby-player-status ${player.ready ? 'lobby-status-ready' : ''}">${player.ready ? '✓ Ready' : 'Waiting...'}</span>
        </div>`;
    } else {
      html += `
        <div class="lobby-player" style="opacity:0.4">
          <span class="lobby-player-dot" style="background:${COLORS[i % COLORS.length]};opacity:0.3"></span>
          <span class="lobby-player-name">Waiting for player...</span>
          <span class="lobby-player-status">Empty</span>
        </div>`;
    }
  }

  // AI slots
  for (let i = 0; i < lobbyAiCount; i++) {
    const colorIdx = humanSlots + i;
    const personality = AI_PERSONALITIES[i % AI_PERSONALITIES.length];
    html += `
      <div class="lobby-player">
        <span class="lobby-player-dot" style="background:${COLORS[colorIdx % COLORS.length]}"></span>
        <span class="lobby-player-name">AI (${personality})</span>
        <span class="lobby-player-status lobby-status-ready">Computer</span>
      </div>`;
  }

  return html;
}

function updatePlayerList(): void {
  const list = document.getElementById('lobby-player-list');
  if (list) list.innerHTML = renderPlayerList();
  checkStartEnabled();
}

function checkStartEnabled(): void {
  const btn = document.getElementById('lobby-start-btn') as HTMLButtonElement;
  if (btn && isHost) {
    // Host can start when all human slots are filled
    const requiredHumans = lobbyMaxPlayers - lobbyAiCount;
    btn.disabled = currentPlayers.length < requiredHumans;
  }
}

async function generateQR(roomCode: string, host: string): Promise<void> {
  const container = document.getElementById('lobby-qr');
  if (!container) return;

  try {
    // Use qrcode-generator (already a project dependency)
    const qrcode = await import('qrcode-generator');
    const qr = qrcode.default(0, 'M');
    const joinUrl = `${window.location.origin}?join=${roomCode}&server=${encodeURIComponent('ws://' + host)}`;
    qr.addData(joinUrl);
    qr.make();
    container.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2 });
  } catch {
    // QR generation is optional — fail silently
    container.innerHTML = '<p style="opacity:0.5">QR code unavailable</p>';
  }
}
