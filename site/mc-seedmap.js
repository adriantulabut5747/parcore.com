// SEED MAP (Oct 22 2026) -- /minecraft/tools/seed-map.
// Biomes + structures for any Java seed, generated in the browser: mc-seedmap-worker.js runs
// cubiomes (mc-seedmap.wasm), Leaflet (/leaflet/) does pan/zoom. Three layers, all Leaflet
// GridLayers so Leaflet decides what to draw: biomes (canvas), slime chunks (canvas),
// structures (a div of icons per tile). Map units: 1 = 1 block; lat = -z so south is down.
// State lives in the address: #seed=..&v=..&dim=..&x=..&z=..&zoom=..
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const mapEl = $('smMap');
  if (!mapEl || !window.L) return;

  // cubiomes MCVersion numbers (biomes.h). 1.18 = the modern terrain; older isn't offered.
  const VERSIONS = [
    ['1.21.4', 28, '1.21.4'],
    ['1.21.3', 27, '1.21.2 – 1.21.3'],
    ['1.21.1', 26, '1.21 – 1.21.1'],
    ['1.20', 25, '1.20'],
    ['1.19.4', 24, '1.19.3 – 1.19.4'],
    ['1.19.2', 23, '1.19 – 1.19.2'],
    ['1.18', 22, '1.18'],
  ];
  const DIMS = { overworld: 0, nether: -1, end: 1 };
  // t = cubiomes StructureType (finders.h); z = lowest zoom the icons show at (denser = higher).
  const STRUCTS = [
    { t: 'spawn', name: 'World spawn', icon: 'compass', dim: 0, z: -6, on: true },
    { t: 'stronghold', name: 'Stronghold', icon: 'ender_eye', dim: 0, z: -6, on: true },
    { t: 5, name: 'Village', icon: 'bell', dim: 0, z: -3, on: true },
    { t: 10, name: 'Pillager outpost', icon: 'crossbow', dim: 0, z: -3, on: true },
    { t: 9, name: 'Woodland mansion', icon: 'totem_of_undying', dim: 0, z: -5, on: true },
    { t: 8, name: 'Ocean monument', icon: 'prismarine_shard', dim: 0, z: -3, on: true },
    { t: 13, name: 'Ancient city', icon: 'echo_shard', dim: 0, z: -3, on: true },
    { t: 24, name: 'Trial chambers', icon: 'trial_key', dim: 0, z: -3, on: true },
    { t: 23, name: 'Trail ruins', icon: 'brush', dim: 0, z: -3, on: true },
    { t: 1, name: 'Desert pyramid', icon: 'chiseled_sandstone', dim: 0, z: -3, on: true },
    { t: 2, name: 'Jungle temple', icon: 'mossy_cobblestone', dim: 0, z: -3, on: true },
    { t: 3, name: 'Swamp hut', icon: 'cauldron', dim: 0, z: -3, on: true },
    { t: 4, name: 'Igloo', icon: 'snow_block', dim: 0, z: -3, on: true },
    { t: 7, name: 'Shipwreck', icon: 'oak_boat', dim: 0, z: -3, on: true },
    { t: 6, name: 'Ocean ruins', icon: 'suspicious_gravel', dim: 0, z: -2, on: false },
    { t: 11, name: 'Ruined portal', icon: 'crying_obsidian', dim: 0, z: -3, on: false },
    { t: 14, name: 'Buried treasure', icon: 'heart_of_the_sea', dim: 0, z: -1, on: false },
    { t: 18, name: 'Nether fortress', icon: 'nether_brick', dim: -1, z: -3, on: true },
    { t: 19, name: 'Bastion remnant', icon: 'gilded_blackstone', dim: -1, z: -3, on: true },
    { t: 12, name: 'Ruined portal', icon: 'crying_obsidian', dim: -1, z: -3, on: true },
    { t: 20, name: 'End city', icon: 'shulker_shell', dim: 1, z: -3, on: true },
  ];
  const ICON = (s) => '/minecrafticons/items/' + s.icon + '.png';
  let strongholds = null; // this world's 128 (x,z pairs), worked out once by one worker
  const SLIME_Z = -1; // chunks are 8px here; any smaller is noise

  // ---- worker pool ----
  const N = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));
  const idle = [], queue = [];
  for (let i = 0; i < N; i++) {
    const wk = new Worker('/mc-seedmap-worker.js?v=1');
    wk.onmessage = (e) => {
      const job = wk.job;
      wk.job = null;
      idle.push(wk);
      if (!(job.dead && job.dead())) job.cb(e.data); // a late answer for a removed tile would mark its replacement loaded
      pump();
    };
    idle.push(wk);
  }
  function pump() {
    while (idle.length && queue.length) {
      const job = queue.shift();
      if (job.dead && job.dead()) continue; // tile scrolled away before its turn
      const wk = idle.pop();
      wk.job = job;
      wk.postMessage(job.msg);
    }
  }
  // msg gets the current world stamped on; dead() lets a queued job be skipped.
  function run(msg, cb, dead) {
    Object.assign(msg, { mc: st.mc, dim: DIMS[st.dim], seed: st.seed });
    queue.push({ msg, cb, dead });
    pump();
  }

  // ---- state ----
  const st = { seed: '0', ver: VERSIONS[0][0], mc: VERSIONS[0][1], dim: 'overworld', show: {} };
  STRUCTS.forEach((s) => (st.show[s.dim + ':' + s.t] = s.on));
  st.show.slime = false;

  // Java's rule: a whole number in range is the seed itself, anything else is String.hashCode().
  function parseSeed(s) {
    s = s.trim();
    if (!s) return null;
    if (/^[+-]?\d+$/.test(s)) {
      const b = BigInt(s);
      if (b >= -(2n ** 63n) && b < 2n ** 63n) return b.toString();
    }
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return String(h);
  }
  const randomSeed = () => crypto.getRandomValues(new BigInt64Array(1))[0].toString();

  // ---- map ----
  const map = L.map(mapEl, {
    crs: L.CRS.Simple,
    minZoom: -6,
    maxZoom: 3,
    zoomSnap: 0.5,
    attributionControl: false,
    zoomControl: false,
  });
  L.control.zoom({ position: 'topright' }).addTo(map);
  const ll = (x, z) => L.latLng(-z, x);
  const tileSpan = (z) => 256 / 2 ** z; // blocks across one 256px tile

  function markDead(e) {
    e.tile._dead = true;
  }

  // Biomes: the coarsest cubiomes scale that still gives >= 1 sample per 2px.
  const Biomes = L.GridLayer.extend({
    createTile(c, done) {
      const span = tileSpan(c.z);
      const scale = [1, 4, 16, 64, 256].find((s) => span / s <= 128) || 256;
      const n = Math.max(1, span / scale);
      const t = document.createElement('canvas');
      t.width = t.height = n; // CSS stretches it to 256px, pixelated
      run({ op: 'tile', scale, x: c.x * n, z: c.y * n, n }, (r) => {
        t.getContext('2d').putImageData(new ImageData(r.px, n, n), 0, 0);
        done(null, t);
      }, () => t._dead);
      return t;
    },
  });

  const Slime = L.GridLayer.extend({
    createTile(c, done) {
      const t = document.createElement('canvas');
      t.width = t.height = 256;
      if (c.z < SLIME_Z) return setTimeout(done, 0, null, t), t;
      const n = tileSpan(c.z) / 16, px = 256 / n;
      run({ op: 'slime', cx: c.x * n, cz: c.y * n, n }, (r) => {
        const g = t.getContext('2d');
        g.fillStyle = 'rgba(92, 214, 64, 0.55)';
        g.strokeStyle = 'rgba(20, 60, 10, 0.8)';
        for (let i = 0; i < r.cells.length; i++)
          if (r.cells[i]) {
            g.fillRect((i % n) * px, Math.floor(i / n) * px, px, px);
            if (px >= 8) g.strokeRect((i % n) * px + 0.5, Math.floor(i / n) * px + 0.5, px - 1, px - 1);
          }
        done(null, t);
      }, () => t._dead);
      return t;
    },
  });

  const Structs = L.GridLayer.extend({
    createTile(c, done) {
      const t = document.createElement('div');
      const span = tileSpan(c.z), x0 = c.x * span, z0 = c.y * span;
      const list = STRUCTS.filter((s) => s.dim === DIMS[st.dim] && st.show[s.dim + ':' + s.t] && c.z >= s.z);
      if (!list.length) return setTimeout(done, 0, null, t), t;
      run({ op: 'structs', types: list.map((s) => s.t).filter((t) => t !== 'stronghold'), x0, z0, x1: x0 + span, z1: z0 + span }, (r) => {
        const sh = (r.out.stronghold = []);
        for (let i = 0; strongholds && i < strongholds.length; i += 2)
          if (strongholds[i] >= x0 && strongholds[i] < x0 + span && strongholds[i + 1] >= z0 && strongholds[i + 1] < z0 + span) sh.push(strongholds[i], strongholds[i + 1]);
        let html = '';
        for (const s of list) {
          const xz = r.out[s.t];
          for (let i = 0; i < xz.length; i += 2)
            html += '<img class="sm-pin" src="' + ICON(s) + '" alt="" draggable="false" data-t="' + s.t + '" data-x="' + xz[i] + '" data-z="' + xz[i + 1] +
              '" style="left:' + ((xz[i] - x0) / span) * 256 + 'px;top:' + ((xz[i + 1] - z0) / span) * 256 + 'px" title="' + s.name + ' · ' + xz[i] + ', ' + xz[i + 1] + '">';
        }
        t.innerHTML = html;
        done(null, t);
      }, () => t._dead);
      return t;
    },
  });

  // GridLayers default to minZoom 0 and drop every tile below it; the map goes to -6.
  const Z = { minZoom: -6, maxZoom: 3 };
  map.createPane('sm-slime').style.zIndex = 300;
  map.createPane('sm-structs').style.zIndex = 450;
  const biomes = new Biomes({ ...Z, keepBuffer: 1 }).on('tileunload', markDead).addTo(map);
  const slime = new Slime({ ...Z, pane: 'sm-slime' }).on('tileunload', markDead);
  const structs = new Structs({ ...Z, pane: 'sm-structs', keepBuffer: 1 }).on('tileunload', markDead).addTo(map);

  // ---- structure popup: name, coords, Copy /tp ----
  let downAt = null;
  mapEl.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
  mapEl.addEventListener('click', (e) => {
    const pin = e.target.closest('.sm-pin');
    if (!pin || (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5)) return;
    const s = STRUCTS.find((s) => String(s.t) === pin.dataset.t && s.dim === DIMS[st.dim]);
    const x = +pin.dataset.x, z = +pin.dataset.z, cmd = '/tp @s ' + x + ' ~ ' + z;
    L.popup({ offset: [0, -10], closeButton: false, className: 'sm-pop' })
      .setLatLng(ll(x, z))
      .setContent('<b>' + s.name + '</b><span>X ' + x + ' · Z ' + z + '</span><button type="button" class="mt-btn sm-tp" data-cmd="' + cmd + '">Copy /tp</button>')
      .openOn(map);
  });
  mapEl.addEventListener('click', (e) => {
    const b = e.target.closest('.sm-tp');
    if (!b) return;
    navigator.clipboard.writeText(b.dataset.cmd).then(() => (b.textContent = 'Copied'), () => {});
  });

  // ---- cursor readout: X / Z / biome (one biome ask in flight, latest wins) ----
  const read = $('smRead');
  let want = null, asking = false;
  const pretty = (n) => n.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  function ask() {
    if (asking || !want) return;
    const [x, z] = want;
    want = null;
    asking = true;
    run({ op: 'biome', x, z }, (r) => {
      asking = false;
      read.innerHTML = '<span>X <b>' + x + '</b></span><span>Z <b>' + z + '</b></span><span class="sm-biome">' + pretty(r.name) + '</span>';
      ask();
    });
  }
  map.on('mousemove', (e) => {
    want = [Math.floor(e.latlng.lng), Math.floor(-e.latlng.lat)];
    ask();
  });

  // ---- controls ----
  const seedIn = $('smSeed'), verSel = $('smVer'), dimSeg = $('smDim'), showList = $('smShow');
  verSel.innerHTML = VERSIONS.map((v) => '<option value="' + v[0] + '">Java ' + v[2] + '</option>').join('');

  function renderShow() {
    const d = DIMS[st.dim];
    const rows = STRUCTS.filter((s) => s.dim === d).map((s) => [s.dim + ':' + s.t, s.name, ICON(s)]);
    if (d === 0) rows.push(['slime', 'Slime chunks', '/minecrafticons/items/slime_ball.png']);
    showList.innerHTML = rows
      .map((r) => '<label class="mt-tg mt-tg--sm sm-tg"><input type="checkbox" data-k="' + r[0] + '"' + (st.show[r[0]] ? ' checked' : '') +
        '><span class="mt-sw"></span><img src="' + r[2] + '" alt="" width="20" height="20"><span>' + r[1] + '</span></label>')
      .join('');
  }
  showList.addEventListener('change', (e) => {
    const k = e.target.dataset.k;
    st.show[k] = e.target.checked;
    if (k === 'slime') syncSlime();
    else structs.redraw();
  });
  function syncSlime() {
    const on = st.show.slime && st.dim === 'overworld';
    if (on && !map.hasLayer(slime)) slime.addTo(map);
    if (!on && map.hasLayer(slime)) map.removeLayer(slime);
  }

  // Redraw everything for a new world. Queued jobs for the old one die with their tiles.
  function setWorld() {
    queue.length = 0;
    seedIn.value = st.seed;
    verSel.value = st.ver;
    dimSeg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dim === st.dim)));
    renderShow();
    syncSlime();
    strongholds = null;
    biomes.redraw();
    structs.redraw();
    if (map.hasLayer(slime)) slime.redraw();
    // Queued after the visible tiles so they draw first; the icons join when it lands.
    if (st.dim === 'overworld') {
      const key = st.mc + '/' + st.seed;
      run({ op: 'strongholds' }, (r) => {
        if (key !== st.mc + '/' + st.seed) return;
        strongholds = r.xz;
        structs.redraw();
      });
    }
    save();
  }

  function applySeed() {
    const s = parseSeed(seedIn.value);
    if (s === null) return;
    if (s !== st.seed) {
      st.seed = s;
      setWorld();
    }
  }
  seedIn.addEventListener('keydown', (e) => e.key === 'Enter' && applySeed());
  seedIn.addEventListener('change', applySeed);
  $('smRandom').addEventListener('click', () => {
    st.seed = randomSeed();
    setWorld();
  });
  verSel.addEventListener('change', () => {
    st.ver = verSel.value;
    st.mc = VERSIONS.find((v) => v[0] === st.ver)[1];
    setWorld();
  });
  dimSeg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.dataset.dim === st.dim) return;
    st.dim = b.dataset.dim;
    setWorld();
  });
  $('smGo').addEventListener('submit', (e) => {
    e.preventDefault();
    const x = parseInt($('smX').value, 10), z = parseInt($('smZ').value, 10);
    if (isFinite(x) && isFinite(z)) map.setView(ll(x, z), Math.max(map.getZoom(), 0));
  });
  $('smShare').addEventListener('click', (e) => {
    const b = e.currentTarget, label = b.querySelector('span');
    navigator.clipboard.writeText(location.href).then(() => {
      label.textContent = 'Link copied';
      setTimeout(() => (label.textContent = 'Share'), 1600);
    }, () => {});
  });

  // ---- address <-> state ----
  function save() {
    const c = map.getCenter();
    const q = new URLSearchParams({ seed: st.seed, v: st.ver, dim: st.dim, x: Math.round(c.lng), z: Math.round(-c.lat), zoom: map.getZoom() });
    history.replaceState(null, '', '#' + q);
  }
  map.on('moveend', save);

  const q = new URLSearchParams(location.hash.slice(1));
  st.seed = (q.get('seed') && parseSeed(q.get('seed'))) || randomSeed();
  const v = VERSIONS.find((v) => v[0] === q.get('v'));
  if (v) (st.ver = v[0]), (st.mc = v[1]);
  if (q.get('dim') in DIMS) st.dim = q.get('dim');
  const num = (k, d) => (isFinite(parseFloat(q.get(k))) ? parseFloat(q.get(k)) : d);
  map.setView(ll(num('x', 0), num('z', 0)), Math.min(3, Math.max(-6, num('zoom', -1))));
  setWorld();
})();
