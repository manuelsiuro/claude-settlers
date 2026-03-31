/** In-game encyclopedia with searchable entries for buildings, resources, and units */

import { BuildingType, BUILDING_DEFINITIONS } from '../game/BuildingType';
import { ResourceType, RESOURCE_PROPERTIES } from '../game/ResourceType';
import { UNIT_DEFINITIONS } from '../game/UnitType';
import type { UnitDefinition } from '../game/UnitType';
import { buildingIcon, resourceIcon, unitIcon, icon } from './icons';

type Tab = 'buildings' | 'resources' | 'units';

let overlayEl: HTMLElement | null = null;
let searchInput: HTMLInputElement | null = null;
let listEl: HTMLElement | null = null;
let detailEl: HTMLElement | null = null;
let currentTab: Tab = 'buildings';

// ---- Data helpers ----

function getBuildingEntries(): { key: string; label: string; category: string; html: string }[] {
  return Object.entries(BUILDING_DEFINITIONS).map(([key, def]) => ({
    key,
    label: def.label,
    category: def.category,
    html: buildingIcon(key as BuildingType, 32),
  }));
}

function getResourceEntries(): { key: string; label: string; category: string; html: string }[] {
  return Object.entries(RESOURCE_PROPERTIES).map(([key, props]) => ({
    key,
    label: props.label,
    category: props.category,
    html: resourceIcon(key as ResourceType, 32),
  }));
}

function getUnitEntries(): { key: string; label: string; category: string; html: string }[] {
  return Object.entries(UNIT_DEFINITIONS).map(([key, def]) => ({
    key,
    label: def.label,
    category: def.category,
    html: unitIcon(key, 32),
  }));
}

// ---- Detail renderers ----

function renderBuildingDetail(key: string): string {
  const def = BUILDING_DEFINITIONS[key as BuildingType];
  if (!def) return '';

  let html = `<div class="enc-detail-header">
    ${buildingIcon(key as BuildingType, 48)}
    <div>
      <h3 class="enc-detail-name">${def.label}</h3>
      <span class="enc-detail-cat">${def.category} · Tier ${def.tier}</span>
    </div>
  </div>`;

  if (def.description) {
    html += `<p class="enc-detail-desc">${def.description}</p>`;
  }

  // Cost
  if (def.cost.length > 0) {
    html += `<div class="enc-detail-section"><h4>Construction Cost</h4><div class="enc-detail-row">`;
    for (const c of def.cost) {
      const rp = RESOURCE_PROPERTIES[c.resource];
      html += `<span class="enc-chip">${resourceIcon(c.resource, 16)} ${rp?.label ?? c.resource} ×${c.amount}</span>`;
    }
    html += `</div></div>`;
  }

  // Production
  if (def.production) {
    const p = def.production;
    html += `<div class="enc-detail-section"><h4>Production</h4>`;
    if (p.inputs.length > 0) {
      html += `<div class="enc-detail-row"><strong>Inputs:</strong> `;
      html += p.inputs.map(i => {
        const rp = RESOURCE_PROPERTIES[i.resource];
        return `<span class="enc-chip">${resourceIcon(i.resource, 16)} ${rp?.label ?? i.resource} ×${i.amount}</span>`;
      }).join('');
      html += `</div>`;
    }
    if (p.outputs.length > 0) {
      html += `<div class="enc-detail-row"><strong>Outputs:</strong> `;
      html += p.outputs.map(o => {
        const rp = RESOURCE_PROPERTIES[o.resource];
        return `<span class="enc-chip">${resourceIcon(o.resource, 16)} ${rp?.label ?? o.resource} ×${o.amount}</span>`;
      }).join('');
      html += `</div>`;
    }
    html += `<div class="enc-detail-row"><strong>Time:</strong> ${p.productionTime}s</div>`;
    html += `</div>`;
  }

  // Worker
  if (def.worker) {
    html += `<div class="enc-detail-section"><h4>Worker</h4>`;
    html += `<div class="enc-detail-row">${def.worker}`;
    if (def.workerTool) {
      const tp = RESOURCE_PROPERTIES[def.workerTool];
      html += ` (requires ${resourceIcon(def.workerTool, 16)} ${tp?.label ?? def.workerTool})`;
    }
    html += `</div></div>`;
  }

  // Stats
  const stats: string[] = [];
  if (def.storageCapacity) stats.push(`Storage: ${def.storageCapacity}`);
  if (def.constructionTime) stats.push(`Build time: ${def.constructionTime}s`);
  if (def.populationCapacity) stats.push(`Housing: +${def.populationCapacity}`);
  if (def.knightSlots) stats.push(`Knight slots: ${def.knightSlots}`);
  if (def.influenceRadius) stats.push(`Territory radius: ${def.influenceRadius}`);

  if (stats.length > 0) {
    html += `<div class="enc-detail-section"><h4>Stats</h4>`;
    html += stats.map(s => `<div class="enc-detail-row">${s}</div>`).join('');
    html += `</div>`;
  }

  // Terrain
  if (def.allowedTerrain && def.allowedTerrain.length > 0) {
    html += `<div class="enc-detail-section"><h4>Placement</h4>`;
    html += `<div class="enc-detail-row">Terrain: ${def.allowedTerrain.join(', ')}</div>`;
    html += `</div>`;
  }

  return html;
}

