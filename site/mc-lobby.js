/* Minecraft lobby sections (Oct 28 2026, round 2): each section is a Minecraft screen. Styles: mc-lobby.css.
   GAME FONT  .mcf[data-mc] spans are redrawn as canvases in the game's own font (mc-font.js), words kept
              for screen readers. data-c = colour (hex), data-lines = wrap to n lines (else one line, cut "..."), data-s = pixel size (default 2).
   MAP        a real seed's Nether as a filled map item: every page from game-nav.json gets a banner on a spot from
              mc-lobby-map.json (built by _tools/lobby-map/build.mjs), Java pages on the bastions first.
   WORLDS     a ruined portal shows the picked world (the game's portal frames swirl round it) + the Select World list; search, Random.
              .wp-solo = one portal, no list (the Worlds page). Both use swirl().
   The 3D item-frame wall is mc-lobby-frames.js. */
(function () {
  var REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PHONE = matchMedia('(max-width: 970px)');
  var G = '/minecrafticons/gui/lobby/';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------------- GAME FONT ----------------
  var fontReady = false, SCALE = 2;
  function runsOf(el) {
    var t = el.getAttribute('data-mc'), c = el.getAttribute('data-c') || 'ffffff';
    if (el.hasAttribute('data-codes')) return McFont.parse(t, { color: c });
    return [{ text: t, color: c, italic: el.hasAttribute('data-i'), underlined: el.hasAttribute('data-u') }];
  }
  function cut(runs, max) {
    if (McFont.width(runs) <= max) return runs;
    var r = runs.map(function (x) { return Object.assign({}, x); }), last = r[r.length - 1];
    while (McFont.width(r.concat([{ text: '...' }])) > max && (last.text.length > 0 || r.length > 1)) {
      if (!last.text.length) { r.pop(); last = r[r.length - 1]; continue; }
      last.text = last.text.slice(0, -1);
    }
    last.text = last.text.replace(/\s+$/, '') + '...';
    return r;
  }
  function draw(el) {
    if (!fontReady || !el.isConnected) return;
    var dpr = Math.max(1, Math.round((window.devicePixelRatio || 1) * 2) / 2);
    var avail = el.parentNode.clientWidth || el.clientWidth || 300;
    if (el.hasAttribute('data-w')) avail = +el.getAttribute('data-w');
    // data-fit: as wide as the nearest .rs-chat (a chat line shrinks to its text, so it can't be measured itself)
    if (el.hasAttribute('data-fit')) avail = Math.min(avail, el.closest('.rs-chat').clientWidth - 12);
    var S = +el.getAttribute('data-s') || SCALE;
    var max = Math.floor(avail / S) - 2, runs = runsOf(el), n = +el.getAttribute('data-lines') || 1;
    var lines = n > 1 ? McFont.wrap(runs, max) : [cut(runs, max)];
    if (lines.length > n) { lines = lines.slice(0, n); lines[n - 1] = cut(lines[n - 1].concat([{ text: ' ...........................' }]), max); }
    var w = Math.max.apply(null, lines.map(function (l) { return McFont.width(l); })) + 1, h = lines.length * 9;
    var c = el.querySelector('canvas') || document.createElement('canvas'), k = S * dpr;
    c.width = Math.max(1, w * k); c.height = h * k;
    c.style.width = w * S + 'px'; c.style.height = h * S + 'px';
    var x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
    var shadow = !el.hasAttribute('data-flat');
    lines.forEach(function (l, i) { McFont.draw(x, l, 0, i * 9 * k, { scale: k, shadow: shadow }); });
    if (!c.parentNode) {
      el.textContent = '';
      c.setAttribute('aria-hidden', 'true');
      el.appendChild(document.createElement('span')).className = 'mcf-sr'; el.appendChild(c);
    }
    el.querySelector('.mcf-sr').textContent = el.getAttribute('data-mc').replace(/&[0-9a-fk-or]/g, '');
    el.classList.add('is-drawn');
  }
  function drawAll(root) { $$('.mcf[data-mc]', root).forEach(draw); }
  // The page has ~150 of these canvases: each section draws its own as it nears the screen (600px ahead), not
  // all at load. Phones fire resize when the address bar slides in or out, so only a real width change redraws,
  // and only the sections already drawn.
  var drawn = [];
  function drawNear() {
    var bands = $$('.mch-ch');
    if (!window.IntersectionObserver) { drawAll(); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (!e.isIntersecting) return; io.unobserve(e.target); drawn.push(e.target); drawAll(e.target); });
    }, { rootMargin: '600px 0px' });
    bands.forEach(function (b) { io.observe(b); });
  }
  if (window.McFont) McFont.load(function () { fontReady = true; drawNear(); });
  var rz = 0, lastW = innerWidth;
  addEventListener('resize', function () {
    if (innerWidth === lastW) return;
    lastW = innerWidth;
    clearTimeout(rz); rz = setTimeout(function () { drawn.forEach(function (b) { drawAll(b); }); }, 150);
  });
  function mcSpan(text, color, extra) {
    return '<span class="mcf" data-mc="' + esc(text) + '"' + (color ? ' data-c="' + color + '"' : '') + (extra || '') + '>' + esc(text) + '</span>';
  }

  // ---------------- MAP ----------------
  // Kept simple on purpose (Oct 28 2026, Adrian: "it looks so messy"): only page banners on the map, no structure
  // icons, player marker or X marks. Hover (or focus) = the game's tooltip with the page's icon; touch screens tap
  // a banner to pin that tooltip, with a small Go key inside it (a tap never leaves the page straight away).
  (function () {
    var marks = $('#mlMarks'), key = $('#mlMap'), tip = $('#mlTip'), face = $('#mlMapFace');
    if (!marks) return;
    var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    var TAP = matchMedia('(hover: none)');
    var pct = function (v) { return ((v + 0.5) / 128 * 100).toFixed(2) + '%'; };
    var q = function (n) { return window.CSS && CSS.escape ? CSS.escape(n) : n; };
    var pinned = null;
    function showTip(m, pin) {
      pinned = pin ? m : null;
      tip.classList.toggle('is-pinned', !!pin);
      if (!m) { tip.hidden = true; return; }
      var ico = m.getAttribute('data-ico'), link = m.getAttribute('href');
      tip.innerHTML = (ico ? '<img class="ml-tip-ico" src="' + esc(ico) + '" alt="">' : '') + '<span class="ml-tip-txt">' +
        mcSpan(m.getAttribute('data-name'), 'ffffff') + (m.getAttribute('data-sub') ? mcSpan(m.getAttribute('data-sub'), 'a8a8a8', ' data-w="380"') : '') + mcSpan(m.getAttribute('data-grp'), m.getAttribute('data-gc')) + '</span>' +
        (pin && link ? '<a class="ml-tip-go" href="' + esc(link) + '">Go' + ARROW + '</a>' : '');
      tip.hidden = false;
      drawAll(tip);
      // above the banner (its name label hangs below it), kept inside the map
      var f = face.getBoundingClientRect(), r = m.getBoundingClientRect();
      tip.style.left = '0px'; tip.style.top = '0px';
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var x = Math.max(-10, Math.min(f.width - tw + 10, r.left + r.width / 2 - f.left - tw / 2)), y = r.top - f.top - th - 4;
      if (y < -20) y = r.bottom - f.top + 30;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    }
    function hot(name, on) {
      $$('[data-name="' + q(name) + '"]', $('.ml-atlas')).forEach(function (el) { el.classList.toggle('is-hot', on); });
    }
    function unpin() { if (pinned) { hot(pinned.getAttribute('data-name'), false); showTip(null); } }
    Promise.all([(window.pcJSON || function (u) { return fetch(u).then(function (r) { return r.json(); }); })('/game-nav.json'), fetch('/mc-lobby-map.json').then(function (r) { return r.json(); })])
      .then(function (d) {
        var groups = d[0].minecraft.groups, map = d[1], html = '';
        var slots = map.slots.slice(), keyHtml = '';
        groups.forEach(function (g) {
          var pages = g.pages.filter(function (p) { return !g.link || p.link !== g.link; });
          if (!pages.length) return;
          var java = g.name === 'Resources', soon = pages.every(function (p) { return p.soon; });
          // tools fly gold banners (the red ones vanished on the red Nether map)
          var banner = soon ? G + 'decorations-red_x.png' : java ? G + 'decorations-white_banner.png' : '/images/minecraft/lobby/deco-gold_banner.png';
          var gc = java ? 'ffffff' : 'ffaa00';
          var rows = '';
          pages.forEach(function (p) {
            var attrs = ' data-name="' + esc(p.name) + '"';
            if (soon || !p.link) {
              // not on the map: listed in the key only
              rows += '<span class="mkg-row is-soon"' + attrs + '><img src="' + banner + '" alt=""><span>' + esc(p.name) + '</span></span>';
              return;
            }
            rows += '<a class="mkg-row" href="' + esc(p.link) + '"' + attrs + '><img src="' + banner + '" alt=""><span>' + esc(p.name) + '</span></a>';
            // Java pages take the bastions (listed first: the piglins' homes), the rest the next free spot
            var k = java ? Math.max(0, slots.findIndex(function (s) { return s.at === 'bastion'; })) : 0;
            var s = slots.splice(k, 1)[0];
            if (!s) return;
            attrs += ' data-sub="' + esc(p.sub || '') + '" data-grp="' + esc(g.name) + '" data-gc="' + gc + '" data-ico="' + esc(p.icon || '') + '"';
            html += '<a class="mk" href="' + esc(p.link) + '"' + attrs + ' style="left:' + pct(s.x) + ';top:' + pct(s.z) + '"><img src="' + banner + '" alt="">' +
              '<span class="mk-lab">' + mcSpan(p.name, 'ffffff', ' data-w="400"') + '</span><span class="sr-only">' + esc(p.name) + '</span></a>';
          });
          var h = '<img src="' + esc(g.img) + '" alt="">' + esc(g.name) + ' <small>' + pages.length + '</small>';
          keyHtml += '<div class="mkg">' + (g.link ? '<a class="mkg-h" href="' + esc(g.link) + '">' + h + ARROW + '</a>' : '<span class="mkg-h">' + h + '</span>') + '<div class="mkg-rows">' + rows + '</div></div>';
        });
        marks.innerHTML = html;
        key.innerHTML = keyHtml;
        drawAll(marks);
        $$('.mk, .mkg-row', $('.ml-atlas')).forEach(function (el) {
          var n = el.getAttribute('data-name'), mk = el.classList.contains('mk') ? el : null;
          function on() { if (TAP.matches) return; hot(n, true); showTip(mk || $('.mk[data-name="' + q(n) + '"]', marks)); }
          function off() { if (TAP.matches) return; hot(n, false); showTip(null); }
          el.addEventListener('mouseenter', on); el.addEventListener('mouseleave', off);
          el.addEventListener('focus', on); el.addEventListener('blur', off);
        });
        $$('.mk', marks).forEach(function (m) {
          m.addEventListener('click', function (e) {
            if (!TAP.matches) return;
            e.preventDefault();
            var again = pinned === m;
            unpin();
            if (!again) { hot(m.getAttribute('data-name'), true); showTip(m, true); }
          });
        });
        document.addEventListener('click', function (e) { if (pinned && !e.target.closest('.mk, .ml-tip')) unpin(); });
      })
      .catch(function () { $('#ch-map').hidden = true; });
  })();

  // ---------------- WORLDS ----------------
  // A ruined portal shows the picked world (the game's own portal frames swirl round it), its plate below; the
  // Select World list beside it. Picking another world warps: the picture drops out, the swirl fills the frame.
  (function () {
    var box = $('#mlWorlds');
    if (!box) return;
    var rows = $$('.sw-row', box), input = $('.mcs-search input', box), none = $('.sw-none', box);
    var gate = $('.wp-gate', box), portal = $('.wp-portal', box), play = $('.wp-play', box), bg = $('.wp-bg', box), img = $('.wp-img', box);
    var desc = $('.wp-desc', box), facts = $('.wp-facts', box), warpT = 0;
    function say(sel, text) { var el = $(sel, box); el.setAttribute('data-mc', text); if (!el.classList.contains('is-drawn')) el.textContent = text; draw(el); }
    function open(r) {
      if (r.getAttribute('data-ext') === '1') window.open(r.getAttribute('data-href'), '_blank', 'noopener');
      else location.href = r.getAttribute('data-href');
    }
    function show(src, warp) {
      if (img.getAttribute('src') === src) return;
      if (!warp || REDUCE) { bg.src = img.src = src; return; }
      gate.classList.add('is-warp');
      clearTimeout(warpT);
      warpT = setTimeout(function () {
        bg.src = img.src = src;
        var done = function () { if (img.getAttribute('src') === src) gate.classList.remove('is-warp'); };
        if (img.decode) img.decode().then(done, done); else done();
        setTimeout(done, 1500); // a slow picture never leaves the portal blank
      }, 280);
    }
    // real facts only (mc-worlds.json: tag, the creator's stated version / players, author); a blank one is left out
    function factsOf(r) {
      var g = function (k) { return r.getAttribute('data-' + k); }, f = [];
      if (g('tag')) f.push([g('tagi'), esc(g('tag'))]);
      if (g('ver')) f.push(['/minecrafticons/items/clock.png', 'Java <b>' + esc(g('ver')) + '</b>']);
      if (g('players')) f.push(['/minecrafticons/items/player_head.png', '<b>' + esc(g('players')) + '</b> players']);
      if (g('by')) f.push(['/minecrafticons/items/name_tag.png', 'by <b>' + esc(g('by')) + '</b>']);
      return f.map(function (x) { return '<li><img src="' + esc(x[0]) + '" alt="">' + x[1] + '</li>'; }).join('');
    }
    function pick(r, focus, warp) {
      rows.forEach(function (x) { var on = x === r; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; });
      show(r.getAttribute('data-img'), warp);
      say('.wp-rank', '#' + (rows.indexOf(r) + 1));
      say('.wp-name', $('.sw-name', r).getAttribute('data-mc').replace(/^\d+\.\s*/, ''));
      desc.textContent = r.getAttribute('data-desc');
      facts.innerHTML = factsOf(r);
      [play, portal].forEach(function (a) {
        a.href = r.getAttribute('data-href');
        if (r.getAttribute('data-ext') === '1') { a.target = '_blank'; a.rel = 'noopener'; } else { a.removeAttribute('target'); a.removeAttribute('rel'); }
      });
      if (focus) r.focus();
    }
    rows.forEach(function (r) {
      // a second click on the picked row's picture plays it (the game's join key); not on phones, where the row is a hotbar slot
      r.addEventListener('click', function (e) { if (e.target.closest('.sw-ico') && r.classList.contains('is-on') && !PHONE.matches) return open(r); if (!r.classList.contains('is-on')) pick(r, false, true); });
      r.addEventListener('dblclick', function () { open(r); });
      r.addEventListener('keydown', function (e) {
        var vis = rows.filter(function (x) { return !x.hidden; }), i = vis.indexOf(r);
        if (e.key === 'Enter') { e.preventDefault(); open(r); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var n = vis[i + (e.key === 'ArrowDown' ? 1 : -1)]; if (n) pick(n, true, true); }
      });
    });
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase(), first = null;
      rows.forEach(function (r) {
        var hit = !q || (r.textContent + ' ' + r.getAttribute('data-desc')).toLowerCase().indexOf(q) > -1;
        r.hidden = !hit; if (hit && !first) first = r;
      });
      none.hidden = !!first;
      var cur = $('.sw-row.is-on', box);
      if (first && (!cur || cur.hidden)) pick(first, false, true);
      drawAll(box);
    });
    $('.sw-random', box).addEventListener('click', function () {
      var vis = rows.filter(function (x) { return !x.hidden && !x.classList.contains('is-on'); });
      if (vis.length) pick(vis[Math.floor(Math.random() * vis.length)], false, true);
    });
    if (PHONE.matches) $('.wp-name', box).setAttribute('data-s', '2'); // the long names fit a phone's plate
    pick(rows[0]);
    swirl(box, gate);
  })();
  // a portal showing one world, no list (the Worlds page's featured world)
  $$('.wp-solo').forEach(function (box) { swirl(box, $('.wp-gate', box)); });

  // the swirl: nether_portal's 32 frames (16 px each, stacked), one tile = one block (--B), drawn only while on
  // screen; reduced motion keeps the first frame
  function swirl(box, gate) {
    var cv = $('.wp-swirl', box), ctx = cv.getContext('2d'), pats = [], fi = 0, tick = 0, live = false;
    function size() {
      var B = parseFloat(getComputedStyle(box).getPropertyValue('--B')) || 40;
      cv.width = Math.max(16, Math.round(cv.clientWidth / B * 16));
      cv.height = Math.max(16, Math.round(cv.clientHeight / B * 16));
    }
    function paint() { if (!pats.length) return; ctx.fillStyle = pats[fi]; ctx.fillRect(0, 0, cv.width, cv.height); }
    function loop() { tick = setTimeout(function () { tick = 0; if (!live) return; fi = (fi + 1) % pats.length; paint(); loop(); }, 70); }
    function load() {
      var strip = new Image();
      strip.onload = function () {
        for (var i = 0; i < strip.height / 16; i++) {
          var t = document.createElement('canvas'); t.width = t.height = 16;
          t.getContext('2d').drawImage(strip, 0, i * 16, 16, 16, 0, 0, 16, 16);
          pats.push(ctx.createPattern(t, 'repeat'));
        }
        size(); paint();
        if (live && !REDUCE) loop();
      };
      strip.src = '/minecrafticons/blocks/nether_portal_strip.png';
    }
    if (!window.IntersectionObserver) { load(); return; }
    new IntersectionObserver(function (es) {
      live = es[es.length - 1].isIntersecting; // a fast scroll can batch "out" + "in": the last one is current
      if (live && !pats.length && !cv.dataset.loading) { cv.dataset.loading = '1'; load(); }
      else if (live && !tick && !REDUCE && pats.length) loop();
    }, { rootMargin: '200px 0px' }).observe(gate);
    // the gate's height follows the list's (which grows once the game font draws), so watch the canvas itself
    if (window.ResizeObserver) new ResizeObserver(function () { if (pats.length) { size(); paint(); } }).observe(cv);
  }
})();
