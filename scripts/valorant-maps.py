# Maps pages (Oct 30 2026): /valorant/maps/ + one static page per map (/valorant/maps/<slug>), so every
# callout and tip is in the page for Google. Edit THIS script or scripts/valorant-maps.json and rerun --
# never the pages it writes. Live part: the ranked pool badges (valorant-maps.js asks our Worker).
#
# Sources: valorant-api.com /v1/maps (pictures, callouts + the numbers that place them on the minimap,
# sites, in-game coordinates); the hand-written scripts/valorant-maps.json (dates, places, blurbs, guides).
# The page shell (head, bars, sidebar, footer, More sheet) is the Weapons page's, swapped in at build time.
# Pictures are baked once into site/images/valorant/maps/ (WebP; valorant-api's splash PNGs are 2.3 MB).
#
# Run:  python scripts/valorant-maps.py            (--images re-bakes the pictures)
# Needs Pillow.

import datetime
import html
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'site'
OUT = ROOT / 'valorant' / 'maps'
IMG = ROOT / 'images' / 'valorant' / 'maps'
SHELL = ROOT / 'valorant' / 'weapons.html'
DATA = Path(__file__).with_name('valorant-maps.json')
# Cache version for valorant-maps.css / .js on every maps page: bump it when either file changes, then rerun.
ASSET_V = '20261030g'
VALORANT_CSS_V = '20261030a'

e = html.escape
MONTHS = 'January February March April May June July August September October November December'.split()
GROUPS = ['A', 'B', 'C', 'Mid', 'Attacker Side', 'Defender Side']
JETT = '<div class="cv-say"><img class="cv-face" src="/images/valorant/jett/face.webp" alt="" width="44" height="44" loading="lazy" decoding="async"><p><b>Jett</b>{}</p></div>'
MAP_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/></svg>'


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Parchrome maps build'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def bake(url, out, width, crop=None, force=False):
    """Save url as WebP at `width` px (crop = (w, h) ratio to cover-crop to). Skips files already there."""
    if out.exists() and not force:
        return
    im = Image.open(io.BytesIO(get(url)))
    im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
    if crop:
        w, h = im.size
        want = crop[0] / crop[1]
        if w / h > want:
            nw = round(h * want)
            im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
        else:
            nh = round(w / want)
            im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(out, 'WEBP', quality=74 if im.mode == 'RGB' else 88, method=6)
    print('  baked', out.name, f'{out.stat().st_size // 1024} KB')


def when(m):
    if m.get('released'):
        y, mo, _ = m['released'].split('-')
        return f'{MONTHS[int(mo) - 1]} {y}'
    return str(m['year']) if m.get('year') else ''


def sort_key(m):
    return m.get('released') or (f"{m['year']}-01-01" if m.get('year') else '0000')


def callout_label(c):
    sr, n = c['superRegionName'], c['regionName']
    if sr in ('A', 'B', 'C'):
        return n if n.startswith(sr + ' ') else f'{sr} {n}'
    if sr == 'Mid':
        return f'Mid {n}'
    return f"{sr.split()[0]} {n}"  # "Attacker Spawn", "Defender Nest"


def olive(p):
    r, g, b, a = p
    return a > 200 and b < r - 25 and abs(r - g) < 25 and r > 90


def plant_areas(im, step=4):
    """The olive plant areas Riot draws on a minimap: [(pixels as (u, v), ...), ...], specks dropped."""
    W, H = im.size
    px = im.load()
    seen, areas = set(), []
    for y in range(0, H, step):
        for x in range(0, W, step):
            if (x, y) in seen or not olive(px[x, y]):
                continue
            stack, pts = [(x, y)], []
            seen.add((x, y))
            while stack:
                cx, cy = stack.pop()
                pts.append((cx / W, cy / H))
                for nx, ny in ((cx + step, cy), (cx - step, cy), (cx, cy + step), (cx, cy - step)):
                    if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and olive(px[nx, ny]):
                        seen.add((nx, ny))
                        stack.append((nx, ny))
            if len(pts) * step * step > 1500:
                areas.append(pts)
    return areas


