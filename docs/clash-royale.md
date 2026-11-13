# Clash Royale

Moved out of CLAUDE.md on Nov 1 2026, unchanged. Paths like `parcore.com/docs/x.md` are relative to the outer folder.

## Clash Royale (`/clash-royale/`, planned, not started)

📖 **Read [`parcore.com/docs/clash-royale-plan.md`](parcore.com/docs/clash-royale-plan.md) before
building any Clash Royale page or `cr-` file.** Tabs (Adrian, Oct 30 2026): Lobby / Meta (Decks, Cards) /
Players (Leaderboard, Clan + River Race, player page) / Tools (Deck builder, Upgrade calculator, Decks for
you). Look (Adrian, Oct 30 2026): CoC look "far more different" = outlined titles, fan kit art, a guide. **Oct 31 2026
(Adrian): titles = Orbitron Title on every CR page (Nov 12 2026; Tourney italic before) (Lilita One is gone: never bring it back); guide = the
GOLDEN KNIGHT** (replaced the Red King; label "Golden Knight", `.cv-face.cr-knight`, faces in `images/clash-royale/knight/`:
`face` smirk = default, `face-laugh` joke, `face-mew` a line about his looks, `face-shock` crying = "Oh no!" line, `full` =
his whole render; all baked by cr-assets.py). Voice = his card text ("luxurious hair and outstanding flexibility.
Demonstrates his aerobics skills on demand") + battle lines ("Oh hi!", sings "Golden Knight!", laughs): cheerful, vain about
hair / jawline / armor, stretches, dashes, never mean. Details: cr.css "THE GOLDEN KNIGHT". Still OPEN: own Worker. **Decks** (`/clash-royale/decks`, Oct 30 2026,
unlisted until Adrian QCs) = the first page: `cr.css` + `cr-core.js` shared, `cr-decks.css/.js`; pictures baked by
`python scripts/cr-assets.py`.
**Decks v2 + Deck Builder (Oct 31 2026, Adrian to QC):** a deck = a real hand (8 cards 4 x 2, 2 decks a row on desktop, 1 on
phones), named by `CR.name` (win condition + avg elixir / partner: "2.6 Hog", "Giant Graveyard"; check every name with
`node _tools/cr-names-test.mjs`), win rate with its 95% margin ("Winning / Coin flip / Losing"), elixir curve, the CoC army
card bar (flame like = Firestore `layoutLikes/cr-decks` keyed by `CR.key`, grey Copy deck, share = our Deck Builder link),
a pen into `/clash-royale/deck-builder` (`?deck=<ids>&slots=<0/1 evo/2 hero>&tt=`, `CR.builderLink`), playstyle chips
(`?style=`), a tap on a card = "decks with it". (The meta map was cut in the Oct 31 cleanup, below.)
Builder (`cr-builder.js/.css`, links cr-decks.css): max 2 evo / 2 hero / 3 special (from the battle data), "In our data" =
this exact deck's numbers or the meta decks sharing most cards; phones get a docked deck strip (`.crb-dock`).
**Decks v3 (Oct 31 2026, Adrian: "overall design buff", to QC):** every card `<img>` gets `CR.src(id, form)` = src + its
rarity frame (cr.css "RARITY FRAMES": drop-shadow rim on the picture's shape; rare orange, epic purple, evo purple glow,
hero gold). New on Decks: "The meta right now" (cr-decks.js `snapshot()`: Most used cards | Evolutions + heroes, grey
bars on one subgrid), the finder console `.crd-find` (`.lb-search` over deck + card names `?q=`, Filter by card, Sort
`?sort=`, playstyle, Reset), the win condition's art behind each deck name, crowns on #1-3, verdict colour on the top
edge, and Ask the King (FAQ + feedback box; `.crq` + the `.qa-*` copy in cr.css). Styles: cr-decks.css "v3".
**Cleanup (Oct 31 2026, Adrian: "doing too much", wants it cleaner + more professional):** removed the Surest winner hero
(it repeated the list on a thin sample), the meta map, the Speed filter (`?elixir=`), each deck's elixir curve (Adrian
dislikes it on the card), the "Coin flip ±8.3" verdict label and the 35-65% win rate strip (`.crd-strip`; Adrian couldn't read it: the edge
colour carries the verdict, the 95% range is a hover title on the win rate; FAQ / How it's counted talk about the edge), and the sort tray under the banner (sort = a finder row now). The rest of the
deck card (Games / Wins / Usage, art, verdict edge) is his pick: keep it. On a wide deck (container
>= 540px) the like / Copy deck / share bar sits in the bottom-right corner beside the hand (`.crd-body` areas). Red stays for the main keys only. Don't add
the removed pieces back without asking.
**Lobby `/clash-royale/` = "the Throne Room"** (Oct 31 2026, Adrian picked it from 3 pitches; to QC): `cr-lobby.css/.js`
(+ cr-decks.css for the hands). Hero art = `images/clash-royale/lobby/throne.webp` (Adrian's skeleton-reaching-for-the-crown
still, 1000px, not in the fan kit): desktop = top-right at about its own size, fading left + down, copy and the **Steal the
crown** console along the bottom (a full-bleed cover blurred it and hid the crown under the title); phones = art on top cropped
to the hand + crown. Steal = a random deck of the 12 most played, dealt as a hand (red key), Copy / pen beside it. Then Crown
decks (top 6, phones 3), **The Royal Court** (cr-top.json top 10 over the Champions art `lobby/court.webp`: podium 2 | 1 | 3
wearing 3 / 2 / 1 crowns, rows 4-10; a player whose last 30 battles had no ranked game has `deck: null` and says so), **The
Card Wall** (every card, brighter = more played, 3 full rows then "Show all", `?wall=wr|elixir`), Every page (game-nav.json
tabs as columns + the Golden Knight's render), Ask the Golden Knight (FAQ + feedback box). No player search until a CR Worker
exists (Adrian: front end only). The home tile is still "soon". **Live since Oct 30 2026:** the crawl -- `scripts/cr-meta.mjs` + `.github/workflows/cr-meta.yml` (daily 23:00 UTC, secret
`CR_API_KEY`, no key = a warning, no change) -> `data/cr/<day>.json` (private, 7 kept) -> `site/cr-decks.json`,
`cr-cards.json`, `cr-top.json` (no page reads them yet). API answers (evo/hero codes, tower ids, River Race
shape, no events endpoint): the plan's section 7.

**Nov 2 2026 (Adrian):** Crown decks = the 6 best win rates among the **30 most played** decks (`CROWN_POOL` in cr-lobby.js;
Adrian picked this over "highest win rate overall", which lets a thin 50-game deck top it); the rank badge is the win-rate
place, hover = its most-played rank. The Royal Court shows each player's win rate over the ranked games in their last 30
battles (cr-meta.mjs writes `games` / `wins` into cr-top.json; `games: 0` or missing = hidden). Decks page: "The meta right
now" removed (HTML, `snapshot()`, `.crs-*` CSS); don't bring it back. Every CR title (`.ct-title`, `.cb-title`, the hero) is
uppercase (cr.css TITLES). Lobby hero copy is vertically centred on desktop. **Nav icons** = the game's own menu icons from
the fan kit (`NAV` in cr-assets.py -> `images/clash-royale/nav/*.webp`, 96px; lobby = King tower, meta = battle swords, decks =
cards tab, cards = Book of Cards, players = friends, leaderboard = Path of Legends, river race = clan wars, tools = Builder's
Workshop, deck builder = golden elixir, upgrade = wild card, for you = star level); game-nav.json `img` (tabs) / `icon`
(pages). **Deck Builder perf:** the card pool is drawn once and filters / taps only flip `hidden` / `aria-pressed` (never
rebuild it with innerHTML); common cards skip the 5-drop-shadow rarity chain; `.coc-main`'s background layers are all
`local` (a `scroll` layer made Chrome repaint the whole page on every scroll frame). Don't run prettier over the cr- files:
they aren't prettier-formatted and it rewrites hundreds of lines.
