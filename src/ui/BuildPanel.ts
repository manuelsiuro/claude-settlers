import type { Game } from '../engine/Game';
import { audioManager } from '../engine/AudioManager';
import { BuildingType, BUILDING_DEFINITIONS, getBuildingsByTier } from '../game/BuildingType';
import type { BuildingDefinition } from '../game/BuildingType';
import { BuildingState } from '../game/Building';
import { RESOURCE_PROPERTIES, ResourceType } from '../game/ResourceType';
import { resourceIcon } from './icons';
import { showSnackbar } from './Snackbar';
import { PanelUpdater } from './PanelUpdater';

let buildPanel: HTMLElement;
let buildContent: HTMLElement;
let buildPanelTabs: HTMLElement;
let buildToolbar: HTMLElement;
let buildTooltip: HTMLElement;
let placementBar: HTMLElement;
let placementLabel: HTMLElement;
let placementDistanceEl: HTMLElement;
let buildPanelUpdateInterval: ReturnType<typeof setInterval> | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;
let updater: PanelUpdater;

/** Current build panel filter category */
let buildFilterCategory: string = 'all';

/** Desktop vs mobile mode */
let isDesktop = false;
/** Active toolbar tab on desktop (null = panel closed) */
let activeToolbarCategory: string | null = null;
/** Mobile: which tile is expanded */
let expandedTileType: BuildingType | null = null;

let getGame: () => Game;

/** Attack targeting state */
let attackSourceBuildingId: string | null = null;
/** Cleanup function for current attack mode */
let attackModeCleanup: (() => void) | null = null;

// Callbacks to close other panels
let closeInfoPanelFn: () => void;
let closeStatsPanelFn: () => void;

export function initBuildPanel(
  getGameFn: () => Game,
  closeInfoPanel: () => void,
  closeStatsPanel: () => void,
): void {
  getGame = getGameFn;
  closeInfoPanelFn = closeInfoPanel;
  closeStatsPanelFn = closeStatsPanel;

  buildPanel = document.getElementById('build-panel')!;
  buildContent = document.getElementById('build-panel-content')!;
  buildPanelTabs = document.getElementById('build-panel-tabs')!;
  buildToolbar = document.getElementById('build-toolbar')!;
  buildTooltip = document.getElementById('build-tooltip')!;
  updater = new PanelUpdater(buildContent);
  placementBar = document.getElementById('placement-bar')!;
  placementLabel = document.getElementById('placement-label')!;
  placementDistanceEl = document.getElementById('placement-distance')!;
  const buildFab = document.getElementById('build-fab')!;
  const buildCloseBtn = document.getElementById('build-close-btn')!;
  const placementCancelBtn = document.getElementById('placement-cancel-btn')!;

  // Set up responsive mode
  const mq = window.matchMedia('(min-width: 769px)');
  isDesktop = mq.matches;
  mq.addEventListener('change', (e) => {
    isDesktop = e.matches;
    // Close panel on mode switch to avoid stale state
    closeBuildPanel();
  });

  // Mobile FAB
  buildFab.addEventListener('click', toggleBuildPanel);
  buildCloseBtn.addEventListener('click', closeBuildPanel);
  placementCancelBtn.addEventListener('click', cancelPlacement);

  // Click outside panel to close (desktop)
  document.addEventListener('mousedown', (e) => {
    if (buildPanel.classList.contains('hidden')) return;
    const target = e.target as HTMLElement;
    if (buildPanel.contains(target) || buildToolbar.contains(target) || buildFab.contains(target)) return;
    closeBuildPanel();
  });

  // Desktop toolbar tab clicks (only handle data-category tabs; data-panel handled by StatsPanel)
  buildToolbar.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest('.build-toolbar-tab') as HTMLElement | null;
    if (!tab) return;
    if (tab.dataset.panel) return; // Stats/Priority buttons handled by StatsPanel
    const cat = tab.dataset.category;
    if (!cat) return;
    audioManager.play('ui_click');

    if (activeToolbarCategory === cat) {
      // Toggle off — close panel
      closeBuildPanel();
    } else {
      // Open/switch category
      activeToolbarCategory = cat;
      buildFilterCategory = cat;
      updateToolbarActiveState();
      if (buildPanel.classList.contains('hidden')) {
        openBuildPanel();
      } else {
        updater.reset();
        populateBuildPanel();
      }
    }
  });

  // Tile click handler (event delegation on build-panel-content)
  buildContent.addEventListener('click', (e) => {
    const placeBtn = (e.target as HTMLElement).closest('.build-tile-place-btn') as HTMLElement | null;
    if (placeBtn) {
      const type = placeBtn.dataset.buildingType as BuildingType;
      if (type) {
        audioManager.play('ui_click');
        startPlacement(type);
      }
      return;
    }

    const tile = (e.target as HTMLElement).closest('.build-tile') as HTMLElement | null;
    if (tile) {
      if (tile.classList.contains('build-tile-disabled')) return;
      audioManager.play('ui_click');
      const action = tile.dataset.action;
      if (action === 'place-flag') {
        startFlagMode();
        return;
      }
      if (action === 'build-road') {
        startRoadMode();
        return;
      }
      const type = tile.dataset.buildingType as BuildingType;
      if (!type) return;

      if (isDesktop) {
        // Desktop: immediate placement
        startPlacement(type);
      } else {
        // Mobile: tap to expand, tap again to place
        if (expandedTileType === type) {
          startPlacement(type);
        } else {
          expandedTileType = type;
          updater.reset();
          populateBuildPanel();
        }
      }
      return;
    }

    // Mobile category tab click
    const tab = (e.target as HTMLElement).closest('.build-tab') as HTMLElement | null;
    if (tab) {
      const cat = tab.dataset.category;
      if (cat) {
        buildFilterCategory = cat;
        expandedTileType = null;
        updater.reset();
        populateBuildPanel();
        renderMobileTabs();
      }
    }
  });

  // Also handle tab clicks in the sticky mobile tabs container
  buildPanelTabs.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest('.build-tab') as HTMLElement | null;
    if (!tab) return;
    const cat = tab.dataset.category;
    if (cat) {
      buildFilterCategory = cat;
      expandedTileType = null;
      updater.reset();
      populateBuildPanel();
      renderMobileTabs();
    }
  });

  // Desktop: hover tooltip on tiles
  buildContent.addEventListener('mouseenter', handleTileMouseEnter, true);
  buildContent.addEventListener('mouseleave', handleTileMouseLeave, true);

  // Building hotkeys + Escape to close (only when build panel is open)
  keydownHandler = (e: KeyboardEvent) => {
    if (buildPanel.classList.contains('hidden')) return;
    if (e.key === 'Escape') {
      closeBuildPanel();
      return;
    }
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
  };
  document.addEventListener('keydown', keydownHandler);
}

