/* Tool repair calculator (Oct 13 2026), /minecraft/tools/repair. Durability and the
   repair rules come from the 26.3 game files:
     durability  ToolMaterial (wood 59, stone 131, copper 190, iron 250, gold 32,
                 diamond 1561, netherite 2031); armor = ArmorMaterials multiplier x
                 ArmorType (helmet 11, chestplate 16, leggings 15, boots 13, body 16);
                 Items for the rest (elytra 432, mace 500, trident 250, ...)
     grindstone / crafting grid  both items' durability + 5% of max, no levels,
                 enchantments removed (curses stay)
     anvil, two items   both + 12% of max, 2 levels + prior work, keeps enchantments
     anvil, material    each unit restores max / 4 (whole number), 1 level each + prior work
     Mending     2 durability per XP point (data/minecraft/enchantment/mending.json)
   The bar colour is the game's: hue from green to red as durability falls.
   Styles: REPAIR block in mc-home.css (.rep-*). */
(function () {
  var root = document.getElementById('repItems');
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var TOOL = { wooden: [59, 'oak_planks', 'Planks'], stone: [131, 'cobblestone', 'Cobblestone'], copper: [190, 'copper_ingot', 'Copper Ingot'], iron: [250, 'iron_ingot', 'Iron Ingot'], golden: [32, 'gold_ingot', 'Gold Ingot'], diamond: [1561, 'diamond', 'Diamond'], netherite: [2031, 'netherite_ingot', 'Netherite Ingot'] };
  var ARM = { leather: [5, 'leather', 'Leather'], copper: [11, 'copper_ingot', 'Copper Ingot'], chainmail: [15, 'iron_ingot', 'Iron Ingot'], iron: [15, 'iron_ingot', 'Iron Ingot'], golden: [7, 'gold_ingot', 'Gold Ingot'], diamond: [33, 'diamond', 'Diamond'], netherite: [37, 'netherite_ingot', 'Netherite Ingot'] };
  var SLOT = { helmet: 11, chestplate: 16, leggings: 15, boots: 13 };
  var GROUPS = [
    ['Tools', ['sword', 'pickaxe', 'axe', 'shovel', 'hoe'].map(function (t) { return { id: t, kind: 'tool' }; })],
    ['Armor', ['helmet', 'chestplate', 'leggings', 'boots'].map(function (t) { return { id: t, kind: 'armor' }; })],
    ['Other', [
      { id: 'elytra', max: 432, mat: ['phantom_membrane', 'Phantom Membrane'] }, { id: 'mace', max: 500, mat: ['breeze_rod', 'Breeze Rod'] },
      { id: 'trident', max: 250 }, { id: 'shield', max: 336, mat: ['oak_planks', 'Planks'] }, { id: 'bow', max: 384 }, { id: 'crossbow_standby', name: 'crossbow', max: 465 },
      { id: 'turtle_helmet', max: 275, mat: ['turtle_scute', 'Turtle Scute'] }, { id: 'wolf_armor', max: 64, mat: ['armadillo_scute', 'Armadillo Scute'] },
      { id: 'fishing_rod', max: 64 }, { id: 'shears', max: 238 }, { id: 'flint_and_steel', max: 64 }, { id: 'brush', max: 64 },
      { id: 'carrot_on_a_stick', max: 25 }, { id: 'warped_fungus_on_a_stick', max: 100 }]]
  ];
  var s = { item: GROUPS[0][1][1], mat: 'diamond', cur: 900, other: 900, uses: 0, enchanted: true };
  function nice(t) { return t.replace(/_standby$/, '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function max() {
    var it = s.item;
    if (it.kind === 'tool') return TOOL[s.mat][0];
    if (it.kind === 'armor') return ARM[s.mat][0] * SLOT[it.id];
    return it.max;
  }
  function material() {
    var it = s.item;
    if (it.kind === 'tool') return [TOOL[s.mat][1], TOOL[s.mat][2]];
    if (it.kind === 'armor') return [ARM[s.mat][1], ARM[s.mat][2]];
    return it.mat || null;
  }
  function iconOf(it, mat) {
    if (it.kind) return '/minecrafticons/items/' + (mat || (it.kind === 'tool' ? 'diamond' : 'diamond')) + '_' + it.id + '.png';
    return '/minecrafticons/items/' + it.id + '.png';
  }
  function pen(w) { return Math.pow(2, w) - 1; }
  // the item bar: green at full, red near breaking (Item.getBarColor)
  function barColor(d, m) {
    var h = Math.max(0, d / m) / 3, f = h * 6, i = Math.floor(f) % 6, q = f - Math.floor(f);
    var rgb = [[1, q, 0], [1 - q, 1, 0], [0, 1, q], [0, 1 - q, 1], [q, 0, 1], [1, 0, 1 - q]][i];
    return 'rgb(' + rgb.map(function (v) { return Math.round(v * 255); }).join(',') + ')';
  }
  function bar(d, m, before) {
    var w = Math.max(0, Math.min(100, d / m * 100));
    return '<div class="rep-bar"><i style="width:' + w + '%;background:' + barColor(d, m) + '"></i>' + (before != null ? '<s style="width:' + Math.max(0, Math.min(100, before / m * 100)) + '%"></s>' : '') + '</div>';
  }
  function slotIcon(d, m) {
    return '<span class="pt-slot rep-icon"><img src="' + iconOf(s.item, s.mat) + '" alt="">' + (d < m ? '<span class="rep-mini"><i style="width:' + Math.round(d / m * 13) / 13 * 100 + '%;background:' + barColor(d, m) + '"></i></span>' : '') + '</span>';
  }

  function drawItems() {
    root.innerHTML = GROUPS.map(function (g) {
      return '<div class="pt-group"><h5 class="pt-group-h">' + g[0] + '</h5><div class="pt-slots rep-grid">' + g[1].map(function (it) {
        return '<button type="button" class="pt-slot rep-it" data-item="' + it.id + '" aria-pressed="' + (s.item === it) + '" title="' + nice(it.name || it.id) + '"><img src="' + iconOf(it, it.kind === 'armor' ? 'iron' : 'diamond') + '" alt=""><span>' + nice(it.name || it.id) + '</span></button>';
      }).join('') + '</div></div>';
    }).join('');
    var mats = s.item.kind === 'tool' ? Object.keys(TOOL) : s.item.kind === 'armor' ? Object.keys(ARM) : [];
    $('repMatWrap').hidden = !mats.length;
    $('repMat').innerHTML = mats.map(function (m) {
      return '<button type="button" class="pt-slot rep-mat" data-mat="' + m + '" aria-pressed="' + (s.mat === m) + '"><img src="' + iconOf(s.item, m) + '" alt=""><span>' + nice(m === 'golden' ? 'gold' : m === 'wooden' ? 'wood' : m) + '</span></button>';
    }).join('');
  }
  function clamp() {
    var m = max();
    s.cur = Math.min(m, Math.max(1, s.cur)); s.other = Math.min(m, Math.max(1, s.other));
    $('repCur').max = $('repCurN').max = $('repOther').max = $('repOtherN').max = m;
    $('repCur').value = $('repCurN').value = s.cur;
    $('repOther').value = $('repOtherN').value = s.other;
  }
  function render() {
    clamp();
    var m = max(), d = s.cur, dmg = m - d, mat = material(), w = s.uses;
    $('repHead').innerHTML = slotIcon(d, m) + '<div><b>' + nice(s.item.kind ? (s.mat === 'golden' ? 'golden' : s.mat) + ' ' + s.item.id : (s.item.name || s.item.id)) + '</b><span>' + d + ' / ' + m + ' (' + Math.round(d / m * 100) + '%)</span></div>' + bar(d, m);
    var methods = [];
    // grindstone / crafting grid
    var g = Math.min(m, d + s.other + Math.floor(m * 5 / 100));
    methods.push({ key: 'grind', name: 'Grindstone or crafting grid', img: '/minecrafticons/blocks/grindstone_side.png', after: g, cost: 0, costTxt: 'Free',
      detail: 'Two ' + nice(s.item.name || s.item.id).toLowerCase() + 's + 5% bonus (' + Math.floor(m * 5 / 100) + ')', warn: s.enchanted ? 'Removes the enchantments (curses stay).' : '' });
    // anvil, two items
    var a = Math.min(m, d + s.other + Math.floor(m * 12 / 100)), ac = 2 + pen(w) + pen(0);
    methods.push({ key: 'anvil', name: 'Anvil, two items', img: '/minecrafticons/blocks/anvil_top.png', after: a, cost: ac, costTxt: ac + ' levels',
      detail: 'Two items + 12% bonus (' + Math.floor(m * 12 / 100) + ')', warn: 'Plus the cost of any enchantments on the second item.' });
    // anvil, material
    if (mat) {
      var per = Math.floor(m / 4), units = 0, left = dmg;
      while (left > 0 && units < 64) { left -= Math.min(left, per); units++; }
      var mc = units + pen(w);
      methods.push({ key: 'mat', name: 'Anvil, ' + mat[1].toLowerCase(), img: '/minecrafticons/items/' + mat[0] + '.png', after: m, cost: mc, costTxt: units ? mc + ' levels' : 'Not needed',
        detail: units ? units + ' × ' + mat[1] + ' (each fixes up to ' + per + ')' : 'Already full', warn: mc >= 40 ? 'Too Expensive! in Survival.' : '' });
    }
    // mending
    var xp = Math.ceil(dmg / 2);
    methods.push({ key: 'mend', name: 'Mending', img: '/minecrafticons/items/experience_bottle.png', after: m, cost: -1, costTxt: xp + ' XP points',
      detail: xp ? 'About ' + Math.ceil(xp / 7) + ' Bottles o’ Enchanting (3 to 11 XP each)' : 'Already full', warn: 'Needs the Mending enchantment on the item.' });
    var useful = methods.filter(function (x) { return x.after > d; });
    var bestKey = (useful.filter(function (x) { return x.key === 'mat' && x.cost < 40; })[0] || useful.filter(function (x) { return x.key === 'anvil' && x.cost < 40; })[0] || useful[0] || {}).key;
    if (!s.enchanted) bestKey = useful.filter(function (x) { return x.key === 'grind'; })[0] ? 'grind' : bestKey;
    $('repMethods').innerHTML = methods.map(function (x) {
      return '<li class="rep-method' + (x.key === bestKey ? ' is-best' : '') + '">' +
        '<div class="rep-m-head"><img src="' + x.img + '" alt=""><b>' + x.name + '</b>' + (x.key === bestKey ? '<em>Best here</em>' : '') + '<strong>' + x.costTxt + '</strong></div>' +
        bar(x.after, m, d) +
        '<div class="rep-m-foot"><span>' + x.after + ' / ' + m + ' <small>+' + (x.after - d) + '</small></span><small>' + x.detail + '</small></div>' +
        (x.warn ? '<p class="rep-warn">' + x.warn + '</p>' : '') + '</li>';
    }).join('');
    $('repNoMat').hidden = !!mat;
    $('repNoMat').textContent = mat ? '' : nice(s.item.name || s.item.id) + ' has no repair material: combine two of them, or use Mending.';
  }

  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-item]');
    if (!b) return;
    GROUPS.forEach(function (g) { g[1].forEach(function (it) { if (it.id === b.getAttribute('data-item')) s.item = it; }); });
    if (s.item.kind === 'armor' && !ARM[s.mat]) s.mat = 'iron';
    if (s.item.kind === 'tool' && !TOOL[s.mat]) s.mat = 'diamond';
    s.cur = Math.round(max() * 0.58); s.other = Math.round(max() * 0.5);
    drawItems(); render();
  });
  $('repMat').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mat]');
    if (!b) return;
    var k = s.cur / max();
    s.mat = b.getAttribute('data-mat');
    s.cur = Math.round(max() * k); s.other = Math.round(max() * 0.5);
    drawItems(); render();
  });
  function pair(r, n, key) {
    $(r).addEventListener('input', function () { s[key] = +this.value; render(); });
    $(n).addEventListener('change', function () { s[key] = +this.value || 1; render(); });
  }
  pair('repCur', 'repCurN', 'cur');
  pair('repOther', 'repOtherN', 'other');
  $('repQuick').addEventListener('click', function (e) {
    var b = e.target.closest('[data-q]');
    if (b) { s.cur = Math.max(1, Math.round(max() * +b.getAttribute('data-q'))); render(); }
  });
  $('repUses').addEventListener('input', function () { s.uses = +this.value; $('repUsesV').textContent = s.uses + ' (+' + pen(s.uses) + ' levels)'; render(); });
  $('repEnch').addEventListener('change', function () { s.enchanted = this.checked; render(); });
  drawItems(); render();
})();
