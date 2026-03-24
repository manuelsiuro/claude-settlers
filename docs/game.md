# Game Design Document: Feudal Realm Manager

## Important

The game should be perfectly playable in a browser and also on a mobile phone.
To make the game more beautiful it is necessary to use the Material 3 library for the UI components as well as for the icons.
Each step must be checked and must never contain any BUG.

## 1. Game Overview

Feudal Realm Manager is a real-time strategy and city-building simulation game. Players assume the role of a feudal lord, tasked with establishing a self-sufficient medieval settlement, developing a complex economy, expanding their territory, and ultimately conquering rival lords. The game emphasizes resource management, intricate production chains, and logistical planning.

## 2. Core Gameplay Loop

1.  **Establishment:** Start with a Castle and a few basic serfs. Identify and secure initial resources (wood, stone).
2.  **Resource Gathering & Production:** Construct buildings to harvest raw materials (wood, stone, food). Begin processing raw materials into more useful goods (planks, food).
3.  **Economic Development:** Expand production chains (e.g., grain -> flour -> bread; ore -> metal -> tools/weapons). Manage the flow of goods.
4.  **Territory Expansion:** Build military outposts to claim more land, accessing new resource deposits and strategic positions.
5.  **Military Buildup:** Produce weapons and recruit knights. Train knights to improve their combat effectiveness.
6.  **Conquest:** Engage in combat with rival lords, capture their territory, and ultimately destroy their Castle to achieve victory.
7.  **Iteration:** Continuously optimize resource flow, expand the settlement, and adapt to challenges and opponent actions.

## 3. Core Game Mechanics

### 3.1. Resource Management

The foundation of the game is the management of a complex economy driven by interconnected resource chains.

- **Raw Materials:** Players must gather fundamental resources like wood, stone, various ores, and food sources.
- **Production Chains:** Goods are created through multi-step processes. For example:
    - **Bread:** Grain (Farm) -> Flour (Windmill) -> Bread (Bakery).
    - **Tools/Weapons:** Iron Ore (Mine) -> Iron Bars (Smelter) -> Tools (Toolmaker) / Swords & Shields (Blacksmith).
- **Food:** Essential for sustaining certain professions, particularly Miners. Food types include Fish, Bread, and Meat.
- **Tools:** Required by specific worker professions (e.g., Woodcutters, Stonemasons, Miners) to perform their tasks.
- **Weapons:** Swords and Shields are required to recruit Knights.
- **Gold:** Mined and processed into Gold Bars. Used to increase the combat strength/morale of Knights.
- **Storage:** Goods are stored in the producing building, transported to consuming buildings, or held in Warehouses.

### 3.2. Building System

Players construct a variety of buildings, each serving specific functions within the economy or military.

- **Construction Process:**
    - Players select a building type and place its footprint on valid terrain.
    - Builders (a serf profession) require Wood and/or Stone, which must be transported to the construction site.
    - Builders physically construct the building over time.
- **Building Functions:** Buildings are categorized by purpose: resource gathering, resource processing, military, storage, and support.
- **Placement:** Strategic placement is crucial for efficient resource flow and defense. Proximity to resources or linked production buildings minimizes travel time.

### 3.3. Transportation Network & Logistics

An efficient system for moving goods is vital for economic success.

- **Roads & Flags:**
    - Players define paths by placing Flags. Roads automatically form between connected Flags.
    - Serfs designated as Transporters carry goods between Flags, moving them from production buildings to consumers or storage.
- **Goods Flow:**
    - Goods are picked up from a building's output area and dropped off at the input area of another building or a Flag along the route.
    - Only one Transporter can occupy the path segment between two adjacent Flags at any given time.
- **Bottlenecks:** Poor road layout or an insufficient number of Transporters can lead to bottlenecks, stalling production.
- **Prioritization:** Players can set priorities for the distribution of goods to direct resources where they are most needed. The **Goods Distribution** system supports:
    - **Per-resource priority (1-5):** Controls how eagerly each resource type is routed. Higher priority = routed first.
    - **Per-building importance (1-5):** Controls which buildings receive goods first. Default is 3.
    - **Composite routing score:** `importance × priority / distance` — determines which building gets a resource when multiple consumers compete.
    - Settings are serialized with save/load.

### 3.4. Territory Expansion

Increasing the player's controlled territory is essential for accessing new resources and gaining strategic advantages.

