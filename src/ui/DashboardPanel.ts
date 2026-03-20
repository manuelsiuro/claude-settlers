import type { Game } from '../engine/Game';
import { icon, resourceIcon } from './icons';
import { audioManager } from '../engine/AudioManager';
import { RESOURCE_PROPERTIES, ResourceType, isFood } from '../game/ResourceType';
import { UNIT_DEFINITIONS, UnitType } from '../game/UnitType';
import { BuildingState } from '../game/Building';
import { BUILDING_DEFINITIONS } from '../game/BuildingType';
import type { BuildingType } from '../game/BuildingType';
import { drawLineChart, drawDualBarChart, drawDonutChart, generateTimeLabels } from './ChartRenderer';
import type { LineSeries, DualBarItem } from './ChartRenderer';
import { HUNGER_HUNGRY_THRESHOLD, HUNGER_STARVING_THRESHOLD } from '../game/data/balanceConstants';

// ============================================================
// State
// ============================================================
let overlay: HTMLElement;
let getGame: () => Game;
let updateInterval: ReturnType<typeof setInterval> | null = null;
let activeTab = 'overview';
let timeScale: '5m' | '15m' | '30m' | '1hr' = '15m';
let resourceFilter: 'all' | 'raw' | 'processed' | 'food' | 'military' = 'all';
let selectedEconResource: ResourceType | null = null;

const TIME_SCALE_POINTS: Record<string, number> = { '5m': 10, '15m': 30, '30m': 60, '1hr': 120 };

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
    case 'overview': renderOverview(content); break;
    case 'economy': renderEconomy(content); break;
    case 'resources': renderResources(content); break;
    case 'population': renderPopulation(content); break;
    case 'buildings': renderBuildings(content); break;
  }

  // Draw charts after DOM is in place
  requestAnimationFrame(() => drawAllCharts());
}

// ============================================================
// Overview Tab
// ============================================================

