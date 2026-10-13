/* Coordinate calculator (Oct 13 2026), /minecraft/tools/coordinates.
   Overworld <-> Nether (X and Z divide by 8, rounded down; multiply back by 8; Y
   is never scaled), chunk + region file, distance and travel time between two
   points, F3 paste, and a slime chunk map from the world seed.
   Slime chunks: the Java formula from the 26.3 game files
   (WorldgenRandom.seedSlimeChunk + Slime.class, salt 987234911), run on the same
   48-bit generator as java.util.Random. It was checked against Java's own
   Random (scratch test, Oct 13). Bedrock picks slime chunks a different way.
   Copy buttons: mc-home.js (.mch-copy[data-copy]). Styles: COORDINATES block
   in mc-home.css (.crd-*). */
var McSlime = (function () {
  var MASK = (1n << 48n) - 1n;
  var MULT = 0x5DEECE66Dn;
  function i32(n) { return Number(BigInt.asIntN(32, BigInt(n))); }
  function imul(a, b) { return Math.imul(a, b); }
  // java.util.Random(seed).nextInt(10) == 0
  function slime(seed, x, z) {
    var s = BigInt.asIntN(64, BigInt(seed) + BigInt(imul(imul(x, x), 4987142)) + BigInt(imul(x, 5947611)) +
      BigInt(imul(z, z)) * 4392871n + BigInt(imul(z, 389711)));
    s = BigInt.asIntN(64, s ^ 987234911n);
    var r = (s ^ MULT) & MASK;
    for (;;) {
      r = (r * MULT + 0xBn) & MASK;
      var u = i32(r >> 17n); // next(31)
      var m = u % 10;
      if (((u - m + 9) | 0) >= 0) return m === 0;
    }
  }
  // A seed typed as text becomes Java's String.hashCode, like the world creation screen.
  function parseSeed(v) {
    v = String(v == null ? '' : v).trim();
    if (!v) return null;
    if (/^-?\d+$/.test(v)) {
      var b = BigInt(v);
      if (b >= -(1n << 63n) && b < (1n << 63n)) return b;
    }
    var h = 0;
    for (var i = 0; i < v.length; i++) h = (Math.imul(31, h) + v.charCodeAt(i)) | 0;
    return BigInt(h);
  }
  return { slime: slime, parseSeed: parseSeed };
})();
if (typeof module !== 'undefined') module.exports = McSlime;

