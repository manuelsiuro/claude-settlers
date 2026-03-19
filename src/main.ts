import { icon } from './ui/icons';
import { Game } from './engine/Game';
import { TooltipController } from './engine/TooltipController';
import { audioManager } from './engine/AudioManager';
import { Minimap } from './engine/Minimap';
import type { GameConfig } from './game/GameConfig';
import { BUILDING_DEFINITIONS } from './game/BuildingType';
import { getPopulationSeverity } from './game/data/balanceConstants';
import type { SaveData } from './game/SaveLoad';
import { loadSettings } from './game/SettingsStorage';
import './ui/styles.css';

// Register service worker for PWA installability
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// UI modules
import { initSnackbar, showSnackbar } from './ui/Snackbar';
import { wireNotifications } from './ui/NotificationWiring';
import { initToolAlertBar, disposeToolAlertBar } from './ui/ToolAlertBar';
import { initCapacityAlertBar, disposeCapacityAlertBar } from './ui/CapacityAlertBar';
import { initGameOverScreen, showGameOver } from './ui/GameOverScreen';
import { initSetupScreen, handleLoadFromFile } from './ui/SetupScreen';
import { initAppBar, updatePauseSpeedUI, setupGameControlsPosition } from './ui/AppBar';
import {
  initBuildPanel,
  toggleBuildPanel,
  closeBuildPanel,
  stopBuildPanelUpdates,
  cancelAttackTargeting,
  populateBuildPanel,
  hideBuildPanelElement,
  hidePlacementBar,
  getPlacementElements,
} from './ui/BuildPanel';
import {
  initInfoPanel,
  showInfoPanel,
  closeInfoPanel,
  stopInfoPanelUpdates,
  hideInfoPanelElement,
} from './ui/InfoPanel';
import { initDayCycleWidget, disposeDayCycleWidget } from './ui/DayCycleWidget';
import {
  initStatsPanel,
  showStatsPanel,
  closeStatsPanel,
  stopStatsPanelUpdates,
  hideStatsPanelElement,
} from './ui/StatsPanel';
import { initDemolishDialog } from './ui/DemolishDialog';
import { initTechTreePanel } from './ui/TechTreePanel';
import { generateQrSvg } from './ui/QrCode';

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
const currentTheme = initTheme();

