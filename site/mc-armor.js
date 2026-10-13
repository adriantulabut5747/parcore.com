/* Armor colour generator (Oct 13 2026), /minecraft/tools/armor.
   Dyed leather (and wolf armor) as /give commands, a dye recipe finder, and a
   3D player wearing the set.
   Crafting-table dyeing, read from the 26.3 game files (DyedItemColor.applyDyes):
     add up R, G and B of the armor's current colour (if dyed) and of every dye
     (DyeColor textureDiffuseColor), and the brightest channel of each;
     average each with whole-number division, then scale every channel by
     (average of the brightest channels) / (brightest averaged channel), in floats.
   Undyed leather does not count as a colour, so one dye on new armor gives
   exactly that dye's colour. The finder tries every mix of 1-8 dyes (735,000)
   on new armor, then adds 1-3 more dyes to the best few for a second craft.
   3D: skinview3d (jsDelivr, as on Skin Lookup) with the game's leather armor
   layers (entity/equipment/humanoid*) tinted and painted onto Steve's outer layer.
   Copy buttons: mc-home.js. Styles: ARMOR block in mc-home.css (.arm-*). */
var McLeather = (function () {
  var f32 = Math.fround;
  function mix(base, dyes) {
    var r = 0, g = 0, b = 0, mx = 0, n = 0;
    function add(c) {
      var R = c >> 16 & 255, G = c >> 8 & 255, B = c & 255;
      mx += Math.max(R, G, B); r += R; g += G; b += B; n++;
    }
    if (base != null) add(base);
    dyes.forEach(add);
    if (!n) return base;
    return scale(r, g, b, mx, n);
  }
  function scale(r, g, b, mx, n) {
    var ar = Math.floor(r / n), ag = Math.floor(g / n), ab = Math.floor(b / n);
    var f = f32(f32(mx) / f32(n)), top = f32(Math.max(ar, ag, ab));
    function ch(v) { var x = f32(f32(f32(v) * f) / top); return isFinite(x) ? Math.min(255, Math.trunc(x)) : 0; }
    return ch(ar) << 16 | ch(ag) << 8 | ch(ab);
  }
  // Best dye mixes for a target colour. cols = 16 dye colours.
  function find(cols, target, near) {
    var best = [];
    function keep(list, item, size) {
      for (var k = 0; k < list.length; k++) if (list[k].color === item.color) { if (item.n < list[k].n) list[k] = item; return; }
      if (list.length >= size && item.d >= list[list.length - 1].d) return;
      list.push(item); list.sort(function (a, b) { return a.d - b.d; });
      if (list.length > size) list.pop();
    }
    var counts = new Array(16).fill(0);
    // one craft on new armor: every mix of 1-8 dyes
    (function go(i, left, r, g, b, mx, n) {
      if (n > 0) { var c = scale(r, g, b, mx, n); keep(best, { d: near(c, target), color: c, steps: [counts.slice()], n: n }, 60); }
      if (i === 16 || left === 0) return;
      for (var k = 0; k <= left; k++) {
        counts[i] = k;
        var c2 = cols[i], R = c2 >> 16 & 255, G = c2 >> 8 & 255, B = c2 & 255, M = Math.max(R, G, B);
        go(i + 1, left - k, r + R * k, g + G * k, b + B * k, mx + M * k, n + k);
      }
      counts[i] = 0;
    })(0, 8, 0, 0, 0, 0, 0);
    // a second craft: 1-3 more dyes on each of the best results
    var two = best.slice();
    best.forEach(function (base) {
      var R0 = base.color >> 16 & 255, G0 = base.color >> 8 & 255, B0 = base.color & 255, M0 = Math.max(R0, G0, B0);
      (function go(i, left, r, g, b, mx, n) {
        if (n > 1) { var c = scale(r, g, b, mx, n); keep(two, { d: near(c, target), color: c, steps: [base.steps[0], counts.slice()], n: base.n + n - 1 }, 60); }
        if (i === 16 || left === 0) return;
        for (var k = 0; k <= left; k++) {
          counts[i] = k;
          var c2 = cols[i], R = c2 >> 16 & 255, G = c2 >> 8 & 255, B = c2 & 255, M = Math.max(R, G, B);
          go(i + 1, left - k, r + R * k, g + G * k, b + B * k, mx + M * k, n + k);
        }
        counts[i] = 0;
      })(0, 3, R0, G0, B0, M0, 1);
    });
    return two;
  }
  return { mix: mix, find: find, scale: scale };
})();
if (typeof module !== 'undefined') module.exports = McLeather;

