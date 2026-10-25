# Character pages (Oct 25 2026): /genshin-impact/characters/<slug>, one static HTML file each, so every
# word is in the page for Google. Edit THIS script (or scripts/genshin-builds.json) and rerun -- never the
# pages it writes. Live parts (on the wishes now, farm today, birthday countdown, wish history) are drawn in
# the browser by site/genshin-character.js from the feed + history; styles: site/genshin-character.css.
#
# Sources: yatta (Project Amber) avatar/{id} + avatarFetter/{id} (her story) + static/avatarCurve; our own files from the
# feed script (feed roster + farm, weapons, artifacts, enemies, nations, birthdays); the hand-written builds.
# The page shell (head, bars, sidebar, footer, More sheet) is the Characters list page's, swapped in at build
# time, so a ?v= bump there reaches every character page on the next run.
#
# Run:  python scripts/genshin-characters.py kamisato-ayaka     (slugs; none = every character)
# Needs Pillow only because it imports the feed script (which imports it at the top).

import datetime
import html
import importlib.util
import json
import re
import sys
import urllib.parse
from pathlib import Path


_spec = importlib.util.spec_from_file_location('genshin_feed', Path(__file__).with_name('genshin-feed.py'))
gf = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gf)  # its main() only runs as a script: this just borrows get / yatta / icon / game_text

ROOT = gf.ROOT
OUT = ROOT / 'genshin-impact' / 'characters'
SHELL = OUT / 'index.html'
BUILDS = Path(__file__).with_name('genshin-builds.json')
SITE = 'https://parchrome.netlify.app'
# Cache version for genshin-character.css / .js on every character page: bump it when either file changes, then rerun.
ASSET_V = '20261025e'
UTC8 = datetime.timezone(datetime.timedelta(hours=8))

e = html.escape
load = lambda name: json.loads((ROOT / name).read_text(encoding='utf-8'))
slug = lambda name: re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')  # = genshin-reruns.js / genshin-weapons.js slug()
num = lambda n: f'{round(n):,}'

# genshin-core.js EL (keep in step), as "r,g,b" for rgba() tints.
EL_RGB = {'Pyro': '239,138,76', 'Hydro': '76,184,239', 'Anemo': '95,211,180', 'Electro': '180,142,240', 'Dendro': '165,200,59', 'Cryo': '152,216,240', 'Geo': '239,195,94'}
# yatta rich text colours -> our classes (the game's: gold = a named thing, the rest = elements).
COLOR = {'FFD780': 'hl', '99FFFF': 'cryo', 'FF9999': 'pyro', '80C0FF': 'hydro', '80FFD7': 'anemo', 'FFACFF': 'electro', '99FF88': 'dendro', 'FFE699': 'geo'}
STAT = {
    'FIGHT_PROP_CRITICAL_HURT': 'CRIT DMG', 'FIGHT_PROP_CRITICAL': 'CRIT Rate', 'FIGHT_PROP_ATTACK_PERCENT': 'ATK', 'FIGHT_PROP_HP_PERCENT': 'HP',
    'FIGHT_PROP_DEFENSE_PERCENT': 'DEF', 'FIGHT_PROP_CHARGE_EFFICIENCY': 'Energy Recharge', 'FIGHT_PROP_ELEMENT_MASTERY': 'Elemental Mastery',
    'FIGHT_PROP_HEAL_ADD': 'Healing Bonus', 'FIGHT_PROP_PHYSICAL_ADD_HURT': 'Physical DMG Bonus', 'FIGHT_PROP_FIRE_ADD_HURT': 'Pyro DMG Bonus',
    'FIGHT_PROP_WATER_ADD_HURT': 'Hydro DMG Bonus', 'FIGHT_PROP_WIND_ADD_HURT': 'Anemo DMG Bonus', 'FIGHT_PROP_ELEC_ADD_HURT': 'Electro DMG Bonus',
    'FIGHT_PROP_GRASS_ADD_HURT': 'Dendro DMG Bonus', 'FIGHT_PROP_ICE_ADD_HURT': 'Cryo DMG Bonus', 'FIGHT_PROP_ROCK_ADD_HURT': 'Geo DMG Bonus',
}
STAT_ICON = {'CRIT DMG': 'cd', 'CRIT Rate': 'cr', 'ATK': 'atk', 'ATK%': 'atk', 'HP': 'hp', 'DEF': 'def', 'Energy Recharge': 'er', 'Elemental Mastery': 'em'}
# Every level the game lists, as (level, ascension phase): 20 then 20+ (ascended) and so on.
CAPS = [20, 40, 50, 60, 70, 80, 90]  # level cap after each ascension phase (0-6)
BOOK_DAYS = {'monday': [1, 4, 0], 'tuesday': [2, 5, 0], 'wednesday': [3, 6, 0]}  # JS getUTCDay(): Sunday = 0
TAG_CLASS = {'BiS': 'bis', 'F2P': 'f2p'}
DRAWN_SLOT = {'Sands': 5, 'Goblet': 1, 'Circlet': 3}  # artifact art suffix (genshin-artifacts.json pieces)




