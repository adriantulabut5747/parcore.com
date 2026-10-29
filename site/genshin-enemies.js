// Genshin Impact -- Enemies (/genshin-impact/enemies, Oct 24 2026). Loads after genshin-core.js.
// Data: genshin-enemies.json (feed script `enemies()`: the wiki's enemy list, resistances, level tables,
// energy drops + yatta's drops / icons), genshin-enemies-more.json (lore, tips, attacks; fetched the first
// time a dossier opens) and the feed (characters for faces, endgame for "Fighting now").
// Sections: Fighting now -> the archive (grid + dossier ?e=<slug>) -> the hunt list -> the resistance board.
// "Yours" = Daily domains' gi-farm-mine (character ids). Styles: genshin-enemies.css.
// Everything from the data is third-party text, so it goes through esc().
(function () {
  const { $, esc, EL, SI, elIcon } = window.GI;
  const grid = $('enGrid');
  const dlg = $('enDlg');
  // Resistance order = the data's (feed RES_KEYS).
  const ELS = ['Pyro', 'Hydro', 'Anemo', 'Electro', 'Dendro', 'Cryo', 'Geo', 'Physical'];
  const COLOR = (e) => EL[e] || '#c9ccd2';
  const CLS = { common: 'Common', elite: 'Elite', boss: 'World boss', weekly: 'Weekly boss' };
  const CLS_RANK = { weekly: 0, boss: 1, elite: 2, common: 3 };
  // The in-game Archive's order (Living Beings > Enemies and Monsters); anything else after, A-Z.
  const FAMILIES = [
    'Elemental Lifeforms',
    'Hilichurls',
    'The Abyss',
    'Fatui',
    'Automatons',
    'Other Human Factions',
    'Mystical Beasts',
    'Enemies of Note',
  ];
  const key = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const mark = (e, w) =>
    e === 'Physical'
      ? `<svg viewBox="0 0 24 24" width="${w}" height="${w}" aria-hidden="true" fill="currentColor">${SI.phys}</svg>`
      : `<img src="${elIcon(e.toLowerCase())}" alt="" width="${w}" height="${w}">`;
  const resText = (v) => (v === 'I' ? 'Immune' : v == null ? 'n/a' : v + '%');
  const resNum = (v) => (v === 'I' ? Infinity : v == null ? 10 : v); // for sorting / comparing
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const json = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))));

  let db = { enemies: [], materials: {}, tables: {} };
  let list = [];
  let shown = [];
  let more = null; // genshin-enemies-more.json, once loaded
  let faces = {}; // character name -> feed character
  let fighting = {}; // slug -> [{mode, where, level}]
  let mine = new Set();
  try {
    mine = new Set(JSON.parse(localStorage.getItem('gi-farm-mine') || '[]').filter(Number.isInteger));
  } catch (e) {}
  const isMine = (n) => faces[n] && mine.has(faces[n].id);
  const base = (e) => (e.forms[0] && e.forms[0].states[0] ? e.forms[0].states[0][1] : ELS.map(() => 10));

  // ---- state, kept in the address ----
  const url = new URLSearchParams(location.search);
  const st = {
    cls: CLS[url.get('cls')] ? url.get('cls') : '',
    res: url.get('res') || '',
    deals: url.get('deals') || '',
    fam: url.get('fam') || '',
    sort: ['new', 'az'].includes(url.get('sort')) ? url.get('sort') : 'family',
    q: url.get('q') || '',
  };
  function save(open) {
    const p = new URLSearchParams();
    for (const k of ['cls', 'res', 'deals', 'fam', 'q']) if (st[k]) p.set(k, st[k]);
    if (st.sort !== 'family') p.set('sort', st.sort);
    if (open) p.set('e', open);
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  // ---- FILTER TRAYS ----
  function tray(el, field, values) {
    el.innerHTML =
      `<button type="button" class="gi-tab" data-v="">All</button>` +
      values.map((v) => `<button type="button" class="gi-tab" data-v="${esc(v.v)}">${v.mark || ''}${esc(v.t)}</button>`).join('');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      st[field] = b.dataset.v;
      render();
    });
  }
  function paint() {
    const on = (el, v) => el.querySelectorAll('[data-v]').forEach((b) => b.classList.toggle('active', b.dataset.v === v));
    on($('enCls'), st.cls);
    on($('enRes'), st.res);
    on($('enDeals'), st.deals);
    on($('enFam'), st.fam);
    on($('enSort'), st.sort);
    const n = (st.deals ? 1 : 0) + (st.fam ? 1 : 0);
    $('enMoreN').hidden = !n;
    $('enMoreN').textContent = n;
    $('enClear').hidden = !(st.cls || st.res || st.deals || st.fam || st.q);
  }

  // ---- TILE: the archive icon on a dark square tinted by class, notable resistances on the foot ----
  function notable(e, n) {
    const r = base(e);
    return ELS.map((el, i) => ({ el, v: r[i] }))
      .filter((x) => x.v !== 10 && x.v != null)
      .sort((a, b) => resNum(b.v) - resNum(a.v))
      .slice(0, n);
  }
  const resChip = (x) =>
    `<span class="en-rc${x.v === 'I' ? ' is-imm' : resNum(x.v) < 10 ? ' is-low' : ''}" style="--c:${COLOR(x.el)}" title="${esc(x.el)} RES ${esc(resText(x.v))}">${mark(x.el, 12)}${x.v === 'I' ? '' : esc(x.v)}</span>`;
  function tileHtml(e) {
    const chips = notable(e, 3);
    const now = fighting[e.slug];
    return `<button type="button" class="en-tile is-${e.cls}" data-e="${esc(e.slug)}" aria-label="${esc(e.name)}, ${CLS[e.cls]}">
      <span class="en-tile-art">${e.icon ? `<img src="${esc(e.icon)}" alt="" loading="lazy" decoding="async" width="160" height="160" referrerpolicy="strict-origin-when-cross-origin">` : ''}</span>
      ${e.cls !== 'common' ? `<span class="en-tile-cls">${esc(CLS[e.cls])}</span>` : ''}
      ${now ? '<i class="en-now-tag" title="In this cycle\'s Abyss or Theater">Now</i>' : e.version && e.version === db.newest ? '<i class="en-new">New</i>' : ''}
      <span class="en-tile-foot"><b>${esc(e.name)}</b>${chips.length ? `<span class="en-tile-res">${chips.map(resChip).join('')}</span>` : ''}</span>
    </button>`;
  }

  function hay(e) {
    if (!e._hay)
      e._hay = [
        e.name,
        e.family,
        e.group,
        e.faction,
        e.region,
        e.area,
        ...e.titles,
        ...e.variants,
        ...e.drops.map((k) => (db.materials[k] || {}).name),
        ...e.drops.flatMap((k) => (db.materials[k] || {}).users || []),
      ]
        .join(' ')
        .toLowerCase();
    return e._hay;
  }
  function match(e) {
    if (st.cls && e.cls !== st.cls) return false;
    if (st.fam && key(e.family) !== st.fam) return false;
    if (st.deals && !e.deals.some((d) => key(d) === st.deals)) return false;
    if (st.res) {
      const i = ELS.findIndex((x) => key(x) === st.res);
      if (i < 0 || !e.forms.some((f) => f.states.some((s) => resNum(s[1][i]) > 10))) return false;
    }
    if (
      st.q &&
      !st.q
        .toLowerCase()
        .split(/\s+/)
        .every((w) => hay(e).includes(w))
    )
      return false;
    return true;
  }
  const famRank = (f) => (FAMILIES.indexOf(f) < 0 ? 99 : FAMILIES.indexOf(f));
  function render(keep) {
    if (!keep) pages = 0; // a new filter / sort starts from the first page
    paint();
    save(dlg.open && dlg.dataset.e);
    const out = list.filter(match);
    if (st.sort === 'az') out.sort((a, b) => a.name.localeCompare(b.name));
    else if (st.sort === 'new') out.sort((a, b) => vkey(b.version) - vkey(a.version) || a.name.localeCompare(b.name));
    else
      out.sort(
        (a, b) =>
          famRank(a.family) - famRank(b.family) ||
          a.family.localeCompare(b.family) ||
          CLS_RANK[a.cls] - CLS_RANK[b.cls] ||
          a.name.localeCompare(b.name),
      );
    shown = out;
    $('enCount').textContent = out.length === list.length ? list.length + ' enemies' : out.length + ' of ' + list.length + ' enemies';
    if (!out.length) {
      grid.innerHTML =
        '<p class="gi-box gi-empty">No enemy matches that. <button type="button" class="en-clear" data-clear>Clear filters</button></p>';
      return;
    }
    // Not all 365 at once (21,000px on a phone): By family shows two rows per family + "Show all N";
    // Newest / A-Z show six rows, then "Show more". Rows = the grid's current column count.
    const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    let html = '';
    if (st.sort === 'family') {
      const fams = [...new Set(out.map((e) => e.family))];
      for (const f of fams) {
        const xs = out.filter((e) => e.family === f);
        const cap = openFam.has(f) ? xs.length : cols * 2;
        html +=
          `<h3 class="en-fam"><span>${esc(f || 'Other')}</span><small>${xs.length}</small></h3>` + xs.slice(0, cap).map(tileHtml).join('');
        if (xs.length > cap)
          html += `<button type="button" class="gi-key en-grid-more" data-fam="${esc(f)}">Show all ${xs.length} ${esc(f || 'others')}</button>`;
      }
    } else {
      const cap = cols * 6 * (pages + 1);
      html = out.slice(0, cap).map(tileHtml).join('');
      if (out.length > cap)
        html += `<button type="button" class="gi-key en-grid-more" data-page>Show more <small>${out.length - cap} left</small></button>`;
    }
    grid.innerHTML = html;
  }
  const openFam = new Set();
  let pages = 0;
  grid.addEventListener('click', (e) => {
    const f = e.target.closest('[data-fam]');
    if (f) {
      openFam.add(f.dataset.fam);
      render(true);
    }
    if (e.target.closest('[data-page]')) {
      pages++;
      render(true);
    }
  });
  // "5.5" -> 5.05, "Luna II" -> 6.02 (the wiki's names for 6.x; see the feed script's version_key).
  const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
  function vkey(v) {
    const l = /^Luna ([IVX]+)$/.exec(v || '');
    if (l) return 6 + (ROMAN[l[1]] || 0) / 100;
    const m = /^(\d+)\.(\d+)/.exec(v || '');
    return m ? +m[1] + +m[2] / 100 : 0;
  }

  // ============================================================
  // DOSSIER (?e=<slug>): the stage (archive art + facts) | resistances, level stats, energy, drops, attacks, lore
  // ============================================================
  const view = { form: 0, state: 0, level: 90 };
  function chart(vals) {
    // Columns from a zero line; the dashed line = the 10% most enemies have. Immune = a full hatched column.
    const nums = vals.filter((v) => typeof v === 'number');
    const hi = Math.max(100, ...nums);
    const lo = Math.min(0, ...nums);
    const span = hi - lo;
    const y = (v) => ((hi - v) / span) * 100; // % from the top
    const cols = vals
      .map((v, i) => {
        const el = ELS[i];
        const imm = v === 'I';
        const n = typeof v === 'number' ? v : null;
        const top = imm ? 0 : n == null ? y(0) : Math.min(y(n), y(0));
        const h = imm ? y(0) : n == null ? 0 : Math.abs(y(n) - y(0));
        return `<div class="en-col${imm ? ' is-imm' : n != null && n < 10 ? ' is-low' : n != null && n > 10 ? ' is-high' : ''}" style="--c:${COLOR(el)}">
          <span class="en-col-v">${esc(resText(v))}</span>
          <span class="en-col-track"><i style="top:${top.toFixed(2)}%;height:${Math.max(h, n === 0 ? 0 : 1.2).toFixed(2)}%"></i></span>
          <span class="en-col-k">${mark(el, 18)}<span>${el === 'Physical' ? 'Phys' : esc(el)}</span></span>
        </div>`;
      })
      .join('');
    // --zero / --ten: unitless 0-100 (share of the track from its top), so the CSS can turn them into px.
    return `<div class="en-chart" style="--zero:${y(0).toFixed(2)};--ten:${y(10).toFixed(2)}"><span class="en-chart-ten" aria-hidden="true"><b>10%</b></span><span class="en-chart-zero" aria-hidden="true"></span>${cols}</div>`;
  }
  function verdict(vals) {
    const rows = ELS.map((el, i) => ({ el, v: vals[i] })).filter((x) => x.v != null);
    const imm = rows.filter((x) => x.v === 'I');
    const nums = rows.filter((x) => typeof x.v === 'number');
    const min = Math.min(...nums.map((x) => x.v));
    const max = Math.max(...nums.map((x) => x.v));
    const name = (xs) => xs.map((x) => `<b style="color:${COLOR(x.el)}">${esc(x.el)}</b>`).join(', ');
    if (!imm.length && min === 10 && max === 10)
      return '<p class="en-verdict">No weak spot and no wall here: <b>10%</b> to everything, so bring your best team.</p>';
    const best = min < max || imm.length ? nums.filter((x) => x.v === min) : [];
    const avoid = imm.length ? imm : max > 10 ? nums.filter((x) => x.v === max) : [];
    // a wall state (Regisvines shielded: 310%+ to all): no element is "the answer"
    if (min >= 50)
      return `<p class="en-verdict"><span>Shrugs off everything in this state: <b>${esc(resText(min))}</b> at the lowest.</span>${avoid.length ? `<span>Worst: ${name(avoid)} <small>(${esc(resText(avoid[0].v))})</small></span>` : ''}</p>`;
    // most elements tied for lowest: say it the short way round
    if (best.length >= 5 && avoid.length && best.length + avoid.length === rows.length)
      return `<p class="en-verdict"><span>Anything but ${name(avoid)} works <small>(${esc(resText(min))})</small></span><span>Avoid ${name(avoid)} <small>(${esc(resText(avoid[0].v))})</small></span></p>`;
    return `<p class="en-verdict">${best.length ? `<span>Hit it with ${name(best)} <small>(${esc(resText(min))})</small></span>` : ''}${avoid.length ? `<span>Avoid ${name(avoid)} <small>(${esc(resText(avoid[0].v))})</small></span>` : ''}</p>`;
  }
  function statsHtml(f) {
    const T = db.tables || {};
    const hp = T.hp && T.hp[f.hp[1]];
    const atk = T.atk && T.atk[f.atk[1]];
    if (!hp) return '';
    const lv = view.level;
    const row = (k, label, v) =>
      `<div class="en-stat"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${SI[k]}</svg><span>${label}</span><b>${v}</b></div>`;
    return `<section class="en-sec"><h3 class="en-h">Stats by level</h3>
      <div class="en-lv">
        <label class="en-lv-in"><span>Level <b id="enLvN">${lv}</b></span><input type="range" min="1" max="100" value="${lv}" id="enLv" aria-label="Enemy level"></label>
        <div class="en-stats" id="enStats">${row('hp', 'HP', fmt(f.hp[0] * hp[lv - 1]))}${atk ? row('atk', 'ATK', fmt(f.atk[0] * atk[lv - 1])) : ''}${row('def', 'DEF', fmt(500 * (1 + 0.01 * lv)))}</div>
      </div>
      <p class="en-fine">Open-world numbers. Co-op, some quests and domains (the Spiral Abyss and the Theater too) change HP and ATK.</p></section>`;
  }
  function energyHtml(en) {
    if (!en || !en.drops || !en.drops.length) return '';
    const c = en.el ? COLOR(en.el) : '#c9ccd2';
    let tp = 0;
    let to = 0;
    const marks = en.drops
      .map((d) => {
        const [hp, p, o] = d;
        tp += p;
        to += o;
        const what = [o ? `${o} orb${o === 1 ? '' : 's'}` : '', p ? `${p} particle${p === 1 ? '' : 's'}` : ''].filter(Boolean).join(' + ');
        const dots = '<i class="o"></i>'.repeat(Math.min(o, 4)) + '<i class="p"></i>'.repeat(Math.min(p, 4));
        return `<span class="en-hp-m${hp === 0 ? ' is-end' : ''}" style="left:${100 - hp}%"><span class="en-hp-dots">${dots}</span><b>${hp === 0 ? 'Defeat' : hp + '%'}</b><small>${esc(what)}</small></span>`;
      })
      .join('');
    const total = [to ? `${to} orb${to === 1 ? '' : 's'}` : '', tp ? `${tp} particle${tp === 1 ? '' : 's'}` : '']
      .filter(Boolean)
      .join(' and ');
    return `<section class="en-sec"><h3 class="en-h">Energy drops</h3>
      <div class="en-hp" style="--c:${c}"><div class="en-hp-bar" aria-hidden="true"><span>HP 100%</span></div><div class="en-hp-ms">${marks}</div></div>
      <p class="en-fine">${en.el ? `${mark(en.el, 14)} ${esc(en.el)} energy` : 'Clear energy (no element)'}: ${esc(total)} in a full fight. Orbs give three times a particle's energy.</p></section>`;
  }
  const faceHtml = (n) => {
    const c = faces[n];
    if (!c) return '';
    return `<a class="en-face${isMine(n) ? ' is-mine' : ''}" href="/genshin-impact/characters?q=${encodeURIComponent(n)}" title="${esc(n)}"><span class="gi-tile r${c.rarity}"><img src="${esc(c.icon)}" alt="${esc(n)}" loading="lazy" width="40" height="40"></span></a>`;
  };
  function facesRow(users, cap) {
    const sorted = [...users].filter((n) => faces[n]).sort((a, b) => isMine(b) - isMine(a));
    const head = sorted.slice(0, cap).map(faceHtml).join('');
    return head + (sorted.length > cap ? `<span class="en-plus">+${sorted.length - cap}</span>` : '');
  }
  function dropsHtml(e) {
    const ms = e.drops.map((k) => [k, db.materials[k]]).filter((x) => x[1]);
    if (!ms.length) return '';
    const common = ms.filter((x) => x[1].kind === 'common');
    const boss = ms.filter((x) => x[1].kind === 'boss');
    const gems = ms.filter((x) => x[1].kind === 'gem');
    const tiers = (xs) =>
      xs
        .map(
          ([k, m]) =>
            `<span class="gi-tile r${m.rarity}" title="${esc(m.name)}"><img src="${esc(m.icon)}" alt="${esc(m.name)}" loading="lazy" width="48" height="48"></span>`,
        )
        .join('');
    const who = (m) => {
      const n = m.users.filter((x) => faces[x]).length;
      const my = m.users.filter(isMine).length;
      return `<p class="en-drop-who">${n ? `Used by <b>${n}</b> character${n === 1 ? '' : 's'}` : 'No character uses it'}${m.weapons ? ` · <b>${m.weapons}</b> weapon${m.weapons === 1 ? '' : 's'}` : ''}${my ? ` · <b class="en-my">${my} of yours</b>` : ''}</p>${n ? `<div class="en-faces">${facesRow(m.users, 14)}</div>` : ''}`;
    };
    let html = '';
    // one row per series (some enemies drop two: masks + arrowheads)
    for (const ids of [...new Set(common.map(([k, m]) => (m.series || [k]).join()))].map((s) => s.split(','))) {
      const row = common.filter(([k]) => ids.includes(k));
      html += `<div class="en-drop"><div class="en-drop-tiers">${tiers(row)}</div><div class="en-drop-txt"><span class="gi-label">Ascension material</span><b>${esc(row.map((x) => x[1].name).join(' · '))}</b>${who(row[row.length - 1][1])}</div></div>`;
    }
    for (const [k, m] of boss)
      html += `<div class="en-drop"><div class="en-drop-tiers">${tiers([[k, m]])}</div><div class="en-drop-txt"><span class="gi-label">${e.cls === 'weekly' ? 'Talent material' : 'Boss material'}</span><b>${esc(m.name)}</b>${who(m)}</div></div>`;
    if (gems.length) {
      const series = [...new Set(gems.map((x) => x[1].name.replace(/ (Sliver|Fragment|Chunk|Gemstone)$/, '')))];
      html += `<div class="en-drop en-drop--gems"><div class="en-drop-tiers">${tiers(gems.filter((x) => / Gemstone$/.test(x[1].name)))}</div><div class="en-drop-txt"><span class="gi-label">Ascension gems</span><b>${esc(series.join(' · '))}</b><p class="en-drop-who">Sliver to Gemstone, for character ascension.</p></div></div>`;
    }
    return `<section class="en-sec"><h3 class="en-h">Drops</h3>${html}<p class="en-fine">How many drop per kill depends on your world level, so it isn't listed.</p></section>`;
  }
  function moreHtml(e) {
    if (!more) return '<p class="gi-empty en-more-wait">Loading attacks and lore&hellip;</p>';
    const m = more[e.slug] || {};
    let html = '';
    if (m.tips && m.tips.length)
      html += `<section class="en-sec"><h3 class="en-h">In-game tip</h3>${m.tips.map((t) => `<p class="en-tip">${esc(t)}</p>`).join('')}</section>`;
    if (m.attacks && m.attacks.length) {
      const items = m.attacks
        .map((a, i) => `<li${i >= 5 ? ' class="is-extra"' : ''}><b>${esc(a[0])}</b>${a[1] ? `<p>${esc(a[1])}</p>` : ''}</li>`)
        .join('');
      html += `<section class="en-sec"><h3 class="en-h">Attacks <small>${m.attacks.length}</small></h3><ul class="en-atk">${items}</ul>${m.attacks.length > 5 ? `<button type="button" class="en-clear en-atk-all" data-atk>Show all ${m.attacks.length}</button>` : ''}<p class="en-fine">Most attack names are the wiki's, not the game's.</p></section>`;
    }
    if (m.lore && m.lore.length)
      html += `<section class="en-sec"><h3 class="en-h">From the archive</h3><blockquote class="en-lore">${m.lore.map((p) => `<p>${esc(p)}</p>`).join('')}</blockquote></section>`;
    return html;
  }

  function inspect(e) {
    const idx = shown.indexOf(e);
    dlg.className = 'en-dlg is-' + e.cls;
    dlg.dataset.e = e.slug;
    $('enDPos').textContent = CLS[e.cls] + (idx >= 0 ? ' · ' + (idx + 1) + ' of ' + shown.length : '');
    $('enDPrev').disabled = $('enDNext').disabled = idx < 0 || shown.length < 2;
    view.form = Math.min(view.form, e.forms.length - 1);
    if (view.form < 0) view.form = 0;
    const f = e.forms[view.form];
    view.state = f ? Math.min(view.state, f.states.length - 1) : 0;
    const where = [e.sub, e.area, e.region].filter(Boolean).join(' · ');
    const now = fighting[e.slug];
    const facts = [
      ['Family', e.family + (e.group && e.group !== e.family ? ' · ' + e.group : '')],
      e.faction ? ['Faction', e.faction] : null,
      where ? ['Found at', where] : null,
      e.deals.length
        ? ['Hits with', e.deals.map((d) => `<span class="en-deal" style="color:${COLOR(d)}">${mark(d, 14)}${esc(d)}</span>`).join(''), true]
        : null,
      ['Weak point', e.weak ? 'Yes' : 'No'],
      e.version ? ['Added in', e.version] : null,
    ].filter(Boolean);
    const forms =
      e.forms.length > 1
        ? `<div class="gi-tray gi-tray--sm en-forms" role="group" aria-label="Form">${e.forms.map((x, i) => `<button type="button" class="gi-tab${i === view.form ? ' active' : ''}" data-form="${i}">${esc(x.name || 'Form ' + (i + 1))}</button>`).join('')}</div>`
        : '';
    const states =
      f && f.states.length > 1
        ? `<div class="gi-tray gi-tray--sm en-states" role="group" aria-label="State">${f.states.map((s, i) => `<button type="button" class="gi-tab${i === view.state ? ' active' : ''}" data-state="${i}">${esc(s[0] || 'State ' + (i + 1))}</button>`).join('')}</div>`
        : '';
    const vals = f && f.states[view.state] ? f.states[view.state][1] : ELS.map(() => 10);
    $('enIn').innerHTML = `
      <div class="en-stage"><div class="en-stage-in">
        <div class="en-stage-art">${e.icon ? `<img class="en-art-icon" src="${esc(e.icon)}" alt="" width="160" height="160">` : ''}</div>
        <div class="en-stage-name">
          <span class="en-cls-tag is-${e.cls}">${esc(CLS[e.cls])}</span>
          <h2 class="en-name" id="enDName">${esc(e.name)}</h2>
          ${e.titles.length || (more && more[e.slug] && more[e.slug].special) ? `<p class="en-title">${esc(e.titles.length ? e.titles.join(' · ') : more[e.slug].special)}</p>` : ''}
        </div>
        <dl class="en-facts">${facts.map((x) => `<div><dt>${x[0]}</dt><dd>${x[2] ? x[1] : esc(x[1])}</dd></div>`).join('')}</dl>
        ${e.abilities.length ? `<ul class="en-abil">${e.abilities.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      </div></div>
      <div class="en-info">
        ${now ? `<a class="en-now-box" href="/genshin-impact/all-events#abyss"><b>Fighting now</b><span>${now.map((x) => esc(x.mode + (x.where ? ' ' + x.where : '') + (x.level ? ', Lv. ' + x.level : ''))).join(' · ')}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>` : ''}
        ${forms}
        <section class="en-sec en-sec--first"><h3 class="en-h">Resistances</h3>${states}${chart(vals)}${verdict(vals)}</section>
        ${f ? statsHtml(f) : ''}
        ${energyHtml(e.energy)}
        ${dropsHtml(e)}
        <div id="enMore">${moreHtml(e)}</div>
        ${e.variants.length ? `<section class="en-sec"><h3 class="en-h">Variants</h3><ul class="en-abil">${e.variants.map((v) => `<li>${esc(v)}</li>`).join('')}</ul></section>` : ''}
      </div>`;
    // The wiki's archive art (hotlinked): swaps in over the icon once it has loaded; a miss keeps the icon.
    if (e.art) {
      const img = new Image();
      img.alt = '';
      img.className = 'en-art';
      img.decoding = 'async';
      img.onload = () => {
        const host = $('enIn').querySelector('.en-stage-art');
        if (host && dlg.dataset.e === e.slug) {
          host.prepend(img);
          host.classList.add('has-art');
        }
      };
      img.src = e.art;
    }
  }
  function setLevel(lv) {
    view.level = lv;
    const e = list.find((x) => x.slug === dlg.dataset.e);
    const f = e && e.forms[view.form];
    if (!f) return;
    const T = db.tables;
    const vals = [
      fmt(f.hp[0] * T.hp[f.hp[1]][lv - 1]),
      T.atk[f.atk[1]] ? fmt(f.atk[0] * T.atk[f.atk[1]][lv - 1]) : null,
      fmt(500 * (1 + 0.01 * lv)),
    ].filter((x) => x != null);
    $('enLvN').textContent = lv;
    $('enStats')
      .querySelectorAll('b')
      .forEach((b, i) => (b.textContent = vals[i]));
  }

  function open(slug) {
    const e = list.find((x) => x.slug === slug);
    if (!e) return;
    if (dlg.dataset.e !== slug) view.form = view.state = 0;
    inspect(e);
    dlg.classList.remove('is-closing');
    if (!dlg.open) {
      dlg.showModal();
      $('enDBody').focus({ preventScroll: true });
    }
    $('enDBody').scrollTop = 0;
    save(slug);
    if (!more)
      loadMore().then(() => {
        if (dlg.open && dlg.dataset.e === slug) inspect(e);
      });
  }
  let morePromise = null;
  const loadMore = () =>
    (morePromise =
      morePromise ||
      json('/genshin-enemies-more.json')
        .then((m) => (more = m))
        .catch(() => {
          more = {};
        }));
  function close() {
    if (!dlg.open || dlg.classList.contains('is-closing')) return;
    const done = () => {
      dlg.close();
      dlg.classList.remove('is-closing');
      delete dlg.dataset.e;
      save();
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
    dlg.classList.add('is-closing');
    setTimeout(done, 200);
  }
  // Phones: the sheet's grip / header drag down to close, like the Weapons sheet.
  window.GI.sheetDrag($('enPanel'), [$('enGrip'), $('enDBar')], $('enDBody'), close);

  function step(d) {
    const i = shown.findIndex((x) => x.slug === dlg.dataset.e);
    if (i < 0 || shown.length < 2) return;
    open(shown[(i + d + shown.length) % shown.length].slug);
  }

  // ============================================================
  // FIGHTING NOW: this cycle's Spiral Abyss (floors 9-12) + Imaginarium Theater, from the feed's endgame
  // ============================================================
  function findEnemy(name) {
    const by = (n) => list.find((e) => e.name === n) || list.find((e) => e.variants.includes(n));
    return (
      by(name) || by(name.replace(/\s+-\s+.*$/, '')) || by(name.replace(/^(Battle-Hardened|Abyss-Corroded|Sky-Searing|Radiant)\s+/, ''))
    );
  }
  function buildNow(feed) {
    const eg = feed.endgame || {};
    const seen = new Map();
    const add = (name, mode, where, level) => {
      const e = findEnemy(name);
      const k = e ? e.slug : name;
      if (!seen.has(k)) seen.set(k, { e, name, icon: (eg.icons || {})[name] || '', hits: [] });
      seen.get(k).hits.push({ mode, where, level });
    };
    const ab = eg.abyss || {};
    (ab.floors || []).forEach((fl) =>
      fl.chambers.forEach((c, ci) =>
        c.halves.forEach((h) => h.forEach((w) => w.forEach((x) => add(x.name, 'Abyss', fl.floor + '-' + (ci + 1), c.level)))),
      ),
    );
    ((eg.theater || {}).enemies || []).forEach((x) => add(x.name, 'Theater', '', x.level));
    const rows = [...seen.values()];
    rows.forEach((r) => {
      if (!r.e) return;
      // one line per mode: the highest floor / level it shows up at
      const byMode = {};
      r.hits.forEach((h) => {
        const cur = byMode[h.mode];
        if (!cur || h.level > cur.level) byMode[h.mode] = h;
      });
      fighting[r.e.slug] = Object.values(byMode);
    });
    if (!rows.length) {
      $('now').hidden = true;
      return;
    }
    const top = (r) => Math.max(...r.hits.map((h) => h.level || 0));
    rows.sort((a, b) => top(b) - top(a));
    const card = (r) => {
      const e = r.e;
      const where = Object.values(
        r.hits.reduce((o, h) => {
          if (!o[h.mode] || h.level > o[h.mode].level) o[h.mode] = h;
          return o;
        }, {}),
      )
        .map((h) => `<span>${h.mode === 'Abyss' ? 'Abyss ' + esc(h.where) : 'Theater'}<b>Lv. ${h.level}</b></span>`)
        .join('');
      const chips = e ? notable(e, 4) : [];
      const pic = e && e.icon ? e.icon : r.icon;
      const inner = `<span class="en-nc-art">${pic ? `<img src="${esc(pic)}" alt="" loading="lazy" width="72" height="72">` : ''}</span>
        <span class="en-nc-txt"><b>${esc(e ? e.name : r.name)}</b><span class="en-nc-where">${where}</span>
        <span class="en-nc-res">${e ? (chips.length ? chips.map(resChip).join('') : '<span class="en-rc is-flat">10% to all</span>') : '<span class="en-rc is-flat">Not in the archive yet</span>'}</span></span>`;
      return e
        ? `<button type="button" class="en-nc gi-box" data-e="${esc(e.slug)}">${inner}</button>`
        : `<div class="en-nc gi-box is-off">${inner}</div>`;
    };
    // Desktop shows the toughest 8 (two rows) + "Show all"; phones swipe through every card (CSS).
    const CAP = 8;
    $('enNow').innerHTML = rows.map((r, i) => card(r).replace('class="en-nc', `class="${i >= CAP ? 'is-extra ' : ''}en-nc`)).join('');
    if (rows.length > CAP)
      $('enNow').insertAdjacentHTML(
        'afterend',
        `<button type="button" class="gi-key en-now-all" id="enNowAll">Show all ${rows.length}</button>`,
      );
    const ab2 = ab.version ? `Spiral Abyss floors 9 to 12 (${esc(ab.version)})` : 'Spiral Abyss floors 9 to 12';
    const th = (eg.theater || {}).season ? ` and Imaginarium Theater season ${esc(eg.theater.season)}` : '';
    $('enNowSub').innerHTML = `${rows.length} enemies in ${ab2}${th}, toughest first. Tap one for its resistances.`;
  }

  // ============================================================
  // HUNT LIST: every drop -> who drops it -> who needs it (yours first)
  // ============================================================
  const hunt = { tab: 'common', mineOnly: false, all: false };
  function huntRows(tab) {
    const rows = [];
    const ms = db.materials;
    const dropsBy = (ids) => list.filter((e) => e.drops.some((k) => ids.includes(k)));
    if (tab === 'common') {
      const done = new Set();
      for (const [k, m] of Object.entries(ms)) {
        if (m.kind !== 'common' || done.has(k)) continue;
        const ids = (m.series || [k]).filter((x) => ms[x]);
        ids.forEach((x) => done.add(x));
        const topM = ms[ids[ids.length - 1]];
        rows.push({ ids, name: topM.name, users: topM.users, weapons: topM.weapons, by: dropsBy(ids) });
      }
    } else {
      for (const [k, m] of Object.entries(ms))
        if (m.kind === 'boss') rows.push({ ids: [k], name: m.name, users: m.users, weapons: m.weapons, by: dropsBy([k]) });
    }
    rows.forEach((r) => (r.my = r.users.filter(isMine).length));
    rows.sort((a, b) => b.my - a.my || b.users.length - a.users.length || a.name.localeCompare(b.name));
    return rows;
  }
  function huntHtml(tab, all) {
    let rows = huntRows(tab);
    if (hunt.mineOnly) rows = rows.filter((r) => r.my);
    if (!rows.length)
      return `<p class="gi-box gi-empty">${hunt.mineOnly ? 'None of your characters needs these.' : 'Nothing here yet.'}</p>`;
    const CAP = 8;
    const ms = db.materials;
    const body = (all ? rows : rows.slice(0, CAP))
      .map((r) => {
        const tiers = r.ids
          .map(
            (k) =>
              `<span class="gi-tile r${ms[k].rarity}" title="${esc(ms[k].name)}"><img src="${esc(ms[k].icon)}" alt="${esc(ms[k].name)}" loading="lazy" width="40" height="40"></span>`,
          )
          .join('');
        const by = r.by
          .slice(0, 6)
          .map(
            (e) =>
              `<button type="button" class="en-mini is-${e.cls}" data-e="${esc(e.slug)}" title="${esc(e.name)}">${e.icon ? `<img src="${esc(e.icon)}" alt="${esc(e.name)}" loading="lazy" width="36" height="36">` : esc(e.name.slice(0, 2))}</button>`,
          )
          .join('');
        const n = r.users.filter((x) => faces[x]).length;
        return `<div class="gi-box en-hr${r.my ? ' is-mine' : ''}">
          <div class="en-hr-head"><span class="en-hr-tiers">${tiers}</span><span class="en-hr-name"><b>${esc(r.name)}</b><small>${n} character${n === 1 ? '' : 's'}${r.weapons ? ' · ' + r.weapons + ' weapon' + (r.weapons === 1 ? '' : 's') : ''}${r.my ? ` · <em>${r.my} of yours</em>` : ''}</small></span></div>
          <div class="en-hr-by"><span class="gi-label">Dropped by</span><span class="en-hr-minis">${by}${r.by.length > 6 ? `<span class="en-plus">+${r.by.length - 6}</span>` : ''}</span></div>
          ${n ? `<div class="en-hr-who"><span class="gi-label">Needed by</span><span class="en-faces">${facesRow(r.users, 10)}</span></div>` : ''}
        </div>`;
      })
      .join('');
    return `<div class="en-hunt-grid">${body}</div>${rows.length > CAP ? `<button type="button" class="gi-key en-hunt-all" data-hunt-all>${all ? 'Show fewer' : `Show all ${rows.length}`}</button>` : ''}`;
  }
  // The tabs never change the section's height (Adrian's rule): the box keeps the taller tab's first-page height.
  function renderHunt() {
    const box = $('enHunt');
    document.querySelectorAll('#enHuntTabs [data-v]').forEach((b) => b.classList.toggle('active', b.dataset.v === hunt.tab));
    const mk = $('enHuntMine');
    mk.setAttribute('aria-pressed', hunt.mineOnly);
    mk.classList.toggle('active', hunt.mineOnly);
    if (!hunt.all) {
      box.style.minHeight = '';
      let h = 0;
      for (const t of ['common', 'boss']) {
        box.innerHTML = huntHtml(t, false);
        h = Math.max(h, box.offsetHeight);
      }
      box.style.minHeight = h + 'px';
    } else box.style.minHeight = '';
    box.innerHTML = huntHtml(hunt.tab, hunt.all);
  }

  // ============================================================
  // RESISTANCE BOARD: pick an element -> who's immune, who resists it, who takes more (base state)
  // ============================================================
  let board = 'Pyro';
  function boardHtml(el) {
    const i = ELS.indexOf(el);
    const rows = list.map((e) => ({ e, v: base(e)[i], s: (e.forms[0].states[0] || [''])[0] })).filter((x) => x.v != null && x.v !== 10);
    // the first state isn't always the plain one (Regisvines open shielded): say which it is
    const stateOf = (x) => (x.s && !/^(base|normal)$/i.test(x.s) ? `<small>${esc(x.s)}</small>` : '');
    const lanes = [
      ['Immune', 'Its damage does nothing', rows.filter((x) => x.v === 'I')],
      ['Resists', 'Above the usual 10%', rows.filter((x) => typeof x.v === 'number' && x.v > 10).sort((a, b) => b.v - a.v)],
      ['Takes more', 'Below 10%', rows.filter((x) => typeof x.v === 'number' && x.v < 10).sort((a, b) => a.v - b.v)],
    ];
    const CAP = 18;
    return lanes
      .map(([t, sub, xs], li) => {
        const items = xs
          .map(
            (x, k) =>
              `<button type="button" class="en-bc${k >= CAP ? ' is-extra' : ''}" data-e="${esc(x.e.slug)}"><span class="en-bc-art">${x.e.icon ? `<img src="${esc(x.e.icon)}" alt="" loading="lazy" width="32" height="32">` : ''}</span><span class="en-bc-n">${esc(x.e.name)}</span><span class="en-bc-v"><b>${esc(resText(x.v))}</b>${stateOf(x)}</span></button>`,
          )
          .join('');
        return `<div class="en-lane en-lane--${li}"><header><b>${t}</b><span>${sub}</span><em>${xs.length}</em></header><div class="en-lane-list">${items || '<p class="en-lane-none">Nobody.</p>'}</div>${xs.length > CAP ? `<button type="button" class="en-clear en-lane-all" data-lane>Show all ${xs.length}</button>` : ''}</div>`;
      })
      .join('');
  }
  function renderBoard() {
    const box = $('enBoard');
    document.querySelectorAll('#enBoardTabs [data-v]').forEach((b) => b.classList.toggle('active', b.dataset.v === board));
    box.style.minHeight = '';
    let h = 0;
    for (const el of ELS) {
      box.innerHTML = boardHtml(el);
      h = Math.max(h, box.offsetHeight);
    }
    box.style.minHeight = h + 'px';
    box.innerHTML = boardHtml(board);
    box.style.setProperty('--c', COLOR(board));
  }

  // ---- events ----
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-e]');
    if (t && !dlg.contains(t)) return open(t.dataset.e);
    if (e.target.closest('[data-clear]')) clearAll();
    if (e.target.closest('#enNowAll')) {
      const on = $('enNow').classList.toggle('is-all');
      e.target.closest('#enNowAll').textContent = on ? 'Show fewer' : 'Show all ' + $('enNow').children.length;
    }
    const lane = e.target.closest('[data-lane]');
    if (lane) {
      lane.parentElement.classList.add('is-all');
      lane.remove();
    }
  });
  $('enIn').addEventListener('click', (e) => {
    const cur = list.find((x) => x.slug === dlg.dataset.e);
    const f = e.target.closest('[data-form]');
    if (f) {
      view.form = +f.dataset.form;
      view.state = 0;
      return inspect(cur);
    }
    const s = e.target.closest('[data-state]');
    if (s) {
      view.state = +s.dataset.state;
      return inspect(cur);
    }
    if (e.target.closest('[data-atk]')) {
      e.target.closest('.en-sec').classList.add('is-all');
      e.target.remove();
    }
  });
  $('enIn').addEventListener('input', (e) => {
    if (e.target.id === 'enLv') setLevel(+e.target.value);
  });
  $('enDClose').addEventListener('click', close);
  $('enDPrev').addEventListener('click', () => step(-1));
  $('enDNext').addEventListener('click', () => step(1));
  $('enDCopy').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(location.origin + location.pathname + '?e=' + dlg.dataset.e).then(
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
    if (e.target === dlg) close();
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.target.closest('input')) return;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
  const q = $('enQ');
  q.value = st.q;
  q.addEventListener('input', () => {
    st.q = q.value.trim();
    render();
  });
  function clearAll() {
    st.cls = st.res = st.deals = st.fam = st.q = '';
    q.value = '';
    render();
  }
  $('enClear').addEventListener('click', clearAll);
  $('enMoreKey').addEventListener('click', (e) => {
    const on = $('enMore').classList.toggle('is-open');
    e.currentTarget.setAttribute('aria-expanded', on);
  });
  $('enSort').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    st.sort = b.dataset.v;
    render();
  });
  $('enHuntTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    hunt.tab = b.dataset.v;
    hunt.all = false;
    renderHunt();
  });
  $('enHuntMine').addEventListener('click', () => {
    hunt.mineOnly = !hunt.mineOnly;
    renderHunt();
  });
  $('enHunt').addEventListener('click', (e) => {
    if (!e.target.closest('[data-hunt-all]')) return;
    hunt.all = !hunt.all;
    renderHunt();
  });
  $('enBoardTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    board = b.dataset.v;
    renderBoard();
  });
  // Re-measure the steady boxes when the width changes (phone URL bars fire resize on scroll: ignore height).
  let lastW = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth === lastW || !list.length) return;
    lastW = innerWidth;
    render(true);
    renderHunt();
    renderBoard();
  });

  // ---- load ----
  Promise.all([json('/genshin-enemies.json'), window.GI.feed.catch(() => ({}))])
    .then(([d, feed]) => {
      db = d;
      list = (d.enemies || []).filter((e) => e.forms && e.forms.length);
      (feed.characters || []).forEach((c) => (faces[c.name] = c));
      // Hunt list "Yours": only once picks exist.
      const hasMine = [...mine].length > 0;
      $('enHuntMine').hidden = !hasMine;
      $('enHuntPick').hidden = hasMine;

      const count = (c) => list.filter((e) => e.cls === c).length;
      tray(
        $('enCls'),
        'cls',
        Object.keys(CLS).map((c) => ({
          v: c,
          t: (c === 'boss' ? 'World bosses' : c === 'weekly' ? 'Weekly bosses' : CLS[c]) + ' ' + count(c),
        })),
      );
      tray(
        $('enRes'),
        'res',
        ELS.map((el) => ({ v: key(el), t: el === 'Physical' ? 'Phys' : el, mark: mark(el, 15) })),
      );
      const deals = ELS.filter((el) => list.some((e) => e.deals.includes(el)));
      tray(
        $('enDeals'),
        'deals',
        deals.map((el) => ({ v: key(el), t: el === 'Physical' ? 'Phys' : el, mark: mark(el, 15) })),
      );
      const fams = [...new Set(list.map((e) => e.family).filter(Boolean))].sort((a, b) => famRank(a) - famRank(b) || a.localeCompare(b));
      tray(
        $('enFam'),
        'fam',
        fams.map((f) => ({ v: key(f), t: f })),
      );

      const imm = list.filter((e) => e.forms.some((f) => f.states.some((s) => s[1].includes('I')))).length;
      $('enFacts').innerHTML = [
        `<b>${list.length}</b> enemies`,
        `<b>${count('elite')}</b> elites`,
        `<b>${count('boss')}</b> world bosses`,
        `<b>${count('weekly')}</b> weekly bosses`,
        `<b>${imm}</b> with an immunity`,
        d.newest ? `Newest: <b>${esc(d.newest)}</b>` : '',
      ]
        .filter(Boolean)
        .map((x) => `<li>${x}</li>`)
        .join('');

      // Klee's line under the header (Oct 27 2026): the count + the immunities, in her voice.
      $('enKlee').textContent = `Klee found ${list.length} enemies! ${imm} of them are immune to an element, so check before you fight.`;
      buildNow(feed);
      render();
      $('enBoardTabs').innerHTML = ELS.map(
        (el) => `<button type="button" class="gi-tab" data-v="${el}">${mark(el, 15)}${el === 'Physical' ? 'Phys' : el}</button>`,
      ).join('');
      renderBoard();
      renderHunt();
      const e = url.get('e');
      if (e) open(e);
      // Fonts change text widths: measure the steady boxes again once they're in.
      if (document.fonts) document.fonts.ready.then(() => (renderHunt(), renderBoard()));
    })
    .catch(() => {
      grid.innerHTML = '<p class="gi-box gi-empty">The enemy list didn’t load. Refresh to try again.</p>';
      $('enKlee').textContent = "Klee couldn't find the enemies. Refresh to try again!";
    });
})();
