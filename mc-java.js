/* ============================================================
   mc-java.js -- the Minecraft section's behaviour
   ============================================================
   Split out of the seven mc-java-*.html pages' inline <script> blocks.

   The pages shared far more than they differed: an identical opening run of
   six statements (normalizer, sidebar, secondary top bar, help popup, page
   load, search) and an identical closing run (more-menu, bottom nav, active-nav
   highlighting, nav render). Those are emitted once, first and last, so every
   page keeps the head -> middle -> tail order it had inline.

   Anything in between belongs to one page, or to a couple of pages that share a
   feature. Those statements are wrapped in mcOn(...) guards, because they touch
   elements that only exist on their own page. Function and variable
   declarations are never guarded -- the markup's inline onclick="" handlers
   resolve against the global scope, so they have to stay there.
   ============================================================ */

/* Which Minecraft page is this? Set from the body class the pages carry
   (mc-home, mc-worlds, ...), which is also what mc-java.css keys its
   page-specific overrides off. */
var MC_PAGE = (function () {
  var m = document.body.className.match(/\bmc-(home|worlds|seeds|rp|mods|shaders|commands)\b/);
  return m ? m[1] : '';
})();

/* mcOn('worlds', 'rp') -- true when this page is one of the named ones. */
function mcOn() {
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] === MC_PAGE) return true;
  }
  return false;
}


/* ===== SHARED: opening run (all seven pages) ===== */

// ── NORMALIZER ──

// ── SIDEBAR ──

document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.triple-a-header');
  const list = document.getElementById('triple-a-list');
  header.classList.add('open');
  list.style.display = 'flex';
});

// ── SECONDARY TOP BAR ──
document.querySelector('.secondary-top-bar').addEventListener('click', () => {
  document.querySelector('.coc-main').scrollTo({ top: 0, behavior: 'smooth' });
});

// ── HELP POPUP ──


// ── PAGE LOAD ──
window.addEventListener("load", () => { document.documentElement.classList.add("loaded"); });

// ── SEARCH ──

fetch('herosearch.json')
  .then(res => res.json())
  .then(data => {
    topSearchItems = data;
    topSearchIsLoaded = true;
  })
  .catch(err => console.error('Top-bar search data failed to load:', err));

// Renders a single result as an fg-card — same box design used by
// Popular Topics / home.html's hero search results.

// Main search function — called on every keystroke and when the
// overlay first opens (with an empty query, showing a random sample).

// `fromPopstate` is true when triggered by the back button/gesture itself —
// in that case the browser is already consuming the history entry, so we
// must NOT call history.back() again (that would navigate off the page).

window.addEventListener('popstate', () => {
  if (searchoverlay && searchoverlay.style.display === 'block') {
    closeSearch(true);
  }
});

document.addEventListener('DOMContentLoaded', function () {
  searchoverlay = document.getElementById('search-overlay');
  resultsContainer = document.getElementById('search-results');
  searchinput = document.getElementById('search-input');
  searchIcon = document.getElementById('search-icon');
  topSearchViewMoreBtn = document.getElementById('search-view-more');
  searchInputClearBtn = document.getElementById('search-input-clear');

  searchinput.addEventListener('input', searchItems);
  searchoverlay.addEventListener('click', e => { if (e.target === searchoverlay) closeSearch(); });
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

  searchInputClearBtn.addEventListener('click', () => {
    searchinput.value = '';
    searchItems();
    searchinput.focus();
  });
});

/* ===== PAGE FEATURES ===== */

/* ── HERO TAGLINE: at most two lines on phones ──
   The taglines run from ~70 to ~135 characters depending on the page, so a
   single clamp() can't hold all of them to two lines -- a size that fits
   Worlds leaves Commands tiny. This starts at the CSS size and steps down
   only as far as each page actually needs, then stops.

   Desktop is untouched: the inline size is cleared above 970px so the
   stylesheet stays in charge there. */
(function mcFitHeroTagline() {
  var el = document.querySelector('.hero-section.hero-v2 .hero-tagline');
  if (!el) return;

  var MAX_LINES = 2;
  var START = 13;    // matches the mobile rule in mc-java.css
  var FLOOR = 9.5;   // below this it stops being readable; clip instead
  var STEP = 0.25;

  function fit() {
    if (window.innerWidth > 970) { el.style.fontSize = ''; el.style.maxHeight = ''; return; }
    var size = START;
    el.style.maxHeight = '';
    el.style.fontSize = size + 'px';
    while (size > FLOOR) {
      var lh = parseFloat(getComputedStyle(el).lineHeight);
      if (!lh) break;                                   // no usable metric, leave it
      if (el.scrollHeight <= lh * MAX_LINES + 1) break; // fits
      size -= STEP;
      el.style.fontSize = size + 'px';
    }
    // Hard guarantee: even at the floor, never render more than two lines.
    var lh2 = parseFloat(getComputedStyle(el).lineHeight);
    if (lh2) el.style.maxHeight = (lh2 * MAX_LINES) + 'px';
    el.style.overflow = 'hidden';
  }

  fit();
  // Web fonts change the metrics after first paint, so measure again once
  // they land -- otherwise the fit is computed against the fallback face.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  var t;
  window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(fit, 120); });
  window.addEventListener('orientationchange', function () { setTimeout(fit, 160); });
})();

if (mcOn('home')) {
  // ── TOP SERVERS (live player counts via mcsrvstat.us) ──
  (function () {
    const row = document.getElementById('server-row');
    if (!row) return;

    // Curated list of well-known Java servers. Their ranking on the page is
    // driven by real live player counts fetched below, not a fixed order.
    const SERVERS = [
      { name: 'Hypixel',       ip: 'mc.hypixel.net',        link: 'https://hypixel.net/',            tag: 'Minigames' },
      { name: 'Wynncraft',     ip: 'play.wynncraft.com',    link: 'https://wynncraft.com/',           tag: 'MMORPG' },
      { name: 'CubeCraft',     ip: 'play.cubecraft.net',    link: 'https://cubecraft.net/',           tag: 'Minigames' },
      { name: 'Mineplex',      ip: 'us.mineplex.com',       link: 'https://www.mineplex.com/',        tag: 'Minigames' },
      { name: 'PurplePrison',  ip: 'play.purpleprison.net', link: 'https://purpleprison.net/',        tag: 'Prison' },
      { name: 'ManaCube',      ip: 'play.manacube.com',     link: 'https://manacube.com/',            tag: 'Survival' }
    ];

    function iconUrl(ip) {
      return `https://api.mcsrvstat.us/icon/${encodeURIComponent(ip)}`;
    }

    async function fetchStatus(server) {
      try {
        const res = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(server.ip)}`, {
          headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error('bad response');
        const data = await res.json();
        return {
          ...server,
          online: !!data.online,
          players: data.online && data.players ? data.players.online : 0,
          maxPlayers: data.online && data.players ? data.players.max : null,
          version: data.version || null
        };
      } catch (e) {
        return { ...server, online: false, players: 0, maxPlayers: null, version: null, error: true };
      }
    }

    function renderCard(server, rank) {
      const a = document.createElement('a');
      a.className = 'server-card';
      a.href = server.link;
      a.target = '_blank';
      a.rel = 'noopener';

      const rankBadge = `<span class="cf-card-rank ${rank <= 3 ? 'top3' : ''}">#${rank}</span>`;
      const dotClass = server.online ? 'online' : 'offline';
      const playersText = server.online
        ? `${server.players.toLocaleString()}${server.maxPlayers ? ' / ' + server.maxPlayers.toLocaleString() : ''} online`
        : 'Offline';

      a.innerHTML = `
        ${rankBadge}
        <div class="server-card-img-wrap">
          <span class="server-status-dot ${dotClass}"></span>
          <img class="server-card-img" src="${iconUrl(server.ip)}" alt="" loading="lazy" onerror="this.style.opacity=0">
        </div>
        <div class="server-card-body">
          <div class="server-card-name">${server.name}</div>
          <div class="server-card-ip">${server.ip}</div>
          <div class="server-card-meta ${server.online ? '' : 'offline'}">
            <span class="live-dot"></span><span>${playersText}</span>
          </div>
        </div>
      `;
      return a;
    }

    async function init() {
      const results = await Promise.all(SERVERS.map(fetchStatus));

      // Rank by live online player count, highest first. Offline servers sink to the bottom.
      results.sort((a, b) => (b.online ? b.players : -1) - (a.online ? a.players : -1));

      row.innerHTML = '';

      if (results.every(r => r.error)) {
        row.innerHTML = `<div class="server-card-error">Couldn't reach live server stats right now — try refreshing.</div>`;
        return;
      }

      results.forEach((server, i) => row.appendChild(renderCard(server, i + 1)));
    }

    init();
  })();
}

if (mcOn('home')) {
  // ── PLAYER SKIN LOOKUP (playerdb.co for UUID lookup, Crafatar for renders) ──
  (function () {
    const form = document.getElementById('skin-search-form');
    const input = document.getElementById('skin-search-input');
    const result = document.getElementById('skin-result');
    const clearBtn = document.getElementById('skin-clear-btn');
    if (!form || !input || !result) return;

    function updateClearBtn() {
      if (!clearBtn) return;
      const hasResult = result.classList.contains('visible');
      clearBtn.classList.toggle('visible', input.value.length > 0 || hasResult);
    }

    function resetAll() {
      input.value = '';
      result.innerHTML = '';
      result.classList.remove('visible');
      updateClearBtn();
      input.focus();
    }

    input.addEventListener('input', updateClearBtn);
    updateClearBtn();

    if (clearBtn) {
      clearBtn.addEventListener('click', resetAll);
    }

    function show(html) {
      result.innerHTML = html;
      result.classList.add('visible');
      updateClearBtn();
    }

    async function lookup(username) {
      show(`<div class="skin-result-loading"><div class="server-spinner"></div><span>Looking up ${username}…</span></div>`);

      try {
        const res = await fetch(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(username)}`);
        const data = await res.json();

        if (!data.success || !data.data || !data.data.player) {
          show(`<div class="skin-result-error">Couldn't find a player named "${username}".</div>`);
          return;
        }

        const player = data.data.player;
        const rawUuid = (player.id || '').replace(/-/g, '');

        if (!rawUuid) {
          show(`<div class="skin-result-error">Couldn't find a player named "${username}".</div>`);
          return;
        }

        // Format as dashed UUID: 8-4-4-4-12
        const dashedUuid = rawUuid.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');

        const faceUrl = `https://mc-heads.net/avatar/${rawUuid}/72`;
        const bodyFrontUrl = `https://mc-heads.net/body/${rawUuid}/128`;
        const skinDownloadUrl = `https://mc-heads.net/skin/${rawUuid}`;
        const capeUrl = `https://crafatar.com/capes/${rawUuid}`;

        show(`
          <div class="skin-result-card">
            <div class="skin-result-top">
              <div class="skin-result-renders">
                <div class="skin-result-render-wrap">
                  <img class="skin-result-render" src="${bodyFrontUrl}" alt="${player.username}'s skin front" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                  <div class="skin-result-render-error" style="display:none">No render</div>
                  <span class="skin-result-render-label">Front</span>
                </div>
                <div class="skin-result-cape-wrap" id="skin-cape-wrap">
                  <img class="skin-result-cape" id="skin-cape-img" src="${capeUrl}" alt="${player.username}'s cape">
                  <span class="skin-result-render-label">Cape</span>
                </div>
              </div>
              <div class="skin-result-divider"></div>
              <div class="skin-result-info">
                <div class="skin-result-heading">
                  <img class="skin-result-face" src="${faceUrl}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
                  <div>
                    <div class="skin-result-name">${player.username}</div>
                    <div class="skin-result-badge-row">
                      <span class="skin-result-badge"><span class="skin-result-badge-dot"></span>Java Edition</span>
                    </div>
                  </div>
                </div>
                <div class="skin-result-meta">
                  <span class="skin-result-label">Account UUID</span>
                  <div class="skin-result-uuid-row">
                    <span class="skin-result-uuid" id="skin-uuid-text">${dashedUuid}</span>
                    <button type="button" class="skin-result-copy-btn" data-uuid="${dashedUuid}">Copy</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="skin-result-divider"></div>
            <div class="skin-result-bottom">
              <div class="skin-result-facts">
                <div class="skin-result-fact">
                  <span class="skin-result-label">Username length</span>
                  <span class="skin-result-fact-value">${player.username.length} characters</span>
                </div>
                <div class="skin-result-fact">
                  <span class="skin-result-label">Profile source</span>
                  <span class="skin-result-fact-value">Mojang, via PlayerDB</span>
                </div>
              </div>
              <div class="skin-result-divider"></div>
              <div class="skin-result-links">
                <a href="${skinDownloadUrl}" target="_blank" rel="noopener" download>Download skin</a>
                <a href="${faceUrl}" target="_blank" rel="noopener" download>Download face</a>
                <a href="https://namemc.com/profile/${player.username}" target="_blank" rel="noopener">View on NameMC</a>
              </div>
            </div>
          </div>
        `);

        // Reveal cape only if it actually loads (most players don't have one)
        const capeImg = document.getElementById('skin-cape-img');
        const capeWrap = document.getElementById('skin-cape-wrap');
        if (capeImg && capeWrap) {
          capeImg.addEventListener('load', () => capeWrap.classList.add('has-cape'));
          capeImg.addEventListener('error', () => { capeWrap.style.display = 'none'; });
        }

        // Copy UUID button
        const copyBtn = result.querySelector('.skin-result-copy-btn');
        if (copyBtn) {
          copyBtn.addEventListener('click', () => {
            const text = copyBtn.getAttribute('data-uuid');
            navigator.clipboard?.writeText(text).then(() => {
              const original = copyBtn.textContent;
              copyBtn.textContent = 'Copied!';
              setTimeout(() => { copyBtn.textContent = original; }, 1400);
            });
          });
        }
      } catch (e) {
        show(`<div class="skin-result-error">Something went wrong looking that up — try again in a moment.</div>`);
      }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = input.value.trim();
      if (!username) return;
      lookup(username);
    });
  })();
}

