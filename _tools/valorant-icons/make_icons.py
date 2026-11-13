"""Valorant nav pictures (Nov 2 2026, Adrian). Run: python _tools/valorant-icons/make_icons.py

  site/icons/valorant-nav/player-tracker.webp  Diamond 3 badge (whole, frame kept), big, under the CoC Player Tracker's magnifier
                                               (silver ring, brown handle, badge 1.4x inside the lens).
  site/icons/valorant-nav/lobby.webp           The Spike (Standard mode icon) on a raised dark red key (Lobby tab).
  site/icons/valorant-nav/tracker.webp         Cypher's Spycam on a raised dark red key (Tracker tab).
  site/icons/valorant-nav/tools.webp           Killjoy's Turret on the same dark red key (Tools tab).
  site/icons/valorant-nav/database.webp        A plain white database stack on the same dark red key (Database tab).
  site/icons/valorant-nav/crosshairs.webp       Tools pages, on a dark (graphite) key: a white gap crosshair + red dot ...
  site/icons/valorant-nav/crosshair-gallery.webp ... and a 2x2 of sunken wells: ours, Valorant's default, a sniper sight, a red cross.
  site/icons/valorant-nav/chat-art.webp        The Chat Art Gallery's Heart (valorant-chatart.json) in red blocks, same key ...
  site/icons/valorant-nav/chat-art-gallery.webp ... and a 2x2 of wells: Heart, Smile, Star, Skull (same JSON).
  site/icons/valorant-nav/instalock-roulette.webp ... and the page's wheel: grey slices, red winner under a red pin, red hub.
  site/icons/valorant-nav/leaderboards.webp    Radiant badge inside a gold laurel wreath.
  site/icons/valorant-nav/agents.webp          Jett's head breaking out of the top of a dark red key.
  site/icons/valorant-nav/weapons.webp         The Classic on its own, tilted up a little.
  site/icons/valorant-nav/ranks.webp           Silver 3 on its own.
  site/icons/valorant-nav/maps.webp            A map pin standing on Ascent's minimap (darkened).

Art = valorant-api.com (Riot's own icons), cached in _tools/valorant-icons/src/. Drawn at 4x, saved at 128px.
"""

import json
import math
import os
import urllib.request

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(HERE, '..', '..', 'site')
OUT = os.path.join(SITE, 'icons', 'valorant-nav')
SRC = {
    'diamond3': 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/20/largeicon.png',
    'radiant': 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/27/largeicon.png',
    'jett-full': 'https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/fullportrait.png',
    'classic': 'https://media.valorant-api.com/weapons/29a0cfab-485b-f5d5-779a-b59f85e204a8/displayicon.png',
    'silver3': 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/11/largeicon.png',
    'spycam': 'https://media.valorant-api.com/agents/117ed9e3-49f3-6512-3ccf-0cada7e3823b/abilities/ability2/displayicon.png',
    'spike': 'https://media.valorant-api.com/gamemodes/96bd3920-4f36-d026-2b28-c683eb0bcac5/displayicon.png',  # Standard mode = the Spike
    'turret': 'https://media.valorant-api.com/agents/1e58de9c-4950-5125-93e9-a0aee9f98746/abilities/ability2/displayicon.png',
}
SIZE, X = 128, 4  # final px, supersample
S = SIZE * X
EDGE = (6, 7, 8, 255)  # the site's #060708 raised edge


def art(name):
    path = os.path.join(HERE, 'src', name + '.png')
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        req = urllib.request.Request(SRC[name], headers={'User-Agent': 'parchrome-icons'})
        with urllib.request.urlopen(req) as r, open(path, 'wb') as f:
            f.write(r.read())
    return Image.open(path).convert('RGBA')


def fit(im, box):
    """Trim the transparent margin, then scale to fit a box x box square."""
    im = im.crop(im.getbbox())
    k = box / max(im.size)
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)


