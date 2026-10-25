# Genshin character pages: how to make one

How `/genshin-impact/characters/<slug>` pages are made, and the exact steps to add the next character.
Read this before touching `scripts/genshin-characters.py`, `scripts/genshin-builds.json`,
`site/genshin-character.css/.js` or anything in `site/genshin-impact/characters/`.
The design history (why the page looks the way it does) is in `docs/genshin-handoff.md`, section 7 page 9.

**Status (Oct 25 2026):** one page exists, the pilot, **Kamisato Ayaka**
(`/genshin-impact/characters/kamisato-ayaka`). Adrian is still working on the front end. **Don't generate
every character until he says the design is final**: each design change would then have to be checked on
120 pages instead of one. Build one character at a time, the way he asks.

---

## 1. The one rule: never copy or hand-edit a character page

Every character page is **written by a generator**. There is no template file to duplicate.

```
scripts/genshin-characters.py   reads   yatta (online) + our site/genshin-*.json files + scripts/genshin-builds.json
                                writes  site/genshin-impact/characters/<slug>.html   (one finished page per character)
```

- To change what's on **every** page: edit `scripts/genshin-characters.py` (markup) or
  `site/genshin-character.css` / `.js` (look / behaviour), then rerun the generator.
- To change **one character's build**: edit their entry in `scripts/genshin-builds.json`, then rerun for that slug.
- Never edit a generated `.html`: the next run overwrites it.

Why a generator and not one page that loads data with JavaScript: every word (talents, constellations,
materials, build) is in the HTML, so Google can index 120+ pages. Only the live bits ("Open today", the birthday countdown, wish history) are filled in by `genshin-character.js` in the
browser.

---

## 2. Files

