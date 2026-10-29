"""Bake the Minecraft sub-pages' ground tile (Oct 28 2026, Adrian's pick: "soft").

The game's polished blackstone texture (16 px), its light and dark pixels pushed
only a little away from the page colour #0a0a0b: K = 0.13 gives about +-2 levels,
so it reads as stone up close and as a plain dark field from reading distance
(0.26 was tried: a visible tiled grid, too loud). Scaled 8x with nearest
neighbour and shown at 64 px, so it stays sharp on 2x screens without
image-rendering (that property is inherited and would pixelate the page's images).

    python _tools/ground/blackstone.py  ->  site/images/minecraft/ground-blackstone.png
Used by mc-hero.css "GROUND".
"""
from pathlib import Path

from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'site/minecrafticons/blocks/polished_blackstone.png'
OUT = ROOT / 'site/images/minecraft/ground-blackstone.png'
BASE = (10, 10, 11)  # #0a0a0b, the ground under every Minecraft page
K = 0.13

tex = Image.open(SRC).convert('L')
mean = ImageStat.Stat(tex).mean[0]
tile = Image.new('RGB', tex.size)
tile.putdata([tuple(max(0, min(255, round(c + (v - mean) * K))) for c in BASE) for v in tex.tobytes()])
tile.resize((tex.width * 8, tex.height * 8), Image.NEAREST).save(OUT, optimize=True)
print(OUT, OUT.stat().st_size, 'bytes, range', tile.getextrema())
