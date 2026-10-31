# Builds the Genshin Impact lobby's live data (/genshin-impact/):
#   site/genshin-feed.json              -- wishes, events, endgame, codes, farm schedule, birthdays
#   site/images/genshin/splash/*.webp   -- the official wish art of each featured 5-star
#   site/images/genshin/strip/*.webp    -- every character's wish-result card, for /genshin-impact/characters
#   site/genshin-enka-map.json          -- Enka ids -> names/icons for the player lookup
#
# Run every 3 hours by .github/workflows/genshin-feed.yml. No keys: both sources are public.
#   ennead  -- api.ennead.cc/mihoyo/genshin: calendar (banners, events, challenges) + codes
#   yatta   -- gi.yatta.moe (Project Amber): characters, daily domains, materials, wish art
#
# Each source is fetched on its own: if one fails, the old value for it is kept, so
# one broken site never blanks a section. The file is only rewritten when the data
# changed (no timestamp churn), so the workflow only commits real updates.
#
# Local test:  python scripts/genshin-feed.py   (needs Pillow: pip install pillow)

import ast
import datetime
import html
import io
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'site'
OUT = ROOT / 'genshin-feed.json'
HISTORY = ROOT / 'genshin-history.json'  # every past wish, for /genshin-impact/reruns
ENKA_MAP = ROOT / 'genshin-enka-map.json'  # Enka ids -> names/icons, for /genshin-impact/player
SPLASH = ROOT / 'images' / 'genshin' / 'splash'
STRIP = ROOT / 'images' / 'genshin' / 'strip'
WEAPONS_OUT = ROOT / 'genshin-weapons.json'  # every weapon, for /genshin-impact/weapons
WEAPON_ART = ROOT / 'images' / 'genshin' / 'weapon'
ARTIFACTS_OUT = ROOT / 'genshin-artifacts.json'  # every artifact set, for /genshin-impact/artifacts
ARTIFACT_ART = ROOT / 'images' / 'genshin' / 'artifact'
# Where the card starts, as a share of the wish card's height: 0 = its top edge. Faces sit ~30% down, so
# 0.12 skips the empty sky over the heads (Adrian). Change it -> delete strip/*.webp (not Traveler) and rerun.
STRIP_TOP = 0.12
UA = 'ParchromeBot/1.0 (https://parchrome.netlify.app; wildparchrome@gmail.com)'
ENNEAD = 'https://api.ennead.cc/mihoyo/genshin/'
YATTA = 'https://gi.yatta.moe/api/v2/en/'
ASSET = 'https://gi.yatta.moe/assets/UI/'
# paimon.moe's banner list (MIT, (c) 2021 Made Baruna): every wish since 1.0, kept up to date by them.
UTC8 = datetime.timezone(datetime.timedelta(hours=8))  # paimon's times are Asia server time
PAIMON = 'https://raw.githubusercontent.com/MadeBaruna/paimon-moe/main/src/data/banners.js'

# Yatta's in-game element names -> the names players use.
ELEMENTS = {'Ice': 'Cryo', 'Water': 'Hydro', 'Fire': 'Pyro', 'Wind': 'Anemo', 'Electric': 'Electro', 'Grass': 'Dendro', 'Rock': 'Geo'}
WEAPONS = {'WEAPON_SWORD_ONE_HAND': 'Sword', 'WEAPON_CLAYMORE': 'Claymore', 'WEAPON_POLE': 'Polearm', 'WEAPON_BOW': 'Bow', 'WEAPON_CATALYST': 'Catalyst'}
# Domain "city" numbers, in release order (7 = Moonlight books, 8 = Charity books).
CITIES = {1: 'Mondstadt', 2: 'Liyue', 3: 'Inazuma', 4: 'Sumeru', 5: 'Fontaine', 6: 'Natlan', 7: 'Nod-Krai', 8: 'Snezhnaya'}
DAYS = ['monday', 'tuesday', 'wednesday']
# Yatta's region codes -> nations (sub-groups fold into their nation; travellers, Aloy, Skirk: none).
REGIONS = {'MONDSTADT': 'Mondstadt', 'LIYUE': 'Liyue', 'INAZUMA': 'Inazuma', 'SUMERU': 'Sumeru', 'FONTAINE': 'Fontaine', 'NATLAN': 'Natlan',
           'NODKRAI': 'Nod-Krai', 'NODKRAI_ZIBAI': 'Nod-Krai', 'SNEZHNAYA': 'Snezhnaya', 'SNEZHNAYA_STAR': 'Snezhnaya', 'FATUI': 'Snezhnaya'}  # Thu/Fri/Sat repeat these; Sunday has everything


