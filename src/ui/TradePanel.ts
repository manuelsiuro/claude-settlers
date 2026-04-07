/**
 * Trade panel UI — generates HTML sections for the InfoPanel
 * when a Market or Castle building is selected.
 */
import type { Game } from '../engine/Game';
import type { Building } from '../game/Building';
import { BuildingType } from '../game/BuildingType';
import { BuildingState } from '../game/Building';
import { ResourceType, RESOURCE_PROPERTIES } from '../game/ResourceType';
import { resourceIcon, icon } from './icons';
import type { PanelUpdater } from './PanelUpdater';
import type { MarketplaceManager, TravelingMerchant, AutoTradeRule } from '../game/MarketplaceManager';
import { showSnackbar } from './Snackbar';
import {
  MARKETPLACE_FEE,
  CASTLE_TRADE_FEE,
  CASTLE_TRADE_ENABLED,
  AUTOTRADE_MAX_RULES,
} from '../game/data/balanceConstants';

// ── State ────────────────────────────────────────────────────────────────

let selectedSellResource: ResourceType = ResourceType.Wood;
let selectedBuyResource: ResourceType = ResourceType.Stone;
let sellAmount = 5;

/** Get a reference to the game's MarketplaceManager */
let getGameFn: (() => Game) | null = null;

export function initTradePanel(gf: () => Game): void {
  getGameFn = gf;
}

function getMarketplace(): MarketplaceManager | null {
  return getGameFn?.().getMarketplaceManager() ?? null;
}

// ── Trade support check ──────────────────────────────────────────────────

export function canTrade(building: Building): boolean {
  if (building.state !== BuildingState.Active) return false;
  if (building.type === BuildingType.Market) return building.hasWorker;
  if (building.type === BuildingType.Castle) return CASTLE_TRADE_ENABLED;
  return false;
}

function getVenue(building: Building): 'market' | 'castle' {
  return building.type === BuildingType.Market ? 'market' : 'castle';
}

// ── Tradeable resources ──────────────────────────────────────────────────

function getTradeableResources(): ResourceType[] {
  return Object.keys(RESOURCE_PROPERTIES) as ResourceType[];
}

// ── Structure key contribution ───────────────────────────────────────────

export function getTradeStructureKey(building: Building): string {
  if (!canTrade(building)) return '';
  const mp = getMarketplace();
  if (!mp) return 'trade:none';

  const venue = getVenue(building);
  const merchant = mp.getMerchant(building.playerId);
  // Only track structural changes: merchant presence and deal count (not remaining amounts)
  const merchantActive = merchant?.active ? 1 : 0;
  const dealCount = merchant?.active
    ? merchant.deals.filter(d => d.remaining > 0).length : 0;
  const available = venue === 'market'
    ? mp.getAvailableResources(building.playerId).length : 0;
  const rules = venue === 'market'
    ? mp.getAutoTradeRules(building.playerId).length : 0;

  return `trade|${venue}|${merchantActive}|d:${dealCount}|a:${available}|r:${rules}`;
}

// ── HTML generation ──────────────────────────────────────────────────────

