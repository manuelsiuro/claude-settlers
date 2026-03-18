import type { Game } from '../engine/Game';
import { icon, resourceIcon } from './icons';
import { BuildingType, BUILDING_DEFINITIONS } from '../game/BuildingType';
import { BuildingState } from '../game/Building';
import { RESOURCE_PROPERTIES, ResourceType } from '../game/ResourceType';
import { UNIT_DEFINITIONS, UnitType } from '../game/UnitType';
import { renderEconomySection, drawEconomySparklines } from './EconomyPanel';
import { renderPriorityPanel } from './ResourcePriorityPanel';
import { PanelUpdater } from './PanelUpdater';

let statsPanel: HTMLElement;
let statsPanelContent: HTMLElement;
let priorityPanel: HTMLElement;
let priorityPanelContent: HTMLElement;
let statsPanelUpdateInterval: ReturnType<typeof setInterval> | null = null;
let updater: PanelUpdater;

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
  updater = new PanelUpdater(statsPanelContent);
  const statsCloseBtn = document.getElementById('stats-close-btn')!;

  priorityPanel = document.getElementById('priority-panel')!;
  priorityPanelContent = document.getElementById('priority-panel-content')!;
  const priorityCloseBtn = document.getElementById('priority-close-btn')!;

  statsCloseBtn.addEventListener('click', closeStatsPanel);
  priorityCloseBtn.addEventListener('click', closePriorityPanel);
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
  const parts: string[] = [];
  const pid = getGame().getHumanPlayerId();
  const gameState = getGame().getGameState();

  // Population unit types present
  const population = getPopulationBreakdown();
  parts.push('u:' + population.map((p) => p.type).join(','));

  // Building types present + constructing flag
  const buildings = gameState.getBuildingsByPlayer(pid);
  const buildingTypes = [...new Set(buildings.map((b) => b.type))].sort();
  const constructing = buildings.some((b) => b.state === BuildingState.Planned || b.state === BuildingState.UnderConstruction);
  parts.push('b:' + buildingTypes.join(','));
  parts.push('bc:' + (constructing ? '1' : '0'));

  // Knights presence (affects avg rank row)
  const hasKnights = gameState.getUnitsByPlayer(pid).some((u) => u.type === UnitType.Knight);
  parts.push('k:' + (hasKnights ? '1' : '0'));

  // Economy active resources + per-resource prod/cons flags
  const tracker = getGame().getEconomyTracker();
  const activeResources = tracker.getActiveResources();
  const econFlags = activeResources.map((r) => {
    const p = tracker.getProductionRate(r) > 0 ? 'p' : '';
    const c = tracker.getConsumptionRate(r) > 0 ? 'c' : '';
    return `${r}:${p}${c}`;
  }).join(',');
  parts.push('e:' + econFlags);

  // Bottleneck presence
  parts.push('bn:' + (tracker.getBottlenecks().length > 0 ? '1' : '0'));

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

/** Generate the stats panel HTML string */
function generateStatsHTML(): string {
  const resources = getAllPlayerResources();
  const population = getPopulationBreakdown();
  const pid = getGame().getHumanPlayerId();
  const gameState = getGame().getGameState();
  const buildings = gameState.getBuildingsByPlayer(pid);
  const totalUnits = gameState.getUnitsByPlayer(pid).length;

  let html = '';

  // Resources section
  html += `<div class="info-section"><div class="info-section-label">${icon('warehouse')} Resources</div>`;

  html += '<div class="info-subsection-label">Raw Materials</div>';
  for (const r of RAW_RESOURCES) {
    const amount = resources[r] ?? 0;
    const zeroClass = amount === 0 ? ' resource-pill-zero' : '';
    html += `<div class="info-resource-row">
      <span class="info-resource-name">${resourceIcon(r)} ${RESOURCE_PROPERTIES[r].label}</span>
      <span data-field="res-${r}" class="resource-pill${zeroClass}">${amount}</span>
    </div>`;
  }

  html += '<div class="info-subsection-label">Processed Goods</div>';
  for (const r of PROCESSED_RESOURCES) {
    const amount = resources[r] ?? 0;
    const zeroClass = amount === 0 ? ' resource-pill-zero' : '';
    html += `<div class="info-resource-row">
      <span class="info-resource-name">${resourceIcon(r)} ${RESOURCE_PROPERTIES[r].label}</span>
      <span data-field="res-${r}" class="resource-pill${zeroClass}">${amount}</span>
    </div>`;
  }
  html += '</div>';

  // Population section
  html += `<div class="info-section"><div class="info-section-label">${icon('people')} Population</div>`;
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

  // Buildings section
  const buildingCounts = new Map<string, number>();
  let activeBuildings = 0;
  let constructing = 0;
  for (const b of buildings) {
    buildingCounts.set(b.type, (buildingCounts.get(b.type) ?? 0) + 1);
    if (b.state === BuildingState.Active) activeBuildings++;
    if (b.state === BuildingState.Planned || b.state === BuildingState.UnderConstruction) constructing++;
  }
  html += `<div class="info-section"><div class="info-section-label">${icon('hammer')} Buildings</div>`;
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

  // Military section
  const knights = gameState.getUnitsByPlayer(pid).filter(u => u.type === UnitType.Knight);
  const goldBars = resources[ResourceType.GoldBars] ?? 0;
  html += `<div class="info-section"><div class="info-section-label">${icon('shield_icon')} Military</div>`;
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

  // Economy section
  const tracker = getGame().getEconomyTracker();
  html += renderEconomySection(tracker);

  return html;
}

