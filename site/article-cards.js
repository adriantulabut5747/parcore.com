// Article cards and feed, built from /articles.json (styles: article-cards.css).
//   <div class="art-track" id="X" data-game="coc">  -> horizontal strip of cards
//        + data-live (written ones only), data-order="random" (shuffled per visit)
//   <div class="art-feed" data-game="coc|all">       -> stacked feed rows (/articles/)
//   <input id="artSearch">                           -> filters the feed as you type
//   <div id="artFilters">                            -> game chips (built here, one per game with articles)
//   <details id="apToc">                             -> article contents + scroll-spy
//   <div class="art-next" data-article="<id>">       -> "Read next" card for another article
//   <div class="art-nav" data-for="X">‹ ›</div>      -> scrolls strip X one card at a time
//   <article class="ap">                             -> right column (.ap-side: contents) and 4 random
//                                                       "Related articles" at the bottom, from the address
//   <div class="art-spot" data-game="coc">          -> newest live article big + the next three as rows (/coc/)
//   <span class="art-spot-count" data-game="coc">   -> "All N articles"
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
      (badge ? `<div class="art-chips"><span class="art-cat">${esc(a.category)}</span>` +
        (a.status !== 'live' ? '<span class="art-soon">Coming soon</span>' : '') + '</div>' : '') + '</div>';
  }

  // Strip card: Parcore watermark on the picture's top left, category (and
  // "Coming soon") top right; title, dek and month under it. No game name --
  // strips only sit on their own game's page (Adrian, Oct 2026).
  function card(a) {
    const date = a.status === 'live' && a.date ? `<time class="art-date" datetime="${esc(a.date)}">${fmtDate(a.date)}</time>` : '';
    return shell(a, 'art-card',
      media(a, 'art-media').replace('<div class="art-chips">', '<span class="as-wm"><img src="/icons/home.jpg" alt=""><span>Parcore</span></span><div class="art-chips">') +
      `<div class="art-body"><h3 class="art-title">${esc(a.title)}</h3><p class="art-dek">${esc(a.dek)}</p>${date}</div>`);
  }
  // Fisher-Yates: data-order="random" strips come out in a new order every visit.
  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  // Feed row (ONE Esports-style list): picture left; title with the
  // category tag at its top right; dek; then game (and month for live ones)
  // in a quiet line. Coming-soon rows are told apart by their dimmed look,
  // no label (Adrian's pick).
  function row(a, gameName) {
    const meta = esc(gameName) + (a.status === 'live' && a.date ? ` · <time datetime="${esc(a.date)}">${fmtDate(a.date)}</time>` : '');
    // The category also goes on the picture (top right): phones show that
    // one, desktop the one beside the title (article-cards.css).
    const cat = `<span class="art-row-cat">${esc(a.category)}</span>`;
    return shell(a, 'art-row',
      media(a, 'art-row-media', false).replace(/<\/div>$/, cat + '</div>') +
      `<div class="art-row-body"><div class="art-row-top"><h2 class="art-title">${esc(a.title)}</h2><span class="art-tag">${esc(a.category)}</span></div>` +
      `<p class="art-dek">${esc(a.dek)}</p><p class="art-row-meta">${meta}</p></div>`);
  }

  // Hub lead (/articles/ #artLead): the newest live article as a cover, the
  // next three as compact rows beside it. Its picture also tints the page
  // behind it (--lead-img, articles.css). Returns how many it shows.
  function lead(el, live, games) {
    const top = live.slice(0, 4);
    if (!top.length) return 0;
    const [a, ...rest] = top;
    const game = (x) => esc((games[x.game] || {}).name || x.game);
    const when = (x) => (x.date ? ` · <time datetime="${esc(x.date)}">${fmtDate(x.date)}</time>` : '');
    el.style.setProperty('--lead-img', `url("${esc(a.image)}")`);
    el.innerHTML =
      `<a class="ah-cover" href="${esc(a.link)}"><div class="ah-cover-media"><img src="${esc(a.image)}" alt="" fetchpriority="high" decoding="async">` +
      `<span class="art-row-cat">${esc(a.category)}</span></div>` +
      `<div class="ah-cover-body"><h2>${esc(a.title)}</h2><p class="ah-cover-dek">${esc(a.dek)}</p>` +
      `<p class="art-row-meta">${game(a)}${when(a)}</p></div></a>` +
      (rest.length ? '<div class="ah-also"><h2>Also new</h2><ul>' + rest.map((x) =>
        `<li><a href="${esc(x.link)}"><span class="ah-also-media"><img src="${esc(x.image)}" alt="" decoding="async"></span>` +
        `<span class="ah-also-body"><span class="ah-also-title">${esc(x.title)}</span>` +
        `<span class="art-row-meta"><span class="art-tag">${esc(x.category)}</span>${when(x)}</span></span></a></li>`).join('') +
        '</ul></div>' : '');
    return top.length;
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
    // The lead block takes the first items (newest live ones) and always stays;
    // the grid skips them until a filter or search is on, then lists every match.
    const leadEl = document.getElementById('artLead');
    const nLead = leadEl ? lead(leadEl, live, games) : 0;
    const head = document.getElementById('artFeedHead');

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
      const plain = game === 'all' && !q;
      let shown = 0;
      rows.forEach((r, i) => {
        const hit = (game === 'all' || items[i].game === game) && (!q || q.split(/\s+/).every((w) => text[i].includes(w)));
        r.hidden = !hit || (plain && i < nLead);
        shown += !r.hidden;
      });
      if (leadEl) leadEl.hidden = !nLead;
      if (head) head.textContent = plain && nLead ? 'More articles' : q ? `${shown} result${shown === 1 ? '' : 's'}` : 'All articles';
      if (empty) {
        empty.hidden = shown > 0 || (plain && nLead > 0);
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

  // Article page: wrap the contents in the right column now (not after the
  // fetch) so the layout doesn't jump.
  const art = document.querySelector('article.ap');
  let side = null;
  if (art && toc) {
    // .ap-side is the column (ends with the article body); the sticky panel
    // inside it stops there instead of sliding over the bottom sections.
    const col = document.createElement('div');
    col.className = 'ap-side';
    side = document.createElement('div');
    side.className = 'ap-panel';
    toc.before(col);
    col.append(side);
    side.append(toc);
    // Scrollbar shows only while the panel is being scrolled (articles.css).
    let hideBar;
    side.addEventListener('scroll', () => {
      side.classList.add('is-scrolling');
      clearTimeout(hideBar);
      hideBar = setTimeout(() => side.classList.remove('is-scrolling'), 900);
    }, { passive: true });
  }

  // The article's own game and id come from its address: /articles/<game>/<id>.
  function articleExtras(all) {
    const [, , game, id] = location.pathname.replace(/\.html$/, '').split('/');
    const others = all.filter((a) => a.game === game && a.status === 'live' && a.id !== id);
    if (!others.length) return;
    const img = (a) => `<img src="${esc(a.image)}" alt="" loading="lazy" decoding="async">`;
    // Related: 4 random ones from the same game, a new pick every visit
    // (file order doesn't matter). Phones show them 2x2 (articles.css).
    const latest = document.createElement('section');
    latest.className = 'ap-latest';
    latest.innerHTML = '<h2>Related articles</h2><div class="ap-latest-list">' + shuffle(others.slice()).slice(0, 4).map((a) =>
      `<a href="${esc(a.link)}">${img(a)}<h3>${esc(a.title)}</h3>` +
      `<span class="ap-latest-meta">${esc(a.category)}${a.date ? ' · ' + fmtDate(a.date) : ''}</span></a>`).join('') + '</div>';
    art.append(latest);
  }

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

  // Spotlight (the /coc/ lobby): the newest live article big on the left with
  // its category on the picture ("New ·" for two weeks after its date), the
  // next three as rows on the right. Ties on date keep file order.
  function spot(el, list) {
    const live = list.filter((a) => a.status === 'live').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (!live.length) return;
    // "lead": true in articles.json pins an article to the top here only
    // (the /articles/ feed and the strips keep their own order).
    const pin = live.findIndex((a) => a.lead);
    if (pin > 0) live.unshift(live.splice(pin, 1)[0]);
    const [f, ...rest] = live;
    const fresh = f.date && Date.now() - new Date(f.date + 'T00:00:00') < 14 * 864e5;
    el.innerHTML =
      `<a class="as-feat" href="${esc(f.link)}"><div class="as-feat-media"><img src="${esc(f.image)}" alt="" loading="lazy" decoding="async">` +
      '<span class="as-wm"><img src="/icons/home.jpg" alt=""><span>Parcore</span></span>' +
      `<span class="as-label">${fresh ? 'New · ' : ''}${esc(f.category)}</span></div>` +
      `<div class="as-feat-body"><h3 class="as-feat-title">${esc(f.title)}</h3><p class="as-feat-dek">${esc(f.dek)}</p></div></a>` +
      // The lead again as a plain row: phones show this instead of the big picture.
      '<div class="as-list">' + [f].concat(rest.slice(0, 3)).map((a, i) =>
        `<a class="as-row${i ? '' : ' as-row--lead'}" href="${esc(a.link)}"><span class="as-row-media"><img src="${esc(a.image)}" alt="" loading="lazy" decoding="async">` +
        '<span class="as-wm"><img src="/icons/home.jpg" alt=""></span></span>' +
        `<div class="as-row-body"><span class="as-row-cat">${esc(a.category)}</span><h3 class="as-row-title">${esc(a.title)}</h3></div></a>`).join('') + '</div>';
  }

  const strips = document.querySelectorAll('.art-track[data-game]');
  const spots = document.querySelectorAll('.art-spot[data-game]');
  const feeds = document.querySelectorAll('.art-feed[data-game]');
  const nexts = document.querySelectorAll('.art-next[data-article]');
  if (!strips.length && !spots.length && !feeds.length && !nexts.length && !art) {
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
        // data-live: written articles only (no greyed "Coming soon" cards).
        let list = pick(el.dataset.game).filter((a) => !('live' in el.dataset) || a.status === 'live');
        if (el.dataset.order === 'random') list = shuffle(list.slice());
        el.innerHTML = list.map(card).join('');
      });
      spots.forEach((el) => spot(el, pick(el.dataset.game)));
      document.querySelectorAll('.art-spot-count[data-game]').forEach((el) => {
        el.textContent = 'All ' + pick(el.dataset.game).length + ' articles';
      });
      feeds.forEach((el) => feed(el, pick(el.dataset.game), games));
      nexts.forEach((el) => {
        const a = all.find((x) => x.id === el.dataset.article);
        if (a) next(el, a, (games[a.game] || {}).name || a.game);
      });
      if (art) articleExtras(all);
      document.querySelectorAll('.art-nav[data-for]').forEach(arrows);
    })
    .catch((err) => console.error('articles.json failed to load:', err));
})();

// "View all" under a long article table (.ap-rows): opens the hidden rows.
document.querySelectorAll('.ap-rows-more').forEach((btn) => {
  const box = document.getElementById(btn.getAttribute('aria-controls'));
  if (!box) return;
  btn.addEventListener('click', () => {
    const open = box.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open);
    btn.textContent = open ? 'Show fewer' : btn.dataset.more;
  });
});
