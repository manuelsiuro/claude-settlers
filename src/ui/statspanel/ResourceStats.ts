import { RESOURCE_PROPERTIES, ResourceType, TOOL_TYPES } from '../../game/ResourceType';
import { resourceIcon } from '../icons';
import type { PanelUpdater } from '../PanelUpdater';

const RAW_RESOURCES = [
  ResourceType.Wood, ResourceType.Stone, ResourceType.Grain,
  ResourceType.Fish, ResourceType.IronOre, ResourceType.CoalOre, ResourceType.GoldOre,
  ResourceType.Grapes, ResourceType.Fruit, ResourceType.WaterBarrel,
  ResourceType.Milk, ResourceType.Hay, ResourceType.Wool, ResourceType.RawLeather,
  ResourceType.Cattle, ResourceType.Horses,
];
const PROCESSED_RESOURCES = [
  ResourceType.Planks, ResourceType.Flour, ResourceType.Bread,
  ResourceType.Meat, ResourceType.IronBars, ResourceType.GoldBars,
  ResourceType.Swords, ResourceType.Shields,
  ResourceType.Wine, ResourceType.Beer, ResourceType.Cheese,
  ResourceType.Cloth, ResourceType.WorkedLeather,
  ResourceType.Arrows, ResourceType.Bow, ResourceType.SiegeRam,
  ...TOOL_TYPES,
];
const ALL_RESOURCES = [...RAW_RESOURCES, ...PROCESSED_RESOURCES];

export { ALL_RESOURCES };

/** Generate HTML for the resources tab */
export function generateResourcesHTML(resources: Partial<Record<ResourceType, number>>): string {
  let html = '<div class="info-section"><div class="info-section-label">Raw Materials</div>';
  for (const r of RAW_RESOURCES) {
    const amount = resources[r] ?? 0;
    const zeroClass = amount === 0 ? ' resource-pill-zero' : '';
    html += `<div class="info-resource-row">
        <span class="info-resource-name">${resourceIcon(r)} ${RESOURCE_PROPERTIES[r].label}</span>
        <span data-field="res-${r}" class="resource-pill${zeroClass}">${amount}</span>
      </div>`;
  }
  html += '</div>';

  html += '<div class="info-section"><div class="info-section-label">Processed Goods</div>';
  for (const r of PROCESSED_RESOURCES) {
    const amount = resources[r] ?? 0;
    const zeroClass = amount === 0 ? ' resource-pill-zero' : '';
    html += `<div class="info-resource-row">
        <span class="info-resource-name">${resourceIcon(r)} ${RESOURCE_PROPERTIES[r].label}</span>
        <span data-field="res-${r}" class="resource-pill${zeroClass}">${amount}</span>
      </div>`;
  }
  html += '</div>';

  return html;
}

/** Update resource values without rebuilding DOM */
export function updateResourceValues(
  resources: Partial<Record<ResourceType, number>>,
  updater: PanelUpdater,
): void {
  for (const r of ALL_RESOURCES) {
    const amount = resources[r] ?? 0;
    updater.setText(`res-${r}`, `${amount}`);
    updater.setClass(`res-${r}`, `resource-pill${amount === 0 ? ' resource-pill-zero' : ''}`);
  }
}

/** Get the structure key part for the resources tab (always empty — no structural changes) */
export function getResourcesStructureKey(): string {
  return '';
}

/** Get the total resource count for badge display */
export function getResourcesTotal(resources: Partial<Record<ResourceType, number>>): number {
  return Object.values(resources).reduce((s, v) => s + (v ?? 0), 0);
}
