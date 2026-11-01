# Valorant

Moved out of CLAUDE.md on Nov 1 2026, unchanged. Paths like `parcore.com/docs/x.md` are relative to the outer folder.

## Valorant (`/valorant/`, Oct 29 2026, Adrian)

Tabs **Lobby / Tracker / Database / Tools** on the groups engine (game-nav.json `valorant`, SVG icons). Tracker +
Database have no group page yet (no `link`; Tracker = Player Profile + Leaderboards (both live)); Tools = Crosshairs (live) +
Economy Calculator / Sensitivity Converter / Chat Art / Valo Quiz (soon). Database = Agents / Maps / Weapons / Ranks from
valorant-api.com (free, no key).
**Lobby** (`/valorant/`, Oct 30 2026, full rebuild on the Weapons shell, Adrian to QC; old page backed up in
`Downloads/parcore.com/_backup/valorant/`): `valorant-lobby.js/.css`. Hero = `.vh` (the `.cb` banner grown up) with the Riot ID
search (Adrian's pick); a search opens the player page. Facts
strip = act + patch from valorant-weapons.json + the live pool count + agent count. **v3 (Nov 1 2026, Adrian: the first pass felt like "AI slop", "upgrade it your way")**: no more title + Jett + box grid
on repeat. Order: full-width hero (bg-agents-poster.webp, Jett on top, red slash; "Opened lately" players from `vl-recent`) /
Map pool (live; tall slices, the first open until you point at another; phones = swipe row) / **Agent spotlight** (full-width
band in the agent's `ac`/`ac2`, huge faint name, full-body render, C/Q/E/X names, red "Open X's file" key; the face row switches
it in place; newest first) / Ranked (9 ranks as stairs, step top = the rank's colour from valorant-ranks.js, | Top of the ladder) /
Buy menu (one panel, the game's 4 columns: Sidearms | SMGs + Shotguns | Assault Rifles + Rifles | Snipers + Heavy) / Tools (each
card previews its tool: a crosshair on Ascent, the converter's CS2 -> Valorant sum, a random gallery drawing, the gallery count) +
"On the way" chips (game-nav.json `soon` rows: Pro Teams, Lineups, Skins & Bundles, Instalock Roulette, Economy, Quiz; they leave
once they get a link) / Pro scene (events | news). Jett only on hero, agents, ranked (v4: every section). `valorant-roster.json` now also carries
`released` + `ab` ([key, name] for C/Q/E/X), written by valorant-agents.py. **Mobile (<=970px, Nov 1 2026, Adrian: CoC lobby margins, "compressed")**: sides = 5% (the CoC lobby's phone column,
`.coc-main { --codm-side: 5% }`); hero facts = 4 small wells; map pool = strips 2 a row, the first across the top (map art
= `-card.webp` everywhere now, 720px is enough for the widest slice); agent render stands behind the name, kit = 4-up row;
stairs = icons only; buy menu = shop tabs (`.vl-tabs`, phones only) over one 3-up grid; tools 2-up; On the way = swipe row;
pro scene = Events | News tabs. Page went from ~8,000px to ~4,000px tall at 500px wide. Tier list, economy, ACS, RR and Featured were cut
(estimated data or covered by their own pages). No hand-typed fallbacks: a source that fails says so.
**v4 "live hub" (Nov 1 2026, Adrian picked it from 3 pitches; to QC)**: hero = copy | glass **live card** (the CoC raid card: act
clock D/H/M/S ticking to valorant-weapons.json's act end + a start-to-end bar, then NA's top 3 from the Ranked section's
`type=leaderboard` call, each linking to its player page, anonymized = "Secret Agent"); each half hides alone if its source fails;
the card drops under the search below 1100px. The red slash is gone.
**Hero "agent lineup" (Nov 1 2026, Adrian picked it from 3 pitches: the hero looked like CoC's, he wants CODM's characters-first
feel)**: the poster (`.vh-art`, bg-agents-poster.webp, now unused) is gone. `.vh-cast` = 5 full-body renders (`agents/<slug>.webp`)
standing on the right, cast by `castHero()` from valorant-roster.json: back | mid = Jett ("Your guide") | front = the newest agent
("Newest") | mid | back, the other slots = the newest agent of each other role, so a new release walks to the front by itself. Back rows
are dimmed, hover / focus lights one up and shows its plate; each figure links to its agent page. Glow + the faint two-stroke V behind
them = the front agent's `ac`. Desktop (>1100px): the live card lies down into one strip across the hero bottom (act | NA top 3 side by
side, #tags hidden there, card pics hidden 1101-1300px) with the agents' feet behind it. <=1100px: the cast is a band across the top
and the copy rides over its fade; phones show the middle three only. Same day, Adrian: the desktop hero is
`min-height: calc(100vh - var(--topbar-height))` (it starts under the fixed bar) with rows `1fr auto`, so the live strip always sits on
the screen's bottom edge and the copy is centred in the space above it; the cast is capped at 860px tall; short screens (<=780px high)
get less air. Plates have no coloured left edge (Adrian: never on any card, ever). **Ticker, "Opened lately" and the hero facts strip (Patch / Map pool / Agents / Guns) were dropped** (Adrian; the hero's Jett bubble stays; title = "See who / keeps up", Adrian's pick, so the bubble's joke is "Spoiler: most of them can't.";
the player page still keeps `vl-recent`).
**v5 "agent select" (Nov 1 2026, Adrian: lineup felt boring; "remove all characters, keep Hush, < > to the next agent,
centre it, fill the right"; then "upgrade the whole page"; to QC)**: the 5-agent lineup is gone. `.vh` = copy | `.vh-stage`
(ONE render over the agent's own `-bg.webp` name art, used as a CSS mask filled with their `ac`/`ac2`) | `.vh-card` (role,
"Agent N of 30", Riot's bio, Joined / Patch / Origin wells, C/Q/E/X kit, grey "Open X's file"; the search keeps the band's one
red key). `agentSelect()` steps newest first (Hush, Miks, Veto...) and wraps; < > keys wear the face they go to, arrow keys +
touch swipe work, no autoplay; `--ac`/`--ac2` are `@property` colours so the light fades between agents. Layout: >=1500px three
columns (agent centred); 1101-1499 copy over card | agent; <=1100 stage band on top, then copy, card, live card. The roster
JSON now also carries `patch`, `origin`, `bio` (valorant-agents.py). Live strip top 3 = the player's `wideart` card faded in
behind + Radiant icon + wins (Worker `slimRow` already sent both). The **Agent spotlight band was replaced by the Roster**
(`drawRoster`: a box per role, 3:4 `-card.webp` portraits, newest first; phones = role tabs, 4 a row), since the hero now
does one-agent-with-kit. Map pool: the open slice shows its `-minimap.webp`. Ladder rows lost their coloured left stripe.
Same day, round 2 (Adrian): the < > keys sit beside the count in one `.vh-pager` under the agent's feet (no face pictures),
every size; "Competitive map pool", no red line under the open slice; roster role tabs (phones) = well at rest, raised grey
key when picked (shop + pro scene tabs still use the white pick); hero glows end above its bottom edge and the render's feet
fade, so no hard line into the page; strip's Full leaderboard key has 10px under it. **Phones**: `.vh-main` (stage + copy,
`display: contents` on desktop) = `100svh - topbar - 60px phone bar - 14px`, so at the top of the page the search always
sits just above the phone bar; the agent is capped at 300px, the agent card is hidden. Top of the ladder / NA top 3 =
the Worker's leaderboard call, cached 30 min (fresher than daily).
**Hero motion (Nov 1 2026, Adrian: the hero's Jett bubble became a plain subtitle `.vl-sub.vh-sub`; "lights moving really
really subtle" + more life; to QC)**: `.vh-fx` (valorant-lobby.css "BACKDROP") = Riot client's contour lines (`images/valorant/topo.webp`, baked by
`python scripts/valorant-topo.py`, a mask filled with the agent's `--ac`, opacity 0.07; the name art's shape is cut out of that mask by `cutName()` in
valorant-lobby.js so the lines run behind the name, never over it) + motes rising from the agent's feet, gone by the hero's middle (Adrian: never at the top); the drifting light
beams were tried and cut (Adrian didn't like them). Phones: the agent is a close-up, head to thighs (render 175% of the
stage, pinned top; every render shares the 1000x908 canvas with the head in the top 14%, so it fits all 30); the V strokes breathe; the copy rises line by line on load; every
`.vl-sec` rises in as it scrolls into view (`.vl-rise`, added by valorant-lobby.js only, so no JS = shown). Reduced motion =
all off. Headless shots: transitions don't run, so sections below the hero look blank there; not a bug.
**Every section subtitle is a Jett line** (Adrian: "every
subtitle should be bubble"). Agents: role tray (All + 4 roles with counts; a pick narrows the faces and shows that role's newest) and
the faces sit in `--cols` = half the roster, so two even rows. Ranked: "The climb" label on the stairs; Top of the ladder = ONE split
bar for the whole board + rows with RR cutoff and % of the board (the old bar per row made Immortal 1 look best). Buy menu: shops
grow by gun count so all four columns end level, bigger guns. Tools: "On the way" chips cut (Adrian: only what works); the Chat Art
card never draws the crosshair piece (it read as a crosshair). Pro scene: ongoing = red dot + word, not a red block on every row;
dates get a dash; news without a picture = the red mark on a scored tile.
**Player page** (`/valorant/player/<name>-<tag>`, `?id=` on GitHub Pages; Oct 30 2026, Adrian: "add everything", agent-page
look; to QC): ONE page for every player (`_redirects` 200 rule), `valorant-player.js/.css`, links valorant-agents.css and uses its
`.va-card` / `.va-stage` / `.va-facts` as they are. Banner = their player card wide behind the name + rank / peak / act /
leaderboard wells; tabs Overview (rank + RR bar, RR chart = one series + crosshair + table, last-20 strip + 12 numbers incl.
KAST / first kills / multi-kills, main agent on the stage, hit zones on the Weapons body, roles, party mates) / Matches (mode
chips, rows, `?m=<id>` = the game in a `<dialog>`: round timeline + each round's kills with gun + distance, scoreboard with
KAST / FK / MK) / Agents / Maps (attack + defense rounds) / Weapons (kills by gun, distance histogram, buys) / Acts (`?tab=`).
Worker types it adds: `mmr3` (v3: rank, peak, every act; the page falls back to v2 `mmr`), `rr` + `rrstored` (RR per game, merged
by match_id), `stored` (100 one-line older games); `matches` is slimmed by `slimMatch` (4.25 MB -> 1.35 MB a page of 10: no
positions; each kill keeps its `distance`), same field names, so the page reads Henrik's full shape too. Check:
`node _tools/valorant-worker-test.mjs`. Agents' art + colours = `site/valorant-roster.json`, written by valorant-agents.py.
Acts: Henrik's `e11a6` = "V26 Act VI" (e10 = V25: Riot's year names since 2025). Free-for-all modes have a team per player:
the page shows the placement. Searches are logged to Firestore `trackervalorant-42e14` "searches" (Firebase loads on open);
the last 6 players opened = localStorage `vl-recent`. Until the Worker is redeployed only account / mmr / matches answer.
Oct 30 2026 pass (Adrian): no Jett lines on the tracker; a loader (`.vp-load`, ticks off the 5 sources) is the only thing
shown until every source settles, then `reveal()` shows all at once; a section with no data is hidden whole (`drop()`, never
an "isn't available" box) and a tab left empty hides too; wins = green (`--vp-win`), never white; always the last **50**
games (5 Worker `matches` pages, start 0-40; no 20/50 switch, Adrian removed it); titles say the real count ("Last 19
games"). Tabs: Overview / Matches / Acts / Agents / Maps / Weapons. Number tiles + main-agent facts = compact rows (label
left, number right, raised rows in one well); phones (<=600px) drop the tile notes and the banner's rank wells, and every
tab is compressed there (short agent stage cut at the hips, 3-across agent cards, short map pictures).
**Leaderboard** (`/valorant/leaderboard`, Nov 1 2026, Adrian: "go crazy", to QC): `valorant-leaderboard.js/.css` on the Ranks
shell. Region tray (`?region=`, NA default), Top 3 podium (each player's tall `largeart` card, #1 in the middle), Radiant + Immortal
tier cards (cutoff / players / places from `thresholds[].start_index`, a click jumps to the tier's first place) over one split bar,
then the ladder: 100 rows a page (`?page=`), a band where a new tier starts, RR bar = share of #1's RR, Riot ID find + "go to
place" (`?rank=` marks a row; the player page's Leaderboard well links here). Anonymized players = "Secret Agent" (Riot's word).
Worker `type=ladder` (Henrik v3 `size=100&page=N`, or `name=&tag=` for one player; page 1-999; 30 min cache), rows trimmed by
`slimRow` (shared with `type=leaderboard`). No past acts: valorant-weapons.json only knows today's act, Henrik takes
`season_short` if that's ever wanted. Worker deployed Nov 1 2026 (version 5ffc4884). Henrik's find answers 404 "Player not found
in leaderboard" for anyone off the board (the page says so); boards hold Immortal 1+ only (NA 9,359 / EU 15,000 that day).
**The line** (Nov 1 2026, Adrian: when Henrik's key is full, wait in line and show the place, never an error; player profile
+ leaderboard; no time limit; profile keeps its loader with a line added). Worker `Gate` = one Durable Object (`GATE`,
wrangler.toml migration v1, SQLite = free plan) that counts every Henrik call for everyone: at most `PER_MIN` (28 = Basic key's
30 minus 2 spare; **set 88 if Henrik grants the Enhanced key**, then redeploy) in any 60 s. Pages take a ticket
(`type=ticket&cost=N`: profile 11, leaderboard 1 a call), poll it (`&id=`) while waiting, send `&pass=` with their calls and
say `&done=1` after (unused calls go back: cached answers cost nothing). Calls without a pass (lobby, Ranks, map pool) go only
when nobody waits, else they get 429 and hide as before. A ticket not polled for 20 s leaves the line (tab closed; also a tab
the browser throttles hard in the background, which then re-joins at the back). Gate down = calls go through as before.
Browser side = `site/valorant-line.js` (`vlLine`). Checks: `node _tools/valorant-worker-test.mjs` (Gate maths),
`node _tools/valorant-line-test.mjs` (page -> Worker -> Gate end to end).
**Weapons** (`/valorant/weapons`, Oct 29 2026, the first Database page, Adrian to QC): sub-pages wear CODM's `.cb` banner
(the page links codm-banner.css + codm-tools.css for `.ct-*` / Gun Stats' `.gs-*`; valorant.css swaps the art = Chamber
hue-rotated red; Adrian: "as simple as possible, similar to the other pages"). Data = `site/valorant-weapons.json`, written
daily by `.github/workflows/valorant-feed.yml` -> `scripts/valorant-feed.mjs` (valorant-api's /weapons is 3.6 MB, this is
19 KB; also patch, acts, skin tiers, and `log` = every stat change between runs). One gun's skins are fetched from
valorant-api only when its panel opens. `valorant-weapons.js/.css`: buy menu (4 shop columns), Compare chart + sheet,
One-shot ranges, sortable list, Patch changes, gun panel `<dialog>` (`?w=<id>`: damage body, shots-to-kill grid, stats,
skins + chromas + video). TTK model: 100 HP + shields (light 25, heavy 50) soaking 1:1, no shotgun TTK. Both pages link
`site/valorant.css` (page base + tokens only: chrome is 11layout's); the old 490-line CoC head `<style>` is gone, the
sections' own `<style>` blocks still sit in the body. **API = Cloudflare Worker** `cloudflare/valorant-api/worker.js`
(`parchrome-valorant`, same setup as coc-api; secret `HENRIK_API_KEY`): `type=account|mmr|matches|queue` = HenrikDev,
`type=news` = VLR.gg's RSS (replaced the free CORS proxies), `type=og` = one VLR article's picture. The Henrik key is
never in a page. Section art lives in `site/images/valorant/` (was hotlinked from Pinterest).
**Maps** (`/valorant/maps/` + `/valorant/maps/<slug>`, Oct 30 2026, Adrian to QC): one static page per map, GENERATED by
`python scripts/valorant-maps.py` from valorant-api /v1/maps (pictures baked to `images/valorant/maps/`, callouts, sites) +
the hand-written `scripts/valorant-maps.json` (dates, places, blurbs, guides; every tip checked against a reference, Adrian's
fact-check is final). Edit those and rerun, never the pages. Every map in the game (Adrian picked "all"): Competitive, TDM,
other modes, newest first inside each mode (the list puts today's ranked pool first, live); no map tier list (Adrian).
Minimap = Adrian's "in-game style": site letters + faint Attack / Defend words only, other callouts show while picked.
valorant-api's callout numbers are stale on some maps (Summit's attacker spawn sits in empty space, Pearl is off
everywhere), so the script checks every spot against the minimap picture: site letters go on the olive plant areas
Riot draws, spots off the drawing are dropped (spawns snap if within 5%), Pearl = names only (`callout_spots: false`).
TDM maps ship all-zero position numbers: names only. Ranked pool badges are live (Worker `type=queue`, valorant-maps.js). A new map = its JSON entry +
rerun (the script warns about API maps it doesn't know). The Weapons + Maps ground lives in valorant.css "GROUND"
(`<body class="vl-ground">`).
**Crosshairs** (`/valorant/crosshairs`, Oct 30 2026, Adrian to QC): rebuilt on the Weapons shell (`.cb` banner whose well
draws your crosshair live, `.ct-sec` sections, Jett); all code in `valorant-crosshairs.js/.css` (the old in-body hero / news /
tracker leftovers are gone). Maker = 16:9 stage (1x = real size: 1 game px per screen px, map at 1080p scale) + panel tabs
Crosshair / Inner / Outer, Still / Walk / Spray test, background picker under the stage with two tabs (Adrian): **Textures**
(default: 10 seamless 512px surfaces we bake ourselves -- sandstone, crate, metal, brick... -- repeated as a canvas pattern,
+ Dark / Bright) and **Maps** (every map's shot). `python scripts/valorant-crosshair-backgrounds.py` bakes both into
`images/valorant/crosshairs/` (rerun after a new map; its texture list must match TEXTURES in the JS). The map shots are
aerial views, so they can't give close-up surfaces: that's why the textures are drawn, not cropped. Code engine = the game's profile code:
only non-defaults written; the general block, A (ADS), S (sniper) and unknown P keys are kept as pasted, so pro codes
round-trip. Key meanings: agatasmurf.com's table + senslab.pro's defaults; `f` (fade with firing error) and `0g`/`1g`
(separate vertical length) are inferred from pro codes, so Adrian should confirm them in game. Starters are Parchrome's own designs (never
attribute a code to a player without a source); saved = localStorage `vl-xh-saved`; the address holds `?c=<code>`.
**Ranks** (`/valorant/ranks`, Oct 30 2026, Adrian to QC): `valorant-ranks.js/.css`. The `.cb-tabs` tray is the ladder (`?r=gold`, icon over
name so all 9 fit 1280px); icons are baked to `images/valorant/ranks/<tier id>.webp` (valorant-api, 3 = Iron 1 ... 27 = Radiant). The rules
come from Riot's support pages (RR, Iron-Ascendant, Immortal-Radiant, Competitive FAQ, May 2026): duo/trio = `partyOK`, regional Immortal 2/3 +
Radiant minimums = `FLOOR`; edit those when Riot changes them (check: `node _tools/valorant-ranks-test.mjs`). **There's no rank distribution on purpose**
(Adrian: real numbers only): Riot publishes none, so only the Immortal+ counts are shown, live from the leaderboard (Worker `type=leaderboard` = Henrik
v3 trimmed to cutoffs + total + top 10, 30 min cache). The lobby's "Top of the ladder" shows the same live NA counts.
**Chat Art** (`/valorant/chat-art` maker + `/valorant/chat-art-gallery`, a separate page by Adrian's call; Oct 30 2026, Adrian to QC):
one script `valorant-chatart.js` + `.css` for both pages. A drawing = ONE line of rows exactly W glyphs wide (chat's wrap stacks them),
glyphs █▓▒░▀▄▌▐■ only, empty cells = a shade, never a space. **W = 26 is valorantscout.com's number, not checked in game**: both pages
say "Unverified" and the maker has a Width setting (12-40); once Adrian tests it, fix the default and drop the notes. Previews are drawn
as blocks on canvas (no font), each glyph 2x as tall as wide (`CELL`, also a guess). Maker: Draw / Text (3x5 block font) / Picture
(stays on the device), share = `?a=<w><bg>.<runs>` (`decode` rejects anything off), saved = localStorage `vl-chatart-saved`. Gallery =
`site/valorant-chatart.json`, Parchrome's own pieces only (text or pixel rows; ids permanent). Check: `node _tools/valorant-chatart-test.mjs`.
**Sensitivity Converter** (`/valorant/sensitivity`, Oct 30 2026, Adrian picked layout "B", to QC): `valorant-sensitivity.js/.css`,
no API. Valorant sens = sens x yaw / 0.07, cm/360 = 914.4 / (DPI x sens x yaw); the `GAMES` list = only yaws the open-source
converters + KovaaK's agree on (CS2/Apex/TF2 0.022, OW2 + CoD 0.0066, Fortnite 0.005555 per %, Rivals 0.0175, R6 0.00572958 at the
default 0.02 multiplier). Deadlock / Destiny 2 / Roblox / The Finals are left out until Adrian 360-tests them in game. Scoped aim is
not converted (no source for a "correct" multiplier). Dial = top-down turn with Valorant's 103 degree cone + mouse-distance slider
(`.gs-dist`). Address = `?from=<id>&sens=&dpi=`.
**Agents** (`/valorant/agents/` + `/valorant/agents/<slug>`, Oct 30 2026, Adrian to QC): GENERATED by `python
scripts/valorant-agents.py` (reuses valorant-maps.py's helpers + the Weapons shell) from valorant-api /v1/agents (pictures
baked to `images/valorant/agents/`: portrait, face, name-art, a 3:4 card crop centred on the head = the JSON's `card_x`, set by eye because effects fooled the automatic guess; `--cards` re-crops, ability + role icons;
bio, colours, abilities) + the hand-written `scripts/valorant-agents.json` (release date + patch + act, real name, origin,
Protocol number, voice: from the Fandom wiki's `Template:Agent Infobox Shortcut`, read through its api.php; valoranthub.com
had Reyna's real name, Sova's town, Astra's city and Skye / Harbor / Clove's patches wrong, don't copy it). Edit those and
rerun, never the pages. A new agent = its JSON row (release order) + rerun (the script warns about API agents it doesn't know).
Index: role tray (`?role=`), big cards (release date in the plate, Adrian: on the picture it covered faces), year columns,
sortable table, roles, how to unlock. Agent page: file (portrait stage + bio + facts), abilities (C / Q / E / X + passive),
release rail, same-role cards. `valorant-agents.css/.js`; the agent's colour (`--ac`) stays inside picture wells.
**Banner texture (Nov 1 2026, Adrian)**: every Valorant `.cb` (incl. the player page's `.vp-cb`) lost CODM's grid squares
for the lobby hero's contour lines, very faint: valorant.css `.cb::before` (topo.webp as a mask, opacity 0.035, left side only
on desktop, all across at opacity 0.03 on phones). Bumping valorant.css's `?v=` = all 63 pages + `VALORANT_CSS_V` in
valorant-maps.py (agents + maps pages are generated). Lobby, same day: the hero clips sideways only (`overflow: clip visible`)
so the live strip's shadow fades past its bottom edge; the Ranked well redraws its ring over the steps (`.vl-stairs-wrap::after`).
**Tabs under the search (Nov 1 2026, Adrian, every size)**: Weapons' type tray sits under its search / distance / hit / shields
bar; Agents' role tray (`.va-roster-tabs`, written by valorant-agents.py; `.va-roles` was already taken) sits inside The roster
under the search + order row and still filters the table further down. Maps + Ranks have no search, so their trays stay under
the banner. Lobby phones (same day): NA's top 3 is hidden (the live card = act clock only), sections 64px apart.
**Look (Oct 29 2026, Adrian):** titles = **Tourney** italic 800 (valorant.css "TITLES"; Riot's Tungsten is licensed,
never host it; Anton / League Gothic / the Valorant look were turned down), no red tab on the `.cb` banner.
Text (Oct 31 2026, Adrian): paragraphs + small text (tables like `.gs-table-wrap`) = **Sora**, Oxanium only for
subtitles / labels / keys (valorant.css: `.coc-main` = Sora, a rule must name Oxanium; uppercase labels = its "LABELS" list). Weapons
wears the TH pages' ground (valorant-weapons.css "GROUND"). **Guide = Jett** (the Villager's `.cv-say` bubble,
coc-villager.css, label "Jett", face `images/valorant/jett/face.webp` from valorant-api): she replaces the section
subtitles on Weapons + Crosshairs (Lobby not yet). Voice = her real lines (wiki.playvalorant.com/en-us/Jett/Quotes):
cocky, quick, "Night night", "keep up", Operator fan; follow the `.cv-say` line rules (CoC section above).
