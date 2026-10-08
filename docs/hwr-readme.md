# Home Web Resources (HWR) — how this section works

Reference doc for the `hwr-*` part of the site. If you're new to this codebase (or
you're an AI assistant being pointed here), read this before touching any `hwr-` file.

---

## 1. What Parchrome is

Parchrome (the folder is named `parcore.com`; the brand string in the pages is
**Parchrome**) is a **static website** — plain HTML, CSS and JavaScript files with no
build step, no framework, and no server-side code. You open a `.html` file and it works.
Deployment is via Netlify (see `netlify.toml.txt` and the `netlify/` folder).

The site has two broad halves:

- **Game guides** — Clash of Clans (`th8-` … `th18-`, `coc-`), Minecraft (`mc-java-`),
  Valorant, Genshin, CODM, Tekken.
- **Home Web Resources (HWR)** — the `hwr-*` files. A curated directory of useful
  websites and free tools, organised into categories. **That's what this document
  covers.** Nothing else.

Because there's no build step, "shared code" literally means *several HTML pages each
have a `<script src="...">` tag pointing at the same file*. There is no bundler that
would catch a typo for you — if a page forgets a tag, that page silently loses the
feature.

---

## 2. What HWR is

A browsable directory of **610 websites** spread across **11 categories**, plus a few
supporting pages (bookmarks, glossary, contribute).

The tagline on the landing page: *"A curated stash of useful websites and free tools
most people have never heard of."*

The important idea, and the thing that trips people up:

> **The pages are shells. The content lives in JSON.**

An individual page like `hwr-anime.html` does not contain a list of anime websites.
It contains an empty container. At runtime, JavaScript fetches the JSON files, filters
them for that page, and builds the cards. Editing the HTML to add a site will not work
— you add it to `hwr-websites.json`.

---

## 3. Ignore every `-old` file

There are ten dead pages:

```
hwr-ai-old.html          hwr-manga-old.html       hwr-torrent-old.html
hwr-anime-old.html       hwr-movies-old.html      hwr-webgames-old.html
hwr-asiandrama-old.html  hwr-music-old.html
hwr-games-old.html       hwr-parcode-old.html
```

**These are a previous generation of the section and are not part of the live site.**
Don't read them for reference, don't copy patterns from them, and don't update them
when changing something. They are kept only as a historical snapshot.

Two stylesheets/scripts existed *only* to serve those dead pages — `1hwr.css` and
`1hwr.js` — and have now been **deleted**. This means the `-old` pages no longer render
correctly. That is intentional: they were already unreachable from the live site.

⚠️ Careful with wildcards. `hwr-*.html` matches the old files too. When searching or
scripting across the section, filter them out (`| grep -v -- "-old"`).

---

## 4. The complete file inventory

### 4a. The 15 live pages

**Landing page (1)**

| File | Role |
|---|---|
| `homewebresources.html` | The HWR home / "lobby". Hero, category grid, recommended tools, discover list. |

**Category pages (11)** — one per category, all structurally identical:

| File | Category shown | `cat` slug in `hwr-websites.json` |
|---|---|---|
| `hwr-ai.html` | AI Tools | `ai` |
| `hwr-anime.html` | Anime | `anime` |
| `hwr-asiandrama.html` | Asian Drama | `asiandrama` |
| `hwr-games.html` | Gaming | `gaming` |
| `hwr-manga.html` | Manga / Reading | `manga` |
| `hwr-movies.html` | Movies | `movies` |
| `hwr-music.html` | Music | `music` |
| `hwr-parcode.html` | Parcode | `parcode` |
| `hwr-torrent.html` | Torrenting | `torrenting` |
| `hwr-webgames.html` | Web Games | `webgaming` |
| `hwr-fun.html` | Fun & Creative | `fun` |

