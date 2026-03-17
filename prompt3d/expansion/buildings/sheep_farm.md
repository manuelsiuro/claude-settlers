# Sheep Farm — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Sheep Farm"** in a low-poly 3D style.

The Sheep Farm is a **resource gathering building** (Tier 2) — it employs a Shepherd who tends a small flock of sheep and harvests Wool. Requiring no input resources, it is a self-sufficient pastoral operation. The Sheep Farm should feel peaceful and idyllic — a small wooden hut beside a grassy fenced paddock dotted with fluffy white sheep shapes, evoking a quiet countryside hillside.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the scene. The final look should be peaceful, pastoral, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Sheep fleece** — Wool White (`#F5F0E0`)
- **Pasture and grass** — Grass Green (`#7CBA5C`)
- **Hut walls and fence** — Warm Brown (`#A0724A`)
- **Fence posts and gate** — Fence Brown (`#8B5E3C`)
- **Hut roof** — Dark Brown (`#5C3A1E`)
- **Wool baskets and props** — Light Brown (`#C4A56E`)
- **Sheep face and hooves** — Sheep Face Black (`#2A2A2A`)

---

## 2. CORE STRUCTURE & GEOMETRY

Explain step-by-step how to model the Sheep Farm. Include descriptions of the shapes and primitive meshes to use for:

- **The shepherd's hut:** A small, low cuboid building (Warm Brown walls, Dark Brown pitched roof). This is a humble shelter — significantly smaller than the barn-type buildings. Just enough room for the Shepherd to store tools and process wool. A simple two-plane sloped roof with minimal overhang. One small door on the face adjacent to the paddock.
- **The fenced paddock:** A modest rectangular fenced area (smaller than the Cattle Ranch pasture) extending from the hut. The paddock is the sheep's grazing space. Use a low stone wall or wooden fence (Fence Brown) — model the stone wall as a series of small irregular cuboids stacked two courses high, or the wooden fence as short vertical cylinder posts with a single horizontal cuboid rail. The low fence height lets the white sheep shapes stand out above it.
- **The gate:** A simple wooden gate (Fence Brown) in the fence — a small panel of two horizontal rails and a diagonal brace, hinged on one post. Leave it slightly open.
- **The ground plane:** Bright Grass Green inside the paddock — sheep keep the grass well-cropped, so the surface should feel neat and even, unlike the muddy cattle ranch. A thin flat cuboid path (Light Brown) connects the hut door to the gate.

---

## 3. PROPS AND ENVIRONMENT DETAILS

Describe how to model the key sheep farm elements to tell a story. Break down the modeling steps for:

- **Sheep:** 2–3 adorable low-poly sheep in the paddock. Each sheep is a large, soft-looking icosphere or subdivided cube (Wool White) for the fluffy body, sitting atop four very short stubby cylinder legs (Sheep Face Black). The head is a small elongated cuboid (Sheep Face Black) protruding from one end of the wool body — the dark face against white fleece is the iconic sheep silhouette. Add two tiny flat triangular ears angled outward. One sheep grazing (head angled down), one standing alert (head level), and optionally one lying down (legs tucked, body resting on the grass).
- **Wool basket:** A medium open-topped woven basket (Light Brown) — a tapered cylinder with the interior extruded down — placed near the hut door, overflowing with puffy white wool (2–3 small Wool White icospheres mounded above the rim). This is the Shepherd's harvested output.
- **Shepherd's crook:** A long, thin cylinder staff (Warm Brown) with a curved hook at the top (a torus quarter-section or bent cylinder), leaning against the hut wall at an angle. The classic Shepherd's tool — immediately identifies the building's purpose.
- **Shearing stool:** A small, low cuboid (Light Brown) placed near the wool basket — a simple wooden stool where the Shepherd sits to shear sheep. A pair of tiny shearing blades (two small flat cuboids crossed in an X) resting on top.
- **Hay pile:** A small mound of irregular golden cuboids and cones (Light Brown with a golden tint) inside the paddock or near the hut — supplemental feed for the flock.
- **Scattered wool tufts:** 3–4 very small icospheres (Wool White) scattered on the grass near the shearing stool and along the fence — wisps of wool caught on the ground and fence posts during shearing.
- **Wildflowers and grass tufts:** Small cone and diamond shapes (Grass Green) with tiny colorful flower dots (white, yellow, purple) around the outside of the fence and along the path. The Sheep Farm should feel like the prettiest spot in the settlement.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Soft, warm sunlight from a moderately high angle — the kind of gentle light that makes a green hillside glow. Not harsh midday sun, but golden late-morning warmth.
- The white sheep should be the brightest elements in the scene — ensure the lighting makes the Wool White pop cleanly against the Grass Green pasture. The sheep are the visual stars.
- A soft ambient fill to keep the shaded side of the hut and fence readable without competing with the sheep.
- Present from an isometric orthographic camera angle — the paddock with sheep should dominate the composition, with the small hut tucked to one side. All 2–3 sheep should be visible and distinguishable.
- The overall atmosphere should feel serene and gentle — this is the most peaceful building in the settlement, a place of quiet routine and soft wool.
- The dark sheep faces against white bodies create a charming, recognizable silhouette that should read clearly even at small game-world scale.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
