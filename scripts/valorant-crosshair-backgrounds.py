"""Backgrounds for the /valorant/crosshairs maker (Oct 30 2026). Writes site/images/valorant/crosshairs/:

1. Textures (the picker's default tab): our own seamless 512px surfaces in Valorant's palette, baked from
   wrap-around noise (no game files; Adrian's call). tex-<id>.webp = the tile the stage repeats,
   tex-<id>-tile.webp = its 240x135 picker thumbnail. The list must match TEXTURES in valorant-crosshairs.js.
2. Map tiles (the Maps tab): 240x135 copies of the Maps pages' cards (images/valorant/maps/<slug>-card.webp,
   from scripts/valorant-maps.py; those weigh 1.2 MB together). Rerun after a new map.

    python scripts/valorant-crosshair-backgrounds.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

SITE = Path(__file__).resolve().parent.parent / 'site'
MAPS = SITE / 'images' / 'valorant' / 'maps'
OUT = SITE / 'images' / 'valorant' / 'crosshairs'
S = 512
Y, X = np.mgrid[0:S, 0:S]


# ---------- noise that wraps at the tile's edges (lattice cells must divide S) ----------
def vnoise(cells, rng):
    g = rng.random((cells, cells))
    t = np.arange(S) * cells / S
    i0 = np.floor(t).astype(int)
    i1 = (i0 + 1) % cells
    f = t - i0
    f = f * f * (3 - 2 * f)
    fx, fy = f[None, :], f[:, None]
    top = g[np.ix_(i0, i0)] * (1 - fx) + g[np.ix_(i0, i1)] * fx
    bot = g[np.ix_(i1, i0)] * (1 - fx) + g[np.ix_(i1, i1)] * fx
    return top * (1 - fy) + bot * fy


def fbm(base, octaves, rng):
    out, amp, tot = np.zeros((S, S)), 1.0, 0.0
    for o in range(octaves):
        out += vnoise(min(base * 2**o, S // 2), rng) * amp
        tot += amp
        amp *= 0.5
    return out / tot


def mix(a, b, f):
    f = np.clip(f, 0, 1)[..., None]
    return np.array(a, float) * (1 - f) + np.array(b, float) * f


def shade(img, k):
    return img * np.asarray(k)[..., None]


def cells_tint(ids, rng, spread):
    """one random brightness per cell id (blocks, tiles, bricks)"""
    lut = 1 + (rng.random(ids.max() + 1) - 0.5) * spread
    return lut[ids]


def masonry(w, h, offset, mortar, bevel):
    """block ids, distance to the block's edge; rows shift by `offset` every other row"""
    row = Y // h
    xs = X + (row % 2) * offset
    col = (xs // w) % (S // w)
    ids = row * (S // w) + col
    dx = np.minimum(xs % w, w - 1 - xs % w)
    dy = np.minimum(Y % h, h - 1 - Y % h)
    d = np.minimum(dx, dy)
    return ids, d < mortar, np.clip((d - mortar) / bevel, 0, 1)


# ---------- the surfaces ----------
def sandstone(rng):  # Bind's big tan blocks
    ids, mortar, edge = masonry(256, 128, 128, 3, 14)
    n = fbm(8, 5, rng)
    img = mix((186, 142, 98), (222, 186, 140), n)
    img = shade(img, cells_tint(ids, rng, 0.14) * (0.8 + 0.2 * edge))
    pits = fbm(128, 2, rng) > 0.7
    img = shade(img, np.where(pits, 0.9, 1))
    img[mortar] = (120, 92, 66)
    return img


def stone_floor(rng):  # Ascent's flagstones
    ids, grout, edge = masonry(128, 128, 0, 3, 8)
    img = mix((132, 126, 116), (184, 176, 160), fbm(16, 5, rng))
    img = shade(img, cells_tint(ids, rng, 0.16) * (0.86 + 0.14 * edge))
    img[grout] = (78, 74, 68)
    return img


def brick(rng):  # Split's red brick
    ids, mortar, edge = masonry(64, 32, 32, 2, 4)
    img = mix((104, 40, 32), (158, 66, 50), fbm(32, 4, rng))
    img = shade(img, cells_tint(ids, rng, 0.3) * (0.82 + 0.18 * edge))
    img[mortar] = (150, 140, 128)
    return img


def crate(rng):  # a wooden crate face: frame, planks, one brace
    F, PL = 48, 52
    frame = (X < F) | (X >= S - F) | (Y < F) | (Y >= S - F)
    side = (X < F) | (X >= S - F)
    brace = (np.abs(X - Y) < 30) & ~frame
    warp = fbm(8, 3, rng) * 18
    grain_h = 0.5 + 0.5 * np.sin(Y / 2.2 + warp)
    grain_v = 0.5 + 0.5 * np.sin(X / 2.2 + warp)
    grain_d = 0.5 + 0.5 * np.sin((X + Y) / 3.1 + warp)
    grain = np.where(side & frame, grain_v, np.where(brace, grain_d, grain_h))
    img = mix((126, 84, 48), (180, 132, 80), 0.55 * grain + 0.45 * fbm(16, 4, rng))
    plank = np.where(frame, 0, (Y - F) // PL + 1)
    tint = cells_tint(plank.astype(int), rng, 0.18)
    tint = np.where(frame, 0.86, np.where(brace, 1.06, tint))
    img = shade(img, tint)
    seam = (~frame & ~brace & ((Y - F) % PL < 3)) | (np.abs(np.abs(X - Y) - 30) < 2) & ~frame
    edge = (X < 3) | (X >= S - 3) | (Y < 3) | (Y >= S - 3)  # the gap to the next crate
    inner = ~frame & ((X < F + 4) | (X >= S - F - 4) | (Y < F + 4) | (Y >= S - F - 4))
    img = shade(img, np.where(seam | edge, 0.45, np.where(inner, 0.7, 1)))
    for cx in (F // 2, S - F // 2):  # nails on the frame's corners
        for cy in (F // 2, S - F // 2):
            img[(X - cx) ** 2 + (Y - cy) ** 2 < 25] = (54, 50, 46)
    return img


def metal(rng):  # a corrugated container wall, Valorant teal
    ridge = 0.5 + 0.5 * np.sin(2 * np.pi * X / 32)
    img = mix((40, 82, 90), (72, 128, 136), 0.65 * ridge + 0.35 * fbm(8, 3, rng))
    rust = fbm(8, 5, rng)
    img = mix(img, (120, 74, 46), np.clip((rust - 0.62) * 4, 0, 0.85))
    scratch = fbm(64, 3, rng) > 0.68
    img[scratch] = img[scratch] * 0.6 + np.array((150, 160, 158)) * 0.4
    img[(Y % 256) < 4] = (24, 40, 44)  # panel weld
    return img


def concrete(rng):
    img = mix((98, 98, 96), (142, 141, 136), fbm(16, 6, rng))
    seam = ((X % 256) < 2) | ((Y % 256) < 2)
    img = shade(img, np.where(seam, 0.6, 1))
    for cx in (64, 192, 320, 448):  # form-tie holes
        for cy in (64, 192, 320, 448):
            r2 = (X - cx) ** 2 + (Y - cy) ** 2
            img = shade(img, np.where(r2 < 30, 0.45, np.where(r2 < 60, 0.85, 1)))
    return img


def tile_floor(rng):  # cream tiles (Haven / Split interiors)
    ids, grout, edge = masonry(64, 64, 0, 2, 3)
    img = mix((206, 196, 176), (232, 226, 210), fbm(32, 3, rng))
    img = shade(img, cells_tint(ids, rng, 0.08) * (0.93 + 0.07 * edge))
    img[grout] = (150, 138, 120)
    return img


def snow(rng):  # Icebox
    img = mix((186, 202, 222), (236, 242, 248), fbm(8, 6, rng))
    sparkle = rng.random((S, S)) > 0.997
    img[sparkle] = (255, 255, 255)
    return img


def foliage(rng):  # Breeze / Lotus leaves
    a, b = fbm(32, 4, rng), fbm(64, 3, rng)
    img = mix((30, 58, 32), (112, 156, 66), np.clip((a - 0.35) * 2.2, 0, 1))
    img = shade(img, 0.7 + 0.45 * b)
    return img


def sky(rng):
    img = mix((132, 178, 226), (186, 214, 242), fbm(4, 3, rng))
    cloud = np.clip((fbm(4, 6, rng) - 0.5) * 3, 0, 1)
    return mix(img, (246, 248, 252), cloud * 0.9)


TEXTURES = {
    'sandstone': sandstone, 'stone-floor': stone_floor, 'brick': brick, 'crate': crate, 'metal': metal,
    'concrete': concrete, 'tile-floor': tile_floor, 'snow': snow, 'foliage': foliage, 'sky': sky,
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for i, (name, fn) in enumerate(TEXTURES.items()):
        img = fn(np.random.default_rng(7 + i))
        assert img.shape == (S, S, 3), name
        im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
        im.save(OUT / f'tex-{name}.webp', 'WEBP', quality=82, method=6)
        # thumbnail = the middle of the tile, the way the stage shows it at 1x
        im.crop((0, 112, S, 400)).resize((240, 135), Image.LANCZOS).save(OUT / f'tex-{name}-tile.webp', 'WEBP', quality=80, method=6)
    cards = sorted(MAPS.glob('*-card.webp'))
    assert cards, f'no map cards in {MAPS}'
    for card in cards:
        with Image.open(card) as im:
            im.convert('RGB').resize((240, 135), Image.LANCZOS).save(OUT / f"{card.name[: -len('-card.webp')]}.webp", 'WEBP', quality=78, method=6)
    print(f'{len(TEXTURES)} textures + {len(cards)} map tiles -> {OUT}')


if __name__ == '__main__':
    main()
