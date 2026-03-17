# Small House — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Small House"** in a low-poly 3D style.

The Small House is a **housing building** (Tier 1) — a humble single-story cottage that shelters up to 8 settlers. It is the most basic dwelling in the settlement, the first home a growing village builds. It should radiate humble coziness — a squat, warm-toned cottage with a simple peaked roof, a glowing window, and a tiny garden patch. Think fairy-tale starter home.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the scene. The final look should be humble, cozy, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Walls** — Warm Brown (`#A0724A`)
- **Roof** — Red-Brown (`#8B4513`)
- **Timber frame and beams** — Dark Brown (`#5C3A1E`)
- **Door** — Door Brown (`#6B4226`)
- **Window glow** — Window Glow (`#FFD080`)
- **Foundation strip** — Stone Grey (`#8A8A7A`)
- **Surrounding grass** — Green Grass (`#7CBA5C`)

---

## 2. CORE STRUCTURE & GEOMETRY

Explain step-by-step how to model the Small House. Include descriptions of the shapes and primitive meshes to use for:

- **The cottage body:** A small, squat cuboid (Warm Brown) — this is a single-story dwelling, so keep the height low relative to its width. The proportions should feel compact and snug, like a cottage that has settled into the earth. Scale it to be noticeably smaller than production buildings.
- **The peaked roof:** A simple two-plane pitched roof (Red-Brown), formed by extruding the top edges of the cuboid to a central ridge. The pitch should be moderate — not too steep, not too flat. Extend the eaves slightly beyond the walls on all sides for a sheltering overhang. The roof is the largest visual element and its warm red-brown color defines the cottage's character.
- **The door:** A single narrow cuboid (Door Brown) recessed slightly into the front wall. Add a tiny cylinder doorknob (Stone Grey). The door should be proportionally small — this is a humble home.
- **The windows:** 1–2 small square openings in the side walls. Each window is a recessed square with a thin cross-shaped mullion (Dark Brown) dividing it into four panes. Behind the mullion, place a small flat plane (Window Glow) to suggest warm light from within.
- **The stone foundation:** A thin, flat cuboid strip (Stone Grey) extending slightly beyond the cottage walls at ground level — a simple stone course that lifts the wooden structure off the damp earth.

---

## 3. PROPS AND ENVIRONMENT DETAILS

Describe how to model the key small house elements to tell a story. Break down the modeling steps for:

- **Chimney:** A small, short square cuboid (Stone Grey) protruding from the rear slope of the roof. Keep it stubby and proportional to the cottage — just tall enough to clear the ridge. A tiny wisp could be suggested with a very small light-grey cone floating above the opening.
- **Flower box:** A thin rectangular cuboid (Dark Brown) mounted below one window, filled with tiny colorful sphere or cone flowers (pink, red, yellow). This small detail transforms a plain wall into a charming home. Model the box as a long, narrow open-topped cuboid with 4–6 flower dots rising above the rim.
- **Stepping stones:** 3–4 small, flat disc shapes (Stone Grey) arranged in a gentle curve leading from the door to the road edge. Each stone slightly different in size, placed at walking-stride intervals.
- **Small garden patch:** A tiny rectangular area (Earth Brown, slightly darker than the grass) beside the cottage with 2–3 rows of small green cones (representing vegetables or herbs). A miniature personal garden that speaks to self-sufficiency.
- **Firewood stack:** A small pile of short cylinder logs (Dark Brown) stacked neatly against one side wall — 2–3 rows high, the ends facing outward. This prop immediately suggests warmth and winter preparation.
- **Warm window glow:** Ensure the Window Glow planes behind each window are bright enough to read as lit interiors from the isometric camera. The glow is what makes the house feel occupied and alive, especially at dusk or nighttime in the game.
- **Grass and path:** Lush Green Grass surrounds the cottage. A thin worn path (a flat cuboid slightly lighter than the grass) leads from the stepping stones toward the nearest road flag.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Warm, late-afternoon directional sunlight at a low-ish angle — the kind of golden light that makes a cottage roof glow and casts long, gentle shadows across the grass.
- The Window Glow should be the emotional focal point — a warm amber light that says "someone is home." Ensure it contrasts with the surrounding wall color.
- A soft ambient fill to prevent the shaded walls from going too dark — every face of the cottage should remain readable.
- Present from an isometric orthographic camera angle — the front door, at least one glowing window, the chimney, and the flower box should all be visible. The cottage should feel nestled into its patch of green grass.
- The overall atmosphere should feel like coming home — warm, safe, and modest. This is where tired serfs rest after a long day of hauling planks and forging iron.
- The small scale of the house compared to production buildings should be apparent — it is dwarfed by the Sawmill or Bakery, reinforcing its humble character.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
