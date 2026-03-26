import type { Game } from '../../engine/Game';
import { ResourceType, isFood } from '../../game/ResourceType';
import { UNIT_DEFINITIONS, UnitType } from '../../game/UnitType';
import { unitIcon } from '../icons';
import { drawLineChart, generateTimeLabels } from '../ChartRenderer';
import { HUNGER_HUNGRY_THRESHOLD, HUNGER_STARVING_THRESHOLD } from '../../game/data/balanceConstants';
import { getAllPlayerResources } from './dashboardHelpers';

// ============================================================
// Render
// ============================================================

export function renderPopulation(el: HTMLElement, getGame: () => Game): void {
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
      breakdownHtml += `<div class="dashboard-unit-row"><span>${unitIcon(u.type, 16)} ${u.label}</span><span>${u.count}</span></div>`;
    }
  }
  if (military.length > 0) {
    breakdownHtml += '<div class="dashboard-section-label" style="margin-top:8px">Military</div>';
    for (const u of military) {
      breakdownHtml += `<div class="dashboard-unit-row"><span>${unitIcon(u.type, 16)} ${u.label}</span><span>${u.count}</span></div>`;
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
// Charts
// ============================================================

export function drawPopulationCharts(dt: import('../../game/DashboardTracker').DashboardTracker): void {
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
