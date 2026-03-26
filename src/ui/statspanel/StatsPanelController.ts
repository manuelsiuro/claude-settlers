import type { Game } from '../../engine/Game';
import { audioManager } from '../../engine/AudioManager';
import { icon } from '../icons';
import { ResourceType } from '../../game/ResourceType';
import { RESOURCE_PROPERTIES } from '../../game/ResourceType';
import { renderEconomySection, drawEconomySparklines } from '../EconomyPanel';
import { renderPriorityHTML, attachPriorityListeners } from '../ResourcePriorityPanel';
import { showTechTreePanel } from '../TechTreePanel';
import { showDashboard } from '../DashboardPanel';
import { PanelUpdater } from '../PanelUpdater';

import { generateResourcesHTML, updateResourceValues, getResourcesStructureKey, getResourcesTotal } from './ResourceStats';
import { generatePopulationHTML, updatePopulationValues, getPopulationStructureKey } from './PopulationStats';
import { generateBuildingsHTML, updateBuildingValues, getBuildingsStructureKey, getActiveBuildingCount } from './BuildingStats';
import { generateMilitaryHTML, updateMilitaryValues, getMilitaryStructureKey, getMilitaryCount } from './MilitaryStats';

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

/** Tab definitions */
const STATS_TABS = [
  { id: 'resources', label: 'Resources', iconName: 'warehouse' },
  { id: 'population', label: 'Pop', iconName: 'people' },
  { id: 'buildings', label: 'Buildings', iconName: 'hammer' },
  { id: 'military', label: 'Military', iconName: 'shield_icon' },
  { id: 'economy', label: 'Economy', iconName: 'bar_chart' },
  { id: 'priority', label: 'Priority', iconName: 'tune' },
];

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

    if (panel === 'techtree') {
      showTechTreePanel();
      return;
    }

    if (panel === 'dashboard') {
      showDashboard();
      return;
    }

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

/** Render the tab row HTML with badge counts */
function renderStatsTabs(): void {
  let game: Game;
  try { game = getGame(); } catch { statsTabsContainer.innerHTML = ''; return; }
  const pid = game.getHumanPlayerId();
  const gameState = game.getGameState();

  const badgeCounts: Record<string, number | null> = {
    resources: getResourcesTotal(getAllPlayerResources()),
    population: gameState.getUnitsByPlayer(pid).length,
    buildings: getActiveBuildingCount(game),
    military: getMilitaryCount(game),
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

/** Get a structure key fingerprint for the stats panel layout */
function getStatsStructureKey(): string {
  const parts: string[] = [`tab:${activeStatsTab}`];
  const game = getGame();

  if (activeStatsTab === 'resources') {
    parts.push(getResourcesStructureKey());
  } else if (activeStatsTab === 'population') {
    parts.push(getPopulationStructureKey(game, getAllPlayerResources()));
  } else if (activeStatsTab === 'buildings') {
    parts.push(getBuildingsStructureKey(game));
  } else if (activeStatsTab === 'military') {
    parts.push(getMilitaryStructureKey(game));
  } else if (activeStatsTab === 'economy') {
    const tracker = game.getEconomyTracker();
    const activeResources = tracker.getActiveResources();
    const econFlags = activeResources.map((r) => {
      const p = tracker.getProductionRate(r) > 0 ? 'p' : '';
      const c = tracker.getConsumptionRate(r) > 0 ? 'c' : '';
      return `${r}:${p}${c}`;
    }).join(',');
    parts.push('e:' + econFlags);
    parts.push('bn:' + (tracker.getBottlenecks().length > 0 ? '1' : '0'));
  } else if (activeStatsTab === 'priority') {
    parts.push('prio');
  }

  return parts.join('|');
}

/** Generate the stats panel HTML string for the active tab */
function generateStatsHTML(): string {
  if (activeStatsTab === 'priority') {
    return renderPriorityHTML(getGame());
  }

  const resources = getAllPlayerResources();
  const game = getGame();

  if (activeStatsTab === 'resources') {
    return generateResourcesHTML(resources);
  } else if (activeStatsTab === 'population') {
    return generatePopulationHTML(game, resources);
  } else if (activeStatsTab === 'buildings') {
    return generateBuildingsHTML(game);
  } else if (activeStatsTab === 'military') {
    return generateMilitaryHTML(game, resources);
  } else if (activeStatsTab === 'economy') {
    const tracker = game.getEconomyTracker();
    return renderEconomySection(tracker);
  }

  return '';
}

/** Update dynamic values without rebuilding DOM */
function updateStatsValues(): void {
  const resources = getAllPlayerResources();
  const game = getGame();

  if (activeStatsTab === 'resources') {
    updateResourceValues(resources, updater);
  } else if (activeStatsTab === 'population') {
    updatePopulationValues(game, resources, updater);
  } else if (activeStatsTab === 'buildings') {
    updateBuildingValues(game, updater);
  } else if (activeStatsTab === 'military') {
    updateMilitaryValues(game, resources, updater);
  } else if (activeStatsTab === 'economy') {
    const tracker = game.getEconomyTracker();
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
