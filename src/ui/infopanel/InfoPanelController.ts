/**
 * InfoPanel controller — orchestrates building/flag/road info display.
 * Manages panel lifecycle (init, show, close, updates), event delegation,
 * and mobile bottom sheet integration.
 */
import type { Game } from '../../engine/Game';
import { buildingIcon } from '../icons';
import { BUILDING_DEFINITIONS } from '../../game/BuildingType';
import { getInventoryAmount } from '../../game/Building';
import type { Building } from '../../game/Building';
import { ResourceType } from '../../game/ResourceType';
import { UpgradeAxis } from '../../game/BuildingUpgrade';
import { startAttackTargeting, isAttackModeActive } from '../BuildPanel';
import { showDemolishConfirm } from '../DemolishDialog';
import { PanelUpdater } from '../PanelUpdater';
import type { Flag } from '../../game/RoadNetwork';
import { getRoadUpgradeCost } from '../../game/data/balanceConstants';
import { BottomSheetController } from '../BottomSheetController';
import {
  initTradePanel, canTrade,
  handleTradeClick, handleTradeChange, resetTradeState,
} from '../TradePanel';

import { getInfoStructureKey, generateInfoHTML } from './BuildingInfoRenderer';
import { generateFlagInfoHTML } from './RoadInfoRenderer';
import { updateInfoValues } from './InfoPanelValues';

// ── Module state ─────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────

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

/** Convenience: run updater with building renderers */
function updateBuilding(building: Building): void {
  updater.update(
    getInfoStructureKey(building, getGame),
    () => generateInfoHTML(building, getGame, isDesktop),
    () => updateInfoValues(building, updater, getGame, infoPanelContent),
  );
}

// ── Public API ───────────────────────────────────────────────────────────

export function initInfoPanel(
  getGameFn: () => Game,
  closeBuildPanel: () => void,
  closeStatsPanel: () => void,
): void {
  getGame = getGameFn;
  closeBuildPanelFn = closeBuildPanel;
  closeStatsPanelFn = closeStatsPanel;
  initTradePanel(getGameFn);

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
          updateBuilding(bld);
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
          updateBuilding(building);
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
          updateBuilding(building);
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

    // Trade panel click events
    const selectedBuilding = getSelectedBuilding();
    if (selectedBuilding && canTrade(selectedBuilding)) {
      if (handleTradeClick(e.target as HTMLElement, selectedBuilding)) {
        updater.reset();
        updateBuilding(selectedBuilding);
        return;
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

  // Change event for trade resource selectors
  infoPanelContent.addEventListener('change', (e) => {
    if (handleTradeChange(e.target as HTMLElement)) {
      const sel = getSelectedBuilding();
      if (sel) {
        updater.reset();
        updateBuilding(sel);
      }
    }
  });
}

/** Show the info panel for a building and start live updates */
export function showInfoPanel(building: Building): void {
  selectedBuildingId = building.id;
  const def = BUILDING_DEFINITIONS[building.type];
  infoPanelTitle.innerHTML = `${buildingIcon(building.type, 24)} ${def.label}`;
  updater.reset();
  updateBuilding(building);

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
      updateBuilding(current);
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
    resetTradeState();
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

/** Show the info panel for a flag (road info + upgrade controls) */
export function showFlagInfoPanel(flag: Flag): void {
  selectedBuildingId = null;
  infoPanelTitle.textContent = 'Flag';
  updater.reset();
  updater.update(
    `flag:${flag.id}:${flag.goods.length}`,
    () => generateFlagInfoHTML(flag, getGame),
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
        () => generateFlagInfoHTML(currentFlag, getGame),
        () => {
          updater.setText('flag-goods', `${currentFlag.goods.length}/8`);
        },
      );
    } else {
      closeInfoPanel();
    }
  }, 500);
}
