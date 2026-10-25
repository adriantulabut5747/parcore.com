// Genshin Impact -- reactions (Oct 26 2026). Two jobs, one data file (genshin-reactions.json):
// 1. THE WHEEL: any `.gi-rx[data-rx]` box gets the element wheel + reaction card (the Lobby's section
//    and the chart page's first section; `data-rx="lobby"` adds the "Full chart" key). Was genshin-lobby.js
//    "REACTIONS" until the Lunar / Stellar reactions arrived.
// 2. THE CHART PAGE (/genshin-impact/reactions): each part runs only if its box is on the page.
// Portraits come from the feed's characters (GI.feed); without the feed the names still show.
// Styles: genshin-reactions.css. Facts + sources: docs/genshin-reactions-research.md.
(function () {
  const { $, esc, elIcon, tile } = window.GI;
  const ELS = ['pyro', 'hydro', 'anemo', 'electro', 'dendro', 'cryo', 'geo'];
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  // The drawn four-point star (the header frame's), standing in for Stellar Glimmer: there's no icon file.
  const STAR = '<svg class="rx-star" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 0c.6 4.2 1.8 5.4 6 6-4.2.6-5.4 1.8-6 6-.6-4.2-1.8-5.4-6-6 4.2-.6 5.4-1.8 6-6z"/></svg>';
  const MOON = '<img src="/images/genshin/element/moonsign.webp" alt="">';
  const MODE_ICON = { lunar: MOON, stellar: STAR };
  const KEY_EL = { lunar: 'hydro', stellar: 'cryo' }; // every Lunar reaction needs Hydro, every Stellar one Cryo
  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  const data = fetch('/genshin-reactions.json').then((r) => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
  // name -> feed character. "Traveler (Cryo)" is the feed's plain "Traveler".
  const people = GI.feed
    .then((f) => Object.fromEntries((f.characters || []).map((c) => [c.name, c])))
    .catch(() => ({}));
  const who = (name, map) => map[name] || map[name.replace(/ \(.*\)$/, '')];
  const face = (name, map) => {
    const c = who(name, map);
    return `<figure class="rx-face">${c ? tile(c.icon, c.rarity, name) : '<span class="gi-tile"></span>'}<figcaption>${esc(name)}</figcaption></figure>`;
  };
  const faces = (names, map) => `<div class="rx-faces">${names.map((n) => face(n, map)).join('')}</div>`;
  const orList = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1]);
  const els = (r) => r.els || (r.with ? [r.pair[0], r.with[0]] : r.pair);
  const elRow = (list) => list.map((el) => `<img src="${elIcon(el)}" alt="${cap(el)}" title="${cap(el)}">`).join('<span aria-hidden="true">+</span>');
  const nums = (r) => `<dl class="rx-nums">${r.nums.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;

  // Does reaction r happen when a and b meet? (follow-ups like Aggravate never sit on the wheel)
  const hits = (r, a, b) =>
    !r.on && (r.with ? (r.pair[0] === a && r.with.includes(b)) || (r.pair[0] === b && r.with.includes(a)) : r.pair.includes(a) && r.pair.includes(b));

  // ---- 1. THE WHEEL ----
  function wheel(root, D, map) {
    const RX = D.reactions;
    const byId = Object.fromEntries(RX.map((r) => [r.id, r]));
    const fam = Object.fromEntries(D.families.map((f) => [f.key, f]));
    const lobby = root.dataset.rx === 'lobby';
    const C = 200;
    const R = 140;
    const pos = ELS.map((_, i) => {
      const t = -Math.PI / 2 + (i * 2 * Math.PI) / ELS.length;
      return [C + R * Math.cos(t), C + R * Math.sin(t)];
    });
    root.innerHTML = `<div class="rx-wheel-col">
        <div class="gi-tray gi-tray--sm rx-mode" role="tablist" aria-label="Your party">
          <button type="button" class="gi-tab" role="tab" data-mode="classic">Classic</button>
          <button type="button" class="gi-tab" role="tab" data-mode="lunar">${MOON}Lunar</button>
          <button type="button" class="gi-tab" role="tab" data-mode="stellar">${STAR}Stellar</button>
        </div>
        <svg class="gi-wheel" viewBox="0 0 400 400" role="group" aria-label="Elements">
          <circle class="rx-ring" cx="${C}" cy="${C}" r="${R + 44}"/><circle class="rx-ring" cx="${C}" cy="${C}" r="${R - 44}"/>
          <polygon class="rx-poly" points="${pos.map((p) => p.join(',')).join(' ')}"/><g class="rx-links"></g>
          <text class="rx-mid-k" x="${C}" y="${C - 8}"></text><text class="rx-mid" x="${C}" y="${C + 14}"></text>
          ${ELS.map(
            (el, i) =>
              `<g class="rx-node" data-el="${el}" tabindex="0" role="button" aria-label="${cap(el)}" transform="translate(${pos[i][0]},${pos[i][1]})"><circle class="rx-halo" r="39"/><circle r="30"/><image href="${elIcon(el)}" x="-17" y="-17" width="34" height="34"/><text y="50">${cap(el)}</text></g>`
          ).join('')}
        </svg>
        <p class="rx-mode-note"></p>
      </div>
      <div class="gi-box rx-card" aria-live="polite">
        <p class="rx-kind"></p>
        <h3 class="rx-name"></h3>
        <p class="rx-eq"></p>
        <p class="rx-desc"></p>
        <div class="rx-extra"></div>
        <div class="rx-list"></div>
        ${lobby ? '<a class="gi-key gi-all rx-more" href="/genshin-impact/reactions">Full reactions chart<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>' : ''}
      </div>`;
    const q = (s) => root.querySelector(s);
    const svg = q('.gi-wheel');
    const MODE_NOTE = {
      classic: 'A party with no Moon Wheel or Stellar Linchpin user.',
      lunar: 'A Moon Wheel user or Columbina in the party: Hydro reactions turn Lunar.',
      stellar: 'A Stellar Linchpin user or the Cryo Traveler in the party: Cryo reactions turn Stellar.',
    };
    let mode = 'classic';
    let picked = ['pyro', 'hydro'];
    let shown = null;

    const find = (a, b) => {
      const base = RX.find((r) => (r.fam !== 'lunar' && r.fam !== 'stellar') && hits(r, a, b)) || null;
      const variant = mode === 'classic' ? null : RX.find((r) => r.fam === mode && hits(r, a, b)) || null;
      return { r: variant || base, base, variant };
    };
    // The line under the description: who swaps it in, what it becomes with them, or why nothing changed.
    function extra(r, base, variant) {
      if (!r) return '';
      if (variant) return `<p class="rx-swap-t">${MODE_ICON[r.fam]}<span>Replaces <b>${esc(byId[r.swap].name)}</b> when ${esc(orList(r.by))} is in your party. Since ${esc(r.since)}.</span></p>${faces(r.by, map)}`;
      const up = RX.find((x) => x.swap === r.id && (mode === 'classic' || x.fam === mode) && hits(x, ...picked));
      if (up) return `<p class="rx-swap-t">${MODE_ICON[up.fam]}<span>With ${esc(orList(up.by))} in your party this becomes <button type="button" class="rx-go" data-go="${up.id}">${esc(up.name)}</button>.</span></p>`;
      if (mode !== 'classic' && base && !base.on)
        return `<p class="rx-swap-t is-none">${MODE_ICON[mode]}<span>${mode === 'lunar' ? 'No Lunar version: every Lunar reaction needs Hydro, with Electro, Dendro or Geo.' : 'No Stellar version: Stellar Glimmer needs Cryo, with Electro or Anemo.'}</span></p>`;
      return '';
    }
    function draw(list, r, base, variant) {
      shown = r;
      svg.dataset.mode = mode;
      svg.querySelectorAll('.rx-node').forEach((g) => g.classList.toggle('is-on', list.includes(g.dataset.el)));
      const pts = list.map((el) => pos[ELS.indexOf(el)]);
      q('.rx-links').innerHTML =
        pts.length > 1
          ? pts
              .map((p, i) => (i < pts.length - 1 || pts.length > 2 ? `<line class="rx-link" x1="${p[0]}" y1="${p[1]}" x2="${pts[(i + 1) % pts.length][0]}" y2="${pts[(i + 1) % pts.length][1]}"/>` : ''))
              .join('')
          : '';
      q('.rx-mid-k').textContent = r ? fam[r.fam].name : list.length > 1 ? 'No reaction' : 'Tap one more';
      q('.rx-mid').textContent = r ? r.name : '';
      q('.rx-kind').innerHTML = r ? (MODE_ICON[r.fam] || '') + esc(fam[r.fam].name) : list.length > 1 ? 'No reaction' : 'Tap a second element';
      q('.rx-kind').classList.toggle('is-new', !!(r && MODE_ICON[r.fam]));
      q('.rx-name').textContent = r ? r.name : list.length > 1 ? 'Nothing happens' : cap(list[0]);
      q('.rx-eq').innerHTML = list.map((el) => `<img src="${elIcon(el)}" alt="">${cap(el)}`).join('<span aria-hidden="true">+</span>');
      q('.rx-desc').textContent = r
        ? r.desc
        : list.length > 1
          ? "Anemo, Geo and Dendro don't react with each other, and no element reacts with itself."
          : 'Choose another element on the wheel.';
      q('.rx-extra').innerHTML = (r ? nums(r) : '') + extra(r, base, variant);
      q('.rx-list').querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', !!r && b.dataset.id === r.id));
      q('.rx-mode').querySelectorAll('.gi-tab').forEach((b) => {
        b.classList.toggle('active', b.dataset.mode === mode);
        b.setAttribute('aria-selected', b.dataset.mode === mode);
      });
      q('.rx-mode-note').textContent = MODE_NOTE[mode];
      if (!lobby && r) history.replaceState(null, '', location.pathname + '?r=' + r.id + location.hash);
    }
    const pair = () => {
      const f = picked.length === 2 ? find(picked[0], picked[1]) : { r: null };
      draw(picked, f.r, f.base, f.variant);
    };
    // Show one reaction by id: its elements, in the party mode it needs. A classic reaction that has a
    // Lunar / Stellar version switches back to Classic; any other keeps the mode (the card says "no version").
    function show(id) {
      const r = byId[id];
      if (!r) return;
      if (MODE_ICON[r.fam]) mode = r.fam;
      else if (RX.some((x) => x.swap === id)) mode = 'classic';
      picked = els(r).slice();
      if (r.on) draw(picked, r, null, null);
      else pair();
    }
    q('.rx-list').innerHTML = RX.map(
      (r) => `<button type="button" data-id="${r.id}"${MODE_ICON[r.fam] ? ` class="is-${r.fam}"` : ''}>${MODE_ICON[r.fam] || ''}${esc(r.name)}</button>`
    ).join('');
    root.addEventListener('click', (e) => {
      const chip = e.target.closest('.rx-list button, .rx-go');
      if (chip) return show(chip.dataset.id || chip.dataset.go);
      const m = e.target.closest('.rx-mode .gi-tab');
      if (m) {
        mode = m.dataset.mode;
        if (shown && shown.on) draw(picked, shown, null, null);
        else pair();
      }
    });
    const choose = (el) => {
      // A third pick starts a new pair from the last one.
      picked = picked.length >= 2 ? [el] : picked[0] === el ? [el] : [picked[0], el];
      pair();
    };
    svg.addEventListener('click', (e) => {
      const g = e.target.closest('.rx-node');
      if (g) choose(g.dataset.el);
    });
    svg.addEventListener('keydown', (e) => {
      const g = e.target.closest('.rx-node');
      if (g && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        choose(g.dataset.el);
      }
    });
    const start = !lobby && new URLSearchParams(location.search).get('r');
    if (start && byId[start]) show(start);
    else pair();
    return { show };
  }

  // ---- 2. THE CHART PAGE ----
  // The swaps: one row per Lunar / Stellar reaction, from the classic one it replaces.
  function swaps(D, map, go) {
    const box = $('rxSwap');
    if (!box) return;
    const byId = Object.fromEntries(D.reactions.map((r) => [r.id, r]));
    box.innerHTML = D.reactions
      .filter((r) => r.swap)
      .map(
        (r) => `<button type="button" class="gi-box gi-card rx-sw is-${r.fam}" data-go="${r.id}">
          <span class="rx-sw-els">${elRow(els(r))}</span>
          <span class="rx-sw-from"><small>Classic</small><b>${esc(byId[r.swap].name)}</b></span>
          <span class="rx-sw-arrow" aria-hidden="true"><i></i>${MODE_ICON[r.fam]}<i></i></span>
          <span class="rx-sw-to"><small>${r.fam === 'lunar' ? 'Lunar' : 'Stellar'} · since ${esc(r.since)}</small><b>${esc(r.name)}</b></span>
          ${faces(r.by, map)}
        </button>`
      )
      .join('');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-go]');
      if (b) go(b.dataset.go);
    });
  }

  // One family's reaction cards (Lunar or Stellar): what it does, its numbers, who swaps it in.
  function famCards(D, map, key, id, go) {
    const box = $(id);
    if (!box) return;
    box.innerHTML = D.reactions
      .filter((r) => r.fam === key)
      .map(
        (r) => `<article class="gi-box rx-fc">
          <header><span class="rx-fc-els">${elRow(els(r))}</span><span class="gi-label">Since ${esc(r.since)}</span></header>
          <h3>${esc(r.name)}</h3>
          <p class="rx-fc-desc">${esc(r.desc)}</p>
          ${nums(r)}
          <p class="rx-fc-tip"><b>Good to know</b>${esc(r.tip)}</p>
          <footer><span class="gi-label">Swapped in by</span>${faces(r.by, map)}</footer>
          <button type="button" class="gi-key rx-fc-go" data-go="${r.id}">On the wheel<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>
        </article>`
      )
      .join('');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-go]');
      if (b) go(b.dataset.go);
    });
  }

  // Who's who: enablers vs. characters that only raise the Moonsign level.
  function rosters(D, map) {
    const set = (id, names) => $(id) && ($(id).innerHTML = faces(names, map));
    set('rxMoonOn', D.moonsign.enable);
    set('rxMoonLv', D.moonsign.level);
    set('rxStarOn', D.stellar.enable);
  }

  // EVERYONE PAYS IN: example hits for four contributors, blended 60 / 30 / 5 / 5.
  // The tray picks how many contributed; bars = each hit (grey) and what it adds (red).
  function share() {
    const box = $('rxShare');
    if (!box) return;
    const W = [0.6, 0.3, 0.05, 0.05];
    const HIT = [20000, 12000, 6000, 3000];
    const NAME = ['Best hit', '2nd', '3rd', '4th'];
    const bars = $('rxShareBars');
    let n = 2;
    function paint() {
      let sum = 0;
      bars.innerHTML = HIT.map((h, i) => {
        const on = i < n;
        const add = on ? h * W[i] : 0;
        sum += add;
        return `<li class="${on ? '' : 'is-off'}"><span class="rx-sh-k">${NAME[i]}<small>× ${W[i] * 100}%</small></span>
          <span class="rx-sh-bar"><i style="width:${(h / HIT[0]) * 100}%"></i><b style="width:${(add / HIT[0]) * 100}%"></b></span>
          <span class="rx-sh-v">${on ? '+' + fmt(add) : '—'}</span></li>`;
      }).join('');
      $('rxShareSum').textContent = fmt(sum);
      $('rxShareVs').textContent = Math.round((sum / HIT[0]) * 100) + '% of the best hit';
      box.querySelectorAll('[data-n]').forEach((b) => {
        b.classList.toggle('active', +b.dataset.n === n);
        b.setAttribute('aria-selected', +b.dataset.n === n);
      });
    }
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-n]');
      if (!b) return;
      n = +b.dataset.n;
      paint();
    });
    paint();
  }

  // A range input that paints its own fill (.gi-range reads --p).
  const range = (el, on) => {
    const paint = () => {
      el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min)) * 100 + '%');
      on(+el.value);
    };
    el.addEventListener('input', paint);
    paint();
  };

  // POLESTAR FIELD: Cryo / Electro hits counted in the last 4 s -> the field's buffs (wiki's table).
  function prism() {
    const el = $('rxPrismHits');
    if (!el) return;
    range(el, (h) => {
      $('rxPrismN').textContent = h;
      $('rxPrismCoef').textContent = (h ? 1.4 + 0.05 * Math.min(h, 12) : 1).toFixed(2) + '×';
      $('rxPrismDmg').textContent = '+' + (h ? 28 + Math.min(h, 12) : 20) + '%';
    });
  }

  // EVERY REACTION: the board, filtered by family; a row opens it on the wheel.
  function board(D, go) {
    const box = $('rxBoard');
    if (!box) return;
    const fam = Object.fromEntries(D.families.map((f) => [f.key, f]));
    const tray = $('rxFams');
    tray.innerHTML =
      '<button type="button" class="gi-tab active" data-fam="" role="tab" aria-selected="true">All</button>' +
      D.families.map((f) => `<button type="button" class="gi-tab" data-fam="${f.key}" role="tab">${MODE_ICON[f.key] || ''}${esc(f.name)}</button>`).join('');
    const lead = (r) => (r.nums[0] ? r.nums[0] : ['', '']);
    function paint(key) {
      const list = D.reactions.filter((r) => !key || r.fam === key);
      $('rxFamLine').textContent = key ? fam[key].line : 'Every reaction in the game, from the classics to Nod-Krai and Snezhnaya. Tap one to see it on the wheel.';
      box.innerHTML = list
        .map(
          (r) => `<button type="button" class="rx-row" data-go="${r.id}">
            <span class="rx-row-els">${elRow(els(r))}</span>
            <span class="rx-row-name"><b>${MODE_ICON[r.fam] || ''}${esc(r.name)}</b><small>${esc(fam[r.fam].name)}${r.on ? ' · after ' + esc(D.reactions.find((x) => x.id === r.on).name) : ''}</small></span>
            <span class="rx-row-desc">${esc(r.desc)}</span>
            <span class="rx-row-num"><small>${esc(lead(r)[0])}</small><b>${esc(lead(r)[1])}</b></span>
          </button>`
        )
        .join('');
    }
    tray.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fam]');
      if (!b) return;
      tray.querySelectorAll('.gi-tab').forEach((t) => {
        t.classList.toggle('active', t === b);
        t.setAttribute('aria-selected', t === b);
      });
      paint(b.dataset.fam);
    });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-go]');
      if (b) go(b.dataset.go);
    });
    paint('');
  }

  // EM: what your Elemental Mastery adds to each family (the game's formulas), and each damaging
  // reaction's base hit at a level (before enemy RES, crit and any other bonus).
  const EM = {
    lunar: (m) => (6 * m) / (m + 2000),
    trans: (m) => (16 * m) / (m + 2000),
    amp: (m) => (2.78 * m) / (m + 1400),
    add: (m) => (5 * m) / (m + 1200),
  };
  function emCalc(D) {
    const el = $('rxEm');
    if (!el) return;
    let lv = '90';
    let em = 0;
    const FAM = [
      ['lunar', 'Lunar & Stellar'],
      ['trans', 'Transformative'],
      ['add', 'Aggravate & Spread'],
      ['amp', 'Vaporize & Melt'],
    ];
    function paint() {
      $('rxEmN').textContent = em;
      const top = EM.trans(1500);
      $('rxEmBars').innerHTML = FAM.map(
        ([k, name]) =>
          `<li><span>${name}</span><span class="rx-em-bar"><i style="width:${(EM[k](em) / top) * 100}%"></i></span><b>+${Math.round(EM[k](em) * 100)}%</b></li>`
      ).join('');
      const L = D.levels[lv];
      $('rxEmHits').innerHTML = D.reactions
        .filter((r) => r.dmg && !r.direct)
        .map((r) => {
          let v;
          if (r.dmg === 'amp') v = r.amp.map((a) => '×' + (a * (1 + EM.amp(em))).toFixed(2)).join(' / ');
          else if (r.dmg === 'add') v = '+' + fmt(r.coef * L * (1 + EM.add(em)));
          else if (r.id === 'stellar-swirl') v = [0.75, 2, 3].map((c) => fmt(c * L * (1 + EM.lunar(em)))).join(' / ');
          else v = fmt(r.coef * L * (1 + EM[r.dmg](em)));
          return `<li class="is-${r.fam}"><span>${MODE_ICON[r.fam] || ''}${esc(r.name)}</span><b>${v}</b></li>`;
        })
        .join('');
    }
    range(el, (v) => {
      em = v;
      paint();
    });
    $('rxEmLv').addEventListener('click', (e) => {
      const b = e.target.closest('[data-lv]');
      if (!b) return;
      lv = b.dataset.lv;
      $('rxEmLv').querySelectorAll('.gi-tab').forEach((t) => {
        t.classList.toggle('active', t === b);
        t.setAttribute('aria-selected', t === b);
      });
      paint();
    });
  }

  // ---- go ----
  const roots = [...document.querySelectorAll('.gi-rx[data-rx]')];
  Promise.all([data, people])
    .then(([D, map]) => {
      const wheels = roots.map((root) => wheel(root, D, map));
      const main = $('wheel');
      // Rows and cards below put their reaction on the page's wheel, then glide up to it.
      const go = (id) => {
        if (!wheels[0]) return;
        wheels[0].show(id);
        if (main) GI.glide(main);
      };
      const facts = $('rxFacts');
      if (facts) {
        const n = D.reactions.length;
        const fresh = D.reactions.filter((r) => r.swap).length;
        facts.innerHTML = `<li><b>${n}</b>reactions</li><li><b>${fresh}</b>Lunar &amp; Stellar</li><li><b>${D.families.length}</b>families</li><li>Checked for <b>${esc(D.version)}</b></li>`;
      }
      swaps(D, map, go);
      famCards(D, map, 'lunar', 'rxLunarCards', go);
      famCards(D, map, 'stellar', 'rxStellarCards', go);
      rosters(D, map);
      board(D, go);
      emCalc(D);
    })
    .catch((err) => {
      console.error('genshin-reactions.json failed to load:', err);
      roots.forEach((r) => (r.innerHTML = '<p class="gi-box gi-empty">Couldn’t load the reactions right now. Try again in a bit.</p>'));
    });
  share();
  prism();
  GI.jumpNav($('rxJump'));
})();
