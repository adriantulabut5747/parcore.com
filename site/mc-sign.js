/* Sign generator (Oct 13 2026), /minecraft/tools/sign. Read from the 26.3 game files:
   - text colour: plain text is the dye's text colour x 0.4; glow ink text is the full
     colour with an outline in that darker colour (black glow ink: a #F0EBCC outline)
     (AbstractSignRenderer.getDarkColor)
   - lines: 4, at most 90 px wide on a sign and 60 px on a hanging sign, 10 px apart
   - dye text colours: DyeColor textColor (white ffffff ... light gray d3d3d3)
   - 26.3 signs carry allow_op_features; click commands need it set
   Board art: the sign texture's front face (24 x 12 at 2,2) and the hanging sign
   edit-screen texture. Text: mc-font.js. Copy: mc-home.js. Styles: SIGN block (.sgn-*). */
(function () {
  var front = document.getElementById('sgnFront');
  if (!front) return;
  var $ = function (id) { return document.getElementById(id); };
  // redraw when the column's width changes (height follows the canvas, so ignore it)
  function watch(el, fn) {
    var w = 0;
    new ResizeObserver(function () { var nw = el.clientWidth; if (nw !== w) { w = nw; requestAnimationFrame(fn); } }).observe(el);
  }
  var F = McFont;
  var WOODS = [
    ['oak', 'Oak', 0], ['spruce', 'Spruce', 0], ['birch', 'Birch', 0], ['jungle', 'Jungle', 0], ['acacia', 'Acacia', 0], ['dark_oak', 'Dark Oak', 0],
    ['crimson', 'Crimson', 0, '1.16'], ['warped', 'Warped', 0, '1.16'], ['mangrove', 'Mangrove', 0, '1.19'], ['cherry', 'Cherry', 1], ['bamboo', 'Bamboo', 1],
    ['pale_oak', 'Pale Oak', 2, '1.21.4'], ['poplar', 'Poplar', 3, 'newest']
  ];
  // [id, name, text colour] from DyeColor
  var DYES = [['black', 'Black', '000000'], ['white', 'White', 'ffffff'], ['orange', 'Orange', 'ff681f'], ['magenta', 'Magenta', 'ff00ff'], ['light_blue', 'Light Blue', '9ac0cd'],
    ['yellow', 'Yellow', 'ffff00'], ['lime', 'Lime', 'bfff00'], ['pink', 'Pink', 'ff69b4'], ['gray', 'Gray', '808080'], ['light_gray', 'Light Gray', 'd3d3d3'], ['cyan', 'Cyan', '00ffff'],
    ['purple', 'Purple', 'a020f0'], ['blue', 'Blue', '0000ff'], ['brown', 'Brown', '8b4513'], ['green', 'Green', '00ff00'], ['red', 'Red', 'ff0000']];
  function side() { return { lines: [0, 1, 2, 3].map(function () { return { text: '', bold: false, italic: false, cmd: '' }; }), color: 'black', glow: false }; }
  var s = { wood: 'oak', hanging: false, wall: false, rot: 8, facing: 'north', at: 'front', ver: 3, out: 'give', waxed: false, back: false, sides: { front: side(), back: side() } };
  s.sides.front.lines[0].text = 'Welcome to';
  s.sides.front.lines[1] = { text: 'Parchrome', bold: true, italic: false, cmd: '' };
  s.sides.front.lines[2].text = 'Spawn is';
  s.sides.front.lines[3].text = 'this way';
  s.sides.front.color = 'orange';
  s.sides.back.lines[1].text = 'Come back soon';
  var imgs = {};
  function img(src) { if (!imgs[src]) { imgs[src] = new Image(); imgs[src].src = src; imgs[src].onload = draw; } return imgs[src]; }
  function dye(id) { return DYES.filter(function (d) { return d[0] === id; })[0]; }
  function maxW() { return s.hanging ? 60 : 90; }

  // ---- drawing ----
  function drawSide(cv, sd) {
    var hang = s.hanging, W = cv.parentNode.clientWidth || 380;
    var tex = hang ? img('/minecrafticons/signs/' + s.wood + '_hanging_gui.png') : img('/minecrafticons/signs/' + s.wood + '.png');
    var f = W >= 380 ? 4 : 3; // font pixel size
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var bw, bh, H;
    if (hang) { bw = 16 * 4.5 * f / 1.5; bh = bw; H = bh; } else { bw = 90 * f; bh = 45 * f; H = bh + (s.wall ? 0 : 52 * f); }
    cv.width = Math.round(bw * dpr); cv.height = Math.round(H * dpr); cv.style.width = bw + 'px'; cv.style.height = H + 'px';
    var x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, bw, H);
    if (!tex.naturalWidth) return;
    var cy;
    if (hang) { x.drawImage(tex, 0, 0, 16, 16, 0, 0, bw, bh); cy = bh * 0.69; }
    else {
      if (!s.wall) x.drawImage(tex, 28, 0, 2, 14, bw / 2 - 3.75 * f, bh, 7.5 * f, 52 * f); // the post
      x.drawImage(tex, 2, 2, 24, 12, 0, 0, bw, bh);
      cy = bh / 2;
    }
    var main = dye(sd.color)[2];
    var dark = sd.glow && sd.color === 'black' ? 'f0ebcc' : F.shade(main, 0.4);
    var lh = hang ? 9 : 10, fs = hang ? f * 0.9 : f;
    sd.lines.forEach(function (ln, i) {
      if (!ln.text) return;
      var runs = [{ text: ln.text, bold: ln.bold, italic: ln.italic, color: sd.glow ? main : dark }];
      var w = F.width(runs);
      var over = w > maxW();
      var px = Math.round(bw / 2 - Math.min(w, maxW()) * fs / 2), py = Math.round(cy + (i * lh - lh * 2) * fs);
      x.save();
      x.beginPath(); x.rect(bw / 2 - maxW() * fs / 2, py - fs, maxW() * fs, 10 * fs); x.clip();
      if (sd.glow) [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (o) {
        F.draw(x, [{ text: ln.text, bold: ln.bold, italic: ln.italic, color: dark }], px + o[0] * fs, py + o[1] * fs, { scale: fs, shadow: false });
      });
      F.draw(x, runs, px, py, { scale: fs, shadow: false });
      x.restore();
      if (over) { x.fillStyle = '#e86a6a'; x.fillRect(bw / 2 + maxW() * fs / 2 - 2, py, 3, 8 * fs); }
    });
  }
  function draw() {
    drawSide($('sgnFront'), s.sides.front);
    drawSide($('sgnBack'), s.sides.back);
  }

  // ---- commands ----
  function q(t) { return JSON.stringify(t); }
  function sq(t) { return "'" + t.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
  function lineSnbt(l) {
    var o = [];
    if (l.bold) o.push('bold:true');
    if (l.italic) o.push('italic:true');
    if (l.cmd) o.push('click_event:{action:"run_command",command:' + q(l.cmd.replace(/^\//, '')) + '}');
    return o.length ? '{text:' + q(l.text) + ',' + o.join(',') + '}' : q(l.text);
  }
  function lineJson(l) {
    if (!l.bold && !l.italic && !l.cmd) return q(l.text);
    var o = { text: l.text };
    if (l.bold) o.bold = true;
    if (l.italic) o.italic = true;
    if (l.cmd) o.clickEvent = { action: 'run_command', value: McText.slash(l.cmd) };
    return JSON.stringify(o);
  }
  function sideNbt(sd) {
    var msgs = s.ver === 3 ? sd.lines.map(lineSnbt).join(',') : sd.lines.map(function (l) { return sq(lineJson(l)); }).join(',');
    var o = ['messages:[' + msgs + ']'];
    if (sd.color !== 'black') o.push('color:"' + sd.color + '"');
    if (sd.glow) o.push('has_glowing_text:' + (s.ver === 3 ? 'true' : '1b'));
    return '{' + o.join(',') + '}';
  }
  function data() {
    var f = s.sides.front, b = s.sides.back, any = function (sd) { return sd.lines.some(function (l) { return l.cmd; }); };
    if (s.ver === 0) { // 1.14-1.19: Text1-4, front only
      var o0 = f.lines.map(function (l, i) { return 'Text' + (i + 1) + ':' + sq(lineJson(l)); });
      if (f.color !== 'black') o0.push('Color:"' + f.color + '"');
      if (f.glow) o0.push('GlowingText:1b');
      return o0.join(',');
    }
    var o = ['front_text:' + sideNbt(f)];
    if (s.back && b.lines.some(function (l) { return l.text; })) o.push('back_text:' + sideNbt(b));
    if (s.waxed) o.push('is_waxed:' + (s.ver === 3 ? 'true' : '1b'));
    if (s.ver === 3 && (any(f) || any(b))) o.push('allow_op_features:true');
    return o.join(',');
  }
  function blockId() {
    if (s.hanging) return s.wood + (s.wall ? '_wall_hanging_sign' : '_hanging_sign');
    return s.wood + (s.wall ? '_wall_sign' : '_sign');
  }
  function command() {
    var d = data(), tgt = $('sgnTarget').value;
    if (s.out === 'give') {
      var item = s.wood + (s.hanging ? '_hanging_sign' : '_sign');
      if (s.ver >= 2) return '/give ' + tgt + ' minecraft:' + item + '[block_entity_data={id:"minecraft:' + (s.hanging ? 'hanging_sign' : 'sign') + '",' + d + '}]';
      return '/give ' + tgt + ' minecraft:' + item + '{BlockEntityTag:{' + d + '}}';
    }
    var pos = [$('sgnX').value.trim() || '~', $('sgnY').value.trim() || '~', $('sgnZ').value.trim() || '~'].join(' ');
    if (s.out === 'data') return '/data merge block ' + pos + ' {' + d + '}';
    var state = s.wall ? '[facing=' + s.facing + ']' : '[rotation=' + s.rot + ']';
    return '/setblock ' + pos + ' minecraft:' + blockId() + state + '{' + d + '}';
  }

  // ---- builder ----
  function drawWoods() {
    $('sgnWood').innerHTML = WOODS.filter(function (w) { return w[2] <= s.ver; }).map(function (w) {
      return '<button type="button" class="pt-slot sgn-wood" data-wood="' + w[0] + '" aria-pressed="' + (s.wood === w[0]) + '"><img src="/minecrafticons/items/' + w[0] + (s.hanging ? '_hanging_sign' : '_sign') + '.png" alt=""><span>' + w[1] + '</span>' + (w[3] ? '<em class="pt-since">' + w[3] + '+</em>' : '') + '</button>';
    }).join('');
  }
  function drawLines() {
    var sd = s.sides[s.at];
    $('sgnLines').innerHTML = sd.lines.map(function (l, i) {
      var w = F.width([{ text: l.text, bold: l.bold }]);
      return '<li class="sgn-line' + (w > maxW() ? ' is-over' : '') + '"><span class="sgn-n">' + (i + 1) + '</span>' +
        '<input class="pt-input" data-line="' + i + '" data-k="text" value="' + l.text.replace(/"/g, '&quot;') + '" maxlength="50" spellcheck="false" aria-label="Line ' + (i + 1) + '">' +
        '<button type="button" class="txe-st txe-st--bold" data-line="' + i + '" data-k="bold" aria-pressed="' + l.bold + '" aria-label="Bold">B</button>' +
        '<button type="button" class="txe-st txe-st--italic" data-line="' + i + '" data-k="italic" aria-pressed="' + l.italic + '" aria-label="Italic">I</button>' +
        '<span class="sgn-w"><b>' + w + '</b>/' + maxW() + '</span>' +
        '<input class="pt-input sgn-cmd" data-line="' + i + '" data-k="cmd" value="' + l.cmd.replace(/"/g, '&quot;') + '" placeholder="Click runs a command (optional)" spellcheck="false" aria-label="Command for line ' + (i + 1) + '"' + (s.ver === 0 ? ' disabled' : '') + '></li>';
    }).join('');
    $('sgnDye').querySelectorAll('[data-dye]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-dye') === sd.color)); });
    $('sgnGlow').setAttribute('aria-pressed', String(sd.glow));
  }
  function render() {
    var out = command();
    $('sgnCmd').textContent = out;
    $('sgnCopy').setAttribute('data-copy', out);
    $('sgnMeta').innerHTML = out.length + ' characters' + (out.length > 256 ? ' <span class="mch-term-flags"><em class="is-block">Command block only</em></span>' : '');
    document.querySelectorAll('[data-v1]').forEach(function (el) { el.hidden = s.ver === 0; });
    $('sgnSideTabs').hidden = !s.back || s.ver === 0;
    $('sgnPos').hidden = s.out === 'give';
    $('sgnRotWrap').hidden = s.wall || s.out !== 'place';
    $('sgnFace').hidden = !s.wall || s.out !== 'place';
    $('sgnSend').hidden = s.out !== 'give';
    $('sgnCard').classList.toggle('is-flipped', s.at === 'back' && s.back && s.ver > 0);
    $('sgnCard').classList.toggle('is-hanging', s.hanging);
    $('sgnFlipK').textContent = s.at === 'back' && s.back ? 'Back' : 'Front';
    var notes = [];
    if (s.ver === 0) notes.push('1.14 to 1.19 signs have one side, and click commands need 1.20 or newer in this tool.');
    if (s.sides.front.lines.concat(s.sides.back.lines).some(function (l) { return F.width([{ text: l.text, bold: l.bold }]) > maxW(); })) notes.push('A red mark means the line is wider than the sign, so the game cuts it there.');
    if (s.ver === 3 && /allow_op_features/.test(out)) notes.push('Click commands run as the player who clicks, with command block rights. From 26.3 they also need allow_op_features, which is added for you.');
    notes.push('Bedrock has no sign text commands: type the text on the sign, with § codes for colour.');
    $('sgnNotes').innerHTML = notes.map(function (n) { return '<li>' + n + '</li>'; }).join('');
    draw();
  }
  $('sgnDye').innerHTML = DYES.map(function (d) {
    return '<button type="button" class="pt-slot bcn-glass" data-dye="' + d[0] + '" title="' + d[1] + ' dye" aria-label="' + d[1] + ' dye"><img src="/minecrafticons/dyes/' + d[0] + '_dye.png" alt=""></button>';
  }).join('');
  $('sgnWood').addEventListener('click', function (e) { var b = e.target.closest('[data-wood]'); if (!b) return; s.wood = b.getAttribute('data-wood'); drawWoods(); render(); });
  $('sgnDye').addEventListener('click', function (e) { var b = e.target.closest('[data-dye]'); if (!b) return; s.sides[s.at].color = b.getAttribute('data-dye'); drawLines(); render(); });
  $('sgnGlow').addEventListener('click', function () { s.sides[s.at].glow = !s.sides[s.at].glow; drawLines(); render(); });
  $('sgnWax').addEventListener('click', function () { s.waxed = !s.waxed; this.setAttribute('aria-pressed', String(s.waxed)); render(); });
  $('sgnLines').addEventListener('input', function (e) {
    var i = e.target.getAttribute('data-line'), k = e.target.getAttribute('data-k');
    if (i == null) return;
    s.sides[s.at].lines[i][k] = e.target.value;
    var li = e.target.closest('.sgn-line'), w = F.width([{ text: s.sides[s.at].lines[i].text, bold: s.sides[s.at].lines[i].bold }]);
    li.querySelector('.sgn-w b').textContent = w;
    li.classList.toggle('is-over', w > maxW());
    render();
  });
  $('sgnLines').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-k]');
    if (!b) return;
    var l = s.sides[s.at].lines[b.getAttribute('data-line')], k = b.getAttribute('data-k');
    l[k] = !l[k];
    drawLines(); render();
  });
  function seg(id, attr, fn) {
    $(id).addEventListener('click', function (e) {
      var b = e.target.closest('[' + attr + ']');
      if (!b) return;
      this.querySelectorAll('[' + attr + ']').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      fn(b.getAttribute(attr));
      render();
    });
  }
  seg('sgnKind', 'data-kind', function (v) { s.hanging = v === 'hanging'; drawWoods(); drawLines(); });
  seg('sgnMount', 'data-mount', function (v) { s.wall = v === 'wall'; });
  seg('sgnSideTabs', 'data-side', function (v) { s.at = v; drawLines(); });
  seg('sgnOut', 'data-out', function (v) { s.out = v; });
  seg('sgnVer', 'data-ver', function (v) {
    s.ver = +v;
    var w = WOODS.filter(function (x) { return x[0] === s.wood; })[0];
    if (w[2] > s.ver) s.wood = 'oak';
    if (s.ver < 1) { s.hanging = false; s.back = false; s.at = 'front'; $('sgnBackOn').checked = false; }
    drawWoods(); drawLines();
  });
  seg('sgnFace', 'data-face', function (v) { s.facing = v; });
  $('sgnRot').addEventListener('input', function () { s.rot = +this.value; $('sgnRotV').textContent = ['S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE'][s.rot] + ' (' + s.rot + ')'; render(); });
  $('sgnBackOn').addEventListener('change', function () { s.back = this.checked; if (!s.back) s.at = 'front'; drawLines(); render(); });
  $('sgnCard').addEventListener('click', function () { if (!s.back || s.ver === 0) return; s.at = s.at === 'front' ? 'back' : 'front'; $('sgnSideTabs').querySelectorAll('[data-side]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-side') === s.at)); }); drawLines(); render(); });
  ['sgnTarget', 'sgnX', 'sgnY', 'sgnZ'].forEach(function (id) { $(id).addEventListener('input', render); });
  if ('ResizeObserver' in window) watch($('sgnCard').parentNode, draw);
  drawWoods();
  F.load(function () { drawLines(); render(); });
})();
