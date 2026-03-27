import type { Game } from '../engine/Game';
import type { ResourceType } from '../game/ResourceType';
import { RESOURCE_PROPERTIES } from '../game/ResourceType';
import { BUILDING_DEFINITIONS } from '../game/data/buildings/index';
import { getAllPlayerResources } from './dashboard/dashboardHelpers';
import { resourceIcon } from './icons';

const RESOURCE_COUNT = 8;

/** Derive the most-used construction resources from building cost data. */
function computeTopConstructionResources(n: number): ResourceType[] {
  const tally = new Map<ResourceType, number>();
  for (const def of Object.values(BUILDING_DEFINITIONS)) {
    for (const { resource } of def.cost) {
      tally.set(resource, (tally.get(resource) ?? 0) + 1);
    }
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([res]) => res);
}

let container: HTMLElement | null = null;
let getGame: (() => Game) | null = null;
let updateInterval: ReturnType<typeof setInterval> | null = null;
let onResourceClick: ((resourceType: ResourceType) => void) | null = null;
let displayedResources: ResourceType[] = [];
let countSpans: Map<string, HTMLElement> | null = null;
let itemElements: Map<string, HTMLElement> | null = null;

export function initResourceBar(
  gameGetter: () => Game,
  resourceClickHandler?: (resourceType: ResourceType) => void,
): void {
  disposeResourceBar();

  getGame = gameGetter;
  onResourceClick = resourceClickHandler ?? null;
  container = document.getElementById('resource-bar');
  if (!container) return;

  displayedResources = computeTopConstructionResources(RESOURCE_COUNT);
  buildDOM();

  updateInterval = setInterval(updateCounts, 1000);
  updateCounts();
}

export function disposeResourceBar(): void {
  if (updateInterval !== null) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  if (container) {
    container.innerHTML = '';
  }
  getGame = null;
  onResourceClick = null;
  countSpans = null;
  itemElements = null;
  displayedResources = [];
}

function buildDOM(): void {
  if (!container) return;

  countSpans = new Map();
  itemElements = new Map();

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < displayedResources.length; i++) {
    const resType = displayedResources[i];
    const props = RESOURCE_PROPERTIES[resType];

    const item = document.createElement('span');
    item.className = 'resource-bar-item';
    item.title = props.label;
    item.dataset.resource = resType;
    item.innerHTML = resourceIcon(resType, 14);

    const countEl = document.createElement('span');
    countEl.textContent = '0';
    item.appendChild(countEl);

    countSpans.set(resType, countEl);
    itemElements.set(resType, item);
    fragment.appendChild(item);
  }

  container.appendChild(fragment);

  container.addEventListener('click', (e) => {
    if (!onResourceClick) return;
    const item = (e.target as HTMLElement).closest('.resource-bar-item') as HTMLElement | null;
    if (!item) return;
    const resType = item.dataset.resource as ResourceType | undefined;
    if (resType) onResourceClick(resType);
  });
}

function updateCounts(): void {
  if (!getGame || !countSpans || !itemElements) return;

  let game: Game;
  try {
    game = getGame();
  } catch {
    return;
  }

  const resources = getAllPlayerResources(game);

  for (const resType of displayedResources) {
    const count = resources[resType] ?? 0;
    const countStr = String(count);
    const span = countSpans.get(resType);
    if (span && span.textContent !== countStr) {
      span.textContent = countStr;
    }
    const item = itemElements.get(resType);
    if (item) {
      item.classList.toggle('resource-bar-item-zero', count === 0);
    }
  }
}
