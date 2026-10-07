// Builds site/coc-lobby-stats.json: the Philippines leaderboards, equipment
// counts and dashboard numbers for /coc/stats/ and the lobby teaser on /coc/.
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

// Every list gets the same row shape so the page has one row builder.
// prev is the rank yesterday (-1 = new in the top 200).
// score = trophies (players) or clan points (clans).
const row = (r, score) => ({ rank: r.rank, prev: r.previousRank, tag: r.tag, name: r.name, score });
const playerRow = (r, score) => ({
  ...row(r, score),
  exp: r.expLevel,
  ...(r.leagueTier && { tier: r.leagueTier.name, tierIcon: tail(r.leagueTier.iconUrls?.small) }),
  ...(r.clan && { clan: r.clan.name, clanTag: r.clan.tag, badge: tail(r.clan.badgeUrls?.small) })
});
const clanRow = (r, score) => ({ ...row(r, score), level: r.clanLevel, members: r.members, badge: tail(r.badgeUrls?.small) });

const base = `/locations/${PH.id}/rankings/`;
const [players, clans, builderPlayers, builderClans, capitals, goldPass] = await Promise.all([
  get(base + 'players?limit=200'),
  get(base + 'clans?limit=200'),
  get(base + 'players-builder-base?limit=200'),
  get(base + 'clans-builder-base?limit=200'),
  get(base + 'capitals?limit=200'),
  get('/goldpass/seasons/current')
]);

// "20261001T080000.000Z" -> "2026-10-01T08:00:00.000Z" (what Date() reads)
const iso = (s) => s.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)/, '$1-$2-$3T$4:$5:$6');

// Profiles of the top 200 players, 5 at a time so the shared proxy isn't
// flooded. One failed profile is skipped, not fatal -- `sample` says how
// many were counted.
const profiles = [];
const tags = players.items.map((p) => p.tag);
for (let i = 0; i < tags.length; i += 5) {
  const batch = await Promise.allSettled(tags.slice(i, i + 5).map((t) => get('/players/' + encodeURIComponent(t))));
  for (const b of batch) b.status === 'fulfilled' ? profiles.push(b.value) : console.warn(b.reason.message);
}
if (profiles.length < tags.length / 2) { console.error('Only ' + profiles.length + ' profiles loaded'); process.exit(1); }

// Town Hall spread: { "18": 190, "17": 10 }
const townHalls = {};
for (const p of profiles) townHalls[p.townHallLevel] = (townHalls[p.townHallLevel] || 0) + 1;

// Per home-village hero: how many own it, average level, and how many have
// each equipment on it right now. Builder Base heroes have no equipment.
const heroMap = new Map();
for (const p of profiles) {
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
  location: PH,
  goldPass: { start: iso(goldPass.startTime), end: iso(goldPass.endTime) },
  sample: profiles.length,
  townHalls,
  heroes,
  rankings: {
    players: players.items.map((r) => playerRow(r, r.trophies)),
    builderPlayers: builderPlayers.items.map((r) => playerRow(r, r.builderBaseTrophies)),
    clans: clans.items.map((r) => clanRow(r, r.clanPoints)),
    builderClans: builderClans.items.map((r) => clanRow(r, r.clanBuilderBasePoints)),
    capitals: capitals.items.map((r) => clanRow(r, r.clanCapitalPoints))
  }
};

// Same rule as clan-stats.mjs: no change -> no write -> no commit/deploy.
let previous = null;
try { const { updated, ...rest } = JSON.parse(await readFile(OUT, 'utf8')); previous = rest; } catch {}
if (previous && JSON.stringify(previous) === JSON.stringify(stats)) {
  console.log('No change.');
} else {
  await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), ...stats }) + '\n');
  console.log(`Updated: ${profiles.length} profiles, TH ${JSON.stringify(townHalls)}`);
}