export function generateTradeHTML(building: Building): string {
  if (!canTrade(building)) return '';

  const mp = getMarketplace();
  if (!mp) return '';

  const venue = getVenue(building);
  const playerId = building.playerId;
  const fee = venue === 'castle' ? CASTLE_TRADE_FEE : MARKETPLACE_FEE;
  const preview = mp.previewTrade(playerId, selectedSellResource, sellAmount, selectedBuyResource, venue);
  const cooldownLeft = mp.getCooldownRemaining(playerId, venue);
  const allResources = getTradeableResources();
  const merchant = mp.getMerchant(playerId);

  let html = '';

  // ── Trade Section ──
  html += `<div class="info-section">
    <div class="info-section-label">${icon('tune')} ${venue === 'castle' ? 'Quick Trade' : 'Barter Trade'}</div>`;

  if (venue === 'castle') {
    html += `<div class="trade-fee-notice">Castle fee: ${Math.round(fee * 100)}% — build a Market for better rates</div>`;
  }

  // Sell selector
  html += `<div class="trade-row-label">SELL</div>
    <div class="trade-selector">
      <select class="trade-resource-select" data-trade-role="sell">
        ${allResources.map(r => `<option value="${r}" ${r === selectedSellResource ? 'selected' : ''}>${RESOURCE_PROPERTIES[r].label}</option>`).join('')}
      </select>
      <div class="trade-amount-controls">
        <button class="trade-amt-btn" data-trade-amt="-5">-5</button>
        <button class="trade-amt-btn" data-trade-amt="-1">-1</button>
        <span class="trade-amount" data-field="trade-sell-amt">${sellAmount}</span>
        <button class="trade-amt-btn" data-trade-amt="1">+1</button>
        <button class="trade-amt-btn" data-trade-amt="5">+5</button>
      </div>
    </div>`;

  // Exchange arrow
  const rateLabel = preview.exchangeRate > 0 ? preview.exchangeRate.toFixed(2) : '—';
  html += `<div class="trade-exchange-row">
      <span class="trade-exchange-icon">⇅</span>
      <span class="trade-exchange-rate" data-field="trade-rate">Rate: ${rateLabel}</span>
      <span class="trade-fee" data-field="trade-fee">Fee: ${Math.round(fee * 100)}%</span>
    </div>`;

  // Buy selector
  html += `<div class="trade-row-label">RECEIVE</div>
    <div class="trade-selector">
      <select class="trade-resource-select" data-trade-role="buy">
        ${allResources.map(r => `<option value="${r}" ${r === selectedBuyResource ? 'selected' : ''}>${RESOURCE_PROPERTIES[r].label}</option>`).join('')}
      </select>
      <div class="trade-result">
        <span data-field="trade-buy-icon">${resourceIcon(selectedBuyResource, 20)}</span>
        <span class="trade-result-amount" data-field="trade-receive-amt">${preview.amountReceived}</span>
      </div>
    </div>`;

  // Price impact
  const impactColors: Record<string, string> = { none: 'var(--color-positive)', low: 'var(--color-positive)', medium: 'var(--color-warning)', high: 'var(--color-critical)' };
  html += `<div class="trade-impact" data-field="trade-impact" style="color:${impactColors[preview.priceImpact] ?? '#4CAF50'}">
      Price impact: <span data-field="trade-impact-text">${preview.priceImpact}</span>
    </div>`;

  // Confirm button
  const canExecute = preview.amountReceived > 0 && cooldownLeft <= 0;
  const cooldownText = cooldownLeft > 0 ? ` (${Math.ceil(cooldownLeft)}s)` : '';
  html += `<button class="btn-filled trade-confirm-btn" data-trade-action="confirm" data-building-id="${building.id}"${canExecute ? '' : ' disabled'}>
      ${preview.amountReceived > 0 ? `Trade ${sellAmount} ${RESOURCE_PROPERTIES[selectedSellResource].label} → ${preview.amountReceived} ${RESOURCE_PROPERTIES[selectedBuyResource].label}` : 'Insufficient for trade'}${cooldownText}
    </button>`;

  html += '</div>';

  // ── Merchant Deals Section ──
  if (merchant?.active && venue === 'market') {
    const timeLeft = Math.max(0, Math.ceil(merchant.departureTime - (getGameFn?.().getEconomyTracker().getGameTime() ?? 0)));
    html += generateMerchantHTML(merchant, building, timeLeft);
  }

  // ── NPC Stock Section (market only) ──
  if (venue === 'market') {
    const available = mp.getAvailableResources(playerId);
    if (available.length > 0) {
      html += `<div class="info-section">
        <div class="info-section-label">${icon('warehouse')} NPC Stock</div>`;
      for (const res of available.slice(0, 8)) {
        const stock = mp.getNPCStock(playerId, res);
        const label = RESOURCE_PROPERTIES[res]?.label ?? res;
        html += `<div class="info-resource-row">
          <span class="info-resource-name">${resourceIcon(res)} ${label}</span>
          <span class="info-resource-amount" data-field="npc-stock-${res}">${stock}</span>
        </div>`;
      }
      if (available.length > 8) {
        html += `<div class="info-empty">+${available.length - 8} more resources available</div>`;
      }
      html += '</div>';
    }
  }

  // ── Auto-Trade Rules Section (market only) ──
  if (venue === 'market') {
    html += generateAutoTradeHTML(building);
  }

  // ── Price Trends Section ──
  html += generatePriceTrendsHTML(building);

  return html;
}

