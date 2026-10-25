"""Event (temporary) troops for site/coc-army-data.json -> "eventTroops".

Copy Army links carry event troops too (Lavaloon = 104, YEETer = 159...), but
the army maker's lists only hold permanent units, so army-sheet.js dropped
them: a Lavaloon army drew as one Balloon. This writes them as their own list,
which army-sheet.js reads for drawing only (the maker never offers them).

Sources:
- ids + names: coc.py's static data (troops with "is_seasonal")
- housing space: the Clash of Clans wiki's Statistics table (coc.py's numbers
  are stale for some: Lavaloon is 21 there, 35 in coc.py); coc.py's is the
  fallback, flagged in the output
- icons: ClashKing's assets repo (assets/troops/<name>/icon.webp, the same art
  as our units/ icons), saved as units/event-<name>.webp at 128 px

Re-run after a new event troop ships:  python scripts/build-event-troops.py
Needs Pillow.
"""

import io
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'site'
DATA = ROOT / 'coc-army-data.json'
UNITS = ROOT / 'clashofclans' / 'coctools' / 'units'
COCPY = 'https://raw.githubusercontent.com/mathsman5133/coc.py/master/coc/static/static_data.json'
CK_TREE = 'https://api.github.com/repos/ClashKingInc/ClashKingAssets/git/trees/main?recursive=1'
CK_RAW = 'https://raw.githubusercontent.com/ClashKingInc/ClashKingAssets/main/'
WIKI = 'https://clashofclans.fandom.com/api.php?'
UA = 'ParchromeBot/1.0 (https://parchrome.netlify.app; wildparchrome@gmail.com)'


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
        return r.read()


def slug(name, sep):
    # dots go first: C.O.O.K.I.E -> cookie (ClashKing's folder), not c_o_o_k_i_e
    return re.sub(r'[^a-z0-9]+', sep, name.lower().replace('.', '')).strip(sep)


def wiki_housing(name):
    """The Housing Space cell of the page's first Statistics table, or None."""
    q = urllib.parse.urlencode({'action': 'parse', 'page': name, 'prop': 'wikitext', 'format': 'json', 'redirects': 1})
    try:
        text = json.loads(get(WIKI + q))['parse']['wikitext']['*']
    except Exception:
        return None
    for table in re.findall(r'\{\|.*?\|\}', text, re.S):
        rows = re.split(r'\n\|-', table)
        heads = [l for l in rows[0].splitlines() if l.startswith('!')]
        col = next((i for i, h in enumerate(heads) if 'Housing Space' in h), None)
        if col is None or len(rows) < 2:
            continue
        cells = [re.sub(r'^\|(?:[^|]*\|)?', '', l).strip() for l in rows[1].splitlines() if l.startswith('|')]
        m = re.match(r'\d+', cells[col]) if col < len(cells) else None
        if m:
            return int(m.group())
    return None


def main():
    troops = [t for t in json.loads(get(COCPY))['troops'] if t.get('is_seasonal') and t.get('village') == 'home']
    ck = {p.split('/')[2] for p in (x['path'] for x in json.loads(get(CK_TREE))['tree']) if p.startswith('assets/troops/') and p.endswith('/icon.webp')}
    out = []
    for t in sorted(troops, key=lambda t: t['_id']):
        name = t['name']
        space = wiki_housing(name)
        note = ''
        if space is None:
            space, note = t['housing_space'], '  (housing from coc.py: not found on the wiki)'
        img = 'event-' + slug(name, '-') + '.webp'
        if slug(name, '_') in ck:
            if not (UNITS / img).exists():
                icon = Image.open(io.BytesIO(get(CK_RAW + 'assets/troops/' + slug(name, '_') + '/icon.webp'))).convert('RGBA')
                icon.resize((128, 128), Image.LANCZOS).save(UNITS / img, 'WEBP', quality=90)
        else:
            img, note = None, note + '  (no ClashKing icon: drawn as "?")'
        out.append({'id': t['_id'] - 4000000, 'name': name, 'space': space, 'img': img})
        print(f"{out[-1]['id']:>4} {name:<20} {space:>3}{note}")
    # Only the eventTroops block (always last) is rewritten, so the rest of
    # the hand-formatted file keeps its layout.
    text = DATA.read_text(encoding='utf8')
    cut = text.find(',\n  "eventTroops"')
    head = (text[:cut] if cut != -1 else text.rstrip()[:-1]).rstrip()
    block = json.dumps(out, indent=2, ensure_ascii=False).replace('\n', '\n  ')
    DATA.write_text(head + ',\n  "eventTroops": ' + block + '\n}\n', encoding='utf8')
    print(len(out), 'event troops ->', DATA)


if __name__ == '__main__':
    main()