function renderOverview(el: HTMLElement): void {
  let game: Game;
  try { game = getGame(); } catch { el.innerHTML = ''; return; }

  const pid = game.getHumanPlayerId();
  const popMgr = game.getPopulationManager();
  const morMgr = game.getMoraleManager();
  const dt = game.getDashboardTracker();
  const eff = dt.getEfficiency();
  const effPct = eff.total > 0 ? Math.round((eff.producing / eff.total) * 100) : 0;

  const pop = popMgr.getCurrentPopulation(pid);
  const cap = popMgr.getCapacity(pid);
  const morale = Math.round(morMgr.getMorale(pid) * 100);
  const totalRes = getTotalResources(game);

  // Bottlenecks
  const tracker = game.getEconomyTracker();
  const bottlenecks = tracker.getBottlenecks();
  let bottleneckHtml = '';
  if (bottlenecks.length > 0) {
    const items = bottlenecks.slice(0, 5).map(r => {
      const net = tracker.getNetBalance(r);
      return `<span class="dashboard-bottleneck-item">${resourceIcon(r)} ${RESOURCE_PROPERTIES[r].label} <span style="color:#EF5350">${net.toFixed(1)}/m</span></span>`;
    }).join('');
    bottleneckHtml = `<div class="dashboard-section">
      <div class="dashboard-section-label">Bottlenecks</div>
      <div class="dashboard-bottleneck-list">${items}</div>
    </div>`;
  }

  // Top 8 most-active resources for dual bar
  const activeRes = tracker.getActiveResources();
  const sorted = activeRes
    .map(r => ({ r, activity: tracker.getProductionRate(r) + tracker.getConsumptionRate(r) }))
    .sort((a, b) => b.activity - a.activity)
    .slice(0, 8);

  el.innerHTML = `
    <div class="dashboard-kpi-row">
      <div class="dashboard-kpi-card">
        <div class="dashboard-kpi-value" data-field="kpi-pop">${pop}/${cap}</div>
        <div class="dashboard-kpi-label">Population</div>
      </div>
      <div class="dashboard-kpi-card">
        <div class="dashboard-kpi-value" data-field="kpi-res">${totalRes}</div>
        <div class="dashboard-kpi-label">Total Resources</div>
      </div>
      <div class="dashboard-kpi-card">
        <div class="dashboard-kpi-value" data-field="kpi-eff">${effPct}%</div>
        <div class="dashboard-kpi-label">Efficiency</div>
      </div>
      <div class="dashboard-kpi-card">
        <div class="dashboard-kpi-value" data-field="kpi-morale">${morale}%</div>
        <div class="dashboard-kpi-label">Morale</div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div>
        <div class="dashboard-section">
          <div class="dashboard-section-label">Production Balance</div>
          <div class="dashboard-chart-container">
            <canvas id="dc-overview-bars" style="width:100%;height:${sorted.length * 26 + 20}px"></canvas>
          </div>
        </div>
        ${bottleneckHtml}
      </div>
      <div>
        <div class="dashboard-section">
          <div class="dashboard-section-label">Population</div>
          <div class="dashboard-chart-container">
            <canvas id="dc-overview-pop" style="width:100%;height:120px"></canvas>
          </div>
        </div>
        <div class="dashboard-section">
          <div class="dashboard-section-label">Efficiency</div>
          <div class="dashboard-chart-container">
            <canvas id="dc-overview-donut" style="width:100%;height:140px"></canvas>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// Economy Tab
// ============================================================

function renderEconomy(el: HTMLElement): void {
  const tsButtons = (['5m', '15m', '30m', '1hr'] as const).map(ts =>
    `<button class="dashboard-timescale-btn${timeScale === ts ? ' dashboard-timescale-active' : ''}" data-ts="${ts}">${ts}</button>`
  ).join('');

  const filterButtons = (['all', 'raw', 'processed', 'food', 'military'] as const).map(f =>
    `<button class="dashboard-timescale-btn${resourceFilter === f ? ' dashboard-timescale-active' : ''}" data-rf="${f}">${f.charAt(0).toUpperCase() + f.slice(1)}</button>`
  ).join('');

  let game: Game;
  try { game = getGame(); } catch { el.innerHTML = ''; return; }

  const tracker = game.getEconomyTracker();
  const activeRes = tracker.getActiveResources().filter(r => matchesFilter(r));
  const sorted = activeRes
    .map(r => ({ r, activity: tracker.getProductionRate(r) + tracker.getConsumptionRate(r) }))
    .sort((a, b) => b.activity - a.activity);

  let tableHtml = '';
  for (const { r } of sorted) {
    const prod = tracker.getProductionRate(r);
    const cons = tracker.getConsumptionRate(r);
    const net = prod - cons;
    const netColor = net >= 0 ? '#4CAF50' : '#EF5350';
    const netSign = net >= 0 ? '+' : '';
    const selected = selectedEconResource === r ? ' dashboard-row-selected' : '';
    tableHtml += `<div class="dashboard-econ-row${selected}" data-eres="${r}">
      <span class="dashboard-econ-name">${resourceIcon(r)} ${RESOURCE_PROPERTIES[r].label}</span>
      <span style="color:#4CAF50">+${prod.toFixed(1)}</span>
      <span style="color:#EF5350">-${cons.toFixed(1)}</span>
      <span style="color:${netColor};font-weight:600">${netSign}${net.toFixed(1)}</span>
    </div>`;
  }

  el.innerHTML = `
    <div class="dashboard-controls-row">
      <div class="dashboard-timescale">${tsButtons}</div>
      <div class="dashboard-timescale">${filterButtons}</div>
    </div>
    <div class="dashboard-section">
      <div class="dashboard-section-label">Production vs Consumption</div>
      <div class="dashboard-chart-container">
        <canvas id="dc-econ-bars" style="width:100%;height:${sorted.length * 26 + 20}px"></canvas>
      </div>
    </div>
    ${selectedEconResource ? `<div class="dashboard-section">
      <div class="dashboard-section-label">${RESOURCE_PROPERTIES[selectedEconResource].label} Rate Over Time</div>
      <div class="dashboard-chart-container">
        <canvas id="dc-econ-rate" style="width:100%;height:160px"></canvas>
      </div>
    </div>` : ''}
    <div class="dashboard-section">
      <div class="dashboard-section-label">Rate Details</div>
      <div class="dashboard-econ-header">
        <span>Resource</span><span>Prod/m</span><span>Cons/m</span><span>Net/m</span>
      </div>
      ${tableHtml}
    </div>
  `;

  // Wire timescale + filter buttons
  el.querySelectorAll('[data-ts]').forEach(btn => {
    btn.addEventListener('click', () => {
      timeScale = (btn as HTMLElement).dataset.ts as typeof timeScale;
      renderContent();
    });
  });
  el.querySelectorAll('[data-rf]').forEach(btn => {
    btn.addEventListener('click', () => {
      resourceFilter = (btn as HTMLElement).dataset.rf as typeof resourceFilter;
      renderContent();
    });
  });
  el.querySelectorAll('[data-eres]').forEach(row => {
    row.addEventListener('click', () => {
      const res = (row as HTMLElement).dataset.eres as ResourceType;
      selectedEconResource = selectedEconResource === res ? null : res;
      renderContent();
    });
  });
}

// ============================================================
// Resources Tab
// ============================================================

function renderResources(el: HTMLElement): void {
  const tsButtons = (['5m', '15m', '30m', '1hr'] as const).map(ts =>
    `<button class="dashboard-timescale-btn${timeScale === ts ? ' dashboard-timescale-active' : ''}" data-ts="${ts}">${ts}</button>`
  ).join('');

  let game: Game;
  try { game = getGame(); } catch { el.innerHTML = ''; return; }

  const tracker = game.getEconomyTracker();
  const resources = getAllPlayerResources(game);

  // Sort by current stock descending
  const entries = Object.entries(resources)
    .filter(([, v]) => v && v > 0)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));

  let tableHtml = '';
  for (const [res, amount] of entries) {
    const r = res as ResourceType;
    const prod = tracker.getProductionRate(r);
    const cons = tracker.getConsumptionRate(r);
    const net = prod - cons;
    const trendIcon = net > 0.1 ? '<span class="trend-up">&#9650;</span>'
      : net < -0.1 ? '<span class="trend-down">&#9660;</span>'
      : '<span class="trend-flat">&#9654;</span>';
    tableHtml += `<div class="dashboard-econ-row">
      <span class="dashboard-econ-name">${resourceIcon(r)} ${RESOURCE_PROPERTIES[r].label}</span>
      <span style="font-weight:600">${amount}</span>
      <span>${trendIcon}</span>
      <span style="color:#4CAF50">${prod > 0 ? '+' + prod.toFixed(1) : '-'}</span>
      <span style="color:#EF5350">${cons > 0 ? '-' + cons.toFixed(1) : '-'}</span>
    </div>`;
  }

  el.innerHTML = `
    <div class="dashboard-controls-row">
      <div class="dashboard-timescale">${tsButtons}</div>
    </div>
    <div class="dashboard-section">
      <div class="dashboard-section-label">Stock Levels Over Time (Top 5)</div>
      <div class="dashboard-chart-container">
        <canvas id="dc-res-stocks" style="width:100%;height:180px"></canvas>
      </div>
      <div id="dc-res-legend" class="dashboard-legend"></div>
    </div>
    <div class="dashboard-section">
      <div class="dashboard-section-label">Inventory</div>
      <div class="dashboard-econ-header dashboard-res-header">
        <span>Resource</span><span>Stock</span><span>Trend</span><span>Prod/m</span><span>Cons/m</span>
      </div>
      ${tableHtml || '<div style="color:var(--color-on-surface-faint);padding:8px">No resources in storage</div>'}
    </div>
  `;

  el.querySelectorAll('[data-ts]').forEach(btn => {
    btn.addEventListener('click', () => {
      timeScale = (btn as HTMLElement).dataset.ts as typeof timeScale;
      renderContent();
    });
  });
}

// ============================================================
// Population Tab
// ============================================================

function renderPopulation(el: HTMLElement): void {
  let game: Game;
  try { game = getGame(); } catch { el.innerHTML = ''; return; }

  const pid = game.getHumanPlayerId();
  const gs = game.getGameState();
  const units = gs.getUnitsByPlayer(pid);
  const popMgr = game.getPopulationManager();

  // Hunger stats
  const avgSat = units.length > 0 ? units.reduce((s, u) => s + u.satiation, 0) / units.length : 1;
  const avgSatPct = Math.round(avgSat * 100);
  const hungryCount = units.filter(u => u.satiation < HUNGER_HUNGRY_THRESHOLD && u.satiation >= HUNGER_STARVING_THRESHOLD).length;
  const starvingCount = units.filter(u => u.satiation < HUNGER_STARVING_THRESHOLD).length;

  // Food supply
  const resources = getAllPlayerResources(game);
  let totalFood = 0;
  for (const [res, amount] of Object.entries(resources)) {
    if (amount && amount > 0 && isFood(res as ResourceType)) {
      totalFood += amount;
    }
  }

  // Unit breakdown
  const civilian: { type: string; label: string; count: number }[] = [];
  const military: { type: string; label: string; count: number }[] = [];
  const counts = new Map<string, number>();
  for (const u of units) counts.set(u.type, (counts.get(u.type) ?? 0) + 1);
  for (const [type, count] of counts) {
    const def = UNIT_DEFINITIONS[type as UnitType];
    const entry = { type, label: def?.label ?? type, count };
    if (def.category === 'military') military.push(entry);
    else civilian.push(entry);
  }
  civilian.sort((a, b) => b.count - a.count);
  military.sort((a, b) => b.count - a.count);

  let breakdownHtml = '';
  if (civilian.length > 0) {
    breakdownHtml += '<div class="dashboard-section-label" style="margin-top:8px">Civilian</div>';
    for (const u of civilian) {
      breakdownHtml += `<div class="dashboard-unit-row"><span>${u.label}</span><span>${u.count}</span></div>`;
    }
  }
  if (military.length > 0) {
    breakdownHtml += '<div class="dashboard-section-label" style="margin-top:8px">Military</div>';
    for (const u of military) {
      breakdownHtml += `<div class="dashboard-unit-row"><span>${u.label}</span><span>${u.count}</span></div>`;
    }
  }

  el.innerHTML = `
    <div class="dashboard-grid">
      <div>
        <div class="dashboard-section">
          <div class="dashboard-section-label">Population Over Time</div>
          <div class="dashboard-chart-container">
            <canvas id="dc-pop-chart" style="width:100%;height:160px"></canvas>
          </div>
        </div>
        <div class="dashboard-section">
          <div class="dashboard-section-label">Morale Over Time</div>
          <div class="dashboard-chart-container">
            <canvas id="dc-morale-chart" style="width:100%;height:120px"></canvas>
          </div>
        </div>
      </div>
      <div>
        <div class="dashboard-kpi-row" style="grid-template-columns:1fr 1fr">
          <div class="dashboard-kpi-card">
            <div class="dashboard-kpi-value">${popMgr.getCurrentPopulation(pid)}/${popMgr.getCapacity(pid)}</div>
            <div class="dashboard-kpi-label">Population</div>
          </div>
          <div class="dashboard-kpi-card">
            <div class="dashboard-kpi-value" style="color:${avgSatPct >= 60 ? '#4CAF50' : avgSatPct >= 30 ? '#FFB74D' : '#EF5350'}">${avgSatPct}%</div>
            <div class="dashboard-kpi-label">Avg Satiation</div>
          </div>
          <div class="dashboard-kpi-card">
            <div class="dashboard-kpi-value">${hungryCount}</div>
            <div class="dashboard-kpi-label" style="color:#FFB74D">Hungry</div>
          </div>
          <div class="dashboard-kpi-card">
            <div class="dashboard-kpi-value">${starvingCount}</div>
            <div class="dashboard-kpi-label" style="color:#EF5350">Starving</div>
          </div>
        </div>
        <div class="dashboard-kpi-row" style="grid-template-columns:1fr 1fr">
          <div class="dashboard-kpi-card">
            <div class="dashboard-kpi-value">${totalFood}</div>
            <div class="dashboard-kpi-label">Food Supply</div>
          </div>
          <div class="dashboard-kpi-card">
            <div class="dashboard-kpi-value">${Math.round(game.getMoraleManager().getMorale(pid) * 100)}%</div>
            <div class="dashboard-kpi-label">Morale</div>
          </div>
        </div>
        <div class="dashboard-section">
          <div class="dashboard-section-label">Unit Breakdown</div>
          ${breakdownHtml || '<div style="color:var(--color-on-surface-faint);padding:8px">No units</div>'}
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// Buildings Tab
// ============================================================

function renderBuildings(el: HTMLElement): void {
  let game: Game;
  try { game = getGame(); } catch { el.innerHTML = ''; return; }

  const pid = game.getHumanPlayerId();
  const gs = game.getGameState();
  const buildings = gs.getBuildingsByPlayer(pid);
  const eff = game.getDashboardTracker().getEfficiency();

  // Per-type breakdown
  const typeCounts = new Map<string, { count: number; active: number; constructing: number }>();
  for (const b of buildings) {
    const entry = typeCounts.get(b.type) ?? { count: 0, active: 0, constructing: 0 };
    entry.count++;
    if (b.state === BuildingState.Active) entry.active++;
    if (b.state === BuildingState.Planned || b.state === BuildingState.UnderConstruction) entry.constructing++;
    typeCounts.set(b.type, entry);
  }

  let tableHtml = '';
  for (const [type, info] of typeCounts) {
    const def = BUILDING_DEFINITIONS[type as BuildingType];
    tableHtml += `<div class="dashboard-unit-row">
      <span>${def?.label ?? type}</span>
      <span>${info.count}</span>
      <span>${info.active}</span>
      <span>${info.constructing > 0 ? info.constructing : '-'}</span>
    </div>`;
  }

  // Under construction
  const constructing = buildings.filter(b =>
    b.state === BuildingState.Planned || b.state === BuildingState.UnderConstruction
  );
  let constructionHtml = '';
  for (const b of constructing) {
    const def = BUILDING_DEFINITIONS[b.type];
    const pct = Math.round(b.constructionProgress * 100);
    constructionHtml += `<div class="dashboard-construction-row">
      <span>${def.label}</span>
      <div class="dashboard-progress-bar"><div class="dashboard-progress-fill" style="width:${pct}%"></div></div>
      <span>${pct}%</span>
    </div>`;
  }

  el.innerHTML = `
    <div class="dashboard-grid">
      <div>
        <div class="dashboard-section">
          <div class="dashboard-section-label">Efficiency</div>
          <div class="dashboard-chart-container" style="display:flex;justify-content:center">
            <canvas id="dc-bld-donut" style="width:200px;height:200px"></canvas>
          </div>
          <div class="dashboard-donut-legend">
            <span><span class="dashboard-dot" style="background:#4CAF50"></span> Producing (${eff.producing})</span>
            <span><span class="dashboard-dot" style="background:#FFB74D"></span> Waiting Input (${eff.waitingInput})</span>
            <span><span class="dashboard-dot" style="background:#EF5350"></span> Waiting Output (${eff.waitingOutput})</span>
            <span><span class="dashboard-dot" style="background:#90A4AE"></span> No Worker (${eff.noWorker})</span>
            <span><span class="dashboard-dot" style="background:#BDBDBD"></span> Paused (${eff.paused})</span>
          </div>
        </div>
      </div>
      <div>
        <div class="dashboard-section">
          <div class="dashboard-section-label">Building Status</div>
          <div class="dashboard-econ-header dashboard-bld-header">
            <span>Type</span><span>Total</span><span>Active</span><span>Building</span>
          </div>
          ${tableHtml}
        </div>
        ${constructing.length > 0 ? `<div class="dashboard-section">
          <div class="dashboard-section-label">Under Construction</div>
          ${constructionHtml}
        </div>` : ''}
      </div>
    </div>
  `;
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
    drawEconomyCharts(tracker, maxPts);
  } else if (activeTab === 'resources') {
    drawResourceCharts(game, dt, maxPts);
  } else if (activeTab === 'population') {
    drawPopulationCharts(dt);
  } else if (activeTab === 'buildings') {
    drawBuildingCharts(dt);
  }
}

