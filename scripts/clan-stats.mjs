// Fetches our clan's stats (#2GYPGPJP9) and writes them to clan-stats.json,
// which the clan card on th18-layouts.html reads.
//
// Run by the GitHub Action in .github/workflows/clan-stats.yml every 30
// minutes. GitHub Pages only serves files -- it can't run code when a
// visitor asks -- so instead the stats are fetched on a schedule and saved
// as a plain file.
//
// - The API key comes from the COC_API_KEY environment variable (a GitHub
//   secret: repo Settings -> Secrets and variables -> Actions). Never paste
//   a key into this file: the repo is public.
// - Supercell keys only work from IP addresses registered on the key, and
//   GitHub's machines have no fixed IP. So requests go through RoyaleAPI's
//   free proxy, which always calls from 45.79.218.79 -- the IP registered
//   on our key.
//
// Local test:  COC_API_KEY=... node scripts/clan-stats.mjs

import { writeFile, readFile } from 'node:fs/promises';

const API = 'https://cocproxy.royaleapi.dev/v1/clans/%232GYPGPJP9';   // "#2GYPGPJP9"
const OUT = new URL('../site/clan-stats.json', import.meta.url);

const key = process.env.COC_API_KEY;
if (!key) { console.error('COC_API_KEY is not set'); process.exit(1); }
const headers = { Authorization: 'Bearer ' + key, Accept: 'application/json' };

// Clan info + war log, asked for at the same time.
const [res, logRes] = await Promise.all([
  fetch(API, { headers }),
  fetch(API + '/warlog?limit=20', { headers })
]);
if (!res.ok) { console.error('Clash API answered ' + res.status); process.exit(1); }
const c = await res.json();
const log = logRes.ok ? await logRes.json() : null;

// Last 10 finished wars, newest first, as W / D / L. War-log entries with
// no result (CWL summaries) are skipped.
const CODE = { win: 'W', tie: 'D', lose: 'L' };
const recentWars = (log && Array.isArray(log.items) ? log.items : [])
  .map(w => CODE[w.result]).filter(Boolean).slice(0, 10);

// The streak is the game's own warWinStreak, so the card matches what
// players see in-game. (A self-computed "wins since the last loss, draws
// skipped" count was tried -- 36 vs the game's 33 in Sep 2026 -- and
// dropped so the two never disagree.)
const stats = {
  level: c.clanLevel,
  members: c.members,
  maxMembers: 50,
  warLogPublic: !!c.isWarLogPublic,
  warWins: c.warWins,
  warTies: c.warTies,
  warLosses: c.warLosses,
  warWinStreak: c.warWinStreak,
  recentWars
};

// Only rewrite the file when something actually changed, so the Action
// doesn't make a new commit (and a new Pages deploy) every 30 minutes.
// Compared as JSON so the recentWars list counts too.
let previous = null;
try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch {}
const same = previous && Object.keys(stats).every(k => JSON.stringify(previous[k]) === JSON.stringify(stats[k]));
if (same) {
  console.log('No change:', JSON.stringify(stats));
} else {
  await writeFile(OUT, JSON.stringify({ ...stats, updated: new Date().toISOString() }, null, 2) + '\n');
  console.log('Updated:', JSON.stringify(stats));
}
