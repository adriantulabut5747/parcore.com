/* =======================================================================
   DAMAGE CALCULATOR (/coc/tools/damage-calculator) -- everything inside
   #damageCalc, built from coc-damage-calc.json (numbers from the Clash of
   Clans wiki). Two boxes:
   - Your attack (#dcAttack): one row per spell / equipment. Unused ones
     are a slim row with a +; used ones open up with their count, level and
     damage ("720 each · 2,160 total"). On phones the box docks above the
     bottom nav as a tray (#dcTray) and opens as a sheet.
   - Targets (#dcGrid): a card per building / hero: picture at its level
     (tap the Lv pill to change it), hitpoints left, a bar split by which
     attack took what, and a DESTROYED stamp when nothing is left. Tap the
     card's text to flip the picture to the breakdown.

   How the damage works (the wiki's rules, Oct 2026):
   - Lightning: flat damage per spell. Can't hit storages, the Town Hall or
     the Clan Castle.
   - Earthquake: a % of the target's MAX hitpoints. The 2nd quake on the
     same target does 1/3, the 3rd 1/5, the 4th 1/7 ... (1/(2n-1)). Can't
     hit storages. Heroes only take it from level 6 (its "hero %"), and
     never in the air (Minion Prince, Dragon Duke).
   - Fireball, Giant Arrow: one hit each; Giant Arrow does double damage to
     Air Defenses.
   - Spiky Ball, Seeking Shield: one hit per building they reach. Both go
     for defenses first, but any building takes the hit.
   - Rocket Spear: counted in throws (up to 10, by its level). Each throw
     hits for the Royal Champion's normal damage plus the spear's bonus;
     her level is the Town Hall's max.
   Every hit is a fixed number, so the order doesn't matter -- the total is
   the sum, capped at the target's hitpoints.
   ======================================================================= */
