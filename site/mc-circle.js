/* Pixel circle generator (Oct 13 2026), /minecraft/tools/circle.
   Circle, ellipse, sphere and dome blueprints, block by block.
   A block is in the shape when its centre is inside the ellipse/ellipsoid
   (x/rx)^2 + (y/ry)^2 (+ (z/rz)^2) <= 1, with r = size / 2.
     thin outline   shape blocks with a side (4-way) neighbour outside: fewest blocks
     thick outline  shape blocks with any (8-way) neighbour outside: no diagonal gaps
     hollow sphere  shape blocks with a face (6-way) neighbour outside
   Spheres and domes are shown one layer at a time, counted from the bottom.
   Styles: PIXEL CIRCLE block in mc-home.css (.cir-*). */
var McCircle = (function () {
  function inside2(x, y, w, h) {
    var dx = (x - (w - 1) / 2) / (w / 2), dy = (y - (h - 1) / 2) / (h / 2);
    return dx * dx + dy * dy <= 1;
  }
  function inside3(x, y, z, d) {
    var c = (d - 1) / 2, r = d / 2;
    var a = (x - c) / r, b = (y - c) / r, e = (z - c) / r;
    return a * a + b * b + e * e <= 1;
  }
  // 2D: rows of 0/1, h rows by w columns
  function flat(w, h, style) {
    var g = [];
    for (var y = 0; y < h; y++) {
      var row = [];
      for (var x = 0; x < w; x++) {
        var on = inside2(x, y, w, h);
        if (on && style !== 'filled') {
          var out = function (a, b) { return a < 0 || b < 0 || a >= w || b >= h || !inside2(a, b, w, h); };
          var edge = out(x - 1, y) || out(x + 1, y) || out(x, y - 1) || out(x, y + 1);
          if (style === 'thick') edge = edge || out(x - 1, y - 1) || out(x + 1, y - 1) || out(x - 1, y + 1) || out(x + 1, y + 1);
          on = edge;
        }
        row.push(on ? 1 : 0);
      }
      g.push(row);
    }
    return g;
  }
  // 3D: layer y (0 = bottom) of a d-wide sphere, as a d x d grid
  function layer(d, y, style) {
    var g = [];
    for (var z = 0; z < d; z++) {
      var row = [];
      for (var x = 0; x < d; x++) {
        var on = inside3(x, y, z, d);
        if (on && style !== 'filled') {
          var out = function (a, b, c) { return a < 0 || b < 0 || c < 0 || a >= d || b >= d || c >= d || !inside3(a, b, c, d); };
          on = out(x - 1, y, z) || out(x + 1, y, z) || out(x, y - 1, z) || out(x, y + 1, z) || out(x, y, z - 1) || out(x, y, z + 1);
        }
        row.push(on ? 1 : 0);
      }
      g.push(row);
    }
    return g;
  }
  function count(g) { return g.reduce(function (n, r) { return n + r.reduce(function (a, b) { return a + b; }, 0); }, 0); }
  return { flat: flat, layer: layer, count: count };
})();
if (typeof module !== 'undefined') module.exports = McCircle;

