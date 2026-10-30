// node _tools/valorant-ranks-test.mjs: checks the Ranks page's party rule and leaderboard maths
// (site/valorant-ranks.js) against Riot's examples. Pulls the two functions out of the page script.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const src = readFileSync(new URL('../site/valorant-ranks.js', import.meta.url), 'utf8');
const grab = (name) => src.match(new RegExp('  function ' + name + '\\([^]*?\\n  }\\n'))[0];
const { partyOK, parseBoard } = new Function(grab('partyOK') + grab('parseBoard') + 'return { partyOK, parseBoard };')();

// Riot's Competitive FAQ table (tier ids: 3 Iron 1, 9 Silver 1, 12 Gold 1, 15 Plat 1, 18 Dia 1, 24 Imm 1, 27 Radiant)
assert.ok(partyOK(3, 11)); // Iron 1 + Silver 3
assert.ok(!partyOK(3, 12)); // Iron 1 + Gold 1
assert.ok(partyOK(9, 14) && !partyOK(9, 15)); // Silver -> Gold 3
assert.ok(partyOK(12, 17) && !partyOK(12, 18)); // Gold -> Platinum 3
assert.ok(partyOK(16, 19) && !partyOK(16, 20)); // "Platinum 2 can queue with up to Diamond 2"
assert.ok(partyOK(24, 27) && !partyOK(23, 27)); // Immortal 1 + Radiant, Ascendant 3 + Radiant
assert.ok(partyOK(19, 16)); // order doesn't matter

// a board of 1 200: Radiant 1-500, Imm 3 501-700, Imm 2 701-900, Imm 1 901-1200
const b = parseBoard({
  total: 1200,
  updated_at: '2026-10-30T00:00:00Z',
  players: [],
  thresholds: [
    { tier: { id: 24 }, start_index: 901, threshold: 0 },
    { tier: { id: 27 }, start_index: 1, threshold: 450 },
    { tier: { id: 25 }, start_index: 701, threshold: 90 },
    { tier: { id: 26 }, start_index: 501, threshold: 200 },
  ],
});
assert.deepEqual(
  [27, 26, 25, 24].map((t) => b.tiers[t].count),
  [500, 200, 200, 300],
);
assert.equal(b.tiers[27].rr, 450);
// a 0-based board gives the same sizes
const z = parseBoard({
  total: 10,
  thresholds: [
    { tier: { id: 27 }, start_index: 0, threshold: 1 },
    { tier: { id: 24 }, start_index: 4, threshold: 0 },
  ],
});
assert.deepEqual([z.tiers[27].count, z.tiers[24].count], [4, 6]);
// junk in = empty, no throw
assert.deepEqual(parseBoard({}).tiers, {});
console.log('valorant-ranks: ok');
