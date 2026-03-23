# Feudal Realm Manager: Building Visual Designs (Simple 3D Shapes)

This document outlines the visual design for each building in Feudal Realm Manager, using only simple 3D geometric shapes (cubes, cuboids, pyramids, cylinders, spheres, cones) and distinct colors. No complex shapes or textures are to be used. The aim is for clear, distinguishable structures that hint at their function.

## Runtime Visual Effects

All buildings share these runtime visual behaviors (implemented in `BuildingAnimator.ts`, `ParticleSystem.ts`, `BuildingStatusOverlay.ts`):

- **Construction phase**: Opacity ramps from 30% → 100% as construction progresses. Planned buildings render at 20% translucent. Construction dust particles emit at active build sites.
- **Completion**: Green emissive glow pulse (2 seconds) + green particle burst when a building becomes Active.
- **Destruction**: Scale collapse (Y→0, XZ expand) + tilt + fade over 1 second, with dust particle burst.
- **Status icon overlay**: A sprite icon floats above each building showing its current status (no-worker: red X, missing-inputs: amber hourglass, storage-full: orange warning, producing: green check, construction: blue hammer). Updates every 500ms.
- **Scale factors**: Some buildings have per-model scale factors (1.15×–2.5×) applied at render time to ensure proportional footprints across all building types. See `BUILDING_SCALE` in `BuildingRenderer.ts`.

---

## Core Buildings

### 1. Castle

- **Function:** Main hub, initial resource storage, serf spawning point. Destruction leads to defeat.
- **Visual Description:**
    - **Base:** Large, wide, medium-height square cuboid (color: Medium Grey).
    - **Keep:** Centered on the base, a taller, slightly narrower square cuboid (color: Dark Grey).
    - **Towers:** Four smaller square cuboids at each corner of the base, slightly taller than the base but shorter than the keep (color: Light Grey). Each tower is topped with a small, sharp pyramid (color: Red).
    - **Entrance:** A darker grey rectangular indentation on one side of the base.
- **Relative Dimensions:** Largest footprint, tall.
- **Key Colors:** Medium Grey, Dark Grey, Light Grey, Red.

---

## Resource Gathering & Basic Economy

### 2. Woodcutter's Hut

- **Function:** Employs a Woodcutter to chop down trees for Wood (Logs).
- **Visual Description:**
    - **Hut:** Small, low cuboid (color: Brown).
    - **Roof:** A slightly larger, shallow-angled cuboid placed on top, creating eaves (color: Dark Brown).
    - **Logs:** A small stack of 2-3 short cylinders beside the hut (color: Light Brown).
- **Relative Dimensions:** Small footprint, low height.
- **Key Colors:** Brown, Dark Brown, Light Brown.

### 3. Forester's Hut

- **Function:** Employs a Forester to plant new saplings.
- **Visual Description:**
    - **Hut:** Small, low cuboid (color: Brown).
    - **Roof:** A simple pyramid roof (color: Dark Green).
    - **Sapling:** A tiny green cone next to the hut.
- **Relative Dimensions:** Small footprint, low height.
- **Key Colors:** Brown, Dark Green, Green.

### 4. Quarry

- **Function:** (Represents the site and structure for Stonemasons to extract Stone from surface deposits).
- **Visual Description:**
    - **Structure:** A small, open-fronted cuboid shelter built against a patch of rough terrain (represented by several jagged light grey cuboids).
    - **Building:** The shelter is a simple cuboid (color: Grey).
    - **Output:** A few loose medium-sized cubes (stone blocks) outside the opening (color: Light Grey).
- **Relative Dimensions:** Structure is small to medium footprint, low height.
- **Key Colors:** Grey, Light Grey.

### 5. Fisherman's Hut

- **Function:** Employs a Fisherman to catch Fish. Must be built adjacent to water.
- **Visual Description:**
    - **Hut:** Small cuboid (color: Light Blue).
    - **Roof:** A simple pyramidal roof (color: Dark Blue).
    - **Pier (Optional):** A thin, flat cuboid extending a short distance from the hut towards/over the water (color: Brown).
- **Relative Dimensions:** Small footprint, low height.
- **Key Colors:** Light Blue, Dark Blue, Brown.

### 6. Farm

- **Function:** Employs a Farmer to grow and harvest Grain.
- **Visual Description:**
    - **Farmhouse:** A small, long, low cuboid (color: Beige or Light Brown).
    - **Roof:** A simple sloped cuboid roof (color: Red-Brown).
    - **Fields:** Adjacent flat area demarcated by very low, flat cuboids (color: Yellow for ripe grain, Green for growing).
