// Clash Royale meta crawl (plan: docs/clash-royale-plan.md, sections 4a + 7).
// Reads the Path of Legends top 1,000's battle logs and counts every ranked 1v1 deck.
//
//   data/cr/YYYY-MM-DD.json  one run's counts (private, outside site/; the last 7 are kept)
//   site/cr-decks.json       7-day totals, decks with >= FLOOR games
//   site/cr-cards.json       every card (from /cards) + its 7-day usage
//   site/cr-top.json         top 10 players + the deck of their latest ranked battle
//
// Run daily by .github/workflows/cr-meta.yml. Key = the CR_API_KEY secret; calls go
// through RoyaleAPI's proxy (45.79.218.79 is the IP registered on the key).
// Local test:  CR_API_KEY=... node scripts/cr-meta.mjs
//   (or save the key alone in ~/cr-key.txt -- never inside the repo)

import { readFile, writeFile, readdir, mkdir, unlink } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const API = 'https://proxy.royaleapi.dev/v1';
const DAYS = new URL('../data/cr/', import.meta.url);
const SITE = new URL('../site/', import.meta.url);
const KEEP = 7; // days summed into the site files
const FLOOR = 50; // a deck needs this many games in the window to be listed (else a 5-0 deck reads "100%")

let key = process.env.CR_API_KEY;
if (!key) try { key = readFileSync(homedir() + '/cr-key.txt', 'utf8').trim(); } catch {}
if (!key) {
  // Not a failure: the job is in place before the secret is (Oct 30 2026).
  console.log('::warning::CR_API_KEY is not set, nothing crawled');
  process.exit(0);
}
const headers = { Authorization: 'Bearer ' + key, Accept: 'application/json' };

async function get(path, tries = 4) {
  const res = await fetch(API + path, { headers });
  if (res.status === 429 && tries > 1) {
    await new Promise((r) => setTimeout(r, 2000));
    return get(path, tries - 1);
  }
  if (!res.ok) throw new Error(path + ' -> HTTP ' + res.status);
  return res.json();
}

// "20261030T021237.000Z" -> Date
const when = (s) => new Date(s.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)/, '$1-$2-$3T$4:$5:$6'));

// A deck = its 8 cards sorted by id, each with how it was played (evolutionLevel:
// 1 = evolution, 2 = hero form, none = normal), e.g. "26000003.2-26000007.1-28000001".
const deckKey = (cards) =>
  cards
    .map((c) => c.id + (c.evolutionLevel ? '.' + c.evolutionLevel : ''))
    .sort()
    .join('-');

// Count only battles newer than the last run's cutoff, so a battle still sitting in
// tomorrow's 30-battle log is never counted twice. First run / long gap: last 24 h.
await mkdir(DAYS, { recursive: true });
const dayFiles = (await readdir(DAYS)).filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort();
const now = new Date();
let from = new Date(now - 24 * 36e5);
if (dayFiles.length) {
  const last = JSON.parse(await readFile(new URL(dayFiles.at(-1), DAYS), 'utf8'));
  from = new Date(Math.max(new Date(last.to), now - 48 * 36e5));
}

const [cardList, board] = await Promise.all([get('/cards'), get('/locations/global/pathoflegend/players?limit=1000')]);
const players = board.items;
if (players.length < 500) throw new Error('Leaderboard has only ' + players.length + ' rows');

// Battle logs, 8 at a time. A failed log is skipped, not fatal.
const logs = new Map();
let failed = 0;
for (let i = 0; i < players.length; i += 8) {
  const batch = await Promise.allSettled(players.slice(i, i + 8).map((p) => get('/players/' + encodeURIComponent(p.tag) + '/battlelog')));
  batch.forEach((b, j) => (b.status === 'fulfilled' ? logs.set(players[i + j].tag, b.value) : failed++));
}
if (logs.size < players.length / 2) throw new Error('Only ' + logs.size + ' battle logs loaded');

const day = { from: from.toISOString(), to: now.toISOString(), players: logs.size, battles: 0, decks: {}, cards: {}, towers: {} };
const seen = new Set();
const add = (side, won) => {
  const k = deckKey(side.cards);
  const tt = side.supportCards?.[0]?.id;
  const d = (day.decks[k] ||= { g: 0, w: 0, t: {} });
  d.g++, (d.w += won);
  if (tt) d.t[tt] = (d.t[tt] || 0) + 1;
  for (const c of side.cards) {
    const s = (day.cards[c.id] ||= [0, 0, 0, 0]); // games, wins, as evolution, as hero
    s[0]++, (s[1] += won);
    if (c.evolutionLevel === 1) s[2]++;
    if (c.evolutionLevel === 2) s[3]++;
  }
  if (tt) {
    const s = (day.towers[tt] ||= [0, 0]);
    s[0]++, (s[1] += won);
  }
};
for (const log of logs.values()) {
  for (const b of log) {
    if (b.type !== 'pathOfLegend' || b.team.length !== 1 || b.opponent.length !== 1) continue;
    const t = when(b.battleTime);
    if (t <= from || t > now) continue;
    const [me, them] = [b.team[0], b.opponent[0]];
    if (me.cards.length !== 8 || them.cards.length !== 8 || me.crowns === them.crowns) continue; // draws carry no winner
    const id = b.battleTime + [me.tag, them.tag].sort().join(''); // both crawled players log the same battle
    if (seen.has(id)) continue;
    seen.add(id);
    day.battles++;
    add(me, me.crowns > them.crowns ? 1 : 0);
    add(them, them.crowns > me.crowns ? 1 : 0);
  }
}
console.log(`${logs.size} logs (${failed} failed), ${day.battles} new ranked battles since ${day.from}`);