// Runs on all seven pages now, not just Discover: every mc-java-* page is a
// Java Edition page, so the live release/snapshot applies to each of them, and
// they all carry the hero's version pills since the hero-v2 rollout. The IIFE
// already bails out on its own if the pills are not in the markup.
{
  // ── HERO VERSION STRIP (official Mojang piston-meta) ──
  (function () {
    const relVersionEl = document.getElementById('hvs-release-version');
    const relUpdatedEl = document.getElementById('hvs-release-updated');
    const snapVersionEl = document.getElementById('hvs-snapshot-version');
    const snapUpdatedEl = document.getElementById('hvs-snapshot-updated');
    if (!relVersionEl) return;

    function timeAgo(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d)) return '';
      const days = Math.floor((Date.now() - d.getTime()) / 86400000);
      if (days <= 0) return 'today';
      if (days === 1) return '1 day ago';
      return days + ' days ago';
    }

    // Compact form for phones -- the same wording the sidebar's version row
    // already uses (see mcInitSidebarVersion), so the two agree on screen.
    function timeAgoShort(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d)) return '';
      const days = Math.floor((Date.now() - d.getTime()) / 86400000);
      if (days <= 0) return 'today';
      if (days === 1) return '1d';
      return days + 'd';
    }

    // Both forms are rendered and CSS shows one. Choosing in JS would need a
    // resize listener to stay correct when the phone rotates, and the strings
    // are short enough that shipping both costs nothing. The values are built
    // here from a number and fixed words, so there is nothing to escape.
    function updatedMarkup(iso) {
      const long = timeAgo(iso);
      if (!long) return '';
      return '<span class="hlu-long">updated ' + long + '</span>' +
             '<span class="hlu-short">' + timeAgoShort(iso) + '</span>';
    }

    fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')
      .then(r => r.json())
      .then(data => {
        const releaseId = data.latest.release;
        const snapshotId = data.latest.snapshot;
        const releaseEntry = data.versions.find(v => v.id === releaseId);
        const snapshotEntry = data.versions.find(v => v.id === snapshotId);

        relVersionEl.textContent = releaseId;
        relUpdatedEl.innerHTML = releaseEntry ? updatedMarkup(releaseEntry.releaseTime) : '';
        snapVersionEl.textContent = snapshotId;
        snapUpdatedEl.innerHTML = snapshotEntry ? updatedMarkup(snapshotEntry.releaseTime) : '';
      })
      .catch(() => {
        relVersionEl.textContent = 'N/A';
        relUpdatedEl.textContent = '';
        snapVersionEl.textContent = 'N/A';
        snapUpdatedEl.textContent = '';
      });
  })();
}

// ── NEWS FEED (Mojang launcher news) ──
// This used to be half of the Minecraft Version Tracker section on
// Discover. That section is gone: the release/snapshot numbers it showed
// are already in the sidebar's own version rows, and the patch-note feed
// now lives here -- newest entry in the sidebar card, the full list in a
// modal behind "View more".
//
// It runs on every MC page rather than just Discover, so it guards on its
// own elements and no-ops where they are absent.
(function mcInitVersionFeed() {
  // Deferred to DOMContentLoaded: this script tag sits above #vtModal in the
  // markup, so querying the modal list at parse time returned null and only
  // the sidebar card ever filled in.
  function start() {
  var sbEl = document.getElementById('vt-sb-latest');
  var listEl = document.getElementById('vt-modal-list');
  if (!sbEl && !listEl) return;

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }
  function stripHtml(html) {
    var t = document.createElement('div');
    t.innerHTML = html || '';
    return (t.textContent || t.innerText || '').trim();
  }

  // One row template for both places -- the sidebar narrows it with
  // .vt-sb-latest in the stylesheet rather than a second markup shape.
  // The patch-notes feed carries no date of its own -- an entry is only
  // {body, contentPath, id, image, title, type, version}. The version
  // manifest does carry releaseTime, so each entry's `version` is looked up
  // there. That resolves for every entry currently in the feed. The manifest
  // request is allowed to fail on its own: rows then render dateless rather
  // than not at all.
  var VT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                   'Jul','Aug','Sep','Oct','Nov','Dec'];

  // v2/news.json entries carry their own `date` ("2026-09-05"), so unlike the
  // old patch-notes feed there is no second request to the version manifest
  // purely to discover when an entry happened.
  function logDate(iso) {
    if (!iso) return '';
    var then = new Date(iso);
    if (isNaN(then.getTime())) return '';
    var days = Math.floor((Date.now() - then.getTime()) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return days + ' days ago';
    return then.getDate() + ' ' + VT_MONTHS[then.getMonth()] +
           ' ' + then.getFullYear();
  }

  // Everything below comes from Mojang's feed, so it is treated as untrusted
  // input. escapeHtml() escapes & < > but not quotes, and these values land
  // inside href/src attributes -- so quotes and whitespace are stripped and
  // only http(s) is allowed through. Without this a crafted URL could close
  // the attribute, or a javascript: href could execute.
  function safeUrl(url, fallback) {
    var raw = String(url || '').replace(/["'\s<>]/g, '');
    return /^https?:\/\//i.test(raw) ? raw : fallback;
  }

  // This is the launcher's feed: roughly 78% of it is Bedrock, Dungeons and
  // Marketplace posts. These are Java Edition pages, so anything not tagged
  // Java is dropped rather than shown to a Java reader.
  function isJava(entry) {
    var types = entry.newsType || [];
    return types.indexOf('Java') !== -1 ||
           entry.category === 'Minecraft: Java Edition';
  }

  function rowHtml(entry, short) {
    var image = entry.newsPageImage || entry.playPageImage || null;
    var img = image && image.url
      ? safeUrl('https://launchercontent.mojang.com' + image.url, '') : '';
    var when = logDate(entry.date);
    // The old badge was the patch type ("release"/"snapshot"). News entries
    // have no type, so it distinguishes a Java Edition post from the general
    // news the Java tag also pulls in.
    var label = entry.category === 'Minecraft: Java Edition' ? 'Java' : 'News';
    var href = safeUrl(entry.readMoreLink,
                       'https://www.minecraft.net/en-us/updates');
    var open = '<a class="vt-log-row" href="' + escapeHtml(href) +
      '" target="_blank" rel="noopener noreferrer">';
    var thumb = '<div class="vt-log-thumb">' +
      (img ? '<img src="' + escapeHtml(img) + '" alt="" loading="lazy" decoding="async">' : '') +
      '</div>';
    var top = '<div class="vt-log-top">' +
      '<span class="vt-log-badge">' + escapeHtml(label) + '</span>' +
      (when ? '<span class="vt-log-date">' + escapeHtml(when) + '</span>' : '') +
      '</div>';

    // The sidebar card is a ~200px text column, so it carries the badge, the
    // date and the headline only. The blurb lives in the modal, one click away.
    if (short) {
      return open + thumb +
        '<div class="vt-log-body">' + top +
          '<div class="vt-log-headline">' + escapeHtml(entry.title || '') + '</div>' +
        '</div>' +
      '</a>';
    }

    var body = stripHtml(entry.text);
    var desc = body.length > 220 ? body.slice(0, 220) + '\u2026' : body;
    return open + thumb +
      '<div class="vt-log-body">' + top +
        '<div class="vt-log-title">' + escapeHtml(entry.title || '') + '</div>' +
        '<div class="vt-log-desc">' + escapeHtml(desc) + '</div>' +
      '</div>' +
      '<svg class="vt-log-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>' +
    '</a>';
  }

  fetch('https://launchercontent.mojang.com/v2/news.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var entries = (data.entries || []).filter(isJava).slice(0, 12);
      if (!entries.length) throw new Error('no entries');
      // Two newest in the sidebar; the rest are behind "View more".
      if (sbEl) sbEl.innerHTML = entries.slice(0, 2)
        .map(function (e) { return rowHtml(e, true); }).join('');
      if (listEl) listEl.innerHTML = entries
        .map(function (e) { return rowHtml(e, false); }).join('');
    })
    .catch(function () {
      var fallback = '<a class="vt-log-row" href="https://www.minecraft.net/en-us/news" target="_blank" rel="noopener noreferrer">' +
        '<div class="vt-log-body">' +
        '<div class="vt-log-title">Read the latest on minecraft.net</div>' +
        '<div class="vt-log-desc">Official news and update announcements are published there.</div>' +
        '</div></a>';
      if (sbEl) sbEl.innerHTML = fallback;
      if (listEl) listEl.innerHTML = fallback;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

// ── VERSION FEED MODAL ──
// Reuses bnLockScroll/bnUnlockScroll (the More sheet's scroll lock) and
// pushModalState, so the phone's back gesture closes it the same way it
// closes every other modal here instead of leaving the page.
function openVtFeed() {
  var m = document.getElementById('vtModal');
  if (!m) return;
  m.classList.add('open');
  bnLockScroll();
  document.addEventListener('keydown', vtEscHandler);
  pushModalState();
}
function closeVtFeed() {
  var m = document.getElementById('vtModal');
  if (!m || !m.classList.contains('open')) return;
  m.classList.remove('open');
  bnUnlockScroll();
  document.removeEventListener('keydown', vtEscHandler);
}
function closeVtFeedOutside(e) {
  if (e.target === document.getElementById('vtModal')) closeVtFeed();
}
function vtEscHandler(e) { if (e.key === 'Escape') closeVtFeed(); }
// Its own listener rather than joining the per-page pop handlers, which
// reference elements that only exist on their own page.
window.addEventListener('popstate', function () {
  var m = document.getElementById('vtModal');
  if (m && m.classList.contains('open')) closeVtFeed();
});

// ── SCROLL ROWS ──
function scrollRow(id, dir) {
  const row = document.getElementById(id);
  row.scrollBy({ left: dir * 300, behavior: 'smooth' });
}
document.querySelectorAll('.cf-row').forEach(row => {
  row.addEventListener('scroll', () => updateArrows(row.id));
  updateArrows(row.id);
});

function updateArrows(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const section = row.closest('.cf-section');
  if (!section) return;
  const leftBtn = section.querySelector('.cf-arrow:first-of-type');
  const rightBtn = section.querySelector('.cf-arrow:last-of-type');
  const atStart = row.scrollLeft <= 4;
  const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
  if (leftBtn) leftBtn.disabled = atStart;
  if (rightBtn) rightBtn.disabled = atEnd;
  // Same measurement drives the edge fade, so the two can never disagree.
  if (typeof mcUpdateRowFade === 'function') mcUpdateRowFade(row);
}

// ── COMMAND MODAL ──
let currentCmd = '', cmdFeedbackTimeout;

function openCmd(el) {
  document.getElementById('cmdModalTitle').textContent = el.dataset.name;
  document.getElementById('cmdModalSub').textContent = el.dataset.sub;
  document.getElementById('cmdModalCode').textContent = el.dataset.cmd;
  currentCmd = el.dataset.cmd;
  document.getElementById('cmdFeedback').textContent = '';
  document.getElementById('cmdModal').classList.add('open');
  pushModalState();
}

function closeCmd() { document.getElementById('cmdModal').classList.remove('open'); }

function closeCmdOutside(e) { if (e.target === document.getElementById('cmdModal')) closeCmd(); }

function copyCmd() {
  const fallback = () => {
    const el = document.createElement('textarea');
    el.value = currentCmd; el.style.position = 'fixed'; el.style.opacity = '0';
    document.body.appendChild(el); el.focus(); el.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(el); showCmdFeedback();
  };
  if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(currentCmd).then(showCmdFeedback).catch(fallback); }
  else { fallback(); }
}

function showCmdFeedback() {
  const fb = document.getElementById('cmdFeedback');
  fb.textContent = '✓ Copied to clipboard!';
  clearTimeout(cmdFeedbackTimeout);
  cmdFeedbackTimeout = setTimeout(() => fb.textContent = '', 2500);
}

// ── GALLERY LIGHTBOX (banners) ──
let lbScale = 1, lbX = 0, lbY = 0;

let pinchStartDist = 0, pinchStartScale = 1;

let isDragging = false, dragStartX = 0, dragStartY = 0, dragOriginX = 0, dragOriginY = 0;

let galCurrentCmd = '', galFeedbackTimeout;

function openLightbox(el) {
  const src = el.dataset.full || el.querySelector('img').src;
  const img = document.getElementById('gal-lb-img');
  img.src = src;
  lbScale = 1; lbX = 0; lbY = 0;
  applyGalTransform();
  document.getElementById('gal-lightbox').classList.add('open');
  pushModalState();
  document.getElementById('gal-lb-fixed-close').style.display = 'flex';
  galCurrentCmd = el.dataset.cmd || '';
  document.getElementById('gal-lb-name').textContent = el.dataset.name || '';
  document.getElementById('gal-lb-code').textContent = el.dataset.cmd || '';
  document.getElementById('gal-lb-feedback').textContent = '';
  document.getElementById('gal-lb-copybox').style.display = galCurrentCmd ? 'flex' : 'none';
  document.addEventListener('keydown', lbEscHandler);
}

function closeLightbox() {
  const lb = document.getElementById('gal-lightbox');
  if (!lb.classList.contains('open')) return;
  lb.classList.remove('open');
  document.getElementById('gal-lb-fixed-close').style.display = 'none';
  document.removeEventListener('keydown', lbEscHandler);
  if (history.state?.modal) history.back();
}

function lbEscHandler(e) { if (e.key === 'Escape') closeLightbox(); }

// ── BACK BUTTON CLOSES MODALS ──
function pushModalState() {
  history.pushState({ modal: true }, '');
}

function mcHomePopModalHandler() {
  // Called by browser back — just close whichever is open, no history.back()
  const galLb = document.getElementById('gal-lightbox');
  const palLb = document.getElementById('pal-lightbox');
  const cmd   = document.getElementById('cmdModal');

  if (galLb.classList.contains('open')) {
    galLb.classList.remove('open');
    document.getElementById('gal-lb-fixed-close').style.display = 'none';
    document.removeEventListener('keydown', lbEscHandler);
  } else if (palLb.classList.contains('open')) {
    palLb.classList.remove('open');
    document.getElementById('pal-lb-fixed-close').style.display = 'none';
    palScale = 1; palPanX = 0; palPanY = 0; palIsPanning = false;
    window.onmousemove = null; window.onmouseup = null;
    document.removeEventListener('keydown', palEscHandler);
  } else if (cmd.classList.contains('open')) {
    cmd.classList.remove('open');
  }
}

if (mcOn('home')) window.addEventListener('popstate', mcHomePopModalHandler);

function applyGalTransform() {
  document.getElementById('gal-lb-img').style.transform = `translate(${lbX}px, ${lbY}px) scale(${lbScale})`;
}

function galCopyCmd() {
  const fallback = () => {
    const el = document.createElement('textarea');
    el.value = galCurrentCmd; el.style.position = 'fixed'; el.style.opacity = '0';
    document.body.appendChild(el); el.focus(); el.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(el); showGalFeedback();
  };
  if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(galCurrentCmd).then(showGalFeedback).catch(fallback); }
  else { fallback(); }
}

function showGalFeedback() {
  const fb = document.getElementById('gal-lb-feedback');
  fb.textContent = '✓ Copied!';
  clearTimeout(galFeedbackTimeout);
  galFeedbackTimeout = setTimeout(() => fb.textContent = '', 2500);
}

const lbImg = document.getElementById('gal-lb-img');

if (mcOn('home', 'worlds')) {
  lbImg.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      pinchStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinchStartScale = lbScale;
    } else if (e.touches.length === 1 && lbScale > 1) {
      isDragging = true;
      dragStartX = e.touches[0].clientX; dragStartY = e.touches[0].clientY;
      dragOriginX = lbX; dragOriginY = lbY;
    }
  }, { passive: false });
}

