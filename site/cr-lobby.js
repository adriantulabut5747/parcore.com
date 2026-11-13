// /clash-royale/ = the Lobby, "the Throne Room" (Oct 31 2026, Adrian's pick). Guide = the Golden Knight (cr.css).
// 1. Hero: live facts + "Steal the crown" (a random deck of the 12 most played, dealt as a hand; Steal another = the next).
// 2. Crown decks: the 6 best win rates of the 30 most played (Nov 2 2026, Adrian). 3. The Royal Court: cr-top.json's top 10
// (podium 1-3 with 3 / 2 / 1 crowns, rows 4-10, each with the win rate of their recent ranked games).
// 4. The Card Wall: every card, brighter = more played (?wall= keeps the sort). 5. Every page: game-nav.json.
// Data = cr-decks.json + cr-top.json + cr-cards.json (scripts/cr-meta.mjs, daily). Real numbers only: a failed file says so.
(() => {
  const $ = (id) => document.getElementById(id);
  const { esc, num } = CR;
  const POOL = 12; // Steal another deals from the 12 most played
  const CROWN_POOL = 30; // Crown decks = the best win rates among this many most played (a big sample each, so no lucky streak tops it)
  const ROWS = 3; // full rows on the wall before "Show all" (columns come from the CSS grid, so rows never end ragged)
  const CROWN = '<svg viewBox="0 0 13 10" aria-hidden="true"><path d="M0 2l3 3 3.5-5L10 5l3-3-1 8H1z"/></svg>';
  const PEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  const COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/></svg>';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const json = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));

  // ---- 5. Every page (icons = game-nav.json pictures, the game's own menu icons): no deck data needed, so it never waits for (or fails with) the others.
  // 11layout.js (window.pcJSON, one shared download) loads after this script, hence DOMContentLoaded. ----
  addEventListener('DOMContentLoaded', () => (window.pcJSON || json)('/game-nav.json').then((nav) => {
    const groups = (nav['clash-royale']?.groups || []).filter((g) => g.pages?.length);
    const card = (p) => {
      const live = p.link && !p.soon;
      const tag = live ? 'a' : 'div';
      return `<${tag} class="ct-card${live ? '' : ' ct-card--soon'}"${live ? ` href="${esc(p.link)}"` : ''}>${live ? '' : '<span class="ct-tag">Soon</span>'}<span><b>${esc(p.name)}</b><span>${esc(p.sub || '')}</span></span><span class="ct-art" aria-hidden="true">${p.icon ? `<img src="${esc(p.icon)}" alt="" width="96" height="96" loading="lazy" decoding="async">` : ''}</span></${tag}>`;
    };
    $('crpPages').innerHTML = groups
      .map((g) => `<div class="crp-group"><h3 class="crp-label">${g.img ? `<img src="${esc(g.img)}" alt="" width="20" height="20" loading="lazy" decoding="async">` : ''}${esc(g.name)}</h3><div class="crp-grid">${g.pages.map(card).join('')}</div></div>`)
      .join('');
  }));

  Promise.all([json('/cr-decks.json'), json('/cr-top.json'), CR.cards()])
    .then(([decks, top, cards]) => start(decks, top, cards))
    .catch((e) => {
      console.error(e);
      $('crhDeck').textContent = "The decks didn't load";
      $('crhVar').textContent = 'Refresh the page to try again.';
      $('crhSteal').disabled = true;
      for (const id of ['crlDecks', 'crcPod', 'crwGrid']) $(id).innerHTML = '<p class="crl-fail">This didn\'t load. Refresh the page to try again.</p>';
    });

  function start(data, top, cards) {
    const { byId } = cards;
    const cardName = (id, e) => (e === 1 ? 'Evo ' : e === 2 ? 'Hero ' : '') + (byId.get(id)?.name || id);
    data.decks.forEach((d) => {
      d.cards = CR.order(d.cards, byId);
      Object.assign(d, CR.name(d.cards, byId));
      d.avg = CR.avgElixir(d.cards, byId);
      // 95% margin -> the verdict on the deck's top edge (same rule as the Decks page)
      const m = 196 * Math.sqrt((d.winRate / 100) * (1 - d.winRate / 100) / d.games);
      d.verdict = d.winRate - m > 50 ? 'win' : d.winRate + m < 50 ? 'loss' : 'flip';
    });
    const byGames = [...data.decks].sort((a, b) => b.games - a.games);
    byGames.forEach((d, i) => (d.rank = i + 1));

    // a hand: 8 card pictures, each a link to "every deck with it" (cost drops only where the cards are big enough)
    const hand = (deck, cost = true) =>
      deck
        .map(
          ([id, e], i) =>
            `<li style="--i:${i}"><a class="crd-card" href="/clash-royale/decks?with=${id}" title="${esc(cardName(id, e))}: every deck with it"><img ${CR.src(id, e)} alt="${esc(cardName(id, e))}" width="150" height="200" loading="lazy" decoding="async">${cost ? `<span class="crd-cost">${byId.get(id)?.elixir ?? '?'}</span>` : ''}</a></li>`,
        )
        .join('');
    const variants = (deck) => CR.specials(deck, byId).join(' · ') || 'No evolutions';
    // every Copy deck key on the page: phones open the game, a computer copies the link (CR.copyDeck)
    const decksOf = new Map();
    document.addEventListener('click', (e) => {
      const k = e.target.closest('[data-copy]');
      if (!k || !decksOf.has(k.dataset.copy)) return;
      e.preventDefault();
      const [deck, tower] = decksOf.get(k.dataset.copy);
      CR.copyDeck(deck, tower, k);
    });
    const copyKey = (deck, tower, cls, label) => {
      const key = CR.key(deck);
      decksOf.set(key, [deck, tower]);
      return `<a class="${cls}" data-copy="${key}" href="${esc(CR.copyLink(deck, tower))}" rel="noopener" title="Open this deck in Clash Royale">${label}</a>`;
    };

    // ---- 1. hero facts ----
    $('crhBattles').textContent = num(data.battles);
    $('crhDecks').textContent = num(data.decks.length);
    const first = top.players?.[0];
    $('crhElo').textContent = first ? num(first.elo) : '–';
    $('crhDate').textContent = new Date(data.updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // ---- 1. Steal the crown ----
    const pool = byGames.slice(0, POOL);
    let at = -1;
    const steal = () => {
      let n = Math.floor(Math.random() * pool.length);
      if (pool.length > 1 && n === at) n = (n + 1) % pool.length;
      at = n;
      const d = pool[n];
      $('crhRank').textContent = 'Most played #' + d.rank;
      $('crhDeck').textContent = d.name;
      $('crhVar').textContent = variants(d.cards) + ' · ' + d.avg.toFixed(1) + ' elixir';
      $('crhWr').textContent = d.winRate.toFixed(1) + '%';
      $('crhGames').textContent = num(d.games) + ' games';
      $('crhHand').innerHTML = hand(d.cards);
      $('crhHand').closest('.crh-steal').dataset.v = d.verdict;
      const copy = $('crhCopy');
      decksOf.set('steal', [d.cards, d.tower]);
      copy.dataset.copy = 'steal';
      copy.href = CR.copyLink(d.cards, d.tower);
      $('crhEdit').href = CR.builderLink(d.cards, d.tower);
      if (!reduced) {
        const c = $('crhCrown');
        c.classList.remove('is-grab');
        void c.offsetWidth;
        c.classList.add('is-grab');
      }
    };
    $('crhSteal').addEventListener('click', steal);
    steal();

    // ---- 2. Crown decks: the most played decks, best win rate first ----
    $('crlDecks').innerHTML = byGames
      .slice(0, CROWN_POOL)
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 6)
      .map(
        (d, i) => `<article class="crl-deck" data-v="${d.verdict}">
  <header class="crl-deck-head" style="--art:url('${CR.img(d.wincon)}')">
    <span class="crl-rank${i < 3 ? ' crl-rank--top' : ''}" title="Most played #${d.rank}">${i < 3 ? CROWN : ''}#${i + 1}</span>
    <div class="crl-id"><h3>${esc(d.name)}</h3><p>${esc(variants(d.cards))}</p></div>
    <a class="crl-pen" href="${CR.builderLink(d.cards, d.tower)}" aria-label="Edit ${esc(d.name)} in the Deck Builder" title="Edit in the Deck Builder">${PEN}</a>
  </header>
  <ol class="crl-hand" aria-label="Cards">${hand(d.cards)}</ol>
  <footer class="crl-foot">
    <span class="crl-wr" title="Win rate"><b>${d.winRate.toFixed(1)}%</b><small>win rate</small></span>
    <span class="crl-n"><b>${num(d.games)}</b><small>games</small></span>
    <span class="crl-n"><b>${d.avg.toFixed(1)}</b><small>elixir</small></span>
    ${copyKey(d.cards, d.tower, 'cr-key crl-copy', 'Copy deck')}
  </footer>
</article>`,
      )
      .join('');

    // ---- 3. The Royal Court ----
    // deck = null when a player's last 30 battles hold no ranked game (the crawl only reads ranked decks)
    const players = (top.players || []).map((p) => ({ ...p, deck: p.deck ? CR.order(p.deck, byId) : null }));
    const crowns = (n) => '<img src="/images/clash-royale/lobby/crown-red.webp" alt="" width="52" height="39" loading="lazy" decoding="async">'.repeat(n);
    const who = (p) => `<b class="crc-name">${esc(p.name)}</b><span class="crc-clan">${esc(p.clan || 'No clan')}</span>`;
    const noDeck = '<p class="crc-none">No ranked game in their last 30 battles</p>';
    // rating, + the win rate of the ranked games in their last 30 battles (hidden when the file has none yet)
    const stats = (p) =>
      `<div class="crc-stat"><span class="crc-elo"><b>${num(p.elo)}</b><small>rating</small></span>${
        p.games
          ? `<span class="crc-elo crc-wr${p.wins / p.games >= 0.5 ? ' is-up' : ''}" title="${p.wins} wins in their last ${p.games} ranked games"><b>${Math.round((p.wins / p.games) * 100)}%</b><small>win rate</small></span>`
          : ''
      }</div>`;
    $('crcPod').innerHTML = players
      .slice(0, 3)
      .map(
        (p) => `<li class="crc-p crc-p--${p.rank}">
  <div class="crc-crowns" aria-hidden="true">${crowns(4 - p.rank)}</div>
  <span class="crc-place">#${p.rank}</span>
  <div class="crc-who">${who(p)}</div>
  ${stats(p)}
  ${
    p.deck
      ? `<p class="crc-deckname">Plays <b>${esc(CR.name(p.deck, byId).name)}</b></p>
  <ol class="crc-hand" aria-label="${esc(p.name)}'s deck">${hand(p.deck, false)}</ol>
  ${copyKey(p.deck, p.tower, 'cr-key crc-copy', 'Copy deck')}`
      : noDeck
  }
</li>`,
      )
      .join('');
    $('crcRows').innerHTML = players
      .slice(3)
      .map(
        (p) => `<li class="crc-row">
  <span class="crc-rk">#${p.rank}</span>
  <div class="crc-who">${who(p)}</div>
  ${p.deck ? `<ol class="crc-hand crc-hand--row" aria-label="${esc(p.name)}'s deck">${hand(p.deck, false)}</ol>` : noDeck}
  ${stats(p)}
  ${p.deck ? copyKey(p.deck, p.tower, 'cr-key crc-copy crc-copy--ico', COPY + '<span class="crl-sr">Copy deck</span>') : '<span></span>'}
</li>`,
      )
      .join('');

    // ---- 4. The Card Wall ----
    const SORTS = [
      ['usage', 'Most used'],
      ['wr', 'Best win rate'],
      ['elixir', 'Elixir'],
    ];
    const url = new URL(location.href);
    let sort = SORTS.some(([k]) => k === url.searchParams.get('wall')) ? url.searchParams.get('wall') : 'usage';
    let all = false;
    const MIN = 100; // a win rate needs 100 games before it's ranked (fewer = greyed at the end)
    const list = cards.cards.filter((c) => c.elixir != null || c.games);
    const maxUse = Math.max(...list.map((c) => c.usage || 0)) || 1;
    $('crwSort').innerHTML = SORTS.map(([k, t]) => `<button type="button" class="crd-st" data-sort="${k}">${t}</button>`).join('');
    const notes = {
      usage: 'Share of decks that run it',
      wr: `Win rate, cards with ${MIN}+ games`,
      elixir: 'Cheapest first',
    };
    const wall = () => {
      const ranked = (c) => (sort === 'wr' ? c.games >= MIN : c.games > 0);
      const sorted = [...list].sort(
        (a, b) =>
          ranked(b) - ranked(a) ||
          (sort === 'wr' ? b.winRate - a.winRate : sort === 'elixir' ? (a.elixir ?? 99) - (b.elixir ?? 99) || b.usage - a.usage : b.usage - a.usage),
      );
      const cols = getComputedStyle($('crwGrid')).gridTemplateColumns.split(' ').length || 8;
      const cap = cols * ROWS;
      const shown = all ? sorted : sorted.slice(0, cap);
      $('crwGrid').innerHTML = shown
        .map((c) => {
          const val = !c.games ? 'Unplayed' : sort === 'wr' ? (c.games >= MIN ? c.winRate.toFixed(1) + '%' : 'Few games') : c.usage.toFixed(1) + '%';
          const tip = `${c.name}: ${c.games ? `in ${c.usage.toFixed(1)}% of decks, ${c.winRate.toFixed(1)}% win rate over ${num(c.games)} games` : 'no games in the top 1,000 yet'}`;
          return `<li><a class="crw-c${ranked(c) ? '' : ' is-cold'}" href="/clash-royale/decks?with=${c.id}" title="${esc(tip)}" style="--u:${Math.sqrt((c.usage || 0) / maxUse).toFixed(3)}"><img ${CR.src(c.id)} alt="${esc(c.name)}" width="150" height="200" loading="lazy" decoding="async"><span class="crd-cost">${c.elixir ?? '?'}</span><span class="crw-v">${val}</span></a></li>`;
        })
        .join('');
      $('crwSort').querySelectorAll('[data-sort]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.sort === sort));
      $('crwNote').textContent = notes[sort];
      $('crwMore').hidden = list.length <= cap;
      $('crwMore').textContent = all ? 'Show fewer cards' : `Show all ${list.length} cards`;
    };
    $('crwSort').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sort]');
      if (!b) return;
      sort = b.dataset.sort;
      sort === 'usage' ? url.searchParams.delete('wall') : url.searchParams.set('wall', sort);
      history.replaceState(null, '', url.pathname + url.search + url.hash);
      wall();
    });
    $('crwMore').addEventListener('click', () => {
      all = !all;
      wall();
      if (!all) $('crwT').scrollIntoView({ block: 'start' });
    });
    wall();
    // a width change can change the column count (phones fire resize on scroll, so compare the width)
    let w = innerWidth;
    addEventListener('resize', () => innerWidth !== w && ((w = innerWidth), wall()));
  }
})();
