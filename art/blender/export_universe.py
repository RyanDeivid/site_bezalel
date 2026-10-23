"""
Exporta do Blender para o Bezalel Universe: os modelos (GLB) e as posições.

Rodar dentro do Blender ou pelo MCP do Blender. Convenções (docs/BLENDER-PIPELINE.md):

  Modelos — uma coleção por modelo, com a propriedade personalizada
    bz_model = "<id>"            (ex.: "sede-bezalel")
    bz_slot  = "<encaixe>"       (ex.: "landmark:bezalel-hq", "prop:banco-praca")
    bz_license, bz_author, bz_source, bz_proof (obrigatórias), bz_credit (CC-BY)
  Os objetos da coleção terminam em _LOD0, _LOD1, _LOD2 (do mais detalhado ao
  mais leve); cada nível vira um arquivo models/<id>_lod<n>.glb. Origem do
  modelo no chão, escala em metros, frente para -Y no Blender (= +Z no Universe).
  Peças COL_* (caixas) não vão para o GLB: viram a caixa de colisão.

  Posições — objetos (empty ou instância de coleção) com a propriedade
    bz_place = "<id do modelo>"
  viram uma entrada de placements.json (posição, giro em Z, escala uniforme e,
  se houver um COL_ filho, a caixa de colisão).

Saídas (relativas ao repositório):
  public/models/<id>_lod<n>.glb
  src/features/universe/assets/models.json     (atualiza o registro do modelo)
  src/features/universe/assets/placements.json (substitui as posições)

Depois, fora do Blender, comprimir e conferir:
  npx @gltf-transform/cli optimize public/models/<arq>.glb public/models/<arq>.glb --compress meshopt --texture-compress ktx2
  node scripts/check-models.ts
"""

import json
import os
import re

import bpy

REPO = os.environ.get("BZ_REPO") or os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(bpy.data.filepath or __file__)), "..", ".."))
MODELS_DIR = os.path.join(REPO, "public", "models")
REGISTRY = os.path.join(REPO, "src", "features", "universe", "assets", "models.json")
PLACEMENTS = os.path.join(REPO, "src", "features", "universe", "assets", "placements.json")
LOD_DISTANCES = [25, 80, 400]


def universe(v):
    """Ponto do Blender (Z para cima) -> Universe/glTF (Y para cima)."""
    return (v[0], v[2], -v[1])


def triangles(objs):
    total = 0
    deps = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if o.type != "MESH":
            continue
        mesh = o.evaluated_get(deps).to_mesh()
        mesh.calc_loop_triangles()
        total += len(mesh.loop_triangles)
        o.evaluated_get(deps).to_mesh_clear()
    return total


def export_models(registry):
    os.makedirs(MODELS_DIR, exist_ok=True)
    by_id = {m["id"]: m for m in registry}
    for coll in bpy.data.collections:
        mid = coll.get("bz_model")
        if not mid:
            continue
        levels = {}
        for o in coll.all_objects:
            if o.name.startswith("COL_"):
                continue
            m = re.search(r"_LOD(\d)$", o.name)
            levels.setdefault(int(m.group(1)) if m else 0, []).append(o)
        lods = []
        for n in sorted(levels):
            objs = levels[n]
            bpy.ops.object.select_all(action="DESELECT")
            for o in objs:
                o.select_set(True)
            url = f"models/{mid}_lod{n}.glb"
            path = os.path.join(REPO, "public", url)
            bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=True)
            lods.append({"url": url, "upTo": LOD_DISTANCES[min(n, len(LOD_DISTANCES) - 1)], "triangles": triangles(objs), "bytes": os.path.getsize(path)})
        entry = by_id.get(mid, {"id": mid})
        entry.update(
            {
                "slot": coll.get("bz_slot", f"prop:{mid}"),
                "lods": lods,
                "license": {
                    "license": coll.get("bz_license", ""),
                    "author": coll.get("bz_author", ""),
                    "source": coll.get("bz_source", ""),
                    "proof": coll.get("bz_proof", ""),
                    **({"credit": coll["bz_credit"]} if coll.get("bz_credit") else {}),
                },
            }
        )
        by_id[mid] = entry
        print(f"modelo {mid}: {len(lods)} níveis")
    return list(by_id.values())


def export_placements():
    out = []
    for o in bpy.data.objects:
        model = o.get("bz_place")
        if not model:
            continue
        x, y, z = universe(o.matrix_world.translation)
        p = {"model": model, "x": round(x, 3), "y": round(y, 3), "z": round(z, 3), "rotationY": round(o.matrix_world.to_euler().z, 4)}
        s = o.matrix_world.to_scale()
        if abs(s.x - 1) > 1e-3:
            p["scale"] = round(s.x, 3)
        col = next((c for c in o.children if c.name.startswith("COL_")), None)
        if col:
            d = col.dimensions
            p["solid"] = {"hx": round(d.x / 2, 3), "hz": round(d.y / 2, 3), "h": round(d.z, 3)}
        out.append(p)
    return out


def main():
    registry = json.load(open(REGISTRY, encoding="utf-8")) if os.path.exists(REGISTRY) else []
    registry = export_models(registry)
    with open(REGISTRY, "w", encoding="utf-8") as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)
    places = export_placements()
    with open(PLACEMENTS, "w", encoding="utf-8") as f:
        json.dump(places, f, ensure_ascii=False, indent=2)
    print(f"Universe: {len(registry)} modelos registrados, {len(places)} posições exportadas")


main()
