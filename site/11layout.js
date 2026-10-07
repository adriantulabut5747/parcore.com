// Full path of a link or address, e.g. "/coc/town-hall-18/layouts" -- the last
// part alone ("layouts") is the same for every Town Hall. "x.html", "x" and
// "x/index.html" count as the same page.
function cocPagePath(u) {
  var p = new URL(String(u || ''), location.origin + '/').pathname.toLowerCase();
  return p.replace(/\.html$/, '').replace(/\/index$/, '/').replace(/(.)\/$/, '$1');
}

/* ============================================================
   PARCHROME LOADER — builds the 9-box shuffle animation and drops
   it into #page-loader in place of the old spinning ring. Runs on
   every page automatically since this file is shared. Edit the
   loader markup/behavior here once, applies everywhere.
   ============================================================ */
(function buildParchromeLoader() {
  const fade = document.querySelector('#page-loader .parchrome-fade');
  if (!fade || fade.querySelector('.parchrome-loader')) return; // home writes its boxes in the markup
  const loader = document.createElement('div');
  loader.className = 'parchrome-loader';
  for (let i = 0; i < 9; i++) {
    const box = document.createElement('div');
    box.className = 'parchrome-loader__box';
    loader.appendChild(box);
  }
  fade.innerHTML = '';
  fade.appendChild(loader);
})();

/* LOADER LABEL — cycles the word under the boxes while the page loads:
   Parchrome (1s) → section name (2s) → Rendering (2s) → Joining (2s) → Loading
   (stays). Timed from navigation start (performance.now), so a script that runs
   late jumps straight to the right word. Home has no section, so it uses Joining.
   Stops by itself when the page's load handler removes #page-loader. */
(function cycleLoaderLabel() {
  const label = document.querySelector('#page-loader .parchrome-label');
  if (!label) return;
  const SECTION_NAMES = {
    coc: 'Clash of Clans',
    minecraft: 'Minecraft',
    'call-of-duty-mobile': 'CoD Mobile',
    'genshin-impact': 'Genshin Impact',
    tekken: 'Tekken',
    valorant: 'Valorant',
  };
  const words = ['Parchrome', SECTION_NAMES[location.pathname.split('/')[1]] || 'Joining', 'Rendering', 'Joining', 'Loading'];
  const starts = [0, 1000, 3000, 5000, 7000];
  let shown = 0;
  label.innerHTML = '<span>' + words[0] + '</span>';

  function swap(word) {
    const old = label.lastElementChild;
    old.className = 'parchrome-word-out';
    setTimeout(() => old.remove(), 350);
    const next = document.createElement('span');
    next.className = 'parchrome-word-in';
    next.textContent = word;
    label.appendChild(next);
  }

  (function step() {
    if (!label.isConnected) return;
    const t = performance.now();
    let i = starts.length - 1;
    while (starts[i] > t) i--;
    if (i !== shown) swap(words[(shown = i)]);
    if (i < starts.length - 1) setTimeout(step, starts[i + 1] - t);
  })();
})();

/* ============================================================
   11layout.js — SHARED SIDEBAR LOGIC
   Builds the sidebar (top-box, games, triple-a) from sidebar.json,
   and handles opening/closing it. Edit here once, applies everywhere.
   Must load on a page that already has #sidebar, #hamburger,
   #top-box, #games-container, #triple-a-header, #triple-a-list in
   the HTML.
   ============================================================ */

// NORMALIZER: a link/address -> the page it means, as a full path.
// Full path, not just the last part: /coc/town-hall-18/layouts and
// /coc/town-hall-17/layouts both end in "layouts". "x.html", "x" and
// "x/index.html" all count as the same page. Relative links resolve from
// the site root, which is how the nav JSON writes them.
function normalizePage(url) {
  if (url == null) return "";
  var p = new URL(String(url).trim(), location.origin + '/').pathname.toLowerCase();
  return p.replace(/\.html$/, '').replace(/\/index$/, '/').replace(/(.)\/$/, '$1');
}
const currentPage = normalizePage(window.location.pathname);

const topBox = document.getElementById('top-box');
const gamesContainer = document.getElementById('games-container');
const tripleAList = document.getElementById('triple-a-list');

let sidebarLoaded = false;
let sidebarDataCache = null;
// Separate from sidebarLoaded on purpose: "data fetched" is not "sidebar
// built". The Clash pages' loader (thz-script.js) fetches the data early,
// which set sidebarLoaded before anyone opened the sidebar -- so on phones
// (where you open it later) the build was skipped and it came up empty.
let sidebarBuilt = false;

// The request itself is kept, so a second caller while it's still on its
// way (the page loader in thz-script.js) shares it instead of refetching.
let sidebarRequest = null;
function loadSidebarData() {
  if (sidebarLoaded) return Promise.resolve(sidebarDataCache);
  if (sidebarRequest) return sidebarRequest;

  return (sidebarRequest = fetch('/sidebar.json')
    .then(res => res.json())
    .then(data => {
      sidebarLoaded = true;
      sidebarDataCache = data;
      return data;
    })
    .catch(err => console.error("Sidebar load error:", err)));
}

// Builds the 3 boxes (top-box, games, triple-a) from sidebar.json
function buildSidebarFromJSON(data) {

  // TOP BOX
  data.topBox.forEach(item => {
    const a = document.createElement('a');
    a.href = item.link;
    a.className = 'top-box-item';
    const isActive =
      normalizePage(item.link) === currentPage ||
      item.activeOn?.map(normalizePage).includes(currentPage);
    if (isActive) {
      a.classList.add('active'); }
    a.innerHTML = `
      <img src="${item.icon}" class="topbox-icon" alt=""
          onerror="this.style.display='none'">
      <span>${item.name}</span>`;
    topBox.appendChild(a);});

  // TOP GAMES
  data.games.forEach(game => {
    const a = document.createElement('a');
    a.href = game.link;
    a.className = 'game';
    // activePrefix: the whole section ("/coc/" lights up on /coc/ and every
    // page under it), so new pages don't need adding to a list.
    const prefix = game.activePrefix && normalizePage(game.activePrefix);
    if (
      normalizePage(game.link) === currentPage ||
      (game.activeOn?.map(normalizePage).includes(currentPage)) ||
      (prefix && (currentPage === prefix || currentPage.startsWith(prefix + '/')))) {
      a.classList.add('active');}
    a.innerHTML = `
      <img src="${game.icon}" class="sidebar-icon" alt="">
      <span>${game.name}</span> `;
    gamesContainer.appendChild(a);});

  // TRIPLE A HEADER
  if (data.tripleAHeader) {
    const headerEl = document.getElementById('triple-a-header');
    if (headerEl) {
      headerEl.innerHTML = `
        <img src="${data.tripleAHeader.icon}" class="tripleimg" alt="">
        ${data.tripleAHeader.name}
        <span class="arrow">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 8l4 4-4 4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>`;
    }
  }

  // TRIPLE A GAMES (the upcoming mobile games from sidebar.json go first)
  (data.upcoming || []).concat(data.tripleA).forEach(game => {
    const a = document.createElement('a');
    a.href = game.link || "#";
    a.className = 'triple-a-game';
    a.innerHTML = `
    <img src="${game.icon}" class="sidebar-icon" alt="">
    <span>${game.name}</span> `;
    tripleAList.appendChild(a);});
}

