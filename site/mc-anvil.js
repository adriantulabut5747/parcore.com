/* Anvil optimizer (Oct 13 2026), /minecraft/tools/anvil. The cheapest order to put
   enchanted books on an item, found by trying every way to pair them up.
   Costs, from the 26.3 game files (AnvilMenu + data/minecraft/enchantment/*.json):
     a job costs the prior work penalty of both sides (2^uses - 1) plus, for every
     enchantment on the right-hand item, its level x its anvil_cost (halved, min 1,
     when the right-hand item is a book). The result's uses = max of both + 1.
     40 levels or more is "Too Expensive!" in Survival.
   The search: for every set of pieces, the cheapest way to build it for each
   uses count, from the cheapest ways to build its two halves (subset DP). The item
   always stays on the left. Exact for up to 12 books.
   ENCH = [id, name, max, items it goes on, anvil_cost, exclusive set, version group].
   Copy: mc-home.js. Styles: ANVIL block in mc-home.css (.anv-*). */
var McAnvil = (function () {
  function pen(w) { return Math.pow(2, w) - 1; }
  // pieces: [{ kind:'item'|'book', ench:[[id, lvl, cost]], w }]. Returns { total, root } or null.
  function plan(pieces, survival) {
    var n = pieces.length, full = (1 << n) - 1, itemBit = -1;
    pieces.forEach(function (p, i) { if (p.kind === 'item') itemBit = i; });
    var val = [], best = {};
    // value of a piece set used as the sacrifice = sum of its enchantments' book cost x level
    for (var m = 1; m <= full; m++) {
      var v = 0;
      for (var i = 0; i < n; i++) if (m & (1 << i)) pieces[i].ench.forEach(function (e) { v += e[1] * Math.max(1, Math.floor(e[2] / (pieces[i].kind === 'book' ? 2 : 1))); });
      val[m] = v;
    }
    for (i = 0; i < n; i++) { best[1 << i] = {}; best[1 << i][pieces[i].w] = { total: 0, leaf: i }; }
    // masks in order of size so halves are ready first
    var masks = [];
    for (m = 1; m <= full; m++) masks.push(m);
    masks.sort(function (a, b) { return bits(a) - bits(b); });
    masks.forEach(function (S) {
      if (bits(S) < 2) return;
      var out = best[S] = {};
      for (var L = (S - 1) & S; L > 0; L = (L - 1) & S) {
        var R = S ^ L;
        if (itemBit >= 0 && (S & (1 << itemBit)) && !(L & (1 << itemBit))) continue; // item stays left
        if (itemBit >= 0 && (R & (1 << itemBit))) continue;
        var BL = best[L], BR = best[R];
        if (!BL || !BR) continue;
        for (var wl in BL) for (var wr in BR) {
          var step = pen(+wl) + pen(+wr) + val[R];
          if (survival && step >= 40) continue;
          var w = Math.max(+wl, +wr) + 1, tot = BL[wl].total + BR[wr].total + step;
          if (!out[w] || tot < out[w].total) out[w] = { total: tot, L: L, R: R, wl: +wl, wr: +wr, step: step };
        }
      }
    });
    var F = best[full];
    if (!F) return null;
    var bw = null;
    Object.keys(F).forEach(function (w) { if (bw === null || F[w].total < F[bw].total || (F[w].total === F[bw].total && +w < +bw)) bw = w; });
    if (bw === null) return null;
    function build(S, w) {
      var node = best[S][w];
      if (node.leaf != null) return { leaf: node.leaf, w: +w };
      return { L: build(node.L, node.wl), R: build(node.R, node.wr), step: node.step, w: +w, mask: S };
    }
    return { total: F[bw].total, root: build(full, bw), uses: +bw };
  }
  function bits(m) { var c = 0; while (m) { c += m & 1; m >>= 1; } return c; }
  // levels -> XP points from level 0 (the game's experience formula)
  function points(L) {
    if (L <= 16) return L * L + 6 * L;
    if (L <= 31) return Math.round(2.5 * L * L - 40.5 * L + 360);
    return Math.round(4.5 * L * L - 162.5 * L + 2220);
  }
  return { plan: plan, points: points, pen: pen };
})();
if (typeof module !== 'undefined') module.exports = McAnvil;

