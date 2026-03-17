# Scout — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Scout"** character in a low-poly 3D style.

The Scout is a **reconnaissance military unit** — the fastest unit in the game (2.0x speed) with the largest vision radius (12 hexes). However, the Scout is extremely fragile in combat (0.3x HP, 0.2x attack) and requires no special equipment to recruit — any serf can be promoted directly. The character should look light, stealthy, and fast — wrapped in an earthy hooded cloak with no armor whatsoever, carrying only a small spyglass. The Scout is a ranger who observes rather than fights.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the character. The final look should be swift, stealthy, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Body / Clothing** — Light Brown (`#C4A56E`)
- **Head / Skin** — Light Peach (`#F5D5B8`)
- **Cloak** — Olive (`#7A8A5A`)
- **Spyglass** — Brass (`#B8860B`)
- **Belt** — Brown (`#8B5E3C`)
- **Boots** — Dark Brown (`#5C3A1E`)
- **Hood** — Light Olive (`#A0946E`)

---

## 2. BASE MODEL & PROPORTIONS

Explain step-by-step how to model the Scout character, starting from the shared base serf model but with a slimmer build:

- **The body:** An upright cylinder or slightly rounded cuboid, representing basic clothing. Keep proportions squat and chunky — approximately 1.5x as tall as wide for a charming low-poly feel. Use Light Brown (`#C4A56E`) as the base clothing color. **Optionally scale the body cylinder 5-10% narrower than a standard serf** to suggest a leaner, faster build — though this is subtle and not required.
- **The head:** A sphere placed directly on top of the body. Scale it slightly larger than realistic for readability — about 60-70% of the body width. Use Light Peach (`#F5D5B8`) for the skin, though most of the head will be covered by the hood.
- **The cloak (major visual element):** A wider cone or tapered cylinder (Olive `#7A8A5A`) draped over the entire body, starting from the shoulders and flaring outward toward the base. The cloak's bottom diameter should be about 130-140% of the body width, creating a tent-like drape. The cone should end at roughly knee height, leaving the boots visible below. This olive green cloak is the Scout's single most defining shape — it transforms the standard cylindrical serf silhouette into a distinctive triangular one.
- **The limbs (simplified):** Arms are mostly hidden beneath the cloak. One arm emerges from an opening in the cloak's side to hold the spyglass. The arm is a small cylinder (Light Brown).

---

## 3. PROFESSION-SPECIFIC FEATURES

Describe how to model the Scout's distinguishing elements:

- **The hooded cloak (primary identifier):** The olive cloak described in Section 2 is the Scout's dominant visual feature. At the top, where the cloak meets the head, add a pointed hood: a smaller cone (Light Olive `#A0946E`) that rises above the head sphere and falls slightly forward. The hood point should extend about 30% above the head height. The two-tone effect — lighter hood against darker olive cloak body — adds visual interest. From the isometric camera, the triangular cloak silhouette with the pointed hood tip is instantly recognizable and completely unique among all units.
- **The spyglass (co-primary identifier):** A small cylinder (Brass `#B8860B`) approximately 40% of the body height in length. Model it as a simple tube — one end slightly wider than the other to suggest a telescope taper. The Scout holds the spyglass in one hand, either raised to eye level (peering out from under the hood) or held at the hip angled outward. The warm brass color against the muted olive cloak makes the spyglass pop as a bright accent point.
- **The belt and pouch (tertiary detail):** A thin torus or flattened cylinder ring (Brown `#8B5E3C`) around the waist, visible where the cloak falls open slightly at the front. Attach a tiny cuboid to one side as a belt pouch — suggesting maps, provisions, or other scouting supplies. This is a subtle detail but adds character.
- **The boots (tertiary detail):** Two small cylinders (Dark Brown `#5C3A1E`) visible below the cloak's hem. Slightly taller than standard serf feet to suggest sturdy traveling boots.
- **No armor, no weapons:** The Scout carries absolutely no armor, shield, sword, or bow. The spyglass is the only carried object. This extreme minimalism communicates the unit's role — observation, not combat.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Use warm directional sunlight from above-left to define the cone shape of the cloak with a clear light-to-shadow gradient, emphasizing the triangular silhouette.
- A subtle warm ambient fill to keep the earthy olive and brown tones from looking flat — the cloak's surface should show gentle value variation across its cone geometry.
- Present on a neutral ground plane — units are not shown with environmental context.
- The Scout should read as the most distinct silhouette among all foot units — where others are vertical cylinders, the Scout is a triangle with a pointed top. From the isometric game camera, this conical cloak shape is unmistakable.
- The brass spyglass should be the brightest accent on the model, catching the sunlight as a warm golden point that draws the eye despite the otherwise muted, camouflage-like palette.
- The earthy color scheme (olive, light brown, brown) should blend harmoniously, evoking a character designed to move unseen through the landscape.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
