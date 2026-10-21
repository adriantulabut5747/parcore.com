"""Build the mob summoner's 3D models (Oct 15 2026).

Reads Mojang's official Bedrock sample pack (github.com/Mojang/bedrock-samples) and writes
  site/mc-mob3d.json                 every mob's geometry (adult + baby) and texture paths
  site/minecrafticons/mobs3d/*.png   the textures, with layered ones (villager clothes,
                                     horse markings...) flattened into one picture

Bedrock is used because its models are data (JSON); Java's are code. They match Java's
look for almost every mob. Each mob's client entity file names its geometries and
textures; its render controllers pick between them with Molang expressions. Those are
evaluated here with every query false / 0 except query.is_baby, i.e. the mob's default
look: first variant, not sheared, no saddle.

Run (needs Pillow):   python _tools/mobs3d/build.py
The sample pack is sparse-cloned once into Downloads/parcore.com/_cache/ (outside the repo):
  git clone --depth 1 --filter=blob:none --sparse https://github.com/Mojang/bedrock-samples.git
  git sparse-checkout set resource_pack/entity resource_pack/models/entity
      resource_pack/textures/entity resource_pack/render_controllers resource_pack/animations
"""
import json, math, os, re, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..'))
SITE = os.path.join(REPO, 'site')
RP = os.path.normpath(os.path.join(REPO, '..', '_cache', 'bedrock-samples', 'resource_pack'))
OUT_TEX = os.path.join(SITE, 'minecrafticons', 'mobs3d')

# mc-mobs.json id -> Bedrock identifier, where they differ
ALIAS = {
    'zombified_piglin': 'zombie_pigman', 'evoker': 'evocation_illager', 'tropical_fish': 'tropicalfish',
    'villager': 'villager_v2', 'zombie_villager': 'zombie_villager_v2', 'illusioner': 'evocation_illager',
    'giant': 'zombie', 'mooshroom': 'mooshroom', 'snow_golem': 'snow_golem',
}
# Molang variables that are true for a freshly spawned mob (everything else reads 0 / false).
TRUE_VARS = {'variable.goat_has_left_horn', 'variable.goat_has_right_horn'}


def load_json(path):
    t = open(path, encoding='utf-8-sig').read()
    t = re.sub(r'(?m)^\s*//.*$', '', t)          # Mojang's files carry // comments,
    t = re.sub(r'(?m)\s//[^"\n]*$', '', t)       # also at the end of a line
    t = re.sub(r',(\s*[}\]])', r'\1', t)          # and the odd trailing comma
    return json.loads(t)


# ---------------------------------------------------------------- Molang (a tiny subset)
class Molang:
    """cond ? a : b, ||, &&, ==, !=, <, >, !, (), numbers, Array.x[i], Texture.x, Geometry.x,
    query.* / variable.* / v.* / q.* (0, except query.is_baby). Enough for render controllers."""

    def __init__(self, expr, baby, arrays, env=None):
        self.env = env or {}
        self.t = re.findall(r'\d+\.\d+|\d+|[A-Za-z_][\w.]*|==|!=|<=|>=|&&|\|\||[?:()\[\],;!<>+\-*/]', expr)
        self.i, self.baby, self.arrays = 0, baby, arrays

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else None

    def take(self):
        self.i += 1
        return self.t[self.i - 1] if self.i <= len(self.t) else None

    def run(self):
        return self.ternary()

    def ternary(self):
        c = self.orr()
        if self.peek() == '?':
            self.take(); a = self.ternary(); self.take(); b = self.ternary()
            return a if truthy(c) else b
        return c

    def orr(self):
        v = self.andd()
        while self.peek() == '||':
            self.take(); w = self.andd(); v = truthy(v) or truthy(w)
        return v

    def andd(self):
        v = self.cmp()
        while self.peek() == '&&':
            self.take(); w = self.cmp(); v = truthy(v) and truthy(w)
        return v

    def cmp(self):
        v = self.add()
        while self.peek() in ('==', '!=', '<', '>', '<=', '>='):
            op = self.take(); w = self.add()
            v = {'==': v == w, '!=': v != w, '<': num(v) < num(w), '>': num(v) > num(w), '<=': num(v) <= num(w), '>=': num(v) >= num(w)}[op]
        return v

    def add(self):
        v = self.mul()
        while self.peek() in ('+', '-'):
            op = self.take(); w = self.mul()
            v = num(v) + num(w) if op == '+' else num(v) - num(w)
        return v

    def mul(self):
        v = self.unary()
        while self.peek() in ('*', '/'):
            op = self.take(); w = self.unary()
            v = num(v) * num(w) if op == '*' else (num(v) / num(w) if num(w) else 0.0)
        return v

    def args(self):
        out = []
        self.take()                                 # (
        while self.peek() not in (')', None):
            out.append(num(self.ternary()))
            if self.peek() == ',':
                self.take()
        self.take()                                 # )
        return out

    def unary(self):
        p = self.peek()
        if p == '!':
            self.take(); return not truthy(self.unary())
        if p == '-':
            self.take(); return -num(self.unary())
        if p == '(':
            self.take(); v = self.ternary(); self.take(); return v
        tok = self.take()
        if tok is None:
            return 0
        if re.match(r'\d', tok):
            return float(tok)
        low = tok.lower()
        if low.startswith('array.'):
            idx = 0
            if self.peek() == '[':
                self.take(); idx = int(num(self.ternary())); self.take()
            arr = self.arrays.get(tok) or self.arrays.get(low) or []
            if not arr:
                return None
            return Molang(arr[max(0, min(idx, len(arr) - 1))], self.baby, self.arrays, self.env).run()
        if low.startswith(('texture.', 'geometry.', 'material.')):
            return tok
        if low in ('query.is_baby', 'q.is_baby'):
            return 1.0 if self.baby else 0.0
        if low.startswith(('query.', 'q.')) and self.peek() != '(':
            key = 'query.' + low.split('.', 1)[1]
            if key in self.env:
                return self.env[key]
        if low in ('true',) or low in TRUE_VARS:
            return 1.0
        if low.startswith(('variable.', 'v.')):
            key = 'variable.' + low.split('.', 1)[1]
            if key in self.env:
                return self.env[key]
        if low == 'this':                           # see pose()
            return self.env.get('this', 0.0)
        if low == 'math.pi':
            return math.pi
        if low.startswith('math.') and self.peek() == '(':
            args = self.args()
            try:
                return float(MATH.get(low[5:], lambda *a: 0.0)(*args) or 0.0)
            except (TypeError, ValueError, OverflowError, ZeroDivisionError):
                return 0.0
        if self.peek() == '(':                    # query.something(args): skip the call
            depth = 0
            while True:
                x = self.take()
                if x == '(':
                    depth += 1
                elif x == ')':
                    depth -= 1
                    if depth == 0:
                        break
        return 0.0


