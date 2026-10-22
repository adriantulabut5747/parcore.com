// Seed Map worker: runs mc-seedmap.wasm (cubiomes, built by _tools/seedmap/build.py).
// mc-seedmap.js keeps a pool of these. Every message carries the world it is about
// ({mc, dim, seed}); the worker re-inits only when that changes, so any worker can take
// any job. Reply: {id, ...result}, typed arrays transferred.
'use strict';

let w, colors, cur = '';
let spawn = null; // per world, computed on first ask

const ready = WebAssembly.instantiateStreaming(fetch('/mc-seedmap.wasm?v=1'), {
  // The C library expects a few system calls it never really uses here. 8 = "bad file",
  // which also ends libc's start-up scan for folders.
  wasi_snapshot_preview1: new Proxy({}, { get: () => () => 8 }),
}).then(({ instance }) => {
  w = instance.exports;
  w._initialize();
  colors = u8(w.sm_colors(), 768);
});

// Views are made AFTER the call: a call can grow wasm memory, which detaches the old buffer.
const i32 = (p, n) => new Int32Array(w.memory.buffer, p, n).slice();
const u8 = (p, n) => new Uint8Array(w.memory.buffer, p, n).slice();

function world(m) {
  const key = m.mc + '/' + m.dim + '/' + m.seed;
  if (key === cur) return;
  w.sm_init(m.mc, m.dim, BigInt(m.seed));
  cur = key;
  spawn = null;
}

const ops = {
  // RGBA pixels for an n*n grid of biomes at 1:scale, plus the ids (for the hover readout).
  tile(m) {
    const n = m.n, ids = i32(w.sm_biomes(m.scale, m.x, m.z, n, n), n * n);
    const px = new Uint8ClampedArray(n * n * 4);
    for (let i = 0; i < ids.length; i++) {
      const c = (ids[i] & 255) * 3;
      px[i * 4] = colors[c]; px[i * 4 + 1] = colors[c + 1]; px[i * 4 + 2] = colors[c + 2]; px[i * 4 + 3] = 255;
    }
    return { px, ids };
  },
  biome(m) {
    const id = i32(w.sm_biomes(4, m.x >> 2, m.z >> 2, 1, 1), 1)[0];
    const at = w.sm_biome_name(m.mc, id), p = new Uint8Array(w.memory.buffer, at);
    let name = '';
    for (let i = 0; p[i]; i++) name += String.fromCharCode(p[i]);
    return { name };
  },
  // {type: [x,z,x,z...]} for each asked type inside the block box.
  structs(m) {
    const out = {};
    for (const t of m.types) {
      let xz;
      if (t === 'spawn') xz = spawn || (spawn = i32(w.sm_spawn(), 2));
      else {
        const p = w.sm_structs(t, m.x0, m.z0, m.x1, m.z1);
        xz = i32(p + 4, i32(p, 1)[0] * 2);
      }
      const keep = [];
      for (let i = 0; i < xz.length; i += 2)
        if (xz[i] >= m.x0 && xz[i] < m.x1 && xz[i + 1] >= m.z0 && xz[i + 1] < m.z1) keep.push(xz[i], xz[i + 1]);
      out[t] = keep;
    }
    return { out };
  },
  // All 128 (~3 s of biome checks): asked once per world by the page, not per tile.
  strongholds() {
    return { xz: i32(w.sm_strongholds(128), 256) };
  },
  slime(m) {
    return { cells: u8(w.sm_slime(m.cx, m.cz, m.n, m.n), m.n * m.n) };
  },
};

onmessage = async (e) => {
  await ready;
  const m = e.data;
  world(m);
  const r = ops[m.op](m);
  r.id = m.id;
  postMessage(r, [r.px, r.ids, r.cells].filter(Boolean).map((a) => a.buffer));
};
