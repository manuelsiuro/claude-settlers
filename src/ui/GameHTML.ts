import { icon } from './icons';
import { generateQrSvg } from './QrCode';

/**
 * Returns the full game HTML template.
 * Extracted from main.ts to reduce file size.
 */
export function getGameHTML(currentTheme: string): string {
  return `
  <!-- Navigation drawer overlay -->
  <div id="nav-overlay" class="nav-overlay"></div>

  <!-- Navigation drawer -->
  <nav id="side-panel" class="nav-drawer">
    <div class="nav-drawer-header">
      <div class="nav-drawer-header-title">Feudal Realm Manager</div>
      <div class="nav-drawer-header-version">v0.1.0</div>
    </div>
    <ul>
      <div class="nav-drawer-section-label">Game</div>
      <li data-headline="Buildings">${icon('construction')} Buildings</li>
      <li data-headline="Statistics">${icon('bar_chart')} Statistics</li>
      <li data-headline="Dashboard">${icon('bar_chart')} Dashboard</li>
      <li data-headline="Resource Priority">${icon('tune')} Resource Priority</li>
      <li data-headline="Minimap">${icon('map')} Minimap</li>
      <li data-headline="Tech Tree">${icon('account_tree')} Tech Tree</li>
      <li data-headline="Encyclopedia">${icon('crown')} Encyclopedia</li>
      <li data-headline="Achievements">${icon('trophy')} Achievements</li>
      <li data-headline="Diplomacy">${icon('people')} Diplomacy</li>
      <div class="nav-drawer-divider"></div>
      <div class="nav-drawer-section-label">Data</div>
      <li data-headline="Save Game">${icon('save')} Save Game</li>
      <li data-headline="Load Game">${icon('folder_open')} Load Game</li>
      <li data-headline="Download Save">${icon('download')} Download Save</li>
      <div class="nav-drawer-divider"></div>
      <li data-headline="Settings" data-nonclickable>${icon('settings')} Settings</li>
      <div class="theme-toggle-row">
        <span class="theme-toggle-label">${icon('sun')} Day</span>
        <label class="theme-toggle">
          <input type="checkbox" id="theme-toggle-input"${currentTheme === 'night' ? ' checked' : ''}>
          <span class="theme-toggle-track"></span>
        </label>
        <span class="theme-toggle-label">${icon('moon')} Night</span>
      </div>
      <div class="audio-settings" style="padding:4px 24px 12px;">
        <label class="audio-slider-label">Master Volume</label>
        <input type="range" id="vol-master" min="0" max="100" value="50" class="audio-slider">
        <label class="audio-slider-label">SFX Volume</label>
        <input type="range" id="vol-sfx" min="0" max="100" value="80" class="audio-slider">
        <label class="audio-slider-label">Music Volume</label>
        <input type="range" id="vol-music" min="0" max="100" value="30" class="audio-slider">
        <label class="audio-slider-label">Spatial Audio</label>
        <input type="range" id="vol-spatial" min="0" max="100" value="60" class="audio-slider">
        <label class="audio-slider-label">Ambient Audio</label>
        <input type="range" id="vol-ambient" min="0" max="100" value="40" class="audio-slider">
      </div>
      <div class="nav-drawer-divider"></div>
      <li data-headline="Graphics" data-nonclickable>${icon('settings')} Graphics</li>
      <div class="graphics-settings" style="padding:4px 24px 12px;">
        <div class="gfx-presets">
          <button class="btn-outlined btn-sm gfx-preset-btn" data-preset="low">Low</button>
          <button class="btn-outlined btn-sm gfx-preset-btn" data-preset="medium">Medium</button>
          <button class="btn-filled btn-sm gfx-preset-btn" data-preset="high">High</button>
          <button class="btn-outlined btn-sm gfx-preset-btn" data-preset="ultra">Ultra</button>
        </div>
        <label class="audio-slider-label">Shadows</label>
        <select id="gfx-shadows" class="settings-select">
          <option value="off">Off</option>
          <option value="blob_only">Blob Only</option>
          <option value="low">Low</option>
          <option value="high">High</option>
        </select>
        <label class="audio-slider-label">Post-Processing</label>
        <select id="gfx-post" class="settings-select">
          <option value="off">Off</option>
          <option value="color_only">Color Only</option>
          <option value="full">Full (Bloom)</option>
        </select>
        <label class="audio-slider-label">Weather</label>
        <select id="gfx-weather" class="settings-select">
          <option value="none">Off</option>
          <option value="rain">Rain</option>
          <option value="snow">Snow</option>
        </select>
        <label class="audio-slider-label">Time of Day</label>
        <select id="gfx-time" class="settings-select">
          <option value="dawn">Dawn</option>
          <option value="morning">Morning</option>
          <option value="midday">Midday</option>
          <option value="golden_hour">Golden Hour</option>
          <option value="evening">Evening</option>
          <option value="night">Night</option>
          <option value="auto">Auto-Cycle</option>
        </select>
        <label class="audio-slider-label">Fog of War</label>
        <select id="gfx-fog" class="settings-select">
          <option value="on">On</option>
          <option value="off">Off</option>
        </select>
        <div class="settings-section-label">Accessibility</div>
        <label class="audio-slider-label">Colorblind Mode</label>
        <select id="a11y-colorblind" class="settings-select">
          <option value="none">Off</option>
          <option value="deuteranopia">Deuteranopia (Red-Green)</option>
          <option value="protanopia">Protanopia (Red-Weak)</option>
          <option value="tritanopia">Tritanopia (Blue-Yellow)</option>
        </select>
        <label class="audio-slider-label">Text Size</label>
        <select id="a11y-textsize" class="settings-select">
          <option value="normal">Normal</option>
          <option value="large">Large (+20%)</option>
          <option value="xlarge">Extra Large (+40%)</option>
        </select>
      </div>
    </ul>
  </nav>

  <div id="main-content">
    <header class="app-bar" id="app-bar">
      <button class="icon-btn" id="menu-btn" title="Menu">${icon('menu')}</button>
      <span class="app-title">${icon('crown', 'app-title-crown')} Feudal Realm Manager</span>
    </header>
    <div id="game-container"></div>
  </div>

  <!-- Minimap -->
  <div id="minimap-container" class="minimap-container"></div>

  <!-- Floating Game Controls (below minimap) -->
  <div id="game-controls-bar" class="game-controls-bar">
    <button class="icon-btn" id="pause-btn" title="Pause / Resume (Space)">
      <span id="pause-icon">${icon('pause')}</span>
      <span id="play-icon" class="hidden">${icon('play_arrow')}</span>
    </button>
    <button class="icon-btn" id="speed-btn" title="Game speed">${icon('fast_forward')}</button>
    <span id="speed-label" class="speed-label">1x</span>
    <div class="game-controls-divider"></div>
    <button class="icon-btn" id="mute-btn" title="Toggle sound">
      <span id="mute-icon-on">${icon('volume_up')}</span>
      <span id="mute-icon-off" class="hidden">${icon('volume_off')}</span>
    </button>
    <div class="game-controls-divider"></div>
    <span id="pop-counter" class="pop-counter" title="Population">${icon('people')} <span id="pop-counter-text">0/15</span></span>
    <div class="game-controls-divider"></div>
    <span id="morale-counter" class="morale-counter" title="Morale">${icon('shield_icon')} <span id="morale-counter-text">50%</span></span>
    <span id="victory-progress" class="victory-progress"></span>
  </div>

  <!-- Resource Bar (key construction materials at a glance) -->
  <div id="resource-bar" class="resource-bar"></div>

  <!-- Build Toolbar (desktop only) -->
  <div id="build-toolbar" class="build-toolbar">
    <button class="build-toolbar-tab" data-category="all" title="All">
      ${icon('construction')}<span class="build-toolbar-label">All</span>
    </button>
    <button class="build-toolbar-tab" data-category="gathering" title="Economy">
      ${icon('hammer')}<span class="build-toolbar-label">Economy</span>
    </button>
    <button class="build-toolbar-tab" data-category="processing" title="Processing">
      ${icon('settings')}<span class="build-toolbar-label">Processing</span>
    </button>
    <button class="build-toolbar-tab" data-category="military" title="Military">
      ${icon('shield_icon')}<span class="build-toolbar-label">Military</span>
    </button>
    <button class="build-toolbar-tab" data-category="logistics" title="Logistics">
      ${icon('warehouse')}<span class="build-toolbar-label">Logistics</span>
    </button>
    <button class="build-toolbar-tab" data-category="housing" title="Housing">
      ${icon('home')}<span class="build-toolbar-label">Housing</span>
    </button>
    <div class="build-toolbar-divider"></div>
    <button class="build-toolbar-tab" data-panel="stats" title="Statistics">
      ${icon('bar_chart')}<span class="build-toolbar-label">Stats</span>
    </button>
    <button class="build-toolbar-tab" data-panel="priority" title="Priority">
      ${icon('tune')}<span class="build-toolbar-label">Priority</span>
    </button>
    <button class="build-toolbar-tab" data-panel="dashboard" title="Dashboard">
      ${icon('bar_chart')}<span class="build-toolbar-label">Dashboard</span>
    </button>
    <button class="build-toolbar-tab" data-panel="techtree" title="Tech Tree">
      ${icon('account_tree')}<span class="build-toolbar-label">Tech Tree</span>
    </button>
  </div>

  <!-- Stats FAB (mobile only — hidden when mobile toolbar active) -->
  <button id="stats-fab" class="btn-filled stats-fab">
    ${icon('bar_chart')}
  </button>

  <!-- Build FAB (mobile only — hidden when mobile toolbar active) -->
  <button id="build-fab" class="btn-filled build-fab">
    ${icon('construction')}
  </button>

  <!-- Mobile Bottom Toolbar (replaces FABs on mobile) -->
  <div id="mobile-toolbar" class="mobile-toolbar">
    <button class="mobile-toolbar-btn" id="mt-build" title="Build">
      ${icon('construction')}
      <span class="mobile-toolbar-label">Build</span>
    </button>
    <button class="mobile-toolbar-btn" id="mt-stats" title="Statistics">
      ${icon('bar_chart')}
      <span class="mobile-toolbar-label">Stats</span>
    </button>
    <div class="mobile-toolbar-recents" id="mt-recents"></div>
    <button class="mobile-toolbar-btn" id="mt-speed" title="Game Speed">
      ${icon('fast_forward')}
      <span class="mobile-toolbar-label" id="mt-speed-label">1x</span>
    </button>
    <button class="mobile-toolbar-btn" id="mt-menu" title="Menu">
      ${icon('menu')}
      <span class="mobile-toolbar-label">Menu</span>
    </button>
  </div>

  <!-- Building Menu Panel -->
  <div id="build-panel" class="build-panel hidden">
    <div class="bottom-sheet-handle"></div>
    <div class="build-panel-header">
      <span class="build-panel-title">Build</span>
      <button class="icon-btn" id="build-close-btn">${icon('close')}</button>
    </div>
    <div id="build-panel-tabs" class="build-panel-tabs"></div>
    <div id="build-panel-content" class="build-panel-content"></div>
  </div>

  <!-- Build Tooltip (desktop hover) -->
  <div id="build-tooltip" class="build-tooltip"></div>

  <!-- Building Detail Sheet (mobile: slides up when tapping a building tile) -->
  <div id="building-detail-sheet" class="building-detail-sheet hidden">
    <div class="bottom-sheet-handle"></div>
    <div id="building-detail-content" class="building-detail-content"></div>
  </div>

  <!-- Building Info Panel (shown when a building is selected) -->
  <div id="info-panel" class="info-panel hidden">
    <div class="bottom-sheet-handle"></div>
    <div class="info-panel-header">
      <span id="info-panel-title" class="info-panel-title"></span>
      <button class="icon-btn" id="info-close-btn">${icon('close')}</button>
    </div>
    <div id="info-panel-content" class="info-panel-content"></div>
  </div>

  <!-- Tech Tree Overlay -->
  <div id="techtree-overlay" class="techtree-overlay hidden"></div>

  <!-- Dashboard Overlay -->
  <div id="dashboard-overlay" class="dashboard-overlay hidden"></div>

  <!-- Statistics Panel (tabbed: resources, pop, buildings, military, economy, priority) -->
  <div id="stats-panel" class="stats-panel hidden">
    <div class="bottom-sheet-handle"></div>
    <div class="stats-panel-header">
      <span class="stats-panel-title">Statistics</span>
      <button class="icon-btn" id="stats-close-btn">${icon('close')}</button>
    </div>
    <div id="stats-panel-tabs" class="stats-panel-tabs"></div>
    <div id="stats-panel-content" class="info-panel-content"></div>
  </div>

  <!-- Placement Info Bar -->
  <div id="placement-bar" class="placement-bar hidden">
    <span id="placement-label"></span>
    <span id="placement-distance" class="placement-distance" style="display:none"></span>
    <button id="placement-cancel-btn" class="btn-text">Cancel (Esc)</button>
  </div>

  <!-- Tooltip -->
  <div id="tooltip" class="game-tooltip" style="display:none"></div>

  <!-- Snackbar -->
  <div id="snackbar" class="snackbar"></div>

  <!-- Alert Bars -->
  <div id="alert-bar" class="alert-bar">
    <div id="tool-alert-bar"></div>
    <div id="capacity-alert-bar"></div>
    <div id="food-alert-bar"></div>
    <div id="alert-bar-badge" class="alert-bar-badge" style="display:none"></div>
  </div>

  <!-- Pause Overlay -->
  <div id="pause-overlay" class="pause-overlay hidden">
    <div class="pause-card">
      <h2 class="pause-title">Paused</h2>
      <p class="pause-hint">Press Space or click Resume to continue</p>
      <button id="pause-resume-btn" class="btn-filled">Resume</button>
    </div>
  </div>

  <!-- Demolish Confirmation Dialog -->
  <div id="demolish-overlay" class="demolish-overlay hidden">
    <div class="demolish-card">
      <h3 class="demolish-title">Demolish Building?</h3>
      <div id="demolish-content"></div>
      <div class="demolish-actions">
        <button id="demolish-cancel-btn" class="btn-outlined">Cancel</button>
        <button id="demolish-confirm-btn" class="btn-filled demolish-confirm-btn">Demolish</button>
      </div>
    </div>
  </div>

  <!-- Game Over Overlay -->
  <div id="game-over-overlay" class="game-over-overlay hidden">
    <div class="game-over-card">
      <h2 id="game-over-title" class="game-over-title"></h2>
      <p id="game-over-condition" class="game-over-condition"></p>
      <div id="game-over-stats" class="game-over-stats"></div>
      <div class="game-over-actions">
        <button id="game-over-new-game-btn" class="btn-outlined">New Game</button>
        <button id="game-over-continue-btn" class="btn-filled">Continue Watching</button>
      </div>
    </div>
  </div>

  <!-- Game Setup Screen -->
  <div id="setup-overlay" class="setup-overlay">
    <div class="setup-card">
      <div class="setup-crown">${icon('crown')}</div>
      <h1 class="setup-title">Feudal Realm Manager</h1>
      <p class="setup-subtitle">Configure your world and begin your conquest</p>
      <div class="setup-divider"></div>

      <!-- Section 1: World -->
      <div class="setup-section">
        <div class="setup-section-header">
          <span class="setup-section-icon">${icon('map')}</span>
          <span class="setup-section-label">World</span>
        </div>

        <!-- Map Source Tabs -->
        <div class="setup-map-tabs">
          <button class="setup-map-tab active" id="setup-tab-generated">${icon('map')} Generated</button>
          <button class="setup-map-tab" id="setup-tab-custom">${icon('construction')} Custom</button>
          <button class="setup-map-tab" id="setup-tab-campaign">${icon('shield_icon')} Campaign</button>
        </div>

        <!-- Generated map fields -->
        <div id="setup-generated-fields">
          <div class="setup-options-row">
            <div class="setup-field">
              <label class="setup-field-label" for="setup-seed">Map Seed</label>
              <div class="setup-seed-row">
                <input type="number" id="setup-seed" value="42" min="1" max="999999">
                <button id="setup-random-seed" type="button" title="Random seed">&#x1f3b2;</button>
              </div>
            </div>
            <div class="setup-field">
              <label class="setup-field-label" for="setup-map-size">Map Size</label>
              <select id="setup-map-size">
                <option value="24">Small (24x24)</option>
                <option value="32" selected>Medium (32x32)</option>
                <option value="48">Large (48x48)</option>
                <option value="64">Huge (64x64)</option>
              </select>
            </div>
          </div>
          <div class="setup-field">
            <label class="setup-field-label" for="setup-landscape">Landscape</label>
            <select id="setup-landscape">
              <option value="default" selected>Default</option>
              <option value="island">Island</option>
              <option value="continent">Continent</option>
              <option value="archipelago">Archipelago</option>
              <option value="river_valley">River Valley</option>
              <option value="mountain_pass">Mountain Pass</option>
              <option value="oasis">Oasis</option>
              <option value="peninsula">Peninsula</option>
            </select>
            <div id="setup-landscape-desc" class="setup-field-desc">Balanced mix of all terrain types</div>
          </div>
        </div>

        <!-- Custom map fields -->
        <div id="setup-custom-fields" class="hidden">
          <div id="setup-map-gallery" style="margin-bottom:8px;"></div>
          <div style="display:flex;gap:6px;">
            <button class="btn-outlined btn-sm" id="setup-import-map-btn">${icon('folder_open')} Import</button>
            <button class="btn-outlined btn-sm" id="setup-paste-map-btn">${icon('add')} Paste</button>
            <button class="btn-filled btn-sm" id="setup-editor-btn">${icon('construction')} Map Editor</button>
          </div>
        </div>

        <div id="setup-campaign-fields" class="hidden">
          <div id="setup-campaign-list" class="campaign-list"></div>
        </div>
      </div>

      <!-- Section 2: Game -->
      <div class="setup-section">
        <div class="setup-section-header">
          <span class="setup-section-icon">${icon('tune')}</span>
          <span class="setup-section-label">Game</span>
        </div>
        <div class="setup-options-row">
          <div class="setup-field">
            <label class="setup-field-label" for="setup-players">Players</label>
            <select id="setup-players">
              <option value="1" selected>1 Player</option>
              <option value="2">2 Players (1 AI)</option>
              <option value="3">3 Players (2 AI)</option>
              <option value="4">4 Players (3 AI)</option>
            </select>
            <div id="setup-player-colors" class="setup-player-colors">
              <span class="setup-color-dot setup-color-you" style="background:#4488ff;" title="Player 1 (You)"></span>
            </div>
          </div>
          <div class="setup-field">
            <label class="setup-field-label" for="setup-difficulty">Difficulty</label>
            <select id="setup-difficulty">
              <option value="easy">Easy</option>
              <option value="normal" selected>Normal</option>
              <option value="hard">Hard</option>
            </select>
            <div id="setup-difficulty-desc" class="setup-field-desc">Balanced AI with mixed economy and military</div>
          </div>
        </div>
      </div>

      <!-- Section 3: Victory Conditions -->
      <div class="setup-section">
        <div class="setup-section-toggle expanded" id="setup-victory-toggle">
          <span class="setup-section-icon">${icon('trophy')}</span>
          <span class="setup-section-label">Victory Conditions</span>
          <span class="setup-section-chevron" id="setup-victory-chevron">${icon('chevron_right')}</span>
        </div>
        <div id="setup-victory-list" class="setup-victory-list expanded">
          <label class="setup-victory-item">
            <span class="setup-victory-icon">${icon('skull')}</span>
            <div class="setup-victory-text">
              <div class="setup-victory-name">Elimination</div>
              <div class="setup-victory-desc">Destroy all enemy castles — last player standing wins (multiplayer only)</div>
            </div>
            <input type="checkbox" id="victory-elimination" class="setup-toggle" checked>
          </label>
          <label class="setup-victory-item">
            <span class="setup-victory-icon">${icon('map')}</span>
            <div class="setup-victory-text">
              <div class="setup-victory-name">Domination</div>
              <div class="setup-victory-desc">Control 75%+ of all claimable land</div>
            </div>
            <input type="checkbox" id="victory-domination" class="setup-toggle" checked>
          </label>
          <label class="setup-victory-item">
            <span class="setup-victory-icon">${icon('crown')}</span>
            <div class="setup-victory-text">
              <div class="setup-victory-name">Economic</div>
              <div class="setup-victory-desc">Accumulate 50+ gold bars across your buildings</div>
            </div>
            <input type="checkbox" id="victory-economic" class="setup-toggle" checked>
          </label>
          <label class="setup-victory-item">
            <span class="setup-victory-icon">${icon('clock')}</span>
            <div class="setup-victory-text">
              <div class="setup-victory-name">Timed</div>
              <div class="setup-victory-desc">Time limit — player with most territory wins</div>
            </div>
            <input type="checkbox" id="victory-timed" class="setup-toggle">
          </label>
          <div class="setup-victory-sub hidden" id="victory-timed-options">
            <label class="setup-victory-sub-label">Time limit (minutes)
              <input type="number" id="victory-timed-minutes" class="setup-field-input-small" value="30" min="5" max="120" step="5">
            </label>
          </div>
          <label class="setup-victory-item">
            <span class="setup-victory-icon">${icon('grain')}</span>
            <div class="setup-victory-text">
              <div class="setup-victory-name">Peaceful</div>
              <div class="setup-victory-desc">First to 100+ goods stored in Castle/Warehouse</div>
            </div>
            <input type="checkbox" id="victory-peaceful" class="setup-toggle">
          </label>
        </div>
      </div>

      <label class="setup-sandbox-row">
        <input type="checkbox" id="setup-sandbox" class="setup-toggle">
        <span class="setup-sandbox-label">Sandbox Mode</span>
        <span class="setup-sandbox-desc">No attacks, no defeat, free building</span>
      </label>

      <button id="setup-start-btn" class="btn-filled setup-start-btn">
        Start Game
      </button>
      <button id="setup-multiplayer-btn" class="btn-outlined setup-start-btn" style="margin-top:8px;">
        Multiplayer (LAN)
      </button>

      <!-- Multiplayer setup panel (hidden by default, toggled by button above) -->
      <div id="setup-mp-section" class="setup-mp-section hidden">
        <div class="setup-map-tabs" style="margin-bottom:12px;">
          <button class="setup-map-tab active" id="setup-mp-tab-host">Host Game</button>
          <button class="setup-map-tab" id="setup-mp-tab-join">Join Game</button>
        </div>

        <!-- Host tab -->
        <div id="setup-mp-host">
          <div class="setup-field">
            <label class="setup-field-label" for="setup-mp-name-host">Your Name</label>
            <input type="text" id="setup-mp-name-host" class="setup-input" value="Player" maxlength="20" placeholder="Enter your name">
          </div>
          <div style="display:flex;gap:12px;">
            <div class="setup-field" style="flex:1;">
              <label class="setup-field-label" for="setup-mp-total">Total Players</label>
              <select id="setup-mp-total" class="setup-input">
                <option value="2" selected>2 Players</option>
                <option value="3">3 Players</option>
                <option value="4">4 Players</option>
              </select>
            </div>
            <div class="setup-field" style="flex:1;">
              <label class="setup-field-label" for="setup-mp-ai">AI Opponents</label>
              <select id="setup-mp-ai" class="setup-input">
                <option value="0" selected>0 (All Human)</option>
                <option value="1">1 AI</option>
              </select>
            </div>
          </div>
          <p id="setup-mp-slots-desc" style="font-size:0.75rem;opacity:0.5;margin:8px 0;">2 human slots to fill. Map settings above will be used.</p>
          <button class="btn-filled" id="setup-mp-create-btn" style="width:100%;">Create Game</button>
        </div>

        <!-- Join tab -->
        <div id="setup-mp-join" class="hidden">
          <div class="setup-field">
            <label class="setup-field-label" for="setup-mp-name-join">Your Name</label>
            <input type="text" id="setup-mp-name-join" class="setup-input" value="Player" maxlength="20" placeholder="Enter your name">
          </div>
          <div class="setup-field">
            <label class="setup-field-label" for="setup-mp-code">Join Link or Room Code</label>
            <input type="text" id="setup-mp-code" class="setup-input" placeholder="ABCD or paste invite link" style="text-transform:uppercase;">
          </div>
          <button class="btn-filled" id="setup-mp-join-btn" style="width:100%;">Join Game</button>
        </div>
      </div>

      <button id="setup-continue-btn" class="btn-outlined setup-start-btn hidden" style="margin-top:8px;">
        Continue Saved Game
      </button>
      ${__NETWORK_URL__ ? `
      <div class="setup-qr-section">
        <div class="setup-qr-divider"></div>
        <div class="setup-qr-label">Scan to play on mobile</div>
        <div class="setup-qr-code">${generateQrSvg(__NETWORK_URL__, 3, 2)}</div>
        <div class="setup-qr-url">${__NETWORK_URL__}</div>
      </div>
      ` : ''}
    </div>
  </div>
`;
}
