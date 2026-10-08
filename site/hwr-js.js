// Page key used by every lookup below: the full path without .html or a
// trailing slash, e.g. "/web-resources/anime". hwr-categories.json and the
// page->category tables are keyed the same way, so they compare equal.
function hwrPageKey(u) {
  var p = new URL(String(u || ''), location.origin + '/').pathname.toLowerCase();
  return p.replace(/\.html$/, '').replace(/\/index$/, '/').replace(/(.)\/$/, '$1');
}
// obj[key] where key is compared as a page path (so "/web-resources/anime" finds
// a "/web-resources/anime/" or ".html" key too).
function hwrLookup(obj, u) {
  if (!obj) return undefined;
  var want = hwrPageKey(u == null ? location.pathname : u);
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && hwrPageKey(k) === want) return obj[k];
  return undefined;
}

try {

    // Shared helper for both popups below (info + settings). Their
    // trigger buttons live inside .secondary-top-bar, which is
    // position:fixed with its own z-index:15 (11layout.css) — that makes
    // it a separate stacking context, so no z-index we give the panel
    // while it's still nested inside that bar can ever put it above
    // .stb-dd-overlay once the overlay's z-index is raised above the bar
    // (needed so the overlay can also dim/blur .bn-bar, the bottom nav,
    // which sits at z-index:99980). The fix: move the panel itself out
    // to a position:fixed direct child of <body> right when it opens,
    // with inline top/right computed from the trigger button's actual
    // on-screen position — visually it stays exactly where it always
    // was, but it's no longer trapped inside the low z-index bar, so its
    // own (much higher) z-index actually wins against the overlay.
    function stbDetachDropdownPanel(panel, wrap) {
      function reposition() {
        var r = wrap.getBoundingClientRect();
        panel.style.top = (r.bottom + 10) + 'px';
        panel.style.right = (window.innerWidth - r.right - 4) + 'px';
      }
      if (!panel.dataset.stbDetached) {
        panel.dataset.stbDetached = '1';
        document.body.appendChild(panel);
        window.addEventListener('resize', reposition);
        window.addEventListener('orientationchange', reposition);
      }
      // Recompute every time it opens (not just the first time) — the
      // button's on-screen position can change between opens, e.g. from
      // a window resize that happened while the panel was closed.
      reposition();
    }

    // Lightweight scroll lock shared by the info + settings popovers.
    // Deliberately NOT reusing bnLockScroll/bnUnlockScroll (the bottom-nav
    // "More" sheet's lock) — that one also forces body to height:100%
    // (via the .no-scroll CSS class), which is fine for a full-screen
    // sheet but fights this page's own scroll model switch: mobile
    // scrolls the whole document with body at height:auto, desktop
    // scrolls .coc-main internally with body pinned to a fixed height via
    // flex. Forcing height:100% mid-interaction flips how .coc-main's
    // flex sizing resolves and visibly reflows content under these small
    // popovers.
    //
    // Toggling `overflow:hidden` directly on html/body isn't safe either
    // on its own — most browsers reset that element's scrollTop to 0 the
    // instant overflow goes from scrollable to hidden, which is the
    // "jumps to the top" behavior. So instead: freeze body in place with
    // position:fixed and a negative top equal to the current scroll
    // offset (the standard body-scroll-lock technique) — no height is
    // set, so .coc-main's flex sizing is untouched, and nothing ever
    // resets scrollTop because we're not toggling overflow on the
    // scrolling root at all.
    var stbScrollLockY = 0;

    // Blocks wheel/touch scrolling on .coc-main without ever touching its
    // scrollTop or overflow. Kept as a named function so lock/unlock can
    // add and remove the exact same listener.
    function stbBlockScroll(e) {
      e.preventDefault();
    }

    function stbLockScroll() {
      stbScrollLockY = window.pageYOffset || document.documentElement.scrollTop || 0;
      // Marker class only — no CSS of its own. This is what 11layout.js's
      // pull-to-refresh guard (modalScrollLocked()) checks for, so a swipe
      // down anywhere on screen (including over the detached dropdown panel
      // or the dimmed overlay) while this is open is recognized as "a modal
      // owns scrolling right now" instead of being misread as "at the top
      // of the page" and triggering a reload. Deliberately its own class
      // rather than reusing html.no-scroll (see the comment above this
      // function for why that class's own CSS side effects don't fit here).
      document.body.classList.add('stb-dd-scroll-locked');
      // Compensate for the scrollbar disappearing (position:fixed removes
      // body from the scrollable flow), same as bnLockScroll does, so
      // width:100% elements don't snap wider.
      var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) document.body.style.paddingRight = scrollbarWidth + 'px';
      document.body.style.position = 'fixed';
      document.body.style.top = (-stbScrollLockY) + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      // Body being position:fixed already stops normal page scrolling, but
      // on mobile Chrome/Safari a downward swipe at the top of the viewport
      // still triggers the browser's native "pull to refresh" gesture —
      // that's a viewport-level overscroll effect, not an element scroll,
      // so it isn't stopped by freezing body's position alone. Suppressing
      // overscroll at the html level is what actually blocks it. Restored
      // in stbUnlockScroll.
      document.documentElement.style.overscrollBehaviorY = 'none';
      var cocMain = document.querySelector('.coc-main');
      if (cocMain) {
        // Freezing .coc-main used to be `overflow: hidden`, but that clamps
        // its scrollTop to 0 the instant it's set — which 11layout.js's
        // bottom-nav auto-hide watcher (BOTTOM NAV AUTO-HIDE ON SCROLL,
        // which reads .coc-main.scrollTop on every scroll event) reads as
        // "scrolled all the way to the top" and reveals #bottomNav even
        // though nothing actually scrolled. Blocking wheel/touch instead
        // keeps the real scrollTop untouched the whole time this is open,
        // so that watcher never sees a false jump. { passive: false } is
        // required for preventDefault() to actually stop the scroll.
        cocMain.addEventListener('wheel', stbBlockScroll, { passive: false });
        cocMain.addEventListener('touchmove', stbBlockScroll, { passive: false });
      }
    }

    function stbUnlockScroll() {
      document.body.classList.remove('stb-dd-scroll-locked');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.paddingRight = '';
      document.documentElement.style.overscrollBehaviorY = '';
      var cocMain = document.querySelector('.coc-main');
      if (cocMain) {
        cocMain.removeEventListener('wheel', stbBlockScroll);
        cocMain.removeEventListener('touchmove', stbBlockScroll);
      }
      window.scrollTo(0, stbScrollLockY);
    }

    // Info dropdown (secondary top bar "i" button) — simple open/close,
    // dismiss on outside click or Escape, matches the other lightweight
    // toggles on this page.
    (function initStbInfoDropdown() {
      var btn = document.getElementById('stbInfoBtn');
      var dropdown = document.getElementById('stbInfoDropdown');
      var wrap = document.getElementById('stbInfoDropdownWrap');
      var ddOverlay = document.getElementById('stbDdOverlay');
      if (!btn || !dropdown || !wrap) return;

      function isOpen() {
        return dropdown.classList.contains('is-open');
      }

      function openDropdown() {
        stbDetachDropdownPanel(dropdown, wrap);
        dropdown.classList.add('is-open');
        dropdown.setAttribute('aria-hidden', 'false');
        btn.setAttribute('aria-expanded', 'true');
        if (ddOverlay) ddOverlay.classList.add('open');
        stbLockScroll();
      }

      function closeDropdown() {
        // No-op if not actually open — this also gets called unconditionally
        // by the *other* popover's open handler to enforce "only one open at
        // a time" even when this one was never open, so it must not perform
        // any side effects (like unlocking scroll it never locked) in that case.
        if (!isOpen()) return;
        dropdown.classList.remove('is-open');
        dropdown.setAttribute('aria-hidden', 'true');
        btn.setAttribute('aria-expanded', 'false');
        if (ddOverlay) ddOverlay.classList.remove('open');
        stbUnlockScroll();
      }

      // Exposed so the Settings dropdown (below) can close this one when
      // it opens — the two are mutually exclusive, only one popover shows
      // at a time.
      window.closeStbInfoDropdown = closeDropdown;

      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isOpen()) {
          closeDropdown();
        } else {
          // Close the other popover first so only one is ever open —
          // stopPropagation() above means its own outside-click listener
          // would never otherwise hear about this click.
          if (window.closeStbSettingsDropdown) window.closeStbSettingsDropdown();
          openDropdown();
        }
      });

      document.addEventListener('click', function(e) {
        // dropdown itself is detached to a direct child of <body> when it
        // opens (see stbDetachDropdownPanel), so it's no longer inside
        // wrap — check both so clicks inside the open panel don't count
        // as "outside".
        if (isOpen() && !wrap.contains(e.target) && !dropdown.contains(e.target)) closeDropdown();
      });

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isOpen()) closeDropdown();
      });
    })();

    // Browse Settings dropdown — same open/close pattern as the info
    // dropdown above. Every control inside just proxies to its existing
    // counterpart in the desktop sidebar's Browse Settings card (clicking
    // it / dispatching a change event on it), so there's exactly one
    // source of truth for view mode, sort order, etc. — this panel is
    // just a second, roomier way to reach the same state, kept in sync
    // by re-reading those original elements every time something changes.
    (function initStbSettingsDropdown() {
      var btn = document.getElementById('stbSettingsBtn');
      var dropdown = document.getElementById('stbSettingsDropdown');
      var wrap = document.getElementById('stbSettingsDropdownWrap');
      var ddOverlay = document.getElementById('stbDdOverlay');
      if (!btn || !dropdown || !wrap) return;

      var listBtn = document.getElementById('settingsViewListBtn');
      var boxBtn = document.getElementById('settingsViewBoxBtn');
      var sortSelect = document.getElementById('settingsSortSelect');
      var bookmarkToggle = document.getElementById('settingsBookmarkToggle');
      var flatToggle = document.getElementById('settingsFlatToggle');

      function isOpen() {
        return dropdown.classList.contains('is-open');
      }

      function syncSettingsUI() {
        var origList = document.getElementById('viewModeListBtn');
        var origBox = document.getElementById('viewModeBoxBtn');
        if (listBtn && origList) listBtn.classList.toggle('is-active', origList.classList.contains('is-active'));
        if (boxBtn && origBox) boxBtn.classList.toggle('is-active', origBox.classList.contains('is-active'));

        var origSort = document.getElementById('sortOrderSelect');
        if (sortSelect && origSort) {
          sortSelect.value = origSort.value;
        }

        var origBookmark = document.getElementById('bookmarkOnlyToggle');
        if (bookmarkToggle && origBookmark) {
          var bmActive = origBookmark.classList.contains('is-active');
          bookmarkToggle.classList.toggle('is-active', bmActive);
          bookmarkToggle.setAttribute('aria-checked', bmActive);
        }

        var origFlat = document.getElementById('flatViewToggle');
        if (flatToggle && origFlat) {
          var flatActive = origFlat.classList.contains('is-active');
          flatToggle.classList.toggle('is-active', flatActive);
          flatToggle.setAttribute('aria-checked', flatActive);
        }
      }

      function openDropdown() {
        syncSettingsUI();
        if (window.hwrRefreshStbSettingsBookmarks) window.hwrRefreshStbSettingsBookmarks();
        stbDetachDropdownPanel(dropdown, wrap);
        dropdown.classList.add('is-open');
        dropdown.setAttribute('aria-hidden', 'false');
        btn.setAttribute('aria-expanded', 'true');
        if (ddOverlay) ddOverlay.classList.add('open');
        stbLockScroll();
      }

      function closeDropdown() {
        // No-op if not actually open — this also gets called unconditionally
        // by the *other* popover's open handler to enforce "only one open at
        // a time" even when this one was never open, so it must not perform
        // any side effects (like unlocking scroll it never locked) in that case.
        if (!isOpen()) return;
        dropdown.classList.remove('is-open');
        dropdown.setAttribute('aria-hidden', 'true');
        btn.setAttribute('aria-expanded', 'false');
        if (ddOverlay) ddOverlay.classList.remove('open');
        stbUnlockScroll();
      }

      // Exposed so a click on one of the "On This Page" TOC rows inside
      // this same dropdown (see hwrScrollToTocFromSettings, wired once
      // those rows are built further down the page) can close the panel
      // itself before the smooth-scroll to that section starts.
      window.closeStbSettingsDropdown = closeDropdown;

      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isOpen()) {
          closeDropdown();
        } else {
          // Close the other popover first so only one is ever open —
          // stopPropagation() above means its own outside-click listener
          // would never otherwise hear about this click.
          if (window.closeStbInfoDropdown) window.closeStbInfoDropdown();
          openDropdown();
        }
      });

      document.addEventListener('click', function(e) {
        // dropdown itself is detached to a direct child of <body> when it
        // opens (see stbDetachDropdownPanel), so it's no longer inside
        // wrap — check both so clicks inside the open panel don't count
        // as "outside".
        if (isOpen() && !wrap.contains(e.target) && !dropdown.contains(e.target)) closeDropdown();
      });

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isOpen()) closeDropdown();
      });

      if (listBtn) listBtn.addEventListener('click', function() {
        var orig = document.getElementById('viewModeListBtn');
        if (orig) orig.click();
        syncSettingsUI();
      });
      if (boxBtn) boxBtn.addEventListener('click', function() {
        var orig = document.getElementById('viewModeBoxBtn');
        if (orig) orig.click();
        syncSettingsUI();
      });

      if (sortSelect) sortSelect.addEventListener('change', function() {
        var origSort = document.getElementById('sortOrderSelect');
        if (!origSort) return;
        origSort.value = sortSelect.value;
        origSort.dispatchEvent(new Event('change'));
        syncSettingsUI();
      });

      if (bookmarkToggle) bookmarkToggle.addEventListener('click', function() {
        var orig = document.getElementById('bookmarkOnlyToggle');
        if (orig) orig.click();
        syncSettingsUI();
      });
      if (flatToggle) flatToggle.addEventListener('click', function() {
        var orig = document.getElementById('flatViewToggle');
        if (orig) orig.click();
        syncSettingsUI();
      });

      // Cards (and the sidebar's own controls) can finish loading/mounting
      // after this script runs — re-sync once that's settled so the panel
      // never opens showing stale defaults.
      document.addEventListener('websitesRendered', syncSettingsUI);
      // Instant sync no matter which UI (main filter bar, box-three sidebar,
      // or this dropdown itself) actually changed something — previously
      // this only refreshed when the dropdown was opened, so a toggle made
      // on the main filter bar while this stayed closed felt like it needed
      // a moment to "catch up" the next time you opened it.
      document.addEventListener('hwrBrowseSettingsSync', syncSettingsUI);
      syncSettingsUI();
    })();

    // "Bookmarks" card inside the mobile Browse Settings dropdown — a
    // fixed, non-adaptive counterpart to box-two's "Recently Bookmarked"
    // card (initBoxThreeBookmarks, further down the page). That desktop
    // version measures leftover sticky-sidebar height and grows/shrinks
    // its row count (1–6) to fit; this one has no such budget to fill
    // (the dropdown just scrolls internally), so it always renders a
    // flat cap of 3 most-recently-saved sites — never more, never fewer
    // once 3+ are saved — full stop. Mirrors window.HwrBookmarks the
    // same way, kept in sync via the same window.hwrRefreshBoxThreeBookmarks
    // call sites (see the bookmark-toggle button and resyncBookmarkButtons
    // further down) plus its own refresh on dropdown open/pageshow.
    (function initStbSettingsBookmarks() {
      var section = document.getElementById('stbSettingsBookmarksSection');
      if (!section) return;

      var grid = document.getElementById('stbSettingsBookmarksGrid');
      var totalEl = document.getElementById('stbSettingsBookmarksTotal');
      var emptyEl = document.getElementById('stbSettingsBookmarksEmpty');
      var viewAllBtn = document.getElementById('stbSettingsBookmarksViewAll');
      var MAX_ROWS = 3;

      function renderRow(site) {
        var name = site.name || 'Untitled';
        var initial = name.trim().charAt(0).toUpperCase() || '?';
        var sub = site.sub ? ' \u2014 ' + site.sub : '';
        return '<a href="' + site.link + '" target="_blank" rel="noopener noreferrer" ' +
          'class="stb-toc-card" title="' + name + sub + '">' +
          '<span class="stb-toc-icon b3-bookmark-icon" data-fallback="' + initial + '">' +
          '<img src="' + site.icon + '" alt="" loading="lazy" ' +
          'onerror="var p=this.parentElement;p.classList.add(\'web-icon-fallback\');p.textContent=p.dataset.fallback;this.remove();">' +
          '</span>' +
          '<span class="stb-toc-name">' + name + '</span>' +
          '</a>';
      }

      function refresh() {
        if (!window.HwrBookmarks) return;
        var saved = window.HwrBookmarks.getBookmarks();
        var count = saved.length;

        if (totalEl) totalEl.textContent = count + ' saved';

        if (!count) {
          if (grid) grid.innerHTML = '';
          if (emptyEl) emptyEl.style.display = '';
          if (viewAllBtn) viewAllBtn.style.display = 'none';
          return;
        }

        // Always exactly MAX_ROWS (or however many exist below that),
        // most-recently-saved first — no vh measuring, no trimming.
        var cap = Math.min(count, MAX_ROWS);
        var mostRecent = saved.slice(-cap).reverse();
        if (grid) {
          grid.innerHTML = mostRecent.map(renderRow).join('');
          // The inline onerror in renderRow only catches a failed request.
          // Google's favicon service answers 200 with a generic 16x16 globe
          // for domains it has no icon for, so the letter fallback has to be
          // triggered by size on load as well -- that's what HwrIcons adds.
          if (window.HwrIcons) {
            window.HwrIcons.watchAll(grid, '.b3-bookmark-icon img', 'web-icon-fallback', 'parent', 'data-fallback');
          }
        }
        if (emptyEl) emptyEl.style.display = 'none';
        if (viewAllBtn) viewAllBtn.style.display = '';
      }

      if (viewAllBtn) {
        viewAllBtn.addEventListener('click', function() {
          localStorage.setItem('hwr_bookmark_only', '1');
          window.location.href = '/web-resources/';
        });
      }

      window.hwrRefreshStbSettingsBookmarks = refresh;
      window.addEventListener('pageshow', refresh);
      document.addEventListener('websitesRendered', refresh);
      refresh();

      // Safety net: on fast/cached navigations, 'websitesRendered' (and even
      // fonts.ready elsewhere on the page) can fire before the deferred
      // hwr-bookmarks.js has run, so refresh() bails on `!window.HwrBookmarks`
      // and nothing ever retries. DOMContentLoaded is guaranteed to fire
      // after ALL deferred scripts finish, so this always sees a real
      // window.HwrBookmarks.
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', refresh);
      } else {
        refresh();
      }
    })();
  } catch (err) {
  console.error('hwr-js.js block 0 failed:', err);
}


