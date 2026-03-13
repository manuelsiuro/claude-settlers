# Castle — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Castle"** in a low-poly 3D style using software like Blender or Maya.

The Castle is the **central hub** of the settlement — it is the player's starting building, the serf spawning point, and the initial resource storehouse. Its destruction means defeat. It should look imposing, fortified, and grand — the largest structure in the game. Think medieval keep surrounded by corner towers with red-capped roofs.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the scene. The final look should be imposing, fortified, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Main base walls** — Medium Grey (`#8C8C8C`)
- **Central keep** — Dark Grey (`#5A5A5A`)
- **Corner towers** — Light Grey (`#B0B0B0`)
- **Tower roof caps** — Red (`#C0392B`)
- **Entrance gate** — Very Dark Grey (`#3A3A3A`)
- **Ground/courtyard** — Warm Stone (`#A89070`)
- **Banner/flag accents** — Deep Red (`#8B1A1A`)
- **Metal portcullis details** — Dark Iron (`#4A4A4A`)

---

## 2. CORE STRUCTURE & GEOMETRY

Explain step-by-step how to model the Castle. Include descriptions of the shapes and primitive meshes to use for:

- **The base platform:** A large, wide, medium-height square cuboid (Medium Grey). This is the largest footprint of any building in the game. Add subtle bevels on the top edges for a hewn-stone look.
- **The central keep:** Centered on the base, a taller, slightly narrower square cuboid (Dark Grey). This is the dominant vertical element. The keep should rise ~1.5× the height of the base walls.
- **The four corner towers:** Four smaller square cuboids at each corner of the base, slightly taller than the base but shorter than the keep (Light Grey). Each tower is topped with a small, sharp pyramid (Red) — these are the iconic red caps visible from a distance.
- **Crenellations:** Along the top edges of the base and keep, add small cube-shaped merlons to suggest battlements. Use the same color as the wall they sit on.
- **The entrance:** A darker grey rectangular indentation on one side of the base — a recessed gate. Optionally add a small flat cuboid above it as a gatehouse lintel.
- **Windows:** Small dark rectangular indentations (arrow slits) on the keep and towers.

---

## 3. PROPS AND ENVIRONMENT DETAILS

Describe how to model the key Castle elements to tell a story. Break down the modeling steps for:

- **Courtyard ground:** A flat plane with a slightly different stone color inside the walls, suggesting a paved interior.
- **A banner/flag:** A small flat plane on a thin cylinder pole, placed on top of the keep. Use the player's faction color (default: deep red).
- **Gate details:** A thin grid of dark iron cuboids suggesting a portcullis at the entrance.
- **Crates and barrels:** A few small cubes (crates) and short cylinders (barrels) near the entrance, suggesting stored supplies — the Castle starts with initial resources.
- **Torch sconces:** Tiny cylinders with small orange cubes (flame) on the walls flanking the entrance.
- **Surrounding ground:** A subtle stone-colored flat area around the base, transitioning to grass (the Castle's immediate territory).

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Use a warm directional sunlight from above-left to cast clear shadows off the towers and keep.
- Add a subtle blue-grey ambient/fill light to soften shadows and bring out the stone greys.
- A faint warm rim light from behind to silhouette the tower pyramids.
- Present from an isometric orthographic camera angle — the Castle should read clearly as the largest, most important structure even at a distance.
- The red tower caps should be the most visually striking element, making the Castle instantly recognizable on the map.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
