import type { GameConfig, VictoryConfig } from '../game/GameConfig';
import type { SaveData } from '../game/SaveLoad';
import { hasSave, loadFromLocalStorage, loadFromFile, listSaveSlots, loadFromKey } from '../game/SaveLoad';
import { validateMapData } from '../game/MapData';
import type { MapData } from '../game/MapData';
import { AI_PERSONALITY_LABELS, getPersonalityForPlayer } from '../game/data/aiBuildOrders';
import { CAMPAIGN_SCENARIOS, getCompletedCampaigns } from '../game/CampaignData';
import type { CampaignScenario } from '../game/CampaignData';
import { showSnackbar } from './Snackbar';
import { logger } from '../util/Logger';
import { hideGameOverOverlay } from './GameOverScreen';
import { listMaps, deleteMap, loadBundledMapsIndex, importMapFromFile } from '../editor/MapStorage';
import { showLobby, joinLobby } from './LobbyPanel';
import type { LobbyResult } from './LobbyPanel';

let setupOverlay: HTMLElement;

type StartGameFn = (config: Partial<GameConfig>, savedData?: SaveData) => Promise<void>;

/** Callback to open the map editor */
let onOpenEditorCallback: (() => void) | null = null;

const LANDSCAPE_DESCRIPTIONS: Record<string, string> = {
  default: 'Balanced mix of all terrain types',
  island: 'Land masses surrounded by sea (35% water)',
  continent: 'Vast land with minimal water (5% water)',
  archipelago: 'Many small islands across open ocean (45% water)',
  river_valley: 'Fertile valleys with rivers and grassland (20% water)',
  mountain_pass: 'Rugged highlands with narrow passes (55% mountain)',
  oasis: 'Vast desert with scarce water and greenery (60% desert)',
  peninsula: 'Land jutting into the sea with long coastlines (40% water)',
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
  let mapSourceMode: 'generated' | 'custom' | 'campaign' = 'generated';
  let selectedCampaign: CampaignScenario | null = null;

  const tabCampaign = document.getElementById('setup-tab-campaign');
  const campaignFields = document.getElementById('setup-campaign-fields');
  const campaignList = document.getElementById('setup-campaign-list');

  function setMapSource(mode: 'generated' | 'custom' | 'campaign'): void {
    mapSourceMode = mode;
    selectedCampaign = null;
    tabGenerated?.classList.toggle('active', mode === 'generated');
    tabCustom?.classList.toggle('active', mode === 'custom');
    tabCampaign?.classList.toggle('active', mode === 'campaign');
    generatedFields?.classList.toggle('hidden', mode !== 'generated');
    customFields?.classList.toggle('hidden', mode !== 'custom');
    campaignFields?.classList.toggle('hidden', mode !== 'campaign');
    if (mode === 'custom') {
      refreshMapGallery();
    }
    if (mode === 'campaign') {
      renderCampaignList();
    }
  }

  function renderCampaignList(): void {
    if (!campaignList) return;
    const completed = getCompletedCampaigns();
    campaignList.innerHTML = CAMPAIGN_SCENARIOS.map(s => {
      const done = completed.includes(s.id);
      const sel = selectedCampaign?.id === s.id;
      return `<div class="campaign-card ${sel ? 'selected' : ''} ${done ? 'completed' : ''}" data-campaign="${s.id}">
        <div class="campaign-card-header">
          <span class="campaign-card-name">${s.name}</span>
          ${done ? '<span class="campaign-card-check">&#10003;</span>' : ''}
        </div>
        <p class="campaign-card-desc">${s.description}</p>
        <div class="campaign-card-meta">
          <span>${s.difficulty}</span>
          <span>${s.numPlayers} player${s.numPlayers > 1 ? 's' : ''}</span>
          <span>${s.objectives.length} objective${s.objectives.length > 1 ? 's' : ''}</span>
        </div>
      </div>`;
    }).join('');

    // Event delegation for campaign selection
    campaignList.onclick = (e) => {
      const card = (e.target as HTMLElement).closest('.campaign-card') as HTMLElement | null;
      if (!card) return;
      const id = card.dataset.campaign;
      const scenario = CAMPAIGN_SCENARIOS.find(s => s.id === id);
      if (scenario) {
        selectedCampaign = scenario;
        campaignList.querySelectorAll('.campaign-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      }
    };
  }

  tabGenerated?.addEventListener('click', () => setMapSource('generated'));
  tabCustom?.addEventListener('click', () => setMapSource('custom'));
  tabCampaign?.addEventListener('click', () => setMapSource('campaign'));
  setMapSource('generated');

  // Editor button
  editorBtn?.addEventListener('click', () => {
    onOpenEditorCallback?.();
  });

  // Paste map from clipboard
  const pasteMapBtn = document.getElementById('setup-paste-map-btn');
  pasteMapBtn?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text) as MapData;
      const errors = validateMapData(data);
      if (errors.length > 0) {
        showSnackbar('Invalid map data in clipboard', 'error');
        return;
      }
      const { saveMap } = await import('../editor/MapStorage');
      const { generateId } = await import('../editor/editorUtils');
      data.id = generateId();
      saveMap(data);
      showSnackbar(`Map "${data.name}" imported from clipboard`, 'success');
      refreshMapGallery();
    } catch {
      showSnackbar('No valid map data in clipboard', 'error');
    }
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

  // Show "Continue" button if any save exists (quick-save or auto-save slots)
  const saveSlots = listSaveSlots();
  if (saveSlots.length > 0 || hasSave()) {
    setupContinueBtn.classList.remove('hidden');
  }

  setupContinueBtn.addEventListener('click', () => {
    // If there are multiple save slots, load the most recent one
    const slots = listSaveSlots();
    if (slots.length > 0) {
      // Find the most recent save across all slots
      let newest = slots[0];
      for (const s of slots) {
        if (s.timestamp && (!newest.timestamp || s.timestamp > newest.timestamp)) {
          newest = s;
        }
      }
      const data = loadFromKey(newest.key);
      if (data) {
        setupOverlay.classList.add('hidden');
        hideGameOverOverlay();
        startGame(data.config, data).then(() => {
          showSnackbar(`Loaded: ${newest.label}`, 'success');
        }).catch((err) => {
          logger.error('Load failed:', err);
          showSnackbar('Failed to load saved game', 'error');
          import('./LoadingScreen').then((m) => m.hideLoadingScreen());
          setupOverlay.classList.remove('hidden');
        });
        return;
      }
    }
    // Fallback to legacy quick-save
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
      const personality = i > 0 ? AI_PERSONALITY_LABELS[getPersonalityForPlayer(i)] : null;
      const label = i === 0 ? 'You' : `AI ${i} — ${personality}`;
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

    const sandboxCheckbox = document.getElementById('setup-sandbox') as HTMLInputElement;

    const config: Partial<GameConfig> = {
      seed: rawSeed > 0 ? Math.floor(rawSeed) : 42,
      mapSize: Number(setupMapSizeSelect.value) as GameConfig['mapSize'],
      numPlayers,
      scenario: setupLandscapeSelect.value as GameConfig['scenario'],
      difficulty: setupDifficultySelect.value as GameConfig['difficulty'],
      victory,
      sandbox: sandboxCheckbox?.checked || false,
    };

    // Campaign mode: override config from scenario
    if (mapSourceMode === 'campaign') {
      if (!selectedCampaign) {
        showSnackbar('Select a campaign scenario', 'warning');
        return;
      }
      config.seed = selectedCampaign.seed;
      config.mapSize = selectedCampaign.mapSize as GameConfig['mapSize'];
      config.numPlayers = selectedCampaign.numPlayers;
      config.scenario = selectedCampaign.scenario as GameConfig['scenario'];
      config.difficulty = selectedCampaign.difficulty as GameConfig['difficulty'];
      config.victory = selectedCampaign.victory;
      config.campaignId = selectedCampaign.id;
    }

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
      logger.error('Failed to start game:', err);
      showSnackbar('Failed to load game assets. Please reload the page.', 'error');
      // Hide loading screen on failure (imported dynamically to avoid circular dep)
      import('./LoadingScreen').then((m) => m.hideLoadingScreen());
      setupOverlay.classList.remove('hidden');
    });
  });

  // ── Multiplayer panel ──────────────────────────────────────────────
  const mpSection = document.getElementById('setup-mp-section');
  const mpTabHost = document.getElementById('setup-mp-tab-host');
  const mpTabJoin = document.getElementById('setup-mp-tab-join');
  const mpHostDiv = document.getElementById('setup-mp-host');
  const mpJoinDiv = document.getElementById('setup-mp-join');
  const mpNameHost = document.getElementById('setup-mp-name-host') as HTMLInputElement;
  const mpNameJoin = document.getElementById('setup-mp-name-join') as HTMLInputElement;
  const mpCodeInput = document.getElementById('setup-mp-code') as HTMLInputElement;
  const mpCreateBtn = document.getElementById('setup-mp-create-btn');
  const mpJoinBtn = document.getElementById('setup-mp-join-btn');

  // Restore saved player name
  const savedMpName = localStorage.getItem('feudal-mp-name') ?? 'Player';
  if (mpNameHost) mpNameHost.value = savedMpName;
  if (mpNameJoin) mpNameJoin.value = savedMpName;

  // Toggle multiplayer section
  const multiplayerBtn = document.getElementById('setup-multiplayer-btn');
  multiplayerBtn?.addEventListener('click', () => {
    mpSection?.classList.toggle('hidden');
  });

  // Tab switching
  mpTabHost?.addEventListener('click', () => {
    mpTabHost.classList.add('active');
    mpTabJoin?.classList.remove('active');
    mpHostDiv?.classList.remove('hidden');
    mpJoinDiv?.classList.add('hidden');
  });
  mpTabJoin?.addEventListener('click', () => {
    mpTabJoin.classList.add('active');
    mpTabHost?.classList.remove('active');
    mpJoinDiv?.classList.remove('hidden');
    mpHostDiv?.classList.add('hidden');
  });

  /** Shared callback for when multiplayer game starts */
  function onMultiplayerGameStart(result: LobbyResult): void {
    const fn = (window as unknown as Record<string, unknown>).__startMultiplayerGame as
      ((r: LobbyResult) => Promise<void>) | undefined;
    if (fn) {
      fn(result).catch((err: unknown) => {
        logger.error('Failed to start multiplayer game:', err);
        showSnackbar('Failed to start multiplayer game', 'error');
        setupOverlay.classList.remove('hidden');
      });
    }
  }

  /** Get the relay server address (auto-detected in dev, localhost fallback) */
  function getRelayAddress(): string {
    return (typeof __RELAY_WS_URL__ !== 'undefined' && __RELAY_WS_URL__)
      ? __RELAY_WS_URL__
      : 'ws://localhost:9876';
  }

  // Host: Total Players / AI Opponents dropdown wiring
  const mpTotalSelect = document.getElementById('setup-mp-total') as HTMLSelectElement;
  const mpAiSelect = document.getElementById('setup-mp-ai') as HTMLSelectElement;
  const mpSlotsDesc = document.getElementById('setup-mp-slots-desc');

  function updateAiOptions(): void {
    const total = Number(mpTotalSelect?.value ?? 2);
    const maxAi = total - 1; // At least 1 human slot (the host)
    if (mpAiSelect) {
      const currentAi = Number(mpAiSelect.value);
      mpAiSelect.innerHTML = '';
      for (let i = 0; i <= maxAi; i++) {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = i === 0 ? '0 (All Human)' : `${i} AI`;
        mpAiSelect.appendChild(opt);
      }
      mpAiSelect.value = String(Math.min(currentAi, maxAi));
    }
    updateSlotsDesc();
  }

  function updateSlotsDesc(): void {
    const total = Number(mpTotalSelect?.value ?? 2);
    const ai = Number(mpAiSelect?.value ?? 0);
    const humanSlots = total - ai;
    if (mpSlotsDesc) {
      mpSlotsDesc.textContent = `${humanSlots} human slot${humanSlots > 1 ? 's' : ''} to fill${ai > 0 ? `, ${ai} AI opponent${ai > 1 ? 's' : ''}` : ''}. Map settings above will be used.`;
    }
  }

  mpTotalSelect?.addEventListener('change', updateAiOptions);
  mpAiSelect?.addEventListener('change', updateSlotsDesc);

  // Host: Create Game
  mpCreateBtn?.addEventListener('click', () => {
    const playerName = mpNameHost?.value.trim() || 'Player';
    localStorage.setItem('feudal-mp-name', playerName);

    const rawSeed = Number(setupSeedInput.value);
    const seed = rawSeed > 0 ? Math.floor(rawSeed) : 42;
    const totalPlayers = Number(mpTotalSelect?.value ?? 2);
    const aiCount = Number(mpAiSelect?.value ?? 0);

    showLobby({
      serverAddress: getRelayAddress(),
      mapSeed: seed,
      mapSize: Number(setupMapSizeSelect.value),
      scenario: setupLandscapeSelect.value,
      difficulty: setupDifficultySelect.value,
      maxPlayers: totalPlayers,
      aiCount,
      playerName,
    }, onMultiplayerGameStart);
  });

  // Join: parse input as URL or room code
  mpJoinBtn?.addEventListener('click', () => {
    const playerName = mpNameJoin?.value.trim() || 'Player';
    localStorage.setItem('feudal-mp-name', playerName);

    const input = mpCodeInput?.value.trim() ?? '';
    if (!input) {
      showSnackbar('Enter a room code or paste an invite link', 'warning');
      return;
    }

    let serverAddress: string;
    let roomCode: string;

    // Try to parse as a URL with ?join= and ?server= params
    if (input.includes('?') || input.includes('://')) {
      try {
        const url = new URL(input.startsWith('http') ? input : `http://${input}`);
        roomCode = url.searchParams.get('join') ?? '';
        serverAddress = url.searchParams.get('server') ?? getRelayAddress();
      } catch {
        showSnackbar('Invalid link format', 'warning');
        return;
      }
    } else {
      // Plain room code
      roomCode = input.toUpperCase();
      serverAddress = getRelayAddress();
    }

    if (!roomCode || roomCode.length < 4) {
      showSnackbar('Room code must be 4 characters', 'warning');
      return;
    }

    joinLobby(serverAddress, roomCode, playerName, onMultiplayerGameStart);
  });

  // Handle ?join=CODE&server=ADDRESS URL params (auto-join via shared link)
  const urlParams = new URLSearchParams(window.location.search);
  const joinCode = urlParams.get('join');
  const joinServer = urlParams.get('server');
  if (joinCode && joinServer) {
    // Auto-fill the Join tab and expand the section
    mpSection?.classList.remove('hidden');
    mpTabJoin?.click();
    if (mpCodeInput) mpCodeInput.value = joinCode;
    // Auto-join after a short delay to let UI render
    setTimeout(() => {
      const playerName = mpNameJoin?.value.trim() || 'Player';
      joinLobby(joinServer, joinCode, playerName, onMultiplayerGameStart);
    }, 500);
    window.history.replaceState({}, '', window.location.pathname);
  }
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
    logger.error('Load failed:', err);
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
    logger.error('Load failed:', err);
    showSnackbar('Failed to load save file', 'error');
  }
}