/* ==================== next block ==================== */

try {

          window.HwrCategoriesPromise = fetch('/hwr-categories.json').then(function(res) {
            return res.json();
          });

          // Shared here (rather than fetched again privately inside
          // loadWebsiteData() below) so more than one consumer can read
          // every site for every category from a single request:
          // loadWebsiteData() still uses it to fill THIS page's own
          // card lists, and renderCategoryNav()'s mobile "More" sheet
          // TOC counts (further down this file) use the cached
          // window.HwrWebsitesData array to count OTHER categories'
          // sections too, which have no card-list container on this
          // page to count via the DOM. Starting it here also means it
          // now loads in parallel with hwr-categories.json instead of
          // only after it resolves.
          window.HwrWebsitesPromise = fetch('/hwr-websites.json').then(function(res) {
            return res.json();
          }).catch(function(err) {
            console.error('Failed to load hwr-websites.json', err);
            throw err;
          });
        } catch (err) {
  console.error('hwr-js.js block 1 failed:', err);
}


/* ==================== next block ==================== */

try {

              // Populate the live per-category counts + running total inside the
              // nav panel once the site data has actually rendered, mirroring how
              // heroStatCount used to work — real numbers, not hardcoded ones.
              document.addEventListener('websitesRendered', function() {
                var total = 0;
                var categoryStats = []; // {title, count} — feeds the hero rotating stat strip below

                document.querySelectorAll('.nav-chip-count[data-count-for]').forEach(function(el) {
                  var list = document.getElementById(el.getAttribute('data-count-for'));
                  var n = list ? list.querySelectorAll('.web-item').length : 0;
                  total += n;
                  el.textContent = String(n);
                  if (n > 0) {
                    var nameEl = el.closest('.nav-chip');
                    nameEl = nameEl ? nameEl.querySelector('.nav-chip-name') : null;
                    if (nameEl) categoryStats.push({
                      title: nameEl.textContent.trim(),
                      count: n
                    });
                  }
                });
                // Mobile "More" sheet TOC (.stb-toc-card) mirrors the same section
                // counts as the desktop .nav-chip rows above — same data-count-for
                // lookup where it resolves to a real container, plus one extra
                // fallback these rows need that .nav-chip never does: this sheet's
                // dropdown also lists every OTHER category's sections (see
                // renderCategoryNav below), whose card-list containers live on a
                // different page and never exist in THIS page's DOM — getElementById
                // always misses for those, so count them straight out of the shared
                // hwr-websites.json data instead, via the data-cat/data-group each
                // badge was stamped with when it was built.
                document.querySelectorAll('.stb-toc-count[data-count-for]').forEach(function(el) {
                  var list = document.getElementById(el.getAttribute('data-count-for'));
                  var n;
                  if (list) {
                    n = list.querySelectorAll('.web-item').length;
                  } else {
                    var cat = el.getAttribute('data-cat');
                    var group = el.getAttribute('data-group');
                    var allSites = window.HwrWebsitesData;
                    n = (cat && group && allSites) ? allSites.filter(function(site) {
                      return site.cat === cat && site.group === group;
                    }).length : 0;
                  }
                  el.textContent = String(n);
                });
                var totalEl = document.getElementById('navToolsTotal');
                if (totalEl) totalEl.textContent = String(total);

                // Same total, mirrored onto the Browse Settings dropdown's own TOC
                // header (set to a section count as a placeholder before this event
                // fires — see PAGE SECTIONS above).
                var stbTotalEl = document.getElementById('stbSettingsTocTotal');
                if (stbTotalEl) stbTotalEl.textContent = total + (total === 1 ? ' item' : ' items');

                // Same total again, for the box-two sidebar panel's copy.
                var sbTwoTotalEl = document.getElementById('sbTwoTocTotal');
                if (sbTwoTotalEl) sbTwoTotalEl.textContent = total + (total === 1 ? ' item' : ' items');

                var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

                // ANIMATED COUNTER — "112 Resources" counts up from 0 instead of
                // just appearing. Runs once per page load; skipped (value set
                // immediately) under prefers-reduced-motion.
                var heroCountEl = document.getElementById('heroToolCount');
                if (heroCountEl) {
                  if (reduceMotion || !total) {
                    heroCountEl.textContent = String(total);
                  } else {
                    var startTime = null;
                    var duration = 1100; // ms
                    function tickCount(ts) {
                      if (startTime === null) startTime = ts;
                      var progress = Math.min((ts - startTime) / duration, 1);
                      // ease-out-ish curve so it starts fast and settles gently
                      var eased = 1 - Math.pow(1 - progress, 3);
                      heroCountEl.textContent = String(Math.round(eased * total));
                      if (progress < 1) window.requestAnimationFrame(tickCount);
                    }
                    window.requestAnimationFrame(tickCount);
                  }
                }

                // ROTATING STAT STRIP — cycles through real per-category counts,
                // e.g. "21 Text to Speech tools · 16 Audio Generation tools · …",
                // cross-fading one entry at a time. Built entirely from the counts
                // computed above (same source of truth as the nav-chip counts), so
                // it always matches whatever's actually on the page — no hardcoded
                // category list to keep in sync.
                var stripText = document.getElementById('heroStatStripText');
                if (stripText && categoryStats.length) {
                  // Longest-first reads a little better on first paint, but keep
                  // the original section order after that rather than re-sorting
                  // every category from scratch.
                  var idx = 0;

                  function renderStat(i) {
                    var stat = categoryStats[i];
                    stripText.innerHTML = '<strong>' + stat.count + '</strong> ' + stat.title + ' tool' + (stat.count === 1 ? '' : 's');
                  }
                  renderStat(0);
                  if (categoryStats.length > 1 && !reduceMotion) {
                    setInterval(function() {
                      idx = (idx + 1) % categoryStats.length;
                      stripText.classList.add('is-swapping');
                      setTimeout(function() {
                        renderStat(idx);
                        stripText.classList.remove('is-swapping');
                      }, 260);
                    }, 2800);
                  }
                }
              });

              // Hero parallax moved to 11layout.js so every section with a
              // .hero-section + .hero-bg-img/.hero-video banner gets the same effect.

              // Prefetch-on-hover: when a visitor hovers (or, on touch devices,
              // touches down on) a link to another page on this same site — Home,
              // Music, Gaming, Movies, "Leave site", etc. — start fetching that
              // page in the background via <link rel="prefetch">. By the time they
              // actually click, the next page is often already most of the way
              // loaded. Only targets same-site local pages (skips external tool
              // links, #anchor jumps, and javascript: handlers) via simple event
              // delegation, so it automatically covers any internal link already
              // on the page without needing to list them out individually.
              (function() {
                var prefetched = {};

                function isInternalPageLink(href) {
                  return href && href.charAt(0) !== '#' && href.indexOf('://') === -1 && href.indexOf('javascript:') !== 0;
                }

                function prefetchHref(href) {
                  if (prefetched[href]) return;
                  prefetched[href] = true;
                  var link = document.createElement('link');
                  link.rel = 'prefetch';
                  link.href = href;
                  document.head.appendChild(link);
                }

                function onPointer(e) {
                  var a = e.target.closest && e.target.closest('a[href]');
                  if (!a) return;
                  var href = a.getAttribute('href');
                  if (isInternalPageLink(href)) prefetchHref(href);
                }
                document.addEventListener('mouseover', onPointer, {
                  passive: true
                });
                // Touch devices never fire mouseover before a tap — touchstart still
                // lands a beat before the actual navigation, so it's worth the same.
                document.addEventListener('touchstart', onPointer, {
                  passive: true
                });
              })();

              // Scroll-spy: light up the row for whichever section is currently
              // scrolled into the top band of the viewport, like a live "you are
              // here" marker on a table of contents. Exposed as a function (instead
              // of an auto-running IIFE) because the .nav-chip rows it depends on
              // are now injected asynchronously by the PAGE SECTIONS script further
              // down — it gets called once those rows actually exist in the DOM.
              function initHwrScrollSpy() {
                // .stb-toc-card = mobile More-sheet TOC row. .nav-chip (desktop
                // sidebar "On This Page" row) is intentionally NOT included here
                // anymore — that panel no longer gets the live highlight. The
                // desktop dsn-chip hover popover picks up the live "current
                // section" id below instead (see applyDsnHoverCurrentState).
                var chips = Array.prototype.slice.call(document.querySelectorAll('.stb-toc-card'));
                if (!chips.length || typeof IntersectionObserver === 'undefined') return;
                var byId = {};
                chips.forEach(function(c) {
                  var id = c.getAttribute('href').slice(1);
                  (byId[id] = byId[id] || []).push(c);
                });
                var sections = Object.keys(byId)
                  .map(function(id) {
                    return document.getElementById(id);
                  })
                  .filter(Boolean);
                if (!sections.length) return;

                var current = null;

                function setCurrent(id) {
                  if (current === id) return;
                  if (current && byId[current]) byId[current].forEach(function(el) {
                    el.classList.remove('is-current');
                  });
                  current = id;
                  if (current && byId[current]) byId[current].forEach(function(el) {
                    el.classList.add('is-current');
                  });
                  // Shared with the desktop dsn-chip hover popover — it re-reads
                  // this whenever it opens instead of being observed directly,
                  // since its rows are rebuilt fresh on every hover. If the panel
                  // happens to already be open (e.g. user just clicked a link inside
                  // it and the page is scrolling to the new section), also nudge it
                  // to refresh right now instead of waiting for the next hover-open.
                  window.hwrScrollSpyCurrentId = current;
                  if (window.dsnHoverPanel && window.dsnHoverPanel.refresh) window.dsnHoverPanel.refresh();

                  // Mirror the current section's name onto the mobile
                  // secondary-top-bar breadcrumb ("AI Tools / Image
                  // Generation"). Reuses the same .stb-toc-name text these
                  // .stb-toc-card rows already render, so there's nothing
                  // new to keep in sync with hwr-categories.json.
                  var scGroupEl = document.getElementById('scMobileGroup');
                  if (scGroupEl) {
                    var currentCard = current && byId[current] ? byId[current][0] : null;
                    var nameEl = currentCard ? currentCard.querySelector('.stb-toc-name') : null;
                    scGroupEl.textContent = nameEl ? nameEl.textContent.trim() : '';
                  }
                }

                var io = new IntersectionObserver(function(entries) {
                  entries.forEach(function(entry) {
                    if (entry.isIntersecting) setCurrent(entry.target.id);
                  });
                }, {
                  rootMargin: '-10% 0px -75% 0px',
                  threshold: 0
                });

                sections.forEach(function(s) {
                  io.observe(s);
                });

                // Two more observers, both existing purely to blank the
                // breadcrumb (setCurrent(null)) — never to set it.
                //
                // 1) .box-one itself: catches the top boundary (scrolled
                //    back up above section 1, into the hero) and acts as a
                //    fallback bottom boundary too.
                //
                // 2) The tail blocks that follow the glossary — "Why This
                //    List Actually Slaps" (.stb-about-inner), "Submit a
                //    Site" (.stb-submit-inner), and mobile's Discover More
                //    (.discover-section). These all still live inside
                //    .box-one structurally, so #1 alone doesn't clear until
                //    you're all the way past them — but they aren't TOC
                //    content, so the breadcrumb should already be blank by
                //    the time you reach them, not still showing the last
                //    real section (e.g. "Glossary") you scrolled past.
                //
                // Neither observer ever *sets* current — only the section
                // observer above does that — so gaps between real sections
                // still just leave the breadcrumb frozen on the last one,
                // exactly as before.
                var boxOne = document.querySelector('.box-one');
                if (boxOne) {
                  var boxOneIo = new IntersectionObserver(function(entries) {
                    entries.forEach(function(entry) {
                      if (!entry.isIntersecting) setCurrent(null);
                    });
                  }, {
                    rootMargin: '-10% 0px -75% 0px',
                    threshold: 0
                  });
                  boxOneIo.observe(boxOne);
                }

                var tailEls = document.querySelectorAll('.stb-about-inner, .stb-submit-inner, .discover-section');
                if (tailEls.length) {
                  var tailIo = new IntersectionObserver(function(entries) {
                    entries.forEach(function(entry) {
                      if (entry.isIntersecting) setCurrent(null);
                    });
                  }, {
                    rootMargin: '-10% 0px -75% 0px',
                    threshold: 0
                  });
                  tailEls.forEach(function(el) {
                    tailIo.observe(el);
                  });
                }
              }

              // Same idea as above, but for the small "N tools" pill sitting next
              // to each section heading in box-one.
              document.addEventListener('websitesRendered', function() {
                document.querySelectorAll('.layouts-count[data-count-for]').forEach(function(el) {
                  var list = document.getElementById(el.getAttribute('data-count-for'));
                  var n = list ? list.querySelectorAll('.web-item').length : 0;
                  el.textContent = n + (n === 1 ? ' item' : ' items');
                });
              });
            } catch (err) {
  console.error('hwr-js.js block 2 failed:', err);
}


/* ==================== next block ==================== */

