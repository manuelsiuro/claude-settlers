# Siege Operator — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Siege Operator"** character in a low-poly 3D style.

The Siege Operator is a **specialized military unit** — slow-moving (0.6x speed) but devastating against buildings (3.0x damage vs structures). This unit operates a siege ram and is the only unit designed specifically to destroy enemy buildings. The character should look bulky, heavily built, and laborer-like — a hybrid between a soldier and a construction worker, clad in heavy leather with an iron pot helmet. The Siege Operator cannot effectively fight other units; their purpose is breaching walls and smashing structures.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the character. The final look should be heavy, utilitarian, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Body / Clothing** — Dark Brown (`#5C3A1E`)
- **Head / Skin** — Light Peach (`#F5D5B8`)
- **Helmet** — Iron (`#4A4A4A`)
- **Leather Armor** — Dark Leather (`#6B4226`)
- **Gloves** — Grey (`#7A7A7A`)
- **Ram Handle** — Brown (`#A0724A`)
- **Iron Bands** — Iron (`#4A4A4A`)

---

## 2. BASE MODEL & PROPORTIONS

Explain step-by-step how to model the Siege Operator character, starting from the shared base serf model but with significant modifications for bulk:

- **The body:** An upright cylinder or slightly rounded cuboid, representing basic clothing. Keep proportions squat and chunky — approximately 1.5x as tall as wide for a charming low-poly feel. Use Dark Brown (`#5C3A1E`) as the base color. **Critically, scale the body cylinder approximately 20-25% wider than a standard serf** to convey the Siege Operator's brute strength and heavy build. This extra width is the first visual cue that this is no ordinary unit.
- **The head:** A sphere placed directly on top of the body. Scale it slightly larger than realistic for readability — about 60-70% of the body width. Use Light Peach (`#F5D5B8`) for the skin, though the top half will be covered by the iron helmet.
- **The leather armor overlay:** A slightly wider cuboid (Dark Leather `#6B4226`) wrapped around the body cylinder from shoulders to hips — like a thick leather vest or jerkin. Extrude it just slightly beyond the body surface so the two-layer look (dark brown clothing underneath, darker leather on top) reads clearly. The leather should look thick and functional, not elegant.
- **The limbs (simplified):** Both arms extend forward to grip the horizontal pushbar. Arms are small cylinders or thin cuboids (Dark Brown), noticeably thicker than a standard serf's arms to match the bulky body. End each arm with a small cuboid (Grey `#7A7A7A`) representing heavy work gloves.

---

## 3. PROFESSION-SPECIFIC FEATURES

Describe how to model the Siege Operator's distinguishing elements:

- **The iron pot helmet (co-primary identifier):** A half-sphere or dome shape (Iron `#4A4A4A`) placed on the upper half of the head sphere, covering everything above the brow line. The helmet should be slightly wider than the head — scale it to about 110% of the head width so it looks like a heavy, oversized pot helm. Optionally add a tiny flat rim around the base of the dome (a thin torus or flattened cylinder) to suggest a reinforced brim. The dark iron color against the peach skin below creates a distinctive half-and-half head that is unique among all units.
- **The pushbar (co-primary identifier):** A horizontal cylinder (Brown `#A0724A`) extending across the character's front at waist height, gripped by both gloved hands. The pushbar is approximately 120% of the body width, extending past the character on both sides. Add two thin cylinder or cuboid iron bands (Iron `#4A4A4A`) wrapped around the pushbar near each end. This bar represents the handle of the siege ram — the ram itself is a separate game object, but the character model always shows the operator gripping this bar, ready to push.
- **The heavy gloves (tertiary identifier):** Small cuboids (Grey `#7A7A7A`) at the ends of each arm, slightly oversized to suggest thick, padded work gloves. These add to the laborer-soldier aesthetic.
- **No weapons:** The Siege Operator carries no sword, shield, bow, or any offensive weapon. The pushbar is a tool, not a weapon. This reinforces that the unit is a specialist, not a fighter.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Use warm directional sunlight from above-left to catch the rounded dome of the iron helmet and define the bulky body silhouette with clear light-and-shadow boundaries.
- A subtle warm ambient fill to prevent the dark brown and dark leather tones from becoming too muddy — the two-tone brown layering should remain distinguishable.
- Present on a neutral ground plane — units are not shown with environmental context.
- The Siege Operator should read as the widest and heaviest infantry unit. From the isometric game camera, the extra-wide body, dome helmet, and horizontal pushbar create a uniquely squat, powerful silhouette that communicates "breacher" at a glance.
- The iron helmet dome is the brightest element on the upper body, drawing the eye upward and confirming this is an armored unit despite the lack of steel plate.
- The horizontal pushbar breaking the vertical body line is the key shape distinction from all other foot units.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