function sliceHistory(data: number[], maxPts: number): number[] {
  if (data.length <= maxPts) return data;
  return data.slice(data.length - maxPts);
}

function drawOverviewCharts(dt: import('../game/DashboardTracker').DashboardTracker, tracker: import('../game/EconomyTracker').EconomyTracker): void {
  // Population line chart
  const popCanvas = document.getElementById('dc-overview-pop') as HTMLCanvasElement;
  if (popCanvas) {
    const popData = dt.getPopulationHistory();
    const capData = dt.getPopulationCapHistory();
    const labels = generateTimeLabels(popData.length);
    drawLineChart(popCanvas, [
      { data: popData, color: '#4CAF50', label: 'Population', fillAlpha: 0.1 },
      { data: capData, color: '#90A4AE', label: 'Capacity', dashed: true },
    ], { yMin: 0, xLabels: labels, gridLines: 3 });
  }

  // Efficiency donut
  const donutCanvas = document.getElementById('dc-overview-donut') as HTMLCanvasElement;
  if (donutCanvas) {
    const eff = dt.getEfficiency();
    const effPct = eff.total > 0 ? Math.round((eff.producing / eff.total) * 100) : 0;
    drawDonutChart(donutCanvas, [
      { value: eff.producing, color: '#4CAF50', label: 'Producing' },
      { value: eff.waitingInput, color: '#FFB74D', label: 'Waiting Input' },
      { value: eff.waitingOutput, color: '#EF5350', label: 'Waiting Output' },
      { value: eff.noWorker, color: '#90A4AE', label: 'No Worker' },
      { value: eff.paused, color: '#BDBDBD', label: 'Paused' },
    ], { centerText: `${effPct}%`, centerSubText: 'efficient' });
  }

  // Dual bar chart
  const barsCanvas = document.getElementById('dc-overview-bars') as HTMLCanvasElement;
  if (barsCanvas) {
    const activeRes = tracker.getActiveResources();
    const sorted = activeRes
      .map(r => ({ r, activity: tracker.getProductionRate(r) + tracker.getConsumptionRate(r) }))
      .sort((a, b) => b.activity - a.activity)
      .slice(0, 8);

    const items: DualBarItem[] = sorted.map(({ r }) => ({
      label: RESOURCE_PROPERTIES[r].label,
      production: tracker.getProductionRate(r),
      consumption: tracker.getConsumptionRate(r),
    }));
    drawDualBarChart(barsCanvas, items);
  }
}

