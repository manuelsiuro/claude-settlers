# Charcoal Burner — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Charcoal Burner"** in a low-poly 3D style.

The Charcoal Burner is a **resource processing building** (Tier 2) — it employs a Charcoal Burner who slowly converts Wood into Coal through controlled smoldering inside a sealed earth mound. Coal is a critical fuel for smelting and forging. The building should look primitive and smoky — dominated by a large dome-shaped earth kiln with wisps of smoke rising from a vent hole, flanked by a tiny lean-to shelter.

**Runtime effects:** Heavy smoke particles (dark grey to light grey gradient, 4/s) billowing from the kiln vent when producing.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the scene. The final look should be smoky, primitive, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Charcoal and output pile** — Charcoal Black (`#2A2A2A`)
- **Smoke and ash** — Smoke Grey (`#8A8A8A`)
- **Kiln earth mound** — Earth Brown (`#6B4226`)
- **Ash residue** — Ash Grey (`#A0A0A0`)
- **Kiln base soil** — Dark Earth (`#4A3520`)
- **Wood logs and lean-to** — Wood Brown (`#A0724A`)
- **Ember glow at vent** — Ember Red (`#E03020`)

---

## 2. CORE STRUCTURE & GEOMETRY

Explain step-by-step how to model the Charcoal Burner. Include descriptions of the shapes and primitive meshes to use for:

- **The kiln mound:** The dominant visual element. Create a large, flattened UV sphere or icosphere (Earth Brown) — scale it to about 60% height relative to its width, producing a wide dome shape sitting on the ground. This is the sealed earth-and-turf mound inside which wood slowly carbonizes into charcoal. Slightly flatten the bottom vertices into the ground plane so it looks like it grows out of the earth rather than sitting on top of it.
- **The vent hole:** A small cylindrical opening (Charcoal Black) at the very top of the dome, created by insetting the top face and extruding it slightly upward. Add a tiny glowing cube or sphere (Ember Red) just inside the vent to suggest the smoldering heat within. In the game, dark smoke particles will pour from this point during production.
- **The lean-to shelter:** A tiny, crude shed (Wood Brown) beside the kiln — just a sloped roof plane propped against two posts with no proper walls. This is where the Charcoal Burner rests and stores tools. Model it as a single angled plane (roof) supported by 2 thin cuboid posts on the open side, with the back resting against the ground or a low wall.
- **The stone ring:** A circle of small, irregular cube stones (Ash Grey) arranged around the base of the kiln mound. These contain the structure and prevent the earth from spreading. Use 8-12 small scaled cubes placed in a rough ring.
- **The scorched ground:** A flat circular plane (Dark Earth) beneath the kiln and surrounding area — the constant heat has darkened and killed the earth here. Extend it slightly beyond the stone ring.

---

## 3. PROPS AND ENVIRONMENT DETAILS

Describe how to model the key charcoal burner elements to tell a story. Break down the modeling steps for:

- **Wood log pile (input):** A stack of 5-8 small cylinders (Wood Brown) arranged in a rough pyramid near the kiln — the raw wood waiting to be loaded into the next burn cycle. Stack them in two layers: a row of 3-4 on the bottom, 2-3 on top, slightly rotated for a natural look.
- **Charcoal pile (output):** A mound of small, irregular dark cubes and angular shapes (Charcoal Black) on the opposite side from the wood pile. Make these distinctly darker and more angular than the rounded wood logs — the transformation from organic to carbonized material should be visually obvious.
- **Ash pile:** A low, flat mound of tiny cubes (Ash Grey) near the kiln — residual ash from completed burns. Keep it subtle and low to the ground.
- **Rake tool:** A long thin cylinder shaft (Wood Brown) with a flat rectangular head (Charcoal Black) leaning against the lean-to shelter. The rake is used to manage the kiln opening and spread charcoal.
- **Smoke suggestion:** While heavy smoke is handled by the particle system at runtime, place 2-3 small, vertically stacked, progressively fading icospheres (Smoke Grey, increasingly transparent) above the vent hole as a static hint of the building's purpose.
- **Bucket of water:** A small tapered cylinder (Wood Brown) near the lean-to — water for safety, to douse any uncontrolled fire.
- **Cleared ground ring:** The area immediately around the kiln should be bare earth (Dark Earth) with no grass — fire safety demands clear ground. Transition to normal terrain further out.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Muted, overcast directional light — the Charcoal Burner's scene is hazy and smoky, not bright and sunny. Use a slightly desaturated warm light.
- A subtle red-orange point light near the vent hole to simulate the ember glow within the kiln, casting a faint warm circle on the top of the dome.
- The contrast between the dark charcoal pile and the lighter wood log pile should be immediately readable — these are the input and output of the process.
- Present from an isometric orthographic camera angle — the dome kiln should dominate the scene, with the lean-to, wood pile, and charcoal pile arranged around it.
- Add a slight haze or atmospheric feel — the Charcoal Burner operates in a permanently smoky environment.
- The overall atmosphere should feel primitive, smoky, and elemental — fire transforming wood into the fuel that powers civilization's forges.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