(function () {
  if (typeof document === 'undefined') return;
  var cv = document.getElementById('cirCanvas');
  if (!cv) return;
  var $ = function (id) { return document.getElementById(id); };
  var s = { shape: 'circle', w: 31, h: 21, d: 21, style: 'thin', layer: 10, zoom: 0, nums: true, centre: true, ghost: true, hover: null };
  var MAX = 255;
  var ctx = cv.getContext('2d');
  var grid = [], under = null;

  function is3() { return s.shape === 'sphere' || s.shape === 'dome'; }
  function layers() { return s.shape === 'dome' ? Math.ceil(s.d / 2) : s.d; }
  // dome layers are the top half of the sphere, renumbered from 0 at the floor
  function realY(i) { return s.shape === 'dome' ? i + Math.floor(s.d / 2) : i; }
  function size() {
    if (is3()) return [s.d, s.d];
    return s.shape === 'circle' ? [s.w, s.w] : [s.w, s.h];
  }
  function build() {
    if (is3()) {
      grid = McCircle.layer(s.d, realY(s.layer), s.style === 'filled' ? 'filled' : 'hollow');
      under = s.layer > 0 ? McCircle.layer(s.d, realY(s.layer - 1), s.style === 'filled' ? 'filled' : 'hollow') : null;
    } else {
      var z = size();
      grid = McCircle.flat(z[0], z[1], s.style);
      under = null;
    }
  }
  function stacks(n) {
    var st = Math.floor(n / 64), r = n % 64;
    return st ? st + (st === 1 ? ' stack' : ' stacks') + (r ? ' + ' + r : '') : r + ' blocks';
  }

  // ---- drawing ----
  var PAD = 26; // room for the numbers
  function cellPx() {
    var z = size(), stage = $('cirStage');
    var fit = Math.max(2, Math.floor(Math.min(stage.clientWidth - 2 * PAD, Math.max(320, stage.clientHeight - 2 * PAD)) / Math.max(z[0], z[1])));
    return s.zoom ? Math.max(2, Math.round(fit * s.zoom)) : fit;
  }
  function paint(target, c, opts) {
    var z = size(), W = z[0], H = z[1], pad = opts.nums ? PAD : 6;
    target.width = W * c + 2 * pad;
    target.height = H * c + 2 * pad;
    var x = target.getContext('2d');
    x.fillStyle = '#0f1013';
    x.fillRect(0, 0, target.width, target.height);
    // previous layer, faint, to line the new one up
    if (opts.ghost && under) {
      x.fillStyle = 'rgba(255,255,255,0.08)';
      for (var gy = 0; gy < H; gy++) for (var gx = 0; gx < W; gx++) if (under[gy][gx]) x.fillRect(pad + gx * c, pad + gy * c, c, c);
    }
    for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) {
      if (!grid[yy][xx]) continue;
      x.fillStyle = '#d6d9de';
      x.fillRect(pad + xx * c, pad + yy * c, c, c);
      if (c >= 8) { // a block's bevel
        x.fillStyle = 'rgba(255,255,255,0.55)'; x.fillRect(pad + xx * c, pad + yy * c, c, 1);
        x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(pad + xx * c, pad + yy * c + c - 1, c, 1);
      }
    }
    if (c >= 4) {
      x.strokeStyle = 'rgba(255,255,255,0.07)';
      x.lineWidth = 1;
      x.beginPath();
      for (var i = 0; i <= W; i++) { x.moveTo(pad + i * c + 0.5, pad); x.lineTo(pad + i * c + 0.5, pad + H * c); }
      for (var j = 0; j <= H; j++) { x.moveTo(pad, pad + j * c + 0.5); x.lineTo(pad + W * c, pad + j * c + 0.5); }
      x.stroke();
      // every 5th line a little brighter, for counting
      x.strokeStyle = 'rgba(255,255,255,0.16)';
      x.beginPath();
      for (i = 0; i <= W; i += 5) { x.moveTo(pad + i * c + 0.5, pad); x.lineTo(pad + i * c + 0.5, pad + H * c); }
      for (j = 0; j <= H; j += 5) { x.moveTo(pad, pad + j * c + 0.5); x.lineTo(pad + W * c, pad + j * c + 0.5); }
      x.stroke();
    }
    if (opts.centre) {
      x.fillStyle = 'rgba(232,106,106,0.85)';
      var cx = W / 2 * c + pad, cy = H / 2 * c + pad;
      x.fillRect(cx - 1, pad, 2, H * c);
      x.fillRect(pad, cy - 1, W * c, 2);
    }
    if (opts.nums) {
      x.fillStyle = '#80858c';
      x.font = '600 11px Sora, sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      for (i = 0; i < W; i += 5) x.fillText(String(i), pad + i * c + c / 2, pad / 2);
      x.textAlign = 'right';
      for (j = 0; j < H; j += 5) x.fillText(String(j), pad - 6, pad + j * c + c / 2);
    }
    if (opts.hover) {
      x.strokeStyle = '#fff';
      x.lineWidth = 2;
      x.strokeRect(pad + opts.hover[0] * c + 1, pad + opts.hover[1] * c + 1, c - 2, c - 2);
    }
    return pad;
  }
  var lastPad = PAD, lastC = 8;
  function draw() {
    lastC = cellPx();
    lastPad = paint(cv, lastC, { nums: s.nums, centre: s.centre, ghost: s.ghost && is3(), hover: s.hover });
  }

  // side view of a sphere/dome: one bar per layer, click to pick it
  function drawProfile() {
    var box = $('cirProfile');
    if (!is3()) { box.innerHTML = ''; return; }
    var n = layers(), html = '';
    for (var i = n - 1; i >= 0; i--) {
      var g = McCircle.layer(s.d, realY(i), 'filled'), wide = 0;
      g.forEach(function (r) { wide = Math.max(wide, r.reduce(function (a, b) { return a + b; }, 0)); });
      html += '<button type="button" data-layer="' + i + '" aria-pressed="' + (i === s.layer) + '" aria-label="Layer ' + (i + 1) + '"><i style="width:' + (wide / s.d * 100) + '%"></i></button>';
    }
    box.innerHTML = html;
  }
  function drawIcons() {
    document.querySelectorAll('canvas[data-icon]').forEach(function (c) {
      var k = c.getAttribute('data-icon'), x = c.getContext('2d'), g;
      if (k === 'circle') g = McCircle.flat(13, 13, 'thin');
      else if (k === 'ellipse') g = McCircle.flat(15, 9, 'thin');
      else g = McCircle.layer(13, k === 'dome' ? 9 : 6, 'filled');
      c.width = 15; c.height = 15;
      x.clearRect(0, 0, 15, 15);
      var ox = Math.floor((15 - g[0].length) / 2), oy = Math.floor((15 - g.length) / 2);
      x.fillStyle = '#d6d9de';
      g.forEach(function (r, y) { r.forEach(function (v, xx) { if (v) x.fillRect(ox + xx, oy + y, 1, 1); }); });
      if (k === 'sphere' || k === 'dome') {
        x.fillStyle = 'rgba(0,0,0,0.35)';
        g.forEach(function (r, y) { r.forEach(function (v, xx) { if (v && (xx + y) % 3 === 0) x.fillRect(ox + xx, oy + y, 1, 1); }); });
        if (k === 'dome') { x.clearRect(0, 9, 15, 6); x.fillStyle = '#80858c'; x.fillRect(1, 9, 13, 1); }
      }
    });
  }

  function render() {
    build();
    var z = size(), n = McCircle.count(grid);
    $('cirStats').innerHTML =
      '<div><dt>' + (is3() ? 'This layer' : 'Blocks') + '</dt><dd>' + n.toLocaleString('en-US') + '</dd><span>' + stacks(n) + '</span></div>' +
      (is3() ? '<div><dt>Whole ' + s.shape + '</dt><dd id="cirTotal">' + total().toLocaleString('en-US') + '</dd><span>' + stacks(total()) + '</span></div>' : '') +
      '<div><dt>Size</dt><dd>' + z[0] + ' &times; ' + (is3() ? layers() + ' &times; ' + z[1] : z[1]) + '</dd><span>' + (is3() ? 'wide, high, deep' : 'wide by long') + '</span></div>';
    $('cirLayerK').textContent = 'Layer ' + (s.layer + 1) + ' of ' + layers();
    $('cirLayerRange').max = layers() - 1;
    $('cirLayerRange').value = s.layer;
    $('cirPrev').disabled = s.layer <= 0;
    $('cirNext').disabled = s.layer >= layers() - 1;
    document.querySelectorAll('[data-3d]').forEach(function (el) { el.hidden = !is3(); });
    document.querySelectorAll('[data-2d]').forEach(function (el) { el.hidden = is3(); });
    $('cirHField').hidden = s.shape !== 'ellipse';
    $('cirWK').textContent = s.shape === 'ellipse' ? 'Width' : 'Diameter';
    $('cirStyle').querySelectorAll('[data-style]').forEach(function (b) {
      var v = b.getAttribute('data-style');
      b.hidden = is3() ? v === 'thick' : false;
      b.textContent = is3() && v === 'thin' ? 'Hollow' : { thin: 'Thin outline', thick: 'Thick outline', filled: 'Filled' }[v];
    });
    drawProfile();
    draw();
    $('cirHover').textContent = '';
    var even = (is3() ? s.d : s.w) % 2 === 0;
    $('cirNote').innerHTML = (even ? '<li>An even size has no single middle block: the centre lines fall between two blocks.</li>' : '') +
      (s.style === 'thin' && !is3() ? '<li>Thin outlines touch only at corners. Pick Thick outline for a wall you can walk along.</li>' : '') +
      (is3() ? '<li>Build from layer 1 up. The faint squares show the layer below, to line the next one up.</li>' : '');
  }
  var totalKey = '', totalVal = 0;
  function total() {
    var key = s.shape + s.d + s.style;
    if (key === totalKey) return totalVal;
    var t = 0;
    for (var i = 0; i < layers(); i++) t += McCircle.count(McCircle.layer(s.d, realY(i), s.style === 'filled' ? 'filled' : 'hollow'));
    totalKey = key; totalVal = t;
    return t;
  }

  // ---- events ----
  function press(box, attr, val) {
    box.querySelectorAll('[' + attr + ']').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute(attr) === val)); });
  }
  $('cirShape').addEventListener('click', function (e) {
    var b = e.target.closest('[data-shape]');
    if (!b) return;
    s.shape = b.getAttribute('data-shape');
    press(this, 'data-shape', s.shape);
    if (is3() && s.style === 'thick') { s.style = 'thin'; press($('cirStyle'), 'data-style', 'thin'); }
    s.layer = Math.min(s.layer, layers() - 1);
    if (is3()) $('cirW').value = $('cirWNum').value = s.d; else $('cirW').value = $('cirWNum').value = s.w;
    render();
  });
  function setSize(v) {
    v = Math.min(MAX, Math.max(3, parseInt(v, 10) || 3));
    if (is3()) { s.d = v; s.layer = Math.min(s.layer, layers() - 1); } else s.w = v;
    $('cirW').value = $('cirWNum').value = v;
    render();
  }
  $('cirW').addEventListener('input', function () { setSize(this.value); });
  $('cirWNum').addEventListener('change', function () { setSize(this.value); });
  $('cirH').addEventListener('input', function () { s.h = Math.min(MAX, Math.max(3, parseInt(this.value, 10) || 3)); $('cirHNum').value = s.h; render(); });
  $('cirHNum').addEventListener('change', function () { s.h = Math.min(MAX, Math.max(3, parseInt(this.value, 10) || 3)); $('cirH').value = this.value = s.h; render(); });
  $('cirStyle').addEventListener('click', function (e) {
    var b = e.target.closest('[data-style]');
    if (!b) return;
    s.style = b.getAttribute('data-style');
    press(this, 'data-style', s.style);
    render();
  });
  function setLayer(i) { s.layer = Math.min(layers() - 1, Math.max(0, i)); render(); }
  $('cirLayerRange').addEventListener('input', function () { setLayer(+this.value); });
  $('cirPrev').addEventListener('click', function () { setLayer(s.layer - 1); });
  $('cirNext').addEventListener('click', function () { setLayer(s.layer + 1); });
  $('cirProfile').addEventListener('click', function (e) {
    var b = e.target.closest('[data-layer]');
    if (b) setLayer(+b.getAttribute('data-layer'));
  });
  [['cirNums', 'nums'], ['cirCentre', 'centre'], ['cirGhost', 'ghost']].forEach(function (p) {
    $(p[0]).addEventListener('change', function () { s[p[1]] = this.checked; draw(); });
  });
  $('cirZoomIn').addEventListener('click', function () { s.zoom = Math.min(8, (s.zoom || 1) * 1.5); draw(); });
  $('cirZoomOut').addEventListener('click', function () { s.zoom = Math.max(0.25, (s.zoom || 1) / 1.5); draw(); });
  $('cirFit').addEventListener('click', function () { s.zoom = 0; draw(); });
  // hover: which block, measured from the middle, and how many in that row
  cv.addEventListener('mousemove', function (e) {
    var r = cv.getBoundingClientRect(), k = cv.width / r.width;
    var gx = Math.floor(((e.clientX - r.left) * k - lastPad) / lastC), gy = Math.floor(((e.clientY - r.top) * k - lastPad) / lastC);
    var z = size();
    if (gx < 0 || gy < 0 || gx >= z[0] || gy >= z[1]) { if (s.hover) { s.hover = null; draw(); $('cirHover').textContent = ''; } return; }
    if (s.hover && s.hover[0] === gx && s.hover[1] === gy) return;
    s.hover = [gx, gy];
    draw();
    var inRow = grid[gy].reduce(function (a, b) { return a + b; }, 0);
    var mx = gx - (z[0] - 1) / 2, mz = gy - (z[1] - 1) / 2;
    $('cirHover').textContent = 'Block ' + gx + ', ' + gy + ' · ' + (mx >= 0 ? '+' : '') + mx + ', ' + (mz >= 0 ? '+' : '') + mz + ' from the middle · ' + inRow + ' in this row' + (grid[gy][gx] ? '' : ' · empty');
  });
  cv.addEventListener('mouseleave', function () { s.hover = null; draw(); $('cirHover').textContent = ''; });
  $('cirPng').addEventListener('click', function () {
    var out = document.createElement('canvas'), z = size();
    var c = Math.max(8, Math.min(24, Math.floor(2400 / Math.max(z[0], z[1]))));
    paint(out, c, { nums: true, centre: s.centre, ghost: false });
    var a = document.createElement('a');
    a.download = 'parchrome-' + s.shape + '-' + (is3() ? s.d + '-layer-' + (s.layer + 1) : z[0] + 'x' + z[1]) + '.png';
    a.href = out.toDataURL('image/png');
    a.click();
  });
  if ('ResizeObserver' in window) new ResizeObserver(function () { if (!s.zoom) draw(); }).observe($('cirStage'));

  drawIcons();
  render();
})();