function drawEconomyCharts(tracker: import('../game/EconomyTracker').EconomyTracker, maxPts: number): void {
  // Dual bar chart
  const barsCanvas = document.getElementById('dc-econ-bars') as HTMLCanvasElement;
  if (barsCanvas) {
    const activeRes = tracker.getActiveResources().filter(r => matchesFilter(r));
    const sorted = activeRes
      .map(r => ({ r, activity: tracker.getProductionRate(r) + tracker.getConsumptionRate(r) }))
      .sort((a, b) => b.activity - a.activity);

    const items: DualBarItem[] = sorted.map(({ r }) => ({
      label: RESOURCE_PROPERTIES[r].label,
      production: tracker.getProductionRate(r),
      consumption: tracker.getConsumptionRate(r),
    }));
    drawDualBarChart(barsCanvas, items);
  }

  // Rate over time for selected resource
  if (selectedEconResource) {
    const rateCanvas = document.getElementById('dc-econ-rate') as HTMLCanvasElement;
    if (rateCanvas) {
      const prodH = sliceHistory(tracker.getProductionHistory(selectedEconResource), maxPts);
      const consH = sliceHistory(tracker.getConsumptionHistory(selectedEconResource), maxPts);
      const labels = generateTimeLabels(Math.max(prodH.length, consH.length));
      const series: LineSeries[] = [
        { data: prodH, color: '#4CAF50', label: 'Production', fillAlpha: 0.08 },
        { data: consH, color: '#EF5350', label: 'Consumption', fillAlpha: 0.08 },
      ];
      drawLineChart(rateCanvas, series, { yMin: 0, xLabels: labels, gridLines: 3 });
    }
  }
}

