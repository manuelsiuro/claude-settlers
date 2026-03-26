/**
 * Road and Flag info HTML generation for the InfoPanel.
 * Generates the detail view for flags with their connected roads and upgrade controls.
 */
import type { Game } from '../../engine/Game';
import { BUILDING_DEFINITIONS } from '../../game/BuildingType';
import { getInventoryAmount } from '../../game/Building';
import { RESOURCE_PROPERTIES } from '../../game/ResourceType';
import {
  ROAD_QUALITY_NAMES,
  getRoadUpgradeCost,
} from '../../game/data/balanceConstants';
import type { Flag } from '../../game/RoadNetwork';

/** Generate HTML for a flag's connected roads with upgrade buttons */
export function generateFlagInfoHTML(flag: Flag, getGame: () => Game): string {
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
