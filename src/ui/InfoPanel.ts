import type { Game } from '../engine/Game';
import { icon, resourceIcon, buildingIcon, unitIcon } from './icons';
import { BuildingType, BUILDING_DEFINITIONS } from '../game/BuildingType';
import { BuildingState, getInventoryAmount, getInventoryTotal } from '../game/Building';
import type { Building, ResourceInventory } from '../game/Building';
import { RESOURCE_PROPERTIES, ResourceType, TOOL_TYPES } from '../game/ResourceType';
import { UNIT_DEFINITIONS } from '../game/UnitType';
import { getDistanceMultiplier, getDistanceRating } from '../game/ProductionManager';
import {
  BUILDING_UPGRADES,
  UpgradeAxis,
  getUpgradeCost,
  getEffectiveStorageCapacity,
  getProductionSpeedMultiplier,
  getMaxWorkers,
  getEffectiveWorkRadius,
  canUpgrade,
} from '../game/BuildingUpgrade';
import { startAttackTargeting, isAttackModeActive } from './BuildPanel';
import { showDemolishConfirm } from './DemolishDialog';
import { PanelUpdater } from './PanelUpdater';
import type { Flag } from '../game/RoadNetwork';
import {
  ROAD_QUALITY_NAMES,
  getRoadUpgradeCost,
  getSatiationColor,
  getSatiationStatus,
  HUNGER_SPEED_PENALTY_HUNGRY,
  HUNGER_SPEED_PENALTY_STARVING,
  HUNGER_PRODUCTION_PENALTY_HUNGRY,
  HUNGER_PRODUCTION_PENALTY_STARVING,
} from '../game/data/balanceConstants';
import { BottomSheetController } from './BottomSheetController';

let infoPanel: HTMLElement;
let infoPanelTitle: HTMLElement;
let infoPanelContent: HTMLElement;
let infoPanelUpdateInterval: ReturnType<typeof setInterval> | null = null;
let updater: PanelUpdater;

let getGame: () => Game;
let closeBuildPanelFn: () => void;
let closeStatsPanelFn: () => void;
let selectedBuildingId: string | null = null;

/** Mobile bottom sheet controller (null on desktop) */
let bottomSheet: BottomSheetController | null = null;
let isDesktop = false;

function getSelectedBuilding(): Building | undefined {
  if (!selectedBuildingId) return undefined;
  return getGame().getGameState().getBuilding(selectedBuildingId);
}

function setupBottomSheet(): void {
  if (bottomSheet) return;
  bottomSheet = new BottomSheetController(infoPanel, {
    snapPoints: [30, 75],
    onDismiss: () => {
      stopInfoPanelUpdates();
      updater.reset();
      if (!isAttackModeActive()) {
        const selection = getGame().getSelectionController();
        if (selection?.selected) {
          selection.deselect();
        }
      }
      selectedBuildingId = null;
    },
  });
}

export function initInfoPanel(
  getGameFn: () => Game,
  closeBuildPanel: () => void,
  closeStatsPanel: () => void,
): void {
  getGame = getGameFn;
  closeBuildPanelFn = closeBuildPanel;
  closeStatsPanelFn = closeStatsPanel;

  infoPanel = document.getElementById('info-panel')!;
  infoPanelTitle = document.getElementById('info-panel-title')!;
  infoPanelContent = document.getElementById('info-panel-content')!;
  updater = new PanelUpdater(infoPanelContent);
  const infoCloseBtn = document.getElementById('info-close-btn')!;

  infoCloseBtn.addEventListener('click', closeInfoPanel);

  // Set up responsive mode and bottom sheet for mobile
  const mq = window.matchMedia('(min-width: 769px)');
  isDesktop = mq.matches;
  mq.addEventListener('change', (e) => {
    isDesktop = e.matches;
    if (isDesktop) {
      // Switching to desktop — destroy mobile sheet, clear inline styles
      bottomSheet?.destroy();
      bottomSheet = null;
      infoPanel.style.transform = '';
      infoPanel.style.visibility = '';
      infoPanel.style.pointerEvents = '';
      infoPanel.style.transition = '';
      infoPanel.style.maxHeight = '';
    } else {
      setupBottomSheet();
    }
    closeInfoPanel();
  });
  if (!isDesktop) {
    setupBottomSheet();
  }

  // Event delegation for info panel buttons
  infoPanelContent.addEventListener('click', (e) => {
    // Quick action buttons (mobile)
    const quickAction = (e.target as HTMLElement).closest('.info-quick-action') as HTMLElement | null;
    if (quickAction?.dataset.action && quickAction?.dataset.buildingId) {
      const bid = quickAction.dataset.buildingId;
      const action = quickAction.dataset.action;
      if (action === 'demolish') {
        const bld = getGame().getGameState().getBuilding(bid);
        if (bld) showDemolishConfirm(bld);
      } else if (action === 'toggle-pause') {
        const bld = getGame().getGameState().getBuilding(bid);
        if (bld) {
          bld.productionPaused = !bld.productionPaused;
          updater.reset();
          updater.update(
            getInfoStructureKey(bld),
            () => generateInfoHTML(bld),
            () => updateInfoValues(bld),
          );
        }
      } else if (action === 'attack') {
        startAttackTargeting(bid);
      }
      return;
    }

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
        if (building) {
          updater.reset();
          updater.update(
            getInfoStructureKey(building),
            () => generateInfoHTML(building),
            () => updateInfoValues(building),
          );
        }
      }
    }

    const cancelBtn = (e.target as HTMLElement).closest('.info-upgrade-cancel-btn') as HTMLElement | null;
    if (cancelBtn?.dataset.buildingId) {
      const cancelled = getGame().getUpgradeManager().cancelUpgrade(cancelBtn.dataset.buildingId);
      if (cancelled) {
        const building = getGame().getGameState().getBuilding(cancelBtn.dataset.buildingId);
        if (building) {
          updater.reset();
          updater.update(
            getInfoStructureKey(building),
            () => generateInfoHTML(building),
            () => updateInfoValues(building),
          );
        }
      }
    }

    const demolishBtn = (e.target as HTMLElement).closest('.info-demolish-btn') as HTMLElement | null;
    if (demolishBtn?.dataset.buildingId) {
      const building = getGame().getGameState().getBuilding(demolishBtn.dataset.buildingId);
      if (building) showDemolishConfirm(building);
    }

    // Road upgrade buttons
    const roadUpgradeBtn = (e.target as HTMLElement).closest('.road-upgrade-btn') as HTMLElement | null;
    if (roadUpgradeBtn?.dataset.roadId && roadUpgradeBtn?.dataset.quality) {
      const roadId = roadUpgradeBtn.dataset.roadId;
      const targetQuality = Number(roadUpgradeBtn.dataset.quality);
      const rn = getGame().getRoadNetwork();
      const road = rn.getRoad(roadId);
      if (road) {
        const cost = getRoadUpgradeCost(road.quality);
        const castle = getGame().getGameState().findCastle(getGame().getHumanPlayerId());
        if (castle) {
          // Check and deduct resources
          const canAfford = cost.every(c => getInventoryAmount(castle.outputInventory, c.resource) >= c.amount);
          if (canAfford) {
            for (const c of cost) {
              const current = castle.outputInventory[c.resource] ?? 0;
              castle.outputInventory[c.resource] = current - c.amount;
            }
            rn.upgradeRoad(roadId, targetQuality);
            updater.reset(); // Force rebuild to show new quality
          }
        }
      }
    }

    // Tool queue +/- buttons
    const toolqBtn = (e.target as HTMLElement).closest('.toolq-btn') as HTMLElement | null;
    if (toolqBtn?.dataset.tool && toolqBtn?.dataset.delta) {
      const selectedBuilding = getSelectedBuilding();
      if (selectedBuilding) {
        const toolType = toolqBtn.dataset.tool as ResourceType;
        const delta = parseInt(toolqBtn.dataset.delta, 10);
        getGame().getToolProductionManager().adjustQueue(selectedBuilding.id, toolType, delta);
        // Force structure rebuild to update counts
        updater.reset();
      }
    }
  });
}

