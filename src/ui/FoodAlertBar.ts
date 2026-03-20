import type { Game } from '../engine/Game';
import { BuildingType } from '../game/BuildingType';
import { BuildingState } from '../game/Building';
import { RESOURCE_PROPERTIES } from '../game/ResourceType';
import type { ResourceType } from '../game/ResourceType';
import { HUNGER_HUNGRY_THRESHOLD, HUNGER_STARVING_THRESHOLD } from '../game/data/balanceConstants';
import { icon } from './icons';

let container: HTMLElement | null = null;
let getGame: (() => Game) | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let onClickHandler: (() => void) | null = null;

export function initFoodAlertBar(gameGetter: () => Game, openPopulationTab: () => void): void {
  getGame = gameGetter;
  onClickHandler = openPopulationTab;
  container = document.getElementById('food-alert-bar');
  if (!container) return;

  // Poll every 2 seconds (same as ToolAlertBar)
  pollInterval = setInterval(updateAlerts, 2000);
}

export function disposeFoodAlertBar(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  if (container) {
    container.innerHTML = '';
  }
  getGame = null;
  onClickHandler = null;
}

function updateAlerts(): void {
  if (!container || !getGame) return;

  let game: Game;
  try {
    game = getGame();
  } catch {
    return;
  }

  const gameState = game.getGameState();
  const humanId = game.getHumanPlayerId();
  const allUnits = gameState.getUnitsByPlayer(humanId);

  if (allUnits.length === 0) {
    container.innerHTML = '';
    return;
  }

  const hungryCount = allUnits.filter(u => u.satiation < HUNGER_HUNGRY_THRESHOLD).length;
  const starvingCount = allUnits.filter(u => u.satiation < HUNGER_STARVING_THRESHOLD).length;

  if (hungryCount === 0) {
    container.innerHTML = '';
    return;
  }

  // Check total food in storage
  const storageBuildings = gameState.getBuildingsByPlayer(humanId)
    .filter(b => b.state === BuildingState.Active && (
      b.type === BuildingType.Castle || b.type === BuildingType.Warehouse
    ));

  let totalFood = 0;
  for (const b of storageBuildings) {
    for (const [res, amount] of Object.entries(b.outputInventory)) {
      if (amount && amount > 0 && RESOURCE_PROPERTIES[res as ResourceType].satiationValue > 0) {
        totalFood += amount;
      }
    }
  }

  // Build chip parts
  const parts: string[] = [];
  if (starvingCount > 0) {
    parts.push(`${starvingCount} starving`);
  }
  if (hungryCount - starvingCount > 0) {
    parts.push(`${hungryCount - starvingCount} hungry`);
  }
  if (totalFood === 0) {
    parts.push('No food in storage');
  }

  const isCritical = starvingCount > 0 || totalFood === 0;
  const chipClass = isCritical ? 'food-alert-critical' : 'food-alert-warning';

  container.innerHTML = `<div class="capacity-alert-chip ${chipClass}">
    ${icon('warning', 'capacity-alert-icon')}
    <span class="capacity-alert-text">${parts.join(' · ')}</span>
  </div>`;

  container.onclick = () => {
    onClickHandler?.();
  };
}
