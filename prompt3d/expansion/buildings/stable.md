# Stable — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Stable"** in a low-poly 3D style.

The Stable is a **resource processing building** (Tier 2) — it employs a Stablehand who raises Horses and Donkeys from Grain and Hay. The Stable is the heart of the settlement's animal husbandry, providing mounts and draft animals for transport. It should look like a sturdy rustic barn with open stalls, golden hay spilling out, and the warm scent of grain and leather in the air.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the scene. The final look should be rustic, warm, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Barn walls and beams** — Warm Brown (`#A0724A`)
- **Hay and straw** — Hay Gold (`#D4B84A`)
- **Structural timber and trim** — Dark Brown (`#5C3A1E`)
- **Roof** — Roof Red-Brown (`#8B4513`)
- **Window shutters and accents** — White Trim (`#F0F0F0`)
- **Foundation and trough** — Stone Grey (`#8A8A7A`)
- **Horse silhouette** — Horse Chestnut (`#A0522D`)
- **Surrounding grass** — Green Grass (`#7CBA5C`)

---

## 2. CORE STRUCTURE & GEOMETRY

Explain step-by-step how to model the Stable. Include descriptions of the shapes and primitive meshes to use for:

- **The barn body:** A wide, tall cuboid (Warm Brown) — the Stable is broader than most buildings because it houses large animals. Make the footprint roughly 1.5x the width of a standard processing building. The walls should feel solid and thick, like hand-hewn timber planks. Add subtle vertical plank lines by insetting thin darker strips along the front face.
- **The roof:** A steep two-plane pitched roof (Roof Red-Brown), with the ridge running along the length of the barn. Extrude the roof slightly beyond the walls on all sides for eave overhang — this shelters the open stall fronts from rain. The steep pitch suggests a hayloft above.
- **The open stalls:** The front face of the barn is divided into 2–3 stall bays by vertical cuboid partition walls (Dark Brown). Each stall has an open front (no door) so the animals are visible from the isometric camera. The stall floors are slightly recessed and filled with a flat golden cuboid (Hay Gold) representing straw bedding.
- **The hayloft:** Above the stalls, a horizontal flat cuboid platform (Dark Brown) spans the width of the barn, with golden hay (Hay Gold icospheres or irregular cuboids) peeking over the edge — the upper storage loft visible through the open front.
- **The large double door:** On one end of the barn, two tall thin cuboid doors (Dark Brown) set into a wide arched opening. One door slightly ajar (rotated 15 degrees outward) to suggest activity.
- **The foundation:** A low, flat cuboid base (Stone Grey) extending slightly beyond the barn walls — a stone foundation keeping the timber off the damp ground.

---

## 3. PROPS AND ENVIRONMENT DETAILS

Describe how to model the key stable elements to tell a story. Break down the modeling steps for:

- **Hay bales:** 3–4 small rectangular cuboids (Hay Gold) stacked near the barn entrance and inside the stalls. Vary the sizes slightly — some are freshly delivered, others half-used. A couple of loose hay tufts (tiny golden cones) scattered on the ground around them.
- **Water trough:** A long, low U-shaped channel (Stone Grey) — a cuboid with the top face deleted and interior extruded down — placed just outside the stalls. Fill it with a flat blue-tinted plane to suggest water.
- **Horse silhouette:** Inside one of the stalls, a simple horse shape (Horse Chestnut): an elongated cuboid body, four short cylinder legs, a tapered cuboid head on a cylinder neck, and two tiny triangular ears. Keep it extremely low-poly — a suggestion of a horse, not a detailed model. A short cylinder tail at the rear.
- **Grain sack:** 2–3 slightly bulging cuboid sacks (Hay Gold, slightly darker) propped against the barn wall near the door — the Grain input that feeds the animals.
- **Pitchfork:** A long thin cylinder handle (Dark Brown) with three tiny prongs at the top (thin tapered cuboids), leaning against the barn wall at an angle. The Stablehand's primary tool.
- **Horseshoe on wall:** A small U-shaped torus segment (Stone Grey) mounted flat against the barn wall above the door — a classic stable detail and good-luck charm.
- **Hitching post:** A short vertical cylinder post (Dark Brown) with a horizontal crossbar, placed outside the barn near the entrance. A short dangling rope (a thin curved cylinder) hangs from it.
- **Ground and path:** A flat Green Grass plane surrounds the barn. A worn earth path (a thin flat cuboid in a lighter brown) leads from the hitching post to the barn door, with a few scattered hay wisps along the edges.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Warm, golden afternoon sunlight from a high angle, catching the Roof Red-Brown and making the Hay Gold shimmer — this building is all about warmth and life.
- A soft secondary fill light angled to illuminate the open stall interiors, so the hay bedding and horse silhouette are clearly visible from the isometric view.
- The contrast between the dark timber partitions and the bright golden hay should be the visual focal point — it immediately reads as "animal shelter."
- Present from an isometric orthographic camera angle — the open stall fronts should face the camera so the interior life of the stable is on full display.
- Subtle warm ambient light to keep the shaded side of the barn readable without flattening the scene.
- The overall atmosphere should feel earthy, lived-in, and comforting — a place where animals are well cared for and the work is honest.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