try {

              // ===================================================
              // PAGE SECTIONS — builds BOTH the sidebar "On This Page" TOC rows
              // AND the main-content headings/card-lists/"View All" buttons from
              // one shared config: hwr-categories.json → sections[<this filename>].
              //
              // To add a new page later (e.g. Movies), don't touch this page's
              // HTML at all — just add a new "/web-resources/movies": [...] array in
              // hwr-categories.json (see "_sections_readme" / "_section_fields" in
              // that file) and copy this exact <script> block onto the new page.
              // ===================================================
              // ===================================================
              // TOC SMOOTH SCROLL — shared by the sidebar "On This Page" chips and
              // the mobile More-sheet TOC cards below. A plain <a href="#anchor">
              // already animates on its own since .coc-main has scroll-behavior:
              // smooth, but a click from inside the mobile sheet also used to fire
              // closeMoreMenu()'s history.back() at the same moment the browser was
              // trying to jump to the hash — those two competed and the scroll came
              // out instant/stuttery instead of one smooth motion. This intercepts
              // the click, closes the sheet first when needed, lets its close
              // transition (.32s) finish, then animates the scroll itself.
              // ===================================================
              function hwrScrollToToc(e, anchorId, fromSheet) {
                var target = document.getElementById(anchorId);
                if (!target) return;
                if (e) e.preventDefault();

                function doScroll() {
                  target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                  });
                  if (history.replaceState) history.replaceState(null, '', '#' + anchorId);
                }

                if (fromSheet) {
                  var overlay = document.getElementById('moreOverlay');
                  var wasOpen = overlay && overlay.classList.contains('open');
                  if (wasOpen) {
                    closeMoreMenu();
                    setTimeout(doScroll, 320);
                    return;
                  }
                }
                doScroll();
              }

              // Same idea as hwrScrollToToc above, for the "On This Page" TOC rows
              // inside the secondary top bar's Browse Settings dropdown: close that
              // dropdown first (its own fade-out is quick — no animation delay
              // needed before the scroll starts), then scroll to the section.
              function hwrScrollToTocFromSettings(e, anchorId) {
                if (typeof window.closeStbSettingsDropdown === 'function') window.closeStbSettingsDropdown();
                hwrScrollToToc(e, anchorId);
              }
              window.hwrScrollToTocFromSettings = hwrScrollToTocFromSettings;

              // Shared per-section icon markup — each section's own SVG paths (from
              // hwr-categories.json) wrapped in a plain 24x24 outline <svg>. Reused
              // across the sidebar TOC row, the section heading, and the mobile
              // "More" sheet's Categories dropdown (renderCategoryNav, below).
              // Falls back to an empty string (no icon rendered) if a section has
              // none set.
              function hwrSectionIconSvg(sec, cls) {
                if (!sec.icon) return '';
                return '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                  'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                  sec.icon + '</svg>';
              }

              window.HwrCategoriesPromise.then(function(data) {
                var currentFile = hwrPageKey(location.pathname);
                var sections = hwrLookup(data.sections) || [];

                var navGrid = document.getElementById('navPanelGrid');
                var sectionsContainer = document.getElementById('aiSectionsContainer');
                if (!navGrid || !sectionsContainer || !sections.length) return;

                var navHtml = '';
                var contentHtml = '';

                // "On This Page" list inside the secondary top bar's Browse Settings
                // dropdown — same rows as the mobile More-sheet TOC (.stb-toc-card),
                // just living in a second spot so it's reachable from that dropdown
                // on any screen width, not just via the sidebar or the mobile sheet.
                var stbTocSection = document.getElementById('stbSettingsTocSection');
                var stbTocGrid = document.getElementById('stbSettingsTocGrid');
                var stbTocTotal = document.getElementById('stbSettingsTocTotal');
                var stbTocHtml = '';

                // Same idea, for box-three's own copy of this panel
                // (desktop-widescreen only — see .box-three). Plain
                // hwrScrollToToc here (no dropdown to close first) since this one
                // is a static block, not a popup.
                var sbTwoTocSection = document.getElementById('sbTwoTocSection');
                var sbTwoTocGrid = document.getElementById('sbTwoTocGrid');
                var sbTwoTocTotal = document.getElementById('sbTwoTocTotal');
                var sbTwoTocHtml = '';

                sections.forEach(function(sec, index) {
                  var anchorId = 'toc-' + sec.id;

                  // noCardList sections (e.g. the AI Tools Glossary) have their
                  // heading/content hand-authored directly in the page HTML
                  // already, under this same 'toc-<id>' anchor — there's no
                  // group of cards in hwr-websites.json to count, so every TOC
                  // row below just drops its count badge instead of pointing
                  // at a containerId that doesn't exist, and contentHtml skips
                  // building a heading/card-list/"View All" for it entirely.
                  var countBadge = sec.noCardList ? '' :
                    '<span class="nav-chip-count" data-count-for="' + sec.containerId + '">0</span>';
                  var stbCountBadge = sec.noCardList ? '' :
                    '<span class="stb-toc-count" data-count-for="' + sec.containerId + '">0</span>';

                  navHtml +=
                    '<a href="#' + anchorId + '" class="nav-chip" onclick="hwrScrollToToc(event,\'' + anchorId + '\')">' +
                    hwrSectionIconSvg(sec, 'nav-chip-icon') +
                    '<span class="nav-chip-name">' + sec.title + '</span>' +
                    '<span class="nav-chip-leader"></span>' +
                    countBadge +
                    '</a>';

                  stbTocHtml +=
                    '<a href="#' + anchorId + '" class="stb-toc-card" onclick="hwrScrollToTocFromSettings(event,\'' + anchorId + '\')">' +
                    hwrSectionIconSvg(sec, 'stb-toc-icon') +
                    '<span class="stb-toc-name">' + sec.title + '</span>' +
                    stbCountBadge +
                    '</a>';

                  sbTwoTocHtml +=
                    '<a href="#' + anchorId + '" class="stb-toc-card" onclick="hwrScrollToToc(event,\'' + anchorId + '\')">' +
                    hwrSectionIconSvg(sec, 'stb-toc-icon') +
                    '<span class="stb-toc-name">' + sec.title + '</span>' +
                    stbCountBadge +
                    '</a>';

                  if (!sec.noCardList) {
                    contentHtml +=
                      '<div class="layouts-title-box" id="' + anchorId + '">' +
                      '<div class="layouts-title-row">' +
                      '<div class="layouts-title">' + hwrSectionIconSvg(sec, 'layouts-title-icon') + '<span>' + sec.title + '</span></div>' +
                      '<div class="layouts-title-actions"><span class="layouts-count" data-count-for="' + sec.containerId + '">0 tools</span></div>' +
                      '</div>' +
                      (sec.subtitle ? '<div class="layouts-subtitle">' + sec.subtitle + '</div>' : '') +
                      '</div>' +
                      '<div class="web-list" id="' + sec.containerId + '"></div>' +
                      '<button class="view-more-btn" data-target="' + sec.containerId + '" data-item-class="web-item" data-limit="14">View All</button>';
                  }
                });

                navGrid.innerHTML = navHtml;
                sectionsContainer.innerHTML = contentHtml;

                // Section headings are built from JSON here, long after
                // DOMContentLoaded, so the phone title fit has to run again
                // on the markup that just landed.
                if (typeof hwrFitLayoutTitles === 'function') hwrFitLayoutTitles();

                if (stbTocGrid && stbTocSection) {
                  stbTocGrid.innerHTML = stbTocHtml;
                  stbTocSection.style.display = '';
                  if (stbTocTotal) stbTocTotal.textContent = sections.length + (sections.length === 1 ? ' section' : ' sections');
                }
                if (sbTwoTocGrid && sbTwoTocSection) {
                  sbTwoTocGrid.innerHTML = sbTwoTocHtml;
                  sbTwoTocSection.style.display = '';
                  if (sbTwoTocTotal) sbTwoTocTotal.textContent = sections.length + (sections.length === 1 ? ' section' : ' sections');
                }

                // HERO TAGS — sourced from hwr-categories.json, not hardcoded.
                // Same 4 topics as before (Text to Speech / Video Generation /
                // Image Generation / Audio Generation), but the label text now
                // comes straight from each section's own `title` in the JSON, and
                // clicking one scrolls down to that section exactly like a Table
                // of Contents entry (same hwrScrollToToc helper, same '#toc-<id>'
                // anchors the sections above just got). If a page doesn't have one
                // of these 4 sections, that tag is simply skipped instead of
                // showing a dead link.
                var heroTags = document.getElementById('heroTags');
                if (heroTags) {
                  var heroTagTitles = ['Text to Speech', 'Video Generation', 'Image Generation', 'Audio Generation'];
                  var heroTagsHtml = heroTagTitles.map(function(wantedTitle) {
                    var sec = sections.filter(function(s) {
                      return (s.title || '').trim().toLowerCase() === wantedTitle.toLowerCase();
                    })[0];
                    if (!sec) return '';
                    var anchorId = 'toc-' + sec.id;
                    return '<a href="#' + anchorId + '" class="hero-tag" onclick="hwrScrollToToc(event,\'' + anchorId + '\')">' + hwrSectionIconSvg(sec, 'hero-tag-icon') + sec.title + '</a>';
                  }).join('');
                  // Only swap the static placeholders once we actually found at
                  // least one matching section — an empty result is more likely a
                  // fetch/timing hiccup than "this page truly has none of these
                  // 4", so keep showing the non-clickable fallback rather than
                  // wiping the hero out.
                  if (heroTagsHtml) heroTags.innerHTML = heroTagsHtml;
                }

                // .web-list containers just got created — re-apply the stored
                // compact-view preference now that they actually exist in the DOM.
                if (typeof applyWebContentCompact === 'function') applyWebContentCompact();

                // Build the group→container map straight from the same config
                // (single source of truth — no separate hand-kept lookup table)
                // and only now start loading the actual site cards, since the
                // card-list containers above didn't exist until this point.
                var groupMap = {};
                sections.forEach(function(sec) {
                  if (sec.noCardList) return;
                  groupMap[sec.group] = {
                    containerId: sec.containerId,
                    itemClass: 'web-item'
                  };
                });
                if (typeof window.HwrLoadWebsiteData === 'function') {
                  window.HwrLoadWebsiteData(groupMap);
                }
              });
            } catch (err) {
  console.error('hwr-js.js block 3 failed:', err);
}


/* ==================== next block ==================== */

try {

              // GLOSSARY VIEW-MORE — same button language as the category
              // view-more-btn (data-limit + expanding chevron label), but a
              // standalone toggle over #glossaryList's own .glossary-item rows
              // instead of hooking into the shared card-grid limit system,
              // since a fixed 10-row cap should stay the same on every screen
              // size here. Toggles a class rather than inline display so it
              // works with the grid-based list layout below.
              (function() {
                var rows = document.querySelectorAll('#glossaryList .glossary-item');
                var btn = document.getElementById('glossaryViewMoreBtn');
                if (!btn || !rows.length) return;
                var limit = parseInt(btn.dataset.limit, 10) || 10;
                var hiddenCount = Math.max(rows.length - limit, 0);
                var expanded = false;

                function applyLimit() {
                  rows.forEach(function(row, index) {
                    row.classList.toggle('glossary-hidden', !expanded && index >= limit);
                  });
                }

                function renderLabel() {
                  var label = expanded ? 'View Less' : ('View All' + (hiddenCount > 0 ? ' +' + hiddenCount : ''));
                  btn.innerHTML = '<span>' + label + '</span>' +
                    '<svg class="view-more-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
                  btn.classList.toggle('is-expanded', expanded);
                }

                if (hiddenCount <= 0) {
                  btn.style.display = 'none';
                } else {
                  btn.onclick = function() {
                    expanded = !expanded;
                    applyLimit();
                    renderLabel();
                  };
                }
                applyLimit();
                renderLabel();
              })();
            } catch (err) {
  console.error('hwr-js.js block 4 failed:', err);
}


/* ==================== next block ==================== */

