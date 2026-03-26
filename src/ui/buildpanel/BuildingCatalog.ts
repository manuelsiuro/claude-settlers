/**
 * BuildingCatalog — Pure functions for building HTML generation,
 * filtering, cost formatting, and tooltip content.
 */
import { BuildingType, getBuildingsByTier } from '../../game/BuildingType';
import type { BuildingDefinition } from '../../game/BuildingType';
import { BuildingState } from '../../game/Building';
import { RESOURCE_PROPERTIES, ResourceType } from '../../game/ResourceType';
import { resourceIcon, buildingIcon } from '../icons';
import type { Game } from '../../engine/Game';

// ============================================================
// Resource helpers
// ============================================================

/** Get total available resources across Castle + Warehouses for the human player */
export function getPlayerResources(getGame: () => Game): Partial<Record<ResourceType, number>> {
  const totals: Partial<Record<ResourceType, number>> = {};
  const gameState = getGame().getGameState();
  const buildings = gameState.getBuildingsByPlayer(getGame().getHumanPlayerId());
  for (const b of buildings) {
    if (b.type !== BuildingType.Castle && b.type !== BuildingType.Warehouse) continue;
    if (b.state !== BuildingState.Active) continue;
    for (const [res, amount] of Object.entries(b.outputInventory)) {
      if (amount && amount > 0) {
        const r = res as ResourceType;
        totals[r] = (totals[r] ?? 0) + amount;
      }
    }
  }
  return totals;
}

/** Check if the player can afford a building's cost */
export function canAfford(
  def: BuildingDefinition,
  available: Partial<Record<ResourceType, number>>,
): boolean {
  for (const c of def.cost) {
    if ((available[c.resource] ?? 0) < c.amount) return false;
  }
  return true;
}

/** Format cost pills with availability coloring and data-field attributes */
export function formatCost(
  def: BuildingDefinition,
  available: Partial<Record<ResourceType, number>>,
  compact = false,
): string {
  const style = compact ? ' style="font-size:0.625rem;padding:1px 6px;"' : '';
  if (def.cost.length === 0) return `<span class="cost-pill cost-pill-free"${style}>Free</span>`;
  return def.cost
    .map((c) => {
      const have = available[c.resource] ?? 0;
      const ok = have >= c.amount;
      const cssClass = ok ? 'cost-pill cost-pill-ok' : 'cost-pill cost-pill-short';
      const label = compact ? '' : ` ${RESOURCE_PROPERTIES[c.resource].label}`;
      return `<span class="${cssClass}"${style} data-field="cost-${def.type}-${c.resource}">${resourceIcon(c.resource)}${label} ${c.amount}</span>`;
    })
    .join(compact ? '' : ' ');
}

/** Format production recipe summary */
export function formatProductionSummary(def: BuildingDefinition): string {
  if (!def.production) {
    if (def.category === 'military') return '<span class="production-flow">Houses knights</span>';
    if (def.type === BuildingType.Warehouse) return '<span class="production-flow">Stores goods</span>';
    if (def.type === BuildingType.ForesterHut) return '<span class="production-flow">Plants trees</span>';
    return '';
  }
  const inputs = def.production.inputs.map(
    (i) => `${resourceIcon(i.resource)} ${RESOURCE_PROPERTIES[i.resource].label}`,
  );
  const outputs = def.production.outputs.map(
    (o) => `${resourceIcon(o.resource)} ${RESOURCE_PROPERTIES[o.resource].label}`,
  );
  if (inputs.length === 0) {
    return `<span class="production-flow">Produces ${outputs.join(', ')}</span>`;
  }
  return `<div class="production-chain">
    <span class="production-inputs">${inputs.join('<span class="production-plus">+</span>')}</span>
    <span class="production-arrow">\u2192</span>
    <span class="production-outputs">${outputs.join(', ')}</span>
  </div>`;
}

// ============================================================
// Tooltip
// ============================================================

/** Generate tooltip HTML for a building definition */
export function generateTooltipContent(
  def: BuildingDefinition,
  available: Partial<Record<ResourceType, number>>,
): string {
  const prodSummary = formatProductionSummary(def);
  const milInfo = def.knightSlots > 0
    ? `<div class="build-item-section"><span class="build-item-section-label">Military</span><div class="build-item-section-content"><span class="build-item-military">${def.knightSlots} knight slot${def.knightSlots > 1 ? 's' : ''} \u00b7 range ${def.influenceRadius}</span></div></div>`
    : '';
  return `
    <div class="build-tooltip-name">${def.label}</div>
    <div class="build-tooltip-desc">${def.description}</div>
    <div class="build-item-section">
      <span class="build-item-section-label">Cost</span>
      <div class="build-item-section-content">${formatCost(def, available)}</div>
    </div>
    ${prodSummary ? `<div class="build-item-section"><span class="build-item-section-label">Production</span><div class="build-item-section-content">${prodSummary}</div></div>` : ''}
    ${milInfo}
  `;
}

