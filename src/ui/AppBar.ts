import type { Game } from '../engine/Game';
import { audioManager } from '../engine/AudioManager';
import { showSnackbar } from './Snackbar';
import { logger } from '../util/Logger';
import { showTechTreePanel } from './TechTreePanel';
import { showDashboard } from './DashboardPanel';
import { saveToLocalStorage, downloadSave } from '../game/SaveLoad';
import { loadSettings, saveSettings } from '../game/SettingsStorage';
import type { GraphicsSettings } from '../game/GameConfig';

let game: Game | undefined;
let pauseIcon: HTMLElement;
let playIcon: HTMLElement;
let speedLabel: HTMLElement;
let pauseOverlay: HTMLElement;

type ToggleBuildPanelFn = () => void;
type ShowStatsPanelFn = () => void;
type ShowPriorityPanelFn = () => void;
type HandleLoadFromFileFn = () => void;

export function updatePauseSpeedUI(paused: boolean, speed: number): void {
  pauseIcon.classList.toggle('hidden', paused);
  playIcon.classList.toggle('hidden', !paused);
  speedLabel.textContent = `${speed}x`;
  pauseOverlay.classList.toggle('hidden', !paused);
  // Also update mobile toolbar speed label
  const mtSpeedLabel = document.getElementById('mt-speed-label');
  if (mtSpeedLabel) {
    mtSpeedLabel.textContent = paused ? '||' : `${speed}x`;
  }
}