// ============================================================
// HTML Template
// ============================================================
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
      <li data-headline="Tech Tree">${icon('account_tree')} Tech Tree</li>
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
      <div class="nav-drawer-divider"></div>
      <li data-headline="Graphics" data-nonclickable>${icon('settings')} Graphics</li>
      <div class="graphics-settings" style="padding:4px 24px 12px;">
        <label class="audio-slider-label">Shadows</label>
        <select id="gfx-shadows" class="settings-select">
          <option value="off">Off</option>
          <option value="blob_only">Blob Only</option>
          <option value="low">Low</option>
          <option value="high">High</option>
        </select>
        <label class="audio-slider-label">Post-Processing</label>
        <select id="gfx-post" class="settings-select">
          <option value="off">Off</option>
          <option value="color_only">Color Only</option>
          <option value="full">Full (Bloom)</option>
        </select>
        <label class="audio-slider-label">Weather</label>
        <select id="gfx-weather" class="settings-select">
          <option value="none">Off</option>
          <option value="rain">Rain</option>
          <option value="snow">Snow</option>
        </select>
        <label class="audio-slider-label">Time of Day</label>
        <select id="gfx-time" class="settings-select">
          <option value="dawn">Dawn</option>
          <option value="morning">Morning</option>
          <option value="midday">Midday</option>
          <option value="golden_hour">Golden Hour</option>
          <option value="evening">Evening</option>
          <option value="night">Night</option>
          <option value="auto">Auto-Cycle</option>
        </select>
        <label class="audio-slider-label">Fog of War</label>
        <select id="gfx-fog" class="settings-select">
          <option value="on">On</option>
          <option value="off">Off</option>
        </select>
      </div>
    </ul>
  </nav>

  <div id="main-content">
    <header class="app-bar" id="app-bar">
      <button class="icon-btn" id="menu-btn" title="Menu">${icon('menu')}</button>
      <span class="app-title">${icon('crown', 'app-title-crown')} Feudal Realm Manager</span>
    </header>
    <div id="game-container"></div>
  </div>

  <!-- Minimap -->
  <div id="minimap-container" class="minimap-container"></div>

  <!-- Floating Game Controls (below minimap) -->
  <div id="game-controls-bar" class="game-controls-bar">
    <button class="icon-btn" id="pause-btn" title="Pause / Resume (Space)">
      <span id="pause-icon">${icon('pause')}</span>
      <span id="play-icon" class="hidden">${icon('play_arrow')}</span>
    </button>
    <button class="icon-btn" id="speed-btn" title="Game speed">${icon('fast_forward')}</button>
    <span id="speed-label" class="speed-label">1x</span>
    <div class="game-controls-divider"></div>
    <button class="icon-btn" id="mute-btn" title="Toggle sound">
      <span id="mute-icon-on">${icon('volume_up')}</span>
      <span id="mute-icon-off" class="hidden">${icon('volume_off')}</span>
    </button>
    <div class="game-controls-divider"></div>
    <span id="pop-counter" class="pop-counter" title="Population">${icon('people')} <span id="pop-counter-text">0/15</span></span>
  </div>

  <!-- Build Toolbar (desktop only) -->
  <div id="build-toolbar" class="build-toolbar">
    <button class="build-toolbar-tab" data-category="all" title="All">
      ${icon('construction')}<span class="build-toolbar-label">All</span>
    </button>
    <button class="build-toolbar-tab" data-category="gathering" title="Economy">
      ${icon('hammer')}<span class="build-toolbar-label">Economy</span>
    </button>
    <button class="build-toolbar-tab" data-category="processing" title="Processing">
      ${icon('settings')}<span class="build-toolbar-label">Processing</span>
    </button>
    <button class="build-toolbar-tab" data-category="military" title="Military">
      ${icon('shield_icon')}<span class="build-toolbar-label">Military</span>
    </button>
    <button class="build-toolbar-tab" data-category="logistics" title="Logistics">
      ${icon('warehouse')}<span class="build-toolbar-label">Logistics</span>
    </button>
    <button class="build-toolbar-tab" data-category="housing" title="Housing">
      ${icon('home')}<span class="build-toolbar-label">Housing</span>
    </button>
    <div class="build-toolbar-divider"></div>
    <button class="build-toolbar-tab" data-panel="stats" title="Statistics">
      ${icon('bar_chart')}<span class="build-toolbar-label">Stats</span>
    </button>
    <button class="build-toolbar-tab" data-panel="priority" title="Priority">
      ${icon('tune')}<span class="build-toolbar-label">Priority</span>
    </button>
    <button class="build-toolbar-tab" data-panel="techtree" title="Tech Tree">
      ${icon('account_tree')}<span class="build-toolbar-label">Tech Tree</span>
    </button>
  </div>

  <!-- Stats FAB (mobile only) -->
  <button id="stats-fab" class="btn-filled stats-fab">
    ${icon('bar_chart')}
  </button>

  <!-- Build FAB (mobile only) -->
  <button id="build-fab" class="btn-filled build-fab">
    ${icon('construction')}
  </button>

  <!-- Building Menu Panel -->
  <div id="build-panel" class="build-panel hidden">
    <div class="build-panel-header">
      <span class="build-panel-title">Build</span>
      <button class="icon-btn" id="build-close-btn">${icon('close')}</button>
    </div>
    <div id="build-panel-tabs" class="build-panel-tabs"></div>
    <div id="build-panel-content" class="build-panel-content"></div>
  </div>

  <!-- Build Tooltip (desktop hover) -->
  <div id="build-tooltip" class="build-tooltip"></div>

  <!-- Building Info Panel (shown when a building is selected) -->
  <div id="info-panel" class="info-panel hidden">
    <div class="info-panel-header">
      <span id="info-panel-title" class="info-panel-title"></span>
      <button class="icon-btn" id="info-close-btn">${icon('close')}</button>
    </div>
    <div id="info-panel-content" class="info-panel-content"></div>
  </div>

  <!-- Tech Tree Overlay -->
  <div id="techtree-overlay" class="techtree-overlay hidden"></div>

  <!-- Statistics Panel (tabbed: resources, pop, buildings, military, economy, priority) -->
  <div id="stats-panel" class="stats-panel hidden">
    <div class="stats-panel-header">
      <span class="stats-panel-title">Statistics</span>
      <button class="icon-btn" id="stats-close-btn">${icon('close')}</button>
    </div>
    <div id="stats-panel-tabs" class="stats-panel-tabs"></div>
    <div id="stats-panel-content" class="info-panel-content"></div>
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

  <!-- Tool Alert Bar -->
  <div id="tool-alert-bar" class="tool-alert-bar"></div>

  <!-- Capacity Alert Bar -->
  <div id="capacity-alert-bar" class="capacity-alert-bar"></div>

  <!-- Pause Overlay -->
  <div id="pause-overlay" class="pause-overlay hidden">
    <div class="pause-card">
      <h2 class="pause-title">Paused</h2>
      <p class="pause-hint">Press Space or click Resume to continue</p>
      <button id="pause-resume-btn" class="btn-filled">Resume</button>
    </div>
  </div>

  <!-- Demolish Confirmation Dialog -->
  <div id="demolish-overlay" class="demolish-overlay hidden">
    <div class="demolish-card">
      <h3 class="demolish-title">Demolish Building?</h3>
      <div id="demolish-content"></div>
      <div class="demolish-actions">
        <button id="demolish-cancel-btn" class="btn-outlined">Cancel</button>
        <button id="demolish-confirm-btn" class="btn-filled demolish-confirm-btn">Demolish</button>
      </div>
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
          <div id="setup-player-colors" class="setup-player-colors">
            <span class="setup-color-dot setup-color-you" style="background:#4488ff;" title="Player 1 (You)"></span>
          </div>
        </div>
      </div>

      <div class="setup-options-row">
        <div class="setup-field">
          <label class="setup-field-label" for="setup-landscape">Landscape</label>
          <select id="setup-landscape">
            <option value="default" selected>Default</option>
            <option value="island">Island</option>
            <option value="continent">Continent</option>
            <option value="archipelago">Archipelago</option>
          </select>
          <div id="setup-landscape-desc" class="setup-field-desc">Balanced mix of all terrain types</div>
        </div>

        <div class="setup-field">
          <label class="setup-field-label" for="setup-difficulty">Difficulty</label>
          <select id="setup-difficulty">
            <option value="easy">Easy</option>
            <option value="normal" selected>Normal</option>
            <option value="hard">Hard</option>
          </select>
          <div id="setup-difficulty-desc" class="setup-field-desc">Balanced AI with mixed economy and military</div>
        </div>
      </div>

      <div class="setup-section-toggle" id="setup-victory-toggle">
        <span class="setup-section-icon">${icon('trophy')}</span>
        <span class="setup-section-label">Victory Conditions</span>
        <span class="setup-section-chevron" id="setup-victory-chevron">${icon('chevron_right')}</span>
      </div>
      <div id="setup-victory-list" class="setup-victory-list">
        <div class="setup-victory-item">
          <span class="setup-victory-icon">${icon('skull')}</span>
          <div>
            <div class="setup-victory-name">Elimination</div>
            <div class="setup-victory-desc">Destroy all enemy castles — last player standing wins</div>
          </div>
        </div>
        <div class="setup-victory-item">
          <span class="setup-victory-icon">${icon('map')}</span>
          <div>
            <div class="setup-victory-name">Domination</div>
            <div class="setup-victory-desc">Control 75%+ of all claimable land</div>
          </div>
        </div>
        <div class="setup-victory-item">
          <span class="setup-victory-icon">${icon('crown')}</span>
          <div>
            <div class="setup-victory-name">Economic</div>
            <div class="setup-victory-desc">Accumulate 50+ gold bars across your buildings</div>
          </div>
        </div>
      </div>

      <button id="setup-start-btn" class="btn-filled setup-start-btn">
        Start Game
      </button>
      <button id="setup-continue-btn" class="btn-outlined setup-start-btn hidden" style="margin-top:8px;">
        Continue Saved Game
      </button>
      ${__NETWORK_URL__ ? `
      <div class="setup-qr-section">
        <div class="setup-qr-divider"></div>
        <div class="setup-qr-label">Scan to play on mobile</div>
        <div class="setup-qr-code">${generateQrSvg(__NETWORK_URL__, 3, 2)}</div>
        <div class="setup-qr-url">${__NETWORK_URL__}</div>
      </div>
      ` : ''}
    </div>
  </div>