def rich(s):
    """yatta's in-game text -> safe HTML: escape first, then turn the game's own tags back into ours."""
    s = (s or '').replace('\\n', '\n').lstrip('#').replace('{NICKNAME}', 'Traveler')
    s = re.sub(r'\{LINK#[^}]*\}|\{/LINK\}', '', s)
    s = re.sub(r'\{LAYOUT_PC#([^}]*)\}', r'\1', s)
    s = re.sub(r'\{M#([^}]*)\}\{F#([^}]*)\}', r'\1/\2', s)
    s = re.sub(r'\{[^}]*\}', '', s)
    out = e(s, quote=False)
    out = re.sub(r'&lt;color=#([0-9A-Fa-f]{6})[0-9A-Fa-f]*&gt;(.*?)&lt;/color&gt;',
                 lambda m: f'<b class="cp-{COLOR.get(m.group(1).upper(), "hl")}">{m.group(2)}</b>', out, flags=re.S)
    out = re.sub(r'&lt;i&gt;(.*?)&lt;/i&gt;', r'<i>\1</i>', out, flags=re.S)
    out = re.sub(r'&lt;/?[a-z][^&]*?&gt;', '', out)
    return ''.join('<p>' + p.strip().replace('\n', '<br>') + '</p>' for p in re.split(r'\n\s*\n', out) if p.strip())




def fmt(spec, v):
    """{param1:F1P} -> '45.7%': F<n> = n decimals, P = percent, I = whole number."""
    pct = spec.endswith('P')
    m = re.match(r'F(\d)', spec)
    v = v * 100 if pct else v
    out = f'{v:,.{int(m.group(1)) if m else 0}f}'
    return out + ('%' if pct else '')


def scaling(t, top):
    """A talent's table: [[label, [value at Lv 1 .. top]]], every number formatted here (one place)."""
    levels = [t['promote'][str(lv)] for lv in range(1, top + 1) if str(lv) in t['promote']]
    rows = []
    for i, line in enumerate(levels[0]['description']):
        if not line or '|' not in line:
            continue
        label, tmpl = line.split('|', 1)
        rows.append([label, [re.sub(r'\{param(\d+):([A-Z0-9]+)\}', lambda m: fmt(m.group(2), p['params'][int(m.group(1)) - 1]), tmpl) for p in levels]])
    return rows



def page_href(name):
    """A character's page once it exists, else the Characters list's search."""
    return f'/genshin-impact/characters/{slug(name)}' if (OUT / (slug(name) + '.html')).exists() else '/genshin-impact/characters?q=' + urllib.parse.quote(name)


def face(c, role=None, link=True):
    """A character's face on its rarity backing, linking their page once it exists (else the list's search)."""
    href = page_href(c['name'])
    inner = f'<span class="gi-tile r{c["rarity"]}"><img src="{e(c["icon"])}" alt="" loading="lazy" decoding="async"></span>'
    if c.get('element'):
        inner += f'<img class="cp-face-el" src="/images/genshin/element/{c["element"].lower()}.webp" alt="" width="18" height="18">'
    tag = 'a' if link else 'span'
    return f'<{tag} class="cp-face"{f' href="{href}"' if link else ""} title="{e(c["name"])}">{inner}<span class="cp-face-n">{e(c["name"])}</span>{f"<small>{e(role)}</small>" if role else ""}</{tag}>'


def tile(item, n=None):
    name, rank, icon = item
    return (f'<li title="{e(name)}"><span class="gi-tile r{rank}"><img src="{e(icon)}" alt="" loading="lazy" decoding="async"></span>'
            f'{f"<b>×{num(n)}</b>" if n is not None else ""}<span class="gi-vh">{e(name)}</span></li>')






