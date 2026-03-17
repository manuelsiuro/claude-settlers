# Cattle Ranch — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Cattle Ranch"** in a low-poly 3D style.

The Cattle Ranch is a **resource gathering building** (Tier 2) — it employs a Rancher who feeds and tends Cattle using Grain. The ranch is one of the largest building footprints in the settlement, dominated by its sprawling fenced pasture. It should convey an expansive, pastoral mood — wide open green space, sturdy post-and-rail fencing, and a few contented cows grazing lazily in the sun.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the scene. The final look should be expansive, pastoral, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Fence posts and rails** — Fence Brown (`#8B5E3C`)
- **Pasture grass** — Grass Green (`#7CBA5C`)
- **Cow bodies** — Cow Brown (`#8B5E3C`)
- **Barn walls and roof** — Barn Red-Brown (`#8B4513`)
- **Barn timber and door** — Warm Brown (`#A0724A`)
- **Structural beams** — Dark Brown (`#5C3A1E`)
- **Worn ground and path** — Earth (`#6B4226`)
- **Hay and feed** — Hay Gold (`#D4B84A`)

---

## 2. CORE STRUCTURE & GEOMETRY

Explain step-by-step how to model the Cattle Ranch. Include descriptions of the shapes and primitive meshes to use for:

- **The barn/shed:** A small, compact cuboid building (Warm Brown walls, Barn Red-Brown sloped roof). This is intentionally modest — the Rancher spends most of their time outdoors. Keep it roughly half the size of a standard processing building. A simple two-plane pitched roof with slight eave overhang. A single wide door on the side facing the pasture.
- **The pasture:** A large, flat rectangular area (Grass Green) extending prominently from one side of the barn — this is the visual centerpiece and should occupy 2–3 times the footprint of the barn itself. The grass plane should be slightly different in shade from the surrounding terrain to define the ranch boundary.
- **The post-and-rail fence:** A continuous perimeter fence (Fence Brown) enclosing the pasture on all sides. Model each fence section as two vertical cylinder posts connected by two horizontal cuboid rails. Space the posts evenly — about 8–10 sections total. The fence should be low enough that the cows inside are clearly visible above the top rail.
- **The gate:** One fence section replaced with a swinging gate — a single panel of two rails with a diagonal brace (a thin rotated cuboid), attached to one post with a small hinge cube. The gate should be slightly ajar (rotated 10 degrees open) to suggest the Rancher coming and going.
- **Worn ground patches:** 2–3 flat cuboid patches (Earth) within the pasture where the cattle have trampled the grass away, especially near the feeding trough and gate entrance.

---

## 3. PROPS AND ENVIRONMENT DETAILS

Describe how to model the key cattle ranch elements to tell a story. Break down the modeling steps for:

- **Cows:** 1–2 simple cow shapes (Cow Brown) grazing in the pasture. Each cow is a large, elongated cuboid body (slightly rounded by beveling the edges), four short stubby cylinder legs, a smaller cuboid head on a short cylinder neck angled downward (grazing pose), two tiny flat triangular ears, and a thin cylinder tail with a small tuft at the end. Add a contrasting lighter belly by coloring the underside faces. Keep them charmingly chunky and low-poly.
- **Hay feeding trough:** A long, sturdy U-shaped channel (Warm Brown) — a cuboid with the interior extruded down — placed centrally in the pasture. Pile small irregular cuboids and icospheres of Hay Gold inside to show it is freshly filled.
- **Grain bucket:** A small tapered cylinder (Dark Brown) near the barn entrance, slightly tilted, with tiny golden cubes (Grain) spilling from the top — the feed input being prepared.
- **Lasso coil:** A torus shape (Fence Brown) draped over one of the fence posts near the gate — a coil of rope ready for use. Scale it small and rest it naturally on the post top.
- **Water trough:** A second trough (slightly smaller, stone-grey cuboid) near one corner of the pasture, filled with a flat blue-tinted plane for water. A cow positioned nearby suggests it just finished drinking.
- **Worn grass patches:** Several flat, irregular earth-toned shapes (Earth) scattered in the pasture, especially concentrated around the feeding trough and water trough — the ground worn bare by hooves.
- **Hay bale stack:** 2–3 rectangular cuboids (Hay Gold) stacked against the outside wall of the barn — stored feed reserves. One bale broken open with loose hay scattered at its base.
- **Surrounding grass:** Lush Grass Green tufts and small wildflower dots around the outside of the fence perimeter, contrasting with the more trampled interior.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Bright, warm midday sunlight from a high angle — this is an open-air building, and the wide pasture should feel sun-drenched and spacious.
- Soft ambient fill to ensure the shaded sides of the cows and barn remain readable — the cows must be clearly visible as the visual highlight.
- The contrast between the bright green pasture, the worn brown earth patches, and the warm brown fence creates a layered, natural composition.
- Present from an isometric orthographic camera angle — the full extent of the pasture and fence should be visible, with the small barn anchoring one corner. The cows should be placed where the camera sees them clearly.
- The overall atmosphere should feel like a peaceful, sun-warmed ranch — wide open spaces, gentle animals, and honest agricultural work.
- The fence perimeter is the defining visual element — it should read clearly as an enclosed, managed space distinct from the wild landscape beyond.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
