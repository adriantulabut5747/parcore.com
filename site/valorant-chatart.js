// Valorant Chat Art (Oct 30 2026): the maker (/valorant/chat-art) and the gallery (/valorant/chat-art-gallery).
// The trick every chat-art site uses: chat wraps a message at the box's edge, so a drawing is ONE line made of
// rows of exactly W glyphs, and the wrap stacks the rows. No spaces (chat can trim them or break the line at
// them): an empty cell is the background glyph (░ by default). W = 26 is valorantscout.com's width and is NOT
// checked in game yet (Adrian): the pages say "Unverified" and let the player change it.
(function () {
  'use strict';

  /* ================= ENGINE (no DOM: node can test it) ================= */
  const GLYPHS = ['█', '▓', '▒', '░', '▀', '▄', '▌', '▐', '■'];
  const NAMES = ['Full block', 'Dark shade', 'Mid shade', 'Light shade', 'Top half', 'Bottom half', 'Left half', 'Right half', 'Square'];
  const MIN_W = 12, MAX_W = 40, DEF_W = 26, MAX_ROWS = 20;
  const LIGHT = 3; // ░

  // art = { w, bg, g: [glyph index per cell, row after row] }
  const blank = (w, rows, bg) => ({ w, bg, g: new Array(w * rows).fill(bg) });
  const rowsOf = (a) => a.g.length / a.w;
  const line = (a) => a.g.map((i) => GLYPHS[i]).join('');

  // share code "<w><bg>.<runs>": a = █, b = ▓ ... and a run is its letter + the count when > 1
  function encode(a) {
    let s = '';
    for (let i = 0; i < a.g.length; ) {
      let n = 1;
      while (a.g[i + n] === a.g[i]) n++;
      s += String.fromCharCode(97 + a.g[i]) + (n > 1 ? n : '');
      i += n;
    }
    return a.w + String.fromCharCode(97 + a.bg) + '.' + s;
  }
  // the code comes from the address: anything off = null, never a half-built drawing
  function decode(code) {
    const m = /^(\d{2})([a-i])\.((?:[a-i]\d{0,3})+)$/.exec(String(code || '').trim());
    if (!m) return null;
    const w = +m[1], bg = m[2].charCodeAt(0) - 97, g = [];
    if (w < MIN_W || w > MAX_W) return null;
    for (const r of m[3].matchAll(/([a-i])(\d*)/g)) {
      const n = r[2] ? +r[2] : 1;
      if (g.length + n > w * MAX_ROWS) return null;
      for (let k = 0; k < n; k++) g.push(r[1].charCodeAt(0) - 97);
    }
    return g.length % w === 0 ? { w, bg, g } : null;
  }

  // a new width keeps the drawing centred (cropped or padded on both sides)
  function setWidth(a, w) {
    const off = Math.floor((w - a.w) / 2), g = [];
    for (let y = 0; y < rowsOf(a); y++) {
      for (let x = 0; x < w; x++) g.push(x - off >= 0 && x - off < a.w ? a.g[y * a.w + x - off] : a.bg);
    }
    return { w, bg: a.bg, g };
  }
  function setRows(a, rows) {
    const g = a.g.slice(0, a.w * rows);
    while (g.length < a.w * rows) g.push(a.bg);
    return { w: a.w, bg: a.bg, g };
  }

  // pixel rows (# + - ^ _, see valorant-chatart.json) centred into a w-wide drawing, each pixel sx glyphs wide
  const PX = { '#': 0, '+': 1, '-': 2, '^': 4, _: 5 };
  function fromPixels(rows, w, bg, sx) {
    rows = rows.slice(0, MAX_ROWS);
    const pw = Math.max(...rows.map((r) => r.length)) * sx, off = Math.floor((w - pw) / 2);
    const a = blank(w, rows.length, bg);
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length * sx; x++) {
        const p = PX[r[Math.floor(x / sx)]];
        if (p !== undefined && x + off >= 0 && x + off < w) a.g[y * w + x + off] = p;
      }
    });
    return a;
  }

  // 3x5 block font for banners
  const FONT = {
    A: '.#.,#.#,###,#.#,#.#', B: '##.,#.#,##.,#.#,##.', C: '.##,#..,#..,#..,.##', D: '##.,#.#,#.#,#.#,##.',
    E: '###,#..,##.,#..,###', F: '###,#..,##.,#..,#..', G: '.##,#..,#.#,#.#,.##', H: '#.#,#.#,###,#.#,#.#',
    I: '###,.#.,.#.,.#.,###', J: '..#,..#,..#,#.#,.#.', K: '#.#,#.#,##.,#.#,#.#', L: '#..,#..,#..,#..,###',
    M: '#.#,###,###,#.#,#.#', N: '##.,#.#,#.#,#.#,#.#', O: '###,#.#,#.#,#.#,###', P: '##.,#.#,##.,#..,#..',
    Q: '###,#.#,#.#,###,..#', R: '##.,#.#,##.,#.#,#.#', S: '###,#..,###,..#,###', T: '###,.#.,.#.,.#.,.#.',
    U: '#.#,#.#,#.#,#.#,###', V: '#.#,#.#,#.#,#.#,.#.', W: '#.#,#.#,#.#,###,#.#', X: '#.#,#.#,.#.,#.#,#.#',
    Y: '#.#,#.#,.#.,.#.,.#.', Z: '###,..#,.#.,#..,###',
    0: '###,#.#,#.#,#.#,###', 1: '.#.,##.,.#.,.#.,###', 2: '##.,..#,.#.,#..,###', 3: '##.,..#,.#.,..#,##.',
    4: '#.#,#.#,###,..#,..#', 5: '###,#..,##.,..#,##.', 6: '.##,#..,###,#.#,###', 7: '###,..#,.#.,.#.,.#.',
    8: '###,#.#,###,#.#,###', 9: '###,#.#,###,..#,##.',
    '!': '.#.,.#.,.#.,...,.#.', '?': '##.,..#,.#.,...,.#.', '.': '...,...,...,...,.#.', ':': '...,.#.,...,.#.,...',
    '-': '...,...,###,...,...', ' ': '...,...,...,...,...',
  };
  // text -> { art, cut } (cut = lines that didn't fit MAX_ROWS), or null when nothing drawable is left
  function banner(text, w, bg, ink, sx) {
    const per = Math.floor((w + sx) / (4 * sx)); // letters a line: 3 wide + a 1 gap, times sx
    const words = String(text).toUpperCase().replace(/[^A-Z0-9!?.:\- ]/g, '').split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    words.forEach((wd) => {
      while (wd.length > per) {
        if (cur) lines.push(cur), (cur = '');
        lines.push(wd.slice(0, per));
        wd = wd.slice(per);
      }
      if (!wd) return;
      if (cur && cur.length + 1 + wd.length <= per) cur += ' ' + wd;
      else {
        if (cur) lines.push(cur);
        cur = wd;
      }
    });
    if (cur) lines.push(cur);
    const keep = lines.slice(0, Math.floor((MAX_ROWS + 1) / 6));
    if (!keep.length) return null;
    let px = [];
    keep.forEach((ln, i) => {
      if (i) px.push('');
      for (let r = 0; r < 5; r++) px.push([...ln].map((c) => FONT[c].split(',')[r]).join('.'));
    });
    const L = Math.max(...px.map((r) => r.length));
    px = px.map((r) => '.'.repeat(Math.floor((L - r.length) / 2)) + r); // centre each line
    const art = fromPixels(px, w, -1, sx); // -1 = empty, so a █ background can't be mistaken for ink
    art.bg = bg;
    art.g = art.g.map((v) => (v === -1 ? bg : v === 0 ? ink : v));
    return { art, cut: lines.length > keep.length };
  }

  function fill(a, x0, y0, v) {
    const rows = rowsOf(a), from = a.g[y0 * a.w + x0];
    if (from === v) return;
    const st = [[x0, y0]];
    while (st.length) {
      const [x, y] = st.pop();
      if (x < 0 || y < 0 || x >= a.w || y >= rows || a.g[y * a.w + x] !== from) continue;
      a.g[y * a.w + x] = v;
      st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  const engine = { GLYPHS, DEF_W, MAX_ROWS, LIGHT, encode, decode, setWidth, setRows, fromPixels, banner, fill, line, rowsOf };
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (typeof document === 'undefined') return;

  /* ================= DRAWING ================= */
  // shortcut: a chat glyph is drawn 2x as tall as wide; measure Valorant's chat font in game and adjust
  const CELL = 2;
  const ALPHA = [1, 0.72, 0.46, 0.2];
  // the drawing as blocks (no font: Windows fonts draw ▀▄▌▐ at different widths), cw px per glyph
  function paint(cv, a, cw, opt) {
    opt = opt || {};
    const rows = rowsOf(a), ch = cw * CELL, W = a.w * cw, H = rows * ch, dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    if (opt.ground) {
      c.fillStyle = opt.ground;
      c.fillRect(0, 0, W, H);
    }
    c.fillStyle = opt.ink || '#f2f3f5';
    a.g.forEach((v, i) => {
      const x = (i % a.w) * cw, y = Math.floor(i / a.w) * ch;
      c.globalAlpha = v < 4 ? ALPHA[v] : 1;
      if (v < 4) c.fillRect(x, y, cw, ch);
      else if (v === 4) c.fillRect(x, y, cw, ch / 2);
      else if (v === 5) c.fillRect(x, y + ch / 2, cw, ch / 2);
      else if (v === 6) c.fillRect(x, y, cw / 2, ch);
      else if (v === 7) c.fillRect(x + cw / 2, y, cw / 2, ch);
      else {
        const s = cw * 0.7;
        c.fillRect(x + (cw - s) / 2, y + (ch - s) / 2, s, s);
      }
    });
    c.globalAlpha = 1;
    if (opt.grid) {
      c.strokeStyle = 'rgba(194, 59, 59, 0.28)';
      c.lineWidth = 1;
      c.beginPath();
      for (let x = 1; x < a.w; x++) c.moveTo(x * cw + 0.5, 0), c.lineTo(x * cw + 0.5, H);
      for (let y = 1; y < rows; y++) c.moveTo(0, y * ch + 0.5), c.lineTo(W, y * ch + 0.5);
      c.stroke();
    }
  }
  // the biggest whole glyph size that fits a box
  const fit = (a, w, h) => Math.max(1, Math.floor(Math.min(w / a.w, h / (rowsOf(a) * CELL))));

  /* ================= SHARED UI ================= */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window: fine */ } },
  };
  const MAKER = '/valorant/chat-art';
  let say = () => {};

  function copy(text, btn, done) {
    const flash = () => {
      const old = btn.textContent;
      btn.textContent = done || 'Copied';
      btn.classList.add('is-done');
      setTimeout(() => { btn.textContent = old; btn.classList.remove('is-done'); }, 1400);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(flash, () => say('Copy failed: select the line and copy it by hand.', true));
    else say('Copy failed: select the line and copy it by hand.', true);
  }

  // a card: the drawing in a well, name, line under it, keys. data-a = the share code (drawn by paintCards)
  function card(name, sub, a, keys) {
    const code = encode(a);
    return `<article class="ca-card"><div class="ca-card-pic"><canvas data-a="${esc(code)}" role="img" aria-label="${esc(name)}"></canvas></div>` +
      `<div class="ca-card-txt"><b>${esc(name)}</b><small>${esc(sub)}</small></div><div class="ca-card-keys">${keys(code)}</div></article>`;
  }
  function paintCards(root) {
    root.querySelectorAll('canvas[data-a]').forEach((cv) => {
      const a = decode(cv.dataset.a), box = cv.parentElement;
      if (a) paint(cv, a, fit(a, box.clientWidth - 16, box.clientHeight - 16));
    });
  }
  let lastW = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth === lastW) return; // phones fire resize when the address bar moves
    lastW = innerWidth;
    clearTimeout(paintCards.t);
    paintCards.t = setTimeout(() => { paintCards(document); if (window.vcaRedraw) window.vcaRedraw(); }, 150);
  });

  // gallery pieces built at 26 wide
  const loadGallery = () =>
    fetch('/valorant-chatart.json').then((r) => r.json()).then((d) => ({
      cats: d.cats,
      art: d.art.map((p) => ({ ...p, a: p.text ? banner(p.text, DEF_W, LIGHT, 0, p.big ? 2 : 1).art : fromPixels(p.px, DEF_W, LIGHT, 2) })),
    }));
  const chars = (a) => a.g.length + ' characters';

  /* ================= THE MAKER ================= */
  if ($('caCanvas')) {
    const cv = $('caCanvas'), stage = $('caStage');
    say = (t, bad) => { $('caMsg').textContent = t || ''; $('caMsg').classList.toggle('is-bad', !!bad); };
    let art = decode(new URLSearchParams(location.search).get('a')) || banner('GG', DEF_W, LIGHT, 0, 2).art;
    let brush = 0, tool = 'paint', size = 2, shades = 4, invert = false, img = null;
    const undo = [];
    const snap = () => { undo.push(encode(art)); if (undo.length > 60) undo.shift(); };
    let cw = 10, urlTimer;

    function redraw() {
      const rows = rowsOf(art);
      cw = Math.max(6, Math.min(32, fit(art, stage.clientWidth - 24, Math.min(560, innerHeight * 0.62))));
      paint(cv, art, cw, { ground: '#0b0c0e', grid: true });
      paint($('caPreview'), art, Math.max(3, Math.min(7, fit(art, $('caPreviewBox').clientWidth - 28, 400))));
      paint($('cbIco'), art, fit(art, 92, 92));
      $('caLine').textContent = line(art);
      $('caLen').textContent = chars(art);
      $('cbLen').textContent = art.g.length;
      $('cbW').textContent = art.w;
      $('caW').value = art.w;
      $('caRows').textContent = rows;
      $('caWrap').textContent = art.w;
      $('caUndo').disabled = !undo.length;
    }
    window.vcaRedraw = redraw;
    function changed() {
      redraw();
      clearTimeout(urlTimer);
      urlTimer = setTimeout(() => history.replaceState(history.state, '', MAKER + '?a=' + encode(art)), 250);
    }
    function load(a, from) {
      snap();
      art = a;
      changed();
      say(from ? from + ' loaded.' : '');
    }

    /* drawing on the grid: paint / erase / fill, a stroke draws through every cell it crosses */
    let last = null;
    const cellAt = (e) => {
      const r = cv.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * art.w), y = Math.floor(((e.clientY - r.top) / r.height) * rowsOf(art));
      return x >= 0 && y >= 0 && x < art.w && y < rowsOf(art) ? [x, y] : null;
    };
    const put = (x, y) => { art.g[y * art.w + x] = tool === 'erase' ? art.bg : brush; };
    cv.addEventListener('pointerdown', (e) => {
      const c = cellAt(e);
      if (!c) return;
      e.preventDefault();
      snap();
      if (tool === 'fill') {
        fill(art, c[0], c[1], brush);
        changed();
        return;
      }
      cv.setPointerCapture(e.pointerId);
      last = c;
      put(c[0], c[1]);
      redraw();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!last) return;
      const c = cellAt(e);
      if (!c) return;
      const n = Math.max(Math.abs(c[0] - last[0]), Math.abs(c[1] - last[1]));
      for (let i = 1; i <= n; i++) put(Math.round(last[0] + ((c[0] - last[0]) * i) / n), Math.round(last[1] + ((c[1] - last[1]) * i) / n));
      last = c;
      if (n) redraw();
    });
    const stop = () => { if (last) { last = null; changed(); } };
    cv.addEventListener('pointerup', stop);
    cv.addEventListener('pointercancel', stop);

    /* the panel */
    const seg = (el, attr, cb) => el.addEventListener('click', (e) => {
      const b = e.target.closest('button[' + attr + ']');
      if (!b) return;
      el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      cb(b.getAttribute(attr));
    });
    seg($('caTabs'), 'data-tab', (t) => document.querySelectorAll('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== t)));
    seg($('caTool'), 'data-tool', (t) => { tool = t; });
    seg($('caSize'), 'data-size', (s) => { size = +s; });
    seg($('caShades'), 'data-shades', (s) => { shades = +s; if (img) picture(); });

    // glyph swatches: brush + empty cells (the four shades)
    const sw = (i, attr) => `<button type="button" class="ca-sw" ${attr}="${i}" aria-pressed="false" title="${NAMES[i]} ${GLYPHS[i]}"><canvas data-g="${i}"></canvas></button>`;
    $('caBrush').innerHTML = GLYPHS.map((_, i) => sw(i, 'data-brush')).join('');
    $('caBg').innerHTML = [3, 2, 1, 0].map((i) => sw(i, 'data-bg')).join('');
    document.querySelectorAll('.ca-sw canvas').forEach((c) => paint(c, { w: 1, bg: 3, g: [+c.dataset.g] }, 14));
    const pick = (el, attr, v) => el.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', +b.getAttribute(attr) === v ? 'true' : 'false'));
    $('caBrush').addEventListener('click', (e) => {
      const b = e.target.closest('[data-brush]');
      if (!b) return;
      brush = +b.dataset.brush;
      pick($('caBrush'), 'data-brush', brush);
      if (tool === 'erase') $('caTool').querySelector('[data-tool="paint"]').click();
    });
    $('caBg').addEventListener('click', (e) => {
      const b = e.target.closest('[data-bg]');
      if (!b || +b.dataset.bg === art.bg) return;
      snap();
      const nb = +b.dataset.bg;
      art = { w: art.w, bg: nb, g: art.g.map((v) => (v === art.bg ? nb : v)) };
      pick($('caBg'), 'data-bg', nb);
      changed();
    });

    $('caW').addEventListener('change', () => {
      const w = Math.max(MIN_W, Math.min(MAX_W, Math.round(+$('caW').value) || DEF_W));
      if (w === art.w) { $('caW').value = w; return; }
      snap();
      art = setWidth(art, w);
      changed();
    });
    $('caRowsLess').addEventListener('click', () => { if (rowsOf(art) > 1) { snap(); art = setRows(art, rowsOf(art) - 1); changed(); } });
    $('caRowsMore').addEventListener('click', () => { if (rowsOf(art) < MAX_ROWS) { snap(); art = setRows(art, rowsOf(art) + 1); changed(); } });
    const back = () => { if (undo.length) { const a = decode(undo.pop()); if (a) art = a; changed(); } };
    $('caUndo').addEventListener('click', back);
    addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) { e.preventDefault(); back(); }
    });
    $('caClear').addEventListener('click', () => { snap(); art = blank(art.w, rowsOf(art), art.bg); changed(); say('Grid cleared. Undo brings it back.'); });

    // Text: a banner in the brush glyph
    $('caText').addEventListener('submit', (e) => {
      e.preventDefault();
      const b = banner($('caTextIn').value, art.w, art.bg, brush, size);
      if (!b) { say('Type a word first: letters, numbers and ! ? . : - only.', true); return; }
      load(b.art);
      say(b.cut ? 'Only 3 lines fit: the rest was left out.' : 'Banner made. Draw on it or copy it.', b.cut);
    });

    // Picture: brightness -> the four shades (or full + light), the picture never leaves the device
    function picture() {
      const rows = Math.max(1, Math.min(MAX_ROWS, Math.round((art.w * img.naturalHeight) / img.naturalWidth / CELL)));
      const c = document.createElement('canvas');
      c.width = art.w;
      c.height = rows;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0, art.w, rows);
      const d = x.getImageData(0, 0, art.w, rows).data, lum = [];
      for (let i = 0; i < d.length; i += 4) lum.push(((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) * d[i + 3]) / 255);
      const lo = Math.min(...lum), hi = Math.max(...lum);
      const ramp = shades === 4 ? [LIGHT, 2, 1, 0] : [LIGHT, 0];
      snap();
      art = {
        w: art.w,
        bg: LIGHT,
        g: lum.map((v) => {
          let t = hi > lo ? (v - lo) / (hi - lo) : 0;
          if (invert) t = 1 - t;
          return ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))];
        }),
      };
      pick($('caBg'), 'data-bg', LIGHT);
      changed();
    }
    $('caFile').addEventListener('change', () => {
      const f = $('caFile').files[0];
      if (!f) return;
      const i = new Image();
      i.onload = () => { img = i; picture(); say('Picture turned into chat art. Try 2 shades for bolder lines.'); URL.revokeObjectURL(i.src); };
      i.onerror = () => say("That file isn't a picture this browser can open.", true);
      i.src = URL.createObjectURL(f);
    });
    $('caInvert').addEventListener('click', (e) => {
      invert = !invert;
      e.currentTarget.setAttribute('aria-checked', invert);
      if (img) picture();
    });

    $('caCopy').addEventListener('click', (e) => copy(line(art), e.currentTarget));
    $('caShare').addEventListener('click', (e) => copy(location.origin + MAKER + '?a=' + encode(art), e.currentTarget, 'Link copied'));

    /* Your art: saved on this device */
    const KEY = 'vl-chatart-saved';
    let saved = store.get(KEY, []).filter((s) => s && typeof s.name === 'string' && decode(s.a));
    function drawSaved() {
      $('cbSaved').textContent = saved.length;
      $('caSaved').innerHTML = saved.length
        ? saved.map((s, i) => card(s.name, chars(decode(s.a)), decode(s.a), () =>
            `<button type="button" class="ca-key" data-load="${i}">Load</button><button type="button" class="ca-key" data-copy="${i}">Copy</button>` +
            `<button type="button" class="ca-key ca-key--x" data-del="${i}" aria-label="Delete ${esc(s.name)}">×</button>`)).join('')
        : '<p class="ca-empty">Nothing saved yet. Name your drawing above and press Save.</p>';
      paintCards($('caSaved'));
    }
    $('caSaveForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('caName').value.trim().slice(0, 24) || 'My art ' + (saved.length + 1);
      saved.unshift({ name, a: encode(art) });
      saved = saved.slice(0, 30);
      store.set(KEY, saved);
      $('caName').value = '';
      drawSaved();
    });
    $('caSaved').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const s = saved[+(b.dataset.load || b.dataset.copy || b.dataset.del)];
      if (!s) return;
      if (b.dataset.load) { load(decode(s.a), s.name); $('caTitle').scrollIntoView({ behavior: 'smooth' }); }
      else if (b.dataset.copy) copy(line(decode(s.a)), b);
      else { saved = saved.filter((x) => x !== s); store.set(KEY, saved); drawSaved(); }
    });

    /* From the gallery: 4 random pieces, Edit loads in place */
    let teaser = [];
    loadGallery().then((d) => {
      teaser = d.art.slice().sort(() => Math.random() - 0.5).slice(0, 4);
      $('caTeaser').innerHTML = teaser.map((p, i) => card(p.name, p.cat, p.a, () =>
        `<button type="button" class="ca-key" data-copy="${i}">Copy</button><button type="button" class="ca-key" data-edit="${i}">Edit</button>`)).join('');
      paintCards($('caTeaser'));
    }).catch(() => { $('caTeaserSec').hidden = true; });
    $('caTeaser').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      const p = b && teaser[+(b.dataset.copy || b.dataset.edit)];
      if (!p) return;
      if (b.dataset.copy) copy(line(p.a), b);
      else { load(setWidth(p.a, art.w), p.name); $('caTitle').scrollIntoView({ behavior: 'smooth' }); }
    });

    pick($('caBrush'), 'data-brush', brush);
    pick($('caBg'), 'data-bg', art.bg);
    redraw();
    drawSaved();
  }

  /* ================= THE GALLERY ================= */
  if ($('cgGrid')) {
    const grid = $('cgGrid');
    say = (t, bad) => { $('cgMsg').textContent = t || ''; $('cgMsg').classList.toggle('is-bad', !!bad); };
    paint($('cbIco'), fromPixels(['.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'], 20, LIGHT, 2), 4);
    let all = [], cat = 'All';
    function draw() {
      const q = $('cgQ').value.trim().toLowerCase();
      const list = all.filter((p) => (cat === 'All' || p.cat === cat) && (!q || (p.name + ' ' + p.cat + ' ' + (p.text || '')).toLowerCase().includes(q)));
      grid.innerHTML = list.length
        ? list.map((p) => card(p.name, p.cat + ' · ' + chars(p.a), p.a, (code) =>
            `<button type="button" class="ca-key" data-copy="${esc(p.id)}">Copy</button><a class="ca-key" href="${MAKER}?a=${code}">Edit</a>`)).join('')
        : '<p class="ca-empty">No drawing matches that. Try another word, or make it yourself in the maker.</p>';
      paintCards(grid);
    }
    loadGallery().then((d) => {
      all = d.art;
      $('cbCount').textContent = all.length;
      $('cbCats').textContent = d.cats.length;
      $('cgCats').innerHTML = ['All'].concat(d.cats).map((c) =>
        `<button type="button" data-cat="${esc(c)}" aria-pressed="${c === 'All'}">${esc(c)} <small>${c === 'All' ? all.length : all.filter((p) => p.cat === c).length}</small></button>`).join('');
      draw();
    }).catch(() => { grid.innerHTML = '<p class="ca-empty">The gallery didn\'t load. Refresh the page to try again.</p>'; });
    $('cgCats').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      cat = b.dataset.cat;
      $('cgCats').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      draw();
    });
    $('cgQ').addEventListener('input', draw);
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-copy]');
      const p = b && all.find((x) => x.id === b.dataset.copy);
      if (p) copy(line(p.a), b);
    });
  }
})();
