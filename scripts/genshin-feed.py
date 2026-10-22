# Builds the Genshin Impact lobby's live data (/genshin-impact/):
#   site/genshin-feed.json              -- wishes, events, endgame, codes, farm schedule, birthdays
#   site/images/genshin/splash/*.webp   -- the official wish art of each featured 5-star
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
SPLASH = ROOT / 'images' / 'genshin' / 'splash'
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


def characters():
    items = yatta('avatar')['items'].values()
    out = []
    for c in items:
        if str(c['id']).startswith(('10000005', '10000007')):  # Traveler: no birthday, two entries
            continue
        out.append({
            'id': c['id'], 'name': c['name'], 'rarity': c['rank'], 'icon': icon(c['icon']),
            'element': ELEMENTS.get(c['element'], c['element']), 'weapon': WEAPONS.get(c['weaponType'], ''),
            'birthday': c.get('birthday') or None, 'release': c.get('release'),
            'region': REGIONS.get(c.get('region'), ''),
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
    return entry


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
    """Talent books + weapon materials by weekday (Mon=Thu, Tue=Fri, Wed=Sat), with who uses each book."""
    schedule = yatta('dailyDungeon')
    mats = yatta('material')['items']
    out = {}
    for day in DAYS:
        books, weapons = [], []
        for d in schedule[day].values():
            ids = [i for i in d['reward'] if i > 100000]
            if not ids:
                continue
            top, low = mats[str(max(ids))], mats[str(min(ids))]
            city = CITIES.get(d['city'], '')
            if 'Mastery' in d['name']:
                users = yatta('material/%s' % min(ids)).get('additions', {}).get('requiredBy', {}).get('avatar', [])
                seen, who = set(), []
                for u in users:
                    if u['name'] != 'Traveler' and u['name'] not in seen:
                        seen.add(u['name'])
                        who.append({'name': u['name'], 'rarity': u['rank'], 'icon': icon(u['icon'])})
                books.append({'city': city, 'series': low['name'].replace('Teachings of ', ''), 'icon': icon(top['icon']), 'users': who})
            else:
                weapons.append({'city': city, 'name': low['name'], 'icon': icon(top['icon'])})
        out[day] = {'books': books, 'weapons': weapons}
    return out


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
                          'halves': [foes(enemies.get('enemies%d_%d' % (c, h), '')) for h in (1, 2)]}
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

    if data == old:
        print('No change.')
        return
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('Wrote', OUT)


if __name__ == '__main__':
    main()