# Molang math: angles in degrees. Random picks the middle of its range.
MATH = {
    'cos': lambda a=0: math.cos(math.radians(a)), 'sin': lambda a=0: math.sin(math.radians(a)),
    'abs': lambda a=0: abs(a), 'sqrt': lambda a=0: math.sqrt(max(a, 0)), 'floor': lambda a=0: math.floor(a),
    'ceil': lambda a=0: math.ceil(a), 'round': lambda a=0: round(a), 'trunc': lambda a=0: int(a),
    'clamp': lambda v=0, a=0, b=0: max(a, min(b, v)), 'lerp': lambda a=0, b=0, t=0: a + (b - a) * t,
    'lerprotate': lambda a=0, b=0, t=0: a + (b - a) * t, 'min': lambda a=0, b=0: min(a, b), 'max': lambda a=0, b=0: max(a, b),
    'mod': lambda a=0, b=1: math.fmod(a, b) if b else 0.0, 'pow': lambda a=0, b=1: a ** b, 'exp': lambda a=0: math.exp(a),
    'random': lambda a=0, b=0: (a + b) / 2, 'random_integer': lambda a=0, b=0: a, 'die_roll': lambda *a: 0.0,
    'hermite_blend': lambda t=0: 3 * t * t - 2 * t * t * t, 'atan': lambda a=0: math.degrees(math.atan(a)),
    'atan2': lambda a=0, b=0: math.degrees(math.atan2(a, b)), 'asin': lambda a=0: math.degrees(math.asin(max(-1, min(1, a)))),
    'acos': lambda a=0: math.degrees(math.acos(max(-1, min(1, a)))),
}


def truthy(v):
    return bool(v) and v != 0.0


def num(v):
    return v if isinstance(v, float) else (1.0 if v is True else 0.0 if not v else 0.0)


# ---------------------------------------------------------------- geometry
GEO = {}


def read_geometries():
    for root, _, files in os.walk(os.path.join(RP, 'models', 'entity')):
        for f in files:
            if not f.endswith('.json'):
                continue
            d = load_json(os.path.join(root, f))
            legacy = str(d.get('format_version', '1.8.0')).split('.')[:2] in (['1', '8'], ['1', '10'])
            if 'minecraft:geometry' in d:
                for g in d['minecraft:geometry']:
                    desc = g['description']
                    GEO[desc['identifier']] = {'w': desc.get('texture_width', 64), 'h': desc.get('texture_height', 32), 'bones': g.get('bones', []), 'parent': None, 'legacy': legacy}
            else:                                  # legacy 1.8 format, "geometry.x:geometry.parent"
                for k, g in d.items():
                    if not k.startswith('geometry.') or not isinstance(g, dict):
                        continue
                    name, _, parent = k.partition(':')
                    # no texturewidth/height declared: the texture's own size is used (the sheep's 64x64 wool)
                    GEO[name] = {'w': g.get('texturewidth'), 'h': g.get('textureheight'), 'bones': g.get('bones', []), 'parent': parent or None, 'legacy': legacy}