export function initAppBar(
  getGame: () => Game | undefined,
  toggleBuildPanel: ToggleBuildPanelFn,
  showStatsPanel: ShowStatsPanelFn,
  showPriorityPanel: ShowPriorityPanelFn,
  handleLoadFromFile: HandleLoadFromFileFn,
): void {
  const THEME_KEY = 'feudal-theme';

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
      if (item.hasAttribute('data-nonclickable')) return;
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
      } else if (headline === 'Tech Tree') {
        showTechTreePanel();
      } else if (headline === 'Dashboard') {
        showDashboard();
      } else {
        showSnackbar(`${headline} — coming soon`);
      }
    });
  });

  // Theme toggle
  const themeToggleInput = document.getElementById('theme-toggle-input') as HTMLInputElement;
  themeToggleInput.addEventListener('change', () => {
    const currentTheme = themeToggleInput.checked ? 'night' : 'day';
    if (currentTheme === 'night') {
      document.documentElement.setAttribute('data-theme', 'night');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem(THEME_KEY, currentTheme);
  });

  // Audio controls
  const muteBtn = document.getElementById('mute-btn')!;
  const muteIconOn = document.getElementById('mute-icon-on')!;
  const muteIconOff = document.getElementById('mute-icon-off')!;
  const volMaster = document.getElementById('vol-master') as HTMLInputElement;
  const volSfx = document.getElementById('vol-sfx') as HTMLInputElement;
  const volMusic = document.getElementById('vol-music') as HTMLInputElement;

  function updateMuteUI(): void {
    muteIconOn.classList.toggle('hidden', audioManager.muted);
    muteIconOff.classList.toggle('hidden', !audioManager.muted);
  }

  muteBtn.addEventListener('click', () => {
    audioManager.muted = !audioManager.muted;
    updateMuteUI();
    persistCurrentSettings();
  });

  function persistCurrentSettings(): void {
    const gfxShadows = document.getElementById('gfx-shadows') as HTMLSelectElement;
    const gfxPost = document.getElementById('gfx-post') as HTMLSelectElement;
    const gfxWeather = document.getElementById('gfx-weather') as HTMLSelectElement;
    const gfxTime = document.getElementById('gfx-time') as HTMLSelectElement;
    const gfxFog = document.getElementById('gfx-fog') as HTMLSelectElement;

    const graphics: GraphicsSettings = {
      shadows: gfxShadows.value as GraphicsSettings['shadows'],
      postProcessing: gfxPost.value as GraphicsSettings['postProcessing'],
      weather: gfxWeather.value as GraphicsSettings['weather'],
      timeOfDay: gfxTime.value as GraphicsSettings['timeOfDay'],
      fogOfWar: gfxFog.value === 'on',
      ambientLife: ((document.getElementById('gfx-ambient') as HTMLSelectElement | null)?.value ?? 'full') as GraphicsSettings['ambientLife'],
    };

    saveSettings({
      graphics,
      audio: {
        masterVolume: Number(volMaster.value) / 100,
        sfxVolume: Number(volSfx.value) / 100,
        musicVolume: Number(volMusic.value) / 100,
        muted: audioManager.muted,
      },
    });
  }

  volMaster.addEventListener('input', () => {
    audioManager.masterVolume = Number(volMaster.value) / 100;
    persistCurrentSettings();
  });
  volSfx.addEventListener('input', () => {
    audioManager.sfxVolume = Number(volSfx.value) / 100;
    persistCurrentSettings();
  });
  volMusic.addEventListener('input', () => {
    audioManager.musicVolume = Number(volMusic.value) / 100;
    persistCurrentSettings();
  });

  // Pause & speed controls
  const pauseBtn = document.getElementById('pause-btn')!;
  pauseIcon = document.getElementById('pause-icon')!;
  playIcon = document.getElementById('play-icon')!;
  const speedBtn = document.getElementById('speed-btn')!;
  speedLabel = document.getElementById('speed-label')!;
  pauseOverlay = document.getElementById('pause-overlay')!;
  const pauseResumeBtn = document.getElementById('pause-resume-btn')!;

  pauseBtn.addEventListener('click', () => {
    game = getGame();
    if (!game) return;
    game.togglePause();
    audioManager.play('ui_click');
  });

  pauseResumeBtn.addEventListener('click', () => {
    game = getGame();
    if (!game) return;
    game.setPaused(false);
    audioManager.play('ui_click');
  });

  speedBtn.addEventListener('click', () => {
    game = getGame();
    if (!game) return;
    game.cycleSpeed();
    audioManager.play('ui_click');
  });

  // Spacebar to toggle pause
  window.addEventListener('keydown', (e) => {
    game = getGame();
    if (!game) return;
    if (e.code !== 'Space') return;
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    const setupOv = document.getElementById('setup-overlay')!;
    if (!setupOv.classList.contains('hidden')) return;
    e.preventDefault();
    game.togglePause();
  });

  // Graphics settings change handlers
  const gfxSelects = ['gfx-shadows', 'gfx-post', 'gfx-weather', 'gfx-time', 'gfx-fog'];
  for (const id of gfxSelects) {
    document.getElementById(id)!.addEventListener('change', () => {
      const current = loadSettings();
      const gfxShadows = document.getElementById('gfx-shadows') as HTMLSelectElement;
      const gfxPost = document.getElementById('gfx-post') as HTMLSelectElement;
      const gfxWeather = document.getElementById('gfx-weather') as HTMLSelectElement;
      const gfxTime = document.getElementById('gfx-time') as HTMLSelectElement;
      const gfxFog = document.getElementById('gfx-fog') as HTMLSelectElement;

      const graphics: GraphicsSettings = {
        shadows: gfxShadows.value as GraphicsSettings['shadows'],
        postProcessing: gfxPost.value as GraphicsSettings['postProcessing'],
        weather: gfxWeather.value as GraphicsSettings['weather'],
        timeOfDay: gfxTime.value as GraphicsSettings['timeOfDay'],
        fogOfWar: gfxFog.value === 'on',
        ambientLife: ((document.getElementById('gfx-ambient') as HTMLSelectElement | null)?.value ?? 'full') as GraphicsSettings['ambientLife'],
      };

      game = getGame();
      game?.applyGraphicsSettings(graphics);
      saveSettings({ graphics, audio: current.audio });
    });
  }

  /** Save the current game to localStorage */
  function handleSaveGame(): void {
    game = getGame();
    if (!game) {
      showSnackbar('No game in progress');
      return;
    }
    try {
      const data = game.serialize();
      saveToLocalStorage(data);
      showSnackbar('Game saved', 'success');
    } catch (err) {
      logger.error('Save failed:', err);
      showSnackbar('Save failed — storage may be full', 'error');
    }
  }

  /** Download the current save as a JSON file */
  function handleDownloadSave(): void {
    game = getGame();
    if (!game) {
      showSnackbar('No game in progress');
      return;
    }
    try {
      const data = game.serialize();
      downloadSave(data);
      showSnackbar('Save file downloaded', 'success');
    } catch (err) {
      logger.error('Download save failed:', err);
      showSnackbar('Failed to download save', 'error');
    }
  }
}

/** Set up the floating game controls bar (now CSS-centered, no dynamic positioning needed) */
export function setupGameControlsPosition(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _minimapContainer: HTMLElement,
): void {
  const bar = document.getElementById('game-controls-bar');
  if (!bar) return;
  // Clear any leftover inline top from previous positioning logic
  bar.style.top = '';
}
