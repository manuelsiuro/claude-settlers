# Marketplace & Trading System Guide

This document is the single reference for the barter marketplace system. Consult it before tuning trade values, adding tradeable resources, or modifying exchange mechanics.

---

## Architecture Overview

```
MarketplaceManager (src/game/MarketplaceManager.ts)
├── update()              — decay prices, restock NPC, spawn merchants, auto-trade
├── executeTrade()        — manual barter trade (market or castle venue)
├── acceptDeal()          — accept a traveling merchant deal
├── previewTrade()        — calculate exchange rate + amount without executing
├── getExchangeRate()     — get rate between two resources
├── getPriceMultiplier()  — current dynamic price for a resource
├── getNPCStock()         — NPC virtual stock for a resource
├── getMerchant()         — traveling merchant state
├── addAutoTradeRule()    — create an auto-trade rule
└── _getState/_loadState  — save/load serialization

TradePanel (src/ui/TradePanel.ts)
├── canTrade()            — check if a building supports trading
├── generateTradeHTML()   — render trade UI into InfoPanel
├── updateTradeValues()   — live-update dynamic values
├── handleTradeClick()    — process click events (trade, deals, auto-trade)
└── handleTradeChange()   — process dropdown changes

Constants: src/game/data/balanceConstants.ts (MARKETPLACE_*, CASTLE_TRADE_*, MERCHANT_*, AUTOTRADE_*)
Base values: src/game/data/balanceConstants.ts → MARKETPLACE_BASE_VALUES
Building def: src/game/data/buildingDefinitions.ts → ['market']
Unit type: src/game/UnitType.ts → Merchant
Balance JSON: tools/balance-data.json → marketplace section
Tests: src/game/MarketplaceManager.test.ts, src/game/data/BalanceConfig.test.ts
Design doc: docs/marketplace.md (full design rationale)
```

---

## Constants Reference

All marketplace constants live in `src/game/data/balanceConstants.ts`:

### Market Trading

| Constant | Value | Description |
|----------|-------|-------------|
| `MARKETPLACE_FEE` | 0.10 | 10% value loss on trades |
| `MARKETPLACE_TRADE_COOLDOWN` | 3.0s | Seconds between trades |
| `MARKETPLACE_MAX_TRADE_SIZE` | 10 | Max items per trade |
| `MARKETPLACE_RESTOCK_INTERVAL` | 60s | Seconds between NPC restocks |
| `MARKETPLACE_NPC_STOCK_MIN` | 3 | Min items NPC has per resource |
| `MARKETPLACE_NPC_STOCK_MAX` | 8 | Max items NPC has per resource |
| `MARKETPLACE_OFFERED_RESOURCE_COUNT` | 12 | Resource types offered per restock |
| `MARKETPLACE_SCARCITY_BONUS` | 0.50 | Extra offer chance for scarce resources |

### Dynamic Pricing

| Constant | Value | Description |
|----------|-------|-------------|
| `MARKETPLACE_PRICE_SHIFT_BUY` | 0.05 | +5% multiplier per unit bought |
| `MARKETPLACE_PRICE_SHIFT_SELL` | 0.03 | -3% multiplier per unit sold |
| `MARKETPLACE_PRICE_DECAY_RATE` | 0.002/s | Decay speed toward 1.0 |
| `MARKETPLACE_PRICE_MIN` | 0.5 | Floor: 50% of base value |
| `MARKETPLACE_PRICE_MAX` | 2.0 | Ceiling: 200% of base value |

### Castle Trading

| Constant | Value | Description |
|----------|-------|-------------|
| `CASTLE_TRADE_FEE` | 0.25 | 25% value loss (emergency trades) |
| `CASTLE_TRADE_COOLDOWN` | 10.0s | Slower than Market |
| `CASTLE_TRADE_MAX_SIZE` | 5 | Smaller than Market |
| `CASTLE_TRADE_ENABLED` | true | Can be disabled for harder difficulty |

### Traveling Merchant

| Constant | Value | Description |
|----------|-------|-------------|
| `MERCHANT_VISIT_INTERVAL` | 300s | Every 5 minutes |
| `MERCHANT_VISIT_DURATION` | 60s | Stays for 1 minute |
| `MERCHANT_DEAL_COUNT` | 3 | Deals per visit |
| `MERCHANT_DISCOUNT` | 0.20 | 20% better than market rates |

### Auto-Trade

| Constant | Value | Description |
|----------|-------|-------------|
| `AUTOTRADE_CHECK_INTERVAL` | 15.0s | Evaluation frequency |
| `AUTOTRADE_MAX_RULES` | 8 | Max rules per player |

### AI Trading

| Constant | Value | Description |
|----------|-------|-------------|
| `AI_TRADE_CHECK_INTERVAL` | 30s | AI evaluation frequency |
| `AI_TRADE_SURPLUS_THRESHOLD` | 1.5 | Trade when stock > this × 10 |
| `AI_TRADE_SHORTAGE_THRESHOLD` | 0.5 | Buy when stock < this × 10 |
| `AI_TRADE_PRICE_SENSITIVITY` | 1.3 | Won't trade if multiplier > this |

