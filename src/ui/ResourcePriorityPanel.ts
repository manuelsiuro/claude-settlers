import type { Game } from '../engine/Game';
import { RESOURCE_PROPERTIES, ResourceType, TOOL_TYPES } from '../game/ResourceType';
import {
  getResourceCategoryWeights,
  setResourceCategoryWeights,
  createDefaultDistribution,
  getBuildingImportance,
  setBuildingImportance,
} from '../game/GoodsDistribution';
import type { CategoryWeights } from '../game/GoodsDistribution';
import { BuildingState } from '../game/Building';
import type { Building } from '../game/Building';
import { BUILDING_DEFINITIONS } from '../game/BuildingType';
import { resourceIcon, icon, buildingIcon } from './icons';

/** All resource types in display order */
const ALL_RESOURCES: ResourceType[] = [
  // Core raw materials
  ResourceType.Wood, ResourceType.Stone, ResourceType.Planks,
  ResourceType.Grain, ResourceType.Fish, ResourceType.Flour,
  ResourceType.Bread, ResourceType.Meat,
  // Expansion raw
  ResourceType.Grapes, ResourceType.Fruit, ResourceType.WaterBarrel,
  ResourceType.Milk, ResourceType.Hay, ResourceType.Wool, ResourceType.RawLeather,
  // Ores & metals
  ResourceType.IronOre, ResourceType.CoalOre, ResourceType.GoldOre,
  ResourceType.IronBars, ResourceType.GoldBars,
  // Military
  ResourceType.Swords, ResourceType.Shields,
  ResourceType.Arrows, ResourceType.Bow, ResourceType.SiegeRam,
  // Expansion processed
  ResourceType.Wine, ResourceType.Beer, ResourceType.Cheese,
  ResourceType.Cloth, ResourceType.WorkedLeather,
  // Tools
  ...TOOL_TYPES,
  // Animals
  ResourceType.Pigs, ResourceType.Cattle, ResourceType.Horses,
];

const CATEGORY_META: Record<keyof CategoryWeights, { label: string; colorClass: string }> = {
  production: { label: 'Production', colorClass: 'priority-cat-production' },
  construction: { label: 'Construction', colorClass: 'priority-cat-construction' },
  storage: { label: 'Storage', colorClass: 'priority-cat-storage' },
};

interface ConsumingBuilding {
  building: Building;
  label: string;
  otherInputs: ResourceType[];
}

/** Get human player's active buildings that consume a given resource */
function getConsumingBuildings(game: Game, resource: ResourceType): ConsumingBuilding[] {
  const humanId = game.getHumanPlayerId();
  const allBuildings = game.getGameState().getBuildingsByPlayer(humanId);
  const active = allBuildings.filter(b => b.state === BuildingState.Active);

  // Group by type to generate instance labels
  const byType = new Map<string, Building[]>();
  for (const b of active) {
    const def = BUILDING_DEFINITIONS[b.type];
    if (!def.production?.inputs.some(inp => inp.resource === resource)) continue;
    const arr = byType.get(b.type) ?? [];
    arr.push(b);
    byType.set(b.type, arr);
  }

  const result: ConsumingBuilding[] = [];
  for (const [type, buildings] of byType) {
    const def = BUILDING_DEFINITIONS[type as keyof typeof BUILDING_DEFINITIONS];
    const otherInputs = def.production!.inputs
      .filter(inp => inp.resource !== resource)
      .map(inp => inp.resource);

    for (let i = 0; i < buildings.length; i++) {
      const label = buildings.length > 1
        ? `${def.label} #${i + 1}`
        : def.label;
      result.push({ building: buildings[i], label, otherInputs });
    }
  }
  return result;
}

/** Generate importance dots HTML for a building */
function renderImportanceDots(buildingId: string, importance: number): string {
  let dots = '';
  for (let i = 1; i <= 5; i++) {
    const filled = i <= importance ? ' filled' : '';
    dots += `<span class="priority-importance-dot${filled}" data-building-id="${buildingId}" data-importance="${i}"></span>`;
  }
  return `<span class="priority-importance-dots">${dots}</span>`;
}

