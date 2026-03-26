import type { Game } from '../../engine/Game';
import { BuildingState } from '../../game/Building';
import { BuildingType, BUILDING_DEFINITIONS } from '../../game/BuildingType';
import { buildingIcon } from '../icons';
import type { PanelUpdater } from '../PanelUpdater';

/** Generate HTML for the buildings tab */
export function generateBuildingsHTML(game: Game): string {
  const pid = game.getHumanPlayerId();
  const gameState = game.getGameState();
  const buildings = gameState.getBuildingsByPlayer(pid);
  const buildingCounts = new Map<string, number>();
  let activeBuildings = 0;
  let constructing = 0;
  for (const b of buildings) {
    buildingCounts.set(b.type, (buildingCounts.get(b.type) ?? 0) + 1);
    if (b.state === BuildingState.Active) activeBuildings++;
    if (b.state === BuildingState.Planned || b.state === BuildingState.UnderConstruction) constructing++;
  }

  let html = '<div class="info-section">';
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
        <span class="info-resource-name">${buildingIcon(type, 16)} ${def?.label ?? type}</span>
        <span class="info-resource-amount" data-field="bld-${type}">${count}</span>
      </div>`;
  }
  html += '</div>';

  return html;
}

/** Update building values without rebuilding DOM */
export function updateBuildingValues(game: Game, updater: PanelUpdater): void {
  const pid = game.getHumanPlayerId();
  const gameState = game.getGameState();
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
}

/** Get the structure key part for the buildings tab */
export function getBuildingsStructureKey(game: Game): string {
  const pid = game.getHumanPlayerId();
  const gameState = game.getGameState();
  const buildings = gameState.getBuildingsByPlayer(pid);
  const buildingTypes = [...new Set(buildings.map((b) => b.type))].sort();
  const constructing = buildings.some((b) => b.state === BuildingState.Planned || b.state === BuildingState.UnderConstruction);
  return 'b:' + buildingTypes.join(',') + '|bc:' + (constructing ? '1' : '0');
}

/** Get active building count for badge display */
export function getActiveBuildingCount(game: Game): number {
  const pid = game.getHumanPlayerId();
  return game.getGameState().getBuildingsByPlayer(pid)
    .filter(b => b.state === BuildingState.Active).length;
}
