# Clash Royale section: plan (Oct 25 2026, not started)

Read this before building anything under `/clash-royale/` or any `cr-` file.
Adrian plans to start the week of Nov 2 2026. Nothing below exists yet.
Items marked **OPEN** still need his answer; ask before building them.

---

## 1. The idea in one line

What the top 1,000 Path of Legends players run this week, with one tap to
copy a deck into the game. Not "more stats than RoyaleAPI": our sample is
far smaller, so we compete on clarity, freshness and phones, not on depth.

## 2. Why we compute our own deck stats

- The official API (developer.clashroyale.com) has players, clans, cards,
  rankings and each player's **battle log** (last ~25 battles, both decks,
  crowns). It has **no deck win-rate or meta endpoint**.
- RoyaleAPI, RoyaleTracker, DeckShop, StatsRoyale build their numbers the same
  way we will: crawl battle logs, count. None offers a public deck-stats API
  (RoyaleAPI's old public API was shut down). Never scrape their pages.
- So no made-up decks: every deck and number comes from real battles.

## 3. Pages (4 tabs)

Address: `/clash-royale/` (matches `/genshin-impact/`, `/call-of-duty-mobile/`).

| Tab | Address | Content | Data |
|---|---|---|---|
| Lobby | `/clash-royale/` | Hero with player-tag search (opens the player page, like Genshin's UID search); top 6 decks this week; most used cards + evolutions; top 10 players and their current deck; FAQ (`.qa`) + `<div data-feedback></div>` | `cr-decks.json`, `cr-cards.json`, `cr-top.json` |
| Decks | `/clash-royale/decks` | Every deck above the game floor (section 4). Sort by win rate / usage. Filter "has card" / "doesn't have card", kept in the address (`?with=hog-rider&without=…`). Each deck: 8 cards (evo slots marked), avg elixir, 4-card cycle, games, win rate, usage, **Copy to game** key | `cr-decks.json` |
| Cards | `/clash-royale/cards` | Grid of every card, filters rarity / elixir / type. A card opens a panel: usage, win rate, evo usage, best decks with it (links to `decks?with=`) | `cr-cards.json` + `cr-decks.json` |
| Players | `/clash-royale/players` | Path of Legends global top 100 + country picker (`.am-th` + `.am-pop`, like coc-stats.js `regionPicker`) + search | Worker, live |

**OPEN:** 4th tab. Recommended = Cards (reuses the crawl's data, costs almost
nothing). Alternative = drop Players and make a Tools tab (deck builder), but
one tool alone looks empty.

**Player page** `/clash-royale/player/<TAG>` (one page + a `_redirects` 200
rule, like `/genshin-impact/player/<UID>`): name, level, PoL rank, trophies,
`currentDeck` (+ copy key), card levels and evolutions, clan, last ~25 battles
with both decks and a copy key each. Only ~25 battles exist: there's no
ClashKing for Clash Royale, so no history tabs like the CoC tracker.

Later, not in this plan: clan page (River Race), articles strip
(`data-game="clash-royale"`, once an article exists).

## 4. Data

### 4a. Crawl: `scripts/cr-meta.mjs` + `.github/workflows/cr-meta.yml` (daily)

1. Path of Legends top 1,000 (global leaderboard, paged).
2. Each player's battle log (~1,000 calls/day; lobby-stats.mjs already does 610).
3. Keep **ranked 1v1 only** (Path of Legends / ranked type). Drop 2v2, events,
   friendlies, challenges: they skew win rates.
4. Count **both sides** of each battle (up to ~50k deck-games/day).
5. **Dedupe**: two crawled players fighting each other appear in both logs.
   Key = battle time + both tags sorted. Without this, those battles count twice.
6. Deck key = the 8 card ids, with evo/hero slot info kept (slot position
   matters for evolutions), sorted.
7. Write the day's totals (deck -> games, wins; card -> games, wins, evo games)
   to `data/cr/YYYY-MM-DD.json`, **outside `site/`** (private, kept in git so
   the next run can read it). Keep 7 days, delete older.
8. Sum the 7 days into `site/cr-decks.json`, `site/cr-cards.json`, plus
   `site/cr-top.json` (top players + current decks for the Lobby).
9. **Floor:** hide decks with fewer than ~50 games in the window. Otherwise a
   5-0 off-meta deck shows as "100% win rate".
10. Card list + art: the API's `/cards` (name, id, rarity, elixirCost,
    maxLevel, maxEvolutionLevel, iconUrls incl. evolution art). Self-host the
    art as WebP (site pattern), don't hotlink `api-assets.clashroyale.com`.
    Card type isn't in the API: derive from the id (26xxxxxx troop,
    27xxxxxx building, 28xxxxxx spell) and check it holds for every card.
