// Genshin Impact -- Artifacts (/genshin-impact/artifacts, Oct 24 2026). Loads after genshin-core.js.
// Data: genshin-artifacts.json (feed script `artifacts()`: yatta sets + the wiki's domains/versions),
// genshin-artifact-picks.json (Best for, written by hand) and the feed's characters (faces for Best for).
// Square tiles like the in-game inventory; a tile opens the Inspect panel (?s=<slug>). Styles:
// genshin-artifacts.css. Everything from the data is third-party text, so it goes through esc().
(function () {
  const { $, esc, EL, NATIONS, SI, elIcon } = window.GI;
  const grid = $('afGrid');
  const dlg = $('afDlg');
  const STARS = (n) => '★'.repeat(n);
  const ELS = ['Pyro', 'Hydro', 'Anemo', 'Electro', 'Dendro', 'Cryo', 'Geo'];
  // The 2-piece filter's order, and the icon each chip wears (elements: their emblem).
  const STATS = [
    ...ELS,
    'Physical',
    'ATK',
    'HP',
    'DEF',
    'CRIT Rate',
    'Elemental Mastery',
    'Energy Recharge',
    'Healing',
    'Shield',
    'Attack DMG',
    'Skill DMG',
    'Burst DMG',
    'Resistance',
    'Nightsoul',
    'Other',
  ];
  const SHORT = { 'Elemental Mastery': 'EM', 'Energy Recharge': 'ER', 'CRIT Rate': 'CRIT' };
  const STAT_ICON = {
    ATK: 'atk',
    HP: 'hp',
    DEF: 'def',
    'CRIT Rate': 'cr',
    'Elemental Mastery': 'em',
    'Energy Recharge': 'er',
    Physical: 'phys',
  };
  const key = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const svg = (k) => (SI[k] ? `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${SI[k]}</svg>` : '');
  const statMark = (t) => (ELS.includes(t) ? `<img src="${elIcon(t.toLowerCase())}" alt="" width="16" height="16">` : svg(STAT_ICON[t]));
  // yatta marks key words as [[word]]: bold them (after escaping).
  const rich = (t) =>
    esc(t)
      .replace(/\[\[(.*?)\]\]/g, '<b>$1</b>')
      .replace(/\n/g, '<br>');
  const plain = (t) => String(t || '').replace(/\[\[|\]\]/g, '');
  const top = (s) => Math.max(...s.rarity);

  // ---- state, kept in the address ----
  const url = new URLSearchParams(location.search);
  const st = {
    sort: url.get('sort') === 'az' ? 'az' : 'new',
    stat: url.get('stat') || '',
    region: url.get('region') || '',
    rarity: url.get('rarity') || '',
    q: url.get('q') || '',
  };
  function save(open) {
    const p = new URLSearchParams();
    if (st.sort !== 'new') p.set('sort', st.sort);
    for (const k of ['stat', 'region', 'rarity', 'q']) if (st[k]) p.set(k, st[k]);
    if (open) p.set('s', open);
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  let sets = [];
  let picks = {};
  let faces = {};
  let newest = '';
  let shown = [];

  const regionOf = (s) => (s.domain ? s.domain.region : '');
  const nation = (name) => NATIONS.find((n) => n.name === name);

  // ---- TRAYS: one builder for the three filter rows; "All" first, then only values that exist ----
  function tray(el, field, values, label) {
    el.innerHTML =
      `<button type="button" class="gi-tab" data-v="">All</button>` +
      values.map((v) => `<button type="button" class="gi-tab" data-v="${esc(v.v)}">${v.mark || ''}${esc(v.t)}</button>`).join('');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      st[field] = b.dataset.v;
      render();
    });
    el.setAttribute('aria-label', label);
  }
  function paint() {
    const on = (el, v) => el.querySelectorAll('[data-v]').forEach((b) => b.classList.toggle('active', b.dataset.v === v));
    on($('afSort'), st.sort);
    on($('afStat'), st.stat);
    on($('afRegion'), st.region);
    on($('afRarity'), st.rarity);
    const n = (st.region ? 1 : 0) + (st.rarity ? 1 : 0);
    $('afMoreN').hidden = !n;
    $('afMoreN').textContent = n;
    $('afClear').hidden = !(st.stat || st.region || st.rarity || st.q);
  }

  // ---- TILE: a square, the set's flower on its rarity backing, name on the foot ----
  function tileHtml(s) {
    const r = top(s);
    const flower = s.pieces[0];
    const el = ELS.includes(s.tag) ? ` style="--af-el:${EL[s.tag]}"` : '';
    const rest = s.pieces
      .slice(1)
      .map((p) => `<img src="${esc(p.art)}" alt="" loading="lazy" decoding="async" width="40" height="40">`)
      .join('');
    return `<button type="button" class="af-tile r${r}${el ? ' has-el' : ''}" data-s="${esc(s.slug)}"${el} aria-label="${esc(s.name)}, ${r}-star">
      <span class="af-tile-art"><img src="${esc(flower.art)}" alt="" loading="lazy" decoding="async" width="256" height="256"></span>
      <span class="af-tile-tag">${statMark(s.tag)}${esc(SHORT[s.tag] || s.tag)}</span>
      ${s.new ? '<i class="af-new">New</i>' : ''}
      <span class="af-tile-foot"><b>${esc(s.name)}</b><span class="af-tile-pcs" aria-hidden="true">${rest}</span></span>
    </button>`;
  }

  function match(s) {
    if (st.stat && key(s.tag) !== st.stat) return false;
    if (st.region && key(regionOf(s) || 'elsewhere') !== st.region) return false;
    if (st.rarity && String(top(s)) !== st.rarity) return false;
    if (st.q) {
      const q = st.q.toLowerCase();
      const hay = [
        s.name,
        ...s.pieces.map((p) => p.name),
        ...s.bonus.map((b) => plain(b[1])),
        ...(picks[s.slug] || []),
        regionOf(s),
        s.domain ? s.domain.name : '',
      ]
        .join(' ')
        .toLowerCase();
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }

  function render() {
    paint();
    save(dlg.open && dlg.dataset.s);
    const list = sets.filter(match);
    if (st.sort === 'az') list.sort((a, b) => a.name.localeCompare(b.name));
    shown = list;
    $('afCount').textContent = list.length === sets.length ? sets.length + ' sets' : list.length + ' of ' + sets.length + ' sets';
    grid.innerHTML = list.length
      ? list.map(tileHtml).join('')
      : '<p class="gi-box gi-empty">No set matches that. <button type="button" class="af-clear" data-clear>Clear filters</button></p>';
  }

  // ---- INSPECT: the stage (picked piece + five slots) | bonuses, best for, where to farm ----
  function inspect(s, piece) {
    const r = top(s);
    const p = s.pieces[piece] || s.pieces[0];
    const idx = shown.indexOf(s);
    dlg.className = 'af-dlg r' + r;
    dlg.style.setProperty('--af-el', ELS.includes(s.tag) ? EL[s.tag] : '');
    dlg.dataset.s = s.slug;
    $('afDPos').textContent = idx >= 0 ? STARS(r) + ' · ' + (idx + 1) + ' of ' + shown.length : STARS(r);
    $('afDPrev').disabled = $('afDNext').disabled = idx < 0 || shown.length < 2;

    const slots = s.pieces
      .map(
        (x, i) =>
          `<button type="button" class="af-slot${i === s.pieces.indexOf(p) ? ' is-on' : ''}" data-piece="${i}" aria-pressed="${i === s.pieces.indexOf(p)}" title="${esc(x.slot)}"><img src="${esc(x.art)}" alt="${esc(x.slot)}" width="64" height="64"></button>`,
      )
      .join('');

    const bonus = s.bonus
      .map(
        (b) =>
          `<div class="af-bonus"><span class="af-bonus-n">${b[0]}<small>${b[0] === 1 ? 'piece' : 'pieces'}</small></span><p>${rich(b[1])}</p></div>`,
      )
      .join('');

    const who = (picks[s.slug] || []).filter((n) => faces[n]);
    const best = who.length
      ? `<section class="af-sec"><h3 class="af-h">Best for</h3><div class="af-best">${who
          .map(
            (n) =>
              `<a class="af-face" href="/genshin-impact/characters?q=${encodeURIComponent(n)}"><span class="gi-tile r${faces[n].rarity}"><img src="${esc(faces[n].icon)}" alt="" loading="lazy" width="56" height="56"></span><span>${esc(n)}</span></a>`,
          )
          .join('')}</div></section>`
      : '';

    const d = s.domain;
    const nat = d && nation(d.region);
    const pair = (s.pair || []).map((x) => sets.find((y) => y.slug === x)).filter(Boolean);
    const farm = d
      ? `<div class="af-dom"${nat ? ` style="--af-dom:url('/images/genshin/nation/${nat.key}.webp')"` : ''}>
          <span class="af-dom-k">Domain of Blessing</span>
          <b class="af-dom-n">${esc(d.name)}</b>
          <span class="af-dom-m">${esc([d.area, d.region].filter(Boolean).join(' · '))}</span>
          <ul class="af-dom-f"><li>Open every day</li><li>20 Original Resin a run</li></ul>
        </div>
        ${pair.length ? `<div class="af-pair"><span class="gi-label">Drops alongside</span>${pair.map((x) => `<button type="button" class="af-mini r${top(x)}" data-s="${esc(x.slug)}"><img src="${esc(x.pieces[0].art)}" alt="" width="48" height="48"><span>${esc(x.name)}</span></button>`).join('')}</div>` : ''}`
      : '';
    const other = s.from && s.from.length ? `<ul class="af-from">${s.from.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '';

    $('afIn').innerHTML = `
      <div class="af-stage">
        <div class="af-stage-art"><img src="${esc(p.art)}" alt="" width="256" height="256"></div>
        <div class="af-slots-row" role="group" aria-label="Pieces">${slots}</div>
        <div class="af-piece">
          <span class="gi-label">${esc(p.slot)}</span>
          <b>${esc(p.name)}</b>
          ${p.desc ? `<p>${rich(p.desc)}</p>` : ''}
        </div>
      </div>
      <div class="af-info">
        <h2 class="af-name" id="afDName">${esc(s.name)}</h2>
        <p class="af-meta"><span class="gi-rarity">${STARS(r)}</span>${s.rarity.length > 1 ? `<span>${Math.min(...s.rarity)}★ to ${r}★</span>` : ''}${s.version ? `<span>Added in ${esc(s.version)}</span>` : ''}<span class="af-tag">${statMark(s.tag)}${esc(s.tag)}</span></p>
        <section class="af-sec"><h3 class="af-h">Set bonus</h3>${bonus}</section>
        ${best}
        <section class="af-sec"><h3 class="af-h">Where to farm</h3>${farm}${other || (d ? '' : '<p class="af-none">No source listed yet.</p>')}</section>
      </div>`;
  }

  function open(slug, piece) {
    const s = sets.find((x) => x.slug === slug);
    if (!s) return;
    inspect(s, piece || 0);
    dlg.classList.remove('is-closing');
    if (!dlg.open) {
      dlg.showModal();
      $('afDBody').focus({ preventScroll: true });
    }
    $('afDBody').scrollTop = 0;
    save(slug);
  }
  function close() {
    if (!dlg.open || dlg.classList.contains('is-closing')) return;
    const done = () => {
      dlg.close();
      dlg.classList.remove('is-closing');
      delete dlg.dataset.s;
      save();
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
    dlg.classList.add('is-closing');
    setTimeout(done, 200);
  }
  // Phones: the sheet's grip / header drag down to close, like the Weapons sheet.
  window.GI.sheetDrag($('afPanel'), [$('afGrip'), $('afDBar')], $('afDBody'), close);

  function step(d) {
    const i = shown.findIndex((x) => x.slug === dlg.dataset.s);
    if (i < 0 || shown.length < 2) return;
    open(shown[(i + d + shown.length) % shown.length].slug);
  }

  // ---- events ----
  grid.addEventListener('click', (e) => {
    const t = e.target.closest('[data-s]');
    if (t) open(t.dataset.s);
    if (e.target.closest('[data-clear]')) clearAll();
  });
  $('afIn').addEventListener('click', (e) => {
    const slot = e.target.closest('[data-piece]');
    if (slot)
      inspect(
        sets.find((x) => x.slug === dlg.dataset.s),
        +slot.dataset.piece,
      );
    const mini = e.target.closest('[data-s]');
    if (mini) open(mini.dataset.s);
  });
  $('afDClose').addEventListener('click', close);
  $('afDPrev').addEventListener('click', () => step(-1));
  $('afDNext').addEventListener('click', () => step(1));
  $('afDCopy').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(location.origin + location.pathname + '?s=' + dlg.dataset.s).then(
      () => {
        b.classList.add('is-done');
        b.querySelector('span').textContent = 'Copied';
        setTimeout(() => {
          b.classList.remove('is-done');
          b.querySelector('span').textContent = 'Copy link';
        }, 1500);
      },
      () => {},
    );
  });
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close(); // the backdrop
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.target.closest('input')) return;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
  $('afSort').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    st.sort = b.dataset.v;
    render();
  });
  const q = $('afQ');
  q.value = st.q;
  q.addEventListener('input', () => {
    st.q = q.value.trim();
    render();
  });
  function clearAll() {
    st.stat = st.region = st.rarity = st.q = '';
    q.value = '';
    render();
  }
  $('afClear').addEventListener('click', clearAll);
  $('afMoreKey').addEventListener('click', (e) => {
    const on = $('afMore').classList.toggle('is-open');
    e.currentTarget.setAttribute('aria-expanded', on);
  });

  // ---- load ----
  const json = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))));
  Promise.all([json('/genshin-artifacts.json'), json('/genshin-artifact-picks.json').catch(() => ({})), window.GI.feed.catch(() => ({}))])
    .then(([db, pk, feed]) => {
      sets = (db.sets || []).filter((s) => s.pieces && s.pieces.length);
      picks = pk;
      (feed.characters || []).forEach((c) => (faces[c.name] = c));
      newest = (sets.find((s) => s.new) || {}).version || ''; // the file is newest first

      const tags = STATS.filter((t) => sets.some((s) => s.tag === t));
      tray(
        $('afStat'),
        'stat',
        tags.map((t) => ({ v: key(t), t: SHORT[t] || t, mark: statMark(t) })),
        '2-piece bonus',
      );
      const regions = NATIONS.map((n) => n.name).filter((n) => sets.some((s) => regionOf(s) === n));
      const extra = [...new Set(sets.map(regionOf).filter((x) => x && !regions.includes(x)))];
      tray(
        $('afRegion'),
        'region',
        [...regions, ...extra]
          .map((n) => ({ v: key(n), t: n }))
          .concat(sets.some((s) => !s.domain) ? [{ v: 'elsewhere', t: 'Not a domain' }] : []),
        'Where it drops',
      );
      const rar = [5, 4, 3].filter((r) => sets.some((s) => top(s) === r));
      tray(
        $('afRarity'),
        'rarity',
        rar.map((r) => ({ v: String(r), t: r + '★ max' })),
        'Highest rarity',
      );

      const doms = new Set(sets.filter((s) => s.domain).map((s) => s.domain.name)).size;
      $('afFacts').innerHTML = [
        `<b>${sets.length}</b> sets`,
        `<b>${sets.filter((s) => top(s) === 5).length}</b> go to 5★`,
        `<b>${doms}</b> domains`,
        newest ? `Newest: <b>${esc(newest)}</b>` : '',
      ]
        .filter(Boolean)
        .map((x) => `<li>${x}</li>`)
        .join('');

      render();
      const s = url.get('s');
      if (s) open(s);
    })
    .catch(() => {
      grid.innerHTML = '<p class="gi-box gi-empty">The artifact list didn’t load. Refresh to try again.</p>';
    });
})();