def shadow(mask, blur, alpha):
    sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sh.putalpha(mask.point(lambda v: v * alpha // 255).filter(ImageFilter.GaussianBlur(blur)))
    return sh


def save(im, name):
    os.makedirs(OUT, exist_ok=True)
    im.resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(OUT, name), 'WEBP', quality=92, method=6)


def player_tracker():
    """The CoC Player Tracker card's magnifier, still: clear glass, silver ring, brown handle; inside the
    lens the badge shows 1.4x bigger and a bit brighter. Proportions = its SVG (lens r 21 in a 60 box)."""
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    badge = fit(art('diamond3'), int(S * 0.94))
    bx, by = (S - badge.width) // 2 - X * 3, (S - badge.height) // 2 - X * 3
    canvas.alpha_composite(badge, (bx, by))

    r = S * 0.22  # lens radius
    k = r / 21  # SVG unit -> canvas px
    cx, cy = S * 0.63, S * 0.63
    hx0, hy0 = cx + 16 * k, cy + 16 * k  # handle: SVG's M40 40 L55 55, lens centre at 24 24
    hx1, hy1 = cx + 31 * k, cy + 31 * k
    if hx1 > S - 5 * k:  # keep the round cap inside the picture
        hx1 = hy1 = S - 5 * k

    # drop shadow under the whole magnifier (CSS: drop-shadow(0 3px 4px rgba(0,0,0,.6)))
    sil = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(sil)
    d.ellipse((cx - r - 3 * k, cy - r - 3 * k, cx + r + 3 * k, cy + r + 3 * k), outline=255, width=int(6 * k))
    d.line((hx0, hy0, hx1, hy1), fill=255, width=int(9 * k))
    canvas.alpha_composite(shadow(sil, 4 * k / 2, 150), (0, int(3 * k / 2)))

    # glass: the badge again, 1.4x round the lens centre, brightened, clipped to the circle
    z = 1.4
    big = badge.resize((round(badge.width * z), round(badge.height * z)), Image.LANCZOS)
    rgb = big.convert('RGB').point(lambda v: min(255, int(v * 1.12)))
    big = Image.merge('RGBA', (*rgb.split(), big.getchannel('A')))
    glass = Image.new('RGBA', (S, S), (190, 210, 255, 18))  # rgba(190,210,255,.07)
    glass.alpha_composite(big, (round(cx - (cx - bx) * z), round(cy - (cy - by) * z)))
    gm = Image.new('L', (S, S), 0)
    ImageDraw.Draw(gm).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    glass.putalpha(Image.composite(glass.getchannel('A'), Image.new('L', (S, S), 0), gm))
    # the lens hides what's under it first, then shows the zoomed copy
    canvas = Image.composite(Image.new('RGBA', (S, S), (0, 0, 0, 0)), canvas, gm)
    canvas.alpha_composite(glass)

    d = ImageDraw.Draw(canvas)
    d.line((hx0, hy0, hx1, hy1), fill=EDGE, width=int(9 * k))
    for x, y in ((hx0, hy0), (hx1, hy1)):
        d.ellipse((x - 4.5 * k, y - 4.5 * k, x + 4.5 * k, y + 4.5 * k), fill=EDGE)
    d.line((hx0, hy0, hx1, hy1), fill=(0x5B, 0x46, 0x36, 255), width=int(5.5 * k))
    for x, y in ((hx0, hy0), (hx1, hy1)):
        d.ellipse((x - 2.75 * k, y - 2.75 * k, x + 2.75 * k, y + 2.75 * k), fill=(0x5B, 0x46, 0x36, 255))
    d.ellipse((cx - r - 3 * k, cy - r - 3 * k, cx + r + 3 * k, cy + r + 3 * k), outline=EDGE, width=int(6 * k))
    d.ellipse((cx - r - 1.5 * k, cy - r - 1.5 * k, cx + r + 1.5 * k, cy + r + 1.5 * k), outline=(0xD6, 0xD9, 0xDF, 255), width=int(3 * k))
    g = 14 * k  # glint: SVG's arc from (11,17) to (20,10), radius 14
    d.arc((cx - g, cy - g, cx + g, cy + g), 205, 252, fill=(255, 255, 255, 140), width=int(2 * k))

    save(canvas, 'player-tracker.webp')
    return canvas


RED = ((255, 92, 104), (196, 38, 56), (120, 18, 32))  # key face top, face bottom, ledge
RED_DARK = ((150, 28, 40), (88, 12, 22), (48, 5, 11))  # Agents' key (Adrian: darker) + the tab keys (Nov 2 2026: red, then grey, now this)


def key(canvas, box, plate, rad, led, drop=(X * 2, 110)):
    """Raised key (site recipe): 2px dark edge, darker bottom ledge (the box's last `led` px), light top line, soft drop."""
    x0, y0, x1, y1 = [int(v) for v in box]
    top, bot, ledge = plate
    sil = Image.new('L', (S, S), 0)
    ImageDraw.Draw(sil).rounded_rectangle((x0, y0, x1, y1), rad, fill=255)
    canvas.alpha_composite(shadow(sil, drop[0], drop[1]), (0, int(drop[0])))
    edge = Image.new('RGBA', (S, S), EDGE)
    edge.putalpha(sil.filter(ImageFilter.MaxFilter(2 * X + 1)))
    canvas.alpha_composite(edge)
    ImageDraw.Draw(canvas).rounded_rectangle((x0, y0, x1, y1), rad, fill=ledge + (255,))

    fy1 = y1 - led
    face = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    grad = Image.new('RGBA', (1, fy1 - y0))
    for i in range(fy1 - y0):
        t = i / (fy1 - y0 - 1)
        grad.putpixel((0, i), tuple(round(top[k] + (bot[k] - top[k]) * t) for k in range(3)) + (255,))
    face.paste(grad.resize((x1 - x0, fy1 - y0)), (x0, y0))
    fm = Image.new('L', (S, S), 0)
    ImageDraw.Draw(fm).rounded_rectangle((x0, y0, x1, fy1), rad, fill=255)
    face.putalpha(fm)
    canvas.alpha_composite(face)
    ImageDraw.Draw(canvas).line((x0 + rad, y0 + X * 2, x1 - rad, y0 + X * 2), fill=(255, 255, 255, 130), width=X * 2)
    return x0, y0, x1, fy1


def tab_key(glyph, scale, name):
    """A group tab's picture: a white glyph pressed into a dark red key (Lobby, Tracker, Database, Tools)."""
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    pad, led = X * 5, X * 6
    x0, y0, x1, y1 = key(canvas, (pad, pad - X * 2, S - pad, S - pad - X * 2 + led), RED_DARK, X * 22, led, (X * 3, 120))

    eye = fit(glyph, int((x1 - x0) * scale))
    ex, ey = (S - eye.width) // 2, y0 + ((y1 - y0) - eye.height) // 2
    dark = Image.new('RGBA', eye.size, (30, 3, 8, 0))
    dark.putalpha(eye.getchannel('A').point(lambda v: v * 150 // 255))
    canvas.alpha_composite(dark, (ex, ey + X * 2))  # pressed-in shadow under the glyph
    canvas.alpha_composite(eye, (ex, ey))

    save(canvas, name)
    return canvas


def lobby():
    """Lobby tab: the Spike (Valorant's Standard mode icon) on the Tracker's dark red key."""
    glyph = Image.new('RGBA', art('spike').size, (255, 255, 255, 255))  # white, like the ability glyphs
    glyph.putalpha(art('spike').getchannel('A'))
    return tab_key(glyph, 0.7, 'lobby.webp')


def tracker():
    """Tracker tab: Cypher's Spycam on a dark red key."""
    return tab_key(art('spycam'), 0.78, 'tracker.webp')


def tools():
    """Tools tab: Killjoy's Turret on the Tracker's dark red key."""
    return tab_key(art('turret'), 0.78, 'tools.webp')


def database():
    """Database tab: the plain database stack (lid + 3 disks) on the Tracker's dark red key."""
    w, h, e, gap = 400, 460, 120, 26  # stack width, height, ellipse height, gap between disks
    m = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(m)
    d.ellipse((0, 0, w, e), fill=255)
    d.rectangle((0, e // 2, w, h - e // 2), fill=255)
    d.ellipse((0, h - e, w, h), fill=255)
    step = (h - e) / 3
    for i in range(3):  # lid line, then two disk lines, each following the front curve
        y = i * step
        d.arc((0, y + (gap if i else 0), w, y + e + (gap if i else 0)), 0, 180, fill=0, width=gap)
    glyph = Image.new('RGBA', (w, h), (255, 255, 255, 255))
    glyph.putalpha(m)
    return tab_key(glyph, 0.62, 'database.webp')


GRAPH = ((58, 62, 70), (30, 33, 39), (12, 13, 16))  # Tools pages' dark key: face top, face bottom, ledge
WHITE, VRED = (255, 255, 255, 255), (255, 70, 85, 255)


def cross(d, cx, cy, u, gap=2.1, ln=3.8, th=1.05, dot=1.2):
    """Valorant-style crosshair: 4 white bars round a gap + a red centre dot. u = one crosshair px."""
    t, g, l = th * u / 2, gap * u, ln * u
    for box in ((cx - t, cy - g - l, cx + t, cy - g), (cx - t, cy + g, cx + t, cy + g + l),
                (cx - g - l, cy - t, cx - g, cy + t), (cx + g, cy - t, cx + g + l, cy + t)):
        d.rectangle(box, fill=WHITE)
    r = dot * u / 2
    d.rectangle((cx - r, cy - r, cx + r, cy + r), fill=VRED)


def default_cross(d, cx, cy, u):
    """Valorant's default crosshair: short inner lines + small outer lines further out, no dot."""
    t = 1.05 * u / 2
    for g, l in ((1.5 * u, 2.4 * u), (5.0 * u, 1.2 * u)):
        for box in ((cx - t, cy - g - l, cx + t, cy - g), (cx - t, cy + g, cx + t, cy + g + l),
                    (cx - g - l, cy - t, cx - g, cy + t), (cx + g, cy - t, cx + g + l, cy + t)):
            d.rectangle(box, fill=WHITE)


def reticle(d, cx, cy, u):
    """A sniper sight: a ring with 4 lines crossing it towards the centre, red dot."""
    r, t = 4.4 * u, 0.9 * u / 2
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=WHITE, width=round(0.9 * u))
    g, o = 1.6 * u, 5.6 * u
    for box in ((cx - t, cy - o, cx + t, cy - g), (cx - t, cy + g, cx + t, cy + o),
                (cx - o, cy - t, cx - g, cy + t), (cx + g, cy - t, cx + o, cy + t)):
        d.rectangle(box, fill=WHITE)
    d.rectangle((cx - 0.55 * u, cy - 0.55 * u, cx + 0.55 * u, cy + 0.55 * u), fill=VRED)


def red_cross(d, cx, cy, u):
    """The small solid red cross, no gap (a common pro pick)."""
    t, l = 1.2 * u / 2, 3.0 * u
    d.rectangle((cx - t, cy - l, cx + t, cy + l), fill=VRED)
    d.rectangle((cx - l, cy - t, cx + l, cy + t), fill=VRED)


def chat_px(pid, col=WHITE):
    """A Chat Art Gallery piece (site/valorant-chatart.json, `px` rows), one square block per pixel."""
    with open(os.path.join(SITE, 'valorant-chatart.json'), encoding='utf-8') as f:
        rows = next(a for a in json.load(f)['art'] if a['id'] == pid)['px']

    def draw(d, cx, cy, u):
        x0, y0 = cx - len(rows[0]) * u / 2, cy - len(rows) * u / 2
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == '#':
                    d.rectangle((x0 + i * u, y0 + j * u, x0 + (i + 1) * u - 1, y0 + (j + 1) * u - 1), fill=col)

    return draw


def glyph_layer(draw, *args):
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    draw(ImageDraw.Draw(layer), *args)
    return layer


def dark_key():
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    pad, led = X * 5, X * 6
    return canvas, key(canvas, (pad, pad - X * 2, S - pad, S - pad - X * 2 + led), GRAPH, X * 22, led, (X * 3, 120))


def page_key(draw, u, name):
    """A Tools page (Crosshairs, Chat Art): its glyph alone on a dark raised key."""
    canvas, (x0, y0, x1, y1) = dark_key()
    g = glyph_layer(draw, (x0 + x1) / 2, (y0 + y1) / 2, u)
    canvas.alpha_composite(shadow(g.getchannel('A'), 0.1, 160), (0, X * 2))  # pressed-in shadow under the glyph
    canvas.alpha_composite(g)
    save(canvas, name)
    return canvas


def well(canvas, box, rad):
    """Sunken well (site recipe): darker fill, shade under the top rim, light line along the bottom."""
    x0, y0, x1, y1 = box
    ImageDraw.Draw(canvas).rounded_rectangle(box, rad, fill=(13, 14, 17, 255))
    inside = Image.new('L', (S, S), 0)
    ImageDraw.Draw(inside).rounded_rectangle(box, rad, fill=255)
    rim = Image.new('L', (S, S), 0)
    ImageDraw.Draw(rim).rounded_rectangle((x0 - X * 4, y0 - X * 8, x1 + X * 4, y0 + X * 1.5), rad, fill=200)
    rim = Image.composite(rim.filter(ImageFilter.GaussianBlur(X * 1.5)), Image.new('L', (S, S), 0), inside)
    shade = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    shade.putalpha(rim)
    canvas.alpha_composite(shade)
    ImageDraw.Draw(canvas).line((x0 + rad, y1, x1 - rad, y1), fill=(255, 255, 255, 45), width=X)


def wells(draws, u, name):
    """A Tools gallery page: the dark key holding 2x2 sunken wells, a different piece in each."""
    canvas, (x0, y0, x1, y1) = dark_key()
    m, gap, rad = X * 9, X * 5, X * 8
    cell = ((x1 - x0) - 2 * m - gap) / 2
    for k, draw in enumerate(draws):
        cx0, cy0 = x0 + m + (k % 2) * (cell + gap), y0 + m + (k // 2) * (cell + gap)
        well(canvas, (cx0, cy0, cx0 + cell, cy0 + cell), rad)
        draw(ImageDraw.Draw(canvas), cx0 + cell / 2, cy0 + cell / 2, u)
    save(canvas, name)
    return canvas


def crosshairs():
    return page_key(cross, X * 6.2, 'crosshairs.webp')


def crosshair_gallery():
    """Ours (the Crosshairs icon), Valorant's default, a sniper sight, a small red cross."""
    return wells([lambda d, x, y, u: cross(d, x, y, u, ln=3.4), default_cross, reticle, red_cross], X * 3.0, 'crosshair-gallery.webp')


def chat_art():
    return page_key(chat_px('heart', VRED), X * 7.5, 'chat-art.webp')


def chat_art_gallery():
    return wells([chat_px('heart', VRED), chat_px('smile'), chat_px('star'), chat_px('skull')], X * 3.6, 'chat-art-gallery.webp')


def roulette():
    """Instalock Roulette: the page's wheel on the dark key (the lobby card's look): grey slices, the winner red under
    a red pin at the top, the red hub."""
    canvas, (x0, y0, x1, y1) = dark_key()
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 + X * 3
    r = (x1 - x0) * 0.38
    w = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(w)
    d.ellipse((cx - r - X * 3, cy - r - X * 3, cx + r + X * 3, cy + r + X * 3), fill=(11, 12, 14, 255))  # dark rim
    for i in range(12):  # 30 degree slices, slice 0 centred under the pin
        a = -105 + i * 30
        col = VRED if i == 0 else ((150, 155, 166, 255) if i % 2 else (96, 100, 110, 255))
        d.pieslice((cx - r, cy - r, cx + r, cy + r), a, a + 30, fill=col)
    h = r * 0.26
    d.ellipse((cx - h - X * 2, cy - h - X * 2, cx + h + X * 2, cy + h + X * 2), fill=EDGE)
    d.ellipse((cx - h, cy - h, cx + h, cy + h), fill=(214, 76, 76, 255))
    canvas.alpha_composite(shadow(w.getchannel('A'), X * 2, 150), (0, X * 2))
    canvas.alpha_composite(w)

    pw, ph, py = r * 0.22, r * 0.32, cy - r - X * 7  # the pin: a red key-cap point over the rim
    pin = [(cx - pw, py), (cx + pw, py), (cx + pw, py + ph * 0.46), (cx, py + ph), (cx - pw, py + ph * 0.46)]
    m = Image.new('L', (S, S), 0)
    ImageDraw.Draw(m).polygon(pin, fill=255)
    e = Image.new('RGBA', (S, S), EDGE)
    e.putalpha(m.filter(ImageFilter.MaxFilter(2 * X + 1)))
    canvas.alpha_composite(shadow(m, X * 1.5, 170), (0, X * 2))
    canvas.alpha_composite(e)
    ImageDraw.Draw(canvas).polygon(pin, fill=VRED)
    save(canvas, 'instalock-roulette.webp')
    return canvas


def leaderboards():
    """Radiant inside a gold laurel wreath, in Radiant's own gold: two branches up the sides, leaves in
    pairs that shrink toward the tips, the site's 2px dark edge round the wreath, soft drop."""
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    cx, cy, R = S / 2, S * 0.50, S * 0.41
    wreath = Image.new('L', (S, S), 0)
    stem = ImageDraw.Draw(wreath)
    for side in (-1, 1):  # -1 = left branch; angles run from the bottom (90) up the side
        for a in range(112, 200, 11):
            ang = math.radians(a if side < 0 else 180 - a)
            px, py = cx + R * math.cos(ang), cy + R * math.sin(ang)
            L, W = S * 0.115 * (1 - (a - 112) / 300), S * 0.042
            leaf = Image.new('L', (int(L * 2), int(L * 2)), 0)
            ImageDraw.Draw(leaf).ellipse((L * 0.5, L - W / 2, L * 1.5, L + W / 2), fill=255)
            tang = math.degrees(ang) + 90 * side
            for off in (38, -38):
                t = tang + off * side
                ox, oy = px + math.cos(math.radians(t)) * L * 0.45, py + math.sin(math.radians(t)) * L * 0.45
                wreath.paste(255, (int(ox - L), int(oy - L)), leaf.rotate(-t, resample=Image.BICUBIC))
        a0, a1 = (108, 190) if side < 0 else (-10, 72)  # stem ends with the last leaf pair
        stem.arc((cx - R, cy - R, cx + R, cy + R), a0, a1, fill=255, width=X * 3)
    canvas.alpha_composite(shadow(wreath, X * 3, 140), (0, X * 3))
    edge = Image.new('RGBA', (S, S), EDGE)
    edge.putalpha(wreath.filter(ImageFilter.MaxFilter(2 * X + 1)))
    canvas.alpha_composite(edge)
    top, bot, y0, y1 = (255, 222, 130), (196, 140, 40), S * 0.2, S * 0.95
    grad = Image.new('RGBA', (1, S))
    for y in range(S):
        t = min(1, max(0, (y - y0) / (y1 - y0)))
        grad.putpixel((0, y), tuple(round(top[k] + (bot[k] - top[k]) * t) for k in range(3)) + (255,))
    gold = grad.resize((S, S))
    gold.putalpha(wreath)
    canvas.alpha_composite(gold)

    badge = fit(art('radiant'), int(S * 0.64))
    bx, by = int(cx - badge.width / 2), int(S * 0.47 - badge.height / 2)
    sil = Image.new('L', (S, S), 0)
    sil.paste(badge.getchannel('A'), (bx, by))
    canvas.alpha_composite(shadow(sil, X * 3, 160), (0, X * 3))
    canvas.alpha_composite(badge, (bx, by))

    save(canvas, 'leaderboards.webp')
    return canvas


BOX, BOX_R = (S * 0.10, S * 0.40, S * 0.90, S * 0.94), X * 12  # the Agents key


def placed(im, x, y):
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    layer.alpha_composite(im, (int(x), int(y)))
    return layer


def drop(canvas, im, x, y, edge=True, alpha=160):
    """Paste with a soft drop and (edge) the site's 2px dark edge round it."""
    layer = placed(im, x, y)
    canvas.alpha_composite(shadow(layer.getchannel('A'), X * 3, alpha), (0, X * 3))
    if edge:
        e = Image.new('RGBA', (S, S), EDGE)
        e.putalpha(layer.getchannel('A').filter(ImageFilter.MaxFilter(2 * X + 1)))
        canvas.alpha_composite(e)
    canvas.alpha_composite(layer)


def agents():
    """Jett's head and ponytail breaking out of the top of a dark red key: inside the key the bust is
    clipped to it, above its top edge it's kept, with the 2px dark edge round the part that sticks out.
    From her full portrait (the face icon is cropped square, so its hair would show a flat cut)."""
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    key(canvas, BOX, RED_DARK, BOX_R, X * 4, (X * 3, 150))
    bust = art('jett-full').crop((790, 165, 1230, 605)).resize((int(S * 0.98),) * 2, Image.LANCZOS)
    layer = placed(bust, S / 2 - bust.width / 2 + X * 2, BOX[3] - bust.height + X * 6)
    zero = Image.new('L', (S, S), 0)
    tile = Image.new('L', (S, S), 0)
    ImageDraw.Draw(tile).rounded_rectangle([int(v) for v in BOX], BOX_R, fill=255)
    above = Image.new('L', (S, S), 0)
    ImageDraw.Draw(above).rectangle((0, 0, S, BOX[1] + BOX_R), fill=255)
    keep = Image.composite(Image.new('L', (S, S), 255), tile, above)
    layer.putalpha(Image.composite(layer.getchannel('A'), zero, keep))
    top = Image.new('L', (S, S), 0)
    ImageDraw.Draw(top).rectangle((0, 0, S, BOX[1] + X), fill=255)
    edge = Image.new('RGBA', (S, S), EDGE)
    edge.putalpha(Image.composite(layer.getchannel('A').filter(ImageFilter.MaxFilter(2 * X + 1)), zero, top))
    canvas.alpha_composite(edge)
    canvas.alpha_composite(layer)
    save(canvas, 'agents.webp')
    return canvas


def weapons():
    """The Classic (the Weapons page's own drawing of it) on its own, big, tilted up a little."""
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gun = fit(art('classic').rotate(14, resample=Image.BICUBIC, expand=True), int(S * 0.94))
    drop(canvas, gun, S / 2 - gun.width / 2, S / 2 - gun.height / 2)
    save(canvas, 'weapons.webp')
    return canvas


def ranks():
    """Silver 3 on its own, big."""
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    b = fit(art('silver3'), int(S * 0.90))
    drop(canvas, b, S / 2 - b.width / 2, S / 2 - b.height / 2 - X * 2, edge=False)
    save(canvas, 'ranks.webp')
    return canvas


def maps():
    """Ascent's minimap (baked for the maps pages), darkened so the white pin standing on it stands out."""
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    mm = Image.open(os.path.join(SITE, 'images', 'valorant', 'maps', 'ascent-minimap.webp')).convert('RGBA')
    mm = fit(mm, int(S * 0.92))
    rgb = mm.convert('RGB').point(lambda v: int(v * 0.62))
    mm = Image.merge('RGBA', (*rgb.split(), mm.getchannel('A')))
    drop(canvas, mm, S / 2 - mm.width / 2, S * 0.06, alpha=120)

    pin = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(pin)
    cx, r, tip = S * 0.5, S * 0.15, S * 0.62
    cy = S * 0.06 + r
    t = math.asin(r / (tip - cy))  # tangent points from the tip
    d.polygon([(cx + r * math.cos(t), cy + r * math.sin(t)), (cx, tip), (cx - r * math.cos(t), cy + r * math.sin(t))], fill=(246, 242, 236, 255))
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(246, 242, 236, 255))
    ri = r * 0.42
    d.ellipse((cx - ri, cy - ri, cx + ri, cy + ri), fill=(200, 46, 60, 255))
    drop(canvas, pin, 0, 0, alpha=170)
    save(canvas, 'maps.webp')
    return canvas


if __name__ == '__main__':
    player_tracker()
    lobby()
    tracker()
    database()
    tools()
    leaderboards()
    agents()
    weapons()
    ranks()
    maps()
    crosshairs()
    crosshair_gallery()
    chat_art()
    chat_art_gallery()
    roulette()
    print('wrote', OUT)