def resolve_geo(name):
    g = GEO.get(name)
    if not g:
        return None
    bones = [dict(b) for b in g['bones']]
    if g['parent']:
        p = resolve_geo(g['parent'])
        if p:
            by = {b['name']: b for b in p['bones']}
            for b in bones:                         # a child bone with the same name extends the parent's
                if b['name'] in by:
                    old = by[b['name']]
                    merged = dict(old); merged.update(b)
                    # both have boxes: draw both (the sheep's wool goes over its skin), unless they're the same boxes
                    if old.get('cubes') and b.get('cubes') and old['cubes'] != b['cubes']:
                        merged['cubes'] = old['cubes'] + b['cubes']
                    by[b['name']] = merged
                else:
                    by[b['name']] = b
            bones = list(by.values())
            return {'w': g['w'] or p['w'], 'h': g['h'] or p['h'], 'bones': bones, 'legacy': g['legacy']}
    return {'w': g['w'], 'h': g['h'], 'bones': bones, 'legacy': g['legacy']}


def r(v):
    return round(v, 4) if isinstance(v, float) else v


def compact(geo, gid=''):
    """Only what the renderer uses, short keys."""
    out = []
    opens = OPEN.get(gid, {})
    for b in geo['bones']:
        if b.get('neverRender'):
            continue
        cb = {'n': b['name'].lower()}
        if b.get('parent'):
            cb['p'] = b['parent'].lower()
        if b.get('pivot'):
            cb['v'] = [r(x) for x in b['pivot']]
        rot = b.get('rotation') or b.get('bind_pose_rotation')
        if rot and any(rot):
            cb['r'] = [r(x) for x in rot]
        if b.get('mirror'):
            cb['m'] = 1
        cubes = []
        for ci, c in enumerate(b.get('cubes', [])):
            cc = {'o': [r(x) for x in c['origin']], 's': [r(x) for x in c['size']], 'u': c.get('uv', [0, 0])}
            if c.get('inflate'):
                cc['i'] = r(c['inflate'])
            if 'mirror' in c:
                cc['m'] = 1 if c['mirror'] else 0
            if ci in opens.get(b['name'].lower(), {}):
                cc['x'] = opens[b['name'].lower()][ci]
            if c.get('rotation') and any(c['rotation']):
                cc['r'] = [r(x) for x in c['rotation']]
                cc['v'] = [r(x) for x in c.get('pivot') or [c['origin'][k] + c['size'][k] / 2 for k in range(3)]]
            cubes.append(cc)
        if cubes:
            cb['c'] = cubes
        loc = {k.lower(): v for k, v in (b.get('locators') or {}).items() if k.lower() in ('rightitem', 'leftitem')}
        if loc:
            cb['l'] = {k: (v['offset'] if isinstance(v, dict) else v) for k, v in loc.items()}
        cb.update(GEO_FIX.get(gid, {}).get(cb['n'], {}))
        out.append(cb)
    res = {'w': geo['w'] or 0, 'h': geo['h'] or 0, 'b': out}       # 0: use the texture's size
    if geo.get('legacy'):
        res['l'] = 1                                # 1.8 / 1.10 format: a bone's own rotation doesn't turn its children
    return res


# ---------------------------------------------------------------- animations -> starting pose
ANIMS, CTRLS = {}, {}


def read_anims():
    for f in os.listdir(os.path.join(RP, 'animation_controllers')):
        if f.endswith('.json'):
            try:
                CTRLS.update(load_json(os.path.join(RP, 'animation_controllers', f)).get('animation_controllers', {}))
            except ValueError as e:
                print('skipped', f, e)
    for f in os.listdir(os.path.join(RP, 'animations')):
        if f.endswith('.json'):
            try:
                ANIMS.update(load_json(os.path.join(RP, 'animations', f)).get('animations', {}))
            except ValueError as e:                 # a few files have comments mid-line
                print('skipped', f, e)


def variables(desc, baby, env):
    """Adds the v.* values the mob's initialize / pre_animation scripts set (statements like v.x = expr;)."""
    sc = desc.get('scripts', {})
    for key in ('initialize', 'pre_animation'):
        for line in sc.get(key, []):
            for st in str(line).split(';'):
                m = re.match(r'\s*(?:v|variable)\.(\w+)\s*=\s*(.+)$', st, re.S)
                if m:
                    env['variable.' + m.group(1).lower()] = num(Molang(m.group(2), baby, {}, env).run())
    return env


