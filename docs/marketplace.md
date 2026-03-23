# Marketplace & Barter Trading System

## Executive Summary

A **barter-based marketplace** where players exchange resources for other resources using dynamic supply/demand pricing. No gold currency required — trading is purely resource-for-resource. The system uses the **existing Market building** (upgraded with a Merchant worker) and optionally the **Castle** (basic trading at worse rates). An NPC traveling merchant visits periodically with special deals. All values are data-driven via `balanceConstants.ts` and overrideable at runtime.

**Guiding principles:**
- Trading supplements production chains — never replaces them
- All exchange rates, fees, and timers live in `balanceConstants.ts` as `let` constants
- Dynamic pricing rewards strategic timing without being exploitable
- Integrates with existing logistics (flag-and-road network, GoodsDistribution)
- Mobile-first UI via bottom sheet; desktop uses side panel

---

## System 1: Resource Trade Values

### Base Value Table

Every resource has a **base trade value** — a dimensionless number representing its relative worth. Higher values = rarer/more processed resources.

```typescript
// In balanceConstants.ts
export let MARKETPLACE_BASE_VALUES: Record<ResourceType, number> = {
  // Raw materials (low value: 1–4)
  wood:         2,
  stone:        3,
  grain:        2,
  fish:         3,
  iron_ore:     4,
  coal_ore:     3,
  gold_ore:     6,
  grapes:       3,
  fruit:        2,
  water_barrel: 1,
  milk:         3,
  hay:          1,
  wool:         3,
  raw_leather:  3,

  // Processed goods (medium value: 4–10)
  planks:         4,
  flour:          4,
  bread:          7,
  meat:           8,
  iron_bars:      8,
  gold_bars:     15,
  swords:        12,
  shields:       12,
  wine:           8,
  beer:           6,
  cheese:         7,
  cloth:          6,
  worked_leather: 7,
  arrows:         5,
  bow:           10,
  siege_ram:     20,

  // Tools (medium-high value: 6–8)
  axe:          6,
  pickaxe:      6,
  saw:          6,
  scythe:       6,
  fishing_rod:  6,
  hammer_tool:  6,
  shovel:       6,
  rolling_pin:  6,
  cleaver:      6,
  crucible:     6,
  tongs:        6,

  // Animals (high value: 8–12)
  pigs:          8,
  cattle:       10,
  horses:       12,
};
```

### Exchange Rate Formula

When exchanging Resource A for Resource B:

```
effectiveValueA = baseValue[A] × dynamicMultiplier[A]  (selling → price goes down)
effectiveValueB = baseValue[B] × dynamicMultiplier[B]  (buying → price goes up)

exchangeRate = effectiveValueA / effectiveValueB
amountReceived = floor(amountOffered × exchangeRate × (1 - MARKETPLACE_FEE))
```

**Example:** Selling 5 Wood (value 2) to buy Bread (value 7), fee 10%, no price shift:
- `exchangeRate = 2 / 7 = 0.286`
- `amountReceived = floor(5 × 0.286 × 0.90) = floor(1.286) = 1 Bread`
- Player gives 5 Wood, gets 1 Bread

The fee ensures trading is always slightly worse than producing directly.

---

## System 2: Dynamic Pricing

### Price Shift Mechanics

Each resource tracks a **dynamic multiplier** (starts at 1.0) that shifts based on trading activity:

```typescript
// In balanceConstants.ts
export let MARKETPLACE_PRICE_SHIFT_BUY = 0.05;    // +5% per unit bought
export let MARKETPLACE_PRICE_SHIFT_SELL = 0.03;   // -3% per unit sold
export let MARKETPLACE_PRICE_DECAY_RATE = 0.002;  // decay toward 1.0 per second
export let MARKETPLACE_PRICE_MIN = 0.5;            // floor: 50% of base value
export let MARKETPLACE_PRICE_MAX = 2.0;            // ceiling: 200% of base value
```

**On buy (player receives resource):**
```
dynamicMultiplier[resource] += PRICE_SHIFT_BUY × amount
dynamicMultiplier[resource] = min(dynamicMultiplier, PRICE_MAX)
```

**On sell (player offers resource):**
```
dynamicMultiplier[resource] -= PRICE_SHIFT_SELL × amount
dynamicMultiplier[resource] = max(dynamicMultiplier, PRICE_MIN)
```

