/* =======================================================================
   TOWN HALL LAYOUTS PAGES (thNN-layouts.html) -- shared script.
   Every TH layouts page loads this (defer, at the end of <body>) with
   th-layouts.css. The page itself only holds its markup; its bases come
   from thNN-layouts.json (see "Layout cards" below).

   In order: page chrome (scrollbar width, phone scroll lock), the hero
   ("Did you know?", event cards), the Town Hall strip's scroll line, the
   secondary top bar, then the layout cards and what hangs off them
   (likes, recommended-CC popups, share).
   Moved out of th18-layouts.html's inline <script>s, Sep 2026.
   ======================================================================= */

// Stop the fixed top bars exactly at .coc-main's scrollbar: measure its real
// width (0 on phones, whose scrollbars float over the page) and hand it to
// the CSS as --scrollbar-w. Re-measured on resize.
(function () {
  // Desktop: .coc-main scrolls and its scrollbar runs the full height, with
  // both bars stopping at its edge (same as homewebresources / coc-home).
  // Phones: the page itself scrolls, .coc-main has no scrollbar, so this is
  // 0 and the bars simply stop at the window's own scrollbar.
  function setScrollbarWidth() {
    var main = document.querySelector('.coc-main');
    if (!main) return;
    document.documentElement.style.setProperty('--scrollbar-w', main.offsetWidth - main.clientWidth + 'px');
  }
  document.addEventListener('DOMContentLoaded', function () {
    setScrollbarWidth();
    // the scrollbar can appear or change after load (content, fonts, zoom)
    var main = document.querySelector('.coc-main');
    if (main && window.ResizeObserver) new ResizeObserver(setScrollbarWidth).observe(main);
  });
  window.addEventListener('load', setScrollbarWidth);
  window.addEventListener('resize', setScrollbarWidth);
})();

// Phones scroll the page itself (see "Phones scroll the whole page" in the
// CSS). While the sidebar, the More sheet or the search overlay is open the
// page must not scroll behind it: body.overflow:hidden alone doesn't stop
// that on iOS, so pin body in place (position:fixed at the current offset)
// and put the scroll position back when it closes. Same technique as
// hwr-js.js's stbLockScroll. Watches the classes those features already set.
(function () {
  var mq = window.matchMedia('(max-width: 970px)');
  var lockedY = null;
  var lastY = 0; // last real scroll position, in case a lock's CSS already reset it
  window.addEventListener(
    'scroll',
    function () {
      if (lockedY === null) lastY = window.pageYOffset;
    },
    { passive: true },
  );
  function wantLock() {
    return (
      document.body.classList.contains('sidebar-open') ||
      document.body.classList.contains('search-modal-open') ||
      document.documentElement.classList.contains('no-scroll')
    );
  }
  function sync() {
    var want = mq.matches && wantLock();
    var b = document.body.style;
    if (want && lockedY === null) {
      // lastY first: it's from before the lock's own CSS could shift the page
      lockedY = lastY || window.pageYOffset || document.documentElement.scrollTop || 0;
      b.position = 'fixed';
      b.top = -lockedY + 'px';
      b.left = '0';
      b.right = '0';
      b.width = '100%';
      b.height = 'auto';
    } else if (!want && lockedY !== null) {
      var y = lockedY;
      lockedY = null;
      b.position = '';
      b.top = '';
      b.left = '';
      b.right = '';
      b.width = '';
      b.height = '';
      window.scrollTo({ top: y, behavior: 'instant' });
    }
  }
  document.addEventListener('DOMContentLoaded', function () {
    var mo = new MutationObserver(sync);
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    // Tapping the secondary bar scrolls to the top (11layout.js scrolls
    // .coc-main, which no longer moves on phones -- scroll the page too).
    var bar = document.querySelector('.secondary-top-bar');
    if (bar)
      bar.addEventListener('click', function () {
        if (mq.matches) window.scrollTo({ top: 0, behavior: 'smooth' });
      });
  });
})();

