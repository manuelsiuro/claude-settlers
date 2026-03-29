import { audioManager } from '../engine/AudioManager';
import type { Game } from '../engine/Game';
import { Minimap } from '../engine/Minimap';
import type { Building } from '../game/Building';
import { BUILDING_DEFINITIONS } from '../game/BuildingType';
import type { Flag } from '../game/RoadNetwork';
import { getPopulationSeverity } from '../game/data/balanceConstants';

// ============================================================
// Mobile Toolbar Wiring
// ============================================================

export interface MobileToolbarDeps {
  getGame: () => Game | undefined;
  toggleBuildPanel: () => void;
  showStatsPanel: (tab?: string) => void;
  closeStatsPanel: () => void;
}

export function wireMobileToolbar(deps: MobileToolbarDeps): void {
  const mtBuild = document.getElementById('mt-build')!;
  const mtStats = document.getElementById('mt-stats')!;
  const mtSpeed = document.getElementById('mt-speed')!;
  const mtMenu = document.getElementById('mt-menu')!;

  mtBuild.addEventListener('click', () => {
    audioManager.play('ui_click');
    deps.toggleBuildPanel();
  });

  mtStats.addEventListener('click', () => {
    audioManager.play('ui_click');
    if (document.getElementById('stats-panel')!.classList.contains('hidden')) {
      deps.showStatsPanel('economy');
    } else {
      deps.closeStatsPanel();
    }
  });

  mtSpeed.addEventListener('click', () => {
    const game = deps.getGame();
    if (!game) return;
    audioManager.play('ui_click');
    if (game.paused) {
      game.setPaused(false);
    } else {
      game.cycleSpeed();
    }
  });

  mtMenu.addEventListener('click', () => {
    audioManager.play('ui_click');
    const sidePanel = document.getElementById('side-panel')!;
    const navOverlay = document.getElementById('nav-overlay')!;
    if (sidePanel.classList.contains('open')) {
      sidePanel.classList.remove('open');
      navOverlay.classList.remove('open');
    } else {
      sidePanel.classList.add('open');
      navOverlay.classList.add('open');
    }
  });
}

// ============================================================
// Game Controllers Wiring
// ============================================================

export interface GameControllerDeps {
  game: Game;
  showSnackbar: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  showInfoPanel: (building: Building) => void;
  showFlagInfoPanel: (flag: Flag) => void;
  hideInfoPanelElement: () => void;
  stopInfoPanelUpdates: () => void;
  closeInfoPanel: () => void;
  getPlacementElements: () => {
    placementBar: HTMLElement;
    placementLabel: HTMLElement;
    placementDistanceEl: HTMLElement;
  };
  populateBuildPanel: () => void;
  setupGameControlsPosition: (minimapContainer: HTMLElement) => void;
  initDayCycleWidget: (getGame: () => Game, container: HTMLElement) => void;
  initVictoryProgressHUD: (getGame: () => Game) => void;
  getGame: () => Game;
}

export interface GameControllerResult {
  minimap: Minimap;
  popCounterInterval: ReturnType<typeof setInterval>;
}

