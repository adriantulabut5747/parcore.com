"""Every item's icon, for the mob summoner's trade slots (Oct 18 2026).

Reads the Minecraft 26.3 client jar and writes
  site/mc-item-ids.json            every item id in the game (the trade fields' suggestions)
  site/minecrafticons/items/*.png  an icon for each of them the folder doesn't have yet.
                                   Existing icons are never touched.

  item/generated models (wheat, bread...)  the game's sprite layers, tinted the way
                                           the item definition says, 16x16
  block models (stone, stairs, fences...)  the inventory view: every element of the model
                                           drawn isometric, back to front, with the game's
                                           face shading (top 1.0, left 0.8, right 0.6), 32x32
  beds, banners (special renderers)        drawn from their entity textures

Run (needs Pillow):   python _tools/items/build.py [path/to/client.jar]
Default jar: %APPDATA%/.minecraft/versions/26.3/26.3.jar
"""
import json, math, os, re, sys, zipfile
from PIL import Image, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.normpath(os.path.join(HERE, '..', '..', 'site'))
OUT = os.path.join(SITE, 'minecrafticons', 'items')
JAR = sys.argv[1] if len(sys.argv) > 1 else os.path.expandvars(r'%APPDATA%\.minecraft\versions\26.3\26.3.jar')
A = 'assets/minecraft/'

z = zipfile.ZipFile(JAR)
names = set(z.namelist())


def rj(path):
    return json.loads(z.read(path).decode('utf-8'))


def short(ref):
    return ref.split(':', 1)[-1]


def tex(ref):
    """A texture as RGBA, first frame of animated strips."""
    im = Image.open(z.open(A + 'textures/' + short(ref) + '.png')).convert('RGBA')
    if im.height > im.width:
        im = im.crop((0, 0, im.width, im.width))
    return im


def argb(v):
    v &= 0xFFFFFFFF
    return ((v >> 16) & 255, (v >> 8) & 255, v & 255)


# Item-definition tint sources -> a colour (the game's defaults for an item in your hand).
def tint_rgb(t):
    k = short(t.get('type', ''))
    if k == 'constant':
        return argb(t['value'])
    if k in ('dye', 'potion', 'firework', 'map_color', 'team', 'custom_model_data'):
        return argb(t.get('default', -1))
    if k == 'grass':
        return (0x91, 0xBD, 0x59)  # plains grass, temperature .8 / downfall .4 ~ the inventory look
    return None


