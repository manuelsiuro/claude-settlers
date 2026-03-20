"""
Generate all expansion 3D models for Feudal Realm Manager.
Run this script inside Blender: File > Open > scripting tab, or via command line:
  blender --background --python scripts/generate_expansion_models.py

Creates GLB files for 22 buildings, 20 units, and 17 resources.
Low-poly stylized aesthetic matching existing game assets.
"""

import bpy
import os
import math

# ── Export paths ─────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILDING_DIR = os.path.join(BASE_DIR, "public", "models", "buildings")
UNIT_DIR = os.path.join(BASE_DIR, "public", "models", "units")
RESOURCE_DIR = os.path.join(BASE_DIR, "public", "models", "resources")

for d in [BUILDING_DIR, UNIT_DIR, RESOURCE_DIR]:
    os.makedirs(d, exist_ok=True)

# ── Helpers ──────────────────────────────────────────────────────────────────

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)

def make_mat(name, rgb, roughness=0.8):
    """Create a material with given RGB (0-255 ints)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (rgb[0]/255, rgb[1]/255, rgb[2]/255, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat

def add_cube(name, loc, scale, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    return obj

def add_cylinder(name, loc, radius, depth, mat, verts=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj

def add_cone(name, loc, r1, r2, depth, mat, verts=4):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj

def add_sphere(name, loc, radius, mat, segments=8, rings=6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj

def export_glb(filepath):
    bpy.ops.export_scene.gltf(filepath=filepath, export_format='GLB', use_selection=False)
    size_kb = os.path.getsize(filepath) / 1024
    print(f"  Exported: {os.path.basename(filepath)} ({size_kb:.1f} KB)")

# ── BUILDING MODELS ──────────────────────────────────────────────────────────

def build_well():
    clear_scene()
    stone = make_mat("stone", (140, 140, 140))
    stone_dark = make_mat("stone_dark", (100, 100, 100))
    wood = make_mat("wood", (139, 90, 43))
    roof_mat = make_mat("roof", (150, 80, 50))

    add_cylinder("base", (0,0,0.075), 0.18, 0.15, stone, 8)
    add_cylinder("rim", (0,0,0.165), 0.2, 0.03, stone_dark, 8)
    add_cube("post_l", (-0.15,0,0.3), (0.02,0.02,0.15), wood)
    add_cube("post_r", (0.15,0,0.3), (0.02,0.02,0.15), wood)
    add_cube("beam", (0,0,0.42), (0.2,0.02,0.02), wood)
    add_cone("roof", (0,0,0.48), 0.16, 0.02, 0.08, roof_mat, 4)
    add_cylinder("bucket", (0,0,0.25), 0.03, 0.04, wood, 8)
    export_glb(os.path.join(BUILDING_DIR, "well.glb"))

def build_orchard():
    clear_scene()
    wood = make_mat("wood", (139, 90, 43))
    green = make_mat("green", (60, 140, 50))
    roof = make_mat("roof", (120, 80, 40))
    fruit_mat = make_mat("fruit", (220, 80, 30))

    add_cube("base", (0,0,0.06), (0.2,0.18,0.06), wood)
    add_cube("walls", (0,0,0.17), (0.17,0.15,0.08), wood)
    add_cone("roof", (0,0,0.28), 0.22, 0.02, 0.1, roof, 4)
    # Trees
    add_cylinder("trunk1", (0.3,0.1,0.1), 0.02, 0.2, wood, 6)
    add_sphere("canopy1", (0.3,0.1,0.25), 0.1, green)
    add_sphere("fruit1", (0.35,0.1,0.22), 0.02, fruit_mat)
    add_cylinder("trunk2", (-0.25,-0.15,0.08), 0.02, 0.16, wood, 6)
    add_sphere("canopy2", (-0.25,-0.15,0.2), 0.08, green)
    export_glb(os.path.join(BUILDING_DIR, "orchard.glb"))

def build_vineyard():
    clear_scene()
    wood = make_mat("wood", (139, 90, 43))
    vine = make_mat("vine", (50, 120, 40))
    grape = make_mat("grape", (100, 30, 120))
    roof = make_mat("roof", (120, 80, 40))

    add_cube("shed", (0,0,0.1), (0.15,0.12,0.1), wood)
    add_cone("roof", (0,0,0.22), 0.18, 0.02, 0.08, roof, 4)
    # Vine rows
    for i, x in enumerate([-0.25, 0.0, 0.25]):
        add_cube(f"post_{i}", (x, -0.2, 0.08), (0.01, 0.01, 0.08), wood)
        add_cube(f"vine_{i}", (x, -0.2, 0.14), (0.06, 0.01, 0.03), vine)
        if i % 2 == 0:
            add_sphere(f"grape_{i}", (x, -0.2, 0.11), 0.02, grape)
    export_glb(os.path.join(BUILDING_DIR, "vineyard.glb"))

def build_winery():
    clear_scene()
    stone = make_mat("stone", (160, 150, 130))
    wood = make_mat("wood", (139, 90, 43))
    roof = make_mat("roof", (100, 60, 35))
    barrel = make_mat("barrel", (120, 80, 40))

    add_cube("base", (0,0,0.1), (0.25,0.2,0.1), stone)
    add_cube("walls", (0,0,0.22), (0.22,0.17,0.08), wood)
    add_cone("roof", (0,0,0.32), 0.28, 0.02, 0.1, roof, 4)
    # Barrels outside
    add_cylinder("barrel1", (0.3,0,0.06), 0.05, 0.1, barrel, 8)
    add_cylinder("barrel2", (0.3,0.12,0.06), 0.05, 0.1, barrel, 8)
    export_glb(os.path.join(BUILDING_DIR, "winery.glb"))

def build_brewery():
    clear_scene()
    stone = make_mat("stone", (150, 140, 120))
    wood = make_mat("wood", (139, 90, 43))
    roof = make_mat("roof", (110, 70, 40))
    copper = make_mat("copper", (180, 120, 60), 0.4)
    chimney_mat = make_mat("chimney", (120, 110, 100))

    add_cube("base", (0,0,0.1), (0.25,0.2,0.1), stone)
    add_cube("walls", (0,0,0.22), (0.22,0.17,0.08), wood)
    add_cone("roof", (0,0,0.32), 0.28, 0.02, 0.1, roof, 4)
    # Copper vat
    add_cylinder("vat", (-0.12,0,0.3), 0.05, 0.08, copper, 8)
    # Chimney
    add_cube("chimney", (0.12,0.08,0.35), (0.03,0.03,0.08), chimney_mat)
    export_glb(os.path.join(BUILDING_DIR, "brewery.glb"))

def build_dairy_farm():
    clear_scene()
    wood = make_mat("wood", (150, 110, 60))
    roof = make_mat("roof", (130, 90, 50))
    white = make_mat("white", (230, 220, 200))
    fence = make_mat("fence", (160, 130, 80))

    add_cube("barn", (0,0,0.12), (0.25,0.2,0.12), wood)
    add_cone("roof", (0,0,0.26), 0.3, 0.02, 0.1, roof, 4)
    add_cube("door", (0,0.11,0.08), (0.06,0.01,0.06), white)
    # Fence pen
    for x in [-0.2, 0.2]:
        add_cube(f"fence_{x}", (x, -0.25, 0.04), (0.01, 0.12, 0.04), fence)
    add_cube("fence_back", (0, -0.35, 0.04), (0.2, 0.01, 0.04), fence)
    export_glb(os.path.join(BUILDING_DIR, "dairy_farm.glb"))

def build_cheese_maker():
    clear_scene()
    stone = make_mat("stone", (170, 160, 140))
    wood = make_mat("wood", (139, 90, 43))
    roof = make_mat("roof", (120, 85, 45))
    yellow = make_mat("cheese", (240, 200, 80))

    add_cube("base", (0,0,0.08), (0.2,0.18,0.08), stone)
    add_cube("walls", (0,0,0.19), (0.17,0.15,0.07), wood)
    add_cone("roof", (0,0,0.28), 0.22, 0.02, 0.08, roof, 4)
    # Cheese wheel decoration
    add_cylinder("cheese", (0.22,0,0.04), 0.04, 0.03, yellow, 8)
    export_glb(os.path.join(BUILDING_DIR, "cheese_maker_building.glb"))

def build_hayfield():
    clear_scene()
    wood = make_mat("wood", (139, 90, 43))
    hay = make_mat("hay", (200, 180, 80))
    roof = make_mat("roof", (180, 160, 70))

    add_cube("shed", (-0.15,0,0.08), (0.12,0.1,0.08), wood)
    add_cone("shed_roof", (-0.15,0,0.17), 0.15, 0.02, 0.06, roof, 4)
    # Hay bales
    add_cube("bale1", (0.15,0.1,0.05), (0.08,0.06,0.05), hay)
    add_cube("bale2", (0.15,-0.1,0.05), (0.08,0.06,0.05), hay)
    add_cube("bale3", (0.15,0,0.12), (0.07,0.05,0.04), hay)
    export_glb(os.path.join(BUILDING_DIR, "hayfield.glb"))

def build_tannery():
    clear_scene()
    stone = make_mat("stone", (140, 130, 115))
    wood = make_mat("wood", (120, 80, 40))
    roof = make_mat("roof", (100, 70, 40))
    leather = make_mat("leather", (140, 90, 55))

    add_cube("base", (0,0,0.1), (0.25,0.2,0.1), stone)
    add_cube("walls", (0,0,0.22), (0.22,0.17,0.08), wood)
    add_cone("roof", (0,0,0.32), 0.28, 0.02, 0.1, roof, 4)
    # Drying rack
    add_cube("rack_l", (0.3,-0.05,0.1), (0.01,0.01,0.1), wood)
    add_cube("rack_r", (0.3,0.05,0.1), (0.01,0.01,0.1), wood)
    add_cube("rack_bar", (0.3,0,0.18), (0.01,0.06,0.01), wood)
    add_cube("hide", (0.3,0,0.12), (0.005,0.05,0.06), leather)
    export_glb(os.path.join(BUILDING_DIR, "tannery.glb"))

def build_weavers_hut():
    clear_scene()
    wood = make_mat("wood", (150, 110, 65))
    roof = make_mat("roof", (130, 95, 55))
    cloth = make_mat("cloth", (120, 130, 180))

    add_cube("base", (0,0,0.08), (0.2,0.18,0.08), wood)
    add_cube("walls", (0,0,0.19), (0.17,0.15,0.07), wood)
    add_cone("roof", (0,0,0.28), 0.22, 0.02, 0.08, roof, 4)
    # Cloth bolt decoration
    add_cylinder("cloth", (0.2,0,0.05), 0.03, 0.08, cloth, 8)
    cloth_obj = bpy.context.object
    cloth_obj.rotation_euler.y = math.pi/2
    export_glb(os.path.join(BUILDING_DIR, "weavers_hut.glb"))

def build_charcoal_burner():
    clear_scene()
    stone = make_mat("stone", (100, 95, 85))
    dark = make_mat("dark", (50, 45, 40))
    wood = make_mat("wood", (120, 80, 40))

    # Kiln (cone shape)
    add_cone("kiln", (0,0,0.15), 0.2, 0.05, 0.3, dark, 8)
    add_cylinder("kiln_base", (0,0,0.02), 0.22, 0.04, stone, 8)
    # Small lean-to shed
    add_cube("shed", (0.3,0,0.06), (0.1,0.08,0.06), wood)
    # Wood pile
    add_cube("logs", (-0.25,0,0.04), (0.08,0.1,0.04), wood)
    export_glb(os.path.join(BUILDING_DIR, "charcoal_burner.glb"))

def build_fletchers_workshop():
    clear_scene()
    wood = make_mat("wood", (139, 90, 43))
    roof = make_mat("roof", (110, 75, 40))
    grey = make_mat("grey", (150, 150, 150))

    add_cube("base", (0,0,0.1), (0.25,0.2,0.1), wood)
    add_cube("walls", (0,0,0.22), (0.22,0.17,0.08), wood)
    add_cone("roof", (0,0,0.32), 0.28, 0.02, 0.1, roof, 4)
    # Arrow rack
    for i in range(3):
        add_cylinder(f"arrow_{i}", (0.25, -0.05+i*0.05, 0.1), 0.005, 0.15, grey, 4)
    export_glb(os.path.join(BUILDING_DIR, "fletchers_workshop.glb"))

def build_siege_workshop():
    clear_scene()
    wood = make_mat("wood", (130, 85, 40))
    roof = make_mat("roof", (90, 65, 35))
    grey = make_mat("grey", (120, 120, 120), 0.5)
    dark_wood = make_mat("dark_wood", (80, 55, 30))

    add_cube("base", (0,0,0.1), (0.3,0.25,0.1), wood)
    add_cube("walls", (0,0,0.24), (0.27,0.22,0.1), wood)
    add_cone("roof", (0,0,0.36), 0.35, 0.02, 0.12, roof, 4)
    # Ram outside
    add_cylinder("ram", (0,0.35,0.06), 0.03, 0.3, dark_wood, 6)
    ram = bpy.context.object
    ram.rotation_euler.z = math.pi/2
    add_cube("ram_frame", (0,0.35,0.1), (0.06,0.15,0.01), grey)
    export_glb(os.path.join(BUILDING_DIR, "siege_workshop.glb"))

def build_stable():
    clear_scene()
    wood = make_mat("wood", (160, 120, 65))
    roof = make_mat("roof", (140, 100, 55))
    door = make_mat("door", (100, 70, 35))
    fence = make_mat("fence", (150, 120, 70))

    add_cube("barn", (0,0,0.14), (0.3,0.22,0.14), wood)
    add_cone("roof", (0,0,0.3), 0.35, 0.02, 0.1, roof, 4)
    add_cube("door1", (-0.08,0.115,0.08), (0.05,0.01,0.08), door)
    add_cube("door2", (0.08,0.115,0.08), (0.05,0.01,0.08), door)
    # Fence
    add_cube("fence_l", (-0.22,-0.22,0.04), (0.01,0.1,0.04), fence)
    add_cube("fence_r", (0.22,-0.22,0.04), (0.01,0.1,0.04), fence)
    add_cube("fence_b", (0,-0.32,0.04), (0.22,0.01,0.04), fence)
    export_glb(os.path.join(BUILDING_DIR, "stable.glb"))

def build_cattle_ranch():
    clear_scene()
    wood = make_mat("wood", (150, 110, 60))
    roof = make_mat("roof", (130, 90, 50))
    fence = make_mat("fence", (160, 130, 80))
    brown = make_mat("brown", (130, 80, 40))

    add_cube("barn", (0,0,0.1), (0.2,0.18,0.1), wood)
    add_cone("roof", (0,0,0.22), 0.25, 0.02, 0.08, roof, 4)
    # Fenced area
    for x in [-0.25, 0.25]:
        add_cube(f"fence_{x}", (x, -0.22, 0.04), (0.01, 0.15, 0.04), fence)
    add_cube("fence_b", (0, -0.38, 0.04), (0.25, 0.01, 0.04), fence)
    add_cube("fence_f", (0, -0.08, 0.04), (0.25, 0.01, 0.04), fence)
    # Cow shape
    add_cube("cow", (0.05, -0.22, 0.06), (0.06,0.03,0.04), brown)
    export_glb(os.path.join(BUILDING_DIR, "cattle_ranch.glb"))

def build_sheep_farm():
    clear_scene()
    wood = make_mat("wood", (150, 110, 60))
    roof = make_mat("roof", (130, 90, 50))
    fence = make_mat("fence", (160, 130, 80))
    white = make_mat("sheep", (230, 225, 215))

    add_cube("shed", (-0.15,0,0.08), (0.14,0.12,0.08), wood)
    add_cone("roof", (-0.15,0,0.18), 0.18, 0.02, 0.06, roof, 4)
    # Pen
    add_cube("fence_l", (0.05,-0.2,0.04), (0.01,0.12,0.04), fence)
    add_cube("fence_r", (0.35,-0.2,0.04), (0.01,0.12,0.04), fence)
    add_cube("fence_b", (0.2,-0.32,0.04), (0.15,0.01,0.04), fence)
    # Sheep
    add_sphere("sheep1", (0.15,-0.2,0.05), 0.04, white)
    add_sphere("sheep2", (0.28,-0.22,0.05), 0.035, white)
    export_glb(os.path.join(BUILDING_DIR, "sheep_farm.glb"))

def build_butchery():
    clear_scene()
    stone = make_mat("stone", (150, 140, 125))
    wood = make_mat("wood", (130, 85, 42))
    roof = make_mat("roof", (110, 75, 40))
    red = make_mat("red_accent", (160, 50, 40))

    add_cube("base", (0,0,0.1), (0.23,0.2,0.1), stone)
    add_cube("walls", (0,0,0.22), (0.2,0.17,0.08), wood)
    add_cone("roof", (0,0,0.32), 0.26, 0.02, 0.1, roof, 4)
    add_cube("awning", (0,0.12,0.2), (0.12,0.04,0.01), red)
    export_glb(os.path.join(BUILDING_DIR, "butchery.glb"))

def build_fortress():
    clear_scene()
    stone = make_mat("stone", (80, 80, 85))
    dark = make_mat("dark_stone", (60, 60, 65))
    red = make_mat("flag", (180, 30, 30))

    add_cube("base", (0,0,0.12), (0.35,0.35,0.12), stone)
    add_cube("upper", (0,0,0.28), (0.3,0.3,0.08), dark)
    # 4 corner towers
    for x, y in [(-0.18,-0.18),(0.18,-0.18),(-0.18,0.18),(0.18,0.18)]:
        add_cylinder(f"tower_{x}_{y}", (x,y,0.22), 0.06, 0.35, stone, 8)
        add_cone(f"flag_{x}_{y}", (x,y,0.42), 0.04, 0.0, 0.06, red, 4)
    # Gate
    add_cube("gate", (0,0.18,0.1), (0.08,0.02,0.08), dark)
    # Crenellations
    for i in range(-2,3):
        add_cube(f"cren_{i}", (i*0.08,0.16,0.35), (0.025,0.025,0.03), stone)
        add_cube(f"cren_b_{i}", (i*0.08,-0.16,0.35), (0.025,0.025,0.03), stone)
    export_glb(os.path.join(BUILDING_DIR, "fortress.glb"))

def build_archery_range():
    clear_scene()
    wood = make_mat("wood", (150, 110, 60))
    roof = make_mat("roof", (130, 95, 50))
    target = make_mat("target", (200, 40, 40))
    white = make_mat("white", (230, 230, 220))

    add_cube("base", (0,0,0.08), (0.25,0.2,0.08), wood)
    # Open pavilion (posts + roof)
    for x,y in [(-0.12,-0.1),(0.12,-0.1),(-0.12,0.1),(0.12,0.1)]:
        add_cube(f"post_{x}_{y}", (x,y,0.18), (0.015,0.015,0.12), wood)
    add_cone("roof", (0,0,0.28), 0.3, 0.02, 0.08, roof, 4)
    # Target
    add_cylinder("target_base", (0.35,0,0.1), 0.06, 0.02, white, 12)
    add_cylinder("target_ring", (0.35,0,0.11), 0.04, 0.02, target, 12)
    export_glb(os.path.join(BUILDING_DIR, "archery_range.glb"))

def build_torch_tower():
    clear_scene()
    stone = make_mat("stone", (140, 135, 125))
    fire = make_mat("fire", (255, 160, 30), 0.3)

    add_cube("base", (0,0,0.04), (0.1,0.1,0.04), stone)
    add_cube("tower", (0,0,0.22), (0.06,0.06,0.22), stone)
    # Torch top
    add_cube("platform", (0,0,0.36), (0.08,0.08,0.02), stone)
    add_sphere("flame", (0,0,0.42), 0.04, fire)
    export_glb(os.path.join(BUILDING_DIR, "torch_tower.glb"))

def build_inn_tavern():
    clear_scene()
    wood = make_mat("wood", (160, 115, 60))
    roof = make_mat("roof", (120, 80, 45))
    door = make_mat("door", (100, 65, 30))
    sign = make_mat("sign", (180, 150, 60))

    add_cube("base", (0,0,0.12), (0.28,0.22,0.12), wood)
    add_cube("upper", (0,0,0.26), (0.25,0.19,0.06), wood)
    add_cone("roof", (0,0,0.35), 0.32, 0.02, 0.1, roof, 4)
    add_cube("door", (0,0.12,0.08), (0.06,0.01,0.08), door)
    # Hanging sign
    add_cube("sign_post", (0.16,0.12,0.26), (0.01,0.01,0.06), wood)
    add_cube("sign_board", (0.16,0.16,0.28), (0.05,0.01,0.03), sign)
    # Barrel
    add_cylinder("barrel", (-0.2,0.14,0.06), 0.04, 0.08, wood, 8)
    export_glb(os.path.join(BUILDING_DIR, "inn_tavern.glb"))

def build_market():
    clear_scene()
    wood = make_mat("wood", (160, 120, 65))
    canopy = make_mat("canopy", (180, 50, 40))
    crate = make_mat("crate", (140, 100, 50))

    add_cube("platform", (0,0,0.03), (0.3,0.25,0.03), wood)
    # 4 posts
    for x,y in [(-0.13,-0.1),(0.13,-0.1),(-0.13,0.1),(0.13,0.1)]:
        add_cube(f"post_{x}_{y}", (x,y,0.15), (0.015,0.015,0.15), wood)
    # Canopy/awning
    add_cube("canopy", (0,0,0.25), (0.16,0.12,0.01), canopy)
    # Stalls/crates
    add_cube("crate1", (-0.08,0,0.06), (0.04,0.04,0.03), crate)
    add_cube("crate2", (0.08,0,0.06), (0.04,0.04,0.03), crate)
    add_cube("shelf", (0,0,0.1), (0.14,0.03,0.01), wood)
    export_glb(os.path.join(BUILDING_DIR, "market.glb"))


# ── UNIT MODELS ──────────────────────────────────────────────────────────────

def make_serf_base(name_prefix, body_color=(180,150,100), head_color=(220,190,150)):
    """Create a base serf body: torso cylinder + head sphere + arms + legs."""
    body_mat = make_mat(f"{name_prefix}_body", body_color)
    head_mat = make_mat(f"{name_prefix}_head", head_color)

    add_cylinder(f"{name_prefix}_torso", (0,0,0.08), 0.03, 0.08, body_mat, 6)
    add_sphere(f"{name_prefix}_head", (0,0,0.15), 0.025, head_mat, 6, 4)
    # Arms
    add_cylinder(f"{name_prefix}_arm_l", (-0.04,0,0.09), 0.01, 0.06, body_mat, 4)
    add_cylinder(f"{name_prefix}_arm_r", (0.04,0,0.09), 0.01, 0.06, body_mat, 4)
    # Legs
    add_cylinder(f"{name_prefix}_leg_l", (-0.015,0,0.02), 0.012, 0.04, body_mat, 4)
    add_cylinder(f"{name_prefix}_leg_r", (0.015,0,0.02), 0.012, 0.04, body_mat, 4)

def build_civilian_unit(name, body_color=(180,150,100), accent_color=None, tool_fn=None):
    """Generic civilian unit builder."""
    clear_scene()
    make_serf_base(name, body_color)
    if accent_color:
        accent = make_mat(f"{name}_accent", accent_color)
        add_cube(f"{name}_apron", (0,0.02,0.07), (0.025,0.005,0.03), accent)
    if tool_fn:
        tool_fn(name)
    export_glb(os.path.join(UNIT_DIR, f"{name}.glb"))

def build_archer_unit():
    clear_scene()
    make_serf_base("archer", (120,100,70))
    bow_mat = make_mat("bow", (120, 75, 35))
    quiver_mat = make_mat("quiver", (100, 65, 30))
    # Bow on back
    add_cylinder("bow", (-0.04,0.02,0.1), 0.002, 0.1, bow_mat, 4)
    bow = bpy.context.object
    bow.rotation_euler.x = 0.3
    # Quiver
    add_cylinder("quiver", (0.03,-0.02,0.1), 0.012, 0.06, quiver_mat, 6)
    export_glb(os.path.join(UNIT_DIR, "archer.glb"))

def build_cavalry_unit():
    clear_scene()
    horse_mat = make_mat("horse", (130, 85, 45))
    body_mat = make_mat("rider_body", (160, 130, 90))
    head_mat = make_mat("rider_head", (220, 190, 150))
    sword_mat = make_mat("sword", (180, 180, 180), 0.3)

    # Horse body
    add_cube("horse_body", (0,0,0.08), (0.04,0.1,0.04), horse_mat)
    add_cube("horse_head", (0,0.08,0.12), (0.02,0.03,0.025), horse_mat)
    # Horse legs
    for y_off in [-0.04, 0.04]:
        add_cylinder(f"leg_l_{y_off}", (-0.02, y_off, 0.02), 0.008, 0.06, horse_mat, 4)
        add_cylinder(f"leg_r_{y_off}", (0.02, y_off, 0.02), 0.008, 0.06, horse_mat, 4)
    # Rider
    add_cylinder("rider_torso", (0,0,0.15), 0.025, 0.06, body_mat, 6)
    add_sphere("rider_head", (0,0,0.21), 0.02, head_mat, 6, 4)
    # Sword
    add_cube("sword", (0.04,0,0.15), (0.005,0.005,0.04), sword_mat)
    export_glb(os.path.join(UNIT_DIR, "cavalry.glb"))

def build_siege_operator_unit():
    clear_scene()
    make_serf_base("siege_op", (140, 120, 90))
    ram_mat = make_mat("ram", (100, 70, 35))
    metal_mat = make_mat("metal", (130, 130, 130), 0.4)

    # Small ram carried
    add_cylinder("ram", (0,0.06,0.08), 0.015, 0.12, ram_mat, 6)
    ram = bpy.context.object
    ram.rotation_euler.x = math.pi/2
    add_sphere("ram_tip", (0,0.12,0.08), 0.02, metal_mat)
    export_glb(os.path.join(UNIT_DIR, "siege_operator.glb"))

def build_scout_unit():
    clear_scene()
    make_serf_base("scout", (150, 135, 100))
    cloak_mat = make_mat("cloak", (100, 60, 35))
    scroll_mat = make_mat("scroll", (220, 200, 160))

    # Cloak
    add_cube("cloak", (0,-0.02,0.09), (0.035,0.01,0.04), cloak_mat)
    # Map scroll
    add_cylinder("scroll", (0.05,0,0.08), 0.008, 0.04, scroll_mat, 6)
    export_glb(os.path.join(UNIT_DIR, "scout.glb"))

def build_donkey_unit():
    clear_scene()
    body_mat = make_mat("donkey", (140, 130, 115))
    dark_mat = make_mat("donkey_dark", (100, 90, 80))

    add_cube("body", (0,0,0.06), (0.03,0.08,0.03), body_mat)
    add_cube("head", (0,0.06,0.08), (0.015,0.025,0.02), body_mat)
    add_cube("ear_l", (-0.01,0.07,0.1), (0.005,0.005,0.015), dark_mat)
    add_cube("ear_r", (0.01,0.07,0.1), (0.005,0.005,0.015), dark_mat)
    for y in [-0.03, 0.03]:
        add_cylinder(f"leg_l_{y}", (-0.015,y,0.015), 0.006, 0.04, body_mat, 4)
        add_cylinder(f"leg_r_{y}", (0.015,y,0.015), 0.006, 0.04, body_mat, 4)
    export_glb(os.path.join(UNIT_DIR, "donkey.glb"))

def build_horse_transport_unit():
    clear_scene()
    body_mat = make_mat("horse", (130, 85, 45))
    dark_mat = make_mat("mane", (80, 55, 30))
    pack_mat = make_mat("pack", (160, 130, 80))

    add_cube("body", (0,0,0.08), (0.035,0.1,0.04), body_mat)
    add_cube("head", (0,0.08,0.11), (0.02,0.03,0.025), body_mat)
    add_cube("mane", (0,0.04,0.12), (0.005,0.04,0.01), dark_mat)
    for y in [-0.04, 0.04]:
        add_cylinder(f"leg_l_{y}", (-0.018,y,0.02), 0.007, 0.05, body_mat, 4)
        add_cylinder(f"leg_r_{y}", (0.018,y,0.02), 0.007, 0.05, body_mat, 4)
    # Pack saddle
    add_cube("pack", (0,0,0.12), (0.04,0.05,0.015), pack_mat)
    export_glb(os.path.join(UNIT_DIR, "horse_transport.glb"))


# ── RESOURCE MODELS ──────────────────────────────────────────────────────────

def build_resource(name, build_fn):
    clear_scene()
    build_fn()
    export_glb(os.path.join(RESOURCE_DIR, f"{name}.glb"))

def res_grapes():
    m = make_mat("grape", (120, 40, 140))
    stem = make_mat("stem", (80, 120, 40))
    add_sphere("g1", (0,0,0.02), 0.015, m)
    add_sphere("g2", (0.015,0.01,0.03), 0.013, m)
    add_sphere("g3", (-0.015,0.01,0.03), 0.013, m)
    add_sphere("g4", (0,0,0.045), 0.012, m)
    add_cylinder("stem", (0,0,0.06), 0.003, 0.02, stem, 4)

def res_fruit():
    m = make_mat("fruit", (220, 80, 30))
    stem = make_mat("stem", (80, 60, 30))
    add_sphere("fruit", (0,0,0.025), 0.025, m, 8, 6)
    add_cylinder("stem", (0,0,0.055), 0.003, 0.015, stem, 4)

def res_water_barrel():
    wood = make_mat("barrel", (160, 120, 60))
    band = make_mat("band", (100, 90, 80))
    add_cylinder("barrel", (0,0,0.03), 0.02, 0.05, wood, 8)
    add_cylinder("band1", (0,0,0.015), 0.022, 0.005, band, 8)
    add_cylinder("band2", (0,0,0.045), 0.022, 0.005, band, 8)

def res_milk():
    white = make_mat("milk", (240, 235, 220))
    add_cylinder("jug", (0,0,0.02), 0.015, 0.035, white, 8)
    add_sphere("top", (0,0,0.04), 0.015, white, 6, 4)

def res_hay():
    m = make_mat("hay", (200, 180, 80))
    add_cube("bale", (0,0,0.02), (0.03, 0.025, 0.02), m)

def res_wool():
    m = make_mat("wool", (235, 230, 220))
    add_sphere("ball", (0,0,0.025), 0.025, m, 8, 6)

def res_raw_leather():
    m = make_mat("leather", (180, 140, 90))
    add_cube("hide", (0,0,0.01), (0.035, 0.03, 0.008), m)

def res_wine():
    m = make_mat("wine", (120, 20, 50))
    glass = make_mat("glass", (180, 40, 70))
    add_cylinder("bottle", (0,0,0.025), 0.012, 0.04, m, 8)
    add_cylinder("neck", (0,0,0.05), 0.006, 0.015, glass, 6)

def res_beer():
    m = make_mat("beer", (200, 160, 60))
    foam = make_mat("foam", (240, 235, 210))
    add_cylinder("mug", (0,0,0.02), 0.015, 0.035, m, 8)
    add_cylinder("foam", (0,0,0.04), 0.014, 0.008, foam, 8)
    add_cube("handle", (0.02,0,0.02), (0.005,0.008,0.012), m)

def res_cheese():
    m = make_mat("cheese", (240, 200, 70))
    add_cone("wedge", (0,0,0.015), 0.025, 0.005, 0.025, m, 3)

def res_cloth():
    m = make_mat("cloth", (120, 130, 180))
    add_cube("bolt", (0,0,0.015), (0.015, 0.03, 0.015), m)

def res_worked_leather():
    m = make_mat("leather", (100, 65, 35))
    add_cube("hide", (0,0,0.01), (0.035, 0.03, 0.008), m)
    stitch = make_mat("stitch", (140, 100, 60))
    add_cube("stitch", (0,0,0.015), (0.025, 0.001, 0.001), stitch)

def res_arrows():
    shaft = make_mat("shaft", (160, 150, 130))
    tip = make_mat("tip", (150, 150, 150), 0.4)
    for i in range(3):
        add_cylinder(f"arrow_{i}", (i*0.012-0.012, 0, 0.03), 0.003, 0.05, shaft, 4)
        add_cone(f"tip_{i}", (i*0.012-0.012, 0, 0.058), 0.005, 0.0, 0.01, tip, 3)

def res_bow():
    m = make_mat("bow", (120, 75, 35))
    string = make_mat("string", (200, 190, 170))
    add_cylinder("bow_body", (0,0,0.03), 0.003, 0.06, m, 4)
    add_cube("string", (0.01,0,0.03), (0.001,0.001,0.025), string)

def res_siege_ram():
    wood = make_mat("wood", (100, 70, 35))
    metal = make_mat("metal", (130, 130, 130), 0.4)
    add_cylinder("log", (0,0,0.015), 0.012, 0.08, wood, 6)
    log = bpy.context.object
    log.rotation_euler.y = math.pi/2
    add_sphere("tip", (0.04,0,0.015), 0.015, metal, 6, 4)

def res_cattle():
    m = make_mat("cattle", (140, 100, 60))
    add_cube("body", (0,0,0.03), (0.02, 0.04, 0.02), m)
    add_cube("head", (0,0.03,0.04), (0.012, 0.012, 0.012), m)
    for y in [-0.015, 0.015]:
        add_cylinder(f"leg_l_{y}", (-0.01,y,0.008), 0.004, 0.02, m, 4)
        add_cylinder(f"leg_r_{y}", (0.01,y,0.008), 0.004, 0.02, m, 4)

def res_horses():
    m = make_mat("horse", (130, 85, 45))
    add_cube("body", (0,0,0.035), (0.02, 0.045, 0.025), m)
    add_cube("head", (0,0.04,0.05), (0.01, 0.02, 0.015), m)
    for y in [-0.02, 0.02]:
        add_cylinder(f"leg_l_{y}", (-0.01,y,0.01), 0.004, 0.025, m, 4)
        add_cylinder(f"leg_r_{y}", (0.01,y,0.01), 0.004, 0.025, m, 4)

# Also build missing tool resource models
def res_tool_simple(name, color, shape='cube'):
    m = make_mat(name, color)
    if shape == 'cube':
        add_cube(name, (0,0,0.015), (0.008, 0.005, 0.015), m)
    else:
        add_cylinder(name, (0,0,0.02), 0.005, 0.035, m, 4)


# ── MAIN EXECUTION ───────────────────────────────────────────────────────────

print("\n=== Generating Expansion Buildings ===")
build_well()
build_orchard()
build_vineyard()
build_winery()
build_brewery()
build_dairy_farm()
build_cheese_maker()
build_hayfield()
build_tannery()
build_weavers_hut()
build_charcoal_burner()
build_fletchers_workshop()
build_siege_workshop()
build_stable()
build_cattle_ranch()
build_sheep_farm()
build_butchery()
build_fortress()
build_archery_range()
build_torch_tower()
build_inn_tavern()
build_market()

print("\n=== Generating Expansion Units ===")
# Civilian workers (use base serf with color variations)
civilians = [
    ("orchardist", (160,140,90), (80,140,50)),
    ("vintner", (150,130,100), (100,40,120)),
    ("winemaker", (140,120,90), (120,30,60)),
    ("brewer", (160,140,100), (180,140,50)),
    ("dairymaid", (170,155,120), (230,225,210)),
    ("cheese_maker", (165,145,100), (220,190,70)),
    ("tanner", (140,110,75), (130,85,50)),
    ("weaver", (155,140,110), (120,130,180)),
    ("fletcher", (145,125,90), None),
    ("charcoal_burner_unit", (120,110,95), (60,55,50)),
    ("engineer", (150,135,105), (130,130,130)),
    ("stablehand", (160,140,95), (140,100,55)),
    ("rancher", (155,130,90), (130,90,50)),
    ("shepherd", (165,150,115), (220,215,200)),
]
for name, body, accent in civilians:
    build_civilian_unit(name, body, accent)

build_archer_unit()
build_cavalry_unit()
build_siege_operator_unit()
build_scout_unit()
build_donkey_unit()
build_horse_transport_unit()

print("\n=== Generating Expansion Resources ===")
resources = [
    ("grapes", res_grapes),
    ("fruit", res_fruit),
    ("water_barrel", res_water_barrel),
    ("milk", res_milk),
    ("hay", res_hay),
    ("wool", res_wool),
    ("raw_leather", res_raw_leather),
    ("wine", res_wine),
    ("beer", res_beer),
    ("cheese", res_cheese),
    ("cloth", res_cloth),
    ("worked_leather", res_worked_leather),
    ("arrows", res_arrows),
    ("bow", res_bow),
    ("siege_ram", res_siege_ram),
    ("cattle", res_cattle),
    ("horses", res_horses),
]
for name, fn in resources:
    build_resource(name, fn)

# Tool resources that were also missing
print("\n=== Generating Missing Tool Resources ===")
tools = [
    ("axe", (120, 90, 55)),
    ("pickaxe", (120, 140, 150)),
    ("saw", (160, 135, 115)),
    ("scythe", (140, 110, 95)),
    ("fishing_rod", (90, 65, 40)),
    ("hammer_tool", (120, 90, 55)),
    ("shovel", (110, 75, 45)),
    ("rolling_pin", (190, 170, 165)),
    ("cleaver", (145, 165, 175)),
    ("tongs", (85, 110, 120)),
    ("crucible", (255, 140, 0)),
]
for name, color in tools:
    clear_scene()
    res_tool_simple(name, color, 'cylinder' if name in ('fishing_rod','rolling_pin') else 'cube')
    export_glb(os.path.join(RESOURCE_DIR, f"{name}.glb"))

print("\n=== DONE! All expansion models generated. ===")
