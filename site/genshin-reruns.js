// Genshin Impact rerun tracker (/genshin-impact/reruns; v2 Oct 23 2026). Every character's
// wish history since 1.0 from /genshin-history.json (scripts/genshin-feed.py, from
// paimon.moe's banner list + our live feed), drawn against the roster in
// /genshin-feed.json. Shared helpers: genshin-core.js. Styles: genshin-reruns.css.
//
// Sections it fills: Longest waits (#rtTop), Every character
// (filters + #rtList, state kept in the address), Every wish since 1.0 (#rtRibbon) and
// Rerun records (#rtRecs + #rtHist). Any face with data-go="<name>" opens that row.
//
// Counting rules (shown on the page in .gi-note):
// - A 5-star's runs = Event Wishes + Chronicled Wishes (both let you aim for them).
//   Standard-banner 5-stars only ever show up in Chronicled Wishes: left out.
// - A 4-star's runs = Event Wishes only. paimon lists a Chronicled Wish's whole 4-star
//   pool as "featured" (50 names in 6.7), which isn't a rate-up.
// - A gap = days from the end of one banner to the start of their next (overlaps skipped).
(function () {
  const { $, esc, now, MONTHS, tile, elIcon } = window.GI;
  const DAY = 86400;
  // History times are Asia server time (UTC+8); dates are shown as that day.
  const asia = (t) => new Date((t + 8 * 3600) * 1000);
  const month = (t) => MONTHS[asia(t).getUTCMonth()] + ' ' + asia(t).getUTCFullYear();
  const date = (t, yr) => {
    const d = asia(t);
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + (yr ? ', ' + d.getUTCFullYear() : '');
  };
  const span = (s, e) => (asia(s).getUTCFullYear() === asia(e).getUTCFullYear() ? date(s) : date(s, true)) + ' – ' + date(e, true);
  const days = (a, b) => Math.round((b - a) / DAY);
  const plural = (n, w) => n.toLocaleString() + ' ' + w + (n === 1 ? '' : 's');
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const ELEMENTS = ['Pyro', 'Hydro', 'Anemo', 'Electro', 'Dendro', 'Cryo', 'Geo'];
  const WEAPONS = ['Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst'];
  const VERSION_DAYS = 42; // a version is six weeks: the gap chart's bin

  let rows = { 5: [], 4: [] };
  let byName = {}; // roster entry by name
  let rowOf = {}; // tracker row by name
  let T0 = 0;

  // ---- STATE (kept in the address, like the Characters page) ----
  const SORTS = {
    wait: (a, b) => b.wait - a.wait || a.c.name.localeCompare(b.c.name),
    runs: (a, b) => b.list.length - a.list.length || b.wait - a.wait,
    new: (a, b) => b.debut - a.debut || a.c.name.localeCompare(b.c.name),
    az: (a, b) => a.c.name.localeCompare(b.c.name),
  };
  const url = new URLSearchParams(location.search);
  const pick = (v, list, d) => list.find((x) => x.toLowerCase() === (v || '').toLowerCase()) || d;
  const state = {
    rarity: url.get('r') === '4' ? 4 : 5,
    sort: pick(url.get('sort'), Object.keys(SORTS), 'wait'),
    el: pick(url.get('el'), ELEMENTS, ''),
    w: pick(url.get('w'), WEAPONS, ''),
    q: url.get('q') || '',
  };
  let topRarity = 5;
  function save() {
    const p = new URLSearchParams();
    if (state.rarity === 4) p.set('r', '4');
    if (state.sort !== 'wait') p.set('sort', state.sort);
    if (state.el) p.set('el', state.el.toLowerCase());
    if (state.w) p.set('w', state.w.toLowerCase());
    if (state.q.trim()) p.set('q', state.q.trim());
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  // ---- DATA ----
  // Chronicled Wishes take the version of the Event Wish running when they start
  // (paimon labels one of them by an older version).
  function normalize(banners) {
    const events = banners.filter((b) => b.kind === 'event');
    return banners.map((b) => {
      let v = b.version;
      if (b.kind === 'chronicled') {
        const host = events.filter((e) => e.start <= b.start).pop();
        if (host) v = host.version;
      }
      return { s: b.start, e: b.end, v, chron: b.kind === 'chronicled', five: b.five || [], four: b.four || [] };
    });
  }

  // One entry per character: every phase they were featured in, oldest first.
  function build(banners) {
    const runs = {};
    banners.forEach((b) => {
      b.five.forEach((n) => (runs[n] = runs[n] || []).push(b));
      if (!b.chron) b.four.forEach((n) => (runs[n] = runs[n] || []).push(b));
    });
    const t = now();
    const out = { 5: [], 4: [] };
    Object.entries(runs).forEach(([name, list]) => {
      const c = byName[name];
      if (!c || !out[c.rarity]) return;
      list = list.filter((b) => c.rarity === 5 || !b.chron).sort((a, b) => a.s - b.s);
      if (c.rarity === 5 && !list.some((b) => !b.chron)) return; // standard banner 5-star
      // Each run: its event-run number, and the gap since the banner before it.
      let end = 0;
      let prev = null;
      let n = 0;
      const gaps = [];
      const mine = list.map((b) => {
        const r = { b, s: b.s, e: b.e, v: b.v, chron: b.chron, n: b.chron ? 0 : ++n, live: b.s <= t && t < b.e };
        if (prev && b.s > end) gaps.push({ d: (r.gap = days(end, b.s)), from: prev, to: r });
        if (b.e > end) {
          end = b.e;
          prev = r;
        }
        return r;
      });
      const live = mine.find((r) => r.live);
      const ended = mine.filter((r) => r.e <= t);
      const lastEnd = ended.length ? Math.max(...ended.map((r) => r.e)) : t;
      const last = live || mine.reduce((a, r) => (r.e > a.e ? r : a));
      const avg = gaps.length ? Math.round(gaps.reduce((a, g) => a + g.d, 0) / gaps.length) : 0;
      const wait = live ? 0 : Math.floor((t - lastEnd) / DAY);
      const row = {
        c,
        list: mine,
        gaps,
        last,
        live,
        events: n,
        chron: mine.length - n,
        wait,
        avg,
        longest: gaps.reduce((a, g) => (!a || g.d > a.d ? g : a), null),
        ratio: !live && avg ? wait / avg : 0,
        debut: mine[0].s,
      };
      out[c.rarity].push(row);
      rowOf[name] = row;
    });
    return out;
  }

  // ---- PIECES ----
  const pos = (s, e) => {
    const all = now() - T0;
    return `left:${(((s - T0) / all) * 100).toFixed(2)}%;width:${Math.max(0.5, ((Math.min(e, now()) - s) / all) * 100).toFixed(2)}%`;
  };
  const runCount = (r) => plural(r.events, 'run') + (r.chron ? ` + ${r.chron} Chronicled` : '');
  // A face that opens that character's row (any data-go, see the click handler).
  function face(name, cls) {
    const c = byName[name];
    if (!c) return '';
    const tracked = rowOf[name];
    const inner = tile(c.icon, c.rarity, name);
    return tracked ? `<button type="button" class="rt-face ${cls || ''}" data-go="${esc(name)}" aria-label="${esc(name)}: open their banner history">${inner}</button>` : `<span class="rt-face ${cls || ''}">${inner}</span>`;
  }

  // ---- LONGEST WAITS: the top five, wish-card art ----
  function top() {
    const list = rows[topRarity].filter((r) => !r.live).sort(SORTS.wait).slice(0, 5);
    $('rtTopSub').textContent = `The ${topRarity}★ characters with the longest time since their last ${topRarity === 5 ? 'banner (Event or Chronicled)' : 'Event Wish'}.`;
    // Klee's line follows the picked rarity, so it always names this row's #1.
    if (list[0]) $('rtKlee').textContent = `${list[0].c.name} has waited longest: ${plural(list[0].wait, 'day')}. Come back soon!`;
    $('rtTop').innerHTML = list
      .map((r, i) => {
        const p = r.ratio ? Math.min(r.ratio / 2, 1) * 100 : 0;
        return `<button type="button" class="rt-tc r${r.c.rarity}" data-go="${esc(r.c.name)}" style="--i:${i}">
          ${r.c.strip ? `<img class="rt-tc-art" src="${esc(r.c.strip)}" alt="" loading="lazy" decoding="async">` : ''}
          <span class="rt-tc-rank">${i + 1}</span>
          <span class="rt-tc-body">
            <b class="rt-tc-name">${esc(r.c.name)}</b>
            <span class="rt-tc-days"><strong>${r.wait.toLocaleString()}</strong>days</span>
            <span class="rt-tc-meta">since v${esc(r.last.v)} &middot; ${month(r.last.s)}</span>
            ${
              r.ratio
                ? `<span class="rt-meter${r.ratio > 1 ? ' is-over' : ''}" style="--p:${p.toFixed(1)}%"><i></i></span><span class="rt-tc-meta">${r.ratio.toFixed(1)}&times; their usual ${plural(r.avg, 'day')}</span>`
                : '<span class="rt-tc-meta">Never rerun yet</span>'
            }
          </span>
        </button>`;
      })
      .join('');
  }

  // ---- EVERY CHARACTER: one row each ----
  function row(r) {
    const c = r.c;
    const ticks = r.list
      .map(
        (x) =>
          `<i class="rt-tick${x.chron ? ' is-chron' : ''}${x === r.last ? ' is-last' : ''}${x.live ? ' is-now' : ''}" style="${pos(x.s, x.e)}" title="${x.chron ? 'Chronicled Wish' : 'Event Wish'} · v${esc(x.v)} · ${esc(span(x.s, x.e))}"></i>`
      )
      .join('');
    const meta = [c.weapon, c.region].filter(Boolean).map(esc).join(' &middot; ');
    const p = r.ratio ? Math.min(r.ratio / 2, 1) * 100 : 0;
    const wait = r.live
      ? '<span class="rt-now">On a banner now</span>'
      : `<b>${r.wait.toLocaleString()}</b><small>days${r.ratio ? ` &middot; ${r.ratio.toFixed(1)}&times; usual` : r.list.length === 1 ? ' &middot; no rerun yet' : ''}</small>${
          r.ratio ? `<span class="rt-meter${r.ratio > 1 ? ' is-over' : ''}" style="--p:${p.toFixed(1)}%" title="${r.ratio.toFixed(1)}× their average gap of ${plural(r.avg, 'day')}"><i></i></span>` : ''
        }`;
    return `<details class="gi-box rt-row" id="c-${slug(c.name)}" data-name="${esc(c.name)}">
      <summary>${tile(c.icon, c.rarity, c.name)}
        <div class="rt-who"><b>${esc(c.name)}</b><span>${c.element ? `<img src="${elIcon(c.element.toLowerCase())}" alt="">` : ''}<i>${esc(c.element)}${meta ? ' &middot; ' + meta : ''}</i><em>${runCount(r)}</em></span></div>
        <div class="rt-line" aria-hidden="true">${ticks}</div>
        <div class="rt-last"><b>${r.live ? 'Now' : month(r.last.s)}</b><small>v${esc(r.last.v)} &middot; ${runCount(r)}</small></div>
        <div class="rt-wait">${wait}</div>
      </summary>
      <div class="rt-runs"></div>
    </details>`;
  }

  // Opened: every run as a card, the gap between each, then the sums. Built on first open.
  function runs(r) {
    const name = r.c.name;
    const cards = r.list
      .map((x, i) => {
        const co = x.b.five.concat(x.chron ? [] : x.b.four).filter((n) => n !== name);
        const shown = co.slice(0, 6);
        return `${x.gap && i ? `<span class="rt-gap" aria-label="${x.gap} days later"><b>${x.gap.toLocaleString()}</b>days</span>` : ''}
          <div class="rt-run${x.chron ? ' is-chron' : ''}${x.live ? ' is-now' : ''}">
            <div class="rt-run-top"><b>v${esc(x.v)}</b><span>${x.live ? 'Now' : x.chron ? 'Chronicled' : ord(x.n) + ' run'}</span></div>
            <p>${esc(span(x.s, x.e))}</p>
            ${co.length ? `<div class="rt-run-co">${shown.map((n) => face(n, 'is-sm')).join('')}${co.length > shown.length ? `<span class="rt-more">+${co.length - shown.length}</span>` : ''}</div>` : ''}
          </div>`;
      })
      .join('');
    const bits = [`First banner <b>${month(r.debut)}</b>`];
    if (r.avg) bits.push(`average gap <b>${plural(r.avg, 'day')}</b>`);
    if (r.longest && r.gaps.length > 1) bits.push(`longest <b>${plural(r.longest.d, 'day')}</b> (v${esc(r.longest.from.v)} to v${esc(r.longest.to.v)})`);
    bits.push(r.live ? '<b>on a banner right now</b>' : `<b>${plural(r.wait, 'day')}</b> since the last one ended`);
    return `<div class="rt-log">${cards}</div><p class="rt-sum">${bits.join(' &middot; ')}.</p>`;
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return rows[state.rarity].filter((r) => (!state.el || r.c.element === state.el) && (!state.w || r.c.weapon === state.w) && (!q || r.c.name.toLowerCase().includes(q)));
  }
  function render() {
    const list = filtered().sort(SORTS[state.sort]);
    $('rtList').innerHTML = list.length ? list.map(row).join('') : '<p class="gi-box gi-empty rt-empty">No one matches that. Clear the search or pick another element or weapon.</p>';
    $('rtCount').innerHTML = `<b>${list.length}</b> of ${rows[state.rarity].length}`;
    $('rtClear').hidden = !(state.el || state.w || state.q.trim());
    save();
  }
  // Rows build their run cards the first time they open.
  $('rtList').addEventListener(
    'toggle',
    (e) => {
      const d = e.target;
      if (!d.open || !d.classList.contains('rt-row')) return;
      const box = d.querySelector('.rt-runs');
      if (!box.firstChild) box.innerHTML = runs(rowOf[d.dataset.name]);
    },
    true
  );

  // Trays: the picked button raised, the rest in the well.
  function tray(id, get, set) {
    const el = $(id);
    const paint = () =>
      el.querySelectorAll('.gi-tab').forEach((b) => {
        const on = b.dataset.v === String(get());
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on);
      });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('.gi-tab');
      if (!b) return;
      set(b.dataset.v);
      paint();
    });
    paint();
    return paint;
  }

  // Open one character's row: switch rarity, drop filters that hide them, scroll to it.
  function go(name) {
    const r = rowOf[name];
    if (!r) return;
    if (!filtered().includes(r)) {
      state.rarity = r.c.rarity;
      state.el = state.w = state.q = '';
      $('rtQ').value = '';
      paints.forEach((p) => p());
      render();
    }
    const d = $('c-' + slug(name));
    if (!d) return;
    d.open = true;
    d.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    d.classList.remove('is-flash');
    void d.offsetWidth;
    d.classList.add('is-flash');
    history.replaceState(null, '', location.pathname + location.search + '#c-' + slug(name));
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    e.preventDefault();
    go(b.dataset.go);
  });

  // The axis over the timelines: a band per major version (1.x, 2.x...) and Jan 1 of each year.
  // The same bands sit behind every row's line (--bands), so a tick reads against its version.
  function axis(banners) {
    const all = now() - T0;
    const at = (t) => (((t - T0) / all) * 100).toFixed(2);
    const majors = [];
    banners.forEach((b) => {
      const m = String(b.v).split('.')[0];
      if (!b.chron && m && !majors.some((x) => x.m === m)) majors.push({ m, s: b.s });
    });
    let grad = [];
    let bands = '';
    majors.forEach((x, i) => {
      const a = i ? at(x.s) : 0;
      const b = i + 1 < majors.length ? at(majors[i + 1].s) : 100;
      const fill = i % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0)';
      grad.push(`${fill} ${a}% ${b}%`);
      bands += `<span class="rt-ax-v" style="left:${a}%;width:${(b - a).toFixed(2)}%">${esc(x.m)}.x</span>`;
    });
    $('all').style.setProperty('--bands', `linear-gradient(90deg, ${grad.join(', ')})`);
    let years = '';
    for (let y = asia(T0).getUTCFullYear() + 1; Date.UTC(y, 0, 1) / 1000 < now(); y++) years += `<span class="rt-ax-y" style="left:${at(Date.UTC(y, 0, 1) / 1000)}%">${y}</span>`;
    $('rtAxis').innerHTML = bands + years + '<span class="rt-ax-now">Today</span>';
  }

  // ---- EVERY WISH SINCE 1.0: one column per phase, grouped by version ----
  function ribbon(banners) {
    const groups = [];
    banners.forEach((b) => {
      const g = groups[groups.length - 1];
      if (g && g.v === b.v) g.list.push(b);
      else groups.push({ v: b.v, list: [b] });
    });
    const t = now();
    $('rtRibbon').innerHTML = groups
      .map(
        (g) => `<div class="rt-ver"><span class="rt-ver-n">${esc(g.v)}</span><div class="rt-ver-ph">${g.list
          .map((b) => {
            const isNow = b.s <= t && t < b.e;
            return `<div class="rt-ph${b.chron ? ' is-chron' : ''}${isNow ? ' is-now' : ''}" title="${b.chron ? 'Chronicled Wish' : 'Event Wish'} · v${esc(b.v)} · ${esc(span(b.s, b.e))}">
              <span class="rt-ph-d">${isNow ? 'Now' : b.chron ? 'Chronicled' : date(b.s)}</span>
              <div class="rt-ph-5">${b.five.map((n) => face(n)).join('')}</div>
              ${b.chron ? '' : `<div class="rt-ph-4">${b.four.map((n) => face(n, 'is-sm')).join('')}</div>`}
            </div>`;
          })
          .join('')}</div></div>`
      )
      .join('');
    const el = $('rtRibbon');
    el.scrollLeft = el.scrollWidth; // newest first in view
    const arrows = () => {
      $('rtRibPrev').disabled = el.scrollLeft < 4;
      $('rtRibNext').disabled = el.scrollLeft + el.clientWidth > el.scrollWidth - 4;
    };
    el.addEventListener('scroll', arrows, { passive: true });
    arrows();
    [$('rtRibPrev'), $('rtRibNext')].forEach((k) =>
      k.addEventListener('click', () => el.scrollBy({ left: (k.id === 'rtRibNext' ? 1 : -1) * el.clientWidth * 0.8, behavior: 'smooth' }))
    );
  }

  // ---- RERUN RECORDS: tiles + how long a 5-star's rerun takes ----
  function records(phases) {
    const five = rows[5];
    const four = rows[4];
    const gaps = five.flatMap((r) => r.gaps.map((g) => Object.assign({ r }, g)));
    const most = (list, key) => {
      const max = Math.max(...list.map(key));
      return { max, who: list.filter((r) => key(r) === max).map((r) => r.c.name) };
    };
    const faces = (names) => `<div class="rt-rec-faces">${names.slice(0, 4).map((n) => face(n)).join('')}</div>`;
    const names = (list) => list.map(esc).join(list.length === 2 ? ' &amp; ' : ', ');
    const tileHtml = (label, value, unit, who, detail) =>
      `<div class="gi-box rt-rec"><span class="gi-label">${label}</span><p class="rt-rec-v"><b>${value}</b>${unit}</p>${who}<p class="rt-rec-d">${detail}</p></div>`;
    const sorted = gaps.map((g) => g.d).sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const longest = gaps.reduce((a, g) => (!a || g.d > a.d ? g : a), null);
    const quickest = gaps.reduce((a, g) => (!a || g.d < a.d ? g : a), null);
    const runsTop = most(five, (r) => r.list.length);
    const fourTop = most(four, (r) => r.events);
    const once = five.filter((r) => r.list.length === 1 && !r.live).sort(SORTS.wait);
    const html = [];
    if (longest)
      html.push(tileHtml('Longest wait between runs', longest.d.toLocaleString(), 'days', faces([longest.r.c.name]), `${esc(longest.r.c.name)}, v${esc(longest.from.v)} to v${esc(longest.to.v)}`));
    if (quickest)
      html.push(tileHtml('Quickest comeback', quickest.d.toLocaleString(), quickest.d === 1 ? 'day' : 'days', faces([quickest.r.c.name]), `${esc(quickest.r.c.name)}, v${esc(quickest.from.v)} to v${esc(quickest.to.v)}`));
    html.push(tileHtml('Most 5&#9733; banners', runsTop.max, 'banners', faces(runsTop.who), names(runsTop.who)));
    html.push(tileHtml('Most featured 4&#9733;', fourTop.max, 'Event Wishes', faces(fourTop.who), names(fourTop.who)));
    html.push(
      tileHtml(
        'Never rerun yet',
        once.length,
        once.length === 1 ? 'limited 5&#9733;' : 'limited 5&#9733;s',
        faces(once.map((r) => r.c.name)),
        once.length ? `Waiting longest: ${esc(once[0].c.name)}, ${plural(once[0].wait, 'day')}` : 'Every limited 5&#9733; has had a second banner.'
      )
    );
    html.push(tileHtml('Wish phases since 1.0', phases.filter((b) => !b.chron).length, 'Event Wish phases', '', `plus ${phases.filter((b) => b.chron).length} Chronicled Wishes`));
    $('rtRecs').innerHTML = html.join('');

    // The chart: every 5-star comeback, binned by version (42 days). Median bin in red.
    if (!sorted.length) return;
    const bins = Array.from({ length: Math.floor(sorted[sorted.length - 1] / VERSION_DAYS) + 1 }, () => []);
    gaps.forEach((g) => bins[Math.floor(g.d / VERSION_DAYS)].push(g));
    const peak = Math.max(...bins.map((b) => b.length));
    const mid = Math.floor(median / VERSION_DAYS);
    $('rtHist').style.setProperty('--n', bins.length);
    $('rtHistSub').innerHTML = `Every time a limited 5&#9733; came back (${sorted.length} comebacks), by how long it took. Half came back within <b>${plural(median, 'day')}</b>, about ${Math.round(median / VERSION_DAYS)} versions.`;
    $('rtHist').innerHTML =
      `<div class="rt-hist-bars">${bins
        .map((b, i) => {
          const lo = i * VERSION_DAYS;
          const who = b
            .slice()
            .sort((x, y) => x.d - y.d)
            .map((g) => esc(g.r.c.name));
          const list = who.length > 6 ? who.slice(0, 6).join(', ') + ` +${who.length - 6}` : who.join(', ');
          return `<div class="rt-bin${i === mid ? ' is-mid' : ''}${b.length ? '' : ' is-zero'}" tabindex="${b.length ? 0 : -1}" style="--h:${((b.length / peak) * 100).toFixed(1)}%">
            <i></i>${b.length ? `<span class="rt-tip" role="tooltip"><b>${plural(b.length, 'comeback')}</b>${lo}–${lo + VERSION_DAYS - 1} days later${list ? `<small>${list}</small>` : ''}</span>` : ''}
          </div>`;
        })
        .join('')}</div>` +
      `<div class="rt-hist-x">${bins.map((b, i) => `<span>${i % 4 === 0 ? i : ''}</span>`).join('')}</div>` +
      `<p class="rt-hist-cap"><span class="gi-label">Versions later (42 days each)</span><span class="rt-hist-key"><i></i>median</span></p>`;
  }

  // ---- CONTROLS ----
  $('rtEl').innerHTML =
    '<button type="button" class="gi-tab" data-v="">All</button>' +
    ELEMENTS.map((e) => `<button type="button" class="gi-tab" data-v="${e}" aria-label="${e}" title="${e}"><img src="${elIcon(e.toLowerCase())}" alt=""></button>`).join('');
  $('rtW').innerHTML = '<button type="button" class="gi-tab" data-v="">All</button>' + WEAPONS.map((w) => `<button type="button" class="gi-tab" data-v="${w}">${w}</button>`).join('');
  $('rtQ').value = state.q;

  let paints = [];
  Promise.all([
    GI.feed,
    fetch('/genshin-history.json').then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }),
  ])
    .then(([feed, hist]) => {
      const banners = normalize(hist.banners || []);
      byName = Object.fromEntries((feed.characters || []).map((c) => [c.name, c]));
      T0 = banners.length ? banners[0].s : now() - 365 * DAY;
      rows = build(banners);
      const five = rows[5];
      const longest = five.slice().sort(SORTS.wait)[0];
      const onNow = Object.values(rowOf).filter((r) => r.live).length;
      $('rtFacts').innerHTML =
        `<li><b>${five.length}</b>limited 5&#9733;</li><li><b>${rows[4].length}</b>4&#9733;</li>` +
        (longest ? `<li>longest wait <b>${esc(longest.c.name)}, ${plural(longest.wait, 'day')}</b></li>` : '') +
        (onNow ? `<li><b>${onNow}</b>on the wishes now</li>` : '');
      axis(banners);
      paints = [
        tray('rtRarity', () => state.rarity, (v) => ((state.rarity = +v), render())),
        tray('rtSort', () => state.sort, (v) => ((state.sort = v), render())),
        tray('rtEl', () => state.el, (v) => ((state.el = v), render())),
        tray('rtW', () => state.w, (v) => ((state.w = v), render())),
      ];
      tray('rtTopR', () => topRarity, (v) => ((topRarity = +v), top()));
      $('rtQ').addEventListener('input', (e) => {
        state.q = e.target.value;
        render();
      });
      $('rtClear').addEventListener('click', () => {
        state.el = state.w = state.q = '';
        $('rtQ').value = '';
        paints.forEach((p) => p());
        render();
      });
      top();
      render();
      ribbon(banners);
      records(banners);
      // A shared link to one character (#c-<name>) opens their row.
      const hash = location.hash.slice(3);
      const hit = hash && Object.values(rowOf).find((r) => slug(r.c.name) === hash);
      if (hit) setTimeout(() => go(hit.c.name), 300);
    })
    .catch((err) => {
      console.error('Rerun data failed to load:', err);
      $('rtList').innerHTML = "<p class=\"gi-box gi-empty rt-empty\">Couldn't load the banner history right now. Try again in a bit.</p>";
    });
})();
