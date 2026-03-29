import { Game } from './engine/Game';
import { TooltipController } from './engine/TooltipController';
import { audioManager } from './engine/AudioManager';
import type { Minimap } from './engine/Minimap';
import type { GameConfig } from './game/GameConfig';
import { loadBalanceConfig } from './game/data/BalanceConfigLoader';
import type { SaveData } from './game/SaveLoad';
import { loadSettings } from './game/SettingsStorage';
import { MapEditorUI } from './editor/MapEditorUI';
import type { MapData } from './game/MapData';
import './ui/styles.css';

// PWA service worker registration is handled by vite-plugin-pwa (Workbox auto-update)

// Capacitor back button handling (Android hardware back)
import { Capacitor } from '@capacitor/core';
if (Capacitor.isNativePlatform()) {
  import('@capacitor/app').then(({ App }) => {
    App.addListener('backButton', ({ canGoBack }) => {
      // Close building detail sheet first (mobile)
      const detailSheet = document.getElementById('building-detail-sheet');
      if (detailSheet && !detailSheet.classList.contains('hidden')) {
        detailSheet.classList.add('hidden');
        return;
      }

      // Close panels in priority order instead of navigating away
      const panels = [
        'dashboard-overlay', 'techtree-overlay', 'info-panel',
        'stats-panel', 'build-panel', 'game-over-overlay',
        'demolish-overlay', 'pause-overlay',
      ];
      for (const id of panels) {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('hidden')) {
          el.classList.add('hidden');
          return;
        }
      }
      // Close nav drawer if open
      const nav = document.getElementById('side-panel');
      if (nav?.classList.contains('open')) {
        nav.classList.remove('open');
        document.getElementById('nav-overlay')?.classList.remove('active');
        return;
      }
      // If on setup screen, minimize app; otherwise go back
      if (canGoBack) {
        window.history.back();
      } else {
        App.minimizeApp();
      }
    });
  });
}

// Android: env(safe-area-inset-bottom) returns 0px — detect via UA and set via CSS class
// Works in both Capacitor and mobile browser
if (/android/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('platform-android');
}

// UI modules
import { initSnackbar, showSnackbar } from './ui/Snackbar';
import { wireNotifications } from './ui/NotificationWiring';
import { initToolAlertBar, disposeToolAlertBar } from './ui/ToolAlertBar';
import { initCapacityAlertBar, disposeCapacityAlertBar } from './ui/CapacityAlertBar';
import { initFoodAlertBar, disposeFoodAlertBar } from './ui/FoodAlertBar';
import { initMobileAlertConsolidator, disposeMobileAlertConsolidator } from './ui/MobileAlertConsolidator';
import { initTutorial, disposeTutorial } from './ui/TutorialSystem';
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
  showFlagInfoPanel,
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
import { initDashboard, showDashboard } from './ui/DashboardPanel';
import { initVictoryProgressHUD, disposeVictoryProgressHUD } from './ui/VictoryProgressHUD';
import { initResourceBar, disposeResourceBar } from './ui/ResourceBar';
import { showLoadingScreen, updateLoadingProgress, hideLoadingScreen } from './ui/LoadingScreen';
import { autoSaveToSlot } from './game/SaveLoad';
import { initEventLog, disposeEventLog } from './ui/EventLog';
import { initEncyclopedia } from './ui/EncyclopediaPanel';
import { initKeyboardShortcuts } from './ui/KeyboardShortcuts';
import { initDiplomacyPanel } from './ui/DiplomacyPanel';
import { recordGameStart, unlockAchievement } from './ui/Achievements';
import { HexGrid } from './game/HexGrid';

// Extracted modules
import { getGameHTML } from './ui/GameHTML';
import { wireMobileToolbar, wireGameControllers } from './ui/GameWiring';

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

app.innerHTML = getGameHTML(currentTheme);

// ============================================================
// Game state
// ============================================================
const container = document.getElementById('game-container')!;
let game: Game | undefined;
let currentTooltip: TooltipController | undefined;
let currentMinimap: Minimap | undefined;
let popCounterInterval: ReturnType<typeof setInterval> | null = null;
let autoSaveInterval: ReturnType<typeof setInterval> | null = null;
let currentEditor: MapEditorUI | undefined;

/** Auto-save interval in ms (2 minutes) */
const AUTO_SAVE_INTERVAL = 2 * 60 * 1000;

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
initDashboard(getGame);
initEncyclopedia();
initDiplomacyPanel(() => game);
initKeyboardShortcuts({
  getGame: () => game,
  toggleBuildPanel,
  showStatsPanel,
  showDashboard,
});
initSetupScreen(startGame, openMapEditor);

// ============================================================
// Mobile Bottom Toolbar
// ============================================================
wireMobileToolbar({
  getGame: () => game,
  toggleBuildPanel,
  showStatsPanel,
  closeStatsPanel,
});