11. Commit pattern = lobby-stats.yml (commit only if the files changed;
    every commit is a Netlify deploy, so once a day is the ceiling).

### 4b. Live lookups: the existing Cloudflare Worker

Add a `/api/cr` route to `cloudflare/coc-api/worker.js` rather than a second
Worker: one deploy, shared `allowedOrigin()`, shared 100k/day. Own `ROUTES`
table (player, battlelog, PoL leaderboard, location list), own base
`https://proxy.royaleapi.dev/v1/` (RoyaleAPI's Clash Royale proxy, same fixed
IP 45.79.218.79 as `cocproxy`), own secret `CR_API_KEY`. Same tag check
(`cleanTag`: same 14-letter alphabet in both games) and edge cache.

### 4c. Copy to game

The game's deck link (`clashroyale://copyDeck?deck=<8 ids;>` behind
`https://link.clashroyale.com/...`) opens the deck in Clash Royale on a phone.
Most useful single feature: put it on every deck everywhere.

## 5. Look + structure

- **Nav = Genshin's plumbing:** `<body data-game-nav="clash-royale">` + one
  `game-nav.json` entry with 4 `groups`. 11layout.js builds the top bar,
  hover menus, phone bottom nav and More sheet: **no nav code**. Do NOT copy
  CoC's own nav (coc-hub-menus.js); CoC hasn't migrated yet.
- **OPEN: dress.** Recommended = CoC's (Figtree titles, `.tb` banner, wells at
  rest / grey key when picked, th-layouts.css "TABS + CARD ACTIONS" recipe):
  same publisher, same art style. Alternative = Genshin's (Cinzel/Sora,
  `.gi-tb` gold frame). Red stays the accent either way; Clash Royale's
  blue/gold only in game art.
- Files: `site/cr.css` + `site/cr-core.js` on every page, then
  `cr-<page>.css/.js` per page (Genshin's split). `site/raised.css` linked
  last, like every 11layout page. Root-absolute paths only.
- Phones first: most visitors are on phones.

## 6. Build order (one page at a time, Adrian QCs each)

1. **Data.** Adrian makes the key (section 8). Then the Worker route + crawl
   job. Start it first: Decks needs a week of data before it means anything.
   Use the first real responses to settle section 7.
2. Decks page.
3. Lobby.
4. Players + player page.
5. Cards.

## 7. Check with the real key before building pages

- How hero cards and evolution slots appear in the battle log
  (`evolutionLevel`, slot order, any hero field). Decides the deck key.
- The exact Path of Legends leaderboard path (wrappers disagree:
  `/locations/global/pathoflegend/{season}/rankings/players` vs a
  location-based current-season route).
- Battle log length (25 or 30) and the ranked battle `type` string.
- That the copy-deck link still opens the game (incl. tower troop param).
- That the card-type-from-id rule holds for every card.

## 8. What Adrian has to do

1. developer.clashroyale.com -> new key, IP **45.79.218.79**.
2. Save it as the Worker secret `CR_API_KEY` (dashboard -> parchrome-coc ->
   Settings -> Variables and Secrets) and as a GitHub Actions secret
   `CR_API_KEY`.
3. Answer the two **OPEN** items (4th tab, dress).

## 9. Weak spots (said plainly)

- Smaller sample than RoyaleAPI. Rare decks won't clear the floor. Don't
  pretend to be the complete database.
- No card stats (HP, damage): not in the API, and we don't make numbers up.
- Player history = last ~25 battles, nothing older.
