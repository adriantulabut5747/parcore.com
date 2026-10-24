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


def codes():
    return [{'code': c['code'], 'rewards': c.get('rewards', []), 'primos': primos(c.get('rewards', []))} for c in get(ENNEAD + 'codes').get('active', [])]


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
    return {m.group(1): m.group(2).strip() for m in re.finditer(r'^\|\s*(\w+)\s*=(.*)$', block, re.M)}


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

    if data == old:
        print('No change.')
        return
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('Wrote', OUT)


if __name__ == '__main__':
    main()
