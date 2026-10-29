// The Piglin's map on /minecraft/ (Oct 28 2026; the Nether since the same evening, was the Overworld): a real Java
// seed's Nether, drawn the way a filled map item draws it.
//   node _tools/lobby-map/build.mjs
// Uses the Seed Map's own generator (site/mc-seedmap.wasm, cubiomes) for the Nether biomes and structures, then
// paints them with the game's map palette (MapColor base colours of each biome's floor blocks) and its 4 brightness
// steps (MapColor.Brightness: 180 / 220 / 255 / 135 of 255). A real map held in the Nether draws the bedrock roof,
// so this is the map the Piglin "drew by hand": biomes + structures are the seed's, the lava seas and the height
// shading come from smooth noise (the look, not the real terrain). Lava shades by distance to shore like water.
// Writes site/images/minecraft/lobby/map.png (128x128, the unexplored edge left transparent so the
// parchment shows) and site/mc-lobby-map.json (structures in map pixels, read by mc-lobby.js).
import fs from 'fs';
import zlib from 'zlib';

const SEED = 8608349220991265627n; // "All Biome Continent", mc-seeds.json #1
const MC_1_21 = 28, SCALE = 16, N = 128; // the map item's 1:16 zoom, 128 pixels a side = 2048 blocks

const wasi = new Proxy({}, { get: () => () => 8 });
const { instance } = await WebAssembly.instantiate(fs.readFileSync(new URL('../../site/mc-seedmap.wasm', import.meta.url)), { wasi_snapshot_preview1: wasi });
const w = instance.exports;
w._initialize();
const mem = () => new Int32Array(w.memory.buffer);
const str = (p) => { const b = new Uint8Array(w.memory.buffer, p); let s = ''; for (let i = 0; b[i]; i++) s += String.fromCharCode(b[i]); return s; };
w.sm_init(MC_1_21, 0, SEED);
const sp = w.sm_spawn() >> 2, spawn = [mem()[sp], mem()[sp + 1]];
w.sm_init(MC_1_21, -1, SEED); // DIM_NETHER; centred under the Overworld spawn (Nether coords = Overworld / 8)
const centre = [Math.round(spawn[0] / 8), Math.round(spawn[1] / 8)];
const cx = Math.round(centre[0] / SCALE) - N / 2, cz = Math.round(centre[1] / SCALE) - N / 2; // map origin, in 1:16 units

const p = w.sm_biomes(SCALE, cx, cz, N, N) >> 2;
const ids = mem().slice(p, p + N * N);
const names = {};
const nameOf = (id) => (names[id] ??= str(w.sm_biome_name(MC_1_21, id)));

// MapColor base colours of each Nether biome's floor (net.minecraft.world.level.material.MapColor)
const C = {
  lava: [255, 0, 0], netherrack: [112, 2, 0], crimson: [189, 48, 49], wart: [153, 51, 51], warped: [22, 126, 134],
  warpedWart: [20, 180, 133], soul: [102, 76, 51], basalt: [25, 25, 25], blackstone: [76, 76, 76], glow: [247, 233, 163]
};
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// lava seas: low ground in the wastes and deltas (the Nether's sea sits at y 31); forests and valleys stay dry
const sea = (x, z) => vnoise(x / 11 + 40, z / 11) * 0.75 + vnoise(x / 4 + 9, z / 4) * 0.25;
function colorOf(n, x, z) {
  const s = sea(x, z), d = vnoise(x / 2.5 + 3, z / 2.5 + 7);
  if (/nether_wastes/.test(n)) return s < 0.36 ? 'lava' : hash(x * 5, z * 3) > 0.985 ? 'glow' : 'netherrack';
  if (/basalt/.test(n)) return s < 0.3 ? 'lava' : d > 0.62 ? 'blackstone' : 'basalt';
  if (/crimson/.test(n)) return d > 0.58 ? 'wart' : 'crimson';
  if (/warped/.test(n)) return d > 0.6 ? 'warpedWart' : 'warped';
  if (/soul/.test(n)) return 'soul';
  return 'netherrack';
}
const kind = new Array(N * N);
for (let i = 0; i < N * N; i++) kind[i] = colorOf(nameOf(ids[i]), i % N, (i / N) | 0);

// distance to shore for lava (BFS over 4-neighbours), capped
const dist = new Int32Array(N * N).fill(99);
const q = [];
for (let i = 0; i < N * N; i++) if (kind[i] !== 'lava') { dist[i] = 0; q.push(i); }
for (let h = 0; h < q.length; h++) {
  const i = q[h], x = i % N, z = (i / N) | 0;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= N || Z >= N) continue;
    const j = Z * N + X; if (dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q.push(j); }
  }
}
// smooth stand-in height for the ground shading
const height = (x, z) => vnoise(x / 6, z / 6) * 9 + vnoise(x / 2.2, z / 2.2) * 3;