(function () {
  if (typeof document === 'undefined') return;
  var root = document.getElementById('crdOw');
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var s = { from: 'ow', ow: [0, 64, 0], ne: [0, 64, 0], b: null, seed: null, map: 'slime' };

  function num(v) { var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; }
  function fl(n) { return Math.floor(n); }
  function fmt(n) { return (Math.round(n * 10) / 10).toLocaleString('en-US'); }
  function setInputs(id, p) {
    var box = $(id);
    ['x', 'y', 'z'].forEach(function (k, i) {
      var inp = box.querySelector('[data-axis="' + k + '"]');
      if (document.activeElement !== inp) inp.value = p[i];
    });
  }
  function read(id) {
    var box = $(id);
    return ['x', 'y', 'z'].map(function (k) { return num(box.querySelector('[data-axis="' + k + '"]').value); });
  }
  function convert() {
    if (s.from === 'ow') s.ne = [fl(s.ow[0] / 8), fl(s.ow[1]), fl(s.ow[2] / 8)];
    else s.ow = [fl(s.ne[0]) * 8, fl(s.ne[1]), fl(s.ne[2]) * 8];
  }
  function block(p) { return [fl(p[0]), fl(p[1]), fl(p[2])]; }
  function chunkOf(p) { var b = block(p); return [b[0] >> 4, b[2] >> 4]; }
  function cmd(dim, p) {
    return '/execute in minecraft:' + dim + ' run tp @s ' + p[0] + ' ' + p[1] + ' ' + p[2];
  }

  // ---- distance ----
  // Walking 4.317 and sprinting 5.612 blocks a second on flat ground (the wiki's
  // measured speeds); a Nether trip covers 1/8 of the Overworld distance.
  function travel(d) {
    var t = d / 5.612;
    if (t < 60) return Math.round(t) + ' s sprinting';
    var m = Math.floor(t / 60), x = Math.round(t % 60);
    return m + ' min ' + (x ? x + ' s ' : '') + 'sprinting';
  }

  // ---- slime map ----
  var R = 7; // 15 x 15 chunks around you
  function drawMap() {
    var cv = $('crdMap'), ctx = cv.getContext('2d');
    var c = chunkOf(s.ow), size = 2 * R + 1, cell = cv.width / size;
    ctx.clearRect(0, 0, cv.width, cv.height);
    var count = 0;
    for (var dz = -R; dz <= R; dz++) for (var dx = -R; dx <= R; dx++) {
      var x = c[0] + dx, z = c[1] + dz, px = (dx + R) * cell, pz = (dz + R) * cell;
      var on = s.seed != null && McSlime.slime(s.seed, x, z);
      if (on) count++;
      ctx.fillStyle = on ? '#6fbf4a' : ((x + z) & 1 ? 'rgba(80,60,30,0.10)' : 'rgba(80,60,30,0.04)');
      ctx.fillRect(px + 1, pz + 1, cell - 2, cell - 2);
      if (on) { ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(px + 1, pz + 1, cell - 2, 3); }
    }
    // you
    ctx.strokeStyle = '#2b1d0e';
    ctx.lineWidth = 3;
    ctx.strokeRect(R * cell + 1.5, R * cell + 1.5, cell - 3, cell - 3);
    $('crdMapPin').style.left = ((R + 0.5) / size * 100) + '%';
    $('crdMapPin').style.top = ((R + 0.5) / size * 100) + '%';
    $('crdMapCount').textContent = s.seed == null ? 'Enter your seed to see them' : count + ' slime chunks in this 15 x 15 area';
  }

  function render() {
    convert();
    if (s.from === 'ow') setInputs('crdNe', s.ne); else setInputs('crdOw', s.ow);
    var ow = block(s.ow), ne = block(s.ne);
    var src = s.from === 'ow' ? ow : ne, dst = s.from === 'ow' ? ne : ow;
    $('crdOutK').textContent = s.from === 'ow' ? 'Build the Nether portal at' : 'Build the Overworld portal at';
    $('crdOutWorld').className = 'crd-out-world is-' + (s.from === 'ow' ? 'ne' : 'ow');
    ['x', 'y', 'z'].forEach(function (k, i) { $('crdOut' + k.toUpperCase()).textContent = dst[i].toLocaleString('en-US'); });
    $('crdOutFrom').textContent = 'From ' + (s.from === 'ow' ? 'Overworld ' : 'Nether ') + src.join(', ');

    var tpOw = cmd('overworld', ow), tpNe = cmd('the_nether', ne);
    $('crdTpOw').textContent = tpOw; $('crdTpOwCopy').setAttribute('data-copy', tpOw);
    $('crdTpNe').textContent = tpNe; $('crdTpNeCopy').setAttribute('data-copy', tpNe);

    // chunk facts for the Overworld point
    var c = chunkOf(ow);
    $('crdChunk').textContent = c[0] + ', ' + c[1];
    $('crdInChunk').textContent = (ow[0] & 15) + ', ' + (ow[2] & 15);
    $('crdChunkFrom').textContent = (c[0] * 16) + ', ' + (c[1] * 16) + ' to ' + (c[0] * 16 + 15) + ', ' + (c[1] * 16 + 15);
    $('crdRegion').textContent = 'r.' + (c[0] >> 5) + '.' + (c[1] >> 5) + '.mca';
    $('crdSection').textContent = String(ow[1] >> 4);
    var cn = chunkOf(ne);
    $('crdChunkNe').textContent = cn[0] + ', ' + cn[1];

    // slime verdict
    var v = $('crdSlime');
    if (s.seed == null) { v.className = 'crd-slime'; v.innerHTML = '<b>Slime chunk?</b><span>Add your world seed to check.</span>'; }
    else {
      var yes = McSlime.slime(s.seed, c[0], c[1]);
      v.className = 'crd-slime ' + (yes ? 'is-yes' : 'is-no');
      v.innerHTML = '<b>' + (yes ? 'Slime chunk' : 'Not a slime chunk') + '</b><span>Chunk ' + c[0] + ', ' + c[1] + (yes ? ': slimes spawn here below Y 40 in any light.' : '. The map shows the nearest ones.') + '</span>';
    }
    drawMap();

    // distance
    if (s.b) {
      var dx = s.b[0] - ow[0], dy = s.b[1] - ow[1], dz = s.b[2] - ow[2];
      var flat = Math.sqrt(dx * dx + dz * dz), full = Math.sqrt(dx * dx + dy * dy + dz * dz);
      $('crdDist').innerHTML =
        '<div><dt>Straight line</dt><dd>' + fmt(full) + ' blocks</dd></div>' +
        '<div><dt>Flat (X and Z)</dt><dd>' + fmt(flat) + ' blocks</dd></div>' +
        '<div><dt>On foot</dt><dd>' + travel(flat) + '</dd></div>' +
        '<div><dt>Through the Nether</dt><dd>' + fmt(flat / 8) + ' blocks, ' + travel(flat / 8) + '</dd></div>' +
        '<div><dt>Direction</dt><dd>' + heading(dx, dz) + '</dd></div>';
    } else $('crdDist').innerHTML = '<p class="crd-hint">Type a second point to measure the trip to it.</p>';
  }
  // Minecraft's compass: south is +Z, east is +X. Yaw 0 = south.
  function heading(dx, dz) {
    if (!dx && !dz) return 'Same spot';
    var yaw = Math.atan2(-dx, dz) * 180 / Math.PI;
    var names = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east'];
    return names[((Math.round(yaw / 45) % 8) + 8) % 8] + ' (yaw ' + Math.round(yaw) + '°)';
  }

  // ---- input ----
  function onInput(which) {
    return function (e) {
      if (!e.target.matches('[data-axis]')) return;
      s.from = which;
      if (which === 'ow') s.ow = read('crdOw'); else s.ne = read('crdNe');
      document.querySelectorAll('.crd-world').forEach(function (w) { w.classList.toggle('is-src', w.id === (which === 'ow' ? 'crdOw' : 'crdNe')); });
      render();
    };
  }
  $('crdOw').addEventListener('input', onInput('ow'));
  $('crdNe').addEventListener('input', onInput('ne'));
  $('crdB').addEventListener('input', function () {
    var v = read('crdB'), any = [].some.call(this.querySelectorAll('input'), function (i) { return i.value.trim() !== ''; });
    s.b = any ? v : null;
    render();
  });
  $('crdSeed').addEventListener('input', function () {
    s.seed = McSlime.parseSeed(this.value);
    $('crdSeedNote').textContent = s.seed == null ? '' : (/^-?\d+$/.test(this.value.trim()) ? 'Number seed' : 'Text seed, read as ' + s.seed.toString());
    render();
  });
  // F3 paste: "XYZ: 12.3 / 64 / -5.7", F3+C "/execute in minecraft:the_nether run tp @s 1 2 3 ...", or three numbers.
  $('crdPaste').addEventListener('input', function () {
    var v = this.value, msg = $('crdPasteMsg');
    if (!v.trim()) { msg.textContent = ''; return; }
    var nether = /the_nether/.test(v);
    var m = v.match(/XYZ:\s*(-?[\d.]+)\s*\/\s*(-?[\d.]+)\s*\/\s*(-?[\d.]+)/) || v.match(/tp\s+@s\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/) || v.match(/(-?[\d.]+)[\s,/]+(-?[\d.]+)[\s,/]+(-?[\d.]+)/);
    if (!m) { msg.textContent = 'No coordinates found. Paste the XYZ line from F3, or press F3 + C in game and paste.'; msg.className = 'crd-paste-msg is-error'; return; }
    var p = [num(m[1]), num(m[2]), num(m[3])];
    s.from = nether ? 'ne' : 'ow';
    if (nether) { s.ne = p; setInputs('crdNe', block(p)); } else { s.ow = p; setInputs('crdOw', block(p)); }
    document.querySelectorAll('.crd-world').forEach(function (w) { w.classList.toggle('is-src', w.id === (nether ? 'crdNe' : 'crdOw')); });
    msg.textContent = 'Read ' + (nether ? 'Nether' : 'Overworld') + ' ' + block(p).join(', ') + '.';
    msg.className = 'crd-paste-msg';
    render();
  });
  $('crdSwap').addEventListener('click', function () {
    // jump to the other side: the converted point becomes the one you edit
    s.from = s.from === 'ow' ? 'ne' : 'ow';
    setInputs(s.from === 'ow' ? 'crdOw' : 'crdNe', s.from === 'ow' ? block(s.ow) : block(s.ne));
    document.querySelectorAll('.crd-world').forEach(function (w) { w.classList.toggle('is-src', w.id === (s.from === 'ow' ? 'crdOw' : 'crdNe')); });
    render();
  });
  // click a chunk on the map: move there
  $('crdMap').addEventListener('click', function (e) {
    var r = this.getBoundingClientRect(), size = 2 * R + 1;
    var dx = Math.floor((e.clientX - r.left) / r.width * size) - R, dz = Math.floor((e.clientY - r.top) / r.height * size) - R;
    var c = chunkOf(s.ow);
    s.from = 'ow';
    s.ow = [(c[0] + dx) * 16 + 8, s.ow[1], (c[1] + dz) * 16 + 8];
    setInputs('crdOw', block(s.ow));
    document.querySelectorAll('.crd-world').forEach(function (w) { w.classList.toggle('is-src', w.id === 'crdOw'); });
    render();
  });

  render();
})();
