import { icon, resourceIcon } from './ui/icons';
import { Game } from './engine/Game';
import { TooltipController } from './engine/TooltipController';
import { audioManager } from './engine/AudioManager';
import type { GameNotification } from './engine/Game';
import { Minimap } from './engine/Minimap';
import type { VictoryResult } from './game/VictoryManager';
import { VictoryCondition } from './game/VictoryManager';
import type { GameConfig } from './game/GameConfig';
import { BuildingType, BUILDING_DEFINITIONS, getBuildingsByTier } from './game/BuildingType';
import type { BuildingDefinition } from './game/BuildingType';
import { BuildingState, getInventoryAmount, getInventoryTotal } from './game/Building';
import type { Building, ResourceInventory } from './game/Building';
import { RESOURCE_PROPERTIES, ResourceType } from './game/ResourceType';
import { getDistanceMultiplier, getDistanceRating } from './game/ProductionManager';
import { UNIT_DEFINITIONS, UnitType } from './game/UnitType';
import {
  BUILDING_UPGRADES,
  UpgradeAxis,
  getUpgradeCost,
  getEffectiveStorageCapacity,
  getProductionSpeedMultiplier,
  getMaxWorkers,
  canUpgrade,
} from './game/BuildingUpgrade';
import {
  type SaveData,
  saveToLocalStorage,
  loadFromLocalStorage,
  downloadSave,
  loadFromFile,
  hasSave,
} from './game/SaveLoad';
import { renderEconomySection, drawEconomySparklines } from './ui/EconomyPanel';
import { renderPriorityPanel } from './ui/ResourcePriorityPanel';
import './ui/styles.css';

