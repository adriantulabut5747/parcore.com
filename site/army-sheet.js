/* Army sheet: an army drawn from its Copy Army link. Used by the army
   pages (/coc/town-hall-NN/army), the army maker and articles. Load it
   before th-layouts.js / coc-armymaker.js on pages that draw armies.
   Split out of th-layouts.js, Oct 2026, so articles can use it without
   loading the Town Hall pages' chrome. Styles: army-sheet.css. */

// ARMY SHEET -- an army drawn from its Copy Army link (army= code), shared
// by the army cards (thNN-army.html, layoutCards below) and the army maker
// (/coc/tools/army-maker), so the two always look the same. Exposed as
// window.ArmySheet:
//   load()              fetches coc-army-data.json once; resolves when ready
//   html(th, code, opt) the sheet's markup for a Town Hall + army= code.
//                       opt.edit (army maker): every unit, hero, pet and
//                       equipment box carries what tapping it does
//                       (data-sheet: remove / hero / slot / mode), and
//                       empty pet / equipment slots are drawn so they can be
//                       tapped. opt.stack: heroes on top, units below at
//                       every width (the phone arrangement).
//   wire(root)          names on hover / tap, empty places, edge fades.
//                       Call again after redrawing; listeners attach once.
//   parse(code)         the code as units (see parseArmy), after load().
(function armySheet() {
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // Template tag: builds the string, then drops the whitespace between tags.
  function tidy(strings) {
    var out = strings[0];
    for (var i = 1; i < strings.length; i++) out += arguments[i] + strings[i];
    return out.replace(/>\s+</g, '><').trim();
  }

  // ---- Army sheet: the card's picture, built from its Copy Army link ----
  // The army= code already lists every hero, pet, equipment, troop, spell
  // and clan castle unit (format: see the top of coc-armymaker.js), and
  // coc-army-data.json turns each id into a name, an icon and a housing
  // space. So the card draws the army itself instead of showing a
  // screenshot. Links carry no unit levels, so the tiles show counts only.
  // Heroes wear their Dragonscale skin (clashofclans/coctools/dragonscale/,
  // same file names as the hero icons). The set has no Dragon Duke, so his
  // file there is the Imprisoned Duke skin, which shares its dark armour
  // and glowing-ember look.
  var ARMY_DATA = '/coc-army-data.json';
  var HERO_ART = '/clashofclans/coctools/dragonscale/';
  // Where each render's face is, so every portrait shows the face at the
  // same size, centred, with the eyes on the same line. The renders are
  // framed very differently (the Warden is small in his image, wings and
  // all; the King's sword pushes him left), so each is scaled by the
  // distance between its eyes -- the one measure hats, horns and beards
  // don't change. x / y: the point between the eyes; h: three eye-spacings
  // (about a head), all as fractions of the image. Measured on the 480px
  // renders.
  var HERO_FACE = {
    0: [0.404, 0.229, 0.15], // King: eyes 194,110; spacing 24px
    1: [0.461, 0.26, 0.156], // Queen: 221,125; 25px
    2: [0.532, 0.3, 0.169], // Warden: 255,144; 27px
    4: [0.461, 0.281, 0.169], // Champion: 221,135; 27px
    6: [0.525, 0.277, 0.169], // Prince: 252,133 (visor); ~27px
    // Duke (Imprisoned): eye glows 249 + 290, 201; 41px. His eyes sit high
    // on the helmet, so his y is aimed 16px above them, which drops him a
    // little lower in the frame and puts his face level with the others.
    7: [0.561, 0.385, 0.256],
  };
  // Each hero's own banner (the flag from its Hero Hall banner), top-left
  // of the portrait. clashofclans/coctools/banners/, hero file names.
  var BANNERS = '/clashofclans/coctools/banners/';
  // Pet strip: where the pet's face is in its square icon (object-position
  // and zoom origin), so the wide crop keeps the face.
  var PET_FOCUS = {
    0: '50% 22%',
    1: '50% 40%',
    2: '50% 28%',
    3: '62% 28%',
    4: '58% 22%',
    7: '62% 28%',
    8: '45% 45%',
    9: '50% 28%',
    10: '50% 52%',
    11: '50% 45%',
    16: '50% 24%',
    17: '72% 18%',
  };
  var units = null; // set by load(), from coc-army-data.json

  function indexUnits(d) {
    var by = function (list) {
      var m = {};
      (list || []).forEach(function (u) {
        m[u.id] = u;
      });
      return m;
    };
    // eventTroops: temporary troops (Lavaloon...), for drawing a link only;
    // the maker never lists them (scripts/build-event-troops.py).
    var troop = by((d.troops || []).concat(d.sieges || [], d.eventTroops || []));
    (d.sieges || []).forEach(function (u) {
      troop[u.id].siege = true;
    });
    return {
      dir: d.imageDir,
      th: d.townHalls || {},
      hero: by(d.heroes),
      pet: by(d.pets),
      equip: by(d.equipment),
      troop: troop,
      spell: by(d.spells),
      // the first Town Hall with pets (the Pet House)
      petTh: Math.min.apply(null, (d.pets || []).map((p) => p.th).concat(99)),
    };
  }

  // army= code -> { heroes: [{hero, pet, eq[], air}], troops, sieges,
  // spells, ccTroops, ccSieges, ccSpells: [{u, n}] }. Unknown ids are
  // skipped; '' is an empty army (the maker before you tap anything);
  // null when the code isn't an army code at all.
  function parseArmy(code) {
    var out = { heroes: [], troops: [], sieges: [], spells: [], ccTroops: [], ccSieges: [], ccSpells: [] };
    if (code === '') return out;
    if (!/^[hidus][0-9hidusmpex_-]*$/.test(code)) return null;
    var re = /([hidus])([^hidus]*)/g;
    var sec;
    while ((sec = re.exec(code))) {
      var key = sec[1];
      sec[2]
        .split('-')
        .filter(Boolean)
        .forEach(function (part) {
          if (key === 'h') {
            var g = part.match(/^(\d+)(?:m(\d+))?(?:p(\d+))?(?:e(\d+)(?:_(\d+))?)?$/);
            var h = g && units.hero[g[1]];
            if (!h) return;
            out.heroes.push({
              hero: h,
              air: g[2] === '1',
              pet: g[3] != null ? units.pet[g[3]] || null : null,
              eq: [g[4], g[5]]
                .map(function (e) {
                  return e != null ? units.equip[e] : null;
                })
                .filter(Boolean),
            });
            return;
          }
          var nx = part.split('x');
          var n = parseInt(nx[0], 10);
          var spell = key === 'd' || key === 's';
          var u = (spell ? units.spell : units.troop)[nx[1]];
          if (!(n > 0) || !/^\d+$/.test(nx[1] || '')) return;
          // An id we don't know yet (a brand-new event troop): a "?" tile
          // with its count, so the army isn't silently missing a unit. Its
          // housing isn't known, so used() counts it as 1 a unit.
          if (!u) u = { id: nx[1], name: (spell ? 'Unknown spell' : 'Unknown troop') + ' (id ' + nx[1] + ')', space: 0, img: null };
          var cc = key === 'i' || key === 'd';
          var list = spell ? (cc ? 'ccSpells' : 'spells') : u.siege ? (cc ? 'ccSieges' : 'sieges') : cc ? 'ccTroops' : 'troops';
          out[list].push({ u: u, n: n });
        });
    }
    return out;
  }

  function used(list, perUnit) {
    return list.reduce(function (t, x) {
      return t + x.n * (perUnit ? 1 : x.u.space || 1);
    }, 0);
  }
  // kind: what the tile is, for the army maker (troop / spell / ccTroop /
  // ccSpell -- siege machines count as troops, as in the link). In edit
  // mode the tile is a button that removes one.
  var edit = false; // set by each html() call
  function unitTile(x, kind) {
    var label = x.n + ' ' + x.u.name;
    // Super troops get a red count chip (.is-super) so they stand out.
    var sup = x.u.super ? ' is-super' : '';
    var pic = x.u.img ? `<img src="${esc(units.dir + x.u.img)}" alt="" loading="lazy" decoding="async">` : '<span class="as-unknown" aria-hidden="true">?</span>';
    var inner = `${pic}<b class="as-n">×${x.n}</b>`;
    if (edit)
      return `<button type="button" class="as-tile${sup}" data-sheet="remove" data-kind="${kind}" data-id="${x.u.id}" aria-label="Remove one ${esc(x.u.name)} (${x.n})" title="${esc(label)}" data-name="${esc(x.u.name)} ×${x.n}">${inner}</button>`;
    return `<span class="as-tile${sup}" role="img" aria-label="${esc(label)}" title="${esc(label)}" data-name="${esc(x.u.name)} ×${x.n}">${inner}</span>`;
  }
  // Pets and equipment. Equipment gets its rarity colour (.as-epic purple,
  // .as-common blue, as in-game); the pet gets its face focus.
  // In edit mode (slot = 'pet' / 'eq0' / 'eq1' of hero heroId) it's a
  // button that opens the maker's picker for that slot, and u null draws
  // the empty slot as a "+".
  var PLUS = '<svg class="as-plus" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>';
  function gearTile(u, cls, focus, heroId, slot) {
    var style = focus ? ` style="--pf:${focus}"` : '';
    if (edit) {
      var what = slot === 'pet' ? 'pet' : 'equipment';
      var label = u ? 'Change ' + what + ': ' + u.name : 'Choose ' + what;
      var inner = u ? `<img src="${esc(units.dir + u.img)}"${style} alt="" loading="lazy" decoding="async">` : PLUS;
      var named = u ? ` data-name="${esc(u.name)}"` : '';
      return `<button type="button" class="as-tile ${cls}${u ? '' : ' as-open'}" data-sheet="slot" data-hero="${heroId}" data-slot="${slot}" aria-label="${esc(label)}" title="${esc(label)}"${named}>${inner}</button>`;
    }
    return `<span class="as-tile ${cls}" role="img" aria-label="${esc(u.name)}" title="${esc(u.name)}" data-name="${esc(u.name)}"><img src="${esc(units.dir + u.img)}"${style} alt="" loading="lazy" decoding="async"></span>`;
  }
  // One labelled group: name on the left, "used/max" on the right, then a
  // row of tiles that scrolls sideways when it doesn't fit.
  // Clan castle: the CC heading icon -- a tall crenellated tower with an
  // arched gate, rising out of low walls (like the in-game building).
  // Oct 2026: replaced a keep with the clan's pennant on top.
  var CASTLE =
    '<path d="M3 21v-9h2.5v2.5H8"/><path d="M16 14.5h2.5V12H21v9"/><path d="M8 21V4.5h2.25V7h3.5V4.5H16V21"/><path d="M2 21h20"/><path d="M10.25 21v-3a1.75 1.75 0 0 1 3.5 0v3"/>';
  // Section icons (muted grey, before each heading, like the game's
  // headers): crown, army camp tent, potion flask, siege wagon, castle.
  // Stroke icons: crown, tent and flask are Lucide (ISC licence); the castle
  // and siege ram are drawn for this site in the same 2px line.
  var SECTION_ICONS = {
    heroes:
      '<path d="M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.3l4.27-3.67a.5.5 0 0 1 .8.52l-2.83 10.25a1 1 0 0 1-.96.73H5.81a1 1 0 0 1-.96-.73L2.02 6.02a.5.5 0 0 1 .8-.52L7.1 9.17a1 1 0 0 0 1.52-.3z"/><path d="M5 21h14"/>',
    troops: '<path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/>',
    spells:
      '<path d="M14 2v6a2 2 0 0 0 .25.96l5.5 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.75-2.96l5.5-10.08A2 2 0 0 0 10 8V2"/><path d="M6.45 15h11.1"/><path d="M8.5 2h7"/>',
    // a covered battering ram on wheels, with a solid iron head
    siege:
      '<path d="M2.5 10.5 8.25 6 14 10.5"/><path d="M2.5 10.5H14V15H2.5z"/><path d="M14 12.75h2.5"/><path d="M16.5 10h2.75l2.75 2.75-2.75 2.75H16.5z" fill="currentColor"/><circle cx="5.25" cy="19" r="2"/><circle cx="11.25" cy="19" r="2"/>',
    castle: CASTLE,
  };
  function ico(name) {
    return `<svg class="as-ico" viewBox="0 0 24 24" aria-hidden="true">${SECTION_ICONS[name]}</svg>`;
  }
  // Heading: icon + label (the label swaps for a unit's name on hover /
  // tap, the icon stays), and the used/max counts on the right.
  function headHtml(label, icon, cap) {
    return `<div class="as-head"><span class="as-title">${ico(icon)}<span class="as-label" data-label="${esc(label)}">${esc(label)}</span></span>${cap}</div>`;
  }
  // "340/352": the used number in the accent red, the room after the slash muted.
  function capHtml(have, max) {
    return `<b>${have}</b>/${max}`;
  }
  // slots: a fixed number of places for this row (siege: one per siege
  // the Town Hall can bring); without it, empty places fill the row's width.
  function group(cls, label, icon, have, max, tiles, slots) {
    var cap = max ? `<span class="as-cap">${capHtml(have, max)}</span>` : '';
    var fixed = slots ? ` data-slots="${slots}"` : '';
    return `<div class="as-group ${cls}">${headHtml(label, icon, cap)}<div class="as-row"${fixed}>${tiles}</div></div>`;
  }

  // Grand Warden's mode, as a small icon in the portrait's top-right
  // corner like the in-game boot: a boot for ground, a wing for air.
  var GROUND =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h6.5v8.2l4.9 1.9A3 3 0 0 1 20.3 16v1.5H4.2v-3.6c0-.6.2-1.2.6-1.7L7 10.6V3Z"/><path d="M4.2 19h16.1v1.2a.8.8 0 0 1-.8.8H5a.8.8 0 0 1-.8-.8V19Z"/></svg>';
  var AIR =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18.5C4.6 10.8 10.2 5 21 3.6c-1.3 2.9-3.2 4.7-5.8 5.5 1.7.2 3.1-.1 4.3-.7-1.1 2.6-3.1 4.2-5.9 4.8 1.3.4 2.6.4 3.8 0-2.3 3.4-6.2 5.2-11.2 5L4.5 20.5H3v-2Z"/></svg>';
  function heroCol(x, hasPets) {
    var h = x.hero;
    var mode = '';
    if (h.modes && edit)
      mode = `<button type="button" class="as-mode" data-sheet="mode" data-hero="${h.id}" aria-label="Switch to ${x.air ? 'ground' : 'air'} mode" title="${x.air ? 'Air' : 'Ground'} mode: tap to switch">${x.air ? AIR : GROUND}</button>`;
    else if (h.modes) mode = `<span class="as-mode" aria-hidden="true">${x.air ? AIR : GROUND}</span>`;
    var eqTile = (q, i) => gearTile(q, 'as-eq' + (q ? (q.epic ? ' as-epic' : ' as-common') : ''), null, h.id, 'eq' + i);
    var eq, pet, petSide;
    if (edit) {
      // Every slot, filled or not, so each one can be tapped.
      eq = [x.eq[0] || null, x.eq[1] || null].map(eqTile).join('');
      pet = hasPets ? gearTile(x.pet, 'as-pet', x.pet && PET_FOCUS[x.pet.id], h.id, 'pet') : '';
      petSide = hasPets ? gearTile(x.pet, 'as-pet-side', null, h.id, 'pet') : '';
    } else {
      eq = x.eq.map(eqTile).join('');
      pet = x.pet ? gearTile(x.pet, 'as-pet', PET_FOCUS[x.pet.id]) : '';
      // Phones show the pet beside the portrait, at the top of the equipment
      // column, so the hero can be thin and short. That copy (.as-pet-side)
      // is hidden elsewhere; the band inside the portrait is hidden on phones.
      petSide = x.pet ? gearTile(x.pet, 'as-pet-side') : '';
    }
    var f = HERO_FACE[h.id] || [0.5, 0.25, 0.2];
    var banner = `<img class="as-banner" src="${esc(BANNERS + h.img)}" alt="" loading="lazy" decoding="async">`;
    var name = h.name + (h.modes ? ' · ' + (x.air ? 'Air' : 'Ground') : '');
    var portrait = edit
      ? `<div class="as-portrait" data-sheet="hero" data-hero="${h.id}" role="button" tabindex="0" aria-label="Change or remove ${esc(name)}" title="${esc(name)}: tap to change" data-name="${esc(name)}">`
      : `<div class="as-portrait" role="img" aria-label="${esc(name)}" title="${esc(name)}" data-name="${esc(name)}">`;
    return `<div class="as-hero">${portrait}<img class="as-art" src="${esc(HERO_ART + h.img)}" style="--fx:${f[0]};--fy:${f[1]};--hh:${f[2]}" alt="" loading="lazy" decoding="async">${banner}${mode}${pet}</div><div class="as-gear">${petSide}${eq}</div></div>`;
  }

  function sheetHtml(th, code, opt) {
    var army = units && code != null ? parseArmy(code) : null;
    if (!army) return '';
    edit = !!(opt && opt.edit);
    var cap = units.th[th] || {};
    var cc = cap.cc || {};
    var hasPets = units.petTh <= th;
    var slots = Math.max(cap.heroes || 0, army.heroes.length);
    var heroes = army.heroes.map((x) => heroCol(x, hasPets)).join('');
    // Empty hero slots. In the maker they open the hero picker.
    for (var i = army.heroes.length; i < slots; i++)
      heroes += edit
        ? `<div class="as-hero as-empty"><button type="button" class="as-portrait" data-sheet="hero" aria-label="Add a hero" title="Add a hero">${PLUS}</button></div>`
        : '<div class="as-hero as-empty" aria-hidden="true"><div class="as-portrait"></div></div>';
    var tiles = (list, kind) => list.map((x) => unitTile(x, kind)).join('');
    var mid = group('as-spells', 'Spells', 'spells', used(army.spells), cap.spells, tiles(army.spells, 'spell'));
    if (cap.sieges)
      mid += group('as-sieges', 'Siege', 'siege', used(army.sieges, true), cap.sieges, tiles(army.sieges, 'troop'), cap.sieges);
    // Clan castle: one row, troops then spells then siege (each kind starts
    // a little apart, .as-kind), with the three used/max counts in the
    // heading in that same order -- the in-game CC bar does the same.
    var ccKinds = [
      [army.ccTroops, used(army.ccTroops), cc.troops, 'ccTroop'],
      [army.ccSpells, used(army.ccSpells), cc.spells, 'ccSpell'],
      [army.ccSieges, used(army.ccSieges, true), cc.sieges, 'ccTroop'],
    ].filter((k) => k[0].length || k[2]);
    var ccCaps = ccKinds.map((k) => capHtml(k[1], k[2])).join(' · ');
    var ccTiles = ccKinds
      .filter((k) => k[0].length)
      .map((k) => tiles(k[0], k[3]).replace(/class="as-tile( is-super)?"/, 'class="as-tile$1 as-kind"'))
      .join('');
    var bottom = `<div class="as-group as-cc">${headHtml('Clan Castle', 'castle', `<span class="as-cap">${ccCaps}</span>`)}<div class="as-row">${ccTiles}</div></div>`;
    // Phones (cards only, not the maker): troops, spells and siege in one
    // "Army" row -- troops first, then spells, then siege, each kind a
    // little apart -- with the three used/max counts in that order. The
    // separate rows stay in the markup for desktop; CSS picks which shows.
    var armyRow = '';
    if (!edit) {
      var armyKinds = [
        [army.troops, used(army.troops), cap.troops, 'troop'],
        [army.spells, used(army.spells), cap.spells, 'spell'],
        [army.sieges, used(army.sieges, true), cap.sieges, 'troop'],
      ].filter((k) => k[0].length || k[2]);
      var armyTiles = armyKinds
        .filter((k) => k[0].length)
        .map((k) => tiles(k[0], k[3]).replace(/class="as-tile( is-super)?"/, 'class="as-tile$1 as-kind"'))
        .join('');
      armyRow = `<div class="as-group as-army">${headHtml('Army', 'troops', `<span class="as-cap">${armyKinds.map((k) => capHtml(k[1], k[2])).join(' · ')}</span>`)}<div class="as-row">${armyTiles}</div></div>`;
    }
    return tidy`
      <div class="army-sheet${edit ? ' is-edit' : ''}${opt && opt.stack ? ' is-stack' : ''}" style="--slots:${slots}">
        <div class="as-heroes">
          ${headHtml('Heroes', 'heroes', `<span class="as-cap">${capHtml(army.heroes.length, slots)}</span>`)}
          <div class="as-hero-row">${heroes}</div>
        </div>
        <div class="as-units">
          ${armyRow}
          ${group('as-troops', 'Troops', 'troops', used(army.troops), cap.troops, tiles(army.troops, 'troop'))}
          <div class="as-pair">${mid}</div>
          ${bottom}
        </div>
      </div>`;
  }

  // Hover or tap a tile: its name (and count) shows in place of its
  // group's label, so the name never gets clipped by a scrolling row.
  // Moving off (or tapping anything else) puts the label back.
  // The tile being named also gets a red ring (.is-on).
  var namedLabel = null;
  var namedTile = null;
  function showName(tile) {
    if (namedTile) namedTile.classList.remove('is-on');
    namedTile = tile || null;
    if (tile) tile.classList.add('is-on');
    var block = tile && tile.closest('.as-group, .as-heroes');
    var label = block && block.querySelector('.as-label');
    if (namedLabel && namedLabel !== label) {
      namedLabel.textContent = namedLabel.dataset.label;
      namedLabel.classList.remove('is-name');
      namedLabel.closest('.as-group, .as-heroes').style.width = '';
    }
    namedLabel = label || null;
    if (!label) return;
    // Hold the block at its current width while the name shows: a group
    // that sizes to its content (Siege) would otherwise grow to fit a long
    // name like "Log Launcher" and shove its neighbour. The label's
    // ellipsis cuts the name off at the counts instead.
    if (!label.classList.contains('is-name')) block.style.width = block.getBoundingClientRect().width + 'px';
    label.textContent = tile.dataset.name;
    label.classList.add('is-name');
  }
  // Rows that overflow get an edge fade on whichever side has more to
  // scroll to (.more-l / .more-r). A ResizeObserver also catches rows on
  // hidden pages becoming visible.
  // Empty places: darker boxes after the last unit, showing where the next
  // one would go. They fill whatever width the row has left (or, with
  // data-slots, up to that many places) and never make a row scroll.
  // The row's width never depends on them, so refilling on resize can't
  // loop. OVERLAP matches the tiles' negative margin in th-layouts.css.
  // Many rows at once (the Player Tracker draws 24 sheets = ~100 rows): all
  // writes, then all reads, then all writes, so the page is laid out once.
  // Measuring row by row between writes laid the whole page out ~200 times
  // and froze it for seconds.
  var OVERLAP = 4;
  function fillRows(rows) {
    var jobs = rows.map(function (row) {
      [].slice.call(row.querySelectorAll('.as-ph')).forEach((p) => p.remove());
      var slots = parseInt(row.dataset.slots, 10);
      var probe = null;
      if (!slots) {
        probe = document.createElement('span');
        probe.className = 'as-tile as-ph';
        row.appendChild(probe);
      }
      return { row: row, slots: slots, probe: probe, n: 0 };
    });
    jobs.forEach(function (j) {
      var row = j.row;
      if (j.slots) {
        j.n = j.slots - row.children.length;
        return;
      }
      var tile = j.probe.offsetWidth;
      if (!tile) return; // row not laid out (card on another page)
      var step = tile - OVERLAP;
      var last = j.probe.previousElementSibling;
      // place k's right edge: after units, lastRight + k*step; in an empty
      // row, k*step + OVERLAP (the first place has no overlap).
      var start = last ? last.getBoundingClientRect().right - row.getBoundingClientRect().left + row.scrollLeft : OVERLAP;
      j.n = Math.floor((row.clientWidth - start) / step);
    });
    jobs.forEach(function (j) {
      if (j.probe) j.probe.remove();
      for (var i = 0; i < j.n; i++) {
        var ph = document.createElement('span');
        ph.className = 'as-tile as-ph';
        ph.setAttribute('aria-hidden', 'true');
        j.row.appendChild(ph);
      }
    });
  }
  function edgeFade(row) {
    var max = row.scrollWidth - row.clientWidth;
    row.classList.toggle('more-l', max > 1 && row.scrollLeft > 1);
    row.classList.toggle('more-r', max > 1 && row.scrollLeft < max - 1);
  }
  var ro =
    'ResizeObserver' in window
      ? new ResizeObserver(function (es) {
          var rows = es.map((e) => e.target);
          fillRows(rows.filter((r) => r.classList.contains('as-row')));
          rows.forEach(edgeFade);
        })
      : null;
  var docWired = false;
  function wireSheets(root) {
    var fresh = [];
    root.querySelectorAll('.as-row, .as-hero-row').forEach(function (row) {
      if (row.dataset.wired) return;
      row.dataset.wired = '1';
      row.addEventListener('scroll', () => edgeFade(row), { passive: true });
      if (ro) ro.observe(row);
      else fresh.push(row);
    });
    if (fresh.length) {
      fillRows(fresh.filter((r) => r.classList.contains('as-row')));
      fresh.forEach(edgeFade);
    }
    // A redrawn sheet takes the shown name away with its old nodes.
    if (namedLabel && !document.contains(namedLabel)) namedLabel = namedTile = null;
    if (root.dataset.sheetWired) return;
    root.dataset.sheetWired = '1';
    root.addEventListener('mouseover', function (e) {
      var t = e.target.closest('[data-name]');
      if (t) showName(t);
    });
    root.addEventListener('mouseout', function (e) {
      var t = e.target.closest('[data-name]');
      if (t && !t.contains(e.relatedTarget)) showName(null);
    });
    if (docWired) return;
    docWired = true;
    document.addEventListener('click', function (e) {
      showName(e.target.closest('.army-sheet [data-name]'));
    });
  }

  // Loading skeleton: the sheet's own layout (same classes, so the same
  // shape at every width) with grey shimmering blocks in place of the art.
  // opt.stack: the maker's arrangement. Replaced as soon as the army draws.
  function skeletonHtml(opt) {
    var blocks = (n) => '<span class="as-tile sk"></span>'.repeat(n);
    var hero = '<div class="as-hero as-empty"><div class="as-portrait sk"></div></div>';
    var head = (w) => `<div class="as-head"><span class="sk sk-line" style="width:${w}px"></span></div>`;
    var grp = (cls, w, n) => `<div class="as-group ${cls}">${head(w)}<div class="as-row">${blocks(n)}</div></div>`;
    return tidy`
      <div class="army-sheet is-skel${opt && opt.stack ? ' is-stack' : ''}" style="--slots:4" aria-hidden="true">
        <div class="as-heroes">${head(64)}<div class="as-hero-row">${hero.repeat(4)}</div></div>
        <div class="as-units">
          ${opt && opt.stack ? '' : grp('as-army', 60, 14)}
          ${grp('as-troops', 70, 12)}
          <div class="as-pair">${grp('as-spells', 54, 6)}${grp('as-sieges', 44, 3)}</div>
          ${grp('as-cc', 90, 8)}
        </div>
      </div>`;
  }

  var loading = null;
  window.ArmySheet = {
    skeleton: skeletonHtml,
    load: function () {
      if (!loading)
        loading = fetch(ARMY_DATA)
          .then((r) => r.json())
          .then(function (d) {
            units = indexUnits(d);
          });
      return loading;
    },
    html: sheetHtml,
    wire: wireSheets,
    parse: parseArmy, // after load(): the Player Tracker's battle log draws a slim army strip from it
  };
})();
