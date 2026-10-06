/* =======================================================================
   ARMY MAKER (/coc/tools/army-maker) -- builds a Clash of Clans "Copy Army"
   link from the troops, spells, heroes and clan castle units you pick:
   tap a row of "Your army" to open its tray of units (see Unit trays).

   How the link works: everything is in its army= code, one letter per
   section, each followed by the units in it:
     h  heroes      0p9e32_14  = hero 0 (King), pet 9 (Frosty), equipment
                    32 and 14. A Warden in air mode carries "m1" after his id.
     i  CC troops   3x5-1x177  = 3 of unit 5 (Balloon), 1 of 177 (Meteor Golem)
     d  CC spells   same "count x id" list
     u  troops      (siege machines go in here too)
     s  spells
   Nothing is looked up online: the ids come from coc-army-data.json, which
   also holds each Town Hall's camp / spell / clan castle space and what it
   has unlocked. Every link in the thNN-army.json files decodes with those
   ids, which is how they were checked.

   The army lives in the address bar (?th=18&army=...), so refreshing keeps
   it and the address itself is the shareable link to this page.
   ======================================================================= */
(function armyMaker() {
  'use strict';
  var root = document.getElementById('armyMaker');
  if (!root || !window.fetch) return;

  var GAME_LINK = 'https://link.clashofclans.com/en?action=CopyArmy&army=';
  var SUPER_MAX = 2; // different super troops boosted at once (game rule)

  var data; // coc-army-data.json
  var TH; // the chosen Town Hall's limits (data.townHalls[th])
  var byId = { troop: {}, spell: {}, hero: {}, pet: {}, equip: {} };

  // The army. Maps keep the order units were added in; the link lists
  // them in data order instead (see code()).
  var s = {
    th: 18,
    troops: new Map(), // id -> count (siege machines included)
    spells: new Map(),
    heroes: new Map(), // hero id -> { pet: id|null, eq: [ids], air: bool }
    ccTroops: new Map(),
    ccSpells: new Map(),
  };

  var $ = function (sel, el) {
    return (el || root).querySelector(sel);
  };
  var $$ = function (sel, el) {
    return [].slice.call((el || root).querySelectorAll(sel));
  };
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function img(u) {
    return data.imageDir + u.img;
  }

  // ---- Counting ---------------------------------------------------------
  function sum(map, fn) {
    var n = 0;
    map.forEach(function (count, id) {
      n += fn(count, id);
    });
    return n;
  }
  function used() {
    var T = byId.troop;
    var S = byId.spell;
    return {
      troops: sum(s.troops, (c, id) => (T[id].siege ? 0 : c * T[id].space)),
      sieges: sum(s.troops, (c, id) => (T[id].siege ? c : 0)),
      supers: sum(s.troops, (c, id) => (T[id].super ? 1 : 0)),
      spells: sum(s.spells, (c, id) => c * S[id].space),
      heroes: s.heroes.size,
      ccTroops: sum(s.ccTroops, (c, id) => (T[id].siege ? 0 : c * T[id].space)),
      ccSieges: sum(s.ccTroops, (c, id) => (T[id].siege ? c : 0)),
      ccSpells: sum(s.ccSpells, (c, id) => c * S[id].space),
    };
  }

  // Why a unit can't be added right now, or '' if it can.
  function blocked(kind, id, u) {
    u = u || used();
    var t = byId.troop[id];
    var sp = byId.spell[id];
    if (kind === 'troop') {
      if (t.siege) return u.sieges >= TH.sieges ? 'Siege machines are full (' + TH.sieges + '/' + TH.sieges + ')' : '';
      if (t.super && !s.troops.has(id) && u.supers >= SUPER_MAX) return 'Only ' + SUPER_MAX + ' super troops at a time';
      return u.troops + t.space > TH.troops ? 'Not enough camp space for a ' + t.name + ' (' + t.space + ')' : '';
    }
    if (kind === 'spell') return u.spells + sp.space > TH.spells ? 'Not enough spell space for ' + sp.name + ' (' + sp.space + ')' : '';
    if (kind === 'ccTroop') {
      if (t.siege) return u.ccSieges >= TH.cc.sieges ? 'Clan castle siege slots are full' : '';
      return u.ccTroops + t.space > TH.cc.troops ? 'Not enough clan castle space for a ' + t.name : '';
    }
    if (kind === 'ccSpell') return u.ccSpells + sp.space > TH.cc.spells ? 'Not enough clan castle spell space' : '';
    return '';
  }

  var MAP = { troop: 'troops', spell: 'spells', ccTroop: 'ccTroops', ccSpell: 'ccSpells' };
  function add(kind, id) {
    var why = blocked(kind, id);
    if (why) return toast(why);
    var m = s[MAP[kind]];
    m.set(id, (m.get(id) || 0) + 1);
    changed();
  }
  function remove(kind, id) {
    var m = s[MAP[kind]];
    var n = (m.get(id) || 0) - 1;
    if (n > 0) m.set(id, n);
    else m.delete(id);
    changed();
  }

  // ---- The link ---------------------------------------------------------
  // Sections in the game's own order (h i d u s), units in data order.
  function list(map, units) {
    return units
      .filter((x) => map.has(x.id))
      .map((x) => map.get(x.id) + 'x' + x.id)
      .join('-');
  }
  function code() {
    var troopsAndSieges = data.troops.concat(data.sieges);
    var h = data.heroes
      .filter((x) => s.heroes.has(x.id))
      .map(function (x) {
        var a = s.heroes.get(x.id);
        return x.id + (x.modes && a.air ? 'm1' : '') + (a.pet != null ? 'p' + a.pet : '') + (a.eq.length ? 'e' + a.eq.join('_') : '');
      })
      .join('-');
    var parts = [
      ['h', h],
      ['i', list(s.ccTroops, troopsAndSieges)],
      ['d', list(s.ccSpells, data.spells)],
      ['u', list(s.troops, troopsAndSieges)],
      ['s', list(s.spells, data.spells)],
    ];
    return parts
      .filter((p) => p[1])
      .map((p) => p[0] + p[1])
      .join('');
  }

  // Reads an army code (or a whole Copy Army / army maker link) into the
  // current Town Hall. Returns the names of anything it had to leave out.
  function load(text) {
    var m = String(text).match(/[?&]army=([^&#\s]+)/);
    var armyCode = decodeURIComponent(m ? m[1] : String(text).trim());
    if (!/^[hidus][0-9hidusmpex_-]*$/.test(armyCode)) return null;
    ['troops', 'spells', 'heroes', 'ccTroops', 'ccSpells'].forEach((k) => s[k].clear());
    var skipped = [];
    var re = /([hidus])([^hidus]*)/g;
    var sec;
    while ((sec = re.exec(armyCode))) {
      var key = sec[1];
      sec[2]
        .split('-')
        .filter(Boolean)
        .forEach(function (part) {
          if (key === 'h') return loadHero(part, skipped);
          var nx = part.split('x');
          var n = parseInt(nx[0], 10);
          var id = parseInt(nx[1], 10);
          var spell = key === 'd' || key === 's';
          var cc = key === 'i' || key === 'd';
          var u = (spell ? byId.spell : byId.troop)[id];
          if (!u || !(n > 0)) return skipped.push('unknown unit ' + id);
          var from = cc ? u.ccTh : u.th;
          if (from == null || from > s.th) return skipped.push(u.name);
          var map = s[cc ? (spell ? 'ccSpells' : 'ccTroops') : spell ? 'spells' : 'troops'];
          map.set(id, (map.get(id) || 0) + n);
        });
    }
    return skipped;
  }
  function loadHero(part, skipped) {
    var g = part.match(/^(\d+)(?:m(\d+))?(?:p(\d+))?(?:e(\d+)(?:_(\d+))?)?$/);
    var h = g && byId.hero[g[1]];
    if (!h) return skipped.push('unknown hero ' + part);
    if (h.th > s.th) return skipped.push(h.name);
    var a = { pet: null, eq: [], air: g[2] === '1' };
    var pet = g[3] != null && byId.pet[g[3]];
    if (pet && pet.th <= s.th) a.pet = pet.id;
    else if (g[3] != null) skipped.push(pet ? pet.name : 'unknown pet ' + g[3]);
    [g[4], g[5]].forEach(function (e) {
      if (e == null) return;
      var q = byId.equip[e];
      if (q && q.hero === h.id && q.th <= s.th) a.eq.push(q.id);
      else skipped.push(q ? q.name : 'unknown equipment ' + e);
    });
    s.heroes.set(h.id, a);
  }

  // ---- Building the panels ----------------------------------------------
  function tile(kind, u, extra) {
    // No housing number on the tile (it cluttered them); screen readers still get it.
    var space = u.siege || kind === 'hero' ? '' : ', ' + u.space + ' space';
    return (
      '<button type="button" class="am-tile' +
      (u.super ? ' is-super' : '') +
      (extra || '') +
      '" data-kind="' +
      kind +
      '" data-id="' +
      u.id +
      '" title="' +
      esc(u.name) +
      '"><img src="' +
      esc(img(u)) +
      '" alt="" width="128" height="128" loading="lazy" decoding="async">' +
      '<span class="am-count" aria-hidden="true"></span><span class="am-vh">' +
      esc(u.name) +
      space +
      '</span></button>'
    );
  }
  function group(title, meterKey, kind, units, filterKey) {
    var avail = units.filter((u) => u[filterKey] != null && u[filterKey] <= s.th);
    if (!avail.length) return '';
    return (
      '<div class="am-group"><div class="am-group-head"><h3 class="am-group-title">' +
      title +
      '</h3>' +
      (meterKey ? '<span class="am-group-meter" data-meter="' + meterKey + '"></span>' : '') +
      '</div><div class="am-grid">' +
      avail.map((u) => tile(kind, u)).join('') +
      '</div></div>'
    );
  }

  // ---- Unit trays ---------------------------------------------------------
  // Tapping a row of the army sheet (Troops / Spells / Siege / Clan Castle)
  // opens a tray along the bottom of the screen with what can go in that
  // row: tap a unit to add one, hold it to keep adding. The row stays
  // lit while the rest of the builder dims, and its units get a remove
  // badge (tap = one less, hold = keep removing). Heroes, pets and
  // equipment still use the picker modal below.
  // cls: the sheet group the row is drawn as (th-layouts.js ArmySheet).
  var ROWS = {
    troops: { cls: 'as-troops', title: 'Troops', meter: 'troops' },
    spells: { cls: 'as-spells', title: 'Spells', meter: 'spells' },
    sieges: { cls: 'as-sieges', title: 'Siege machines', meter: 'sieges' },
    cc: { cls: 'as-cc', title: 'Clan Castle', meter: 'cc' },
  };
  function trayBody(row) {
    var T = data.troops;
    if (row === 'troops') {
      // Elixir and dark troops in one group: elixir first, then dark.
      var regular = T.filter((u) => !u.dark && !u.super).concat(T.filter((u) => u.dark && !u.super));
      return group('Troops', '', 'troop', regular, 'th') + group('Super troops', 'supers', 'troop', T.filter((u) => u.super), 'th');
    }
    if (row === 'sieges') return group('Siege machines', '', 'troop', data.sieges, 'th');
    if (row === 'spells')
      return (
        group(
          'Elixir spells',
          '',
          'spell',
          data.spells.filter((u) => !u.dark),
          'th',
        ) +
        group(
          'Dark spells',
          '',
          'spell',
          data.spells.filter((u) => u.dark),
          'th',
        )
      );
    return (
      group('Troops', 'ccTroops', 'ccTroop', T, 'ccTh') +
      group('Spells', 'ccSpells', 'ccSpell', data.spells, 'ccTh') +
      group('Siege machines', 'ccSieges', 'ccTroop', data.sieges, 'ccTh')
    );
  }

  // Town Hall picker: the current TH as a chip with a ▾, and a drop-down
  // listing every Town Hall. The ones not in enabledTh yet are shown with
  // "Soon" and can't be picked.
  var CHEVRON = '<svg class="am-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  function buildThs() {
    var ths = Object.keys(data.townHalls)
      .map(Number)
      .sort((a, b) => b - a);
    $('#amThs').innerHTML =
      '<button type="button" class="am-th" id="amThBtn" aria-haspopup="listbox" aria-expanded="false" aria-controls="amThMenu" aria-label="Town Hall ' +
      s.th +
      ', change Town Hall"><img src="' +
      esc(data.townHalls[s.th].icon) +
      '" alt="" width="24" height="24">TH' +
      s.th +
      CHEVRON +
      '</button><div class="am-pop am-th-menu" id="amThMenu" role="listbox" aria-label="Town Hall" hidden>' +
      ths
        .map(function (n) {
          var on = data.enabledTh.indexOf(n) !== -1;
          return (
            '<button type="button" role="option" class="am-th-opt' +
            (n === s.th ? ' is-on' : '') +
            '" data-th="' +
            n +
            '" aria-selected="' +
            (n === s.th) +
            '"' +
            (on ? '' : ' aria-disabled="true"') +
            '><img src="' +
            esc(data.townHalls[n].icon) +
            '" alt="" width="24" height="24"><span>Town Hall ' +
            n +
            '</span>' +
            (on ? '' : '<em>Soon</em>') +
            '</button>'
          );
        })
        .join('') +
      '</div>';
  }
  function thMenu(open) {
    var menu = $('#amThMenu');
    var btn = $('#amThBtn');
    if (!menu) return;
    if (open === undefined) open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open);
    if (open) (menu.querySelector('.is-on') || menu.firstChild).focus({ preventScroll: true });
  }

  // The phone breadcrumb's "Armies" link (secondary top bar) goes to the
  // army comps of the Town Hall picked here.
  function updateJumps() {
    document.querySelectorAll('[data-jump]').forEach(function (a) {
      var army = a.dataset.jump === 'army';
      a.href = '/coc/town-hall-' + s.th + (army ? '/army' : '/layouts');
      var t = a.querySelector('.am-btn-text');
      if (t) t.textContent = 'TH' + s.th + (army ? ' army comps' : ' base layouts');
    });
  }

  // ---- Picker modal (a hero, or one hero's pet / equipment) -----------------
  // Opened from the army sheet: an empty hero slot or a hero's portrait
  // (slot 'hero'), or a pet / equipment box. It lists what can go there;
  // tapping one puts it in and closes the modal.
  var picking = null; // { hero: id|null, slot: 'hero' | 'pet' | 'eq0' | 'eq1' }
  var modal = document.createElement('div');
  modal.className = 'am-modal';
  modal.hidden = true;
  modal.innerHTML = '<div class="am-modal-box" id="amPicker" role="dialog" aria-modal="true" aria-labelledby="amPickerTitle"></div>';
  document.body.appendChild(modal);
  var lastFocus = null;
  function optHtml(o, on, taken, title) {
    return (
      '<button type="button" class="am-tile am-opt' +
      (o.epic != null && o.hero != null ? (o.epic ? ' am-epic' : ' am-common') : '') +
      (on ? ' is-on' : '') +
      (taken ? ' is-taken' : '') +
      '" data-pick="' +
      o.id +
      '" title="' +
      esc(title || o.name) +
      '"><img src="' +
      esc(img(o)) +
      '" alt="" width="128" height="128" loading="lazy" decoding="async"><span class="am-opt-name">' +
      esc(o.name) +
      '</span></button>'
    );
  }
  function openPicker(heroId, which) {
    picking = { hero: heroId, slot: which };
    var a = heroId != null ? s.heroes.get(heroId) : null;
    var h = heroId != null ? byId.hero[heroId] : null;
    var title,
      opts,
      current,
      note = '';
    if (which === 'hero') {
      current = heroId;
      title = h ? 'Change hero' : 'Add a hero';
      opts = data.heroes
        .filter((x) => x.th <= s.th)
        .map((x) =>
          optHtml(
            x,
            x.id === current,
            x.id !== current && s.heroes.has(x.id),
            x.name + (s.heroes.has(x.id) && x.id !== current ? ' (in your army)' : ''),
          ),
        );
      if (h) note = "Swapping keeps the pet; equipment belongs to each hero, so it's cleared.";
    } else if (which === 'pet') {
      current = a.pet;
      title = 'Pet for ' + h.name;
      // Who already has each pet (a pet can only go with one hero).
      var petOwner = {};
      s.heroes.forEach(function (x, hid) {
        if (x.pet != null && hid !== heroId) petOwner[x.pet] = byId.hero[hid].name;
      });
      opts = data.pets
        .filter((p) => p.th <= s.th)
        .map((o) => optHtml(o, o.id === current, !!petOwner[o.id], o.name + (petOwner[o.id] ? ' (with ' + petOwner[o.id] + ')' : '')));
      note = 'A pet already with another hero moves over.';
    } else {
      current = a.eq[which === 'eq0' ? 0 : 1];
      title = 'Equipment for ' + h.name;
      opts = data.equipment
        .filter((e) => e.hero === heroId && e.th <= s.th)
        .map((o) => optHtml(o, o.id === current, a.eq.indexOf(o.id) !== -1 && o.id !== current));
    }
    var mode = '';
    if (which === 'hero' && h && h.modes)
      mode =
        '<button type="button" class="am-btn am-modal-mode" data-pick="mode">' +
        (a.air ? 'Air mode: switch to ground' : 'Ground mode: switch to air') +
        '</button>';
    var remove =
      current != null
        ? '<button type="button" class="am-btn am-picker-remove" data-pick="none">' +
          (which === 'hero' ? 'Remove hero' : 'Remove') +
          '</button>'
        : '';
    modal.querySelector('#amPicker').innerHTML =
      '<div class="am-picker-head"><h3 class="am-modal-title" id="amPickerTitle">' +
      esc(title) +
      '</h3><button type="button" class="am-picker-close" data-pick="close" aria-label="Close">&times;</button></div>' +
      (note ? '<p class="am-modal-note">' + note + '</p>' : '') +
      '<div class="am-grid am-grid-sm">' +
      opts.join('') +
      '</div>' +
      (mode || remove ? '<div class="am-modal-foot">' + mode + remove + '</div>' : '');
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.documentElement.classList.add('am-modal-open');
    var first =
      modal.querySelector('#amPicker .am-opt.is-on') ||
      modal.querySelector('#amPicker .am-opt:not(.is-taken)') ||
      modal.querySelector('#amPicker .am-picker-close');
    first.focus({ preventScroll: true });
  }
  function closePicker() {
    if (modal.hidden) return;
    picking = null;
    modal.hidden = true;
    document.documentElement.classList.remove('am-modal-open');
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  function pick(value) {
    if (!picking) return;
    if (value === 'close') return closePicker();
    var hid = picking.hero;
    var a = hid != null ? s.heroes.get(hid) : null;
    if (value === 'mode') {
      a.air = !a.air;
      closePicker();
      return changed();
    }
    var id = value === 'none' ? null : parseInt(value, 10);
    if (picking.slot === 'hero') {
      if (id === hid) return closePicker();
      if (id == null) s.heroes.delete(hid);
      else if (s.heroes.has(id)) return toast(byId.hero[id].name + ' is already in your army');
      else if (hid == null) {
        if (s.heroes.size >= TH.heroes) return toast('Hero slots are full (' + TH.heroes + '/' + TH.heroes + ')');
        s.heroes.set(id, { pet: null, eq: [], air: false });
      } else {
        // Swap: the pet stays, the equipment (hero-specific) doesn't.
        s.heroes.delete(hid);
        s.heroes.set(id, { pet: a.pet, eq: [], air: false });
      }
    } else if (picking.slot === 'pet') {
      // Taking a pet from another hero moves it.
      s.heroes.forEach(function (x) {
        if (id != null && x.pet === id) x.pet = null;
      });
      a.pet = id;
    } else {
      var i = picking.slot === 'eq0' ? 0 : 1;
      var eq = a.eq.slice();
      if (id != null && eq.indexOf(id) !== -1 && eq[i] !== id) return toast('Already in the other slot');
      if (id == null) eq.splice(i, 1);
      else if (i < eq.length) eq[i] = id;
      else eq.push(id);
      a.eq = eq;
    }
    closePicker();
    changed();
  }
  modal.addEventListener('click', function (e) {
    if (e.target === modal) return closePicker();
    var b = e.target.closest('[data-pick]');
    if (b) pick(b.dataset.pick);
  });

  // The tray: in <body> like the modal (fixed to the screen's bottom),
  // lined up with the builder on wide screens, full width on phones.
  var editing = null; // the open row: 'troops' | 'spells' | 'sieges' | 'cc'
  var tray = document.createElement('div');
  tray.className = 'am-tray';
  tray.hidden = true;
  tray.setAttribute('role', 'dialog');
  tray.setAttribute('aria-labelledby', 'amTrayTitle');
  tray.innerHTML =
    '<div class="am-tray-head"><h3 class="am-tray-title" id="amTrayTitle"></h3><span class="am-tray-meter" data-meter=""></span>' +
    '<button type="button" class="am-btn am-tray-done" data-tray="close">Done</button>' +
    '<button type="button" class="am-picker-close" data-tray="close" aria-label="Close">&times;</button></div>' +
    '<div class="am-tray-body"></div>';
  document.body.appendChild(tray);

  function placeTray() {
    if (tray.hidden) return;
    var wide = window.innerWidth > 970;
    var r = root.getBoundingClientRect();
    tray.style.left = wide ? r.left + 'px' : '';
    tray.style.width = wide ? r.width + 'px' : '';
    // Room under the builder, so the last row can scroll up above the tray.
    root.style.setProperty('--tray-h', tray.offsetHeight + 'px');
  }
  function fillTray() {
    var R = ROWS[editing];
    tray.querySelector('.am-tray-title').textContent = R.title;
    tray.querySelector('.am-tray-meter').dataset.meter = R.meter;
    tray.querySelector('.am-tray-body').innerHTML = trayBody(editing);
    refresh();
  }
  // The page's scroller: the CoC pages scroll .coc-main, not the window.
  function scroller() {
    for (var el = root.parentElement; el; el = el.parentElement) {
      var oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return el;
    }
    return document.scrollingElement;
  }
  // Keep the open row in view above the tray.
  function revealRow() {
    var g = $('#amList .' + ROWS[editing].cls);
    if (!g) return;
    var gr = g.getBoundingClientRect();
    // Where the tray's top will settle (fixed to the bottom), not where it
    // is now -- it's still sliding up for a moment after it opens.
    var limit = window.innerHeight - tray.offsetHeight - 16;
    var sc = scroller();
    var dy = 0;
    if (gr.bottom > limit) dy = gr.bottom - limit;
    else if (gr.top < 110) dy = gr.top - 110; // under the top bars
    if (!dy) return;
    var before = sc.style.scrollBehavior;
    sc.style.scrollBehavior = 'auto'; // .coc-main scrolls smoothly, which would lag behind
    sc.scrollTop += dy;
    sc.style.scrollBehavior = before;
  }
  function openTray(row) {
    if (!ROWS[row]) return;
    closePicker();
    var was = editing;
    editing = row;
    if (tray.hidden) lastTrayFocus = document.activeElement;
    tray.hidden = false;
    root.classList.add('is-tray-open');
    fillTray(); // redraws the sheet too (refresh), with the row lit
    placeTray();
    revealRow();
    if (was !== row) {
      var first = tray.querySelector('.am-tile:not(.is-full)') || tray.querySelector('.am-tray-done');
      first.focus({ preventScroll: true });
    }
  }
  var lastTrayFocus = null;
  function closeTray() {
    if (tray.hidden) return;
    var row = editing;
    editing = null;
    stopHold();
    tray.hidden = true;
    root.classList.remove('is-tray-open');
    root.style.removeProperty('--tray-h');
    renderBar();
    // Back to the row that was open (its first unit, else the row itself).
    var g = $('#amList .' + ROWS[row].cls);
    var back = (g && g.querySelector('button.as-tile')) || lastTrayFocus;
    if (back && document.contains(back)) back.focus({ preventScroll: true });
  }
  window.addEventListener('resize', placeTray);
  // The tray's height changes with its content (another row, another Town
  // Hall): keep the room under the builder and the open row in step.
  if ('ResizeObserver' in window)
    new ResizeObserver(function () {
      if (tray.hidden) return;
      placeTray();
      revealRow();
    }).observe(tray);

  // Hold to repeat: a tap does it once; holding past HOLD_MS starts
  // repeating, faster the longer you hold, until you let go, move away,
  // or fn() says stop (camp full, stack gone). The pointer is captured
  // by a box that stays put (the tray, or the army list), because the
  // sheet redraws under your finger on every change.
  var HOLD_MS = 380;
  var hold = null;
  var swallowClick = false;
  function startHold(e, box, fn) {
    if (e.button !== 0) return;
    stopHold();
    var h = (hold = { id: e.pointerId, x: e.clientX, y: e.clientY, fn: fn, n: 0, box: box });
    try {
      box.setPointerCapture(e.pointerId);
    } catch (err) {}
    function tick() {
      if (hold !== h) return;
      h.n++;
      if (fn() === false) return stopHold();
      if (navigator.vibrate)
        try {
          navigator.vibrate(6);
        } catch (err) {}
      h.t = setTimeout(tick, Math.max(45, 170 - h.n * 12));
    }
    h.t = setTimeout(tick, HOLD_MS);
  }
  function stopHold() {
    var h = hold;
    if (!h) return null;
    hold = null;
    clearTimeout(h.t);
    try {
      h.box.releasePointerCapture(h.id);
    } catch (err) {}
    return h;
  }
  function holdEnd(e) {
    if (!hold || e.pointerId !== hold.id) return;
    var h = stopHold();
    if (e.type !== 'pointerup') return;
    if (h.n === 0) h.fn(); // a tap: just once
    // The click that follows a press we handled must not do anything else
    // (open / close a row). A mouse always sends one, a tap too; a long
    // press on a phone may not, so then nothing is held back. Cleared
    // shortly after in case none comes.
    if (h.n === 0 || e.pointerType === 'mouse') {
      swallowClick = true;
      setTimeout(() => (swallowClick = false), 350);
    }
  }
  function holdMove(e) {
    if (hold && e.pointerId === hold.id && Math.abs(e.clientX - hold.x) + Math.abs(e.clientY - hold.y) > 10) stopHold();
  }
  document.addEventListener(
    'click',
    function (e) {
      if (!swallowClick) return;
      swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );
  [tray, $('#amList')].forEach(function (box) {
    box.addEventListener('pointerup', holdEnd);
    box.addEventListener('pointercancel', holdEnd);
    box.addEventListener('pointermove', holdMove);
    box.addEventListener('lostpointercapture', holdEnd);
    // A long press would otherwise open the image menu on phones.
    box.addEventListener('contextmenu', function (e) {
      if (e.target.closest('.am-tile, .is-editing .as-tile')) e.preventDefault();
    });
  });
  function canAdd(kind, id) {
    if (blocked(kind, id)) {
      add(kind, id); // shows why
      return false;
    }
    add(kind, id);
    return true;
  }
  function canRemove(kind, id) {
    remove(kind, id);
    return s[MAP[kind]].has(id);
  }
  tray.addEventListener('pointerdown', function (e) {
    var t = e.target.closest('.am-tile[data-kind]');
    if (t) startHold(e, tray, () => canAdd(t.dataset.kind, parseInt(t.dataset.id, 10)));
  });
  $('#amList').addEventListener('pointerdown', function (e) {
    var t = e.target.closest('.is-editing button.as-tile[data-sheet="remove"]');
    if (t) startHold(e, $('#amList'), () => canRemove(t.dataset.kind, parseInt(t.dataset.id, 10)));
  });
  tray.addEventListener('click', function (e) {
    if (e.target.closest('[data-tray="close"]')) return closeTray();
    // Keyboard only (Enter / Space: detail 0) -- pointers go through startHold.
    var t = e.target.closest('.am-tile[data-kind]');
    if (t && e.detail === 0) add(t.dataset.kind, parseInt(t.dataset.id, 10));
  });
  // A tap anywhere else (not the tray, not the army sheet) closes the tray.
  // Heroes / pets in the sheet close it themselves (they open the modal).
  document.addEventListener('click', function (e) {
    if (tray.hidden) return;
    // A target that's no longer in the page was redrawn away by this very
    // click (the sheet redraws on every change) -- i.e. it was in the builder.
    if (!document.contains(e.target)) return;
    if (tray.contains(e.target) || e.target.closest('#amList, .am-toast')) return;
    closeTray();
  });

  // Each row's own Clear: the troops row and the siege row share one map.
  function clearRow(row) {
    var T = byId.troop;
    if (row === 'troops') s.troops.forEach((c, id) => !T[id].siege && s.troops.delete(id));
    else if (row === 'sieges') s.troops.forEach((c, id) => T[id].siege && s.troops.delete(id));
    else if (row === 'spells') s.spells.clear();
    else {
      s.ccTroops.clear();
      s.ccSpells.clear();
    }
    changed();
  }
  function rowHas(row) {
    var T = byId.troop;
    var n = 0;
    if (row === 'troops') s.troops.forEach((c, id) => (n += T[id].siege ? 0 : 1));
    else if (row === 'sieges') s.troops.forEach((c, id) => (n += T[id].siege ? 1 : 0));
    else if (row === 'spells') n = s.spells.size;
    else n = s.ccTroops.size + s.ccSpells.size;
    return n > 0;
  }
  var TRASH =
    '<svg class="am-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>';
  // After every redraw of the sheet: mark the rows, give each its Clear,
  // and light the open one.
  function decorateRows(list) {
    var sheet = list.querySelector('.army-sheet');
    if (!sheet) return;
    sheet.classList.toggle('is-editing-row', !!editing);
    Object.keys(ROWS).forEach(function (row) {
      var g = sheet.querySelector('.' + ROWS[row].cls);
      if (!g) return;
      g.dataset.row = row;
      g.classList.toggle('is-editing', editing === row);
      g.classList.toggle('is-empty', !g.querySelector('.as-row > .as-tile:not(.as-ph)'));
      if (editing !== row) g.setAttribute('title', 'Tap to edit ' + ROWS[row].title.toLowerCase());
      g.querySelector('.as-head').insertAdjacentHTML(
        'beforeend',
        '<button type="button" class="am-row-clear" data-row-clear="' +
          row +
          '"' +
          (rowHas(row) ? '' : ' disabled') +
          ' aria-label="Clear ' +
          ROWS[row].title.toLowerCase() +
          '">' +
          TRASH +
          '<span>Clear</span></button>',
      );
    });
  }

  // ---- Updating what's on screen -----------------------------------------
  function meter(val, max) {
    return '<b' + (val > max ? ' class="is-over"' : '') + '>' + val + '</b>/' + max;
  }
  function refresh() {
    var u = used();
    var counts = { troop: s.troops, spell: s.spells, ccTroop: s.ccTroops, ccSpell: s.ccSpells };

    var inTray = (sel) => $$(sel).concat([].slice.call(tray.querySelectorAll(sel)));
    inTray('.am-tile[data-kind]').forEach(function (b) {
      var kind = b.dataset.kind;
      var id = parseInt(b.dataset.id, 10);
      var n = counts[kind].get(id) || 0;
      b.querySelector('.am-count').textContent = n ? n : '';
      b.classList.toggle('is-on', n > 0);
      b.classList.toggle('is-full', !!blocked(kind, id, u));
    });

    // Meters: the tabs and group headings.
    var M = {
      troops: meter(u.troops, TH.troops),
      spells: meter(u.spells, TH.spells),
      heroes: meter(u.heroes, TH.heroes),
      sieges: meter(u.sieges, TH.sieges),
      supers: meter(u.supers, SUPER_MAX),
      cc: meter(u.ccTroops, TH.cc.troops), // troop space only; spells + sieges have their own counters in the tab
      ccTroops: meter(u.ccTroops, TH.cc.troops),
      ccSpells: meter(u.ccSpells, TH.cc.spells),
      ccSieges: meter(u.ccSieges, TH.cc.sieges),
    };
    inTray('[data-meter]').forEach(function (el) {
      el.innerHTML = M[el.dataset.meter] || '';
    });
    renderBar();
  }

  // "Your army": the same army sheet as the army cards (th-layouts.js
  // ArmySheet), in edit mode -- tap a unit row to open its tray, a hero's
  // portrait or an empty hero slot for the hero picker, a pet / equipment
  // slot to pick one, the Warden's corner icon to switch air / ground.
  function renderBar() {
    var c0 = code();
    var list = $('#amList');
    list.innerHTML = window.ArmySheet.html(s.th, c0, { edit: true, stack: true });
    decorateRows(list);
    window.ArmySheet.wire(list);

    var c = c0;
    var open = $('#amOpen');
    $$('.am-actions [data-act]').forEach((b) => (b.disabled = !c));
    if (c) open.href = GAME_LINK + c;
    else open.removeAttribute('href');
    open.setAttribute('aria-disabled', !c);
  }

  // Every change: redraw, then put the army in the address bar.
  // The address is updated after a short pause, not on every tap: browsers
  // start ignoring replaceState after a few hundred calls in a row (fast
  // tapping hits that), which would leave a stale address behind.
  var urlTimer;
  function pageQuery() {
    var c = code();
    return '?th=' + s.th + (c ? '&army=' + c : '');
  }
  function changed() {
    refresh();
    clearTimeout(urlTimer);
    urlTimer = setTimeout(function () {
      var q = pageQuery();
      if (location.search !== q) history.replaceState(null, '', q + location.hash);
    }, 250);
  }

  var toastTimer;
  function toast(msg) {
    var t = $('#amToast');
    // Fixed to the screen's bottom, centred over the builder (on desktop the
    // sidebar pushes the builder off the window's centre).
    var r = root.getBoundingClientRect();
    t.style.left = r.left + r.width / 2 + 'px';
    t.style.bottom = tray.hidden ? '' : tray.offsetHeight + 12 + 'px';
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.classList.remove('is-on');
    }, 2600);
  }

  function copyText(text, done) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        () => done(true),
        () => done(legacyCopy(text)),
      );
    } else done(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {}
    ta.remove();
    return ok;
  }

  function setTh(n) {
    s.th = n;
    TH = data.townHalls[n];
    // Drop whatever this Town Hall hasn't unlocked.
    var gone = [];
    [
      ['troops', byId.troop, 'th'],
      ['spells', byId.spell, 'th'],
      ['ccTroops', byId.troop, 'ccTh'],
      ['ccSpells', byId.spell, 'ccTh'],
    ].forEach(function (k) {
      s[k[0]].forEach(function (c, id) {
        var u = k[1][id];
        if (u[k[2]] == null || u[k[2]] > n) {
          s[k[0]].delete(id);
          gone.push(u.name);
        }
      });
    });
    s.heroes.forEach(function (a, id) {
      if (byId.hero[id].th > n) {
        s.heroes.delete(id);
        gone.push(byId.hero[id].name);
        return;
      }
      if (a.pet != null && byId.pet[a.pet].th > n) a.pet = null;
      a.eq = a.eq.filter((e) => byId.equip[e].th <= n);
    });
    while (s.heroes.size > TH.heroes) s.heroes.delete([...s.heroes.keys()].pop());
    picking = null;
    buildThs();
    updateJumps();
    if (editing) fillTray();
    changed();
    if (gone.length) toast('Removed (not unlocked at TH' + n + '): ' + gone.join(', '));
  }

  // ---- Events -------------------------------------------------------------
  function sheetAct(t) {
    var act = t.dataset.sheet;
    var hid = parseInt(t.dataset.hero, 10);
    if (act === 'remove') return remove(t.dataset.kind, parseInt(t.dataset.id, 10));
    if (act === 'hero') return openPicker(isNaN(hid) ? null : hid, 'hero');
    if (act === 'slot') return openPicker(hid, t.dataset.slot);
    if (act === 'mode') {
      var a = s.heroes.get(hid);
      if (a) a.air = !a.air;
      return changed();
    }
  }
  root.addEventListener('click', function (e) {
    var rc = e.target.closest('[data-row-clear]');
    if (rc) return clearRow(rc.dataset.rowClear);
    // A unit row: a closed one opens (wherever you tap it); in the open
    // one a unit's tap is the remove badge (pointers: startHold above;
    // this is the keyboard's Enter / Space).
    var g = e.target.closest('#amList .as-group[data-row]');
    if (g) {
      if (g.dataset.row !== editing) return openTray(g.dataset.row);
      var rm = e.target.closest('button.as-tile[data-sheet="remove"]');
      if (rm && e.detail === 0) remove(rm.dataset.kind, parseInt(rm.dataset.id, 10));
      return;
    }
    var st = e.target.closest('#amList [data-sheet]');
    if (st) {
      closeTray();
      return sheetAct(st);
    }
    var t = e.target.closest('button, a');
    if (!t || !root.contains(t) || t.disabled) return;

    if (t.id === 'amThBtn') return thMenu();
    if (t.classList.contains('am-th-opt')) {
      var n = parseInt(t.dataset.th, 10);
      if (t.getAttribute('aria-disabled') === 'true') return toast('TH' + n + ' is coming to the army maker soon');
      thMenu(false);
      if (n !== s.th) setTh(n);
      $('#amThBtn').focus({ preventScroll: true });
      return;
    }
    if (t.dataset.share) return shareAction(t);

    if (t.id === 'amOpen' && t.getAttribute('aria-disabled') === 'true') return e.preventDefault();
    var act = t.dataset.act;
    if (act === 'copy') return copyArmy(t);
    if (act === 'paste') return pasteBox();
    if (act === 'share') return shareMenu();
    if (t.dataset.to) return setTimeout(() => shareMenu(false), 0); // a Facebook / X / ... link: let it open, then close
    if (act === 'clear') {
      // Two taps, so one stray tap can't wipe a finished army.
      if (!t.classList.contains('is-armed')) {
        t.classList.add('is-armed');
        t.querySelector('.am-btn-text').textContent = 'Tap again';
        setTimeout(() => disarm(t), 2600);
        return;
      }
      disarm(t);
      ['troops', 'spells', 'heroes', 'ccTroops', 'ccSpells'].forEach((k) => s[k].clear());
      closePicker();
      changed();
      return;
    }
  });
  // The hero portrait is a div (it holds the pet button), so give it the
  // keyboard behaviour of a button.
  root.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var st = e.target.closest('#amList div[data-sheet]');
    if (!st || st !== e.target) return;
    e.preventDefault();
    sheetAct(st);
  });
  // Copy army link: the game link, the one you paste into Clash of Clans
  // (or send to a clanmate). The button says so for a moment.
  function copyArmy(btn) {
    var text = btn.querySelector('.am-btn-text');
    copyText(GAME_LINK + code(), function (ok) {
      text.textContent = ok ? 'Link copied' : "Couldn't copy";
      btn.classList.toggle('copied', ok);
      clearTimeout(btn._t);
      btn._t = setTimeout(function () {
        text.textContent = 'Copy army link';
        btn.classList.remove('copied');
      }, 1600);
    });
  }
  // Import army: opens (or closes) the field for loading an army link.
  function pasteBox(open) {
    var form = $('#amImport');
    var btn = $('[data-act="paste"]');
    if (open === undefined) open = form.hidden;
    form.hidden = !open;
    btn.setAttribute('aria-expanded', open);
    btn.classList.toggle('active', open);
    if (open) $('#amImportInput').focus();
  }
  function disarm(btn) {
    btn.classList.remove('is-armed');
    btn.querySelector('.am-btn-text').textContent = 'Clear';
  }

  // ---- Share drop-up ---------------------------------------------------------
  // The layout cards' share panel (th-layouts.js initCardShare), opening
  // upward from the Share button: copy the game link (opens Clash), copy
  // this page's link (reopens the army here), or post the game link.
  // Phones that have a system share sheet also get "More apps".
  // App logos: Simple Icons (CC0), same as the layout cards.
  function brand(name, d) {
    return '<svg viewBox="0 0 24 24" class="sp-brand sp-' + name + '" aria-hidden="true"><path d="' + d + '"/></svg>';
  }
  var PAGE_ICO =
    '<svg viewBox="0 0 24 24" class="am-ico" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/></svg>';
  var MORE_ICO =
    '<svg viewBox="0 0 24 24" class="am-ico" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M7 8l5-5 5 5"/></svg>';
  var shareMenuEl = document.createElement('div');
  shareMenuEl.className = 'am-pop am-share-menu';
  shareMenuEl.id = 'amShareMenu';
  shareMenuEl.setAttribute('role', 'menu');
  shareMenuEl.hidden = true;
  // (The game link has its own button, Copy army link, so it's not here.)
  shareMenuEl.innerHTML =
    '<button type="button" role="menuitem" data-share="page">' +
    PAGE_ICO +
    '<span>Copy Parchrome link</span></button><hr>' +
    '<a role="menuitem" target="_blank" rel="noopener noreferrer" data-to="facebook">' +
    brand(
      'facebook',
      'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
    ) +
    'Facebook</a>' +
    '<a role="menuitem" target="_blank" rel="noopener noreferrer" data-to="x">' +
    brand(
      'x',
      'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z',
    ) +
    'X</a>' +
    '<a role="menuitem" target="_blank" rel="noopener noreferrer" data-to="reddit">' +
    brand(
      'reddit',
      'M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z',
    ) +
    'Reddit</a>' +
    '<a role="menuitem" target="_blank" rel="noopener noreferrer" data-to="whatsapp">' +
    brand(
      'whatsapp',
      'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
    ) +
    'WhatsApp</a>' +
    (navigator.share ? '<button type="button" role="menuitem" data-share="native">' + MORE_ICO + '<span>More apps</span></button>' : '');
  $('.am-share').appendChild(shareMenuEl);
  var SHARE_TEXT = {
    game: ['Copy game link', 'Game link copied'],
    page: ['Copy Parchrome link', 'Parchrome link copied'],
  };
  function shareTitle() {
    return 'TH' + s.th + ' army on Parchrome';
  }
  function shareMenu(open) {
    var btn = $('[data-act="share"]');
    if (open === undefined) open = shareMenuEl.hidden;
    if (open) {
      var u = encodeURIComponent(GAME_LINK + code());
      var t = encodeURIComponent(shareTitle());
      var to = {
        facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + u,
        x: 'https://twitter.com/intent/tweet?url=' + u + '&text=' + t,
        reddit: 'https://www.reddit.com/submit?url=' + u + '&title=' + t,
        whatsapp: 'https://wa.me/?text=' + t + '%20' + u,
      };
      $$('a[data-to]', shareMenuEl).forEach((a) => (a.href = to[a.dataset.to]));
      $$('[data-share]', shareMenuEl).forEach(function (b) {
        b.classList.remove('copied');
        if (SHARE_TEXT[b.dataset.share]) b.querySelector('span').textContent = SHARE_TEXT[b.dataset.share][0];
      });
    }
    shareMenuEl.hidden = !open;
    btn.setAttribute('aria-expanded', open);
    if (open) shareMenuEl.firstChild.focus({ preventScroll: true });
  }
  function shareAction(b) {
    var kind = b.dataset.share;
    if (kind === 'native') {
      shareMenu(false);
      navigator.share({ title: shareTitle(), url: GAME_LINK + code() }).catch(function () {});
      return;
    }
    // The Parchrome link is built from the army itself, not read from the
    // address bar (that updates a moment later -- see changed()).
    var pageLink = location.origin + location.pathname + pageQuery();
    copyText(kind === 'game' ? GAME_LINK + code() : pageLink, function (ok) {
      b.classList.toggle('copied', ok);
      b.querySelector('span').textContent = ok ? SHARE_TEXT[kind][1] : "Couldn't copy";
      setTimeout(() => shareMenu(false), ok ? 900 : 1600);
    });
  }

  // A tap anywhere else, or Esc, closes the Town Hall list and the share menu.
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#amThs')) thMenu(false);
    if (!e.target.closest('.am-share')) shareMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!modal.hidden) return closePicker();
    if (!tray.hidden) return closeTray();
    if (!shareMenuEl.hidden) {
      shareMenu(false);
      $('[data-act="share"]').focus();
    }
    var menu = $('#amThMenu');
    if (menu && !menu.hidden) {
      thMenu(false);
      $('#amThBtn').focus();
    }
  });

  $('#amImport').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('#amImportInput');
    var skipped = load(input.value);
    if (skipped === null) return toast("That doesn't look like an army link");
    input.value = '';
    pasteBox(false);
    closePicker();
    changed();
    toast(skipped.length ? 'Loaded. Left out: ' + skipped.join(', ') : 'Army loaded');
  });

  // ---- "Tools" highlighted in the navs ---------------------------------------
  // The army maker is one of the Tools, but the nav scripts only light up
  // the link whose href is this page, and none is. So light Tools here:
  // the bottom nav's (thz-script.js clears it on load) and the top bar's hub link (th-layouts.js builds that
  // strip after a fetch -- the observer catches it arriving).
  function markTools() {
    document.querySelectorAll('.bn-item[data-role]').forEach(function (a) {
      a.classList.toggle('active', a.dataset.role === 'bn-guides');
    });
    document.querySelectorAll('#stbHubNavScroll .stb-hub-link').forEach(function (a) {
      a.classList.toggle('active', /coctools\.html$/.test(a.getAttribute('href') || ''));
    });
  }
  markTools();
  document.addEventListener('parchome:coc-nav-ready', markTools);
  var hub = document.getElementById('stbHubNavScroll');
  if (hub && window.MutationObserver) new MutationObserver(markTools).observe(hub, { childList: true });

  // ---- Start --------------------------------------------------------------
  // The army sheet comes from th-layouts.js, which loads after this file,
  // so wait for the page's scripts to finish before asking for it.
  var sheetReady = new Promise(function (done) {
    if (window.ArmySheet) done();
    else document.addEventListener('DOMContentLoaded', done);
  }).then(function () {
    // Skeleton in "Your army" until the unit data arrives.
    if (!data) $('#amList').innerHTML = window.ArmySheet.skeleton({ stack: true });
    return window.ArmySheet.load();
  });
  Promise.all([fetch('/coc-army-data.json').then((r) => r.json()), sheetReady])
    .then((res) => res[0])
    .then(function (d) {
      data = d;
      data.troops.forEach((u) => (byId.troop[u.id] = u));
      data.sieges.forEach((u) => (byId.troop[u.id] = Object.assign(u, { siege: true })));
      data.spells.forEach((u) => (byId.spell[u.id] = u));
      data.heroes.forEach((u) => (byId.hero[u.id] = u));
      data.pets.forEach((u) => (byId.pet[u.id] = u));
      data.equipment.forEach((u) => (byId.equip[u.id] = u));

      var q = new URLSearchParams(location.search);
      var th = parseInt(q.get('th'), 10);
      var top = Math.max.apply(null, data.enabledTh);
      s.th = data.enabledTh.indexOf(th) !== -1 ? th : top;
      TH = data.townHalls[s.th];
      var skipped = q.get('army') ? load(q.get('army')) : [];
      buildThs();
      updateJumps();
      changed();
      root.classList.add('is-ready');
      if (skipped && skipped.length) toast('Left out: ' + skipped.join(', '));
    })
    .catch(function (err) {
      console.error('Army maker data failed to load:', err);
      $('#amList').innerHTML = '<span class="am-empty">The army maker could not load. Refresh the page to try again.</span>';
    });
})();
