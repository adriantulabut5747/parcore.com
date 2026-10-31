// Genshin Impact weapons (/genshin-impact/weapons, Oct 23 2026). Mirrors the Characters page
// (genshin-characters.js): views By type | By rarity | A-Z, filters (type, rarity, substat, forgery
// day), search, every choice in the address. A card opens the details drawer (a <dialog>; ?w=<slug>
// in the address, so a weapon can be shared). Data: /genshin-weapons.json (scripts/genshin-feed.py
// `weapons()`) + the feed (GI.feed: the live weapon wish, who can wield each type).
// Styles: genshin-weapons.css (+ genshin-characters.css for the cards and bands).
(function () {
  const { $, esc, gameDay, elIcon, SI, SUB_ICON } = window.GI;
  const TYPES = ['Sword', 'Claymore', 'Polearm', 'Catalyst', 'Bow'];
  const DAYS = ['Mon / Thu', 'Tue / Fri', 'Wed / Sat'];
  const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // the day pips; JS getUTCDay() order is Sun = 0
  const OPEN = [[1, 4, 0], [2, 5, 0], [3, 6, 0]]; // forgery day group -> getUTCDay() values it's open on
  const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  // Today's forgery group on the viewer's server (-1 = Sunday: every domain is open).
  const today = () => [-1, 0, 1, 2, 0, 1, 2][gameDay().getUTCDay()];
  const slug = (w) => w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const pct = (w) => w.sub && w.sub !== 'Elemental Mastery';
  const top = (w) => w.stats[w.stats.length - 1] || [0, 0, 0, 0];
  const subVal = (w, v) => (pct(w) ? v.toFixed(1) + '%' : String(v));
  const stars = (n) => '&#9733;'.repeat(n);
  const num = (n) => n.toLocaleString('en-US');

  const si = (k) => `<svg class="wp-si" viewBox="0 0 24 24" aria-hidden="true">${SI[k] || SI.atk}</svg>`;

  let all = [];
  let items = {};
  let subs = [];
  let feed = { characters: [], banners: [] };
  let wish = null; // the live Weapon Event Wish, if any
  let hasLive = false; // #wpLive got filled

  // Address <-> state. Unknown values fall back to "all", so a hand-edited link can't break the page.
  const url = new URLSearchParams(location.search);
  const state = { q: url.get('q') || '', view: '', type: '', rarity: '', sub: '', day: '' };
  const OPTS = {
    view: ['type', 'rarity', 'az'],
    type: TYPES.map((t) => t.toLowerCase()),
    rarity: ['5', '4', '3', '2', '1'],
    day: ['0', '1', '2'],
  };
  Object.keys(OPTS).forEach((k) => {
    const v = (url.get(k) || '').toLowerCase();
    state[k] = OPTS[k].includes(v) ? v : k === 'view' ? 'type' : '';
  });
  const subKey = (s) => s.toLowerCase().replace(/[^a-z]+/g, '-');
  let open = null;
  const save = () => {
    const p = new URLSearchParams();
    ['view', 'type', 'rarity', 'sub', 'day'].forEach((k) => state[k] && !(k === 'view' && state[k] === 'type') && p.set(k, state[k]));
    if (state.q.trim()) p.set('q', state.q.trim());
    if (open) p.set('w', slug(open));
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  };

  const match = (w) => {
    const q = state.q.trim().toLowerCase();
    return (
      (!state.type || w.type.toLowerCase() === state.type) &&
      (!state.rarity || String(w.rarity) === state.rarity) &&
      (!state.sub || subKey(w.sub || 'none') === state.sub) &&
      (!state.day || (w.forge && String(w.forge[0]) === state.day)) &&
      (!q || w.name.toLowerCase().includes(q))
    );
  };
  const onWish = (w) => wish && wish.weapons.some((x) => x.name === w.name);

  // One card: a square button (opens the drawer) like the in-game inventory: the weapon's icon on
  // the game's rarity backing (/images/genshin/rarity/<n>.webp, set in the CSS), substat top left.
  const SUB_SHORT = { 'Elemental Mastery': 'EM', 'Energy Recharge': 'ER', 'Physical DMG Bonus': 'Phys DMG' };
  function card(w) {
    const sub = w.sub ? `<span class="wp-tile-tag">${si(SUB_ICON[w.sub])}${esc(SUB_SHORT[w.sub] || w.sub)}</span>` : '';
    return `<li><button type="button" class="wp-card r${w.rarity}" data-id="${w.id}" aria-label="${esc(w.name)}, ${w.rarity} stars">
      <img class="wp-tile-ico" src="${esc(w.icon)}" alt="" loading="lazy" decoding="async" width="256" height="256">
      ${sub}${onWish(w) ? '<span class="ch-tags"><span class="ch-live">On wish</span></span>' : ''}
      <span class="wp-tile-foot"><b>${esc(w.name)}</b><span class="wp-tile-stars" aria-hidden="true">${stars(w.rarity)}</span></span>
    </button></li>`;
  }
  const grid = (list) => `<ul class="ch-grid wp-grid">${list.map(card).join('')}</ul>`;

  // A band head: the type's (or rarity's) best-known art lying across the right side.
  function band(title, sub, list, total, art) {
    return `<section class="ch-nat wp-band" aria-label="${esc(title)}">
      <header class="ch-nat-head wp-head">${art ? `<img class="wp-head-art" src="${esc(art)}" alt="">` : ''}<div><h2>${esc(title)}</h2><p>${sub}</p></div>
        <span class="ch-nat-n"><b>${list.length === total ? total : `${list.length}</b> of <b>${total}`}</b> ${total === 1 ? 'weapon' : 'weapons'}</span></header>
      ${grid(list)}
    </section>`;
  }
  const bandArt = (list) => (list.find((w) => w.art && w.rarity === 5) || list.find((w) => w.art) || {}).art;

  function render() {
    const list = all.filter(match);
    const byRarity = (a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name);
    let html = '';
    if (!list.length) {
      html = '<p class="gi-box gi-empty ch-empty">Nothing matches that. Clear the filters or try another name.</p>';
    } else if (state.view === 'type') {
      html = TYPES.map((t) => {
        const of = all.filter((w) => w.type === t);
        const shown = list.filter((w) => w.type === t).sort(byRarity);
        return shown.length ? band(t, `${of.filter((w) => w.rarity === 5).length} five-star &middot; ${of.filter((w) => w.rarity === 4).length} four-star`, shown, of.length, bandArt(of)) : '';
      }).join('');
    } else if (state.view === 'rarity') {
      html = [5, 4, 3, 2, 1].map((r) => {
        const of = all.filter((w) => w.rarity === r);
        const shown = list.filter((w) => w.rarity === r).sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || a.name.localeCompare(b.name));
        return shown.length ? band(`${r}-star`, `<span class="wp-stars">${stars(r)}</span>`, shown, of.length, bandArt(of)) : '';
      }).join('');
    } else {
      html = grid(list.slice().sort((a, b) => a.name.localeCompare(b.name)));
    }
    $('wpList').innerHTML = html;
    $('wpList').classList.toggle('is-flat', state.view === 'az');
    $('wpCount').innerHTML = list.length === all.length ? `<b>${all.length}</b> weapons` : `<b>${list.length}</b> of ${all.length}`;
    const hidden = ['rarity', 'sub', 'day'].filter((k) => state[k]).length; // filters behind the phone key
    $('wpMoreN').hidden = !hidden;
    $('wpMoreN').textContent = hidden;
    $('wpClear').hidden = !(state.type || state.rarity || state.sub || state.day || state.q.trim());
    // Anything off the default (a filter, a search, another view) = you're hunting, not browsing (Adrian, Oct 29 2026).
    $('wpLive').hidden = !hasLive || !!(state.type || state.rarity || state.sub || state.day || state.q.trim() || state.view !== 'type');
    paint();
    save();
    if (open) position();
  }

  // Trays: one picked button raised (the shared .gi-tab look); "All" = "".
  const TRAYS = { wpView: 'view', wpType: 'type', wpRarity: 'rarity', wpSub: 'sub', wpDay: 'day' };
  const btn = (v, label, extra = '') => `<button type="button" class="gi-tab" data-v="${v}"${extra}>${label}</button>`;
  $('wpType').innerHTML = btn('', 'All') + TYPES.map((t) => btn(t.toLowerCase(), t)).join('');
  $('wpRarity').innerHTML = btn('', 'All') + [5, 4, 3, 2, 1].map((r) => btn(String(r), r + '&#9733;')).join('');
  const t0 = today();
  $('wpDay').innerHTML = btn('', 'Any day') + DAYS.map((d, i) => btn(String(i), d + (i === t0 ? '<i class="wp-today" title="Open today"></i>' : ''), i === t0 ? ' aria-label="' + d + ' (open today)"' : '')).join('');
  function paint() {
    Object.entries(TRAYS).forEach(([id, k]) =>
      $(id).querySelectorAll('.gi-tab').forEach((b) => {
        const on = b.dataset.v === state[k];
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on);
      })
    );
  }
  Object.entries(TRAYS).forEach(([id, k]) =>
    $(id).addEventListener('click', (e) => {
      const b = e.target.closest('.gi-tab');
      if (!b || b.dataset.v === state[k]) return;
      state[k] = b.dataset.v;
      render();
    })
  );
  $('wpQ').value = state.q;
  $('wpQ').addEventListener('input', (e) => {
    state.q = e.target.value;
    render();
  });
  $('wpClear').addEventListener('click', () => {
    Object.assign(state, { type: '', rarity: '', sub: '', day: '', q: '' });
    $('wpQ').value = '';
    render();
  });
  $('wpMoreKey').addEventListener('click', () => {
    const o = $('wpMore').classList.toggle('is-open');
    $('wpMoreKey').setAttribute('aria-expanded', o);
  });

  // ---- LIVE WISH: the weapon wish running now, above the list ----------------------------
  function liveWish() {
    const box = $('wpLive');
    const ws = wish ? wish.weapons.map((x) => all.find((w) => w.name === x.name)).filter(Boolean) : [];
    if (!ws.length) return;
    const five = ws.filter((w) => w.rarity === 5);
    const four = ws.filter((w) => w.rarity < 5);
    const mini = (w) => `<li><button type="button" class="wp-mini r${w.rarity}" data-id="${w.id}">${w.art ? `<img src="${esc(w.art)}" alt="" loading="lazy" decoding="async">` : `<img class="is-icon" src="${esc(w.icon)}" alt="">`}<span><b>${esc(w.name)}</b><i>${esc(w.type)} &middot; ${esc(w.sub || 'No substat')}</i></span></button></li>`;
    box.innerHTML = `<div class="wp-live-copy">
        <p class="gi-eyebrow">Epitome Invocation${wish.version ? ' &middot; ' + esc(wish.version) : ''}</p>
        <h2 class="wp-live-t" id="wpLiveT">On the weapon wish now</h2>
        <p class="wp-live-end">Ends in <b data-end-srv="${+wish.end}"></b></p>
        <a class="gi-key wp-live-key" href="/genshin-impact/banners">Banner details<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
      </div>
      <ul class="wp-live-five">${five.map(mini).join('')}</ul>
      <ul class="wp-live-four">${four.map(mini).join('')}</ul>`;
    hasLive = true; // render() shows it
    GI.countdowns();
  }
  $('wpLive').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    const w = b && all.find((x) => x.id === +b.dataset.id);
    if (w) show(w, b);
  });

  // ---- DRAWER ----------------------------------------------------------------------------
  const dlg = $('wpDrawer');
  const sheet = $('wpSheet');
  const body = $('wpDBody');
  // What scrolls: the right column on desktop (the hero stays put), the whole sheet on phones.
  const phone = () => matchMedia('(max-width: 970px)').matches;
  const scroller = () => (phone() ? body : $('wpDInfo'));
  let refine = 0;
  let opener = null;
  GI.stars($('wpHero')); // one sky for the drawer's life; only #wpHeroIn / #wpDMain are swapped

  // Passive text: [[word]] = the game's highlighted words; {n} = a number that changes with refinement.
  // Five whole texts (`r`, the wording differs a little): a highlight "changes" if R1's and R5's differ.
  function passiveText(p, r) {
    const raw = p.r ? p.r[r] : p.t;
    const r1 = p.r ? p.r[0].match(/\[\[.*?\]\]/g) || [] : [];
    const r5 = p.r ? p.r[4].match(/\[\[.*?\]\]/g) || [] : [];
    let k = 0;
    return esc(raw)
      .replace(/\[\[(.*?)\]\]/g, (m, x) => (r1[k] !== r5[k++] ? `<b class="wp-v">${x}</b>` : `<b>${x}</b>`))
      .replace(/\{(\d+)\}/g, (_, i) => `<b class="wp-v">${esc(p.v[+i][r])}</b>`)
      .replace(/\n/g, '<br>');
  }

  // The growth chart: every real step as a dot (ascension = the jump at the same level), base ATK
  // as the filled line, the substat as the red line, each on its own scale.
  function chart(w) {
    const S = w.stats;
    const W = 520, H = 150, L = 8, R = 8, T = 14, B = 26;
    const maxLv = S[S.length - 1][0];
    const x = (lv) => L + ((lv - 1) / (maxLv - 1)) * (W - L - R);
    const maxA = Math.max(...S.map((s) => s[2])) || 1;
    const maxS = Math.max(...S.map((s) => s[3])) || 1;
    const ya = (v) => T + (1 - v / maxA) * (H - T - B);
    const ys = (v) => T + (1 - v / maxS) * (H - T - B) * 0.92 + (H - T - B) * 0.08;
    const pa = S.map((s, i) => `${i ? 'L' : 'M'}${x(s[0]).toFixed(1)} ${ya(s[2]).toFixed(1)}`).join('');
    const ps = S.map((s, i) => `${i ? 'L' : 'M'}${x(s[0]).toFixed(1)} ${ys(s[3]).toFixed(1)}`).join('');
    const lvls = [...new Set(S.map((s) => s[0]))];
    const ticks = lvls.map((lv) => `<line x1="${x(lv)}" x2="${x(lv)}" y1="${T}" y2="${H - B}" class="g"/><text x="${x(lv)}" y="${H - 8}">${lv}</text>`).join('');
    const dots = S.map((s) => `<circle cx="${x(s[0])}" cy="${ya(s[2])}" r="${s[1] ? 3 : 2.2}" class="a${s[1] ? ' up' : ''}"/>`).join('');
    const sdots = w.sub ? S.map((s) => `<circle cx="${x(s[0])}" cy="${ys(s[3])}" r="2" class="s"/>`).join('') : '';
    return `<div class="wp-chart">
      <p class="wp-legend"><span class="k a">${si('atk')}Base ATK <b>${S[0][2]} &rarr; ${top(w)[2]}</b></span>${w.sub ? `<span class="k s">${si(SUB_ICON[w.sub])}${esc(w.sub)} <b>${subVal(w, S[0][3])} &rarr; ${subVal(w, top(w)[3])}</b></span>` : ''}</p>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Base ATK from ${S[0][2]} at level 1 to ${top(w)[2]} at level ${maxLv}">
        <defs><linearGradient id="wpFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
        ${ticks}
        <path d="${pa}L${x(maxLv)} ${H - B}L${x(1)} ${H - B}Z" fill="url(#wpFill)"/>
        <path d="${pa}" class="la"/>${w.sub ? `<path d="${ps}" class="ls"/>` : ''}${dots}${sdots}
      </svg>
      <p class="wp-quiet">Each dot is a level the game lists; the jumps are ascensions. Lines between dots are straight for reading, not the exact curve.</p>
    </div>`;
  }

  // Materials in their series, lowest tier first, the way the game lists them. Ids run by series
  // then tier, so a new series starts wherever the rarity stops climbing.
  function series(total, forgeIds) {
    const ids = Object.keys(total).map(Number).sort((a, b) => a - b);
    const groups = [];
    ids.forEach((id) => {
      const g = groups[groups.length - 1];
      const prev = g && g[g.length - 1];
      if (g && id === prev + 1 && (items[id] || [0, 0])[1] > (items[prev] || [0, 0])[1]) g.push(id);
      else groups.push([id]);
    });
    const label = (g) => {
      if (g.some((id) => forgeIds.has(String(id)))) return 'Weapon ascension material';
      const ranks = g.map((id) => (items[id] || [0, 1])[1]);
      if (g.length === 1 && String(g[0]).startsWith('10401')) return 'Ore';
      return Math.min(...ranks) >= 2 ? 'Elite enemy drops' : 'Common enemy drops';
    };
    const isForge = (g) => g.some((id) => forgeIds.has(String(id)));
    groups.sort((a, b) => isForge(b) - isForge(a)); // the domain's material first, as the game lists it
    return groups
      .map(
        (g) => `<div class="wp-series"><p class="wp-label">${label(g)}</p><ul>${g
          .map((id) => {
            const it = items[id] || ['Unknown', 1, ''];
            return `<li title="${esc(it[0])}"><span class="gi-tile r${it[1]}">${it[2] ? `<img src="${esc(it[2])}" alt="" loading="lazy" decoding="async">` : ''}</span><b>&times;${num(total[id])}</b><span class="wp-series-n">${esc(it[0])}</span></li>`;
          })
          .join('')}</ul></div>`
      )
      .join('');
  }

  // The weapon material domain on its nation's namecard, with the week drawn as pips.
  function domain(w) {
    if (!w.forge) return '';
    const [g, city, name] = w.forge;
    const nat = GI.NATIONS.find((n) => n.name === city);
    const d = gameDay().getUTCDay();
    const open = OPEN[g];
    const isOpen = open.includes(d);
    let next = '';
    if (!isOpen) for (let i = 1; i < 7 && !next; i++) if (open.includes((d + i) % 7)) next = i === 1 ? 'tomorrow' : DAY_FULL[(d + i) % 7];
    const pips = WEEK.map((lbl, i) => {
      const jd = (i + 1) % 7;
      return `<li class="${open.includes(jd) ? 'on' : ''}${jd === d ? ' now' : ''}">${lbl}</li>`;
    }).join('');
    return `<div class="wp-dom"${nat ? ` style="--img:url('/images/genshin/nation/${nat.key}.webp')"` : ''}>
      <p class="wp-label">Domain &middot; ${esc(city)}</p>
      <b class="wp-dom-name">${esc(name.replace('Domain of Forgery: ', ''))}</b>
      <ul class="wp-week" aria-label="Open on ${open.map((x) => DAY_FULL[x]).join(', ')}">${pips}</ul>
      ${isOpen ? '<em class="wp-dom-st is-open">Open today</em>' : `<em class="wp-dom-st">Opens ${esc(next)}</em>`}
    </div>`;
  }

  function hero(w) {
    const last = top(w);
    const live = onWish(w);
    return `<div class="wp-art-col"><span class="wp-pillar" aria-hidden="true"></span><span class="wp-floor" aria-hidden="true"></span>
        ${w.art ? `<img class="wp-d-art" src="${esc(w.art)}" alt="" width="256" height="512">` : `<img class="wp-d-art is-icon" src="${esc(w.icon)}" alt="">`}</div>
      <div class="wp-d-id">
        <p class="gi-eyebrow">${esc(w.type)}</p>
        <h2 id="wpDName">${esc(w.name)}</h2>
        <p class="wp-d-stars" aria-label="${w.rarity} stars">${stars(w.rarity)}</p>
        ${live ? `<a class="wp-d-live" href="/genshin-impact/banners#weapons"><i></i>On the weapon wish now &middot; <b data-end-srv="${+wish.end}"></b></a>` : ''}
        <dl class="wp-plates">
          <div>${si('atk')}<dt>Base ATK</dt><dd>${last[2]}</dd></div>
          ${w.sub ? `<div>${si(SUB_ICON[w.sub])}<dt>${esc(w.sub.replace('Physical DMG Bonus', 'Physical DMG'))}</dt><dd>${subVal(w, last[3])}</dd></div>` : ''}
          <div class="wp-plate-lv"><dt>Max level</dt><dd>${last[0]}</dd></div>
        </dl>
      </div>`;
  }

  function main(w) {
    const last = top(w);
    const total = {};
    let coins = 0;
    w.asc.forEach(([c, cost]) => {
      coins += c;
      Object.entries(cost).forEach(([id, n]) => (total[id] = (total[id] || 0) + n));
    });
    const forgeIds = new Set();
    if (w.forge) Object.keys(total).forEach((id) => id.startsWith('114') && forgeIds.add(id));
    const p = w.passive;
    const levels = w.stats
      .map(([lv, asc, atk, sub]) => `<tr${asc ? ' class="is-asc"' : ''}><th scope="row">${lv}${asc ? '<i>+</i>' : ''}</th><td>${atk}</td>${w.sub ? `<td>${subVal(w, sub)}</td>` : ''}</tr>`)
      .join('');
    const phases = w.asc
      .map(([c, cost], i) => {
        const from = w.stats[i * 2 + 1] ? w.stats[i * 2 + 1][0] : '';
        const to = w.stats[i * 2 + 3] ? w.stats[i * 2 + 3][0] : '';
        const chips = Object.entries(cost)
          .sort((a, b) => a[0] - b[0])
          .map(([id, n]) => {
            const it = items[id] || ['Unknown', 1, ''];
            return `<li title="${esc(it[0])}"><span class="gi-tile r${it[1]}">${it[2] ? `<img src="${esc(it[2])}" alt="${esc(it[0])}" loading="lazy" decoding="async">` : ''}</span><b>${num(n)}</b></li>`;
          })
          .join('');
        return `<li><span class="wp-phase"><b>${i + 1}</b>Lv ${from} &rarr; ${to}</span><ul class="wp-chips">${chips}</ul><span class="wp-phase-mora">${num(c)}</span></li>`;
      })
      .join('');
    const users = (feed.characters || []).filter((c) => c.weapon === w.type).sort((a, b) => b.rarity - a.rarity || b.release - a.release);
    const SHOW = 12;
    const sections = [];
    sections.push(
      p
        ? `<section class="wp-d-sec" id="wp-s-passive" data-jump="Passive"><div class="wp-d-head"><div><p class="wp-label">Weapon passive</p><h3>${esc(p.name)}</h3></div>
            ${w.rarity > 2 ? `<div class="gi-tray gi-tray--sm wp-ref" role="group" aria-label="Refinement">${[0, 1, 2, 3, 4].map((r) => `<button type="button" class="gi-tab${r === refine ? ' active' : ''}" data-r="${r}" aria-pressed="${r === refine}">R${r + 1}</button>`).join('')}</div>` : ''}</div>
            ${w.rarity > 2 ? `<ol class="wp-pips" id="wpPips" aria-hidden="true">${[0, 1, 2, 3, 4].map((r) => `<li${r <= refine ? ' class="on"' : ''}></li>`).join('')}</ol>` : ''}
            <p class="wp-passive" id="wpPassive">${passiveText(p, refine)}</p>
            ${p.v && p.v.length ? '<p class="wp-quiet">Numbers in red change with refinement.</p>' : ''}</section>`
        : '<section class="wp-d-sec" id="wp-s-passive" data-jump="Passive"><p class="wp-label">Weapon passive</p><p class="wp-quiet">None: 1- and 2-star weapons have no passive and can\'t be refined.</p></section>'
    );
    sections.push(`<section class="wp-d-sec" id="wp-s-stats" data-jump="Stats"><div class="wp-d-head"><div><p class="wp-label">Lv 1 &rarr; ${last[0]}</p><h3>Stats by level</h3></div></div>
        ${chart(w)}
        <table class="wp-levels"><thead><tr><th scope="col">Lv</th><th scope="col">Base ATK</th>${w.sub ? `<th scope="col">${esc(w.sub)}</th>` : ''}</tr></thead><tbody>${levels}</tbody></table>
        <p class="wp-quiet">+ = after ascending at that level.</p></section>`);
    if (w.asc.length)
      sections.push(`<section class="wp-d-sec" id="wp-s-asc" data-jump="Ascension"><div class="wp-d-head"><div><p class="wp-label">All ${w.asc.length} phases</p><h3>Ascension</h3></div></div>
          ${domain(w)}
          <div class="wp-series-list">${series(total, forgeIds)}</div>
          <div class="wp-mora"><img src="https://gi.yatta.moe/assets/UI/UI_ItemIcon_202.png" alt="" loading="lazy" decoding="async"><span>Mora</span><b>${num(coins)}</b></div>
          <details class="wp-phases"><summary>Each ascension phase</summary><ol>${phases}</ol></details></section>`);
    if (w.refine.length && p)
      sections.push(`<section class="wp-d-sec" id="wp-s-ref" data-jump="Refine"><div class="wp-d-head"><div><p class="wp-label">R1 &rarr; R5</p><h3>Refinement</h3></div><span class="wp-ref-total">${num(w.refine.reduce((a, b) => a + b, 0))} Mora</span></div>
          <ol class="wp-ladder">${w.refine.map((c, i) => `<li><i>R${i + 2}</i><b>${num(c)}</b><span>Mora + one copy</span></li>`).join('')}</ol>
          <p class="wp-quiet">Each step uses another copy of the weapon (some weapons also take a matching refinement material instead).</p></section>`);
    if (users.length)
      sections.push(`<section class="wp-d-sec" id="wp-s-who" data-jump="Wielders"><div class="wp-d-head"><div><p class="wp-label">${users.length} characters</p><h3>Who can equip it</h3></div>
          <a class="gi-key gi-all" href="/genshin-impact/characters?view=az&amp;weapon=${w.type.toLowerCase()}">All ${esc(w.type.toLowerCase())} users<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>
          <ul class="wp-who">${users
            .slice(0, SHOW)
            .map((c) => `<li title="${esc(c.name)}"><span class="gi-tile r${c.rarity}"><img src="${esc(c.icon)}" alt="${esc(c.name)}" loading="lazy" decoding="async"></span>${c.element ? `<img class="wp-who-el" src="${elIcon(c.element.toLowerCase())}" alt="">` : ''}</li>`)
            .join('')}${users.length > SHOW ? `<li class="wp-who-more">+${users.length - SHOW}</li>` : ''}</ul>
          <p class="wp-quiet">Every ${esc(w.type.toLowerCase())} user can equip it. Who it suits best isn't listed here.</p></section>`);
    if (w.desc)
      sections.push(`<section class="wp-d-sec" id="wp-s-lore" data-jump="Lore"><blockquote class="wp-desc"><p>${esc(w.desc).replace(/\[\[(.*?)\]\]/g, '$1').replace(/\n/g, '<br>')}</p><footer>In-game description</footer></blockquote></section>`);
    return sections.join('');
  }

  // Jump tray: one key per section, the one in view lit (IntersectionObserver on the drawer's scroller).
  let spy = null;
  function jumpTray() {
    const secs = [...$('wpDMain').querySelectorAll('[data-jump]')];
    $('wpJump').innerHTML = `<div class="gi-tray gi-tray--sm">${secs.map((s, i) => `<button type="button" class="gi-tab${i ? '' : ' active'}" data-to="${s.id}">${s.dataset.jump}</button>`).join('')}</div>`;
    if (spy) spy.disconnect();
    spy = new IntersectionObserver(
      (ents) => {
        const vis = ents.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!vis) return;
        $('wpJump').querySelectorAll('.gi-tab').forEach((b) => b.classList.toggle('active', b.dataset.to === vis.target.id));
      },
      { root: scroller(), rootMargin: '-30% 0px -60% 0px' }
    );
    secs.forEach((s) => spy.observe(s));
  }
  $('wpJump').addEventListener('click', (e) => {
    const b = e.target.closest('[data-to]');
    if (!b) return;
    const s = $(b.dataset.to);
    const sc = scroller();
    sc.scrollTo({ top: sc.scrollTop + s.getBoundingClientRect().top - sc.getBoundingClientRect().top - $('wpJump').offsetHeight - 8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  // Prev / next walk the cards in the order they're shown now (view + filters).
  const order = () => [...document.querySelectorAll('#wpList .wp-card')].map((b) => +b.dataset.id);
  function position() {
    const ids = order();
    const i = open ? ids.indexOf(open.id) : -1;
    $('wpDPos').textContent = open ? `${open.type} · ${'★'.repeat(open.rarity)}${i > -1 ? ` · ${i + 1} of ${ids.length}` : ''}` : '';
    $('wpDPrev').disabled = i < 1;
    $('wpDNext').disabled = i < 0 || i >= ids.length - 1;
  }
  function step(d) {
    const ids = order();
    const i = ids.indexOf(open && open.id);
    const w = i > -1 && all.find((x) => x.id === ids[i + d]);
    if (w) show(w);
  }
  $('wpDPrev').addEventListener('click', () => step(-1));
  $('wpDNext').addEventListener('click', () => step(1));
  dlg.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else return;
    e.preventDefault();
  });

  function show(w, from) {
    if (!dlg.open) opener = from || null;
    open = w;
    refine = 0;
    dlg.className = `wp-drawer r${w.rarity}`;
    $('wpDIco').innerHTML = `<img src="${esc(w.icon)}" alt="">`;
    $('wpHeroIn').innerHTML = hero(w);
    $('wpDMain').innerHTML = main(w);
    jumpTray();
    position();
    body.scrollTop = $('wpDInfo').scrollTop = 0;
    sheet.style.transform = '';
    if (!dlg.open) dlg.showModal();
    GI.countdowns();
    save();
  }
  // Close with the slide-out (the <dialog> itself closes instantly), unless motion is reduced.
  function hide() {
    if (!dlg.open || dlg.classList.contains('is-closing')) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return dlg.close();
    dlg.classList.add('is-closing');
    setTimeout(() => dlg.close(), 220);
  }
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault(); // Esc: animate out too
    hide();
  });
  dlg.addEventListener('close', () => {
    dlg.classList.remove('is-closing');
    sheet.style.transform = '';
    const was = open;
    open = null;
    save();
    const b = opener || (was && document.querySelector(`.wp-card[data-id="${was.id}"]`));
    if (b) b.focus({ preventScroll: true });
    opener = null;
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) return hide(); // the dim backdrop
    const r = e.target.closest('[data-r]');
    if (r && open && open.passive) {
      refine = +r.dataset.r;
      $('wpPassive').innerHTML = passiveText(open.passive, refine);
      dlg.querySelectorAll('.wp-ref .gi-tab').forEach((b) => {
        const on = +b.dataset.r === refine;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on);
      });
      dlg.querySelectorAll('#wpPips li').forEach((li, i) => li.classList.toggle('on', i <= refine));
    }
  });
  $('wpDClose').addEventListener('click', hide);
  $('wpDCopy').addEventListener('click', () => {
    const k = $('wpDCopy');
    navigator.clipboard
      .writeText(location.href)
      .then(() => {
        k.classList.add('is-done');
        k.querySelector('span').textContent = 'Copied';
        setTimeout(() => {
          k.classList.remove('is-done');
          k.querySelector('span').textContent = 'Copy link';
        }, 1600);
      })
      .catch(() => {});
  });

  // Phones: drag the grip / header down (or pull the content down at the top) to close.
  GI.sheetDrag(sheet, [$('wpGrip'), $('wpDBar')], body, hide);

  $('wpList').addEventListener('click', (e) => {
    const b = e.target.closest('.wp-card');
    const w = b && all.find((x) => x.id === +b.dataset.id);
    if (w) show(w, b);
  });

  paint();
  setInterval(GI.countdowns, 1000);

  Promise.all([
    fetch('/genshin-weapons.json').then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }),
    GI.feed.catch(() => ({})), // the feed only adds extras (live wish, wielders): the page works without it
  ])
    .then(([db, f]) => {
      all = db.weapons || [];
      items = db.items || {};
      if (!all.length) throw new Error('no weapons');
      feed = f || feed;
      const now = Date.now() / 1000;
      wish = (feed.banners || []).find((b) => /weapon/i.test(b.name) && (b.weapons || []).length && GI.srvEnd(b.end) > now) || null;
      subs = [...new Set(all.map((w) => w.sub || 'None'))].sort((a, b) => (a === 'None') - (b === 'None') || a.localeCompare(b));
      const s = (url.get('sub') || '').toLowerCase();
      state.sub = subs.some((x) => subKey(x) === s) ? s : '';
      $('wpSub').innerHTML = btn('', 'Any substat') + subs.map((x) => btn(subKey(x), esc(x === 'None' ? 'No substat' : x.replace('Physical DMG Bonus', 'Physical DMG')))).join('');
      const n = (r) => all.filter((w) => w.rarity === r).length;
      $('wpFacts').innerHTML = `<li><b>${all.length}</b>weapons</li><li><b>${n(5)}</b>5&#9733;</li><li><b>${n(4)}</b>4&#9733;</li><li><b>${all.length - n(5) - n(4)}</b>3&#9733; and under</li>`;
      // Klee's line under the header (Oct 27 2026): the count + the 5-stars on the weapon wish, in her voice.
      const onWish = wish ? wish.weapons.map((x) => all.find((w) => w.name === x.name)).filter((w) => w && w.rarity === 5).map((w) => w.name) : [];
      $('wpKlee').textContent = `Klee counted ${all.length} weapons! ` + (onWish.length ? `${onWish.join(' and ')} ${onWish.length > 1 ? 'are' : 'is'} on the weapon wish right now.` : 'Tap one to see its stats at every level.');
      liveWish();
      render();
      const pick = url.get('w') && all.find((w) => slug(w) === url.get('w'));
      if (pick) show(pick);
    })
    .catch((err) => {
      console.error('Weapons failed to load:', err);
      $('wpKlee').textContent = "Klee couldn't open the weapon chest. Try again in a bit!";
      $('wpList').innerHTML = "<p class=\"gi-box gi-empty ch-empty\">Couldn't load the weapons right now. Try again in a bit.</p>";
    });
})();
