# Genshin character pages: how to make one

How `/genshin-impact/characters/<slug>` pages are made, and the exact steps to add the next character.
Read this before touching `scripts/genshin-characters.py`, `scripts/genshin-builds.json`,
`site/genshin-character.css/.js` or anything in `site/genshin-impact/characters/`.
The design history (why the page looks the way it does) is in git: `docs/genshin-handoff.md` before Oct 28 2026, section 7 page 9.

**Status (Nov 4 2026):** 70 pages exist: Cryo (21), Pyro (18), Geo (14) and Hydro (17), drafts waiting on Adrian's check. **He names the next element; section 0 is the recipe, using Pyro as the example.** Adrian's rule: every page must look
and read like **Kamisato Ayaka's** (`/genshin-impact/characters/kamisato-ayaka`, entry in `scripts/genshin-builds.json`): same blocks,
same amount of content, same voice. He rolls out one element at a time and names the next one himself; never generate
characters he hasn't asked for. No Traveler page yet.

---

## 0. Start here: the next element (recipe, last run on Pyro)

Adrian's ask for each element, here Pyro's 18 characters: finished like Ayaka: build, teams, video, everything. The front end is done, so this is
content, not design. Work inline; don't change the layout unless he asks.

**The whole job:**

1. `python _tools/serve.py` from the outer folder (port 8765). Set `PYTHONIOENCODING=utf-8` on Windows, and keep temp files on E: (C: is full).
2. `python _tools/genshin/character-kit.py research Pyro --out E:/claude-tmp/pyro.txt`, then read it all: every kit, what each talent's table
   holds, every weapon passive and set bonus for their weapon types.
3. For each character read a current community guide (`https://keqingmains.com/q/<name>-quickguide/`, fall back to a web search) as a
   **reference only**. Note its game version: the game is at 7.1+ and many are years old, so they miss newer teammates, sets and reworks.
4. Add the entries to `scripts/genshin-builds.json` directly (rules in section 3; copy Ayaka's shape; `"checked": ""`).
5. `python _tools/genshin/character-kit.py video <slug> <id>` for each video (table below). It fills in title, date, "Made in v..." note and thumbnail.
6. `python scripts/genshin-characters.py --built amber arlecchino bennett chevreuse dehya diluc durin gaming hu-tao klee lyney mavuika nicole thoma xiangling xinyan yanfei yoimiya`
   (`--built` also redoes every existing page, so their team and Similar faces link to the new ones). This also updates
   `genshin-character-pages.json` (makes faces link), `search.json` and `sitemap.xml`; don't touch those by hand.
7. `python _tools/genshin/character-kit.py check`. Fix everything it reports.
8. Screenshots at 1920 and 500 wide (section 3 step 6): compare side by side with Ayaka's. Look at a few, including a support and a new character.
9. Tell Adrian what you flagged (section 3). Commit or push only when he asks.

**Pyro roster and Zy0x's newest guide** (found Nov 4 2026; recheck with `character-kit.py videos "<Name>"`, new guides appear). The dry run on Nov 4
generated all 18 without a build and the page checks passed, so no kit should break the generator.

| Slug | Video id | Note |
|---|---|---|
| amber | none | Only build videos, no guide (`D2FajEUkBd0`, 2y old): leave out, tell Adrian |
| arlecchino | `jRytmsiL9nU` | |
| bennett | `H0tUlWYGYX8` | v2.6, very old |
| chevreuse | `nUn5YQ6crPA` | |
| dehya | `je3XXTBWJY4` | |
| diluc | `ynwWHZtQqSs` | |
| durin | `xHJHKPpwBes` | |
| gaming | none | Tell Adrian |
| hu-tao | `5kLowTPUGCQ` | |
| klee | none | Only a build video (`R9GWOdxgjOc`): tell Adrian. Klee is also the Lobby's guide |
| lyney | `TrCjttdoR8s` | |
| mavuika | `GHBG2naKqZM` | |
| nicole | `7tkJZk8zZfc` | |
| thoma | `gaA_iVByfxI` | Burgeon guide, his newest; `DlnN0Py4tHo` is the older general one. Tell Adrian |
| xiangling | `jBPMh_6ZY_8` | Very old |
| xinyan | none | Tell Adrian |
| yanfei | `Yez1jO-QzAU` | Very old |
| yoimiya | `wzK0ZAC8cCk` | Very old |

**Pyro's mistakes (Nov 4 2026):** ten weapon sources written from memory were wrong, and two "F2P" picks turned out to be wish or Battle Pass weapons: run `check` before believing any `from`, and pick the F2P slot from what the wiki says is free. `wiki_source` returns nothing when a fetch fails, so a network blip passes silently (Wine and Song's error only showed on the second run): run `check` twice. `"The Catch"` gets no wiki answer, so `check` can't verify it. A KQM page can describe a kit differently from the game text (Klee's C1): the research file wins. Xinyan has no KQM quick guide.

