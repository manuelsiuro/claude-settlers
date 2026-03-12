import 'mdui/mdui.css';
import 'mdui/components/top-app-bar.js';
import 'mdui/components/button-icon.js';
import 'mdui/components/button.js';
import 'mdui/components/fab.js';
import 'mdui/components/navigation-drawer.js';
import 'mdui/components/list.js';
import 'mdui/components/list-item.js';
import 'mdui/components/card.js';
import 'mdui/components/chip.js';
import 'mdui/components/tooltip.js';
import 'mdui/components/snackbar.js';
import 'mdui/components/linear-progress.js';
import '@mdui/icons/menu.js';
import '@mdui/icons/construction.js';
import '@mdui/icons/bar-chart.js';
import '@mdui/icons/map.js';
import '@mdui/icons/settings.js';
import '@mdui/icons/close.js';
import '@mdui/icons/add.js';
import '@mdui/icons/save.js';
import '@mdui/icons/folder-open.js';
import '@mdui/icons/download.js';
import { Game } from './engine/Game';
import type { GameNotification } from './engine/Game';
import { Minimap } from './engine/Minimap';
import type { VictoryResult } from './game/VictoryManager';
import { VictoryCondition } from './game/VictoryManager';
import type { GameConfig } from './game/GameConfig';
import { BuildingType, BUILDING_DEFINITIONS, getBuildingsByTier } from './game/BuildingType';
import type { BuildingDefinition } from './game/BuildingType';
import { BuildingState } from './game/Building';
import type { Building, ResourceInventory } from './game/Building';
import { RESOURCE_PROPERTIES, ResourceType } from './game/ResourceType';
import { UNIT_DEFINITIONS, UnitType } from './game/UnitType';
import {
  type SaveData,
  saveToLocalStorage,
  loadFromLocalStorage,
  downloadSave,
  loadFromFile,
  hasSave,
} from './game/SaveLoad';
import './ui/styles.css';

const app = document.getElementById('app')!;

app.innerHTML = `
  <mdui-navigation-drawer id="side-panel" close-on-overlay-click>
    <mdui-list>
      <mdui-list-item headline="Buildings">
        <mdui-icon-construction slot="icon"></mdui-icon-construction>
      </mdui-list-item>
      <mdui-list-item headline="Statistics">
        <mdui-icon-bar-chart slot="icon"></mdui-icon-bar-chart>
      </mdui-list-item>
      <mdui-list-item headline="Minimap">
        <mdui-icon-map slot="icon"></mdui-icon-map>
      </mdui-list-item>
      <mdui-list-item headline="Save Game">
        <mdui-icon-save slot="icon"></mdui-icon-save>
      </mdui-list-item>
      <mdui-list-item headline="Load Game">
        <mdui-icon-folder-open slot="icon"></mdui-icon-folder-open>
      </mdui-list-item>
      <mdui-list-item headline="Download Save">
        <mdui-icon-download slot="icon"></mdui-icon-download>
      </mdui-list-item>
      <mdui-list-item headline="Settings">
        <mdui-icon-settings slot="icon"></mdui-icon-settings>
      </mdui-list-item>
    </mdui-list>
  </mdui-navigation-drawer>

  <div id="main-content">
    <mdui-top-app-bar variant="small" id="app-bar">
      <mdui-button-icon id="menu-btn">
        <mdui-icon-menu></mdui-icon-menu>
      </mdui-button-icon>
      <span class="app-title">Feudal Realm Manager</span>
    </mdui-top-app-bar>
    <div id="game-container"></div>
  </div>

  <!-- Minimap -->
  <div id="minimap-container" class="minimap-container"></div>

  <!-- Build FAB -->
  <mdui-fab id="build-fab" icon="construction" variant="primary"
    style="position:fixed;bottom:24px;right:24px;z-index:var(--z-fab);">
  </mdui-fab>

  <!-- Building Menu Panel -->
  <div id="build-panel" class="build-panel hidden">
    <div class="build-panel-header">
      <span class="build-panel-title">Build</span>
      <mdui-button-icon id="build-close-btn">
        <mdui-icon-close></mdui-icon-close>
      </mdui-button-icon>
    </div>
    <div id="build-panel-content" class="build-panel-content"></div>
  </div>

  <!-- Building Info Panel (shown when a building is selected) -->
  <div id="info-panel" class="info-panel hidden">
    <div class="info-panel-header">
      <span id="info-panel-title" class="info-panel-title"></span>
      <mdui-button-icon id="info-close-btn">
        <mdui-icon-close></mdui-icon-close>
      </mdui-button-icon>
    </div>
    <div id="info-panel-content" class="info-panel-content"></div>
  </div>

  <!-- Statistics Panel -->
  <div id="stats-panel" class="stats-panel hidden">
    <div class="info-panel-header">
      <span class="info-panel-title">Statistics</span>
      <mdui-button-icon id="stats-close-btn">
        <mdui-icon-close></mdui-icon-close>
      </mdui-button-icon>
    </div>
    <div id="stats-panel-content" class="info-panel-content"></div>
  </div>

  <!-- Placement Info Bar -->
  <div id="placement-bar" class="placement-bar hidden">
    <span id="placement-label"></span>
    <mdui-button id="placement-cancel-btn" variant="text">Cancel (Esc)</mdui-button>
  </div>

  <mdui-snackbar id="snackbar" placement="bottom"></mdui-snackbar>

  <!-- Game Over Overlay -->
  <div id="game-over-overlay" class="game-over-overlay hidden">
    <div class="game-over-card">
      <h2 id="game-over-title" class="game-over-title"></h2>
      <p id="game-over-condition" class="game-over-condition"></p>
      <div id="game-over-stats" class="game-over-stats"></div>
      <div class="game-over-actions">
        <mdui-button id="game-over-new-game-btn" variant="outlined">New Game</mdui-button>
        <mdui-button id="game-over-continue-btn" variant="filled">Continue Watching</mdui-button>
      </div>
    </div>
  </div>

  <!-- Game Setup Screen -->
  <div id="setup-overlay" class="setup-overlay">
    <div class="setup-card">
      <h1 class="setup-title">Feudal Realm Manager</h1>
      <p class="setup-subtitle">Configure your world and begin your conquest</p>

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

      <mdui-button id="setup-start-btn" class="setup-start-btn" variant="filled">
        Start Game
      </mdui-button>
      <mdui-button id="setup-continue-btn" class="setup-start-btn" variant="outlined" style="display:none;margin-top:8px;">
        Continue Saved Game
      </mdui-button>
    </div>
  </div>
`;

