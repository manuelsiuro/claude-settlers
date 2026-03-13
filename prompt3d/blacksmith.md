# Blacksmith / Armory — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Blacksmith / Armory"** in a low-poly 3D style using software like Blender or Maya.

The Blacksmith (or Armory) is a **resource processing building** — it forges Swords and Shields from Iron Bars and Coal (Planks may also be needed for shields). These weapons are delivered to military buildings to recruit Knights. The building should look dark, hot, and heavy — a place of fire and steel.

**Runtime effects:** Chimney smoke particles (grey→white, 3/s) + forge sparks (orange→yellow, 5/s) when producing. Emissive glow pulse when active.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the scene. The final look should be dark, powerful, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Main building walls** — Dark Grey / Black (`#3A3A3A`)
- **Chimney** — Black (`#2A2A2A`)
- **Forge glow** — Bright Orange (`#FF6600`) and Red (`#E03020`)
- **Swords (output)** — Bright Steel (`#B0B0B0`)
- **Shields (output)** — Wood Brown (`#8B5E3C`) with Steel Grey rim (`#7A7A7A`)
- **Iron bars (input)** — Silver-Grey (`#A0A0A0`)
- **Coal pile (input)** — Coal Black (`#1E1E1E`)
- **Spark accents** — Yellow (`#F0D060`)
- **Foundation/scorched ground** — Charred Brown (`#4A3A2A`)

---

## 2. CORE STRUCTURE & GEOMETRY

Explain step-by-step how to model the Blacksmith. Include descriptions of the shapes and primitive meshes to use for:

- **The main building:** A dark grey or black cuboid (Dark Grey/Black). The darkest-colored building in the game besides the coal mine — the soot and heat have blackened everything. Medium footprint.
- **The open front/large window:** One side of the building should have a large opening or wide window — the forge interior is partially visible. This is where the orange glow shows through.
- **The forge glow:** An orange or red cube (Bright Orange/Red) visible through the opening — the heart of the blacksmith's fire. This element pulses with emissive glow during production.
- **The chimney:** A short, wide, black cuboid chimney (Black) on the roof. Wider and squatter than the Smelter's chimney — the Blacksmith's forge is broader and lower.
- **The roof:** A flat or low-slope dark roof, almost blending with the walls — everything is dark here.

---

## 3. PROPS AND ENVIRONMENT DETAILS

Describe how to model the key blacksmith elements to tell a story. Break down the modeling steps for:

- **Swords (output):** 2–3 miniature sword shapes — thin elongated cuboids (Bright Steel) with small cuboid crossguards and cylindrical handles. Lean them against a rack near the building or display them on a wooden frame.
- **Shields (output):** 1–2 circular discs or octagonal flat shapes (Wood Brown center with Steel Grey rim). Lean them against the building wall or prop them up on a display.
- **Iron bars (input):** Thin elongated cuboids (Silver-Grey) stacked near the forge opening.
- **Coal pile (input):** A mound of black cubes near the forge — fuel supply.
- **An anvil:** A T-shaped dark steel shape (larger than the Toolmaker's) — the Blacksmith's anvil is heavier-duty, forging weapons.
- **A forge bellows:** A wedge or accordion shape near the forge opening, for intensifying the fire.
- **A quenching barrel:** A cylinder (Dark Brown) with a flat blue surface on top — water for cooling hot steel.
- **Weapon rack:** A simple frame (thin cuboids) displaying finished swords and shields.
- **Sparks and heat haze:** The ground near the forge should be charred and darkened. Tiny orange/yellow cubes suggest flying sparks.
- **Hammer:** A large hammer prop (Dark Steel head, Brown handle) near the anvil — heavier than a common tool.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- The forge glow is the visual centerpiece — a strong warm orange point light near the forge opening, casting warm light on the anvil and nearby props.
- Moderate directional sunlight to illuminate the exterior, but the building's dark palette absorbs most of it.
- Dramatic contrast between the dark building and the bright orange forge glow — this is the most visually dramatic processing building.
- The gleaming swords and shields on the weapon rack should catch the light — bright steel against the dark building.
- Present from an isometric orthographic camera angle — the open forge front with its orange glow and the weapon display should both be visible.
- The overall atmosphere should feel powerful and martial — fire, steel, and weapons of war being forged.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
