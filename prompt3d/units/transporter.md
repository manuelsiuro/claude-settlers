# Transporter — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Transporter"** character in a low-poly 3D style.

The Transporter is the **logistics backbone** of the settlement — carrying goods between buildings along the flag-and-road network. This is the most commonly seen serf in the game and should read as a generic, hardworking carrier. The character should look humble, industrious, and always in motion — arms extended in a carrying pose with a generic resource parcel.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the character. The final look should be simple, readable, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Body / Clothing** — Light Brown (`#C4A56E`)
- **Head / Skin** — Light Peach (`#F5D5B8`)
- **Carried resource (generic)** — Warm Brown (`#8B5E3C`)
- **Arms (simplified)** — Light Brown (`#C4A56E`), matching the body

---

## 2. BASE MODEL & PROPORTIONS

Explain step-by-step how to model the Transporter character. This is the **base serf model** shared by all professions, shown here in its simplest form:

- **The body:** An upright cylinder or slightly rounded cuboid (Light Brown), representing basic clothing. Keep proportions squat and chunky — approximately 1.5× as tall as wide for a charming low-poly feel. This is a small character meant to be viewed from an isometric distance.
- **The head:** A sphere (Light Peach) placed directly on top of the body. Scale it slightly larger than realistic for readability — about 60–70% of the body width.
- **The limbs (simplified):** Arms are implied by two small cylinders or thin cuboids (Light Brown) extending forward from the body sides in a carrying pose. Legs are omitted or implied by the body shape — the walk animation will convey movement.
- **The carried resource:** A small cuboid or rounded box (Warm Brown) held between the two extended arms, representing a generic goods parcel. This is the Transporter's defining visual — always carrying something.

---

## 3. PROFESSION-SPECIFIC FEATURES

The Transporter has **no unique attire or tools** beyond the base model — it is distinguished purely by its carrying pose and the resource it holds:

- **Carrying pose:** Both arms extend forward, holding the resource parcel at chest height. This pose should be the character's default and immediately communicate "I'm carrying something."
- **Generic resource parcel:** A small cuboid (Warm Brown), approximately 40% of the body width. This represents any resource in transit. In-game, the actual resource model may replace this generic parcel.
- **No hat, no apron, no tool:** The Transporter is intentionally plain — it is the baseline from which all other professions are visually differentiated.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Use warm directional sunlight from above-left to clearly define the character's silhouette and the carried parcel.
- A subtle ambient fill light to prevent harsh shadows on the small character.
- Present on a neutral ground plane — units are not shown with environmental context.
- The carrying pose and resource parcel should be clearly visible from the isometric game camera angle, immediately communicating the Transporter's role.
- The character should read clearly even at small on-screen sizes — favor bold shapes over fine detail.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