function generateMerchantHTML(merchant: TravelingMerchant, building: Building, timeLeft: number): string {
  let html = `<div class="info-section trade-merchant-section">
    <div class="info-section-label">${icon('crown')} Traveling Merchant
      <span class="trade-merchant-timer" data-field="merchant-timer">${timeLeft}s</span>
    </div>`;

  for (const deal of merchant.deals) {
    if (deal.remaining <= 0) continue;
    const offerLabel = RESOURCE_PROPERTIES[deal.offerResource]?.label ?? deal.offerResource;
    const costLabel = RESOURCE_PROPERTIES[deal.costResource]?.label ?? deal.costResource;

    html += `<div class="trade-deal">
      <div class="trade-deal-offer">
        ${resourceIcon(deal.costResource)} ${deal.costAmount} ${costLabel}
        <span class="trade-deal-arrow">→</span>
        ${resourceIcon(deal.offerResource)} ${deal.offerAmount} ${offerLabel}
        <span class="trade-deal-remaining" data-field="deal-remaining-${deal.id}">(${deal.remaining} left)</span>
      </div>
      <button class="btn-outlined trade-deal-btn" data-trade-action="accept-deal" data-deal-id="${deal.id}" data-building-id="${building.id}">
        Accept
      </button>
    </div>`;
  }

  html += '</div>';
  return html;
}

function generatePriceTrendsHTML(building: Building): string {
  const mp = getMarketplace();
  if (!mp) return '';

  const playerId = building.playerId;
  const resources: { res: ResourceType; mul: number }[] = [];
  for (const r of getTradeableResources()) {
    const mul = mp.getPriceMultiplier(playerId, r);
    if (mul !== 1.0) resources.push({ res: r, mul });
  }

  if (resources.length === 0) return '';

  resources.sort((a, b) => a.mul - b.mul);

  let html = `<div class="info-section">
    <div class="info-section-label">${icon('bar_chart')} Price Trends</div>`;

  for (const { res, mul } of resources.slice(0, 6)) {
    const label = RESOURCE_PROPERTIES[res]?.label ?? res;
    const pct = Math.round(mul * 100);
    const color = mul < 1.0 ? 'var(--color-positive)' : mul > 1.0 ? 'var(--color-negative)' : 'var(--color-on-surface-faint)';
    const tag = mul < 0.9 ? 'cheap' : mul > 1.1 ? 'expensive' : 'normal';
    html += `<div class="info-resource-row">
      <span class="info-resource-name">${resourceIcon(res)} ${label}</span>
      <span class="info-resource-amount" style="color:${color}" data-field="price-trend-${res}">${pct}% (${tag})</span>
    </div>`;
  }

  html += '</div>';
  return html;
}