function renderResourceDetail(key: string): string {
  const props = RESOURCE_PROPERTIES[key as ResourceType];
  if (!props) return '';

  let html = `<div class="enc-detail-header">
    ${resourceIcon(key as ResourceType, 48)}
    <div>
      <h3 class="enc-detail-name">${props.label}</h3>
      <span class="enc-detail-cat">${props.category}</span>
    </div>
  </div>`;

  const traits: string[] = [];
  if (props.satiationValue > 0) traits.push(`Food (restores ${Math.round(props.satiationValue * 100)}% satiation)`);
  if (props.isDrink) traits.push('Drink (morale bonus)');
  if (props.isLuxury) traits.push('Luxury (morale bonus)');

  if (traits.length > 0) {
    html += `<div class="enc-detail-section"><h4>Properties</h4>`;
    html += traits.map(t => `<div class="enc-detail-row">${t}</div>`).join('');
    html += `</div>`;
  }

  // Which buildings produce this?
  const producers: string[] = [];
  const consumers: string[] = [];
  for (const [, bDef] of Object.entries(BUILDING_DEFINITIONS)) {
    if (bDef.production) {
      if (bDef.production.outputs.some(o => o.resource === key)) {
        producers.push(bDef.label);
      }
      if (bDef.production.inputs.some(i => i.resource === key)) {
        consumers.push(bDef.label);
      }
    }
  }

  if (producers.length > 0) {
    html += `<div class="enc-detail-section"><h4>Produced By</h4>`;
    html += `<div class="enc-detail-row">${producers.map(p => `<span class="enc-chip">${p}</span>`).join('')}</div>`;
    html += `</div>`;
  }

  if (consumers.length > 0) {
    html += `<div class="enc-detail-section"><h4>Consumed By</h4>`;
    html += `<div class="enc-detail-row">${consumers.map(p => `<span class="enc-chip">${p}</span>`).join('')}</div>`;
    html += `</div>`;
  }

  return html;
}

function renderUnitDetail(key: string): string {
  const def = UNIT_DEFINITIONS[key as keyof typeof UNIT_DEFINITIONS] as UnitDefinition | undefined;
  if (!def) return '';

  let html = `<div class="enc-detail-header">
    ${unitIcon(key, 48)}
    <div>
      <h3 class="enc-detail-name">${def.label}</h3>
      <span class="enc-detail-cat">${def.category}</span>
    </div>
  </div>`;

  const stats: string[] = [];
  stats.push(`Speed: ${def.moveSpeed} hex/s`);
  if (def.combatStrength) stats.push(`Combat strength: ${def.combatStrength}`);
  if (def.attackRange) stats.push(`Attack range: ${def.attackRange} hex`);
  if (def.chargeMultiplier) stats.push(`Charge bonus: ${def.chargeMultiplier}x`);
  if (def.buildingDamage) stats.push(`Building damage: ${def.buildingDamage}x`);
  if (def.carryCapacity) stats.push(`Carry capacity: ${def.carryCapacity}`);

  html += `<div class="enc-detail-section"><h4>Stats</h4>`;
  html += stats.map(s => `<div class="enc-detail-row">${s}</div>`).join('');
  html += `</div>`;

  if (def.requiredTool) {
    const tp = RESOURCE_PROPERTIES[def.requiredTool];
    html += `<div class="enc-detail-section"><h4>Requirements</h4>`;
    html += `<div class="enc-detail-row">Tool: ${resourceIcon(def.requiredTool, 16)} ${tp?.label ?? def.requiredTool}</div>`;
    html += `</div>`;
  }

  // Which buildings use this unit?
  const workplaces: string[] = [];
  for (const [, bDef] of Object.entries(BUILDING_DEFINITIONS)) {
    if (bDef.worker === def.label) {
      workplaces.push(bDef.label);
    }
  }
  if (workplaces.length > 0) {
    html += `<div class="enc-detail-section"><h4>Works At</h4>`;
    html += `<div class="enc-detail-row">${workplaces.map(p => `<span class="enc-chip">${p}</span>`).join('')}</div>`;
    html += `</div>`;
  }

  return html;
}

