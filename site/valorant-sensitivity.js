/* ============================================================
   VALORANT SENSITIVITY CONVERTER (Oct 30 2026): /valorant/sensitivity.
   Same mouse swipe = same turn: every game turns `yaw` degrees per mouse count at sens 1, so
   Valorant sens = sens x yaw / 0.07, and cm/360 = 360 x 2.54 / (DPI x sens x yaw).
   Yaws = what open-source converters (victorfang-edit/sens-converter, rustivity), KovaaK's and the
   commercial ones agree on. Games the sources disagree on (Deadlock, Destiny 2, Roblox, The Finals)
   stay out until Adrian checks them with a 360 test in game. Scoped / ADS aim is not converted.
   The address holds ?from=<id>&sens=<n>&dpi=<n>.
   ============================================================ */
(function () {
  'use strict';

  const VAL = { id: 'valorant', name: 'Valorant', yaw: 0.07, dp: 3 };
  // dp = how many decimals the game's own setting takes
  const GAMES = [
    { id: 'cs2', name: 'Counter-Strike 2', yaw: 0.022, dp: 3, def: 1.25 },
    { id: 'apex', name: 'Apex Legends', yaw: 0.022, dp: 3, def: 1.5 },
    { id: 'ow2', name: 'Overwatch 2', yaw: 0.0066, dp: 2, def: 5 },
    { id: 'cod', name: 'Call of Duty', sub: 'MW, Warzone, BO6: Legacy setting', yaw: 0.0066, dp: 2, def: 5 },
    { id: 'fortnite', name: 'Fortnite', sub: 'X-axis, in %', yaw: 0.005555, dp: 1, unit: '%', def: 6.5 },
    { id: 'rivals', name: 'Marvel Rivals', yaw: 0.0175, dp: 2, def: 2 },
    // Ubisoft: hipfire yaw = input yaw x MouseSensitivityMultiplierUnit (0.02 by default) x sens
    { id: 'r6', name: 'Rainbow Six Siege', sub: 'Default multiplier 0.02, whole numbers only', yaw: 0.00572958, dp: 0, def: 10 },
    { id: 'tf2', name: 'Team Fortress 2', yaw: 0.022, dp: 3, def: 2 },
  ];
  const CM = 360 * 2.54;
  const $ = (id) => document.getElementById(id);
  const num = (v) => parseFloat(String(v).replace(',', '.'));
  const fix = (n, dp) => String(+n.toFixed(dp));

  // the maths, checked once on load (console only)
  const convert = (sens, from, to) => (sens * from.yaw) / to.yaw;
  const cm360 = (sens, game, dpi) => CM / (dpi * sens * game.yaw);
  console.assert(Math.abs(convert(1, GAMES[0], VAL) - 0.3142857) < 1e-6, 'cs2 -> valorant');
  console.assert(Math.abs(cm360(0.4, VAL, 800) - 40.821) < 1e-3, 'cm/360');

  const q = new URLSearchParams(location.search);
  let from = GAMES.find((g) => g.id === q.get('from')) || GAMES[0];
  const sensEl = $('snSens');
  const dpiEl = $('snDpi');
  const move = $('snMove');
  sensEl.value = num(q.get('sens')) > 0 ? q.get('sens') : from.def;
  dpiEl.value = num(q.get('dpi')) > 0 ? q.get('dpi') : 800;
  $('cbGames').textContent = GAMES.length;

  /* ---- game chips ---- */
  $('snGames').innerHTML = GAMES.map((g) => `<button type="button" data-id="${g.id}">${g.name}</button>`).join('');
  $('snGames').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    from = GAMES.find((g) => g.id === b.dataset.id);
    update();
  });

  /* ---- dial: a top-down turn; the cone = Valorant's 103 degree view ---- */
  const C = 120;
  const R = 100;
  const pt = (deg, r) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [(C + r * Math.cos(a)).toFixed(2), (C + r * Math.sin(a)).toFixed(2)];
  };
  const arc = (a0, a1, r) => {
    const [x0, y0] = pt(a0, r);
    const [x1, y1] = pt(a1, r);
    return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  $('snTicks').innerHTML = Array.from({ length: 24 }, (_, i) => {
    const big = i % 6 === 0;
    const [x0, y0] = pt(i * 15, R - (big ? 12 : 6));
    const [x1, y1] = pt(i * 15, R);
    return `<line class="${big ? 'sn-tick sn-tick--big' : 'sn-tick'}" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/>`;
  }).join('');

  let full = 0; // cm per 360 at the current settings
  function drawDial() {
    const cm = num(move.value);
    const deg = full ? (cm / full) * 360 : 0;
    const shown = deg % 360;
    const turns = Math.floor(deg / 360);
    const [x0, y0] = pt(shown - 51.5, 78);
    const [x1, y1] = pt(shown + 51.5, 78);
    $('snCone').setAttribute('d', `M${C} ${C}L${x0} ${y0}A78 78 0 0 1 ${x1} ${y1}Z`);
    // a full turn or more = the whole ring lit
    $('snArc').setAttribute('d', deg >= 360 ? arc(0, 359.99, R + 8) : deg > 0.5 ? arc(0, deg, R + 8) : '');
    $('snDeg').textContent = Math.round(deg) + '°';
    $('snMoveOut').textContent = fix(cm, 1) + ' cm';
    move.style.setProperty('--fill', (cm / num(move.max)) * 100 + '%');
    $('snDialSay').textContent = full
      ? `A ${fix(cm, 1)} cm swipe turns you ${Math.round(deg)}°` + (turns ? ` (${turns} full turn${turns > 1 ? 's' : ''} and ${Math.round(shown)}°)` : '') + '.'
      : 'Type your sensitivity and DPI to see your turn.';
    $('snQuick').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(full > 0 && Math.abs(deg - b.dataset.turn) < 1)));
  }
  move.addEventListener('input', drawDial);
  $('snQuick').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !full) return;
    const cm = (full * b.dataset.turn) / 360;
    if (cm > num(move.max)) move.max = Math.ceil(cm / 10) * 10;
    move.value = cm;
    drawDial();
  });

  /* ---- result + every game ---- */
  let valSens = 0;
  let urlTimer = 0;
  function update() {
    $('snGames').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === from.id)));
    $('snSensLab').textContent = from.unit ? `Sensitivity (${from.unit})` : 'Sensitivity';
    $('snNote').textContent = from.sub || '';
    const s = num(sensEl.value);
    const dpi = num(dpiEl.value);
    const ok = s > 0 && s < 10000 && dpi >= 50 && dpi <= 64000;
    $('snMsg').textContent = ok ? '' : !(s > 0 && s < 10000) ? 'Type a sensitivity above 0.' : 'Type a DPI between 50 and 64000.';
    valSens = ok ? convert(s, from, VAL) : 0;
    full = ok ? cm360(s, from, dpi) : 0;
    const dash = '–';
    $('snVal').textContent = ok ? fix(valSens, VAL.dp) : dash;
    $('snCm').textContent = ok ? fix(full, 1) : dash;
    $('snIn').textContent = ok ? fix(full / 2.54, 1) : dash;
    $('snEdpi').textContent = ok ? fix(valSens * dpi, 0) : dash;
    $('cbCm').textContent = ok ? fix(full, 1) + ' cm' : dash;

    // the slider reaches past a full turn, rounded to 10 cm
    const max = ok ? Math.min(Math.max(Math.ceil((full * 1.25) / 10) * 10, 20), 300) : 60;
    move.max = max;
    if (num(move.value) > max) move.value = max;
    drawDial();

    $('snList').innerHTML = [VAL, ...GAMES]
      .map((g) => {
        const v = ok ? fix(convert(valSens, VAL, g), g.dp) + (g.unit || '') : dash;
        const tag = g === from ? '<em class="sn-you">Yours</em>' : '';
        return `<div class="sn-row${g === VAL ? ' sn-row--val' : ''}"><span class="sn-name">${g.name}${tag}${g.sub ? `<small>${g.sub}</small>` : ''}</span><b class="sn-num">${v}</b><button type="button" class="xh-key" data-copy="${ok ? v.replace('%', '') : ''}"${ok ? '' : ' disabled'}>Copy</button></div>`;
      })
      .join('');

    clearTimeout(urlTimer);
    if (ok) urlTimer = setTimeout(() => history.replaceState(history.state, '', `?from=${from.id}&sens=${s}&dpi=${dpi}`), 250);
  }
  sensEl.addEventListener('input', update);
  dpiEl.addEventListener('input', update);
  $('snForm').addEventListener('submit', (e) => e.preventDefault());

  /* ---- copy ---- */
  function copy(text, btn) {
    const flash = () => {
      btn.classList.add('is-done');
      btn.textContent = 'Copied';
      setTimeout(() => {
        btn.classList.remove('is-done');
        btn.textContent = 'Copy';
      }, 1400);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(flash, () => ($('snMsg').textContent = 'Copy failed: select the number and copy it by hand.'));
    else $('snMsg').textContent = 'Copy failed: select the number and copy it by hand.';
  }
  $('snCopy').addEventListener('click', (e) => valSens && copy(fix(valSens, VAL.dp), e.currentTarget));
  $('snList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-copy]');
    if (b && b.dataset.copy) copy(b.dataset.copy, b);
  });

  update();
})();
