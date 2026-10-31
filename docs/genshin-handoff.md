# Genshin Impact section: reference

Read this before touching anything under `/genshin-impact/` or any `genshin*` file. It holds Adrian's rules for
the section, where every piece of data comes from (and which sources lie), the design system, the gotchas, and
the game numbers. Private (`docs/` is not published).

Cut down Oct 28 2026 (Adrian): the planning, the build history and the full specs of built pages are gone. They
are in git (`git log -p docs/genshin-handoff.md`, any version before Oct 28 2026) if a "why does it look like this"
question ever needs them. Section numbers were kept, so older references (`handoff 5.5`, `section 10`, `7 page 24`)
still land in the right place.

---

## 0. Quick map

| Thing | Where |
|---|---|
| Shared CSS (base reset, tokens, ground, components, Klee pieces, header frame, help panel) | `site/genshin.css` (every page, first) |
| Shared JS (`window.GI`: esc, time + server helpers, countdowns, fit, tile, stars, `GI.feed`, lookup, sheetDrag, more cards) | `site/genshin-core.js` (every page, first) |
| A page's own CSS / JS | `site/genshin-<page>.css` / `.js`, linked after the shared pair |
| Pages | `site/genshin-impact/<slug>.html` (clean URLs); Characters + character pages in `genshin-impact/characters/`; the player page `genshin-impact/player/index.html` (`_redirects` 200 rule) |
| Group pages (Events hub / Full database / All tools) | `site/genshin-impact/{events,database,tools}.html` + `genshin-discover.css/.js` |
| Live data (generated, never hand-edit) | `site/genshin-feed.json` |
| Other generated data | `genshin-history.json` (banner log), `-weapons`, `-artifacts`, `-nations`, `-enemies` (+ `-enemies-more`), `-achievements`, `-birthdays`, `-wishpool`, `-enka-map` `.json` |
| Hand-written data | `genshin-artifact-picks.json` (Best for), `genshin-dyk.json` (Did you know), `genshin-glossary.json`, `genshin-reactions.json`, `scripts/genshin-builds.json` (character builds) |
| The script that writes the generated data | `scripts/genshin-feed.py` (Python 3 + Pillow), one job per file |
| Its schedule | `.github/workflows/genshin-feed.yml` (every 3 h, `17 */3 * * *`) |
| Character page generator | `scripts/genshin-characters.py` (how-to: `docs/genshin-character-pages.md`) |
| Section nav | `site/game-nav.json` key `"genshin-impact"` → `groups` (5.7) |
| Player lookup backend | `netlify/functions/genshin-api.mjs` (`/api/genshin?uid=`); locally `_tools/serve.py` calls Enka itself |
| Generated art | `images/genshin/splash/` (wish art), `strip/` (wish-result cards, 320x512 from `STRIP_TOP` 0.12), `weapon/`, `artifact/`, `enemy/`, `namecard/char/` |
| Static art | `images/genshin/`: `nation/`, `namecard/`, `element/`, `nav/` (page icons), `endgame/`, `klee/`, `art/` (scenes Adrian picked), `rarity/`, `wish/`, `achievement/` |
| Unpublished sources | `_tools/genshin/` (art originals, seelie icon traces) |

Preview: `python _tools/serve.py` → http://localhost:8765/genshin-impact/ (CLAUDE.md has the screenshot rules).

---

## 1. How Adrian wants this built (his calls)

- **Ask before implementing** anything with more than one reading or a visible design choice; recommend one
  option. **Don't sugarcoat.** **One page at a time, he QCs it, then the next.**
- **Accent = a LOW-SATURATION RED, used sparingly**: `--gi-acc` #a3464b (`--gi-acc-rgb` for tints, `--gi-acc-text`
  #d68a8d for small text). Only where something needs the eye: the main key (`.gi-key--red`, max one per section),
  eyebrow diamonds, picked chart bars, countdowns under a day (`.is-ending`). Everything else white or grey. Don't
  change the colour itself. Never cream ("our color is red and not cream"); the drawn Paimon Menu keeps the game's
  cream because it's a drawing of the game's UI. **No red vertical edge lines on cards.**
