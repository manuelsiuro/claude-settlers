# Inn Tavern — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Inn Tavern"** in a low-poly 3D style.

The Inn Tavern is a **special processing building** (Tier 2) — it consumes Beer and Wine to generate morale for the settlement's population. The Tavern is the social heart of the village, where weary workers gather to drink, eat, and restore their spirits. It should look wide, inviting, and alive — a large warm-toned wooden building with a prominent hanging sign, multiple glowing windows spilling amber light, and barrels of drink stacked outside the welcoming double doors.

**Runtime effects:** Warm emissive glow from windows at night.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the scene. The final look should be inviting, lively, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Walls and beams** — Warm Wood (`#A0724A`)
- **Window and door glow** — Amber Glow (`#FFB030`)
- **Structural timber** — Dark Brown (`#5C3A1E`)
- **Hanging sign** — Sign Green (`#4A8C3F`)
- **Foundation and chimney** — Stone Grey (`#8A8A7A`)
- **Roof** — Roof Brown (`#6B4226`)
- **Lanterns** — Lantern Gold (`#FFD700`)
- **Window warm light** — Window Warm (`#FFD080`)

---

## 2. CORE STRUCTURE & GEOMETRY

Explain step-by-step how to model the Inn Tavern. Include descriptions of the shapes and primitive meshes to use for:

- **The main building:** A wide, generous cuboid (Warm Wood) — the Tavern should be noticeably broader than most buildings, reflecting its role as a communal gathering hall. The width-to-depth ratio should favor width, giving it a tavern-hall proportion rather than a narrow house shape. Add subtle horizontal plank lines (thin darker strips) across the front face to suggest timber-plank construction.
- **The pitched roof with dormer:** A moderately steep two-plane pitched roof (Roof Brown) spanning the full width. Add one prominent dormer window on the front slope — a small cuboid protrusion with its own tiny pitched roof and a Window Warm glow plane. The dormer suggests an upper room (perhaps lodging for travelers).
- **The welcoming double door:** Two wide, tall cuboid doors (Dark Brown) set into a generous opening at the center of the front face. Both doors slightly ajar (each rotated 10–15 degrees outward), with warm Amber Glow light spilling out from within — a flat, glowing plane visible in the gap. The open doors are the building's invitation to the world.
- **Multiple glowing windows:** 3–4 windows across the front face and 1–2 on each side. Each window is a recessed rectangle with a simple cross-mullion (Dark Brown) and a bright Window Warm glow plane behind. The Tavern has more windows than any other building — it is filled with light and life.
- **The hanging sign bracket:** A thin L-shaped bracket (Dark Brown) — a horizontal cylinder arm extending from the wall above the door with a vertical support. The sign hangs from the end of the arm.

---

## 3. PROPS AND ENVIRONMENT DETAILS

Describe how to model the key inn tavern elements to tell a story. Break down the modeling steps for:

- **Hanging sign:** A small flat rectangular cuboid (Sign Green with a lighter colored face) dangling from the bracket by two tiny chains (short cylinder links). The sign face can bear a simple geometric icon — a tiny circle (representing a mug or ale) or a diamond shape. The sign swaying on its bracket is the Tavern's visual identity from a distance.
- **Outdoor bench and table:** A simple wooden table (a flat cuboid top on four short cylinder legs, Warm Wood) with two bench seats (long flat cuboids on stubby legs) placed in front of the building, to one side of the door. This is where patrons spill outside on warm evenings.
- **Lanterns at door:** Two small lantern props (tiny cuboid frames in Dark Brown with a bright Lantern Gold cube inside) mounted on the wall flanking the double doors. These are the first lights a tired traveler sees approaching through the dusk.
- **Beer barrels:** 3–4 cylinder barrels (Dark Brown with lighter brown flat circle ends) stacked in a pyramid arrangement against the side wall — two on the bottom, one on top. These are the Tavern's stock, clearly visible and suggesting abundance. A tap spigot (tiny cylinder) on the front barrel.
- **Wine crates:** 2 small open cuboid crates (Warm Wood) near the barrels, with tiny cylinder bottles (dark green or deep red) poking above the rims — wine shipments from the Winery.
- **Chimney with smoke suggestion:** A sturdy square cuboid chimney (Stone Grey) rising from the rear roof slope. The chimney should be wide and solid — the Tavern has a large hearth for cooking and warmth. Place a small light-grey cone above the opening to suggest rising smoke.
- **Warm light spill:** Beyond the window glow planes, place a small flat cuboid (Amber Glow, very low opacity or emissive) on the ground in front of the open doors — a pool of warm light spilling out into the street. This detail sells the atmosphere of a welcoming interior.
- **Stepping stones and worn ground:** A wider earth-toned path (a flat cuboid, slightly lighter brown) in front of the entrance, worn smooth by countless visitors. The path should be broader than a typical building entrance — many feet have walked here.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Warm, golden directional sunlight, but the Tavern should look equally good — perhaps even better — in dimmer conditions where the window glow and lanterns become the primary light sources. Consider presenting it in a late-evening light scenario.
- The Amber Glow and Window Warm planes are the emotional core of this building. They should be the brightest elements in the scene, radiating warmth and invitation. The glow from multiple windows should create a cheerful pattern across the wide facade.
- The Lantern Gold at the entrance should serve as focal beacons, drawing the eye to the open doors.
- A soft, cool ambient fill on the exterior (slightly blue-tinted) would contrast beautifully with the warm interior glow, enhancing the "come in from the cold" feeling.
- Present from an isometric orthographic camera angle — the wide front facade with its double doors, hanging sign, glowing windows, and outdoor seating should all face the camera. The barrel stack on the side should be partially visible.
- The overall atmosphere should feel like the most welcoming place in the settlement — warm, lively, and full of stories. Even as a static model, it should suggest the sound of laughter and clinking mugs inside.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