(function () {
  if (typeof document === 'undefined') return;
  var root = document.getElementById('armPieces');
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var D = McDyes, COLS = D.LIST.map(function (d) { return d.tex; });
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PIECES = [
    { id: 'helmet', item: 'leather_helmet', name: 'Leather Cap', icon: 'leather_helmet_base', over: 'leather_helmet_overlay' },
    { id: 'chestplate', item: 'leather_chestplate', name: 'Leather Tunic', icon: 'leather_chestplate_base', over: 'leather_chestplate_overlay' },
    { id: 'leggings', item: 'leather_leggings', name: 'Leather Pants', icon: 'leather_leggings_base', over: 'leather_leggings_overlay' },
    { id: 'boots', item: 'leather_boots', name: 'Leather Boots', icon: 'leather_boots_base', over: 'leather_boots_overlay' },
    { id: 'horse', item: 'leather_horse_armor', name: 'Leather Horse Armor', icon: 'leather_horse_armor', over: 'leather_horse_armor_overlay' },
    { id: 'wolf', item: 'wolf_armor', name: 'Wolf Armor', icon: 'wolf_armor', over: 'wolf_armor_overlay', v: 1 }
  ];
  var COLORS = {
    white: 'ffffff', gray: 'aaaaaa', dark_gray: '555555', black: '000000', red: 'ff5555', dark_red: 'aa0000', gold: 'ffaa00', yellow: 'ffff55',
    green: '55ff55', dark_green: '00aa00', aqua: '55ffff', dark_aqua: '00aaaa', blue: '5555ff', dark_blue: '0000aa', light_purple: 'ff55ff', dark_purple: 'aa00aa'
  };
  var s = { color: 0x3c8527, ver: 2, on: { helmet: true, chestplate: true, leggings: true, boots: true }, recipes: [], ncolor: '' };
  function piece(id) { return PIECES.filter(function (p) { return p.id === id; })[0]; }
  function itemSrc(n) { return '/minecrafticons/items/' + n + '.png'; }

  // ---- tinted item icons: base texture x colour, overlay on top untinted ----
  function paintIcon(cv, p) {
    var a = D.img(itemSrc(p.icon)), b = D.img(itemSrc(p.over));
    if (!a.complete || !a.naturalWidth) return;
    var x = cv.getContext('2d');
    cv.width = 16; cv.height = 16;
    D.tint(x, a, s.color, 16, 16);
    if (b.complete && b.naturalWidth) x.drawImage(b, 0, 0);
  }
  function paintIcons() {
    document.querySelectorAll('canvas[data-piece]').forEach(function (cv) { paintIcon(cv, piece(cv.getAttribute('data-piece'))); });
  }
  PIECES.forEach(function (p) { D.img(itemSrc(p.icon)).addEventListener('load', paintIcons); D.img(itemSrc(p.over)).addEventListener('load', paintIcons); });

  // ---- 3D: Steve wearing the set ----
  var viewer = null, skin = document.createElement('canvas');
  skin.width = 64; skin.height = 64;
  var TEX = {
    steve: D.img('/minecrafticons/entity/steve.png'),
    l1: D.img('/minecrafticons/entity/leather_humanoid.png'), l1o: D.img('/minecrafticons/entity/leather_humanoid_overlay.png'),
    l2: D.img('/minecrafticons/entity/leather_leggings_layer.png'), l2o: D.img('/minecrafticons/entity/leather_leggings_layer_overlay.png')
  };
  function ready() { return Object.keys(TEX).every(function (k) { return TEX[k].complete && TEX[k].naturalWidth; }); }
  // one armor layer (64x32) tinted, with its overlay
  function layerCanvas(img, over) {
    var c = document.createElement('canvas'); c.width = 64; c.height = 32;
    var x = c.getContext('2d');
    D.tint(x, img, s.color, 64, 32);
    x.drawImage(over, 0, 0);
    return c;
  }
  // copy a limb (16x16 block) mirrored the way the game mirrors left limbs:
  // each face flipped, and the outer/inner side faces swapped
  function mirrorLimb(x, src, sx, sy, dx, dy) {
    var faces = [[4, 0, 4, 4, 4], [8, 0, 4, 4, 8], [0, 4, 4, 12, 8], [4, 4, 4, 12, 4], [8, 4, 4, 12, 0], [12, 4, 4, 12, 12]];
    faces.forEach(function (f) {
      x.save();
      x.translate(dx + f[4] + f[2], dy + f[1]);
      x.scale(-1, 1);
      x.drawImage(src, sx + f[0], sy + f[1], f[2], f[3], 0, 0, f[2], f[3]);
      x.restore();
    });
  }
  function paintSkin() {
    if (!ready()) return false;
    var x = skin.getContext('2d');
    x.clearRect(0, 0, 64, 64);
    x.drawImage(TEX.steve, 0, 0);
    // Steve's own outer layer is cleared so only armor sits there
    [[32, 0, 32, 16], [16, 32, 24, 16], [40, 32, 16, 16], [48, 48, 16, 16], [0, 32, 16, 16], [0, 48, 16, 16]].forEach(function (r) { x.clearRect(r[0], r[1], r[2], r[3]); });
    var L1 = layerCanvas(TEX.l1, TEX.l1o), L2 = layerCanvas(TEX.l2, TEX.l2o);
    if (s.on.leggings) {
      x.drawImage(L2, 16, 16, 24, 16, 16, 32, 24, 16);
      x.drawImage(L2, 0, 16, 16, 16, 0, 32, 16, 16);
      mirrorLimb(x, L2, 0, 16, 0, 48);
    }
    if (s.on.chestplate) {
      x.drawImage(L1, 16, 16, 24, 16, 16, 32, 24, 16);
      x.drawImage(L1, 40, 16, 16, 16, 40, 32, 16, 16);
      mirrorLimb(x, L1, 40, 16, 48, 48);
    }
    if (s.on.boots) {
      x.drawImage(L1, 0, 16, 16, 16, 0, 32, 16, 16);
      mirrorLimb(x, L1, 0, 16, 0, 48);
    }
    if (s.on.helmet) x.drawImage(L1, 0, 0, 32, 16, 32, 0, 32, 16);
    return true;
  }
  function refresh3d() {
    if (!viewer || !paintSkin()) return;
    viewer.loadSkin(skin, { model: 'default' });
  }
  Object.keys(TEX).forEach(function (k) { TEX[k].addEventListener('load', refresh3d); });
  function boot() {
    var cv = $('armCanvas'), stage = cv.parentNode;
    var sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/skinview3d@3.1.0/bundles/skinview3d.bundle.js';
    sc.onload = function () {
      try {
        viewer = new window.skinview3d.SkinViewer({ canvas: cv, width: stage.clientWidth, height: stage.clientHeight });
        viewer.zoom = 0.86;
        viewer.fov = 40;
        viewer.controls.enableZoom = false;
        cv.style.touchAction = 'pan-y';
        viewer.animation = new window.skinview3d.IdleAnimation();
        viewer.animation.paused = reduced;
        viewer.autoRotate = !reduced;
        viewer.autoRotateSpeed = 0.6;
        viewer.playerObject.rotation.y = -0.45;
        // a drag stops the turning, so the angle you pick stays
        cv.addEventListener('pointerdown', function () { viewer.autoRotate = false; });
        refresh3d();
        new ResizeObserver(function () { viewer.setSize(stage.clientWidth, stage.clientHeight); }).observe(stage);
      } catch (e) { $('armStage').classList.add('is-flat'); }
    };
    sc.onerror = function () { $('armStage').classList.add('is-flat'); };
    document.head.appendChild(sc);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); boot(); } }, { rootMargin: '600px 0px' });
    io.observe($('armCanvas'));
  } else boot();

  // ---- recipe finder (worker, like the beacon search) ----
  var worker = null, job = 0;
  function findRecipes() {
    var me = ++job;
    $('armRecipes').setAttribute('aria-busy', 'true');
    $('armRecipeStatus').textContent = 'Trying 735,000 dye mixes…';
    function done(list) {
      if (me !== job) return;
      var seen = {};
      s.recipes = list.map(function (r) { r.de = D.de(r.color, s.color); return r; })
        .sort(function (a, b) { return a.de - b.de || a.n - b.n; })
        .filter(function (r) { var k = r.color; if (seen[k]) return false; seen[k] = 1; return true; })
        .slice(0, 5);
      $('armRecipes').removeAttribute('aria-busy');
      drawRecipes();
    }
    if (window.Worker && window.Blob) {
      if (worker) worker.terminate();
      // the worker runs this file's own mixing code
      var src = 'var f32=Math.fround;var scale=' + McLeather.scale + ';var find=' + McLeather.find + ';var near=' + D.near +
        ';onmessage=function(e){postMessage(find(e.data.cols,e.data.target,near));};';
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = function (e) { done(e.data); };
      worker.postMessage({ cols: COLS, target: s.color });
    } else setTimeout(function () { done(McLeather.find(COLS, s.color, D.near)); }, 20);
  }
  function stepHtml(counts, first) {
    var parts = [];
    counts.forEach(function (n, i) { if (n) parts.push('<span class="arm-dye"><img src="/minecrafticons/dyes/' + D.LIST[i].id + '_dye.png" alt="">' + (n > 1 ? '<b>&times;' + n + '</b>' : '') + '<em class="arm-sr">' + n + ' ' + D.LIST[i].name + ' dye</em></span>'); });
    return '<span class="arm-step">' + (first ? '' : '<i aria-hidden="true">then</i>') + parts.join('') + '</span>';
  }
  function drawRecipes() {
    $('armRecipeStatus').textContent = s.recipes.length ? 'Put the armor and the dyes in a crafting table. Two steps = craft, then dye the result again.' : '';
    $('armRecipes').innerHTML = s.recipes.map(function (r, i) {
      return '<li><button type="button" class="arm-recipe" data-recipe="' + i + '" aria-label="Use this recipe, ' + D.match(r.color, s.color) + ' percent match">' +
        '<span class="arm-recipe-steps">' + r.steps.map(function (c, k) { return stepHtml(c, k === 0); }).join('') + '</span>' +
        '<span class="bcn-res-sw" style="background:' + D.hex(r.color) + '"></span>' +
        '<span class="bcn-res-m"><b>' + D.match(r.color, s.color) + '%</b><small>' + D.hex(r.color) + '</small></span></button></li>';
    }).join('');
  }

  // ---- commands ----
  function sq(t) { return "'" + t.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
  function giveLines() {
    var name = $('armName').value.trim(), lore = $('armLore').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var unb = $('armUnb').checked, hide = $('armHide').checked, n = Math.min(64, Math.max(1, parseInt($('armCount').value, 10) || 1));
    var nameObj = { text: name, italic: false };
    if (s.ncolor) nameObj.color = s.ncolor;
    var loreObj = lore.map(function (l) { return JSON.stringify({ text: l, italic: false }); });
    var col = s.color;
    return PIECES.filter(function (p) { return s.on[p.id] && (p.v || 0) <= s.ver; }).map(function (p) {
      var item;
      if (s.ver === 0) {
        var disp = ['color:' + col];
        if (name) disp.push('Name:' + sq(JSON.stringify(nameObj)));
        if (lore.length) disp.push('Lore:[' + loreObj.map(sq).join(',') + ']');
        var parts = ['display:{' + disp.join(',') + '}'];
        if (unb) parts.push('Unbreakable:1b');
        if (hide) parts.push('HideFlags:' + (64 + (unb ? 4 : 0)));
        item = 'minecraft:' + p.item + '{' + parts.join(',') + '}';
      } else {
        var c = [];
        if (s.ver === 2) {
          c.push('dyed_color=' + col);
          if (unb) c.push('unbreakable={}');
          if (hide) c.push('tooltip_display={hidden_components:["minecraft:dyed_color"' + (unb ? ',"minecraft:unbreakable"' : '') + ']}');
        } else {
          c.push('dyed_color={rgb:' + col + (hide ? ',show_in_tooltip:false' : '') + '}');
          if (unb) c.push('unbreakable={' + (hide ? 'show_in_tooltip:false' : '') + '}');
        }
        if (name) c.push('custom_name=' + (s.ver === 2 ? JSON.stringify(nameObj) : sq(JSON.stringify(nameObj))));
        if (lore.length) c.push('lore=[' + (s.ver === 2 ? loreObj : loreObj.map(sq)).join(',') + ']');
        item = 'minecraft:' + p.item + '[' + c.join(',') + ']';
      }
      return '/give ' + $('armTarget').value + ' ' + item + (n > 1 ? ' ' + n : '');
    });
  }

  function render() {
    var hx = D.hex(s.color);
    $('armHexOut').textContent = hx + ' · ' + s.color;
    $('armSw').style.background = hx;
    var lines = giveLines(), out = lines.join('\n');
    $('armCmd').textContent = out || 'Pick at least one piece.';
    $('armCopy').setAttribute('data-copy', out);
    $('armCopy').disabled = !out;
    var longest = Math.max.apply(null, lines.map(function (l) { return l.length; }).concat(0));
    $('armMeta').innerHTML = lines.length + (lines.length === 1 ? ' command' : ' commands') + (longest > 256 ? ' <span class="mch-term-flags"><em class="is-block">Command block only</em></span>' : '');
    // tooltip for the first picked piece
    var first = PIECES.filter(function (p) { return s.on[p.id] && (p.v || 0) <= s.ver; })[0] || PIECES[1];
    var name = $('armName').value.trim();
    var tip = '<div><b style="font-weight:400;color:#' + (COLORS[s.ncolor] || 'ffffff') + '">' + esc(name || first.name) + '</b>';
    if (!$('armHide').checked) tip += '<span class="arm-tip-dyed">Dyed</span>';
    tip += $('armLore').value.split('\n').filter(function (l) { return l.trim(); }).map(function (l) { return '<span class="is-lore">' + esc(l.trim()) + '</span>'; }).join('');
    if ($('armUnb').checked && !$('armHide').checked) tip += '<span class="is-unb">Unbreakable</span>';
    $('armTip').innerHTML = tip + '</div>';
    document.querySelectorAll('[data-pick]').forEach(function (b) {
      var p = piece(b.getAttribute('data-pick'));
      b.setAttribute('aria-pressed', String(!!s.on[p.id]));
      b.hidden = (p.v || 0) > s.ver;
    });
    paintIcons();
    refresh3d();
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---- input ----
  function setColor(n, from) {
    if (n == null) return;
    s.color = n;
    if (from !== 'hex') $('armHex').value = D.hex(n);
    if (from !== 'picker') $('armPicker').value = D.hex(n);
    render();
    findRecipes();
  }
  $('armHex').addEventListener('input', function () { setColor(D.parse(this.value), 'hex'); });
  $('armPicker').addEventListener('input', function () { setColor(D.parse(this.value), 'picker'); });
  $('armDyes').innerHTML = D.LIST.map(function (d) {
    return '<button type="button" class="pt-slot arm-dye-slot" data-dye="' + d.id + '" title="' + d.name + ' dye" aria-label="' + d.name + ' dye (' + D.hex(d.tex) + ')"><img src="/minecrafticons/dyes/' + d.id + '_dye.png" alt=""></button>';
  }).join('');
  $('armDyes').addEventListener('click', function (e) {
    var b = e.target.closest('[data-dye]');
    if (b) setColor(D.byId(b.getAttribute('data-dye')).tex);
  });
  root.innerHTML = PIECES.map(function (p) {
    return '<button type="button" class="pt-slot pt-slot--item" data-pick="' + p.id + '" aria-pressed="false"><canvas data-piece="' + p.id + '" width="16" height="16" aria-hidden="true"></canvas><span>' + p.name.replace('Leather ', '') + '</span></button>';
  }).join('');
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pick]');
    if (!b) return;
    var id = b.getAttribute('data-pick');
    s.on[id] = !s.on[id];
    render();
  });
  $('armRecipes').addEventListener('click', function (e) {
    var b = e.target.closest('[data-recipe]');
    if (!b) return;
    var r = s.recipes[+b.getAttribute('data-recipe')];
    // the recipe's exact colour becomes the colour, so the command matches what you can craft
    s.color = r.color;
    $('armHex').value = $('armPicker').value = D.hex(r.color);
    render();
    findRecipes();
  });
  $('armVer').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ver]');
    if (!b) return;
    s.ver = +b.getAttribute('data-ver');
    this.querySelectorAll('[data-ver]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    render();
  });
  $('armNameColor').innerHTML = '<button type="button" class="pt-sw pt-sw--none" data-ncolor="" aria-pressed="true" aria-label="White, the default">Aa</button>' +
    Object.keys(COLORS).map(function (c) { return '<button type="button" class="pt-sw" data-ncolor="' + c + '" aria-pressed="false" aria-label="' + c.replace('_', ' ') + '" title="' + c.replace('_', ' ') + '" style="background:#' + COLORS[c] + '"></button>'; }).join('');
  $('armNameColor').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ncolor]');
    if (!b) return;
    s.ncolor = b.getAttribute('data-ncolor');
    this.querySelectorAll('[data-ncolor]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    render();
  });
  ['armName', 'armLore', 'armUnb', 'armHide', 'armCount', 'armTarget'].forEach(function (id) { $(id).addEventListener('input', render); });

  $('armHex').value = $('armPicker').value = D.hex(s.color);
  render();
  findRecipes();
})();
