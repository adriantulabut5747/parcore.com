"""Bake the /minecraft/ lobby hero (Oct 28 2026): the Nether photo + the piglin guide's faces.

    python _tools/lobby-hero/nether.py

src/nether.png (official Nether Update art, 1200x675) ->
  site/images/minecraft/lobby/nether.webp        1920 wide, graded (saturation, contrast, warm lift, sharpened)
  site/images/minecraft/lobby/nether-phone.webp  the 4:3 crop around ghast / piglin / portal (phones)
src/refs/6.png (a piglin render Adrian picked, white background) ->
  site/images/minecraft/piglin/face.webp         head + shoulders, background cut out, 112x112
  site/images/minecraft/piglin/face-gold.webp    the same, holding a gold ingot (the barter "admiring" look)
src/refs/4.png (Adrian's golden-axe piglin render) ->
  site/images/minecraft/piglin/piglin-axe.webp   the whole piglin cut out and trimmed (Popular tools, beside the board)
  (face() still draws the old flat face from minecrafticons/mobs3d/piglin.png; not called any more)
The particles in mc-lobby-hero.js are placed in src fractions of this photo: re-check REGIONS there if it changes.
"""
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / 'site'
SRC = Path(__file__).with_name('src') / 'nether.png'
OUT = SITE / 'images/minecraft/lobby'
FACE = SITE / 'images/minecraft/piglin'
PHONE_X = 300  # the phone crop starts here (src px) and is 900 wide = 4:3 of the 675 height


def grade(im):
    im = ImageEnhance.Color(im).enhance(1.22)
    im = ImageEnhance.Contrast(im).enhance(1.08)
    # lift the darks a touch toward a warm red so the shadows don't go flat grey once darkened by the CSS
    r, g, b = im.split()
    r = r.point(lambda v: min(255, int(v * 1.03 + 4)))
    b = b.point(lambda v: int(v * 0.97))
    return Image.merge('RGB', (r, g, b))


def photo():
    src = Image.open(SRC).convert('RGB')
    big = src.resize((1920, round(1920 * src.height / src.width)), Image.LANCZOS)
    big = grade(big).filter(ImageFilter.UnsharpMask(radius=1.6, percent=70, threshold=2))
    big.save(OUT / 'nether.webp', quality=86, method=6)
    ph = src.crop((PHONE_X, 0, PHONE_X + 900, src.height)).resize((1000, 750), Image.LANCZOS)
    ph = grade(ph).filter(ImageFilter.UnsharpMask(radius=1.4, percent=60, threshold=2))
    ph.save(OUT / 'nether-phone.webp', quality=84, method=6)


def face(gold=False):
    t = Image.open(SITE / 'minecrafticons/mobs3d/piglin.png').convert('RGBA')
    c = Image.new('RGBA', (14, 14))  # 10-wide head, 2 px each side for the ears
    head = t.crop((8, 8, 18, 16))
    c.paste(head, (2, 3), head)
    # the snout sits 1 px proud of the face: its shadow falls under it and to its right
    for x, y in [(i, 11) for i in range(6, 10)] + [(9, j) for j in range(8, 11)]:
        r, g, b, a = c.getpixel((x, y))
        c.putpixel((x, y), (int(r * 0.62), int(g * 0.6), int(b * 0.6), a))
    snout = t.crop((32, 2, 36, 6))
    c.paste(snout, (5, 7), snout)  # model: snout covers head rows 4-7, columns 3-6
    for tx, cx in ((3, 4), (3, 9)):  # tusks: 1x2, beside the snout
        tusk = t.crop((tx, 1, tx + 1, 3))
        c.paste(tusk, (cx, 9), tusk)
    for x0, side in ((0, 1), (12, -1)):  # ears flare down and out: the ear's side face, stepped
        ear = t.crop((51, 10, 55, 15))
        for i in range(4):
            col = ear.crop((i, 0, i + 1, 5)).resize((1, 3), Image.NEAREST)
            x = x0 + (1 - i // 2 if side == 1 else i // 2)
            c.paste(col, (x, 4 + i), col)
    if gold:
        ingot = Image.open(SITE / 'minecrafticons/items/gold_ingot.png').convert('RGBA').resize((7, 7), Image.NEAREST)
        c.paste(ingot, (7, 7), ingot)
    c.resize((112, 112), Image.NEAREST).save(FACE / ('face-gold.webp' if gold else 'face.webp'), lossless=True)


def cut_white(im, tol=26):
    """Flood the white backdrop from the edges to transparent (the render's own whites, like its eyes, stay)."""
    from collections import deque
    im = im.convert('RGBA')
    px, (w, h) = im.load(), im.size
    seen, q = set(), deque((x, y) for x in range(w) for y in (0, h - 1))
    q.extend((x, y) for y in range(h) for x in (0, w - 1))
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h): continue
        seen.add((x, y))
        r, g, b, a = px[x, y]
        if min(r, g, b) < 255 - tol: continue
        px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im


def render_faces():
    head = cut_white(Image.open(Path(__file__).with_name('src') / 'refs/6.png')).crop((15, 0, 435, 420))
    face = head.resize((112, 112), Image.LANCZOS)
    face.save(FACE / 'face.webp', quality=92)
    ingot = Image.open(SITE / 'minecrafticons/items/gold_ingot.png').convert('RGBA').resize((56, 56), Image.NEAREST)
    gold = face.copy()
    gold.alpha_composite(ingot, (50, 54))
    gold.save(FACE / 'face-gold.webp', quality=92)


def piglin_cutout():
    im = cut_white(Image.open(Path(__file__).with_name('src') / 'refs/4.png'))
    im = im.crop(im.getbbox())
    h = 760
    im.resize((round(im.width * h / im.height), h), Image.LANCZOS).save(FACE / 'piglin-axe.webp', quality=90)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    FACE.mkdir(parents=True, exist_ok=True)
    photo()
    render_faces()
    piglin_cutout()
    print('baked', OUT / 'nether.webp', OUT / 'nether-phone.webp', FACE)
