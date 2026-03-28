import { icon, buildingIcon } from '../ui/icons';
import { TerrainType } from '../game/TerrainType';
import { BuildingType, BUILDING_DEFINITIONS } from '../game/BuildingType';
import type { BuildingCategory } from '../game/BuildingType';
import { MapEditor } from './MapEditor';
import { MapEditorTools } from './MapEditorTools';
import { EditorTool, createDefaultEditorState } from './MapEditorState';
import type { EditorState } from './MapEditorState';
import { generateThumbnail } from './ThumbnailGenerator';
import { saveMap, downloadMap, importMapFromFile } from './MapStorage';
import type { MapData } from '../game/MapData';
import { showSnackbar } from '../ui/Snackbar';
import type { Scenario } from '../game/GameConfig';

/** Terrain types with display labels and colors */
const TERRAIN_OPTIONS: { type: TerrainType; label: string; key: string; color: string }[] = [
  { type: TerrainType.Grassland, label: 'Grass', key: 'G', color: '#5cb85c' },
  { type: TerrainType.Forest, label: 'Forest', key: 'F', color: '#2d6a2d' },
  { type: TerrainType.Mountain, label: 'Mountain', key: 'M', color: '#888888' },
  { type: TerrainType.Water, label: 'Water', key: 'W', color: '#4a9bd9' },
  { type: TerrainType.Desert, label: 'Desert', key: 'D', color: '#d2b48c' },
];

const TOOL_DEFS: { tool: EditorTool; label: string; icon: string; shortcut: string }[] = [
  { tool: EditorTool.Terrain, label: 'Terrain', icon: 'map', shortcut: '1' },
  { tool: EditorTool.Elevation, label: 'Elevation', icon: 'tune', shortcut: '2' },
  { tool: EditorTool.Deposit, label: 'Deposit', icon: 'construction', shortcut: '3' },
  { tool: EditorTool.StartPosition, label: 'Start Pos', icon: 'people', shortcut: '4' },
  { tool: EditorTool.Building, label: 'Building', icon: 'home', shortcut: '5' },
  { tool: EditorTool.Flag, label: 'Flag', icon: 'warning', shortcut: '6' },
  { tool: EditorTool.Road, label: 'Road', icon: 'account_tree', shortcut: '7' },
  { tool: EditorTool.Fill, label: 'Fill', icon: 'crown', shortcut: '8' },
  { tool: EditorTool.Eraser, label: 'Eraser', icon: 'delete', shortcut: '9' },
];

const CATEGORY_TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'core', label: 'Core' },
  { key: 'gathering', label: 'Gathering' },
  { key: 'processing', label: 'Processing' },
  { key: 'military', label: 'Military' },
  { key: 'logistics', label: 'Logistics' },
  { key: 'housing', label: 'Housing' },
];

/**
 * Full editor UI — toolbar, panels, dialogs, keyboard shortcuts.
 */
export class MapEditorUI {
  private editor: MapEditor;
  private tools: MapEditorTools;
  private state: EditorState;
  private rootEl: HTMLElement;
  private viewportEl: HTMLElement;
  private statusEl: HTMLElement;
  private tileCountEl: HTMLElement;
  private undoCountEl: HTMLElement;
  private toolButtons: Map<EditorTool, HTMLElement> = new Map();
  private terrainButtons: Map<TerrainType, HTMLElement> = new Map();
  private brushSizeEl: HTMLElement | null = null;
  private nameInput: HTMLInputElement | null = null;
  private descInput: HTMLTextAreaElement | null = null;
  private buildingFilterCategory = 'all';

  /** Callback to go back to setup screen */
  onBack: (() => void) | null = null;
  /** Callback to play the current map */
  onPlay: ((mapData: MapData) => void) | null = null;

  private devToolsOutsideClickHandler = (e: MouseEvent): void => {
    const btn = this.rootEl.querySelector('#editor-devtools-btn');
    const menu = this.rootEl.querySelector('#editor-devtools-menu');
    if (btn && menu && !btn.contains(e.target as Node) && !menu.contains(e.target as Node)) {
      menu.classList.add('hidden');
    }
  };