// Same-day re-runs add to that day's file instead of replacing it (their windows never overlap).
const name = now.toISOString().slice(0, 10) + '.json';
if (dayFiles.at(-1) === name) {
  const old = JSON.parse(await readFile(new URL(name, DAYS), 'utf8'));
  day.from = old.from;
  merge(day, old);
} else dayFiles.push(name);
await writeFile(new URL(name, DAYS), JSON.stringify(day));
for (const f of dayFiles.slice(0, -KEEP)) await unlink(new URL(f, DAYS));

function merge(into, d) {
  into.battles += d.battles;
  for (const [k, v] of Object.entries(d.decks)) {
    const x = (into.decks[k] ||= { g: 0, w: 0, t: {} });
    x.g += v.g, (x.w += v.w);
    for (const [tt, n] of Object.entries(v.t)) x.t[tt] = (x.t[tt] || 0) + n;
  }
  for (const key of ['cards', 'towers'])
    for (const [k, v] of Object.entries(d[key])) {
      const x = (into[key][k] ||= v.map(() => 0));
      v.forEach((n, i) => (x[i] += n));
    }
}

// 7-day totals
const win = { battles: 0, decks: {}, cards: {}, towers: {} };
const kept = dayFiles.slice(-KEEP);
for (const f of kept) merge(win, f === name ? day : JSON.parse(await readFile(new URL(f, DAYS), 'utf8')));
const games = win.battles * 2; // deck-games: every battle has two decks
const pct = (n) => (games ? Math.round((n / games) * 10000) / 100 : 0);
const rate = (w, g) => (g ? Math.round((w / g) * 1000) / 10 : 0);
const first = kept[0] === name ? day : JSON.parse(await readFile(new URL(kept[0], DAYS), 'utf8'));
const meta = { updated: now.toISOString(), from: first.from, to: now.toISOString(), days: kept.length, battles: win.battles, games };

// Icon links share a start; only the file name differs, and the same name works under
// cards/300/, cardevolutions/300/ and cardheroes/300/ (checked Oct 30 2026).
const icon = (url) => (url || '').split('/').pop().replace(/\.png$/, '');

const decks = Object.entries(win.decks)
  .filter(([, d]) => d.g >= FLOOR)
  .map(([k, d]) => ({
    cards: k.split('-').map((c) => c.split('.').map(Number)), // [id] or [id, 1 = evo / 2 = hero]
    tower: +Object.entries(d.t).sort((a, b) => b[1] - a[1])[0]?.[0] || 0,
    games: d.g,
    wins: d.w,
    winRate: rate(d.w, d.g),
    usage: pct(d.g)
  }))
  .sort((a, b) => b.games - a.games);

const cards = cardList.items.map((c) => {
  const s = win.cards[c.id] || [0, 0, 0, 0];
  return {
    id: c.id,
    name: c.name,
    rarity: c.rarity,
    elixir: c.elixirCost ?? null, // Mirror has none
    type: { 26: 'troop', 27: 'building', 28: 'spell' }[String(c.id).slice(0, 2)],
    evo: c.maxEvolutionLevel || 0, // 1 = has an evolution, 2 = a hero form, 3 = both
    icon: icon(c.iconUrls?.medium),
    games: s[0],
    winRate: rate(s[1], s[0]),
    usage: pct(s[0]),
    evoGames: s[2],
    heroGames: s[3]
  };
});
const towers = (cardList.supportItems || []).map((t) => {
  const s = win.towers[t.id] || [0, 0];
  return { id: t.id, name: t.name, rarity: t.rarity, icon: icon(t.iconUrls?.medium), games: s[0], winRate: rate(s[1], s[0]), usage: pct(s[0]) };
});

// Top 10 + the deck of each one's newest ranked battle (no extra calls).
const top = players.slice(0, 10).map((p) => {
  const last = (logs.get(p.tag) || []).find((b) => b.type === 'pathOfLegend')?.team[0];
  return {
    rank: p.rank,
    tag: p.tag,
    name: p.name,
    elo: p.eloRating,
    clan: p.clan?.name || '',
    deck: last ? last.cards.map((c) => (c.evolutionLevel ? [c.id, c.evolutionLevel] : [c.id])) : null,
    tower: last?.supportCards?.[0]?.id || 0
  };
});

const out = (file, data) => writeFile(new URL(file, SITE), JSON.stringify(data) + '\n');
await out('cr-decks.json', { ...meta, floor: FLOOR, decks });
await out('cr-cards.json', { ...meta, cards, towers });
await out('cr-top.json', { updated: meta.updated, players: top });
console.log(`window: ${kept.length} day(s), ${win.battles} battles, ${Object.keys(win.decks).length} decks seen, ${decks.length} listed (>= ${FLOOR} games)`);