def get(url, raw=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read()
    return body if raw else json.loads(body)


def yatta(path):
    return get(YATTA + path)['data']


def icon(name):
    return ASSET + name + '.png'


def primos(rewards):
    # "Primogem ×60" -> 60
    return sum(int(m.group(1).replace(',', '')) for m in (re.search(r'Primogem\s*[×x]\s*([\d,]+)', r) for r in rewards) if m)


def splash(icon_name):
    """Official wish art (transparent) -> WebP on our own site, at most 1600x800.
    Characters: UI_Gacha_AvatarImg_* (2048x1024). Weapons: UI_Gacha_EquipIcon_* (512x1024)."""
    weapon = icon_name.startswith('UI_EquipIcon_')
    key = icon_name.replace('UI_AvatarIcon_', '').replace('UI_EquipIcon_', '')
    out = SPLASH / (key + '.webp')
    if not out.exists():
        SPLASH.mkdir(parents=True, exist_ok=True)
        im = Image.open(io.BytesIO(get(ASSET + ('UI_Gacha_EquipIcon_' if weapon else 'UI_Gacha_AvatarImg_') + key + '.png', raw=True)))
        im.thumbnail((1600, 800))
        im.save(out, 'WEBP', quality=82, method=6)
    return '/images/genshin/splash/' + out.name


def strip(icon_name):
    """The wish-result card (UI_Gacha_AvatarIcon_*, 320x1024, painted) -> a 320x512 WebP cut from
    STRIP_TOP down: face + upper body. Only Enka has these.
    A character Enka doesn't have yet gets '' (the page shows the face icon) and is retried next run.
    The Traveler has no wish card: images/genshin/strip/Traveler.webp is drawn once by
    _tools/genshin/traveler-strip.py from the twins' wish art."""
    key = icon_name.replace('UI_AvatarIcon_', '')
    out = STRIP / (key + '.webp')
    if not out.exists():
        try:
            im = Image.open(io.BytesIO(get('https://enka.network/ui/UI_Gacha_AvatarIcon_%s.png' % key, raw=True)))
        except Exception as e:
            print('strip', key, 'failed:', e, file=sys.stderr)
            return ''
        STRIP.mkdir(parents=True, exist_ok=True)
        top = round(im.height * STRIP_TOP)
        im.crop((0, top, im.width, top + im.height // 2)).save(out, 'WEBP', quality=80, method=6)
    return '/images/genshin/strip/' + out.name


TRAVELER_ORDER = ['Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro', 'Cryo']  # the order the story unlocks them (= the nations')


def characters():
    items = yatta('avatar')['items'].values()
    out, traveler = [], []
    for c in items:
        if str(c['id']).startswith(('10000005', '10000007')):  # Traveler: one entry per twin x element
            traveler.append(c)
            continue
        if not c.get('element'):  # Manekin / Manekina: no element, not combat characters (Adrian)
            continue
        out.append({
            'id': c['id'], 'name': c['name'], 'rarity': c['rank'], 'icon': icon(c['icon']),
            'element': ELEMENTS.get(c['element'], c['element']), 'weapon': WEAPONS.get(c['weaponType'], ''),
            'birthday': c.get('birthday') or None, 'release': c.get('release'),
            'region': REGIONS.get(c.get('region'), ''), 'strip': strip(c['icon']),
        })
    if traveler:  # one card for both twins; `elements` = every element they've unlocked so far
        els = {ELEMENTS.get(c['element'], c['element']) for c in traveler}
        out.append({
            'id': 10000007, 'name': 'Traveler', 'rarity': 5, 'icon': icon('UI_AvatarIcon_PlayerGirl'),
            'element': '', 'elements': [e for e in TRAVELER_ORDER if e in els], 'weapon': 'Sword',
            'birthday': None, 'release': min(c.get('release') or 0 for c in traveler), 'region': '',
            'strip': '/images/genshin/strip/Traveler.webp',
        })
    return sorted(out, key=lambda c: c['name'])


def banners(calendar):
    out = []
    # Weapon type + wish art come from yatta's weapon list, matched by name (ennead has neither).
    arms = {}
    if any(b.get('weapons') for b in calendar['banners']):
        arms = {w['name']: w for w in yatta('weapon')['items'].values()}
    for b in calendar['banners']:
        chars = []
        for c in sorted(b.get('characters', []), key=lambda c: -c['rarity']):
            entry = {'id': c['id'], 'name': c['name'], 'rarity': c['rarity'], 'element': c.get('element', ''), 'icon': c['icon']}
            if c['rarity'] == 5:
                d = yatta('avatar/%s' % c['id'])
                entry.update({
                    'title': d['fetter'].get('title', ''), 'affiliation': d['fetter'].get('native', ''),
                    'weapon': WEAPONS.get(d['weaponType'], ''), 'splash': splash(d['icon']),
                    'kit': kit(d),
                })
            chars.append(entry)
        out.append({
            'name': b['name'], 'version': b.get('version', ''), 'start': b['start_time'], 'end': b['end_time'],
            'characters': chars,
            'weapons': [weapon(w, arms.get(w['name'])) for w in sorted(b.get('weapons', []), key=lambda w: -w['rarity'])],
        })
    return out


def weapon(w, y):
    entry = {'name': w['name'], 'rarity': w['rarity'], 'icon': w['icon']}
    if y:
        entry['type'] = WEAPONS.get(y['type'], '')
        if w['rarity'] == 5:
            entry['splash'] = splash(y['icon'])
            d = yatta('weapon/%s' % y['id'])
            affix = next(iter(d.get('affix', {}).values()), None)
            entry['sub'] = SUBSTATS.get(d.get('specialProp'), '')
            if affix:
                entry['passive'] = {'name': affix['name'], 'text': kit_text(affix['upgrade'].get('0', ''))}
    return entry


# Wish card "inspect" panel (Oct 23 2026): each featured 5-star's three combat talents and
# six constellations, from yatta's avatar detail. Icons are yatta's small PNGs (hotlinked).
SUBSTATS = {
    'FIGHT_PROP_CRITICAL': 'CRIT Rate', 'FIGHT_PROP_CRITICAL_HURT': 'CRIT DMG', 'FIGHT_PROP_ATTACK_PERCENT': 'ATK',
    'FIGHT_PROP_HP_PERCENT': 'HP', 'FIGHT_PROP_DEFENSE_PERCENT': 'DEF', 'FIGHT_PROP_CHARGE_EFFICIENCY': 'Energy Recharge',
    'FIGHT_PROP_ELEMENT_MASTERY': 'Elemental Mastery', 'FIGHT_PROP_PHYSICAL_ADD_HURT': 'Physical DMG Bonus',
}


def kit_text(s, cap=420):
    """yatta's rich text -> plain text; highlighted words become [[word]] (the page bolds them).
    Cut at a sentence end near `cap` so the feed stays small."""
    s = s.replace('\\n', '\n').lstrip('#')
    s = re.sub(r'\{LAYOUT_PC#([^}]*)\}', r'\1', s)
    s = re.sub(r'\{[^}]*\}', '', s)  # links, other layouts, sprites
    s = re.sub(r'<color=[^>]*>(.*?)</color>', r'[[\1]]', s, flags=re.S)
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\n{2,}', '\n', s).strip()
    if len(s) > cap:
        cut = max(s.rfind('. ', 0, cap), s.rfind('.\n', 0, cap))
        s = (s[:cut + 1] if cut > cap // 3 else s[:cap].rsplit(' ', 1)[0] + '…')
        if s.count('[[') > s.count(']]'):
            s += ']]'
    return s


def kit(d):
    tal = [t for _, t in sorted(d.get('talent', {}).items(), key=lambda kv: int(kv[0]))]
    combat = [t for t in tal if t.get('type') == 0][:2] + [t for t in tal if t.get('type') == 1][:1]
    cons = [c for _, c in sorted(d.get('constellation', {}).items(), key=lambda kv: int(kv[0]))][:6]
    item = lambda t: {'name': t['name'], 'icon': ASSET + t['icon'] + '.png', 'text': kit_text(t['description'])}
    return {'constellation': d['fetter'].get('constellation', ''), 'talents': [item(t) for t in combat], 'cons': [item(c) for c in cons]}


def events(calendar):
    return [{
        'name': e['name'], 'description': e.get('description', ''), 'image': e.get('image_url') or '',
        'type': e.get('type_name', ''), 'start': e.get('start_time'), 'end': e.get('end_time'),
    } for e in calendar['events']]


def challenges(calendar):
    out = []
    for c in calendar.get('challenges', []):
        sr = c.get('special_reward') or {}
        out.append({'name': c['name'], 'type': c.get('type_name', ''), 'start': c['start_time'], 'end': c['end_time'],
                    'primos': sr.get('amount', 0) if sr.get('name') == 'Primogem' else 0})
    return out


def code_dates():
    """Code (upper case) -> (start, end) from the wiki's Promotional Code table ({{Code Row|CODES|server|rewards|start|end}},
    dates YYYY-MM-DD, end 'unknown' = no end announced). Global rows win over China-only ones. Empty if the wiki fails."""
    try:
        t = re.sub(r'<!--.*?-->', '', wikitext('Promotional_Code'), flags=re.S)
    except Exception as e:
        print('code dates: wiki failed:', e)
        return {}
    out = {}
    for row in re.findall(r'\{\{Code Row(.*?)\}\}', t, flags=re.S):
        f = [x.strip() for x in row.split('|')]
        if len(f) < 6 or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', f[4]):
            continue
        end = f[5] if re.fullmatch(r'\d{4}-\d{2}-\d{2}', f[5]) else ''
        for code in f[1].split(';'):
            k = code.strip().upper()
            if k and (k not in out or f[2] == 'G'):
                out[k] = (f[4], end)
    return out


def codes():
    dates = code_dates()
    out = []
    for c in get(ENNEAD + 'codes').get('active', []):
        row = {'code': c['code'], 'rewards': c.get('rewards', []), 'primos': primos(c.get('rewards', []))}
        start, end = dates.get(c['code'].upper(), ('', ''))
        if start:
            row['start'] = start  # the day it went out (the wiki's date)
        if end:
            row['end'] = end  # its announced last day; most codes never get one
        out.append(row)
    return out


def expired():
    # The codes page's expired list: code + Primogems only (262 codes; the Lobby loads this file too).
    return [{'code': c['code'], 'primos': primos(c.get('rewards', []))} for c in get(ENNEAD + 'codes').get('inactive', [])]


def farm():
    """Talent books + weapon materials by weekday (Mon=Thu, Tue=Fri, Wed=Sat), with who uses each book.
    `domain` = the domain's name without its "Domain of Mastery: " part; `tiers` = [name, icon] per
    drop tier, lowest first (3 books, 4 weapon materials) -- the Farm today page shows them all."""
    schedule = yatta('dailyDungeon')
    mats = yatta('material')['items']
    out = {}
    for day in DAYS:
        books, weapons = [], []
        for d in schedule[day].values():
            ids = sorted(i for i in d['reward'] if i > 100000)
            if not ids:
                continue
            top, low = mats[str(max(ids))], mats[str(min(ids))]
            city = CITIES.get(d['city'], '')
            more = {'domain': d['name'].split(': ', 1)[-1], 'tiers': [[mats[str(i)]['name'], icon(mats[str(i)]['icon'])] for i in ids]}
            if 'Mastery' in d['name']:
                users = yatta('material/%s' % min(ids)).get('additions', {}).get('requiredBy', {}).get('avatar', [])
                seen, who = set(), []
                for u in users:
                    if u['name'] != 'Traveler' and u['name'] not in seen:
                        seen.add(u['name'])
                        who.append({'name': u['name'], 'rarity': u['rank'], 'icon': icon(u['icon'])})
                books.append({'city': city, 'series': low['name'].replace('Teachings of ', ''), 'icon': icon(top['icon']), 'users': who, **more})
            else:
                weapons.append({'city': city, 'name': low['name'], 'icon': icon(top['icon']), **more})
        out[day] = {'books': books, 'weapons': weapons}
    return out


# ---- WEAPONS (Oct 23 2026): /genshin-impact/weapons, its own file -------------------------------
# Every weapon from yatta (skins dropped). Weapons only change with a patch, so a weapon's detail
# (passive, stats, ascension costs) is fetched once, when its id first appears; the list itself
# (one request) and the forgery days are checked every run. `python scripts/genshin-feed.py --weapons-full`
# refetches every detail (e.g. after yatta fixes a passive's text).
def passive(affix):
    """R1-R5 passive texts -> one template + the numbers that change. The five texts differ only in
    their highlighted numbers, so `t` keeps [[word]] for highlights that never change and {0}, {1}..
    for the ones that do (`v` = their five values). If the wording itself differs between
    refinements (it happens: "of the" in one), the five texts are kept whole in `r`."""
    texts = [affix['upgrade'][k] for k in sorted(affix['upgrade'], key=int)]
    col = r'<color=[^>]*>(.*?)</color>'
    skel = [re.sub(col, '\x00', s, flags=re.S) for s in texts]
    if len(set(skel)) != 1:
        return {'name': affix['name'], 'r': [kit_text(s, cap=10**6) for s in texts]}
    slots = list(zip(*[re.findall(col, s, flags=re.S) for s in texts]))
    t, v = kit_text(skel[0], cap=10**6), []
    for vals in slots:
        if len(set(vals)) == 1:
            t = t.replace('\x00', '[[%s]]' % vals[0], 1)
        else:
            t = t.replace('\x00', '{%d}' % len(v), 1)
            v.append(list(vals))
    return {'name': affix['name'], 't': t, 'v': v}


def weapon_art(icon_name):
    """The weapon's wish-result art (UI_Gacha_EquipIcon_*, 512x1024, transparent) -> 256x512 WebP."""
    key = icon_name.replace('UI_EquipIcon_', '')
    out = WEAPON_ART / (key + '.webp')
    if not out.exists():
        try:
            im = Image.open(io.BytesIO(get(ASSET + 'UI_Gacha_EquipIcon_' + key + '.png', raw=True)))
        except Exception as e:
            print('weapon art', key, 'failed:', e, file=sys.stderr)
            return ''
        WEAPON_ART.mkdir(parents=True, exist_ok=True)
        im.thumbnail((256, 512))
        im.save(out, 'WEBP', quality=80, method=6)
    return '/images/genshin/weapon/' + out.name


def weapon_detail(w, curve, items):
    d = yatta('weapon/%s' % w['id'])
    for k, it in (d.get('items') or {}).items():
        items[k] = [it['name'], it.get('rank', 1), icon(it['icon'])]
    up = d.get('upgrade') or {}
    props = {p['propType']: p for p in up.get('prop', [])}
    base = props.get('FIGHT_PROP_BASE_ATTACK')
    sub = next((p for k, p in props.items() if k != 'FIGHT_PROP_BASE_ATTACK'), None)
    pct = sub is not None and sub['propType'] != 'FIGHT_PROP_ELEMENT_MASTERY'
    promote = sorted(up.get('promote', []), key=lambda p: p['promoteLevel'])

    def at(level, p):
        c = curve[str(level)]['curveInfos']
        atk = base['initValue'] * c[base['type']] + (p.get('addProps') or {}).get('FIGHT_PROP_BASE_ATTACK', 0) if base else 0
        s = sub['initValue'] * c[sub['type']] * (100 if pct else 1) if sub else 0
        return round(atk), (round(s, 1) if pct else round(s))

    # One row per step the game shows: Lv 1, 20, 20+ (ascended), 40, 40+ ... max.
    stats, lo = [], 1
    for p in promote:
        hi = p['unlockMaxLevel']
        stats.append([lo, 1 if p['promoteLevel'] else 0, *at(lo, p)])
        stats.append([hi, 0, *at(hi, p)])
        lo = hi
    affix = next(iter((d.get('affix') or {}).values()), None)
    return {
        'desc': kit_text(d.get('description') or '', cap=10**6),
        'passive': passive(affix) if affix else None,
        'stats': stats,
        'asc': [[p.get('coinCost', 0), {k: n for k, n in (p.get('costItems') or {}).items()}] for p in promote if p['promoteLevel']],
        'refine': up.get('awakenCost') or [],
    }


def weapons(full=False):
    old = json.loads(WEAPONS_OUT.read_text(encoding='utf-8')) if WEAPONS_OUT.exists() else {}
    known = {w['id']: w for w in old.get('weapons', [])} if not full else {}
    items = dict(old.get('items', {})) if not full else {}
    data = yatta('weapon')
    names = data.get('props', {})
    curve = None
    out = []
    for w in data['items'].values():
        if w.get('isWeaponSkin'):  # Sublimation skins, event costumes: not weapons you own
            continue
        e = known.get(w['id'])
        if e and not e['art']:  # no wish art yet (the page shows the small icon): retry just the picture
            e['art'] = weapon_art(w['icon'])
        if not e:
            if curve is None:
                curve = get(YATTA.replace('/en/', '/') + 'static/weaponCurve')['data']
            e = {
                'id': w['id'], 'name': w['name'], 'rarity': w['rank'], 'type': WEAPONS.get(w['type'], ''),
                'sub': names.get(w.get('specialProp'), '') if w.get('specialProp') != 'NONE' else '',
                'icon': icon(w['icon']), 'art': weapon_art(w['icon']),
                **weapon_detail(w, curve, items),
            }
        out.append(e)
    # Forgery days: which weekday's domain drops this weapon's ascension material (Mon/Thu = 0,
    # Tue/Fri = 1, Wed/Sat = 2; Sunday has them all). Rechecked every run (one request).
    sched = yatta('dailyDungeon')
    forge = {}
    for i, day in enumerate(DAYS):
        for dn in sched[day].values():
            if 'Mastery' not in dn['name']:
                for r in dn['reward']:
                    forge[str(r)] = [i, CITIES.get(dn['city'], ''), dn['name']]
    for e in out:
        ids = {k for _, cost in e['asc'] for k in cost}
        e['forge'] = next((forge[k] for k in sorted(ids) if k in forge), None)
    out.sort(key=lambda e: (list(WEAPONS.values()).index(e['type']) if e['type'] in WEAPONS.values() else 9, -e['rarity'], e['name']))
    used = {k for e in out for _, cost in e['asc'] for k in cost}
    return {'source': 'Project Amber (gi.yatta.moe)', 'items': {k: v for k, v in sorted(items.items()) if k in used}, 'weapons': out}


def slug(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


# ---- ENDGAME (Oct 23 2026): the Genshin Fandom wiki (CC BY-SA, credited on the page) --------
# yatta's `tower` stopped at Mar 2025, so this period's Spiral Abyss floors and the current
# Imaginarium Theater season come from the wiki's wikitext. Dates/countdowns still come from
# the ennead `challenges`; this only adds what's inside each mode.
WIKI = 'https://genshin-impact.fandom.com/api.php?'


def wiki(**q):
    return get(WIKI + urllib.parse.urlencode(dict(q, format='json')))


def wikitext(page):
    return wiki(action='parse', page=page, prop='wikitext')['parse']['wikitext']['*']


def unwiki(s):
    """Wiki markup -> plain text: {{Color|x|Text}} -> Text, [[a|b]] -> b, other templates dropped."""
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    s = re.sub(r'\{\{Color\|[^|{}]*\|([^{}]*)\}\}', r'\1', s)
    s = re.sub(r'\{\{[^{}]*\}\}', '', s)
    s = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', s)
    s = re.sub(r"'{2,}", '', s)
    s = re.sub(r'<br\s*/?>', ' ', s)
    s = re.sub(r'<[^>]+>', '', s)
    return ' '.join(s.split())


def params(block):
    """'|key = value' lines of one template call -> dict."""
    return {m.group(1): m.group(2).strip() for m in re.finditer(r'^\|\s*([\w.]+)\s*=(.*)$', block, re.M)}


def template(text, name):
    i = text.index('{{' + name)
    return text[i:text.index('\n}}', i)]


def foes(s):
    """'A*2; B*?// C' -> waves [[{name, n}]] (n 0 = count not known)."""
    out = []
    for wave in unwiki(s).split('//'):
        group = []
        for part in wave.split(';'):
            name, _, n = part.strip().strip('/').partition('*')
            if name.strip():
                group.append({'name': name.strip(), 'n': int(n) if n.strip().isdigit() else 0})
        if group:
            out.append(group)
    return out


def spawns(note):
    """A chamber's note -> [first half, second half]: 'First Half: Initially spawns A x1 and B x2;
    more spawn as the previous are defeated.' (the wiki sometimes types 'Fist Half'). A note
    without a half label goes on the first half."""
    out = ['', '']
    text = unwiki(note)
    parts = re.split(r'\b(F\w*st|Second) Half:\s*', text)
    if parts[0].strip():
        out[0] = parts[0].strip()
    for label, body in zip(parts[1::2], parts[2::2]):
        out[1 if label == 'Second' else 0] = body.strip()
    return out


def wiki_pages(titles):
    """Many pages' wikitext in one request per 45 titles -> {asked title: text} (redirects followed)."""
    out = {}
    titles = list(titles)
    for i in range(0, len(titles), 45):
        r = wiki(action='query', prop='revisions', rvprop='content', rvslots='main', redirects=1, titles='|'.join(titles[i:i + 45]))['query']
        back = {x['to']: x['from'] for x in r.get('normalized', []) + r.get('redirects', [])}
        for p in r['pages'].values():
            t = p.get('revisions', [{}])[0].get('slots', {}).get('main', {}).get('*')
            if t:
                name = p['title']
                while name in back:
                    name = back[name]
                out[name] = t
    return out


# ---- ARTIFACTS (Oct 24 2026): yatta's `reliquary` for the sets (names, bonuses, the five pieces),
# the Fandom wiki for where each one drops (yatta's `source` only says "Mystic Offering") and the
# version it came out in. Artifact domains are open every day, so there's no schedule to keep.
PIECES = [('EQUIP_BRACER', 'Flower of Life'), ('EQUIP_NECKLACE', 'Plume of Death'), ('EQUIP_SHOES', 'Sands of Eon'),
          ('EQUIP_RING', 'Goblet of Eonothem'), ('EQUIP_DRESS', 'Circlet of Logos')]
ELEMENT_NAMES = ['Pyro', 'Hydro', 'Electro', 'Cryo', 'Anemo', 'Geo', 'Dendro', 'Physical']
# The 2-piece bonus' stat, for the page's filter: first match wins. The wording differs from set to
# set ("ATK +18%.", "Increases Elemental Mastery by 80.", "Gain a 15% Geo DMG Bonus."), so these
# look anywhere in the plain text; RES comes first so "Pyro RES increased" isn't read as Pyro DMG.
BONUS_TAGS = [
    (r'\bRES increased|less time', 'Resistance'),
    (r'Nightsoul', 'Nightsoul'),
    (r'\b(%s) DMG\b' % '|'.join(ELEMENT_NAMES), None),  # the element itself
    (r'Elemental Skill DMG', 'Skill DMG'), (r'Elemental Burst DMG', 'Burst DMG'),
    (r'Normal and Charged Attack DMG|Plunging Attack DMG', 'Attack DMG'),
    (r'Elemental Mastery', 'Elemental Mastery'), (r'Energy Recharge', 'Energy Recharge'),
    (r'CRIT Rate', 'CRIT Rate'), (r'Healing (Bonus|Effectiveness)|incoming healing', 'Healing'),
    (r'Shield Strength', 'Shield'), (r'\bATK\b', 'ATK'), (r'\bHP\b', 'HP'), (r'\bDEF\b', 'DEF'),
]


def bonus_tag(text):
    text = text.replace('[[', '').replace(']]', '')
    for rx, tag in BONUS_TAGS:
        m = re.search(rx, text)
        if m:
            return tag or m.group(1)
    return 'Other'


ROMAN = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10}


def version_key(v):
    """'5.5' -> (5, 5). The wiki names the 6.x updates 'Luna I', 'Luna II'...: they sort after 5.x
    and before 7.0, in their own order. Unknown = (0,)."""
    m = re.match(r'^Luna ([IVX]+)$', v or '')
    if m:
        return (6, ROMAN.get(m.group(1), 0))
    return tuple(int(x) for x in v.split('.')) if re.match(r'^\d+(\.\d+)*$', v or '') else (0,)


def artifact_art(icon_name):
    """A piece's icon (UI_RelicIcon_<set>_<n>, 256x256, transparent) -> WebP on our site."""
    out = ARTIFACT_ART / (icon_name.replace('UI_RelicIcon_', '') + '.webp')
    if not out.exists():
        try:
            im = Image.open(io.BytesIO(get(ASSET + 'reliquary/' + icon_name + '.png', raw=True)))
        except Exception as e:
            print('artifact art', icon_name, 'failed:', e, file=sys.stderr)
            return ''
        ARTIFACT_ART.mkdir(parents=True, exist_ok=True)
        im.thumbnail((256, 256))
        im.save(out, 'WEBP', quality=82, method=6)
    return '/images/genshin/artifact/' + out.name


def artifacts():
    old = json.loads(ARTIFACTS_OUT.read_text(encoding='utf-8')) if ARTIFACTS_OUT.exists() else {}
    known = {s['id']: s for s in old.get('sets', [])}
    sets = []
    for a in yatta('reliquary')['items'].values():
        s = known.get(a['id'])
        if not s or any(not p['art'] for p in s['pieces']):
            d = yatta('reliquary/%s' % a['id'])
            suit = d.get('suit') or {}
            pieces = [{'slot': label, 'name': suit[k]['name'], 'desc': kit_text(suit[k].get('description') or '', cap=10**6),
                       'art': artifact_art(suit[k]['icon'])} for k, label in PIECES if k in suit]
            texts = [kit_text(t, cap=10**6) for _, t in sorted((a.get('affixList') or {}).items())]
            counts = [1] if len(pieces) == 1 else [2, 4]
            s = {'id': a['id'], 'name': a['name'], 'slug': slug(a['name']), 'rarity': a['levelList'],
                 'bonus': [[n, t] for n, t in zip(counts, texts)], 'pieces': pieces}
        s['order'] = a.get('sortOrder', 0)
        sets.append(s)

    # Where each set drops + its version, from the wiki (2 requests for the sets, 1 for the domains).
    pages = wiki_pages(s['name'] for s in sets)
    links = {}
    for s in sets:
        box = params(template(pages[s['name']], 'Artifact Set Infobox')) if s['name'] in pages else {}
        top = max(s['rarity'])
        src = [v for k, v in sorted(box.items()) if k.startswith('source%d.' % top)] or [v for k, v in sorted(box.items()) if k.startswith('source')]
        s['_src'] = src
        for v in src:
            m = re.match(r'^\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$', v.strip())
            if m:
                links[m.group(1)] = None
        ver = re.search(r'\{\{Change History\|([^}|]+)', pages.get(s['name'], ''))
        s['version'] = ver.group(1).strip() if ver else s.get('version', '')
    domains = {}
    for name, text in wiki_pages(links).items():
        if '{{Domain Infobox' in text:
            p = params(template(text, 'Domain Infobox'))
            if 'Blessing' in p.get('type', ''):  # Domains of Blessing = artifact domains
                domains[name] = {'name': name, 'region': unwiki(p.get('region', '')), 'area': unwiki(p.get('area', ''))}
    for s in sets:
        src = s.pop('_src')
        names = [re.match(r'^\[\[([^\]|#]+)', v.strip()) for v in src]
        dom = next((domains[m.group(1)] for m in names if m and m.group(1) in domains), None)
        if src or not s.get('domain'):  # a wiki miss keeps last run's answer
            s['domain'] = dom
            s['from'] = list(dict.fromkeys(unwiki(v) for v, m in zip(src, names) if not (m and m.group(1) in domains) and unwiki(v)))
        s['tag'] = bonus_tag(s['bonus'][0][1]) if s['bonus'] else 'Other'
    # Newest first: by version, then yatta's own order (newer sets sort later in the game).
    sets.sort(key=lambda s: (version_key(s['version']), s['order']), reverse=True)
    latest = version_key(sets[0]['version']) if sets else None
    for s in sets:
        s['new'] = latest is not None and latest > (0,) and version_key(s['version']) == latest
    # Each domain drops two sets: name the partner so the page can link them.
    by_dom = {}
    for s in sets:
        if s['domain']:
            by_dom.setdefault(s['domain']['name'], []).append(s['slug'])
    for s in sets:
        s['pair'] = [x for x in by_dom.get(s['domain']['name'], []) if x != s['slug']] if s['domain'] else []
    return {'source': 'Project Amber (gi.yatta.moe) + Genshin Impact Wiki (Fandom, CC BY-SA)', 'sets': sets}


def abyss():
    """The current Abyssal Moon Spire, floors 9-12. The wiki's 'Abyssal Moon Spire' page says
    which period page each floor comes from (a floor that didn't change keeps an older page)."""
    spire = wikitext('Spiral Abyss/Floors/Abyssal Moon Spire')
    pages, floors, info = {}, [], {}
    for page, n in re.findall(r'\{\{Transclude\|([^|}]+)\|Floor (\d+)\}\}', spire):
        if page not in pages:
            pages[page] = wikitext(page)
        text = pages[page]
        head = params(template(text, 'Abyssal Moon Spire'))
        if head.get('start', '') > info.get('start', ''):
            info = {'start': head.get('start', ''), 'end': head.get('end', ''), 'version': head.get('startVersion', '')}
        sec = re.search(r'===\s*Floor %s\s*===(.*?)(?=\n===|\Z)' % n, text, re.S).group(1)
        enemies = params(template(sec, 'Domain Enemies'))
        floors.append({
            'floor': int(n),
            'disorders': [unwiki(d) for d in re.findall(r'^\*\*\s*(.+)$', sec, re.M)],
            'chambers': [{'level': int(enemies.get('level%d' % c) or 0), 'target': unwiki(enemies.get('target%d' % c, '')),
                          'halves': [foes(enemies.get('enemies%d_%d' % (c, h), '')) for h in (1, 2)],
                          'spawns': spawns(enemies.get('note%d' % c, ''))}
                         for c in (1, 2, 3) if enemies.get('level%d' % c)],
        })
    if len(floors) != 4:
        raise ValueError('expected floors 9-12, got %d' % len(floors))
    return dict(info, floors=sorted(floors, key=lambda f: f['floor']))


def theater():
    """The Imaginarium Theater season running now (its page's header template)."""
    today = datetime.datetime.now(UTC8).strftime('%Y-%m-%d')
    q = wiki(action='query', list='categorymembers', cmtitle='Category:Imaginarium Theater Seasons', cmlimit=500)
    titles = [m['title'] for m in q['query']['categorymembers'] if re.search(r'/Seasons/\d{4}-\d\d-\d\d$', m['title'])]
    title = max((t for t in titles if t[-10:] <= today), key=lambda t: t[-10:])
    p = params(template(wikitext(title), 'Imaginarium Theater Season'))

    def split(k):
        return [unwiki(x) for x in p.get(k, '').split(';') if unwiki(x)]

    return {
        'season': p.get('season', ''), 'version': p.get('startVersion', ''), 'start': p.get('start', ''), 'end': p.get('end', ''),
        'elements': split('elements'), 'characters': split('characters'), 'guests': split('guests'), 'blessing': unwiki(p.get('blessing', '')),
        'enemies': [{'name': n.strip(), 'level': int(re.sub(r'\D', '', lv) or 0)} for n, _, lv in (e.partition('*') for e in split('enemies'))],
    }


def endgame():
    out = {'abyss': abyss(), 'theater': theater()}
    # Enemy pictures: the wiki's "File:<Name> Icon.png" as 96px thumbs (hotlinked, like CODM's weapons).
    names = sorted({e['name'] for f in out['abyss']['floors'] for c in f['chambers'] for h in c['halves'] for w in h for e in w} |
                   {e['name'] for e in out['theater']['enemies']})
    icons = {}
    for i in range(0, len(names), 50):
        q = wiki(action='query', titles='|'.join('File:%s Icon.png' % n for n in names[i:i + 50]), prop='imageinfo', iiprop='url', iiurlwidth=96)['query']
        back = {x['to']: x['from'] for x in q.get('normalized', [])}
        for pg in q['pages'].values():
            url = (pg.get('imageinfo') or [{}])[0].get('thumburl')
            if url:
                icons[back.get(pg['title'], pg['title'])[len('File:'):-len(' Icon.png')]] = url
    out['icons'] = icons
    return out


def history(roster, live):
    """Every character wish since 1.0, one entry per phase: start/end (unix, read as UTC+8),
    version, kind (event | chronicled), the featured 5-stars and 4-stars by name. Weapons
    are left out. Phases paimon.moe hasn't added yet come from the live feed."""
    src = get(PAIMON, raw=True).decode('utf-8')
    src = re.sub(r'^\s*//.*\n', '', src, flags=re.M)  # commented-out banners
    body = src[src.index('{'):].rstrip().rstrip(';')
    body = re.sub(r'^(\s*)([A-Za-z_]\w*):', r"\1'\2':", body, flags=re.M)  # JS keys -> Python
    body = re.sub(r'\btrue\b', 'True', re.sub(r'\bfalse\b', 'False', body))
    data = ast.literal_eval(body)
    names = {slug(c['name']): c['name'] for c in roster}
    unix = lambda t: int(datetime.datetime.strptime(t, '%Y-%m-%d %H:%M:%S').replace(tzinfo=UTC8).timestamp())
    out = []
    for kind, key in (('event', 'characters'), ('chronicled', 'chronicled')):
        for b in data.get(key, []):
            five = [names[i] for i in b['featured'] if i in names]
            four = [names[i] for i in b.get('featuredRare', []) if i in names]
            if five:
                out.append({'start': unix(b['start']), 'end': unix(b['end']), 'version': b.get('version', ''), 'kind': kind, 'five': five, 'four': four})
    starts = {(b['kind'], b['start']) for b in out}
    phases = {}
    for b in live:  # the live character wishes, grouped by phase like paimon's entries
        if not any(c['rarity'] == 5 for c in b.get('characters', [])):
            continue
        kind = 'chronicled' if 'Chronicled' in b['name'] else 'event'
        ph = phases.setdefault((kind, b['start']), {'start': b['start'], 'end': b['end'], 'version': b.get('version', ''), 'kind': kind, 'five': [], 'four': []})
        for c in b['characters']:
            lst = ph['five'] if c['rarity'] == 5 else ph['four']
            if c['name'] not in lst:
                lst.append(c['name'])
    out += [ph for k, ph in phases.items() if k not in starts]
    out.sort(key=lambda b: (b['start'], b['kind']))
    return {'source': "Banner history: paimon.moe (MIT License, Copyright (c) 2021 Made Baruna) + Parchrome's live feed.", 'banners': out}


def enka_map():
    """Id -> name/icon maps for the player lookup (/genshin-impact/player/<UID>), from
    EnkaNetwork/API-docs store/gi (the ids Enka's API answers with). Icons are names on
    enka.network/ui/: a character's `i` makes UI_AvatarIcon_<i>.png (face) and
    UI_Gacha_AvatarImg_<i>.png (wish art). Characters are keyed by avatarId, the Traveler
    by avatarId-skillDepotId (one entry per element). `s` = the three talents in game
    order as [skill id, the id its constellation boost is keyed by]; `si` = their icons
    (Skill_<si>.png); `k` = the six constellation icons (UI_Talent_<k>.png); `wt` = weapon type."""
    store = 'https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/gi/'
    loc = get(store + 'locs.json')['en']
    name = lambda h: loc.get(str(h), '')
    base = lambda p: p.rsplit('/', 1)[-1].rsplit('.', 1)[0]  # "/ui/UI_X.png" -> "UI_X"
    chars, costumes = {}, {}
    for cid, c in get(store + 'avatars.json').items():
        if not c.get('SideIconName'):
            continue
        chars[cid] = {
            'n': name(c['NameTextMapHash']),
            'e': ELEMENTS.get(c.get('Element'), ''),
            'r': 4 if c.get('QualityType') == 'QUALITY_PURPLE' else 5,
            'i': base(c['SideIconName']).replace('UI_AvatarIcon_Side_', ''),
            's': [[int(k), c.get('ProudMap', {}).get(str(k), 0)] for k in c.get('SkillOrder', [])],
            'si': [base(c.get('Skills', {}).get(str(k), '')).replace('Skill_', '', 1) for k in c.get('SkillOrder', [])],
            'k': [base(p).replace('UI_Talent_', '', 1) for p in c.get('Consts') or []],
            'wt': WEAPONS.get(c.get('WeaponType'), ''),
        }
        for kid, k in (c.get('Costumes') or {}).items():
            costumes[kid] = base(k['Icon']).replace('UI_AvatarIcon_', '')
    relics = get(store + 'relics.json')
    return {
        'source': 'EnkaNetwork/API-docs store/gi',
        'c': chars,
        'cos': costumes,
        'nc': {k: base(v['Icon']) for k, v in get(store + 'namecards.json').items()},
        # Namecard [name, type] (bond / achievement / battlePass / event / reputation / other), from yatta.
        'ncn': {str(v['id']): [v['name'], v['type']] for v in yatta('namecard')['items'].values()},
        'pf': {k: base(v['IconPath']) for k, v in get(store + 'pfps.json').items() if v.get('IconPath')},
        'w': {k: name(v['NameTextMapHash']) for k, v in get(store + 'weapons.json').items()},
        'set': {k: name(v['Name']) for k, v in relics['Sets'].items()},
    }


# Weapon wish card (Oct 23 2026): each featured 5-star gets its upright art and its max-level
# [level, Base ATK, substat] from the weapons file (the weapons page's overview plates).
def wish_weapons(banners):
    if not WEAPONS_OUT.exists():
        return
    db = {w['name']: w for w in json.loads(WEAPONS_OUT.read_text(encoding='utf-8'))['weapons']}
    for b in banners:
        for w in b.get('weapons', []):
            x = db.get(w['name'])
            if w['rarity'] == 5 and x and x.get('stats'):
                lv, _, atk, sub = x['stats'][-1]
                w['max'] = [lv, atk, sub]
                if x.get('art'):
                    w['art'] = x['art']


# ---- WISH POOL (Oct 26 2026): /genshin-impact/wish-simulator, its own file ------------------------
# What a wish can drop besides its featured items: the Standard wish's pool from the wiki's Wanderlust
# Invocation page ({{Wish Pool}}, CC BY-SA). It's also every event wish's off-rate pool (the wiki's
# Wish page: event wishes draw their non-featured items from it). Each pool + banner character gets its
# full wish art (splash(), once), so the reveal can show it; 5-star weapons get their 400x800 wish art
# too, 4/3-star weapons use the weapons database's 256x512 art. No timestamp: rewritten on change only.
WISHPOOL_OUT = ROOT / 'genshin-wishpool.json'


def wish_pool(roster, live):
    p = params(template(wikitext('Wanderlust Invocation'), 'Wish Pool'))
    names = lambda k: [n.strip() for n in p.get(k, '').split(';') if n.strip()]
    pool = {'5c': names('character_5'), '4c': names('character_4'), '5w': names('weapon_5'), '4w': names('weapon_4'), '3w': names('weapon_3')}
    if not pool['5c'] or not pool['3w']:
        raise ValueError('Wish Pool template not found')
    by_name = {c['name']: c for c in roster}
    wdb = {w['name']: w for w in json.loads(WEAPONS_OUT.read_text(encoding='utf-8'))['weapons']}
    want_c = pool['5c'] + pool['4c'] + [c['name'] for b in live for c in b.get('characters', [])]
    want_w = pool['5w'] + pool['4w'] + pool['3w'] + [w['name'] for b in live for w in b.get('weapons', [])]
    chars, weps = {}, {}
    for n in dict.fromkeys(want_c):
        c = by_name.get(n)
        if not c:
            print('wish pool: no character', n, file=sys.stderr)
            continue
        key = c['icon'].rsplit('/', 1)[-1][:-4]
        try:
            art = splash(key)
        except Exception as e:
            print('wish pool: splash', n, 'failed:', e, file=sys.stderr)
            art = ''
        chars[n] = {'r': c['rarity'], 'el': c['element'], 'wp': c['weapon'], 'strip': c['strip'], 'splash': art}
    for n in dict.fromkeys(want_w):
        w = wdb.get(n)
        if not w:
            print('wish pool: no weapon', n, file=sys.stderr)
            continue
        art = w.get('art', '')
        if w['rarity'] == 5:
            try:
                art = splash(w['icon'].rsplit('/', 1)[-1][:-4])
            except Exception as e:
                print('wish pool: weapon splash', n, 'failed:', e, file=sys.stderr)
        weps[n] = {'r': w['rarity'], 'type': w['type'], 'art': art, 'icon': w['icon']}
    pool = {k: [n for n in v if n in (chars if k.endswith('c') else weps)] for k, v in pool.items()}
    return {'source': "The Genshin Impact Wiki's Wanderlust Invocation page (Fandom, CC BY-SA)", 'pool': pool, 'chars': chars, 'weapons': weps}


# ---- BIRTHDAYS (Oct 24 2026): /genshin-impact/birthdays, its own file ---------------------------
# Who each character is (yatta avatar: title, one-line bio, constellation, affiliation, special dish,
# namecard) + the "Birthday" voice line (yatta avatarFetter: what they say on YOUR birthday). Fetched
# once per character id. Their birthday letters come from the Fandom wiki's Category:Birthday Mails
# (CC BY-SA): only the newest letter per character is kept, re-read once a day (~11 requests).
# Namecard pictures (UI_NameCardPic_*_P, 840x400) -> WebP in images/genshin/namecard/char/, once.
BIRTHDAYS_OUT = ROOT / 'genshin-birthdays.json'
NAMECARD_ART = ROOT / 'images' / 'genshin' / 'namecard' / 'char'


def game_text(s):
    """yatta's in-game text -> plain: {NICKNAME} = Traveler, #{M#he}{F#she} -> he/she, tags dropped."""
    s = (s or '').replace('{NICKNAME}', 'Traveler').lstrip('#')
    s = re.sub(r'\{M#([^}]*)\}\{F#([^}]*)\}', r'\1/\2', s)
    s = re.sub(r'\{F#([^}]*)\}\{M#([^}]*)\}', r'\2/\1', s)
    s = re.sub(r'<[^>]+>', '', s)
    return ' '.join(s.replace('\\n', ' ').split())


def namecard_art(name):
    key = name.replace('UI_NameCardIcon_', '')
    out = NAMECARD_ART / (key + '.webp')
    if not out.exists():
        try:
            im = Image.open(io.BytesIO(get(ASSET + 'namecard/UI_NameCardPic_%s_P.png' % key, raw=True))).convert('RGB')
        except Exception as e:
            print('namecard', key, 'failed:', e, file=sys.stderr)
            return ''
        NAMECARD_ART.mkdir(parents=True, exist_ok=True)
        im.save(out, 'WEBP', quality=80, method=6)
    return '/images/genshin/namecard/char/' + out.name


def mail(text):
    """One {{Mail}} page -> {title, date, who, text: [paragraphs], items: [[name, n]]}."""
    body = template(text, 'Mail').split('\n', 1)[1]
    parts = re.split(r'(?:^|\n)\|\s*(\w+)\s*=[ \t]*', body)
    f = {k: v.strip() for k, v in zip(parts[1::2], parts[2::2])}
    words = re.sub(r'\{\{(?:MC|Traveler)[^{}]*\}\}', 'Traveler', html.unescape(f.get('text', '')))
    items = []
    for it in filter(None, (x.strip() for x in f.get('items', '').split(','))):
        name, _, n = it.partition('*')
        items.append([unwiki(name), int(n) if n.strip().isdigit() else 1])
    return {
        'title': unwiki(f.get('title', '')), 'date': f.get('date', ''), 'who': unwiki(f.get('character') or f.get('sender', '')),
        'text': [p for p in (unwiki(x) for x in re.split(r'\n\s*\n', words)) if p], 'items': items,
    }


def birthdays(chars):
    old = json.loads(BIRTHDAYS_OUT.read_text(encoding='utf-8')) if BIRTHDAYS_OUT.exists() else {}
    people = old.get('people', {})
    for c in chars:
        k = str(c['id'])
        if not c.get('birthday') or (k in people and people[k].get('line')):  # no line yet: asked again next run
            continue
        d = yatta('avatar/%s' % c['id'])
        fet, other = d.get('fetter') or {}, d.get('other') or {}
        quotes = (yatta('avatarFetter/%s' % c['id']).get('quotes') or {}).values()
        line = next((q['text'] for q in quotes if q.get('title', '').startswith(('Birthday', 'Birth Date'))), '')  # Xingqiu: "Birthday: Wishing", Yae: "Birth Date"
        food, card = other.get('specialFood') or {}, other.get('nameCard') or {}
        people[k] = {
            'title': fet.get('title', ''), 'about': game_text(fet.get('detail')), 'constellation': fet.get('constellation', ''),
            'affiliation': fet.get('native', ''), 'line': game_text(line),
            'dish': [food['name'], icon(food['icon'])] if food.get('name') else None,
            'card': card.get('name', '').split(': ', 1)[-1], 'namecard': namecard_art(card['icon']) if card.get('icon') else '',
        }
    letters = old.get('letters', {})
    today = datetime.date.today().isoformat()
    if old.get('checked') != today or not letters:
        titles = [m['title'] for m in wiki(action='query', list='categorymembers', cmtitle='Category:Birthday Mails', cmlimit=500, cmtype='page')['query']['categorymembers']]
        names = {c['name'] for c in chars}
        icons = {v['name']: icon(v['icon']) for kind in ('material', 'food') for v in yatta(kind)['items'].values() if v.get('icon')}
        fresh = {}
        for page, text in wiki_pages(titles).items():
            try:
                m = mail(text)
            except Exception as e:
                print('mail', page, 'failed:', e, file=sys.stderr)
                continue
            who = m.pop('who')
            if who in names and m['text'] and m['date'] > fresh.get(who, {}).get('date', ''):
                m['items'] = [[n, k, icons.get(n) or icons.get(n.replace('Delicious ', ''), '')] for n, k in m['items']]  # same icon as the plain dish
                fresh[who] = m
        letters = dict(sorted(fresh.items())) or letters
    return {
        'source': 'Project Amber (gi.yatta.moe) + the Genshin Impact Wiki (Fandom, CC BY-SA): Birthday Mails.',
        'checked': today, 'people': dict(sorted(people.items())), 'letters': letters,
    }


# ---- NATIONS (Oct 24 2026): /genshin-impact/nations, its own file ------------------------------
# Facts (element, archon, ideal, capital, chapter, festivals, the official one-line description) come
# from each nation's {{Region Infobox}} on the Fandom wiki (CC BY-SA), the version it opened in from its
# {{Change History}}, that version's name + date from Version/<v>. World bosses: the wiki's Normal Boss
# list (wikitext); weekly bosses: the rendered Weekly Boss list (that table is built by DPL, so only the
# HTML has it). Local specialties + who uses every drop: yatta `material` / `material/{id}` requiredBy.
# Checked once a day (~150 requests). No emblems: Fandom's image CDN turns bots away, so the page uses our element emblems.
NATIONS_OUT = ROOT / 'genshin-nations.json'
# The playable character each archon is (the infobox gives the god's name). Fontaine has none since
# Masquerade of the Guilty (the infobox's archonNote says why); Snezhnaya's isn't playable.
ARCHON_AS = {'Barbatos': 'Venti', 'Morax': 'Zhongli', 'Beelzebul': 'Raiden Shogun', 'Buer': 'Nahida', 'Haborym': 'Mavuika'}
GEM_TIERS = (' Sliver', ' Fragment', ' Chunk', ' Gemstone')


def nation_facts(text):
    text = re.sub(r'<ref[^>]*/>|<ref[^>]*>.*?</ref>', '', text, flags=re.S)
    box = template(text, 'Region Infobox')
    f = {m.group(1): m.group(2).strip() for m in re.finditer(r'^\|\s*([\w. ]+?)\s*=(.*)$', box, re.M)}
    desc = re.search(r'\{\{Description\|(.*?)\|\[http', text, re.S)
    tag, br, about = (desc.group(1) if desc else '').partition('<br>')
    if not br and '. ' in tag:  # Liyue's has no line break: its first sentence is the tagline
        tag, about = tag.split('. ', 1)
        tag += '.'
    ver = re.search(r'\{\{Change History\|([^|}]+)', text)
    god = unwiki(f.get('archon', ''))
    god = '' if god == 'None' else god
    return {
        'element': unwiki(f.get('element', '')), 'archon': god, 'archonAs': ARCHON_AS.get(god, ''), 'archonNote': unwiki(f.get('archonNote', '')),
        'ideal': unwiki(f.get('ideal', '')), 'capital': unwiki(f.get('main city', '')), 'chapter': unwiki(f.get('chapter', '')),
        'ruled': unwiki(f.get('controlling_entity', '')),
        'festivals': [x for x in (unwiki(p) for p in re.split(r'<br\s*/?>', f.get('festival', ''))) if x],
        'tagline': unwiki(tag), 'about': unwiki(about), 'version': ver.group(1).strip() if ver else '',
    }


def world_bosses(names):
    """Normal Boss list -> {nation: [{name, area, drop, gems}]}: drop = the boss's own material, gems = the
    ascension gem series it drops (the name without Sliver/Fragment...)."""
    text = wikitext('Normal Boss')
    body = text[text.index('==List of Normal Bosses=='):]
    parts = re.split(r'\n===([^=\n]+)===\s*\n', body)
    out = {}
    for nation, sec in zip(parts[1::2], parts[2::2]):
        nation = nation.strip()
        if nation not in names:
            continue
        for m in re.finditer(r'\{\{Card\|([^|}]+)\|type=Enemy[^}]*\}\}\s*(?:<br\s*/?>)?\s*<small>\{\{Location\|([^}]+)\}\}</small>\s*\n\|\s*\{\{Card List\|1=([^\n]*)', sec):
            drops = [d.split('{')[0].strip() for d in m.group(3).split('|mini')[0].split(',')]
            gems = list(dict.fromkeys(d[: -len(' Sliver')] for d in drops if d.endswith(' Sliver')))
            out.setdefault(nation, []).append({'name': m.group(1).strip(), 'area': unwiki(m.group(2)), 'drop': drops[0], 'gems': gems})
    return out


def weekly_bosses(names):
    """Rendered Weekly Boss list -> {nation: [{name, area, drops}]}: drops = the three talent materials."""
    t = wiki(action='parse', page='Weekly Boss', prop='text', formatversion=2)['parse']['text']
    t = t[t.index('List of Weekly'):]
    t = t[: t.index('id="Gameplay_Notes"')] if 'id="Gameplay_Notes"' in t else t  # not the bare id: the contents box links it first
    out = {}
    for row in re.findall(r'<tr>(.*?)</tr>', t, re.S):
        tds = re.findall(r'<td[^>]*>(.*?)</td>', row, re.S)
        titles = [html.unescape(x) for x in re.findall(r'title="([^"]+)"', row)]
        nation = next((x for x in titles if x in names), '')
        if len(tds) < 3 or not nation:
            continue
        name = ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', tds[0])).split()).lstrip('— ').strip()
        area = [x.strip() for x in html.unescape(re.sub(r'<[^>]+>', ' ', tds[1])).split(',')]
        after = titles[titles.index(nation) + 1:]
        drops = list(dict.fromkeys(x for x in after if not x.endswith(GEM_TIERS)))[:3]
        gems = list(dict.fromkeys(x[: -len(' Sliver')] for x in after if x.endswith(' Sliver')))
        out.setdefault(nation, []).append({'name': name, 'area': ' '.join(area[0].split()), 'drops': drops, 'gems': gems})
    return out


def nations():
    old = json.loads(NATIONS_OUT.read_text(encoding='utf-8')) if NATIONS_OUT.exists() else {}
    today = datetime.date.today().isoformat()
    if old.get('checked') == today and old.get('nations'):
        return old
    names = list(CITIES.values())
    pages = wiki_pages(names)
    facts = {n: nation_facts(pages[n]) for n in names}
    vers = wiki_pages('Version/' + f['version'] for f in facts.values() if f['version'])
    mats = list(yatta('material')['items'].values())
    by_name = {m['name']: m for m in mats}
    used = {}

    def users(mid):
        if mid not in used:
            req = (yatta('material/%s' % mid).get('additions') or {}).get('requiredBy') or {}
            used[mid] = sorted({a['name'] for a in req.get('avatar') or []})  # a set: yatta lists the Traveler once per twin x element
        return used[mid]

    def item(name, with_users=True):
        m = by_name.get(name)
        if not m:
            return {'name': name, 'icon': '', 'rarity': 0, 'users': []}
        return {'name': name, 'icon': icon(m['icon']), 'rarity': m.get('rank', 0), 'users': users(m['id']) if with_users else []}

    gem = lambda g: item(g + ' Gemstone', False) | {'name': g}
    world, weekly = world_bosses(names), weekly_bosses(names)
    out = []
    for n in names:
        key = n.lower().replace('-', '')
        f = facts[n]
        v = vers.get('Version/' + f['version'], '')
        vb = {m.group(1): m.group(2).strip() for m in re.finditer(r'^\|\s*(\w+)\s*=(.*)$', v, re.M)}
        out.append(dict(f, **{
            'name': n, 'key': key, 'versionName': unwiki(vb.get('title', '')), 'versionDate': vb.get('date', ''),
            'specialties': [item(m['name']) for m in mats if m.get('type') == 'localSpecialty' + n.replace('-', '')],
            'bosses': [dict(b, drop=item(b['drop']), gems=[gem(g) for g in b['gems']]) for b in world.get(n, [])],
            'weekly': [dict(b, drops=[item(d) for d in b['drops']], gems=[gem(g) for g in b['gems']]) for b in weekly.get(n, [])],
        }))
    return {
        'source': 'The Genshin Impact Wiki (Fandom, CC BY-SA): regions, versions, Normal Boss + Weekly Boss lists. Project Amber (gi.yatta.moe): local specialties, materials, who uses them.',
        'checked': today, 'nations': out,
    }


ACHIEVEMENTS_OUT = ROOT / 'genshin-achievements.json'
MEDAL_ART = ROOT / 'images' / 'genshin' / 'achievement'


def medal_art(icon_name):
    """A category's medal (UI_AchievementIcon_X, transparent) -> 128px WebP, once."""
    out = MEDAL_ART / (icon_name.replace('UI_AchievementIcon_', '') + '.webp')
    if not out.exists():
        try:
            im = Image.open(io.BytesIO(get(ASSET + 'achievement/' + icon_name + '.png', raw=True))).convert('RGBA')
        except Exception as e:
            print('medal', icon_name, 'failed:', e, file=sys.stderr)
            return ''
        MEDAL_ART.mkdir(parents=True, exist_ok=True)
        im.thumbnail((128, 128))
        im.save(out, 'WEBP', quality=88, method=6)
    return '/images/genshin/achievement/' + out.name


def achievements():
    """Every achievement, by category in the game's order. Each tier is its own game id (= UIAF's id),
    so the page ticks tiers. {param0} in a description is that tier's target. Namecard = the category's
    finishReward (yatta namecard names); its picture goes next to the birthday namecards."""
    cards = yatta('namecard')['items']
    cats = []
    for c in sorted(yatta('achievement').values(), key=lambda c: c['order']):
        card = None
        for rid in (c.get('finishReward') or {}):
            nc = cards.get(rid)
            if nc:
                card = [nc['name'].replace('Achievement: ', ''), namecard_art(nc['icon'])]
        ach = []
        for a in sorted(c['achievementList'].values(), key=lambda a: a['order']):
            # A tier = [game id, what to do, Primogems, target (UIAF's `current` when done)].
            tiers, titles = [], []
            for t in a['details']:
                p = t.get('progress') or 1
                desc = game_text(t['description'].replace('{param0}', format(p, ',')))
                tiers.append([t['id'], desc, sum(r['count'] for k, r in (t.get('rewards') or {}).items() if k == '201'), p])
                titles.append(game_text(t['title']))
            quests = list(dict.fromkeys(q['questTitle'] for task in (a.get('tasks') or []) for q in task.get('questList') or [] if q.get('questTitle')))
            ach.append({'n': titles[0], 'v': a['version'], 't': tiers,
                        **({'tn': titles} if len(set(titles)) > 1 else {}),  # tiers with their own names (Tundra Gunsmith I / II / III)
                        **({'q': quests} if quests else {})})
        cats.append({'id': c['id'], 'name': c['name'], 'slug': slug(c['name']), 'medal': medal_art(c['icon']), 'card': card, 'ach': ach})
    vers = {a['v'] for c in cats for a in c['ach']}
    return {'source': 'Project Amber (gi.yatta.moe)', 'latest': max(vers, key=version_key) if vers else '', 'cats': cats}


# ---- ENEMIES (Oct 24 2026): /genshin-impact/enemies, two files ------------------------------------
# The list = the wiki's four enemy categories (Common, Elite, Normal Boss, Weekly Boss; 366 with an Enemy
# Infobox). Per enemy, from its wiki page: family, group, where (bosses), what it hits with, weak point,
# resistances per form/state ({{Enemy Stats}}; the wiki's defaults: a missing value = 10%, every extra state
# falls back to its own resglobalN, not to the first state), the HP/ATK ratios + level tables (the wiki's own
# Module:Enemy Stats math, which matched yatta's game curves exactly), energy drops, attacks, version.
# yatta (matched by English name, then by the Chinese name the wiki's {{Other Languages}} gives) adds the
# archive title, lore, in-game tips, drops and the icon we host. yatta's resistances are NOT used: they miss
# immunities (Pyro Slime reads 10% Pyro). Per-kill drop amounts are left out: they depend on world level.
# Big art = the wiki's archive picture, hotlinked in the browser (Fandom's CDN turns bots away).
# Checked once a day; each enemy's yatta detail is fetched once.
ENEMIES_OUT = ROOT / 'genshin-enemies.json'  # the list, filters, resistances, drops (the grid loads this)
ENEMIES_MORE = ROOT / 'genshin-enemies-more.json'  # lore, tips, attacks (loaded when a dossier opens)
ENEMY_ART = ROOT / 'images' / 'genshin' / 'enemy'
ENEMY_CLASSES = [('Common Enemies', 'common'), ('Elite Enemies', 'elite'), ('Normal Bosses', 'boss'), ('Weekly Bosses', 'weekly')]
RES_KEYS = [('pyro', 'Pyro'), ('hydro', 'Hydro'), ('anemo', 'Anemo'), ('electro', 'Electro'), ('dendro', 'Dendro'), ('cryo', 'Cryo'), ('geo', 'Geo'), ('phys', 'Physical')]
# Drops worth listing (yatta material types): common ascension materials, boss + weekly boss drops, gems.
DROP_KINDS = {'characterandWeaponEnhancementMaterial': 'common', 'characterLevelUpMaterial': 'boss', 'characterAscensionMaterial': 'gem'}
# Wiki page -> yatta name, where neither the English nor the Chinese name matches.
ENEMY_ALIAS = {'Andrius': 'Lupus Boreas, Dominator of Wolves', 'Rhodeia of Loch': 'Oceanid', 'Everlasting Lord of Arcane Wisdom': 'Shouki no Kami, the Prodigal'}
ELEMENT_WORDS = 'Pyro|Hydro|Anemo|Electro|Dendro|Cryo|Geo|Physical'


def enemy_text(s):
    """unwiki() plus the templates enemy pages use inside sentences: {{Pyro}}, {{Color|Pyro DMG}}, {{Tt|text|tip}}."""
    s = re.sub(r'\{\{(%s)(?:\|[^{}]*)?\}\}' % ELEMENT_WORDS, r'\1', s)
    s = re.sub(r'\{\{Color\|[^|{}]*\|([^|{}]*)\}\}', r'\1', s)  # {{Color|key|Text}} -> Text
    s = re.sub(r'\{\{(?:Color|Tt|Text|Hover)\|([^|{}]*)(?:\|[^{}]*)?\}\}', r'\1', s)  # {{Color|Text}}, {{Tt|Text|tip}}
    return unwiki(s)


def enemy_art(icon_name):
    """yatta's archive icon (UI_MonsterIcon_*, 256x256) -> a 160px WebP on our site."""
    out = ENEMY_ART / (icon_name.replace('UI_MonsterIcon_', '') + '.webp')
    if not out.exists():
        try:
            im = Image.open(io.BytesIO(get(ASSET + 'monster/' + icon_name + '.png', raw=True))).convert('RGBA')
        except Exception as e:
            print('enemy art', icon_name, 'failed:', e, file=sys.stderr)
            return ''
        ENEMY_ART.mkdir(parents=True, exist_ok=True)
        im.thumbnail((160, 160))
        im.save(out, 'WEBP', quality=80, method=6)
    return '/images/genshin/enemy/' + out.name


def tparams(body):
    """A template's '|key = value' pairs, one per line or all on one line."""
    return {k: v.strip() for k, v in re.findall(r'\|\s*(\w+)\s*=\s*([^|\n]*)', body)}


def res_value(v):
    """'50%' -> 50, '&minus;20%' -> -20, 'Immune' -> 'I', 'N/A' -> None."""
    v = html.unescape(v).replace('−', '-').strip()
    if v.lower().startswith('immune'):
        return 'I'
    m = re.match(r'^(-?\d+(?:\.\d+)?)\s*%', v)
    return (float(m.group(1)) if '.' in m.group(1) else int(m.group(1))) if m else None


def enemy_forms(text):
    """Every {{Enemy Stats}} on the page -> [{name, states [[label, [8 res]]], hp [ratio, type], atk [ratio, type]}].
    name = the heading above it (Phase 1, a form) when there's more than one."""
    out = []
    blocks = list(re.finditer(r'\{\{Enemy Stats(.*?)\}\}', text, re.S))
    for m in blocks:
        p = tparams(m.group(1))
        head = re.findall(r'^=+\s*(.*?)\s*=+\s*$', text[: m.start()], re.M)
        states = []
        for n in range(1, 7):
            sfx = '' if n == 1 else str(n)
            if n > 1 and not p.get('res%d' % n):
                break
            base = p.get('resglobal' + sfx, '10%')
            # the first state's name; a few pages type `res` for `res1` (Cryo Regisvine's "Shielded")
            label = unwiki(p.get('res%d' % n) or (p.get('res') if n == 1 else '') or ('Base' if p.get('res2') else ''))
            states.append([label, [res_value(p.get(k + '_res' + sfx, base)) for k, _ in RES_KEYS]])

        def num(k, d):
            try:
                return float(p.get(k) or d)
            except ValueError:
                return float(d)

        out.append({
            'name': unwiki(head[-1]) if len(blocks) > 1 and head and head[-1] not in ('Stats', 'Base Stats') else '',
            'states': states,
            'hp': [num('hp_ratio', 1), p.get('hp_type') or '1'], 'atk': [num('atk_ratio', 1), p.get('atk_type') or '1'],
        })
    return out


def energy(text):
    """{{Energy Drops}} -> {el, drops [[hp %, particles, orbs]]}: drops at those HP marks (0 = on defeat)."""
    m = re.search(r'\{\{Energy Drops(.*?)\}\}', text, re.S)
    if not m:
        return None
    p = tparams(m.group(1))
    drops = []
    for n in range(1, 10):
        if 'hp%d' % n not in p:
            break
        f = lambda k: float(re.sub(r'[^\d.]', '', p.get(k % n, '')) or 0)
        drops.append([int(x) if x == int(x) else x for x in (f('hp%d'), f('p%d'), f('o%d'))])
    el = unwiki(p.get('type', ''))
    return {'el': '' if el in ('None', '') else el, 'drops': drops}


def attacks(text):
    """{{Enemy Attacks}} -> [[name, what it does]]: the first paragraph, cut near 260 characters."""
    out = []
    for m in re.finditer(r'\{\{Enemy Attacks(.*?)\n\}\}', text, re.S):
        body = m.group(1)
        for n, name in re.findall(r'^\|\s*name_(\d+)\s*=(.*)$', body, re.M):
            d = re.search(r'^\|\s*desc_%s\s*=(.*?)(?=^\||\Z)' % n, body, re.M | re.S)
            desc = enemy_text(re.split(r'\n\s*\*', d.group(1))[0]) if d else ''
            if len(desc) > 260:
                desc = desc[:260].rsplit('. ', 1)[0] + '.' if '. ' in desc[:260] else desc[:257].rsplit(' ', 1)[0] + '…'
            if enemy_text(name):
                out.append([enemy_text(name), desc])
    return out


def level_tables():
    """The wiki's level tables (Module:Enemy Stats/HP and /ATK): {hp: {type: [lv1..100]}, atk: {...}}."""
    pages = wiki_pages(['Module:Enemy Stats/HP', 'Module:Enemy Stats/ATK'])
    out = {}
    for key, page in (('hp', 'Module:Enemy Stats/HP'), ('atk', 'Module:Enemy Stats/ATK')):
        tables, cur = {}, None
        for line in pages[page].replace('\r', '').split('\n'):
            m = re.match(r"^\['(\w+)'\]\s*=\s*\{", line)
            if m:
                cur = tables.setdefault(m.group(1), {})
                continue
            m = re.match(r"^\s+\['(\d+)'\]\s*=\s*'?([\d.]+)'?", line)
            if m and cur is not None:
                cur[int(m.group(1))] = float(m.group(2))
        out[key] = {t: [v[lv] for lv in range(1, 101)] for t, v in tables.items() if all(lv in v for lv in range(1, 101))}
    return out


def enemies():
    old = json.loads(ENEMIES_OUT.read_text(encoding='utf-8')) if ENEMIES_OUT.exists() else {}
    old_more = json.loads(ENEMIES_MORE.read_text(encoding='utf-8')) if ENEMIES_MORE.exists() else {}
    today = datetime.date.today().isoformat()
    if old.get('checked') == today and old.get('enemies'):
        return old, old_more

    cls = {}
    for cat, k in ENEMY_CLASSES:
        for x in wiki(action='query', list='categorymembers', cmtitle='Category:' + cat, cmlimit=500, cmnamespace=0)['query']['categorymembers']:
            cls.setdefault(x['title'], k)
    pages = {t: x for t, x in wiki_pages(cls).items() if '{{Enemy Infobox' in x}

    # yatta, by English name, then by Chinese name (aliases like Andrius = "Lupus Boreas, Dominator of Wolves").
    mons = yatta('monster')['items'].values()
    en = {m['name']: m for m in mons}
    zh = {}
    try:
        chs = {str(m['id']): m['name'] for m in get('https://gi.yatta.moe/api/v2/chs/monster')['data']['items'].values()}
        zh = {chs[str(m['id'])]: m for m in mons if str(m['id']) in chs}
    except Exception as e:
        print('yatta chs monsters failed:', e, file=sys.stderr)
    known = {e['name']: e for e in old.get('enemies', [])}
    known_more = old_more

    mats = {str(m['id']): m for m in yatta('material')['items'].values()}
    used = {}

    def users(mid):
        if mid not in used:
            req = (yatta('material/%s' % mid).get('additions') or {}).get('requiredBy') or {}
            used[mid] = [sorted({a['name'] for a in req.get('avatar') or []}), len(req.get('weapon') or [])]
        return used[mid]

    out, more, materials, slugs = [], {}, {}, set()
    for title, text in sorted(pages.items()):
        box = params(template(text, 'Enemy Infobox'))
        name = re.sub(r'\s*\([^)]*\)$', '', title)
        sl = slug(name)
        while sl in slugs:
            sl += '_2'
        slugs.add(sl)
        zhs = re.search(r'^\|\s*zhs\s*=\s*(.+)$', text, re.M)
        y = en.get(ENEMY_ALIAS.get(title, name)) or en.get(title) or (zh.get(zhs.group(1).strip()) if zhs else None)
        prev = known.get(name, {})
        bare = re.sub(r'<!--.*?-->', '', text, flags=re.S)
        table = re.search(r'\{\{Drops Table\|\s*type\s*=\s*([^|}]+)|\{\{Drops\|([^|}]+)', bare)
        e = {
            'name': name, 'slug': sl, 'page': title, 'cls': cls[title],
            'family': unwiki(box.get('family', '')), 'group': unwiki(box.get('group', '')), 'faction': unwiki(box.get('faction', '')),
            'region': unwiki(box.get('region', '')), 'area': unwiki(box.get('area', '')), 'sub': unwiki(box.get('subarea', '')),
            'deals': list(dict.fromkeys(v for v in (unwiki(box.get('dmgtype' + s, '')) for s in ['', '2', '3', '4', '5', '6', '7', '8']) if v and v != 'None')),
            'weak': box.get('weakpoint', '').lower() == 'yes',
            'abilities': [unwiki(box[k]) for k in sorted(box) if re.match(r'^a[bt]ility\d$', k) and unwiki(box[k])],
            'titles': [t for t in (unwiki(x) for x in box.get('title', '').split(';')) if t],
            'variants': [t for t in (unwiki(x) for x in box.get('variants', '').split(';')) if t],
            'forms': enemy_forms(text), 'energy': energy(text),
            'version': (re.search(r'\{\{Change History\|([^}|]+)', text) or [None, ''])[1].strip(),
            'id': y['id'] if y else 0, 'icon': prev.get('icon', ''), 'art': prev.get('art', ''),
            'drops': [] if prev.get('shared') else prev.get('drops', []),
            'table': (table.group(1) or table.group(2)).strip() if table else '',
        }
        if not e['forms']:  # no stats on the wiki yet (an unreleased enemy): nothing to show
            continue
        m_prev = known_more.get(sl, {}) if prev.get('id') == e['id'] else {}
        info = dict(m_prev)
        if y and (not m_prev or not e['icon']):
            d = yatta('monster/%s' % y['id'])
            ents = list((d.get('entries') or {}).values())
            reward = next((x['reward'] for x in ents if x.get('reward')), None) or {}
            e['drops'] = sorted((k for k in reward if (mats.get(k) or {}).get('type') in DROP_KINDS), key=int)
            e['icon'] = enemy_art(y['icon'])
            info = {
                'special': d.get('specialName') or '',
                'lore': [p for p in (game_text(x) for x in (d.get('description') or '').split('\\n\\n')) if p],
                'tips': [game_text(t.get('description')) for t in (d.get('tips') or {}).values() if t.get('description')],
            }
        if not info.get('lore'):  # wiki-only enemies: the archive text from {{Description}}
            desc = re.search(r'\{\{Description\|(.*?)(?:\|[^|{}]*)?\}\}', text, re.S)
            if desc:
                info['lore'] = [p for p in (enemy_text(x) for x in re.split(r'<br\s*/?>\s*<br\s*/?>', desc.group(1))) if p]
        info['attacks'] = attacks(text)
        more[sl] = info
        out.append(e)

    # Pictures: the wiki's archive art (the dossier) for everyone, its icon for enemies yatta doesn't have.
    files = {}
    for e in out:
        box = template(pages[e['page']], 'Enemy Infobox')
        img = params(box).get('image', '').strip()
        if img.startswith('<gallery>'):  # several pictures: the first one in the gallery
            g = re.search(r'<gallery>\s*\n\s*([^|\n]+)', box)
            img = g.group(1).strip() if g else ''
        files['File:' + (img or 'Enemy %s.png' % e['page'])] = (e, 'art', 560)
        if not e['icon']:
            files['File:%s Icon.png' % e['page']] = (e, 'icon', 160)
    for width in (560, 160):
        titles = [t for t, v in files.items() if v[2] == width]
        for i in range(0, len(titles), 50):
            q = wiki(action='query', titles='|'.join(titles[i:i + 50]), prop='imageinfo', iiprop='url', iiurlwidth=width)['query']
            back = {x['to']: x['from'] for x in q.get('normalized', [])}
            for pg in q['pages'].values():
                url = (pg.get('imageinfo') or [{}])[0].get('thumburl')
                t = back.get(pg['title'], pg['title'])
                if url and t in files:
                    e, field, _ = files[t]
                    e[field] = url

    # yatta has no drops for some enemies; the wiki gives each enemy a drop table ({{Drops Table|type=Abyss Mages}}),
    # so they take the common materials their table-mates drop (`shared` marks it, so next run asks yatta again).
    by_table = {}
    for e in out:
        if e['table'] and e['drops'] and e['id']:
            series = tuple(k for k in e['drops'] if mats[k]['type'] == 'characterandWeaponEnhancementMaterial')
            if series:
                by_table.setdefault(e['table'], []).append(series)
    for e in out:
        mates = by_table.get(e.pop('table'))
        if not e['drops'] and mates:
            e['drops'] = list(max(set(mates), key=mates.count))
            e['shared'] = True

    # Drops: one entry per material, with who uses it (one lookup per common series: every tier has the same users).
    # A common series = consecutive ids climbing in rarity (Slime Condensate -> Secretions -> Concentrate); some
    # enemies drop two series (masks + arrowheads), so a new one starts where the id jumps or the rarity drops back.
    for e in out:
        series, cur = [], []
        for k in sorted((k for k in e['drops'] if mats[k]['type'] == 'characterandWeaponEnhancementMaterial'), key=int):
            if cur and (int(k) != int(cur[-1]) + 1 or mats[k].get('rank', 1) <= mats[cur[-1]].get('rank', 1)):
                series.append(cur)
                cur = []
            cur.append(k)
        if cur:
            series.append(cur)
        for k in e['drops']:
            m = mats[k]
            kind = DROP_KINDS[m['type']]
            ser = next((s for s in series if k in s), [k])
            if k not in materials:
                who = users(ser[-1]) if kind == 'common' else users(k) if kind == 'boss' else [[], 0]
                materials[k] = {'name': m['name'], 'icon': icon(m['icon']), 'rarity': m.get('rank', 1), 'kind': kind, 'users': who[0], 'weapons': who[1]}
            if kind == 'common':
                materials[k]['series'] = ser
        e.pop('page')
    versions = sorted({e['version'] for e in out if e['version']}, key=version_key)
    return {
        'source': 'The Genshin Impact Wiki (Fandom, CC BY-SA): the enemy list, resistances, level scaling, energy drops, attacks. Project Amber (gi.yatta.moe): archive titles, lore, tips, drops, icons, who uses each drop.',
        'checked': today, 'newest': versions[-1] if versions else '', 'tables': level_tables(),
        'materials': dict(sorted(materials.items(), key=lambda kv: int(kv[0]))), 'enemies': out,
    }, more


def main():
    old = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {}
    data = dict(old)
    calendar = None
    try:
        calendar = get(ENNEAD + 'calendar')
    except Exception as e:
        print('calendar failed:', e, file=sys.stderr)

    jobs = {
        'characters': characters,
        'banners': lambda: banners(calendar),
        'events': lambda: events(calendar),
        'challenges': lambda: challenges(calendar),
        'codes': codes,
        'expired': expired,
        'endgame': endgame,
        'farm': farm,
    }
    for key, job in jobs.items():
        if calendar is None and key in ('banners', 'events', 'challenges'):
            continue
        try:
            data[key] = job()
            print('ok', key)
        except Exception as e:
            print(key, 'failed, keeping the old value:', e, file=sys.stderr)

    # The rerun tracker's history: its own file (the Lobby never loads it); kept if it fails.
    try:
        hist = history(data.get('characters', []), data.get('banners', []))
        old_hist = json.loads(HISTORY.read_text(encoding='utf-8')) if HISTORY.exists() else None
        if hist != old_hist:
            HISTORY.write_text(json.dumps(hist, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            print('Wrote', HISTORY)
    except Exception as e:
        print('history failed, keeping the old file:', e, file=sys.stderr)

    # The player lookup's id maps: their own file too; kept if it fails.
    try:
        emap = enka_map()
        if not ENKA_MAP.exists() or json.loads(ENKA_MAP.read_text(encoding='utf-8')) != emap:
            ENKA_MAP.write_text(json.dumps(emap, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            print('Wrote', ENKA_MAP)
    except Exception as e:
        print('enka map failed, keeping the old file:', e, file=sys.stderr)

    # The weapons database: its own file too; kept if it fails.
    try:
        wdb = weapons(full='--weapons-full' in sys.argv)
        if not WEAPONS_OUT.exists() or json.loads(WEAPONS_OUT.read_text(encoding='utf-8')) != wdb:
            WEAPONS_OUT.write_text(json.dumps(wdb, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            print('Wrote', WEAPONS_OUT)
    except Exception as e:
        print('weapons failed, keeping the old file:', e, file=sys.stderr)
    wish_weapons(data.get('banners', []))

    # The wish simulator's pool + art: its own file too; kept if it fails.
    try:
        wp = wish_pool(data.get('characters', []), data.get('banners', []))
        if not WISHPOOL_OUT.exists() or json.loads(WISHPOOL_OUT.read_text(encoding='utf-8')) != wp:
            WISHPOOL_OUT.write_text(json.dumps(wp, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            print('Wrote', WISHPOOL_OUT)
    except Exception as e:
        print('wish pool failed, keeping the old file:', e, file=sys.stderr)

    # The artifact sets: their own file too; kept if it fails.
    try:
        adb = artifacts()
        if not ARTIFACTS_OUT.exists() or json.loads(ARTIFACTS_OUT.read_text(encoding='utf-8')) != adb:
            ARTIFACTS_OUT.write_text(json.dumps(adb, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            print('Wrote', ARTIFACTS_OUT)
    except Exception as e:
        print('artifacts failed, keeping the old file:', e, file=sys.stderr)

    # Birthdays: who each character is, their birthday voice line and newest letter; kept if it fails.
    try:
        bdb = birthdays(data.get('characters', []))
        old_b = json.loads(BIRTHDAYS_OUT.read_text(encoding='utf-8')) if BIRTHDAYS_OUT.exists() else None
        if bdb != old_b:
            BIRTHDAYS_OUT.write_text(json.dumps(bdb, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            print('Wrote', BIRTHDAYS_OUT)
    except Exception as e:
        print('birthdays failed, keeping the old file:', e, file=sys.stderr)

    # Nations: facts, local specialties, bosses; checked once a day; kept if it fails.
    try:
        ndb = nations()
        old_n = json.loads(NATIONS_OUT.read_text(encoding='utf-8')) if NATIONS_OUT.exists() else None
        if ndb != old_n:
            NATIONS_OUT.write_text(json.dumps(ndb, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            print('Wrote', NATIONS_OUT)
    except Exception as e:
        print('nations failed, keeping the old file:', e, file=sys.stderr)

    # Achievements: every category, achievement and tier; kept if it fails.
    try:
        acdb = achievements()
        old_a = json.loads(ACHIEVEMENTS_OUT.read_text(encoding='utf-8')) if ACHIEVEMENTS_OUT.exists() else None
        if acdb != old_a:
            ACHIEVEMENTS_OUT.write_text(json.dumps(acdb, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            print('Wrote', ACHIEVEMENTS_OUT)
    except Exception as e:
        print('achievements failed, keeping the old file:', e, file=sys.stderr)

    # Enemies: the list + the dossier text, two files; checked once a day; kept if it fails.
    try:
        edb, emore = enemies()
        for path, val in ((ENEMIES_OUT, edb), (ENEMIES_MORE, emore)):
            if not path.exists() or json.loads(path.read_text(encoding='utf-8')) != val:
                path.write_text(json.dumps(val, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
                print('Wrote', path)
    except Exception as e:
        print('enemies failed, keeping the old files:', e, file=sys.stderr)

    if data == old:
        print('No change.')
        return
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('Wrote', OUT)


if __name__ == '__main__':
    main()
