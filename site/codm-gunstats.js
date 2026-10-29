/* GUN STATS (/call-of-duty-mobile/gun-stats, Oct 29 2026). Every number comes from codm-weapons.json
   (the CoD wiki's CODM infoboxes, pulled daily by scripts/codm-feed.mjs); this file only does the maths.
   TTK = Multiplayer, base gun: shots = ceil(100 / (damage at that distance x hit multiplier)),
   time = (shots - 1) gaps at the gun's RPM. A number the wiki doesn't state is never filled in: no
   ranges, shotgun pellets or burst fire = no TTK, and the row says why.
   Address: ?type=ar|sm|sr|lm|sg|ma (Attachments' codes), ?m=<metres>, ?hit=head, ?vs=<slug>,<slug>. */
(async function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const HP = 100;
  const MAXM = 60;
  const TYPES = [
    { q: 'ar', cls: 'ar', name: 'Assault Rifles', one: 'Assault rifle' },
    { q: 'sm', cls: 'smg', name: 'SMGs', one: 'SMG' },
    { q: 'sr', cls: 'sr', name: 'Snipers', one: 'Sniper' },
    { q: 'lm', cls: 'lmg', name: 'LMGs', one: 'LMG' },
    { q: 'sg', cls: 'sg', name: 'Shotguns', one: 'Shotgun' },
    { q: 'ma', cls: 'marksman', name: 'Marksman', one: 'Marksman' },
  ];
  const typeOf = Object.fromEntries(TYPES.map((t) => [t.cls, t]));
  // compared guns keep their colour while picked (validated for dark + colour-blind readers)
  const SLOTS = ['#3987e5', '#d95926', '#199e70'];

  const [data, log] = await Promise.all([
    fetch('/codm-weapons.json').then((r) => r.json()).catch(() => null),
    fetch('/codm-weapons-log.json').then((r) => r.json()).catch(() => null),
  ]);
  const guns = ((data && data.guns) || []).map((g) => ({ ...g, id: slug(g.name) }));
  if (!guns.length) {
    $('gsRows').innerHTML = '<tr><td colspan="7" class="gs-empty">The gun list couldn\'t load right now. Try again in a moment.</td></tr>';
    return;
  }
  const byId = Object.fromEntries(guns.map((g) => [g.id, g]));

  /* ---- the maths ---- */
  const why = (g) => (!g.mp || !g.rpm ? 'No stats on the wiki yet' : g.mp.pellets > 1 ? 'Shotgun pellets' : /burst/i.test(g.fire || '') ? 'Burst fire' : null);
  const dmgAt = (g, m) => {
    const { dmg, at } = g.mp;
    if (dmg.length === 1) return dmg[0];
    if (!at) return null;
    const i = at.findIndex((x) => m < x);
    return dmg[i < 0 ? dmg.length - 1 : i];
  };
  // { ms, shots, hit } or { no: reason }
  function ttk(g, m, hit) {
    const no = why(g);
    if (no) return { no };
    const d = dmgAt(g, m);
    if (d == null) return { no: 'No ranges on the wiki' };
    const x = hit === 'head' ? g.mp.head : g.mp.chest;
    if (x == null) return { no: 'No head multiplier' };
    const per = d * x;
    const shots = Math.ceil(HP / per - 1e-9);
    return { ms: Math.round(((shots - 1) * 60000) / g.rpm), shots, per: Math.round(per * 10) / 10, raw: d };
  }
  const fmtM = (v) => String(v).replace(/\.0$/, '');
  const steps = (g) => {
    const { dmg, at } = g.mp;
    if (!at) return dmg.join(' / ');
    return dmg.map((d, i) => `${d} (${i ? fmtM(at[i - 1]) : 0}${i < at.length ? '–' + fmtM(at[i]) : '+'} m)`).join(', ');
  };

  /* ---- state, kept in the address ---- */
  const q = new URLSearchParams(location.search);
  const st = {
    type: TYPES.some((t) => t.q === q.get('type')) ? q.get('type') : '',
    m: Math.min(MAXM, Math.max(0, parseInt(q.get('m'), 10) || 10)),
    hit: q.get('hit') === 'head' ? 'head' : 'chest',
    sort: 'ttk',
    dir: 1,
    find: '',
    vs: (q.get('vs') || '').split(',').filter((id) => byId[id]).slice(0, 3),
  };
  if (!st.vs.length) {
    // first visit: the three fastest killers at 10 m (chest), one-shot snipers left out (a flat 0 line says nothing)
    st.vs = guns
      .map((g) => [g, ttk(g, 10, 'chest')])
      .filter(([, t]) => t.ms != null && t.shots > 1)
      .sort((a, b) => a[1].ms - b[1].ms)
      .slice(0, 3)
      .map(([g]) => g.id);
  }
  const color = {};
  st.vs.forEach((id, i) => (color[id] = SLOTS[i]));
  function save() {
    const u = new URL(location.href);
    const set = (k, v) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
    set('type', st.type);
    set('m', st.m === 10 ? '' : st.m);
    set('hit', st.hit === 'head' ? 'head' : '');
    set('vs', st.vs.join(','));
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }

  /* ---- banner + class tray ---- */
  const withStats = guns.filter((g) => g.mp && g.rpm).length;
  $('cbCount').textContent = `${withStats} / ${guns.length}`;
  $('cbCountSub').textContent = 'the rest aren\'t on the wiki yet';
  const tray = $('gsTypes');
  tray.innerHTML = [{ q: '', name: 'All' }, ...TYPES]
    .map((t) => {
      const n = t.q ? guns.filter((g) => g.cls === t.cls).length : guns.length;
      return `<button type="button" role="tab" data-type="${t.q}" aria-selected="${st.type === t.q}">${esc(t.name)}<span class="cb-n">${n}</span></button>`;
    })
    .join('');
  tray.addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    st.type = b.dataset.type;
    tray.querySelectorAll('[data-type]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    save();
    rows();
  });

  /* ---- controls ---- */
  const range = $('gsM');
  range.value = st.m;
  const showM = () => {
    $('gsMOut').textContent = st.m + ' m';
    range.style.setProperty('--fill', (st.m / MAXM) * 100 + '%');
  };
  showM();
  range.addEventListener('input', () => {
    st.m = +range.value;
    showM();
    save();
    draw();
  });
  document.querySelectorAll('[data-hit]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.hit === st.hit));
    b.addEventListener('click', () => {
      st.hit = b.dataset.hit;
      document.querySelectorAll('[data-hit]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      save();
      draw();
    });
  });
  $('gsQ').addEventListener('input', (e) => {
    st.find = e.target.value.trim().toLowerCase();
    rows();
  });
  document.querySelector('.gs-table thead').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sort]');
    if (!b) return;
    const k = b.dataset.sort;
    st.dir = st.sort === k ? -st.dir : 1;
    st.sort = k;
    rows();
  });

  /* ---- the list ---- */
  function sortVal(g) {
    const t = ttk(g, st.m, st.hit);
    const d = g.mp && dmgAt(g, st.m);
    return {
      name: g.name.toLowerCase(),
      ttk: t.ms ?? null,
      dmg: d == null ? null : -d, // bigger first
      rpm: g.rpm == null ? null : -g.rpm,
      mag: g.mag == null ? null : -g.mag,
      reload: g.reload,
    }[st.sort];
  }
  function rows() {
    const list = guns
      .filter((g) => !st.type || typeOf[g.cls].q === st.type)
      .filter((g) => !st.find || g.name.toLowerCase().includes(st.find) || (g.wiki || '').toLowerCase().includes(st.find))
      .map((g) => [g, sortVal(g)])
      .sort((a, b) => {
        if (a[1] == null && b[1] == null) return a[0].name.localeCompare(b[0].name, 'en', { numeric: true });
        if (a[1] == null) return 1; // unknowns always last
        if (b[1] == null) return -1;
        return (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) * st.dir;
      })
      .map(([g]) => g);
    document.querySelectorAll('.gs-table [data-sort]').forEach((b) => {
      const th = b.parentElement;
      if (b.dataset.sort === st.sort) th.setAttribute('aria-sort', st.dir > 0 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
    $('gsAllSub').textContent = `Multiplayer, base gun with no attachments, ${st.hit} shots at ${st.m} m. Tap a column to sort.`;
    $('gsRows').innerHTML =
      list
        .map((g) => {
          const t = ttk(g, st.m, st.hit);
          const d = g.mp && dmgAt(g, st.m);
          const on = st.vs.includes(g.id);
          const full = !on && st.vs.length >= 3;
          return (
            `<tr data-id="${g.id}"${on ? ' class="is-on"' : ''}>` +
            `<td class="gs-c-pick"><input type="checkbox" aria-label="Compare ${esc(g.name)}"${on ? ' checked' : ''}${full ? ' disabled' : ''}${on ? ` style="--sw:${color[g.id]}"` : ''}></td>` +
            `<td><span class="gs-gun">${g.img ? `<img src="${esc(g.img)}" alt="" loading="lazy" decoding="async">` : '<i></i>'}` +
            `<span><b>${esc(g.name)}</b><small>${esc(typeOf[g.cls].one)}${g.fire ? ' · ' + esc(g.fire.toLowerCase()) : ''}</small></span></span></td>` +
            (t.shots === 1
              ? '<td class="gs-ttk"><b>One shot</b><small>0 ms</small></td>'
              : t.ms != null
              ? `<td class="gs-ttk"><b>${t.ms}<small> ms</small></b><small>${t.shots} shots</small></td>`
              : `<td class="gs-ttk is-no"><small>${esc(t.no)}</small>${t.no.startsWith('No stats') ? ` <a href="${esc(g.url)}" target="_blank" rel="noopener">Wiki</a>` : ''}</td>`) +
            `<td>${d != null ? d : '–'}</td>` +
            `<td>${g.rpm != null ? fmtM(g.rpm) + '<small> rpm</small>' : '–'}</td>` +
            `<td class="gs-c-x">${g.mag ?? '–'}</td>` +
            `<td class="gs-c-x">${g.reload != null ? g.reload + '<small> s</small>' : '–'}</td>` +
            '</tr>'
          );
        })
        .join('') || '<tr><td colspan="7" class="gs-empty">No gun by that name.</td></tr>';
  }
  $('gsRows').addEventListener('change', (e) => {
    const box = e.target.closest('input[type=checkbox]');
    if (!box) return;
    const id = box.closest('tr').dataset.id;
    if (box.checked && st.vs.length < 3) {
      st.vs.push(id);
      color[id] = SLOTS.find((c) => !st.vs.some((v) => color[v] === c && v !== id));
    } else {
      st.vs = st.vs.filter((v) => v !== id);
      delete color[id];
    }
    save();
    draw();
  });

  /* ---- compare: chart (TTK over distance) + the picked guns' sheet ---- */
  const chart = $('gsChart');
  function series(g) {
    // TTK at every half metre, as a step line; null where the wiki gives nothing
    const pts = [];
    for (let m = 0; m <= MAXM; m += 0.5) pts.push([m, ttk(g, m, st.hit).ms ?? null]);
    return pts;
  }
  function drawChart() {
    const picks = st.vs.map((id) => byId[id]);
    const lines = picks.map((g) => ({ g, pts: series(g) })).filter((l) => l.pts.some((p) => p[1] != null));
    const W = Math.max(300, chart.clientWidth || 600);
    const H = W < 520 ? 220 : 280;
    const P = { l: 46, r: 14, t: 26, b: 30 };
    const top = Math.max(100, ...lines.flatMap((l) => l.pts.map((p) => p[1] || 0)));
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
    // the slider's distance
    svg += `<line class="gs-now" x1="${x(st.m)}" x2="${x(st.m)}" y1="${P.t}" y2="${H - P.b}"/>`;
    for (const { g, pts } of lines) {
      let d = '';
      let prev = null;
      for (const [m, v] of pts) {
        if (v == null) { prev = null; continue; }
        d += prev == null ? `M${x(m)},${y(v)}` : `H${x(m)}V${y(v)}`;
        prev = v;
      }
      svg += `<path class="gs-line" d="${d}" stroke="${color[g.id]}"/>`;
    }
    svg += `<line class="gs-cross" id="gsCross" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" hidden/></svg>`;
    chart.innerHTML = svg + '<div class="gs-tip" id="gsTip" hidden></div>' +
      (picks.length ? '' : '<p class="gs-none">Tick a gun in the list below to see it here.</p>');
    // crosshair: snaps to the half metre under the pointer, lists every picked gun there
    const cross = $('gsCross');
    const tip = $('gsTip');
    const svgEl = chart.querySelector('svg');
    svgEl.onpointermove = (e) => {
      if (!picks.length) return;
      const r = svgEl.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const m = Math.round(Math.min(MAXM, Math.max(0, ((px - P.l) / (W - P.l - P.r)) * MAXM)) * 2) / 2;
      cross.setAttribute('x1', x(m));
      cross.setAttribute('x2', x(m));
      cross.hidden = false;
      tip.replaceChildren();
      const head = document.createElement('b');
      head.textContent = `${fmtM(m)} m, ${st.hit}`;
      tip.append(head);
      for (const g of picks) {
        const t = ttk(g, m, st.hit);
        const row = document.createElement('span');
        const sw = document.createElement('i');
        sw.style.background = color[g.id];
        const name = document.createElement('em');
        name.textContent = g.name;
        const val = document.createElement('strong');
        val.textContent = t.ms != null ? `${t.ms} ms` : '–';
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
    $('gsLegend').innerHTML = picks
      .map((g) => `<span class="gs-chip"><i style="background:${color[g.id]}"></i>${esc(g.name)}<button type="button" data-drop="${g.id}" aria-label="Remove ${esc(g.name)}">×</button></span>`)
      .join('');
    if (!picks.length) {
      $('gsSheet').innerHTML = '';
      return;
    }
    const row = (label, f) => `<tr><th scope="row">${label}</th>${picks.map((g) => `<td>${f(g)}</td>`).join('')}</tr>`;
    const val = (g) => ttk(g, st.m, st.hit);
    $('gsSheet').innerHTML =
      '<table class="gs-vs"><thead><tr><th></th>' +
      picks.map((g) => `<th scope="col"><i style="background:${color[g.id]}"></i>${esc(g.name)}</th>`).join('') +
      '</tr></thead><tbody>' +
      row(`TTK at ${st.m} m`, (g) => { const t = val(g); return t.shots === 1 ? '<b>One shot</b>' : t.ms != null ? `<b>${t.ms} ms</b>` : `<small>${esc(t.no)}</small>`; }) +
      row('Shots to kill', (g) => val(g).shots ?? '–') +
      row(`Damage at ${st.m} m`, (g) => { const t = val(g); return t.raw != null ? `${t.raw}${t.per !== t.raw ? ` <small>(${t.per} ${st.hit})</small>` : ''}` : '–'; }) +
      row('Damage by range', (g) => (g.mp ? `<small>${esc(steps(g))}</small>` : '–')) +
      row('Head / chest', (g) => (g.mp ? `${g.mp.head ?? '–'}× / ${g.mp.chest ?? '–'}×` : '–')) +
      row('Fire rate', (g) => (g.rpm != null ? fmtM(g.rpm) + ' rpm' : '–')) +
      row('Magazine', (g) => g.mag ?? '–') +
      row('Reload', (g) => (g.reload != null ? `${g.reload} s${g.reloadEmpty != null ? ` <small>(${g.reloadEmpty} s empty)</small>` : ''}` : '–')) +
      row('Battle Royale damage', (g) => (g.br ? esc(g.br.dmg.join(' / ')) : '–')) +
      row('Source', (g) => `<a href="${esc(g.url)}" target="_blank" rel="noopener">Wiki</a>${g.edited ? ` <small>· edited ${new Date(g.edited + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</small>` : ''}`) +
      '</tbody></table>';
  }
  $('gsLegend').addEventListener('click', (e) => {
    const b = e.target.closest('[data-drop]');
    if (!b) return;
    st.vs = st.vs.filter((v) => v !== b.dataset.drop);
    delete color[b.dataset.drop];
    save();
    draw();
  });
  function draw() {
    drawChart();
    drawSheet();
    rows();
  }
  let w = 0;
  addEventListener('resize', () => {
    // phones fire resize when the address bar moves: only a width change redraws
    if (chart.clientWidth !== w) {
      w = chart.clientWidth;
      drawChart();
    }
  });

  /* ---- buffs and nerfs ---- */
  const changes = (log && log.changes) || [];
  const day = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  $('gsLog').innerHTML = changes.length
    ? changes
        .slice(0, 40)
        .map((c) => `<li><span class="cs-when">${day(c.day)}</span><span class="cs-row-main"><b>${esc(c.gun)}</b><small>${esc(c.what)}${c.to != null ? `: ${esc(c.from ?? 'none')} → ${esc(c.to)}` : ''}</small></span></li>`)
        .join('')
    : '<li class="gs-log-empty"><span class="cs-row-main"><b>Nothing yet</b><small>Tracking started on Oct 29, 2026. When the wiki changes a gun\'s numbers, the change shows here the next day.</small></span></li>';

  draw();
  w = chart.clientWidth;
})();