// TOGGLE TRIPLE A
function toggleTripleA() {
  const header = document.querySelector('.triple-a-header');
  const list = document.getElementById('triple-a-list');
  const isOpen = header.classList.contains('open');
  if (isOpen) {
    header.classList.remove('open');
    header.classList.add('closed');
    list.style.display = 'none';
  } else {
    header.classList.remove('closed');
    header.classList.add('open');
    list.style.display = 'flex';}
}

// Skeleton placeholders shown while sidebar.json is loading
function showSkeletons(container, count) {
  for (let i = 0; i < count; i++) {
    const div = document.createElement('div');
    div.className = 'skeleton-item';
    div.innerHTML = `
      <div class="skeleton-icon"></div>
      <div class="skeleton-text"></div>`;
    container.appendChild(div);
  }
}

// Lazily creates (once) the dimmed backdrop shown behind the sidebar
// on mobile, and wires a click on it to close the sidebar.
function getSidebarOverlay() {
  let overlay = document.getElementById('sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', toggleSidebar);
    document.body.appendChild(overlay);
  }
  return overlay;
}

// TOGGLE SIDEBAR (open/close + lazy-load JSON with skeletons on first open)
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const burger = document.getElementById('hamburger');
  sidebar.classList.toggle('active');
  burger.classList.toggle('active');

  // Mobile-only: darken the background and lock page scroll while the
  // sidebar is open. Desktop auto-opens the sidebar via this same
  // function (see handleDesktopSidebar below) and shouldn't get a
  // backdrop or scroll lock, hence the width check.
  if (window.matchMedia("(max-width: 970px)").matches) {
    const overlay = getSidebarOverlay();
    const isOpen = sidebar.classList.contains('active');
    overlay.classList.toggle('active', isOpen);
    document.body.classList.toggle('sidebar-open', isOpen);
  }

  if (sidebar.classList.contains('active') && !sidebarBuilt) {
    sidebarBuilt = true;
    showSkeletons(topBox, 3);
    showSkeletons(gamesContainer, 5);
    showSkeletons(tripleAList, 4);

    loadSidebarData().then(data => {
      if (!data) {
        sidebarBuilt = false; // fetch failed: let the next open try again
        return;
      }
      topBox.innerHTML = '';
      gamesContainer.innerHTML = '';
      tripleAList.innerHTML = '';
      buildSidebarFromJSON(data);
    });
  }
}

// Auto-opens the sidebar when on desktop mode
function handleDesktopSidebar() {
  const isDesktop = window.matchMedia("(min-width: 971px)").matches;
  const sidebar = document.getElementById('sidebar');
  if (isDesktop && !sidebar.classList.contains('active')) {
    document.getElementById('hamburger').click();
  }
  // Safety net: if the viewport crosses into desktop while the mobile
  // backdrop/scroll-lock is still active (e.g. rotating a tablet, or
  // resizing a desktop browser window back up), clear them so the
  // page doesn't get stuck dimmed and unscrollable.
  if (isDesktop) {
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.classList.remove('active');
    document.body.classList.remove('sidebar-open');
  }
}
document.addEventListener('DOMContentLoaded', handleDesktopSidebar);
window.addEventListener('resize', handleDesktopSidebar);

// Triple-a list starts open
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.triple-a-header');
  const list = document.getElementById('triple-a-list');
  if (header && list) {
    header.classList.add('open');
    list.style.display = 'flex';
  }
});
/* ============================================================
   HUB NAV — SHARED (Lobby / Bookmark / Contribute / Glossary, etc.)
   Builds BOTH the mobile bottom bar (#bottomNav, around #bnMoreWrap)
   and the desktop hub strip (#stbHubNav) from hwr-categories.json's
   "hubNav" array — edit that file (name/link/icon/activeIcon) and
   both update everywhere, on every hwr-*.html page, automatically.
   Active state is no longer hardcoded per page: whichever entry's
   "link" matches the current page lights up (none do on pages that
   aren't one of these destinations, e.g. /web-resources/ai-tools). Runs its own
   fetch (rather than reusing a page's own hwr-categories.json fetch)
   so it works regardless of script order or whether the page happens
   to load that file itself.
   ============================================================ */
