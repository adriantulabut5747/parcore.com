# Animated tool cards + session handoff (Oct 20 2026)

Read this before touching the CoC "Parchrome tools" band, the animated tool
cards, or anything listed under "Open items". It records what Adrian wants,
how he wants it, and exactly where the work stands.

---

## 1. How Adrian works (rules, in his words where possible)

- **Ask before implementing** when a request has more than one reading or
  touches a visible design choice. Use clarifying questions; offer a
  recommended option first.
- **Don't sugarcoat.** If an idea is weak, say so plainly and explain why.
  Stress-test his ideas; make them bulletproof.
- **Build one piece first, he quality-checks, then do the rest.** He said
  "let's do 1 first and I'm gonna quality check it". Never roll a design out
  to every card/page before he approves the pilot.
- **Preview first, live site second.** Animated cards are built in a preview
  file (`_tools/tool-cards/tool-cards.html`), not in `site/`, until he signs off.
- **"Go crazy, but professionally clean."** Ambitious, but no clutter, no
  generic AI look, no glows-for-decoration, no gradient text.
- **Real data only.** Every number shown must be true (see section 4). If an
  effect would show something false (e.g. "Destroyed" on a building that
  survives), change the setup so it's true, and tell him.
- **Explain the non-obvious** (he's new to the codebase), but keep replies
  tight. He reads screenshots, not essays.
- **Verify visually** before saying done: render frames (section 6) at desktop
  and phone widths and fix overlaps/clipping yourself.
- **Mobile matters** (most visitors are on phones).

## 2. The animated tool cards (current task)

### Goal
Replace the `/coc/` "Parchrome tools" band (`section.pt-band` in
`site/coc/index.html`, ~line 2893 + its CSS ~line 3838) with a grid of
**laby.net/tools-style animated cards**, Clash of Clans flavoured.
He rejected three earlier static mockups (bento / showroom / in-game menu;
kept in `_tools/tool-cards/pt-mock.html` for reference only, do not reuse).

### What laby.net does (and what Adrian wants copied)
Checked from their page source: every card's art is **hand-written inline
SVG + CSS keyframes**, no images, no Lottie/Rive, no libraries. Their rules:
1. **One subject** on a soft coloured glow, in a narrow right-hand column
   (~128px). Not wide.
2. **One motion that shows what the tool does** (dye drips onto armor,
   banner waves). No UI/numbers/labels crowding the art.
3. **Idle = subtle and slow. Hover = the same motion, more/faster/special**
   (fireworks: 1 rocket idle, 3 on hover; banner waves faster on hover).
4. Reduced-motion users get a still frame.

Adrian's additions (all required):
- Art column is **narrow** (cards should not spend width on art). The Army
  Maker stays **horizontal**; everything else should follow laby's compact,
  height-based column.
- **Hovering off must not snap**: the hover loop finishes, then idles
  (laby snaps; we do better). Phones (no hover) play the hover loop once
  when the card scrolls into view.
- For CoC we use **the site's real game art** (webp in `site/clashofclans/`)
  as the actors and draw effects (bolts, rings, bars) in CSS/SVG. CoC art is
  glossy 3D, so don't redraw it as pixel SVG. No extra software or MCP needed.

### Status
| Card | Status |
|---|---|
| Army Maker | Approved direction; in preview. See below. |
| Damage Calculator | In preview, last round of his feedback applied. Awaiting his QC. |
| Player Tracker | In preview: Legend badge, magnifier idle; hover = league slot-spin lands on Legend + rays/streaks. Text "Look up any player or clan by tag." |
| Leaderboards | Oct 25 2026 rework, LIVE: the nav's own trophy picture (`icons/leaderboards.webp`, cup on rubble). Idle 6s: glint over the cup + sparkles wink. Hover 2.4s: the game's tap bounce + a ring of 4-point sparkles. Replaced the "You climbs" board (Adrian: drop it). |
| Wall Calculator | In preview: 10M tag -> Hammer Jam 5M -> Gold Pass 4M (old prices fall off, coins), wall 18 -> 19 with light pillar. |
| Equipment | In preview: Rocket Spear turns over the Blacksmith; hover = 3 anvil strikes send Shiny/Glowy/Starry Ore up, 26 -> 27. |
| Clash Tier List | Oct 25 2026 REDESIGN, LIVE (Adrian: the 3 x 3 board had no focal point): one tier row up close, the tier maker's big S label (PAL colours) + a Dragon card (= nav icon). Idle 6s: Dragon bobs, glint on S. Hover 2.4s: Dragon lifts, the label spins F E D C B A like a reel, lands on S, Dragon drops in, sparkles. |
| Glossary | Oct 25 2026 rework, LIVE: the Book of Everything (nav icon) drawn in CSS so it opens: red leather, gold frame + hourglass, cream pages. Idle 12s: open, 2 page turns, cover shuts (slides to centre), reopens. Hover 3.6s: 3 riffles (3 leaves each) with a thump + gold sparkles. Adrian: NO rays / sunburst glow behind it on hover (removed). |
| Legend Tracker | Oct 25 2026, LIVE (`lgt-`): the Legend Trophy decoration (`icons/legend-trophy.webp`, from ClashKing's assets, also the nav icon). Idle 6s: one hit, tap bounce + "+40" (max trophies per Legend attack) rises. Hover 2.4s: three hits. |
| War Planner | Oct 25 2026, LIVE (`ws-`; `wp-` is the planner page's): two swords (`clashofclans/coctools/sword.webp`, ClashKing; the second mirrored) swing back on their grips and clash (flash, sparkles, streaks). Idle 6s: one clash. Hover 2.4s: two. |

**Oct 26 2026 (Adrian): Army Maker + Damage Calculator are HOT too** (4 HOT cards). The top bar's Tools menu, the More sheet's Tools tiles and the tool-page chips follow the band's order, read from `coc-nav-data.json` `guides` (array order = menu order; `"hot": true` = the tag: `.stb-dd-tag--hot` in 11layout.css, `.mx-hot` in coc-more.css (straddles the tile's top edge so it costs the name no width), `.dsn-hot`). Change the band's order or HOT set? Change that JSON too.

**Oct 25 2026 (Adrian): order + HOT.** Player Tracker and Equipment lead the band with a HOT tag (`.ptc-hot`, the TH pages' `.base-tag--hot` red key + flame): desktop = its own line above the name, tiles = top-left corner. Still frames (reduced motion + /coc/ phones): Army Maker shows its three troop cards round the camp; Damage Calculator shows the Monolith destroyed (DESTROYED stamp, no HP bar).

**Oct 25 2026 (Adrian): every blurb = exactly 2 lines** (desktop long + phone short). `.ptc-desc` is capped at 31ch so a line holds ~the same letters at every width; long blurbs ~42-50 letters, short ~38-46. Measured 2 lines on /coc/ and /coc/tools/ at 360-1920px: re-measure after any text edit.

**Oct 25 2026 (Adrian): phones = 2 tiles a row.** Below a 620px band (container query at the end of the CSS) each card is a tile: art on top, centred (`--s` .5, scaled from its top centre), name 14px + the short blurb (`text-wrap: balance`, max 2 lines), no hover arrow. ~150px a tile.

**Oct 25 2026 (Adrian):** on /coc/ phones (≤760px, `.coc-home`) the cards are STILL (the reduced-motion frames: CSS turns animations off, cards.js.html skips the hover loop) because they lagged there. /coc/tools/ keeps the animation.

**Oct 24 2026 (Adrian):** the cards are now sunken wells (`--sunk` / `--sink` in build_cards.py), shorter (104px desktop / 92px phones, art `--s` .66 / .6), names 18/17px, blurbs 12px.

**LIVE since Oct 20 2026 (night).** All nine cards replaced the grouped link
list in the /coc/ "Parchrome tools" band. `python build_cards.py` (in
`_tools/tool-cards/`) is the one source: it writes the preview AND
`site/tool-cards.css`, `site/tool-cards.js` and the markup between the
`<!-- TOOL CARDS: -->` / `<!-- /TOOL CARDS -->` markers in
`site/coc/index.html`. Never hand-edit those three; edit build_cards.py /
cards.js.html and rerun (`--preview` to touch only the preview).
- Classes are `ptc-*` (renamed from `tc-*`: coc-cards.css owns `.tc-name`/`.tc-desc`).
- **Oct 21 2026: also on /coc/tools/** ("Parchrome tools" section, replacing
  its old static `.tc-card` list; backup in `Downloads/parcore.com/_backup/coc-tools/`).
  `PAGES` in build_cards.py lists every page that gets the block; a page needs
  the TOOL CARDS markers plus `<link href="/tool-cards.css?v=...">` and
  `<script src="/tool-cards.js?v=..." defer>`. The `?v=` is now set by the
  build (hash of the css + js), so no manual bump.
- Each card's art root is `<xx>-art` (`am-art`, `dc-art`, ...), never a bare
  2-letter class: `.am` is styled by coc-armymaker.css (+4 more) and `.dc` by
  coc-damage-calc.css, which drew a stray box behind the Army Maker on /coc/tools/.
- Cards are shorter: the art stage stays 160px but is scaled by `--s`
  (.75 desktop, .74 phones; desktop min-height 122px since Oct 21 2026), so animation geometry never changes.
- Columns follow the band's width (container query on `.ptc-wrap`):
  1 -> 2 (Army Maker full row) -> 3 x 3.
- Box (Oct 21 2026, Adrian called the old one "rainbow" / "AI slop"): one
  neutral raised-UI box for every card, no per-card colour (a card's colour
  is only its art's own glow). Art and copy share one surface: he rejected
  a sunken panel behind the art ("don't separate them"). The art is centred
  in a column of one width on all cards (`--well-w`: 136px, phones 128px) so
  it lines up down the grid. The coloured notch, category chip (Attack / Track / ...),
  hatch and accent hover ring were removed. `python build_cards.py --preview`
  rebuilds only the preview; without the flag it also writes the live files.
- Preview uses `<base href="http://localhost:8765/">` with root-absolute paths.

Oct 20 2026 (later): Adrian asked for "wow" on every card. Shared effects
(`fx-` in build_cards.py: `streaks()`, `embers()`, `.fx-rays`) add bursts
timed by each card's keyframes. Army Maker and Damage Calculator were left
as they were. All cards await his QC. `frames.mjs` / `cdp.mjs` now delete
their temporary Chrome profiles (94 leftovers had piled up in %TEMP%).

All nine cards are live on /coc/ (see "LIVE" below the table for how the
site files are generated).

### Oct 21 2026 rework (in preview, awaiting his QC)
He said Army Maker and Equipment "don't feel like they belong" and asked for
them simplified; also new art for Damage Calculator and colour for Leaderboards.
- **Army Maker**: slot bar, capacity counter and "+7" removed. Now one subject
  like the rest: the Army Camp (96px) on a blue glow, art column 136px.
  Idle 8s: Rocket Balloon, Super Minion, Healer drop in one at a time and sink
  into the camp (camp squashes on each). Hover 3s (`am-go`, clock `amh-camp`):
  the three in quick succession, then the camp hops and a ring ripples.
- **Damage Calculator**: **level 1 Monolith (4747 HP)** replaces the Cannon,
  with a **dark purple** health bar (his call: "like CoC"). Lightning 13 =
  720 = 15.2% a bolt. Idle 8s: 2 bolts (4747 -> 4027 -> 3307). Hover is now
  **4s with 7 bolts** (7 x 720 = 5040 >= 4747, he chose this over keeping 3
  bolts without the stamp), then DESTROYED. The seven -720s rotate between
  three spots.
- **Leaderboards**: rows in the game's league-panel blue (his pick: "game
  coloured rows"), ranks 1-3 gold / silver / bronze, You = brighter blue key;
  the hover still turns You gold at #1.
- **Equipment**: his idea -- the Grand Warden's **Fireball, falling**. It
  holds still with a slow wobble while a flame trail streams up off it and
  wind streaks, embers and ash rush up past it. Hover 3s (`eq-go`, clock
  `eqh-heat`): it heats up (white-hot core, glow swells, trail lengthens, a
  fine tremor) and a second, faster set of streaks / embers fades in. Particles
  are generated (seeded) with their own durations so no pattern shows. The
  Rocket Spear / Blacksmith / ores / 26 -> 27 chip are gone.

## 3. Card system (how the preview is built)

Source: `_tools/tool-cards/build_cards.py` → writes `tool-cards.html`
(needs `cards.js.html` beside it). Run `python build_cards.py` from that
folder; open the HTML in Chrome **with `python _tools/serve.py` running**
(art loads from `http://localhost:8765/`).

- `.tc` card = raised-UI box (2px #060708 edge, `--lb-*` shadows). Art is a
  right column `.tc-art` of width `--art-w` (per card); `.tc-copy` gets
  `calc(100% - var(--art-w))`. `container-type: inline-size` + an
  `@container (max-width: 400px)` rule scales wide art (Army) on phones.
- Art has 3 parallax layers `.art-far/.art-mid/.art-near` that lean toward
  the pointer (`--mx/--my`, fine pointers only).
- **Shared JS** (`cards.js.html`): animations run only while on screen
  (`.is-on` via IntersectionObserver); `data-go="<class>"` adds the hover
  class on pointerenter/focus; on leave it waits for `animationiteration` of
  the animation named in `data-clock` before removing it (no snap); touch
  devices get one hover loop on scroll-in (threshold .6).
- Counters/bars use `@property` integers/numbers (`--am-cap`, `--dc-p`,
  `--dc-g`) so numbers tick and bar widths animate; `counter()` shows them.
- Keyframes with many timed beats are **generated in Python** (percentages
  per hit/slot). Elements are **top-anchored** so a taller card can't bend
  flight paths.
- Gotchas hit this session: `:nth-of-type` counts all siblings of the same
  tag (wrap groups); a `z-index`/`transform` on the art box makes a stacking
  context (keep layers able to sit above the copy scrim if one is used);
  flying elements need `z-index` above later siblings.
- Reduced motion: every card shows a meaningful still frame.

## 4. Real numbers used (verify before changing)
- TH18 #1 army (`site/th18-army.json` id 10, decoded with
  `coc-army-data.json`): 9 Rocket Balloon, 6 Super Minion, 5 Healer,
  3 Furnace, 2 Ice Golem + Archer, Minion, Yeti, Wall Breaker, Headhunter =
  352 housing (TH18 camp = 352).
- `site/coc-damage-calc.json`: Cannon 19 = 2000 HP, Cannon 21 = 2250 HP,
  Lightning 13 = 720. 3×720 = 2160 destroys Cannon 19, NOT Cannon 21.
- Walls: Hammer Jam halves the price, Gold Pass then takes 20% (−60% total).
- The /coc/ hero says **8 tools**; the band now has **8** cards too (Oct 21 2026, tier lists merged).

## 5. Other changes made this session (all live in `site/`)
- Minecraft Java home (`site/minecraft/java/index.html`): hero headline
  "Find your next / world." with the red word cycling world/seed/shader/
  pack/mod/command and the CTA following it (inline script after the hero);
  "Minecraft · Java Edition" badge above it; crumb now "Minecraft Java
  Edition" (`mc-java.js` ~2522); version ages read "updated N days ago";
  "View all" on the title row on phones; hotbar icons brighter on touch.
- Section-title accent words (`<em>`) are **white, not red** site-wide on CoC
  and Minecraft (`.lob-title`, `.mch-sec-title`, `.lb-title`, `.clan-title`).
  Page-hero titles (`.tb-title`, Minecraft hero) keep red. Adrian's rule:
  red for the hero and main actions only.
- Section titles size: **37px desktop / 15px phones** (= Web Resources
  `.layouts-title` on phones) for `.lob-title`, `.lb-title`,
  `.mch-sec-title` (blocks at the end of `coc-hub-menus.css` and
  `mc-home.css`).
- Minecraft bottom nav uses the CoC bn look (sentence case, Oxanium 10.5px
  /500, grey icons until active): block at end of `mc-java.css`.
- Minecraft Tools icon = anvil (`site/minecrafticons/anvil.png`, 128px
  nearest-neighbour from items/anvil.png) via `mc-contents.json`.
- `/coc/` phones: the ch-ticker now sits **under** the hero (like desktop);
  the hero carries the 38px top gap for the secondary bar.

## 6. Verifying (headless Chrome over CDP, Node 24, no installs)
In `_tools/tool-cards/`:
- `node cdp.mjs <url> <w> <h> <mobile 0|1> [--js file.js] [--shot out.png] [--full]`
  (device emulation bypasses the 500px floor; mobile=1 sets hover:none).
- `node frames.mjs <url> <w> <h> <mobile> <selector> <prefix> 0.5,1.2,... ["preJS"]`
  pauses every animation at each time (seconds) and screenshots the element.
  Use preJS like `document.querySelector('.dc').classList.add('dc-go')` to
  capture hover frames. Contact-sheet the PNGs with PIL to review.
- Can't be verified headless: real hover-off behaviour, pointer lean, touch
  scroll-in play. Tell Adrian to check those in a real browser.

## 7. Open items (raise these, don't silently fix)
- `site/minecraft/java/index.html` `<title>` is **"AC | Parcore"** (copied
  from Assassin's Creed). Worst SEO bug on that page; not yet fixed.
- Article cards' badge says **"Parcore"**; brand is **Parchrome**.
- Minecraft bottom nav: **Story / Dungeons** are greyed, unbuilt links in
  prime slots (he chose "restyle only" for now).
- The Minecraft hero badge is an eyebrow above the heading, which the
  impeccable design rules ban; offer removing it.
- Damage Calculator: in-game, the health bar only appears once damaged; we
  show it at full on purpose. Offer "appear on first hit" if he wants it exact.
- ~~Hero "8 tools" vs 9 listed~~: resolved, 8 cards since the tier lists merged.