/** Returns HTML string for the priority panel (no DOM mutation) */
export function renderPriorityHTML(game: Game): string {
  const settings = game.getDistributionSettings();

  // Show resources that have economy activity or non-default weights
  const tracker = game.getEconomyTracker();
  const activeResources = new Set(tracker.getActiveResources());
  const relevantResources = ALL_RESOURCES.filter(r =>
    activeResources.has(r) || settings.resourceCategoryWeights[r] != null,
  );

  // If no resources active yet, show core building resources
  const displayResources = relevantResources.length > 0
    ? relevantResources
    : [ResourceType.Wood, ResourceType.Stone, ResourceType.Planks];

  let html = '';

  // Legend
  html += `<div class="priority-legend">
    <span class="priority-legend-item"><span class="priority-legend-dot priority-dot-production"></span>Prod</span>
    <span class="priority-legend-item"><span class="priority-legend-dot priority-dot-construction"></span>Build</span>
    <span class="priority-legend-item"><span class="priority-legend-dot priority-dot-storage"></span>Store</span>
  </div>`;

  for (const r of displayResources) {
    const w = getResourceCategoryWeights(settings, r);
    const props = RESOURCE_PROPERTIES[r];

    html += `<div class="priority-resource-card" data-resource="${r}">
      <div class="priority-card-header">
        <span class="priority-card-name">${resourceIcon(r, 18)} ${props.label}</span>
      </div>
      <div class="priority-stacked-bar">
        <div class="priority-bar-seg priority-seg-production" style="width:${w.production}%"></div>
        <div class="priority-bar-seg priority-seg-construction" style="width:${w.construction}%"></div>
        <div class="priority-bar-seg priority-seg-storage" style="width:${w.storage}%"></div>
      </div>`;

    for (const cat of ['production', 'construction', 'storage'] as const) {
      const meta = CATEGORY_META[cat];
      html += `<div class="priority-slider-row">
        <span class="priority-cat-label ${meta.colorClass}">${meta.label}</span>
        <input type="range" class="priority-slider priority-slider-${cat}" data-category="${cat}" min="0" max="100" value="${w[cat]}">
        <span class="priority-percentage" data-category="${cat}">${w[cat]}%</span>
      </div>`;
    }

    // Building importance section
    const consumers = getConsumingBuildings(game, r);
    if (consumers.length > 0) {
      html += `<div class="priority-building-toggle" data-resource-toggle="${r}">
        <span class="priority-building-chevron">${icon('chevron_right', 'priority-chevron-icon')}</span>
        <span>Target Buildings (${consumers.length})</span>
      </div>
      <div class="priority-building-list" data-resource-list="${r}">`;

      for (const c of consumers) {
        const imp = getBuildingImportance(settings, c.building.id);
        html += `<div class="priority-building-row">
          <div class="priority-building-name-col">
            <span class="priority-building-name">${buildingIcon(c.building.type, 16)} ${c.label}</span>
            ${c.otherInputs.length > 0 ? `<span class="priority-building-hint">also uses: ${c.otherInputs.map(r2 => RESOURCE_PROPERTIES[r2].label).join(', ')}</span>` : ''}
          </div>
          ${renderImportanceDots(c.building.id, imp)}
        </div>`;
      }

      html += `</div>`;
    }

    html += `</div>`;
  }

  html += `<button class="btn-outlined priority-reset-btn">Reset to Defaults</button>`;

  return html;
}

