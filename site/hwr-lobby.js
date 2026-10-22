/* ============================================================
   WEB RESOURCES LOBBY -- the hero's Roll console and everything below it
   (Oct 22 2026). Styles: hwr-lobby.css. Data: hwr-categories.json
   ("categories") + hwr-websites.json, through hwr-js.js's shared promises
   (fetched here only if hwr-js.js didn't run). Sections:
     WIRE   one row of 24 random sites in a channel (#wireB)
     SHELF  the category cards (#categoriesGrid)
     ROLL   one random site (#wrRoll, in the hero)
   Every outbound click from here is recorded in Recently Visited.
   ============================================================ */
(function () {
  'use strict';

  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // category page -> hwr-websites.json "cat" slug (HWR_PAGE_CAT_MAP in hwr-js.js)
  var CAT_FALLBACK = {
    '/web-resources/ai-tools': 'ai', '/web-resources/anime': 'anime', '/web-resources/asian-drama': 'asiandrama',
    '/web-resources/games': 'gaming', '/web-resources/manga': 'manga', '/web-resources/movies': 'movies',
    '/web-resources/music': 'music', '/web-resources/parcode': 'parcode', '/web-resources/torrents': 'torrenting',
    '/web-resources/web-games': 'webgaming', '/web-resources/fun': 'fun'
  };
  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9"/></svg>';

  var catName = {}; // slug -> "AI Tools"
  var bySite = {};  // link -> site, for recording visits

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function host(link) {
    try { return new URL(link, location.href).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function ico(site, cls) {
    return '<span class="' + (cls || 'wr-ico') + '" data-fallback="' + esc(site.name) + '"><img src="' + esc(site.icon) +
      '" alt="" loading="lazy" decoding="async" draggable="false"></span>';
  }
  function watchIcons(root, sel, cls) {
    if (window.HwrIcons) window.HwrIcons.watchAll(root, sel, cls || 'is-letter', 'parent', 'data-fallback');
  }
  function outAttrs(site) {
    bySite[site.link] = site;
    return ' href="' + esc(site.link) + '" target="_blank" rel="noopener noreferrer" data-wr-site';
  }

  // Opening a site from the lobby lands it in Your Library's Recently Visited.
  function visit(e) {
    var a = e.target.closest && e.target.closest('a[data-wr-site]');
    if (!a || e.type === 'auxclick' && e.button !== 1) return;
    var site = bySite[a.getAttribute('href')];
    if (site && window.HwrBookmarks) {
      window.HwrBookmarks.recordVisit(site);
      if (typeof window.renderLibrary === 'function') window.renderLibrary();
    }
  }
  document.addEventListener('click', visit);
  document.addEventListener('auxclick', visit);

  /* ==========================================================
     WIRE
     Each row's track holds its list twice; x wraps at one copy's width,
     so the loop never shows a seam. One rAF loop runs the rows, only
     while the band is on screen. Speed = base x hover ease: hovering a
     row eases it to a stop. Page scroll doesn't touch it (Adrian, Oct 22
     2026: it used to speed up with scroll). Rows can be dragged; a drag
     captures the pointer only after 6px, so a plain click still opens the
     link.
     ========================================================== */
  var rails = [], lastT = 0, rafId = 0, onScreen = false;

  function Rail(row, speed, dir) {
    var r = { row: row, view: row.querySelector('.wire-view'), track: row.querySelector('.wire-track'),
              speed: speed, dir: dir, x: 0, set: 1, ease: 1, hover: false, drag: null, fling: 0, block: false };
    var v = r.view;

    v.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') r.hover = true; });
    v.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') r.hover = false; });
    // keyboard: stop the row and bring the focused card into view
    v.addEventListener('focusin', function (e) {
      r.hover = true;
      var card = e.target.closest('.wire-track > *');
      if (card) r.x = card.offsetLeft - 48;
    });
    v.addEventListener('focusout', function () { r.hover = false; });

    v.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      r.drag = { x0: e.clientX, xs: r.x, id: e.pointerId, moved: false, lx: e.clientX, lt: e.timeStamp, vel: 0 };
      r.fling = 0;
    });
    v.addEventListener('pointermove', function (e) {
      var d = r.drag;
      if (!d || e.pointerId !== d.id) return;
      var dx = e.clientX - d.x0;
      if (!d.moved && Math.abs(dx) > 6) {
        d.moved = true;
        try { v.setPointerCapture(e.pointerId); } catch (err) {}
        row.classList.add('is-dragging');
      }
      if (!d.moved) return;
      r.x = d.xs - dx;
      var dt = e.timeStamp - d.lt;
      if (dt > 0) d.vel = -(e.clientX - d.lx) / dt * 1000;
      d.lx = e.clientX;
      d.lt = e.timeStamp;
    });
    function end() {
      var d = r.drag;
      if (!d) return;
      r.drag = null;
      row.classList.remove('is-dragging');
      if (d.moved) {
        r.fling = Math.max(-4000, Math.min(4000, d.vel));
        r.block = true; // swallow the click that follows a drag
        setTimeout(function () { r.block = false; }, 0);
      }
    }
    v.addEventListener('pointerup', end);
    v.addEventListener('pointercancel', end);
    v.addEventListener('click', function (e) { if (r.block) { e.preventDefault(); e.stopPropagation(); } }, true);
    v.addEventListener('dragstart', function (e) { e.preventDefault(); });
    return r;
  }

  function measure(r) { r.set = r.track.scrollWidth / 2 || 1; }

  function frame(t) {
    var dt = Math.min(0.05, (t - (lastT || t)) / 1000);
    lastT = t;
    rails.forEach(function (r) {
      r.ease += ((r.hover || r.drag ? 0 : 1) - r.ease) * Math.min(1, dt * 5);
      if (!r.drag) {
        r.x += r.fling * dt;
        r.fling *= Math.pow(0.04, dt);
        if (!REDUCED) r.x += r.dir * r.speed * r.ease * dt;
      }
      r.x = ((r.x % r.set) + r.set) % r.set;
      r.track.style.transform = 'translate3d(' + (-r.x).toFixed(2) + 'px,0,0)';
    });
    rafId = requestAnimationFrame(frame);
  }
  function play() {
    if (rafId || !onScreen || document.hidden || !rails.length) return;
    lastT = 0;
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : play(); });

  function wireChip(s) {
    return '<a class="wire-chip"' + outAttrs(s) + ' draggable="false" title="' + esc(s.name) + '">' + ico(s) + esc(host(s.link)) + '</a>';
  }
  // Two copies; the second is decoration, hidden from screen readers and Tab.
  function fill(r, html) {
    r.track.innerHTML = html + html;
    var kids = r.track.children, half = kids.length / 2;
    for (var i = half; i < kids.length; i++) { kids[i].setAttribute('aria-hidden', 'true'); kids[i].tabIndex = -1; }
    watchIcons(r.track, '.wr-ico img');
    measure(r);
  }

  // 24 random sites, one per domain, new every visit
  function buildWire(sites) {
    var band = document.getElementById('wire'), row = document.getElementById('wireB');
    if (!band || !row) return;
    var seen = {}, pick = [];
    shuffle(sites).some(function (s) {
      var h = host(s.link);
      if (!h || seen[h]) return false;
      seen[h] = 1;
      pick.push(s);
      return pick.length === 24;
    });
    if (!pick.length) { band.hidden = true; return; }
    var r = Rail(row, 28, 1);
    fill(r, pick.map(wireChip).join(''));
    rails.push(r);

    window.addEventListener('resize', function () { rails.forEach(measure); });
    // fonts swapping in after the first measure change the track width
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { rails.forEach(measure); });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        onScreen = en[0].isIntersecting;
        onScreen ? play() : stop();
      }).observe(band);
    } else {
      onScreen = true;
      play();
    }
  }

  /* ==========================================================
     SHELF -- one card per category, in hwr-categories.json order. The
     category with the most sites spans two columns (.wc--wide).
     ========================================================== */
  function buildShelves(cats, sites, map) {
    var grid = document.getElementById('categoriesGrid');
    if (!grid) return;
    var by = {};
    sites.forEach(function (s) { (by[s.cat] = by[s.cat] || []).push(s); });
    var total = sites.length;
    var max = Math.max.apply(null, cats.map(function (c) { return (by[map[c.link]] || []).length; }));

    grid.innerHTML = cats.map(function (c, i) {
      var list = by[map[c.link]] || [], n = list.length, wide = n === max && n > 0;
      var faces = list.filter(function (s) { return s.icon; }).slice(0, wide ? 8 : 5);
      var pos = /object-position:\s*([^;]+)/.exec(c.bgStyle || '');
      var share = total ? (n / total * 100).toFixed(1) : 0;
      return '<a class="wc' + (wide ? ' wc--wide' : '') + '" href="' + esc(c.link) + '" style="--share:' + share + '%">' +
        '<span class="wc-art" aria-hidden="true"><img src="' + esc(c.bg) + '" alt="" loading="lazy" decoding="async"' +
          (pos ? ' style="object-position:' + esc(pos[1]) + '"' : '') + '></span>' +
        '<span class="wc-body">' +
          '<span class="wc-top"><span class="wc-num">' + (i < 9 ? '0' : '') + (i + 1) + '</span>' +
            (n ? '<span class="wc-n"><b>' + n + '</b> sites</span>' : '') + '</span>' +
          '<span class="wc-name">' + esc(c.name) + '</span>' +
          '<span class="wc-faces" aria-hidden="true">' + faces.map(function (s) { return ico(s); }).join('') +
            (n > faces.length ? '<span class="wc-more">+' + (n - faces.length) + '</span>' : '') + '</span>' +
        '</span>' +
        '<span class="wc-meter" aria-hidden="true"><i></i></span>' +
        '<span class="wc-go" aria-hidden="true">' + ARROW + '</span>' +
      '</a>';
    }).join('');
    watchIcons(grid, '.wr-ico img');

    var sub = document.getElementById('wrCatsSub');
    if (sub && total) sub.textContent = total + ' sites on ' + cats.length + ' shelves. Open one, or search them all.';
  }

  /* ==========================================================
     ROLL -- a random site, from everything or one category. The reel is
     a column of random favicons that spins and lands on the pick.
     ========================================================== */
  function buildRoll(cats, sites, map) {
    var box = document.getElementById('wrRoll');
    if (!box || !sites.length) return;
    var menu = box.querySelector('.roll-menu'), pickBtn = box.querySelector('.roll-pick'), strip = box.querySelector('.roll-strip'),
        nameEl = box.querySelector('.roll-name'), catEl = box.querySelector('.roll-cat'),
        urlEl = box.querySelector('.roll-url'), subEl = box.querySelector('.roll-sub'),
        openEl = box.querySelector('.roll-open'), saveEl = box.querySelector('.roll-save'),
        goEl = box.querySelector('.roll-go');
    var pick = 'all', current = null, busy = false;

    // "From" menu: any category, or one of them (with its site count)
    var counts = {};
    sites.forEach(function (s) { counts[s.cat] = (counts[s.cat] || 0) + 1; });
    menu.innerHTML = '<button type="button" data-cat="all" aria-pressed="true">Any category<small>' + sites.length + '</small></button>' +
      cats.map(function (c) {
        var slug = map[c.link];
        return slug && counts[slug] ? '<button type="button" data-cat="' + esc(slug) + '" aria-pressed="false">' + esc(c.name) + '<small>' + counts[slug] + '</small></button>' : '';
      }).join('');
    function openMenu(open) {
      menu.hidden = !open;
      pickBtn.setAttribute('aria-expanded', String(open));
      if (open) (menu.querySelector('[aria-pressed="true"]') || menu.firstChild).focus();
    }
    pickBtn.addEventListener('click', function () { openMenu(menu.hidden); });
    menu.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      pick = b.getAttribute('data-cat');
      menu.querySelectorAll('button').forEach(function (c) { c.setAttribute('aria-pressed', String(c === b)); });
      pickBtn.querySelector('b').textContent = pick === 'all' ? 'any category' : catName[pick];
      openMenu(false);
      pickBtn.focus();
      roll();
    });
    document.addEventListener('click', function (e) {
      if (!menu.hidden && !e.target.closest('.roll-pickwrap')) openMenu(false);
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { openMenu(false); pickBtn.focus(); }
    });

    function cell(s) {
      return '<span class="roll-cell" data-fallback="' + esc(s.name) + '"><img src="' + esc(s.icon) + '" alt="" decoding="async" draggable="false"></span>';
    }
    function show(s) {
      current = s;
      catEl.textContent = catName[s.cat] || '';
      nameEl.textContent = s.name;
      urlEl.textContent = host(s.link);
      subEl.textContent = s.sub || '';
      [nameEl, openEl].forEach(function (a) {
        a.href = s.link;
        bySite[s.link] = s;
      });
      var saved = !!(window.HwrBookmarks && window.HwrBookmarks.isBookmarked(s.link));
      saveEl.setAttribute('aria-pressed', String(saved));
      saveEl.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save this site');
    }
    function roll(first) {
      if (busy) return;
      var list = pick === 'all' ? sites : sites.filter(function (s) { return s.cat === pick; });
      if (!list.length) return;
      var s = list[Math.floor(Math.random() * list.length)];
      if (list.length > 1 && current && s.link === current.link) s = list[(list.indexOf(s) + 1) % list.length];

      if (first || REDUCED) {
        strip.style.transition = 'none';
        strip.style.transform = '';
        strip.innerHTML = cell(s);
        watchIcons(strip, '.roll-cell img');
        show(s);
        return;
      }
      busy = true;
      box.classList.add('is-spinning');
      var blur = shuffle(sites).slice(0, 14);
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0)';
      strip.innerHTML = (current ? cell(current) : '') + blur.map(cell).join('') + cell(s);
      watchIcons(strip, '.roll-cell img');
      var h = strip.firstChild.offsetHeight, steps = strip.children.length - 1;
      requestAnimationFrame(function () {
        strip.style.transition = 'transform 1.1s cubic-bezier(0.15, 0.85, 0.3, 1.04)';
        strip.style.transform = 'translateY(' + (-steps * h) + 'px)';
      });
      setTimeout(function () {
        show(s);
        box.classList.remove('is-spinning');
        busy = false;
      }, 1050);
    }

    goEl.addEventListener('click', function () { roll(); });
    saveEl.addEventListener('click', function () {
      if (!current || !window.HwrBookmarks) return;
      window.HwrBookmarks.toggleBookmark(current);
      show(current);
      if (typeof window.renderLibrary === 'function') window.renderLibrary();
    });
    roll(true);
  }

  /* ==========================================================
     BOOT -- hwr-js.js is deferred like this file and runs first, so its
     shared promises exist by now; the fetches are the fallback.
     ========================================================== */
  function boot() {
    var catsP = window.HwrCategoriesPromise || fetch('/hwr-categories.json').then(function (r) { return r.json(); });
    var sitesP = window.HwrWebsitesPromise || fetch('/hwr-websites.json').then(function (r) { return r.json(); });
    Promise.all([catsP, sitesP.catch(function () { return []; })]).then(function (res) {
      var data = res[0] || {}, sites = Array.isArray(res[1]) ? res[1] : [];
      var cats = data.categories || [], map = window.HWR_PAGE_CAT_MAP || CAT_FALLBACK;
      cats.forEach(function (c) { if (map[c.link]) catName[map[c.link]] = c.name; });
      buildShelves(cats, sites, map);
      buildWire(sites);
      buildRoll(cats, sites, map);
      var whCats = document.getElementById('whCats');
      if (whCats && cats.length) {
        whCats.querySelector('b').textContent = cats.length;
        whCats.hidden = false;
      }
    }).catch(function (err) { console.error('hwr-lobby.js: data failed to load', err); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
