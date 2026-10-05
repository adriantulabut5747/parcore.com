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

// NOTE: sidebar logic (normalizePage, currentPage, buildSidebarFromJSON,
// toggleSidebar, toggleTripleA, handleDesktopSidebar, etc.), top-bar
// scrollToTop, help popup toggle, and the top-bar search modal now all
// live in 11layout.js, which must be loaded before this file.

// PAGE LOADER -- covers the page only until its frame is ready: the top
// bar, the secondary top bar (its chips + the strip come from
// coc-nav-data.json) and the sidebar (sidebar.json). The content below
// shows its own skeletons while it loads, so the loader doesn't wait for
// it -- it used to wait for window 'load', i.e. every image on the page,
// which hid the skeletons behind it. A 2s cap means a slow file can never
// keep it up; 'load' stays as a last resort.
(function pageLoader() {
  let done = false;
  function hide() {
    if (done) return;
    done = true;
    document.documentElement.classList.add('loaded'); // reveals body
    const loader = document.getElementById('page-loader');
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 400); // matches the 0.4s fade
    }
  }
  const navReady = new Promise((res) => document.addEventListener('parchome:coc-nav-ready', res, { once: true }));
  document.addEventListener('DOMContentLoaded', () => {
    // 11layout.js (deferred) has run by now; its loadSidebarData() is the
    // sidebar's own fetch -- asking again shares that request, no refetch.
    const sidebar = typeof loadSidebarData === 'function' ? loadSidebarData() : null;
    const fonts = document.fonts ? document.fonts.ready : null;
    Promise.all([sidebar, fonts, navReady]).then(hide, hide);
    setTimeout(hide, 2000);
  });
  window.addEventListener('load', hide);
})();

function toggleCC(el) {
  const popup = el.parentElement.querySelector('.cc-popup');
  const isOpen = popup.style.display === 'block';

  // Close all other popups
  document.querySelectorAll('.cc-popup').forEach((p) => {
    p.style.display = 'none';
  });

  popup.style.display = isOpen ? 'none' : 'block';
}

// Keyboard support for the CC-popup triggers (they're divs with
// role="button"/tabindex so Enter/Space need to be wired up manually).
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('image-logo')) {
    e.preventDefault();
    toggleCC(e.target);
  }
});

// Close when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.image-logo') && !e.target.closest('.cc-popup')) {
    document.querySelectorAll('.cc-popup').forEach((p) => {
      p.style.display = 'none';
    });
  }
});
// Clan tag copy. Guarded -- #clan-tag only exists on pages that show it
// (e.g. /coc/), and this script is shared site-wide. An unguarded
// lookup here used to throw on every page without it, which silently
// killed every line after this one in the file (including the event
// timers further down) since one uncaught error stops the whole script.
const clanTag = document.getElementById('clan-tag');
const copyMsg = document.getElementById('copy-msg');

if (clanTag && copyMsg) {
  clanTag.addEventListener('click', () => {
    navigator.clipboard
      .writeText(clanTag.textContent)
      .then(() => {
        copyMsg.style.display = 'block';
        setTimeout(() => {
          copyMsg.style.display = 'none';
        }, 1500);
      })
      .catch((err) => console.error('Failed to copy: ', err));
  });
}

// NOTE: old .zoomable auto-click-listener + zoomImage/closeZoom removed.
// Zoomable images now use the Palette Lightbox system (see bottom of this file)
// via inline onclick="openPalette(this)" on each <img class="zoomable">.

// ---- Town Hall strip (#second-layer-container) scroll position ----------
// Tapping a TH chip saves how far the strip is scrolled; the next page puts
// it back, so the chip you tapped (e.g. TH12) is still in view instead of
// the strip jumping back to TH18. Arriving any other way (search, the home
// page, a link) centres the current TH's chip instead.
// The saved position is used ONCE and only if the current chip is fully
// visible there; otherwise the chip is centred. (It used to stay in
// sessionStorage forever, so after one tap every later visit -- even from
// search -- restored that stale spot.)
// Runs when the chips exist: they're built from coc-nav-data.json after a
// fetch (parchome:coc-nav-ready below). The old window 'load' listener often
// ran before that, found an empty strip and left it at TH18.
function goToTH(url, btn) {
  const container = document.getElementById('second-layer-container');
  if (container) {
    try {
      sessionStorage.setItem('secondLayerScroll', container.scrollLeft);
    } catch (e) {}
  }
  window.location.href = url;
}