- **Relative Dimensions:** Farmhouse is small; fields require a larger flat area.
- **Key Colors:** Beige/Light Brown (building), Red-Brown (roof), Yellow/Green (fields).

### 7. Geologist's Hut

- **Function:** Employs a Geologist to prospect mountains for ore deposits.
- **Visual Description:**
    - **Hut:** Very small cuboid (color: Dark Brown).
    - **Roof:** Flat roof.
    - **Marker:** A small, bright yellow cone on top of the roof or beside the hut.
- **Relative Dimensions:** Very small footprint, low height.
- **Key Colors:** Dark Brown, Yellow.

### 8. Mine (General Structure)

- **Function:** Employs Miners to extract specific ores or stone from mountain deposits found by Geologists.
- **Visual Description:**
    - **Entrance:** A dark grey cuboid representing a reinforced mine entrance, appearing to be built into a "mountain" (visual representation of mountainous terrain).
    - **Opening:** A darker, smaller square/rectangle on the front face of the cuboid to signify the mine shaft.
    - **Ore Indicator:** A small, distinctively colored shape near the entrance:
        - **Iron Mine:** Red cube.
        - **Coal Mine:** Black sphere or cube.
        - **Gold Mine:** Yellow sphere.
        - **Stone Mine:** Light grey cube.
- **Relative Dimensions:** Medium footprint (where it meets the mountain), low to medium height.
- **Key Colors:** Dark Grey (structure), plus Red, Black, Yellow, or Light Grey (indicator).

---

## Resource Processing

### 9. Sawmill

- **Function:** Converts Wood (Logs) into Planks.
- **Visual Description:**
    - **Main Building:** Medium-sized cuboid (color: Brown).
    - **Roof:** A sloped cuboid roof (color: Dark Brown).
    - **Processing Area:** An open-sided extension or a slightly lower, longer cuboid attached, where logs (cylinders) might be seen at one end and planks (thin cuboids) at the other.
    - **Particles:** Wood chips (tan, 8/s) when producing.
    - **Animation:** Saw blade oscillates `rotation.x = sin(t * 6.0) * 0.5` when producing.
- **Relative Dimensions:** Medium footprint, medium height.
- **Key Colors:** Brown, Dark Brown.

### 10. Windmill

- **Function:** Grinds Grain into Flour.
- **Visual Description:**
    - **Base:** A tall, slightly tapering cylinder or an octagonal prism (color: Beige or Light Grey).
    - **Cap/Roof:** A conical or domed shape on top of the base (color: Dark Brown or Red).
    - **Sails:** Four long, thin cuboids attached to a central point on the upper part of the base, angled like windmill sails (color: White or Light Grey).
    - **Animation:** Sails rotate at 2.0 rad/s when producing (controlled by `BuildingAnimator`). Stop when idle.
- **Relative Dimensions:** Medium footprint, tall.
- **Key Colors:** Beige/Light Grey, Dark Brown/Red, White.

### 11. Bakery

- **Function:** Bakes Bread from Flour (requires Coal).
- **Visual Description:**
    - **Main Building:** Medium cuboid (color: Orange or Terracotta).
    - **Roof:** Simple sloped cuboid roof (color: Dark Brown).
    - **Chimney:** A taller, thin square cuboid attached to the side or rear (color: Dark Grey or Black), possibly with a tiny red cube on top (embers).
    - **Particles:** Chimney smoke (grey→white) when producing. Emitted at 3/s, lifetime 3-5s.
    - **Animation:** Emissive glow pulse when producing.
- **Relative Dimensions:** Medium footprint, medium height (plus chimney).
- **Key Colors:** Orange/Terracotta, Dark Brown, Dark Grey/Black.

### 12. Pig Farm

- **Function:** Raises Pigs (requires Grain).
- **Visual Description:**
    - **Sty:** A long, low cuboid building (color: Light Brown).
    - **Pen:** An adjacent area enclosed by thin vertical cuboids (fence posts) (color: Dark Brown).
    - **Pigs (Optional):** Tiny pinkish spheres or rounded cuboids within the pen.
- **Relative Dimensions:** Medium footprint (sty + pen), low height.
- **Key Colors:** Light Brown, Dark Brown, Pink (optional).

### 13. Slaughterhouse

- **Function:** Processes Pigs into Meat.
- **Visual Description:**
    - **Building:** Medium cuboid (color: Dark Red or Maroon).
    - **Roof:** Simple sloped cuboid roof (color: Dark Brown).
    - **Accent:** A small grey cube near an entrance (chopping block).
- **Relative Dimensions:** Medium footprint, medium height.
- **Key Colors:** Dark Red/Maroon, Dark Brown, Grey.

### 14. Iron Smelter

