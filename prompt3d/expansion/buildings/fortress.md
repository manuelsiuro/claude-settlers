# Fortress — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Fortress"** in a low-poly 3D style.

The Fortress is the **ultimate military building** (Tier 3) — it garrisons up to 20 Knights and projects the largest territorial influence of any buildable structure, second only to the Castle itself. The Fortress should look massive and unyielding — a multi-towered stone stronghold with thick crenellated walls, a heavy iron gate, and red banners flying from every tower. It is the crown jewel of a player's military infrastructure.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the scene. The final look should be imposing, ultimate military, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Main walls** — Dark Stone (`#3A3A3A`)
- **Corner towers** — Tower Grey (`#5A5A5A`)
- **Banners and flags** — Banner Red (`#C0392B`)
- **Banner fabric** — Deep Red (`#8B1A1A`)
- **Gate and iron** — Iron Gate (`#2A2A2A`)
- **Torch flames** — Torch Orange (`#FF8C00`)
- **Gold decorative trim** — Gold Trim (`#DAA520`)
- **Foundation and base** — Foundation Grey (`#6A6A6A`)

---

## 2. CORE STRUCTURE & GEOMETRY

Explain step-by-step how to model the Fortress. Include descriptions of the shapes and primitive meshes to use for:

- **The central keep:** A large, tall cuboid (Dark Stone) forming the heart of the fortress — wider and taller than the Barracks' main structure. This is the command center. Give it a flat roof with crenellated battlements (small cube merlons along every edge). Add 2-3 narrow rectangular arrow slits on each visible wall face. The keep should have visible multiple levels — use thin horizontal cuboid bands (Foundation Grey) at 1/3 and 2/3 height to suggest floor lines.
- **The four corner towers:** Slightly taller square cuboids (Tower Grey) at each corner of the keep, rising above the main roofline. Top each tower with a small four-sided pyramid cap (Banner Red) — the classic medieval castle tower silhouette. Add crenellations around each tower top below the pyramid cap. The towers should be clearly taller than the Barracks' optional towers — this is a grander structure.
- **The thick walls:** Wide cuboid walls (Dark Stone) connecting the corner towers. Make them visibly thicker than the Barracks — extrude the wall depth to at least 1.5x normal wall thickness. Top all walls with continuous crenellations (alternating cube merlons and gaps). The walls suggest an outer curtain enclosing a courtyard.
- **The main gate:** A large, imposing rectangular opening in the front wall (Iron Gate black) with a portcullis suggestion — use a grid of very thin vertical and horizontal cuboids (Iron Gate) across the opening. Frame the gate with two slightly protruding cuboid buttresses (Foundation Grey) flanking the entrance. Add a flat cuboid lintel above with a small gold shield shape (Gold Trim) centered above the arch.
- **The courtyard:** A flat interior area (Foundation Grey) visible through the gate, enclosed by the walls. This is where knights train and muster.

---

## 3. PROPS AND ENVIRONMENT DETAILS

Describe how to model the key fortress elements to tell a story. Break down the modeling steps for:

- **Red banners on all towers:** Long, thin rectangular planes (Banner Red on front, Deep Red on back) hanging from each tower just below the pyramid cap. Add one wider banner on the keep's front face above the gate. The banners should be the most vivid color in the scene — crimson against dark stone. Use 5-6 banners total across the structure.
- **Weapon racks:** Wooden frames (Warm Brown cuboids) placed inside the courtyard near the walls, displaying swords (thin flat blade shapes, Iron Gate) and shields (small disc shapes, Banner Red with Gold Trim boss). Multiple racks — this garrison is fully equipped.
- **Training dummies:** 2-3 T-shaped wooden figures (Warm Brown) standing in the courtyard — sturdy posts with crossbar arms. One should have a battered shield (dented disc shape) attached. These show the knights stay combat-ready.
- **Supply crates:** Clusters of small cuboid crates and barrel cylinders (Dark Brown, Warm Brown) stacked against the interior walls — food, weapons, and provisions for a long siege. More supplies than the Barracks.
- **Torches on walls:** Torch sconces modeled as small cuboid brackets (Iron Gate) mounted on the exterior walls, each topped with a small cone or diamond flame shape (Torch Orange). Place 4-6 torches along the walls — the fortress is well-lit and vigilant.
- **Flag poles:** Tall, thin cylinder poles (Iron Gate) rising from the top of each corner tower, with small triangular pennant flags (Banner Red) at the top. These should be the highest points of the entire model.
- **Stone defensive barriers:** Low cuboid walls (Foundation Grey) arranged in a V-shape in front of the main gate — basic defensive obstacles to slow attackers approaching the entrance.
- **Moat suggestion:** A ring of slightly darker ground (a flat annular shape in a dark blue-grey tone, very subtle) around the entire fortress base, suggesting a dry or shallow moat. Keep this understated — just a color change on the ground plane.
- **Gold trim details:** Small flat cuboid strips (Gold Trim) along the top of the gate frame and at the base of each tower pyramid — subtle but regal accents that distinguish the Fortress from lesser military buildings.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Strong, dramatic directional light casting sharp, long shadows — the Fortress commands the landscape and its shadow should dominate the surrounding terrain.
- The red banners and flags are the primary color accent against the dark grey stone — ensure the key light fully illuminates at least 2-3 banner faces so the red pops vividly.
- Warm orange point lights from the wall torches, creating subtle warm pools against the cold stone walls. The interplay of warm torchlight and cool stone should feel powerful.
- Present from an isometric orthographic camera angle — the full width of the fortress should be visible, with the four corner towers, gate, and banners all readable. The camera angle should convey the sheer scale compared to other buildings.
- The Fortress must read as clearly larger and grander than the Barracks — more towers, thicker walls, more banners, more props. It should be unmistakably the most powerful military building a player can construct.
- The overall atmosphere should feel commanding, unyielding, and regal — a seat of military power built to endure sieges and project dominance across the realm.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