(function thStripPosition() {
  let saved = null;
  try {
    // storage can be blocked (private modes); then it just centres
    saved = sessionStorage.getItem('secondLayerScroll');
    sessionStorage.removeItem('secondLayerScroll'); // one use only
  } catch (e) {}
  let userScrolled = false;

  function place() {
    const box = document.getElementById('second-layer-container');
    const active = box && box.querySelector('button.active');
    if (!active || userScrolled) return;
    const boxRect = box.getBoundingClientRect();
    function chipVisibleAt(left) {
      const x = active.getBoundingClientRect().left - boxRect.left + box.scrollLeft - left;
      return x >= 0 && x + active.offsetWidth <= box.clientWidth;
    }
    let left;
    if (saved !== null && chipVisibleAt(parseFloat(saved))) {
      left = parseFloat(saved);
    } else {
      left = box.scrollLeft + (active.getBoundingClientRect().left - boxRect.left) - box.clientWidth / 2 + active.offsetWidth / 2;
    }
    box._autoScrollAt = Date.now(); // lets the strip's scroll-hint line ignore this scroll (th-layouts.js)
    box.scrollTo({ left: left, behavior: 'instant' }); // not 'auto': that follows any CSS smooth scrolling
  }

  document.addEventListener('parchome:coc-nav-ready', function () {
    const box = document.getElementById('second-layer-container');
    if (box) {
      // a swipe before the icons finish loading wins over the re-placement below
      box.addEventListener(
        'touchstart',
        function () {
          userScrolled = true;
        },
        { passive: true, once: true },
      );
      box.addEventListener(
        'wheel',
        function () {
          userScrolled = true;
        },
        { passive: true, once: true },
      );
    }
    place();
  });
  // Again once images have loaded, in case the chip icons changed the widths.
  window.addEventListener('load', place);
})();

// ---- Strip swipes stay sideways ---------------------------------------------
// The strip's CSS (touch-action: pan-x, th-layouts.css) stops the page
// scrolling under a swipe, but phone browsers still run their own
// pull-to-refresh on a downward drag that starts on it. So a drag that's
// more up/down than sideways is cancelled here; sideways ones scroll the
// strip as normal. passive:false is what lets preventDefault work.
(function stripLocksVertical() {
  let x0 = 0;
  let y0 = 0;
  let decided = false;
  let vertical = false;
  document.addEventListener(
    'touchstart',
    function (e) {
      if (!e.target.closest('#second-layer-container') || e.touches.length !== 1) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      decided = false;
      vertical = false;
    },
    { passive: true },
  );
  document.addEventListener(
    'touchmove',
    function (e) {
      if (!e.target.closest('#second-layer-container') || e.touches.length !== 1) return;
      if (!decided) {
        const dx = Math.abs(e.touches[0].clientX - x0);
        const dy = Math.abs(e.touches[0].clientY - y0);
        if (dx < 4 && dy < 4) return; // too small to tell yet
        decided = true;
        vertical = dy > dx;
      }
      if (vertical && e.cancelable) e.preventDefault();
    },
    { passive: false },
  );
})();

//copyclipboard ac clan box
const ascendereTag = document.getElementById('ascendere-clan-tag');
if (ascendereTag) {
  ascendereTag.addEventListener('click', () => {
    navigator.clipboard.writeText('#2GYPGPJP9').then(() => {
      const msg = document.getElementById('copy-msg');
      if (msg) {
        msg.style.display = 'block';
        setTimeout(() => {
          msg.style.display = 'none';
        }, 1500);
      }
    });
  });
}

// Top-bar search modal (herosearch.json fetch, shuffleArray,
// renderHeroSearchCard, searchItems, openSearch/closeSearch/toggleSearch,
// and the DOMContentLoaded init) moved to 11layout.js.

// NOTE: the old pin/unpin IntersectionObserver behavior for
// #second-layer-container (which made the TH switcher float and act
// like a floating bottom/top nav) has been removed. It now behaves as a
// normal static bar, same as /coc/.

