// Article cards and feed, built from /articles.json (styles: article-cards.css).
//   <div class="art-track" id="X" data-game="coc">  -> horizontal strip of cards
//   <div class="art-feed" data-game="coc|all">       -> stacked feed rows (/articles/)
//   <input id="artSearch">                           -> filters the feed as you type
//   <div id="artFilters">                            -> game chips (built here, one per game with articles)
//   <details id="apToc">                             -> article contents + scroll-spy
//   <div class="art-next" data-article="<id>">       -> "Read next" card for another article
//   <div class="art-nav" data-for="X">‹ ›</div>      -> scrolls strip X one card at a time
(function () {
  const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  // Month + year only ("Oct 2026"): articles say when, not the exact day (Adrian's rule).
  const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  // Live = a link; soon = a greyed block with the badge.
  function shell(a, cls, inner) {
    const soon = a.status !== 'live';
    return soon
      ? `<div class="${cls} is-soon">${inner}</div>`
      : `<a class="${cls}" href="${esc(a.link)}">${inner}</a>`;
  }
  function media(a, cls, badge = true) {
    return `<div class="${cls}"><img src="${esc(a.image)}" alt="" loading="lazy" decoding="async">` +
      (badge && a.status !== 'live' ? '<span class="art-soon">Coming soon</span>' : '') + '</div>';
  }

  function card(a, gameName) {
    return shell(a, 'art-card',
      media(a, 'art-media') +
      `<div class="art-body"><div class="art-eyebrow"><span class="art-game">${esc(gameName)}</span><span class="art-tag">${esc(a.category)}</span></div>` +
      `<h3 class="art-title">${esc(a.title)}</h3><p class="art-dek">${esc(a.dek)}</p></div>`);
  }

  // Feed row (ONE Esports-style list): picture left; title with the
  // category tag at its top right; dek; then game (and month for live ones)
  // in a quiet line. Coming-soon rows are told apart by their dimmed look,
  // no label (Adrian's pick).
  function row(a, gameName) {
    const meta = esc(gameName) + (a.status === 'live' && a.date ? ` · <time datetime="${esc(a.date)}">${fmtDate(a.date)}</time>` : '');
    return shell(a, 'art-row',
      media(a, 'art-row-media', false) +
      `<div class="art-row-body"><div class="art-row-top"><h2 class="art-title">${esc(a.title)}</h2><span class="art-tag">${esc(a.category)}</span></div>` +
      `<p class="art-dek">${esc(a.dek)}</p><p class="art-row-meta">${meta}</p></div>`);
  }

  function arrows(nav) {
    const track = document.getElementById(nav.dataset.for);
    const [prev, next] = nav.querySelectorAll('button');
    if (!track || !prev || !next) return;
    const step = () => (track.firstElementChild ? track.firstElementChild.offsetWidth : 0) + parseFloat(getComputedStyle(track).columnGap || 0);
    const sync = () => {
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft > track.scrollWidth - track.clientWidth - 4;
    };
    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }

  function feed(el, list, games) {
    const search = document.getElementById('artSearch');
    const filters = document.getElementById('artFilters');
    const empty = document.getElementById('artEmpty');
    // Live first, newest first; then the coming-soon ones in file order.
    const live = list.filter((a) => a.status === 'live').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const items = live.concat(list.filter((a) => a.status !== 'live'));
    el.innerHTML = items.map((a) => row(a, (games[a.game] || {}).name || a.game)).join('');
    const rows = [...el.children];
    const text = items.map((a) => [a.title, a.dek, a.category, (games[a.game] || {}).name].join(' ').toLowerCase());
    const params = new URLSearchParams(location.search);
    let game = params.get('game') || 'all';

    // Game chips: "All" + one per game that has at least one article, plus
    // the game in the address if it has none yet (the bottom nav's related
    // game links here: "No Clash Royale articles yet.").
    if (filters) {
      const keys = [...new Set(items.map((a) => a.game))];
      if (game !== 'all' && !keys.includes(game)) {
        if (games[game]) keys.push(game); else game = 'all';
      }
      const count = (k) => items.filter((a) => k === 'all' || a.game === k).length;
      filters.innerHTML = ['all'].concat(keys).map((k) =>
        `<button type="button" data-game="${esc(k)}" aria-pressed="${k === game}">${esc(k === 'all' ? 'All' : (games[k] || {}).name || k)}<span>${count(k)}</span></button>`).join('');
      filters.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        game = b.dataset.game;
        filters.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
        // Keep the choice in the address so a shared or reloaded link keeps it.
        const u = new URL(location.href);
        if (game === 'all') u.searchParams.delete('game'); else u.searchParams.set('game', game);
        history.replaceState(null, '', u);
        run();
      });
    }

    function run() {
      const q = search ? search.value.trim().toLowerCase() : '';
      let shown = 0;
      rows.forEach((r, i) => {
        const hit = (game === 'all' || items[i].game === game) && (!q || q.split(/\s+/).every((w) => text[i].includes(w)));
        r.hidden = !hit;
        shown += hit;
      });
      if (empty) {
        empty.hidden = shown > 0;
        empty.textContent = shown ? '' : q ? `No articles match "${search.value.trim()}".`
          : `No ${game !== 'all' && games[game] ? games[game].name + ' ' : ''}articles yet.`;
      }
    }
    if (search) {
      search.addEventListener('input', run);
      if (params.get('q')) search.value = params.get('q');
      if (params.has('search')) search.focus();
    }
    run();
  }

  // Table of contents: scroll-spy, same approach as Web Resources'
  // (hwr-js.js initHwrScrollSpy): the section crossing the top band of the
  // screen gets .is-current, in the page's list and in the phone dropdown
  // (#apTocMenu, a copy of the list behind the bar's button). Blank above
  // the first section.
  function scrollSpy(toc) {
    const menu = document.getElementById('apTocMenu');
    const btn = document.getElementById('apTocBtn');
    if (menu) menu.innerHTML = '<div class="ap-toc-menu-label">Table of contents</div>' + toc.querySelector('ol').outerHTML;
    const links = [...document.querySelectorAll('#apToc a[href^="#"], #apTocMenu a[href^="#"]')];
    const byId = {};
    links.forEach((a) => (byId[a.getAttribute('href').slice(1)] = byId[a.getAttribute('href').slice(1)] || []).push(a));
    const sections = Object.keys(byId).map((id) => document.getElementById(id)).filter(Boolean);
    let current = null;
    const setCurrent = (id) => {
      if (id === current) return;
      if (current) byId[current].forEach((a) => a.classList.remove('is-current'));
      current = id;
      if (current) byId[current].forEach((a) => a.classList.add('is-current'));
    };
    if (sections.length && typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setCurrent(e.target.id); });
      }, { rootMargin: '-10% 0px -75% 0px', threshold: 0 });
      sections.forEach((s) => io.observe(s));
      const head = document.querySelector('.ap-header');
      if (head) {
        new IntersectionObserver((entries) => {
          entries.forEach((e) => { if (e.isIntersecting && e.boundingClientRect.top > -1) setCurrent(null); });
        }, { rootMargin: '-10% 0px -75% 0px', threshold: 0 }).observe(head);
      }
    }

    // Phone dropdown: the button toggles it; a link, a tap outside or Esc closes it.
    if (menu && btn) {
      const setOpen = (open) => { menu.hidden = !open; btn.setAttribute('aria-expanded', open); };
      btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(menu.hidden); });
      menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
      document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) setOpen(false); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); } });
    }
    // In-page box on phones: tapping a link closes it.
    toc.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => { if (!matchMedia('(min-width: 971px)').matches) toc.open = false; }));
  }
  const toc = document.getElementById('apToc');
  if (toc) scrollSpy(toc);

  // "Read next" card inside an article: one row pointing at another article.
  // Greyed with "Coming soon" until that article is live, then a link.
  function next(el, a, gameName) {
    const label = el.dataset.label || 'Read next';
    const live = a.status === 'live';
    el.innerHTML = (live ? `<a class="art-next-card" href="${esc(a.link)}">` : '<div class="art-next-card is-soon">') +
      `<div class="art-next-media"><img src="${esc(a.image)}" alt="" loading="lazy" decoding="async"></div>` +
      `<div class="art-next-body"><span class="art-next-label">${esc(label)}${live ? '' : ' · Coming soon'}</span>` +
      `<strong>${esc(a.title)}</strong><span>${esc(gameName)} · ${esc(a.dek)}</span></div>` +
      (live ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>' : '</div>');
  }

  const strips = document.querySelectorAll('.art-track[data-game]');
  const feeds = document.querySelectorAll('.art-feed[data-game]');
  const nexts = document.querySelectorAll('.art-next[data-article]');
  if (!strips.length && !feeds.length && !nexts.length) {
    document.querySelectorAll('.art-nav[data-for]').forEach(arrows);
    return;
  }

  fetch('/articles.json')
    .then((r) => r.json())
    .then((data) => {
      const games = data.games || {};
      const all = (data.articles || []).map((a) => Object.assign({ link: '/articles/' + a.game + '/' + a.id }, a));
      const pick = (g) => (g === 'all' ? all : all.filter((a) => a.game === g));
      strips.forEach((el) => {
        el.innerHTML = pick(el.dataset.game).map((a) => card(a, (games[a.game] || {}).name || a.game)).join('');
      });
      feeds.forEach((el) => feed(el, pick(el.dataset.game), games));
      nexts.forEach((el) => {
        const a = all.find((x) => x.id === el.dataset.article);
        if (a) next(el, a, (games[a.game] || {}).name || a.game);
      });
      document.querySelectorAll('.art-nav[data-for]').forEach(arrows);
    })
    .catch((err) => console.error('articles.json failed to load:', err));
})();
