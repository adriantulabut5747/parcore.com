// /clash-royale/decks (Oct 30 2026; v2 Oct 31 2026: decks drawn as real hands). Data = /cr-decks.json + /cr-cards.json,
// both written daily by scripts/cr-meta.mjs. The address holds the view: ?sort=wr|elixir, ?style=cycle,
// ?with=<ids>&without=<ids>. Each deck: name (CR.name), the 8 cards 4 x 2, tower + elixir, win rate with its
// 95% margin, elixir curve, the CoC card bar (flame like / Copy deck / share) and a pen into the Deck Builder.
// Under the list: the meta map (every deck by games x win rate, its win condition as the dot).
(() => {
  const $ = (id) => document.getElementById(id);
  const { esc, num } = CR;
  const PAGE = 20; // decks drawn per "Show more"
  const url = new URL(location.href);
  const ids = (k) => (url.searchParams.get(k) || '').split(',').map(Number).filter(Boolean);
  const SORTS = [
    ['games', 'Most played'],
    ['wr', 'Best win rate'],
    ['elixir', 'Cheapest'],
  ];
  const STYLES = [
    ['beatdown', 'Beatdown'],
    ['cycle', 'Cycle'],
    ['bridge', 'Bridge Spam'],
    ['siege', 'Siege'],
    ['bait', 'Bait'],
    ['control', 'Control'],
  ];
  const pick = (k, list) => (list.some(([v]) => v === url.searchParams.get(k)) ? url.searchParams.get(k) : '');
  const state = { sort: pick('sort', SORTS) || 'games', style: pick('style', STYLES), with: new Set(ids('with')), without: new Set(ids('without')), shown: PAGE };

  const drop = '<svg class="crd-drop" viewBox="0 0 12 16" aria-hidden="true"><path d="M6 0C6 0 0 7 0 10.5a6 6 0 0 0 12 0C12 7 6 0 6 0z"/></svg>';
  const cycleIco = '<svg class="crd-cyc" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/></svg>';
  // the CoC card bar's icons (th-layouts.js): Lucide flame, share, pencil-line (ISC)
  const FLAME = '<svg viewBox="0 0 24 24" class="crd-flame" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>';
  const SHARE = '<svg viewBox="0 0 24 24" class="crd-ico" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>';
  const PEN = '<svg viewBox="0 0 24 24" class="crd-ico" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

  Promise.all([fetch('/cr-decks.json').then((r) => r.json()), CR.cards()])
    .then(([data, cards]) => start(data, cards))
    .catch(() => ($('crdList').innerHTML = '<p class="crd-fail">The decks didn\'t load. Refresh the page to try again.</p>'));

  function start(data, cards) {
    const { byId } = cards;
    data.decks.forEach((d, i) => {
      d.i = i;
      d.cards = CR.order(d.cards, byId);
      d.ids = new Set(d.cards.map((c) => c[0]));
      d.key = CR.key(d.cards);
      Object.assign(d, CR.name(d.cards, byId));
      d.avg = CR.avgElixir(d.cards, byId);
      // 95% margin of the win rate (normal approximation; every deck has 50+ games)
      d.margin = 196 * Math.sqrt((d.winRate / 100) * (1 - d.winRate / 100) / d.games);
    });
    // usage rank = the "#" on each deck, whatever the sort
    [...data.decks].sort((a, b) => b.games - a.games).forEach((d, n) => (d.rank = n + 1));

    // banner facts
    $('cbBattles').textContent = num(data.battles);
    $('cbDecks').textContent = num(data.decks.length);
    $('cbDecksSub').textContent = data.floor + '+ games each';
    $('cbDays').textContent = data.days + (data.days === 1 ? ' day' : ' days');
    $('cbDaysSub').textContent = 'Updated ' + new Date(data.updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // sort tray
    const tabs = $('crdSort');
    tabs.innerHTML = SORTS.map(([k, t]) => `<button type="button" role="tab" data-sort="${k}">${t}</button>`).join('');
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sort]');
      if (!b) return;
      state.sort = b.dataset.sort;
      state.shown = PAGE;
      draw();
    });

    // playstyle chips (counts = every deck, not the filtered list, so they don't jump around)
    const count = (s) => data.decks.filter((d) => !s || d.style === s).length;
    $('crdStyles').innerHTML = [['', 'All'], ...STYLES]
      .filter(([k]) => count(k))
      .map(([k, t]) => `<button type="button" class="crd-st" data-style="${k}">${t}<span>${count(k)}</span></button>`)
      .join('');
    $('crdStyles').addEventListener('click', (e) => {
      const b = e.target.closest('[data-style]');
      if (!b) return;
      state.style = b.dataset.style;
      state.shown = PAGE;
      draw();
    });

    // card picker: tap = must have, tap again = must not have, again = off
    const playable = cards.cards.filter((c) => c.games).sort((a, b) => b.games - a.games);
    $('crdPickGrid').innerHTML = playable
      .map((c) => `<button type="button" class="crd-pc" data-id="${c.id}" title="${esc(c.name)}"><img src="${CR.img(c.id)}" alt="${esc(c.name)}" width="68" height="100" loading="lazy" decoding="async"></button>`)
      .join('');
    const cycleCard = (id) => {
      if (state.with.delete(id)) state.without.add(id);
      else if (!state.without.delete(id)) state.with.add(id);
      state.shown = PAGE;
      draw();
    };
    $('crdPickGrid').addEventListener('click', (e) => {
      const b = e.target.closest('.crd-pc');
      if (b) cycleCard(+b.dataset.id);
    });
    $('crdPickBtn').addEventListener('click', () => {
      const open = $('crdPick').hidden;
      $('crdPick').hidden = !open;
      $('crdPickBtn').setAttribute('aria-expanded', open);
    });
    $('crdChips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-off]');
      if (!b) return;
      if (b.dataset.off === 'all') state.with.clear(), state.without.clear(), (state.style = '');
      else state.with.delete(+b.dataset.off), state.without.delete(+b.dataset.off);
      draw();
    });
    $('crdMore').addEventListener('click', () => {
      state.shown += PAGE;
      draw();
    });

    // ---- the deck's own keys ----
    $('crdList').addEventListener('click', (e) => {
      const deckEl = e.target.closest('.crd-deck');
      if (!deckEl) return;
      const d = data.decks[+deckEl.dataset.i];
      const k = e.target.closest('[data-act]');
      if (k?.dataset.act === 'copy') {
        e.preventDefault();
        CR.copyDeck(d.cards, d.tower, k);
      } else if (k?.dataset.act === 'share') share(k, d);
      else if (k?.dataset.act === 'like') like(k, d);
      else if (k?.dataset.act === 'stats') k.setAttribute('aria-expanded', deckEl.classList.toggle('is-open'));
      else if (k?.dataset.act === 'card') {
        // a card in a deck = "every deck with this card"
        state.with.add(+k.dataset.id);
        state.without.delete(+k.dataset.id);
        state.shown = PAGE;
        draw();
        $('crdBar').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    // ---- likes: Firestore layoutLikes/cr-decks, one counts map keyed by CR.key (same rule as the CoC cards) ----
    const LIKED = 'parchrome_liked_cr-decks';
    let liked = new Set();
    try {
      liked = new Set(JSON.parse(localStorage.getItem(LIKED) || '[]'));
    } catch {}
    const likes = {};
    const docP = CR.firestore().then((db) => db.collection('layoutLikes').doc('cr-decks'));
    docP
      .then((doc) => doc.get())
      .then((snap) => {
        Object.assign(likes, (snap.exists && snap.data().counts) || {});
        document.querySelectorAll('.crd-like').forEach(paintLike);
      })
      .catch(() => {});
    function paintLike(b) {
      const n = likes[b.dataset.key] || 0;
      const on = liked.has(b.dataset.key);
      b.classList.toggle('is-liked', on);
      b.setAttribute('aria-pressed', on);
      b.querySelector('span').textContent = n > 0 ? num(n) : '';
      b.title = (on ? 'Unlike this deck' : 'Like this deck') + (n > 0 ? ` (${num(n)})` : '');
    }
    function like(b, d) {
      const on = !liked.has(d.key);
      const delta = on ? 1 : -1;
      liked[on ? 'add' : 'delete'](d.key);
      likes[d.key] = Math.max(0, (likes[d.key] || 0) + delta);
      const save = () => {
        try {
          localStorage.setItem(LIKED, JSON.stringify([...liked]));
        } catch {}
      };
      save();
      paintLike(b);
      if (on) b.classList.remove('just-liked'), void b.offsetWidth, b.classList.add('just-liked');
      b.disabled = true;
      docP
        .then((doc) => doc.set({ counts: { [d.key]: firebase.firestore.FieldValue.increment(delta) } }, { merge: true }))
        .catch(() => {
          // write failed: put it back
          liked[on ? 'delete' : 'add'](d.key);
          likes[d.key] = Math.max(0, (likes[d.key] || 0) - delta);
          save();
          paintLike(b);
        })
        .finally(() => (b.disabled = false));
    }

    // ---- share: phones = the share sheet; desktop = the CoC cards' panel (copy link + 4 apps) ----
    const brand = (n, d) => `<svg viewBox="0 0 24 24" class="crd-brand crd-brand--${n}" aria-hidden="true"><path d="${d}"/></svg>`;
    const panel = document.createElement('div');
    panel.className = 'crd-sp';
    panel.hidden = true;
    panel.setAttribute('role', 'menu');
    panel.innerHTML =
      `<button type="button" role="menuitem" data-to="copy"><svg viewBox="0 0 24 24" class="crd-ico" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><span>Copy link</span></button><hr>` +
      `<a role="menuitem" target="_blank" rel="noopener noreferrer" data-to="facebook">${brand('facebook', 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z')}Facebook</a>` +
      `<a role="menuitem" target="_blank" rel="noopener noreferrer" data-to="x">${brand('x', 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z')}X</a>` +
      `<a role="menuitem" target="_blank" rel="noopener noreferrer" data-to="reddit">${brand('reddit', 'M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z')}Reddit</a>` +
      `<a role="menuitem" target="_blank" rel="noopener noreferrer" data-to="whatsapp">${brand('whatsapp', 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z')}WhatsApp</a>`;
    let shareFor = null;
    const closeShare = () => {
      panel.hidden = true;
      shareFor?.setAttribute('aria-expanded', 'false');
      shareFor = null;
    };
    function share(b, d) {
      const link = location.origin + CR.builderLink(d.cards, d.tower);
      const title = d.name + ' deck on Parchrome';
      if (CR.touch && navigator.share) return void navigator.share({ title, url: link }).catch(() => {});
      if (shareFor === b) return closeShare();
      closeShare();
      const u = encodeURIComponent(link);
      const t = encodeURIComponent(title);
      panel.querySelector('[data-to=facebook]').href = 'https://www.facebook.com/sharer/sharer.php?u=' + u;
      panel.querySelector('[data-to=x]').href = 'https://x.com/intent/post?url=' + u + '&text=' + t;
      panel.querySelector('[data-to=reddit]').href = 'https://www.reddit.com/submit?url=' + u + '&title=' + t;
      panel.querySelector('[data-to=whatsapp]').href = 'https://wa.me/?text=' + encodeURIComponent(title + ' ' + link);
      panel.dataset.link = link;
      panel.querySelector('[data-to=copy] span').textContent = 'Copy link';
      b.closest('.crd-deck').appendChild(panel);
      panel.hidden = false;
      b.setAttribute('aria-expanded', 'true');
      shareFor = b;
    }
    panel.addEventListener('click', (e) => {
      const c = e.target.closest('[data-to=copy]');
      if (!c) return closeShare();
      e.stopPropagation();
      navigator.clipboard?.writeText(panel.dataset.link).then(
        () => (c.querySelector('span').textContent = 'Link copied'),
        () => (c.querySelector('span').textContent = 'Copy failed'),
      );
    });
    document.addEventListener('click', (e) => shareFor && !e.target.closest('.crd-sp, [data-act=share]') && closeShare());
    document.addEventListener('keydown', (e) => e.key === 'Escape' && closeShare());

    // ---- the meta map ----
    const map = metaMap();

    function draw() {
      // address
      const set = (k, v) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
      set('sort', state.sort === 'games' ? '' : state.sort);
      set('style', state.style);
      set('with', [...state.with].join(','));
      set('without', [...state.without].join(','));
      history.replaceState(null, '', url.pathname + url.search + url.hash);

      tabs.querySelectorAll('[data-sort]').forEach((b) => b.setAttribute('aria-selected', b.dataset.sort === state.sort));
      $('crdStyles').querySelectorAll('[data-style]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.style === state.style));
      $('crdPickGrid').querySelectorAll('.crd-pc').forEach((b) => {
        const id = +b.dataset.id;
        b.dataset.s = state.with.has(id) ? 'with' : state.without.has(id) ? 'without' : '';
        b.setAttribute('aria-pressed', !!b.dataset.s);
      });
      const chip = (id, kind) =>
        `<button type="button" class="crd-chip crd-chip--${kind}" data-off="${id}" aria-label="Remove ${esc(byId.get(id)?.name || '')}"><img src="${CR.img(id)}" alt="" width="20" height="29">${kind === 'without' ? 'No ' : ''}${esc(byId.get(id)?.name || id)}<span aria-hidden="true">×</span></button>`;
      const any = state.with.size + state.without.size;
      $('crdChips').innerHTML = any
        ? [...state.with].map((id) => chip(id, 'with')).join('') + [...state.without].map((id) => chip(id, 'without')).join('') + '<button type="button" class="crd-chip crd-chip--clear" data-off="all">Clear</button>'
        : '';
      $('crdPickN').textContent = any ? any : '';

      const list = data.decks
        .filter((d) => (!state.style || d.style === state.style) && [...state.with].every((id) => d.ids.has(id)) && ![...state.without].some((id) => d.ids.has(id)))
        .sort((a, b) =>
          state.sort === 'wr' ? b.winRate - a.winRate || b.games - a.games : state.sort === 'elixir' ? a.avg - b.avg || b.games - a.games : b.games - a.games,
        );

      $('crdEmpty').hidden = list.length > 0;
      $('crdCount').textContent = list.length === data.decks.length ? num(list.length) + ' decks' : num(list.length) + ' of ' + num(data.decks.length) + ' decks';
      closeShare();
      $('crdList').innerHTML = list.slice(0, state.shown).map(deck).join('');
      $('crdList').querySelectorAll('.crd-like').forEach(paintLike);
      $('crdMore').hidden = list.length <= state.shown;
      map.paint(new Set(list.map((d) => d.i)));
    }

    function deck(d) {
      const tower = byId.get(d.tower);
      const hand = d.cards
        .map(([id, evo]) => {
          const c = byId.get(id);
          const name = (evo === 1 ? 'Evo ' : evo === 2 ? 'Hero ' : '') + (c?.name || id);
          return `<li><button type="button" class="crd-card" data-act="card" data-id="${id}" title="${esc(name)}: show every deck with it"><img src="${CR.img(id, evo)}" alt="${esc(name)}" width="136" height="200" loading="lazy" decoding="async"><span class="crd-cost">${c?.elixir ?? '?'}</span></button></li>`;
        })
        .join('');
      // elixir curve: how many cards cost 1, 2 ... 7+
      const bins = Array(7).fill(0);
      d.cards.forEach(([id]) => {
        const e = byId.get(id)?.elixir;
        if (e != null) bins[Math.min(7, Math.max(1, e)) - 1]++;
      });
      const top = Math.max(...bins);
      const curve = bins.map((n, i) => `<i style="--h:${n / top}" data-n="${n || ''}"><b>${i === 6 ? '7+' : i + 1}</b></i>`).join('');
      // win rate on a 35-65% strip: the dot = this deck, the band = its 95% margin, the line = a coin flip
      const lo = d.winRate - d.margin;
      const hi = d.winRate + d.margin;
      const at = (v) => Math.max(0, Math.min(100, ((v - 35) / 30) * 100)).toFixed(1) + '%';
      const verdict = lo > 50 ? ['win', 'Winning'] : hi < 50 ? ['loss', 'Losing'] : ['flip', 'Coin flip'];
      const specials = CR.specials(d.cards, byId);
      return `<article class="crd-deck" data-i="${d.i}" data-style="${d.style}">
  <header class="crd-head">
    <span class="crd-rank${d.rank <= 3 ? ' crd-rank--top' : ''}" title="Most played #${d.rank}">#${d.rank}</span>
    <div class="crd-id"><h3 class="crd-name">${esc(d.name)}</h3><p class="crd-var">${specials.map(esc).join(' · ') || 'No evolutions'}</p></div>
    <a class="crd-edit" href="${CR.builderLink(d.cards, d.tower)}" aria-label="Edit ${esc(d.name)} in the Deck Builder" title="Edit in the Deck Builder">${PEN}</a>
  </header>
  <div class="crd-body">
    <div class="crd-hand">
      <ol class="crd-cards" aria-label="Cards">${hand}</ol>
      <div class="crd-foot">
        ${tower ? `<span class="crd-tower" title="Tower troop"><img src="${CR.img(tower.id)}" alt="" width="34" height="50" loading="lazy">${esc(tower.name)}</span>` : ''}
        <span class="crd-fact" title="Average elixir">${drop}<b>${d.avg.toFixed(1)}</b><small>avg</small></span>
        <span class="crd-fact" title="4-card cycle: what it costs to get back to the same card">${cycleIco}<b>${CR.cycle(d.cards, byId)}</b><small>cycle</small></span>
        <button type="button" class="crd-stats-key crd-stats-key--${verdict[0]}" data-act="stats" aria-expanded="false" title="Win rate and numbers"><b>${d.winRate.toFixed(1)}%</b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
      </div>
    </div>
    <div class="crd-stats">
      <div class="crd-wr">
        <small>Win rate</small>
        <b>${d.winRate.toFixed(1)}<i>%</i></b>
        <span class="crd-verdict crd-verdict--${verdict[0]}" title="95% sure the real win rate is between ${lo.toFixed(1)}% and ${hi.toFixed(1)}%">${verdict[1]} <em>±${d.margin.toFixed(1)}</em></span>
      </div>
      <div class="crd-strip crd-strip--${verdict[0]}" aria-hidden="true"><span class="crd-band" style="left:${at(lo)};right:calc(100% - ${at(hi)})"></span><span class="crd-dot" style="left:${at(d.winRate)}"></span><small style="left:0">35</small><small style="left:50%">50</small><small style="left:100%">65</small></div>
      <dl class="crd-rows">
        <div><dt>Games</dt><dd>${num(d.games)}</dd></div>
        <div><dt>Wins</dt><dd>${num(d.wins)}</dd></div>
        <div><dt>Usage</dt><dd>${d.usage.toFixed(2)}%</dd></div>
      </dl>
      <div class="crd-curve-wrap"><small>Elixir curve</small><div class="crd-curve" aria-hidden="true">${curve}</div></div>
    </div>
  </div>
  <div class="crd-bar">
    <button type="button" class="crd-key crd-like" data-act="like" data-key="${d.key}" aria-pressed="false">${FLAME}<span></span></button>
    <a class="crd-key crd-copy" data-act="copy" href="${esc(CR.copyLink(d.cards, d.tower))}" rel="noopener" title="Open this deck in Clash Royale">Copy deck</a>
    <button type="button" class="crd-key crd-share" data-act="share" aria-expanded="false" aria-label="Share this deck" title="Share this deck">${SHARE}</button>
  </div>
</article>`;
    }

    // ---- META MAP: x = games (log), y = win rate, one dot per deck = its win condition's art. A dot opens its deck. ----
    function metaMap() {
      const box = $('crmPlot');
      const tip = $('crmTip');
      const g = data.decks.map((d) => d.games);
      const xMin = Math.log(Math.min(...g) * 0.92);
      const xMax = Math.log(Math.max(...g) * 1.08);
      const w = data.decks.map((d) => d.winRate);
      const yMin = Math.floor((Math.min(...w) - 2) / 5) * 5;
      const yMax = Math.ceil((Math.max(...w) + 2) / 5) * 5;
      const X = (v) => ((Math.log(v) - xMin) / (xMax - xMin)) * 100;
      const Y = (v) => 100 - ((v - yMin) / (yMax - yMin)) * 100;
      let grid = '';
      for (let v = yMin; v <= yMax; v += 5) grid += `<span class="crm-gy${v === 50 ? ' crm-gy--50' : ''}" style="top:${Y(v)}%"><b>${v}%</b></span>`;
      [50, 75, 100, 150, 200, 300, 500, 1000].filter((v) => Math.log(v) > xMin && Math.log(v) < xMax).forEach((v) => (grid += `<span class="crm-gx" style="left:${X(v)}%"><b>${v}</b></span>`));
      const dots = data.decks
        .map(
          (d) =>
            `<button type="button" class="crm-dot crm-dot--${d.winRate - d.margin > 50 ? 'win' : d.winRate + d.margin < 50 ? 'loss' : 'flip'}" data-i="${d.i}" style="left:${X(d.games)}%;top:${Y(d.winRate)}%;--art:url('${CR.img(d.wincon)}')" aria-label="${esc(d.name)}: ${d.winRate.toFixed(1)}% in ${num(d.games)} games"></button>`,
        )
        .join('');
      box.innerHTML = `<div class="crm-grid" aria-hidden="true">${grid}</div><span class="crm-q crm-q--tl">Hidden gems</span><span class="crm-q crm-q--tr">Meta kings</span><span class="crm-q crm-q--br">Overplayed</span><span class="crm-q crm-q--bl">Struggling</span>${dots}`;
      const show = (b) => {
        const d = data.decks[+b.dataset.i];
        tip.innerHTML = `<b>${esc(d.name)}</b><span>${d.winRate.toFixed(1)}% win rate · ${num(d.games)} games</span><span class="crm-tip-cards">${d.cards.map(([id, e]) => `<img src="${CR.img(id, e)}" alt="" width="27" height="40">`).join('')}</span>`;
        tip.hidden = false;
        const r = b.getBoundingClientRect();
        const p = tip.parentElement.getBoundingClientRect(); // .crm: the tip and the plot both sit in it
        const left = Math.min(Math.max(r.left - p.left + r.width / 2, 120), p.width - 120);
        tip.style.left = left + 'px';
        tip.style.top = r.top - p.top + 'px';
        tip.classList.toggle('is-below', r.top - p.top < 130);
      };
      box.addEventListener('pointerover', (e) => {
        const b = e.target.closest('.crm-dot');
        if (b) show(b);
      });
      box.addEventListener('pointerleave', () => (tip.hidden = true));
      box.addEventListener('focusin', (e) => e.target.closest('.crm-dot') && show(e.target));
      box.addEventListener('focusout', () => (tip.hidden = true));
      box.addEventListener('click', (e) => {
        const b = e.target.closest('.crm-dot');
        if (!b) return;
        const d = data.decks[+b.dataset.i];
        // make sure its deck is in the list, then go to it
        if (b.classList.contains('is-out')) {
          state.style = '';
          state.with.clear();
          state.without.clear();
        }
        let el = $('crdList').querySelector(`[data-i="${d.i}"]`);
        if (!el) {
          state.shown = data.decks.length;
          draw();
          el = $('crdList').querySelector(`[data-i="${d.i}"]`);
        }
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.remove('is-target');
        void el.offsetWidth;
        el.classList.add('is-target');
      });
      return {
        paint: (on) => box.querySelectorAll('.crm-dot').forEach((b) => b.classList.toggle('is-out', !on.has(+b.dataset.i))),
      };
    }

    draw();
  }
})();