def build_page(c, d, fet, ctx):
    name, el = c['name'], c['element']
    rgb = EL_RGB.get(el, '185,190,198')
    key = c['icon'].rsplit('UI_AvatarIcon_', 1)[1].rsplit('.', 1)[0]
    me = slug(name)
    items = {k: [v['name'], v['rank'], gf.icon(v['icon'])] for k, v in (d.get('items') or {}).items() if v.get('icon')}
    fetter, other = d.get('fetter') or {}, d.get('other') or {}
    build = ctx['builds'].get(me)
    roster = {x['name']: x for x in ctx['feed']['characters']}

    # ---- talents: combat ones first (Normal, Skill, Alternate Sprint if any, Burst), then passives
    tal = [t for _, t in sorted(d['talent'].items(), key=lambda kv: int(kv[0]))]
    cons = [x for _, x in sorted(d['constellation'].items(), key=lambda kv: int(kv[0]))]
    boosted = {}  # talent name -> constellation number that adds 3 levels (C3 / C5)
    for i, x in enumerate(cons):
        m = re.search(r'Increases the Level of <color=[^>]*>(.*?)</color> by 3', x['description'])
        if m:
            boosted[m.group(1)] = i + 1
    t0 = [t for t in tal if t['type'] == 0]
    kinds = []
    for t in tal:
        if t['type'] == 1:
            kinds.append(('burst', 'Elemental Burst', 'Q'))
        elif t['type'] == 0:
            n = t0.index(t)
            kinds.append(('normal', 'Normal Attack', 'NA') if n == 0 else ('skill', 'Elemental Skill', 'E') if n == 1 else ('sprint', 'Alternate Sprint', 'Sprint'))
        else:
            n = sum(1 for k in kinds if k[0].startswith('passive'))
            kinds.append(('passive%d' % n, ['1st Ascension Passive', '4th Ascension Passive'][n] if n < 2 else 'Utility Passive', ['A1', 'A4'][n] if n < 2 else 'Passive'))
    order = sorted(range(len(tal)), key=lambda i: ['normal', 'skill', 'sprint', 'burst'].index(kinds[i][0]) if not kinds[i][0].startswith('passive') else 9 + i)
    talents_js = []
    tabs, panels = [], []
    target = {x['k']: x for x in (build['build']['talents'] if build else [])}
    for pos, i in enumerate(order):
        t, (k, kind, short) = tal[i], kinds[i]
        has_table = len(t.get('promote') or {}) >= 10
        top = (13 if t['name'] in boosted else 10) if has_table else 0
        rows = scaling(t, top) if has_table else []
        lv = 10 if has_table else 0
        talents_js.append({'rows': [r[1] for r in rows], 'top': top})
        chips = []
        if t.get('cooldown'):
            chips.append(f'<span><small>Cooldown</small>{e(str(t["cooldown"]))}s</span>')
        if t.get('cost'):
            chips.append(f'<span><small>Energy</small>{e(str(t["cost"]))}</span>')
        if t['name'] in boosted:
            chips.append(f'<span class="is-con"><small>C{boosted[t["name"]]}</small>+3 levels</span>')
        if k in target:
            chips.append(f'<span class="is-goal"><small>Level to</small>{target[k]["lv"]}</span>')
        tech = ''
        adv = [a for a in (t.get('advancedProps') or []) if a.get('name')]
        if adv:
            def icd(a):
                """yatta nests the ICD as {..: {'text': 'Alternate Sprint'}, ..}: keep only the words."""
                words = []
                def walk(v):
                    if isinstance(v, dict):
                        words.extend([v['text']] if v.get('text') else [])
                        [walk(x) for k, x in v.items() if k != 'text']
                    elif isinstance(v, list):
                        [walk(x) for x in v]
                    elif v not in (None, ''):
                        words.append(str(v))
                walk(a.get('internalCooldown'))
                return e(' · '.join(words)) or 'None'
            tech = ('<details class="cp-tech"><summary>Technical details</summary><table><thead><tr><th scope="col">Hit</th><th scope="col">Element gauge</th><th scope="col">Internal cooldown</th><th scope="col">Poise damage</th></tr></thead><tbody>'
                    + ''.join(f'<tr><th scope="row">{e(a["name"])}</th><td>{e(str(a.get("elementalGaugeTheory") or "None"))}</td><td>{icd(a)}</td><td>{e(str(a.get("interruptionResistance") or "None"))}</td></tr>' for a in adv)
                    + '</tbody></table></details>')
        table = ''
        if rows:
            mark = f'<span class="is-con">13 · C{boosted[t["name"]]}</span>' if top == 13 else ''
            table = (f'<div class="cp-scale"><div class="cp-scale-head"><label class="gi-label" for="cpLv{pos}">Talent level</label><output id="cpLvOut{pos}">Lv {lv}</output></div>'
                     f'<input class="cp-range" type="range" id="cpLv{pos}" min="1" max="{top}" value="{lv}" data-t="{pos}" style="--p:{(lv - 1) / (top - 1) * 100:.1f}%">'
                     f'<div class="cp-range-marks" aria-hidden="true"><span>1</span><span>10</span>{mark}</div>'
                     f'<table class="cp-scale-t" data-t="{pos}"><tbody>' + ''.join(f'<tr><th scope="row">{e(lab)}</th><td>{e(v[lv - 1])}</td></tr>' for lab, v in rows) + '</tbody></table></div>')
        img = gf.icon(t['icon'])
        chips_html = f'<div class="cp-chips">{"".join(chips)}</div>' if chips else ''
        why = f'<p class="cp-why"><b>Why level {target[k]["lv"]}:</b> {e(target[k]["why"])}</p>' if k in target else ''
        tabs.append(f'<button type="button" class="cp-ttab{" active" if pos == 0 else ""}" data-t="{pos}" aria-pressed="{str(pos == 0).lower()}"><span class="cp-tico"><img src="{e(img)}" alt="" loading="lazy" decoding="async"></span><span class="cp-ttab-k">{e(short)}</span><span class="gi-vh">{e(kind)}: {e(t["name"])}</span></button>')
        panels.append(f'<article class="cp-tpanel{" is-on" if pos == 0 else ""}{" has-table" if table else ""}" data-t="{pos}"{"" if pos == 0 else ' aria-hidden="true"'}>'
                      f'<div class="cp-tbody"><header class="cp-thead"><span class="cp-tico cp-tico--lg"><img src="{e(img)}" alt="" loading="lazy" decoding="async"></span>'
                      f'<div><p class="cp-kind">{e(kind)}</p><h3>{e(t["name"])}</h3></div></header>'
                      f'{chips_html}<div class="cp-text">{rich(t["description"])}</div>{why}{tech}</div>{table}</article>')

    # ---- stats at every step the game lists
    curve = ctx['curve']
    promote = {p['promoteLevel']: p for p in d['upgrade']['promote']}
    base = {p['propType']: p for p in d['upgrade']['prop']}
    special = d.get('specialProp') or ''
    spname = STAT.get(special, '')
    sp_pct = special != 'FIGHT_PROP_ELEMENT_MASTERY'

    def at(prop, lv, asc):
        b = base[prop]
        return b['initValue'] * curve[str(lv)]['curveInfos'][b['type']] + (promote.get(asc, {}).get('addProps') or {}).get(prop, 0)
    spv = lambda v: (f'{v * 100:.1f}%' if sp_pct else f'{round(v)}')
    stats_at = lambda lv, asc: [lv, asc, round(at('FIGHT_PROP_BASE_HP', lv, asc)), round(at('FIGHT_PROP_BASE_ATTACK', lv, asc)),
                                round(at('FIGHT_PROP_BASE_DEFENSE', lv, asc)), (promote.get(asc, {}).get('addProps') or {}).get(special, 0)]

    # ---- materials: ascension phases, talent levels, and where each one drops
    asc = [[promote[p].get('coinCost') or 0, {k: n for k, n in (promote[p].get('costItems') or {}).items()}] for p in range(1, 7)]
    tl = [[x['promote'][str(lv)].get('coinCost') or 0, x['promote'][str(lv)].get('costItems') or {}] for x in [t0[0]] for lv in range(2, 11)]

    def total(rows, times=1):
        out, coin = {}, 0
        for c_, cost in rows:
            coin += c_ * times
            for k, n in cost.items():
                out[k] = out.get(k, 0) + n * times
        return out, coin
    asc_t, asc_m = total(asc)
    tal_t, tal_m = total(tl, 3)
    ids = sorted(set(asc_t) | set(tal_t), key=int)

    def mats(t):
        return ''.join(tile(items[k], t[k]) for k in sorted(t, key=lambda k: (kind_of(k)[0], int(k))) if k in items)

    def kind_of(k):
        k = int(k)
        if 104300 <= k < 104400 and k != 104319:
            return 0, 'Talent book'
        if 1041 * 100 <= k < 1042 * 100:
            return 1, 'Gem'
        if k == 104319:
            return 5, 'Crown'
        if 113000 <= k < 114000:
            return 2, 'Boss'
        if 101000 <= k < 102000:
            return 3, 'Specialty'
        return 4, 'Common'
    enemies = ctx['enemies']['enemies']
    drops = lambda k, cls: [x for x in enemies if k in (x.get('drops') or []) and x['cls'] in cls]
    # ---- farm strip: one slim row of what she needs and where it drops (links to our pages)
    def chip(href, icon, rank, label, name_, note, extra=''):
        return (f'<li{extra}><a class="cp-fi" href="{href}"><span class="gi-tile r{rank}"><img src="{e(icon)}" alt="" loading="lazy" decoding="async"></span>'
                f'<span class="cp-fi-t"><small>{label}</small><b>{e(name_)}</b><em>{note}</em></span></a></li>')
    farm = []
    book = next(((day, b) for day, v in ctx['feed']['farm'].items() for b in v['books'] if name in [u['name'] for u in b['users']]), None)
    if book:
        day, b = book
        days = ','.join(map(str, BOOK_DAYS[day]))
        farm.append(chip('/genshin-impact/farm', b['tiers'][-1][1], 4, 'Talent books', b['series'], '<span data-book></span>', f' class="is-book" data-open="{days}"'))
    for k in ids:
        if kind_of(k)[1] != 'Boss' or k not in items:
            continue
        foes = drops(k, ('weekly', 'boss'))
        if foes:
            weekly = foes[0]['cls'] == 'weekly'
            farm.append(chip(f'/genshin-impact/enemies?e={e(foes[0]["slug"])}', items[k][2], items[k][1], 'Weekly boss' if weekly else 'World boss', items[k][0], e(foes[0]['name'])))
    gem = next((k for k in ids if kind_of(k)[1] == 'Gem'), None)
    if gem:
        top = str(int(gem) // 10 * 10 + 4)
        series_name = items[gem][0].rsplit(' ', 1)[0]
        farm.append(chip(f'/genshin-impact/enemies?q={e(series_name)}', items.get(top, items[gem])[2], 5, 'Gems', series_name, f'{len(drops(top, ("boss",)))} world bosses'))
    spec = next((k for k in ids if kind_of(k)[1] == 'Specialty'), None)
    if spec:
        nat = next((n for n in ctx['nations'] for s in n.get('specialties', []) if s['name'] == items[spec][0]), None)
        farm.append(chip('/genshin-impact/nations' + ('?n=' + nat['key'] if nat else ''), items[spec][2], 1, 'Specialty', items[spec][0], e(nat['name']) if nat else 'Open world'))
    common = next((k for k in ids if kind_of(k)[1] == 'Common'), None)
    if common:
        foes = drops(common, ('common', 'elite'))
        tiers = ctx['enemies']['materials'].get(common, {}).get('series') or [common]
        topc = tiers[-1] if tiers[-1] in items else common
        who = ', '.join(sorted({f['name'].split(':')[0] for f in foes}))  # Nobushi: Jintouban -> Nobushi
        farm.append(chip(f'/genshin-impact/enemies?q={e(items[common][0])}', items[topc][2], items[topc][1], 'Common drop', items[topc][0], e(who)))

    # ---- release, birthday
    hist = ctx['history']['banners']
    first = next((h for h in hist if name in h['five'] + h['four']), None)
    version = first['version'] if first else ''
    released = datetime.datetime.fromtimestamp(c['release'], UTC8)
    rel_txt = f'{released:%b} {released.day}, {released.year}'
    bday = f'{datetime.date(2000, *c["birthday"]):%b} {c["birthday"][1]}' if c.get('birthday') else ''
    cv = fetter.get('cv') or {}

    # ---- PROFILE HEADER (Adrian: "like facebook"): her namecard as the cover, with the two things people come for on it --
    # days since her last banner (top right, filled by the script) and her best in slot (bottom right) -- and her face in a
    # circle over the cover's foot, her name beside it. Then the quiet attribute rows (the right column on desktop).
    attrs = []
    if build:
        attrs.append(('Role', e(build['role'])))
    attrs.append(('Released', (f'v{e(version)} · ' if version else '') + rel_txt))
    if bday:
        attrs.append(('Birthday', f'{bday} <small id="cpBday" data-m="{c["birthday"][0]}" data-d="{c["birthday"][1]}"></small>'))
    attrs += [('Constellation', e(fetter.get('constellation', ''))), ('Affiliation', e(fetter.get('native', '')))]
    va = '<br>'.join(f'{e(v)} <small>{k}</small>' for k, v in (('EN', cv.get('EN')), ('JP', cv.get('JP'))) if v)
    if va:
        attrs.append(('Voice', va))
    rows = ''.join(f'<div><dt>{k}</dt><dd>{v}</dd></div>' for k, v in attrs)
    person = ctx['birthdays'].get('people', {}).get(str(c['id']), {})
    bis = ''
    if build:
        w0 = next(w for w in ctx['weapons']['weapons'] if w['name'] == build['build']['weapons'][0]['name'])
        s0 = next(a for a in ctx['artifacts'] if a['name'] == build['build']['sets'][0]['name'])
        bis = (f'<a class="cp-cv-bis" href="#build"><span class="gi-tile r{w0["rarity"]}"><img src="{e(w0["icon"])}" alt="" loading="lazy" decoding="async"></span>'
               f'<span class="gi-tile r5"><img src="{e(s0["pieces"][0]["art"])}" alt="" loading="lazy" decoding="async"></span>'
               f'<span><small>Best in slot</small><b>{e(w0["name"])}</b><b>{e(s0["name"])} {build["build"]["sets"][0]["pc"]}pc</b></span></a>')
    nc = f'<img class="cp-cv-nc" src="{e(person["namecard"])}" alt="" width="840" height="400" fetchpriority="high">' if person.get('namecard') else ''
    head = (f'<header class="cp-head"><div class="cp-cv">{nc}'
            f'<img class="cp-cv-el" src="/images/genshin/element/{el.lower()}.webp" alt="{e(el)}" width="34" height="34">'
            f'{bis}<span class="cp-cv-av r{c["rarity"]}"><img src="{e(c["icon"])}" alt="" width="136" height="136"></span></div>'
            f'<div class="cp-me"><h1 class="cp-name"><span class="gi-vh">Genshin Impact </span>{e(name)}</h1>'
            f'<p class="cp-sub">{e(fetter.get("title", ""))} <span aria-label="{c["rarity"]} stars">{"★" * c["rarity"]}</span></p>'
            f'<p class="cp-tags"><span><img src="/images/genshin/element/{el.lower()}.webp" alt="" width="16" height="16">{e(el)}</span><span>{e(c["weapon"])}</span><span>{e(c["region"] or "No nation")}</span></p></div></header>')
    details = next((st for _, st in sorted((fet.get('story') or {}).items(), key=lambda kv: int(kv[0]))), None)
    paras = [x for x in (gf.game_text(t) for t in re.split(r'\\n|\n', (details or {}).get('text', ''))) if x]
    story = ''
    if paras or fetter.get('detail'):
        more = ''.join(f'<p>{e(x)}</p>' for x in paras[1:])
        story = (f'<div class="cp-story"><p class="cp-sh">Her story</p>'
                 + (f'<blockquote>{e(gf.game_text(fetter["detail"]))}</blockquote>' if fetter.get('detail') else '')
                 + (f'<p>{e(paras[0])}</p>' if paras else '')
                 + (f'<details><summary>Read more</summary>{more}</details>' if more else '') + '</div>')
    card = (f'<aside class="cp-card" aria-label="Profile">{story}<dl class="cp-attrs">{rows}</dl>'
            + (f'<p class="cp-about">{e(build["summary"])}</p>' if build else '')
            + '</aside>')

    # ---- BUILD, genshin.gg's layout: five weapons beside five artifact rows, then one line each for the rest
    build_html = teams_html = video_html = ''
    if build:
        b = build['build']
        W = {w['name']: w for w in ctx['weapons']['weapons']}
        A = {a['name']: a for a in ctx['artifacts']}
        wrows = []
        for i, w in enumerate(b['weapons']):
            x = W[w['name']]
            pct = '%' if x['sub'] not in ('Elemental Mastery', '') else ''
            tag = f'<em class="cp-tag cp-tag--{TAG_CLASS.get(w["tag"], "alt")}">{e(w["tag"])}</em>'
            wrows.append(f'<li><a class="cp-gl" href="/genshin-impact/weapons?w={slug(x["name"])}" title="{e(w["note"])}"><span class="cp-n">{i + 1}</span>'
                         f'<span class="gi-tile r{x["rarity"]}"><img src="{e(x["icon"])}" alt="" loading="lazy" decoding="async"></span>'
                         f'<span class="cp-gl-t"><b>{e(x["name"])}</b><small>{e(x["sub"])} {x["stats"][-1][3]:.1f}{pct} · {e(w["from"])} · R{w["r"]}</small></span>{tag}</a></li>')

        srows = []
        for i, s in enumerate(b['sets']):
            a, pair = A[s['name']], A.get(s.get('with', ''))
            when = f'<small>{e(s["when"])}</small>' if s.get('when') else ''
            if pair:
                body = (f'<span class="cp-pc"><span class="gi-tile r5"><img src="{e(a["pieces"][0]["art"])}" alt="" loading="lazy" decoding="async"><b>2</b></span><span class="cp-gl-t"><b>{e(a["name"])}</b></span></span>'
                        f'<span class="cp-pc"><span class="gi-tile r5"><img src="{e(pair["pieces"][0]["art"])}" alt="" loading="lazy" decoding="async"><b>2</b></span><span class="cp-gl-t"><b>{e(pair["name"])}</b></span></span>')
            else:
                body = f'<span class="cp-pc"><span class="gi-tile r5"><img src="{e(a["pieces"][0]["art"])}" alt="" loading="lazy" decoding="async"><b>{s["pc"]}</b></span><span class="cp-gl-t"><b>{e(a["name"])}</b>{when}</span></span>'
            tag = '<em class="cp-tag cp-tag--bis">Best</em>' if s.get('best') else ''
            srows.append(f'<li><a class="cp-gl{" is-two" if pair else ""}" href="/genshin-impact/artifacts?s={e(a["slug"])}" title="{e(s["note"])}"><span class="cp-n">{i + 1}</span>{body}{tag}</a></li>')
        mains = ''.join(f'<li><span>{slot}</span><b>{e(st)}</b></li>' for slot, st in b['mains'].items())
        nice = {'normal': 'Normal Attack', 'skill': 'Skill', 'burst': 'Burst', 'sprint': 'Sprint'}
        chain = lambda xs: '<i>›</i>'.join(xs)
        lines = [('Substats', chain(e(x) for x in b['subs'])),
                 ('Talents', chain(f'{nice[x["k"]]} <b>{x["lv"]}</b>' for x in b['talents'])),
                 ('Targets', ' · '.join(f'{e(x["stat"])} <b>{x["min"]}–{x["max"]}{x["unit"]}{"+" if x["stat"] == "CRIT DMG" else ""}</b>' for x in b['targets']))]
        ck = datetime.date.fromisoformat(build['checked'])
        build_html = (
            f'<section class="cp-block cp-build" id="build"><header class="cp-bh"><h2 class="cp-h">Best build</h2>'
            f'<span class="cp-bh-r"><b>{e(b["name"])}</b><small>Checked {ck:%b} {ck.day}, {ck.year}</small></span></header>'
            f'<div class="cp-two"><div><h3 class="cp-sh">Best weapons</h3><ol class="cp-gls">{"".join(wrows)}</ol></div>'
            f'<div><h3 class="cp-sh">Best artifacts</h3><ol class="cp-gls">{"".join(srows)}</ol></div></div>'
            f'<ul class="cp-mains">{mains}</ul>'
            + ''.join(f'<p class="cp-line"><span>{k}</span><span>{v}</span></p>' for k, v in lines)
            + '</section>')
        teams = []
        for tm in b['teams']:
            mem = ''.join(face(roster[n], role, link=n != name) if n in roster else '' for n, role in tm['members'])
            f2p = tm['tier'] == 'F2P'
            teams.append(f'<li class="cp-team"><header><b>{e(tm["name"])}</b><em class="cp-tag cp-tag--{"f2p" if f2p else "alt"}">{e(tm["tier"])}</em></header>'
                         f'<div class="cp-team-faces">{mem}</div><p>{e(tm["note"])}</p></li>')
        teams_html = f'<section class="cp-block" id="teams"><header class="cp-bh"><h2 class="cp-h">Best teams</h2></header><ol class="cp-teams">{"".join(teams)}</ol></section>'
        v = build.get('video')
        if v:
            vd = datetime.date.fromisoformat(v['date'])
            video_html = (f'<section class="cp-block cp-video" id="video"><header class="cp-bh"><h2 class="cp-h">Video guide</h2>'
                          f'<span class="cp-bh-r">by <a href="{e(v["channel"])}" target="_blank" rel="noopener">{e(v["by"])}</a><small>{vd:%b} {vd.day}, {vd.year}</small></span></header>'
                          f'<div class="cp-yt" data-yt="{e(v["id"])}"><button type="button" aria-label="Play {e(v["title"])}">'
                          f'<img src="https://i.ytimg.com/vi/{e(v["id"])}/maxresdefault.jpg" alt="" width="1280" height="720" loading="lazy" decoding="async">'
                          f'<span class="cp-yt-play" aria-hidden="true"></span><span class="cp-yt-t">{e(v["title"])}</span></button></div>'
                          + (f'<p class="cp-quiet">{e(v["note"])}</p>' if v.get('note') else '') + '</section>')

    # ---- SIMILAR: hand-picked in the builds file ([name, why]), wish-card art like the Characters list
    similar_html = ''
    if build and build.get('similar'):
        cards = ''
        for n, why in build['similar']:
            x = roster[n]
            art = f'<img class="cp-sim-art" src="{e(x["strip"])}" alt="" width="320" height="512" loading="lazy" decoding="async">' if x.get('strip') else ''
            cards += (f'<li><a class="cp-sim r{x["rarity"]}" href="{page_href(n)}">{art}'
                      f'<img class="cp-sim-el" src="/images/genshin/element/{x["element"].lower()}.webp" alt="{e(x["element"])}" width="22" height="22">'
                      f'<span class="cp-sim-foot"><b>{e(n)}</b><span aria-label="{x["rarity"]} stars">{"★" * x["rarity"]}</span><small>{e(why)}</small></span></a></li>')
        similar_html = (f'<section class="cp-block" id="similar"><header class="cp-bh"><h2 class="cp-h">Similar to {e(name.split()[-1])}</h2></header>'
                        f'<ul class="cp-sims">{cards}</ul></section>')

    # ---- the rest, as plain blocks: Talents / Constellations / Materials / Base stats / Wish history (phones tab the first two)
    cons_items = []
    for i, x in enumerate(cons):
        boost = next((tn for tn, n in boosted.items() if n == i + 1), None)
        cons_items.append(f'<li><img src="{e(gf.icon(x["icon"]))}" alt="" loading="lazy" decoding="async"><div><p class="cp-kind">C{i + 1}{f" · +3 {e(boost)}" if boost else ""}</p>'
                          f'<h4>{e(x["name"])}</h4><div class="cp-text">{rich(x["description"])}</div></div></li>')
    cons_head = f'<p class="cp-pane-note"><b>{e(fetter.get("constellation", ""))}</b>'
    if build:
        cons_head += f' · {e(build["cons"])} priority. {e(build["consNote"])}'
    cons_head += '</p>'
    mora_ico = f'<img src="{gf.icon("UI_ItemIcon_202")}" alt="" loading="lazy">'

    def mora(coin):
        return f'<span class="cp-mora">{mora_ico}<b>{num(coin)}</b></span>'

    # A total, and behind its key the same total step by step (steps = [(label, coin, items)]) with the sums at the foot.
    def mat_row(key, label, t, coin, steps, foot):
        rows = ''.join(f'<li><span>{lab}</span><ul class="cp-mats">{mats(cost)}</ul>{mora(c_)}</li>' for lab, c_, cost in steps)
        rows += ''.join(f'<li class="is-total"><span>{lab}</span><ul class="cp-mats">{mats(tt)}</ul>{mora(c_)}</li>' for lab, tt, c_ in foot)
        return (f'<div class="cp-matrow"><p class="cp-sh">{label}</p><ul class="cp-mats">{mats(t)}</ul>{mora(coin)}'
                f'<button type="button" class="gi-key cp-brk-key" aria-expanded="false" aria-controls="cpBrk-{key}" title="Breakdown per level">'
                '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg><span class="gi-vh">Breakdown per level</span></button>'
                f'<ol class="cp-brk" id="cpBrk-{key}" hidden>{rows}</ol></div>')
    caps = [20, 40, 50, 60, 70, 80, 90]
    asc_steps = [(f'Lv {caps[i]} → {caps[i + 1]}', c_, cost) for i, (c_, cost) in enumerate(asc)]
    tal_steps = [(f'Lv {i + 1} → {i + 2}', c_, cost) for i, (c_, cost) in enumerate(tl)]
    one_t, one_m = total(tl)

    def step(k, w, lab):
        return (f'<div class="cp-step" data-k="{k}"><button type="button" data-d="-1" data-w="{w}" aria-label="Lower {lab}">−</button><output data-w="{w}"></output>'
                f'<button type="button" data-d="1" data-w="{w}" aria-label="Raise {lab}">+</button></div>')
    goal = (f'<div class="cp-goal" id="cpGoal"><div class="cp-goal-in"><p class="cp-sh">Plan your goal</p>'
            + ''.join(f'<div class="cp-goal-row"><span>{lab}</span>{step(k, "from", "current " + lab)}<i>→</i>{step(k, "to", "goal " + lab)}</div>'
                      for k, lab in (('lv', 'Level'), ('t0', 'Normal Attack'), ('t1', 'Skill'), ('t2', 'Burst')))
            + f'</div><div class="cp-goal-out"><p class="cp-sh">You need <span class="cp-mora">{mora_ico}<b id="cpGoalMora">0</b></span></p>'
            f'<ul class="cp-mats" id="cpGoalMats"></ul><p class="cp-quiet">EXP books not counted yet.</p></div></div>')
    # Base stats: one small table, columns = level caps (95 / 100 when the curve has them).
    show = [(1, 0), (20, 0), (40, 1), (50, 2), (60, 3), (70, 4), (80, 5), (90, 6)] + [(lv, 6) for lv in (95, 100) if str(lv) in curve]
    cols = [stats_at(lv, a) for lv, a in show]
    head_cells = ''.join(f'<th scope="col">{lv}</th>' for lv, _ in show)
    body_rows = ''
    for lab, fn in (('HP', lambda s: num(s[2])), ('ATK', lambda s: num(s[3])), ('DEF', lambda s: num(s[4])), (e(spname), lambda s: spv(s[5]) if s[5] else '—')):
        body_rows += f'<tr><th scope="row">{lab}</th>' + ''.join(f'<td>{fn(col)}</td>' for col in cols) + '</tr>'
    stat_tbl = f'<div class="cp-stbl"><table><thead><tr><th scope="col">Lv</th>{head_cells}</tr></thead><tbody>{body_rows}</tbody></table></div>'
    panes = [
        ('talents', 'Talents', f'<div class="cp-ttabs" role="group" aria-label="Talents">{"".join(tabs)}</div><div class="cp-tpanels">{"".join(panels)}</div>'),
        ('cons', 'Constellations', cons_head + f'<ol class="cp-cons">{"".join(cons_items)}</ol>'),
        ('mats', 'Materials', mat_row('asc', 'Ascension to 90', asc_t, asc_m, asc_steps, [('Total', asc_t, asc_m)])
         + mat_row('tal', 'All three talents to 10', tal_t, tal_m, tal_steps, [('One talent', one_t, one_m), ('All three', tal_t, tal_m)]) + goal),
        ('stats', 'Base stats', stat_tbl + f'<p class="cp-quiet">Before weapons and artifacts. {e(spname)} is her ascension stat.</p>'),
        ('wishes', 'Wish history', f'<div id="cpWishes"><p class="gi-empty">Loading her banners&hellip;</p></div>'),
    ]
    # Each one its own block, all shown (Adrian: no tabs), same size as the old tab card's panes.
    mtabs = ('<div class="gi-tray cp-mtabs" id="cpMTabs" role="tablist" aria-label="Talents and constellations">'
             '<button type="button" class="gi-tab active" role="tab" data-m="talents" aria-selected="true">Talents</button>'
             '<button type="button" class="gi-tab" role="tab" data-m="cons" aria-selected="false">Constellations</button></div>')
    more_html = mtabs + ''.join(f'<section class="cp-block cp-pane" id="{k}"><header class="cp-bh"><h2 class="cp-h">{v}</h2></header>{body}</section>' for k, v, body in panes)
    servers = ''.join(f'<button type="button" class="gi-tab" data-server="{k}">{v}</button>' for k, v in (('asia', 'Asia'), ('america', 'NA'), ('europe', 'EU')))
    farm_html = (f'<section class="cp-block cp-farm" id="farm"><header class="cp-bh"><h2 class="cp-h">Farm for {e(name.split()[-1])}</h2><span class="cp-bh-r" id="cpToday"></span>'
                 f'<div class="gi-tray gi-tray--sm" id="cpSrv" role="tablist" aria-label="Server">{servers}</div></header>'
                 f'<ul class="cp-farms">{"".join(farm)}</ul></section>')

    data = {'id': c['id'], 'name': name, 'slug': me, 'el': el, 'talents': talents_js, 'goal': {x['k']: x['lv'] for x in (build['build']['talents'] if build else [])},
            'calc': {'asc': asc, 'tal': tl, 'items': {k: items[k] for k in ids if k in items}, 'caps': CAPS}}
    blob = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    main = (f'<main class="gi cp" style="--gi-el:rgb({rgb});--el:{rgb}">\n<div class="gi-frame cp-page">\n{head}\n{card}\n<div class="cp-col" id="cpCol" data-m="talents">\n'
            + farm_html + teams_html + build_html + video_html + more_html + similar_html
            + '\n<p class="gi-credit">Game assets &copy; HoYoverse. Parchrome is a fan site and isn\'t affiliated with HoYoverse. Kit, stats and materials: Project Amber (gi.yatta.moe); video: Zy0x on YouTube; '
            'wish history: paimon.moe (MIT).</p>\n</div>\n'
            f'<script type="application/json" id="cpData">{blob}</script>\n</div>\n</main>')

    title = f'{name} build, best weapons, artifacts &amp; teams | Parchrome' if build else f'{name}: talents, materials &amp; constellations | Parchrome'
    desc = (f'{name} ({c["rarity"]}★ {el} {c["weapon"].lower()}, {c["region"] or "no nation"}): '
            + ('best weapons, artifacts, stats and teams, plus ' if build else '') + 'talents, constellations, materials and wish history.')
    url = f'{SITE}/genshin-impact/characters/{me}'
    crumbs = json.dumps({'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': SITE + p} for i, (n, p) in enumerate(
            [('Genshin Impact', '/genshin-impact/'), ('Database', '/genshin-impact/database'), ('Characters', '/genshin-impact/characters'), (name, f'/genshin-impact/characters/{me}')])]})
    head = (f'<title>{title}</title>\n<meta name="description" content="{e(desc)}">\n<link rel="canonical" href="{url}">\n'
            f'<meta property="og:type" content="article">\n<meta property="og:title" content="{title}">\n<meta property="og:description" content="{e(desc)}">\n'
            f'<meta property="og:image" content="{SITE}{e(person.get("namecard") or c.get("strip") or "")}">\n<script type="application/ld+json">{crumbs}</script>')
    return head, main


