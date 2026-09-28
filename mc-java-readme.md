# Minecraft Java section — how this works

Reference doc for the `mc-java-*` part of the site. If you're new to this codebase (or
you're an AI assistant being pointed here), read this before touching any `mc-java-`
file.

---

## 1. What this section is

The Minecraft Java section of Parchrome (see `hwr-readme.md` §1 for what Parchrome is
generally) — **8 pages** covering Discover, Worlds, Seeds, Resource Packs, Mods,
Shaders, Commands, and a standalone "HCPC" showcase page. Same static-HTML,
no-build-step, no-framework foundation as the rest of the site.

Unlike **Home Web Resources** (see `hwr-readme.md`), this section is **not**
JSON-driven for its actual content. The one JSON file it has (`mc-contents.json`)
only feeds shared chrome — hero tabs, bottom nav, the mobile "More" sheet, and the
desktop secondary-top-bar strips. Every page's real content (seed cards, world
listings, resource packs, mod tiles, shader tiles, command cards) is **hand-written
HTML, per page**. Keep this distinction in mind — instincts from working on HWR
("just edit the JSON") don't transfer here.

---

## 2. Ignore every `-old` file

Six dead pages exist:

```
mc-java-commands-old.html   mc-java-shaders-old.html
mc-java-mods-old.html       mc-java-worlds-old.html
mc-java-rp-old.html         mc-java-seeds-old.html
```

There is **no** `mc-java-home-old.html` and **no** `mc-java-hcpc-old.html` — those two
pages never had a prior generation, so don't assume the HWR "-old" pattern applies
symmetrically to all 8 pages. Treat the six above the same way `hwr-readme.md` says
to treat `hwr-*-old.html`: don't read them for reference, don't copy patterns from
them, don't update them.

⚠️ `mc-java-*.html` wildcards match these too — filter with `| grep -v -- "-old"`.

---

## 3. The complete file inventory

### 3a. The 8 live pages

| File | `<body>` class | In `mc-contents.json` nav? |
|---|---|---|
| `mc-java-home.html` | `mc-home` | Yes — the "Discover" hub |
| `mc-java-worlds.html` | `mc-worlds` | Yes |
| `mc-java-seeds.html` | `mc-seeds` | Yes |
| `mc-java-rp.html` | `mc-rp` | Yes |
| `mc-java-mods.html` | `mc-mods` | Yes |
| `mc-java-shaders.html` | `mc-shaders` | Yes |
| `mc-java-commands.html` | `mc-commands` | Yes |
| `mc-java-hcpc.html` | **`mc-worlds`** ⚠️ | **No — not registered anywhere** |

⚠️ **`mc-java-hcpc.html` reuses the `mc-worlds` body class instead of having its
own.** It's a standalone "Hardcore/Parcrop Village" showcase page, not a category
page, and it doesn't appear in `mc-contents.json` at all (not in `heroTabs`,
`mobileNav`, `moreSheet`, or `desktopSubNav.categories`) — it's reached only through
a hardcoded teaser card in the right sidebar of the other 6 category pages (not
`mc-java-home.html`). The practical consequence: **every `body.mc-worlds` CSS rule
and every `mcOn('worlds')` JS guard also fires on the HCPC page**, and there is
currently no way to target HCPC specifically without giving it its own body class
(see §5). Two comments elsewhere in the codebase (`mc-java-worlds.html:350`,
`mc-java.css:16310`) still describe this page as "doesn't exist yet" / "once that
page exists" — stale; it's been live for a while.

Every one of the 8 pages loads exactly `11layout.css` then `mc-java.css` in
`<head>`, and `11layout.js` then `mc-java.js` at the bottom of `<body>` — no
page-specific stylesheets or scripts, no exceptions.

### 3b. Shared code — mc-java-specific

| File | Lines | What it does |
|---|---|---|
| `mc-java.css` | ~17,600 | **All** Minecraft-section styling. Every one of the 8 pages loads it. Almost everything in it is scoped `body.mc-<page> .some-class`, i.e. duplicated once per page rather than written as one shared rule — see §6. |
| `mc-java.js` | ~3,320 | **All** Minecraft-section behaviour. Nav rendering, hero version pills, tagline auto-fit, seed pagination/search, sidebar/search wiring shared with the rest of the site. Gated per-page via `mcOn()` — see §4. |

### 3c. Data — `mc-contents.json`

The **only** JSON file specific to this section (~88 lines). Four top-level keys:

| Key | Drives |
|---|---|
| `heroTabs` | The Java / Bedrock / Story / Dungeons edition switcher in the hero |
| `mobileNav` | The mobile "Discover Categories" grid |
| `moreSheet` | The mobile "More" bottom-sheet, keyed by edition (`Java`, `Bedrock`, `Story Mode`, `Dungeons`) |
| `desktopSubNav` | Two arrays: `editions` and `categories` — feed the secondary-top-bar's two scrolling strips |

⚠️ **This is chrome/navigation data only — it is not a content database.** Editing
it changes tabs, nav chips, and the More sheet; it does **not** change what's on any
page's body. Compare to HWR, where the equivalent files (`hwr-categories.json`,
`hwr-websites.json`) *are* the content.

