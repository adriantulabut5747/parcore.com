# Minecraft

Moved out of CLAUDE.md on Nov 1 2026, unchanged. Paths like `parcore.com/docs/x.md` are relative to the outer folder.

## Minecraft nav + Lobby (Oct 27 2026)

Four tabs like CoC / Genshin: **Lobby** (`/minecraft/` = the old Discover page, moved there Oct 27 2026;
the sidebar opens it; the old `/minecraft/ → /minecraft/java/` 301 is gone, `mc-java-home` now 301s to
`/minecraft/`) / **Resources** (named "Java" until Oct 29 2026, Adrian; mc-java.js `pagesOf('Resources')` and
mc-lobby.js's map key find the group BY THAT NAME, so a rename touches them too; `/minecraft/java/` = the group page: banner + tabs tray ("All" raised) + one
`.tc-card` per Java page; a new Java page = its row in game-nav.json + a card there) / **Tools** (`"cols": 3` =
a 3-across hover menu, `.stb-dd--3col`; the old `.stb-dd--tools` died with the Oct 27 move to the groups engine) / **Spin-offs**
(Story Mode + Dungeons, all "soon": no group page; desktop = hover menu only, phones = a tap opens the More sheet at its
section via `#gn-sec-N`, which never touches the address). Every Minecraft page has `data-game-nav="minecraft"`:
11layout.js `buildGroups` builds the top bar, menus, phone bar, More sheet and trail from **game-nav.json
`minecraft`** -- the ONE list of Minecraft pages (a new tool = one row there + its card on /minecraft/tools/).
The banner tabs tray reads the same Java / Tools pages (mc-java.js "BANNER TABS"; `tab` = shorter tray label).
mc-contents.json now only feeds hcpc.html's old hero + sidebar cards. Group icons = 16px item sprites
(`img`, pixelated, lighter grey at rest: mc-hero.css "NAV SPRITES"; the phone trail rule sits there too).
mc-java.js keeps only the bar's auto-hide and the scroll lock; the More sheet open/close is 11layout's
(no back-button-closes-sheet any more, same as Genshin).

