# Grapes — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Grapes"** resource in a low-poly 3D style.

Grapes are a raw material gathered at the Vineyard by a Vintner, then transported to the Winery where they are pressed and fermented into Wine. They are a key ingredient in the beverage production chain.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the resource model. The final look should be lush and vibrant, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Grape spheres** — Grape Purple (`#6B2D8B`)
- **Grape highlight** — Light Violet (`#8B4DAB`) for a few spheres catching the light
- **Stem and cap** — Stem Green (`#4A8C3F`)
- **Stem detail** — Dark Green (`#3A6C2F`) for tiny connecting stalks between grapes

---

## 2. SHAPE & GEOMETRY

Explain step-by-step how to model the Grapes. Include descriptions of the shapes and primitive meshes to use for:

- **Primary shape:** A conical cluster of small UV spheres (6-8 vertices each for low-poly). Arrange 8-12 tiny spheres in a roughly inverted-triangle formation — wider at the top and tapering to a point at the bottom. Each sphere should slightly overlap its neighbors. Vary sizes slightly (scale 0.9-1.1) for natural irregularity.
- **Stem:** A single short, thin cylinder (Stem Green) emerging from the top center, curving slightly upward. At the top, add a tiny flattened disc as the cut point. From the main stem, 2-3 hair-thin cylinders (Dark Green) branch downward into the cluster for internal stalks.
- **Scale:** The entire cluster should fit comfortably in one serf hand — roughly the width of a serf's head. Individual grape spheres are about 15-20% of the overall cluster width each.
- **Arrangement:** When stockpiled, 3-5 clusters sit in a shallow heap on the ground, leaning against each other at slightly different angles for visual variety.

---

## 3. VISUAL IDENTITY & CONTEXT

Describe what makes this resource visually distinct:

- **Distinguish from:** Fruit (grapes are a dense cluster of 8-12 tiny spheres in a triangular arrangement, while Fruit is only 2-3 larger individual spheres loosely grouped). The deep purple color also sets grapes apart from the red/green of Fruit.
- **Silhouette:** From the isometric camera, the cluster reads as a compact triangular or teardrop shape — wider at top, narrowing at bottom — with a small green stem poking up. The bumpy surface of individual spheres should be visible even at distance.
- **Stockpile appearance:** A pile of 3-5 grape clusters looks like a mound of rich purple, punctuated by bits of green stem. Clusters naturally nestle together, creating a satisfying heap of abundance.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Warm directional light from above-left to catch the rounded tops of the grape spheres, making the purple surfaces glow richly against darker shadowed undersides.
- Light Violet highlight spheres scattered through the cluster add visual depth even without specular shading — place them on the sun-facing side.
- At game scale, the deep purple cluster should read as an immediately recognizable food item against earth-toned roads and green terrain.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