if (mcOn('home', 'worlds')) {
  lbImg.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      lbScale = Math.min(Math.max(pinchStartScale * (dist / pinchStartDist), 1), 5);
      applyGalTransform();
    } else if (e.touches.length === 1 && isDragging) {
      e.preventDefault();
      lbX = dragOriginX + (e.touches[0].clientX - dragStartX);
      lbY = dragOriginY + (e.touches[0].clientY - dragStartY);
      applyGalTransform();
    }
  }, { passive: false });
}

if (mcOn('home', 'worlds')) {
  lbImg.addEventListener('touchend', e => {
    if (e.touches.length < 2) isDragging = false;
    if (lbScale <= 1) { lbScale = 1; lbX = 0; lbY = 0; applyGalTransform(); }
  });
}

let lastTap = 0;

if (mcOn('home', 'worlds')) {
  lbImg.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTap < 280) { lbScale = 1; lbX = 0; lbY = 0; applyGalTransform(); }
    lastTap = now;
  });
}

if (mcOn('home', 'worlds')) {
  lbImg.addEventListener('click', e => e.stopPropagation());
}

// ── PALETTE LIGHTBOX ──
let palScale = 1, palStartDist = 0, palLastScale = 1;

let palIsPanning = false, palPanStartX = 0, palPanStartY = 0, palPanX = 0, palPanY = 0;

function getPalClampLimits() {
  const img = document.getElementById('pal-lb-img');
  const scaledW = img.offsetWidth * palScale;
  const scaledH = img.offsetHeight * palScale;
  return {
    maxX: Math.max(0, (scaledW - window.innerWidth) / 2),
    maxY: Math.max(0, (scaledH - window.innerHeight) / 2)
  };
}

function clampPalPan() {
  if (palScale <= 1) { palPanX = 0; palPanY = 0; return; }
  const { maxX, maxY } = getPalClampLimits();
  palPanX = Math.min(maxX, Math.max(-maxX, palPanX));
  palPanY = Math.min(maxY, Math.max(-maxY, palPanY));
}

function applyPalTransform() {
  document.getElementById('pal-lb-img').style.transform = `translate(${palPanX}px, ${palPanY}px) scale(${palScale})`;
}

function palEscHandler(e) { if (e.key === 'Escape') closePalette(); }

function mcHomeClosePalette() {
  const lb = document.getElementById('pal-lightbox');
  if (!lb.classList.contains('open')) return;
  lb.classList.remove('open');
  document.getElementById('pal-lb-fixed-close').style.display = 'none';
  palScale = 1; palPanX = 0; palPanY = 0; palIsPanning = false;
  window.onmousemove = null; window.onmouseup = null;
  document.removeEventListener('keydown', palEscHandler);
  if (history.state?.modal) history.back();
}

function mcHomeOpenPalette(el) {
  const lb  = document.getElementById('pal-lightbox');
  const img = document.getElementById('pal-lb-img');

  // Gather the rest of the grid so prev/next has something to move through.
  // Scoped to the clicked card's own .pal-grid, not the whole page: the three
  // grids here are Palettes, Armour colours and Guides, and sliding from a
  // colour wheel into a food-web chart would read as a bug.
  const grid = el.closest('.pal-grid');
  const cards = grid ? Array.from(grid.querySelectorAll('.pal-card')) : [el];
  palCurrentSlides = cards.map(function (c) {
    const i = c.querySelector('img');
    return c.dataset.full || (i ? i.src : '');
  }).filter(Boolean);
  palCurrentTitles = cards.map(palCardTitle);
  const clicked = cards.indexOf(el);
  palCurrentIndex = clicked >= 0 ? clicked : 0;

  const src = el.dataset.full || el.querySelector('img').src;
  palScale = 1; palPanX = 0; palPanY = 0;
  img.src = src;
  img.style.transform = 'translate(0px, 0px) scale(1)';
  img.style.cursor = 'default';
  lb.classList.add('open');
  pushModalState();
  document.getElementById('pal-lb-fixed-close').style.display = 'flex';
  updatePalNav();
  palUpdateChrome();

  lb.onwheel = (e) => {
    e.preventDefault();
    const rect = img.getBoundingClientRect();
    const cx = e.clientX - (rect.left + rect.width / 2);
    const cy = e.clientY - (rect.top + rect.height / 2);
    const prevScale = palScale;
    palScale = Math.min(Math.max(1, palScale * (1 - e.deltaY * 0.002)), 6);
    const ratio = palScale / prevScale;
    palPanX = palPanX * ratio + cx * (ratio - 1);
    palPanY = palPanY * ratio + cy * (ratio - 1);
    clampPalPan();
    applyPalTransform();
    img.style.cursor = palScale > 1 ? 'grab' : 'default';
  };

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
      const newCX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const newCY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const prevScale = palScale;
      palScale = Math.min(Math.max(1, palLastScale * (newDist / palStartDist)), 6);
      const ratio = palScale / prevScale;
      const rect = img.getBoundingClientRect();
      const cx = newCX - (rect.left + rect.width / 2);
      const cy = newCY - (rect.top + rect.height / 2);
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

  // Backdrop click closes — but stop propagation from the image itself
  img.onclick = (e) => e.stopPropagation();
  lb.onclick = (e) => { if (e.target === lb) mcHomeClosePalette(); };

  document.addEventListener('keydown', palEscHandler);
}

if (mcOn('worlds', 'rp')) {
  document.querySelectorAll('.hcpc-instance').forEach(function(slider) {
    var wrap     = slider.closest('.hcpc-wrap');
    var track    = slider.querySelector('.hcpc-track');
    var dots     = slider.querySelectorAll('.hcpc-dot');
    var btnPrev  = slider.querySelector('.hcpc-arrow.left');
    var btnNext  = slider.querySelector('.hcpc-arrow.right');
    var split    = wrap.querySelector('.hcpc-dl-split');
    var dropdown = wrap.querySelector('.hcpc-dropdown');
    var dlBtn    = wrap.querySelector('.hcpc-dl-btn');
    var badge    = dlBtn ? dlBtn.querySelector('.hcpc-dl-badge') : null;

    var total = dots.length, current = 0, timer;

    function goTo(n) {
      current = (n + total) % total;
      track.style.transform = 'translateX(-' + (current * 100) + '%)';
      dots.forEach(function(d, i) { d.classList.toggle('active', i === current); });
    }
    function next() { goTo(current + 1); reset(); }
    function prev() { goTo(current - 1); reset(); }
    function reset() { clearInterval(timer); timer = setInterval(next, 8000); }

    btnNext.addEventListener('click', next);
    btnPrev.addEventListener('click', prev);
    dots.forEach(function(d, i) { d.addEventListener('click', function() { goTo(i); reset(); }); });

    var sx = 0;
    slider.addEventListener('touchstart', function(e) { sx = e.touches[0].clientX; }, { passive: true });
    slider.addEventListener('touchend', function(e) {
      var dx = sx - e.changedTouches[0].clientX;
      if (Math.abs(dx) > 40) dx > 0 ? next() : prev();
    }, { passive: true });

    reset();

    if (split && dropdown) {
      split.addEventListener('click', function(e) {
        e.stopPropagation();
        var open = dropdown.classList.toggle('open');
        split.classList.toggle('open', open);
      });

      /* clicking a dropdown item updates the badge + button href */
      dropdown.querySelectorAll('a[data-label]').forEach(function(item) {
        item.addEventListener('click', function(e) {
          e.preventDefault();
          var label = item.getAttribute('data-label');
          var href  = item.getAttribute('data-href') || '#';
          if (badge) badge.textContent = label;
          if (dlBtn) dlBtn.setAttribute('href', href);
          dropdown.classList.remove('open');
          split.classList.remove('open');
        });
      });

      dropdown.addEventListener('click', function(e) { e.stopPropagation(); });
    }
  });
}

if (mcOn('worlds', 'rp')) {
  /* Mark stats containers with odd count */
  document.querySelectorAll('.hcpc-stats').forEach(function(s) {
    var count = s.querySelectorAll('.hcpc-stat').length;
    if (count % 2 !== 0) s.classList.add('hcpc-stats--odd');
  });
}

if (mcOn('worlds', 'rp')) {
  document.addEventListener('click', function() {
    document.querySelectorAll('.hcpc-dropdown').forEach(function(d) { d.classList.remove('open'); });
    document.querySelectorAll('.hcpc-dl-split').forEach(function(s) { s.classList.remove('open'); });
  });
}

if (mcOn('worlds', 'rp')) {
  document.querySelectorAll('.hcpc-copy-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var url = btn.getAttribute('data-copy');
      navigator.clipboard.writeText(url).then(function() {
        var label = btn.querySelector('.hcpc-copy-label');
        btn.classList.add('copied');
        if (label) label.textContent = 'Copied!';
        setTimeout(function() {
          btn.classList.remove('copied');
          if (label) label.textContent = 'Copy link';
        }, 2000);
      });
    });
  });
}

// ── BACK BUTTON CLOSES MODALS ──


function mcWorldsPopModalHandler() {
  const galLb = document.getElementById('gal-lightbox');
  const palLb = document.getElementById('pal-lightbox');
  const cmd   = document.getElementById('cmdModal');
  if (galLb.classList.contains('open')) {
    galLb.classList.remove('open');
    document.getElementById('gal-lb-fixed-close').style.display = 'none';
    document.removeEventListener('keydown', lbEscHandler);
  } else if (palLb.classList.contains('open')) {
    palLb.classList.remove('open');
    document.getElementById('pal-lb-fixed-close').style.display = 'none';
    document.getElementById('pal-lb-prev').style.display = 'none';
    document.getElementById('pal-lb-next').style.display = 'none';
    palScale = 1; palPanX = 0; palPanY = 0; palIsPanning = false;
    window.onmousemove = null; window.onmouseup = null;
    document.removeEventListener('keydown', palEscHandler);
  } else if (cmd && cmd.classList.contains('open')) {
    cmd.classList.remove('open');
  }
}

if (mcOn('worlds')) window.addEventListener('popstate', mcWorldsPopModalHandler);

let palCurrentSlides = [], palCurrentIndex = 0, palCurrentTitles = [];

function mcWorldsClosePalette() {
    document.body.style.touchAction = ''; // add this

  const lb = document.getElementById('pal-lightbox');
  if (!lb.classList.contains('open')) return;
  lb.classList.remove('open');
  document.getElementById('pal-lb-fixed-close').style.display = 'none';
  document.getElementById('pal-lb-prev').style.display = 'none';
  document.getElementById('pal-lb-next').style.display = 'none';
  palScale = 1; palPanX = 0; palPanY = 0; palIsPanning = false;
  window.onmousemove = null; window.onmouseup = null;
  document.removeEventListener('keydown', palEscHandler);
}

function palLightboxNav(dir) {
  if (palCurrentSlides.length <= 1) return;
  var img = document.getElementById('pal-lb-img');
  palScale = 1; palPanX = 0; palPanY = 0;
  applyPalTransform();

  // slide out current
  img.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
  img.style.transform = dir > 0
    ? 'translateX(-60px) scale(1)' 
    : 'translateX(60px) scale(1)';
  img.style.opacity = '0';

  setTimeout(function() {
    palCurrentIndex = (palCurrentIndex + dir + palCurrentSlides.length) % palCurrentSlides.length;
    img.src = palCurrentSlides[palCurrentIndex];

    // position new image on the opposite side before sliding in
    img.style.transition = 'none';
    img.style.transform = dir > 0
      ? 'translateX(60px) scale(1)'
      : 'translateX(-60px) scale(1)';
    img.style.opacity = '0';

    // force reflow so the browser registers the starting position
    img.offsetHeight;

    // slide in
    img.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    img.style.transform = 'translateX(0px) scale(1)';
    img.style.opacity = '1';

    updatePalNav();
    palUpdateChrome();
  }, 50);
}

function updatePalNav() {
  var prevBtn = document.getElementById('pal-lb-prev');
  var nextBtn = document.getElementById('pal-lb-next');
  // Not every page's lightbox has these buttons.
  if (!prevBtn || !nextBtn) return;
  if (palCurrentSlides.length <= 1) {
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    return;
  }
  prevBtn.style.display = 'flex';
  nextBtn.style.display = 'flex';
  prevBtn.style.opacity = '1';
  nextBtn.style.opacity = '1';
}