- **Military Buildings:** Constructing Guard Huts, Watchtowers, and other military structures extends the player's borders.
- **Claiming Land:** Each military building projects an area of influence. Overlapping influence can be contested.
- **Resource Access:** Expansion is necessary to reach new forests, stone deposits, mountain ranges (for mining), and fertile land.

### 3.5. Combat System

While heavily focused on economics, military conquest is the ultimate path to victory.

- **Knights:** The primary military unit.
    - **Recruitment:** Knights are automatically recruited in military buildings (Guard Hut, Watchtower, Barracks) when a set of Sword and Shield is delivered to that building. The serf that delivers the weapons becomes the Knight.
    - **Strength & Ranks:** Knights have combat strength that can be increased through:
        - Experience gained from combat (potentially up to 5 ranks/levels).
        - The amount of Gold Bars stored in the kingdom's treasury (boosting morale/effectiveness).
- **Attacking:**
    - Players direct Knights stationed in a military building to attack an adjacent enemy military building.
    - Knights will move to the target and engage enemy Knights stationed there.
- **Combat Resolution:**
    - Combat is typically resolved through one-on-one duels between Knights.
    - The Knight with higher strength (factoring in rank and gold bonus) is more likely to win.
    - **Combat Animation Phases:** Each duel plays through 5 visual phases:
        1. **Approach** (0.5s): Knights interpolate toward midpoint, face each other.
        2. **Clash** (0.3s × 2-4 hits): Knights swing ±0.5 rad, flash on impact.
        3. **Recoil** (0.2s): Knights bounce apart.
        4. **Result** (0.8s): Winner scale pulse (1.0→1.1→1.0), loser falls (rotation.x → PI/2) + fades.
        5. **Done**: Loser removed, winner returns. Knight enters `Fighting` unit state during duel.
- **Capturing Buildings:**
    - If all defending Knights in an enemy military building are defeated, that building is captured by the attacker.
    - Capturing an enemy military building can lead to adjacent non-military enemy buildings being captured or destroyed if they fall within the new territory.
- **Civilian Serfs:** Civilian serfs cannot be directly attacked. If their workplace is captured or destroyed, they will attempt to return to the Castle or seek new employment.

### 3.6. Economic Management

Players manage their economy through building placement, production settings, and distribution priorities.

- **Indirect Control:** Players do not directly control individual serfs. Instead, they create jobs by constructing buildings. Serfs will automatically fill available roles.
- **Distribution Settings:** A dedicated interface allows players to set priorities for which goods are transported and to which types of buildings (e.g., ensure iron goes to Toolmakers before Blacksmiths if tools are critically low).
- **Statistics:** A statistics panel provides data on resource stockpiles, production rates, serf population, and other key economic indicators.
- **Economy Tracking:** An `EconomyTracker` provides real-time analytics:
    - Rolling 5-minute window of production/consumption events.
    - Per-resource production rate (items/min), consumption rate, and net balance.
    - Bottleneck detection: resources with negative net balance are flagged.
    - History snapshots (10 datapoints) for sparkline visualizations.

### 3.7. Marketplace & Barter Trading

A barter-based marketplace lets players exchange resources for other resources without currency.

- **Two Trading Venues:**
    - **Market Building:** A logistics building requiring a Merchant worker. 10% trade fee, 3s cooldown, up to 10 items per trade. Provides NPC stock, traveling merchants, and auto-trade rules.
    - **Castle (Fallback):** Emergency trading at 25% fee, 10s cooldown, max 5 items. Available immediately without building a Market.
- **Dynamic Pricing:** Each resource has a price multiplier (starts 1.0) that shifts based on supply/demand. Buying raises the price (+5%/unit), selling lowers it (-3%/unit). Prices decay back toward baseline at 0.002/s. Clamped between 50%–200%.
- **NPC Virtual Stock:** The NPC merchant stocks ~12 resource types, biased toward resources the player needs. Restocks every 60 seconds. Buying depletes stock; selling doesn't affect it.
- **Traveling Merchants:** Every 5 minutes, a traveling merchant arrives at the Market with 3 special deals (bulk buy, bulk sell, swaps, rare offers) at 20% better rates. Stays for 60 seconds.
- **Auto-Trade Rules:** Players set up to 8 rules to automate trading (e.g., "buy Iron Bars when stock < 10, pay with Wood"). Rules run every 15 seconds.
- **Base Trade Values:** Every resource has a relative value (Wood=2, Bread=7, Siege Ram=20) determining exchange ratios. All values are data-driven and overrideable.
- **AI Trading:** AI players trade surplus for shortage every 30s with price sensitivity limits.
- **See:** `docs/marketplace-guide.md` for the full system guide, `docs/marketplace.md` for the design document.