try {

              function renderViewMoreBtn(btn, expanded, hiddenCount) {
                var label = expanded ? 'View Less' : ('View All' + (hiddenCount > 0 ? ' +' + hiddenCount : ''));
                btn.innerHTML = '<span>' + label + '</span>' +
                  '<svg class="view-more-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
                btn.classList.toggle('is-expanded', expanded);
              }

              // Shared by the view-more logic below AND filterAll()'s "no search
              // query" branch, so both agree on how many cards show per list:
              // data-limit (14) on desktop always (box mode's desktop grid is
              // adaptive auto-fill, not a fixed column count, so there's no clean
              // "N full rows" math there — same as before). On mobile/tablet,
              // box/compact mode (.is-compact) is UNCHANGED — still N full rows of
              // cards read from the grid's own column count x 4 rows. Non-compact
              // (list form) now splits in two: real phones (≤600px) keep the flat
              // 6-item limit, while tablet portrait/landscape (601–970px, the same
              // range that now shows 2 cards per row) gets a flat 12-item limit
              // instead of inheriting the phone count.
              var VIEW_LIMIT_MOBILE_QUERY = window.matchMedia('(max-width: 970px)');
              var VIEW_LIMIT_PHONE_QUERY = window.matchMedia('(max-width: 600px)');
              var VIEW_LIMIT_TABLET_QUERY = window.matchMedia('(min-width: 601px) and (max-width: 970px)');
              var VIEW_LIMIT_PHONE_COUNT = 6;
              var VIEW_LIMIT_TABLET_COUNT = 12;
              var BOX_MODE_ROWS_MOBILE = 4;

              function getGridColumnCount(container) {
                if (!container) return 1;
                var cols = window.getComputedStyle(container).getPropertyValue('grid-template-columns').split(' ').filter(Boolean);
                return cols.length || 1;
              }

              function getViewLimit(btn) {
                var container = document.getElementById(btn.dataset.target);
                if (VIEW_LIMIT_MOBILE_QUERY.matches) {
                  if (container && container.classList.contains('is-compact')) {
                    return getGridColumnCount(container) * BOX_MODE_ROWS_MOBILE;
                  }
                  if (VIEW_LIMIT_PHONE_QUERY.matches) {
                    return VIEW_LIMIT_PHONE_COUNT;
                  }
                  if (VIEW_LIMIT_TABLET_QUERY.matches) {
                    return VIEW_LIMIT_TABLET_COUNT;
                  }
                }
                return parseInt(btn.dataset.limit, 10);
              }

              // Collected below so box-mode's toggle (which changes the column
              // count / rows-per-page math in getViewLimit) can re-run every
              // section's limit live instead of waiting for a resize or reload.
              window.hwrViewMoreApplyFns = [];

              document.addEventListener('websitesRendered', function() {
                document.querySelectorAll('.view-more-btn').forEach(function(btn) {
                  var container = document.getElementById(btn.dataset.target);
                  if (!container) return;
                  var items = container.querySelectorAll('.' + btn.dataset.itemClass);
                  if (!items.length) {
                    btn.style.display = 'none';
                    return;
                  }

                  var expanded = false;

                  function applyLimit() {
                    var limit = getViewLimit(btn);
                    var hiddenCount = items.length - limit;
                    items.forEach(function(item, index) {
                      item.style.display = (expanded || index < limit) ? 'flex' : 'none';
                    });
                    btn.style.display = items.length > limit ? 'flex' : 'none';
                    renderViewMoreBtn(btn, expanded, hiddenCount);
                  }

                  btn.onclick = function() {
                    expanded = !expanded;
                    applyLimit();
                  };
                  // Re-apply (without forcing collapse) if the viewport crosses the
                  // mobile breakpoint, so the 5-vs-14 limit stays correct live.
                  VIEW_LIMIT_MOBILE_QUERY.addEventListener('change', applyLimit);
                  window.hwrViewMoreApplyFns.push(applyLimit);
                  applyLimit();
                });
              });

              // ===================================================
              // ICON FALLBACK — swaps a broken/missing favicon for a letter avatar.
              //
              // Two situations need catching:
              //  1. The <img> actually fails to load (onerror) — rare, but covered.
              //  2. Google's s2 favicons service (used for most site.icon URLs in
              //     hwr-websites.json) doesn't error out when a domain has no real
              //     favicon — it silently "succeeds" with a generic placeholder globe
              //     icon instead, always served at a fixed 16x16 regardless of the
              //     requested `sz`. Real favicons come back at (roughly) the
              //     requested size, so anything that loads in at 16px or smaller from
              //     that service is almost certainly the placeholder, not a genuine
              //     tiny icon — swap it for the same letter-avatar fallback.
              // ===================================================
              window.hwrIconFallback = function(imgEl) {
                var w = imgEl.closest('.web-icon-wrap');
                if (w) {
                  w.classList.add('web-icon-fallback');
                  w.textContent = (w.dataset.name || '?').trim().charAt(0).toUpperCase();
                }
                imgEl.remove();
              };
              window.hwrIconCheckPlaceholder = function(imgEl) {
                var isGoogleFavicon = imgEl.src.indexOf('google.com/s2/favicons') !== -1;
                if (isGoogleFavicon && imgEl.naturalWidth && imgEl.naturalWidth <= 16) {
                  window.hwrIconFallback(imgEl);
                }
              };

              (function() {
                var BOOKMARK_ICON =
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-6-4.5L6 21V3z"/></svg>';

                function renderItem(site, itemClass) {
                  var a = document.createElement('a');
                  a.href = site.link;
                  a.target = '_blank';
                  a.rel = 'noopener noreferrer';
                  a.className = itemClass;

                  var alreadySaved = window.HwrBookmarks ? window.HwrBookmarks.isBookmarked(site.link) : false;

                  a.innerHTML =
                    '<span class="web-icon-wrap" data-name="' + (site.name || '?') + '">' +
                    '<img src="' + site.icon + '" class="web-icon" alt="" loading="lazy" ' +
                    'onerror="window.hwrIconFallback(this);" onload="window.hwrIconCheckPlaceholder(this);">' +
                    '</span>' +
                    '<div class="web-info">' +
                    '<div class="web-title">' + site.name + '</div>' +
                    '<div class="web-sub">' + (site.sub || '') + '</div>' +
                    '</div>' +
                    '<span class="web-actions">' +
                    '<button type="button" class="web-bookmark-btn' + (alreadySaved ? ' is-bookmarked' : '') + '" aria-label="' + (alreadySaved ? 'Remove bookmark' : 'Add bookmark') + '" aria-pressed="' + alreadySaved + '">' +
                    BOOKMARK_ICON +
                    '</button>' +
                    '</span>';

                  var bookmarkBtn = a.querySelector('.web-bookmark-btn');
                  bookmarkBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!window.HwrBookmarks) return;
                    var nowSaved = window.HwrBookmarks.toggleBookmark(site);
                    bookmarkBtn.classList.toggle('is-bookmarked', nowSaved);
                    bookmarkBtn.setAttribute('aria-pressed', nowSaved);
                    bookmarkBtn.setAttribute('aria-label', nowSaved ? 'Remove bookmark' : 'Add bookmark');
                    // Confirmation "pop" only plays on the save action, not on
                    // removal — removed right after so re-renders/hovers can't
                    // accidentally re-trigger it.
                    if (nowSaved) {
                      bookmarkBtn.classList.remove('just-saved');
                      void bookmarkBtn.offsetWidth; // restart animation if clicked rapidly
                      bookmarkBtn.classList.add('just-saved');
                      setTimeout(function() {
                        bookmarkBtn.classList.remove('just-saved');
                      }, 450);
                    }
                    // If "Bookmarked Only" is on, a card just unbookmarked should
                    // disappear immediately instead of waiting for the next filter
                    // action — see the Browse Settings wiring further down the page.
                    if (window.hwrRefreshBookmarkFilter) window.hwrRefreshBookmarkFilter();
                    if (window.hwrRefreshBoxThreeBookmarks) window.hwrRefreshBoxThreeBookmarks();
                    if (window.hwrRefreshStbSettingsBookmarks) window.hwrRefreshStbSettingsBookmarks();
                  });

                  // RECENT VISITS — every site card on every category page is
                  // built here, so this one listener is the whole history
                  // feature. Recorded on the card itself (not the bookmark
                  // button, which stopPropagation's above), and deliberately
                  // fire-and-forget: recordVisit swallows its own storage
                  // errors so a full or blocked localStorage can never stop
                  // the link from opening.
                  a.addEventListener('click', function() {
                    if (window.HwrBookmarks && window.HwrBookmarks.recordVisit) {
                      window.HwrBookmarks.recordVisit(site);
                    }
                  });

                  return a;
                }

                // Skeleton placeholders, shown immediately so the section doesn't
                // just sit empty under its heading while hwr-websites.json loads.
                function renderSkeletons() {
                  var skeletonHTML = '';
                  for (var i = 0; i < 3; i++) {
                    skeletonHTML +=
                      '<div class="web-item-skeleton">' +
                      '<span class="sk-icon"></span>' +
                      '<span class="sk-lines"><span class="sk-line sk-line-title"></span><span class="sk-line sk-line-sub"></span></span>' +
                      '</div>';
                  }
                  document.querySelectorAll('.web-list:not(#hwrFlatList)').forEach(function(list) {
                    list.innerHTML = skeletonHTML;
                  });
                }

                // Page filename → hwr-websites.json "cat" slug. Names don't map
                // 1:1 by just stripping "hwr-"/".html" (/web-resources/games is cat
                // "gaming", /web-resources/torrents is cat "torrenting", etc.), so this
                // is spelled out explicitly rather than derived.
                var HWR_PAGE_CAT_MAP = {
                  '/web-resources/ai-tools': 'ai',
                  '/web-resources/anime': 'anime',
                  '/web-resources/asian-drama': 'asiandrama',
                  '/web-resources/games': 'gaming',
                  '/web-resources/manga': 'manga',
                  '/web-resources/movies': 'movies',
                  '/web-resources/music': 'music',
                  '/web-resources/parcode': 'parcode',
                  '/web-resources/torrents': 'torrenting',
                  '/web-resources/web-games': 'webgaming',
                  '/web-resources/fun': 'fun'
                };
                // Exposed globally — renderCategoryNav() (CATEGORY NAV
                // block, further down this file) needs this same lookup
                // to stamp each OTHER category's mobile TOC count badge
                // with its cat slug, since it lives in a separate closure.
                window.HWR_PAGE_CAT_MAP = HWR_PAGE_CAT_MAP;

                // Called by the PAGE SECTIONS script once the section headings/
                // card-list containers exist in the DOM and it has built groupMap
                // (group key → {containerId, itemClass}) from hwr-categories.json —
                // this file no longer hardcodes that mapping itself.
                function loadWebsiteData(groupMap) {
                  renderSkeletons();

                  // Falls back to 'ai' if the current file isn't in the map above,
                  // so this never silently shows zero cards on an unlisted page.
                  var currentFile = hwrPageKey(location.pathname);
                  var currentCat = hwrLookup(HWR_PAGE_CAT_MAP) || 'ai';

                  window.HwrWebsitesPromise
                    .then(function(data) {
                      // Cached so renderCategoryNav()'s mobile TOC count
                      // badges for OTHER categories (no local container to
                      // count via the DOM) can read every site straight
                      // from here once 'websitesRendered' fires below.
                      window.HwrWebsitesData = data;

                      var pageSites = data.filter(function(site) {
                        return site.cat === currentCat;
                      });

                      Object.keys(groupMap).forEach(function(groupKey) {
                        var conf = groupMap[groupKey];
                        var container = document.getElementById(conf.containerId);
                        if (!container) return;
                        container.innerHTML = ''; // clear skeleton rows
                        pageSites
                          .filter(function(site) {
                            return site.group === groupKey;
                          })
                          .forEach(function(site, i) {
                            var card = renderItem(site, conf.itemClass);
                            // Stamped so the "Featured" sort option (the default,
                            // original JSON order) can always be restored exactly,
                            // even after switching to A–Z/Z–A and back.
                            card.dataset.order = i;
                            container.appendChild(card);
                          });
                      });

                      // Apply whatever sort order is currently selected in Browse
                      // Settings before anything else sees these cards — counts,
                      // the view-more limit math, and filterAll() all read the DOM
                      // order directly, so this has to run first.
                      if (typeof window.hwrApplySortOrder === 'function') window.hwrApplySortOrder();

                      document.dispatchEvent(new Event('websitesRendered'));
                    })
                    .catch(function() {
                      // Already logged once by window.HwrWebsitesPromise's
                      // own .catch() above, where it's shared from.
                    });
                }
                window.HwrLoadWebsiteData = loadWebsiteData;

                // Re-sync bookmark button states against localStorage.
                // Needed because browsers restore this page from the back/forward
                // cache (bfcache) when you hit the back button — the DOM comes back
                // exactly as it was when you left, so any bookmarks toggled elsewhere
                // (e.g. on /web-resources/) in the meantime aren't reflected
                // until we manually re-check them.
                function resyncBookmarkButtons() {
                  if (!window.HwrBookmarks) return;
                  document.querySelectorAll('.web-bookmark-btn').forEach(function(btn) {
                    var card = btn.closest('a[href]');
                    if (!card) return;
                    var saved = window.HwrBookmarks.isBookmarked(card.getAttribute('href'));
                    btn.classList.toggle('is-bookmarked', saved);
                    btn.setAttribute('aria-pressed', saved);
                    btn.setAttribute('aria-label', saved ? 'Remove bookmark' : 'Add bookmark');
                  });
                  if (window.hwrRefreshBoxThreeBookmarks) window.hwrRefreshBoxThreeBookmarks();
                  if (window.hwrRefreshStbSettingsBookmarks) window.hwrRefreshStbSettingsBookmarks();
                }

                // Resync on every pageshow, not just when event.persisted is true —
                // some browsers (notably mobile Safari/Chrome webviews) don't reliably
                // report `persisted`, so we just re-check every time the page becomes
                // visible again. resyncBookmarkButtons() is cheap and idempotent.
                window.addEventListener('pageshow', resyncBookmarkButtons);

                // Belt-and-suspenders: also resync when the tab/page regains visibility
                // (covers cases where pageshow itself doesn't fire as expected).
                document.addEventListener('visibilitychange', function() {
                  if (document.visibilityState === 'visible') resyncBookmarkButtons();
                });

                window.HwrResyncBookmarks = resyncBookmarkButtons; // exposed for debugging
              })();

              // Scroll-reveal: cards fade/slide in as they enter the viewport
              // instead of all popping in at once. Respects prefers-reduced-motion,
              // and any card the observer somehow misses just stays visible via CSS.
              document.addEventListener('websitesRendered', function() {
                var items = document.querySelectorAll('.web-item');
                if (!items.length) return;

                var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                if (reduceMotion || typeof IntersectionObserver === 'undefined') {
                  items.forEach(function(el) {
                    el.classList.add('in-view');
                  });
                  return;
                }

                var io = new IntersectionObserver(function(entries) {
                  entries.forEach(function(entry) {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('in-view');
                    io.unobserve(entry.target);
                  });
                }, {
                  threshold: 0.1,
                  rootMargin: '0px 0px -40px 0px'
                });

                items.forEach(function(el) {
                  io.observe(el);
                });
              });

              // Back-to-top button, scoped to the box-one content column.
              (function initBackToTop() {
                var btn = document.getElementById('boxOneTopBtn');
                var cocMain = document.querySelector('.coc-main');
                if (!btn || !cocMain) return;

                function onScroll() {
                  btn.classList.toggle('is-visible', cocMain.scrollTop > 600);
                }
                cocMain.addEventListener('scroll', onScroll, {
                  passive: true
                });
                onScroll();

                btn.addEventListener('click', function() {
                  cocMain.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                  });
                });
              })();

              // Secondary top bar logo/"Web Resources" link — was a plain
              // <a href="/web-resources/">, so clicking it while
              // already on this page relied on the browser doing a full
              // reload to land back at the top. Desktop browsers mostly do
              // that reload, but mobile browsers often serve the click from
              // the back-forward cache instead (no reload, scroll position
              // kept), which is why it looked like it "didn't work" there.
              // Intercepting the click and scrolling .coc-main directly
              // makes the behavior identical everywhere, with no reload.
              (function initSecondaryTopBarScrollToTop() {
                var link = document.getElementById('secondaryContentLink');
                var cocMain = document.querySelector('.coc-main');
                if (!link || !cocMain) return;

                link.addEventListener('click', function(e) {
                  var samePage = link.pathname === location.pathname ||
                    hwrPageKey(link.pathname) === hwrPageKey(location.pathname);
                  if (!samePage) return; // let normal navigation happen if this ever points elsewhere

                  e.preventDefault();
                  cocMain.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                  });
                  window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                  });
                });
              })();

              // mode (list/box), sort order, and "bookmarked only" — all of which
              // funnel through the same filterAll() visibility pass below so they
              // never fight each other (e.g. resizing mid-search, or switching view
              // mode while "Bookmarked Only" is on, can't un-hide the wrong cards).

              // ---- VIEW MODE — same localStorage key + logic as before, now driven
              // by the List/Box segmented control in Browse Settings, and still
              // mirrored with the mobile top-bar button (#stbCompactToggle). ----
              var webContentCompact = localStorage.getItem('hwr_content_compact') === '1';
              var viewModeListBtn = document.getElementById('viewModeListBtn');
              var viewModeBoxBtn = document.getElementById('viewModeBoxBtn');
              var stbCompactToggleBtn = document.getElementById('stbCompactToggle');

              function applyWebContentCompact() {
                document.querySelectorAll('.web-list').forEach(function(list) {
                  list.classList.toggle('is-compact', webContentCompact);
                });
                if (viewModeListBtn) {
                  viewModeListBtn.classList.toggle('is-active', !webContentCompact);
                  viewModeListBtn.setAttribute('aria-pressed', !webContentCompact);
                }
                if (viewModeBoxBtn) {
                  viewModeBoxBtn.classList.toggle('is-active', webContentCompact);
                  viewModeBoxBtn.setAttribute('aria-pressed', webContentCompact);
                }
                if (stbCompactToggleBtn) stbCompactToggleBtn.classList.toggle('is-active', webContentCompact);
                // Box mode changes the per-row card count (so the "N full rows"
                // math in getViewLimit changes too) — re-run every section's
                // view-more limit now so the visible card count updates immediately
                // instead of only on the next resize.
                if (window.hwrViewMoreApplyFns) {
                  window.hwrViewMoreApplyFns.forEach(function(fn) {
                    fn();
                  });
                }
                // Re-assert any active search/bookmark filter on top of the fresh
                // limit state above, so toggling view mode mid-filter can't
                // accidentally un-hide cards that shouldn't be showing.
                if (typeof filterAll === 'function') filterAll();
                // Let the mobile dropdown / box-three sidebar copies of this
                // control know the source of truth changed, so they update
                // right away instead of only on their own next click or the
                // dropdown's next open.
                document.dispatchEvent(new Event('hwrBrowseSettingsSync'));
              }
              applyWebContentCompact();

              function setWebContentCompact(next) {
                if (webContentCompact === next) return;
                webContentCompact = next;
                localStorage.setItem('hwr_content_compact', webContentCompact ? '1' : '0');
                applyWebContentCompact();
              }
              if (viewModeListBtn) viewModeListBtn.addEventListener('click', function() {
                setWebContentCompact(false);
              });
              if (viewModeBoxBtn) viewModeBoxBtn.addEventListener('click', function() {
                setWebContentCompact(true);
              });
              if (stbCompactToggleBtn) stbCompactToggleBtn.addEventListener('click', function() {
                setWebContentCompact(!webContentCompact);
              });

              // ---- SORT ORDER — reorders the .web-item cards inside every
              // .web-list. "Featured" restores the original order (each card's
              // data-order, stamped on at render time); A–Z/Z–A sort by title.
              // Runs once right after cards are (re)rendered — see loadWebsiteData
              // above, which calls window.hwrApplySortOrder() — and again any time
              // the dropdown changes. ----
              var hwrSortOrder = localStorage.getItem('hwr_sort_order') || 'default';
              var sortOrderSelect = document.getElementById('sortOrderSelect');
              if (sortOrderSelect) sortOrderSelect.value = hwrSortOrder;

              function applySortOrder() {
                document.querySelectorAll('.web-list').forEach(function(list) {
                  var items = Array.prototype.slice.call(list.querySelectorAll('.web-item'));
                  if (!items.length) return;
                  items.sort(function(a, b) {
                    if (hwrSortOrder === 'az' || hwrSortOrder === 'za') {
                      var ta = (a.querySelector('.web-title') || {}).textContent || '';
                      var tb = (b.querySelector('.web-title') || {}).textContent || '';
                      var cmp = ta.trim().toLowerCase().localeCompare(tb.trim().toLowerCase());
                      return hwrSortOrder === 'za' ? -cmp : cmp;
                    }
                    return (parseInt(a.dataset.order, 10) || 0) - (parseInt(b.dataset.order, 10) || 0);
                  });
                  items.forEach(function(item) {
                    list.appendChild(item);
                  }); // appendChild on an existing node moves it
                });
              }
              window.hwrApplySortOrder = applySortOrder;

              if (sortOrderSelect) {
                sortOrderSelect.addEventListener('change', function() {
                  hwrSortOrder = sortOrderSelect.value;
                  localStorage.setItem('hwr_sort_order', hwrSortOrder);
                  applySortOrder();
                  // Card order just changed — every view-more limit and any active
                  // search/bookmark filter needs to be recalculated against it.
                  if (window.hwrViewMoreApplyFns) window.hwrViewMoreApplyFns.forEach(function(fn) {
                    fn();
                  });
                  if (typeof filterAll === 'function') filterAll();
                  // See applyWebContentCompact() above — same instant-sync
                  // broadcast so the mirrored sort dropdowns update right away.
                  document.dispatchEvent(new Event('hwrBrowseSettingsSync'));
                });
              }

              // ---- BOOKMARKED ONLY — shows just the cards saved via the bookmark
              // button on each card (window.HwrBookmarks). Folded into filterAll()
              // below so it composes cleanly with an active search instead of the
              // two features fighting over which cards should be visible. ----
              var hwrBookmarkOnly = localStorage.getItem('hwr_bookmark_only') === '1';
              var bookmarkOnlyToggle = document.getElementById('bookmarkOnlyToggle');

              function applyBookmarkOnlyToggleUI() {
                if (!bookmarkOnlyToggle) return;
                bookmarkOnlyToggle.classList.toggle('is-active', hwrBookmarkOnly);
                bookmarkOnlyToggle.setAttribute('aria-checked', hwrBookmarkOnly);
                // See applyWebContentCompact() above — same instant-sync
                // broadcast so the mirrored Bookmarks chips update right away.
                document.dispatchEvent(new Event('hwrBrowseSettingsSync'));
              }
              applyBookmarkOnlyToggleUI();
              if (bookmarkOnlyToggle) {
                bookmarkOnlyToggle.addEventListener('click', function() {
                  hwrBookmarkOnly = !hwrBookmarkOnly;
                  localStorage.setItem('hwr_bookmark_only', hwrBookmarkOnly ? '1' : '0');
                  applyBookmarkOnlyToggleUI();
                  filterAll();
                });
              }
              // Called from the bookmark-button click handler (see the card-render
              // script above) so unbookmarking a card while this filter is on makes
              // it disappear immediately, instead of waiting for the next search
              // keystroke or toggle click.
              window.hwrRefreshBookmarkFilter = function() {
                if (hwrBookmarkOnly) filterAll();
              };

              // ---- FLAT VIEW — merges every category section into one continuous
              // run: no headers, no "View All" buttons, no gap between what used
              // to be separate .web-list groups, and every card shown at once
              // (the view-limit that normally hides all-but-the-first-N is skipped
              // entirely — see filterAll()'s limit calc below). ----
              var hwrFlatView = localStorage.getItem('hwr_flat_view') === '1';
              var flatViewToggle = document.getElementById('flatViewToggle');
              var aiSectionsContainer = document.getElementById('aiSectionsContainer');
              var hwrFlatList = document.getElementById('hwrFlatList');

              // Physically relocates every .web-item out of its per-category
              // .web-list and into the single shared #hwrFlatList, in DOM order, so
              // they reflow as one continuous grid/list with no per-category gaps.
              // Each card is stamped with the id of the container it came from so
              // hwrRestoreFromFlatList() can put it back exactly where it belongs.
              function hwrMergeIntoFlatList() {
                if (!hwrFlatList || !aiSectionsContainer) return;
                aiSectionsContainer.querySelectorAll('.web-list').forEach(function(list) {
                  Array.prototype.slice.call(list.children).forEach(function(item) {
                    item.setAttribute('data-hwr-home', list.id);
                    hwrFlatList.appendChild(item); // appendChild on an existing node moves it
                  });
                });
              }

              function hwrRestoreFromFlatList() {
                if (!hwrFlatList) return;
                Array.prototype.slice.call(hwrFlatList.children).forEach(function(item) {
                  var home = document.getElementById(item.getAttribute('data-hwr-home'));
                  if (home) home.appendChild(item);
                });
              }

              function applyFlatViewUI() {
                if (aiSectionsContainer) aiSectionsContainer.classList.toggle('is-flat-view', hwrFlatView);
                if (flatViewToggle) {
                  flatViewToggle.classList.toggle('is-active', hwrFlatView);
                  flatViewToggle.setAttribute('aria-checked', hwrFlatView);
                }
                if (hwrFlatView) hwrMergeIntoFlatList();
                else hwrRestoreFromFlatList();
                // See applyWebContentCompact() above — same instant-sync
                // broadcast so the mirrored Merge chips update right away.
                document.dispatchEvent(new Event('hwrBrowseSettingsSync'));
              }
              applyFlatViewUI();
              // Cards load asynchronously (see loadWebsiteData's fetch), so the
              // very first applyFlatViewUI() call above usually runs before any
              // .web-item exists yet — re-merge once they've actually landed.
              document.addEventListener('websitesRendered', function() {
                if (hwrFlatView) hwrMergeIntoFlatList();
              });
              if (flatViewToggle) {
                flatViewToggle.addEventListener('click', function() {
                  hwrFlatView = !hwrFlatView;
                  localStorage.setItem('hwr_flat_view', hwrFlatView ? '1' : '0');
                  applyFlatViewUI();
                  filterAll();
                });
              }

              // ---- TOC AUTO-COLLAPSE — closes the "On This Page" details panel
              // (open by default) whenever the list is off its default
              // arrangement: active search, A–Z/Z–A sort, Bookmarks-only, Merge
              // view, or Box view. Frees up the room it would otherwise take
              // right below the search bar. If the user manually re-opens it
              // while still in a non-default state, that's respected and left
              // alone until the state changes again; returning everything to
              // default re-opens it automatically. ----
              var navPanelToc = document.querySelector('.nav-panel-toc');
              var navPanelUserOpened = false;
              var navPanelProgrammaticToggle = false;

              if (navPanelToc) {
                navPanelToc.addEventListener('toggle', function() {
                  if (navPanelProgrammaticToggle) return; // our own JS-driven toggle, ignore
                  // A real click from the user — if they opened it while still
                  // non-default, remember that so the auto-close below leaves it
                  // alone until the state changes again.
                  navPanelUserOpened = navPanelToc.open;
                });
              }

              function updateNavPanelToc(shouldBeClosed) {
                if (!navPanelToc) return;
                if (!shouldBeClosed) {
                  // Back to default — always re-open, and clear any manual
                  // override so the next non-default state starts closed again.
                  navPanelUserOpened = false;
                  if (!navPanelToc.open) {
                    navPanelProgrammaticToggle = true;
                    navPanelToc.open = true;
                    navPanelProgrammaticToggle = false;
                  }
                  return;
                }
                if (navPanelUserOpened) return; // user opened it themselves — leave it
                if (navPanelToc.open) {
                  navPanelProgrammaticToggle = true;
                  navPanelToc.open = false;
                  navPanelProgrammaticToggle = false;
                }
              }

              function filterAll() {
                var input = document.getElementById('filterSearch');
                var clearBtn = document.getElementById('filterSearchClear');
                var wrap = document.getElementById('navPanelSearch');
                var q = input ? input.value.toLowerCase().trim() : '';
                if (clearBtn) clearBtn.style.display = q ? 'flex' : 'none';
                if (wrap) wrap.classList.toggle('has-value', !!q);

                var isFiltering = !!q || hwrBookmarkOnly;

                // Auto-collapse the "On This Page" TOC whenever the list is no
                // longer in its default arrangement — active search, active
                // sort (A–Z/Z–A), Bookmarks-only, Merge view, or Box view — and
                // re-open it once everything's back to default. See
                // updateNavPanelToc() above for the manual-override handling.
                var isSorted = hwrSortOrder === 'az' || hwrSortOrder === 'za';
                updateNavPanelToc(!!q || isSorted || hwrBookmarkOnly || hwrFlatView || webContentCompact);

                var groups = document.querySelectorAll('.web-list');
                var emptyState = document.getElementById('globalEmptyState');
                var anyVisibleGlobal = false;
                var firstVisibleTitleBox = null;

                groups.forEach(function(list) {
                  var items = list.querySelectorAll('.web-item');
                  var titleBox = list.previousElementSibling;
                  var btn = list.nextElementSibling;
                  var isTitleBox = titleBox && titleBox.classList.contains('layouts-title-box');
                  var isViewMoreBtn = btn && btn.classList.contains('view-more-btn');

                  if (!isFiltering) {
                    // No search, no bookmark filter — restore the default "first N,
                    // rest hidden behind View All" state. Flat View skips the limit
                    // entirely so every card shows at once (its "View All" button
                    // and header are already hidden via CSS's .is-flat-view).
                    var limit = (isViewMoreBtn && !hwrFlatView) ? (getViewLimit(btn) || items.length) : items.length;
                    items.forEach(function(item, index) {
                      var visible = index < limit;
                      item.style.display = visible ? 'flex' : 'none';
                      if (visible) item.classList.add('in-view');
                    });
                    if (isTitleBox) titleBox.style.display = '';
                    if (isTitleBox && !firstVisibleTitleBox) firstVisibleTitleBox = titleBox;
                    if (isViewMoreBtn) {
                      var hiddenCount = items.length - limit;
                      btn.style.display = items.length > limit ? 'flex' : 'none';
                      renderViewMoreBtn(btn, false, hiddenCount);
                    }
                    anyVisibleGlobal = true; // nothing active — nothing to report as "empty"
                    return;
                  }

                  var anyVisible = false;
                  items.forEach(function(item) {
                    var title = (item.querySelector('.web-title') || {}).textContent || '';
                    var sub = (item.querySelector('.web-sub') || {}).textContent || '';
                    var matchesQuery = !q || title.toLowerCase().includes(q) || sub.toLowerCase().includes(q);
                    var matchesBookmark = !hwrBookmarkOnly || (window.HwrBookmarks && window.HwrBookmarks.isBookmarked(item.getAttribute('href')));
                    var match = matchesQuery && matchesBookmark;
                    item.style.display = match ? 'flex' : 'none';
                    if (match) {
                      item.classList.add('in-view');
                      anyVisible = true;
                      anyVisibleGlobal = true;
                    }
                  });
                  if (isTitleBox) titleBox.style.display = anyVisible ? '' : 'none';
                  if (isTitleBox && anyVisible && !firstVisibleTitleBox) firstVisibleTitleBox = titleBox;
                  if (isViewMoreBtn) btn.style.display = 'none';
                });

                document.querySelectorAll('.layouts-title-box.is-first-visible').forEach(function(box) {
                  if (box !== firstVisibleTitleBox) box.classList.remove('is-first-visible');
                });
                if (firstVisibleTitleBox) firstVisibleTitleBox.classList.add('is-first-visible');

                if (emptyState) {
                  // "No bookmarks yet" gets the same .global-empty-state card as the
                  // "no search results" state above (just a different id/icon/text)
                  // instead of its own separate look — that keeps both "nothing
                  // here" states visually consistent.
                  var bookmarkEmptyState = document.getElementById('bookmarkEmptyState');
                  var noBookmarksYet = hwrBookmarkOnly && !q && !anyVisibleGlobal;
                  var noSearchResults = !!q && !anyVisibleGlobal;
                  emptyState.classList.toggle('is-visible', noSearchResults);
                  if (bookmarkEmptyState) bookmarkEmptyState.classList.toggle('is-visible', noBookmarksYet);
                }
              }

              // "Show All Sites" — clears the Saved-only filter from the bookmark
              // empty-state card, same action as the dashed empty-state's clear
              // button used to offer when it doubled up for this case.
              var bookmarkEmptyShowAllBtn = document.getElementById('bookmarkEmptyShowAllBtn');
              if (bookmarkEmptyShowAllBtn) {
                bookmarkEmptyShowAllBtn.addEventListener('click', function() {
                  hwrBookmarkOnly = false;
                  localStorage.setItem('hwr_bookmark_only', '0');
                  applyBookmarkOnlyToggleUI();
                  filterAll();
                });
              }

              // Keeps the initial page-load state correct in every combination:
              // the view-more listener (registered above) sets each section's
              // default "first N" visibility as soon as cards exist, then this
              // re-asserts the current search/bookmark filter on top of it — e.g.
              // so a "Bookmarked Only" preference saved from a previous visit is
              // respected immediately instead of only after the next interaction.
              document.addEventListener('websitesRendered', function() {
                filterAll();
              });

              function clearFilterSearch() {
                var input = document.getElementById('filterSearch');
                if (!input) return;
                input.value = '';
                filterAll();
                input.focus();
              }

              // Press "/" anywhere on the page to jump straight into the tool
              // search — matches the kbd hint shown inside the field itself.
              //
              // FIX: this used to only check e.key === '/'. That's the character
              // the key *produces*, which shifts around on non-US layouts (ISO/UK,
              // AZERTY, etc.) — on several of those the physical key most people
              // reach for actually reports as '\' or requires Shift, so e.key never
              // equals '/' and the shortcut silently did nothing. We now check the
              // physical key position first (e.code, layout-independent) and fall
              // back to accepting either '/' or '\' as the produced character.
              document.addEventListener('keydown', function(e) {
                var isSlashKey = e.code === 'Slash' || e.code === 'NumpadDivide' ||
                  e.key === '/' || e.key === '\\';
                if (!isSlashKey) return;
                if (e.metaKey || e.ctrlKey || e.altKey) return;
                var active = document.activeElement;
                var typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
                if (typing) return;
                var input = document.getElementById('filterSearch');
                if (!input) return;
                e.preventDefault();
                input.focus();
              });
            } catch (err) {
  console.error('hwr-js.js block 5 failed:', err);
}