  constructor(container: HTMLElement) {
    this.state = createDefaultEditorState();

    // Build DOM
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'map-editor-root';
    this.rootEl.innerHTML = this.buildHTML();
    container.appendChild(this.rootEl);

    // Create viewport container for Three.js
    this.viewportEl = this.rootEl.querySelector('.map-editor-viewport')!;

    // Status bar elements
    this.statusEl = this.rootEl.querySelector('#editor-status')!;
    this.tileCountEl = this.rootEl.querySelector('#editor-tile-count')!;
    this.undoCountEl = this.rootEl.querySelector('#editor-undo-count')!;

    // Create editor engine
    this.editor = new MapEditor(this.viewportEl);
    this.tools = new MapEditorTools(this.editor, this.state);

    this.tools.onStatusChange = (status) => {
      this.statusEl.textContent = status;
    };

    this.editor.onMapChanged = () => {
      this.updateTileCount();
      this.updateUndoCount();
    };

    // Wire buttons
    this.wireToolbar();
    this.wirePropertiesPanel();
    this.wireTopBar();
    this.wireDevTools();
    this.wireKeyboard();
    this.updateActiveToolUI();
  }

  async start(): Promise<void> {
    await this.editor.start();
    this.updateTileCount();
  }

  dispose(): void {
    this.tools.dispose();
    this.editor.dispose();
    this.rootEl.remove();
    window.removeEventListener('keydown', this.keyHandler);
    document.removeEventListener('click', this.devToolsOutsideClickHandler);
  }

  /** Get the MapEditor instance */
  getEditor(): MapEditor {
    return this.editor;
  }

  // ─── HTML Template ────────────────────────────────────────────────────

