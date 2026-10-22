// Genshin Impact rerun tracker (/genshin-impact/reruns, Oct 22 2026). Every character's
// wish history since 1.0 from /genshin-history.json (scripts/genshin-feed.py, from
// paimon.moe's banner list + our live feed), drawn against the roster in
// /genshin-feed.json. Shared helpers: genshin-core.js. Styles: genshin-reruns.css.
(function () {
  const { $, esc, now, MONTHS, tile, elIcon } = window.GI;
  const DAY = 86400;
  // History times are Asia server time (UTC+8); dates are shown as that day.
  const month = (t) => {
    const d = new Date((t + 8 * 3600) * 1000);
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  };
  const plural = (n, w) => n.toLocaleString() + ' ' + w + (n === 1 ? '' : 's');

  let rows = { 5: [], 4: [] };
  let state = { rarity: 5, sort: 'wait', el: '', q: '' };
  let T0 = 0;

  // One entry per character: every phase they were featured in, newest last.
  function build(history, roster) {
    const byName = Object.fromEntries(roster.map((c) => [c.name, c]));
    const runs = {};
    history.forEach((b) =>
      ['five', 'four'].forEach((k) =>
        b[k].forEach((name) => (runs[name] = runs[name] || []).push({ s: b.start, e: b.end, v: b.version, chron: b.kind === 'chronicled' }))
      )
    );
    const t = now();
    const out = { 5: [], 4: [] };
    Object.entries(runs).forEach(([name, list]) => {
      const c = byName[name];
      if (!c || !out[c.rarity]) return;
      const events = list.filter((r) => !r.chron);
      // Standard-banner 5-stars only ever come back in a Chronicled Wish: they aren't
      // limited, so a "wait" would mislead. Leave them out.
      if (c.rarity === 5 && !events.length) return;
      list.sort((a, b) => a.s - b.s);
      const last = list.reduce((a, r) => (r.e > a.e ? r : a));
      const live = list.some((r) => r.s <= t && t < r.e);
      const gaps = events.slice(1).map((r, i) => (r.s - events[i].e) / DAY);
      out[c.rarity].push({
        c,
        list,
        last,
        live,
        runs: events.length,
        chron: list.length - events.length,
        wait: live ? 0 : Math.floor((t - last.e) / DAY),
        debut: list[0].s,
        gap: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0,
      });
    });
    return out;
  }

  const pos = (s, e) => {
    const span = now() - T0;
    const l = ((s - T0) / span) * 100;
    return `left:${l.toFixed(2)}%;width:${Math.max(0.5, ((Math.min(e, now()) - s) / span) * 100).toFixed(2)}%`;
  };

  function row(r) {
    const c = r.c;
    const ticks = r.list
      .map((x) => `<i class="rt-tick${x.chron ? ' is-chron' : ''}${x === r.last ? ' is-last' : ''}${x.s <= now() && now() < x.e ? ' is-now' : ''}" style="${pos(x.s, x.e)}" title="${esc(x.chron ? 'Chronicled Wish' : 'Event Wish')} · v${esc(x.v)} · ${month(x.s)}"></i>`)
      .join('');
    const meta = [c.weapon, c.region].filter(Boolean).map(esc).join(' &middot; ');
    const count = plural(r.runs, 'run') + (r.chron ? ` + ${r.chron} Chronicled` : '');
    return `<details class="gi-box rt-row">
      <summary>${tile(c.icon, c.rarity, c.name)}
        <div class="rt-who"><b>${esc(c.name)}</b><span>${c.element ? `<img src="${elIcon(c.element.toLowerCase())}" alt="">` : ''}<i>${esc(c.element)}${meta ? ' &middot; ' + meta : ''}</i><em>${count}</em></span></div>
        <div class="rt-line" aria-hidden="true">${ticks}</div>
        <div class="rt-last"><b>${month(r.last.s)}</b><small>v${esc(r.last.v)} &middot; ${count}</small></div>
        <div class="rt-wait">${r.live ? '<span class="rt-now">On a banner now</span>' : `<b>${r.wait.toLocaleString()}</b><small>days</small>`}</div>
      </summary>
      <div class="rt-runs">
        <ol>${r.list.map((x) => `<li><b>v${esc(x.v)}</b>${x.chron ? 'Chronicled, ' : ''}${month(x.s)}</li>`).join('')}</ol>
        <p>First banner <b>${month(r.debut)}</b>${r.gap ? ` &middot; average wait between event banners <b>${plural(r.gap, 'day')}</b>` : ''}${r.live ? ' &middot; <b>on a banner right now</b>' : ` &middot; <b>${plural(r.wait, 'day')}</b> since the last one ended`}.</p>
      </div>
    </details>`;
  }

  const SORTS = {
    wait: (a, b) => b.wait - a.wait || a.c.name.localeCompare(b.c.name),
    runs: (a, b) => b.runs - a.runs || b.wait - a.wait,
    new: (a, b) => b.debut - a.debut || a.c.name.localeCompare(b.c.name),
  };

  function render() {
    const q = state.q.trim().toLowerCase();
    const list = rows[state.rarity].filter((r) => (!state.el || r.c.element === state.el) && (!q || r.c.name.toLowerCase().includes(q))).sort(SORTS[state.sort]);
    $('rtList').innerHTML = list.length ? list.map(row).join('') : '<p class="gi-box gi-empty rt-empty">No one matches that. Clear the search or pick another element.</p>';
    $('rtCount').textContent = `${list.length} of ${rows[state.rarity].length}`;
  }

  // Trays: the picked button raised, the rest in the well.
  function tray(id, key, parse) {
    const el = $(id);
    const paint = () =>
      el.querySelectorAll('.gi-tab').forEach((b) => {
        const on = parse(b.dataset.v) === state[key];
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on);
      });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('.gi-tab');
      if (!b) return;
      state[key] = parse(b.dataset.v);
      paint();
      render();
    });
    paint();
  }

  // The axis: Jan 1 of each year since the first banner.
  function axis() {
    const span = now() - T0;
    let html = '';
    for (let y = new Date(T0 * 1000).getUTCFullYear() + 1; Date.UTC(y, 0, 1) / 1000 < now(); y++) {
      const l = ((Date.UTC(y, 0, 1) / 1000 - T0) / span) * 100;
      html += `<span style="left:${l.toFixed(2)}%">${y}</span>`;
    }
    $('rtAxis').innerHTML = html;
  }

  const ELEMENTS = ['Pyro', 'Hydro', 'Anemo', 'Electro', 'Dendro', 'Cryo', 'Geo'];
  $('rtEl').innerHTML =
    '<button type="button" class="gi-tab" role="tab" data-v="">All</button>' +
    ELEMENTS.map((e) => `<button type="button" class="gi-tab" role="tab" data-v="${e}" aria-label="${e}" title="${e}"><img src="${elIcon(e.toLowerCase())}" alt=""></button>`).join('');

  Promise.all([
    GI.feed,
    fetch('/genshin-history.json').then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }),
  ])
    .then(([feed, hist]) => {
      const banners = hist.banners || [];
      T0 = banners.length ? banners[0].start : now() - 365 * DAY;
      rows = build(banners, feed.characters || []);
      const five = rows[5];
      const top = five.slice().sort(SORTS.wait)[0];
      $('rtFacts').innerHTML =
        `<li><b>${five.length}</b>limited 5&#9733;</li>` +
        (top ? `<li>longest wait <b>${esc(top.c.name)}, ${plural(top.wait, 'day')}</b></li>` : '') +
        `<li><b>${banners.filter((b) => b.kind === 'event').length}</b>wish phases since 1.0</li>`;
      axis();
      tray('rtRarity', 'rarity', Number);
      tray('rtSort', 'sort', String);
      tray('rtEl', 'el', String);
      $('rtQ').addEventListener('input', (e) => {
        state.q = e.target.value;
        render();
      });
      render();
    })
    .catch((err) => {
      console.error('Rerun data failed to load:', err);
      $('rtList').innerHTML = "<p class=\"gi-box gi-empty rt-empty\">Couldn't load the banner history right now. Try again in a bit.</p>";
    });
})();