(function initHubNav() {
  const stbHubNav = document.getElementById('stbHubNav');
  const bnBar = document.getElementById('bottomNav');
  const bnMoreWrap = document.getElementById('bnMoreWrap');

  // The bottom-bar half of this is hwr-only. The Clash pages (coc-home,
  // th18-layouts) load this file for the shared layout behaviour further
  // down, but they ship their own bottom nav -- Home / Layouts / Armies /
  // Guides, with their own icons and their own active-state logic. Without
  // this opt-out the block below deleted every .bn-item and rebuilt the bar
  // from hwr-categories.json's hubNav, so those pages ended up showing
  // hwr's Home / Bookmarks / Contribute / Glossary instead of their own.
  const bnSelfManaged = !!(bnBar && bnBar.dataset.hubNav === 'off');
  const buildBottomBar = !!(bnBar && bnMoreWrap && !bnSelfManaged);

  // Same opt-out for the desktop strip: a page can carry hwr's #stbHubNav
  // markup but fill it with its own destinations (Minecraft's editions).
  const hubSelfManaged = !!(stbHubNav && stbHubNav.dataset.hubNav === 'off');
  const buildHubStrip = !!(stbHubNav && !hubSelfManaged);

  if (!buildHubStrip && !buildBottomBar) return; // page has neither hub nav

  // Game sections (Valorant, CODM, Genshin, Tekken) put
  // <body data-game-nav="<key>"> on every page and read that key's entry in
  // game-nav.json instead of hwr's hubNav: its pages fill the bar's strip,
  // the "bottomNav": true ones the phone bar, and all of them the More sheet.
  const gameKey = document.body && document.body.dataset.gameNav;

  function iconSvg(item, isActive) {
    const markup = (isActive && item.activeIcon) ? item.activeIcon : (item.icon || '');
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${markup}</svg>`;
  }

  // "soon": true = the page isn't built yet. It still shows, greyed out and
  // not clickable (no href), so the section's plan is visible without 404s.
  function itemHtml(item, className) {
    if (item.soon) {
      return `<a class="${className} is-soon" aria-disabled="true" title="Coming soon">${iconSvg(item, false)}<span>${item.name}</span></a>`;
    }
    const isActive = normalizePage(item.link) === currentPage;
    return `<a href="${item.link}" class="${className}${isActive ? ' active' : ''}">${iconSvg(item, isActive)}<span>${item.name}</span></a>`;
  }

  // More sheet rows for the game sections, in the sheet's shared .th-mini
  // row style (11layout.css "MORE SHEET — ROWS").
  function buildMoreSheet(items) {
    const list = document.querySelector('#moreOverlay .more-list');
    if (!list) return;
    const chevron = '<svg class="th-mini-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
    list.innerHTML = '<div class="th-mini-grid">' + items.map(item => {
      const tail = item.soon ? '<em class="gn-soon">Soon</em>' : chevron;
      return itemHtml(item, 'th-mini').replace('</span></a>', '</span>' + tail + '</a>');
    }).join('') + '</div>';
  }

  function buildHubNav(data) {
    const items = (data && data.hubNav) || [];
    if (!items.length) return;

    if (stbHubNav) {
      // Every hwr page's hub nav is now the same three-part structure:
      // left arrow + #stbHubNavScroll strip + right arrow. Fill the strip,
      // never the <nav> itself, or the arrows get wiped out with the old
      // links (which is exactly what /web-resources/bookmarks used to have to
      // patch around). The `|| stbHubNav` fallback keeps this working on
      // any page that still ships the flat, arrow-less markup.
      const hubStrip = stbHubNav.querySelector('#stbHubNavScroll') || stbHubNav;
      hubStrip.innerHTML = items.map(item => itemHtml(item, 'stb-hub-link')).join('');
      // Arrow visibility depends on scrollWidth, which isn't known until
      // the links above actually exist — re-measure now that they do.
      if (typeof window.updateStbHubNavArrows === 'function') window.updateStbHubNavArrows();
    }

    if (buildBottomBar) {
      // Clear any previously-built items (e.g. a re-run) without touching
      // the More button itself.
      bnBar.querySelectorAll('.bn-item').forEach(el => el.remove());

      // Split around the floating More button: first half before it,
      // rest after — matches the original 2 + More + 2 layout for 4 items,
      // and scales automatically if more destinations are added later.
      const bnItems = data.bottomNav || items;
      const splitAt = Math.ceil(bnItems.length / 2);
      const before = bnItems.slice(0, splitAt);
      const after = bnItems.slice(splitAt);

      before.forEach(item => {
        bnMoreWrap.insertAdjacentHTML('beforebegin', itemHtml(item, 'bn-item'));
      });

      // Chain off the last-inserted node (not bnMoreWrap itself) each time,
      // otherwise repeated 'afterend' inserts on the same anchor would land
      // in reverse order.
      let afterAnchor = bnMoreWrap;
      after.forEach(item => {
        afterAnchor.insertAdjacentHTML('afterend', itemHtml(item, 'bn-item'));
        afterAnchor = afterAnchor.nextElementSibling;
      });
    }
  }

  // Breadcrumb (Oct 2026, the Clash bar's trail brought over): desktop
  // shows "Web Resources > Anime" in place of the plain "Web Resources"
  // title. Steps are real pages only, each a link. The lobby gets none,
  // like Clash home. Phones keep their title + scroll-spy group name
  // (#scMobileGroup). .secondary-content is itself a link, so the trail
  // sits beside it, not inside it (no links inside a link); CSS swaps
  // them (BREADCRUMB in 11layout.css).
  // The game sections use the same trail: "Valorant › Crosshairs".
  function buildCrumbs(homeLink, homeName, pages) {
    const left = document.querySelector('.secondary-left');
    const title = left && left.querySelector('.secondary-content');
    if (!title || left.querySelector('.stb-crumbs')) return;
    const here = pages.find(item => !item.soon && normalizePage(item.link) === currentPage);
    if (!here || normalizePage(here.link) === normalizePage(homeLink)) return;
    const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const crumbs = document.createElement('nav');
    crumbs.className = 'stb-crumbs';
    crumbs.setAttribute('aria-label', 'Breadcrumb');
    crumbs.innerHTML =
      `<a href="${homeLink}">${esc(homeName)}</a>` +
      `<span class="stb-crumb-sep" aria-hidden="true">›</span>` +
      `<a href="${here.link}" aria-current="page">${esc(here.name)}</a>`;
    title.after(crumbs);
    left.classList.add('has-crumbs');
  }

  if (gameKey) {
    fetch('/game-nav.json')
      .then(res => res.json())
      .then(all => {
        const game = all[gameKey];
        if (!game) return console.error('game-nav.json has no "' + gameKey + '" entry');
        buildHubNav({ hubNav: game.pages, bottomNav: game.pages.filter(p => p.bottomNav) });
        buildMoreSheet(game.pages);
        buildCrumbs(game.home, game.name, game.pages);
      })
      .catch(err => console.error('Game nav data failed to load:', err));
    return;
  }

  fetch('/hwr-categories.json')
    .then(res => res.json())
    .then(data => {
      buildHubNav(data);
      if (currentPage.indexOf('/web-resources/') === 0) {
        buildCrumbs('/web-resources/', 'Web Resources', [].concat(data.categories || [], data.hubNav || []));
      }
    })
    .catch(err => console.error('Hub nav data failed to load:', err));
})();

/* ============================================================
   MORE SHEET OPEN / CLOSE (game sections)
   Copied from thz-script.js (the CoC pages). Only runs on pages with
   <body data-game-nav>: CoC, Minecraft and Web Resources still ship their
   own copy of these functions, and two definitions would fight. Once one
   of them adds data-game-nav and deletes its copy, it uses this one.
   Styles: "BOTTOM NAV + MORE SHEET (game sections)" in 11layout.css.
   ============================================================ */
(function initGameMoreSheet() {
  if (!document.body || !document.body.dataset.gameNav) return;
  const overlay = document.getElementById('moreOverlay');
  if (!overlay) return;

  function lockScroll(lock) {
    document.documentElement.classList.toggle('no-scroll', lock);
    const cocMain = document.querySelector('.coc-main');
    if (cocMain) cocMain.style.overflow = lock ? 'hidden' : '';
  }
  function setOpen(open) {
    overlay.classList.toggle('open', open);
    const wrap = document.getElementById('bnMoreWrap');
    if (wrap) wrap.classList.toggle('open', open);
    lockScroll(open);
  }
  // Global: the page markup calls these from onclick.
  window.toggleMoreMenu = () => setOpen(!overlay.classList.contains('open'));
  window.closeMoreMenu = () => setOpen(false);

  overlay.addEventListener('touchmove', e => {
    if (!e.target.closest('.more-sheet')) e.preventDefault();
  }, { passive: false });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) setOpen(false);
  });

  // DRAG-TO-CLOSE: dragging the handle down past ~28% of the sheet's
  // height (or a fast flick) closes the sheet; otherwise it snaps back.
  const sheet = overlay.querySelector('.more-sheet');
  const handle = overlay.querySelector('.more-sheet-handle');
  if (!sheet || !handle) return;
  let dragging = false, startY = 0, dragY = 0, sheetHeight = 1, lastY = 0, lastT = 0, velocity = 0;

  handle.addEventListener('pointerdown', e => {
    dragging = true;
    startY = lastY = e.clientY;
    lastT = Date.now();
    velocity = 0;
    sheetHeight = sheet.getBoundingClientRect().height || 1;
    sheet.classList.add('dragging');
    if (handle.setPointerCapture) handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    const now = Date.now();
    if (now > lastT) velocity = (e.clientY - lastY) / (now - lastT); // px per ms
    lastY = e.clientY;
    lastT = now;
    dragY = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dragY}px)`;
    overlay.style.opacity = String(1 - Math.min(dragY / sheetHeight, 1) * 0.9);
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('dragging');
    overlay.style.opacity = '';
    if (dragY > sheetHeight * 0.28 || velocity > 0.6) {
      // Close first, then drop the inline transform next frame so the CSS
      // transition animates from the drag position instead of jumping.
      setOpen(false);
      requestAnimationFrame(() => { sheet.style.transform = ''; });
    } else {
      sheet.style.transform = '';
    }
    dragY = 0;
  }
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
})();

/* PAGE LOADER + SCROLL RESTORE (game sections) -- was pasted at the bottom
   of every game page. Other sections still hide #page-loader from their
   own scripts, hence the same data-game-nav gate. */