def first_key(ch):
    if isinstance(ch, dict):                        # keyframes: the first one
        if not ch:
            return None
        k = sorted(ch, key=lambda x: float(x) if re.match(r'^-?[\d.]+$', x) else 0)[0]
        ch = ch[k]
        if isinstance(ch, dict):
            ch = ch.get('post', ch.get('pre'))
    return ch


# Mobs that can't be babies in game, though their Bedrock look has one (the giant borrows the zombie's).
NO_BABY = {'giant'}
# Babies that reuse the adult model, drawn at this size (the ghastling is about a quarter of a happy ghast).
BABY_SIZE = {'happy_ghast': 0.25}

# Variables the game server sets for a mob (Bedrock "actor state"), here as a mob standing still.
# Cats and ocelots: 0 sneak, 1 sprint, 2 sit, 3 walk (at speed 0 = standing), 4 lie down.
# Shulkers: query.variant picks the colour; 16 = undyed, the natural purple (0 would be black).
VARS = {'cat': {'variable.state': 3.0}, 'ocelot': {'variable.state': 3.0}, 'shulker': {'query.variant': 16.0}}

# What the data can't say: Java sets these in code (setupAnim) and Bedrock's engine matches it.
# {mob: {bone: {r: rotation, p: position, o: rotation of the bone's own cubes only}}}, in Bedrock axes
# (degrees = Java's radians, same sign). Each value replaces what the animations gave that bone.
# "o" leaves child bones where they are (the polar bear's head and legs hang off its body).
# Values read from Java 26.3's model classes (createBodyLayer / setupAnim), adults only.
FELINE = {'body': {'o': [90, 0, 0]},                # AdultFelineModel: body.xRot = 90 degrees,
          'tail1': {'r': [51.57, 0, 0]},            # tail1.xRot = 0.9 (Bedrock's walk anim has -0.9: under the belly)
          'tail2': {'r': [99.0, 0, 0]}}             # tail2.xRot = 1.7279 standing (it hangs off body, see GEO_FIX)
FIX = {
    'polar_bear': {'body': {'o': [90, 0, 0]}},      # PolarBearModel: body.xRot = 90 degrees
    'cat': FELINE, 'ocelot': FELINE,
    'llama': {'body': {'o': [90, 0, 0]}},           # LlamaModel: body.xRot = 90 degrees
    'trader_llama': {'body': {'o': [90, 0, 0]}},
    'fox': {'body': {'o': [90, 0, 0]},              # AdultFoxModel: body.xRot = 90 degrees; the tail is a child
           'tail': {'r': [87, 0, 0]}},              # of the body there, so it turns 90 too, then its own -3
    'wolf': {'tail': {'r': [36, 0, 0]}},            # WolfModel: tail.xRot = tailAngle, pi/5 for a wild wolf
}

# Bones whose Bedrock layout is engine code; replaced with Java's ({geometry: {bone: compact fields}}).
# Snow golem: Bedrock stacks both arms in one spot. SnowGolemModel: arms pivot at x = +-5, y = 6,
# zRot +-1.0 rad, the right one turned around (yRot = pi). Cat / ocelot: Java's tail2 is its own part
# at (0, 20, 14), not a child of tail1.
ARM = {'s': [12, 2, 2], 'u': [32, 0], 'i': -0.5}
TAIL2 = {'p': 'body', 'v': [0, 4, 14], 'c': [{'o': [-0.5, -4, 14], 's': [1, 8, 1], 'u': [4, 15]}]}
GEO_FIX = {
    'geometry.snowgolem.v1.8': {'arm1': {'v': [5, 18, 0], 'r': [0, 0, 57.2958], 'c': [dict(ARM, o=[4, 16, -1])]},
                                'arm2': {'v': [-5, 18, 0], 'r': [0, 180, -57.2958], 'c': [dict(ARM, o=[-6, 16, -1])]}},
    'geometry.ocelot.v1.8': {'tail2': TAIL2},
    'geometry.cat': {'tail2': TAIL2},
    # villager_v2 leaves the hat brim standing up (its animation lays it down); VillagerModel: hat_rim xRot = -pi/2
    'geometry.villager_v2': {'brim': {'r': [-90.0, 0.0, 0.0]}},
}

# Eyes kept in the skin's alpha as a glow mask (alpha 3 to 18): drawn solid, or they'd be holes.
# Only these mobs: cats, wolves, llamas... use low alpha for masks that must stay clear.
GLOW_EYES = {'spider', 'cave_spider', 'enderman', 'phantom'}