function generateAutoTradeHTML(building: Building): string {
  const mp = getMarketplace();
  if (!mp) return '';

  const playerId = building.playerId;
  const rules = mp.getAutoTradeRules(playerId);
  const allResources = getTradeableResources();
  const canAdd = rules.length < AUTOTRADE_MAX_RULES;

  let html = `<div class="info-section">
    <div class="info-section-label">${icon('settings')} Auto-Trade Rules
      <span class="trade-merchant-timer">${rules.length}/${AUTOTRADE_MAX_RULES}</span>
    </div>`;

  // Existing rules
  if (rules.length === 0) {
    html += '<div class="info-empty">No rules — add one below</div>';
  } else {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const resLabel = RESOURCE_PROPERTIES[rule.resource]?.label ?? rule.resource;
      const exchLabel = RESOURCE_PROPERTIES[rule.exchangeResource]?.label ?? rule.exchangeResource;
      const actionLabel = rule.action === 'buy'
        ? `Buy ${resLabel} when < ${rule.threshold}`
        : `Sell ${resLabel} when > ${rule.threshold}`;
      const exchDesc = rule.action === 'buy' ? `pay with ${exchLabel}` : `receive ${exchLabel}`;
      const enabledClass = rule.enabled ? '' : ' autotrade-rule-disabled';

      html += `<div class="autotrade-rule${enabledClass}">
        <div class="autotrade-rule-info">
          <div class="autotrade-rule-action">${resourceIcon(rule.resource)} ${actionLabel}</div>
          <div class="autotrade-rule-detail">${exchDesc} (max ${rule.maxAmount}/trade)</div>
        </div>
        <div class="autotrade-rule-controls">
          <button class="autotrade-toggle-btn" data-autotrade-action="toggle" data-rule-index="${i}" title="${rule.enabled ? 'Disable' : 'Enable'}">
            ${rule.enabled ? '✓' : '○'}
          </button>
          <button class="autotrade-delete-btn" data-autotrade-action="delete" data-rule-index="${i}" title="Delete">
            ×
          </button>
        </div>
      </div>`;
    }
  }

  // Add new rule form
  if (canAdd) {
    html += `<div class="autotrade-add-form">
      <div class="autotrade-add-row">
        <select class="trade-resource-select autotrade-select" data-autotrade-field="action">
          <option value="buy">Buy when low</option>
          <option value="sell">Sell when high</option>
        </select>
        <select class="trade-resource-select autotrade-select" data-autotrade-field="resource">
          ${allResources.slice(0, 20).map(r => `<option value="${r}">${RESOURCE_PROPERTIES[r].label}</option>`).join('')}
        </select>
      </div>
      <div class="autotrade-add-row">
        <label class="autotrade-label">Threshold
          <input type="number" class="autotrade-input" data-autotrade-field="threshold" value="10" min="1" max="99">
        </label>
        <label class="autotrade-label">Exchange for
          <select class="trade-resource-select autotrade-select" data-autotrade-field="exchangeResource">
            ${allResources.slice(0, 20).map(r => `<option value="${r}" ${r === ResourceType.Wood ? 'selected' : ''}>${RESOURCE_PROPERTIES[r].label}</option>`).join('')}
          </select>
        </label>
      </div>
      <button class="btn-outlined autotrade-add-btn" data-autotrade-action="add" data-building-id="${building.id}" style="width:100%;margin-top:4px">
        + Add Rule
      </button>
    </div>`;
  }

  html += '</div>';
  return html;
}

// ── Value updates ────────────────────────────────────────────────────────