### 3.8. World and Map

- **Map Generation:** Maps can be pre-designed scenarios or generated randomly based on a numerical seed. Map sizes vary.
- **Terrain Types:**
    - **Grassland:** Ideal for most buildings and farms.
    - **Forest:** Contains trees for wood.
    - **Mountain:** Contains stone and is the only place where ores (Iron, Coal, Gold) can be found via prospecting and mining.
    - **Water:** Required for fishing. May also act as a barrier or transport route (with harbors).
    - **Desert/Wasteland:** Unusable for construction or resource gathering.
- **World Wrapping:** Maps wrap around, meaning units or expansion moving off one edge will appear on the opposite edge.

## 4. Game Elements

### 4.1. Resources

#### 4.1.1. Raw Materials

- **Wood (Logs):**
    - Source: Chopping trees (by Woodcutter).
    - Use: Construction of basic buildings, input for Sawmill.
- **Stone:**
    - Source: Quarrying stone deposits (by Stonemason) or from Stone Mines in mountains.
    - Use: Construction of advanced buildings.
- **Grain:**
    - Source: Harvested by Farmer at a Farm.
    - Use: Input for Windmill (to make Flour), input for Pig Farm (to feed pigs).
- **Fish:**
    - Source: Caught by Fisherman at a Fisherman's Hut (requires proximity to water).
    - Use: Food for Miners.
- **Iron Ore:**
    - Source: Extracted by Miner from an Iron Mine (requires Geologist to find deposit).
    - Use: Input for Iron Smelter.
- **Coal Ore:**
    - Source: Extracted by Miner from a Coal Mine (requires Geologist to find deposit).
    - Use: Fuel for Iron Smelter, Blacksmith, Goldsmith, Bakery.
- **Gold Ore:**
    - Source: Extracted by Miner from a Gold Mine (requires Geologist to find deposit).
    - Use: Input for Goldsmith/Mint.

#### 4.1.2. Processed Goods

- **Planks (Lumber):**
    - Source: Produced by Sawmill from Wood.
    - Use: Construction of many buildings, input for Toolmaker, Blacksmith, etc.
- **Flour:**
    - Source: Produced by Windmill from Grain.
    - Use: Input for Bakery.
- **Bread:**
    - Source: Produced by Bakery from Flour (requires Coal as fuel).
    - Use: Food for Miners.
- **Meat (Pork):**
    - Source: Produced by Slaughterhouse from Pigs (from Pig Farm).
    - Use: Food for Miners.
- **Iron Bars:**
    - Source: Produced by Iron Smelter from Iron Ore (requires Coal as fuel).
    - Use: Input for Toolmaker, Blacksmith.
- **Gold Bars:**
    - Source: Produced by Goldsmith/Mint from Gold Ore (requires Coal as fuel).
    - Use: Increases combat strength/morale of all Knights in the kingdom.
- **Tools (e.g., Axe, Pickaxe, Scythe, Hammer, Fishing Rod):**
    - Source: Produced by Toolmaker from Iron Bars and Planks.
    - Use: Required by specific professions (Woodcutter, Stonemason, Farmer, Miner, Fisherman, Builder) to work. Consumed over time or upon serf creation.
- **Swords:**
    - Source: Produced by Blacksmith from Iron Bars and Coal.
    - Use: Component for creating a Knight.
- **Shields:**
    - Source: Produced by Blacksmith from Iron Bars, Planks and Coal.
    - Use: Component for creating a Knight.

### 4.2. Buildings

Buildings form the backbone of the settlement, facilitating resource gathering, production, and military might. Construction generally requires Wood and/or Stone, and Planks for more advanced structures.

- **Tier 0: Core**

    - **Castle:**
        - Cost: N/A (Starting building).
        - Function: Central hub, stores initial resources, serfs return here if their workplace is lost. Destruction of the Castle results in defeat. Produces basic serfs.

