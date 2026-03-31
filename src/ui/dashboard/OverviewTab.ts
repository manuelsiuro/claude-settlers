import type { Game } from '../../engine/Game';
import { RESOURCE_PROPERTIES } from '../../game/ResourceType';
import { resourceIcon } from '../icons';
import { drawLineChart, drawDualBarChart, drawDonutChart, generateTimeLabels } from '../ChartRenderer';
import type { DualBarItem } from '../ChartRenderer';
import { getTotalResources } from './dashboardHelpers';

// ============================================================
// Render
// ============================================================

export function renderOverview(el: HTMLElement, getGame: () => Game): void {
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
      return `<span class="dashboard-bottleneck-item">${resourceIcon(r)} ${RESOURCE_PROPERTIES[r].label} <span class="text-critical">${net.toFixed(1)}/m</span></span>`;
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
// Charts
// ============================================================

export function drawOverviewCharts(dt: import('../../game/DashboardTracker').DashboardTracker, tracker: import('../../game/EconomyTracker').EconomyTracker): void {
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
