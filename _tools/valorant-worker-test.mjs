// Check for cloudflare/valorant-api/worker.js routes, no network: Henrik + the edge cache are faked.
// Run: node _tools/valorant-worker-test.mjs
import assert from 'node:assert/strict';

const asked = [];
globalThis.fetch = async (url) => (asked.push(String(url)), new Response('{"status":200,"data":{}}', { status: 200 }));
globalThis.caches = { default: { match: async () => null, put: async () => {} } };
const { default: worker } = await import(new URL('../cloudflare/valorant-api/worker.js', import.meta.url));
const ctx = { waitUntil() {} };
const call = (q) => worker.fetch(new Request('https://w.dev/api/valorant?' + q), { HENRIK_API_KEY: 'k' }, ctx);
const H = 'https://api.henrikdev.xyz/valorant/';

for (const [q, want] of [
  ['type=mmr3&region=eu&name=Foo Bar&tag=EU1', H + 'v3/mmr/eu/pc/Foo%20Bar/EU1'],
  ['type=rr&region=na&name=Foo&tag=NA1', H + 'v2/mmr-history/na/pc/Foo/NA1'],
  ['type=rrstored&region=ap&name=Foo&tag=123', H + 'v2/stored-mmr-history/ap/pc/Foo/123?size=100'],
  ['type=stored&region=ap&name=Foo&tag=123', H + 'v1/stored-matches/ap/Foo/123?size=100'],
  ['type=stored&region=ap&name=Foo&tag=123&mode=competitive', H + 'v1/stored-matches/ap/Foo/123?size=100&mode=competitive'],
]) {
  asked.length = 0;
  const res = await call(q);
  assert.equal(res.status, 200, q);
  assert.deepEqual(asked, [want], q);
}
for (const q of [
  'type=stored&region=ap&name=Foo&tag=123&mode=deathmatch',
  'type=rr&region=xx&name=Foo&tag=123',
  'type=mmr3&region=na&name=F&tag=123',
  'type=matches&region=na&name=Foo&tag=123&start=20',
]) {
  asked.length = 0;
  assert.equal((await call(q)).status, 400, q);
  assert.equal(asked.length, 0, q + ' must not reach Henrik');
}
console.log('worker routes ok');

// slimMatch on a real Henrik match (optional: E:\claude-tmp\...\m.json style sample passed as argv[2])
const { slimMatch } = await import(new URL('../cloudflare/valorant-api/worker.js', import.meta.url));
const k = { puuid: 'a', team: 'Red' }, v = { puuid: 'b', team: 'Blue' };
const slim = slimMatch({
  metadata: { match_id: 'm' }, players: [{ puuid: 'a', customization: { card: 'c' }, behavior: { afk_rounds: 0, x: 1 } }], teams: [], coaches: [1],
  rounds: [{ id: 0, stats: [{ player: k, damage_events: [1], economy: { loadout_value: 1, weapon: null, armor: null, remaining: 0 } }] }],
  kills: [{ round: 0, killer: k, victim: v, assistants: [], location: { x: 300, y: 400 }, player_locations: [{ player: k, location: { x: 0, y: 0 } }] }],
});
assert.equal(slim.kills[0].distance, 5); // 500 units = 5 m
assert.equal(slim.players[0].card, 'c');
assert.equal(slim.coaches, undefined);
assert.equal(slim.rounds[0].stats[0].damage_events, undefined);
if (process.argv[2]) {
  const { readFileSync } = await import('node:fs');
  const raw = readFileSync(process.argv[2], 'utf8');
  const out = JSON.stringify(JSON.parse(raw).data.map(slimMatch));
  console.log('sample', raw.length, '->', out.length, 'bytes');
}
console.log('slimMatch ok');
