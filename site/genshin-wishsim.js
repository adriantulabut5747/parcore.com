// Genshin Impact -- Wish simulator (/genshin-impact/wish-simulator, Oct 26 2026). The live banners from
// genshin-feed.json, the Standard pool + every drop's art from genshin-wishpool.json (feed script
// wish_pool()), the game's rules (RATES below, the wiki's Wish pages, checked Oct 26 2026). Everything the
// viewer does is saved in localStorage `gi-wish` (try/catch: the page works without it).
// Sections: RATES, STATE, PULL (one wish), BANNER CARD, STAGE (the dialog: SKY canvas = stars, meteors,
// sparks; then the reveals and the summary as HTML), HAUL, HISTORY, ODDS. Styles: genshin-wishsim.css.
(function () {
  const { $, esc, EL, NEUTRAL, short, srvEnd, countdowns, fit } = window.GI;
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  // ---- RATES: the community model on the wiki's Character / Weapon Event Wish pages (bilibili's 9.45M-wish
  // estimate). Base 0.6% / 0.7%, soft pity from 74 / 63 (+6% / +7% a wish), 4-star 5.1% / 6% with the jump on
  // the 9th / 8th and a sure one by the 10th / 9th. The game's own hard pity is 90 / 80; the weapon model
  // reaches 100% at 77. Standard = the character numbers.
  const P5 = {
    char: (n) => (n >= 90 ? 1 : n <= 73 ? 0.006 : Math.min(1, 0.006 + 0.06 * (n - 73))),
    weapon: (n) => (n >= 77 ? 1 : n <= 62 ? 0.007 : Math.min(1, 0.007 + 0.07 * (n - 62))),
  };
  P5.std = P5.char;
  const P4 = {
    char: (n) => (n >= 10 ? 1 : n === 9 ? 0.561 : 0.051),
    weapon: (n) => (n >= 9 ? 1 : n === 8 ? 0.66 : 0.06),
  };
  P4.std = P4.char;
  const HARD = { char: 90, weapon: 80, std: 90 };
  const COST = 160;
  const KIND = { c1: 'char', c2: 'char', w: 'weapon', s: 'std' };
  const TYPE = { char: 'Character Event Wish', weapon: 'Weapon Event Wish', std: 'Standard Wish' };
  const GOLD = '#d6a04e';
  const STD_EL = '#8fa3cf';
  // Rarity light (meteor, glow, sparks): the game's blue / purple / gold, as rgb for canvas gradients.
  const RC = { 3: '122,170,255', 4: '200,140,255', 5: '255,204,112' };
  const ICON = { glit: '/images/genshin/wish/starglitter.webp', dust: '/images/genshin/wish/stardust.webp', acq: '/images/genshin/wish/acquaint.webp', fate: '/images/genshin/fate.webp' };
  // The average wish a 5-star lands on under each model (shown next to yours, never as a verdict).
  const AVG = {};
  for (const k of ['char', 'weapon']) {
    let miss = 1;
    let e = 0;
    for (let n = 1; n <= HARD[k]; n++) {
      const p = P5[k](n);
      e += n * miss * p;
      miss *= 1 - p;
    }
    AVG[k] = e;
  }
  AVG.std = AVG.char;

  // ---- STATE (localStorage gi-wish) ----
  // k = counters per wish type: p5 / p4 = wishes since the last 5 / 4-star, g5 / g4 = guarantee, cr = the
  // Capturing Radiance counter, path / fp / end = Epitomized Path. own = copies of each item. tot = totals per type.
  // log = [time s, banner code, name, rarity, pity, how, 'c'|'w'], newest last, capped at LOG_MAX.
  const KEY = 'gi-wish';
  const LOG_MAX = 6000;
  const blankTot = () => ({ n: 0, five: 0, four: 0, glit: 0, dust: 0, won: 0, lost: 0, rad: 0, p5sum: 0 });
  const fresh = () => ({
    v: 1,
    k: { char: { p5: 0, p4: 0, g5: 0, g4: 0, cr: 0 }, weapon: { p5: 0, p4: 0, g5: 0, g4: 0, path: '', fp: 0, end: 0 }, std: { p5: 0, p4: 0, g4: 0 } },
    own: {},
    tot: { char: blankTot(), weapon: blankTot(), std: blankTot() },
    log: [],
    opt: { quick: false, instant: false },
  });
  let S = fresh();
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1 && s.k && s.tot && Array.isArray(s.log)) {
      const f = fresh();
      S = { ...f, ...s, k: { char: { ...f.k.char, ...s.k.char }, weapon: { ...f.k.weapon, ...s.k.weapon }, std: { ...f.k.std, ...s.k.std } }, opt: { ...f.opt, ...s.opt } };
      for (const k in f.tot) S.tot[k] = { ...blankTot(), ...(s.tot[k] || {}) };
    }
  } catch (e) {}
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) {}
  };

  let POOL = null; // genshin-wishpool.json
  let FACE = {}; // character name -> square face icon (feed roster)
  let BANNERS = [];
  let cur = null;

  // One drop as the page draws it.
  function item(name, t) {
    if (t === 'c') {
      const c = POOL.chars[name] || {};
      return { name, t, r: c.r || 4, el: c.el || '', wp: c.wp || '', art: c.splash || c.strip || '', card: c.strip || '', face: FACE[name] || '' };
    }
    const w = POOL.weapons[name] || {};
    return { name, t: 'w', r: w.r || 3, wp: w.type || '', art: w.art || '', card: w.art || '', face: w.icon || '' };
  }

  // ---- PULL: one wish on banner b. Order and rules follow the wiki: each wish rolls the 5-star chance
  // first, then the 4-star one (a 5-star doesn't reset the 4-star counter, so a due 4-star moves to the
  // next wish). Off-rate drops come from the Standard pool minus the featured items.
  function pull(b) {
    const s = S.k[b.kind];
    s.p5++;
    s.p4++;
    const p5 = P5[b.kind](s.p5);
    const p4 = P4[b.kind](s.p4);
    const u = Math.random();
    let r = 3;
    let pity = 0;
    if (u < p5) {
      r = 5;
      pity = s.p5;
      s.p5 = 0;
    } else if (u < p5 + Math.min(p4, 1 - p5)) {
      r = 4;
      pity = s.p4;
      s.p4 = 0;
    }
    const P = POOL.pool;
    let name;
    let t = 'w';
    let how = '';
    if (r === 5 && b.kind === 'char') {
      t = 'c';
      if (s.g5) {
        name = b.f5[0];
        how = 'guar';
        s.g5 = 0;
      } else if (s.cr >= 3) {
        // Capturing Radiance, community model (FAQ): a loss adds one, a win takes one off, three = a sure win.
        name = b.f5[0];
        how = 'rad';
        s.cr = 1;
      } else if (Math.random() < 0.5) {
        name = b.f5[0];
        how = 'win';
        s.cr = Math.max(0, s.cr - 1);
      } else {
        name = pick(P['5c'].filter((n) => n !== b.f5[0]));
        how = 'lose';
        s.g5 = 1;
        s.cr++;
      }
    } else if (r === 5 && b.kind === 'weapon') {
      if (s.path && s.fp >= 1) {
        name = s.path;
        how = 'path';
      } else if (s.g5 || Math.random() < 0.75) {
        name = pick(b.f5);
        how = s.g5 ? 'guar' : 'win';
      } else {
        name = pick(P['5w'].filter((n) => !b.f5.includes(n)));
        how = 'lose';
      }
      s.g5 = how === 'lose' ? 1 : 0;
      if (s.path) s.fp = name === s.path ? 0 : 1;
    } else if (r === 5) {
      t = Math.random() < 0.5 ? 'c' : 'w';
      name = pick(P[t === 'c' ? '5c' : '5w']);
    } else if (r === 4) {
      const odds = b.kind === 'weapon' ? 0.75 : 0.5;
      if (b.kind !== 'std' && (s.g4 || Math.random() < odds)) {
        name = pick(b.f4);
        t = b.kind === 'weapon' ? 'w' : 'c';
        s.g4 = 0;
      } else {
        t = Math.random() < 0.5 ? 'c' : 'w';
        name = pick(P[t === 'c' ? '4c' : '4w'].filter((n) => !b.f4.includes(n)));
        if (b.kind !== 'std') s.g4 = 1;
      }
    } else name = pick(P['3w']);

    const it = item(name, t);
    const before = S.own[name] || 0;
    S.own[name] = before + 1;
    it.before = before;
    it.how = how;
    it.pity = pity;
    // What a copy turns into (the wiki's Masterless Starglitter / Stardust pages).
    if (t === 'w') it.r === 3 ? (it.dust = 15) : (it.glit = it.r === 5 ? 10 : 2);
    else if (before) it.glit = before <= 6 ? (it.r === 5 ? 10 : 2) : it.r === 5 ? 25 : 5;
    const T = S.tot[b.kind];
    T.n++;
    T.glit += it.glit || 0;
    T.dust += it.dust || 0;
    if (r === 4) T.four++;
    if (r === 5) {
      T.five++;
      T.p5sum += pity;
      if (how === 'win') T.won++;
      if (how === 'rad') (T.won++, T.rad++);
      if (how === 'lose') T.lost++;
    }
    S.log.push([Math.floor(Date.now() / 1000), b.code, name, r, pity, how, t]);
    if (S.log.length > LOG_MAX) S.log.splice(0, S.log.length - LOG_MAX);
    return it;
  }

  // ---- BANNER CARD ----
  function build(feed) {
    const out = [];
    for (const b of feed.banners || []) {
      if (/weapon/i.test(b.name)) {
        const f5 = (b.weapons || []).filter((w) => w.rarity === 5 && POOL.weapons[w.name]).map((w) => w.name);
        const f4 = (b.weapons || []).filter((w) => w.rarity === 4 && POOL.weapons[w.name]).map((w) => w.name);
        if (f5.length && !out.some((x) => x.code === 'w')) out.push({ code: 'w', kind: 'weapon', f5, f4, end: b.end, version: b.version, el: GOLD, src: b });
        continue;
      }
      const five = (b.characters || []).find((c) => c.rarity === 5);
      if (!five || !POOL.chars[five.name]) continue;
      const code = out.some((x) => x.code === 'c1') ? 'c2' : 'c1';
      if (code === 'c2' && out.some((x) => x.code === 'c2')) continue;
      out.push({
        code,
        kind: 'char',
        f5: [five.name],
        f4: (b.characters || []).filter((c) => c.rarity === 4 && POOL.chars[c.name]).map((c) => c.name),
        end: b.end,
        version: b.version,
        el: EL[five.element] || NEUTRAL,
        src: five,
      });
    }
    out.sort((a, b) => 'c1c2ws'.indexOf(a.code) - 'c1c2ws'.indexOf(b.code));
    out.push({ code: 's', kind: 'std', f5: [], f4: [], end: 0, el: STD_EL });
    // A new weapon wish = new Epitomized Path: the Fate Point resets, like in the game.
    const w = out.find((x) => x.code === 'w');
    const ws = S.k.weapon;
    if (w && ws.end !== w.end) {
      ws.end = w.end;
      ws.fp = 0;
      if (!w.f5.includes(ws.path)) ws.path = '';
    }
    return out;
  }

  const banner = $('wsBanner');
  function tabs() {
    $('wsTabs').innerHTML = BANNERS.map((b) => {
      const pic = b.kind === 'char' ? FACE[b.f5[0]] : b.kind === 'weapon' ? POOL.weapons[b.f5[0]].icon : ICON.acq;
      const label = b.kind === 'char' ? b.f5[0] : b.kind === 'weapon' ? 'Weapons' : 'Standard';
      return `<button type="button" class="gi-tab" role="tab" data-code="${b.code}"><img src="${esc(pic)}" alt="">${esc(label)}</button>`;
    }).join('');
  }

  // The art for a banner: the 5-star's cut-out, the two weapons, or three Standard 5-stars.
  function art(b) {
    if (b.kind === 'char') return `<img class="wsb-img" src="${esc(POOL.chars[b.f5[0]].splash)}" alt="">`;
    if (b.kind === 'weapon')
      return `<div class="wsb-weps">${b.f5.map((n, i) => `<figure class="wsb-wep${S.k.weapon.path && S.k.weapon.path !== n ? ' is-dim' : ''}" style="--i:${i}"><i class="wsb-pillar"></i><img src="${esc(POOL.weapons[n].art)}" alt=""></figure>`).join('')}</div>`;
    const trio = ['Keqing', 'Diluc', 'Mona'].filter((n) => POOL.chars[n]);
    return `<div class="wsb-trio">${trio.map((n, i) => `<img src="${esc(POOL.chars[n].splash)}" alt="" style="--i:${i}">`).join('')}</div>`;
  }

  function show(code) {
    cur = BANNERS.find((b) => b.code === code) || BANNERS[0];
    try {
      localStorage.setItem('gi-wish-tab', cur.code);
    } catch (e) {}
    $('wsTabs').querySelectorAll('[data-code]').forEach((t) => {
      const on = t.dataset.code === cur.code;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on);
    });
    banner.style.setProperty('--gi-el', cur.el);
    banner.dataset.kind = cur.kind;
    const old = $('wsArt').firstElementChild;
    const next = document.createElement('div');
    next.className = 'wsb-layer';
    next.innerHTML = art(cur);
    $('wsArt').append(next);
    requestAnimationFrame(() => requestAnimationFrame(() => next.classList.add('is-in')));
    if (old) {
      old.classList.add('is-out');
      setTimeout(() => old.remove(), 500);
    }
    const fate = cur.kind === 'std' ? ICON.acq : ICON.fate;
    document.querySelectorAll('[data-fate]').forEach((i) => (i.src = fate));

    if (cur.kind === 'char') {
      const c = cur.src;
      $('wsType').textContent = cur.code === 'c2' ? 'Character Event Wish-2' : 'Character Event Wish';
      $('wsName').textContent = c.name;
      $('wsSub').innerHTML = `${c.title ? `<span>${esc(c.title)}</span><i>·</i>` : ''}<span class="wsb-el"><img src="${GI.elIcon(c.element.toLowerCase())}" alt="">${esc(c.element)}</span><i>·</i><span>${esc(c.weapon || '')}</span>`;
      $('wsFeat').innerHTML = `<span class="gi-label">Featured 4★ · 50% of every 4★</span><div class="wsb-fours">${cur.f4.map((n) => four(item(n, 'c'))).join('')}</div>`;
    } else if (cur.kind === 'weapon') {
      $('wsType').textContent = 'Weapon Event Wish';
      $('wsName').textContent = 'Epitome Invocation';
      $('wsSub').innerHTML = `<span>${cur.f5.map(esc).join(' &amp; ')}</span>`;
      paintPath();
    } else {
      $('wsType').textContent = 'Standard Wish · always open';
      $('wsName').textContent = 'Wanderlust Invocation';
      const P = POOL.pool;
      $('wsSub').innerHTML = `<span>No featured items: any of ${P['5c'].length} 5★ characters or ${P['5w'].length} 5★ weapons</span>`;
      $('wsFeat').innerHTML = `<span class="gi-label">The 5★ characters in this wish</span><div class="wsb-fours">${P['5c'].map((n) => four(item(n, 'c'))).join('')}</div>`;
    }
    $('wsEndRow').innerHTML = cur.end
      ? `<span class="gi-label">Version ${esc(cur.version || '')} · ends in</span><b data-end-srv="${cur.end}">${short(srvEnd(cur.end) - Date.now() / 1000)}</b>`
      : `<span class="gi-label">Permanent wish ·</span><b>Never ends</b>`;
    fit($('wsName'));
    hud();
  }
  const four = (it) =>
    `<span class="wsb-four r${it.r}" title="${esc(it.name)}"><img src="${esc(it.card)}" alt="${esc(it.name)}" loading="lazy">${it.el ? `<img class="wsb-four-el" src="${GI.elIcon(it.el.toLowerCase())}" alt="">` : ''}</span>`;

  // Epitomized Path: pick one of the two weapons (or none). Changing it resets the Fate Point (the wiki).
  function paintPath() {
    const ws = S.k.weapon;
    $('wsFeat').innerHTML = `<span class="gi-label">Epitomized Path · Fate Points ${ws.path ? ws.fp + ' / 1' : 'off'}</span>
      <div class="wsb-path">${cur.f5
        .map((n) => {
          const w = POOL.weapons[n];
          return `<button type="button" class="wsb-pathkey${ws.path === n ? ' is-on' : ''}" data-path="${esc(n)}" aria-pressed="${ws.path === n}"><img src="${esc(w.icon)}" alt="">${esc(n)}</button>`;
        })
        .join('')}</div>`;
  }
  $('wsFeat').addEventListener('click', (e) => {
    const k = e.target.closest('[data-path]');
    if (!k || !cur || cur.kind !== 'weapon') return;
    const ws = S.k.weapon;
    ws.path = ws.path === k.dataset.path ? '' : k.dataset.path;
    ws.fp = 0;
    save();
    paintPath();
    $('wsArt')
      .querySelectorAll('.wsb-wep')
      .forEach((f, i) => f.classList.toggle('is-dim', !!ws.path && ws.path !== cur.f5[i]));
    hud();
  });

  // The pity wells under the art.
  function hud() {
    const s = S.k[cur.kind];
    const next = P5[cur.kind](s.p5 + 1);
    const pct = (p) => (p >= 1 ? '100%' : (p * 100).toFixed(p < 0.1 ? 1 : 0) + '%');
    const well = (label, big, of, small, fill) =>
      `<div class="wsb-well"><span class="gi-label">${label}</span><b>${big}<small>${of}</small></b>${fill != null ? `<i class="wsb-bar"><i style="width:${Math.min(100, fill * 100)}%"></i></i>` : ''}<small>${small}</small></div>`;
    let third;
    if (cur.kind === 'char') {
      const pips = [0, 1, 2].map((i) => `<i class="${i < s.cr ? 'on' : ''}"></i>`).join('');
      third = well('Next 5★', s.g5 ? 'Guaranteed' : '50/50', '', `<span class="wsb-pips" title="Capturing Radiance">${pips}</span>Radiance ${Math.min(s.cr, 3)}/3`);
    } else if (cur.kind === 'weapon') {
      third = well('Next 5★', s.path && s.fp ? 'Your pick' : s.g5 ? 'Guaranteed' : '75/25', '', s.path ? `Path: ${esc(s.path)}` : 'No path set');
    } else third = well('Next 5★', 'Any', '', `${POOL.pool['5c'].length + POOL.pool['5w'].length} in the pool`);
    $('wsHud').innerHTML =
      well('5★ pity', s.p5, ' / ' + HARD[cur.kind], `This wish: <b>${pct(next)}</b>`, s.p5 / HARD[cur.kind]) +
      well('4★ pity', s.p4, ' / 10', s.g4 ? 'Next 4★ is featured' : cur.kind === 'std' ? 'One every 10' : cur.kind === 'weapon' ? '75% featured' : '50% featured', s.p4 / 10) +
      third;
    const T = S.tot[cur.kind];
    $('wsSpent').innerHTML = `<img src="/images/genshin/primogem.webp" alt="" width="18" height="18"><b>${fmt(T.n * COST)}</b> spent here · ${fmt(T.n)} wishes`;
  }

  // ---- STAGE ----
  const stage = $('wsStage');
  const reveal = $('wsReveal');
  const sum = $('wsSum');
  const endBar = $('wsEnd');
  const hint = $('wsHint');
  let run = null; // the current show: {skip, waiters[]}

  // SKY: one canvas, one rAF loop while the stage is open. Stars twinkle; meteors are a head + a fading
  // trail of past points + sparks; bursts are rings + sparks (+ rays for a 5-star). Everything adds light
  // ('lighter'), so overlapping glows brighten like real light.
  const Sky = (() => {
    const cv = $('wsSky');
    const ctx = cv.getContext('2d');
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let stars = [];
    let parts = [];
    let mets = [];
    let rings = [];
    let rays = [];
    let amb = null;
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.width = Math.floor(innerWidth * dpr);
      h = cv.height = Math.floor(innerHeight * dpr);
      stars = Array.from({ length: Math.round((innerWidth * innerHeight) / 4200) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h * 0.92,
        r: (Math.random() * 1.1 + 0.25) * dpr,
        a: Math.random() * 0.55 + 0.15,
        ph: Math.random() * 6.28,
        sp: Math.random() * 0.03 + 0.006,
      }));
    }
    const bez = (m, k) => {
      const q = 1 - k;
      return [q * q * m.a[0] + 2 * q * k * m.c[0] + k * k * m.b[0], q * q * m.a[1] + 2 * q * k * m.c[1] + k * k * m.b[1]];
    };
    // g = gravity per frame (bursts fall, embers float), drag = speed kept per frame.
    function spark(x, y, col, vx, vy, life, r, g = 0.02, drag = 0.97) {
      parts.push({ x, y, vx, vy, life, max: life, r: r * dpr, col, g: g * dpr, drag });
    }
    function burst(x, y, r, big) {
      const col = RC[r];
      rings.push({ x, y, t: 0, dur: big ? 70 : 46, col, max: Math.min(w, h) * (big ? 0.55 : 0.32) });
      if (big) rings.push({ x, y, t: -10, dur: 80, col, max: Math.min(w, h) * 0.85 });
      const n = big ? 150 : 70;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283;
        const v = (Math.random() * (big ? 9 : 6) + 1.5) * dpr;
        spark(x, y, col, Math.cos(a) * v, Math.sin(a) * v - 1.5 * dpr, 40 + Math.random() * 50, Math.random() * 2.2 + 0.8);
      }
      if (big) rays.push({ x, y, t: 0, dur: 140, col, rot: Math.random() * 6.28 });
    }
    function frame() {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const s of stars) {
        s.ph += s.sp;
        ctx.fillStyle = `rgba(220,228,255,${(s.a * (0.55 + 0.45 * Math.sin(s.ph))).toFixed(3)})`;
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      // Rays: long soft wedges turning slowly behind a 5-star's burst.
      for (const R of rays) {
        R.t++;
        const k = R.t / R.dur;
        const al = Math.sin(Math.min(1, k) * Math.PI) * 0.5;
        const L = Math.max(w, h) * (0.6 + k * 0.5);
        ctx.save();
        ctx.translate(R.x, R.y);
        ctx.rotate(R.rot + k * 0.5);
        for (let i = 0; i < 14; i++) {
          ctx.rotate(6.283 / 14);
          const g = ctx.createLinearGradient(0, 0, L, 0);
          g.addColorStop(0, `rgba(${R.col},${al})`);
          g.addColorStop(1, `rgba(${R.col},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(L, -L * 0.045);
          ctx.lineTo(L, L * 0.045);
          ctx.fill();
        }
        ctx.restore();
      }
      rays = rays.filter((R) => R.t < R.dur);
      for (const g of rings) {
        g.t++;
        if (g.t < 0) continue;
        const k = g.t / g.dur;
        const e = 1 - Math.pow(1 - k, 3);
        ctx.strokeStyle = `rgba(${g.col},${(1 - k) * 0.8})`;
        ctx.lineWidth = (1 - k) * 10 * dpr + 1;
        ctx.beginPath();
        ctx.arc(g.x, g.y, e * g.max, 0, 6.283);
        ctx.stroke();
      }
      rings = rings.filter((g) => g.t < g.dur);
      for (const m of mets) {
        m.t++;
        if (m.t < 0) continue; // a ten-wish's later streaks wait their turn
        const k = Math.min(1, m.t / m.dur);
        const e = 1 - Math.pow(1 - k, 1.8);
        if (!m.done) {
          const [x, y] = bez(m, e);
          m.trail.push([x, y]);
          if (m.trail.length > m.len) m.trail.shift();
          for (let i = 0; i < m.shed; i++)
            spark(x + (Math.random() - 0.5) * m.wd, y + (Math.random() - 0.5) * m.wd, Math.random() < 0.3 ? '255,255,255' : m.col, (Math.random() - 0.5) * 1.6 * dpr, (Math.random() - 0.2) * 1.6 * dpr, 22 + Math.random() * 30, Math.random() * 1.8 + 0.5, 0.01);
          if (k >= 1) {
            m.done = true;
            if (m.main) burst(x, y, m.r, m.r === 5);
            if (m.end) m.end();
          }
        } else m.trail.shift();
        const n = m.trail.length;
        for (let i = 1; i < n; i++) {
          const f = i / n;
          ctx.strokeStyle = `rgba(${m.col},${(f * f * 0.9).toFixed(3)})`;
          ctx.lineWidth = m.wd * f;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(m.trail[i - 1][0], m.trail[i - 1][1]);
          ctx.lineTo(m.trail[i][0], m.trail[i][1]);
          ctx.stroke();
        }
        if (!m.done && n) {
          const [x, y] = m.trail[n - 1];
          const R = m.wd * (4 + Math.sin(m.t * 0.6) * 0.6);
          const g = ctx.createRadialGradient(x, y, 0, x, y, R);
          g.addColorStop(0, 'rgba(255,255,255,1)');
          g.addColorStop(0.18, `rgba(${m.col},0.95)`);
          g.addColorStop(1, `rgba(${m.col},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, R, 0, 6.283);
          ctx.fill();
        }
      }
      mets = mets.filter((m) => !m.done || m.trail.length);
      // Embers behind a reveal: rise from the lower half, no gravity, no drag.
      if (amb && Math.random() < amb.rate)
        spark(Math.random() * w, h * (0.55 + Math.random() * 0.5), amb.col, (Math.random() - 0.5) * 0.3 * dpr, -(Math.random() * 1.2 + 0.4) * dpr, 200 + Math.random() * 180, Math.random() * 2 + 0.6, 0, 1);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.g;
        p.life--;
        const a = p.drag === 1 ? Math.sin((p.life / p.max) * Math.PI) : p.life / p.max; // embers fade in and out
        ctx.fillStyle = `rgba(${p.col},${(a * 0.9).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.4 + a * 0.6), 0, 6.283);
        ctx.fill();
      }
      parts = parts.filter((p) => p.life > 0);
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(frame);
    }
    return {
      start() {
        size();
        if (!raf) raf = requestAnimationFrame(frame);
      },
      stop() {
        cancelAnimationFrame(raf);
        raf = 0;
        parts = [];
        mets = [];
        rings = [];
        rays = [];
        amb = null;
      },
      size,
      // Before the reveals: the landing's rays, rings and sparks go, only the stars stay.
      calm() {
        rays = [];
        rings = [];
        parts = [];
        mets = [];
      },
      ambient(r) {
        amb = r ? { col: RC[r], rate: r === 5 ? 0.7 : r === 4 ? 0.45 : 0.2 } : null;
      },
      // The fall: the main meteor in the best rarity's colour from the top right to the horizon, the others
      // (a ten-wish) as thinner streaks around it. Resolves when the main one lands.
      fall(best, res) {
        return new Promise((done) => {
          const W = w;
          const H = h;
          const main = {
            a: [W * 1.06, -H * 0.12],
            c: [W * 0.8, H * 0.38],
            b: [W * 0.4, H * 0.7],
            t: 0,
            dur: best === 5 ? 118 : 100,
            col: RC[best],
            r: best,
            wd: (best === 5 ? 11 : 9) * dpr,
            len: 42,
            shed: best === 5 ? 6 : 4,
            trail: [],
            main: true,
            end: done,
          };
          mets.push(main);
          const extra = res.length > 1 ? res.filter((x) => x !== res.find((y) => y.r === best)).slice(0, 6) : [];
          extra.forEach((x, i) => {
            const dx = (i % 2 ? 1 : -1) * (0.05 + i * 0.035);
            mets.push({
              a: [W * (1.02 + Math.random() * 0.12), -H * (0.05 + Math.random() * 0.2)],
              c: [W * (0.84 + dx), H * (0.3 + Math.random() * 0.12)],
              b: [W * (0.4 + dx * 3.2), H * (0.66 + Math.random() * 0.1)],
              t: -6 - i * 5,
              dur: 84 + Math.random() * 18,
              col: RC[x.r],
              r: x.r,
              wd: (3 + Math.random() * 2) * dpr,
              len: 26,
              shed: 1,
              trail: [],
            });
          });
        });
      },
    };
  })();

  const frame2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  // Waits that a Skip (or closing) cuts short.
  function wait(ms) {
    return new Promise((r) => {
      const id = setTimeout(r, ms);
      run.waiters.push(() => (clearTimeout(id), r()));
    });
  }
  // A tap, a click, Space or Enter on the stage: the next reveal.
  function tap(minMs) {
    return new Promise((r) => {
      const t0 = performance.now();
      const go = (e) => {
        if (e.type === 'keydown' && !['Enter', ' ', 'ArrowRight'].includes(e.key)) return;
        if (e.target.closest && e.target.closest('.ws-skip, .ws-end, .ws-sum')) return;
        if (performance.now() - t0 < minMs) return;
        if (e.type === 'keydown') e.preventDefault();
        off();
        r();
      };
      const off = () => {
        stage.removeEventListener('pointerup', go);
        stage.removeEventListener('keydown', go);
      };
      stage.addEventListener('pointerup', go);
      stage.addEventListener('keydown', go);
      run.waiters.push(() => (off(), r()));
    });
  }
  const preload = (src) =>
    new Promise((r) => {
      if (!src) return r();
      const i = new Image();
      i.onload = i.onerror = () => (i.decode ? i.decode().catch(() => {}).then(r) : r());
      i.src = src;
    });
  function flash(r) {
    const f = $('wsFlash');
    f.style.setProperty('--rc', RC[r]);
    f.classList.remove('is-on', 'is-big');
    void f.offsetWidth;
    f.classList.add('is-on');
    if (r === 5) f.classList.add('is-big');
  }

  // One reveal: the rarity glow, the art (characters arrive as a white silhouette that fills with colour,
  // like the game), the name, the stars popping in one by one, and what the copy turned into.
  function revealOne(it) {
    const elc = it.el ? EL[it.el] : '';
    let tag = '';
    if (!it.before) tag = '<b class="is-new">New</b>';
    else if (it.t === 'c') tag = it.before <= 6 ? `Stella Fortuna · <b>C${it.before}</b>` : 'Every Constellation unlocked';
    else if (it.r > 3) tag = `Refinement <b>R${Math.min(5, it.before + 1)}</b>`;
    const gain = it.glit ? `<span><img src="${ICON.glit}" alt="">Masterless Starglitter ×${it.glit}</span>` : it.dust ? `<span><img src="${ICON.dust}" alt="">Masterless Stardust ×${it.dust}</span>` : '';
    reveal.innerHTML = `<div class="wr r${it.r} is-${it.t}" style="--rc:${RC[it.r]};${elc ? `--el:${elc};` : ''}">
        <i class="wr-glow"></i><i class="wr-rays"></i>
        <figure class="wr-art"><img src="${esc(it.art)}" alt=""></figure>
        <div class="wr-info">
          <div class="wr-name">${it.el ? `<img class="wr-el" src="${GI.elIcon(it.el.toLowerCase())}" alt="">` : `<span class="wr-type">${esc(it.wp)}</span>`}<h2>${esc(it.name)}</h2></div>
          <p class="wr-stars" aria-label="${it.r} stars">${'<i>★</i>'.repeat(it.r)}</p>
          ${tag ? `<p class="wr-tag">${tag}</p>` : ''}
          ${gain ? `<p class="wr-gain">${gain}</p>` : ''}
        </div>
      </div>`;
    $('wsSay').textContent = `${it.r} star ${it.t === 'c' ? 'character' : 'weapon'}: ${it.name}`;
    Sky.ambient(it.r > 3 ? it.r : 0);
    return frame2().then(() => reveal.firstElementChild && reveal.firstElementChild.classList.add('is-in'));
  }

  // The summary: the game's result screen, tall cards best first (characters before weapons), each sliding in.
  function summary(res, n) {
    const list = res.map((x, i) => ({ ...x, i })).sort((a, b) => b.r - a.r || (a.t === b.t ? a.i - b.i : a.t === 'c' ? -1 : 1));
    const glit = res.reduce((s, x) => s + (x.glit || 0), 0);
    const dust = res.reduce((s, x) => s + (x.dust || 0), 0);
    sum.innerHTML = `<div class="ws-cards${list.length === 1 ? ' is-one' : ''}">${list
      .map(
        (x, i) => `<figure class="wc r${x.r} is-${x.t}" style="--d:${i};--rc:${RC[x.r]}">
          <div class="wc-in"><img class="wc-art" src="${esc(x.card)}" alt="" decoding="async">
          ${x.el ? `<img class="wc-el" src="${GI.elIcon(x.el.toLowerCase())}" alt="">` : ''}
          ${x.before === 0 && x.r > 3 ? '<span class="wc-new">New</span>' : ''}
          <figcaption><b>${esc(x.name)}</b><span class="wc-stars">${'★'.repeat(x.r)}</span></figcaption></div>
        </figure>`
      )
      .join('')}</div>
      <p class="ws-sum-gain">${glit ? `<span><img src="${ICON.glit}" alt="">×${glit}</span>` : ''}${dust ? `<span><img src="${ICON.dust}" alt="">×${dust}</span>` : ''}<span class="ws-sum-cost"><img src="/images/genshin/primogem.webp" alt="">${fmt(n * COST)} spent</span></p>
      <div class="ws-sum-acts"><button type="button" class="gi-key" data-act="close">Close</button><button type="button" class="gi-key gi-key--red" data-act="again10">Wish ×10 again</button></div>`;
    sum.hidden = false;
    reveal.innerHTML = '';
    Sky.ambient(Math.max(...res.map((x) => x.r)) === 5 ? 4 : 0);
    $('wsSay').textContent = `Results: ${list.map((x) => x.r + ' star ' + x.name).join(', ')}`;
    requestAnimationFrame(() => sum.classList.add('is-in'));
    const btn = sum.querySelector('[data-act="again10"]');
    if (n === 1) btn.dataset.act = 'again', (btn.textContent = 'Wish ×1 again');
    btn.focus({ preventScroll: true });
  }

  function open() {
    if (!stage.open) {
      stage.showModal();
      document.documentElement.classList.add('ws-locked');
      Sky.start();
    }
  }
  function close() {
    if (run) run.waiters.splice(0).forEach((f) => f());
    run = null;
    Sky.stop();
    if (stage.open) stage.close();
    document.documentElement.classList.remove('ws-locked');
    reveal.innerHTML = sum.innerHTML = '';
    sum.hidden = endBar.hidden = true;
    renderAll();
    $(lastN === 10 ? 'wsTen' : 'wsOne').focus({ preventScroll: true });
  }
  let lastN = 1;

  async function wish(n) {
    if (!cur || !POOL) return;
    lastN = n;
    if (run) run.waiters.splice(0).forEach((f) => f());
    const res = Array.from({ length: n }, () => pull(cur));
    save();
    hud();
    const me = (run = { skip: false, waiters: [] });
    open();
    stage.className = 'ws-stage';
    sum.hidden = endBar.hidden = true;
    sum.classList.remove('is-in');
    reveal.innerHTML = '';
    hint.classList.remove('is-on');
    const best = Math.max(...res.map((x) => x.r));
    const shown = res
      .map((x, i) => ({ x, i }))
      .sort((a, b) => a.x.r - b.x.r || a.i - b.i)
      .map((o) => o.x)
      .filter((x) => !(S.opt.quick && n > 1 && x.r === 3));
    const ready = Promise.all(shown.map((x) => preload(x.art)).concat(res.map((x) => preload(x.card))));
    if (S.opt.instant) {
      await Promise.race([ready, wait(1200)]);
      if (run === me) summary(res, n);
      return;
    }
    stage.classList.add('is-sky');
    if (!still()) {
      await wait(260);
      if (me.skip || run !== me) return;
      await Promise.race([Sky.fall(best, res), new Promise((r) => me.waiters.push(r))]);
      if (me.skip || run !== me) return;
      flash(best);
      await wait(best === 5 ? 520 : 300);
    }
    await Promise.race([ready, wait(1500)]);
    if (me.skip || run !== me) return;
    stage.classList.remove('is-sky');
    stage.classList.add('is-reveal');
    Sky.calm();
    for (const x of shown) {
      await revealOne(x);
      if (me.skip || run !== me) return;
      setTimeout(() => run === me && hint.classList.add('is-on'), 1400);
      await tap(x.r === 5 ? 900 : x.r === 4 ? 600 : 250);
      hint.classList.remove('is-on');
      if (me.skip || run !== me) return;
    }
    if (n > 1) {
      stage.classList.remove('is-reveal');
      summary(res, n);
    } else {
      // One wish: stay on its reveal, with Close / Wish again.
      endBar.hidden = false;
      endBar.querySelector('[data-act="again"]').focus({ preventScroll: true });
    }
  }
  function skipNow() {
    if (!run) return;
    const me = run;
    me.skip = true;
    me.waiters.splice(0).forEach((f) => f());
    stage.classList.remove('is-sky', 'is-reveal');
    hint.classList.remove('is-on');
    // Rebuild the results this show was for from the log's last entries.
    const res = S.log.slice(-lastN).map((l) => ({ ...item(l[2], l[6]), pity: l[4], how: l[5] }));
    // `before` / gains aren't in the log; derive them from the copies now owned.
    const seen = {};
    for (let i = res.length - 1; i >= 0; i--) {
      const x = res[i];
      seen[x.name] = (seen[x.name] || 0) + 1;
      x.before = (S.own[x.name] || 0) - seen[x.name];
      if (x.t === 'w') x.r === 3 ? (x.dust = 15) : (x.glit = x.r === 5 ? 10 : 2);
      else if (x.before) x.glit = x.before <= 6 ? (x.r === 5 ? 10 : 2) : x.r === 5 ? 25 : 5;
    }
    run = { skip: false, waiters: [] };
    summary(res, lastN);
  }
  $('wsSkip').addEventListener('click', skipNow);
  stage.addEventListener('cancel', (e) => {
    e.preventDefault();
    if (stage.classList.contains('is-sky') || stage.classList.contains('is-reveal')) {
      if (!endBar.hidden) close();
      else skipNow();
    } else close();
  });
  stage.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    e.stopPropagation();
    if (b.dataset.act === 'close') close();
    else wish(b.dataset.act === 'again10' ? 10 : 1);
  });
  addEventListener('resize', () => stage.open && Sky.size());
  $('wsOne').addEventListener('click', () => wish(1));
  $('wsTen').addEventListener('click', () => wish(10));
  $('wsTabs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-code]');
    if (t && t.dataset.code !== cur.code) show(t.dataset.code);
  });

  // Options + start over (two taps, the second within 4 s).
  const opt = (id, k) => {
    const b = $(id);
    const paint = () => b.setAttribute('aria-pressed', !!S.opt[k]);
    b.addEventListener('click', () => {
      S.opt[k] = !S.opt[k];
      save();
      paint();
    });
    paint();
  };
  opt('wsQuick', 'quick');
  opt('wsInstant', 'instant');
  let armed = 0;
  $('wsReset').addEventListener('click', () => {
    const b = $('wsReset');
    if (Date.now() - armed > 4000) {
      armed = Date.now();
      b.textContent = 'Tap again to erase everything';
      b.classList.add('is-armed');
      setTimeout(() => {
        if (Date.now() - armed >= 4000) (b.textContent = 'Start over'), b.classList.remove('is-armed');
      }, 4100);
      return;
    }
    armed = 0;
    const o = S.opt;
    S = fresh();
    S.opt = o;
    if (cur) BANNERS = build(FEED || { banners: [] });
    save();
    b.textContent = 'Start over';
    b.classList.remove('is-armed');
    renderAll();
    if (cur) show(cur.code);
  });

  // ---- HAUL ----
  let haulK = '';
  let ownT = 'c';
  const kOf = (code) => KIND[code] || 'char';
  function stats() {
    const ks = haulK ? [haulK] : ['char', 'weapon', 'std'];
    const T = blankTot();
    for (const k of ks) for (const f in T) T[f] += S.tot[k][f];
    const avg = T.five ? (T.p5sum / T.five).toFixed(1) : '–';
    const model = haulK ? AVG[haulK].toFixed(1) : null;
    const cell = (label, big, small, icon) => `<div class="ws-stat">${icon ? `<img src="${icon}" alt="">` : ''}<span class="gi-label">${label}</span><b>${big}</b><small>${small}</small></div>`;
    $('wsStats').innerHTML =
      cell('Wishes', fmt(T.n), `${fmt(T.n * COST)} Primogems`, '/images/genshin/primogem.webp') +
      cell('5★', fmt(T.five), T.n ? `1 in ${(T.n / Math.max(1, T.five)).toFixed(0)} wishes` : 'None yet') +
      cell('4★', fmt(T.four), T.n ? `${((T.four / T.n) * 100).toFixed(1)}% of wishes` : 'None yet') +
      cell('Average 5★ pity', avg, model ? `Model: ${model}` : `Model: ${AVG.char.toFixed(1)}, weapon ${AVG.weapon.toFixed(1)}`) +
      cell('50/50', `${T.won}<i>–</i>${T.lost}`, T.rad ? `Won – lost · ${T.rad} by Radiance` : 'Won – lost') +
      cell('Starglitter', fmt(T.glit), `${fmt(T.dust)} Stardust`, ICON.glit);
    // Every 5-star: a bar as tall as its pity, its face, how it went.
    const HOW = { win: ['Won 50/50', 'W'], lose: ['Lost 50/50', 'L'], guar: ['Guaranteed', 'G'], rad: ['Capturing Radiance', 'R'], path: ['Epitomized Path', 'P'] };
    const fives = S.log.filter((l) => l[3] === 5 && (!haulK || kOf(l[1]) === haulK)).slice(-80);
    $('wsRoad').innerHTML = fives.length
      ? fives
          .map((l) => {
            const it = item(l[2], l[6]);
            const hard = HARD[kOf(l[1])];
            const h = HOW[l[5]];
            return `<div class="ws-rd${l[4] >= 74 || (kOf(l[1]) === 'weapon' && l[4] >= 63) ? ' is-soft' : ''}" title="${esc(it.name)}: wish ${l[4]}${h ? ', ' + h[0] : ''}">
              <b>${l[4]}</b><i class="ws-rd-bar" style="--h:${Math.max(4, (l[4] / hard) * 100).toFixed(1)}"></i>
              <span class="gi-tile r5"><img src="${esc(it.face)}" alt="${esc(it.name)}" loading="lazy"></span>${h ? `<small class="is-${l[5]}">${h[1]}</small>` : '<small></small>'}</div>`;
          })
          .join('')
      : `<p class="ws-empty">No 5★ yet. ${haulK ? `On average one lands on wish ${AVG[haulK].toFixed(0)} here.` : `On average one lands on wish ${AVG.char.toFixed(0)} (${AVG.weapon.toFixed(0)} on the weapon wish).`}</p>`;
    $('wsRoadKey').innerHTML = fives.length ? '<span><i class="is-win"></i>W won</span><span><i class="is-lose"></i>L lost</span><span><i class="is-guar"></i>G guaranteed</span><span><i class="is-rad"></i>R Radiance</span>' : '';
    const road = $('wsRoad');
    road.scrollLeft = road.scrollWidth;
    // Collection: every item owned, best first, with its Constellation / Refinement.
    const names = Object.keys(S.own).filter((n) => (ownT === 'c' ? POOL.chars[n] : POOL.weapons[n] && !POOL.chars[n]));
    const list = names.map((n) => item(n, ownT)).sort((a, b) => b.r - a.r || S.own[b.name] - S.own[a.name] || a.name.localeCompare(b.name));
    $('wsOwn').innerHTML = list.length
      ? list
          .map((it) => {
            const n = S.own[it.name];
            const lv = it.t === 'c' ? `C${Math.min(6, n - 1)}` : it.r === 3 ? `×${n}` : `R${Math.min(5, n)}`;
            const over = it.t === 'c' ? n - 7 : it.r === 3 ? 0 : n - 5;
            return `<div class="ws-it" title="${esc(it.name)}: ${n} cop${n === 1 ? 'y' : 'ies'}">${GI.tile(it.face, it.r, it.name)}<b>${lv}${over > 0 ? `<small>+${over}</small>` : ''}</b><span>${esc(it.name)}</span></div>`;
          })
          .join('')
      : `<p class="ws-empty">Nothing here yet. Make a wish.</p>`;
  }
  const tray = (el, attr, get, set) => {
    const paint = () =>
      el.querySelectorAll(`[data-${attr}]`).forEach((b) => {
        const on = b.dataset[attr] === get();
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on);
      });
    el.addEventListener('click', (e) => {
      const b = e.target.closest(`[data-${attr}]`);
      if (!b) return;
      set(b.dataset[attr]);
      paint();
    });
    paint();
    return paint;
  };

  // ---- HISTORY: the game's own table, 10 a page. Pity = the wish count that item took (4 and 5-stars). ----
  let histK = 'char';
  let page = 0;
  const ago = (t) => {
    const d = new Date(t * 1000);
    return `${d.getFullYear()}-${GI.pad(d.getMonth() + 1)}-${GI.pad(d.getDate())} ${GI.pad(d.getHours())}:${GI.pad(d.getMinutes())}:${GI.pad(d.getSeconds())}`;
  };
  function history() {
    const rows = S.log.filter((l) => kOf(l[1]) === histK);
    const pages = Math.max(1, Math.ceil(rows.length / 10));
    page = Math.min(page, pages - 1);
    const slice = rows.slice().reverse().slice(page * 10, page * 10 + 10);
    $('wsHistBody').innerHTML = slice.length
      ? slice
          .map(
            (l) =>
              `<tr class="r${l[3]}"><td>${l[6] === 'c' ? 'Character' : 'Weapon'}</td><td><b>${esc(l[2])}</b>${l[3] > 3 ? ` <small>(${l[3]}★)</small>` : ''}</td><td>${l[1] === 'c2' ? 'Character Event Wish-2' : TYPE[kOf(l[1])]}</td><td>${l[3] > 3 ? l[4] : ''}</td><td>${ago(l[0])}</td></tr>`
          )
          .join('')
      : `<tr><td colspan="5" class="ws-empty">No wishes on this type yet.</td></tr>`;
    $('wsPage').textContent = `${page + 1} / ${pages}`;
    $('wsPrev').disabled = page === 0;
    $('wsNext').disabled = page >= pages - 1;
  }
  $('wsPrev').addEventListener('click', () => (page--, history()));
  $('wsNext').addEventListener('click', () => (page++, history()));

  // ---- ODDS: a card per wish type with its chance-per-wish drawn as bars (soft pity shaded). ----
  function odds() {
    const card = (k, title, lines) => {
      const N = k === 'weapon' ? 80 : 90;
      const W = 2;
      const bars = Array.from({ length: N }, (_, i) => {
        const p = P5[k](i + 1);
        const hgt = Math.max(1.5, p * 56);
        return `<rect x="${i * W}" y="${60 - hgt}" width="${W - 0.5}" height="${hgt}"${p > 0.01 ? ' class="is-up"' : ''}/>`;
      }).join('');
      return `<article class="gi-box ws-odd"><h3>${title}</h3>
        <svg viewBox="0 0 ${N * W} 62" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>
        <p class="ws-odd-axis"><span>Wish 1</span><span>${k === 'weapon' ? 'Soft pity 63' : 'Soft pity 74'}</span><span>${N}</span></p>
        <ul>${lines.map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join('')}</ul></article>`;
    };
    $('wsOdds').innerHTML =
      card('char', 'Character Event Wish', [
        ['5★ base / average', '0.6% / 1.6%'],
        ['Hard pity', '90'],
        ['Featured 5★', '50/50, ~55% with Radiance'],
        ['After a loss', 'Next 5★ featured'],
        ['4★ (featured 50%)', '5.1%, one every 10'],
      ]) +
      card('weapon', 'Weapon Event Wish', [
        ['5★ base / average', '0.7% / 1.85%'],
        ['Hard pity', '80 (model: 77)'],
        ['Featured 5★', '75%, either weapon'],
        ['Epitomized Path', '1 Fate Point = your pick'],
        ['4★ (featured 75%)', '6%, one every 10'],
      ]) +
      card('std', 'Standard Wish', [
        ['5★ base / average', '0.6% / 1.6%'],
        ['Hard pity', '90'],
        ['5★ pool', `${POOL.pool['5c'].length} characters, ${POOL.pool['5w'].length} weapons`],
        ['4★ pool', `${POOL.pool['4c'].length} characters, ${POOL.pool['4w'].length} weapons`],
        ['Costs', 'Acquaint Fate'],
      ]);
  }

  function renderAll() {
    if (!POOL) return;
    stats();
    history();
    if (cur) hud();
  }

  // ---- START ----
  let FEED = null;
  const poolReq = fetch('/genshin-wishpool.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))));
  Promise.all([poolReq, GI.feed.catch(() => null)])
    .then(([pool, feed]) => {
      POOL = pool;
      FEED = feed;
      FACE = Object.fromEntries(((feed && feed.characters) || []).map((c) => [c.name, c.icon]));
      BANNERS = build(feed || { banners: [] });
      tabs();
      let first = '';
      try {
        first = localStorage.getItem('gi-wish-tab') || '';
      } catch (e) {}
      show(BANNERS.some((b) => b.code === first) ? first : BANNERS[0].code);
      $('wsOne').disabled = $('wsTen').disabled = false;
      tray($('wsHaulTabs'), 'k', () => haulK, (v) => ((haulK = v), stats()));
      tray($('wsOwnTabs'), 't', () => ownT, (v) => ((ownT = v), stats()));
      tray($('wsHistTabs'), 'k', () => histK, (v) => ((histK = v), (page = 0), history()));
      odds();
      renderAll();
      setInterval(countdowns, 1000);
      GI.stars(banner);
    })
    .catch((err) => {
      console.error('wish simulator data failed to load:', err);
      $('wsHud').innerHTML = '<p class="gi-empty">Couldn’t load the wishes right now. Try again in a bit.</p>';
    });

})();
