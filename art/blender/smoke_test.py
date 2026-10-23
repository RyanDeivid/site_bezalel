"""
Prova rápida do Blender por linha de comando (não toca nos ativos do site).

    blender --background --factory-startup --python art/blender/smoke_test.py -- <pasta de saída>

Cria uma cena vazia, uma peça com material PBR nas cores Bezalel, luz e câmera; renderiza um PNG pequeno
(Eevee) e exporta um GLB. No fim, relê o GLB (cabeçalho e o JSON do glTF) e imprime um resumo verificável.
Sai com código 1 se algo falhar.
"""

import json
import os
import struct
import sys

import bpy

out = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else os.path.join(os.getcwd(), "blender-smoke")
os.makedirs(out, exist_ok=True)

# Cena limpa (o --factory-startup já evita preferências e complementos do usuário).
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# Geometria: uma placa chanfrada (um "totem" de sinalização) e um piso.
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1.2))
totem = bpy.context.active_object
totem.name = "bz_totem_LOD0"
totem.data.name = "bz_totem"
totem.scale = (0.6, 0.12, 1.2)
bpy.ops.object.transform_apply(scale=True)
bev = totem.modifiers.new("chanfro", "BEVEL")
bev.width = 0.03
bev.segments = 2
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
floor = bpy.context.active_object
floor.name = "piso"


def pbr(name, rgb, metal, rough, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*rgb, 1)
        b.inputs["Emission Strength"].default_value = emit
    return m


# Navy #101B2B e dourado #C7A86A (em linear, aproximado).
navy = pbr("bz-navy", (0.0052, 0.0116, 0.0242), 0.2, 0.45)
gold = pbr("bz-gold", (0.571, 0.392, 0.144), 1.0, 0.25, emit=0.5)
totem.data.materials.append(navy)
totem.data.materials.append(gold)
# A face da frente em dourado.
for p in totem.data.polygons:
    if p.normal.y < -0.9:
        p.material_index = 1
floor.data.materials.append(pbr("bz-piso", (0.4, 0.38, 0.35), 0.0, 0.6))

# Luz e câmera.
bpy.ops.object.light_add(type="AREA", location=(2.5, -3, 4))
light = bpy.context.active_object
light.data.energy = 600
light.data.size = 3
bpy.ops.object.camera_add(location=(4.6, -6.2, 2.6))
cam = bpy.context.active_object
cam.data.lens = 40
direction = totem.location - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

# Render pequeno (Eevee: rápido e sem GPU obrigatória).
engines = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
scene.render.resolution_x = 480
scene.render.resolution_y = 300
scene.render.filepath = os.path.join(out, "smoke.png")
bpy.ops.render.render(write_still=True)

# Exporta só o totem, como o pipeline do Universe faz (Y para cima, modificadores aplicados).
bpy.ops.object.select_all(action="DESELECT")
totem.select_set(True)
glb = os.path.join(out, "smoke.glb")
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_yup=True, export_apply=True)

# Verificação: o arquivo existe, o cabeçalho é de GLB 2.0 e o JSON tem a malha e os dois materiais.
ok = True
with open(glb, "rb") as f:
    magic, version, length = struct.unpack("<4sII", f.read(12))
    chunk_len, chunk_type = struct.unpack("<I4s", f.read(8))
    gltf = json.loads(f.read(chunk_len))
size = os.path.getsize(glb)
summary = {
    "blender": bpy.app.version_string,
    "engine": scene.render.engine,
    "png": os.path.exists(scene.render.filepath) and os.path.getsize(scene.render.filepath),
    "glb_bytes": size,
    "glb_magic": magic.decode(),
    "glb_version": version,
    "length_matches": length == size,
    "meshes": [m["name"] for m in gltf.get("meshes", [])],
    "materials": [m["name"] for m in gltf.get("materials", [])],
    "nodes": [n.get("name") for n in gltf.get("nodes", [])],
}
ok = magic == b"glTF" and version == 2 and length == size and bool(summary["png"]) and len(summary["materials"]) == 2
print("BZ-SMOKE " + json.dumps(summary, ensure_ascii=False))
print("BZ-SMOKE " + ("OK" if ok else "FALHOU"))
sys.exit(0 if ok else 1)
