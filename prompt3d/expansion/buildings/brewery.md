# Brewery — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Brewery"** in a low-poly 3D style.

The Brewery is a **resource processing building** (Tier 2) — it employs a Brewer who combines Grain and Water Barrels to produce Beer. Beer is a staple morale booster for workers across the settlement. The Brewery should look like a sturdy wooden building with a prominent copper kettle visible on the roof or through an open wall, with steam rising and a warm, industrious atmosphere.

**Runtime effects:** Chimney steam particles (white, wispy, 2/s, lifetime 3–5s) when producing.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the scene. The final look should be warm, bubbling, industrial, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Copper kettle and vats** — Copper (`#B87333`)
- **Beer and amber accents** — Amber (`#DAA520`)
- **Main building walls** — Warm Brown (`#A0724A`)
- **Grain sacks and details** — Tan (`#D2A86E`)
- **Roof and dark timber** — Dark Brown (`#5C3A1E`)
- **Foundation and chimney** — Stone Grey (`#8A8A7A`)
- **Grain highlights** — Grain Gold (`#E8D060`)

---

## 2. CORE STRUCTURE & GEOMETRY

Explain step-by-step how to model the Brewery. Include descriptions of the shapes and primitive meshes to use for:

- **The main building:** A medium-sized cuboid (Warm Brown timber walls) with visible horizontal plank lines — use thin flat cuboids or edge loops to suggest wooden construction. The building should feel solid and functional, wider than it is tall.
- **The copper kettle:** The building's signature element. A large, bulging cylinder or sphere-like shape (Copper) mounted on the roof or visible through a large open section in the upper wall. Scale the middle vertices outward to create a pot-bellied silhouette. Add a small cylindrical lid on top and a thin spout pipe extending to the side. The copper color immediately identifies this building.
- **The chimney/steam vent:** A short, wide cylinder or square cuboid chimney (Stone Grey) rising from the roof near the kettle. This is where steam particles emit during production. Add a subtle flared rim at the top by scaling the top face outward slightly.
- **The wide door:** A large rectangular opening on the front face (Dark Brown door frame) — barrels and sacks need to move in and out easily.
- **The roof:** A pitched two-plane roof (Dark Brown) with a cutaway or raised section where the copper kettle protrudes — this asymmetry makes the building silhouette distinctive and recognizable.

---

## 3. PROPS AND ENVIRONMENT DETAILS

Describe how to model the key brewery elements to tell a story. Break down the modeling steps for:

- **Grain sacks (input):** 3–4 plump sacks (Tan, slightly bulging cuboids with rounded tops — scale the top face down and bevel) stacked near the entrance. One sack should be open, with tiny Grain Gold sphere particles spilling from the top.
- **Water barrels (input):** 2 short, wide cylinders (Dark Brown with a subtle blue tint on the top face to suggest water inside) placed on the opposite side of the entrance from the grain sacks. Add thin Iron band rings around each barrel.
- **Fermenting vats:** 1–2 large open-topped cylinders (Warm Brown, wider than the water barrels) placed inside the building or against the back wall, visible through the open door. Add a tiny froth layer on top — a thin disc of Amber slightly above the rim.
- **Wooden mugs:** 3–4 tiny cylinders (Warm Brown) with small cuboid handles, arranged on a flat cuboid shelf or table near the door — finished product samples.
- **Hops drying rack:** A small A-frame structure (two thin cuboid legs meeting at a peak) with horizontal string lines (thin cylinders) from which tiny green cone shapes hang — hops drying in the air, adding visual storytelling.
- **A stirring paddle:** A long thin cylinder handle with a flat disc or cuboid end (Warm Brown), leaning against the wall near the vats.
- **Barrel stack:** 2–3 finished beer barrels (Amber-tinted cylinders with dark bands) stacked on their sides on a wooden rack near the building — output ready for transport.
- **Puddle detail:** A tiny flat disc (Amber, very thin) on the ground near the vats — a small spill suggesting active production.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Warm directional sunlight that catches the copper kettle, making it gleam and stand out as the centerpiece of the building.
- A subtle warm interior glow visible through the open door, suggesting the heat of the brewing process inside.
- The Amber and Copper tones should dominate the scene — warm, rich, metallic hues that communicate warmth and industry.
- The steam vent chimney should have a slight warm highlight where particles will emit during runtime.
- Present from an isometric orthographic camera angle — the copper kettle on the roof, the grain sacks and water barrels at the entrance, and the hops drying rack should all be visible.
- The overall atmosphere should feel busy, warm, and slightly steamy — a productive workshop turning raw grain into liquid gold.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
