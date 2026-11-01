"""Parchrome logo (Oct 31 2026, Adrian's pick "T01 Faceted" from the logo picker): half an octagon ring
cut on the 45° line + a red right triangle folded into a lit and a shaded half.

  python _tools/logo/build.py

Writes into site/icons/:
  parchrome-logo.svg        on-site mark (white ring: the site is always dark)
  parchrome-favicon.svg     tab icon: the ring turns dark in a light browser tab
  parchrome-favicon-32.png  fallback for browsers without SVG favicons, on a dark tile
  parchrome-touch-180.png   iPhone home screen (iOS can't do transparency)
Edit the colours / geometry here and rerun; never edit the outputs.
"""
import math
import os
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ICONS = Path(__file__).resolve().parents[2] / 'site' / 'icons'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
WHITE, DARK_RING = '#f1f2f4', '#1c1d21'
RED, FACET = '#c23b3b', '#611e1e'  # site red + the same red halfway to black
TILE, GROUND = (22, 24, 28), (12, 13, 16)
VIEW = '16 15 68 68'  # the mark's box with a little air; it also fits a circle crop (Genshin build card)


def op(R, a):
    """Point on an octagon whose flat sides face 0/45/90°, inner radius R, centre (50,50)."""
    d = a % 45
    d = d - 45 if d > 22.5 else d
    q = R / math.cos(math.radians(d))
    return f'{50 + q * math.cos(math.radians(a)):.2f},{50 + q * math.sin(math.radians(a)):.2f}'


def ring(R=30, r=19, a0=135, a1=315):
    """Octagonal ring segment clockwise a0 -> a1, both ends cut along the radius."""
    vs = [a for a in (22.5 + 45 * k for k in range(16)) if a0 < a < a1]
    pts = [op(R, a0)] + [op(R, a) for a in vs] + [op(R, a1), op(r, a1)] + [op(r, a) for a in reversed(vs)] + [op(r, a0)]
    return ' '.join(pts)


def svg(ring_fill, style=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VIEW}">{style}'
            f'<polygon class="w" fill="{ring_fill}" points="{ring()}"/>'
            f'<polygon fill="{RED}" points="48.13,46.95 79.24,46.95 63.69,62.5"/>'
            f'<polygon fill="{FACET}" points="48.13,46.95 63.69,62.5 48.13,78.06"/></svg>\n')


def render(svg_path, size=512):
    """Headless Edge screenshot of the SVG on a transparent page."""
    tmp = Path(os.environ.get('TMP', tempfile.gettempdir()))
    out = tmp / 'parchrome-logo-render.png'
    subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--hide-scrollbars', f'--user-data-dir={tmp / "parchrome-logo-edge"}',
                    '--default-background-color=00000000', '--force-device-scale-factor=1', f'--window-size={size},{size}',
                    f'--screenshot={out}', svg_path.as_uri()], check=True, capture_output=True)
    im = Image.open(out).convert('RGBA')
    assert im.size == (size, size) and im.getpixel((0, 0))[3] == 0, 'render is not a transparent square'
    return im


def on_tile(mark, size, colour, pad, radius):
    """The mark centred on a filled square (rounded when radius > 0), as 4x supersampled RGBA."""
    S = size * 4
    tile = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    from PIL import ImageDraw
    ImageDraw.Draw(tile).rounded_rectangle((0, 0, S - 1, S - 1), radius=radius * 4, fill=colour + (255,))
    m = mark.resize((S - 2 * pad * 4,) * 2, Image.LANCZOS)
    tile.alpha_composite(m, (pad * 4, pad * 4))
    return tile.resize((size, size), Image.LANCZOS)


def main():
    (ICONS / 'parchrome-logo.svg').write_text(svg(WHITE), encoding='utf-8')
    style = f'<style>.w{{fill:{DARK_RING}}}@media (prefers-color-scheme:dark){{.w{{fill:{WHITE}}}}}</style>'
    (ICONS / 'parchrome-favicon.svg').write_text(svg(DARK_RING, style), encoding='utf-8')
    mark = render(ICONS / 'parchrome-logo.svg')
    on_tile(mark, 32, TILE, 3, 6).save(ICONS / 'parchrome-favicon-32.png', optimize=True)
    on_tile(mark, 180, GROUND, 30, 0).convert('RGB').save(ICONS / 'parchrome-touch-180.png', optimize=True)
    for f in ('parchrome-logo.svg', 'parchrome-favicon.svg', 'parchrome-favicon-32.png', 'parchrome-touch-180.png'):
        print(f, os.path.getsize(ICONS / f), 'bytes')


if __name__ == '__main__':
    main()