def java_dragon(flap=0.0):
    """EnderDragonModel (Java 26.3) as a Bedrock geometry. Bedrock's dragon has one neck bone and no tail:
    its engine draws the 5 neck and 12 tail pieces as copies. Here every part is built from Java's
    createBodyLayer, posed by its setupAnim for a dragon hovering in place (flight history all equal,
    so only the wing-beat terms are left) at this point of a wing beat (0..1)."""
    f = flap * 2 * math.pi
    g = math.sin(f - 1) + 1
    g = (g * g + g * 2) * 0.05
    bones, at = [], {}

    def part(name, parent, off, rot, boxes):
        # off: Java offset from the parent's pivot (y points down); boxes: (x, y, z, w, h, d, u, v[, mirror])
        pp = at[parent] if parent else [0, 24, 0]
        v = [pp[0] + off[0], pp[1] - off[1], pp[2] + off[2]]
        at[name] = v
        b = {'n': name, 'v': [r(float(x)) for x in v]}
        if parent:
            b['p'] = parent
        if any(rot):
            b['r'] = [r(math.degrees(a)) for a in rot]
        b['c'] = []
        for x, y, z, w, h, d, u, uv, *m in boxes:
            c = {'o': [r(float(v[0] + x)), r(float(v[1] - y - h)), r(float(v[2] + z))], 's': [w, h, d], 'u': [u, uv]}
            if m:
                c['m'] = 1
            b['c'].append(c)
        bones.append(b)

    piece = [(-5, -5, -5, 10, 10, 10, 192, 104), (-1, -9, -3, 2, 4, 6, 48, 0)]
    x, y, z = 0.0, 20.0, -12.0
    for k in range(5):
        xr = math.cos(k * 0.45 + f) * 0.15
        part('neck%d' % k, None, [x, y, z], [xr, 0, 0], piece)
        y += math.sin(xr) * 10
        z -= math.cos(xr) * 10
    part('head', None, [x, y, z], [0, 0, 0], [(-6, -1, -24, 12, 5, 16, 176, 44), (-8, -8, -10, 16, 16, 16, 112, 30),
                                             (-5, -12, -4, 2, 4, 6, 0, 0, 1), (-5, -3, -22, 2, 2, 4, 112, 0, 1),
                                             (3, -12, -4, 2, 4, 6, 0, 0), (3, -3, -22, 2, 2, 4, 112, 0)])
    part('jaw', 'head', [0, 4, -8], [(math.sin(f) + 1) * 0.2, 0, 0], [(-6, 0, -16, 12, 4, 16, 176, 65)])
    x, y, z, j = 0.0, 10.0, 60.0, 0.0
    for k in range(12):
        j += math.sin(k * 0.45 + f) * 0.05
        part('tail%d' % k, None, [x, y, z], [j, math.pi, 0], piece)
        y += math.sin(j) * 10
        z += math.cos(j) * 10
    part('body', None, [0, 20, 8], [0, 0, 0], [(-12, -16, -16, 24, 24, 64, 0, 0), (-1, -22, -10, 2, 6, 12, 220, 53),
                                              (-1, -22, 10, 2, 6, 12, 220, 53), (-1, -22, 30, 2, 6, 12, 220, 53)])
    wx, wz, tip = 0.125 - math.cos(f) * 0.2, -(math.sin(f) + 0.125) * 0.8, (math.sin(f + 2) + 0.5) * 0.75
    for s, side in ((1, 'left'), (-1, 'right')):
        m = (1,) if s > 0 else ()                   # Java mirrors the left wing's texture
        o = 0 if s > 0 else -56
        part(side + '_wing', 'body', [12 * s, -15, -6], [wx, -0.25 * s, wz * s],
             [(o, -4, -4, 56, 8, 8, 112, 88) + m, (o, 0, 2, 56, 0, 56, -56, 88) + m])
        part(side + '_wing_tip', side + '_wing', [56 * s, 0, 0], [0, 0, tip * s],
             [(o, -2, -2, 56, 4, 4, 112, 136) + m, (o, 0, 2, 56, 0, 56, -56, 144) + m])
        part(side + '_front_leg', 'body', [12 * s, 0, -6], [1.3 + g * 0.1, 0, 0], [(-4, -4, -4, 8, 24, 8, 112, 104)])
        part(side + '_front_leg_tip', side + '_front_leg', [0, 20, -1], [-0.5 - g * 0.1, 0, 0], [(-3, -1, -3, 6, 24, 6, 226, 138)])
        part(side + '_front_foot', side + '_front_leg_tip', [0, 23, 0], [0.75 + g * 0.1, 0, 0], [(-4, 0, -12, 8, 4, 16, 144, 104)])
        part(side + '_hind_leg', 'body', [16 * s, -4, 34], [1.0 + g * 0.1, 0, 0], [(-8, -4, -8, 16, 32, 16, 0, 0)])
        part(side + '_hind_leg_tip', side + '_hind_leg', [0, 32, -4], [0.5 + g * 0.1, 0, 0], [(-6, -2, 0, 12, 32, 12, 196, 0)])
        part(side + '_hind_foot', side + '_hind_leg_tip', [0, 31, 4], [0.75 + g * 0.1, 0, 0], [(-9, 0, -20, 18, 6, 24, 112, 0)])
    return {'w': 256, 'h': 256, 'b': bones}


