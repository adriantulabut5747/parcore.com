// Article cards and feed, built from /articles.json (styles: article-cards.css).
//   <div class="art-track" id="X" data-game="coc">  -> horizontal strip of cards
//        + data-live (written ones only), data-order="random" (shuffled per visit)
//          or data-order="json" (slides keep articles.json's order, not newest first)
//   <div class="art-feed" data-game="coc|all">       -> stacked feed rows (/articles/)
//   <input id="artSearch">                           -> filters the feed as you type
//   <div id="artFilters">                            -> game chips (built here, one per game with articles)
//   <details id="apToc">                             -> article contents + scroll-spy
//   <div class="art-next" data-article="<id>">       -> "Read next" card for another article
//        + data-variant="slide": borderless slides, category | month over the title (/coc/ lobby)
//   <div class="art-nav" data-for="X">‹ ›</div>      -> scrolls strip X one card at a time
//   <div class="art-progress" data-for="X"><span>    -> line that fills as strip X scrolls (optional)
//   <article class="ap">                             -> right column (.ap-side: contents) and 4 random
//                                                       "Related articles" at the bottom, from the address
//   <span class="art-spot-count" data-game="coc">   -> "All N articles"
(function () {
  const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  // Month + year only ("Oct 2026"): articles say when, not the exact day (Adrian's rule).
  const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  // Parcore watermark chip (favicon + name), top left of strip pictures.
  const WM = '<span class="asp-wm"><img src="/icons/home.jpg" alt=""><span>Parcore</span></span>';

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
  // "Coming soon") top right; title and month under it. No game name --
  // strips only sit on their own game's page (Adrian, Oct 2026).
  function card(a) {
    const date = a.status === 'live' && a.date ? `<time class="art-date" datetime="${esc(a.date)}">${fmtDate(a.date)}</time>` : '';
    return shell(a, 'art-card',
      media(a, 'art-media').replace('<div class="art-chips">', WM + '<div class="art-chips">') +
      `<div class="art-body"><h3 class="art-title">${esc(a.title)}</h3>${date}</div>`);
  }
  // Strip slide (Adrian, Oct 21 2026): the picture wears the tags (Parcore
  // chip top left, red category top right); under it the title, then
  // "Oct 2026 · Clash of Clans". No dek -- kept short on purpose.
  function slide(a, gameName) {
    // Not written yet (no data-live on the strip, e.g. /minecraft/java/): a
    // greyed block, not a link; the "Coming soon" chip on the picture says so.
    const soon = a.status !== 'live';
    const date = !soon && a.date ? `<time datetime="${esc(a.date)}">${fmtDate(a.date)}</time>` : '';
    return shell(a, 'art-slide',
      media(a, 'art-row-media').replace('<div class="art-chips">', WM + '<div class="art-chips">') +
      `<h3 class="art-title">${esc(a.title)}</h3>` +
      `<p class="art-slide-foot">${date}${date && gameName ? '<span aria-hidden="true">·</span>' : ''}${gameName ? esc(gameName) : ''}</p>`);
  }
  // Fisher-Yates: data-order="random" strips come out in a new order every visit.
  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  // Articles this browser has opened: article pages add their id, the hub
  // marks those cards "Read" (Oct 26 2026). Private mode / blocked storage =
  // nothing is marked, nothing breaks.
  const READ_KEY = 'art-read';
  function readSet() {
    try { return new Set(JSON.parse(localStorage.getItem(READ_KEY)) || []); } catch (e) { return new Set(); }
  }
  const READ_MARK = '<span class="art-read-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>Read</span>';
  const mins = (a) => (a.read ? ` · ${a.read} min read` : '');
  const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // Card text (Oct 26 2026, Adrian: no deks anywhere): under the title a grey
  // "Clash of Clans · Guide" line, then "Published Oct 2026" -- or "Updated
  // Nov 2026" once articles.json has an "updated" date -- and the read time.
  const tagLine = (a, gameName) => `<p class="art-row-tags">${esc(gameName)} · ${esc(a.category)}</p>`;
  function dateLine(a) {
    if (a.status !== 'live') return '';
    const d = a.updated || a.date;
    const when = d ? `${a.updated ? 'Updated' : 'Published'} <time datetime="${esc(d)}">${fmtDate(d)}</time>` : '';
    const read = a.read ? `${a.read} min read` : '';
    return when || read ? `<p class="art-row-meta">${when}${when && read ? ' · ' : ''}${read}</p>` : '';
  }

  // Feed card (/articles/ grid): picture (Parcore watermark top left,
  // category top right), title, the tag line, the date line. Coming-soon
  // cards are told apart by their dimmed look, no label (Adrian's pick).
  function row(a, gameName, read) {
    const cat = `<span class="art-row-cat">${esc(a.category)}</span>` + (read ? READ_MARK : '');
    return shell(a, 'art-row' + (read ? ' is-read' : ''),
      media(a, 'art-row-media', false).replace(/<\/div>$/, cat + '</div>') +
      `<div class="art-row-body"><h2 class="art-title">${esc(a.title)}</h2>${tagLine(a, gameName)}${dateLine(a)}</div>`);
  }

  // Hot right now (/articles/ #artLead, Oct 26 2026): articles.json hub.hot
  // in order, each with a red HOT tag; the first is the big box on the left,
  // the rest a 2x2 beside it (articles.css "HOT RIGHT NOW"). The big one's
  // picture also tints the page behind it (--lead-img).
  function hot(el, list, games, read) {
    if (!list.length) return;
    el.style.setProperty('--lead-img', `url("${esc(list[0].image)}")`);
    el.innerHTML = '<div class="ah-feed-head"><h2 id="artHotHead">Hot right now</h2></div><div class="ah-hot">' +
      list.map((a, i) => {
        const r = read.has(a.id);
        return `<a class="ah-hot-card${i ? '' : ' is-big'}${r ? ' is-read' : ''}" href="${esc(a.link)}">` +
          `<span class="ah-hot-media"><img src="${esc(a.image)}" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">` +
          `<span class="ah-hot-tag">Hot</span>${r ? READ_MARK : ''}</span>` +
          `<span class="ah-hot-body"><h3 class="art-title">${esc(a.title)}</h3>` +
          tagLine(a, (games[a.game] || {}).name || a.game) + dateLine(a) +
          (i ? '' : '<span class="ah-hot-go">Read now<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>') +
          '</span></a>';
      }).join('') + '</div>';
    el.setAttribute('aria-labelledby', 'artHotHead');
  }

  function arrows(nav) {
    const track = document.getElementById(nav.dataset.for);
    const [prev, next] = nav.querySelectorAll('button');
    if (!track || !prev || !next) return;
    // One card = the distance between two cards' starts. (Reading columnGap
    // broke on phones: there it computes to a calc() string, parseFloat gave
    // NaN, and scrollBy(NaN) did nothing.)
    const step = () => {
      const [a, b] = track.children;
      return a ? (b ? b.offsetLeft - a.offsetLeft : a.offsetWidth) : 0;
    };
    // Progress line (Adrian, Oct 21 2026): empty on the first card; one card
    // in it shows the share on screen (what used to be the starting fill),
    // then grows evenly to full at the last card.
    const bar = document.querySelector(`.art-progress[data-for="${nav.dataset.for}"] span`);
    const sync = () => {
      const max = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft > max - 4;
      if (!bar || !track.scrollWidth) return;
      const i = step() ? track.scrollLeft / step() : 0; // cards scrolled past
      const n = step() ? max / step() : 0; // cards it takes to reach the end
      const first = track.clientWidth / track.scrollWidth;
      let fill = n <= 0 ? 1 : i < 1 ? i * first : n <= 1 ? 1 : first + ((1 - first) * (i - 1)) / (n - 1);
      if (track.scrollLeft > max - 4 || i > n - 0.02) fill = 1;
      bar.style.transform = `scaleX(${Math.max(0, Math.min(1, fill))})`;
    };
    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }

  // Hub stats under the band title (#artStats): real counts from the JSON,
  // plus "N/M read by you" once this browser has opened any.
  function stats(el, live, read) {
    const n = live.length;
    const games = new Set(live.map((a) => a.game)).size;
    const total = live.reduce((t, a) => t + (a.read || 0), 0);
    const done = live.filter((a) => read.has(a.id)).length;
    el.innerHTML =
      '<span class="ah-by"><img src="/icons/parcore-avatar.webp" alt="" decoding="async">Written by <b>Parcore</b></span>' +
      `<span><b>${n}</b> article${n === 1 ? '' : 's'}</span><span><b>${games}</b> game${games === 1 ? '' : 's'}</span>` +
      (total ? `<span><b>${total}</b> min of reading</span>` : '') +
      (done ? `<span class="ah-you"><b>${done}/${n}</b> read by you</span>` : '');
    el.hidden = false;
  }

  // "Browse by game" (#artGameTiles): one wide tile per game with live
  // articles, the home page's Featured Games art (articles.json games.tile).
  // A tile is a real link (?game=…#all); here it just picks that chip.
  function gameTiles(el, live, soon, games) {
    const keys = [...new Set(live.map((a) => a.game))];
    el.innerHTML = keys.map((k) => {
      const g = games[k] || {};
      const n = live.filter((a) => a.game === k).length;
      const s = soon.filter((a) => a.game === k).length;
      return `<a class="ah-game" href="/articles/?game=${esc(k)}#all" data-game="${esc(k)}"${g.glow ? ` style="--glow:${esc(g.glow)}"` : ''}>` +
        (g.tile ? `<img class="ah-game-art" src="${esc(g.tile)}" alt="" loading="lazy" decoding="async">` : '') +
        (g.icon ? `<img class="ah-game-icon" src="${esc(g.icon)}" alt="" loading="lazy" decoding="async">` : '') +
        `<span class="ah-game-meta"><span class="ah-game-name">${esc(g.name || k)}</span>` +
        `<span class="ah-game-sub">${n} article${n === 1 ? '' : 's'}${s ? ` · ${s} coming` : ''}</span></span></a>`;
    }).join('');
    const wrap = el.closest('section');
    if (wrap) wrap.hidden = !keys.length;
  }

  // "Coming next" row: game icon, title, "Minecraft · Seeds". Not a link,
  // and no picture: unwritten articles only have placeholder art.
  function soonRow(a, games) {
    const g = games[a.game] || {};
    return '<li class="ah-soon-item">' +
      (g.icon ? `<img class="ah-soon-icon" src="${esc(g.icon)}" alt="" loading="lazy" decoding="async">` : '') +
      `<span class="ah-soon-body"><span class="ah-soon-title">${esc(a.title)}</span>` +
      `<span class="ah-soon-sub">${esc(g.name || a.game)} · ${esc(a.category)}</span></span></li>`;
  }

  function feed(el, list, games, hub) {
    const search = document.getElementById('artSearch');
    const filters = document.getElementById('artFilters');
    const types = document.getElementById('artTypes');
    const empty = document.getElementById('artEmpty');
    const soonEl = document.getElementById('artSoon');
    const read = readSet();
    const name = (a) => (games[a.game] || {}).name || a.game;
    // Live first, newest first; then the coming-soon ones in file order.
    const live = list.filter((a) => a.status === 'live').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    // "lead": true in articles.json pins an article to the top (the cover) here too.
    const pin = live.findIndex((a) => a.lead);
    if (pin > 0) live.unshift(live.splice(pin, 1)[0]);
    const soon = list.filter((a) => a.status !== 'live');
    // /articles/ (it has #artLead): articles.json "hub" picks the Hot right
    // now boxes and the grid's opening cards; the rest stay newest first.
    const leadEl = document.getElementById('artLead');
    const byId = (ids) => (ids || []).map((id) => live.find((a) => a.id === id)).filter(Boolean);
    const hotList = leadEl ? byId(hub.hot) : [];
    const first = leadEl ? byId(hub.first) : [];
    if (first.length) live.splice(0, live.length, ...first, ...live.filter((a) => !first.includes(a)));
    // A page with a "Coming next" list (/articles/) keeps the grid to live
    // articles; elsewhere (/articles/coc/) the soon ones stay in it, dimmed.
    const items = soonEl ? live : live.concat(soon);
    el.innerHTML = items.map((a) => row(a, name(a), read.has(a.id))).join('');
    const rows = [...el.children];
    const textOf = (a) => [a.title, a.category, name(a)].join(' ').toLowerCase();
    const text = items.map(textOf);
    let soonRows = [];
    if (soonEl) {
      soonEl.innerHTML = soon.map((a) => soonRow(a, games)).join('');
      soonRows = [...soonEl.children];
    }
    const soonWrap = soonEl && soonEl.closest('section');
    const params = new URLSearchParams(location.search);
    let game = params.get('game') || 'all';
    let type = params.get('type') || 'all';
    // The Hot boxes always stay; the grid skips them until a filter or search
    // is on, then lists every match.
    if (leadEl) hot(leadEl, hotList, games, read);
    const nLead = hotList.length;
    const inHot = new Set(hotList);
    const head = document.getElementById('artFeedHead');
    const statsEl = document.getElementById('artStats');
    if (statsEl) stats(statsEl, live, read);
    const tilesEl = document.getElementById('artGameTiles');
    if (tilesEl) gameTiles(tilesEl, live, soon, games);

    // Keep the choices in the address so a shared or reloaded link keeps them.
    const remember = (key, value) => {
      const u = new URL(location.href);
      if (value === 'all') u.searchParams.delete(key); else u.searchParams.set(key, value);
      history.replaceState(null, '', u);
    };
    const press = (box, attr, value) =>
      box.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x.dataset[attr] === value));

    // Game chips: "All" + one per game that has at least one article, plus
    // the game in the address if it has none yet (the bottom nav's related
    // game links here: "No Clash Royale articles yet.").
    if (filters) {
      const keys = [...new Set(items.concat(soon).map((a) => a.game))];
      if (game !== 'all' && !keys.includes(game)) {
        if (games[game]) keys.push(game); else game = 'all';
      }
      const count = (k) => items.filter((a) => k === 'all' || a.game === k).length;
      filters.innerHTML = ['all'].concat(keys).map((k) =>
        `<button type="button" data-game="${esc(k)}" aria-pressed="${k === game}">${esc(k === 'all' ? 'All games' : (games[k] || {}).name || k)}<span>${count(k)}</span></button>`).join('');
      filters.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        game = b.dataset.game;
        press(filters, 'game', game);
        remember('game', game);
        run();
      });
    }
    // Type chips (Guide, Tier List, Event…): the categories of the listed
    // articles; counts follow the picked game, empty ones grey out.
    const cats = [...new Set(items.map((a) => a.category))];
    if (type !== 'all' && !cats.some((c) => slug(c) === type)) type = 'all';
    if (types) {
      types.innerHTML = ['all'].concat(cats).map((c) => {
        const k = c === 'all' ? 'all' : slug(c);
        return `<button type="button" data-type="${esc(k)}" aria-pressed="${k === type}">${esc(c === 'all' ? 'All types' : c)}<span></span></button>`;
      }).join('');
      types.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        type = b.dataset.type;
        press(types, 'type', type);
        remember('type', type);
        run();
      });
    }
    // Game tiles pick their chip, then bring the grid into view.
    if (tilesEl && filters) {
      tilesEl.addEventListener('click', (e) => {
        const t = e.target.closest('.ah-game');
        const chip = t && filters.querySelector(`button[data-game="${t.dataset.game}"]`);
        if (!chip || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        chip.click();
        const all = document.getElementById('all');
        if (all) all.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      });
    }

    function run() {
      const q = search ? search.value.trim().toLowerCase() : '';
      const words = q ? q.split(/\s+/) : [];
      const inGame = (a) => game === 'all' || a.game === game;
      const inType = (a) => type === 'all' || slug(a.category) === type;
      const hits = (t) => words.every((w) => t.includes(w));
      const plain = game === 'all' && type === 'all' && !q;
      let shown = 0;
      rows.forEach((r, i) => {
        r.hidden = !(inGame(items[i]) && inType(items[i]) && hits(text[i])) || (plain && inHot.has(items[i]));
        shown += !r.hidden;
      });
      if (types) {
        types.querySelectorAll('button').forEach((b) => {
          const k = b.dataset.type;
          const n = items.filter((a) => inGame(a) && (k === 'all' || slug(a.category) === k)).length;
          b.lastChild.textContent = n;
          b.disabled = !n && k !== type;
        });
      }
      // Coming next follows the game chip and the search, not the type.
      let soonShown = 0;
      soonRows.forEach((r, i) => {
        r.hidden = !(inGame(soon[i]) && hits(textOf(soon[i])));
        soonShown += !r.hidden;
      });
      if (soonWrap) soonWrap.hidden = !soonShown;
      if (leadEl) leadEl.hidden = !nLead;
      if (head) head.textContent = plain && nLead ? 'More articles' : q ? `${shown} result${shown === 1 ? '' : 's'}` : 'All articles';
      if (empty) {
        empty.hidden = shown > 0 || (plain && nLead > 0);
        const cat = type !== 'all' ? (cats.find((c) => slug(c) === type) || '') + ' ' : '';
        empty.textContent = shown ? '' : q ? `No articles match "${search.value.trim()}".`
          : `No ${game !== 'all' && games[game] ? games[game].name + ' ' : ''}${cat}articles yet.`;
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
  // Opening an article = read (the hub's "Read" marks); the id is the address's last step.
  if (art) {
    try {
      const s = readSet();
      s.add(location.pathname.replace(/\.html$/, '').split('/').filter(Boolean).pop());
      localStorage.setItem(READ_KEY, JSON.stringify([...s]));
    } catch (e) { /* storage blocked: no marks */ }
  }
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
      `<strong>${esc(a.title)}</strong><span>${esc(gameName)} · ${esc(a.category)}</span></div>` +
      (live ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>' : '</div>');
  }

  const strips = document.querySelectorAll('.art-track[data-game]');
  const feeds = document.querySelectorAll('.art-feed[data-game]');
  const nexts = document.querySelectorAll('.art-next[data-article]');
  if (!strips.length && !feeds.length && !nexts.length && !art) {
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
        // Slides: newest first ("lead": true pins one to the front), unless
        // data-order says otherwise: "json" keeps articles.json's own order
        // (home page), "random" keeps the shuffle (every game page).
        if (el.dataset.variant === 'slide') {
          if (!el.dataset.order) {
            list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            const pin = list.findIndex((a) => a.lead);
            if (pin > 0) list.unshift(list.splice(pin, 1)[0]);
          }
          el.innerHTML = list.map((a) => slide(a, (games[a.game] || {}).name)).join('');
        } else el.innerHTML = list.map(card).join('');
      });
      document.querySelectorAll('.art-spot-count[data-game]').forEach((el) => {
        el.textContent = 'All ' + pick(el.dataset.game).length + ' articles';
      });
      feeds.forEach((el) => feed(el, pick(el.dataset.game), games, data.hub || {}));
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
