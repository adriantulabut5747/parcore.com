// Valorant Leaderboard (Nov 1 2026): /valorant/leaderboard.
// Data = Riot's ranked leaderboard (Immortal 1 and up) through HenrikDev v3 and our Worker:
//   type=ladder&region=<r>&page=<n>  -> 100 places + the tier cutoffs + how many are on the board
//   type=ladder&region=<r>&name=&tag= -> where one Riot ID stands (empty when they're not on it)
// The address holds ?region=&page=, and ?rank=<n> marks one row (the player page's "#123" well links here).
// Page 1 is always loaded: the Top 3 and the RR bars (share of #1's RR) need it. No fallbacks: a failed
// call says so. Card art = valorant-api.com playercards.
(function () {
  const API = 'https://parchrome-valorant.adriantulabut5747.workers.dev/api/valorant?type=ladder';
  const REGIONS = [
    ['na', 'North America'],
    ['eu', 'Europe'],
    ['ap', 'Asia Pacific'],
    ['kr', 'Korea'],
    ['latam', 'Latin America'],
    ['br', 'Brazil'],
  ];
  const TIERS = { 27: 'Radiant', 26: 'Immortal 3', 25: 'Immortal 2', 24: 'Immortal 1' };
  const COLOR = { 27: '#ffe58a', 26: '#e2577f', 25: '#d34b72', 24: '#b9405f' };
  const SIZE = 100;
  const ON_PAGES = location.hostname.endsWith('github.io');

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
  const num = (n) => (Number.isFinite(n) ? n.toLocaleString('en-US') : '–');
  const icon = (t) => (t >= 3 && t <= 27 ? '/images/valorant/ranks/' + t + '.webp' : '');
  const tierName = (t) => TIERS[t] || 'Unranked';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const art = (card, kind) => (UUID.test(card || '') ? 'https://media.valorant-api.com/playercards/' + card + '/' + kind + '.png' : '');
  const playerHref = (p) => {
    const id = encodeURIComponent(p.name) + '-' + encodeURIComponent(p.tag);
    return ON_PAGES ? '/valorant/player/?id=' + id : '/valorant/player/' + id;
  };
  // Riot shows hidden players as "Secret Agent"
  const who = (p) => (p.name ? esc(p.name) + '<small>#' + esc(p.tag) + '</small>' : 'Secret Agent');

  async function getJSON(url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body.errors && body.errors[0] && body.errors[0].message;
      // the Worker's own codes (badPage, noKey) aren't sentences: show our line instead
      const text =
        res.status === 429
          ? 'Too many lookups right now. Try again in a minute.'
          : msg && !/^[a-z]+[A-Z]/.test(msg)
            ? msg
            : "The leaderboard isn't answering right now.";
      throw Object.assign(new Error(text), { status: res.status });
    }
    return body;
  }
  // THE LINE (valorant-line.js): each call waits for a 1-call pass when Henrik's key is busy; #lbdLine shows the place
  const waiting = new Set();
  function showLine(t, key) {
    if (t) waiting.add(key);
    else waiting.delete(key);
    const el = $('lbdLine');
    el.hidden = !waiting.size;
    if (t)
      el.innerHTML = `Lots of players right now. You're <b>#${t.place}</b> in line${t.line > 1 ? ` of ${t.line}` : ''}, ${vlLine.eta(t.wait)}. Keep this tab open.`;
  }
  async function lined(url) {
    const key = {};
    const onWait = (t) => showLine(t, key);
    const pass = await vlLine.ticket(1, onWait);
    try {
      return await vlLine.get(url, getJSON, pass, onWait);
    } finally {
      vlLine.done(pass);
    }
  }
  const pages = {}; // 'na/3' -> promise of the Worker's answer
  function getPage(region, page) {
    const k = region + '/' + page;
    if (!pages[k]) pages[k] = lined(API + '&region=' + region + '&page=' + page).catch((e) => (delete pages[k], Promise.reject(e)));
    return pages[k];
  }

  // thresholds[].start_index = the place a tier starts at (Radiant first; 0- or 1-based, same maths as valorant-ranks.js)
  function tiersOf(j) {
    const th = (Array.isArray(j.thresholds) ? j.thresholds : [])
      .map((t) => ({ id: Number(t.tier && t.tier.id), start: Number(t.start_index), rr: Number(t.threshold) }))
      .filter((t) => TIERS[t.id] && Number.isFinite(t.start))
      .sort((a, b) => a.start - b.start);
    const base = th.length ? th[0].start : 1;
    return th.map((t, i) => ({
      ...t,
      first: t.start - base + 1, // 1-based place
      count: Math.max(0, th[i + 1] ? th[i + 1].start - t.start : Number(j.total) - (t.start - base)),
    }));
  }

  /* ---------- state + address ---------- */
  const q = new URLSearchParams(location.search);
  const S = {
    region: REGIONS.some(([r]) => r === q.get('region')) ? q.get('region') : 'na',
    page: Math.max(1, Math.min(999, parseInt(q.get('page'), 10) || 1)),
    mark: parseInt(q.get('rank'), 10) || 0, // a place to highlight
    top: null, // page 1 of this region
    total: 0,
  };
  if (S.mark > 0 && !q.get('page')) S.page = Math.min(999, Math.ceil(S.mark / SIZE));
  function saveAddress() {
    const p = new URLSearchParams();
    if (S.region !== 'na') p.set('region', S.region);
    if (S.page > 1) p.set('page', S.page);
    if (S.mark) p.set('rank', S.mark);
    const s = p.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
  }
  const regionName = () => REGIONS.find(([r]) => r === S.region)[1];

  /* ---------- region tray ---------- */
  const tray = $('lbdRegions');
  tray.innerHTML = REGIONS.map(
    ([r, name]) =>
      `<button type="button" role="tab" data-region="${r}" aria-selected="false"><b>${r.toUpperCase()}</b><span>${name}</span></button>`,
  ).join('');
  tray.addEventListener('click', (e) => {
    const b = e.target.closest('[data-region]');
    if (!b || b.dataset.region === S.region) return;
    S.region = b.dataset.region;
    S.page = 1;
    S.mark = 0;
    loadRegion();
  });

  /* ---------- banner facts ---------- */
  function fact(key, b, em) {
    const el = $('lbdFacts').querySelector(`[data-f="${key}"]`);
    el.hidden = !b;
    if (!b) return;
    el.querySelector('b').textContent = b;
    el.querySelector('em').textContent = em || '';
  }
  function drawFacts(j) {
    const tiers = j ? tiersOf(j) : [];
    const rad = tiers.find((t) => t.id === 27);
    const first = j && j.players && j.players[0];
    const when = j && new Date(j.updated_at);
    fact('total', j && Number.isFinite(Number(j.total)) ? num(Number(j.total)) : '', 'Players in ' + S.region.toUpperCase());
    fact('rad', rad && Number.isFinite(rad.rr) ? num(rad.rr) + ' RR' : '', rad ? num(rad.count) + ' Radiants' : '');
    fact('top', first && first.rank === 1 ? num(first.rr) + ' RR' : '', first ? first.name || 'Secret Agent' : '');
    fact(
      'when',
      when && !isNaN(when) ? when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '',
      when && !isNaN(when) ? when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
    );
  }

  /* ---------- top 3: second, first, third, like a podium ---------- */
  function drawPodium(j) {
    const box = $('lbdPodium');
    box.removeAttribute('aria-busy');
    const top = j ? j.players.filter((p) => p.rank <= 3).sort((a, b) => a.rank - b.rank) : [];
    if (!top.length) {
      box.innerHTML = `<p class="lbd-empty">${j ? 'Nobody is on this board yet.' : "The leaderboard isn't answering right now."}</p>`;
      return;
    }
    const order = [top[1], top[0], top[2]].filter(Boolean);
    box.innerHTML = order
      .map((p) => {
        const pic = art(p.card, 'largeart');
        const tag = p.name ? 'a' : 'div';
        return `<${tag} class="lbd-pod" data-place="${p.rank}"${p.name ? ` href="${esc(playerHref(p))}"` : ''}>
          <span class="lbd-pod-art">${pic ? `<img src="${esc(pic)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}</span>
          <span class="lbd-pod-n" aria-hidden="true">${p.rank}</span>
          <span class="lbd-pod-body">
            <span class="lbd-pod-name"><span class="vl-sr">Place ${p.rank}: </span>${who(p)}</span>
            <span class="lbd-pod-rank">${icon(p.tier) ? `<img src="${icon(p.tier)}" alt="" width="22" height="22" decoding="async">` : ''}${tierName(p.tier)}</span>
            <span class="lbd-pod-wells">
              <span><small>RR</small><b>${num(p.rr)}</b></span>
              <span><small>Wins</small><b>${num(p.wins)}</b></span>
            </span>
          </span>
        </${tag}>`;
      })
      .join('');
  }

  /* ---------- tiers: the split bar + one card per tier ---------- */
  function drawTiers(j) {
    const tiers = j ? tiersOf(j) : [];
    const split = $('lbdSplit');
    const box = $('lbdTiers');
    const total = tiers.reduce((s, t) => s + t.count, 0);
    if (!tiers.length || !total) {
      split.hidden = true;
      box.innerHTML = `<p class="lbd-empty">${j ? 'This board has no tier cutoffs yet.' : "The tier cutoffs aren't answering right now."}</p>`;
      return;
    }
    split.hidden = false;
    // every tier stays visible, even when it holds 1% of the board
    split.innerHTML = tiers.map((t) => `<i style="--c:${COLOR[t.id]};flex-grow:${Math.max(t.count / total, 0.03)}"></i>`).join('');
    box.innerHTML = tiers
      .map(
        (t) => `<button type="button" class="lbd-tier" style="--c:${COLOR[t.id]}" data-place="${t.first}">
          <span class="lbd-tier-ico"><img src="${icon(t.id)}" alt="" width="56" height="56" loading="lazy" decoding="async"></span>
          <span class="lbd-tier-txt">
            <b>${TIERS[t.id]}</b>
            <span class="lbd-tier-rows">
              <span><small>Cutoff</small><em>${t.id === 24 ? 'Reach it' : Number.isFinite(t.rr) ? num(t.rr) + ' RR' : '–'}</em></span>
              <span><small>Players</small><em>${num(t.count)}</em></span>
              <span><small>Places</small><em>${num(t.first)}–${num(t.first + t.count - 1)}</em></span>
            </span>
            <span class="lbd-tier-bar"><i style="width:${((t.count / total) * 100).toFixed(1)}%"></i></span>
            <small class="lbd-tier-share">${((t.count / total) * 100).toFixed(1)}% of the board</small>
          </span>
          <span class="lbd-tier-go">Go to #${num(t.first)}</span>
        </button>`,
      )
      .join('');
  }
  $('lbdTiers').addEventListener('click', (e) => {
    const b = e.target.closest('[data-place]');
    if (b) goPlace(Number(b.dataset.place));
  });

  /* ---------- the list ---------- */
  const list = $('lbdList');
  function skeleton() {
    list.setAttribute('aria-busy', 'true');
    list.innerHTML = '<li class="lbd-row lbd-row--ghost"></li>'.repeat(10);
  }
  function drawList(j) {
    list.removeAttribute('aria-busy');
    const rows = (j.players || []).slice().sort((a, b) => a.rank - b.rank);
    if (!rows.length) {
      list.innerHTML = `<li class="lbd-empty">${S.page > 1 ? 'This page is past the end of the board.' : 'Nobody is on this board yet.'}</li>`;
      return;
    }
    const best = (S.top && S.top.players[0] && S.top.players[0].rr) || rows[0].rr || 1;
    const cuts = tiersOf(j);
    let last = null;
    list.innerHTML = rows
      .map((p) => {
        // a divider where a new tier starts (and at the top of each page)
        let head = '';
        if (p.tier !== last) {
          const c = cuts.find((t) => t.id === p.tier);
          head = `<li class="lbd-band" style="--c:${COLOR[p.tier] || '#888'}">${icon(p.tier) ? `<img src="${icon(p.tier)}" alt="" width="20" height="20" decoding="async">` : ''}<b>${tierName(p.tier)}</b>${c && p.tier > 24 && Number.isFinite(c.rr) ? `<span>from ${num(c.rr)} RR</span>` : ''}</li>`;
          last = p.tier;
        }
        const pic = art(p.card, 'smallart');
        const name = p.name ? `<a href="${esc(playerHref(p))}">${who(p)}</a>` : `<span class="lbd-anon">${who(p)}</span>`;
        return `${head}<li class="lbd-row${p.rank === S.mark ? ' is-mark' : ''}${p.rank <= 3 ? ' is-top' : ''}" data-place="${p.rank}" style="--c:${COLOR[p.tier] || '#888'}">
          <span class="lbd-n">${num(p.rank)}</span>
          <span class="lbd-who"><span class="lbd-card">${pic ? `<img src="${esc(pic)}" alt="" width="36" height="36" loading="lazy" decoding="async" onerror="this.remove()">` : ''}</span><span class="lbd-name">${name}</span></span>
          <span class="lbd-rank">${icon(p.tier) ? `<img src="${icon(p.tier)}" alt="" width="24" height="24" loading="lazy" decoding="async">` : ''}<span>${tierName(p.tier)}</span></span>
          <span class="lbd-rr"><b>${num(p.rr)}</b><span class="lbd-rr-bar"><i style="width:${Math.max(2, Math.min(100, (p.rr / best) * 100)).toFixed(1)}%"></i></span></span>
          <span class="lbd-w">${num(p.wins)}</span>
        </li>`;
      })
      .join('');
    const first = rows[0].rank,
      end = rows[rows.length - 1].rank;
    $('lbdNote').textContent =
      `Places ${num(first)} to ${num(end)} of ${num(S.total)} on the ${regionName()} board. Only Immortal 1 and up are ranked here; players who haven't played for a while drop off until they play again.`;
  }

  /* ---------- pager: first, a window around this page, last ---------- */
  function drawPager() {
    const last = Math.max(1, Math.ceil(S.total / SIZE));
    const nav = $('lbdPager');
    if (last <= 1) {
      nav.innerHTML = '';
      return;
    }
    const want = new Set([1, last, S.page - 1, S.page, S.page + 1]);
    if (S.page <= 3) [2, 3, 4].forEach((n) => want.add(n));
    if (S.page >= last - 2) [last - 1, last - 2, last - 3].forEach((n) => want.add(n));
    const nums = [...want].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b);
    let html = `<button type="button" data-page="${S.page - 1}" ${S.page === 1 ? 'disabled' : ''} aria-label="Previous page"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>`;
    nums.forEach((n, i) => {
      if (i && n - nums[i - 1] > 1) html += '<span class="lbd-gap" aria-hidden="true">…</span>';
      html += `<button type="button" data-page="${n}"${n === S.page ? ' aria-current="page"' : ''}>${n}</button>`;
    });
    html += `<button type="button" data-page="${S.page + 1}" ${S.page === last ? 'disabled' : ''} aria-label="Next page"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>`;
    nav.innerHTML = html;
  }
  $('lbdPager').addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (!b || b.disabled) return;
    S.mark = 0;
    showPage(Number(b.dataset.page), true);
  });

  /* ---------- loading ---------- */
  const status = (msg, err) => {
    const el = $('lbdStatus');
    el.innerHTML = msg || '';
    el.toggleAttribute('data-err', !!err);
  };
  let ticket = 0; // a newer request wins
  async function showPage(page, scroll) {
    const mine = ++ticket;
    S.page = page;
    saveAddress();
    skeleton();
    drawPager();
    try {
      const j = await getPage(S.region, page);
      if (mine !== ticket) return;
      S.total = Number(j.total) || S.total;
      drawList(j);
      drawPager();
      const row = S.mark && list.querySelector(`[data-place="${S.mark}"]`);
      if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      else if (scroll) $('lbdListTitle').scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (e) {
      if (mine !== ticket) return;
      list.removeAttribute('aria-busy');
      list.innerHTML = `<li class="lbd-empty">${esc(e.message)}</li>`;
      $('lbdNote').textContent = '';
      console.warn('Leaderboard page unavailable:', e);
    }
  }
  function goPlace(n) {
    S.mark = n;
    showPage(Math.min(999, Math.ceil(n / SIZE)), true);
  }

  async function loadRegion() {
    tray
      .querySelectorAll('[data-region]')
      .forEach((b) => b.setAttribute('aria-selected', b.dataset.region === S.region ? 'true' : 'false'));
    status('');
    S.top = null;
    S.total = 0;
    const region = S.region;
    $('lbdPodium').setAttribute('aria-busy', 'true');
    $('lbdPodium').innerHTML = '<div class="lbd-pod lbd-pod--ghost"></div>'.repeat(3);
    $('lbdTiers').innerHTML = '';
    drawFacts(null);
    const list1 = getPage(region, 1);
    if (S.page !== 1) showPage(S.page, false);
    try {
      const j = await list1;
      if (region !== S.region) return;
      S.top = j;
      S.total = Number(j.total) || 0;
      drawFacts(j);
      drawPodium(j);
      drawTiers(j);
      if (S.page === 1) {
        ++ticket;
        drawList(j);
        drawPager();
        const row = S.mark && list.querySelector(`[data-place="${S.mark}"]`);
        if (row) row.scrollIntoView({ block: 'center' });
      } else drawPager();
    } catch (e) {
      if (region !== S.region) return;
      drawPodium(null);
      drawTiers(null);
      if (S.page === 1) {
        list.removeAttribute('aria-busy');
        list.innerHTML = `<li class="lbd-empty">${esc(e.message)}</li>`;
      }
      console.warn('Leaderboard unavailable:', e);
    }
  }

  /* ---------- find a Riot ID / go to a place ---------- */
  const okName = (s) => /^[\p{L}\p{N} _.-]{3,16}$/u.test(s);
  const okTag = (s) => /^[\p{L}\p{N}]{3,5}$/u.test(s);
  $('lbdFind').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('lbdName').value.trim();
    const tag = $('lbdTag').value.trim().replace(/^#/, '');
    if (!okName(name) || !okTag(tag)) {
      status('A Riot ID is a name of 3-16 characters and a tag of 3-5 letters or numbers.', true);
      return;
    }
    const btn = e.currentTarget.querySelector('button');
    btn.disabled = true;
    status('Looking for ' + esc(name) + '#' + esc(tag) + '…');
    try {
      const j = await lined(API + '&region=' + S.region + '&name=' + encodeURIComponent(name) + '&tag=' + encodeURIComponent(tag));
      const p = (j.players || []).find((x) => x.rank > 0);
      if (p) {
        status(`${who(p)} is <b>#${num(p.rank)}</b> in ${regionName()} with ${num(p.rr)} RR.`);
        goPlace(p.rank);
      } else notOnBoard(name, tag);
    } catch (err) {
      if (err.status === 404) notOnBoard(name, tag);
      else status(esc(err.message), true);
    } finally {
      btn.disabled = false;
    }
  });
  function notOnBoard(name, tag) {
    const href = playerHref({ name, tag });
    status(
      `${esc(name)}#${esc(tag)} isn't on the ${regionName()} board. It only holds Immortal 1 and up, so try another region or <a href="${esc(href)}">open their profile</a>.`,
      true,
    );
  }
  $('lbdJump').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = parseInt($('lbdPlace').value, 10);
    if (!(n >= 1) || (S.total && n > S.total)) {
      status(`Pick a place from 1 to ${num(S.total || 1)}.`, true);
      return;
    }
    status('');
    goPlace(n);
  });

  loadRegion();
})();
