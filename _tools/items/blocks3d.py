"""Block shapes for the mob summoner's 3D preview (Oct 19 2026).

A mob can wear any block on its head (the game draws it at 10/16 of a block over the head) and
hold one in its hand. This writes, from the Minecraft 26.3 client jar:
  site/mc-blocks3d.json             {item id: [tint hex or "", [[from, to, {face: [texture, u0, v0, u1, v1, tinted]}], ...]]}
                                    one entry per item whose inventory model is a block model with boxes
                                    (stone, glass, stairs, fences...); uv in texture pixels (0-16)
  site/minecrafticons/blocks/*.png  the textures those faces use (first frame), named as in the jar
                                    ("block/oak_log_top" -> oak_log_top.png). Existing files are kept.
mc-mob3d.js loads both only when a mob wears or holds a block. Element rotations are left out
(the item icons in build.py skip them too); at preview size it doesn't show.

Run (needs Pillow):   python _tools/items/blocks3d.py [path/to/client.jar]
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build as B  # the jar, model chains and tints, shared with the item icons

OUT = os.path.join(B.SITE, 'minecrafticons', 'blocks')


def auto_uv(face, a, b):
    """The uv the game gives a face that names none: the element's own outline on that side."""
    x0, y0, z0 = a
    x1, y1, z1 = b
    return {'north': (16 - x1, 16 - y1, 16 - x0, 16 - y0), 'south': (x0, 16 - y1, x1, 16 - y0),
            'east': (16 - z1, 16 - y1, 16 - z0, 16 - y0), 'west': (z0, 16 - y1, z1, 16 - y0),
            'up': (x0, z0, x1, z1), 'down': (x0, 16 - z1, x1, 16 - z0)}[face]


def name_of(ref):
    ref = B.short(ref)
    return (ref[6:] if ref.startswith('block/') else ref).replace('/', '-')


def shape(item_id):
    p = B.A + 'items/%s.json' % item_id
    if p not in B.names:
        return None
    m = B.first_model(B.rj(p)['model'])
    if B.short(m.get('type', '')) != 'model':
        return None
    chain = B.model_chain(m['model'])
    parents = [B.short(c.get('parent', '')) for c in chain] + [chain[-1].get('__builtin', '')]
    if any(x in ('item/generated', 'item/handheld', 'builtin/generated') for x in parents):
        return None
    texs, elements, r = B.resolve(chain)
    if not elements or len(elements) > 24:
        return None
    tints = m.get('tints', [])
    tint = B.tint_rgb(tints[0]) if tints else None
    out, used = [], set()
    for el in elements:
        a, b = el['from'], el['to']
        faces = {}
        for f, d in el.get('faces', {}).items():
            ref = r(d.get('texture'))
            if not ref or B.A + 'textures/' + B.short(ref) + '.png' not in B.names:
                continue
            uv = d.get('uv') or auto_uv(f, a, b)
            faces[f] = [name_of(ref)] + [round(v, 3) for v in uv] + [1 if 'tintindex' in d else 0]
            used.add(B.short(ref))
        if faces:
            out.append([[round(v, 3) for v in a], [round(v, 3) for v in b], faces])
    if not out:
        return None
    return ['%02x%02x%02x' % tint if tint else '', out], used


if __name__ == '__main__':
    shapes, textures = {}, set()
    for i in B.all_items():
        got = shape(i)
        if got:
            shapes[i] = got[0]
            textures |= got[1]
    os.makedirs(OUT, exist_ok=True)
    made = 0
    for ref in sorted(textures):
        dst = os.path.join(OUT, name_of(ref) + '.png')
        if not os.path.exists(dst):
            B.tex(ref).save(dst, optimize=True)
            made += 1
    with open(os.path.join(B.SITE, 'mc-blocks3d.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(shapes, f, separators=(',', ':'))
    print('blocks %d, textures %d (%d new)' % (len(shapes), len(textures), made))
