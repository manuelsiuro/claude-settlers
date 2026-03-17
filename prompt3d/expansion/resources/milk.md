# Milk — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Milk"** resource in a low-poly 3D style.

Milk is fresh dairy produced at the Dairy Farm, where a Dairymaid tends cows and collects milk into jugs. It is transported to the Cheese Maker, where it is processed into Cheese — a high-satiation food that sustains the settlement's workforce.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the resource model. The final look should be clean, pastoral, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Jug body** — Jug White (`#F0F0F0`)
- **Handle and rim** — Handle Brown (`#A0724A`)
- **Milk surface** — Milk White (`#FAFAFA`)
- **Jug shadow/base** — Soft Grey (`#D8D0C0`)
- **Accent band** — Warm Cream (`#F5E8D0`)

---

## 2. SHAPE & GEOMETRY

Explain step-by-step how to model the Milk. Include descriptions of the shapes and primitive meshes to use for:

- **Primary shape:** A small jug or pail — start with a cylinder (8 sides for low-poly faceting) that is slightly wider at the bottom and tapers inward toward the top. Select the top edge loop and scale it down to about 75-80% of the base diameter, creating a gentle taper. The top should be open, with a visible Milk White disc inside representing the milk surface sitting just below the rim.
- **Handle:** A curved arch made from a torus segment or a bent thin cylinder (Handle Brown) attached from the rim on one side, arcing up and over, and reconnecting on the opposite side. Keep it chunky and low-poly — 4-6 segments for the curve is plenty. The handle is the key shape element that says "pail" rather than just "cylinder."
- **Rim:** A slightly wider ring or torus (Handle Brown) around the top opening, giving the jug a defined lip. This small detail adds a lot of character.
- **Scale:** Small enough for a serf to carry by the handle in one hand — about the height of a serf's forearm. The proportions should be slightly squat (wider than tall) for a sturdy farmstead feel.
- **Arrangement:** When stockpiled, 3-4 milk pails cluster together with handles facing outward in different directions. The white surfaces and visible milk tops create a bright, clean grouping that stands out against darker ground.

---

## 3. VISUAL IDENTITY & CONTEXT

Describe what makes this resource visually distinct:

- **Distinguish from:** Flour (milk is a jug/pail shape with a visible handle and open top showing liquid, while flour is a closed, rounded sack shape with a tied top). The handle and the white-on-white color scheme are the key differentiators.
- **Silhouette:** From the isometric camera, the milk pail reads as a tapered cylinder with an arching handle rising above it — the handle's arc is the strongest silhouette element and should be clearly visible even at distance.
- **Stockpile appearance:** A group of milk pails is one of the brightest resource piles in the game — the white ceramic/enamel color stands out sharply against the earth tones of roads and terrain. The handles poking up at various angles add visual interest.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Bright, even lighting to make the white jug surfaces glow cleanly. The Jug White should appear luminous without being washed out — a soft warm directional light works well.
- The Handle Brown provides essential contrast against the white body. Ensure the handle catches enough light to read clearly as a separate element.
- At game scale, the bright white color is the primary identifier — milk pails are among the lightest-colored resources in the game and should be instantly recognizable by their brightness and the distinctive handle silhouette.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