function drawResourceCharts(game: Game, dt: import('../game/DashboardTracker').DashboardTracker, maxPts: number): void {
  const canvas = document.getElementById('dc-res-stocks') as HTMLCanvasElement;
  if (!canvas) return;

  // Top 5 by current stock
  const resources = getAllPlayerResources(game);
  const top5 = Object.entries(resources)
    .filter(([, v]) => v && v > 0)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .slice(0, 5)
    .map(([r]) => r as ResourceType);

  const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336'];
  const series: LineSeries[] = top5.map((r, i) => ({
    data: sliceHistory(dt.getStockHistory(r), maxPts),
    color: colors[i],
    label: RESOURCE_PROPERTIES[r].label,
  }));

  const maxLen = Math.max(...series.map(s => s.data.length), 2);
  const labels = generateTimeLabels(maxLen);
  drawLineChart(canvas, series, { yMin: 0, xLabels: labels, gridLines: 4 });

  // Legend
  const legendEl = document.getElementById('dc-res-legend');
  if (legendEl) {
    legendEl.innerHTML = top5.map((r, i) =>
      `<span class="dashboard-legend-item"><span class="dashboard-dot" style="background:${colors[i]}"></span>${RESOURCE_PROPERTIES[r].label}</span>`
    ).join('');
  }
}

