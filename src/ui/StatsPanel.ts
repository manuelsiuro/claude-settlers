import type { Game } from '../engine/Game';
import { audioManager } from '../engine/AudioManager';
import { icon, resourceIcon } from './icons';
import { BuildingType, BUILDING_DEFINITIONS } from '../game/BuildingType';
import { BuildingState } from '../game/Building';
import { RESOURCE_PROPERTIES, ResourceType } from '../game/ResourceType';
import { UNIT_DEFINITIONS, UnitType } from '../game/UnitType';
import { renderEconomySection, drawEconomySparklines } from './EconomyPanel';
import { renderPriorityHTML, attachPriorityListeners } from './ResourcePriorityPanel';
import { PanelUpdater } from './PanelUpdater';

let statsPanel: HTMLElement;
let statsPanelContent: HTMLElement;
let statsTabsContainer: HTMLElement;
let statsFab: HTMLElement;
let buildToolbar: HTMLElement;
let statsPanelUpdateInterval: ReturnType<typeof setInterval> | null = null;
let updater: PanelUpdater;

/** Current active tab inside the stats panel */
let activeStatsTab: string = 'economy';

let getGame: () => Game;
let closeBuildPanelFn: () => void;
let closeInfoPanelFn: () => void;

export function initStatsPanel(
  getGameFn: () => Game,
  closeBuildPanel: () => void,
  closeInfoPanel: () => void,
): void {
  getGame = getGameFn;
  closeBuildPanelFn = closeBuildPanel;
  closeInfoPanelFn = closeInfoPanel;

  statsPanel = document.getElementById('stats-panel')!;
  statsPanelContent = document.getElementById('stats-panel-content')!;
  statsTabsContainer = document.getElementById('stats-panel-tabs')!;
  statsFab = document.getElementById('stats-fab')!;
  buildToolbar = document.getElementById('build-toolbar')!;
  updater = new PanelUpdater(statsPanelContent);
  const statsCloseBtn = document.getElementById('stats-close-btn')!;

  statsCloseBtn.addEventListener('click', closeStatsPanel);

  // Close panel on mode switch to avoid stale state
  const mq = window.matchMedia('(min-width: 769px)');
  mq.addEventListener('change', () => {
    if (!statsPanel.classList.contains('hidden')) {
      closeStatsPanel();
    }
  });

  // Stats FAB (mobile)
  statsFab.addEventListener('click', () => {
    audioManager.play('ui_click');
    if (statsPanel.classList.contains('hidden')) {
      showStatsPanel('economy');
    } else {
      closeStatsPanel();
    }
  });

  // Toolbar data-panel click handler (Stats / Priority buttons)
  buildToolbar.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest('.build-toolbar-tab') as HTMLElement | null;
    if (!tab) return;
    const panel = tab.dataset.panel;
    if (!panel) return; // data-category tabs handled by BuildPanel
    audioManager.play('ui_click');

    if (!statsPanel.classList.contains('hidden') && activeStatsTab === panel) {
      // Toggle off
      closeStatsPanel();
    } else {
      // Open to specified tab (or switch tab)
      showStatsPanel(panel);
    }
  });

  // Click outside to close (desktop)
  document.addEventListener('mousedown', (e) => {
    if (statsPanel.classList.contains('hidden')) return;
    const target = e.target as HTMLElement;
    if (statsPanel.contains(target) || buildToolbar.contains(target) || statsFab.contains(target)) return;
    closeStatsPanel();
  });

  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !statsPanel.classList.contains('hidden')) {
      closeStatsPanel();
    }
  });

  // Tab click delegation
  statsTabsContainer.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest('.stats-tab') as HTMLElement | null;
    if (!tab) return;
    const tabId = tab.dataset.tab;
    if (!tabId || tabId === activeStatsTab) return;
    audioManager.play('ui_click');
    activeStatsTab = tabId;
    updater.reset();
    populateStatsPanel();
    updateStatsToolbarState();
  });
}

/** Tab definitions */
const STATS_TABS = [
  { id: 'resources', label: 'Resources', iconName: 'warehouse' },
  { id: 'population', label: 'Pop', iconName: 'people' },
  { id: 'buildings', label: 'Buildings', iconName: 'hammer' },
  { id: 'military', label: 'Military', iconName: 'shield_icon' },
  { id: 'economy', label: 'Economy', iconName: 'bar_chart' },
  { id: 'priority', label: 'Priority', iconName: 'tune' },
];