// ============================================================
// Theme initialization (before DOM to avoid FOUC)
// ============================================================
const THEME_KEY = 'feudal-theme';
function initTheme(): 'day' | 'night' {
  const stored = localStorage.getItem(THEME_KEY);
  const theme = (stored === 'night' || stored === 'day') ? stored
    : (matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day');
  if (theme === 'night') document.documentElement.setAttribute('data-theme', 'night');
  else document.documentElement.removeAttribute('data-theme');
  return theme;
}
let currentTheme = initTheme();

const app = document.getElementById('app')!;

app.innerHTML = `
  <!-- Navigation drawer overlay -->
  <div id="nav-overlay" class="nav-overlay"></div>

  <!-- Navigation drawer -->
  <nav id="side-panel" class="nav-drawer">
    <div class="nav-drawer-header">
      <div class="nav-drawer-header-title">Feudal Realm Manager</div>
      <div class="nav-drawer-header-version">v0.1.0</div>
    </div>
    <ul>
      <div class="nav-drawer-section-label">Game</div>
      <li data-headline="Buildings">${icon('construction')} Buildings</li>
      <li data-headline="Statistics">${icon('bar_chart')} Statistics</li>
      <li data-headline="Resource Priority">${icon('tune')} Resource Priority</li>
      <li data-headline="Minimap">${icon('map')} Minimap</li>
      <div class="nav-drawer-divider"></div>
      <div class="nav-drawer-section-label">Data</div>
      <li data-headline="Save Game">${icon('save')} Save Game</li>
      <li data-headline="Load Game">${icon('folder_open')} Load Game</li>
      <li data-headline="Download Save">${icon('download')} Download Save</li>
      <div class="nav-drawer-divider"></div>
      <li data-headline="Settings" data-nonclickable>${icon('settings')} Settings</li>
      <div class="theme-toggle-row">
        <span class="theme-toggle-label">${icon('sun')} Day</span>
        <label class="theme-toggle">
          <input type="checkbox" id="theme-toggle-input"${currentTheme === 'night' ? ' checked' : ''}>
          <span class="theme-toggle-track"></span>
        </label>
        <span class="theme-toggle-label">${icon('moon')} Night</span>
      </div>
      <div class="audio-settings" style="padding:4px 24px 12px;">
        <label class="audio-slider-label">Master Volume</label>
        <input type="range" id="vol-master" min="0" max="100" value="50" class="audio-slider">
        <label class="audio-slider-label">SFX Volume</label>
        <input type="range" id="vol-sfx" min="0" max="100" value="80" class="audio-slider">
        <label class="audio-slider-label">Music Volume</label>
        <input type="range" id="vol-music" min="0" max="100" value="30" class="audio-slider">
      </div>
    </ul>
  </nav>

  <div id="main-content">
    <header class="app-bar" id="app-bar">
      <button class="icon-btn" id="menu-btn" title="Menu">${icon('menu')}</button>
      <span class="app-title">${icon('crown', 'app-title-crown')} Feudal Realm Manager</span>
      <div style="flex:1"></div>
      <div class="app-bar-group">
        <button class="icon-btn" id="pause-btn" title="Pause / Resume (Space)">
          <span id="pause-icon">${icon('pause')}</span>
          <span id="play-icon" class="hidden">${icon('play_arrow')}</span>
        </button>
        <button class="icon-btn" id="speed-btn" title="Game speed">${icon('fast_forward')}</button>
        <span id="speed-label" class="speed-label">1x</span>
      </div>
      <div class="app-bar-group">
        <button class="icon-btn" id="mute-btn" title="Toggle sound">
          <span id="mute-icon-on">${icon('volume_up')}</span>
          <span id="mute-icon-off" class="hidden">${icon('volume_off')}</span>
        </button>
        <button class="icon-btn" id="music-btn" title="Toggle music" style="opacity:0.5">${icon('music_note')}</button>
      </div>
    </header>
    <div id="game-container"></div>
  </div>

  <!-- Minimap -->
  <div id="minimap-container" class="minimap-container"></div>

  <!-- Build FAB -->
  <button id="build-fab" class="btn-filled" style="position:fixed;bottom:24px;right:24px;z-index:var(--z-fab);width:56px;height:56px;border-radius:16px;box-shadow:0 3px 12px rgba(0,0,0,0.25);">
    ${icon('construction')}
  </button>

  <!-- Building Menu Panel -->
  <div id="build-panel" class="build-panel hidden">
    <div class="build-panel-header">
      <span class="build-panel-title">Build</span>
      <button class="icon-btn" id="build-close-btn">${icon('close')}</button>
    </div>
    <div id="build-panel-content" class="build-panel-content"></div>
  </div>

  <!-- Building Info Panel (shown when a building is selected) -->
  <div id="info-panel" class="info-panel hidden">
    <div class="info-panel-header">
      <span id="info-panel-title" class="info-panel-title"></span>
      <button class="icon-btn" id="info-close-btn">${icon('close')}</button>
    </div>
    <div id="info-panel-content" class="info-panel-content"></div>
  </div>

  <!-- Statistics Panel -->
  <div id="stats-panel" class="stats-panel hidden">
    <div class="info-panel-header">
      <span class="info-panel-title">Statistics</span>
      <button class="icon-btn" id="stats-close-btn">${icon('close')}</button>
    </div>
    <div id="stats-panel-content" class="info-panel-content"></div>
  </div>

  <!-- Resource Priority Panel -->
  <div id="priority-panel" class="stats-panel hidden">
    <div class="info-panel-header">
      <span class="info-panel-title">Resource Priority</span>
      <button class="icon-btn" id="priority-close-btn">${icon('close')}</button>
    </div>
    <div id="priority-panel-content" class="info-panel-content"></div>
  </div>

  <!-- Placement Info Bar -->
  <div id="placement-bar" class="placement-bar hidden">
    <span id="placement-label"></span>
    <span id="placement-distance" class="placement-distance" style="display:none"></span>
    <button id="placement-cancel-btn" class="btn-text">Cancel (Esc)</button>
  </div>

  <!-- Tooltip -->
  <div id="tooltip" class="game-tooltip" style="display:none"></div>

  <!-- Snackbar -->
  <div id="snackbar" class="snackbar"></div>

  <!-- Pause Overlay -->
  <div id="pause-overlay" class="pause-overlay hidden">
    <div class="pause-card">
      <h2 class="pause-title">Paused</h2>
      <p class="pause-hint">Press Space or click Resume to continue</p>
      <button id="pause-resume-btn" class="btn-filled">Resume</button>
    </div>
  </div>

  <!-- Game Over Overlay -->
  <div id="game-over-overlay" class="game-over-overlay hidden">
    <div class="game-over-card">
      <h2 id="game-over-title" class="game-over-title"></h2>
      <p id="game-over-condition" class="game-over-condition"></p>
      <div id="game-over-stats" class="game-over-stats"></div>
      <div class="game-over-actions">
        <button id="game-over-new-game-btn" class="btn-outlined">New Game</button>
        <button id="game-over-continue-btn" class="btn-filled">Continue Watching</button>
      </div>
    </div>
  </div>

  <!-- Game Setup Screen -->
  <div id="setup-overlay" class="setup-overlay">
    <div class="setup-card">
      <div class="setup-crown">${icon('crown')}</div>
      <h1 class="setup-title">Feudal Realm Manager</h1>
      <p class="setup-subtitle">Configure your world and begin your conquest</p>
      <div class="setup-divider"></div>

      <div class="setup-field">
        <label class="setup-field-label" for="setup-seed">Map Seed</label>
        <div class="setup-seed-row">
          <input type="number" id="setup-seed" value="42" min="1" max="999999">
          <button id="setup-random-seed" type="button" title="Random seed">&#x1f3b2;</button>
        </div>
      </div>

      <div class="setup-options-row">
        <div class="setup-field">
          <label class="setup-field-label" for="setup-map-size">Map Size</label>
          <select id="setup-map-size">
            <option value="24">Small (24x24)</option>
            <option value="32" selected>Medium (32x32)</option>
            <option value="48">Large (48x48)</option>
            <option value="64">Huge (64x64)</option>
          </select>
        </div>

        <div class="setup-field">
          <label class="setup-field-label" for="setup-players">Players</label>
          <select id="setup-players">
            <option value="1" selected>1 Player</option>
            <option value="2">2 Players</option>
            <option value="3">3 Players</option>
            <option value="4">4 Players</option>
          </select>
        </div>
      </div>

      <div class="setup-options-row">
        <div class="setup-field">
          <label class="setup-field-label" for="setup-scenario">Scenario</label>
          <select id="setup-scenario">
            <option value="default" selected title="Balanced terrain mix">Default</option>
            <option value="island" title="More water, land masses surrounded by sea">Island</option>
            <option value="continent" title="Mostly land, little water">Continent</option>
            <option value="archipelago" title="Many small islands, lots of water">Archipelago</option>
          </select>
        </div>

        <div class="setup-field">
          <label class="setup-field-label" for="setup-difficulty">Difficulty</label>
          <select id="setup-difficulty">
            <option value="easy">Easy</option>
            <option value="normal" selected>Normal</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      <button id="setup-start-btn" class="btn-filled setup-start-btn">
        Start Game
      </button>
      <button id="setup-continue-btn" class="btn-outlined setup-start-btn hidden" style="margin-top:8px;">
        Continue Saved Game
      </button>
    </div>
  </div>
`;

// Side panel toggle
const menuBtn = document.getElementById('menu-btn')!;
const sidePanel = document.getElementById('side-panel')!;
const navOverlay = document.getElementById('nav-overlay')!;

function openDrawer(): void {
  sidePanel.classList.add('open');
  navOverlay.classList.add('open');
}
function closeDrawer(): void {
  sidePanel.classList.remove('open');
  navOverlay.classList.remove('open');
}

menuBtn.addEventListener('click', () => {
  if (sidePanel.classList.contains('open')) closeDrawer();
  else openDrawer();
});
navOverlay.addEventListener('click', closeDrawer);

// Navigation drawer item clicks
const navItems = sidePanel.querySelectorAll('[data-headline]');
navItems.forEach((item) => {
  item.addEventListener('click', () => {
    const headline = item.getAttribute('data-headline');
    closeDrawer();
    if (headline === 'Statistics') {
      showStatsPanel();
    } else if (headline === 'Resource Priority') {
      showPriorityPanel();
    } else if (headline === 'Buildings') {
      toggleBuildPanel();
    } else if (headline === 'Save Game') {
      handleSaveGame();
    } else if (headline === 'Load Game') {
      handleLoadFromFile();
    } else if (headline === 'Download Save') {
      handleDownloadSave();
    } else {
      showSnackbar(`${headline} — coming soon`);
    }
  });
});

// ============================================================
// Theme toggle
// ============================================================
const themeToggleInput = document.getElementById('theme-toggle-input') as HTMLInputElement;
themeToggleInput.addEventListener('change', () => {
  currentTheme = themeToggleInput.checked ? 'night' : 'day';
  if (currentTheme === 'night') {
    document.documentElement.setAttribute('data-theme', 'night');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem(THEME_KEY, currentTheme);
});

// ============================================================
// Audio controls
// ============================================================

const muteBtn = document.getElementById('mute-btn')!;
const muteIconOn = document.getElementById('mute-icon-on')!;
const muteIconOff = document.getElementById('mute-icon-off')!;
const musicBtn = document.getElementById('music-btn')!;
const volMaster = document.getElementById('vol-master') as HTMLInputElement;
const volSfx = document.getElementById('vol-sfx') as HTMLInputElement;
const volMusic = document.getElementById('vol-music') as HTMLInputElement;

function updateMuteUI(): void {
  muteIconOn.classList.toggle('hidden', audioManager.muted);
  muteIconOff.classList.toggle('hidden', !audioManager.muted);
}

function updateMusicUI(): void {
  musicBtn.style.opacity = audioManager.isMusicPlaying ? '1' : '0.5';
}

muteBtn.addEventListener('click', () => {
  audioManager.muted = !audioManager.muted;
  updateMuteUI();
  updateMusicUI();
});

musicBtn.addEventListener('click', () => {
  if (audioManager.muted) return;
  if (audioManager.isMusicPlaying) {
    audioManager.stopMusic();
  } else {
    audioManager.startMusic();
  }
  updateMusicUI();
});

volMaster.addEventListener('input', () => {
  audioManager.masterVolume = Number(volMaster.value) / 100;
});
volSfx.addEventListener('input', () => {
  audioManager.sfxVolume = Number(volSfx.value) / 100;
});
volMusic.addEventListener('input', () => {
  audioManager.musicVolume = Number(volMusic.value) / 100;
});

// ============================================================
// Pause & speed controls
// ============================================================

const pauseBtn = document.getElementById('pause-btn')!;
const pauseIcon = document.getElementById('pause-icon')!;
const playIcon = document.getElementById('play-icon')!;
const speedBtn = document.getElementById('speed-btn')!;
const speedLabel = document.getElementById('speed-label')!;
const pauseOverlay = document.getElementById('pause-overlay')!;
const pauseResumeBtn = document.getElementById('pause-resume-btn')!;

function updatePauseSpeedUI(paused: boolean, speed: number): void {
  pauseIcon.classList.toggle('hidden', paused);
  playIcon.classList.toggle('hidden', !paused);
  speedLabel.textContent = `${speed}x`;
  pauseOverlay.classList.toggle('hidden', !paused);
}

pauseBtn.addEventListener('click', () => {
  if (!game) return;
  game.togglePause();
  audioManager.play('ui_click');
});

pauseResumeBtn.addEventListener('click', () => {
  if (!game) return;
  game.setPaused(false);
  audioManager.play('ui_click');
});

speedBtn.addEventListener('click', () => {
  if (!game) return;
  game.cycleSpeed();
  audioManager.play('ui_click');
});

// Spacebar to toggle pause (only when game is active and no overlay is blocking)
window.addEventListener('keydown', (e) => {
  if (!game) return;
  if (e.code !== 'Space') return;
  // Don't hijack space when typing in inputs or when setup/game-over overlay is visible
  const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  const setupOverlay = document.getElementById('setup-overlay')!;
  if (!setupOverlay.classList.contains('hidden')) return;
  e.preventDefault();
  game.togglePause();
});

// Game init — deferred until setup screen is submitted
const container = document.getElementById('game-container')!;
let game: Game | undefined;
let currentTooltip: TooltipController | undefined;

/** Get the active Game instance (only call from UI handlers after game starts) */
function getGame(): Game {
  return game!;
}

/** Show a snackbar message */
let snackbarTimeout: ReturnType<typeof setTimeout> | null = null;
function showSnackbar(message: string, type?: 'success' | 'warning' | 'error' | 'info'): void {
  snackbar.textContent = message;
  snackbar.className = 'snackbar';
  if (type === 'success') snackbar.classList.add('snackbar-success');
  else if (type === 'warning') snackbar.classList.add('snackbar-warning');
  else if (type === 'error') snackbar.classList.add('snackbar-error');
  snackbar.classList.add('show');
  if (snackbarTimeout) clearTimeout(snackbarTimeout);
  snackbarTimeout = setTimeout(() => {
    snackbar.classList.remove('show');
    snackbarTimeout = null;
  }, 3000);
}

// Game over overlay elements
const gameOverOverlay = document.getElementById('game-over-overlay')!;
const gameOverTitle = document.getElementById('game-over-title')!;
const gameOverCondition = document.getElementById('game-over-condition')!;
const gameOverStats = document.getElementById('game-over-stats')!;
const gameOverContinueBtn = document.getElementById('game-over-continue-btn')!;

const gameOverNewGameBtn = document.getElementById('game-over-new-game-btn')!;

gameOverContinueBtn.addEventListener('click', () => {
  gameOverOverlay.classList.add('hidden');
});

gameOverNewGameBtn.addEventListener('click', () => {
  gameOverOverlay.classList.add('hidden');
  const overlay = document.getElementById('setup-overlay')!;
  // Force animation replay by briefly removing the element from layout
  overlay.classList.remove('hidden');
  overlay.style.animation = 'none';
  requestAnimationFrame(() => {
    overlay.style.animation = '';
  });
});

/** Show the game over screen */
function showGameOver(result: VictoryResult): void {
  const isWin = result.winnerId === getGame().getHumanPlayerId();

  // Add icon and styled border
  const card = document.querySelector('.game-over-card') as HTMLElement;
  card.style.borderTop = `4px solid ${isWin ? 'var(--color-medieval-gold)' : '#c62828'}`;

  const existingIcon = document.querySelector('.game-over-icon');
  if (existingIcon) existingIcon.remove();
  const iconDiv = document.createElement('div');
  iconDiv.className = 'game-over-icon';
  iconDiv.style.color = isWin ? 'var(--color-medieval-gold)' : '#c62828';
  iconDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="currentColor">${isWin ? '<path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>' : '<path d="M12 2C6.48 2 2 6.48 2 12c0 3.07 1.39 5.81 3.57 7.63V22h4.86v-2h3.14v2h4.86v-2.37C20.61 17.81 22 15.07 22 12c0-5.52-4.48-10-10-10zM9 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>'}</svg>`;
  gameOverTitle.parentElement!.insertBefore(iconDiv, gameOverTitle);

  gameOverTitle.textContent = isWin ? 'Victory!' : 'Defeat';
  gameOverTitle.style.color = isWin ? '#4caf50' : '#f44336';
  if (isWin) {
    gameOverTitle.style.textShadow = '0 0 20px rgba(184, 134, 11, 0.4)';
  } else {
    gameOverTitle.style.textShadow = 'none';
  }

  const conditionLabels: Record<string, string> = {
    [VictoryCondition.Elimination]: 'All enemies have been defeated',
    [VictoryCondition.Domination]: 'Territorial domination achieved',
    [VictoryCondition.Economic]: 'Economic supremacy reached',
  };
  gameOverCondition.textContent = conditionLabels[result.condition] ?? result.condition;

  // Gather end-game stats
  const g = getGame();
  const pid = g.getHumanPlayerId();
  const gameState = g.getGameState();
  const buildings = gameState.getBuildingsByPlayer(pid);
  const units = gameState.getUnitsByPlayer(pid);
  const knights = units.filter(u => u.type === UnitType.Knight);
  const victoryMgr = g.getVictoryManager();
  const goldBars = victoryMgr.getPlayerGoldBars(pid);
  const territoryPct = Math.round(victoryMgr.getPlayerTerritoryFraction(pid) * 100);

  gameOverStats.innerHTML = `
    <div class="game-over-stat-row"><span>Buildings</span><span>${buildings.length}</span></div>
    <div class="game-over-stat-row"><span>Population</span><span>${units.length}</span></div>
    <div class="game-over-stat-row"><span>Knights</span><span>${knights.length}</span></div>
    <div class="game-over-stat-row"><span>Gold Bars</span><span>${goldBars}</span></div>
    <div class="game-over-stat-row"><span>Territory</span><span>${territoryPct}%</span></div>
  `;

  // Stop live updates — panels are hidden behind the overlay
  stopInfoPanelUpdates();
  stopStatsPanelUpdates();
  stopBuildPanelUpdates();

  gameOverOverlay.classList.remove('hidden');
}

/** Map notification types to SFX */
function notificationToSfx(type: string): import('./engine/AudioManager').SfxType {
  switch (type) {
    case 'building_complete': return 'building_complete';
    case 'knight_recruited': return 'knight_recruited';
    case 'under_attack': return 'under_attack';
    case 'building_captured': return 'building_captured';
    case 'building_destroyed': return 'building_destroyed';
    case 'combat_result': return 'combat_clash';
    case 'victory': return 'victory';
    case 'defeat': return 'defeat';
    default: return 'notification';
  }
}

/** Wire up notification handler for the active game instance */
function wireNotifications(g: Game): void {
  g.onNotification = (notification: GameNotification) => {
    showSnackbar(notification.message);
    audioManager.play(notificationToSfx(notification.type));

    if (notification.type === 'victory' || notification.type === 'defeat') {
      const victoryMgr = g.getVictoryManager();
      const result = victoryMgr.getResult();

      if (notification.type === 'defeat' && victoryMgr.isEliminated(g.getHumanPlayerId())) {
        showGameOver(result ?? { winnerId: 0, condition: VictoryCondition.Elimination });
      } else if (result) {
        showGameOver(result);
      }
    }
  };

  g.onSpeedChange = (paused: boolean, speed: number) => {
    updatePauseSpeedUI(paused, speed);
  };
}

// Build panel elements
const buildFab = document.getElementById('build-fab')!;
const buildPanel = document.getElementById('build-panel')!;
const buildCloseBtn = document.getElementById('build-close-btn')!;
const buildContent = document.getElementById('build-panel-content')!;
const placementBar = document.getElementById('placement-bar')!;
const placementLabel = document.getElementById('placement-label')!;
const placementDistanceEl = document.getElementById('placement-distance')!;
const placementCancelBtn = document.getElementById('placement-cancel-btn')!;
const snackbar = document.getElementById('snackbar')!;

// Info panel elements
const infoPanel = document.getElementById('info-panel')!;
const infoPanelTitle = document.getElementById('info-panel-title')!;
const infoPanelContent = document.getElementById('info-panel-content')!;
const infoCloseBtn = document.getElementById('info-close-btn')!;
let infoPanelUpdateInterval: ReturnType<typeof setInterval> | null = null;

// Stats panel elements
const statsPanel = document.getElementById('stats-panel')!;
const statsPanelContent = document.getElementById('stats-panel-content')!;
const statsCloseBtn = document.getElementById('stats-close-btn')!;
let statsPanelUpdateInterval: ReturnType<typeof setInterval> | null = null;

const priorityPanel = document.getElementById('priority-panel')!;
const priorityPanelContent = document.getElementById('priority-panel-content')!;
const priorityCloseBtn = document.getElementById('priority-close-btn')!;

// Build panel periodic update
let buildPanelUpdateInterval: ReturnType<typeof setInterval> | null = null;

/** Get total available resources across Castle + Warehouses for the human player */
function getPlayerResources(): Partial<Record<ResourceType, number>> {
  const totals: Partial<Record<ResourceType, number>> = {};
  const gameState = getGame().getGameState();
  const buildings = gameState.getBuildingsByPlayer(getGame().getHumanPlayerId());
  for (const b of buildings) {
    if (b.type !== BuildingType.Castle && b.type !== BuildingType.Warehouse) continue;
    if (b.state !== BuildingState.Active) continue;
    for (const [res, amount] of Object.entries(b.outputInventory)) {
      if (amount && amount > 0) {
        const r = res as ResourceType;
        totals[r] = (totals[r] ?? 0) + amount;
      }
    }
  }
  return totals;
}

/** Check if the player can afford a building's cost */
function canAfford(
  def: BuildingDefinition,
  available: Partial<Record<ResourceType, number>>,
): boolean {
  for (const c of def.cost) {
    if ((available[c.resource] ?? 0) < c.amount) return false;
  }
  return true;
}

/** Format cost with availability coloring */
function formatCostWithAvailability(
  def: BuildingDefinition,
  available: Partial<Record<ResourceType, number>>,
): string {
  if (def.cost.length === 0) return '<span class="cost-pill cost-pill-free">Free</span>';
  return def.cost
    .map((c) => {
      const have = available[c.resource] ?? 0;
      const ok = have >= c.amount;
      const cssClass = ok ? 'cost-pill cost-pill-ok' : 'cost-pill cost-pill-short';
      return `<span class="${cssClass}">${resourceIcon(c.resource)} ${RESOURCE_PROPERTIES[c.resource].label} ${c.amount}</span>`;
    })
    .join(' ');
}

/** Format production recipe summary */
function formatProductionSummary(def: BuildingDefinition): string {
  if (!def.production) {
    if (def.category === 'military') return '<span class="production-flow">Houses knights</span>';
    if (def.type === BuildingType.Warehouse) return '<span class="production-flow">Stores goods</span>';
    if (def.type === BuildingType.ForesterHut) return '<span class="production-flow">Plants trees</span>';
    return '';
  }
  const inputs = def.production.inputs.map(
    (i) => `${resourceIcon(i.resource)} ${RESOURCE_PROPERTIES[i.resource].label}`,
  );
  const outputs = def.production.outputs.map(
    (o) => `${resourceIcon(o.resource)} ${RESOURCE_PROPERTIES[o.resource].label}`,
  );
  if (inputs.length === 0) return `<span class="production-flow">Produces ${outputs.join(' ')}</span>`;
  return `<span class="production-flow">${inputs.join(' + ')} <span class="production-arrow">\u2192</span> ${outputs.join(' ')}</span>`;
}

/** Build the building menu HTML organized by tier */
function populateBuildPanel(): void {
  const tiers = [
    { tier: 1, label: 'Basic' },
    { tier: 2, label: 'Advanced' },
    { tier: 3, label: 'Specialized' },
  ];

  const available = getPlayerResources();

  let html = '';

  // Logistics section: Flag & Road buttons
  html += `<div class="build-tier" data-tier="logistics">
    <div class="build-tier-label"><span class="tier-badge tier-badge-logistics">LOG</span> Logistics</div>
    <button class="build-item" data-action="place-flag">
      <span class="build-item-name">Place Flag</span>
      <span class="build-item-cost"><span class="cost-pill cost-pill-free">Free</span></span>
      <span class="build-item-production"><span class="production-flow">Logistics node for transporters</span></span>
    </button>
    <button class="build-item" data-action="build-road">
      <span class="build-item-name">Build Road</span>
      <span class="build-item-cost"><span class="cost-pill cost-pill-free">Free</span></span>
      <span class="build-item-production"><span class="production-flow">Connect flags for transport routes</span></span>
    </button>
  </div>`;

  for (const { tier, label } of tiers) {
    const buildings = getBuildingsByTier(tier);
    html += `<div class="build-tier" data-tier="${tier}"><div class="build-tier-label"><span class="tier-badge tier-badge-${tier}">${tier}</span> ${label}</div>`;
    for (const def of buildings) {
      const affordable = canAfford(def, available);
      const disabledClass = affordable ? '' : 'build-item-disabled';
      const prodSummary = formatProductionSummary(def);
      html += `
        <button class="build-item ${disabledClass}" data-building-type="${def.type}">
          <span class="build-item-name">${def.label}</span>
          <span class="build-item-cost">${formatCostWithAvailability(def, available)}</span>
          ${prodSummary ? `<span class="build-item-production">${prodSummary}</span>` : ''}
        </button>
      `;
    }
    html += '</div>';
  }
  buildContent.innerHTML = html;
}

/** Open/close the build panel */
function toggleBuildPanel(): void {
  const wasHidden = buildPanel.classList.contains('hidden');
  buildPanel.classList.toggle('hidden');
  // Refresh availability when opening
  if (wasHidden) {
    cancelAttackTargeting();
    populateBuildPanel();
    closeInfoPanel();
    closeStatsPanel();
    closePriorityPanel();
    stopBuildPanelUpdates();
    buildPanelUpdateInterval = setInterval(populateBuildPanel, 1000);
  }
}

function closeBuildPanel(): void {
  buildPanel.classList.add('hidden');
  stopBuildPanelUpdates();
}

function stopBuildPanelUpdates(): void {
  if (buildPanelUpdateInterval !== null) {
    clearInterval(buildPanelUpdateInterval);
    buildPanelUpdateInterval = null;
  }
}

/** Enter building placement mode */
function startPlacement(type: BuildingType): void {
  closeBuildPanel();
  closeInfoPanel();
  cancelRoadPlacement();
  getGame().getSelectionController()?.deselect();
  const placement = getGame().getPlacementController();
  if (!placement) return;

  const def = BUILDING_DEFINITIONS[type];
  placement.selectBuilding(type);
  placementLabel.textContent = `Placing: ${def.label}`;
  placementBar.classList.remove('hidden');
}

/** Enter flag placement mode */
function startFlagMode(): void {
  closeBuildPanel();
  closeInfoPanel();
  cancelPlacement();
  const roadCtrl = getGame().getRoadPlacementController();
  if (!roadCtrl) return;
  roadCtrl.startFlagMode();
  placementLabel.textContent = 'Placing: Flag — click to place';
  placementBar.classList.remove('hidden');
}

/** Enter road building mode */
function startRoadMode(): void {
  closeBuildPanel();
  closeInfoPanel();
  cancelPlacement();
  const roadCtrl = getGame().getRoadPlacementController();
  if (!roadCtrl) return;
  roadCtrl.startRoadMode();
  placementLabel.textContent = 'Building Road — click a flag to start';
  placementBar.classList.remove('hidden');
}

/** Attack targeting state */
let attackSourceBuildingId: string | null = null;
/** Cleanup function for current attack mode — callable from anywhere */
let attackModeCleanup: (() => void) | null = null;

/** Cancel attack targeting if active */
function cancelAttackTargeting(): void {
  if (attackModeCleanup) {
    attackModeCleanup();
    attackModeCleanup = null;
  }
}

/** Enter attack targeting mode — click an enemy military building to send a knight */
function startAttackTargeting(sourceBuildingId: string): void {
  // Guard against double-call: cancel any existing attack mode first
  cancelAttackTargeting();

  attackSourceBuildingId = sourceBuildingId;
  closeInfoPanel();
  closeBuildPanel();
  closeStatsPanel();
  closePriorityPanel();
  cancelPlacement();
  cancelRoadPlacement();
  placementLabel.textContent = 'Attack — click an enemy military building (Esc to cancel)';
  placementBar.classList.remove('hidden');

  const selection = getGame().getSelectionController();
  if (!selection) return;

  const originalHandler = selection.onSelectionChanged;

  const onEscape = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      cancelAttackTargeting();
    }
  };
  window.addEventListener('keydown', onEscape);

  const cleanup = (): void => {
    attackSourceBuildingId = null;
    attackModeCleanup = null;
    placementBar.classList.add('hidden');
    window.removeEventListener('keydown', onEscape);
    // Restore original handler BEFORE deselecting, so deselect triggers
    // the normal handler instead of the attack handler
    selection.onSelectionChanged = originalHandler;
    selection.deselect();
  };
  attackModeCleanup = cleanup;

  selection.onSelectionChanged = (building) => {
    const humanId = getGame().getHumanPlayerId();
    if (building && building.playerId !== humanId) {
      const def = BUILDING_DEFINITIONS[building.type];
      if (def.knightSlots > 0) {
        executeAttack(attackSourceBuildingId!, building.id);
      } else {
        showSnackbar('Can only attack military buildings');
      }
    } else if (building && building.playerId === humanId) {
      showSnackbar('Cannot attack your own buildings');
    }

    cancelAttackTargeting();
  };
}

/** Execute attack: pick a knight from source building and send to target */
function executeAttack(sourceBuildingId: string, targetBuildingId: string): void {
  const gameState = getGame().getGameState();
  const source = gameState.getBuilding(sourceBuildingId);
  if (!source || source.knightIds.length === 0) {
    showSnackbar('No knights available');
    return;
  }

  const knightId = source.knightIds[0];
  const attackMgr = getGame().getAttackManager();
  const success = attackMgr.orderAttack(knightId, targetBuildingId);
  if (success) {
    showSnackbar('Attack ordered!', 'warning');
  } else {
    showSnackbar('Cannot attack this building', 'error');
  }
}

/** Cancel road placement */
function cancelRoadPlacement(): void {
  const roadCtrl = getGame().getRoadPlacementController();
  if (roadCtrl?.isActive) {
    roadCtrl.cancel();
  }
}

/** Cancel placement */
function cancelPlacement(): void {
  cancelAttackTargeting();
  const placement = getGame().getPlacementController();
  if (placement?.isActive) {
    placement.cancel();
  }
  cancelRoadPlacement();
  placementBar.classList.add('hidden');
}

// ============================================================
// Building Info Panel
// ============================================================

/** Format an inventory as HTML list */
function formatInventory(inventory: ResourceInventory): string {
  const entries = Object.entries(inventory).filter(
    ([, amount]) => amount !== undefined && amount > 0,
  );
  if (entries.length === 0) return '<span class="info-empty">Empty</span>';
  return entries
    .map(([resource, amount]) => {
      const props = RESOURCE_PROPERTIES[resource as ResourceType];
      return `<div class="info-resource-row">
        <span class="info-resource-name">${resourceIcon(resource)} ${props?.label ?? resource}</span>
        <span class="info-resource-amount">${amount}</span>
      </div>`;
    })
    .join('');
}

/** Get state label and color class */
function getStateDisplay(state: BuildingState): { label: string; cssClass: string } {
  switch (state) {
    case BuildingState.Planned:
      return { label: 'Planned', cssClass: 'state-planned' };
    case BuildingState.UnderConstruction:
      return { label: 'Under Construction', cssClass: 'state-construction' };
    case BuildingState.Active:
      return { label: 'Active', cssClass: 'state-active' };
    case BuildingState.Destroyed:
      return { label: 'Destroyed', cssClass: 'state-destroyed' };
    default:
      return { label: String(state), cssClass: '' };
  }
}

/** Build the info panel HTML for a building */
function renderInfoPanel(building: Building): void {
  const def = BUILDING_DEFINITIONS[building.type];
  const stateDisplay = getStateDisplay(building.state);

  let html = '';

  // Status
  html += `<div class="info-section">
    <div class="info-row">
      <span class="info-label">Status</span>
      <span class="info-value ${stateDisplay.cssClass}">${stateDisplay.label}</span>
    </div>`;

  // Construction progress
  if (
    building.state === BuildingState.Planned ||
    building.state === BuildingState.UnderConstruction
  ) {
    const pct = Math.round(building.constructionProgress * 100);
    html += `<div class="info-row">
      <span class="info-label">Construction</span>
      <span class="info-value">${pct}%</span>
    </div>
    <div class="info-progress-bar">
      <div class="info-progress-fill" style="width:${pct}%"></div>
    </div>`;

    // Remaining construction resources
    const remaining = def.cost
      .map((c) => {
        const delivered = building.constructionDelivered[c.resource] ?? 0;
        return { resource: c.resource, delivered, needed: c.amount };
      })
      .filter((r) => r.delivered < r.needed);

    if (remaining.length > 0) {
      html += `<div class="info-subsection-label">Resources Needed</div>`;
      for (const r of remaining) {
        const props = RESOURCE_PROPERTIES[r.resource];
        html += `<div class="info-resource-row">
          <span class="info-resource-name">${resourceIcon(r.resource)} ${props.label}</span>
          <span class="info-resource-amount">${r.delivered} / ${r.needed}</span>
        </div>`;
      }
    }
  }
  html += '</div>';

  // Worker info
  if (def.worker) {
    const gameState = getGame().getGameState();
    const primaryWorker = gameState.getWorkerForBuilding(building.id);
    const maxW = getMaxWorkers(building);
    const assignedCount = (primaryWorker ? 1 : 0) + (building.extraWorkerIds ?? []).filter((id) => gameState.getUnit(id)).length;
    const sectionLabel = maxW > 1 ? 'Workers' : 'Worker';
    html += `<div class="info-section">
      <div class="info-section-label">${icon('people')} ${sectionLabel}</div>
      <div class="info-row">
        <span class="info-label">${def.worker}</span>
        <span class="info-value ${assignedCount >= maxW ? 'state-active' : 'state-planned'}">${assignedCount}/${maxW}</span>
      </div>`;
    if (def.workerTool) {
      const toolProps = RESOURCE_PROPERTIES[def.workerTool];
      html += `<div class="info-row">
        <span class="info-label">Requires</span>
        <span class="info-value">${toolProps.label}</span>
      </div>`;
    }
    html += '</div>';
  }

  // Production info
  if (def.production && building.state === BuildingState.Active) {
    html += `<div class="info-section">
      <div class="info-section-label">${icon('hammer')} Production</div>`;

    // Inputs
    if (def.production.inputs.length > 0) {
      html += '<div class="info-subsection-label">Inputs</div>';
      for (const input of def.production.inputs) {
        const props = RESOURCE_PROPERTIES[input.resource];
        html += `<div class="info-resource-row">
          <span class="info-resource-name">${resourceIcon(input.resource)} ${props.label}</span>
          <span class="info-resource-amount">${input.amount}/cycle</span>
        </div>`;
      }
    }

    // Outputs
    html += '<div class="info-subsection-label">Outputs</div>';
    for (const output of def.production.outputs) {
      const props = RESOURCE_PROPERTIES[output.resource];
      html += `<div class="info-resource-row">
        <span class="info-resource-name">${resourceIcon(output.resource)} ${props.label}</span>
        <span class="info-resource-amount">${output.amount}/cycle</span>
      </div>`;
    }

    // Distance and efficiency info for gathering buildings
    const multiplier = def.harvestTerrain ? getDistanceMultiplier(building.resourceDistance) : 1;
    const speedMult = getProductionSpeedMultiplier(building);
    const effectiveTime = def.production.productionTime * multiplier * speedMult;
    const rating = def.harvestTerrain ? getDistanceRating(multiplier) : null;
    const progressColor = rating
      ? (multiplier <= 1.5 ? 'info-progress-perfect' : multiplier <= 2.0 ? 'info-progress-medium' : 'info-progress-poor')
      : 'info-progress-production';

    // Production progress
    if (building.hasWorker && building.productionProgress > 0) {
      const pct = Math.round(building.productionProgress * 100);
      html += `<div class="info-row" style="margin-top:8px">
        <span class="info-label">Progress</span>
        <span class="info-value">${pct}%</span>
      </div>
      <div class="info-progress-bar">
        <div class="info-progress-fill ${progressColor}" style="width:${pct}%"></div>
      </div>`;
    }

    html += `<div class="info-row">
      <span class="info-label">Cycle Time</span>
      <span class="info-value"${rating ? ` style="color:${rating.color}"` : ''}>${effectiveTime.toFixed(1)}s</span>
    </div>`;
    if (rating) {
      const efficiency = Math.round((1 / multiplier) * 100);
      html += `<div class="info-row">
        <span class="info-label">Efficiency</span>
        <span class="info-value" style="color:${rating.color}">${efficiency}%</span>
      </div>
      <div class="info-row">
        <span class="info-label">Resource Distance</span>
        <span class="info-value" style="color:${rating.color}">${building.resourceDistance} tile${building.resourceDistance !== 1 ? 's' : ''}</span>
      </div>`;
    }
    html += '</div>';
  }

  // Geologist info (no production recipe, but has special behavior)
  if (building.type === BuildingType.GeologistHut && building.state === BuildingState.Active) {
    const geoMgr = getGame().getGeologistManager();
    const ws = geoMgr.getWorkState(building.id);
    const phaseLabels: Record<string, string> = {
      idle_at_hut: 'Idle',
      walking_to_prospect: 'Walking to site',
      prospecting: 'Prospecting',
      walking_to_hut: 'Returning',
    };
    const phaseLabel = ws ? phaseLabels[ws.phase] ?? ws.phase : 'Idle';
    const prospectedCount = ws ? ws.prospectedCount : 0;

    html += `<div class="info-section">
      <div class="info-section-label">${icon('hammer')} Prospecting</div>
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value">${phaseLabel}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Tiles prospected</span>
        <span class="info-value">${prospectedCount}</span>
      </div>`;

    if (ws && ws.phase === 'prospecting') {
      const pct = Math.min(Math.round(ws.prospectProgress * 100), 100);
      html += `<div class="info-row">
        <span class="info-label">Progress</span>
        <span class="info-value">
          <div style="display:inline-block;width:60px;height:8px;background:#444;border-radius:4px;vertical-align:middle;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:#4caf50;border-radius:4px"></div>
          </div> ${pct}%
        </span>
      </div>`;
    }

    html += '</div>';
  }

  // Knight slots (military buildings)
  if (def.knightSlots > 0) {
    html += `<div class="info-section">
      <div class="info-section-label">${icon('shield_icon')} Knights</div>
      <div class="info-row">
        <span class="info-label">Stationed</span>
        <span class="info-value">${building.knightIds.length} / ${def.knightSlots}</span>
      </div>`;

    if (building.knightIds.length > 0) {
      const gameState = getGame().getGameState();
      for (const knightId of building.knightIds) {
        const knight = gameState.getUnit(knightId);
        if (knight) {
          html += `<div class="info-resource-row">
            <span class="info-resource-name">Knight</span>
            <span class="info-resource-amount">Rank ${knight.knightRank}</span>
          </div>`;
        }
      }
      // Attack button
      html += `<button class="info-attack-btn" data-building-id="${building.id}">
        Attack Enemy Building
      </button>`;
    }
    html += '</div>';
  }

  // Inventory (input + output)
  const hasInputs =
    Object.values(building.inputInventory).some((v) => v !== undefined && v > 0);
  const hasOutputs =
    Object.values(building.outputInventory).some((v) => v !== undefined && v > 0);

  if (hasInputs || hasOutputs) {
    html += '<div class="info-section">';
    html += `<div class="info-section-label">${icon('warehouse')} Inventory</div>`;
    if (hasInputs) {
      html += '<div class="info-subsection-label">Input</div>';
      html += formatInventory(building.inputInventory);
    }
    if (hasOutputs) {
      html += '<div class="info-subsection-label">Output</div>';
      html += formatInventory(building.outputInventory);
    }
    const effectiveCap = getEffectiveStorageCapacity(building);
    const totalUsed = getInventoryTotal(building.inputInventory) + getInventoryTotal(building.outputInventory);
    const pct = effectiveCap > 0 ? Math.min(100, Math.round((totalUsed / effectiveCap) * 100)) : 0;
    const barClass = pct > 85 ? 'capacity-bar-red' : pct > 60 ? 'capacity-bar-amber' : 'capacity-bar-green';
    html += `<div class="capacity-bar-wrapper">
      <div class="capacity-bar-label">
        <span class="info-label">Capacity</span>
        <span class="info-value">${totalUsed} / ${effectiveCap}</span>
      </div>
      <div class="capacity-bar-track">
        <div class="capacity-bar-fill ${barClass}" style="width:${pct}%"></div>
      </div>
    </div>`;
    html += '</div>';
  }

  // Upgrades section (only for active buildings owned by human player)
  const upgradeSpec = BUILDING_UPGRADES[building.type];
  if (upgradeSpec && building.state === BuildingState.Active && building.playerId === getGame().getHumanPlayerId()) {
    html += '<div class="info-section">';
    html += `<div class="info-section-label">${icon('hammer')} Upgrades</div>`;

    const axes: { axis: UpgradeAxis; label: string }[] = [
      { axis: UpgradeAxis.Storage, label: 'Storage' },
      { axis: UpgradeAxis.Production, label: 'Speed' },
      { axis: UpgradeAxis.Workers, label: 'Workers' },
    ];

    for (const { axis, label } of axes) {
      const config = upgradeSpec[axis];
      if (!config) continue;

      const currentLevel = building.upgradeLevels?.[axis] ?? 0;

      // Show current effect
      let effectText = '';
      if (axis === UpgradeAxis.Storage) {
        effectText = `${getEffectiveStorageCapacity(building)} cap`;
      } else if (axis === UpgradeAxis.Production) {
        const mult = getProductionSpeedMultiplier(building);
        effectText = mult < 1 ? `${Math.round((1 / mult - 1) * 100)}% faster` : 'Normal';
      } else if (axis === UpgradeAxis.Workers) {
        effectText = `${getMaxWorkers(building)} worker${getMaxWorkers(building) > 1 ? 's' : ''}`;
      }

      html += `<div class="info-row">
        <span class="info-label">${label} Lv.${currentLevel}</span>
        <span class="info-value">${effectText}</span>
      </div>`;

      if (building.activeUpgrade?.axis === axis) {
        const cost = getUpgradeCost(building.type, axis, currentLevel);
        const allDelivered = cost ? cost.every((c) => {
          const delivered = getInventoryAmount(building.activeUpgrade!.resourcesDelivered, c.resource);
          return delivered >= c.amount;
        }) : true;

        if (!allDelivered && cost) {
          // Show resource gathering progress
          const gatherParts = cost.map((c) => {
            const delivered = getInventoryAmount(building.activeUpgrade!.resourcesDelivered, c.resource);
            return `${delivered}/${c.amount} ${RESOURCE_PROPERTIES[c.resource].label}`;
          });
          html += `<div class="info-row"><span class="info-label">Gathering</span><span class="info-value">${gatherParts.join(', ')}</span></div>`;
        } else {
          // Show construction progress bar
          const pct = Math.round((building.activeUpgrade.constructionProgress ?? 0) * 100);
          html += `<div class="info-progress-bar"><div class="info-progress-fill info-progress-upgrade" style="width: ${pct}%"></div></div>`;
          html += `<div class="info-row"><span class="info-label">Building...</span><span class="info-value">${pct}%</span></div>`;
        }
        html += `<button class="info-upgrade-cancel-btn" data-building-id="${building.id}">Cancel Upgrade</button>`;
      } else if (canUpgrade(building, axis)) {
        const cost = getUpgradeCost(building.type, axis, currentLevel);
        if (cost) {
          const castle = getGame().getGameState().findCastle(building.playerId);
          const canAfford = castle ? cost.every((c) => getInventoryAmount(castle.outputInventory, c.resource) >= c.amount) : false;
          const costStr = cost.map((c) => `${c.amount} ${RESOURCE_PROPERTIES[c.resource].label}`).join(', ');
          html += `<button class="info-upgrade-btn" data-building-id="${building.id}" data-axis="${axis}"${canAfford ? '' : ' disabled'}>Upgrade (${costStr})</button>`;
        }
      } else if (currentLevel >= config.maxLevel) {
        html += `<div class="info-row"><span class="info-label"></span><span class="info-value" style="color: #4caf50;">MAX</span></div>`;
      }
    }
    html += '</div>';
  }

  // Position
  html += `<div class="info-section info-section-meta">
    <div class="info-row">
      <span class="info-label">Position</span>
      <span class="info-value">(${building.coord.q}, ${building.coord.r})</span>
    </div>
  </div>`;

  infoPanelContent.innerHTML = html;
}

/** Show the info panel for a building and start live updates */
function showInfoPanel(building: Building): void {
  const def = BUILDING_DEFINITIONS[building.type];
  infoPanelTitle.textContent = def.label;
  renderInfoPanel(building);
  infoPanel.classList.remove('hidden');

  // Close other panels when info panel opens
  closeBuildPanel();
  closeStatsPanel();
  closePriorityPanel();

  // Start live updates (every 500ms)
  stopInfoPanelUpdates();
  infoPanelUpdateInterval = setInterval(() => {
    // Re-fetch building from game state in case it was updated
    const current = getGame().getGameState().getBuilding(building.id);
    if (current) {
      renderInfoPanel(current);
    } else {
      closeInfoPanel();
    }
  }, 500);
}

function closeInfoPanel(): void {
  infoPanel.classList.add('hidden');
  stopInfoPanelUpdates();
  // Don't deselect during attack targeting — the attack handler
  // will manage selection state via its own cleanup
  if (!attackModeCleanup) {
    const selection = getGame().getSelectionController();
    if (selection?.selected) {
      selection.deselect();
    }
  }
}

function stopInfoPanelUpdates(): void {
  if (infoPanelUpdateInterval !== null) {
    clearInterval(infoPanelUpdateInterval);
    infoPanelUpdateInterval = null;
  }
}

// ============================================================
// Statistics Panel
// ============================================================

/** Gather total resources across all human player's buildings */
function getAllPlayerResources(): Partial<Record<ResourceType, number>> {
  const totals: Partial<Record<ResourceType, number>> = {};
  const gameState = getGame().getGameState();
  const buildings = gameState.getBuildingsByPlayer(getGame().getHumanPlayerId());
  for (const b of buildings) {
    for (const inv of [b.inputInventory, b.outputInventory]) {
      for (const [res, amount] of Object.entries(inv)) {
        if (amount && amount > 0) {
          const r = res as ResourceType;
          totals[r] = (totals[r] ?? 0) + amount;
        }
      }
    }
  }
  return totals;
}

/** Get unit counts by type for a player */
function getPopulationBreakdown(): { type: string; label: string; count: number }[] {
  const gameState = getGame().getGameState();
  const units = gameState.getUnitsByPlayer(getGame().getHumanPlayerId());
  const counts = new Map<string, number>();
  for (const u of units) {
    counts.set(u.type, (counts.get(u.type) ?? 0) + 1);
  }
  const result: { type: string; label: string; count: number }[] = [];
  for (const [type, count] of counts) {
    const def = UNIT_DEFINITIONS[type as UnitType];
    result.push({ type, label: def?.label ?? type, count });
  }
  result.sort((a, b) => b.count - a.count);
  return result;
}

/** Render the statistics panel HTML */
function renderStatsPanel(): void {
  const resources = getAllPlayerResources();
  const population = getPopulationBreakdown();
  const pid = getGame().getHumanPlayerId();
  const gameState = getGame().getGameState();
  const buildings = gameState.getBuildingsByPlayer(pid);
  const totalUnits = gameState.getUnitsByPlayer(pid).length;

  let html = '';

  // Resources section
  html += `<div class="info-section"><div class="info-section-label">${icon('warehouse')} Resources</div>`;
  const rawResources = [
    ResourceType.Wood, ResourceType.Stone, ResourceType.Grain,
    ResourceType.Fish, ResourceType.IronOre, ResourceType.CoalOre, ResourceType.GoldOre,
  ];
  const processedResources = [
    ResourceType.Planks, ResourceType.Flour, ResourceType.Bread,
    ResourceType.Meat, ResourceType.IronBars, ResourceType.GoldBars,
    ResourceType.Tools, ResourceType.Swords, ResourceType.Shields,
  ];

  html += '<div class="info-subsection-label">Raw Materials</div>';
  for (const r of rawResources) {
    const amount = resources[r] ?? 0;
    const zeroClass = amount === 0 ? ' resource-pill-zero' : '';
    html += `<div class="info-resource-row">
      <span class="info-resource-name">${resourceIcon(r)} ${RESOURCE_PROPERTIES[r].label}</span>
      <span class="resource-pill${zeroClass}">${amount}</span>
    </div>`;
  }

  html += '<div class="info-subsection-label">Processed Goods</div>';
  for (const r of processedResources) {
    const amount = resources[r] ?? 0;
    const zeroClass = amount === 0 ? ' resource-pill-zero' : '';
    html += `<div class="info-resource-row">
      <span class="info-resource-name">${resourceIcon(r)} ${RESOURCE_PROPERTIES[r].label}</span>
      <span class="resource-pill${zeroClass}">${amount}</span>
    </div>`;
  }
  html += '</div>';

  // Population section
  html += `<div class="info-section"><div class="info-section-label">${icon('people')} Population</div>`;
  html += `<div class="stat-highlight">
    <span class="info-label">Total Units</span>
    <span class="stat-highlight-value">${totalUnits}</span>
  </div>`;
  for (const p of population) {
    html += `<div class="info-resource-row">
      <span class="info-resource-name">${p.label}</span>
      <span class="info-resource-amount">${p.count}</span>
    </div>`;
  }
  html += '</div>';

  // Buildings section
  const buildingCounts = new Map<string, number>();
  let activeBuildings = 0;
  let constructing = 0;
  for (const b of buildings) {
    buildingCounts.set(b.type, (buildingCounts.get(b.type) ?? 0) + 1);
    if (b.state === BuildingState.Active) activeBuildings++;
    if (b.state === BuildingState.Planned || b.state === BuildingState.UnderConstruction) constructing++;
  }
  html += `<div class="info-section"><div class="info-section-label">${icon('hammer')} Buildings</div>`;
  html += `<div class="stat-highlight">
    <span class="info-label">Active</span>
    <span class="stat-highlight-value">${activeBuildings}</span>
  </div>`;
  if (constructing > 0) {
    html += `<div class="info-row">
      <span class="info-label">Under Construction</span>
      <span class="info-value">${constructing}</span>
    </div>`;
  }
  for (const [type, count] of buildingCounts) {
    const def = BUILDING_DEFINITIONS[type as BuildingType];
    html += `<div class="info-resource-row">
      <span class="info-resource-name">${def?.label ?? type}</span>
      <span class="info-resource-amount">${count}</span>
    </div>`;
  }
  html += '</div>';

  // Military section
  const knights = gameState.getUnitsByPlayer(pid).filter(u => u.type === UnitType.Knight);
  const goldBars = resources[ResourceType.GoldBars] ?? 0;
  html += `<div class="info-section"><div class="info-section-label">${icon('shield_icon')} Military</div>`;
  html += `<div class="stat-highlight">
    <span class="info-label">Knights</span>
    <span class="stat-highlight-value">${knights.length}</span>
  </div>`;
  html += `<div class="info-row">
    <span class="info-label">Gold Bars</span>
    <span class="info-value">${goldBars}</span>
  </div>`;
  if (knights.length > 0) {
    const avgRank = knights.reduce((sum, k) => sum + k.knightRank, 0) / knights.length;
    html += `<div class="info-row">
      <span class="info-label">Avg Rank</span>
      <span class="info-value">${avgRank.toFixed(1)}</span>
    </div>`;
  }
  html += '</div>';

  // Economy section
  const tracker = getGame().getEconomyTracker();
  html += renderEconomySection(tracker);

  statsPanelContent.innerHTML = html;

  // Draw sparkline canvases after DOM update
  drawEconomySparklines(statsPanelContent, tracker);
}

function showStatsPanel(): void {
  renderStatsPanel();
  statsPanel.classList.remove('hidden');
  closeBuildPanel();
  closeInfoPanel();
  closePriorityPanel();

  // Live updates
  stopStatsPanelUpdates();
  statsPanelUpdateInterval = setInterval(renderStatsPanel, 1000);
}

function closeStatsPanel(): void {
  statsPanel.classList.add('hidden');
  stopStatsPanelUpdates();
}

function stopStatsPanelUpdates(): void {
  if (statsPanelUpdateInterval !== null) {
    clearInterval(statsPanelUpdateInterval);
    statsPanelUpdateInterval = null;
  }
}

function showPriorityPanel(): void {
  if (!game) return;
  priorityPanel.classList.remove('hidden');
  closeBuildPanel();
  closeInfoPanel();
  closeStatsPanel();
  renderPriorityPanel(priorityPanelContent, getGame());
}

function closePriorityPanel(): void {
  priorityPanel.classList.add('hidden');
}

// Event listeners
buildFab.addEventListener('click', toggleBuildPanel);
buildCloseBtn.addEventListener('click', closeBuildPanel);
placementCancelBtn.addEventListener('click', cancelPlacement);
statsCloseBtn.addEventListener('click', closeStatsPanel);
priorityCloseBtn.addEventListener('click', closePriorityPanel);
infoCloseBtn.addEventListener('click', closeInfoPanel);

// Event delegation for info panel buttons (avoids re-attaching handlers on every render)
infoPanelContent.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('.info-attack-btn') as HTMLElement | null;
  if (target?.dataset.buildingId) {
    startAttackTargeting(target.dataset.buildingId);
  }

  const upgradeBtn = (e.target as HTMLElement).closest('.info-upgrade-btn') as HTMLElement | null;
  if (upgradeBtn?.dataset.buildingId && upgradeBtn?.dataset.axis) {
    const ok = getGame().getUpgradeManager().startUpgrade(
      upgradeBtn.dataset.buildingId,
      upgradeBtn.dataset.axis as UpgradeAxis,
    );
    if (ok) {
      const building = getGame().getGameState().getBuilding(upgradeBtn.dataset.buildingId);
      if (building) renderInfoPanel(building);
    }
  }

  const cancelBtn = (e.target as HTMLElement).closest('.info-upgrade-cancel-btn') as HTMLElement | null;
  if (cancelBtn?.dataset.buildingId) {
    const cancelled = getGame().getUpgradeManager().cancelUpgrade(cancelBtn.dataset.buildingId);
    if (cancelled) {
      const building = getGame().getGameState().getBuilding(cancelBtn.dataset.buildingId);
      if (building) renderInfoPanel(building);
    }
  }
});

// Event delegation for build panel buttons (avoids re-attaching handlers on every populateBuildPanel)
buildContent.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.build-item') as HTMLElement | null;
  if (!btn) return;
  if (btn.classList.contains('build-item-disabled')) return;
  const action = btn.dataset.action;
  audioManager.play('ui_click');
  if (action === 'place-flag') {
    startFlagMode();
    return;
  }
  if (action === 'build-road') {
    startRoadMode();
    return;
  }
  const type = btn.dataset.buildingType as BuildingType;
  if (type) {
    startPlacement(type);
  }
});

let currentMinimap: Minimap | undefined;

/** Initialize and start the game with the given config, optionally restoring saved state */
async function startGame(config: Partial<GameConfig>, savedData?: SaveData): Promise<void> {
  // Clean up any active UI state from the previous game
  stopInfoPanelUpdates();
  stopStatsPanelUpdates();
  stopBuildPanelUpdates();
  infoPanel.classList.add('hidden');
  statsPanel.classList.add('hidden');
  buildPanel.classList.add('hidden');
  placementBar.classList.add('hidden');
  // Cancel active placement / attack modes before disposing the game so
  // cleanup closures don't fire against the disposed SelectionController
  if (game) {
    cancelAttackTargeting();
    game.getPlacementController()?.cancel();
    game.getRoadPlacementController()?.cancel();
  }

  // Dispose previous game + minimap if restarting
  currentMinimap?.dispose();
  currentMinimap = undefined;
  if (game) {
    game.dispose();
  }

  game = new Game(container, config);
  (window as unknown as Record<string, unknown>).__game = game;

  wireNotifications(game);
  updatePauseSpeedUI(false, 1); // Reset pause/speed UI for new game

  // Dispose previous tooltip controller
  currentTooltip?.dispose();

  await game.start(savedData);

  // Set up tooltip controller
  const tooltipEl = document.getElementById('tooltip')!;
  currentTooltip = new TooltipController(game, tooltipEl);

  const placement = game.getPlacementController();
  if (placement) {
    placement.onBuildingPlaced = (type) => {
      const def = BUILDING_DEFINITIONS[type];
      showSnackbar(`${def.label} placed!`, 'success');
      audioManager.play('building_placed');
    };
    placement.onPlacementError = (error) => {
      const messages: Record<string, string> = {
        no_matching_deposit: 'Requires a prospected deposit — use a Geologist\'s Hut first',
        outside_territory: 'Outside your territory',
        invalid_terrain: 'Can\'t build here — invalid terrain',
        tile_occupied: 'Tile is already occupied',
        no_adjacent_terrain: 'No suitable terrain nearby',
        tile_not_found: 'Invalid tile',
      };
      showSnackbar(messages[error] ?? `Can't place here: ${error}`, 'error');
    };
    placement.onModeChanged = (active) => {
      if (!active) {
        placementBar.classList.add('hidden');
        placementDistanceEl.style.display = 'none';
      }
      if (active) {
        closeInfoPanel();
      }
    };
    placement.onPreviewUpdated = () => {
      const dist = placement.placementDistance;
      const rating = placement.placementRating;
      if (dist !== null && rating) {
        placementDistanceEl.style.display = '';
        placementDistanceEl.style.color = rating.color;
        placementDistanceEl.innerHTML =
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${rating.color};margin-right:4px;vertical-align:middle"></span>` +
          `Distance: ${dist} tile${dist !== 1 ? 's' : ''} — ${rating.label}`;
      } else {
        placementDistanceEl.style.display = 'none';
      }
    };
  }

  const selection = game.getSelectionController();
  if (selection) {
    const g = game; // capture non-null reference for closure
    selection.onSelectionChanged = (building) => {
      if (building) {
        showInfoPanel(building);
        g.getProductionChainOverlay().show(building, g.getGameState());
      } else {
        infoPanel.classList.add('hidden');
        stopInfoPanelUpdates();
        g.getProductionChainOverlay().clear();
      }
    };
  }

  const roadCtrl = game.getRoadPlacementController();
  if (roadCtrl) {
    roadCtrl.onModeChanged = (mode) => {
      if (!mode) {
        placementBar.classList.add('hidden');
      }
    };
    roadCtrl.onFlagPlaced = () => {
      showSnackbar('Flag placed!', 'success');
      audioManager.play('flag_placed');
    };
    roadCtrl.onRoadBuilt = () => {
      showSnackbar('Road built!', 'success');
      audioManager.play('road_built');
      placementLabel.textContent = 'Building Road — click next hex to continue';
    };
  }

  const minimapContainer = document.getElementById('minimap-container')!;
  currentMinimap = new Minimap(game, minimapContainer);

  populateBuildPanel();
}

