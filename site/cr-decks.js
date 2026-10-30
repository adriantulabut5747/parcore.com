// /clash-royale/decks (Oct 30 2026, plan: docs/clash-royale-plan.md). Data = /cr-decks.json + /cr-cards.json,
// both written daily by scripts/cr-meta.mjs. The address holds the view: ?sort=wr, ?with=<ids>&without=<ids>.
(() => {
  const $ = (id) => document.getElementById(id);
  const { esc, num } = CR;
  const PAGE = 24; // decks drawn per "Show more"
  const url = new URL(location.href);
  const ids = (k) => (url.searchParams.get(k) || '').split(',').map(Number).filter(Boolean);
  const state = { sort: url.searchParams.get('sort') === 'wr' ? 'wr' : 'games', with: new Set(ids('with')), without: new Set(ids('without')), shown: PAGE };

  const drop = '<svg class="crd-drop" viewBox="0 0 12 16" aria-hidden="true"><path d="M6 0C6 0 0 7 0 10.5a6 6 0 0 0 12 0C12 7 6 0 6 0z"/></svg>';
  const copyIco = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/></svg>';

  Promise.all([fetch('/cr-decks.json').then((r) => r.json()), CR.cards()])
    .then(([data, cards]) => start(data, cards))
    .catch(() => ($('crdList').innerHTML = '<p class="crd-empty">The decks didn\'t load. Refresh the page to try again.</p>'));

  function start(data, cards) {
    const { byId } = cards;
    data.decks.forEach((d) => {
      d.cards = CR.order(d.cards, byId);
      d.ids = new Set(d.cards.map((c) => c[0]));
    });

    // banner facts
    $('cbBattles').textContent = num(data.battles);
    $('cbDecks').textContent = num(data.decks.length);
    $('cbDecksSub').textContent = data.floor + '+ games each';
    $('cbDays').textContent = data.days + (data.days === 1 ? ' day' : ' days');
    $('cbDaysSub').textContent = 'Updated ' + new Date(data.updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // sort tray
    const tabs = $('crdSort');
    tabs.innerHTML = [
      ['games', 'Most played'],
      ['wr', 'Best win rate']
    ].map(([k, t]) => `<button type="button" role="tab" data-sort="${k}">${t}</button>`).join('');
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sort]');
      if (!b) return;
      state.sort = b.dataset.sort;
      state.shown = PAGE;
      draw();
    });

    // card picker: tap = must have, tap again = must not have, again = off
    const playable = cards.cards.filter((c) => c.games).sort((a, b) => b.games - a.games);
    $('crdPickGrid').innerHTML = playable
      .map((c) => `<button type="button" class="crd-pc" data-id="${c.id}" title="${esc(c.name)}"><img src="${CR.img(c.id)}" alt="${esc(c.name)}" width="68" height="100" loading="lazy" decoding="async"></button>`)
      .join('');
    $('crdPickGrid').addEventListener('click', (e) => {
      const b = e.target.closest('.crd-pc');
      if (!b) return;
      const id = +b.dataset.id;
      if (state.with.delete(id)) state.without.add(id);
      else if (!state.without.delete(id)) state.with.add(id);
      state.shown = PAGE;
      draw();
    });
    $('crdPickBtn').addEventListener('click', () => {
      const open = $('crdPick').hidden;
      $('crdPick').hidden = !open;
      $('crdPickBtn').setAttribute('aria-expanded', open);
    });
    $('crdChips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-off]');
      if (!b) return;
      if (b.dataset.off === 'all') state.with.clear(), state.without.clear();
      else state.with.delete(+b.dataset.off), state.without.delete(+b.dataset.off);
      draw();
    });
    $('crdMore').addEventListener('click', () => {
      state.shown += PAGE;
      draw();
    });
    $('crdList').addEventListener('click', (e) => {
      const k = e.target.closest('[data-copy]');
      if (k) {
        const d = data.decks[+k.dataset.copy];
        CR.copyDeck(d.cards, d.tower, k);
      }
    });

    function draw() {
      // address
      const set = (k, v) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
      set('sort', state.sort === 'wr' ? 'wr' : '');
      set('with', [...state.with].join(','));
      set('without', [...state.without].join(','));
      history.replaceState(null, '', url.pathname + url.search + url.hash);

      tabs.querySelectorAll('[data-sort]').forEach((b) => b.setAttribute('aria-selected', b.dataset.sort === state.sort));
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
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => [...state.with].every((id) => d.ids.has(id)) && ![...state.without].some((id) => d.ids.has(id)))
        .sort((a, b) => (state.sort === 'wr' ? b.d.winRate - a.d.winRate || b.d.games - a.d.games : b.d.games - a.d.games));

      $('crdEmpty').hidden = list.length > 0;
      $('crdCount').textContent = list.length === data.decks.length ? num(list.length) + ' decks' : num(list.length) + ' of ' + num(data.decks.length) + ' decks';
      $('crdList').innerHTML = list.slice(0, state.shown).map(({ d, i }, n) => row(d, i, n + 1)).join('');
      $('crdMore').hidden = list.length <= state.shown;
    }

    function row(d, i, rank) {
      const tower = byId.get(d.tower);
      const cardsHtml = d.cards
        .map(([id, evo]) => {
          const c = byId.get(id);
          const name = (evo === 1 ? 'Evo ' : evo === 2 ? 'Hero ' : '') + (c?.name || id);
          return `<li class="crd-card"><img src="${CR.img(id, evo)}" alt="${esc(name)}" title="${esc(name)}" width="68" height="100" loading="lazy" decoding="async"><span class="crd-cost">${c?.elixir ?? '?'}</span></li>`;
        })
        .join('');
      return `<article class="crd-deck">
  <span class="crd-rank">${rank}</span>
  <ol class="crd-cards" aria-label="Cards">${cardsHtml}</ol>
  <div class="crd-stats">
    <div class="crd-wr"><small>Win rate</small><b>${d.winRate.toFixed(1)}%</b><i class="crd-wrbar"><i style="width:${Math.min(100, d.winRate)}%"></i></i></div>
    <dl class="crd-facts">
      <div><dt>Games</dt><dd>${num(d.games)}</dd></div>
      <div><dt>Usage</dt><dd>${d.usage.toFixed(2)}%</dd></div>
      <div><dt>Avg elixir</dt><dd>${drop}${CR.avgElixir(d.cards, byId).toFixed(1)}</dd></div>
      <div><dt>4-card cycle</dt><dd>${drop}${CR.cycle(d.cards, byId)}</dd></div>
    </dl>
    <div class="crd-act">
      ${tower ? `<span class="crd-tower" title="Tower troop: ${esc(tower.name)}"><img src="${CR.img(tower.id)}" alt="" width="22" height="32">${esc(tower.name)}</span>` : ''}
      <button type="button" class="cr-key cr-key--red crd-copy" data-copy="${i}">${copyIco}Copy deck</button>
    </div>
  </div>
</article>`;
    }

    draw();
  }
})();