def callouts(api, minimap=None, spots=True):
    """[(group, [(label, key, [(u, v), ...]), ...]), ...]: one list row per label, every spot it marks.
    Checked against the minimap picture (Oct 30 2026, Adrian: Summit's attacker spawn sat in empty space):
    - a spot more than ~1% of the map from anything drawn is dropped (the name stays in the list), because
      valorant-api's numbers are stale on a few maps (Summit spawn, Corrode A Main / Lobby, Breeze A Lobby);
    - "X Site" goes on the plant area Riot draws for it, not on the callout's number;
    - spots=False (scripts/valorant-maps.json "callout_spots": false) keeps only sites + spawns."""
    rows = {}
    placeable = bool(api['xMultiplier'])  # the TDM maps ship all-zero numbers: names only, no spots
    alpha = minimap.getchannel('A').load() if minimap else None
    W, H = minimap.size if minimap else (0, 0)
    tol = round(W * 0.012)

    def drawn(u, v):
        x, y = int(u * W), int(v * H)
        return any(0 <= x + dx < W and 0 <= y + dy < H and alpha[x + dx, y + dy] > 40
                   for dx in range(-tol, tol + 1, 2) for dy in range(-tol, tol + 1, 2))

    def nearest_drawn(u, v, reach):
        x0, y0, r = int(u * W), int(v * H), int(reach * W)
        hits = [(dx * dx + dy * dy, x0 + dx, y0 + dy) for dx in range(-r, r + 1, 2) for dy in range(-r, r + 1, 2)
                if dx * dx + dy * dy <= r * r and 0 <= x0 + dx < W and 0 <= y0 + dy < H and alpha[x0 + dx, y0 + dy] > 40]
        return (min(hits)[1] / W, min(hits)[2] / H) if hits else None

    sites = {}
    for c in api.get('callouts') or []:
        lab = callout_label(c)
        if not placeable:
            rows.setdefault((c['superRegionName'], lab), [])
            continue
        u = c['location']['y'] * api['xMultiplier'] + api['xScalarToAdd']
        v = c['location']['x'] * api['yMultiplier'] + api['yScalarToAdd']
        assert 0 <= u <= 1 and 0 <= v <= 1, (api['displayName'], c['regionName'], u, v)
        row = rows.setdefault((c['superRegionName'], lab), [])
        if c['regionName'] == 'Site' and c['superRegionName'] in ('A', 'B', 'C'):
            sites[c['superRegionName']] = (u, v)
        elif minimap and drawn(u, v) and (spots or 'Spawn' in lab):
            row.append((u, v))
        elif minimap and 'Spawn' in lab and (near := nearest_drawn(u, v, 0.05)):
            # a spawn is a big room: one a hair outside the drawing (Sunset's defenders, 3.5%) moves onto
            # its nearest drawn edge; far off (Summit's attackers, 18%) it stays off
            row.append(near)
            print(f"   {api['displayName']}: {lab} moved onto the map edge ({u:.2f}, {v:.2f} -> {near[0]:.2f}, {near[1]:.2f})")
        elif minimap:
            print(f"   {api['displayName']}: {lab} left off the map" + ('' if not spots else f' ({u:.2f}, {v:.2f} is not on the drawn map)'))
    if sites and minimap:
        # every plant area joins the site whose callout is nearest; the letter sits on the area's pixel nearest
        # its middle (Sunset's B is drawn as two patches around a pillar, so the plain middle is a hole)
        mine = {s: [] for s in sites}
        for area in plant_areas(minimap):
            mu, mv = sum(p[0] for p in area) / len(area), sum(p[1] for p in area) / len(area)
            mine[min(sites, key=lambda s: (sites[s][0] - mu) ** 2 + (sites[s][1] - mv) ** 2)].extend(area)
        for s, (u, v) in sites.items():
            area = mine[s]
            assert area, f"{api['displayName']}: no plant area drawn for {s}"
            mu, mv = sum(p[0] for p in area) / len(area), sum(p[1] for p in area) / len(area)
            rows[(s, f'{s} Site')].append(min(area, key=lambda p: (p[0] - mu) ** 2 + (p[1] - mv) ** 2))
    out = []
    for g in GROUPS + sorted({k[0] for k in rows} - set(GROUPS)):
        items = sorted((lab, re.sub(r'[^a-z0-9]+', '-', lab.lower()).strip('-'), pts) for (gg, lab), pts in rows.items() if gg == g)
        if items:
            out.append((g, items))
    return out


