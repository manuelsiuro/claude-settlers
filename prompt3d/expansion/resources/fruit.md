# Fruit — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Fruit"** resource in a low-poly 3D style.

Fruit represents a mix of apples and pears gathered at the Orchard by a Fruit Picker. It serves as a direct food source providing 0.35 satiation to the population — a simple, wholesome harvest that requires no further processing before consumption.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the resource model. The final look should be fresh, wholesome, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Apple body** — Apple Red (`#CC3333`)
- **Pear body** — Pear Green (`#66AA44`)
- **Stems** — Stem Brown (`#8B5E3C`)
- **Leaf accent** — Leaf Green (`#4A8C3F`)
- **Highlight** — Light Yellow (`#E8CC44`) for a subtle sun-kissed patch on one side of each fruit

---

## 2. SHAPE & GEOMETRY

Explain step-by-step how to model the Fruit. Include descriptions of the shapes and primitive meshes to use for:

- **Primary shape:** A grouping of 2-3 individual fruit pieces sitting together. Model one apple as a slightly flattened UV sphere with a small indentation at the top (scale the top vertices inward slightly to create the classic apple dimple). Model one pear as a sphere that has been stretched upward and tapered — scale the upper vertices inward to create the narrower neck. Optionally add a third piece (another apple or pear) to fill out the group.
- **Stems and leaves:** Each fruit gets a tiny thin cylinder (Stem Brown) poking up from the top center, just 2-3 vertices tall. On one fruit, attach a single tiny flat diamond or elongated triangle (Leaf Green) angled off the stem — a single leaf adds charm without adding polygon cost.
- **Scale:** Each individual fruit is roughly the size of a serf's fist. The full 2-3 piece grouping fits in one serf hand or a small carry basket. The overall footprint is about one serf-head width.
- **Arrangement:** When stockpiled, fruits tumble together casually — 6-8 individual pieces in a loose, colorful pile. Alternate red and green pieces for visual appeal. Some rest on their sides, others upright.

---

## 3. VISUAL IDENTITY & CONTEXT

Describe what makes this resource visually distinct:

- **Distinguish from:** Grapes (fruit consists of only 2-3 larger, individually recognizable spheres in red and green, while grapes are a dense cluster of 8-12 tiny purple spheres). The red/green color mix versus solid purple is the fastest read.
- **Silhouette:** From the isometric camera, fruit reads as 2-3 distinct rounded bumps sitting side by side — each one clearly an individual piece of fruit. The tiny stem on top of at least one piece reinforces the "apple" read.
- **Stockpile appearance:** A pile of fruit is colorful and inviting — a tumble of red and green spheres, like a market stall display. The mixed colors make it one of the most visually cheerful resources in the game.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Warm overhead light to make the Apple Red and Pear Green surfaces bright and appetizing. The Light Yellow highlight patch on each fruit's sun-facing side adds dimensionality.
- Keep ambient light moderate so the red and green colors remain saturated and distinct from each other — you want both colors readable at a glance.
- At game scale, the mixed red-green color signature is the primary identifier. Even at maximum zoom-out, the two-tone coloring should distinguish fruit from any single-color resource.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
