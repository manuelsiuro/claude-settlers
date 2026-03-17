# Large House — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Large House"** in a low-poly 3D style.

The Large House is a **housing building** (Tier 3) — a grand stone manor that shelters up to 25 settlers. It represents the pinnacle of civilian architecture in the settlement, built with expensive materials including Iron Bars for structural reinforcement. The Large House should exude prosperity and permanence — pale stone walls, a steep dark roof with dormers, arched windows, and iron detailing. Think minor nobility's townhouse or a wealthy merchant's estate.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the scene. The final look should be prosperous, grand, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Stone walls** — Light Stone (`#D0C8B0`)
- **Roof** — Dark Roof (`#3A3520`)
- **Iron fence and details** — Iron Grey (`#4A4A4A`)
- **Window glow** — Window Glow (`#FFD080`)
- **Wood trim and doors** — Rich Brown (`#6B4226`)
- **Decorative accents** — Gold Accent (`#DAA520`)
- **Foundation and chimney** — Stone Grey (`#8A8A7A`)
- **Ivy and hedges** — Green Ivy (`#4A8C3F`)

---

## 2. CORE STRUCTURE & GEOMETRY

Explain step-by-step how to model the Large House. Include descriptions of the shapes and primitive meshes to use for:

- **The main building body:** A large, wide cuboid or L-shaped footprint (Light Stone) — significantly bigger than both the Small and Medium houses. If L-shaped, model two intersecting cuboids: a larger main wing and a shorter perpendicular wing. The stone color should feel clean and refined compared to the rustic timber of lesser houses. The walls should suggest masonry — use the flat, uniform Light Stone color across all faces for a dressed-stone appearance.
- **The multi-story height:** 2–3 stories tall. Model each floor with a subtle horizontal ledge (a thin flat cuboid strip in Stone Grey) running around the perimeter between floors, acting as a string course that breaks up the tall facade and adds classical architectural detail.
- **The steep dark roof:** A tall, steep pitched roof (Dark Roof) — darker and more imposing than the lower-tier houses. For the L-shaped variant, the two wings have intersecting roof ridges that create a complex roofline. Add 1–2 dormer windows: small cuboid protrusions from the roof slope, each with its own tiny pitched roof and a small window with Window Glow.
- **Arched windows:** Multiple windows per floor, each taller than those on simpler houses. Model arched tops by placing a half-cylinder (Light Stone) above each rectangular opening, or by beveling the top edge of each window recess into a curve. Use cross-mullion dividers (Rich Brown) with Window Glow planes behind.
- **The entrance:** A prominent front entrance with a small portico — two thin cylinder columns (Light Stone) supporting a triangular pediment (a flat triangular shape in Stone Grey) above the door. The door itself is a tall, wide cuboid (Rich Brown) with a gold-colored knocker (a tiny torus in Gold Accent).

---

## 3. PROPS AND ENVIRONMENT DETAILS

Describe how to model the key large house elements to tell a story. Break down the modeling steps for:

- **Iron gate and fence:** A short iron fence (Iron Grey) made of thin vertical cylinder bars with pointed cone tips, connected by horizontal rails, running along the front of the property. Include a central gate — two fence panels that swing open, with decorative curled tops (small torus quarter-sections). The iron fence immediately signals wealth and refinement.
- **Large stone chimney:** A tall, wide square cuboid chimney (Stone Grey) rising from the main roof ridge. Crown it with a decorative cap — a slightly wider flat cuboid with a smaller cuboid on top. This chimney is a statement piece, visible from across the settlement.
- **Carved doorframe:** The portico columns and pediment described above. Add small rectangular cuboid blocks (Stone Grey) flanking the door at ground level — decorative bases for the columns. A small flat cuboid step (Stone Grey) leads up to the raised entrance.
- **Multiple window styles:** Ground-floor windows are tall and arched (as described). Upper-floor windows are slightly smaller. Dormer windows in the roof are smallest. This hierarchy of window sizes adds visual richness and architectural logic.
- **Small garden with hedge:** A low, continuous cuboid hedge (Green Ivy) running along the inside of the iron fence, trimmed into a neat rectangular form. Behind the hedge, a tiny garden patch with small colorful flower cones. A formal, manicured look befitting the house.
- **Lanterns at entrance:** Two small lantern props (Rich Brown cuboid frames with Window Glow cubes inside) mounted on the walls flanking the front door — or atop the fence gate posts. These suggest evening elegance.
- **Coat of arms:** A small flat rectangular cuboid (Gold Accent border with a colored interior — deep red or blue) mounted above the front door or on the pediment. A simple heraldic suggestion: a colored rectangle with a tiny geometric shape (diamond, cross, or chevron) inset. This detail elevates the building from "large house" to "manor."
- **Ivy creep:** Several small irregular shapes (Green Ivy) applied flat against one side wall, climbing from the foundation partway up — trailing ivy softens the stone and adds age and character. Model as small flat irregular polygons or clusters of tiny cuboids pressed against the wall surface.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Cool-warm balanced directional light — the Light Stone walls should feel clean and luminous, not overly warm. A slightly cooler main light enhances the stone's refined quality while the Window Glow provides warm counterpoint.
- Multiple Window Glow sources across the facade should create a stately pattern of warm amber rectangles — the manor is well-lit inside, suggesting comfort and abundance.
- A soft ambient fill to ensure the Dark Roof and Iron Grey details remain visible and don't collapse into shadow. The roof dormers and chimney silhouette against the sky are important shape reads.
- Present from an isometric orthographic camera angle — the L-shaped footprint (if used) should be oriented so both wings are visible. The iron fence, portico entrance, and hedge garden should face the camera. The building's imposing height should be apparent.
- The Gold Accent details (door knocker, coat of arms) should catch the light and provide tiny sparks of warmth against the cool stone — small but meaningful touches of wealth.
- The overall atmosphere should feel stately and permanent — this building has stood for generations and will stand for generations more. It should visually anchor the settlement's residential district.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
