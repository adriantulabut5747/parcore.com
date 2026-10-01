/* =======================================================================
   ARMY MAKER (coc-armymaker.html) -- builds a Clash of Clans "Copy Army"
   link from the troops, spells, heroes and clan castle units you tap.

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

  function buildPanels() {
    var hasPets = data.pets.some((p) => p.th <= s.th); // pets start at TH14 (Pet House)
    var T = data.troops;
    // Elixir and dark troops in one group: elixir first, then dark.
    var regular = T.filter((u) => !u.dark && !u.super).concat(T.filter((u) => u.dark && !u.super));
    var supers = T.filter((u) => u.super);
    $('[data-panel="troops"]').innerHTML =
      group('Troops', '', 'troop', regular, 'th') +
      group('Super troops', 'supers', 'troop', supers, 'th') +
      group('Siege machines', 'sieges', 'troop', data.sieges, 'th');
    $('[data-panel="spells"]').innerHTML =
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
      );
    $('[data-panel="cc"]').innerHTML =
      group('Troops', 'ccTroops', 'ccTroop', T, 'ccTh') +
      group('Spells', 'ccSpells', 'ccSpell', data.spells, 'ccTh') +
      group('Siege machines', 'ccSieges', 'ccTroop', data.sieges, 'ccTh');
    $('[data-panel="heroes"]').innerHTML =
      '<p class="am-note">Tap a hero to bring them, then tap the slots beside them for ' +
      (hasPets ? 'a pet and ' : '') +
      'two pieces of equipment.</p>' +
      data.heroes
        .filter((h) => h.th <= s.th)
        .map(
          (h) =>
            '<div class="am-hero" data-hero="' +
            h.id +
            '">' +
            tile('hero', h, ' am-hero-tile') +
            '<div class="am-hero-body"><div class="am-hero-name">' +
            esc(h.name) +
            '</div><div class="am-slots">' +
            (hasPets ? slot(h.id, 'pet', 'Pet') : '') +
            slot(h.id, 'eq0', 'Equipment') +
            slot(h.id, 'eq1', 'Equipment') +
            (h.modes ? modeBox(h) : '') +
            '</div></div></div>',
        )
        .join('') +
      '<div class="am-picker" id="amPicker" hidden></div>';
  }
  function slot(heroId, which, label) {
    return (
      '<button type="button" class="am-slot" data-hero="' +
      heroId +
      '" data-slot="' +
      which +
      '" aria-label="Choose ' +
      label.toLowerCase() +
      '"><span class="am-slot-plus" aria-hidden="true">+</span><span class="am-slot-label">' +
      label +
      '</span></button>'
    );
  }

  // Grand Warden's Ground / Air switch: a box like the slots that just
  // says which ("Mode / Ground"). Tap to switch. Air mode writes "m1" into
  // the link.
  function modeBox(h) {
    return (
      '<button type="button" class="am-slot am-mode" data-hero="' +
      h.id +
      '"><span class="am-mode-k">Mode</span><span class="am-mode-v">Ground</span></button>'
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
      a.href = 'th' + s.th + (army ? '-army.html' : '-layouts.html');
      var t = a.querySelector('.am-btn-text');
      if (t) t.textContent = 'TH' + s.th + (army ? ' army comps' : ' base layouts');
    });
  }

  // ---- Picker (pet / equipment for one hero) ------------------------------
  var picking = null; // { hero, slot }
  function openPicker(heroId, which) {
    var picker = $('#amPicker');
    if (picking && picking.hero === heroId && picking.slot === which) return closePicker();
    if (!s.heroes.has(heroId)) {
      if (s.heroes.size >= TH.heroes) return toast('Hero slots are full (' + TH.heroes + '/' + TH.heroes + ')');
      s.heroes.set(heroId, { pet: null, eq: [], air: false });
      changed();
    }
    picking = { hero: heroId, slot: which };
    var a = s.heroes.get(heroId);
    var h = byId.hero[heroId];
    var opts;
    var current;
    if (which === 'pet') {
      current = a.pet;
      opts = data.pets.filter((p) => p.th <= s.th);
    } else {
      current = a.eq[which === 'eq0' ? 0 : 1];
      opts = data.equipment.filter((e) => e.hero === heroId && e.th <= s.th);
    }
    // Who already has each pet (a pet can only go with one hero).
    var petOwner = {};
    s.heroes.forEach(function (x, hid) {
      if (x.pet != null && hid !== heroId) petOwner[x.pet] = byId.hero[hid].name;
    });
    picker.innerHTML =
      '<div class="am-picker-head"><span>' +
      (which === 'pet' ? 'Pet for ' : 'Equipment for ') +
      esc(h.name) +
      '</span><button type="button" class="am-picker-close" data-pick="close" aria-label="Close">&times;</button></div><div class="am-grid am-grid-sm">' +
      opts
        .map(function (o) {
          var other = which === 'pet' ? petOwner[o.id] : a.eq.indexOf(o.id) !== -1 && o.id !== current;
          return (
            '<button type="button" class="am-tile am-opt' +
            (o.id === current ? ' is-on' : '') +
            (other ? ' is-taken' : '') +
            '" data-pick="' +
            o.id +
            '" title="' +
            esc(o.name + (which === 'pet' && other ? ' (with ' + other + ')' : '')) +
            '"><img src="' +
            esc(img(o)) +
            '" alt="" width="128" height="128" loading="lazy" decoding="async"><span class="am-vh">' +
            esc(o.name) +
            '</span></button>'
          );
        })
        .join('') +
      '</div>' +
      (current != null ? '<button type="button" class="am-picker-remove" data-pick="none">Remove</button>' : '');
    $('.am-hero[data-hero="' + heroId + '"]').after(picker);
    picker.hidden = false;
    refresh();
  }
  function closePicker() {
    picking = null;
    var p = $('#amPicker');
    if (p) p.hidden = true;
    refresh();
  }
  function pick(value) {
    if (!picking) return;
    var a = s.heroes.get(picking.hero);
    if (value === 'close') return closePicker();
    var id = value === 'none' ? null : parseInt(value, 10);
    if (picking.slot === 'pet') {
      // Taking a pet from another hero moves it.
      s.heroes.forEach(function (x) {
        if (id != null && x.pet === id) x.pet = null;
      });
      a.pet = id;
    } else {
      var i = picking.slot === 'eq0' ? 0 : 1;
      var eq = a.eq.slice();
      if (id != null && eq.indexOf(id) !== -1 && eq[i] !== id) return; // already in the other slot
      if (id == null) eq.splice(i, 1);
      else if (i < eq.length) eq[i] = id;
      else eq.push(id);
      a.eq = eq;
    }
    closePicker();
    changed();
  }

  // ---- Updating what's on screen -----------------------------------------
  function meter(val, max) {
    return '<b' + (val > max ? ' class="is-over"' : '') + '>' + val + '</b>/' + max;
  }
  function refresh() {
    var u = used();
    var counts = { troop: s.troops, spell: s.spells, ccTroop: s.ccTroops, ccSpell: s.ccSpells };

    $$('.am-tile[data-kind]').forEach(function (b) {
      var kind = b.dataset.kind;
      var id = parseInt(b.dataset.id, 10);
      if (kind === 'hero') {
        var on = s.heroes.has(id);
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on);
        b.classList.toggle('is-full', !on && u.heroes >= TH.heroes);
        return;
      }
      var n = counts[kind].get(id) || 0;
      b.querySelector('.am-count').textContent = n ? n : '';
      b.classList.toggle('is-on', n > 0);
      b.classList.toggle('is-full', !!blocked(kind, id, u));
    });

    // Hero rows: slots show what's picked; the Warden's mode button.
    $$('.am-hero').forEach(function (row) {
      var id = parseInt(row.dataset.hero, 10);
      var a = s.heroes.get(id);
      row.classList.toggle('is-on', !!a);
      $$('.am-slot:not(.am-mode)', row).forEach(function (btn) {
        var which = btn.dataset.slot;
        var val = !a ? null : which === 'pet' ? a.pet : a.eq[which === 'eq0' ? 0 : 1];
        var item = val == null ? null : which === 'pet' ? byId.pet[val] : byId.equip[val];
        btn.classList.toggle('is-set', !!item);
        btn.classList.toggle('is-open', !!picking && picking.hero === id && picking.slot === which);
        btn.innerHTML = item
          ? '<img src="' + esc(img(item)) + '" alt="" width="128" height="128"><span class="am-slot-label">' + esc(item.name) + '</span>'
          : '<span class="am-slot-plus" aria-hidden="true">+</span><span class="am-slot-label">' +
            (which === 'pet' ? 'Pet' : 'Equipment') +
            '</span>';
        // Equipment slot 2 only once slot 1 is filled.
        btn.disabled = which === 'eq1' && !(a && a.eq.length);
      });
      var mode = $('.am-mode', row);
      if (mode) {
        var air = !!(a && a.air);
        mode.classList.toggle('is-air', air);
        $('.am-mode-v', mode).textContent = air ? 'Air' : 'Ground';
        mode.setAttribute('aria-label', 'Grand Warden mode: ' + (air ? 'air' : 'ground') + '. Tap to switch.');
        mode.title = air ? 'Air mode (tap for ground)' : 'Ground mode (tap for air)';
        mode.disabled = !a;
      }
    });

    // Meters: tabs, group headings and the bar.
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
    $$('[data-meter]').forEach(function (el) {
      el.innerHTML = M[el.dataset.meter] || '';
    });
    var fill = {
      troops: u.troops / TH.troops,
      spells: u.spells / TH.spells,
      heroes: u.heroes / TH.heroes,
      cc: u.ccTroops / (TH.cc.troops || 1),
    };
    $$('.am-meter').forEach(function (el) {
      var f = fill[el.dataset.fill] || 0;
      el.style.setProperty('--fill', Math.min(1, f));
      el.classList.toggle('is-full', f >= 1);
      el.classList.toggle('is-over', f > 1);
    });

    renderBar();
  }

  // The bar: one chip per unit in the army (tap = one fewer), then the buttons.
  // label: "CC" (top-left) for clan castle units. mode: the Warden's
  // "Ground" / "Air", written along his picture's bottom edge.
  function chip(kind, u, n, label, mode) {
    return (
      '<button type="button" class="am-chip" data-kind="' +
      kind +
      '" data-id="' +
      u.id +
      '" title="Remove one ' +
      esc(u.name) +
      '"><img src="' +
      esc(img(u)) +
      '" alt="" width="128" height="128">' +
      (n ? '<span class="am-chip-n">' + n + '</span>' : '') +
      (label ? '<span class="am-chip-tag">' + label + '</span>' : '') +
      (mode ? '<span class="am-chip-mode">' + mode + '</span>' : '') +
      '<span class="am-chip-x" aria-hidden="true"></span>' +
      '<span class="am-vh">Remove one ' +
      esc(u.name) +
      '</span></button>'
    );
  }
  function renderBar() {
    var html = '';
    data.heroes.forEach(function (h) {
      if (!s.heroes.has(h.id)) return;
      html += chip('hero', h, 0, '', h.modes ? (s.heroes.get(h.id).air ? 'Air' : 'Ground') : '');
    });
    var TS = data.troops.concat(data.sieges);
    TS.forEach((u) => s.troops.has(u.id) && (html += chip('troop', u, s.troops.get(u.id), '')));
    data.spells.forEach((u) => s.spells.has(u.id) && (html += chip('spell', u, s.spells.get(u.id), '')));
    TS.forEach((u) => s.ccTroops.has(u.id) && (html += chip('ccTroop', u, s.ccTroops.get(u.id), 'CC')));
    data.spells.forEach((u) => s.ccSpells.has(u.id) && (html += chip('ccSpell', u, s.ccSpells.get(u.id), 'CC')));
    var list = $('#amList');
    list.innerHTML = html || '<span class="am-empty">Empty. Tap units under Add units to fill it.</span>';
    list.classList.toggle('is-empty', !html);
    $('#amListNote').hidden = !html;
    $('#amBar').hidden = !html; // the whole "Your army" part only shows once there's an army // "Tap a unit here to remove it" only once there's something to remove

    var c = code();
    var open = $('#amOpen');
    $$('[data-act]').forEach((b) => (b.disabled = !c));
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
    buildPanels();
    changed();
    if (gone.length) toast('Removed (not unlocked at TH' + n + '): ' + gone.join(', '));
  }

  // ---- Events -------------------------------------------------------------
  root.addEventListener('click', function (e) {
    var t = e.target.closest('button, a');
    if (!t || !root.contains(t) || t.disabled) return;

    if (t.dataset.pick) return pick(t.dataset.pick);
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
    if (t.classList.contains('am-tab')) return showTab(t.dataset.tab);

    var id = parseInt(t.dataset.id, 10);
    if (t.classList.contains('am-chip')) {
      if (t.dataset.kind === 'hero') {
        s.heroes.delete(id);
        if (picking && picking.hero === id) closePicker();
        return changed();
      }
      return remove(t.dataset.kind, id);
    }
    if (t.classList.contains('am-tile') && t.dataset.kind === 'hero') {
      if (s.heroes.has(id)) {
        s.heroes.delete(id);
        if (picking && picking.hero === id) closePicker();
      } else if (s.heroes.size >= TH.heroes) return toast('Hero slots are full (' + TH.heroes + '/' + TH.heroes + ')');
      else s.heroes.set(id, { pet: null, eq: [], air: false });
      return changed();
    }
    if (t.classList.contains('am-tile') && t.dataset.kind) return add(t.dataset.kind, id);
    // Mode first: the Warden's mode box also wears .am-slot for its look.
    if (t.classList.contains('am-mode')) {
      var a = s.heroes.get(parseInt(t.dataset.hero, 10));
      if (a) a.air = !a.air;
      return changed();
    }
    if (t.classList.contains('am-slot')) return openPicker(parseInt(t.dataset.hero, 10), t.dataset.slot);

    if (t.id === 'amOpen' && t.getAttribute('aria-disabled') === 'true') return e.preventDefault();
    var act = t.dataset.act;
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
  var LINK_ICO =
    '<svg viewBox="0 0 24 24" class="am-ico" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  var PAGE_ICO =
    '<svg viewBox="0 0 24 24" class="am-ico" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/></svg>';
  var MORE_ICO =
    '<svg viewBox="0 0 24 24" class="am-ico" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M7 8l5-5 5 5"/></svg>';
  var shareMenuEl = document.createElement('div');
  shareMenuEl.className = 'am-pop am-share-menu';
  shareMenuEl.id = 'amShareMenu';
  shareMenuEl.setAttribute('role', 'menu');
  shareMenuEl.hidden = true;
  shareMenuEl.innerHTML =
    '<button type="button" role="menuitem" data-share="game">' +
    LINK_ICO +
    '<span>Copy game link</span></button>' +
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
    closePicker();
    changed();
    toast(skipped.length ? 'Loaded. Left out: ' + skipped.join(', ') : 'Army loaded');
  });

  function showTab(name) {
    $$('.am-tab').forEach(function (b) {
      var on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on);
      b.tabIndex = on ? 0 : -1;
    });
    $$('.am-panel').forEach(function (p) {
      p.hidden = p.dataset.panel !== name;
    });
    if (picking) closePicker();
  }
  // Arrow keys move between tabs (the usual tablist keyboard pattern).
  $('.am-tabs').addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var tabs = $$('.am-tab');
    var i = tabs.indexOf(document.activeElement);
    if (i === -1) return;
    var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    showTab(next.dataset.tab);
    next.focus();
  });

  // ---- "Armies" highlighted in the navs ---------------------------------------
  // The army maker belongs to the Armies section, but the nav scripts only
  // light up the link whose href is this page, and none is. So light Armies
  // here: the bottom nav's (thz-script.js clears it on load) and the top
  // bar's hub link (th-layouts.js builds that strip after a fetch -- the
  // observer catches it arriving).
  function markArmies() {
    var bn = document.querySelector('.bn-item[data-role="bn-armies"]');
    if (bn) bn.classList.add('active');
    // Phones: the Layouts / Army / Guides tabs under the hero.
    document.querySelectorAll('.first-layer button').forEach(function (b) {
      b.classList.toggle('active', b.textContent.trim() === 'Army');
    });
    document.querySelectorAll('#stbHubNavScroll .stb-hub-link').forEach(function (a) {
      a.classList.toggle('active', /-army\.html$/.test(a.getAttribute('href') || ''));
    });
  }
  markArmies();
  document.addEventListener('parchome:coc-nav-ready', markArmies);
  var hub = document.getElementById('stbHubNavScroll');
  if (hub && window.MutationObserver) new MutationObserver(markArmies).observe(hub, { childList: true });

  // ---- Start --------------------------------------------------------------
  fetch('coc-army-data.json')
    .then((r) => r.json())
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
      buildPanels();
      showTab('troops');
      changed();
      root.classList.add('is-ready');
      if (skipped && skipped.length) toast('Left out: ' + skipped.join(', '));
    })
    .catch(function (err) {
      console.error('Army maker data failed to load:', err);
      $('#amList').innerHTML = '<span class="am-empty">The army maker could not load. Refresh the page to try again.</span>';
    });
})();
