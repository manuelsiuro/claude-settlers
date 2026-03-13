import type { Game } from '../engine/Game';
import { RESOURCE_PROPERTIES, ResourceType } from '../game/ResourceType';
import {
  getResourceCategoryWeights,
  setResourceCategoryWeights,
  createDefaultDistribution,
} from '../game/GoodsDistribution';
import type { CategoryWeights } from '../game/GoodsDistribution';
import { resourceIcon } from './icons';

/** All resource types in display order */
const ALL_RESOURCES: ResourceType[] = [
  ResourceType.Wood, ResourceType.Stone, ResourceType.Planks,
  ResourceType.Grain, ResourceType.Fish, ResourceType.Flour,
  ResourceType.Bread, ResourceType.Meat,
  ResourceType.IronOre, ResourceType.CoalOre, ResourceType.GoldOre,
  ResourceType.IronBars, ResourceType.GoldBars,
  ResourceType.Tools, ResourceType.Swords, ResourceType.Shields,
  ResourceType.Pigs,
];

const CATEGORY_META: Record<keyof CategoryWeights, { label: string; colorClass: string }> = {
  production: { label: 'Production', colorClass: 'priority-cat-production' },
  construction: { label: 'Construction', colorClass: 'priority-cat-construction' },
  storage: { label: 'Storage', colorClass: 'priority-cat-storage' },
};

/**
 * Render the resource priority panel content.
 * Shows sliders for production/construction/storage weights per resource.
 */
export function renderPriorityPanel(contentEl: HTMLElement, game: Game): void {
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

    html += `</div>`;
  }

  html += `<button class="btn-outlined priority-reset-btn">Reset to Defaults</button>`;

  contentEl.innerHTML = html;

  // Attach event listeners
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

  // Reset button
  const resetBtn = contentEl.querySelector('.priority-reset-btn');
  resetBtn?.addEventListener('click', () => {
    const defaults = createDefaultDistribution();
    settings.resourceCategoryWeights = defaults.resourceCategoryWeights;
    game.setDistributionSettings(settings);
    renderPriorityPanel(contentEl, game);
  });
}