(function () {
  var box = document.getElementById('t18-dyk');
  if (!box || !window.fetch) return;
  var stage = box.querySelector('.t18-dyk-stage');
  fetch('coc-dyk.json')
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      var facts = (data.facts || [])
        .map(function (f) {
          return f.text;
        })
        .filter(Boolean);
      if (!facts.length) return;
      // Fisher-Yates shuffle: a different first fact on every visit.
      for (var i = facts.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)),
          t = facts[i];
        facts[i] = facts[j];
        facts[j] = t;
      }
      // Every fact sits in the same grid cell, so the box is always
      // as tall as the longest one -- the page below never jumps
      // when a short fact follows a long one. Only one is visible.
      var els = facts.map(function (text) {
        var p = document.createElement('p');
        p.className = 't18-dyk-fact';
        p.textContent = text;
        p.setAttribute('aria-hidden', 'true');
        stage.appendChild(p);
        return p;
      });
      var at = 0,
        timer = null,
        paused = false;
      function show(n) {
        els[at].classList.remove('is-on');
        els[at].setAttribute('aria-hidden', 'true');
        at = n;
        els[at].classList.add('is-on');
        els[at].removeAttribute('aria-hidden');
      }
      // Longer facts stay up longer: 3.5s plus ~45ms per character,
      // never under 6s, so there's time to read the whole thing.
      function schedule() {
        clearTimeout(timer);
        if (paused || els.length < 2) return;
        var ms = Math.max(6000, 3500 + els[at].textContent.length * 45);
        timer = setTimeout(function () {
          stage.removeAttribute('aria-live'); // timed changes stay silent
          show((at + 1) % els.length);
          schedule();
        }, ms);
      }
      // It holds still while someone is reading it: pointer over it
      // or keyboard focus on it (WCAG 2.2.2 -- moving content must be
      // pausable). Touch screens rotate on the same timer; with no
      // hover to pause, a tap skips to the next fact and restarts
      // the clock so it gets its full reading time. Focus only
      // pauses on non-touch screens -- a tap focuses the box too,
      // which would otherwise freeze it after the first tap.
      // Click / tap / Enter / Space all advance, and a fact the
      // visitor asked for is announced to screen readers.
      var touch = !!(window.matchMedia && matchMedia('(hover: none)').matches);
      function hold() {
        paused = true;
        clearTimeout(timer);
      }
      function release() {
        paused = false;
        schedule();
      }
      function next() {
        if (els.length < 2) return;
        stage.setAttribute('aria-live', 'polite');
        show((at + 1) % els.length);
        schedule();
      }
      if (!touch) {
        box.addEventListener('mouseenter', hold);
        box.addEventListener('mouseleave', release);
        box.addEventListener('focusin', hold);
        box.addEventListener('focusout', release);
      }
      box.addEventListener('click', next);
      box.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          next();
        }
      });
      box.title = touch ? 'Tap for another fact' : 'Click for another fact';
      show(0);
      box.hidden = false;
      schedule();
    })
    .catch(function (err) {
      console.error('Did you know: failed to load coc-dyk.json', err);
    });
})();