(function initGamePageLoad() {
  if (!document.body || !document.body.dataset.gameNav) return;
  window.addEventListener('load', () => {
    document.documentElement.classList.add('loaded');
    const loader = document.getElementById('page-loader');
    if (!loader) return;
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 400);
  });

  // Back/forward lands where you left off inside .coc-main (the desktop
  // scroller). Same as the old per-page copy: phones scroll the window,
  // which this does not save.
  const cocMain = document.querySelector('.coc-main');
  if (!cocMain) return;
  history.scrollRestoration = 'manual';
  const key = 'scrollPos_' + location.pathname;
  cocMain.addEventListener('scroll', () => {
    try { sessionStorage.setItem(key, cocMain.scrollTop); } catch (e) {}
  }, { passive: true });
  window.addEventListener('pageshow', () => {
    let saved = null;
    try { saved = sessionStorage.getItem(key); } catch (e) {}
    if (saved) setTimeout(() => { cocMain.scrollTop = parseInt(saved, 10); }, 100);
  });
})();

/* ============================================================
   TOP BAR / SECONDARY TOP BAR LOGIC — SHARED
   Requires .secondary-top-bar + .coc-main (scrollToTop), and
   #help-popup + a [onclick="toggleHelp(event)"] trigger for the
   help popup, on the page.
   ============================================================ */

// SECONDARY TOP BAR AUTO TOP
function scrollToTop() {
  const main = document.querySelector('.coc-main');
  main.scrollTo({ top: 0, behavior: 'smooth' });
}

// SCROLLS TO TOP WHEN 2ND TOP BAR HIT
document.addEventListener('DOMContentLoaded', () => {
  const secondaryTopBar = document.querySelector('.secondary-top-bar');
  if (secondaryTopBar) secondaryTopBar.addEventListener('click', scrollToTop);
});

// HELP POPUP
function toggleHelp(event) {
  event.stopPropagation(); // prevent closing immediately
  const popup = document.getElementById('help-popup');
  if (popup) popup.style.display = popup.style.display === 'block' ? 'none' : 'block';
}
// CLOSE POPUP WHEN CLICKING OUTSIDE
document.addEventListener('click', () => {
  const popup = document.getElementById('help-popup');
  if (popup) popup.style.display = 'none';
});

/* ============================================================
   TOP-BAR SEARCH MODAL — SHARED
   Uses herosearch.json and renders fg-card style result boxes.
   Requires #search-btn, #search-icon, #search-overlay,
   #search-input, #search-input-clear, #search-results,
   #search-view-more, and .coc-main on the page.
   ============================================================ */
let topSearchItems = [];
let topSearchIsLoaded = false;
let topSearchVisibleCount = 12;
const TOP_SEARCH_INITIAL_COUNT = 12;
const TOP_SEARCH_LOAD_MORE_COUNT = 12;
let topSearchCurrentMatches = [];

let searchoverlay, searchinput, searchIcon, resultsContainer, topSearchViewMoreBtn, searchInputClearBtn;
let searchScrollObserver = null;

fetch('/herosearch.json')
  .then(res => res.json())
  .then(data => {
    topSearchItems = data;
    topSearchIsLoaded = true;
  })
  .catch(err => console.error('Top-bar search data failed to load:', err));

// Fisher-Yates shuffle — avoids the bias a naive sort-by-random can introduce.
function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Renders a single result as an fg-card — same box design used by
// Popular Topics / /'s hero search results.
function renderHeroSearchCard(item) {
  const a = document.createElement('a');
  a.href = item.link || '#';
  a.className = 'fg-card';

  a.innerHTML = `
    <div class="fg-img-wrap">
      <img src="${item.image}" class="fg-img">
      <div class="fg-img-shade"></div>
      <div class="fg-icon-badge"><img src="${item.icon}" alt=""></div>
    </div>
    <div class="fg-info">
      <h3 class="fg-title">${item.name}</h3>
      <p class="fg-sub">${item.sub}</p>
    </div>
  `;
  return a;
}

function renderTopSearchVisible() {
  resultsContainer.innerHTML = '';
  const visible = topSearchCurrentMatches.slice(0, topSearchVisibleCount);
  if (visible.length === 0) {
    resultsContainer.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:#949ba4; padding:30px 0;">No results found.</p>`;
    topSearchViewMoreBtn.style.display = 'none';
    if (searchScrollObserver) searchScrollObserver.unobserve(topSearchViewMoreBtn);
    return;
  }
  visible.forEach(item => resultsContainer.appendChild(renderHeroSearchCard(item)));

  const hasMore = topSearchCurrentMatches.length > topSearchVisibleCount;
  topSearchViewMoreBtn.style.display = hasMore ? 'block' : 'none';
  if (searchScrollObserver) {
    if (hasMore) searchScrollObserver.observe(topSearchViewMoreBtn);
    else searchScrollObserver.unobserve(topSearchViewMoreBtn);
  }
}

// Main search function — called on every keystroke and when the
// overlay first opens (with an empty query, showing a random sample).
function searchItems() {
  const query = searchinput.value.toLowerCase().trim();

  if (searchInputClearBtn) searchInputClearBtn.style.display = query ? 'flex' : 'none';

  const boxOne = document.getElementById('box-one');
  if (boxOne) boxOne.style.display = query ? 'none' : '';

  if (!query) {
    topSearchCurrentMatches = shuffleArray(topSearchItems);
  } else {
    topSearchCurrentMatches = topSearchItems.filter(item => {
      if (item.name && item.name.toLowerCase().includes(query)) return true;
      if (item.sub && item.sub.toLowerCase().includes(query)) return true;
      if (item.keywords && item.keywords.some(k => k.toLowerCase().includes(query))) return true;
      return false;
    });
  }

  topSearchVisibleCount = TOP_SEARCH_INITIAL_COUNT;
  renderTopSearchVisible();
}

// Defined at the top level (not nested inside DOMContentLoaded) so the
// button's click handler can actually find it.
let searchModalHistoryState = false; // tracks whether we've pushed a history entry for the open modal

function openSearch() {
  searchoverlay.style.display = 'block';
  document.getElementById('search-btn').classList.add('active'); // morphs the icon into an ✖, same pattern as the hamburger menu
  document.body.classList.add('search-modal-open'); // prevents the page behind the modal from scrolling
  if (window.bnHideNav) window.bnHideNav();
  searchinput.focus();
  searchItems();

  // Pushes a throwaway history entry so the phone's back button/gesture
  // triggers a popstate event instead of navigating off the page.
  if (!searchModalHistoryState) {
    history.pushState({ searchModal: true }, '');
    searchModalHistoryState = true;
  }
}

// `fromPopstate` is true when triggered by the back button itself —
// in that case the browser is already consuming the history entry, so
// we must NOT call history.back() again.
function closeSearch(fromPopstate) {
  searchinput.value = '';
  resultsContainer.innerHTML = '';
  searchoverlay.style.display = 'none';
  document.getElementById('search-btn').classList.remove('active');
  document.body.classList.remove('search-modal-open');
  if (window.bnResyncAfterModal) window.bnResyncAfterModal();

  const boxOne = document.getElementById('box-one');
  if (boxOne) boxOne.style.display = '';

  if (searchModalHistoryState) {
    searchModalHistoryState = false;
    if (!fromPopstate) {
      history.back(); // cleans up the throwaway history entry pushed by openSearch()
    }
  }
}

// The button's onclick — opens if closed, closes if already open,
// same toggle behavior as the hamburger button on the sidebar.
function toggleSearch() {
  if (searchoverlay.style.display === 'block') {
    closeSearch();
  } else {
    openSearch();
  }
}

// Mobile back button / gesture support: closes the modal instead of
// leaving the page, if the modal happens to be open when it fires.
window.addEventListener('popstate', () => {
  if (searchoverlay && searchoverlay.style.display === 'block') {
    closeSearch(true);
  }
});