/* ==================== next block ==================== */

try {

          // DISCOVER LIST (discover-section) — built from hwr-categories.json's
          // "categories" array (merged in from the old standalone hwr-1cards.json,
          // which is no longer used), shared with the resources-cards grid on
          // /web-resources/, using the same .resource-card markup. Reuses
          // the page's single shared HwrCategoriesPromise instead of firing its
          // own fetch. Add/remove/edit entries in that file and this list updates
          // automatically instead of being hardcoded here.
          (function initDiscoverList() {
            var list = document.getElementById('discoverList');
            if (!list) return;

            window.HwrCategoriesPromise
              .then(function(data) {
                // Always show every category, in the same order they're listed
                // in hwr-categories.json — no shuffling, no cap. Used to only
                // do this on mobile (≤970px) and show a random 6-card preview
                // on desktop; now every screen size gets the full, stable list.
                var items = data.categories.slice();
                var html = '';
                items.forEach(function(item) {
                  var bgStyle = item.bgStyle ? ' style="' + item.bgStyle + '"' : '';
                  html += '<a class="resource-card" href="' + item.link + '">' +
                    '<img class="resource-bg" src="' + item.bg + '" alt=""' + bgStyle + '>' +
                    '<div class="resource-title">' + item.name + '</div>' +
                    '<img class="resource-icon" src="' + item.icon + '" alt="">' +
                    '</a>';
                });
                list.innerHTML = html;
              })
              .catch(function(err) {
                console.error('Failed to load hwr-categories.json', err);
              });
          })();

          // BOX THREE (SETTINGS PANEL) — desktop-sidebar (>1400px) mirror of the top
          // bar's 3-dot Browse Settings dropdown. No open/close state of its
          // own (it's a static block, sticky inside box-two, not a popup) —
          // every control here just proxies a click/change to the same original
          // sidebar elements the top-bar dropdown proxies to, so there's still
          // exactly one source of truth no matter which of the three UIs
          // (sidebar filter bar, top-bar dropdown, this panel) gets used.
          (function initBoxThreePanel() {
            var panel = document.getElementById('boxThreePanel');
            if (!panel) return;

            var listBtn = document.getElementById('sbTwoViewListBtn');
            var boxBtn = document.getElementById('sbTwoViewBoxBtn');
            var sortSelect = document.getElementById('sbTwoSortSelect');
            var bookmarkToggle = document.getElementById('sbTwoBookmarkToggle');
            var flatToggle = document.getElementById('sbTwoFlatToggle');

            function syncUI() {
              var origList = document.getElementById('viewModeListBtn');
              var origBox = document.getElementById('viewModeBoxBtn');
              if (listBtn && origList) listBtn.classList.toggle('is-active', origList.classList.contains('is-active'));
              if (boxBtn && origBox) boxBtn.classList.toggle('is-active', origBox.classList.contains('is-active'));

              var origSort = document.getElementById('sortOrderSelect');
              if (sortSelect && origSort) {
                sortSelect.value = origSort.value;
              }

              var origBookmark = document.getElementById('bookmarkOnlyToggle');
              if (bookmarkToggle && origBookmark) {
                var bmActive = origBookmark.classList.contains('is-active');
                bookmarkToggle.classList.toggle('is-active', bmActive);
                bookmarkToggle.setAttribute('aria-checked', bmActive);
              }

              var origFlat = document.getElementById('flatViewToggle');
              if (flatToggle && origFlat) {
                var flatActive = origFlat.classList.contains('is-active');
                flatToggle.classList.toggle('is-active', flatActive);
                flatToggle.setAttribute('aria-checked', flatActive);
              }
            }

            if (listBtn) listBtn.addEventListener('click', function() {
              var orig = document.getElementById('viewModeListBtn');
              if (orig) orig.click();
              syncUI();
            });
            if (boxBtn) boxBtn.addEventListener('click', function() {
              var orig = document.getElementById('viewModeBoxBtn');
              if (orig) orig.click();
              syncUI();
            });

            if (sortSelect) sortSelect.addEventListener('change', function() {
              var origSort = document.getElementById('sortOrderSelect');
              if (!origSort) return;
              origSort.value = sortSelect.value;
              origSort.dispatchEvent(new Event('change'));
              syncUI();
            });

            if (bookmarkToggle) bookmarkToggle.addEventListener('click', function() {
              var orig = document.getElementById('bookmarkOnlyToggle');
              if (orig) orig.click();
              syncUI();
            });
            if (flatToggle) flatToggle.addEventListener('click', function() {
              var orig = document.getElementById('flatViewToggle');
              if (orig) orig.click();
              syncUI();
            });

            document.addEventListener('websitesRendered', syncUI);
            // Instant sync no matter which UI actually changed something —
            // see the matching comment in initStbSettingsDropdown above.
            document.addEventListener('hwrBrowseSettingsSync', syncUI);
            syncUI();
          })();

          // "RECENTLY BOOKMARKED" CARD (box-three) — reads window.HwrBookmarks
          // directly. Bookmark objects already carry name/link/icon/sub/cat,
          // so this needs no fetch of its own; it just re-renders whenever a
          // bookmark is toggled anywhere on the page (see the bookmark-button
          // click handler and resyncBookmarkButtons() above, both of which
          // call window.hwrRefreshBoxThreeBookmarks()), plus on pageshow so a
          // bfcache restore or a bookmark toggled on /web-resources/ in
          // another tab is picked up too.
          //
          // ADAPTIVE HEIGHT: box-three is `position: sticky; top: 20px`, so
          // once it's pinned, the most it can ever grow to before pushing
          // past the bottom of the viewport is a fixed vh-based budget —
          // `100vh - top offset - a matching bottom gap`. Everything else in
          // the panel (the "On This Page" card, this card's own header/
          // button/hint) is fixed overhead; whatever's left of that budget
          // is what the bookmark rows themselves get to use. Row count is
          // capped at 6 and trimmed down (6→1) to whatever actually fits
          // that leftover space, measuring real rendered rows rather than
          // guessing a row height. If not even one row fits alongside the
          // rest of the panel, the whole card is pulled instead of leaving
          // a broken sliver on screen. Recomputed on resize/orientation
          // change too, since the vh budget only tracks viewport height.
          (function initBoxThreeBookmarks() {
            var section = document.getElementById('sbTwoBookmarksSection');
            if (!section) return;

            var panel = document.getElementById('boxThreePanel') || section.parentElement;
            var grid = document.getElementById('sbTwoBookmarksGrid');
            var totalEl = document.getElementById('sbTwoBookmarksTotal');
            var emptyEl = document.getElementById('sbTwoBookmarksEmpty');
            var viewAllBtn = document.getElementById('sbTwoBookmarksViewAll');
            var MAX_ROWS = 20;
            var STICKY_TOP = 20;
            var BOTTOM_GAP = 20;
            var tocCard = document.getElementById('sbTwoTocSection');

            function renderRow(site) {
              var name = site.name || 'Untitled';
              var initial = name.trim().charAt(0).toUpperCase() || '?';
              var sub = site.sub ? ' \u2014 ' + site.sub : '';
              return '<a href="' + site.link + '" target="_blank" rel="noopener noreferrer" ' +
                'class="stb-toc-card" title="' + name + sub + '">' +
                '<span class="stb-toc-icon b3-bookmark-icon" data-fallback="' + initial + '">' +
                '<img src="' + site.icon + '" alt="" loading="lazy" ' +
                'onerror="var p=this.parentElement;p.classList.add(\'web-icon-fallback\');p.textContent=p.dataset.fallback;this.remove();">' +
                '</span>' +
                '<span class="stb-toc-name">' + name + '</span>' +
                '</a>';
            }

            function renderRows(list) {
              if (!grid) return;
              grid.innerHTML = list.map(renderRow).join('');
              // See the note on the other box-three renderer: an 'error'
              // handler alone misses the grey-globe placeholder, which comes
              // back as a successful 16x16 response.
              if (window.HwrIcons) {
                window.HwrIcons.watchAll(grid, '.b3-bookmark-icon img', 'web-icon-fallback', 'parent', 'data-fallback');
              }
            }

            // Given the grid already rendered with `rows.length` candidate
            // rows, measures how many of them (from the top) actually fit
            // inside `availableForGrid` px, using real getBoundingClientRect
            // heights + the grid's own row-gap — no hardcoded row height.
            function countRowsThatFit(availableForGrid) {
              if (!grid || availableForGrid <= 0) return 0;
              var gapVal = parseFloat(window.getComputedStyle(grid).rowGap) || 0;
              var rows = grid.querySelectorAll('.stb-toc-card');
              var used = 0, fit = 0;
              for (var i = 0; i < rows.length; i++) {
                var h = rows[i].getBoundingClientRect().height;
                var next = used + h + (i > 0 ? gapVal : 0);
                if (next > availableForGrid) break;
                used = next;
                fit = i + 1;
              }
              return fit;
            }

            // When the bookmarks card is pulled entirely, box-three shrinks
            // down to just "Browse Settings" + "On This Page" — leaving the
            // rest of box-two's (much taller) column showing as bare, empty
            // background beneath it, which reads as broken rather than an
            // intentionally short panel. Stretching "On This Page" (the new
            // last card) to soak up that same vh budget keeps the sidebar
            // looking like one deliberately-sized panel instead of a card
            // floating above a gap. Reset to its natural height any time the
            // bookmarks card is showing again.
            // Whichever card is currently last/visible in box-three (bookmarks
            // card normally, or "On This Page" when bookmarks is hidden
            // entirely) may still leave the rest of box-two's taller column
            // showing as bare background beneath it — the sidebar's actual
            // content is rarely exactly as tall as the vh budget. Stretching
            // that last card's own min-height to soak up the leftover space
            // keeps its background covering the gap instead of box-two's
            // plain background showing through. Reset both cards first so
            // this recomputes cleanly from their natural heights every time.
            function fillLeftoverSpace(bookmarksHidden) {
              tocCard && (tocCard.style.minHeight = '');
              section.style.minHeight = '';
              if (!panel) return;

              var target = bookmarksHidden ? tocCard : section;
              if (!target) return;

              var budget = window.innerHeight - STICKY_TOP - BOTTOM_GAP;
              // Leave BOTTOM_GAP of breathing room below the stretched card
              // instead of running it flush to the viewport edge.
              var extra = budget - panel.scrollHeight - BOTTOM_GAP;
              if (extra > 0) {
                target.style.minHeight = (target.getBoundingClientRect().height + extra) + 'px';
              }
            }

            function refresh() {
              if (!window.HwrBookmarks) return;

              // Undo any minHeight stretch a PREVIOUS refresh() call left in
              // place, before measuring anything. Without this, a stale
              // stretch from an earlier run (there can be several per page
              // load now — pageshow, websitesRendered, DOMContentLoaded,
              // HwrCategoriesPromise, fonts.ready) inflates panel.scrollHeight
              // for THIS run, throwing off the fit/no-fit decision. This was
              // the actual source of the "sometimes there, sometimes not"
              // flakiness — fillLeftoverSpace() only cleaned this up at the
              // very END of a run, after the (already-corrupted) decision had
              // been made.
              if (tocCard) tocCard.style.minHeight = '';
              section.style.minHeight = '';

              var saved = window.HwrBookmarks.getBookmarks();
              var count = saved.length;

              if (totalEl) totalEl.textContent = count + ' saved';

              if (!count) {
                section.style.display = '';
                renderRows([]);
                if (emptyEl) emptyEl.style.display = '';
                if (viewAllBtn) viewAllBtn.style.display = 'none';
                fillLeftoverSpace(false);
                return;
              }

              // Show everything at the full cap first so we can measure the
              // panel's real, unclamped height against the vh budget.
              section.style.display = '';
              if (emptyEl) emptyEl.style.display = 'none';
              if (viewAllBtn) viewAllBtn.style.display = '';

              var cap = Math.min(count, MAX_ROWS);
              var mostRecent = saved.slice(-cap).reverse();
              renderRows(mostRecent);

              var budget = window.innerHeight - STICKY_TOP - BOTTOM_GAP;
              var panelHeight = panel ? panel.scrollHeight : section.scrollHeight;
              var gridHeight = grid ? grid.scrollHeight : 0;
              var overhead = panelHeight - gridHeight; // everything but the grid itself
              var availableForGrid = budget - overhead;

              var fitCount = countRowsThatFit(availableForGrid);

              if (fitCount <= 0) {
                // Not even the header/button chrome fits alongside a single
                // row — pull the whole card rather than show a broken sliver.
                section.style.display = 'none';
                fillLeftoverSpace(true);
                return;
              }

              if (fitCount < mostRecent.length) {
                renderRows(mostRecent.slice(0, fitCount));
              }
              fillLeftoverSpace(false);
            }

            if (viewAllBtn) {
              viewAllBtn.addEventListener('click', function() {
                // Turns on the same Bookmarked-Only filter used everywhere else
                // (stored in localStorage, so it's already in effect the moment
                // /web-resources/ loads) then hands off to that page,
                // rather than trying to duplicate a saved-sites view here.
                localStorage.setItem('hwr_bookmark_only', '1');
                window.location.href = '/web-resources/';
              });
            }

            // Debounced so a window drag doesn't re-measure on every pixel.
            var resizeTimer;
            window.addEventListener('resize', function() {
              clearTimeout(resizeTimer);
              resizeTimer = setTimeout(refresh, 120);
            });
            window.addEventListener('orientationchange', refresh);

            window.hwrRefreshBoxThreeBookmarks = refresh;
            window.addEventListener('pageshow', refresh);
            document.addEventListener('websitesRendered', refresh);
            refresh();

            // Safety net #1: on fast/cached navigations, 'websitesRendered'
            // (and even fonts.ready above) can fire before the deferred
            // hwr-bookmarks.js has run, so refresh() bails on
            // `!window.HwrBookmarks` and nothing ever retries. DOMContentLoaded
            // is guaranteed to fire after ALL deferred scripts finish, so this
            // always sees a real window.HwrBookmarks.
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', refresh);
            } else {
              refresh();
            }

            // Safety net #2: the fit/no-fit decision reads the TOC card's
            // real rendered height as "overhead". That TOC (#sbTwoTocGrid)
            // is built synchronously inside window.HwrCategoriesPromise's
            // own .then() (see the PAGE SECTIONS script above), so chaining
            // refresh() onto that SAME promise — rather than guessing via
            // 'websitesRendered' or a fixed delay — guarantees this always
            // runs after the TOC has every row it's going to have, no matter
            // how fast or slow that fetch resolves. This is what was
            // producing the "sometimes cut, sometimes not" flakiness: a
            // refresh() could measure a half-built (or empty) TOC and lock
            // in the wrong overhead number, with nothing correcting it
            // afterward. .then() handlers on the same promise always run in
            // the order they were attached, so this is not a timing guess.
            if (window.HwrCategoriesPromise) {
              window.HwrCategoriesPromise.then(refresh);
            }
          })();
        } catch (err) {
  console.error('hwr-js.js block 6 failed:', err);
}