// ============================================================
// Desktop Tooltip
// ============================================================

function handleTileMouseEnter(e: Event): void {
  if (!isDesktop) return;
  const tile = (e.target as HTMLElement).closest?.('.build-tile') as HTMLElement | null;
  if (!tile || tile.dataset.action) return; // skip flag/road tiles
  const type = tile.dataset.buildingType as BuildingType;
  if (!type) return;
  const def = BUILDING_DEFINITIONS[type];
  if (!def) return;
  const available = getPlayerResources();
  showBuildTooltip(tile, generateTooltipContent(def, available));
}

function handleTileMouseLeave(e: Event): void {
  const tile = (e.target as HTMLElement).closest?.('.build-tile') as HTMLElement | null;
  if (!tile) return;
  hideBuildTooltip();
}

function showBuildTooltip(anchor: HTMLElement, html: string): void {
  buildTooltip.innerHTML = html;
  buildTooltip.style.display = 'block';

  const rect = anchor.getBoundingClientRect();
  const ttRect = buildTooltip.getBoundingClientRect();

  // Position above the tile, centered
  let left = rect.left + rect.width / 2 - ttRect.width / 2;
  let top = rect.top - ttRect.height - 8;

  // Clamp to viewport
  if (left < 8) left = 8;
  if (left + ttRect.width > window.innerWidth - 8) left = window.innerWidth - 8 - ttRect.width;
  if (top < 8) {
    // Show below instead
    top = rect.bottom + 8;
  }

  buildTooltip.style.left = `${left}px`;
  buildTooltip.style.top = `${top}px`;
}

function hideBuildTooltip(): void {
  buildTooltip.style.display = 'none';
}