document.addEventListener('DOMContentLoaded', function () {
  searchoverlay = document.getElementById('search-overlay');

  // The markup nests this inside .top-bar on 71 pages. That bar carries
  // `transform` + `will-change` for the auto-hide, and an ancestor with a
  // transform becomes the containing block AND stacking context for its
  // position:fixed descendants. So the overlay's `height:100%` resolved
  // against the 52px bar rather than the viewport -- you saw the input and
  // nothing else, with the results (~1000px of them) clipped out of view --
  // and its z-index:9999 was capped at the bar's own level. Re-parenting to
  // <body> gives it the viewport as its containing block again. Done here,
  // once, instead of editing the markup of every page; nothing styles or
  // queries it through its parent, so the move is invisible otherwise.
  if (searchoverlay && searchoverlay.parentElement !== document.body) {
    document.body.appendChild(searchoverlay);
  }

  resultsContainer = document.getElementById('search-results');
  searchinput = document.getElementById('search-input');
  searchIcon = document.getElementById('search-icon');
  topSearchViewMoreBtn = document.getElementById('search-view-more');
  searchInputClearBtn = document.getElementById('search-input-clear');

  if (!searchoverlay || !resultsContainer || !searchinput) return; // page has no search UI

  searchoverlay.addEventListener('click', e => {
    if (e.target === searchoverlay) closeSearch();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSearch();
  });

  // Auto-loads the next batch of results a bit before the user actually
  // reaches the bottom (rootMargin gives it a head start), so scrolling
  // feels continuous instead of hitting a button.
  searchScrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && topSearchVisibleCount < topSearchCurrentMatches.length) {
        topSearchVisibleCount += TOP_SEARCH_LOAD_MORE_COUNT;
        renderTopSearchVisible();
      }
    });
  }, { root: searchoverlay, rootMargin: '0px 0px 400px 0px' });

  // Guarded like the other use of this button further up: the clear (X) is
  // optional markup, and several pages' search boxes simply don't have one.
  // Unguarded, this threw on those pages and took the rest of this
  // DOMContentLoaded handler down with it.
  if (searchInputClearBtn) {
    searchInputClearBtn.addEventListener('click', () => {
      searchinput.value = '';
      searchItems();
      searchinput.focus();
    });
  }
});

/* ============================================================
   PULL TO REFRESH (mobile) — paste this whole block into
   11layout.js (anywhere at the top level is fine). Creates its
   own #ptr-indicator element on load, so no HTML changes are
   needed on any page — matching CSS already lives in
   11layout.css. Touch-only: does nothing on desktop/mouse.
   ============================================================ */
(function(){
  if(!('ontouchstart' in window)) return;

  var THRESHOLD = 70;   // px you need to pull before releasing triggers a reload
  var MAX_PULL   = 110; // px of pull the indicator fully "fills" at

  var indicator = document.createElement('div');
  indicator.id = 'ptr-indicator';
  // Arrow icon (points down at rest) — CSS handles its color (red/accent)
  // and its 180° flip once ptr-ready is applied; the pull-driven spin
  // below is applied to the whole indicator (circle + arrow together).
  indicator.innerHTML = '<svg viewBox="0 0 512 512" fill="currentColor"><path d="M463.5 224H472c13.3 0 24-10.7 24-24V72c0-9.7-5.8-18.5-14.8-22.2s-19.3-1.7-26.2 5.2L413.4 96.6c-87.6-86.5-228.7-86.2-315.8 1c-87.5 87.5-87.5 229.3 0 316.8s229.3 87.5 316.8 0c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0c-62.5 62.5-163.8 62.5-226.3 0s-62.5-163.8 0-226.3c62.2-62.2 162.7-62.5 225.3-1L327 183c-6.9 6.9-8.9 17.2-5.2 26.2s12.5 14.8 22.2 14.8H463.5z"/></svg>';
  document.body.appendChild(indicator);

  var startY = null;
  var pulling = false;
  var refreshing = false;

  // Same "which element is actually scrolling?" reading the two nav-bar
  // watchers above already use (see their getScrollY()). Reading only
  // window/documentElement is wrong on any page where .coc-main is the
  // real scroll container -- /coc/town-hall-18/layouts, for one, loads
  // 1coclayouts.css after 11layout.css, which keeps body at
  // overflow:hidden and .coc-main scrolling even on mobile. There
  // window.scrollY is pinned at 0 forever, so the "only start the
  // gesture from the very top" guard below always passed and any
  // downward drag mid-page silently reloaded the page.
  function scrollTop(){
    var winY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    var main = document.querySelector('.coc-main');
    var mainY = main ? main.scrollTop : 0;
    return Math.max(winY, mainY);
  }

  // Pull-to-refresh is a mobile-only pattern: below 971px, `body` is the
  // page's real scroll container, so scrollTop() above (window/documentElement)
  // correctly reflects "am I at the top?". At 971px+ (tablet landscape,
  // touch laptops), .coc-main becomes the real scroll container instead
  // (see its CSS comment) and `body` never scrolls — so window.scrollY
  // stays 0 forever, and scrollTop() can't tell "at the top" apart from
  // "scrolled halfway down .coc-main". Without this guard, every
  // finger-drag down at those widths gets misread as a pull-to-refresh
  // and silently reloads the page mid-scroll — and since #ptr-indicator
  // is also CSS-hidden at 971px+ (this feature was never meant to run
  // there), that reload happens with no visual warning at all. Checked
  // fresh (not cached) so rotating a tablet mid-session behaves correctly.
  function isMobileLayout(){
    return window.matchMedia('(max-width: 970px)').matches;
  }

  // True while any modal that locks background scroll is open (the More
  // sheet via html.no-scroll, the search overlay via body.search-modal-open,
  // the mobile sidebar, or the header's info/Browse-Settings dropdowns via
  // body.stb-dd-scroll-locked — see stbLockScroll/stbUnlockScroll in
  // /web-resources/ai-tools). While one of these is open, window/documentElement
  // scrollTop always reads 0 (the page is position:fixed underneath), so the
  // scrollTop()===0 check below can't tell "at the top of the page" apart
  // from "scrolling inside a modal on top of the page" — without this guard,
  // scrolling up inside e.g. the More sheet's own list, or swiping down
  // inside/over an open dropdown, gets misread as a pull-to-refresh gesture
  // and reloads the page.
  function modalScrollLocked(){
    return document.documentElement.classList.contains('no-scroll') ||
           document.body.classList.contains('search-modal-open') ||
           document.body.classList.contains('stb-dd-scroll-locked');
  }

  document.addEventListener('touchstart', function(e){
    if(refreshing) return;
    if(!isMobileLayout()) return; // desktop/tablet: .coc-main scrolls, not the page — see isMobileLayout() above
    if(modalScrollLocked()) return; // a sheet/overlay owns scrolling right now
    if(scrollTop() > 0) return; // only starts the gesture from the very top
    startY = e.touches[0].clientY;
    pulling = true;
  }, { passive: true });

  document.addEventListener('touchmove', function(e){
    if(!pulling || refreshing || startY === null) return;
    if(!isMobileLayout()){ // crossed into desktop/tablet mid-gesture — bail out quietly
      pulling = false;
      indicator.classList.remove('ptr-visible', 'ptr-ready');
      return;
    }
    if(modalScrollLocked()){ // a modal opened mid-gesture — bail out quietly
      pulling = false;
      indicator.classList.remove('ptr-visible', 'ptr-ready');
      return;
    }
    var delta = e.touches[0].clientY - startY;

    if(delta <= 0){
      indicator.classList.remove('ptr-visible', 'ptr-ready');
      return;
    }
    // If a scroll happens mid-gesture (page no longer at the top),
    // back off quietly instead of fighting the browser's own scroll.
    if(scrollTop() > 0){
      pulling = false;
      indicator.classList.remove('ptr-visible', 'ptr-ready');
      return;
    }

    var pull = Math.min(delta, MAX_PULL);
    indicator.style.transform = 'translateY(' + (pull - 40) + 'px) rotate(' + (pull * 3) + 'deg)';
    indicator.classList.add('ptr-visible');
    indicator.classList.toggle('ptr-ready', delta >= THRESHOLD);
  }, { passive: true });

  document.addEventListener('touchend', function(){
    if(!pulling || refreshing){ pulling = false; return; }
    pulling = false;

    if(indicator.classList.contains('ptr-ready')){
      refreshing = true;
      indicator.classList.add('ptr-loading');
      indicator.style.transform = 'translateY(10px) rotate(0deg)';
      setTimeout(function(){ location.reload(); }, 250);
    } else {
      indicator.classList.remove('ptr-visible', 'ptr-ready');
      indicator.style.transform = '';
    }
    startY = null;
  });
})();