// ============================================================
// Save / Load
// ============================================================

/** Save the current game to localStorage */
function handleSaveGame(): void {
  if (!game) {
    showSnackbar('No game in progress');
    return;
  }
  try {
    const data = game.serialize();
    saveToLocalStorage(data);
    showSnackbar('Game saved', 'success');
  } catch (err) {
    console.error('Save failed:', err);
    showSnackbar('Save failed — storage may be full', 'error');
  }
}

/** Download the current save as a JSON file */
function handleDownloadSave(): void {
  if (!game) {
    showSnackbar('No game in progress');
    return;
  }
  try {
    const data = game.serialize();
    downloadSave(data);
    showSnackbar('Save file downloaded', 'success');
  } catch (err) {
    console.error('Download save failed:', err);
    showSnackbar('Failed to download save', 'error');
  }
}

/** Load a game from a JSON file */
async function handleLoadFromFile(): Promise<void> {
  try {
    const data = await loadFromFile();
    if (!data) {
      showSnackbar('No valid save file selected', 'warning');
      return;
    }
    setupOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    await startGame(data.config, data);
    showSnackbar('Game loaded from file', 'success');
  } catch (err) {
    console.error('Load failed:', err);
    showSnackbar('Failed to load save file', 'error');
  }
}

/** Load game from localStorage (called from setup screen) */
async function handleLoadFromStorage(): Promise<void> {
  const data = loadFromLocalStorage();
  if (!data) {
    showSnackbar('No save found');
    return;
  }
  try {
    setupOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    await startGame(data.config, data);
    showSnackbar('Game loaded', 'success');
  } catch (err) {
    console.error('Load failed:', err);
    showSnackbar('Failed to load saved game', 'error');
    setupOverlay.classList.remove('hidden');
  }
}

