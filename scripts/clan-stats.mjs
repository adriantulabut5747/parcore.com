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
const OUT = new URL('../clan-stats.json', import.meta.url);

const key = process.env.COC_API_KEY;
if (!key) { console.error('COC_API_KEY is not set'); process.exit(1); }
const headers = { Authorization: 'Bearer ' + key, Accept: 'application/json' };

// Our win streak, the way the clan counts it: wins since the last LOSS.
// Draws don't break it (they're skipped, not counted), and neither do
// war-log entries without a result (CWL summaries). Newest war first.
// The game's own warWinStreak is only the fallback if the log can't be read.
function streakSkippingDraws(log) {
  if (!log || !Array.isArray(log.items)) return null;
  let streak = 0;
  for (const war of log.items) {
    if (war.result === 'lose') return streak;
    if (war.result === 'win') streak++;
  }
  return streak;          // no loss anywhere in the log: every win it holds
}

const [clanRes, logRes] = await Promise.all([
  fetch(API, { headers }),
  fetch(API + '/warlog?limit=100', { headers })
]);
if (!clanRes.ok) { console.error('Clash API answered ' + clanRes.status); process.exit(1); }
const c = await clanRes.json();
const log = logRes.ok ? await logRes.json() : null;

const stats = {
  level: c.clanLevel,
  members: c.members,
  maxMembers: 50,
  warLogPublic: !!c.isWarLogPublic,
  warWins: c.warWins,
  warWinStreak: streakSkippingDraws(log) ?? c.warWinStreak
};

// Only rewrite the file when a number actually changed, so the Action
// doesn't make a new commit (and a new Pages deploy) every 30 minutes.
let previous = null;
try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch {}
const same = previous && Object.keys(stats).every(k => previous[k] === stats[k]);
if (same) {
  console.log('No change:', JSON.stringify(stats));
} else {
  await writeFile(OUT, JSON.stringify({ ...stats, updated: new Date().toISOString() }, null, 2) + '\n');
  console.log('Updated:', JSON.stringify(stats));
}
