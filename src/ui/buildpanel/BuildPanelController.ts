/**
 * BuildPanelController — Main orchestrator for the build panel.
 * Handles init, show/close/toggle, event wiring, recent buildings,
 * mobile tabs, and placement mode.
 */
import type { Game } from '../../engine/Game';
import { audioManager } from '../../engine/AudioManager';
import { BuildingType, BUILDING_DEFINITIONS } from '../../game/BuildingType';
import { buildingIcon } from '../icons';
import { PanelUpdater } from '../PanelUpdater';
import {
  getPlayerResources,
  canAfford,
  generateBuildHTML,
  generateTooltipContent,
  updateBuildValues,
} from './BuildingCatalog';
import {
  initAttackMode,
  cancelAttackTargeting,
} from './AttackMode';

// ============================================================
// Module state
// ============================================================

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
/** Mobile: which tile is expanded (desktop only now - kept for compatibility) */
let expandedTileType: BuildingType | null = null;

let getGame: () => Game;

/** Building detail sheet elements (mobile) */
let buildingDetailSheet: HTMLElement;
let buildingDetailContent: HTMLElement;

// Callbacks to close other panels
let closeInfoPanelFn: () => void;
let closeStatsPanelFn: () => void;

/** Recently placed building types (max 5), persisted to localStorage */
const RECENT_STORAGE_KEY = 'feudal-recent-buildings';
let recentBuildings: BuildingType[] = [];

// ============================================================
// Recent buildings
// ============================================================

function loadRecentBuildings(): void {
  try {
    const stored = localStorage.getItem(RECENT_STORAGE_KEY);
    if (stored) {
      const arr = JSON.parse(stored) as string[];
      recentBuildings = arr.filter((t) => t in BUILDING_DEFINITIONS) as BuildingType[];
    }
  } catch { /* ignore */ }
}

function saveRecentBuildings(): void {
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentBuildings));
}

function addToRecents(type: BuildingType): void {
  recentBuildings = [type, ...recentBuildings.filter((t) => t !== type)].slice(0, 5);
  saveRecentBuildings();
  updateMobileToolbarRecents();
}

/** Get recent buildings for mobile toolbar */
export function getRecentBuildings(): BuildingType[] {
  return recentBuildings;
}

/** Update the recent building thumbnails in the mobile toolbar */
function updateMobileToolbarRecents(): void {
  const container = document.getElementById('mt-recents');
  if (!container) return;
  const recents = recentBuildings.slice(0, 3);
  container.innerHTML = recents.map((type) =>
    `<button class="mobile-toolbar-recent-btn" data-building-type="${type}" title="${BUILDING_DEFINITIONS[type].label}">
      ${buildingIcon(type, 28)}
    </button>`
  ).join('');
}

function closeBuildingDetail(): void {
  buildingDetailSheet.classList.add('hidden');
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
  const available = getPlayerResources(getGame);
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
    { key: 'housing', label: 'Housing' },
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
// Build panel structure key & populate
// ============================================================

/** Get a structure key for the build panel layout */
function getBuildStructureKey(): string {
  return `${buildFilterCategory}:${isDesktop ? 'd' : 'm'}:${expandedTileType ?? ''}`;
}

/** Build the building menu HTML organized by tier */
export function populateBuildPanel(): void {
  const available = getPlayerResources(getGame);
  updater.update(
    getBuildStructureKey(),
    () => generateBuildHTML(buildFilterCategory, isDesktop, expandedTileType, available),
    () => updateBuildValues(buildFilterCategory, getPlayerResources(getGame), updater),
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
  closeBuildingDetail();
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
// Placement
// ============================================================

/** Cancel road placement */
function cancelRoadPlacement(): void {
  const roadCtrl = getGame().getRoadPlacementController();
  if (roadCtrl?.isActive) {
    roadCtrl.cancel();
  }
}

/** Enter building placement mode */
function startPlacement(type: BuildingType): void {
  closeBuildingDetail();
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

  // Track recent placements for mobile toolbar
  addToRecents(type);
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

// ============================================================
// Init
// ============================================================

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

  // Mobile FAB (still wired for fallback, but hidden by toolbar CSS)
  buildFab.addEventListener('click', toggleBuildPanel);
  buildCloseBtn.addEventListener('click', closeBuildPanel);
  placementCancelBtn.addEventListener('click', cancelPlacement);

  // Building detail sheet (mobile)
  buildingDetailSheet = document.getElementById('building-detail-sheet')!;
  buildingDetailContent = document.getElementById('building-detail-content')!;

  // Detail sheet: place button click
  buildingDetailContent.addEventListener('click', (e) => {
    const placeBtn = (e.target as HTMLElement).closest('.building-detail-place-btn') as HTMLElement | null;
    if (placeBtn?.dataset.buildingType) {
      audioManager.play('ui_click');
      startPlacement(placeBtn.dataset.buildingType as BuildingType);
    }
  });

  // Load recent buildings from localStorage
  loadRecentBuildings();
  updateMobileToolbarRecents();

  // Mobile toolbar recents click handler
  const mtRecents = document.getElementById('mt-recents');
  if (mtRecents) {
    mtRecents.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.mobile-toolbar-recent-btn') as HTMLElement | null;
      if (btn?.dataset.buildingType) {
        audioManager.play('ui_click');
        startPlacement(btn.dataset.buildingType as BuildingType);
      }
    });
  }

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
      // Toggle off - close panel
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

      // Direct placement on both desktop and mobile
      startPlacement(type);
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
      const available = getPlayerResources(getGame);
      if (canAfford(def, available)) {
        startPlacement(type);
      }
    }
  };
  document.addEventListener('keydown', keydownHandler);

  // Initialize attack mode with its dependencies
  initAttackMode({
    getGame: () => getGame(),
    closeInfoPanel: () => closeInfoPanelFn(),
    closeBuildPanel: () => closeBuildPanel(),
    closeStatsPanel: () => closeStatsPanelFn(),
    cancelPlacement: () => cancelPlacement(),
    cancelRoadPlacement: () => cancelRoadPlacement(),
    getPlacementBarEl: () => placementBar,
    getPlacementLabelEl: () => placementLabel,
  });
}
