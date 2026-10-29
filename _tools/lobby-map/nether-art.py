"""Pixel art for the Piglin's map section on /minecraft/ (Oct 28 2026, redrawn the same evening).

    python _tools/lobby-map/nether-art.py

The section is a Nether cave (Adrian's reference: a pixel-art cave of hanging stalactites over a lava sea, with a
fortress in the haze), drawn in our dark red instead of the reference's purple. Every strip tiles sideways
(repeat-x) and is shown at 4 CSS px a pixel (3 on phones), pixelated. Writes site/images/minecraft/lobby/:
  cave-top.png    the ceiling: far / mid / near stalactites, the lavafalls falling from far tips
  cave-far.png    the haze on the horizon: a few far spires + a Nether fortress and its bridge
  cave-lava.png   the lava sea, still
  cave-glint.png  bright lava streaks only: scrolled sideways by CSS so the sea flows
  cave-floor.png  basalt formations standing in the lava + the dark ground at the foot
  cave-side.png   the left wall framing the scene (cave-side-r.png = the right one, mirrored)
  deco-*.png      8x8 map icons for the Nether structures, drawn like the game's map decorations, + the gold banner
Every shape is drawn whole (a stepped stalactite, a pillar, a mound) and outlined, never per-column noise: the first
version did that and Adrian rightly called it glitching (lit stripes read as see-through rock, stubs floated).
Same seed = same picture; change SEED or the numbers below and rerun.
"""
import random
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / 'site/images/minecraft/lobby'
SEED = 11
W = 480  # strip width in art pixels (= 1920 CSS px at 4x); every shape wraps, so the strip tiles

# (fill, outline) per depth: the further, the closer to the haze
FAR = ((46, 19, 23), (35, 13, 16))
MID = ((29, 12, 15), (18, 7, 9))
NEAR = ((15, 7, 9), (6, 2, 3))
HAZE = (54, 24, 28)
LAVA = {'deep': (206, 58, 16), 'base': (232, 78, 20), 'mid': (250, 112, 30), 'hi': (255, 168, 58), 'hot': (255, 216, 112)}
GLOW = (176, 62, 28)  # rock touched by lava light


class Mask:
    """A set of pixels for one depth layer; painted as a fill with a 1 px outline round the whole shape."""
    def __init__(self, h):
        self.h, self.on = h, set()

    def rect(self, x0, y0, x1, y1):
        for x in range(x0, x1):
            for y in range(max(0, y0), min(self.h, y1)):
                self.on.add((x % W, y))

    def paint(self, img, fill, outline):
        px = img.load()
        for x, y in self.on:
            px[x, y] = fill + (255,)
        for x, y in self.on:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                p = ((x + dx) % W, y + dy)
                if 0 <= p[1] < self.h and p not in self.on:
                    px[p] = outline + (255,)


