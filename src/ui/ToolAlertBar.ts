import type { Game } from '../engine/Game';
import { RESOURCE_PROPERTIES } from '../game/ResourceType';
import type { ResourceType } from '../game/ResourceType';
import { HexGrid } from '../game/HexGrid';
import { resourceIcon } from './icons';

let container: HTMLElement | null = null;
let getGame: (() => Game) | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;

interface ToolAlertGroup {
  toolType: ResourceType;
  buildingIds: string[];
  status: 'producing' | 'queued' | 'not_queued';
}

export function initToolAlertBar(gameGetter: () => Game): void {
  getGame = gameGetter;
  container = document.getElementById('tool-alert-bar');
  if (!container) return;

  // Poll every 2 seconds
  pollInterval = setInterval(updateAlerts, 2000);
}

export function disposeToolAlertBar(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  if (container) {
    container.innerHTML = '';
  }
  getGame = null;
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
  const buildings = gameState.getBuildingsByPlayer(humanId);

  // Group buildings waiting for tools by tool type
  const groups = new Map<ResourceType, string[]>();
  for (const b of buildings) {
    if (!b.waitingForTool) continue;
    const list = groups.get(b.waitingForTool) ?? [];
    list.push(b.id);
    groups.set(b.waitingForTool, list);
  }

  if (groups.size === 0) {
    container.innerHTML = '';
    return;
  }

  // Determine production status for each tool type
  const alertGroups: ToolAlertGroup[] = [];
  for (const [toolType, buildingIds] of groups) {
    let status: 'producing' | 'queued' | 'not_queued' = 'not_queued';

    // Check all player's Toolmaker buildings
    for (const b of buildings) {
      if (b.toolQueue === undefined) continue;
      if (b.currentToolProduction === toolType) {
        status = 'producing';
        break;
      }
      const entry = b.toolQueue.find(e => e.toolType === toolType);
      if (entry && entry.count > 0 && status === 'not_queued') {
        status = 'queued';
      }
    }

    alertGroups.push({ toolType, buildingIds, status });
  }

  // Render chips (max 4 visible on mobile)
  const isMobile = window.innerWidth <= 768;
  const maxVisible = isMobile ? 2 : 6;
  const visible = alertGroups.slice(0, maxVisible);
  const overflow = alertGroups.length - maxVisible;

  let html = '';
  for (const group of visible) {
    const label = RESOURCE_PROPERTIES[group.toolType].label;
    const count = group.buildingIds.length;
    const statusDot = group.status === 'producing'
      ? '<span class="tool-alert-status-producing"></span>'
      : group.status === 'queued'
        ? '<span class="tool-alert-status-queued"></span>'
        : '<span class="tool-alert-status-idle"></span>';

    html += `<div class="tool-alert-chip" data-tool="${group.toolType}" data-buildings="${group.buildingIds.join(',')}">
      ${resourceIcon(group.toolType, 14)}
      <span class="tool-alert-text">${count > 1 ? `${count}× ` : ''}${label}</span>
      ${statusDot}
    </div>`;
  }

  if (overflow > 0) {
    html += `<div class="tool-alert-chip tool-alert-overflow">+${overflow} more</div>`;
  }

  container.innerHTML = html;

  // Attach click handlers via event delegation
  container.onclick = (e) => {
    const chip = (e.target as HTMLElement).closest('.tool-alert-chip') as HTMLElement | null;
    if (!chip || chip.classList.contains('tool-alert-overflow')) return;

    const buildingIdsStr = chip.dataset.buildings;
    if (!buildingIdsStr) return;

    const ids = buildingIdsStr.split(',');
    const building = gameState.getBuilding(ids[0]);
    if (building) {
      const { x, z } = HexGrid.hexToWorld(building.coord.q, building.coord.r);
      game.getCameraController()?.panTo(x, z);
    }
  };
}
