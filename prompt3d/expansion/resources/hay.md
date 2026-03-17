# Hay — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Hay"** resource in a low-poly 3D style.

Hay is a rectangular bale produced as an alternate output from the Farm. It is transported to the Stable, where it feeds the horses raised for cavalry and transport. Hay represents the agricultural side of the military supply chain — without it, no mounted units can be trained.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the resource model. The final look should be warm, rustic, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Hay body** — Straw Gold (`#D4B84A`)
- **Binding twine** — Binding Tan (`#C4A060`)
- **Straw highlight** — Light Gold (`#E4D06A`)
- **Shadow/compressed areas** — Dark Straw (`#B49A3A`)

---

## 2. SHAPE & GEOMETRY

Explain step-by-step how to model the Hay. Include descriptions of the shapes and primitive meshes to use for:

- **Primary shape:** A rectangular cuboid (box) with proportions roughly 2:1:1 (twice as long as it is wide and tall). This is a classic small rectangular hay bale. Keep the edges sharp and geometric — the flat faces of the cuboid are what make it immediately read as a "bale" rather than a loose pile. Slightly round the top edges by selecting the top face vertices and scaling inward just a touch, suggesting compression.
- **Binding twine:** Two thin rectangular strips or flattened cylinders (Binding Tan) wrapped around the bale — one near each end, running perpendicular to the long axis. These are the twine ties that hold the bale together and are the key surface detail. Offset them slightly from the surface (just barely raised) so they read as distinct lines against the straw body.
- **Straw texture lines:** On the front and back faces (the short ends), add 3-4 very shallow horizontal groove lines by slightly insetting thin strips. These suggest the compressed layers of straw visible on a real bale's cut face. Use Dark Straw for these grooves.
- **Scale:** A bale should be about the size of a serf's torso — large enough to require carrying with both arms, giving it visual weight. The rectangular shape makes it one of the most geometrically simple resources in the game.
- **Arrangement:** When stockpiled, hay bales stack neatly — 2-3 on the bottom row, 1-2 on top, offset like brickwork. The golden color and orderly stacking create a warm, farm-like feel at any flag or storage point.

---

## 3. VISUAL IDENTITY & CONTEXT

Describe what makes this resource visually distinct:

- **Distinguish from:** Grain (hay is a firm rectangular bale with visible binding twine, while grain is a round, soft sack shape). The sharp rectangular geometry versus the rounded sack silhouette is the instant differentiator. The colors are similar (both golden), so shape is everything.
- **Silhouette:** From the isometric camera, the hay bale reads as a clean rectangle — one of the most regular geometric shapes among all resources. The two binding lines crossing the surface add just enough detail to prevent it from looking like a plain box.
- **Stockpile appearance:** Stacked hay bales look orderly and agricultural — a neat golden wall of rectangles suggesting a well-run farm. The warm Straw Gold color makes hay piles one of the warmest-toned features on the map.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Warm directional sunlight to make the Straw Gold surfaces glow with a sun-baked warmth. Hay should look like it has been drying in the afternoon sun.
- The Light Gold highlight on the top face (the most sun-exposed surface) adds a subtle brightness gradient that gives the flat-shaded cuboid visual depth.
- At game scale, the golden rectangular shape is the primary read. Hay bales should register as warm, geometric blocks distinct from the more organic shapes of food resources around them.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