// ============================================================
// Build HTML generation
// ============================================================

/** Generate the build panel HTML string (grid of tiles) */
export function generateBuildHTML(
  buildFilterCategory: string,
  isDesktop: boolean,
  expandedTileType: BuildingType | null,
  available: Partial<Record<ResourceType, number>>,
): string {
  const tiers = [
    { tier: 1, label: 'Basic' },
    { tier: 2, label: 'Advanced' },
    { tier: 3, label: 'Specialized' },
  ];

  let html = '<div class="build-grid">';

  // Logistics section
  const showLogistics = buildFilterCategory === 'all' || buildFilterCategory === 'logistics';
  if (showLogistics) {
    html += `<div class="build-grid-tier-label"><span class="tier-badge tier-badge-logistics">LOG</span> Logistics</div>`;
    html += `<button class="build-tile" data-action="place-flag">
      <span class="build-tile-name">Flag</span>
      <div class="build-tile-cost"><span class="cost-pill cost-pill-free" style="font-size:0.625rem;padding:1px 6px;">Free</span></div>
    </button>`;
    html += `<button class="build-tile" data-action="build-road">
      <span class="build-tile-name">Road</span>
      <div class="build-tile-cost"><span class="cost-pill cost-pill-free" style="font-size:0.625rem;padding:1px 6px;">Free</span></div>
    </button>`;
  }

  for (const { tier, label } of tiers) {
    const buildings = getBuildingsByTier(tier).filter((def) => {
      if (buildFilterCategory === 'all') return true;
      return def.category === buildFilterCategory;
    });
    if (buildings.length === 0) continue;

    html += `<div class="build-grid-tier-label"><span class="tier-badge tier-badge-${tier}">${tier}</span> ${label}</div>`;

    for (const def of buildings) {
      const affordable = canAfford(def, available);
      const tileClass = affordable ? 'build-tile' : 'build-tile build-tile-disabled';
      html += `<button class="${tileClass}" data-field="build-${def.type}" data-building-type="${def.type}">
        <div class="build-tile-thumb">${buildingIcon(def.type, 48)}</div>
        <span class="build-tile-name">${def.label}</span>
        <div class="build-tile-cost">${formatCost(def, available, true)}</div>
      </button>`;

      // Mobile: expanded detail after this tile
      if (!isDesktop && expandedTileType === def.type) {
        html += generateExpandedDetailHTML(def, available, affordable);
      }
    }
  }

  html += '</div>';
  return html;
}

/** Generate the expanded inline detail (mobile only) */
function generateExpandedDetailHTML(
  def: BuildingDefinition,
  available: Partial<Record<ResourceType, number>>,
  affordable: boolean,
): string {
  const prodSummary = formatProductionSummary(def);
  const milInfo = def.knightSlots > 0
    ? `<div class="build-item-section"><span class="build-item-section-label">Military</span><div class="build-item-section-content"><span class="build-item-military">${def.knightSlots} knight slot${def.knightSlots > 1 ? 's' : ''} \u00b7 range ${def.influenceRadius}</span></div></div>`
    : '';

  return `<div class="build-tile-expanded">
    <div class="build-tile-expanded-name">${buildingIcon(def.type, 24)} ${def.label}</div>
    <div class="build-tile-expanded-desc">${def.description}</div>
    <div class="build-item-section">
      <span class="build-item-section-label">Cost</span>
      <div class="build-item-section-content">${formatCost(def, available)}</div>
    </div>
    ${prodSummary ? `<div class="build-item-section"><span class="build-item-section-label">Production</span><div class="build-item-section-content">${prodSummary}</div></div>` : ''}
    ${milInfo}
    <button class="build-tile-place-btn" data-building-type="${def.type}" ${!affordable ? 'disabled' : ''}>Place ${def.label}</button>
  </div>`;
}

/** Update affordability classes without rebuilding DOM */
export function updateBuildValues(
  buildFilterCategory: string,
  available: Partial<Record<ResourceType, number>>,
  updater: { setClass(field: string, cls: string): void },
): void {
  const tiers = [1, 2, 3];
  for (const tier of tiers) {
    const buildings = getBuildingsByTier(tier).filter((def) => {
      if (buildFilterCategory === 'all') return true;
      return def.category === buildFilterCategory;
    });
    for (const def of buildings) {
      const affordable = canAfford(def, available);
      updater.setClass(`build-${def.type}`, affordable ? 'build-tile' : 'build-tile build-tile-disabled');
      for (const c of def.cost) {
        const have = available[c.resource] ?? 0;
        const ok = have >= c.amount;
        updater.setClass(`cost-${def.type}-${c.resource}`, ok ? 'cost-pill cost-pill-ok' : 'cost-pill cost-pill-short');
      }
    }
  }
}
