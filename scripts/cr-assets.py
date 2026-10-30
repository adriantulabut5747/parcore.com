"""Bakes the Clash Royale pictures the cr- pages use (Oct 30 2026, plan: docs/clash-royale-plan.md).

  site/images/clash-royale/cards/<id>.webp        every card (+ -evo / -hero art where it has one) and tower troop,
                                                  from the official API's icons (names in site/cr-cards.json)
  site/images/clash-royale/king/face*.webp        the guide's faces, from Supercell's fan kit (fankit.supercell.com)
  site/images/clash-royale/banner-*.webp          banner art, fan kit key art

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

# Fan kit files (the kit's title -> its file on the kit's CDN). The King's head renders are 960px, transparent.
FACES = {
    'face': '1xq9RhxUySJiFXaEHP6r.png',        # King_06, the grin: default
    'face-laugh': '4SXo14aYyQTCMpesjyWm.png',  # King_24, the classic "He he he he"
    'face-shock': 'bNkEtNmGMgmC23J5d3Hp.png',  # King_19, worried, teary: for a "Whoa" line
}
BANNERS = {'banner-battle': 'dquPj9JBAFkkcMRBhbwi.png'}  # group_6, the classic arena: King tower, Giant, Goblin, Fireball


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
    for name, file in FACES.items():
        out = OUT / 'king' / f'{name}.webp'
        if out.exists() and not FORCE:
            continue
        im = Image.open(io.BytesIO(get(FANKIT.format(file, 960)))).convert('RGBA')
        im = im.crop(im.getbbox())  # trim the empty margin, then a square on the face (crown to beard)
        w, h = im.size
        s = min(w, h)
        im = im.crop(((w - s) // 2, 0, (w - s) // 2 + s, s))
        pad = Image.new('RGBA', (int(s * 1.1), int(s * 1.1)))  # headroom: the round frame clipped the crown
        pad.alpha_composite(im, (int(s * 0.05), int(s * 0.07)))
        im = pad.resize((128, 128), Image.LANCZOS)
        save(im, out, 90)
    print('faces: ok')


def banners():
    for name, file in BANNERS.items():
        out = OUT / f'{name}.webp'
        if out.exists() and not FORCE:
            continue
        im = Image.open(io.BytesIO(get(FANKIT.format(file, 1800)))).convert('RGB')
        save(im, out, 80)
    print('banners: ok')


if __name__ == '__main__':
    cards()
    faces()
    banners()
