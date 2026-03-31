import type { Game } from '../../engine/Game';
import { RESOURCE_PROPERTIES, ResourceType } from '../../game/ResourceType';
import { resourceIcon } from '../icons';
import { drawDualBarChart, drawLineChart, generateTimeLabels } from '../ChartRenderer';
import type { LineSeries, DualBarItem } from '../ChartRenderer';
import { matchesFilter, sliceHistory } from './dashboardHelpers';
import type { ResourceFilter } from './dashboardHelpers';

export type TimeScale = '5m' | '15m' | '30m' | '1hr';

// ============================================================
// Render
// ============================================================

export function renderEconomy(
  el: HTMLElement,
  getGame: () => Game,
  timeScale: TimeScale,
  resourceFilter: ResourceFilter,
  selectedEconResource: ResourceType | null,
  callbacks: {
    onTimeScaleChange: (ts: TimeScale) => void;
    onFilterChange: (f: ResourceFilter) => void;
    onResourceSelect: (r: ResourceType | null) => void;
  },
): void {
  const tsButtons = (['5m', '15m', '30m', '1hr'] as const).map(ts =>
    `<button class="dashboard-timescale-btn${timeScale === ts ? ' dashboard-timescale-active' : ''}" data-ts="${ts}">${ts}</button>`
  ).join('');

  const filterButtons = (['all', 'raw', 'processed', 'food', 'military'] as const).map(f =>
    `<button class="dashboard-timescale-btn${resourceFilter === f ? ' dashboard-timescale-active' : ''}" data-rf="${f}">${f.charAt(0).toUpperCase() + f.slice(1)}</button>`
  ).join('');

  let game: Game;
  try { game = getGame(); } catch { el.innerHTML = ''; return; }

  const tracker = game.getEconomyTracker();
  const activeRes = tracker.getActiveResources().filter(r => matchesFilter(r, resourceFilter));
  const sorted = activeRes
    .map(r => ({ r, activity: tracker.getProductionRate(r) + tracker.getConsumptionRate(r) }))
    .sort((a, b) => b.activity - a.activity);

  let tableHtml = '';
  for (const { r } of sorted) {
    const prod = tracker.getProductionRate(r);
    const cons = tracker.getConsumptionRate(r);
    const net = prod - cons;
    const netSign = net >= 0 ? '+' : '';
    const selected = selectedEconResource === r ? ' dashboard-row-selected' : '';
    tableHtml += `<div class="dashboard-econ-row${selected}" data-eres="${r}">
      <span class="dashboard-econ-name">${resourceIcon(r)} ${RESOURCE_PROPERTIES[r].label}</span>
      <span class="text-positive">+${prod.toFixed(1)}</span>
      <span class="text-critical">-${cons.toFixed(1)}</span>
      <span class="${net >= 0 ? 'text-positive' : 'text-critical'}" style="font-weight:600">${netSign}${net.toFixed(1)}</span>
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
      callbacks.onTimeScaleChange((btn as HTMLElement).dataset.ts as TimeScale);
    });
  });
  el.querySelectorAll('[data-rf]').forEach(btn => {
    btn.addEventListener('click', () => {
      callbacks.onFilterChange((btn as HTMLElement).dataset.rf as ResourceFilter);
    });
  });
  el.querySelectorAll('[data-eres]').forEach(row => {
    row.addEventListener('click', () => {
      const res = (row as HTMLElement).dataset.eres as ResourceType;
      callbacks.onResourceSelect(selectedEconResource === res ? null : res);
    });
  });
}

// ============================================================
// Charts
// ============================================================

export function drawEconomyCharts(
  tracker: import('../../game/EconomyTracker').EconomyTracker,
  maxPts: number,
  resourceFilter: ResourceFilter,
  selectedEconResource: ResourceType | null,
): void {
  // Dual bar chart
  const barsCanvas = document.getElementById('dc-econ-bars') as HTMLCanvasElement;
  if (barsCanvas) {
    const activeRes = tracker.getActiveResources().filter(r => matchesFilter(r, resourceFilter));
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
