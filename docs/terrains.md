# Terrain Descriptions for Three.js Game (Basic Shapes)

This document outlines visual descriptions for various terrain types using basic geometric shapes suitable for a Three.js game with a stylized, low-poly aesthetic.

---

### 1. Grassland

-   **Overall Mood/Atmosphere:** Open, vast, fertile, peaceful, gentle rolling.
-   **Visual Description:**
    -   **Ground Plane:** Large, flat or slightly undulating `PlaneGeometry` (colors: various shades of Green, e.g., `#7CFC00` (LawnGreen), `#90EE90` (LightGreen)). Can be made of multiple connected planes for variation.
    -   **Gentle Hills:** Low, wide, smooth mounds created from scaled `SphereGeometry` (using only the top half or squashing it) or very wide, low `CylinderGeometry` or `ConeGeometry` (colors: slightly darker or varied Green, e.g., `#228B22` (ForestGreen)).
    -   **Occasional Rocks/Bushes (Optional):** Small, sparsely scattered `BoxGeometry` (cubes) or low `SphereGeometry` (colors: Grey for rocks `#808080`, Dark Green for bushes `#006400`).
-   **Arrangement & Density:** Expansive, generally low height. Hills should be sparsely placed. Ground plane can be very large.
-   **Key Distinguishing Features (using basic shapes):** The vastness of the green plane(s) and the gentle rise and fall of low, smooth hills.
-   **Key Colors:** LawnGreen (`#7CFC00`), LightGreen (`#90EE90`), ForestGreen (`#228B22`), Grey (`#808080`).

---

### 2. Forest

-   **Overall Mood/Atmosphere:** Dense, enclosed, shaded, potentially mysterious or ancient.
-   **Visual Description:**
    -   **Ground Plane:** `PlaneGeometry`, can be uneven or sloped (colors: Dark Green `#006400`, Brown `#A52A2A`).
    -   **Tree Trunks:** Tall, thin `CylinderGeometry` (colors: various Browns, e.g., `#8B4513` (SaddleBrown), `#A0522D` (Sienna)).
    -   **Tree Canopy/Leaves:**
        -   Option 1 (Simple): `SphereGeometry` or `BoxGeometry` (cuboid) placed atop trunks (colors: various Greens, e.g., `#2E8B57` (SeaGreen), `#008000` (Green)).
        -   Option 2 (Slightly more complex): Clusters of smaller `SphereGeometry` or `BoxGeometry` to form a more irregular canopy.
        -   Option 3 (Coniferous): Tall, thin `ConeGeometry` (colors: Dark Green `#013220`).
    -   **Bushes/Undergrowth:** Smaller `SphereGeometry` or low `BoxGeometry` at the base of trees or scattered (colors: Dark Green `#006400`, Olive `#808000`).
-   **Arrangement & Density:** Dominated by vertical elements (trees). Can range from sparse woodland to dense forest where canopies nearly touch. Trunks should be relatively close.
-   **Key Distinguishing Features (using basic shapes):** The density of vertical cylinders (trunks) topped with green spheres/cubes/cones (canopy).
-   **Key Colors:** SaddleBrown (`#8B4513`), SeaGreen (`#2E8B57`), Dark Green (`#006400`), Brown (`#A52A2A`).

---

### 3. Mountain

-   **Overall Mood/Atmosphere:** Imposing, rugged, majestic, challenging, barren at peaks.
-   **Visual Description:**
    -   **Peaks & Ridges:** Tall `ConeGeometry` or sharply angled, stacked/intersecting `BoxGeometry` (cuboids/prisms) to create jagged silhouettes (colors: Grey `#808080`, Dark Grey `#A9A9A9`).
    -   **Snow Caps (Optional):** Smaller `ConeGeometry` or white-textured cap on the top part of peak shapes (color: White `#FFFFFF`).
    -   **Slopes/Base:** Larger, wider `ConeGeometry` or angled `PlaneGeometry` connecting peaks to the ground or forming foothills (colors: Grey `#808080`, Brownish-Grey `#5D5D5D`).
    -   **Boulders/Scree:** Irregularly scaled `BoxGeometry` (cubes) or `SphereGeometry` scattered on slopes or at the base (colors: Dark Grey `#696969`).
-   **Arrangement & Density:** Significant height variation. Peaks can be clustered to form ranges or stand as solitary sentinels. Slopes are generally steep.
-   **Key Distinguishing Features (using basic shapes):** Tall, pointed cones or jagged arrangements of cubes representing sharp peaks, often in greys and whites.
-   **Key Colors:** Grey (`#808080`), Dark Grey (`#A9A9A9`), White (`#FFFFFF`), Brownish-Grey (`#5D5D5D`).

---

### 4. Water

-   **Overall Mood/Atmosphere:** Calm, vast, reflective, deep, serene (for lakes/oceans) or flowing (for rivers).
-   **Visual Description:**
    -   **Surface (Lake/Ocean):** Large, flat `PlaneGeometry` (colors: various Blues, e.g., `#0000FF` (Blue), `#ADD8E6` (LightBlue), `#40E0D0` (Turquoise)). Transparency can be used.
    -   **Surface (River):** Elongated, possibly winding `PlaneGeometry`.
    -   **Waves (Optional, subtle):** Very low, elongated half-`CylinderGeometry` or slightly undulating `PlaneGeometry` on the surface (colors: slightly lighter Blue or White `#FFFFFF` for crests).
    -   **Shoreline/Banks:** The edge where the water plane meets other terrain planes.
    -   **Depth (Implied):** Could use a darker blue plane underneath the main surface, or a color gradient if supported.
-   **Arrangement & Density:** Primarily a horizontal element. Can be vast (ocean), contained (lake), or linear (river).
-   **Key Distinguishing Features (using basic shapes):** A large, flat plane with blue hues. Optional subtle wave forms.
-   **Key Colors:** Blue (`#0000FF`), LightBlue (`#ADD8E6`), Turquoise (`#40E0D0`), DarkBlue (`#00008B`).

---

### 5. Desert

-   **Overall Mood/Atmosphere:** Arid, expansive, hot, sparse, desolate.
-   **Visual Description:**
    -   **Sand Dunes:** Undulating series of wide, low mounds. Can be achieved with smoothly connected `PlaneGeometry` segments, scaled `SphereGeometry` (top halves), or very wide, low `CylinderGeometry` (colors: Sandy Yellow `#F4A460`, Light Brown `#D2B48C`, Orange-Tan `#E4A672`).
    -   **Flat Desert Floor:** Large `PlaneGeometry` for areas between dunes or for flat desert expanses (colors: Beige `#F5F5DC`, Sandy Yellow `#F4A460`).
    -   **Cacti (Optional):**
        -   **Main Body:** Tall, thin `CylinderGeometry` or `BoxGeometry` (color: Green `#228B22`).
        -   **Arms:** Smaller `CylinderGeometry` or `BoxGeometry` attached to the main body, often angled upwards (color: Green `#228B22`).
    -   **Rocks/Boulders:** Scattered `BoxGeometry` (cubes) or `SphereGeometry` (colors: Brown `#A52A2A`, Grey `#808080`).
-   **Arrangement & Density:** Expansive, can have rolling low-relief (dunes) or be very flat. Vegetation (cacti) and rocks are sparse.
-   **Key Distinguishing Features (using basic shapes):** Undulating planes or sphere-segments for dunes in yellows and browns. Sparse green cylinders/boxes for cacti.
-   **Key Colors:** Sandy Yellow (`#F4A460`), Light Brown (`#D2B48C`), Beige (`#F5F5DC`), Green (`#228B22` for cacti).

---
```