/** Render the tab row HTML with badge counts */
function renderStatsTabs(): void {
  let game: Game;
  try { game = getGame(); } catch { statsTabsContainer.innerHTML = ''; return; }
  const pid = game.getHumanPlayerId();
  const gameState = game.getGameState();

  const badgeCounts: Record<string, number | null> = {
    resources: Object.values(getAllPlayerResources()).reduce((s, v) => s + (v ?? 0), 0),
    population: gameState.getUnitsByPlayer(pid).length,
    buildings: gameState.getBuildingsByPlayer(pid).filter(b => b.state === BuildingState.Active).length,
    military: gameState.getUnitsByPlayer(pid).filter(u => u.type === UnitType.Knight).length,
    economy: null,
    priority: null,
  };

  let html = '';
  for (const tab of STATS_TABS) {
    const active = activeStatsTab === tab.id ? ' stats-tab-active' : '';
    const badge = badgeCounts[tab.id] != null
      ? ` <span class="stats-tab-count">${badgeCounts[tab.id]}</span>`
      : '';
    html += `<button class="stats-tab${active}" data-tab="${tab.id}">
      ${icon(tab.iconName)}${badge}
    </button>`;
  }
  statsTabsContainer.innerHTML = html;
}

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

/** Get a structure key fingerprint for the stats panel layout */
function getStatsStructureKey(): string {
  const parts: string[] = [`tab:${activeStatsTab}`];
  const pid = getGame().getHumanPlayerId();
  const gameState = getGame().getGameState();

  if (activeStatsTab === 'resources') {
    // No structural changes for resources — all rows are always present
  } else if (activeStatsTab === 'population') {
    const population = getPopulationBreakdown();
    parts.push('u:' + population.map((p) => p.type).join(','));
  } else if (activeStatsTab === 'buildings') {
    const buildings = gameState.getBuildingsByPlayer(pid);
    const buildingTypes = [...new Set(buildings.map((b) => b.type))].sort();
    const constructing = buildings.some((b) => b.state === BuildingState.Planned || b.state === BuildingState.UnderConstruction);
    parts.push('b:' + buildingTypes.join(','));
    parts.push('bc:' + (constructing ? '1' : '0'));
  } else if (activeStatsTab === 'military') {
    const hasKnights = gameState.getUnitsByPlayer(pid).some((u) => u.type === UnitType.Knight);
    parts.push('k:' + (hasKnights ? '1' : '0'));
  } else if (activeStatsTab === 'economy') {
    const tracker = getGame().getEconomyTracker();
    const activeResources = tracker.getActiveResources();
    const econFlags = activeResources.map((r) => {
      const p = tracker.getProductionRate(r) > 0 ? 'p' : '';
      const c = tracker.getConsumptionRate(r) > 0 ? 'c' : '';
      return `${r}:${p}${c}`;
    }).join(',');
    parts.push('e:' + econFlags);
    parts.push('bn:' + (tracker.getBottlenecks().length > 0 ? '1' : '0'));
  } else if (activeStatsTab === 'priority') {
    // Priority tab: use a simple key since it manages its own DOM
    parts.push('prio');
  }

  return parts.join('|');
}

const RAW_RESOURCES = [
  ResourceType.Wood, ResourceType.Stone, ResourceType.Grain,
  ResourceType.Fish, ResourceType.IronOre, ResourceType.CoalOre, ResourceType.GoldOre,
];
const PROCESSED_RESOURCES = [
  ResourceType.Planks, ResourceType.Flour, ResourceType.Bread,
  ResourceType.Meat, ResourceType.IronBars, ResourceType.GoldBars,
  ResourceType.Tools, ResourceType.Swords, ResourceType.Shields,
];
const ALL_RESOURCES = [...RAW_RESOURCES, ...PROCESSED_RESOURCES];

