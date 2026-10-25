// Genshin Impact -- character pages (Oct 25 2026, rework v2): /genshin-impact/characters/<slug>. The page is
// written by scripts/genshin-characters.py with every word already in it; this script only adds what moves: the
// talent icons + level sliders, the goal planner, and the live
// parts (on the wishes now, the talent book's day on your server, birthday countdown, wish history). Numbers it
// needs ride in #cpData. Styles: genshin-character.css. Helpers: window.GI.
(function () {
  const { $, esc } = GI;
  const D = JSON.parse($('cpData').textContent);
  const num = (n) => Math.round(n).toLocaleString('en-US');

  // ---- a group of buttons that shows one of a set of panels (the talent icons) ----
  function picker(group, sel, key, panels) {
    if (!group) return;
    group.addEventListener('click', (e) => {
      const b = e.target.closest(sel);
      if (!b) return;
      const k = b.dataset[key];
      group.querySelectorAll(sel).forEach((x) => {
        const on = x === b;
        x.classList.toggle('active', on);
        x.setAttribute('aria-pressed', on);
      });
      panels.forEach((p) => {
        const on = p.dataset[key] === k;
        p.classList.toggle('is-on', on);
        p.setAttribute('aria-hidden', !on);
      });
    });
  }
  picker(document.querySelector('.cp-ttabs'), '.cp-ttab', 't', [...document.querySelectorAll('.cp-tpanel')]);

  // ---- phones: Talents | Constellations tabs (CSS shows the one named in #cpCol's data-m; desktop ignores it) ----
  const mtabs = $('cpMTabs');
  if (mtabs)
    mtabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      $('cpCol').dataset.m = b.dataset.m;
      mtabs.querySelectorAll('[data-m]').forEach((x) => {
        x.classList.toggle('active', x === b);
        x.setAttribute('aria-selected', x === b);
      });
    });

  // ---- talent level sliders: swap the numbers in; past 10 (C3 / C5) they turn the element colour ----
  document.querySelectorAll('.cp-range').forEach((r) => {
    const t = D.talents[+r.dataset.t];
    const table = document.querySelector(`.cp-scale-t[data-t="${r.dataset.t}"]`);
    const out = $('cpLvOut' + r.dataset.t);
    if (t.top > 10) r.nextElementSibling.style.setProperty('--m10', (9 / (t.top - 1)) * 100 + '%'); // the "10" mark on a 1-13 slider
    r.addEventListener('input', () => {
      const lv = +r.value;
      r.style.setProperty('--p', ((lv - 1) / (t.top - 1)) * 100 + '%');
      out.textContent = 'Lv ' + lv;
      table.querySelectorAll('td').forEach((td, i) => {
        td.textContent = t.rows[i][lv - 1];
        td.classList.toggle('is-new', lv > 10);
      });
    });
  });

  // ---- PLAN YOUR GOAL: steppers -> every material still needed (ascension phases + talent levels) ----
  const C = D.calc;
  const goal = { lv: [0, C.caps.length - 1], t0: [1, D.goal.normal || 10], t1: [1, D.goal.skill || 10], t2: [1, D.goal.burst || 10] };
  const range = { lv: [0, C.caps.length - 1], t0: [1, 10], t1: [1, 10], t2: [1, 10] };
  const label = (k, v) => 'Lv ' + (k === 'lv' ? (v ? C.caps[v] : 1) : v); // phase 0 = a new character, Lv 1
  const order = (id) => {
    id = +id;
    if (id >= 104300 && id < 104400 && id !== 104319) return 0; // talent books
    if (id >= 104100 && id < 104200) return 1; // gems
    if (id >= 113000 && id < 114000) return 2; // boss drops
    if (id >= 101000 && id < 102000) return 3; // specialty
    if (id === 104319) return 5; // Crown of Insight
    return 4;
  };
  function calc() {
    const need = {};
    let mora = 0;
    const add = ([coin, cost]) => {
      mora += coin;
      Object.entries(cost).forEach(([id, n]) => (need[id] = (need[id] || 0) + n));
    };
    for (let p = goal.lv[0] + 1; p <= goal.lv[1]; p++) add(C.asc[p - 1]);
    ['t0', 't1', 't2'].forEach((k) => {
      for (let l = goal[k][0] + 1; l <= goal[k][1]; l++) add(C.tal[l - 2]);
    });
    $('cpGoalMora').textContent = num(mora);
    $('cpGoalMats').innerHTML = Object.keys(need)
      .sort((a, b) => order(a) - order(b) || a - b)
      .map((id) => {
        const it = C.items[id];
        return it
          ? `<li title="${esc(it[0])}"><span class="gi-tile r${it[1]}"><img src="${esc(it[2])}" alt="" loading="lazy" decoding="async"></span><b>&times;${num(need[id])}</b><span class="gi-vh">${esc(it[0])}</span></li>`
          : '';
      })
      .join('');
    document.querySelectorAll('#cpGoal .cp-step').forEach((s) => {
      const k = s.dataset.k;
      s.querySelector('output').textContent = label(k, goal[k][s.querySelector('output').dataset.w === 'from' ? 0 : 1]);
      s.querySelectorAll('button').forEach((b) => {
        const v = goal[k][b.dataset.w === 'from' ? 0 : 1] + +b.dataset.d;
        b.disabled = v < range[k][0] || v > range[k][1];
      });
    });
  }
  // Materials: each total's key shows / hides its per-level breakdown.
  document.querySelectorAll('.cp-brk-key').forEach((key) =>
    key.addEventListener('click', () => {
      const open = key.getAttribute('aria-expanded') !== 'true';
      key.setAttribute('aria-expanded', open);
      $(key.getAttribute('aria-controls')).hidden = !open;
    })
  );

  const goalBox = $('cpGoal');
  if (goalBox) {
    goalBox.addEventListener('click', (e) => {
      const b = e.target.closest('.cp-step button');
      if (!b || b.disabled) return;
      const k = b.closest('.cp-step').dataset.k;
      const i = b.dataset.w === 'from' ? 0 : 1;
      const v = Math.min(range[k][1], Math.max(range[k][0], goal[k][i] + +b.dataset.d));
      goal[k][i] = v;
      if (goal[k][0] > goal[k][1]) goal[k][i ? 0 : 1] = v; // "now" never passes the goal: the other end follows
      calc();
    });
    calc();
  }

  // ---- VIDEO: swap the thumbnail for YouTube's player only on click (no player, no tracking before that) ----
  document.querySelectorAll('.cp-yt').forEach((box) =>
    box.querySelector('button').addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(box.dataset.yt) + '?autoplay=1&rel=0';
      f.title = box.querySelector('.cp-yt-t').textContent;
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      f.allowFullscreen = true;
      box.replaceChildren(f);
    }),
  );

  // ---- FARM: the talent book's day on the picked server + the birthday countdown ----
  const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function today() {
    const d = GI.gameDay();
    const wd = d.getUTCDay();
    document.querySelectorAll('.is-book').forEach((li) => {
      const open = li.dataset.open.split(',').map(Number);
      const st = li.querySelector('[data-book]');
      const isOpen = open.includes(wd);
      let next = '';
      for (let i = 1; i < 7 && !isOpen && !next; i++) if (open.includes((wd + i) % 7)) next = i === 1 ? 'tomorrow' : SHORT[(wd + i) % 7];
      st.textContent = isOpen ? 'Open today' : 'Opens ' + next;
      st.classList.toggle('is-open', isOpen);
      st.parentElement.title = 'Open ' + open.map((x) => SHORT[x]).join(', ');
    });
    $('cpToday').innerHTML = `${DAY[wd]} &middot; resets in <b data-end="${GI.nextReset()}"></b>`;
    const bd = $('cpBday');
    if (bd) {
      const y = d.getUTCFullYear();
      const base = Date.UTC(y, d.getUTCMonth(), d.getUTCDate());
      let next = Date.UTC(y, +bd.dataset.m - 1, +bd.dataset.d);
      if (next < base) next = Date.UTC(y + 1, +bd.dataset.m - 1, +bd.dataset.d);
      const n = Math.round((next - base) / 864e5);
      bd.textContent = n === 0 ? 'today!' : n === 1 ? 'tomorrow' : 'in ' + n + 'd';
    }
    GI.countdowns();
  }
  GI.serverTray($('cpSrv'), today);
  today();
  setInterval(GI.countdowns, 1000);

  // ---- LIVE: on the wishes now (feed) + her wish history (genshin-history.json) ----
  const DAYS = (s) => Math.round(s / 86400);
  const date = (t) => {
    const d = new Date((+t + 8 * 3600) * 1000);
    return GI.MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
  };
  Promise.all([GI.feed, fetch('/genshin-history.json').then((r) => (r.ok ? r.json() : Promise.reject(r.status)))])
    .then(([feed, hist]) => {
      const now = GI.now();
      const live = (feed.banners || []).find((b) => (b.characters || []).some((c) => c.id === D.id) && +b.end > now);
      const roster = Object.fromEntries((feed.characters || []).map((c) => [c.name, c]));
      const five = (roster[D.name] || {}).rarity === 5;
      // A 5-star's banners include Chronicled Wishes; a 4-star's count Event Wishes only (the Rerun tracker's rule).
      const runs = hist.banners.filter((b) => (five ? b.five.includes(D.name) : b.four.includes(D.name) && b.kind === 'event')).sort((a, b) => a.start - b.start);
      wishes(runs, roster, now, !!live);
    })
    .catch(() => ($('cpWishes').innerHTML = '<p class="gi-empty">Her wish history didn&rsquo;t load. Try again in a moment.</p>'));

  function wishes(runs, roster, now, onNow) {
    const box = $('cpWishes');
    if (!runs.length) {
      box.innerHTML = '<p class="gi-empty">Not on an event wish yet.</p>';
      return;
    }
    const past = runs.filter((r) => +r.start <= now);
    const gaps = past.slice(1).map((r, i) => DAYS(r.start - past[i].end));
    const avg = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0;
    const lastEnd = +past[past.length - 1].end;
    const ev = runs.filter((r) => r.kind === 'event').length;
    const cell = (k, v, s, cls) => `<div${cls ? ` class="${cls}"` : ''}><small>${k}</small><b>${v}</b><span>${s}</span></div>`;
    const nums = `<div class="cp-wnums">
      ${cell('Banners', runs.length, ev === runs.length ? 'all Event Wishes' : `${ev} Event · ${runs.length - ev} Chronicled`)}
      ${cell('First', esc(runs[0].version), date(runs[0].start))}
      ${cell(onNow ? 'On now' : 'Waiting', onNow ? 'Live' : num(DAYS(now - lastEnd)), onNow ? 'on the wishes' : 'days since her last banner', onNow ? 'is-now' : '')}
      ${cell('Usual wait', gaps.length ? num(avg) : '—', gaps.length ? `days on average, longest ${num(Math.max(...gaps))}` : 'one banner so far')}
    </div>`;
    // The line, first banner to today: filled dots = Event Wishes, hollow = Chronicled, dashes = the wait.
    const W = 1000, H = 70, L = 24, R = 24;
    const t0 = +runs[0].start;
    const t1 = Math.max(now, +runs[runs.length - 1].end);
    const x = (t) => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - R);
    let years = '';
    for (let y = new Date(t0 * 1000).getUTCFullYear() + 1; Date.UTC(y, 0, 1) / 1000 < t1; y++) {
      const xx = x(Date.UTC(y, 0, 1) / 1000);
      years += `<line class="yr" x1="${xx}" x2="${xx}" y1="12" y2="46"/><text x="${xx}" y="64">${y}</text>`;
    }
    const marks = runs
      .map((r) => {
        const xx = x((+r.start + +r.end) / 2);
        const isLive = +r.start <= now && +r.end > now;
        return `<circle class="${isLive ? 'live' : r.kind === 'event' ? 'ev' : 'ch'}" cx="${xx}" cy="30" r="${r.kind === 'event' ? 7 : 5}"/><text class="v" x="${xx}" y="12">${esc(r.version)}</text>`;
      })
      .join('');
    const wait = onNow ? '' : `<line class="wait" x1="${x(lastEnd)}" x2="${x(now)}" y1="30" y2="30"/>`;
    const line = `<div class="cp-wline"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${runs.length} banners since ${esc(runs[0].version)}">
      <line class="axis" x1="${L}" x2="${W - R}" y1="30" y2="30"/>${years}${wait}${marks}
      <line class="now" x1="${x(now)}" x2="${x(now)}" y1="18" y2="42"/><text class="now-t" x="${Math.min(W - 18, x(now))}" y="64">Today</text></svg></div>`;
    const rows = runs
      .slice()
      .reverse()
      .map((r) => {
        const isLive = +r.start <= now && +r.end > now;
        // paimon lists a Chronicled Wish's whole 4-star pool as featured, so those show their 5-stars only
        const mates = [...r.five, ...(r.kind === 'event' ? r.four : [])].filter((n) => n !== D.name && roster[n]);
        return `<li><b>${esc(r.version)}</b><span>${date(r.start)}</span><span class="cp-run-faces">${mates
          .map((n) => `<span class="gi-tile r${roster[n].rarity}" title="${esc(n)}"><img src="${esc(roster[n].icon)}" alt="${esc(n)}" loading="lazy" decoding="async"></span>`)
          .join('')}</span><em class="cp-tag${isLive ? ' is-live' : ''}">${isLive ? 'On now' : r.kind === 'event' ? 'Event' : 'Chronicled'}</em></li>`;
      })
      .join('');
    box.innerHTML = nums + line + `<ol class="cp-runs">${rows}</ol><p class="cp-quiet"><a href="/genshin-impact/reruns#c-${D.slug}">Every character&rsquo;s reruns on the Rerun tracker &rarr;</a></p>`;
  }
})();