function drawPopulationCharts(dt: import('../game/DashboardTracker').DashboardTracker): void {
  // Population chart
  const popCanvas = document.getElementById('dc-pop-chart') as HTMLCanvasElement;
  if (popCanvas) {
    const popData = dt.getPopulationHistory();
    const capData = dt.getPopulationCapHistory();
    const labels = generateTimeLabels(popData.length);
    drawLineChart(popCanvas, [
      { data: popData, color: '#4CAF50', label: 'Population', fillAlpha: 0.1 },
      { data: capData, color: '#90A4AE', label: 'Capacity', dashed: true },
    ], { yMin: 0, xLabels: labels, gridLines: 4 });
  }

  // Morale chart
  const moraleCanvas = document.getElementById('dc-morale-chart') as HTMLCanvasElement;
  if (moraleCanvas) {
    const moraleData = dt.getMoraleHistory();
    const labels = generateTimeLabels(moraleData.length);
    drawLineChart(moraleCanvas, [
      { data: moraleData, color: '#FF9800', label: 'Morale', fillAlpha: 0.1 },
    ], { yMin: 0, yMax: 1, xLabels: labels, gridLines: 4, yLabelFormat: v => `${Math.round(v * 100)}%` });
  }
}

function drawBuildingCharts(dt: import('../game/DashboardTracker').DashboardTracker): void {
  const donutCanvas = document.getElementById('dc-bld-donut') as HTMLCanvasElement;
  if (!donutCanvas) return;

  const eff = dt.getEfficiency();
  const effPct = eff.total > 0 ? Math.round((eff.producing / eff.total) * 100) : 0;
  drawDonutChart(donutCanvas, [
    { value: eff.producing, color: '#4CAF50', label: 'Producing' },
    { value: eff.waitingInput, color: '#FFB74D', label: 'Waiting Input' },
    { value: eff.waitingOutput, color: '#EF5350', label: 'Waiting Output' },
    { value: eff.noWorker, color: '#90A4AE', label: 'No Worker' },
    { value: eff.paused, color: '#BDBDBD', label: 'Paused' },
  ], { centerText: `${effPct}%`, centerSubText: 'efficient' });
}