/** Attaches event listeners to already-rendered priority content */
export function attachPriorityListeners(contentEl: HTMLElement, game: Game): void {
  const settings = game.getDistributionSettings();

  // Attach slider event listeners
  const cards = contentEl.querySelectorAll<HTMLElement>('.priority-resource-card');
  for (const card of cards) {
    const resource = card.dataset.resource as ResourceType;
    const sliders = card.querySelectorAll<HTMLInputElement>('.priority-slider');
    const percentages = card.querySelectorAll<HTMLElement>('.priority-percentage');
    const barSegs = card.querySelectorAll<HTMLElement>('.priority-bar-seg');

    for (const slider of sliders) {
      slider.addEventListener('input', () => {
        const category = slider.dataset.category as keyof CategoryWeights;
        const newVal = Number(slider.value);

        // Get current weights
        const current = getResourceCategoryWeights(settings, resource);
        const updated = { ...current };
        updated[category] = newVal;

        // Redistribute remaining to other two categories proportionally
        const remaining = 100 - newVal;
        const otherKeys = (['production', 'construction', 'storage'] as const).filter(k => k !== category);
        const otherSum = otherKeys.reduce((s, k) => s + current[k], 0);

        if (otherSum > 0) {
          for (const k of otherKeys) {
            updated[k] = Math.round((current[k] / otherSum) * remaining);
          }
        } else {
          updated[otherKeys[0]] = remaining;
          updated[otherKeys[1]] = 0;
        }

        // Fix rounding errors
        const sum = updated.production + updated.construction + updated.storage;
        if (sum !== 100) {
          updated[otherKeys[0]] += 100 - sum;
        }

        // Apply
        setResourceCategoryWeights(settings, resource, updated);
        game.setDistributionSettings(settings);

        // Update all slider and label values in this card
        for (const s of sliders) {
          const cat = s.dataset.category as keyof CategoryWeights;
          s.value = String(updated[cat]);
        }
        for (const p of percentages) {
          const cat = p.dataset.category as keyof CategoryWeights;
          p.textContent = `${updated[cat]}%`;
        }
        // Update stacked bar
        const segOrder: (keyof CategoryWeights)[] = ['production', 'construction', 'storage'];
        barSegs.forEach((seg, i) => {
          seg.style.width = `${updated[segOrder[i]]}%`;
        });
      });
    }
  }

  // Building toggle expand/collapse
  const toggles = contentEl.querySelectorAll<HTMLElement>('.priority-building-toggle');
  for (const toggle of toggles) {
    toggle.addEventListener('click', () => {
      const res = toggle.dataset.resourceToggle!;
      const list = contentEl.querySelector<HTMLElement>(`[data-resource-list="${res}"]`);
      if (!list) return;
      const expanded = list.classList.toggle('expanded');
      toggle.classList.toggle('expanded', expanded);
    });
  }

  // Building importance dot clicks (event delegation)
  contentEl.addEventListener('click', (e) => {
    const dot = (e.target as HTMLElement).closest<HTMLElement>('.priority-importance-dot');
    if (!dot) return;
    const buildingId = dot.dataset.buildingId!;
    const importance = Number(dot.dataset.importance);

    setBuildingImportance(settings, buildingId, importance);
    game.setDistributionSettings(settings);

    // Update all dot rows for this building across all resource cards
    const allDots = contentEl.querySelectorAll<HTMLElement>(`.priority-importance-dot[data-building-id="${buildingId}"]`);
    for (const d of allDots) {
      const val = Number(d.dataset.importance);
      d.classList.toggle('filled', val <= importance);
    }
  });

  // Reset button
  const resetBtn = contentEl.querySelector('.priority-reset-btn');
  resetBtn?.addEventListener('click', () => {
    const defaults = createDefaultDistribution();
    settings.resourceCategoryWeights = defaults.resourceCategoryWeights;
    settings.buildingImportance = new Map();
    game.setDistributionSettings(settings);
    contentEl.innerHTML = renderPriorityHTML(game);
    attachPriorityListeners(contentEl, game);
  });
}

/** Legacy wrapper: sets innerHTML + attaches listeners */
export function renderPriorityPanel(contentEl: HTMLElement, game: Game): void {
  contentEl.innerHTML = renderPriorityHTML(game);
  attachPriorityListeners(contentEl, game);
}