# Sites + spawns are always on the map (a letter, two faint words); every other callout only while picked.
def pin(group, lab, key, u, v):
    at = f'data-c="{key}" style="left:{u * 100:.2f}%;top:{v * 100:.2f}%"'
    big = at[:-1] + f';--u:{u:.3f};--v:{v:.3f}"'  # sites + spawns: valorant-maps.css keeps them inside the map
    if group in ('A', 'B', 'C') and lab == f'{group} Site':
        return f'<span class="vm-pin vm-pin--site" {big}><b>{group}</b></span>'
    if lab in ('Attacker Spawn', 'Defender Spawn'):
        side = 'atk' if lab[0] == 'A' else 'def'
        return f'<span class="vm-pin vm-pin--{side}" {big}><span>{"Attack" if side == "atk" else "Defend"}</span></span>'
    return f'<span class="vm-pin" {at}><i></i><span>{e(lab)}</span></span>'


def shell(title, desc, body_html):
    src = SHELL.read_text(encoding='utf-8')
    head = src[: src.index('<header class="cb"')]
    tail = src[src.index('  <footer class="pf-footer">'):]
    head = re.sub(r'<title>.*?</title>', f'<title>{e(title)}</title>', head)
    head = re.sub(r'(<meta name="description" content=")[^"]*', lambda m: m.group(1) + e(desc), head)
    head = re.sub(r'/valorant\.css\?v=\w+', f'/valorant.css?v={VALORANT_CSS_V}', head)
    head = re.sub(r'<link rel="stylesheet" href="/valorant-weapons\.css\?v=\w+">',
                  f'<link rel="stylesheet" href="/valorant-maps.css?v={ASSET_V}">', head)
    assert 'valorant-maps.css' in head, 'shell changed: the Weapons page no longer links valorant-weapons.css'
    assert '<body class="vl-ground" data-game-nav="valorant"' in head, 'shell changed: the Weapons page body tag'
    head = head.replace('<body class="vl-ground"', '<body class="vl-ground vm-page"', 1)
    return head + body_html + f'\n<script src="/valorant-maps.js?v={ASSET_V}"></script>\n' + tail


def banner(kicker, title, text, art, ico, facts):
    ico_html = f'<img src="{ico}" alt="" decoding="async">' if ico and ico.startswith('/') else ico
    strip = ''.join(
        f'<span class="cb-fact"{" " + extra if extra else ""}><small>{e(k)}</small><b>{b}</b><em>{e(sub)}</em></span>'
        for k, b, sub, extra in facts)
    return f'''<header class="cb" aria-labelledby="cbTitle">
  <span class="cb-art" aria-hidden="true" style="background-image:url('{art}')"></span>
  <span class="cb-ico" aria-hidden="true">{ico_html}</span>
  <div class="cb-copy">
    <p class="cb-kicker">{e(kicker)}</p>
    <h1 class="cb-title" id="cbTitle">{e(title)}</h1>
    <p class="cb-text">{e(text)}</p>
    <div class="cb-strip">{strip}</div>
  </div>
</header>
'''


def section(sid, title, jett, inner, last=False):
    return f'''
<section class="ct-sec{' ct-sec--last' if last else ''}" aria-labelledby="{sid}">
  <header class="ct-head">
    <h2 class="ct-title" id="{sid}">{e(title)}</h2>
    {JETT.format(e(jett))}
  </header>
{inner}
</section>
'''


