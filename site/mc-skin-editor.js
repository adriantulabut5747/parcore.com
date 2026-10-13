/* Skin editor (Oct 13 2026), /minecraft/tools/skin-editor. Paint a 64 x 64 skin on its
   texture sheet with the part outlines, and watch it on a 3D player (skinview3d, as on
   Skin Lookup). Start from any of the game's nine default skins (from the 26.3 game
   files), a player's skin (mc-heads.net), or a PNG; old 64 x 32 skins are converted.
   Mirror paints the matching pixel on the other side the way the model mirrors:
   front and back flip across the middle, and the right side face of one limb maps to
   the left side face of the other. ?player=Name opens a player's skin (Skin Lookup's
   "Edit this skin" button).
   Styles: SKIN EDITOR block in mc-home.css (.ske-*). */
(function () {
  var cv = document.getElementById('skeSheet');
  if (!cv) return;
  var $ = function (id) { return document.getElementById(id); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var skin = document.createElement('canvas'); skin.width = 64; skin.height = 64;
  var sx = skin.getContext('2d', { willReadFrequently: true });
  var s = { tool: 'pencil', color: '#3c8527', mirror: false, slim: false, grid: true, layer: 'both', part: '', undo: [], redo: [], drawing: false, last: null };

  // ---- the skin layout: parts -> faces [x, y, w, h], classic arms ----
  function limb(x, y, w) {
    return { top: [x + 4, y, w, 4], bottom: [x + 4 + w, y, w, 4], right: [x, y + 4, 4, 12], front: [x + 4, y + 4, w, 12], left: [x + 4 + w, y + 4, 4, 12], back: [x + 8 + w, y + 4, w, 12] };
  }
  function cube(x, y, w, h, d) {
    return { top: [x + d, y, w, d], bottom: [x + d + w, y, w, d], right: [x, y + d, d, h], front: [x + d, y + d, w, h], left: [x + d + w, y + d, d, h], back: [x + 2 * d + w, y + d, w, h] };
  }
  function parts() {
    var aw = s.slim ? 3 : 4;
    return {
      head: { n: 'Head', o: false, f: cube(0, 0, 8, 8, 8), mate: 'head' }, hat: { n: 'Hat', o: true, f: cube(32, 0, 8, 8, 8), mate: 'hat' },
      body: { n: 'Body', o: false, f: cube(16, 16, 8, 12, 4), mate: 'body' }, jacket: { n: 'Jacket', o: true, f: cube(16, 32, 8, 12, 4), mate: 'jacket' },
      rarm: { n: 'Right arm', o: false, f: limb(40, 16, aw), mate: 'larm' }, larm: { n: 'Left arm', o: false, f: limb(32, 48, aw), mate: 'rarm' },
      rsleeve: { n: 'Right sleeve', o: true, f: limb(40, 32, aw), mate: 'lsleeve' }, lsleeve: { n: 'Left sleeve', o: true, f: limb(48, 48, aw), mate: 'rsleeve' },
      rleg: { n: 'Right leg', o: false, f: limb(0, 16, 4), mate: 'lleg' }, lleg: { n: 'Left leg', o: false, f: limb(16, 48, 4), mate: 'rleg' },
      rpants: { n: 'Right pants', o: true, f: limb(0, 32, 4), mate: 'lpants' }, lpants: { n: 'Left pants', o: true, f: limb(0, 48, 4), mate: 'rpants' }
    };
  }
  var P = parts();
  function where(x, y) {
    for (var k in P) for (var f in P[k].f) { var r = P[k].f[f]; if (x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3]) return { part: k, face: f, u: x - r[0], v: y - r[1], r: r }; }
    return null;
  }
  var SWAP = { left: 'right', right: 'left' };
  function mirrorOf(x, y) {
    var w = where(x, y);
    if (!w) return null;
    var mate = P[P[w.part].mate], face = mate === P[w.part] ? SWAP[w.face] || w.face : SWAP[w.face] || w.face, r = mate.f[face];
    if (!r) return null;
    var u = r[2] - 1 - Math.min(w.u, r[2] - 1);
    return [r[0] + u, r[1] + Math.min(w.v, r[3] - 1)];
  }
  function editable(x, y) {
    var w = where(x, y);
    if (!w) return false;
    if (s.layer === 'base' && P[w.part].o) return false;
    if (s.layer === 'over' && !P[w.part].o) return false;
    if (s.part && w.part !== s.part && w.part !== P[s.part].mate) return false;
    return true;
  }

  // ---- drawing the sheet ----
  function cell() { return Math.max(4, Math.floor(Math.min(cv.parentNode.clientWidth, 640) / 64)); }
  function drawSheet() {
    var c = cell(), W = 64 * c, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = W * dpr; cv.style.width = W + 'px'; cv.style.height = W + 'px';
    var x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.imageSmoothingEnabled = false;
    // transparent pixels show as a checkerboard
    for (var yy = 0; yy < 64; yy++) for (var xx = 0; xx < 64; xx++) {
      var on = where(xx, yy);
      x.fillStyle = on ? ((xx + yy) & 1 ? '#2a2c31' : '#222428') : '#111214';
      x.fillRect(xx * c, yy * c, c, c);
    }
    x.drawImage(skin, 0, 0, W, W);
    // dim what you can't paint right now
    x.fillStyle = 'rgba(10,11,13,0.62)';
    for (yy = 0; yy < 64; yy++) for (xx = 0; xx < 64; xx++) if (where(xx, yy) && !editable(xx, yy)) x.fillRect(xx * c, yy * c, c, c);
    if (s.grid && c >= 6) {
      x.strokeStyle = 'rgba(255,255,255,0.06)'; x.lineWidth = 1; x.beginPath();
      for (var i = 0; i <= 64; i++) { x.moveTo(i * c + 0.5, 0); x.lineTo(i * c + 0.5, W); x.moveTo(0, i * c + 0.5); x.lineTo(W, i * c + 0.5); }
      x.stroke();
    }
    // part outlines
    x.strokeStyle = 'rgba(255,255,255,0.28)'; x.lineWidth = 1;
    for (var k in P) for (var f in P[k].f) { var r = P[k].f[f]; x.strokeRect(r[0] * c + 0.5, r[1] * c + 0.5, r[2] * c - 1, r[3] * c - 1); }
    if (s.hover) { x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(s.hover[0] * c + 1, s.hover[1] * c + 1, c - 2, c - 2); if (s.mirror) { var m = mirrorOf(s.hover[0], s.hover[1]); if (m) { x.strokeStyle = 'rgba(232,106,106,0.9)'; x.strokeRect(m[0] * c + 1, m[1] * c + 1, c - 2, c - 2); } } }
  }

  // ---- 3D ----
  var viewer = null, pending = 0;
  function update3d() {
    if (!viewer || pending) return;
    pending = requestAnimationFrame(function () {
      pending = 0;
      viewer.loadSkin(skin, { model: s.slim ? 'slim' : 'default' });
      var sk = viewer.playerObject.skin, showOver = s.layer !== 'base';
      ['head', 'body', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'].forEach(function (p) { sk[p].outerLayer.visible = showOver; });
    });
  }
  (function boot() {
    var c3 = $('ske3d'), stage = c3.parentNode, sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/skinview3d@3.1.0/bundles/skinview3d.bundle.js';
    sc.onload = function () {
      try {
        viewer = new window.skinview3d.SkinViewer({ canvas: c3, width: stage.clientWidth, height: stage.clientHeight });
        viewer.zoom = 0.86; viewer.fov = 40; viewer.controls.enableZoom = false;
        c3.style.touchAction = 'pan-y';
        viewer.animation = new window.skinview3d.IdleAnimation();
        viewer.animation.paused = reduced;
        viewer.playerObject.rotation.y = -0.5;
        update3d();
        new ResizeObserver(function () { viewer.setSize(stage.clientWidth, stage.clientHeight); }).observe(stage);
      } catch (e) { stage.classList.add('is-flat'); }
    };
    document.head.appendChild(sc);
  })();
  function changed() { drawSheet(); update3d(); }

  // ---- painting ----
  function snapshot() { s.undo.push(sx.getImageData(0, 0, 64, 64)); if (s.undo.length > 60) s.undo.shift(); s.redo = []; tools(); }
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function setPx(d, x, y, rgba) { var i = (y * 64 + x) * 4; d.data[i] = rgba[0]; d.data[i + 1] = rgba[1]; d.data[i + 2] = rgba[2]; d.data[i + 3] = rgba[3]; }
  function getPx(d, x, y) { var i = (y * 64 + x) * 4; return [d.data[i], d.data[i + 1], d.data[i + 2], d.data[i + 3]]; }
  function apply(x, y) {
    if (!editable(x, y)) return;
    var d = sx.getImageData(0, 0, 64, 64), targets = [[x, y]];
    if (s.mirror) { var m = mirrorOf(x, y); if (m && editable(m[0], m[1])) targets.push(m); }
    targets.forEach(function (t) {
      var cur = getPx(d, t[0], t[1]);
      if (s.tool === 'pencil') setPx(d, t[0], t[1], hexRgb(s.color).concat(255));
      else if (s.tool === 'eraser') setPx(d, t[0], t[1], [0, 0, 0, 0]);
      else if (s.tool === 'darken' || s.tool === 'lighten') {
        if (!cur[3]) return;
        var k = s.tool === 'darken' ? 0.9 : 1.1;
        setPx(d, t[0], t[1], [Math.min(255, cur[0] * k), Math.min(255, cur[1] * k), Math.min(255, cur[2] * k), cur[3]]);
      } else if (s.tool === 'fill') fill(d, t[0], t[1]);
    });
    sx.putImageData(d, 0, 0);
  }
  // fill: same colour, connected, and only inside the face it starts on
  function fill(d, x, y) {
    var w = where(x, y), r = w.r, from = getPx(d, x, y).join(), to = hexRgb(s.color).concat(255), seen = {}, st = [[x, y]];
    if (from === to.join()) return;
    while (st.length) {
      var p = st.pop(), k = p[0] + ',' + p[1];
      if (seen[k] || p[0] < r[0] || p[1] < r[1] || p[0] >= r[0] + r[2] || p[1] >= r[1] + r[3]) continue;
      seen[k] = 1;
      if (getPx(d, p[0], p[1]).join() !== from) continue;
      setPx(d, p[0], p[1], to);
      st.push([p[0] + 1, p[1]], [p[0] - 1, p[1]], [p[0], p[1] + 1], [p[0], p[1] - 1]);
    }
  }
  function px(e) { var r = cv.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * 64), Math.floor((e.clientY - r.top) / r.height * 64)]; }
  cv.addEventListener('pointerdown', function (e) {
    var p = px(e);
    if (!where(p[0], p[1])) return;
    if (s.tool === 'picker') {
      var c = sx.getImageData(p[0], p[1], 1, 1).data;
      if (c[3]) setColor('#' + [c[0], c[1], c[2]].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''));
      setTool('pencil');
      return;
    }
    snapshot();
    s.drawing = true; s.last = p;
    cv.setPointerCapture(e.pointerId);
    apply(p[0], p[1]); changed();
  });
  cv.addEventListener('pointermove', function (e) {
    var p = px(e);
    s.hover = where(p[0], p[1]) ? p : null;
    var w = s.hover && where(p[0], p[1]);
    $('skeAt').textContent = w ? P[w.part].n + ' · ' + w.face + ' · ' + p[0] + ', ' + p[1] : '';
    if (s.drawing && s.tool !== 'fill') {
      // fill in the gap between two move events so fast strokes stay solid
      var a = s.last, n = Math.max(Math.abs(p[0] - a[0]), Math.abs(p[1] - a[1]));
      for (var i = 1; i <= n; i++) apply(Math.round(a[0] + (p[0] - a[0]) * i / n), Math.round(a[1] + (p[1] - a[1]) * i / n));
      s.last = p;
      changed();
    } else drawSheet();
  });
  function end() { s.drawing = false; }
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', function () { s.hover = null; drawSheet(); });

  // ---- tools, colours, history ----
  var PALETTES = {
    'Default': ['000000', '3f3f3f', '7f7f7f', 'bfbfbf', 'ffffff', '7b2fbe', 'c23b3b', 'e86a6a', 'f9801d', 'fed83d', '80c71f', '3c8527', '169c9c', '3ab3da', '3c44aa', '835432'],
    'Skin': ['ffdbac', 'f1c27d', 'e0ac69', 'c68642', '8d5524', '6b3e26', '4a2c1a', 'b5835a', 'f3c6a5', 'd8a283', 'a26c4a', '6f4e37'],
    'Earth': ['4b6b2b', '6b8e23', '8a9a5b', 'a0522d', '8b5a2b', '5c4033', '9c8b6e', 'c2b280', '708090', '556b2f', '2f4f4f', '3b3b2f'],
    'Grey': ['000000', '1c1c1c', '383838', '555555', '717171', '8d8d8d', 'aaaaaa', 'c6c6c6', 'e2e2e2', 'ffffff']
  };
  var palAt = 'Default';
  function drawPalette() {
    $('skePalTabs').innerHTML = Object.keys(PALETTES).map(function (k) { return '<button type="button" data-pal="' + k + '" aria-pressed="' + (k === palAt) + '">' + k + '</button>'; }).join('');
    $('skePal').innerHTML = PALETTES[palAt].map(function (h) { return '<button type="button" class="pt-sw" data-c="#' + h + '" style="background:#' + h + '" aria-label="#' + h + '" aria-pressed="' + (s.color === '#' + h) + '"></button>'; }).join('');
  }
  function setColor(c) { s.color = c; $('skeColor').value = c; $('skeHex').textContent = c; drawPalette(); }
  function setTool(t) { s.tool = t; $('skeTools').querySelectorAll('[data-tool]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tool') === t)); }); cv.style.cursor = t === 'picker' ? 'copy' : 'crosshair'; }
  function tools() { $('skeUndo').disabled = !s.undo.length; $('skeRedo').disabled = !s.redo.length; }
  $('skeTools').addEventListener('click', function (e) { var b = e.target.closest('[data-tool]'); if (b) setTool(b.getAttribute('data-tool')); });
  $('skePalTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-pal]'); if (b) { palAt = b.getAttribute('data-pal'); drawPalette(); } });
  $('skePal').addEventListener('click', function (e) { var b = e.target.closest('[data-c]'); if (b) { setColor(b.getAttribute('data-c')); if (s.tool === 'eraser' || s.tool === 'picker') setTool('pencil'); } });
  $('skeColor').addEventListener('input', function () { setColor(this.value); });
  $('skeUndo').addEventListener('click', function () { if (!s.undo.length) return; s.redo.push(sx.getImageData(0, 0, 64, 64)); sx.putImageData(s.undo.pop(), 0, 0); tools(); changed(); });
  $('skeRedo').addEventListener('click', function () { if (!s.redo.length) return; s.undo.push(sx.getImageData(0, 0, 64, 64)); sx.putImageData(s.redo.pop(), 0, 0); tools(); changed(); });
  document.addEventListener('keydown', function (e) {
    if (e.target.matches('input, textarea, select')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $(e.shiftKey ? 'skeRedo' : 'skeUndo').click(); }
    var keys = { b: 'pencil', e: 'eraser', g: 'fill', i: 'picker' };
    if (!e.ctrlKey && keys[e.key]) setTool(keys[e.key]);
    if (!e.ctrlKey && e.key === 'm') { s.mirror = !s.mirror; $('skeMirror').checked = s.mirror; }
  });
  $('skeMirror').addEventListener('change', function () { s.mirror = this.checked; });
  $('skeGrid').addEventListener('change', function () { s.grid = this.checked; drawSheet(); });
  function seg(id, attr, fn) {
    $(id).addEventListener('click', function (e) {
      var b = e.target.closest('[' + attr + ']'); if (!b) return;
      this.querySelectorAll('[' + attr + ']').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      fn(b.getAttribute(attr)); changed();
    });
  }
  seg('skeLayer', 'data-layer', function (v) { s.layer = v; });
  seg('skeModel', 'data-model', function (v) { s.slim = v === 'slim'; P = parts(); });
  $('skePart').innerHTML = '<option value="">Every part</option>' + ['head', 'body', 'rarm', 'larm', 'rleg', 'lleg', 'hat', 'jacket', 'rsleeve', 'lsleeve', 'rpants', 'lpants'].map(function (k) { return '<option value="' + k + '">' + P[k].n + '</option>'; }).join('');
  $('skePart').addEventListener('change', function () { s.part = this.value; drawSheet(); });

  // ---- loading and saving ----
  function load(src, slim, msg) {
    var im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = function () {
      snapshot();
      sx.clearRect(0, 0, 64, 64);
      if (im.height === 32) { // old 64 x 32: copy the right limbs to the new left limb slots, mirrored
        sx.drawImage(im, 0, 0);
        [[0, 16, 16, 48], [40, 16, 32, 48]].forEach(function (m) {
          var src = sx.getImageData(m[0], m[1], 16, 16), tmp = document.createElement('canvas'); tmp.width = 16; tmp.height = 16;
          tmp.getContext('2d').putImageData(src, 0, 0);
          var f = limb(0, 0, 4);
          Object.keys(f).forEach(function (k) {
            var r = f[k], t = f[SWAP[k] || k];
            sx.save(); sx.translate(m[2] + t[0] + t[2], m[3] + t[1]); sx.scale(-1, 1);
            sx.drawImage(tmp, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]); sx.restore();
          });
        });
      } else sx.drawImage(im, 0, 0, 64, 64);
      if (slim != null) { s.slim = slim; P = parts(); $('skeModel').querySelectorAll('[data-model]').forEach(function (b) { b.setAttribute('aria-pressed', String((b.getAttribute('data-model') === 'slim') === slim)); }); }
      $('skeMsg').textContent = msg || '';
      $('skeMsg').className = 'crd-paste-msg';
      changed();
    };
    im.onerror = function () { $('skeMsg').textContent = 'That skin could not be loaded.'; $('skeMsg').className = 'crd-paste-msg is-error'; };
    im.src = src;
  }
  $('skeDefaults').innerHTML = ['steve', 'alex', 'ari', 'efe', 'kai', 'makena', 'noor', 'sunny', 'zuri'].map(function (n) {
    return '<button type="button" class="pt-slot ske-def" data-def="' + n + '" title="' + n[0].toUpperCase() + n.slice(1) + '"><span class="ske-face" style="background-image:url(/minecrafticons/skins/' + n + '_wide.png)"></span><span>' + n[0].toUpperCase() + n.slice(1) + '</span></button>';
  }).join('');
  $('skeDefaults').addEventListener('click', function (e) { var b = e.target.closest('[data-def]'); if (b) load('/minecrafticons/skins/' + b.getAttribute('data-def') + (s.slim ? '_slim' : '_wide') + '.png', s.slim, ''); });
  $('skeFetch').addEventListener('submit', function (e) {
    e.preventDefault();
    var n = $('skeName').value.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(n)) { $('skeMsg').textContent = 'Java usernames are 3 to 16 letters, numbers or underscores.'; $('skeMsg').className = 'crd-paste-msg is-error'; return; }
    $('skeMsg').textContent = 'Loading ' + n + '…';
    load('https://mc-heads.net/skin/' + encodeURIComponent(n), null, 'Loaded ' + n + '. Pick Slim if the arms look too wide.');
  });
  $('skeFile').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (f) load(URL.createObjectURL(f), null, 'Loaded ' + f.name + '.');
  });
  $('skeSave').addEventListener('click', function () {
    var a = document.createElement('a'); a.download = 'parchrome-skin.png'; a.href = skin.toDataURL('image/png'); a.click();
  });
  $('skeClear').addEventListener('click', function () { snapshot(); sx.clearRect(0, 0, 64, 64); changed(); });
  if ('ResizeObserver' in window) new ResizeObserver(drawSheet).observe(cv.parentNode);

  drawPalette(); setColor(s.color); setTool('pencil'); tools();
  var q = new URLSearchParams(location.search).get('player');
  if (q && /^[A-Za-z0-9_]{3,16}$/.test(q)) { $('skeName').value = q; load('https://mc-heads.net/skin/' + q, null, 'Loaded ' + q + ' from Skin Lookup.'); }
  else load('/minecrafticons/skins/steve_wide.png', false, '');
})();
