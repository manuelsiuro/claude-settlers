import type { GameConfig } from '../game/GameConfig';
import type { SaveData } from '../game/SaveLoad';
import { hasSave, loadFromLocalStorage, loadFromFile } from '../game/SaveLoad';
import { showSnackbar } from './Snackbar';
import { hideGameOverOverlay } from './GameOverScreen';

let setupOverlay: HTMLElement;

type StartGameFn = (config: Partial<GameConfig>, savedData?: SaveData) => Promise<void>;

export function initSetupScreen(startGame: StartGameFn): void {
  setupOverlay = document.getElementById('setup-overlay')!;
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
    handleLoadFromStorage(startGame);
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
