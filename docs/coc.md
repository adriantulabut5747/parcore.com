# Clash of Clans

Moved out of CLAUDE.md on Nov 1 2026, unchanged. Paths like `parcore.com/docs/x.md` are relative to the outer folder.

## CoC API (Cloudflare Worker, Oct 24 2026)

Every Clash of Clans lookup (Player Tracker, clan pages, /coc/ search + war tile) calls
`https://parchrome-coc.adriantulabut5747.workers.dev/api/coc` directly, on every host. Code:
`cloudflare/coc-api/worker.js` (moved off Netlify functions: the free plan ran out of calls;
Workers' free plan = 100k requests/day). Key = Worker secret `COC_API_KEY` (dashboard →
parchrome-coc → Settings → Variables and Secrets), calls go through RoyaleAPI's proxy (fixed IP
on the key). Edge cache works on workers.dev (`X-Cache: HIT`). CORS allows only our hosts +
serve.py: a new domain goes in `allowedOrigin()`. Deploy: `npx wrangler deploy` in that folder
(needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in the shell: the browser login fails on
this PC). `netlify/functions/coc-api.mjs` / `coc.js` are gone; genshin-api.mjs is still on Netlify.
**History tabs (Oct 25 2026):** the player page's Wars / Battles / Clans tabs come from **ClashKing's
public API** (`api.clashk.ing/v2/player/%23TAG/war/stats | battlelog/history | join-leave/totals`: no
key, CORS `*`), called straight from the browser (coc-tracker.js "ClashKing"). **Classic battles** also come
from the official API's `players/%23TAG/battlelog` (Worker `type=battlelog`, Oct 25 2026: the last ~50 battles of ANY
player, attacks + defenses, army codes, opponent; there `battleTime` = duration, the date = `battleTimestamp`), merged
with ClashKing's older ones in `battlesOf` (official copy wins; either source may fail alone). warreport.app gets its
history the same way. Wars still come only from ClashKing (no official per-player war history). The clan page's Raid
weekends tab is official data: Worker `type=raids` (`capitalraidseasons`). Battle armies are drawn with `ArmySheet.html`. **Event troops** (Lavaloon = id 104...) live in coc-army-data.json `eventTroops` (drawing only: the maker never offers them), built by `python scripts/build-event-troops.py` (ids: coc.py; housing: the wiki, coc.py's is stale; icons: ClashKing's assets repo -> `units/event-*.webp`): re-run it when a new event troop ships. An id still unknown draws as a "?" tile.
**Tracker v2 (Oct 25 2026):** coc-tracker.css "REDESIGN v2" block (header = hall on a `.pt-plinth`, XP star,
league box, every header number in its own well; its phone rules sit at the block's end because it comes
after the old ones). Player page: the **swap key** (`.pt-swap`) on the hall's corner shows the OTHER village's hall picture and flips
Home / Builder (`wireVillage`): `#ptProfile[data-village]` hides the other village's `[data-show]` bits, tabs and
panels; hall pictures use `[data-on]` instead (cross-fade + scale, so the swap animates); `#builder` in the address opens it.
Home tabs (Adrian's order, Oct 25 2026): Overview (progress = Overall row + groups 3 a row on desktop) / Attacks /
Achievements / Previous clans / Stats. Stats = the profile numbers (`.pt-wellfacts`) + ClashKing war and battle stats on
one page, no switch (`loadStats`, "v2.3" CSS block). Attacks opens on a Classic | Clan war switch (`modeTab`); both tabs
share one download (`ckOnce`). Classic battle rows draw the army with `ArmySheet.html` (army-sheet.css is linked on the
player page; `.pt-ck-sheet` undoes its stacked phone layout so heroes stay left); war attacks carry no army code in
ClashKing. Legend battles show `legend-league.png`, not a text pill. Maxed tiles show their level on a red badge (no "MAX").
The official API has no Guardian data (TH18), so the profile can't list them. The
ClashKing credit is plain text (no link). Builder tabs = Overview + Achievements only (no builder battle history exists anywhere).
Builder caps = `coc-max-levels.json` `"bh"` (build-max-levels.py `builder_caps()`, Star Laboratory → Builder
Hall). Builder Hall art: `site/icons/bhNicon.webp` (wiki). Star strips (`starStrip`) top the Wars and Battles
tabs and the clan War log (win / loss / draw); a square click jumps to its row.

**Equipment page + Damage Calculator sheets (Oct 25 2026):** /coc/tools/equipment opens a piece in `#eqDlg`
(the Genshin Artifacts panel in CoC dress: modal on desktop, bottom sheet on phones; coc-guides.css "EQUIPMENT
PANEL"; purple = Epic, blue = Common via `--rar`). Tips + `pairs` live in coc-equipment.json (pairs `top: true` =
the Equipment Tier List article's "Pairs worth maxing"; the article beats the wiki). The Damage Calculator on phones
= a round red key (`#dcFab`) opening the attack as a bottom sheet; desktop keeps the sticky box. Both sheets drag
closed with `cocSheetDrag` (th-layouts.js, a copy of `GI.sheetDrag`) + `.sheet-grip` (th-layouts.css). The CoC tool
banners have no `.tb-facts` any more (Adrian). Portal Pendant (Minion Prince, game id 61, from an in-game army
link) added Nov 2 2026 from the wiki; Adrian ranks it A (first) in the tier list article, paired with the Meteor Staff
in its row text + the Equipment page only (not "Pairs worth maxing": 24 of the top 200 run it).

## Town Hall layouts pages (`coc/town-hall-NN/layouts.html`)

th18 is the template; th17 → th8 are still the old design and get converted
one at a time. A converted page is split three ways:

- **`th-layouts.css` / `th-layouts.js`** — the shared look and behaviour (hero,
  top bar, cards, likes, share, page numbers). Fix a design bug here, once.
- **`army-sheet.js` / `army-sheet.css`** (Oct 2026) — the army drawn from a Copy Army
  link (`window.ArmySheet`) + the army card name row. Split out of th-layouts so
  articles can draw armies too (farming article). Army pages and the army maker link
  them right before th-layouts.js / right after th-layouts.css.
- **`thNN-layouts.json`** — that TH's bases. Cards are built from it at runtime,
  so adding a base = adding a JSON entry. A base's `id` is permanent (share link
  `#base-thNN-<id>` + like-counter key) — never renumber.
- **`coc/town-hall-NN/layouts.html`** — the shell: the TH's title/icons and the
  static sections. Copy TH18's and change the TH-specific bits. (Data JSON stays
  at the site root: `site/thNN-layouts.json`, `site/thNN-army.json`.)

