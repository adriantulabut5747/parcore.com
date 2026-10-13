/* MOTD generator (Oct 13 2026), /minecraft/tools/motd. The server list row drawn
   like the game's multiplayer screen with its own font (mc-font.js) and sprites:
   a 32 px icon, the server name in white, two MOTD lines in grey (#808080, the
   game's default for MOTD text), the ping bars and the player count. Each MOTD
   line is cut at 270 px (row 305 minus icon and gap), so the meter counts pixels.
   Also: centring (padding with 4 px spaces), gradients (&#RRGGBB per letter),
   the server icon as a 64 x 64 PNG, and outputs for vanilla, plugins, MiniMessage.
   Copy: mc-home.js. Styles: MOTD block in mc-home.css (.motd-*). */
(function () {
  var l1 = document.getElementById('motdL1');
  if (!l1) return;
  var $ = function (id) { return document.getElementById(id); };
  // redraw when the column's width changes (height follows the canvas, so ignore it)
  function watch(el, fn) {
    var w = 0;
    new ResizeObserver(function () { var nw = el.clientWidth; if (nw !== w) { w = nw; requestAnimationFrame(fn); } }).observe(el);
  }
  var F = McFont;
  var MAX = 270;
  var s = { out: 'props', ping: 5, icon: null, at: 'motdL1' };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pings = [1, 2, 3, 4, 5].map(function (i) { var im = new Image(); im.src = '/minecrafticons/gui/ping_' + i + '.png'; im.onload = draw; return im; });
  var unknown = new Image(); unknown.src = '/minecrafticons/gui/unknown_server.png'; unknown.onload = draw;

  function lines() { return [l1.value, $('motdL2').value]; }
  function noHex(t) { // vanilla has no hex: the nearest of the 16 colours
    return t.replace(/&#([0-9a-f]{6})/gi, function (m, h) {
      var name = McText.nearestName(h.toLowerCase());
      return '&' + Object.keys(F.CODES).filter(function (k) { return F.CODES[k][0] === name; })[0];
    });
  }
  function section(t) { return t.replace(/&([0-9a-fk-or])/gi, '§$1').replace(/&&/g, '&'); }
  function mini(t) {
    return F.parse(t, { color: '808080' }).map(function (r) {
      var name = Object.keys(F.NAMED).filter(function (k) { return F.NAMED[k] === r.color; })[0];
      var tag = r.color === '808080' ? '' : '<' + (name || '#' + r.color) + '>';
      return '<reset>' + tag + (r.bold ? '<bold>' : '') + (r.italic ? '<italic>' : '') + (r.underlined ? '<underlined>' : '') + (r.strikethrough ? '<strikethrough>' : '') + (r.obfuscated ? '<obfuscated>' : '') + r.text.replace(/</g, '\\<');
    }).join('').replace(/^<reset>/, '');
  }
  var OUTS = {
    props: { k: 'server.properties', note: 'Paste over the motd= line, then restart the server.', f: function (L) { return 'motd=' + L.map(function (t) { return section(noHex(t)).replace(/§/g, '\\u00A7'); }).join('\\n'); } },
    amp: { k: 'Plugins (& codes)', note: 'For Essentials, BungeeCord and most MOTD plugins. Hex works where the plugin supports &#RRGGBB.', f: function (L) { return L.join('\n'); } },
    mini: { k: 'MiniMessage', note: 'For Velocity (velocity.toml) and MiniMessage plugins such as MiniMOTD. Keeps hex and gradients.', f: function (L) { return L.map(mini).join('<newline>'); } }
  };

  // ---- the server list row ----
  var cv = $('motdCanvas'), raf = 0;
  function draw() {
    var wrap = cv.parentNode, cw = wrap.clientWidth;
    // the row at the game's own size, then blown up pixel-sharp to the column width
    var sc = 1, W = 310, H = 40, off = draw.off || (draw.off = document.createElement('canvas'));
    off.width = W; off.height = H;
    var x = off.getContext('2d'); x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, W, H);
    // selected-row outline, as when you hover a server
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(128,128,128,0.7)'; x.lineWidth = sc; x.strokeRect(sc / 2, sc / 2, W - sc, H - sc);
    var ox = 3 * sc, oy = 4 * sc;
    var ic = s.icon || unknown;
    if (ic.width || ic.naturalWidth) x.drawImage(ic, ox, oy, 32 * sc, 32 * sc);
    var name = [{ text: $('motdName').value || 'Minecraft Server', color: 'ffffff' }];
    F.draw(x, name, ox + 35 * sc, oy + sc, { scale: sc });
    var obf = false;
    lines().forEach(function (t, i) {
      var r = F.parse(t, { color: '808080' });
      obf = obf || F.hasObf(r);
      x.save(); x.beginPath(); x.rect(ox + 35 * sc, 0, MAX * sc, H); x.clip();
      F.draw(x, r, ox + 35 * sc, oy + (12 + 9 * i) * sc, { scale: sc });
      x.restore();
    });
    var pl = [{ text: ($('motdOn').value || '0') + '/' + ($('motdMax').value || '20'), color: '808080' }];
    var pw = F.width(pl);
    var pim = pings[s.ping - 1];
    if (pim.naturalWidth) x.drawImage(pim, ox + (305 - 10) * sc, oy + sc, 10 * sc, 8 * sc);
    F.draw(x, pl, ox + (305 - 15 - pw) * sc, oy + sc, { scale: sc });
    var k = Math.max(1, (cw - 4) / 310), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(310 * k * dpr); cv.height = Math.round(40 * k * dpr);
    cv.style.width = Math.round(310 * k) + 'px'; cv.style.height = Math.round(40 * k) + 'px';
    var vx = cv.getContext('2d'); vx.imageSmoothingEnabled = false;
    vx.drawImage(off, 0, 0, cv.width, cv.height);
    cancelAnimationFrame(raf);
    if (obf && !reduced) raf = requestAnimationFrame(function () { setTimeout(draw, 60); });
  }

  function meter() {
    lines().forEach(function (t, i) {
      var w = F.width(F.parse(t)), m = $('motdM' + (i + 1));
      m.querySelector('b').textContent = w + ' / ' + MAX + ' px';
      m.querySelector('i').style.width = Math.min(100, w / MAX * 100) + '%';
      m.classList.toggle('is-over', w > MAX);
    });
  }
  function render() {
    var L = lines(), out = OUTS[s.out].f(L);
    $('motdOut').textContent = out;
    $('motdCopy').setAttribute('data-copy', out);
    $('motdOutK').textContent = OUTS[s.out].note;
    var notes = [];
    if (s.out === 'props' && /&#[0-9a-f]{6}/i.test(L.join(''))) notes.push('Vanilla servers have no hex colours, so they are swapped for the nearest of the 16. Use the MiniMessage output to keep them.');
    if (L.some(function (t) { return F.width(F.parse(t)) > MAX; })) notes.push('A line is wider than 270 px, so the end is cut off in the server list.');
    $('motdNotes').innerHTML = notes.map(function (n) { return '<li>' + n + '</li>'; }).join('') +
      '<li>The game shows two lines at most. Players see the icon only if it is a 64 x 64 PNG named server-icon.png next to server.properties.</li>';
    meter();
    draw();
  }

  // ---- editing helpers ----
  [l1, $('motdL2')].forEach(function (inp) { inp.addEventListener('focus', function () { s.at = inp.id; }); });
  function insert(code) {
    var inp = $(s.at), a = inp.selectionStart, b = inp.selectionEnd, v = inp.value;
    if (b > a && code !== '&r') { inp.value = v.slice(0, a) + code + v.slice(a, b) + '&r' + v.slice(b); }
    else inp.value = v.slice(0, a) + code + v.slice(b);
    inp.focus();
    render();
  }
  $('motdQuick').innerHTML = Object.keys(F.CODES).map(function (k) {
    return '<button type="button" class="cc-q" data-ins="&' + k + '" title="&' + k + '" aria-label="Insert &' + k + '" style="--c:#' + F.CODES[k][1] + '"></button>';
  }).join('') + ['l', 'o', 'n', 'm', 'k', 'r'].map(function (k) { return '<button type="button" class="cc-q cc-q--st" data-ins="&' + k + '" title="&' + k + '">' + k + '</button>'; }).join('');
  $('motdQuick').addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep the caret in the line
  $('motdQuick').addEventListener('click', function (e) { var b = e.target.closest('[data-ins]'); if (b) insert(b.getAttribute('data-ins')); });
  function strip(t) { return t.replace(/&(#[0-9a-f]{6}|[0-9a-fk-or])/gi, ''); }
  // centre: pad with spaces (4 px each) so the line sits in the middle of 270 px
  document.querySelectorAll('[data-centre]').forEach(function (b) {
    b.addEventListener('click', function () {
      var inp = $(b.getAttribute('data-centre')), t = inp.value.replace(/^ +/, '');
      var w = F.width(F.parse(t)), pad = Math.max(0, Math.floor((MAX - w) / 2 / 4));
      inp.value = new Array(pad + 1).join(' ') + t;
      render();
    });
  });
  // gradient: a hex code before every letter, from one colour to another
  $('motdGrad').addEventListener('click', function () {
    var inp = $(s.at), plain = strip(inp.value), a = parseInt($('motdG1').value.slice(1), 16), b = parseInt($('motdG2').value.slice(1), 16);
    var bold = $('motdGBold').checked, letters = plain.replace(/ /g, '').length, k = 0, out = '';
    for (var i = 0; i < plain.length; i++) {
      var ch = plain[i];
      if (ch === ' ') { out += ' '; continue; }
      var t = letters > 1 ? k / (letters - 1) : 0, c = [16, 8, 0].map(function (sh) { return Math.round((a >> sh & 255) * (1 - t) + (b >> sh & 255) * t); });
      out += '&#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('') + (bold ? '&l' : '') + ch;
      k++;
    }
    inp.value = out;
    render();
  });
  // ---- server icon: any image, cropped square and scaled to 64 x 64 ----
  $('motdIcon').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var im = new Image();
    im.onload = function () {
      var c = document.createElement('canvas'); c.width = 64; c.height = 64;
      var x = c.getContext('2d'), side = Math.min(im.width, im.height);
      x.imageSmoothingEnabled = im.width > 64;
      x.drawImage(im, (im.width - side) / 2, (im.height - side) / 2, side, side, 0, 0, 64, 64);
      s.icon = c;
      $('motdIconDl').href = c.toDataURL('image/png');
      $('motdIconDl').hidden = false;
      $('motdIconPrev').src = c.toDataURL('image/png');
      draw();
    };
    im.src = URL.createObjectURL(f);
  });
  $('motdPing').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ping]');
    if (!b) return;
    s.ping = +b.getAttribute('data-ping');
    this.querySelectorAll('[data-ping]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    draw();
  });
  $('motdOutSeg').addEventListener('click', function (e) {
    var b = e.target.closest('[data-out]');
    if (!b) return;
    s.out = b.getAttribute('data-out');
    this.querySelectorAll('[data-out]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    render();
  });
  ['motdL1', 'motdL2', 'motdName', 'motdOn', 'motdMax'].forEach(function (id) { $(id).addEventListener('input', render); });
  if ('ResizeObserver' in window) watch(cv.parentNode, draw);
  F.load(render);
})();