**Lobby rebuild (Oct 28 2026, Adrian to QC): guide = the Piglin** (no name, just "Piglin"; replaced Wandy T. the
same day, Adrian: "I want it gone"). Voice = piglin humour: gold-obsessed, blunt, "not scared" of soul fire, won't
step into the Overworld (piglins zombify there in 15 s); short lines, max 2 in a box. Face = `images/minecraft/piglin/
face.webp` (+ `face-gold.webp` = admiring an ingot), cut from Adrian's piglin render
(`_tools/lobby-hero/src/refs/6.png`) by nether.py, shown smooth (not pixelated). `src/refs/` also keeps his other
piglin pictures + a Pinterest piglin video (`piglin-pin.mp4`) for later sections; nothing there is published. **Hero v3 = the Nether**
(Adrian: ignore the old lobby look, follow home + /coc/: dark, our red, raised/sunken; title = Orbitron Title (was Tourney, Handjet) like the
lobby's section titles (Adrian's later call), Sora text, Oxanium labels/keys, no game font; no quick-keys row). Art = official Nether Update art (ghast, piglin,
portal, soul fire), baked + graded by `python _tools/lobby-hero/nether.py` (src in `_tools/lobby-hero/src/`; 1200px
source, so it's upscaled -- a bigger copy would be sharper) into `lobby/nether.webp` + `nether-phone.webp` (4:3 crop).
`mc-lobby-hero.js`: canvas particles placed in the SOURCE photo's fractions (`REGIONS`, mapped through object-fit:
cover -- re-check them if the photo changes), mouse parallax, the Piglin's rotating lines (`#mlLine`), the **Barter**
box (desktop only, hidden on phones; throw gold: the ingot arcs to the piglin in the picture, it admires it, a random game-nav.json Minecraft page flies
back as the loot) and the versions strip (`#mlRel` / `#mlSnap` from the hidden `hvs-*` spans). Copy left, Barter right,
the piglin's middle kept clear; on desktop the ghast sits behind the title (darkened). Hero keys (Throw gold, patch
notes) = `.ml-btn` (NOT `.ml-key`: that's the map section's key list). The old 3D floating island (Wandy + llamas) is saved in
`_tools/lobby-hero/island/` with a README; the Launcher's Java picture is still `lobby/launcher-java.webp`.
**Sections = real Minecraft screens** (round 2, Adrian: card grids were "AI slop"; never go back to cards here).
Fonts (Oct 31 2026, Adrian; Handjet titles before): titles = **Tourney** italic on EVERY Minecraft page, mc-hero.css "ORBITRON TITLES" (banner + section titles, Orbitron-era sizes + 2px), each page links the font; **Orbitron** = eyebrows, small heads, numbers; **Sora** = everything else; no Oxanium or Handjet in page content (shared coc-cards / article-cards pieces: mc-hero.css "MINECRAFT FONTS"). Handjet's game-screen bits (map key, worlds search) went to Sora / Orbitron. Game sprites = `minecrafticons/gui/lobby/` (pulled from the
official 26.3 client jar, GUI scale 2, always pixelated); `.mcf[data-mc]` text is redrawn in the game font
(mc-font.js) by `mc-lobby.js` "GAME FONT". Order: hero; **Piglin's map** = a REAL seed's (8608349220991265627)
**Nether** (Oct 28 2026, was the Overworld; "netherfying" every section starts here) drawn as a filled map item by
`node _tools/lobby-map/build.mjs` (Seed Map's wasm, dim -1, + the game's map palette; biomes + bastions / fortresses /
ruined portals are the seed's, lava seas + shading are noise: a real map in the Nether draws the roof, so the Piglin
"drew it himself"; writes `images/minecraft/lobby/map.png` + `mc-lobby-map.json`): every live game-nav.json page is a
banner on it (Java = white, on the bastions first; tools = GOLD, `deco-gold_banner.png`, red vanished on the red map).
**Simplified Oct 28 2026 (Adrian: "messy"):** no structure icons / player marker / spin-off X marks on it (spin-offs
are in the key only), no paper or tilt: the map (dimmed) sits in a well inside a raised box; the key = raised box,
each group's rows in a well. Tooltip = game tooltip + the page's game-nav `icon`; touch screens (`hover: none`) tap
a banner to pin it with a red Go key (`.ml-tip-go`) instead of navigating. `.ml-seed` is hidden on phones. The section is a **pixel-art Nether cave** (Adrian's reference, our red not its purple): `python
_tools/lobby-map/nether-art.py` bakes tiling strips (`cave-top/far/lava/glint/floor/side*.png`) shown at `--cp` (4px,
3 on phones) a pixel; mc-lobby.css "PIGLIN'S MAP: a Nether cave" stacks them (lavafalls are in the ceiling art; flowing lava + embers
are CSS). Draw every shape WHOLE and outlined (a stepped stalactite, a basalt cluster): the first per-column-noise
version looked glitchy to Adrian (lit stripes read as see-through rock, stubs floated). The lava is a SHORT strip (`DEPTH` = 14 rows, Adrian: "compress it by a lot"); the far fortress only peeks out from behind the content; **Popular tools** = a 3D item-frame wall (`mc-lobby-frames.js`, frames placed behind real links, items = the sprite extruded), since Oct 28 2026 v2 a smaller wall on a Nether board (polished blackstone frame, gold trim, gilded corners, crimson planks; `.ml-board` in mc-lobby.css "POPULAR TOOLS") with Adrian's golden-axe piglin cut-out on the right (`piglin/piglin-axe.webp`, nether.py `piglin_cutout()`; phones: no piglin, frames 3 a row, names only). Quiet plain ground on purpose (calmer than the cave above). Frame names are never cut; the blurb under them is one line with ...; **Top 10 worlds** (v2, Oct 28 2026) = a ruined Nether portal + the Select World screen: the picked world shows
through the portal (obsidian on a block grid `--B`, crying obsidian tears; mc-lobby.js "WORLDS" draws the game's 32
`nether_portal_strip` frames on `.wp-swirl` BEHIND the masked picture; a pick "warps"), the plate under it (game-font name,
real facts only: tag / version / players / author as `data-*` on each row, from mc-worlds.json), the list on blackstone with
gold trim (search, Random World, Create New World = Seeds); the left column stretches to the list (<=1200px: list below); Popular articles (Adrian's, untouched); **Popular R-Packs / shaders / modpacks** (Oct 28 2026, Adrian's exception to the no-cards rule: he asked for the
old Discover page's rows back) = three `.mch-mods--row` card rows (mc-home.css, arrows = article-cards.js `art-nav`),
tags dark: rank = raised key (#1 red), source = sunken well (mc-lobby.css "POPULAR R-PACKS"); **Popular commands** = the copy
list only (mc-commands.js, mc-commands.json `home`; the lever + command-block box went Oct 28 2026, Adrian), on the
short deepslate strip; Java release history (`.mch-tl`, untouched); **Ask the Piglin** = /coc/'s FAQ look (`.ml-qa` /
`.qa-*`, in mc-nether.css since Oct 28 2026 so the Worlds page's FAQ wears it too; 4 questions max, Adrian) + feedback box. Beyond the Overworld (the Launcher) and
the written book were removed Oct 28 2026 (Adrian).
Styles: `mc-lobby.css`. Servers, Reference charts, the hero video and the `mch-nav` tray were dropped (Adrian).
Dungeons 2: add only once Mojang announces it.
**Lobby speed (Oct 28 2026, Adrian: "my mobile is barely loading"):** measured on a 4x-throttled phone: 3.0 MB -> 1.8 MB,
style recalc 4.0 s -> 1.4 s. Rules to keep it that way: (1) shared JSON goes through `window.pcJSON(url)` (11layout.js,
one download per page; was game-nav.json x4, Mojang's list x2; never mutate what it returns); (2) animate only
transform / opacity (the lava flow slides with transform; the hero title's sheen + glow are off on phones because
background-position / text-shadow repaint every frame); a GIF/video "background" was considered and rejected (MBs,
256 colours, CPU decode); (3) `.mcf` game-font canvases (~150) draw per section as it nears the screen, and only a WIDTH
change redraws (phones fire resize when the address bar moves); (4) phones get no three.js: mc-lobby-frames.js keeps the
flat CSS frames there and loads mc-mob3d.js itself on desktop (no script tag on the page); (5) hero particles on phones =
1x pixels, 30 fps; (6) images below the hero are `loading="lazy"`; big ones have small local WebP copies
(`minecrafticons/worlds/parkour-spiral.webp`, `lobby/ln-*.webp`, 64px nav icons in `minecrafticons/nav/`, used by
game-nav.json). Left to do: the lobby uses ~3% of mc-java.css and ~9% of mc-home.css (620 KB); a lobby-only stylesheet
would be the next big win, but hover / menu / patch-notes states must be checked by hand, so it needs Adrian's QC.

## Minecraft tool pages (`/minecraft/tools/…`, Oct 2026)

**Banner + section tabs (Oct 21 2026):** every Java page and tool page (Mob Summon too)
wears the same `<header class="mch-hero mch-hero--page">` banner (quiet eyebrow "Curated Minecraft resources" `.mch-hero-eyebrow`, title, then the
Release/Snapshot versions; no CTA or description line -- Adrian's call; From
Mojang is unboxed; desktop shows 510px of it under the bar), with
tabs at its foot: one sunken tray holding every tab, the current page raised out of it
as the grey key (TH pages' Layouts/Army/Tools recipe), Oxanium caps, More-sheet icon on the left,
desktop tray = full page column (tabs grow to share spare width, never shrink), scrolls inside itself. The tray straddles the banner's bottom hairline
(half its height as negative margin, so `.mch-hero--page` is `overflow: visible` and its photo unzoomed);
phones: edge to edge, no side borders. **Ground (Oct 28 2026, Adrian's pick):** every Minecraft sub-page,
Java and tools (`.mt-page` too), wears the **blackstone ground**: polished blackstone baked a hair off #0a0a0b
into one 64px tile (`images/minecraft/ground-blackstone.png`, `python _tools/ground/blackstone.py`; K = 0.13 =
"soft", 0.26 read as a tiled grid) + the red/grey top glow: mc-hero.css "GROUND" (glow = `.mch-hero--page::before`
behind the content; chapter bands are see-through except the Play deepslate pit). Only the lobby
(`body.mc-home.mc-lobby`) keeps the old film grain; hcpc.html (old design) keeps its dirt wallpaper. A section
that paints its own solid fill hides the stone: use a transparent glow instead (Worlds' `#ch-worlds`).
**Under a deepslate pit it's solid (Nov 2 2026, Adrian):** the pit's floor fades to #0d0e10 and the blackstone
never met it cleanly, so everything after a pit is flat #0d0e10 (`.mch-ch--solid`, mc-hero.css "Solid ground").
A pit keeps only its first section (Seed map tools, Most downloaded on Modrinth, Mod launchers, Where to paste,
Data packs' Where to get them, Worlds' Install); the rest of it is split into a `.mch-ch--solid.mch-ch--cont`
chapter, which has no top spacing so sections stay 96 / 56px apart. Under the tray: 64px desktop / 40px phones to the first content on every
page (mc-hero.css "SPACE UNDER THE TABS"). Tool pages: tabs = the tools A-Z (mc-contents.json `tools` is
kept alphabetical; the /minecraft/tools/ hub cards too), no "All tools" tab -- mc-java.js adds an
"All tools" back button (`.mch-back`) above the title. The tools lobby has no tray at all (`.mch-hero-tabs > nav.mch-nav`, filled by
mc-java.js `renderMobileNav`: Java sections, or "All tools" + the tools). All of the
banner's and tabs' CSS lives in **`site/mc-hero.css`** (linked right after mc-home.css on
every page): change the look there, once. Only hcpc.html still has the old icon strip.
**Tool banner (Oct 22 2026):** the 19 tool pages (not the lobby, not Java pages) differ: `<header
class="… mch-hero--tool">` = /coc/'s compressed `.tb` card (196px box in the page column, art right,
"All tools" key top-right, no From Mojang / feed modal), and the tabs tray sits *after* `</header>`,
wrapping into rows on desktop (no scroll), a slim text-only scrolling strip on phones. All in
mc-hero.css "TOOL BANNER". **Since Oct 28 2026 the 8 Java pages wear it too** (`mch-hero--tool`, art = `mc-java-banner.jpg` still, no From Mojang box or `#vtModal`, tabs after `</header>`; no back key: the tray has "All").

