/* VALORANT WEAPONS (/valorant/weapons, Oct 29 2026). Every number comes from /valorant-weapons.json
   (valorant-api.com = the game files, pulled daily by scripts/valorant-feed.mjs); this file only does
   the maths and the drawing. One gun's skins are fetched from valorant-api only when its panel opens
   (the full list is 3.6 MB).
   TTK: shots = ceil((100 + shields) / damage at that distance and hit zone), time = (shots - 1) gaps at
   the gun's fire rate. Shotguns get none (pellets spread).
   Address: ?type=<type>, ?m=<metres>, ?hit=head|leg, ?arm=0|25, ?vs=<id>,<id>, ?w=<id> (the panel). */
(async function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const HP = 100;
  const MAXM = 50; // the game's damage tables stop at 50 m
  const RUN = 6.75; // m/s with the knife out: a gun's run speed = this x its multiplier
  const TYPES = [
    { t: 'sidearm', name: 'Sidearms', one: 'Sidearm' },
    { t: 'smg', name: 'SMGs', one: 'SMG' },
    { t: 'shotgun', name: 'Shotguns', one: 'Shotgun' },
    { t: 'rifle', name: 'Rifles', one: 'Rifle' },
    { t: 'sniper', name: 'Snipers', one: 'Sniper' },
    { t: 'heavy', name: 'Heavy', one: 'Machine gun' },
  ];
  const typeOf = Object.fromEntries(TYPES.map((t) => [t.t, t]));
  // the in-game buy menu's four columns
  const COLS = [['Sidearms', ['sidearm']], ['SMGs + Shotguns', ['smg', 'shotgun']], ['Rifles', ['rifle']], ['Snipers + Heavy', ['sniper', 'heavy']]];
  const HITS = { head: 'Head', body: 'Body', leg: 'Legs' };
  const ARMS = { 0: 'no shields', 25: 'light shields', 50: 'heavy shields' };
  const PEN = { Low: 1, Medium: 2, High: 3 };
  // compared guns keep their colour while picked (CODM Gun Stats' set: validated for dark + colour-blind readers)
  const SLOTS = ['#3987e5', '#d95926', '#199e70'];
  const CR = '<svg class="vw-cr" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.6v6.8"/></svg>';
  const num = (v) => Number(v).toLocaleString('en');

  const data = await fetch('/valorant-weapons.json').then((r) => r.json()).catch(() => null);
  const guns = (data && data.guns) || [];
  if (!guns.length) {
    $('vwShop').innerHTML = '<p class="vw-fail">The gun list couldn\'t load right now. Try again in a moment.</p>';
    return;
  }
  const byId = Object.fromEntries(guns.map((g) => [g.id, g]));

  /* ---- the maths ---- */
  const band = (g, m) => g.ranges.find((r) => m < r.to) || g.ranges[g.ranges.length - 1];
  const rng = (r) => `${r.from}–${r.to} m`;
  // { shots, ms, d } or { no }
  function ttk(g, m, hit, arm) {
    const d = band(g, m)[hit];
    if (g.pellets > 1) return { no: 'Pellets spread', d };
    const shots = Math.ceil((HP + arm) / d - 1e-9);
    return { shots, ms: Math.round(((shots - 1) / g.fire) * 1000), d };
  }
  const ttkHtml = (t) => (t.no ? `<small>${t.no}</small>` : t.shots === 1 ? '<b>One shot</b>' : `<b>${t.ms}<small> ms</small></b>`);

  /* ---- state, kept in the address ---- */
  const q = new URLSearchParams(location.search);
  const DEF_VS = ['vandal', 'phantom'].filter((id) => byId[id]);
  const st = {
    type: typeOf[q.get('type')] ? q.get('type') : '',
    m: Math.min(MAXM, Math.max(0, q.has('m') ? parseInt(q.get('m'), 10) || 0 : 15)),
    hit: HITS[q.get('hit')] ? q.get('hit') : 'body',
    arm: q.get('arm') === '0' ? 0 : q.get('arm') === '25' ? 25 : 50,
    sort: 'ttk',
    dir: 1,
    find: '',
    vs: q.has('vs') ? q.get('vs').split(',').filter((id) => byId[id]).slice(0, 3) : DEF_VS.slice(),
    w: byId[q.get('w')] ? q.get('w') : '',
  };
  const color = {};
  st.vs.forEach((id, i) => (color[id] = SLOTS[i]));
  function save() {
    const u = new URL(location.href);
    const set = (k, v) => (v !== '' && v != null ? u.searchParams.set(k, v) : u.searchParams.delete(k));
    set('type', st.type);
    set('m', st.m === 15 ? '' : st.m);
    set('hit', st.hit === 'body' ? '' : st.hit);
    set('arm', st.arm === 50 ? '' : st.arm);
    set('vs', st.vs.join(',') === DEF_VS.join(',') ? '' : st.vs.join(','));
    set('w', st.w);
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }
  const shown = (g) =>
    (!st.type || g.type === st.type) && (!st.find || g.name.toLowerCase().includes(st.find) || typeOf[g.type].name.toLowerCase().includes(st.find));

  /* ---- banner: count, patch, the running act ---- */
  const costs = guns.map((g) => g.cost);
  $('cbCount').textContent = guns.length;
  $('cbCountSub').textContent = `${TYPES.length} types · ${Math.min(...costs)}–${num(Math.max(...costs))} credits`;
  if (data.patch) {
    $('cbPatch').querySelector('b').textContent = data.patch.branch;
    $('cbPatch').hidden = false;
  }
  const now = Date.now();
  const act = (data.acts || []).find((a) => Date.parse(a.start) <= now && now < Date.parse(a.end));
  if (act) {
    const end = new Date(act.end);
    const f = $('cbAct');
    f.querySelector('b').textContent = (act.ep ? act.ep + ' ' : '') + act.name;
    f.querySelector('em').innerHTML =
      `<i>${Math.ceil((end - now) / 864e5)}d left</i><span class="cb-end"> · ends ` + end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + '</span>';
    f.hidden = false;
  }

  /* ---- type tray ---- */
  const tray = $('vwTabs');
  tray.innerHTML = [{ t: '', name: 'All' }, ...TYPES]
    .map((t) => `<button type="button" role="tab" data-type="${t.t}" aria-selected="${st.type === t.t}">${t.name}<span class="cb-n">${t.t ? guns.filter((g) => g.type === t.t).length : guns.length}</span></button>`)
    .join('');
  tray.addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    st.type = b.dataset.type;
    tray.querySelectorAll('[data-type]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    save();
    lists();
  });

  /* ---- the bar ---- */
  const range = $('vwM');
  range.value = st.m;
  const showM = () => {
    $('vwMOut').textContent = st.m + ' m';
    range.style.setProperty('--fill', (st.m / MAXM) * 100 + '%');
  };
  showM();
  range.addEventListener('input', () => {
    st.m = +range.value;
    showM();
    save();
    draw();
  });
  function seg(boxId, key, parse) {
    const box = $(boxId);
    const mark = () => box.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(parse(b.dataset[key]) === st[key])));
    mark();
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      st[key] = parse(b.dataset[key]);
      mark();
      save();
      draw();
    });
  }
  seg('vwHit', 'hit', (v) => v);
  seg('vwArm', 'arm', Number);
  $('vwQ').addEventListener('input', (e) => {
    st.find = e.target.value.trim().toLowerCase();
    lists();
  });

  /* ---- buy menu ---- */
  function shop() {
    const vis = guns.filter(shown);
    // the quickest kill on show that takes more than one shot (one-shots are 0 ms and say so already),
    // only when one gun has it alone
    const ts = vis.map((g) => [g, ttk(g, st.m, st.hit, st.arm)]).filter(([, t]) => t.shots > 1);
    const best = Math.min(...ts.map(([, t]) => t.ms));
    const fastest = ts.filter(([, t]) => t.ms === best);
    const top = fastest.length === 1 ? fastest[0][0].id : null;
    $('vwShop').innerHTML =
      COLS.map(([title, types]) => {
        const col = vis.filter((g) => types.includes(g.type));
        if (!col.length) return '';
        return (
          `<div class="vw-col"><h3 class="vw-col-head">${title}<span>${col.length}</span></h3><div class="vw-col-list">` +
          col
            .map((g) => {
              const t = ttk(g, st.m, st.hit, st.arm);
              const on = st.vs.includes(g.id);
              return (
                `<button type="button" class="vw-tile${on ? ' is-on' : ''}" data-open="${g.id}"${on ? ` style="--sw:${color[g.id]}"` : ''}>` +
                `<span class="vw-tile-top"><b>${esc(g.name)}</b><span class="vw-cost">${CR}${num(g.cost)}</span></span>` +
                `<img src="${esc(g.icon)}" alt="" loading="lazy" decoding="async">` +
                `<span class="vw-tile-foot"><span class="vw-ttk">${t.no ? `${g.pellets} pellets` : t.shots === 1 ? 'One shot' : `${t.ms}<small> ms</small>`}</span>` +
                `<small>${t.no ? `${t.d} each` : t.shots === 1 ? `${t.d} dmg` : `${t.shots} shots`}</small>` +
                (g.id === top ? '<em class="vw-tag">Fastest</em>' : '') +
                '</span></button>'
              );
            })
            .join('') +
          '</div></div>'
        );
      }).join('') || '<p class="vw-fail">No gun by that name.</p>';
  }
  $('vwShop').addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (b) open(b.dataset.open);
  });

  /* ---- one-shot ranges: a 0-50 m track per gun, red where one bullet kills ---- */
  function oneShot() {
    const need = HP + st.arm;
    const rows = guns
      .filter(shown)
      .filter((g) => g.pellets === 1)
      .map((g) => ({ g, hits: g.ranges.filter((r) => r[st.hit] >= need) }))
      .filter((x) => x.hits.length);
    $('vwOneSub').textContent = `The red bar is where one ${HITS[st.hit].toLowerCase()} shot kills through ${ARMS[st.arm]}, and the white line is your distance. One tap, night night!`;
    const pct = (m) => (m / MAXM) * 100;
    $('vwOne').innerHTML = rows.length
      ? '<div class="vw-one-axis" aria-hidden="true"><span></span><span>' +
        [0, 10, 20, 30, 40, 50].map((m) => `<i style="left:${pct(m)}%">${m}${m === 50 ? ' m' : ''}</i>`).join('') +
        '</span></div>' +
        rows
          .map(({ g, hits }) => {
            const all = hits.length === g.ranges.length;
            const label = all ? 'Any range' : hits.map(rng).join(', ');
            return (
              `<button type="button" class="vw-one-row" data-open="${g.id}"><span class="vw-one-gun"><img src="${esc(g.kill)}" alt="" loading="lazy"><b>${esc(g.name)}</b><small>${label}</small></span>` +
              `<span class="vw-one-track" role="img" aria-label="${esc(g.name)}: one shot at ${label}">` +
              hits.map((r) => `<i style="left:${pct(r.from)}%;width:${pct(r.to - r.from)}%"><span>${r[st.hit]}</span></i>`).join('') +
              `<em style="left:${pct(st.m)}%"></em></span></button>`
            );
          })
          .join('')
      : `<p class="vw-fail">Nothing on show kills with one ${HITS[st.hit].toLowerCase()} shot through ${ARMS[st.arm]}.</p>`;
  }
  $('vwOne').addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (b) open(b.dataset.open);
  });

  /* ---- every gun: the sortable list ---- */
  document.querySelector('.vw-table thead').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sort]');
    if (!b) return;
    const k = b.dataset.sort;
    st.dir = st.sort === k ? -st.dir : 1;
    st.sort = k;
    rows();
  });
  function sortVal(g) {
    const t = ttk(g, st.m, st.hit, st.arm);
    return { name: g.name.toLowerCase(), ttk: t.no ? null : t.ms, dmg: -t.d, cost: g.cost, fire: -g.fire, mag: -g.mag, reload: g.reload, pen: -(PEN[g.pen] || 0) }[st.sort];
  }
  function rows() {
    const list = guns
      .filter(shown)
      .map((g) => [g, sortVal(g)])
      .sort((a, b) => {
        if (a[1] == null && b[1] == null) return a[0].name.localeCompare(b[0].name);
        if (a[1] == null) return 1; // shotguns always last on TTK
        if (b[1] == null) return -1;
        return (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[0].cost - b[0].cost) * st.dir;
      })
      .map(([g]) => g);
    document.querySelectorAll('.vw-table [data-sort]').forEach((b) => {
      const th = b.parentElement;
      if (b.dataset.sort === st.sort) th.setAttribute('aria-sort', st.dir > 0 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
    $('vwRows').innerHTML =
      list
        .map((g) => {
          const t = ttk(g, st.m, st.hit, st.arm);
          const on = st.vs.includes(g.id);
          const full = !on && st.vs.length >= 3;
          return (
            `<tr data-id="${g.id}"${on ? ' class="is-on"' : ''}>` +
            `<td class="gs-c-pick"><input type="checkbox" aria-label="Compare ${esc(g.name)}"${on ? ` checked style="--sw:${color[g.id]}"` : ''}${full ? ' disabled' : ''}></td>` +
            `<td><button type="button" class="gs-gun vw-gun" data-open="${g.id}"><img src="${esc(g.icon)}" alt="" loading="lazy" decoding="async">` +
            `<span><b>${esc(g.name)}</b><small>${typeOf[g.type].one}${g.semi ? ' · semi-auto' : ''}</small></span></button></td>` +
            `<td class="gs-ttk">${ttkHtml(t)}${t.shots > 1 ? `<small>${t.shots} shots</small>` : ''}</td>` +
            `<td>${t.d}${g.pellets > 1 ? `<small> × ${g.pellets}</small>` : ''}</td>` +
            `<td><span class="vw-cost">${CR}${num(g.cost)}</span></td>` +
            `<td class="gs-c-x">${g.fire}<small> /s</small></td>` +
            `<td class="gs-c-x">${g.mag}</td>` +
            `<td class="gs-c-x">${g.reload}<small> s</small></td>` +
            `<td class="gs-c-x">${g.pen || '–'}</td>` +
            '</tr>'
          );
        })
        .join('') || '<tr><td colspan="9" class="gs-empty">No gun by that name.</td></tr>';
  }
  $('vwRows').addEventListener('change', (e) => {
    const box = e.target.closest('input[type=checkbox]');
    if (box) pickVs(box.closest('tr').dataset.id, box.checked);
  });
  $('vwRows').addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (b) open(b.dataset.open);
  });
  function pickVs(id, on) {
    if (on && !st.vs.includes(id) && st.vs.length < 3) {
      st.vs.push(id);
      color[id] = SLOTS.find((c) => !st.vs.some((v) => color[v] === c && v !== id));
    } else if (!on) {
      st.vs = st.vs.filter((v) => v !== id);
      delete color[id];
    }
    save();
    draw();
  }

  /* ---- compare: chart (TTK over distance) + the picked guns' sheet ---- */
  const chart = $('vwChart');
  function drawChart() {
    const picks = st.vs.map((id) => byId[id]);
    const lines = picks.filter((g) => g.pellets === 1).map((g) => {
      const pts = [];
      for (let m = 0; m <= MAXM; m += 0.5) pts.push([m, ttk(g, m, st.hit, st.arm).ms]);
      return { g, pts };
    });
    const W = Math.max(300, chart.clientWidth || 600);
    const H = W < 520 ? 220 : 280;
    const P = { l: 46, r: 14, t: 26, b: 30 };
    const top = Math.max(100, ...lines.flatMap((l) => l.pts.map((p) => p[1])));
    const stepY = top > 1200 ? 500 : top > 600 ? 200 : top > 300 ? 100 : 50;
    const ymax = Math.ceil((top * 1.08) / stepY) * stepY;
    const x = (m) => P.l + (m / MAXM) * (W - P.l - P.r);
    const y = (v) => H - P.b - (v / ymax) * (H - P.t - P.b);
    let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Time to kill by distance">`;
    for (let v = 0; v <= ymax; v += stepY) {
      svg += `<line class="gs-grid" x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/><text class="gs-ax" x="${P.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    }
    for (let m = 0; m <= MAXM; m += 10) svg += `<text class="gs-ax" x="${x(m)}" y="${H - 10}" text-anchor="middle">${m} m</text>`;
    svg += `<text class="gs-ax" x="${P.l - 8}" y="12" text-anchor="end">ms</text>`;
    svg += `<line class="gs-now" x1="${x(st.m)}" x2="${x(st.m)}" y1="${P.t}" y2="${H - P.b}"/>`;
    for (const { g, pts } of lines) {
      let d = '';
      pts.forEach(([m, v], i) => (d += i ? `H${x(m)}V${y(v)}` : `M${x(m)},${y(v)}`));
      svg += `<path class="gs-line" d="${d}" stroke="${color[g.id]}"/>`;
    }
    svg += `<line class="gs-cross" id="vwCross" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" hidden/></svg>`;
    chart.innerHTML =
      svg + '<div class="gs-tip" id="vwTip" hidden></div>' + (lines.length ? '' : `<p class="gs-none">${picks.length ? 'Shotguns have no time to kill: their pellets spread.' : 'Pick a gun in the list below to see it here.'}</p>`);
    // crosshair: snaps to the half metre under the pointer, lists every picked gun there
    const cross = $('vwCross');
    const tip = $('vwTip');
    const svgEl = chart.querySelector('svg');
    svgEl.onpointermove = (e) => {
      if (!lines.length) return;
      const r = svgEl.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const m = Math.round(Math.min(MAXM, Math.max(0, ((px - P.l) / (W - P.l - P.r)) * MAXM)) * 2) / 2;
      cross.setAttribute('x1', x(m));
      cross.setAttribute('x2', x(m));
      cross.hidden = false;
      tip.replaceChildren();
      const head = document.createElement('b');
      head.textContent = `${m} m, ${HITS[st.hit].toLowerCase()}`;
      tip.append(head);
      for (const { g } of lines) {
        const t = ttk(g, m, st.hit, st.arm);
        const row = document.createElement('span');
        const sw = document.createElement('i');
        sw.style.background = color[g.id];
        const name = document.createElement('em');
        name.textContent = g.name;
        const val = document.createElement('strong');
        val.textContent = t.shots === 1 ? 'One shot' : `${t.ms} ms`;
        row.append(sw, name, val);
        tip.append(row);
      }
      tip.hidden = false;
      const left = (x(m) / W) * r.width;
      tip.style.left = Math.min(r.width - tip.offsetWidth - 4, Math.max(4, left + 12)) + 'px';
    };
    svgEl.onpointerleave = () => {
      cross.hidden = true;
      tip.hidden = true;
    };
  }
  function drawSheet() {
    const picks = st.vs.map((id) => byId[id]);
    $('vwLegend').innerHTML = picks
      .map((g) => `<span class="gs-chip"><i style="background:${color[g.id]}"></i>${esc(g.name)}<button type="button" data-drop="${g.id}" aria-label="Remove ${esc(g.name)}">×</button></span>`)
      .join('');
    if (!picks.length) {
      $('vwSheet').innerHTML = '';
      return;
    }
    const row = (label, f) => `<tr><th scope="row">${label}</th>${picks.map((g) => `<td>${f(g)}</td>`).join('')}</tr>`;
    const val = (g) => ttk(g, st.m, st.hit, st.arm);
    $('vwSheet').innerHTML =
      '<table class="gs-vs"><thead><tr><th></th>' +
      picks.map((g) => `<th scope="col"><i style="background:${color[g.id]}"></i>${esc(g.name)}</th>`).join('') +
      '</tr></thead><tbody>' +
      row(`TTK at ${st.m} m`, (g) => ttkHtml(val(g))) +
      row('Shots to kill', (g) => val(g).shots ?? '–') +
      row(`Damage at ${st.m} m`, (g) => { const r = band(g, st.m); return `${r.head} / ${r.body} / ${r.leg}<br><small>head / body / legs${g.pellets > 1 ? `, per pellet × ${g.pellets}` : ''}</small>`; }) +
      row('Damage drops', (g) => (g.ranges.length > 1 ? `<small>${g.ranges.map((r) => `${r[st.hit]} (${rng(r)})`).join(', ')}</small>` : '<small>Never</small>')) +
      row('Cost', (g) => `<span class="vw-cost">${CR}${num(g.cost)}</span>`) +
      row('Fire rate', (g) => `${g.fire} /s${g.ads && g.ads.fire !== g.fire ? ` <small>(${g.ads.fire} aimed)</small>` : ''}`) +
      row('Magazine', (g) => g.mag) +
      row('Reload', (g) => `${g.reload} s`) +
      row('Run speed', (g) => `${(RUN * g.run).toFixed(2)} m/s`) +
      row('Walls', (g) => g.pen || '–') +
      '</tbody></table>';
  }
  $('vwLegend').addEventListener('click', (e) => {
    const b = e.target.closest('[data-drop]');
    if (b) pickVs(b.dataset.drop, false);
  });

  /* ---- patch changes ---- */
  const log = data.log || [];
  const day = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  $('vwLog').innerHTML = log.length
    ? log
        .slice(0, 40)
        .map(
          (c) =>
            `<li><span class="cs-when">${esc(c.patch)}</span><span class="cs-row-main"><b>${esc(c.gun)}</b><small>${esc(c.what)}` +
            `${c.to != null ? `: ${esc(c.from ?? 'none')} → ${esc(c.to)}` : ''} · ${day(c.day)}</small></span></li>`
        )
        .join('')
    : `<li class="gs-log-empty"><span class="cs-row-main"><b>No changes yet</b><small>Tracking started on ${day(data.since)}, patch ${esc(data.patch.branch)}. When a patch changes a gun's numbers, the change shows here the next day.</small></span></li>`;

  /* ---- one gun: the panel ---- */
  const dlg = $('vwDlg');
  const skinCache = {};
  const FEATURE = { Silenced: 'Silenced', ROFIncrease: 'Fires faster as you hold', DualZoom: 'Two zoom levels' };
  function altLine(g) {
    if (g.altShotgun) return `Alt fire: a ${g.altShotgun.pellets}-pellet shotgun blast`;
    if (g.airBurst) return `Alt fire: an air burst of ${g.airBurst.pellets} pellets at ${g.airBurst.at} m`;
    if (g.ads && g.ads.burst > 1) return `Aimed: ${g.ads.burst}-round burst, ×${g.ads.zoom} zoom`;
    if (g.ads) return `Aimed: ×${g.ads.zoom} zoom`;
    return null;
  }
  // a simple body: head, chest + arms, legs (the picked zone lights up)
  const BODY =
    '<svg class="vw-body" viewBox="0 0 120 236" aria-hidden="true">' +
    '<circle data-z="head" cx="60" cy="24" r="17"/>' +
    '<path data-z="body" d="M36 48h48a8 8 0 0 1 8 8v74a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6V56a8 8 0 0 1 8-8zM14 54a6 6 0 0 1 11 0v62a5.5 5.5 0 0 1-11 0zM95 54a6 6 0 0 1 11 0v62a5.5 5.5 0 0 1-11 0z"/>' +
    '<path data-z="leg" d="M34 140h24v86a7 7 0 0 1-7 7h-10a7 7 0 0 1-7-7zM62 140h24v86a7 7 0 0 1-7 7H69a7 7 0 0 1-7-7z"/>' +
    '</svg>';
  let cur = null; // { g, band: index, zone }

  function open(id) {
    const g = byId[id];
    if (!g) return;
    st.w = id;
    save();
    const bi = g.ranges.indexOf(band(g, st.m));
    cur = { g, band: bi, zone: st.hit };
    const tags = [g.semi ? 'Semi-auto' : 'Full auto', FEATURE[g.feature], altLine(g), g.pen && `${g.pen} wall penetration`].filter(Boolean);
    const stat = (k, v, sub) => `<div class="vw-stat"><small>${k}</small><b>${v}</b>${sub ? `<em>${sub}</em>` : ''}</div>`;
    dlg.innerHTML =
      '<div class="vw-d">' +
      '<span class="vw-grip" aria-hidden="true"></span>' +
      '<button type="button" class="vw-x" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
      '<div class="vw-d-art">' +
      `<div class="vw-stage" id="vwStage"><img id="vwStageImg" src="${esc(g.icon)}" alt="${esc(g.name)}"><video id="vwStageVid" muted loop playsinline hidden></video>` +
      `<span class="vw-stage-name" id="vwStageName">Standard ${esc(g.name)}</span><button type="button" class="vw-play" id="vwPlay" hidden>Play video</button></div>` +
      '<div class="vw-chromas" id="vwChromas" hidden></div>' +
      `<div class="vw-skins-head"><b>Skins</b><span>${g.skins}</span></div>` +
      '<div class="vw-skins" id="vwSkins"><p class="vw-skins-wait">Loading skins…</p></div>' +
      '</div>' +
      '<div class="vw-d-info">' +
      `<p class="vw-d-kick">${typeOf[g.type].one} · <span class="vw-cost">${CR}${num(g.cost)}</span></p>` +
      `<h2 class="vw-d-name" id="vwDName">${esc(g.name)}</h2>` +
      `<ul class="vw-d-tags">${tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` +
      '<h3 class="vw-d-h">Damage</h3>' +
      (g.ranges.length > 1
        ? `<div class="gs-seg vw-bands" id="vwBands">${g.ranges.map((r, i) => `<button type="button" data-band="${i}" aria-pressed="${i === bi}">${rng(r)}</button>`).join('')}</div>`
        : `<p class="vw-d-note">The same at every range (${rng(g.ranges[0])}).</p>`) +
      `<div class="vw-dmg">${BODY}<div class="vw-zones" id="vwZones"></div></div>` +
      `<h3 class="vw-d-h">Shots to kill</h3><div class="vw-stk" id="vwStk"></div>` +
      '<h3 class="vw-d-h">Stats</h3><div class="vw-stats">' +
      stat('Fire rate', `${g.fire}<small> /s</small>`, g.ads && g.ads.fire !== g.fire ? `${g.ads.fire} /s aimed` : '') +
      stat('Magazine', g.mag) +
      stat('Reload', `${g.reload}<small> s</small>`) +
      stat('Equip', `${g.equip}<small> s</small>`) +
      stat('Run speed', `${(RUN * g.run).toFixed(2)}<small> m/s</small>`, `${Math.round(g.run * 100)}% of the knife`) +
      stat('First shot', g.spread != null ? `${g.spread}<small>°</small>` : '–', 'spread from the hip') +
      '</div>' +
      `<div class="vw-d-keys"><button type="button" class="vw-key" id="vwVs"></button><button type="button" class="vw-key vw-key--q" id="vwShare">Copy link</button></div>` +
      '</div></div>';
    paintDamage();
    paintVsKey();
    if (!dlg.open) dlg.showModal();
    dlg.querySelector('.vw-d-info').scrollTop = 0;
    skins(g);
  }
  function paintDamage() {
    const { g, band: bi, zone } = cur;
    const r = g.ranges[bi];
    const max = Math.max(r.head, r.body, r.leg);
    dlg.querySelectorAll('.vw-body [data-z]').forEach((el) => el.classList.toggle('is-on', el.dataset.z === zone));
    $('vwZones').innerHTML = Object.entries(HITS)
      .map(
        ([z, name]) =>
          `<button type="button" class="vw-zone${z === zone ? ' is-on' : ''}" data-zone="${z}"><span>${name}</span><b>${r[z]}${g.pellets > 1 ? `<small> × ${g.pellets}</small>` : ''}</b>` +
          `<i style="--w:${(r[z] / max) * 100}%"></i></button>`
      )
      .join('');
    // rows = hit zones, columns = shields; shotguns say what a full hit does instead
    if (g.pellets > 1) {
      $('vwStk').innerHTML = `<p class="vw-d-note">${g.pellets} pellets a shot, ${r.body} body damage each: up to ${Math.round(r.body * g.pellets)} if every pellet lands (${rng(r)}). Shotguns get no shot count here because their pellets spread.</p>`;
      return;
    }
    const m = r.from; // any distance inside the band gives the same damage
    $('vwStk').innerHTML =
      '<table class="vw-stk-t"><thead><tr><th></th>' +
      Object.values(ARMS).map((a, i) => `<th scope="col">${['None', 'Light', 'Heavy'][i]}<small>${HP + [0, 25, 50][i]} HP</small></th>`).join('') +
      '</tr></thead><tbody>' +
      Object.entries(HITS)
        .map(
          ([z, name]) =>
            `<tr${z === zone ? ' class="is-on"' : ''}><th scope="row">${name}</th>` +
            [0, 25, 50]
              .map((a) => {
                const t = ttk(g, m, z, a);
                return `<td${t.shots === 1 ? ' class="is-one"' : ''}><b>${t.shots}</b><small>${t.shots === 1 ? 'one shot' : t.ms + ' ms'}</small></td>`;
              })
              .join('') +
            '</tr>'
        )
        .join('') +
      '</tbody></table>';
  }
  function paintVsKey() {
    const b = $('vwVs');
    if (!b) return;
    const on = st.vs.includes(cur.g.id);
    b.textContent = on ? 'Remove from compare' : st.vs.length >= 3 ? 'Compare is full (3)' : 'Compare';
    b.disabled = !on && st.vs.length >= 3;
    b.classList.toggle('vw-key--red', !on);
  }
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-close]')) return dlg.close();
    const bandB = e.target.closest('[data-band]');
    if (bandB) {
      cur.band = +bandB.dataset.band;
      dlg.querySelectorAll('[data-band]').forEach((x) => x.setAttribute('aria-pressed', String(x === bandB)));
      return paintDamage();
    }
    const z = e.target.closest('[data-zone]');
    if (z) {
      cur.zone = z.dataset.zone;
      return paintDamage();
    }
    if (e.target.closest('#vwVs')) {
      pickVs(cur.g.id, !st.vs.includes(cur.g.id));
      return paintVsKey();
    }
    if (e.target.closest('#vwShare')) {
      const b = $('vwShare');
      navigator.clipboard.writeText(location.origin + location.pathname + '?w=' + cur.g.id).then(
        () => ((b.textContent = 'Copied'), setTimeout(() => (b.textContent = 'Copy link'), 1400)),
        () => {}
      );
      return;
    }
    const sk = e.target.closest('[data-skin]');
    if (sk) return showSkin(+sk.dataset.skin);
    const ch = e.target.closest('[data-chroma]');
    if (ch) return showChroma(+ch.dataset.chroma);
    if (e.target.closest('[data-more]')) {
      e.target.closest('[data-more]').remove();
      dlg.querySelectorAll('.vw-skin[hidden]').forEach((x) => (x.hidden = false));
      return;
    }
    if (e.target.closest('#vwPlay')) playVideo();
  });
  dlg.addEventListener('close', () => {
    const v = $('vwStageVid');
    if (v) v.pause();
    st.w = '';
    save();
  });

  /* skins: one gun's full entry from valorant-api, on open; richest tier first */
  const isSkin = (k) => !/^(Standard |Random Favorite)/.test(k.displayName);
  // the gun pictures only, the first chroma's render first: some skins' own displayIcon is a grey "X"
  // placeholder (Sovereign Marshal), and a level's displayIcon is its upgrade badge (a chevron)
  const pic = (k) => (k.chromas[0] && k.chromas[0].fullRender) || k.displayIcon || (k.chromas[0] && k.chromas[0].displayIcon);
  async function skins(g) {
    if (!skinCache[g.id]) {
      skinCache[g.id] = fetch('https://valorant-api.com/v1/weapons/' + g.uuid)
        .then((r) => r.json())
        .then((j) =>
          j.data.skins
            .filter(isSkin)
            .filter(pic)
            .sort((a, b) => ((data.tiers[b.contentTierUuid] || {}).rank ?? -1) - ((data.tiers[a.contentTierUuid] || {}).rank ?? -1) || a.displayName.localeCompare(b.displayName))
        )
        .catch(() => null);
    }
    const list = await skinCache[g.id];
    if (!cur || cur.g !== g) return; // another gun opened meanwhile
    cur.skins = list || [];
    const box = $('vwSkins');
    if (!list) {
      box.innerHTML = '<p class="vw-skins-wait">Skins couldn\'t load right now.</p>';
      return;
    }
    const FIRST = 24;
    box.innerHTML =
      list
        .map((k, i) => {
          const t = data.tiers[k.contentTierUuid];
          return (
            `<button type="button" class="vw-skin" data-skin="${i}" title="${esc(k.displayName)}"${i >= FIRST ? ' hidden' : ''}>` +
            `<img src="${esc(pic(k))}" alt="${esc(k.displayName)}" loading="lazy" decoding="async">` +
            (t ? `<img class="vw-tier" src="${esc(t.icon)}" alt="${esc(t.name)}" title="${esc(t.name)}" loading="lazy">` : '') +
            '</button>'
          );
        })
        .join('') + (list.length > FIRST ? `<button type="button" class="vw-key vw-more" data-more>Show all ${list.length}</button>` : '');
  }
  function showSkin(i) {
    const k = cur.skins[i];
    if (!k) return;
    cur.skin = k;
    dlg.querySelectorAll('.vw-skin').forEach((b) => b.classList.toggle('is-on', +b.dataset.skin === i));
    const ch = $('vwChromas');
    ch.hidden = k.chromas.length < 2;
    ch.innerHTML = k.chromas
      .map((c, j) => `<button type="button" data-chroma="${j}" title="${esc(c.displayName)}" aria-label="${esc(c.displayName)}">${c.swatch ? `<img src="${esc(c.swatch)}" alt="">` : j + 1}</button>`)
      .join('');
    showChroma(0);
  }
  function showChroma(j) {
    const k = cur.skin;
    const c = k.chromas[j] || {};
    const img = $('vwStageImg');
    const vid = $('vwStageVid');
    vid.pause();
    vid.hidden = true;
    img.hidden = false;
    img.src = c.fullRender || c.displayIcon || pic(k);
    img.alt = k.displayName;
    $('vwStageName').textContent = j && c.displayName ? c.displayName.replace(/\s*\n\s*/g, ' ') : k.displayName;
    $('vwChromas').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.chroma === j)));
    // a video: the chroma's own, else the skin's last level that has one
    cur.video = c.streamedVideo || ([...k.levels].reverse().find((l) => l.streamedVideo) || {}).streamedVideo || null;
    $('vwPlay').hidden = !cur.video;
  }
  function playVideo() {
    const vid = $('vwStageVid');
    vid.src = cur.video;
    vid.hidden = false;
    $('vwStageImg').hidden = true;
    $('vwPlay').hidden = true;
    vid.play().catch(() => {});
  }

  /* ---- draw ---- */
  function lists() {
    shop();
    oneShot();
    rows();
  }
  function draw() {
    drawChart();
    drawSheet();
    lists();
  }
  let w = 0;
  addEventListener('resize', () => {
    // phones fire resize when the address bar moves: only a width change redraws
    if (chart.clientWidth !== w) {
      w = chart.clientWidth;
      drawChart();
    }
  });
  draw();
  w = chart.clientWidth;
  if (st.w) open(st.w);
})();