(function () {
  if (typeof document === 'undefined') return;
  var root = document.getElementById('anvBooks');
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var TABLE = {"ench":[["protection","Protection",4,"helmet chestplate leggings boots turtle_helmet",1,"armor",0],["fire_protection","Fire Protection",4,"helmet chestplate leggings boots turtle_helmet",2,"armor",0],["blast_protection","Blast Protection",4,"helmet chestplate leggings boots turtle_helmet",4,"armor",0],["projectile_protection","Projectile Protection",4,"helmet chestplate leggings boots turtle_helmet",2,"armor",0],["thorns","Thorns",3,"helmet chestplate leggings boots turtle_helmet",8,"",0],["respiration","Respiration",3,"helmet turtle_helmet",4,"",0],["aqua_affinity","Aqua Affinity",1,"helmet turtle_helmet",4,"",0],["swift_sneak","Swift Sneak",3,"leggings",8,"",0],["feather_falling","Feather Falling",4,"boots",2,"",0],["depth_strider","Depth Strider",3,"boots",4,"boots",0],["frost_walker","Frost Walker",2,"boots",4,"boots",0],["soul_speed","Soul Speed",3,"boots",8,"",0],["sharpness","Sharpness",5,"sword axe spear",1,"damage",0],["smite","Smite",5,"sword axe spear mace",2,"damage",0],["bane_of_arthropods","Bane of Arthropods",5,"sword axe spear mace",2,"damage",0],["knockback","Knockback",2,"sword spear",2,"",0],["fire_aspect","Fire Aspect",2,"sword spear mace",4,"",0],["looting","Looting",3,"sword spear",4,"",0],["sweeping_edge","Sweeping Edge",3,"sword",4,"",0],["lunge","Lunge",3,"spear",2,"",2],["efficiency","Efficiency",5,"pickaxe axe shovel hoe shears",1,"",0],["fortune","Fortune",3,"pickaxe axe shovel hoe",4,"mining",0],["silk_touch","Silk Touch",1,"pickaxe axe shovel hoe",8,"mining",0],["power","Power",5,"bow",1,"",0],["punch","Punch",2,"bow",4,"",0],["flame","Flame",1,"bow",4,"",0],["infinity","Infinity",1,"bow",8,"bow",0],["multishot","Multishot",1,"crossbow",4,"crossbow",0],["piercing","Piercing",4,"crossbow",1,"crossbow",0],["quick_charge","Quick Charge",3,"crossbow",2,"",0],["loyalty","Loyalty",3,"trident",2,"",0],["impaling","Impaling",5,"trident",4,"damage",0],["riptide","Riptide",3,"trident",4,"riptide",0],["channeling","Channeling",1,"trident",8,"",0],["density","Density",5,"mace",2,"damage",1],["breach","Breach",4,"mace",4,"damage",1],["wind_burst","Wind Burst",3,"mace",4,"",1],["luck_of_the_sea","Luck of the Sea",3,"fishing_rod",4,"",0],["lure","Lure",3,"fishing_rod",4,"",0],["unbreaking","Unbreaking",3,"sword spear axe pickaxe shovel hoe helmet chestplate leggings boots turtle_helmet elytra bow crossbow trident mace fishing_rod shears flint_and_steel carrot_on_a_stick",2,"",0],["mending","Mending",1,"sword spear axe pickaxe shovel hoe helmet chestplate leggings boots turtle_helmet elytra bow crossbow trident mace fishing_rod shears flint_and_steel carrot_on_a_stick",4,"",0],["binding_curse","Curse of Binding",1,"helmet chestplate leggings boots turtle_helmet elytra",8,"",0],["vanishing_curse","Curse of Vanishing",1,"sword spear axe pickaxe shovel hoe helmet chestplate leggings boots turtle_helmet elytra bow crossbow trident mace fishing_rod shears flint_and_steel carrot_on_a_stick",8,"",0]],"types":[["sword","Sword","TOOL",""],["spear","Spear","TOOL","2"],["axe","Axe","TOOL",""],["pickaxe","Pickaxe","TOOL",""],["shovel","Shovel","TOOL",""],["hoe","Hoe","TOOL",""],["helmet","Helmet","ARMOR",""],["chestplate","Chestplate","ARMOR",""],["leggings","Leggings","ARMOR",""],["boots","Boots","ARMOR",""],["turtle_helmet","Turtle Shell","",""],["elytra","Elytra","",""],["bow","Bow","",""],["crossbow","Crossbow","",""],["trident","Trident","",""],["mace","Mace","","1"],["fishing_rod","Fishing Rod","",""],["shears","Shears","",""],["flint_and_steel","Flint and Steel","",""],["carrot_on_a_stick","Carrot on a Stick","",""]]};
  var ENCH = TABLE.ench.map(function (e) { return { id: e[0], name: e[1], max: e[2], on: e[3].split(' '), cost: e[4], grp: e[5], v: e[6] }; });
  var TYPES = TABLE.types.map(function (t) { return { id: t[0], name: t[1], mats: !!t[2], v: +(t[3] || 0) }; });
  TYPES.push({ id: 'book', name: 'Books only', mats: false, v: 0 });
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
  var s = { type: 'sword', picked: { sharpness: 5, unbreaking: 3, mending: 1, looting: 3, fire_aspect: 2 }, uses: 0, survival: true, rename: false };
  function icon(t) {
    if (t === 'book') return '/minecrafticons/items/enchanted_book.png';
    var ty = TYPES.filter(function (x) { return x.id === t; })[0];
    return '/minecrafticons/items/' + (ty && ty.mats ? 'diamond_' + t : t) + '.png';
  }
  function fits(e) { return s.type === 'book' || e.on.indexOf(s.type) > -1; }
  function clashes(e) {
    if (!e.grp) return null;
    return Object.keys(s.picked).map(function (id) { return ENCH.filter(function (x) { return x.id === id; })[0]; })
      .filter(function (x) { return x.id !== e.id && x.grp === e.grp; })[0] || null;
  }
  function lvl(n) { return ROMAN[n] || n; }

  function drawTypes() {
    $('anvType').innerHTML = TYPES.map(function (t) {
      return '<button type="button" class="pt-slot pt-slot--item anv-type" data-type="' + t.id + '" aria-pressed="' + (t.id === s.type) + '"><img src="' + icon(t.id) + '" alt=""><span>' + t.name + '</span></button>';
    }).join('');
  }
  function drawBooks() {
    var list = ENCH.filter(fits);
    root.innerHTML = list.map(function (e) {
      var on = s.picked[e.id], cl = !on && clashes(e);
      return '<li class="anv-book' + (on ? ' is-on' : '') + (cl ? ' is-blocked' : '') + '">' +
        '<button type="button" class="anv-pick" data-ench="' + e.id + '" aria-pressed="' + !!on + '"' + (cl ? ' disabled title="Can\'t go with ' + cl.name + '"' : '') + '><img src="/minecrafticons/items/enchanted_book.png" alt=""><span><b>' + e.name + '</b><small>' + (cl ? 'Not with ' + cl.name : 'Max ' + lvl(e.max) + ' · cost ' + Math.max(1, Math.floor(e.cost / 2)) + ' per level as a book') + '</small></span></button>' +
        (on ? '<div class="anv-lv" role="group" aria-label="' + e.name + ' level">' + Array.apply(null, Array(e.max)).map(function (_, i) {
          return '<button type="button" data-lv="' + e.id + '" data-n="' + (i + 1) + '" aria-pressed="' + (on === i + 1) + '">' + lvl(i + 1) + '</button>';
        }).join('') + '</div>' : '') + '</li>';
    }).join('');
    $('anvCount').textContent = Object.keys(s.picked).length || '';
  }

  // ---- the plan, drawn as a merge tree ----
  function pieces() {
    var out = [];
    if (s.type !== 'book') out.push({ kind: 'item', ench: [], w: s.uses, name: TYPES.filter(function (t) { return t.id === s.type; })[0].name });
    Object.keys(s.picked).forEach(function (id) {
      var e = ENCH.filter(function (x) { return x.id === id; })[0];
      out.push({ kind: 'book', ench: [[id, s.picked[id], e.cost]], w: 0, name: e.name + ' ' + lvl(s.picked[id]) });
    });
    return out;
  }
  function render() {
    var P = pieces(), tree = $('anvTree'), steps = $('anvSteps');
    var res = P.length > 1 ? McAnvil.plan(P, s.survival) : null;
    if (P.length < 2) {
      tree.innerHTML = '<p class="anv-empty">Pick at least ' + (s.type === 'book' ? 'two books' : 'one book') + ' on the left.</p>';
      steps.innerHTML = ''; $('anvTotals').innerHTML = ''; $('anvNotes').innerHTML = '';
      return;
    }
    if (!res) {
      tree.innerHTML = '<p class="anv-empty is-bad">Every order has a step of 40 levels or more, so Survival says Too Expensive! Use fewer books, lower prior work, or switch Survival off for Creative.</p>';
      steps.innerHTML = ''; $('anvTotals').innerHTML = ''; return;
    }
    var n = 0, list = [], maxStep = 0;
    // number the jobs in the order you do them (children first)
    function walk(node) {
      if (node.leaf != null) return;
      walk(node.L); walk(node.R);
      node.no = ++n;
      maxStep = Math.max(maxStep, node.step);
      list.push(node);
    }
    walk(res.root);
    var renameCost = s.rename ? 1 : 0;
    if (s.rename) { res.root.step += 1; maxStep = Math.max(maxStep, res.root.step); }
    function label(node) {
      if (node.leaf != null) return P[node.leaf].name;
      var names = [];
      (function gather(x) { if (x.leaf != null) names.push(P[x.leaf].name); else { gather(x.L); gather(x.R); } })(node);
      return names.join(' + ');
    }
    function nodeHtml(node) {
      if (node.leaf != null) {
        var p = P[node.leaf];
        return '<div class="anv-leaf' + (p.kind === 'item' ? ' is-item' : '') + '"><img src="' + (p.kind === 'item' ? icon(s.type) : '/minecrafticons/items/enchanted_book.png') + '" alt=""><span>' + p.name + '</span></div>';
      }
      return '<div class="anv-node"><div class="anv-kids">' + nodeHtml(node.L) + nodeHtml(node.R) + '</div>' +
        '<div class="anv-step' + (node.step >= 40 ? ' is-bad' : '') + '"><img src="/minecrafticons/blocks/anvil_top.png" alt=""><span><b>Step ' + node.no + '</b><small>' + node.step + (node.step === 1 ? ' level' : ' levels') + '</small></span></div></div>';
    }
    tree.innerHTML = nodeHtml(res.root);
    steps.innerHTML = list.map(function (node) {
      return '<li><b>' + node.no + '</b><span>Put <em>' + label(node.L) + '</em> on the left and <em>' + label(node.R) + '</em> on the right' + (node === res.root && s.rename ? ', and type the new name' : '') + '.</span><strong>' + node.step + '</strong></li>';
    }).join('');
    var total = res.total + renameCost;
    $('anvTotals').innerHTML =
      '<div><dt>Total</dt><dd>' + total + '</dd><span>levels</span></div>' +
      '<div><dt>Hardest step</dt><dd>' + maxStep + '</dd><span>levels at once</span></div>' +
      '<div><dt>XP to save up</dt><dd>' + McAnvil.points(total).toLocaleString('en-US') + '</dd><span>points from level 0</span></div>' +
      '<div><dt>Anvil uses after</dt><dd>' + res.uses + '</dd><span>next job +' + McAnvil.pen(res.uses) + '</span></div>';
    var notes = [];
    if (s.uses) notes.push('Your item already has ' + s.uses + ' anvil use' + (s.uses > 1 ? 's' : '') + ', so every job on it starts at +' + McAnvil.pen(s.uses) + ' levels.');
    if (maxStep >= 30 && s.survival) notes.push('The hardest step is close to the 40 level limit. One more book on this item later may be Too Expensive.');
    notes.push('Books are counted as fresh books with one enchantment each. A book that has been on an anvil before costs more.');
    $('anvNotes').innerHTML = notes.map(function (x) { return '<li>' + x + '</li>'; }).join('');
  }
  $('anvType').addEventListener('click', function (e) {
    var b = e.target.closest('[data-type]');
    if (!b) return;
    s.type = b.getAttribute('data-type');
    Object.keys(s.picked).forEach(function (id) { var x = ENCH.filter(function (q) { return q.id === id; })[0]; if (!fits(x)) delete s.picked[id]; });
    $('anvUsesWrap').hidden = s.type === 'book';
    drawTypes(); drawBooks(); render();
  });
  root.addEventListener('click', function (e) {
    var p = e.target.closest('[data-ench]'), l = e.target.closest('[data-lv]');
    if (l) { s.picked[l.getAttribute('data-lv')] = +l.getAttribute('data-n'); drawBooks(); render(); return; }
    if (!p || p.disabled) return;
    var id = p.getAttribute('data-ench'), x = ENCH.filter(function (q) { return q.id === id; })[0];
    if (s.picked[id]) delete s.picked[id];
    else if (Object.keys(s.picked).length >= 10) { $('anvCount').textContent = '10 max'; return; } // the search grows 3x per book
    else s.picked[id] = x.max;
    drawBooks(); render();
  });
  $('anvMax').addEventListener('click', function () {
    ENCH.filter(fits).forEach(function (e) { if (!s.picked[e.id] && !clashes(e) && !/curse/.test(e.id) && Object.keys(s.picked).length < 10) s.picked[e.id] = e.max; });
    drawBooks(); render();
  });
  $('anvClear').addEventListener('click', function () { s.picked = {}; drawBooks(); render(); });
  $('anvUses').addEventListener('input', function () { s.uses = Math.max(0, Math.min(6, parseInt(this.value, 10) || 0)); $('anvUsesV').textContent = s.uses + ' (+' + McAnvil.pen(s.uses) + ' levels)'; render(); });
  $('anvSurv').addEventListener('change', function () { s.survival = this.checked; render(); });
  $('anvRename').addEventListener('change', function () { s.rename = this.checked; render(); });
  drawTypes(); drawBooks(); render();
})();