function generateTooltipContent(def: BuildingDefinition, available: Partial<Record<ResourceType, number>>): string {
  const prodSummary = formatProductionSummary(def);
  const milInfo = def.knightSlots > 0
    ? `<div class="build-item-section"><span class="build-item-section-label">Military</span><div class="build-item-section-content"><span class="build-item-military">${def.knightSlots} knight slot${def.knightSlots > 1 ? 's' : ''} \u00b7 range ${def.influenceRadius}</span></div></div>`
    : '';
  return `
    <div class="build-tooltip-name">${def.label}</div>
    <div class="build-tooltip-desc">${def.description}</div>
    <div class="build-item-section">
      <span class="build-item-section-label">Cost</span>
      <div class="build-item-section-content">${formatCostWithAvailability(def, available)}</div>
    </div>
    ${prodSummary ? `<div class="build-item-section"><span class="build-item-section-label">Production</span><div class="build-item-section-content">${prodSummary}</div></div>` : ''}
    ${milInfo}
  `;
}

// ============================================================
// Mobile Tabs
// ============================================================

function renderMobileTabs(): void {
  if (isDesktop) {
    buildPanelTabs.innerHTML = '';
    return;
  }
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
  buildPanelTabs.innerHTML = html;
}

// ============================================================
// Toolbar state
// ============================================================

function updateToolbarActiveState(): void {
  const tabs = buildToolbar.querySelectorAll('.build-toolbar-tab');
  for (const tab of tabs) {
    const cat = (tab as HTMLElement).dataset.category;
    if (cat === activeToolbarCategory) {
      tab.classList.add('build-toolbar-tab-active');
    } else {
      tab.classList.remove('build-toolbar-tab-active');
    }
  }
}

// ============================================================
// Resource helpers
// ============================================================

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

/** Format cost with availability coloring and data-field attributes */
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
      return `<span class="${cssClass}" data-field="cost-${def.type}-${c.resource}">${resourceIcon(c.resource)} ${RESOURCE_PROPERTIES[c.resource].label} ${c.amount}</span>`;
    })
    .join(' ');
}

