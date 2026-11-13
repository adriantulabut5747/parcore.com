# Helpers for writing Genshin character pages (how-to: docs/genshin-character-pages.md). Run from the repo root.
#
#   python _tools/genshin/character-kit.py research Pyro      kits + every usable weapon's passive + set bonuses, for drafting (writes to the path given by --out, else stdout)
#   python _tools/genshin/character-kit.py videos "Hu Tao"    Zy0x's videos that mention a character (two searches: one alone misses guides)
#   python _tools/genshin/character-kit.py video hu-tao <id>  writes that video into scripts/genshin-builds.json (title + date from YouTube; note + thumb worked out)
#   python _tools/genshin/character-kit.py check [slugs]      checks builds + pages: names, shape, weapon sources against the wiki, leftover tags, chips, overflow
#
# `check` needs python _tools/serve.py running for its phone overflow test. Set PYTHONIOENCODING=utf-8 on Windows.
import datetime, json, os, re, subprocess, sys, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SITE = REPO / 'site'
BUILDS = REPO / 'scripts' / 'genshin-builds.json'
PAGES = SITE / 'genshin-impact' / 'characters'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
UA = {'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en'}

load = lambda name: json.loads((SITE / name).read_text(encoding='utf-8'))
slug = lambda name: re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
fetch = lambda url: urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read().decode('utf-8', 'ignore')
clean = lambda s: re.sub(r'\{[^}]*\}|\[\[|\]\]', '', re.sub(r'<[^>]+>', '', s or '')).replace('\\n', ' ')
roster = lambda: load('genshin-feed.json')['characters']


def research(element, out=None):
    lines = []
    chars = [c for c in roster() if c.get('element') == element]
    for c in chars:
        d = json.loads(fetch(f'https://gi.yatta.moe/api/v2/en/avatar/{c["id"]}'))['data']
        lines.append(f'\n##### {c["name"]} ({slug(c["name"])}) {c["rarity"]}* {c["weapon"]} region={c["region"]!r} body={d.get("bodyType")} ascension={d.get("specialProp")} affiliation={d["fetter"].get("native")}')
        for k, t in sorted(d['talent'].items(), key=lambda kv: int(kv[0])):
            rows = [x.split('|')[0] for x in (next(iter((t.get('promote') or {}).values()), {}).get('description') or []) if x]
            lines.append(f'T{t["type"]} {t["name"]} cd={t.get("cooldown")} cost={t.get("cost")}: {clean(t["description"])[:900]}')
            if rows:
                lines.append('   scales: ' + ' / '.join(clean(r) for r in rows))
        for k, x in sorted(d['constellation'].items(), key=lambda kv: int(kv[0])):
            lines.append(f'C{int(k) + 1} {x["name"]}: {clean(x["description"])[:260]}')
    types = {c['weapon'] for c in chars}
    for w in sorted(load('genshin-weapons.json')['weapons'], key=lambda w: (w['type'], -w['rarity'], w['name'])):
        if w['type'] in types and w['rarity'] >= 3:
            p = w.get('passive') or {}
            text = p.get('t') or ' '.join(p.get('r', [])[:1])
            for i, v in enumerate(p.get('v') or []):
                text = text.replace('{%d}' % i, f'{v[0]}/{v[-1]}')
            lines.append(f'W {w["type"]} {w["rarity"]}* {w["name"]} | {w["sub"]} {w["stats"][-1][3]} ATK{w["stats"][-1][2]} | {clean(text)[:520]}')
    for a in load('genshin-artifacts.json')['sets']:
        lines.append(f'S {a["name"]} | ' + ' / '.join(f'{p}: {t}' for p, t in a['bonus'])[:520])
    text = '\n'.join(lines)
    if out:
        Path(out).write_text(text, encoding='utf-8')
        print('Wrote', out)
    else:
        print(text)


def channel_search(query):
    s = fetch('https://www.youtube.com/@Zy0x/search?query=' + urllib.parse.quote(query))
    found = []

    def walk(x):
        if isinstance(x, dict):
            if 'videoId' in x and isinstance(x.get('title'), dict):
                found.append((x['videoId'], (x['title'].get('runs') or [{}])[0].get('text') or x['title'].get('simpleText'), (x.get('publishedTimeText') or {}).get('simpleText')))
            [walk(v) for v in x.values()]
        elif isinstance(x, list):
            [walk(v) for v in x]
    walk(json.loads(re.search(r'var ytInitialData = (\{.*?\});</script>', s).group(1)))
    return found