// ============================================================
// Game Setup Screen
// ============================================================

const setupOverlay = document.getElementById('setup-overlay')!;
const setupSeedInput = document.getElementById('setup-seed') as HTMLInputElement;
const setupRandomSeedBtn = document.getElementById('setup-random-seed')!;
const setupMapSizeSelect = document.getElementById('setup-map-size') as HTMLSelectElement;
const setupPlayersSelect = document.getElementById('setup-players') as HTMLSelectElement;
const setupScenarioSelect = document.getElementById('setup-scenario') as HTMLSelectElement;
const setupDifficultySelect = document.getElementById('setup-difficulty') as HTMLSelectElement;
const setupStartBtn = document.getElementById('setup-start-btn')!;

const setupContinueBtn = document.getElementById('setup-continue-btn')!;

// Show "Continue Saved Game" button if a save exists in localStorage
if (hasSave()) {
  setupContinueBtn.classList.remove('hidden');
}

setupContinueBtn.addEventListener('click', () => {
  handleLoadFromStorage();
});

setupRandomSeedBtn.addEventListener('click', () => {
  setupSeedInput.value = String(Math.floor(Math.random() * 999999) + 1);
});

setupStartBtn.addEventListener('click', () => {
  const rawSeed = Number(setupSeedInput.value);
  const config: Partial<GameConfig> = {
    seed: rawSeed > 0 ? Math.floor(rawSeed) : 42,
    mapSize: Number(setupMapSizeSelect.value) as GameConfig['mapSize'],
    numPlayers: Number(setupPlayersSelect.value),
    scenario: setupScenarioSelect.value as GameConfig['scenario'],
    difficulty: setupDifficultySelect.value as GameConfig['difficulty'],
  };

  setupOverlay.classList.add('hidden');

  startGame(config).catch((err) => {
    console.error('Failed to start game:', err);
    showSnackbar('Failed to load game assets. Please reload the page.', 'error');
    setupOverlay.classList.remove('hidden');
  });
});

// Prevent context menu on canvas for right-click cancel
container.addEventListener('contextmenu', (e) => e.preventDefault());
