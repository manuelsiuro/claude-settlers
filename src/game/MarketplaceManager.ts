/**
 * Barrel re-export — preserves the original import path for all consumers.
 * The implementation has been split into src/game/marketplace/.
 */
export { MarketplaceManager } from './marketplace/MarketplaceManager';
export type {
  NPCStock,
  MerchantDeal,
  TravelingMerchant,
  AutoTradeRule,
  TradeResult,
  TradePreview,
  TradeEvent,
  MarketplaceState,
} from './marketplace/types';
export { ALL_TRADEABLE } from './marketplace/types';
