import type { GameConfig } from '../game/GameConfig';
import type { SaveData } from '../game/SaveLoad';
import { hasSave, loadFromLocalStorage, loadFromFile } from '../game/SaveLoad';
import { showSnackbar } from './Snackbar';
import { hideGameOverOverlay } from './GameOverScreen';

let setupOverlay: HTMLElement;

type StartGameFn = (config: Partial<GameConfig>, savedData?: SaveData) => Promise<void>;

const LANDSCAPE_DESCRIPTIONS: Record<string, string> = {
  default: 'Balanced mix of all terrain types',
  island: 'Land masses surrounded by sea (35% water)',
  continent: 'Vast land with minimal water (5% water)',
  archipelago: 'Many small islands across open ocean (45% water)',
};

const DIFFICULTY_DESCRIPTIONS: Record<string, string> = {
  easy: 'Relaxed AI focused on economy. Slow decisions, late attacks.',
  normal: 'Balanced AI with mixed economy and military strategy.',
  hard: 'Aggressive AI with fast decisions. Early attacks with multiple knights.',
};

const PLAYER_CSS_COLORS = ['#4488ff', '#ff4444', '#44cc44', '#ffcc00'];

export function initSetupScreen(startGame: StartGameFn): void {
  setupOverlay = document.getElementById('setup-overlay')!;
  const setupSeedInput = document.getElementById('setup-seed') as HTMLInputElement;
  const setupRandomSeedBtn = document.getElementById('setup-random-seed')!;
  const setupMapSizeSelect = document.getElementById('setup-map-size') as HTMLSelectElement;
  const setupPlayersSelect = document.getElementById('setup-players') as HTMLSelectElement;
  const setupLandscapeSelect = document.getElementById('setup-landscape') as HTMLSelectElement;
  const setupDifficultySelect = document.getElementById('setup-difficulty') as HTMLSelectElement;
  const setupStartBtn = document.getElementById('setup-start-btn')!;
  const setupContinueBtn = document.getElementById('setup-continue-btn')!;
  const landscapeDesc = document.getElementById('setup-landscape-desc')!;
  const difficultyDesc = document.getElementById('setup-difficulty-desc')!;
  const playerColorsContainer = document.getElementById('setup-player-colors')!;
  const victoryToggle = document.getElementById('setup-victory-toggle')!;
  const victoryList = document.getElementById('setup-victory-list')!;

  // Show "Continue Saved Game" button if a save exists in localStorage
  if (hasSave()) {
    setupContinueBtn.classList.remove('hidden');
  }

  setupContinueBtn.addEventListener('click', () => {
    handleLoadFromStorage(startGame);
  });

  setupRandomSeedBtn.addEventListener('click', () => {
    setupSeedInput.value = String(Math.floor(Math.random() * 999999) + 1);
  });

  // Landscape description updates
  setupLandscapeSelect.addEventListener('change', () => {
    landscapeDesc.textContent = LANDSCAPE_DESCRIPTIONS[setupLandscapeSelect.value] ?? '';
  });

  // Difficulty description updates
  setupDifficultySelect.addEventListener('change', () => {
    difficultyDesc.textContent = DIFFICULTY_DESCRIPTIONS[setupDifficultySelect.value] ?? '';
  });

  // Player color dots
  function updatePlayerColorDots(): void {
    const count = Number(setupPlayersSelect.value);
    let html = '';
    for (let i = 0; i < count; i++) {
      const cls = i === 0 ? ' setup-color-you' : '';
      const label = i === 0 ? 'You' : `AI ${i}`;
      html += `<span class="setup-color-dot${cls}" style="background:${PLAYER_CSS_COLORS[i]};" title="Player ${i + 1} (${label})"></span>`;
    }
    playerColorsContainer.innerHTML = html;
  }
  setupPlayersSelect.addEventListener('change', updatePlayerColorDots);
  updatePlayerColorDots();

  // Victory conditions toggle
  victoryToggle.addEventListener('click', () => {
    victoryToggle.classList.toggle('expanded');
    victoryList.classList.toggle('expanded');
  });

  setupStartBtn.addEventListener('click', () => {
    const rawSeed = Number(setupSeedInput.value);
    const config: Partial<GameConfig> = {
      seed: rawSeed > 0 ? Math.floor(rawSeed) : 42,
      mapSize: Number(setupMapSizeSelect.value) as GameConfig['mapSize'],
      numPlayers: Number(setupPlayersSelect.value),
      scenario: setupLandscapeSelect.value as GameConfig['scenario'],
      difficulty: setupDifficultySelect.value as GameConfig['difficulty'],
    };

    setupOverlay.classList.add('hidden');

    startGame(config).catch((err) => {
      console.error('Failed to start game:', err);
      showSnackbar('Failed to load game assets. Please reload the page.', 'error');
      setupOverlay.classList.remove('hidden');
    });
  });
}

export function hideSetupOverlay(): void {
  setupOverlay.classList.add('hidden');
}

export function showSetupOverlay(): void {
  setupOverlay.classList.remove('hidden');
}

/** Load game from localStorage (called from setup screen) */
async function handleLoadFromStorage(startGame: StartGameFn): Promise<void> {
  const data = loadFromLocalStorage();
  if (!data) {
    showSnackbar('No save found');
    return;
  }
  try {
    setupOverlay.classList.add('hidden');
    hideGameOverOverlay();
    await startGame(data.config, data);
    showSnackbar('Game loaded', 'success');
  } catch (err) {
    console.error('Load failed:', err);
    showSnackbar('Failed to load saved game', 'error');
    setupOverlay.classList.remove('hidden');
  }
}

/** Load a game from a JSON file */
export async function handleLoadFromFile(startGame: StartGameFn): Promise<void> {
  try {
    const data = await loadFromFile();
    if (!data) {
      showSnackbar('No valid save file selected', 'warning');
      return;
    }
    setupOverlay.classList.add('hidden');
    hideGameOverOverlay();
    await startGame(data.config, data);
    showSnackbar('Game loaded from file', 'success');
  } catch (err) {
    console.error('Load failed:', err);
    showSnackbar('Failed to load save file', 'error');
  }
}
