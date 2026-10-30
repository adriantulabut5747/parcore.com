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

## 3. Pages (4 tabs, Adrian's picks Oct 30 2026)

Address: `/clash-royale/` (matches `/genshin-impact/`, `/call-of-duty-mobile/`).
One `game-nav.json` entry with 4 `groups`:

| Tab | Page | Address | Content | Data |
|---|---|---|---|---|
| **Lobby** | Lobby | `/clash-royale/` | Hero with player-tag search (opens the player page, like Genshin's UID search); top 6 decks this week; most used cards + evolutions; top 10 players and their current deck; FAQ (`.qa`) + `<div data-feedback></div>` | `cr-decks.json`, `cr-cards.json`, `cr-top.json` |
| **Meta** | Decks | `/clash-royale/decks` | Every deck above the game floor (section 4). Sort by win rate / usage. Filter "has card" / "doesn't have card", kept in the address (`?with=hog-rider&without=…`). Each deck: 8 cards (evo slots marked), avg elixir, 4-card cycle, games, win rate, usage, **Copy to game** key | `cr-decks.json` |
| | Cards | `/clash-royale/cards` | Grid of every card, filters rarity / elixir / type. A card opens a panel: usage, win rate, evo usage, best decks with it (links to `decks?with=`) | `cr-cards.json` + `cr-decks.json` |
| | ~~Events~~ | — | **Dropped Oct 30 2026: the API has no events** (`/challenges` 404) | — |
| **Players** | Leaderboard | `/clash-royale/players` | Path of Legends global top 100 + country picker (`.am-th` + `.am-pop`, like coc-stats.js `regionPicker`) + player / clan tag search | Worker, live |
| | Clan + River Race | `/clash-royale/clan/<TAG>` | Clan card + members; **River Race**: each member's decks used today (out of 4) and fame, who hasn't played yet on top; the race log | Worker: `clans/{tag}`, `currentriverrace`, `riverracelog` |
| **Tools** | Tools hub | `/clash-royale/tools` | Group page (CODM's Tools layout: banner + one card per tool) | game-nav.json |
| | Deck builder | `/clash-royale/deck-builder` | Pick 8 cards (evo / hero slots), tower troop; avg elixir, 4-card cycle; "in our data" = this exact deck's games + win rate, else the closest meta decks; **Copy to game**; share = `?deck=<8 ids>&slots=…&tt=…`; "Load my deck" from a tag (`currentDeck`); saved decks in localStorage | `/cards` (via `cr-cards.json`), `cr-decks.json` |
| | Upgrade calculator | `/clash-royale/upgrade-calculator` | Tag in -> gold + cards still needed to max one deck / every card / reach the next King Level; per card: level, cards owned / needed | Player API + the upgrade cost tables (wiki; check against the game before use) |
| | Decks for you | `/clash-royale/decks-for-you` | Tag in -> this week's meta decks sorted by how close your levels are (avg level gap, missing cards / evos marked) | `cr-decks.json` + player API |

**Player page** `/clash-royale/player/<TAG>` (no menu row; one page + a `_redirects`
200 rule, like `/genshin-impact/player/<UID>`): name, level, PoL rank, trophies,
`currentDeck` (+ copy key), clan (links to the clan page), last ~25 battles with
both decks and a copy key each. **Extras:** collection progress (% of cards maxed,
per rarity), evolutions unlocked, badges + masteries, current deck vs the meta
(this deck's win rate in our data, or the closest meta deck). Links into the
Upgrade calculator and Decks for you with the tag filled in. Only ~25 battles
exist: there's no ClashKing for Clash Royale, so no history tabs like the CoC tracker.

Not picked (Oct 30 2026): war deck builder (4 decks, no shared card). Later:
articles strip (`data-game="clash-royale"`, once an article exists).

## 4. Data

### 4a. Crawl: `scripts/cr-meta.mjs` + `.github/workflows/cr-meta.yml` (daily)

**Built Oct 30 2026.** First run: 1,000 logs, 5,830 new ranked battles in 24 h, 787 decks
seen, 56 over the floor. As built: a run counts only battles newer than the previous
day file's `to` (a battle stays in the 30-battle log for days, so per-run windows are
what stop cross-day double counts); draws are dropped; a deck's tower = its most-used
`supportCards[0]`. Outputs: `cr-decks.json` (`cards: [[id] | [id, 1 evo / 2 hero]]`,
tower, games, wins, winRate, usage %), `cr-cards.json` (every card + tower troop:
name, rarity, elixir, type, evo 0-3, icon file name, games, winRate, usage, evoGames,
heroGames), `cr-top.json` (top 10 + their latest ranked deck).

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

**OPEN: Worker.** Recommended now = its own Worker `cloudflare/cr-api/` (like
`parchrome-valorant`): a bad deploy can't break the CoC tracker. The 100k/day is per
account either way, so a second Worker gains no quota.

### 4c. Copy to game

No official docs; the format below comes from open-source deck tools
(github.com/YunhaoFu/cr-copy-deck, github.com/n-zad/cr-deck-organizer), Oct 30 2026:

```
https://link.clashroyale.com/en/?clashroyale://copyDeck?deck=<8 ids>&slots=<8 flags>&tt=<tower>&l=<label>
```

- `deck` = the 8 card ids (`26000000`-style), joined with `;`.
- `slots` = 8 values joined with `;`, one per `deck` position: `1` = play it as
  its evolution, `0` = normal. Hero (champion / hero form) has no known code: write `0`.
- `tt` = tower troop id (`159000000` = Tower Princess; the others' ids come from the
  API's `/cards` `supportItems` once we have a key).
- `l` = deck name (optional; tools send `Royals`).
- Phone: the link opens the game's "copy deck" screen. Desktop: link.clashroyale.com
  shows a landing page, so desktop copies the link to the clipboard (a QR code is a later
  option if Adrian wants it).
- **One tool's author says only the 8 cards import** (evo slots + tower troop don't come
  through). Adrian tests on his phone before any page promises more: plain deck, deck
  with an evo, deck with a non-default tower troop.

Most useful single feature: put it on every deck everywhere (Decks, Lobby,
player battles, Deck builder, Decks for you).

## 5. Look + structure (decided Oct 30 2026, Adrian: "CoC look but far more different")

- **Nav = the groups engine:** `<body data-game-nav="clash-royale">` + `game-nav.json` `clash-royale`
  (Lobby / Meta / Players / Tools, SVG icons; a page's row gets its `link` and loses `soon` when it ships).
  11layout.js builds the top bar, menus, phone bar and More sheet: **no nav code**.
- **Shell = CODM / Valorant's:** a page links codm-banner.css + codm-tools.css (`.cb` banner, `.cb-tabs`
  tray, `.ct-sec` sections, `--codm-side` inset), coc-villager.css (the guide bubble), then `site/cr.css`
  (base, ground, titles, banner art, `.cr-key`) + `site/cr-core.js` (`window.CR`: card data + pictures, deck
  order, avg elixir, 4-card cycle, copy link), then the page's `cr-<page>.css/.js`. Copy
  `site/clash-royale/decks.html` for a new page.
- **What makes it Clash Royale:** titles in **Lilita One** (free; the game's own font is licensed) white with
  the in-game dark outline; the banner art = fan kit key art filling the whole card (`banner-battle.webp`);
  the King in the banner's well; the cards' own art everywhere (evo = purple crest, hero = gold, cost on a pink
  elixir drop = game art). The CoC recipe stays: raised boxes, sunken wells, grey key when picked, ONE red key
  (Copy deck). Red is the accent; Clash Royale's blue/gold only inside game art.
- **Art:** Supercell's fan kit (fankit.supercell.com, Frontify; its search API is public:
  `/api/assets/search/345?q=<words>`), allowed for fan sites by Supercell's fan content policy. Baked by
  `python scripts/cr-assets.py` (cards from the API's icons, King faces + banners from the kit, file names pinned
  in the script). Other good banners for later pages (kit titles): `Forbidden City` (dark red sunset),
  `group_6` (used), `Birthday 4`, `MergeTactics_KeyART`; 36 King renders `King_01`..`King_47`.
- **Guide = the Red King** (label "King", `.cv-face.cr-king`). Faces: `king/face` (grin, default),
  `face-laugh` (a line ending in a joke), `face-shock` ("Whoa" lines). Voice (Fandom wiki blocks scripts, so
  this is from his in-game sounds + the fan kit's King emote names: Laughing, Crying, Angry, Thumbs up/down,
  Begging, Sweating, Hide, Absolute Cinema, Emperor, No. 1, Belt): a smug, theatrical showman who loves
  crowns, cackles "He he he he" at you, sulks when a tower falls. He's the player's own King, so he wants
  crowns brought to him. Lines follow the `.cv-say` rules (coc-villager.css). Adrian is the judge of the voice.
- Phones first: most visitors are on phones.

## 6. Build order (one page at a time, Adrian QCs each)

1. **Data.** Adrian makes the key (section 8). Then the Worker + crawl job.
   Start it first: Decks needs a week of data before it means anything. Use the
   first real responses to settle section 7.
2. Deck builder (needs only `/cards`; can ship while the crawl fills up).
3. Player page + extras, Leaderboard.
4. Upgrade calculator (reuses the player call).
5. Clan page + River Race.
6. Decks. **Built Oct 30 2026** (`/clash-royale/decks`, unlisted until Adrian QCs: no sidebar / search entry).
7. Lobby.
8. Decks for you (needs Decks + the player call).
9. Cards.

## 7. Checked with the real key (Oct 30 2026, through proxy.royaleapi.dev)

- **Leaderboard:** `locations/global/pathoflegend/players?limit=1000` = the current
  season's global top 1,000 in ONE call (tag, name, expLevel, `eloRating`, rank, clan).
  Country boards: `locations/{id}/pathoflegend/players`. Past seasons: `locations/global/seasons`.
- **Battle log:** 30 battles. Ranked 1v1 = `type: "pathOfLegend"` (gameMode
  `Ranked1v1_NewArena`); events show as `trail`, etc. The #1 player had 6 ranked of 30,
  so expect fewer ranked games per player than 30.
- **Deck in a battle:** `cards` in slot order; a card's `evolutionLevel` = how it was
  PLAYED: 1 = evolution, 2 = hero form, absent = normal (cards without it in a slot
  are plain). Deck key = the 8 ids each with that number. `supportCards[0]` = tower troop.
  Also `elixirLeaked`, `globalRank`, crowns, `startingTrophies` (= elo in ranked).
- **Cards:** `/cards` = 123 `items` + 4 `supportItems` (tower troops: 159000000 Tower
  Princess, 159000001 Cannoneer, 159000002 Dagger Duchess, 159000004 Royal Chef).
  `maxEvolutionLevel`: 1 = has an evolution, 2 = has a hero form, 3 = both; the icons
  follow (`evolutionMedium`, `heroMedium`). Type from id holds for all 123 (26 troop = 87,
  27 building = 13, 28 spell = 23). Mirror has no `elixirCost`.
- **Card levels:** `level` is per rarity (`maxLevel` 16 common, 14 rare, 11 epic, 8
  legendary, 6 champion): shown level = `level + 16 - maxLevel`. Player `cards` add
  `count` (cards owned) + `evolutionLevel` (unlocked, NOT the slot: `currentDeck` marks
  unlocked evos on cards outside the evo slots). No upgrade costs anywhere in the API:
  the Upgrade calculator needs the wiki's tables.
- **Player:** also badges (152, with level/progress), 12 achievements, `supportCards`,
  `currentDeckSupportCards`, PoL current / last / best (league, trophies, rank),
  `collectionLevel`, `kingTowerLevel`, `upcomingchests` still answers (not planned).
- **River Race:** `currentriverrace` -> `periodType` (`training`/`warDay`/`colosseum`),
  5 clans, each `participants` = tag, name, fame, `decksUsed`, `decksUsedToday`, boat
  attacks. Participants include people who LEFT (126 rows): filter by `clans/{tag}`
  `memberList`. `riverracelog` = past races, standings with every clan's participants.
- **Events: no.** `/challenges` = 404, `globaltournaments` = empty. Events page dropped
  unless a source appears.
- Still to test by hand: the copy link (4c); hero `slots` code is probably `2` (matches
  `evolutionLevel`), try `slots=1;2;1;0;0;0;0;0`.

## 8. What Adrian has to do

1. developer.clashroyale.com -> new key, IP **45.79.218.79**.
2. Save it as the Worker secret `CR_API_KEY` (dashboard -> parchrome-coc ->
   Settings -> Variables and Secrets) and as a GitHub Actions secret
   `CR_API_KEY`.
3. Answer the last **OPEN** item: own Worker or not (tabs, look and guide settled Oct 30 2026).

## 9. Weak spots (said plainly)

- Smaller sample than RoyaleAPI. Rare decks won't clear the floor. Don't
  pretend to be the complete database.
- No card stats (HP, damage): not in the API, and we don't make numbers up.
- Player history = last ~25 battles, nothing older.