⚠️ **The slug is not derivable from the filename.** `hwr-games.html` → `gaming`,
`hwr-torrent.html` → `torrenting`, `hwr-webgames.html` → `webgaming`. This mapping is
spelled out explicitly in `HWR_PAGE_CAT_MAP` in `hwr-js.js` (~line 1262). If you add a
category page, you must add it there too or the page renders zero cards.

**Supporting pages (3)**

| File | Role |
|---|---|
| `hwr-bookmarks.html` | Shows sites the visitor saved. Reads `localStorage`, not JSON. |
| `hwr-contribute.html` | Form/instructions for suggesting a site. |
| `hwr-glossary.html` | Plain-language definitions of terms, per category. |

### 4b. Shared code — HWR-specific

| File | Lines | What it does |
|---|---|---|
| `hwr-css.css` | ~6,480 | **All** HWR styling. Every one of the 15 pages loads it. |
| `hwr-js.js` | ~3,320 | **All** HWR behaviour. Card rendering, search, filters, sort, section nav, scroll arrows, hover panels. Every one of the 15 pages loads it. |
| `hwr-bookmarks.js` | ~200 | `localStorage` helper. Exposes `window.HwrBookmarks`: `getBookmarks / isBookmarked / toggleBookmark / clearBookmarks`, `getVisits / recordVisit / clearVisits`, and `exportBookmarks / importBookmarks`. Keys: `hwr_bookmarks`, `hwr_recent_visits` (capped at 12, deduped by link). |

### 4c. Shared code — site-wide (not HWR-only, edit with care)

These are used by HWR **and** other sections, so a change here can affect pages outside
this doc's scope.

| File | What it does | Also used by |
|---|---|---|
| `11layout.js` | Sidebar, top bar, footer, hub nav, top-bar search | `coc-home.html`, `th18-layouts.html` |
| `11layout.css` | Layout/chrome styling | `home.html`, `coc-home.html`, `th18-layouts.html` |
| `sidebar.json` | Sidebar menu contents | site-wide |
| `11footer.json` | Footer contents | site-wide |
| `home.json` (`featured`) | Featured Topics + top-bar search index (11layout.js `loadFeaturedGroups`) | site-wide |

### 4d. Data files — where the content actually lives

| File | Size | Shape | Status |
|---|---|---|---|
| `hwr-categories.json` | ~79 KB | Object with 5 real keys | **Live — the backbone** |
| `hwr-websites.json` | ~148 KB | Array of 610 site objects | **Live — the site listings** |
| `hwr-recommended.json` | ~1 KB | Array of 5 | **Live** — "Recommended Tools" grid on the landing page |

(`hwr-1cards.json` used to sit here. Its contents were merged into
`hwr-categories.json`'s `categories` key and the file has been **deleted**. Comments in
`hwr-js.js` and `homewebresources.html` still mention it by name.)

### 4d-bis. Browser-stored state

Two things live in `localStorage` rather than in any JSON file, both owned by
`hwr-bookmarks.js`:

| Key | What | Written by |
|---|---|---|
| `hwr_bookmarks` | Saved sites | the bookmark button on any site card |
| `hwr_recent_visits` | Last 12 sites opened | a click listener in `hwr-js.js`'s `renderItem()` — the single place every site card is built, so this covers all eleven category pages |

Because this is browser-only storage, clearing site data or switching device
loses it. The **Backup & Restore** panel exports/imports it as JSON — either a
downloaded file or a pasted code. It lives on **`hwr-bookmarks.html` only**;
the home page used to carry a duplicate, which was removed deliberately so
there is one place to manage your library. Its markup, `.bk-*` CSS and
`initBackupPanel()` are all page-local — if a second page ever grows one, move
the CSS into `hwr-css.css` rather than copying it.

> ⚠️ Note: `netlify/functions/coc.js.txt` contains a **live Supercell API
> key in plaintext**. It isn't deployed (the `.txt` suffix means Netlify
> never reads it), but the key should be rotated and moved to an
> environment variable before that file is ever activated.

### 4e. Images

