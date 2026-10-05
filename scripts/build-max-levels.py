"""Build site/coc-max-levels.json: the highest level of every home-village
troop, spell, siege machine, pet, hero and hero equipment at each Town Hall.
The Player Tracker's rushed / max check reads it (site/coc-tracker.js).

Source: the Clash of Clans wiki (clashofclans.fandom.com), read through its
API. Each unit page has a level table; each level needs either a Town Hall
level directly (heroes, equipment) or a building level -- Laboratory, Pet
House, Hero Hall, Blacksmith -- whose own page says which Town Hall that
building level needs. Level 1 comes at the unit's unlock Town Hall
(coc-army-data.json "th").

RE-RUN AFTER EVERY BALANCE PATCH (new levels, new units):
    python scripts/build-max-levels.py
then check the printed sanity lines and commit the JSON. Pages are cached
for a day in your temp folder; add --fresh to ignore the cache.
"""

import json
import os
import re
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
ARMY = REPO / "site" / "coc-army-data.json"
OUT = REPO / "site" / "coc-max-levels.json"
MAX_TH = 18
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36"
CACHE = Path(tempfile.gettempdir()) / "parchrome-wiki-cache"
FRESH = "--fresh" in sys.argv

# Wiki page names that differ from the army maker's unit names.
PAGE = {
    "Lassi": "L.A.S.S.I",
    "P.E.K.K.A": "P.E.K.K.A",
}
# Boosted versions of normal troops: their level follows the base troop, so
# they don't count towards rushed / max.
SUPER = {"Sneaky Goblin", "Rocket Balloon", "Inferno Dragon", "Ice Hound"}


def wikitext(page):
    CACHE.mkdir(exist_ok=True)
    f = CACHE / (re.sub(r"[^A-Za-z0-9]+", "_", page) + ".txt")
    if not FRESH and f.exists() and time.time() - f.stat().st_mtime < 86400:
        return f.read_text(encoding="utf-8")
    url = "https://clashofclans.fandom.com/api.php?" + urllib.parse.urlencode(
        {"action": "parse", "page": page, "prop": "wikitext", "format": "json", "redirects": 1}
    )
    data = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30))
    text = data["parse"]["wikitext"]["*"] if "parse" in data else ""
    # Pages with a Home Village / Builder Base tab hold the home table on a subpage.
    sub = re.search(r"\{\{:([^}|]+/Home Village)\}\}", text)
    if sub:
        text = wikitext(sub.group(1))
    f.write_text(text, encoding="utf-8")
    return text


def clean(cell):
    """Wiki cell -> plain text: drop attributes, links, templates, tags."""
    if "|" in cell and not cell.startswith("[[") and "=" in cell.split("|")[0]:
        cell = cell.split("|", 1)[1]  # class="..."|value
    cell = re.sub(r"\{\{[^{}]*\}\}", "", cell)
    cell = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", cell)
    cell = re.sub(r"<[^>]+>", " ", cell)
    return cell.replace("&nbsp;", " ").strip()


def tables(text):
    """Every {| ... |} table as (headers, rows); rowspan cells are repeated
    down the rows they cover, so each row has a value in every column."""
    out = []
    for body in re.findall(r"\{\|(.*?)\n\|\}", text, re.S):
        headers, rows, row, spans = [], [], None, {}
        for line in body.split("\n")[1:]:
            line = line.strip()
            if line.startswith("|-"):
                if row is not None:
                    rows.append(row)
                row = []
                continue
            if line.startswith("!") and not row:  # header lines (some tables open with "|-")
                for h in re.split(r"!!", line[1:]):
                    headers.append(clean(h))
                continue
            if line.startswith("|") and not line.startswith("|}") and row is not None:
                for c in re.split(r"\|\|", line[1:]):
                    # fill columns still covered by a rowspan from above
                    while len(row) in spans:
                        v, n = spans[len(row)]
                        row.append(v)
                        spans[len(row) - 1] = (v, n - 1) if n > 2 else None
                        if spans[len(row) - 1] is None:
                            del spans[len(row) - 1]
                    m = re.match(r'\s*rowspan="?(\d+)"?[^|]*\|', c)
                    v = clean(c)
                    if m and int(m.group(1)) > 1:
                        spans[len(row)] = (v, int(m.group(1)))
                    row.append(v)
        if row:
            rows.append(row)
        out.append((headers, rows))
    return out


def num(s):
    m = re.search(r"\d+", s or "")
    return int(m.group()) if m else None


