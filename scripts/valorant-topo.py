"""Bake the Valorant lobby hero's contour-line texture (Nov 1 2026, Adrian: "this background texture thingy", the
topographic lines behind the agent in Riot's client).

Writes site/images/valorant/topo.webp: white lines on clear, a seamless tile. valorant-lobby.css uses it as a mask
filled with the agent's colour, so the colour lives in CSS, not here.

    python scripts/valorant-topo.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

S = 1024  # tile size (px); the CSS shows it at 900px
LEVELS = 12  # contour lines across the field's full range
WIDTH = 2.6  # line width (px)
OUT = Path(__file__).resolve().parent.parent / 'site' / 'images' / 'valorant' / 'topo.webp'

rng = np.random.default_rng(7)

# smooth field that wraps at the edges: white noise, low-passed in frequency space (FFT = periodic for free)
k = np.fft.fftfreq(S) * S
kk = np.hypot(k[None, :], k[:, None])
spec = np.fft.fft2(rng.standard_normal((S, S)))
field = np.real(np.fft.ifft2(spec * (np.exp(-((kk / 2.4) ** 2)) + 0.08 * np.exp(-((kk / 9) ** 2)))))
field = (field - field.min()) / (field.max() - field.min()) * LEVELS

# distance to the nearest contour in pixels = level offset / slope, so lines keep one width on steep and flat ground
gy = (np.roll(field, -1, 0) - np.roll(field, 1, 0)) / 2
gx = (np.roll(field, -1, 1) - np.roll(field, 1, 1)) / 2
dist = np.abs(field - np.round(field)) / np.maximum(np.hypot(gx, gy), 1e-6)
alpha = np.clip(WIDTH / 2 + 0.5 - dist, 0, 1)

assert np.allclose(field[0], field[-1], atol=LEVELS * 0.05), 'tile should wrap top to bottom'

img = Image.new('LA', (S, S), 255)
img.putalpha(Image.fromarray((alpha * 255).astype(np.uint8)))
img.convert('RGBA').save(OUT, 'WEBP', quality=80, method=6)
print(f'{OUT} {OUT.stat().st_size // 1024} KB')
