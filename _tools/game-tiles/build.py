"""Bake the home page's Featured Games tiles: python _tools/game-tiles/build.py

Each tile background is ONE picture (900x312, a ~450x156 tile at 2x), so the fade is perfectly smooth:
  1. the wallpaper (src/<slug>.jpg) placed so its focal point lands at (tx, ty) of the tile; any gap is
     filled by a heavily blurred copy of the same art (no hard seams),
  2. the left half blurs progressively (full blur at the left edge, sharp by ~80%),
  3. the game's dark colour fades in from the left on a smoothstep curve (solid to 48%, gone by 86%).
The page shows it with object-fit: cover + object-position: right, so a narrower or taller tile only
loses solid colour on the left, never the character. Output: site/icons/tiles/<slug>.webp.
To re-frame a tile, change its row in TILES and rerun (then bump ?v= on its "tile" in sidebar.json).
"""
from pathlib import Path
from PIL import Image, ImageFilter

HERE = Path(__file__).parent
OUT = HERE.parent.parent / 'site' / 'icons' / 'tiles'
W, H = 900, 312

# slug: (focal x, focal y in the source AFTER flipping, scale, flip, target x %, target y %, tile colour, dim)
TILES = {
    'clash-of-clans': (590, 220, 1.1, False, .81, .42, '#1a0b00', .74),
    'minecraft': (309, 150, 1.2, True, .79, .5, '#050b0f', .74),
    'call-of-duty-mobile': (365, 190, .92, False, .81, .42, '#0b0f05', .74),
    'genshin-impact': (530, 400, .62, False, .77, .5, '#0c0a18', .58),  # very bright art: dimmed for the title
    'tekken': (370, 190, 1.0, False, .81, .5, '#040916', .74),
    'valorant': (420, 170, 1.05, False, .83, .42, '#180008', .74),
    'clash-royale': (520, 210, .78, True, .81, .42, '#1a0700', .74),
    'mobile-legends': (820, 150, .8, True, .79, .32, '#110814', .74),
}


def smooth(a, b, x):
    t = min(1, max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def hmask(fn):
    m = Image.new('L', (W, 1))
    m.putdata([round(255 * fn(x / (W - 1))) for x in range(W)])
    return m.resize((W, H))


BLUR = hmask(lambda t: 1 - smooth(.38, .8, t))
FADE = hmask(lambda t: 1 - smooth(.48, .86, t))


def bake(slug, fx, fy, s, flip, tx, ty, colour, dim):
    src = Image.open(HERE / 'src' / f'{slug}.jpg').convert('RGB')
    if flip:
        src = src.transpose(Image.FLIP_LEFT_RIGHT)
    # the extension: the art scaled to cover the tile and blurred hard
    k = max(W / src.width, H / src.height)
    bg = src.resize((round(src.width * k), round(src.height * k)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(28))
    x0, y0 = (bg.width - W) // 2, (bg.height - H) // 2
    canvas = bg.crop((x0, y0, x0 + W, y0 + H))
    # the art itself, feathered at its own edges so it melts into the extension
    art = src.resize((round(src.width * s), round(src.height * s)), Image.LANCZOS)
    feather = Image.new('L', art.size, 0)
    feather.paste(255, (24, 24, art.width - 24, art.height - 24))
    canvas.paste(art, (round(tx * W - fx * s), round(ty * H - fy * s)), feather.filter(ImageFilter.GaussianBlur(14)))
    canvas = canvas.point(lambda v: round(v * dim))
    canvas = Image.composite(canvas.filter(ImageFilter.GaussianBlur(10)), canvas, BLUR)
    canvas = Image.composite(Image.new('RGB', (W, H), colour), canvas, FADE)
    canvas.save(OUT / f'{slug}.webp', quality=84, method=6)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for slug, row in TILES.items():
        bake(slug, *row)
        print('baked', slug)
