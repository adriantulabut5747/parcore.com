/* Minecraft's own font, drawn in a canvas (Oct 13 2026). Shared by the MOTD,
   Colour Codes, Sign, Book and Tellraw tools on /minecraft/tools/.
   mc-font.json was built from the 26.3 game files: font/include/default.json
   (ascii.png, accented.png, nonlatin_european.png) with each glyph's width
   measured from its pixels the way the game does (advance = width + 1, a space
   is 4). Rules copied from the game's Font:
     shadow   1 px down-right, the text colour x 0.25
     bold     the glyph drawn twice, 1 px apart, advance + 1
     italic   top of the glyph leans 1 px right
     strike / underline   1 px lines, the underline one row under the glyphs
     obfuscated   a random glyph of the same width, redrawn every frame
   Runs: [{ text, color: 'ffffff', bold, italic, underlined, strikethrough, obfuscated }] */
var McFont = (function () {
  var data = null, sheets = [], waiting = [], tintCache = {};
  var CODES = {
    0: ['black', '000000'], 1: ['dark_blue', '0000aa'], 2: ['dark_green', '00aa00'], 3: ['dark_aqua', '00aaaa'],
    4: ['dark_red', 'aa0000'], 5: ['dark_purple', 'aa00aa'], 6: ['gold', 'ffaa00'], 7: ['gray', 'aaaaaa'],
    8: ['dark_gray', '555555'], 9: ['blue', '5555ff'], a: ['green', '55ff55'], b: ['aqua', '55ffff'],
    c: ['red', 'ff5555'], d: ['light_purple', 'ff55ff'], e: ['yellow', 'ffff55'], f: ['white', 'ffffff']
  };
  var NAMED = {};
  Object.keys(CODES).forEach(function (k) { NAMED[CODES[k][0]] = CODES[k][1]; });
  var STYLES = { k: 'obfuscated', l: 'bold', m: 'strikethrough', n: 'underlined', o: 'italic' };

  function load(cb) {
    if (data) { cb(); return; }
    waiting.push(cb);
    if (waiting.length > 1) return;
    fetch('/mc-font.json').then(function (r) { return r.json(); }).then(function (d) {
      var left = d.sheets.length;
      d.sheets.forEach(function (sh, i) {
        var im = new Image();
        im.onload = im.onerror = function () { if (--left === 0) { data = d; waiting.splice(0).forEach(function (f) { f(); }); } };
        im.src = sh.src;
        sheets[i] = im;
      });
    });
  }
  // the sheet tinted to one colour, cached (glyphs are white in the textures)
  function tinted(si, hex) {
    var key = si + hex;
    if (tintCache[key]) return tintCache[key];
    var im = sheets[si], c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    var x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#' + hex;
    x.fillRect(0, 0, c.width, c.height);
    return (tintCache[key] = c);
  }
  function glyph(ch) { return data.g[ch]; }
  function adv(ch, bold) {
    if (ch === ' ') return 4 + (bold ? 1 : 0);
    var g = glyph(ch);
    return (g ? g[4] : 6) + (bold ? 1 : 0);
  }
  function width(runs) {
    if (!data) return 0;
    var w = 0;
    runs.forEach(function (r) { for (var i = 0; i < r.text.length; i++) w += adv(r.text[i], r.bold); });
    return w;
  }
  // obfuscated: a glyph of the same advance, picked at random
  var byAdv = null;
  function randomLike(ch) {
    if (!byAdv) {
      byAdv = {};
      for (var c = 33; c < 127; c++) { var s = String.fromCharCode(c), g = glyph(s); if (g) (byAdv[g[4]] = byAdv[g[4]] || []).push(s); }
    }
    var g = glyph(ch), list = g && byAdv[g[4]];
    return list ? list[Math.floor(Math.random() * list.length)] : ch;
  }
  function shade(hex, f) {
    var n = parseInt(hex, 16);
    return ('00000' + (((n >> 16 & 255) * f | 0) << 16 | ((n >> 8 & 255) * f | 0) << 8 | ((n & 255) * f | 0)).toString(16)).slice(-6);
  }
  function drawGlyph(ctx, ch, x, y, s, hex, r) {
    var g = glyph(ch);
    if (!g) {
      if (ch === ' ') return;
      // not in the bitmap fonts: the browser's font, close enough for rare characters
      ctx.fillStyle = '#' + hex;
      ctx.font = (8 * s) + 'px monospace';
      ctx.textBaseline = 'top';
      ctx.fillText(ch, x, y);
      return;
    }
    var sh = data.sheets[g[0]], img = tinted(g[0], hex);
    var sw = g[3], h = sh.ch, dy = y + sh.yoff * s, k = sh.scale * s;
    for (var b = 0; b < (r.bold ? 2 : 1); b++) {
      if (r.italic) {
        // lean: draw in 1 px strips, each shifted by its height above the baseline
        for (var row = 0; row < h; row++) {
          var off = (1 - (row + 0.5) / h * 1) * s * 1;
          ctx.drawImage(img, g[1] * sh.cw, g[2] * h + row, sw, 1, x + off + b * s, dy + row * k, sw * k, k);
        }
      } else ctx.drawImage(img, g[1] * sh.cw, g[2] * h, sw, h, x + b * s, dy, sw * k, h * k);
    }
  }
  // Draw runs at (x, y) top-left, scale s. Returns the width drawn (in canvas px).
  function draw(ctx, runs, x, y, opts) {
    if (!data) return 0;
    opts = opts || {};
    var s = opts.scale || 1, shadow = opts.shadow !== false;
    ctx.imageSmoothingEnabled = false;
    var passes = shadow ? [true, false] : [false];
    var w = 0;
    passes.forEach(function (isShadow) {
      var cx = x;
      runs.forEach(function (r) {
        var hex = (r.color || opts.color || 'ffffff').replace('#', '');
        if (isShadow) hex = opts.shadowColor || shade(hex, 0.25);
        var ox = isShadow ? s : 0, oy = isShadow ? s : 0;
        var start = cx;
        for (var i = 0; i < r.text.length; i++) {
          var ch = r.text[i];
          if (r.obfuscated && ch !== ' ') ch = randomLike(ch);
          drawGlyph(ctx, ch, cx + ox, y + oy, s, hex, r);
          cx += adv(r.text[i], r.bold) * s;
        }
        ctx.fillStyle = '#' + hex;
        if (r.strikethrough) ctx.fillRect(start + ox - s, y + oy + 3.5 * s, cx - start + s, s);
        if (r.underlined) ctx.fillRect(start + ox - s, y + oy + 8 * s, cx - start + s, s);
      });
      w = cx - x;
    });
    return w;
  }
  // "&cRed &lbold" / "§c..." / "&#ff8800hex" -> runs. A colour code resets styles, as in game.
  function parse(str, opts) {
    opts = opts || {};
    var mark = opts.mark || '&', runs = [], cur = { text: '', color: opts.color || 'ffffff' };
    function push() { if (cur.text) runs.push(cur); var n = {}; for (var k in cur) n[k] = cur[k]; n.text = ''; cur = n; }
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if ((ch === mark || ch === '§') && i + 1 < str.length) {
        if (str[i + 1] === '#' && /^[0-9a-f]{6}$/i.test(str.substr(i + 2, 6))) {
          push(); cur = { text: '', color: str.substr(i + 2, 6).toLowerCase() }; i += 7; continue;
        }
        var c = str[i + 1].toLowerCase();
        if (CODES[c]) { push(); cur = { text: '', color: CODES[c][1] }; i++; continue; }
        if (STYLES[c]) { push(); cur[STYLES[c]] = true; i++; continue; }
        if (c === 'r') { push(); cur = { text: '', color: opts.color || 'ffffff' }; i++; continue; }
        if (ch === mark && str[i + 1] === mark) { cur.text += mark; i++; continue; }
      }
      cur.text += ch;
    }
    push();
    return runs;
  }
  // Wrap runs to lines no wider than max px (word wrap, like books and chat).
  function wrap(runs, max) {
    var lines = [[]], w = 0;
    runs.forEach(function (r) {
      var parts = r.text.split(/(\n| )/);
      parts.forEach(function (p) {
        if (p === '\n') { lines.push([]); w = 0; return; }
        if (!p) return;
        var pw = width([{ text: p, bold: r.bold }]);
        if (w + pw > max && w > 0 && p !== ' ') { lines.push([]); w = 0; }
        if (p === ' ' && w === 0 && lines[lines.length - 1].length) return;
        var piece = {}; for (var k in r) piece[k] = r[k]; piece.text = p;
        lines[lines.length - 1].push(piece);
        w += pw;
      });
    });
    return lines;
  }
  function hasObf(runs) { return runs.some(function (r) { return r.obfuscated; }); }
  return { load: load, draw: draw, width: width, parse: parse, wrap: wrap, hasObf: hasObf, shade: shade, CODES: CODES, NAMED: NAMED, STYLES: STYLES };
})();
