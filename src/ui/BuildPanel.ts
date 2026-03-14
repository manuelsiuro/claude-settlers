import type { Game } from '../engine/Game';
import { audioManager } from '../engine/AudioManager';
import { BuildingType, BUILDING_DEFINITIONS, getBuildingsByTier } from '../game/BuildingType';
import type { BuildingDefinition } from '../game/BuildingType';
import { BuildingState } from '../game/Building';
import { RESOURCE_PROPERTIES, ResourceType } from '../game/ResourceType';
import { resourceIcon } from './icons';
import { showSnackbar } from './Snackbar';

let buildPanel: HTMLElement;
let buildContent: HTMLElement;
let placementBar: HTMLElement;
let placementLabel: HTMLElement;
let placementDistanceEl: HTMLElement;
let buildPanelUpdateInterval: ReturnType<typeof setInterval> | null = null;

/** Current build panel filter category */
let buildFilterCategory: string = 'all';

let getGame: () => Game;

/** Attack targeting state */
let attackSourceBuildingId: string | null = null;
/** Cleanup function for current attack mode */
let attackModeCleanup: (() => void) | null = null;

// Callbacks to close other panels
let closeInfoPanelFn: () => void;
let closeStatsPanelFn: () => void;
let closePriorityPanelFn: () => void;

export function initBuildPanel(
  getGameFn: () => Game,
  closeInfoPanel: () => void,
  closeStatsPanel: () => void,
  closePriorityPanel: () => void,
): void {
  getGame = getGameFn;
  closeInfoPanelFn = closeInfoPanel;
  closeStatsPanelFn = closeStatsPanel;
  closePriorityPanelFn = closePriorityPanel;

  buildPanel = document.getElementById('build-panel')!;
  buildContent = document.getElementById('build-panel-content')!;
  placementBar = document.getElementById('placement-bar')!;
  placementLabel = document.getElementById('placement-label')!;
  placementDistanceEl = document.getElementById('placement-distance')!;
  const buildFab = document.getElementById('build-fab')!;
  const buildCloseBtn = document.getElementById('build-close-btn')!;
  const placementCancelBtn = document.getElementById('placement-cancel-btn')!;

  buildFab.addEventListener('click', toggleBuildPanel);
  buildCloseBtn.addEventListener('click', closeBuildPanel);
  placementCancelBtn.addEventListener('click', cancelPlacement);

  // Event delegation for build panel buttons
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

  // Category tab click handler
  buildContent.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest('.build-tab') as HTMLElement | null;
    if (!tab) return;
    const cat = tab.dataset.category;
    if (cat) {
      buildFilterCategory = cat;
      populateBuildPanel();
    }
  });

  // Building hotkeys (only when build panel is open)
  document.addEventListener('keydown', (e) => {
    if (buildPanel.classList.contains('hidden')) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const HOTKEYS: Record<string, BuildingType> = {
      'w': BuildingType.WoodcutterHut,
      'f': BuildingType.ForesterHut,
      'q': BuildingType.Quarry,
      'g': BuildingType.GuardHut,
      's': BuildingType.Sawmill,
      'b': BuildingType.Barracks,
    };
    const type = HOTKEYS[e.key.toLowerCase()];
    if (type) {
      e.preventDefault();
      const def = BUILDING_DEFINITIONS[type];
      const available = getPlayerResources();
      if (canAfford(def, available)) {
        startPlacement(type);
      }
    }
  });
}

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
  if (inputs.length === 0) {
    return `<span class="production-flow">Produces ${outputs.join(', ')}</span>`;
  }
  return `<div class="production-chain">
    <span class="production-inputs">${inputs.join('<span class="production-plus">+</span>')}</span>
    <span class="production-arrow">\u2192</span>
    <span class="production-outputs">${outputs.join(', ')}</span>
  </div>`;
}

