/**
 * Building info HTML generation for the InfoPanel.
 * Generates the full HTML for a building's detail view and the structure key
 * used by PanelUpdater to determine when a full rebuild is needed.
 */
import type { Game } from '../../engine/Game';
import { icon, resourceIcon, unitIcon } from '../icons';
import { BuildingType, BUILDING_DEFINITIONS } from '../../game/BuildingType';
import { BuildingState, getInventoryAmount, getInventoryTotal, hasOutputSpace } from '../../game/Building';
import type { Building, ResourceInventory } from '../../game/Building';
import { RESOURCE_PROPERTIES, ResourceType, TOOL_TYPES } from '../../game/ResourceType';
import { UNIT_DEFINITIONS } from '../../game/UnitType';
import { getDistanceMultiplier, getDistanceRating } from '../../game/ProductionManager';
import {
  BUILDING_UPGRADES,
  UpgradeAxis,
  getUpgradeCost,
  getEffectiveStorageCapacity,
  getProductionSpeedMultiplier,
  getMaxWorkers,
  getEffectiveWorkRadius,
  canUpgrade,
} from '../../game/BuildingUpgrade';
import { getPlayerCssColor, getPlayerLabel } from '../../engine/PlayerColors';
import {
  ROAD_QUALITY_NAMES,
  getRoadUpgradeCost,
  getSatiationColor,
  getSatiationStatus,
  HUNGER_SPEED_PENALTY_HUNGRY,
  HUNGER_SPEED_PENALTY_STARVING,
  HUNGER_PRODUCTION_PENALTY_HUNGRY,
  HUNGER_PRODUCTION_PENALTY_STARVING,
} from '../../game/data/balanceConstants';
import {
  canTrade, getTradeStructureKey,
  generateTradeHTML,
} from '../TradePanel';
import { UpgradeManager, BUILDING_TYPE_UPGRADE_AXIS } from '../../game/UpgradeManager';

// ── Monotonic inventory key tracking ─────────────────────────────────────
// Once a resource key is observed, it stays in the structure key for the
// panel session — even after the game deletes the key on consumption.
// This prevents structure key churn that would cause full DOM rebuilds.

let trackedBuildingId: string | null = null;
const seenInKeys = new Set<string>();
const seenOutKeys = new Set<string>();

/** Reset inventory tracking (call when panel opens for a new building) */
export function resetInventoryTracking(): void {
  trackedBuildingId = null;
  seenInKeys.clear();
  seenOutKeys.clear();
}

/** Get the accumulated seen inventory keys (for value updater visibility toggling) */
export function getSeenInventoryKeys(): { input: ReadonlySet<string>; output: ReadonlySet<string> } {
  return { input: seenInKeys, output: seenOutKeys };
}

/** Accumulate inventory keys into the seen sets and return stable sorted key strings */
function getStableInventoryKeys(building: Building): { inKeys: string; outKeys: string } {
  if (building.id !== trackedBuildingId) {
    trackedBuildingId = building.id;
    seenInKeys.clear();
    seenOutKeys.clear();
  }
  for (const [k, v] of Object.entries(building.inputInventory)) {
    if (v !== undefined && v > 0) seenInKeys.add(k);
  }
  for (const [k, v] of Object.entries(building.outputInventory)) {
    if (v !== undefined && v > 0) seenOutKeys.add(k);
  }
  return {
    inKeys: [...seenInKeys].sort().join(','),
    outKeys: [...seenOutKeys].sort().join(','),
  };
}

// ── Utility helpers ──────────────────────────────────────────────────────

/** Format an inventory as HTML list with data-field attributes.
 *  Renders rows for all seen keys; zero-amount rows are hidden via display:none. */
