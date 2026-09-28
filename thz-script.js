// NOTE: sidebar logic (normalizePage, currentPage, buildSidebarFromJSON,
// toggleSidebar, toggleTripleA, handleDesktopSidebar, etc.), top-bar
// scrollToTop, help popup toggle, and the top-bar search modal now all
// live in 11layout.js, which must be loaded before this file.

// PAGE LOADER — wait for ALL assets (images, fonts, etc.)
window.addEventListener('load', () => {
  document.documentElement.classList.add("loaded"); // reveals body
  const loader = document.getElementById('page-loader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 400); // matches your 0.4s transition
  }
});



function toggleCC(el) {
  const popup = el.parentElement.querySelector('.cc-popup');
  const isOpen = popup.style.display === 'block';

  // Close all other popups
  document.querySelectorAll('.cc-popup').forEach(p => {
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
    document.querySelectorAll('.cc-popup').forEach(p => {
      p.style.display = 'none';
    });}
});
// Clan tag copy. Guarded -- #clan-tag only exists on pages that show it
// (e.g. coc-home.html), and this script is shared site-wide. An unguarded
// lookup here used to throw on every page without it, which silently
// killed every line after this one in the file (including the event
// timers further down) since one uncaught error stops the whole script.
const clanTag = document.getElementById('clan-tag');
const copyMsg = document.getElementById('copy-msg');

if (clanTag && copyMsg) {
  clanTag.addEventListener('click', () => {
    navigator.clipboard.writeText(clanTag.textContent)
      .then(() => {
        copyMsg.style.display = 'block';
        setTimeout(() => { copyMsg.style.display = 'none'; }, 1500);
      })
      .catch(err => console.error('Failed to copy: ', err));
  });
}


// NOTE: old .zoomable auto-click-listener + zoomImage/closeZoom removed.
// Zoomable images now use the Palette Lightbox system (see bottom of this file)
// via inline onclick="openPalette(this)" on each <img class="zoomable">.

// Save scroll position when navigating
function goToTH(url, btn) {
  const container = document.getElementById('second-layer-container');
  if (container) {
    sessionStorage.setItem('secondLayerScroll', container.scrollLeft);
  }
  // Navigate to the next page
  window.location.href = url;
}

// TH switcher scroll position on load: restore the saved scroll from the
// previous page if present, otherwise center the active TH button.
// (Previously two separate 'load' listeners did this and could race
// against each other; merged into one to remove that conflict.)
window.addEventListener('load', () => {
  const container = document.getElementById('second-layer-container');
  if (!container) return;

  const savedScroll = sessionStorage.getItem('secondLayerScroll');
  if (savedScroll !== null) {
    container.scrollTo({ left: parseFloat(savedScroll), behavior: 'auto' });
    return;
  }

  const activeBtn = container.querySelector('button.active'); // the active TH button
  if (activeBtn) {
    const containerRect = container.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    const scrollLeft = container.scrollLeft + (btnRect.left - containerRect.left) - (containerRect.width / 2) + (btnRect.width / 2);
    container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  }
});