**Geo's lessons (Nov 4 2026):** check every candidate weapon against the wiki *before* drafting (the 14 Geo entries needed no source fixes). `videos` can crash on a bad YouTube reply (Zhongli): rerun it. Zy0x has no guide for Illuga or Noelle. His Albedo guide (v2.3) predates the Hexerei rework; his Zhongli one is v2.4. The generator now reads the Nod-Krai wording of C3/C5 (`Elemental Skill X`, `X increases by 3 Levels`).

**Hydro (Nov 4 2026):** Zy0x has no guide for Aino, Barbara, Candace, Columbina (only an early-access review, `e6BR9xNlRqg`) or Dahlia. Dahlia is male in the game text. KQM's Tartaglia guide is v4.0 and Barbara's v3.2. The generator also reads "the Elemental Skill X" now (Vodyanitsa). Only Columbina, Linnea and Zibai convert Hydro Crystallize; Aino does not.

**Still waiting on Adrian from Pyro:** all 18 drafts have `"checked": ""`. Amber, Gaming, Klee and Xinyan have no video.

**Still waiting on Adrian from Cryo:** the 20 Cryo drafts have `"checked": ""` until he has read them. Sandrone has no video (Zy0x only has an
early-access review, `z52jMnoq5ZI`); he hasn't decided whether to embed it. Chongyun's video is a Kaeya + Chongyun team video. As of Nov 4 2026 none of this
is committed.

**Not tested:** the Banners page's 4★ name links (no wish was live): open `/genshin-impact/banners` during a wish and click one.

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
| `site/genshin-character-pages.json` | Which pages exist; `GI.charHas` / `GI.charHref` (genshin-core.js) read it, so faces link by themselves. | Never (generator) |
| `_tools/genshin/character-kit.py` | Research dump, Zy0x video search + fill, and the `check` command. | Yes |
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
- **`"checked"` stays `""`** until Adrian has read the entry. Never fill it in for him; the page hides the line while it's empty.