// Desktop (1351px+): 2 cards per row, and only as many rows as fit
// beside the text column -- at least 2, at most 3 -- the rest hidden
// (.is-over). 971-1350px: under the text, 2 x 2. Phones: one card at a
// time, Raid Weekend first, stepped with the prev / next buttons.
(function () {
  var list = document.querySelector('.t18-events');
  if (!list) return;
  var items = [].slice.call(list.querySelectorAll('li:not(.t18-ev-navli)'));
  var copy = document.querySelector('.t18-hero-copy');
  var phone = window.matchMedia('(max-width:970px)');
  var wide = window.matchMedia('(min-width:1351px)');
  var at = 0;
  function show() {
    items.forEach(function (li, i) {
      li.classList.toggle('is-current', i === at);
    });
  }
  var lastKey = '';
  function fitRows() {
    var rows = 2;
    if (wide.matches && copy) {
      var textH = copy.getBoundingClientRect().height;
      var cardH = items[0].getBoundingClientRect().height || 52;
      rows = Math.max(2, Math.min(3, Math.floor((textH + 8) / (cardH + 8))));
    }
    var key = (phone.matches ? 'p' : 'd') + rows;
    if (key === lastKey) return; // only touch the DOM when the answer changes
    lastKey = key;
    items.forEach(function (li, i) {
      li.classList.toggle('is-over', !phone.matches && i >= rows * 2);
    });
  }
  list.addEventListener('click', function (e) {
    var btn = e.target.closest('.t18-ev-nav');
    if (!btn) return;
    at = (at + +btn.getAttribute('data-step') + items.length) % items.length;
    show();
  });
  show();
  fitRows();
  window.addEventListener('resize', fitRows);
  if (window.ResizeObserver && copy) new ResizeObserver(fitRows).observe(copy);
})();

(function () {
  var box = document.getElementById('second-layer-container');
  var rail = document.getElementById('th-rail');
  if (!box || !rail) return;
  var thumb = rail.firstElementChild;
  function update() {
    var total = box.scrollWidth,
      view = box.clientWidth;
    if (!total || !view) return;
    var frac = Math.min(1, view / total);
    rail.classList.toggle('is-static', frac >= 1); // nothing to scroll: plain line
    var max = total - view;
    var pos = max > 0 ? box.scrollLeft / max : 0;
    // Short fixed-width thumb (48px) travelling the full line.
    var railW = rail.clientWidth,
      tw = Math.min(48, railW);
    thumb.style.width = tw + 'px';
    thumb.style.transform = 'translateX(' + pos * (railW - tw) + 'px)';
  }
  // Hide the thumb for good once the strip has been scrolled: wait until
  // the scroll settles (700ms of quiet) so it doesn't vanish mid-swipe.
  var KEY = 'parchrome-th-rail-seen',
    idle = null;
  function seen() {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch (e) {
      return false;
    }
  }
  if (seen()) rail.classList.add('is-done');
  box.addEventListener(
    'scroll',
    function () {
      if (rail.classList.contains('is-done')) return;
      clearTimeout(idle);
      idle = setTimeout(function () {
        rail.classList.add('is-done');
        try {
          localStorage.setItem(KEY, '1');
        } catch (e) {}
      }, 700);
    },
    { passive: true },
  );
  box.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  window.addEventListener('load', update);
  document.addEventListener('parchome:coc-nav-ready', function () {
    requestAnimationFrame(update);
  });
  if (window.ResizeObserver) new ResizeObserver(update).observe(document.getElementById('second-layer'));
  update();
})();

