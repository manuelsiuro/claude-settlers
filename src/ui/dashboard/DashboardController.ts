import type { Game } from '../../engine/Game';
import { icon } from '../icons';
import { audioManager } from '../../engine/AudioManager';
import { ResourceType } from '../../game/ResourceType';
import { TIME_SCALE_POINTS } from './dashboardHelpers';
import type { ResourceFilter } from './dashboardHelpers';
import { renderOverview, drawOverviewCharts } from './OverviewTab';
import { renderEconomy, drawEconomyCharts } from './EconomyTab';
import type { TimeScale } from './EconomyTab';
import { renderResources, drawResourceCharts } from './ResourcesTab';
import { renderPopulation, drawPopulationCharts } from './PopulationTab';
import { renderBuildings, drawBuildingCharts } from './BuildingsTab';

// ============================================================
// State
// ============================================================
let overlay: HTMLElement;
let getGame: () => Game;
let updateInterval: ReturnType<typeof setInterval> | null = null;
let activeTab = 'overview';
let timeScale: TimeScale = '15m';
let resourceFilter: ResourceFilter = 'all';
let selectedEconResource: ResourceType | null = null;

// ============================================================
// Init / Show / Close
// ============================================================

export function initDashboard(getGameFn: () => Game): void {
  getGame = getGameFn;
  overlay = document.getElementById('dashboard-overlay')!;
}

export function showDashboard(): void {
  audioManager.play('ui_click');
  activeTab = 'overview';
  selectedEconResource = null;
  overlay.classList.remove('hidden');
  render();
  stopUpdates();
  updateInterval = setInterval(updateCharts, 2000);

  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeDashboard();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

export function closeDashboard(): void {
  overlay.classList.add('hidden');
  overlay.innerHTML = '';
  stopUpdates();
}

function stopUpdates(): void {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}

// ============================================================
// Main render
// ============================================================

function render(): void {
  const tabs = [
    { id: 'overview', label: 'Overview', iconName: 'bar_chart' },
    { id: 'economy', label: 'Economy', iconName: 'bar_chart' },
    { id: 'resources', label: 'Resources', iconName: 'warehouse' },
    { id: 'population', label: 'Population', iconName: 'people' },
    { id: 'buildings', label: 'Buildings', iconName: 'hammer' },
  ];

  let tabsHtml = '';
  for (const t of tabs) {
    const active = activeTab === t.id ? ' dashboard-tab-active' : '';
    tabsHtml += `<button class="dashboard-tab${active}" data-dtab="${t.id}">${icon(t.iconName)}<span class="dashboard-tab-label">${t.label}</span></button>`;
  }

  overlay.innerHTML = `
    <div class="dashboard-panel">
      <div class="dashboard-header">
        <span class="dashboard-title">${icon('bar_chart')} Dashboard</span>
        <button class="icon-btn" id="dashboard-close-btn">${icon('close')}</button>
      </div>
      <div class="dashboard-tabs" id="dashboard-tabs">${tabsHtml}</div>
      <div class="dashboard-content" id="dashboard-content"></div>
    </div>
  `;

  // Event listeners
  document.getElementById('dashboard-close-btn')!.addEventListener('click', closeDashboard);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDashboard();
  });

  document.getElementById('dashboard-tabs')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.dashboard-tab') as HTMLElement | null;
    if (!btn) return;
    const tabId = btn.dataset.dtab;
    if (!tabId || tabId === activeTab) return;
    audioManager.play('ui_click');
    activeTab = tabId;
    selectedEconResource = null;
    render();
  });

  renderContent();
}

function renderContent(): void {
  const content = document.getElementById('dashboard-content');
  if (!content) return;

  switch (activeTab) {
    case 'overview': renderOverview(content, getGame); break;
    case 'economy':
      renderEconomy(content, getGame, timeScale, resourceFilter, selectedEconResource, {
        onTimeScaleChange: (ts) => { timeScale = ts; renderContent(); },
        onFilterChange: (f) => { resourceFilter = f; renderContent(); },
        onResourceSelect: (r) => { selectedEconResource = r; renderContent(); },
      });
      break;
    case 'resources':
      renderResources(content, getGame, timeScale, (ts) => { timeScale = ts; renderContent(); });
      break;
    case 'population': renderPopulation(content, getGame); break;
    case 'buildings': renderBuildings(content, getGame); break;
  }

  // Draw charts after DOM is in place
  requestAnimationFrame(() => drawAllCharts());
}

// ============================================================
// Chart drawing
// ============================================================

function drawAllCharts(): void {
  let game: Game;
  try { game = getGame(); } catch { return; }

  const dt = game.getDashboardTracker();
  const tracker = game.getEconomyTracker();
  const maxPts = TIME_SCALE_POINTS[timeScale] ?? 30;

  if (activeTab === 'overview') {
    drawOverviewCharts(dt, tracker);
  } else if (activeTab === 'economy') {
    drawEconomyCharts(tracker, maxPts, resourceFilter, selectedEconResource);
  } else if (activeTab === 'resources') {
    drawResourceCharts(game, dt, maxPts);
  } else if (activeTab === 'population') {
    drawPopulationCharts(dt);
  } else if (activeTab === 'buildings') {
    drawBuildingCharts(dt);
  }
}

function updateCharts(): void {
  if (overlay.classList.contains('hidden')) return;
  renderContent();
}
