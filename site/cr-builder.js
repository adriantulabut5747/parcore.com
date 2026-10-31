// /clash-royale/deck-builder (Oct 31 2026). Data = /cr-cards.json (every card) + /cr-decks.json (the meta, for
// "In our data" / "Decks like yours"). The deck lives in the address: ?deck=<ids>&slots=<0 | 1 evo | 2 hero>&tt=<tower>
// (CR.builderLink writes it: the Decks page's edit pen and share links land here).
// Special slots follow the battle data (cr-decks.json): at most 2 evolutions, at most 2 heroes, 3 special cards in all.
(() => {
  const $ = (id) => document.getElementById(id);
  const { esc, num } = CR;
  const MAX_EVO = 2;
  const MAX_HERO = 2;
  const MAX_SPECIAL = 3;
  const TYPES = [
    ['', 'All'],
    ['troop', 'Troops'],
    ['spell', 'Spells'],
    ['building', 'Buildings'],
  ];
  const COSTS = [
    ['', 'Any'],
    ['1-2', '1-2'],
    ['3', '3'],
    ['4', '4'],
    ['5', '5'],
    ['6-99', '6+'],
  ];

  Promise.all([CR.cards(), fetch('/cr-decks.json').then((r) => r.json()).catch(() => null)])
    .then(([cards, meta]) => start(cards, meta))
    .catch(() => ($('crbGrid').innerHTML = '<p class="crd-fail">The cards didn\'t load. Refresh the page to try again.</p>'));

  function start(cards, meta) {
    const { byId } = cards;
    const pool = cards.cards.filter((c) => c.id < 159000000).sort((a, b) => (a.elixir ?? 99) - (b.elixir ?? 99) || a.name.localeCompare(b.name));
    const towers = cards.towers;
    const canEvo = (c) => (c.evo & 1) === 1;
    const canHero = (c) => (c.evo & 2) === 2;
    (meta?.decks || []).forEach((d) => {
      d.cards = CR.order(d.cards, byId);
      d.ids = new Set(d.cards.map((c) => c[0]));
      d.key = CR.key(d.cards);
      Object.assign(d, CR.name(d.cards, byId));
    });

    // ---- state from the address (every value checked: it comes from a link) ----
    const url = new URL(location.href);
    const list = (k) => (url.searchParams.get(k) || '').split(/[,;]/).filter(Boolean).map(Number);
    let deck = [];
    const slots = list('slots');
    list('deck').forEach((id, i) => {
      const c = byId.get(id);
      if (!c || id >= 159000000 || deck.length >= 8 || deck.some((x) => x[0] === id)) return;
      deck.push([id, 0]);
      setSlot(id, slots[i] === 1 && canEvo(c) ? 1 : slots[i] === 2 && canHero(c) ? 2 : 0, true);
    });
    let tower = towers.some((t) => t.id === +url.searchParams.get('tt')) ? +url.searchParams.get('tt') : towers[0]?.id;
    const filter = { q: '', type: '', cost: '' };

    function counts(skip) {
      const s = deck.filter((c) => c[0] !== skip);
      return { evo: s.filter((c) => c[1] === 1).length, hero: s.filter((c) => c[1] === 2).length };
    }
    // why a card can't take a slot right now ('' = it can)
    function blocked(id, slot) {
      const { evo, hero } = counts(id);
      if (evo + hero >= MAX_SPECIAL) return 'All 3 special slots are taken';
      if (slot === 1 && evo >= MAX_EVO) return 'Both evolution slots are taken';
      if (slot === 2 && hero >= MAX_HERO) return 'Both hero slots are taken';
      return '';
    }
    function setSlot(id, slot, quiet) {
      const c = deck.find((x) => x[0] === id);
      if (!c) return;
      if (slot && blocked(id, slot)) slot = 0;
      c[1] = slot;
      if (!quiet) draw();
    }

    // ---- tower troops ----
    $('crbTowers').innerHTML =
      '<small>Tower troop</small>' +
      towers
        .map((t) => `<button type="button" role="radio" class="crb-tower" data-tower="${t.id}" title="${esc(t.name)}"><img src="${CR.img(t.id)}" alt="${esc(t.name)}" width="34" height="50" loading="lazy"></button>`)
        .join('');
    $('crbTowers').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tower]');
      if (!b) return;
      tower = +b.dataset.tower;
      draw();
    });

    // ---- filters ----
    const chips = (el, items, k) => {
      el.innerHTML = items.map(([v, t]) => `<button type="button" class="crd-st" data-v="${v}">${t}</button>`).join('');
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]');
        if (!b) return;
        filter[k] = b.dataset.v;
        drawPool();
      });
    };
    chips($('crbType'), TYPES, 'type');
    chips($('crbCost'), COSTS, 'cost');
    $('crbFind').addEventListener('input', (e) => {
      filter.q = e.target.value.trim().toLowerCase();
      drawPool();
    });

    // ---- the pool: tap = add / remove ----
    $('crbGrid').addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]');
      if (!b) return;
      const id = +b.dataset.id;
      if (deck.some((c) => c[0] === id)) deck = deck.filter((c) => c[0] !== id);
      else if (deck.length >= 8) return void note('Your deck is full. Tap a card in it to take it out.');
      else deck.push([id, 0]);
      draw();
    });
    let noteT;
    function note(t) {
      $('cbCountSub').textContent = t;
      $('cbCountSub').classList.add('is-warn');
      clearTimeout(noteT);
      noteT = setTimeout(() => {
        $('cbCountSub').classList.remove('is-warn');
        draw();
      }, 2400);
    }

    // ---- a card in the deck: its menu ----
    const pop = $('crbPop');
    let popFor = null;
    const closePop = () => {
      pop.hidden = true;
      popFor = null;
    };
    $('crbHand').addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]');
      if (!b) return;
      const id = +b.dataset.id;
      if (popFor === id) return closePop();
      const c = byId.get(id);
      const slot = deck.find((x) => x[0] === id)[1];
      const opt = (v, label, why) =>
        `<button type="button" role="menuitemradio" aria-checked="${slot === v}" data-slot="${v}"${why ? ` disabled title="${esc(why)}"` : ''}><img src="${CR.img(id, v)}" alt="" width="27" height="40"><span>${label}${why ? `<small>${esc(why)}</small>` : ''}</span></button>`;
      pop.innerHTML =
        `<p class="crb-pop-h">${esc(c.name)}</p>` +
        opt(0, 'Normal') +
        (canEvo(c) ? opt(1, 'Evolution', slot === 1 ? '' : blocked(id, 1)) : '') +
        (canHero(c) ? opt(2, 'Hero', slot === 2 ? '' : blocked(id, 2)) : '') +
        (!canEvo(c) && !canHero(c) ? '<p class="crb-pop-note">No evolution or hero for this card yet.</p>' : '') +
        '<button type="button" role="menuitem" data-slot="out" class="crb-pop-out">Take it out</button>';
      pop.hidden = false;
      const r = b.getBoundingClientRect();
      const w = pop.offsetWidth;
      pop.style.left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8) + 'px';
      const below = r.bottom + 8 + pop.offsetHeight < innerHeight;
      pop.style.top = (below ? r.bottom + 8 : Math.max(8, r.top - pop.offsetHeight - 8)) + 'px';
      popFor = id;
      e.stopPropagation();
    });
    pop.addEventListener('click', (e) => {
      const b = e.target.closest('[data-slot]');
      if (!b || b.disabled) return;
      if (b.dataset.slot === 'out') deck = deck.filter((c) => c[0] !== popFor);
      else setSlot(popFor, +b.dataset.slot, true);
      closePop();
      draw();
    });
    document.addEventListener('click', (e) => !pop.hidden && !e.target.closest('.crb-pop') && closePop());
    document.addEventListener('keydown', (e) => e.key === 'Escape' && closePop());
    document.querySelector('.coc-main')?.addEventListener('scroll', closePop, { passive: true });
    addEventListener('scroll', closePop, { passive: true });

    // ---- keys ----
    $('crbClear').addEventListener('click', () => {
      deck = [];
      draw();
    });
    $('crbCopy').addEventListener('click', (e) => {
      e.preventDefault();
      if (deck.length === 8) CR.copyDeck(CR.order(deck, byId), tower, $('crbCopy'));
    });
    $('crbShare').addEventListener('click', () => {
      const link = location.origin + CR.builderLink(CR.order(deck, byId), tower);
      const label = $('crbShare').querySelector('span');
      if (CR.touch && navigator.share) return void navigator.share({ title: $('crbName').textContent + ' deck on Parchrome', url: link }).catch(() => {});
      navigator.clipboard?.writeText(link).then(
        () => (label.textContent = 'Link copied'),
        () => (label.textContent = 'Copy failed'),
      );
      setTimeout(() => (label.textContent = 'Share'), 1600);
    });
    $('crbLike').addEventListener('click', (e) => {
      const b = e.target.closest('[data-load]');
      if (!b) return;
      const d = meta.decks[+b.dataset.load];
      deck = d.cards.map((c) => [c[0], c[1] || 0]);
      tower = d.tower || tower;
      draw();
      document.querySelector('.crb-deck').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    function draw() {
      const ordered = CR.order(deck, byId);
      // address
      const link = CR.builderLink(ordered, tower);
      history.replaceState(null, '', deck.length ? link : location.pathname);

      // hand: the deck in the game's order, then empty slots
      $('crbHand').innerHTML =
        ordered
          .map(([id, s]) => {
            const c = byId.get(id);
            const n = (s === 1 ? 'Evo ' : s === 2 ? 'Hero ' : '') + c.name;
            return `<li><button type="button" class="crd-card" data-id="${id}" aria-haspopup="menu" title="${esc(n)}: evolution, hero or take it out"><img src="${CR.img(id, s)}" alt="${esc(n)}" width="136" height="200" decoding="async"><span class="crd-cost">${c.elixir ?? '?'}</span></button></li>`;
          })
          .join('') + '<li><span class="crb-empty" aria-hidden="true"></span></li>'.repeat(8 - ordered.length);

      // special slots: 1 = evolution, 2 = hero, 3 = either (the game's three)
      const evos = ordered.filter((c) => c[1] === 1);
      const heroes = ordered.filter((c) => c[1] === 2);
      const wild = evos[1] || heroes[1];
      const sock = (c, label) =>
        `<span class="crb-sock${c ? ' is-on' : ''}">${c ? `<img src="${CR.img(c[0], c[1])}" alt="" width="27" height="40">` : '<i></i>'}<span><small>${label}</small>${c ? esc(byId.get(c[0]).name) : 'Empty'}</span></span>`;
      $('crbSlots').innerHTML = sock(evos[0], 'Evolution') + sock(heroes[0], 'Hero') + sock(wild, 'Evo or hero');

      // tower
      $('crbTowers').querySelectorAll('[data-tower]').forEach((b) => b.setAttribute('aria-checked', +b.dataset.tower === tower));

      // name + numbers
      const full = deck.length === 8;
      $('crbName').textContent = full ? CR.name(ordered, byId).name : 'New deck';
      $('crbVar').textContent = full ? CR.specials(ordered, byId).join(' · ') || 'No evolutions' : `Add ${8 - deck.length} more card${deck.length === 7 ? '' : 's'}`;
      const avg = CR.avgElixir(ordered, byId);
      $('cbCount').textContent = deck.length + ' / 8';
      if (!$('cbCountSub').classList.contains('is-warn')) $('cbCountSub').textContent = full ? 'Ready to copy' : 'Tap a card to add it';
      $('cbAvg').textContent = deck.length ? avg.toFixed(1) : '–';
      $('cbCycle').textContent = deck.length >= 4 ? CR.cycle(ordered, byId) : '–';
      const bins = Array(7).fill(0);
      ordered.forEach(([id]) => {
        const e = byId.get(id)?.elixir;
        if (e != null) bins[Math.min(7, Math.max(1, e)) - 1]++;
      });
      const top = Math.max(1, ...bins);
      $('crbCurve').innerHTML = bins.map((n, i) => `<i style="--h:${n / top}" data-n="${n || ''}"><b>${i === 6 ? '7+' : i + 1}</b></i>`).join('');

      // copy key
      $('crbCopy').href = full ? CR.copyLink(ordered, tower) : '#';
      $('crbCopy').setAttribute('aria-disabled', !full);
      $('crbShare').disabled = !deck.length;

      // the phone dock
      $('crbDock').innerHTML =
        `<span class="crb-dock-cards">${ordered.map(([id, s]) => `<img src="${CR.img(id, s)}" alt="" width="27" height="40">`).join('')}${'<i></i>'.repeat(8 - ordered.length)}</span>` +
        `<span class="crb-dock-n"><b>${deck.length}/8</b><small>${deck.length ? avg.toFixed(1) + ' avg' : 'cards'}</small></span>`;

      drawMeta(ordered, full);
      drawPool();
    }
    const deckBox = document.querySelector('.crb-deck');
    $('crbDock').addEventListener('click', () => deckBox.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    new IntersectionObserver(([e]) => ($('crbDock').hidden = e.isIntersecting || !matchMedia('(max-width: 1100px)').matches)).observe(deckBox);

    // "In our data": this exact deck's numbers, else the meta decks that share the most cards with it
    function drawMeta(ordered, full) {
      if (!meta) return void ($('crbMetaSub').textContent = "The meta decks didn't load.");
      const key = CR.key(ordered);
      const exact = full && meta.decks.find((d) => d.key === key);
      const ids = new Set(ordered.map((c) => c[0]));
      const shared = (d) => [...d.ids].filter((id) => ids.has(id)).length;
      const rows = (deck.length ? meta.decks.filter((d) => d !== exact && shared(d) >= Math.min(3, deck.length)) : meta.decks)
        .map((d) => ({ d, n: shared(d) }))
        .sort((a, b) => b.n - a.n || b.d.games - a.d.games)
        .slice(0, exact ? 3 : 4);
      $('crbMetaTitle').textContent = exact ? 'In our data' : deck.length ? 'Decks like yours' : 'Top decks';
      const margin = (d) => 196 * Math.sqrt((d.winRate / 100) * (1 - d.winRate / 100) / d.games);
      $('crbMetaSub').innerHTML = exact
        ? `The top 1,000 played this exact deck <b>${num(exact.games)}</b> times and won <b>${exact.winRate.toFixed(1)}%</b> (±${margin(exact).toFixed(1)}).`
        : deck.length
          ? rows.length
            ? 'The meta decks that share the most cards with yours. Tap one to load it.'
            : 'No meta deck shares 3 of these cards yet.'
          : 'What the top 1,000 play most this week. Tap one to load it and make it your own.';
      $('crbLike').innerHTML = rows
        .map(
          ({ d, n }) => `<button type="button" class="crb-row" data-load="${meta.decks.indexOf(d)}">
  <span class="crb-row-cards">${d.cards.map(([id, e]) => `<img src="${CR.img(id, e)}" alt="" width="27" height="40" loading="lazy">`).join('')}</span>
  <span class="crb-row-name"><b>${esc(d.name)}</b><small>${deck.length ? n + ' of 8 cards · ' : ''}${num(d.games)} games</small></span>
  <span class="crb-row-wr${d.winRate >= 50 ? ' is-up' : ''}">${d.winRate.toFixed(1)}%</span>
</button>`,
        )
        .join('');
    }

    function drawPool() {
      $('crbType').querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === filter.type));
      $('crbCost').querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === filter.cost));
      const [lo, hi] = filter.cost ? filter.cost.split('-').map(Number) : [0, 99];
      const inDeck = new Set(deck.map((c) => c[0]));
      const shown = pool.filter(
        (c) =>
          (!filter.q || c.name.toLowerCase().includes(filter.q)) &&
          (!filter.type || c.type === filter.type) &&
          (!filter.cost || ((c.elixir ?? -1) >= lo && (c.elixir ?? -1) <= (hi ?? lo))),
      );
      $('crbGrid').innerHTML = shown.length
        ? shown
            .map(
              (c) =>
                `<button type="button" class="crb-pc" data-id="${c.id}" aria-pressed="${inDeck.has(c.id)}" title="${esc(c.name)}"><img src="${CR.img(c.id)}" alt="${esc(c.name)}" width="136" height="200" loading="lazy" decoding="async"><span class="crd-cost">${c.elixir ?? '?'}</span>${
                  canEvo(c) || canHero(c) ? `<span class="crb-tags">${canEvo(c) ? '<i class="crb-tag crb-tag--evo">Evo</i>' : ''}${canHero(c) ? '<i class="crb-tag crb-tag--hero">Hero</i>' : ''}</span>` : ''
                }</button>`,
            )
            .join('')
        : '<p class="crb-none">No card matches that.</p>';
    }

    draw();
  }
})();