/* ==================== next block ==================== */

try {

        } catch (err) {
  console.error('hwr-js.js block 7 failed:', err);
}


/* ==================== next block ==================== */

try {

      // PAGE LOADER — used to wait on window "load" (every image/icon/font
      // fully downloaded) before revealing the page, which is why it hung
      // on the spinner while favicons trickled in. Now it only waits for
      // the two things a user actually sees first: the main HTML structure
      // (DOMContentLoaded) and the fonts being ready (document.fonts.ready),
      // so there's no flash of unstyled/wrong-font text. Everything else —
      // sidebar data, search data, icons, images — is the "second part" and
      // is left for the skeletons to handle after reveal. A hard 2s timeout
      // is kept as a ceiling so the loader can never show longer than that
      // no matter what.
      function revealPage() {
        document.documentElement.classList.add("loaded");
        const loader = document.getElementById('page-loader');
        if (!loader) return;
        loader.classList.add('hidden');
        setTimeout(() => loader.remove(), 400);
      }

      const domReady = new Promise(resolve => {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', resolve, {
            once: true
          });
        } else {
          resolve();
        }
      });

      const fontsReady = (document.fonts && document.fonts.ready) ?
        document.fonts.ready :
        Promise.resolve();

      const structureAndFontsReady = Promise.all([domReady, fontsReady]);

      const pageLoaderTimeout = new Promise(resolve => setTimeout(resolve, 2000)); // hard 2s ceiling

      Promise.race([structureAndFontsReady, pageLoaderTimeout]).then(revealPage);

      history.scrollRestoration = 'manual';

      var scrollKey = 'scrollPos_' + location.pathname;
      var cocMain = document.querySelector('.coc-main');

      // Save on scroll inside .coc-main
      cocMain.addEventListener('scroll', function() {
        sessionStorage.setItem(scrollKey, cocMain.scrollTop);
      });

      // Restore on back navigation
      window.addEventListener('pageshow', function() {
        // An explicit #toc-<id> already in the URL (e.g. arriving from
        // another page's category TOC dropdown) means the cross-page
        // hash-scroll handler further down this file is about to
        // position the page itself — let that win instead of snapping
        // back to wherever this path happened to be scrolled to last.
        if (location.hash) return;
        var saved = sessionStorage.getItem(scrollKey);
        if (saved) {
          setTimeout(function() {
            cocMain.scrollTop = parseInt(saved);
          }, 100);
        }
      });
    } catch (err) {
  console.error('hwr-js.js block 8 failed:', err);
}


