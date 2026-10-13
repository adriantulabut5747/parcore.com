/* Banner maker (Oct 13 2026), /minecraft/tools/banner.
   Base colour + up to 16 pattern layers (the loom stops at 6; Java draws 16 from
   a command), as a banner or a shield. Writes the /give command, the survival
   loom steps, a share link (#hash) and a watermarked PNG.
     ver 2 = 1.21.5 and newer  white_banner[custom_name={"text":..},banner_patterns=[{pattern:cross,color:red}]]
     ver 1 = 1.20.5 - 1.21.4   same patterns; custom_name/lore are JSON in quotes: custom_name='{"text":..}'
     ver 0 = 1.16 - 1.20.4     white_banner{display:{Name:'..'},BlockEntityTag:{Patterns:[{Pattern:"cr",Color:14}]}}
   The editor has two modes: by default a pattern click ADDS a layer; picking a
   layer in the list switches it to editing that layer (s.sel) until Done.
   Pattern list, names and which ones need a pattern item: 26.3 game files
   (data/minecraft/banner_pattern, tags/banner_pattern, lang/en_us.json).
   Art: /minecrafticons/banner-sprite.png -- one 20px column per tile in PATS order
   after the cloth and the base mask; row 0 = banner face (20x40), row 40 = shield
   face (12x22). Each tile is greyscale and tinted like the game does: texel x dye.
   Copy button: mc-home.js. Styles: WEB TOOLS in mc-home.css. */
