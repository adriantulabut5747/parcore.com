// Full path of a link or address, e.g. "/coc/town-hall-18/layouts" -- the last
// part alone ("layouts") is the same for every Town Hall. "x.html", "x" and
// "x/index.html" count as the same page.
function cocPagePath(u) {
  var p = new URL(String(u || ''), location.origin + '/').pathname.toLowerCase();
  return p
    .replace(/\.html$/, '')
    .replace(/\/index$/, '/')
    .replace(/(.)\/$/, '$1');
}

/* =======================================================================
   TOWN HALL LAYOUTS PAGES (thNN-layouts.html) -- shared script.
   Every TH layouts page loads this (defer, at the end of <body>) with
   th-layouts.css. The page itself only holds its markup; its bases come
   from thNN-layouts.json (see "Layout cards" below).

   In order: page chrome (scrollbar width, phone scroll lock), the hero
   ("Did you know?", event cards), the Town Hall strip's scroll line, the
   secondary top bar, then the layout cards and what hangs off them
   (likes, recommended-CC popups, share).
   Moved out of /coc/town-hall-18/layouts's inline <script>s, Sep 2026.
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
  fetch('/coc-dyk.json')
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
      // thz-script.js positions the strip on page load (keeps the tapped
      // chip in view / centres the current TH) -- that isn't the visitor
      // scrolling, so it doesn't count as "seen".
      if (box._autoScrollAt && Date.now() - box._autoScrollAt < 1000) return;
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
// to /coc/'s copy of this script.
(function initCocSecondaryTopBar() {
  var dsnScroll = document.getElementById('dsnCategoriesScroll');
  var hubScroll = document.getElementById('stbHubNavScroll');
  if (!dsnScroll && !hubScroll) return;

  function normalize(url) {
    return cocPagePath(url);
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
        '<path d="M3 10.2 12 3l9 7.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 8.6v10.6A1.8 1.8 0 0 0 7.3 21h9.4a1.8 1.8 0 0 0 1.8-1.8V8.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 21v-4.6a2 2 0 0 1 4 0V21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      fill: '<defs><mask id="hubHomeCut"><rect width="24" height="24" fill="#fff"/><path d="M10.1 22v-5.6a1.9 1.9 0 0 1 3.8 0V22Z" fill="#000"/></mask></defs><path d="M5.5 8.6 12 3.4l6.5 5.2v10.6a1.8 1.8 0 0 1-1.8 1.8H7.3a1.8 1.8 0 0 1-1.8-1.8Z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" mask="url(#hubHomeCut)"/><path d="M3 10.2 12 3l9 7.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.1 21v-4.6a1.9 1.9 0 0 1 3.8 0V21Z" fill="currentColor" stroke="none" opacity="0.55"/>',
    },
    // Icon set v5 (two-tone): Home = a house (was a castle with a flag until
    // Oct 2026 -- it read as "fort", not "home"),
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
        '<path d="M8.6 7.4V5.9c0-1 .8-1.8 1.8-1.8h3.2c1 0 1.8.8 1.8 1.8v1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="3.2" y="7.4" width="17.6" height="12.6" rx="1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.2 12.6h6.3M14.5 12.6h6.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="9.5" y="11.1" width="5" height="3.1" rx="0.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      fill: '<path d="M8.6 7.4V5.9c0-1 .8-1.8 1.8-1.8h3.2c1 0 1.8.8 1.8 1.8v1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 7.4h14a1.8 1.8 0 0 1 1.8 1.8v2.2H3.2V9.2A1.8 1.8 0 0 1 5 7.4Z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/><path d="M3.2 14h17.6v4.2a1.8 1.8 0 0 1-1.8 1.8H5a1.8 1.8 0 0 1-1.8-1.8Z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="9.6" y="11" width="4.8" height="4" rx="0.8" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    },
  };

  // The same icons go on the Layouts / Army / Guides tabs under the hero.
  // thz-script.js builds those buttons after its own fetch, then fires
  // parchome:coc-nav-ready -- so decorate on that event (and once now, in
  // case they already exist). Matched by label; skipped if already done.
  function iconFirstLayer() {
    var keyFor = { Layouts: 'layouts', Army: 'armies', Tools: 'guides' };
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

  // Tools chip row: .is-tight (short labels) only when the full names
  // would make the row scroll sideways. Measured with the full names
  // showing, decided in the same frame; re-checked on resize and once the
  // chip icons and fonts have loaded. Same rule as the strip under the hero
  // (thz-script.js fitStripLabels).
  function fitLabels(box) {
    if (!box.querySelector('.lbl-full')) return;
    function fit() {
      box.classList.remove('is-tight');
      if (box.scrollWidth > box.clientWidth + 1) box.classList.add('is-tight');
      if (typeof window.updateDsnScrollArrows === 'function') window.updateDsnScrollArrows();
    }
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(box);
    box.querySelectorAll('img').forEach(function (img) {
      if (!img.complete) img.addEventListener('load', fit);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  }

  fetch('/coc-nav-data.json')
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      // dsn-chip: TH18 -> TH8. Active when the current page is either that
      // TH's layouts or army page (activeOn covers both). On an army page
      // the chips go to each TH's army page, like the chip row under the
      // hero (thz-script.js's buildSecondLayer).
      // Guides pages (coctools*.html): the chip row switches between the
      // guides instead of Town Halls, the same as the strip under the hero.
      // A tool also owns everything under its activePrefix list (the Player
      // Tracker owns every /coc/player/<TAG> and /coc/clan/<TAG>).
      var guide = (data.guides || []).find(function (g) {
        return (
          (g.activeOn || []).map(normalize).indexOf(currentPage) !== -1 ||
          [].concat(g.activePrefix || []).some(function (pre) {
            return currentPage.indexOf(pre) === 0;
          })
        );
      });
      if (dsnScroll && guide) {
        // The Tools hub itself ("hub": true) is the Tools tab, not a chip.
        dsnScroll.innerHTML = data.guides
          .filter(function (g) {
            return !g.hub;
          })
          .map(function (g) {
            return (
              '<a href="' +
              g.href +
              '" class="dsn-chip' +
              (g === guide ? ' active' : '') +
              '">' +
              '<img src="' +
              g.icon +
              '" alt="" class="dsn-chip-icon">' +
              // Full name ("Damage Calculator") while the row fits, the short
              // label ("Damage Calc.") once it has to scroll -- fitLabels below.
              (g.name && g.name !== g.label
                ? '<span class="lbl-full">' + g.name + '</span><span class="lbl-short">' + g.label + '</span>'
                : '<span>' + g.label + '</span>') +
              '</a>'
            );
          })
          .join('');
        fitLabels(dsnScroll);
        if (typeof window.updateDsnScrollArrows === 'function') window.updateDsnScrollArrows();
      } else if (dsnScroll && Array.isArray(data.townhalls)) {
        var onArmy = data.townhalls.some(function (t) {
          return normalize(t.armyHref) === currentPage;
        });
        dsnScroll.innerHTML = data.townhalls
          .map(function (th) {
            var isActive = (th.activeOn || []).map(normalize).indexOf(currentPage) !== -1;
            return (
              '<a href="' +
              (onArmy ? th.armyHref : th.layoutHref) +
              '" class="dsn-chip' +
              (isActive ? ' active' : '') +
              '">' +
              '<img src="' +
              // Army pages show each TH's barracks (armyIcon), layouts pages its Town Hall.
              (onArmy ? th.armyIcon : th.layoutIcon) +
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
        // Layouts / Armies point at THIS Town Hall's pages (primaryNav only
        // holds TH18's), the same way thz-script.js repoints the bottom nav.
        var th = (data.townhalls || []).find(function (t) {
          return (t.activeOn || []).map(normalize).indexOf(currentPage) !== -1;
        });
        var hrefFor = { layouts: th && th.layoutHref, armies: th && th.armyHref };
        hubScroll.innerHTML = order
          .map(function (key) {
            var item = data.primaryNav[key];
            var icon = HUB_ICONS[key];
            if (!item || !icon) return '';
            var href = hrefFor[key] || item.href;
            // Guides stays lit on all four guides pages, not just the first.
            var isActive = normalize(href) === currentPage || (key === 'guides' && !!guide);
            return (
              '<a href="' +
              href +
              '" data-hub="' +
              key +
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

// ARMY SHEET -- an army drawn from its Copy Army link (army= code), shared
// by the army cards (thNN-army.html, layoutCards below) and the army maker
// (/coc/tools/army-maker), so the two always look the same. Exposed as
// window.ArmySheet:
//   load()              fetches coc-army-data.json once; resolves when ready
//   html(th, code, opt) the sheet's markup for a Town Hall + army= code.
//                       opt.edit (army maker): every unit, hero, pet and
//                       equipment box carries what tapping it does
//                       (data-sheet: remove / hero / slot / mode), and
//                       empty pet / equipment slots are drawn so they can be
//                       tapped. opt.stack: heroes on top, units below at
//                       every width (the phone arrangement).
//   wire(root)          names on hover / tap, empty places, edge fades.
//                       Call again after redrawing; listeners attach once.
(function armySheet() {
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // Template tag: builds the string, then drops the whitespace between tags.
  function tidy(strings) {
    var out = strings[0];
    for (var i = 1; i < strings.length; i++) out += arguments[i] + strings[i];
    return out.replace(/>\s+</g, '><').trim();
  }

  // ---- Army sheet: the card's picture, built from its Copy Army link ----
  // The army= code already lists every hero, pet, equipment, troop, spell
  // and clan castle unit (format: see the top of coc-armymaker.js), and
  // coc-army-data.json turns each id into a name, an icon and a housing
  // space. So the card draws the army itself instead of showing a
  // screenshot. Links carry no unit levels, so the tiles show counts only.
  // Heroes wear their Dragonscale skin (clashofclans/coctools/dragonscale/,
  // same file names as the hero icons). The set has no Dragon Duke, so his
  // file there is the Imprisoned Duke skin, which shares its dark armour
  // and glowing-ember look.
  var ARMY_DATA = '/coc-army-data.json';
  var HERO_ART = '/clashofclans/coctools/dragonscale/';
  // Where each render's face is, so every portrait shows the face at the
  // same size, centred, with the eyes on the same line. The renders are
  // framed very differently (the Warden is small in his image, wings and
  // all; the King's sword pushes him left), so each is scaled by the
  // distance between its eyes -- the one measure hats, horns and beards
  // don't change. x / y: the point between the eyes; h: three eye-spacings
  // (about a head), all as fractions of the image. Measured on the 480px
  // renders.
  var HERO_FACE = {
    0: [0.404, 0.229, 0.15], // King: eyes 194,110; spacing 24px
    1: [0.461, 0.26, 0.156], // Queen: 221,125; 25px
    2: [0.532, 0.3, 0.169], // Warden: 255,144; 27px
    4: [0.461, 0.281, 0.169], // Champion: 221,135; 27px
    6: [0.525, 0.277, 0.169], // Prince: 252,133 (visor); ~27px
    // Duke (Imprisoned): eye glows 249 + 290, 201; 41px. His eyes sit high
    // on the helmet, so his y is aimed 16px above them, which drops him a
    // little lower in the frame and puts his face level with the others.
    7: [0.561, 0.385, 0.256],
  };
  // Each hero's own banner (the flag from its Hero Hall banner), top-left
  // of the portrait. clashofclans/coctools/banners/, hero file names.
  var BANNERS = '/clashofclans/coctools/banners/';
  // Pet strip: where the pet's face is in its square icon (object-position
  // and zoom origin), so the wide crop keeps the face.
  var PET_FOCUS = {
    0: '50% 22%',
    1: '50% 40%',
    2: '50% 28%',
    3: '62% 28%',
    4: '58% 22%',
    7: '62% 28%',
    8: '45% 45%',
    9: '50% 28%',
    10: '50% 52%',
    11: '50% 45%',
    16: '50% 24%',
    17: '72% 18%',
  };
  var units = null; // set by load(), from coc-army-data.json

  function indexUnits(d) {
    var by = function (list) {
      var m = {};
      (list || []).forEach(function (u) {
        m[u.id] = u;
      });
      return m;
    };
    var troop = by((d.troops || []).concat(d.sieges || []));
    (d.sieges || []).forEach(function (u) {
      troop[u.id].siege = true;
    });
    return {
      dir: d.imageDir,
      th: d.townHalls || {},
      hero: by(d.heroes),
      pet: by(d.pets),
      equip: by(d.equipment),
      troop: troop,
      spell: by(d.spells),
      // the first Town Hall with pets (the Pet House)
      petTh: Math.min.apply(null, (d.pets || []).map((p) => p.th).concat(99)),
    };
  }

  // army= code -> { heroes: [{hero, pet, eq[], air}], troops, sieges,
  // spells, ccTroops, ccSieges, ccSpells: [{u, n}] }. Unknown ids are
  // skipped; '' is an empty army (the maker before you tap anything);
  // null when the code isn't an army code at all.
  function parseArmy(code) {
    var out = { heroes: [], troops: [], sieges: [], spells: [], ccTroops: [], ccSieges: [], ccSpells: [] };
    if (code === '') return out;
    if (!/^[hidus][0-9hidusmpex_-]*$/.test(code)) return null;
    var re = /([hidus])([^hidus]*)/g;
    var sec;
    while ((sec = re.exec(code))) {
      var key = sec[1];
      sec[2]
        .split('-')
        .filter(Boolean)
        .forEach(function (part) {
          if (key === 'h') {
            var g = part.match(/^(\d+)(?:m(\d+))?(?:p(\d+))?(?:e(\d+)(?:_(\d+))?)?$/);
            var h = g && units.hero[g[1]];
            if (!h) return;
            out.heroes.push({
              hero: h,
              air: g[2] === '1',
              pet: g[3] != null ? units.pet[g[3]] || null : null,
              eq: [g[4], g[5]]
                .map(function (e) {
                  return e != null ? units.equip[e] : null;
                })
                .filter(Boolean),
            });
            return;
          }
          var nx = part.split('x');
          var n = parseInt(nx[0], 10);
          var spell = key === 'd' || key === 's';
          var u = (spell ? units.spell : units.troop)[nx[1]];
          if (!u || !(n > 0)) return;
          var cc = key === 'i' || key === 'd';
          var list = spell ? (cc ? 'ccSpells' : 'spells') : u.siege ? (cc ? 'ccSieges' : 'sieges') : cc ? 'ccTroops' : 'troops';
          out[list].push({ u: u, n: n });
        });
    }
    return out;
  }

  function used(list, perUnit) {
    return list.reduce(function (t, x) {
      return t + x.n * (perUnit ? 1 : x.u.space || 1);
    }, 0);
  }
  // kind: what the tile is, for the army maker (troop / spell / ccTroop /
  // ccSpell -- siege machines count as troops, as in the link). In edit
  // mode the tile is a button that removes one.
  var edit = false; // set by each html() call
  function unitTile(x, kind) {
    var label = x.n + ' ' + x.u.name;
    // Super troops get a red count chip (.is-super) so they stand out.
    var sup = x.u.super ? ' is-super' : '';
    var inner = `<img src="${esc(units.dir + x.u.img)}" alt="" loading="lazy" decoding="async"><b class="as-n">×${x.n}</b>`;
    if (edit)
      return `<button type="button" class="as-tile${sup}" data-sheet="remove" data-kind="${kind}" data-id="${x.u.id}" aria-label="Remove one ${esc(x.u.name)} (${x.n})" title="${esc(label)}" data-name="${esc(x.u.name)} ×${x.n}">${inner}</button>`;
    return `<span class="as-tile${sup}" role="img" aria-label="${esc(label)}" title="${esc(label)}" data-name="${esc(x.u.name)} ×${x.n}">${inner}</span>`;
  }
  // Pets and equipment. Equipment gets its rarity colour (.as-epic purple,
  // .as-common blue, as in-game); the pet gets its face focus.
  // In edit mode (slot = 'pet' / 'eq0' / 'eq1' of hero heroId) it's a
  // button that opens the maker's picker for that slot, and u null draws
  // the empty slot as a "+".
  var PLUS = '<svg class="as-plus" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>';
  function gearTile(u, cls, focus, heroId, slot) {
    var style = focus ? ` style="--pf:${focus}"` : '';
    if (edit) {
      var what = slot === 'pet' ? 'pet' : 'equipment';
      var label = u ? 'Change ' + what + ': ' + u.name : 'Choose ' + what;
      var inner = u ? `<img src="${esc(units.dir + u.img)}"${style} alt="" loading="lazy" decoding="async">` : PLUS;
      var named = u ? ` data-name="${esc(u.name)}"` : '';
      return `<button type="button" class="as-tile ${cls}${u ? '' : ' as-open'}" data-sheet="slot" data-hero="${heroId}" data-slot="${slot}" aria-label="${esc(label)}" title="${esc(label)}"${named}>${inner}</button>`;
    }
    return `<span class="as-tile ${cls}" role="img" aria-label="${esc(u.name)}" title="${esc(u.name)}" data-name="${esc(u.name)}"><img src="${esc(units.dir + u.img)}"${style} alt="" loading="lazy" decoding="async"></span>`;
  }
  // One labelled group: name on the left, "used/max" on the right, then a
  // row of tiles that scrolls sideways when it doesn't fit.
  // Clan castle: the CC heading icon -- a tall crenellated tower with an
  // arched gate, rising out of low walls (like the in-game building).
  // Oct 2026: replaced a keep with the clan's pennant on top.
  var CASTLE =
    '<path d="M3 21v-9h2.5v2.5H8"/><path d="M16 14.5h2.5V12H21v9"/><path d="M8 21V4.5h2.25V7h3.5V4.5H16V21"/><path d="M2 21h20"/><path d="M10.25 21v-3a1.75 1.75 0 0 1 3.5 0v3"/>';
  // Section icons (muted grey, before each heading, like the game's
  // headers): crown, army camp tent, potion flask, siege wagon, castle.
  // Stroke icons: crown, tent and flask are Lucide (ISC licence); the castle
  // and siege ram are drawn for this site in the same 2px line.
  var SECTION_ICONS = {
    heroes:
      '<path d="M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.3l4.27-3.67a.5.5 0 0 1 .8.52l-2.83 10.25a1 1 0 0 1-.96.73H5.81a1 1 0 0 1-.96-.73L2.02 6.02a.5.5 0 0 1 .8-.52L7.1 9.17a1 1 0 0 0 1.52-.3z"/><path d="M5 21h14"/>',
    troops: '<path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/>',
    spells:
      '<path d="M14 2v6a2 2 0 0 0 .25.96l5.5 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.75-2.96l5.5-10.08A2 2 0 0 0 10 8V2"/><path d="M6.45 15h11.1"/><path d="M8.5 2h7"/>',
    // a covered battering ram on wheels, with a solid iron head
    siege:
      '<path d="M2.5 10.5 8.25 6 14 10.5"/><path d="M2.5 10.5H14V15H2.5z"/><path d="M14 12.75h2.5"/><path d="M16.5 10h2.75l2.75 2.75-2.75 2.75H16.5z" fill="currentColor"/><circle cx="5.25" cy="19" r="2"/><circle cx="11.25" cy="19" r="2"/>',
    castle: CASTLE,
  };
  function ico(name) {
    return `<svg class="as-ico" viewBox="0 0 24 24" aria-hidden="true">${SECTION_ICONS[name]}</svg>`;
  }
  // Heading: icon + label (the label swaps for a unit's name on hover /
  // tap, the icon stays), and the used/max counts on the right.
  function headHtml(label, icon, cap) {
    return `<div class="as-head"><span class="as-title">${ico(icon)}<span class="as-label" data-label="${esc(label)}">${esc(label)}</span></span>${cap}</div>`;
  }
  // "340/352": the used number in the accent red, the room after the slash muted.
  function capHtml(have, max) {
    return `<b>${have}</b>/${max}`;
  }
  // slots: a fixed number of places for this row (siege: one per siege
  // the Town Hall can bring); without it, empty places fill the row's width.
  function group(cls, label, icon, have, max, tiles, slots) {
    var cap = max ? `<span class="as-cap">${capHtml(have, max)}</span>` : '';
    var fixed = slots ? ` data-slots="${slots}"` : '';
    return `<div class="as-group ${cls}">${headHtml(label, icon, cap)}<div class="as-row"${fixed}>${tiles}</div></div>`;
  }

  // Grand Warden's mode, as a small icon in the portrait's top-right
  // corner like the in-game boot: a boot for ground, a wing for air.
  var GROUND =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h6.5v8.2l4.9 1.9A3 3 0 0 1 20.3 16v1.5H4.2v-3.6c0-.6.2-1.2.6-1.7L7 10.6V3Z"/><path d="M4.2 19h16.1v1.2a.8.8 0 0 1-.8.8H5a.8.8 0 0 1-.8-.8V19Z"/></svg>';
  var AIR =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18.5C4.6 10.8 10.2 5 21 3.6c-1.3 2.9-3.2 4.7-5.8 5.5 1.7.2 3.1-.1 4.3-.7-1.1 2.6-3.1 4.2-5.9 4.8 1.3.4 2.6.4 3.8 0-2.3 3.4-6.2 5.2-11.2 5L4.5 20.5H3v-2Z"/></svg>';
  function heroCol(x, hasPets) {
    var h = x.hero;
    var mode = '';
    if (h.modes && edit)
      mode = `<button type="button" class="as-mode" data-sheet="mode" data-hero="${h.id}" aria-label="Switch to ${x.air ? 'ground' : 'air'} mode" title="${x.air ? 'Air' : 'Ground'} mode: tap to switch">${x.air ? AIR : GROUND}</button>`;
    else if (h.modes) mode = `<span class="as-mode" aria-hidden="true">${x.air ? AIR : GROUND}</span>`;
    var eqTile = (q, i) => gearTile(q, 'as-eq' + (q ? (q.epic ? ' as-epic' : ' as-common') : ''), null, h.id, 'eq' + i);
    var eq, pet, petSide;
    if (edit) {
      // Every slot, filled or not, so each one can be tapped.
      eq = [x.eq[0] || null, x.eq[1] || null].map(eqTile).join('');
      pet = hasPets ? gearTile(x.pet, 'as-pet', x.pet && PET_FOCUS[x.pet.id], h.id, 'pet') : '';
      petSide = hasPets ? gearTile(x.pet, 'as-pet-side', null, h.id, 'pet') : '';
    } else {
      eq = x.eq.map(eqTile).join('');
      pet = x.pet ? gearTile(x.pet, 'as-pet', PET_FOCUS[x.pet.id]) : '';
      // Phones show the pet beside the portrait, at the top of the equipment
      // column, so the hero can be thin and short. That copy (.as-pet-side)
      // is hidden elsewhere; the band inside the portrait is hidden on phones.
      petSide = x.pet ? gearTile(x.pet, 'as-pet-side') : '';
    }
    var f = HERO_FACE[h.id] || [0.5, 0.25, 0.2];
    var banner = `<img class="as-banner" src="${esc(BANNERS + h.img)}" alt="" loading="lazy" decoding="async">`;
    var name = h.name + (h.modes ? ' · ' + (x.air ? 'Air' : 'Ground') : '');
    var portrait = edit
      ? `<div class="as-portrait" data-sheet="hero" data-hero="${h.id}" role="button" tabindex="0" aria-label="Change or remove ${esc(name)}" title="${esc(name)}: tap to change" data-name="${esc(name)}">`
      : `<div class="as-portrait" role="img" aria-label="${esc(name)}" title="${esc(name)}" data-name="${esc(name)}">`;
    return `<div class="as-hero">${portrait}<img class="as-art" src="${esc(HERO_ART + h.img)}" style="--fx:${f[0]};--fy:${f[1]};--hh:${f[2]}" alt="" loading="lazy" decoding="async">${banner}${mode}${pet}</div><div class="as-gear">${petSide}${eq}</div></div>`;
  }

  function sheetHtml(th, code, opt) {
    var army = units && code != null ? parseArmy(code) : null;
    if (!army) return '';
    edit = !!(opt && opt.edit);
    var cap = units.th[th] || {};
    var cc = cap.cc || {};
    var hasPets = units.petTh <= th;
    var slots = Math.max(cap.heroes || 0, army.heroes.length);
    var heroes = army.heroes.map((x) => heroCol(x, hasPets)).join('');
    // Empty hero slots. In the maker they open the hero picker.
    for (var i = army.heroes.length; i < slots; i++)
      heroes += edit
        ? `<div class="as-hero as-empty"><button type="button" class="as-portrait" data-sheet="hero" aria-label="Add a hero" title="Add a hero">${PLUS}</button></div>`
        : '<div class="as-hero as-empty" aria-hidden="true"><div class="as-portrait"></div></div>';
    var tiles = (list, kind) => list.map((x) => unitTile(x, kind)).join('');
    var mid = group('as-spells', 'Spells', 'spells', used(army.spells), cap.spells, tiles(army.spells, 'spell'));
    if (cap.sieges)
      mid += group('as-sieges', 'Siege', 'siege', used(army.sieges, true), cap.sieges, tiles(army.sieges, 'troop'), cap.sieges);
    // Clan castle: one row, troops then spells then siege (each kind starts
    // a little apart, .as-kind), with the three used/max counts in the
    // heading in that same order -- the in-game CC bar does the same.
    var ccKinds = [
      [army.ccTroops, used(army.ccTroops), cc.troops, 'ccTroop'],
      [army.ccSpells, used(army.ccSpells), cc.spells, 'ccSpell'],
      [army.ccSieges, used(army.ccSieges, true), cc.sieges, 'ccTroop'],
    ].filter((k) => k[0].length || k[2]);
    var ccCaps = ccKinds.map((k) => capHtml(k[1], k[2])).join(' · ');
    var ccTiles = ccKinds
      .filter((k) => k[0].length)
      .map((k) => tiles(k[0], k[3]).replace(/class="as-tile( is-super)?"/, 'class="as-tile$1 as-kind"'))
      .join('');
    var bottom = `<div class="as-group as-cc">${headHtml('Clan Castle', 'castle', `<span class="as-cap">${ccCaps}</span>`)}<div class="as-row">${ccTiles}</div></div>`;
    // Phones (cards only, not the maker): troops, spells and siege in one
    // "Army" row -- troops first, then spells, then siege, each kind a
    // little apart -- with the three used/max counts in that order. The
    // separate rows stay in the markup for desktop; CSS picks which shows.
    var armyRow = '';
    if (!edit) {
      var armyKinds = [
        [army.troops, used(army.troops), cap.troops, 'troop'],
        [army.spells, used(army.spells), cap.spells, 'spell'],
        [army.sieges, used(army.sieges, true), cap.sieges, 'troop'],
      ].filter((k) => k[0].length || k[2]);
      var armyTiles = armyKinds
        .filter((k) => k[0].length)
        .map((k) => tiles(k[0], k[3]).replace(/class="as-tile( is-super)?"/, 'class="as-tile$1 as-kind"'))
        .join('');
      armyRow = `<div class="as-group as-army">${headHtml('Army', 'troops', `<span class="as-cap">${armyKinds.map((k) => capHtml(k[1], k[2])).join(' · ')}</span>`)}<div class="as-row">${armyTiles}</div></div>`;
    }
    return tidy`
      <div class="army-sheet${edit ? ' is-edit' : ''}${opt && opt.stack ? ' is-stack' : ''}" style="--slots:${slots}">
        <div class="as-heroes">
          ${headHtml('Heroes', 'heroes', `<span class="as-cap">${capHtml(army.heroes.length, slots)}</span>`)}
          <div class="as-hero-row">${heroes}</div>
        </div>
        <div class="as-units">
          ${armyRow}
          ${group('as-troops', 'Troops', 'troops', used(army.troops), cap.troops, tiles(army.troops, 'troop'))}
          <div class="as-pair">${mid}</div>
          ${bottom}
        </div>
      </div>`;
  }

  // Hover or tap a tile: its name (and count) shows in place of its
  // group's label, so the name never gets clipped by a scrolling row.
  // Moving off (or tapping anything else) puts the label back.
  // The tile being named also gets a red ring (.is-on).
  var namedLabel = null;
  var namedTile = null;
  function showName(tile) {
    if (namedTile) namedTile.classList.remove('is-on');
    namedTile = tile || null;
    if (tile) tile.classList.add('is-on');
    var block = tile && tile.closest('.as-group, .as-heroes');
    var label = block && block.querySelector('.as-label');
    if (namedLabel && namedLabel !== label) {
      namedLabel.textContent = namedLabel.dataset.label;
      namedLabel.classList.remove('is-name');
      namedLabel.closest('.as-group, .as-heroes').style.width = '';
    }
    namedLabel = label || null;
    if (!label) return;
    // Hold the block at its current width while the name shows: a group
    // that sizes to its content (Siege) would otherwise grow to fit a long
    // name like "Log Launcher" and shove its neighbour. The label's
    // ellipsis cuts the name off at the counts instead.
    if (!label.classList.contains('is-name')) block.style.width = block.getBoundingClientRect().width + 'px';
    label.textContent = tile.dataset.name;
    label.classList.add('is-name');
  }
  // Rows that overflow get an edge fade on whichever side has more to
  // scroll to (.more-l / .more-r). A ResizeObserver also catches rows on
  // hidden pages becoming visible.
  // Empty places: darker boxes after the last unit, showing where the next
  // one would go. They fill whatever width the row has left (or, with
  // data-slots, up to that many places) and never make a row scroll.
  // The row's width never depends on them, so refilling on resize can't
  // loop. OVERLAP matches the tiles' negative margin in th-layouts.css.
  var OVERLAP = 4;
  function fillRow(row) {
    [].slice.call(row.querySelectorAll('.as-ph')).forEach((p) => p.remove());
    var items = row.children;
    var slots = parseInt(row.dataset.slots, 10);
    var n;
    if (slots) n = slots - items.length;
    else {
      var probe = document.createElement('span');
      probe.className = 'as-tile as-ph';
      row.appendChild(probe);
      var tile = probe.offsetWidth;
      probe.remove();
      if (!tile) return; // row not laid out (card on another page)
      var step = tile - OVERLAP;
      var last = items[items.length - 1];
      // place k's right edge: after units, lastRight + k*step; in an empty
      // row, k*step + OVERLAP (the first place has no overlap).
      var start = last ? last.getBoundingClientRect().right - row.getBoundingClientRect().left + row.scrollLeft : OVERLAP;
      n = Math.floor((row.clientWidth - start) / step);
    }
    for (var i = 0; i < n; i++) {
      var ph = document.createElement('span');
      ph.className = 'as-tile as-ph';
      ph.setAttribute('aria-hidden', 'true');
      row.appendChild(ph);
    }
  }
  function edgeFade(row) {
    var max = row.scrollWidth - row.clientWidth;
    row.classList.toggle('more-l', max > 1 && row.scrollLeft > 1);
    row.classList.toggle('more-r', max > 1 && row.scrollLeft < max - 1);
  }
  var ro =
    'ResizeObserver' in window
      ? new ResizeObserver(function (es) {
          es.forEach(function (e) {
            if (e.target.classList.contains('as-row')) fillRow(e.target);
            edgeFade(e.target);
          });
        })
      : null;
  var docWired = false;
  function wireSheets(root) {
    root.querySelectorAll('.as-row, .as-hero-row').forEach(function (row) {
      if (row.dataset.wired) return;
      row.dataset.wired = '1';
      row.addEventListener('scroll', () => edgeFade(row), { passive: true });
      if (ro) ro.observe(row);
      else {
        if (row.classList.contains('as-row')) fillRow(row);
        edgeFade(row);
      }
    });
    // A redrawn sheet takes the shown name away with its old nodes.
    if (namedLabel && !document.contains(namedLabel)) namedLabel = namedTile = null;
    if (root.dataset.sheetWired) return;
    root.dataset.sheetWired = '1';
    root.addEventListener('mouseover', function (e) {
      var t = e.target.closest('[data-name]');
      if (t) showName(t);
    });
    root.addEventListener('mouseout', function (e) {
      var t = e.target.closest('[data-name]');
      if (t && !t.contains(e.relatedTarget)) showName(null);
    });
    if (docWired) return;
    docWired = true;
    document.addEventListener('click', function (e) {
      showName(e.target.closest('.army-sheet [data-name]'));
    });
  }

  // Loading skeleton: the sheet's own layout (same classes, so the same
  // shape at every width) with grey shimmering blocks in place of the art.
  // opt.stack: the maker's arrangement. Replaced as soon as the army draws.
  function skeletonHtml(opt) {
    var blocks = (n) => '<span class="as-tile sk"></span>'.repeat(n);
    var hero = '<div class="as-hero as-empty"><div class="as-portrait sk"></div></div>';
    var head = (w) => `<div class="as-head"><span class="sk sk-line" style="width:${w}px"></span></div>`;
    var grp = (cls, w, n) => `<div class="as-group ${cls}">${head(w)}<div class="as-row">${blocks(n)}</div></div>`;
    return tidy`
      <div class="army-sheet is-skel${opt && opt.stack ? ' is-stack' : ''}" style="--slots:4" aria-hidden="true">
        <div class="as-heroes">${head(64)}<div class="as-hero-row">${hero.repeat(4)}</div></div>
        <div class="as-units">
          ${opt && opt.stack ? '' : grp('as-army', 60, 14)}
          ${grp('as-troops', 70, 12)}
          <div class="as-pair">${grp('as-spells', 54, 6)}${grp('as-sieges', 44, 3)}</div>
          ${grp('as-cc', 90, 8)}
        </div>
      </div>`;
  }

  var loading = null;
  window.ArmySheet = {
    skeleton: skeletonHtml,
    load: function () {
      if (!loading)
        loading = fetch(ARMY_DATA)
          .then((r) => r.json())
          .then(function (d) {
            units = indexUnits(d);
          });
      return loading;
    },
    html: sheetHtml,
    wire: wireSheets,
  };
})();

// ---- Layout cards + pages ---------------------------------------------
// Cards are built from the page's JSON (<div class="grid-container"
// data-layouts="/th18-layouts.json">), one per entry in "bases", in order,
// and shown PAGE_SIZE at a time. All the pages live in this one HTML file
// (th18-layouts2.html is only a redirect now): page 2 is ?page=2, so
// refresh keeps the page, Back returns to the previous one and page links
// can be shared. Changing page jumps to the very top. On phones the
// secondary top bar shows "Townhall 18 Layouts / Page 1/2" (#stbPage). A
// shared link to a base on another page (#base-th18-14) opens that page.
// Likes, CC popups and share are wired up once every card exists.
// Army pages (thNN-army.html) use the same builder: their grid has
// data-armies="thNN-army.json" instead, with an "armies" list, and each
// card gets a name row on top (armyCardHtml) and no CC button -- the army
// screenshot already shows the CC troops.
(function layoutCards() {
  var grid = document.querySelector('.grid-container[data-layouts], .grid-container[data-armies]');
  if (!grid || !window.fetch) return;
  var ARMY = grid.hasAttribute('data-armies');
  var SRC = grid.getAttribute(ARMY ? 'data-armies' : 'data-layouts');
  var PAGE_SIZE = 10;
  // Top-3 armies ("rank": 1-3 in the JSON) wear the Legend League I / II /
  // III badge beside their name.
  // Town Hall icons (icons/thNNicon.webp; TH18's is a png), shown before
  // every army's name.
  function thIcon(th) {
    return '/icons/th' + th + 'icon.' + (th === 18 ? 'png' : 'webp');
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  var HEART =
    '<svg viewBox="0 0 24 24" class="like-heart" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>';
  var SHARE =
    '<svg viewBox="0 0 24 24" class="bar-ico" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>';
  // Pen (Lucide "pencil-line", ISC licence): the army card's "edit in the
  // army maker" link, top-right of the card.
  var PEN =
    '<svg viewBox="0 0 24 24" class="bar-ico" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  // Town Halls the army maker (/coc/tools/army-maker) supports -- keep in step
  // with enabledTh in coc-army-data.json. Army cards on these TH pages get
  // the pen; add a TH here when the maker gets it.
  var MAKER_TH = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  // Template tag: builds the string, then drops the whitespace between tags.
  function tidy(strings) {
    var out = strings[0];
    for (var i = 1; i < strings.length; i++) out += arguments[i] + strings[i];
    return out.replace(/>\s+</g, '><').trim();
  }
  function arrow(d) {
    return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${d}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  // Recommended CC rows. The JSON stores plain text ("3 Ice Golem",
  // "10 Archers"); each row shows the troop's picture from
  // clashofclans/coctools/units/ (file = singular name, dashed:
  // ice-golem.webp), the name in the singular, and the count as "x3".
  // A troop with no picture just shows its name. "NA" / empty = none.
  function ccRows(list) {
    var items = (list || []).filter(function (t) {
      return t && t !== 'NA';
    });
    if (!items.length) return '<li class="ccp-empty">No troops listed for this base.</li>';
    return items
      .map(function (t) {
        var m = /^(\d+)\s+(.+)$/.exec(String(t).trim());
        var qty = m ? m[1] : '';
        var name = (m ? m[2] : String(t)).trim();
        var single = /ches$/i.test(name) ? name.slice(0, -2) : /[^s]s$/i.test(name) ? name.slice(0, -1) : name;
        var file = '/clashofclans/coctools/units/' + single.toLowerCase().replace(/\s+/g, '-') + '.webp';
        return (
          '<li><span class="ccp-ico"><img src="' +
          esc(file) +
          '" alt="" loading="lazy" decoding="async" onerror="this.parentNode.remove()"></span>' +
          '<span class="ccp-name">' +
          esc(single) +
          '</span>' +
          (qty ? '<span class="ccp-qty"><span aria-hidden="true">&times;</span>' + esc(qty) + '</span>' : '') +
          '</li>'
        );
      })
      .join('');
  }

  function cardHtml(page, b) {
    var id = 'th' + page.th + '-' + b.id;
    var cc = ccRows(b.cc);
    // Indented here for reading; the whitespace between tags is stripped
    // so the built card is exactly the old hand-written markup.
    return tidy`
      <div class="discord-card" id="base-${id}">
        <div class="card-media sk">
          <img src="${esc(page.imageDir + b.image)}" alt="TH${page.th} base layout ${b.id}" class="zoomable" loading="lazy" onclick="openPalette(this)" onload="this.parentNode.classList.remove('sk')" onerror="this.parentNode.classList.remove('sk')">${b.new ? '<span class="new-tag">New</span>' : ''}
          <button type="button" class="th-cc" aria-expanded="false" aria-label="Show recommended clan castle troops" title="Recommended CC"><img src="${esc(page.icon)}" alt="" decoding="async"></button>
          <div class="cc-popup" role="dialog" aria-label="Recommended clan castle troops"><div class="ccp-head"><span class="ccp-title">Clan Castle</span><span class="ccp-note">Recommended</span></div><ul class="ccp-list">${cc}</ul></div>
        </div>
        <div class="action-row card-bar">
          <button type="button" class="corner-like" data-layout-id="${id}" aria-pressed="false" aria-label="Like this base" title="Like this base">${HEART}<span class="like-count" data-layout-count hidden>0</span></button>
          <a class="layout-link" href="${esc(b.link)}" target="_blank" rel="noopener noreferrer" title="Open this base in Clash of Clans">Copy Layout</a>
          <button type="button" class="card-share" data-share="base-${id}" aria-label="Share this base" title="Share this base">${SHARE}</button>
        </div>
      </div>`;
  }

  // Army card: the layout card plus a name row above the army (the army's
  // Town Hall icon, its name, and a "#1" pill for the top 3), Copy Army
  // instead of Copy Layout, no CC.
  function armyCardHtml(page, a) {
    var id = 'th' + page.th + '-' + a.id;
    var th = +page.th;
    var badge = `<img class="army-rank" src="${thIcon(th)}" alt="" title="Town Hall ${th}" width="28" height="28" onerror="this.remove()">`;
    var tag = a.rank >= 1 && a.rank <= 3 ? `<span class="army-rank-tag" title="Rank ${a.rank}">#${a.rank}</span>` : '';
    // Pen: opens the army maker with this army already in it. The maker
    // reads the army from its address (?army=...), so the link just carries
    // this card's army code over -- nothing to copy or paste.
    var code = '';
    try {
      code = new URL(a.link).searchParams.get('army') || '';
    } catch (e) {}
    var edit =
      code && MAKER_TH.indexOf(page.th) !== -1
        ? `<a class="army-edit" href="/coc/tools/army-maker?th=${page.th}&amp;army=${encodeURIComponent(code)}" aria-label="Edit ${esc(a.name)} in the army maker" title="Edit in the army maker">${PEN}</a>`
        : '';
    // Drawn army; falls back to the old screenshot if the unit data didn't
    // load or the link has no readable army code.
    var sheet = window.ArmySheet.html(page.th, code);
    return tidy`
      <div class="discord-card army-card" id="army-${id}">
        <div class="army-head">${badge}<h3 class="army-name">${esc(a.name)}</h3>${tag}${edit}</div>
        <div class="card-media${sheet ? ' has-sheet' : ''}">
          ${sheet || (a.image ? `<img src="${esc(page.imageDir + a.image)}" alt="TH${page.th} ${esc(a.name)} army" class="zoomable" loading="lazy" onclick="openPalette(this)">` : '')}
        </div>
        <div class="action-row card-bar">
          <button type="button" class="corner-like" data-layout-id="${id}" aria-pressed="false" aria-label="Like this army" title="Like this army">${HEART}<span class="like-count" data-layout-count hidden>0</span></button>
          <a class="layout-link" href="${esc(a.link)}" target="_blank" rel="noopener noreferrer" title="Open this army in Clash of Clans">Copy Army</a>
          <button type="button" class="card-share" data-share="army-${id}" aria-label="Share this army" title="Share this army">${SHARE}</button>
        </div>
      </div>`;
  }

  // Army pages also need the unit data to draw each army; if it fails to
  // load, the cards fall back to their screenshots.
  var unitData = ARMY ? window.ArmySheet.load().catch(function () {}) : Promise.resolve();

  // While the army list and unit data load: four skeleton cards, shaped
  // like the real ones (name row, army sheet, button bar), so the page
  // doesn't sit blank. Swapped out the moment the cards are built.
  if (ARMY && !grid.children.length) {
    var skel = tidy`
      <div class="discord-card army-card is-skel-card" aria-hidden="true">
        <div class="army-head"><span class="sk sk-dot"></span><span class="sk sk-line sk-name"></span></div>
        <div class="card-media has-sheet">${window.ArmySheet.skeleton()}</div>
        <div class="sk sk-bar"></div>
      </div>`;
    grid.innerHTML = skel.repeat(4);
    grid.setAttribute('aria-busy', 'true');
  }
  // Layouts pages: the same idea -- a 16:9 block where the base's
  // screenshot goes and the three buttons under it. 10 = one page.
  if (!ARMY && !grid.children.length) {
    grid.innerHTML =
      '<div class="discord-card is-skel-card" aria-hidden="true"><div class="card-media sk sk-shot"></div><div class="action-row card-bar"><span class="sk"></span><span class="sk sk-copy"></span><span class="sk"></span></div></div>'.repeat(
        10,
      );
    grid.setAttribute('aria-busy', 'true');
  }

  // cache: 'no-cache' -- the browser checks for a newer copy every time
  // (cheap: an unchanged file comes back as "not modified"). A copy saved
  // before the Oct 2026 folder move had imageDir "clashofclans/th13layouts/"
  // with no leading "/", which from /coc/town-hall-13/ points at a folder
  // that doesn't exist -- every base image 404'd. The imageDir fix below
  // covers any such copy still around.
  Promise.all([fetch(SRC, { cache: 'no-cache' }).then((r) => r.json()), unitData])
    .then((res) => res[0])
    .then(function (page) {
      if (page.imageDir && !/^(\/|https?:)/.test(page.imageDir)) page.imageDir = '/' + page.imageDir;
      grid.removeAttribute('aria-busy');
      grid.innerHTML = ARMY
        ? (page.armies || []).map((a) => armyCardHtml(page, a)).join('')
        : (page.bases || []).map((b) => cardHtml(page, b)).join('');
      if (ARMY) window.ArmySheet.wire(grid);
      var cards = [].slice.call(grid.children);
      var pages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
      var nav = document.getElementById('layout-pages');
      var crumb = document.getElementById('stbPage');
      var heroPage = document.getElementById('t18Page'); // "Page 1 of 2" after the banner title
      var current = 0;

      function pageFromUrl() {
        var n = parseInt(new URLSearchParams(location.search).get('page'), 10);
        return n >= 1 && n <= pages ? n : 1;
      }
      // Page 1 is the plain address; later pages add ?page=N.
      function urlFor(n) {
        var q = new URLSearchParams(location.search);
        if (n > 1) q.set('page', n);
        else q.delete('page');
        var qs = q.toString();
        return location.pathname + (qs ? '?' + qs : '');
      }
      function navHtml() {
        var h = '';
        if (current > 1) h += `<a href="${urlFor(current - 1)}" class="prev" data-page="${current - 1}">${arrow('M15 5l-7 7 7 7')}Prev</a>`;
        for (var i = 1; i <= pages; i++) {
          h +=
            i === current
              ? `<a href="${urlFor(i)}" class="page active" data-page="${i}" aria-current="page">${i}</a>`
              : `<a href="${urlFor(i)}" class="page" data-page="${i}">${i}</a>`;
        }
        if (current < pages)
          h += `<a href="${urlFor(current + 1)}" class="next" data-page="${current + 1}">Next${arrow('M9 5l7 7-7 7')}</a>`;
        return h;
      }
      function show(n) {
        current = n;
        cards.forEach(function (c, i) {
          c.hidden = Math.floor(i / PAGE_SIZE) + 1 !== n;
        });
        if (nav) {
          nav.innerHTML = navHtml();
          nav.parentElement.hidden = pages < 2;
        }
        if (crumb) crumb.textContent = pages > 1 ? 'Page ' + n + ' of ' + pages : '';
        // The phone breadcrumb's last step, always shown ("Page 1 of 1" too).
        // thz-script.js builds the trail and may run before or after this,
        // so the text is also kept on <html data-page-label> for it to pick up
        // (a different name from the marker below, or this would match <html>).
        var pageText = 'Page ' + n + ' of ' + pages;
        document.documentElement.dataset.pageLabel = pageText;
        document.querySelectorAll('[data-crumb-page]').forEach(function (c) {
          c.textContent = pageText;
          c.parentNode.hidden = false;
        });
        if (heroPage && pages > 1) {
          heroPage.textContent = 'Page ' + n + ' of ' + pages;
          heroPage.hidden = false;
        }
      }
      // Desktop scrolls .coc-main, phones scroll the page itself: reset
      // both. Instant, not smooth -- the cards have already changed.
      function toTop() {
        var main = document.querySelector('.coc-main');
        if (main) {
          main.style.scrollBehavior = 'auto';
          main.scrollTop = 0;
          main.style.scrollBehavior = '';
        }
        window.scrollTo({ top: 0, behavior: 'instant' });
      }

      if (nav) {
        nav.addEventListener('click', function (e) {
          var a = e.target.closest('a[data-page]');
          if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return; // new-tab clicks follow the link
          e.preventDefault();
          var n = +a.getAttribute('data-page');
          if (n === current) return;
          history.pushState({ page: n }, '', urlFor(n));
          show(n);
          toTop();
        });
      }
      // Back / Forward between pages. Hash links (#events-section) fire
      // this too, so only act when the page number actually changed.
      window.addEventListener('popstate', function () {
        var n = pageFromUrl();
        if (n !== current) {
          show(n);
          toTop();
        }
      });
      // For share links: switch to whichever page holds this card.
      function showCard(card) {
        var n = Math.floor(cards.indexOf(card) / PAGE_SIZE) + 1;
        if (n === current) return;
        history.replaceState(null, '', urlFor(n) + location.hash);
        show(n);
      }
      show(pageFromUrl());

      // Like counts: one Firestore doc per page, named after the file
      // (layoutLikes/th18-layouts, layoutLikes/th18-army), keyed by each
      // card's data-layout-id -- so army and layout likes never mix.
      initLayoutLikes('th' + page.th + (ARMY ? '-army' : '-layouts'), ARMY ? 'army' : 'base');
      if (!ARMY) initCcPopups();
      initCardShare(ARMY ? 'TH' + page.th + ' army comp on Parchrome' : 'TH' + page.th + ' base layout on Parchrome', showCard);
    })
    .catch(function (err) {
      console.error('Layout cards: failed to load ' + SRC, err);
      // Don't leave the skeleton shimmering forever.
      if (grid.getAttribute('aria-busy')) {
        grid.removeAttribute('aria-busy');
        grid.innerHTML =
          '<p class="sk-fail">The ' + (ARMY ? 'armies' : 'base layouts') + ' could not load. Refresh the page to try again.</p>';
      }
    });
})();

// noun: 'base' or 'army', for the button's label ("Like this army").
function initLayoutLikes(pageId, noun) {
  noun = noun || 'base';
  const firebaseConfig = {
    apiKey: 'AIzaSyAa8B5rIP0Y9w9jBN_mzKzkFW3xMdI9wgo',
    authDomain: 'parchrome-feedback.firebaseapp.com',
    projectId: 'parchrome-feedback',
    storageBucket: 'parchrome-feedback.firebasestorage.app',
    messagingSenderId: '546895020356',
    appId: '1:546895020356:web:f145067c0b71dde2341711',
  };
  // / already calls firebase.initializeApp() if it's ever loaded
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
    const label = (liked ? 'Unlike this ' : 'Like this ') + noun + (n > 0 ? ' (' + n + (n === 1 ? ' like)' : ' likes)') : '');
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

// Share button on each card. Shares the card's GAME link -- the same
// link.clashofclans.com link its Copy Layout / Copy Army button opens -- so
// the person receiving it loads the base or army in one tap (Adrian's call,
// Sep 2026; it used to share this page with #base-th18-3 on the end).
// Known trade-off: game links can't open inside Facebook / Messenger /
// Discord's built-in browsers (see the FAQ), and the preview is Supercell's.
//  - Touch devices: the phone's own share sheet (navigator.share), which
//    lists whatever apps that person has.
//  - Desktop (or no share sheet): one small panel with Copy link and four
//    share links. Discord has no web share link, so "Copy link" covers it.
// Old #base-/#army- page links still work: highlight() below handles them.
function initCardShare(title, showCard) {
  var btns = document.querySelectorAll('.card-share[data-share]');
  if (!btns.length) return;

  // App logos: Simple Icons (simpleicons.org, CC0) paths, filled in each
  // brand's colour via .sp-brand in th-layouts.css.
  function brand(name, d) {
    return '<svg viewBox="0 0 24 24" class="sp-brand sp-' + name + '" aria-hidden="true"><path d="' + d + '"/></svg>';
  }
  var ICONS = {
    link: '<svg viewBox="0 0 24 24" class="bar-ico" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    facebook: brand(
      'facebook',
      'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
    ),
    x: brand(
      'x',
      'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z',
    ),
    reddit: brand(
      'reddit',
      'M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z',
    ),
    whatsapp: brand(
      'whatsapp',
      'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
    ),
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
    ICONS.facebook +
    'Facebook</a>' +
    '<a role="menuitem" target="_blank" rel="noopener noreferrer" data-to="x">' +
    ICONS.x +
    'X</a>' +
    '<a role="menuitem" target="_blank" rel="noopener noreferrer" data-to="reddit">' +
    ICONS.reddit +
    'Reddit</a>' +
    '<a role="menuitem" target="_blank" rel="noopener noreferrer" data-to="whatsapp">' +
    ICONS.whatsapp +
    'WhatsApp</a>';
  var copyBtn = panel.querySelector('.sp-copy');
  var openBtn = null;
  var TITLE = title;

  // The card's game link: the href of its Copy Layout / Copy Army button.
  function gameLink(btn) {
    return btn.closest('.discord-card').querySelector('.layout-link').href;
  }
  function close() {
    panel.hidden = true;
    if (openBtn) {
      openBtn.setAttribute('aria-expanded', 'false');
      openBtn = null;
    }
  }
  function open(btn) {
    var url = gameLink(btn),
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
        navigator.share({ title: TITLE, url: gameLink(btn) }).catch(function () {});
        return;
      }
      if (openBtn === btn) close();
      else {
        close();
        open(btn);
      }
    });
  });

  // Copies silently, no popup. navigator.clipboard only exists on https://
  // (and localhost); on a plain http:// address -- e.g. testing from a
  // phone at 192.168.x.x -- it's missing, so fall back to the older
  // select-a-hidden-textarea + execCommand('copy'), which works anywhere.
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length); // iOS ignores select() alone
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {}
    ta.remove();
    return ok;
  }
  copyBtn.addEventListener('click', function () {
    var url = copyBtn.dataset.url;
    function done(ok) {
      copyBtn.classList.toggle('copied', ok);
      copyBtn.querySelector('span').textContent = ok ? 'Link copied' : "Couldn't copy";
      setTimeout(close, ok ? 900 : 1600);
    }
    if (navigator.clipboard && window.isSecureContext)
      navigator.clipboard.writeText(url).then(
        function () {
          done(true);
        },
        function () {
          done(legacyCopy(url));
        },
      );
    else done(legacyCopy(url));
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
    if (!/^(base|army)-/.test(id)) return;
    var card = document.getElementById(id);
    if (!card) return;
    if (card.hidden) showCard(card); // a base on another page
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
