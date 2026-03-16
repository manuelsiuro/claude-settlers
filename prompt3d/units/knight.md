# Knight — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Knight"** character in a low-poly 3D style.

The Knight is the **military unit** — the only combat-capable unit in the game. A Knight is created when a serf delivers a Sword and Shield to a military building with an empty slot. Knights defend territory and can be directed to attack enemy settlements. The character should look armored, martial, and imposing — clearly distinct from all civilian serfs.

**Runtime effects:** Faction color tinting (40% lerp toward player color on spawn). Gold rank chevrons (1–5 cone pyramids on shoulder). Fighting state with aggressive animation (2× bob speed, 1.5× rotation). 5-phase combat animation (Approach → Clash → Recoil → Result → Done).

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the character. The final look should be martial, armored, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Body / Armor (default)** — Steel Grey (`#7A7A7A`)
- **Head / Helmet** — Steel Grey (`#7A7A7A`)
- **Sword blade** — Bright Steel (`#B0B0B0`)
- **Sword hilt** — Tan (`#D2A86E`)
- **Shield face** — Warm Brown (`#8B5E3C`)
- **Shield rim** — Steel Grey (`#7A7A7A`)
- **Rank chevrons** — Gold (`#FFD700`)
- **Player 1 faction** — Blue (`#4488FF`)
- **Player 2 faction** — Red (`#FF4444`)
- **Player 3 faction** — Green (`#44CC44`)
- **Player 4 faction** — Yellow (`#FFCC00`)

---

## 2. BASE MODEL & PROPORTIONS

Explain step-by-step how to model the Knight character. The Knight uses a **modified base model** — more robust than a standard serf:

- **The body:** An upright cylinder or slightly more robust cuboid (Steel Grey `#7A7A7A`), representing armor. **Slightly wider and taller** than a standard serf — approximately 15% larger to convey military presence. The steel grey color immediately distinguishes the Knight from all brown-clothed civilian serfs.
- **The head / helmet:** A sphere or slightly rounded cube (Steel Grey) — representing a helmet rather than exposed skin. The helmet color matching the body armor creates a fully armored look. Alternatively, a metallic grey hemisphere can sit on top of a peach sphere for a half-helm look.
- **The limbs (simplified):** Two arms — one extends to the side holding the sword, the other holds the shield. Arms are small cylinders or thin cuboids (Steel Grey, matching the body).

---

## 3. PROFESSION-SPECIFIC FEATURES

Describe how to model the Knight's distinguishing elements. The Knight has the most equipment of any unit:

- **The sword (co-primary identifier):** A long, thin, flat cuboid blade (Bright Steel `#B0B0B0`) with a small cuboid crossguard and a short cylinder hilt (Tan). The blade should be approximately 70% of the body height — visibly a weapon of war. Hold it in one hand extending to the side or slightly forward.
- **The shield (co-primary identifier):** A flat square, circular disc, or octagonal shape (Warm Brown `#8B5E3C` center with Steel Grey `#7A7A7A` rim). Approximately 50% of the body height. Held in the other hand, covering the character's side. Optionally, add a simple colored shape (circle or square) in the center as a faction emblem — this will be tinted to the player's faction color at runtime.
- **The helmet (tertiary identifier):** The steel grey head distinguishes the Knight from all civilian serfs who have peach-colored heads. The helmet is what makes the Knight look fully armored.
- **Rank chevrons (runtime addition):** Gold (`#FFD700`) cone pyramids (`ConeGeometry(0.02, 0.04, 4)`) positioned on one shoulder. The number of chevrons equals the knight's rank (1–5). These are added programmatically at runtime and updated per frame, but the shoulder area should be kept clear for chevron placement.
- **Faction color tinting (runtime effect):** On spawn, all mesh materials are tinted 40% toward the owning player's faction color via `color.lerp()`. The base model should use neutral Steel Grey so that any faction color tint reads clearly. Player colors: Blue (`#4488FF`), Red (`#FF4444`), Green (`#44CC44`), Yellow (`#FFCC00`).

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Use warm directional sunlight from above-left to catch the sword blade and shield rim with specular-like highlights on the flat-shaded steel surfaces.
- A subtle cool ambient fill to give the steel armor a slightly blue-grey quality.
- Present on a neutral ground plane — units are not shown with environmental context.
- The Knight should read as visually distinct from all civilian serfs — the steel grey armor, sword, and shield create a silhouette that is unmistakably military from the isometric game camera angle.
- The bright steel sword blade should be the most reflective element, drawing the eye to the weapon.
- The shield provides a large flat surface that will display faction colors clearly after runtime tinting.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
