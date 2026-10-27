# Articles guide

How Parchrome articles are written, built and published. **Read all of this
before drafting or touching any article.** It records Adrian's rules, not
defaults: when this file and a habit disagree, this file wins. Keep it up to
date: every new decision Adrian makes goes in here.

Start with section 10 (**Current state**) to see what's done and what's next.

---

## 0. Who is behind these articles

> **ADRIAN (PARCORE) IS AN EXPERT ON EVERY GAME ON THIS SITE. ALL OF THEM.
> HE HAS BADGES IN EVERY GAME AND KNOWS WHAT HE IS DOING.**

What this means when writing:

- His fact-checks are final. When he corrects a number, a mechanic or an
  opinion, take it as the answer. Do not argue it back with what a wiki says.
  (Example: the first Hammer Jam draft said "save Builder Potions for after
  the event". He corrected it: Builder Potions are the event's real secret.)
- Write with the confidence of someone who plays at the top. No hedging
  ("it might be worth considering…"). Say what to do.
- The byline is **Parcore** (his player name). "Parchrome" is the site's name,
  never the author.
- Credentials on the page: **"experienced player"** only. No rank claims,
  badge lists or proof screenshots in articles (for now). The /coc/articles/
  subtitle still says "Written by Parcore, former #1 in the Philippines";
  the /articles/ hub dropped it (Oct 9 2026, Adrian). The hub's top is a
  short charcoal header band (brush streaks, a few muted red ones, torn bottom edge,
  modelled on Riot's support-site header; text left-aligned on desktop; bright red was
  rejected as too loud next to the sidebar;
  vector art drawn by _tools/articles-band.py) with the title ("Your unfair advantage" / "Read one. Leave with at least one
  move most players never learned. What the top of the ladder knows,
  written down for you."), then **"Hot right now"** (Oct 26 2026, Adrian;
  replaced the cover story + "Also new"): `articles.json` `hub.hot` as
  raised boxes with a red HOT tag, the first one big on the left (two rows
  tall, red "Read now" key), the other four in a 2x2 beside it; small
  laptops = big box as a full-width row, phones = big box then compact rows.
  Pictures always show whole at 16:9 (never cropped: the thumbnails carry
  their titles). The big one's blurred picture tints the page behind it.
  Every other article sits below in a card grid (3 across max; the .ah
  column caps at 1240px), opening with `hub.first` (Base Building, then
  Crafted Defenses), the rest newest first. The game chips and the search
  sit under the "More articles" heading; filtering or searching keeps the
  Hot boxes and lists every match in the grid. Earlier tries, both rejected: a patch-notes header
  (too plain), then a rounded banner with a placeholder Valorant cast
  (hero didn't match a CoC-only list; site/images/articles/hub-cast.webp
  is now unused).
  **Hub upgrade (Oct 26 2026, built on Adrian's "go crazy" brief, awaiting his
  QC):** under the band subtitle a stats line (avatar "Written by Parcore",
  live article / game counts, total minutes, "N/M read by you"); after the
  lead, "Browse by game" tiles (the home page's Featured Games art, from
  `articles.json` games `tile` / `icon` / `glow`; a tile picks that game's
  chip and scrolls to the grid); the grid (`#all`) has two chip rows, games
  and types (`?game=`, `?type=` in the address), raised grey keys with the
  off-white `--lb-pick` when picked, and the site's `.lb-search` bar; cards
  show "N min read" and a "Read" mark for articles this browser opened
  (localStorage `art-read`, written by article-cards.js on article pages).
  **Soon articles left the grid** for a numbered "Coming next" box (game
  icon, title, "Game · Tag"; no placeholder pictures). /articles/coc/ still
  has them in its grid, dimmed. Last: "What should we write next?" with the
  shared feedback box (Suggestion tab).

---

## 1. The workflow

1. **Topic:** the next one in `site/articles.json` (file order). Adrian
   sometimes picks a different one; then the list gets updated.
2. **Before drafting, ask.** Every article starts with questions to Adrian:
   - Should this article have tool quicklinks? Which tools? (Not every
     article gets them. Always ask.)
   - What's the **"real secret"**: the expert move most players miss?
   - What is missing? "Should we add X? Should we cover Y?" Explore the topic
     out loud so the article gives maximum useful information.
   - Anything in between useful and useless: ask before including it.
3. **Claude writes everything.** Adrian checks and revises. One article at a
   time: finish, check, publish, then the next.
4. **Unverified facts** are stated as **"expected"**, never as fact
   ("Expected: early November 2026"). Anything Claude can't confirm is asked
   about before publishing, not shipped with a guess.
5. **Ask before visible design changes.** Adrian decides how things look;
   offer options with a recommendation, then build his pick.
6. Publish (section 7).

---

## 2. Quality over quantity (the most important rule)

> Give players what they came for. Cut everything else.

- **No filler.** Don't explain what every player already knows ("Clash of
  Clans is a strategy game…", "Gold is a resource used to…"). Gamers hate it
  and so does Adrian.
- **No walls of text.** Short paragraphs (1–3 sentences). Lists and tables
  when the content is a list or a comparison.
- Every section earns its place. If it repeats another one, cut it. If
  unsure whether something is useful, **ask Adrian**.
- Stats, costs, timers and dates: **general, not exact** ("about two and a
  half weeks", "usually 4×, sometimes 3× or 2×", "50% off"). Rule-of-thumb
  numbers are fine (see 3b.4).
- **No outside sources.** Never link or cite other sites (Clash Ninja,
  Fandom, Liquipedia, other blogs). Adrian is the source.

---

## 3. Voice and tone

- **Point of view:** direct, second person ("you"), no "I". Parcore is the
  byline, not a narrator.
- **Write like a professional journalist (Adrian, Oct 2026).** Clear, plain,
  confident sentences a new player understands on the first read. One
  instruction per sentence. If a line needs re-reading, rewrite it.
- **Personality: yes, but clarity first.** Punchy lines are welcome as long
  as they stay professional and still say something useful.
- **Game terms: yes. Casual slang: no.** Use the words the game uses (tripled,
  meta, F2P are fine); never chat slang like "lowkey", "cooked", "carry".
- **No verdict where there is no right answer.** On play-style questions
  (e.g. "Should you rush Town Hall?") answer "It depends on how you play" and
  give a **pros/cons table**, then the practical tip. Don't pick a side.
- **Priority chains use arrows**, not strings of "then": "Defenses: Eagle
  Artillery → Monolith → Scattershots → traps."
- **Offense buildings stay general** ("Offense buildings"), not Barracks /
  Blacksmith / Workshop lists. The Laboratory is always named and always first.
- **American spelling:** defense, color, favorite.
- **No filler questions** in body text ("Want to farm faster? Then…").
  Question *headings* are fine when the first line answers them (3b.2).
- **Banned AI-slop words:** ultimate, insane, best ever, game-changer,
  unleash, dive in / deep dive, level up your…, everything you need to know,
  look no further, in this article we will. If a phrase could sit in any
  generic gaming blog, find a better one.

---

## 3b. Punchy writing: patterns that win

**Punchier lines always win.** Learned from the strongest CoC guide blogs
(Oct 2026). Learn the moves; never copy their text or facts.

1. **Hook = the reader's pain, in short punches.** "Right now, ores are the
   biggest thing slowing you down. Not gold. Not elixir. It's ores." Never
   "In this guide we will…".
2. **Question headings answered in two words**, then the reasoning.
   "Should You Rush Town Hall?" → *"Only if everything else is maxed."*
3. **"Not X. Y." contrast lines.** "Your goal is not perfect attacks. Your
   goal is fast rewards." The strongest line type there is.
   **But clarity beats punch (Adrian, Oct 11 2026):** he found clipped lines
   like "Not low-level heroes. Max-level heroes, when it counts." and "A
   rushed hero is a low-level hero. Potions fix that." confusing. Every line
   must state its point in full sentences: what to do, when, and why. Don't
   save words; fragments and riddles are out.
4. **Rule-of-thumb numbers are wanted:** "at least 150 points per attack",
   "save Books for 7–8 day timers". A player can apply them; they don't go
   stale like costs do.
5. **Recurring sections**, when they fit the topic:
   - **Mistakes** ("Stop Wasting X Like This")
   - **Pick / Skip** lists
   - **What NOT to buy / do**
   - **Cheat sheet** (a compact callout of the key choices)
   - **Daily routine** (5–6 steps) for events
   - **Realistic timeline** ("3–6 months with daily play") for long grinds
6. **Unlock / requirement guides = one heading per step** ("Requirement 1:
   …"), so the table of contents doubles as a checklist.
7. **Own data graphics:** charts and comparison tables made as images. They
   get shared on Reddit and Discord; paragraphs don't.
8. **A closing line with feeling** at the end of the body, e.g. "Two weeks of
   half-price everything. Don't spend it on Archer Towers."
9. **FAQ = exactly 3 questions worded the way people type them into Google**
   ("How do you unlock the 6th Builder in Clash of Clans?"), each answered in
   1–3 sentences. Its job is Google answer boxes, so repeating the article
   there is fine.

### What we never copy from other sites

- **Sales plugs:** no base packs, coaching, "best sellers" or product cards.
- **Emojis in headings or text** (🚀 ❌ 💀): noisy and dated.
- **Overpromising:** "4,000 points in JUST 10 minutes" style claims we can't
  back up. Punchy, yes. Unprovable, no.
- **"Other guides every clasher needs" link dumps.** One "Read next" card
  where it fits.
- **First person ("I finish…").**
- **External links and credits to other creators.**

---

## 4. Titles, tags and headings

| Where | Rule | Example |
|---|---|---|
| Card title (strips, feed, `articles.json` "title") | Catchy, specific, **no game name**, keeps the search word (Hammer Jam, 6th Builder, Tier List…) | Hammer Jam Explained: What to Upgrade While It's Cheap |
| Page `<title>` (Google) | Keyword version **with** the game name + " \| Parchrome" | Clash of Clans Hammer Jam Guide: What to Upgrade First \| Parchrome |
| Page H1 | The card title (Hammer Jam's currently starts with "Clash of Clans", see 9) | Clash of Clans Hammer Jam Explained: What to Upgrade While It's Cheap |

**No deks (Oct 26 2026, Adrian).** Articles have no line under the title,
on the page or on any card. Under a card's title come two grey lines
instead: **"Clash of Clans · Guide"** (game · category tag, no red) and
**"Published Oct 2026"**, or **"Updated Nov 2026"** once the article has an
`"updated"` date in `articles.json` (plus "· N min read").

**Category tag:** Event, Guide, Tier List, Skins. Add a new one only when none
fits. It shows as the white chip on the article banner, the chip on a
card's picture, and in the grey "Game · Tag" line under every card title.

**Section headings (`<h2>`):** Title Case, and either a real question
answered in its first line ("What Is Hammer Jam?") or a clear statement
("When to Expect Hammer Jam"). Never a half-question like "When Hammer Jam
happens" (Adrian found that confusing).

---

## 5. What every article contains

In page order:

1. **Banner**: official key art, 21:9 on desktop, 2:1 edge to edge on phones.
   The category tag sits centered on its bottom edge. File: `banner.webp`,
   1920px wide.
2. **Author block**: avatar `/icons/parcore-avatar.webp`, "Written by
   Parcore", "Published Oct 2026" (**month + year only**, never the day).
3. **H1 + "N min read · Updated for 2026"** (no dek). Read time = body words ÷
   220, rounded.
4. **Table of contents**: sticky column on the **right** on desktop; on
   phones a collapsible box under the header **and** a dropdown button at the
   right end of the secondary bar. Both highlight the section you're reading
   (scroll-spy). Every `<h2>` needs an `id` and a contents row.
5. **Hook** in the first lines of the first section (3b.1).
6. **Body sections**, short and scannable, including:
   - the **"real secret"** in its own section, said plainly (Hammer Jam: "The
     Real Secret: Builder Potions");
   - the recurring sections that fit (3b.5).
7. **Photos: 4–7** (Adrian, Oct 11 2026; looping clips count as photos) in the body (banner not counted), only where a picture
   proves or shows something (section 5b).
8. **"Read next" card** wherever another article is the natural next step.
9. **FAQ**: 3 Google-worded questions, `<h2 id="faq">FAQ</h2>` + contents row.
10. **Summary card** at the very end of the body (after the last section,
    with its own "Summary" contents row): 6–8 bullets with every takeaway,
    including the real secret. Then the closing line.
11. **"More for <game>"**: 3 links into the site's own pages and tools, each
    with its tool icon.

### Tool links

When text mentions one of the site's tools, link it with the tool's icon (a
small red chip):

```html
<a class="ap-tool" href="/coc/tools/walls"><img src="/clashofclans/coctools/th17-wall.webp" alt="" loading="lazy">wall calculator</a>
```

Icons: wall calculator `/clashofclans/coctools/th17-wall.webp`, army maker
`/clashofclans/coctools/army-camp.webp`, TH layouts `/icons/coc-nav/thNN.webp`.
Whether an article gets a quicklinks block is **asked per article**.

### Tier lists

Tables graded **S / A / B / C / D** (F only if something is truly unusable).
One row per tier; each entry gets a short reason, not a paragraph.

### Freshness

- Every article shows **"Updated for 2026"**. No exact patch dates.
- Adrian reviews articles mid-year and at the start of 2027; a re-checked
  article becomes "Updated for 2027".

---

## 5b. Pictures

- **Sources:** Adrian's in-game screenshots and official art. Banner = always
  official key art (Adrian may edit it into a thumbnail style).
- **Rights:** Supercell art is covered by the footer's Fan Content Policy
  line (`site/11footer.json` "disclaimer"). Before the first article for
  another publisher's game, check the footer: Riot (Valorant) wants its own
  "Legal Jibber Jabber" line (not added yet; ask Adrian); a Clash Royale
  article means changing "Clash of Clans material" to "Supercell material".
- **Folder:** one per article, `site/clashofclans/articles/<id>/`:
  - `banner.webp`: 1920px wide, used in the article
  - `thumb.webp`: 800px wide, the card/feed picture (`articles.json` "image")
  - body photos with plain names (`heroes.webp`, `league-shop.webp`…)
  - Other games use their own image folder the same way.
- **Export:** WebP, quality ~80, up to 1600px wide. Landscape. Photos can have
  different shapes; the page shows each one whole, never cropped.
- **Markup** (width/height = the file's real size, so the space is reserved
  while it loads):

  ```html
  <figure class="ap-fig"><img src="/clashofclans/articles/<id>/<name>.webp" width="1600" height="1000" alt="What the screenshot shows" loading="lazy" decoding="async"><figcaption>One plain line saying what it shows.</figcaption></figure>
  ```

- **Caption** under every body photo and **alt text** on every image, both
  describing what the picture *actually* shows. Don't caption a normal-price
  screenshot as if it were taken during the event.
- **Watermark:** only on article **thumbnails** (the /coc/ Popular Articles
  cards and the /articles/ feed rows): favicon + "Parchrome" in a small glass
  badge, top-left, added by CSS (`article-cards.css`, `.art-media` /
  `.art-row-media`). **Never** on the pictures inside an article, and never
  baked into the files. Keep the top-left of thumbnails clear.
- **Placeholder** until a real image exists:
  `/clashofclans/articles/placeholder-aqueen.webp`.

### Break up the text with the image library (Adrian, Oct 2026)

Don't make an article a wall of text. Where the text names a troop, hero,
spell, equipment or building, show its picture right there, from the site's
own library. **Don't overdo it:** one small row at a key moment, roughly one
every section or two, never under every paragraph.

- **Icon chips** (`.ap-chips` / `.ap-chip`, 36px round icon + name) for
  troops, heroes, spells and equipment, from `/clashofclans/coctools/units/`
  (150 icons: `giant-arrow`, `archer-queen`, `freeze-spell`, `healer`…).
  Example: the Giant Arrow chip where the article explains the Giant Arrow.
- **Building renders** for buildings: `/clashofclans/buildings/<name>/<level>.webp`
  (Town Halls, defenses), or the article's own folder for new ones.
- **Level / stage rows** (`.ap-forms`): a building's looks side by side.
- **Pictures inside tables** (`.ap-def`): a 40px render before the name.
- These small icons don't count toward the 4–7 photo range; that limit is
  for full-width screenshots.

### A photo must prove or show something

1. **Proof screenshots:** the in-game screen behind a claim (a price, a
   timer, the loot on a full collector).
2. **"Where to tap" screenshots:** the menu or button, the exact spot marked.
3. **Before / after:** side by side, same framing.
4. **Own graphics:** a small infographic when numbers are the point.

Pretty art that repeats the banner is decoration and gets cut.

### Shooting and editing

- Crop tight to what matters. Clean screen: no notifications, no
  low-battery bar; hide or blur other players' names, tags and clans.
- Annotations in Parchrome red (#c23b3b): circles, arrows, boxes, same
  thickness every time, max 2–3 per photo.
- **Card thumbnails (`thumb.webp`): the official key art, no text, no
  effects.** Usually the banner art cropped to 16:9 at 800px, framed so the
  subject stays whole (upgrade-order is cropped from the top so every spire
  shows). Adrian tried text titles and a composite (site building icons,
  smoke, a Builder) in Oct 2026 and rejected both. The top-left gets the CSS
  watermark, so keep that area calm.
- **Town Hall headings** can carry the TH picture before the text:
  `<h2 id="thNN" class="ap-th-h"><img src="/clashofclans/buildings/town-hall/NN.webp" alt="" width="40" height="40" loading="lazy">Town Hall NN</h2>`
  (all TH1–18 exist there; style in `articles.css`).

### Shot list

Every draft marks each photo slot with a comment saying exactly what to
capture: `<!-- SHOT: the League Shop with Builder Potions boxed in red -->`.
Adrian shoots from that list, sends the screenshots in order, and Claude
converts them to WebP, swaps them in, writes the captions and alt text, and
deletes the SHOT comments.

---

## 6. Where things live

| What | File |
|---|---|
| Article list (cards, feed, strips, read-next) | `site/articles.json` |
| An article page | `site/articles/<game>/<id>.html` |
| Feed pages | `site/articles/index.html` (all, with game filter chips), `site/articles/coc/index.html` |
| Article + feed page styles | `site/articles.css` |
| Card, feed row, read-next, watermark styles | `site/article-cards.css` |
| Builds cards/feed/filter/read-next; scroll-spy; phone TOC dropdown | `site/article-cards.js` |
| /coc/ "Popular Articles" strip | `site/coc/index.html` (`#cocArticles`, built from the JSON) |
| Section nav (phone bottom nav, More sheet) | `site/game-nav.json` → `"articles-coc"` |
| Sidebar entry | `site/sidebar.json` → topBox "Articles" (`activePrefix: /articles/`) |
| Sidebar icons | `site/icons/articles.svg` (newspaper), `site/icons/web-resources.svg` (browser window): dark-red tile, red + white glyph, a matching pair |
| Avatar | `site/icons/parcore-avatar.webp` |

**Pages are edited directly.** The three article pages were first generated
by a temporary script that no longer exists. A new article = a copy of
`site/articles/coc/hammer-jam.html` (section 7).

**Shared chrome:** the sidebar, bars, bottom nav and More sheet come from
`11layout.js` / `11layout.css`. If you change either file, bump the `?v=` on
every 11layout link site-wide (CLAUDE.md rule).

### articles.json

```json
{ "id": "hammer-jam", "game": "coc", "category": "Event",
  "title": "Card title", "read": 6,
  "image": "/clashofclans/articles/hammer-jam/thumb.webp",
  "date": "2026-10-08", "status": "live" }
```

- `id` = the URL slug (`/articles/coc/hammer-jam`). **Never change it once
  live.**
- `status`: `"soon"` (dimmed card, no link) or `"live"`.
- `date`: ISO, for sorting; pages show month + year only.
- `games`: every game that can have articles, with its `related` game.
- File order = order of the /coc/ strip. The feed puts live articles first
  (newest first), then the soon ones in file order.

### How the cards look (built by article-cards.js)

- **/coc/ strip card:** picture (watermark top-left, "Coming soon" badge
  top-right on soon cards), eyebrow "CLASH OF CLANS" left + red category
  right, title (2 lines max), month. 4 / 3 / 2 whole cards per row by
  width, ‹ › arrows on desktop, swipe on phones.
- **Feed card (grid, Oct 9 2026):** picture on top (watermark top left, red
  category chip top right), full title, then grey lines "Clash of
  Clans · Guide" and "Published Oct 2026 · 8 min read". 3 across on desktop, 1 column on phones. Soon cards
  are dimmed with **no "Coming soon" text** (Adrian's pick).
- **Read next card:** `<div class="art-next" data-article="<id>" data-label="Read next"></div>`
  inside the article. Shows "Read next · Coming soon" until the target is
  live, then becomes a link by itself.

### Navigation on article pages

- **Breadcrumb font: Sora** on desktop and phone (Adrian, Oct 2026). articles.css
  sets it, because its `* { font-family: Oxanium }` would otherwise win.
- **Desktop secondary bar:** the breadcrumb "Articles › Clash of Clans ›
  Hammer Jam" + the site search. No page strip (`data-hub-nav="off"`).
- **Phone secondary bar:** "Articles › CoC › Hammer Jam" (short names), the
  earlier steps are **links**; the table-of-contents button at the right end.
- **No bottom nav on any articles page** (Adrian, Oct 2026): the article HTML
  has no `#bottomNav` / `#moreOverlay` markup, and articles.css drops the
  footer's 90px bar room when `.bn-bar` is missing. Don't add them back when
  copying hammer-jam.html. The hubs (/articles/, /articles/coc/) have none either.
- **Phone bottom nav (removed Oct 2026, kept for reference):** All · **this game** · More · **related game** ·
  Search, with game icons (grey at rest, colour when active), labels one line
  with "…". Tapping the related game opens `/articles/?game=<key>` ("No Clash
  Royale articles yet."). The More sheet lists every featured game (CoC →
  Valorant), the current one highlighted, each opening the feed for it.
- Related pairs (`articles.json` → `games`): CoC ↔ Clash Royale, CODM ↔
  Valorant, Minecraft ↔ Genshin Impact, Tekken → Valorant. A game's first
  article needs an `"articles-<game>"` entry in `game-nav.json` (copy
  `"articles-coc"`, swap the middle two entries) and that key in the page's
  `<body data-game-nav="…">`.

---

## 7. Publishing a new article

1. Copy `site/articles/coc/hammer-jam.html` to `site/articles/<game>/<id>.html`.
2. Change in the copy:
   - `<title>`, meta description, canonical URL
   - the desktop breadcrumb (`.stb-crumbs`, last step = short article name)
     and the phone trail (`.secondary-content`, same steps, short names)
   - banner `src` + alt + category tag; H1; read time; published month
   - the table of contents (`#apToc`): one row per `<h2>`
   - the body, FAQ, Summary card, "More for <game>"
3. Another game? Set `<body data-game-nav="articles-<game>">` (section 6).
4. Images into `site/clashofclans/articles/<id>/` (5b).
5. In `articles.json`: point `image` at `thumb.webp`, set `status` to
   `"live"`, the `date` and `read` (the page's "N min read" number; the
   cards and the hub's minutes total use it). The /coc/ strip, both feeds and any "Read next"
   card pointing at it update by themselves.
6. Preview: `python _tools/serve.py` → http://localhost:8765/articles/ on
   desktop and phone width (headless notes in CLAUDE.md). The scroll-spy
   uses IntersectionObserver, which doesn't fire in headless Chrome's
   `--virtual-time-budget` mode: test it with puppeteer-core driving the
   installed Chrome in real time.
7. Adrian checks it. Then deploy.

---

## 8. Checklist before Adrian reviews

- [ ] Hook in the first lines; no filler; no walls of text
- [ ] The "real secret" has its own section
- [ ] Question headings answered in 2 words; at least one "Not X. Y." line; headings in Title Case
- [ ] No outside sources; stats general; rule-of-thumb numbers where useful; unconfirmed facts say "expected"
- [ ] Card title without the game name; `<title>` with it; no slop words; no dek
- [ ] Byline Parcore, "Published <Mon> <Year>", "Updated for <Year>"
- [ ] Every `<h2>` has an id and a contents row (incl. FAQ and Summary)
- [ ] 4–7 body photos, each with SHOT note or real image + caption + alt; tool links carry their icon
- [ ] FAQ (3 Google-worded questions), Summary card at the end, closing line
- [ ] No emojis, no plugs, no overpromises, no first person
- [ ] "Read next" card where it helps
- [ ] Questions for Adrian listed (tool quicklinks? real secret? anything to add or cut?)

---

## 9. Open questions (decide with Adrian, then move into the rules)

- ~~H1 with or without the game name?~~ **Decided (Oct 2026): the H1 always
  starts with the game name** ("Clash of Clans Upgrade Order: …").
- **Riot "Legal Jibber Jabber" footer line** for the Valorant pages: offered,
  not answered.
- **Watermark on the "Read next" card thumbnail?** Offered, not answered.

---

## 10. Current state (2026-10-10)

### The list (`articles.json`, in order)

| # | id | Category | Title | Dek | Status |
|---|---|---|---|---|---|
| 1 | equipment-tier-list | Tier List | Upgrade the Right Equipment: The Full Tier List | Spend ore smarter. | **live** (Oct 2026) |
| 2 | hammer-jam | Event | The Hammer Jam Trick Most Players Miss... | Half the price, double the gains. | **live** |
| 3 | upgrade-order | Guide | What to Upgrade First at Every Town Hall (The Full Upgrade Order) | Every hammer swing counts. | **live, noindex** (awaiting Adrian's fact-check) |
| 4 | crafted-defenses-season-4 | Guide | Cake-A-Pult Is Here: Crafted Defenses Season 4 Explained | Your heroes have a new problem. | **live, noindex** (draft, awaiting Adrian) |
| 5 | rushing-meta | Guide | Rushing Is the New Meta: Here's Why Everyone's Doing It | Max less. Reach the top sooner. | **live** |
| 6 | best-pets | Guide | Which Pet Should You Upgrade First at Each Town Hall? | Spend Dark Elixir where it counts. | **live** (Oct 11; indexed; banner/thumb in, 6 body photos still placeholders) |
| 7 | base-building | Guide | Base Building 101: Layouts That Hold Up in Real Attacks | Stop giving away free triples. | soon |
| 8 | sixth-builder | Guide | The Fastest Way to Unlock Your 6th Builder | One more hammer, zero excuses. | **live** (Oct 9; real photos + looping surrender clip in, Oct 11) |
| 9 | farming | Guide | Why Are We Farming With Valkyries Instead of Sneaky Goblins? | Stop Clearing the Whole Base | **live, noindex** (Oct 9; awaiting fact-check; real photos + looping Valkyrie clip (mp4, plays like a GIF) in, Oct 11) |
| 10 | clan-games | Event | Clan Games: Max Out 4,000 Points Without the Grind | 4,000 points, no sweat. | **live** |
| 11 | troop-tier-list | Tier List | Troop Tier List: Who Actually Carries | S tier or straight to the bench. | soon |
| 12 | best-hero-skins | Skins | The Best Hero Skins Ever Released, Ranked | Pure drip, properly ranked. | soon |

Older title decisions refer to the article-list order before the Oct 2026 additions; see the individual article notes below. In `articles.json`, equipment-tier-list leads the /coc/ strip (Adrian: most popular).

### Equipment Tier List: Adrian's calls (Oct 2026, in progress)

Picked ahead of Base Building. **Adrian sends the ranking; Claude writes
around it** (Claude can't credibly grade the Dragon Duke or post-rebalance
pieces). One S–D table per hero (King, Queen, Warden, RC, Prince, Duke), then
an "ore priority" section across heroes. Real secret: **don't try to max them
all. Max by pairs: the pieces you'll actually use, and learn the meta.** Tool
link: only the Top 200 equipment (`/coc/tools/leaderboards#equipment`). The
tier list maker (`/coc/tools/equipment-tier-list`) already promotes this
article from its own page.

Draft built 2026-10-08: `site/articles/coc/equipment-tier-list.html`
(noindex; `articles.json` still "soon"). His ranking came as a tier list maker
link; his pairs per hero are listed under each hero table ("Pairs Worth
Maxing"). Tier tables = `.ap-tiers` in articles.css (tier letters in the tool's
colours, equipment icons on the army cards' blue/purple rarity backgrounds;
phones stack the reason under the name). Ore facts come from
`coc-equipment.json`: Commons max at 18 with no Starry Ore, Epics go to 27 at
about double the Shiny/Glowy plus Starry; all 42 maxed > 1.6M Shiny.
No "More for" box (one tool link, inline).  His answers (same day): Queen's third pair is Monolith Arrow + **Action
Figure**; the ranking was "overall, every Town Hall once unlocked" (replaced Oct 11 2026 after a review: now "for war attacks with high-level heroes", not a fixed order); each pair
has his one-line "when to use" note under it (King, Queen, Warden, Prince);
RC and Duke notes added later the same day; Haste Vial + Hog Rider Doll
dropped (RC keeps two pairs). Only C-tier pieces (Rage Vial, Life Gem) sit in
pairs now, and the tier text says so.
Banner and thumbnail (Adrian's pick, an exception to "official key art"): his
42-piece board from the tier list maker, rendered by headless Chrome with the
board lifted onto a plain background (every row on one line), centred so it
survives the 21:9 desktop crop, the 2:1 phone crop and the 16:9 card.
Oct 11 2026 review fixes (Adrian approved): Hog Rider **Puppet** (the site data still says "Doll"); leaderboard = one signal, not proof; Spiky Ball "two of his three pairs"; Stick Horse (getting there) vs Rage Vial (burst on ability, with the Gauntlet); Monolith Arrow 14% up to 180 housing space, 5% above 250; pair notes say "can", not guaranteed results. Oct 11 2026 re-rank (Adrian): King A Snake Bracelet/Stick Horse, Gauntlet to B, Vampstache above Barbarian Puppet; Queen A = Monolith, Mirror, Healer Puppet; Warden S = Eternal Tome + Rage Gem, Fireball A, Heroic Torch B under Healing Tome; RC A = Seeking Shield, Electro Boots, Frost Flake B; Prince A = Dark Crown, Meteor Staff, Henchmen B; Duke A = Rocket Backpack, Electro Fangs. S tiers now 5 Commons + 3 Epics. The banner/thumb board image predates this re-rank. Pairs list the higher-tier piece first (his "consistency" call). Piece reasons were aligned to his notes
(Heroic Torch = Bowlers/Throwers/Electro Titans, Healing Tome = Dragons and
Dragon Riders, Life Gem = Thrower attacks, Monolith Arrow = Queen Charges).

### Crafted Defenses Season 4: Adrian's calls (Oct 2026)

Added outside the list (Blueprint CoC's topic, rewritten and expanded; their
"How Good Are These" section dropped). Stats come from the Clash wiki and are
shown **in full** (all 9 module tables, Adrian's pick: an exception to "stats
general"). Tables are generated by a script from the wiki data, so totals match
(67d 13h per defense). Real secret: **Hitpoints above 2,400 so the Giant Arrow
can't snipe it** (module level 4 = 2,500 HP, TH14). Ranking (Oct 11 2026, Adrian): **Cake-A-Pult and Hot Candle tied** at the top (TH11–18), Hero Hunter clearly below; no "almost nobody uses it" claim. Hitpoints advice = as far as your TH allows (module cap TH11 1, TH12 2, TH13 3; level 4 needs TH14). No tool links, no "More for" box. Building renders from the wiki in
`site/clashofclans/articles/crafted-defenses-season-4/`. Banner/thumbnail:
Supercell's Cake-A-Pult key art (media.ffycdn.net), banner 1920 + thumb 800.
Icon chips: Archer Queen + Giant Arrow (real secret), Healers/Golems/Balloons
(Cake bomb), the five heroes + Poison Spell (Hero Hunter), Freeze/Overgrowth/
Invisibility (counters); renders in the ranking table.

### Upgrade Order: Adrian's calls (Oct 2026)

Picked ahead of the list and moved to #2 (second card on the /coc/ strip).
Sections: The Rule → The Real Secret: The Laboratory Never Sleeps → Pet
House Is a Second Laboratory → Should You Rush Town Hall? → one section per
Town Hall (TH3–18, TH picture in the heading, TH9–18 link their layouts) →
Common Mistakes to Avoid → FAQ → Summary.

- Order at every TH: **offense, then defense, walls always last.** Laboratory
  first, always (use a Hammer/Book of Building on it). Offense buildings
  are named generally.
- Research the troops you use most; ground attackers keep **Super Wall
  Breakers** at the level of the walls they face.
- **Rushing: no verdict.** "It depends on how you play" + pros/cons table
  (a Hero Potion / Power Potion covers low levels in war, but is used up
  every war; the item is "Power Potion", no s). Best time to move up: just before Hammer Jam.
- **No Town Hall weapon priority** below TH17 (TH12+ already has it). TH17:
  upgrade the Town Hall weapon (levels 1–5) before the Monolith.
- **Defense order (Oct 11 2026, Adrian):** Air Defense always before Wizard Towers (TH5–9). TH11–16: Eagle Artillery → Monolith (+ Spell Towers at TH15) → merged defenses → Inferno Towers / Scattershots (Scattershots first at TH13–14; TH14 = Eagle Artillery → Builder's Huts to at least level 1 → Scattershots → Infernos) → X-Bows and Air Defenses (never say "equal priority") → other defenses → traps. **No Eagle Artillery at TH17–18.** TH17: Town Hall weapon first. TH18: Logger → Longshot and Smasher → Revenge Tower and Super Wizard Tower.
- **Traps = their own item after Defenses in every TH list** (Adrian, Oct 11 2026), only the traps that TH has: Giga Bomb (TH17+) → Tornado Trap (only if it has an upgrade) → Hidden Teslas → Skeleton Traps → Seeking Air Mines (black) → Air Bombs (red, kill Healers) → Giant Bombs → Spring Traps → Bombs. Hidden Tesla lives here, not in TH7's defense list.
- **Item 2 of every list (TH4+):** new-hero Town Halls (4, 8, 9, 11, 13, 15) = "Hero Hall, Clan Castle and Army Camps."; others = "Clan Castle and Army Camps, Hero Hall." **TH16 skips the Clan Castle** (its upgrade only adds a siege machine slot nobody uses): listed below offense as "skip it", with a line explaining why. Dragon Duke unlocks at TH15 (Hero Hall 9).
- Pets covered (Pet House = second Laboratory), Hero Equipment not; Read
  next → best-pets. Builder Base skipped.
- Banner and thumbnail: the official TH18 key art; body photo: Adrian's
  rushed-base screenshot.

Oct 11 2026 review fixes (Adrian approved): labelled a general plan for war players, not universal; TH lists are for developing each level, not the fastest route; **Clan Castle and Army Camps named right after the Laboratory in every TH list** (exception to "offense buildings stay general"); Rage Spell at TH7 (wiki); King usable in attacks from TH4 since May 26 2026, upgraded from TH7 after his Hero Banner; TH18 Guardians explained (one defends at a time, builder to upgrade, can't defend in multiplayer while upgrading); Revenge Tower + Super Wizard Tower after the Guardians (placement unconfirmed by Adrian); rushing con no longer claims war/CWL match you against stronger bases; Hammer Jam timing = "can pay off". Heroes stay top priority at every TH (Adrian): "keep a builder on a hero"
holds from TH7 up. Unverified facts: Clan Castle at
TH3, Balloons at TH4, Rage at TH6, Minion Prince at TH9, TH14 Builder's Huts,
Hero Hall raising hero max levels. Remove `noindex` once cleared.

### Hammer Jam: done

Fact-checked by Adrian: buildings, Laboratory, heroes, pets, walls and the
Builder Base are 50% off (cost and time); Hero Equipment is not; the discount
counts for upgrades *started* during the event; collectors are "mostly 4×,
sometimes 3× or 2×", and their bigger capacity makes raiding full collectors
worth it; Gold Pass stacks multiplicatively (50% + 20% = 60%, not 70%);
expected early November 2026. The secret: **Builder Potions bought with CWL
League Medals in the League Shop, never Hammers**; drink them while every
builder is busy. Real banner, thumbnail and 4 screenshots are in.

### Hammer Jam: Oct 11 2026 fixes (Adrian)

- Walls: free a builder **only while grinding walls**, not for the whole event.
- Discount counts only for upgrades started during the event; a running upgrade keeps full price and timer.
- New section "Research Potions for the Laboratory": 24× for one hour; worth double during the event because timers are halved. Spend Raid Medals on Research Potions; Laboratory and pet upgrades are 50% off in cost and time.

### Hammer Jam: still to do (Adrian approved the patterns, not yet applied)

- A **hook** at the top, e.g. "Hammer Jam is the one time Clash pays you to
  upgrade. Half the price, half the time. Waste it and you wait months for
  the next one."
- **Punchier headings** (proposed: "Start These Upgrades First", "Stop
  Wasting Hammer Jam Like This", "Do This Before It Starts").
- A **"What NOT to Buy"** section and a **"Quick Daily Routine"** (collect
  and queue → raid full collectors → dump loot into walls → requeue the
  longest upgrades → Builder Potion before logging off).
- **FAQ** (3 Google-worded questions) and a **closing line**.
- Ask Adrian: name the **B.O.B Control Hut** in "Push for Your 6th Builder",
  or keep it general for the 6th Builder article? And should "When to Expect"
  say the May 2026 run was a **Builder Base** Hammer Jam?

### Best Pets: Adrian's calls (Oct 10, 2026)

Draft at `site/articles/coc/best-pets.html` (noindex; `articles.json` remains
`soon` until review). Working card title: **Which Pet Should You Upgrade First
at Each Town Hall?** The article is primarily an upgrade-priority guide, with a
compact hero-pairing reference added from Adrian's current recommendations.
Keep both formats: one overall S–C pet table, ordered S at the top through
C at the bottom, plus a Town Hall section for TH14–18. The table uses the
`.ap-tiers` style from Equipment Tier List and shows an image and a short reason
for every pet.

- Pairing reference ranks heroes for each pet, strongest fit first: L.A.S.S.I:
  Royal Champion, King; Electro Owl: Warden, Minion Prince; Mighty Yak: King,
  Queen; Unicorn: Queen, Warden; Frosty: Queen, King, Warden; Diggy: Royal
  Champion, Queen, Warden, King; Poison Lizard: Warden, King, Queen, Royal
  Champion; Phoenix: King, Royal Champion, Minion Prince, Dragon Duke, Queen;
  Spirit Fox: Royal Champion, Dragon Duke, King; Angry Jelly: King, Warden,
  Dragon Duke, Queen, Minion Prince; Sneezy and Greedy Raven: Warden, Queen,
  Minion Prince. Adrian repeated Queen in the latest Frosty list; retain Warden
  from his prior Frosty pairing list unless he corrects it.

- Overall tiers: **S** Phoenix, Spirit Fox; **A** Angry Jelly, Frosty, Sneezy,
  Greedy Raven; **B** Electro Owl, Unicorn, Diggy; **C** L.A.S.S.I, Mighty Yak,
  Poison Lizard. Keep Frosty at the top of A: it is underrated, especially for
  funneling, where it gives a hero more independence.
- Unicorn is useful at TH14 and TH15 despite its B overall tier. Poison Lizard
  is the lowest-priority pet.
- Greedy Raven is a strong Warden-charge pick and also works for Queen charges.
  It clears trash buildings quickly, especially high-HP storages, making the
  charge noticeably faster.
- Sneezy is no longer recommended for Warden charges. **Correction (Oct 11
  2026, Adrian):** it is Sneezy's **Boogers** that no longer trigger traps (not
  "projectiles", not "Air Mines"): "Sneezy's Boogers no longer trigger traps,
  which removes one reason to pair her with a Warden charge." The Boogers can
  also lure Clan Castle troops toward the Warden. **Update (Oct 11):** Sneezy is
  the **second option** for Warden charges, Greedy Raven first. The big downside:
  Boogers trigger the Clan Castle when they enter its range. Keep Sneezy in A.
- **Oct 11 re-rank (Adrian):** real secret is now **"Frosty Is Underrated"**
  (S tier, last in S; works with **any hero**; upgrade right after Phoenix).
  Within-tier order now matters (listed strongest first): S Phoenix, Spirit
  Fox, Frosty; B Unicorn, Diggy, Electro Owl; C Mighty Yak, L.A.S.S.I, Poison
  Lizard. Pairings added: Unicorn → King (3rd), Diggy → Minion Prince (5th),
  Frosty → all six heroes. **TH14: max Unicorn only** (Adrian, Oct 11); the TH15 pets
  replace the other three, Dark Elixir goes to heroes. Staying long at TH14 =
  may upgrade a few, but strongly discouraged: move up, **TH14 → TH15 is the
  biggest power spike in the game**. Completion players: Electro Owl → Mighty
  Yak → L.A.S.S.I. "Most players walk past Frosty… Top players don't." approved.
- **Banner/thumb (Oct 11):** Frosty (Adrian's 2400px cutout) stepping out of a dimmed,
  blurred grid of the other 11 pet tiles with one empty glowing slot; title "THE PET /
  EVERYONE / SKIPS" + "TOP PLAYERS DON'T" (Orbitron, the canvas thumbnail style). Artboard
  `BestPets.dc.html` in the "Article Thumbnails" Claude Design canvas; files in
  `site/clashofclans/articles/best-pets/`. Phoenix + S-box idea dropped (title points to Frosty).
- **Angry Jelly** (Adrian, Oct 11): its hero targets only defenses for about 30
  seconds. Unlocks TH16 (fact); Greedy Raven TH18 (fact).
- **Frosty is not a blanket "yes"** (Adrian, Oct 11): worth upgrading when the
  attack uses a hero funnel or distraction (it makes a single hero more
  independent); other pets come first for other armies.
- **Unlock timing comes before tiers** (Adrian, Oct 11): the tiers assume every
  pet is unlocked. The article has a "When Does Each Pet Unlock?" table (TH14
  Unicorn/Owl/L.A.S.S.I/Yak, TH15 Phoenix/Frosty/Diggy/Lizard, TH16 Spirit
  Fox/Angry Jelly, TH17 Sneezy, TH18 Greedy Raven) with an upgrade-first chain
  per TH; the FAQ answers by Town Hall (Unicorn TH14, Phoenix TH15, Spirit Fox
  TH16).
- Oct 11 rewrite: 6 photo slots (Pet House screen, Phoenix save, Frosty funnel,
  Spirit Fox invisibility, Sneezy Boogers pulling CC, Greedy Raven charge), all
  placeholders with SHOT notes; pairings table reordered to tier order.
- Real secret: unlock pets as you advance, then spend Dark Elixir on the pets
  that improve the attacks you actually use. Do not max every pet by default.
- Include the Army Maker quicklink. Use the pet icon assets in
  `docs/coc-image-library.md`, plus Town Hall renders in the TH14–18 headings.
  Banner and two body images still need screenshots/art; SHOT notes are in the
  draft.

### 6th Builder: Adrian's calls (Oct 11, 2026)

- In-game names: **B.O.B Control** (100,000 Builder Gold), **B.O.T.O's Shack** (1,000 gems).
- Hero split 23/22 is proven by a table (wiki costs: both heroes cost the same per
  level from 16 up; BM levels 16–20 take 4d vs the Copter's 5d, so the extra level
  goes on the Battle Machine). Time, not Elixir, is the real argument: 35 vs 75 days.
- Electro Fire Wizard starts at 17 = one upgrade to 18. Example table of starting levels (wiki): Baby Dragon 5, Power P.E.K.K.A 13, Hog Glider 15, EFW 17. Wiki says BB troops max at 20, not 18: "max" claim removed pending Adrian.
- One-troop surrender farming: only when only Elixir upgrades are left **and** the
  reader doesn't mind losing trophies (trophies → league → Star Bonus size).
- "99 days" in the title: considered and dropped.

### Farming: fixes (Oct 11, 2026)

- League bonus scales with destruction: a 50% win pays **80%**, full bonus at 70%+
  (wiki, Multiplayer Battles). The article says so wherever it mentions the bonus.
- Loot per attack (500,000) and storage-fill times are **estimates**, shown as an
  attacks-to-fill table (300k/500k/700k); minutes are the best case.
- Rage Gem = Warden, upgrade first for this attack. Dragon Duke is the 4th hero (Royal Champion dropped),
  Rocket Backpack + Electro Fangs. Army cards (army-sheet.js) show his two links; text matches them.

### Meteorite Builder Skin: rewrite (Oct 12, 2026, awaiting Adrian)

`site/articles/coc/meteorite-builder-skin.html` (noindex, `articles.json` "soon").
Facts from Supercell's TH18 update notes: 3,200 stones, once, covers every Builder;
10 per Supercharge level, 8 per module level; removed upgrades were converted **once,
at launch** (the old draft wrongly said it keeps happening). Real secret reworded:
"Temporary upgrades, permanent stones" (also the new dek). Adrian confirmed (Oct 12):
Supercharge = building maxed for its TH (2–3 levels); **Fancy Shop shows at TH12–18
only** (verified in game; web sources saying TH16/17 are wrong); 5,000-stone cap;
Crafted Statue and Builder Bust both 500; Charge Effect can't be removed; an upgrade
still running at season end pays nothing. 5 photo slots are placeholders.

### Base Building 101: Adrian's calls (Oct 15, 2026)

Draft: `site/articles/coc/base-building.html` (noindex; `articles.json`
remains `soon`). Scope = war bases only. Include quicklinks to every TH8–18
layout page. The real secret is dead zones; cover every supplied topic,
including Queen-range spacing, Eagle placement, Flame Flinger coverage,
broken-wall pathing, traps, Clan Castle placement, and Spell Tower priorities
(Rage → Invisibility → Poison). Use the Archer Queen placeholder for the
banner and all seven body image slots. The banner/thumb and body images still
need Adrian's screenshots/art before the article can go live.

Rewritten Oct 15, 2026 (Adrian: "make it professional and clear"): 12 rules, each
tightened to 2-3 short paragraphs. New rules built from Adrian's own war-base notes:
Rule 5 (Town Hall off the siege path: Log Launcher / Wall Wrecker drive at the Town Hall),
Air Sweepers aimed at the routes to key defenses (in Rule 8), Rule 12 (test in a friendly
challenge). Eagle placement split into its own rule (4); TH spacing is a table (Rule 3).
Read next = best-layouts.

Adrian's layout rules: four open tiles on a straight approach before the fifth
tile (the wall); use two wall pieces diagonally. Leave the Eagle Artillery
opposite the Town Hall when they are separate. TH17 merges it into the Inferno
Artillery Town Hall weapon, so this rule changes at TH17. Spread high-impact
defenses, use deliberate dead zones and broken-wall openings to disrupt
funnels, and place traps on predicted troop paths. Factual review still needed
for the exact diagonal spacing, trap combinations, and which defenses can
reach a parked Flame Flinger on each layout.

### Troop tier list: rebuilt Oct 15, 2026

Tiers = Adrian's own list (tier list maker link under the board on the page; 49 troops).
Top: a picture board (`.ap-tierboard`, same look as the maker), each icon jumps to its
troop. S to C troops: picture, name, **why it's in that tier** (not what the troop does),
one + and one − line (`.ap-troop`, `.ap-pc`). D to F: picture + one line (`.ap-troop.is-short`).
Real secret: "Flexibility Beats Raw Power" (Adrian's pick). Adrian's own reasons for
S and A (Healer, Dragon, Thrower, Balloon, Headhunter, Super Wall Breaker) are the
model: say why the troop matters in an attack, in plain words.

### War bases (best-layouts): Oct 15, 2026

Title "The War Bases Behind a 50-Win Streak" (Adrian: the streak is real), dek
"Copy them before your next war." The id stays `best-layouts`. One base per Town Hall,
TH9 to TH13 live, TH14 to TH18 still "coming soon" (one line each, dimmed picker tile).

- Each base reads like the rest of the article, no box (Adrian, Oct 15): the
  screenshot as a normal `.ap-fig`, a dark **Copy Layout** button (the in-game
  link) on its bottom-right corner (`.ap-fig-link`), the Clan Castle as the
  caption, then the reasons as a bullet list with bold leads. The button is
  placed and sized in % of the picture so it **always covers the "AC.Parcore"
  watermark** (Adrian's pick); smaller on phones. A red button and a
  "THNN Layouts" button that led to the layouts page were both tried and
  rejected. A ready-to-copy base sits in a comment above the TH9 section.
  Town Halls without a base get one line: "The Town Hall NN base is coming soon."
- Bases come from the layouts pages: same picture
  (`/clashofclans/home/thNN-N_watermarked.webp`) and link as that base's JSON entry.
  **Exception to 5b:** these screenshots keep their baked-in watermark (Adrian's pick).
- The Clan Castle must match the base's `cc` in `thNN-layouts.json`, and it must
  fit that Town Hall's Clan Castle space (`coc-army-data.json` townHalls.cc).
  TH9 base 4 changed to 1 Furnace + 12 Archers on both pages.

### Clan Games: fixes (Oct 11, 2026)

- Troop, spell and siege training times were removed in 2025: no "queue the next army" advice.
- 150 points per attack is a **rule of thumb** (≈27 attacks to 4,000), not a game rule.
- Super Troop challenges (1,500 points) **don't appear every Clan Games**: always "when one shows up".
- Banner/thumb (Adrian's pick): the Strongman render from the Clash wiki on a plain dark background (#111113),
  not key art. Reward chips (Book/Hammer of Building, Builder/Hero/Power Potion) are wiki icons in the article folder.
  Body pictures = three own infographics (no current in-game screenshots exist anywhere; the wiki/Supercell
  ones are 2017-2019 with old caps): points-per-attack (secret section), leave-at-one-star (attack section),
  reward-priority (rewards). Rendered from HTML in headless Chrome, 1600px. Swap for his screenshots if he takes them.
- Stray "(150 Points)" removed; noindex removed (Adrian, Oct 11): the article is indexed.
- Each infographic also exists as an HTML block right above its figure (`.ap-viz` + `.ap-bars` / `.ap-meter` /
  `.ap-steps`, articles.css "Chart blocks"), Adrian's pick. Titles plain white except the rewards one
  ("Resources last." stays red). The figures stay until he swaps in his own images.

### First Hardcore World (Minecraft): Oct 15, 2026

The site's first Minecraft article: `site/articles/minecraft/first-hardcore-world.html`
(noindex, `articles.json` "live" so it shows in the feed for review). Adrian's calls:

- Scope = the first phase of hardcore, not a day count. Card title changed to
  **"Your First Hardcore World: Surviving the Early Game"** (id unchanged). Java **and**
  Bedrock; every difference is written inline (shield: F + right-click on Java, crouch on Bedrock).
- Structure: six milestones (First Night → Food → Stone, Then Iron → Shield → Base → Full Iron),
  plus What Changes in Hardcore, Before You Press Create, Stop Dying Like This, FAQ, Summary.
- Real secret: **shield before armor** (Milestone 4). Iron budget chart (`.ap-steps`): shield 1 →
  bucket 3 → pickaxe 3 → chestplate 8 → leggings 7 → boots 4 → helmet 5 → sword 2 = 33 ingots.
- Links: seeds page, Nether coordinate calculator, and the 3,000-day world (HCPC) **as a link only**
  in "More for Minecraft". It is not used as a credential in the text.
- Mojang footer line ("NOT AN OFFICIAL MINECRAFT PRODUCT…"): offered, Adrian said **not now**.
- Minecraft article images live in `site/minecrafticons/articles/<id>/`. Item icons are the game's
  own 16px textures from the local 26.3 jar, drawn sharp by `.ap-pixel` (articles.css). Placeholder:
  `placeholder.webp` in the article folder. 6 photo slots with SHOT notes, awaiting Adrian's screenshots.
- Banner/thumb: "BLOCK / WHAT KILLS / FIRST." (Adrian's pick) + "Creepers. Arrows. One iron ingot."
  Template `_tools/thumbs/first-hardcore-world.html`; `render.py first-hardcore-world` writes banner
  (1920) + thumb (800). Shield taking two arrows and a creeper blast, all game sprites.
- Nav: `game-nav.json` "articles-minecraft" (Minecraft + Genshin Impact in the middle). No
  /articles/minecraft/ hub yet: the breadcrumb links `/articles/?game=minecraft`.
- To check with Adrian: H1 wording (starts with the game name); facts flagged in the handoff.

### 3x3 Piston Door (Minecraft): Oct 15, 2026

`site/articles/minecraft/3x3-piston-door.html` (noindex, "live" for review). Adrian's calls:

- **Zraft's design, credited by name only, no link, at the very bottom of the article**
  (`.ap-credit`, after "More for Minecraft"). Exception to "no credits to other creators" for
  builds that aren't ours. Java Edition only. **No real-secret section** (Adrian: "there's no secret").
- **3D build viewer** (`site/mc-build.js` + `mc-build.css`, three.js 0.160.0 from jsDelivr via an
  importmap in the page head). Reusable: `<div class="mcb" data-build="/mc-build-<id>.json"
  data-materials="<chips id>">`. Rotate/zoom (pan off), hover or tap = outline + label + facing arrow,
  "Facing arrows" (all at once), "Hide frame blocks" (building blocks become faint outlines),
  Layers slider (bottom-up), Closed/Open switch (only when the JSON has an open state),
  materials chips counted from the closed build. Labels say left/right as seen from the
  front = the north side (the side the droppers face).
- **Data:** Adrian saves the build with a Structure Block; `python _tools/mcbuild/build.py <id>
  <closed.nbt> [open.nbt]` writes `site/mc-build-<id>.json` and copies the .nbt files to
  `site/minecrafticons/builds/<id>/` (download button). 26.x files use `id`/`properties` in the
  palette (older: `Name`/`Properties`); the reader handles both. Textures: the game's own, from the
  local 26.3 jar, in `site/minecrafticons/builds/textures/`.
- Source files (Oct 15, re-saved with the lever inside, 9x9x1): `New World (2)` →
  `3x3-door-close.nbt` + `3x3-door-open.nbt`. The lever is ON when the door is closed and OFF
  when open. Both states are in the viewer; the banner art was re-rendered from the new model.
- Banner/thumb: "3X3 DOOR / ONE WALL / THICK." + "11 sticky pistons · 10 observers", art = the
  viewer's own render (`_tools/thumbs/assets/mc/door-render.png`). Headline not yet approved.
- 3 photo slots (repeaters close-up, door open, Structure Block Load screen) with SHOT notes.