/** Format an inventory as HTML list with data-field attributes */
function formatInventory(inventory: ResourceInventory, fieldPrefix: string): string {
  const entries = Object.entries(inventory).filter(
    ([, amount]) => amount !== undefined && amount > 0,
  );
  if (entries.length === 0) return '<span class="info-empty">Empty</span>';
  return entries
    .map(([resource, amount]) => {
      const props = RESOURCE_PROPERTIES[resource as ResourceType];
      return `<div class="info-resource-row">
        <span class="info-resource-name">${resourceIcon(resource)} ${props?.label ?? resource}</span>
        <span class="info-resource-amount" data-field="${fieldPrefix}-${resource}">${amount}</span>
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

/** Get a structure key fingerprint for the building's panel layout */
function getInfoStructureKey(building: Building): string {
  const def = BUILDING_DEFINITIONS[building.type];
  const parts: string[] = [String(building.state)];

  // Construction remaining resource keys
  if (building.state === BuildingState.Planned || building.state === BuildingState.UnderConstruction) {
    const remainingKeys = def.cost
      .filter((c) => (building.constructionDelivered[c.resource] ?? 0) < c.amount)
      .map((c) => c.resource)
      .join(',');
    parts.push('cr:' + remainingKeys);
  }

  // Production progress bar visibility (skip for toolQueue buildings — Tool Queue section handles it)
  if (def.production && building.state === BuildingState.Active && building.toolQueue === undefined) {
    parts.push('pp:' + (building.hasWorker && building.productionProgress > 0 ? '1' : '0'));
  }

  // Geologist prospecting phase (determines progress bar)
  if (building.type === BuildingType.GeologistHut && building.state === BuildingState.Active) {
    const ws = getGame().getGeologistManager().getWorkState(building.id);
    parts.push('gp:' + (ws?.phase === 'prospecting' ? '1' : '0'));
  }

  // Knight count (determines number of knight rows + attack button)
  if (def.knightSlots > 0) {
    parts.push('k:' + building.knightIds.length);
  }

  // Inventory resource keys present
  const inKeys = Object.entries(building.inputInventory)
    .filter(([, v]) => v !== undefined && v > 0)
    .map(([k]) => k).sort().join(',');
  const outKeys = Object.entries(building.outputInventory)
    .filter(([, v]) => v !== undefined && v > 0)
    .map(([k]) => k).sort().join(',');
  parts.push('i:' + inKeys, 'o:' + outKeys);

  // Upgrade states per axis
  const upgradeSpec = BUILDING_UPGRADES[building.type];
  if (upgradeSpec && building.state === BuildingState.Active) {
    for (const axis of [UpgradeAxis.Storage, UpgradeAxis.Production, UpgradeAxis.Workers, UpgradeAxis.WorkRadius]) {
      const config = upgradeSpec[axis];
      if (!config) continue;
      const level = building.upgradeLevels?.[axis] ?? 0;
      let uState = 'idle';
      if (building.activeUpgrade?.axis === axis) {
        const cost = getUpgradeCost(building.type, axis, level);
        const allDelivered = cost ? cost.every((c) => {
          const delivered = getInventoryAmount(building.activeUpgrade!.resourcesDelivered, c.resource);
          return delivered >= c.amount;
        }) : true;
        uState = allDelivered ? 'bld' : 'gth';
      } else if (level >= config.maxLevel) {
        uState = 'max';
      } else if (canUpgrade(building, axis)) {
        uState = 'can';
      }
      parts.push(`u${axis}:${level}:${uState}`);
    }
  }

  // Tool waiting state
  if (building.waitingForTool) {
    parts.push('tw:' + building.waitingForTool);
  }

  // Hunger state bucket (controls hint row visibility)
  if (def.worker) {
    const worker = getGame().getGameState().getWorkerForBuilding(building.id);
    if (worker) {
      const status = getSatiationStatus(worker.satiation);
      parts.push('hs:' + (status || 'ok'));
    }
  }

  // Tool queue state (structure changes when current production or non-zero counts change)
  if (building.toolQueue !== undefined) {
    const curTool = building.currentToolProduction ?? 'none';
    const nonZero = building.toolQueue.filter(e => e.count > 0).map(e => e.toolType).join(',');
    parts.push(`tq:${curTool}:${nonZero}`);
  }

  // Road quality fingerprint (so panel rebuilds after upgrade)
  const rn = getGame().getRoadNetwork();
  const bFlag = rn.getFlagAt(building.coord.q, building.coord.r);
  if (bFlag) {
    const roadQs = rn.getAllRoads()
      .filter(r => (r.flagA === bFlag.id || r.flagB === bFlag.id) && !r.virtual)
      .map(r => `${r.id}:${r.quality}`).join(',');
    if (roadQs) parts.push('rq:' + roadQs);
  }

  return parts.join('|');
}

/** Generate the info panel HTML string for a building */
function generateQuickActionsHTML(building: Building): string {
  if (isDesktop) return '';
  const def = BUILDING_DEFINITIONS[building.type];
  const actions: string[] = [];

  // Pause/Resume (for active production buildings)
  if (building.state === BuildingState.Active && def.production) {
    const isPaused = building.productionPaused;
    actions.push(`<button class="info-quick-action" data-action="toggle-pause" data-building-id="${building.id}">
      ${icon(isPaused ? 'play_arrow' : 'pause')}
      <span>${isPaused ? 'Resume' : 'Pause'}</span>
    </button>`);
  }

  // Attack (for military buildings with knight slots)
  if (def.knightSlots > 0 && building.state === BuildingState.Active) {
    actions.push(`<button class="info-quick-action" data-action="attack" data-building-id="${building.id}">
      ${icon('shield_icon')}
      <span>Attack</span>
    </button>`);
  }

  // Demolish (always available)
  actions.push(`<button class="info-quick-action info-quick-action-danger" data-action="demolish" data-building-id="${building.id}">
    ${icon('close')}
    <span>Demolish</span>
  </button>`);

  if (actions.length === 0) return '';
  return `<div class="info-quick-actions">${actions.join('')}</div>`;
}

function generateInfoHTML(building: Building): string {
  const def = BUILDING_DEFINITIONS[building.type];
  const stateDisplay = getStateDisplay(building.state);

  let html = '';

  // Quick actions row (mobile only)
  html += generateQuickActionsHTML(building);

  // Status
  html += `<div class="info-section">
    <div class="info-row">
      <span class="info-label">Status</span>
      <span class="info-value ${stateDisplay.cssClass}" data-field="status-label">${stateDisplay.label}</span>
    </div>`;

  // Construction progress
  if (
    building.state === BuildingState.Planned ||
    building.state === BuildingState.UnderConstruction
  ) {
    const pct = Math.round(building.constructionProgress * 100);
    html += `<div class="info-row">
      <span class="info-label">Construction</span>
      <span class="info-value" data-field="const-pct">${pct}%</span>
    </div>
    <div class="info-progress-bar">
      <div class="info-progress-fill" data-field="const-bar" style="width:${pct}%"></div>
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
          <span class="info-resource-amount" data-field="const-res-${r.resource}">${r.delivered} / ${r.needed}</span>
        </div>`;
      }
    }
  }
  html += '</div>';

  // Tool waiting alert
  if (building.waitingForTool && building.state === BuildingState.Active) {
    const toolLabel = RESOURCE_PROPERTIES[building.waitingForTool].label;
    const castle = getGame().getGameState().findCastle(building.playerId);
    const castleStock = castle ? getInventoryAmount(castle.outputInventory, building.waitingForTool) : 0;

    // Check tool production status across player's Toolmakers
    let toolStatus = 'Not queued';
    let statusClass = 'tool-alert-status-idle';
    const playerBuildings = getGame().getGameState().getBuildingsByPlayer(building.playerId);
    for (const b of playerBuildings) {
      if (b.toolQueue === undefined) continue;
      if (b.currentToolProduction === building.waitingForTool) {
        toolStatus = 'In production';
        statusClass = 'tool-alert-status-producing';
        break;
      }
      const entry = b.toolQueue.find(e => e.toolType === building.waitingForTool);
      if (entry && entry.count > 0 && statusClass !== 'tool-alert-status-producing') {
        toolStatus = 'Queued';
        statusClass = 'tool-alert-status-queued';
      }
    }

    html += `<div class="tool-waiting-alert">
      <div style="font-weight:600;color:#e65100;margin-bottom:4px">⚠ Waiting for tool</div>
      <div class="info-row">
        <span class="info-label">Required</span>
        <span class="info-value" data-field="tool-wait-name">${resourceIcon(building.waitingForTool)} ${toolLabel}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Tool status</span>
        <span class="info-value" data-field="tool-wait-status"><span class="${statusClass}"></span> ${toolStatus}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Castle stock</span>
        <span class="info-value" data-field="tool-wait-stock">${castleStock}</span>
      </div>
    </div>`;
  }

  // Tool waiting alert for construction buildings
  if (building.waitingForTool && building.state === BuildingState.UnderConstruction) {
    const toolLabel = RESOURCE_PROPERTIES[building.waitingForTool].label;
    html += `<div class="tool-waiting-alert">
      <div style="font-weight:600;color:#e65100;margin-bottom:4px">⚠ Builder needs ${toolLabel}</div>
    </div>`;
  }

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
        <span class="info-value ${assignedCount >= maxW ? 'state-active' : 'state-planned'}" data-field="worker-count">${assignedCount}/${maxW}</span>
      </div>`;
    if (def.workerTool) {
      const toolProps = RESOURCE_PROPERTIES[def.workerTool];
      html += `<div class="info-row">
        <span class="info-label">Requires</span>
        <span class="info-value">${toolProps.label}</span>
      </div>`;
    }
    // Worker food bar
    if (primaryWorker) {
      const sat = primaryWorker.satiation;
      const satPct = Math.round(sat * 100);
      const satColor = getSatiationColor(sat);
      const satStatus = getSatiationStatus(sat);
      html += `<div class="info-row">
        <span class="info-label">Food</span>
        <span class="info-value" data-field="worker-sat-pct" style="color:${satColor}">${satPct}%${satStatus ? ` (${satStatus})` : ''}</span>
      </div>
      <div style="background:var(--color-progress-bg);border-radius:4px;height:6px;margin:2px 0 4px">
        <div data-field="worker-sat-bar" style="width:${satPct}%;height:100%;border-radius:4px;background:${satColor};transition:width 0.3s"></div>
      </div>`;
      // Hunger status hint
      if (satStatus) {
        const speedPenalty = satStatus === 'Starving'
          ? Math.round(HUNGER_SPEED_PENALTY_STARVING * 100)
          : Math.round(HUNGER_SPEED_PENALTY_HUNGRY * 100);
        const prodPenalty = satStatus === 'Starving'
          ? Math.round(HUNGER_PRODUCTION_PENALTY_STARVING * 100)
          : Math.round(HUNGER_PRODUCTION_PENALTY_HUNGRY * 100);
        const penaltyColor = satStatus === 'Starving' ? '#EF5350' : '#FFB74D';
        html += `<div style="font-size:0.75rem;color:${penaltyColor};margin-bottom:4px">
          ${satStatus === 'Starving' ? 'Starving!' : 'Hungry'} — speed -${speedPenalty}%, production -${prodPenalty}%
        </div>`;
        // Smart hint: check if food exists in storage
        const gameState = getGame().getGameState();
        const storageBuildings = gameState.getBuildingsByPlayer(building.playerId)
          .filter(b => b.state === BuildingState.Active && (b.type === BuildingType.Castle || b.type === BuildingType.Warehouse));
        let totalFood = 0;
        for (const sb of storageBuildings) {
          for (const [res, amount] of Object.entries(sb.outputInventory)) {
            if (amount && amount > 0 && RESOURCE_PROPERTIES[res as ResourceType].satiationValue > 0) {
              totalFood += amount;
            }
          }
        }
        const hint = totalFood > 0
          ? 'Food available in storage — check road connections'
          : 'Build food buildings (Fisherman\'s Hut, Farm, Bakery)';
        html += `<div style="font-size:0.7rem;color:var(--color-on-surface-faint);margin-bottom:4px">${hint}</div>`;
      }
    }
    html += '</div>';
  }

  // Production info (skip for toolQueue buildings — Tool Queue section handles display)
  if (def.production && building.state === BuildingState.Active && building.toolQueue === undefined) {
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
        <span class="info-value" data-field="prod-pct">${pct}%</span>
      </div>
      <div class="info-progress-bar">
        <div class="info-progress-fill ${progressColor}" data-field="prod-bar" style="width:${pct}%"></div>
      </div>`;
    }

    html += `<div class="info-row">
      <span class="info-label">Cycle Time</span>
      <span class="info-value" data-field="cycle-time"${rating ? ` style="color:${rating.color}"` : ''}>${effectiveTime.toFixed(1)}s</span>
    </div>`;
    if (rating) {
      const efficiency = Math.round((1 / multiplier) * 100);
      html += `<div class="info-row">
        <span class="info-label">Efficiency</span>
        <span class="info-value" data-field="efficiency" style="color:${rating.color}">${efficiency}%</span>
      </div>
      <div class="info-row">
        <span class="info-label">Resource Distance</span>
        <span class="info-value" data-field="res-distance" style="color:${rating.color}">${building.resourceDistance} tile${building.resourceDistance !== 1 ? 's' : ''}</span>
      </div>`;
    }
    html += '</div>';
  }

  // Tool production queue (for buildings with dynamic outputs like Toolmaker)
  if (building.toolQueue !== undefined && building.state === BuildingState.Active) {
    html += `<div class="info-section">
      <div class="info-section-label">${icon('hammer')} Tool Queue</div>`;

    // Currently producing
    if (building.currentToolProduction) {
      const curLabel = RESOURCE_PROPERTIES[building.currentToolProduction].label;
      const pct = Math.round(building.productionProgress * 100);
      html += `<div class="info-row">
        <span class="info-label">Now Making</span>
        <span class="info-value" data-field="tq-current">${resourceIcon(building.currentToolProduction)} ${curLabel}</span>
      </div>
      <div class="info-progress-bar">
        <div class="info-progress-fill info-progress-production" data-field="tq-bar" style="width:${pct}%"></div>
      </div>`;
    } else {
      html += `<div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value" data-field="tq-current">Idle</span>
      </div>`;
    }

    // Queue list — iterate TOOL_TYPES to auto-discover
    html += '<div class="info-subsection-label" style="margin-top:8px">Queue</div>';
    let totalQueued = 0;
    for (const t of TOOL_TYPES) {
      const entry = building.toolQueue.find(e => e.toolType === t);
      const count = entry?.count ?? 0;
      totalQueued += count;
      const toolLabel = RESOURCE_PROPERTIES[t].label;
      html += `<div class="info-resource-row" style="align-items:center">
        <span class="info-resource-name">${resourceIcon(t)} ${toolLabel}</span>
        <span style="display:flex;align-items:center;gap:4px">
          <button class="toolq-btn btn-text" data-tool="${t}" data-delta="-1" style="width:28px;height:28px;padding:0;min-width:28px;font-size:16px;line-height:1">−</button>
          <span class="info-resource-amount" data-field="toolq-${t}" style="min-width:20px;text-align:center">${count}</span>
          <button class="toolq-btn btn-text" data-tool="${t}" data-delta="1" style="width:28px;height:28px;padding:0;min-width:28px;font-size:16px;line-height:1">+</button>
        </span>
      </div>`;
    }
    html += `<div class="info-row" style="margin-top:4px;border-top:1px solid var(--color-outline-variant);padding-top:4px">
      <span class="info-label">Total Queued</span>
      <span class="info-value" data-field="tq-total">${totalQueued}</span>
    </div>`;

    // Cycle time and output destination
    if (def.production) {
      const speedMult = getProductionSpeedMultiplier(building);
      const effectiveTime = def.production.productionTime * speedMult;
      html += `<div class="info-row">
        <span class="info-label">Cycle Time</span>
        <span class="info-value" data-field="tq-cycle-time">${effectiveTime.toFixed(1)}s</span>
      </div>`;
    }
    html += `<div class="info-row">
      <span class="info-label">Output</span>
      <span class="info-value">→ Castle (via logistics)</span>
    </div>`;

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
        <span class="info-value" data-field="geo-phase">${phaseLabel}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Tiles prospected</span>
        <span class="info-value" data-field="geo-count">${prospectedCount}</span>
      </div>`;

    if (ws && ws.phase === 'prospecting') {
      const pct = Math.min(Math.round(ws.prospectProgress * 100), 100);
      html += `<div class="info-row">
        <span class="info-label">Progress</span>
        <span class="info-value">
          <div style="display:inline-block;width:60px;height:8px;background:#444;border-radius:4px;vertical-align:middle;overflow:hidden">
            <div data-field="geo-bar" style="width:${pct}%;height:100%;background:#4caf50;border-radius:4px"></div>
          </div> <span data-field="geo-pct">${pct}%</span>
        </span>
      </div>`;
    }

    html += '</div>';
  }

  // Military unit slots
  if (def.knightSlots > 0) {
    html += `<div class="info-section">
      <div class="info-section-label">${icon('shield_icon')} Garrison</div>
      <div class="info-row">
        <span class="info-label">Stationed</span>
        <span class="info-value" data-field="knight-stationed">${building.knightIds.length} / ${def.knightSlots}</span>
      </div>`;

    if (building.knightIds.length > 0) {
      const gameState = getGame().getGameState();
      for (let i = 0; i < building.knightIds.length; i++) {
        const unit = gameState.getUnit(building.knightIds[i]);
        if (unit) {
          const unitDef = UNIT_DEFINITIONS[unit.type];
          html += `<div class="info-resource-row">
            <span class="info-resource-name">${unitIcon(unit.type, 16)} ${unitDef?.label ?? unit.type}</span>
            <span class="info-resource-amount" data-field="knight-${i}-rank">Rank ${unit.knightRank}</span>
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
      html += formatInventory(building.inputInventory, 'inv-in');
    }
    if (hasOutputs) {
      html += '<div class="info-subsection-label">Output</div>';
      html += formatInventory(building.outputInventory, 'inv-out');
    }
    const effectiveCap = getEffectiveStorageCapacity(building);
    const totalUsed = getInventoryTotal(building.inputInventory) + getInventoryTotal(building.outputInventory);
    const pct = effectiveCap > 0 ? Math.min(100, Math.round((totalUsed / effectiveCap) * 100)) : 0;
    const barClass = pct > 85 ? 'capacity-bar-red' : pct > 60 ? 'capacity-bar-amber' : 'capacity-bar-green';
    html += `<div class="capacity-bar-wrapper">
      <div class="capacity-bar-label">
        <span class="info-label">Capacity</span>
        <span class="info-value" data-field="capacity-used">${totalUsed} / ${effectiveCap}</span>
      </div>
      <div class="capacity-bar-track">
        <div class="capacity-bar-fill ${barClass}" data-field="capacity-bar" style="width:${pct}%"></div>
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
      { axis: UpgradeAxis.WorkRadius, label: 'Work Area' },
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
      } else if (axis === UpgradeAxis.WorkRadius) {
        effectText = `${getEffectiveWorkRadius(building)} hex radius`;
      }

      html += `<div class="info-row">
        <span class="info-label">${label} Lv.${currentLevel}</span>
        <span class="info-value" data-field="upgrade-${axis}-effect">${effectText}</span>
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
          html += `<div class="info-row"><span class="info-label">Gathering</span><span class="info-value" data-field="upgrade-gather">${gatherParts.join(', ')}</span></div>`;
        } else {
          const pct = Math.round((building.activeUpgrade.constructionProgress ?? 0) * 100);
          html += `<div class="info-progress-bar"><div class="info-progress-fill info-progress-upgrade" data-field="upgrade-const-bar" style="width: ${pct}%"></div></div>`;
          html += `<div class="info-row"><span class="info-label">Building...</span><span class="info-value" data-field="upgrade-const-pct">${pct}%</span></div>`;
        }
        html += `<button class="info-upgrade-cancel-btn" data-building-id="${building.id}">Cancel Upgrade</button>`;
      } else if (canUpgrade(building, axis)) {
        const cost = getUpgradeCost(building.type, axis, currentLevel);
        if (cost) {
          const castle = getGame().getGameState().findCastle(building.playerId);
          const canAffordUpgrade = castle ? cost.every((c) => getInventoryAmount(castle.outputInventory, c.resource) >= c.amount) : false;
          const costStr = cost.map((c) => `${c.amount} ${RESOURCE_PROPERTIES[c.resource].label}`).join(', ');
          html += `<button class="info-upgrade-btn" data-field="upgrade-btn-${axis}" data-building-id="${building.id}" data-axis="${axis}"${canAffordUpgrade ? '' : ' disabled'}>Upgrade (${costStr})</button>`;
        }
      } else if (currentLevel >= config.maxLevel) {
        html += `<div class="info-row"><span class="info-label"></span><span class="info-value" style="color: #4caf50;">MAX</span></div>`;
      }
    }
    html += '</div>';
  }

  // Connected roads with upgrade buttons
  if (building.playerId === getGame().getHumanPlayerId()) {
    const rn = getGame().getRoadNetwork();
    const buildingFlag = rn.getFlagAt(building.coord.q, building.coord.r);
    if (buildingFlag) {
      const connectedRoads = rn.getAllRoads().filter(
        r => (r.flagA === buildingFlag.id || r.flagB === buildingFlag.id) && !r.virtual,
      );
      if (connectedRoads.length > 0) {
        html += '<div class="info-section"><div class="info-section-label">Roads</div>';
        for (const road of connectedRoads) {
          const qualityName = ROAD_QUALITY_NAMES[road.quality] ?? 'Path';
          const otherFlagId = road.flagA === buildingFlag.id ? road.flagB : road.flagA;
          const otherFlag = rn.getFlag(otherFlagId);
          let otherLabel = 'Flag';
          if (otherFlag?.buildingId) {
            const ob = getGame().getGameState().getBuilding(otherFlag.buildingId);
            if (ob) otherLabel = BUILDING_DEFINITIONS[ob.type]?.label ?? 'Flag';
          }
          html += `<div class="info-resource-row" style="flex-wrap:wrap;gap:4px">
            <span class="info-resource-name">→ ${otherLabel}</span>
            <span class="info-resource-amount" data-field="bld-road-q-${road.id}">${qualityName}</span>
          </div>`;
          if (road.quality < 3) {
            const cost = getRoadUpgradeCost(road.quality);
            const nextName = ROAD_QUALITY_NAMES[road.quality + 1];
            const castle = getGame().getGameState().findCastle(building.playerId);
            const canAfford = castle ? cost.every(c => getInventoryAmount(castle.outputInventory, c.resource) >= c.amount) : false;
            const costStr = cost.map(c => `${c.amount} ${RESOURCE_PROPERTIES[c.resource].label}`).join(', ');
            html += `<button class="btn-outlined road-upgrade-btn" data-road-id="${road.id}" data-quality="${road.quality + 1}" style="width:100%;margin:2px 0 6px;font-size:0.75rem;padding:4px 8px"${canAfford ? '' : ' disabled'}>
              Upgrade to ${nextName} (${costStr})
            </button>`;
          }
        }
        html += '</div>';
      }
    }
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

  return html;
}

/** Update dynamic values without rebuilding DOM */
function updateInfoValues(building: Building): void {
  const def = BUILDING_DEFINITIONS[building.type];

  // Construction progress
  if (building.state === BuildingState.Planned || building.state === BuildingState.UnderConstruction) {
    const pct = Math.round(building.constructionProgress * 100);
    updater.setText('const-pct', `${pct}%`);
    updater.setWidth('const-bar', `${pct}%`);
    for (const c of def.cost) {
      const delivered = building.constructionDelivered[c.resource] ?? 0;
      if (delivered < c.amount) {
        updater.setText(`const-res-${c.resource}`, `${delivered} / ${c.amount}`);
      }
    }
  }

  // Worker count + satiation
  if (def.worker) {
    const gameState = getGame().getGameState();
    const primaryWorker = gameState.getWorkerForBuilding(building.id);
    const maxW = getMaxWorkers(building);
    const assignedCount = (primaryWorker ? 1 : 0) + (building.extraWorkerIds ?? []).filter((id) => gameState.getUnit(id)).length;
    updater.setText('worker-count', `${assignedCount}/${maxW}`);
    updater.setClass('worker-count', `info-value ${assignedCount >= maxW ? 'state-active' : 'state-planned'}`);
    if (primaryWorker) {
      const sat = primaryWorker.satiation;
      const satPct = Math.round(sat * 100);
      const satColor = getSatiationColor(sat);
      const satStatus = getSatiationStatus(sat);
      updater.setText('worker-sat-pct', `${satPct}%${satStatus ? ` (${satStatus})` : ''}`);
      updater.setWidth('worker-sat-bar', `${satPct}%`);
      updater.setColor('worker-sat-pct', satColor);
      updater.setBackground('worker-sat-bar', satColor);
    }
  }

  // Production (skip for toolQueue buildings — handled by tool queue update below)
  if (def.production && building.state === BuildingState.Active && building.toolQueue === undefined) {
    if (building.hasWorker && building.productionProgress > 0) {
      const multiplier = def.harvestTerrain ? getDistanceMultiplier(building.resourceDistance) : 1;
      const progressColor = def.harvestTerrain
        ? (multiplier <= 1.5 ? 'info-progress-perfect' : multiplier <= 2.0 ? 'info-progress-medium' : 'info-progress-poor')
        : 'info-progress-production';
      const pct = Math.round(building.productionProgress * 100);
      updater.setText('prod-pct', `${pct}%`);
      updater.setWidth('prod-bar', `${pct}%`);
      updater.setClass('prod-bar', `info-progress-fill ${progressColor}`);
    }

    const multiplier = def.harvestTerrain ? getDistanceMultiplier(building.resourceDistance) : 1;
    const speedMult = getProductionSpeedMultiplier(building);
    const effectiveTime = def.production.productionTime * multiplier * speedMult;
    updater.setText('cycle-time', `${effectiveTime.toFixed(1)}s`);

    if (def.harvestTerrain) {
      const efficiency = Math.round((1 / multiplier) * 100);
      updater.setText('efficiency', `${efficiency}%`);
      updater.setText('res-distance', `${building.resourceDistance} tile${building.resourceDistance !== 1 ? 's' : ''}`);
    }
  }

  // Tool queue updates
  if (building.toolQueue !== undefined && building.state === BuildingState.Active) {
    if (building.currentToolProduction) {
      const pct = Math.round(building.productionProgress * 100);
      updater.setWidth('tq-bar', `${pct}%`);
    }
    if (def.production) {
      const speedMult = getProductionSpeedMultiplier(building);
      const effectiveTime = def.production.productionTime * speedMult;
      updater.setText('tq-cycle-time', `${effectiveTime.toFixed(1)}s`);
    }
  }

  // Geologist
  if (building.type === BuildingType.GeologistHut && building.state === BuildingState.Active) {
    const geoMgr = getGame().getGeologistManager();
    const ws = geoMgr.getWorkState(building.id);
    const phaseLabels: Record<string, string> = {
      idle_at_hut: 'Idle',
      walking_to_prospect: 'Walking to site',
      prospecting: 'Prospecting',
      walking_to_hut: 'Returning',
    };
    updater.setText('geo-phase', ws ? phaseLabels[ws.phase] ?? ws.phase : 'Idle');
    updater.setText('geo-count', `${ws ? ws.prospectedCount : 0}`);
    if (ws && ws.phase === 'prospecting') {
      const pct = Math.min(Math.round(ws.prospectProgress * 100), 100);
      updater.setWidth('geo-bar', `${pct}%`);
      updater.setText('geo-pct', `${pct}%`);
    }
  }

  // Military units
  if (def.knightSlots > 0) {
    updater.setText('knight-stationed', `${building.knightIds.length} / ${def.knightSlots}`);
    const gameState = getGame().getGameState();
    for (let i = 0; i < building.knightIds.length; i++) {
      const unit = gameState.getUnit(building.knightIds[i]);
      if (unit) {
        updater.setText(`knight-${i}-rank`, `Rank ${unit.knightRank}`);
      }
    }
  }

  // Inventory amounts
  for (const [resource, amount] of Object.entries(building.inputInventory)) {
    if (amount !== undefined && amount > 0) {
      updater.setText(`inv-in-${resource}`, `${amount}`);
    }
  }
  for (const [resource, amount] of Object.entries(building.outputInventory)) {
    if (amount !== undefined && amount > 0) {
      updater.setText(`inv-out-${resource}`, `${amount}`);
    }
  }

  // Capacity
  const hasInventory = Object.values(building.inputInventory).some((v) => v !== undefined && v > 0)
    || Object.values(building.outputInventory).some((v) => v !== undefined && v > 0);
  if (hasInventory) {
    const effectiveCap = getEffectiveStorageCapacity(building);
    const totalUsed = getInventoryTotal(building.inputInventory) + getInventoryTotal(building.outputInventory);
    const pct = effectiveCap > 0 ? Math.min(100, Math.round((totalUsed / effectiveCap) * 100)) : 0;
    const barClass = pct > 85 ? 'capacity-bar-red' : pct > 60 ? 'capacity-bar-amber' : 'capacity-bar-green';
    updater.setText('capacity-used', `${totalUsed} / ${effectiveCap}`);
    updater.setWidth('capacity-bar', `${pct}%`);
    updater.setClass('capacity-bar', `capacity-bar-fill ${barClass}`);
  }

  // Upgrades
  const upgradeSpec = BUILDING_UPGRADES[building.type];
  if (upgradeSpec && building.state === BuildingState.Active && building.playerId === getGame().getHumanPlayerId()) {
    for (const axis of [UpgradeAxis.Storage, UpgradeAxis.Production, UpgradeAxis.Workers, UpgradeAxis.WorkRadius]) {
      const config = upgradeSpec[axis];
      if (!config) continue;
      const currentLevel = building.upgradeLevels?.[axis] ?? 0;

      let effectText = '';
      if (axis === UpgradeAxis.Storage) {
        effectText = `${getEffectiveStorageCapacity(building)} cap`;
      } else if (axis === UpgradeAxis.Production) {
        const mult = getProductionSpeedMultiplier(building);
        effectText = mult < 1 ? `${Math.round((1 / mult - 1) * 100)}% faster` : 'Normal';
      } else if (axis === UpgradeAxis.Workers) {
        effectText = `${getMaxWorkers(building)} worker${getMaxWorkers(building) > 1 ? 's' : ''}`;
      } else if (axis === UpgradeAxis.WorkRadius) {
        effectText = `${getEffectiveWorkRadius(building)} hex radius`;
      }
      updater.setText(`upgrade-${axis}-effect`, effectText);

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
          updater.setText('upgrade-gather', gatherParts.join(', '));
        } else {
          const pct = Math.round((building.activeUpgrade.constructionProgress ?? 0) * 100);
          updater.setWidth('upgrade-const-bar', `${pct}%`);
          updater.setText('upgrade-const-pct', `${pct}%`);
        }
      } else if (canUpgrade(building, axis)) {
        const cost = getUpgradeCost(building.type, axis, currentLevel);
        if (cost) {
          const castle = getGame().getGameState().findCastle(building.playerId);
          const canAffordUpgrade = castle ? cost.every((c) => getInventoryAmount(castle.outputInventory, c.resource) >= c.amount) : false;
          const btn = infoPanelContent.querySelector(`[data-field="upgrade-btn-${axis}"]`) as HTMLButtonElement | null;
          if (btn) btn.disabled = !canAffordUpgrade;
        }
      }
    }
  }
}

/** Show the info panel for a building and start live updates */
export function showInfoPanel(building: Building): void {
  selectedBuildingId = building.id;
  const def = BUILDING_DEFINITIONS[building.type];
  infoPanelTitle.innerHTML = `${buildingIcon(building.type, 24)} ${def.label}`;
  updater.reset();
  updater.update(
    getInfoStructureKey(building),
    () => generateInfoHTML(building),
    () => updateInfoValues(building),
  );

  // Open panel: bottom sheet on mobile, classList on desktop
  if (!isDesktop && bottomSheet) {
    bottomSheet.open(0); // Open at peek snap (30vh)
  } else {
    infoPanel.classList.remove('hidden');
  }

  // Close other panels when info panel opens
  closeBuildPanelFn();
  closeStatsPanelFn();

  // Start live updates (every 500ms)
  stopInfoPanelUpdates();
  infoPanelUpdateInterval = setInterval(() => {
    const current = getGame().getGameState().getBuilding(building.id);
    if (current) {
      updater.update(
        getInfoStructureKey(current),
        () => generateInfoHTML(current),
        () => updateInfoValues(current),
      );
    } else {
      closeInfoPanel();
    }
  }, 500);
}

export function closeInfoPanel(): void {
  if (!isDesktop && bottomSheet?.isOpen) {
    // Mobile: animated dismiss via bottom sheet
    bottomSheet.dismiss();
    // Cleanup is handled by onDismiss callback
  } else {
    infoPanel.classList.add('hidden');
    stopInfoPanelUpdates();
    updater.reset();
    if (!isAttackModeActive()) {
      const selection = getGame().getSelectionController();
      if (selection?.selected) {
        selection.deselect();
      }
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
  if (!isDesktop && bottomSheet?.isOpen) {
    bottomSheet.dismiss();
  } else {
    infoPanel.classList.add('hidden');
  }
}

// ── Road/Flag Info Panel ──────────────────────────────────────────────────

/** Generate HTML for a flag's connected roads with upgrade buttons */
function generateFlagInfoHTML(flag: Flag): string {
  const rn = getGame().getRoadNetwork();
  const roads = rn.getAllRoads().filter(r => r.flagA === flag.id || r.flagB === flag.id);

  let html = '';

  // Flag info
  html += `<div class="info-section">
    <div class="info-row">
      <span class="info-label">Position</span>
      <span class="info-value">(${flag.coord.q}, ${flag.coord.r})</span>
    </div>
    <div class="info-row">
      <span class="info-label">Goods</span>
      <span class="info-value" data-field="flag-goods">${flag.goods.length}/8</span>
    </div>`;
  if (flag.buildingId) {
    const building = getGame().getGameState().getBuilding(flag.buildingId);
    if (building) {
      const def = BUILDING_DEFINITIONS[building.type];
      html += `<div class="info-row">
        <span class="info-label">Building</span>
        <span class="info-value">${def.label}</span>
      </div>`;
    }
  }
  html += '</div>';

  // Connected roads
  if (roads.length > 0) {
    html += '<div class="info-section"><div class="info-section-label">Connected Roads</div>';
    for (const road of roads) {
      if (road.virtual) continue;
      const qualityName = ROAD_QUALITY_NAMES[road.quality] ?? 'Path';
      const otherFlagId = road.flagA === flag.id ? road.flagB : road.flagA;
      const otherFlag = rn.getFlag(otherFlagId);
      let otherLabel = 'Flag';
      if (otherFlag?.buildingId) {
        const otherBuilding = getGame().getGameState().getBuilding(otherFlag.buildingId);
        if (otherBuilding) {
          otherLabel = BUILDING_DEFINITIONS[otherBuilding.type]?.label ?? 'Flag';
        }
      }

      html += `<div class="info-resource-row" style="flex-wrap:wrap;gap:4px">
        <span class="info-resource-name">→ ${otherLabel}</span>
        <span class="info-resource-amount" data-field="road-q-${road.id}">${qualityName}</span>
      </div>`;

      // Upgrade button if not max quality
      if (road.quality < 3) {
        const cost = getRoadUpgradeCost(road.quality);
        const nextName = ROAD_QUALITY_NAMES[road.quality + 1];
        const castle = getGame().getGameState().findCastle(flag.playerId);
        const canAfford = castle ? cost.every(c => getInventoryAmount(castle.outputInventory, c.resource) >= c.amount) : false;
        const costStr = cost.map(c => `${c.amount} ${RESOURCE_PROPERTIES[c.resource].label}`).join(', ');
        html += `<button class="btn-outlined road-upgrade-btn" data-road-id="${road.id}" data-quality="${road.quality + 1}" style="width:100%;margin:2px 0 8px;font-size:0.75rem;padding:4px 8px"${canAfford ? '' : ' disabled'}>
          Upgrade to ${nextName} (${costStr})
        </button>`;
      }
    }
    html += '</div>';
  }

  return html;
}

/** Show the info panel for a flag (road info + upgrade controls) */
export function showFlagInfoPanel(flag: Flag): void {
  selectedBuildingId = null;
  infoPanelTitle.textContent = 'Flag';
  updater.reset();
  updater.update(
    `flag:${flag.id}:${flag.goods.length}`,
    () => generateFlagInfoHTML(flag),
    () => {
      updater.setText('flag-goods', `${flag.goods.length}/8`);
    },
  );
  infoPanel.classList.remove('hidden');
  closeBuildPanelFn();
  closeStatsPanelFn();

  // Live updates
  stopInfoPanelUpdates();
  infoPanelUpdateInterval = setInterval(() => {
    const currentFlag = getGame().getRoadNetwork().getFlag(flag.id);
    if (currentFlag) {
      updater.update(
        `flag:${flag.id}:${currentFlag.goods.length}`,
        () => generateFlagInfoHTML(currentFlag),
        () => {
          updater.setText('flag-goods', `${currentFlag.goods.length}/8`);
        },
      );
    } else {
      closeInfoPanel();
    }
  }, 500);
}
