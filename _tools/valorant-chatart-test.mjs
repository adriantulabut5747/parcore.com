// node _tools/valorant-chatart-test.mjs: checks the chat art engine + every gallery piece (valorant-chatart.js / .json)
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import assert from 'assert/strict';
const E = createRequire(import.meta.url)('../site/valorant-chatart.js');

// share codes round-trip; junk from the address is refused
const a = E.banner('GG WP', 26, E.LIGHT, 0, 1).art;
assert.deepEqual(E.decode(E.encode(a)), a);
for (const bad of ['', '26d', '26d.a', '99d.a26', '26z.a26', '26d.a9999', '26d.<script>', '11d.a11']) assert.equal(E.decode(bad), null, bad);
assert.equal(E.decode('26d.a' + 26 * 21), null, 'more than 20 rows');

// banners: 6 small / 3 big letters a line, max 3 lines, ink + a █ background stay apart
assert.equal(E.rowsOf(E.banner('ABCDEF', 26, 3, 0, 1).art), 5);
assert.equal(E.rowsOf(E.banner('ABCDEFG', 26, 3, 0, 1).art), 11);
assert.equal(E.banner('A B C D E F G H I J', 26, 3, 0, 2).cut, true);
assert.equal(E.banner('@#$', 26, 3, 0, 1), null);
const inv = E.banner('I', 26, 0, 3, 1).art;
assert.ok(inv.g.includes(3) && inv.g.includes(0) && inv.bg === 0);

// width change keeps the drawing centred; rows pad with the background
assert.equal(E.setWidth(a, 30).g.length, 30 * E.rowsOf(a));
assert.equal(E.line(E.setRows(a, 1)).length, 26);

// every gallery piece: unique id, 26 wide, <= 20 rows, nothing cropped
const d = JSON.parse(readFileSync(new URL('../site/valorant-chatart.json', import.meta.url)));
const ids = new Set();
for (const p of d.art) {
  assert.ok(!ids.has(p.id), 'duplicate id ' + p.id), ids.add(p.id);
  assert.ok(d.cats.includes(p.cat), p.id + ' category');
  if (p.px) assert.ok(Math.max(...p.px.map((r) => r.length)) * 2 <= 26, p.id + ' too wide');
  const b = p.text ? E.banner(p.text, 26, E.LIGHT, 0, p.big ? 2 : 1) : null;
  if (b) assert.ok(!b.cut, p.id + ' cut');
  const art = b ? b.art : E.fromPixels(p.px, 26, E.LIGHT, 2);
  assert.ok(E.rowsOf(art) <= E.MAX_ROWS && art.w === 26, p.id);
}
console.log('chat art ok:', d.art.length, 'pieces');