function mcWorldsOpenPalette(el) {
  document.body.style.touchAction = 'none'; // makes no delay
  var sliderWrap = el.closest('.hcpc-slider');
  var allSlides = sliderWrap ? Array.from(sliderWrap.querySelectorAll('.hcpc-slide')) : [el];
  palCurrentSlides = allSlides.map(function(slide) {
    var img = slide.querySelector('img');
    return slide.dataset.full || (img ? img.src : '');
  }).filter(Boolean);
  var clickedIndex = allSlides.indexOf(el);
  palCurrentIndex = clickedIndex >= 0 ? clickedIndex : 0;

  var lb  = document.getElementById('pal-lightbox');
  var img = document.getElementById('pal-lb-img');
  palScale = 1; palPanX = 0; palPanY = 0; palIsPanning = false;
  img.src = palCurrentSlides[palCurrentIndex];
  img.style.transform = 'translate(0px, 0px) scale(1)';
  img.style.cursor = 'default';
  lb.classList.add('open');
  pushModalState();
  document.getElementById('pal-lb-fixed-close').style.display = 'flex';
  updatePalNav();

  lb.onwheel = function(e) {
    e.preventDefault();
    var rect = img.getBoundingClientRect();
    var cx = e.clientX - (rect.left + rect.width / 2);
    var cy = e.clientY - (rect.top + rect.height / 2);
    var prevScale = palScale;
    palScale = Math.min(Math.max(1, palScale * (1 - e.deltaY * 0.002)), 6);
    var ratio = palScale / prevScale;
    palPanX = palPanX * ratio + cx * (ratio - 1);
    palPanY = palPanY * ratio + cy * (ratio - 1);
    clampPalPan();
    applyPalTransform();
    img.style.cursor = palScale > 1 ? 'grab' : 'default';
  };

  img.onmousedown = function(e) {
    if (palScale <= 1) return;
    e.preventDefault();
    palIsPanning = true;
    palPanStartX = e.clientX - palPanX;
    palPanStartY = e.clientY - palPanY;
    img.style.cursor = 'grabbing';
  };
  window.onmousemove = function(e) {
    if (!palIsPanning) return;
    palPanX = e.clientX - palPanStartX;
    palPanY = e.clientY - palPanStartY;
    clampPalPan();
    applyPalTransform();
  };
  window.onmouseup = function() {
    if (!palIsPanning) return;
    palIsPanning = false;
    img.style.cursor = palScale > 1 ? 'grab' : 'default';
  };

  img.ontouchstart = function(e) {
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
  img.ontouchmove = function(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      var newDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      var prevScale = palScale;
      palScale = Math.min(Math.max(1, palLastScale * (newDist / palStartDist)), 6);
      var ratio = palScale / prevScale;
      var rect = img.getBoundingClientRect();
      var cx = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - (rect.left + rect.width / 2);
      var cy = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - (rect.top + rect.height / 2);
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
  img.ontouchend = function(e) {
    if (e.touches.length < 2) palIsPanning = false;
    if (palScale <= 1) { palScale = 1; palPanX = 0; palPanY = 0; }
    else clampPalPan();
    applyPalTransform();
  };

  img.onclick = function(e) { e.stopPropagation(); };
  lb.onclick = function(e) { if (e.target === lb) mcWorldsClosePalette(); };
  document.addEventListener('keydown', palEscHandler);
}

if (mcOn('seeds')) {
  /* ── Slide data: all images per card ── */
  window.seedSlides = {
    sc1: [
      'minecrafticons/javaseeds/s1a-compresso.jpg',
      'minecrafticons/javaseeds/s1z-compresso.jpg',
      'minecrafticons/javaseeds/s1b-compresso.jpg',
      'minecrafticons/javaseeds/s1c-compresso.jpg',
      'minecrafticons/javaseeds/s1d-compresso.jpg',
      'minecrafticons/javaseeds/s1e-compresso.jpg',
      'minecrafticons/javaseeds/s1f-compresso.jpg'
    ],
    sc2: [
      'minecrafticons/javaseeds/s2a-compresso.jpg',
      'minecrafticons/javaseeds/s2z.jpg',
      'minecrafticons/javaseeds/s2b-compresso.jpg',
      'minecrafticons/javaseeds/s2c-compresso.jpg',
      'minecrafticons/javaseeds/s2d-compresso.jpg'
    ],
    sc3: [
      'minecrafticons/javaseeds/s3a-compresso.jpg',
      'minecrafticons/javaseeds/s3z.jpg',
      'minecrafticons/javaseeds/s3b-compresso.jpg'
    ],
    sc4: [
      'minecrafticons/javaseeds/s4a-compresso.jpg',
      'minecrafticons/javaseeds/s4z.jpg',
      'minecrafticons/javaseeds/s4b-compresso.jpg'
    ],
    sc5: [
      'minecrafticons/javaseeds/s5a-compresso.jpg',
      'minecrafticons/javaseeds/s5z.jpg',
      'minecrafticons/javaseeds/s5b-compresso.jpg'
    ],
    sc6: [
      'minecrafticons/javaseeds/s6a-compresso.jpg',
      'minecrafticons/javaseeds/s6z.jpg',
      'minecrafticons/javaseeds/s6b-compresso.jpg',
      'minecrafticons/javaseeds/s6c-compresso.jpg'
    ],
    sc7: [
      'minecrafticons/javaseeds/s7a-compresso.jpg',
      'minecrafticons/javaseeds/s7z.jpg',
      'minecrafticons/javaseeds/s7b-compresso.jpg',
      'minecrafticons/javaseeds/s7c-compresso.jpg',
      'minecrafticons/javaseeds/s7d-compresso.jpg',
      'minecrafticons/javaseeds/s7e-compresso.jpg'
    ],
    sc8: [
      'minecrafticons/javaseeds/s8a-compresso.jpg',
      'minecrafticons/javaseeds/s8z.jpg',
      'minecrafticons/javaseeds/s8b-compresso.jpg',
      'minecrafticons/javaseeds/s8c-compresso.jpg'
    ],
    sc9: [
      'minecrafticons/javaseeds/s9a-compresso.jpg',
      'minecrafticons/javaseeds/s9z.jpg',
      'minecrafticons/javaseeds/s9b-compresso.jpg',
      'minecrafticons/javaseeds/s9c-compresso.jpg'
    ],
    sc10: [
      'minecrafticons/javaseeds/s10a-compresso.jpg',
      'minecrafticons/javaseeds/s10z.jpg',
      'minecrafticons/javaseeds/s10b-compresso.jpg',
      'minecrafticons/javaseeds/s10c-compresso.jpg'
    ],
    sc11: [
      'minecrafticons/javaseeds/s11a-compresso.jpg',
      'minecrafticons/javaseeds/s11z.jpg',
      'minecrafticons/javaseeds/s11b-compresso.jpg',
      'minecrafticons/javaseeds/s11c-compresso.jpg'
    ],
    sc12: [
      'minecrafticons/javaseeds/s12a-compresso.jpg',
      'minecrafticons/javaseeds/s12z.jpg',
      'minecrafticons/javaseeds/s12b-compresso.jpg',
      'minecrafticons/javaseeds/s12c-compresso.jpg'
    ],
    sc13: [
      'minecrafticons/javaseeds/s13a-compresso.jpg',
      'minecrafticons/javaseeds/s13z.jpg',
      'minecrafticons/javaseeds/s13b-compresso.jpg',
      'minecrafticons/javaseeds/s13c-compresso.jpg'
    ],
    sc14: [
      'minecrafticons/javaseeds/s14a-compresso.jpg',
      'minecrafticons/javaseeds/s14z.jpg',
      'minecrafticons/javaseeds/s14b-compresso.jpg',
      'minecrafticons/javaseeds/s14c-compresso.jpg',
      'minecrafticons/javaseeds/s14d-compresso.jpg'
    ],
    sc15: [
      'minecrafticons/javaseeds/s15a-compresso.jpg',
      'minecrafticons/javaseeds/s15z.jpg',
      'minecrafticons/javaseeds/s15b-compresso.jpg'
    ],
    sc16: [
      'minecrafticons/javaseeds/s16a-compresso.jpg',
      'minecrafticons/javaseeds/s16z.jpg',
      'minecrafticons/javaseeds/s16b-compresso.jpg',
      'minecrafticons/javaseeds/s16c-compresso.jpg'
    ],
    sc17: [
      'minecrafticons/javaseeds/s17a-compresso.jpg',
      'minecrafticons/javaseeds/s17z.jpg',
      'minecrafticons/javaseeds/s17b-compresso.jpg',
      'minecrafticons/javaseeds/s17c-compresso.jpg',
      'minecrafticons/javaseeds/s17d-compresso.jpg'
    ],
    sc18: [
      'minecrafticons/javaseeds/s18a-compresso.jpg',
      'minecrafticons/javaseeds/s18z.jpg',
      'minecrafticons/javaseeds/s18b-compresso.jpg'
    ],
    sc19: [
      'minecrafticons/javaseeds/s19a-compresso.jpg',
      'minecrafticons/javaseeds/s19z.jpg',
      'minecrafticons/javaseeds/s19b-compresso.jpg',
      'minecrafticons/javaseeds/s19c-compresso.jpg'
    ],
    sc20: [
      'minecrafticons/javaseeds/s20a-compresso.jpg',
      'minecrafticons/javaseeds/s20z.jpg',
      'minecrafticons/javaseeds/s20b-compresso.jpg',
      'minecrafticons/javaseeds/s20c-compresso.jpg'
    ],
    sc21: [
      'minecrafticons/javaseeds/s21a-compresso.jpg',
      'minecrafticons/javaseeds/s21z.jpg',
      'minecrafticons/javaseeds/s21b-compresso.jpg',
      'minecrafticons/javaseeds/s21c-compresso.jpg'
    ],
    sc22: [
      'minecrafticons/javaseeds/s22a-compresso.jpg',
      'minecrafticons/javaseeds/s22z.jpg',
      'minecrafticons/javaseeds/s22b-compresso.jpg',
      'minecrafticons/javaseeds/s22c-compresso.jpg'
    ],
    sc23: [
      'minecrafticons/javaseeds/s23a-compresso.jpg',
      'minecrafticons/javaseeds/s23z.jpg',
      'minecrafticons/javaseeds/s23b-compresso.jpg',
      'minecrafticons/javaseeds/s23c-compresso.jpg'
    ],
    sc24: [
      'minecrafticons/javaseeds/s24a-compresso.jpg',
      'minecrafticons/javaseeds/s24z.jpg',
      'minecrafticons/javaseeds/s24b-compresso.jpg',
      'minecrafticons/javaseeds/s24c-compresso.jpg'
    ]
  };
}

if (mcOn('seeds')) {
  window.seedCurrent = {};
}

if (mcOn('seeds')) {
  window.seedPreloaded = {};
}

if (mcOn('seeds')) {
  /* ── Init current index for all cards ── */
  Object.keys(window.seedSlides).forEach(function(id){ window.seedCurrent[id] = 0; });
}

/* ── Show/hide spinner overlay inside a slider ── */
function seedShowSpinner(slider) {
  if (!slider || slider.querySelector('.seed-spinner')) return;
  var sp = document.createElement('div');
  sp.className = 'seed-spinner';
  sp.innerHTML = '<div class="seed-spinner-ring"></div>';
  slider.appendChild(sp);
}
function seedHideSpinner(slider) {
  if (!slider) return;
  var sp = slider.querySelector('.seed-spinner');
  if (sp) sp.remove();
}

/* ── Navigate to a specific slide index ── */
window.seedGoTo = function(id, n) {
  var slides = window.seedSlides[id]; if (!slides) return;
  window.seedCurrent[id] = (n + slides.length) % slides.length;
  var cur = window.seedCurrent[id];
  var imgEl  = document.getElementById(id + '-img');
  var slider = document.getElementById(id + '-slider');

  if (imgEl) {
    /* If already cached by browser, swap instantly — no spinner needed */
    var probe = new Image();
    probe.src = slides[cur];
    if (probe.complete) {
      /* Already in cache — instant swap */
      imgEl.src = slides[cur];
      seedHideSpinner(slider);
    } else {
      /* Not cached yet — show spinner, swap when loaded */
      seedShowSpinner(slider);
      probe.onload = function() {
        imgEl.src = slides[cur];
        seedHideSpinner(slider);
      };
      probe.onerror = function() {
        imgEl.src = slides[cur];
        seedHideSpinner(slider);
      };
    }
  }

  /* Update dots */
  var dots = document.getElementById(id + '-dots');
  if (dots) {
    dots.querySelectorAll('.seed-dot').forEach(function(d, i) {
      d.classList.toggle('active', i === cur);
    });
  }

  /* Eagerly cache prev, next, and next+1 so future clicks feel instant */
  [-1, 1, 2].forEach(function(offset) {
    var pre = new Image();
    pre.src = slides[(cur + offset + slides.length) % slides.length];
  });
};

if (mcOn('seeds')) {
  /* ── Arrow nav helper ── */
  window.seedSlideNav = function(id, dir) {
    seedGoTo(id, (window.seedCurrent[id] || 0) + dir);
  };
}

if (mcOn('seeds')) {
  /* ── Wire up dot buttons ── */
  Object.keys(window.seedSlides).forEach(function(id) {
    var dots = document.getElementById(id + '-dots'); if (!dots) return;
    dots.querySelectorAll('.seed-dot').forEach(function(dot, i) {
      dot.onclick = function() { seedGoTo(id, i); };
    });
  });
}

if (mcOn('seeds')) {
  /* ── On page load: preload all b/c/d/z slides in background ── */
  window.addEventListener('load', function() {
    Object.keys(window.seedSlides).forEach(function(id) {
      if (window.seedPreloaded[id]) return;
      window.seedPreloaded[id] = true;
      var slides = window.seedSlides[id];
      for (var i = 1; i < slides.length; i++) {
        var img = new Image();
        img.src = slides[i];
      }
    });
  });
}

if (mcOn('seeds')) {
  /* ── Copy seed button logic ── */
  document.querySelectorAll('.seed-copy-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var seed = btn.getAttribute('data-seed');
      var fbId = btn.getAttribute('data-fb');
      var done = function() {
        var fb = document.getElementById(fbId);
        if (fb) { fb.classList.add('show'); setTimeout(function(){ fb.classList.remove('show'); }, 2000); }
        var toast = document.createElement('div');
        toast.className = 'seed-copy-toast';
        toast.textContent = '✓ Seed copied!';
        document.body.appendChild(toast);
        setTimeout(function(){ toast.remove(); }, 1500);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(seed).then(done).catch(function() {
          var ta = document.createElement('textarea'); ta.value = seed;
          document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done();
        });
      } else {
        var ta = document.createElement('textarea'); ta.value = seed;
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done();
      }
    });
  });
}

