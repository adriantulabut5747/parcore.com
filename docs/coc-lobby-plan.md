# CoC Lobby plan (Oct 2026)

Goal: make `/coc/` feel like a community lobby people come back to, using
live Clash data instead of user posts. Nothing here is built yet.

## Decisions (Adrian, 2026-10-07)

| Topic | Pick |
|---|---|
| Visitor posts / chat / recruitment | **No.** Interaction is tap-only. |
| Leaderboard country | **Switcher, Philippines default.** |
| Placement | **Teaser on `/coc/`** (top 5 + 2-3 headline stats) linking to a full **`/coc/stats/`** page. |
| Meta / most used armies | **Dropped.** The API has no army data. |
| Trends over time | **Snapshot only.** No history storage. |
| Lobby decoration | Wanted. Style still to be decided (see Open questions). |

## What the API can and can't do

Official Clash API (through the RoyaleAPI proxy, same as `scripts/clan-stats.mjs`).

- **Country rankings: yes.** `/locations` lists countries. `/locations/{id}/rankings/`
  has `players`, `clans`, `players-builder-base`, `clans-builder-base` and
  `capitals`, top 200 each. Check first: look up the Philippines' location ID
  with a live call (don't guess it), and check what `rankings/players` returns
  after Supercell's 2025 ranked-league rework.
- **Equipment use: built by us.** No endpoint gives it. Fetch each PH top-200
  player (`/players/{tag}`) and count `heroes[].equipment` (what each hero has
  on). On the page, label it **"Equipped by PH's top 200 right now"**, never
  "most used in attacks".
- **Army / attack meta: no.** War data only has stars, % and duration.
- **Total player count: no.** Supercell doesn't publish one, and third-party
  numbers are estimates. Don't show one.
- **Gold Pass season dates: yes.** `/goldpass/seasons/current`.

### Live check results (2026-10-07)

- Philippines = location **`32000185`**. 255 locations with `isCountry: true`.
- All five PH rankings return HTTP 200 with 200 rows. Raw sizes: players ~215 KB,
  the others ~105 KB each. Trim to the shown fields before saving.
- **Ranked rework:** a ranking row's old `league` field now always reads
  **"Unranked"**. Use **`leagueTier`** instead (e.g. "Legend I", with
  `iconUrls.small/large`). The PH top 200 ran 5000–5371 trophies, all Legend I.
  `previousRank` is there, so rank arrows (▲33) work without history.
- Gold Pass: `{"startTime":"20261001T080000.000Z","endTime":"20261101T080000.000Z"}`.
- Player profile (~23 KB each, so ~4.6 MB per daily run for 200): `heroes[].equipment`
  holds the 2 equipped items with levels, so equipment counting works. Also there:
  `townHallLevel`, hero levels, `warStars`, `donations`, `clanCapitalContributions`,
  `labels`. Top 5 sample: Spiky Ball on 5/5 Kings, Action Figure on 5/5 Queens,
  Meteor Staff + Dark Orb on 5/5 Minion Princes.
- `troops` / `spells` hold **levels only, not use**. They can't stand in for a meta.

## Architecture

Two data paths:

1. **Daily job → `site/coc-lobby-stats.json` (PH only).** It's a new
   `scripts/lobby-stats.mjs` plus `.github/workflows/lobby-stats.yml`, copied
   from the clan-stats pair.
   It runs once a day, not every 15/30 min: rankings move slowly, and every
   commit triggers a Netlify deploy, which costs credits. It holds:
   - PH top players / clans / builder base / capital (trimmed to the fields shown)
   - equipment counts per hero (from ~200 player fetches; add a short delay
     between calls, since the proxy is shared)
   - dashboard numbers: Town Hall spread, average hero levels, war league spread
     of the top clans, Gold Pass dates
   - `updatedAt`, shown on the page as "Updated X hours ago"
2. **Live switcher → `netlify/functions/coc-api.mjs`.** Add a `rankings` type
   (`?type=rankings&loc=<id>&kind=players|clans|…`, cached ~6h on Netlify's CDN)
   and a `locations` type (cached a day). PH loads from the JSON file. Other
   countries are fetched live when someone picks them.
   - Only the **leaderboard** switches. Equipment and dashboard stay PH and
     must be labelled "Philippines" so a switched view doesn't mislead.
   - GitHub Pages can't run functions, but `coc-api.mjs` already allows
     calls from the Pages domain (CORS), so the switcher works there too
     as long as the Netlify site is live.

## Pages

- **`/coc/` teaser** (between Clash tools and the tracker promo, TBD): PH top 5
  players, 2-3 headline stats, "View stats ›" link to `/coc/stats/`.
- **`/coc/stats/`**: country switcher + leaderboard tabs (Players / Clans /
  Builder / Capital), then the PH equipment and dashboard sections. Rows link to
  `/coc/player/TAG` and `/coc/clan/TAG` (tracker pages already exist).
  Add to `coc-nav-data.json` (Tools menu) and the CoC bottom nav / More sheet.

## Build order

1. ~~Live check: PH location ID, what the rankings return, payload sizes.~~ Done 2026-10-07.
2. ~~`lobby-stats.mjs` + workflow~~ Built 2026-10-07, run locally (≈45 s, 200/200
   profiles). Output: 185 KB, 62 KB gzipped. Shape: `updated`, `location`,
   `goldPass {start,end}`, `sample`, `townHalls {th: count}`,
   `heroes [{name, owners, avgLevel, maxLevel, equipment [{name, count}]}]`,
   `rankings {players, builderPlayers, clans, builderClans, capitals}`
   (rows: `rank, prev, tag, name, score` + `exp, tier, tierIcon, clan, clanTag, badge`
   for players / `level, members, badge` for clans; `badge`/`tierIcon` = last part
   of the asset URL, e.g. `https://api-assets.clashofclans.com/badges/70/<badge>.png`).
   Notes: the PH top 200 are all TH18, so the Town Hall spread is one bar and
   not worth showing. War league isn't in ranking rows (it would cost 200 clan
   calls), so it's dropped. Rankings shift by the minute, so every run commits.
   Still to do: Adrian runs the workflow once from the Actions tab.
3. `/coc/stats/` page (trial it before touching the lobby).
4. Switcher (function routes).
5. `/coc/` teaser + decoration pass.

## Open questions

- Decoration style: clan-hall notice board around the leaderboard? banners?
  ambient village art? Decide with mockups at step 5.
- Teaser position on `/coc/`.
- Which dashboard stats make the cut (pick after seeing real numbers at step 1).