// Secondary top bar (desktop): dsn-chip Town Hall row + stb-hub-link row,
// both built from coc-nav-data.json. No dropdown any more -- each TH chip
// links straight to that TH's layouts page (layoutHref). Reuses the same
// arrow/scroll wiring hwr's strips use (window.updateDsnScrollArrows /
// window.updateStbHubNavArrows, both exposed by 11layout.js). Identical
// to coc-home.html's copy of this script.
(function initCocSecondaryTopBar() {
  var dsnScroll = document.getElementById('dsnCategoriesScroll');
  var hubScroll = document.getElementById('stbHubNavScroll');
  if (!dsnScroll && !hubScroll) return;

  function normalize(url) {
    return (url || '').toString().split('/').pop().split('?')[0].split('#')[0];
  }
  var currentPage = normalize(window.location.pathname);

  // stb-hub-link: Home / Layouts / Armies / Guides, from primaryNav.
  // Active when that item's own href matches the current page --
  // on a layouts page that's Layouts. Icon set v2: the old ones
  // (raster images, then a first inline-SVG pass) didn't read as a
  // matched set and the old "Armies" glyph was literally half of
  // Lucide's crossed-swords icon (one blade + hilt, no mirror), which
  // is why it read as a stray slash instead of swords -- completed
  // into the real two-sword icon here. Same set as #bottomNav below.
  var HUB_ICONS = {
    home: {
      outline:
        '<path d="M3 11h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 11V5h11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 21v-3.5a2 2 0 0 1 4 0V21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 11V8.5M21 11V8.5M6.5 5V3M10.2 5V3M13.8 5V3M17.5 5V3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      fill: '<path d="M3 11h18v9a1 1 0 0 1-1 1h-6v-3.5a2 2 0 0 0-4 0V21H4a1 1 0 0 1-1-1z" fill="currentColor" stroke="none"/><path d="M6.5 5h11v6h-11z" fill="currentColor" opacity="0.55" stroke="none"/><path d="M3 11V8.5M21 11V8.5M6.5 5V3M10.2 5V3M13.8 5V3M17.5 5V3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    },
    // Icon set v5 (two-tone): Home = a castle (your Clash home base),
    // Layouts = a folded map, Armies = crossed swords, Guides = a light bulb
    // (tips), all at a 1.8 line weight. Active = filled in two tones: the
    // main part solid white, a secondary part at 55% (reads as light grey) --
    // the castle's keep, the map's outer panels, the back sword, the bulb's
    // glass. Grey pieces sit in <g opacity> so overlapping bits don't
    // double up. Pieces meant to be fill-only carry stroke="none" because
    // the nav CSS strokes the whole <svg>. Same paths as #bottomNav below;
    // change both together.
    layouts: {
      outline:
        '<path d="M3 6.5L9 3.5l6 3 6-3v14l-6 3-6-3-6 3z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 3.5v14M15 6.5v14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      fill: '<g opacity="0.55"><path d="M3 6.5L7.6 4.2V18.2L3 20.5Z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.4 5.8L21 3.5V17.5L16.4 19.8Z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g><path d="M10.4 4.2L13.6 5.8V19.8L10.4 18.2Z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    },
    armies: {
      outline:
        '<path d="M14.5 17.5L3 6V3h3l11.5 11.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 19l6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 21l2-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.5 6.5L18 3h3v3l-3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 14l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 17l-3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 19l2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      fill: '<g opacity="0.55"><path d="M14.5 6.5L18 3h3v3l-3.5 3.5Z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 14l4 4M7 17l-3 3M3 19l2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g><path d="M14.5 17.5L3 6V3h3l11.5 11.5Z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 19l6-6M16 16l4 4M19 21l2-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    },
    guides: {
      outline:
        '<path d="M9 16v-.6c0-1.1-.6-2-1.5-2.8A6 6 0 1 1 16.5 12.6c-.9.8-1.5 1.7-1.5 2.8V16Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.2 18.8h5.6M10.4 21.2h3.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      fill: '<path d="M9 16v-.6c0-1.1-.6-2-1.5-2.8A6 6 0 1 1 16.5 12.6c-.9.8-1.5 1.7-1.5 2.8V16Z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/><path d="M12 6a2.6 2.6 0 0 1 2.6 2.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.2 18.8h5.6M10.4 21.2h3.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    },
  };

  // The same icons go on the Layouts / Army / Guides tabs under the hero.
  // thz-script.js builds those buttons after its own fetch, then fires
  // parchome:coc-nav-ready -- so decorate on that event (and once now, in
  // case they already exist). Matched by label; skipped if already done.
  function iconFirstLayer() {
    var keyFor = { Layouts: 'layouts', Army: 'armies', Guides: 'guides' };
    document.querySelectorAll('.first-layer button').forEach(function (btn) {
      var icon = HUB_ICONS[keyFor[btn.textContent.trim()]];
      if (!icon || btn.querySelector('.fl-ico')) return;
      btn.insertAdjacentHTML(
        'afterbegin',
        '<svg class="fl-ico" aria-hidden="true" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          icon.outline +
          '</svg>' +
          '<svg class="fl-ico-fill" aria-hidden="true" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          icon.fill +
          '</svg>',
      );
    });
  }
  document.addEventListener('parchome:coc-nav-ready', iconFirstLayer);
  iconFirstLayer();

  fetch('./coc-nav-data.json')
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      // dsn-chip: TH18 -> TH8. Active when the current page is either that
      // TH's layouts or army page (activeOn covers both).
      if (dsnScroll && Array.isArray(data.townhalls)) {
        dsnScroll.innerHTML = data.townhalls
          .map(function (th) {
            var isActive = (th.activeOn || []).map(normalize).indexOf(currentPage) !== -1;
            return (
              '<a href="' +
              th.layoutHref +
              '" class="dsn-chip' +
              (isActive ? ' active' : '') +
              '">' +
              '<img src="' +
              th.layoutIcon +
              '" alt="" class="dsn-chip-icon">' +
              '<span>' +
              th.label +
              '</span></a>'
            );
          })
          .join('');
        if (typeof window.updateDsnScrollArrows === 'function') window.updateDsnScrollArrows();
      }

      if (hubScroll && data.primaryNav) {
        var order = ['home', 'layouts', 'armies', 'guides'];
        hubScroll.innerHTML = order
          .map(function (key) {
            var item = data.primaryNav[key];
            var icon = HUB_ICONS[key];
            if (!item || !icon) return '';
            var isActive = normalize(item.href) === currentPage;
            return (
              '<a href="' +
              item.href +
              '" class="stb-hub-link' +
              (isActive ? ' active' : '') +
              '">' +
              '<svg class="hub-ico" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              icon.outline +
              '</svg>' +
              '<svg class="hub-ico-fill" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              icon.fill +
              '</svg>' +
              '<span>' +
              item.label +
              '</span></a>'
            );
          })
          .join('');
        if (typeof window.updateStbHubNavArrows === 'function') window.updateStbHubNavArrows();
      }
    })
    .catch(function (err) {
      console.error('COC secondary top bar nav failed to load:', err);
    });
})();