// ===================================================
// BOTTOM NAV / DESKTOP SUB NAV / MORE MENU (shared)
// ===================================================
function bnLockScroll() {
  document.documentElement.classList.add('no-scroll');
  var cocMain = document.querySelector('.coc-main');
  if (cocMain) cocMain.style.overflow = 'hidden';
}
function bnUnlockScroll() {
  document.documentElement.classList.remove('no-scroll');
  var cocMain = document.querySelector('.coc-main');
  if (cocMain) cocMain.style.overflow = '';
}
function toggleMoreMenu() {
  var overlay = document.getElementById('moreOverlay');
  var wrap = document.getElementById('bnMoreWrap');
  var isOpen = overlay.classList.contains('open');
  if (isOpen) {
    overlay.classList.remove('open');
    if (wrap) wrap.classList.remove('open');
    bnUnlockScroll();
  } else {
    overlay.classList.add('open');
    if (wrap) wrap.classList.add('open');
    bnLockScroll();
  }
}
function closeMoreMenu(e) {
  document.getElementById('moreOverlay').classList.remove('open');
  var wrap = document.getElementById('bnMoreWrap');
  if (wrap) wrap.classList.remove('open');
  bnUnlockScroll();
}
document.getElementById('moreOverlay').addEventListener(
  'touchmove',
  function (e) {
    if (!e.target.closest('.more-sheet')) e.preventDefault();
  },
  { passive: false },
);

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
      // Remove 'open' now (inline transform still overrides visually),
      // then clear the inline transform next frame so the CSS
      // transition takes over and animates smoothly from the drag
      // position down to fully closed, instead of jumping.
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
// BOTTOM NAV AUTO-HIDE ON SCROLL (mobile, app-style)
// Visible by default. Hides as soon as you scroll down.
// Only comes back once you scroll UP a decent amount
// (a tiny upward nudge won't bring it back).
// NOTE: on mobile the page switches to body/window
// scrolling (see the max-width:970px overflow rule),
// so we read scroll position from window, not .coc-main.
// ===================================================
(function () {
  const bnBar = document.getElementById('bottomNav');
  const cocMain = document.querySelector('.coc-main');
  if (!bnBar) return;

  const DOWN_HIDE_THRESHOLD = 8; // px of downward travel before it hides
  const UP_SHOW_THRESHOLD = 55; // px of upward travel before it reappears
  const TOP_REVEAL_ZONE = 40; // always shown near the very top

  function getScrollY() {
    // Use whichever is actually scrolling: window (mobile) or .coc-main (desktop-ish)
    const winY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const mainY = cocMain ? cocMain.scrollTop : 0;
    return Math.max(winY, mainY);
  }

  let lastY = getScrollY();
  let upAccum = 0;
  let downAccum = 0;
  let ticking = false;

  function showNav() {
    bnBar.classList.remove('bn-hidden');
  }
  function hideNav() {
    bnBar.classList.add('bn-hidden');
  }

  function onScroll() {
    const currentY = getScrollY();
    const delta = currentY - lastY;

    if (currentY <= TOP_REVEAL_ZONE) {
      showNav();
      upAccum = 0;
      downAccum = 0;
      lastY = currentY;
      ticking = false;
      return;
    }

    if (delta > 0) {
      // scrolling down -> hide almost immediately
      downAccum += delta;
      upAccum = 0;
      if (downAccum > DOWN_HIDE_THRESHOLD) hideNav();
    } else if (delta < 0) {
      // scrolling up -> only reveal after a real upward gesture
      upAccum += -delta;
      downAccum = 0;
      if (upAccum > UP_SHOW_THRESHOLD) showNav();
    }

    lastY = currentY;
    ticking = false;
  }

  function requestTick() {
    if (!ticking) {
      window.requestAnimationFrame(onScroll);
      ticking = true;
    }
  }

  window.addEventListener('scroll', requestTick, { passive: true });
  if (cocMain) cocMain.addEventListener('scroll', requestTick, { passive: true });

  // Never keep it hidden while the "More" sheet is open
  const moreOverlay = document.getElementById('moreOverlay');
  if (moreOverlay) {
    new MutationObserver(function () {
      if (moreOverlay.classList.contains('open')) showNav();
    }).observe(moreOverlay, { attributes: true, attributeFilter: ['class'] });
  }
})();
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeMoreMenu();
});

// Highlight the active bottom-nav / desktop sub-nav / mobile "More" sheet item based on current page
(function highlightActiveNavItems() {
  // Treats numbered sub-pages (e.g. th18-layouts2.html, th18-layouts3.html)
  // as the same section as their base page (/coc/town-hall-18/layouts), since nav
  // links/icons only ever point to the base/page-1 URL.
  function baseName(filename) {
    return (filename || '').replace(/(\D)\d+\.html$/i, '$1.html');
  }
  var page = cocPagePath(window.location.pathname);
  document.querySelectorAll('.bn-item').forEach(function (el) {
    var href = cocPagePath(el.getAttribute('href'));
    el.classList.toggle('active', href === page);
  });
  document.querySelectorAll('.dsn-link').forEach(function (el) {
    var href = cocPagePath(el.getAttribute('href'));
    el.classList.toggle('active', href === page);
  });
  document.querySelectorAll('.dsn-mini, .dsn-guide-box, .dsn-guide-row').forEach(function (el) {
    var href = cocPagePath(el.getAttribute('href'));
    el.classList.toggle('active', href === page);
  });
  document.querySelectorAll('.th-mini, .more-row').forEach(function (el) {
    var href = cocPagePath(el.getAttribute('href'));
    el.classList.toggle('active', href === page);
  });
})();

// ===================================================
// PALETTE LIGHTBOX (zoomable image viewer, shared)
// ===================================================
// ── STATE ──
let palScale = 1;
let palPanX = 0,
  palPanY = 0;
let palIsPanning = false;
let palPanStartX = 0,
  palPanStartY = 0;
let palStartDist = 0,
  palLastScale = 1;

// ── HELPERS ──
function applyPalTransform() {
  document.getElementById('pal-lb-img').style.transform = `translate(${palPanX}px, ${palPanY}px) scale(${palScale})`;
}

function clampPalPan() {
  if (palScale <= 1) {
    palPanX = 0;
    palPanY = 0;
    return;
  }
  const img = document.getElementById('pal-lb-img');
  const maxX = Math.max(0, (img.offsetWidth * palScale - window.innerWidth) / 2);
  const maxY = Math.max(0, (img.offsetHeight * palScale - window.innerHeight) / 2);
  palPanX = Math.min(maxX, Math.max(-maxX, palPanX));
  palPanY = Math.min(maxY, Math.max(-maxY, palPanY));
}

function palEscHandler(e) {
  if (e.key === 'Escape') closePalette();
}

