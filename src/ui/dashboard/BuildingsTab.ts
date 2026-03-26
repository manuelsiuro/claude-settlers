import type { Game } from '../../engine/Game';
import { BuildingState } from '../../game/Building';
import { BUILDING_DEFINITIONS } from '../../game/BuildingType';
import type { BuildingType } from '../../game/BuildingType';
import { buildingIcon } from '../icons';
import { drawDonutChart } from '../ChartRenderer';

// ============================================================
// Render
// ============================================================

export function renderBuildings(el: HTMLElement, getGame: () => Game): void {
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
      <span>${buildingIcon(type, 16)} ${def?.label ?? type}</span>
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
      <span>${buildingIcon(b.type, 16)} ${def.label}</span>
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
// Charts
// ============================================================

export function drawBuildingCharts(dt: import('../../game/DashboardTracker').DashboardTracker): void {
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