/* ==================== next block ==================== */

try {

      // ===================================================
      // BOTTOM NAV SCROLL LOCK HELPERS
      // ===================================================
      var bnScrollLockY = 0;

      function bnLockScroll() {
        bnScrollLockY = window.pageYOffset || document.documentElement.scrollTop || 0;
        // Measure how much space the scrollbar was taking up before we hide
        // it, and pad the page by that same amount so the total on-screen
        // width doesn't change when the scrollbar disappears. Without this,
        // width:100% elements (like the hero banner/background image) snap
        // wider to fill the space the scrollbar left behind.
        var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
          document.body.style.paddingRight = scrollbarWidth + 'px';
        }
        document.body.style.top = (-bnScrollLockY) + 'px';
        document.documentElement.classList.add('no-scroll');
      }

      function bnUnlockScroll() {
        document.documentElement.classList.remove('no-scroll');
        document.body.style.top = '';
        document.body.style.paddingRight = '';
        window.scrollTo(0, bnScrollLockY);
      }

      // ===================================================
      // MORE MENU (mobile bottom-sheet) — open/close + back-button support
      // ===================================================
      let moreMenuHistoryState = false;

      function openMoreMenu() {
        var overlay = document.getElementById('moreOverlay');
        var wrap = document.getElementById('bnMoreWrap');
        overlay.classList.add('open');
        if (wrap) wrap.classList.add('open');
        bnLockScroll();

        if (!moreMenuHistoryState) {
          history.pushState({
            moreMenuModal: true
          }, '');
          moreMenuHistoryState = true;
        }
      }

      function toggleMoreMenu() {
        var overlay = document.getElementById('moreOverlay');
        var isOpen = overlay.classList.contains('open');
        if (isOpen) {
          closeMoreMenu();
        } else {
          openMoreMenu();
        }
      }
      // `fromPopstate` is true when triggered by the back button/gesture itself —
      // in that case the browser is already consuming the history entry, so we
      // must NOT call history.back() again (that would navigate off the page).
      function closeMoreMenu(e, fromPopstate) {
        document.getElementById('moreOverlay').classList.remove('open');
        var wrap = document.getElementById('bnMoreWrap');
        if (wrap) wrap.classList.remove('open');
        bnUnlockScroll();

        if (moreMenuHistoryState) {
          moreMenuHistoryState = false;
          if (!fromPopstate) {
            history.back(); // cleans up the throwaway history entry pushed by openMoreMenu()
          }
        }
      }
      document.getElementById('moreOverlay').addEventListener('touchmove', function(e) {
        if (!e.target.closest('.more-sheet')) e.preventDefault();
      }, {
        passive: false
      });

      // Mobile back button / gesture support: closes the sheet instead of
      // leaving the page, if it happens to be open when back fires.
      window.addEventListener('popstate', () => {
        var overlay = document.getElementById('moreOverlay');
        if (overlay && overlay.classList.contains('open')) {
          closeMoreMenu(null, true);
        }
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeMoreMenu();
      });

      // DRAG-TO-CLOSE: dragging the handle down past ~28% of the sheet's
      // height (or a fast flick) closes the sheet; otherwise it snaps back.
      (function initMoreSheetDrag() {
        const sheet = document.querySelector('.more-sheet');
        const handle = document.querySelector('.more-sheet-handle');
        const overlay = document.getElementById('moreOverlay');
        if (!sheet || !handle || !overlay) return;

        let dragging = false;
        let startY = 0;
        let dragY = 0;
        let sheetHeight = 0;
        let lastY = 0;
        let lastT = 0;
        let velocity = 0;

        function onPointerDown(e) {
          dragging = true;
          startY = e.clientY;
          lastY = startY;
          lastT = Date.now();
          velocity = 0;
          sheetHeight = sheet.getBoundingClientRect().height || 1;
          sheet.classList.add('dragging');
          if (handle.setPointerCapture) handle.setPointerCapture(e.pointerId);
        }

        function onPointerMove(e) {
          if (!dragging) return;
          const now = Date.now();
          const dt = now - lastT;
          if (dt > 0) velocity = (e.clientY - lastY) / dt; // px per ms
          lastY = e.clientY;
          lastT = now;

          dragY = Math.max(0, e.clientY - startY);
          sheet.style.transform = `translateY(${dragY}px)`;
          overlay.style.opacity = String(1 - Math.min(dragY / sheetHeight, 1) * 0.9);
        }

        function onPointerUp() {
          if (!dragging) return;
          dragging = false;
          sheet.classList.remove('dragging');

          const pastThreshold = dragY > sheetHeight * 0.28;
          const fastFlick = velocity > 0.6; // flicked down quickly
          overlay.style.opacity = '';

          if (pastThreshold || fastFlick) {
            closeMoreMenu();
            requestAnimationFrame(() => {
              sheet.style.transform = '';
            });
          } else {
            sheet.style.transform = '';
          }
          dragY = 0;
        }

        handle.addEventListener('pointerdown', onPointerDown);
        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerUp);
        handle.addEventListener('pointercancel', onPointerUp);
      })();

      // ===================================================
      // SHARED — wires up a left/right-arrow horizontal scroll strip.
      // Used by both the desktop sub-nav category chips and the
      // Web Resources hub nav (Lobby/Bookmark/Contribute/Glossary),
      // which get squeezed at the same narrower widths and need the
      // exact same "hide the arrow you can't use" behavior. Returns
      // the updateArrows function so callers can re-run it after
      // injecting content whose width wasn't known up front.
      // ===================================================
      // initHScrollArrows() and the two strip wirings that used to live here
      // now live in 11layout.js, so the Minecraft/Clash bars can use the same
      // implementation instead of a second copy. window.updateDsnScrollArrows
      // is still set there and is still called from renderCategoryNav() below.

      // ===================================================
      // DESKTOP CATEGORY HOVER PANEL — one shared popover, reused for every
      // dsn-chip. renderCategoryNav() (below) wires each chip's mouseenter
      // to window.dsnHoverPanel.showFor(...) with that category's own
      // on-page sections already built into HTML, so this block only owns
      // the panel element itself: showing/hiding/positioning it, and
      // giving the mouse room to travel from the chip down into the panel
      // without it disappearing (a short hide delay, cancelled on re-entry).
      // ===================================================
      (function initDsnHoverPanel() {
        var panel = document.createElement('div');
        panel.className = 'dsn-hover-panel';
        panel.setAttribute('role', 'menu');
        panel.innerHTML =
          '<div class="dsn-hover-panel-title" id="dsnHoverPanelTitle"></div>' +
          '<div class="dsn-hover-panel-list" id="dsnHoverPanelList"></div>';
        document.body.appendChild(panel);

        var titleEl = panel.querySelector('#dsnHoverPanelTitle');
        var listEl = panel.querySelector('#dsnHoverPanelList');
        var hideTimer = null;

        function clearHideTimer() {
          if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
          }
        }

        function hideNow() {
          clearHideTimer();
          panel.classList.remove('open');
        }

        function scheduleHide() {
          clearHideTimer();
          hideTimer = setTimeout(hideNow, 150);
        }

        function showFor(chip, name, itemsHtml) {
          clearHideTimer();
          titleEl.textContent = name;
          listEl.innerHTML = itemsHtml;
          applyDsnHoverCurrentState();
          panel.classList.add('open');
          var r = chip.getBoundingClientRect();
          var panelWidth = panel.offsetWidth || 220;
          var left = Math.min(r.left, window.innerWidth - panelWidth - 12);
          left = Math.max(left, 12);
          panel.style.left = left + 'px';
          panel.style.top = (r.bottom + 8) + 'px';
        }

        // Rows here are rebuilt fresh on every hover (see showFor above), so
        // rather than an IntersectionObserver watching elements that don't
        // persist, this just re-checks the id the scroll-spy last landed on
        // (window.hwrScrollSpyCurrentId, set in initHwrScrollSpy) each time
        // the popover opens and marks the matching row, if any, as current.
        // Only ever matches when hovering the CURRENT page's own chip, since
        // every other category's rows link out to a different page.
        function applyDsnHoverCurrentState() {
          var id = window.hwrScrollSpyCurrentId;
          var items = listEl.querySelectorAll('.dsn-hover-item');
          for (var i = 0; i < items.length; i++) {
            var href = items[i].getAttribute('href') || '';
            var hashIdx = href.indexOf('#');
            var itemId = hashIdx >= 0 ? href.slice(hashIdx + 1) : '';
            items[i].classList.toggle('is-current', !!id && itemId === id);
          }
        }

        panel.addEventListener('mouseenter', clearHideTimer);
        panel.addEventListener('mouseleave', scheduleHide);
        window.addEventListener('resize', hideNow);

        window.dsnHoverPanel = {
          showFor: showFor,
          scheduleHide: scheduleHide,
          hideNow: hideNow,
          refresh: applyDsnHoverCurrentState
        };
      })();

      // ===================================================
      // FILTER PILL ROW — horizontal scroll arrows (desktop only)
      // ===================================================
      (function initPillScroll() {
        var scrollEl = document.getElementById('filterPillWrap');
        var leftBtn = document.getElementById('pillScrollLeft');
        var rightBtn = document.getElementById('pillScrollRight');
        if (!scrollEl || !leftBtn || !rightBtn) return;

        function updateArrows() {
          var maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
          leftBtn.classList.toggle('is-hidden', scrollEl.scrollLeft <= 4);
          rightBtn.classList.toggle('is-hidden', scrollEl.scrollLeft >= maxScroll - 4 || maxScroll <= 0);
        }
        leftBtn.addEventListener('click', function() {
          scrollEl.scrollBy({
            left: -200,
            behavior: 'smooth'
          });
        });
        rightBtn.addEventListener('click', function() {
          scrollEl.scrollBy({
            left: 200,
            behavior: 'smooth'
          });
        });
        scrollEl.addEventListener('scroll', updateArrows, {
          passive: true
        });
        window.addEventListener('resize', updateArrows);
        updateArrows();
      })();

      // Highlight the active bottom-nav / desktop sub-nav / mobile "More" sheet item based on current page
      function highlightActiveNavItems() {
        function baseName(filename) {
          return (filename || '').replace(/(\D)\d+\.html$/i, '$1.html');
        }
        var page = hwrPageKey(window.location.pathname);
        // NOTE: .bn-item / .dsn-link are intentionally left out of this auto-highlight —
        // Home is hardcoded active on this page since it's the web resources hub.
        document.querySelectorAll('.dsn-chip, a.th-mini').forEach(function(el) {
          var href = hwrPageKey(el.getAttribute('href'));
          el.classList.toggle('active', href === page);
        });
      }
      highlightActiveNavItems();

      // ===================================================
      // CATEGORY NAV — built from hwr-categories.json
      // Add/remove/edit entries in that file (name, link, icon) and both
      // the desktop sub-nav strip and the mobile "More" sheet list update
      // automatically. No limit on how many you add:
      //  - Desktop: chips overflow into the horizontally-scrollable strip
      //    (left/right arrows already show/hide themselves via
      //    initDsnCategoriesScroll's updateArrows()).
      //  - Mobile: the th-mini-grid is a single-column list, so extra items
      //    simply stack as additional rows automatically.
      //
      // Every row's chevron is a dropdown toggle holding that category's
      // own on-page sections (hwr-categories.json → sections[<that page>]):
      //  - The CURRENT page's row starts open, and its items are in-page
      //    scroll links (href="#toc-<id>", closes the sheet + smooth
      //    scrolls via hwrScrollToToc) since you're already there.
      //  - Every OTHER row starts closed, and its items are plain links to
      //    that category's own page + anchor (href="/web-resources/movies#toc-
      //    <id>") — a normal navigation that lands on/scrolls to that
      //    section once you arrive, same as any anchor link would.
      // A category with no sections entry yet falls back to a plain link
      // row (no dropdown) so nothing breaks before its placeholder/real
      // sections are added to hwr-categories.json.
      // ===================================================
      // toggleThMiniDropdown() lives in 11layout.js now — shared with the
      // other sections that use the same More sheet.

      function renderCategoryNav(data) {
        var categories = data.categories || [];
        var allSections = data.sections || {};
        var currentFile = hwrPageKey(location.pathname);

        var dsnScroll = document.getElementById('dsnCategoriesScroll');
        var thGrid = document.getElementById('thMiniGrid');
        if (!dsnScroll || !thGrid) return;

        var dsnHtml = '';
        var thHtml = '';
        categories.forEach(function(cat) {
          var iconSrc = cat.icon || '';
          var name = cat.name || '';
          var link = cat.link || '#';
          var isCurrent = hwrPageKey(link) === currentFile;
          var pageSections = allSections[link];
          // This category's own cat slug (not the current page's) — lets
          // the count badges below be counted from window.HwrWebsitesData
          // even for a category whose card-list containers don't exist
          // anywhere in this page's DOM.
          var catSlug = (window.HWR_PAGE_CAT_MAP && window.HWR_PAGE_CAT_MAP[link]) || '';

          dsnHtml += '<a href="' + link + '" class="dsn-chip">' +
            '<img class="dsn-chip-icon" src="' + iconSrc + '" alt="">' + name +
            '</a>';

          // No sections defined for this category yet — plain link row,
          // same as before, no dropdown to expand into.
          if (!Array.isArray(pageSections) || !pageSections.length) {
            thHtml += '<a href="' + link + '" class="th-mini' + (isCurrent ? ' active' : '') + '">' +
              '<img src="' + iconSrc + '" alt="">' +
              '<span>' + name + '</span>' +
              '<svg class="th-mini-chevron" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
              '</a>';
            return;
          }

          var tocHtml = pageSections.map(function(sec) {
            var anchorId = 'toc-' + sec.id;
            var itemHref = isCurrent ? ('#' + anchorId) : (link + '#' + anchorId);
            var itemClick = isCurrent ? (' onclick="hwrScrollToToc(event,\'' + anchorId + '\',true)"') : '';
            // noCardList sections (e.g. a page's own Glossary) have no
            // group/containerId to count against — same as the sidebar
            // and box-three TOC rows above, drop the badge instead of
            // showing a permanently-wrong "0".
            var countBadge = sec.noCardList ? '' :
              '<span class="stb-toc-count" data-count-for="' + sec.containerId + '" data-cat="' + catSlug + '" data-group="' + (sec.group || '') + '">0</span>';
            return '<a href="' + itemHref + '" class="stb-toc-card"' + itemClick + '>' +
              hwrSectionIconSvg(sec, 'stb-toc-icon') +
              '<span class="stb-toc-name">' + sec.title + '</span>' +
              countBadge +
              '</a>';
          }).join('');

          thHtml += '<div class="th-mini-wrap' + (isCurrent ? ' open' : '') + '">' +
            '<div class="th-mini-toggle' + (isCurrent ? ' active' : '') + '">' +
            '<a href="' + link + '" class="th-mini th-mini-link' + (isCurrent ? ' active' : '') + '">' +
            '<img src="' + iconSrc + '" alt="">' +
            '<span>' + name + '</span>' +
            '</a>' +
            '<button type="button" class="th-mini-chevron-btn" onclick="toggleThMiniDropdown(this)" aria-label="Toggle ' + name + ' sections">' +
            '<svg class="th-mini-chevron" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</button>' +
            '</div>' +
            '<div class="th-mini-dropdown"><div class="th-mini-dropdown-inner"><div class="stb-toc-grid">' + tocHtml + '</div></div></div>' +
            '</div>';
        });
        dsnScroll.innerHTML = dsnHtml;
        thGrid.innerHTML = thHtml;

        // Desktop hover panels — same on-page sections as each category's
        // mobile dropdown, shown on mouseenter instead of tap. Paired up by
        // index since dsnHtml above has exactly one chip per category, in
        // the same order, with nothing skipped.
        if (window.dsnHoverPanel) {
          var dsnChips = dsnScroll.querySelectorAll('.dsn-chip');
          categories.forEach(function(cat, i) {
            var chip = dsnChips[i];
            var link = cat.link || '#';
            var pageSections = allSections[link];
            if (!chip || !Array.isArray(pageSections) || !pageSections.length) return;

            var isCurrent = hwrPageKey(link) === currentFile;
            var itemsHtml = pageSections.map(function(sec) {
              var anchorId = 'toc-' + sec.id;
              var itemHref = isCurrent ? ('#' + anchorId) : (link + '#' + anchorId);
              return '<a href="' + itemHref + '" class="dsn-hover-item">' +
                hwrSectionIconSvg(sec, 'dsn-hover-item-icon') +
                '<span>' + sec.title + '</span>' +
                '</a>';
            }).join('');

            chip.addEventListener('mouseenter', function() {
              window.dsnHoverPanel.showFor(chip, cat.name || '', itemsHtml);
            });
            chip.addEventListener('mouseleave', function() {
              window.dsnHoverPanel.scheduleHide();
            });
            chip.addEventListener('focus', function() {
              window.dsnHoverPanel.showFor(chip, cat.name || '', itemsHtml);
            });
            chip.addEventListener('blur', function() {
              window.dsnHoverPanel.scheduleHide();
            });
          });
          // The strip scrolls horizontally under a fixed-position panel —
          // once it moves, the panel's position no longer matches the chip
          // it was opened for, so close it rather than let it drift.
          if (!dsnScroll.dataset.hoverScrollBound) {
            dsnScroll.dataset.hoverScrollBound = '1';
            dsnScroll.addEventListener('scroll', function() {
              window.dsnHoverPanel.hideNow();
            }, {
              passive: true
            });
          }
        }

        // Re-run the bits that depend on these elements existing
        highlightActiveNavItems();
        if (typeof window.updateDsnScrollArrows === 'function') window.updateDsnScrollArrows();

        // Only now do BOTH the desktop .nav-chip rows (built earlier, in the
        // other HwrCategoriesPromise.then handler above) and these mobile
        // .stb-toc-card rows actually exist in the DOM — this .then() always
        // runs after that one (same promise, registered later = fires
        // later), so this is the first safe point to wire up the "you are
        // here" scroll-spy highlighter and have it see both sets of rows.
        initHwrScrollSpy();
      }

      window.HwrCategoriesPromise
        .then(function(data) {
          renderCategoryNav(data);
        })
        .catch(function(err) {
          console.error('Failed to load hwr-categories.json', err);
        });


      // ===================================================
      // RECOMMENDED TOOLS — built from hwr-recommended.json
      // Add/remove/edit entries in that file (name, tag, blurb, icon, link)
      // and the grid below the Website Categories section updates
      // automatically. Uses the same responsive grid the categories
      // grid uses, so any number of tools just wraps onto new rows.
      // ===================================================
      function renderRecommendedTools(tools) {
        var grid = document.getElementById('recommendedGrid');
        if (!grid) return;
        var html = '';
        tools.forEach(function(tool) {
          html += '<a class="tool-card" href="' + tool.link + '" target="_blank" rel="noopener noreferrer">' +
            '<div class="tool-card-top">' +
            '<img class="tool-card-icon" src="' + tool.icon + '" alt="">' +
            '<div>' +
            '<p class="tool-card-name">' + tool.name + '</p>' +
            '<span class="tool-card-tag">' + tool.tag + '</span>' +
            '</div>' +
            '</div>' +
            '<p class="tool-card-blurb">' + tool.blurb + '</p>' +
            '<span class="tool-card-visit">Visit site ' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>' +
            '</span>' +
            '</a>';
        });
        grid.innerHTML = html;
      }

      fetch('/hwr-recommended.json')
        .then(function(res) {
          return res.json();
        })
        .then(function(tools) {
          renderRecommendedTools(tools);
        })
        .catch(function(err) {
          console.error('Failed to load hwr-recommended.json', err);
        });
    } catch (err) {
  console.error('hwr-js.js block 9 failed:', err);
}