if (mcOn('seeds')) {
  /* ── Pagination: show/hide cards by page ── */
  (function() {
    var CARDS_PER_PAGE = 10, TOTAL_PAGES = 3, currentPage = 1;
    var allWraps = document.querySelectorAll('.seed-card-wrap');
    allWraps.forEach(function(wrap, i) { wrap.setAttribute('data-page', Math.floor(i / CARDS_PER_PAGE) + 1); });

  function renderPage(page, shouldScroll) {
      var visible = [], hidden = [];
      allWraps.forEach(function(wrap) {
        (parseInt(wrap.getAttribute('data-page')) === page ? visible : hidden).push(wrap);
      });
      var fadingOut = hidden.filter(function(w) { return w.style.display !== 'none'; });
      if (fadingOut.length === 0) { showCards(visible, shouldScroll); }
      else {
        fadingOut.forEach(function(w) { w.style.transition = 'opacity 0.2s ease'; w.style.opacity = '0'; });
        setTimeout(function() {
          fadingOut.forEach(function(w) { w.style.display = 'none'; w.style.opacity = '1'; });
          showCards(visible, shouldScroll);
        }, 200);
      }
    for (var p = 1; p <= TOTAL_PAGES; p++) {
      var btn = document.getElementById('pg-' + p);
      var btnTop = document.getElementById('pg-' + p + '-top');
      if (btn) btn.classList.toggle('active', p === page);
      if (btnTop) btnTop.classList.toggle('active', p === page);
    }
    var prev = document.getElementById('pg-prev'), next = document.getElementById('pg-next');
    var prevTop = document.getElementById('pg-prev-top'), nextTop = document.getElementById('pg-next-top');
    if (prev) prev.disabled = page <= 1;
    if (next) next.disabled = page >= TOTAL_PAGES;
    if (prevTop) prevTop.disabled = page <= 1;
    if (nextTop) nextTop.disabled = page >= TOTAL_PAGES;

    /* Mobile "you are here" crumb in the secondary top bar -- static
       "Seeds" in the markup, page number appended only past page 1 so
       it doesn't read "Seeds (1)" on the default view. */
    var crumb = document.querySelector('.sc-mobile-group');
    if (crumb) crumb.textContent = 'Seeds' + (page > 1 ? ' (' + page + ')' : '');
  }

  function showCards(cards, shouldScroll) {
      cards.forEach(function(wrap) { wrap.style.opacity = '0'; wrap.style.display = ''; });
      if (shouldScroll) {
        var header = document.getElementById('seeds-section-header');
        if (header) { header.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      }
      setTimeout(function() {
        cards.forEach(function(w) { w.style.transition = 'opacity 0.25s ease'; w.style.opacity = '1'; });
      }, 120);
    }

  window.seedGoToPage  = function(page) { currentPage = page; renderPage(page, true); };
  window.seedChangePage = function(dir)  { var n = currentPage + dir; if (n < 1 || n > TOTAL_PAGES) return; currentPage = n; renderPage(currentPage, true); };
  renderPage(1, false);
  })();
}

if (mcOn('seeds')) {
  /* ── Seed search ── */
  (function() {
    var searchInput = document.getElementById('seedSearch');
    var clearBtn = document.getElementById('seedSearchClear');
    var noResults = document.getElementById('seedNoResults');
    var allWraps = document.querySelectorAll('.seed-card-wrap');
    var paginationBars = [document.querySelector('.seed-pagination'), document.getElementById('seed-pagination-top')];

    window.filterSeeds = function() {
      var query = (searchInput.value || '').trim().toLowerCase();
      clearBtn.style.display = query ? 'flex' : 'none';

      if (!query) {
        // No search: restore normal pagination behavior
        paginationBars.forEach(function(bar) { if (bar) bar.style.display = ''; });
        noResults.style.display = 'none';
        renderPage(1);
        return;
      }

      // Searching: ignore pagination, show all matches across both pages
      paginationBars.forEach(function(bar) { if (bar) bar.style.display = 'none'; });

      var visibleCount = 0;
      allWraps.forEach(function(wrap) {
        var titleEl = wrap.querySelector('.seed-card-title');
        var title = titleEl ? titleEl.textContent.toLowerCase() : '';
        var match = title.indexOf(query) !== -1;
        wrap.style.display = match ? '' : 'none';
        wrap.style.opacity = '1';
        if (match) visibleCount++;
      });

      noResults.style.display = visibleCount === 0 ? '' : 'none';
    };

    window.clearSeedSearch = function() {
      searchInput.value = '';
      filterSeeds();
      searchInput.focus();
    };
  })();
}

if (mcOn('rp', 'mods', 'shaders')) {
  // ── PACK SEARCH + FILTER PILLS (combined) ──
  (function() {
    var pills = document.querySelectorAll('#rpPillRow .rp-pill');
    var cards = document.querySelectorAll('.cf-card[data-tags]');
    var groupLabels = document.querySelectorAll('.cf-source-group-label');
    var searchInput = document.getElementById('rpPackSearch');
    var clearBtn = document.getElementById('rpPackSearchClear');
    var noResults = document.getElementById('rpNoResults');
    var activeFilter = 'all';

    function updateGroupLabelVisibility() {
      // Hide a source group's header if every card in that group is currently hidden
      groupLabels.forEach(function(label) {
        var node = label.nextElementSibling;
        var hasVisibleCard = false;
        while (node && !node.classList.contains('cf-source-group-label')) {
          if (node.classList && node.classList.contains('cf-card') && node.style.display !== 'none') {
            hasVisibleCard = true;
            break;
          }
          node = node.nextElementSibling;
        }
        label.style.display = hasVisibleCard ? '' : 'none';
      });
    }

    function applyFilters() {
      var query = (searchInput.value || '').trim().toLowerCase();
      clearBtn.style.display = query ? 'flex' : 'none';

      var visibleCount = 0;
      cards.forEach(function(card) {
        var tags = card.getAttribute('data-tags').split(' ');
        var matchesFilter = activeFilter === 'all' || tags.indexOf(activeFilter) !== -1;

        var nameEl = card.querySelector('.cf-card-name');
        var byEl = card.querySelector('.cf-card-by');
        var descEl = card.querySelector('.cf-card-desc');
        var haystack = (
          (nameEl ? nameEl.textContent : '') + ' ' +
          (byEl ? byEl.textContent : '') + ' ' +
          (descEl ? descEl.textContent : '')
        ).toLowerCase();
        var matchesSearch = !query || haystack.indexOf(query) !== -1;

        var show = matchesFilter && matchesSearch;
        card.style.display = show ? '' : 'none';
        if (show) visibleCount++;
      });

      // Source group headers only make sense on the ALL tab with no active search
      var showGroupLabels = (activeFilter === 'all' && !query);
      groupLabels.forEach(function(label) {
        label.style.display = showGroupLabels ? '' : 'none';
      });
      if (showGroupLabels) updateGroupLabelVisibility();

      noResults.style.display = visibleCount === 0 ? '' : 'none';
    }

    pills.forEach(function(pill) {
      pill.addEventListener('click', function() {
        pills.forEach(function(p) { p.classList.remove('active'); });
        pill.classList.add('active');
        activeFilter = pill.getAttribute('data-filter');
        applyFilters();
      });
    });

    window.filterPacks = applyFilters;
    window.clearPackSearch = function() {
      searchInput.value = '';
      applyFilters();
      searchInput.focus();
    };

    applyFilters();
  })();
}

const _cpySvg=`<svg viewBox="0 0 24 24" width="15" height="15" fill="#444"><path d="M16 1H4a2 2 0 00-2 2v14h2V3h12V1zm3 4H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2zm0 16H8V7h11v14z"/></svg>`;

if (mcOn('commands')) {
  (function(){
    var _mcCmd='';
    document.querySelectorAll('.mc-copy-btn,.mc-copy-full,.mc-pack-copy,.mc-modal-copy-btn').forEach(function(b){b.innerHTML=_cpySvg;});

    document.querySelectorAll('.mc-cmd-card').forEach(function(c){
      c.addEventListener('click',function(e){
        if(e.target.closest('.mc-copy-btn'))return;
        _mcCmd=c.dataset.cmd;
        document.getElementById('mcModalIcon').textContent=c.dataset.icon;
        document.getElementById('mcModalTitle').textContent=c.dataset.name;
        document.getElementById('mcModalSub').textContent=c.dataset.sub;
        document.getElementById('mcModalCode').textContent=c.dataset.cmd;
        document.getElementById('mcModalFb').textContent='';
        var btn=document.querySelector('.mc-modal-copy-btn');
        btn.innerHTML=_cpySvg;btn.classList.remove('copied');
        document.getElementById('cmdModal').classList.add('open');
      });
      c.querySelector('.mc-copy-btn').addEventListener('click',function(e){
        e.stopPropagation();
        var p=e.currentTarget;
        navigator.clipboard.writeText(c.dataset.cmd).then(function(){
          p.innerHTML='✓';p.classList.add('copied');
          setTimeout(function(){p.innerHTML=_cpySvg;p.classList.remove('copied');},1800);
        });
      });
    });

    window.mcCopyModal=function(){
      navigator.clipboard.writeText(_mcCmd).then(function(){
        var btn=document.querySelector('.mc-modal-copy-btn');
        btn.innerHTML='✓';btn.classList.add('copied');
        document.getElementById('mcModalFb').textContent='Copied to clipboard';
        setTimeout(function(){btn.innerHTML=_cpySvg;btn.classList.remove('copied');document.getElementById('mcModalFb').textContent='';},2000);
      });
    };

    window.mcToggleDrop=function(btn){
      var body=btn.closest('.mc-feat-card').querySelector('.mc-drop-body');
      var open=body.classList.contains('open');
      document.querySelectorAll('.mc-drop-body.open').forEach(function(d){d.classList.remove('open');});
      document.querySelectorAll('.mc-drop-btn.open').forEach(function(b){b.classList.remove('open');});
      if(!open){body.classList.add('open');btn.classList.add('open');}
    };

    window.mcCopyFeat=function(btn){
      navigator.clipboard.writeText(btn.previousElementSibling.textContent).then(function(){
        btn.innerHTML='✓';btn.classList.add('copied');
        setTimeout(function(){btn.innerHTML=_cpySvg;btn.classList.remove('copied');},2000);
      });
    };

    window.mcTogglePack=function(h){
      var body=h.nextElementSibling;
      var open=body.classList.contains('open');
      document.querySelectorAll('.mc-pack-body.open').forEach(function(b){b.classList.remove('open');});
      document.querySelectorAll('.mc-pack-header.open').forEach(function(x){x.classList.remove('open');});
      if(!open){body.classList.add('open');h.classList.add('open');}
    };

    window.mcCopyPack=function(btn){
      navigator.clipboard.writeText(btn.closest('.mc-pack-item').dataset.cmd).then(function(){
        btn.innerHTML='✓';btn.classList.add('copied');
        setTimeout(function(){btn.innerHTML=_cpySvg;btn.classList.remove('copied');},1800);
      });
    };

    document.querySelectorAll('#catPills .rp-pill').forEach(function(pill){
      pill.addEventListener('click',function(){
        document.querySelectorAll('#catPills .rp-pill').forEach(function(p){p.classList.remove('active');});
        pill.classList.add('active');
        document.getElementById('cmdSearch').value='';
        document.getElementById('cmdSearchClear').style.display='none';
        mcFilterAll();
      });
    });

    document.addEventListener('keydown',function(e){if(e.key==='Escape')document.getElementById('cmdModal').classList.remove('open');});

    window.mcClearSearch=function(){
      document.getElementById('cmdSearch').value='';
      document.getElementById('cmdSearchClear').style.display='none';
      mcFilterAll();
      document.getElementById('cmdSearch').focus();
    };

    window.mcFilterAll=function(){
      var cat=(document.querySelector('#catPills .rp-pill.active')||{dataset:{cat:'all'}}).dataset.cat;
      var q=document.getElementById('cmdSearch').value.toLowerCase().trim();
      document.getElementById('cmdSearchClear').style.display=q?'flex':'none';
      var quickVisible=0,featVisible=0,packsVisible=0;
      document.querySelectorAll('.mc-cmd-card').forEach(function(c){
        var show=(cat==='all'||c.dataset.cat===cat)&&(!q||c.dataset.name.toLowerCase().includes(q)||c.dataset.sub.toLowerCase().includes(q));
        c.style.display=show?'':'none';if(show)quickVisible++;
      });
      document.querySelectorAll('.mc-feat-card').forEach(function(c){
        var name=(c.querySelector('.mc-feat-name')||{}).textContent.toLowerCase()||'';
        var desc=(c.querySelector('.mc-feat-desc')||{}).textContent.toLowerCase()||'';
        var show=(cat==='all'||c.dataset.cat===cat)&&(!q||name.includes(q)||desc.includes(q));
        c.style.display=show?'':'none';if(show)featVisible++;
      });
      document.querySelectorAll('.mc-pack').forEach(function(p){
        var title=(p.querySelector('.mc-pack-title')||{}).textContent.toLowerCase()||'';
        var show=(cat==='all'||p.dataset.cat===cat)&&(!q||title.includes(q));
        p.style.display=show?'':'none';if(show)packsVisible++;
      });
      document.getElementById('secQuick').style.display=quickVisible?'':'none';
      var quickCountEl=document.getElementById('quickCount');
      if(quickCountEl) quickCountEl.textContent=quickVisible+(quickVisible===1?' command':' commands');
      document.getElementById('secFeatured').style.display=featVisible?'':'none';
      var featCountEl=document.getElementById('featCount');
      if(featCountEl) featCountEl.textContent=featVisible+(featVisible===1?' command':' commands');
      document.getElementById('secPacks').style.display=packsVisible?'':'none';
      var packsCountEl=document.getElementById('packsCount');
      if(packsCountEl) packsCountEl.textContent=packsVisible+(packsVisible===1?' pack':' packs');
      var total=quickVisible+featVisible+packsVisible;
      document.getElementById('mcNoResults').style.display=total===0?'':'none';
    };
    mcFilterAll(); // run once on load so the count badge is populated immediately
  })();
}

// ---------------------------------------------------------------------------
// Seeds' own multi-slide palette opener. Ported from mc-seeds-old.html --
// same shape as mcWorldsOpenPalette (wheel zoom, drag pan, pinch zoom), the
// only real difference is where the slide list comes from: worlds reads
// .hcpc-slide siblings directly out of the DOM, seeds instead reads
// window.seedSlides/window.seedCurrent (built once from the seed data,
// further up this file) keyed by the slider's id ("sc1", "sc10", ...),
// since a seed card's slides are swapped by src rather than existing as
// separate DOM nodes. Falls back to a single-image zoom of whatever was
// clicked if that lookup doesn't resolve, so an unusual card still zooms
// instead of silently failing the way the shared mcHomeOpenPalette did
// here before (it expects el to be a wrapper with a nested <img>; a seed
// slide's onclick sits directly on the <img>, so el.querySelector('img')
// was always null).
function mcSeedsOpenPalette(el) {
  document.body.style.touchAction = 'none';
  var slider = el.closest('.seed-card-slider');
  var cid = null;
  var tile = el.closest ? el.closest('.pal-card') : null;
  var grid = tile ? tile.parentElement : null;

  if (grid && grid.dataset.seed) {
    // Collage: the grid names the card, the tile names the slide.
    cid = grid.dataset.seed;
  } else if (slider) {
    // Pre-collage fallback -- a plain <img id="scN-img"> slider.
    var idImg = slider.querySelector('[id$="-img"]');
    cid = idImg ? idImg.id.replace('-img', '') : null;
  }

  if (cid && window.seedSlides && window.seedSlides[cid]) {
    palCurrentSlides = window.seedSlides[cid].slice();
    palCurrentIndex = tile && tile.dataset.index
      ? parseInt(tile.dataset.index, 10)
      : (window.seedCurrent[cid] || 0);
  } else {
    palCurrentSlides = [el.src];
    palCurrentIndex = 0;
  }
  // Every slide of a seed shows the same seed, so they share one caption.
  var seedTitleEl = slider ? slider.querySelector('.seed-card-title') : null;
  var seedLabel = seedTitleEl ? seedTitleEl.textContent.trim() : '';
  palCurrentTitles = palCurrentSlides.map(function () { return seedLabel; });

  var lb = document.getElementById('pal-lightbox');
  var img = document.getElementById('pal-lb-img');
  palScale = 1; palPanX = 0; palPanY = 0; palIsPanning = false;
  img.src = palCurrentSlides[palCurrentIndex];
  img.style.transform = 'translate(0px, 0px) scale(1)';
  img.style.cursor = 'default';
  lb.classList.add('open');
  pushModalState();
  document.getElementById('pal-lb-fixed-close').style.display = 'flex';
  updatePalNav();
  palUpdateChrome();

  lb.onwheel = function(e) {
    e.preventDefault();
    var rect = img.getBoundingClientRect();
    var cx = e.clientX - (rect.left + rect.width / 2);
    var cy = e.clientY - (rect.top + rect.height / 2);
    var prevScale = palScale;
    palScale = Math.min(Math.max(1, palScale * (1 - e.deltaY * 0.002)), 6);
    var ratio = palScale / prevScale;
    palPanX = palPanX * ratio + cx * (ratio - 1);
    palPanY = palPanY * ratio + cy * (ratio - 1);
    clampPalPan();
    applyPalTransform();
    img.style.cursor = palScale > 1 ? 'grab' : 'default';
  };

  img.onmousedown = function(e) {
    if (palScale <= 1) return;
    e.preventDefault();
    palIsPanning = true;
    palPanStartX = e.clientX - palPanX;
    palPanStartY = e.clientY - palPanY;
    img.style.cursor = 'grabbing';
  };
  window.onmousemove = function(e) {
    if (!palIsPanning) return;
    palPanX = e.clientX - palPanStartX;
    palPanY = e.clientY - palPanStartY;
    clampPalPan();
    applyPalTransform();
  };
  window.onmouseup = function() {
    if (!palIsPanning) return;
    palIsPanning = false;
    img.style.cursor = palScale > 1 ? 'grab' : 'default';
  };

  img.ontouchstart = function(e) {
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
  img.ontouchmove = function(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      var newDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      var prevScale = palScale;
      palScale = Math.min(Math.max(1, palLastScale * (newDist / palStartDist)), 6);
      var ratio = palScale / prevScale;
      var rect = img.getBoundingClientRect();
      var cx = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - (rect.left + rect.width / 2);
      var cy = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - (rect.top + rect.height / 2);
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
  img.ontouchend = function(e) {
    if (e.touches.length < 2) palIsPanning = false;
    if (palScale <= 1) { palScale = 1; palPanX = 0; palPanY = 0; }
    else clampPalPan();
    applyPalTransform();
  };

  img.onclick = function(e) { e.stopPropagation(); };
  lb.onclick = function(e) { if (e.target === lb) mcSeedsClosePalette(); };
  document.addEventListener('keydown', palEscHandler);
}

function mcSeedsClosePalette() {
  document.body.style.touchAction = '';
  var lb = document.getElementById('pal-lightbox');
  if (!lb.classList.contains('open')) return;
  lb.classList.remove('open');
  document.getElementById('pal-lb-fixed-close').style.display = 'none';
  document.getElementById('pal-lb-prev').style.display = 'none';
  document.getElementById('pal-lb-next').style.display = 'none';
  palScale = 1; palPanX = 0; palPanY = 0; palIsPanning = false;
  window.onmousemove = null; window.onmouseup = null;
  document.removeEventListener('keydown', palEscHandler);
}

// ---------------------------------------------------------------------------
// Palette lightbox: Discover, Worlds and Seeds genuinely differ -- Worlds and
// Seeds are both the multi-slide carousel (prev/next, touch-action lock),
// Discover's is the single-image one. All three bodies are kept above under
// page-prefixed names; these two dispatchers keep the plain names working
// for the inline onclick="" in the markup and for palEscHandler(), which all
// three pages share.
// ---------------------------------------------------------------------------
function openPalette(el) {
  if (mcOn('seeds')) return mcSeedsOpenPalette(el);
  return mcOn('worlds') ? mcWorldsOpenPalette(el) : mcHomeOpenPalette(el);
}
function closePalette() {
  if (mcOn('seeds')) return mcSeedsClosePalette();
  return mcOn('worlds') ? mcWorldsClosePalette() : mcHomeClosePalette();
}


/* ===== SHARED: closing run (all seven pages) ===== */

// PAGE LOADER — fires when HTML is parsed, doesn't wait for images/fonts
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add("loaded");
  const loader = document.getElementById('page-loader');
  loader.classList.add('hidden');
  setTimeout(() => loader.remove(), 400);
});

// Skeleton for sidebar when not loaded
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

// ============================================================
// BOTTOM NAV + MORE MODAL + DESKTOP SUB NAV
// ============================================================
function bnLockScroll(){
  document.documentElement.classList.add('no-scroll');
  var cocMain = document.querySelector('.coc-main');
  if(cocMain) cocMain.style.overflow = 'hidden';
}
function bnUnlockScroll(){
  document.documentElement.classList.remove('no-scroll');
  var cocMain = document.querySelector('.coc-main');
  if(cocMain) cocMain.style.overflow = '';
  if(window.bnResyncAfterModal) window.bnResyncAfterModal();
}
// Tracks whether we've pushed a throwaway history entry for the open sheet,
// same pattern as the search modal — lets the phone's back button/gesture
// close the sheet instead of navigating off the page.
let moreMenuHistoryState = false;

function openMoreMenu(){
  var overlay = document.getElementById('moreOverlay');
  var wrap = document.getElementById('bnMoreWrap');
  overlay.classList.add('open');
  if(wrap) wrap.classList.add('open');
  bnLockScroll();

  if(!moreMenuHistoryState){
    history.pushState({ moreMenuModal: true }, '');
    moreMenuHistoryState = true;
  }
}

function toggleMoreMenu(){
  var overlay = document.getElementById('moreOverlay');
  var isOpen = overlay.classList.contains('open');
  if(isOpen){
    closeMoreMenu();
  } else {
    openMoreMenu();
  }
}

// `fromPopstate` is true when triggered by the back button/gesture itself —
// in that case the browser is already consuming the history entry, so we
// must NOT call history.back() again (that would navigate off the page).
function closeMoreMenu(e, fromPopstate){
  document.getElementById('moreOverlay').classList.remove('open');
  var wrap = document.getElementById('bnMoreWrap');
  if(wrap) wrap.classList.remove('open');
  bnUnlockScroll();

  if(moreMenuHistoryState){
    moreMenuHistoryState = false;
    if(!fromPopstate){
      history.back(); // cleans up the throwaway history entry pushed by openMoreMenu()
    }
  }
}
document.addEventListener('DOMContentLoaded', function(){
  var moreOverlay = document.getElementById('moreOverlay');
  if(moreOverlay){
    moreOverlay.addEventListener('touchmove', function(e){
      if(!e.target.closest('.more-sheet')) e.preventDefault();
    }, {passive:false});
  }
});

// Mobile back button / gesture support: closes the sheet instead of
// leaving the page, if it happens to be open when back fires.
window.addEventListener('popstate', () => {
  var overlay = document.getElementById('moreOverlay');
  if(overlay && overlay.classList.contains('open')){
    closeMoreMenu(null, true);
  }
});

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
// ===================================================
(function(){
  const bnBar = document.getElementById('bottomNav');
  const cocMain = document.querySelector('.coc-main');
  if(!bnBar) return;

  const DOWN_HIDE_THRESHOLD = 8;   // px of downward travel before it hides
  const UP_SHOW_THRESHOLD   = 55;  // px of upward travel before it reappears
  const TOP_REVEAL_ZONE     = 40;  // always shown near the very top

  function getScrollY(){
    const winY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const mainY = cocMain ? cocMain.scrollTop : 0;
    return Math.max(winY, mainY);
  }

  let lastY = getScrollY();
  let upAccum = 0;
  let downAccum = 0;
  let ticking = false;
  let suppressUntil = 0; // Date.now() timestamp; while active, scroll events are tracked but never allowed to hide the nav

  function showNav(){ bnBar.classList.remove('bn-hidden'); }
  function hideNav(){ bnBar.classList.add('bn-hidden'); }

  function onScroll(){
    const currentY = getScrollY();

    // Suppressed window (right after a modal closes): just resync the
    // baseline, don't act on the delta — a modal's scroll-lock unwinding
    // can fire a fake "scrolled down" event that isn't a real user scroll.
    if(Date.now() < suppressUntil){
      lastY = currentY;
      showNav();
      ticking = false;
      return;
    }

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

  // Never keep it hidden while the "More" sheet is open
  const moreOverlay = document.getElementById('moreOverlay');
  if(moreOverlay){
    new MutationObserver(function(){
      if(moreOverlay.classList.contains('open')) showNav();
    }).observe(moreOverlay, {attributes:true, attributeFilter:['class']});
  }

  // The opposite rule for the fullscreen image viewers: while one is open the
  // bar must stay down. Watching the class rather than hooking openPalette()/
  // closePalette() catches every way they close -- the X, the backdrop, Escape
  // and the phone's back gesture (mcHomePopModalHandler closes the lightbox
  // directly without going through closePalette).
  ['pal-lightbox', 'gal-lightbox'].forEach(function(id){
    const box = document.getElementById(id);
    if(!box) return;
    new MutationObserver(function(){
      bnBar.classList.toggle('bn-modal-hidden', box.classList.contains('open'));
    }).observe(box, {attributes:true, attributeFilter:['class']});
  });

  // Closing a modal (more-sheet, search, etc.) toggles overflow/scroll-lock
  // on html/body/.coc-main, and mobile browsers can fire a synthetic scroll
  // event during that unlock as things reflow — sometimes a frame or two
  // late, not immediately. Call this after any modal-close: it force-shows
  // the nav and mutes the hide logic for a short window so that fake event
  // can't sneak a "scrolled down" past the resync.
  window.bnResyncAfterModal = function(){
    suppressUntil = Date.now() + 500;
    lastY = getScrollY();
    upAccum = 0;
    downAccum = 0;
    showNav();

    // Keep re-baselining across the next several frames in case the
    // browser's own scroll-position correction lands a bit later.
    let frames = 0;
    function tick(){
      lastY = getScrollY();
      showNav();
      frames++;
      if(frames < 20) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  };

  // Lets other UI (e.g. opening the search bar) hide the nav on demand,
  // independent of actual scrolling.
  window.bnHideNav = function(){ hideNav(); };
})();

document.addEventListener('keydown', function(e){
  if(e.key === 'Escape') closeMoreMenu();
});

// Highlight the active bottom-nav / desktop sub-nav / mobile "More" sheet item based on current page
(function highlightActiveNavItems(){
  function baseName(filename){
    return (filename || '').replace(/(\D)\d+\.html$/i, '$1.html');
  }
  var page = baseName(window.location.pathname.split('/').pop().split('?')[0].split('#')[0] || 'mc-java-home.html');
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

// Desktop sub-nav horizontal scroll arrows (shown only when content overflows)
(function dsnScrollArrows(){
  var track = document.getElementById('dsnScrollTrack');
  var left = document.getElementById('dsnArrowLeft');
  var right = document.getElementById('dsnArrowRight');
  if(!track || !left || !right) return;

  function update(){
    var overflow = track.scrollWidth > track.clientWidth + 1;
    var atStart = track.scrollLeft <= 1;
    var atEnd = track.scrollLeft >= (track.scrollWidth - track.clientWidth - 1);
    left.classList.toggle('show', overflow && !atStart);
    right.classList.toggle('show', overflow && !atEnd);
  }

  left.addEventListener('click', function(){
    track.scrollBy({ left: -200, behavior: 'smooth' });
  });
  right.addEventListener('click', function(){
    track.scrollBy({ left: 200, behavior: 'smooth' });
  });

  track.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
  // Re-check shortly after load in case fonts/images shift layout width
  setTimeout(update, 300);
  // Re-check once the nav has been populated from mc-contents.json
  document.addEventListener('nav-data-ready', function(){ setTimeout(update, 0); });
})();

/* ============================================================
   NAV RENDER — renders hero tabs, mobile "Discover Categories"
   grid, the "More" sheet, and the desktop sub-nav — all from
   mc-contents.json.

   To add/remove/edit a nav item on EVERY page, just edit
   mc-contents.json. Nothing here needs to change.
   ============================================================ */
(function () {
  function normalizePage(url) {
    if (!url) return "";
    return url.toString().split('/').pop().split('?')[0].split('#')[0].replace('.html', '') || "home";
  }
  const currentPage = normalizePage(window.location.pathname);
  const isCurrent = (item) => {
    const link = typeof item === 'string' ? item : item.link;
    if (normalizePage(link) === currentPage) return true;
    const activeOn = typeof item === 'object' && item.activeOn;
    return Array.isArray(activeOn) && activeOn.some((p) => normalizePage(p) === currentPage);
  };

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ---- item renderers ----
  function heroTabHtml(item) {
    const active = isCurrent(item) ? ' active' : '';
    return `<a href="${escapeHtml(item.link)}" class="hero-tab${active}">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}"><span>${escapeHtml(item.name)}</span>
    </a>`;
  }

  function mobileNavItemHtml(item) {
    const active = isCurrent(item) ? ' active' : '';
    return `<a href="${escapeHtml(item.link)}" class="mc-mobile-nav-item${active}"><img src="${escapeHtml(item.image)}" alt="">${escapeHtml(item.name)}</a>`;
  }

  function moreAppGridItemHtml(item) {
    const active = isCurrent(item) ? ' active' : '';
    return `<a href="${escapeHtml(item.link)}" class="more-app-grid-item${active}"><img src="${escapeHtml(item.image)}" alt="">${escapeHtml(item.name)}</a>`;
  }

  function dsnLinkHtml(item) {
    const active = isCurrent(item) ? ' active' : '';
    // hwr's chip classes, styled once in 11layout.css, so the bar matches
    return `<a href="${escapeHtml(item.link)}" class="dsn-chip${active}"><img class="dsn-chip-icon" src="${escapeHtml(item.image)}" alt="">${escapeHtml(item.name)}</a>`;
  }

  // Sections use hwr's .dsn-chip; the destinations on the right use its
  // .stb-hub-link -- the same split hwr makes between its own two strips.
  function stbHubLinkHtml(item) {
    const active = isCurrent(item) ? ' active' : '';
    return `<a href="${escapeHtml(item.link)}" class="stb-hub-link${active}"><img src="${escapeHtml(item.image)}" alt="">${escapeHtml(item.name)}</a>`;
  }

  function bnItemHtml(item) {
    const active = isCurrent(item) ? ' active' : '';
    return `<a href="${escapeHtml(item.link)}" class="bn-item${active}"><img src="${escapeHtml(item.image)}" alt="">${escapeHtml(item.name)}</a>`;
  }

  // ---- section renderers ----
  function renderHeroTabs(data) {
    const wrap = document.querySelector('.hero-game-tabs');
    if (!wrap || !data.heroTabs) return;
    wrap.innerHTML = data.heroTabs.map(heroTabHtml).join('');
  }

  function renderBottomNav(data) {
    const bar = document.getElementById('bottomNav');
    if (!bar || !data.heroTabs) return;
    const moreWrap = document.getElementById('bnMoreWrap');
    const [java, bedrock, story, dungeons] = data.heroTabs;
    bar.innerHTML = '';
    if (java) bar.insertAdjacentHTML('beforeend', bnItemHtml(java));
    if (bedrock) bar.insertAdjacentHTML('beforeend', bnItemHtml(bedrock));
    if (moreWrap) bar.appendChild(moreWrap);
    if (story) bar.insertAdjacentHTML('beforeend', bnItemHtml(story));
    if (dungeons) bar.insertAdjacentHTML('beforeend', bnItemHtml(dungeons));
  }

  function renderMobileNav(data) {
    const nav = document.querySelector('.mc-mobile-nav');
    if (!nav || !data.mobileNav) return;
    // Keep the header row (the "Discover Categories" divider), replace only the item links.
    const header = nav.querySelector('.mc-mobile-nav-header');
    nav.innerHTML = '';
    if (header) nav.appendChild(header);
    nav.insertAdjacentHTML('beforeend', data.mobileNav.map(mobileNavItemHtml).join(''));
  }

  // Same sheet hwr builds: one row per edition, each folding open to that
  // edition's own sections. The row for the edition you are on starts open.
  // Structure and classes are hwr's (.th-mini-wrap / .th-mini-toggle /
  // .th-mini-dropdown / .stb-toc-card), styled once in 11layout.css and
  // toggled by toggleThMiniDropdown() in 11layout.js.
  function renderMoreSheet(data) {
    const list = document.querySelector('.more-list');
    if (!list || !data.moreSheet) return;

    // moreSheet is keyed by edition name; the icon and link for the row
    // itself come from the edition entries, matched on name. "Story Mode"
    // there is "Story" here, so match on the leading word too.
    const editions = (data.desktopSubNav && data.desktopSubNav.editions) || data.heroTabs || [];
    const editionFor = (title) => editions.find((e) =>
      e.name === title || title.split(' ')[0] === e.name) || {};

    let html = '';
    Object.keys(data.moreSheet).forEach((title) => {
      const items = data.moreSheet[title] || [];
      const ed = editionFor(title);
      const open = isCurrent(ed) ? ' open' : '';
      const active = isCurrent(ed) ? ' active' : '';

      const toc = items.map((it) => {
        const cur = isCurrent(it) ? ' is-current' : '';
        return `<a href="${escapeHtml(it.link)}" class="stb-toc-card${cur}">` +
          `<img class="stb-toc-icon" src="${escapeHtml(it.image)}" alt="">` +
          `<span class="stb-toc-name">${escapeHtml(it.name)}</span>` +
          `</a>`;
      }).join('');

      html += `<div class="th-mini-wrap${open}">` +
        `<div class="th-mini-toggle${active}">` +
        `<a href="${escapeHtml(ed.link || '#')}" class="th-mini th-mini-link${active}">` +
        `<img src="${escapeHtml(ed.image || '')}" alt="">` +
        `<span>${escapeHtml(title)}</span>` +
        `</a>` +
        `<button type="button" class="th-mini-chevron-btn" onclick="toggleThMiniDropdown(this)" aria-label="Toggle ${escapeHtml(title)} sections">` +
        `<svg class="th-mini-chevron" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` +
        `</button>` +
        `</div>` +
        `<div class="th-mini-dropdown"><div class="th-mini-dropdown-inner"><div class="stb-toc-grid stb-toc-grid-2col">${toc}</div></div></div>` +
        `</div>`;
    });
    list.innerHTML = `<div class="th-mini-grid">${html}</div>`;
  }

  function renderDesktopSubNav(data) {
    if (!data.desktopSubNav) return;
    const { editions = [], categories = [] } = data.desktopSubNav;
    // Two strips in the secondary top bar now, not one track in a bar of its
    // own: sections on the left, editions on the right -- the same split hwr
    // uses for its categories and its hub destinations.
    const sections = document.getElementById('dsnCategoriesScroll');
    const dests = document.getElementById('stbHubNavScroll');
    if (sections) sections.innerHTML = categories.map(dsnLinkHtml).join('');
    if (dests) dests.innerHTML = editions.map(stbHubLinkHtml).join('');
    // scrollWidth is only meaningful once the chips exist -- the same
    // re-measure hwr's renderCategoryNav() does after it injects.
    if (typeof window.updateDsnScrollArrows === 'function') window.updateDsnScrollArrows();
    if (typeof window.updateStbHubNavArrows === 'function') window.updateStbHubNavArrows();
  }

  // ---- init ----
  function renderAll(data) {
    renderHeroTabs(data);
    renderBottomNav(data);
    renderMobileNav(data);
    renderMoreSheet(data);
    renderDesktopSubNav(data);
    document.dispatchEvent(new CustomEvent('nav-data-ready', { detail: data }));
  }

  function init() {
    fetch('mc-contents.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load mc-contents.json: ' + res.status);
        return res.json();
      })
      .then(renderAll)
      .catch((err) => console.error('[nav-render]', err));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


/* ===== SECTION TITLE FIT (ported from hwrFitLayoutTitles in hwr-js.js) =====
   The section headings use hwr's Orbitron treatment, which on a narrow phone
   is wider than the space left beside "View more" and the scroll arrows --
   four of Discover's eleven headings overflow at 390px. hwr never shows that
   because it steps the font size down until the text fits, with an 11px
   floor, and this is the same routine pointed at .cf-section-title.

   The one change: hwr measures an inner <span> because its title is a flex
   row with an icon in it. There is no icon here, so the heading is a plain
   block and measures itself. Everything else -- the 600px phone cutoff, the
   11px floor, the 0.5px step, the font-load and resize re-runs -- is hwr's.  */
var MC_TITLE_MIN_PX = 11;
var MC_TITLE_STEP = 0.5;

function mcFitSectionTitles() {
  var titles = document.querySelectorAll('.cf-section-title');
  if (!titles.length) return;

  var phone = window.matchMedia('(max-width: 600px)').matches;

  Array.prototype.forEach.call(titles, function (title) {
    // Always clear first: this also restores the stylesheet's clamp() when
    // the viewport grows back past 600px, so rotating a phone to landscape
    // never leaves a stale inline size behind.
    title.style.fontSize = '';
    if (!phone) return;

    var size = parseFloat(window.getComputedStyle(title).fontSize);
    if (!size) return;

    // scrollWidth is the full text width, clientWidth what the flex item was
    // actually given. The 0.5 guard keeps sub-pixel rounding from triggering
    // a shrink that is not needed.
    var guard = 0;
    while (title.scrollWidth > title.clientWidth + 0.5 &&
           size > MC_TITLE_MIN_PX &&
           guard++ < 120) {
      size -= MC_TITLE_STEP;
      title.style.fontSize = size + 'px';
    }
  });
}
window.mcFitSectionTitles = mcFitSectionTitles;

(function initSectionTitleFit() {
  // Orbitron changes the text width when it swaps in, so an early
  // measurement can be wrong. Re-run once the real font is in use.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(mcFitSectionTitles);
  }

  var t = null;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(mcFitSectionTitles, 120);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mcFitSectionTitles);
  } else {
    mcFitSectionTitles();
  }
})();


/* ===== BROKEN IMAGE -> FIRST LETTER (after hwr's hwrIconFallback) =====
   Card art is hotlinked from the source sites, so some of it 404s or is
   blocked. hwr handles the same problem for favicons by swapping the <img>
   for the first letter of the name; this does the same for card tiles.

   Two differences from hwr, both forced by the markup:

   * hwr can put onerror="" straight in its HTML because it renders the
     cards from JSON. Most of these cards are static markup, so instead a
     single capture-phase listener on the document catches every image
     error -- error events don't bubble, but they do capture, and one
     listener covers cards injected later (the server row) for free.

   * hwr's icons sit in a .web-icon-wrap it can relabel. These images have
     no wrapper, so the <img> is replaced by a <div> that keeps the same
     class list, which is what makes it keep the tile's size and radius.  */

/* Selector -> where to read the name from, nearest ancestor first. */
var MC_FALLBACK_SOURCES = [
  { img: '.cf-card-img', name: '.cf-card-name' },
  { img: '.server-card-img', name: '.server-card-name' },
  { img: '.cf-source-icon', name: '.cf-card-name', chip: true }
];

function mcImageFallback(img) {
  if (!img || img.dataset.mcFallbackDone) return;

  var spec = null;
  for (var i = 0; i < MC_FALLBACK_SOURCES.length; i++) {
    if (img.matches(MC_FALLBACK_SOURCES[i].img)) {
      spec = MC_FALLBACK_SOURCES[i];
      break;
    }
  }
  if (!spec) return;

  var card = img.closest('.cf-card, .server-card, .cf-card-body') || img.parentElement;
  var nameEl = card ? card.querySelector(spec.name) : null;
  var text = (nameEl ? nameEl.textContent : '') || img.alt || '';
  // Skip a leading "[Mosslorn]"-style bracket or "#1" rank so the letter is
  // the first thing a reader would actually call the card.
  text = text.replace(/^[\s\[\(#*\-]+/, '');
  var letter = text.trim().charAt(0).toUpperCase() || '?';

  var box = document.createElement('div');
  box.className = img.className + ' mc-img-fallback' + (spec.chip ? ' is-chip' : '');
  box.setAttribute('aria-label', text.trim() || 'no image');
  box.dataset.mcFallbackDone = '1';

  if (spec.chip) {
    // At 16px a letter IS the right pattern -- it is what Gmail, Slack and
    // hwr's own favicon fallback do. Only the big card tiles get the texture.
    box.textContent = letter;
  } else {
    // Card tiles get the block texture from the stylesheet plus a muted
    // block glyph, the same shape CurseForge and Modrinth ship as their
    // default project art. If the glyph itself 404s it removes itself and
    // the texture alone carries the tile.
    var glyph = document.createElement('img');
    glyph.className = 'mc-img-fallback-glyph';
    glyph.src = 'minecrafticons/minecraft-block-logo.png';
    glyph.alt = '';
    glyph.addEventListener('error', function () { glyph.remove(); });
    box.appendChild(glyph);
  }
  if (img.parentNode) img.parentNode.replaceChild(box, img);
}

function mcScanBrokenImages(root) {
  var sel = MC_FALLBACK_SOURCES.map(function (s) { return s.img; }).join(',');
  var imgs = (root || document).querySelectorAll(sel);
  Array.prototype.forEach.call(imgs, function (img) {
    // complete with no intrinsic width means it finished and failed. Images
    // still loading are left to the error listener below.
    if (img.complete && img.naturalWidth === 0) mcImageFallback(img);
  });
}

// Capture phase: error does not bubble, so a listener on document only sees
// it during capture. This covers images added later without re-binding.
document.addEventListener('error', function (e) {
  var t = e.target;
  if (t && t.tagName === 'IMG') mcImageFallback(t);
}, true);

(function initImageFallback() {
  function run() { mcScanBrokenImages(document); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  // The server row is filled from a live API well after load, and lazily
  // loaded tiles resolve late, so sweep again once things have settled.
  window.addEventListener('load', function () {
    setTimeout(run, 800);
    setTimeout(run, 3000);
  });
})();


/* ===== ROW EDGE FADE =====
   updateArrows() already works out whether a row is at its start or end in
   order to enable/disable the arrows; this reuses that same measurement to
   add the fade only on the side that still has cards to scroll to. */
function mcUpdateRowFade(row) {
  if (!row) return;
  var atStart = row.scrollLeft <= 4;
  var atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
  var scrollable = row.scrollWidth > row.clientWidth + 4;
  row.classList.toggle('has-fade-right', scrollable && !atEnd);
  row.classList.toggle('has-fade-left', scrollable && !atStart);
}

(function initRowFades() {
  function wire() {
    var rows = document.querySelectorAll('.cf-row');
    Array.prototype.forEach.call(rows, function (row) {
      if (row.dataset.mcFadeWired) {
        mcUpdateRowFade(row);
        return;
      }
      row.dataset.mcFadeWired = '1';
      row.addEventListener('scroll', function () { mcUpdateRowFade(row); });
      mcUpdateRowFade(row);
    });
  }
  var t = null;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(wire, 120);
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
  // Re-measure once the injected/lazy cards have changed the row's width.
  window.addEventListener('load', function () {
    setTimeout(wire, 800);
    setTimeout(wire, 3000);
  });
})();


/* ===== SIDEBAR: LIVE JAVA VERSION STATUS =====
   Same piston-meta feed the hero strip and the Version Tracker section
   already read (see HERO VERSION STRIP and MINECRAFT VERSION TRACKER,
   above) -- fetched again here independently rather than shared, same
   as those two already do with each other. Guarded on its own elements
   so this is a no-op on any page that doesn't have the sidebar yet.

   Also mirrors the hero strip's "updated Xd ago" line (same timeAgo()
   logic, copied rather than shared -- this block is meant to work on
   its own). Without it the sidebar showed only the bare version number
   for the same data the hero shows with a date attached, which read as
   a stripped-down copy rather than a deliberately compact one. */
(function mcInitSidebarVersion() {
  var relEl = document.getElementById('mcsb-release-version');
  var relUpdatedEl = document.getElementById('mcsb-release-updated');
  var snapEl = document.getElementById('mcsb-snapshot-version');
  var snapUpdatedEl = document.getElementById('mcsb-snapshot-updated');
  if (!relEl || !snapEl) return;

  function timeAgo(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return 'today';
    // Shorter than the hero strip's "updated Xd ago" -- this row is
    // narrower and the version number was losing the space race,
    // truncating "26.3-pre-2" down to "26.3-pr...".
    if (days === 1) return '1d';
    return days + 'd';
  }

  fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var releaseId = data.latest.release;
      var snapshotId = data.latest.snapshot;
      var releaseEntry = data.versions.find(function (v) { return v.id === releaseId; });
      var snapshotEntry = data.versions.find(function (v) { return v.id === snapshotId; });

      relEl.textContent = releaseId;
      snapEl.textContent = snapshotId;
      if (relUpdatedEl) relUpdatedEl.textContent = releaseEntry ? timeAgo(releaseEntry.releaseTime) : '';
      if (snapUpdatedEl) snapUpdatedEl.textContent = snapshotEntry ? timeAgo(snapshotEntry.releaseTime) : '';
    })
    .catch(function () {
      relEl.textContent = 'Unavailable';
      snapEl.textContent = 'Unavailable';
      if (relUpdatedEl) relUpdatedEl.textContent = '';
      if (snapUpdatedEl) snapUpdatedEl.textContent = '';
    });
})();

/* ===== SIDEBAR: "ON THIS PAGE" JUMP NAV =====
   Built from the page's own .cf-section-title text rather than a
   hand-written list, so a section added, renamed or reordered later
   never leaves the sidebar out of sync with the page -- same
   reasoning as hwr's box-three "On This Page" panel.

   Deliberately hides itself below 2 entries rather than rendering a
   "table of contents" with one line in it -- Worlds/RP/Shaders don't
   have Discover's eleven sections to work with, and a jump nav that
   can only jump to the one section already on screen isn't a jump nav.
   Its own divider (mcsbJumpDivider) hides with it, so no double rule
   line sits between two widgets when one of them is empty.

   Runs more than once on purpose: worlds/seeds/rp/mods/shaders/commands
   fill their section titles from JSON after load, so a single
   DOMContentLoaded pass would catch them still empty. Re-scanning at
   800ms/3000ms mirrors the same defensive pattern already used for the
   row fades and the broken-image sweep, above. */
function mcInitSidebarJumpNav() {
  var list = document.getElementById('mcsbJumpList');
  if (!list) return;

  var headers = document.querySelectorAll('.mc-col .cf-section-header');
  var items = [];
  Array.prototype.forEach.call(headers, function (h) {
    var titleEl = h.querySelector('.cf-section-title');
    var text = titleEl ? titleEl.textContent.trim() : '';
    if (text) items.push({ text: text, el: h });
  });

  var wrap = document.getElementById('mcsbJumpWrap');
  var divider = document.getElementById('mcsbJumpDivider');
  if (items.length < 2) {
    if (wrap) wrap.style.display = 'none';
    if (divider) divider.style.display = 'none';
    return;
  }
  if (wrap) wrap.style.display = '';
  if (divider) divider.style.display = '';

  list.innerHTML = '';
  items.forEach(function (item) {
    var a = document.createElement('a');
    a.href = '#';
    a.className = 'mc-sb-jump-link';
    a.textContent = item.text;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      item.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    list.appendChild(a);
  });
}

(function initSidebarJumpNav() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mcInitSidebarJumpNav);
  } else {
    mcInitSidebarJumpNav();
  }
  window.addEventListener('load', function () {
    setTimeout(mcInitSidebarJumpNav, 800);
    setTimeout(mcInitSidebarJumpNav, 3000);
  });
})();

/* ===== SIDEBAR: "CONTINUE BROWSING" (cross-page recently viewed) =====
   The one widget in this box that isn't about the current page at all
   -- it's built from clicks recorded on ANY of the 7 Minecraft pages,
   read back out of localStorage. That's what makes this a genuinely
   general sidebar module instead of a Discover-only table of contents
   wearing a sidebar's clothes: Worlds/Seeds/RP/Mods/Shaders/Commands
   all have something to show here even though none of them have
   Discover's eleven sections to build an on-page nav from.

   mcTrackCardView runs unconditionally, on every page, whether or not
   that page has the sidebar markup yet -- so browsing history is
   already accumulating in localStorage before this gets copy-pasted
   to the other 6 pages, and Box 2 isn't empty on day one there either.

   Storage is a capped, de-duplicated array under one key, newest
   first -- capped so it can't grow forever, de-duplicated by href so
   re-clicking the same card just bumps it back to the front instead of
   listing it twice. */
var MC_RECENT_KEY = 'mcRecentlyViewed';
var MC_RECENT_MAX = 6;

function mcTrackCardView(card) {
  try {
    var nameEl = card.querySelector('.cf-card-name, .server-card-name');
    var imgEl = card.querySelector('.cf-card-img, .server-card-img');
    var name = nameEl ? nameEl.textContent.trim() : (card.getAttribute('alt') || '');
    if (!name || !card.href) return;

    var entry = {
      name: name,
      href: card.href,
      img: imgEl ? imgEl.src : '',
      target: card.getAttribute('target') || '_self'
    };

    var raw = localStorage.getItem(MC_RECENT_KEY);
    var list = raw ? JSON.parse(raw) : [];
    list = list.filter(function (e) { return e.href !== entry.href; });
    list.unshift(entry);
    if (list.length > MC_RECENT_MAX) list.length = MC_RECENT_MAX;
    localStorage.setItem(MC_RECENT_KEY, JSON.stringify(list));
  } catch (e) {
    // Private-browsing/localStorage-disabled: recently-viewed just
    // never fills in, nothing else on the page depends on it.
  }
}

(function initCardViewTracking() {
  document.addEventListener('click', function (e) {
    var card = e.target.closest ? e.target.closest('.cf-card, .server-card') : null;
    if (card) mcTrackCardView(card);
  });
})();

function mcInitSidebarRecent() {
  var listEl = document.getElementById('mcsbRecentList');
  if (!listEl) return;

  var wrap = document.getElementById('mcsbRecentWrap');
  var divider = document.getElementById('mcsbRecentDivider');
  var items = [];
  try {
    var raw = localStorage.getItem(MC_RECENT_KEY);
    items = raw ? JSON.parse(raw) : [];
  } catch (e) {
    items = [];
  }

  if (!items.length) {
    if (wrap) wrap.style.display = 'none';
    if (divider) divider.style.display = 'none';
    return;
  }
  if (wrap) wrap.style.display = '';
  if (divider) divider.style.display = '';

  listEl.innerHTML = '';
  items.forEach(function (item) {
    var a = document.createElement('a');
    a.className = 'mc-sb-recent-item';
    a.href = item.href;
    a.target = item.target || '_self';

    if (item.img) {
      var img = document.createElement('img');
      img.className = 'mc-sb-recent-thumb';
      img.src = item.img;
      img.alt = '';
      // A recorded thumbnail can go stale (the source site takes the
      // image down after the click was tracked) -- fall back to the
      // same letter treatment as a broken card image instead of a
      // blank square.
      img.addEventListener('error', function () {
        var fallback = document.createElement('div');
        fallback.className = 'mc-sb-recent-thumb is-fallback';
        fallback.textContent = item.name.trim().charAt(0).toUpperCase() || '?';
        if (img.parentNode) img.parentNode.replaceChild(fallback, img);
      }, { once: true });
      a.appendChild(img);
    } else {
      var fallback = document.createElement('div');
      fallback.className = 'mc-sb-recent-thumb is-fallback';
      fallback.textContent = item.name.trim().charAt(0).toUpperCase() || '?';
      a.appendChild(fallback);
    }

    var nameEl = document.createElement('span');
    nameEl.className = 'mc-sb-recent-name';
    nameEl.textContent = item.name;
    a.appendChild(nameEl);

    listEl.appendChild(a);
  });
}

(function initSidebarRecent() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mcInitSidebarRecent);
  } else {
    mcInitSidebarRecent();
  }
})();