- **Function:** Converts Iron Ore into Iron Bars (requires Coal).
- **Visual Description:**
    - **Base:** A sturdy, dark grey cuboid.
    - **Furnace/Chimney:** A prominent, taller, slightly tapering square or cylindrical cuboid attached or rising from the base (color: Black or Very Dark Grey).
    - **Glow:** A small bright orange or red cube at the base of the furnace/chimney to indicate heat.
    - **Particles:** Chimney smoke (grey→white, 3/s) + forge sparks (orange→yellow, 5/s) when producing.
    - **Animation:** Emissive glow pulse when producing.
- **Relative Dimensions:** Medium footprint, tall due to chimney.
- **Key Colors:** Dark Grey, Black, Orange/Red.

### 15. Toolmaker's Workshop

- **Function:** Crafts Tools from Iron Bars and Planks.
- **Visual Description:**
    - **Building:** Medium cuboid (color: Brown).
    - **Roof:** Sloped cuboid roof (color: Grey).
    - **Anvil (Optional):** A small, T-shaped structure made of two grey cuboids next to the building.
- **Relative Dimensions:** Medium footprint, medium height.
- **Key Colors:** Brown, Grey.

### 16. Goldsmith / Mint

- **Function:** Converts Gold Ore into Gold Bars (requires Coal).
- **Visual Description:**
    - **Building:** A sturdy, medium-sized cuboid (color: Light Grey or Beige).
    - **Roof:** Flat or slightly sloped cuboid roof (color: Dark Grey).
    - **Accent:** A prominent bright yellow cube or small pyramid on the roof or above the entrance.
    - **Particles:** Chimney smoke (grey→white, 3/s) when producing.
    - **Animation:** Emissive glow pulse when producing.
- **Relative Dimensions:** Medium footprint, medium height.
- **Key Colors:** Light Grey/Beige, Dark Grey, Yellow.

### 17. Blacksmith / Armory

- **Function:** Forges Swords and Shields from Iron Bars (requires Coal).
- **Visual Description:**
    - **Building:** A dark grey or black cuboid, possibly with an open front or large window.
    - **Forge Glow:** An orange or red glow (represented by a colored cube) visible from an opening.
    - **Chimney:** A short, wide, black cuboid chimney.
    - **Particles:** Chimney smoke (grey→white, 3/s) + forge sparks (orange→yellow, 5/s) when producing.
    - **Animation:** Emissive glow pulse when producing.
- **Relative Dimensions:** Medium footprint, medium height.
- **Key Colors:** Dark Grey/Black, Orange/Red.

---

## Military & Expansion

### 18. Guard Hut

- **Function:** Basic military outpost, expands territory, houses a few Knights.
- **Visual Description:**
    - **Structure:** Small, robust-looking square cuboid (color: Dark Grey).
    - **Roof/Banner:** A slightly smaller, flat red cuboid or a small red pyramid on top.
- **Relative Dimensions:** Small footprint, low to medium height.
- **Key Colors:** Dark Grey, Red.

### 19. Watchtower

- **Function:** Stronger military outpost, expands territory further, houses more Knights.
- **Visual Description:**
    - **Tower:** A tall, relatively thin cylinder or square prism (color: Stone Grey).
    - **Top:** A slightly wider cylinder or square prism on top of the tower, with small cubes arranged around its upper edge to suggest crenellations (color: Stone Grey).
    - **Flag:** A small red pyramid on the very top.
- **Relative Dimensions:** Small footprint, very tall.
- **Key Colors:** Stone Grey, Red.

### 20. Barracks / Fortress

- **Function:** Major military building, houses many Knights, significant territory expansion.
- **Visual Description:**
    - **Main Structure:** A large, wide, medium-height cuboid (color: Dark Grey or Black).
    - **Towers (Optional):** Smaller square cuboids at the corners, slightly taller than the main structure (color: Dark Grey).
    - **Accents:** Red pyramidal flags on any towers or prominent points.
- **Relative Dimensions:** Large footprint, medium to tall height.
- **Key Colors:** Dark Grey/Black, Red.

---

## Logistics & Other

### 21. Warehouse / Storehouse

- **Function:** Centralized storage for surplus goods.
- **Visual Description:**
    - **Building:** A long, wide, plain cuboid (color: Light Brown or Beige).
    - **Roof:** A simple, large, slightly sloped cuboid roof covering the entire structure (color: Darker Brown or Grey).
    - **Doors:** Several wide, darker rectangular indentations along the sides to represent loading bays/doors.
- **Relative Dimensions:** Large footprint, medium height.
- **Key Colors:** Light Brown/Beige, Darker Brown/Grey.

### 22. Builder's Hut (If separate from Castle)

