/* Enchanted Item generator (Oct 13 2026), /minecraft/tools/enchanted-item.
   Builds the pickers and writes one /give command in the syntax of the picked
   game version:
     2 = 1.21.5 and newer  item[enchantments={sharpness:5},custom_name={"text":..}]
     1 = 1.20.5 - 1.21.4   item[enchantments={levels:{..}},custom_name='{"text":..}']
     0 = 1.14 - 1.20.4     item{Enchantments:[{id:..,lvl:5s}],display:{Name:'..'}}
   ENCH (ids, max levels, which items take them) was read from the 26.3 game
   files: data/minecraft/enchantment/*.json + the enchantable/* item tags.
   "v" on an item or enchantment = the oldest version group it exists in.
   Copy button: mc-home.js (.mch-copy[data-copy]). Styles: WEB TOOLS in mc-home.css. */
(function () {
  var root = document.getElementById('enType');
  if (!root) return;

  var TOOL = ['wooden', 'stone', 'copper', 'iron', 'golden', 'diamond', 'netherite'];
  var ARMOR = ['leather', 'chainmail', 'copper', 'iron', 'golden', 'diamond', 'netherite'];
  var MAT_V = { copper: 2 }; // copper gear: 1.21.9
  var TYPES = [
    { id: 'sword', name: 'Sword', mats: TOOL },
    { id: 'spear', name: 'Spear', mats: TOOL, v: 2 }, // 1.21.11
    { id: 'axe', name: 'Axe', mats: TOOL },
    { id: 'pickaxe', name: 'Pickaxe', mats: TOOL },
    { id: 'shovel', name: 'Shovel', mats: TOOL },
    { id: 'hoe', name: 'Hoe', mats: TOOL },
    { id: 'helmet', name: 'Helmet', mats: ARMOR },
    { id: 'chestplate', name: 'Chestplate', mats: ARMOR },
    { id: 'leggings', name: 'Leggings', mats: ARMOR },
    { id: 'boots', name: 'Boots', mats: ARMOR },
    { id: 'turtle_helmet', name: 'Turtle Shell' },
    { id: 'elytra', name: 'Elytra' },
    { id: 'bow', name: 'Bow' },
    { id: 'crossbow', name: 'Crossbow' },
    { id: 'trident', name: 'Trident' },
    { id: 'mace', name: 'Mace', v: 1 }, // 1.21
    { id: 'fishing_rod', name: 'Fishing Rod' },
    { id: 'shears', name: 'Shears' },
    { id: 'flint_and_steel', name: 'Flint and Steel' },
    { id: 'carrot_on_a_stick', name: 'Carrot on a Stick' }
  ];
  var ARM = 'helmet chestplate leggings boots turtle_helmet';
  var ALL = TYPES.map(function (t) { return t.id; }).join(' ');
  // [id, name, max level, item types that normally take it, oldest version group]
  var ENCH = [
    ['protection', 'Protection', 4, ARM],
    ['fire_protection', 'Fire Protection', 4, ARM],
    ['blast_protection', 'Blast Protection', 4, ARM],
    ['projectile_protection', 'Projectile Protection', 4, ARM],
    ['thorns', 'Thorns', 3, ARM],
    ['respiration', 'Respiration', 3, 'helmet turtle_helmet'],
    ['aqua_affinity', 'Aqua Affinity', 1, 'helmet turtle_helmet'],
    ['swift_sneak', 'Swift Sneak', 3, 'leggings'],
    ['feather_falling', 'Feather Falling', 4, 'boots'],
    ['depth_strider', 'Depth Strider', 3, 'boots'],
    ['frost_walker', 'Frost Walker', 2, 'boots'],
    ['soul_speed', 'Soul Speed', 3, 'boots'],
    ['sharpness', 'Sharpness', 5, 'sword axe spear'],
    ['smite', 'Smite', 5, 'sword axe spear mace'],
    ['bane_of_arthropods', 'Bane of Arthropods', 5, 'sword axe spear mace'],
    ['knockback', 'Knockback', 2, 'sword spear'],
    ['fire_aspect', 'Fire Aspect', 2, 'sword spear mace'],
    ['looting', 'Looting', 3, 'sword spear'],
    ['sweeping_edge', 'Sweeping Edge', 3, 'sword'],
    ['lunge', 'Lunge', 3, 'spear', 2],
    ['efficiency', 'Efficiency', 5, 'pickaxe axe shovel hoe shears'],
    ['fortune', 'Fortune', 3, 'pickaxe axe shovel hoe'],
    ['silk_touch', 'Silk Touch', 1, 'pickaxe axe shovel hoe'],
    ['power', 'Power', 5, 'bow'],
    ['punch', 'Punch', 2, 'bow'],
    ['flame', 'Flame', 1, 'bow'],
    ['infinity', 'Infinity', 1, 'bow'],
    ['multishot', 'Multishot', 1, 'crossbow'],
    ['piercing', 'Piercing', 4, 'crossbow'],
    ['quick_charge', 'Quick Charge', 3, 'crossbow'],
    ['loyalty', 'Loyalty', 3, 'trident'],
    ['impaling', 'Impaling', 5, 'trident'],
    ['riptide', 'Riptide', 3, 'trident'],
    ['channeling', 'Channeling', 1, 'trident'],
    ['density', 'Density', 5, 'mace', 1],
    ['breach', 'Breach', 4, 'mace', 1],
    ['wind_burst', 'Wind Burst', 3, 'mace', 1],
    ['luck_of_the_sea', 'Luck of the Sea', 3, 'fishing_rod'],
    ['lure', 'Lure', 3, 'fishing_rod'],
    ['unbreaking', 'Unbreaking', 3, ALL],
    ['mending', 'Mending', 1, ALL],
    ['binding_curse', 'Curse of Binding', 1, ARM + ' elytra'],
    ['vanishing_curse', 'Curse of Vanishing', 1, ALL]
  ].map(function (e) {
    return { id: e[0], name: e[1], max: e[2], on: e[3].split(' '), v: e[4] || 0 };
  });
  var COLORS = {
    white: 'ffffff', gray: 'aaaaaa', dark_gray: '555555', black: '000000',
    red: 'ff5555', dark_red: 'aa0000', gold: 'ffaa00', yellow: 'ffff55',
    green: '55ff55', dark_green: '00aa00', aqua: '55ffff', dark_aqua: '00aaaa',
    blue: '5555ff', dark_blue: '0000aa', light_purple: 'ff55ff', dark_purple: 'aa00aa'
  };
  var LEATHER = { helmet: 'Leather Cap', chestplate: 'Leather Tunic', leggings: 'Leather Pants' };
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  var s = { ver: 2, type: 'sword', mat: 'diamond', ench: {}, all: false, color: '' };
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
  function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1); }
  function itemName() {
    var t = type();
    if (!t.mats) return t.name;
    if (s.mat === 'leather' && LEATHER[t.id]) return LEATHER[t.id];
    return cap(s.mat) + ' ' + t.name;
  }
  function lvl(n) { return ROMAN[n] || String(n); }

  // ---- pickers ----
  function drawTypes() {
    root.innerHTML = TYPES.filter(ok).map(function (t) {
      var src = icon(t.mats ? (t.mats.indexOf(s.mat) > -1 ? s.mat : 'diamond') + '_' + t.id : t.id);
      return '<button type="button" class="mct-item" data-type="' + t.id + '" aria-pressed="' + (t.id === s.type) + '"><img src="' + src + '" alt="">' + t.name + '</button>';
    }).join('');
  }
  function drawMats() {
    var t = type();
    $('enMatWrap').hidden = !t.mats;
    if (!t.mats) return;
    $('enMat').innerHTML = t.mats.filter(function (m) { return (MAT_V[m] || 0) <= s.ver; }).map(function (m) {
      return '<button type="button" class="mch-chip mct-mat" data-mat="' + m + '" aria-pressed="' + (m === s.mat) + '"><img src="' + icon(m + '_' + t.id) + '" alt="">' + cap(m) + '</button>';
    }).join('');
  }
  function drawEnch() {
    var list = ENCH.filter(function (e) {
      return ok(e) && (s.all || s.ench[e.id] || e.on.indexOf(s.type) > -1);
    });
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

  // ---- the command ----
  function sq(t) { return "'" + t.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
  function build() {
    var name = $('enName').value.trim();
    var lore = $('enLore').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var unb = $('enUnb').checked;
    var picked = ENCH.filter(function (e) { return s.ench[e.id]; });
    var nameObj = { text: name, italic: false };
    if (s.color) nameObj.color = s.color;
    if ($('enBold').checked) nameObj.bold = true;
    var loreObj = lore.map(function (l) { return JSON.stringify({ text: l, italic: false }); });
    var parts = [];

    if (s.ver === 0) {
      if (picked.length) parts.push('Enchantments:[' + picked.map(function (e) {
        return '{id:"minecraft:' + (e.id === 'sweeping_edge' ? 'sweeping' : e.id) + '",lvl:' + s.ench[e.id] + 's}';
      }).join(',') + ']');
      var disp = [];
      if (name) disp.push('Name:' + sq(JSON.stringify(nameObj)));
      if (lore.length) disp.push('Lore:[' + loreObj.map(sq).join(',') + ']');
      if (disp.length) parts.push('display:{' + disp.join(',') + '}');
      if (unb) parts.push('Unbreakable:1b');
      return itemId() + (parts.length ? '{' + parts.join(',') + '}' : '');
    }
    if (picked.length) {
      var map = '{' + picked.map(function (e) { return e.id + ':' + s.ench[e.id]; }).join(',') + '}';
      parts.push('enchantments=' + (s.ver === 2 ? map : '{levels:' + map + '}'));
    }
    if (name) parts.push('custom_name=' + (s.ver === 2 ? JSON.stringify(nameObj) : sq(JSON.stringify(nameObj))));
    if (lore.length) parts.push('lore=[' + (s.ver === 2 ? loreObj : loreObj.map(sq)).join(',') + ']');
    if (unb) parts.push('unbreakable={}');
    return itemId() + (parts.length ? '[' + parts.join(',') + ']' : '');
  }

  function render() {
    var picked = ENCH.filter(function (e) { return s.ench[e.id]; });
    var cmd = '/give ' + $('enTarget').value + ' ' + build();
    $('enCmd').textContent = cmd;
    $('enCopy').setAttribute('data-copy', cmd);
    $('enPicked').textContent = picked.length ? picked.length : '';
    $('enMeta').innerHTML = cmd.length + ' characters' +
      (cmd.length > 256 ? ' <span class="mch-term-flags"><em class="is-block">Command block only</em></span>' : '');

    // Tooltip preview: enchanted items take the aqua rarity colour unless a colour is picked.
    var name = $('enName').value.trim();
    var col = COLORS[s.color] || (picked.length ? COLORS.aqua : COLORS.white);
    var tip = '<img src="' + icon(itemId()) + '" alt=""><div><b style="color:#' + col + (name && $('enBold').checked ? '' : ';font-weight:400') + '">' + esc(name || itemName()) + '</b>';
    tip += picked.map(function (e) {
      return '<span class="' + (/curse/.test(e.id) ? 'is-curse' : '') + '">' + e.name + ' ' + lvl(s.ench[e.id]) + '</span>';
    }).join('');
    tip += $('enLore').value.split('\n').filter(function (l) { return l.trim(); }).map(function (l) {
      return '<span class="is-lore">' + esc(l.trim()) + '</span>';
    }).join('');
    if ($('enUnb').checked) tip += '<span class="is-unb">Unbreakable</span>';
    $('enTip').innerHTML = tip + '</div>';

    var notes = [];
    if (picked.some(function (e) { return s.ench[e.id] > e.max; })) notes.push('Levels above the normal max only come from commands.');
    if (picked.some(function (e) { return e.on.indexOf(s.type) < 0; })) notes.push('Some of these don\'t normally go on this item. /give adds them anyway.');
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
    drawTypes(); drawMats(); drawEnch(); render();
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
    if (!s.all) ENCH.forEach(function (e) { if (e.on.indexOf(s.type) < 0) delete s.ench[e.id]; });
    press(root, 'data-type', s.type);
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
      if (ok(e) && e.on.indexOf(s.type) > -1 && !/curse/.test(e.id)) s.ench[e.id] = e.max;
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
  ['enName', 'enLore', 'enBold', 'enUnb', 'enTarget'].forEach(function (id) {
    $(id).addEventListener('input', render);
  });

  drawTypes(); drawMats(); drawEnch(); drawColors(); render();
})();