# Mobs drawn from a Java-built geometry instead of their Bedrock one (no Bedrock pose then).
JAVA_GEO = {'ender_dragon': ('geometry.ender_dragon.java', java_dragon)}

def rest_env(desc, baby, water, mid, hp):
    """What Molang reads for a freshly summoned mob standing still: on the ground, alive, at full
    health, in water for water mobs, plus the v.* its scripts set."""
    env = {'query.is_on_ground': 1.0, 'query.is_alive': 1.0, 'query.is_in_water': 1.0 if water else 0.0,
           'query.is_in_water_or_rain': 1.0 if water else 0.0, 'query.health': hp, 'query.max_health': hp}
    env.update(VARS.get(mid, {}))
    variables(desc, baby, env)
    return env


def pose(desc, baby, geo, env, mid):
    """The mob's resting pose: the animations that play while it stands still, at time 0.
    Blaze rods, guardian spikes, spider legs... are placed this way, not in the model file.
    What plays: the scripts.animate list, or (older entities) the animation controllers' starting
    states, or with neither, every animation the mob names. Conditions read a mob standing on the
    ground (in water, for water mobs), not moving, not sitting."""
    names = desc.get('animations', {})
    # "this" in a position formula = the bone's resting offset from its parent's pivot; a top-level bone
    # measures from (0, 24, 0). So "-16 - this" on a wolf leg resting at 8 is 0: no change.
    piv = {b['n']: b.get('v', [0, 0, 0]) for b in geo['b']}
    rest = {}
    for b in geo['b']:
        pp = piv.get(b.get('p'), [0, 24, 0]) if b.get('p') else [0, 24, 0]
        rest[b['n']] = [piv[b['n']][i] - pp[i] for i in range(3)]
    out = {}
    sc = desc.get('scripts', {})
    if 'animate' in sc:
        entries = sc['animate']
    elif desc.get('animation_controllers'):
        entries = [list(c.values())[0] for c in desc['animation_controllers']]
    else:
        entries = list(names)

    def play(entry, depth=0):
        if depth > 6:
            return
        if isinstance(entry, dict):                 # {"anim": "condition", ...}
            for name, cond in entry.items():
                if truthy(Molang(str(cond), baby, {}, env).run()):
                    play(name, depth + 1)
            return
        else:
            name = entry
        aid = names.get(name, name)
        if aid.startswith('controller.'):
            ctrl = CTRLS.get(aid)
            if ctrl:
                states = ctrl.get('states', {})
                name = ctrl.get('initial_state', 'default')
                for _ in range(8):                  # a controller moves on at once if a transition is true
                    nxt = None
                    for tr in states.get(name, {}).get('transitions', []):
                        for to, cond in tr.items():
                            if nxt is None and truthy(Molang(str(cond), baby, {}, env).run()):
                                nxt = to
                    if nxt is None or nxt == name:
                        break
                    name = nxt
                for e in states.get(name, {}).get('animations', []):
                    play(e, depth + 1)
            return
        anim = ANIMS.get(aid)
        if not anim:
            return
        for bone, chans in anim.get('bones', {}).items():
            bn = bone.lower()
            b = out.setdefault(bn, {'p': [0, 0, 0], 'r': [0, 0, 0], 's': [1, 1, 1]})
            for kind, key in (('position', 'p'), ('rotation', 'r'), ('scale', 's')):
                v = first_key(chans.get(kind))
                if v is None:
                    continue
                vals = v if isinstance(v, list) else [v, v, v]
                for i in range(3):
                    x = vals[i]
                    # "this": for a position, the resting offset (above); for a rotation, 0
                    e2 = dict(env, this=float(rest.get(bn, [0, 0, 0])[i]) if key == 'p' else 0.0)
                    a0 = float(x) if isinstance(x, (int, float)) else num(Molang(str(x), baby, {}, e2).run())
                    if key == 's':
                        b[key][i] *= a0 or 1.0      # 0 = a variable the game sets (happy ghast's v.scale): keep size
                    else:
                        b[key][i] += a0

    for entry in entries:
        play(entry)
    if not baby:
        for bone, fx in FIX.get(mid, {}).items():
            b = out.setdefault(bone, {'p': [0, 0, 0], 'r': [0, 0, 0], 's': [1, 1, 1]})
            b.update(fx)
    clean = {}
    for bone, b in out.items():
        c = {k: [r(x) for x in v] for k, v in b.items() if v != ([1, 1, 1] if k == 's' else [0, 0, 0])}
        if c:
            clean[bone] = c
    return clean