Mob Summon (`mob.html`) is the pilot of the new tool design; the other 18 tools still
use the old `pt-*` panels until they're converted one at a time.
A converted page: `<body class="mc-home mt-page">`, links `mc-tool.css` after
mc-home.css, and uses only `mt-*` classes inside the tool (so mc-home.css's shared tool
styles can't reach it). Kept hooks: element ids,
`data-*` attributes, `.mch-tabs/.mch-tab` (tab engine) and `.mch-copy` (copy engine,
mc-home.js). Box look = minecraft.net's marketplace panel (page #171615, box #0e0d0d,
4px edge black top/right, #262525 left/bottom). mc-java.css dims `.coc-content` with
an 80% black `::before`; mc-tool.css turns it off. Mob Summon builds share as
`#b=<base64 JSON>`; `clean()` in mc-mob.js validates every value from the link
(they reach markup) -- keep that if more state is added.
Mob Summon riders are whole mobs (`top.riders`, each a `mobState`); Edit moves `.mt-set` and
`.mt-prev` into `#mtRiderDlg` and points `s` at that rider, so every control works on `s` and
`as(state, fn)` runs code for another mob. That dialog is a stack of frames (`pushFrame`): mob frames
(riders, a spawn egg's mob) and item frames (a slot inside storage, which move only `#mobItemEd`); the
item editor always edits `it()`, never `s.eq[s.slot]` directly. Drop slots = the body/saddle slots a mob
never shows (`dropSlots`, 1.21.5+); "Always drops" writes chance 2.0, because ≤1.0 only drops on a player
kill (DropChances.isPreserved). 3D assets: `python _tools/mobs3d/build.py` (Bedrock models)
then `skins.py` (Java textures, gear layers, mc-mob-lists.json); seat heights and baby armor in
mc-mob3d.js come from the 26.3 jar (`_tools/mobs3d/javamesh.py` reads Java model code).
Held items copy the game's ItemInHandLayer chain (arm → hand step → the item model's thirdperson display,
`DISP` in mc-mob3d.js, numbers from the jar's models/item + models/block); shield and trident are their own
3D models. Baby mobs hold full-size items on purpose: 26.3 only moves the hand, it doesn't shrink the item.

## Seed Map (`/minecraft/tools/seed-map`, Oct 22 2026)

Chunkbase-style biome + structure map, all in the browser. Generator = cubiomes (C, MIT) compiled to
`site/mc-seedmap.wasm` by `python _tools/seedmap/build.py` (needs `pip install ziglang`; cubiomes is
cloned at the pinned COMMIT, git-ignored; wrapper = `_tools/seedmap/seedmap.c`; check = `node
_tools/seedmap/test.mjs`). `mc-seedmap-worker.js` runs it (a pool, any worker takes any job; views on
wasm memory are made AFTER each call -- a call can grow memory and detach the old buffer). `mc-seedmap.js`
= Leaflet (self-hosted in `site/leaflet/`, CRS.Simple, lat = -z) with three GridLayers: biomes, slime,
structure icons; every layer needs `minZoom: -6` or Leaflet drops its tiles below zoom 0. Strongholds take
~3 s, so they're one job per world, not per tile. Biomes are sampled at y=256 (Nether y=64) = surface
biomes. cubiomes' newest version is 1.21.4: don't label anything 26.x until Adrian has checked seeds in
game. The seeds page "Map" button (mc-seeds.js `mapUrl`) opens this at the seed's `coords`. Headless
screenshots: workers need REAL time -- `--virtual-time-budget` starves them, so drive Chrome over CDP.

## Worlds page (`/minecraft/java/worlds`, Oct 22 2026)

Cards live in `site/mc-worlds.json` (ids permanent, `#world-<id>` links); mc-worlds.js builds the grid,
chips and search with the seeds page's deck/chip classes, own styles in `mc-worlds.css` (not mc-home.css).
`version` / `players` = only what the creator states on the download page (never a commenter); unknown = `""`.
`schematic: true` = the download is a build, not a world. "Install a world" is an animation: steps 1-2 are
an HTML file window per OS, 3-4 the game's screens drawn in a canvas from 26.3's real sprites
(`site/minecrafticons/gui/menu/`, panorama from the launcher assets), McFont, and en_us.json strings --
keep the strings and layout verbatim (SelectWorldScreen / BackupConfirmScreen). The demo world is Adrian's own
Hardcore Parcore (facts from /minecraft/java/hcpc: 1.21.6, 1.4 GB, Hardcore); the desktop wallpaper is his
photo, pre-blurred (`gui/menu/desktop.webp`). The walkthrough is the only thing on the deepslate chapter; the
questions sit in their own `.mch-ch--surface` chapter below it, in the lobby's FAQ look (`.ml-qa` + feedback box).
**Oct 28 2026 (Adrian):** the Nether cave behind the featured portal was removed: the page wears the blackstone
ground like every sub-page (the cave stays the lobby's). Every gap on the page = the gap under the tabs, 64px
(phones 40): mc-worlds.css "PAGE RHYTHM" (other Java pages still use mc-home's 96 + 96).
**Lobby look (Oct 28 2026, Adrian picked "B", Worlds is the pilot for every Java page):** the featured world = the lobby's
ruined portal (`.wp-solo`: Hardcore Parcore through it, plate beside it) inside the lobby's Nether cave (`#ch-feat`),
Piglin lines (`.ml-guide`) under every section title, blackstone world cards, banner art = `lobby/nether.webp`. The lobby
pieces live in **`site/mc-nether.css`** (moved out of mc-lobby.css: `.ml-btn`, `.ml-guide`, `.mcf`/`.mcb`, `.ml-cave`,
the `.wp-*` portal + plate); a page that wants them links mc-nether.css + mc-font.js + mc-lobby.js (game font + portal
`swirl()`; its MAP / WORLDS parts skip themselves without their markup). Worlds' layout of them = mc-worlds.css "FEATURED".