/** Compact cost: icon + amount only (for tiles) */
function formatCompactCost(
  def: BuildingDefinition,
  available: Partial<Record<ResourceType, number>>,
): string {
  if (def.cost.length === 0) return '<span class="cost-pill cost-pill-free" style="font-size:0.625rem;padding:1px 6px;">Free</span>';
  return def.cost
    .map((c) => {
      const have = available[c.resource] ?? 0;
      const ok = have >= c.amount;
      const cssClass = ok ? 'cost-pill cost-pill-ok' : 'cost-pill cost-pill-short';
      return `<span class="${cssClass}" style="font-size:0.625rem;padding:1px 6px;" data-field="cost-${def.type}-${c.resource}">${resourceIcon(c.resource)} ${c.amount}</span>`;
    })
    .join('');
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

// ============================================================
// Build HTML generation
// ============================================================

/** Get a structure key for the build panel layout */
function getBuildStructureKey(): string {
  return `${buildFilterCategory}:${isDesktop ? 'd' : 'm'}:${expandedTileType ?? ''}`;
}

/** Generate the build panel HTML string (grid of tiles) */
function generateBuildHTML(): string {
  const tiers = [
    { tier: 1, label: 'Basic' },
    { tier: 2, label: 'Advanced' },
    { tier: 3, label: 'Specialized' },
  ];

  const available = getPlayerResources();

  let html = '<div class="build-grid">';

  // Logistics section
  const showLogistics = buildFilterCategory === 'all' || buildFilterCategory === 'logistics';
  if (showLogistics) {
    html += `<div class="build-grid-tier-label"><span class="tier-badge tier-badge-logistics">LOG</span> Logistics</div>`;
    html += `<button class="build-tile" data-action="place-flag">
      <span class="build-tile-name">Flag</span>
      <div class="build-tile-cost"><span class="cost-pill cost-pill-free" style="font-size:0.625rem;padding:1px 6px;">Free</span></div>
    </button>`;
    html += `<button class="build-tile" data-action="build-road">
      <span class="build-tile-name">Road</span>
      <div class="build-tile-cost"><span class="cost-pill cost-pill-free" style="font-size:0.625rem;padding:1px 6px;">Free</span></div>
    </button>`;
  }

  for (const { tier, label } of tiers) {
    const buildings = getBuildingsByTier(tier).filter((def) => {
      if (buildFilterCategory === 'all') return true;
      return def.category === buildFilterCategory;
    });
    if (buildings.length === 0) continue;

    html += `<div class="build-grid-tier-label"><span class="tier-badge tier-badge-${tier}">${tier}</span> ${label}</div>`;

    for (const def of buildings) {
      const affordable = canAfford(def, available);
      const tileClass = affordable ? 'build-tile' : 'build-tile build-tile-disabled';
      html += `<button class="${tileClass}" data-field="build-${def.type}" data-building-type="${def.type}">
        <span class="build-tile-name">${def.label}</span>
        <div class="build-tile-cost">${formatCompactCost(def, available)}</div>
      </button>`;

      // Mobile: expanded detail after this tile
      if (!isDesktop && expandedTileType === def.type) {
        html += generateExpandedDetailHTML(def, available, affordable);
      }
    }
  }

  html += '</div>';
  return html;
}

/** Generate the expanded inline detail (mobile only) */
function generateExpandedDetailHTML(
  def: BuildingDefinition,
  available: Partial<Record<ResourceType, number>>,
  affordable: boolean,
): string {
  const prodSummary = formatProductionSummary(def);
  const milInfo = def.knightSlots > 0
    ? `<div class="build-item-section"><span class="build-item-section-label">Military</span><div class="build-item-section-content"><span class="build-item-military">${def.knightSlots} knight slot${def.knightSlots > 1 ? 's' : ''} \u00b7 range ${def.influenceRadius}</span></div></div>`
    : '';

  return `<div class="build-tile-expanded">
    <div class="build-tile-expanded-name">${def.label}</div>
    <div class="build-tile-expanded-desc">${def.description}</div>
    <div class="build-item-section">
      <span class="build-item-section-label">Cost</span>
      <div class="build-item-section-content">${formatCostWithAvailability(def, available)}</div>
    </div>
    ${prodSummary ? `<div class="build-item-section"><span class="build-item-section-label">Production</span><div class="build-item-section-content">${prodSummary}</div></div>` : ''}
    ${milInfo}
    <button class="build-tile-place-btn" data-building-type="${def.type}" ${!affordable ? 'disabled' : ''}>Place ${def.label}</button>
  </div>`;
}

// ============================================================
// Update (PanelUpdater integration)
// ============================================================

/** Update affordability classes without rebuilding DOM */
function updateBuildValues(): void {
  const available = getPlayerResources();
  const tiers = [1, 2, 3];
  for (const tier of tiers) {
    const buildings = getBuildingsByTier(tier).filter((def) => {
      if (buildFilterCategory === 'all') return true;
      return def.category === buildFilterCategory;
    });
    for (const def of buildings) {
      const affordable = canAfford(def, available);
      updater.setClass(`build-${def.type}`, affordable ? 'build-tile' : 'build-tile build-tile-disabled');
      for (const c of def.cost) {
        const have = available[c.resource] ?? 0;
        const ok = have >= c.amount;
        updater.setClass(`cost-${def.type}-${c.resource}`, ok ? 'cost-pill cost-pill-ok' : 'cost-pill cost-pill-short');
      }
    }
  }
}

/** Build the building menu HTML organized by tier */
export function populateBuildPanel(): void {
  updater.update(
    getBuildStructureKey(),
    () => generateBuildHTML(),
    () => updateBuildValues(),
  );
}

// ============================================================
// Open/close
// ============================================================

/** Internal: open the panel (shared by FAB + toolbar) */
function openBuildPanel(): void {
  cancelAttackTargeting();
  buildPanel.classList.remove('hidden');
  updater.reset();
  renderMobileTabs();
  populateBuildPanel();
  closeInfoPanelFn();
  closeStatsPanelFn();
  stopBuildPanelUpdates();
  buildPanelUpdateInterval = setInterval(populateBuildPanel, 1000);
}

/** Open/close the build panel (mobile FAB + nav drawer) */
export function toggleBuildPanel(): void {
  if (buildPanel.classList.contains('hidden')) {
    if (!isDesktop) {
      buildFilterCategory = 'all';
      expandedTileType = null;
    }
    openBuildPanel();
  } else {
    closeBuildPanel();
  }
}

export function closeBuildPanel(): void {
  buildPanel.classList.add('hidden');
  hideBuildTooltip();
  stopBuildPanelUpdates();
  updater.reset();
  activeToolbarCategory = null;
  expandedTileType = null;
  updateToolbarActiveState();
}

export function stopBuildPanelUpdates(): void {
  if (buildPanelUpdateInterval !== null) {
    clearInterval(buildPanelUpdateInterval);
    buildPanelUpdateInterval = null;
  }
}

/** Clean up BuildPanel event listeners and update interval */
export function disposeBuildPanel(): void {
  stopBuildPanelUpdates();
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }
}

// ============================================================
// Placement / Attack
// ============================================================

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
  activeToolbarCategory = null;
  updateToolbarActiveState();
}

/** Hide the placement bar element */
export function hidePlacementBar(): void {
  placementBar.classList.add('hidden');
}