| File | What it is | Hand-edited? |
|---|---|---|
| `scripts/genshin-characters.py` | The generator. All page markup lives here. | Yes |
| `scripts/genshin-builds.json` | Builds, teams and videos, one entry per character (section 4). | Yes: Adrian checks every entry |
| `site/genshin-character.css` | Look of every character page (`.cp-*` classes). | Yes |
| `site/genshin-character.js` | Live parts + interaction: talent sliders, goal planner, phone Talents/Constellations tabs, video player, farm "Open today", wish history. | Yes |
| `site/genshin-impact/characters/<slug>.html` | Generated pages. | **Never** |
| `site/genshin-impact/characters/index.html` | The Characters list page. **Also the shell** the generator copies (head, bars, sidebar, footer, More sheet). | Yes (it's the list page) |
| `scripts/genshin-feed.py` | The feed script. The generator imports its helpers (`get`, `yatta`, `icon`, `game_text`). Its own files feed the generator (next row). | Yes |
| `site/genshin-feed.json`, `genshin-weapons.json`, `genshin-artifacts.json`, `genshin-enemies.json`, `genshin-nations.json`, `genshin-birthdays.json`, `genshin-history.json` | Written by the feed script. The generator reads them (roster, farm days, weapon/set names + icons, boss drops, specialties, namecards, wish history). | Never |

Where each part of a page comes from:

| On the page | Source |
|---|---|
| Name, element, weapon, nation, rarity, release date | `genshin-feed.json` `characters` |
| Cover picture (namecard), title | `genshin-birthdays.json` `people[id].namecard`; yatta `avatar/{id}` `fetter` |
| Face circle | the feed's `icon` (yatta `UI_AvatarIcon_*`, hotlinked) |
| Wish history (incl. days since her last banner) | `genshin-history.json` (in the browser) |
| Farm strip | feed `farm` (talent book + days), `genshin-enemies.json` (who drops the boss / common materials), `genshin-nations.json` (specialty) |
| Best build, teams, video, similar characters | `scripts/genshin-builds.json` |
| Talents, scaling tables, constellations, materials, base stats | yatta `avatar/{id}` + `static/avatarCurve` |
| Her story (desktop card) | yatta `avatarFetter/{id}` (`fetter.detail` + the "Character Details" story) |

---

## 3. Adding the next character, step by step

### Step 1: find the slug

The slug is the full in-game name, lowercased, every run of other characters turned into one `-`:
`Kamisato Ayaka` → `kamisato-ayaka`, `Hu Tao` → `hu-tao`, `Raiden Shogun` → `raiden-shogun`.
It's the same slug the Rerun tracker uses (`/genshin-impact/reruns#c-<slug>`), so never change the formula.

List every valid slug:

```bash
cd parcore.com
python -c "import json,re;[print(re.sub(r'[^a-z0-9]+','-',c['name'].lower()).strip('-')) for c in json.load(open('site/genshin-feed.json',encoding='utf8'))['characters'] if c.get('element')]"
```

The Traveler has no element in the feed and is skipped on purpose: their page needs its own design
(one page with an element switch). Don't force it through the generator.

### Step 2: make sure our data has them

A character added in the latest patch may not be in our files yet. Run the feed script once
(`python scripts/genshin-feed.py`, about 50 s, needs `pip install pillow`) if any of these is missing:

- their entry in `site/genshin-feed.json` `characters`, with a `strip` path (the generator stops with
  `unknown slug` if they aren't in the roster)
- their namecard in `site/genshin-birthdays.json` `people` (without it the cover is plain dark grey)
- their talent book in feed `farm` (without it the farm strip has no book tile)

### Step 3: write their build in `scripts/genshin-builds.json`

Without an entry the page still generates, minus the Best build, Best teams and Video blocks (the title
changes to "talents, materials & constellations"). Every character Adrian wants live gets an entry.

**Where the picks come from (Adrian's rules):**
- **The builds are Adrian's own.** Other sites (Game8, genshintrack.com, KQM, GameWith) are only a reference
  for what the community runs; our picks differ from each of them. **Never credit them or name them on the
  page** (no "checked against ..." line): the builds aren't theirs, and they aren't copied from them.
- When drafting an entry, **flag anything that looks wrong or out of date** for Adrian.
  He is the final fact-check, and nothing ships until he has seen the flags.
- Facts (weapon substats, set bonuses, which boss drops what, talent book days) come from **our own data
  files, never from the guide**. Ayaka's guide said La Signora drops Bloodjade Branch; our enemies file says
  Azhdaha, and the data was right.
- **Write every sentence in our own words.** Never copy another site's text, and keep notes short.

**Shape** (copy Ayaka's entry and change it):

```json
"<slug>": {
  "checked": "2026-10-25",                       // date Adrian last checked this entry (shown as "Checked Oct 25, 2026")
  "role": "On-field Cryo DPS",                   // card's Role row
  "summary": "Two or three plain sentences on how she plays.",   // desktop card, under the info rows
  "cons": "Low",                                 // constellation priority (Constellations block)
  "consNote": "C0 does the job. ...",            // one line after it
  "tags": ["Main DPS", "Freeze", "Burst"],       // not shown right now (kept for later)
  "similar": [                                   // optional: the "Similar to <name>" cards at the page's foot (3-4)
    ["Kamisato Ayato", "Her older brother, head of the clan"]   // [feed roster name, one short line on why]
  ],                                             // pick family / same group first, then same role + element
  "video": {                                     // optional: no video block without it
    "id": "NQ0jKm7qu6o", "title": "...", "by": "Zy0x", "channel": "https://www.youtube.com/@Zy0x",
    "date": "2023-03-22", "note": "Made in v3.5, before Furina and Escoffier came out."   // note is optional
  },
  "build": {
    "name": "Freeze DPS",                        // shown beside "Best build"
    "level": 90,                                 // not shown right now
    "weapons": [                                 // exactly 5, best first
      { "name": "Mistsplitter Reforged", "tag": "BiS", "from": "Wish", "r": 1, "note": "Hover text." }
    ],                                           // tag: "BiS" (red) | "Alt 5★" | "4★" | "F2P"; from: Wish / Craftable / Battle Pass / ...; r = refinement
    "sets": [                                    // exactly 5 rows, best first
      { "name": "Blizzard Strayer", "pc": 4, "best": true, "note": "Hover text." },
      { "name": "Marechaussee Hunter", "pc": 4, "when": "With Furina or Escoffier", "note": "..." },   // when = shown under the name
      { "name": "Blizzard Strayer", "pc": 2, "with": "Gladiator's Finale", "note": "..." }           // a 2pc + 2pc row
    ],
    "mains": { "Sands": "ATK%", "Goblet": "Cryo DMG Bonus", "Circlet": "CRIT DMG" },
    "subs": ["CRIT DMG", "Energy Recharge", "ATK%", "CRIT Rate"],                 // in priority order
    "talents": [ { "k": "burst", "lv": 10, "why": "Shown in that talent's panel." } ],   // k: normal | skill | burst | sprint
    "targets": [ { "stat": "Energy Recharge", "min": 130, "max": 140, "unit": "%", "note": "", "scale": [100, 200] } ],  // scale/note: not shown right now
    "teams": [                                   // 4 teams fill the 2x2 grid
      { "name": "Classic Freeze", "tier": "Premium", "members": [["Kamisato Ayaka", "Main DPS"], ["Shenhe", "Support"], ["...", "..."], ["...", "..."]], "note": "One line on why it works." }
    ]                                            // tier "F2P" gets the outlined tag; any other text the grey one
  }
}
```

(The `//` comments are for this doc only: JSON allows no comments.)

**Names must match our files exactly**, or the generator crashes with a `KeyError` naming the missing one.
Weapon names come from `site/genshin-weapons.json`, set names from `site/genshin-artifacts.json`, and team
members from the feed roster (full names: "Kaedehara Kazuha", not "Kazuha"). Check a name:

```bash
python -c "import json,sys;q=sys.argv[1].lower();d=json.load(open('site/genshin-weapons.json',encoding='utf8'))['weapons'];a=json.load(open('site/genshin-artifacts.json',encoding='utf8'))['sets'];r=json.load(open('site/genshin-feed.json',encoding='utf8'))['characters'];print([x['name'] for x in d+a+r if q in x['name'].lower()])" shimenawa
```

### Step 4: the video (Zy0x's newest guide for that character)

Adrian's rule: every character page embeds **Zy0x's latest build guide** for that character.

First, list his videos that mention the character. Use YouTube's own channel search; web search engines
miss YouTube. Run this from your scratch folder (it writes `zy.html` there) and change `ayaka`:

```bash
curl -s -A "Mozilla/5.0" -H "Accept-Language: en" "https://www.youtube.com/@Zy0x/search?query=ayaka" -o zy.html
python - <<'EOF'
import json, re
s = open('zy.html', encoding='utf8', errors='ignore').read()
data = json.loads(re.search(r'var ytInitialData = (\{.*?\});</script>', s).group(1))
found = []
def walk(x):
    if isinstance(x, dict):
        if 'videoId' in x and isinstance(x.get('title'), dict):
            title = (x['title'].get('runs') or [{}])[0].get('text') or x['title'].get('simpleText')
            found.append((x['videoId'], title, (x.get('publishedTimeText') or {}).get('simpleText')))
        for v in x.values():
            walk(v)
    elif isinstance(x, list):
        for v in x:
            walk(v)
walk(data)
for v in dict.fromkeys(found):
    print(v)
EOF
```

Then:

1. Pick the newest **guide** (titles like "COMPLETE / ULTIMATE / UPDATED <NAME> GUIDE"), not a review or a
   pull video. Get its exact date: `curl -s -A "Mozilla/5.0" "https://www.youtube.com/watch?v=<id>" | grep -o '"publishDate":"[^"]*"'`.
2. Confirm the video exists and copy its exact title: `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json`.
3. If it's old enough to miss newer teammates or weapons, say so in `note` and tell Adrian.
   If Zy0x has no guide for the character, leave `video` out and tell Adrian.

The page shows only the thumbnail (`i.ytimg.com/vi/<id>/maxresdefault.jpg`) until someone clicks; then it
loads the youtube-nocookie player. If a video has no `maxresdefault.jpg` the thumbnail is blank: check it,
and if it 404s, change the URL in the generator to fall back to `hqdefault.jpg`.

### Step 5: generate

```bash
cd parcore.com
python scripts/genshin-characters.py <slug>            # one or more slugs; no slug = EVERY character (don't, yet)
```

About 5 seconds for one character, mostly setup; each extra character adds a few seconds (two yatta
requests). It prints `Wrote site\genshin-impact\characters\<slug>.html`.

### Step 6: check it

Preview with `python _tools/serve.py` (from the outer `Downloads/parcore.com` folder) →
`http://localhost:8765/genshin-impact/characters/<slug>`. Then check:

1. **Screenshots** at 1920, 1366 and 500 px wide (CLAUDE.md "Screenshotting these pages": headless Chrome).
   Look at the cover (namecard, face circle + name + tags on its foot, best in slot), the farm strip (talent book tile
   present), all 5 weapon + 5 artifact rows, 4 teams, the video thumbnail, and the five blocks below.
2. **Phones scroll sideways?** Headless Chrome can't render narrower than 500 px, and real phones are
   360–430, so load the page inside a narrow iframe. Save this as a temporary `site/_probe.html`, open it
   headless with `--dump-dom`, read the `<title>`, then **delete the file**:
   ```html
   <!doctype html><html><body style="margin:0"><script>
   const res=[];[360,375,414].forEach((wd,i)=>{const f=document.createElement('iframe');
   f.src='/genshin-impact/characters/<slug>';f.style.cssText='width:'+wd+'px;height:800px;border:0';document.body.appendChild(f);
   f.onload=()=>setTimeout(()=>{const d=f.contentWindow.document;res[i]=wd+':'+d.documentElement.scrollWidth+'/'+f.contentWindow.innerWidth;document.title=res.join(' ')},5000)});
   </script></body></html>
   ```
   Every pair must have the first number **at most** the second (`365/375` is fine: that gap is the scrollbar).
3. **Numbers spot-check** against the game or the wiki: Lv 90 base HP/ATK/DEF, ascension Mora (420,000 for
   every 5★), talent book days, the boss that drops their boss material.
4. Hand it to Adrian with a short list of every build pick you flagged.

---

## 4. When you change the shared files

- **Changed `genshin-character.css` or `.js`?** Bump `ASSET_V` near the top of the generator, then rerun
  for every generated page (`python scripts/genshin-characters.py kamisato-ayaka hu-tao ...`). Otherwise
  browsers keep the old file. (The pages used to inherit the list page's `?v=`; they have their own now.)
- **Changed the generator?** Rerun it for every page that exists (`ls site/genshin-impact/characters/`).
- **Changed the list page (`characters/index.html`)?** Its head, bars, footer and 11layout `?v=` bumps reach the
  character pages only when you rerun the generator. If you rename or remove the list page's
  `<title>`, its `<meta name="description">`, its `<main class="gi">`, or its links to `genshin-characters.css/.js`,
  the generator stops with "the list page shell changed": update `main()` in the generator to match.

---

## 5. Gotchas found while building the pilot

- **`.gi img { display: block }`** in genshin.css beats any single-class rule that tries to hide an image.
  Use a more specific selector (`.cp-wc > .cp-wc-art`) or `[hidden]`.
- **Hidden screen-reader labels (`.gi-vh`, `position: absolute`) escape a sideways-scrolling row** unless the
  row is `position: relative`. That is exactly the phone sideways-scroll bug the talent icon row had.
- **Grids that hold swappable panels** (the talent panels) need `grid-template-columns: minmax(0, 1fr)`:
  an `auto` column grows to the widest hidden panel.
- **Sticky offsets on desktop** count from `.coc-main`'s padding edge (16px below the window top):
  `top: 72px` lands 24px under the 64px bar.
- **Cinzel has no lowercase and no curly quotes:** "495d" renders as "495D", and a `“` falls back to a box.
  Put units in Sora text; draw quote marks in Georgia.
- **yatta text** uses a literal backslash-n (`\n` as two characters) and `<color=#...>` tags. `rich()` escapes
  first, then rebuilds the tags; never insert yatta text without going through `rich()` or `e()`.
- **paimon.moe lists a Chronicled Wish's whole 4★ pool as featured.** The wish history shows only the 5★
  co-stars on Chronicled rows, the Rerun tracker's rule.
- yatta's `avatarExp` endpoint 404s, so the goal planner doesn't count EXP books yet.

---

## 6. Rollout (when Adrian approves the design)

Not done yet; do these together, in this order:

1. Write `genshin-builds.json` entries (and videos) for the characters Adrian wants first. Characters
   without an entry still get a page, just without the build blocks.
2. Generate them all (`python scripts/genshin-characters.py`, a few minutes for 120).
3. Make every character face on the site link to its page: Characters list cards (`genshin-characters.js`
   `card()`: they're `<li tabindex=0>` now), and the faces on the Lobby, Farm, Birthdays, Reruns, Banners,
   Nations and Enemies pages (most link to `/genshin-impact/characters?q=<name>` today). Inside character
   pages, team faces already link to a character's page as soon as its file exists (`face()` checks).
4. Add every page to `site/sitemap.xml` (none of the Genshin pages are in it yet).
5. Decide the Traveler page.
6. Optional: run the generator from `.github/workflows/genshin-feed.yml` when the roster grows, so a new
   character gets a page without anyone remembering to.
