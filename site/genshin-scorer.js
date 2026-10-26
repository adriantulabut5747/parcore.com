// Genshin Impact -- Artifact scorer (/genshin-impact/artifact-scorer, Oct 26 2026). Type in a 5★ artifact
// (slot, main stat, level, four substats) and get its numbers: crit value, roll value for the stats you
// pick, how many rolls each substat got (worked out from the game's roll tiers), and what the remaining
// upgrades can still do. The piece is drawn as the in-game card with a pip per roll. Never a verdict:
// "good" depends on the character, so the page only shows numbers.
// Game numbers: the Genshin Impact Wiki's Artifact/Stats, Artifact/Scaling and Artifact/Distribution
// pages (checked Oct 26 2026). Set names + art: genshin-artifacts.json. State lives in the address (?a= …).
// Styles: genshin-scorer.css.
(function () {
  const { $, esc } = window.GI;

  // ---- GAME NUMBERS (5★) ----
  // Substats: the four roll tiers (70 / 80 / 90 / 100% of the max roll) and the weight that decides
  // which substat appears.
  const SUB = {
    hp: { n: 'HP', t: [209.13, 239.0, 268.88, 298.75], w: 6, flat: 1 },
    atk: { n: 'ATK', t: [13.62, 15.56, 17.51, 19.45], w: 6, flat: 1 },
    def: { n: 'DEF', t: [16.2, 18.52, 20.83, 23.15], w: 6, flat: 1 },
    hpp: { n: 'HP%', t: [4.08, 4.66, 5.25, 5.83], w: 4 },
    atkp: { n: 'ATK%', t: [4.08, 4.66, 5.25, 5.83], w: 4 },
    defp: { n: 'DEF%', t: [5.1, 5.83, 6.56, 7.29], w: 4 },
    er: { n: 'Energy Recharge', s: 'ER', t: [4.53, 5.18, 5.83, 6.48], w: 4 },
    em: { n: 'Elemental Mastery', s: 'EM', t: [16.32, 18.65, 20.98, 23.31], w: 4, flat: 1 },
    cr: { n: 'CRIT Rate', t: [2.72, 3.11, 3.5, 3.89], w: 3 },
    cd: { n: 'CRIT DMG', t: [5.44, 6.22, 6.99, 7.77], w: 3 },
  };
  const SUB_KEYS = Object.keys(SUB);
  // Main stat at +0 .. +20 (wiki Artifact/Scaling). Several stats share a curve.
  const CURVE = {
    hp: [717, 920, 1123, 1326, 1530, 1733, 1936, 2139, 2342, 2545, 2749, 2952, 3155, 3358, 3561, 3764, 3967, 4171, 4374, 4577, 4780],
    atk: [47, 60, 73, 86, 100, 113, 126, 139, 152, 166, 179, 192, 205, 219, 232, 245, 258, 272, 285, 298, 311],
    p7: [7.0, 9.0, 11.0, 12.9, 14.9, 16.9, 18.9, 20.9, 22.8, 24.8, 26.8, 28.8, 30.8, 32.8, 34.7, 36.7, 38.7, 40.7, 42.7, 44.6, 46.6],
    p87: [8.7, 11.2, 13.7, 16.2, 18.6, 21.1, 23.6, 26.1, 28.6, 31.0, 33.5, 36.0, 38.5, 40.9, 43.4, 45.9, 48.4, 50.8, 53.3, 55.8, 58.3],
    em: [28.0, 35.9, 43.8, 51.8, 59.7, 67.6, 75.5, 83.5, 91.4, 99.3, 107.2, 115.2, 123.1, 131.0, 138.9, 146.9, 154.8, 162.7, 170.6, 178.6, 186.5],
    er: [7.8, 10.0, 12.2, 14.4, 16.6, 18.8, 21.0, 23.2, 25.4, 27.6, 29.8, 32.0, 34.2, 36.4, 38.6, 40.8, 43.0, 45.2, 47.4, 49.6, 51.8],
    cr: [4.7, 6.0, 7.3, 8.6, 9.9, 11.3, 12.6, 13.9, 15.2, 16.6, 17.9, 19.2, 20.5, 21.8, 23.2, 24.5, 25.8, 27.1, 28.4, 29.8, 31.1],
    cd: [9.3, 12.0, 14.6, 17.3, 19.9, 22.5, 25.2, 27.8, 30.5, 33.1, 35.7, 38.4, 41.0, 43.7, 46.3, 49.0, 51.6, 54.2, 56.9, 59.5, 62.2],
    heal: [5.4, 6.9, 8.4, 10.0, 11.5, 13.0, 14.5, 16.1, 17.6, 19.1, 20.6, 22.1, 23.7, 25.2, 26.7, 28.2, 29.8, 31.3, 32.8, 34.3, 35.9],
  };
  // Main stats: name, curve, the substat it rules out, and its drop chance per slot (wiki Artifact/Distribution).
  const MAIN = {
    hp: { n: 'HP', c: 'hp', sub: 'hp', flat: 1 },
    atk: { n: 'ATK', c: 'atk', sub: 'atk', flat: 1 },
    hpp: { n: 'HP%', c: 'p7', sub: 'hpp' },
    atkp: { n: 'ATK%', c: 'p7', sub: 'atkp' },
    defp: { n: 'DEF%', c: 'p87', sub: 'defp' },
    er: { n: 'Energy Recharge', c: 'er', sub: 'er' },
    em: { n: 'Elemental Mastery', c: 'em', sub: 'em', flat: 1 },
    cr: { n: 'CRIT Rate', c: 'cr', sub: 'cr' },
    cd: { n: 'CRIT DMG', c: 'cd', sub: 'cd' },
    heal: { n: 'Healing Bonus', c: 'heal' },
    pyro: { n: 'Pyro DMG Bonus', c: 'p7' },
    hydro: { n: 'Hydro DMG Bonus', c: 'p7' },
    electro: { n: 'Electro DMG Bonus', c: 'p7' },
    cryo: { n: 'Cryo DMG Bonus', c: 'p7' },
    dendro: { n: 'Dendro DMG Bonus', c: 'p7' },
    anemo: { n: 'Anemo DMG Bonus', c: 'p7' },
    geo: { n: 'Geo DMG Bonus', c: 'p7' },
    phys: { n: 'Physical DMG Bonus', c: 'p87' },
  };
  const SLOTS = [
    { k: 'flower', n: 'Flower of Life', s: 'Flower', main: { hp: 100 } },
    { k: 'plume', n: 'Plume of Death', s: 'Plume', main: { atk: 100 } },
    { k: 'sands', n: 'Sands of Eon', s: 'Sands', main: { hpp: 26.68, atkp: 26.66, defp: 26.66, er: 10, em: 10 } },
    { k: 'goblet', n: 'Goblet of Eonothem', s: 'Goblet', main: { hpp: 19.25, atkp: 19.25, defp: 19, pyro: 5, hydro: 5, electro: 5, cryo: 5, dendro: 5, anemo: 5, geo: 5, phys: 5, em: 2.5 } },
    { k: 'circlet', n: 'Circlet of Logos', s: 'Circlet', main: { hpp: 22, atkp: 22, defp: 22, cr: 10, cd: 10, heal: 10, em: 4 } },
  ];
  const slotOf = (k) => SLOTS.find((s) => s.k === k);
  const MAX_ROLLS = 6; // a substat's starting roll + all five upgrades
  const AVG = (k) => SUB[k].t.reduce((a, b) => a + b, 0) / 4; // an average roll (tiers are 25% each)
  const PRESETS = [
    ['Crit + ATK%', ['cr', 'cd', 'atkp']],
    ['Crit + HP%', ['cr', 'cd', 'hpp']],
    ['Crit + DEF%', ['cr', 'cd', 'defp']],
    ['Crit + EM', ['cr', 'cd', 'em']],
    ['Crit + ER', ['cr', 'cd', 'er']],
    ['EM + ER', ['em', 'er']],
    ['HP% + ER', ['hpp', 'er']],
  ];

  const fmt = (k, v, flat) => (flat ? Math.round(v).toLocaleString('en-US') : (+v).toFixed(1) + '%');
  const subFmt = (k, v) => fmt(k, v, SUB[k].flat);
  const fact = (n) => (n < 2 ? 1 : n * fact(n - 1));

  // ---- ROLLS: every way n rolls of the four tiers can add up to the shown value ----
  // The game shows % stats to one decimal and flat stats as whole numbers, so a sum matches if it
  // rounds to what's shown. ways = how many roll orders give that sum (each tier is a 25% coin).
  const combosCache = {};
  function candidates(k, v) {
    const key = k + ':' + v;
    if (combosCache[key]) return combosCache[key];
    const t = SUB[k].t;
    const tol = SUB[k].flat ? 0.5001 : 0.0501;
    const out = [];
    for (let n = 1; n <= MAX_ROLLS; n++) {
      let ways = 0;
      let best = null;
      for (let a = 0; a <= n; a++)
        for (let b = 0; a + b <= n; b++)
          for (let c = 0; a + b + c <= n; c++) {
            const d = n - a - b - c;
            const s = a * t[0] + b * t[1] + c * t[2] + d * t[3];
            if (Math.abs(s - v) <= tol) {
              const w = fact(n) / (fact(a) * fact(b) * fact(c) * fact(d));
              ways += w;
              if (!best || w > best.w) best = { w, tiers: [...Array(d).fill(3), ...Array(c).fill(2), ...Array(b).fill(1), ...Array(a).fill(0)] };
            }
          }
      if (ways) out.push({ n, ways, tiers: best.tiers });
    }
    return (combosCache[key] = out);
  }

  // Which roll counts fit together? A 5★ starts with 3 or 4 substats and gets one upgrade every 4
  // levels (5 in all): at +lv it has had (3 or 4) + floor(lv / 4) rolls, and a 3-substat piece gets its
  // 4th substat at +4. Each fitting combination is weighted by how likely the game is to produce it
  // (start: 80% three / 20% four from a domain; each upgrade picks one of the four substats; each tier 25%).
  function solve(subs, lv) {
    const u = Math.floor(lv / 4);
    const lists = subs.map((s) => candidates(s.k, s.v));
    if (lists.some((l) => !l.length)) return null;
    const starts = subs.length === 4 ? (u >= 1 ? [3, 4] : [4]) : subs.length === 3 && u === 0 ? [3] : [];
    const sols = [];
    const walk = (i, pick) => {
      if (i === lists.length) {
        const N = pick.reduce((t, c) => t + c.n, 0);
        starts.forEach((st) => {
          if (N !== st + u) return;
          const extras = pick.map((c) => c.n - 1);
          const ex = extras.reduce((a, b) => a + b, 0);
          if (ex !== (st === 4 ? u : Math.max(0, u - 1))) return;
          let w = (st === 3 ? 0.8 : 0.2) * (fact(ex) / extras.reduce((t, e) => t * fact(e), 1)) * Math.pow(0.25, ex);
          pick.forEach((c) => (w *= c.ways * Math.pow(0.25, c.n)));
          sols.push({ pick, st, w });
        });
        return;
      }
      lists[i].forEach((c) => walk(i + 1, [...pick, c]));
    };
    walk(0, []);
    if (!sols.length) return { u, sols: [], none: true };
    const total = sols.reduce((t, s) => t + s.w, 0);
    sols.forEach((s) => (s.p = s.w / total));
    sols.sort((a, b) => b.p - a.p);
    // Per substat: the chance of each roll count, over every fitting combination.
    const per = subs.map((_, i) => {
      const m = {};
      sols.forEach((s) => (m[s.pick[i].n] = (m[s.pick[i].n] || 0) + s.p));
      return Object.entries(m)
        .map(([n, p]) => ({ n: +n, p }))
        .sort((a, b) => b.p - a.p);
    });
    const start3 = sols.filter((s) => s.st === 3).reduce((t, s) => t + s.p, 0);
    return { u, sols, per, best: sols[0], start3 };
  }

  // ---- WHAT'S LEFT: the chance that k of the remaining upgrades land in the stats you want ----
  function outlook(subs, mainSub, lv, want) {
    const u = Math.floor(lv / 4);
    const R = 5 - u;
    if (!R) return null;
    const binom = (n, p) => Array.from({ length: n + 1 }, (_, k) => (fact(n) / (fact(k) * fact(n - k))) * Math.pow(p, k) * Math.pow(1 - p, n - k));
    const critKeys = ['cr', 'cd'];
    const have = subs.map((s) => s.k);
    // A 3-substat piece below +4: its first upgrade adds a 4th substat, picked by weight.
    const branches =
      subs.length === 3 && u === 0
        ? (() => {
            const pool = SUB_KEYS.filter((k) => k !== mainSub && !have.includes(k));
            const W = pool.reduce((t, k) => t + SUB[k].w, 0);
            return pool.map((k) => ({ p: SUB[k].w / W, add: k, rolls: R - 1 }));
          })()
        : [{ p: 1, add: null, rolls: R }];
    const dist = Array(R + 1).fill(0);
    let cvGain = 0;
    branches.forEach((b) => {
      const keys = b.add ? [...have, b.add] : have;
      const wanted = keys.filter((k) => want.includes(k)).length;
      const bonus = b.add && want.includes(b.add) ? 1 : 0;
      binom(b.rolls, wanted / 4).forEach((p, k) => (dist[k + bonus] += b.p * p));
      const crit = keys.filter((k) => critKeys.includes(k));
      let g = (b.rolls / 4) * crit.reduce((t, k) => t + (k === 'cr' ? 2 : 1) * AVG(k), 0);
      if (b.add && critKeys.includes(b.add)) g += (b.add === 'cr' ? 2 : 1) * AVG(b.add);
      cvGain += b.p * g;
    });
    return { R, dist, cvGain, newSub: subs.length === 3 && u === 0 };
  }

  // ---- STATE (in the address so a piece can be shared) ----
  const W_KEYS = SUB_KEYS;
  const st = { set: '', slot: 'sands', main: 'atkp', lv: 20, subs: [], want: ['cr', 'cd', 'atkp'] };
  const DEFAULT = 'sands.atkp.20.cr~10.5_cd~21_er~11_def~23';
  function parse(a, w, set) {
    const m = /^(\w+)\.(\w+)\.(\d{1,2})\.?(.*)$/.exec(a || '');
    if (!m || !slotOf(m[1]) || !(m[2] in slotOf(m[1]).main) || +m[3] > 20) return false;
    st.slot = m[1];
    st.main = m[2];
    st.lv = +m[3];
    st.subs = (m[4] || '')
      .split('_')
      .map((x) => x.split('~'))
      .filter(([k, v]) => SUB[k] && k !== MAIN[st.main].sub && /^\d{1,4}(\.\d{1,2})?$/.test(v || ''))
      .slice(0, 4)
      .map(([k, v]) => ({ k, v: +v }))
      .filter((s, i, arr) => arr.findIndex((x) => x.k === s.k) === i);
    if (w != null) st.want = w.split('.').filter((k) => W_KEYS.includes(k));
    st.set = set || '';
    return true;
  }
  const enc = () => `${st.slot}.${st.main}.${st.lv}.${st.subs.map((s) => s.k + '~' + s.v).join('_')}`;
  function save() {
    const p = new URLSearchParams();
    p.set('a', enc());
    p.set('w', st.want.join('.'));
    if (st.set) p.set('set', st.set);
    history.replaceState(null, '', location.pathname + '?' + p.toString().replace(/%7E/gi, '~') + location.hash);
    $('asCopy').dataset.copy = location.href;
  }

  // ---- RANDOM: a piece rolled with the game's real odds, at the level on the slider ----
  function pickW(obj) {
    const tot = Object.values(obj).reduce((a, b) => a + b, 0);
    let r = Math.random() * tot;
    for (const [k, w] of Object.entries(obj)) if ((r -= w) <= 0) return k;
    return Object.keys(obj)[0];
  }
  function random() {
    const slot = slotOf(st.slot);
    st.main = pickW(slot.main);
    const pool = () => Object.fromEntries(SUB_KEYS.filter((k) => k !== MAIN[st.main].sub && !subs.some((s) => s.k === k)).map((k) => [k, SUB[k].w]));
    const roll = (k) => SUB[k].t[(Math.random() * 4) | 0];
    const subs = [];
    const start = Math.random() < 0.2 ? 4 : 3;
    for (let i = 0; i < start; i++) {
      const k = pickW(pool());
      subs.push({ k, v: roll(k) });
    }
    for (let i = 0; i < Math.floor(st.lv / 4); i++) {
      if (subs.length < 4) {
        const k = pickW(pool());
        subs.push({ k, v: roll(k) });
      } else {
        const s = subs[(Math.random() * 4) | 0];
        s.v += roll(s.k);
      }
    }
    st.subs = subs.map((s) => ({ k: s.k, v: SUB[s.k].flat ? Math.round(s.v) : Math.round(s.v * 10) / 10 }));
  }

  // ---- DRAW ----
  let SETS = [];
  const setOf = () => SETS.find((s) => s.slug === st.set);
  function inputs() {
    const slot = slotOf(st.slot);
    $('asSlots').querySelectorAll('[data-slot]').forEach((b) => {
      b.classList.toggle('active', b.dataset.slot === st.slot);
      b.setAttribute('aria-selected', b.dataset.slot === st.slot);
    });
    $('asMain').innerHTML = Object.keys(slot.main)
      .map((k) => `<button type="button" class="as-chip${k === st.main ? ' is-on' : ''}" data-main="${k}" aria-pressed="${k === st.main}">${esc(MAIN[k].n)}</button>`)
      .join('');
    $('asLv').value = st.lv;
    $('asLv').style.setProperty('--p', (st.lv / 20) * 100 + '%');
    $('asLvN').textContent = '+' + st.lv;
    $('asSet').value = st.set;
    // Four substat rows: a stat menu (no main stat, no repeats) and its value.
    const rows = [0, 1, 2, 3].map((i) => st.subs[i] || { k: '', v: '' });
    $('asSubs').innerHTML = rows
      .map((s, i) => {
        const taken = rows.filter((x, j) => j !== i && x.k).map((x) => x.k);
        const opts = SUB_KEYS.filter((k) => k !== MAIN[st.main].sub && !taken.includes(k));
        return `<div class="as-sub">
          <label class="as-sel"><span class="gi-vh">Substat ${i + 1}</span><select data-i="${i}" data-f="k">
            <option value="">${i === 3 ? 'None yet' : 'Pick a stat'}</option>
            ${opts.map((k) => `<option value="${k}"${k === s.k ? ' selected' : ''}>${esc(SUB[k].n)}</option>`).join('')}
          </select></label>
          <label class="as-val"><span class="gi-vh">Value</span><input data-i="${i}" data-f="v" type="text" inputmode="decimal" autocomplete="off" placeholder="${s.k ? (SUB[s.k].flat ? '23' : '10.5') : '—'}" value="${s.v === '' ? '' : s.v}"${s.k ? '' : ' disabled'}><span>${s.k && !SUB[s.k].flat ? '%' : ''}</span></label>
        </div>`;
      })
      .join('');
    $('asWant').innerHTML = W_KEYS.map(
      (k) => `<button type="button" class="as-chip${st.want.includes(k) ? ' is-on' : ''}" data-want="${k}" aria-pressed="${st.want.includes(k)}">${esc(SUB[k].s || SUB[k].n)}</button>`
    ).join('');
    $('asPresets').innerHTML = PRESETS.map(([n, ks]) => `<button type="button" class="as-pre${ks.join() === [...st.want].sort((a, b) => W_KEYS.indexOf(a) - W_KEYS.indexOf(b)).join() ? ' is-on' : ''}" data-pre="${ks.join('.')}">${esc(n)}</button>`).join('');
  }

  function out() {
    const slot = slotOf(st.slot);
    const main = MAIN[st.main];
    const subs = st.subs.filter((s) => s.k && s.v > 0);
    const sol = subs.length ? solve(subs, st.lv) : null;
    const set = setOf();
    const piece = set && set.pieces.find((p) => p.slot === slot.n);

    // The card (in-game artifact detail look).
    const rollsOf = (i) => (sol && sol.best ? sol.best.pick[i] : candidates(subs[i].k, subs[i].v)[0]);
    $('asCard').innerHTML = `<div class="as-card-top">
        ${piece ? `<img class="as-card-art" src="${esc(piece.art)}" alt="" loading="lazy">` : ''}
        <p class="as-card-name">${esc(piece ? piece.name : slot.n)}</p>
        <p class="as-card-type">${esc(slot.n)}</p>
        <p class="as-card-mk">${esc(main.n)}</p>
        <p class="as-card-mv">${fmt(st.main, CURVE[main.c][st.lv], main.flat)}</p>
        <p class="as-card-stars" aria-label="5 stars">★★★★★</p>
      </div>
      <div class="as-card-body">
        <span class="as-card-lv">+${st.lv}</span>
        <ul class="as-card-subs">${
          subs.length
            ? subs
                .map((s, i) => {
                  const r = rollsOf(i);
                  const pips = r ? r.tiers.map((t) => `<i class="t${t}"></i>`).join('') : '';
                  return `<li class="${st.want.includes(s.k) ? 'is-want' : ''}${r ? '' : ' is-bad'}"><span>${esc(SUB[s.k].n)}+${subFmt(s.k, s.v)}</span><span class="as-pips" aria-label="${r ? r.n + ' rolls' : 'no match'}">${pips}</span></li>`;
                })
                .join('')
            : '<li class="is-empty">Add the substats on the left.</li>'
        }</ul>
        ${set ? `<p class="as-card-set">${esc(set.name)}:</p><ul class="as-card-bonus">${set.bonus.map(([n, t]) => `<li><b>${n}-Piece Set:</b> ${esc(t)}</li>`).join('')}</ul>` : ''}
      </div>`;

    // The numbers.
    const cv = subs.reduce((t, s) => t + (s.k === 'cr' ? 2 * s.v : s.k === 'cd' ? s.v : 0), 0);
    const rv = subs.filter((s) => st.want.includes(s.k)).reduce((t, s) => t + s.v / SUB[s.k].t[3], 0);
    const u = Math.floor(st.lv / 4);
    const N = sol && sol.best ? sol.best.pick.reduce((t, c) => t + c.n, 0) : null;
    const useful = sol && sol.best ? subs.reduce((t, s, i) => t + (st.want.includes(s.k) ? sol.best.pick[i].n : 0), 0) : null;
    $('asCv').textContent = cv.toFixed(1);
    const cr = subs.find((s) => s.k === 'cr');
    const cdS = subs.find((s) => s.k === 'cd');
    $('asCvNote').textContent = cv ? [cr ? `2 × ${cr.v} CRIT Rate` : '', cdS ? `${cdS.v} CRIT DMG` : ''].filter(Boolean).join(' + ') : 'No crit substats';
    $('asRv').textContent = Math.round(rv * 100) + '%';
    $('asRvNote').textContent = st.want.length ? `${rv.toFixed(1)} max rolls' worth in ${st.want.map((k) => SUB[k].s || SUB[k].n).join(', ')}` : 'Pick the stats you want below the substats';
    $('asUse').innerHTML = useful != null ? `${useful}<small>/${N}</small>` : '—';
    $('asUseNote').textContent = useful != null ? 'Rolls into the stats you want' : 'Fill in all the substats';

    // Per-substat breakdown.
    let warn = '';
    if (subs.length && subs.some((s) => !candidates(s.k, s.v).length))
      warn = 'A value doesn’t match any 5★ roll. Check it against the game (5★ only).';
    else if (subs.length === 3 && u > 0) warn = 'A 5★ always has four substats from +4 on. Add the fourth.';
    else if (subs.length && subs.length < 3) warn = 'A 5★ starts with at least three substats.';
    else if (sol && sol.none) warn = `These rolls don’t add up for a +${st.lv} piece (it should have ${3 + u} or ${4 + u}). Check the level and values.`;
    $('asWarn').textContent = warn;
    $('asWarn').hidden = !warn;
    $('asRows').innerHTML = subs
      .map((s, i) => {
        const c = candidates(s.k, s.v);
        const per = sol && sol.per ? sol.per[i] : null;
        const n = per ? per[0].n : c.length ? c[0].n : 0;
        const alt = per && per[1] && per[1].p >= 0.15 ? per[1].n : null;
        const q = n ? Math.round((s.v / (n * SUB[s.k].t[3])) * 100) : 0;
        return `<li class="${st.want.includes(s.k) ? 'is-want' : ''}">
          <span class="as-r-k">${esc(SUB[s.k].n)}</span>
          <span class="as-r-v">${subFmt(s.k, s.v)}</span>
          <span class="as-r-n"><b>${n ? (alt ? Math.min(n, alt) + ' or ' + Math.max(n, alt) : n) : '?'}</b> ${n === 1 && !alt ? 'roll' : 'rolls'}</span>
          <span class="as-r-q" title="Average roll as a share of the biggest possible roll"><i style="width:${q}%"></i><b>${q ? q + '%' : ''}</b></span>
        </li>`;
      })
      .join('');
    $('asStart').textContent =
      sol && sol.best && u >= 1 && subs.length === 4
        ? sol.start3 > 0.99
          ? 'It dropped with 3 substats and got its 4th at +4.'
          : sol.start3 < 0.01
            ? 'It dropped with all 4 substats.'
            : sol.start3 > 0.5
              ? `Most likely dropped with 3 substats (${Math.round(sol.start3 * 100)}% chance) and got its 4th at +4.`
              : `Most likely dropped with all 4 substats (${Math.round((1 - sol.start3) * 100)}% chance).`
        : '';

    // What's left to roll.
    const o = subs.length >= 3 && !warn ? outlook(subs, main.sub, st.lv, st.want) : null;
    const box = $('asLeft');
    if (!o) {
      box.innerHTML =
        st.lv === 20
          ? '<p class="as-left-done">Fully levelled: no upgrades left. Its numbers are final, unless you Reshape it with Dust of Enlightenment.</p>'
          : '<p class="as-left-done">Fill in the substats to see what the remaining upgrades can do.</p>';
      return;
    }
    const top = Math.max(...o.dist);
    const atLeast1 = 1 - o.dist[0];
    box.innerHTML = `<p class="as-left-h"><b>${o.R}</b> upgrade${o.R > 1 ? 's' : ''} left${o.newSub ? ' (the first adds a 4th substat)' : ''}</p>
      <ol class="as-dist">${o.dist
        .map(
          (p, k) => `<li><span class="as-dist-bar"><i style="height:${top ? (p / top) * 100 : 0}%"></i></span><b>${p >= 0.995 ? '100' : p < 0.005 && p > 0 ? '<1' : Math.round(p * 100)}%</b><small>${k}</small></li>`
        )
        .join('')}</ol>
      <p class="as-dist-x">Rolls into the stats you want</p>
      <ul class="as-left-facts">
        <li><b>${Math.round(atLeast1 * 100)}%</b> chance at least one more roll lands in a stat you want</li>
        <li><b>${(cv + o.cvGain).toFixed(1)}</b> crit value on average at +20 (now ${cv.toFixed(1)})</li>
      </ul>`;
  }

  function paint() {
    inputs();
    out();
    save();
  }

  // ---- EVENTS ----
  $('asSlots').addEventListener('click', (e) => {
    const b = e.target.closest('[data-slot]');
    if (!b) return;
    st.slot = b.dataset.slot;
    if (!(st.main in slotOf(st.slot).main)) st.main = Object.keys(slotOf(st.slot).main)[0];
    st.subs = st.subs.filter((s) => s.k !== MAIN[st.main].sub);
    paint();
  });
  $('asMain').addEventListener('click', (e) => {
    const b = e.target.closest('[data-main]');
    if (!b) return;
    st.main = b.dataset.main;
    st.subs = st.subs.filter((s) => s.k !== MAIN[st.main].sub);
    paint();
  });
  $('asLv').addEventListener('input', () => {
    st.lv = +$('asLv').value;
    $('asLv').style.setProperty('--p', (st.lv / 20) * 100 + '%');
    $('asLvN').textContent = '+' + st.lv;
    out();
    save();
  });
  $('asSet').addEventListener('change', () => {
    st.set = $('asSet').value;
    out();
    save();
  });
  // Substat rows: a new stat redraws the rows (menus change); typing only redraws the results.
  $('asSubs').addEventListener('change', (e) => {
    const el = e.target.closest('select[data-i]');
    if (!el) return;
    const rows = [0, 1, 2, 3].map((i) => st.subs[i] || { k: '', v: '' });
    rows[+el.dataset.i] = { k: el.value, v: el.value === rows[+el.dataset.i].k ? rows[+el.dataset.i].v : '' };
    st.subs = rows.filter((s) => s.k);
    paint();
    const next = $('asSubs').querySelector(`input[data-i="${st.subs.findIndex((s) => s.k === el.value)}"]`);
    if (next) next.focus();
  });
  $('asSubs').addEventListener('input', (e) => {
    const el = e.target.closest('input[data-i]');
    if (!el) return;
    const v = parseFloat(el.value.replace(',', '.'));
    const s = st.subs[+el.dataset.i];
    if (!s) return;
    s.v = isFinite(v) && v > 0 ? Math.min(v, 9999) : '';
    out();
    save();
  });
  $('asWant').addEventListener('click', (e) => {
    const b = e.target.closest('[data-want]');
    if (!b) return;
    const k = b.dataset.want;
    st.want = st.want.includes(k) ? st.want.filter((x) => x !== k) : [...st.want, k];
    paint();
  });
  $('asPresets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pre]');
    if (!b) return;
    st.want = b.dataset.pre.split('.');
    paint();
  });
  $('asRandom').addEventListener('click', () => {
    random();
    paint();
  });
  $('asReset').addEventListener('click', () => {
    parse(DEFAULT, 'cr.cd.atkp', '');
    paint();
  });

  // ---- STATIC: the roll table (from the numbers above) ----
  const totalW = SUB_KEYS.reduce((t, k) => t + SUB[k].w, 0);
  $('asTable').innerHTML =
    '<div class="as-tr as-th"><span>Substat</span><span>70%</span><span>80%</span><span>90%</span><span>100%</span><span>Appears</span></div>' +
    SUB_KEYS.map(
      (k) =>
        `<div class="as-tr"><span>${esc(SUB[k].n)}</span>${SUB[k].t.map((v) => `<span>${SUB[k].flat ? v.toFixed(2) : v.toFixed(2) + '%'}</span>`).join('')}<span>${Math.round((SUB[k].w / totalW) * 100)}%<small>weight ${SUB[k].w}</small></span></div>`
    ).join('');

  // ---- GO ----
  $('asSlots').innerHTML = SLOTS.map((s) => `<button type="button" class="gi-tab" data-slot="${s.k}" role="tab">${esc(s.s)}</button>`).join('');
  const p = new URLSearchParams(location.search);
  if (!parse(p.get('a'), p.get('w'), p.get('set'))) parse(DEFAULT, p.get('w') || 'cr.cd.atkp', p.get('set') || '');
  paint();
  fetch('/genshin-artifacts.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((d) => {
      SETS = (d.sets || []).filter((s) => (s.rarity || []).includes(5)).sort((a, b) => a.name.localeCompare(b.name));
      $('asSet').innerHTML = '<option value="">No set (just the numbers)</option>' + SETS.map((s) => `<option value="${esc(s.slug)}">${esc(s.name)}</option>`).join('');
      if (!setOf()) st.set = '';
      paint();
    })
    .catch(() => {});
  GI.jumpNav($('asJump'));
})();
