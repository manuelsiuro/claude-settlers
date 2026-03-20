import type { Game } from '../engine/Game';
import { audioManager } from '../engine/AudioManager';
import { icon, resourceIcon } from './icons';
import { BuildingType, BUILDING_DEFINITIONS } from '../game/BuildingType';
import { BuildingState } from '../game/Building';
import { RESOURCE_PROPERTIES, ResourceType, TOOL_TYPES, isFood } from '../game/ResourceType';
import { UNIT_DEFINITIONS, UnitType } from '../game/UnitType';
import { renderEconomySection, drawEconomySparklines } from './EconomyPanel';
import { getPopulationSeverity, getSatiationColor, HUNGER_HUNGRY_THRESHOLD, HUNGER_STARVING_THRESHOLD } from '../game/data/balanceConstants';
import { renderPriorityHTML, attachPriorityListeners } from './ResourcePriorityPanel';
import { showTechTreePanel } from './TechTreePanel';
import { showDashboard } from './DashboardPanel';
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
    military: gameState.getUnitsByPlayer(pid).filter(u => {
      const d = UNIT_DEFINITIONS[u.type];
      return d.category === 'military';
    }).length,
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
    const housingTypes = gameState.getBuildingsByPlayer(pid)
      .filter(b => b.state === BuildingState.Active && BUILDING_DEFINITIONS[b.type].populationCapacity > 0)
      .map(b => b.type).sort();
    parts.push('h:' + housingTypes.join(','));
    parts.push('idle:' + gameState.getIdleUnitsAtCastle(pid).length);
    // Food supply: track which food types are present + hungry/starving presence
    const allRes = getAllPlayerResources();
    const foodKeys = Object.entries(allRes)
      .filter(([res, amt]) => amt && amt > 0 && isFood(res as ResourceType))
      .map(([res]) => res).sort().join(',');
    parts.push('fk:' + foodKeys);
    const units = gameState.getUnitsByPlayer(pid);
    const hasHungry = units.some(u => u.satiation < HUNGER_HUNGRY_THRESHOLD && u.satiation >= HUNGER_STARVING_THRESHOLD);
    const hasStarving = units.some(u => u.satiation < HUNGER_STARVING_THRESHOLD);
    parts.push('fh:' + (hasHungry ? '1' : '0') + (hasStarving ? '1' : '0'));
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
  ResourceType.Grapes, ResourceType.Fruit, ResourceType.WaterBarrel,
  ResourceType.Milk, ResourceType.Hay, ResourceType.Wool, ResourceType.RawLeather,
  ResourceType.Cattle, ResourceType.Horses,
];
const PROCESSED_RESOURCES = [
  ResourceType.Planks, ResourceType.Flour, ResourceType.Bread,
  ResourceType.Meat, ResourceType.IronBars, ResourceType.GoldBars,
  ResourceType.Swords, ResourceType.Shields,
  ResourceType.Wine, ResourceType.Beer, ResourceType.Cheese,
  ResourceType.Cloth, ResourceType.WorkedLeather,
  ResourceType.Arrows, ResourceType.Bow, ResourceType.SiegeRam,
  ...TOOL_TYPES,
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
    const popMgr = getGame().getPopulationManager();
    const current = popMgr.getCurrentPopulation(pid);
    const capacity = popMgr.getCapacity(pid);
    const ratio = popMgr.getUsageRatio(pid);
    const severity = getPopulationSeverity(ratio);
    const barColor = severity === 'critical' ? '#EF5350' : severity === 'warning' ? '#FFB74D' : '#4CAF50';

    // Capacity Overview
    html += '<div class="info-section"><div class="info-section-label">Population Capacity</div>';
    html += `<div class="stat-highlight">
      <span class="info-label">Population</span>
      <span class="stat-highlight-value" data-field="pop-total" style="color:${barColor}">${current}/${capacity}</span>
    </div>`;
    html += `<div style="background:var(--color-progress-bg);border-radius:4px;height:8px;margin:4px 0 8px">
      <div data-field="pop-bar" style="width:${Math.min(ratio * 100, 100)}%;height:100%;border-radius:4px;background:${barColor};transition:width 0.3s"></div>
    </div>`;

    // Housing breakdown
    const housingTypes = gameState.getBuildingsByPlayer(pid)
      .filter(b => b.state === BuildingState.Active && BUILDING_DEFINITIONS[b.type].populationCapacity > 0);
    const housingCounts = new Map<string, { count: number; cap: number }>();
    for (const b of housingTypes) {
      const def = BUILDING_DEFINITIONS[b.type];
      const entry = housingCounts.get(b.type) ?? { count: 0, cap: 0 };
      entry.count++;
      entry.cap += def.populationCapacity;
      housingCounts.set(b.type, entry);
    }
    for (const [type, { count, cap }] of housingCounts) {
      const label = BUILDING_DEFINITIONS[type as BuildingType].label;
      html += `<div class="info-resource-row">
        <span class="info-resource-name">${count}× ${label}</span>
        <span class="info-resource-amount">+${cap}</span>
      </div>`;
    }
    html += '</div>';

    // Average Food
    const allUnits = gameState.getUnitsByPlayer(pid);
    if (allUnits.length > 0) {
      const avgSat = allUnits.reduce((sum, u) => sum + u.satiation, 0) / allUnits.length;
      const avgSatPct = Math.round(avgSat * 100);
      const satColor = getSatiationColor(avgSat);
      html += `<div class="info-row" style="margin-top:4px">
        <span class="info-label">Avg Food</span>
        <span class="info-value" data-field="pop-avg-sat" style="color:${satColor}">${avgSatPct}%</span>
      </div>
      <div style="background:var(--color-progress-bg);border-radius:4px;height:6px;margin:2px 0 8px">
        <div data-field="pop-avg-sat-bar" style="width:${avgSatPct}%;height:100%;border-radius:4px;background:${satColor};transition:width 0.3s"></div>
      </div>`;
    }

    // Food Supply section
    if (allUnits.length > 0) {
      const resources = getAllPlayerResources();
      // Count food in storage
      const foodItems: { resource: ResourceType; amount: number }[] = [];
      let totalFood = 0;
      for (const [res, amount] of Object.entries(resources)) {
        if (amount && amount > 0 && isFood(res as ResourceType)) {
          foodItems.push({ resource: res as ResourceType, amount });
          totalFood += amount;
        }
      }
      foodItems.sort((a, b) => b.amount - a.amount);

      // Count hungry/starving units
      const hungryCount = allUnits.filter(u => u.satiation < HUNGER_HUNGRY_THRESHOLD && u.satiation >= HUNGER_STARVING_THRESHOLD).length;
      const starvingCount = allUnits.filter(u => u.satiation < HUNGER_STARVING_THRESHOLD).length;

      html += '<div class="info-section"><div class="info-section-label">Food Supply</div>';
      const totalFoodColor = totalFood > 0 ? '#4CAF50' : '#EF5350';
      html += `<div class="info-resource-row">
        <span class="info-resource-name">In Storage</span>
        <span class="info-resource-amount" data-field="pop-food-total" style="color:${totalFoodColor}">${totalFood}</span>
      </div>`;
      for (const item of foodItems) {
        const props = RESOURCE_PROPERTIES[item.resource];
        html += `<div class="info-resource-row" style="padding-left:12px">
          <span class="info-resource-name">${resourceIcon(item.resource)} ${props.label}</span>
          <span class="info-resource-amount" data-field="pop-food-${item.resource}">${item.amount}</span>
        </div>`;
      }
      if (hungryCount > 0) {
        html += `<div class="info-resource-row">
          <span class="info-resource-name" style="color:#FFB74D">Hungry Units</span>
          <span class="info-resource-amount" data-field="pop-hungry-count" style="color:#FFB74D">${hungryCount}</span>
        </div>`;
      }
      if (starvingCount > 0) {
        html += `<div class="info-resource-row">
          <span class="info-resource-name" style="color:#EF5350">Starving Units</span>
          <span class="info-resource-amount" data-field="pop-starving-count" style="color:#EF5350">${starvingCount}</span>
        </div>`;
      }
      html += '</div>';
    }

    // Unit Roster
    html += '<div class="info-section"><div class="info-section-label">Unit Roster</div>';
    const idleCount = gameState.getIdleUnitsAtCastle(pid).length;
    if (idleCount > 0) {
      html += `<div class="info-resource-row">
        <span class="info-resource-name" style="color:var(--color-on-surface-faint)">Idle at Castle</span>
        <span class="info-resource-amount" data-field="pop-idle">${idleCount}</span>
      </div>`;
    }
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
    const allMilitary = gameState.getUnitsByPlayer(pid).filter(u => {
      const d = UNIT_DEFINITIONS[u.type];
      return d.category === 'military';
    });
    const goldBars = resources[ResourceType.GoldBars] ?? 0;
    html += '<div class="info-section">';
    html += `<div class="stat-highlight">
      <span class="info-label">Military Units</span>
      <span class="stat-highlight-value" data-field="mil-knights">${allMilitary.length}</span>
    </div>`;
    // Breakdown by type
    const typeCounts = new Map<string, number>();
    for (const u of allMilitary) {
      typeCounts.set(u.type, (typeCounts.get(u.type) ?? 0) + 1);
    }
    for (const [type, count] of typeCounts) {
      const label = UNIT_DEFINITIONS[type as UnitType]?.label ?? type;
      html += `<div class="info-resource-row">
        <span class="info-resource-name">${label}</span>
        <span class="info-resource-amount" data-field="mil-type-${type}">${count}</span>
      </div>`;
    }
    html += `<div class="info-row">
      <span class="info-label">Gold Bars</span>
      <span class="info-value" data-field="mil-gold">${goldBars}</span>
    </div>`;
    if (allMilitary.length > 0) {
      const avgRank = allMilitary.reduce((sum, k) => sum + k.knightRank, 0) / allMilitary.length;
      html += `<div class="info-row">
        <span class="info-label">Avg Rank</span>
        <span class="info-value" data-field="mil-avg-rank">${avgRank.toFixed(1)}</span>
      </div>`;
    }
    html += '</div>';
    // Morale section
    const morale = getGame().getMoraleManager().getMorale(pid);
    const moralePct = Math.round(morale * 100);
    const moraleColor = morale >= 0.7 ? '#4CAF50' : morale >= 0.4 ? '#FFB74D' : '#EF5350';
    const prodMult = getGame().getMoraleManager().getProductionMultiplier(pid);
    const combatMult = getGame().getMoraleManager().getCombatMultiplier(pid);
    html += '<div class="info-section"><div class="info-section-label">Morale</div>';
    html += `<div class="stat-highlight">
      <span class="info-label">Morale</span>
      <span class="stat-highlight-value" data-field="mil-morale" style="color:${moraleColor}">${moralePct}%</span>
    </div>`;
    html += `<div style="background:var(--color-progress-bg);border-radius:4px;height:8px;margin:4px 0 8px">
      <div data-field="mil-morale-bar" style="width:${moralePct}%;height:100%;border-radius:4px;background:${moraleColor};transition:width 0.3s"></div>
    </div>`;
    html += `<div class="info-row">
      <span class="info-label">Production Bonus</span>
      <span class="info-value" data-field="mil-morale-prod">${prodMult >= 1 ? '+' : ''}${Math.round((prodMult - 1) * 100)}%</span>
    </div>`;
    html += `<div class="info-row">
      <span class="info-label">Combat Bonus</span>
      <span class="info-value" data-field="mil-morale-combat">${combatMult >= 1 ? '+' : ''}${Math.round((combatMult - 1) * 100)}%</span>
    </div>`;
    // Drink supply count
    const drinkResources = [ResourceType.Wine, ResourceType.Beer];
    let totalDrinks = 0;
    for (const r of drinkResources) {
      totalDrinks += resources[r] ?? 0;
    }
    html += `<div class="info-row">
      <span class="info-label">Drink Supply</span>
      <span class="info-value" data-field="mil-drinks">${totalDrinks}</span>
    </div>`;
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
    const popMgr = getGame().getPopulationManager();
    const current = popMgr.getCurrentPopulation(pid);
    const capacity = popMgr.getCapacity(pid);
    const ratio = capacity > 0 ? current / capacity : 1;
    updater.setText('pop-total', `${current}/${capacity}`);
    updater.setWidth('pop-bar', `${Math.min(ratio * 100, 100)}%`);
    // Average food + dynamic colors
    const allUnits = gameState.getUnitsByPlayer(pid);
    if (allUnits.length > 0) {
      const avgSat = allUnits.reduce((sum, u) => sum + u.satiation, 0) / allUnits.length;
      const avgSatPct = Math.round(avgSat * 100);
      const satColor = getSatiationColor(avgSat);
      updater.setText('pop-avg-sat', `${avgSatPct}%`);
      updater.setWidth('pop-avg-sat-bar', `${avgSatPct}%`);
      updater.setColor('pop-avg-sat', satColor);
      updater.setBackground('pop-avg-sat-bar', satColor);

      // Food supply values
      const resources = getAllPlayerResources();
      let totalFood = 0;
      for (const [res, amount] of Object.entries(resources)) {
        if (amount && amount > 0 && isFood(res as ResourceType)) {
          totalFood += amount;
          updater.setText(`pop-food-${res}`, `${amount}`);
        }
      }
      updater.setText('pop-food-total', `${totalFood}`);
      updater.setColor('pop-food-total', totalFood > 0 ? '#4CAF50' : '#EF5350');

      const hungryCount = allUnits.filter(u => u.satiation < HUNGER_HUNGRY_THRESHOLD && u.satiation >= HUNGER_STARVING_THRESHOLD).length;
      const starvingCount = allUnits.filter(u => u.satiation < HUNGER_STARVING_THRESHOLD).length;
      if (hungryCount > 0) updater.setText('pop-hungry-count', `${hungryCount}`);
      if (starvingCount > 0) updater.setText('pop-starving-count', `${starvingCount}`);
    }
    const idleCount = gameState.getIdleUnitsAtCastle(pid).length;
    updater.setText('pop-idle', `${idleCount}`);
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
    const allMilitary = gameState.getUnitsByPlayer(pid).filter((u) => {
      const d = UNIT_DEFINITIONS[u.type];
      return d.category === 'military';
    });
    const goldBars = resources[ResourceType.GoldBars] ?? 0;
    updater.setText('mil-knights', `${allMilitary.length}`);
    updater.setText('mil-gold', `${goldBars}`);
    if (allMilitary.length > 0) {
      const avgRank = allMilitary.reduce((sum, k) => sum + k.knightRank, 0) / allMilitary.length;
      updater.setText('mil-avg-rank', avgRank.toFixed(1));
    }
    const typeCounts = new Map<string, number>();
    for (const u of allMilitary) {
      typeCounts.set(u.type, (typeCounts.get(u.type) ?? 0) + 1);
    }
    for (const [type, count] of typeCounts) {
      updater.setText(`mil-type-${type}`, `${count}`);
    }
    // Morale updates
    const morale = getGame().getMoraleManager().getMorale(pid);
    const moralePct = Math.round(morale * 100);
    updater.setText('mil-morale', `${moralePct}%`);
    updater.setWidth('mil-morale-bar', `${moralePct}%`);
    const prodMult = getGame().getMoraleManager().getProductionMultiplier(pid);
    const combatMult = getGame().getMoraleManager().getCombatMultiplier(pid);
    updater.setText('mil-morale-prod', `${prodMult >= 1 ? '+' : ''}${Math.round((prodMult - 1) * 100)}%`);
    updater.setText('mil-morale-combat', `${combatMult >= 1 ? '+' : ''}${Math.round((combatMult - 1) * 100)}%`);
    const drinkResources = [ResourceType.Wine, ResourceType.Beer];
    let totalDrinks = 0;
    for (const r of drinkResources) {
      totalDrinks += resources[r] ?? 0;
    }
    updater.setText('mil-drinks', `${totalDrinks}`);
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