def videos(names):
    for name in names:
        word = name.split()[-1].lower()
        hits = dict.fromkeys(v for q in (name, f'complete {name} guide', f'{name} build') for v in channel_search(q) if word in (v[1] or '').lower())
        print('##', name)
        for v in hits:
            print('  ', v)


def video(s, vid):
    builds = json.loads(BUILDS.read_text(encoding='utf-8'))
    b = builds[s]
    r = {c['name']: c for c in roster()}
    hist = load('genshin-history.json')['banners']
    title = json.loads(fetch(f'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={vid}&format=json'))['title']
    date = re.search(r'"publishDate":"(\d{4}-\d{2}-\d{2})', fetch(f'https://www.youtube.com/watch?v={vid}')).group(1)
    ts = datetime.datetime.fromisoformat(date).replace(tzinfo=datetime.timezone.utc).timestamp()
    me = next(n for n in r if slug(n) == s)
    newer = sorted(({m[0] for t in b['build']['teams'] for m in t['members']} - {me}), key=lambda n: r[n]['release'])
    newer = [n for n in newer if r[n]['release'] > ts]
    version = max((h for h in hist if h['start'] <= ts), key=lambda h: h['start'])['version']
    before = '' if not newer else ', before ' + (' and '.join(newer) if len(newer) < 3 else f'{newer[0]}, {newer[1]} and others') + ' came out'
    b['video'] = {'id': vid, 'title': title, 'by': 'Zy0x', 'channel': 'https://www.youtube.com/@Zy0x', 'date': date, 'note': f'Made in v{version}{before}.'}
    try:
        fetch(f'https://i.ytimg.com/vi/{vid}/maxresdefault.jpg')
    except urllib.error.HTTPError:
        b['video']['thumb'] = 'hqdefault'
    BUILDS.write_text(json.dumps(builds, ensure_ascii=False, indent=2), encoding='utf-8', newline='\n')
    print(json.dumps(b['video'], ensure_ascii=False, indent=2))


def wiki_source(name):
    url = 'https://genshin-impact.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=' + urllib.parse.quote(name.replace('"', ''))
    try:
        text = json.loads(fetch(url))['parse']['wikitext']['*']
    except Exception:
        return name, []
    return name, [x.strip() for x in re.findall(r'\|\s*obtain\d?\s*=\s*([^\n|]*)', text) if x.strip()]


FROM_WIKI = {'Wish': ('Wishes', 'Weapon Event Wishes', 'Chronicled Wishes'), 'Craftable': ('Forging',), 'Battle Pass': ('Battle Pass',), 'Event': ('Events',), 'Chests': ('Chests',), 'Fishing': ('Fishing',), 'Quest': ('Quests',)}


def check_builds(slugs):
    builds = json.loads(BUILDS.read_text(encoding='utf-8'))
    weapons = {w['name'] for w in load('genshin-weapons.json')['weapons']}
    sets = {a['name'] for a in load('genshin-artifacts.json')['sets']}
    r = {c['name']: c for c in roster()}
    problems, picked = [], {}
    for s in slugs:
        b = builds.get(s)
        if not b:
            problems.append(f'{s}: no build entry')
            continue
        me = next(n for n in r if slug(n) == s)
        bb = b['build']
        for key, want in (('weapons', 5), ('sets', 5)):
            if len(bb[key]) != want:
                problems.append(f'{s}: {len(bb[key])} {key}, Ayaka has {want}')
        if not 3 <= len(bb['teams']) <= 4:  # Adrian, Nov 4 2026: drop a team rather than pad with an unsourced one
            problems.append(f'{s}: {len(bb["teams"])} teams, needs 3-4')
        for k in ('role', 'summary', 'cons', 'consNote'):
            if not b.get(k):
                problems.append(f'{s}: no {k}')
        if not 3 <= len(b.get('similar') or []) <= 4:
            problems.append(f'{s}: similar needs 3-4')
        if not b.get('video'):
            problems.append(f'{s}: no video (fine only if Zy0x has no guide: tell Adrian)')
        problems += [f'{s}: unknown weapon {w["name"]}' for w in bb['weapons'] if w['name'] not in weapons]
        problems += [f'{s}: unknown set {x}' for st in bb['sets'] for x in (st['name'], st.get('with')) if x and x not in sets]
        problems += [f'{s}: unknown member {m[0]}' for t in bb['teams'] for m in t['members'] if m[0] not in r]
        problems += [f'{s}: unknown similar {n}' for n, _ in b.get('similar') or [] if n not in r]
        problems += [f'{s}: team {t["name"]} leaves them out' for t in bb['teams'] if me not in [m[0] for m in t['members']]]
        for w in bb['weapons']:
            picked.setdefault(w['name'], set()).add((s, w['from']))
    with ThreadPoolExecutor(8) as ex:
        for name, wiki in ex.map(wiki_source, sorted(picked)):
            for s, frm in picked[name]:
                if wiki and not set(wiki) & set(FROM_WIKI.get(frm, ())):
                    problems.append(f'{s}: {name} says "{frm}", the wiki says {wiki}')
    return problems


