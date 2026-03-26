import { ResourceType, RESOURCE_PROPERTIES } from '../ResourceType';

// ── Types ────────────────────────────────────────────────────────────────

export interface NPCStock {
  available: number;
  maxStock: number;
  offered: boolean;
}

export interface MerchantDeal {
  id: string;
  type: 'bulk_buy' | 'bulk_sell' | 'swap' | 'rare';
  offerResource: ResourceType;
  offerAmount: number;
  costResource: ResourceType;
  costAmount: number;
  remaining: number;
}

export interface TravelingMerchant {
  active: boolean;
  arrivalTime: number;
  departureTime: number;
  deals: MerchantDeal[];
}

export interface AutoTradeRule {
  resource: ResourceType;
  action: 'buy' | 'sell';
  threshold: number;
  maxAmount: number;
  exchangeResource: ResourceType;
  enabled: boolean;
}

export interface TradeResult {
  success: boolean;
  error?: 'no_market' | 'no_worker' | 'cooldown' | 'insufficient_stock' |
          'npc_out_of_stock' | 'too_large' | 'disabled' | 'zero_result';
  sold: { resource: ResourceType; amount: number };
  received: { resource: ResourceType; amount: number };
  fee: number;
  priceShift: number;
}

export interface TradePreview {
  amountReceived: number;
  exchangeRate: number;
  fee: number;
  effectiveSellValue: number;
  effectiveBuyValue: number;
  priceImpact: 'none' | 'low' | 'medium' | 'high';
}

export interface TradeEvent {
  timestamp: number;
  sold: { resource: ResourceType; amount: number };
  received: { resource: ResourceType; amount: number };
  venue: 'market' | 'castle' | 'merchant';
}

export interface MarketplaceState {
  version: 1;
  priceMultipliers: Record<number, Record<string, number>>;
  npcStock: Record<number, Record<string, NPCStock>>;
  autoTradeRules: Record<number, AutoTradeRule[]>;
  travelingMerchant: Record<number, TravelingMerchant>;
  tradeHistory: Record<number, TradeEvent[]>;
  restockTimer: number;
  merchantTimer: number;
  autoTradeTimer: number;
  elapsedTime: number;
  lastTradeTime: Record<number, Record<string, number>>;
}

// ── All tradeable resources ──────────────────────────────────────────────

export const ALL_TRADEABLE: ResourceType[] = Object.keys(RESOURCE_PROPERTIES) as ResourceType[];