/* ===== HERO BANNER + "BROWSE CATEGORIES" (from mc-contents.json) =====
   This used to read its own separate mc-categories.json. Merged back
   into mc-contents.json's existing desktopSubNav.categories array --
   the one that already renders the desktop hub nav -- since that
   already had one entry per MC page with the right name/icon/link;
   all it was missing was a hero photo and a card subtitle, added as
   "heroImage" and "subtitle" on those same entries. One JSON file for
   all of it now, not two with overlapping page lists.

   Hooked to the 'nav-data-ready' event the nav-render IIFE (above)
   already dispatches once its own mc-contents.json fetch resolves,
   instead of a second fetch of the same file.

   Two things come from data.desktopSubNav.categories:

     1. This page's OWN hero banner (.hero-video's src) -- matched by
        comparing location.pathname's filename against each entry's
        link, same lookup highlightActiveNavItems() in thz-script.js
        already uses for the left nav's active state.
     2. The sidebar's "Browse Categories" cards, one per entry other
        than the current page (Web Tools has no heroImage/subtitle yet,
        so it's skipped rather than shown with missing content).

   Change an entry's "heroImage" here and that page's hero banner AND
   every sidebar card pointing at it update together, from one edit. */
function mcApplyHeroFromCategories(categories) {
  var heroImg = document.querySelector('.hero-video');
  if (!heroImg) return;

  var currentFile = location.pathname.split('/').pop();
  var entry = categories.find(function (c) { return c.link === currentFile; });
  if (entry && entry.heroImage) heroImg.src = entry.heroImage;
}

