import { ResourceType } from '../ResourceType';
import type { MerchantDeal, TravelingMerchant } from './types';
import { ALL_TRADEABLE } from './types';
import {
  MARKETPLACE_BASE_VALUES,
  MERCHANT_VISIT_DURATION,
  MERCHANT_DEAL_COUNT,
  MERCHANT_DISCOUNT,
} from '../data/balanceConstants';

// ── Seeded random helper (deterministic from game time) ─────────────────

export function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ── Merchant spawning ───────────────────────────────────────────────────

/** Spawn a traveling merchant for a player. Returns the new merchant state. */
export function spawnMerchant(
  playerId: number,
  elapsedTime: number,
): TravelingMerchant {
  const rand = seededRandom(Math.floor(elapsedTime * 997 + playerId * 6271));
  const deals: MerchantDeal[] = [];
  const usedResources = new Set<ResourceType>();

  for (let i = 0; i < MERCHANT_DEAL_COUNT; i++) {
    const deal = generateDeal(playerId, rand, usedResources, i);
    if (deal) {
      deals.push(deal);
      usedResources.add(deal.offerResource);
      usedResources.add(deal.costResource);
    }
  }

  return {
    active: true,
    arrivalTime: elapsedTime,
    departureTime: elapsedTime + MERCHANT_VISIT_DURATION,
    deals,
  };
}

/** Generate a single merchant deal. */
export function generateDeal(
  playerId: number,
  rand: () => number,
  usedResources: Set<ResourceType>,
  index: number,
): MerchantDeal | null {
  const types: MerchantDeal['type'][] = ['bulk_buy', 'bulk_sell', 'swap', 'rare'];
  const type = types[index % types.length];
  const available = ALL_TRADEABLE.filter(r => !usedResources.has(r));
  if (available.length < 2) return null;

  const pick = (exclude?: ResourceType): ResourceType => {
    const pool = exclude ? available.filter(r => r !== exclude) : available;
    return pool[Math.floor(rand() * pool.length)];
  };

  const discountFactor = 1 - MERCHANT_DISCOUNT;
  const offerRes = pick();
  const costRes = pick(offerRes);
  const baseOffer = MARKETPLACE_BASE_VALUES[offerRes] ?? 1;
  const baseCost = MARKETPLACE_BASE_VALUES[costRes] ?? 1;

  switch (type) {
    case 'bulk_buy': {
      const qty = 3 + Math.floor(rand() * 8);
      const costQty = Math.ceil((qty * baseOffer * discountFactor) / baseCost);
      return { id: `deal_${playerId}_${index}`, type, offerResource: offerRes, offerAmount: qty, costResource: costRes, costAmount: costQty, remaining: 1 };
    }
    case 'bulk_sell': {
      const qty = 5 + Math.floor(rand() * 10);
      const offerQty = Math.ceil((qty * baseCost * (1 + MERCHANT_DISCOUNT)) / baseOffer);
      return { id: `deal_${playerId}_${index}`, type, offerResource: offerRes, offerAmount: offerQty, costResource: costRes, costAmount: qty, remaining: 1 };
    }
    case 'swap': {
      const qty = 2 + Math.floor(rand() * 5);
      const receiveQty = Math.max(1, Math.ceil((qty * baseCost * discountFactor) / baseOffer));
      return { id: `deal_${playerId}_${index}`, type, offerResource: offerRes, offerAmount: receiveQty, costResource: costRes, costAmount: qty, remaining: 1 };
    }
    case 'rare': {
      // Offer a high-value resource at a reasonable cost
      const highValueResources = ALL_TRADEABLE
        .filter(r => !usedResources.has(r) && (MARKETPLACE_BASE_VALUES[r] ?? 0) >= 8);
      const rareRes = highValueResources.length > 0
        ? highValueResources[Math.floor(rand() * highValueResources.length)]
        : offerRes;
      const qty = 1 + Math.floor(rand() * 3);
      const rareBase = MARKETPLACE_BASE_VALUES[rareRes] ?? 1;
      const costQty = Math.ceil((qty * rareBase * discountFactor) / baseCost);
      return { id: `deal_${playerId}_${index}`, type, offerResource: rareRes, offerAmount: qty, costResource: costRes, costAmount: costQty, remaining: 1 };
    }
  }
}

/** Expire merchants whose departure time has passed. Mutates in place. */
export function expireMerchants(
  travelingMerchant: Map<number, TravelingMerchant>,
  elapsedTime: number,
): void {
  for (const [, merchant] of travelingMerchant) {
    if (merchant.active && elapsedTime >= merchant.departureTime) {
      merchant.active = false;
    }
  }
}
