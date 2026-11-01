# Call of Duty Mobile

**Nov 1 2026 (Adrian):** every CODM title (hero `.li-title`, `.pg-title`, `.cb-title`, `.ct-title`) is **Tourney** italic now, not Big Shoulders Stencil / Orbitron: font in 11layout.css "TOURNEY TITLES", sizes = its `--fs-*-tourney` tokens. Notes below that say "stencil" are history.

Moved out of CLAUDE.md on Nov 1 2026, unchanged. Paths like `parcore.com/docs/x.md` are relative to the outer folder.

## CODM lobby (`/call-of-duty-mobile/`, Oct 2026)

Guns live in `site/codm-guns.json`, shared by the lobby and the attachments page
(`?type=smg`, `?mode=battleroyale` preselect its pills). **Oct 29 2026 (Adrian):** CODM is on the
groups engine like Minecraft: tabs **Lobby / Loadouts / Attachments / Tools** (game-nav.json; page icons
there are SVG markup, which buildGroups draws as SVG; Guides + the lobby's placeholder Popular Guides were
dropped later that day, Adrian: bring them back with the first CODM article). **Views, not pages:** the
Loadouts menu rows (Multiplayer / Battle Royale = `?mode=br`) and Attachments rows (one per gun type =
`?type=smg`) are views of one page. 11layout.js "VIEW LINKS": a row with a query is "here" only when the
address matches (`window.pcViewDefaults` fills a missing value), and on that page a click switches in place
(pushState + the page's `window.pcView`, capture-phase because the More sheet stops propagation); pages call
`window.pcMarkViews()` after their own tabs change the address. Loadouts' tray = MP | BR (BR has no loadouts
yet: `.codm-empty` panel; a loadout's `mode` defaults to "mp"), Attachments' tray = the gun types + Favorites
(counts hidden on desktop: `.cb-tabs--many`), MP | BR = the small `.codm-switch` in its search row.
Filters wear the CoC recipe (wells, picked = grey raised key) from codm-banner.css "FILTER BARS" (`html body`
prefix: the pages' own styles come later). Search rows = the site's `.lb-search` bar (codm-banner.css "SEARCH ROW").
**Tools (Oct 29 2026):** `/call-of-duty-mobile/tools` = the Tools tab's group page (the CoC hub's layout: banner, "Parchrome
tools" cards `.ct-card`, "Outside websites" `.ct-site`; shared CSS `site/codm-tools.css`); a new tool = its game-nav.json row
+ its card there + the lobby Field Kit card. **Color Codes** (`codm-colors.js`): name generator in 3 CANDIDATE formats (hex
`[FF0000]`, caret `^1`, Unity `<color=#…>`), none confirmed for CODM: every page says "Unverified" until Adrian tests them in
game; drop the formats that fail. **Bot Checker** (`codm-bots.js`): one name against `site/codm-bots.json` (Adrian's list goes
there; matching ignores case / spaces / symbols; the 3 `"example": true` entries are placeholders to delete). A miss says "Not
on the list", never "player". Sensitivity: still "soon".
Lobby order: hero (Adrian's: don't touch; it runs down to the Popular Builds row) -> The Armory +
Field Kit (`#armory`, on the red V background `.pg--bg`) -> World Championship (`#esports`) -> Official Videos (`#videos`) -> footer.
Find Your Playstyle and everything that was below it (classes, weapon database, perks, streaks,
modes, maps, ranked, setup, glossary, links, FAQ) was deleted that day. Every section under the hero
is a `.pg` band + `.pg-box` with the stencil `.pg-title`, its side padding = the hero's, so the boxes
line up with it; cards = the `.pg-card` recipe (raised, sunken screen, scan sweep idle, "target lock"
corner brackets on hover / touch scroll-in). Field Kit = the Tools tab's pages as "Coming soon"
cards (`.pg-card--soon`, NOT `.is-soon`: 11layout dims every `.is-soon` on game pages to 40%);
make a card a link when its page ships. The hero's quick menu still links to /color-codes,
/sensitivity, /hud-settings, /bot-checker (404s until built).
**Page banner (Oct 29 2026, Adrian picked "Target lock"):** /loadouts + /attachments wear `.cb`
(`site/codm-banner.css` + `.js`): a 196px card (CoC `.tb` / Minecraft tool banner / Genshin `.gi-tb`
family), red tab on its top edge (the reticle corners + crosshair were removed the same day, Adrian),
gun cut-out in a well, live facts strip (the page's count `#cbCount`/`#cbCountSub`, filled by
the page script; the season from ggseason in codm-banner.js), Ghost (`codm-hero-ghost-red.webp`) on
the right; under it the Loadouts tab's tray (`.cb-tabs`, current page = grey key). Side inset on every CODM sub-page = `--codm-side` (codm-banner.css: desktop `--coc-side`, phones 10px, = the TH Layouts / Armies pages; Adrian, Oct 29): use it for any new margin there, never a %. A new CODM sub-page
copies that markup. The 8 loadouts' codes were made up: blanked (Oct 29), no screenshots yet, so the
cards draw a reticle + the primary's name. Fixed top bars measure the real scrollbar width
(11layout.js syncScrollbarWidth) -- overlay scrollbars are 0px, not 10px.
Armory counts read codm-guns.json; "verified" = guns with an `attachments` block (real
Gunsmith screenshots). Direction notes: `.impeccable/surfaces/`.
Never add made-up build codes: a gun without a real in-game code gets `"code": ""`.
The battle pass strip reads season name/end/summary from ggseason.com's schema.org
JSON (CORS *; no CODM API exists) and hides itself if that fails or the date passes.
Live data: `.github/workflows/codm-feed.yml` runs `scripts/codm-feed.mjs` daily (no keys)
and writes `site/codm-feed.json` (official YouTube RSS, App Store versions, Liquipedia
World Championship infobox) + `site/codm-weapons.json` (every gun + its stats from the
Fandom wiki's CODM infoboxes; its images need a Referer, so never add `referrerpolicy="no-referrer"`)
+ `site/codm-weapons-log.json` (day-to-day diff of those numbers). Build likes use
Firestore `layoutLikes/codm-builds`, same as the TH base likes.
**Gun Stats** (`/call-of-duty-mobile/gun-stats`, Oct 29 2026, Adrian to QC): `codm-gunstats.js` = TTK maths only
(MP, base gun, 100 HP, shots x RPM gaps), compare chart (3 colours validated by the dataviz skill) + sortable list +
"Buffs and nerfs" (the log). Zero manual upkeep, Adrian's rule. The parser in codm-feed.mjs takes a number only when the
wiki states it plainly (else null = "No stats on the wiki yet" / "No ranges"); names = the infobox `name` (wiki page
"Vector" = Fennec, "Galil" = Grav). ~93/119 guns have stats; shotguns (pellets) and burst guns get no TTK.
**Season Countdown** (`/call-of-duty-mobile/season`): clock = ggseason via `window.codmSeason` (codm-banner.js);
`site/codm-season.json` (what's in the season) is hand-written and hides itself once the season moves on.
`.cb-tabs` must not shrink (`flex-shrink: 0`): `.coc-main` is a flex column and squeezed it to 12px on long pages.
The World Championship box was restyled into the section look on Adrian's go-ahead (Oct 29 2026); its countdown = the hero battle pass scoreboard, stages in a well, data + script unchanged. (Its red V background moved to Popular Guides, his call.)
