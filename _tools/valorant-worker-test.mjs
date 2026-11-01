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
for (const [q, want] of [
  ['type=ladder&region=eu', H + 'v3/leaderboard/eu/pc?size=100&page=1'],
  ['type=ladder&region=na&page=42', H + 'v3/leaderboard/na/pc?size=100&page=42'],
  ['type=ladder&region=kr&name=Foo Bar&tag=KR1', H + 'v3/leaderboard/kr/pc?name=Foo%20Bar&tag=KR1'],
]) {
  // the fake answer has no results, so ladder() answers 502: only the Henrik URL is checked
  asked.length = 0;
  await call(q);
  assert.deepEqual(asked, [want], q);
}
for (const q of [
  'type=stored&region=ap&name=Foo&tag=123&mode=deathmatch',
  'type=rr&region=xx&name=Foo&tag=123',
  'type=mmr3&region=na&name=F&tag=123',
  'type=matches&region=na&name=Foo&tag=123&start=50',
  'type=matches&region=na&name=Foo&tag=123&start=15',
  'type=ladder&region=na&page=0',
  'type=ladder&region=na&page=1000',
  'type=ladder&region=na&page=2x',
  'type=ladder&region=na&name=Foo',
  'type=ladder&region=xx',
]) {
  asked.length = 0;
  assert.equal((await call(q)).status, 400, q);
  assert.equal(asked.length, 0, q + ' must not reach Henrik');
}
// the match list's fake answer isn't a list (502 from matchList), so check only the Henrik URL it asked for
asked.length = 0;
await call('type=matches&region=na&name=Foo&tag=123&start=40');
assert.deepEqual(asked, [H + 'v4/matches/na/pc/Foo/123?size=10&start=40']);
// ladder(): Henrik's v3 shape -> rows; an anonymized player loses name + tag
{
  const real = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        status: 200,
        results: { total: 2 },
        data: {
          updated_at: 'u',
          thresholds: [],
          players: [
            {
              leaderboard_rank: 1,
              name: 'A',
              tag: 'B1',
              is_anonymized: false,
              tier: 27,
              rr: 900,
              wins: 80,
              card: 'c',
              title: 't',
              puuid: 'p',
            },
            { leaderboard_rank: 2, name: 'X', tag: 'Y1', is_anonymized: true, tier: 27, rr: 880, wins: 70, card: 'd' },
          ],
        },
      }),
      { status: 200 },
    );
  const j = await (await call('type=ladder&region=ap&page=3')).json();
  assert.equal(j.total, 2);
  assert.deepEqual(j.players[0], { rank: 1, name: 'A', tag: 'B1', tier: 27, rr: 900, wins: 80, card: 'c' });
  assert.equal(j.players[1].name, '');
  globalThis.fetch = real;
}
console.log('worker routes ok');

// slimMatch on a real Henrik match (optional: E:\claude-tmp\...\m.json style sample passed as argv[2])
const { slimMatch } = await import(new URL('../cloudflare/valorant-api/worker.js', import.meta.url));
const k = { puuid: 'a', team: 'Red' },
  v = { puuid: 'b', team: 'Blue' };
const slim = slimMatch({
  metadata: { match_id: 'm' },
  players: [{ puuid: 'a', customization: { card: 'c' }, behavior: { afk_rounds: 0, x: 1 } }],
  teams: [],
  coaches: [1],
  rounds: [{ id: 0, stats: [{ player: k, damage_events: [1], economy: { loadout_value: 1, weapon: null, armor: null, remaining: 0 } }] }],
  kills: [
    {
      round: 0,
      killer: k,
      victim: v,
      assistants: [],
      location: { x: 300, y: 400 },
      player_locations: [{ player: k, location: { x: 0, y: 0 } }],
    },
  ],
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

// THE LINE: the Gate's maths with a fake clock (no Durable Object needed)
{
  const { Gate, PER_MIN } = await import(new URL('../cloudflare/valorant-api/worker.js', import.meta.url));
  const g = new Gate();
  let t = 1e6;
  const a = g.ticket(11, t, 'a'); // room: a pass right away
  const b = g.ticket(11, t, 'b');
  assert.equal(a.state, 'go');
  assert.equal(b.state, 'go');
  const c = g.ticket(11, t, 'c'); // 28 - 22 reserved = 6 free < 11: waits
  assert.deepEqual([c.state, c.place, c.line], ['wait', 1, 1]);
  assert.ok(c.wait > 0);
  assert.equal(g.spend('', t), false); // no pass while someone waits: no
  for (let i = 0; i < 11; i++) assert.ok(g.spend('a', t)); // a spends its 11
  assert.ok(g.spend('a', t) === false); // a is used up, and c still waits
  g.done('b', t); // b's pages were all cached: its 11 come back
  assert.equal(g.poll('c', t).state, 'go'); // 28 - 11 used - 0 = 17 free >= 11
  const d = g.ticket(11, t, 'd');
  assert.equal(d.state, 'wait'); // 28 - 11 used - 11 reserved(c) = 6
  // d polls every 10 s, like the page; once a's calls leave the minute (and c's pass runs out) d goes
  let st = 'wait';
  for (let i = 0; i < 7 && st === 'wait'; i++) st = g.poll('d', (t += 10000)).state;
  assert.equal(st, 'go');
  const e = g.ticket(PER_MIN, t, 'e');
  assert.equal(e.state, 'wait');
  assert.equal(g.poll('e', t + 20001).state, 'gone'); // stopped polling for 20 s: left the line
}
console.log('gate ok');