`;

// ============================================================
// Game state
// ============================================================
const container = document.getElementById('game-container')!;
let game: Game | undefined;
let currentTooltip: TooltipController | undefined;
let currentMinimap: Minimap | undefined;
let popCounterInterval: ReturnType<typeof setInterval> | null = null;

/** Get the active Game instance (only call from UI handlers after game starts) */
function getGame(): Game {
  return game!;
}

// ============================================================
// Initialize all UI modules (after HTML template is set)
// ============================================================
initSnackbar();

// Init panels — each needs cross-references to close the others
initStatsPanel(getGame, closeBuildPanel, closeInfoPanel);
initInfoPanel(getGame, closeBuildPanel, closeStatsPanel);
initDemolishDialog(getGame);
initBuildPanel(getGame, closeInfoPanel, closeStatsPanel);
initGameOverScreen(getGame, stopInfoPanelUpdates, stopStatsPanelUpdates, stopBuildPanelUpdates);

initAppBar(
  () => game,
  toggleBuildPanel,
  showStatsPanel,
  () => showStatsPanel('priority'),
  () => handleLoadFromFile(startGame),
);

initTechTreePanel();
initSetupScreen(startGame);

// Initialize settings UI from persisted values
{
  const saved = loadSettings();
  (document.getElementById('vol-master') as HTMLInputElement).value = String(Math.round(saved.audio.masterVolume * 100));
  (document.getElementById('vol-sfx') as HTMLInputElement).value = String(Math.round(saved.audio.sfxVolume * 100));
  (document.getElementById('vol-music') as HTMLInputElement).value = String(Math.round(saved.audio.musicVolume * 100));
  (document.getElementById('gfx-shadows') as HTMLSelectElement).value = saved.graphics.shadows;
  (document.getElementById('gfx-post') as HTMLSelectElement).value = saved.graphics.postProcessing;
  (document.getElementById('gfx-weather') as HTMLSelectElement).value = saved.graphics.weather;
  (document.getElementById('gfx-time') as HTMLSelectElement).value = saved.graphics.timeOfDay;
  (document.getElementById('gfx-fog') as HTMLSelectElement).value = saved.graphics.fogOfWar ? 'on' : 'off';
  // Apply persisted audio volumes immediately
  audioManager.masterVolume = saved.audio.masterVolume;
  audioManager.sfxVolume = saved.audio.sfxVolume;
  audioManager.musicVolume = saved.audio.musicVolume;
  if (saved.audio.muted) audioManager.muted = true;
}

// ============================================================
// startGame — creates Game instance and wires controllers
// ============================================================
async function startGame(config: Partial<GameConfig>, savedData?: SaveData): Promise<void> {
  // Clean up any active UI state from the previous game
  disposeDayCycleWidget();
  stopInfoPanelUpdates();
  stopStatsPanelUpdates();
  stopBuildPanelUpdates();
  if (popCounterInterval) { clearInterval(popCounterInterval); popCounterInterval = null; }
  hideInfoPanelElement();
  hideStatsPanelElement();
  hideBuildPanelElement();
  hidePlacementBar();

  // Cancel active placement / attack modes before disposing the game
  if (game) {
    cancelAttackTargeting();
    game.getPlacementController()?.cancel();
    game.getRoadPlacementController()?.cancel();
  }

  // Dispose previous game + minimap if restarting
  currentMinimap?.dispose();
  currentMinimap = undefined;
  if (game) {
    disposeToolAlertBar();
    disposeCapacityAlertBar();
    game.dispose();
  }

  game = new Game(container, config);
  (window as unknown as Record<string, unknown>).__game = game;

  wireNotifications(game, showGameOver, updatePauseSpeedUI);
  initToolAlertBar(getGame);
  initCapacityAlertBar(getGame);
  updatePauseSpeedUI(false, 1);

  // Dispose previous tooltip controller
  currentTooltip?.dispose();

  await game.start(savedData);

  // Apply persisted graphics settings
  game.applyGraphicsSettings(loadSettings().graphics);

  // Set up tooltip controller
  const tooltipEl = document.getElementById('tooltip')!;
  currentTooltip = new TooltipController(game, tooltipEl);

  // Wire placement controller callbacks
  const placement = game.getPlacementController();
  if (placement) {
    const { placementBar, placementDistanceEl } = getPlacementElements();

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

  // Wire selection controller
  const selection = game.getSelectionController();
  if (selection) {
    const g = game;
    selection.onSelectionChanged = (building) => {
      if (building) {
        showInfoPanel(building);
        g.getProductionChainOverlay().show(building, g.getGameState());
        g.showWorkArea(building);
      } else {
        hideInfoPanelElement();
        stopInfoPanelUpdates();
        g.getProductionChainOverlay().clear();
        g.hideWorkArea();
      }
    };
  }

  // Wire road placement controller
  const roadCtrl = game.getRoadPlacementController();
  if (roadCtrl) {
    const { placementBar, placementLabel } = getPlacementElements();

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

  // Wire population counter updates
  const popCounterText = document.getElementById('pop-counter-text')!;
  const popCounterEl = document.getElementById('pop-counter')!;
  if (popCounterInterval) clearInterval(popCounterInterval);
  popCounterInterval = setInterval(() => {
    if (!game) return;
    const popMgr = game.getPopulationManager();
    const pid = game.getHumanPlayerId();
    const current = popMgr.getCurrentPopulation(pid);
    const capacity = popMgr.getCapacity(pid);
    popCounterText.textContent = `${current}/${capacity}`;
    const severity = getPopulationSeverity(popMgr.getUsageRatio(pid));
    popCounterEl.classList.toggle('pop-warning', severity === 'warning');
    popCounterEl.classList.toggle('pop-critical', severity === 'critical');
  }, 1000);

  const minimapContainer = document.getElementById('minimap-container')!;
  currentMinimap = new Minimap(game, minimapContainer);
  initDayCycleWidget(getGame, minimapContainer);
  setupGameControlsPosition(minimapContainer);

  populateBuildPanel();
}

// Prevent context menu on canvas for right-click cancel
container.addEventListener('contextmenu', (e) => e.preventDefault());
