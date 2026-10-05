# Player Tracker — plan

Planned 2026-10-05. Inspiration: warreport.app (main), clashofstats.com, claneasy.com.
Nothing built yet. This file is private (docs/ is not published).

## What the Clash API can and can't do

- It returns **current state only**: a player's profile now, a clan's members now, the war now.
  There is no history endpoint. All history on warreport/clashofstats comes from them polling
  on a timer and saving what they saw.
- War attacks (who hit whom, stars, %) exist only while the war is live. After it ends the war
  log keeps just the final score. To keep attacks, they must be saved before the war ends.
- **Players can only be found by tag**, never by name. Clans can be searched by name.
  ClashOfStats' name search comes from its own crawled database; we are not copying that.

## Decisions (Adrian's picks)

| Topic | Pick |
|---|---|
| History | Opt-in: "Track this clan" starts recording from that moment |
| Who can track | Anyone, global cap (~100 clans); a clan nobody views for 30 days stops being tracked |
| Storage | Firestore, in a **new Firebase project** used only by the tracker |
| Phase 1 | Player profile, Clan page, War report (live data, no database) |
| Later | Leaderboards, Compare players, Rushed/max checker, links to our TH layouts/armies |
| Hosting | Netlify + GitHub Pages (Pages calls the Netlify function cross-origin) |
| URLs | `/coc/player/TAG`, `/coc/clan/TAG` (clean, shareable) |
| Look | Current CoC shell (TH18 hero/top bar/cards), denser data layouts inside it |

## Architecture

1. **`netlify/functions/coc-api.js`** — one proxy for every lookup. Same pattern as `coc.js`:
   key from `COC_API_KEY`, calls go through `cocproxy.royaleapi.dev` (fixed IP 45.79.218.79).
   - Allow-list of endpoints only (players, clans, clan search, currentwar, warlog,
     leaguegroup, CWL war, capital raids, rankings). Never forward an arbitrary path.
   - Validate tags: `#` + `[0289PYLQGRJCUV]` only.
   - CDN cache per endpoint: player/clan ~5 min, live war ~1–2 min, rankings ~1 h.
   - CORS header allowing the GitHub Pages origin.
   - Trim responses to the fields the pages use.
2. **Clean URLs** — `_redirects` rewrites (status 200, not 301):
   `/coc/player/*` → one player shell page, `/coc/clan/*` → one clan shell page.
   The page reads the tag from the address. No file per player.
3. **Tracking** — GitHub Actions cron every ~15 min (host-independent; see Vercel note),
   polling tracked clans in batches.
   - Live war: save attacks as they appear, so the full war is kept when it ends.
   - Members: diff against last poll → join/leave events.
   - Daily: one trophies/donations snapshot per member.
   - **Write only what changed** — Firestore free tier is 20k writes/day.
4. **Firestore (new project)** — writes only via the server function (service-account key in a
   Netlify env var); rules: public read, no client writes.
   Sketch: `trackedClans/{tag}`, `clans/{tag}/wars/{endTime}`, `clans/{tag}/events/{id}`,
   `players/{tag}/days/{date}`.

## Pages

- **`/coc/tools/player-tracker`** (hub): one search box (tag → player or clan; text → clan name
  search), recently viewed (localStorage), tracked clans, our clan.
- **Player `/coc/player/TAG`**: header (name, TH, XP, league, trophies, clan, labels); tabs:
  Heroes & equipment, Troops/spells/pets/sieges (home + builder), Achievements;
  later: History (if their clan is tracked), Rushed %, suggested layouts/armies for their TH.
- **Clan `/coc/clan/TAG`**: header (badge, level, location, war league, capital); tabs:
  Members (sortable: role, TH, trophies, donations, ratio), War (current war + CWL),
  War log, Capital raids; later: History (joins/leaves, war attacks, donation seasons).
  "Track this clan" button.
- **War report** (clan War tab): both rosters, each attack, stars/%, who hasn't attacked,
  time left; CWL group + rounds + stars per member.

## States to design

Invalid tag · not found · Clash API maintenance (it answers 503) · war log private ·
clan not in war · CWL off-season · player in no clan · tracking cap reached · history empty
because tracking just started ("recording since <date>").

## Build order

0. `coc-api` function + CORS + rewrites (done Oct 5; Firebase project still to make).
1. Hub + player profile (live) -- done Oct 5.
2. Clan page + clan name search (live) -- done Oct 5: /coc/clan/<TAG>, members table
   (sortable), war log (or "private"), Player / Clan switch on the hub.
3. War report: current war + CWL (live).
4. Tracking: Track button, poller, History tabs.
5. Leaderboards, Compare, Rushed % checker, layout/army suggestions.

## Open issues

- **Rushed %** needs a max-level table per TH for every troop/hero/equipment, and it must be
  updated every balance patch. Source: the Clash of Clans wiki (Adrian's pick), copied into a
  JSON per TH by hand.
- **Moving to Vercel (planned).** Write the function in the Web-standard Request→Response
  style so it runs on both hosts with a thin wrapper. Run the history poller on GitHub Actions
  (like clan-stats.yml), not as a host cron: Vercel's free Hobby plan only allows daily crons.
  `_redirects` must become `vercel.json` rules on the move.
- **GitHub Pages has no rewrites**, so `/coc/player/TAG` won't resolve there.
  Option: `scripts/build-pages.py` points the Pages copy at `?tag=` links, or a 404.html fallback.
- **SEO**: pages render in the browser; Google sees a generic title until JS runs.
  Fix later with a Netlify edge function that sets the title/meta per tag, if it matters.
- **Supercell Fan Content Policy**: pages need the "unofficial, not endorsed by Supercell"
  notice (check the footer already carries it).
- Netlify free tier: 125k function calls/month. CDN caching keeps repeat lookups free; watch usage.
