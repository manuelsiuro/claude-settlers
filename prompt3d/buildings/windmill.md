# Windmill — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Windmill"** in a low-poly 3D style.

The Windmill is a **resource processing building** — it grinds Grain into Flour. The Flour is then sent to the Bakery to make Bread. The Windmill is one of the tallest and most visually distinctive buildings in the game, with its iconic rotating sails.

**Runtime effects:** Sails rotate at 2.0 rad/s when producing. Sails stop when idle.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the scene. The final look should be tall, iconic, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Tower body** — Beige / Light Grey (`#D0C8B0`)
- **Cap/roof** — Dark Brown (`#5C3A1E`) or Red (`#A03020`)
- **Sails** — White / Light Grey (`#F0EDE6`)
- **Sail frame** — Warm Brown (`#A0724A`)
- **Door and window frames** — Dark Brown (`#5C3A1E`)
- **Foundation/ground** — Earthy Beige (`#B0A080`)
- **Grain sacks** — Burlap Tan (`#C4A060`)
- **Flour sacks** — Off-White (`#F0E8D8`)
- **Stone base** — Medium Grey (`#8C8C8C`)

---

## 2. CORE STRUCTURE & GEOMETRY

Explain step-by-step how to model the Windmill. Include descriptions of the shapes and primitive meshes to use for:

- **The tower base:** A tall, slightly tapering cylinder or octagonal prism (Beige/Light Grey). This is the dominant form — it should be noticeably taller than most buildings. Start with a cylinder, then slightly scale down the top face to create the tapering effect. Alternatively, use an 8-sided prism for a more geometric low-poly look.
- **The stone foundation:** A wider, short cylinder at the base (Medium Grey) — a solid stone platform the tower sits on.
- **The cap/roof:** A conical or dome shape on top of the tower (Dark Brown or Red). This is the housing for the sail mechanism. Use a cone with the apex slightly rounded, or a half-sphere.
- **The sails:** Four long, thin cuboids (White/Light Grey) attached to a central point on the cap, angled like classic windmill sails. Each sail should be a rectangular frame (Warm Brown edges) with a flat plane (White) fill. The sails are the building's most iconic element and will rotate during production.
- **The sail axle:** A small horizontal cylinder protruding from the cap's front face where the sails connect.
- **The door:** A rounded or rectangular doorway at the base of the tower.
- **Windows:** Small square or round openings at different heights up the tower — 2 or 3 windows spiraling up.

---

## 3. PROPS AND ENVIRONMENT DETAILS

Describe how to model the key windmill elements to tell a story. Break down the modeling steps for:

- **Grain sacks (input):** 2–3 small rounded cuboids or slightly bulging shapes (Burlap Tan) near the entrance — sacks of grain waiting to be ground.
- **Flour sacks (output):** 1–2 lighter-colored sacks (Off-White) on the other side — processed flour ready for the Bakery.
- **A millstone (optional exterior detail):** A flat disc (grey cylinder) leaning against the tower wall, suggesting the grinding mechanism inside.
- **A small platform or loading area:** A flat cuboid step at the entrance for loading/unloading sacks.
- **Surrounding terrain:** Open, flat, grassy ground — windmills need unobstructed wind. A few grass tufts but mostly clear.
- **A small path:** Thin flat cuboid (dirt-colored) leading to the door.
- **Scattered grain:** Tiny yellow cubes near the entrance, suggesting grain spillage during loading.
- **A wooden fence or low wall:** Partial enclosure around the base.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Bright directional sunlight from the side to cast dramatic sail shadows across the tower body. The moving shadows during gameplay will be spectacular.
- A clear sky feel — the windmill stands proud and tall in open terrain.
- The white/light sails should contrast beautifully against a blue sky backdrop.
- A warm ambient fill to keep the beige tower inviting.
- Present from an isometric orthographic camera angle — the sails should be angled so all four are visible, creating the iconic windmill silhouette.
- The Windmill should be the tallest non-military building on the map, immediately recognizable from a distance.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
