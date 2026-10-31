// Genshin Impact -- Daily domains (/genshin-impact/farm, Oct 24 2026; "Farm today" until Oct 27). Styles: genshin-farm.css.
// Data: the feed's `farm` (scripts/genshin-feed.py farm(): per day group, each nation's talent
// book with its tiers, domain and users, and its weapon material) + /genshin-weapons.json (each
// weapon's `forge` = [day group 0-2, city, domain], so weapons are matched to their material by
// day group + nation; loaded after the feed, the cards fill in when it lands).
// Thursday / Friday / Saturday repeat Monday / Tuesday / Wednesday; Sunday opens every domain.
// "My characters" = character ids in localStorage gi-farm-mine (try/catch: the page works without it).
// Everything from the feed is third-party text, so it goes through esc() before it reaches markup.
(function () {
  const { $, esc, tile, NATIONS, EL, gameDay, nextReset, now, parts, pad, serverTray, elIcon } = window.GI;
  const GROUPS = ['monday', 'tuesday', 'wednesday'];
  const TABS = {
    monday: { short: 'Mon · Thu', days: [1, 4] },
    tuesday: { short: 'Tue · Fri', days: [2, 5] },
    wednesday: { short: 'Wed · Sat', days: [3, 6] },
    sunday: { short: 'Sunday', days: [0] },
  };
  const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SERVER = { asia: 'Asia', america: 'America', europe: 'Europe' };
  const tabOf = (wd) => Object.keys(TABS).find((k) => TABS[k].days.includes(wd));
  const weekday = () => gameDay().getUTCDay();
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); // = genshin-weapons.js slug, for ?w=
  const natIcon = (n) => (n.el ? elIcon(n.el) : n.icon);
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  let F = null; // feed.farm
  let W = null; // weapons by 'group|city', 5-stars first
  let chars = []; // feed characters that use a book (Traveler has none here)
  const byName = {};
  const byId = {};
  const bookOf = {}; // character name -> {g, book}
  let tab = '';
  let today = -1; // the weekday drawn last; the tick redraws when the game day flips
  const openWeps = new Set(); // cards showing their 1-3 star weapons too

  let mine = new Set();
  try {
    mine = new Set(JSON.parse(localStorage.getItem('gi-farm-mine') || '[]').filter(Number.isInteger));
  } catch (e) {}
  const save = () => {
    try {
      localStorage.setItem('gi-farm-mine', JSON.stringify([...mine]));
    } catch (e) {}
  };
  const isMine = (name) => byName[name] && mine.has(byName[name].id);

  // ---- PIECES ----
  // Tiers lowest first, on the game's rarity backings (books 2-4 stars, weapon materials 2-5),
  // with a small chevron between: three of one craft one of the next.
  const tiers = (m) =>
    `<div class="fm-tiers">${(m.tiers || [[m.series || m.name, m.icon]]).map(([n, ic], i) => tile(ic, 2 + i, n)).join('<i class="fm-chev" aria-hidden="true"></i>')}</div>`;
  // A face is a button: tapping it adds / removes that character from My characters.
  const face = (u) => {
    const on = isMine(u.name);
    return `<button type="button" class="fm-face${on ? ' is-mine' : ''}" data-id="${byName[u.name].id}" aria-pressed="${on}">${tile(u.icon, u.rarity, u.name)}</button>`;
  };
  const users = (b) => (b.users || []).filter((u) => byName[u.name]).sort((x, y) => y.rarity - x.rarity || x.name.localeCompare(y.name));
  const wepLink = (w) => `<a class="fm-wpn" href="/genshin-impact/weapons?w=${slug(w.name)}">${tile(w.icon, w.rarity, w.name)}</a>`;
  function weps(g, city) {
    if (!W) return '<p class="fm-wait">Loading weapons&hellip;</p>';
    const key = g + '|' + city;
    const list = W[key] || [];
    // 4 and 5-stars first (the list is sorted), at most two rows of them; the key shows the rest,
    // the 1 to 3-stars included. Some materials have 26 weapons.
    const cap = matchMedia('(max-width: 970px)').matches ? 9 : 11;
    const top = list.filter((w) => w.rarity >= 4).slice(0, cap);
    const rest = list.slice(top.length);
    const open = openWeps.has(key);
    return `<div class="fm-weps">${top.map(wepLink).join('')}${open ? rest.map(wepLink).join('') : ''}${
      rest.length ? `<button type="button" class="fm-more" data-weps="${esc(key)}" aria-expanded="${open}" title="${open ? 'Show fewer weapons' : `Show all ${list.length} weapons`}">${open ? 'Fewer' : '+' + rest.length}</button>` : ''
    }</div>`;
  }
  const head = (n, extra) =>
    `<header class="fm-card-head" style="--img:url('/images/genshin/nation/${n.key}.webp')"><img src="${natIcon(n)}" alt="" width="28" height="28"><h3>${esc(n.name)}</h3>${extra || ''}</header>`;

  // A weekday card: the nation's book (tiers, domain, who uses it) beside its weapon material
  // (tiers, domain, the weapons that ascend with it).
  function dayCard(n, g, b, m) {
    const us = b ? users(b) : [];
    const mineN = us.filter((u) => isMine(u.name)).length;
    const nW = W && m ? (W[g + '|' + n.name] || []).length : 0;
    return `<article class="gi-box fm-card">${head(n, mine.size ? `<span class="fm-tag${mineN ? ' is-on' : ''}">${mineN ? mineN + ' of yours' : 'None of yours'}</span>` : '')}
      <div class="fm-card-body">
        ${b ? `<div class="fm-mat">${tiers(b)}<span class="gi-label">Talent book</span><b>${esc(b.series)}</b><small>${esc(b.domain || '')}${b.domain ? ' · ' : ''}${us.length} character${us.length === 1 ? '' : 's'}</small><div class="fm-faces">${us.map(face).join('')}</div></div>` : ''}
        ${m ? `<div class="fm-mat">${tiers(m)}<span class="gi-label">Weapon material</span><b>${esc(m.name)}</b><small>${esc(m.domain || '')}${nW ? ` · ${nW} weapons` : ''}</small>${weps(g, n.name)}</div>` : ''}
      </div></article>`;
  }

  // A Sunday card: all three books and materials of the nation, one row each with its usual days.
  // No faces unless they're yours (three books of faces would make Sunday twice as tall).
  function sunCard(n, books, mats) {
    const row = (top, rarity, name, sub, end) =>
      `<li>${tile(top, rarity, name)}<div><b title="${esc(name)}">${esc(name)}</b><small>${sub}</small></div>${end}</li>`;
    const bookRows = books
      .map(({ g, b }) => {
        const us = users(b);
        const my = us.filter((u) => isMine(u.name));
        return row(b.icon, 4, b.series, `${TABS[g].short} · ${us.length} character${us.length === 1 ? '' : 's'}`, my.length ? `<div class="fm-faces fm-faces--sm">${my.map(face).join('')}</div>` : '');
      })
      .join('');
    const matRows = mats.map(({ g, m }) => row(m.icon, 5, m.name, `${TABS[g].short} · ${esc(m.domain || '')}`, '')).join('');
    return `<article class="gi-box fm-card fm-card--sun">${head(n)}<div class="fm-sun"><div><span class="gi-label">Talent books</span><ul>${bookRows}</ul></div><div><span class="gi-label">Weapon materials</span><ul>${matRows}</ul></div></div></article>`;
  }

  // "Your farm": who of yours this tab's books are for, and when the rest come round.
  function mineBox(t) {
    if (!mine.size) return '';
    const open = t === 'sunday' ? GROUPS : [t];
    const yes = [];
    open.forEach((g) =>
      F[g].books.forEach((b) => {
        const my = users(b).filter((u) => isMine(u.name));
        if (my.length) yes.push({ b, my });
      })
    );
    const later = GROUPS.filter((g) => !open.includes(g))
      .map((g) => ({ g, my: chars.filter((c) => mine.has(c.id) && bookOf[c.name].g === g) }))
      .filter((x) => x.my.length);
    const n = yes.reduce((a, x) => a + x.my.length, 0);
    const yesHtml = yes.length
      ? `<ul class="fm-mine-books">${yes.map(({ b, my }) => `<li>${tile(b.icon, 4, b.series)}<div><b>${esc(b.series)}</b><small>${esc(b.city)}</small></div><div class="fm-faces fm-faces--sm">${my.map((u) => face(u)).join('')}</div></li>`).join('')}</ul>`
      : '<p class="fm-mine-none">None of your characters use these books. Spend the resin on artifacts or weapon materials.</p>';
    const laterHtml = later.length
      ? `<div class="fm-mine-later"><span class="gi-label">On other days</span>${later.map(({ g, my }) => `<button type="button" class="fm-later" data-go="${g}"><span>${TABS[g].short}</span><span class="fm-faces fm-faces--xs">${my.map((c) => tile(c.icon, c.rarity, c.name)).join('')}</span></button>`).join('')}</div>`
      : '';
    return `<div class="gi-box fm-mine"><div class="fm-mine-yes"><p class="fm-mine-h"><span class="gi-label">Your farm</span><span><b>${n}</b> of your ${mine.size} character${mine.size === 1 ? '' : 's'}</span><button type="button" class="fm-edit" data-pick>Edit</button></p>${yesHtml}</div>${laterHtml}</div>`;
  }

  function panel(t) {
    const sunday = t === 'sunday';
    const groups = sunday ? GROUPS : [t];
    const cards = NATIONS.map((n) => {
      const books = [].concat(...groups.map((g) => F[g].books.filter((b) => b.city === n.name).map((b) => ({ g, b }))));
      const mats = [].concat(...groups.map((g) => F[g].weapons.filter((m) => m.city === n.name).map((m) => ({ g, m }))));
      if (!books.length && !mats.length) return '';
      return sunday ? sunCard(n, books, mats) : dayCard(n, t, books[0] && books[0].b, mats[0] && mats[0].m);
    }).join('');
    return `<div class="fm-panel" id="fm-p-${t}" role="tabpanel" data-tab="${t}"${t === tab ? '' : ' aria-hidden="true"'}>${mineBox(t)}<div class="fm-grid${sunday ? ' fm-grid--sun' : ''}">${cards}</div></div>`;
  }

  // ---- THE WEEK: nations down, day groups across. ----
  function week() {
    const cur = tabOf(weekday());
    const cell = (n, g) => {
      const b = F[g].books.find((x) => x.city === n.name);
      const m = F[g].weapons.find((x) => x.city === n.name);
      const my = b ? users(b).filter((u) => isMine(u.name)) : [];
      const dim = mine.size && !my.length ? ' is-dim' : '';
      return `<button type="button" class="fm-wk-cell${g === cur ? ' is-today' : ''}${dim}" data-go="${g}">
        ${b ? `<span class="fm-wk-mat">${tile(b.icon, 4, b.series)}<span><b>${esc(b.series)}</b><small>${my.length ? my.length + ' of yours' : users(b).length + (users(b).length === 1 ? ' character' : ' characters')}</small></span></span>` : ''}
        ${m ? `<span class="fm-wk-mat fm-wk-mat--w">${tile(m.icon, 5, m.name)}<span><small>${esc(m.name)}</small></span></span>` : ''}
        ${my.length ? `<span class="fm-faces fm-faces--xs">${my.map((u) => tile(u.icon, u.rarity, u.name)).join('')}</span>` : ''}</button>`;
    };
    const heads = GROUPS.map((g) => {
      const my = mine.size ? chars.filter((c) => mine.has(c.id) && bookOf[c.name].g === g).length : 0;
      return `<button type="button" class="fm-wk-day${g === cur ? ' is-today' : ''}" data-go="${g}"><b>${TABS[g].short}</b>${g === cur ? '<span class="fm-now">Today</span>' : ''}${mine.size ? `<small>${my} of yours</small>` : ''}</button>`;
    }).join('');
    const rows = NATIONS.filter((n) => GROUPS.some((g) => F[g].books.some((b) => b.city === n.name)))
      .map((n) => `<div class="fm-wk-nat" title="${esc(n.name)}"><img src="${natIcon(n)}" alt="" width="22" height="22"><span>${esc(n.name)}</span></div>${GROUPS.map((g) => cell(n, g)).join('')}`)
      .join('');
    $('fmWeek').innerHTML = `<div class="fm-wk-corner"></div>${heads}${rows}<button type="button" class="fm-wk-sun${now === 'sunday' ? ' is-today' : ''}" data-go="sunday"><b>Sunday</b><span>Every domain is open: every book and material above.</span>${now === 'sunday' ? '<span class="fm-now">Today</span>' : ''}</button>`;
  }

  // ---- DIAL (header): the week as a ring, Monday at the top. Paired days share a shade and a
  // link; today is red and its twin outlined; the hand shows how far through the week the
  // game is. Hover a day for its name; click it to open that day. Decorative (the tray is the
  // real control), so the whole thing is aria-hidden.
  function dial(hover) {
    const C = 110;
    const wd = weekday();
    const seg = 360 / 7;
    const pt = (a, r) => [(C + r * Math.cos((a * Math.PI) / 180)).toFixed(1), (C + r * Math.sin((a * Math.PI) / 180)).toFixed(1)];
    const arc = (a0, a1, r1, r0) => {
      const [x0, y0] = pt(a0, r1);
      const [x1, y1] = pt(a1, r1);
      const [x2, y2] = pt(a1, r0);
      const [x3, y3] = pt(a0, r0);
      return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
    };
    const mid = (i) => -90 + i * seg + seg / 2;
    const order = [1, 2, 3, 4, 5, 6, 0];
    const shade = { monday: 'a', tuesday: 'b', wednesday: 'c', sunday: 's' };
    const segs = order
      .map((d, i) => {
        const t = tabOf(d);
        const cls = d === wd ? ' is-today' : t === tabOf(wd) && d !== 0 ? ' is-twin' : '';
        const [tx, ty] = pt(mid(i), 87);
        return `<g class="fm-seg fm-seg--${shade[t]}${cls}${hover === d ? ' is-hover' : ''}" data-day="${d}"><path d="${arc(-90 + i * seg + 1, -90 + (i + 1) * seg - 1, 98, 76)}"/><text x="${tx}" y="${ty}">${DAY[d][0]}</text></g>`;
      })
      .join('');
    // Links between twins (Mon-Thu, Tue-Fri, Wed-Sat): curves bowing in toward the centre.
    const links = [
      [0, 3],
      [1, 4],
      [2, 5],
    ]
      .map(([i, j]) => {
        const [x0, y0] = pt(mid(i), 70);
        const [x1, y1] = pt(mid(j), 70);
        const on = order[i] === wd || order[j] === wd || order[i] === hover || order[j] === hover;
        return `<path class="fm-link${on ? ' is-on' : ''}" d="M${x0} ${y0}Q${C} ${C} ${x1} ${y1}"/>`;
      })
      .join('');
    const g = gameDay();
    const frac = (g.getUTCHours() * 3600 + g.getUTCMinutes() * 60 + g.getUTCSeconds()) / 86400;
    const angle = (((wd + 6) % 7) + frac) * seg;
    const show = hover != null ? hover : wd;
    $('fmDial').innerHTML = `<svg viewBox="0 0 220 220">${links}${segs}<circle class="fm-dial-in" cx="${C}" cy="${C}" r="34"/>
      <g class="fm-hand" transform="rotate(${angle.toFixed(1)} ${C} ${C})"><path d="M${C} 44V72"/><path class="fm-hand-tip" d="M${C - 5} 3L${C + 5} 3L${C} 11Z"/></g>
      <text class="fm-dial-day" x="${C}" y="${C + 2}">${DAY[show].slice(0, 3)}</text><text class="fm-dial-sub" x="${C}" y="${C + 17}">${hover != null && hover !== wd ? TABS[tabOf(hover)].short : 'Today'}</text></svg>`;
  }

  // ---- FACTS + TOMORROW ----
  function facts() {
    const wd = weekday();
    const t = tabOf(wd);
    const groups = t === 'sunday' ? GROUPS : [t];
    const nb = groups.reduce((a, g) => a + F[g].books.length, 0);
    const nm = groups.reduce((a, g) => a + F[g].weapons.length, 0);
    const out = [`<b>${DAY[wd]}</b>on ${SERVER[GI.server()]}`, `<b>${nb}</b>talent books`, `<b>${nm}</b>weapon materials`];
    if (mine.size) {
      const n = chars.filter((c) => mine.has(c.id) && groups.includes(bookOf[c.name].g)).length;
      out.push(`<b>${n}</b>of your characters`);
    }
    out.push(`Rotates in <b data-reset></b>`);
    $('fmFacts').innerHTML = out.map((x) => `<li>${x}</li>`).join('');
    // Klee's line under the header (Oct 27 2026): today in her voice; with picks, how many of yours can farm.
    const myToday = mine.size ? chars.filter((c) => mine.has(c.id) && groups.includes(bookOf[c.name].g)).length : 0;
    $('fmKlee').textContent =
      t === 'sunday'
        ? "It's Sunday, so every domain is open! Klee says farm anything you like."
        : `It's ${DAY[wd]} on ${SERVER[GI.server()]}: ${nb} talent books are open. ` +
          (mine.size ? `${myToday} of your characters can farm their books today!` : 'Pick your characters and Klee shows who needs them!');

    const tw = (wd + 1) % 7;
    const tt = tabOf(tw);
    const tb = tt === 'sunday' ? [] : F[tt].books;
    const myN = mine.size ? chars.filter((c) => mine.has(c.id) && (tt === 'sunday' || bookOf[c.name].g === tt)).length : 0;
    const el = $('fmTmr');
    el.hidden = false;
    el.dataset.go = tt;
    el.innerHTML = `<span class="fm-tmr-h"><span class="gi-label">Tomorrow</span><b>${DAY[tw]}</b></span>
      <span class="fm-tmr-books">${tt === 'sunday' ? '<span class="fm-tmr-all">Every domain opens.</span>' : tb.map((b) => `<span>${tile(b.icon, 1, b.series)}${esc(b.series)}</span>`).join('')}</span>
      ${mine.size ? `<span class="fm-tmr-mine"><b>${myN}</b> of yours</span>` : ''}
      <span class="fm-tmr-in">in <b data-reset></b>${ARROW}</span>`;
  }

  function tick() {
    if (!F) return;
    if (weekday() !== today) return draw(true);
    const p = parts(nextReset() - now());
    const txt = pad(p.h) + ':' + pad(p.m) + ':' + pad(p.s);
    document.querySelectorAll('[data-reset]').forEach((el) => (el.textContent = txt));
    if (p.s === 0) dial(); // the hand creeps once a minute
  }

  // ---- DRAW + TABS ----
  function paintTabs() {
    const cur = tabOf(weekday());
    document.querySelectorAll('#fmDays [data-tab]').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on);
      b.setAttribute('aria-controls', 'fm-p-' + b.dataset.tab);
      b.innerHTML = TABS[b.dataset.tab].short.replace(' · ', ' &middot; ') + (b.dataset.tab === cur ? '<i class="fm-dot" title="Today"></i>' : '');
    });
  }
  let animT = 0;
  function setTab(t, scroll) {
    if (!TABS[t] || !F) return;
    tab = t;
    // The cards rise in on a switch only (a redraw after a tap shouldn't replay it).
    const box = $('fmPanels');
    box.classList.remove('is-anim');
    void box.offsetWidth;
    box.classList.add('is-anim');
    clearTimeout(animT);
    animT = setTimeout(() => box.classList.remove('is-anim'), 800);
    paintTabs();
    document.querySelectorAll('.fm-panel').forEach((p) => (p.dataset.tab === t ? p.removeAttribute('aria-hidden') : p.setAttribute('aria-hidden', 'true')));
    const url = new URL(location.href);
    if (t === tabOf(weekday())) url.searchParams.delete('day');
    else url.searchParams.set('day', t);
    history.replaceState(null, '', url);
    if (scroll) $('fmDays').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  // toToday: a new game day (or server) moves the tray to today; otherwise the tab stays.
  function draw(toToday) {
    today = weekday();
    if (toToday || !tab) tab = tabOf(today);
    document.querySelector('.fm').classList.toggle('has-mine', mine.size > 0);
    $('fmCta').hidden = mine.size > 0;
    const n = $('fmPickN');
    n.hidden = !mine.size;
    n.textContent = mine.size;
    $('fmPanels').innerHTML = Object.keys(TABS).map(panel).join('');
    paintTabs();
    week();
    facts();
    dial();
    tick();
  }

  function toggle(id) {
    if (!byId[id]) return;
    if (mine.has(id)) mine.delete(id);
    else mine.add(id);
    save();
    const wasFace = document.activeElement && document.activeElement.closest('.fm-panel .fm-face');
    draw();
    // The redraw replaces the buttons: keep keyboard focus on the face that was pressed.
    if (wasFace) {
      const again = document.querySelector(`#fm-p-${tab} .fm-face[data-id="${id}"]`);
      if (again) again.focus();
    }
    if ($('fmDlg').open) pickGrid();
  }

  // ---- PICKER (dialog) ----
  let el = '';
  function pickGrid() {
    const q = $('fmQ').value.trim().toLowerCase();
    const list = chars.filter((c) => (!el || c.element === el) && (!q || c.name.toLowerCase().includes(q)));
    $('fmDlgGrid').innerHTML = list.length
      ? list.map((c) => `<button type="button" class="fm-pc${mine.has(c.id) ? ' is-on' : ''}" data-id="${c.id}" aria-pressed="${mine.has(c.id)}">${tile(c.icon, c.rarity, c.name)}<span>${esc(c.name)}</span></button>`).join('')
      : '<p class="gi-empty">No character matches.</p>';
    $('fmDlgN').textContent = mine.size ? `${mine.size} picked` : 'None picked';
  }
  function openPick(uid) {
    if (!F) return;
    pickGrid();
    $('fmDlg').showModal();
    (uid ? $('fmUid') : $('fmQ')).focus();
  }
  $('fmEls').innerHTML = ['', ...Object.keys(EL)].map((e) => `<button type="button" class="gi-tab${e ? '' : ' active'}" data-el="${e}" aria-pressed="${!e}">${e ? `<img src="${elIcon(e.toLowerCase())}" alt="${e}" title="${e}">` : 'All'}</button>`).join('');
  $('fmEls').addEventListener('click', (e) => {
    const b = e.target.closest('[data-el]');
    if (!b) return;
    el = b.dataset.el;
    $('fmEls').querySelectorAll('[data-el]').forEach((x) => {
      x.classList.toggle('active', x === b);
      x.setAttribute('aria-pressed', x === b);
    });
    pickGrid();
  });
  $('fmQ').addEventListener('input', pickGrid);
  $('fmDlgGrid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (b) toggle(+b.dataset.id);
  });
  $('fmDlgClear').addEventListener('click', () => {
    mine.clear();
    save();
    draw();
    pickGrid();
  });
  $('fmDlgDone').addEventListener('click', () => $('fmDlg').close());
  $('fmDlgClose').addEventListener('click', () => $('fmDlg').close());
  $('fmDlg').addEventListener('click', (e) => e.target === $('fmDlg') && $('fmDlg').close()); // backdrop

  // Import: the characters on show in a profile (Enka sends the showcase, not the whole roster).
  const ERR = {
    notFound: 'No player has this UID. Check the number and try again.',
    maintenance: 'Genshin is under maintenance. Try again once it’s over.',
    busy: 'Too many lookups right now. Try again in a minute.',
    enka5xx: 'Enka.Network isn’t answering. Try again in a few minutes.',
  };
  const say = (text, warn) => {
    const st = document.querySelector('.fm-dlg-uid .gi-look-status');
    st.textContent = text;
    st.classList.toggle('is-warn', !!warn);
  };
  GI.lookup($('fmUidForm'), (uid) => {
    say(`Looking up UID ${uid}…`);
    fetch(GI.API + '?uid=' + uid)
      .then(async (r) => {
        const d = await r.json().catch(() => ({ error: r.ok ? 'enka5xx' : 'unreachable' }));
        if (!r.ok || d.error) throw d.error || 'unreachable';
        return d;
      })
      .then((d) => {
        const p = d.playerInfo || {};
        const ids = [...new Set([...(p.showAvatarInfoList || []), ...(d.avatarInfoList || [])].map((a) => a.avatarId))].filter((id) => byId[id]);
        const fresh = ids.filter((id) => !mine.has(id));
        fresh.forEach((id) => mine.add(id));
        save();
        draw();
        pickGrid();
        const who = esc(p.nickname || 'that player') + '’s';
        if (!ids.length) say(`Nothing on show in ${who} profile. Pick the characters below.`, true);
        else say(`Added ${fresh.length} of the ${ids.length} characters on show in ${who} profile${fresh.length < ids.length ? ' (the rest were already picked)' : ''}. Add the rest below.`);
      })
      .catch((e) => say(ERR[e] || 'Couldn’t reach the lookup. Check your connection and try again.', true));
  });

  // ---- CLICKS ----
  document.addEventListener('click', (e) => {
    const t = e.target;
    const pick = t.closest('[data-pick]');
    if (pick) return openPick(pick.dataset.pick === 'uid');
    const tabBtn = t.closest('#fmDays [data-tab]');
    if (tabBtn) return setTab(tabBtn.dataset.tab);
    const go = t.closest('[data-go]');
    if (go) return setTab(go.dataset.go, true);
    const f = t.closest('.fm-face');
    if (f) return toggle(+f.dataset.id);
    const more = t.closest('[data-weps]');
    if (more) {
      const k = more.dataset.weps;
      if (openWeps.has(k)) openWeps.delete(k);
      else openWeps.add(k);
      draw();
      return;
    }
    const seg = t.closest('.fm-seg');
    if (seg) setTab(tabOf(+seg.dataset.day));
  });
  // Arrow keys move along the day tray (it's a tablist).
  $('fmDays').addEventListener('keydown', (e) => {
    const keys = Object.keys(TABS);
    const i = keys.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);
    if (i === keys.indexOf(tab) || i < 0 || i >= keys.length) return;
    setTab(keys[i]);
    $('fmDays').querySelector(`[data-tab="${keys[i]}"]`).focus();
  });
  $('fmDial').addEventListener('mouseover', (e) => {
    const seg = e.target.closest('.fm-seg');
    if (F && seg) dial(+seg.dataset.day);
  });
  $('fmDial').addEventListener('mouseleave', () => F && dial());

  serverTray($('fmServer'), () => F && draw(true));

  // ---- LOAD ----
  GI.feed
    .then((feed) => {
      F = feed.farm;
      if (!F || !GROUPS.every((g) => F[g] && F[g].books)) throw new Error('no farm');
      GROUPS.forEach((g) => F[g].books.forEach((b) => (b.users || []).forEach((u) => (bookOf[u.name] = { g, b }))));
      chars = (feed.characters || []).filter((c) => bookOf[c.name]).sort((a, b) => a.name.localeCompare(b.name));
      chars.forEach((c) => {
        byName[c.name] = c;
        byId[c.id] = c;
      });
      mine = new Set([...mine].filter((id) => byId[id]));
      const ask = new URLSearchParams(location.search).get('day');
      tab = TABS[ask] ? ask : '';
      draw();
      setInterval(tick, 1000);
      return fetch('/genshin-weapons.json')
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((db) => {
          W = {};
          db.weapons
            .filter((w) => w.forge && w.forge.length)
            .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name))
            .forEach((w) => (W[GROUPS[w.forge[0]] + '|' + w.forge[1]] = W[GROUPS[w.forge[0]] + '|' + w.forge[1]] || []).push(w));
          draw();
        })
        .catch(() => {
          W = {};
          draw();
        });
    })
    .catch(() => {
      $('fmPanels').innerHTML = '<p class="gi-box gi-empty">Couldn’t load the domain schedule right now. Try again in a minute.</p>';
      $('fmKlee').textContent = "Klee couldn't find the domain schedule. Try again in a minute!";
    });
})();