def main():
    shell = SHELL.read_text(encoding='utf-8')
    ctx = {
        'feed': load('genshin-feed.json'), 'weapons': load('genshin-weapons.json'), 'artifacts': load('genshin-artifacts.json')['sets'],
        'enemies': load('genshin-enemies.json'), 'nations': load('genshin-nations.json')['nations'], 'birthdays': load('genshin-birthdays.json'),
        'history': load('genshin-history.json'), 'builds': json.loads(BUILDS.read_text(encoding='utf-8')), 'curve': gf.get('https://gi.yatta.moe/api/v2/static/avatarCurve')['data'],
    }
    want = set(sys.argv[1:])
    chars = [c for c in ctx['feed']['characters'] if c.get('element') and (not want or slug(c['name']) in want)]  # the Traveler (no element) gets its own page later
    if want - {slug(c['name']) for c in chars}:
        sys.exit('unknown slug(s): ' + ', '.join(sorted(want - {slug(c['name']) for c in chars})))
    for c in chars:
        d = gf.yatta('avatar/%s' % c['id'])
        fet = gf.yatta('avatarFetter/%s' % c['id'])
        head, body = build_page(c, d, fet, ctx)
        page = re.sub(r'<title>.*?</title>\s*<meta name="description"[^>]*>', lambda m: head, shell, count=1, flags=re.S)
        page = re.sub(r'/genshin-characters\.(css|js)\?v=[\w.]+', lambda m: f'/genshin-character.{m.group(1)}?v={ASSET_V}', page)
        page = re.sub(r'<main class="gi">.*?</main>', lambda m: body, page, count=1, flags=re.S)
        assert '/genshin-character.css' in page and 'id="cpData"' in page and '<link rel="canonical"' in page, 'the list page shell changed: update main()'
        out = OUT / (slug(c['name']) + '.html')
        out.write_text(page, encoding='utf-8', newline='\n')
        print('Wrote', out.relative_to(ROOT.parent))


if __name__ == '__main__':
    main()
