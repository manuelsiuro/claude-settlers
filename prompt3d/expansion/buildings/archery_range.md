# Archery Range — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Archery Range"** in a low-poly 3D style.

The Archery Range is a **military building** (Tier 2) — it garrisons up to 6 archers who defend a moderate territory radius. Unlike enclosed barracks, the Archery Range is an open-air training ground with a covered shooting platform at one end and straw archery targets at the other — a place of constant practice where bowstrings hum and arrows thud into straw.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the scene. The final look should be active, training-focused, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Target rings** — Target Red (`#C0392B`)
- **Target face** — Target White (`#F0F0F0`)
- **Wood structure and racks** — Wood Brown (`#A0724A`)
- **Arrow shafts** — Arrow Tan (`#D2A86E`)
- **Stone base and walls** — Stone Grey (`#8A8A7A`)
- **Roof and beams** — Dark Brown (`#5C3A1E`)
- **Straw bales and target bodies** — Straw Gold (`#D4B84A`)

---

## 2. CORE STRUCTURE & GEOMETRY

Explain step-by-step how to model the Archery Range. Include descriptions of the shapes and primitive meshes to use for:

- **The shooting platform:** A covered structure at one end of the range — a flat rectangular roof (Dark Brown) supported by 4-6 wooden posts (Wood Brown cuboids), completely open on all sides. The roof provides shade and rain cover but no walls obstruct the archers' line of fire. Raise the floor slightly on a low cuboid platform (Stone Grey) so the shooting position is elevated a step above the range ground.
- **The archery targets:** 3-4 circular target stands at the far end of the range, spaced evenly apart. Each target is a flat cylinder disc (Target White base) mounted on a wooden easel frame (Dark Brown — two angled cuboid legs with a crossbar). Layer smaller concentric discs on the front face: outer ring (Target Red), middle ring (Target White), inner ring (Target Red), bullseye (Target White). The targets are the visual anchor of the far end.
- **The range ground:** A long, flat rectangular area (a slightly darker earth-toned plane) stretching between the shooting platform and the targets — packed earth from constant foot traffic. This open space defines the range's linear layout.
- **The perimeter fence:** Low wooden post-and-rail fencing (Dark Brown thin cuboids) along the two long sides of the range, keeping the shooting lane contained and safe. Use simple posts with 2 horizontal rails. Leave the ends open for entry.

---

## 3. PROPS AND ENVIRONMENT DETAILS

Describe how to model the key archery range elements to tell a story. Break down the modeling steps for:

- **Archery targets with embedded arrows:** Stick 2-4 thin cylinder arrow shafts (Arrow Tan) into each target face at various angles and positions — some near the bullseye, some in outer rings. This immediately tells the story of active practice. Angle each arrow slightly differently for a natural, dynamic look.
- **Arrow quivers:** Tall, narrow cylinder containers (Dark Brown) standing upright near each shooting position on the platform, filled with arrow shafts (Arrow Tan thin cylinders) poking out the top. Place 3-4 quivers — one per archer position.
- **Bow rack:** A horizontal wooden frame (Wood Brown) mounted on the back of the shooting platform (or on a post), holding 3-4 curved bow shapes. Model each bow as a gently curved thin cylinder with a straight thin cylinder string connecting the tips.
- **Straw bale barriers:** Large cuboid bales (Straw Gold) stacked 2-high behind the targets as a backstop — arrows that miss the targets embed in the straw wall. Use 4-6 bales in a row. Add a few arrow shafts stuck into the straw for realism.
- **Covered weapon storage:** A small enclosed box or chest (Dark Brown cuboid with a flat lid) on the shooting platform — storing spare bowstrings, arrowheads, and maintenance supplies.
- **Benches:** 2 simple wooden benches (Wood Brown — flat cuboid seat on two cuboid legs) near the shooting platform for resting archers. Place them outside the shooting lane.
- **Scattered arrows on ground:** A few thin cylinder arrow shafts (Arrow Tan) lying on the range ground at various angles — spent arrows not yet collected. This adds life and movement to the scene.
- **Score board (optional):** A small flat cuboid panel (Wood Brown) on a post near the shooting platform, with tiny scratch marks (darker lines) suggesting tally scores — friendly competition among the garrison.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Bright, clear outdoor sunlight — the Archery Range is an open-air facility, and the lighting should feel expansive and energetic. Strong directional light with defined shadows from the platform roof and fence posts.
- The red-and-white targets should be the brightest focal points in the scene — ensure the key light fully illuminates their faces. The bold red-on-white pattern is the building's visual signature.
- The golden straw bales behind the targets provide a warm backdrop — position them to catch the light and contrast with the targets.
- Present from an isometric orthographic camera angle — the full length of the range should be visible, from the covered shooting platform to the distant targets. The linear layout should read clearly as a purpose-built training facility.
- The shooting platform's roof shadow should create a cool, shaded area contrasting with the sun-lit open range — showing the archers shoot from shelter into the bright field.
- The overall atmosphere should feel active, disciplined, and competitive — arrows in flight (implied by embedded arrows), a well-maintained training ground, and the satisfying geometry of targets awaiting the next volley.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
