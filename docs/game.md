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
- **Prioritization:** Players can set priorities for the distribution of goods to direct resources where they are most needed.

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
- **Capturing Buildings:**
    - If all defending Knights in an enemy military building are defeated, that building is captured by the attacker.
    - Capturing an enemy military building can lead to adjacent non-military enemy buildings being captured or destroyed if they fall within the new territory.
- **Civilian Serfs:** Civilian serfs cannot be directly attacked. If their workplace is captured or destroyed, they will attempt to return to the Castle or seek new employment.

### 3.6. Economic Management

Players manage their economy through building placement, production settings, and distribution priorities.

- **Indirect Control:** Players do not directly control individual serfs. Instead, they create jobs by constructing buildings. Serfs will automatically fill available roles.
- **Distribution Settings:** A dedicated interface allows players to set priorities for which goods are transported and to which types of buildings (e.g., ensure iron goes to Toolmakers before Blacksmiths if tools are critically low).
- **Statistics:** A statistics panel provides data on resource stockpiles, production rates, serf population, and other key economic indicators.

### 3.7. World and Map

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

## 7. Winning Conditions

- **Primary Condition:** Defeat all opponent players. This is typically achieved by destroying their starting Castle.
- **Scenario-Specific Conditions:** Pre-designed maps or missions might have unique objectives.
