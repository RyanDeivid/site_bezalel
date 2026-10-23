"""
Monta no Blender a cidade real do Bezalel Universe como referência para modelar.

Rodar dentro do Blender (Scripting > Abrir > Executar) ou pelo MCP do Blender
(ferramenta de executar código Python), depois de gerar o arquivo:

    node scripts/export-city-layout.ts        -> art/city-layout.json

Cria a coleção "Universe (referência)", travada para seleção:
  - as quadras (planos no chão) e as ruas;
  - um bloco por sólido de colisão (torres, marcos, telões, passarelas), com a
    altura real — é o espaço que o modelo novo deve respeitar;
  - um "empty" por local (Sede, Laboratório, Centro de Produtos, praça, chegada);
  - um "empty" por objeto já posicionado (placements), com a propriedade bz_model.

Coordenadas: o Universe usa as do glTF (metros, Y para cima, Z para o sul). No
Blender (Z para cima) um ponto (x, y, z) do Universe fica em (x, -z, y) — a
mesma conversão que o exportador glTF faz na volta, então o que for modelado
aqui sai no lugar certo.
"""

import json
import os

import bpy

HERE = os.path.dirname(os.path.abspath(bpy.data.filepath or __file__))
LAYOUT = os.environ.get("BZ_CITY_LAYOUT") or os.path.normpath(os.path.join(HERE, "..", "city-layout.json"))
NAME = "Universe (referência)"


def to_blender(x, y, z):
    return (x, -z, y)


def material(name, rgba):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = rgba
    return m


def box(coll, name, min_x, max_x, min_z, max_z, base, top, mat):
    sx, sz, sy = max_x - min_x, max_z - min_z, max(0.05, top - base)
    cx, cz, cy = (min_x + max_x) / 2, (min_z + max_z) / 2, base + sy / 2
    bpy.ops.mesh.primitive_cube_add(size=1, location=to_blender(cx, cy, cz))
    o = bpy.context.active_object
    o.name = name
    o.scale = (sx, sz, sy)
    o.data.materials.append(mat)
    o.display_type = "WIRE" if sy > 40 else "SOLID"
    move(o, coll)
    return o


def move(o, coll):
    for c in o.users_collection:
        c.objects.unlink(o)
    coll.objects.link(o)
    o.hide_select = True


def main():
    with open(LAYOUT, encoding="utf-8") as f:
        city = json.load(f)
    old = bpy.data.collections.get(NAME)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(old)
    coll = bpy.data.collections.new(NAME)
    bpy.context.scene.collection.children.link(coll)
    m_block = material("bz-quadra", (0.18, 0.2, 0.24, 1))
    m_solid = material("bz-solido", (0.45, 0.5, 0.6, 0.6))
    m_road = material("bz-rua", (0.08, 0.08, 0.1, 1))
    ground = city["ground"]["block"]
    for b in city["blocks"]:
        box(coll, f"quadra {b['bx']},{b['bz']}", b["minX"], b["maxX"], b["minZ"], b["maxZ"], 0, ground, m_block)
    half, w = city["worldHalf"], city["streets"]["width"]
    for i, line in enumerate(city["streets"]["lines"]):
        box(coll, f"rua x={line}", line - w / 2, line + w / 2, -half, half, 0, 0.03, m_road)
        box(coll, f"rua z={line}", -half, half, line - w / 2, line + w / 2, 0, 0.031, m_road)
    for i, s in enumerate(city["solids"]):
        box(coll, f"sólido {i}", s["minX"], s["maxX"], s["minZ"], s["maxZ"], s.get("base", 0), s["height"], m_solid)
    for p in city["places"]:
        e = bpy.data.objects.new(f"local {p['id']}", None)
        e.location = to_blender(p["pad"]["x"], 0.3, p["pad"]["z"])
        e.empty_display_type = "CONE"
        e.empty_display_size = 3
        coll.objects.link(e)
    for p in city.get("placements", []):
        e = bpy.data.objects.new(f"posição {p['model']}", None)
        e.location = to_blender(p["x"], p["y"], p["z"])
        e.rotation_euler = (0, 0, p["rotationY"])
        e["bz_model"] = p["model"]
        coll.objects.link(e)
    print(f"Universe: {len(city['solids'])} sólidos, {len(city['blocks'])} quadras, {len(city['places'])} locais importados")


main()
