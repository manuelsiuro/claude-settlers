import type { Game } from '../engine/Game';
import { icon, resourceIcon } from './icons';
import { BuildingType, BUILDING_DEFINITIONS } from '../game/BuildingType';
import { BuildingState, getInventoryAmount, getInventoryTotal } from '../game/Building';
import type { Building, ResourceInventory } from '../game/Building';
import { RESOURCE_PROPERTIES, ResourceType } from '../game/ResourceType';
import { getDistanceMultiplier, getDistanceRating } from '../game/ProductionManager';
import {
  BUILDING_UPGRADES,
  UpgradeAxis,
  getUpgradeCost,
  getEffectiveStorageCapacity,
  getProductionSpeedMultiplier,
  getMaxWorkers,
  canUpgrade,
} from '../game/BuildingUpgrade';
import { startAttackTargeting, isAttackModeActive } from './BuildPanel';
import { showDemolishConfirm } from './DemolishDialog';

let infoPanel: HTMLElement;
let infoPanelTitle: HTMLElement;
let infoPanelContent: HTMLElement;
let infoPanelUpdateInterval: ReturnType<typeof setInterval> | null = null;

let getGame: () => Game;
let closeBuildPanelFn: () => void;
let closeStatsPanelFn: () => void;
let closePriorityPanelFn: () => void;

export function initInfoPanel(
  getGameFn: () => Game,
  closeBuildPanel: () => void,
  closeStatsPanel: () => void,
  closePriorityPanel: () => void,
): void {
  getGame = getGameFn;
  closeBuildPanelFn = closeBuildPanel;
  closeStatsPanelFn = closeStatsPanel;
  closePriorityPanelFn = closePriorityPanel;

  infoPanel = document.getElementById('info-panel')!;
  infoPanelTitle = document.getElementById('info-panel-title')!;
  infoPanelContent = document.getElementById('info-panel-content')!;
  const infoCloseBtn = document.getElementById('info-close-btn')!;

  infoCloseBtn.addEventListener('click', closeInfoPanel);

  // Event delegation for info panel buttons
  infoPanelContent.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('.info-attack-btn') as HTMLElement | null;
    if (target?.dataset.buildingId) {
      startAttackTargeting(target.dataset.buildingId);
    }

    const upgradeBtn = (e.target as HTMLElement).closest('.info-upgrade-btn') as HTMLElement | null;
    if (upgradeBtn?.dataset.buildingId && upgradeBtn?.dataset.axis) {
      const ok = getGame().getUpgradeManager().startUpgrade(
        upgradeBtn.dataset.buildingId,
        upgradeBtn.dataset.axis as UpgradeAxis,
      );
      if (ok) {
        const building = getGame().getGameState().getBuilding(upgradeBtn.dataset.buildingId);
        if (building) renderInfoPanel(building);
      }
    }

    const cancelBtn = (e.target as HTMLElement).closest('.info-upgrade-cancel-btn') as HTMLElement | null;
    if (cancelBtn?.dataset.buildingId) {
      const cancelled = getGame().getUpgradeManager().cancelUpgrade(cancelBtn.dataset.buildingId);
      if (cancelled) {
        const building = getGame().getGameState().getBuilding(cancelBtn.dataset.buildingId);
        if (building) renderInfoPanel(building);
      }
    }

    const demolishBtn = (e.target as HTMLElement).closest('.info-demolish-btn') as HTMLElement | null;
    if (demolishBtn?.dataset.buildingId) {
      const building = getGame().getGameState().getBuilding(demolishBtn.dataset.buildingId);
      if (building) showDemolishConfirm(building);
    }
  });
}

/** Format an inventory as HTML list */
function formatInventory(inventory: ResourceInventory): string {
  const entries = Object.entries(inventory).filter(
    ([, amount]) => amount !== undefined && amount > 0,
  );
  if (entries.length === 0) return '<span class="info-empty">Empty</span>';
  return entries
    .map(([resource, amount]) => {
      const props = RESOURCE_PROPERTIES[resource as ResourceType];
      return `<div class="info-resource-row">
        <span class="info-resource-name">${resourceIcon(resource)} ${props?.label ?? resource}</span>
        <span class="info-resource-amount">${amount}</span>
      </div>`;
    })
    .join('');
}

