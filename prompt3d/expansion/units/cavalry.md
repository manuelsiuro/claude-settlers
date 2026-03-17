# Cavalry — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Cavalry"** character in a low-poly 3D style.

The Cavalry is a **mounted military unit** — the most powerful and fastest combat unit in the game. A Cavalry unit is created when a serf delivers a Horse, Sword, and Shield to a military building with an empty slot. With 1.8x movement speed, 1.0x Knight HP, and 1.3x Knight attack (plus a charge bonus), the Cavalry dominates open-field engagements. The character is a fully armored knight mounted on a horse — the tallest and widest unit in the game, with an unmistakable combined silhouette.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the character. The final look should be powerful, imposing, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Rider Armor** — Steel (`#7A7A7A`)
- **Rider Skin** — Light Peach (`#F5D5B8`)
- **Horse Body** — Chestnut (`#A0522D`)
- **Saddle** — Brown (`#8B5E3C`)
- **Shield** — Faction Blue (`#3366AA`)
- **Sword Blade** — Grey (`#9A9A9A`)
- **Cape** — Red (`#C0392B`)
- **Horse Mane** — Dark Brown (`#5C3A1E`)

---

## 2. BASE MODEL & PROPORTIONS

Explain step-by-step how to model the Cavalry unit. This is a **composite model** — a rider mounted on a horse. Do not start from the standard serf base; build both the horse and rider as a single unified asset:

- **The horse body:** An oblong cylinder or rounded cuboid (Chestnut `#A0522D`), oriented horizontally. The body should be approximately 2x as long as it is tall, giving a sturdy, barrel-chested look. Round the front and back faces slightly by beveling edges for an organic feel.
- **The horse legs:** Four short, straight cylinders (Chestnut) extending downward from the body's underside — two near the front, two near the rear. Keep them simple and blocky. Each leg ends in a very small, slightly darker cuboid as a hoof (Dark `#4A3520`).
- **The horse head:** A smaller cylinder or tapered cuboid (Chestnut) extending forward and slightly upward from the front of the body. Add a small cone or pointed cuboid for the muzzle. Place two tiny sphere or flat-diamond shapes on the sides as ears. Add two small black spheres (`#2A2A2A`) for eyes.
- **The horse mane:** A series of small, thin triangular extrusions or a single flat ribbon shape (Dark Brown `#5C3A1E`) running along the top of the neck from head to where the rider sits. Keep it jagged and stylized.
- **The horse tail:** A thin cylinder or flattened cuboid (Dark Brown) hanging from the rear of the body, angled slightly downward.
- **The rider body:** A smaller upright cylinder (Steel `#7A7A7A`) placed on top of the horse's back, centered between the front and rear legs. The rider is approximately 60% the height of the horse body width, keeping proportions squat and chunky. A small cuboid (Brown `#8B5E3C`) beneath the rider represents the saddle.
- **The rider head:** A sphere (Steel `#7A7A7A`) placed on top of the rider body, representing a helmeted head. Slightly smaller than a foot-soldier Knight's head to maintain proportional scale with the horse.

---

## 3. PROFESSION-SPECIFIC FEATURES

Describe how to model the Cavalry's distinguishing elements:

- **The sword (co-primary identifier):** A long, thin, flat cuboid blade (Grey `#9A9A9A`) held in the rider's right hand, extending outward and slightly forward. Add a small cuboid crossguard and short cylinder hilt. The blade should be approximately 80% of the rider body height — sized to strike downward from horseback.
- **The shield (co-primary identifier):** A flat circular disc or rounded square (Faction Blue `#3366AA`) attached to the rider's left arm. Approximately 40% of the rider body height. The blue will be replaced at runtime with the player's faction color, so keep the surface large and flat for good color readability.
- **The cape (secondary identifier):** A flat cuboid or thin wedge shape (Red `#C0392B`) attached to the rider's back at shoulder level, angling downward and slightly outward as if billowing behind. The cape drapes over the horse's hindquarters. This flowing red accent adds drama and helps identify the unit from behind.
- **The saddle and harness:** A small flat cuboid (Brown `#8B5E3C`) visible between the rider and the horse's back. Optionally add thin cylinder straps running down the horse's sides to suggest a girth strap.
- **Overall silhouette:** The combined horse-and-rider model should be roughly 2x the width and 1.5x the height of a standard foot Knight. This massive silhouette is the single most important visual cue — the Cavalry must be instantly recognizable as a mounted unit from any angle at the isometric camera distance.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Use warm directional sunlight from above-left to highlight the steel armor on the rider and catch the chestnut horse body with a rich, warm sheen.
- A subtle cool ambient fill to give the steel helmet and sword a slightly blue-metallic quality.
- Present on a neutral ground plane — units are not shown with environmental context.
- The Cavalry should dominate visually through sheer size. From the isometric game camera, the wide horizontal horse body with the vertical rider on top creates a cross-shaped silhouette that no other unit shares.
- The red cape and faction-colored shield provide bright accent points that help the player track this high-value unit in the chaos of battle.
- The sword extending outward from the rider breaks the vertical symmetry and communicates offensive intent.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
