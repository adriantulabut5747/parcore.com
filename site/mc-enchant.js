/* Enchanted Item generator (Oct 13 2026), /minecraft/tools/enchanted-item.
   Builds the pickers and writes one /give command in the syntax of the picked
   game version:
     2 = 1.21.5 and newer  item[enchantments={sharpness:5},custom_name={"text":..}]
     1 = 1.20.5 - 1.21.4   item[enchantments={levels:{..}},custom_name='{"text":..}']
     0 = 1.14 - 1.20.4     item{Enchantments:[{id:..,lvl:5s}],display:{Name:'..'}}
   TYPES / ENCH / ATTRS live in mc-items.js (shared with mc-mob.js).
   Oct 15: form tabs (shared .mch-tabs engine in mc-home.js), attribute list,
   hide enchantments / whole tooltip, count, free-text target, 7 more items.
   The Enchanted Book is special: its enchantments go in stored_enchantments
   (StoredEnchantments before 1.20.5). In plain "enchantments" the book glints
   but does nothing in an anvil.
   Copy button: mc-home.js (.mch-copy[data-copy]). Styles: WEB TOOLS in mc-home.css. */
(function () {
  var root = document.getElementById('enType');
  if (!root) return;

  // Items, enchantments and attributes are shared with the mob summoner: mc-items.js (load it first).
  var MCI = window.McItems, TYPES = MCI.TYPES, ENCH = MCI.ENCH, ATTRS = MCI.ATTRS;
  var MAT_V = { copper: 2 }; // copper gear: 1.21.9
  // [slot, picker label, tooltip header]
  var SLOTS = [
    ['mainhand', 'Main hand', 'When in Main Hand:'], ['offhand', 'Off hand', 'When in Off Hand:'],
    ['hand', 'Either hand', 'When in Hand:'], ['head', 'Head', 'When on Head:'], ['chest', 'Chest', 'When on Body:'],
    ['legs', 'Legs', 'When on Legs:'], ['feet', 'Feet', 'When on Feet:'], ['armor', 'Any armor slot', 'When worn:'],
    ['any', 'Anywhere', 'When equipped:']
  ];
  var COLORS = {
    white: 'ffffff', gray: 'aaaaaa', dark_gray: '555555', black: '000000',
    red: 'ff5555', dark_red: 'aa0000', gold: 'ffaa00', yellow: 'ffff55',
    green: '55ff55', dark_green: '00aa00', aqua: '55ffff', dark_aqua: '00aaaa',
    blue: '5555ff', dark_blue: '0000aa', light_purple: 'ff55ff', dark_purple: 'aa00aa'
  };
  var LEATHER = { helmet: 'Leather Cap', chestplate: 'Leather Tunic', leggings: 'Leather Pants' };
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  var s = { ver: 2, type: 'sword', mat: 'diamond', ench: {}, all: false, color: '', attrs: {}, slot: 'mainhand' };
  var $ = function (id) { return document.getElementById(id); };

  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function type() { return TYPES.filter(function (t) { return t.id === s.type; })[0]; }
  function itemId() { return type().mats ? s.mat + '_' + s.type : s.type; }
  function icon(id) { return '/minecrafticons/items/' + id + '.png'; }
  function ok(x) { return (x.v || 0) <= s.ver; }
  function isBook() { return s.type === 'enchanted_book'; }
  function fits(e) { return isBook() || e.on.indexOf(s.type) > -1; } // a book takes anything
  // Ticked attributes in list order; none before 1.20.5.
  function attrs() { return s.ver ? ATTRS.filter(function (a) { return a[0] in s.attrs; }) : []; }
  function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1); }
  // Player Head owner: Java usernames are 3-16 of A-Z, 0-9, _ so anything else is dropped.
  function owner() { return s.type === 'player_head' ? $('enOwner').value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16) : ''; }
  function itemName() {
    var t = type();
    if (owner()) return owner() + "'s Head"; // what the game calls a named head
    if (!t.mats) return t.name;
    if (s.mat === 'leather' && LEATHER[t.id]) return LEATHER[t.id];
    return cap(s.mat) + ' ' + t.name;
  }
  function lvl(n) { return ROMAN[n] || String(n); }
  function opts(list, val) {
    return list.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('');
  }

  // ---- pickers ----
  function drawTypes() {
    root.innerHTML = TYPES.filter(ok).map(function (t) {
      var src = icon(t.mats ? (t.mats.indexOf(s.mat) > -1 ? s.mat : 'diamond') + '_' + t.id : t.id);
      return '<button type="button" class="mct-item" data-type="' + t.id + '" aria-pressed="' + (t.id === s.type) + '"><img src="' + src + '" alt="">' + t.name + '</button>';
    }).join('');
  }
  function drawMats() {
    var t = type();
    $('enOwnerWrap').hidden = t.id !== 'player_head';
    $('enMatWrap').hidden = !t.mats;
    if (!t.mats) return;
    $('enMat').innerHTML = t.mats.filter(function (m) { return (MAT_V[m] || 0) <= s.ver; }).map(function (m) {
      return '<button type="button" class="mch-chip mct-mat" data-mat="' + m + '" aria-pressed="' + (m === s.mat) + '"><img src="' + icon(m + '_' + t.id) + '" alt="">' + cap(m) + '</button>';
    }).join('');
  }
  function drawEnch() {
    var list = ENCH.filter(function (e) {
      return ok(e) && (s.all || s.ench[e.id] || fits(e));
    });
    $('enAllWrap').hidden = isBook();
    $('enList').innerHTML = list.map(function (e) {
      var on = !!s.ench[e.id];
      return '<li class="mct-ench-row' + (on ? ' is-on' : '') + '" data-ench="' + e.id + '">' +
        '<label><input type="checkbox"' + (on ? ' checked' : '') + '> ' + e.name + '</label>' +
        '<span class="mct-lvl"><input type="number" min="1" max="255" value="' + (s.ench[e.id] || e.max) + '" aria-label="' + e.name + ' level"><small>max ' + e.max + '</small></span></li>';
    }).join('');
  }
  function drawColors() {
    $('enColor').innerHTML = '<button type="button" class="mct-sw mct-sw--none" data-color="" aria-pressed="true" title="Default">Aa</button>' +
      Object.keys(COLORS).map(function (c) {
        return '<button type="button" class="mct-sw" data-color="' + c + '" aria-pressed="false" title="' + c.replace('_', ' ') + '" style="background:#' + COLORS[c] + '"></button>';
      }).join('');
  }
  function drawAttrs() {
    var off = s.ver === 0;
    $('enAttrs').hidden = $('enAttrActs').hidden = off;
    $('enAttrHint').textContent = off
      ? 'Attributes need 1.20.5 or newer. Pick a newer game version above.'
      : 'Each amount is added to the base. Example: +64 Block Interaction Range lets you break blocks 64 blocks further away.';
    $('enSlot').innerHTML = opts(SLOTS, s.slot);
    $('enAttrs').innerHTML = ATTRS.map(function (a) {
      var on = a[0] in s.attrs;
      return '<li class="mct-ench-row' + (on ? ' is-on' : '') + '" data-attr="' + a[0] + '">' +
        '<label><input type="checkbox"' + (on ? ' checked' : '') + '> ' + a[1] + '</label>' +
        '<span class="mct-lvl"><input type="number" step="any" value="' + (on ? s.attrs[a[0]] : 1) + '" aria-label="' + a[1] + ' amount"><small class="mct-base">base ' + a[2] + '</small></span></li>';
    }).join('');
  }

  // ---- the command ----
  function sq(t) { return "'" + t.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
  function build() {
    var name = $('enName').value.trim();
    var lore = $('enLore').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var unb = $('enUnb').checked;
    var hideE = $('enHideEnch').checked;
    var hideAll = $('enHideAll').checked;
    var picked = ENCH.filter(function (e) { return s.ench[e.id]; });
    var nameObj = { text: name, italic: false };
    if (s.color) nameObj.color = s.color;
    if ($('enBold').checked) nameObj.bold = true;
    var loreObj = lore.map(function (l) { return JSON.stringify({ text: l, italic: false }); });
    var parts = [];

    if (s.ver === 0) {
      if (picked.length) parts.push((isBook() ? 'StoredEnchantments' : 'Enchantments') + ':[' + picked.map(function (e) {
        return '{id:"minecraft:' + (e.id === 'sweeping_edge' ? 'sweeping' : e.id) + '",lvl:' + s.ench[e.id] + 's}';
      }).join(',') + ']');
      var disp = [];
      if (name) disp.push('Name:' + sq(JSON.stringify(nameObj)));
      if (lore.length) disp.push('Lore:[' + loreObj.map(sq).join(',') + ']');
      if (disp.length) parts.push('display:{' + disp.join(',') + '}');
      if (unb) parts.push('Unbreakable:1b');
      if (owner()) parts.push('SkullOwner:"' + owner() + '"');
      // HideFlags bits: 1 = enchantments, 32 = "other", which is where a book's stored enchantments sit.
      if (hideE && picked.length) parts.push('HideFlags:' + (isBook() ? 32 : 1));
      return itemId() + (parts.length ? '{' + parts.join(',') + '}' : '');
    }
    var key = isBook() ? 'stored_enchantments' : 'enchantments';
    if (picked.length) {
      var map = '{' + picked.map(function (e) { return e.id + ':' + s.ench[e.id]; }).join(',') + '}';
      parts.push(key + '=' + (s.ver === 2 ? map : '{levels:' + map + (hideE ? ',show_in_tooltip:false' : '') + '}'));
    }
    if (name) parts.push('custom_name=' + (s.ver === 2 ? JSON.stringify(nameObj) : sq(JSON.stringify(nameObj))));
    if (lore.length) parts.push('lore=[' + (s.ver === 2 ? loreObj : loreObj.map(sq)).join(',') + ']');
    if (unb) parts.push('unbreakable={}');
    if (owner()) parts.push('profile={name:"' + owner() + '"}'); // the game fills in the skin on first load
    if (attrs().length) {
      // A modifier id only has to be unique per attribute + slot on one player; type_slot is.
      var list = '[' + attrs().map(function (a) {
        return '{type:"' + a[0] + '",amount:' + s.attrs[a[0]] + ',operation:"add_value",slot:"' + s.slot + '",id:"parcore:' + a[0] + '_' + s.slot + '"}';
      }).join(',') + ']';
      parts.push('attribute_modifiers=' + (s.ver === 2 ? list : '{modifiers:' + list + '}'));
    }
    if (s.ver === 2 && hideAll) parts.push('tooltip_display={hide_tooltip:true}');
    else if (s.ver === 2 && hideE && picked.length) parts.push('tooltip_display={hidden_components:["' + key + '"]}');
    else if (s.ver === 1 && hideAll) parts.push('hide_tooltip={}');
    return itemId() + (parts.length ? '[' + parts.join(',') + ']' : '');
  }

  function render() {
    var picked = ENCH.filter(function (e) { return s.ench[e.id]; });
    var target = $('enTarget').value.replace(/\s+/g, '') || '@p';
    var n = Math.min(64, Math.max(1, parseInt($('enCount').value, 10) || 1));
    var cmd = '/give ' + target + ' ' + build() + (n > 1 ? ' ' + n : '');
    $('enCmd').textContent = cmd;
    $('enCopy').setAttribute('data-copy', cmd);
    $('enPicked').textContent = picked.length ? picked.length : '';
    $('enAttrN').textContent = attrs().length ? attrs().length : '';
    $('enMeta').innerHTML = cmd.length + ' characters' +
      (cmd.length > 256 ? ' <span class="mch-term-flags"><em class="is-block">Command block only</em></span>' : '');

    // Tooltip preview, in the game's order: name, enchantments, lore, attributes, Unbreakable.
    // Enchanted items take the aqua rarity colour unless a colour is picked; a book stays yellow.
    var name = $('enName').value.trim();
    var col = COLORS[s.color] || (isBook() ? COLORS.yellow : picked.length ? COLORS.aqua : COLORS.white);
    // A named head previews that player's face (mc-heads.net, same as the skin tools); Steve if it fails.
    var tip = owner()
      ? '<img src="https://mc-heads.net/avatar/' + owner() + '/48" alt="" onerror="this.onerror=null;this.src=\'' + icon('player_head') + '\'">'
      : '<img src="' + icon(itemId()) + '" alt="">';
    if ($('enHideAll').checked) {
      tip += '<div><span>No tooltip on hover</span>';
    } else {
      tip += '<div><b style="color:#' + col + (name && $('enBold').checked ? '' : ';font-weight:400') + '">' + esc(name || itemName()) + '</b>';
      if (!$('enHideEnch').checked) tip += picked.map(function (e) {
        return '<span class="' + (/curse/.test(e.id) ? 'is-curse' : '') + '">' + e.name + ' ' + lvl(s.ench[e.id]) + '</span>';
      }).join('');
      tip += $('enLore').value.split('\n').filter(function (l) { return l.trim(); }).map(function (l) {
        return '<span class="is-lore">' + esc(l.trim()) + '</span>';
      }).join('');
      var mods = attrs().filter(function (a) { return s.attrs[a[0]]; });
      if (mods.length) {
        tip += '<span class="is-gap">' + SLOTS.filter(function (sl) { return sl[0] === s.slot; })[0][2] + '</span>' + mods.map(function (a) {
          var v = s.attrs[a[0]];
          return '<span class="' + (v < 0 ? 'is-curse' : 'is-unb') + '">' + (v < 0 ? '' : '+') + v + ' ' + a[1] + '</span>';
        }).join('');
      }
      if ($('enUnb').checked) tip += '<span class="is-unb">Unbreakable</span>';
    }
    $('enTip').innerHTML = tip + '</div>';

    var notes = [];
    if (picked.some(function (e) { return s.ench[e.id] > e.max; })) notes.push('Levels above the normal max only come from commands.');
    if (picked.some(function (e) { return !fits(e); })) notes.push('Some of these don\'t normally go on this item. /give adds them anyway.');
    if (attrs().length) {
      // attribute_modifiers replaces the item's built-in ones, so a sword given only reach hits for 1.
      if (type().mats || /^(trident|mace|turtle_helmet)$/.test(s.type)) notes.push('Your attributes replace the item\'s own. Add Attack Damage, Attack Speed or Armor back, or it loses them.');
      if (s.ver === 1) notes.push('Attribute names here are for 1.21.2 to 1.21.4. On 1.20.5 to 1.21.1 they need a generic. or player. prefix.');
    }
    $('enNote').textContent = notes.join(' ');
  }

  // ---- events ----
  function press(box, attr, val) {
    box.querySelectorAll('[' + attr + ']').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute(attr) === val));
    });
  }
  function setVer(v) {
    s.ver = v;
    if (!ok(type())) s.type = 'sword';
    if ((MAT_V[s.mat] || 0) > s.ver) s.mat = 'diamond';
    ENCH.forEach(function (e) { if (!ok(e)) delete s.ench[e.id]; });
    // Hiding the whole tooltip only exists from 1.20.5 (hide_tooltip component).
    var hide = $('enHideAll');
    hide.disabled = v === 0;
    if (v === 0) hide.checked = false;
    $('enHideAllNote').textContent = v === 0 ? '1.20.5 and newer only' : 'nothing shows on hover, not even the name';
    drawTypes(); drawMats(); drawEnch(); drawAttrs(); render();
  }
  $('enVer').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ver]');
    if (!b) return;
    press(this, 'data-ver', b.getAttribute('data-ver'));
    setVer(+b.getAttribute('data-ver'));
  });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-type]');
    if (!b) return;
    s.type = b.getAttribute('data-type');
    var t = type();
    if (t.mats && t.mats.indexOf(s.mat) < 0) s.mat = 'diamond';
    // A new item drops what it can't normally take (a sword's Sharpness on boots), unless "Show every" is on.
    if (!s.all) ENCH.forEach(function (e) { if (!fits(e)) delete s.ench[e.id]; });
    press(root, 'data-type', s.type);
    s.slot = t.slot || 'mainhand'; // attributes follow the item: a helmet's work on the head
    $('enSlot').value = s.slot;
    drawMats(); drawEnch(); render();
  });
  $('enMat').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mat]');
    if (!b) return;
    s.mat = b.getAttribute('data-mat');
    press(this, 'data-mat', s.mat);
    drawTypes(); render();
  });
  $('enList').addEventListener('change', function (e) {
    var row = e.target.closest('[data-ench]');
    var id = row.getAttribute('data-ench');
    var num = row.querySelector('input[type=number]');
    var n = Math.min(255, Math.max(1, parseInt(num.value, 10) || 1));
    num.value = n;
    if (e.target.type === 'checkbox' ? e.target.checked : true) s.ench[id] = n;
    else delete s.ench[id];
    row.querySelector('input[type=checkbox]').checked = !!s.ench[id];
    row.classList.toggle('is-on', !!s.ench[id]);
    render();
  });
  $('enMax').addEventListener('click', function () {
    ENCH.forEach(function (e) {
      if (ok(e) && fits(e) && !/curse/.test(e.id)) s.ench[e.id] = e.max;
    });
    drawEnch(); render();
  });
  $('enClear').addEventListener('click', function () { s.ench = {}; drawEnch(); render(); });
  $('enAll').addEventListener('change', function () { s.all = this.checked; drawEnch(); });
  $('enColor').addEventListener('click', function (e) {
    var b = e.target.closest('[data-color]');
    if (!b) return;
    s.color = b.getAttribute('data-color');
    press(this, 'data-color', s.color);
    render();
  });
  // "Game max" ticks everything at its normal top level; "Push to 255" lifts what's ticked. Curses skipped:
  // their level does nothing.
  $('en255').addEventListener('click', function () {
    Object.keys(s.ench).forEach(function (id) { if (!/curse/.test(id)) s.ench[id] = 255; });
    drawEnch(); render();
  });
  // Attribute rows work like the enchantment rows; typing an amount ticks the row. Edited in place
  // (no redraw) so the amount box keeps focus.
  $('enAttrs').addEventListener('input', function (e) {
    var row = e.target.closest('[data-attr]');
    var id = row.getAttribute('data-attr');
    var num = row.querySelector('input[type=number]');
    if (e.target.type === 'checkbox' ? e.target.checked : true) s.attrs[id] = parseFloat(num.value) || 0;
    else delete s.attrs[id];
    row.querySelector('input[type=checkbox]').checked = id in s.attrs;
    row.classList.toggle('is-on', id in s.attrs);
    render();
  });
  $('enSlot').addEventListener('change', function () { s.slot = this.value; render(); });
  $('enAttrClear').addEventListener('click', function () { s.attrs = {}; drawAttrs(); render(); });
  ['enOwner', 'enName', 'enLore', 'enBold', 'enUnb', 'enTarget', 'enCount', 'enHideEnch', 'enHideAll'].forEach(function (id) {
    $(id).addEventListener('input', render);
  });

  drawTypes(); drawMats(); drawEnch(); drawColors(); drawAttrs(); render();
})();