/* No fit-to-height limit -- every other category is listed, and
   .mc-sb-cat-list scrolls internally (see its own CSS comment) rather
   than hiding cards that don't fit. */
function mcRenderSidebarCategories(categories) {
  var list = document.getElementById('mcsbCatList');
  if (!list) return;

  var currentFile = location.pathname.split('/').pop();
  var entries = categories.filter(function (c) {
    return c.link !== currentFile && c.heroImage;
  });

  var wrap = list.closest ? list.closest('.mc-sb-cat') : null;
  if (!entries.length) {
    if (wrap) wrap.style.display = 'none';
    return;
  }
  if (wrap) wrap.style.display = '';

  list.innerHTML = entries.map(function (e) {
    return '<a class="mc-sb-cat-card" href="' + e.link + '">' +
      '<img class="mc-sb-cat-bg" src="' + e.heroImage + '" alt="">' +
      '<img class="mc-sb-cat-icon" src="' + e.image + '" alt="">' +
      '<span class="mc-sb-cat-arrow">↗</span>' +
      '<div class="mc-sb-cat-text">' +
        '<div class="mc-sb-cat-name">' + e.name + '</div>' +
        '<div class="mc-sb-cat-sub">' + e.subtitle + '</div>' +
      '</div>' +
    '</a>';
  }).join('');
}