function updateCharts(): void {
  if (overlay.classList.contains('hidden')) return;
  renderContent();
}

// ============================================================
// Helpers
// ============================================================

function getTotalResources(game: Game): number {
  let total = 0;
  const buildings = game.getGameState().getBuildingsByPlayer(game.getHumanPlayerId());
  for (const b of buildings) {
    for (const inv of [b.inputInventory, b.outputInventory]) {
      for (const amount of Object.values(inv)) {
        total += amount ?? 0;
      }
    }
  }
  return total;
}

function getAllPlayerResources(game: Game): Partial<Record<ResourceType, number>> {
  const totals: Partial<Record<ResourceType, number>> = {};
  const buildings = game.getGameState().getBuildingsByPlayer(game.getHumanPlayerId());
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

const RAW_RESOURCES: Set<ResourceType> = new Set([
  ResourceType.Wood, ResourceType.Stone, ResourceType.Grain, ResourceType.Fish,
  ResourceType.IronOre, ResourceType.CoalOre, ResourceType.GoldOre,
  ResourceType.Grapes, ResourceType.Fruit, ResourceType.WaterBarrel,
  ResourceType.Milk, ResourceType.Hay, ResourceType.Wool, ResourceType.RawLeather,
  ResourceType.Cattle, ResourceType.Horses,
]);

const MILITARY_RESOURCES: Set<ResourceType> = new Set([
  ResourceType.Swords, ResourceType.Shields, ResourceType.Arrows,
  ResourceType.Bow, ResourceType.SiegeRam, ResourceType.GoldBars,
]);

function matchesFilter(r: ResourceType): boolean {
  if (resourceFilter === 'all') return true;
  if (resourceFilter === 'raw') return RAW_RESOURCES.has(r);
  if (resourceFilter === 'food') return isFood(r);
  if (resourceFilter === 'military') return MILITARY_RESOURCES.has(r);
  if (resourceFilter === 'processed') return !RAW_RESOURCES.has(r);
  return true;
}
