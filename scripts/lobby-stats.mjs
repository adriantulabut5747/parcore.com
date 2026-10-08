// Builds site/coc-lobby-stats.json: the Philippines leaderboards and the
// equipment counts of the world's top 200 for /coc/stats/ and the lobby teaser on /coc/.
// Plan: docs/coc-lobby-plan.md.
//
// Run once a day by .github/workflows/lobby-stats.yml. Same setup as
// clan-stats.mjs: the key is the COC_API_KEY secret, and calls go through
// RoyaleAPI's proxy (45.79.218.79 is the IP registered on the key).
//
// Local test:  COC_API_KEY=... node scripts/lobby-stats.mjs
//   (or save the key alone in ~/coc-key.txt -- never inside the repo)

import { writeFile, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const API = 'https://cocproxy.royaleapi.dev/v1';
const PH = { id: 32000185, name: 'Philippines' };
const OUT = new URL('../site/coc-lobby-stats.json', import.meta.url);
// The CoC home only shows the global top 10 + each hero's top 3 equipment,
// so it gets its own ~3 KB file instead of loading the full one.
const OUT_HOME = new URL('../site/coc-lobby-home.json', import.meta.url);

let key = process.env.COC_API_KEY;
if (!key) try { key = readFileSync(homedir() + '/coc-key.txt', 'utf8').trim(); } catch {}
if (!key) { console.error('COC_API_KEY is not set'); process.exit(1); }
const headers = { Authorization: 'Bearer ' + key, Accept: 'application/json' };

async function get(path) {
  const res = await fetch(API + path, { headers });
  if (!res.ok) throw new Error(path + ' -> HTTP ' + res.status);
  return res.json();
}

// Badge and league links all start the same way; only the last part differs.
// Saving just that part keeps the file ~half the size. The page puts the
// start back: https://api-assets.clashofclans.com/badges/70/<badge>.png
const tail = (url) => (url || '').split('/').pop().replace(/\.png$/, '');

const base = `/locations/${PH.id}/rankings/`;
const [players, clans, builderPlayers, builderClans, capitals, goldPass, globalPlayers] = await Promise.all([
  get(base + 'players?limit=200'),
  get(base + 'clans?limit=200'),
  get(base + 'players-builder-base?limit=200'),
  get(base + 'clans-builder-base?limit=200'),
  get(base + 'capitals?limit=200'),
  get('/goldpass/seasons/current'),
  get('/locations/global/rankings/players?limit=200')
]);

// "20261001T080000.000Z" -> "2026-10-01T08:00:00.000Z" (what Date() reads)
const iso = (s) => s.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)/, '$1-$2-$3T$4:$5:$6');

// Player profiles, 5 at a time so the shared proxy isn't flooded. A failed
// profile is skipped, not fatal. Returns a Map tag -> profile.
async function profilesOf(items) {
  const out = new Map();
  for (let i = 0; i < items.length; i += 5) {
    const batch = await Promise.allSettled(items.slice(i, i + 5).map((r) => get('/players/' + encodeURIComponent(r.tag))));
    for (const b of batch) b.status === 'fulfilled' ? out.set(b.value.tag, b.value) : console.warn(b.reason.message);
  }
  if (out.size < items.length / 2) { console.error('Only ' + out.size + ' profiles loaded'); process.exit(1); }
  return out;
}
// The equipment stats use the world's top 200 (Adrian's pick, Oct 2026: a
// stronger signal than one country). Both PH player lists need profiles for
// the clan badge -- the clan badge inside a *ranking* row points at an image
// Supercell no longer has (checked Oct 2026: 0 of 70 matched the clan's
// real badge), while the profile's is right.
const homeProfiles = await profilesOf(players.items);
const builderProfiles = await profilesOf(builderPlayers.items);
const globalProfiles = await profilesOf(globalPlayers.items);

// Arrows on the page = change since the previous daily file. Supercell's own
// previousRank isn't "yesterday" (the #1 player showed +33, most rows +500),
// so it isn't used. Same-day re-runs (Run workflow by hand) keep the
// earlier baseline instead of resetting every arrow to "no change".
let previous = null;
try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch {}
const keepBaseline = previous?.prevFrom && Date.now() - new Date(previous.updated) < 20 * 36e5;
const prevFrom = previous ? (keepBaseline ? previous.prevFrom : previous.updated) : null;
function prevRank(list, tag) {
  const oldList = previous?.rankings?.[list];
  if (!oldList) return null; // no baseline for this list yet: page shows "–"
  const old = oldList.find((r) => r.tag === tag);
  if (!old) return -1; // new in the top 200
  return keepBaseline ? old.prev : old.rank;
}