/** Generate the stats panel HTML string for the active tab */
function generateStatsHTML(): string {
  if (activeStatsTab === 'priority') {
    return renderPriorityHTML(getGame());
  }

  const resources = getAllPlayerResources();
  const pid = getGame().getHumanPlayerId();
  const gameState = getGame().getGameState();

  let html = '';

  if (activeStatsTab === 'resources') {
    html += '<div class="info-section"><div class="info-section-label">Raw Materials</div>';
    for (const r of RAW_RESOURCES) {
      const amount = resources[r] ?? 0;
      const zeroClass = amount === 0 ? ' resource-pill-zero' : '';
      html += `<div class="info-resource-row">
        <span class="info-resource-name">${resourceIcon(r)} ${RESOURCE_PROPERTIES[r].label}</span>
        <span data-field="res-${r}" class="resource-pill${zeroClass}">${amount}</span>
      </div>`;
    }
    html += '</div>';

    html += '<div class="info-section"><div class="info-section-label">Processed Goods</div>';
    for (const r of PROCESSED_RESOURCES) {
      const amount = resources[r] ?? 0;
      const zeroClass = amount === 0 ? ' resource-pill-zero' : '';
      html += `<div class="info-resource-row">
        <span class="info-resource-name">${resourceIcon(r)} ${RESOURCE_PROPERTIES[r].label}</span>
        <span data-field="res-${r}" class="resource-pill${zeroClass}">${amount}</span>
      </div>`;
    }
    html += '</div>';
  } else if (activeStatsTab === 'population') {
    const population = getPopulationBreakdown();
    const totalUnits = gameState.getUnitsByPlayer(pid).length;
    html += '<div class="info-section">';
    html += `<div class="stat-highlight">
      <span class="info-label">Total Units</span>
      <span class="stat-highlight-value" data-field="pop-total">${totalUnits}</span>
    </div>`;
    for (const p of population) {
      html += `<div class="info-resource-row">
        <span class="info-resource-name">${p.label}</span>
        <span class="info-resource-amount" data-field="pop-${p.type}">${p.count}</span>
      </div>`;
    }
    html += '</div>';
  } else if (activeStatsTab === 'buildings') {
    const buildings = gameState.getBuildingsByPlayer(pid);
    const buildingCounts = new Map<string, number>();
    let activeBuildings = 0;
    let constructing = 0;
    for (const b of buildings) {
      buildingCounts.set(b.type, (buildingCounts.get(b.type) ?? 0) + 1);
      if (b.state === BuildingState.Active) activeBuildings++;
      if (b.state === BuildingState.Planned || b.state === BuildingState.UnderConstruction) constructing++;
    }
    html += '<div class="info-section">';
    html += `<div class="stat-highlight">
      <span class="info-label">Active</span>
      <span class="stat-highlight-value" data-field="bld-active">${activeBuildings}</span>
    </div>`;
    if (constructing > 0) {
      html += `<div class="info-row">
        <span class="info-label">Under Construction</span>
        <span class="info-value" data-field="bld-constructing">${constructing}</span>
      </div>`;
    }
    for (const [type, count] of buildingCounts) {
      const def = BUILDING_DEFINITIONS[type as BuildingType];
      html += `<div class="info-resource-row">
        <span class="info-resource-name">${def?.label ?? type}</span>
        <span class="info-resource-amount" data-field="bld-${type}">${count}</span>
      </div>`;
    }
    html += '</div>';
  } else if (activeStatsTab === 'military') {
    const knights = gameState.getUnitsByPlayer(pid).filter(u => u.type === UnitType.Knight);
    const goldBars = resources[ResourceType.GoldBars] ?? 0;
    html += '<div class="info-section">';
    html += `<div class="stat-highlight">
      <span class="info-label">Knights</span>
      <span class="stat-highlight-value" data-field="mil-knights">${knights.length}</span>
    </div>`;
    html += `<div class="info-row">
      <span class="info-label">Gold Bars</span>
      <span class="info-value" data-field="mil-gold">${goldBars}</span>
    </div>`;
    if (knights.length > 0) {
      const avgRank = knights.reduce((sum, k) => sum + k.knightRank, 0) / knights.length;
      html += `<div class="info-row">
        <span class="info-label">Avg Rank</span>
        <span class="info-value" data-field="mil-avg-rank">${avgRank.toFixed(1)}</span>
      </div>`;
    }
    html += '</div>';
  } else if (activeStatsTab === 'economy') {
    const tracker = getGame().getEconomyTracker();
    html += renderEconomySection(tracker);
  }

  return html;
}