def check_pages(slugs):
    problems = []
    for s in slugs:
        f = PAGES / f'{s}.html'
        if not f.exists():
            problems.append(f'{s}: not generated')
            continue
        h = f.read_text(encoding='utf-8')
        main = h[h.index('<main') : h.index('</main>')].split('id="cpData"')[0]
        count = lambda p: len(re.findall(p, main))
        if re.search(r'\{LINK|\{/LINK|\{param|\{LAYOUT|&lt;color|\\n|>rowspan<', main):
            problems.append(f'{s}: leftover game tags')
        if re.search(r'<h3>\s*</h3>', main):
            problems.append(f'{s}: nameless talent')
        chips, cons = count(r'class="is-con"><small>C'), count(r'<p class="cp-kind">C\d')
        if s != 'aloy' and (chips != 2 or cons != 6):  # Aloy has no constellations
            problems.append(f'{s}: {chips} "+3 levels" chips (expected 2), {cons} constellations (expected 6)')
        if 'is-book' not in main:
            problems.append(f'{s}: no talent book tile')
        if 'cp-cv-nc' not in main:
            problems.append(f'{s}: no namecard')
        tiles = count(r'class="cp-fi"')
        if tiles != 6:
            problems.append(f'{s}: {tiles} farm tiles, expected 6')
        if 'Source not listed yet' in main:
            problems.append(f'{s}: a boss material has no source')
    return problems


def overflow(slugs):
    probe = SITE / '_probe.html'  # temporary, always removed
    out = []
    try:
        for i in range(0, len(slugs), 7):
            probe.write_text("""<!doctype html><html><body style="margin:0"><script>
const res=[];const S=%s;S.forEach((s,i)=>{const f=document.createElement('iframe');
f.src='/genshin-impact/characters/'+s;f.style.cssText='width:375px;height:800px;border:0';document.body.appendChild(f);
f.onload=()=>setTimeout(()=>{const d=f.contentWindow.document;res[i]=s+':'+d.documentElement.scrollWidth+':'+f.contentWindow.innerWidth;document.title=res.join(' ')},5000)});
</script></body></html>""" % json.dumps(slugs[i : i + 7]), encoding='utf-8')
            r = subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=E:\\claude-tmp\\chrome-prof', '--virtual-time-budget=20000', '--window-size=1600,1000', '--dump-dom', 'http://localhost:8765/_probe.html'], capture_output=True, timeout=180)
            m = re.search(r'<title>(.*?)</title>', r.stdout.decode('utf-8', 'ignore'))
            for part in (m.group(1).split() if m else []):
                s, w, inner = part.split(':')
                if int(w) > int(inner):
                    out.append(f'{s}: scrolls sideways on a phone ({w} > {inner})')
            if not m:
                out.append('overflow test got no result: is python _tools/serve.py running?')
    finally:
        probe.unlink(missing_ok=True)
    return out


def check(slugs):
    slugs = slugs or sorted(f.stem for f in PAGES.glob('*.html') if f.stem != 'index')
    problems = check_builds(slugs) + check_pages(slugs) + overflow(slugs)
    print('\n'.join(problems) if problems else f'All clear: {len(slugs)} pages')
    print(f'\nChecked {len(slugs)}. Not checked here (do by hand): whether the picks and notes are right, and a look at screenshots.')


if __name__ == '__main__':
    args = sys.argv[1:]
    if args[:1] == ['research']:
        research(args[1], args[args.index('--out') + 1] if '--out' in args else None)
    elif args[:1] == ['videos']:
        videos(args[1:])
    elif args[:1] == ['video']:
        video(args[1], args[2])
    elif args[:1] == ['check']:
        check(args[1:])
    else:
        sys.exit(__doc__ or 'See the top of this file for usage.')