- **Tier 1: Basic Economy & Expansion**

    - **Woodcutter's Hut:**
        - Cost: Wood.
        - Serf: Woodcutter (requires Tool: Axe).
        - Function: Chops down mature trees to produce Wood (Logs).
    - **Forester's Hut:**
        - Cost: Wood.
        - Serf: Forester.
        - Function: Plants new saplings to ensure a renewable supply of trees.
    - **Quarry:**
        - Cost: Wood.
        - Serf: Stonemason (requires Tool: Pickaxe).
        - Function: Extracts Stone from surface stone deposits. Limited resource.
    - **Fisherman's Hut:**
        - Cost: Wood.
        - Serf: Fisherman (requires Tool: Fishing Rod).
        - Function: Catches Fish from adjacent water tiles. Provides food.
    - **Guard Hut:**
        - Cost: Wood.
        - Function: Expands territory. Houses a small number of Knights (e.g., 2-3). Requires Swords & Shields for Knight recruitment.

- **Tier 2: Resource Processing & Advanced Gathering**

    - **Sawmill:**
        - Cost: Wood.
        - Serf: Sawmill Worker.
        - Input: Wood (Logs).
        - Output: Planks.
    - **Farm:**
        - Cost: Wood, Planks.
        - Serf: Farmer (requires Tool: Scythe).
        - Function: Grows and harvests Grain on adjacent flat, fertile land.
    - **Geologist's Hut:**
        - Cost: Wood, Planks.
        - Serf: Geologist.
        - Function: Sends Geologists to prospect mountain tiles. Marks locations of Iron Ore, Coal Ore, Gold Ore, or deep Stone deposits.
    - **Mine (Iron, Coal, Gold, Stone):**
        - Cost: Wood, Planks. (Stone also if Stone Mine)
        - Serf: Miner (requires Tool: Pickaxe).
        - Input: Food (Fish, Bread, or Meat).
        - Function: Extracts specified ore/stone from a prospected mountain deposit. Different mine types for each resource.
    - **Watchtower:**
        - Cost: Wood, Stone, Planks.
        - Function: Expands territory more significantly than a Guard Hut. Houses more Knights (e.g., 5-7). Requires Swords & Shields for Knight recruitment.

- **Tier 3: Specialized Production & Stronger Military**

    - **Windmill:**
        - Cost: Wood, Stone, Planks.
        - Serf: Miller.
        - Input: Grain.
        - Output: Flour.
    - **Bakery:**
        - Cost: Wood, Stone, Planks.
        - Serf: Baker.
        - Input: Flour, Coal (as fuel).
        - Output: Bread (food for Miners).
    - **Pig Farm:**
        - Cost: Wood, Planks.
        - Serf: Pig Farmer.
        - Input: Grain (to feed pigs).
        - Output: Pigs (live animals, transported to Slaughterhouse).
    - **Slaughterhouse:**
        - Cost: Wood, Stone, Planks.
        - Serf: Butcher.
        - Input: Pigs.
        - Output: Meat (food for Miners).
    - **Iron Smelter:**
        - Cost: Wood, Stone, Planks.
        - Serf: Smelter Worker.
        - Input: Iron Ore, Coal (as fuel).
        - Output: Iron Bars.
    - **Toolmaker's Workshop:**
        - Cost: Wood, Stone, Planks.
        - Serf: Toolmaker.
        - Input: Iron Bars, Planks.
        - Output: Tools (Axes, Pickaxes, Scythes, Hammers, Fishing Rods, etc.).
    - **Goldsmith/Mint:**
        - Cost: Wood, Stone, Planks.
        - Serf: Goldsmith.
        - Input: Gold Ore, Coal (as fuel).
        - Output: Gold Bars.
    - **Blacksmith/Armory:**
        - Cost: Wood, Stone, Planks.
        - Serf: Blacksmith.
        - Input: Iron Bars, Coal (as fuel). (Planks may be needed for shields).
        - Output: Swords, Shields.
    - **Barracks/Fortress:**
        - Cost: Wood, Stone, Planks.
        - Function: Major military building. Houses a large number of Knights (e.g., 10-15+). May offer faster Knight promotion or other military bonuses. Requires Swords & Shields for Knight recruitment.

- **Logistics & Other**
    - **Warehouse/Storehouse:**
        - Cost: Wood, Planks.
        - Function: Centralized storage for surplus goods. Transporters can pick up and drop off goods here.
    - **Builder's Hut (Conceptual - may be part of Castle functionality):**
        - Function: Houses/manages Builder serfs. Builders require Tools (Hammers).
    - **Harbor (Optional, for maps with significant water bodies):**
        - Cost: Wood, Stone, Planks.
        - Function: Allows for transport of goods across water using boats (automated).