`webresources-icon/` — category thumbnails and per-site icons.
The category tiles are `hwr-<category>.jpg` (e.g. `hwr-anime.jpg`).

### 4f. Orphan

`hwr-zscriptwalato.js` (279 lines) — **referenced by nothing at all**, live or old.
Safe to ignore; probably safe to delete, but confirm before doing so.

---

## 5. How it works — the data flow

### `hwr-categories.json` — the backbone

Ignore keys starting with `_`; those are documentation notes written inside the JSON.
The real keys (ignore anything starting with `_`):

| Key | Type | Drives |
|---|---|---|
| `hubNav` | array of 4 | The Lobby / Bookmarks / Contribute / Glossary nav — **on every page, desktop strip and mobile bottom bar** |
| `featured` | array of 12 | The scrolling "Featured Picks" strip on `homewebresources.html`. Order here is scroll order; the loop copy is cloned at runtime, so **never duplicate entries by hand** |
| `categories` | array of 10 | Category tiles on the landing page and the discover list |
| `sections` | object keyed by page filename | The **section headings** within each category page |
| `glossary` | object keyed by page filename | Glossary terms and definitions |

A `sections` entry looks like this — note it defines a *heading*, not any sites:

```json
{
  "id": "official-model-sites",
  "title": "Official Model Sites",
  "group": "official",
  "containerId": "aiOfficialList",
  "subtitle": "Official AI platforms from leading model makers.",
  "icon": "<path d=\"...\"/>"
}
```

`group` and `containerId` are the join keys. Read on.

### `hwr-websites.json` — the 610 listings

A flat array. Every entry:

```json
{
  "name": "...", "link": "...", "icon": "...",
  "sub": "...", "cat": "anime", "group": "streaming",
  "keywords": "..."
}
```

- `cat` decides **which page** the site appears on
- `group` decides **which section on that page**

### Putting it together — what happens when a category page loads

1. Page loads `hwr-css.css`, `11layout.js`, `hwr-bookmarks.js`, `hwr-js.js`.
2. `hwr-js.js` fetches `hwr-categories.json` and reads `sections[<this filename>]`.
3. For each section it writes a heading plus an empty `<div id="{containerId}">`, and
   fills it with grey skeleton placeholders.
4. `hwr-js.js` fetches `hwr-websites.json` and looks the current filename up in
   `HWR_PAGE_CAT_MAP` to get this page's `cat` slug.
5. It filters all 610 sites down to those matching that `cat`, then buckets them by
   `group` into the matching `containerId`.
6. Skeletons are replaced by real cards. Counts, table-of-contents badges and category
   nav chips all update from the same data.

**So:**

| To do this | Edit this |
|---|---|
| Add / edit / remove a website | `hwr-websites.json` |
| Add / rename / reorder a section heading | `hwr-categories.json` → `sections` |
| Change the hub nav on every page at once | `hwr-categories.json` → `hubNav` |
| Change the featured scrolling strip | `hwr-categories.json` → `featured` |
| Change the landing-page category tiles | `hwr-categories.json` → `categories` |
| Add a glossary term | `hwr-categories.json` → `glossary` |
| Add a whole new category page | All of the above **plus** `HWR_PAGE_CAT_MAP` in `hwr-js.js` |

You should almost never need to hand-edit the card markup in a `.html` file.

---

## 6. Page structure

Every live page follows the same skeleton:

```
<head>   → hwr-css.css, 11layout.css, 11layout.js, hwr-bookmarks.js
<body>
  ├── sidebar              (11layout.js, from sidebar.json)
  ├── top bar + search     (11layout.js, from home.json "featured")
  ├── secondary top bar    ← see below, this is the fiddly one
  ├── hero
  ├── main content         (hwr-js.js, from the JSON files)
  ├── footer               (11layout.js, from 11footer.json)
  └── bottom nav (mobile)  (11layout.js, from hwr-categories.json → hubNav)
<script> → hwr-js.js
```