# ---------------------------------------------------------------- entities + render controllers
def read_rcs():
    rcs = {}
    for f in os.listdir(os.path.join(RP, 'render_controllers')):
        d = load_json(os.path.join(RP, 'render_controllers', f))
        rcs.update(d.get('render_controllers', {}))
    return rcs


def read_entities():
    """identifier -> description, preferring the newest file (no v1.0, highest _vN)."""
    best = {}
    for f in os.listdir(os.path.join(RP, 'entity')):
        d = load_json(os.path.join(RP, 'entity', f)).get('minecraft:client_entity', {}).get('description')
        if not d:
            continue
        ident = d['identifier'].split(':')[-1]
        rank = (0 if 'v1.0' in f else 1, int((re.findall(r'_v(\d)', f) or ['0'])[0]))
        if ident not in best or rank > best[ident][0]:
            best[ident] = (rank, d, f)
    return {k: v[1] for k, v in best.items()}


def tex_file(path):
    for ext in ('.png', '.tga'):
        p = os.path.join(RP, path.replace('/', os.sep) + ext)
        if os.path.exists(p):
            return p
    return None


def look(desc, rcs, baby, env=None):
    """[(geometry id, [texture paths, bottom first], {h: hidden bones, o: only these bones}), ...].
    Each render controller is one draw of a model; its part_visibility only applies to that draw.
    Draws of the same model with no visibility rules are stacked into one texture (villager clothes)."""
    geos, texs, parts = desc.get('geometry', {}), desc.get('textures', {}), []
    for name in desc.get('render_controllers', []):
        if isinstance(name, dict):                  # {"controller": "condition"}
            (name, cond), = name.items()
            if not truthy(Molang(cond, baby, {}, env).run()):
                continue
        rc = rcs.get(name) or {'geometry': 'Geometry.default', 'textures': ['Texture.default']}  # not in the samples
        arrays = {}
        for kind in rc.get('arrays', {}).values():
            arrays.update(kind)
        g = Molang(rc.get('geometry', 'Geometry.default'), baby, arrays, env).run()
        gid = geos.get(str(g).split('.', 1)[-1]) if g else None
        if not gid:
            continue
        tl = []
        for e in rc.get('textures', []):
            t = Molang(e, baby, arrays, env).run()
            p = texs.get(str(t).split('.', 1)[-1]) if t else None
            if p and tex_file(p):
                tl.append(p)
        star, vis = True, {}
        for pv in rc.get('part_visibility', []):
            for bone, cond in pv.items():
                v = truthy(cond if isinstance(cond, bool) else Molang(str(cond), baby, arrays, env).run())
                if bone == '*':
                    star = v
                else:
                    vis[bone.lower()] = v
        shown = sorted(b for b, v in vis.items() if v)
        if not tl or (not star and not shown):
            continue                                # this draw shows nothing by default (eyes glow, saddle, shield)
        rule = {}
        if not star:
            rule['o'] = shown
        hidden = sorted(b for b, v in vis.items() if not v)
        if hidden and star:
            rule['h'] = hidden
        same = [x for x in parts if x[0] == gid and not x[2]]
        if same and not rule:
            same[0][1].extend(tl)                   # another layer on the same model (villager clothes)
        else:
            parts.append((gid, tl, rule))
    return parts


def scale_of(desc, baby):
    sc = desc.get('scripts', {}).get('scale')
    if sc is None:
        return 1.0
    return float(num(Molang(str(sc), baby, {}).run())) or 1.0


# Box faces left open: {geometry: {bone: {box index: [faces]}}}. Java's sheep wool texture is clear
# over the face; Bedrock's sheep texture has wool there, so the wool head box drops its front.
OPEN = {'geometry.sheep.v1.8': {'head': {1: ['north']}}}

# Layers the game tints at runtime (white textures + a colour), here one fixed look per mob, layer by layer.
# Tropical fish: Java's clownfish, orange body with white stripes.
TINT = {'tropical_fish': ['f9801d', 'f9fffe']}


