# Donkey — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Donkey"** character in a low-poly 3D style.

The Donkey is a **transport animal** — a small, sturdy beast of burden used to carry goods between buildings. With a speed of 0.45 and a carry capacity of 3 items, the Donkey is slower but more economical than a Horse Transport. It has a lifespan of 20 minutes and requires Hay or Grain as feed. The Donkey is NOT a serf or human unit — it is an animal model built from scratch. The character should look small, stocky, and hardworking, with oversized ears as its signature feature and saddlebags slung across its back.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the character. The final look should be sturdy, charming, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Body** — Grey-Brown (`#8A7A6A`)
- **Muzzle / Belly** — Light Cream (`#C4B8A0`)
- **Ears** — Dark Grey-Brown (`#6B5A4A`)
- **Saddlebag** — Brown (`#8B5E3C`)
- **Blanket** — Red (`#C0392B`)
- **Hooves** — Dark Brown (`#4A3520`)
- **Eyes** — Black (`#2A2A2A`)

---

## 2. BASE MODEL & PROPORTIONS

Explain step-by-step how to model the Donkey as a standalone animal — this is NOT based on the serf model:

- **The body:** A horizontal oblong cylinder or rounded cuboid (Grey-Brown `#8A7A6A`), oriented lengthwise. The body should be approximately 1.5x as long as it is tall — sturdy and barrel-shaped. Bevel the front and rear faces slightly for an organic, rounded feel. The donkey's body should be noticeably shorter and stockier than a horse — about 70% the length and 85% the height of the Horse Transport model.
- **The legs:** Four short, straight cylinders (Grey-Brown) extending downward from the body's underside — two near the front shoulders, two near the rear haunches. Keep them simple and blocky, shorter than a horse's legs to emphasize the donkey's low, compact build. Each leg ends with a very small cuboid or flattened cylinder (Dark Brown `#4A3520`) as a hoof.
- **The head:** A smaller cylinder or slightly tapered cuboid (Grey-Brown) extending forward and slightly upward from the front of the body at about a 30-degree upward angle. The head should be about 40% of the body length. Add a blunt cone or rounded cuboid at the front as the muzzle (Light Cream `#C4B8A0`) — the lighter muzzle color helps define the face.
- **The ears (signature feature):** Two tall, flat cone shapes (Dark Grey-Brown `#6B5A4A`) rising from the top of the head, angled slightly outward in a "V" formation. The ears should be prominently oversized — each ear approximately 60-70% of the head height. These large pointed ears are the single most important feature that identifies this animal as a donkey rather than a horse. Make them tall, pointy, and unmissable.
- **The tail:** A thin, short cylinder (Grey-Brown) hanging from the rear of the body, angled slightly downward. Optionally add a tiny tuft (a small sphere or flattened cuboid of slightly darker color) at the tip to suggest a donkey's tufted tail.
- **The eyes:** Two tiny spheres (Black `#2A2A2A`) placed on either side of the head, near the front where the head meets the ears.

---

## 3. PROFESSION-SPECIFIC FEATURES

Describe how to model the Donkey's load-carrying equipment:

- **The blanket (base layer):** A thin, flat cuboid (Red `#C0392B`) draped over the donkey's back, centered on the body. The blanket should be slightly wider than the body on each side (about 110% body width) and cover roughly the middle 50% of the body length. The red color provides a bright accent that makes the donkey visually interesting and helps it stand out against terrain.
- **The saddlebags (primary identifier):** Two small cuboids or rounded boxes (Brown `#8B5E3C`) hanging on either side of the body, resting on top of the red blanket. Each saddlebag should be approximately 30% of the body height and 25% of the body length. Position them symmetrically so they hang evenly. The top of each bag sits at the level of the donkey's back; the bottom hangs down to about the midpoint of the legs. These paired brown pouches are the key visual element that communicates "transport animal."
- **The harness straps (optional detail):** Thin cylinders or narrow cuboids (Brown, slightly darker than the saddlebags) running from the saddlebags over the back and under the belly, suggesting the straps that hold everything in place. This is a subtle detail but adds believability.
- **No rider:** The donkey is never ridden — it walks on its own carrying goods. The saddlebags should look naturally loaded, not like a saddle for mounting.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Use warm directional sunlight from above-left to define the rounded barrel shape of the body and catch the tall pointed ears with clear silhouette definition.
- A subtle warm ambient fill to keep the grey-brown tones from looking too flat or muddy — the body should read as a warm, living animal rather than a grey rock.
- Present on a neutral ground plane — units are not shown with environmental context.
- The Donkey should read as clearly smaller and stockier than the Horse Transport — if both are on screen, the size difference must be obvious. From the isometric game camera, the two tall pointed ears rising above the body are the instant identification feature.
- The red blanket provides the brightest color accent, drawing the eye to the center of the model where the saddlebags communicate the transport function.
- The light cream muzzle against the grey-brown head helps define the face and gives the donkey a charming, approachable expression.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