export function updateTradeValues(building: Building, updater: PanelUpdater): void {
  if (!canTrade(building)) return;

  const mp = getMarketplace();
  if (!mp) return;

  const venue = getVenue(building);
  const playerId = building.playerId;
  const preview = mp.previewTrade(playerId, selectedSellResource, sellAmount, selectedBuyResource, venue);
  const cooldownLeft = mp.getCooldownRemaining(playerId, venue);

  // Patch select element values (preserves dropdown state across value updates)
  const container = updater.getContainer();
  const sellSelect = container.querySelector('[data-trade-role="sell"]') as HTMLSelectElement | null;
  if (sellSelect && sellSelect.value !== selectedSellResource) {
    sellSelect.value = selectedSellResource;
  }
  const buySelect = container.querySelector('[data-trade-role="buy"]') as HTMLSelectElement | null;
  if (buySelect && buySelect.value !== selectedBuyResource) {
    buySelect.value = selectedBuyResource;
  }

  // Patch buy icon
  updater.setHTML('trade-buy-icon', resourceIcon(selectedBuyResource, 20));

  updater.setText('trade-sell-amt', String(sellAmount));
  updater.setText('trade-receive-amt', String(preview.amountReceived));
  updater.setText('trade-rate', `Rate: ${preview.exchangeRate > 0 ? preview.exchangeRate.toFixed(2) : '—'}`);

  const impactColors: Record<string, string> = { none: 'var(--color-positive)', low: 'var(--color-positive)', medium: 'var(--color-warning)', high: 'var(--color-critical)' };
  updater.setColor('trade-impact', impactColors[preview.priceImpact] ?? '#4CAF50');
  updater.setText('trade-impact-text', preview.priceImpact);

  // Update merchant timer and deal remaining
  const merchant = mp.getMerchant(playerId);
  if (merchant?.active) {
    const gameTime = getGameFn?.().getEconomyTracker().getGameTime() ?? 0;
    const timeLeft = Math.max(0, Math.ceil(merchant.departureTime - gameTime));
    updater.setText('merchant-timer', `${timeLeft}s`);
    for (const deal of merchant.deals) {
      updater.setText(`deal-remaining-${deal.id}`, `(${deal.remaining} left)`);
    }
  }

  // Update NPC stock counts
  if (venue === 'market') {
    for (const res of mp.getAvailableResources(playerId).slice(0, 8)) {
      updater.setText(`npc-stock-${res}`, String(mp.getNPCStock(playerId, res)));
    }
  }

  // Update price trends
  for (const r of getTradeableResources()) {
    const mul = mp.getPriceMultiplier(playerId, r);
    if (mul !== 1.0) {
      const pct = Math.round(mul * 100);
      const color = mul < 1.0 ? 'var(--color-positive)' : mul > 1.0 ? 'var(--color-negative)' : 'var(--color-on-surface-faint)';
      const tag = mul < 0.9 ? 'cheap' : mul > 1.1 ? 'expensive' : 'normal';
      updater.setText(`price-trend-${r}`, `${pct}% (${tag})`);
      updater.setColor(`price-trend-${r}`, color);
    }
  }

  // Update cooldown on confirm button
  const confirmBtn = container.querySelector('.trade-confirm-btn') as HTMLButtonElement | null;
  if (confirmBtn) {
    const canExecute = preview.amountReceived > 0 && cooldownLeft <= 0;
    confirmBtn.disabled = !canExecute;
    const cooldownText = cooldownLeft > 0 ? ` (${Math.ceil(cooldownLeft)}s)` : '';
    confirmBtn.textContent = preview.amountReceived > 0
      ? `Trade ${sellAmount} ${RESOURCE_PROPERTIES[selectedSellResource].label} → ${preview.amountReceived} ${RESOURCE_PROPERTIES[selectedBuyResource].label}${cooldownText}`
      : `Insufficient for trade${cooldownText}`;
  }
}

// ── Event handling ───────────────────────────────────────────────────────