/** Build the building menu HTML organized by tier */
export function populateBuildPanel(): void {
  const tiers = [
    { tier: 1, label: 'Basic' },
    { tier: 2, label: 'Advanced' },
    { tier: 3, label: 'Specialized' },
  ];

  const available = getPlayerResources();

  // Category filter tabs
  const categories = [
    { key: 'all', label: 'All' },
    { key: 'gathering', label: 'Economy' },
    { key: 'processing', label: 'Processing' },
    { key: 'military', label: 'Military' },
    { key: 'logistics', label: 'Logistics' },
  ];
  let html = '<div class="build-category-tabs">';
  for (const cat of categories) {
    const active = buildFilterCategory === cat.key ? 'build-tab-active' : '';
    html += `<button class="build-tab ${active}" data-category="${cat.key}">${cat.label}</button>`;
  }
  html += '</div>';

  // Logistics section
  const showLogistics = buildFilterCategory === 'all' || buildFilterCategory === 'logistics';
  if (showLogistics) {
    html += `<div class="build-tier" data-tier="logistics">
    <div class="build-tier-label"><span class="tier-badge tier-badge-logistics">LOG</span> Logistics</div>
    <button class="build-item" data-action="place-flag">
      <span class="build-item-name">Place Flag</span>
      <span class="build-item-desc">Logistics node for transporters</span>
      <div class="build-item-section">
        <span class="build-item-section-label">Cost</span>
        <div class="build-item-section-content"><span class="cost-pill cost-pill-free">Free</span></div>
      </div>
    </button>
    <button class="build-item" data-action="build-road">
      <span class="build-item-name">Build Road</span>
      <span class="build-item-desc">Connect flags for transport routes</span>
      <div class="build-item-section">
        <span class="build-item-section-label">Cost</span>
        <div class="build-item-section-content"><span class="cost-pill cost-pill-free">Free</span></div>
      </div>
    </button>
  </div>`;
  }

  for (const { tier, label } of tiers) {
    const buildings = getBuildingsByTier(tier).filter((def) => {
      if (buildFilterCategory === 'all') return true;
      return def.category === buildFilterCategory;
    });
    if (buildings.length === 0) continue;
    html += `<div class="build-tier" data-tier="${tier}"><div class="build-tier-label"><span class="tier-badge tier-badge-${tier}">${tier}</span> ${label}</div>`;
    for (const def of buildings) {
      const affordable = canAfford(def, available);
      const disabledClass = affordable ? '' : 'build-item-disabled';
      const prodSummary = formatProductionSummary(def);
      const milInfo = def.knightSlots > 0 ? `<span class="build-item-military">${def.knightSlots} knight slots \u00b7 range ${def.influenceRadius}</span>` : '';
      html += `
        <button class="build-item ${disabledClass}" data-building-type="${def.type}">
          <span class="build-item-name">${def.label}</span>
          <span class="build-item-desc">${def.description}</span>
          <div class="build-item-section">
            <span class="build-item-section-label">Cost</span>
            <div class="build-item-section-content">${formatCostWithAvailability(def, available)}</div>
          </div>
          ${prodSummary ? `<div class="build-item-section">
            <span class="build-item-section-label">Production</span>
            <div class="build-item-section-content">${prodSummary}</div>
          </div>` : ''}
          ${milInfo ? `<div class="build-item-section">
            <span class="build-item-section-label">Military</span>
            <div class="build-item-section-content">${milInfo}</div>
          </div>` : ''}
        </button>
      `;
    }
    html += '</div>';
  }
  buildContent.innerHTML = html;
}

/** Open/close the build panel */
export function toggleBuildPanel(): void {
  const wasHidden = buildPanel.classList.contains('hidden');
  buildPanel.classList.toggle('hidden');
  if (wasHidden) {
    cancelAttackTargeting();
    populateBuildPanel();
    closeInfoPanelFn();
    closeStatsPanelFn();
    closePriorityPanelFn();
    stopBuildPanelUpdates();
    buildPanelUpdateInterval = setInterval(populateBuildPanel, 1000);
  }
}

export function closeBuildPanel(): void {
  buildPanel.classList.add('hidden');
  stopBuildPanelUpdates();
}

export function stopBuildPanelUpdates(): void {
  if (buildPanelUpdateInterval !== null) {
    clearInterval(buildPanelUpdateInterval);
    buildPanelUpdateInterval = null;
  }
}

/** Enter building placement mode */
function startPlacement(type: BuildingType): void {
  closeBuildPanel();
  closeInfoPanelFn();
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
  closeInfoPanelFn();
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
  closeInfoPanelFn();
  cancelPlacement();
  const roadCtrl = getGame().getRoadPlacementController();
  if (!roadCtrl) return;
  roadCtrl.startRoadMode();
  placementLabel.textContent = 'Building Road — click a flag to start';
  placementBar.classList.remove('hidden');
}

/** Cancel attack targeting if active */
export function cancelAttackTargeting(): void {
  if (attackModeCleanup) {
    attackModeCleanup();
    attackModeCleanup = null;
  }
}

/** Enter attack targeting mode */
export function startAttackTargeting(sourceBuildingId: string): void {
  cancelAttackTargeting();

  attackSourceBuildingId = sourceBuildingId;
  closeInfoPanelFn();
  closeBuildPanel();
  closeStatsPanelFn();
  closePriorityPanelFn();
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

/** Execute attack */
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
export function cancelPlacement(): void {
  cancelAttackTargeting();
  const placement = getGame().getPlacementController();
  if (placement?.isActive) {
    placement.cancel();
  }
  cancelRoadPlacement();
  placementBar.classList.add('hidden');
}

/** Whether attack mode cleanup is currently active */
export function isAttackModeActive(): boolean {
  return attackModeCleanup !== null;
}

/** Get placement bar and label elements for startGame wiring */
export function getPlacementElements(): {
  placementBar: HTMLElement;
  placementLabel: HTMLElement;
  placementDistanceEl: HTMLElement;
} {
  return { placementBar, placementLabel, placementDistanceEl };
}

/** Hide the build panel element */
export function hideBuildPanelElement(): void {
  buildPanel.classList.add('hidden');
}

/** Hide the placement bar element */
export function hidePlacementBar(): void {
  placementBar.classList.add('hidden');
}
