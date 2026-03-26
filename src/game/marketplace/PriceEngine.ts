import { ResourceType } from '../ResourceType';
import type { TradePreview } from './types';
import {
  MARKETPLACE_BASE_VALUES,
  MARKETPLACE_FEE,
  MARKETPLACE_PRICE_SHIFT_BUY,
  MARKETPLACE_PRICE_SHIFT_SELL,
  MARKETPLACE_PRICE_DECAY_RATE,
  MARKETPLACE_PRICE_MIN,
  MARKETPLACE_PRICE_MAX,
  CASTLE_TRADE_FEE,
} from '../data/balanceConstants';

// ── Stateless pricing functions ──────────────────────────────────────────

/** Decay all price multipliers toward 1.0 by the given delta time. Mutates the map in place. */
export function decayPrices(
  priceMultipliers: Map<number, Map<ResourceType, number>>,
  deltaTime: number,
): void {
  for (const [, resourceMap] of priceMultipliers) {
    for (const [resource, multiplier] of resourceMap) {
      if (multiplier > 1.0) {
        const decayed = Math.max(1.0, multiplier - MARKETPLACE_PRICE_DECAY_RATE * deltaTime);
        resourceMap.set(resource, decayed);
      } else if (multiplier < 1.0) {
        const decayed = Math.min(1.0, multiplier + MARKETPLACE_PRICE_DECAY_RATE * deltaTime);
        resourceMap.set(resource, decayed);
      }
    }
  }
}

/**
 * Apply price shift after a trade. Selling lowers value, buying raises value.
 * Mutates priceMap in place and returns the total absolute shift.
 */
export function applyPriceShift(
  priceMap: Map<ResourceType, number>,
  sellResource: ResourceType,
  sellAmount: number,
  buyResource: ResourceType,
  buyAmount: number,
): number {
  // Selling lowers value
  const sellCurrent = priceMap.get(sellResource) ?? 1.0;
  const sellNew = Math.max(MARKETPLACE_PRICE_MIN, sellCurrent - MARKETPLACE_PRICE_SHIFT_SELL * sellAmount);
  priceMap.set(sellResource, sellNew);

  // Buying raises value
  const buyCurrent = priceMap.get(buyResource) ?? 1.0;
  const buyNew = Math.min(MARKETPLACE_PRICE_MAX, buyCurrent + MARKETPLACE_PRICE_SHIFT_BUY * buyAmount);
  priceMap.set(buyResource, buyNew);

  return Math.abs(sellCurrent - sellNew) + Math.abs(buyCurrent - buyNew);
}

/** Get the dynamic price multiplier for a resource (defaults to 1.0). */
export function getPriceMultiplier(
  priceMultipliers: Map<number, Map<ResourceType, number>>,
  playerId: number,
  resource: ResourceType,
): number {
  return priceMultipliers.get(playerId)?.get(resource) ?? 1.0;
}

/** Get the base trade value for a resource. */
export function getBaseValue(resource: ResourceType): number {
  return MARKETPLACE_BASE_VALUES[resource] ?? 1;
}

/** Get the exchange rate between two resources (sell to buy), after fee. */
export function getExchangeRate(
  priceMultipliers: Map<number, Map<ResourceType, number>>,
  playerId: number,
  sellResource: ResourceType,
  buyResource: ResourceType,
  venue: 'market' | 'castle',
): number {
  const fee = venue === 'castle' ? CASTLE_TRADE_FEE : MARKETPLACE_FEE;
  const sellMul = getPriceMultiplier(priceMultipliers, playerId, sellResource);
  const buyMul = getPriceMultiplier(priceMultipliers, playerId, buyResource);
  const sellVal = (MARKETPLACE_BASE_VALUES[sellResource] ?? 1) * sellMul;
  const buyVal = (MARKETPLACE_BASE_VALUES[buyResource] ?? 1) * buyMul;
  return (sellVal / buyVal) * (1 - fee);
}

/** Preview a trade: how much would the player receive? */
export function previewTrade(
  priceMultipliers: Map<number, Map<ResourceType, number>>,
  playerId: number,
  sellResource: ResourceType,
  sellAmount: number,
  buyResource: ResourceType,
  venue: 'market' | 'castle',
): TradePreview {
  const fee = venue === 'castle' ? CASTLE_TRADE_FEE : MARKETPLACE_FEE;
  const sellMultiplier = getPriceMultiplier(priceMultipliers, playerId, sellResource);
  const buyMultiplier = getPriceMultiplier(priceMultipliers, playerId, buyResource);
  const sellValue = (MARKETPLACE_BASE_VALUES[sellResource] ?? 1) * sellMultiplier;
  const buyValue = (MARKETPLACE_BASE_VALUES[buyResource] ?? 1) * buyMultiplier;
  const exchangeRate = sellValue / buyValue;
  const amountReceived = Math.floor(sellAmount * exchangeRate * (1 - fee));

  // Estimate price impact
  const totalShift = sellAmount * MARKETPLACE_PRICE_SHIFT_SELL + amountReceived * MARKETPLACE_PRICE_SHIFT_BUY;
  let priceImpact: TradePreview['priceImpact'] = 'none';
  if (totalShift > 0.30) priceImpact = 'high';
  else if (totalShift > 0.15) priceImpact = 'medium';
  else if (totalShift > 0.05) priceImpact = 'low';

  return { amountReceived, exchangeRate, fee, effectiveSellValue: sellValue, effectiveBuyValue: buyValue, priceImpact };
}
