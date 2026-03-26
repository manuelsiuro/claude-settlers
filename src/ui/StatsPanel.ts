/**
 * StatsPanel — thin re-export facade.
 *
 * All implementation lives in src/ui/statspanel/:
 *   StatsPanelController.ts — main orchestrator (init, show, close, tabs, update loop)
 *   ResourceStats.ts        — resources tab HTML generation & value updates
 *   PopulationStats.ts      — population/food tab HTML generation & value updates
 *   BuildingStats.ts        — buildings tab HTML generation & value updates
 *   MilitaryStats.ts        — military/morale tab HTML generation & value updates
 */
export {
  initStatsPanel,
  showStatsPanel,
  closeStatsPanel,
  stopStatsPanelUpdates,
  isStatsPanelOpen,
  hideStatsPanelElement,
} from './statspanel/StatsPanelController';