def card(m):
    pool = f'<span class="vm-pool" data-pool="{e(m["name"])}" hidden></span>' if m['mode'] == 'competitive' else ''
    meta = ' · '.join(x for x in [m.get('sites_txt') or m.get('kind') or m['mode_name'], when(m)] if x)
    return f'''<a class="vm-card" href="/valorant/maps/{m['slug']}">
  <span class="vm-pic"><img src="/images/valorant/maps/{m['slug']}-card.webp" alt="" width="720" height="405" loading="lazy" decoding="async">{pool}</span>
  <span class="vm-txt"><b>{e(m['name'])}</b><small>{e(meta)}</small><span>{e(m['blurb'])}</span></span>
</a>'''


def map_page(m, same_mode, data):
    name, slug = m['name'], m['slug']
    api = m['api']
    facts = []
    if m['mode'] == 'competitive':
        facts.append(('Sites', e(m['sites_txt'].replace(' sites', '')), f"{len(m['sites'])} sites", ''))
    else:
        facts.append(('Mode', e(m.get('kind') or m['mode_name']), m.get('place', ''), ''))
    if when(m):
        facts.append(('Released', e(when(m)), f"Patch {m['patch']}" if m.get('patch', '')[:1].isdigit() else m.get('patch', ''), ''))
    if m['mode'] == 'competitive':
        facts.append(('Ranked pool', '&nbsp;', 'Live from the game', f'id="vmPool" data-pool="{e(name)}" hidden'))
    ico = f'/images/valorant/maps/{slug}-minimap.webp' if api.get('displayIcon') else MAP_ICON
    body = banner('Valorant maps', name, m['blurb'], f'/images/valorant/maps/{slug}.webp', ico, facts)

    tabs = ['<a href="/valorant/maps/">' + MAP_ICON + 'All maps</a>'] + [
        f'<a href="/valorant/maps/{o["slug"]}"{" aria-current=" + chr(34) + "page" + chr(34) if o is m else ""}>{e(o["name"])}</a>'
        for o in same_mode]
    body += f'<nav class="cb-tabs cb-tabs--many" aria-label="{e(m["mode_name"])} maps">{"".join(tabs)}</nav>\n'

    mm = IMG / f'{slug}-minimap.webp'
    groups = callouts(api, Image.open(mm).convert('RGBA') if mm.exists() else None, m.get('callout_spots', True))
    if groups:
        pins = ''.join(pin(g, lab, key, u, v) for g, items in groups for lab, key, pts in items for u, v in pts)
        lists = ''.join(
            f'<div class="vm-cg"><h3>{e(g if g in ("Mid",) or len(g) > 1 else g + " site")}</h3><ul>'
            + ''.join((f'<li><button type="button" data-c="{key}">{e(lab)}</button></li>' if pts else f'<li><span>{e(lab)}</span></li>') for lab, key, pts in items)
            + '</ul></div>'
            for g, items in groups)
        placed = any(pts for _, items in groups for _, _, pts in items)
        n = sum(max(len(pts), 1) for _, items in groups for _, _, pts in items)
        off = sum(not pts for _, items in groups for _, _, pts in items) if placed else 0
        count = f'<b>{n}</b> callouts' + (f' · {off} not drawn: {"its spot" if off == 1 else "their spots"} in the game data {"doesn't" if off == 1 else "don't"} match this minimap' if off else '')
        inner = f'''  <div class="vm-co" id="vmCallouts">
    <div class="vm-mapbox"><div class="vm-map"><img src="/images/valorant/maps/{slug}-minimap.webp" alt="{e(name)} minimap" width="1024" height="1024" loading="lazy" decoding="async">{pins}</div></div>
    <div class="vm-colist"><p class="vm-count">{count}</p>{lists}</div>
  </div>'''
        body += section('vmCoTitle', 'Callouts', "Hover a callout in the list to find it on the map, or tap it on your phone. Learn these and nobody has to yell 'over there'!" if placed
                        else f"Every callout name the game gives {name}. The files don't say where each one is, so learn them by playing. Fast learner? Like me.", inner)
    elif api.get('displayIcon'):
        inner = f'  <div class="vm-mapbox vm-mapbox--solo"><div class="vm-map"><img src="/images/valorant/maps/{slug}-minimap.webp" alt="{e(name)} minimap" width="1024" height="1024" loading="lazy" decoding="async"></div></div>'
        body += section('vmCoTitle', 'Minimap', f'The whole of {name} from above. No callouts in the game files for this one, so point and shout.', inner)

    g = m.get('guide')
    if g:
        tricks = ''.join(f'<li>{e(t)}</li>' for t in g['tricks'])
        sites = ''
        for s in g['sites']:
            cols = ''.join(
                f'<div class="vm-side vm-side--{k}"><h4>{label}</h4><ul>' + ''.join(f'<li>{e(t)}</li>' for t in s[k]) + '</ul></div>'
                for k, label in (('attack', 'Attack'), ('defend', 'Defend')) if s.get(k))
            big = s['name'] if len(s['name']) == 1 else ''
            sites += f'<article class="vm-site"><h3>{f"<b>{big}</b>" if big else ""}{e(s["name"] if not big else "Site")}</h3>{cols}</article>'
        inner = f'''  <p class="vm-intro">{e(g['intro'])}</p>
  <div class="vm-guide">
    <div class="vm-tricks"><h3>Map tricks</h3><ul>{tricks}</ul></div>
    <div class="vm-sites">{sites}</div>
  </div>'''
        body += section('vmGuideTitle', f'How to play {name}', f'Attack and defend tips for every site, plus the tricks {name} hides. Read fast, I\'m already on site!', inner)

    info_key = 'tdm' if m['mode'] == 'tdm' else ('skirmish' if slug == 'skirmish' else None)
    if info_key:
        body += section('vmModeTitle', f"How {m.get('kind') or m['mode_name']} works", 'The mode in one breath. Then go get some kills, I\'ll be right behind you. Okay, in front.',
                        f'  <p class="vm-note">{e(data["mode_info"][info_key])}</p>')
    rows = [('Mode', m.get('kind') or m['mode_name'])]
    if m.get('place'):
        rows.append(('Location', m['place']))
    if api.get('coordinates'):
        rows.append(('In-game coordinates', api['coordinates']))
    if m.get('real'):
        rows.append(('Real coordinates', m['real']))
    if m.get('sites_txt'):
        rows.append(('Sites', m['sites_txt']))
    if when(m):
        rows.append(('Released', when(m)))
    if m.get('patch'):
        rows.append(('Patch', m['patch']))
    if m['mode'] == 'competitive':
        rows.append(('Codename', api['mapUrl'].rsplit('/', 1)[-1]))
    if m.get('feature'):
        rows.append(('Known for', m['feature']))
    dl = ''.join(f'<div><dt>{e(k)}</dt><dd>{e(v)}</dd></div>' for k, v in rows)
    body += section('vmFactsTitle', 'Map file', f'Where {name} is, when it dropped and what Riot called it in the game files. Loading-screen trivia, you\'re welcome.',
                    f'  <dl class="vm-facts">{dl}</dl>', last=True)

    kind = 'callouts, attack and defend tips' if g else ('callouts and minimap' if groups else 'map facts')
    title = f'{name} Map Guide: Callouts and Tips | Valorant | Parchrome' if g else f'{name} | Valorant Maps | Parchrome'
    desc = f'Valorant {name}: {kind}, release date and location. {m["blurb"]}'
    return shell(title, desc[:300], body)


