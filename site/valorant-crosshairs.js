// Valorant Crosshairs (Oct 30 2026): the maker on /valorant/crosshairs.
// The code is the game's profile code: "0" opens the general block, then key;value pairs, with
// P = primary, A = aim down sights, S = sniper dot. Like the game, only values that differ from
// the default are written (code "0" = the default crosshair). The maker edits P only; the general
// block, A, S and any P key it doesn't know are kept exactly as pasted, so a pro's code survives.
// Key meanings: agatasmurf.com's key table + senslab.pro's defaults (Oct 30 2026). Not documented
// anywhere, inferred from pro codes: f (fade with firing error), 0g/1g (separate vertical length).
(function () {
  'use strict';

  /* ================= CODE ENGINE (no DOM: node can test it) ================= */
  // the game's colour list (index = c), hex = the preview colour
  const COLORS = [
    ['White', 'FFFFFF'], ['Green', '00FF00'], ['Yellow green', '7FFF00'], ['Green yellow', 'DFFF00'],
    ['Yellow', 'FFFF00'], ['Cyan', '00FFFF'], ['Pink', 'FF00FF'], ['Red', 'FF0000'],
  ];
  // the primary crosshair of code "0"
  const DEF = {
    c: '0', h: '1', t: '1', o: '0.5', d: '0', z: '2', a: '1', f: '1',
    '0b': '1', '0t': '2', '0l': '6', '0v': '6', '0g': '0', '0o': '3', '0a': '0.8', '0m': '0', '0s': '1', '0f': '1', '0e': '1',
    '1b': '1', '1t': '2', '1l': '2', '1v': '2', '1g': '0', '1o': '10', '1a': '0.35', '1m': '1', '1s': '1', '1f': '1', '1e': '1',
  };
  const LINE = ['b', 't', 'l', 'v', 'g', 'o', 'a', 'm', 's', 'f', 'e'];
  const ORDER = ['c', 'u', 'h', 't', 'o', 'd', 'z', 'a', 'b', 'f', 's', 'm'].concat(LINE.map((k) => '0' + k), LINE.map((k) => '1' + k));
  const rank = (k) => (ORDER.includes(k) ? ORDER.indexOf(k) : 999);

  function parse(code) {
    const tok = String(code || '').trim().split(';').map((s) => s.trim());
    if (tok[tok.length - 1] === '') tok.pop();
    if (tok[0] !== '0') throw new Error('A Valorant crosshair code starts with "0;".');
    const x = { G: [], P: {}, A: [], S: [] };
    let sec = 'G';
    for (let i = 1; i < tok.length; i++) {
      const k = tok[i];
      if (k === 'P' || k === 'A' || k === 'S') { sec = k; continue; }
      const v = tok[++i];
      // keys and values reach the page's markup: letters, digits, dots only
      if (v === undefined || !/^[0-9a-zA-Z]{1,3}$/.test(k) || !/^[0-9A-Fa-f.]{1,12}$/.test(v)) {
        throw new Error('That code is cut off or has a typo near "' + k.slice(0, 12) + '".');
      }
      if (sec === 'P') x.P[k] = v;
      else x[sec].push([k, v]);
    }
    return x;
  }

  // a P key the code must carry: not a default (u and a used vertical length always go)
  function carries(P, k) {
    if (k === 'u') return true;
    if (/^[01]v$/.test(k) && P[k[0] + 'g'] === '1') return true;
    return !(k in DEF) || parseFloat(P[k]) !== parseFloat(DEF[k]);
  }

  function build(x) {
    const out = ['0'];
    x.G.forEach((kv) => out.push(kv[0], kv[1]));
    const p = Object.keys(x.P).filter((k) => carries(x.P, k)).sort((a, b) => rank(a) - rank(b));
    if (p.length) out.push('P', ...p.flatMap((k) => [k, x.P[k]]));
    ['A', 'S'].forEach((s) => { if (x[s].length) out.push(s, ...x[s].flat()); });
    return out.join(';');
  }

  const val = (x, k) => parseFloat(x.P[k] !== undefined ? x.P[k] : DEF[k]);
  const on = (x, k) => val(x, k) === 1;
  function colorOf(x) {
    const c = val(x, 'c');
    if (c === 8) return '#' + (/^[0-9A-Fa-f]{6}/.test(x.P.u || '') ? x.P.u.slice(0, 6) : 'FFFFFF');
    return '#' + (COLORS[c] || COLORS[0])[1];
  }

  const engine = { COLORS, DEF, parse, build, val, colorOf };
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (typeof document === 'undefined') return;

  /* ================= DRAWING ================= */
  // Crosshair at (cx, cy), `u` device pixels per game pixel. err = { move, fire } from 0 to 1.
  function drawCross(ctx, x, cx, cy, u, err) {
    const col = colorOf(x);
    const outline = on(x, 'h');
    const ot = val(x, 't');
    const oa = val(x, 'o');
    const fade = on(x, 'f');
    const fills = [];
    const outs = [];
    const R = (gx, gy, gw, gh) => {
      const x0 = Math.round(cx + gx * u);
      const y0 = Math.round(cy + gy * u);
      return [x0, y0, Math.max(1, Math.round(cx + (gx + gw) * u) - x0), Math.max(1, Math.round(cy + (gy + gh) * u) - y0)];
    };
    const piece = (gx, gy, gw, gh, alpha) => {
      fills.push([R(gx, gy, gw, gh), alpha]);
      if (outline && ot > 0) outs.push([R(gx - ot, gy - ot, gw + ot * 2, gh + ot * 2), oa]);
    };

    ['0', '1'].forEach((p) => {
      if (!on(x, p + 'b')) return;
      const t = val(x, p + 't');
      const l = val(x, p + 'l');
      const lv = on(x, p + 'g') ? val(x, p + 'v') : l;
      let a = val(x, p + 'a');
      // movement / firing error push the lines out (preview numbers, not the game's exact curve)
      let o = val(x, p + 'o');
      if (on(x, p + 'm')) o += err.move * 7 * val(x, p + 's');
      if (on(x, p + 'f')) {
        o += err.fire * 10 * val(x, p + 'e');
        if (fade) a *= 1 - 0.65 * err.fire;
      }
      if (t <= 0 || a <= 0) return;
      if (l > 0) {
        piece(o, -t / 2, l, t, a);
        piece(-o - l, -t / 2, l, t, a);
      }
      if (lv > 0) {
        piece(-t / 2, o, t, lv, a);
        piece(-t / 2, -o - lv, t, lv, a);
      }
    });
    if (on(x, 'd')) {
      const z = val(x, 'z');
      piece(-z / 2, -z / 2, z, z, val(x, 'a'));
    }
    ctx.fillStyle = '#000';
    outs.forEach(([r, al]) => { ctx.globalAlpha = al; ctx.fillRect(...r); });
    ctx.fillStyle = col;
    fills.forEach(([r, al]) => { ctx.globalAlpha = al; ctx.fillRect(...r); });
    ctx.globalAlpha = 1;
  }

  // background: a flat colour, a texture tile repeated at `ts` device px per texture px, or a map
  // shot (cover, at least `ih` device px tall, centred)
  function drawBg(ctx, bg, W, H, ih, ts) {
    ctx.fillStyle = bg.flat || '#0b0c0e';
    ctx.fillRect(0, 0, W, H);
    const im = bg.flat ? null : picture(bg.src);
    if (!im || !im.naturalWidth) return;
    if (bg.tex) {
      const pat = ctx.createPattern(im, 'repeat');
      // this texture spot sits under the crosshair: inside a block / plank on every tile, never on a seam
      pat.setTransform(new DOMMatrix().translateSelf(W / 2 - 154 * ts, H / 2 - 215 * ts).scaleSelf(ts));
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const s = Math.max(W / im.naturalWidth, H / im.naturalHeight, ih / im.naturalHeight);
    const w = im.naturalWidth * s;
    const h = im.naturalHeight * s;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  }

  const pics = {};
  function picture(src) {
    if (!pics[src]) {
      pics[src] = new Image();
      pics[src].decoding = 'async';
      pics[src].onload = () => { drawAll(); };
      pics[src].src = src;
    }
    return pics[src];
  }

  /* ================= DATA ================= */
  const MAPS = [
    ['summit', 'Summit'], ['corrode', 'Corrode'], ['abyss', 'Abyss'], ['sunset', 'Sunset'], ['lotus', 'Lotus'],
    ['pearl', 'Pearl'], ['fracture', 'Fracture'], ['breeze', 'Breeze'], ['icebox', 'Icebox'], ['ascent', 'Ascent'],
    ['split', 'Split'], ['haven', 'Haven'], ['bind', 'Bind'], ['glitch', 'Glitch'], ['drift', 'Drift'],
    ['district', 'District'], ['kasbah', 'Kasbah'], ['piazza', 'Piazza'], ['gauntlet', 'Gauntlet'],
    ['skirmish', 'Skirmish'], ['basic-training', 'Basic Training'], ['the-range', 'The Range'],
  ];
  // our own seamless surfaces, baked by scripts/valorant-crosshair-backgrounds.py (same ids there)
  const TEXTURES = [
    ['sandstone', 'Sandstone'], ['stone-floor', 'Stone floor'], ['brick', 'Brick'], ['crate', 'Crate'],
    ['metal', 'Container'], ['concrete', 'Concrete'], ['tile-floor', 'Tiles'], ['snow', 'Snow'],
    ['foliage', 'Foliage'], ['sky', 'Sky'],
  ];
  const T = '/images/valorant/crosshairs/';
  const BGS = TEXTURES.map(([id, name]) => ({ id, name, group: 'tex', tex: true, src: T + 'tex-' + id + '.webp', tile: T + 'tex-' + id + '-tile.webp' }))
    .concat([
      { id: 'flat-dark', name: 'Dark', group: 'tex', flat: '#0b0c0e' },
      { id: 'flat-light', name: 'Bright', group: 'tex', flat: '#ecebe6' },
    ])
    .concat(MAPS.map(([slug, name]) => ({ id: slug, name, group: 'map', src: '/images/valorant/maps/' + slug + '.webp', card: '/images/valorant/maps/' + slug + '-card.webp', tile: T + slug + '.webp' })));

  // Parchrome's own starters (made in this maker, nobody's settings)
  const STARTERS = [
    ['Default', '0'],
    ['Small cross', '0;P;h;0;0l;4;0o;2;0a;1;0f;0;1b;0'],
    ['Cyan cross', '0;P;c;5;h;0;0l;4;0o;2;0a;1;0f;0;1b;0'],
    ['Dot', '0;P;c;5;h;0;d;1;z;4;0b;0;1b;0'],
    ['Plus and dot', '0;P;c;1;o;1;d;1;0l;3;0o;3;0a;1;0f;0;1b;0'],
    ['Wide gap', '0;P;o;1;0l;5;0o;6;0a;1;0f;0;1b;0'],
    ['Pink plus', '0;P;c;8;u;FF66CCFF;h;0;0l;3;0o;1;0a;1;0f;0;1b;0'],
    ['Two rings', '0;P;c;4;h;0;f;0;0l;3;0o;2;0a;1;0f;0;1l;2;1o;6;1a;0.5;1m;0;1f;0'],
  ];

  const ROWS_LINE = (p, name) => [
    { tog: p + 'b', label: 'Show ' + name },
    { num: p + 'a', label: 'Opacity', min: 0, max: 1, step: 0.01, when: [p + 'b'] },
    { num: p + 'l', label: 'Length', min: 0, max: 20, step: 1, when: [p + 'b'] },
    { tog: p + 'g', label: 'Separate vertical length', when: [p + 'b'] },
    { num: p + 'v', label: 'Vertical length', min: 0, max: 20, step: 1, when: [p + 'b', p + 'g'] },
    { num: p + 't', label: 'Thickness', min: 0, max: 10, step: 1, when: [p + 'b'] },
    { num: p + 'o', label: 'Offset', min: 0, max: 20, step: 1, when: [p + 'b'] },
    { head: 'Error' },
    { tog: p + 'm', label: 'Movement error', when: [p + 'b'] },
    { tog: p + 'f', label: 'Firing error', when: [p + 'b'] },
  ];
  const TABS = [
    ['Crosshair', [
      { color: true },
      { head: 'Outlines' },
      { tog: 'h', label: 'Outlines' },
      { num: 'o', label: 'Opacity', min: 0, max: 1, step: 0.01, when: ['h'] },
      { num: 't', label: 'Thickness', min: 1, max: 6, step: 1, when: ['h'] },
      { head: 'Center dot' },
      { tog: 'd', label: 'Center dot' },
      { num: 'a', label: 'Opacity', min: 0, max: 1, step: 0.01, when: ['d'] },
      { num: 'z', label: 'Thickness', min: 1, max: 6, step: 1, when: ['d'] },
      { head: 'Firing' },
      { tog: 'f', label: 'Fade with firing error' },
    ]],
    ['Inner lines', ROWS_LINE('0', 'inner lines')],
    ['Outer lines', ROWS_LINE('1', 'outer lines')],
  ];

  // "Inside the code": names for every key we can name; the rest say "kept as is"
  const NAMES = {
    c: 'Colour', u: 'Custom colour', h: 'Outlines', t: 'Outline thickness', o: 'Outline opacity',
    d: 'Center dot', z: 'Center dot thickness', a: 'Center dot opacity', f: 'Fade with firing error',
  };
  const LNAMES = { b: 'Show', t: 'Thickness', l: 'Length', v: 'Vertical length', g: 'Separate vertical length', o: 'Offset', a: 'Opacity', m: 'Movement error', f: 'Firing error' };
  const SNAMES = { c: 'Dot colour', s: 'Dot size', o: 'Dot opacity', t: 'Custom dot colour' };
  const TOGS = new Set(['h', 'd', 'f', '0b', '0g', '0m', '0f', '1b', '1g', '1m', '1f']);

  /* ================= STATE ================= */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window: fine */ } },
  };

  let x = parse('0');
  let tab = 0;
  let zoom = 2;
  let test = 'still';
  let err = { move: 0, fire: 0 };
  let bg = BGS.find((b) => b.id === store.get('vl-xh-bg', 'sandstone')) || BGS[0];
  let bgGroup = bg.group;
  let saved = store.get('vl-xh-saved', []).filter((s) => s && typeof s.n === 'string' && ok(s.c)).slice(0, 48);

  function ok(code) { try { parse(code); return true; } catch (e) { return false; } }

  const q = new URLSearchParams(location.search).get('c');
  if (q && ok(q)) x = parse(q);

  /* ================= STAGE ================= */
  const stage = $('xhStage');
  const cv = $('xhCanvas');
  const ctx = cv.getContext('2d');
  const dpr = () => Math.min(window.devicePixelRatio || 1, 3);

  function drawStage() {
    const W = cv.width;
    const H = cv.height;
    if (!W) return;
    // 1x = real size: one game pixel per screen pixel and the map at a 1080p screen's scale,
    // so the box shows the middle of your monitor; 2x-8x magnify both
    const u = dpr() * zoom;
    drawBg(ctx, bg, W, H, 1080 * u, u);
    drawCross(ctx, x, Math.floor(W / 2), Math.floor(H / 2), u, err);
  }
  function fit() {
    const r = stage.getBoundingClientRect();
    cv.width = Math.round(r.width * dpr());
    cv.height = Math.round(r.height * dpr());
    drawStage();
  }
  new ResizeObserver(fit).observe(stage);

  function drawIcon() {
    const c = $('cbIco');
    const k = dpr();
    if (c.width !== 104 * k) { c.width = c.height = 104 * k; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    drawCross(g, x, c.width / 2, c.height / 2, 3 * k, { move: 0, fire: 0 });
  }

  // one canvas per starter / saved card: the card's code on the picked background
  function drawCard(c) {
    const k = dpr();
    const r = c.getBoundingClientRect();
    if (!r.width) return;
    c.width = Math.round(r.width * k);
    c.height = Math.round(r.height * k);
    const g = c.getContext('2d');
    drawBg(g, bg.group === 'map' ? { src: bg.card } : bg, c.width, c.height, c.height * 1.6, c.height / 288);
    drawCross(g, parse(c.dataset.code), Math.floor(c.width / 2), Math.floor(c.height / 2), Math.max(1, Math.round(1.6 * k)), { move: 0, fire: 0 });
  }
  function drawCards() { document.querySelectorAll('canvas[data-code]').forEach(drawCard); }

  function drawAll() { drawStage(); drawCards(); }

  // walk = the lines push out and bob; spray = they kick out per shot and settle back
  let raf = 0;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  function loop(t) {
    const s = t / 1000;
    if (test === 'walk') err = { move: 0.85 + 0.15 * Math.sin(s * 9), fire: 0 };
    else if (test === 'spray') err = { move: 0, fire: Math.min(1, 0.35 + 0.65 * (1 - ((s * 10) % 1))) };
    drawStage();
    raf = test !== 'still' && !still.matches ? requestAnimationFrame(loop) : 0;
  }
  function setTest(v) {
    test = v;
    cancelAnimationFrame(raf);
    err = v === 'walk' ? { move: 1, fire: 0 } : v === 'spray' ? { move: 0, fire: 1 } : { move: 0, fire: 0 };
    pressed($('xhTest'), 'test', v);
    const tag = $('xhTestTag');
    tag.hidden = v === 'still';
    tag.textContent = v === 'walk' ? 'Walking' : 'Spraying';
    if (v !== 'still' && !still.matches) raf = requestAnimationFrame(loop);
    else drawStage();
  }

  function pressed(group, key, v) {
    group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[key] === String(v))));
  }

  $('xhZoom').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    zoom = +b.dataset.zoom;
    pressed($('xhZoom'), 'zoom', zoom);
    $('xhZoomTag').textContent = zoom === 1 ? 'Real size' : zoom + 'x zoom';
    drawStage();
  });
  $('xhTest').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) setTest(b.dataset.test);
  });

  /* ================= PANEL ================= */
  const rowsEl = $('xhRows');
  const tabsEl = $('xhTabs');
  tabsEl.innerHTML = TABS.map((t, i) => `<button type="button" role="tab" data-tab="${i}" aria-pressed="${i === tab}">${t[0]}</button>`).join('');
  tabsEl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    tab = +b.dataset.tab;
    pressed(tabsEl, 'tab', tab);
    renderRows();
  });

  function renderRows() {
    rowsEl.innerHTML = TABS[tab][1].map((r) => {
      if (r.head) return `<p class="xh-head">${r.head}</p>`;
      if (r.color) {
        const c = val(x, 'c');
        const custom = /^[0-9A-Fa-f]{6}/.test(x.P.u || '') ? x.P.u.slice(0, 6) : 'FF4655';
        return `<div class="xh-row xh-row--color"><span class="xh-lab">Colour</span><div class="xh-swatches">` +
          COLORS.map((cc, i) => `<button type="button" class="xh-sw" style="--c:#${cc[1]}" data-color="${i}" aria-pressed="${c === i}" title="${cc[0]}"><span class="xh-sr">${cc[0]}</span></button>`).join('') +
          `<label class="xh-sw xh-sw--custom" style="--c:#${custom}" aria-pressed="${c === 8}" title="Custom colour"><input type="color" id="xhPick" value="#${custom.toLowerCase()}"><span class="xh-sr">Custom colour</span></label>` +
          `<input class="xh-hex" id="xhHex" type="text" value="${esc((c === 8 ? custom : colorOf(x).slice(1)).toUpperCase())}" maxlength="6" spellcheck="false" aria-label="Custom colour hex"></div></div>`;
      }
      const off = (r.when || []).some((k) => !on(x, k));
      if (r.tog) {
        return `<div class="xh-row${off ? ' is-off' : ''}"><span class="xh-lab" id="xl-${r.tog}">${r.label}</span>` +
          `<button type="button" class="xh-tog" role="switch" data-k="${r.tog}" aria-checked="${on(x, r.tog)}" aria-labelledby="xl-${r.tog}"${off ? ' disabled' : ''}><i></i></button></div>`;
      }
      const v = val(x, r.num);
      const fill = Math.max(0, Math.min(100, ((v - r.min) / (r.max - r.min)) * 100));
      return `<div class="xh-row xh-row--num${off ? ' is-off' : ''}"><label class="xh-lab" for="xr-${r.num}">${r.label}</label>` +
        `<input class="xh-range" type="range" id="xr-${r.num}" data-k="${r.num}" min="${r.min}" max="${r.max}" step="${r.step}" value="${v}" style="--fill:${fill}%"${off ? ' disabled' : ''}>` +
        `<input class="xh-num" type="number" data-k="${r.num}" min="${r.min}" max="${r.max}" step="${r.step}" value="${v}" aria-label="${r.label}"${off ? ' disabled' : ''}></div>`;
    }).join('');
  }

  // the game writes opacities with up to 3 decimals; whole numbers stay whole
  const fmt = (v, step) => (step < 1 ? String(Math.round(v * 1000) / 1000) : String(Math.round(v)));
  function rowOf(k) { return TABS.flatMap((t) => t[1]).find((r) => r.num === k || r.tog === k); }

  rowsEl.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'xhPick') { setCustom(el.value.slice(1)); return; }
    if (el.id === 'xhHex') {
      const h = el.value.replace(/[^0-9a-f]/gi, '');
      if (h.length === 6) setCustom(h);
      return;
    }
    const k = el.dataset.k;
    if (!k) return;
    const r = rowOf(k);
    let v = parseFloat(el.value);
    if (isNaN(v)) return;
    v = Math.max(r.min, Math.min(r.max, v));
    x.P[k] = fmt(v, r.step);
    // keep the twin control (slider <-> number) in step without redrawing the panel
    el.closest('.xh-row').querySelectorAll('[data-k]').forEach((t) => {
      if (t !== el) t.value = v;
      if (t.type === 'range') t.style.setProperty('--fill', ((v - r.min) / (r.max - r.min)) * 100 + '%');
    });
    changed(false);
  });
  rowsEl.addEventListener('click', (e) => {
    const sw = e.target.closest('[data-color]');
    if (sw) { x.P.c = sw.dataset.color; changed(true); return; }
    const t = e.target.closest('.xh-tog');
    if (!t) return;
    const k = t.dataset.k;
    x.P[k] = on(x, k) ? '0' : '1';
    // first time the vertical length is split off, start it at the current length
    if (/^[01]g$/.test(k) && x.P[k] === '1' && x.P[k[0] + 'v'] === undefined) x.P[k[0] + 'v'] = fmt(val(x, k[0] + 'l'), 1);
    changed(true);
  });
  function setCustom(hex) {
    x.P.c = '8';
    x.P.u = hex.toUpperCase() + 'FF';
    const lab = rowsEl.querySelector('.xh-sw--custom');
    if (lab) lab.style.setProperty('--c', '#' + hex);
    rowsEl.querySelectorAll('.xh-sw').forEach((s) => s.setAttribute('aria-pressed', String(s === lab)));
    const pick = $('xhPick');
    const box = $('xhHex');
    if (pick && document.activeElement !== pick) pick.value = '#' + hex.toLowerCase();
    if (box && document.activeElement !== box) box.value = hex.toUpperCase();
    changed(false);
  }

  /* ================= CODE DOCK ================= */
  let urlTimer = 0;
  function changed(redrawPanel) {
    if (redrawPanel) renderRows();
    const code = build(x);
    $('xhCode').textContent = code;
    const extra = [x.A.length && 'ADS', x.S.length && 'Sniper'].filter(Boolean);
    $('xhExtra').hidden = !extra.length;
    $('xhExtra').textContent = extra.length ? '+ ' + extra.join(' and ') + ' settings kept' : '';
    drawStage();
    drawIcon();
    renderRead();
    // the address always holds the crosshair: reload keeps it, Link shares it
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => history.replaceState(history.state, '', linkTo(code, true)), 250);
  }

  // ?c=<code> with its semicolons left readable (they're legal in a query; get() reads both)
  const linkTo = (code, hash) => location.pathname + (code === '0' ? '' : '?c=' + code) + (hash ? location.hash : '');

  function say(msg, bad) {
    const m = $('xhMsg');
    m.textContent = msg;
    m.classList.toggle('is-bad', !!bad);
  }

  function copy(text, btn, done) {
    const flash = () => {
      const old = btn.textContent;
      btn.textContent = done || 'Copied';
      btn.classList.add('is-done');
      setTimeout(() => { btn.textContent = old; btn.classList.remove('is-done'); }, 1400);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(flash, () => say('Copy failed: select the code and copy it by hand.', true));
    else say('Copy failed: select the code and copy it by hand.', true);
  }

  function load(code, from) {
    try {
      x = parse(code);
    } catch (e) {
      say(e.message, true);
      return false;
    }
    changed(true);
    say(from ? from + ' loaded.' : '');
    return true;
  }

  $('xhCopy').addEventListener('click', (e) => copy(build(x), e.currentTarget));
  $('xhShare').addEventListener('click', (e) => copy(location.origin + linkTo(build(x)), e.currentTarget, 'Link copied'));
  $('xhReset').addEventListener('click', () => load('0', 'The default crosshair'));
  $('xhPng').addEventListener('click', () => {
    cv.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'valorant-crosshair-' + bg.id + '.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  });
  $('xhImport').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('xhPaste').value.trim();
    if (!v) { say('Paste a code first.', true); return; }
    if (load(v, 'Your code')) $('xhPaste').value = '';
  });

  /* ================= BACKGROUNDS ================= */
  const bgsEl = $('xhBgs');
  function renderBgs() {
    pressed($('xhBgTabs'), 'group', bgGroup);
    bgsEl.innerHTML = BGS.filter((b) => b.group === bgGroup).map((b) =>
      `<button type="button" class="xh-bg" role="radio" data-bg="${b.id}" aria-checked="${b === bg}"${b.flat ? ` style="--flat:${b.flat}"` : ''}>` +
      (b.flat ? '<span class="xh-bg-pic xh-bg-pic--flat"></span>' : `<span class="xh-bg-pic"><img src="${b.tile}" alt="" width="240" height="135" decoding="async"></span>`) +
      `<b>${b.name}</b></button>`).join('');
  }
  $('xhBgTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.dataset.group === bgGroup) return;
    bgGroup = b.dataset.group;
    renderBgs();
  });
  $('cbBgCount').textContent = BGS.length;
  bgsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-bg]');
    if (b) setBg(b.dataset.bg);
  });
  function setBg(id) {
    bg = BGS.find((b) => b.id === id) || bg;
    store.set('vl-xh-bg', bg.id);
    bgsEl.querySelectorAll('[data-bg]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.bg === bg.id)));
    $('xhMapName').textContent = bg.name;
    stage.classList.toggle('is-light', bg.id === 'flat-light');
    drawAll();
  }

  /* ================= STARTERS + SAVED ================= */
  function card(name, code, i, mine) {
    return `<article class="xh-card">` +
      `<button type="button" class="xh-card-pic" data-load="${i}" data-mine="${mine ? 1 : ''}" aria-label="Load ${esc(name)} into the maker"><canvas data-code="${esc(code)}"></canvas></button>` +
      `<div class="xh-card-txt"><b>${esc(name)}</b><code>${esc(code)}</code></div>` +
      `<div class="xh-card-keys"><button type="button" class="xh-key" data-copy="${i}" data-mine="${mine ? 1 : ''}">Copy</button>` +
      `<button type="button" class="xh-key" data-load="${i}" data-mine="${mine ? 1 : ''}">Edit</button>` +
      (mine ? `<button type="button" class="xh-key xh-key--x" data-del="${i}" aria-label="Delete ${esc(name)}">&times;</button>` : '') +
      `</div></article>`;
  }
  $('xhStarters').innerHTML = STARTERS.map((s, i) => card(s[0], s[1], i, false)).join('');

  function renderSaved() {
    $('xhSaved').innerHTML = saved.length
      ? saved.map((s, i) => card(s.n, s.c, i, true)).join('')
      : '<p class="xh-empty">Nothing saved yet. Make a crosshair, give it a name above and press Save.</p>';
    $('cbSaved').textContent = saved.length;
    $('xhSaved').querySelectorAll('canvas[data-code]').forEach(drawCard);
  }
  renderSaved();

  function onCards(e) {
    const b = e.target.closest('[data-load],[data-copy],[data-del]');
    if (!b) return;
    const list = b.dataset.mine ? saved.map((s) => [s.n, s.c]) : STARTERS;
    if (b.dataset.del !== undefined) {
      saved.splice(+b.dataset.del, 1);
      store.set('vl-xh-saved', saved);
      renderSaved();
      return;
    }
    const it = list[+(b.dataset.load !== undefined ? b.dataset.load : b.dataset.copy)];
    if (!it) return;
    if (b.dataset.copy !== undefined) { copy(it[1], b); return; }
    if (load(it[1], it[0])) $('xhTitle').scrollIntoView({ behavior: still.matches ? 'auto' : 'smooth', block: 'start' });
  }
  $('xhStarters').addEventListener('click', onCards);
  $('xhSaved').addEventListener('click', onCards);

  $('xhSaveForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('xhName').value.trim().slice(0, 24) || 'Crosshair ' + (saved.length + 1);
    const code = build(x);
    const same = saved.findIndex((s) => s.n.toLowerCase() === name.toLowerCase());
    if (same > -1) saved.splice(same, 1);
    saved.unshift({ n: name, c: code });
    saved = saved.slice(0, 48);
    store.set('vl-xh-saved', saved);
    $('xhName').value = '';
    renderSaved();
  });

  /* ================= INSIDE THE CODE ================= */
  function words(k, v, sec) {
    const n = parseFloat(v);
    if (sec === 'P' && TOGS.has(k)) return n === 1 ? 'On' : 'Off';
    if ((k === 'c' && sec !== 'G') && COLORS[n]) return `<i class="xh-dot" style="--c:#${COLORS[n][1]}"></i>${COLORS[n][0]}`;
    if (k === 'c' && n === 8 && sec !== 'G') return 'Custom';
    if ((sec === 'P' && k === 'u') || (sec === 'S' && k === 't')) return `<i class="xh-dot" style="--c:#${esc(v.slice(0, 6))}"></i>#${esc(v.slice(0, 6).toUpperCase())}`;
    return esc(v);
  }
  function li(k, v, name, sec) {
    return `<li${name ? '' : ' class="is-unk"'}><code>${esc(k)}</code><span>${name || 'Not documented, kept as is'}</span><b>${words(k, v, sec)}</b></li>`;
  }
  function renderRead() {
    const P = Object.keys(x.P).filter((k) => carries(x.P, k)).sort((a, b) => rank(a) - rank(b));
    const groups = [];
    const top = P.filter((k) => !/^[01]/.test(k));
    if (top.length) groups.push(['Crosshair', top.map((k) => li(k, x.P[k], NAMES[k], 'P'))]);
    [['0', 'Inner lines'], ['1', 'Outer lines']].forEach(([p, title]) => {
      const ks = P.filter((k) => k[0] === p);
      if (ks.length) groups.push([title, ks.map((k) => li(k, x.P[k], LNAMES[k.slice(1)], 'P'))]);
    });
    if (x.A.length) groups.push(['Aim down sights', x.A.map(([k, v]) => li(k, v, '', 'A'))]);
    if (x.S.length) groups.push(['Sniper dot', x.S.map(([k, v]) => li(k, v, SNAMES[k], 'S'))]);
    if (x.G.length) groups.push(['General', x.G.map(([k, v]) => li(k, v, '', 'G'))]);
    $('xhRead').innerHTML = groups.length
      ? groups.map(([t, rows]) => `<div class="xh-read-box"><h3>${t}</h3><ul>${rows.join('')}</ul></div>`).join('')
      : '<p class="xh-empty">This is code <code>0</code>: the game\'s default crosshair. Change anything in the maker and every setting it writes shows up here.</p>';
  }

  /* ================= GO ================= */
  // the live patch, from the daily weapons feed (scripts/valorant-feed.mjs)
  fetch('/valorant-weapons.json').then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (!d || !d.patch) return;
    $('cbPatch').querySelector('b').textContent = d.patch.branch;
    $('cbPatch').hidden = false;
  }).catch(() => {});

  pressed($('xhZoom'), 'zoom', zoom);
  $('xhZoomTag').textContent = zoom + 'x zoom';
  renderBgs();
  setBg(bg.id);
  changed(true);
  // card canvases are sized by CSS: draw again once the layout has settled
  new ResizeObserver(() => drawCards()).observe($('xhStarters'));
})();