// Every list gets the same row shape so the page has one row builder.
// score = trophies (players) or clan points (clans).
const row = (list, r, score) => ({ rank: r.rank, prev: prevRank(list, r.tag), tag: r.tag, name: r.name, score });
const playerRow = (list, r, score, profile) => {
  const clan = profile?.clan || r.clan;
  return {
    ...row(list, r, score),
    exp: r.expLevel,
    ...(r.leagueTier && { tier: r.leagueTier.name, tierIcon: tail(r.leagueTier.iconUrls?.small) }),
    ...(clan && { clan: clan.name, clanTag: clan.tag, ...(profile?.clan && { badge: tail(clan.badgeUrls?.small) }) })
  };
};
const clanRow = (list, r, score) => ({ ...row(list, r, score), level: r.clanLevel, members: r.members, badge: tail(r.badgeUrls?.small) });

// Per home-village hero: how many own it, average level, and how many have
// each equipment on it right now. Builder Base heroes have no equipment.
const heroMap = new Map();
for (const p of globalProfiles.values()) {
  for (const h of p.heroes || []) {
    if (h.village !== 'home') continue;
    const s = heroMap.get(h.name) || { name: h.name, owners: 0, levelSum: 0, maxLevel: h.maxLevel, equipment: {} };
    s.owners++;
    s.levelSum += h.level;
    s.maxLevel = Math.max(s.maxLevel, h.maxLevel);
    for (const e of h.equipment || []) s.equipment[e.name] = (s.equipment[e.name] || 0) + 1;
    heroMap.set(h.name, s);
  }
}
const heroes = [...heroMap.values()].map((s) => ({
  name: s.name,
  owners: s.owners,
  avgLevel: Math.round((s.levelSum / s.owners) * 10) / 10,
  maxLevel: s.maxLevel,
  // most-equipped first; count out of `owners`
  equipment: Object.entries(s.equipment).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
}));

const stats = {
  updated: new Date().toISOString(),
  prevFrom, // when the arrows' baseline was saved
  location: PH,
  goldPass: { start: iso(goldPass.startTime), end: iso(goldPass.endTime) },
  sample: globalProfiles.size, // equipment: world's top 200
  heroes,
  rankings: {
    players: players.items.map((r) => playerRow('players', r, r.trophies, homeProfiles.get(r.tag))),
    globalPlayers: globalPlayers.items.map((r) => playerRow('globalPlayers', r, r.trophies, globalProfiles.get(r.tag))),
    builderPlayers: builderPlayers.items.map((r) => playerRow('builderPlayers', r, r.builderBaseTrophies, builderProfiles.get(r.tag))),
    clans: clans.items.map((r) => clanRow('clans', r, r.clanPoints)),
    builderClans: builderClans.items.map((r) => clanRow('builderClans', r, r.clanBuilderBasePoints)),
    capitals: capitals.items.map((r) => clanRow('capitals', r, r.clanCapitalPoints))
  }
};

// App Store numbers for /coc/'s download buttons (same iTunes lookup the CODM
// feed uses). Optional: if Apple's lookup fails the buttons just keep their
// plain text, so it must never stop the rankings from being written.
let app = null;
try {
  const d = (await (await fetch('https://itunes.apple.com/lookup?id=529479190')).json()).results[0];
  app = {
    version: d.version,
    updated: d.currentVersionReleaseDate,
    rating: Math.round(d.averageUserRating * 10) / 10,
    ratings: d.userRatingCount
  };
} catch {}

// Rankings move every minute, so there's always something new to write.
await writeFile(OUT, JSON.stringify(stats) + '\n');
await writeFile(
  OUT_HOME,
  JSON.stringify({
    updated: stats.updated,
    sample: stats.sample,
    top: stats.rankings.globalPlayers.slice(0, 10),
    heroes: heroes.map((h) => ({ ...h, equipment: h.equipment.slice(0, 3) })),
    app
  }) + '\n'
);
console.log(`Updated: ${homeProfiles.size} + ${builderProfiles.size} + ${globalProfiles.size} profiles, arrows vs ${prevFrom}`);
