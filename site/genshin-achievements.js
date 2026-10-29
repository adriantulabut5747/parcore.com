// Genshin Impact -- Achievements (/genshin-impact/achievements, Oct 24 2026). Styles: genshin-achievements.css.
// Data: /genshin-achievements.json (scripts/genshin-feed.py achievements()): `cats` in the game's order, each
// {id, name, slug, medal, card: [namecard name, art] | null, ach: [{n, v, t: [[tier id, text, Primogems, target]],
// tn?: tier names, q?: quests}]}. A tier is one game id, so one tick = one id, the same ids UIAF uses.
// Saved per viewer (try/catch, the page works without): gi-ach = {tier id: unix seconds ticked},
// gi-ach-game = the last in-game count fetched from Enka ({u, nick, n, t}). The rest is in the address:
// ?c=<category slug> &show=todo|done &ver=<major> &q=<search>.
// Everything from the data is third-party text, so it goes through esc() before it reaches markup.
(function () {
  const { $, esc, PRIMO } = window.GI;
  const fmt = (n) => n.toLocaleString('en-US');
  const plural = (n, w) => fmt(n) + ' ' + w + (n === 1 ? '' : 's');
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STAR = 'M12 2.6l2.8 6.1 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.8 3.3 1.4-6.6-5-4.5 6.6-.7z';
  const LOOK_ERR = {
    notFound: 'No player has this UID. Check the number and try again.',
    maintenance: 'Genshin is under maintenance. Try again once it’s over.',
    busy: 'Too many lookups right now. Try again in a minute.',
    enka5xx: 'Enka.Network isn’t answering. Try again in a few minutes.',
  };

  let cats = []; // categories + their counts (n tiers, P Primogems)
  let latest = '';
  const T = new Map(); // tier id -> {c, a, k}
  const A = new Map(); // achievement key (its first tier id) -> {c, a}
  const f = { c: null, show: '', ver: '', q: '' };

  const load = (k, d) => {
    try {
      return JSON.parse(localStorage.getItem(k) || d) || JSON.parse(d);
    } catch (e) {
      return JSON.parse(d);
    }
  };
  const store = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (e) {
      return false;
    }
  };
  let done = load('gi-ach', '{}');
  let game = load('gi-ach-game', 'null');
  function save() {
    $('acSaved').textContent = store('gi-ach', done)
      ? 'Ticks are saved on this device.'
      : 'Couldn’t save: this browser blocks storage. Download a backup before you leave.';
  }

  // ---- COUNTS ----
  const key = (a) => a.t[0][0];
  const nDone = (a) => a.t.reduce((s, t) => s + (done[t[0]] ? 1 : 0), 0);
  function stat(c) {
    let d = 0;
    let p = 0;
    for (const a of c.ach) for (const t of a.t) if (done[t[0]]) (d++, (p += t[2]));
    return { d, p, full: d === c.n };
  }
  function totals() {
    let d = 0;
    let p = 0;
    let cards = 0;
    for (const c of cats) {
      const s = stat(c);
      d += s.d;
      p += s.p;
      if (c.card && s.full) cards++;
    }
    return { d, p, cards };
  }
  const ALL = () => cats.reduce((s, c) => s + c.n, 0);
  const PRIMOS = () => cats.reduce((s, c) => s + c.P, 0);
  const CARDS = () => cats.filter((c) => c.card).length;
  const newOnes = () => cats.flatMap((c) => c.ach.filter((a) => a.v === latest).map((a) => ({ c, a })));

  // ---- HEADER FACTS ----
  function facts() {
    const t = totals();
    // Four facts, so the line never wraps: the fourth is your count once you've ticked anything.
    const out = [
      `<b>${fmt(ALL())}</b>achievements`,
      `<b>${cats.length}</b>categories`,
      `<b>${fmt(PRIMOS())}</b>Primogems`,
      t.d ? `<b>${fmt(t.d)}</b>ticked by you` : `<b>${CARDS()}</b>namecards`,
    ];
    $('acFacts').innerHTML = out.map((x) => `<li>${x}</li>`).join('');
    // Klee's line under the header (Oct 27 2026): your progress once you tick, the totals before. facts() reruns on every tick.
    $('acKlee').textContent = t.d
      ? `You've ticked ${fmt(t.d)} of ${fmt(ALL())}. Klee is proud of you!`
      : `Klee counted ${fmt(ALL())} achievements worth ${fmt(PRIMOS())} Primogems! Tick the ones you've done.`;
  }

  // ---- PROGRESS: the wheel. One segment per category, clockwise from the top in the game's order. Its length
  // grows with the square root of its size (Wonders of the World alone is half the tiers and would swallow the
  // ring otherwise); it fills outward from the hub by your share done; a full category with a namecard turns
  // gold. The thin outer line in red = everything ticked. Hover = that category in the middle; click opens it.
  const W = 300;
  const pt = (a, r) => [(W + r * Math.cos((a * Math.PI) / 180)).toFixed(1), (W + r * Math.sin((a * Math.PI) / 180)).toFixed(1)];
  function arc(a0, a1, r1, r0) {
    const big = a1 - a0 > 180 ? 1 : 0;
    const [x0, y0] = pt(a0, r1);
    const [x1, y1] = pt(a1, r1);
    const [x2, y2] = pt(a1, r0);
    const [x3, y3] = pt(a0, r0);
    return `M${x0} ${y0}A${r1} ${r1} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${big} 0 ${x3} ${y3}Z`;
  }
  let drawn = false;
  function wheel() {
    const GAP = 0.7;
    const R0 = 178;
    const R1 = 248;
    const w = cats.map((c) => Math.sqrt(c.n));
    const sum = w.reduce((s, x) => s + x, 0);
    const room = 360 - GAP * cats.length;
    let a = -90;
    const segs = cats
      .map((c, i) => {
        const span = (w[i] / sum) * room;
        const s = stat(c);
        const r = R0 + (R1 - R0) * (s.d / c.n);
        const g = `<g class="ac-seg${s.full ? ' is-full' : ''}${c.card ? '' : ' no-card'}${f.c === c ? ' is-on' : ''}" data-c="${c.slug}"><path class="ac-seg-bg" d="${arc(a, a + span, R1, R0)}"/>${s.d ? `<path class="ac-seg-fill" d="${arc(a, a + span, r, R0)}"/>` : ''}<title>${esc(c.name)}: ${s.d} of ${c.n}</title></g>`;
        a += span + GAP;
        return g;
      })
      .join('');
    const t = totals();
    const C = 2 * Math.PI * 266;
    $('acWheel').innerHTML = `<svg viewBox="0 0 600 600" aria-hidden="true">
      <circle class="ac-w-glow" cx="${W}" cy="${W}" r="168"/>
      <circle class="ac-w-track" cx="${W}" cy="${W}" r="266"/>
      ${t.d ? `<circle class="ac-w-all" cx="${W}" cy="${W}" r="266" stroke-dasharray="${((t.d / ALL()) * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${W} ${W})"/>` : ''}
      ${segs}<circle class="ac-w-hub" cx="${W}" cy="${W}" r="164"/></svg><div class="ac-w-mid" id="acWMid"></div>`;
    $('acWheel').classList.toggle('is-first', !drawn); // the draw-in plays once, not on every tick
    drawn = true;
    wheelMid(null);
  }
  function wheelMid(c) {
    const mid = $('acWMid');
    if (!mid) return;
    if (!c) {
      const t = totals();
      mid.innerHTML = `<img src="/images/genshin/achievement/O001.webp" alt="" width="64" height="64"><b>${fmt(t.d)}</b><span>of ${fmt(ALL())} ticked</span><small>${pct(t.d, ALL())}</small>`;
      return;
    }
    const s = stat(c);
    mid.innerHTML = `<img src="${esc(c.medal)}" alt="" width="64" height="64"><em>${esc(c.name)}</em><span>${s.d} of ${c.n}</span><small>${s.full ? (c.card ? 'Namecard earned' : 'All done') : pct(s.d, c.n)}</small>`;
  }
  const pct = (d, n) => (d && d < n ? Math.max(1, Math.floor((d / n) * 100)) : Math.round((d / n) * 100)) + '%';

  function stats() {
    const t = totals();
    const nw = newOnes();
    const nwT = nw.reduce((s, x) => s + x.a.t.length, 0);
    const nwD = nw.reduce((s, x) => s + nDone(x.a), 0);
    $('acStats').innerHTML = `
      <div class="ac-stat"><span class="gi-label">Ticked</span><b>${fmt(t.d)}</b><small>of ${fmt(ALL())} · ${pct(t.d, ALL())}</small><i style="--p:${(t.d / ALL()) * 100}%"></i></div>
      <div class="ac-stat"><span class="gi-label">Primogems earned</span><b class="ac-stat-primo">${PRIMO}${fmt(t.p)}</b><small>${fmt(PRIMOS() - t.p)} still to earn</small><i style="--p:${(t.p / PRIMOS()) * 100}%"></i></div>
      <div class="ac-stat"><span class="gi-label">Namecards</span><b>${t.cards}</b><small>of ${CARDS()} earned</small><i style="--p:${(t.cards / CARDS()) * 100}%"></i></div>
      <div class="ac-stat"><span class="gi-label">New in ${esc(latest)}</span><b>${nwD}</b><small>of ${nwT} ticked</small><i style="--p:${nwT ? (nwD / nwT) * 100 : 0}%"></i></div>`;
  }

  // Closest to a namecard: started categories with the fewest left; before any tick, the quickest ones.
  function closest() {
    const open = cats
      .filter((c) => c.card)
      .map((c) => ({ c, s: stat(c) }))
      .filter((x) => !x.s.full);
    const started = open.filter((x) => x.s.d);
    const list = (started.length ? started : open).sort((a, b) => a.c.n - a.s.d - (b.c.n - b.s.d) || a.c.n - b.c.n).slice(0, 3);
    $('acCloseL').textContent = started.length ? 'Closest to a namecard' : 'Quickest namecards';
    $('acClose').innerHTML = list.length
      ? list
          .map(({ c, s }) => {
            const left = c.ach.flatMap((a) => a.t).filter((t) => !done[t[0]]);
            return `<button type="button" class="ac-near" data-c="${c.slug}">
              <img class="ac-near-m" src="${esc(c.medal)}" alt="" width="44" height="44">
              <span class="ac-near-t"><b>${esc(c.name)}</b><small>${fmt(left.length)} left · ${fmt(left.reduce((x, t) => x + t[2], 0))} Primogems</small><i style="--p:${(s.d / c.n) * 100}%"></i></span>
              <img class="ac-near-c" src="${esc(c.card[1])}" alt="" width="84" height="40" loading="lazy"></button>`;
          })
          .join('')
      : '<p class="ac-near-none">Every namecard earned. That’s the whole shelf.</p>';
  }

  // Compare with the game: the in-game count from the same /api/genshin the player page uses (Enka).
  function cmpOut() {
    const out = $('acCmpOut');
    if (!game) return (out.innerHTML = '');
    const t = totals();
    const diff = game.n - t.d;
    const line = !diff
      ? 'Matches your profile.'
      : diff > 0
        ? `${plural(diff, 'achievement')} done in game that ${diff === 1 ? 'isn’t' : 'aren’t'} ticked here.`
        : `${plural(-diff, 'more tick')} here than your profile shows.`;
    out.innerHTML = `<div class="ac-cmp-n"><span><b>${fmt(game.n)}</b><small>In game · ${esc(game.nick || 'UID ' + game.u)}</small></span><span><b>${fmt(t.d)}</b><small>Ticked here</small></span></div><p class="${diff > 0 ? 'is-gap' : ''}">${line}</p>`;
  }
  let asked = '';
  function compare(uid) {
    if (uid === asked) return;
    asked = uid;
    const st = $('acCmp').parentElement.querySelector('.gi-look-status');
    st.classList.remove('is-warn');
    st.textContent = `Looking up UID ${uid}…`;
    fetch(GI.API + '?uid=' + uid)
      .then(async (r) => {
        const d = await r.json().catch(() => ({ error: r.ok ? 'enka5xx' : 'unreachable' }));
        if (!r.ok || d.error) throw d.error || 'unreachable';
        return d;
      })
      .then((d) => {
        const p = d.playerInfo || {};
        if (typeof p.finishAchievementNum !== 'number') throw 'none';
        game = { u: uid, nick: String(p.nickname || '').slice(0, 40), n: p.finishAchievementNum, t: Math.floor(Date.now() / 1000) };
        store('gi-ach-game', game);
        st.textContent = 'From the profile Enka.Network sees. Check again any time.';
        cmpOut();
      })
      .catch((e) => {
        st.classList.add('is-warn');
        st.textContent =
          e === 'none'
            ? 'That profile doesn’t share an achievement count.'
            : LOOK_ERR[e] || 'Couldn’t reach the lookup. Check your connection and try again.';
      })
      .finally(() => (asked = ''));
  }

  function progress() {
    wheel();
    stats();
    closest();
    cmpOut();
  }

  // ---- NAMECARD SHELF (built once; shelfPaint() updates it) ----
  let shelfF = '';
  function shelf() {
    $('acShelf').innerHTML = cats
      .filter((c) => c.card)
      .map(
        (c) => `<button type="button" class="ac-nc" data-c="${c.slug}" aria-label="${esc(c.card[0])} namecard, from ${esc(c.name)}">
          <span class="ac-nc-art"><img src="${esc(c.card[1])}" alt="" width="840" height="400" loading="lazy" decoding="async"></span>
          <img class="ac-nc-m" src="${esc(c.medal)}" alt="" width="40" height="40" loading="lazy">
          <span class="ac-nc-t"><b>${esc(c.card[0])}</b><small>${esc(c.name)}</small></span><em class="ac-nc-s"></em></button>`,
      )
      .join('');
    shelfPaint();
  }
  function shelfPaint() {
    let got = 0;
    $('acShelf')
      .querySelectorAll('.ac-nc')
      .forEach((b) => {
        const c = bySlug(b.dataset.c);
        const s = stat(c);
        got += s.full;
        b.classList.toggle('is-got', s.full);
        b.hidden = (shelfF === 'got' && !s.full) || (shelfF === 'left' && s.full);
        b.querySelector('.ac-nc-s').textContent = s.full ? 'Earned' : `${c.n - s.d} left`;
      });
    $('acCardsSub').textContent = got
      ? `You've earned ${got} of ${CARDS()}. Finish a category to earn its namecard.`
      : `${CARDS()} namecards, one for each category you finish.`;
    syncArrows();
  }

  // ---- ROWS (checklist + New): the stars tick tiers; the text opens the tier list (and, on phones, the details) ----
  function row(a, c, withCat) {
    const n = a.t.length;
    const d = nDone(a);
    const ki = Math.max(
      0,
      a.t.findIndex((t) => !done[t[0]]),
    );
    const next = d === n ? a.t[n - 1] : a.t[ki];
    const name = (k) => (a.tn ? a.tn[k] : a.n);
    const stars = a.t
      .map(
        (t, k) =>
          `<button type="button" class="ac-star${done[t[0]] ? ' is-on' : ''}" data-t="${t[0]}" aria-pressed="${!!done[t[0]]}" aria-label="${esc(name(k))}${n > 1 ? `, tier ${k + 1} of ${n}` : ''}, ${t[2]} Primogems"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR}"/></svg></button>`,
      )
      .join('');
    const tiers =
      n > 1
        ? `<ol class="ac-tiers">${a.t.map((t, k) => `<li class="${done[t[0]] ? 'is-on' : ''}"><i>${'★'.repeat(k + 1)}</i><span>${esc(t[1])}</span><em>${t[2]}</em></li>`).join('')}</ol>`
        : '';
    const meta = [
      `<span class="ac-v">${esc(a.v)}</span>`,
      withCat ? `<span class="ac-in">${esc(c.name)}</span>` : '',
      n > 1 ? `<span>${d === n ? `All ${n} tiers` : `Tier ${ki + 1} of ${n}`}</span>` : '',
      a.q ? `<span class="ac-q">Part of <b>${a.q.map(esc).join(', ')}</b></span>` : '',
    ].join('');
    return `<article class="ac-row${d === n ? ' is-done' : d ? ' is-part' : ''}" data-a="${key(a)}"${withCat ? ' data-cat' : ''}>
      <div class="ac-stars" role="group" aria-label="${esc(a.n)}">${stars}</div>
      <button type="button" class="ac-row-t" aria-expanded="false"><b>${esc(name(d === n ? n - 1 : ki))}</b><span class="ac-desc">${esc(next[1])}</span><span class="ac-meta">${meta}</span></button>
      <span class="gi-primo ac-row-p">${PRIMO}${a.t.reduce((s, t) => s + t[2], 0)}</span>${tiers}</article>`;
  }

  // ---- CHECKLIST ----
  const bySlug = (s) => cats.find((c) => c.slug === s);
  const query = () => (f.q.trim().length >= 2 ? f.q.trim().toLowerCase() : '');
  function shown(a) {
    const d = nDone(a);
    if (f.show === 'todo' && d === a.t.length) return false;
    if (f.show === 'done' && d < a.t.length) return false;
    if (f.ver && a.v.split('.')[0] !== f.ver) return false;
    const q = query();
    return !q || a._s.includes(q);
  }
  function rail() {
    $('acRail').innerHTML = cats
      .map(
        (c) =>
          `<button type="button" class="ac-cat" data-c="${c.slug}"><img src="${esc(c.medal)}" alt="" width="40" height="40" loading="lazy"><span class="ac-cat-t"><b>${esc(c.name)}</b><small class="ac-cat-n"></small><i></i></span></button>`,
      )
      .join('');
    $('acRailN').textContent = cats.length + ' categories';
    railPaint();
  }
  function railPaint() {
    const q = query();
    $('acRail')
      .querySelectorAll('.ac-cat')
      .forEach((b) => {
        const c = bySlug(b.dataset.c);
        const s = stat(c);
        b.classList.toggle('is-on', !q && c === f.c);
        b.classList.toggle('is-full', s.full);
        b.classList.toggle('is-off', !!q && !c.ach.some(shown));
        b.setAttribute('aria-current', !q && c === f.c ? 'true' : 'false');
        b.querySelector('.ac-cat-n').textContent = `${s.d} / ${c.n}`;
        b.style.setProperty('--p', (s.d / c.n) * 100 + '%');
      });
    const c = f.c;
    const s = stat(c);
    $('acPick').innerHTML =
      `<img src="${esc(c.medal)}" alt="" width="40" height="40"><span class="ac-pick-t"><small>${q ? 'Searching every category' : 'Category ' + (cats.indexOf(c) + 1) + ' of ' + cats.length}</small><b>${esc(c.name)}</b></span><span class="ac-pick-n">${s.d} / ${c.n}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
  }
  function paneHead() {
    const q = query();
    const head = $('acPane').querySelector('.ac-ph');
    if (!head) return;
    if (q) {
      const hits = cats.map((c) => ({ c, l: c.ach.filter(shown) })).filter((x) => x.l.length);
      head.innerHTML = `<div class="ac-ph-t"><p class="gi-eyebrow">Search</p><h3>${plural(
        hits.reduce((s, x) => s + x.l.length, 0),
        'result',
      )}</h3><p class="ac-ph-reward">for “${esc(f.q.trim())}” in ${plural(hits.length, 'category')}</p></div><div class="ac-ph-keys"><button type="button" class="gi-key" data-clear-q>Clear search</button></div>`;
      return;
    }
    const c = f.c;
    const s = stat(c);
    const i = cats.indexOf(c);
    head.style.setProperty('--card', c.card ? `url('${c.card[1]}')` : 'none');
    head.classList.toggle('is-full', s.full);
    head.innerHTML = `<img class="ac-ph-m" src="${esc(c.medal)}" alt="" width="128" height="128">
      <div class="ac-ph-t"><p class="gi-eyebrow">Category ${i + 1} of ${cats.length}</p><h3 id="acPName">${esc(c.name)}</h3>
        <p class="ac-ph-reward">${c.card ? (s.full ? `Namecard earned: <b>${esc(c.card[0])}</b>` : `Finish all for the <b>${esc(c.card[0])}</b> namecard`) : 'Grows with every update. No namecard.'}</p></div>
      <div class="ac-ph-keys">
        <button type="button" class="gi-key ac-sq" data-step="-1" aria-label="Previous category"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
        <button type="button" class="gi-key ac-sq" data-step="1" aria-label="Next category"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
      </div>
      <div class="ac-ph-prog"><div class="ac-meter"><i style="--p:${(s.d / c.n) * 100}%"></i></div>
        <p><span><b>${s.d}</b> of ${plural(c.n, 'achievement')}</span><span class="gi-primo">${PRIMO}${fmt(s.p)} of ${fmt(c.P)}</span>
        <button type="button" class="ac-all" data-all>${s.full ? 'Untick all' : 'Tick all'}</button></p></div>`;
  }
  // The rows come 40 at a time, 20 on phones ("Show more"): Wonders of the World alone has 981, which would bury the rest
  // of the page. `entries` = what the filters let through (search adds a header per category).
  const PAGE = matchMedia('(max-width: 970px)').matches ? 20 : 40;
  let entries = [];
  let drawnTo = 0;
  function pane() {
    const q = query();
    entries = [];
    if (q)
      for (const c of cats) {
        const l = c.ach.filter(shown);
        if (l.length) entries.push({ h: c, n: l.length }, ...l.map((a) => ({ a, c })));
      }
    else entries = f.c.ach.filter(shown).map((a) => ({ a, c: f.c }));
    const why =
      f.show === 'todo' && !q && !f.ver
        ? 'Everything here is ticked. Pick another category.'
        : 'Nothing matches. Try another filter or word.';
    $('acPane').innerHTML =
      `<header class="ac-ph"></header><div class="ac-rows" id="acRows">${entries.length ? '' : `<p class="gi-empty ac-none">${why}</p>`}</div>`;
    drawnTo = 0;
    more();
    paneHead();
  }
  function more() {
    const rows = $('acRows');
    const old = rows.querySelector('.ac-more');
    if (old) old.remove();
    let html = '';
    let n = 0;
    let i = drawnTo;
    for (; i < entries.length && n < PAGE; i++) {
      const e = entries[i];
      if (e.h)
        html += `<h4 class="ac-grp"><button type="button" data-c="${e.h.slug}"><img src="${esc(e.h.medal)}" alt="" width="28" height="28" loading="lazy">${esc(e.h.name)}<small>${e.n}</small></button></h4>`;
      else ((html += row(e.a, e.c)), n++);
    }
    drawnTo = i;
    const left = entries.slice(i).filter((e) => !e.h).length;
    if (left)
      html += `<button type="button" class="gi-key ac-more" data-more>Show ${Math.min(PAGE, left)} more<small>${fmt(left)} left</small></button>`;
    rows.insertAdjacentHTML('beforeend', html);
  }
  function trays() {
    $('acShow')
      .querySelectorAll('[data-show]')
      .forEach((b) => b.classList.toggle('active', b.dataset.show === f.show));
    $('acVer')
      .querySelectorAll('[data-ver]')
      .forEach((b) => b.classList.toggle('active', b.dataset.ver === f.ver));
    const url = new URL(location.href);
    [
      ['c', f.c === cats[0] ? '' : f.c.slug],
      ['show', f.show],
      ['ver', f.ver],
      ['q', f.q.trim()],
    ].forEach(([k, v]) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k)));
    history.replaceState(null, '', url);
  }
  function list() {
    trays();
    railPaint();
    pane();
  }
  function openCat(c, go) {
    f.c = c;
    if (f.q) {
      f.q = '';
      $('acQ').value = '';
    }
    list();
    wheel();
    if ($('acSheet').open) closeSheet();
    if (!go && $('acPane').getBoundingClientRect().top < 0) $('acPane').scrollIntoView({ block: 'start' });
    if (go) GI.glide($('checklist')); // from the wheel, shelf, closest, New: an eased glide + the title rises in
    const on = $('acRail').querySelector('.is-on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  }

  // Phones: the categories open as a sheet (the same rail box, moved into the <dialog> and back).
  function openSheet() {
    $('acSheet').append($('acRailBox'));
    $('acSheet').showModal();
    $('acRail').focus({ preventScroll: true }); // not the close key: no focus ring on open
    const on = $('acRail').querySelector('.is-on');
    if (on) on.scrollIntoView({ block: 'center' });
  }
  function closeSheet() {
    $('acSheet').close();
  }
  $('acSheet').addEventListener('close', () => $('acPick').after($('acRailBox')));
  $('acSheet').addEventListener('click', (e) => e.target === $('acSheet') && closeSheet());

  // ---- NEW IN THE LATEST VERSION ----
  function fresh() {
    const list = newOnes();
    $('acNewV').textContent = latest + '.';
    const tiers = list.reduce((s, x) => s + x.a.t.length, 0);
    const p = list.reduce((s, x) => s + x.a.t.reduce((y, t) => y + t[2], 0), 0);
    $('acNewSub').textContent = `${plural(tiers, 'achievement')} worth ${fmt(p)} Primogems, added in version ${latest}.`;
    $('acNew').innerHTML = list
      .map(
        ({ c, a }) =>
          `<div class="gi-box ac-new-card"><button type="button" class="ac-new-c" data-c="${c.slug}"><img src="${esc(c.medal)}" alt="" width="28" height="28" loading="lazy">${esc(c.name)}</button>${row(a, c)}</div>`,
      )
      .join('');
    syncArrows();
  }

  // ---- BY THE NUMBERS ----
  const vkey = (v) => v.split('.').map(Number);
  const vcmp = (a, b) => vkey(a)[0] - vkey(b)[0] || vkey(a)[1] - vkey(b)[1];
  let vers = [];
  function chart() {
    const by = {};
    for (const c of cats)
      for (const a of c.ach) {
        const x = (by[a.v] = by[a.v] || { v: a.v, n: 0, d: 0, p: 0 });
        x.n += a.t.length;
        x.d += nDone(a);
        x.p += a.t.reduce((s, t) => s + t[2], 0);
      }
    vers = Object.values(by).sort((a, b) => vcmp(a.v, b.v));
    const max = Math.max(...vers.map((x) => x.n));
    const top = vers.reduce((a, b) => (b.n > a.n ? b : a));
    $('acChart').innerHTML =
      `<div class="ac-ch-head"><span class="gi-label">Achievements added per version</span><ul class="ac-ch-key"><li class="is-d">Ticked</li><li>Left</li></ul></div>
      <ol class="ac-bars" style="--n:${vers.length}">${vers
        .map(
          (x) =>
            `<li class="${x.v.endsWith('.0') ? 'is-major' : ''}${x === top ? ' is-max' : ''}" data-v="${x.v}" tabindex="0" aria-label="Version ${x.v}: ${x.n} achievements, ${x.d} ticked, ${x.p} Primogems"><i style="--h:${(x.n / max) * 100}%"><i style="--d:${x.n ? (x.d / x.n) * 100 : 0}%"></i></i><span>${x.v.endsWith('.0') ? x.v : ''}</span></li>`,
        )
        .join('')}</ol>
      <p class="ac-ch-out" id="acChOut" aria-live="polite"></p>`;
    chartOut(vers[vers.length - 1]);
  }
  function chartOut(x) {
    if (!x) return;
    $('acChOut').innerHTML =
      `<b>Version ${esc(x.v)}</b><span>${plural(x.n, 'achievement')}</span><span class="gi-primo">${PRIMO}${fmt(x.p)}</span><span>${x.d ? `${fmt(x.d)} ticked, ${fmt(x.n - x.d)} left` : 'None ticked yet'}</span>`;
  }
  function numFacts() {
    const big = cats.reduce((a, b) => (b.n > a.n ? b : a));
    const tiered = cats.reduce((s, c) => s + c.ach.filter((a) => a.t.length > 1).length, 0);
    const quest = cats.reduce((s, c) => s + c.ach.filter((a) => a.q).length, 0);
    const rich = vers.reduce((a, b) => (b.p > a.p ? b : a));
    const t = totals();
    const gap = t.d ? vers.find((x) => x.d < x.n) : null;
    $('acNumFacts').innerHTML = `
      <div class="gi-box ac-fact"><span class="gi-label">Biggest category</span><p class="ac-big"><b>${fmt(big.n)}</b></p><p><b>${esc(big.name)}</b> holds ${Math.round((big.n / ALL()) * 100)}% of every achievement, and it grows each update.</p></div>
      <div class="gi-box ac-fact"><span class="gi-label">With stars</span><p class="ac-big"><b>${tiered}</b></p><p>achievements come in two or three tiers, each with its own Primogems.</p></div>
      <div class="gi-box ac-fact"><span class="gi-label">From quests</span><p class="ac-big"><b>${quest}</b></p><p>name the quest they come from. Search a quest's name to find them.</p></div>
      ${
        gap
          ? `<div class="gi-box ac-fact"><span class="gi-label">Your oldest gap</span><p class="ac-big"><b>${esc(gap.v)}</b></p><p>${plural(gap.n - gap.d, 'achievement')} from version ${esc(gap.v)} still to tick. <button type="button" class="ac-link" data-ver-go="${esc(gap.v.split('.')[0])}">Show ${esc(gap.v.split('.')[0])}.x to do</button></p></div>`
          : `<div class="gi-box ac-fact"><span class="gi-label">Most generous update</span><p class="ac-big"><b>${esc(rich.v)}</b></p><p>added ${fmt(rich.p)} Primogems' worth of achievements, the most of any version.</p></div>`
      }`;
  }

  // ---- REFRESH after a tick: redraw the touched rows in place (keeping focus + open state), then the summaries ----
  function after(keys, pop) {
    for (const k of keys) {
      const { c, a } = A.get(k);
      document.querySelectorAll(`.ac-row[data-a="${k}"]`).forEach((el) => {
        const focus = el.contains(document.activeElement) ? document.activeElement.dataset.t || 'row' : null;
        const open = el.classList.contains('is-open');
        el.outerHTML = row(a, c, el.hasAttribute('data-cat'));
        const nodes = document.querySelectorAll(`.ac-row[data-a="${k}"]`);
        nodes.forEach((n) => n.classList.toggle('is-open', open));
        if (focus) {
          const n = [...nodes].find((x) => x.isConnected);
          const target = n && (focus === 'row' ? n.querySelector('.ac-row-t') : n.querySelector(`[data-t="${focus}"]`));
          if (target) target.focus({ preventScroll: true });
        }
        if (pop) nodes.forEach((n) => n.querySelectorAll(`[data-t="${pop}"]`).forEach((x) => x.classList.add('is-pop')));
      });
    }
    save();
    facts();
    progress();
    railPaint();
    paneHead();
    shelfPaint();
    chart();
    numFacts();
  }
  function setTier(id) {
    const { a, k } = T.get(id);
    const n = nDone(a) === k + 1 && done[id] ? k : k + 1; // tap the top lit star again = untick it
    const now = Math.floor(Date.now() / 1000);
    a.t.forEach((t, i) => {
      if (i < n) done[t[0]] = done[t[0]] || now;
      else delete done[t[0]];
    });
    after([key(a)], n > k ? id : 0);
  }
  let armed = null; // two-step buttons (Untick all, Clear all): the first tap arms, the second does it
  function arm(btn, text, fn) {
    if (armed && armed.btn === btn) {
      clearTimeout(armed.t);
      armed = null;
      return fn();
    }
    if (armed) armed.undo();
    const span = btn.querySelector('span') || btn;
    const was = span.textContent;
    span.textContent = text;
    btn.classList.add('is-armed');
    const undo = () => {
      span.textContent = was;
      btn.classList.remove('is-armed');
    };
    armed = { btn, undo, t: setTimeout(() => (undo(), (armed = null)), 4000) };
  }
  function tickAll(c) {
    const s = stat(c);
    const now = Math.floor(Date.now() / 1000);
    for (const a of c.ach) for (const t of a.t) s.full ? delete done[t[0]] : (done[t[0]] = done[t[0]] || now);
    after([]);
    pane();
  }

  // ---- YOUR DATA: UIAF v1.1 (uigf.org). Export = every ticked tier as status 3 ("reward taken"), current = its
  // target; import = status 2 or 3 counts as done. Unknown ids are skipped and counted. ----
  function exportFile() {
    const listOut = Object.keys(done)
      .map(Number)
      .filter((id) => T.has(id))
      .map((id) => {
        const { a, k } = T.get(id);
        return { id, current: a.t[k][3], status: 3, timestamp: done[id] };
      });
    const body = {
      info: { export_app: 'Parchrome', export_app_version: '1.0', uiaf_version: 'v1.1', export_timestamp: Math.floor(Date.now() / 1000) },
      list: listOut,
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(body)], { type: 'application/json' }));
    a.download = `genshin-achievements-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    say(`Downloaded ${plural(listOut.length, 'tick')} as a UIAF file.`);
  }
  const say = (t, warn) => {
    const m = $('acIoMsg');
    m.textContent = t;
    m.classList.toggle('is-warn', !!warn);
  };
  function importFile(file) {
    if (!file) return;
    if (file.size > 5e6) return say('That file is too big to be an achievement list.', true);
    file
      .text()
      .then((text) => {
        let d;
        try {
          d = JSON.parse(text);
        } catch (e) {
          return say('That isn’t a JSON file.', true);
        }
        if (!d || !Array.isArray(d.list)) return say('That file has no achievement list. It should be a UIAF export.', true);
        const now = Math.floor(Date.now() / 1000);
        const next = $('acReplace').checked ? {} : { ...done };
        let added = 0;
        let unknown = 0;
        for (const it of d.list) {
          const id = it && Number(it.id);
          if (!it || !Number.isInteger(id) || ![2, 3].includes(Number(it.status))) continue;
          if (!T.has(id)) {
            unknown++;
            continue;
          }
          if (!next[id]) added++;
          const ts = Number(it.timestamp);
          next[id] = next[id] || (Number.isFinite(ts) && ts > 1.5e9 && ts < now + 86400 ? Math.floor(ts) : now);
        }
        done = next;
        const from = d.info && typeof d.info.export_app === 'string' ? ' from ' + d.info.export_app.slice(0, 40) : '';
        say(
          `${$('acReplace').checked ? 'Replaced with' : 'Added'} ${plural(added, 'tick')}${from}.${unknown ? ` ${plural(unknown, 'id')} we don't know yet ${unknown === 1 ? 'was' : 'were'} skipped.` : ''}`,
        );
        after([]);
        list();
        fresh();
      })
      .catch(() => say('Couldn’t read that file.', true));
  }

  // ---- ROW ARROWS ----
  function syncArrows() {
    document.querySelectorAll('[data-row][data-dir]').forEach((b) => {
      const r = $(b.dataset.row);
      if (!r) return;
      b.disabled = +b.dataset.dir < 0 ? r.scrollLeft < 4 : r.scrollLeft + r.clientWidth > r.scrollWidth - 4;
    });
  }
  ['acShelf', 'acNew'].forEach((id) => $(id).addEventListener('scroll', syncArrows, { passive: true }));
  window.addEventListener('resize', syncArrows);

  // ---- EVENTS ----
  document.addEventListener('click', (e) => {
    if (!cats.length) return;
    const t = e.target;
    const star = t.closest('.ac-star');
    if (star) return setTier(+star.dataset.t);
    const open = t.closest('.ac-row-t');
    if (open) {
      const r = open.closest('.ac-row');
      open.setAttribute('aria-expanded', r.classList.toggle('is-open'));
      return;
    }
    const cat = t.closest('[data-c]');
    if (cat) {
      const c = bySlug(cat.dataset.c);
      if (c) openCat(c, !cat.closest('#acRailBox') && !cat.closest('.ac-rows'));
      return;
    }
    if (t.closest('[data-more]')) return more();
    const step = t.closest('[data-step]');
    if (step) return openCat(cats[(cats.indexOf(f.c) + +step.dataset.step + cats.length) % cats.length]);
    const all = t.closest('[data-all]');
    if (all) return stat(f.c).full ? arm(all, 'Tap again to untick all', () => tickAll(f.c)) : tickAll(f.c);
    if (t.closest('[data-clear-q]')) {
      f.q = $('acQ').value = '';
      return list();
    }
    const vg = t.closest('[data-ver-go]');
    if (vg) {
      Object.assign(f, { ver: vg.dataset.verGo, show: 'todo', q: '' });
      $('acQ').value = '';
      list();
      return GI.glide($('checklist'));
    }
    const arrow = t.closest('[data-row][data-dir]');
    if (arrow) {
      const r = $(arrow.dataset.row);
      r.scrollBy({ left: +arrow.dataset.dir * r.clientWidth * 0.85, behavior: still() ? 'auto' : 'smooth' });
    }
  });
  $('acPick').addEventListener('click', openSheet);
  $('acSheetClose').addEventListener('click', closeSheet);
  $('acShow').addEventListener('click', (e) => {
    const b = e.target.closest('[data-show]');
    if (b) ((f.show = b.dataset.show), list());
  });
  $('acVer').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ver]');
    if (b) ((f.ver = b.dataset.ver), list());
  });
  $('acShelfF').addEventListener('click', (e) => {
    const b = e.target.closest('[data-shelf]');
    if (!b) return;
    shelfF = b.dataset.shelf;
    $('acShelfF')
      .querySelectorAll('[data-shelf]')
      .forEach((x) => x.classList.toggle('active', x === b));
    $('acShelf').scrollLeft = 0;
    shelfPaint();
  });
  // Shelf "View more" (Oct 24 2026, Adrian): every card of the shelf, under its filter, two a row. The cards
  // are the shelf's own markup, copied on open; a card closes the panel, then opens its category as usual.
  const ncd = $('acNcd');
  $('acShelfAll').addEventListener('click', () => {
    $('acNcdGrid').innerHTML = $('acShelf').innerHTML;
    $('acNcdN').textContent = $('acCardsSub').textContent;
    ncd.showModal();
    $('acNcdBody').scrollTop = 0;
    $('acNcdBody').focus({ preventScroll: true });
  });
  $('acNcdX').addEventListener('click', () => ncd.close());
  ncd.addEventListener('click', (e) => (e.target === ncd || e.target.closest('[data-c]')) && ncd.close());
  GI.sheetDrag($('acNcdPanel'), [$('acNcdGrip'), $('acNcdBar')], $('acNcdBody'), () => ncd.close());
  let qt = 0;
  $('acQ').addEventListener('input', () => {
    clearTimeout(qt);
    qt = setTimeout(() => {
      f.q = $('acQ').value;
      list();
    }, 160);
  });
  $('acExport').addEventListener('click', exportFile);
  $('acImport').addEventListener('change', (e) => {
    importFile(e.target.files[0]);
    e.target.value = '';
  });
  const io = document.querySelector('.ac-io');
  io.addEventListener('dragover', (e) => {
    e.preventDefault();
    io.classList.add('is-drop');
  });
  io.addEventListener('dragleave', () => io.classList.remove('is-drop'));
  io.addEventListener('drop', (e) => {
    e.preventDefault();
    io.classList.remove('is-drop');
    importFile(e.dataTransfer.files[0]);
  });
  $('acReset').addEventListener('click', () => {
    const n = Object.keys(done).length;
    if (!n) return say('Nothing to clear yet.');
    arm($('acReset'), `Tap again to clear ${plural(n, 'tick')}`, () => {
      done = {};
      after([]);
      list();
      fresh();
      say('All ticks cleared.');
    });
  });
  // The chart: hover / focus a bar = its numbers under the chart.
  const chartPick = (e) => {
    const li = e.target.closest('[data-v]');
    if (li) chartOut(vers.find((x) => x.v === li.dataset.v));
  };
  $('acChart').addEventListener('mouseover', chartPick);
  $('acChart').addEventListener('focusin', chartPick);

  // The jump tray: glides to its section, and its raised pill slides to the section you're in (genshin-core.js).
  GI.jumpNav(document.querySelector('.ac-jump'));

  // ---- LOAD ----
  fetch('/genshin-achievements.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((db) => {
      latest = db.latest || '';
      cats = (db.cats || []).filter((c) => c.ach && c.ach.length);
      if (!cats.length) throw new Error('empty');
      for (const c of cats) {
        c.n = 0;
        c.P = 0;
        for (const a of c.ach) {
          a._s = [a.n, ...(a.tn || []), ...a.t.map((t) => t[1]), ...(a.q || []), c.name].join(' ').toLowerCase();
          A.set(key(a), { c, a });
          a.t.forEach((t, k) => {
            T.set(t[0], { c, a, k });
            c.n++;
            c.P += t[2];
          });
        }
      }
      // Drop ticks for ids that aren't in the data (bad storage); keep timestamps that look right.
      const clean = {};
      for (const [id, ts] of Object.entries(done && typeof done === 'object' ? done : {}))
        if (T.has(+id)) clean[id] = Number.isFinite(+ts) ? +ts : 0;
      done = clean;

      const ask = new URLSearchParams(location.search);
      f.c = bySlug(ask.get('c')) || cats[0];
      f.show = ['todo', 'done'].includes(ask.get('show')) ? ask.get('show') : '';
      const majors = [...new Set(cats.flatMap((c) => c.ach.map((a) => a.v.split('.')[0])))].sort((a, b) => a - b);
      f.ver = majors.includes(ask.get('ver')) ? ask.get('ver') : '';
      f.q = (ask.get('q') || '').slice(0, 60);
      $('acQ').value = f.q;
      $('acVer').innerHTML =
        `<button type="button" class="gi-tab" data-ver="">All</button>` +
        majors.map((m) => `<button type="button" class="gi-tab" data-ver="${m}">${m}.x</button>`).join('');

      $('acProg').innerHTML = `
        <div class="ac-wheel" id="acWheel"></div>
        <div class="ac-mid">
          <div class="ac-stats" id="acStats"></div>
          <div class="ac-cmp">
            <span class="gi-label">Compare with the game</span>
            <form class="gi-look-form" id="acCmp" autocomplete="off" novalidate>
              <label class="gi-uid"><span class="gi-vh">Your UID</span><input type="text" id="acUid" inputmode="numeric" maxlength="10" placeholder="Your UID, e.g. 800123456" spellcheck="false"><span class="gi-uid-server"></span></label>
              <button type="submit" class="gi-key"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg><span class="gi-key-t">Check</span></button>
            </form>
            <p class="gi-look-status" aria-live="polite">Your profile's achievement count, next to what you've ticked.</p>
            <div class="ac-cmp-out" id="acCmpOut"></div>
          </div>
        </div>
        <div class="ac-close"><span class="gi-label" id="acCloseL">Closest to a namecard</span><div class="ac-near-list" id="acClose"></div></div>`;
      // Prefill: the UID compared last, else the last one looked up on the player page.
      const recent = load('gi-uids', '[]');
      const uid = (game && game.u) || (recent[0] && (recent[0].u || recent[0])) || '';
      if (/^\d{9,10}$/.test(String(uid))) $('acUid').value = uid;
      if (game && !(Number.isInteger(game.n) && /^\d{9,10}$/.test(game.u))) game = null;
      GI.lookup($('acCmp'), compare);
      // The wheel (drawn here, so its listeners too): hover = that category in the middle; click opens it.
      $('acWheel').addEventListener('mouseover', (e) => {
        const g = e.target.closest('.ac-seg');
        if (g) wheelMid(bySlug(g.dataset.c));
      });
      $('acWheel').addEventListener('mouseleave', () => wheelMid(null));

      facts();
      progress();
      shelf();
      fresh();
      rail();
      list();
      chart();
      numFacts();
      // A #section link jumped before the rows existed (the page grew under it): jump again now.
      const at = location.hash && document.getElementById(location.hash.slice(1));
      if (at) at.scrollIntoView({ block: 'start', behavior: 'instant' });
    })
    .catch(() => {
      $('acProg').innerHTML = '<p class="gi-empty">Couldn’t load the achievements right now. Try again in a minute.</p>';
      $('acKlee').textContent = "Klee couldn't find the achievements. Try again in a minute!";
    });
})();