/* ==================== next block ==================== */

try {

      window.HwrCategoriesPromise
        .then(function(data) {
          var categories = data.categories;
          var currentFile = hwrPageKey(location.pathname);
          var match = categories.find(function(cat) {
            return hwrPageKey(cat.link) === currentFile;
          });
          if (!match) return;
          var textEl = document.getElementById('scMobileText');
          if (textEl) {
            textEl.textContent = match.name;
          }

          // "On This Page" icon — same per-page icon as the mobile top-bar
          // one below, shown at all breakpoints (not device-conditional).
          var tocIconEl = document.getElementById('navPanelTocIcon');
          if (tocIconEl) {
            tocIconEl.src = match.icon;
            tocIconEl.alt = match.name;
          }

          // Only one icon can show at a time — on mobile the single
          // .th-icon swaps to the page's favicon; on desktop it stays
          // untouched (web-resources.svg), so we only overwrite src there.
          var iconEl = document.getElementById('secondaryTopIcon');
          var originalIconSrc = iconEl ? iconEl.getAttribute('src') : null;
          var originalIconAlt = iconEl ? iconEl.getAttribute('alt') : null;
          var applyMobileIcon = function() {
            if (!iconEl) return;
            if (window.matchMedia('(max-width:970px)').matches) {
              if (iconEl.src !== match.icon) {
                iconEl.src = match.icon;
                iconEl.alt = match.name;
              }
            } else {
              if (iconEl.getAttribute('src') !== originalIconSrc) {
                iconEl.src = originalIconSrc;
                iconEl.alt = originalIconAlt;
              }
            }
          };
          applyMobileIcon();
          window.addEventListener('resize', applyMobileIcon);
        })
        .catch(function(err) {
          console.error('Failed to load hwr-categories.json', err);
        });
    } catch (err) {
  console.error('hwr-js.js block 10 failed:', err);
}
/* ==================== next block ==================== */

try {

      // ===================================================
      // CROSS-PAGE TOC HASH SCROLL — a dsn-chip / mobile "More" sheet TOC
      // row for a category page you're NOT currently on is a plain link
      // to "hwr-x.html#toc-<id>" (see renderCategoryNav in the CATEGORY
      // NAV block above), so clicking it is a real page load, not an
      // in-page jump. The browser tries its own native scroll-to-
      // fragment the moment that new page appears — but '#toc-<id>' is
      // a heading this same script only creates once hwr-categories.json
      // has been fetched (see the PAGE SECTIONS block above), and the
      // real card list under it — plus every section above it, which
      // can push it further down the page once loaded — doesn't finish
      // until hwr-websites.json's own fetch resolves and
      // 'websitesRendered' fires. So the native jump either finds
      // nothing yet and silently gives up, or lands on a still-empty
      // section that then jumps again once real content loads in above
      // it. Fix: don't rely on the native jump at all — wait for both
      // loads to actually finish, then scroll ourselves.
      // ===================================================
      (function initCrossPageTocHashScroll() {
        var anchorId = (location.hash || '').slice(1);
        if (!anchorId) return;

        var categoriesDone = false;
        var websitesDone = false;
        var fired = false;

        function tryScroll() {
          if (fired || !categoriesDone || !websitesDone) return;
          fired = true;
          var target = document.getElementById(anchorId);
          if (!target) return;
          // Smooth to match hwrScrollToToc's own same-page jumps — this
          // just lands here later (once cross-page loads finish) rather
          // than instantly, so it doesn't feel like a teleport. Falls
          // back to instant for anyone with reduced-motion set.
          var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          target.scrollIntoView({
            behavior: reduceMotion ? 'auto' : 'smooth',
            block: 'start'
          });
        }

        (window.HwrCategoriesPromise || Promise.resolve())
          .then(function() {
            categoriesDone = true;
            tryScroll();
          })
          .catch(function() {
            categoriesDone = true;
            tryScroll();
          });

        document.addEventListener('websitesRendered', function() {
          websitesDone = true;
          tryScroll();
        }, {
          once: true
        });

        // Safety net — pages with no lazy-loaded card list at all (or a
        // slow/broken hwr-websites.json fetch) would otherwise wait
        // forever for an event that never fires. 5s is generous next to
        // how fast both fetches normally resolve, so it's never felt on
        // a working page, but guarantees we still attempt the scroll.
        setTimeout(function() {
          categoriesDone = true;
          websitesDone = true;
          tryScroll();
        }, 5000);
      })();
    } catch (err) {
  console.error('hwr-js.js block 11 failed:', err);
}

/* ==========================================================================
   GLOSSARY — builds every glossary <dl class="glossary-list"> on the page
   from hwr-categories.json's "glossary.pages" object instead of hardcoded
   HTML. Runs on every page (via the shared hwr-js.js include) but no-ops
   if there's no .glossary-list on the page, so it's safe to paste in once.

   Works for both layouts:
   - A category page (/web-resources/ai-tools, /web-resources/anime, etc.) has ONE section:
     <dl class="glossary-list" id="glossaryList"> with no data attribute --
     falls back to the current page's own filename to look itself up.
   - /web-resources/glossary has MULTIPLE sections, one per category, each its
     own layouts-title-box + <dl id="glossaryList-<slug>"
     data-glossary-page="hwr-<page>.html"> + view-more button -- the
     data-glossary-page attribute says which page's terms that section
     shows.

   Each section's count badge and view-more button are found by matching
   id suffix: "glossaryList-ai" -> "glossaryCount-ai" / "glossaryViewMoreBtn-ai"
   (a bare "glossaryList" -> a bare "glossaryCount" / "glossaryViewMoreBtn").

   To add/edit/remove a term from now on: edit hwr-categories.json only,
   under glossary.pages["hwr-<page>.html"].terms — no HTML editing needed
   on the category page OR on /web-resources/glossary.
   ========================================================================== */
(function () {
  var listEls = document.querySelectorAll('.glossary-list');
  if (!listEls.length) return; // this page has no glossary section(s)

  fetch('/hwr-categories.json')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var pages = data.glossary && data.glossary.pages;
      if (!pages) return;

      listEls.forEach(function (listEl) {
        var pageKey = listEl.getAttribute('data-glossary-page') || location.pathname;
        var page = hwrLookup(pages, pageKey);
        var terms = page && page.terms;
        if (!terms || !terms.length) return;

        var suffix = listEl.id.replace(/^glossaryList/, ''); // '' or '-ai', '-anime', ...
        var countEl = document.getElementById('glossaryCount' + suffix);
        var moreBtn = document.getElementById('glossaryViewMoreBtn' + suffix);

        var frag = document.createDocumentFragment();
        terms.forEach(function (t) {
          var item = document.createElement('div');
          item.className = 'glossary-item';

          var dt = document.createElement('dt');
          dt.className = 'glossary-term';
          dt.textContent = t.term;

          var dd = document.createElement('dd');
          dd.className = 'glossary-def';
          dd.textContent = t.def;

          item.appendChild(dt);
          item.appendChild(dd);
          frag.appendChild(item);
        });

        listEl.innerHTML = '';
        listEl.appendChild(frag);

        if (countEl) {
          countEl.textContent = terms.length + (terms.length === 1 ? ' term' : ' terms');
        }

        initGlossaryViewMore(listEl, moreBtn);
      });
    })
    .catch(function (err) {
      console.error('Glossary failed to load:', err);
    });

  // Collapses one section's list down to its button's data-limit items and
  // wires up the "View All" / "Show Less" toggle. Written self-contained
  // here (rather than assuming a generic .view-more-btn handler already
  // exists elsewhere) since each list is built asynchronously, after any
  // handler bound on page load would already have run and found nothing to
  // collapse. If your existing hwr-js.js already has a generic view-more
  // handler that also targets these buttons, remove that targeting to
  // avoid a double click-listener — this block fully replaces it for every
  // glossary section.
  function initGlossaryViewMore(listEl, btn) {
    if (!btn) return;
    var items = listEl.querySelectorAll('.glossary-item');

    // Two limits: the full one for desktop and a shorter one for <=970px,
    // where ten definition rows is most of a screen before you reach
    // anything else. Both are read from the button so a section can
    // override either without touching this file.
    var fullLimit   = parseInt(btn.getAttribute('data-limit'), 10) || 10;
    var mobileLimit = parseInt(btn.getAttribute('data-limit-mobile'), 10) || 5;
    var mq = window.matchMedia('(max-width: 970px)');

    var expanded = false;
    var label = btn.querySelector('span');

    function currentLimit() {
      return mq.matches ? mobileLimit : fullLimit;
    }

    function apply() {
      var limit = currentLimit();
      items.forEach(function (item, i) {
        item.style.display = (expanded || i < limit) ? '' : 'none';
      });
      // Whether the button is needed at all depends on the limit in force,
      // so this is decided here rather than once up front -- a section with
      // 7 terms hides nothing on desktop but hides 2 on a phone.
      btn.style.display = items.length <= limit ? 'none' : '';
      if (label) label.textContent = expanded ? 'Show Less' : 'View All';
      btn.classList.toggle('is-expanded', expanded);
    }

    apply();

    btn.addEventListener('click', function () {
      expanded = !expanded;
      apply();
    });

    // Crossing the breakpoint changes how many rows should be hidden, so
    // re-apply on the change instead of only at load. addListener is the
    // deprecated form, kept for older Safari.
    if (mq.addEventListener) {
      mq.addEventListener('change', apply);
    } else if (mq.addListener) {
      mq.addListener(apply);
    }
  }
})();


/* ===================================================
   ADAPTIVE SECTION TITLES (phones only, <=600px)

   .layouts-title is a flex row of [icon][span]. On a narrow screen a long
   section name used to wrap onto a second line, which pushed the whole
   list down and made section headers different heights. Instead the text
   now stays on one line and the font-size steps down until it fits.

   Measured rather than computed from character count, because the font is
   Orbitron at weight 900 with 1px letter-spacing -- the rendered width of
   a title is not proportional to how many letters it has.

   Floor is 11px. A title still too wide at 11px is ellipsised by the CSS,
   so it is always exactly one line either way.
   =================================================== */
var HWR_TITLE_MIN_PX = 11;
var HWR_TITLE_STEP = 0.5;

function hwrFitLayoutTitles() {
  var titles = document.querySelectorAll('.layouts-title');
  if (!titles.length) return;

  var phone = window.matchMedia('(max-width: 600px)').matches;

  Array.prototype.forEach.call(titles, function(title) {
    var span = title.querySelector('span');
    if (!span) return;

    // Always clear first: this also restores the stylesheet's clamp() when
    // the viewport grows back past 600px, so rotating a phone to landscape
    // or resizing a desktop window never leaves a stale inline size behind.
    title.style.fontSize = '';
    if (!phone) return;

    var size = parseFloat(window.getComputedStyle(title).fontSize);
    if (!size) return;

    // scrollWidth is the full text width, clientWidth what the flex item
    // was actually given. The 0.5 guard keeps sub-pixel rounding from
    // triggering a shrink that is not needed.
    var guard = 0;
    while (span.scrollWidth > span.clientWidth + 0.5 &&
           size > HWR_TITLE_MIN_PX &&
           guard++ < 120) {
      size -= HWR_TITLE_STEP;
      title.style.fontSize = size + 'px';
    }
  });
}
window.hwrFitLayoutTitles = hwrFitLayoutTitles;

(function initLayoutTitleFit() {
  // Web fonts change text width when they swap in, so an early measurement
  // can be wrong. Re-run once the real font is in use.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(hwrFitLayoutTitles);
  }

  var t = null;
  window.addEventListener('resize', function() {
    clearTimeout(t);
    t = setTimeout(hwrFitLayoutTitles, 120);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hwrFitLayoutTitles);
  } else {
    hwrFitLayoutTitles();
  }
})();