(function damageCalc() {
  'use strict';
  var root = document.getElementById('damageCalc');
  if (!root || !window.fetch) return;

  var UNIT_IMG = '/clashofclans/coctools/units/';
  var BUILDING_IMG = '/clashofclans/buildings/';
  var TH_MIN = 8;
  var MAX_SPELLS = 30;
  var SHIELD_TARGETS = 4; // the wiki: "The shield hits four different targets"
  var CATS = [
    { id: 'all', label: 'All' },
    { id: 'defense', label: 'Defenses' },
    { id: 'other', label: 'TH & storages' },
    { id: 'hero', label: 'Heroes' },
  ];
  // Each attack's share of a health bar: the series' red in steps, so the
  // bar stays one colour family and the hairline gaps tell the parts apart.
  var SHADE = {
    lightning: '#ef7b7b',
    earthquake: '#b94848',
    fireball: '#f2a08f',
    'giant-arrow': '#d65c5c',
    'spiky-ball': '#9e3a3a',
    'seeking-shield': '#e88a7a',
    'rocket-spear': '#c96a5e',
  };

  var data;
  var s = { th: 18, kit: {}, lv: {}, cat: 'all', q: '', sort: false, open: {}, lvOpen: null, sheet: false };
  var wasDead = {}; // which cards were destroyed last render -- the stamp only lands on new ones

  var $ = (sel) => root.querySelector(sel);
  var fmt = (n) => Math.round(n).toLocaleString('en-US');
  var pct1 = (n) => (Math.round(n * 10) / 10).toString();
  function esc(t) {
    return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
  function thIcon(th) {
    return '/icons/th' + th + 'icon.' + (th === 18 ? 'png' : 'webp');
  }
  var ICON = {
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    sort: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h5"/></svg>',
  };

  // ---- Levels ---------------------------------------------------------------
  // levels rows are [level, value, Town Hall, ...]; the highest level a Town
  // Hall allows is the last row whose Town Hall is at or below it.
  function maxAt(levels, th) {
    var best = 0;
    levels.forEach((r) => {
      if (r[2] <= th) best = r[0];
    });
    return best;
  }
  function row(levels, l) {
    return levels.filter((r) => r[0] === l)[0];
  }
  function heroTh(a) {
    return a.hero ? data.heroTh[a.hero.toLowerCase().replace(/ /g, '-')] || 0 : 0;
  }
  function attackOpen(a) {
    return maxAt(a.levels, s.th) > 0 && heroTh(a) <= s.th;
  }
  function targetOpen(t) {
    return t.levels[0][2] <= s.th;
  }
  function tLevel(t) {
    return s.lv[t.id] || maxAt(t.levels, s.th);
  }
  function kitOf(a) {
    return s.kit[a.id] || { l: maxAt(a.levels, s.th), n: 0 };
  }
  function used() {
    return data.attacks.filter((a) => attackOpen(a) && kitOf(a).n > 0);
  }
  function rcHit() {
    var rc = data.targets.filter((t) => t.id === 'royal-champion')[0];
    var r = data.rcHit.filter((x) => x[0] === maxAt(rc.levels, s.th))[0];
    return r ? r[1] : 0;
  }
  // How many of an attack you can bring: spells up to MAX_SPELLS, equipment
  // once -- except Rocket Spear, counted in throws (its level sets how many).
  function capOf(a, l) {
    if (a.kind === 'spell') return MAX_SPELLS;
    if (a.id === 'rocket-spear') return row(a.levels, l)[3];
    return 1;
  }

  // ---- Damage ---------------------------------------------------------------
  function hits(a, t) {
    switch (a.id) {
      case 'lightning':
        return t.cat !== 'resource' && t.id !== 'town-hall' && t.id !== 'clan-castle';
      case 'earthquake':
        return t.cat !== 'resource' && !(t.cat === 'hero' && t.air);
      // These aim at defenses first, but that's who they go for, not what
      // they can damage -- any building takes the hit.
      case 'spiky-ball':
      case 'seeking-shield':
      case 'rocket-spear':
        return t.cat !== 'hero';
      default:
        return true;
    }
  }
  // Earthquake's % per quake: full, then 1/3, 1/5, 1/7 ...
  function quakes(p, n) {
    var out = [];
    for (var k = 0; k < n; k++) out.push(p / (2 * k + 1));
    return out;
  }
  // What one attack (n of it, at level l) does to target t at hitpoints hp.
  function dealt(a, l, n, t, hp) {
    var r = row(a.levels, l);
    if (!r || !n || !hits(a, t)) return 0;
    if (a.id === 'earthquake') {
      var p = t.cat === 'hero' ? r[3] : r[1];
      return quakes(p, n).reduce((x, q) => x + (hp * q) / 100, 0);
    }
    if (a.id === 'giant-arrow' && t.id === 'air-defense') return r[1] * 2;
    if (a.id === 'rocket-spear') return n * (rcHit() + r[1]);
    return r[1] * n;
  }
  // Everything a card shows: hitpoints left, each attack's share (in kit
  // order, each capped by what was left), what couldn't hit, and overkill.
  function result(t) {
    var l = tLevel(t);
    var hp = row(t.levels, l)[1];
    var parts = [];
    var total = 0;
    var left = hp;
    var u = used();
    u.forEach((a) => {
      var k = kitOf(a);
      var d = dealt(a, k.l, k.n, t, hp);
      var shown = Math.min(d, left);
      left -= shown;
      total += d;
      parts.push({ a: a, n: k.n, d: d, shown: shown, blocked: !d });
    });
    var blocked = parts.filter((p) => p.blocked);
    return {
      l: l,
      hp: hp,
      left: Math.max(0, hp - total),
      over: Math.max(0, total - hp),
      dead: u.length > 0 && total >= hp - 0.5,
      immune: u.length > 0 && blocked.length === u.length,
      used: u.length,
      parts: parts,
    };
  }

  // ---- Town Hall picker (the army maker's chip + drop-down) -----------------
  function buildThs() {
    var ths = [];
    for (var n = 18; n >= TH_MIN; n--) ths.push(n);
    $('#dcThs').innerHTML =
      '<button type="button" class="am-th" id="dcThBtn" aria-haspopup="listbox" aria-expanded="false" aria-controls="dcThMenu" aria-label="Town Hall ' +
      s.th +
      ', change Town Hall"><img src="' +
      thIcon(s.th) +
      '" alt="" width="24" height="24">TH' +
      s.th +
      ICON.chev.replace('<svg', '<svg class="am-chev"') +
      '</button><div class="am-pop am-th-menu" id="dcThMenu" role="listbox" aria-label="Town Hall" hidden>' +
      ths
        .map(
          (n) =>
            '<button type="button" role="option" class="am-th-opt' +
            (n === s.th ? ' is-on' : '') +
            '" data-th="' +
            n +
            '" aria-selected="' +
            (n === s.th) +
            '"><img src="' +
            thIcon(n) +
            '" alt="" width="24" height="24"><span>Town Hall ' +
            n +
            '</span></button>',
        )
        .join('') +
      '</div>';
  }
  function thMenu(open) {
    var menu = $('#dcThMenu');
    if (!menu) return;
    if (open === undefined) open = menu.hidden;
    menu.hidden = !open;
    $('#dcThBtn').setAttribute('aria-expanded', open);
    if (open) (menu.querySelector('.is-on') || menu.firstChild).focus({ preventScroll: true });
  }
  // A new Town Hall resets every level to that Town Hall's max; how many of
  // each attack you're bringing stays.
  function setTh(n) {
    s.th = n;
    s.lv = {};
    s.lvOpen = null;
    data.attacks.forEach((a) => {
      var k = s.kit[a.id];
      if (!k) return;
      k.l = maxAt(a.levels, n) || k.l;
      k.n = Math.min(k.n, capOf(a, k.l));
    });
    wasDead = {};
    try {
      history.replaceState(null, '', '?th=' + n + location.hash);
    } catch (e) {}
    buildThs();
    renderAll(true);
  }

  // ---- 1. Your attack ---------------------------------------------------------
  function stepper(kind, id, label, value, canDown, canUp, cls) {
    return (
      '<span class="dc-step' +
      (cls ? ' ' + cls : '') +
      '" role="group" aria-label="' +
      esc(label) +
      '"><button type="button" data-' +
      kind +
      '="-1" data-id="' +
      id +
      '" aria-label="Lower ' +
      esc(label) +
      '"' +
      (canDown ? '' : ' disabled') +
      '>' +
      ICON.minus +
      '</button><output>' +
      value +
      '</output><button type="button" data-' +
      kind +
      '="1" data-id="' +
      id +
      '" aria-label="Raise ' +
      esc(label) +
      '"' +
      (canUp ? '' : ' disabled') +
      '>' +
      ICON.plus +
      '</button></span>'
    );
  }
  // The damage line under a used attack's name: what one does, and the
  // total once there's more than one. Earthquake shows its falling shares.
  function damageLine(a, k) {
    var r = row(a.levels, k.l);
    var n = k.n;
    switch (a.id) {
      case 'lightning':
        return n > 1 ? '<b>' + fmt(r[1] * n) + '</b> total <i>&middot;</i> ' + fmt(r[1]) + ' each' : '<b>' + fmt(r[1]) + '</b> damage';
      case 'earthquake': {
        if (n < 2) return '<b>' + pct1(r[1]) + '%</b> of max hitpoints';
        var q = quakes(r[1], n);
        var shown = q.slice(0, 4).map(pct1).join(' + ') + (n > 4 ? ' + &hellip;' : '');
        return '<b>' + pct1(q.reduce((x, y) => x + y, 0)) + '%</b> total <i>&middot;</i> ' + shown;
      }
      case 'rocket-spear': {
        var per = rcHit() + r[1];
        return n > 1 ? '<b>' + fmt(per * n) + '</b> total <i>&middot;</i> ' + fmt(per) + ' a throw' : '<b>' + fmt(per) + '</b> a throw';
      }
      case 'giant-arrow':
        return '<b>' + fmt(r[1]) + '</b> damage <i>&middot;</i> double on Air Defense';
      case 'spiky-ball':
        return '<b>' + fmt(r[1]) + '</b> a building <i>&middot;</i> bounces to ' + r[3];
      case 'seeking-shield':
        return '<b>' + fmt(r[1]) + '</b> a target <i>&middot;</i> hits ' + SHIELD_TARGETS;
      default:
        return '<b>' + fmt(r[1]) + '</b> damage';
    }
  }
  // What one of it does, for the slim (unused) row.
  function brief(a, k) {
    var r = row(a.levels, k.l);
    if (a.id === 'earthquake') return pct1(r[1]) + '%';
    if (a.id === 'rocket-spear') return fmt(rcHit() + r[1]) + ' a throw';
    return fmt(r[1]);
  }
  function kitRow(a) {
    var k = kitOf(a);
    var top = maxAt(a.levels, s.th);
    var cap = capOf(a, k.l);
    var on = k.n > 0;
    var tile =
      '<span class="as-tile dc-kit-tile"><img src="' +
      UNIT_IMG +
      esc(a.img) +
      '" alt="" width="48" height="48" loading="lazy">' +
      (on ? '<span class="as-n">&times;' + k.n + '</span>' : '') +
      '</span>';
    var who = a.hero ? '<span class="dc-kit-hero">' + esc(a.hero) + '</span>' : '<span class="dc-kit-hero">Spell</span>';
    if (!on) {
      return (
        '<li class="dc-kit-row" data-a="' +
        a.id +
        '">' +
        tile +
        '<span class="dc-kit-text"><span class="dc-kit-name">' +
        esc(a.name) +
        '</span>' +
        who +
        '</span><span class="dc-kit-brief">' +
        brief(a, k) +
        '</span><button type="button" class="dc-add" data-cnt="1" data-id="' +
        a.id +
        '" aria-label="Add ' +
        esc(a.name) +
        '">' +
        ICON.plus +
        '</button></li>'
      );
    }
    return (
      '<li class="dc-kit-row is-on" data-a="' +
      a.id +
      '">' +
      tile +
      '<span class="dc-kit-text"><span class="dc-kit-name">' +
      esc(a.name) +
      '</span>' +
      who +
      '</span>' +
      stepper('cnt', a.id, 'number of ' + a.name, k.n, true, k.n < cap, 'dc-step-count') +
      '<span class="dc-kit-dmg">' +
      damageLine(a, k) +
      '</span>' +
      stepper('lvl', a.id, a.name + ' level', 'Lv ' + k.l, k.l > 1, k.l < top, 'dc-step-level') +
      '</li>'
    );
  }
  function renderKit() {
    var open = data.attacks.filter(attackOpen);
    var locked = data.attacks.filter((a) => !attackOpen(a));
    $('#dcKit').innerHTML = '<ul class="dc-kit-list">' + open.map(kitRow).join('') + '</ul>';
    var lk = $('#dcLocked');
    lk.hidden = !locked.length;
    lk.innerHTML = locked.length
      ? 'Unlocks later: ' + locked.map((a) => esc(a.name) + ' <span>TH' + Math.max(a.levels[0][2], heroTh(a)) + '</span>').join(', ')
      : '';
    $('#dcClear').hidden = !used().length;
    renderTray();
  }
  // Phone tray: the attack at a glance (tiles + counts) and the tally.
  function renderTray() {
    var u = used();
    var tiles = u.length
      ? '<span class="dc-tray-tiles">' +
        u
          .map(
            (a) =>
              '<span class="as-tile"><img src="' +
              UNIT_IMG +
              esc(a.img) +
              '" alt="" width="32" height="32"><span class="as-n">&times;' +
              kitOf(a).n +
              '</span></span>',
          )
          .join('') +
        '</span>'
      : '<span class="dc-tray-empty">Add spells and equipment</span>';
    $('#dcTray').innerHTML =
      '<span class="dc-tray-label">Your attack</span>' +
      tiles +
      '<span class="dc-tray-score">' +
      tally(true) +
      '</span><span class="dc-tray-chev">' +
      ICON.up +
      '</span>';
    $('#dcTray').setAttribute(
      'aria-label',
      'Your attack: ' + (u.length ? u.map((a) => kitOf(a).n + ' ' + a.name).join(', ') : 'empty') + '. Edit',
    );
  }
  function tally(short) {
    var all = data.targets.filter(targetOpen);
    if (!used().length) return short ? '' : 'Nothing destroyed yet';
    var dead = all.filter((t) => result(t).dead).length;
    return short ? '<b>' + dead + '</b>/' + all.length : '<b>' + dead + '</b> of ' + all.length + ' destroyed';
  }

  // ---- 2. Targets ---------------------------------------------------------------
  function pic(t, l) {
    return t.cat === 'hero' ? UNIT_IMG + t.id + '.webp' : BUILDING_IMG + t.id + '/' + l + '.webp';
  }
  function meter(r) {
    var segs = r.parts
      .filter((p) => p.shown > 0)
      .map((p) => '<s style="--w:' + ((p.shown / r.hp) * 100).toFixed(2) + '%;--c:' + SHADE[p.a.id] + '"></s>')
      .join('');
    return '<span class="dc-meter" aria-hidden="true"><i style="--w:' + ((r.left / r.hp) * 100).toFixed(2) + '%"></i>' + segs + '</span>';
  }
  function breakdown(t, r) {
    var rows = r.parts
      .map(
        (p) =>
          '<li' +
          (p.blocked ? ' class="is-blocked"' : '') +
          '><span class="dc-bd-sw" style="--c:' +
          SHADE[p.a.id] +
          '"></span><span class="dc-bd-name">' +
          esc(p.a.name) +
          (p.n > 1 ? ' &times;' + p.n : '') +
          '</span><span class="dc-bd-val">' +
          (p.blocked ? 'can&rsquo;t hit' : '&minus;' + fmt(p.d)) +
          '</span></li>',
      )
      .join('');
    return (
      '<div class="dc-bd" id="dcBd-' +
      t.id +
      '"><ul>' +
      (rows || '<li class="is-empty">No attack yet. Add a spell to see what it does here.</li>') +
      '</ul>' +
      (r.used ? '<p class="dc-bd-total"><span>Total</span><b>' + fmt(r.hp - r.left + r.over) + '</b></p>' : '') +
      '</div>'
    );
  }
  function card(t) {
    var r = result(t);
    var top = maxAt(t.levels, s.th);
    var open = !!s.open[t.id];
    var lvOpen = s.lvOpen === t.id;
    var fresh = r.dead && !wasDead[t.id];
    var status;
    if (r.dead) status = r.over >= 1 ? fmt(r.over) + ' to spare' : 'Exactly enough';
    else if (!r.used) status = 'Full health';
    else if (r.immune) status = 'Your attack can&rsquo;t hit this';
    // Floored and held under 100, so a building with HP left never reads 100%.
    else status = Math.min(99, Math.floor(((r.hp - r.left) / r.hp) * 100)) + '% damage';
    var lv = lvOpen
      ? stepper('tlv', t.id, t.name + ' level', 'Lv ' + r.l, r.l > 1, r.l < top, 'dc-lv-step')
      : '<button type="button" class="dc-lv" data-lvpill="' +
        t.id +
        '" aria-label="' +
        esc(t.name) +
        ' level ' +
        r.l +
        ', change level"' +
        (top <= 1 ? ' disabled' : '') +
        '>Lv ' +
        r.l +
        (top > 1 ? ICON.chev : '') +
        '</button>';
    return (
      '<article class="dc-card' +
      (r.dead ? ' is-dead' : '') +
      (fresh ? ' is-fresh' : '') +
      (r.immune ? ' is-immune' : '') +
      (open ? ' is-open' : '') +
      (t.cat === 'hero' ? ' is-hero' : '') +
      '" data-t="' +
      t.id +
      '">' +
      '<div class="dc-pic">' +
      '<img src="' +
      pic(t, r.l) +
      '" alt="" width="200" height="200" loading="lazy" decoding="async">' +
      (r.dead ? '<span class="dc-stamp" aria-hidden="true"><span>' + (t.cat === 'hero' ? 'Killed' : 'Destroyed') + '</span></span>' : '') +
      (open ? breakdown(t, r) : '') +
      lv +
      '</div>' +
      '<button type="button" class="dc-info" data-info="' +
      t.id +
      '" aria-expanded="' +
      open +
      '" aria-label="' +
      esc(t.name) +
      ', ' +
      (r.dead ? (t.cat === 'hero' ? 'killed' : 'destroyed') : fmt(r.left) + ' of ' + fmt(r.hp) + ' hitpoints left') +
      '. ' +
      (open ? 'Hide' : 'Show') +
      ' breakdown">' +
      '<span class="dc-name">' +
      esc(t.name) +
      '<span class="dc-info-ico">' +
      (open ? ICON.close : ICON.list) +
      '</span></span>' +
      '<span class="dc-hp"><b>' +
      fmt(r.left) +
      '</b><span>/ ' +
      fmt(r.hp) +
      '</span></span>' +
      meter(r) +
      '<span class="dc-st">' +
      status +
      '</span>' +
      '</button></article>'
    );
  }
  function list() {
    var q = s.q.trim().toLowerCase();
    var out = data.targets.filter((t) => {
      if (!targetOpen(t)) return false;
      if (s.cat === 'defense' && t.cat !== 'defense') return false;
      if (s.cat === 'other' && t.cat !== 'other' && t.cat !== 'resource') return false;
      if (s.cat === 'hero' && t.cat !== 'hero') return false;
      return !q || t.name.toLowerCase().indexOf(q) !== -1;
    });
    if (s.sort && used().length) {
      var left = {};
      out.forEach((t) => {
        var r = result(t);
        left[t.id] = r.left / r.hp;
      });
      out.sort((x, y) => left[x.id] - left[y.id]);
    }
    return out;
  }
  function renderGrid() {
    var ts = list();
    var grid = $('#dcGrid');
    grid.innerHTML = ts.length
      ? ts.map(card).join('')
      : '<p class="dc-empty">No building called &ldquo;' + esc(s.q.trim()) + '&rdquo;. Try part of the name, like &ldquo;tower&rdquo;.</p>';
    grid.removeAttribute('aria-busy');
    // Remember who's down now, so only a newly destroyed card gets the stamp.
    wasDead = {};
    data.targets.forEach((t) => {
      if (targetOpen(t) && result(t).dead) wasDead[t.id] = true;
    });
    $('#dcTally').innerHTML = tally(false);
    var sort = $('#dcSort');
    sort.setAttribute('aria-pressed', s.sort);
    sort.disabled = !used().length;
    sort.innerHTML = ICON.sort + '<span>Most damaged</span>';
  }
  function renderCats() {
    $('#dcCats').innerHTML = CATS.map(
      (c) =>
        '<button type="button" class="am-tab' +
        (c.id === s.cat ? ' active' : '') +
        '" role="tab" aria-selected="' +
        (c.id === s.cat) +
        '" data-cat="' +
        c.id +
        '">' +
        c.label +
        '</button>',
    ).join('');
  }
  // quiet: a Town Hall change resets every card, so no stamps fly in.
  function renderAll(quiet) {
    if (quiet) {
      data.targets.forEach((t) => {
        if (targetOpen(t) && result(t).dead) wasDead[t.id] = true;
      });
    }
    renderKit();
    renderGrid();
  }

  // ---- Phone sheet ----------------------------------------------------------------
  function sheet(open) {
    s.sheet = open;
    root.classList.toggle('is-sheet', open);
    $('#dcTray').setAttribute('aria-expanded', open);
    $('#dcScrim').hidden = !open;
    document.documentElement.classList.toggle('dc-lock', open);
  }

  // ---- Events -------------------------------------------------------------------
  function refocus(sel) {
    var x = $(sel);
    if (x && !x.disabled) x.focus({ preventScroll: true });
  }
  root.addEventListener('click', function (e) {
    if (e.target.id === 'dcScrim') return sheet(false);
    var b = e.target.closest('button');
    if (!b || !root.contains(b) || b.disabled) return;
    if (b.id === 'dcTray') return sheet(!s.sheet);
    if (b.id === 'dcThBtn') return thMenu();
    if (b.classList.contains('am-th-opt')) {
      thMenu(false);
      var n = +b.dataset.th;
      if (n !== s.th) setTh(n);
      return refocus('#dcThBtn');
    }
    if (b.id === 'dcClear') {
      s.kit = {};
      wasDead = {};
      return renderAll();
    }
    if (b.id === 'dcSort') {
      s.sort = !s.sort;
      return renderGrid();
    }
    if (b.dataset.cat) {
      s.cat = b.dataset.cat;
      renderCats();
      renderGrid();
      return refocus('[data-cat="' + s.cat + '"]');
    }
    var id = b.dataset.id;
    if (b.dataset.lvl || b.dataset.cnt) {
      var a = data.attacks.filter((x) => x.id === id)[0];
      var k = s.kit[a.id] || (s.kit[a.id] = { l: maxAt(a.levels, s.th), n: 0 });
      var dir = +(b.dataset.lvl || b.dataset.cnt);
      if (b.dataset.lvl) k.l = Math.max(1, Math.min(maxAt(a.levels, s.th), k.l + dir));
      else k.n += dir;
      k.n = Math.max(0, Math.min(capOf(a, k.l), k.n));
      renderKit();
      renderGrid();
      // Pop the tile when the count goes up -- the one bit of feedback in the kit.
      if (b.dataset.cnt && dir > 0) {
        var tile = $('[data-a="' + id + '"] .dc-kit-tile');
        if (tile) tile.classList.add('is-bump');
      }
      var kind = b.dataset.lvl ? 'lvl' : 'cnt';
      return refocus(
        '[data-id="' + id + '"][data-' + kind + '="' + dir + '"]:not([disabled])' + (k.n ? '' : ', .dc-add[data-id="' + id + '"]'),
      );
    }
    if (b.dataset.lvpill) {
      s.lvOpen = b.dataset.lvpill;
      renderGrid();
      return refocus('[data-tlv="1"][data-id="' + s.lvOpen + '"], [data-tlv="-1"][data-id="' + s.lvOpen + '"]');
    }
    if (b.dataset.tlv) {
      var t = data.targets.filter((x) => x.id === id)[0];
      s.lv[id] = Math.max(1, Math.min(maxAt(t.levels, s.th), tLevel(t) + +b.dataset.tlv));
      renderAll();
      return refocus('[data-id="' + id + '"][data-tlv="' + b.dataset.tlv + '"]');
    }
    if (b.dataset.info) {
      s.open[b.dataset.info] = !s.open[b.dataset.info];
      renderGrid();
      return refocus('[data-info="' + b.dataset.info + '"]');
    }
  });
  // Clicking anywhere else closes the Town Hall list and an open level pill.
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#dcThs')) thMenu(false);
    if (s.lvOpen && !e.target.closest('.dc-lv-step, .dc-lv')) {
      s.lvOpen = null;
      renderGrid();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if ($('#dcThMenu') && !$('#dcThMenu').hidden) {
      thMenu(false);
      return refocus('#dcThBtn');
    }
    if (s.lvOpen) {
      var id = s.lvOpen;
      s.lvOpen = null;
      renderGrid();
      return refocus('[data-lvpill="' + id + '"]');
    }
    if (s.sheet) {
      sheet(false);
      refocus('#dcTray');
    }
  });
  root.addEventListener('animationend', function (e) {
    if (e.target.classList.contains('dc-kit-tile')) e.target.classList.remove('is-bump');
  });

  // Press and hold a − / + to keep stepping (hero levels go up to 110).
  // Every step re-renders, so the held button is found again by its data-*.
  var hold = 0;
  function stopHold() {
    clearTimeout(hold);
    clearInterval(hold);
    hold = 0;
  }
  root.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('.dc-step button');
    if (!b || b.disabled) return;
    var key = ['lvl', 'cnt', 'tlv'].filter((k) => b.dataset[k])[0];
    var sel = '[data-id="' + b.dataset.id + '"][data-' + key + '="' + b.dataset[key] + '"]';
    stopHold();
    hold = setTimeout(function () {
      hold = setInterval(function () {
        var x = $(sel);
        if (!x || x.disabled) return stopHold();
        x.click();
      }, 70);
    }, 400);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => root.addEventListener(ev, stopHold));

  $('#dcSearch').addEventListener('input', function (e) {
    s.q = e.target.value;
    renderGrid();
  });

  // Phone nav: the maker pages light "Tools" in the tabs under the hero and
  // in the bottom bar.
  function markTools() {
    var bn = document.querySelector('.bn-item[data-role="bn-guides"]');
    if (bn) bn.classList.add('active');
    document.querySelectorAll('.first-layer button').forEach((x) => x.classList.toggle('active', x.textContent.trim() === 'Tools'));
  }
  markTools();
  document.addEventListener('parchome:coc-nav-ready', markTools);

  fetch('/coc-damage-calc.json')
    .then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function (d) {
      data = d;
      var q = parseInt(new URLSearchParams(location.search).get('th'), 10);
      if (q >= TH_MIN && q <= 18) s.th = q;
      $('#dcFoot').textContent =
        'Numbers from the Clash of Clans wiki, updated ' +
        new Date(d.updated + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) +
        '. Earthquakes take a share of max hitpoints, and each extra quake on the same target does less (1/3, 1/5, 1/7 ...). ' +
        'Lightning and Earthquake can’t damage storages; Lightning also can’t hit the Town Hall or Clan Castle. ' +
        'Giant Arrow does double damage to Air Defenses. Spiky Ball, Seeking Shield and Rocket Spear hit buildings, not heroes. ' +
        'Rocket Spear is counted in throws, using the Royal Champion’s max level for the Town Hall.';
      buildThs();
      renderCats();
      renderAll(true);
      root.classList.add('is-ready');
    })
    .catch(function () {
      $('#dcGrid').innerHTML = '<p class="dc-empty">The calculator didn&rsquo;t load. Check your connection and refresh the page.</p>';
    });
})();
