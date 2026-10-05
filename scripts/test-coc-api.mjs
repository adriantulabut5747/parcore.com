// Quick check of the tag cleaner in netlify/functions/coc-api.mjs.
// Run: node scripts/test-coc-api.mjs   (prints "ok" or throws)
import assert from 'node:assert';
import { cleanTag } from '../netlify/functions/coc-api.mjs';

assert.equal(cleanTag('#2gypgpjp9'), '2GYPGPJP9');
assert.equal(cleanTag(' #2GY PGP-JP9 '), '2GYPGPJP9');
assert.equal(cleanTag('#PO8'), 'P08'); // letter O typed for zero
assert.equal(cleanTag('#ABC123'), null); // A, B, C, 1, 3 never appear in tags
assert.equal(cleanTag(''), null);
assert.equal(cleanTag('../clans'), null);
console.log('ok');
