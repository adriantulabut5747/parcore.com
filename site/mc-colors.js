/* Colour codes (Oct 13 2026), /minecraft/tools/color-codes. Every Java colour
   and format code, drawn with the game's font (mc-font.js), and a writer that
   turns "&c" text into § text, the § form for server.properties,
   MiniMessage for Paper servers, and a tellraw JSON component.
   Shadows follow the game: the text colour x 0.25, 1 px down-right.
   Copy buttons: mc-home.js. Styles: COLOUR CODES block in mc-home.css (.cc-*). */
(function () {
  var input = document.getElementById('ccInput');
  if (!input) return;
  var $ = function (id) { return document.getElementById(id); };
  // redraw when the column's width changes (height follows the canvas, so ignore it)
  function watch(el, fn) {
    var w = 0;
    new ResizeObserver(function () { var nw = el.clientWidth; if (nw !== w) { w = nw; requestAnimationFrame(fn); } }).observe(el);
  }
  var F = McFont;
  var s = { out: 'section', bg: 'chat' };
  var STY = [['l', 'Bold', 'bold'], ['o', 'Italic', 'italic'], ['n', 'Underline', 'underlined'], ['m', 'Strikethrough', 'strikethrough'], ['k', 'Magic', 'obfuscated'], ['r', 'Reset', null]];
  var NICE = { black: 'Black', dark_blue: 'Dark Blue', dark_green: 'Dark Green', dark_aqua: 'Dark Aqua', dark_red: 'Dark Red', dark_purple: 'Dark Purple', gold: 'Gold', gray: 'Gray', dark_gray: 'Dark Gray', blue: 'Blue', green: 'Green', aqua: 'Aqua', red: 'Red', light_purple: 'Light Purple', yellow: 'Yellow', white: 'White' };
  var COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h11v11H9zM5 15H4V4h11v1"/></svg>';

  // ---- conversions ----
  function toSection(t) { return t.replace(/&(#[0-9a-f]{6}|[0-9a-fk-or])/gi, function (m, c) { return c[0] === '#' ? '§x' + c.slice(1).split('').map(function (d) { return '§' + d; }).join('') : '§' + c; }).replace(/&&/g, '&'); }
  function toEscaped(t) { return toSection(t).replace(/§/g, '\\u00A7'); }
  function toMini(t) {
    var open = [];
    return F.parse(t).map(function (r) {
      var tags = '', name = Object.keys(F.NAMED).filter(function (k) { return F.NAMED[k] === r.color; })[0];
      tags += '<reset>';
      tags += name ? '<' + name + '>' : '<#' + r.color + '>';
      if (r.bold) tags += '<bold>';
      if (r.italic) tags += '<italic>';
      if (r.underlined) tags += '<underlined>';
      if (r.strikethrough) tags += '<strikethrough>';
      if (r.obfuscated) tags += '<obfuscated>';
      return tags + r.text.replace(/</g, '\\<');
    }).join('').replace(/^<reset>/, '').replace(/<reset><white>$/, '');
  }
  function toJson(t) {
    var parts = F.parse(t).map(function (r) {
      var o = { text: r.text }, name = Object.keys(F.NAMED).filter(function (k) { return F.NAMED[k] === r.color; })[0];
      if (r.color !== 'ffffff') o.color = name || '#' + r.color;
      ['bold', 'italic', 'underlined', 'strikethrough', 'obfuscated'].forEach(function (k) { if (r[k]) o[k] = true; });
      return o;
    });
    return JSON.stringify(parts.length === 1 ? parts[0] : [''].concat(parts));
  }
  var OUTS = {
    section: { k: 'Chat, signs and books', f: toSection },
    escaped: { k: 'server.properties (MOTD)', f: toEscaped },
    amp: { k: 'Plugins (& codes)', f: function (t) { return t; } },
    mini: { k: 'MiniMessage (Paper)', f: toMini },
    json: { k: 'tellraw JSON', f: toJson }
  };

  // ---- drawing ----
  function sized(cv, w, h) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    var x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.imageSmoothingEnabled = false;
    return x;
  }
  function drawTiles() {
    document.querySelectorAll('canvas[data-tile]').forEach(function (cv) {
      var k = cv.getAttribute('data-tile'), runs;
      if (F.CODES[k]) runs = [{ text: 'Aa Bb', color: F.CODES[k][1] }];
      else runs = [{ text: 'Aa Bb', color: 'ffffff', bold: k === 'l', italic: k === 'o', underlined: k === 'n', strikethrough: k === 'm', obfuscated: k === 'k' }];
      var w = cv.clientWidth || 140, x = sized(cv, w, 44);
      x.clearRect(0, 0, w, 44);
      if (k === '0' || k === '1') { x.fillStyle = '#9a9ea6'; x.fillRect(0, 0, w, 44); }
      F.draw(x, runs, Math.round((w - F.width(runs) * 3) / 2), 9, { scale: 3 });
    });
  }
  var BGS = {
    chat: function (x, w, h) { x.fillStyle = '#2c3a24'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0, 0, w, h); },
    item: function (x, w, h) { x.fillStyle = 'rgba(16,0,16,0.94)'; x.fillRect(0, 0, w, h); x.strokeStyle = '#25015b'; x.lineWidth = 4; x.strokeRect(2, 2, w - 4, h - 4); },
    light: function (x, w, h) { x.fillStyle = '#c6c6c6'; x.fillRect(0, 0, w, h); }
  };
  var raf = 0;
  function preview() {
    var cv = $('ccPreview'), w = cv.parentNode.clientWidth, lines = input.value.split('\n').slice(0, 6);
    var sc = w < 420 ? 2 : 3, lh = 10 * sc, h = Math.max(1, lines.length) * lh + 28;
    var x = sized(cv, w, h);
    BGS[s.bg](x, w, h);
    var obf = false;
    lines.forEach(function (l, i) {
      var r = F.parse(l, { color: s.bg === 'light' ? '404040' : 'ffffff' });
      obf = obf || F.hasObf(r);
      F.draw(x, r, 14, 14 + i * lh, { scale: sc, shadow: s.bg !== 'light' });
    });
    cancelAnimationFrame(raf);
    if (obf && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) raf = requestAnimationFrame(function () { setTimeout(preview, 50); });
  }
  function render() {
    var out = OUTS[s.out].f(input.value);
    $('ccOut').textContent = out;
    $('ccCopy').setAttribute('data-copy', out);
    $('ccOutK').textContent = OUTS[s.out].k;
    preview();
  }

  // ---- reference tables ----
  $('ccColors').innerHTML = Object.keys(F.CODES).map(function (k) {
    var n = F.CODES[k][0], hx = F.CODES[k][1], sh = F.shade(hx, 0.25);
    return '<li class="cc-tile">' +
      '<canvas data-tile="' + k + '" aria-hidden="true"></canvas>' +
      '<div class="cc-meta"><b>' + NICE[n] + '</b><span><code>&amp;' + k + '</code><code>#' + hx + '</code></span><small>Shadow #' + sh + '</small></div>' +
      '<div class="cc-copy">' +
      '<button type="button" class="mch-copy" data-copy="&' + k + '" aria-label="Copy &' + k + '">' + COPY + '<span>&amp;' + k + '</span></button>' +
      '<button type="button" class="mch-copy" data-copy="§' + k + '" aria-label="Copy §' + k + '">' + COPY + '<span>§' + k + '</span></button>' +
      '<button type="button" class="mch-copy" data-copy="' + n + '" aria-label="Copy the name ' + n + '">' + COPY + '<span>' + n + '</span></button>' +
      '</div><button type="button" class="cc-use" data-ins="&' + k + '" aria-label="Add &' + k + ' to the writer"></button></li>';
  }).join('');
  $('ccStyles').innerHTML = STY.map(function (st) {
    return '<li class="cc-tile cc-tile--style">' + (st[2] ? '<canvas data-tile="' + st[0] + '" aria-hidden="true"></canvas>' : '<div class="cc-reset">Back to plain</div>') +
      '<div class="cc-meta"><b>' + st[1] + '</b><span><code>&amp;' + st[0] + '</code></span><small>' + (st[0] === 'r' ? 'Clears colour and styles' : st[0] === 'k' ? 'Letters keep changing' : 'Stays on until a colour or &amp;r') + '</small></div>' +
      '<div class="cc-copy"><button type="button" class="mch-copy" data-copy="&' + st[0] + '" aria-label="Copy &' + st[0] + '">' + COPY + '<span>&amp;' + st[0] + '</span></button>' +
      '<button type="button" class="mch-copy" data-copy="§' + st[0] + '" aria-label="Copy §' + st[0] + '">' + COPY + '<span>§' + st[0] + '</span></button></div>' +
      '<button type="button" class="cc-use" data-ins="&' + st[0] + '" aria-label="Add &' + st[0] + ' to the writer"></button></li>';
  }).join('');
  // quick insert row in the writer
  $('ccQuick').innerHTML = Object.keys(F.CODES).map(function (k) {
    return '<button type="button" class="cc-q" data-ins="&' + k + '" title="&' + k + ' ' + NICE[F.CODES[k][0]] + '" aria-label="Insert &' + k + ', ' + NICE[F.CODES[k][0]] + '" style="--c:#' + F.CODES[k][1] + '"></button>';
  }).join('') + STY.map(function (st) { return '<button type="button" class="cc-q cc-q--st" data-ins="&' + st[0] + '" title="&' + st[0] + ' ' + st[1] + '">' + st[0] + '</button>'; }).join('') +
    '<label class="cc-q cc-q--hex" title="Hex colour, &#RRGGBB (1.16+ with plugins)"><input type="color" id="ccHex" value="#ff8800" aria-label="Insert a hex colour">#</label>';
  function insert(code) {
    var a = input.selectionStart, b = input.selectionEnd, v = input.value;
    // a selection gets the code before it and &r after, so only it changes
    if (b > a && code !== '&r') { input.value = v.slice(0, a) + code + v.slice(a, b) + '&r' + v.slice(b); input.selectionStart = input.selectionEnd = b + code.length + 2; }
    else { input.value = v.slice(0, a) + code + v.slice(b); input.selectionStart = input.selectionEnd = a + code.length; }
    input.focus();
    render();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ins]');
    if (b) { insert(b.getAttribute('data-ins')); if (b.classList.contains('cc-use')) input.scrollIntoView({ block: 'center' }); }
  });
  $('ccHex').addEventListener('change', function () { insert('&' + this.value); });
  input.addEventListener('input', render);
  $('ccOutSeg').addEventListener('click', function (e) {
    var b = e.target.closest('[data-out]');
    if (!b) return;
    s.out = b.getAttribute('data-out');
    this.querySelectorAll('[data-out]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    render();
  });
  $('ccBg').addEventListener('click', function (e) {
    var b = e.target.closest('[data-bg]');
    if (!b) return;
    s.bg = b.getAttribute('data-bg');
    this.querySelectorAll('[data-bg]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    preview();
  });
  if ('ResizeObserver' in window) watch($('ccPreview').parentNode, function () { preview(); drawTiles(); });
  F.load(function () { drawTiles(); render(); });
  render();
})();
