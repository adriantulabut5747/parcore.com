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
    // activePrefix works like the games' one below ("/articles/" lights up
    // on every article page).
    const prefix = item.activePrefix && normalizePage(item.activePrefix);
    const isActive =
      normalizePage(item.link) === currentPage ||
      item.activeOn?.map(normalizePage).includes(currentPage) ||
      (prefix && (currentPage === prefix || currentPage.startsWith(prefix + '/')));
    if (isActive) {
      a.classList.add('active'); }
    a.innerHTML = `
      <img src="${item.icon}" class="topbox-icon" alt=""
          onerror="this.style.display='none'">
      <span>${item.name}</span>`;
    topBox.appendChild(a);});

  // TOP GAMES (the upcoming mobile games from sidebar.json go last; no link yet)
  data.games.concat(data.upcoming || []).forEach(game => {
    const a = document.createElement('a');
    a.href = game.link || "#";
    a.className = 'game';
    // activePrefix: the whole section ("/coc/" lights up on /coc/ and every
    // page under it), so new pages don't need adding to a list.
    const prefix = game.activePrefix && normalizePage(game.activePrefix);
    if (
      (game.link && normalizePage(game.link) === currentPage) ||
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

  // TRIPLE A GAMES
  data.tripleA.forEach(game => {
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
  const isOpen = sidebar.classList.contains('active');
  burger.setAttribute('aria-expanded', String(isOpen));
  burger.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');

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

// The fixed bars stop --scrollbar-w short of the right edge so they don't
// cover .coc-main's scrollbar (11layout.css "FIXED BARS vs THE SCROLLBAR").
// The CSS default is 10px, but overlay scrollbars (Windows 11 / Chrome's
// thin floating ones, macOS, phones) take no width at all -- the bars then
// stopped 10px short for nothing and left a gap. Measure the real width.
function syncScrollbarWidth() {
  const main = document.querySelector('.coc-main');
  if (!main) return;
  document.documentElement.style.setProperty('--scrollbar-w', Math.max(0, main.offsetWidth - main.clientWidth) + 'px');
}
document.addEventListener('DOMContentLoaded', syncScrollbarWidth);
window.addEventListener('resize', syncScrollbarWidth);

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
    // "img": a picture (game icons) instead of an SVG. Pictures can't swap
    // outline/filled, so .gn-pic is greyed at rest and in colour when its
    // entry is active (11layout.css, same idea as CoC's .coc-nav-pic).
    if (item.img) return `<img class="gn-pic" src="${item.img}" alt="" decoding="async">`;
    const markup = (isActive && item.activeIcon) ? item.activeIcon : (item.icon || '');
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${markup}</svg>`;
  }

  // "soon": true = the page isn't built yet. It still shows, greyed out and
  // not clickable (no href), so the section's plan is visible without 404s.
  function itemHtml(item, className) {
    if (item.soon) {
      return `<a class="${className} is-soon" aria-disabled="true" title="Coming soon">${iconSvg(item, false)}<span>${item.name}</span></a>`;
    }
    // activePrefix: lit on every page under that folder (Articles' "Clash of
    // Clans" stays lit while reading /articles/coc/<slug>). noActive: never
    // lit (Articles' "Search" points at the feed, like "All").
    const prefix = item.activePrefix && normalizePage(item.activePrefix);
    const isActive = !item.noActive && ((item.link.charAt(0) !== '#' && normalizePage(item.link) === currentPage) ||
      (item.activeOn || []).some(l => normalizePage(l) === currentPage) ||
      !!(prefix && (currentPage === prefix || currentPage.startsWith(prefix + '/'))));
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
    let items = (data && data.hubNav) || [];
    if (!items.length) return;
    // Web Resources: "Resources" (the hub home) stays lit on every category
    // page too, since the categories sit under it (its menu lists them).
    const cats = (!gameKey && data.categories) || [];
    if (cats.length) {
      items = items.map(it => normalizePage(it.link) === normalizePage('/web-resources/')
        ? Object.assign({}, it, { activeOn: cats.map(c => c.link) }) : it);
    }

    // Only strips that aren't self-managed (Minecraft fills its own with its
    // editions; it only lets this build its bottom bar).
    if (buildHubStrip) {
      // Fill the #stbHubNavScroll strip inside the <nav>; the `|| stbHubNav`
      // fallback covers a page that ships the nav without the strip.
      const hubStrip = stbHubNav.querySelector('#stbHubNavScroll') || stbHubNav;
      hubStrip.innerHTML = items.map(item => itemHtml(item, 'stb-hub-link')).join('');

      // Web Resources menu: hovering "Resources" lists the categories, and
      // hovering a category lists that page's sections (its table of
      // contents from hwr-categories.json "sections"), each linking to the
      // section's #toc-<id> anchor.
      if (cats.length && window.stbHubMenus) {
        const secs = data.sections || {};
        window.stbHubMenus(hubStrip, {
          keyOf: link => (normalizePage(link.getAttribute('href')) === normalizePage('/web-resources/') ? 'resources' : ''),
          labels: { resources: 'Resources' },
          lists: {
            resources: cats.map(c => ({
              href: c.link, icon: c.icon, name: c.name,
              children: (secs[c.link] || []).map(sec => ({ href: c.link + '#toc-' + sec.id, svg: sec.icon, name: sec.title }))
            }))
          }
        });
      }
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
  // Genshin (Oct 24 2026): `opts.short` = the first step's phone wording ("Genshin", like CoC's
  // "COC"); `opts.mid` = a middle step (the page's group: "Genshin Impact › Events › Banners"),
  // `opts.here` = the page when it isn't in `pages` (a group's own page, e.g. /genshin-impact/tools).
  function buildCrumbs(homeLink, homeName, pages, opts) {
    opts = opts || {};
    const left = document.querySelector('.secondary-left');
    const title = left && left.querySelector('.secondary-content');
    if (!title || left.querySelector('.stb-crumbs')) return;
    const here = opts.here || pages.find(item => !item.soon && normalizePage(item.link) === currentPage);
    if (!here || normalizePage(here.link) === normalizePage(homeLink)) return;
    const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const sep = `<span class="stb-crumb-sep" aria-hidden="true">›</span>`;
    const home = opts.short
      ? `<span class="stb-crumb-long">${esc(homeName)}</span><span class="stb-crumb-short">${esc(opts.short)}</span>`
      : esc(homeName);
    const crumbs = document.createElement('nav');
    crumbs.className = 'stb-crumbs';
    crumbs.setAttribute('aria-label', 'Breadcrumb');
    crumbs.innerHTML =
      `<a href="${homeLink}">${home}</a>` + sep +
      (opts.mid ? `<a href="${opts.mid.link}">${esc(opts.mid.name)}</a>` + sep : '') +
      `<a href="${here.link}" aria-current="page">${esc(here.name)}</a>`;
    title.after(crumbs);
    left.classList.add('has-crumbs');
  }

  // "groups" (Genshin, Oct 22 2026): a section with many pages shows its
  // groups instead (Live / Database / Tools / Guides). Each group is one
  // top-bar link with a hover menu of its pages, one phone-bar item that
  // opens the More sheet at that group, and one labelled section of the
  // sheet (11layout.css "MORE SHEET" .mx tiles, like Minecraft and CoC). A group link
  // isn't a page itself (href "#gn-<i>"); it's lit when you're on one of
  // its built pages.
  // Oct 24 2026 (Adrian, "like the clash of clans"): every group has a "link". A group with no
  // pages (Lobby) is a plain link; the others link to their group page ("All tools" etc., CoC's Tools button):
  // a click / phone tap goes there, desktop hover opens the menu of its pages. Page icons are
  // pictures (in-game art), shown in the menu rows and the sheet's tiles; group icons stay SVG.
  // Minecraft (Oct 27 2026): a group's "img" = a picture icon instead of the SVG "icon"; a group
  // with no "link" (Spin-offs, nothing built yet) points at its More-sheet section, "#gn-sec-<i>":
  // desktop hover still opens its menu, a tap on phones opens the sheet there (listener below).
  function buildGroups(game) {
    const groups = game.groups;
    // A page with "activePrefix" is also "here" on every address under it
    // (Player lookup: /genshin-impact/player/<UID>).
    const here = p => !p.soon && (normalizePage(p.link) === currentPage ||
      !!(p.activePrefix && currentPage.startsWith(normalizePage(p.activePrefix) + '/')));
    const menus = groups.filter(g => g.pages.length);
    const hrefOf = g => g.link || '#gn-sec-' + menus.indexOf(g);
    // A group's own page ("Events hub", "All tools") stays in game-nav.json (trail, search, the
    // group-page cards read it) but never as a menu row or sheet tile (Oct 28 2026, Adrian): the
    // group link itself goes there, and on that page the sheet lights the group's label instead.
    const isHub = (g, p) => !!g.link && normalizePage(p.link) === normalizePage(g.link);
    const rows = g => g.pages.filter(p => !isHub(g, p));
    const keyStr = h => (h.charAt(0) === '#' ? h : normalizePage(h));
    buildHubNav({ hubNav: groups.map(g => ({
      name: g.name, link: hrefOf(g), icon: g.icon, img: g.img,
      activeOn: g.pages.some(here) ? [currentPage] : []
    })) });
    const keyOf = {};
    menus.forEach((g, i) => (keyOf[keyStr(hrefOf(g))] = 'gn-' + i));
    if (buildHubStrip) {
      window.stbHubMenus(stbHubNav.querySelector('#stbHubNavScroll') || stbHubNav, {
        keyOf: link => keyOf[keyStr(link.getAttribute('href') || '')] || '',
        labels: Object.fromEntries(menus.map((g, i) => ['gn-' + i, g.name])),
        cols: Object.fromEntries(menus.map((g, i) => ['gn-' + i, g.cols])), // "cols": 2 in game-nav.json = a 2-across menu
        lists: Object.fromEntries(menus.map((g, i) => ['gn-' + i, rows(g).map(p => ({ href: p.soon ? '' : p.link, name: p.name, sub: p.sub, soon: p.soon, icon: p.icon }))]))
      });
    }
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#gn-sec-"]');
      if (!a) return;
      e.preventDefault(); // not a page: never touch the address (Mob Summon keeps its build in the hash)
      const overlay = document.getElementById('moreOverlay');
      if (window.matchMedia('(min-width: 971px)').matches || !overlay) return;
      if (!overlay.classList.contains('open')) window.toggleMoreMenu();
      const sec = document.getElementById(a.getAttribute('href').slice(1));
      if (sec) sec.scrollIntoView({ block: 'start' });
    });

    const list = document.querySelector('#moreOverlay .more-list');
    if (list) {
      const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const ico = p => (p.icon ? `<span class="mx-tool-ico"><img src="${p.icon}" alt="" loading="lazy" decoding="async"></span>` : '');
      const tile = p => p.soon
        ? `<a class="mx-tool is-soon" aria-disabled="true">${ico(p)}<span class="mx-tool-name">${esc(p.name)}</span></a>`
        : `<a class="mx-tool${here(p) ? ' active' : ''}" href="${p.link}">${ico(p)}<span class="mx-tool-name">${esc(p.name)}</span></a>`;
      list.classList.add('mx');
      list.innerHTML = menus.map((g, i) => {
        const on = g.pages.some(p => isHub(g, p) && here(p));
        return `<section class="mx-sec" id="gn-sec-${i}"><div class="mx-head"><h3 class="mx-label mx-label--ico${on ? ' active' : ''}"${on ? ' aria-current="page"' : ''}>${g.img ? `<img class="mx-label-pic" src="${g.img}" alt="">` : `<svg viewBox="0 0 24 24" aria-hidden="true">${g.icon}</svg>`}${esc(g.name)}</h3></div>` +
          `<div class="mx-tools">${rows(g).map(tile).join('')}</div></section>`;
      }).join('');
      const count = document.querySelector('#moreOverlay .mx-hdr-count');
      const all = [].concat(...menus.map(rows));
      if (count) count.textContent = all.filter(p => !p.soon).length + ' live · ' + all.length + ' pages';
    }

    // Trail: "Genshin Impact › Events › Banners"; a group page is "Genshin Impact › Events".
    const crumb = { short: game.short };
    menus.forEach(g => {
      const page = g.pages.find(here);
      if (!page) return;
      if (normalizePage(page.link) === normalizePage(g.link)) crumb.here = { name: g.name, link: g.link };
      else Object.assign(crumb, { here: page, mid: { name: g.name, link: g.link } });
    });
    buildCrumbs(game.home, game.name, [], crumb);
  }

  if (gameKey) {
    getFeaturedJSON('/game-nav.json')
      .then(all => {
        const game = all[gameKey];
        if (!game) return console.error('game-nav.json has no "' + gameKey + '" entry');
        if (game.groups) return buildGroups(game);
        buildHubNav({ hubNav: game.pages, bottomNav: game.pages.filter(p => p.bottomNav) });
        // "more": a section can give the sheet its own list (Articles lists
        // the featured games) instead of repeating its pages.
        buildMoreSheet(game.more || game.pages);
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
   <body data-game-nav>: CoC and Web Resources still ship their
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

/* MORE SHEET PULL-TO-CLOSE (every page, Oct 24 2026): pulling the sheet's list down once it is
   at the top drags the whole sheet, like app sheets (also mid-swipe: scroll up to the top and keep
   going); same rule as the handle drag: past ~28% of its height or a fast flick closes it. NOT gated
   on data-game-nav: CoC and Web Resources keep their own open/close copies, but all of
   them have #moreOverlay > .more-sheet and a global closeMoreMenu() (the overlay's onclick), so this
   one listener serves every page. Touch events, not pointer ones: a scroller cancels pointers. */
(function initMorePull() {
  function init() {
    const overlay = document.getElementById('moreOverlay');
    const sheet = overlay && overlay.querySelector('.more-sheet');
    if (!sheet || typeof window.closeMoreMenu !== 'function') return;
    let p = null;
    // At the top = nothing between the finger and the overlay is scrolled down.
    const atTop = el => { for (; el && el !== overlay; el = el.parentNode) if (el.scrollTop > 0) return false; return true; };
    sheet.addEventListener('touchstart', e => {
      const t = e.touches[0];
      p = e.touches.length === 1 && !e.target.closest('.more-sheet-handle') ? { x: t.clientX, y: t.clientY, on: false } : null;
    }, { passive: true });
    sheet.addEventListener('touchmove', e => {
      if (!p) return;
      const { clientX: x, clientY: y } = e.touches[0];
      const now = Date.now();
      if (!p.on && y - p.y > Math.abs(x - p.x) && atTop(e.target)) {
        Object.assign(p, { on: true, y0: y, dy: 0, v: 0, t: now, h: sheet.getBoundingClientRect().height || 1 });
        sheet.classList.add('dragging');
      }
      if (p.on) {
        if (e.cancelable) e.preventDefault();
        if (now > p.t) p.v = (y - p.y) / (now - p.t); // px per ms
        p.t = now;
        p.dy = Math.max(0, y - p.y0);
        sheet.style.transform = `translateY(${p.dy}px)`;
        overlay.style.opacity = String(1 - Math.min(p.dy / p.h, 1) * 0.9);
      }
      p.x = x;
      p.y = y;
    }, { passive: false });
    const end = () => {
      if (p && p.on) {
        sheet.classList.remove('dragging');
        overlay.style.opacity = '';
        if (p.dy > p.h * 0.28 || p.v > 0.6) {
          window.closeMoreMenu();
          requestAnimationFrame(() => { sheet.style.transform = ''; }); // animate from where the finger left it
        } else {
          sheet.style.transform = '';
        }
      }
      p = null;
    };
    sheet.addEventListener('touchend', end);
    sheet.addEventListener('touchcancel', end);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
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
   TOP-BAR SEARCH — SHARED (Oct 26 2026)
   A dropdown under the bar's search box on desktop, a full-screen panel
   on phones. Empty box = suggestion chips; typing = one row per page
   (game icon, name, tags). Data: /search.json (see its _readme), plus
   live articles and the Genshin nav pages it doesn't list.
   Requires #search-btn, #search-overlay, #search-input,
   #search-input-clear and #search-results on the page.
   ============================================================ */
let topSearchItems = [];
let topSearchSuggest = [];
let searchSel = 0; // the row Enter opens (arrow keys move it)

let searchoverlay, searchinput, searchIcon, resultsContainer, searchInputClearBtn;

// ---- Featured Topics data: the home page's tile groups. home.json
// "featured" lists the groups; a group either lists its tiles or pulls
// them from hwr-categories.json ("from": "hwr") or game-nav.json
// ("gameNav": key). Edit those files, not this code.
// (404.html has a short copy of this for its "Find a page" box.)
// the cache lives on the function: initHubNav (above) calls this while the script is still loading
function getFeaturedJSON(url) {
  const c = getFeaturedJSON.c || (getFeaturedJSON.c = {});
  if (!c[url]) c[url] = fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  return c[url];
}
// One download per JSON per page (Oct 28 2026): game-nav.json was fetched 4 times on /minecraft/, Mojang's version
// list twice. Page scripts call window.pcJSON(url); callers share the parsed object, so never mutate it.
window.pcJSON = getFeaturedJSON;
function featuredTilesOf(g) {
  if (g.from === 'hwr') {
    return getFeaturedJSON('/hwr-categories.json').then(c => (c.categories || []).map(x => ({
      name: x.name, sub: 'Web Resources', link: x.link,
      // home uses small copies of the category banners: /icons/home/<same name>.webp
      image: (x.bg || '').replace(/^\/webresources-icon\/(.+)\.\w+$/, '/icons/home/$1.webp')
    })));
  }
  if (g.gameNav) {
    return getFeaturedJSON('/game-nav.json').then(n => ((n[g.gameNav] || {}).pages || []).map(p => {
      const o = (g.tiles || {})[p.link] || {};
      return { name: o.name || p.name, sub: o.sub || g.title, link: p.link, image: o.image || g.cover, soon: p.soon };
    }));
  }
  return Promise.resolve(g.tiles || []);
}
// -> Promise of [{ title, link, icon, tiles: [...] }], groups in page order.
function loadFeaturedGroups() {
  return getFeaturedJSON('/home.json').then(d => Promise.all((d.featured || []).map(g =>
    featuredTilesOf(g).catch(() => []).then(tiles => Object.assign({}, g, { tiles: tiles }))
  )));
}

// Search index. Each item carries `hay` = every word it can be found by.
// A query word matches the START of a word ("lay" finds Layouts, "ai" doesn't find Repair).
const searchWords = t => t.toLowerCase().split(/[^a-z0-9★+]+/).filter(Boolean);
Promise.all([
  getFeaturedJSON('/search.json'),
  getFeaturedJSON('/articles.json').catch(() => ({})),
  getFeaturedJSON('/game-nav.json').catch(() => ({}))
]).then(([s, arts, nav]) => {
  const add = (p, g) => topSearchItems.push(Object.assign({ icon: g.icon, group: g.name,
    hay: searchWords([p.name, p.tags, g.name, p.k].join(' ')) }, p));
  s.groups.forEach(g => {
    g.pages.forEach(p => add(p, g));
    if (!g.gameNav) return;
    const listed = new Set(g.pages.map(p => p.link));
    ((nav[g.gameNav] || {}).groups || []).forEach(x => (x.pages || []).forEach(p => {
      if (!p.soon && !listed.has(p.link)) add({ name: p.name, tags: p.desc || '', link: p.link }, g);
    }));
  });
  (arts.articles || []).filter(a => a.status === 'live').forEach(a => {
    const g = s.groups.find(x => x.game === a.game) || { name: 'Articles', icon: '/icons/articles.svg' };
    add({ name: a.title, tags: [a.category, (a.dek || '').replace(/\.$/, '')].filter(Boolean).join(' · '),
      link: '/articles/' + a.game + '/' + a.id, k: 'article guide', article: true }, g);
  });
  topSearchSuggest = s.suggest || [];
  if (searchoverlay && searchoverlay.style.display === 'block') searchItems();
}).catch(err => console.error('Top-bar search data failed to load:', err));

function searchEl(tag, cls, text) {
  const n = document.createElement(tag);
  n.className = cls;
  if (text) n.textContent = text;
  return n;
}

// One result: the game's icon, the name, the tags under it.
function searchRow(item) {
  const a = searchEl('a', 'sr-row');
  a.href = item.link;
  const icon = searchEl('img', 'sr-icon');
  icon.src = item.icon;
  icon.alt = '';
  icon.loading = 'lazy';
  const text = searchEl('span', 'sr-text');
  text.append(searchEl('span', 'sr-name', item.name), searchEl('span', 'sr-tags', item.tags));
  a.append(icon, text);
  if (item.article) {
    // articles wear the Articles icon top-right, so they read apart from tools and pages
    const badge = searchEl('img', 'sr-badge');
    badge.src = '/icons/articles.svg';
    badge.alt = 'Article';
    badge.title = 'Article';
    a.appendChild(badge);
  }
  return a;
}

function searchSelect(i) {
  const rows = resultsContainer.querySelectorAll('.sr-row');
  if (!rows.length) return;
  searchSel = (i + rows.length) % rows.length;
  rows.forEach((r, j) => r.classList.toggle('is-sel', j === searchSel));
  rows[searchSel].scrollIntoView({ block: 'nearest' });
}

// Called on every keystroke and when the panel opens.
function searchItems() {
  const q = searchinput.value.toLowerCase().trim();
  if (searchInputClearBtn) searchInputClearBtn.style.display = q ? 'flex' : 'none';
  resultsContainer.innerHTML = '';

  if (!q) {
    if (!topSearchSuggest.length) return;
    const box = searchEl('div', 'sr-suggest');
    box.appendChild(searchEl('p', 'sr-label', 'Try searching'));
    const chips = searchEl('div', 'sr-chips');
    topSearchSuggest.forEach(s => {
      const b = searchEl('button', 'sr-chip', s);
      b.type = 'button';
      b.addEventListener('click', () => { searchinput.value = s; searchItems(); searchinput.focus(); });
      chips.appendChild(b);
    });
    box.appendChild(chips);
    resultsContainer.appendChild(box);
    return;
  }

  // every word must appear somewhere; pages whose NAME holds the whole query come first
  const words = searchWords(q);
  const hits = topSearchItems.filter(it => words.every(w => it.hay.some(h => h.startsWith(w))));
  hits.sort((a, b) => b.name.toLowerCase().includes(q) - a.name.toLowerCase().includes(q));
  if (!hits.length) {
    resultsContainer.appendChild(searchEl('p', 'sr-empty', 'Nothing matches "' + searchinput.value.trim() + '".'));
    return;
  }
  hits.forEach(it => resultsContainer.appendChild(searchRow(it)));
  searchSelect(0);
}

// Defined at the top level (not nested inside DOMContentLoaded) so the
// button's click handler can actually find it.
let searchModalHistoryState = false; // tracks whether we've pushed a history entry for the open modal

function openSearch() {
  // desktop: the dropdown hangs from the bar's search box, right edges lined up
  const box = document.querySelector('.stb-search');
  const r = box && box.offsetWidth ? box.getBoundingClientRect() : null;
  const panel = document.getElementById('search-panel');
  if (r && panel) {
    panel.style.setProperty('--sp-right', Math.max(16, window.innerWidth - r.right) + 'px');
    panel.style.setProperty('--sp-w', Math.max(560, r.width) + 'px');
  }
  searchoverlay.style.display = 'block';
  const searchBtn = document.getElementById('search-btn');
  searchBtn.classList.add('active'); // morphs the icon into an ✖, same pattern as the hamburger menu
  searchBtn.setAttribute('aria-expanded', 'true');
  searchBtn.setAttribute('aria-label', 'Close search');
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
  const searchBtn = document.getElementById('search-btn');
  searchBtn.classList.remove('active');
  searchBtn.setAttribute('aria-expanded', 'false');
  searchBtn.setAttribute('aria-label', 'Search');
  document.body.classList.remove('search-modal-open');
  if (window.bnResyncAfterModal) window.bnResyncAfterModal();

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
  // Box the input, results and "Loading more" line into one panel: on
  // desktop it's the centered card, and the overlay around it is the dim
  // backdrop (a click on the backdrop still hits #search-overlay and closes).
  if (searchoverlay && !document.getElementById('search-panel')) {
    const panel = document.createElement('div');
    panel.id = 'search-panel';
    panel.append(...searchoverlay.children);
    searchoverlay.appendChild(panel);
  }

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

  // One search button on every page: pages ship older icon markup and
  // inline styles, so rebuild it here (styled in 11layout.css).
  const searchBtn = document.getElementById('search-btn');
  if (searchBtn) {
    searchBtn.removeAttribute('style');
    searchBtn.type = 'button';
    searchBtn.setAttribute('aria-label', 'Search Parchrome');
    searchBtn.innerHTML =
      '<svg id="search-icon" class="sb-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/></svg>' +
      '<svg id="close-icon" class="sb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>' +
      '<span class="sb-label">Search Parchrome</span><kbd class="sb-key">/</kbd>';
    searchBtn.classList.add('sb-ready');
  }

  // ONE DESKTOP BAR: the secondary bar carries the search on desktop (the
  // top bar is hidden there, see 11layout.css). Pages without a secondary
  // bar (the site home) get a plain one with the page's name. The button is
  // display:none on phones, where the top bar's icon stays.
  if (searchoverlay) {
    let bar = document.querySelector('.secondary-top-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'secondary-top-bar stb-generated';
      bar.id = 'secondary-top-bar';
      bar.innerHTML = '<div class="secondary-left"><img class="th-icon" src="/icons/home.jpg" alt=""><div class="secondary-content">Lobby</div></div>';
      document.body.appendChild(bar);
    }
    if (!bar.querySelector('.stb-search')) {
      const wrap = document.createElement('div');
      wrap.className = 'stb-search-wrap';
      wrap.innerHTML =
        '<button type="button" class="stb-search" aria-label="Search Parchrome">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/></svg>' +
        '<span>Search Parchrome</span><kbd>/</kbd></button>';
      bar.appendChild(wrap);
    }
    bar.querySelectorAll('.stb-search').forEach(b => {
      b.removeAttribute('onclick');
      b.addEventListener('click', toggleSearch);
    });

    // Desktop layout (11layout.css ONE DESKTOP BAR): title/breadcrumb on the
    // left edge, menus in the centre, search + buttons on the right edge.
    // Each half gives way on its own: the breadcrumb shortens by itself
    // (CSS, capped at its half via --hub-w); the right half gets .stb-tight
    // (search -> icon). If either half still overflows, .stb-icons shows the
    // other menu links as icons only. The menus never scroll. Re-checked
    // whenever the bar or anything in it changes size (menus and crumbs are
    // filled in later).
    const hub = bar.querySelector('.stb-hub-nav');
    const left = bar.querySelector('.secondary-left');
    // Right-side items: the bar's children minus the title and menus, looking
    // inside display:contents wrappers (/coc/'s .stb-right holds the (i)).
    const rightItems = () => Array.from(bar.children)
      .flatMap(c => (getComputedStyle(c).display === 'contents' ? Array.from(c.children) : [c]))
      .filter(c => c !== hub && c !== left && c.offsetWidth);
    // --hub-w caps the title at its half; --act-w (the buttons beside the
    // search, plus gaps) lets the search narrow to fit the right half.
    const setHubWidth = () => {
      const gap = parseFloat(getComputedStyle(bar).columnGap) || 0;
      const act = rightItems().filter(c => !c.classList.contains('stb-search-wrap')).reduce((w, c) => w + c.offsetWidth + gap, 0);
      bar.style.setProperty('--hub-w', (hub ? hub.offsetWidth : 0) + 'px');
      bar.style.setProperty('--act-w', act + 'px');
    };
    // Left half overflows = a breadcrumb clipped even with its steps at their
    // shortest, or a plain title cut short ("...").
    const clipped = n => n.getClientRects().length && n.scrollWidth > n.clientWidth + 1;
    const leftOverflows = () =>
      (left && left.scrollWidth > left.clientWidth + 1) ||
      Array.from(bar.querySelectorAll('.stb-crumbs, .secondary-left > .secondary-content:not(.has-crumbs)')).some(clipped);
    // Right half overflows = a right-side item past the bar's padding or
    // within 12px of the menus. (Rects, not scrollWidth, which would also
    // count popovers inside the bar.)
    const rightOverflows = () => {
      const b = bar.getBoundingClientRect();
      const edge = b.right - parseFloat(getComputedStyle(bar).paddingRight) + 1;
      const h = hub && hub.offsetWidth ? hub.getBoundingClientRect() : null;
      return rightItems().some(c => {
        const r = c.getBoundingClientRect();
        return r.right > edge || (h && r.left < h.right + 11);
      });
    };
    // Steps, each only if the previous one wasn't enough:
    // 1) .stb-tight  search -> icon (only when the right half overflows)
    // 2) .stb-flow   the menus leave the centre and sit in the row (title |
    //                menus | search), so neither half is capped at 50%
    // 3) .stb-icons  the other menu links show only their icon
    const overflowing = () => rightOverflows() || leftOverflows();
    const fitBar = () => {
      bar.classList.remove('stb-tight', 'stb-flow', 'stb-icons');
      setHubWidth();
      // A shortened crumb keeps ~4 letters + "..." (48px), or its own width
      // if it's shorter than that -- a CSS min-width would pad "Tools" out.
      bar.querySelectorAll('.stb-crumbs a:not([aria-current])').forEach(a => {
        a.style.minWidth = '';
        a.style.minWidth = Math.min(a.scrollWidth, 48) + 'px';
      });
      if (rightOverflows()) bar.classList.add('stb-tight');
      if (!overflowing()) return;
      bar.classList.add('stb-flow');
      if (!overflowing()) return;
      bar.classList.add('stb-icons');
      setHubWidth();
      bar.querySelectorAll('.stb-hub-link:not([title])').forEach(a => { a.title = a.textContent.trim(); });
    };
    if (window.ResizeObserver) {
      // The menus are out of the row, so filling them resizes nothing else:
      // watch them (and the title) directly, as well as the right side.
      const ro = new ResizeObserver(fitBar);
      [bar, hub, left, ...rightItems()].forEach(el => el && ro.observe(el));
    }
    fitBar();
  }
  resultsContainer = document.getElementById('search-results');
  searchinput = document.getElementById('search-input');
  searchIcon = document.getElementById('search-icon');
  searchInputClearBtn = document.getElementById('search-input-clear');

  if (!searchoverlay || !resultsContainer || !searchinput) return; // page has no search UI

  searchoverlay.addEventListener('click', e => {
    if (e.target === searchoverlay) closeSearch();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSearch();
    // "/" opens the search from anywhere, unless you're typing in a field
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && searchoverlay.style.display !== 'block') {
      const t = e.target;
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      e.preventDefault();
      openSearch();
    }
  });

  searchinput.placeholder = 'Search games, tools and guides';
  // typing searches (replaces the inline oninput some pages still carry, so it never runs twice)
  searchinput.oninput = searchItems;
  // arrows move the highlighted row, Enter opens it
  searchinput.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      searchSelect(searchSel + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter') {
      const row = resultsContainer.querySelectorAll('.sr-row')[searchSel];
      if (row) location.href = row.href;
    }
  });

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
  // and reloads the page. Also: every bottom-sheet drawer (a modal <dialog>:
  // CoC Equipment, Genshin Weapons/Artifacts/Enemies…), the Damage
  // Calculator's sheet (html.dc-lock) and the phone sidebar (.sidebar.active;
  // some pages toggle only that, never body.sidebar-open). Oct 27 2026.
  function modalScrollLocked(){
    return document.documentElement.classList.contains('no-scroll') ||
           document.documentElement.classList.contains('dc-lock') ||
           document.body.classList.contains('search-modal-open') ||
           document.body.classList.contains('stb-dd-scroll-locked') ||
           !!document.querySelector('dialog[open], .sidebar.active');
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
  // TEST SWITCH (Oct 21 2026): false = the phone top bar stays put on scroll,
  // on every page. Set back to true to bring the auto-hide back.
  const TOP_BAR_AUTO_HIDE = false;
  if(!topBar || !TOP_BAR_AUTO_HIDE) return;

  const DOWN_HIDE_THRESHOLD = 70; // px scrolled down before the bar hides
  const UP_SHOW_THRESHOLD  = 55; // px scrolled up before the bar reappears
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

/* More-sheet row dropdowns. Moved here from hwr-js.js: every page that
   builds the sheet the shared way calls this from its rows. */
function toggleThMiniDropdown(btn) {
  var wrap = btn.closest('.th-mini-wrap');
  if (wrap) wrap.classList.toggle('open');
}
window.toggleThMiniDropdown = toggleThMiniDropdown;

/* =======================================================================
   HUB MENUS -- shared engine (Oct 2026; was coc-hub-menus.js only).
   Hovering a top-bar menu link opens a list under it; a row with children
   opens a second list beside it (Web Resources: category -> its sections).
   Each section passes its own data:
     window.stbHubMenus(hubScroll, {
       lists:  { key: [row, ...] },       // rows: { href, name, sub, icon (img
                                          //   src) or svg (inner markup), meta,
                                          //   src + kind (count from a JSON),
                                          //   soon, hot, children: [row, ...] }
       keyOf:  function (link) -> key,     // which list a top-bar link opens
       labels: { key: 'Layouts' },         // aria-label per menu
       countWords: { kind: ['layout', 'layouts'] }
     });
   Desktop with a mouse only. Hover opens after a short pause (sweeping
   across the bar doesn't flash menus) and closing waits a beat so the gap
   to the panel can be crossed. Keyboard: Down on a link opens and enters the
   list, Up/Down walk it, Right opens a row's side list, Left/Esc go back.
   Panels hang off <body> (the bar's strip scrolls sideways and would clip
   them). Styles: HUB MENUS in 11layout.css.
   ======================================================================= */
window.stbHubMenus = function (hubScroll, opts) {
  if (!hubScroll || hubScroll.dataset.menus) return;
  hubScroll.dataset.menus = '1';
  // Links get rebuilt by some sections after this runs (Minecraft re-renders
  // its editions); attach() is idempotent per link and re-runs on change.
  const desk = window.matchMedia('(min-width: 971px) and (hover: hover)');
  const CHEV = '<svg class="hub-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>';
  const SIDE = '<svg class="stb-dd-go" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const norm = u => new URL(String(u || ''), location.origin + '/').pathname.toLowerCase()
    .replace(/\.html$/, '').replace(/\/index$/, '/').replace(/(.)\/$/, '$1');
  const here = norm(location.pathname);
  const words = opts.countWords || {};

  function ico(o) {
    if (o.svg) return '<span class="stb-dd-ico is-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + o.svg + '</svg></span>';
    if (o.icon) return '<span class="stb-dd-ico"><img src="' + o.icon + '" alt="" loading="lazy" decoding="async"></span>';
    return '';
  }
  function row(o, i) {
    const on = !!o.href && o.href.indexOf('#') < 0 && norm(o.href) === here;
    const kids = !!(o.children && o.children.length);
    const tail = o.soon ? '<span class="stb-dd-tag">Soon</span>'
      : o.hot ? '<span class="stb-dd-tag stb-dd-tag--hot">Hot</span>'
      : kids ? SIDE
      : '<span class="stb-dd-meta"' + (o.src ? ' data-src="' + o.src + '" data-kind="' + o.kind + '"' : '') + '>' + (o.meta || '') + '</span>';
    return '<a class="stb-dd-row' + (on ? ' is-on' : '') + (o.soon ? ' is-soon' : '') + (kids ? ' has-kids' : '') +
      (o.svg || o.icon ? '' : ' no-ico') + '" href="' + (o.href || '#') + '"' +
      (kids ? ' data-kids="' + i + '" aria-haspopup="true"' : '') + (on ? ' aria-current="page"' : '') + '>' +
      ico(o) + '<span class="stb-dd-text"><span class="stb-dd-name">' + o.name + '</span>' +
      (o.sub ? '<span class="stb-dd-sub">' + o.sub + '</span>' : '') + '</span>' + tail + '</a>';
  }

  // One shared side panel (the second level).
  const side = document.createElement('div');
  side.className = 'stb-dd stb-dd--side';
  side.setAttribute('role', 'navigation');
  side.hidden = true;
  document.body.appendChild(side);

  const menus = {};
  let openKey = null, openT = 0, closeT = 0, sideT = 0, sideRow = null;
  const counts = {};
  const count = src => counts[src] || (counts[src] = fetch(src).then(r => (r.ok ? r.json() : null)).catch(() => null));

  function attach() {
  hubScroll.querySelectorAll('.stb-hub-link:not([data-menu])').forEach(link => {
    const key = opts.keyOf(link);
    const list = key && opts.lists[key];
    if (!list || !list.length) return;
    link.setAttribute('data-menu', key);
    link.insertAdjacentHTML('beforeend', CHEV);
    const old = document.getElementById('stbMenu-' + key);
    if (old) old.remove();
    const panel = document.createElement('div');
    panel.className = 'stb-dd stb-dd--' + key + (opts.cols && opts.cols[key] === 2 ? ' stb-dd--2col' : '');
    panel.id = 'stbMenu-' + key;
    panel.setAttribute('role', 'navigation');
    panel.setAttribute('aria-label', (opts.labels && opts.labels[key]) || link.textContent.trim());
    panel.hidden = true;
    panel.innerHTML = '<div class="stb-dd-list">' + list.map(row).join('') + '</div>';
    document.body.appendChild(panel);
    link.setAttribute('aria-controls', panel.id);
    link.setAttribute('aria-expanded', 'false');
    const m = menus[key] = { link, panel, list, filled: false };

    link.addEventListener('mouseenter', () => {
      if (!desk.matches) return;
      clearTimeout(closeT); clearTimeout(openT);
      openT = setTimeout(() => open(key), openKey ? 0 : 110); // moving between menus switches at once
    });
    link.addEventListener('mouseleave', () => { clearTimeout(openT); scheduleClose(); });
    panel.addEventListener('mouseenter', () => clearTimeout(closeT));
    panel.addEventListener('mouseleave', scheduleClose);
    panel.addEventListener('mouseover', e => {
      const r = e.target.closest('.stb-dd-row');
      if (!r || r === sideRow) return;
      clearTimeout(sideT);
      sideT = setTimeout(() => (r.dataset.kids ? showSide(m, r) : hideSide()), r.dataset.kids ? 60 : 120);
    });
    link.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' && desk.matches) {
        e.preventDefault(); open(key);
        const first = panel.querySelector('.stb-dd-row'); if (first) first.focus();
      } else if (e.key === 'Escape') close();
    });
    panel.addEventListener('keydown', e => {
      const rows = [].slice.call(panel.querySelectorAll('.stb-dd-row'));
      const i = rows.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = rows[(i + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length];
        if (next) { next.focus(); if (next.dataset.kids) showSide(m, next); else hideSide(); }
      } else if (e.key === 'ArrowRight' && document.activeElement.dataset.kids) {
        e.preventDefault(); showSide(m, document.activeElement);
        const first = side.querySelector('.stb-dd-row'); if (first) first.focus();
      } else if (e.key === 'Escape') { close(); link.focus(); }
    });
    panel.addEventListener('focusout', e => {
      if (!panel.contains(e.relatedTarget) && !side.contains(e.relatedTarget) && e.relatedTarget !== link) close();
    });
  });
  }
  attach();
  new MutationObserver(attach).observe(hubScroll, { childList: true });

  side.addEventListener('mouseenter', () => { clearTimeout(closeT); clearTimeout(sideT); });
  side.addEventListener('mouseleave', scheduleClose);
  side.addEventListener('keydown', e => {
    const rows = [].slice.call(side.querySelectorAll('.stb-dd-row'));
    const i = rows.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = rows[(i + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length];
      if (next) next.focus();
    } else if ((e.key === 'ArrowLeft' || e.key === 'Escape') && sideRow) {
      e.preventDefault(); const back = sideRow; hideSide(); back.focus();
    }
  });
  side.addEventListener('focusout', e => {
    const m = openKey && menus[openKey];
    if (m && !side.contains(e.relatedTarget) && !m.panel.contains(e.relatedTarget)) close();
  });

  function showSide(m, r) {
    const kids = m.list[+r.dataset.kids].children;
    if (sideRow) sideRow.classList.remove('is-hot');
    sideRow = r; r.classList.add('is-hot');
    side.setAttribute('aria-label', r.querySelector('.stb-dd-name').textContent);
    side.innerHTML = '<div class="stb-dd-list">' + kids.map(row).join('') + '</div>';
    side.hidden = false;
    // beside the hovered row: to the right, or to the left if it won't fit
    const pr = m.panel.getBoundingClientRect(), rr = r.getBoundingClientRect(), w = side.offsetWidth;
    const left = pr.right + 6 + w <= window.innerWidth - 8 ? pr.right + 6 : pr.left - 6 - w;
    const top = Math.min(rr.top - 6, window.innerHeight - side.offsetHeight - 8);
    side.style.left = Math.round(left) + 'px';
    side.style.top = Math.round(Math.max(8, top)) + 'px';
    side.style.maxHeight = Math.max(200, window.innerHeight - 16) + 'px';
    requestAnimationFrame(() => side.classList.add('is-open'));
  }
  function hideSide() {
    clearTimeout(sideT);
    if (sideRow) sideRow.classList.remove('is-hot');
    sideRow = null;
    side.classList.remove('is-open');
    side.hidden = true;
  }
  function scheduleClose() { clearTimeout(closeT); closeT = setTimeout(close, 180); }
  function place(m) {
    const r = m.link.getBoundingClientRect(), w = m.panel.offsetWidth;
    m.panel.style.left = Math.round(Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12)) + 'px';
    m.panel.style.top = Math.round(r.bottom + 8) + 'px';
    m.panel.style.maxHeight = Math.max(200, window.innerHeight - r.bottom - 24) + 'px';
  }
  function fill(m) {
    if (m.filled) return;
    m.filled = true;
    m.panel.querySelectorAll('.stb-dd-meta[data-src]').forEach(el => {
      count(el.getAttribute('data-src')).then(json => {
        const kind = el.getAttribute('data-kind'), list = json && json[kind];
        if (!Array.isArray(list)) return;
        const w = words[kind] || ['item', 'items'];
        el.textContent = list.length + ' ' + (list.length === 1 ? w[0] : w[1]);
      });
    });
  }
  function open(key) {
    const m = menus[key];
    if (!m) return;
    if (openKey && openKey !== key) close(true);
    fill(m);
    m.panel.hidden = false;
    place(m);
    requestAnimationFrame(() => m.panel.classList.add('is-open')); // entrance runs from its start state
    m.link.classList.add('is-open');
    m.link.setAttribute('aria-expanded', 'true');
    openKey = key;
  }
  function close(instant) {
    clearTimeout(closeT);
    hideSide();
    if (!openKey) return;
    const m = menus[openKey];
    m.panel.classList.remove('is-open');
    m.link.classList.remove('is-open');
    m.link.setAttribute('aria-expanded', 'false');
    if (instant) m.panel.hidden = true;
    else setTimeout(() => !m.panel.classList.contains('is-open') && (m.panel.hidden = true), 150);
    openKey = null;
  }
  window.addEventListener('resize', () => close(true));
  // Only the page itself scrolling closes it (the window, or .coc-main);
  // sideways strips scroll on their own after load.
  document.addEventListener('scroll', e => {
    const t = e.target;
    const page = t === document || t === document.documentElement || t === document.body || (t.classList && t.classList.contains('coc-main'));
    if (openKey && page) close(true);
  }, { capture: true, passive: true });
  if (desk.addEventListener) desk.addEventListener('change', () => close(true));
};

// ============================================================
// FEEDBACK BOX (Oct 24 2026; was the home page's own script)
// Builds the form inside every <div data-feedback> and sends it to Firestore
// "feedback" (type, message, email, rating, createdAt, page). Look: 11layout.css
// "FEEDBACK BOX". Firebase (~300 KB) loads the first time someone touches a
// form, not with the page. Spam guard: 5 sends per 10 minutes per browser.
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const mounts = document.querySelectorAll('[data-feedback]');
  if (!mounts.length) return;

  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
  // [value, tab label, message placeholder]; the first one is the default tab.
  const TYPES = [
    ['suggestion', 'Suggestion', 'Which guide, game or tool would you like to see?'],
    ['rating', 'Rate us', 'Tell us why you gave this rating (optional)'],
    ['bug', 'Report a bug', 'Describe the bug and the page you found it on']
  ];
  const ICONS = {
    error: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6"/><path d="M12 17h.01"/></svg>',
    success: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'
  };
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyAa8B5rIP0Y9w9jBN_mzKzkFW3xMdI9wgo',
    authDomain: 'parchrome-feedback.firebaseapp.com',
    projectId: 'parchrome-feedback',
    storageBucket: 'parchrome-feedback.firebasestorage.app',
    messagingSenderId: '546895020356',
    appId: '1:546895020356:web:f145067c0b71dde2341711'
  };
  const LIMIT = 5;
  const WINDOW_MS = 10 * 60 * 1000;
  const LOG_KEY = 'parchrome_feedback_log';

  let fbLoad = null;
  function loadScript(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = fail;
      document.head.appendChild(s);
    });
  }
  function firebaseReady() {
    if (!fbLoad) {
      const base = 'https://www.gstatic.com/firebasejs/10.13.0/';
      fbLoad = (window.firebase && firebase.firestore
        ? Promise.resolve()
        : loadScript(base + 'firebase-app-compat.js').then(() => loadScript(base + 'firebase-firestore-compat.js'))
      ).catch(e => { fbLoad = null; throw e; }); // a failed load is retried on the next send
    }
    return fbLoad;
  }

  let modal = null;
  function showModal(text, type) {
    if (!modal) {
      modal = document.createElement('dialog');
      modal.className = 'fb-modal';
      modal.innerHTML = '<div class="fb-modal-icon"></div><p></p><form method="dialog"><button class="fb-ok">OK</button></form>';
      modal.addEventListener('click', e => { if (e.target === modal) modal.close(); }); // the backdrop closes it
      document.body.appendChild(modal);
    }
    const icon = modal.querySelector('.fb-modal-icon');
    icon.innerHTML = ICONS[type === 'success' ? 'success' : 'error'];
    icon.classList.toggle('is-success', type === 'success');
    modal.querySelector('p').textContent = text;
    if (modal.showModal) modal.showModal(); else alert(text);
  }

  function sentLog() {
    try {
      const cutoff = Date.now() - WINDOW_MS;
      return (JSON.parse(localStorage.getItem(LOG_KEY)) || []).filter(t => t > cutoff);
    } catch (e) { return []; }
  }
  function recordSend() {
    try { localStorage.setItem(LOG_KEY, JSON.stringify(sentLog().concat(Date.now()))); } catch (e) {}
  }
  function wait(ms) {
    const s = Math.ceil(ms / 1000);
    return s >= 60 ? Math.floor(s / 60) + 'm ' + (s % 60) + 's' : s + 's';
  }

  mounts.forEach((mount, n) => {
    const id = 'fb' + n; // keeps names/ids unique if a page has two boxes
    mount.innerHTML =
      '<form class="fb" novalidate>' +
        '<fieldset class="fb-seg"><legend class="sr-only">Feedback type</legend>' +
          TYPES.map((t, i) => '<label><input type="radio" name="' + id + 'Type" value="' + t[0] + '"' + (i ? '' : ' checked') + '><span>' + t[1] + '</span></label>').join('') +
        '</fieldset>' +
        '<fieldset class="fb-stars" hidden><legend class="sr-only">Your rating</legend>' +
          [1, 2, 3, 4, 5].map(v => '<label><input type="radio" name="' + id + 'Rating" value="' + v + '" aria-label="' + v + ' star' + (v > 1 ? 's' : '') + '">' + STAR + '</label>').join('') +
        '</fieldset>' +
        '<label class="sr-only" for="' + id + 'Msg">Message</label>' +
        '<textarea class="fb-field" id="' + id + 'Msg" placeholder="' + TYPES[0][2] + '"></textarea>' +
        '<div class="fb-row">' +
          '<label class="sr-only" for="' + id + 'Who">Email or in-game name</label>' +
          '<input class="fb-field" id="' + id + 'Who" type="text" placeholder="Email or in-game name (required)" autocomplete="email">' +
          '<button class="fb-send" type="submit">Send</button>' +
        '</div>' +
      '</form>';

    const form = mount.querySelector('form');
    const stars = form.querySelector('.fb-stars');
    const message = form.querySelector('textarea');
    const email = form.querySelector('input[type="text"]');
    const submit = form.querySelector('.fb-send');
    let type = TYPES[0][0];
    let rating = 0;

    function paint() {
      stars.hidden = type !== 'rating';
      message.placeholder = TYPES.find(t => t[0] === type)[2];
      stars.querySelectorAll('label').forEach((l, i) => l.classList.toggle('is-on', i < rating));
    }
    form.addEventListener('focusin', () => firebaseReady().catch(() => {}), { once: true });
    form.addEventListener('change', e => {
      if (e.target.name === id + 'Type') type = e.target.value;
      if (e.target.name === id + 'Rating') rating = Number(e.target.value);
      paint();
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const text = message.value.trim();
      const who = email.value.trim();
      if (type === 'rating' && !rating) return showModal('Pick a star rating before sending.');
      if (type !== 'rating' && !text) return showModal('Write a message before sending.');
      if (!who) { showModal('Add your email or in-game name before sending.'); email.focus(); return; }
      const log = sentLog();
      if (log.length >= LIMIT) {
        return showModal('You have sent ' + LIMIT + ' messages in the last 10 minutes. Wait ' + wait(Math.min(...log) + WINDOW_MS - Date.now()) + ' before sending another.');
      }
      submit.disabled = true;
      submit.textContent = 'Sending...';
      firebaseReady().then(() => {
        if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        return firebase.firestore().collection('feedback').add({
          type: type,
          message: text,
          email: who,
          rating: type === 'rating' ? rating : null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          page: location.pathname
        });
      }).then(() => {
        recordSend();
        showModal('Thanks. Your feedback was sent.', 'success');
        form.reset();
        type = TYPES[0][0];
        rating = 0;
        paint();
      }).catch(err => {
        console.error('Feedback submit error:', err);
        showModal('Your feedback could not be sent. Check your connection and try again.');
      }).finally(() => {
        submit.disabled = false;
        submit.textContent = 'Send';
      });
    });
  });
});
