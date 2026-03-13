# Sawmill — 3D Modeling Prompt

Act as an expert 3D artist and instructor specializing in low-poly modeling and stylized game art. Your task is to provide a comprehensive, step-by-step guide on how to model a stylized **"Sawmill"** in a low-poly 3D style using software like Blender or Maya.

The Sawmill is a **resource processing building** — it converts Wood (Logs) into Planks. It is one of the most essential early-game buildings, enabling construction of advanced structures. Visually, it should feature an open-sided processing area where logs enter on one side and planks emerge from the other, with an animated saw blade.

**Runtime effects:** Wood chip particles (tan, 8/s) when producing. Saw blade oscillates `rotation.x = sin(t * 6.0) * 0.5` when active.

Please provide a structured, detailed explanation covering the geometry, specific shapes, and color palettes for each part of the scene. The final look should be industrious, workshop-like, and characteristic of a classic fantasy low-poly aesthetic (flat shading, distinct geometric shapes, no complex textures).

---

## 1. THE COLOR PALETTE

Provide a specific low-poly color palette with exact HEX codes for:

- **Main building walls** — Brown (`#8B5E3C`)
- **Roof** — Dark Brown (`#5C3A1E`)
- **Raw logs (input)** — Light Brown / Tan (`#C4A56E`)
- **Finished planks (output)** — Pale Yellow-Brown (`#DCC8A0`)
- **Saw blade** — Steel Grey (`#7A7A7A`)
- **Support beams** — Warm Brown (`#A0724A`)
- **Wood chips** — Tan (`#D2B48C`)
- **Ground/sawdust** — Light Tan (`#E0D0B0`)
- **Foundation** — Earthy Brown (`#6B4226`)

---

## 2. CORE STRUCTURE & GEOMETRY

Explain step-by-step how to model the Sawmill. Include descriptions of the shapes and primitive meshes to use for:

- **The main building:** A medium-sized cuboid (Brown). Bigger than the Woodcutter's Hut — this is a proper workshop.
- **The roof:** A sloped cuboid roof (Dark Brown) — a simple two-plane pitched shape with overhang.
- **The processing extension:** An open-sided extension or slightly lower, longer cuboid attached to one side of the main building. This is the sawing area — it has support beam posts but no walls, so the saw mechanism is visible. Logs (cylinders) are placed at one end, and planks (thin cuboids) emerge at the other.
- **The saw blade:** A thin disc (cylinder with minimal height) or a flat circular shape (Steel Grey) positioned vertically in the processing area. This will be animated — it oscillates when the building is producing. Make it prominent and clearly visible.
- **Support beam posts:** Thin vertical cuboids (Warm Brown) holding up the open-sided extension's roof.

---

## 3. PROPS AND ENVIRONMENT DETAILS

Describe how to model the key sawmill elements to tell a story. Break down the modeling steps for:

- **Raw logs (input side):** 2–3 horizontal cylinders (Light Brown/Tan) stacked at one end of the processing area — these are the Wood (Logs) waiting to be cut.
- **Finished planks (output side):** A small stack of thin, flat cuboids (Pale Yellow-Brown) at the other end — sawn planks ready for transport.
- **Wood chips and sawdust:** Tiny scattered cubes and flat shapes (Tan) covering the ground around the saw area — evidence of active production. These match the particle effects that emit during production.
- **A log on the saw:** One cylinder positioned on the saw table, half-cut, with the saw blade intersecting it.
- **Sawdust pile:** A small mound shape (Light Tan) beneath the saw blade where shavings accumulate.
- **A workbench:** A flat cuboid table near the building with small tool shapes on it.
- **Stacked timber:** A neat pile of logs on one side and planks on the other, showing the before/after of the production chain.
- **Ground treatment:** The entire ground around the sawmill should be covered in Light Tan sawdust, distinguishing it from natural grass.

---

## 4. LIGHTING AND PRESENTATION

Briefly suggest a lighting setup to make the flat-shaded low-poly colors pop:

- Warm directional sunlight from the side to illuminate the open processing area and make the saw blade gleam.
- The open-sided extension should be well-lit to showcase the logs-to-planks process.
- A subtle warm ambient fill to enhance the woody, brown palette.
- The saw blade should catch a highlight — it's the visual centerpiece and the animated element.
- Present from an isometric orthographic camera angle — the open processing area should face the camera so the production chain (logs → saw → planks) reads left-to-right or diagonally.
- The overall feel should be busy and productive — sawdust everywhere, wood in various stages of processing.

Make your instructions easy to follow, highly descriptive regarding the 3D shapes (e.g., "extrude," "bevel," "scale down the top face," "icosphere"), and inspiring!