`mc-contents.json` also contains **forward-looking placeholder entries for pages
that don't exist yet**: an `mc-java-tools.html` "Web Tools" entry (referenced in
`mobileNav`, `moreSheet.Java`, `desktopSubNav.categories`), and entire `Bedrock` /
`Story Mode` / `Dungeons` sections pointing at pages that don't exist at all. This
is scaffolding for a planned future expansion, not a bug — don't "fix" those links.

### 3d. Site-wide shared files also used here

Same distinction `hwr-readme.md` §4c draws for its own section — these are shared
with HWR and other parts of the site, so a change here has a wider blast radius:

| File | What it does |
|---|---|
| `11layout.js` | Sidebar, top bar, footer, secondary-top-bar scroll arrows, top-bar search |
| `11layout.css` | Layout/chrome styling — **includes the sidebar system**, see §5 |
| `sidebar.json` | Sidebar menu contents |
| `11footer.json` | Footer contents |
| `herosearch.json` | Top-bar search index |

---

## 4. Page identification: `MC_PAGE` / `mcOn()`

At the top of `mc-java.js`:

```js
var MC_PAGE = (function () {
  var m = document.body.className.match(/\bmc-(home|worlds|seeds|rp|mods|shaders|commands)\b/);
  return m ? m[1] : '';
})();

function mcOn() {
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] === MC_PAGE) return true;
  }
  return false;
}
```

This is the mc-java equivalent of HWR's `HWR_PAGE_CAT_MAP` gotcha: it reads the
`<body>` class (`mc-home`, `mc-worlds`, …) and code elsewhere gates page-specific
behaviour behind `if (mcOn('seeds')) { ... }`. Function/variable *declarations* are
never guarded this way — inline `onclick=""` handlers in the markup resolve against
global scope and need those functions to always exist regardless of which page
loaded.

**Adding a 9th page means updating the regex above** (`mc-(home|worlds|...|NEWSLUG)`)
— skip it and `MC_PAGE` silently resolves to `''`, and every `mcOn()` guard for that
page fails, with no error anywhere. To fully register a new page you also need it in
up to 4 places in `mc-contents.json` (`heroTabs[0].activeOn`, `mobileNav`,
`moreSheet.Java`, `desktopSubNav.categories`) plus its own hero-v2/secondary-top-bar/
sidebar/footer boilerplate copied from an existing page.

---

## 5. Shared chrome — sidebar, secondary top bar, footer

Same markup and ids as the HWR pages (`hwr-readme.md` §6) — sidebar and footer are
rendered by `11layout.js` from `sidebar.json`/`11footer.json` exactly the same way.
The secondary top bar reuses HWR's strip markup and ids outright (mc-java pages'
`<head>` comments say so explicitly: "hwr's own strip markup, ids and all"), with
one behavioural difference: the right-hand strip holds **editions** (Java / Bedrock
/ Story / Dungeons) instead of HWR's hub nav, populated by `renderDesktopSubNav()`
in `mc-java.js` rather than `initHubNav()` in `11layout.js` (opted out via
`data-hub-nav="off"` on `<nav id="stbHubNav">`). The scroll-arrow behaviour itself —
`initHScrollArrows()`, including the `ResizeObserver` fix described in
`hwr-readme.md` §6 — is the same shared function, unchanged.

The mobile bottom nav (`#bottomNav`) also diverges from HWR: it's built from
`mc-contents.json`'s `heroTabs`, not from a `hubNav` key.

### The sidebar system lives in `11layout.css`, not `mc-java.css`

`11layout.css` has a block headed:

```css
/* == SIDEBAR =============================================================
   Shared by every page that loads this stylesheet. Trialled on the Minecraft
   pages first, then promoted here.
```

The sidebar's entire visual system — row grid, the raised top-box surface, section
labels, hover/active fills, the accent bar, icon rings, keyboard focus, the mobile
drawer — lives **site-wide in `11layout.css`** now. If you grep `mc-java.css` for
"SIDEBAR" you will find nothing relevant (the one hit, "RIGHT SIDEBAR — TWO BOXES",
is the unrelated mc-specific right-rail panel, not the left nav sidebar). A
deliberate anchor comment sits at the sidebar's old rule location in `11layout.css`
pointing forward to the real one, specifically so a future search doesn't come up
empty.

Sidebar tokens (`--sb-inset`, `--sb-accent`, etc.) are declared on `:root` in
`11layout.css` — not scoped to `.sidebar` — because the secondary top bar also reads
them and isn't a descendant of `.sidebar`. `--sb-inset` (currently `16px`) controls
every row's horizontal margin from the sidebar's edges in one place; the active-row
accent bar's position is computed as `(inset + width) / -2` so it self-centers if
`--sb-inset` is ever retuned, instead of needing a hand-tuned pixel offset.

**Active-row style is unified**: `.top-box-item.active`, `.game.active`, and
`.triple-a-game.active` all share one flat `#2b2d31` fill — games used to get a
separate red-wash fill for no real reason; now the red accent bar is the only thing
that signals "active," consistently for every row type.