// ---- Layout cards -------------------------------------------------------
// Built from the page's JSON (<div class="grid-container" data-layouts=
// "th18-layouts.json">), one card per entry in "bases", in order. The first
// PAGE_SIZE show; the rest wait behind a "Show N more" button (this replaced
// the separate th18-layouts2.html page, Sep 2026). A shared link to a hidden
// base (#base-th18-14) opens them all first. Likes, CC popups and share are
// wired up once every card exists.
(function layoutCards() {
  var grid = document.querySelector('.grid-container[data-layouts]');
  if (!grid || !window.fetch) return;
  var PAGE_SIZE = 10;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  var HEART =
    '<svg viewBox="0 0 24 24" class="like-heart" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>';
  var SHARE =
    '<svg viewBox="0 0 24 24" class="bar-ico" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>';

  function cardHtml(page, b, hidden) {
    var id = 'th' + page.th + '-' + b.id;
    var cc = (b.cc && b.cc.length ? b.cc : ['NA'])
      .map(function (t) {
        return '<li>' + esc(t) + '</li>';
      })
      .join('');
    return (
      '<div class="discord-card" id="base-' +
      id +
      '"' +
      (hidden ? ' hidden' : '') +
      '>' +
      '<div class="card-media">' +
      '<img src="' +
      esc(page.imageDir + b.image) +
      '" alt="TH' +
      page.th +
      ' base layout ' +
      b.id +
      '" class="zoomable" loading="lazy" onclick="openPalette(this)">' +
      '<button type="button" class="th-cc" aria-expanded="false" aria-label="Show recommended clan castle troops" title="Recommended CC"><img src="' +
      esc(page.icon) +
      '" alt="" decoding="async"></button>' +
      '<div class="cc-popup"><strong>Recommended CC</strong><ul>' +
      cc +
      '</ul></div>' +
      '</div>' +
      '<div class="action-row card-bar">' +
      '<button type="button" class="corner-like" data-layout-id="' +
      id +
      '" aria-pressed="false" aria-label="Like this base" title="Like this base">' +
      HEART +
      '<span class="like-count" data-layout-count hidden>0</span></button>' +
      '<a class="layout-link" href="' +
      esc(b.link) +
      '" target="_blank" rel="noopener noreferrer" title="Open this base in Clash of Clans">Copy Layout</a>' +
      '<button type="button" class="card-share" data-share="base-' +
      id +
      '" aria-label="Share this base" title="Share this base">' +
      SHARE +
      '</button>' +
      '</div>' +
      '</div>'
    );
  }

  fetch(grid.getAttribute('data-layouts'))
    .then(function (r) {
      return r.json();
    })
    .then(function (page) {
      var bases = page.bases || [];
      grid.innerHTML = bases
        .map(function (b, i) {
          return cardHtml(page, b, i >= PAGE_SIZE);
        })
        .join('');

      var more = document.getElementById('show-more');
      function revealAll() {
        grid.querySelectorAll('.discord-card[hidden]').forEach(function (c) {
          c.hidden = false;
        });
        if (more) more.parentElement.hidden = true;
      }
      if (more && bases.length > PAGE_SIZE) {
        more.textContent = 'Show ' + (bases.length - PAGE_SIZE) + ' more';
        more.parentElement.hidden = false;
        more.addEventListener('click', revealAll);
      }

      // Like counts: one Firestore doc per page, named after the file
      // (layoutLikes/th18-layouts), keyed by each card's data-layout-id.
      initLayoutLikes('th' + page.th + '-layouts');
      initCcPopups();
      initCardShare('TH' + page.th + ' base layout on Parchrome', revealAll);
    })
    .catch(function (err) {
      console.error('Layout cards: failed to load ' + grid.getAttribute('data-layouts'), err);
    });
})();

