// Smoke test for site/mc-seedmap.wasm:  node _tools/seedmap/test.mjs
import fs from 'fs';
import assert from 'assert';

const wasi = new Proxy({}, { get: () => () => 8 }); // EBADF: the map never does I/O (libc start-up stops on it)
const { instance } = await WebAssembly.instantiate(fs.readFileSync(new URL('../../site/mc-seedmap.wasm', import.meta.url)),
  { wasi_snapshot_preview1: wasi });
const w = instance.exports;
w._initialize();
const mem = () => new Int32Array(w.memory.buffer);
const str = (p) => { const b = new Uint8Array(w.memory.buffer, p); let s = ''; for (let i = 0; b[i]; i++) s += String.fromCharCode(b[i]); return s; };

const MC_1_21 = 28, OW = 0;
w.sm_init(MC_1_21, OW, 8608349220991265627n);

let t = performance.now();
const p = w.sm_biomes(4, -128, -128, 256, 256) >> 2; // 1024x1024 blocks at 1:4
const ids = mem().slice(p, p + 256 * 256);
console.log('1:4 256x256 tile', (performance.now() - t).toFixed(0), 'ms');
const seen = {};
ids.forEach((id) => (seen[id] = (seen[id] || 0) + 1));
console.log(Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => str(w.sm_biome_name(MC_1_21, +id)) + ' ' + n).join(', '));
assert(Object.keys(seen).length > 3, 'a 1024-block square should hold several biomes');

t = performance.now();
const s = w.sm_spawn() >> 2;
console.log('spawn', mem()[s], mem()[s + 1], (performance.now() - t).toFixed(0), 'ms');

const v = w.sm_structs(5 /* Village */, -3000, -3000, 3000, 3000) >> 2;
const n = mem()[v];
console.log('villages within 3000:', n, Array.from(mem().slice(v + 1, v + 1 + Math.min(n, 4) * 2)).join(','));
assert(n > 0);

const sh = w.sm_strongholds(3) >> 2;
console.log('first strongholds', Array.from(mem().slice(sh, sh + 6)).join(','));