- **Function:** Manages/houses Builder serfs.
- **Visual Description:**
    - **Hut:** Very small, simple cuboid (color: Brown).
    - **Materials:** A small stack of thin, light brown cuboids (planks) and a few grey cubes (stones) next to it.
- **Relative Dimensions:** Very small footprint, low height.
- **Key Colors:** Brown, Light Brown, Grey.

### 23. Harbor (Optional - for maps with significant water)

- **Function:** Facilitates transport of goods over water.
- **Visual Description:**
    - **Pier:** A long, flat, dark brown cuboid extending from the land out into the water.
    - **Dock Building:** A small light brown or grey cuboid building located at the land-end of the pier.
    - **Boats (Indicator):** Small, simple boat shapes (e.g., elongated blue cuboids with a small central vertical cuboid for a mast/cabin) docked alongside the pier.
- **Relative Dimensions:** Pier is long and narrow; dock building is small.
- **Key Colors:** Dark Brown (pier), Light Brown/Grey (building), Blue (boats).

### 24. Market

- **Function:** Barter trading post. Employs a Merchant to facilitate resource-for-resource exchanges with NPC traders. Provides dynamic pricing, NPC stock, traveling merchant deals, and auto-trade rules.
- **Visual Description:**
    - **Central Pavilion:** A medium-sized open structure with four wooden posts (brown cylinders) supporting a colorful patchwork roof (flat cuboid composed of red, blue, green, and yellow segments).
    - **Stalls:** Two or three smaller open-sided cuboid stalls arranged around the pavilion, with tiny cuboids representing displayed goods (assorted colors).
    - **Awnings:** Colorful canopy flaps (thin flat cuboids in warm colors: red `#C0392B`, gold `#DAA520`, blue `#2980B9`) extending from the stall tops.
    - **Ground Detail:** A slightly raised platform (flat beige cuboid) serving as the marketplace floor.
    - **Goods Display:** Small crates (brown cuboids) and barrels (brown cylinders) near stall fronts suggesting active commerce.
- **Relative Dimensions:** Medium footprint (similar to Sawmill), low to medium height.
- **Key Colors:** Brown (structure), Red/Gold/Blue (awnings), Beige (platform).

---

## Housing

### 26. Small House

- **Function:** Increases population capacity by 8. No worker or production.
- **Visual Description:**
    - **Foundation:** Low, wide cuboid (color: Grey-Brown stone).
    - **Walls:** Slightly smaller cuboid on top of foundation (color: Warm Brown wood).
    - **Roof:** Triangular prism / peaked roof (color: Reddish-Brown thatch).
    - **Window:** Small light-blue square on the front face.
    - **Door:** Dark wood rectangle on the front face with a darker trim frame.
    - **Chimney:** Small stone cuboid rising from the roof.
- **Relative Dimensions:** Small footprint, single story. Similar to Woodcutter's Hut.
- **Key Colors:** Warm Brown, Reddish-Brown, Grey-Brown.

### 27. Medium House

- **Function:** Increases population capacity by 16. No worker or production.
- **Visual Description:**
    - **First Floor:** Stone cuboid, slightly wider than upper floor (color: Warm Grey stone).
    - **Second Floor:** Wooden cuboid sitting on the stone base (color: Medium Brown wood).
    - **Floor Divider:** Thin dark-brown trim strip between floors.
    - **Roof:** Peaked triangular prism (color: Dark Brown).
    - **Windows:** Two on the front face (one per floor) plus one on the second floor left side (color: Light Blue).
    - **Door:** Dark wood rectangle with trim frame on ground floor.
    - **Chimney:** Stone cuboid on the roof.
- **Relative Dimensions:** Medium footprint, two stories tall. Taller than Sawmill.
- **Key Colors:** Warm Grey, Medium Brown, Dark Brown.

### 28. Large House

- **Function:** Increases population capacity by 25. No worker or production.
- **Visual Description:**
    - **Main Block:** Large stone cuboid, L-shaped with a perpendicular wing extension (color: Light Warm Stone).
    - **Wing:** Smaller stone cuboid extending from the back-right of main block.
    - **Stone Base Course:** Dark stone strip along the bottom.
    - **Main Roof:** Large peaked triangular prism (color: Dark Slate grey).
    - **Wing Roof:** Smaller peaked roof on the wing section (color: Dark Slate grey).
    - **Windows:** Three evenly spaced on the front face, one on the wing side (color: Light Blue).
    - **Grand Door:** Large dark oak rectangle with wood-trim arch frame.
    - **Chimney:** Tall stone cuboid with a cap piece on the main roof.
- **Relative Dimensions:** Large footprint (L-shaped), imposing. Similar to Barracks in scale.
- **Key Colors:** Light Warm Stone, Dark Slate, Dark Oak.
