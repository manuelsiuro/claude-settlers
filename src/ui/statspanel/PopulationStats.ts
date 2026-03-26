import type { Game } from '../../engine/Game';
import { BuildingState } from '../../game/Building';
import { BuildingType, BUILDING_DEFINITIONS } from '../../game/BuildingType';
import { RESOURCE_PROPERTIES, ResourceType, isFood } from '../../game/ResourceType';
import { UNIT_DEFINITIONS, UnitType } from '../../game/UnitType';
import { resourceIcon, unitIcon } from '../icons';
import type { PanelUpdater } from '../PanelUpdater';
import { getPopulationSeverity, getSatiationColor, HUNGER_HUNGRY_THRESHOLD, HUNGER_STARVING_THRESHOLD } from '../../game/data/balanceConstants';

/** Get unit counts by type for a player */
export function getPopulationBreakdown(game: Game): { type: string; label: string; count: number }[] {
  const gameState = game.getGameState();
  const units = gameState.getUnitsByPlayer(game.getHumanPlayerId());
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

/** Generate HTML for the population tab */
export function generatePopulationHTML(
  game: Game,
  resources: Partial<Record<ResourceType, number>>,
): string {
  const pid = game.getHumanPlayerId();
  const gameState = game.getGameState();
  const population = getPopulationBreakdown(game);
  const popMgr = game.getPopulationManager();
  const current = popMgr.getCurrentPopulation(pid);
  const capacity = popMgr.getCapacity(pid);
  const ratio = popMgr.getUsageRatio(pid);
  const severity = getPopulationSeverity(ratio);
  const barColor = severity === 'critical' ? '#EF5350' : severity === 'warning' ? '#FFB74D' : '#4CAF50';

  let html = '';

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
    const foodItems: { resource: ResourceType; amount: number }[] = [];
    let totalFood = 0;
    for (const [res, amount] of Object.entries(resources)) {
      if (amount && amount > 0 && isFood(res as ResourceType)) {
        foodItems.push({ resource: res as ResourceType, amount });
        totalFood += amount;
      }
    }
    foodItems.sort((a, b) => b.amount - a.amount);

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
        <span class="info-resource-name">${unitIcon(p.type, 16)} ${p.label}</span>
        <span class="info-resource-amount" data-field="pop-${p.type}">${p.count}</span>
      </div>`;
  }
  html += '</div>';

  return html;
}

/** Update population values without rebuilding DOM */
export function updatePopulationValues(
  game: Game,
  resources: Partial<Record<ResourceType, number>>,
  updater: PanelUpdater,
): void {
  const pid = game.getHumanPlayerId();
  const gameState = game.getGameState();
  const popMgr = game.getPopulationManager();
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
  const population = getPopulationBreakdown(game);
  for (const p of population) {
    updater.setText(`pop-${p.type}`, `${p.count}`);
  }
}

/** Get the structure key part for the population tab */
export function getPopulationStructureKey(
  game: Game,
  resources: Partial<Record<ResourceType, number>>,
): string {
  const pid = game.getHumanPlayerId();
  const gameState = game.getGameState();
  const parts: string[] = [];

  const population = getPopulationBreakdown(game);
  parts.push('u:' + population.map((p) => p.type).join(','));
  const housingTypes = gameState.getBuildingsByPlayer(pid)
    .filter(b => b.state === BuildingState.Active && BUILDING_DEFINITIONS[b.type].populationCapacity > 0)
    .map(b => b.type).sort();
  parts.push('h:' + housingTypes.join(','));
  parts.push('idle:' + gameState.getIdleUnitsAtCastle(pid).length);

  // Food supply: track which food types are present + hungry/starving presence
  const foodKeys = Object.entries(resources)
    .filter(([res, amt]) => amt && amt > 0 && isFood(res as ResourceType))
    .map(([res]) => res).sort().join(',');
  parts.push('fk:' + foodKeys);
  const units = gameState.getUnitsByPlayer(pid);
  const hasHungry = units.some(u => u.satiation < HUNGER_HUNGRY_THRESHOLD && u.satiation >= HUNGER_STARVING_THRESHOLD);
  const hasStarving = units.some(u => u.satiation < HUNGER_STARVING_THRESHOLD);
  parts.push('fh:' + (hasHungry ? '1' : '0') + (hasStarving ? '1' : '0'));

  return parts.join('|');
}
