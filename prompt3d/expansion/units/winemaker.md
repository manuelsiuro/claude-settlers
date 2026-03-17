# Winemaker — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Winemaker"** character in a low-poly 3D style.

The Winemaker is a **resource processing serf** — working at the Winery to ferment and process Grapes into Wine. Unlike the outdoor Vintner, this character works indoors among barrels and vats, and should feel more refined and production-focused, with a darker purple apron and a wine bottle as the carried prop.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the character. The final look should be refined, production-focused, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Body / Clothing** — Light Brown (`#C4A56E`)
- **Head / Skin** — Light Peach (`#F5D5B8`)
- **Apron** — Deep Purple (`#5B1A6B`)
- **Wine bottle body** — Dark Wine (`#3A2040`)
- **Wine liquid accent** — Wine Red (`#8B1A1A`)

---

## 2. BASE MODEL & PROPORTIONS

Explain step-by-step how to model the Winemaker character, starting from the shared base serf model:

- **The body:** An upright cylinder or slightly rounded cuboid (Light Brown), representing basic clothing. Keep proportions squat and chunky — approximately 1.5x as tall as wide for a charming low-poly feel.
- **The head:** A sphere (Light Peach) placed directly on top of the body. Scale it slightly larger than realistic for readability — about 60–70% of the body width.
- **No hat — bare head or headband:** The Winemaker deliberately goes without a hat or cap, distinguishing this character from the Vintner (who wears a brown cap). Optionally, add a very thin torus or flat ribbon shape around the forehead as a simple headband (Deep Purple `#5B1A6B`) to hint at the winery trade without adding significant silhouette height.
- **The limbs (simplified):** One arm extends forward cradling the wine bottle. The other arm rests at the side or supports the bottle from below. Arms are small cylinders or thin cuboids (Light Brown).

---

## 3. PROFESSION-SPECIFIC FEATURES

Describe how to model the Winemaker's distinguishing elements that set them apart from the base Transporter:

- **The deep purple apron (primary identifier):** A flat cuboid (Deep Purple `#5B1A6B`) attached to the front of the body, extending from chest to below the waist. This apron is noticeably darker than the Vintner's purple (`#6B2D8B` vs `#5B1A6B`) — a deeper, richer shade that reads as "processed, refined" compared to the Vintner's brighter field-stained purple. The darker tone conveys an indoor, production-line character.
- **The wine bottle (co-primary identifier):** A small cylinder (Dark Wine `#3A2040`) for the bottle body, topped with a narrower, shorter cylinder or tapered cone for the neck. The overall shape should be about 60% of the character's body height. This classic bottle silhouette — wide base tapering to a narrow neck — is unmistakable even at small sizes. Optionally, a tiny flat disc on top suggests a cork or cap.
- **No hat (distinguishing absence):** The bare head (or minimal headband) is a deliberate contrast to the Vintner's cap. Together with the darker purple and the bottle prop, this creates three clear visual differences between the two grape-related serfs: darker apron, bottle instead of shears, no cap.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Use warm directional sunlight from above-left, slightly muted compared to outdoor serfs — evoking an indoor cellar atmosphere.
- A subtle cool ambient fill to give the deep purple apron a rich, velvety quality.
- Present on a neutral ground plane — units are not shown with environmental context.
- The deep purple apron should read as distinctly darker than the Vintner's purple from the isometric game camera angle — the two must be visually distinguishable when side by side.
- The dark wine bottle silhouette in the hand should be clearly readable against the light brown body, providing the key "this is a processing worker" signal.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
