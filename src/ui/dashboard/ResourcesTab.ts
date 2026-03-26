import type { Game } from '../../engine/Game';
import { RESOURCE_PROPERTIES, ResourceType } from '../../game/ResourceType';
import { resourceIcon } from '../icons';
import { drawLineChart, generateTimeLabels } from '../ChartRenderer';
import type { LineSeries } from '../ChartRenderer';
import { getAllPlayerResources, sliceHistory } from './dashboardHelpers';
import type { TimeScale } from './EconomyTab';

// ============================================================
// Render
// ============================================================

export function renderResources(
  el: HTMLElement,
  getGame: () => Game,
  timeScale: TimeScale,
  onTimeScaleChange: (ts: TimeScale) => void,
): void {
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
      onTimeScaleChange((btn as HTMLElement).dataset.ts as TimeScale);
    });
  });
}

// ============================================================
// Charts
// ============================================================

export function drawResourceCharts(
  game: Game,
  dt: import('../../game/DashboardTracker').DashboardTracker,
  maxPts: number,
): void {
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