### 4.3. Units (Serfs & Knights)

Players do not directly command individual serfs; they take on roles based on available jobs. Knights are the exception, being directable for attacks.

#### 4.3.1. Serfs (Approx. 21 professions)

General populace that performs all labor. Spawn from the Castle when jobs are available and housing/food conditions are met (implicit).

- **Transporter:** Carries goods between buildings/flags along roads.
- **Builder:** (Requires Tool: Hammer) Constructs and repairs buildings.
- **Woodcutter:** (Requires Tool: Axe) Chops trees.
- **Forester:** Plants trees.
- **Stonemason (Quarry Worker):** (Requires Tool: Pickaxe) Gathers stone from quarries.
- **Miner:** (Requires Tool: Pickaxe, Food) Extracts ores/stone from Mines.
- **Farmer:** (Requires Tool: Scythe) Works at a Farm, planting and harvesting Grain.
- **Fisherman:** (Requires Tool: Fishing Rod) Catches Fish.
- **Miller:** Works at a Windmill, converting Grain to Flour.
- **Baker:** Works at a Bakery, baking Bread.
- **Pig Farmer:** Raises pigs at a Pig Farm.
- **Butcher:** Works at a Slaughterhouse, processing Pigs into Meat.
- **Sawmill Worker:** Works at a Sawmill, converting Wood to Planks.
- **Smelter Worker:** Works at an Iron Smelter, converting Iron Ore to Iron Bars.
- **Goldsmith:** Works at a Goldsmith/Mint, converting Gold Ore to Gold Bars.
- **Toolmaker:** Works at a Toolmaker's Workshop, crafting Tools.
- **Blacksmith:** Works at a Blacksmith, forging Swords and Shields.
- **Geologist:** Prospects mountain ranges for ore deposits.
- _(Other specialized serfs as per building functions, e.g., warehouse keeper if implemented)._

#### 4.3.2. Knights

The sole military unit.

- **Recruitment:** A serf becomes a Knight upon delivering a Sword and Shield set to a military building with an empty Knight slot.
- **Ranks/Levels:** Gain experience (levels/ranks, e.g., up to 5) through combat, increasing their base strength.
- **Gold Influence:** The total amount of Gold Bars in the kingdom's treasury provides a global bonus to the combat strength/morale of all Knights.
- **Stationing:** Stationed in military buildings (Guard Huts, Watchtowers, Barracks).
- **Combat:** Engage enemy Knights in one-on-one duels when attacking or defending a military structure.

## 5. Technology & Progression Tree

Progression is primarily gated by access to resources and the construction of prerequisite buildings. There isn't a research tree in the traditional sense, but rather an economic and structural dependency tree:

1.  **Basic Wood/Stone Economy:** Woodcutter, Quarry -> Sawmill (for Planks).
2.  **Food Production:**
    - Fisherman (direct food).
    - Farm -> Windmill -> Bakery (complex food chain for Bread).
    - Farm (for grain) -> Pig Farm -> Slaughterhouse (complex food chain for Meat).
3.  **Mining Operations:** Geologist -> Mine (requires Tools, Food for Miners).
4.  **Metal Production:** Mine (Iron Ore) -> Iron Smelter (requires Coal) -> Iron Bars.
5.  **Tool Production:** Iron Bars + Planks -> Toolmaker -> Tools (unlocks/sustains many professions).
6.  **Weapon Production:** Iron Bars + Coal (+ Planks for shields) -> Blacksmith -> Swords & Shields (unlocks Knights).
7.  **Gold Economy:** Mine (Gold Ore) -> Goldsmith (requires Coal) -> Gold Bars (boosts Knights).
8.  **Military Expansion:** Guard Hut -> Watchtower -> Barracks (increasing cost, Knight capacity, and territorial influence).

Unlocking a new building often requires resources produced by previous buildings (e.g., Planks from Sawmill for most advanced buildings, Iron Bars for tool/weapon makers).

## 6. User Interface (Key Elements)

- **Main Game View:**
    - Isometric perspective of the game world.
    - Scrollable and zoomable (to a degree).
    - Displays serfs, buildings, resources on the ground, terrain features.