def flatten(paths, out_name, tints=(), glow=False):
    base = None
    for n, p in enumerate(paths):
        im = Image.open(tex_file(p)).convert('RGBA')
        if n == 0 and glow:
            im.putalpha(im.getchannel('A').point(lambda a: 255 if 0 < a < 40 else a))
        if n < len(tints) and tints[n]:
            c = int(tints[n], 16)
            r, g, b, a = im.split()
            r = r.point(lambda v: v * (c >> 16 & 255) // 255)
            g = g.point(lambda v: v * (c >> 8 & 255) // 255)
            b = b.point(lambda v: v * (c & 255) // 255)
            im = Image.merge('RGBA', (r, g, b, a))
        if base is None and im.getextrema()[3][1] < 250:
            im.putalpha(255)                        # a base skin with no solid pixel: its alpha is a glow mask (blaze)
        if base is None:
            base = im
        else:
            if im.size != base.size:
                im = im.resize(base.size, Image.NEAREST)
            base.alpha_composite(im)
    base.save(os.path.join(OUT_TEX, out_name + '.png'), optimize=True)
    return '/minecrafticons/mobs3d/' + out_name + '.png'


# Looks with a model of their own that the render controllers pick by a query this script reads as 0:
# {mob: {the page's value for that look: geometry}}. Pufferfish PuffState 1 / 2; zombie nautilus variant
# (Java: temperate = the plain nautilus model, warm = the coral one).
LOOK_GEO = {
    'pufferfish': {'1': 'geometry.pufferfish.mid.v1.8', '2': 'geometry.pufferfish.large.v1.8'},
    'zombie_nautilus': {'temperate': 'geometry.nautilus', 'warm': 'geometry.zombie_nautilus_coral'},
}
# Gear models drawn on top of a mob (mc-mob3d.js gearParts): only in the file, no mob uses them alone.
GEAR_GEO = ['geometry.nautilus_saddle', 'geometry.nautilus_armor']


def main():
    if not os.path.isdir(RP):
        sys.exit('No sample pack at ' + RP + ' (see the docstring for the clone command).')
    os.makedirs(OUT_TEX, exist_ok=True)
    read_geometries()
    read_anims()
    rcs, ents = read_rcs(), read_entities()
    mobs = load_json(os.path.join(SITE, 'mc-mobs.json'))['mobs']
    out, used, missing = {}, {}, []
    for m in mobs:
        mid = m[0]
        desc = ents.get(ALIAS.get(mid, mid))
        if not desc:
            missing.append(mid)
            continue
        entry = {}
        for age, baby in (('a', False), ('b', True)):
            if baby and mid in NO_BABY:
                continue
            env = rest_env(desc, baby, m[2] == 'water', mid, float(m[6].get('max_health', 20)))
            parts = look(desc, rcs, baby, env)
            if baby and (not parts or parts == look(desc, rcs, False, rest_env(desc, False, m[2] == 'water', mid, float(m[6].get('max_health', 20))))):
                continue                            # no baby look of its own: the page scales the adult
            got = []
            for i, (gid, tl, rule) in enumerate(parts):
                if mid in JAVA_GEO:
                    gid, make = JAVA_GEO[mid]
                    used[gid] = make()
                else:
                    geo = resolve_geo(gid)
                    if not geo:
                        continue
                    used[gid] = compact(geo, gid)
                src = flatten(tl, mid + ('_baby' if baby else '') + ('' if i == 0 else '_%d' % i), TINT.get(mid, ()) if i == 0 else (),
                              mid in GLOW_EYES)
                tw, th = Image.open(os.path.join(SITE, src.lstrip('/'))).size
                gw, gh = used[gid]['w'], used[gid]['h']
                # no declared size, or a texture of other proportions (villagers: 64x32 declared, 64x64 drawn):
                # UVs are in the texture's pixels. Same proportions at a higher resolution scale as declared.
                if not gw or tw * gh != th * gw:
                    rule = dict(rule, t=[tw, th])
                got.append([gid, src] + ([rule] if rule else []))
            if got:
                entry[age] = {'p': got, 's': r(scale_of(desc, baby))}
                if baby and mid in BABY_SIZE:
                    entry[age]['z'] = BABY_SIZE[mid]   # the renderer draws this baby at z times its size
                # climate looks with a model of their own (warm cow's horns, cold chicken's comb): {variant: geometry},
                # used by the page when that variant is picked (skins.py copies their textures)
                vg = {k: g for k, g in desc.get('geometry', {}).items() if k in ('warm', 'cold') and not baby and g != gid}
                if not baby:
                    vg.update(LOOK_GEO.get(mid, {}))
                for g in vg.values():
                    used[g] = compact(resolve_geo(g), g)
                if vg:
                    entry[age]['g'] = vg
                ps = None if mid in JAVA_GEO else pose(desc, baby, used[got[0][0]], env, mid)
                if ps:
                    entry[age]['a'] = ps
        if entry:
            out[mid] = entry
        else:
            missing.append(mid)
    for g in GEAR_GEO:
        used[g] = compact(resolve_geo(g), g)
    with open(os.path.join(SITE, 'mc-mob3d.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'geo': used, 'mobs': out}, f, separators=(',', ':'))
    print(len(out), 'mobs,', len(used), 'geometries. No model:', ', '.join(missing) or 'none')


if __name__ == '__main__':
    main()
