import type { Game } from '../../engine/Game';
import { ResourceType } from '../../game/ResourceType';
import { UNIT_DEFINITIONS, UnitType } from '../../game/UnitType';
import { unitIcon } from '../icons';
import type { PanelUpdater } from '../PanelUpdater';

/** Generate HTML for the military tab */
export function generateMilitaryHTML(
  game: Game,
  resources: Partial<Record<ResourceType, number>>,
): string {
  const pid = game.getHumanPlayerId();
  const gameState = game.getGameState();
  const allMilitary = gameState.getUnitsByPlayer(pid).filter(u => {
    const d = UNIT_DEFINITIONS[u.type];
    return d.category === 'military';
  });
  const goldBars = resources[ResourceType.GoldBars] ?? 0;

  let html = '<div class="info-section">';
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
        <span class="info-resource-name">${unitIcon(type, 16)} ${label}</span>
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
  const morale = game.getMoraleManager().getMorale(pid);
  const moralePct = Math.round(morale * 100);
  const moraleColor = morale >= 0.7 ? '#4CAF50' : morale >= 0.4 ? '#FFB74D' : '#EF5350';
  const prodMult = game.getMoraleManager().getProductionMultiplier(pid);
  const combatMult = game.getMoraleManager().getCombatMultiplier(pid);
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

  return html;
}

/** Update military values without rebuilding DOM */
export function updateMilitaryValues(
  game: Game,
  resources: Partial<Record<ResourceType, number>>,
  updater: PanelUpdater,
): void {
  const pid = game.getHumanPlayerId();
  const gameState = game.getGameState();
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
  const morale = game.getMoraleManager().getMorale(pid);
  const moralePct = Math.round(morale * 100);
  updater.setText('mil-morale', `${moralePct}%`);
  updater.setWidth('mil-morale-bar', `${moralePct}%`);
  const prodMult = game.getMoraleManager().getProductionMultiplier(pid);
  const combatMult = game.getMoraleManager().getCombatMultiplier(pid);
  updater.setText('mil-morale-prod', `${prodMult >= 1 ? '+' : ''}${Math.round((prodMult - 1) * 100)}%`);
  updater.setText('mil-morale-combat', `${combatMult >= 1 ? '+' : ''}${Math.round((combatMult - 1) * 100)}%`);
  const drinkResources = [ResourceType.Wine, ResourceType.Beer];
  let totalDrinks = 0;
  for (const r of drinkResources) {
    totalDrinks += resources[r] ?? 0;
  }
  updater.setText('mil-drinks', `${totalDrinks}`);
}

/** Get the structure key part for the military tab */
export function getMilitaryStructureKey(game: Game): string {
  const pid = game.getHumanPlayerId();
  const hasKnights = game.getGameState().getUnitsByPlayer(pid).some((u) => u.type === UnitType.Knight);
  return 'k:' + (hasKnights ? '1' : '0');
}

/** Get military unit count for badge display */
export function getMilitaryCount(game: Game): number {
  const pid = game.getHumanPlayerId();
  return game.getGameState().getUnitsByPlayer(pid).filter(u => {
    const d = UNIT_DEFINITIONS[u.type];
    return d.category === 'military';
  }).length;
}