One HTML file per TH. The old extra pages (`thNN-layouts2.html` …) are gone —
`_redirects` sends them to `…/layouts?page=N`. The script
pages the JSON 10 bases at a time (`?page=2` in the address; phones show
"/ Page 2/2" in the secondary top bar via `#stbPage`). Old page files forward
to the matching `?page=N` (via `_redirects`). All of TH18 → TH9 are converted. TH8 has no bases
yet: its page is the same shell with a "coming soon" panel (`.th-soon`) in
place of the grid, and no FAQ/likes — give it a JSON + the grid from th18 when
it gets bases.

When converting a TH: only **active** (uncommented) bases go into the JSON;
commented-out ones are dead and get dropped. Back up the old HTML files to
`Downloads/parcore.com/_backup/thNN/` — outside the repo. CoC home's Town Hall
card counts read the JSON: give that TH's count span
`data-count-from="/thNN-layouts.json"`.
The Live events / clan card / FAQ sections are shared with coc-home via
`coc-clan-clock.css` / `.js`. Formatting: `npx prettier@3 --single-quote
--print-width 140 --end-of-line crlf --write <files>`.

## CoC home + CoC type (Oct 24 2026)

**The Villager (Oct 27 2026):** CoC's guide, like Klee on Genshin. `site/coc-villager.css` (`.cv-say` = face + raised bubble,
"VILLAGER" tag) takes a section's subtitle spot; face = `site/images/coc/villager/face.webp` (Adrian's WWE-announcer
renders). Voice = the in-game tutorial's ("Chief", polite, a bit dramatic). Adrian's rules from the Klee work: mostly
plain, clear help; a joke only where a SHORT one fits the box; no subtitle next to her. Bubble text (every `.cv-say`: Villager, Jett, Golden Knight) = **Sora** (Adrian, Nov 1 2026: Orbitron and Oxanium tried, "so bad"), 14.5px / phones 11px, label 12px / phones 9px (Klee + the Piglin match). Face = `face-flat`
(the intimidating look) almost everywhere, Adrian's pick; `-shock` only for a "Whoa" line; never `-cheer` / the plain smile. Live on /coc/ and
every /coc/tools/ page that had an `.am-intro` or Damage Calculator's `.dc-intro` (all replaced by her, incl. the ones coc-legends.js / coc-warplan.js
draw; Leaderboards' text sits in `<span id="stEqIntro">`; Tier list's two carry `data-mode`). A new CoC page = link
coc-villager.css and use her instead of an intro line.
**Line rules for EVERY `.cv-say` (any guide, any section; Oct 29 2026, Adrian):** write them like Klee's Genshin
lines (`.gi-klee`, "the perfect ones"): 1-2 full sentences (~80-140 characters) that say what to do and what you get,
plain words, then a short joke in the guide's voice. Both extremes failed: 3 sentences + a joke was "so freakin long",
shorthand like "Red = one shot kills" was "hard to understand". A line that says nothing new is cut. Script-written
lines follow the same rules. Full list: the header of coc-villager.css.

