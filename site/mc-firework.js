/* Firework generator (Oct 13 2026), /minecraft/tools/firework.
   Rockets with one or more explosions as /give, /summon or a firework star,
   the survival crafting grids, and a night sky that launches the rocket.
   Field names come from the 26.3 game files (Fireworks, FireworkExplosion):
     1.20.5+     fireworks={flight_duration:1,explosions:[{shape:"small_ball",colors:[I;..],
                 fade_colors:[I;..],has_trail:true,has_twinkle:true}]}   (flight 0-255)
     1.13-1.20.4 {Fireworks:{Flight:1b,Explosions:[{Type:0b,Colors:[I;..],FadeColors:[I;..],
                 Trail:1b,Flicker:1b}]}}                                  (flight 0-127)
   Spark colours = DyeColor fireworkColor (mc-dyes.js). A summoned rocket needs
   LifeTime, or it bursts the tick it spawns: the game gives a crafted rocket
   10 x (flight + 1) + 0-11 ticks, so the command uses 10 x (flight + 1) + 6.
   The sky is an impression: shapes follow the game's star and creeper outlines
   (FireworkParticles), sizes and timing are approximate.
   Copy buttons: mc-home.js. Styles: FIREWORK block in mc-home.css (.fwk-*). */
(function () {
  // Shared with the Mob Summon tool (Oct 19: a mob can drop a rocket or a star): the shapes and the explosion NBT,
  // old (Explosions) and new (explosions). exNew / exOld are hoisted, so this runs before the page check.
  window.McFirework = { SHAPES: null, exNew: exNew, exOld: exOld };
  var SHAPES = window.McFirework.SHAPES = [
    { id: 'small_ball', n: 0, name: 'Small Ball', item: null, icon: 'firework_star' },
    { id: 'large_ball', n: 1, name: 'Large Ball', item: 'fire_charge', icon: 'fire_charge' },
    { id: 'star', n: 2, name: 'Star-shaped', item: 'gold_nugget', icon: 'gold_nugget' },
    { id: 'creeper', n: 3, name: 'Creeper-shaped', item: 'creeper_head', icon: 'creeper' },
    { id: 'burst', n: 4, name: 'Burst', item: 'feather', icon: 'feather' }
  ];
  var sky = document.getElementById('fwkSky');
  if (!sky) return;
  var $ = function (id) { return document.getElementById(id); };
  var D = McDyes;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COLORS = {
    white: 'ffffff', gray: 'aaaaaa', dark_gray: '555555', black: '000000', red: 'ff5555', dark_red: 'aa0000', gold: 'ffaa00', yellow: 'ffff55',
    green: '55ff55', dark_green: '00aa00', aqua: '55ffff', dark_aqua: '00aaaa', blue: '5555ff', dark_blue: '0000aa', light_purple: 'ff55ff', dark_purple: 'aa00aa'
  };
  function blank() { return { shape: 'small_ball', colors: [D.byId('red').fw], fade: [], trail: false, twinkle: false }; }
  var s = { ex: [{ shape: 'large_ball', colors: [D.byId('red').fw, D.byId('yellow').fw], fade: [D.byId('white').fw], trail: true, twinkle: false }],
    at: 0, flight: 2, ver: 2, out: 'rocket', burst: 'fly', ncolor: '' };
  function shape(id) { return SHAPES.filter(function (x) { return x.id === id; })[0]; }
  function cur() { return s.ex[s.at]; }
  function colorName(n) { var d = D.LIST.filter(function (x) { return x.fw === n; })[0]; return d ? d.name : 'Custom'; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function item(n) { return '/minecrafticons/items/' + n + '.png'; }
  function dyeOf(n) { return D.LIST.filter(function (x) { return x.fw === n; })[0]; }

  // ---- icons that need drawing: the creeper head face, the tinted star ----
  var creeperTex = D.img('/minecrafticons/entity/creeper.png'), starTex = D.img(item('firework_star')), starOver = D.img(item('firework_star_overlay'));
  function paintCanvases() {
    document.querySelectorAll('canvas[data-creeper]').forEach(function (c) {
      if (!creeperTex.complete || !creeperTex.naturalWidth) return;
      c.width = 8; c.height = 8;
      c.getContext('2d').drawImage(creeperTex, 8, 8, 8, 8, 0, 0, 8, 8);
    });
    document.querySelectorAll('canvas[data-star]').forEach(function (c) {
      if (!starTex.complete || !starOver.complete || !starOver.naturalWidth) return;
      var at = c.getAttribute('data-star'), e = at === '' ? cur() : s.ex[+at] || cur(), x = c.getContext('2d');
      c.width = 16; c.height = 16;
      // FireworkStarItem: the overlay takes the average of the explosion's colours
      var r = 0, g = 0, b = 0;
      e.colors.forEach(function (n) { r += n >> 16 & 255; g += n >> 8 & 255; b += n & 255; });
      var k = e.colors.length || 1, avg = Math.round(r / k) << 16 | Math.round(g / k) << 8 | Math.round(b / k);
      D.tint(x, starOver, e.colors.length ? avg : 0x8a8a8a, 16, 16);
      x.drawImage(starTex, 0, 0);
    });
  }
  [creeperTex, starTex, starOver].forEach(function (im) { im.addEventListener('load', paintCanvases); });
  function iconHtml(sh) {
    if (sh.id === 'creeper') return '<canvas data-creeper width="8" height="8" aria-hidden="true"></canvas>';
    if (sh.id === 'small_ball') return '<canvas data-star width="16" height="16" aria-hidden="true"></canvas>';
    return '<img src="' + item(sh.icon) + '" alt="">';
  }

  // ---- builder ----
  function drawTabs() {
    $('fwkTabs').innerHTML = s.ex.map(function (e, i) {
      return '<button type="button" data-tab="' + i + '" aria-pressed="' + (i === s.at) + '"><canvas data-star="' + i + '" width="16" height="16" aria-hidden="true"></canvas>Explosion ' + (i + 1) + '</button>';
    }).join('') + (s.ex.length < 7 ? '<button type="button" class="fwk-add" data-tab="add"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Add</button>' : '');
    $('fwkRemove').hidden = s.ex.length < 2;
  }
  function drawShapes() {
    $('fwkShape').innerHTML = SHAPES.map(function (sh) {
      return '<button type="button" class="pt-slot pt-slot--item fwk-shape" data-shape="' + sh.id + '" aria-pressed="' + (cur().shape === sh.id) + '">' + iconHtml(sh) + '<span>' + sh.name.replace('-shaped', '') + '</span></button>';
    }).join('');
  }
  function colourGrid(id, key) {
    var list = cur()[key];
    $(id).innerHTML = D.LIST.map(function (d) {
      var on = list.indexOf(d.fw) > -1;
      return '<button type="button" class="pt-slot fwk-dye" data-dye="' + d.id + '" aria-pressed="' + on + '" title="' + d.name + '" aria-label="' + d.name + '"><img src="/minecrafticons/dyes/' + d.id + '_dye.png" alt=""><i style="background:' + D.hex(d.fw) + '"></i></button>';
    }).join('') + list.filter(function (n) { return !dyeOf(n); }).map(function (n) {
      return '<button type="button" class="pt-slot fwk-dye fwk-custom" data-custom="' + n + '" aria-pressed="true" title="Custom ' + D.hex(n) + ', click to remove" aria-label="Custom colour ' + D.hex(n) + ', remove"><span style="background:' + D.hex(n) + '"></span></button>';
    }).join('');
  }
  function drawEffects() {
    $('fwkTrail').setAttribute('aria-pressed', String(cur().trail));
    $('fwkTwinkle').setAttribute('aria-pressed', String(cur().twinkle));
  }
  function drawFlight() {
    $('fwkFlight').querySelectorAll('[data-flight]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-flight') === s.flight)); });
    $('fwkFlightNum').value = s.flight;
  }
  function drawAll() { drawTabs(); drawShapes(); colourGrid('fwkColors', 'colors'); colourGrid('fwkFade', 'fade'); drawEffects(); drawFlight(); paintCanvases(); }

  // ---- crafting grids ----
  function grid(cells, label) {
    var slots = [];
    for (var i = 0; i < 9; i++) slots.push(cells[i] || null);
    return '<div class="fwk-craft"><span class="fwk-craft-k">' + label + '</span><div class="fwk-craft-row"><div class="pt-slots fwk-grid">' + slots.map(function (c) {
      return '<span class="pt-slot fwk-cell">' + (c ? c.html : '') + '</span>';
    }).join('') + '</div><svg class="fwk-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>' + '<span class="pt-slot fwk-cell fwk-result">' + cells.result + '</span></div></div>';
  }
  function img(n, alt) { return { html: '<img src="' + item(n) + '" alt="' + alt + '">' }; }
  function drawCraft() {
    var html = '', notes = [];
    s.ex.forEach(function (e, i) {
      var sh = shape(e.shape), cells = [img('gunpowder', 'Gunpowder')];
      e.colors.forEach(function (n) { var d = dyeOf(n); cells.push(d ? { html: '<img src="/minecrafticons/dyes/' + d.id + '_dye.png" alt="' + d.name + ' dye">' } : { html: '<span class="fwk-cell-custom" style="background:' + D.hex(n) + '"></span>' }); });
      if (sh.item === 'creeper_head') cells.push({ html: '<canvas data-creeper width="8" height="8" aria-label="Creeper head"></canvas>' });
      else if (sh.item) cells.push(img(sh.item, sh.name));
      if (e.trail) cells.push(img('diamond', 'Diamond'));
      if (e.twinkle) cells.push(img('glowstone_dust', 'Glowstone dust'));
      cells.result = '<canvas data-star="' + i + '" width="16" height="16" aria-label="Firework star"></canvas>';
      html += grid(cells, 'Star ' + (s.ex.length > 1 ? i + 1 : ''));
      if (cells.length > 9) notes.push('Star ' + (i + 1) + ' needs ' + cells.length + ' items, more than a crafting grid holds. Use fewer colours.');
      if (e.colors.some(function (n) { return !dyeOf(n); })) notes.push('Custom colours (the coloured squares) only come from commands.');
      if (e.fade.length) {
        var f = [{ html: '<canvas data-star="' + i + '" width="16" height="16" aria-label="Firework star"></canvas>' }];
        e.fade.forEach(function (n) { var d = dyeOf(n); f.push(d ? { html: '<img src="/minecrafticons/dyes/' + d.id + '_dye.png" alt="' + d.name + ' dye">' } : { html: '<span class="fwk-cell-custom" style="background:' + D.hex(n) + '"></span>' }); });
        f.result = '<canvas data-star="' + i + '" width="16" height="16" aria-label="Firework star with fade"></canvas>';
        html += grid(f, 'Add the fade');
      }
    });
    var r = [img('paper', 'Paper')];
    var g = Math.min(3, Math.max(1, s.flight));
    for (var k = 0; k < g; k++) r.push(img('gunpowder', 'Gunpowder'));
    s.ex.forEach(function (e, i) { r.push({ html: '<canvas data-star="' + i + '" width="16" height="16" aria-label="Firework star"></canvas>' }); });
    r.result = '<img src="' + item('firework_rocket') + '" alt="Firework rocket"><b class="fwk-count">3</b>';
    html += grid(r, 'Rocket');
    if (s.flight < 1 || s.flight > 3) notes.push('Crafting gives flight 1 to 3 (one gunpowder each). Flight ' + s.flight + ' only comes from commands.');
    if (r.length > 9) notes.push('That many stars and gunpowder don\'t fit in one grid.');
    $('fwkCraft').innerHTML = html;
    $('fwkCraftNote').innerHTML = notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
    paintCanvases();
  }

  // ---- commands ----
  function sq(t) { return "'" + t.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
  function ints(a) { return '[I;' + a.join(',') + ']'; }
  function exNew(e) {
    var o = ['shape:"' + e.shape + '"'];
    if (e.colors.length) o.push('colors:' + ints(e.colors));
    if (e.fade.length) o.push('fade_colors:' + ints(e.fade));
    if (e.trail) o.push('has_trail:true');
    if (e.twinkle) o.push('has_twinkle:true');
    return '{' + o.join(',') + '}';
  }
  function exOld(e) {
    var o = ['Type:' + shape(e.shape).n + 'b'];
    if (e.colors.length) o.push('Colors:' + ints(e.colors));
    if (e.fade.length) o.push('FadeColors:' + ints(e.fade));
    if (e.trail) o.push('Trail:1b');
    if (e.twinkle) o.push('Flicker:1b');
    return '{' + o.join(',') + '}';
  }
  function flight() { return Math.min(s.ver === 0 ? 127 : 255, Math.max(0, s.flight)); }
  function textParts() {
    var name = $('fwkName').value.trim(), lore = $('fwkLore').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var nameObj = { text: name, italic: false };
    if (s.ncolor) nameObj.color = s.ncolor;
    return { name: name, nameJ: JSON.stringify(nameObj), lore: lore.map(function (l) { return JSON.stringify({ text: l, italic: false }); }) };
  }
  function command() {
    var t = textParts(), tgt = $('fwkTarget').value, n = Math.min(64, Math.max(1, parseInt($('fwkCount').value, 10) || 1));
    var cnt = n > 1 ? ' ' + n : '';
    var fw = s.ver === 0 ? 'Fireworks:{Flight:' + flight() + 'b,Explosions:[' + s.ex.map(exOld).join(',') + ']}'
      : 'fireworks={flight_duration:' + flight() + ',explosions:[' + s.ex.map(exNew).join(',') + ']}';
    function newText() {
      var c = [];
      if (t.name) c.push('custom_name=' + (s.ver === 2 ? t.nameJ : sq(t.nameJ)));
      if (t.lore.length) c.push('lore=[' + (s.ver === 2 ? t.lore : t.lore.map(sq)).join(',') + ']');
      return c;
    }
    function oldDisplay() {
      var d = [];
      if (t.name) d.push('Name:' + sq(t.nameJ));
      if (t.lore.length) d.push('Lore:[' + t.lore.map(sq).join(',') + ']');
      return d.length ? ',display:{' + d.join(',') + '}' : '';
    }
    if (s.out === 'rocket') {
      if (s.ver === 0) return '/give ' + tgt + ' minecraft:firework_rocket{' + fw + oldDisplay() + '}' + cnt;
      return '/give ' + tgt + ' minecraft:firework_rocket[' + [fw].concat(newText()).join(',') + ']' + cnt;
    }
    if (s.out === 'star') {
      var e = cur();
      if (s.ver === 0) return '/give ' + tgt + ' minecraft:firework_star{Explosion:' + exOld(e) + oldDisplay() + '}' + cnt;
      return '/give ' + tgt + ' minecraft:firework_star[' + ['firework_explosion=' + exNew(e)].concat(newText()).join(',') + ']' + cnt;
    }
    // summon: LifeTime decides when it bursts
    var life = s.burst === 'now' ? 0 : 10 * (flight() + 1) + 6;
    var pos = ($('fwkPos').value.trim() || '~ ~ ~');
    if (s.ver === 0) return '/summon minecraft:firework_rocket ' + pos + ' {LifeTime:' + life + ',FireworksItem:{id:"minecraft:firework_rocket",Count:1b,tag:{' + fw + '}}}';
    var comps = '"minecraft:fireworks":{flight_duration:' + flight() + ',explosions:[' + s.ex.map(exNew).join(',') + ']}';
    return '/summon minecraft:firework_rocket ' + pos + ' {LifeTime:' + life + ',FireworksItem:{id:"minecraft:firework_rocket",count:1,components:{' + comps + '}}}';
  }

  // ---- tooltip (Fireworks.addToTooltip) ----
  function tip() {
    var t = textParts(), lines = [];
    var title = t.name || (s.out === 'star' ? 'Firework Star' : 'Firework Rocket');
    function exLines(e, indent) {
      var p = indent ? '  ' : '';
      var out = [];
      out.push('<span class="fwk-tip-k">' + p + shape(e.shape).name + '</span>');
      if (e.colors.length) out.push('<span class="fwk-tip-k">' + p + '  ' + e.colors.map(colorName).join(', ') + '</span>');
      if (e.fade.length) out.push('<span class="fwk-tip-k">' + p + '  Fade to ' + e.fade.map(colorName).join(', ') + '</span>');
      if (e.trail) out.push('<span class="fwk-tip-k">' + p + '  Trail</span>');
      if (e.twinkle) out.push('<span class="fwk-tip-k">' + p + '  Twinkle</span>');
      return out;
    }
    if (s.out === 'star') lines = exLines(cur(), false);
    else {
      lines.push('<span class="fwk-tip-k">Flight Duration: ' + flight() + '</span>');
      s.ex.forEach(function (e) { lines = lines.concat(exLines(e, false)); });
    }
    lines = lines.concat(t.lore.map(function (l) { return '<span class="is-lore">' + esc(JSON.parse(l).text) + '</span>'; }));
    return '<div><b style="font-weight:400;color:#' + (COLORS[s.ncolor] || 'ffffff') + '">' + esc(title) + '</b>' + lines.join('') + '</div>';
  }

  // keepSky: text-only edits leave the rocket in the air
  function render(keepSky) {
    var out = command();
    $('fwkCmd').textContent = out;
    $('fwkCopy').setAttribute('data-copy', out);
    $('fwkMeta').innerHTML = out.length + ' characters' + (out.length > 256 ? ' <span class="mch-term-flags"><em class="is-block">Command block only</em></span>' : '');
    $('fwkTip').innerHTML = tip();
    $('fwkSummonOpts').hidden = s.out !== 'summon';
    $('fwkSend').hidden = s.out === 'summon';
    var notes = [];
    if (s.out === 'star') notes.push('The star holds explosion ' + (s.at + 1) + ', the one open on the left.');
    if (s.out === 'summon') notes.push(s.burst === 'now' ? 'LifeTime 0: the rocket bursts the moment it spawns, good for shows.' : 'The rocket flies for ' + (10 * (flight() + 1) + 6) + ' ticks, about as long as a crafted one.');
    if (s.ex.some(function (e) { return !e.colors.length; })) notes.push('An explosion with no colours still bursts, but its sparks are white.');
    notes.push('Bedrock has no firework commands. Craft the rocket with the grids below the builder.');
    $('fwkNote').innerHTML = notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
    drawCraft();
    if (keepSky !== true) queueLaunch();
  }

  // ---- the night sky ----
  var ctx = sky.getContext('2d'), parts = [], rocket = null, stars = [], last = 0, raf = 0, visible = true, nextAt = 0, W = 0, H = 0;
  // Outlines from FireworkParticles: half shapes, mirrored on x
  var STAR = [[0, 1], [0.3455, 0.309], [0.9511, 0.309], [0.3796, -0.1265], [0.6122, -0.8041], [0, -0.3592]];
  var CREEPER = [[0, 0.2], [0.2, 0.2], [0.2, 0.6], [0.6, 0.6], [0.6, 0.2], [0.2, 0.2], [0.2, 0], [0.4, 0], [0.4, -0.6], [0.2, -0.6], [0.2, -0.4], [0, -0.4]];
  function resize() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    W = sky.clientWidth; H = sky.clientHeight;
    sky.width = W * dpr; sky.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = [];
    for (var i = 0; i < 70; i++) stars.push([Math.random() * W, Math.random() * H * 0.8, Math.random() * 1.2 + 0.3, Math.random() * 6]);
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function spark(x, y, vx, vy, e, life) {
    parts.push({ x: x, y: y, vx: vx, vy: vy, c: e.colors.length ? pick(e.colors) : 0xffffff, f: e.fade.length ? pick(e.fade) : null,
      t: 0, life: life || 1.4 + Math.random() * 0.5, trail: e.trail, tw: e.twinkle, sz: 3 });
  }
  function explode(x, y) {
    var u = Math.min(W, H) / 300; // pixels per "speed" unit
    s.ex.forEach(function (e) {
      var sp, i, j, k;
      if (e.shape === 'small_ball' || e.shape === 'large_ball') {
        var big = e.shape === 'large_ball', n = big ? 4 : 2, speed = (big ? 0.5 : 0.25) * 260 * u;
        for (i = -n; i <= n; i++) for (j = -n; j <= n; j++) for (k = -n; k <= n; k++) {
          var r = Math.sqrt(i * i + j * j + k * k);
          if (!r) continue;
          sp = speed / (r + Math.random() * 0.5) * (r / n);
          spark(x, y, i / r * sp * (0.85 + Math.random() * 0.3), j / r * sp * (0.85 + Math.random() * 0.3), e);
        }
      } else if (e.shape === 'star' || e.shape === 'creeper') {
        var P = e.shape === 'star' ? STAR : CREEPER, full = P.concat(P.slice().reverse().map(function (p) { return [-p[0], p[1]]; }));
        var speed2 = 0.5 * 260 * u;
        for (i = 0; i < full.length; i++) {
          var a = full[i], b = full[(i + 1) % full.length];
          for (k = 0; k < 6; k++) {
            var tt = k / 6, px = a[0] + (b[0] - a[0]) * tt, py = a[1] + (b[1] - a[1]) * tt;
            spark(x, y, px * speed2, -py * speed2, e, 1.3 + Math.random() * 0.3);
          }
        }
      } else { // burst: a wide spray
        for (i = 0; i < 90; i++) {
          var ang = Math.random() * Math.PI * 2, mag = (40 + Math.random() * 110) * u;
          spark(x, y, Math.cos(ang) * mag, Math.sin(ang) * mag * 0.6 - 30 * u, e, 1 + Math.random() * 0.8);
        }
      }
    });
  }
  function launch() {
    var apex = H * (0.62 - Math.min(3, Math.max(0, flight())) * 0.12);
    var fl = Math.max(0, flight());
    rocket = { x: W * (0.42 + Math.random() * 0.16), y: H - 30, vy: 0, apex: Math.max(H * 0.14, apex), life: (10 * (fl + 1) + 6) / 20 * 0.55, t: 0 };
    if (s.burst === 'now' && s.out === 'summon') { explode(rocket.x, H * 0.4); rocket = null; }
  }
  var pending = 0;
  function queueLaunch() {
    clearTimeout(pending);
    pending = setTimeout(function () { parts = []; launch(); nextAt = performance.now() + 4200; kick(); }, 220);
  }
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function tick(now) {
    raf = 0;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.globalCompositeOperation = 'source-over';
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05070d'); g.addColorStop(0.7, '#0d1220'); g.addColorStop(1, '#151a27');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    stars.forEach(function (st) { ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.2 * Math.sin(now / 900 + st[3])) + ')'; ctx.fillRect(st[0], st[1], st[2], st[2]); });
    ctx.fillStyle = '#0a0b0d'; ctx.fillRect(0, H - 22, W, 22); // ground
    if (rocket) {
      rocket.t += dt;
      var k = Math.min(1, rocket.t / rocket.life);
      var y = rocket.y - (rocket.y - rocket.apex) * (1 - Math.pow(1 - k, 2));
      parts.push({ x: rocket.x + (Math.random() - 0.5) * 2, y: y + 6, vx: (Math.random() - 0.5) * 8, vy: 30, c: 0xffd9a0, f: 0x555555, t: 0, life: 0.5, sz: 2, smoke: true });
      ctx.fillStyle = '#fff2d6'; ctx.fillRect(rocket.x - 2, y - 2, 4, 6);
      if (k >= 1) { explode(rocket.x, y); rocket = null; }
    }
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.vx *= Math.pow(0.35, dt); p.vy = p.vy * Math.pow(0.35, dt) + 28 * dt; // drag + a little gravity
      p.x += p.vx * dt; p.y += p.vy * dt;
      var age = p.t / p.life, c = p.c;
      if (p.f != null && age > 0.45) { // fade colour takes over
        var m = Math.min(1, (age - 0.45) / 0.3), f = p.f;
        c = Math.round((c >> 16 & 255) * (1 - m) + (f >> 16 & 255) * m) << 16 | Math.round((c >> 8 & 255) * (1 - m) + (f >> 8 & 255) * m) << 8 | Math.round((c & 255) * (1 - m) + (f & 255) * m);
      }
      var a = Math.min(1, (1 - age) * 1.4) * (p.smoke ? 0.35 : 0.95);
      if (p.tw && age > 0.4 && Math.random() < 0.5) a *= 0.15; // twinkle flicker
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = D.hex(c);
      ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz);
      if (p.trail && !p.smoke && Math.random() < 0.35) parts.push({ x: p.x, y: p.y, vx: 0, vy: 6, c: c, f: null, t: 0, life: 0.45, sz: 2 });
    }
    ctx.globalAlpha = 1;
    if (!rocket && !parts.length && now >= nextAt && visible) { launch(); nextAt = now + 4200; }
    if (visible && (rocket || parts.length || !reduced)) raf = requestAnimationFrame(tick);
  }
  // reduced motion: one still frame of the burst at its widest
  function still() {
    parts = []; launch();
    if (rocket) { explode(rocket.x, rocket.apex); rocket = null; }
    for (var n = 0; n < 18; n++) { last -= 50; tick(last + 50); cancelAnimationFrame(raf); raf = 0; }
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible && !reduced) kick(); }).observe(sky);
  if ('ResizeObserver' in window) new ResizeObserver(function () { resize(); if (reduced) still(); }).observe(sky);
  resize();
  $('fwkReplay').addEventListener('click', function () { parts = []; if (reduced) still(); else { launch(); nextAt = performance.now() + 4200; kick(); } });

  // ---- input ----
  $('fwkTabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (!b) return;
    var v = b.getAttribute('data-tab');
    if (v === 'add') { s.ex.push(blank()); s.at = s.ex.length - 1; } else s.at = +v;
    drawAll(); render();
  });
  $('fwkRemove').addEventListener('click', function () {
    if (s.ex.length < 2) return;
    s.ex.splice(s.at, 1); s.at = Math.max(0, s.at - 1);
    drawAll(); render();
  });
  $('fwkShape').addEventListener('click', function (e) {
    var b = e.target.closest('[data-shape]');
    if (!b) return;
    cur().shape = b.getAttribute('data-shape');
    drawShapes(); paintCanvases(); render();
  });
  function colourClick(id, key) {
    $(id).addEventListener('click', function (e) {
      var list = cur()[key], b = e.target.closest('[data-dye],[data-custom]');
      if (!b) return;
      var n = b.hasAttribute('data-custom') ? +b.getAttribute('data-custom') : D.byId(b.getAttribute('data-dye')).fw;
      var at = list.indexOf(n);
      if (at > -1) list.splice(at, 1); else list.push(n);
      colourGrid(id, key); drawTabs(); paintCanvases(); render();
    });
  }
  colourClick('fwkColors', 'colors');
  colourClick('fwkFade', 'fade');
  function addCustom(input, key, grid) {
    $(input).addEventListener('change', function () {
      var n = D.parse(this.value);
      if (n != null && cur()[key].indexOf(n) < 0) cur()[key].push(n);
      colourGrid(grid, key); drawTabs(); paintCanvases(); render();
    });
  }
  addCustom('fwkCustom', 'colors', 'fwkColors');
  addCustom('fwkFadeCustom', 'fade', 'fwkFade');
  $('fwkTrail').addEventListener('click', function () { cur().trail = !cur().trail; drawEffects(); render(); });
  $('fwkTwinkle').addEventListener('click', function () { cur().twinkle = !cur().twinkle; drawEffects(); render(); });
  $('fwkFlight').addEventListener('click', function (e) {
    var b = e.target.closest('[data-flight]');
    if (!b) return;
    s.flight = +b.getAttribute('data-flight');
    drawFlight(); render();
  });
  $('fwkFlightNum').addEventListener('change', function () {
    s.flight = Math.min(255, Math.max(0, parseInt(this.value, 10) || 0));
    drawFlight(); render();
  });
  function seg(id, attr, key) {
    $(id).addEventListener('click', function (e) {
      var b = e.target.closest('[' + attr + ']');
      if (!b) return;
      var v = b.getAttribute(attr);
      s[key] = key === 'ver' ? +v : v;
      this.querySelectorAll('[' + attr + ']').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      render();
    });
  }
  seg('fwkOut', 'data-out', 'out');
  seg('fwkVer', 'data-ver', 'ver');
  seg('fwkBurst', 'data-burst', 'burst');
  $('fwkNameColor').innerHTML = '<button type="button" class="pt-sw pt-sw--none" data-ncolor="" aria-pressed="true" aria-label="White, the default">Aa</button>' +
    Object.keys(COLORS).map(function (c) { return '<button type="button" class="pt-sw" data-ncolor="' + c + '" aria-pressed="false" aria-label="' + c.replace('_', ' ') + '" title="' + c.replace('_', ' ') + '" style="background:#' + COLORS[c] + '"></button>'; }).join('');
  seg('fwkNameColor', 'data-ncolor', 'ncolor');
  ['fwkName', 'fwkLore', 'fwkCount', 'fwkTarget', 'fwkPos'].forEach(function (id) { $(id).addEventListener('input', function () { render(true); }); });

  drawAll();
  render();
  if (reduced) setTimeout(still, 300);
})();