// ── OPEN ──
function openPalette(el) {
  const src = el.dataset.full || el.querySelector('img')?.src || el.src;
  const lb = document.getElementById('pal-lightbox');
  const img = document.getElementById('pal-lb-img');

  // Reset state
  palScale = 1;
  palPanX = 0;
  palPanY = 0;
  palIsPanning = false;
  img.src = src;
  img.style.transform = 'translate(0px,0px) scale(1)';
  img.style.cursor = 'default';

  lb.classList.add('open');
  history.pushState({ modal: true }, '');
  document.getElementById('pal-lb-close').style.display = 'flex';
  document.addEventListener('keydown', palEscHandler);

  // ── MOUSE WHEEL ZOOM ──
  lb.onwheel = (e) => {
    e.preventDefault();
    const rect = img.getBoundingClientRect();
    const cx = e.clientX - (rect.left + rect.width / 2);
    const cy = e.clientY - (rect.top + rect.height / 2);
    const prev = palScale;
    palScale = Math.min(Math.max(1, palScale * (1 - e.deltaY * 0.002)), 6);
    const ratio = palScale / prev;
    palPanX = palPanX * ratio + cx * (ratio - 1);
    palPanY = palPanY * ratio + cy * (ratio - 1);
    clampPalPan();
    applyPalTransform();
    img.style.cursor = palScale > 1 ? 'grab' : 'default';
  };

  // ── MOUSE DRAG ──
  img.onmousedown = (e) => {
    if (palScale <= 1) return;
    e.preventDefault();
    palIsPanning = true;
    palPanStartX = e.clientX - palPanX;
    palPanStartY = e.clientY - palPanY;
    img.style.cursor = 'grabbing';
  };
  window.onmousemove = (e) => {
    if (!palIsPanning) return;
    palPanX = e.clientX - palPanStartX;
    palPanY = e.clientY - palPanStartY;
    clampPalPan();
    applyPalTransform();
  };
  window.onmouseup = () => {
    if (!palIsPanning) return;
    palIsPanning = false;
    img.style.cursor = palScale > 1 ? 'grab' : 'default';
  };

  // ── TOUCH PINCH + PAN ──
  img.ontouchstart = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      palStartDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      palLastScale = palScale;
    } else if (e.touches.length === 1 && palScale > 1) {
      palIsPanning = true;
      palPanStartX = e.touches[0].clientX - palPanX;
      palPanStartY = e.touches[0].clientY - palPanY;
    }
  };
  img.ontouchmove = (e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const newDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      const prev = palScale;
      palScale = Math.min(Math.max(1, palLastScale * (newDist / palStartDist)), 6);
      const ratio = palScale / prev;
      const rect = img.getBoundingClientRect();
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - (rect.left + rect.width / 2);
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - (rect.top + rect.height / 2);
      palPanX = palPanX * ratio + cx * (ratio - 1);
      palPanY = palPanY * ratio + cy * (ratio - 1);
      clampPalPan();
      applyPalTransform();
    } else if (e.touches.length === 1 && palIsPanning) {
      palPanX = e.touches[0].clientX - palPanStartX;
      palPanY = e.touches[0].clientY - palPanStartY;
      clampPalPan();
      applyPalTransform();
    }
  };
  img.ontouchend = (e) => {
    if (e.touches.length < 2) palIsPanning = false;
    if (palScale <= 1) {
      palScale = 1;
      palPanX = 0;
      palPanY = 0;
    } else clampPalPan();
    applyPalTransform();
  };

  // Backdrop click closes, image click doesn't bubble up
  img.onclick = (e) => e.stopPropagation();
  lb.onclick = (e) => {
    if (e.target === lb) closePalette();
  };
}

// ── CLOSE ──
function closePalette() {
  const lb = document.getElementById('pal-lightbox');
  if (!lb.classList.contains('open')) return;
  lb.classList.remove('open');
  document.getElementById('pal-lb-close').style.display = 'none';
  palScale = 1;
  palPanX = 0;
  palPanY = 0;
  palIsPanning = false;
  window.onmousemove = null;
  window.onmouseup = null;
  document.removeEventListener('keydown', palEscHandler);
  if (history.state?.modal) history.back();
}

window.addEventListener('popstate', () => {
  const lb = document.getElementById('pal-lightbox');
  if (lb.classList.contains('open')) {
    lb.classList.remove('open');
    document.getElementById('pal-lb-close').style.display = 'none';
    palScale = 1;
    palPanX = 0;
    palPanY = 0;
    palIsPanning = false;
    window.onmousemove = null;
    window.onmouseup = null;
    document.removeEventListener('keydown', palEscHandler);
  }
});

/* EVENT TIMERS — moved to coc-events.js so /coc/ can use them
   without loading this whole file (footer injection, lightbox and the
   page-specific handlers here are not wanted there). Pages that show
   event rows load <script src="/coc-events.js"></script>. */