def tinted(im, rgb):
    if not rgb:
        return im
    r, g, b, a = im.split()
    r = r.point(lambda v: v * rgb[0] // 255)
    g = g.point(lambda v: v * rgb[1] // 255)
    b = b.point(lambda v: v * rgb[2] // 255)
    return Image.merge('RGBA', (r, g, b, a))


def model_chain(ref):
    """[model json, its parent, ...] for models/<ref>.json."""
    out = []
    while ref:
        p = A + 'models/' + short(ref) + '.json'
        if p not in names:
            out.append({'__builtin': short(ref)})
            break
        m = rj(p)
        out.append(m)
        ref = m.get('parent')
    return out


def resolve(chain):
    texs, elements = {}, None
    for m in reversed(chain):  # parents first, children override
        texs.update(m.get('textures', {}))
    for m in chain:
        if 'elements' in m:
            elements = m['elements']
            break

    def r(v, depth=0):
        while depth < 10:
            if isinstance(v, dict):  # 26.x: {"sprite": "...", "force_translucent": true}
                v = v.get('sprite')
            if v and not v.startswith('#') and ':' not in v and '/' not in v and v in texs:
                v = '#' + v  # heavy_core writes "all" for "#all"
            if not (v and v.startswith('#')):
                return v
            v = texs.get(v[1:])
            depth += 1
        return v
    return texs, elements, r


def first_model(node):
    """The plain model an item definition shows by default (fallbacks / first case)."""
    k = short(node.get('type', 'model'))
    if k == 'model':
        return node
    if k in ('select', 'range_dispatch'):
        return first_model(node.get('fallback') or (node.get('cases') or node.get('entries'))[0]['model'])
    if k == 'condition':
        return first_model(node['on_false'])
    if k == 'composite':
        return first_model(node['models'][0])
    return node  # special: handled by the caller


# ---------- isometric cube ----------
S = 32
C30, S30 = math.cos(math.radians(30)), math.sin(math.radians(30))


def face_onto(canvas, img, p0, px, py):
    """Paste img so its (0,0) lands on p0, its x axis runs to px, its y axis to py (screen points)."""
    w, h = img.size
    ax, ay = (px[0] - p0[0]) / w, (px[1] - p0[1]) / w
    bx, by = (py[0] - p0[0]) / h, (py[1] - p0[1]) / h
    det = ax * by - ay * bx
    # inverse affine: screen -> texture
    ia, ib = by / det, -bx / det
    ic, id_ = -ay / det, ax / det
    coeffs = (ia, ib, -(ia * p0[0] + ib * p0[1]), ic, id_, -(ic * p0[0] + id_ * p0[1]))
    layer = img.transform(canvas.size, Image.AFFINE, coeffs, resample=Image.NEAREST)
    canvas.alpha_composite(layer)


def shade(img, f):
    r, g, b, a = img.split()
    rgb = ImageEnhance.Brightness(Image.merge('RGB', (r, g, b))).enhance(f)
    return Image.merge('RGBA', (*rgb.split(), a))


def crop_uv(img, uv):
    if not uv:
        return img
    k = img.width / 16
    x0, y0, x1, y1 = uv
    box = (round(min(x0, x1) * k), round(min(y0, y1) * k), round(max(x0, x1) * k), round(max(y0, y1) * k))
    if box[2] - box[0] < 1 or box[3] - box[1] < 1:
        return img
    return img.crop(box)


def iso_box(faces, frm=(0, 0, 0), to=(16, 16, 16), room=(16, 16, 16), cv=None):
    """faces: up / left (south) / right (east) images, box frm-to in block units (0-16).
    room = the space the icon is framed on (a full block, or two for a bed), centred in S x S.
    Pass cv to draw onto an icon already started (one element of a bigger model)."""
    cv = cv or Image.new('RGBA', (S, S), (0, 0, 0, 0))
    rx, ry, rz = room
    u = S * 0.88 / ((rx + rz) * C30)  # the room's width fills ~88% of the icon, like the game's
    if ((rx + rz) * S30 + ry) * u > S * 1.05:  # too tall for that: fit the height instead
        u = S * 0.92 / ((rx + rz) * S30 + ry)

    def P(x, y, z):  # x east, y up, z south
        return (S / 2 + (x - z - (rx - rz) / 2) * C30 * u, S / 2 + (x + z - (rx + rz) / 2) * S30 * u - (y - ry / 2) * u)
    (x0, y0, z0), (x1, y1, z1) = frm, to
    if faces.get('left'):   # south face, z = z1, texture x runs west->east, y top->bottom
        face_onto(cv, shade(faces['left'], 0.8), P(x0, y1, z1), P(x1, y1, z1), P(x0, y0, z1))
    if faces.get('right'):  # east face, x = x1, texture x runs south->north
        face_onto(cv, shade(faces['right'], 0.6), P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z1))
    if faces.get('up'):     # top, y = y1, texture x west->east, y north->south
        face_onto(cv, faces['up'], P(x0, y1, z0), P(x1, y1, z0), P(x0, y1, z1))
    return cv


def block_icon(chain, tints):
    texs, elements, r = resolve(chain)
    if not elements:
        return None
    tint = tint_rgb(tints[0]) if tints else None

    def face(fs, name):
        f = fs.get(name)
        ref = f and r(f.get('texture'))
        if not ref:
            return None
        im = crop_uv(tex(ref), f.get('uv'))
        return tinted(im, tint) if 'tintindex' in f else im
    # every element, the far ones first (the viewer sits east, south and above);
    # element rotations are ignored -- close enough at icon size
    far = lambda e: (e['from'][0] + e['to'][0] + e['from'][2] + e['to'][2], e['from'][1] + e['to'][1])
    cv = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    for el in sorted(elements, key=far):
        fs = el.get('faces', {})
        iso_box({'up': face(fs, 'up'), 'left': face(fs, 'south'), 'right': face(fs, 'east')}, el['from'], el['to'], cv=cv)
    return cv if cv.getbbox() else None


def flat_icon(chain, tints):
    texs, _, r = resolve(chain)
    out = None
    for i in range(5):
        ref = r(texs.get('layer%d' % i))
        if not ref:
            break
        im = tex(ref)
        if im.size != (16, 16):
            im = im.resize((16, 16), Image.NEAREST)
        im = tinted(im, tint_rgb(tints[i]) if i < len(tints) else None)
        out = im if out is None else Image.alpha_composite(out, im)
    return out


# ---------- the two special renderers ----------
def bed_icon(item_id):
    """The two halves (block models white_bed_head / _foot) as one long box: head behind, foot in front."""
    def faces(ref):
        texs, elements, r = resolve(model_chain(ref))
        el = max(elements, key=lambda e: (e['to'][0] - e['from'][0]) * (e['to'][2] - e['from'][2]))
        f = el['faces']
        get = lambda n: crop_uv(tex(r(f[n]['texture'])), f[n].get('uv')) if n in f else None
        return get('up'), get('south'), get('east'), el['to'][1]
    hu, _, he, h = faces('block/' + item_id + '_head')
    fu, fs, fe, _ = faces('block/' + item_id + '_foot')
    up = Image.new('RGBA', (16, 32)); up.paste(hu.resize((16, 16), Image.NEAREST), (0, 0)); up.paste(fu.resize((16, 16), Image.NEAREST), (0, 16))
    side = Image.new('RGBA', (32, he.height)); side.paste(fe.resize((16, he.height), Image.NEAREST), (0, 0)); side.paste(he.resize((16, he.height), Image.NEAREST), (16, 0))
    return iso_box({'up': up, 'left': fs, 'right': side}, (0, 0, 0), (16, h, 32), room=(16, 16, 32))


def banner_icon(color_rgb):
    base = Image.open(z.open(A + 'textures/entity/banner/banner_base.png')).convert('RGBA')
    k = base.width // 64
    cloth = tinted(base.crop((1 * k, 1 * k, 21 * k, 41 * k)), color_rgb).resize((10, 20), Image.NEAREST)
    pole = base.crop((44 * k, 0, 46 * k, 42 * k)).resize((2, 30), Image.NEAREST)
    bar = base.crop((0, 42 * k, 20 * k, 44 * k)).resize((14, 2), Image.NEAREST)
    cv = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    cv.alpha_composite(pole, (15, 1)); cv.alpha_composite(bar, (9, 3)); cv.alpha_composite(cloth, (11, 5))
    return cv


# ---------- entity models (chests, shulker boxes, heads, the copper golem) ----------
def box_uv(img, k, u, v, w, h, d, face):
    """One face of a box-UV cube (the Java ModelPart / Bedrock texture layout)."""
    x, y, fw, fh = {'up': (u + d, v, w, d), 'north': (u + d, v + d, w, h), 'west': (u + d + w, v + d, d, h),
                    'south': (u + d + w + d, v + d, w, h), 'east': (u, v + d, d, h)}[face]
    return img.crop((round(x * k), round(y * k), round((x + fw) * k), round((y + fh) * k)))


def geo_icon(img, cubes, k=1):
    """cubes: (origin, size, uv) with y up and the model's front facing north. It is turned
    180 degrees so the front faces the viewer's left, the way the inventory shows a chest."""
    boxes = []
    for o, s, uv in cubes:
        w, h, d = s
        o = (-(o[0] + w), o[1], -(o[2] + d))  # north -> south, west -> east
        faces = {'up': box_uv(img, k, uv[0], uv[1], w, h, d, 'up').rotate(180),
                 'left': box_uv(img, k, uv[0], uv[1], w, h, d, 'north'),
                 'right': box_uv(img, k, uv[0], uv[1], w, h, d, 'west')}
        boxes.append((o, s, faces))
    mn = [min(b[0][i] for b in boxes) for i in range(3)]
    mx = [max(b[0][i] + b[1][i] for b in boxes) for i in range(3)]
    R = max(mx[0] - mn[0], mx[2] - mn[2])
    room = (R, mx[1] - mn[1], R)
    off = (-mn[0] + (R - (mx[0] - mn[0])) / 2, -mn[1], -mn[2] + (R - (mx[2] - mn[2])) / 2)
    cv = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    far = lambda b: (2 * b[0][0] + b[1][0] + 2 * b[0][2] + b[1][2], 2 * b[0][1] + b[1][1])
    for o, s, faces in sorted(boxes, key=far):
        frm = (o[0] + off[0], o[1] + off[1], o[2] + off[2])
        iso_box(faces, frm, (frm[0] + s[0], frm[1] + s[1], frm[2] + s[2]), room=room, cv=cv)
    return cv


def etex(path):
    return Image.open(z.open(A + 'textures/' + path + '.png')).convert('RGBA')


def special_icon(item_id, sp):
    kind = short(sp.get('type', ''))
    if kind == 'chest':  # base, lid, latch
        img = etex('entity/chest/' + short(sp['texture']))
        return geo_icon(img, [((1, 0, 1), (14, 10, 14), (0, 19)), ((1, 9, 1), (14, 5, 14), (0, 0)), ((7, 7, 0), (2, 4, 1), (0, 0))], img.width / 64)
    if kind == 'shulker_box':  # base, then the lid over it
        img = etex('entity/shulker/' + short(sp['texture']))
        return geo_icon(img, [((0, 0, 0), (16, 8, 16), (0, 28)), ((0, 4, 0), (16, 12, 16), (0, 0))], img.width / 64)
    if kind == 'copper_golem_statue':  # the golem's own model (mc-mob3d.json), eyes laid on
        stage = next((x for x in ('exposed', 'weathered', 'oxidized') if x in item_id), '')
        sfx = '_' + stage if stage else ''
        img = etex('entity/copper_golem/copper_golem' + sfx)
        img.alpha_composite(etex('entity/copper_golem/copper_golem_eyes' + sfx))
        geo = json.load(open(os.path.join(SITE, 'mc-mob3d.json'), encoding='utf-8'))['geo']['geometry.copper_golem']
        return geo_icon(img, [(c['o'], c['s'], c['u']) for b in geo['b'] for c in b.get('c', [])], img.width / geo['w'])
    if kind == 'conduit':
        img = etex('entity/conduit/base')
        return geo_icon(img, [((0, 0, 0), (6, 6, 6), (0, 0))], img.width / 32)
    if kind == 'head' and sp.get('kind') == 'piglin':  # head + snout
        img = etex('entity/piglin/piglin')
        return geo_icon(img, [((-5, 0, -4), (10, 8, 8), (0, 0)), ((-2, 0, -5), (4, 4, 1), (31, 1))], img.width / 64)
    if kind == 'head' and sp.get('kind') == 'dragon':  # head, snout, jaw
        img = etex('entity/enderdragon/dragon')
        return geo_icon(img, [((-8, -8, -10), (16, 16, 16), (112, 30)), ((-6, -4, -24), (12, 5, 16), (176, 44)),
                              ((-6, -8, -24), (12, 4, 16), (176, 65))], img.width / 256)
    if kind == 'decorated_pot':  # body (its plain side texture), then the neck and rim from the base texture
        side = etex('entity/decorated_pot/decorated_pot_side')
        base = etex('entity/decorated_pot/decorated_pot_base')
        k = base.width / 32
        ks = side.width / 16
        body = side.crop((round(1 * ks), 0, round(15 * ks), round(16 * ks)))
        room = (16, 21, 16)
        cv = iso_box({'up': base.crop((0, round(13 * k), round(14 * k), round(27 * k))), 'left': body, 'right': body}, (1, 0, 1), (15, 16, 15), room=room)
        for o, s_, uv in (((4, 16, 4), (8, 3, 8), (0, 0)), ((3, 19, 3), (10, 2, 10), (0, 5))):
            w, h, d = s_
            f = lambda n: box_uv(base, k, uv[0], uv[1], w, h, d, n)
            iso_box({'up': f('up'), 'left': f('south'), 'right': f('east')}, o, (o[0] + w, o[1] + h, o[2] + d), room=room, cv=cv)
        return cv
    return None


# DyeColor's texture colours (banner cloth)
DYES = {'white': 0xF9FFFE, 'orange': 0xF9801D, 'magenta': 0xC74EBD, 'light_blue': 0x3AB3DA, 'yellow': 0xFED83D, 'lime': 0x80C71F,
        'pink': 0xF38BAA, 'gray': 0x474F52, 'light_gray': 0x9D9D97, 'cyan': 0x169C9C, 'purple': 0x8932B8, 'blue': 0x3C44AA,
        'brown': 0x835432, 'green': 0x5E7C16, 'red': 0xB02E26, 'black': 0x1D1D21}


def build(item_id):
    p = A + 'items/%s.json' % item_id
    if p not in names:
        return None, 'no item definition in this jar'
    node = rj(p)['model']
    if short(node.get('type', '')) == 'composite' and item_id.endswith('_bed'):
        return bed_icon(item_id), 'bed'
    m = first_model(node)
    if short(m.get('type', '')) == 'special':
        if item_id.endswith('_banner'):
            return banner_icon(argb(DYES.get(item_id[:-7], 0xF9FFFE))), 'banner'
        im = special_icon(item_id, m.get('model', {}))
        return im, 'special' if im else 'special renderer (%s)' % m.get('model', {}).get('type')
    chain = model_chain(m['model'])
    tints = m.get('tints', [])
    root = chain[-1].get('__builtin', '')
    parents = [short(c.get('parent', '')) for c in chain] + [root]
    if any(p in ('item/generated', 'item/handheld', 'builtin/generated') for p in parents):
        return flat_icon(chain, tints), 'flat'
    return block_icon(chain, tints), 'block'


def all_items():
    return sorted(n[len(A) + 6:-5] for n in names if n.startswith(A + 'items/') and n.endswith('.json'))


if __name__ == '__main__':
    ids = all_items()
    json.dump(ids, open(os.path.join(SITE, 'mc-item-ids.json'), 'w', encoding='utf-8'), separators=(',', ':'))
    made, skipped, failed = [], [], []
    for i in ids:
        if i == 'air':  # nothing to draw
            continue
        dst = os.path.join(OUT, i + '.png')
        if os.path.exists(dst):
            skipped.append(i)
            continue
        try:
            im, how = build(i)
        except Exception as e:  # report and keep going
            im, how = None, 'error: %s' % e
        if im is None:
            failed.append('%s (%s)' % (i, how))
            continue
        im.save(dst)
        made.append('%s:%s' % (i, how))
    print('items %d, made %d' % (len(ids), len(made)))
    print('already there %d' % len(skipped))
    print('failed %d: %s' % (len(failed), '; '.join(failed)))