document.addEventListener('nav-data-ready', function (e) {
  var categories = (e.detail && e.detail.desktopSubNav && e.detail.desktopSubNav.categories) || [];
  mcApplyHeroFromCategories(categories);
  mcRenderSidebarCategories(categories);
});

/* Scrollbar shows only while .mc-sb-cat-list is actually being
   scrolled -- .is-scrolling flips the thumb from transparent to
   visible (see its CSS) and clears itself 700ms after the last scroll
   event, the same idle-timeout pattern already used elsewhere on this
   page (the row-fade and broken-image re-scans). Wired once on
   DOMContentLoaded rather than at render time, since the list itself
   is rebuilt whenever mc-categories.json resolves and a listener on
   the container survives that innerHTML swap either way. */
(function mcWireSidebarCatScroll() {
  function wire() {
    var list = document.getElementById('mcsbCatList');
    if (!list) return;
    var t = null;
    list.addEventListener('scroll', function () {
      list.classList.add('is-scrolling');
      clearTimeout(t);
      t = setTimeout(function () { list.classList.remove('is-scrolling'); }, 700);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();


/* ══ PALETTE COLLAGE ═══════════════════════════════════════════════════════
   Arranges each .pal-grid into a Messenger-style collage: one large tile plus
   two to four smaller ones, with a "+N" badge on the last visible tile when
   the section holds more photos than the collage shows.

   Only the arrangement lives here. The shapes themselves are CSS, selected by
   the data-layout attribute this writes.

   Photos past the visible count are hidden with a class, not removed: the
   lightbox pages through the whole section, so the nodes have to stay. */

/* One big tile plus at most two beside it. The CSS describes shapes 1-5, so
   raising this is a one-line change if the collage should ever show more. */
var PAL_MAX_VISIBLE = 3;

/* The caption text is the card's own label. Cards used to carry
   data-name="Color Palette" for this, copy-pasted onto all fourteen of them
   including the ore chart and the food web, so it is not trusted. */
function palCardTitle(card) {
  var el = card.querySelector('.pal-card-label');
  if (el) return el.textContent.trim();
  // Generated tiles (the seed collages) carry no label of their own.
  var img = card.querySelector('img');
  return img ? (img.getAttribute('alt') || '') : '';
}

function palUpdateChrome() {
  var t = document.getElementById('pal-lb-title');
  var c = document.getElementById('pal-lb-count');
  if (t) t.textContent = palCurrentTitles[palCurrentIndex] || '';
  if (c) {
    c.textContent = palCurrentSlides.length > 1
      ? (palCurrentIndex + 1) + ' / ' + palCurrentSlides.length : '';
  }
}

function palBuildCollage(grid) {
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.pal-card'));
  if (!cards.length) return;

  var visible = Math.min(cards.length, PAL_MAX_VISIBLE);
  var hidden = cards.length - visible;
  grid.setAttribute('data-layout', String(visible));

  cards.forEach(function (card, i) {
    var shown = i < visible;
    card.classList.toggle('is-hidden', !shown);
    card.classList.toggle('pal-tile-main', shown && i === 0);

    // Rebuilt from scratch on every pass, so a resize cannot leave a stale
    // badge on a tile that is no longer last.
    var old = card.querySelector('.pal-more');
    if (old) old.remove();

    if (shown && hidden > 0 && i === visible - 1) {
      var more = document.createElement('div');
      more.className = 'pal-more';
      more.textContent = '+' + hidden;
      more.setAttribute('aria-hidden', 'true');
      var media = card.querySelector('.pal-card-media') || card;
      media.appendChild(more);
      // The tile still opens at its own photo; the lightbox arrows carry on
      // into the hidden ones from there.
      card.setAttribute('aria-label', palCardTitle(card) +
        ' \u2014 and ' + hidden + ' more');
    } else if (shown) {
      card.removeAttribute('aria-label');
    }
  });
}

/* ---- seed collages -------------------------------------------------------
   Each seed card used to be a one-image carousel: a single <img> whose src was
   swapped by arrows and a row of dots. The slides were never separate DOM
   nodes -- they live in window.seedSlides, keyed "sc1", "sc2", ...

   That data is what makes this cheap. Rather than writing 24 collages into
   mc-java-seeds.html, the tiles are generated from seedSlides and handed to
   the same palBuildCollage() Discover uses, so both pages share one layout
   implementation and one set of CSS rules.

   The seed number and title overlay stay exactly where they were. */
function seedBuildCollages() {
  if (!window.seedSlides) return;

  Object.keys(window.seedSlides).forEach(function (id) {
    var slider = document.getElementById(id + '-slider');
    if (!slider || slider.querySelector('.pal-grid')) return;

    var slides = window.seedSlides[id];
    if (!slides || !slides.length) return;

    var titleEl = slider.querySelector('.seed-card-title');
    var title = titleEl ? titleEl.textContent.trim() : '';

    var grid = document.createElement('div');
    grid.className = 'pal-grid';
    grid.dataset.seed = id;

    slides.forEach(function (src, i) {
      var card = document.createElement('div');
      card.className = 'pal-card';
      card.dataset.index = String(i);

      var media = document.createElement('div');
      media.className = 'pal-card-media';

      var img = document.createElement('img');
      img.src = src;
      img.alt = title;
      img.decoding = 'async';
      // The first tile is the card's hero and is often above the fold; the
      // rest can wait.
      if (i > 0) img.loading = 'lazy';

      media.appendChild(img);
      card.appendChild(media);
      card.addEventListener('click', function () { openPalette(card); });
      grid.appendChild(card);
    });

    // The old controls have no meaning once every slide is on screen. The
    // scrim and the number/title block stay.
    var oldImg = document.getElementById(id + '-img');
    if (oldImg) oldImg.remove();
    Array.prototype.forEach.call(
      slider.querySelectorAll('.seed-slider-arrow, .seed-slider-dots'),
      function (n) { n.remove(); });

    slider.insertBefore(grid, slider.firstChild);
    palBuildCollage(grid);
  });
}

(function palInitCollage() {
  function start() {
    // Seeds has no .pal-grid in its markup -- those grids are generated first.
    if (typeof mcOn === 'function' && mcOn('seeds')) seedBuildCollages();
    var grids = document.querySelectorAll('.pal-grid');
    if (!grids.length) return;
    Array.prototype.forEach.call(grids, palBuildCollage);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

/* ---- lightbox: keyboard and swipe -------------------------------------- */
document.addEventListener('keydown', function (e) {
  var lb = document.getElementById('pal-lightbox');
  if (!lb || !lb.classList.contains('open')) return;
  if (palCurrentSlides.length <= 1) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); palLightboxNav(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); palLightboxNav(-1); }
});

(function palWireSwipe() {
  var sx = 0, sy = 0, tracking = false;
  var lb = null;
  function el() { return lb || (lb = document.getElementById('pal-lightbox')); }

  document.addEventListener('touchstart', function (e) {
    var box = el();
    if (!box || !box.classList.contains('open')) return;
    // One finger only: two is a pinch-zoom, which the viewer handles itself.
    if (e.touches.length !== 1 || palScale > 1) { tracking = false; return; }
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (!tracking) return;
    tracking = false;
    if (palCurrentSlides.length <= 1) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - sx, dy = t.clientY - sy;
    // Ignore mostly-vertical drags so a scroll is never read as a page turn.
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    palLightboxNav(dx < 0 ? 1 : -1);
  }, { passive: true });
})();