- **Construction Menu:**
    - Accessed via a button/panel.
    - Shows available buildings, their costs, and allows placement.
- **Information Panels:**
    - Selected Building Panel: Shows status, stored goods, workers, production options for the selected building.
    - Selected Unit Panel (for Knights): Shows rank, stats.
- **Global Statistics Panel:**
    - Overview of resource stockpiles (total wood, stone, food types, ores, processed goods, tools, weapons, gold).
    - Serf population breakdown by profession.
    - Military strength overview.
- **Goods Distribution/Priorities Panel:**
    - Allows players to set rules for where specific goods should be transported first (e.g., ensure Farms get priority for Transporters picking up Grain).
    - Control ratios or limits for production/storage.
- **Military Management Panel:**
    - Overview of all military buildings.
    - Shows number of Knights stationed, available slots.
    - Interface to order attacks from a selected military building to an adjacent enemy one.
    - Option to set Knight recruitment priorities for different outposts.
- **Minimap:** A small overview map for quick navigation.
- **Alerts/Notifications:** Inform players of important events (e.g., mine depleted, under attack, lack of tools).
- **Building Hover Tooltips:** Hovering over (desktop) or long-pressing (500ms, mobile) a building shows a tooltip with: name, status, worker assignment, production progress %, construction progress %, inventory summary (inputs/outputs), and knight slots. Positioned near cursor, flips if overflowing viewport.
- **Building Status Icons:** Sprite icons above buildings indicate their current status at a glance:
    - **No Worker** (red X) — highest priority
    - **Missing Inputs** (amber hourglass)
    - **Storage Full** (orange warning triangle)
    - **Producing** (green checkmark)
    - **Under Construction** (blue hammer) — lowest priority
    - Icons use cached `CanvasTexture` (5 textures shared across all buildings). Update every 500ms.
- **Production Chain Visualization:** Selecting a building shows animated dashed lines to upstream (input source buildings, blue) and downstream (output consumer buildings, orange). Cone arrows at endpoints. Max 10 connections.
- **Statistics Dashboard:** Fullscreen overlay with 5 tabs and Canvas-based charts (accessible via toolbar button or nav drawer):
    - **Overview:** KPI cards (population, total resources, efficiency %, morale %), production balance dual-bar chart, population line chart, efficiency donut, bottleneck alerts.
    - **Economy:** Time scale selector (5m/15m/30m/1hr), resource filter (All/Raw/Processed/Food/Military), production vs consumption dual-bar chart, click-to-drill rate-over-time line chart, rate details table.
    - **Resources:** Stock levels over time (top 5 line chart), full inventory table with trend arrows, production/consumption rates.
    - **Population:** Population & capacity over time (line chart), morale over time (line chart), hunger stats (satiation, hungry/starving counts), food supply, unit breakdown by type.
    - **Buildings:** Efficiency donut (producing/waiting input/waiting output/no worker/paused), building status table (per-type counts), under-construction progress bars.

## 7. Winning Conditions

- **Primary Condition:** Defeat all opponent players. This is typically achieved by destroying their starting Castle.
- **Additional Conditions:**
    - **Domination:** Control 75%+ of claimable land.
    - **Economic:** Accumulate 50+ gold bars.
- **Scenario-Specific Conditions:** Pre-designed maps or missions might have unique objectives.

## 8. Visual Effects & Ambient Life

The game features a suite of ambient visual effects that bring the settlement to life:

### 8.1. Particle Effects

Pool-based particle system (800 particle budget, single draw call per effect type):

| Effect | Buildings | Color | Lifetime |
|--------|-----------|-------|----------|
| Chimney smoke | Bakery, Smelter, Blacksmith, Goldsmith | gray→white | 3-5s |
| Forge sparks | Smelter, Blacksmith | orange→yellow | 0.5-1s |
| Sawmill chips | Sawmill | tan | 0.3-0.8s |
| Construction dust | Any UnderConstruction | beige | 1-2s |
| Tree chop debris | Woodcutter (working) | brown+green | burst |
| Completion flash | Any → Active transition | green | burst |

### 8.2. Building Animations

- **Windmill sails**: Rotate at 2.0 rad/s when producing, stop when idle.
- **Furnace glow**: Emissive pulse on Smelter/Blacksmith/Bakery/Goldsmith when producing.
- **Sawmill blade**: Oscillates rotation when producing.
- **Construction opacity**: Ramps from 30% to 100% based on construction progress.
- **Planned buildings**: Render at 20% opacity (translucent preview).
- **Completion glow**: 2-second green emissive pulse when a building becomes Active.
- **Destruction**: Scale collapse + tilt + fade over 1 second.