def index_page(maps, data):
    comp = [m for m in maps if m['mode'] == 'competitive']
    newest = comp[0]
    facts = [
        ('Maps', str(len(maps)), f'{len(comp)} ranked', ''),
        ('Ranked pool', '&nbsp;', 'Live from the game', 'id="vmPoolN" hidden'),
        ('Newest', e(newest['name']), when(newest), ''),
    ]
    body = banner('Valorant', 'Maps', 'Every map in the game: callouts on the minimap, attack and defend tips, and the live ranked pool.',
                  f"/images/valorant/maps/{newest['slug']}.webp", MAP_ICON, facts)
    modes = data['modes']
    tabs = [f'<button type="button" role="tab" data-mode="" aria-selected="true">All<span class="cb-n">{len(maps)}</span></button>'] + [
        f'<button type="button" role="tab" data-mode="{k}" aria-selected="false">{e(v["name"])}<span class="cb-n">{sum(m["mode"] == k for m in maps)}</span></button>'
        for k, v in modes.items()]
    body += f'<div class="cb-tabs" id="vmTabs" role="tablist" aria-label="Map modes">{"".join(tabs)}</div>\n'
    keys = list(modes)
    for i, (k, v) in enumerate(modes.items()):
        cards = '\n'.join(card(m) for m in maps if m['mode'] == k)
        body += section(f'vmSec-{k}', v['title'], v['jett'], f'  <div class="vm-grid">\n{cards}\n  </div>', last=i == len(keys) - 1).replace(
            '<section class="ct-sec', f'<section data-mode="{k}" class="ct-sec', 1)
    return shell('Valorant Maps: Every Map, Callouts and Guides | Parchrome',
                 'Every Valorant map, newest first: callouts drawn on each minimap, attack and defend tips for every site, release dates and the live ranked map pool.',
                 body)