// Initialize settings UI from persisted values
{
  const saved = loadSettings();
  (document.getElementById('vol-master') as HTMLInputElement).value = String(Math.round(saved.audio.masterVolume * 100));
  (document.getElementById('vol-sfx') as HTMLInputElement).value = String(Math.round(saved.audio.sfxVolume * 100));
  (document.getElementById('vol-music') as HTMLInputElement).value = String(Math.round(saved.audio.musicVolume * 100));
  (document.getElementById('vol-spatial') as HTMLInputElement).value = String(Math.round(saved.audio.spatialVolume * 100));
  (document.getElementById('vol-ambient') as HTMLInputElement).value = String(Math.round(saved.audio.ambientVolume * 100));
  (document.getElementById('gfx-shadows') as HTMLSelectElement).value = saved.graphics.shadows;
  (document.getElementById('gfx-post') as HTMLSelectElement).value = saved.graphics.postProcessing;
  (document.getElementById('gfx-weather') as HTMLSelectElement).value = saved.graphics.weather;
  (document.getElementById('gfx-time') as HTMLSelectElement).value = saved.graphics.timeOfDay;
  (document.getElementById('gfx-fog') as HTMLSelectElement).value = saved.graphics.fogOfWar ? 'on' : 'off';
  // Apply persisted audio volumes immediately
  audioManager.masterVolume = saved.audio.masterVolume;
  audioManager.sfxVolume = saved.audio.sfxVolume;
  audioManager.musicVolume = saved.audio.musicVolume;
  audioManager.spatialVolume = saved.audio.spatialVolume;
  audioManager.ambientVolume = saved.audio.ambientVolume;
  if (saved.audio.muted) audioManager.muted = true;
}

// ============================================================
// Map Editor lifecycle
// ============================================================
function openMapEditor(): void {
  // Hide setup screen and main game UI
  const setupOverlay = document.getElementById('setup-overlay')!;
  setupOverlay.classList.add('hidden');
  const mainContent = document.getElementById('main-content')!;
  mainContent.style.display = 'none';

  // Create editor
  currentEditor = new MapEditorUI(document.body);
  currentEditor.onBack = () => closeMapEditor();
  currentEditor.onPlay = (mapData: MapData) => {
    closeMapEditor();
    const config: Partial<GameConfig> = {
      customMapId: mapData.id,
      mapSize: mapData.width as GameConfig['mapSize'],
      numPlayers: Math.max(1, mapData.startingPositions.length),
    };
    startGame(config);
  };
  currentEditor.start();
}

function closeMapEditor(): void {
  if (currentEditor) {
    currentEditor.dispose();
    currentEditor = undefined;
  }
  const mainContent = document.getElementById('main-content')!;
  mainContent.style.display = '';
  const setupOverlay = document.getElementById('setup-overlay')!;
  setupOverlay.classList.remove('hidden');
}

// ============================================================
// startGame — creates Game instance and wires controllers
// ============================================================
async function startGame(config: Partial<GameConfig>, savedData?: SaveData): Promise<void> {
  // Clean up any active UI state from the previous game
  disposeDayCycleWidget();
  disposeVictoryProgressHUD();
  stopInfoPanelUpdates();
  stopStatsPanelUpdates();
  stopBuildPanelUpdates();
  if (popCounterInterval) { clearInterval(popCounterInterval); popCounterInterval = null; }
  if (autoSaveInterval) { clearInterval(autoSaveInterval); autoSaveInterval = null; }
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
    disposeFoodAlertBar();
    disposeMobileAlertConsolidator();
    disposeTutorial();
    disposeResourceBar();
    disposeEventLog();
    game.dispose();
  }

  await loadBalanceConfig();

  showLoadingScreen();

  game = new Game(container, config);
  (window as unknown as Record<string, unknown>).__game = game;

  wireNotifications(game, showGameOver, updatePauseSpeedUI);
  initEventLog((q, r) => {
    // Navigate camera to event location
    const cam = game?.getCameraController();
    if (cam) {
      const pos = HexGrid.hexToWorld(q, r);
      cam.panTo(pos.x, pos.z);
    }
  });
  initToolAlertBar(getGame);
  initCapacityAlertBar(getGame);
  initFoodAlertBar(getGame, () => showStatsPanel('population'));
  initMobileAlertConsolidator();
  updatePauseSpeedUI(false, 1);

  // Dispose previous tooltip controller
  currentTooltip?.dispose();

  await game.start(savedData, updateLoadingProgress);
  hideLoadingScreen();

  // Apply persisted graphics settings
  game.applyGraphicsSettings(loadSettings().graphics);

  // Set up tooltip controller
  const tooltipEl = document.getElementById('tooltip')!;
  currentTooltip = new TooltipController(game, tooltipEl);

  // Wire all game controllers (placement, selection, road, minimap, counters)
  const result = wireGameControllers({
    game,
    showSnackbar,
    showInfoPanel,
    showFlagInfoPanel,
    hideInfoPanelElement,
    stopInfoPanelUpdates,
    closeInfoPanel,
    getPlacementElements,
    populateBuildPanel,
    setupGameControlsPosition,
    initDayCycleWidget,
    initVictoryProgressHUD,
    getGame,
  });

  currentMinimap = result.minimap;
  popCounterInterval = result.popCounterInterval;

  initResourceBar(getGame, () => showStatsPanel('resources'));

  // Tutorial: show for new games (no saved data)
  if (!savedData) {
    initTutorial(game);
  }

  // Achievement tracking
  const scenario = config.scenario ?? 'default';
  recordGameStart(scenario);
  if (config.sandbox) unlockAchievement('sandbox_builder');

  // Auto-save every 2 minutes
  autoSaveInterval = setInterval(() => {
    if (!game) return;
    try {
      const data = game.serialize();
      autoSaveToSlot(data);
    } catch { /* silent — don't disrupt gameplay */ }
  }, AUTO_SAVE_INTERVAL);
}

// Warn before leaving with an active game
window.addEventListener('beforeunload', (e) => {
  if (game) {
    e.preventDefault();
  }
});

// Prevent context menu on canvas for right-click cancel
container.addEventListener('contextmenu', (e) => e.preventDefault());
