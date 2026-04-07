import type { Game } from '../engine/Game';
import type { Building } from '../game/Building';
import { BuildingState, addToInventory } from '../game/Building';
import { BUILDING_DEFINITIONS } from '../game/BuildingType';
import { RESOURCE_PROPERTIES, ResourceType } from '../game/ResourceType';
import { resourceIcon } from './icons';
import { closeInfoPanel } from './InfoPanel';
import { showSnackbar } from './Snackbar';

let getGame: () => Game;
let overlay: HTMLElement;
let contentEl: HTMLElement;
let confirmBtn: HTMLElement;
let cancelBtn: HTMLElement;

let pendingBuilding: Building | null = null;

export function initDemolishDialog(getGameFn: () => Game): void {
  getGame = getGameFn;
  overlay = document.getElementById('demolish-overlay')!;
  contentEl = document.getElementById('demolish-content')!;
  confirmBtn = document.getElementById('demolish-confirm-btn')!;
  cancelBtn = document.getElementById('demolish-cancel-btn')!;

  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleCancel();
  });
}

/** Calculate what resources would be refunded */
function calcRefund(building: Building): { resource: ResourceType; amount: number }[] {
  const def = BUILDING_DEFINITIONS[building.type];

  if (building.state === BuildingState.Active) {
    // 50% of build cost
    const refund: { resource: ResourceType; amount: number }[] = [];
    for (const cost of def.cost) {
      const amount = Math.floor(cost.amount * 0.5);
      if (amount > 0) refund.push({ resource: cost.resource, amount });
    }
    return refund;
  }

  // Planned / UnderConstruction: 100% of what was delivered
  const refund: { resource: ResourceType; amount: number }[] = [];
  for (const cost of def.cost) {
    const delivered = building.constructionDelivered[cost.resource] ?? 0;
    if (delivered > 0) refund.push({ resource: cost.resource, amount: delivered });
  }
  return refund;
}

export function showDemolishConfirm(building: Building): void {
  pendingBuilding = building;

  const def = BUILDING_DEFINITIONS[building.type];
  const refund = calcRefund(building);

  let html = `<p class="demolish-building-name">${def.label}</p>`;
  if (refund.length > 0) {
    html += '<p class="demolish-refund-label">Resources refunded:</p>';
    for (const r of refund) {
      const props = RESOURCE_PROPERTIES[r.resource];
      html += `<div class="demolish-refund-row">${resourceIcon(r.resource)} <span>${props.label}</span> <span class="demolish-refund-amount">&times;${r.amount}</span></div>`;
    }
  } else {
    html += '<p class="demolish-refund-label">No resources will be refunded.</p>';
  }

  contentEl.innerHTML = html;
  overlay.classList.remove('hidden');
}

function handleConfirm(): void {
  if (!pendingBuilding) return;
  const game = getGame();
  const building = pendingBuilding;
  pendingBuilding = null;

  // Play destroy animation if mesh exists
  const mesh = game.getBuildingRenderer().getMesh(building.id);
  if (mesh) {
    game.getBuildingAnimator().startDestroyAnimation(building.id, mesh);
    game.getBuildingRenderer().forgetBuilding(building.id);
  }

  // Demolish via command system — returns refund array in result.data
  const result = game.executeCommand({
    type: 'DemolishBuilding',
    playerId: game.getHumanPlayerId(),
    buildingId: building.id,
  });
  const refund = (result.success ? result.data : []) as { resource: ResourceType; amount: number }[];

  // Add refunded resources to Castle
  const castle = game.getGameState().findCastle(building.playerId);
  if (castle && refund.length > 0) {
    for (const r of refund) {
      addToInventory(castle.outputInventory, r.resource, r.amount);
    }
  }

  // Deselect and close panels
  game.getSelectionController()?.deselect();
  closeInfoPanel();

  // Snackbar feedback
  if (refund.length > 0) {
    const parts = refund.map((r) => `${r.amount} ${RESOURCE_PROPERTIES[r.resource].label}`);
    showSnackbar(`Building demolished. Refunded: ${parts.join(', ')}`, 'success');
  } else {
    showSnackbar('Building demolished.', 'success');
  }

  hide();
}

function handleCancel(): void {
  pendingBuilding = null;
  hide();
}

function hide(): void {
  overlay.classList.add('hidden');
}