def main():
    force = '--images' in sys.argv
    data = json.loads(DATA.read_text(encoding='utf-8'))
    api = json.loads(get('https://valorant-api.com/v1/maps'))['data']
    by_name = {}
    for a in api:
        by_name.setdefault(a['displayName'], []).append(a)
    used = set()
    maps = []
    for m in data['maps']:
        m = dict(m)
        m['mode_name'] = data['modes'][m['mode']]['name']
        if m['slug'] == 'skirmish':
            variants = sorted((a for a in api if a['displayName'].startswith('Skirmish ')), key=lambda a: a['displayName'])
            m['api'] = variants[0]  # A to E share one picture and have no minimap: one page for all five
            used.update(a['uuid'] for a in variants)
        else:
            found = by_name.get(m['name'])
            if not found:
                print('!! not in valorant-api:', m['name'], '(skipped)')
                continue
            m['api'] = next((a for a in found if a['mapUrl'].endswith('V2')), found[0])  # The Range: the current one
            used.update(a['uuid'] for a in found)
        sites = (m['api'].get('tacticalDescription') or '').replace(' Sites', '')
        if sites:
            m['sites'] = sites.split('/')
            m['sites_txt'] = sites + ' sites'
        maps.append(m)
    for a in api:
        if a['uuid'] not in used:
            print('!! new map in valorant-api, not in valorant-maps.json:', a['displayName'], a['mapUrl'])

    # newest first inside each mode; ties keep the JSON's order (Python's sort is stable)
    order = list(data['modes'])
    maps.sort(key=sort_key, reverse=True)
    maps.sort(key=lambda m: order.index(m['mode']))

    IMG.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for m in maps:
        a, s = m['api'], m['slug']
        bake(a['splash'], IMG / f'{s}.webp', 1600, force=force)
        bake(a['splash'], IMG / f'{s}-card.webp', 720, crop=(16, 9), force=force)
        if a.get('displayIcon'):
            bake(a['displayIcon'], IMG / f'{s}-minimap.webp', 1024, force=force)

    for m in maps:
        same = [o for o in maps if o['mode'] == m['mode']]
        (OUT / f"{m['slug']}.html").write_text(map_page(m, same, data), encoding='utf-8', newline='\n')
    (OUT / 'index.html').write_text(index_page(maps, data), encoding='utf-8', newline='\n')
    print(f'wrote {len(maps)} map pages + the index ({datetime.date.today()})')


if __name__ == '__main__':
    main()
