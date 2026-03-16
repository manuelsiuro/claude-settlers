# Iron Smelter — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Iron Smelter"** in a low-poly 3D style.

The Iron Smelter is a **resource processing building** — it converts Iron Ore into Iron Bars using Coal as fuel. Iron Bars are essential for making Tools (Toolmaker) and Weapons (Blacksmith). The building should look hot, industrial, and imposing, dominated by a tall furnace chimney with visible heat glow.

**Runtime effects:** Chimney smoke particles (grey→white, 3/s) + forge sparks (orange→yellow, 5/s) when producing. Emissive glow pulse when active.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the scene. The final look should be hot, industrial, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Main building base** — Dark Grey (`#5A5A5A`)
- **Furnace/chimney** — Black / Very Dark Grey (`#2A2A2A`)
- **Heat glow** — Bright Orange (`#FF6600`) and Red (`#E03020`)
- **Iron ore (input)** — Reddish Brown (`#A04030`)
- **Iron bars (output)** — Silver-Grey (`#A0A0A0`)
- **Coal pile (input)** — Coal Black (`#1E1E1E`)
- **Support structure** — Dark Brown (`#5C3A1E`)
- **Spark accents** — Yellow (`#F0D060`)
- **Ground/scorched earth** — Charred Brown (`#4A3A2A`)

---

## 2. CORE STRUCTURE & GEOMETRY

Explain step-by-step how to model the Iron Smelter. Include descriptions of the shapes and primitive meshes to use for:

- **The base building:** A sturdy, wide cuboid (Dark Grey). Thick walls — this building contains immense heat. Low and solid-looking.
- **The furnace/chimney:** The dominant visual element — a prominent, taller, slightly tapering square cuboid or cylinder rising from the base (Black/Very Dark Grey). This should be the tallest part, reaching well above the roofline. Make it slightly wider at the base and narrow toward the top for a tapering effect.
- **The heat glow:** A small bright orange or red cube at the base of the furnace (Bright Orange/Red) — visible through an opening, representing the molten interior. This glows during production via emissive animation.
- **The furnace opening:** A dark rectangular or arched opening at the base of the furnace structure where iron ore and coal are fed in.
- **The roof section:** A flat or very low-angle roof (Dark Grey) on the base building, below the chimney. The chimney punches through it.
- **Ventilation openings:** Small rectangular cutouts near the chimney top for draft.

---

## 3. PROPS AND ENVIRONMENT DETAILS

Describe how to model the key smelter elements to tell a story. Break down the modeling steps for:

- **Iron ore pile (input):** A mound of small reddish-brown cubes (Reddish Brown) near the furnace opening — raw material waiting to be smelted.
- **Coal pile (input):** A mound of black cubes (Coal Black) on the other side of the furnace opening — fuel.
- **Iron bars (output):** Thin, flat, elongated cuboids (Silver-Grey) stacked neatly near the building's output side — the finished product. They should look distinctly different from the raw ore.
- **Tongs and tools:** A pair of long thin shapes (Steel/Dark Grey) near the furnace — smelting tongs for handling hot metal.
- **A quenching trough:** A long, low cuboid (Grey) filled with a flat blue surface — a water trough for cooling hot metal.
- **Scorched earth:** The ground around the smelter should be darker, charred-looking (Charred Brown) — heat and sparks have blackened the area.
- **Spark particles:** In the final game, orange-yellow sparks emit at 5/s during production. The model should suggest this energy with warm-colored small cubes near the furnace.
- **A bellows (optional):** A wedge-shaped prop near the furnace opening — the device used to intensify the fire.
- **Soot marks:** Darker streaks on the building walls near the chimney.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- A warm directional light to catch the orange glow elements.
- A strong warm-orange point light near the furnace opening to simulate fire glow, casting warm light on nearby props.
- The chimney should cast a tall shadow — it's the building's dominant vertical element.
- Cool ambient fill to contrast with the warm forge glow, creating a dramatic hot/cold interplay.
- Present from an isometric orthographic camera angle — the furnace/chimney and orange glow should be the visual focal point.
- The overall atmosphere should feel intense, hot, and productive — molten metal and fire transforming raw earth into civilization's backbone.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