  private buildHTML(): string {
    return `
      <div class="map-editor-topbar">
        <button class="icon-btn" id="editor-back-btn" title="Back">${icon('chevron_right')}</button>
        <span class="map-editor-topbar-title">Map Editor</span>
        <span class="map-editor-map-name" id="editor-map-name-display">Untitled Map</span>
        <div class="map-editor-topbar-spacer"></div>
        <div class="editor-devtools-wrapper">
          <button class="btn-outlined btn-sm" id="editor-devtools-btn">${icon('settings')} Dev Tools</button>
          <div class="editor-devtools-menu hidden" id="editor-devtools-menu">
            <button class="editor-devtools-item" data-tool="audio">${icon('volume_up')} Audio Generator</button>
            <button class="editor-devtools-item" data-tool="thumbnail">${icon('construction')} Thumbnail Generator</button>
            <button class="editor-devtools-item" data-tool="balance">${icon('bar_chart')} Balance Tool</button>
          </div>
        </div>
        <button class="btn-outlined btn-sm" id="editor-import-btn">Import</button>
        <button class="btn-outlined btn-sm" id="editor-export-btn">Export</button>
        <button class="btn-filled btn-sm" id="editor-save-btn">${icon('save')} Save</button>
        <button class="btn-filled btn-sm editor-play-btn" id="editor-play-btn">${icon('play_arrow')} Play</button>
      </div>

      <div class="map-editor-body">
        <div class="map-editor-toolbar">
          ${TOOL_DEFS.map(
            (t) =>
              `<button class="map-editor-tool-btn" data-tool="${t.tool}" title="${t.label} (${t.shortcut})">${icon(t.icon)}<span class="map-editor-tool-label">${t.label}</span></button>`,
          ).join('')}
          <div class="map-editor-toolbar-divider"></div>
          <button class="icon-btn" id="editor-undo-btn" title="Undo (Ctrl+Z)">${icon('chevron_right')}</button>
          <button class="icon-btn" id="editor-redo-btn" title="Redo (Ctrl+Y)">${icon('chevron_right')}</button>
        </div>

        <div class="map-editor-viewport"></div>

        <div class="map-editor-properties">
          <div class="map-editor-prop-section">
            <div class="map-editor-prop-title">Terrain</div>
            <div class="map-editor-terrain-grid" id="editor-terrain-grid">
              ${TERRAIN_OPTIONS.map(
                (t) =>
                  `<button class="map-editor-terrain-btn" data-terrain="${t.type}" title="${t.label}" style="background:${t.color}">${t.key}</button>`,
              ).join('')}
            </div>
          </div>

          <div class="map-editor-prop-section">
            <div class="map-editor-prop-title">Brush Size</div>
            <div class="map-editor-brush-row">
              <button class="btn-outlined btn-sm" id="editor-brush-dec">-</button>
              <span id="editor-brush-size" class="map-editor-brush-val">1</span>
              <button class="btn-outlined btn-sm" id="editor-brush-inc">+</button>
            </div>
          </div>

          <div class="map-editor-prop-section" id="editor-building-section" style="display:none;">
            <div class="map-editor-prop-title">Building</div>
            <div id="editor-building-catalog">${this.buildBuildingCatalogHTML('all')}</div>
          </div>

          <div class="map-editor-prop-section" id="editor-road-hint-section" style="display:none;">
            <div class="map-editor-prop-title">Road Tool</div>
            <div style="font-size:11px;opacity:0.7;">Click to place flags, then click adjacent flags to connect with roads. Press Escape to cancel.</div>
          </div>

          <div class="map-editor-prop-section" id="editor-player-section">
            <div class="map-editor-prop-title">Player</div>
            <div class="map-editor-player-row">
              ${[1, 2, 3, 4]
                .map(
                  (p) =>
                    `<button class="map-editor-player-btn" data-player="${p}" title="Player ${p}">${p}</button>`,
                )
                .join('')}
            </div>
          </div>

          <div class="map-editor-prop-divider"></div>

          <div class="map-editor-prop-section">
            <div class="map-editor-prop-title">Map Info</div>
            <label class="map-editor-field-label">Name</label>
            <input type="text" id="editor-map-name" class="map-editor-input" value="Untitled Map" maxlength="50">
            <label class="map-editor-field-label">Description</label>
            <textarea id="editor-map-desc" class="map-editor-textarea" rows="2" maxlength="200"></textarea>
          </div>

          <div class="map-editor-prop-section">
            <div class="map-editor-prop-title">New Map</div>
            <label class="map-editor-field-label">Size</label>
            <select id="editor-new-size" class="map-editor-select">
              <option value="24">Small (24)</option>
              <option value="32" selected>Medium (32)</option>
              <option value="48">Large (48)</option>
              <option value="64">Huge (64)</option>
            </select>
            <label class="map-editor-field-label">Source</label>
            <select id="editor-new-source" class="map-editor-select">
              <option value="blank" selected>Blank</option>
              <option value="seed">From Seed</option>
            </select>
            <div id="editor-seed-row" class="hidden" style="margin-top:4px;">
              <label class="map-editor-field-label">Seed</label>
              <input type="number" id="editor-new-seed" class="map-editor-input" value="42" min="1" max="999999">
              <label class="map-editor-field-label">Landscape</label>
              <select id="editor-new-scenario" class="map-editor-select">
                <option value="default">Default</option>
                <option value="island">Island</option>
                <option value="continent">Continent</option>
                <option value="archipelago">Archipelago</option>
              </select>
            </div>
            <button class="btn-filled btn-sm" id="editor-new-btn" style="margin-top:8px;width:100%">Create New Map</button>
          </div>
        </div>
      </div>

      <div class="map-editor-statusbar">
        <span id="editor-status">Ready</span>
        <span class="map-editor-statusbar-divider">|</span>
        <span>Tiles: <span id="editor-tile-count">0</span></span>
        <span class="map-editor-statusbar-divider">|</span>
        <span>Undo: <span id="editor-undo-count">0</span></span>
      </div>
    `;
  }

  // ─── Building Catalog ─────────────────────────────────────────────────

  private buildBuildingCatalogHTML(category: string): string {
    const tabs = CATEGORY_TABS.map(
      (t) =>
        `<button class="editor-building-tab${t.key === category ? ' active' : ''}" data-cat="${t.key}">${t.label}</button>`,
    ).join('');

    // Get buildings filtered by category, sorted by tier
    let buildings: { type: string; label: string; tier: number }[];
    if (category === 'all') {
      buildings = Object.entries(BUILDING_DEFINITIONS).map(([type, def]) => ({
        type,
        label: def.label,
        tier: def.tier,
      }));
    } else {
      buildings = Object.entries(BUILDING_DEFINITIONS)
        .filter(([, def]) => def.category === (category as BuildingCategory))
        .map(([type, def]) => ({ type, label: def.label, tier: def.tier }));
    }
    buildings.sort((a, b) => a.tier - b.tier || a.label.localeCompare(b.label));

    // Group by tier
    const tiers = new Map<number, typeof buildings>();
    for (const b of buildings) {
      if (!tiers.has(b.tier)) tiers.set(b.tier, []);
      tiers.get(b.tier)!.push(b);
    }

    const tierLabels: Record<number, string> = { 0: 'Core', 1: 'Basic', 2: 'Advanced', 3: 'Specialized' };

    let gridHTML = '';
    for (const [tier, items] of tiers) {
      gridHTML += `<div class="editor-building-tier-label"><span class="tier-badge tier-badge-${tier <= 0 ? '1' : tier}">${tier}</span> ${tierLabels[tier] ?? `Tier ${tier}`}</div>`;
      for (const b of items) {
        const sel = b.type === this.state.selectedBuildingType ? ' selected' : '';
        gridHTML += `<button class="editor-building-card${sel}" data-building="${b.type}" title="${b.label}">${buildingIcon(b.type, 40)}<span class="editor-building-card-name">${b.label}</span></button>`;
      }
    }

    return `<div class="editor-building-tabs">${tabs}</div><div class="editor-building-grid">${gridHTML}</div>`;
  }