function initLayoutLikes(pageId) {
  const firebaseConfig = {
    apiKey: 'AIzaSyAa8B5rIP0Y9w9jBN_mzKzkFW3xMdI9wgo',
    authDomain: 'parchrome-feedback.firebaseapp.com',
    projectId: 'parchrome-feedback',
    storageBucket: 'parchrome-feedback.firebasestorage.app',
    messagingSenderId: '546895020356',
    appId: '1:546895020356:web:f145067c0b71dde2341711',
  };
  // home.html already calls firebase.initializeApp() if it's ever loaded
  // in the same context; guard so this page never double-initialises.
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  const PAGE_DOC_ID = pageId;
  const STORAGE_KEY = 'parchrome_liked_' + PAGE_DOC_ID;
  const docRef = db.collection('layoutLikes').doc(PAGE_DOC_ID);

  function getLikedSet() {
    try {
      return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
    } catch (e) {
      return new Set();
    }
  }
  function saveLikedSet(set) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    } catch (e) {
      /* localStorage unavailable (private mode, quota) -- like still works for this session */
    }
  }

  const buttons = Array.from(document.querySelectorAll('.corner-like[data-layout-id]'));
  if (!buttons.length) return;
  buttons.forEach(function (btn) {
    btn.addEventListener('animationend', function () {
      btn.classList.remove('just-liked');
    });
  });

  // The count sits beside the heart; nothing at 0 (a lone "0" is clutter).
  // The label and tooltip carry the same number for screen readers.
  function setCount(el, n) {
    const btn = el.closest('.corner-like');
    el.textContent = n.toLocaleString('en-US');
    el.hidden = n <= 0;
    const liked = btn.classList.contains('is-liked');
    const label = (liked ? 'Unlike this base' : 'Like this base') + (n > 0 ? ' (' + n + (n === 1 ? ' like)' : ' likes)') : '');
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.dataset.count = n;
  }
  const readCount = (el) => parseInt(el.closest('.corner-like').dataset.count, 10) || 0;

  const liked = getLikedSet();
  buttons.forEach(function (btn) {
    if (liked.has(btn.dataset.layoutId)) {
      btn.classList.add('is-liked');
      btn.setAttribute('aria-pressed', 'true');
    }
  });

  // One read for every card's count on this page.
  docRef
    .get()
    .then(function (snap) {
      const counts = (snap.exists && snap.data().counts) || {};
      buttons.forEach(function (btn) {
        const n = counts[btn.dataset.layoutId] || 0;
        setCount(btn.querySelector('[data-layout-count]'), n);
      });
    })
    .catch(function (err) {
      console.error('Layout likes: failed to load counts:', err);
    });

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.dataset.layoutId;
      const countEl = btn.querySelector('[data-layout-count]');
      const wasLiked = btn.classList.contains('is-liked');
      const delta = wasLiked ? -1 : 1;

      // Optimistic UI -- update immediately, revert only if the write fails.
      btn.disabled = true;
      btn.classList.toggle('is-liked', !wasLiked);
      btn.setAttribute('aria-pressed', String(!wasLiked));
      setCount(countEl, Math.max(0, readCount(countEl) + delta));
      if (!wasLiked) {
        btn.classList.remove('just-liked');
        void btn.offsetWidth; // restart the pop if tapped again quickly
        btn.classList.add('just-liked');
      }
      if (wasLiked) liked.delete(id);
      else liked.add(id);
      saveLikedSet(liked);

      docRef
        .set({ counts: { [id]: firebase.firestore.FieldValue.increment(delta) } }, { merge: true })
        .catch(function (err) {
          console.error('Layout likes: write failed, reverting:', err);
          btn.classList.toggle('is-liked', wasLiked);
          btn.setAttribute('aria-pressed', String(wasLiked));
          setCount(countEl, Math.max(0, readCount(countEl) - delta));
          if (wasLiked) liked.add(id);
          else liked.delete(id);
          saveLikedSet(liked);
        })
        .finally(function () {
          btn.disabled = false;
        });
    });
  });
}