function formatInventory(inventory: ResourceInventory, fieldPrefix: string, keys: ReadonlySet<string>): string {
  if (keys.size === 0) return '<span class="info-empty">Empty</span>';
  return [...keys].sort()
    .map((resource) => {
      const amount = inventory[resource as ResourceType] ?? 0;
      const props = RESOURCE_PROPERTIES[resource as ResourceType];
      const display = amount > 0 ? '' : ' style="display:none"';
      return `<div class="info-resource-row" data-field="${fieldPrefix}-row-${resource}"${display}>
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

/** Get a diagnostic hint explaining why a building isn't producing */
function getStatusDiagnostic(building: Building): { text: string; color: string } | null {
  if (building.state !== BuildingState.Active) return null;
  const def = BUILDING_DEFINITIONS[building.type];

  if (building.productionPaused) return { text: 'Production paused by player', color: '#78909C' };
  if (!building.hasWorker) return { text: 'No worker assigned — needs idle serf', color: '#FF9800' };
  if (building.waitingForTool) {
    const toolLabel = RESOURCE_PROPERTIES[building.waitingForTool].label;
    return { text: `Waiting for tool: ${toolLabel}`, color: '#e65100' };
  }
  if (!def.production) return null;

  // Check missing inputs
  if (def.production.inputs.length > 0) {
    const missing = def.production.inputs
      .filter(inp => (building.inputInventory[inp.resource] ?? 0) < inp.amount)
      .map(inp => RESOURCE_PROPERTIES[inp.resource].label);
    if (missing.length > 0) return { text: `Waiting for: ${missing.join(', ')}`, color: '#FF9800' };
  }

  // Check output full
  if (!hasOutputSpace(building)) return { text: 'Output storage full — connect to road network', color: '#EF5350' };

  // Producing normally
  if (building.productionProgress > 0) return { text: 'Producing...', color: '#4CAF50' };

  return null;
}

// ── Structure key ────────────────────────────────────────────────────────

/** Get a structure key fingerprint for the building's panel layout */
export function getInfoStructureKey(building: Building, getGame: () => Game): string {
  const def = BUILDING_DEFINITIONS[building.type];
  const diag = getStatusDiagnostic(building);
  const parts: string[] = [building.type, String(building.state), 'p:' + building.playerId, 'diag:' + (diag?.text ?? '')];

  // Construction remaining resource keys
  if (building.state === BuildingState.Planned || building.state === BuildingState.UnderConstruction) {
    const remainingKeys = def.cost
      .filter((c) => (building.constructionDelivered[c.resource] ?? 0) < c.amount)
      .map((c) => c.resource)
      .join(',');
    parts.push('cr:' + remainingKeys);
  }

  // Production progress bar visibility (skip for toolQueue buildings)
  if (def.production && building.state === BuildingState.Active && building.toolQueue === undefined) {
    parts.push('pp:' + (building.hasWorker && building.productionProgress > 0 ? '1' : '0'));
  }

  // Geologist prospecting phase
  if (building.type === BuildingType.GeologistHut && building.state === BuildingState.Active) {
    const ws = getGame().getGeologistManager().getWorkState(building.id);
    parts.push('gp:' + (ws?.phase === 'prospecting' ? '1' : '0'));
  }

  // Knight count
  if (def.knightSlots > 0) {
    parts.push('k:' + building.knightIds.length);
  }

  // Inventory resource keys — monotonic: once seen, stays in key even after deletion
  const { inKeys, outKeys } = getStableInventoryKeys(building);
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

  // Hunger state bucket
  if (def.worker) {
    const worker = getGame().getGameState().getWorkerForBuilding(building.id);
    if (worker) {
      const status = getSatiationStatus(worker.satiation);
      parts.push('hs:' + (status || 'ok'));
    }
  }

  // Tool queue state
  if (building.toolQueue !== undefined) {
    const curTool = building.currentToolProduction ?? 'none';
    const nonZero = building.toolQueue.filter(e => e.count > 0).map(e => e.toolType).join(',');
    parts.push(`tq:${curTool}:${nonZero}`);
  }

  // Road quality fingerprint
  const rn = getGame().getRoadNetwork();
  const bFlag = rn.getFlagAt(building.coord.q, building.coord.r);
  if (bFlag) {
    const roadQs = rn.getAllRoads()
      .filter(r => (r.flagA === bFlag.id || r.flagB === bFlag.id) && !r.virtual)
      .map(r => `${r.id}:${r.quality}`).join(',');
    if (roadQs) parts.push('rq:' + roadQs);
  }

  // Trade state fingerprint
  if (canTrade(building)) {
    parts.push(getTradeStructureKey(building));
  }

  // Building-type upgrade state (house upgrades)
  if (def.upgradesTo) {
    let btState = 'idle';
    if (building.activeUpgrade?.axis === BUILDING_TYPE_UPGRADE_AXIS) {
      const cost = def.upgradeCost;
      const allDelivered = cost ? cost.every((c) => {
        const delivered = getInventoryAmount(building.activeUpgrade!.resourcesDelivered, c.resource);
        return delivered >= c.amount;
      }) : true;
      btState = allDelivered ? 'bld' : 'gth';
    }
    parts.push('bt:' + btState);
  }

  return parts.join('|');
}

// ── Quick actions (mobile) ───────────────────────────────────────────────

/** Generate mobile quick action buttons HTML */
export function generateQuickActionsHTML(building: Building, isDesktop: boolean): string {
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

// ── Main HTML generation ─────────────────────────────────────────────────

/** Generate the complete info panel HTML string for a building */
export function generateInfoHTML(building: Building, getGame: () => Game, isDesktop: boolean): string {
  const def = BUILDING_DEFINITIONS[building.type];
  const stateDisplay = getStateDisplay(building.state);

  let html = '';

  // Quick actions row (mobile only)
  html += generateQuickActionsHTML(building, isDesktop);

  // Status & Owner
  const humanPid = getGame().getHumanPlayerId();
  const ownerColor = getPlayerCssColor(building.playerId);
  const ownerLabel = getPlayerLabel(building.playerId, humanPid);
  const diagnostic = getStatusDiagnostic(building);
  html += `<div class="info-section">
    <div class="info-row">
      <span class="info-label">Status</span>
      <span class="info-value ${stateDisplay.cssClass}" data-field="status-label">${stateDisplay.label}</span>
    </div>${diagnostic ? `
    <div class="info-row">
      <span class="info-value" data-field="status-hint" style="font-size:0.75rem;color:${diagnostic.color};padding-left:2px">${diagnostic.text}</span>
    </div>` : ''}
    <div class="info-row">
      <span class="info-label">Owner</span>
      <span class="info-value" data-field="owner-label"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${ownerColor};margin-right:6px;vertical-align:middle"></span>${ownerLabel}</span>
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

  // Housing population info
  if (def.category === 'housing' && building.state === BuildingState.Active) {
    const popMgr = getGame().getPopulationManager();
    const playerId = building.playerId;
    const capacity = def.populationCapacity;
    const totalCap = popMgr.getCapacity(playerId);
    const currentPop = popMgr.getCurrentPopulation(playerId);
    const available = Math.max(0, totalCap - currentPop);
    html += `<div class="info-section">
      <div class="info-section-label">${icon('people')} Population</div>
      <div class="info-row">
        <span class="info-label">This house</span>
        <span class="info-value" data-field="house-capacity">${capacity} residents</span>
      </div>
      <div class="info-row">
        <span class="info-label">Total population</span>
        <span class="info-value" data-field="pop-current">${currentPop} / ${totalCap}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Available slots</span>
        <span class="info-value" data-field="pop-available">${available}</span>
      </div>
    </div>`;
  }

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

  // Production info (skip for toolQueue buildings)
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

  // Tool production queue
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

    // Queue list
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

  // Inventory (input + output) — uses seen keys for stable rendering
  const hasInputs = seenInKeys.size > 0;
  const hasOutputs = seenOutKeys.size > 0;

  if (hasInputs || hasOutputs) {
    html += '<div class="info-section">';
    html += `<div class="info-section-label">${icon('warehouse')} Inventory</div>`;
    if (hasInputs) {
      html += '<div class="info-subsection-label">Input</div>';
      html += formatInventory(building.inputInventory, 'inv-in', seenInKeys);
    }
    if (hasOutputs) {
      html += '<div class="info-subsection-label">Output</div>';
      html += formatInventory(building.outputInventory, 'inv-out', seenOutKeys);
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

  // Building-type upgrade (house upgrades: Small → Medium → Large)
  if (def.upgradesTo && def.upgradeCost && building.state === BuildingState.Active && building.playerId === getGame().getHumanPlayerId()) {
    const targetDef = BUILDING_DEFINITIONS[def.upgradesTo];
    html += '<div class="info-section">';
    html += `<div class="info-section-label">${icon('hammer')} Upgrade Building</div>`;
    html += `<div class="info-row">
      <span class="info-label">Upgrade to</span>
      <span class="info-value" data-field="bt-upgrade-target">${targetDef.label} (${targetDef.populationCapacity} pop)</span>
    </div>`;

    if (building.activeUpgrade?.axis === BUILDING_TYPE_UPGRADE_AXIS) {
      const cost = def.upgradeCost;
      const allDelivered = cost.every((c) => {
        const delivered = getInventoryAmount(building.activeUpgrade!.resourcesDelivered, c.resource);
        return delivered >= c.amount;
      });
      if (!allDelivered) {
        const gatherParts = cost.map((c) => {
          const delivered = getInventoryAmount(building.activeUpgrade!.resourcesDelivered, c.resource);
          return `${delivered}/${c.amount} ${RESOURCE_PROPERTIES[c.resource].label}`;
        });
        html += `<div class="info-row"><span class="info-label">Gathering</span><span class="info-value" data-field="bt-upgrade-gather">${gatherParts.join(', ')}</span></div>`;
      } else {
        const pct = Math.round((building.activeUpgrade.constructionProgress ?? 0) * 100);
        html += `<div class="info-progress-bar"><div class="info-progress-fill info-progress-upgrade" data-field="bt-upgrade-bar" style="width:${pct}%"></div></div>`;
        html += `<div class="info-row"><span class="info-label">Building...</span><span class="info-value" data-field="bt-upgrade-pct">${pct}%</span></div>`;
      }
      html += `<button class="info-upgrade-cancel-btn" data-building-id="${building.id}">Cancel Upgrade</button>`;
    } else if (UpgradeManager.canBuildingUpgrade(building)) {
      const castle = getGame().getGameState().findCastle(building.playerId);
      const canAfford = castle ? def.upgradeCost.every((c) => getInventoryAmount(castle.outputInventory, c.resource) >= c.amount) : false;
      const costStr = def.upgradeCost.map((c) => `${c.amount} ${RESOURCE_PROPERTIES[c.resource].label}`).join(', ');
      html += `<button class="info-upgrade-btn info-building-upgrade-btn" data-building-id="${building.id}"${canAfford ? '' : ' disabled'}>Upgrade to ${targetDef.label} (${costStr})</button>`;
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

  // Trade section (Market and Castle buildings)
  if (canTrade(building) && building.playerId === getGame().getHumanPlayerId()) {
    html += generateTradeHTML(building);
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
