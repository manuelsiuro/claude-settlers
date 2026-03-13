import type { EconomyTracker } from '../game/EconomyTracker';
import { RESOURCE_PROPERTIES } from '../game/ResourceType';
import type { ResourceType } from '../game/ResourceType';
import { resourceIcon } from './icons';
import { drawSparkline } from './Sparkline';

/**
 * Render the economy section HTML for the stats panel.
 * Shows production/consumption rates, net balance, bottleneck alerts, and sparklines.
 */
export function renderEconomySection(tracker: EconomyTracker): string {
  const activeResources = tracker.getActiveResources();
  if (activeResources.length === 0) return '';

  const bottlenecks = tracker.getBottlenecks();

  let html = '<div class="info-section"><div class="info-section-label">Economy</div>';

  // Bottleneck alert
  if (bottlenecks.length > 0) {
    const names = bottlenecks.map(r => RESOURCE_PROPERTIES[r].label).join(', ');
    html += `<div class="economy-bottleneck-alert">Shortages: ${names}</div>`;
  }

  // Per-resource rates
  for (const r of activeResources) {
    const prod = tracker.getProductionRate(r);
    const cons = tracker.getConsumptionRate(r);
    const net = tracker.getNetBalance(r);
    const props = RESOURCE_PROPERTIES[r];

    const prodStr = prod > 0 ? `<span class="economy-rate-positive">+${prod.toFixed(1)}</span>` : '';
    const consStr = cons > 0 ? `<span class="economy-rate-negative">-${cons.toFixed(1)}</span>` : '';
    const netClass = net >= 0 ? 'economy-net-positive' : 'economy-net-negative';
    const netSign = net >= 0 ? '+' : '';

    html += `<div class="economy-resource-row">
      <span class="info-resource-name">${resourceIcon(r)} ${props.label}</span>
      <span style="display:flex;align-items:center;gap:6px;">
        ${prodStr}${consStr}
        <span class="${netClass}">${netSign}${net.toFixed(1)}</span>
        <canvas class="economy-sparkline" data-resource="${r}" width="60" height="20"></canvas>
      </span>
    </div>`;
  }

  html += '</div>';
  return html;
}

/**
 * Draw sparklines onto canvas elements inside a container.
 * Call this after setting innerHTML.
 */
export function drawEconomySparklines(container: HTMLElement, tracker: EconomyTracker): void {
  const canvases = container.querySelectorAll<HTMLCanvasElement>('.economy-sparkline');
  for (const canvas of canvases) {
    const resource = canvas.dataset.resource as ResourceType;
    if (!resource) continue;

    const prodHistory = tracker.getProductionHistory(resource);
    const consHistory = tracker.getConsumptionHistory(resource);

    // Draw net balance sparkline (production - consumption)
    const netHistory = prodHistory.map((p, i) => p - (consHistory[i] ?? 0));
    if (netHistory.length >= 2) {
      const hasNegative = netHistory.some(v => v < 0);
      drawSparkline(canvas, netHistory, hasNegative ? '#ef5350' : '#66bb6a');
    }
  }
}
