# Bakery — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Bakery"** in a low-poly 3D style.

The Bakery is a **resource processing building** — it bakes Bread from Flour (requires Coal as fuel). Bread is a key food source for Miners. The Bakery should look warm and inviting, with its signature chimney and orange/terracotta walls.

**Runtime effects:** Chimney smoke particles (grey→white, 3/s, lifetime 3–5s) when producing. Emissive glow pulse on the building when active.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the scene. The final look should be warm, inviting, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Main building walls** — Orange / Terracotta (`#C87038`)
- **Roof** — Dark Brown (`#5C3A1E`)
- **Chimney** — Dark Grey (`#4A4A4A`)
- **Chimney embers** — Bright Red (`#E03020`)
- **Door and window frames** — Warm Brown (`#A0724A`)
- **Bread loaves** — Golden Brown (`#DAA520`)
- **Flour sacks** — Off-White (`#F0E8D8`)
- **Coal pile** — Black (`#2A2A2A`)
- **Foundation** — Earthy Brown (`#6B4226`)
- **Oven glow** — Warm Orange (`#FF8C00`)

---

## 2. CORE STRUCTURE & GEOMETRY

Explain step-by-step how to model the Bakery. Include descriptions of the shapes and primitive meshes to use for:

- **The main building:** A medium cuboid (Orange/Terracotta). The warm color is the building's signature — it immediately says "fire, warmth, baking." Medium footprint, similar to other processing buildings.
- **The roof:** A simple sloped cuboid roof (Dark Brown) — a two-plane pitched shape.
- **The chimney:** A tall, thin square cuboid (Dark Grey) attached to the side or rear of the building. It should extend well above the roofline — this is where smoke particles emit during production. Place a tiny red cube (Bright Red) on top to represent glowing embers.
- **The oven opening:** On one side of the building, a darker rectangular alcove with a warm orange glow (a small orange/red cube recessed into the wall) — the bread oven visible from outside.
- **The door:** A wide doorway on the front face — the Baker needs to move sacks in and out.
- **Windows:** 1–2 small windows with warm light glowing from inside.

---

## 3. PROPS AND ENVIRONMENT DETAILS

Describe how to model the key bakery elements to tell a story. Break down the modeling steps for:

- **Bread loaves (output):** Several small rounded cuboids or slightly domed shapes (Golden Brown) on a small display table or shelf near the door — freshly baked bread.
- **Flour sacks (input):** 2–3 sacks (Off-White, slightly bulging cuboids) near the entrance — the input material from the Windmill.
- **Coal pile (input):** A small mound of black cubes (Black) on the other side of the entrance — fuel for the oven.
- **A bread paddle/peel:** A long thin cuboid with a flat rectangular end (Warm Brown) leaning against the wall — the tool for sliding bread in and out of the oven.
- **A small display table or counter:** A flat cuboid (Brown) near the entrance with bread loaves arranged on top.
- **Firewood stack:** A few short cylinders (brown) stacked near the chimney side.
- **Rolling pin and bowls (optional):** Tiny props near the door suggesting dough preparation.
- **A warm welcoming path:** A small flat cuboid (lighter earth tone) leading to the door.
- **Grass and flowers:** A few cheerful grass tufts and tiny flower props around the bakery — it's a pleasant, warm place.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Warm directional sunlight that enhances the orange/terracotta walls, making the building glow invitingly.
- A warm point light or glow near the oven opening to suggest the internal fire.
- The chimney should have subtle warm lighting at its top where smoke particles will emit.
- A soft warm ambient fill — the bakery is the warmest, coziest building in the settlement.
- Present from an isometric orthographic camera angle — the chimney, oven glow, and bread display should all be visible.
- The overall atmosphere should feel like the heart of the village — warm, productive, and nourishing.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