**Checked against what, and mistakes made on Cryo (don't repeat them):**
- **Read a weapon's full passive before writing its note.** I guessed Disaster and Remorse "stacks CRIT DMG" and Jadefall's Splendor gives a "team buff": both wrong.
- **`from` comes from the wiki, not memory.** `check` compares it. Forged by the Golden Melody and Heretic's Molten Blade are Battle Pass, not Wish.
- **Check which talent really does the damage** (the `scales:` lines in the research file): Skirk's and Lohen's attacks sit under their Skill, so their Normal Attack needs no levels.
- **Similar lines must be true facts,** family or group first, no invented flavour ("from the end of the world" was made up). Unsure of a relationship? Use role + element.
- **Older characters get reworked:** Qiqi, Diona and Wriothesley all gained Stellar passives. Trust the research file over any guide; Lunar / Stellar teams may suit them now.
- **Only make claims you can back up** ("often beats a 5★ weapon" had no source). CRIT targets are a rule of thumb: tell Adrian.
- **Every team must come from a guide (Adrian, Nov 4 2026).** Keep the source in your notes, never on the page. "The logic seems fine" isn't enough: my invented Tartaglia + Furina team had almost no Pyro to Vaporize with. If you can't source a fourth team, leave it out: 3 is fine, and `check` allows it. Put the character's real best team first.
- **Team tiers:** `F2P` = all three teammates are 4★. `Budget` = cheap but with a 5★ somewhere. `Premium` = the rest. `tier` only says that; the fit goes in `note`.
- **Supports don't get CRIT targets.** Energy Recharge from the guide, or leave `targets` empty and the row hides (Qiqi). Their `talents` can list just the 2 that matter.
- **Flag for Adrian at the end:** picks people will argue with, anything that needs a high constellation, weak or old videos, missing videos.

**Shape** (copy Ayaka's entry and change it):

```json
"<slug>": {
  "checked": "2026-10-25",                       // date Adrian last checked this entry (shown as "Checked Oct 25, 2026"); "" = not checked yet, line hidden. Never fill it in for him
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
    "date": "2023-03-22", "note": "Made in v3.5, before Furina and Escoffier came out.",   // note is optional
    "thumb": "hqdefault"                         // only if the video has no maxresdefault.jpg
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
    "teams": [                                   // 3-4 teams, best first, each from a guide
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

```bash
python _tools/genshin/character-kit.py videos "Hu Tao"      # lists his videos (three searches: one alone missed Odette's guide)
python _tools/genshin/character-kit.py video hu-tao <id>    # writes it into the builds file; do this after the teams are written, the note names newer teammates
```

Pick the newest **guide** (titles like "COMPLETE / ULTIMATE / UPDATED <NAME> GUIDE"), not a review, a pull video or a "this build" video.
If Zy0x has no guide for the character, leave `video` out and tell Adrian.

The page shows only the thumbnail (`i.ytimg.com/vi/<id>/maxresdefault.jpg`) until someone clicks; then it
loads the youtube-nocookie player. If a video has no `maxresdefault.jpg` the thumbnail is blank: check it,
and if it 404s, add `"thumb": "hqdefault"` to the video (Charlotte's has it).

YouTube's channel search only matches what you type, so also try `complete <name> guide`: `odette` alone missed her guide.

### Step 5: generate

```bash
python scripts/genshin-characters.py --built <slugs>   # the new slugs + every existing page. No arguments at all = EVERY character, builds or not: don't.
```

About 5 seconds plus a few per page. It also updates `site/genshin-character-pages.json` (faces link), `site/search.json` and the block between the
markers in `site/sitemap.xml`. A boss material our enemies file doesn't know gets its source from yatta's material record.

### Step 6: check it

Preview with `python _tools/serve.py` (from the outer `Downloads/parcore.com` folder) →
`http://localhost:8765/genshin-impact/characters/<slug>`. Then:

1. `python _tools/genshin/character-kit.py check` checks names, 5 weapons / 5 sets / 4 teams / 3-4 similar, weapon sources against the wiki, leftover game tags,
   "+3 levels" chips, 6 constellations, 6 farm tiles, and phone sideways scroll at 375px. It reports Sandrone's missing video until that's settled; that's expected.
2. **Screenshots** at 1920 and 500 px wide, next to Ayaka's (`docs/screenshots.md`; save to E:). Lazy images can come out blank in tall shots: that isn't a bug.
3. **Numbers spot-check** against the game or the wiki: Lv 90 base HP/ATK/DEF, talent book days, a boss drop.
4. Hand it to Adrian with the list of everything you flagged.

---

## 4. When you change the shared files

- **Changed `genshin-character.css` or `.js`?** Bump `ASSET_V` near the top of the generator, then rerun
  for every generated page (`python scripts/genshin-characters.py --built`). Otherwise
  browsers keep the old file. (The pages used to inherit the list page's `?v=`; they have their own now.)
- **Changed the generator?** `python scripts/genshin-characters.py --built`.
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
- **yatta quirks the generator now handles:** a nameless extra talent (Citlali), `{LINK#..}` around talent names in either order and a `Normal Attack: ` prefix on C3/C5 (the "+3 levels" chips), `{LAYOUT_PC#Press}` in table labels, `rowspan` as a cooldown value (= same as the row above), six identical locked constellations (Aloy), Mondstadt and Liyue specialties outside the 101xxx id range.
- **"Farm for X" / "Similar to X"** use the last word of the name unless `SHORT` in the generator says otherwise (Hu Tao, Yae Miko, Yun Jin, Lan Yan, Raiden). Add new two-word names there.
- **Talent panels** are `display: none` unless open, so the box fits the open tab (Adrian, Nov 4 2026). The page below moves when you switch tabs: accepted.

---

## 6. Rollout

One element at a time, on Adrian's word: Cryo, Pyro, Geo and Hydro done (Nov 4 2026, all waiting on his check); he names the next. Section 0 is the recipe for any element.

Faces go through `GI.charHref`: a character with a page links there, one without opens the list's search. Characters list, Lobby, Nations, Enemies, Artifacts, Endgame and the
Banners' 4★ names are links. On Birthdays and Reruns the face keeps its job (spotlight, row) and a "Character page" key appears inside. Farm faces stay as they are
(they pick your characters); the Tier List and player page aren't linked.

Later, not now: decide the Traveler page (their card stays unclickable); optionally run the generator from `.github/workflows/genshin-feed.yml` when the roster grows.