/* ============================================================
   BOTTOM NAV AUTO-HIDE ON SCROLL (mobile, app-style)
   Moved here from /web-resources/ai-tools's own inline script — this is general
   layout behavior (the bn-bar/bottomNav + moreOverlay markup it
   depends on are the same shared components on every hwr-*.html
   page), so it belongs in the shared layout file rather than
   duplicated or living on just one page. Safe to run as soon as this
   script executes: it's loaded with `<script src="/11layout.js"
   defer>`, so the DOM (including #bottomNav) is already fully parsed
   by the time this runs, same as everything above it in this file.
   ============================================================ */
(function(){
  const bnBar = document.getElementById('bottomNav');
  const cocMain = document.querySelector('.coc-main');
  if(!bnBar) return;

  const DOWN_HIDE_THRESHOLD = 70; // px scrolled down before the bar hides — was 8, felt instant
  const UP_SHOW_THRESHOLD   = 55; // px scrolled up before the bar reappears
  const TOP_REVEAL_ZONE     = 40;

  function getScrollY(){
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

  // True while something has frozen the page's real scroll position
  // (via position:fixed or overflow:hidden on body/html) — the header's
  // info/Browse-Settings dropdowns (body.stb-dd-scroll-locked), the
  // search overlay (body.search-modal-open), the mobile sidebar
  // (body.sidebar-open), or the More sheet (html.no-scroll). Every one
  // of these makes window/documentElement scrollTop briefly read 0 the
  // instant it engages (see stbLockScroll's comment in /web-resources/ai-tools for
  // why), which this watcher would otherwise mistake for "scrolled to
  // the very top" and use as a reason to reveal the bar. Bailing out
  // here instead of updating lastY means those phantom jumps are
  // ignored entirely, so opening/closing one of these no longer flips
  // the bar's visibility on its own.
  function modalScrollLocked(){
    return document.documentElement.classList.contains('no-scroll') ||
           document.body.classList.contains('search-modal-open') ||
           document.body.classList.contains('stb-dd-scroll-locked') ||
           document.body.classList.contains('sidebar-open');
  }

  function onScroll(){
    if(modalScrollLocked()){ ticking = false; return; }
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
      downAccum += delta;
      upAccum = 0;
      if(downAccum > DOWN_HIDE_THRESHOLD) hideNav();
    } else if(delta < 0){
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

  const moreOverlay = document.getElementById('moreOverlay');
  if(moreOverlay){
    new MutationObserver(function(){
      if(moreOverlay.classList.contains('open')) showNav();
    }).observe(moreOverlay, {attributes:true, attributeFilter:['class']});
  }
})();

/* ============================================================
   TOP BAR AUTO-HIDE ON SCROLL (app-style)
   Same behavior as the BOTTOM NAV AUTO-HIDE block above, mirrored
   for the primary .top-bar (hamburger · logo · search): scrolling
   down hides it, scrolling up (or reaching the very top of the
   page) brings it back. While it's hidden, .secondary-top-bar is
   raised to top:0 to take its place, via the .stb-raised class
   (see 11layout.css). Lives in this shared file for the same
   reason as the bottom-nav block — .top-bar/.secondary-top-bar are
   the same shared header markup on every hwr-*.html page.
   ============================================================ */
(function(){
  const topBar = document.querySelector('.top-bar');
  const secondaryBar = document.getElementById('secondary-top-bar');
  const cocMain = document.querySelector('.coc-main');
  if(!topBar) return;

  const DOWN_HIDE_THRESHOLD = 70; // px scrolled down before the bar hides
  const UP_SHOW_THRESHOLD   = 55; // px scrolled up before the bar reappears
  const TOP_REVEAL_ZONE     = 40; // always shown within this many px of the top

  // Auto-hide is a mobile-only pattern (matches .bn-bar's own 970px
  // display:flex breakpoint in /web-resources/ai-tools) — desktop keeps a
  // permanently-docked top bar. Without this guard the bar was hiding
  // on scroll at every width, including desktop, which is not how
  // .top-bar.tb-hidden / .secondary-top-bar.stb-raised were meant to
  // be used (they're the same app-style pattern as the bottom nav,
  // which only ever renders on mobile in the first place — .top-bar
  // has no such CSS display:none guard, so it needed its own check
  // here). Checked fresh, not cached, so resizing/rotating mid-session
  // behaves correctly.
  function isMobileLayout(){
    return window.matchMedia('(max-width: 970px)').matches;
  }

  function getScrollY(){
    const winY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const mainY = cocMain ? cocMain.scrollTop : 0;
    return Math.max(winY, mainY);
  }

  let lastY = getScrollY();
  let upAccum = 0;
  let downAccum = 0;
  let ticking = false;

  function showTopBar(){
    topBar.classList.remove('tb-hidden');
    if(secondaryBar) secondaryBar.classList.remove('stb-raised');
  }
  function hideTopBar(){
    topBar.classList.add('tb-hidden');
    if(secondaryBar) secondaryBar.classList.add('stb-raised');
  }

  // Exposed for the same reason window.bnHideNav is above (e.g. so the
  // search-overlay opener can force the bar back on screen if needed).
  window.tbShowBar = showTopBar;
  window.tbHideBar = hideTopBar;

  // See the matching comment on modalScrollLocked() in the BOTTOM NAV
  // block above — same phantom-scrollTop-reset problem, this time it
  // was popping the top bar back open when it should have stayed
  // hidden (e.g. tapping the info/Browse-Settings buttons in
  // .stb-mobile-actions while scrolled down).
  function modalScrollLocked(){
    return document.documentElement.classList.contains('no-scroll') ||
           document.body.classList.contains('search-modal-open') ||
           document.body.classList.contains('stb-dd-scroll-locked') ||
           document.body.classList.contains('sidebar-open');
  }

  function onScroll(){
    if(!isMobileLayout()){ showTopBar(); ticking = false; return; }
    if(modalScrollLocked()){ ticking = false; return; }
    const currentY = getScrollY();
    const delta = currentY - lastY;

    if(currentY <= TOP_REVEAL_ZONE){
      showTopBar();
      upAccum = 0;
      downAccum = 0;
      lastY = currentY;
      ticking = false;
      return;
    }

    if(delta > 0){
      downAccum += delta;
      upAccum = 0;
      if(downAccum > DOWN_HIDE_THRESHOLD) hideTopBar();
    } else if(delta < 0){
      upAccum += -delta;
      downAccum = 0;
      if(upAccum > UP_SHOW_THRESHOLD) showTopBar();
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
  window.addEventListener('resize', function(){
    if(!isMobileLayout()) showTopBar();
  });
})();

/* ============================================================
   MORE-SHEET ACCORDION (Clash of Clans pages)

   Mirrors what hwr does in its own More sheet: each section collapses,
   and the one matching the page you're on is open when the sheet opens
   (see renderCategoryNav()'s `isCurrent ? ' open' : ''` in hwr-js.js).

   Lives here rather than in thz-script.js because /coc/ does not
   load thz-script.js but both pages do load this file -- one copy covers
   both. Pages with no .more-acc markup (every hwr page) exit immediately.
   ============================================================ */
function toggleMoreAcc(btn){
  var acc = btn.closest('.more-acc');
  if(!acc) return;
  var open = acc.classList.toggle('open');
  btn.setAttribute('aria-expanded', String(open));
}
window.toggleMoreAcc = toggleMoreAcc;

/* Rows in the Town Halls columns read "TH18" on their own, which is
   ambiguous once the two lists sit side by side -- the same "TH18" appears
   in both. Suffix each row with its column's kind so it reads "TH18 Layouts"
   / "TH18 Armies" and every row says where it goes on its own.

   Done here rather than in the markup because the two pages build these rows
   differently: th18-layouts gets them injected at runtime by thz-script.js,
   coc-home has them hardcoded. This runs after both (11layout.js is deferred,
   so it executes after thz-script.js, which is not) and covers either.
   Idempotent -- re-running will not double up the suffix. */
(function labelMoreSheetRows(){
  var cols = document.querySelectorAll('.th-cols .th-col');
  if(!cols.length) return;

  function apply(){
    cols.forEach(function(col){
      var head = col.querySelector('.th-col-head');
      var kind = head ? head.textContent.trim() : '';
      if(!kind) return;
      // Direct child only -- the .th-kind element added below is itself a
      // span, and a nested match would re-label the suffix on every re-run.
      col.querySelectorAll('.th-mini > span').forEach(function(span){
        if(span.querySelector('.th-kind')) return;   // already labelled
        var txt = span.textContent.trim();
        if(!txt) return;
        // Two nodes rather than one string, so CSS can weight the town-hall
        // number and mute the kind independently.
        span.textContent = txt;
        var k = document.createElement('span');
        k.className = 'th-kind';
        // Leading space is part of the text, not just a CSS margin -- otherwise
        // screen readers and copy-paste both get "TH18Layouts".
        k.textContent = ' ' + kind;
        span.appendChild(k);
      });
    });
  }

  apply();

  // On coc-home the rows are already in the markup, so the pass above is all
  // it takes. On th18-layouts thz-script.js builds them from a fetch of
  // coc-nav-data.json, which resolves AFTER this deferred file has run -- so
  // that first pass sees empty columns. Watch for the rows arriving and label
  // them then. apply() is idempotent, so re-running costs nothing.
  var host = document.querySelector('.th-cols');
  if(host && window.MutationObserver){
    new MutationObserver(apply).observe(host, { childList: true, subtree: true });
  }
})();

(function initMoreAccordion(){
  var accs = document.querySelectorAll('.more-acc');
  if(!accs.length) return;

  // Layouts and Armies are one merged "townhalls" section now, so the
  // layouts pages, the army pages and the coc-home hub all open it --
  // only the coctools-* guide pages differ.
  var page = cocPagePath(location.pathname);
  var current = page.indexOf('/coc/tools') === 0 && !/army-maker|damage-calculator/.test(page) ? 'guides' : 'townhalls';

  accs.forEach(function(acc){
    var key = acc.getAttribute('data-acc');
    // Guides has no collapse feature any more -- it's a plain static
    // section, always expanded, so it's excluded from the open/close logic
    // below entirely.
    if(key === 'guides'){
      acc.classList.add('open');
      return;
    }
    var isCurrent = key === current;
    acc.classList.toggle('open', isCurrent);
    var btn = acc.querySelector('.more-acc-toggle');
    if(btn) btn.setAttribute('aria-expanded', String(isCurrent));
  });
})();

/* ============================================================
   SITE FOOTER (.pf-footer) — SHARED
   ============================================================
   Moved here from hwr-js.js so every page renders the same footer, not
   just the hwr ones. Nothing in the markup is hardcoded — it is all data:
     11footer.json : social links, legal links, copyright, disclaimer
     sidebar.json  : the link row, mirroring the sidebar's own nav
                     (topBox + games; tripleA is left out because those
                     entries all point at the same placeholder page)
   Returns immediately on pages with no .pf-footer, so it costs them
   nothing. Styles live in 11layout.css. */
(function initSiteFooter() {
  // Some pages load this file from partway down the body (it has to run
  // before their own inline script, which references these globals), so the
  // footer markup further down the document does not exist yet. Wait for the
  // parse to finish before deciding the page simply has no footer.
  if (!document.querySelector('.pf-footer')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSiteFooter);
    }
    return;
  }

  var ICONS = {
    tiktok: '<path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z"/>',
    discord: '<path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>',
    x: '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>',
    reddit: '<path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>'
  };

  // "Back to top" (phones only -- hidden over 970px in 11layout.css).
  // Sits on the right of the "PARCHROME.NETLIFY.APP" label + social icons:
  // those two are wrapped in .pf-footer-head here, so no page's markup
  // has to change. The page scrolls in different places (the window on
  // phones, .coc-main on the Clash pages' desktop), so it scrolls every
  // scrolled box the footer sits in, plus the window.
  (function backToTop() {
    var label = document.getElementById('pfSocialLabel');
    var social = document.getElementById('pfFooterSocial');
    if (!label || !social || label.parentNode !== social.parentNode) return;
    var head = document.createElement('div');
    head.className = 'pf-footer-head';
    var brand = document.createElement('div');
    brand.className = 'pf-footer-head-main';
    label.parentNode.insertBefore(head, label);
    brand.appendChild(label);
    brand.appendChild(social);
    head.appendChild(brand);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pf-to-top';
    btn.innerHTML =
      '<span>Back to top</span><span class="pf-to-top-ring" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 18.5V6M6.5 11.5L12 6l5.5 5.5"/></svg></span>';
    head.appendChild(btn);
    btn.addEventListener('click', function() {
      var smooth = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
      var how = { top: 0, behavior: smooth ? 'smooth' : 'auto' };
      for (var el = head.parentNode; el && el !== document.body; el = el.parentNode) {
        if (el.scrollTop > 0) el.scrollTo(how);
      }
      window.scrollTo(how);
    });
  })();

  fetch('/11footer.json')
    .then(function(r) {
      return r.json();
    })
    .then(function(cfg) {
      var labelEl = document.getElementById('pfSocialLabel');
      if (cfg.socialLabel) labelEl.textContent = cfg.socialLabel;

      var socialEl = document.getElementById('pfFooterSocial');
      (cfg.socials || []).forEach(function(s) {
        var hasLink = !!(s.link && s.link.trim());
        var a = document.createElement('a');
        a.setAttribute('aria-label', hasLink ? s.name : s.name + ' (coming soon)');
        if (hasLink) {
          a.href = s.link;
          a.target = '_blank';
          a.rel = 'noopener';
        } else {
          a.href = '#';
          a.className = 'pf-social-disabled';
          a.setAttribute('aria-disabled', 'true');
          a.setAttribute('tabindex', '-1');
          a.title = 'Coming soon';
          a.onclick = function() {
            return false;
          };
        }
        var svgPath = ICONS[s.icon] || '';
        a.innerHTML = '<svg viewBox="0 0 24 24">' + svgPath + '</svg>';
        socialEl.appendChild(a);
      });

      var legalEl = document.getElementById('pfFooterLegal');
      (cfg.legalLinks || []).forEach(function(l) {
        var a = document.createElement('a');
        a.href = l.link;
        a.textContent = l.name;
        legalEl.appendChild(a);
      });

      document.getElementById('pfFooterCopyright').textContent = cfg.copyright || '';
      document.getElementById('pfFooterDisclaimer').textContent = cfg.disclaimer || '';
    })
    .catch(function(err) {
      console.error('Failed to load 11footer.json', err);
    });

  // ===================================================
  // FOOTER LINKS — built from sidebar.json's "topBox" + "games" entries
  // (name + link only), so the footer mirrors the sidebar's own nav
  // instead of listing the page categories. "tripleA" is intentionally
  // left out — those all point at the same placeholder page for now.
  // ===================================================
  function renderFooterLinks(entries) {
    var footerLinks = document.getElementById('pfFooterLinks');
    if (!footerLinks) return;
    var html = '';
    entries.forEach(function(entry) {
      var name = entry.name || '';
      var link = entry.link || '#';
      html += '<a href="' + link + '">' + name + '</a>';
    });
    footerLinks.innerHTML = html;
  }

  // Deliberately its own fetch rather than the cached loadSidebarData()
  // above: that helper sets `sidebarLoaded`, which toggleSidebar() reads as
  // "the sidebar has already been built". Calling it here on page load
  // flipped the flag before the user ever opened the sidebar, so the build
  // step was skipped and the sidebar came up empty. The browser serves this
  // second request from cache anyway.
  fetch('/sidebar.json')
    .then(function(res) {
      return res.json();
    })
    .then(function(data) {
      if (!data) return;
      var entries = [].concat(data.topBox || [], data.games || []);
      renderFooterLinks(entries);
    })
    .catch(function(err) {
      console.error('Failed to load sidebar.json', err);
    });
})();

/* ============================================================
   HORIZONTAL SCROLL ARROWS — SHARED
   ============================================================
   Moved here from hwr-js.js. Arrows appear only while there is something
   to scroll to on that side and are display:none otherwise, so a strip
   that fits gives back the gutter and the edge fade. A vertical wheel over
   a strip scrolls it sideways rather than throwing the page. */
function initHScrollArrows(scrollEl, leftBtn, rightBtn) {
  if (!scrollEl || !leftBtn || !rightBtn) return null;

  function updateArrows() {
    var maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
    var hideLeft = scrollEl.scrollLeft <= 4;
    var hideRight = scrollEl.scrollLeft >= maxScroll - 4 || maxScroll <= 0;
    leftBtn.classList.toggle('is-hidden', hideLeft);
    rightBtn.classList.toggle('is-hidden', hideRight);
    // .is-hidden is display:none now, so a strip whose arrow just went
    // away has to give back the gutter (and edge fade) it was holding
    // open for it — otherwise the chips sit inset against nothing.
    scrollEl.classList.toggle('no-arrow-left', hideLeft);
    scrollEl.classList.toggle('no-arrow-right', hideRight);
  }
  leftBtn.addEventListener('click', function(e) {
    e.stopPropagation(); // don't let this bubble to .secondary-top-bar's click→scrollToTop handler (11layout.js)
    scrollEl.scrollBy({
      left: -220,
      behavior: 'smooth'
    });
  });
  rightBtn.addEventListener('click', function(e) {
    e.stopPropagation(); // don't let this bubble to .secondary-top-bar's click→scrollToTop handler (11layout.js)
    scrollEl.scrollBy({
      left: 220,
      behavior: 'smooth'
    });
  });
  // WHEEL -> HORIZONTAL. A vertical wheel over the strip scrolls it
  // sideways instead of scrolling the page, so you never have to aim
  // for the little arrows. The wheel is trapped for as long as the
  // cursor is over the strip -- including at either end and when the
  // strip doesn't overflow at all -- so a flick over the bar can't
  // accidentally throw the page.
  //
  // deltaY drives it; a real horizontal wheel/trackpad gesture (deltaX)
  // wins when it's the larger of the two. deltaMode is normalized
  // because Firefox reports lines (1) or pages (2), not pixels (0).
  // behavior:'auto' is explicit -- .dsn-categories-scroll sets
  // scroll-behavior:smooth in CSS, which would otherwise ease every
  // notch and make this lag behind the wheel instead of tracking it 1:1.
  scrollEl.addEventListener('wheel', function(e) {
    e.preventDefault();
    var unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? scrollEl.clientWidth : 1;
    var delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    scrollEl.scrollBy({
      left: delta * unit,
      behavior: 'auto'
    });
  }, {
    passive: false
  });

  scrollEl.addEventListener('scroll', updateArrows, {
    passive: true
  });
  window.addEventListener('resize', updateArrows);
  // Re-check whenever the strip's own content changes size, not just when
  // the user scrolls or the window resizes. renderCategoryNav() (hwr-js.js)
  // already calls updateArrows() right after it injects the chips, so this
  // is redundant on a fast connection -- but on a slow one, or if a webfont
  // swaps in and reflows the chip widths after that call already ran, the
  // strip can end up overflowing with no arrow shown until the next scroll
  // or resize event happens to fire updateArrows() again. A ResizeObserver
  // catches that content-driven case directly, so the arrow is correct the
  // moment it's actually needed instead of only after the user's first
  // scroll accidentally re-triggers the check.
  if (window.ResizeObserver) {
    new ResizeObserver(updateArrows).observe(scrollEl);
  }
  updateArrows();
  return updateArrows;
}

// Shared so anything that injects into one of these strips later
// (e.g. 11layout.js's initHubNav(), which populates #stbHubNavScroll
// from an async fetch) can re-measure the same way instead of
// shipping its own copy of this logic.
window.initHScrollArrows = initHScrollArrows;

// DESKTOP SUB NAV — horizontal category strip scroll arrows
(function initDsnCategoriesScroll() {
  // Exposed so renderCategoryNav() can re-check arrow visibility right
  // after the chips are injected from hwr-categories.json (scrollWidth
  // isn't known until the new chips actually exist in the DOM).
  window.updateDsnScrollArrows = initHScrollArrows(
    document.getElementById('dsnCategoriesScroll'),
    document.getElementById('dsnScrollLeft'),
    document.getElementById('dsnScrollRight')
  );
})();

// WEB RESOURCES HUB NAV — same scroll-arrow treatment, same
// shrink-to-crushed problem at narrower widths as the strip above.
(function initStbHubNavScroll() {
  window.updateStbHubNavArrows = initHScrollArrows(
    document.getElementById('stbHubNavScroll'),
    document.getElementById('hubScrollLeft'),
    document.getElementById('hubScrollRight')
  );
})();

/* More-sheet row dropdowns. Moved here from hwr-js.js: every page that
   builds the sheet the shared way calls this from its rows. */
function toggleThMiniDropdown(btn) {
  var wrap = btn.closest('.th-mini-wrap');
  if (wrap) wrap.classList.toggle('open');
}
window.toggleThMiniDropdown = toggleThMiniDropdown;
