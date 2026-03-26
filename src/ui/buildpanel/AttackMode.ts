/**
 * AttackMode — Attack targeting logic with isolated module state.
 */
import { BUILDING_DEFINITIONS } from '../../game/BuildingType';
import { showSnackbar } from '../Snackbar';
import type { Game } from '../../engine/Game';

/** Dependencies injected at init time */
interface AttackModeDeps {
  getGame: () => Game;
  closeInfoPanel: () => void;
  closeBuildPanel: () => void;
  closeStatsPanel: () => void;
  cancelPlacement: () => void;
  cancelRoadPlacement: () => void;
  getPlacementBarEl: () => HTMLElement;
  getPlacementLabelEl: () => HTMLElement;
}

/** Module state */
let deps: AttackModeDeps;
let attackSourceBuildingId: string | null = null;
let attackModeCleanup: (() => void) | null = null;

/** Initialize attack mode with its dependencies */
export function initAttackMode(d: AttackModeDeps): void {
  deps = d;
}

/** Cancel attack targeting if active */
export function cancelAttackTargeting(): void {
  if (attackModeCleanup) {
    attackModeCleanup();
    attackModeCleanup = null;
  }
}

/** Enter attack targeting mode */
export function startAttackTargeting(sourceBuildingId: string): void {
  cancelAttackTargeting();

  attackSourceBuildingId = sourceBuildingId;
  deps.closeInfoPanel();
  deps.closeBuildPanel();
  deps.closeStatsPanel();
  deps.cancelPlacement();
  deps.cancelRoadPlacement();
  deps.getPlacementLabelEl().textContent = 'Attack — click an enemy military building (Esc to cancel)';
  deps.getPlacementBarEl().classList.remove('hidden');

  const selection = deps.getGame().getSelectionController();
  if (!selection) return;

  const originalHandler = selection.onSelectionChanged;

  const onEscape = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      cancelAttackTargeting();
    }
  };
  window.addEventListener('keydown', onEscape);

  const cleanup = (): void => {
    attackSourceBuildingId = null;
    attackModeCleanup = null;
    deps.getPlacementBarEl().classList.add('hidden');
    window.removeEventListener('keydown', onEscape);
    selection.onSelectionChanged = originalHandler;
    selection.deselect();
  };
  attackModeCleanup = cleanup;

  selection.onSelectionChanged = (building) => {
    const humanId = deps.getGame().getHumanPlayerId();
    if (building && building.playerId !== humanId) {
      const def = BUILDING_DEFINITIONS[building.type];
      if (def.knightSlots > 0) {
        executeAttack(attackSourceBuildingId!, building.id);
      } else {
        showSnackbar('Can only attack military buildings');
      }
    } else if (building && building.playerId === humanId) {
      showSnackbar('Cannot attack your own buildings');
    }

    cancelAttackTargeting();
  };
}

/** Execute attack */
function executeAttack(sourceBuildingId: string, targetBuildingId: string): void {
  const gameState = deps.getGame().getGameState();
  const source = gameState.getBuilding(sourceBuildingId);
  if (!source || source.knightIds.length === 0) {
    showSnackbar('No knights available');
    return;
  }

  const knightId = source.knightIds[0];
  const attackMgr = deps.getGame().getAttackManager();
  const success = attackMgr.orderAttack(knightId, targetBuildingId);
  if (success) {
    showSnackbar('Attack ordered!', 'warning');
  } else {
    showSnackbar('Cannot attack this building', 'error');
  }
}

/** Whether attack mode cleanup is currently active */
export function isAttackModeActive(): boolean {
  return attackModeCleanup !== null;
}