def level_table(text, req_words):
    """{level: requirement} from the first table with a "Level" column and a
    "<req_words> Level Required" (or "Town Hall Level") column."""
    for headers, rows in tables(text):
        if not headers or not re.match(r"Level\b", headers[0]):
            continue
        col = None
        for words in req_words:
            for i, h in enumerate(headers):
                if words in h and ("Required" in h or words == "Town Hall"):
                    col = i
                    break
            if col is not None:
                break
        if col is None:
            continue
        res = {}
        for r in rows:
            if len(r) > col and num(r[0]):
                res[num(r[0])] = num(r[col])
        if res:
            return res, words
    return None, None


def building_th(page):
    """{building level: Town Hall level required}"""
    t, _ = level_table(wikitext(page), ["Town Hall"])
    return t or {}


def blacksmith_caps():
    """[(Town Hall needed, common cap, epic cap)] per Blacksmith level. Its
    table has a two-row header (Ore Capacity x3, Maximum Equipment Level
    Common / Epic), so the columns are read by position and checked."""
    for headers, rows in tables(wikitext("Blacksmith")):
        if "Maximum Equipment Level" not in " ".join(headers):
            continue
        caps = []
        for r in rows:
            if len(r) >= 12 and num(r[0]):
                caps.append((num(r[11]), num(r[6]), num(r[7])))
        if caps and all(th and c and e and th <= MAX_TH for th, c, e in caps):
            return caps
    raise SystemExit("Blacksmith table changed shape -- update blacksmith_caps()")


def main():
    army = json.loads(ARMY.read_text(encoding="utf-8"))
    rarity = {e["name"]: e["rarity"] for e in json.loads((REPO / "site" / "coc-equipment.json").read_text(encoding="utf-8"))["equipment"]}
    caps = blacksmith_caps()
    print("Blacksmith caps (TH, common, epic):", caps)
    buildings = {b: building_th(b) for b in ["Laboratory", "Pet House", "Hero Hall"]}
    for b, t in buildings.items():
        print(f"{b}: {len(t)} levels, needs TH {min(t.values() or [0])}-{max(t.values() or [0])}")

    groups = {
        "heroes": ["Town Hall", "Hero Hall"],
        "pets": ["Pet House"],
        "troops": ["Laboratory"],
        "sieges": ["Laboratory"],
        "spells": ["Laboratory"],
    }
    th_max = {str(th): {} for th in range(1, MAX_TH + 1)}
    problems = []
    for group, req in groups.items():
        for u in army[group]:
            name = u["name"]
            if group == "troops" and (name.startswith("Super ") or name in SUPER):
                continue
            page = PAGE.get(name, name + (" Spell" if group == "spells" and not name.endswith("Spell") else ""))
            table, by = level_table(wikitext(page), req)
            if not table:
                problems.append(f"{name}: no level table on '{page}'")
                continue
            unlock = u.get("th") or 1
            # requirement -> Town Hall for each level
            need = {}
            for lvl, r in table.items():
                if lvl == 1 or r is None:
                    need[lvl] = unlock if lvl == 1 else None
                elif by == "Town Hall":
                    need[lvl] = r
                else:
                    need[lvl] = buildings[by].get(r)
            for lvl in sorted(need):
                if need[lvl] is None and lvl > 1:
                    problems.append(f"{name} level {lvl}: unknown requirement")
            for th in range(1, MAX_TH + 1):
                best = 0
                for lvl, t in need.items():
                    if t is not None and t <= th and th >= unlock and lvl > best:
                        best = lvl
                if best:
                    th_max[str(th)][name] = best

    # Equipment: the Blacksmith caps every Common / Epic item at each Town Hall.
    for e in army["equipment"]:
        epic = rarity.get(e["name"]) == "Epic"
        if e["name"] not in rarity:
            problems.append(f"{e['name']}: not in coc-equipment.json (rarity unknown)")
            continue
        for th in range(1, MAX_TH + 1):
            if th < (e.get("th") or 1):
                continue
            best = max([(ep if epic else co) for t, co, ep in caps if t <= th] or [0])
            if best:
                th_max[str(th)][e["name"]] = best

    doc = {
        "_readme": "Max level of every home troop, spell, siege, pet, hero and hero equipment at each Town Hall "
        "(super troops left out). Built by scripts/build-max-levels.py from the Clash of Clans wiki -- "
        "re-run it after every balance patch. Read by the Player Tracker's rushed / max check (coc-tracker.js).",
        "updated": time.strftime("%Y-%m-%d"),
        "th": th_max,
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(REPO)}: TH18 has {len(th_max['18'])} units")
    for name in ["Barbarian", "Barbarian King", "Archer Queen", "Lightning", "Electro Owl", "Wall Wrecker", "Giant Gauntlet", "Barbarian Puppet"]:
        print(f"  {name}: " + ", ".join(f"TH{th} {th_max[str(th)].get(name, '-')}" for th in (10, 13, 15, 16, 17, 18)))
    if problems:
        print("\nPROBLEMS (check these pages):")
        for p in problems:
            print("  " + p)


if __name__ == "__main__":
    main()
