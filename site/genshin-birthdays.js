// Genshin Impact -- Birthdays (/genshin-impact/birthdays, Oct 24 2026). Styles: genshin-birthdays.css.
// Data: the feed's `characters` (birthday [m, d]) + /genshin-birthdays.json (scripts/genshin-feed.py
// birthdays(): `people` by id = title, bio, constellation, affiliation, dish, namecard art, the
// "Birthday" voice line; `letters` by name = their newest birthday mail from the wiki).
// "Today" = the game day on the picked server (GI.gameDay: the day flips at the 04:00 reset).
// Saved per viewer (try/catch, the page works without): gi-bday "m-d" (your birthday) and Farm
// today's gi-farm-mine (character ids) for "yours". The rest of the state is in the address:
// ?c=<slug> (spotlight), ?el= ?nation= ?r= ?mine=1 (calendar filters).
// Everything from the feed is third-party text, so it goes through esc() before it reaches markup.
(function () {
  const { $, esc, tile, NATIONS, EL, SERVERS, gameDay, nextReset, now, parts, pad, serverTray, elIcon, fit } = window.GI;
  const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MON = GI.MONTHS;
  const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const slug = (s) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const natOf = (name) => NATIONS.find((n) => n.name === name);
  const natIcon = (n) => (n.el ? elIcon(n.el) : n.icon);
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const DAY = 86400e3;

  let chars = []; // feed characters with a birthday, in calendar order
  let P = {}; // people by id
  let L = {}; // letters by name
  let spot = null; // the character in the spotlight
  let today = null; // {y, m, d} of the game day drawn last
  const f = { el: '', nation: '', r: 0, mine: false };

  const load = (k, d) => {
    try {
      return JSON.parse(localStorage.getItem(k) || d);
    } catch (e) {
      return JSON.parse(d);
    }
  };
  const mine = new Set(load('gi-farm-mine', '[]').filter(Number.isInteger));
  let you = String(load('gi-bday', '""') || '');

  // ---- DATES ----
  function gday() {
    const g = gameDay();
    return { y: g.getUTCFullYear(), m: g.getUTCMonth() + 1, d: g.getUTCDate() };
  }
  // Feb 29 (Bennett): the game sends his mail on Feb 28 in other years (wiki mail dates 2021-2026).
  const leap = (y) => new Date(Date.UTC(y, 1, 29)).getUTCDate() === 29;
  const dayIn = (m, d, y) => (m === 2 && d === 29 && !leap(y) ? 28 : d);
  // Days from today to the next [m, d] (0 = today), and the year it falls in.
  function until(m, d) {
    const t0 = Date.UTC(today.y, today.m - 1, today.d);
    let y = today.y;
    let t = Date.UTC(y, m - 1, dayIn(m, d, y));
    if (t < t0) t = Date.UTC(++y, m - 1, dayIn(m, d, y));
    return { n: Math.round((t - t0) / DAY), y };
  }
  const isToday = (c) => c.birthday[0] === today.m && dayIn(...c.birthday, today.y) === today.d;
  const dateText = (c) => MON[c.birthday[0] - 1] + ' ' + c.birthday[1];
  const inText = (n) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : 'in ' + n + ' days');
  // The moment a birthday starts: 04:00 on that date, server time (seconds).
  const startOf = (m, d, y) => (Date.UTC(y, m - 1, dayIn(m, d, y), 4) - SERVERS[GI.server()] * 3600e3) / 1000;
  // Position in the year, counted in a leap year so Feb 29 has its own place (ring, gaps, closest).
  const YEAR = 366;
  const dayOfYear = (m, d) => (Date.UTC(2000, m - 1, d) - Date.UTC(2000, 0, 1)) / DAY;
  const upcoming = () => chars.map((c) => ({ c, ...until(...c.birthday) })).sort((a, b) => a.n - b.n || a.c.name.localeCompare(b.c.name));

  const shown = (c) =>
    (!f.el || c.element === f.el) && (!f.nation || c.region === f.nation) && (!f.r || c.rarity === f.r) && (!f.mine || mine.has(c.id));
  const filtered = () => f.el || f.nation || f.r || f.mine;
  const face = (c, cls) =>
    `<button type="button" class="bd-face${cls ? ' ' + cls : ''}${shown(c) ? '' : ' is-off'}${mine.has(c.id) ? ' is-mine' : ''}" data-c="${c.id}" title="${esc(c.name)}, ${dateText(c)}" aria-label="${esc(c.name)}, ${dateText(c)}">${tile(c.icon, c.rarity, '')}</button>`;

  // ---- HEADER: the next five birthdays' wish cards, fanned; facts line ----
  function header() {
    const up = upcoming();
    $('bdFan').innerHTML = up
      .slice(0, 5)
      .reverse()
      .map(
        ({ c, n }) =>
          `<span class="bd-fan-card${n === 0 ? ' is-today' : ''}" style="--gi-el:${EL[c.element] || '#b9bec6'}"><img src="${esc(c.strip || c.icon)}" alt="" width="320" height="512"><b>${n === 0 ? 'Today' : dateText(c)}</b></span>`,
      )
      .join('');
    const todays = up.filter((x) => x.n === 0);
    const next = up.find((x) => x.n > 0);
    const busiest = months().reduce((a, b) => (b.list.length > a.list.length ? b : a));
    const out = [
      todays.length ? `Today <b>${todays.map((x) => esc(x.c.name)).join(' &amp; ')}</b>` : `<b>No birthday</b>today`,
      `Next <b>${esc(next.c.name)}</b>${inText(next.n)}`,
      `<b>${chars.length}</b>birthdays`,
      `<b>${months()[today.m - 1].list.length}</b>in ${MONTH[today.m - 1]}`,
      `Busiest <b>${MONTH[busiest.i]}</b>(${busiest.list.length})`,
    ];
    $('bdFacts').innerHTML = out.map((x) => `<li>${x}</li>`).join('');
    // Klee's line under the header (Oct 27 2026): today's birthday, or who's next.
    $('bdKlee').textContent = todays.length
      ? `Happy birthday, ${todays.map((x) => x.c.name).join(' and ')}! Klee is throwing a party!`
      : `${next.c.name}'s birthday is ${next.n === 1 ? 'tomorrow' : 'in ' + next.n + ' days'}! Klee is already making a card.`;
  }
  let monthCache = null;
  function months() {
    if (!monthCache) monthCache = MONTH.map((name, i) => ({ i, name, list: chars.filter((c) => c.birthday[0] === i + 1) }));
    return monthCache;
  }

  // ---- SPOTLIGHT ----
  const SEAL =
    '<path d="M50 6c6 4 9 2 14 6s3 9 8 13 9 3 11 9-2 9 0 15 7 7 5 13-8 6-11 11-1 11-7 14-9-1-14 2-7 8-13 8-9-5-14-7-11 0-14-5 0-11-4-15-10-3-12-9 3-8 2-14-6-8-3-13 9-4 11-9 0-11 5-14 10 1 14-3 7-8 13-8z"/>';
  function spotlight(c) {
    spot = c;
    const p = P[c.id] || {};
    const l = L[c.name];
    const u = until(...c.birthday);
    const nat = natOf(c.region);
    const now0 = isToday(c);
    const occ = new Date(Date.UTC(u.y, c.birthday[0] - 1, dayIn(...c.birthday, u.y)));
    const fact = (k, v, ic) => (v ? `<div><dt>${k}</dt><dd>${ic || ''}<span>${esc(v)}</span></dd></div>` : '');
    const elImg = c.element ? `<img src="${elIcon(c.element.toLowerCase())}" alt="" width="18" height="18">` : '';
    const natImg = nat ? `<img src="${natIcon(nat)}" alt="" width="18" height="18">` : '';
    const dish = p.dish ? `<img src="${esc(p.dish[1])}" alt="" width="18" height="18" loading="lazy">` : '';
    const eyebrow = now0 ? 'Birthday today' : u.n === 1 ? 'Birthday tomorrow' : spot === defaultSpot() ? 'Next birthday' : 'Birthday';
    const letter = l
      ? `<article class="bd-letter" aria-label="Birthday letter from ${esc(c.name)}">
          <header class="bd-l-head"><span class="gi-label">Birthday mail · ${esc(l.date.slice(0, 4))}</span><h3>${esc(l.title)}</h3><p>From <b>${esc(c.name)}</b></p></header>
          <div class="bd-l-text" id="bdLText" tabindex="0">${l.text.map((t) => `<p>${esc(t)}</p>`).join('')}<p class="bd-l-sign">${esc(c.name)}</p></div>
          <button type="button" class="bd-l-more" data-more aria-expanded="false" aria-controls="bdLText">See more</button>
          ${l.items.length ? `<footer class="bd-l-gifts"><span class="gi-label">Attached</span><div>${l.items.map(([n, k, ic]) => `<span class="bd-gift" title="${esc(n)}">${ic ? tile(ic, 3, n) : `<span class="gi-tile r3 bd-gift-x" aria-hidden="true"></span>`}<b>${k > 1 ? '×' + k : ''}</b><small>${esc(n.replace(/^Delicious /, ''))}</small></span>`).join('')}</div></footer>` : ''}
        </article>`
      : `<article class="bd-letter bd-letter--none"><header class="bd-l-head"><span class="gi-label">Birthday mail</span><h3>No letter on record yet</h3></header><p class="bd-l-none">${esc(c.name)}'s first birthday letter isn't on the wiki yet. It lands in your mail on ${MONTH[c.birthday[0] - 1]} ${c.birthday[1]}.</p></article>`;
    const box = $('bdSpot');
    box.style.setProperty('--gi-el', EL[c.element] || '#b9bec6');
    box.style.setProperty('--card', p.namecard ? `url('${p.namecard}')` : 'none');
    box.classList.toggle('is-today', now0);
    box.innerHTML = `
      <div class="bd-s-art" aria-hidden="true"><i class="bd-s-card"></i>${c.strip ? `<img class="bd-s-strip" src="${esc(c.strip)}" alt="" width="320" height="512">` : `<img class="bd-s-strip is-icon" src="${esc(c.icon)}" alt="">`}${now0 ? '<i class="bd-confetti"></i>' : ''}</div>
      <div class="bd-s-info">
        <p class="gi-eyebrow bd-s-eye">${eyebrow}</p>
        <h2 class="bd-s-name" id="bdSName">${esc(c.name)}</h2>
        <p class="bd-s-title">${esc(p.title || '')}<span class="gi-rarity">${'★'.repeat(c.rarity)}</span></p>
        <p class="bd-s-date"><b>${MONTH[c.birthday[0] - 1]} ${c.birthday[1]}</b><span>${now0 ? 'Happy birthday!' : WD[occ.getUTCDay()] + (u.y !== today.y ? ' next year' : ' this year') + ' · ' + inText(u.n)}</span></p>
        <dl class="bd-s-facts">${fact('Nation', c.region || 'None', natImg)}${fact('Element', c.element, elImg)}${fact('Constellation', p.constellation)}${fact('Affiliation', p.affiliation)}${fact('Special dish', p.dish && p.dish[0], dish)}${fact('Namecard', p.card)}</dl>
        <div class="bd-s-count"><span class="gi-label">${now0 ? 'Ends in' : 'Starts in'}</span><div class="gi-clock-units" data-bd-count="${now0 ? nextReset() : startOf(c.birthday[0], c.birthday[1], u.y)}"></div></div>
        <div class="bd-s-keys">
          <button type="button" class="gi-key" data-copy="${esc(location.origin + location.pathname + '?c=' + slug(c.name))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg><span>Copy</span></button>
          <button type="button" class="gi-key" data-ics="one:${c.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>Add to calendar</button>
        </div>
      </div>
      <div class="bd-s-mail">
        <svg class="bd-env" viewBox="0 0 100 100" aria-hidden="true"><g class="bd-seal">${SEAL}</g><circle class="bd-seal-ring" cx="50" cy="50" r="27"/></svg>
        ${c.element ? `<img class="bd-seal-ic" src="${elIcon(c.element.toLowerCase())}" alt="" width="30" height="30" aria-hidden="true">` : ''}
        ${letter}
      </div>`;
    fit($('bdSName'));
    count();
    paintNext();
    // ?c= only when it isn't the default pick, so a plain visit keeps a clean address.
    const url = new URL(location.href);
    if (c === defaultSpot()) url.searchParams.delete('c');
    else url.searchParams.set('c', slug(c.name));
    history.replaceState(null, '', url);
    document.querySelectorAll('.bd-face.is-spot, .bd-dot.is-spot').forEach((x) => x.classList.remove('is-spot'));
    document.querySelectorAll(`.bd-face[data-c="${c.id}"], .bd-dot[data-c="${c.id}"]`).forEach((x) => x.classList.add('is-spot'));
    ringMid(c);
  }
  const defaultSpot = () => upcoming()[0].c;

  // Coming up: the next eight (today's first), as small cards; the one in the spotlight is pressed.
  function paintNext() {
    $('bdNext').innerHTML = upcoming()
      .slice(0, 8)
      .map(
        ({ c, n }) =>
          `<button type="button" class="bd-nx${c === spot ? ' is-on' : ''}${n === 0 ? ' is-today' : ''}" data-c="${c.id}" aria-pressed="${c === spot}" style="--gi-el:${EL[c.element] || '#b9bec6'}">
            ${tile(c.icon, c.rarity, '')}<span class="bd-nx-t"><b>${esc(c.name)}</b><small>${dateText(c)}</small></span><span class="bd-nx-in">${n === 0 ? 'Today' : n + 'd'}</span></button>`,
      )
      .join('');
  }

  // Countdown boxes: [data-bd-count] = a moment (seconds). Re-drawn every second by tick().
  function count() {
    const t = now();
    document.querySelectorAll('[data-bd-count]').forEach((el) => {
      const p = parts(+el.dataset.bdCount - t);
      el.innerHTML = `<span><b>${p.d}</b><small>d</small></span><span><b>${pad(p.h)}</b><small>h</small></span><span><b>${pad(p.m)}</b><small>m</small></span><span><b>${pad(p.s)}</b><small>s</small></span>`;
    });
  }

  // ---- THE RING: the year as a circle, Jan at the top, clockwise. Every birthday is a dot in its
  // element's colour on its day (shared days stack outward); today's hand in red. Decorative
  // (the month calendars are the real control), so aria-hidden; a click still opens the spotlight.
  const C = 300;
  const pt = (a, r) => [(C + r * Math.cos((a * Math.PI) / 180)).toFixed(1), (C + r * Math.sin((a * Math.PI) / 180)).toFixed(1)];
  const angle = (m, d) => -90 + (dayOfYear(m, d) + 0.5) * (360 / YEAR);
  function ring() {
    const arc = (a0, a1, r1, r0) => {
      const [x0, y0] = pt(a0, r1);
      const [x1, y1] = pt(a1, r1);
      const [x2, y2] = pt(a1, r0);
      const [x3, y3] = pt(a0, r0);
      return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
    };
    const segs = months()
      .map(({ i, name, list }) => {
        const a0 = -90 + dayOfYear(i + 1, 1) * (360 / YEAR);
        const a1 = i === 11 ? 270 : -90 + dayOfYear(i + 2, 1) * (360 / YEAR);
        const [tx, ty] = pt((a0 + a1) / 2, 206);
        return `<g class="bd-mseg${i + 1 === today.m ? ' is-now' : ''}" data-m="${i}"><path d="${arc(a0 + 0.4, a1 - 0.4, 234, 220)}"/><text x="${tx}" y="${ty}">${MON[i].toUpperCase()}</text><text class="bd-mseg-n" x="${tx}" y="${(+ty + 13).toFixed(1)}">${list.length}</text></g>`;
      })
      .join('');
    // Ticks: one per day, the 1st of each month longer.
    let ticks = '';
    for (let m = 1; m <= 12; m++)
      for (let d = 1; d <= new Date(Date.UTC(2000, m, 0)).getUTCDate(); d++) {
        const a = angle(m, d);
        const [x0, y0] = pt(a, d === 1 ? 238 : 240);
        const [x1, y1] = pt(a, 245);
        ticks += `M${x0} ${y0}L${x1} ${y1}`;
      }
    const seen = {};
    const dots = chars
      .map((c) => {
        const k = c.birthday.join('-');
        const i = (seen[k] = (seen[k] || 0) + 1) - 1;
        const [x, y] = pt(angle(...c.birthday), 258 + i * 15);
        return `<circle class="bd-dot${shown(c) ? '' : ' is-off'}${isToday(c) ? ' is-today' : ''}${mine.has(c.id) ? ' is-mine' : ''}" data-c="${c.id}" cx="${x}" cy="${y}" r="6" style="--gi-el:${EL[c.element] || '#b9bec6'}"><title>${esc(c.name)}, ${dateText(c)}</title></circle>`;
      })
      .join('');
    const a = angle(today.m, today.d);
    const [hx, hy] = pt(a, 212);
    const [tx, ty] = pt(a, 290);
    $('bdRing').innerHTML = `<svg viewBox="0 0 600 600" aria-hidden="true">
      <circle class="bd-r-glow" cx="${C}" cy="${C}" r="150"/>
      <circle class="bd-r-track" cx="${C}" cy="${C}" r="258"/>
      ${segs}<path class="bd-ticks" d="${ticks}"/>
      <line class="bd-hand" x1="${C}" y1="${C}" x2="${hx}" y2="${hy}"/><line class="bd-hand bd-hand--o" x1="${C}" y1="${C}" x2="${tx}" y2="${ty}"/><circle class="bd-hand-tip" cx="${tx}" cy="${ty}" r="4"/>
      <circle class="bd-r-hub" cx="${C}" cy="${C}" r="118"/>
      ${dots}</svg><div class="bd-ring-mid" id="bdRingMid"></div>`;
    // Element counts under the ring.
    const els = Object.keys(EL).map((e) => [e, chars.filter((c) => c.element === e).length]);
    $('bdRing').insertAdjacentHTML(
      'beforeend',
      `<ul class="bd-ring-key">${els.map(([e, n]) => `<li style="--gi-el:${EL[e]}"><i></i>${e}<b>${n}</b></li>`).join('')}</ul>`,
    );
  }
  // The ring's middle: whoever's hovered, else the spotlight.
  function ringMid(c) {
    const mid = $('bdRingMid');
    if (!mid || !c) return;
    const u = until(...c.birthday);
    mid.innerHTML = `${tile(c.icon, c.rarity, '')}<b>${esc(c.name)}</b><span>${MONTH[c.birthday[0] - 1]} ${c.birthday[1]}</span><small>${inText(u.n)}</small>`;
  }

  // ---- MONTH CALENDARS (Monday first, laid out for the current year) ----
  function calendars() {
    const y = today.y;
    const mm = months();
    $('bdMonths').innerHTML = mm
      .map(({ i, name, list }) => {
        const first = (new Date(Date.UTC(y, i, 1)).getUTCDay() + 6) % 7;
        const len = new Date(Date.UTC(y, i + 1, 0)).getUTCDate();
        let cells = '<span class="bd-pad"></span>'.repeat(first);
        for (let d = 1; d <= len; d++) {
          const who = list.filter((c) => dayIn(...c.birthday, y) === d);
          const now0 = i + 1 === today.m && d === today.d;
          const past = i + 1 < today.m || (i + 1 === today.m && d < today.d);
          cells += `<div class="bd-day${who.length ? ' has-b' : ''}${who.length > 1 ? ' is-two' : ''}${now0 ? ' is-today' : ''}${past ? ' is-past' : ''}"><span class="bd-dn">${d}</span>${who.map((c) => face(c)).join('')}</div>`;
        }
        cells += '<span class="bd-pad"></span>'.repeat((7 - ((first + len) % 7)) % 7);
        const n = list.filter(shown).length;
        return `<article class="gi-box bd-month${i + 1 === today.m ? ' is-now' : ''}" id="bd-m-${i}" data-m="${i}" role="tabpanel" aria-labelledby="bd-mt-${i}">
          <header><h3>${name}</h3><span>${filtered() ? `${n} of ${plural(list.length, 'birthday')}` : plural(list.length, 'birthday')}</span></header>
          <div class="bd-wk" aria-hidden="true"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
          <div class="bd-grid">${cells}</div></article>`;
      })
      .join('');
    $('bdMTabs').innerHTML = mm
      .map(
        ({ i }) =>
          `<button type="button" class="gi-tab${i === mTab ? ' active' : ''}" role="tab" id="bd-mt-${i}" data-mt="${i}" aria-selected="${i === mTab}" aria-controls="bd-m-${i}">${MON[i]}</button>`,
      )
      .join('');
    paintMonth();
    const n = chars.filter(shown).length;
    $('bdCount').innerHTML = filtered() ? `<b>${n}</b> of ${chars.length} shown` : `<b>${chars.length}</b> characters`;
    $('bdClear').hidden = !filtered();
  }
  // Phones show one month at a time (CSS: .bd-month:not(.is-tab) hidden ≤970px).
  let mTab = 0;
  function paintMonth() {
    document.querySelectorAll('.bd-month').forEach((m) => m.classList.toggle('is-tab', +m.dataset.m === mTab));
    const tray = $('bdMTabs');
    tray.querySelectorAll('[data-mt]').forEach((b) => {
      const on = +b.dataset.mt === mTab;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on);
      if (on) tray.scrollLeft = b.offsetLeft - (tray.clientWidth - b.offsetWidth) / 2; // keep the picked month in view (phones)
    });
  }

  // ---- FILTERS ----
  function trays() {
    const btn = (k, v, label, on) =>
      `<button type="button" class="gi-tab${on ? ' active' : ''}" data-f="${k}" data-v="${esc(v)}" aria-pressed="${on}">${label}</button>`;
    $('bdEl').innerHTML =
      btn('el', '', 'All', !f.el) +
      Object.keys(EL)
        .map((e) => btn('el', e, `<img src="${elIcon(e.toLowerCase())}" alt="${e}" title="${e}">`, f.el === e))
        .join('');
    $('bdNat').innerHTML =
      btn('nation', '', 'All', !f.nation) +
      NATIONS.filter((n) => chars.some((c) => c.region === n.name))
        .map((n) => btn('nation', n.name, `<img src="${natIcon(n)}" alt="${n.name}" title="${n.name}">`, f.nation === n.name))
        .join('');
    $('bdRar').innerHTML =
      btn('r', 0, 'All', !f.r) +
      btn('r', 5, '5★', f.r === 5) +
      btn('r', 4, '4★', f.r === 4) +
      (mine.size ? btn('mine', f.mine ? '' : '1', 'Yours', f.mine) : '');
    const url = new URL(location.href);
    [
      ['el', f.el],
      ['nation', f.nation],
      ['r', f.r || ''],
      ['mine', f.mine ? '1' : ''],
    ].forEach(([k, v]) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k)));
    history.replaceState(null, '', url);
    $('bdIcsKeys').querySelector('[data-ics="shown"]').hidden = !filtered();
    const n = [f.el, f.nation, f.r, f.mine].filter(Boolean).length;
    $('bdFN').hidden = !n;
    $('bdFN').textContent = n;
  }
  function applyFilters() {
    trays();
    calendars();
    ring();
    ringMid(spot);
    document.querySelectorAll(`.bd-dot[data-c="${spot.id}"]`).forEach((x) => x.classList.add('is-spot'));
  }

  // ---- YOUR BIRTHDAY ----
  function youPick() {
    const [m, d] = you.split('-').map(Number);
    $('bdYouM').innerHTML =
      '<option value="">Month</option>' +
      MONTH.map((n, i) => `<option value="${i + 1}"${m === i + 1 ? ' selected' : ''}>${n}</option>`).join('');
    const len = m ? new Date(Date.UTC(2000, m, 0)).getUTCDate() : 31; // 2000: a leap year, so Feb 29 is pickable
    $('bdYouD').innerHTML =
      '<option value="">Day</option>' +
      Array.from({ length: len }, (_, i) => `<option value="${i + 1}"${d === i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('');
  }
  function youOut() {
    const [m, d] = you.split('-').map(Number);
    const out = $('bdYouOut');
    if (!m || !d) {
      out.innerHTML = `<div class="bd-you-empty"><b>Pick your birthday</b><p>See which characters share it, who's closest, and how long you've got.</p></div>`;
      return lines();
    }
    const u = until(m, d);
    const same = chars.filter((c) => c.birthday[0] === m && c.birthday[1] === d);
    // Closest before and after (the calendar wraps around the year end).
    const off = (c) => {
      let x = dayOfYear(...c.birthday) - dayOfYear(m, d);
      if (x > 183) x -= YEAR;
      if (x < -183) x += YEAR;
      return x;
    };
    const others = chars.filter((c) => !same.includes(c)).map((c) => ({ c, x: off(c) }));
    const before = others.filter((o) => o.x < 0).sort((a, b) => b.x - a.x)[0];
    const after = others.filter((o) => o.x > 0).sort((a, b) => a.x - b.x)[0];
    const near = (o, w) =>
      o
        ? `<div class="bd-near"><span class="gi-label">${w}</span>${face(o.c)}<div><b>${esc(o.c.name)}</b><small>${dateText(o.c)} · ${plural(Math.abs(o.x), 'day')} ${o.x < 0 ? 'before' : 'after'}</small></div></div>`
        : '';
    const month = chars.filter((c) => c.birthday[0] === m);
    out.innerHTML = `
      <div class="bd-you-big">${u.n === 0 ? '<b>Happy birthday!</b><span>Check your mail in game.</span>' : `<b>${u.n}</b><span>${u.n === 1 ? 'day to go' : 'days to go'} · ${MONTH[m - 1]} ${d}</span>`}</div>
      <div class="bd-you-twins">${
        same.length
          ? `<span class="gi-label">You share it with</span><div class="bd-you-faces">${same.map((c) => `${face(c)}<b>${esc(c.name)}</b>`).join('')}</div>`
          : `<span class="gi-label">Nobody shares it</span><div class="bd-you-near">${near(before, 'Just before')}${near(after, 'Just after')}</div>`
      }</div>
      <div class="bd-you-month"><span class="gi-label">Born in ${MONTH[m - 1]} too · ${month.length}</span><div class="bd-you-mf">${month.map((c) => face(c)).join('')}</div></div>`;
    lines();
  }
  // Every character's birthday line: yours-day twins first, then A-Z; the search narrows it.
  function lines() {
    const q = $('bdQ').value.trim().toLowerCase();
    const [m, d] = you.split('-').map(Number);
    const list = chars
      .filter((c) => P[c.id] && P[c.id].line && (!q || c.name.toLowerCase().includes(q)))
      .sort(
        (a, b) =>
          (b.birthday[0] === m && b.birthday[1] === d) - (a.birthday[0] === m && a.birthday[1] === d) || a.name.localeCompare(b.name),
      );
    $('bdLines').innerHTML = list.length
      ? list
          .map(
            (c) =>
              `<figure class="gi-box bd-line" style="--gi-el:${EL[c.element] || '#b9bec6'}"><blockquote tabindex="0">${esc(P[c.id].line)}</blockquote><figcaption>${face(c)}<span><b>${esc(c.name)}</b><small>Born ${dateText(c)}</small></span></figcaption></figure>`,
          )
          .join('')
      : '<p class="gi-box gi-empty">No character matches.</p>';
    $('bdLines').scrollLeft = 0;
  }

  // ---- FACTS ----
  function facts() {
    const mm = months();
    const max = Math.max(...mm.map((x) => x.list.length));
    const min = Math.min(...mm.map((x) => x.list.length));
    const bars = mm
      .map(
        ({ i, list }) =>
          `<li class="${list.length === max ? 'is-max' : ''}${i + 1 === today.m ? ' is-now' : ''}"><b>${list.length}</b><i style="height:${((list.length / max) * 100).toFixed(1)}%"></i><span>${MON[i]}</span></li>`,
      )
      .join('');
    const nats = NATIONS.map((n) => ({ n, list: chars.filter((c) => c.region === n.name) })).filter((x) => x.list.length);
    const none = chars.filter((c) => !natOf(c.region));
    const nmax = Math.max(...nats.map((x) => x.list.length));
    const natRows = nats
      .map(
        ({ n, list }) =>
          `<li><img src="${natIcon(n)}" alt="" width="20" height="20"><span>${n.name}</span><i><i style="width:${((list.length / nmax) * 100).toFixed(1)}%"></i></i><b>${list.length}</b></li>`,
      )
      .join('');
    // Shared days.
    const byDay = {};
    chars.forEach((c) => (byDay[c.birthday.join('-')] = byDay[c.birthday.join('-')] || []).push(c));
    const shared = Object.values(byDay)
      .filter((l) => l.length > 1)
      .sort((a, b) => dayOfYear(...a[0].birthday) - dayOfYear(...b[0].birthday));
    // The longest wait: the biggest gap between two birthdays in a row (around the year end too).
    const days = [...new Set(chars.map((c) => dayOfYear(...c.birthday)))].sort((a, b) => a - b);
    let gap = { n: 0 };
    days.forEach((x, i) => {
      const nx = days[(i + 1) % days.length] + (i === days.length - 1 ? YEAR : 0);
      if (nx - x > gap.n) gap = { n: nx - x, a: x, b: nx % YEAR };
    });
    const at = (doy) => chars.find((c) => dayOfYear(...c.birthday) === doy);
    const ga = at(gap.a);
    const gb = at(gap.b);
    const lonely = YEAR - days.length;
    // Yours (Daily domains' picks).
    const my = upcoming().filter((x) => mine.has(x.c.id));
    const yours = my.length
      ? `<ul class="bd-f-mine">${my
          .slice(0, 6)
          .map(
            ({ c, n }) =>
              `<li>${face(c)}<span><b>${esc(c.name)}</b><small>${dateText(c)}</small></span><em>${n === 0 ? 'Today' : n + 'd'}</em></li>`,
          )
          .join('')}</ul>${my.length > 6 ? `<p class="bd-f-more">+${my.length - 6} more on the calendar (Yours filter).</p>` : ''}`
      : `<p class="bd-f-none">Pick the characters you play on <a href="/genshin-impact/farm">Daily domains</a> and their birthdays show up here, in the calendar and in your calendar file.</p>`;
    $('bdFactGrid').innerHTML = `
      <div class="gi-box bd-f bd-f--months"><span class="gi-label">Birthdays per month</span><ol class="bd-bars">${bars}</ol><p>${MONTH[mm.find((x) => x.list.length === max).i]} is the busiest with ${max}; ${mm
        .filter((x) => x.list.length === min)
        .map((x) => MONTH[x.i])
        .join(' and ')} the quietest with ${min}.</p></div>
      <div class="gi-box bd-f"><span class="gi-label">By nation</span><ul class="bd-nats">${natRows}</ul>${none.length ? `<p>${plural(none.length, 'character')} from outside the seven nations: ${none.map((c) => esc(c.name)).join(', ')}.</p>` : ''}</div>
      <div class="gi-box bd-f"><span class="gi-label">Shared birthdays · ${shared.length}</span><ul class="bd-shared">${shared
        .map(
          (l) =>
            `<li><span class="bd-sh-faces">${l.map((c) => face(c)).join('')}</span><span><b>${l.map((c) => esc(c.name)).join(' &amp; ')}</b><small>${dateText(l[0])}</small></span></li>`,
        )
        .join('')}</ul></div>
      <div class="gi-box bd-f bd-f--gap"><span class="gi-label">The longest wait</span><p class="bd-big"><b>${gap.n}</b> days</p><p>From ${ga ? `<b>${esc(ga.name)}</b> (${dateText(ga)})` : ''} to ${gb ? `<b>${esc(gb.name)}</b> (${dateText(gb)})` : ''} without a birthday. ${lonely} days of the year have none at all.</p></div>
      <div class="gi-box bd-f bd-f--mine"><span class="gi-label">Your characters${my.length ? ' · ' + my.length : ''}</span>${yours}</div>`;
  }

  // ---- ADD TO CALENDAR (.ics, RFC 5545: yearly all-day events, CRLF lines) ----
  function ics(list, name) {
    const e = (s) => String(s).replace(/[\\,;]/g, (x) => '\\' + x);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const ev = list.map((c) => {
      const [m, d] = c.birthday;
      const feb29 = m === 2 && d === 29; // the last day of February every year, like the game (Feb 28 when there's no 29th)
      const p = P[c.id] || {};
      return [
        'BEGIN:VEVENT',
        `UID:gi-birthday-${c.id}@parchrome`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${today.y}${pad(m)}${pad(dayIn(m, d, today.y))}`,
        feb29 ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1' : 'RRULE:FREQ=YEARLY',
        `SUMMARY:${e(c.name + "'s birthday (Genshin Impact)")}`,
        `DESCRIPTION:${e([p.title, c.region, c.element].filter(Boolean).join(' · ') + '. Check your in-game mail for their letter.')}`,
        `URL:${location.origin}/genshin-impact/birthdays?c=${slug(c.name)}`,
        'TRANSP:TRANSPARENT',
        'END:VEVENT',
      ].join('\r\n');
    });
    const body = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Parchrome//Genshin Impact birthdays//EN',
      'CALSCALE:GREGORIAN',
      'X-WR-CALNAME:Genshin Impact birthdays',
      ...ev,
      'END:VCALENDAR',
      '',
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
    a.download = name + '.ics';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  // The section's drawing: a tear-off calendar page on the next birthday.
  function icsArt() {
    const { c } = upcoming()[0];
    $('bdIcsArt').innerHTML =
      `<div class="bd-page" style="--gi-el:${EL[c.element] || '#b9bec6'}"><span class="bd-page-m">${MONTH[c.birthday[0] - 1]}</span><b class="bd-page-d">${c.birthday[1]}</b>${tile(c.icon, c.rarity, '')}<span class="bd-page-n">${esc(c.name)}</span></div><div class="bd-page bd-page--b"></div><div class="bd-page bd-page--c"></div>`;
    $('bdIcsKeys').querySelector('[data-ics="mine"]').hidden = !mine.size;
  }

  // ---- DRAW + TICK ----
  function draw() {
    today = gday();
    monthCache = null;
    header();
    trays();
    calendars();
    ring();
    facts();
    youOut();
    icsArt();
    spotlight(spot && chars.includes(spot) ? spot : defaultSpot());
  }
  function tick() {
    const g = gday();
    if (g.d !== today.d || g.m !== today.m) return draw(); // the game day flipped
    count();
  }

  // ---- EVENTS ----
  document.addEventListener('click', (e) => {
    const t = e.target;
    const who = t.closest('[data-c]');
    if (who && chars.length) {
      const c = chars.find((x) => x.id === +who.dataset.c);
      const inNext = !!who.closest('#bdNext'); // before spotlight(): it redraws that row, detaching `who`
      if (c) {
        spotlight(c);
        if (!inNext)
          $('spotlight').scrollIntoView({
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            block: 'start',
          });
      }
      return;
    }
    const fb = t.closest('[data-f]');
    if (fb) {
      const k = fb.dataset.f;
      if (k === 'r') f.r = +fb.dataset.v;
      else if (k === 'mine') f.mine = !!fb.dataset.v;
      else f[k] = fb.dataset.v;
      return applyFilters();
    }
    const more = t.closest('[data-more]');
    if (more) {
      const open = more.closest('.bd-letter').classList.toggle('is-open');
      more.setAttribute('aria-expanded', open);
      more.textContent = open ? 'See less' : 'See more';
      return;
    }
    const mt = t.closest('[data-mt]');
    if (mt) {
      mTab = +mt.dataset.mt;
      return paintMonth();
    }
    const ic = t.closest('[data-ics]');
    if (ic && chars.length) {
      const k = ic.dataset.ics;
      if (k.startsWith('one:')) {
        const c = chars.find((x) => x.id === +k.slice(4));
        return c && ics([c], 'genshin-birthday-' + slug(c.name));
      }
      return ics(
        k === 'mine' ? chars.filter((c) => mine.has(c.id)) : k === 'shown' ? chars.filter(shown) : chars,
        k === 'all' ? 'genshin-birthdays' : 'genshin-birthdays-' + k,
      );
    }
    const arrow = t.closest('#you [data-dir]');
    if (arrow) {
      const row = $('bdLines');
      row.scrollBy({ left: +arrow.dataset.dir * row.clientWidth * 0.9, behavior: 'smooth' });
    }
  });
  $('bdFKey').addEventListener('click', () => {
    const open = $('bdFRows').classList.toggle('is-open');
    $('bdFKey').setAttribute('aria-expanded', open);
  });
  $('bdClear').addEventListener('click', () => {
    Object.assign(f, { el: '', nation: '', r: 0, mine: false });
    applyFilters();
  });
  // Month tray: arrow keys move along it (it's a tablist).
  $('bdMTabs').addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    mTab = (mTab + d + 12) % 12;
    paintMonth();
    $('bd-mt-' + mTab).focus();
  });
  // Ring hover: its middle shows that birthday; leaving it goes back to the spotlight.
  $('bdRing').addEventListener('mouseover', (e) => {
    const dot = e.target.closest('.bd-dot');
    if (dot) ringMid(chars.find((x) => x.id === +dot.dataset.c));
  });
  $('bdRing').addEventListener('mouseleave', () => ringMid(spot));
  const saveYou = () => {
    const m = $('bdYouM').value;
    const d = $('bdYouD').value;
    you = m && d ? m + '-' + d : '';
    try {
      if (you) localStorage.setItem('gi-bday', JSON.stringify(you));
      else localStorage.removeItem('gi-bday');
    } catch (err) {}
  };
  $('bdYouM').addEventListener('change', () => {
    const d = $('bdYouD').value;
    you = ($('bdYouM').value || '') + '-' + d;
    youPick();
    saveYou();
    youOut();
  });
  $('bdYouD').addEventListener('change', () => {
    saveYou();
    youOut();
  });
  $('bdQ').addEventListener('input', lines);
  // "Add to calendar": GI.glide (genshin-core.js), an eased scroll, then the section's title rises in.
  // Reduced motion = a plain jump. (The jump tray went Oct 29 2026, Adrian.)
  document.querySelectorAll('.bd-bar-r a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      const target = $(href.slice(1));
      if (!target) return;
      e.preventDefault();
      history.replaceState(null, '', location.pathname + location.search + href);
      GI.glide(target);
    }),
  );

  serverTray($('bdServer'), () => chars.length && draw());

  // ---- LOAD ----
  const ask = new URLSearchParams(location.search);
  f.el = EL[ask.get('el')] ? ask.get('el') : '';
  f.nation = natOf(ask.get('nation')) ? ask.get('nation') : '';
  f.r = [4, 5].includes(+ask.get('r')) ? +ask.get('r') : 0;
  f.mine = ask.get('mine') === '1' && mine.size > 0;
  Promise.all([
    GI.feed,
    fetch('/genshin-birthdays.json')
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})),
  ])
    .then(([feed, db]) => {
      P = db.people || {};
      L = db.letters || {};
      chars = (feed.characters || [])
        .filter((c) => c.birthday && c.birthday[0])
        .sort((a, b) => dayOfYear(...a.birthday) - dayOfYear(...b.birthday) || a.name.localeCompare(b.name));
      if (!chars.length) throw new Error('no birthdays');
      today = gday();
      mTab = today.m - 1;
      const want = ask.get('c');
      spot = (want && chars.find((c) => slug(c.name) === want)) || null;
      youPick();
      draw();
      setInterval(tick, 1000);
      if (document.fonts) document.fonts.ready.then(() => fit($('bdSName')));
    })
    .catch(() => {
      $('bdSpot').innerHTML = '<p class="gi-empty">Couldn’t load the birthdays right now. Try again in a minute.</p>';
      $('bdKlee').textContent = "Klee couldn't find the birthdays. Try again in a minute!";
    });
})();