//copyclipboard ac clan box
const ascendereTag = document.getElementById('ascendere-clan-tag');
if (ascendereTag) {
  ascendereTag.addEventListener('click', () => {
    navigator.clipboard.writeText('#2GYPGPJP9').then(() => {
      const msg = document.getElementById('copy-msg');
      if (msg) {
        msg.style.display = 'block';
        setTimeout(() => { msg.style.display = 'none'; }, 1500);
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
// normal static bar, same as coc-home.html.

// ===================================================
// BOTTOM NAV / DESKTOP SUB NAV / MORE MENU (shared)
// ===================================================
function bnLockScroll(){
  document.documentElement.classList.add('no-scroll');
  var cocMain = document.querySelector('.coc-main');
  if(cocMain) cocMain.style.overflow = 'hidden';
}
function bnUnlockScroll(){
  document.documentElement.classList.remove('no-scroll');
  var cocMain = document.querySelector('.coc-main');
  if(cocMain) cocMain.style.overflow = '';
}
function toggleMoreMenu(){
  var overlay = document.getElementById('moreOverlay');
  var wrap = document.getElementById('bnMoreWrap');
  var isOpen = overlay.classList.contains('open');
  if(isOpen){
    overlay.classList.remove('open');
    if(wrap) wrap.classList.remove('open');
    bnUnlockScroll();
  } else {
    overlay.classList.add('open');
    if(wrap) wrap.classList.add('open');
    bnLockScroll();
  }
}
function closeMoreMenu(e){
  document.getElementById('moreOverlay').classList.remove('open');
  var wrap = document.getElementById('bnMoreWrap');
  if(wrap) wrap.classList.remove('open');
  bnUnlockScroll();
}
document.getElementById('moreOverlay').addEventListener('touchmove', function(e){
  if(!e.target.closest('.more-sheet')) e.preventDefault();
}, {passive:false});

// DRAG-TO-CLOSE: dragging the handle down past ~28% of the sheet's
// height (or a fast flick) closes the sheet; otherwise it snaps back.
(function initMoreSheetDrag(){
  const sheet = document.querySelector('.more-sheet');
  const handle = document.querySelector('.more-sheet-handle');
  const overlay = document.getElementById('moreOverlay');
  if(!sheet || !handle || !overlay) return;

  let dragging = false;
  let startY = 0;
  let dragY = 0;
  let sheetHeight = 0;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;

  function onPointerDown(e){
    dragging = true;
    startY = e.clientY;
    lastY = startY;
    lastT = Date.now();
    velocity = 0;
    sheetHeight = sheet.getBoundingClientRect().height || 1;
    sheet.classList.add('dragging');
    if(handle.setPointerCapture) handle.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e){
    if(!dragging) return;
    const now = Date.now();
    const dt = now - lastT;
    if(dt > 0) velocity = (e.clientY - lastY) / dt; // px per ms
    lastY = e.clientY;
    lastT = now;

    dragY = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dragY}px)`;
    overlay.style.opacity = String(1 - Math.min(dragY / sheetHeight, 1) * 0.9);
  }

  function onPointerUp(){
    if(!dragging) return;
    dragging = false;
    sheet.classList.remove('dragging');

    const pastThreshold = dragY > sheetHeight * 0.28;
    const fastFlick = velocity > 0.6; // flicked down quickly
    overlay.style.opacity = '';

    if(pastThreshold || fastFlick){
      // Remove 'open' now (inline transform still overrides visually),
      // then clear the inline transform next frame so the CSS
      // transition takes over and animates smoothly from the drag
      // position down to fully closed, instead of jumping.
      closeMoreMenu();
      requestAnimationFrame(() => { sheet.style.transform = ''; });
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
(function(){
  const bnBar = document.getElementById('bottomNav');
  const cocMain = document.querySelector('.coc-main');
  if(!bnBar) return;

  const DOWN_HIDE_THRESHOLD = 8;   // px of downward travel before it hides
  const UP_SHOW_THRESHOLD   = 55;  // px of upward travel before it reappears
  const TOP_REVEAL_ZONE     = 40;  // always shown near the very top

  function getScrollY(){
    // Use whichever is actually scrolling: window (mobile) or .coc-main (desktop-ish)
    const winY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const mainY = cocMain ? cocMain.scrollTop : 0;
    return Math.max(winY, mainY);
  }

  let lastY = getScrollY();
  let upAccum = 0;
  let downAccum = 0;
  let ticking = false;

  function showNav(){ bnBar.classList.remove('bn-hidden'); }
  function hideNav(){ bnBar.classList.add('bn-hidden'); }

  function onScroll(){
    const currentY = getScrollY();
    const delta = currentY - lastY;

    if(currentY <= TOP_REVEAL_ZONE){
      showNav();
      upAccum = 0;
      downAccum = 0;
      lastY = currentY;
      ticking = false;
      return;
    }

    if(delta > 0){
      // scrolling down -> hide almost immediately
      downAccum += delta;
      upAccum = 0;
      if(downAccum > DOWN_HIDE_THRESHOLD) hideNav();
    } else if(delta < 0){
      // scrolling up -> only reveal after a real upward gesture
      upAccum += -delta;
      downAccum = 0;
      if(upAccum > UP_SHOW_THRESHOLD) showNav();
    }

    lastY = currentY;
    ticking = false;
  }

  function requestTick(){
    if(!ticking){
      window.requestAnimationFrame(onScroll);
      ticking = true;
    }
  }

  window.addEventListener('scroll', requestTick, {passive:true});
  if(cocMain) cocMain.addEventListener('scroll', requestTick, {passive:true});

  // Never keep it hidden while the "More" sheet is open
  const moreOverlay = document.getElementById('moreOverlay');
  if(moreOverlay){
    new MutationObserver(function(){
      if(moreOverlay.classList.contains('open')) showNav();
    }).observe(moreOverlay, {attributes:true, attributeFilter:['class']});
  }
})();
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape') closeMoreMenu();
});


// Highlight the active bottom-nav / desktop sub-nav / mobile "More" sheet item based on current page
(function highlightActiveNavItems(){
  // Treats numbered sub-pages (e.g. th18-layouts2.html, th18-layouts3.html)
  // as the same section as their base page (th18-layouts.html), since nav
  // links/icons only ever point to the base/page-1 URL.
  function baseName(filename){
    return (filename || '').replace(/(\D)\d+\.html$/i, '$1.html');
  }
  var page = baseName(window.location.pathname.split('/').pop().split('?')[0].split('#')[0] || 'home.html');
  document.querySelectorAll('.bn-item').forEach(function(el){
    var href = baseName((el.getAttribute('href') || '').split('/').pop());
    el.classList.toggle('active', href === page);
  });
  document.querySelectorAll('.dsn-link').forEach(function(el){
    var href = baseName((el.getAttribute('href') || '').split('/').pop());
    el.classList.toggle('active', href === page);
  });
  document.querySelectorAll('.dsn-mini, .dsn-guide-box, .dsn-guide-row').forEach(function(el){
    var href = baseName((el.getAttribute('href') || '').split('/').pop());
    el.classList.toggle('active', href === page);
  });
  document.querySelectorAll('.th-mini, .more-row').forEach(function(el){
    var href = baseName((el.getAttribute('href') || '').split('/').pop());
    el.classList.toggle('active', href === page);
  });
})();


// ===================================================
// PALETTE LIGHTBOX (zoomable image viewer, shared)
// ===================================================
// ── STATE ──
let palScale = 1;
let palPanX = 0, palPanY = 0;
let palIsPanning = false;
let palPanStartX = 0, palPanStartY = 0;
let palStartDist = 0, palLastScale = 1;
 
// ── HELPERS ──
function applyPalTransform() {
  document.getElementById('pal-lb-img').style.transform =
    `translate(${palPanX}px, ${palPanY}px) scale(${palScale})`;
}
 
function clampPalPan() {
  if (palScale <= 1) { palPanX = 0; palPanY = 0; return; }
  const img = document.getElementById('pal-lb-img');
  const maxX = Math.max(0, (img.offsetWidth  * palScale - window.innerWidth)  / 2);
  const maxY = Math.max(0, (img.offsetHeight * palScale - window.innerHeight) / 2);
  palPanX = Math.min(maxX, Math.max(-maxX, palPanX));
  palPanY = Math.min(maxY, Math.max(-maxY, palPanY));
}
 
function palEscHandler(e) { if (e.key === 'Escape') closePalette(); }
 
// ── OPEN ──
function openPalette(el) {
  const src = el.dataset.full || el.querySelector('img')?.src || el.src;
  const lb  = document.getElementById('pal-lightbox');
  const img = document.getElementById('pal-lb-img');
 
  // Reset state
  palScale = 1; palPanX = 0; palPanY = 0; palIsPanning = false;
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
    const cx = e.clientX - (rect.left + rect.width  / 2);
    const cy = e.clientY - (rect.top  + rect.height / 2);
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
      palStartDist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
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
      const newDist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const prev = palScale;
      palScale = Math.min(Math.max(1, palLastScale * (newDist / palStartDist)), 6);
      const ratio = palScale / prev;
      const rect  = img.getBoundingClientRect();
      const cx = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - (rect.left + rect.width  / 2);
      const cy = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - (rect.top  + rect.height / 2);
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
    if (palScale <= 1) { palScale = 1; palPanX = 0; palPanY = 0; }
    else clampPalPan();
    applyPalTransform();
  };
 
  // Backdrop click closes, image click doesn't bubble up
  img.onclick   = (e) => e.stopPropagation();
  lb.onclick    = (e) => { if (e.target === lb) closePalette(); };
}
 
// ── CLOSE ──
function closePalette() {
  const lb = document.getElementById('pal-lightbox');
  if (!lb.classList.contains('open')) return;
  lb.classList.remove('open');
  document.getElementById('pal-lb-close').style.display = 'none';
  palScale = 1; palPanX = 0; palPanY = 0; palIsPanning = false;
  window.onmousemove = null;
  window.onmouseup   = null;
  document.removeEventListener('keydown', palEscHandler);
  if (history.state?.modal) history.back();
}


window.addEventListener('popstate', () => {
  const lb = document.getElementById('pal-lightbox');
  if (lb.classList.contains('open')) {
    lb.classList.remove('open');
    document.getElementById('pal-lb-close').style.display = 'none';
    palScale = 1; palPanX = 0; palPanY = 0; palIsPanning = false;
    window.onmousemove = null;
    window.onmouseup = null;
    document.removeEventListener('keydown', palEscHandler);
  }
});

/* EVENT TIMERS — moved to coc-events.js so coc-home.html can use them
   without loading this whole file (footer injection, lightbox and the
   page-specific handlers here are not wanted there). Pages that show
   event rows load <script src="coc-events.js"></script>. */
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
      <img src="icons/home.jpg" alt="Parchrome" class="pf-footer-logo">
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
       <script src="coc-nav-loader.js"></script>

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
  var DATA_URL = "coc-nav-data.json";
  var currentPage = location.pathname.split("/").pop() || "index.html";

  function isActive(activeOn) {
    return Array.isArray(activeOn) && activeOn.indexOf(currentPage) !== -1;
  }

  function el(tag, className) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    return e;
  }

  function buildThMini(th, variant) {
    // variant: "dsn-mini" (desktop dropdown) or "th-mini" (more-sheet)
    var a = el("a", variant);
    a.href = th.href;
    var img = el("img");
    img.src = th.icon;
    img.alt = th.label;
    var span = el("span");
    span.textContent = th.label;
    a.appendChild(img);
    a.appendChild(span);
    if (isActive(th.activeOn)) a.classList.add("active");
    return a;
  }

  function buildLayoutsGrid(townhalls, variant) {
    var frag = document.createDocumentFragment();
    townhalls.forEach(function (th) {
      frag.appendChild(
        buildThMini({ id: th.id, label: th.label, icon: th.layoutIcon, href: th.layoutHref, activeOn: [th.layoutHref] }, variant)
      );
    });
    return frag;
  }

  function buildArmiesGrid(townhalls, variant) {
    var frag = document.createDocumentFragment();
    townhalls.forEach(function (th) {
      frag.appendChild(
        buildThMini({ id: th.id, label: th.label, icon: th.armyIcon, href: th.armyHref, activeOn: [th.armyHref] }, variant)
      );
    });
    return frag;
  }

  function buildGuidesDropdown(guides) {
    var frag = document.createDocumentFragment();
    guides.forEach(function (g) {
      var a = el("a", "dsn-guide-box");
      a.href = g.href;
      var img = el("img");
      img.src = g.icon;
      img.alt = g.label;
      var span = el("span");
      span.textContent = g.label;
      a.appendChild(img);
      a.appendChild(span);
      if (isActive(g.activeOn)) a.classList.add("active");
      frag.appendChild(a);
    });
    return frag;
  }

  function buildGuidesMoreList(guides) {
    var frag = document.createDocumentFragment();
    guides.forEach(function (g) {
      var a = el("a", "more-row");
      a.href = g.href;

      var iconWrap = el("div", "more-row-icon");
      var img = el("img");
      img.src = g.icon;
      img.alt = g.label;
      // Size comes from `.more-guides-list .more-row-icon img` in the
      // stylesheet -- an inline width here would outrank it.
      img.style.objectFit = "contain";
      iconWrap.appendChild(img);

      var textWrap = el("div", "more-row-text");
      var titleSpan = el("span", "more-row-title");
      titleSpan.textContent = g.label;
      textWrap.appendChild(titleSpan);

      a.appendChild(iconWrap);
      a.appendChild(textWrap);
      // No trailing chevron -- the row-level ::after arrow in the shared
      // CSS already draws one per row, so this used to print two.
      if (isActive(g.activeOn)) a.classList.add("active");
      frag.appendChild(a);
    });
    return frag;
  }

  function fillByRole(role, buildFn) {
    var nodes = document.querySelectorAll('[data-role="' + role + '"]');
    nodes.forEach(function (node) {
      node.innerHTML = "";
      node.appendChild(buildFn());
    });
  }

  function setPrimaryLinks(data) {
    // Figure out which townhall "owns" the current page (if any), so
    // LAYOUTS/ARMIES in the top nav point at that TH's other page.
    var th = data.townhalls.find(function (t) { return isActive(t.activeOn); }) || null;
    var activeGuide = data.guides.some(function (g) { return isActive(g.activeOn); });
    var onHome = currentPage === data.primaryNav.home.href;
    var nav = data.primaryNav;

    var map = {
      home: nav.home.href,
      layouts: th ? th.layoutHref : nav.layouts.href,
      armies: th ? th.armyHref : nav.armies.href,
      guides: nav.guides.href
    };

    var iconMap = {
      home: nav.home.icon,
      layouts: th ? th.layoutIcon : nav.layouts.icon,
      armies: th ? th.armyIcon : nav.armies.icon,
      guides: nav.guides.icon
    };

    var activeKey = onHome ? "home"
      : activeGuide ? "guides"
      : th && currentPage === th.layoutHref ? "layouts"
      : th && currentPage === th.armyHref ? "armies"
      : null;

    Object.keys(map).forEach(function (key) {
      var selector = '[data-role="bn-' + key + '"], [data-role="dsn-' + key + '"]';
      document.querySelectorAll(selector).forEach(function (link) {
        link.setAttribute("href", map[key]);
        link.classList.toggle("active", key === activeKey);

        // Swap the leading icon (originally an inline <svg>) for an <img>.
        // The dsn-caret (dropdown arrow svg, if present) is left alone.
        var existingIcon = link.querySelector("svg:not(.dsn-caret), img.nav-icon");
        // A page that ships its own inline <svg> icon keeps it. This used to
        // replaceWith() a raster <img> unconditionally, which is why
        // th18-layouts showed .png/.webp icons while coc-home (which does not
        // load this file) kept clean SVGs -- the two never matched. Pages with
        // no icon in their markup are unaffected: existingIcon is null there,
        // so they still get the raster injected exactly as before.
        if (existingIcon && existingIcon.tagName !== "IMG") return;
        var img = existingIcon && existingIcon.tagName === "IMG" ? existingIcon : el("img", "nav-icon");
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
    var th = data.townhalls.find(function (t) { return isActive(t.activeOn); }) || null;
    var activeGuide = data.guides.some(function (g) { return isActive(g.activeOn); });
    var nav = data.primaryNav;

    var tabs = [
      { key: "layouts", label: "Layouts", href: th ? th.layoutHref : nav.layouts.href },
      { key: "armies", label: "Army", href: th ? th.armyHref : nav.armies.href },
      { key: "guides", label: "Guides", href: nav.guides.href }
    ];

    var activeKey = activeGuide ? "guides"
      : th && currentPage === th.layoutHref ? "layouts"
      : th && currentPage === th.armyHref ? "armies"
      : null;

    var frag = document.createDocumentFragment();
    tabs.forEach(function (tab) {
      var btn = el("button");
      btn.textContent = tab.label;
      if (tab.key === activeKey) btn.classList.add("active");
      btn.addEventListener("click", function () {
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
    var onLayout = data.townhalls.some(function (t) { return currentPage === t.layoutHref; });
    if (onLayout) return "layouts";
    var onArmy = data.townhalls.some(function (t) { return currentPage === t.armyHref; });
    if (onArmy) return "armies";
    return "layouts"; // sensible default (e.g. guides pages that still show the strip)
  }

  function buildSecondLayer(data) {
    var mode = detectMode(data);
    var frag = document.createDocumentFragment();
    data.townhalls.forEach(function (th) {
      var href = mode === "armies" ? th.armyHref : th.layoutHref;
      var icon = mode === "armies" ? th.armyIcon : th.layoutIcon;

      var btn = el("button", "th-btn");
      btn.setAttribute("data-th", "TH-" + th.label.replace(/^TH/i, ""));
      if (currentPage === href) btn.classList.add("active");

      var img = el("img");
      img.src = icon;
      img.alt = th.label;
      btn.appendChild(img);
      btn.appendChild(document.createTextNode(th.label.replace(/^TH/i, "")));

      btn.addEventListener("click", function () {
        if (typeof window.goToTH === "function") {
          window.goToTH(href, btn);
        } else {
          location.href = href;
        }
      });

      frag.appendChild(btn);
    });
    return frag;
  }

  function init(data) {
    fillByRole("layouts-grid", function () { return buildLayoutsGrid(data.townhalls, "dsn-mini"); });
    fillByRole("armies-grid", function () { return buildArmiesGrid(data.townhalls, "dsn-mini"); });
    fillByRole("guides-grid", function () { return buildGuidesDropdown(data.guides); });

    fillByRole("more-layouts-grid", function () { return buildLayoutsGrid(data.townhalls, "th-mini"); });
    fillByRole("more-armies-grid", function () { return buildArmiesGrid(data.townhalls, "th-mini"); });
    fillByRole("more-guides-list", function () { return buildGuidesMoreList(data.guides); });

    fillByRole("first-layer", function () { return buildFirstLayer(data); });
    fillByRole("second-layer", function () { return buildSecondLayer(data); });

    setPrimaryLinks(data);

    document.dispatchEvent(new CustomEvent("parchome:coc-nav-ready", { detail: data }));
  }

  document.addEventListener("DOMContentLoaded", function () {
    fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load " + DATA_URL + " (" + res.status + ")");
        return res.json();
      })
      .then(init)
      .catch(function (err) {
        console.error("[coc-nav-loader]", err);
      });
  });
})();