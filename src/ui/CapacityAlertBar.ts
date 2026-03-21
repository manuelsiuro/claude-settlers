import type { Game } from '../engine/Game';
import {
  BuildingState,
  hasOutputSpace,
  hasInputSpace,
  getInventoryTotal,
} from '../game/Building';
import type { Building } from '../game/Building';
import { BUILDING_DEFINITIONS, BuildingType } from '../game/BuildingType';
import { getEffectiveStorageCapacity } from '../game/BuildingUpgrade';
import { HexGrid } from '../game/HexGrid';
import { buildingIcon } from './icons';

type Severity = 'output_full' | 'input_full' | 'near_full';

interface CapacityAlertGroup {
  buildingType: string;
  severity: Severity;
  buildingIds: string[];
}

let container: HTMLElement | null = null;
let getGame: (() => Game) | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;
const cycleIndices = new Map<string, number>();

export function initCapacityAlertBar(gameGetter: () => Game): void {
  getGame = gameGetter;
  container = document.getElementById('capacity-alert-bar');
  if (!container) return;
  cycleIndices.clear();
  pollInterval = setInterval(updateAlerts, 2000);
}

export function disposeCapacityAlertBar(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  if (container) {
    container.innerHTML = '';
  }
  getGame = null;
  cycleIndices.clear();
}

const SEVERITY_ORDER: Severity[] = ['output_full', 'input_full', 'near_full'];
const SEVERITY_LABEL: Record<Severity, string> = {
  output_full: 'Output Full',
  input_full: 'Input Full',
  near_full: 'Near Full',
};

const STORAGE_TYPES = new Set<string>([BuildingType.Castle, BuildingType.Warehouse]);

function classifySeverity(b: Building): Severity | null {
  const cap = getEffectiveStorageCapacity(b);
  if (cap === 0) return null;

  // Check output full (skip Castle/Warehouse — their purpose is storage)
  if (!STORAGE_TYPES.has(b.type) && !hasOutputSpace(b)) return 'output_full';

  // Check input full
  if (!hasInputSpace(b)) return 'input_full';

  // Check near full (combined fill > 85%)
  const total = getInventoryTotal(b.inputInventory) + getInventoryTotal(b.outputInventory);
  if (total / cap > 0.85) return 'near_full';

  return null;
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

  // Group by (buildingType, severity)
  const groups = new Map<string, CapacityAlertGroup>();
  for (const b of buildings) {
    if (b.state !== BuildingState.Active) continue;
    if (b.productionPaused) continue;

    const severity = classifySeverity(b);
    if (!severity) continue;

    const key = `${b.type}|${severity}`;
    let group = groups.get(key);
    if (!group) {
      group = { buildingType: b.type, severity, buildingIds: [] };
      groups.set(key, group);
    }
    group.buildingIds.push(b.id);
  }

  if (groups.size === 0) {
    container.innerHTML = '';
    return;
  }

  // Sort by severity (most critical first), then by count (descending)
  const sorted = [...groups.values()].sort((a, b) => {
    const sa = SEVERITY_ORDER.indexOf(a.severity);
    const sb = SEVERITY_ORDER.indexOf(b.severity);
    if (sa !== sb) return sa - sb;
    return b.buildingIds.length - a.buildingIds.length;
  });

  const isMobile = window.innerWidth <= 768;
  const maxVisible = isMobile ? 2 : 6;
  const visible = sorted.slice(0, maxVisible);
  const overflow = sorted.length - maxVisible;

  let html = '';
  for (const group of visible) {
    const def = BUILDING_DEFINITIONS[group.buildingType as keyof typeof BUILDING_DEFINITIONS];
    const label = def?.label ?? group.buildingType;
    const count = group.buildingIds.length;
    const isCritical = group.severity === 'output_full';
    const dotClass = isCritical ? 'capacity-alert-status-critical' : 'capacity-alert-status-warning';

    html += `<div class="capacity-alert-chip capacity-alert-${group.severity}" data-group="${group.buildingType}|${group.severity}" data-buildings="${group.buildingIds.join(',')}">
      ${buildingIcon(group.buildingType, 16)}
      <span class="capacity-alert-text">${count > 1 ? `${count}× ` : ''}${label} — ${SEVERITY_LABEL[group.severity]}</span>
      <span class="${dotClass}"></span>
    </div>`;
  }

  if (overflow > 0) {
    html += `<div class="capacity-alert-chip capacity-alert-overflow">+${overflow} more</div>`;
  }

  container.innerHTML = html;

  // Click handler — cycle through buildings in group
  container.onclick = (e) => {
    const chip = (e.target as HTMLElement).closest('.capacity-alert-chip') as HTMLElement | null;
    if (!chip || chip.classList.contains('capacity-alert-overflow')) return;

    const buildingIdsStr = chip.dataset.buildings;
    const groupKey = chip.dataset.group;
    if (!buildingIdsStr || !groupKey) return;

    const ids = buildingIdsStr.split(',');
    const idx = (cycleIndices.get(groupKey) ?? -1) + 1;
    const nextIdx = idx % ids.length;
    cycleIndices.set(groupKey, nextIdx);

    const building = gameState.getBuilding(ids[nextIdx]);
    if (building) {
      const { x, z } = HexGrid.hexToWorld(building.coord.q, building.coord.r);
      game.getCameraController()?.panTo(x, z);
    }
  };
}