---

## 6. `cf-section-header` system (section headings, "View more" + arrows)

Section headings on `mc-java-home.html`, `-worlds.html`, `-seeds.html`, `-rp.html`,
`-mods.html`, `-shaders.html`, and `-commands.html` use `.cf-section-header` /
`.cf-section-title-row` — ported from HWR's `.layouts-title`/`.layouts-subtitle`
system (comments say so explicitly). Some sections additionally have a "View more"
link + scroll arrows, in `.cf-section-header-right`, sitting in its own
`.cf-section-subtitle-row` alongside the subtitle (not the title — moved there
deliberately so it reads as a quiet secondary action, not a stripe next to the
14-pixel title).

| Page | `.cf-section-header-right` instances |
|---|---|
| `mc-java-home.html` | 6 |
| `mc-java-worlds.html` | 2 |
| `mc-java-rp.html` | 1 |
| `mc-java-mods.html` | 1 |
| `mc-java-shaders.html` | 1 |
| `mc-java-seeds.html` | 0 |
| `mc-java-commands.html` | 0 |

⚠️ **See §7 — this element is currently invisible on 4 of the 5 pages that have
it.**

---

## 7. Known issues

Pre-existing or discovered during a doc pass, listed so nobody thinks they broke
them — but the first one below is a real functional bug, not just untidy CSS, and
should be looked at:

- **`.cf-section-header-right` renders `display: none` on `mc-java-worlds.html`,
  `mc-java-rp.html`, `mc-java-mods.html`, and `mc-java-shaders.html`.** Each page has
  its own early `body.mc-<page> .cf-section-header-right { display: none; }` block
  in `mc-java.css`. A later block (further down the file) applies `margin-left:
  auto; flex-shrink: 0;` to all 7 page classes at once but never touches `display`
  — so the earlier `display: none` stands uncontested. Net effect: the "View more"
  links and scroll arrows on those 4 pages' sections exist in the markup but never
  actually show. Only `mc-java-home.html`'s own block sets `display: flex`, so only
  that page's "View more" rows are visible. Worth fixing directly rather than just
  documenting — this looks unintentional.
- **`mc-java-hcpc.html` shares a body class with `mc-java-worlds.html`** (§3a) — the
  single most important gotcha for editing either page. There's no way to target
  HCPC specifically in CSS or JS without giving it its own `mc-hcpc` class and
  registering that in `MC_PAGE`'s regex (§4) first.
- **Dead per-page CSS, overridden by a later shared block.** `.cf-section-title`'s
  font-size is declared once per page early in `mc-java.css` (e.g.
  `clamp(14px, 2vw, 20px)`), but a later combined-selector block covering all 7 page
  classes at once (in the file's "SECTION TITLE ROW + SUBTITLE" region, ported from
  HWR) sets a different value (`clamp(15px, 1.5vw, 22px)`) that actually wins the
  cascade — same specificity, later in the file. The early per-page declarations are
  dead on arrival. **Don't trust the first `body.mc-X .cf-section-title` block you
  find when grepping this file** — check whether a later combined-selector block
  already owns the property before editing the per-page one. (`.cf-view-all` and
  `.cf-arrow`, by contrast, do **not** have this problem — they're duplicated once
  per page with no later override, so each page's own block is genuinely the one in
  effect. That's still a maintenance smell — six near-identical blocks to touch for
  one visual tweak — just not a *dead-code* bug the way `.cf-section-title` is.)
  Both `mc-java-seeds.html` and `mc-java-commands.html` additionally declare their
  own `.cf-section-title` block **twice** internally, before even reaching the
  shared override.
- **Two stale "doesn't exist yet" comments** about `mc-java-hcpc.html`
  (`mc-java-worlds.html:350`, `mc-java.css:16310`) — low priority, but an example of
  comment rot in this file worth being aware of generally: comments here are often
  very informative and worth reading, but verify against the actual current code
  rather than trusting a comment's claim about file existence or line numbers at
  face value.
- **`mc-java-tools.html` and the Bedrock/Story/Dungeons pages referenced in
  `mc-contents.json` don't exist** — intentional scaffolding for a future expansion,
  not broken links to fix.

---

## 8. Quick reference

```
LIVE PAGES (8)
  mc-java-home.html                        Discover hub
  mc-java-{worlds,seeds,rp,mods,
           shaders,commands}.html          6 category pages
  mc-java-hcpc.html                        standalone showcase, body class
                                            collides with mc-worlds, not in nav

SHARED (mc-java only)   mc-java.css  mc-java.js
SHARED (site-wide)      11layout.js  11layout.css  (sidebar system lives here)
DATA (live)             mc-contents.json   -- chrome/nav only, NOT page content

DEAD -- DO NOT EDIT     mc-java-{commands,mods,rp,seeds,shaders,worlds}-old.html (6)

KNOWN BUG               .cf-section-header-right is display:none on worlds/rp/mods/
                         shaders (mc-java.css) -- only mc-java-home.html shows it
```