/** Update dynamic values without rebuilding DOM */
function updateStatsValues(): void {
  const resources = getAllPlayerResources();
  const pid = getGame().getHumanPlayerId();
  const gameState = getGame().getGameState();

  if (activeStatsTab === 'resources') {
    for (const r of ALL_RESOURCES) {
      const amount = resources[r] ?? 0;
      updater.setText(`res-${r}`, `${amount}`);
      updater.setClass(`res-${r}`, `resource-pill${amount === 0 ? ' resource-pill-zero' : ''}`);
    }
  } else if (activeStatsTab === 'population') {
    const totalUnits = gameState.getUnitsByPlayer(pid).length;
    updater.setText('pop-total', `${totalUnits}`);
    const population = getPopulationBreakdown();
    for (const p of population) {
      updater.setText(`pop-${p.type}`, `${p.count}`);
    }
  } else if (activeStatsTab === 'buildings') {
    const buildings = gameState.getBuildingsByPlayer(pid);
    const buildingCounts = new Map<string, number>();
    let activeBuildings = 0;
    let constructing = 0;
    for (const b of buildings) {
      buildingCounts.set(b.type, (buildingCounts.get(b.type) ?? 0) + 1);
      if (b.state === BuildingState.Active) activeBuildings++;
      if (b.state === BuildingState.Planned || b.state === BuildingState.UnderConstruction) constructing++;
    }
    updater.setText('bld-active', `${activeBuildings}`);
    if (constructing > 0) {
      updater.setText('bld-constructing', `${constructing}`);
    }
    for (const [type, count] of buildingCounts) {
      updater.setText(`bld-${type}`, `${count}`);
    }
  } else if (activeStatsTab === 'military') {
    const knights = gameState.getUnitsByPlayer(pid).filter((u) => u.type === UnitType.Knight);
    const goldBars = resources[ResourceType.GoldBars] ?? 0;
    updater.setText('mil-knights', `${knights.length}`);
    updater.setText('mil-gold', `${goldBars}`);
    if (knights.length > 0) {
      const avgRank = knights.reduce((sum, k) => sum + k.knightRank, 0) / knights.length;
      updater.setText('mil-avg-rank', avgRank.toFixed(1));
    }
  } else if (activeStatsTab === 'economy') {
    const tracker = getGame().getEconomyTracker();
    const activeResources = tracker.getActiveResources();
    if (tracker.getBottlenecks().length > 0) {
      const names = tracker.getBottlenecks().map((r) => RESOURCE_PROPERTIES[r].label).join(', ');
      updater.setText('econ-bottleneck', `Shortages: ${names}`);
    }
    for (const r of activeResources) {
      const prod = tracker.getProductionRate(r);
      const cons = tracker.getConsumptionRate(r);
      const net = tracker.getNetBalance(r);
      if (prod > 0) {
        updater.setText(`econ-${r}-prod`, `+${prod.toFixed(1)}`);
      }
      if (cons > 0) {
        updater.setText(`econ-${r}-cons`, `-${cons.toFixed(1)}`);
      }
      const netSign = net >= 0 ? '+' : '';
      updater.setText(`econ-${r}-net`, `${netSign}${net.toFixed(1)}`);
      updater.setClass(`econ-${r}-net`, net >= 0 ? 'economy-net-positive' : 'economy-net-negative');
    }
  }
  // Priority tab: no value updates (it manages its own DOM via sliders)
}

/** Populate the stats panel content (called on 1s tick) */
function populateStatsPanel(): void {
  renderStatsTabs();

  if (activeStatsTab === 'priority') {
    // Priority tab: full re-render on each structural change
    const key = getStatsStructureKey();
    updater.update(
      key,
      () => generateStatsHTML(),
      () => {},
      () => attachPriorityListeners(statsPanelContent, getGame()),
    );
  } else {
    updater.update(
      getStatsStructureKey(),
      () => generateStatsHTML(),
      () => updateStatsValues(),
      activeStatsTab === 'economy'
        ? () => drawEconomySparklines(statsPanelContent, getGame().getEconomyTracker())
        : undefined,
    );
  }
}

/** Update toolbar active state for stats/priority buttons */
function updateStatsToolbarState(): void {
  const statsBtn = buildToolbar.querySelector('[data-panel="stats"]');
  const prioBtn = buildToolbar.querySelector('[data-panel="priority"]');
  const isOpen = !statsPanel.classList.contains('hidden');

  if (statsBtn) {
    statsBtn.classList.toggle('build-toolbar-tab-active', isOpen && activeStatsTab !== 'priority');
  }
  if (prioBtn) {
    prioBtn.classList.toggle('build-toolbar-tab-active', isOpen && activeStatsTab === 'priority');
  }
}

/** Deactivate build toolbar category tabs (called when stats opens) */
function deactivateBuildToolbarTabs(): void {
  const tabs = buildToolbar.querySelectorAll('.build-toolbar-tab[data-category]');
  for (const tab of tabs) {
    tab.classList.remove('build-toolbar-tab-active');
  }
}

export function showStatsPanel(tab?: string): void {
  activeStatsTab = tab ?? 'economy';
  updater.reset();
  closeBuildPanelFn();
  closeInfoPanelFn();

  populateStatsPanel();
  statsPanel.classList.remove('hidden');
  deactivateBuildToolbarTabs();
  updateStatsToolbarState();

  // Live updates
  stopStatsPanelUpdates();
  statsPanelUpdateInterval = setInterval(populateStatsPanel, 1000);
}

export function closeStatsPanel(): void {
  statsPanel.classList.add('hidden');
  stopStatsPanelUpdates();
  updater.reset();
  updateStatsToolbarState();
}

export function stopStatsPanelUpdates(): void {
  if (statsPanelUpdateInterval !== null) {
    clearInterval(statsPanelUpdateInterval);
    statsPanelUpdateInterval = null;
  }
}

/** Whether the stats panel is currently open */
export function isStatsPanelOpen(): boolean {
  return !statsPanel.classList.contains('hidden');
}

/** Hide the stats panel element */
export function hideStatsPanelElement(): void {
  statsPanel.classList.add('hidden');
  updateStatsToolbarState();
}
