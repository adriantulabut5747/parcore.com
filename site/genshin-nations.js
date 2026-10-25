// Genshin Impact -- Nations (/genshin-impact/nations, Oct 24 2026). Styles: genshin-nations.css, which
// leans on genshin-characters.css (the wish-result cards, .ch-card) and genshin-farm.css (material
// tiers .fm-tiers, faces .fm-face), both linked by the page.
// Data, all real:
//   /genshin-nations.json  -- feed script nations(): each nation's wiki facts (archon, ideal, capital, chapter,
//                             festivals, the official one-line description, the version it opened in + date),
//                             its world + weekly bosses and local specialties, each drop with who uses it.
//   the feed               -- characters (region, element, rarity, card art) + farm (books, weapon materials).
//   /genshin-artifacts.json -- artifact domains (domain.region), sets on them.
//   /genshin-weapons.json  -- each weapon's forge [day group, city], for the weapon counts (loaded last).
// ?n=<nation key> = the open nation. Everything from the files is third-party text: esc() before markup.
(function () {
  const { $, esc, tile, NATIONS, EL, MONTHS, gameDay, serverTray, elIcon } = window.GI;
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const GROUPS = ['monday', 'tuesday', 'wednesday'];
  const GROUP_DAYS = { monday: [1, 4, 0], tuesday: [2, 5, 0], wednesday: [3, 6, 0] }; // + Sunday, every domain
  const WEEK = [1, 2, 3, 4, 5, 6, 0];
  const DAY1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const ELS = ['Pyro', 'Hydro', 'Anemo', 'Electro', 'Dendro', 'Cryo', 'Geo'];
  const natIcon = (n) => (n.el ? elIcon(n.el) : n.icon);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const date = (iso) => {
    const [y, m, d] = (iso || '').split('-').map(Number);
    return y ? `${MONTHS[m - 1]} ${d}, ${y}` : '';
  };
  const charLink = (name) => '/genshin-impact/characters?q=' + encodeURIComponent(name);

  // ---- MAP: where each nation sits. Not to scale: placed from each nation's official one-line
  // description ("northeast", "east", "far east", "west-central", "center", "western",
  // "northwestern", "north"), which the hover panel quotes. viewBox 1000 x 520.
  const POS = {
    mondstadt: [716, 186],
    liyue: [770, 352],
    inazuma: [918, 446],
    sumeru: [452, 368],
    fontaine: [494, 214],
    natlan: [196, 292],
    nodkrai: [292, 132],
    snezhnaya: [590, 74],
  };
  // A hand-drawn coast for the continent + three islands for Inazuma. Decoration only.
  const LAND =
    'M150 300C126 246 168 192 226 172C246 124 296 84 364 72C428 44 520 30 600 38C684 30 764 62 792 112C832 150 852 212 830 262C862 304 872 362 842 402C812 442 760 462 700 452C640 472 570 472 520 452C458 472 380 472 318 456C250 462 180 442 150 402C118 370 120 332 150 300Z';
  const ISLES = ['M878 432c20-14 52-10 62 8 8 16-10 32-36 32-24 0-42-22-26-40z', 'M948 482c10-8 26-4 28 6 2 12-14 16-24 12-8-4-10-12-4-18z', 'M898 494c8-6 20-4 22 4 2 8-10 12-18 10-6-2-8-8-4-14z'];

  let N = []; // genshin-nations.json nations, joined with GI.NATIONS (el, icon)
  let chars = [];
  let farm = null;
  let sets = [];
  let forge = null; // 'group|city' -> weapon count, once genshin-weapons.json lands
  let cur = '';
  const byName = {};

  // ---- ADDRESS ----
  const ask = new URLSearchParams(location.search).get('n');
  function setUrl() {
    const u = new URL(location.href);
    if (cur === N[0].key) u.searchParams.delete('n');
    else u.searchParams.set('n', cur);
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }

  // ---- PER-NATION DATA ----
  const people = (n) => chars.filter((c) => c.region === n.name).sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
  const books = (n) => (farm ? GROUPS.map((g) => ({ g, b: (farm[g].books || []).find((b) => b.city === n.name) })).filter((x) => x.b) : []);
  const mats = (n) => (farm ? GROUPS.map((g) => ({ g, m: (farm[g].weapons || []).find((m) => m.city === n.name) })).filter((x) => x.m) : []);
  function domains(n) {
    const out = {};
    sets.filter((s) => s.domain && s.domain.region === n.name).forEach((s) => (out[s.domain.name] = out[s.domain.name] || { name: s.domain.name, area: s.domain.area, sets: [] }).sets.push(s));
    return Object.values(out);
  }
  const mix = (list) => ELS.map((e) => ({ e, k: list.filter((c) => c.element === e).length })).filter((x) => x.k);

  // ---- PIECES ----
  const faces = (names, max) => {
    const list = names.filter((x) => byName[x]).map((x) => byName[x]);
    list.sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
    const top = list.slice(0, max);
    return `<div class="na-faces">${top.map((c) => `<a class="fm-face" href="${charLink(c.name)}">${tile(c.icon, c.rarity, c.name)}</a>`).join('')}${
      list.length > top.length ? `<span class="na-faces-n" title="${esc(list.slice(max).map((c) => c.name).join(', '))}">+${list.length - top.length}</span>` : ''
    }</div>`;
  };
  const tiers = (m, lo) =>
    `<div class="fm-tiers">${(m.tiers || [[m.series || m.name, m.icon]]).map(([n, ic], i) => tile(ic, lo + i, n)).join('<i class="fm-chev" aria-hidden="true"></i>')}</div>`;
  // Mon-Sun pips, the open days lit, today (on the picked server) ringed.
  function pips(g) {
    const wd = gameDay().getUTCDay();
    return `<span class="na-pips" aria-label="Open ${GROUP_DAYS[g].map((d) => DAYS[d]).join(', ')}">${WEEK.map(
      (d) => `<i class="${GROUP_DAYS[g].includes(d) ? 'is-on' : ''}${d === wd ? ' is-today' : ''}${d === 0 ? ' is-sun' : ''}" aria-hidden="true">${DAY1[d]}</i>`
    ).join('')}</span>`;
  }
  const openToday = (g) => GROUP_DAYS[g].includes(gameDay().getUTCDay());

  // The face of each nation in its hero: the archon's card (ARCHON_AS in the feed script), or who
  // stands for it where the archon isn't playable (Adrian, Oct 24 2026). Snezhnaya's archon isn't
  // playable yet: a mystery card until it is.
  const FACE = {
    fontaine: { name: 'Furina', tag: 'Former archon', cap: 'Furina, who played the Hydro Archon for 500 years' },
    nodkrai: { name: 'Columbina', tag: 'Moon goddess', cap: 'Columbina, the moon goddess Kuutar to the Frostmoon Scions' },
    snezhnaya: { mystery: true, tag: 'Archon' },
  };
  function faceOf(n) {
    const f = FACE[n.key] || {};
    if (f.mystery) return { mystery: true, tag: f.tag, cap: `${n.archon || 'Its archon'}, the ${n.element} Archon. Not playable yet` };
    const c = byName[f.name || n.archonAs];
    return c ? { c, tag: f.tag || 'Archon', cap: f.cap || `${n.archon}, the ${n.element} Archon` } : null;
  }
  const mystery = (n) => `<li class="ch-card r5 na-mystery" tabindex="0">
      <span class="na-q" aria-hidden="true"><img src="${natIcon(n)}" alt=""><b>?</b></span>
      <span class="ch-tags"><span class="na-archon-tag">Archon</span></span>
      <div class="ch-foot"><b>Unknown</b><span class="ch-stars">Not playable yet</span></div>
    </li>`;

  function card(c, tag) {
    const art = c.strip ? `<img class="ch-art" src="${esc(c.strip)}" alt="" loading="lazy" decoding="async" width="320" height="512">` : `<img class="ch-art is-icon" src="${esc(c.icon)}" alt="" loading="lazy" decoding="async">`;
    return `<li class="ch-card r${c.rarity}" tabindex="0">
      ${art}
      <span class="ch-els">${c.element ? `<img src="${elIcon(c.element.toLowerCase())}" alt="" title="${esc(c.element)}">` : ''}</span>
      ${tag ? `<span class="ch-tags"><span class="na-archon-tag">${esc(tag)}</span></span>` : ''}
      <div class="ch-foot"><b>${esc(c.name)}</b><span class="ch-stars" aria-label="${c.rarity} stars">${'&#9733;'.repeat(c.rarity)}</span><span class="ch-info">${[c.element, c.weapon].filter(Boolean).map(esc).join(' &middot; ')}</span></div>
    </li>`;
  }
  // The element mix as one bar: a segment per element, as wide as its count.
  const mixBar = (m, total, labels) =>
    `<div class="na-mix${labels ? '' : ' na-mix--sm'}" role="img" aria-label="${esc(m.map((x) => `${x.k} ${x.e}`).join(', '))}">${m
      .map((x) => `<span style="--k:${x.k};--c:${EL[x.e]}" title="${x.k} ${x.e}">${labels ? `<img src="${elIcon(x.e.toLowerCase())}" alt=""><b>${x.k}</b>` : ''}</span>`)
      .join('')}</div>`;

  // ---- MAP ----
  function drawMap() {
    const keys = N.map((n) => n.key);
    let road = '';
    for (let i = 1; i < keys.length; i++) {
      const [x1, y1] = POS[keys[i - 1]];
      const [x2, y2] = POS[keys[i]];
      const s = i % 2 ? 1 : -1; // each leg bends the other way, so the road wanders
      const cx = (x1 + x2) / 2 - (y2 - y1) * 0.18 * s;
      const cy = (y1 + y2) / 2 + (x2 - x1) * 0.18 * s;
      road += `<path class="na-leg" data-i="${i}" d="M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}"/>`;
    }
    const nodes = N.map(
      (n, i) => `<g class="na-node" data-n="${n.key}" transform="translate(${POS[n.key][0]} ${POS[n.key][1]})" tabindex="0" role="button" aria-label="${esc(n.name)}">
        <circle class="na-node-pulse" r="30"/><circle class="na-node-ring" r="25"/>
        <image href="${natIcon(n)}" x="-15" y="-15" width="30" height="30"/>
        <text class="na-node-v" y="-36">${esc(n.version)}</text>
        <text class="na-node-name" y="46">${esc(n.name)}</text>
        <text class="na-node-n" y="61">${people(n).length} characters</text>
      </g>`
    ).join('');
    $('naMap').innerHTML = `<svg viewBox="0 0 1000 520" aria-hidden="false" role="group" aria-label="Map of the nations">
      <defs>
        <pattern id="naDots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="rgba(211,188,142,0.16)"/></pattern>
        <clipPath id="naLandClip"><path d="${LAND}"/>${ISLES.map((d) => `<path d="${d}"/>`).join('')}</clipPath>
        ${N.map((n) => `<radialGradient id="naGlow-${n.key}"><stop offset="0" stop-color="${n.el ? EL[cap(n.el)] : '#8fa6c8'}" stop-opacity=".22"/><stop offset="1" stop-color="${n.el ? EL[cap(n.el)] : '#8fa6c8'}" stop-opacity="0"/></radialGradient>`).join('')}
      </defs>
      <g class="na-grid">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `<path d="M${i * 100} 0V520"/>`).join('')}${[1, 2, 3, 4].map((i) => `<path d="M0 ${i * 104}H1000"/>`).join('')}</g>
      <g class="na-land"><path d="${LAND}"/>${ISLES.map((d) => `<path d="${d}"/>`).join('')}</g>
      <g clip-path="url(#naLandClip)">
        <rect width="1000" height="520" fill="url(#naDots)"/>
        ${N.map((n) => `<circle class="na-glow" data-n="${n.key}" cx="${POS[n.key][0]}" cy="${POS[n.key][1]}" r="150" fill="url(#naGlow-${n.key})"/>`).join('')}
      </g>
      <path class="na-coast2" d="${LAND}" transform="translate(500 260) scale(.93) translate(-500 -260)"/>
      <g class="na-compass" transform="translate(70 80)"><circle r="30"/><path d="M0-40L6-6 0 0-6-6zM0 40L6 6 0 0-6 6z"/><path class="w" d="M-40 0L-6 -6 0 0-6 6zM40 0L6-6 0 0 6 6z"/><text y="-48">N</text></g>
      <g class="na-road">${road}</g>
      <g class="na-nodes">${nodes}</g>
    </svg>`;
    const map = $('naMap');
    const peek = (key) => paintPeek(key || cur);
    map.addEventListener('mouseover', (e) => {
      const g = e.target.closest('.na-node');
      if (g) peek(g.dataset.n);
    });
    map.addEventListener('mouseleave', () => peek());
    map.addEventListener('focusin', (e) => {
      const g = e.target.closest('.na-node');
      if (g) peek(g.dataset.n);
    });
    map.addEventListener('click', (e) => {
      const g = e.target.closest('.na-node');
      if (g) pick(g.dataset.n, true);
    });
    map.addEventListener('keydown', (e) => {
      const g = e.target.closest('.na-node');
      if (g && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        pick(g.dataset.n, true);
      }
    });
    // The road draws itself the first time the map scrolls into view.
    new IntersectionObserver(([e], o) => {
      if (!e.isIntersecting) return;
      map.classList.add('is-in');
      o.disconnect();
    }, { threshold: 0.25 }).observe(map);
  }
  // The map's glass panel: the hovered (or open) nation in the official words.
  function paintPeek(key) {
    const n = N.find((x) => x.key === key);
    if (!n) return;
    $('naPeek').innerHTML = `<span class="gi-label">${esc(n.chapter)} &middot; Version ${esc(n.version)}</span>
      <b><img src="${natIcon(n)}" alt="">${esc(n.name)}</b>
      <p>${esc(n.tagline)}</p>
      <small>${n.versionDate ? `Opened ${esc(date(n.versionDate))}` : ''}</small>`;
    document.querySelectorAll('.na-node').forEach((g) => g.classList.toggle('is-peek', g.dataset.n === key && key !== cur));
  }
  function paintMap() {
    const i = N.findIndex((n) => n.key === cur);
    document.querySelectorAll('.na-node').forEach((g) => g.classList.toggle('is-on', g.dataset.n === cur));
    document.querySelectorAll('.na-glow').forEach((g) => g.classList.toggle('is-on', g.dataset.n === cur));
    // The road up to the open nation is the Traveler's: lit.
    document.querySelectorAll('.na-leg').forEach((p) => p.classList.toggle('is-on', +p.dataset.i <= i));
    paintPeek(cur);
  }

  // ---- THE ROAD (release order list beside the map) + the tray over the dossier ----
  function drawRoad() {
    $('naRoad').innerHTML = N.map(
      (n) => `<li><button type="button" class="na-stop" data-n="${n.key}">
        <span class="na-stop-v">${esc(n.version)}</span>
        <span class="na-stop-t"><b>${esc(n.name)}</b><small>${esc(n.versionName)}</small></span>
        <span class="na-stop-d">${esc(date(n.versionDate))}</span>
      </button></li>`
    ).join('');
    $('naRoad').addEventListener('click', (e) => {
      const b = e.target.closest('[data-n]');
      if (b) pick(b.dataset.n, true);
    });
    $('naTabs').innerHTML = N.map((n) => `<button type="button" class="gi-tab" role="tab" data-n="${n.key}" aria-label="${esc(n.name)}" title="${esc(n.name)}"><img src="${natIcon(n)}" alt=""><span>${esc(n.name)}</span></button>`).join('');
    $('naTabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-n]');
      if (b) pick(b.dataset.n);
    });
  }

  // ---- DOSSIER ----
  function hero(n) {
    const ps = people(n);
    const face = faceOf(n);
    const five = ps.filter((c) => c.rarity === 5).length;
    const facts = [
      ['Archon', n.archon ? `${esc(n.archon)}${n.archonAs ? ` <small>(${esc(n.archonAs)})</small>` : ''}` : `<span class="na-none">None</span>${n.archonNote ? ` <small>${esc(n.archonNote)}</small>` : ''}`],
      ['Element', n.element ? `<span class="na-el"><img src="${elIcon(n.element.toLowerCase())}" alt="">${esc(n.element)}</span>` : '<span class="na-none">None</span> <small>(its mark is the Moonsign)</small>'],
      ['Ideal', n.ideal ? esc(n.ideal) : '<span class="na-none">None stated</span>'],
      ['Capital', esc(n.capital)],
      ['Governed by', esc(n.ruled)],
      ['Festivals', esc(n.festivals.join(', '))],
    ];
    return `<div class="na-hero-art" style="--img:url('/images/genshin/nation/${n.key}.webp')" aria-hidden="true"></div>
      <div class="na-hero-copy">
        <p class="gi-eyebrow">${esc(n.chapter)} &middot; Version ${esc(n.version)}</p>
        <h2 class="na-name"><img src="${natIcon(n)}" alt="">${esc(n.name)}</h2>
        <p class="na-tag">${esc(n.tagline)}</p>
        <dl class="na-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
        <ul class="na-stats">
          <li><b>${ps.length}</b><span>characters</span><small>${five} five-star &middot; ${ps.length - five} four-star</small></li>
          <li><b>${n.bosses.length}</b><span>world bosses</span></li>
          <li><b>${n.weekly.length}</b><span>weekly bosses</span></li>
          <li><b>${n.specialties.length}</b><span>specialties</span></li>
          <li><b>${domains(n).length}</b><span>artifact domains</span></li>
        </ul>
      </div>
      ${
        face
          ? `<figure class="na-god"><ul class="ch-grid na-god-card">${face.mystery ? mystery(n) : card(face.c, face.tag)}</ul><figcaption>${esc(face.cap)}</figcaption></figure>`
          : ''
      }
      <p class="na-opened">${n.versionName ? `<span>${esc(n.versionName)}</span>` : ''}${n.versionDate ? `<b>${esc(date(n.versionDate))}</b>` : ''}</p>`;
  }

  function peopleSec(n) {
    const ps = people(n);
    const m = mix(ps);
    const face = faceOf(n);
    return `<section class="na-sec" id="na-people" aria-labelledby="naPeopleT">
      <header class="gi-sec-head"><div><h3 class="gi-title" id="naPeopleT">People of <em>${esc(n.name)}.</em></h3><p class="mch-sec-sub">${plural(ps.length, 'playable character')} call it home${m.length ? `, across ${plural(m.length, 'element')}` : ''}.</p></div>
        <a class="gi-key gi-all" href="/genshin-impact/characters?nation=${n.key}">All in Characters${ARROW}</a></header>
      ${m.length ? mixBar(m, ps.length, true) : ''}
      ${ps.length ? `<ul class="ch-grid na-people">${ps.map((c) => card(c, face && face.c === c ? face.tag : '')).join('')}</ul>` : '<p class="gi-box gi-empty">No playable characters from here yet.</p>'}
    </section>`;
  }

  function farmSec(n) {
    const bs = books(n);
    const ms = mats(n);
    if (!bs.length && !ms.length) return '';
    const row = (g, x, kind) => {
      const today = openToday(g);
      const weps = kind === 'mat' && forge ? forge[g + '|' + n.name] || 0 : 0;
      return `<li class="na-farm-row">
        ${tiers(x, 2)}
        <div class="na-farm-t"><b>${esc(kind === 'book' ? x.series : x.name)}</b><small>${esc(x.domain || '')}</small></div>
        <div class="na-farm-d">${pips(g)}<span class="na-open${today ? ' is-on' : ''}">${today ? 'Open today' : 'Closed today'}</span></div>
        ${kind === 'book' ? faces((x.users || []).map((u) => u.name), 8) : `<a class="na-farm-w" href="/genshin-impact/farm?day=${g}">${weps ? plural(weps, 'weapon') : 'Weapons'}${ARROW}</a>`}
      </li>`;
    };
    return `<section class="na-sec" id="na-farm" aria-labelledby="naFarmT">
      <header class="gi-sec-head"><div><h3 class="gi-title" id="naFarmT">Farming in <em>${esc(n.name)}.</em></h3><p class="mch-sec-sub">Its talent books and weapon materials, the days their domains open and who needs them.</p></div>
        <div class="gi-tray gi-tray--sm na-server" role="tablist" aria-label="Server"><button type="button" class="gi-tab" data-server="asia" role="tab">Asia</button><button type="button" class="gi-tab" data-server="america" role="tab">NA</button><button type="button" class="gi-tab" data-server="europe" role="tab">EU</button></div></header>
      <div class="na-farm">
        ${bs.length ? `<div class="gi-box na-farm-box"><span class="gi-label">Talent books</span><ul>${bs.map(({ g, b }) => row(g, b, 'book')).join('')}</ul></div>` : ''}
        ${ms.length ? `<div class="gi-box na-farm-box"><span class="gi-label">Weapon materials</span><ul>${ms.map(({ g, m }) => row(g, m, 'mat')).join('')}</ul></div>` : ''}
      </div>
    </section>`;
  }

  function bossSec(n) {
    const world = n.bosses
      .map(
        (b) => `<li class="gi-box na-boss">
        <div class="na-boss-drop">${tile(b.drop.icon, b.drop.rarity || 4, b.drop.name)}</div>
        <div class="na-boss-t"><b>${esc(b.name)}</b><small>${esc(b.area)}</small><span class="na-boss-mat">${esc(b.drop.name)}</span></div>
        <div class="na-boss-gems" title="Ascension gems">${b.gems.map((g) => tile(g.icon, 5, g.name)).join('')}</div>
        ${b.drop.users.length ? faces(b.drop.users, 6) : '<p class="na-faces-none">No one uses it yet</p>'}
      </li>`
      )
      .join('');
    const weekly = n.weekly
      .map((b) => {
        const who = [...new Set([].concat(...b.drops.map((d) => d.users)))];
        return `<li class="gi-box na-week">
          <div class="na-week-h"><b>${esc(b.name)}</b><small>${esc(b.area)}</small></div>
          <ul class="na-week-drops">${b.drops.map((d) => `<li>${tile(d.icon, d.rarity || 5, d.name)}<span>${esc(d.name)}<small>${plural(d.users.length, 'character')}</small></span></li>`).join('')}</ul>
          ${who.length ? faces(who, 10) : ''}
        </li>`;
      })
      .join('');
    return `<section class="na-sec" id="na-bosses" aria-labelledby="naBossT">
      <header class="gi-sec-head"><div><h3 class="gi-title" id="naBossT">Bosses of <em>${esc(n.name)}.</em></h3><p class="mch-sec-sub">What each one drops for character ascension and talents, and who it's for.</p></div></header>
      <span class="gi-label na-sub">World bosses &middot; ${n.bosses.length}</span>
      ${world ? `<ul class="na-bosses">${world}</ul>` : '<p class="gi-box gi-empty">No world bosses listed yet.</p>'}
      <span class="gi-label na-sub">Weekly bosses &middot; ${n.weekly.length}</span>
      ${weekly ? `<ul class="na-weeks">${weekly}</ul>` : '<p class="gi-box gi-empty">No weekly boss here on the wiki\'s list yet.</p>'}
      <p class="gi-note">World bosses: 40 Original Resin per claim. Weekly bosses: 30 for your first three claims each week, 60 after that; they reset Monday at 04:00 server time.</p>
    </section>`;
  }

  function specSec(n) {
    if (!n.specialties.length) return '';
    return `<section class="na-sec" id="na-spec" aria-labelledby="naSpecT">
      <header class="gi-sec-head"><div><h3 class="gi-title" id="naSpecT">Local <em>specialties.</em></h3><p class="mch-sec-sub">The plants and finds that only grow here, and who needs them to ascend.</p></div></header>
      <ul class="na-specs">${n.specialties
        .map(
          (s) => `<li class="gi-box na-spec">${tile(s.icon, 3, s.name)}<div><b>${esc(s.name)}</b><small>${s.users.length ? plural(s.users.length, 'character') : 'Not used yet'}</small></div>${s.users.length ? faces(s.users, 3) : ''}</li>`
        )
        .join('')}</ul>
    </section>`;
  }

  function artSec(n) {
    const ds = domains(n);
    if (!ds.length) return '';
    return `<section class="na-sec" id="na-art" aria-labelledby="naArtT">
      <header class="gi-sec-head"><div><h3 class="gi-title" id="naArtT">Artifact <em>domains.</em></h3><p class="mch-sec-sub">${plural(ds.length, 'domain')}, open every day. Tap a set to inspect it.</p></div>
        <a class="gi-key gi-all" href="/genshin-impact/artifacts">All artifacts${ARROW}</a></header>
      <ul class="na-doms">${ds
        .map(
          (d) => `<li class="gi-box na-dom"><div class="na-dom-h"><b>${esc(d.name)}</b><small>${esc(d.area || '')}</small></div>
          <div class="na-dom-sets">${d.sets
            .map((s) => {
              const fl = (s.pieces || [])[0];
              const r = Math.max(...[].concat(s.rarity || 4));
              return `<a class="na-set" href="/genshin-impact/artifacts?s=${encodeURIComponent(s.slug)}"><span class="gi-tile r${r}">${fl ? `<img src="${esc(fl.art)}" alt="" loading="lazy" decoding="async">` : ''}</span><span>${esc(s.name)}</span></a>`;
            })
            .join('')}</div></li>`
        )
        .join('')}</ul>
    </section>`;
  }

  function drawDossier(anim) {
    const n = N.find((x) => x.key === cur);
    $('naHero').innerHTML = hero(n);
    $('naHero').style.setProperty('--nc', n.el ? EL[cap(n.el)] : '#8fa6c8');
    $('naBody').innerHTML = peopleSec(n) + farmSec(n) + bossSec(n) + specSec(n) + artSec(n);
    serverTray($('naBody').querySelector('.na-server'), () => drawDossier());
    if (anim) {
      $('naDossier').classList.remove('is-anim');
      void $('naDossier').offsetWidth;
      $('naDossier').classList.add('is-anim');
    }
  }

  // The hero never changes height between nations (5.6): every nation once, the tallest wins.
  // Re-measured when the width changes and once the fonts land.
  let lastW = 0;
  function measure() {
    const h = $('naHero');
    const w = h.clientWidth;
    if (!w || w === lastW) return;
    lastW = w;
    const keep = cur;
    h.style.minHeight = '';
    let max = 0;
    N.forEach((n) => {
      cur = n.key;
      h.innerHTML = hero(n);
      max = Math.max(max, h.offsetHeight);
    });
    cur = keep;
    h.innerHTML = hero(N.find((x) => x.key === cur));
    h.style.minHeight = max + 'px';
  }

  function pick(key, scroll) {
    if (!N.some((n) => n.key === key)) return;
    const changed = key !== cur;
    cur = key;
    document.querySelectorAll('#naTabs [data-n], #naRoad [data-n]').forEach((b) => {
      const on = b.dataset.n === cur;
      b.classList.toggle('active', on);
      b.setAttribute(b.closest('#naTabs') ? 'aria-selected' : 'aria-pressed', on);
    });
    document.querySelectorAll('#naBoard [data-n]').forEach((r) => r.classList.toggle('is-on', r.dataset.n === cur));
    const tab = $('naTabs').querySelector('.active');
    if (tab) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    paintMap();
    if (changed) drawDossier(true);
    setUrl();
    if (scroll) $('nation').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  // ---- SIDE BY SIDE: every nation in one board; a row opens it. ----
  function drawBoard() {
    const most = Math.max(...N.map((n) => people(n).length));
    const head = ['Nation', 'Opened', 'Characters', 'Elements', 'World bosses', 'Weekly', 'Specialties', 'Artifact sets', 'Talent books'];
    const rows = N.map((n) => {
      const ps = people(n);
      const nSets = sets.filter((s) => s.domain && s.domain.region === n.name).length;
      return `<button type="button" class="na-row" data-n="${n.key}" role="row">
        <span class="na-c na-c-n" role="cell"><img src="${natIcon(n)}" alt="">${esc(n.name)}</span>
        <span class="na-c" role="cell"><b>${esc(n.version)}</b><small>${esc(n.versionDate.slice(0, 4))}</small></span>
        <span class="na-c na-c-bar" role="cell"><b>${ps.length}</b><i style="--w:${(ps.length / most) * 100}%"></i></span>
        <span class="na-c" role="cell">${mixBar(mix(ps), ps.length, false)}</span>
        <span class="na-c" role="cell"><b>${n.bosses.length}</b></span>
        <span class="na-c" role="cell"><b>${n.weekly.length}</b></span>
        <span class="na-c" role="cell"><b>${n.specialties.length}</b></span>
        <span class="na-c" role="cell"><b>${nSets}</b></span>
        <span class="na-c na-c-books" role="cell">${books(n).map(({ b }) => tile(b.icon, 4, b.series)).join('')}</span>
      </button>`;
    }).join('');
    $('naBoard').innerHTML = `<div class="na-row na-row--h" role="row">${head.map((h) => `<span class="na-c" role="columnheader">${h}</span>`).join('')}</div>${rows}`;
    $('naBoard').addEventListener('click', (e) => {
      const r = e.target.closest('[data-n]');
      if (r) pick(r.dataset.n, true);
    });
  }

  function facts() {
    const total = N.reduce((a, n) => a + people(n).length, 0);
    const li = (v, t) => `<li><b>${v}</b>${t}</li>`;
    $('naFacts').innerHTML =
      li(N.length, 'regions') +
      li(total, 'characters') +
      li(N.reduce((a, n) => a + n.bosses.length, 0), 'world bosses') +
      li(N.reduce((a, n) => a + n.weekly.length, 0), 'weekly bosses') +
      li(N.reduce((a, n) => a + n.specialties.length, 0), 'local specialties');
  }

  Promise.all([
    fetch('/genshin-nations.json').then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }),
    GI.feed,
    fetch('/genshin-artifacts.json').then((r) => (r.ok ? r.json() : { sets: [] })).catch(() => ({ sets: [] })),
  ])
    .then(([nat, feed, art]) => {
      chars = feed.characters || [];
      chars.forEach((c) => (byName[c.name] = c));
      farm = feed.farm || null;
      sets = art.sets || [];
      N = (nat.nations || []).map((n) => Object.assign({}, NATIONS.find((x) => x.name === n.name) || {}, n));
      if (!N.length) throw new Error('no nations');
      cur = N.some((n) => n.key === ask) ? ask : N[0].key;
      facts();
      drawMap();
      drawRoad();
      drawBoard();
      drawDossier();
      pick(cur);
      measure();
      new ResizeObserver(measure).observe($('naDossier'));
      if (document.fonts) document.fonts.ready.then(() => ((lastW = 0), measure()));
      // Weapon counts per material: the biggest file, so it comes last and the farm rows fill in.
      fetch('/genshin-weapons.json')
        .then((r) => r.json())
        .then((w) => {
          forge = {};
          (w.weapons || []).forEach((x) => {
            if (!x.forge) return;
            const k = GROUPS[x.forge[0]] + '|' + x.forge[1];
            forge[k] = (forge[k] || 0) + 1;
          });
          drawDossier();
        })
        .catch(() => {});
    })
    .catch(() => {
      $('naBody').innerHTML = '<p class="gi-box gi-empty">The nations didn\'t load. Refresh to try again.</p>';
    });
})();
