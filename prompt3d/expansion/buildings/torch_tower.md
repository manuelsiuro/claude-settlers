# Torch Tower — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Torch Tower"** in a low-poly 3D style.

The Torch Tower is a **military building** (Tier 1) — a tall, narrow stone beacon that provides light radius to reduce nighttime penalties for nearby buildings and roads. It garrisons no knights but projects a small territorial influence. The building should look like a solitary stone pillar crowned with a blazing iron brazier — a sentinel of light standing watch against the darkness.

**Runtime effects:** Flickering emissive glow on the top brazier at night, driven by the `nightness` factor from `AtmosphereController`.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the scene. The final look should be beacon-like, defensive, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Tower body** — Stone Grey (`#8A8A7A`)
- **Flame core** — Flame Orange (`#FF8C00`)
- **Flame highlight** — Flame Yellow (`#FFD700`)
- **Tower base and details** — Dark Stone (`#5A5A5A`)
- **Fuel pile wood** — Wood Brown (`#A0724A`)
- **Ember glow** — Ember Red (`#E03020`)
- **Brazier and iron** — Iron Black (`#2A2A2A`)

---

## 2. CORE STRUCTURE & GEOMETRY

Explain step-by-step how to model the Torch Tower. Include descriptions of the shapes and primitive meshes to use for:

- **The tower shaft:** The tallest single-purpose structure in the game. Model a tall, narrow square cuboid (Stone Grey) — the height-to-width ratio should be roughly 4:1 or 5:1, creating a dramatically vertical silhouette. Taper the tower slightly by scaling the top face to about 85-90% of the base width — this subtle narrowing gives it a stable, classical look. Add thin horizontal cuboid bands (Dark Stone) at 1/3 and 2/3 height to suggest masonry course lines.
- **The brazier:** A wide, shallow bowl shape at the very top. Model it as an open-topped cylinder or a hemisphere with the top removed (Iron Black). The brazier should extend slightly wider than the tower top, creating a visible overhang. Add 4 small cuboid bracket arms (Iron Black) connecting the brazier rim to the tower corners — structural supports.
- **The flame:** The visual crown of the tower. Create a cluster of 3-5 overlapping cone shapes (Flame Orange for the main body, Flame Yellow for the bright inner core, Ember Red for the base). Vary the heights and slight tilts of the cones to create an organic, dancing flame silhouette. The tallest flame cone should reach about 30% of the tower's height above the brazier — the fire is a significant visual element. At runtime, the emissive material will flicker.
- **The square base:** A wider cuboid foundation (Dark Stone) at the ground level — roughly 1.5x the tower width. Step it in with a second, slightly narrower cuboid layer before the main shaft begins. This two-step base grounds the tower and prevents it from looking like it might topple.
- **The stone steps:** 3-4 small, stacked, progressively narrower cuboids (Stone Grey) on one side of the base, suggesting a crude stairway built into the foundation for accessing the tower. Keep these small and subtle.

---

## 3. PROPS AND ENVIRONMENT DETAILS

Describe how to model the key torch tower elements to tell a story. Break down the modeling steps for:

- **The flame detail:** Within the brazier, below the flame cones, add a bed of small cubes and irregular shapes (Ember Red, Flame Orange) representing hot coals and burning fuel. This gives the fire a source — it doesn't just float. The ember bed should fill the brazier bowl.
- **Iron brazier details:** Add a thin torus ring (Iron Black) around the brazier rim for a forged-iron lip. Model 2 small ring handles (tiny torus shapes) on opposite sides of the brazier — used for tilting or cleaning.
- **Wood fuel pile at base:** A stack of small cylinders (Wood Brown) arranged in a rough pyramid at the foot of the tower — firewood waiting to be carried up and fed to the brazier. This is the tower's ongoing resource cost made visible. Place the pile next to the stone steps.
- **Small stone wall:** A low, circular or square ring of cuboid stones (Dark Stone) around the base of the tower, about waist-height — a minimal defensive perimeter. Use 8-10 rough cubes arranged in a ring with small gaps between them.
- **Torch holder (wall-mounted):** A small cuboid bracket (Iron Black) mounted on the tower shaft at about 1/3 height, holding a smaller torch (thin cylinder shaft with a tiny flame cone) — a secondary light source for the base area. This also reinforces the tower's identity as a light-giving structure.
- **Ash pile:** A small, low mound of flat cubes (Dark Stone, lighter) at the base below the brazier — accumulated ash that falls or is swept from the fire. Keep it subtle.
- **Bucket of oil or pitch:** A small tapered cylinder (Iron Black) near the fuel pile — an accelerant for relighting the fire quickly. Add a tiny cuboid ladle handle.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- The flame is everything — use a strong warm point light (Flame Orange) at the brazier position, casting a warm glow downward onto the tower shaft and outward onto the surrounding terrain. This is the tower's gameplay purpose made visual.
- A secondary, dimmer warm light from the wall-mounted torch at 1/3 height, creating a second pool of warm light on the tower body.
- Cool, dark ambient fill for the rest of the scene — the Torch Tower exists to push back darkness, so the contrast between the warm fire glow and the cool surroundings should be dramatic.
- Present from an isometric orthographic camera angle — the tower's extreme verticality should be the dominant visual feature. It should read as the tallest structure per footprint in the entire game.
- The flame cones at the top should be the brightest element in the scene by far — use emissive materials so they glow even without direct lighting.
- The overall atmosphere should feel vigilant, warm against cold, and beacon-like — a lone pillar of fire holding back the night, guiding travelers, and marking the edge of safe territory.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