---

## Base Trade Values

Every resource has a relative trade value in `MARKETPLACE_BASE_VALUES`:

| Category | Resources | Values |
|----------|-----------|--------|
| Raw (cheap) | Hay, Water | 1 |
| Raw (basic) | Wood, Grain, Fruit | 2 |
| Raw (medium) | Stone, Fish, Grapes, Milk, Wool, Raw Leather, Coal | 3 |
| Raw (valuable) | Iron Ore | 4 |
| Raw (rare) | Gold Ore | 6 |
| Processed (basic) | Planks, Flour | 4 |
| Processed (food) | Beer(6), Bread(7), Cheese(7), Meat(8), Wine(8) | 6–8 |
| Processed (material) | Cloth(6), Worked Leather(7), Arrows(5), Iron Bars(8), Bow(10) | 5–10 |
| Processed (military) | Swords(12), Shields(12), Gold Bars(15), Siege Ram(20) | 12–20 |
| Tools | All 11 tool types | 6 |
| Animals | Pigs(8), Cattle(10), Horses(12) | 8–12 |

---

## Exchange Rate Formula

```
effectiveValueA = baseValue[sell] × dynamicMultiplier[sell]
effectiveValueB = baseValue[buy]  × dynamicMultiplier[buy]

exchangeRate = effectiveValueA / effectiveValueB
amountReceived = floor(amountOffered × exchangeRate × (1 - fee))
```

**Example:** Sell 5 Wood (value 2) for Stone (value 3), Market fee 10%:
- Rate = 2/3 = 0.667
- Received = floor(5 × 0.667 × 0.90) = floor(3.0) = 3 Stone

**Castle example (same trade, 25% fee):**
- Received = floor(5 × 0.667 × 0.75) = floor(2.5) = 2 Stone

---

## Dynamic Pricing

Each resource tracks a multiplier (starts at 1.0) per player:

- **Buying** raises the multiplier: `+PRICE_SHIFT_BUY (0.05) × amount`
- **Selling** lowers the multiplier: `-PRICE_SHIFT_SELL (0.03) × amount`
- **Over time** the multiplier decays toward 1.0 at `PRICE_DECAY_RATE (0.002/s)`
- Clamped between `PRICE_MIN (0.5)` and `PRICE_MAX (2.0)`

**Price recovery time** from maximum shift:
- From 2.0 → 1.0: `1.0 / 0.002 = 500s` (~8 min)
- From 0.5 → 1.0: `0.5 / 0.002 = 250s` (~4 min)

---

## Trading Venues

### Market Building (Primary)

| Property | Value |
|----------|-------|
| Type | `'market'` (logistics category) |
| Worker | Merchant (no tool required) |
| Cost | 3 Wood, 2 Stone, 2 Planks |
| Storage | 20 items |
| Tier | 2 |
| Fee | 10% |
| Cooldown | 3s |
| Max trade | 10 items |
| NPC stock | Yes (restocks every 60s) |
| Auto-trade | Yes |
| Merchant visits | Yes |

### Castle (Fallback)

| Property | Value |
|----------|-------|
| Fee | 25% |
| Cooldown | 10s |
| Max trade | 5 items |
| NPC stock | No (unlimited virtual supply) |
| Auto-trade | No |
| Merchant visits | No |

---

## NPC Stock System

The NPC has a virtual inventory that restocks every `MARKETPLACE_RESTOCK_INTERVAL` (60s):

1. **Select resources**: Score all 44 resources, pick top `OFFERED_RESOURCE_COUNT` (12)
2. **Scarcity bias**: Resources the player has low stock of get `+SCARCITY_BONUS` (0.50) chance
3. **Randomize amounts**: Between `NPC_STOCK_MIN` (3) and `NPC_STOCK_MAX` (8) per resource
4. **Depletion**: Buying reduces NPC stock; selling doesn't affect it (NPC has unlimited buy capacity)
5. **Refresh**: Stock fully replenishes each restock cycle

---

## Traveling Merchants

Every `MERCHANT_VISIT_INTERVAL` (300s), a merchant arrives at the Market building:

- **Duration**: `MERCHANT_VISIT_DURATION` (60s)
- **Deals**: `MERCHANT_DEAL_COUNT` (3) randomly generated
- **Discount**: `MERCHANT_DISCOUNT` (20%) better than market rates
- **Deal types**: Bulk Buy, Bulk Sell, Swap, Rare Offer
- **One-time**: Each deal can be accepted once per visit
- **Notification**: Snackbar alert "A traveling merchant has arrived at your Market!"

Only spawns for players who have an active Market with a worker.

---

## Auto-Trade Rules

Players can create up to `AUTOTRADE_MAX_RULES` (8) rules:

```typescript
interface AutoTradeRule {
  resource: ResourceType;        // Resource to monitor
  action: 'buy' | 'sell';       // Buy when low / sell when high
  threshold: number;            // Stock level trigger
  maxAmount: number;            // Max items per auto-trade
  exchangeResource: ResourceType; // What to trade for/with
  enabled: boolean;             // Toggle on/off
}
```

