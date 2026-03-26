import type { AutoTradeRule } from './types';

/**
 * Evaluate a single auto-trade rule.
 * Returns a trade request if the rule triggers, or null if no action needed.
 */
export interface AutoTradeRequest {
  sellResource: string;
  sellAmount: number;
  buyResource: string;
}

export function evaluateAutoTradeRule(
  rule: AutoTradeRule,
  currentStock: number,
): AutoTradeRequest | null {
  if (!rule.enabled) return null;

  if (rule.action === 'buy' && currentStock < rule.threshold) {
    const needed = Math.min(rule.threshold - currentStock, rule.maxAmount);
    if (needed > 0) {
      return {
        sellResource: rule.exchangeResource,
        sellAmount: needed * 3,
        buyResource: rule.resource,
      };
    }
  } else if (rule.action === 'sell' && currentStock > rule.threshold) {
    const excess = Math.min(currentStock - rule.threshold, rule.maxAmount);
    if (excess > 0) {
      return {
        sellResource: rule.resource,
        sellAmount: excess,
        buyResource: rule.exchangeResource,
      };
    }
  }

  return null;
}
