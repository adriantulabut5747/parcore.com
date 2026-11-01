"""Bakes the Clash Royale pictures the cr- pages use (Oct 30 2026, plan: docs/clash-royale-plan.md).

  site/images/clash-royale/cards/<id>.webp        every card (+ -evo / -hero art where it has one) and tower troop,
                                                  from the official API's icons (names in site/cr-cards.json)
  site/images/clash-royale/knight/face*.webp      the guide's faces (the Golden Knight, Oct 31 2026), + full.webp = his
                                                  whole render, from Supercell's fan kit (fankit.supercell.com)
  site/images/clash-royale/banner-*.webp          banner art, fan kit key art
  site/images/clash-royale/lobby/*.webp           the Lobby's art (fan kit). lobby/throne.webp (the hero: a skeleton
                                                  reaching for the crown) is Adrian's file, not the kit's: not baked here

Run after scripts/cr-meta.mjs adds a card:  python scripts/cr-assets.py  (only missing files are fetched;
--force re-bakes all). No key needed: both hosts are public.
"""
import io, json, sys, urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'site'
OUT = ROOT / 'images' / 'clash-royale'
FORCE = '--force' in sys.argv
API = 'https://api-assets.clashroyale.com/'
FANKIT = 'https://media.ffycdn.net/eu/supercell/{}?width={}'

# Fan kit files (the kit's title -> its file on the kit's CDN).
# The Golden Knight's faces: file, width fetched, then a square (centre x, centre y, side) in that picture's pixels.
FACES = {
    'face': ('WFdgFwDaXr2SUHRYieJK.png', 2048, (1010, 500, 440)),       # Golden_Knight render, the smirk: default
    'face-laugh': ('HArsmUd6d7fXoQNTF8QH.png', 2048, (530, 1110, 320)),  # group_champions, the cheeky grin: a joke line
    'face-mew': ('qHRbHZxrFZExfYizQ5ns.png', 1000, (330, 470, 860)),     # emotes_goldenknight_mewing: a line about his looks
    'face-shock': ('Ttir3pbPF6qVbMFuhKd1.png', 256, (128, 98, 170)),     # emote_golden_knight_fail, crying: a "Whoa" line
}
FULL = 'WFdgFwDaXr2SUHRYieJK.png'  # the same render, whole (Ask the Golden Knight)
BANNERS = {'banner-battle': 'dquPj9JBAFkkcMRBhbwi.png'}  # group_6, the classic arena: King tower, Giant, Goblin, Fireball
# Lobby art: name -> (file, width fetched, saved as photo (RGB) or cut-out (RGBA))
LOBBY = {
    'court': ('HJKaA9PCxoi56qbWQiFo.jpeg', 1600, 'RGB'),  # groups_champions_2: Golden Knight, Skeleton King, Archer Queen
    'crown-red': ('QTQoZZ8e18aR8d3ZtvEK.png', 400, 'RGBA'),  # Red Crown 1
    'crown-blue': ('m1xRh8chWGRUyA5BcuWA.png', 400, 'RGBA'),  # Blue Crown 1
}


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'parchrome-assets'})
    return urllib.request.urlopen(req, timeout=60).read()


def save(img, path, q=86):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'WEBP', quality=q, method=6)


def cards():
    data = json.loads((ROOT / 'cr-cards.json').read_text(encoding='utf-8'))
    jobs = []  # (id, file suffix, API folder, icon file name); the three folders share one file name
    for c in data['cards']:
        jobs.append((c['id'], '', 'cards/300/', c['icon']))
        if c['evo'] in (1, 3):
            jobs.append((c['id'], '-evo', 'cardevolutions/300/', c['icon']))
        if c['evo'] in (2, 3):
            jobs.append((c['id'], '-hero', 'cardheroes/300/', c['icon']))
    jobs += [(t['id'], '', 'cards/300/', t['icon']) for t in data['towers']]
    done = 0
    for cid, suffix, prefix, icon in jobs:
        out = OUT / 'cards' / f'{cid}{suffix}.webp'
        if out.exists() and not FORCE:
            continue
        im = Image.open(io.BytesIO(get(API + prefix + icon + '.png'))).convert('RGBA')
        im.thumbnail((150, 200), Image.LANCZOS)  # shown at ~56-72px wide: 2x
        save(im, out)
        done += 1
    print(f'cards: {done} baked, {len(jobs)} in all')


def faces():
    for name, (file, width, (cx, cy, s)) in FACES.items():
        out = OUT / 'knight' / f'{name}.webp'
        if out.exists() and not FORCE:
            continue
        im = Image.open(io.BytesIO(get(FANKIT.format(file, width)))).convert('RGBA')
        im = im.crop((cx - s // 2, cy - s // 2, cx + s // 2, cy + s // 2)).resize((128, 128), Image.LANCZOS)
        save(im, out, 90)
    out = OUT / 'knight' / 'full.webp'
    if FORCE or not out.exists():
        im = Image.open(io.BytesIO(get(FANKIT.format(FULL, 2048)))).convert('RGBA')
        im = im.crop(im.getbbox())
        im.thumbnail((900, 900), Image.LANCZOS)
        save(im, out, 86)
    print('faces: ok')


def banners():
    for name, file in BANNERS.items():
        out = OUT / f'{name}.webp'
        if out.exists() and not FORCE:
            continue
        im = Image.open(io.BytesIO(get(FANKIT.format(file, 1800)))).convert('RGB')
        save(im, out, 80)
    print('banners: ok')


def lobby():
    for name, (file, width, mode) in LOBBY.items():
        out = OUT / 'lobby' / f'{name}.webp'
        if out.exists() and not FORCE:
            continue
        save(Image.open(io.BytesIO(get(FANKIT.format(file, width)))).convert(mode), out, 80 if mode == 'RGB' else 88)
    print('lobby: ok')


if __name__ == '__main__':
    cards()
    faces()
    banners()
    lobby()