**Fonts (Oct 31 2026, Adrian; Nov 1 2026: Orbitron -> Oxanium):** on every CoC page, titles = **Orbitron Title** (Nov 12 2026; Tourney italic before), text = **Sora**,
**Oxanium** only for eyebrows (kickers, "Did you know?") and big stat numbers, **no Orbitron** anywhere on CoC (tool cards and the
tier list PNG too). The pieces from files other sections share (article strip, army sheet, TH cards)
are overridden in coc-hub-menus.css "CoC FONTS", which also pins the few bar / search pieces the Sora `*` resets reach.
build_cards.py and coc-tierlist.js's PNG export follow the same split. Titles are their old size + 2px (Adrian: Tourney runs small). Phones: every rule that left Oxanium is scaled down (x0.92 now Sora, x0.85 now Orbitron, 9px floor) in the generated "PHONE SIZES" block at the end of coc-hub-menus.css (CoC) / mc-hero.css (Minecraft); a NEW rule is sized in its own file, not there.
/coc/ hero title + subtitle: max 3 lines at any width (phones size the title with `cqi`).
Nov 12 2026 (Adrian): the 250+ / 100+ / Tools stats row is gone (don't re-add), and the desktop banner hugs its
content (`.hero-overlay` 150 / 70px padding: the top 48 hides under the bar, so ~104px of air shows above the eyebrow
and below the search) instead of filling the screen. FAQ + Live band now sit on the --sy rhythm too (FAQ's 112px bottom
"for the Warden" was stale; the band's 48/52 is overridden on /coc/ only). Tools link = "All tools" so it fits beside the
title on phones, like "All articles".
**/coc/ hero (Nov 12 2026, Adrian):** no player search (removed, with its script), no HOT tags or arrow keys on the two
right-hand cards (the whole card is the link). CoC search keys are dark grey, not red (coc-hub-menus.css SEARCH KEYS).
Track any clan: no Villager bubble (removed Nov 12 2026); the phone is the focal point; the console has no box / red glow, Scout is the grey key; 112px
above + below (64 phones). Then the Raid Weekend clock (`#chRaid`, ticks off
`window.cocEvent` = coc-events.js `computeEvent`, so it can't drift from the band).
**Tracker section** (v4, Oct 24 2026) is for clans: copy, then the search console (the focal point,
red "Scout" key), then the phone. The phone is a STILL war card of Ascendere (`.wc-*`, "WAR CARD"
script + CSS): both clans, score, clock (minutes only), each side's #1 player. One Worker request
(`type=warcard`, ~1 KB) every 2 min. Adrian's rules: no green or yellow in it (the battlefield
art is recoloured red by `background-blend-mode: luminosity`), nothing animates, no plate above
the phone, no "On every clan page" tiles. The Ascendere clan
card (`.ac-card`) and coc-clan-clock.js are gone (Adrian's call); `clan-stats.json` + its workflow
now feed nothing. **Live band v2** (coc-clan-clock.css "Live band"): raised tiles on a steel band,
markup identical on all 23 pages (/coc/ + every TH layouts/army) -- change all together.
**/coc/ order (Oct 24 2026):** hero, Featured Town Halls, then tracker + Parchrome tools in `.lob-swap`
(phones: tracker first; desktop: tools first, via flex `order`), Clash guides, Most picked equipment, Top players of the week, FAQ, Live band.
The stats job (lobby-stats.yml) runs **weekly**, Sunday 22:00 UTC = 7h before the league reset (Monday 03:00 started late, after the reset, Oct 26), so
/coc/'s board and the Leaderboards tool show the week's final standings. Equipment rows = medal + item +
quiet %, no bars. The board = one box, 1-5 | 6-10 (phones one column), arrows = vs last week's file.
FAQ = `.qa` in coc-lobby.css (no longer the TH pages' `.t18-faq`): `<details name="qa">` (one open at a
time, no script). Left column = title + the shared **feedback box**, sticky on desktop (`.qa` is `overflow: clip`,
not hidden: hidden breaks sticky); phones = questions, then the box; answers open instantly + fade on phones (a
height animation stuttered). **Feedback box (Oct 24 2026), any page:** `<div data-feedback></div>` -> 11layout.js
"FEEDBACK BOX" builds the form (Suggestion default / Rate us (red stars) / Report a bug) and sends it to Firestore
`feedback` with the page path; look = 11layout.css "FEEDBACK BOX"; Firebase loads only when the form is touched.
Home and /coc/ use it.
Tracker ("Track any clan"): phones = title, phone, search (no quick picks / help line; no hero
player search `.ch-find` either). Clan results = badge, name, "#TAG · place · 47/50" + Tracker / Show
keys; Show puts that clan on the phone's war card (`window.cocWarCard.show`, saved in localStorage
`coc-phone-clan`, Ascendere by default). Tool cards carry two blurbs: `.ptc-long` (desktop, max 2
lines) and `.ptc-short` (phones, ~34 letters, 1 line) -- edit both in build_cards.py.

## Animated tool cards (Oct 2026, in progress)

📖 **Read [`parcore.com/docs/tool-cards-handoff.md`](parcore.com/docs/tool-cards-handoff.md) before
touching the /coc/ "Parchrome tools" band or the animated tool cards.** It has Adrian's
rules for this work (one card at a time, his QC each, laby.net-style: subtle idle, special
hover, narrow art column, real numbers only), the current card specs, and open items.
**Nov 12 2026:** /coc/ shows only the 4 HOT cards; the other six are a plain list (`.ptm`), /coc/tools/ keeps all ten. Preview + build scripts: `_tools/tool-cards/` (not published). The cards are LIVE on /coc/ and /coc/tools/ (`PAGES` in the script):
`site/tool-cards.css`, `site/tool-cards.js` and the `<!-- TOOL CARDS -->` block in both pages
are generated by `build_cards.py` -- edit the script and rerun, never those files.