(function () {
  var big = document.getElementById('bnCanvas');
  if (!big) return;

  // [id, name, pattern item ('' = none), old NBT code, 1 = needs 1.21]
  var PATS = [
    ['square_bottom_left', 'Base Dexter Canton', '', 'bl'], ['square_bottom_right', 'Base Sinister Canton', '', 'br'],
    ['square_top_left', 'Chief Dexter Canton', '', 'tl'], ['square_top_right', 'Chief Sinister Canton', '', 'tr'],
    ['stripe_bottom', 'Base', '', 'bs'], ['stripe_top', 'Chief', '', 'ts'], ['stripe_left', 'Pale Dexter', '', 'ls'],
    ['stripe_right', 'Pale Sinister', '', 'rs'], ['stripe_center', 'Pale', '', 'cs'], ['stripe_middle', 'Fess', '', 'ms'],
    ['stripe_downright', 'Bend', '', 'drs'], ['stripe_downleft', 'Bend Sinister', '', 'dls'], ['small_stripes', 'Paly', '', 'ss'],
    ['cross', 'Saltire', '', 'cr'], ['straight_cross', 'Cross', '', 'sc'], ['triangle_bottom', 'Chevron', '', 'bt'],
    ['triangle_top', 'Inverted Chevron', '', 'tt'], ['triangles_bottom', 'Base Indented', '', 'bts'],
    ['triangles_top', 'Chief Indented', '', 'tts'], ['diagonal_left', 'Per Bend Sinister', '', 'ld'],
    ['diagonal_up_right', 'Per Bend Sinister Inverted', '', 'rd'], ['diagonal_up_left', 'Per Bend Inverted', '', 'lud'],
    ['diagonal_right', 'Per Bend', '', 'rud'], ['circle', 'Roundel', '', 'mc'], ['rhombus', 'Lozenge', '', 'mr'],
    ['half_vertical', 'Per Pale', '', 'vh'], ['half_horizontal', 'Per Fess', '', 'hh'],
    ['half_vertical_right', 'Per Pale Inverted', '', 'vhr'], ['half_horizontal_bottom', 'Per Fess Inverted', '', 'hhb'],
    ['border', 'Bordure', '', 'bo'], ['gradient', 'Gradient', '', 'gra'], ['gradient_up', 'Base Gradient', '', 'gru'],
    ['flower', 'Flower Charge', 'Flower Charge', 'flo'], ['creeper', 'Creeper Charge', 'Creeper Charge', 'cre'],
    ['skull', 'Skull Charge', 'Skull Charge', 'sku'], ['mojang', 'Thing', 'Thing', 'moj'], ['globe', 'Globe', 'Globe', 'glb'],
    ['piglin', 'Snout', 'Snout', 'pig'], ['flow', 'Flow', 'Flow', '', 1], ['guster', 'Guster', 'Guster', '', 1],
    ['bricks', 'Field Masoned', 'Field Masoned', 'bri'], ['curly_border', 'Bordure Indented', 'Bordure Indented', 'cbo']
  ].map(function (p, i) {
    return { id: p[0], name: p[1], item: p[2], code: p[3], v: p[4] || 0, tile: i + 2 };
  });
  var BY = {};
  PATS.forEach(function (p) { BY[p.id] = p; });
  // Item file names for the pattern items (minecrafticons/items/<x>_banner_pattern.png).
  var ITEM_FILE = { bricks: 'field_masoned', curly_border: 'bordure_indented' };
  // Dye order = the game's dye ids (old NBT "Color" numbers); hex = the dye's tint colour.
  var DYES = [
    ['white', 'f9fffe'], ['orange', 'f9801d'], ['magenta', 'c74ebd'], ['light_blue', '3ab3da'],
    ['yellow', 'fed83d'], ['lime', '80c71f'], ['pink', 'f38baa'], ['gray', '474f52'],
    ['light_gray', '9d9d97'], ['cyan', '169c9c'], ['purple', '8932b8'], ['blue', '3c44aa'],
    ['brown', '835432'], ['green', '5e7c16'], ['red', 'b02e26'], ['black', '1d1d21']
  ];
  var HEX = {};
  DYES.forEach(function (d) { HEX[d[0]] = d[1]; });
  var MAX = 16, LOOM = 6;
  var STARTERS = [
    ['Japan', 'white', [['circle', 'red']]],
    ['Ukraine', 'yellow', [['half_horizontal', 'blue']]],
    ['Germany', 'red', [['stripe_top', 'black'], ['stripe_bottom', 'yellow']]],
    ['Creeper', 'lime', [['creeper', 'black']]],
    ['Pirate', 'black', [['skull', 'white']]],
    ['Mountain', 'orange', [['gradient', 'magenta'], ['gradient_up', 'yellow'], ['triangle_bottom', 'black']]],
    ['Ocean', 'blue', [['gradient_up', 'cyan'], ['flow', 'light_blue'], ['triangles_bottom', 'cyan']]],
    ['Globe', 'light_blue', [['globe', 'green'], ['gradient', 'white'], ['border', 'blue']]]
  ];

  var s = { ver: 2, shield: false, base: 'white', layers: [], sel: -1, pick: '' };
  var DARK = ['gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
  // New layers default to white on a dark base, black on a light one, until a colour is picked.
  function pickColor() { return s.pick || (DARK.indexOf(s.base) > -1 ? 'white' : 'black'); }
  var $ = function (id) { return document.getElementById(id); };
  function nice(c) { return c.split('_').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' '); }
  function ok(p) { return p.v <= s.ver; }

  // ---- drawing ----
  var sprite = new Image();
  var cache = {};
  // One tile in one dye colour, as a canvas: texel x dye, alpha kept.
  function tile(n, color, shield) {
    var key = n + '|' + color + '|' + shield;
    if (cache[key]) return cache[key];
    var w = shield ? 12 : 20, h = shield ? 22 : 40;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    x.drawImage(sprite, n * 20, shield ? 40 : 0, w, h, 0, 0, w, h);
    if (color) {
      var d = x.getImageData(0, 0, w, h), px = d.data, hx = HEX[color];
      var r = parseInt(hx.slice(0, 2), 16), g = parseInt(hx.slice(2, 4), 16), b = parseInt(hx.slice(4), 16);
      for (var i = 0; i < px.length; i += 4) {
        px[i] = px[i] * r / 255; px[i + 1] = px[i + 1] * g / 255; px[i + 2] = px[i + 2] * b / 255;
      }
      x.putImageData(d, 0, 0);
    }
    return (cache[key] = c);
  }
  // Cloth, base colour, then each layer bottom to top -- the game's order.
  function paint(canvas, base, layers, shield) {
    var w = shield ? 12 : 20, h = shield ? 22 : 40;
    canvas.width = w; canvas.height = h;
    var x = canvas.getContext('2d');
    x.drawImage(tile(0, '', shield), 0, 0);
    x.drawImage(tile(1, base, shield), 0, 0);
    layers.forEach(function (l) { x.drawImage(tile(BY[l.p].tile, l.c, shield), 0, 0); });
    return canvas;
  }

  // ---- UI ----
  function swatches(box, cur) {
    box.innerHTML = DYES.map(function (d) {
      return '<button type="button" class="mct-sw" data-color="' + d[0] + '" aria-pressed="' + (d[0] === cur) + '" title="' + nice(d[0]) + '" aria-label="' + nice(d[0]) + '" style="background:#' + d[1] + '"></button>';
    }).join('');
  }
  function dot(c) { return '<i class="bn-dot" style="background:#' + HEX[c] + '"></i>'; }
  function drawLayers(fresh) {
    var n = s.layers.length;
    $('bnCount').textContent = n + ' / ' + MAX;
    $('bnClear').hidden = !n;
    // Drawing order, top to bottom: the base colour, then layer 1, 2, ... (newest last).
    $('bnLayers').innerHTML =
      '<li class="bn-layer bn-layer--base"><span class="bn-layer-pick"><canvas data-thumb="base"></canvas><span class="bn-layer-n"></span><span class="bn-layer-txt"><b>Base colour</b><span>' + dot(s.base) + nice(s.base) + ', set above</span></span></span></li>' +
      (n ? '' : '<li class="bn-empty">No layers yet. Pick a colour and a pattern below to add the first one.</li>') +
      s.layers.map(function (l, i) {
        var tags = (i >= LOOM ? '<em class="is-block">Command only</em>' : '') + (BY[l.p].item ? '<em class="is-item">Pattern item</em>' : '');
        return '<li class="bn-layer' + (i === s.sel ? ' is-sel' : '') + (i === fresh ? ' is-new' : '') + '" data-i="' + i + '">' +
          '<button type="button" class="bn-layer-pick" aria-pressed="' + (i === s.sel) + '" aria-label="Layer ' + (i + 1) + ': ' + nice(l.c) + ' ' + BY[l.p].name + (i === s.sel ? ', editing' : ', click to change') + '"><canvas data-thumb="' + i + '"></canvas><span class="bn-layer-n">' + (i + 1) + '</span><span class="bn-layer-txt"><b>' + BY[l.p].name + '</b><span>' + dot(l.c) + nice(l.c) + '</span>' + (tags ? '<span class="mch-term-flags">' + tags + '</span>' : '') + '</span>' + (i === s.sel ? '<span class="bn-layer-state">Editing</span>' : '') + '</button>' +
          '<span class="bn-layer-acts">' +
            '<button type="button" data-act="up" aria-label="Move layer up"' + (i === 0 ? ' disabled' : '') + '><svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>' +
            '<button type="button" data-act="down" aria-label="Move layer down"' + (i === n - 1 ? ' disabled' : '') + '><svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg></button>' +
            '<button type="button" data-act="del" aria-label="Remove layer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
          '</span></li>';
      }).join('');
    // Thumbs: each layer alone on the base colour.
    $('bnLayers').querySelectorAll('canvas[data-thumb]').forEach(function (c) {
      var k = c.getAttribute('data-thumb');
      paint(c, s.base, k === 'base' ? [] : [s.layers[+k]], s.shield);
    });
  }
  // The editor panel: says which mode it's in, and draws every pattern in the
  // colour it would get, on the current base, so each tile is a true preview.
  function drawEditor() {
    var cur = s.layers[s.sel];
    var full = !cur && s.layers.length >= MAX;
    var color = cur ? cur.c : pickColor();
    $('bnEditor').classList.toggle('is-edit', !!cur);
    $('bnEditor').classList.toggle('is-full', full);
    $('bnDone').hidden = !cur;
    $('bnEdTitle').textContent = cur ? 'Editing layer ' + (s.sel + 1) : 'Add a layer';
    $('bnEdSub').textContent = cur ? 'Colour and pattern changes apply to this layer. Click Done to go back to adding.'
      : full ? MAX + ' layers is the most the game draws. Remove one to add another.'
      : 'Pick a colour, then click a pattern. Each click adds a new layer at the end of the list.';
    $('bnColorName').textContent = nice(color);
    function tiles(list) {
      return list.filter(ok).map(function (p) {
        return '<button type="button" class="bn-pat" data-p="' + p.id + '"' + (full ? ' disabled' : '') + ' aria-pressed="' + (!!cur && cur.p === p.id) + '" title="' + p.name + (p.item ? ': needs the ' + p.item + ' Banner Pattern' : '') + '"><canvas></canvas><span>' + p.name + '</span></button>';
      }).join('');
    }
    $('bnGrid').innerHTML = tiles(PATS.filter(function (p) { return !p.item; }));
    $('bnGridItem').innerHTML = tiles(PATS.filter(function (p) { return p.item; }));
    $('bnEditor').querySelectorAll('.bn-pat').forEach(function (b) {
      paint(b.querySelector('canvas'), s.base, [{ p: b.getAttribute('data-p'), c: color }], s.shield);
    });
    swatches($('bnColor'), color);
  }

  // ---- outputs ----
  function itemName() {
    return $('bnName').value.trim();
  }
  function loreLines() {
    return $('bnLore').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  }
  function defaultName() { return s.shield ? 'Shield' : nice(s.base) + ' Banner'; }
  // Text as the game wants it: italic off (renamed items are italic by default).
  function text(t) { return JSON.stringify({ text: t, italic: false }); }
  function sq(t) { return "'" + t.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
  function dyeId(c) { return DYES.map(function (d) { return d[0]; }).indexOf(c); }
  function command() {
    var t = $('bnTarget').value;
    var item = s.shield ? 'shield' : s.base + '_banner';
    var name = itemName(), lore = loreLines();
    if (s.ver === 0) {
      var top = [], bet = [], disp = [];
      if (name) disp.push('Name:' + sq(text(name)));
      if (lore.length) disp.push('Lore:[' + lore.map(function (l) { return sq(text(l)); }).join(',') + ']');
      if (disp.length) top.push('display:{' + disp.join(',') + '}');
      if (s.shield) bet.push('Base:' + dyeId(s.base));
      if (s.layers.length) bet.push('Patterns:[' + s.layers.map(function (l) {
        return '{Pattern:"' + BY[l.p].code + '",Color:' + dyeId(l.c) + '}';
      }).join(',') + ']');
      if (bet.length) top.push('BlockEntityTag:{' + bet.join(',') + '}');
      return '/give ' + t + ' ' + item + (top.length ? '{' + top.join(',') + '}' : '');
    }
    var comp = [];
    // 1.21.5 made text components SNBT; 1.20.5 - 1.21.4 wants the JSON as a quoted string.
    var txt = s.ver === 2 ? text : function (x) { return sq(text(x)); };
    if (name) comp.push('custom_name=' + txt(name));
    if (lore.length) comp.push('lore=[' + lore.map(txt).join(',') + ']');
    if (s.shield) comp.push('base_color=' + s.base);
    if (s.layers.length) comp.push('banner_patterns=[' + s.layers.map(function (l) {
      return '{pattern:' + l.p + ',color:' + l.c + '}';
    }).join(',') + ']');
    return '/give ' + t + ' ' + item + (comp.length ? '[' + comp.join(',') + ']' : '');
  }
  function icon(name) { return '<img src="/minecrafticons/items/' + name + '.png" alt="">'; }
  function steps() {
    var out = ['<li>' + icon(s.base + '_wool') + icon('stick') + '<p><b>Craft a ' + nice(s.base) + ' Banner.</b> 6 ' + nice(s.base) + ' Wool across the top two rows of a crafting table, 1 Stick in the bottom middle.</p></li>'];
    s.layers.slice(0, LOOM).forEach(function (l, i) {
      var p = BY[l.p];
      var thumb = '<canvas data-step="' + i + '"></canvas>';
      out.push('<li>' + icon('loom') + icon(l.c + '_dye') + (p.item ? icon((ITEM_FILE[p.id] || p.id) + '_banner_pattern') : '') + thumb +
        '<p><b>Loom, layer ' + (i + 1) + ':</b> the banner + ' + nice(l.c) + ' Dye' +
        (p.item ? ' + the ' + p.item + ' Banner Pattern (you keep it)' : '') + ', then pick <b>' + p.name + '</b>.</p></li>');
    });
    if (s.layers.length > LOOM) out.push('<li class="is-stop"><p><b>Layers ' + (LOOM + 1) + '–' + s.layers.length + ' are command only.</b> A loom stops at 6 layers. Use the /give command above for the full design.</p></li>');
    if (s.shield) out.push('<li>' + icon('crafting_table') + '<p><b>Put it on a shield:</b> the finished banner + a Shield anywhere in a crafting grid. The banner is used up; the shield keeps its durability and enchantments.</p></li>');
    $('bnSteps').innerHTML = out.join('');
    $('bnSteps').querySelectorAll('canvas[data-step]').forEach(function (c) {
      var i = +c.getAttribute('data-step');
      paint(c, s.base, s.layers.slice(0, i + 1), false);
    });
  }
  function hash() {
    var name = itemName(), lore = loreLines();
    var h = 'v=' + s.ver + (s.shield ? '&shield=1' : '') + '&base=' + s.base +
      (s.layers.length ? '&l=' + s.layers.map(function (l) { return l.p + '.' + l.c; }).join(',') : '') +
      (name ? '&name=' + encodeURIComponent(name) : '') +
      (lore.length ? '&lore=' + encodeURIComponent(lore.join('\n')) : '');
    history.replaceState(null, '', '#' + h);
  }
  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  // The tooltip as the game draws it: name, the first 6 patterns in grey, then the lore.
  function tooltip() {
    var name = itemName();
    $('bnTip').innerHTML = '<b' + (name ? '' : ' class="is-default"') + '>' + esc(name || defaultName()) + '</b>' +
      s.layers.slice(0, LOOM).map(function (l) { return '<span>' + nice(l.c) + ' ' + BY[l.p].name + '</span>'; }).join('') +
      loreLines().map(function (l) { return '<span class="is-lore">' + esc(l) + '</span>'; }).join('');
    $('bnDefName').textContent = defaultName();
  }
  // Text fields only touch the outputs; the pickers stay as they are.
  function renderText() {
    var cmd = command();
    $('bnCmd').textContent = cmd;
    $('bnCopy').setAttribute('data-copy', cmd);
    $('bnMeta').innerHTML = cmd.length + ' characters' +
      (cmd.length > 256 ? ' <span class="mch-term-flags"><em class="is-block">Command block only</em></span>' : '');
    tooltip();
    hash();
  }
  function render(fresh) {
    paint(big, s.base, s.layers, s.shield);
    paint($('bnMini'), s.base, s.layers, s.shield); // phones: rides in the docked command bar
    big.className = 'bn-canvas' + (s.shield ? ' is-shield' : '');
    $('bnBaseName').textContent = nice(s.base);
    renderText();
    var notes = [];
    var same = s.layers.map(function (l, i) { return l.c === s.base ? i + 1 : 0; }).filter(Boolean);
    if (same.length) notes.push('Layer ' + same.join(', ') + ' is the same colour as the base, so it doesn\'t show.');
    if (s.layers.length > LOOM) notes.push('Banners with more than 6 layers only come from commands. A crafting table won\'t copy them, and the tooltip lists the first 6.');
    if (s.layers.some(function (l) { return l.p === 'bricks' || l.p === 'curly_border'; })) notes.push('Field Masoned and Bordure Indented can only be made in a loom from 1.21.2.');
    if (s.ver === 1 && s.layers.some(function (l) { return BY[l.p].v; })) notes.push('Flow and Guster need 1.21 or newer.');
    $('bnNote').textContent = notes.join(' ');
    drawLayers(fresh); drawEditor(); steps();
  }

  // ---- events ----
  function press(box, attr, val) {
    box.querySelectorAll('[' + attr + ']').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute(attr) === val)); });
  }
  $('bnVer').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ver]');
    if (!b) return;
    s.ver = +b.getAttribute('data-ver');
    press(this, 'data-ver', String(s.ver));
    // Flow and Guster don't exist before 1.21: drop them from the design.
    s.layers = s.layers.filter(function (l) { return ok(BY[l.p]); });
    s.sel = Math.min(s.sel, s.layers.length - 1);
    render();
  });
  $('bnKind').addEventListener('click', function (e) {
    var b = e.target.closest('[data-kind]');
    if (!b) return;
    s.shield = b.getAttribute('data-kind') === 'shield';
    press(this, 'data-kind', b.getAttribute('data-kind'));
    render();
  });
  $('bnBase').addEventListener('click', function (e) {
    var b = e.target.closest('[data-color]');
    if (!b) return;
    s.base = b.getAttribute('data-color');
    press(this, 'data-color', s.base);
    render();
  });
  $('bnColor').addEventListener('click', function (e) {
    var b = e.target.closest('[data-color]');
    if (!b) return;
    if (s.layers[s.sel]) s.layers[s.sel].c = b.getAttribute('data-color');
    else s.pick = b.getAttribute('data-color');
    render();
  });
  // Add mode: each pattern click stacks a new layer and stays in add mode.
  // Edit mode: the click changes the layer being edited.
  function pickPattern(e) {
    var b = e.target.closest('[data-p]');
    if (!b || b.disabled) return;
    if (s.layers[s.sel]) { s.layers[s.sel].p = b.getAttribute('data-p'); render(); }
    else if (s.layers.length < MAX) { s.layers.push({ p: b.getAttribute('data-p'), c: pickColor() }); render(s.layers.length - 1); }
  }
  $('bnGrid').addEventListener('click', pickPattern);
  $('bnGridItem').addEventListener('click', pickPattern);
  $('bnDone').addEventListener('click', function () { s.sel = -1; render(); });
  $('bnLayers').addEventListener('click', function (e) {
    var row = e.target.closest('[data-i]');
    if (!row) return;
    var i = +row.getAttribute('data-i'), act = e.target.closest('[data-act]');
    if (!act) { s.sel = s.sel === i ? -1 : i; render(); return; }
    var a = act.getAttribute('data-act'), L = s.layers;
    if (a === 'del') {
      L.splice(i, 1);
      if (s.sel === i) s.sel = -1;
      else if (s.sel > i) s.sel--;
    } else {
      // Moving keeps the editor on the same layer, wherever it lands.
      var j = a === 'up' ? i - 1 : i + 1; // up = earlier in the list = drawn sooner
      var t = L[i]; L[i] = L[j]; L[j] = t;
      if (s.sel === i) s.sel = j;
      else if (s.sel === j) s.sel = i;
    }
    render();
  });
  $('bnClear').addEventListener('click', function () { s.layers = []; s.sel = -1; render(); });
  $('bnTarget').addEventListener('input', renderText);
  $('bnName').addEventListener('input', renderText);
  $('bnLore').addEventListener('input', renderText);
  $('bnStarters').addEventListener('click', function (e) {
    var b = e.target.closest('[data-starter]');
    if (!b) return;
    var d = STARTERS[+b.getAttribute('data-starter')];
    s.base = d[1];
    s.layers = d[2].filter(function (l) { return ok(BY[l[0]]); }).map(function (l) { return { p: l[0], c: l[1] }; });
    s.sel = -1;
    swatches($('bnBase'), s.base);
    render();
  });
  $('bnLink').addEventListener('click', function () {
    var btn = this;
    (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject()).then(function () {
      btn.classList.add('is-done');
      btn.querySelector('span').textContent = 'Link copied';
      setTimeout(function () { btn.classList.remove('is-done'); btn.querySelector('span').textContent = 'Copy link'; }, 1600);
    }, function () {});
  });
  // PNG: the design at 16x, pixel-sharp, with the Parchrome watermark across the bottom.
  $('bnPng').addEventListener('click', function () {
    var src = paint(document.createElement('canvas'), s.base, s.layers, s.shield);
    var k = 16, c = document.createElement('canvas');
    c.width = src.width * k; c.height = src.height * k;
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, c.width, c.height);
    var size = Math.round(c.width / 10);
    x.font = '700 ' + size + 'px Orbitron, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'alphabetic';
    x.lineWidth = Math.max(2, size / 6);
    x.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    x.fillStyle = 'rgba(255, 255, 255, 0.8)';
    x.strokeText('PARCHROME', c.width / 2, c.height - size);
    x.fillText('PARCHROME', c.width / 2, c.height - size);
    var a = document.createElement('a');
    a.download = s.base + (s.shield ? '-shield' : '-banner') + '-parchrome.png';
    a.href = c.toDataURL('image/png');
    a.click();
  });

  // ---- start: read a shared design from the address ----
  function readHash() {
    var q = {};
    location.hash.slice(1).split('&').forEach(function (kv) {
      var p = kv.split('=');
      if (p[0]) q[p[0]] = decodeURIComponent(p[1] || '');
    });
    if (q.v === '0' || q.v === '1') s.ver = +q.v;
    s.shield = q.shield === '1';
    if (q.name) $('bnName').value = q.name.slice(0, 50);
    if (q.lore) $('bnLore').value = q.lore;
    if (HEX[q.base]) s.base = q.base;
    if (q.l) s.layers = q.l.split(',').map(function (x) { var p = x.split('.'); return { p: p[0], c: p[1] }; })
      .filter(function (l) { return BY[l.p] && HEX[l.c] && ok(BY[l.p]); }).slice(0, MAX);
  }
  readHash();
  press($('bnVer'), 'data-ver', String(s.ver));
  press($('bnKind'), 'data-kind', s.shield ? 'shield' : 'banner');
  swatches($('bnBase'), s.base);
  sprite.onload = function () {
    $('bnStarters').innerHTML = STARTERS.map(function (d, i) {
      return '<button type="button" class="bn-starter" data-starter="' + i + '"><canvas></canvas><span>' + d[0] + '</span></button>';
    }).join('');
    $('bnStarters').querySelectorAll('canvas').forEach(function (c, i) {
      var d = STARTERS[i];
      paint(c, d[1], d[2].map(function (l) { return { p: l[0], c: l[1] }; }), false);
    });
    render();
  };
  sprite.src = '/minecrafticons/banner-sprite.png?v=20261013';
})();