// ---- Main rendering ----

function getEntries(): { key: string; label: string; category: string; html: string }[] {
  switch (currentTab) {
    case 'buildings': return getBuildingEntries();
    case 'resources': return getResourceEntries();
    case 'units': return getUnitEntries();
  }
}

function renderDetail(key: string): string {
  switch (currentTab) {
    case 'buildings': return renderBuildingDetail(key);
    case 'resources': return renderResourceDetail(key);
    case 'units': return renderUnitDetail(key);
  }
}

function renderEntryList(filter: string): void {
  if (!listEl) return;
  const entries = getEntries();
  const filtered = filter
    ? entries.filter(e => e.label.toLowerCase().includes(filter) || e.category.toLowerCase().includes(filter))
    : entries;

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="enc-empty">No matching entries</div>';
    return;
  }

  // Group by category
  const groups = new Map<string, typeof filtered>();
  for (const e of filtered) {
    const list = groups.get(e.category) ?? [];
    list.push(e);
    groups.set(e.category, list);
  }

  let html = '';
  for (const [cat, items] of groups) {
    html += `<div class="enc-group-label">${cat}</div>`;
    for (const item of items) {
      html += `<div class="enc-list-item" data-key="${item.key}">
        ${item.html}
        <span class="enc-list-label">${item.label}</span>
      </div>`;
    }
  }
  listEl.innerHTML = html;
}

function showDetail(key: string): void {
  if (!detailEl) return;
  detailEl.innerHTML = renderDetail(key);
}

// ---- Public API ----

export function initEncyclopedia(): void {
  if (document.getElementById('encyclopedia-overlay')) return;

  overlayEl = document.createElement('div');
  overlayEl.id = 'encyclopedia-overlay';
  overlayEl.className = 'enc-overlay hidden';
  overlayEl.innerHTML = `
    <div class="enc-container">
      <div class="enc-topbar">
        <h2 class="enc-title">${icon('crown')} Encyclopedia</h2>
        <div class="enc-tabs">
          <button class="enc-tab active" data-tab="buildings">Buildings</button>
          <button class="enc-tab" data-tab="resources">Resources</button>
          <button class="enc-tab" data-tab="units">Units</button>
        </div>
        <input type="text" class="enc-search" placeholder="Search..." id="enc-search" />
        <button class="icon-btn enc-close" title="Close">${icon('close')}</button>
      </div>
      <div class="enc-body">
        <div class="enc-sidebar" id="enc-list"></div>
        <div class="enc-detail" id="enc-detail">
          <div class="enc-empty">Select an entry to view details</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlayEl);
  listEl = document.getElementById('enc-list');
  detailEl = document.getElementById('enc-detail');
  searchInput = document.getElementById('enc-search') as HTMLInputElement;

  // Event delegation
  overlayEl.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    if (target.closest('.enc-close')) {
      hideEncyclopedia();
      return;
    }

    const tab = target.closest('.enc-tab') as HTMLElement | null;
    if (tab) {
      currentTab = tab.dataset.tab as Tab;
      overlayEl!.querySelectorAll('.enc-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (searchInput) searchInput.value = '';
      renderEntryList('');
      if (detailEl) detailEl.innerHTML = '<div class="enc-empty">Select an entry to view details</div>';
      return;
    }

    const item = target.closest('.enc-list-item') as HTMLElement | null;
    if (item && item.dataset.key) {
      listEl?.querySelectorAll('.enc-list-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      showDetail(item.dataset.key);
    }
  });

  searchInput.addEventListener('input', () => {
    renderEntryList(searchInput!.value.toLowerCase().trim());
  });

  // Escape to close
  overlayEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideEncyclopedia();
  });
}

export function showEncyclopedia(): void {
  if (!overlayEl) initEncyclopedia();
  overlayEl!.classList.remove('hidden');
  renderEntryList('');
  searchInput?.focus();
}

export function hideEncyclopedia(): void {
  overlayEl?.classList.add('hidden');
}

export function toggleEncyclopedia(): void {
  if (overlayEl?.classList.contains('hidden')) showEncyclopedia();
  else hideEncyclopedia();
}
