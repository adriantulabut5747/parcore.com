// Valorant Ranks (Oct 30 2026): /valorant/ranks.
// 1. The tray = the ladder: one tab per rank, ?r=<rank> in the address; the panel shows its divisions,
//    who each one can duo / trio with (partyOK = Riot's Competitive FAQ table) and, for Immortal +
//    Radiant, the live cutoffs.
// 2. "Who can queue together": two rank pickers -> partyOK.
// 3. "Top of the ladder": one region's leaderboard through our Worker (type=leaderboard, HenrikDev v3):
//    the RR cutoff + player count of Immortal 1-3 and Radiant, and the top 10. Riot's own minimums
//    (FLOOR) show even when the live call fails.
(function () {
  const BOARD = 'https://parchrome-valorant.adriantulabut5747.workers.dev/api/valorant?type=leaderboard&region=';

  // tier ids = valorant-api /competitivetiers (Episode5 table): 3 = Iron 1 ... 24-26 = Immortal, 27 = Radiant
  const RANKS = [
    ['iron', 'Iron', 3, '#a7aaa7'],
    ['bronze', 'Bronze', 6, '#c19a6b'],
    ['silver', 'Silver', 9, '#cfd5d5'],
    ['gold', 'Gold', 12, '#eccf56'],
    ['platinum', 'Platinum', 15, '#5fc0cf'],
    ['diamond', 'Diamond', 18, '#c69ad6'],
    ['ascendant', 'Ascendant', 21, '#6ae2af'],
    ['immortal', 'Immortal', 24, '#e2577f'],
    ['radiant', 'Radiant', 27, '#ffffaa'],
  ].map(([key, name, first, color]) => ({ key, name, color, tiers: key === 'radiant' ? [27] : [first, first + 1, first + 2] }));

  const rankOf = (t) => RANKS.find((r) => r.tiers.includes(t));
  const tierName = (t) => (t === 27 ? 'Radiant' : rankOf(t).name + ' ' + (rankOf(t).tiers.indexOf(t) + 1));
  const icon = (t) => '/images/valorant/ranks/' + t + '.webp';

  // Riot's Competitive FAQ (May 2026), duos and trios: lowest Iron/Bronze -> up to Silver 3, Silver -> Gold 3,
  // Gold -> Platinum 3, Platinum and up -> exactly one rank (3 tiers) higher, "Platinum 2 up to Diamond 2".
  function partyOK(a, b) {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (lo <= 8) return hi <= 11;
    if (lo <= 11) return hi <= 14;
    if (lo <= 14) return hi <= 17;
    return hi - lo <= 3;
  }
  const ALL = [];
  for (let t = 3; t <= 27; t++) ALL.push(t);
  const partners = (t) => ALL.filter((x) => partyOK(t, x));

  // Riot's "Rank Rating (RR) for Immortal and Radiant Ranks" (Mar 2026): the least RR each tier needs
  const FLOOR = {
    na: { 25: 90, 26: 200, 27: 450 },
    eu: { 25: 100, 26: 200, 27: 500 },
    ap: { 25: 80, 26: 200, 27: 400 },
    kr: { 25: 90, 26: 150, 27: 200 },
    latam: { 25: 90, 26: 150, 27: 200 },
    br: { 25: 100, 26: 230, 27: 340 },
  };
  const REGION = { na: 'NA', eu: 'EU', ap: 'AP', kr: 'KR', latam: 'LATAM', br: 'BR' };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
  const num = (n) => (Number.isFinite(n) ? n.toLocaleString('en-US') : '–');

  // ---------- live leaderboard ----------
  // thresholds[].start_index = the board place where that tier starts (Radiant first), so the gap to the
  // next one is the tier's size and the last one runs to the end of the board (total).
  function parseBoard(j) {
    const total = Number(j.total);
    const th = (Array.isArray(j.thresholds) ? j.thresholds : [])
      .map((t) => ({ id: Number(t.tier && t.tier.id), start: Number(t.start_index), rr: Number(t.threshold) }))
      .filter((t) => Number.isFinite(t.id) && Number.isFinite(t.start))
      .sort((a, b) => a.start - b.start);
    const base = th.length ? th[0].start : 1; // 0- or 1-based, either works
    const tiers = {};
    th.forEach((t, i) => {
      const next = th[i + 1];
      const count = next ? next.start - t.start : Number.isFinite(total) ? total - (t.start - base) : NaN;
      if (t.id >= 24) tiers[t.id] = { rr: t.rr, count: Math.max(0, count) };
    });
    return { total, tiers, updated: j.updated_at, players: Array.isArray(j.players) ? j.players : [] };
  }

  const boards = {};
  function getBoard(region) {
    if (!boards[region]) {
      boards[region] = fetch(BOARD + region)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then(parseBoard)
        .catch((err) => {
          console.warn('Leaderboard unavailable:', err);
          delete boards[region]; // try again on the next pick
          return null;
        });
    }
    return boards[region];
  }

  let region = 'na';
  let live = null; // parseBoard() of the picked region, or null

  // ---------- 1. the ladder ----------
  const tabs = $('vrTabs');
  tabs.innerHTML = RANKS.map(
    (r) =>
      '<button type="button" role="tab" data-r="' +
      r.key +
      '" aria-selected="false"><img src="' +
      icon(r.tiers[r.tiers.length - 1]) +
      '" alt="" width="24" height="24" decoding="async">' +
      r.name +
      '</button>',
  ).join('');
  let rank = RANKS.find((r) => r.key === new URLSearchParams(location.search).get('r')) || RANKS[0];

  function divLine(t) {
    if (t === 24) return 'Starts at 10 RR';
    if (t > 24) {
      const now = live && live.tiers[t];
      const rr = now && Number.isFinite(now.rr) ? now.rr : FLOOR[region][t];
      return 'From ' + num(rr) + ' RR in ' + REGION[region] + (t === 27 ? ', top 500 only' : '');
    }
    return '100 RR to move up';
  }
  function divCount(t) {
    const now = live && live.tiers[t];
    return now ? '<small class="vr-div-n">' + num(now.count) + ' players in ' + REGION[region] + '</small>' : '';
  }

  function drawPanel() {
    tabs.querySelectorAll('[data-r]').forEach((b) => b.setAttribute('aria-selected', b.dataset.r === rank.key ? 'true' : 'false'));
    $('vrRankTitle').textContent = rank.name;
    const top = rank.tiers[0] >= 24;
    const sizes = top ? 'Solo, duo or 5-stack' : 'Solo, duo, trio or 5-stack';
    $('vrPanel').style.setProperty('--vr-c', rank.color);
    $('vrPanel').innerHTML =
      '<div class="vr-divs">' +
      rank.tiers
        .map((t) => {
          const p = partners(t);
          return (
            '<div class="vr-div"><span class="vr-div-ico"><img src="' +
            icon(t) +
            '" alt="" width="96" height="96" decoding="async"></span>' +
            '<b>' +
            tierName(t) +
            '</b><small>' +
            divLine(t) +
            '</small>' +
            '<span class="vr-div-q"><em>Duo / trio with</em>' +
            tierName(p[0]) +
            ' – ' +
            tierName(p[p.length - 1]) +
            '</span>' +
            divCount(t) +
            '</div>'
          );
        })
        .join('') +
      '</div><p class="vr-sizes">' +
      sizes +
      '. ' +
      (top ? 'From Immortal up, only wins and losses change your RR.' : 'Two rank shields when you reach ' + rank.name + ' 1.') +
      '</p>';
  }
  tabs.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-r]');
    if (!b) return;
    rank = RANKS.find((r) => r.key === b.dataset.r);
    const u = new URL(location.href);
    u.searchParams.set('r', rank.key);
    history.replaceState(null, '', u);
    drawPanel();
  });
  drawPanel();
  const on = tabs.querySelector('[aria-selected="true"]');
  if (on) tabs.scrollLeft = on.offsetLeft - (tabs.clientWidth - on.offsetWidth) / 2;

  // ---------- 2. can we queue? ----------
  const A = $('vrA');
  const B = $('vrB');
  const opts = ALL.map((t) => '<option value="' + t + '">' + tierName(t) + '</option>').join('');
  A.innerHTML = opts;
  B.innerHTML = opts;
  A.value = '13';
  B.value = '16';
  function verdict() {
    const a = Number(A.value);
    const b = Number(B.value);
    const lo = Math.min(a, b);
    const p = partners(lo);
    const max = p[p.length - 1];
    const v = $('vrVerdict');
    if (partyOK(a, b)) {
      v.dataset.ok = 'yes';
      v.innerHTML =
        '<b>Yes</b>' +
        (Math.max(a, b) >= 24
          ? "You can duo. Immortal 1 and up can't trio."
          : 'You can duo, or trio with a third player inside the same limits.');
    } else {
      v.dataset.ok = 'no';
      v.innerHTML =
        '<b>No</b>With ' +
        tierName(lo) +
        ' as the lowest rank, the highest allowed is ' +
        tierName(max) +
        '. A 5-stack can still queue, for less RR.';
    }
  }
  A.addEventListener('change', verdict);
  B.addEventListener('change', verdict);
  verdict();

  // ---------- 3. top of the ladder ----------
  const card = (c) =>
    /^[0-9a-f-]{36}$/i.test(c || '')
      ? 'https://media.valorant-api.com/playercards/' + c + '/smallart.png'
      : /^https:\/\//.test(c || '')
        ? c
        : '';

  function drawTop() {
    const f = FLOOR[region];
    $('vrCuts').innerHTML = [27, 26, 25, 24]
      .map((t) => {
        const now = live && live.tiers[t];
        const rr = now && Number.isFinite(now.rr) ? num(now.rr) + ' RR' : '–';
        return (
          '<tr><td><span class="vr-cell"><img src="' +
          icon(t) +
          '" alt="" width="28" height="28" decoding="async">' +
          tierName(t) +
          '</span></td>' +
          '<td>' +
          (t === 24 ? (live ? '0 RR' : '–') : rr) +
          '</td><td>' +
          (now ? num(now.count) : '–') +
          '</td>' +
          '<td>' +
          (t === 24 ? 'Reach it' : f[t] + ' RR') +
          '</td></tr>'
        );
      })
      .join('');

    $('vrBoard').innerHTML =
      live && live.players.length
        ? live.players
            .map((p) => {
              const pic = card(p.card);
              const who = p.name ? esc(p.name) + '<small>#' + esc(p.tag) + '</small>' : 'Secret Agent';
              return (
                '<tr><td>' +
                num(Number(p.rank)) +
                '</td><td><span class="vr-cell">' +
                (pic ? '<img class="vr-card" src="' + esc(pic) + '" alt="" width="28" height="28" loading="lazy" decoding="async">' : '') +
                '<span>' +
                who +
                '</span></span></td><td>' +
                num(Number(p.rr)) +
                '</td><td>' +
                num(Number(p.wins)) +
                '</td></tr>'
              );
            })
            .join('')
        : '<tr><td colspan="4" class="gs-empty">' +
          (live ? 'No players on this board yet.' : "The live board isn't answering right now. Riot's floors still apply.") +
          '</td></tr>';

    const when = live && live.updated ? new Date(live.updated) : null;
    $('vrTopNote').textContent = live
      ? num(live.total) +
        ' players on the ' +
        REGION[region] +
        ' leaderboard (Immortal 1 and up)' +
        (when && !isNaN(when) ? ', updated ' + when.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '') +
        ". Riot doesn't publish how many players are in the ranks below."
      : "Riot doesn't publish how many players are in each rank below Immortal.";

    const fact = $('vrRadFact');
    const rad = live && live.tiers[27];
    if (rad && Number.isFinite(rad.rr)) {
      fact.querySelector('small').textContent = 'Radiant · ' + REGION[region];
      fact.querySelector('b').textContent = num(rad.rr) + ' RR';
      fact.querySelector('em').textContent = 'Live cutoff';
      fact.hidden = false;
    }
  }

  const seg = $('vrRegions');
  function pickRegion(r) {
    region = r;
    seg.querySelectorAll('[data-region]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.region === r ? 'true' : 'false'));
    live = null;
    drawTop();
    if (rank.tiers[0] >= 24) drawPanel();
    getBoard(r).then((b) => {
      if (region !== r) return; // another region was picked meanwhile
      live = b;
      drawTop();
      if (rank.tiers[0] >= 24) drawPanel();
    });
  }
  seg.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-region]');
    if (b) pickRegion(b.dataset.region);
  });
  pickRegion(region);
})();