Rules are evaluated every `AUTOTRADE_CHECK_INTERVAL` (15s). They:
- Use the same fees and dynamic pricing as manual trades
- Only execute if a Market building exists and is active
- Do not work from the Castle

---

## AI Trading

`AIPlayer.tryTrade()` runs every `AI_TRADE_CHECK_INTERVAL` (30s):

1. Scan all resources for **surplus** (stock > `AI_TRADE_SURPLUS_THRESHOLD × 10`)
2. Scan for **shortage** (stock < `AI_TRADE_SHORTAGE_THRESHOLD × 10`)
3. Check **price sensitivity** — skip if multiplier > `AI_TRADE_PRICE_SENSITIVITY` (1.3)
4. Trade modest amounts (max 5, 30% of surplus)
5. Uses Market if built, Castle as fallback

---

## Dashboard Integration

All trades (manual + merchant deals) record events in `EconomyTracker`:
- Sold resource → `recordConsumption(resource, amount)`
- Received resource → `recordProduction(resource, amount)`

This means Dashboard charts show trade flow alongside natural production/consumption.

---

## How to Tune

### Make trading easier
- Decrease `MARKETPLACE_FEE` (lower cost per trade)
- Increase `MARKETPLACE_NPC_STOCK_MAX` (more items available)
- Decrease `MARKETPLACE_TRADE_COOLDOWN` (trade more often)
- Decrease `MARKETPLACE_PRICE_SHIFT_BUY` / `PRICE_SHIFT_SELL` (less price volatility)
- Increase `MERCHANT_DEAL_COUNT` (more special deals)

### Make trading harder
- Increase fees (Market and/or Castle)
- Decrease NPC stock limits
- Increase cooldowns
- Increase price shift amounts (more volatility)
- Set `CASTLE_TRADE_ENABLED = false` (force Market construction)
- Decrease `MARKETPLACE_OFFERED_RESOURCE_COUNT` (fewer resources available)

### After any change
1. Update `resetBalanceDefaults()` in `balanceConstants.ts` to match new values
2. Run `npm run balance-data` to regenerate `tools/balance-data.json`
3. Update tests in `MarketplaceManager.test.ts` and `BalanceConfig.test.ts`
4. Run `npm run build && npm run lint && npm run test`
5. Verify in-game by selecting Market building and testing trades

---

## Adding a New Tradeable Resource

All resources are automatically tradeable. When you add a new resource:

1. Add to `ResourceType` enum in `src/game/ResourceType.ts`
2. Add entry to `RESOURCE_PROPERTIES` with label, category, satiation, isDrink
3. Add a base trade value to `MARKETPLACE_BASE_VALUES` in `balanceConstants.ts`
4. Update `resetBalanceDefaults()` to include the new value
5. Run `npm run balance-data` to update the JSON
6. The marketplace will automatically include it — no changes to `MarketplaceManager`

---

## Modifying Base Trade Values

To change how much a resource is "worth" in barter:

1. Edit `MARKETPLACE_BASE_VALUES` in `balanceConstants.ts`
2. Update the same value in `resetBalanceDefaults()`
3. Consider the balance implications:
   - Higher value = fewer needed to buy expensive items
   - Lower value = more needed (makes the resource less attractive to sell)
   - Values should reflect production chain complexity (raw < processed < military)
4. Run `npm run balance-data` to update the JSON

Values can also be overridden at runtime via `BalanceConfigOverrides.marketplace.baseValues`.

---

## UI Components

### Desktop (InfoPanel sidebar)
- **Castle**: "Quick Trade" section with 25% fee notice
- **Market**: Full "Barter Trade" section with NPC stock, merchants, auto-trade, price trends

### Mobile (Bottom Sheet)
- Same content, responsive layout with larger touch targets (36px buttons, full-width selectors)

### Trade Panel Structure
```
SELL: [Resource ▼] [-5] [-1] amount [+1] [+5]
      ⇅  Rate: X.XX  Fee: XX%
RECEIVE: [Resource ▼]  [icon] amount
      Price impact: low/medium/high
      [Confirm Trade Button]

Traveling Merchant (if active):
      [Deal 1] [Accept]
      [Deal 2] [Accept]

NPC Stock (market only):
      Resource  amount
      ...

Auto-Trade Rules (market only):
      Rule 1  [✓] [×]
      Rule 2  [✓] [×]
      [Add Rule Form]

Price Trends:
      Resource  XX% (cheap/normal/expensive)
```

---

## Design History

**2026-03-23 — Initial Implementation**

Full marketplace system implemented in 7 phases:
1. Core MarketplaceManager with dynamic pricing, NPC stock, traveling merchants, auto-trade
2. Trade UI integrated into InfoPanel (desktop + mobile)
3. Merchant arrival snackbar notifications
4. Auto-trade rule editor UI
5. AI trading logic in AIPlayer
6. Dashboard integration via EconomyTracker
7. Placeholder merchant model (to be replaced with custom Blender model)

Design decisions: barter over gold currency (avoids inflation), dynamic pricing over fixed rates (rewards strategic timing), Castle fallback with penalty (emergency safety valve), NPC virtual stock (no physical logistics needed).
