# Horse (Transport) — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Horse (Transport)"** in a low-poly 3D style.

The Horse is a **transport animal** — bred at the Stable, it can be assigned to the road network to carry up to 5 items between flags. Faster than the donkey but with a shorter lifespan, the transport horse is distinguished from cavalry horses by the attached cart. It should look strong, graceful, and purpose-built for hauling goods.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the model. The final look should be strong, graceful, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Body** — Chestnut Brown (`#A0522D`)
- **Mane and tail** — Dark Brown (`#5C3A1E`)
- **Cart wood** — Warm Brown (`#A0724A`)
- **Wheels** — Grey (`#7A7A7A`)
- **Blanket** — Blue (`#3366AA`)
- **Hooves** — Dark Brown (`#4A3520`)
- **Harness straps** — Harness Brown (`#8B5E3C`)
- **Eyes** — Black (`#2A2A2A`)

---

## 2. BASE MODEL & PROPORTIONS

Explain step-by-step how to model the Horse (Transport), including the animal body and its cart attachment:

- **The body:** A horizontal oblong cylinder or rounded cuboid (Chestnut Brown) — longer and sleeker than the donkey. The horse body should be about 2× as long as it is tall, conveying power and speed.
- **The legs:** Four tall cylindrical legs (Chestnut Brown), positioned at the corners of the body. Taller and thinner than the donkey's stubby legs — these are legs built for speed. Tiny dark cuboids at the bottom for hooves (Dark Brown).
- **The head:** A tapered cylinder or cone shape (Chestnut Brown) extending forward from the body on a short neck cylinder. Two small triangular ears on top. Small black sphere eyes on each side.
- **The mane:** A series of small, thin flat planes or a ridge shape (Dark Brown) running along the top of the neck from head to shoulders — the flowing mane that distinguishes horses from donkeys.
- **The tail:** A thin cylinder or tapered cone (Dark Brown) extending from the rear, slightly curved downward — longer and more flowing than the donkey's short tail.

---

## 3. PROFESSION-SPECIFIC FEATURES

Describe the transport-specific elements that distinguish this horse from a cavalry mount:

- **The cart (primary identifier):** A small wooden platform (Warm Brown flat cuboid) mounted on two circular wheels (Grey torus or disc shapes). The cart connects to the horse via two thin wooden shafts (Brown cylinders) running from the cart to either side of the horse's hindquarters. The cart platform is flat, sized to hold cargo items. This is the single most important visual distinction — cavalry horses have a rider, transport horses have a cart.
- **The harness:** Visible leather straps (Harness Brown) running across the horse's chest and around the body, connecting to the cart shafts. Model as thin flat cuboids laid against the body surface.
- **The blanket:** A blue blanket (Blue) draped over the horse's back, between the mane and the cart connection point. A flat cuboid slightly wider than the body, adding color and distinguishing from the brown horse.
- **No rider:** Crucially, no humanoid figure on top. The horse walks the road network autonomously (in-game, it follows transporter logic).

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Warm directional sunlight from above-left to highlight the chestnut coat and bring out the wood tones of the cart.
- The blue blanket should provide a clear color accent against the warm browns, making the horse identifiable at a glance.
- Present on a neutral ground plane — the horse + cart combination should read as a single connected unit from the isometric camera.
- The overall silhouette (horse body + trailing cart with wheels) should be the longest unit in the game, immediately distinguishable from all other units.
- The cart wheels should catch light to be visible, confirming this is a transport animal and not a cavalry mount.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
