// Check for THE LINE end to end, no network: site/valorant-line.js -> the Worker -> its Gate (in memory) -> a fake Henrik.
// Run: node _tools/valorant-line-test.mjs  (takes ~3 s: the line polls on a real clock)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const W = 'https://parchrome-valorant.adriantulabut5747.workers.dev/';
let henrikCalls = 0;
globalThis.caches = { default: { match: async () => null, put: async () => {} } };
const { default: worker, Gate } = await import(new URL('../cloudflare/valorant-api/worker.js', import.meta.url));
const gate = new Gate();
const env = { HENRIK_API_KEY: 'k', GATE: { idFromName: () => 'henrik', get: () => ({ fetch: (u) => gate.fetch(new Request(u)) }) } };
globalThis.fetch = async (u) => {
  u = String(u);
  if (u.startsWith(W)) return worker.fetch(new Request(u), env, { waitUntil() {} });
  henrikCalls++;
  return new Response('{"status":200,"data":{"puuid":"p"}}', { status: 200 });
};
globalThis.window = {};
new Function(readFileSync(new URL('../site/valorant-line.js', import.meta.url), 'utf8'))();
const { vlLine } = window;
const getJSON = async (url) => {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error(body.errors[0].message), { status: res.status });
  return body;
};
const acc = W + 'api/valorant?type=account&name=Foo&tag=123';

// two profiles fit the minute (28 - 2 x 11 = 6 left), the third waits in line
const seen = [];
const a = await vlLine.ticket(11, () => {});
const b = await vlLine.ticket(11, () => {});
assert.ok(a && b);
const c = vlLine.ticket(11, (t) => seen.push(t));
await new Promise((r) => setTimeout(r, 100));
assert.deepEqual([seen[0].state, seen[0].place], ['wait', 1]);

// a call without a pass doesn't jump the line
await assert.rejects(getJSON(acc), (e) => e.status === 429);
assert.equal(henrikCalls, 0);

// a spends one call; b had everything cached and hands its 11 back -> c goes on its next poll
await vlLine.get(acc, getJSON, a, () => {});
assert.equal(henrikCalls, 1);
await vlLine.done(b);
const cPass = await c;
assert.ok(cPass);
assert.equal(seen.at(-1), null); // told the page it's through
console.log('line ok');