// ============================================================
// SITE FOOTER (single source of truth for all pages)
// To change the footer anywhere on the site, edit FOOTER_HTML
// below only — every page that has <div id="site-footer-mount">
// will pick up the change automatically.
// ============================================================
const FOOTER_HTML = `
<footer class="pf-footer">

  <div class="pf-footer-top">
    <div class="pf-footer-brand">
      <img src="/icons/home.jpg" alt="Parchrome" class="pf-footer-logo">
      <p class="pf-footer-tagline">Parchrome - all in one gaming portal, prioritizes quality over quantity</p>
    </div>
    <div class="pf-footer-social">
      <a href="#" aria-label="TikTok">
        <svg viewBox="0 0 24 24"><path d="M20 4a16 16 0 00-4-1l-.2.4a14 14 0 00-7.6 0L8 3A16 16 0 004 4C1 9 1 14 2 19a16 16 0 004.8 2.4l1-1.6a10 10 0 01-1.6-.8c.1 0 .2-.1.3-.2a12 12 0 0011 0c.1.1.2.1.3.2-.5.3-1 .6-1.6.8l1 1.6A16 16 0 0022 19c1-5 1-10-2-15zM9.5 15.5c-.9 0-1.5-.8-1.5-1.8s.7-1.8 1.5-1.8 1.6.8 1.5 1.8c0 1-.6 1.8-1.5 1.8zm5 0c-.9 0-1.5-.8-1.5-1.8s.7-1.8 1.5-1.8 1.6.8 1.5 1.8c0 1-.6 1.8-1.5 1.8z"/></svg>
      </a>
      <a href="https://discord.gg/rfntEJ5w" target="_blank" aria-label="Discord">
        <svg viewBox="0 0 24 24"><path d="M2 6l10 7 10-7v12H2V6zm10 5L2 6h20l-10 5z"/></svg>
      </a>
      <a href="#" aria-label="X">
        <svg viewBox="0 0 24 24"><path d="M3 3l7.5 9.6L3.4 21H6l5.8-6.6L16.5 21H21l-7.8-10L20.6 3H18l-5.3 6L8.5 3H3z"/></svg>
      </a>
    
    </div>
  </div>


  </div>

  <div class="pf-footer-divider"></div>

  <div class="pf-footer-bottom">
    <div class="pf-footer-legal">
      <a href="#">Terms of Service</a>
      <a href="#">Privacy Policy</a>
      <a href="#">Copyright Claims</a>
    </div>
      <div class="pf-footer-divider"></div>

    <div class="pf-footer-copyright">© 2025 Parchrome. All Rights Reserved.</div>
  </div>
  

</footer>
`;

function renderSiteFooter() {
  const mount = document.getElementById('site-footer-mount');
  if (mount) mount.innerHTML = FOOTER_HTML;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderSiteFooter);
} else {
  renderSiteFooter();
}

/* ===================================================================
   COC NAV LOADER — builds TH8-TH18 nav (dropdowns, more-sheet,
   bottom nav, first/second layer) from coc-nav-data.json.
   =================================================================== */