export function wireGameControllers(deps: GameControllerDeps): GameControllerResult {
  const { game } = deps;

  // Wire placement controller callbacks
  const placement = game.getPlacementController();
  if (placement) {
    const { placementBar, placementDistanceEl } = deps.getPlacementElements();

    placement.onBuildingPlaced = (type) => {
      const def = BUILDING_DEFINITIONS[type];
      deps.showSnackbar(`${def.label} placed!`, 'success');
      audioManager.play('building_placed');
    };
    placement.onPlacementError = (error) => {
      const messages: Record<string, string> = {
        no_matching_deposit: 'Requires a prospected deposit — use a Geologist\'s Hut first',
        outside_territory: 'Outside your territory',
        invalid_terrain: 'Can\'t build here — invalid terrain',
        tile_occupied: 'Tile is already occupied',
        no_adjacent_terrain: 'No suitable terrain nearby',
        tile_not_found: 'Invalid tile',
      };
      deps.showSnackbar(messages[error] ?? `Can't place here: ${error}`, 'error');
    };
    placement.onModeChanged = (active) => {
      if (!active) {
        placementBar.classList.add('hidden');
        placementDistanceEl.style.display = 'none';
      }
      if (active) {
        deps.closeInfoPanel();
      }
      // Coordinate with camera: suppress single-finger pan during placement
      const cam = game.getCameraController();
      if (cam) cam.placementActive = active;
    };
    placement.onPreviewUpdated = () => {
      const dist = placement.placementDistance;
      const rating = placement.placementRating;
      const hex = placement.currentPreviewHex;
      let info = '';

      if (dist !== null && rating) {
        info = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${rating.color};margin-right:4px;vertical-align:middle"></span>` +
          `Distance: ${dist} tile${dist !== 1 ? 's' : ''} — ${rating.label}`;
      }

      // Check if any flag is within 2 hexes — warn if not connected
      if (hex) {
        const flags = game.getRoadNetwork().getAllFlags();
        const pid = game.getHumanPlayerId();
        const nearbyFlag = flags.some(f => {
          if (f.playerId !== pid) return false;
          const d = Math.abs(f.coord.q - hex.q) + Math.abs(f.coord.r - hex.r) + Math.abs(f.coord.q + f.coord.r - hex.q - hex.r);
          return d / 2 <= 2;
        });
        if (!nearbyFlag && flags.length > 0) {
          info += (info ? '<br>' : '') + '<span style="color:#f59e0b">No flag nearby — place a flag to connect this building</span>';
        }
      }

      if (info) {
        placementDistanceEl.style.display = '';
        placementDistanceEl.style.color = rating?.color ?? '';
        placementDistanceEl.innerHTML = info;
      } else {
        placementDistanceEl.style.display = 'none';
      }
    };
  }

  // Wire marketplace merchant arrival notification
  const marketplace = game.getMarketplaceManager();
  const humanPid = game.getHumanPlayerId();
  marketplace.onMerchantArrival = (playerId) => {
    if (playerId === humanPid) {
      deps.showSnackbar('A traveling merchant has arrived at your Market!', 'info');
    }
  };

  // Wire selection controller
  const selection = game.getSelectionController();
  if (selection) {
    const g = game;
    selection.onSelectionChanged = (building) => {
      if (building) {
        deps.showInfoPanel(building);
        g.getProductionChainOverlay().show(building, g.getGameState());
        g.showWorkArea(building);
      } else {
        deps.hideInfoPanelElement();
        deps.stopInfoPanelUpdates();
        g.getProductionChainOverlay().clear();
        g.hideWorkArea();
      }
    };
    selection.onFlagSelected = (flag) => {
      if (flag) {
        deps.showFlagInfoPanel(flag);
      } else {
        deps.hideInfoPanelElement();
        deps.stopInfoPanelUpdates();
      }
    };
  }

  // Wire road placement controller
  const roadCtrl = game.getRoadPlacementController();
  if (roadCtrl) {
    const { placementBar, placementLabel } = deps.getPlacementElements();

    roadCtrl.onModeChanged = (mode) => {
      if (!mode) {
        placementBar.classList.add('hidden');
      }
    };
    roadCtrl.onFlagPlaced = () => {
      deps.showSnackbar('Flag placed!', 'success');
      audioManager.play('flag_placed');
    };
    roadCtrl.onRoadBuilt = () => {
      deps.showSnackbar('Road built!', 'success');
      audioManager.play('road_built');
      placementLabel.textContent = 'Building Road — click next hex to continue';
    };
  }

  // Wire population + morale counter updates
  const popCounterText = document.getElementById('pop-counter-text')!;
  const popCounterEl = document.getElementById('pop-counter')!;
  const moraleCounterText = document.getElementById('morale-counter-text')!;
  const moraleCounterEl = document.getElementById('morale-counter')!;
  const popCounterInterval = setInterval(() => {
    const pid = game.getHumanPlayerId();
    // Population
    const popMgr = game.getPopulationManager();
    const current = popMgr.getCurrentPopulation(pid);
    const capacity = popMgr.getCapacity(pid);
    popCounterText.textContent = `${current}/${capacity}`;
    const severity = getPopulationSeverity(popMgr.getUsageRatio(pid));
    popCounterEl.classList.toggle('pop-warning', severity === 'warning');
    popCounterEl.classList.toggle('pop-critical', severity === 'critical');
    // Morale
    const morale = game.getMoraleManager().getMorale(pid);
    const moralePct = Math.round(morale * 100);
    moraleCounterText.textContent = `${moralePct}%`;
    moraleCounterEl.classList.toggle('morale-high', morale >= 0.7);
    moraleCounterEl.classList.toggle('morale-low', morale < 0.4);
  }, 1000);

  const minimapContainer = document.getElementById('minimap-container')!;
  const minimap = new Minimap(game, minimapContainer);
  deps.initDayCycleWidget(deps.getGame, minimapContainer);
  deps.initVictoryProgressHUD(deps.getGame);
  deps.setupGameControlsPosition(minimapContainer);

  deps.populateBuildPanel();

  return { minimap, popCounterInterval };
}