### The hero headline

Each category page's `<h1>` is two spans — the category name in the accent colour, then
the word "Collection":

```html
<h1 class="hero-title" id="heroTitle"><span id="heroTitleText"><span
  class="hero-title-accent">Anime</span> <span
  class="hero-title-collection">Collection</span></span></h1>
```

It is hardcoded per page, not read from JSON. A new category page needs its own copy.
(This used to read "Directory"; both the word and the CSS class were renamed.)

### The secondary top bar

Left → right, this contains two horizontally-scrolling strips separated by dividers:

```
[ Web Resources ] │ [ ◀ category chips ▶ ] │ [ ◀ hub nav ▶ ] │ [ i ]
                      .stb-dsn-wrap            .stb-hub-nav
                      #dsnCategoriesScroll     #stbHubNavScroll
                      #dsnScrollLeft/Right     #hubScrollLeft/Right
```

**This markup is byte-for-byte identical on all 15 pages, on purpose.** If you change
one, change all 15 — otherwise pages start behaving differently from each other, which
is exactly the bug this was cleaned up to fix.

Both strips share one function, `initHScrollArrows()` in **`11layout.js`** (~line
1133) — not `hwr-js.js`, despite what older comments in this codebase say; it moved
and some references were never updated. It gives them:

- **Arrows that only exist when needed.** `.is-hidden` is `display: none`, so an
  unneeded arrow occupies no space at all. The JS also toggles `.no-arrow-left` /
  `.no-arrow-right` on the strip so it reclaims the 24px gutter and edge fade that
  were being held open for the missing arrow.
- **Mouse wheel scrolls horizontally.** Hovering a strip and scrolling moves it
  sideways. The wheel is trapped while the cursor is over a strip, so a flick over the
  bar can't throw the page.
- **A `ResizeObserver` on the strip itself**, re-checking arrow visibility whenever
  the strip's *content* changes size — not just on scroll or window resize. Without
  this, a slow connection or a webfont swap that reflows chip widths *after*
  `renderCategoryNav()`'s one explicit post-render check had already run could leave
  an arrow missing until the user's next scroll or resize happened to trigger a
  recheck. This is what fixed the "arrows only show once I've scrolled" bug.

The hub nav strip is populated by `initHubNav()` in **`11layout.js`**, not `hwr-js.js`.
It fills `#stbHubNavScroll` (the inner strip) and must never overwrite the `<nav>`
itself, or it would delete the arrow buttons.

Active state is real: whichever `hubNav` entry's `link` matches the current filename
gets `.active`. Nothing is hardcoded per page.

---

## 7. Known issues

Pre-existing, not urgent, listed so nobody thinks they broke them:

- **`games/clair-obscur.html` does not exist.** Linked from `homewebresources.html`.
  Still outstanding.
- **`hwr-zscriptwalato.js` is unreferenced** by anything, live or old. Still outstanding.

Fixed already: the "Submit a Site" button now points at `hwr-contribute.html`; the
`<title>` tags on `homewebresources.html`, `hwr-contribute.html` and `hwr-glossary.html`
are corrected; `hwr-1cards.json`, `1hwr.css` and `1hwr.js` are deleted.

---

## 8. Quick reference

```
LIVE PAGES (15)
  homewebresources.html                    landing
  hwr-{ai,anime,asiandrama,games,manga,
       movies,music,parcode,torrent,
       webgames,fun}.html                  11 category pages
  hwr-{bookmarks,contribute,glossary}.html support

SHARED (HWR only)      hwr-css.css  hwr-js.js  hwr-bookmarks.js
SHARED (site-wide)     11layout.js  11layout.css
DATA (live)            hwr-categories.json  hwr-websites.json  hwr-recommended.json
IMAGES                 webresources-icon/

DEAD — DO NOT EDIT     hwr-*-old.html (10)   hwr-zscriptwalato.js (orphan)
```
