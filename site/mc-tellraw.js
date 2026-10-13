/* Tellraw editor (Oct 13 2026), /minecraft/tools/tellraw. Text components (mc-text.js)
   sent as chat (/tellraw), a title, a subtitle or the action bar, previewed on a game
   screen drawn with the game's font and HUD sprites. Hover a part in the preview to
   see its hover text, like in game. Outputs for 1.21.5+ (SNBT text), 1.16-1.21.4
   (JSON), 1.13-1.15 (JSON, old hover) and Bedrock (rawtext, no click or hover).
   Game sizes: chat at 1x with a 50% black backing 320 px wide, titles at 4x and
   subtitles at 2x centred, the action bar 2x above the hotbar.
   Copy: mc-home.js. Styles: TELLRAW block in mc-home.css (.tr-*). */
(function () {
  var host = document.getElementById('trEditor');
  if (!host) return;
  var $ = function (id) { return document.getElementById(id); };
  // redraw when the column's width changes (height follows the canvas, so ignore it)
  function watch(el, fn) {
    var w = 0;
    new ResizeObserver(function () { var nw = el.clientWidth; if (nw !== w) { w = nw; requestAnimationFrame(fn); } }).observe(el);
  }
  var F = McFont, T = McText;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var s = { mode: 'chat', ver: 2, hits: [], mouse: null };
  function c(text, extra) { var o = T.blank('text'); o.text = text; for (var k in extra) o[k] = extra[k]; return o; }
  var start = [
    c('[Parchrome] ', { color: 'gold', bold: true }),
    c('Welcome, ', { color: 'gray' }),
    (function () { var o = T.blank('selector'); o.color = 'yellow'; return o; })(),
    c('! ', { color: 'gray' }),
    c('Click to see the rules', { color: 'aqua', underlined: true, click: { action: 'run_command', value: '/trigger rules' }, hover: 'Opens the server rules' })
  ];
  var ed = T.editor(host, { value: start, onChange: render });
  var hud = { bar: new Image(), sel: new Image(), heart: new Image(), food: new Image() };
  hud.bar.src = '/minecrafticons/gui/hotbar.png'; hud.sel.src = '/minecrafticons/gui/hotbar_selection.png';
  hud.heart.src = '/minecrafticons/gui/heart_full.png'; hud.food.src = '/minecrafticons/gui/food_full.png';
  Object.keys(hud).forEach(function (k) { hud[k].onload = draw; });

  // ---- commands ----
  function command() {
    var list = ed.get(), tgt = $('trTarget').value;
    if (s.ver === 3) {
      var raw = T.rawtext(list);
      if (s.mode === 'chat') return '/tellraw ' + tgt + ' ' + raw;
      return '/titleraw ' + tgt + ' ' + (s.mode === 'actionbar' ? 'actionbar' : s.mode) + ' ' + raw;
    }
    var txt = s.ver === 2 ? T.snbt(list) : T.json(list, s.ver === 0);
    if (s.mode === 'chat') return '/tellraw ' + tgt + ' ' + txt;
    return '/title ' + tgt + ' ' + s.mode + ' ' + txt;
  }
  function extra() {
    if (s.mode === 'chat' || s.mode === 'actionbar') return '';
    var t = [$('trIn').value || 10, $('trStay').value || 70, $('trOut').value || 20];
    return '/title ' + $('trTarget').value + ' times ' + t.join(' ');
  }

  // ---- the game screen ----
  var cv = $('trCanvas'), raf = 0;
  function draw() {
    var W = cv.parentNode.clientWidth, H = Math.round(W * 0.62), dpr = Math.min(2, window.devicePixelRatio || 1);
    var g = W >= 380 ? 2 : 1; // GUI scale, like the game's: 2 once the hotbar fits
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
    var x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.imageSmoothingEnabled = false;
    // a dusk sky over dark hills, so text reads as it does in game
    var sky = x.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#2b3c63'); sky.addColorStop(0.55, '#7a6f8f'); sky.addColorStop(0.56, '#2e3b2c'); sky.addColorStop(1, '#1d2619');
    x.fillStyle = sky; x.fillRect(0, 0, W, H);
    x.fillStyle = '#25301f';
    for (var i = 0; i < W; i += 8 * g) { var hh = (Math.sin(i * 0.013) + Math.sin(i * 0.031)) * 6 * g; x.fillRect(i, H * 0.56 - hh, 8 * g, hh + 2); }
    // HUD: hotbar, hearts, food
    var bw = 182 * g, bx = Math.round((W - bw) / 2), by = H - 23 * g;
    if (hud.bar.naturalWidth) x.drawImage(hud.bar, bx, by, bw, 22 * g);
    if (hud.sel.naturalWidth) x.drawImage(hud.sel, bx - g, by - g, 24 * g, 23 * g);
    for (i = 0; i < 10; i++) {
      if (hud.heart.naturalWidth) x.drawImage(hud.heart, bx + i * 8 * g, by - 10 * g, 9 * g, 9 * g);
      if (hud.food.naturalWidth) x.drawImage(hud.food, bx + bw - 9 * g - i * 8 * g, by - 10 * g, 9 * g, 9 * g);
    }
    var list = ed.get(), runs = T.runs(list, 'ffffff');
    s.hits = [];
    var obf = F.hasObf(runs);
    if (s.mode === 'chat') {
      var chatW = Math.min(320, Math.floor(W / g) - 8), lines = F.wrap(runs, chatW - 4), lh = 9 * g, top = by - 22 * g - lines.length * lh;
      lines.forEach(function (ln, li) {
        var y = top + li * lh;
        x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(2 * g, y, chatW * g, lh);
        hitDraw(x, ln, 4 * g, y + g, g);
      });
    } else if (s.mode === 'actionbar') {
      var aw = F.width(runs) * g;
      hitDraw(x, runs, Math.round((W - aw) / 2), by - 31 * g, g);
    } else {
      var big = s.mode === 'title' ? 4 * g : 2 * g, tw = F.width(runs) * big;
      if (tw > W - 16) big = Math.max(1, Math.floor((W - 16) / F.width(runs)));
      tw = F.width(runs) * big;
      hitDraw(x, runs, Math.round((W - tw) / 2), Math.round(H * (s.mode === 'title' ? 0.32 : 0.5)), big);
      if (s.mode === 'subtitle') { x.globalAlpha = 0.35; F.draw(x, [{ text: 'Title goes here', color: 'ffffff' }], Math.round((W - F.width([{ text: 'Title goes here' }]) * 4 * g) / 2), Math.round(H * 0.32), { scale: 4 * g }); x.globalAlpha = 1; }
    }
    // hover tooltip, like the game's: dark purple-edged box at the mouse
    if (s.mouse) {
      var hit = s.hits.filter(function (h) { return s.mouse[0] >= h.x && s.mouse[0] <= h.x + h.w && s.mouse[1] >= h.y && s.mouse[1] <= h.y + h.h; })[0];
      cv.style.cursor = hit && (hit.c.click || hit.c.hover) ? 'pointer' : 'default';
      if (hit && hit.c.hover) {
        var tr = F.parse(hit.c.hover), tw2 = F.width(tr) * g, tx = Math.min(W - tw2 - 10 * g, s.mouse[0] + 12), ty = Math.max(4, s.mouse[1] - 14 * g);
        x.fillStyle = 'rgba(16,0,16,0.94)'; x.fillRect(tx - 3 * g, ty - 3 * g, tw2 + 6 * g, 14 * g);
        x.strokeStyle = '#25015b'; x.lineWidth = g; x.strokeRect(tx - 2.5 * g, ty - 2.5 * g, tw2 + 5 * g, 13 * g);
        F.draw(x, tr, tx, ty, { scale: g });
      }
    }
    cancelAnimationFrame(raf);
    if (obf && !reduced) raf = requestAnimationFrame(function () { setTimeout(draw, 60); });
  }
  // draw runs and remember where each component landed, for hover
  function hitDraw(x, runs, px, py, sc) {
    var cx = px;
    runs.forEach(function (r) {
      var w = F.width([r]) * sc;
      F.draw(x, [r], cx, py, { scale: sc });
      if (r.comp) s.hits.push({ x: cx, y: py - sc, w: w, h: 10 * sc, c: r.comp });
      cx += w;
    });
  }
  cv.addEventListener('mousemove', function (e) { var r = cv.getBoundingClientRect(); s.mouse = [e.clientX - r.left, e.clientY - r.top]; draw(); });
  cv.addEventListener('mouseleave', function () { s.mouse = null; draw(); });
  cv.addEventListener('click', function (e) {
    var r = cv.getBoundingClientRect(), m = [e.clientX - r.left, e.clientY - r.top];
    var hit = s.hits.filter(function (h) { return m[0] >= h.x && m[0] <= h.x + h.w && m[1] >= h.y && m[1] <= h.y + h.h; })[0];
    if (hit) ed.select(hit.c); // click a part in the preview to edit it
  });

  function render() {
    var out = command(), more = extra();
    var full = more ? more + '\n' + out : out;
    $('trCmd').textContent = full;
    $('trCopy').setAttribute('data-copy', full);
    var longest = Math.max.apply(null, full.split('\n').map(function (l) { return l.length; }));
    $('trMeta').innerHTML = out.length + ' characters' + (longest > 256 ? ' <span class="mch-term-flags"><em class="is-block">Command block only</em></span>' : '');
    $('trTimes').hidden = s.mode === 'chat' || s.mode === 'actionbar';
    var notes = [];
    var list = ed.get();
    if (s.ver === 3 && list.some(function (x) { return x.click || x.hover; })) notes.push('Bedrock has no click or hover events, so they are left out.');
    if ((s.ver === 0 || s.ver === 3) && list.some(function (x) { return x.color && x.color[0] === '#'; })) notes.push('Hex colours need Java 1.16+, so the nearest of the 16 colours is used.');
    if (s.mode !== 'chat' && list.some(function (x) { return x.click; })) notes.push('Titles and the action bar cannot be clicked. Click events only work in chat.');
    if (s.ver === 2 && list.some(function (x) { return x.click && /^\//.test(x.click.value) && x.click.action !== 'open_url'; })) notes.push('From 1.21.5 the leading / in a run command is optional.');
    $('trNotes').innerHTML = notes.map(function (n) { return '<li>' + n + '</li>'; }).join('') + '<li>Click a part in the preview to edit it. Hover it to see its hover text.</li>';
    draw();
  }

  // ---- import JSON from another tool ----
  $('trImport').addEventListener('click', function () {
    var v = $('trJson').value.trim(), msg = $('trJsonMsg');
    try {
      var data = JSON.parse(v), out = [];
      (function walk(n, inh) {
        if (typeof n === 'string') { var o = T.blank('text'); o.text = n; for (var k in inh) if (inh[k] != null) o[k] = inh[k]; if (n) out.push(o); return; }
        if (Array.isArray(n)) { n.forEach(function (x, i) { walk(x, i === 0 ? inh : inh); }); return; }
        var st = {}; ['color', 'bold', 'italic', 'underlined', 'strikethrough', 'obfuscated'].forEach(function (k) { st[k] = n[k] != null ? n[k] : inh[k]; });
        var o2 = T.blank(n.selector ? 'selector' : n.score ? 'score' : n.keybind ? 'keybind' : 'text');
        for (var k2 in st) if (st[k2] != null) o2[k2] = st[k2];
        if (n.text != null) o2.text = String(n.text);
        if (n.selector) o2.selector = n.selector;
        if (n.score) { o2.name = n.score.name; o2.objective = n.score.objective; }
        if (n.keybind) o2.key = n.keybind;
        var ce = n.clickEvent || n.click_event, he = n.hoverEvent || n.hover_event;
        if (ce) o2.click = { action: ce.action, value: String(ce.value != null ? ce.value : ce.command || ce.url || ce.page || '') };
        if (he) o2.hover = typeof (he.contents || he.value) === 'string' ? (he.contents || he.value) : JSON.stringify(he.contents || he.value);
        out.push(o2);
        if (n.extra) walk(n.extra, st);
      })(data, {});
      ed.set(out);
      msg.textContent = 'Read ' + out.length + ' parts.';
      msg.className = 'crd-paste-msg';
    } catch (e) {
      msg.textContent = 'That is not valid JSON. Paste the part after /tellraw @a.';
      msg.className = 'crd-paste-msg is-error';
    }
  });
  function seg(id, attr, key, num) {
    $(id).addEventListener('click', function (e) {
      var b = e.target.closest('[' + attr + ']');
      if (!b) return;
      s[key] = num ? +b.getAttribute(attr) : b.getAttribute(attr);
      this.querySelectorAll('[' + attr + ']').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      render();
    });
  }
  seg('trMode', 'data-mode', 'mode');
  seg('trVer', 'data-ver', 'ver', true);
  ['trTarget', 'trIn', 'trStay', 'trOut'].forEach(function (id) { $(id).addEventListener('input', render); });
  if ('ResizeObserver' in window) watch(cv.parentNode, draw);
  F.load(render);
})();
