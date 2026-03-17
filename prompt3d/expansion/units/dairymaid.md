# Dairymaid — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Dairymaid"** character in a low-poly 3D style.

The Dairymaid is a **resource gathering serf** — working at the Dairy Farm to tend cows and produce Milk. This character has a clean, pastoral appearance defined by a white apron and a distinctive bonnet, and carries a milk pail at their side. The bonnet is the key feature that sets this serf apart from the similar-looking Baker.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the character. The final look should be clean, pastoral, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Body / Clothing** — Light Brown (`#C4A56E`)
- **Head / Skin** — Light Peach (`#F5D5B8`)
- **Apron** — White (`#F0F0F0`)
- **Bonnet** — White (`#F5F5F5`)
- **Milk pail** — Grey (`#8A8A7A`)
- **Milk contents** — White (`#FAFAFA`)

---

## 2. BASE MODEL & PROPORTIONS

Explain step-by-step how to model the Dairymaid character, starting from the shared base serf model:

- **The body:** An upright cylinder or slightly rounded cuboid (Light Brown), representing basic clothing. Keep proportions squat and chunky — approximately 1.5x as tall as wide for a charming low-poly feel.
- **The head:** A sphere (Light Peach) placed directly on top of the body. Scale it slightly larger than realistic for readability — about 60–70% of the body width.
- **The bonnet:** A half-sphere (White `#F5F5F5`) placed on top and slightly wrapping around the back of the head, like a cap that covers the crown and sides but leaves the face open. This is distinctly different from the Baker's tall cylindrical chef hat — the bonnet is rounded, lower, and wider, hugging the head's shape. Optionally add a tiny brim or lip at the front edge using a thin torus slice.
- **The limbs (simplified):** One arm extends downward and slightly to the side to hold the milk pail handle. The other arm rests naturally. Arms are small cylinders or thin cuboids (Light Brown).

---

## 3. PROFESSION-SPECIFIC FEATURES

Describe how to model the Dairymaid's distinguishing elements that set them apart from the base Transporter:

- **The bonnet (co-primary identifier):** A half-sphere (White `#F5F5F5`) wrapping the top and back of the head. This is the critical differentiator from the Baker, who also wears white — the Baker has a tall cylindrical chef's hat that adds height, while the Dairymaid's bonnet is a rounded, low-profile shape that follows the contour of the skull. From the isometric camera, the bonnet reads as a smooth dome versus the Baker's tall stack. Keep the bonnet slightly wider than the head to ensure visibility.
- **The white apron (co-primary identifier):** A flat cuboid (White `#F0F0F0`) attached to the front of the body, extending from chest to below the waist. Identical in shape and color to the Baker's apron — this is intentional, as both are "clean work" professions. The bonnet vs. chef hat is what distinguishes the two.
- **The milk pail (secondary identifier):** A small open-topped cylinder (Grey `#8A8A7A`) carried in one hand at the character's side, hanging from a thin curved handle (a half-torus or bent cylinder). Inside the pail, a flat disc of pure white (White `#FAFAFA`) represents the milk surface. The pail hangs lower than chest height, giving the Dairymaid a different arm pose than the Baker who holds bread at chest level.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Use soft, warm directional sunlight from above-left — evoking a gentle morning on the farm.
- A subtle cool ambient fill to keep the whites crisp and clean without overblowing them.
- Present on a neutral ground plane — units are not shown with environmental context.
- The rounded bonnet silhouette should be clearly distinguishable from the Baker's tall chef hat at the isometric game camera angle — this is the most important visual test for this character.
- The grey pail hanging at the side adds a metallic accent and a distinctly different arm pose compared to other white-aproned serfs.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
