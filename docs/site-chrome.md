# Shared chrome (site-wide)

Moved out of CLAUDE.md on Nov 1 2026, unchanged. Paths like `parcore.com/docs/x.md` are relative to the outer folder.

## Raised UI (Oct 2026, laby.net-style look, site-wide)

Every box / button / field wears one of three recipes: **box** (2px #060708 edge, light
ring + top line, soft drop), **key** (same edge + a darker bottom ledge; grey, or red for
a main action) and **well** (sunken). **Every well needs the light line under its bottom edge, not only the
dark edge (Adrian, Oct 31 2026: "it annoys me"):** the `.lb-search` / `.ch-find-field` look = `--card-well`
(`… , 0 1px 0 rgba(255, 255, 255, 0.05)`). 11layout's `--lb-ring-well` lacks it, so a new well uses
`--card-well`, or appends that line to `--lb-ring-well`. Clash Royale redefines `--lb-ring-well` with the line in
cr.css "WELLS". The other sections still don't have it. Every new sunken or raised piece, any section, ships with its light line. Tokens `--lb-*` live in `:root` in 11layout.css,
whose "RAISED UI" block also styles all chrome (bars, hover menus, sidebar, bottom bar,
More sheet). Section pieces used to live in `site/raised.css` (gone by Oct 29 2026: the file no longer exists;
restyle in 11layout.css or the section's own file). Its prefix
`html:root body:not(#raised)` outranks the section files, so restyle there, not in them.
"You are here" in navigation = grey key; a picked tab/chip/page in content = `--lb-pick`
(red). **CoC pages differ (Oct 21 2026, Adrian's call):** every tab, chip and switch is a
sunken well at rest and the raised grey key when picked -- the TH18 Layouts/Army/Tools
recipe. One selector list in th-layouts.css "TABS + CARD ACTIONS" covers the tools' chips
(`.gd-chip`, `.am-tab`, `.dc-sort`, `.am-th`, `.wl-chip`): add a new CoC chip there,
never a white `--lb-pick`. The trackers' tabs/switches share it in coc-tracker.css, whose
panels are boxes and number trays wells. Wells (`.am-part`) pad all four sides. Drop-downs
on CoC pages = `.am-th` key + `.am-pop` menu (coc-armymaker.css), never a native `<select>`
list (leaderboard region: coc-stats.js `regionPicker`). **Tier list** (Oct 21 2026): one page,
`/coc/tools/tier-list` (`coc-tierlist.js/.css`), `?type=equipment` or troops by default;
`troop-tier-list` 301s, `equipment-tier-list.html` is a forwarding page that keeps the query
(a `_redirects` target with its own `?` may drop a shared board's `r=`). **Search bars** (Oct 22 2026): one look, 11layout.css "SUNKEN SEARCH BAR" (`.lb-search` well +
`.lb-search-input` + red `.lb-search-btn` key) -- the home hero's bar. In-page filters wrap it in a
`<label for=…>` with the key as a `<span>` (seeds, commands, mods, data-packs, resource-packs, shaders);
page CSS adds width only. Minecraft Java boxes are in mc-home.css "RAISED BOXES", Mob Summon in mc-tool.css
"v8 RAISED". Left alone on purpose: nothing now (CODM `.champ-*` joined the `.pg` sections Oct 29 2026). Layout never
changes in these rules: only fill, edge, radius and depth.

## Desktop bar (Oct 2026)

Desktop has ONE bar: `.secondary-top-bar` at y=0, 64px (the primary `.top-bar`
is hidden ≥971px; phones keep it). Layout: page title | menus (`.stb-hub-nav`) |
search (`.stb-search`, added by 11layout.js) | page buttons. The section chip
strips (`.stb-dsn-wrap`) are hidden on desktop; their pages live in hover menus.
All of it is the "ONE DESKTOP BAR" block at the end of 11layout.css — selectors
are prefixed `html body` on purpose so later page stylesheets (1coclayouts.css,
th-layouts.css…) can't re-position the bar. `--topbar-height` is 16px on desktop
(= 64 − the old 48px bar), which is what keeps every page's content gap intact.
Hover menus: one engine, `window.stbHubMenus(strip, {lists, keyOf, …})` in
11layout.js (rows can have `children` → side panel). Data: coc-hub-menus.js
(CoC), buildHubNav in 11layout.js (Web Resources: Resources → categories →
sections from hwr-categories.json "sections"), buildGroups in 11layout.js (Minecraft + Genshin: game-nav.json
`groups`). CoC nav icons are pictures (Oct 2026), not SVGs: `site/icons/coc-nav/`
(96px WebP — lobby tower, tools anvil, thNN Town Hall, barracks-thNN), paths in
coc-nav-data.json (`primaryNav.*.icon` = TH18 defaults, per-TH `navIcon` /
`navArmyIcon`). A TH page shows its own TH's pictures; every other CoC page shows
TH18's. Grey at rest, colour when active: `.coc-nav-pic` in coc-hub-menus.css. Built by
th-layouts.js (top bar + hero tabs) and /coc/'s inline copy; each CoC `#bottomNav`
has them as static `<img>` — change all together.

## Game sections (Valorant, CODM, Genshin, Tekken)

All chrome comes from 11layout — no per-page nav code. `<body data-game-nav="<key>">`
switches it on; `site/game-nav.json[<key>]` lists the section's pages. 11layout.js
builds the secondary-bar strip, the desktop breadcrumb, the phone bottom nav
(`"bottomNav": true` entries, 2 + More + 2) and the More sheet from it; `"soon": true`
renders a greyed, unclickable entry. Adding a page = one JSON entry. The bottom
nav + More sheet CSS is 11layout's for every page (the open/close JS is still CoC's
thz-script.js / hwr-js.js copies on those two). Bump the `?v=` on 11layout links site-wide
when 11layout.js/css change.

## Shared chrome = 11layout.css only (Oct 28 2026, Adrian)

**Chrome fonts (Oct 31 2026, Adrian; Nov 1 2026):** breadcrumbs are **Sora on every width** (desktop 13px = the old
14px Oxanium's width), the top bar's "Parchrome" word is Sora (15.5px phones, = 17px Oxanium x 0.92), and so is every
desktop menu key, hover menu row and its Soon / Hot tag. /coc/'s lone bar title "Clash of Clans" is the trail's grey (not
white); the Minecraft lobby's phone trail is just "Minecraft". **Tourney section titles** use `--fs-title-tourney`
(11layout.css: `--fs-title` + 2px on desktop, **24px on phones**, Nov 1 2026, every section); phone page banners
(`.tb-title`, Minecraft's tool `.mch-hero-title`) are 28px so they stay above them. On phones the secondary top bar, and on every width the More sheet + bottom
bar, are Sora on every section (11layout.css "PHONE BAR = SORA" / "MORE SHEET + PHONE BAR = SORA", `!important` so
section rules can't bring Oxanium back; the "i" help panel keeps its own fonts). Desktop's menus keep their own font.
CoC, Genshin and Web Resources share ONE copy of the More sheet, phone bar, top bar
(incl. the "i" help key + its panel shell), sidebar and hero search bar, all in 11layout.css.
Never re-add a copy to a section file (1coclayouts.css, th-layouts.css, hwr-css.css,
genshin.css, /coc/'s inline styles): restyle in 11layout, once. coc-more.css is gone
(= 11layout.css "MORE SHEET"). Section files keep only content: help-panel content
(coc-help.css `.cch-*`, genshin.css `.gh`, hwr-css.css `.stb-info-dd-*`), WR's phone
title + scroll-spy, CoC's `.coc-main` scrollbar inset. **More sheet** = labelled sections
(`.mx-label`, with a picture) of `.mx-tool` tiles on every section, Web Resources too
(its old accordion of category rows is gone). A group's own page (Genshin's Events hub /
Full database / All tools, Minecraft's All Java pages / All tools, CoC's Tools hub, WR's
lobby) never gets a tile or a desktop menu row: on that page its LABEL lights up instead
(`.mx-label.active` + aria-current: white text, picture in colour, red hairline to the
edge -- a title, never boxed). Valorant / CODM / Tekken are untouched (their redesign is
coming). Hero search (home, /coc/, Genshin lobby) = `.lb-search` well with the red
`.lb-search-btn` key inside; page CSS sets width only.

## Top-bar search (Oct 26 2026)

One panel on every page (11layout.js "TOP-BAR SEARCH" + 11layout.css): desktop = a dropdown hanging from
the bar's search box (`openSearch` lines its right edge up with `.stb-search`), phones = a full panel under
the top bar. Empty box = suggestion chips; results = rows of game icon + name + tags (no pictures),
arrow keys + Enter. Data = **`site/search.json`** (NOT home.json: that only feeds the home page's Featured
Topics). A new page = one line there; TH pages share one tag line per kind (Layouts / Armies), keep it
that way. Live articles and Genshin game-nav pages it doesn't list join automatically. Matching = every
query word must start a word of the page's name / tags / group / `k`. CODM, Valorant and Tekken entries
are placeholders until those sections are rebuilt (Adrian). searchitemstorage.json is gone.

## Logo (Oct 31 2026)

Adrian's pick "Faceted": half an octagon ring + a red triangle folded into a lit and a shaded half. Files in
`site/icons/`, built by `python _tools/logo/build.py` (edit colours/shape there, never the outputs):
`parchrome-logo.svg` (on-site, white ring), `parchrome-favicon.svg` (ring turns dark in light browser tabs),
`parchrome-favicon-32.png` (fallback on a dark tile), `parchrome-touch-180.png`. Every page's head carries the
PNG + SVG `rel="icon"` pair and the apple-touch icon; copy them from any page. `icons/home.jpg` (the old anime
avatar) is no longer referenced anywhere: never link it again. `.topbar-logo` has no box behind it any more.

## Home Featured Games tiles (Oct 26 2026)

The home page's Featured Games grid = wide tiles (3 / 2 / 1 columns, 5:2, phones 3:1): name + sub left,
the game's icon as a raised badge right, art filling the tile. Built from sidebar.json: a `card` with a
`tile` gets a tile (`glow` = that game's hover glow + rule colour, `tileName` overrides `name`, `soon` =
grey "Coming soon" tile); cards without a tile (Triple A) are summed up in the grid's last cell, the
"Also on the way" well. Tile pictures (`site/icons/tiles/*.webp`, 900x312) are BAKED by
`python _tools/game-tiles/build.py` from `_tools/game-tiles/src/<slug>.jpg`: art placed on its focal
point, left half blurred, then the game's dark colour faded in from the left, all in one image (that's
what makes the fade smooth). Re-frame a tile = edit its row in that script and rerun; never paint the fade
in CSS. Wallpapers are Adrian's picks (one focal character). The Tekken / CODM / Minecraft icons in
`site/icons/` were replaced with Adrian's pictures the same day (256px; old ones in `_backup/icons/`).

## Articles (`/articles/<game>/<slug>`, Oct 2026)

📖 **Read [`parcore.com/docs/articles-guide.md`](parcore.com/docs/articles-guide.md) before drafting
or touching any article.** It holds Adrian's writing rules (quality over quantity,
voice, titles (no deks since Oct 26 2026), structure), the publish steps and the file map. Adrian is an
expert in every game on the site: his fact-checks are final. "Punchier lines always win":
its section 3b lists the writing patterns to use and what never to copy from
other sites (sales plugs, emojis, overpromises, first person, external links). Article list:
`site/articles.json`; new article = copy `site/articles/coc/hammer-jam.html`.
**Article strips** (home, /coc/, every TH army/layouts page, /minecraft/java/) share one look:
11layout.css "ARTICLE STRIP" (slides, one-line titles, progress line + arrows, `.art-all` link);
article-cards.js fills them. `data-game` = that game only; `data-order="random"` on game pages,
`"json"` on home (articles.json order: put the one to lead first in the file).
**Section subtitles + tool-card blurbs** (Oct 21 2026) share one quiet look: 11layout.css
"QUIET SUBTITLE" (`.mch-sec-sub`, `.tc-desc`, /coc/'s `.lob-sub`/`.lb-text`/`.cl-feature-text`).
Opt a new one in there, don't size subtitles in page CSS.
