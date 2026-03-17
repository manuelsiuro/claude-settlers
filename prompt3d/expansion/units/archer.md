# Archer — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Archer"** character in a low-poly 3D style.

The Archer is a **ranged military unit** — stationed at an Archery Range and capable of attacking enemies from up to 3 hexes away. An Archer is recruited when a serf delivers a Bow and Arrows to an Archery Range with an empty slot. Lighter and more agile than a Knight, the Archer trades raw durability (0.7x Knight HP) and melee power (0.6x Knight attack) for the strategic advantage of range. The character should look lithe, stealthy, and forest-ready — clad in leather rather than steel, with a hood pulled up and a bow at the ready.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the character. The final look should be agile, woodland-themed, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Body / Clothing** — Forest Green (`#4A7A3F`)
- **Head / Skin** — Light Peach (`#F5D5B8`)
- **Leather Armor** — Brown (`#8B5E3C`)
- **Hood** — Dark Green (`#3A5A2F`)
- **Bow** — Brown (`#A0724A`)
- **Quiver** — Dark Brown (`#6B4226`)
- **Arrow Shaft** — Tan (`#D2A86E`)
- **Arrowhead** — Grey (`#7A7A7A`)
- **Bowstring** — Tan (`#D2A86E`)

---

## 2. BASE MODEL & PROPORTIONS

Explain step-by-step how to model the Archer character, starting from the shared base serf model:

- **The body:** An upright cylinder or slightly rounded cuboid, representing basic clothing. Keep proportions squat and chunky — approximately 1.5x as tall as wide for a charming low-poly feel. Use Forest Green (`#4A7A3F`) as the base clothing color to immediately evoke a woodland ranger.
- **The head:** A sphere placed directly on top of the body. Scale it slightly larger than realistic for readability — about 60-70% of the body width. Use Light Peach (`#F5D5B8`) for exposed skin, though much of the head will be covered by the hood.
- **The leather cuirass:** A slightly wider cuboid (Brown `#8B5E3C`) overlaid on the front and back of the body cylinder, extending from the shoulders to the waist. Scale it just a fraction wider than the body so it reads as a separate layer of armor. Bevel the top edges slightly for a fitted look. This leather armor is visibly lighter and thinner than the Knight's full steel plate.
- **The limbs (simplified):** One arm extends to the side gripping the bow; the other arm is drawn back as if nocking an arrow. Arms are small cylinders or thin cuboids (Forest Green, matching the body).

---

## 3. PROFESSION-SPECIFIC FEATURES

Describe how to model the Archer's distinguishing elements that set them apart from the Knight and other military units:

- **The hood (co-primary identifier):** A cone shape (Dark Green `#3A5A2F`) placed over the head sphere, with the base of the cone resting at roughly ear level and the point rising above the head. Scale the cone so its base is about 80% of the head diameter. The hood should drape slightly — flatten the back of the cone or add a small triangular extrusion hanging down the back of the neck. The dark green hood against the forest green body creates a two-tone camouflage effect and is the Archer's most distinctive silhouette feature from above.
- **The bow (co-primary identifier):** A curved, flat shape (Brown `#A0724A`) held vertically in one hand. Model it as a thin cuboid bent into a gentle arc — or use two short cylinders angled to form a shallow "D" shape. The bow height should be approximately 80% of the body height. Add a thin line or extremely narrow cylinder (Tan `#D2A86E`) connecting the two tips as the bowstring. The bow is what makes this unit instantly readable as a ranged attacker.
- **The quiver (secondary identifier):** A small cylinder (Dark Brown `#6B4226`) mounted on the character's back, angled slightly so it peeks over one shoulder. Inside the top opening, place 3-4 tiny thin cuboids (Tan `#D2A86E` shafts with small triangular Grey `#7A7A7A` arrowheads) poking out at slight angles. The quiver and protruding arrow tips are visible from behind and from the isometric top-down view.
- **No heavy armor or shield:** Unlike the Knight, the Archer carries no shield and wears no steel. The leather-over-cloth silhouette is slimmer and more agile, clearly communicating a different combat role.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Use warm directional sunlight from above-left to catch the curved surface of the bow and highlight the leather cuirass against the green body beneath.
- A subtle cool ambient fill to give the forest green and dark green tones a rich, woodland depth.
- Present on a neutral ground plane — units are not shown with environmental context.
- The Archer should read as visually distinct from the Knight — where the Knight is bulky steel grey, the Archer is slim forest green and brown. From the isometric game camera, the pointed hood silhouette and the tall vertical bow are the two shapes that identify this unit instantly.
- The arrow tips poking from the quiver add a small but important detail that reinforces the ranged-combat identity even when the bow is not visible.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