/*
  coc-nav-loader.js
  ------------------
  Builds every TH18->TH8 nav block (desktop-sub-nav dropdowns, the
  more-sheet modal, the bottom nav "bn-item" links, and the desktop
  "dsn-link" primary links) from coc-nav-data.json.

  The current townhall/guide is auto-detected from the page's own
  filename against each entry's "activeOn" list in the JSON — no
  per-page JS variable needed. That also drives the "active" class
  on the matching dsn-mini/th-mini/dsn-guide-box/more-row element.

  HOW TO USE ON EACH PAGE
  ------------------------
  1. Load the data + loader, before thz-script.js:
       <script src="/coc-nav-loader.js"></script>

  2. Give the layouts/armies/guides dropdown grids inside
     .desktop-sub-nav a data-role attribute instead of hardcoded <a> lists:
       <div class="dsn-dropdown-grid" data-role="layouts-grid"></div>
       <div class="dsn-dropdown-grid" data-role="armies-grid"></div>
       <div class="dsn-dropdown-guides-grid" data-role="guides-grid"></div>

  3. Same idea inside the more-sheet modal:
       <div class="th-mini-grid" data-role="more-layouts-grid"></div>
       <div class="th-mini-grid" data-role="more-armies-grid"></div>
       <div class="more-guides-list" data-role="more-guides-list"></div>

  4. Bottom nav + desktop sub nav primary links get data-role too, so the
     script can point them at the CURRENT townhall's pages:
       <a class="bn-item" data-role="bn-home">...</a>
       <a class="bn-item" data-role="bn-layouts">...</a>
       <a class="bn-item" data-role="bn-armies">...</a>
       <a class="bn-item" data-role="bn-guides">...</a>

       <a class="dsn-link" data-role="dsn-home">...</a>
       <a class="dsn-link" data-role="dsn-layouts">...</a>
       <a class="dsn-link" data-role="dsn-armies">...</a>
       <a class="dsn-link" data-role="dsn-guides">...</a>

  Text and icons already inside those tags stay put — only the href
  changes, so nothing about markup/SVGs/styling has to move.

  Now, updating a townhall (new TH, renamed icon, new guide) means
  editing ONE line in coc-nav-data.json instead of 40+ HTML files.
*/
(function () {
  var DATA_URL = '/coc-nav-data.json';
  var currentPage = cocPagePath(location.pathname);

  function isActive(activeOn) {
    return Array.isArray(activeOn) && activeOn.map(cocPagePath).indexOf(currentPage) !== -1;
  }

  // Is this page one of a tool's pages? Its activeOn list, or anything under
  // its activePrefix (the Player Tracker owns every /coc/player/<TAG>).
  function onTool(g) {
    return isActive(g.activeOn) || (!!g.activePrefix && currentPage.indexOf(g.activePrefix) === 0);
  }
  // On any tool page (live or upcoming), the Tools links light up.
  function inTools(data) {
    return data.guides.concat(data.upcoming || []).some(onTool);
  }

  function el(tag, className) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    return e;
  }

  function buildThMini(th, variant) {
    // variant: "dsn-mini" (desktop dropdown) or "th-mini" (more-sheet)
    var a = el('a', variant);
    a.href = th.href;
    var img = el('img');
    img.src = th.icon;
    img.alt = th.label;
    var span = el('span');
    span.textContent = th.label;
    a.appendChild(img);
    a.appendChild(span);
    if (isActive(th.activeOn)) a.classList.add('active');
    return a;
  }

  function buildLayoutsGrid(townhalls, variant) {
    var frag = document.createDocumentFragment();
    townhalls.forEach(function (th) {
      frag.appendChild(
        buildThMini({ id: th.id, label: th.label, icon: th.layoutIcon, href: th.layoutHref, activeOn: [th.layoutHref] }, variant),
      );
    });
    return frag;
  }

  function buildArmiesGrid(townhalls, variant) {
    var frag = document.createDocumentFragment();
    townhalls.forEach(function (th) {
      frag.appendChild(buildThMini({ id: th.id, label: th.label, icon: th.armyIcon, href: th.armyHref, activeOn: [th.armyHref] }, variant));
    });
    return frag;
  }

  function buildGuidesDropdown(guides) {
    var frag = document.createDocumentFragment();
    guides.forEach(function (g) {
      var a = el('a', 'dsn-guide-box');
      a.href = g.href;
      var img = el('img');
      img.src = g.icon;
      img.alt = g.label;
      var span = el('span');
      span.textContent = g.label;
      a.appendChild(img);
      a.appendChild(span);
      if (isActive(g.activeOn)) a.classList.add('active');
      frag.appendChild(a);
    });
    return frag;
  }

  // More sheet "Tools" tiles (redesigned Oct 2026; were .more-row rows):
  // icon tile + name. Styles: .mx-tool in coc-more.css.
  function buildGuidesMoreList(guides) {
    var frag = document.createDocumentFragment();
    guides.forEach(function (g) {
      var a = el('a', 'mx-tool');
      a.href = g.href;
      var ico = el('span', 'mx-tool-ico');
      var img = el('img');
      img.src = g.icon;
      img.alt = '';
      ico.appendChild(img);
      var name = el('span', 'mx-tool-name');
      name.textContent = g.label;
      a.appendChild(ico);
      a.appendChild(name);
      if (isActive(g.activeOn)) a.classList.add('active');
      frag.appendChild(a);
    });
    return frag;
  }

  function fillByRole(role, buildFn) {
    var nodes = document.querySelectorAll('[data-role="' + role + '"]');
    nodes.forEach(function (node) {
      node.innerHTML = '';
      node.appendChild(buildFn());
    });
  }

  function setPrimaryLinks(data) {
    // Figure out which townhall "owns" the current page (if any), so
    // LAYOUTS/ARMIES in the top nav point at that TH's other page.
    var th =
      data.townhalls.find(function (t) {
        return isActive(t.activeOn);
      }) || null;
    var activeGuide = inTools(data);
    var onHome = currentPage === cocPagePath(data.primaryNav.home.href);
    var nav = data.primaryNav;

    var map = {
      home: nav.home.href,
      layouts: th ? th.layoutHref : nav.layouts.href,
      armies: th ? th.armyHref : nav.armies.href,
      guides: nav.guides.href,
    };

    var iconMap = {
      home: nav.home.icon,
      layouts: th ? th.layoutIcon : nav.layouts.icon,
      armies: th ? th.armyIcon : nav.armies.icon,
      guides: nav.guides.icon,
    };

    var activeKey = onHome
      ? 'home'
      : activeGuide
        ? 'guides'
        : th && currentPage === cocPagePath(th.layoutHref)
          ? 'layouts'
          : th && currentPage === cocPagePath(th.armyHref)
            ? 'armies'
            : null;

    Object.keys(map).forEach(function (key) {
      var selector = '[data-role="bn-' + key + '"], [data-role="dsn-' + key + '"]';
      document.querySelectorAll(selector).forEach(function (link) {
        link.setAttribute('href', map[key]);
        link.classList.toggle('active', key === activeKey);

        // Swap the leading icon (originally an inline <svg>) for an <img>.
        // The dsn-caret (dropdown arrow svg, if present) is left alone.
        var existingIcon = link.querySelector('svg:not(.dsn-caret), img.nav-icon');
        // A page that ships its own inline <svg> icon keeps it. This used to
        // replaceWith() a raster <img> unconditionally, which is why
        // th18-layouts showed .png/.webp icons while coc-home (which does not
        // load this file) kept clean SVGs -- the two never matched. Pages with
        // no icon in their markup are unaffected: existingIcon is null there,
        // so they still get the raster injected exactly as before.
        if (existingIcon && existingIcon.tagName !== 'IMG') return;
        var img = existingIcon && existingIcon.tagName === 'IMG' ? existingIcon : el('img', 'nav-icon');
        img.src = iconMap[key];
        img.alt = nav[key].label;
        if (existingIcon && existingIcon !== img) {
          existingIcon.replaceWith(img);
        } else if (!existingIcon) {
          link.insertBefore(img, link.firstChild);
        }
      });
    });
  }

  // ---- First layer (Layouts / Army / Guides tab buttons) ----
  // Mirrors setPrimaryLinks' logic but renders <button onclick="location.href=...">
  // to match the existing first-layer markup exactly.
  function buildFirstLayer(data) {
    var th =
      data.townhalls.find(function (t) {
        return isActive(t.activeOn);
      }) || null;
    var activeGuide = inTools(data);
    var nav = data.primaryNav;

    var tabs = [
      { key: 'layouts', label: 'Layouts', href: th ? th.layoutHref : nav.layouts.href },
      { key: 'armies', label: 'Army', href: th ? th.armyHref : nav.armies.href },
      { key: 'guides', label: 'Tools', href: nav.guides.href },
    ];

    var activeKey = activeGuide
      ? 'guides'
      : th && currentPage === cocPagePath(th.layoutHref)
        ? 'layouts'
        : th && currentPage === cocPagePath(th.armyHref)
          ? 'armies'
          : null;

    var frag = document.createDocumentFragment();
    tabs.forEach(function (tab) {
      var btn = el('button');
      btn.textContent = tab.label;
      if (tab.key === activeKey) btn.classList.add('active');
      btn.addEventListener('click', function () {
        location.href = tab.href;
      });
      frag.appendChild(btn);
    });
    return frag;
  }

  // ---- Second layer (horizontal-scroll TH8-TH18 buttons) ----
  // Mode follows whichever section (layouts vs armies) the current page
  // belongs to, so clicking a TH button on an army page goes to that TH's
  // army page, and on a layouts page goes to that TH's layouts page.
  function detectMode(data) {
    var onLayout = data.townhalls.some(function (t) {
      return currentPage === cocPagePath(t.layoutHref);
    });
    if (onLayout) return 'layouts';
    var onArmy = data.townhalls.some(function (t) {
      return currentPage === cocPagePath(t.armyHref);
    });
    if (onArmy) return 'armies';
    return 'layouts'; // sensible default (e.g. guides pages that still show the strip)
  }

  // ---- Breadcrumb (secondary top bar, phones AND desktop since Oct 2026) ----
  // One trail on every CoC page except Clash home, built from coc-nav-data.json:
  //   Clash of Clans > TH18 Layouts > Page 1 of 3   (phones: "COC > ...")
  //   Clash of Clans > Army Maker
  // The page step waits for th-layouts.js to know the page count: it
  // fills [data-crumb-page], and also keeps the text on <html
  // data-page-label>, read here in case it got there first. A Town Hall
  // with no bases yet (no pages at all) never gets one. The trail replaces
  // the page's own title at every width (th-layouts.css, BREADCRUMB).
  function buildCrumbs(data) {
    var box = document.querySelector('.secondary-left .secondary-content');
    if (!box || box.querySelector('.stb-crumbs')) return;
    var nav = data.primaryNav || {};
    var trail = null;
    // Only steps that are real pages (Oct 2026): there's no "all layouts" or
    // "all armies" page, so no "Layouts" / "Armies" step -- the Town Hall
    // and the section are one step ("TH13 Layouts"). Same for tools: /coc/tools/
    // is the Websites page, not a tools index, so no "Tools" step either.
    data.townhalls.forEach(function (th) {
      if (currentPage === cocPagePath(th.layoutHref)) trail = [{ text: th.label + ' Layouts', href: th.layoutHref }];
      if (currentPage === cocPagePath(th.armyHref)) trail = [{ text: th.label + ' Armies', href: th.armyHref }];
    });
    var paged = !!trail;
    // A tool can ask for a parent step ("crumbParent", e.g. Tools) and can
    // own a whole address range ("activePrefix": the Player Tracker owns every
    // /coc/player/<TAG> profile). Both are set in coc-nav-data.json.
    data.guides.concat(data.upcoming || []).forEach(function (g) {
      if (onTool(g)) trail = (g.crumbParent ? [g.crumbParent] : []).concat({ text: g.name || g.label, href: g.href });
    });
    if (!trail) return;
    // Desktop has the room for the full name; phones keep "COC" (Oct 2026).
    trail.unshift({
      html: '<span class="stb-crumb-long">Clash of Clans</span><span class="stb-crumb-short">COC</span>',
      href: nav.home && nav.home.href,
    });

    // The desktop title: wrap its loose text so phones can hide it.
    [].slice.call(box.childNodes).forEach(function (n) {
      if (n.nodeType === 3 && n.textContent.trim()) {
        var t = el('span', 'stb-title');
        t.textContent = n.textContent.trim();
        box.replaceChild(t, n);
      }
    });
    var old = box.querySelector('.am-stb-crumbs'); // the maker pages' hand-written trail
    if (old) old.remove();

    var sep = '<span class="stb-crumb-sep" aria-hidden="true">›</span>';
    // Every step is a link (Oct 2026, his ask): Clash of Clans -> Clash home,
    // "TH13 Layouts" -> that Town Hall's page 1, the tool -> its page, and
    // "Page 2 of 4" -> this page (its address is read at click time, so it
    // follows ?page= changes).
    var html = trail
      .map(function (c, i) {
        var last = i === trail.length - 1 && !paged;
        var label = c.html || c.text;
        return '<a href="' + c.href + '"' + (last ? ' aria-current="page"' : '') + '>' + label + '</a>';
      })
      .join(sep);
    if (paged) {
      var txt = document.documentElement.dataset.pageLabel || '';
      html +=
        '<span class="stb-crumb-page"' +
        (txt ? '' : ' hidden') +
        '>' +
        sep +
        '<a href="' +
        location.pathname +
        location.search +
        '" data-crumb-page aria-current="page">' +
        txt +
        '</a></span>';
    }
    var crumbs = el('nav', 'stb-crumbs');
    crumbs.setAttribute('aria-label', 'Breadcrumb');
    crumbs.innerHTML = html;
    var pageLink = crumbs.querySelector('[data-crumb-page]');
    if (pageLink)
      pageLink.addEventListener('click', function () {
        pageLink.href = location.pathname + location.search;
      });
    box.appendChild(crumbs);
    box.classList.add('has-crumbs');
  }

  function buildSecondLayer(data) {
    var frag = document.createDocumentFragment();

    // Guides pages (coctools*.html): the strip switches between the guides
    // (Websites / Glossary / Equipments / Wall Calc.) instead of Town Halls.
    var onGuide = data.guides.some(function (g) {
      return isActive(g.activeOn);
    });
    if (onGuide) {
      data.guides.forEach(function (g) {
        var btn = el('button', 'th-btn');
        btn.setAttribute('data-guide', g.id);
        if (isActive(g.activeOn)) btn.classList.add('active');
        var img = el('img');
        img.src = g.icon;
        img.alt = '';
        btn.appendChild(img);
        // Full name ("Damage Calculator") while the strip fits; the short
        // label ("Damage Calc.") once it has to scroll -- fitStripLabels
        // swaps them.
        if (g.name && g.name !== g.label) {
          var full = el('span', 'lbl-full');
          full.textContent = g.name;
          var short = el('span', 'lbl-short');
          short.textContent = g.label;
          btn.appendChild(full);
          btn.appendChild(short);
        } else btn.appendChild(document.createTextNode(g.label));
        btn.addEventListener('click', function () {
          if (typeof window.goToTH === 'function') window.goToTH(g.href, btn);
          else location.href = g.href;
        });
        frag.appendChild(btn);
      });
      return frag;
    }

    var mode = detectMode(data);
    data.townhalls.forEach(function (th) {
      var href = mode === 'armies' ? th.armyHref : th.layoutHref;
      var icon = mode === 'armies' ? th.armyIcon : th.layoutIcon;

      var btn = el('button', 'th-btn');
      btn.setAttribute('data-th', 'TH-' + th.label.replace(/^TH/i, ''));
      if (currentPage === cocPagePath(href)) btn.classList.add('active');

      var img = el('img');
      img.src = icon;
      img.alt = th.label;
      btn.appendChild(img);
      btn.appendChild(document.createTextNode(th.label.replace(/^TH/i, '')));

      btn.addEventListener('click', function () {
        if (typeof window.goToTH === 'function') {
          window.goToTH(href, btn);
        } else {
          location.href = href;
        }
      });

      frag.appendChild(btn);
    });
    return frag;
  }

  // Tools strip: full names when every chip fits, short ones (.is-tight)
  // when the strip would have to scroll sideways (phones, narrow windows).
  // It measures with the full names showing, then decides; both happen in
  // the same frame, so nothing flickers. Re-checked when the strip resizes
  // and when the chip icons finish loading (they change the widths).
  function fitStripLabels() {
    var box = document.getElementById('second-layer-container');
    if (!box || !box.querySelector('.lbl-full')) return;
    function fit() {
      box.classList.remove('is-tight');
      if (box.scrollWidth > box.clientWidth + 1) box.classList.add('is-tight');
    }
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(box);
    box.querySelectorAll('img').forEach(function (img) {
      if (!img.complete) img.addEventListener('load', fit);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  }

  function init(data) {
    fillByRole('layouts-grid', function () {
      return buildLayoutsGrid(data.townhalls, 'dsn-mini');
    });
    fillByRole('armies-grid', function () {
      return buildArmiesGrid(data.townhalls, 'dsn-mini');
    });
    fillByRole('guides-grid', function () {
      return buildGuidesDropdown(data.guides);
    });

    fillByRole('more-layouts-grid', function () {
      return buildLayoutsGrid(data.townhalls, 'mx-th');
    });
    fillByRole('more-armies-grid', function () {
      return buildArmiesGrid(data.townhalls, 'mx-th');
    });
    fillByRole('more-guides-list', function () {
      return buildGuidesMoreList(data.guides);
    });

    fillByRole('first-layer', function () {
      return buildFirstLayer(data);
    });
    fillByRole('second-layer', function () {
      return buildSecondLayer(data);
    });
    fitStripLabels();

    // The secondary top bar's left icon matches the lit button in the strip
    // above: that TH's icon on a layouts page, its barracks on an army
    // page, the tool's own icon on a Tools page.
    buildCrumbs(data);

    var litIcon = document.querySelector('#second-layer .th-btn.active img');
    var leftIcon = document.querySelector('.secondary-left .th-icon');
    if (litIcon && leftIcon) leftIcon.src = litIcon.getAttribute('src');

    setPrimaryLinks(data);

    document.dispatchEvent(new CustomEvent('parchome:coc-nav-ready', { detail: data }));
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load ' + DATA_URL + ' (' + res.status + ')');
        return res.json();
      })
      .then(init)
      .catch(function (err) {
        console.error('[coc-nav-loader]', err);
      });
  });
})();
