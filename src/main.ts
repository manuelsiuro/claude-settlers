import 'mdui/mdui.css';
import 'mdui/components/top-app-bar.js';
import 'mdui/components/button-icon.js';
import 'mdui/components/button.js';
import 'mdui/components/fab.js';
import 'mdui/components/navigation-drawer.js';
import 'mdui/components/list.js';
import 'mdui/components/list-item.js';
import 'mdui/components/card.js';
import 'mdui/components/chip.js';
import 'mdui/components/tooltip.js';
import 'mdui/components/snackbar.js';
import '@mdui/icons/menu.js';
import '@mdui/icons/construction.js';
import '@mdui/icons/bar-chart.js';
import '@mdui/icons/map.js';
import '@mdui/icons/settings.js';
import '@mdui/icons/close.js';
import '@mdui/icons/add.js';
import { Game } from './engine/Game';
import { BuildingType, BUILDING_DEFINITIONS, getBuildingsByTier } from './game/BuildingType';
import type { BuildingDefinition } from './game/BuildingType';
import { RESOURCE_PROPERTIES } from './game/ResourceType';
import './ui/styles.css';

const app = document.getElementById('app')!;

app.innerHTML = `
  <mdui-navigation-drawer id="side-panel" close-on-overlay-click>
    <mdui-list>
      <mdui-list-item headline="Buildings">
        <mdui-icon-construction slot="icon"></mdui-icon-construction>
      </mdui-list-item>
      <mdui-list-item headline="Statistics">
        <mdui-icon-bar-chart slot="icon"></mdui-icon-bar-chart>
      </mdui-list-item>
      <mdui-list-item headline="Minimap">
        <mdui-icon-map slot="icon"></mdui-icon-map>
      </mdui-list-item>
      <mdui-list-item headline="Settings">
        <mdui-icon-settings slot="icon"></mdui-icon-settings>
      </mdui-list-item>
    </mdui-list>
  </mdui-navigation-drawer>

  <div id="main-content">
    <mdui-top-app-bar variant="small" id="app-bar">
      <mdui-button-icon id="menu-btn">
        <mdui-icon-menu></mdui-icon-menu>
      </mdui-button-icon>
      <span class="app-title">Feudal Realm Manager</span>
    </mdui-top-app-bar>
    <div id="game-container"></div>
  </div>

  <!-- Build FAB -->
  <mdui-fab id="build-fab" icon="construction" variant="primary"
    style="position:fixed;bottom:24px;right:24px;z-index:10;">
  </mdui-fab>

  <!-- Building Menu Panel -->
  <div id="build-panel" class="build-panel hidden">
    <div class="build-panel-header">
      <span class="build-panel-title">Build</span>
      <mdui-button-icon id="build-close-btn">
        <mdui-icon-close></mdui-icon-close>
      </mdui-button-icon>
    </div>
    <div id="build-panel-content" class="build-panel-content"></div>
  </div>

  <!-- Placement Info Bar -->
  <div id="placement-bar" class="placement-bar hidden">
    <span id="placement-label"></span>
    <mdui-button id="placement-cancel-btn" variant="text">Cancel (Esc)</mdui-button>
  </div>

  <mdui-snackbar id="snackbar" placement="bottom"></mdui-snackbar>
`;

// Side panel toggle
const menuBtn = document.getElementById('menu-btn')!;
const sidePanel = document.getElementById('side-panel') as HTMLElement & { open: boolean };
menuBtn.addEventListener('click', () => {
  sidePanel.open = !sidePanel.open;
});

// Game init
const container = document.getElementById('game-container')!;
const game = new Game(container);

// Build panel elements
const buildFab = document.getElementById('build-fab')!;
const buildPanel = document.getElementById('build-panel')!;
const buildCloseBtn = document.getElementById('build-close-btn')!;
const buildContent = document.getElementById('build-panel-content')!;
const placementBar = document.getElementById('placement-bar')!;
const placementLabel = document.getElementById('placement-label')!;
const placementCancelBtn = document.getElementById('placement-cancel-btn')!;
const snackbar = document.getElementById('snackbar') as HTMLElement & {
  open: boolean;
  textContent: string;
};

/** Format cost for display */
function formatCost(def: BuildingDefinition): string {
  if (def.cost.length === 0) return 'Free';
  return def.cost
    .map((c) => `${c.amount} ${RESOURCE_PROPERTIES[c.resource].label}`)
    .join(', ');
}

/** Build the building menu HTML organized by tier */
function populateBuildPanel(): void {
  const tiers = [
    { tier: 1, label: 'Basic' },
    { tier: 2, label: 'Advanced' },
    { tier: 3, label: 'Specialized' },
  ];

  let html = '';
  for (const { tier, label } of tiers) {
    const buildings = getBuildingsByTier(tier);
    html += `<div class="build-tier"><div class="build-tier-label">Tier ${tier}: ${label}</div>`;
    for (const def of buildings) {
      html += `
        <button class="build-item" data-building-type="${def.type}" title="${formatCost(def)}">
          <span class="build-item-name">${def.label}</span>
          <span class="build-item-cost">${formatCost(def)}</span>
        </button>
      `;
    }
    html += '</div>';
  }
  buildContent.innerHTML = html;

  // Attach click handlers
  buildContent.querySelectorAll('.build-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = (btn as HTMLElement).dataset.buildingType as BuildingType;
      if (type) {
        startPlacement(type);
      }
    });
  });
}

/** Open/close the build panel */
function toggleBuildPanel(): void {
  buildPanel.classList.toggle('hidden');
}

function closeBuildPanel(): void {
  buildPanel.classList.add('hidden');
}

/** Enter building placement mode */
function startPlacement(type: BuildingType): void {
  closeBuildPanel();
  const placement = game.getPlacementController();
  if (!placement) return;

  const def = BUILDING_DEFINITIONS[type];
  placement.selectBuilding(type);
  placementLabel.textContent = `Placing: ${def.label}`;
  placementBar.classList.remove('hidden');
}

/** Cancel placement */
function cancelPlacement(): void {
  const placement = game.getPlacementController();
  if (!placement) return;
  placement.cancel();
  placementBar.classList.add('hidden');
}

// Event listeners
buildFab.addEventListener('click', toggleBuildPanel);
buildCloseBtn.addEventListener('click', closeBuildPanel);
placementCancelBtn.addEventListener('click', cancelPlacement);

// Start the game and set up placement callbacks
game.start().then(() => {
  const placement = game.getPlacementController();
  if (placement) {
    placement.onBuildingPlaced = (type) => {
      const def = BUILDING_DEFINITIONS[type];
      snackbar.textContent = `${def.label} placed!`;
      snackbar.open = true;
    };
    placement.onModeChanged = (active) => {
      if (!active) {
        placementBar.classList.add('hidden');
      }
    };
  }
});

// Populate the build panel
populateBuildPanel();

// Prevent context menu on canvas for right-click cancel
container.addEventListener('contextmenu', (e) => e.preventDefault());