// the explored shape: a rough disc, as if the Piglin walked it (the game leaves unexplored pixels blank)
const R = N / 2;
function explored(x, z) {
  const dx = x + 0.5 - R, dz = z + 0.5 - R, a = Math.atan2(dz, dx);
  const edge = R * (0.86 + 0.07 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 7 + 2) + 0.03 * Math.sin(a * 13));
  return Math.hypot(dx, dz) < edge;
}
const B = [180, 220, 255, 135].map((v) => v / 255);
const rgba = Buffer.alloc(N * N * 4);
for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
  const i = z * N + x, o = i * 4;
  if (!explored(x, z)) continue;
  const k = kind[i];
  let step;
  if (k === 'lava') {
    // like water in MapItem: depth * 0.1 + checker (x + z) & 1 * 0.2, < 0.5 bright, > 0.9 dark
    const d = Math.min(dist[i], 12) * 0.9 + ((x + z) & 1) * 0.2 * 4;
    step = d < 2.4 ? 2 : d > 6 ? 0 : 1;
  } else {
    const dh = height(x, z) - height(x, z - 1) + (hash(x * 3, z * 7) - 0.5) * 0.4;
    step = dh > 0.6 ? 2 : dh < -0.6 ? 0 : 1;
  }
  const c = C[k], m = B[step];
  rgba[o] = Math.round(c[0] * m); rgba[o + 1] = Math.round(c[1] * m); rgba[o + 2] = Math.round(c[2] * m); rgba[o + 3] = 255;
}

// structures inside the map (block coords -> map pixels)
const X0 = cx * SCALE, Z0 = cz * SCALE, X1 = X0 + N * SCALE, Z1 = Z0 + N * SCALE;
const TYPES = { 19: 'bastion', 18: 'fortress', 12: 'ruined_portal' }; // cubiomes Bastion / Fortress / Ruined_Portal_N
const structs = [];
for (const [t, name] of Object.entries(TYPES)) {
  const v = w.sm_structs(+t, X0, Z0, X1, Z1) >> 2, n = mem()[v];
  for (let k = 0; k < n; k++) {
    const bx = mem()[v + 1 + 2 * k], bz = mem()[v + 2 + 2 * k];
    const mx = Math.floor((bx - X0) / SCALE), mz = Math.floor((bz - Z0) / SCALE);
    if (mx < 4 || mz < 4 || mx > N - 5 || mz > N - 5 || !explored(mx, mz)) continue;
    structs.push({ type: name, x: mx, z: mz, bx, bz });
  }
}
// Banner spots for the pages (mc-lobby.js puts one page on each, in this order): every structure on dry ground
// first (bastions lead, so the Java pages land on the piglins' homes), then dry ground filled in, at least GAP apart.
const GAP = 13, slots = [];
const land = (x, z) => explored(x, z) && kind[z * N + x] !== 'lava' && Math.hypot(x + 0.5 - R, z + 0.5 - R) < R * 0.78;
const free = (x, z) => slots.every((s) => Math.hypot(s.x - x, s.z - z) >= GAP);
const order = (t) => ({ bastion: 0, fortress: 1 })[t] ?? 2;
structs.slice().sort((a, b) => order(a.type) - order(b.type)).forEach((s) => { if (land(s.x, s.z) && free(s.x, s.z)) slots.push({ x: s.x, z: s.z, at: s.type }); });
for (let k = 0; k < 4000 && slots.length < 40; k++) {
  const x = 8 + Math.floor(hash(k, 11) * (N - 16)), z = 8 + Math.floor(hash(k, 29) * (N - 16));
  if (land(x, z) && free(x, z)) slots.push({ x, z });
}
console.log('slots', slots.length);
const counts = {};
structs.forEach((s) => (counts[s.type] = (counts[s.type] || 0) + 1));
const biomes = {};
for (let i = 0; i < N * N; i++) biomes[nameOf(ids[i])] = (biomes[nameOf(ids[i])] || 0) + 1;
console.log('centre', centre, 'structures', structs.length, counts, 'biomes', biomes);

// PNG writer (RGBA, no filter)
function png(buf, w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; buf.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const out = new URL('../../site/', import.meta.url);
fs.writeFileSync(new URL('images/minecraft/lobby/map.png', out), png(rgba, N, N));
fs.writeFileSync(new URL('mc-lobby-map.json', out), JSON.stringify({
  _readme: 'Built by _tools/lobby-map/build.mjs: structures on the Piglin Nether map (x/z = map pixels, 0-127; bx/bz = Nether block coords). Rebuild, never edit.',
  seed: SEED.toString(), version: '1.21', dim: -1, scale: SCALE, centre, structs, slots
}));
console.log('wrote map.png + mc-lobby-map.json');