/** Get state label and color class */
function getStateDisplay(state: BuildingState): { label: string; cssClass: string } {
  switch (state) {
    case BuildingState.Planned:
      return { label: 'Planned', cssClass: 'state-planned' };
    case BuildingState.UnderConstruction:
      return { label: 'Under Construction', cssClass: 'state-construction' };
    case BuildingState.Active:
      return { label: 'Active', cssClass: 'state-active' };
    case BuildingState.Destroyed:
      return { label: 'Destroyed', cssClass: 'state-destroyed' };
    default:
      return { label: String(state), cssClass: '' };
  }
}

/** Build the info panel HTML for a building */
function renderInfoPanel(building: Building): void {
  const def = BUILDING_DEFINITIONS[building.type];
  const stateDisplay = getStateDisplay(building.state);

  let html = '';

  // Status
  html += `<div class="info-section">
    <div class="info-row">
      <span class="info-label">Status</span>
      <span class="info-value ${stateDisplay.cssClass}">${stateDisplay.label}</span>
    </div>`;

  // Construction progress
  if (
    building.state === BuildingState.Planned ||
    building.state === BuildingState.UnderConstruction
  ) {
    const pct = Math.round(building.constructionProgress * 100);
    html += `<div class="info-row">
      <span class="info-label">Construction</span>
      <span class="info-value">${pct}%</span>
    </div>
    <div class="info-progress-bar">
      <div class="info-progress-fill" style="width:${pct}%"></div>
    </div>`;

    // Remaining construction resources
    const remaining = def.cost
      .map((c) => {
        const delivered = building.constructionDelivered[c.resource] ?? 0;
        return { resource: c.resource, delivered, needed: c.amount };
      })
      .filter((r) => r.delivered < r.needed);

    if (remaining.length > 0) {
      html += `<div class="info-subsection-label">Resources Needed</div>`;
      for (const r of remaining) {
        const props = RESOURCE_PROPERTIES[r.resource];
        html += `<div class="info-resource-row">
          <span class="info-resource-name">${resourceIcon(r.resource)} ${props.label}</span>
          <span class="info-resource-amount">${r.delivered} / ${r.needed}</span>
        </div>`;
      }
    }
  }
  html += '</div>';

  // Worker info
  if (def.worker) {
    const gameState = getGame().getGameState();
    const primaryWorker = gameState.getWorkerForBuilding(building.id);
    const maxW = getMaxWorkers(building);
    const assignedCount = (primaryWorker ? 1 : 0) + (building.extraWorkerIds ?? []).filter((id) => gameState.getUnit(id)).length;
    const sectionLabel = maxW > 1 ? 'Workers' : 'Worker';
    html += `<div class="info-section">
      <div class="info-section-label">${icon('people')} ${sectionLabel}</div>
      <div class="info-row">
        <span class="info-label">${def.worker}</span>
        <span class="info-value ${assignedCount >= maxW ? 'state-active' : 'state-planned'}">${assignedCount}/${maxW}</span>
      </div>`;
    if (def.workerTool) {
      const toolProps = RESOURCE_PROPERTIES[def.workerTool];
      html += `<div class="info-row">
        <span class="info-label">Requires</span>
        <span class="info-value">${toolProps.label}</span>
      </div>`;
    }
    html += '</div>';
  }

  // Production info
  if (def.production && building.state === BuildingState.Active) {
    html += `<div class="info-section">
      <div class="info-section-label">${icon('hammer')} Production</div>`;

    // Inputs
    if (def.production.inputs.length > 0) {
      html += '<div class="info-subsection-label">Inputs</div>';
      for (const input of def.production.inputs) {
        const props = RESOURCE_PROPERTIES[input.resource];
        html += `<div class="info-resource-row">
          <span class="info-resource-name">${resourceIcon(input.resource)} ${props.label}</span>
          <span class="info-resource-amount">${input.amount}/cycle</span>
        </div>`;
      }
    }

    // Outputs
    html += '<div class="info-subsection-label">Outputs</div>';
    for (const output of def.production.outputs) {
      const props = RESOURCE_PROPERTIES[output.resource];
      html += `<div class="info-resource-row">
        <span class="info-resource-name">${resourceIcon(output.resource)} ${props.label}</span>
        <span class="info-resource-amount">${output.amount}/cycle</span>
      </div>`;
    }

    // Distance and efficiency info for gathering buildings
    const multiplier = def.harvestTerrain ? getDistanceMultiplier(building.resourceDistance) : 1;
    const speedMult = getProductionSpeedMultiplier(building);
    const effectiveTime = def.production.productionTime * multiplier * speedMult;
    const rating = def.harvestTerrain ? getDistanceRating(multiplier) : null;
    const progressColor = rating
      ? (multiplier <= 1.5 ? 'info-progress-perfect' : multiplier <= 2.0 ? 'info-progress-medium' : 'info-progress-poor')
      : 'info-progress-production';

    // Production progress
    if (building.hasWorker && building.productionProgress > 0) {
      const pct = Math.round(building.productionProgress * 100);
      html += `<div class="info-row" style="margin-top:8px">
        <span class="info-label">Progress</span>
        <span class="info-value">${pct}%</span>
      </div>
      <div class="info-progress-bar">
        <div class="info-progress-fill ${progressColor}" style="width:${pct}%"></div>
      </div>`;
    }

    html += `<div class="info-row">
      <span class="info-label">Cycle Time</span>
      <span class="info-value"${rating ? ` style="color:${rating.color}"` : ''}>${effectiveTime.toFixed(1)}s</span>
    </div>`;
    if (rating) {
      const efficiency = Math.round((1 / multiplier) * 100);
      html += `<div class="info-row">
        <span class="info-label">Efficiency</span>
        <span class="info-value" style="color:${rating.color}">${efficiency}%</span>
      </div>
      <div class="info-row">
        <span class="info-label">Resource Distance</span>
        <span class="info-value" style="color:${rating.color}">${building.resourceDistance} tile${building.resourceDistance !== 1 ? 's' : ''}</span>
      </div>`;
    }
    html += '</div>';
  }

  // Geologist info
  if (building.type === BuildingType.GeologistHut && building.state === BuildingState.Active) {
    const geoMgr = getGame().getGeologistManager();
    const ws = geoMgr.getWorkState(building.id);
    const phaseLabels: Record<string, string> = {
      idle_at_hut: 'Idle',
      walking_to_prospect: 'Walking to site',
      prospecting: 'Prospecting',
      walking_to_hut: 'Returning',
    };
    const phaseLabel = ws ? phaseLabels[ws.phase] ?? ws.phase : 'Idle';
    const prospectedCount = ws ? ws.prospectedCount : 0;

    html += `<div class="info-section">
      <div class="info-section-label">${icon('hammer')} Prospecting</div>
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value">${phaseLabel}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Tiles prospected</span>
        <span class="info-value">${prospectedCount}</span>
      </div>`;

    if (ws && ws.phase === 'prospecting') {
      const pct = Math.min(Math.round(ws.prospectProgress * 100), 100);
      html += `<div class="info-row">
        <span class="info-label">Progress</span>
        <span class="info-value">
          <div style="display:inline-block;width:60px;height:8px;background:#444;border-radius:4px;vertical-align:middle;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:#4caf50;border-radius:4px"></div>
          </div> ${pct}%
        </span>
      </div>`;
    }

    html += '</div>';
  }

  // Knight slots (military buildings)
  if (def.knightSlots > 0) {
    html += `<div class="info-section">
      <div class="info-section-label">${icon('shield_icon')} Knights</div>
      <div class="info-row">
        <span class="info-label">Stationed</span>
        <span class="info-value">${building.knightIds.length} / ${def.knightSlots}</span>
      </div>`;

    if (building.knightIds.length > 0) {
      const gameState = getGame().getGameState();
      for (const knightId of building.knightIds) {
        const knight = gameState.getUnit(knightId);
        if (knight) {
          html += `<div class="info-resource-row">
            <span class="info-resource-name">Knight</span>
            <span class="info-resource-amount">Rank ${knight.knightRank}</span>
          </div>`;
        }
      }
      // Attack button
      html += `<button class="info-attack-btn" data-building-id="${building.id}">
        Attack Enemy Building
      </button>`;
    }
    html += '</div>';
  }

  // Inventory (input + output)
  const hasInputs =
    Object.values(building.inputInventory).some((v) => v !== undefined && v > 0);
  const hasOutputs =
    Object.values(building.outputInventory).some((v) => v !== undefined && v > 0);

  if (hasInputs || hasOutputs) {
    html += '<div class="info-section">';
    html += `<div class="info-section-label">${icon('warehouse')} Inventory</div>`;
    if (hasInputs) {
      html += '<div class="info-subsection-label">Input</div>';
      html += formatInventory(building.inputInventory);
    }
    if (hasOutputs) {
      html += '<div class="info-subsection-label">Output</div>';
      html += formatInventory(building.outputInventory);
    }
    const effectiveCap = getEffectiveStorageCapacity(building);
    const isStorage = building.type === BuildingType.Castle || building.type === BuildingType.Warehouse;
    const totalUsed = isStorage
      ? getInventoryTotal(building.inputInventory) + getInventoryTotal(building.outputInventory)
      : getInventoryTotal(building.outputInventory);
    const pct = effectiveCap > 0 ? Math.min(100, Math.round((totalUsed / effectiveCap) * 100)) : 0;
    const barClass = pct > 85 ? 'capacity-bar-red' : pct > 60 ? 'capacity-bar-amber' : 'capacity-bar-green';
    html += `<div class="capacity-bar-wrapper">
      <div class="capacity-bar-label">
        <span class="info-label">Capacity</span>
        <span class="info-value">${totalUsed} / ${effectiveCap}</span>
      </div>
      <div class="capacity-bar-track">
        <div class="capacity-bar-fill ${barClass}" style="width:${pct}%"></div>
      </div>
    </div>`;
    html += '</div>';
  }

  // Upgrades section
  const upgradeSpec = BUILDING_UPGRADES[building.type];
  if (upgradeSpec && building.state === BuildingState.Active && building.playerId === getGame().getHumanPlayerId()) {
    html += '<div class="info-section">';
    html += `<div class="info-section-label">${icon('hammer')} Upgrades</div>`;

    const axes: { axis: UpgradeAxis; label: string }[] = [
      { axis: UpgradeAxis.Storage, label: 'Storage' },
      { axis: UpgradeAxis.Production, label: 'Speed' },
      { axis: UpgradeAxis.Workers, label: 'Workers' },
    ];

    for (const { axis, label } of axes) {
      const config = upgradeSpec[axis];
      if (!config) continue;

      const currentLevel = building.upgradeLevels?.[axis] ?? 0;

      // Show current effect
      let effectText = '';
      if (axis === UpgradeAxis.Storage) {
        effectText = `${getEffectiveStorageCapacity(building)} cap`;
      } else if (axis === UpgradeAxis.Production) {
        const mult = getProductionSpeedMultiplier(building);
        effectText = mult < 1 ? `${Math.round((1 / mult - 1) * 100)}% faster` : 'Normal';
      } else if (axis === UpgradeAxis.Workers) {
        effectText = `${getMaxWorkers(building)} worker${getMaxWorkers(building) > 1 ? 's' : ''}`;
      }

      html += `<div class="info-row">
        <span class="info-label">${label} Lv.${currentLevel}</span>
        <span class="info-value">${effectText}</span>
      </div>`;

      if (building.activeUpgrade?.axis === axis) {
        const cost = getUpgradeCost(building.type, axis, currentLevel);
        const allDelivered = cost ? cost.every((c) => {
          const delivered = getInventoryAmount(building.activeUpgrade!.resourcesDelivered, c.resource);
          return delivered >= c.amount;
        }) : true;

        if (!allDelivered && cost) {
          const gatherParts = cost.map((c) => {
            const delivered = getInventoryAmount(building.activeUpgrade!.resourcesDelivered, c.resource);
            return `${delivered}/${c.amount} ${RESOURCE_PROPERTIES[c.resource].label}`;
          });
          html += `<div class="info-row"><span class="info-label">Gathering</span><span class="info-value">${gatherParts.join(', ')}</span></div>`;
        } else {
          const pct = Math.round((building.activeUpgrade.constructionProgress ?? 0) * 100);
          html += `<div class="info-progress-bar"><div class="info-progress-fill info-progress-upgrade" style="width: ${pct}%"></div></div>`;
          html += `<div class="info-row"><span class="info-label">Building...</span><span class="info-value">${pct}%</span></div>`;
        }
        html += `<button class="info-upgrade-cancel-btn" data-building-id="${building.id}">Cancel Upgrade</button>`;
      } else if (canUpgrade(building, axis)) {
        const cost = getUpgradeCost(building.type, axis, currentLevel);
        if (cost) {
          const castle = getGame().getGameState().findCastle(building.playerId);
          const canAffordUpgrade = castle ? cost.every((c) => getInventoryAmount(castle.outputInventory, c.resource) >= c.amount) : false;
          const costStr = cost.map((c) => `${c.amount} ${RESOURCE_PROPERTIES[c.resource].label}`).join(', ');
          html += `<button class="info-upgrade-btn" data-building-id="${building.id}" data-axis="${axis}"${canAffordUpgrade ? '' : ' disabled'}>Upgrade (${costStr})</button>`;
        }
      } else if (currentLevel >= config.maxLevel) {
        html += `<div class="info-row"><span class="info-label"></span><span class="info-value" style="color: #4caf50;">MAX</span></div>`;
      }
    }
    html += '</div>';
  }

  // Demolish button (non-Castle, human player only)
  if (building.type !== BuildingType.Castle && building.playerId === getGame().getHumanPlayerId()) {
    html += `<div class="info-section">
      <button class="info-demolish-btn" data-building-id="${building.id}">
        ${icon('delete')} Demolish
      </button>
    </div>`;
  }

  // Position
  html += `<div class="info-section info-section-meta">
    <div class="info-row">
      <span class="info-label">Position</span>
      <span class="info-value">(${building.coord.q}, ${building.coord.r})</span>
    </div>
  </div>`;

  infoPanelContent.innerHTML = html;
}