// Side panel toggle
const menuBtn = document.getElementById('menu-btn')!;
const sidePanel = document.getElementById('side-panel') as HTMLElement & { open: boolean };
menuBtn.addEventListener('click', () => {
  sidePanel.open = !sidePanel.open;
});

// Navigation drawer item clicks
const navItems = sidePanel.querySelectorAll('mdui-list-item');
navItems.forEach((item) => {
  item.addEventListener('click', () => {
    const headline = item.getAttribute('headline');
    sidePanel.open = false;
    if (headline === 'Statistics') {
      showStatsPanel();
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

// Game init — deferred until setup screen is submitted
const container = document.getElementById('game-container')!;
let game: Game | undefined;

/** Get the active Game instance (only call from UI handlers after game starts) */
function getGame(): Game {
  return game!;
}

/** Show a snackbar message */
function showSnackbar(message: string): void {
  snackbar.textContent = message;
  snackbar.open = true;
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
  gameOverTitle.textContent = isWin ? 'Victory!' : 'Defeat';
  gameOverTitle.style.color = isWin ? '#4caf50' : '#f44336';

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

  gameOverOverlay.classList.remove('hidden');
}

/** Wire up notification handler for the active game instance */
function wireNotifications(g: Game): void {
  g.onNotification = (notification: GameNotification) => {
    showSnackbar(notification.message);

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
}

// Build panel elements
const buildFab = document.getElementById('build-fab')!;
const buildPanel = document.getElementById('build-panel')!;
const buildCloseBtn = document.getElementById('build-close-btn')!;
const buildContent = document.getElementById('build-panel-content')!;
const placementBar = document.getElementById('placement-bar')!;
const placementLabel = document.getElementById('placement-label')!;
const placementCancelBtn = document.getElementById('placement-cancel-btn')!;
const snackbar = document.getElementById('snackbar') as HTMLElement & {
  open: boolean;
  textContent: string;
};

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
  if (def.cost.length === 0) return '<span class="cost-ok">Free</span>';
  return def.cost
    .map((c) => {
      const have = available[c.resource] ?? 0;
      const ok = have >= c.amount;
      const cssClass = ok ? 'cost-ok' : 'cost-short';
      return `<span class="${cssClass}">${c.amount} ${RESOURCE_PROPERTIES[c.resource].label}</span>`;
    })
    .join(', ');
}

/** Format production recipe summary */
function formatProductionSummary(def: BuildingDefinition): string {
  if (!def.production) {
    if (def.category === 'military') return 'Houses knights';
    if (def.type === BuildingType.Warehouse) return 'Stores goods';
    if (def.type === BuildingType.ForesterHut) return 'Plants trees';
    return '';
  }
  const inputs = def.production.inputs.map(
    (i) => RESOURCE_PROPERTIES[i.resource].label,
  );
  const outputs = def.production.outputs.map(
    (o) => RESOURCE_PROPERTIES[o.resource].label,
  );
  if (inputs.length === 0) return `Produces ${outputs.join(', ')}`;
  return `${inputs.join(' + ')} → ${outputs.join(', ')}`;
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
  html += `<div class="build-tier">
    <div class="build-tier-label">Logistics</div>
    <button class="build-item" data-action="place-flag">
      <span class="build-item-name">Place Flag</span>
      <span class="build-item-cost"><span class="cost-ok">Free</span></span>
      <span class="build-item-production">Logistics node for transporters</span>
    </button>
    <button class="build-item" data-action="build-road">
      <span class="build-item-name">Build Road</span>
      <span class="build-item-cost"><span class="cost-ok">Free</span></span>
      <span class="build-item-production">Connect flags for transport routes</span>
    </button>
  </div>`;

  for (const { tier, label } of tiers) {
    const buildings = getBuildingsByTier(tier);
    html += `<div class="build-tier"><div class="build-tier-label">Tier ${tier}: ${label}</div>`;
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
  }
}

function closeBuildPanel(): void {
  buildPanel.classList.add('hidden');
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
    showSnackbar('Attack ordered!');
  } else {
    showSnackbar('Cannot attack this building');
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
        <span class="info-resource-name">${props?.label ?? resource}</span>
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
          <span class="info-resource-name">${props.label}</span>
          <span class="info-resource-amount">${r.delivered} / ${r.needed}</span>
        </div>`;
      }
    }
  }
  html += '</div>';

  // Worker info
  if (def.worker) {
    const gameState = getGame().getGameState();
    const worker = gameState.getWorkerForBuilding(building.id);
    html += `<div class="info-section">
      <div class="info-section-label">Worker</div>
      <div class="info-row">
        <span class="info-label">${def.worker}</span>
        <span class="info-value ${worker ? 'state-active' : 'state-planned'}">${worker ? 'Assigned' : 'Needed'}</span>
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
      <div class="info-section-label">Production</div>`;

    // Inputs
    if (def.production.inputs.length > 0) {
      html += '<div class="info-subsection-label">Inputs</div>';
      for (const input of def.production.inputs) {
        const props = RESOURCE_PROPERTIES[input.resource];
        html += `<div class="info-resource-row">
          <span class="info-resource-name">${props.label}</span>
          <span class="info-resource-amount">${input.amount}/cycle</span>
        </div>`;
      }
    }

    // Outputs
    html += '<div class="info-subsection-label">Outputs</div>';
    for (const output of def.production.outputs) {
      const props = RESOURCE_PROPERTIES[output.resource];
      html += `<div class="info-resource-row">
        <span class="info-resource-name">${props.label}</span>
        <span class="info-resource-amount">${output.amount}/cycle</span>
      </div>`;
    }

    // Production progress
    if (building.hasWorker && building.productionProgress > 0) {
      const pct = Math.round(building.productionProgress * 100);
      html += `<div class="info-row" style="margin-top:8px">
        <span class="info-label">Progress</span>
        <span class="info-value">${pct}%</span>
      </div>
      <div class="info-progress-bar">
        <div class="info-progress-fill info-progress-production" style="width:${pct}%"></div>
      </div>`;
    }

    html += `<div class="info-row">
      <span class="info-label">Cycle Time</span>
      <span class="info-value">${def.production.productionTime}s</span>
    </div>`;
    html += '</div>';
  }

  // Knight slots (military buildings)
  if (def.knightSlots > 0) {
    html += `<div class="info-section">
      <div class="info-section-label">Knights</div>
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
    html += '<div class="info-section-label">Inventory</div>';
    if (hasInputs) {
      html += '<div class="info-subsection-label">Input</div>';
      html += formatInventory(building.inputInventory);
    }
    if (hasOutputs) {
      html += '<div class="info-subsection-label">Output</div>';
      html += formatInventory(building.outputInventory);
    }
    html += `<div class="info-row">
      <span class="info-label">Capacity</span>
      <span class="info-value">${def.storageCapacity}</span>
    </div>`;
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
  html += '<div class="info-section"><div class="info-section-label">Resources</div>';
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
    if (amount > 0) {
      html += `<div class="info-resource-row">
        <span class="info-resource-name">${RESOURCE_PROPERTIES[r].label}</span>
        <span class="info-resource-amount">${amount}</span>
      </div>`;
    }
  }

  html += '<div class="info-subsection-label">Processed Goods</div>';
  for (const r of processedResources) {
    const amount = resources[r] ?? 0;
    if (amount > 0) {
      html += `<div class="info-resource-row">
        <span class="info-resource-name">${RESOURCE_PROPERTIES[r].label}</span>
        <span class="info-resource-amount">${amount}</span>
      </div>`;
    }
  }
  html += '</div>';

  // Population section
  html += '<div class="info-section"><div class="info-section-label">Population</div>';
  html += `<div class="info-row">
    <span class="info-label">Total Units</span>
    <span class="info-value">${totalUnits}</span>
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
  html += '<div class="info-section"><div class="info-section-label">Buildings</div>';
  html += `<div class="info-row">
    <span class="info-label">Active</span>
    <span class="info-value">${activeBuildings}</span>
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
  html += '<div class="info-section"><div class="info-section-label">Military</div>';
  html += `<div class="info-row">
    <span class="info-label">Knights</span>
    <span class="info-value">${knights.length}</span>
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

  statsPanelContent.innerHTML = html;
}

function showStatsPanel(): void {
  renderStatsPanel();
  statsPanel.classList.remove('hidden');
  closeBuildPanel();
  closeInfoPanel();

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

// Event listeners
buildFab.addEventListener('click', toggleBuildPanel);
buildCloseBtn.addEventListener('click', closeBuildPanel);
placementCancelBtn.addEventListener('click', cancelPlacement);
statsCloseBtn.addEventListener('click', closeStatsPanel);
infoCloseBtn.addEventListener('click', closeInfoPanel);

// Event delegation for info panel buttons (avoids re-attaching handlers on every render)
infoPanelContent.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('.info-attack-btn') as HTMLElement | null;
  if (target?.dataset.buildingId) {
    startAttackTargeting(target.dataset.buildingId);
  }
});

// Event delegation for build panel buttons (avoids re-attaching handlers on every populateBuildPanel)
buildContent.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.build-item') as HTMLElement | null;
  if (!btn) return;
  if (btn.classList.contains('build-item-disabled')) return;
  const action = btn.dataset.action;
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

  await game.start(savedData);

  const placement = game.getPlacementController();
  if (placement) {
    placement.onBuildingPlaced = (type) => {
      const def = BUILDING_DEFINITIONS[type];
      showSnackbar(`${def.label} placed!`);
    };
    placement.onModeChanged = (active) => {
      if (!active) {
        placementBar.classList.add('hidden');
      }
      if (active) {
        closeInfoPanel();
      }
    };
  }

  const selection = game.getSelectionController();
  if (selection) {
    selection.onSelectionChanged = (building) => {
      if (building) {
        showInfoPanel(building);
      } else {
        infoPanel.classList.add('hidden');
        stopInfoPanelUpdates();
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
      showSnackbar('Flag placed!');
    };
    roadCtrl.onRoadBuilt = () => {
      showSnackbar('Road built!');
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
    showSnackbar('Game saved');
  } catch (err) {
    console.error('Save failed:', err);
    showSnackbar('Save failed — storage may be full');
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
    showSnackbar('Save file downloaded');
  } catch (err) {
    console.error('Download save failed:', err);
    showSnackbar('Failed to download save');
  }
}

/** Load a game from a JSON file */
async function handleLoadFromFile(): Promise<void> {
  try {
    const data = await loadFromFile();
    if (!data) {
      showSnackbar('No valid save file selected');
      return;
    }
    setupOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    await startGame(data.config, data);
    showSnackbar('Game loaded from file');
  } catch (err) {
    console.error('Load failed:', err);
    showSnackbar('Failed to load save file');
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
    showSnackbar('Game loaded');
  } catch (err) {
    console.error('Load failed:', err);
    showSnackbar('Failed to load saved game');
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
  setupContinueBtn.style.display = '';
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
    showSnackbar('Failed to load game assets. Please reload the page.');
    setupOverlay.classList.remove('hidden');
  });
});

// Prevent context menu on canvas for right-click cancel
container.addEventListener('contextmenu', (e) => e.preventDefault());