// TH icon on each card opens that base's recommended CC. Stops the click
// from reaching thz-script.js's document listener, which closes every
// .cc-popup on any click outside .image-logo.
function initCcPopups() {
  var btns = document.querySelectorAll('.th-cc');
  function closeAll(except) {
    btns.forEach(function (b) {
      if (b === except) return;
      b.setAttribute('aria-expanded', 'false');
      var p = b.parentElement.querySelector('.cc-popup');
      if (p) p.style.display = 'none';
    });
  }
  btns.forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var p = b.parentElement.querySelector('.cc-popup');
      var open = b.getAttribute('aria-expanded') !== 'true';
      closeAll(b);
      p.style.display = open ? 'block' : 'none';
      b.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.cc-popup')) closeAll(null);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll(null);
  });
}

// Share button on each layout card. Shares this page with the card's id on
// the end (e.g. th18-layouts.html#base-th18-3) so the link brings people to
// Parchrome, not straight into the game.
//  - Touch devices: the phone's own share sheet (navigator.share), which
//    lists whatever apps that person has.
//  - Desktop (or no share sheet): one small panel with Copy link and four
//    share links. Discord has no web share link, so "Copy link" covers it.
function initCardShare(title, revealAll) {
  var btns = document.querySelectorAll('.card-share[data-share]');
  if (!btns.length) return;

  var ICONS = {
    link: '<svg viewBox="0 0 24 24" class="bar-ico" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    out: '<svg viewBox="0 0 24 24" class="bar-ico" aria-hidden="true"><path d="M7 17L17 7M17 7H8M17 7v9"/></svg>',
  };
  var panel = document.createElement('div');
  panel.className = 'share-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'menu');
  panel.innerHTML =
    '<button type="button" class="sp-copy" role="menuitem">' +
    ICONS.link +
    '<span>Copy link</span></button><hr>' +
    '<a role="menuitem" target="_blank" rel="noopener noreferrer" data-to="facebook">' +
    ICONS.out +
    'Facebook</a>' +
    '<a role="menuitem" target="_blank" rel="noopener noreferrer" data-to="x">' +
    ICONS.out +
    'X</a>' +
    '<a role="menuitem" target="_blank" rel="noopener noreferrer" data-to="reddit">' +
    ICONS.out +
    'Reddit</a>' +
    '<a role="menuitem" target="_blank" rel="noopener noreferrer" data-to="whatsapp">' +
    ICONS.out +
    'WhatsApp</a>';
  var copyBtn = panel.querySelector('.sp-copy');
  var openBtn = null;
  var TITLE = title;

  function urlFor(id) {
    return location.origin + location.pathname + '#' + id;
  }
  function close() {
    panel.hidden = true;
    if (openBtn) {
      openBtn.setAttribute('aria-expanded', 'false');
      openBtn = null;
    }
  }
  function open(btn) {
    var url = urlFor(btn.dataset.share),
      u = encodeURIComponent(url),
      t = encodeURIComponent(TITLE);
    var to = {
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + u,
      x: 'https://twitter.com/intent/tweet?url=' + u + '&text=' + t,
      reddit: 'https://www.reddit.com/submit?url=' + u + '&title=' + t,
      whatsapp: 'https://wa.me/?text=' + t + '%20' + u,
    };
    panel.querySelectorAll('a[data-to]').forEach(function (a) {
      a.href = to[a.dataset.to];
    });
    copyBtn.dataset.url = url;
    copyBtn.classList.remove('copied');
    copyBtn.querySelector('span').textContent = 'Copy link';
    var card = btn.closest('.discord-card');
    card.appendChild(panel);
    // The action row is a centred cluster, so the share button no longer
    // sits at the card's right edge -- line the panel's right edge up with
    // the button instead of the card.
    panel.style.right = Math.max(0, card.getBoundingClientRect().right - btn.getBoundingClientRect().right) + 'px';
    panel.hidden = false;
    openBtn = btn;
    btn.setAttribute('aria-expanded', 'true');
    copyBtn.focus({ preventScroll: true });
  }

  var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  btns.forEach(function (btn) {
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (touch && navigator.share) {
        navigator.share({ title: TITLE, url: urlFor(btn.dataset.share) }).catch(function () {});
        return;
      }
      if (openBtn === btn) close();
      else {
        close();
        open(btn);
      }
    });
  });

  copyBtn.addEventListener('click', function () {
    var url = copyBtn.dataset.url;
    function done() {
      copyBtn.classList.add('copied');
      copyBtn.querySelector('span').textContent = 'Link copied';
      setTimeout(close, 900);
    }
    if (navigator.clipboard)
      navigator.clipboard
        .writeText(url)
        .then(done)
        .catch(function () {
          prompt('Copy this link:', url);
        });
    else prompt('Copy this link:', url);
  });
  panel.addEventListener('click', function (e) {
    e.stopPropagation();
    if (e.target.closest('a[data-to]')) setTimeout(close, 0);
  });
  document.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openBtn) {
      var b = openBtn;
      close();
      b.focus();
    }
  });

  // Arriving on a shared link: bring that base into view and let it glow.
  function highlight() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!/^base-/.test(id)) return;
    var card = document.getElementById(id);
    if (!card) return;
    if (card.hidden) revealAll(); // a base behind "Show more"
    card.scrollIntoView({ block: 'center' });
    card.classList.remove('is-target');
    void card.offsetWidth;
    card.classList.add('is-target');
    card.addEventListener(
      'animationend',
      function () {
        card.classList.remove('is-target');
      },
      { once: true },
    );
  }
  setTimeout(highlight, 300); // the cards exist now (built from the JSON)
  window.addEventListener('hashchange', highlight);
}