**Decay toward equilibrium:**
```
// Every frame in MarketplaceManager.update():
for each resource:
  if dynamicMultiplier > 1.0:
    dynamicMultiplier -= PRICE_DECAY_RATE × deltaTime
    dynamicMultiplier = max(dynamicMultiplier, 1.0)
  else if dynamicMultiplier < 1.0:
    dynamicMultiplier += PRICE_DECAY_RATE × deltaTime
    dynamicMultiplier = min(dynamicMultiplier, 1.0)
```

### Strategic Implications

- **Buying a lot** of one resource makes it progressively more expensive
- **Selling a lot** of one resource tanks its value — diminishing returns
- **Waiting** lets prices decay back to baseline — patience is rewarded
- **Diversified trading** is more efficient than bulk trading one resource
- Price shifts are **per-player** (each player's marketplace has independent prices)

---

## System 3: Trading Venues

### Market Building (Primary)

**Upgrade the existing Market** (`buildingDefinitions.ts['market']`):

| Field | Current | New |
|-------|---------|-----|
| description | "Automatically redistributes food" | "Barter trading post. Exchange resources with NPC merchants" |
| worker | `''` | `'Merchant'` |
| workerTool | `''` | `''` (no tool required) |
| storageCapacity | 12 | 20 |
| tier | 2 | 2 (unchanged) |
| category | `'logistics'` | `'logistics'` (unchanged) |

**Market-specific constants:**

```typescript
// In balanceConstants.ts
export let MARKETPLACE_FEE = 0.10;              // 10% value loss on trades
export let MARKETPLACE_TRADE_COOLDOWN = 3.0;    // seconds between trades
export let MARKETPLACE_MAX_TRADE_SIZE = 10;     // max items per single trade
export let MARKETPLACE_RESTOCK_INTERVAL = 60;   // seconds between NPC restock
export let MARKETPLACE_NPC_STOCK_MIN = 3;       // min items NPC has per resource
export let MARKETPLACE_NPC_STOCK_MAX = 8;       // max items NPC has per resource
```

**How it works:**
1. Player builds a Market (connected to road network)
2. A Merchant worker is assigned (auto-spawned serf)
3. The Market maintains an **NPC inventory** — a virtual stock of resources the NPC "has" for trade
4. Player offers resources from their logistics network (Castle/Warehouse stocks)
5. Player receives resources, which appear at the Market's output and enter the logistics network
6. A trade cooldown prevents spamming

### Castle Trading (Secondary)

The Castle can perform **basic trades** without building a Market, but at a penalty:

```typescript
// In balanceConstants.ts
export let CASTLE_TRADE_FEE = 0.25;             // 25% value loss (vs 10% at Market)
export let CASTLE_TRADE_COOLDOWN = 10.0;         // 10s cooldown (vs 3s at Market)
export let CASTLE_TRADE_MAX_SIZE = 5;            // max 5 items (vs 10 at Market)
export let CASTLE_TRADE_ENABLED = true;          // can be disabled for harder difficulty
```

**Castle trading rationale:**
- Provides an **early-game safety valve** before players can build a Market
- The high fee (25%) ensures it's only used for emergencies
- Encourages players to invest in a proper Market building

---

## System 4: NPC Merchant Inventory

### Virtual Stock System

The NPC merchant has a **virtual inventory** — not physical items on the map, but a simulated stock that refreshes periodically. This avoids needing to simulate NPC logistics.

```typescript
interface NPCStock {
  /** Available quantity (refreshes periodically) */
  available: number;
  /** Maximum stock for this resource */
  maxStock: number;
  /** Whether this resource is currently offered by the NPC */
  offered: boolean;
}
```

### Stock Refresh

Every `MARKETPLACE_RESTOCK_INTERVAL` seconds (default 60s):

1. **Select available resources:** The NPC doesn't carry everything. Each restock, select a **subset of resources** based on map characteristics:
   - Resources the player **cannot produce** (no building or no terrain) → always offered, higher stock
   - Resources the player **can produce** → offered with probability based on scarcity
   - Tools and weapons → always offered in small quantities

2. **Randomize stock amounts:** Between `NPC_STOCK_MIN` and `NPC_STOCK_MAX` per offered resource

3. **Bias toward player needs:** Resources the player has low stocks of get a +50% chance of being offered

```typescript
// In balanceConstants.ts
export let MARKETPLACE_OFFERED_RESOURCE_COUNT = 12;  // NPC offers ~12 resource types per restock
export let MARKETPLACE_SCARCITY_BONUS = 0.50;        // +50% offer chance for scarce resources
export let MARKETPLACE_UNAVAILABLE_BONUS = 1.00;     // resources player can't produce: always offered
```

### Stock Depletion

- When the player **buys** a resource, NPC stock decreases
- When NPC stock hits 0 for a resource, player cannot buy more until next restock
- When the player **sells** a resource, NPC stock for that resource is unaffected (NPC has unlimited buy capacity — they're a "traveling merchant" who takes it away)

---

## System 5: Traveling Merchant Events

### Periodic Special Merchants

Beyond the base NPC stock, a **traveling merchant** arrives at the Market with special deals:

```typescript
// In balanceConstants.ts
export let MERCHANT_VISIT_INTERVAL = 300;        // every 5 minutes (game time)
export let MERCHANT_VISIT_DURATION = 60;         // stays for 60 seconds
export let MERCHANT_DEAL_COUNT = 3;              // offers 3 special deals per visit
export let MERCHANT_DISCOUNT = 0.20;             // 20% better rates on special deals
```

### Deal Types

Each visit, the merchant offers 3 randomly selected deals from these categories:

| Deal Type | Description | Example |
|-----------|-------------|---------|
| **Bulk Buy** | Large quantity of one resource at a discount | "15 Iron Ore at 20% off" |
| **Bulk Sell** | Wants a large quantity, pays premium | "Buying 20 Wood at +20% value" |
| **Swap Deal** | Fixed ratio trade, better than market rate | "3 Grain for 2 Bread (normally ~5 Grain)" |
| **Rare Offer** | Resource not normally available or very expensive | "5 Gold Bars available" |

### Merchant Data Structure

```typescript
interface MerchantDeal {
  id: string;
  type: 'bulk_buy' | 'bulk_sell' | 'swap' | 'rare';
  /** Resource the player receives (for buy/swap/rare) */
  offerResource: ResourceType;
  offerAmount: number;
  /** Resource the player gives (for sell/swap) */
  costResource: ResourceType;
  costAmount: number;
  /** Number of times this deal can be taken (usually 1) */
  uses: number;
  /** Remaining uses */
  remaining: number;
}

interface TravelingMerchant {
  active: boolean;
  arrivalTime: number;
  departureTime: number;
  deals: MerchantDeal[];
}
```

### Notification

When a merchant arrives:
- **Desktop:** Alert bar at top: "A traveling merchant has arrived at the Market!"
- **Mobile:** Snackbar notification + Market building gets a pulsing gold icon overlay
- Clicking the notification opens the Market trade panel

---

## System 6: Auto-Trade Rules

### Rule Definition

Players can set **automatic trading rules** per resource to reduce micromanagement:

```typescript
interface AutoTradeRule {
  resource: ResourceType;
  /** 'buy' = auto-purchase when stock < threshold, 'sell' = auto-sell when stock > threshold */
  action: 'buy' | 'sell';
  /** Stock threshold that triggers the auto-trade */
  threshold: number;
  /** Max amount to trade per trigger */
  maxAmount: number;
  /** Resource to exchange for/with (what to give when buying, what to receive when selling) */
  exchangeResource: ResourceType;
  /** Whether this rule is active */
  enabled: boolean;
}
```

### Auto-Trade Execution

```typescript
// In balanceConstants.ts
export let AUTOTRADE_CHECK_INTERVAL = 15.0;   // check rules every 15 seconds
export let AUTOTRADE_MAX_RULES = 8;            // max 8 active auto-trade rules
```

Every `AUTOTRADE_CHECK_INTERVAL` seconds, `MarketplaceManager` evaluates active rules:

1. **Buy rules:** If player's total stock of `resource` < `threshold`:
   - Calculate how many to buy: `min(threshold - currentStock, maxAmount, npcStock)`
   - Calculate cost in `exchangeResource` using current exchange rate
   - If player has enough `exchangeResource` in Castle/Warehouse, execute trade

2. **Sell rules:** If player's total stock of `resource` > `threshold`:
   - Calculate how many to sell: `min(currentStock - threshold, maxAmount)`
   - Execute trade, receive `exchangeResource` at current rates

### Auto-Trade Constraints

- Auto-trades use the **same fee and dynamic pricing** as manual trades
- Auto-trades respect the **trade cooldown** (queued if cooldown active)
- Auto-trades only execute if a **Market building exists and is active** (has worker)
- Castle trading does NOT support auto-trade

---

## System 7: MarketplaceManager

### Class Design

Following the `MoraleManager` / `EconomyTracker` pattern:

```typescript
export class MarketplaceManager {
  // --- State ---
  private gameState: GameState;

  /** Dynamic price multipliers per player per resource */
  private priceMultipliers: Map<number, Map<ResourceType, number>>;

  /** NPC virtual stock per player's market */
  private npcStock: Map<number, Map<ResourceType, NPCStock>>;

  /** Active auto-trade rules per player */
  private autoTradeRules: Map<number, AutoTradeRule[]>;

  /** Traveling merchant state per player */
  private travelingMerchant: Map<number, TravelingMerchant>;

  /** Trade history for analytics (rolling window) */
  private tradeHistory: Map<number, TradeEvent[]>;

  /** Timers */
  private restockTimer = 0;
  private merchantTimer = 0;
  private autoTradeTimer = 0;
  private elapsedTime = 0;

  // --- Core Methods ---
  constructor(gameState: GameState);

  /** Called every frame from Game.ts animate loop */
  update(deltaTime: number): void;

  /** Execute a manual barter trade */
  executeTrade(playerId: number, sellResource: ResourceType, sellAmount: number,
               buyResource: ResourceType, venue: 'market' | 'castle'): TradeResult;

  /** Accept a traveling merchant deal */
  acceptDeal(playerId: number, dealId: string): TradeResult;

  /** Get current effective exchange rate between two resources */
  getExchangeRate(playerId: number, sellResource: ResourceType,
                  buyResource: ResourceType, venue: 'market' | 'castle'): number;

  /** Preview a trade: how much would the player receive? */
  previewTrade(playerId: number, sellResource: ResourceType, sellAmount: number,
               buyResource: ResourceType, venue: 'market' | 'castle'): TradePreview;

  /** Get current NPC stock for a resource */
  getNPCStock(playerId: number, resource: ResourceType): number;

  /** Get the dynamic price multiplier for a resource */
  getPriceMultiplier(playerId: number, resource: ResourceType): number;

  /** Get all available resources the NPC offers */
  getAvailableResources(playerId: number): ResourceType[];

  /** Get the traveling merchant state */
  getMerchant(playerId: number): TravelingMerchant | null;

  // --- Auto-Trade ---
  addAutoTradeRule(playerId: number, rule: AutoTradeRule): boolean;
  removeAutoTradeRule(playerId: number, index: number): void;
  getAutoTradeRules(playerId: number): AutoTradeRule[];

  // --- Save/Load ---
  _getState(): MarketplaceState;
  _loadState(state: MarketplaceState): void;

  // --- Private ---
  private decayPrices(deltaTime: number): void;
  private restockNPC(playerId: number): void;
  private spawnMerchant(playerId: number): void;
  private evaluateAutoTrades(playerId: number): void;
  private findMarketBuilding(playerId: number): Building | null;
  private getPlayerStocks(playerId: number): Map<ResourceType, number>;
}
```

### TradeResult / TradePreview

```typescript
interface TradeResult {
  success: boolean;
  error?: 'no_market' | 'no_worker' | 'cooldown' | 'insufficient_stock' |
          'npc_out_of_stock' | 'too_large' | 'no_exchange_resource';
  sold: { resource: ResourceType; amount: number };
  received: { resource: ResourceType; amount: number };
  fee: number;         // percentage applied
  priceShift: number;  // how much the dynamic multiplier changed
}

interface TradePreview {
  amountReceived: number;
  exchangeRate: number;
  fee: number;
  effectiveSellValue: number;
  effectiveBuyValue: number;
  /** Warning if this trade would significantly shift prices */
  priceImpact: 'none' | 'low' | 'medium' | 'high';
}
```

### Game.ts Integration

```typescript
// In Game constructor:
this.marketplaceManager = new MarketplaceManager(this.gameState);

// In animate loop (after other managers):
this.marketplaceManager.update(deltaTime);

// In dispose():
// (no GPU resources to clean up)
```

### SaveLoad Integration

```typescript
// In SaveData interface:
marketplace?: MarketplaceState;

// MarketplaceState:
interface MarketplaceState {
  version: 1;
  priceMultipliers: Record<number, Record<string, number>>;
  npcStock: Record<number, Record<string, { available: number; maxStock: number; offered: boolean }>>;
  autoTradeRules: Record<number, AutoTradeRule[]>;
  travelingMerchant: Record<number, TravelingMerchant>;
  tradeHistory: Record<number, TradeEvent[]>;
  restockTimer: number;
  merchantTimer: number;
  autoTradeTimer: number;
  elapsedTime: number;
}
```

---

## System 8: UI Design

### Desktop: Trade Panel (Side Panel)

Triggered by clicking the Market building → Info Panel gets a **"Trade" tab** alongside the existing status info.

```
┌─────────────────────────────────────────┐
│ ◄ Market                          [X]   │
│─────────────────────────────────────────│
│ [Status] [Trade] [Auto-Trade]           │
│─────────────────────────────────────────│
│                                         │
│  SELL                                   │
│  ┌─────────────────────────────────┐    │
│  │ [icon] Wood         ▼   × [5]  │    │
│  │ Your stock: 47                  │    │
│  └─────────────────────────────────┘    │
│                                         │
│         ══ ↕ exchange ↕ ══              │
│                                         │
│  BUY                                    │
│  ┌─────────────────────────────────┐    │
│  │ [icon] Iron Bars    ▼   × [1]  │    │
│  │ NPC stock: 5                    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Rate: 5 Wood → 1 Iron Bars            │
│  Fee: 10%                               │
│  Price impact: ●○○ low                  │
│                                         │
│  [ Confirm Trade ]                      │
│                                         │
│─────────────────────────────────────────│
│  ♦ Traveling Merchant (42s left)        │
│  ┌──────────────────────────────┐       │
│  │ Deal 1: 10 Stone → 3 Bread  │ [✓]   │
│  │ Deal 2: 15 Wood → 5 Planks  │ [✓]   │
│  │ Deal 3: 8 Grain → 2 Beer    │ [✓]   │
│  └──────────────────────────────┘       │
│─────────────────────────────────────────│
│  Price Trends                           │
│  Wood ■■■■░░░░ 0.85×  (cheap)          │
│  Iron ■■■■■■■░ 1.20×  (expensive)      │
│  Fish ■■■■■░░░ 1.00×  (baseline)       │
└─────────────────────────────────────────┘
```

### Desktop: Castle Trade (Simplified)

When clicking Castle → Info Panel gets a minimal **"Quick Trade"** section:

```
┌─────────────────────────────────────┐
│  Quick Trade (25% fee)              │
│  Sell: [Wood ▼] × [5]              │
│  Buy:  [Fish ▼] × [?]              │
│  You'd get: 1 Fish                  │
│  [ Trade ]                          │
└─────────────────────────────────────┘
```

### Mobile: Trade Bottom Sheet

Tapping the Market building → bottom sheet slides up with the trade UI:

```
┌─────────────────────────────────┐
│  ═══  (drag handle)             │
│                                 │
│  Market Trade                   │
│  [Barter] [Merchant] [Auto]    │
│─────────────────────────────────│
│                                 │
│  SELL          →          BUY   │
│  ┌──────┐    ═══    ┌──────┐   │
│  │ Wood │  5 → 1    │ Iron │   │
│  │  47  │           │  NPC:5│  │
│  └──┬───┘           └──┬───┘   │
│     │                   │       │
│  [- 1 +]  Fee:10%  [- 1 +]    │
│                                 │
│  ┌─────────────────────────┐   │
│  │    Confirm Trade         │   │
│  └─────────────────────────┘   │
│                                 │
│  ♦ Merchant here! (42s)        │
│  [10 Stone→3 Bread] [Accept]   │
└─────────────────────────────────┘
```

### UI Components

| Component | Desktop | Mobile |
|-----------|---------|--------|
| Resource selector | Dropdown with icons + stock count | Scrollable grid of resource tiles |
| Amount control | +/- buttons + text input | Large +/- buttons (48px touch) |
| Trade preview | Inline text below selectors | Centered between sell/buy panels |
| Merchant deals | List with accept buttons | Swipeable cards |
| Auto-trade rules | Table with toggle switches | List with swipe-to-delete |
| Price trends | Horizontal bar chart | Collapsed by default, expandable |

### PanelUpdater Integration

The Trade panel follows the existing `PanelUpdater` pattern:
- **Structure key:** `sell-${sellResource}-buy-${buyResource}-merchant-${merchantActive}-rules-${ruleCount}`
- **data-field attributes:** `data-field="sell-stock"`, `data-field="buy-stock"`, `data-field="exchange-rate"`, `data-field="merchant-timer"`, etc.
- **Update interval:** Every 1 second (prices decay, merchant timer ticks)

---

## System 9: Data-Driven Configuration

### All Constants in balanceConstants.ts

```typescript
// ── Marketplace ──

// Base trade values (relative worth of each resource)
export let MARKETPLACE_BASE_VALUES: Record<string, number> = { /* see System 1 */ };

// Fee & limits
export let MARKETPLACE_FEE = 0.10;
export let MARKETPLACE_TRADE_COOLDOWN = 3.0;
export let MARKETPLACE_MAX_TRADE_SIZE = 10;

// Dynamic pricing
export let MARKETPLACE_PRICE_SHIFT_BUY = 0.05;
export let MARKETPLACE_PRICE_SHIFT_SELL = 0.03;
export let MARKETPLACE_PRICE_DECAY_RATE = 0.002;
export let MARKETPLACE_PRICE_MIN = 0.5;
export let MARKETPLACE_PRICE_MAX = 2.0;

// NPC stock
export let MARKETPLACE_RESTOCK_INTERVAL = 60;
export let MARKETPLACE_NPC_STOCK_MIN = 3;
export let MARKETPLACE_NPC_STOCK_MAX = 8;
export let MARKETPLACE_OFFERED_RESOURCE_COUNT = 12;
export let MARKETPLACE_SCARCITY_BONUS = 0.50;
export let MARKETPLACE_UNAVAILABLE_BONUS = 1.00;

// Castle trading
export let CASTLE_TRADE_FEE = 0.25;
export let CASTLE_TRADE_COOLDOWN = 10.0;
export let CASTLE_TRADE_MAX_SIZE = 5;
export let CASTLE_TRADE_ENABLED = true;

// Traveling merchant
export let MERCHANT_VISIT_INTERVAL = 300;
export let MERCHANT_VISIT_DURATION = 60;
export let MERCHANT_DEAL_COUNT = 3;
export let MERCHANT_DISCOUNT = 0.20;

// Auto-trade
export let AUTOTRADE_CHECK_INTERVAL = 15.0;
export let AUTOTRADE_MAX_RULES = 8;
```

### BalanceConfigOverrides Extension

```typescript
// In BalanceConfigOverrides interface:
marketplace?: {
  fee?: number;
  tradeCooldown?: number;
  maxTradeSize?: number;
  priceShiftBuy?: number;
  priceShiftSell?: number;
  priceDecayRate?: number;
  priceMin?: number;
  priceMax?: number;
  restockInterval?: number;
  npcStockMin?: number;
  npcStockMax?: number;
  offeredResourceCount?: number;
  scarcityBonus?: number;
  castleTradeFee?: number;
  castleTradeCooldown?: number;
  castleTradeMaxSize?: number;
  castleTradeEnabled?: boolean;
  merchantVisitInterval?: number;
  merchantVisitDuration?: number;
  merchantDealCount?: number;
  merchantDiscount?: number;
  autoTradeCheckInterval?: number;
  autoTradeMaxRules?: number;
  baseValues?: Partial<Record<string, number>>;
};
```

### balance-data.json Extension

```json
{
  "marketplace": {
    "fee": 0.10,
    "tradeCooldown": 3.0,
    "maxTradeSize": 10,
    "priceShiftBuy": 0.05,
    "priceShiftSell": 0.03,
    "priceDecayRate": 0.002,
    "priceMin": 0.5,
    "priceMax": 2.0,
    "restockInterval": 60,
    "npcStockMin": 3,
    "npcStockMax": 8,
    "offeredResourceCount": 12,
    "castleTradeFee": 0.25,
    "castleTradeCooldown": 10.0,
    "castleTradeMaxSize": 5,
    "castleTradeEnabled": true,
    "merchantVisitInterval": 300,
    "merchantVisitDuration": 60,
    "merchantDealCount": 3,
    "merchantDiscount": 0.20,
    "autoTradeCheckInterval": 15.0,
    "autoTradeMaxRules": 8,
    "baseValues": { "wood": 2, "stone": 3, ... }
  }
}
```

---

## System 10: Balance Analysis

### Why Barter Works Better Than Gold Currency

1. **No inflation problem:** Gold-based economies can become trivial once gold production is high. Barter forces real resource trade-offs.
2. **Production chain incentive:** To trade effectively, players need diverse production — exactly the gameplay loop we want to encourage.
3. **Natural scarcity:** If you trade away all your Wood for Iron, you can't build. Self-balancing.
4. **No new resource needed:** Avoids creating a "gold coins" resource separate from Gold Bars.

### Fee Calibration

| Venue | Fee | Break-Even vs Production |
|-------|-----|-------------------------|
| Market | 10% | ~90% efficient — trading is viable but production is better |
| Castle | 25% | ~75% efficient — emergency use only |
| Merchant deals | -10% (discount) | ~110% efficient — limited deals worth prioritizing |

### Dynamic Pricing Scenarios

**Scenario A: Player buys 10 Iron Bars**
- Price multiplier shifts: `1.0 + (10 × 0.05) = 1.5×`
- Next Iron Bar costs 50% more — player should wait or produce instead
- Decay: takes `(1.5 - 1.0) / 0.002 = 250 seconds` (~4 min) to fully normalize

**Scenario B: Player sells 20 Wood**
- Price multiplier shifts: `1.0 - (20 × 0.03) = 0.4 → clamped to 0.5×`
- Wood value halved — selling more gives diminishing returns
- Decay: takes `(1.0 - 0.5) / 0.002 = 250 seconds` (~4 min) to normalize

**Scenario C: Traveling merchant offers "15 Stone for 5 Bread"**
- Normal rate: Stone(3) × 15 = 45 value → Bread(7) × 5 = 35 value → player overpays
- With merchant discount: effectively 45 × 1.2 = 54 → 35 = fair deal for player
- Worth taking if player has excess Stone and needs food

### Resource Tradeability Tiers

| Tier | Resources | Trade Frequency |
|------|-----------|-----------------|
| High trade volume | Wood, Stone, Grain, Fish, Planks | Common swaps, low value |
| Medium trade volume | Iron Bars, Bread, Meat, Tools, Beer, Wine | Strategic mid-game trades |
| Low trade volume | Swords, Shields, Gold Bars, Siege Ram | Rare, high-value trades |
| Restricted | Animals (Pigs, Cattle, Horses) | Available but expensive |

### Early Game (0–5 min)

- Castle trading available immediately (high fee, low limits)
- Player can trade surplus Wood/Stone for Fish if food chain isn't up yet
- Safety valve prevents early starvation without being too generous

### Mid Game (5–15 min)

- Market building constructed → better rates, auto-trade
- First traveling merchants arrive with useful deals
- Player starts setting auto-trade rules for surplus resources
- Dynamic pricing starts mattering as trade volume increases

### Late Game (15+ min)

- Market becomes an optimization tool — trade surplus processed goods for rare materials
- Traveling merchant deals for weapons/military goods are valuable
- Auto-trade handles routine resource balancing
- Price trends panel helps plan large trades

---

## System 11: EconomyTracker Integration

### Trade Event Tracking

Trades are recorded as both production and consumption events for analytics:

```typescript
interface TradeEvent {
  timestamp: number;
  playerId: number;
  sold: { resource: ResourceType; amount: number };
  received: { resource: ResourceType; amount: number };
  venue: 'market' | 'castle' | 'merchant';
  fee: number;
}
```

When a trade executes:
- `economyTracker.recordConsumption(soldResource, soldAmount)` — resource leaves the economy
- `economyTracker.recordProduction(receivedResource, receivedAmount)` — resource enters the economy

This ensures the Dashboard charts accurately reflect resource flow including trades.

### Dashboard Extension

The **Economy tab** gains a "Trade" filter alongside "All/Raw/Processed/Food/Military":
- Shows only resources that have been traded
- Trade volume chart (Canvas-based line chart)
- Net trade balance per resource (bought vs. sold)

---

## System 12: AI Integration

### AI Trading Behavior

The `AIPlayer` needs to use the marketplace strategically:

```typescript
// AI trade decision constants (in balanceConstants.ts)
export let AI_TRADE_CHECK_INTERVAL = 30;          // AI evaluates trades every 30s
export let AI_TRADE_SURPLUS_THRESHOLD = 1.5;      // trade when stock > 1.5× consumption rate
export let AI_TRADE_SHORTAGE_THRESHOLD = 0.5;     // buy when stock < 0.5× consumption rate
export let AI_TRADE_PRICE_SENSITIVITY = 0.3;      // won't trade if price multiplier > 1.3
```

**AI Decision Logic:**
1. Every `AI_TRADE_CHECK_INTERVAL` seconds, scan all resources
2. For resources with surplus (`stock > consumption_rate × AI_TRADE_SURPLUS_THRESHOLD`):
   - Find the resource with the highest shortage
   - If exchange rate is favorable (price multiplier < `AI_TRADE_PRICE_SENSITIVITY`), execute trade
3. Accept traveling merchant deals if they provide a needed resource at a good rate
4. AI does NOT use auto-trade rules (it evaluates manually to avoid exploits)

---

## Implementation Roadmap

### Phase 1: Core Manager & Data (No UI)

**Files to create/modify:**
- `src/game/MarketplaceManager.ts` — new file
- `src/game/data/balanceConstants.ts` — add MARKETPLACE_ constants
- `src/game/data/buildingDefinitions.ts` — update Market building definition
- `src/game/data/BalanceConfig.test.ts` — add marketplace override tests
- `src/game/MarketplaceManager.test.ts` — new test file
- `Game.ts` — instantiate MarketplaceManager
- `SaveLoad.ts` — add marketplace state

**Scope:** ~3 files created, ~4 files modified

### Phase 2: Trade UI

**Files to create/modify:**
- `src/ui/TradePanel.ts` — new file (desktop trade panel)
- `src/ui/TradeMobileSheet.ts` — new file (mobile bottom sheet)
- `src/ui/InfoPanel.ts` — add Trade tab for Market/Castle buildings
- `src/ui/styles.css` — trade panel styles
- `main.ts` — wire up trade panel events

**Scope:** ~2 files created, ~3 files modified

### Phase 3: Traveling Merchant & Auto-Trade

**Files to create/modify:**
- `src/ui/MerchantPanel.ts` — merchant deal cards (or inline in TradePanel)
- `src/ui/AutoTradePanel.ts` — auto-trade rule editor
- `MarketplaceManager.ts` — merchant spawn logic, auto-trade evaluation
- Alert/notification system — merchant arrival alerts

**Scope:** ~2 files created, ~2 files modified

### Phase 4: AI, Dashboard & Polish

**Files to create/modify:**
- `src/game/AIPlayer.ts` — add marketplace trading logic
- `src/ui/DashboardPanel.ts` — add trade filter/chart to Economy tab
- `tools/generate-balance-data.ts` — add marketplace section
- `tools/balance-data.json` — regenerate

**Scope:** ~4 files modified

### Phase 5: Visual Polish

**Files to create/modify:**
- Market building model update (if needed — add merchant stall details)
- Traveling merchant visual indicator on map
- Trade notification animations
- Mobile UI polish and testing

---

## Constraints & Risks

### Performance

- **Price decay loop:** O(44 resources) per frame — negligible
- **Auto-trade evaluation:** O(8 rules × 44 resources) every 15s — negligible
- **NPC stock refresh:** O(44 resources) every 60s — negligible
- **Trade history:** Rolling window with max 200 events — bounded memory

### Balance Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Trading replaces production chains | Medium | High | Fee + dynamic pricing + cooldown make production always more efficient |
| AI trades too aggressively | Low | Medium | Price sensitivity threshold + check interval |
| Price manipulation (sell → rebuy loop) | Low | Medium | Buy/sell asymmetric shifts + fee prevents arbitrage |
| Early Castle trading too powerful | Low | Medium | 25% fee + 5-item limit + 10s cooldown |
| Auto-trade removes all challenge | Low | Low | Max 8 rules, same fees apply, requires Market building |

### Mobile Compatibility

- Trade panel uses bottom sheet (existing `BottomSheetController`)
- All touch targets ≥ 48px (Apple HIG)
- Resource selectors use scrollable grid, not dropdowns
- Amount controls use large +/- buttons

### Backward Compatibility

- New `marketplace` field in SaveData defaults to empty/null for old saves
- Market building definition changes are backward compatible (adding worker doesn't break existing markets)
- All new constants have sensible defaults — game works identically without any overrides
