import type { GameConfig, VictoryConfig } from '../game/GameConfig';
import type { SaveData } from '../game/SaveLoad';
import { hasSave, loadFromLocalStorage, loadFromFile } from '../game/SaveLoad';
import { showSnackbar } from './Snackbar';
import { hideGameOverOverlay } from './GameOverScreen';
import { listMaps, deleteMap, loadBundledMapsIndex, importMapFromFile } from '../editor/MapStorage';

let setupOverlay: HTMLElement;

type StartGameFn = (config: Partial<GameConfig>, savedData?: SaveData) => Promise<void>;

/** Callback to open the map editor */
let onOpenEditorCallback: (() => void) | null = null;

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

export function initSetupScreen(startGame: StartGameFn, onOpenEditor?: () => void): void {
  setupOverlay = document.getElementById('setup-overlay')!;
  onOpenEditorCallback = onOpenEditor ?? null;

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
  const victoryElimination = document.getElementById('victory-elimination') as HTMLInputElement;
  const victoryDomination = document.getElementById('victory-domination') as HTMLInputElement;
  const victoryEconomic = document.getElementById('victory-economic') as HTMLInputElement;
  const victoryTimed = document.getElementById('victory-timed') as HTMLInputElement;
  const victoryTimedMinutes = document.getElementById('victory-timed-minutes') as HTMLInputElement;
  const victoryTimedOptions = document.getElementById('victory-timed-options')!;
  const victoryPeaceful = document.getElementById('victory-peaceful') as HTMLInputElement;

  // Map source tabs
  const tabGenerated = document.getElementById('setup-tab-generated');
  const tabCustom = document.getElementById('setup-tab-custom');
  const generatedFields = document.getElementById('setup-generated-fields');
  const customFields = document.getElementById('setup-custom-fields');
  const mapGallery = document.getElementById('setup-map-gallery');
  const editorBtn = document.getElementById('setup-editor-btn');
  const importMapBtn = document.getElementById('setup-import-map-btn');

  let selectedMapId: string | null = null;
  let selectedMapSize = 32;
  let selectedMapPlayers = 1;
  let mapSourceMode: 'generated' | 'custom' = 'generated';

  function setMapSource(mode: 'generated' | 'custom'): void {
    mapSourceMode = mode;
    tabGenerated?.classList.toggle('active', mode === 'generated');
    tabCustom?.classList.toggle('active', mode === 'custom');
    generatedFields?.classList.toggle('hidden', mode !== 'generated');
    customFields?.classList.toggle('hidden', mode !== 'custom');
    if (mode === 'custom') {
      refreshMapGallery();
    }
  }

  tabGenerated?.addEventListener('click', () => setMapSource('generated'));
  tabCustom?.addEventListener('click', () => setMapSource('custom'));
  setMapSource('generated');

  // Editor button
  editorBtn?.addEventListener('click', () => {
    onOpenEditorCallback?.();
  });

  // Import map button
  importMapBtn?.addEventListener('click', async () => {
    const data = await importMapFromFile();
    if (data) {
      const { saveMap } = await import('../editor/MapStorage');
      saveMap(data);
      showSnackbar('Map imported successfully', 'success');
      refreshMapGallery();
    } else {
      showSnackbar('Failed to import map', 'error');
    }
  });

  async function refreshMapGallery(): Promise<void> {
    if (!mapGallery) return;

    const userMaps = listMaps();
    const bundledMaps = await loadBundledMapsIndex();

    let html = '';

    if (bundledMaps.length > 0) {
      html += '<div class="map-gallery-section-label">Bundled Maps</div>';
      html += '<div class="map-gallery">';
      for (const m of bundledMaps) {
        const thumbSrc = m.thumbnail ? `/maps/${m.thumbnail}` : '';
        html += buildMapCard(m.id, m.name, m.width, m.height, m.playerCount, thumbSrc, true);
      }
      html += '</div>';
    }

    if (userMaps.length > 0) {
      html += '<div class="map-gallery-section-label" style="margin-top:8px;">My Maps</div>';
      html += '<div class="map-gallery">';
      for (const m of userMaps) {
        html += buildMapCard(m.id, m.name, m.width, m.height, m.playerCount, m.thumbnail ?? '', false);
      }
      html += '</div>';
    }

    if (bundledMaps.length === 0 && userMaps.length === 0) {
      html = '<div style="text-align:center;opacity:0.5;padding:20px;font-size:13px;">No custom maps yet. Open the editor to create one!</div>';
    }

    mapGallery.innerHTML = html;

    // Wire card clicks
    const cards = mapGallery.querySelectorAll<HTMLElement>('.map-gallery-card');
    for (const card of cards) {
      card.addEventListener('click', () => {
        cards.forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedMapId = card.dataset.mapId!;
        selectedMapSize = Number(card.dataset.mapSize) || 32;
        selectedMapPlayers = Number(card.dataset.playerCount) || 1;
        // Clamp player select
        const maxPlayers = Math.max(1, selectedMapPlayers);
        const currentPlayers = Number(setupPlayersSelect.value);
        if (currentPlayers > maxPlayers) {
          setupPlayersSelect.value = String(maxPlayers);
          updatePlayerColorDots();
        }
      });
    }

    // Wire delete buttons
    const deleteBtns = mapGallery.querySelectorAll<HTMLElement>('.map-gallery-delete-btn');
    for (const btn of deleteBtns) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.mapId!;
        deleteMap(id);
        if (selectedMapId === id) selectedMapId = null;
        refreshMapGallery();
        showSnackbar('Map deleted', 'info');
      });
    }
  }

  function buildMapCard(
    id: string,
    name: string,
    width: number,
    height: number,
    playerCount: number,
    thumbSrc: string,
    isBundled: boolean,
  ): string {
    const thumbHtml = thumbSrc
      ? `<img class="map-gallery-thumb" src="${thumbSrc}" alt="${name}">`
      : `<div class="map-gallery-thumb"></div>`;
    const deleteBtn = isBundled
      ? ''
      : `<button class="btn-text btn-sm map-gallery-delete-btn" data-map-id="${id}">Delete</button>`;
    return `
      <div class="map-gallery-card" data-map-id="${id}" data-map-size="${width}" data-player-count="${playerCount}">
        ${thumbHtml}
        <div class="map-gallery-info">
          <div class="map-gallery-name">${name}</div>
          <div class="map-gallery-meta">${width}x${height} &middot; ${playerCount} player${playerCount !== 1 ? 's' : ''}</div>
          <div class="map-gallery-actions">${deleteBtn}</div>
        </div>
      </div>
    `;
  }

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

  // Player color dots + elimination auto-disable
  function updatePlayerColorDots(): void {
    const count = Number(setupPlayersSelect.value);
    let html = '';
    for (let i = 0; i < count; i++) {
      const cls = i === 0 ? ' setup-color-you' : '';
      const label = i === 0 ? 'You' : `AI ${i}`;
      html += `<span class="setup-color-dot${cls}" style="background:${PLAYER_CSS_COLORS[i]};" title="Player ${i + 1} (${label})"></span>`;
    }
    playerColorsContainer.innerHTML = html;

    // Disable elimination for single-player
    if (count <= 1) {
      victoryElimination.checked = false;
      victoryElimination.disabled = true;
    } else {
      victoryElimination.disabled = false;
    }
  }
  setupPlayersSelect.addEventListener('change', updatePlayerColorDots);
  updatePlayerColorDots();

  // Victory conditions toggle
  victoryToggle.addEventListener('click', () => {
    victoryToggle.classList.toggle('expanded');
    victoryList.classList.toggle('expanded');
  });

  // Timed checkbox → show/hide minutes input
  victoryTimed.addEventListener('change', () => {
    victoryTimedOptions.classList.toggle('hidden', !victoryTimed.checked);
  });

  // Prevent checkbox label clicks from toggling the section toggle
  for (const cb of [victoryElimination, victoryDomination, victoryEconomic, victoryTimed, victoryPeaceful]) {
    cb.addEventListener('click', (e) => e.stopPropagation());
  }

  setupStartBtn.addEventListener('click', () => {
    // Validate at least 1 non-Elimination condition is enabled
    const hasNonElimination = victoryDomination.checked || victoryEconomic.checked || victoryTimed.checked || victoryPeaceful.checked;
    if (!hasNonElimination && !victoryElimination.checked) {
      showSnackbar('Enable at least one victory condition', 'warning');
      return;
    }

    const rawSeed = Number(setupSeedInput.value);
    const numPlayers = Number(setupPlayersSelect.value);

    const victory: VictoryConfig = {
      elimination: numPlayers > 1 && victoryElimination.checked,
      domination: victoryDomination.checked,
      economic: victoryEconomic.checked,
      timed: victoryTimed.checked,
      timedLimitMinutes: Number(victoryTimedMinutes.value) || 30,
      peaceful: victoryPeaceful.checked,
    };

    const config: Partial<GameConfig> = {
      seed: rawSeed > 0 ? Math.floor(rawSeed) : 42,
      mapSize: Number(setupMapSizeSelect.value) as GameConfig['mapSize'],
      numPlayers,
      scenario: setupLandscapeSelect.value as GameConfig['scenario'],
      difficulty: setupDifficultySelect.value as GameConfig['difficulty'],
      victory,
    };

    // If custom map is selected, add customMapId to config
    if (mapSourceMode === 'custom' && selectedMapId) {
      config.customMapId = selectedMapId;
      config.mapSize = selectedMapSize as GameConfig['mapSize'];
    } else if (mapSourceMode === 'custom' && !selectedMapId) {
      showSnackbar('Select a map from the gallery', 'warning');
      return;
    }

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