/** Update dynamic values without rebuilding DOM */
function updateStatsValues(): void {
  const resources = getAllPlayerResources();
  const pid = getGame().getHumanPlayerId();
  const gameState = getGame().getGameState();

  // Resource amounts
  for (const r of ALL_RESOURCES) {
    const amount = resources[r] ?? 0;
    updater.setText(`res-${r}`, `${amount}`);
    updater.setClass(`res-${r}`, `resource-pill${amount === 0 ? ' resource-pill-zero' : ''}`);
  }

  // Population
  const totalUnits = gameState.getUnitsByPlayer(pid).length;
  updater.setText('pop-total', `${totalUnits}`);
  const population = getPopulationBreakdown();
  for (const p of population) {
    updater.setText(`pop-${p.type}`, `${p.count}`);
  }

  // Buildings
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

  // Military
  const knights = gameState.getUnitsByPlayer(pid).filter((u) => u.type === UnitType.Knight);
  const goldBars = resources[ResourceType.GoldBars] ?? 0;
  updater.setText('mil-knights', `${knights.length}`);
  updater.setText('mil-gold', `${goldBars}`);
  if (knights.length > 0) {
    const avgRank = knights.reduce((sum, k) => sum + k.knightRank, 0) / knights.length;
    updater.setText('mil-avg-rank', avgRank.toFixed(1));
  }

  // Economy rates
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

export function showStatsPanel(): void {
  updater.reset();
  updater.update(
    getStatsStructureKey(),
    () => generateStatsHTML(),
    () => updateStatsValues(),
    () => drawEconomySparklines(statsPanelContent, getGame().getEconomyTracker()),
  );
  statsPanel.classList.remove('hidden');
  closeBuildPanelFn();
  closeInfoPanelFn();
  closePriorityPanel();

  // Live updates
  stopStatsPanelUpdates();
  statsPanelUpdateInterval = setInterval(() => {
    updater.update(
      getStatsStructureKey(),
      () => generateStatsHTML(),
      () => updateStatsValues(),
      () => drawEconomySparklines(statsPanelContent, getGame().getEconomyTracker()),
    );
  }, 1000);
}

export function closeStatsPanel(): void {
  statsPanel.classList.add('hidden');
  stopStatsPanelUpdates();
  updater.reset();
}

export function stopStatsPanelUpdates(): void {
  if (statsPanelUpdateInterval !== null) {
    clearInterval(statsPanelUpdateInterval);
    statsPanelUpdateInterval = null;
  }
}

export function showPriorityPanel(game: Game | undefined): void {
  if (!game) return;
  priorityPanel.classList.remove('hidden');
  closeBuildPanelFn();
  closeInfoPanelFn();
  closeStatsPanel();
  renderPriorityPanel(priorityPanelContent, getGame());
}

export function closePriorityPanel(): void {
  priorityPanel.classList.add('hidden');
}

/** Hide the stats panel element */
export function hideStatsPanelElement(): void {
  statsPanel.classList.add('hidden');
}