### 8.3. Tree Wind Sway

GPU-driven wind animation via custom shader. Per-instance phase offset prevents synchronized sway. Only treetop vertices are displaced (trunk stays fixed). Zero CPU cost.

### 8.4. Military Visual Effects

- **Attack warning**: Pulsing red ring + exclamation icon above attacked buildings (5Hz pulse).
- **Capture banner**: Player-colored plane rises from y=0.1 to y=0.6 over 1 second on building capture.
- **Knight faction colors**: Knight meshes tinted 40% toward player color (blue/red/green/yellow).
- **Rank chevrons**: Gold pyramids on knight shoulder (1-5 based on knightRank).

### 8.5. Distance-Based Production

Gathering buildings produce slower when far from their harvest terrain:
- Formula: `effectiveTime = baseTime × min(3.0, 1.0 + max(0, distance-1) × 0.25)`
- Placement preview shows color-coded distance rating (green/orange/red).
- Mines on Mountain terrain get distance 0 (optimal). Fisherman adjacent to Water gets distance 1 (optimal).
- Processing, military, and logistics buildings are unaffected.

### 8.6. Ambient Life Systems (Living World)

Six visual systems that make the world feel alive. All follow the renderer pattern (constructor → addToScene → update → dispose). Controlled via `ambientLife` graphics setting (`off` | `minimal` | `full`). See `docs/living-world.md` for full design spec.

| System | Renderer | Draw Calls | Desktop | Mobile | Night Behavior |
|--------|----------|-----------|---------|--------|----------------|
| Clouds | `CloudRenderer` | 2 (clouds + shadows) | 30 | 15 | Tint white → grey-blue |
| Birds | `BirdFlockRenderer` | 1 | 40 points | 15 | Fade out at nightness > 0.7 |
| Water sparkles | `WaterEffectRenderer` | 1 | 60 points | disabled | None at night |
| Wild animals | `WildAnimalRenderer` | 4 (per model type) | 20 | 12 | Always active |
| Butterflies | `FlowerButterflyRenderer` | 1 | 25 points | 15 | Fade out at nightness > 0.3 |
| Bee swarms | `ParticleSystem` (Bees effect) | 0 (shared) | 8/sec per Apiary | same | Always active |

**Cloud system**: Procedural Canvas2D textures on billboard InstancedMesh. Ground shadows offset by sun angle. Camera-relative wrapping.

**Bird flocks**: GPU-driven via custom shader. V-shape fragment shader with wing flap animation. CPU updates only flock centers (5 vec3/frame); individual bird positions computed on GPU. Flight patterns: linear crossing or circling.

**Wild animals**: Deer (grassland near forest), rabbits (grassland), mountain goats (mountain), fish (water — jump briefly, then hidden). Simple state machine: idle → grazing → walking. Deterministic spawn from seeded RNG.

**Butterflies**: GPU-driven points near grassland positions. Wing flap via point size oscillation. 4 colors (white, yellow, blue, orange). Daytime only.

### 8.7. Living World Production Chains

Five new buildings, five resources, and five units that tie gameplay to the ambient world:

```
HUNTING:    Forest → Hunting Lodge [Hunter + Bow] → Game Meat (0.55 sat)
TRAPPING:   Forest → Trapper's Hut [Trapper]      → Pelts → Furrier → Fur Coat (luxury morale)
BEEKEEPING: Grassland → Apiary [Beekeeper]         → Honey (0.40 sat)
                                                        ↓
                                                   Meadery [Meadmaker] → Mead (drink, morale)
                                                                            ↓
                                                                        Inn/Tavern
```

**Data-driven service buildings**: The `inputCategory` field on `ProductionRecipe` enables buildings like Inn/Tavern to accept any `isDrink` resource (Beer, Wine, Mead) without hardcoding. Similarly `isLuxury` resources (Fur Coat) provide morale bonuses.

**TerrainGatheringManager**: A single data-driven manager handles all terrain-gathering buildings (Hunting Lodge, Trapper's Hut). Building definition fields (`harvestTerrain`, `workRadius`, `productionTime`) drive the behavior — adding future terrain gatherers requires zero code changes.