/** Show the info panel for a building and start live updates */
export function showInfoPanel(building: Building): void {
  const def = BUILDING_DEFINITIONS[building.type];
  infoPanelTitle.textContent = def.label;
  renderInfoPanel(building);
  infoPanel.classList.remove('hidden');

  // Close other panels when info panel opens
  closeBuildPanelFn();
  closeStatsPanelFn();
  closePriorityPanelFn();

  // Start live updates (every 500ms)
  stopInfoPanelUpdates();
  infoPanelUpdateInterval = setInterval(() => {
    const current = getGame().getGameState().getBuilding(building.id);
    if (current) {
      renderInfoPanel(current);
    } else {
      closeInfoPanel();
    }
  }, 500);
}

export function closeInfoPanel(): void {
  infoPanel.classList.add('hidden');
  stopInfoPanelUpdates();
  if (!isAttackModeActive()) {
    const selection = getGame().getSelectionController();
    if (selection?.selected) {
      selection.deselect();
    }
  }
}

export function stopInfoPanelUpdates(): void {
  if (infoPanelUpdateInterval !== null) {
    clearInterval(infoPanelUpdateInterval);
    infoPanelUpdateInterval = null;
  }
}

/** Hide the info panel element (without deselecting) */
export function hideInfoPanelElement(): void {
  infoPanel.classList.add('hidden');
}