  private updateBuildingCatalog(): void {
    const container = this.rootEl.querySelector('#editor-building-catalog');
    if (container) {
      container.innerHTML = this.buildBuildingCatalogHTML(this.buildingFilterCategory);
    }
  }

  // ─── Wiring ───────────────────────────────────────────────────────────

  private wireToolbar(): void {
    // Tool buttons
    const toolBtns = this.rootEl.querySelectorAll<HTMLElement>('.map-editor-tool-btn');
    for (const btn of toolBtns) {
      const tool = btn.dataset.tool as EditorTool;
      this.toolButtons.set(tool, btn);
      btn.addEventListener('click', () => {
        this.tools.setState({ tool });
        this.updateActiveToolUI();
      });
    }

    // Undo/Redo
    this.rootEl.querySelector('#editor-undo-btn')!.addEventListener('click', () => this.tools.undo());
    this.rootEl.querySelector('#editor-redo-btn')!.addEventListener('click', () => this.tools.redo());
  }

  private wirePropertiesPanel(): void {
    // Terrain buttons
    const terrainBtns = this.rootEl.querySelectorAll<HTMLElement>('.map-editor-terrain-btn');
    for (const btn of terrainBtns) {
      const terrain = btn.dataset.terrain as TerrainType;
      this.terrainButtons.set(terrain, btn);
      btn.addEventListener('click', () => {
        this.tools.setState({ terrainType: terrain });
        this.updateActiveTerrainUI();
      });
    }
    this.updateActiveTerrainUI();

    // Building catalog — event delegation
    const catalogEl = this.rootEl.querySelector('#editor-building-catalog')!;
    catalogEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Category tab click
      const tab = target.closest<HTMLElement>('.editor-building-tab');
      if (tab) {
        this.buildingFilterCategory = tab.dataset.cat ?? 'all';
        this.updateBuildingCatalog();
        return;
      }

      // Building card click
      const card = target.closest<HTMLElement>('.editor-building-card');
      if (card) {
        const type = card.dataset.building as BuildingType;
        this.tools.setState({ selectedBuildingType: type });
        // Auto-switch to Building tool
        if (this.state.tool !== EditorTool.Building) {
          this.tools.setState({ tool: EditorTool.Building });
          this.updateActiveToolUI();
        }
        // Update selection visual
        catalogEl.querySelectorAll('.editor-building-card.selected').forEach((el) => el.classList.remove('selected'));
        card.classList.add('selected');
      }
    });

    // Brush size
    this.brushSizeEl = this.rootEl.querySelector('#editor-brush-size');
    this.rootEl.querySelector('#editor-brush-dec')!.addEventListener('click', () => {
      const newSize = Math.max(1, this.state.brushSize - 1);
      this.tools.setState({ brushSize: newSize });
      this.updateBrushSizeUI();
    });
    this.rootEl.querySelector('#editor-brush-inc')!.addEventListener('click', () => {
      const newSize = Math.min(3, this.state.brushSize + 1);
      this.tools.setState({ brushSize: newSize });
      this.updateBrushSizeUI();
    });

    // Player buttons
    const playerBtns = this.rootEl.querySelectorAll<HTMLElement>('.map-editor-player-btn');
    for (const btn of playerBtns) {
      const player = Number(btn.dataset.player);
      btn.addEventListener('click', () => {
        this.tools.setState({ selectedPlayer: player });
        this.updateActivePlayerUI();
      });
    }
    this.updateActivePlayerUI();

    // Map name/desc
    this.nameInput = this.rootEl.querySelector('#editor-map-name') as HTMLInputElement;
    this.descInput = this.rootEl.querySelector('#editor-map-desc') as HTMLTextAreaElement;
    this.nameInput.addEventListener('input', () => {
      this.editor.setMapName(this.nameInput!.value);
      this.rootEl.querySelector('#editor-map-name-display')!.textContent = this.nameInput!.value;
    });
    this.descInput.addEventListener('input', () => {
      this.editor.setMapDescription(this.descInput!.value);
    });

    // New map controls
    const sourceSelect = this.rootEl.querySelector('#editor-new-source') as HTMLSelectElement;
    const seedRow = this.rootEl.querySelector('#editor-seed-row')!;
    sourceSelect.addEventListener('change', () => {
      seedRow.classList.toggle('hidden', sourceSelect.value !== 'seed');
    });

    this.rootEl.querySelector('#editor-new-btn')!.addEventListener('click', () => {
      const size = Number((this.rootEl.querySelector('#editor-new-size') as HTMLSelectElement).value);
      const source = sourceSelect.value;

      if (source === 'seed') {
        const seed = Number((this.rootEl.querySelector('#editor-new-seed') as HTMLInputElement).value) || 42;
        const scenario = (this.rootEl.querySelector('#editor-new-scenario') as HTMLSelectElement).value as Scenario;
        this.editor.newMapFromSeed(size, seed, scenario);
      } else {
        this.editor.newMap(size);
      }

      this.nameInput!.value = this.editor.getMapName();
      this.descInput!.value = this.editor.getMapDescription();
      this.rootEl.querySelector('#editor-map-name-display')!.textContent = this.editor.getMapName();
      this.updateTileCount();
      showSnackbar('New map created', 'success');
    });
  }

  private wireDevTools(): void {
    const btn = this.rootEl.querySelector('#editor-devtools-btn')!;
    const menu = this.rootEl.querySelector('#editor-devtools-menu')!;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    });

    document.addEventListener('click', this.devToolsOutsideClickHandler);

    menu.querySelectorAll<HTMLElement>('.editor-devtools-item').forEach((item) => {
      item.addEventListener('click', () => {
        menu.classList.add('hidden');
        switch (item.dataset.tool) {
          case 'audio':
            window.open('http://localhost:7860', '_blank');
            break;
          case 'thumbnail':
            window.open('http://localhost:3001', '_blank');
            break;
          case 'balance':
            window.open('/tools/balance-tool.html', '_blank');
            break;
        }
      });
    });
  }

  private wireTopBar(): void {
    // Back button (rotated chevron to point left)
    const backBtn = this.rootEl.querySelector('#editor-back-btn') as HTMLElement;
    backBtn.style.transform = 'rotate(180deg)';
    backBtn.addEventListener('click', () => this.onBack?.());

    // Save
    this.rootEl.querySelector('#editor-save-btn')!.addEventListener('click', () => this.saveCurrentMap());

    // Export
    this.rootEl.querySelector('#editor-export-btn')!.addEventListener('click', () => {
      const thumb = generateThumbnail(this.editor.getGrid(), this.editor.getStartingPositions());
      const data = this.editor.getMapData(thumb);
      downloadMap(data);
      showSnackbar('Map exported', 'success');
    });

    // Import
    this.rootEl.querySelector('#editor-import-btn')!.addEventListener('click', async () => {
      const data = await importMapFromFile();
      if (data) {
        this.editor.loadMap(data);
        this.nameInput!.value = this.editor.getMapName();
        this.descInput!.value = this.editor.getMapDescription();
        this.rootEl.querySelector('#editor-map-name-display')!.textContent = this.editor.getMapName();
        this.updateTileCount();
        showSnackbar('Map imported', 'success');
      } else {
        showSnackbar('Failed to import map', 'error');
      }
    });

    // Play
    this.rootEl.querySelector('#editor-play-btn')!.addEventListener('click', () => {
      const validation = this.validateForPlay();
      if (validation) {
        showSnackbar(validation, 'warning');
        return;
      }
      const thumb = generateThumbnail(this.editor.getGrid(), this.editor.getStartingPositions());
      const data = this.editor.getMapData(thumb);
      saveMap(data);
      this.onPlay?.(data);
    });
  }

  private keyHandler = (e: KeyboardEvent): void => {
    // Skip if user is typing in an input
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') {
        e.preventDefault();
        this.tools.undo();
        this.updateUndoCount();
      } else if (e.key === 'y') {
        e.preventDefault();
        this.tools.redo();
        this.updateUndoCount();
      } else if (e.key === 's') {
        e.preventDefault();
        this.saveCurrentMap();
      }
      return;
    }

    // Number keys for tool select
    const num = Number(e.key);
    if (num >= 1 && num <= TOOL_DEFS.length) {
      const tool = TOOL_DEFS[num - 1].tool;
      this.tools.setState({ tool });
      this.updateActiveToolUI();
      return;
    }

    // Bracket keys for brush size
    if (e.key === '[') {
      this.tools.setState({ brushSize: Math.max(1, this.state.brushSize - 1) });
      this.updateBrushSizeUI();
    } else if (e.key === ']') {
      this.tools.setState({ brushSize: Math.min(3, this.state.brushSize + 1) });
      this.updateBrushSizeUI();
    } else if (e.key === 'Escape') {
      // If road tool is active with a start hex, cancel the road; otherwise go back
      if (this.state.tool === EditorTool.Road && this.state.roadStartHex) {
        this.tools.setState({ roadStartHex: null });
        this.statusEl.textContent = 'Road cancelled';
      } else {
        this.onBack?.();
      }
    }
  };

  private wireKeyboard(): void {
    window.addEventListener('keydown', this.keyHandler);
  }

  // ─── UI Updates ───────────────────────────────────────────────────────

  private updateActiveToolUI(): void {
    for (const [tool, btn] of this.toolButtons) {
      btn.classList.toggle('active', tool === this.state.tool);
    }
    const tool = this.state.tool;

    // Show/hide context-sensitive sections
    const playerSection = this.rootEl.querySelector('#editor-player-section') as HTMLElement;
    const buildingSection = this.rootEl.querySelector('#editor-building-section') as HTMLElement;
    const roadHintSection = this.rootEl.querySelector('#editor-road-hint-section') as HTMLElement;

    const showPlayer = tool === EditorTool.StartPosition || tool === EditorTool.Building || tool === EditorTool.Flag || tool === EditorTool.Road;
    if (playerSection) playerSection.style.display = showPlayer ? '' : 'none';
    if (buildingSection) buildingSection.style.display = tool === EditorTool.Building ? '' : 'none';
    if (roadHintSection) roadHintSection.style.display = tool === EditorTool.Road ? '' : 'none';

    // Clear road start when switching away from road tool
    if (tool !== EditorTool.Road) {
      this.tools.setState({ roadStartHex: null });
    }
  }

  private updateActiveTerrainUI(): void {
    for (const [terrain, btn] of this.terrainButtons) {
      btn.classList.toggle('active', terrain === this.state.terrainType);
    }
  }

  private updateActivePlayerUI(): void {
    const btns = this.rootEl.querySelectorAll<HTMLElement>('.map-editor-player-btn');
    for (const btn of btns) {
      btn.classList.toggle('active', Number(btn.dataset.player) === this.state.selectedPlayer);
    }
  }

  private updateBrushSizeUI(): void {
    if (this.brushSizeEl) {
      this.brushSizeEl.textContent = String(this.state.brushSize);
    }
  }

  private updateTileCount(): void {
    const grid = this.editor.getGrid();
    this.tileCountEl.textContent = String(grid.getAllTiles().length);
  }

  private updateUndoCount(): void {
    this.undoCountEl.textContent = String(this.editor.undoManager.undoCount());
  }

  // ─── Actions ──────────────────────────────────────────────────────────

  private saveCurrentMap(): void {
    const thumb = generateThumbnail(this.editor.getGrid(), this.editor.getStartingPositions());
    const data = this.editor.getMapData(thumb);
    saveMap(data);
    showSnackbar('Map saved', 'success');
  }

  private validateForPlay(): string | null {
    const positions = this.editor.getStartingPositions();
    if (positions.length === 0) {
      return 'Place at least 1 starting position before playing';
    }
    const grid = this.editor.getGrid();
    for (const sp of positions) {
      const tile = grid.getTile(sp.q, sp.r);
      if (!tile || tile.terrain === TerrainType.Water || tile.terrain === TerrainType.Mountain) {
        return `Player ${sp.playerId} start position is on invalid terrain`;
      }
    }
    // Check sufficient grassland
    const tiles = grid.getAllTiles();
    const grassCount = tiles.filter((t) => t.terrain === TerrainType.Grassland).length;
    if (grassCount < tiles.length * 0.1) {
      return 'Map needs at least 10% grassland to be playable';
    }
    return null;
  }
}