- **Never name a page class `.is-soon`**: 11layout.css dims `[data-game-nav] .is-soon` to 40% (the nav's unbuilt-page class).
- **Section titles = Minecraft's**: `.gi-title`, `--fs-title` size, white→#c0c9d4 gradient
  (`-webkit-text-fill-color: transparent`, so `filter: drop-shadow`, never `text-shadow`). No `<em>` gets its own colour.
  Subtitles = the shared quiet `.mch-sec-sub`. Every section title leads with the red gem; Lobby titles lead with Klee's clover.
- **Picked tabs are plain**: the raised grey key, no coloured underline.
- **Buttons = the Minecraft ones** (`.gi-key` = `.mch-copy`'s grey key, `.gi-tray`/`.gi-tab` = its tab tray). Don't
  invent new buttons. **The layout must not look like Minecraft**: same recipes, different composition.
- **Drawn sections are his favourite** (5.5). Plain card grids are the floor, not the goal.
- **Images**: official art on the dark ground, toned down, never full-brightness pastel boxes. Fan art with a
  signature is never published without the artist's permission. Phone wallpapers he sends often arrive stored
  sideways: check and rotate.
- **Nothing moves or resizes when content changes**: the hero, a wish card, any tabbed section. Render every state
  once, keep the tallest as min-height, re-measure on a real width change and once fonts load.
- **Real data only.** Every number true and sourced; unbuilt things say "Soon" and aren't links. **He is the expert
  on every game**: anything game-mechanical marked (confirm) or "Adrian to fact-check" waits for him (list in 12).
- **Klee is the section's guide** (Lobby + kleefied pages): `.gi-klee` = her face (`images/genshin/klee/face.webp`) +
  a one-line bubble, her name in hat red (`--klee` #c4362f, only on her pieces). Third person, her voice, and the
  line must stay TRUE (live lines are filled from the same counts as the page). **No crying Klee art** besides the
  hero's campfire; happy Klee = `strip/Klee.webp`.
- **Credit line** at the bottom of every page: "Game assets © HoYoverse. Parchrome is a fan site..."; plus the
  page's own sources (paimon.moe MIT, the wiki CC BY-SA, ...). Character builds are Adrian's own: never credit or
  copy another site's text.

---

## 2. Architecture: how data reaches the page

```
             every 3 h (GitHub Actions)
ennead.cc  ─┐
yatta.moe  ─┼─> scripts/genshin-feed.py ──> site/genshin-*.json + images/genshin/** ──> the page's JS
Fandom wiki ┤
paimon.moe ─┘
enka.network <── netlify/functions/genshin-api.mjs <── browser (player lookup)
```

- **Feed** (`genshin-feed.json`, ~50 KB, every page loads it): things that change during a patch (banners, events,
  challenges, codes, farm schedule, roster, endgame). Keep it small: database-sized data gets **its own JSON** written
  by its own job in the same script (weapons, artifacts, enemies, ...), so each page loads only what it needs.
- **Generated HTML** (character pages): edit the generator, rerun it, never hand-edit its output.
- **Why not call the APIs from the browser?** They're unofficial community services. The script keeps the last good
  value per source, so a page never goes blank when one is down.

### Feed script rules (keep these when extending it)

- Every source is a separate job in `main()`'s `jobs` dict; a failing job prints to stderr and keeps the old value.
  Calendar-dependent jobs skip when the calendar fetch fails.
- A file is only rewritten when its data changed (no timestamps), so the workflow only commits real changes. Add a
  timestamp and it commits every 3 h. Slow sources are gated (`checked` date: nations, enemies, letters once a day;
  details fetched once per new id).
- Send the `UA` header (`ParchromeBot/1.0 (...)`) on every request.
- Art is downloaded once (skipped if the WebP exists) and never deleted (reruns reuse it).
- Third-party text reaches markup in the browser: every string goes through `esc()`. Keep doing that.
- Local run: `python scripts/genshin-feed.py` (needs `pip install pillow`).

### Workflow

`.github/workflows/genshin-feed.yml`: sparse checkout, setup-python 3.12, `pip install pillow`, run, commit only if
`git status --porcelain` shows changes, `git pull --rebase`, push. Run it by hand from the Actions tab.

---

## 3. Data sources

### 3.1 ennead.cc — `https://api.ennead.cc/mihoyo/genshin/`
Unofficial, no key, CORS works.

| Endpoint | Returns | Used for |
|---|---|---|
| `calendar` | `{events[], banners[], challenges[]}` | banners, events, Abyss/Theater periods + Primogems |
| `codes` | `{active[], inactive[]}` — `{code, rewards:["Primogem ×60", ...]}` | codes |
| `news/events` | `{id, title, description, created_at, banner, url, type}` | event art fallback |

- `banners[]`: `{id, name ("Character Event Wish", "... 2", "Weapon Event Wish"), version, characters[{id, name, icon,
  element, rarity}], weapons[{name, icon, rarity}], start_time, end_time}` (unix seconds). Ids match yatta's.
- `events[]`: `{id, name, description, image_url, type_name, start_time, end_time, rewards[]}`. `ActTypeHardChallenge`
  = Stygian Onslaught, `ActTypeDouble` = double drops. Reward `amount` is often 0: don't trust event reward counts.
- `challenges[]`: `type_name` `ActTypeTower` = Spiral Abyss, `ActTypeRoleCombat` = Imaginarium Theater; `special_reward`.
- Gotchas: no banner phase number, no upcoming banners, reward strings use "×" (U+00D7).

### 3.2 yatta.moe (Project Amber) — `https://gi.yatta.moe/api/v2/en/`
Unofficial, no key, CORS `*`. Every response is `{response: 200, data: {...}}`.

| Endpoint | Shape / notes |
|---|---|
| `avatar` / `avatar/{id}` | roster (`element` Ice/Water/Fire/Wind/Electric/Grass/Rock, `weaponType`, `region`, `icon`, `birthday`, `release`); detail adds `fetter`, `upgrade.promote`, `talent`, `constellation`, `items`. `avatarFetter/{id}` = story, voice lines |
| `weapon` / `weapon/{id}` | drop the `isWeaponSkin` entries; detail = `affix` (passive per refinement), `upgrade`, `ascension`, `items`. Curve: `/api/v2/static/weaponCurve` (no `/en/`) |
| `reliquary` / `reliquary/{id}` | sets; pieces `_4` flower, `_2` plume, `_5` sands, `_1` goblet, `_3` circlet |
| `material` / `material/{id}` | `additions.requiredBy{avatar[], weapon[]}` |
| `dailyDungeon` | `{monday..sunday: {key: {name, reward[ids], city 1-8}}}`; city 7 = Nod-Krai, 8 = Snezhnaya (inferred, confirm) |
| `monster`, `achievement`, `namecard` | enemies, achievements (`achievement` is 571 KB), namecards |

**Where yatta is wrong or stale (use the wiki instead):**
- `tower` stopped in Mar 2025: the Abyss floors and Theater seasons come from the Fandom wiki (3.4).
- Monster **resistances miss immunities** (Pyro Slime reads 10% Pyro): resistances come from the wiki's `{{Enemy Stats}}`.
- Artifact `source` says "Mystic Offering" for nearly every set: the domain comes from the wiki's infobox.
- Its achievement list already holds unreleased versions: never show "x / total" against Enka's count.

**Assets** — `https://gi.yatta.moe/assets/UI/<icon>.png`. Wish art = `UI_Gacha_AvatarImg_<key>.png` (2048×1024,
transparent, ~1.9 MB: never hotlink, the feed converts it). Namecards `namecard/UI_NameCardPic_<key>_P.png` (840×400).
Element emblems `UI_Buff_Element_<Fire|Water|...>.png`.

### 3.3 enka.network — player data
- `GET https://enka.network/api/uid/{uid}/` → `{playerInfo, avatarInfoList?, ttl, uid}`; **no CORS header** (hence the
  function). Send a descriptive User-Agent, **cache each UID for `ttl` seconds**. 400 bad UID, 404 none, 424 maintenance,
  429 rate-limited.
- `avatarInfoList` only exists when the player turned on "Show Character Details".
- Id maps: EnkaNetwork/API-docs **`store/gi/`** (the root `store/*.json` stopped at Dec 2025).
- Newer field names (`theaterActIndex`, `theaterStarIndex`, `theaterModeIndex`, `stygianIndex`, `stygianSeconds`) come
  from the enka-network-api library; Enka's own docs are stale. `theaterModeIndex`'s id -> name map isn't verified.
- Enka sends only the achievement COUNT (`finishAchievementNum`) and only the showcase (no full roster).

### 3.4 Fandom wiki, paimon.moe, others
- **Fandom wiki** (CC BY-SA, credited on each page), read through its API by the feed script:
  - Abyss: 'Spiral Abyss/Floors/Abyssal Moon Spire' says which period page holds floors 9-12; each floor = ley line
    disorders + `{{Domain Enemies}}` (`//` = next wave, `;` = next enemy, `*n` = count). The Abyss blessing is a DPL
    query, not plain wikitext (not shown).
  - Theater: the newest started 'Imaginarium Theater/Seasons/YYYY-MM-DD' page's header template.
  - Enemies: Category Common / Elite / Normal Bosses / Weekly Bosses with `{{Enemy Infobox}}` + `{{Enemy Stats}}`. In
    `{{Enemy Stats}}` a missing state value falls back to ITS OWN `resglobalN`, not state 1's. HP = `hp_ratio` × the
    Module:Enemy Stats/HP table (checked against yatta's curve); DEF = 500 × (1 + 0.01 × lv).
  - Weekly bosses: read the RENDERED Weekly Boss page (DPL table), cut at `id="Gameplay_Notes"`.
  - The wiki names 6.x versions "Luna I", "Luna II"... (`version_key()` sorts them after 5.x: confirm the real order).
  - **Fandom's image CDN answers 403 to scripts.** Its pictures are hotlinked in the browser (enemy art, a few
    emblems), never downloaded, and we don't work around the block.
- **paimon.moe** `src/data/banners.js` (MIT, (c) 2021 Made Baruna; credited): banner history since 1.0, parsed by
  `history()`, which also appends live phases paimon hasn't added yet.
- **Official gift page**: `https://genshin.hoyoverse.com/en/gift?code=<CODE>` (prefills the code; the Redeem keys).
- genshin.jmp.blue: incomplete (no Skirk), not used.

---

## 4. The feed (`site/genshin-feed.json`)

```
characters[]  {id, name, rarity, icon, element, weapon, birthday [m,d] | null, release, region, strip}
              # one Traveler entry (element '', elements [unlock order]); Manekin / Manekina left out
banners[]     {name, version, start, end, characters[{id, name, rarity, element, icon, (5★:) title, affiliation,
               weapon, splash, kit {constellation, talents[3], cons[6]}}], weapons[{name, rarity, icon, type, (5★:) splash, sub, passive}]}
events[]      {name, description, image, type, start, end}
challenges[]  {name, type, start, end, primos}
codes[]       {code, rewards[], primos}        expired[] {code, primos}
endgame       {abyss {floors[{floor, disorders[], chambers[...]}]}, theater {season, elements[], characters[], ...}, icons {}}
farm          {monday|tuesday|wednesday: {books[{city, series, icon, domain, tiers, users[]}], weapons[{city, name, icon, domain, tiers}]}}
```
Times are unix seconds, Asia's. Thursday/Friday/Saturday reuse Monday/Tuesday/Wednesday; Sunday = all.

---

## 5. Design system

### 5.1 Tokens and ground
- Ground (Oct 29 2026, Adrian): the CoC TH Layouts / Armies ground (film grain, near-black fade, a faint red light at
  the top; genshin.css GROUND). Replaced the still night sky. **Still**: no page stars, no diagonal tiles. `GI.stars(host)` draws rising stars only inside a box (the wish cards), while on screen.
- Raised UI from 11layout: `--lb-box`, `--lb-edge`, `--lb-raise`, `--lb-well`, `--lb-btn`, `--lb-shadow`, `--lb-red`, `--lb-r`.
- Genshin: `--gi-text #eceef1`, `--gi-muted #9aa0a8`, `--gi-dim #6f737b`, `--gi-line`, `--gi-el` (element colour), `--gi-r4`/`--gi-r5`.
- Element colours: Pyro #ef8a4c, Hydro #4cb8ef, Anemo #5fd3b4, Electro #b48ef0, Dendro #a5c83b, Cryo #98d8f0, Geo #efc35e.
  **Only inside element-specific UI**, never as section accents.
- Fonts: Cinzel 800 caps (titles, names, big numbers), Sora for everything else. No Orbitron/Oxanium inside `.gi`.

### 5.2 Components (reuse these; don't make new ones without a reason)
| Class | What |
|---|---|
| `.gi-frame` | page column |
| `.gi-sec` + `.gi-sec-head` | section + head row (title left, actions right) |
| `.gi-title` + `<em>` | the section title (5.1 / 1); ends with a full stop |
| `.gi-tb` (+ `.gi-bar`, `.gi-more`, `.gi-note`) | the header every non-Lobby page wears; genshin-core.js adds its gold frame (`.gi-tbf`) and fills `.gi-more` with 2 random pages |
| `.gi-key` / `.gi-key--red` / `.is-done` | grey key / main action (max one per section) / "Copied" |
| `.gi-tray` + `.gi-tab` | sunken tray, picked tab = plain raised key |
| `.gi-box` / `.gi-card` | raised box / hover lift for link cards |
| `.gi-tile.r4` / `.r5` | portrait on the in-game rarity backing (a `<span>`: see 5.6) |
| `.gi-klee`, `.gi-qa` (`--short`), `.gi-tips`, `.gi-foot`, `.gi-all` | Klee's line, Ask Klee FAQ + feedback box, tips box, "See all" row under a section, a "view all" key (phones = `.art-all`) |
| `.gi-empty` | loading / error / empty line |
| `GI.jumpNav(tray)` / `GI.glide(el)` | in-page jump tray with a sliding pill / eased glide |
| `GI.sheetDrag(sheet, handles, scroller, hide)` + `.gi-grip` | bottom sheets on phones |
| `GI.serverTray(el, onChange)`, `GI.lookup(form)`, `GI.uidServer(uid)` | server switch, UID lookup box, UID → server |

**Ask Klee** (`.gi-qa--short`): 4 questions, title + Klee line full width, then feedback box LEFT | questions RIGHT,
always that way round. The Lobby keeps its 7-question version.

### 5.3 Images (how to add one)
Find it on yatta (3.2) or another official source, convert to WebP with Pillow (namecards / photos q80-85, icons
lossless), save under `site/images/genshin/<kind>/`, reference it root-absolute. Hotlink only small icons the feed
already returns (and the Fandom pictures, 3.4). Official art always sits on the dark ground with a dark gradient over it.

### 5.4 The Lobby hero (any future hero follows the same rule)
- **One fixed picture, nothing live in it** except Klee's dialogue box. Klee's campfire, drawn at the hero's height;
  phones use `klee-campfire-tall.webp` as a portrait scene. Its edges fade with a **CSS mask on the picture itself**
  (a gradient layer on top left a 1px seam).
- The dialogue box (`#giDyk`) = the live line, then `genshin-dyk.json` facts, 6 s each, **always exactly 3 lines**
  (facts under ~125 characters). Re-check the "new" facts every version.
- The hero search fetches nothing on load (the landing page's rule): `/api/genshin` + the enka map only on Search.

### 5.4e Phone performance rules (every Genshin page)
- No `background-attachment: fixed` + blend layers on phones: the ground moves into the fixed `body::before` (no blend) at <=970px.
- No `backdrop-filter` on phones; no blend-mode glow; no animated `text-shadow` anywhere.
- Idle loops pause off screen (IntersectionObserver).
- Phones fire `resize` while the address bar slides: only re-measure on a real width change.
- `content-visibility: auto` on long lower sections on phones.

### 5.5 Drawn sections (Adrian's favourite kind)
Minecraft's "Install a world" pattern: the picture is HTML/SVG drawn in the page (`aria-hidden`), the real content sits
beside it as accessible text. Sizes in `cqw` so it scales; autoplay only while on screen; reduced motion = still.
Built: How to redeem (a drawn Paimon Menu walked by a cursor), Reactions wheel, the Abyss stage, the resin orb (Timers),
the in-game artifact card (Scorer), the wish animation (Simulator), the Teyvat map (Nations), the week dial (Farm),
the birthday ring, the achievement wheel, the enemy resistance chart.

### 5.6 Rules that bit us
- `.gi img { display:block }` beats the `hidden` attribute, so `.gi [hidden] { display:none !important }` exists. Keep it.
- `.gi-tile` is a `<span>` sized only as a flex/grid child: in plain blocks give it `display: block`.
- A `.gi-vh` (visually hidden label, `position: absolute`) inside a sideways-scrolling row escapes it and widens the page
  on phones: give the row `position: relative`.
- No `<img>` without `src` in markup (the design hook flags it): create it in JS.
- No decorative glows (zero-offset coloured shadows). The wish glints are the one exception.
- Phone grids must be `minmax(0, 1fr)`, not `1fr`, or one-line text stretches the column off-screen.
- On phones a `.gi-bar` is a column: never give it (or a filter panel in it) `flex-wrap: wrap`.
- Every page needs the base reset block (top of genshin.css), or it gets the browser's 8px margin and a broken sidebar.
- Event art is the game's 1080×390 with the title baked in: `aspect-ratio: 1080 / 390`, never crop it.
- Sticky offsets count from `.coc-main`'s 16px padding edge.
- `serve.py` doesn't answer HEAD: check a page exists with GET.
- A `#` in `_redirects` starts a comment.

### 5.7 Section nav
- `site/game-nav.json` → `"genshin-impact".groups` = `[{name, link, icon, cols?, pages:[{name, link, icon, desc, soon?, tab?, activePrefix?}]}]`.
  Lobby / Events / Database / Tools. `buildGroups()` in 11layout.js makes the bar's menus, the phone bar, the More sheet
  and the breadcrumb from it. `activePrefix` lights a page for a whole address range (the player page).
- A group's own page (Events hub / Full database / All tools) = banner, then one card per page, nothing else. Card line =
  the page's `"desc"`: the first word says what the page is, ~55 characters (two lines at 1440px).
- Breadcrumb "Genshin Impact › Group › Page", every step flat grey (never a white last crumb), shown on phones too.
- Page icons = real game art, `images/genshin/nav/<key>.webp` (64px). Group icons = seelie.me's traces, white.
- When a page ships: drop its `"soon": true` and give it an `icon` + `desc`: nav, More sheet, group page and Klee's map
  update everywhere.

### 5.8 Help button "Traveler's notes"
Built by `genshin-core.js` `help()` on every page (no markup); shell = `coc-help.css`, look = genshin.css "HELP PANEL".
Rows: daily reset countdown, wishes and pity, endgame resets, codes, Original Resin.

---

## 6. Adding a new Genshin page (checklist)

1. File `site/genshin-impact/<slug>.html` → `/genshin-impact/<slug>`. Per-item pages (player) need a `_redirects` 200 rule.
2. Copy a built sub-page's shell (head, `<body class="gi-page" data-game-nav="genshin-impact">`, bars, sidebar,
   `.coc-main > .coc-content > main.gi`, footer, More sheet with its `.mx-hdr`, bottom nav, `11layout.js?v=…`).
3. Link `genshin.css` then `genshin-<slug>.css`; load `genshin-core.js` then `genshin-<slug>.js` (helpers from
   `window.GI`, data from `GI.feed`). Wish end countdown = `data-end-srv="<feed end>"`; a fixed moment = `data-end`.
4. `game-nav.json`: drop `"soon": true`, add `icon` + `desc` (5.7). `site/search.json` gets a line.
5. Title `<Thing> | Parchrome`, a real meta description, the credit line.
6. Bump `?v=` on genshin.css/js links when they change.
7. Screenshot desktop 1920 + 1366 and phone 500 (CLAUDE.md rules), check `scrollWidth` vs `innerWidth` on phone, hand to Adrian.

---

## 7. Per-page notes (built pages: the rules and data facts only)

Pages keep their original numbers.

- **2. Banners** (`/banners`): one `.gbw` card per live wish, no tabs. Rates official only (no soft pity). A banner whose
  name isn't "Character Event Wish…" / "Weapon Event Wish" (e.g. Chronicled) shows no rates; its art = first 5★
  character, else the 5★ weapons. "Phase N" comes from genshin-history.json. Build guide key only if the character page
  answers 200. `#skirk` / `#weapons` scroll to a card.
- **3. Rerun tracker** (`/reruns`): a 5★'s runs include Chronicled Wishes; **a 4★'s runs are Event Wishes only** (paimon
  lists a Chronicled Wish's whole 4★ pool as featured). A Chronicled Wish takes the version of the Event Wish running when
  it starts. Never a false "New": no pill if the history fails. Filters live in the address; `#c-<slug>` opens a row.
  Open: the Characters page's last-banner line still counts Chronicled 4★s (`lastRun`).
- **4. All events** (`/all-events`; `/timeline` and `/endgame` 301 here, `/endgame` → `?go=abyss`): feed times are Asia's;
  everything moves with the picked server except version-update moments (06:00/07:00 Asia, `isUpdate`, a heuristic).
  Undated events are named above the chart, not drawn. Abyss floor tray starts at Floor 9; every floor in one grid cell.
- **5. Redeem codes** (`/codes`): the code row (`GI.codeRow`) + Copy live in genshin-core.js; the title's month is set by JS.
- **7. Player lookup**: section 9.
- **8. Characters** (`/characters`): wish-result card art; views By nation | Newest | A-Z; one Traveler card; Aloy, Skirk,
  Nicole + Traveler in "Other"; hover info = element, weapon, nation only. "New" = released in the last 42 days. Every
  choice in the address (unknown values fall back to all).
- **9. Character pages**: `docs/genshin-character-pages.md`.
- **10. Weapons** (`/weapons`): square inventory tiles on the game's rarity backing; the wish art is for the drawer. No
  "best characters" (no source). Drawer = `?w=<slug>`. `forge` = [day group, city, domain], rechecked every run.
- **11. Artifacts** (`/artifacts`): its own design, square tiles, Newest first. Domains come from the wiki (3.2); **artifact
  domains are open every day**. Best for = hand-written `genshin-artifact-picks.json` (a set not in it shows none; 6.0+
  sets left for Adrian). Inspect = `?s=<slug>`.
- **12. Daily domains** (`/farm`, Events menu): the four day panels share one grid cell (`visibility`, not `hidden`).
  "My characters" = localStorage `gi-farm-mine` (Birthdays, Enemies reuse it).
- **13. Birthdays** (`/birthdays`): "Today" = `GI.gameDay()` (04:00 reset). **Feb 29 = Bennett**: the game sends his mail
  on Feb 28 in other years; the ring counts a 366-day year; his .ics rule is `BYMONTHDAY=-1`. `gi-bday` = your birthday.
- **14. Nations** (`/nations`): every fact from the wiki except `ARCHON_AS` (the one hand-written map). Nod-Krai has no
  archon or ideal (its mark is the Moonsign). One hero height for all nations (`measure()`).
- **15. Enemies** (`/enemies`): combat enemies only (no wildlife). Resistances from the wiki (3.4); HP slider is trusted
  because it matched the wiki's tables. yatta match: English name, then the wiki's Chinese name, then `ENEMY_ALIAS`.
  Enemies with no yatta drops take their wiki drop-table mates' series (`shared`). Never render all 365 at once on a
  phone (rows + "Show all"). Dossier = `?e=<slug>`.
- **16. Achievements** (`/achievements`): **a tier = one game id = UIAF's ids**, so ticks are tiers. One data file (search,
  the wheel and "closest" need every category). Storage `gi-ach` = `{tier id: unix seconds}`. The game doesn't say which
  are hidden or missable: the page claims neither.
- **19. Resin & timers** (`/timers`): resin saved as `{r, at}` (at = start of the current 8-min tick), so it's exact after a
  reload. Reminders = .ics with a VALARM (works with the tab closed) + Notification API (only while open). Keys `gi-resin`,
  `gi-timers`, `gi-jar`.
- **21. Artifact scorer** (`/artifact-scorer`): game constants at the top of the JS (wiki, checked Oct 26 2026). Roll
  counts = every tier combination that rounds to the shown value and fits the level. **Never a verdict**: numbers only.
- **22. Wish simulator** (`/wish-simulator`): rates in section 10. Each wish rolls the 5★ first, then the 4★ (a 5★ doesn't
  reset the 4★ counter). Weapon Fate Point resets when the weapon wish ends. Checked with 1M wishes per type: matches the
  wiki. State `gi-wish` (log capped at 6,000). Test: drive Chrome over CDP (not `--virtual-time-budget`); set `gi-wish`
  pity to 85 to force a 5★.
- **24. Reactions** (`/reactions`): facts + sources in `docs/genshin-reactions-research.md`. Any `.gi-rx[data-rx]` gets the
  wheel engine (the Lobby's too).
- **25. Glossary** (`/glossary`): add a term = one JSON entry; ids are permanent (`#t-<id>` links).
- **28. Tier list** (`/tier-list`, Tools): a port of `coc-tierlist.js`; characters / `?type=weapons` / `?type=artifacts`;
  yatta's CORS `*` lets its icons draw on the export canvas. Blank maker (no Parchrome placements).
- **Spiral Abyss** (`/abyss`): `GI.abyssFloor` is shared with All events; `?floor=N`. Usage stats left out (no source
  with enough players).

---

## 8. Front-end conventions

- One IIFE per file; `esc()` for every feed string; `[data-end]` elements count down by themselves (`.is-ending` under
  24 h); `fit(el)` for one-line titles; `serverNow()`, `nextReset()`, `gameDay()`.
- localStorage only for per-viewer conveniences, always in try/catch (`gi-server`, `gi-farm-mine`, `gi-ach`, `gi-wish`, ...).
- Static sections render before the feed loads; feed sections show `.gi-empty` on failure.

---

## 9. Player lookup (`/genshin-impact/player/<UID>`)

- **Function** `netlify/functions/genshin-api.mjs`: `GET /api/genshin?uid=<9-10 digits>[&info=1]`, anything else → 400
  (never an open proxy). Calls Enka with `User-Agent: ParchromeBot/1.0 (...)`. Status map: 400 `badUid`, 404 `notFound`,
  424 → 503 `maintenance`, 429 → 503 `busy`, 5xx `enka5xx`, network `unreachable`. CDN cache = Enka's `ttl` clamped to
  60-600 s, `Netlify-Vary: query=uid|info` (junk params can't skip the cache). Deploys only through the Git-connected
  Netlify site. Locally `_tools/serve.py` answers `/api/genshin` itself.
- **GitHub Pages** has no rewrites or functions: there a player is `/genshin-impact/player/?uid=<UID>` (`GI.playerHref`,
  `GI.ON_PAGES`) and the page calls the Netlify site's `/api/genshin` (the function's `ORIGINS` allows Pages).
- **Id maps** `site/genshin-enka-map.json` (`enka_map()`): `c` characters, `cos` costumes, `nc`/`ncn` namecards, `pf`
  profile pictures, `w` weapons, `set` artifact sets, `si` talent icons, `k` constellation icons, `wt` weapon type.
  Pictures hotlinked from `enka.network/ui/` (CORS *).
- UID → server from the first digit (`GI.uidServer`): 1/2/3 China, 5 China (B), 6 America, 7 Europe, 8 Asia, 9 TW·HK·MO
  (10-digit UIDs: confirm).
- Crit value = 2×CR + CD from substats. Each id in `appendPropIdList` is one roll (stat = (id % 1000) / 10).
- The build box picks its layout by its OWN width (`container: gp-show`), not media queries. Under 680px of page width a
  Landscape card is the real 1280px card shrunk with CSS `zoom` (`is-fit`).
- **Build card picture**: html-to-image (MIT, self-hosted `site/html-to-image/`), the card cloned into a fixed 1280px
  stage. **Fonts trap**: it can't read Google Fonts' cross-origin CSS, so `loadFonts()` passes Cinzel + Sora as
  `fontEmbedCSS`; without it the picture falls back to Times/Arial.
- Storage: `gi-uids` (`{u, n, p}`; `p` must start with enka.network/ui/), `gi-card-opts`, `gi-card-art`,
  `gi-card-img:<avatarId>` (uploads never leave the browser). Roll counts + Substat breakdown start OFF on every visit.
- Not possible: the Abyss all-time best (Enka sends this period's floor; HoYoLAB needs the player's login).
- Not verified: `theaterActIndex` / `theaterStarIndex` names on a live profile (each shows only when present).

---

## 10. Game numbers reference (ALL need Adrian's confirmation before a tool ships)

| Thing | Value |
|---|---|
| Daily reset | 04:00 server time; Asia UTC+8, America UTC−5, Europe UTC+1. Weekly: Monday. Abyss 16th, Theater + Paimon's Bargains 1st |
| Character banner | CONFIRMED (wiki): 0.6% base 5★, 5.1% 4★, 90 guaranteed, 50/50 → 55% consolidated with Capturing Radiance, lost 50/50 = next is featured, 4★ every 10. Soft pity 74 (+6%/pull) is community-measured |
| Weapon banner | CONFIRMED: 0.7% base 5★, 6.0% 4★, 80 guaranteed (community: 77), 75/25, Epitomized Path = **1 Fate Point**, reset when the wish ends |
| Wish simulator model | char 0.6% to 73, +6% from 74, sure at 90; weapon 0.7% to 62, +7% from 63, sure at 77; 4★ 5.1% / 56.1% on the 9th / sure on the 10th (weapon 6% / 66% on the 8th / 9th). **Capturing Radiance = community model (confirm)**: a loss +1, a win −1, at 3 the next 50/50 is won, → 54.5%. Dupes → Starglitter / Stardust (2/10 per 4/5★ copy, 5/25 past C6, 3★ 15 Stardust) |
| Wish end time | 14:59 server time on every server; the feed's end = Asia's, so NA +13 h, EU +7 h (`GI.srvEnd`) |
| Cost per pull | 160 Primogems |
| Daily commissions / Welkin | 60 / 90 a day (+300 on purchase) |
| Spiral Abyss / Theater | from the feed (800 / 1,000) |
| Original Resin | 1 per 8 min, cap 200 (refills to 2,000); Primogem refills 50/100/100/150/200/200; domain 20 (40 double), Condensed = 3 runs (crafted from 60, hold 5), normal boss 40, weekly 30 (60 after 3 a week) |
| Timers | Transformer 6 d 22 h; expeditions 4/8/12/20 h; respawns 12 h / 2 d / 3 d; Jar of Riches 4-30/h by Adeptal Energy, cap 300-2,400 by Trust Rank |
| EXP books | Wanderer's Advice 1,000 / Adventurer's Experience 5,000 / Hero's Wit 20,000 |
| 5★ max substat rolls | CR 3.89%, CD 7.77%, ATK% 5.83%, HP% 5.83%, DEF% 7.29%, ER 6.48%, EM 23.31, ATK 19.45, HP 298.75, DEF 23.15 |
| Codes need | Adventure Rank 10 |
| Archon ideals | Mondstadt Freedom, Liyue Contracts, Inazuma Eternity, Sumeru Wisdom, Fontaine Justice, Natlan War, Snezhnaya Love |

---

## 11. Testing notes

- Headless transitions freeze and `<img decoding="async">` may never paint: not bugs.
- Measure, don't eyeball: a temporary script that clicks tabs and records `offsetHeight` (back up the HTML, restore it).
- Check phone overflow: `scrollWidth` vs `innerWidth`.
- To test a feed failure, rename `genshin-feed.json` temporarily.
- Anything animated (wish simulator, canvases): drive Chrome over CDP with real time (`_tools/tool-cards/cdp.mjs`).

---

## 12. Waiting on Adrian's fact-check

- Every Ask Klee answer and every `.gi-tips` box (Banners, Rerun tracker, All events, Codes, Abyss, Farm, Birthdays,
  Enemies, Achievements, the help panel).
- The Capturing Radiance model (10); the substat breakdown's max-roll table (10).
- Domain cities 7/8 = Nod-Krai / Snezhnaya; the 10-digit UID server rule; the wiki's "Luna" version order.
- Player milestones' thresholds (AR 60, Floor 12, 36 stars, 1,000 achievements, 10 max-friendship characters).
- That Enka's `finishAchievementNum` counts tiers like the Achievements page does.
- Whether yatta's Cryo Traveler is released.