def stalactite(m, rng, cx, top, length, width):
    """Stepped: each step 2 px narrower than the one above, nudged a pixel sideways now and then (crooked, not noisy)."""
    steps = max(1, width // 2)
    sh = max(2, round(length / steps))
    x, w, y = cx - width // 2, width, top
    for _ in range(steps):
        m.rect(x, y, x + w, y + sh)
        y += sh
        x += 1 + rng.choice((-1, 0, 0, 1)) if w > 3 else 1
        w -= 2
    return x + max(w, 1) // 2, y  # the tip


def spread(rng, n):
    """n centres across the strip, evenly spaced with a little jitter (no clumps, no gaps)."""
    return [int((i + rng.uniform(0.15, 0.85)) * W / n) for i in range(n)]


def band(m, rng, base, var):
    """The rock the stalactites hang from: flat runs 8-20 px long, each a few px deeper or shallower."""
    x = 0
    while x < W:
        run = rng.randint(8, 20)
        m.rect(x, 0, min(W, x + run), base + rng.randint(0, var) // 2 * 2)
        x += run


def top(rng):
    H = 150
    img = Image.new('RGBA', (W, H))
    far = Mask(H)
    band(far, rng, 10, 8)
    tips = []
    for cx in spread(rng, 20):
        tips.append(stalactite(far, rng, cx, 10, rng.randint(16, 46), rng.choice((6, 8, 8, 10, 12))))
    far.paint(img, *FAR)
    # lavafalls: thin streams from four of the far tips, fading out as they fall
    px = img.load()
    for tx, ty in rng.sample(tips, 4):
        ln = rng.randint(60, 110)
        for k in range(ln):
            y = ty + 1 + k
            if y >= H: break
            t = k / ln
            c = tuple(int(a + (b - a) * min(1, t * 1.6)) for a, b in zip((150, 40, 22), (255, 132, 46)))
            a = 255 if t < 0.75 else int(255 * (1 - t) / 0.25)
            px[tx % W, y] = c + (a,)
            for side in (-1, 1):  # a faint glow either side
                px[(tx + side) % W, y] = (255, 96, 30, a // 5)
    mid = Mask(H)
    band(mid, rng, 6, 6)
    for cx in spread(rng, 13):
        stalactite(mid, rng, cx, 6, rng.randint(16, 44), rng.choice((8, 10, 12, 14)))
    mid.paint(img, *MID)
    near = Mask(H)
    band(near, rng, 2, 4)
    for cx in spread(rng, 7):
        stalactite(near, rng, cx, 2, rng.randint(18, 40), rng.choice((14, 16, 18, 22)))
    near.paint(img, *NEAR)
    img.save(OUT / 'cave-top.png')


def spire(m, cx, foot, height, width):
    """A pillar standing on `foot`: stepped top, straight sides."""
    m.rect(cx - width // 2, foot - height, cx + width - width // 2, foot)
    m.rect(cx - width // 2 + 2, foot - height - 3, cx + width - width // 2 - 2, foot - height)


def cluster(m, rng, x0, foot, hmax, n):
    """Basalt columns side by side (the reference's rock formations): tallest in the middle, each its own width."""
    x = x0
    for i in range(n):
        w = rng.choice((6, 8, 8, 10))
        bump = 1 - abs(i - (n - 1) / 2) / (n / 2 + 0.5)
        spire(m, x + w // 2, foot, max(6, int(hmax * (0.45 + 0.55 * bump) * rng.uniform(0.8, 1.0)) // 3 * 3), w)
        x += w
    return x


def far(rng):
    H = 110
    img = Image.new('RGBA', (W, H))
    m = Mask(H)
    for cx in (40, 118, 176, 236, 430):
        spire(m, cx, H, rng.randint(14, 44), rng.choice((8, 10, 12)))
    # a Nether fortress: keep, three crenellated towers, a bridge on piers running left
    m.rect(310, 62, 392, H)
    for tx in (306, 340, 378):
        m.rect(tx, 34, tx + 14, H)
        for cx in range(tx, tx + 14, 4):
            m.rect(cx, 30, cx + 2, 34)
    m.rect(214, 70, 312, 74)
    for bx in range(216, 310, 12):
        m.rect(bx, 74, bx + 4, H)
    for cx in range(214, 312, 4):
        m.rect(cx, 67, cx + 2, 70)
    m.paint(img, HAZE, FAR[1])
    px = img.load()
    for wx, wy in ((311, 44), (345, 44), (383, 44), (324, 76), (362, 76)):  # lit windows, inside the walls
        for x in range(wx, wx + 3):
            for y in range(wy, wy + 4):
                px[x, y] = (128, 46, 28, 255)
    img.save(OUT / 'cave-far.png')


SURF = 40   # lava surface row in the floor/lava/glint strips (room above it for the basalt)
DEPTH = 14  # rows of lava under it (Adrian, Oct 28 2026: keep the sea short); the CSS puts the far strip's foot DEPTH px-units up


def lava(rng):
    H = SURF + DEPTH
    sea, glint = Image.new('RGBA', (W, H)), Image.new('RGBA', (W, H))
    S, G = sea.load(), glint.load()
    for y in range(SURF, H):
        base = LAVA['hot'] if y == SURF else LAVA['mid'] if y < SURF + 3 else LAVA['base'] if y < SURF + 10 else LAVA['deep']
        for x in range(W):
            S[x, y] = base + (255,)
    def streak(P, y, x0, ln, c):
        for x in range(x0, x0 + ln):
            P[x % W, y] = c + (255,)
    for y in range(SURF + 2, H, 3):  # long ripples every third row, fewer and dimmer further down
        for _ in range(3 if y < SURF + 20 else 2):
            streak(S, y, rng.randrange(W), rng.randint(10, 34), LAVA['hi'] if y < SURF + 16 else LAVA['mid'])
        for _ in range(2):
            streak(G, y, rng.randrange(W), rng.randint(3, 12), LAVA['hot'] if y < SURF + 12 else LAVA['hi'])
    sea.save(OUT / 'cave-lava.png')
    glint.save(OUT / 'cave-glint.png')

    floor = Image.new('RGBA', (W, H))
    # basalt formations standing in the lava: mid clusters further back, near ones taller and darker
    for depth, foot, n, hmax in ((MID, SURF + 5, 4, 20), (NEAR, SURF + 11, 3, 38)):
        m = Mask(H)
        feet = []
        for cx in spread(rng, n):
            x1 = cluster(m, rng, cx, foot, rng.randint(hmax // 2, hmax), rng.randint(2, 4))
            feet.append((cx, x1))
        m.paint(floor, *depth)
        P = floor.load()
        for x0, x1 in feet:  # where each formation meets the lava, its foot glows
            for x in range(x0, x1):
                P[x % W, foot - 1] = GLOW + (255,)
    # the dark ground at the foot: flat runs, stepped, its top edge lit by the lava
    m = Mask(H)
    m.rect(0, H - 2, W, H)  # unbroken, so the strip always ends in rock (no slabs floating on the lava)
    x = 0
    while x < W:
        run = rng.randint(18, 56)
        m.rect(x, H - rng.choice((3, 4, 5, 6)), min(W, x + run), H)
        x += run
    m.paint(floor, *NEAR)
    P = floor.load()
    for (x, y) in m.on:
        if (x, y - 1) not in m.on and y - 1 >= 0:
            P[x, y - 1] = GLOW + (255,)
    floor.save(OUT / 'cave-floor.png')


def side(rng):
    """The left wall: one big formation framing the scene (cave-side-r.png = mirrored, the right wall)."""
    Wd, H = 64, 240
    img = Image.new('RGBA', (Wd, H))
    m = Mask(H)
    x = 0
    for hmax in (236, 186, 214, 132, 150, 70):
        w = rng.choice((8, 10, 12))
        m.rect(x, H - int(hmax * rng.uniform(0.85, 1.0)) // 3 * 3, x + w, H)
        x += w
    m.on = {(x, y) for x, y in m.on if x < Wd}  # no wrap for the wall
    px = img.load()
    for x, y in m.on:
        px[x, y] = NEAR[0] + (255,)
    for x, y in m.on:
        for dx, dy in ((1, 0), (0, -1)):
            p = (x + dx, y + dy)
            if 0 <= p[0] < Wd and 0 <= p[1] < H and p not in m.on:
                px[p] = NEAR[1] + (255,)
    img.save(OUT / 'cave-side.png')
    img.transpose(Image.FLIP_LEFT_RIGHT).save(OUT / 'cave-side-r.png')


# 8x8 map icons, the game's map-decoration look: a black outline round a flat little shape
ICONS = {
    'bastion': ('B.BB.BB.', 'BmBmmBmB', 'BmmmmmmB', 'BggggggB', 'BdmmmmdB', 'BdmBBmdB', 'BddBBddB', 'BBBBBBBB'),
    'fortress': ('BB....BB', 'BRB..BRB', 'BRBBBBRB', 'BRRRRRRB', 'BrwrrwrB', 'BrrrrrrB', 'BrrBBrrB', 'BBBBBBBB'),
    'ruined_portal': ('BBBBB...', 'BoooBBBB', 'BopllooB', 'BoppplB.', 'BolpppoB', 'BopplpoB', 'BooooooB', 'BBBBBBBB'),
}
PAL = {'B': (0, 0, 0), 'm': (86, 84, 92), 'd': (46, 44, 52), 'g': (246, 196, 52), 'R': (120, 40, 44), 'r': (80, 24, 30),
       'w': (255, 150, 50), 'o': (40, 22, 64), 'p': (150, 60, 220), 'l': (214, 140, 255)}


def gold_banner():
    """The tools' banner: the game's white banner decoration dyed gold (the red one vanished on a red Nether map)."""
    src = Image.open(OUT.parents[2] / 'minecrafticons/gui/lobby/decorations-white_banner.png').convert('RGBA')
    px = src.load()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = px[x, y]
            if a and r > 40:  # the cloth; the black outline stays
                k = r / 255
                px[x, y] = (int(252 * k), int(196 * k), int(40 * k), a)
    src.save(OUT / 'deco-gold_banner.png')


def icons():
    for name, rows in ICONS.items():
        img = Image.new('RGBA', (8, 8))
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in PAL: img.putpixel((x, y), PAL[ch] + (255,))
        img.save(OUT / f'deco-{name}.png')


if __name__ == '__main__':
    rng = random.Random(SEED)
    top(rng); far(rng); lava(rng); side(rng); icons(); gold_banner()
    print('wrote cave-*.png + deco-*.png to', OUT)
