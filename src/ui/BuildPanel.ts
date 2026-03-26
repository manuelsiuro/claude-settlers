/**
 * BuildPanel — Thin re-export facade.
 * All implementation lives in buildpanel/ submodules.
 * This file preserves the original public API so no consumer imports need to change.
 */

// Controller exports (main panel lifecycle + placement)
export {
  initBuildPanel,
  toggleBuildPanel,
  closeBuildPanel,
  stopBuildPanelUpdates,
  disposeBuildPanel,
  populateBuildPanel,
  cancelPlacement,
  getPlacementElements,
  hideBuildPanelElement,
  hidePlacementBar,
  getRecentBuildings,
} from './buildpanel/BuildPanelController';

// Attack mode exports (used by InfoPanel)
export {
  startAttackTargeting,
  cancelAttackTargeting,
  isAttackModeActive,
} from './buildpanel/AttackMode';
