/**
 * DashboardPanel — thin re-export facade.
 *
 * All logic has been split into focused sub-modules under `./dashboard/`:
 *   - DashboardController  — orchestrator (init, show, close, tab switching, update interval)
 *   - OverviewTab           — Overview tab rendering & charts
 *   - EconomyTab            — Economy tab rendering & charts
 *   - ResourcesTab          — Resources tab rendering & charts
 *   - PopulationTab         — Population tab rendering & charts
 *   - BuildingsTab          — Buildings tab rendering & charts
 *   - dashboardHelpers      — shared helpers (resource queries, filters, constants)
 *
 * Consumers import from this file and get the same public API as before.
 */
export { initDashboard, showDashboard, closeDashboard } from './dashboard/DashboardController';