/** Handle click events delegated from InfoPanel. Returns true if handled. */
export function handleTradeClick(target: HTMLElement, building: Building): boolean {
  const mp = getMarketplace();
  if (!mp) return false;
  const venue = getVenue(building);

  // Amount buttons
  const amtBtn = target.closest('.trade-amt-btn') as HTMLElement | null;
  if (amtBtn?.dataset.tradeAmt) {
    const delta = parseInt(amtBtn.dataset.tradeAmt, 10);
    sellAmount = Math.max(1, Math.min(99, sellAmount + delta));
    return true;
  }

  // Confirm trade
  const confirmBtn = target.closest('.trade-confirm-btn') as HTMLElement | null;
  if (confirmBtn?.dataset.tradeAction === 'confirm') {
    const game = getGameFn?.();
    if (game) {
      const result = game.executeCommand({
        type: 'MarketplaceTrade',
        playerId: building.playerId,
        sellResource: selectedSellResource,
        sellAmount,
        buyResource: selectedBuyResource,
        venue,
      });
      if (!result.success) {
        showTradeError(result.error);
      }
    }
    return true;
  }

  // Accept merchant deal
  const dealBtn = target.closest('.trade-deal-btn') as HTMLElement | null;
  if (dealBtn?.dataset.tradeAction === 'accept-deal' && dealBtn?.dataset.dealId) {
    const game = getGameFn?.();
    if (game) {
      const result = game.executeCommand({
        type: 'AcceptDeal',
        playerId: building.playerId,
        dealId: dealBtn.dataset.dealId,
      });
      if (!result.success) {
        showTradeError(result.error);
      }
    }
    return true;
  }

  // Auto-trade: toggle rule
  const toggleBtn = target.closest('[data-autotrade-action="toggle"]') as HTMLElement | null;
  if (toggleBtn?.dataset.ruleIndex !== undefined) {
    const idx = parseInt(toggleBtn.dataset.ruleIndex, 10);
    const rules = mp.getAutoTradeRules(building.playerId);
    if (rules[idx]) {
      const game = getGameFn?.();
      if (game) {
        game.executeCommand({
          type: 'UpdateAutoTradeRule',
          playerId: building.playerId,
          ruleIndex: idx,
          updates: { enabled: !rules[idx].enabled },
        });
      }
    }
    return true;
  }

  // Auto-trade: delete rule
  const deleteBtn = target.closest('[data-autotrade-action="delete"]') as HTMLElement | null;
  if (deleteBtn?.dataset.ruleIndex !== undefined) {
    const game = getGameFn?.();
    if (game) {
      game.executeCommand({
        type: 'RemoveAutoTradeRule',
        playerId: building.playerId,
        ruleIndex: parseInt(deleteBtn.dataset.ruleIndex, 10),
      });
    }
    return true;
  }

  // Auto-trade: add rule
  const addBtn = target.closest('[data-autotrade-action="add"]') as HTMLElement | null;
  if (addBtn) {
    const form = addBtn.closest('.autotrade-add-form');
    if (form) {
      const action = (form.querySelector('[data-autotrade-field="action"]') as HTMLSelectElement)?.value as 'buy' | 'sell';
      const resource = (form.querySelector('[data-autotrade-field="resource"]') as HTMLSelectElement)?.value as ResourceType;
      const threshold = parseInt((form.querySelector('[data-autotrade-field="threshold"]') as HTMLInputElement)?.value ?? '10', 10);
      const exchangeResource = (form.querySelector('[data-autotrade-field="exchangeResource"]') as HTMLSelectElement)?.value as ResourceType;

      const rule: AutoTradeRule = {
        resource,
        action,
        threshold: Math.max(1, Math.min(99, threshold)),
        maxAmount: 5,
        exchangeResource,
        enabled: true,
      };
      const game = getGameFn?.();
      if (game) {
        const result = game.executeCommand({
          type: 'AddAutoTradeRule',
          playerId: building.playerId,
          rule,
        });
        if (!result.success) {
          showSnackbar(`Max ${AUTOTRADE_MAX_RULES} auto-trade rules`, 'warning');
        }
      }
    }
    return true;
  }

  return false;
}

/** Handle change events on resource selectors. Returns true if handled. */
export function handleTradeChange(target: HTMLElement): boolean {
  const select = target.closest('.trade-resource-select') as HTMLSelectElement | null;
  if (!select) return false;

  const role = select.dataset.tradeRole;
  const value = select.value as ResourceType;

  if (role === 'sell') {
    selectedSellResource = value;
    return true;
  } else if (role === 'buy') {
    selectedBuyResource = value;
    return true;
  }
  return false;
}

function showTradeError(error: string): void {
  const messages: Record<string, string> = {
    no_market: 'No active Market building',
    no_worker: 'Market needs a Merchant worker',
    cooldown: 'Trade on cooldown',
    insufficient_stock: 'Not enough resources',
    npc_out_of_stock: 'NPC out of stock for this resource',
    too_large: 'Trade too large',
    disabled: 'Castle trading is disabled',
    zero_result: 'Trade amount too small',
  };
  showSnackbar(messages[error] ?? `Trade failed: ${error}`, 'error');
}

/** Reset trade panel state (called when panel closes) */
export function resetTradeState(): void {
  sellAmount = 5;
}
