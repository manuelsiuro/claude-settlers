/**
 * Value update functions for the InfoPanel.
 * Patches DOM values via PanelUpdater data-field attributes without rebuilding the DOM.
 */
import type { Game } from '../../engine/Game';
import { BuildingType, BUILDING_DEFINITIONS } from '../../game/BuildingType';
import { BuildingState, getInventoryAmount, getInventoryTotal } from '../../game/Building';
import type { Building } from '../../game/Building';
import { RESOURCE_PROPERTIES, ResourceType } from '../../game/ResourceType';
import { getDistanceMultiplier } from '../../game/ProductionManager';
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
import {
  getSatiationColor,
  getSatiationStatus,
} from '../../game/data/balanceConstants';
import { PanelUpdater } from '../PanelUpdater';
import {
  canTrade,
  updateTradeValues,
} from '../TradePanel';
import { getSeenInventoryKeys } from './BuildingInfoRenderer';
import { UpgradeManager, BUILDING_TYPE_UPGRADE_AXIS } from '../../game/UpgradeManager';

/** Update dynamic values without rebuilding DOM */
export function updateInfoValues(
  building: Building,
  updater: PanelUpdater,
  getGame: () => Game,
  infoPanelContent: HTMLElement,
): void {
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

  // Production (skip for toolQueue buildings)
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

  // Inventory amounts + row visibility (seen keys may include deleted inventory entries)
  const seen = getSeenInventoryKeys();
  for (const key of seen.input) {
    const amount = building.inputInventory[key as ResourceType] ?? 0;
    updater.setText(`inv-in-${key}`, `${amount}`);
    updater.setDisplay(`inv-in-row-${key}`, amount > 0);
  }
  for (const key of seen.output) {
    const amount = building.outputInventory[key as ResourceType] ?? 0;
    updater.setText(`inv-out-${key}`, `${amount}`);
    updater.setDisplay(`inv-out-row-${key}`, amount > 0);
  }

  // Capacity
  const hasInventory = seen.input.size > 0 || seen.output.size > 0;
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

  // Housing population
  if (def.category === 'housing' && building.state === BuildingState.Active) {
    const popMgr = getGame().getPopulationManager();
    const playerId = building.playerId;
    const totalCap = popMgr.getCapacity(playerId);
    const currentPop = popMgr.getCurrentPopulation(playerId);
    const available = popMgr.getAvailableSlots(playerId);
    updater.setText('pop-current', `${currentPop} / ${totalCap}`);
    updater.setText('pop-available', `${available}`);
  }

  // Building-type upgrade progress (house upgrades)
  if (def.upgradesTo && def.upgradeCost && building.activeUpgrade?.axis === BUILDING_TYPE_UPGRADE_AXIS) {
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
      updater.setText('bt-upgrade-gather', gatherParts.join(', '));
    } else {
      const pct = Math.round((building.activeUpgrade.constructionProgress ?? 0) * 100);
      updater.setWidth('bt-upgrade-bar', `${pct}%`);
      updater.setText('bt-upgrade-pct', `${pct}%`);
    }
  } else if (def.upgradesTo && def.upgradeCost && UpgradeManager.canBuildingUpgrade(building)) {
    const castle = getGame().getGameState().findCastle(building.playerId);
    const canAfford = castle ? def.upgradeCost.every((c) => getInventoryAmount(castle.outputInventory, c.resource) >= c.amount) : false;
    const btn = infoPanelContent.querySelector('.info-building-upgrade-btn') as HTMLButtonElement | null;
    if (btn) btn.disabled = !canAfford;
  }

  // Trade value updates
  if (canTrade(building) && building.playerId === getGame().getHumanPlayerId()) {
    updateTradeValues(building, updater);
  }
}
