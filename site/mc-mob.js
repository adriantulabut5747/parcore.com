/* Mob summon generator (Oct 13 2026), /minecraft/tools/mob. Every mob with a spawn egg
   in 26.3 (+ armor stand, giant, illusioner), with:
     - default attributes read from the game's attribute builders (mc-mobs.json), shown
       next to each input so you see what you are changing
     - the mob's own options, using the save-data names in the 26.3 game files
       (Creeper Fuse / ExplosionRadius / powered, Sheep Color, VillagerData, ...)
     - equipment on a paper doll with drop chances, effects, and a passenger stack
     - a 3D preview for zombie and skeleton types wearing the armor (skinview3d), and a
       spawn egg card for every other mob
   Outputs: /summon, a spawn egg, a spawner (1.18+ format) and Bedrock /summon, for
     3 = 1.21.5+      equipment:{mainhand:{..}}, drop_chances, attributes ids "max_health"
     2 = 1.21.2-1.21.4  HandItems / ArmorItems, ids "max_health" (generic. dropped in 1.21.2)
     1 = 1.20.5-1.21.1  HandItems / ArmorItems with components, ids "generic.max_health"
     0 = 1.16-1.20.4    HandItems with Count/tag NBT, Attributes [{Name, Base}]
   Copy: mc-home.js. Styles: MOB block in mc-home.css (.mob-*). */
(function () {
  var root = document.getElementById('mobList');
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DATA = null, MOBS = [], FX = [];
  var GROUPS = [['hostile', 'Hostile'], ['boss', 'Bosses'], ['animal', 'Animals'], ['water', 'Water'], ['other', 'Other']];
  var DYE = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
  var HUMAN = { zombie: 'zombie', husk: 'husk', drowned: 'drowned', giant: 'zombie', skeleton: 'skeleton', stray: 'stray', wither_skeleton: 'wither_skeleton', bogged: 'bogged', parched: 'parched' };
  var ATTR = [['max_health', 'Max health', 'half hearts'], ['movement_speed', 'Speed', ''], ['attack_damage', 'Attack damage', 'half hearts'], ['armor', 'Armor', 'points'], ['armor_toughness', 'Armor toughness', ''], ['knockback_resistance', 'Knockback resistance', '0 to 1'], ['follow_range', 'Follow range', 'blocks'], ['flying_speed', 'Flying speed', ''], ['jump_strength', 'Jump strength', ''], ['scale', 'Size (scale)', '1 = normal']];
  var RANDOM_STATS = { horse: 1, donkey: 1, mule: 1, llama: 1, trader_llama: 1, skeleton_horse: 1, zombie_horse: 1, camel: 1 };
  // per-mob options: [key, label, kind, values/default, oldest version group]
  function sel(list) { return list.map(function (x, i) { return Array.isArray(x) ? x : [x, x.replace(/_/g, ' ')]; }); }
  var ZOMB = [['IsBaby', 'Baby', 'bool'], ['CanBreakDoors', 'Breaks doors', 'bool']];
  var PROF = sel(['none', 'armorer', 'butcher', 'cartographer', 'cleric', 'farmer', 'fisherman', 'fletcher', 'leatherworker', 'librarian', 'mason', 'nitwit', 'shepherd', 'toolsmith', 'weaponsmith']);
  var VTYPE = sel(['plains', 'desert', 'jungle', 'savanna', 'snow', 'swamp', 'taiga']);
  var VILL = [['prof', 'Job', 'select', PROF], ['vtype', 'Biome look', 'select', VTYPE], ['vlevel', 'Level', 'select', sel([['1', 'Novice'], ['2', 'Apprentice'], ['3', 'Journeyman'], ['4', 'Expert'], ['5', 'Master']])]];
  var BABY = [['baby', 'Baby', 'bool']];
  var DYESEL = DYE.map(function (d, i) { return [String(i), d.replace(/_/g, ' ')]; });
  var OPTS = {
    creeper: [['powered', 'Charged (lightning)', 'bool'], ['ignited', 'Already lit', 'bool'], ['Fuse', 'Fuse (ticks, 30 = 1.5 s)', 'int', 30], ['ExplosionRadius', 'Explosion size', 'int', 3]],
    slime: [['Size', 'Size (0 = smallest)', 'int', 1]], magma_cube: [['Size', 'Size (0 = smallest)', 'int', 1]],
    zombie: ZOMB, husk: ZOMB, drowned: ZOMB, zombie_villager: ZOMB.concat(VILL), zombified_piglin: [['IsBaby', 'Baby', 'bool']],
    piglin: [['IsBaby', 'Baby', 'bool'], ['IsImmuneToZombification', 'Never turns into a zombie', 'bool']],
    hoglin: [['IsImmuneToZombification', 'Never turns into a zoglin', 'bool']].concat(BABY),
    villager: VILL.concat(BABY),
    sheep: [['Color', 'Wool', 'select', DYESEL], ['Sheared', 'Sheared', 'bool']].concat(BABY),
    wolf: [['variant', 'Look', 'select', sel(['pale', 'woods', 'ashen', 'black', 'chestnut', 'rusty', 'spotted', 'striped', 'snowy']), 1], ['CollarColor', 'Collar', 'select', DYESEL]].concat(BABY),
    cat: [['variant', 'Look', 'select', sel(['tabby', 'black', 'red', 'siamese', 'british_shorthair', 'calico', 'persian', 'ragdoll', 'white', 'jellie', 'all_black'])], ['CollarColor', 'Collar', 'select', DYESEL]].concat(BABY),
    frog: [['variant', 'Look', 'select', sel(['temperate', 'warm', 'cold'])]],
    pig: [['variant', 'Look', 'select', sel(['temperate', 'warm', 'cold']), 3]].concat(BABY), cow: [['variant', 'Look', 'select', sel(['temperate', 'warm', 'cold']), 3]].concat(BABY),
    chicken: [['variant', 'Look', 'select', sel(['temperate', 'warm', 'cold']), 3]].concat(BABY),
    axolotl: [['Variant', 'Colour', 'select', sel([['0', 'Pink (lucy)'], ['1', 'Brown (wild)'], ['2', 'Gold'], ['3', 'Cyan'], ['4', 'Blue (rare)']])]].concat(BABY),
    parrot: [['Variant', 'Colour', 'select', sel([['0', 'Red'], ['1', 'Blue'], ['2', 'Green'], ['3', 'Cyan'], ['4', 'Grey']])]],
    rabbit: [['RabbitType', 'Coat', 'select', sel([['0', 'Brown'], ['1', 'White'], ['2', 'Black'], ['3', 'Black and white'], ['4', 'Gold'], ['5', 'Salt and pepper'], ['99', 'The Killer Bunny']])]].concat(BABY),
    horse: [['hcolor', 'Coat', 'select', sel([['0', 'White'], ['1', 'Creamy'], ['2', 'Chestnut'], ['3', 'Brown'], ['4', 'Black'], ['5', 'Gray'], ['6', 'Dark brown']])], ['hmark', 'Markings', 'select', sel([['0', 'None'], ['1', 'White legs'], ['2', 'White field'], ['3', 'White dots'], ['4', 'Black dots']])], ['Tame', 'Tamed', 'bool']].concat(BABY),
    llama: [['Variant', 'Coat', 'select', sel([['0', 'Creamy'], ['1', 'White'], ['2', 'Brown'], ['3', 'Gray']])], ['Strength', 'Strength (chest slots x3)', 'int', 3]].concat(BABY),
    trader_llama: [['Variant', 'Coat', 'select', sel([['0', 'Creamy'], ['1', 'White'], ['2', 'Brown'], ['3', 'Gray']])]],
    fox: [['Type', 'Coat', 'select', sel(['red', 'snow'])], ['Sleeping', 'Sleeping', 'bool']].concat(BABY),
    panda: [['MainGene', 'Personality', 'select', sel(['normal', 'lazy', 'worried', 'playful', 'aggressive', 'weak', 'brown'])], ['HiddenGene', 'Hidden gene', 'select', sel(['normal', 'lazy', 'worried', 'playful', 'aggressive', 'weak', 'brown'])]].concat(BABY),
    mooshroom: [['Type', 'Colour', 'select', sel(['red', 'brown'])]].concat(BABY),
    goat: [['IsScreamingGoat', 'Screaming goat', 'bool'], ['HasLeftHorn', 'Left horn', 'bool', 1], ['HasRightHorn', 'Right horn', 'bool', 1]].concat(BABY),
    iron_golem: [['PlayerCreated', 'Built by a player (won\'t attack you)', 'bool']],
    snow_golem: [['Pumpkin', 'Wears its pumpkin', 'bool', 1]],
    shulker: [['Color', 'Shell colour', 'select', DYESEL]],
    ghast: [['ExplosionPower', 'Fireball power', 'int', 1]],
    bogged: [['sheared', 'Sheared (no mushrooms)', 'bool']],
    armor_stand: [['Invisible', 'Invisible', 'bool'], ['ShowArms', 'Arms', 'bool'], ['NoBasePlate', 'No base plate', 'bool'], ['Small', 'Small', 'bool'], ['Marker', 'Marker (no hitbox)', 'bool']]
  };
  ['cow', 'mooshroom', 'sheep', 'pig', 'chicken', 'horse', 'donkey', 'mule', 'llama', 'cat', 'wolf', 'fox', 'panda', 'rabbit', 'goat', 'turtle', 'polar_bear', 'bee', 'camel', 'sniffer', 'armadillo', 'ocelot', 'strider', 'hoglin', 'axolotl', 'dolphin'].forEach(function (m) {
    OPTS[m] = OPTS[m] || BABY; if (OPTS[m].indexOf(BABY[0]) < 0) OPTS[m] = OPTS[m].concat(BABY);
  });
  var MATS = ['leather', 'chainmail', 'copper', 'iron', 'golden', 'diamond', 'netherite'];
  var TOOLM = ['wooden', 'stone', 'copper', 'iron', 'golden', 'diamond', 'netherite'];
  var SLOTS = [['head', 'Head'], ['chest', 'Chest'], ['legs', 'Legs'], ['feet', 'Feet'], ['mainhand', 'Main hand'], ['offhand', 'Off hand']];
  var ITEMS = {
    head: MATS.map(function (m) { return m + '_helmet'; }).concat(['turtle_helmet', 'carved_pumpkin', 'player_head', 'skeleton_skull', 'wither_skeleton_skull', 'zombie_head', 'creeper_head']),
    chest: MATS.map(function (m) { return m + '_chestplate'; }).concat(['elytra']),
    legs: MATS.map(function (m) { return m + '_leggings'; }),
    feet: MATS.map(function (m) { return m + '_boots'; }),
    mainhand: TOOLM.map(function (m) { return m + '_sword'; }).concat(TOOLM.map(function (m) { return m + '_axe'; }), ['bow', 'crossbow', 'trident', 'mace', 'totem_of_undying', 'fishing_rod']),
    offhand: ['shield', 'totem_of_undying', 'bow', 'diamond_sword', 'netherite_sword', 'trident']
  };
  var BEST = {
    sword: { sharpness: 5, fire_aspect: 2, knockback: 2, unbreaking: 3 }, axe: { sharpness: 5, unbreaking: 3 }, bow: { power: 5, punch: 2, flame: 1 },
    crossbow: { quick_charge: 3, multishot: 1 }, trident: { impaling: 5, loyalty: 3 }, mace: { density: 5, wind_burst: 3 },
    helmet: { protection: 4, respiration: 3, thorns: 3, unbreaking: 3 }, chestplate: { protection: 4, thorns: 3, unbreaking: 3 }, leggings: { protection: 4, thorns: 3, unbreaking: 3 },
    boots: { protection: 4, feather_falling: 4, depth_strider: 3, unbreaking: 3 }
  };
  function itemVer(id) { return /^copper_/.test(id) ? 3 : id === 'mace' ? 1 : 0; }
  function itemIcon(id) { return '/minecrafticons/items/' + (id === 'crossbow' ? 'crossbow_standby' : id === 'leather_helmet' || id === 'leather_chestplate' || id === 'leather_leggings' || id === 'leather_boots' ? id : id) + '.png'; }
  function nice(id) { return id.replace(/^golden_/, 'gold_').replace(/^wooden_/, 'wood_').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function kindOf(id) { var m = id.match(/_(sword|axe|helmet|chestplate|leggings|boots)$/); return m ? m[1] : id; }

  var s = { mob: 'zombie', ver: 3, out: 'summon', grp: '', q: '', name: '', ncolor: 'red', showName: true, health: '', flags: {}, opt: {}, attr: {}, eq: {}, fx: [], riders: [], slot: 'head', tags: '', fire: 0 };
  s.eq.head = { id: 'netherite_helmet', ench: true, unb: false, drop: '' };
  s.eq.mainhand = { id: 'netherite_sword', ench: true, unb: false, drop: '' };
  s.name = 'Zombie Knight';
  s.attr.max_health = 60;
  s.flags.PersistenceRequired = true;

  function mob() { return MOBS.filter(function (m) { return m.id === s.mob; })[0]; }
  function okv(v) { return (v || 0) <= s.ver; }

  // ---- builder ----
  function drawList() {
    var q = s.q.toLowerCase();
    var html = GROUPS.filter(function (g) { return !s.grp || s.grp === g[0]; }).map(function (g) {
      var list = MOBS.filter(function (m) { return m.g === g[0] && okv(m.v) && (!q || m.name.toLowerCase().indexOf(q) > -1); });
      if (!list.length) return '';
      return '<div class="pt-group"><h5 class="pt-group-h">' + g[1] + ' <span>' + list.length + '</span></h5><div class="pt-slots mob-grid">' + list.map(function (m) {
        return '<button type="button" class="pt-slot mob-slot" data-mob="' + m.id + '" aria-pressed="' + (m.id === s.mob) + '">' + (m.since && m.v === s.ver ? '<em class="pt-since">' + m.since + '+</em>' : '') +
          '<img src="' + eggOf(m.id) + '" alt=""><span>' + m.name + '</span></button>';
      }).join('') + '</div></div>';
    }).join('');
    root.innerHTML = html || '<p class="pt-nofind">No mob matches.</p>';
  }
  function eggOf(id) { return id === 'armor_stand' ? '/minecrafticons/items/armor_stand.png' : id === 'giant' ? '/minecrafticons/eggs/zombie.png' : id === 'illusioner' ? '/minecrafticons/eggs/evoker.png' : '/minecrafticons/eggs/' + id + '.png'; }
  function field(o, val) {
    var k = o[0], label = o[1], kind = o[2];
    if (kind === 'bool') return '<label class="pt-toggle"><input type="checkbox" data-opt="' + k + '"' + (val ? ' checked' : '') + '><span></span>' + label + '</label>';
    if (kind === 'int') return '<label class="pt-mini mob-num">' + label + ' <input class="pt-input" type="number" data-opt="' + k + '" value="' + (val != null && val !== '' ? val : '') + '" placeholder="' + (o[3] != null ? o[3] : '') + '"></label>';
    return '<label class="pt-mini mob-sel">' + label + ' <select class="pt-input" data-opt="' + k + '"><option value="">Random / default</option>' + o[3].map(function (v) { return '<option value="' + v[0] + '"' + (String(val) === v[0] ? ' selected' : '') + '>' + v[1].replace(/\b\w/g, function (c) { return c.toUpperCase(); }) + '</option>'; }).join('') + '</select></label>';
  }
  function drawOptions() {
    // only selects carry a version (index 4); bools and numbers keep their default at index 3
    var opts = (OPTS[s.mob] || []).filter(function (o) { return okv(o[2] === 'select' ? o[4] || 0 : 0); });
    $('mobOptsWrap').hidden = !opts.length;
    $('mobOptsH').textContent = mob().name + ' options';
    $('mobOpts').innerHTML = opts.map(function (o) {
      var v = s.opt[o[0]];
      if (v === undefined && o[2] === 'bool' && o[3] === 1) v = true;
      return field(o, v);
    }).join('');
  }
  function drawAttrs() {
    var d = mob().d;
    $('mobAttrs').innerHTML = ATTR.filter(function (a) { return a[0] in d && (a[0] !== 'scale' || s.ver >= 1) && (a[0] !== 'jump_strength' || RANDOM_STATS[s.mob]) && (a[0] !== 'flying_speed' || d.flying_speed); }).map(function (a) {
      return '<label class="mob-attr"><span>' + a[1] + (a[2] ? ' <small>' + a[2] + '</small>' : '') + '</span><input class="pt-input" type="number" step="any" data-attr="' + a[0] + '" value="' + (s.attr[a[0]] != null ? s.attr[a[0]] : '') + '" placeholder="' + d[a[0]] + '"><em>default ' + d[a[0]] + '</em></label>';
    }).join('');
    $('mobRandom').hidden = !RANDOM_STATS[s.mob];
  }
  function drawDoll() {
    $('mobDoll').innerHTML = SLOTS.map(function (sl) {
      var e = s.eq[sl[0]];
      return '<button type="button" class="pt-slot mob-eq mob-eq--' + sl[0] + (e && e.ench ? ' is-ench' : '') + '" data-slot="' + sl[0] + '" aria-pressed="' + (s.slot === sl[0]) + '" aria-label="' + sl[1] + (e ? ': ' + nice(e.id) : ': empty') + '">' +
        (e ? '<img src="' + itemIcon(e.id) + '" alt="">' : '<i>' + sl[1] + '</i>') + '</button>';
    }).join('');
    var sl = s.slot, e = s.eq[sl];
    $('mobPickK').textContent = SLOTS.filter(function (x) { return x[0] === sl; })[0][1];
    $('mobPick').innerHTML = '<button type="button" class="pt-slot mob-it" data-item="" aria-pressed="' + !e + '" title="Nothing"><i>None</i></button>' + ITEMS[sl].filter(function (id) { return okv(itemVer(id)); }).map(function (id) {
      return '<button type="button" class="pt-slot mob-it" data-item="' + id + '" aria-pressed="' + (e && e.id === id) + '" title="' + nice(id) + '"><img src="' + itemIcon(id) + '" alt=""></button>';
    }).join('');
    $('mobEqOpts').hidden = !e;
    if (e) {
      $('mobEnch').checked = e.ench; $('mobUnb').checked = e.unb;
      $('mobDrop').value = e.drop === '' ? 8.5 : e.drop;
      $('mobDropV').textContent = e.drop === '' ? 'Game default (8.5%)' : e.drop + '%';
      $('mobEnchK').textContent = BEST[kindOf(e.id)] ? 'Best enchantments (' + Object.keys(BEST[kindOf(e.id)]).map(nice).join(', ') + ')' : 'Enchantment glint';
    }
  }
  function drawFx() {
    $('mobFx').innerHTML = s.fx.map(function (f, i) {
      return '<li class="mob-fx"><img src="/minecrafticons/effects/' + f.id + '.png" alt=""><b>' + FX.filter(function (x) { return x[0] === f.id; })[0][1] + '</b>' +
        '<label class="pt-mini">Level <input class="pt-input" type="number" min="1" max="255" data-fx="' + i + '" data-k="lvl" value="' + f.lvl + '"></label>' +
        '<label class="pt-toggle"><input type="checkbox" data-fx="' + i + '" data-k="hide"' + (f.hide ? ' checked' : '') + '><span></span>No particles</label>' +
        '<button type="button" class="pt-remove" data-fxdel="' + i + '" aria-label="Remove"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>';
    }).join('') || '<li class="crd-hint">No effects. They last forever on a summoned mob.</li>';
    $('mobFxAdd').innerHTML = '<option value="">Add an effect…</option>' + FX.map(function (f) { return '<option value="' + f[0] + '">' + f[1] + '</option>'; }).join('');
  }
  function drawRiders() {
    $('mobRiders').innerHTML = s.riders.map(function (id, i) {
      var m = MOBS.filter(function (x) { return x.id === id; })[0];
      return '<li><img src="' + eggOf(id) + '" alt=""><span>' + (m ? m.name : id) + '</span><button type="button" class="pt-remove" data-rdel="' + i + '" aria-label="Remove"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>';
    }).reverse().join('');
    $('mobRiderAdd').innerHTML = '<option value="">Put a mob on top…</option>' + MOBS.filter(function (m) { return okv(m.v); }).map(function (m) { return '<option value="' + m.id + '">' + m.name + '</option>'; }).join('');
  }

  // ---- NBT ----
  function q(t) { return JSON.stringify(String(t)); }
  function itemNbt(e) {
    var id = e.id, k = kindOf(id), ench = e.ench ? (BEST[k] || null) : null;
    if (s.ver === 0) {
      var tag = [];
      if (ench) tag.push('Enchantments:[' + Object.keys(ench).map(function (x) { return '{id:"minecraft:' + x + '",lvl:' + ench[x] + 's}'; }).join(',') + ']');
      else if (e.ench) tag.push('Enchantments:[{}]');
      if (e.unb) tag.push('Unbreakable:1b');
      return '{id:"minecraft:' + id + '",Count:1b' + (tag.length ? ',tag:{' + tag.join(',') + '}' : '') + '}';
    }
    var c = [];
    if (ench) c.push('"minecraft:enchantments":' + (s.ver === 3 ? '{' + Object.keys(ench).map(function (x) { return '"minecraft:' + x + '":' + ench[x]; }).join(',') + '}' : '{levels:{' + Object.keys(ench).map(function (x) { return '"minecraft:' + x + '":' + ench[x]; }).join(',') + '}}'));
    else if (e.ench) c.push('"minecraft:enchantment_glint_override":true');
    if (e.unb) c.push('"minecraft:unbreakable":{}');
    return '{id:"minecraft:' + id + '",count:1' + (c.length ? ',components:{' + c.join(',') + '}' : '') + '}';
  }
  function dropOf(sl) { var e = s.eq[sl]; return e && e.drop !== '' ? (e.drop / 100).toFixed(3).replace(/0+$/, '').replace(/\.$/, '.0') : null; }
  function entity(id, isRoot) {
    var o = [];
    if (!isRoot) return '{id:"minecraft:' + id + '"}';
    var m = mob();
    if (s.name) {
      var nameObj = { text: s.name };
      if (s.ncolor) nameObj.color = s.ncolor;
      o.push(s.ver === 3 ? 'CustomName:{text:' + q(s.name) + (s.ncolor ? ',color:' + q(s.ncolor) : '') + '}' : "CustomName:'" + JSON.stringify(nameObj).replace(/'/g, "\\'") + "'");
      if (s.showName) o.push('CustomNameVisible:1b');
    }
    if (s.health !== '') o.push('Health:' + (+s.health) + 'f');
    ['NoAI', 'Silent', 'Invulnerable', 'PersistenceRequired', 'Glowing', 'NoGravity', 'LeftHanded', 'CanPickUpLoot'].forEach(function (f) { if (s.flags[f]) o.push(f + ':1b'); });
    if (s.fire) o.push('Fire:' + (s.fire * 20) + 's');
    var tags = s.tags.split(/[\s,]+/).filter(Boolean);
    if (tags.length) o.push('Tags:[' + tags.map(q).join(',') + ']');
    // mob options
    var op = s.opt, vd = [];
    (OPTS[s.mob] || []).forEach(function (x) {
      var k = x[0], v = op[k];
      if (v === undefined && x[2] === 'bool' && x[3] === 1) return;
      if (v === undefined || v === '' || v === false && x[3] !== 1) return;
      if (k === 'prof' || k === 'vtype' || k === 'vlevel' || k === 'hcolor' || k === 'hmark') return;
      if (k === 'baby') { o.push((/^(zombie|husk|drowned|zombified_piglin|piglin|zombie_villager)$/.test(s.mob) ? 'IsBaby:1b' : 'Age:-24000')); return; }
      if (x[2] === 'bool') o.push(k + ':' + (v ? '1b' : '0b'));
      else if (x[2] === 'int') o.push(k + ':' + (+v));
      else if (k === 'variant') o.push('variant:"minecraft:' + v + '"');
      else if (/^(Type|MainGene|HiddenGene)$/.test(k)) o.push(k + ':"' + v + '"');
      else o.push(k + ':' + (+v) + (/Color|CollarColor/.test(k) ? 'b' : ''));
    });
    if (op.prof || op.vtype || op.vlevel) vd.push(op.prof ? 'profession:"minecraft:' + op.prof + '"' : '', op.vtype ? 'type:"minecraft:' + op.vtype + '"' : '', op.vlevel ? 'level:' + op.vlevel : '');
    if (vd.length) o.push('VillagerData:{' + vd.filter(Boolean).join(',') + '}');
    if (op.hcolor || op.hmark) o.push('Variant:' + ((+op.hcolor || 0) + 256 * (+op.hmark || 0)));
    // attributes
    var at = Object.keys(s.attr).filter(function (k) { return s.attr[k] !== '' && s.attr[k] != null; });
    if (at.length) {
      var name = function (k) {
        if (s.ver >= 2) return 'minecraft:' + k;
        if (k === 'jump_strength' && s.ver === 0) return 'minecraft:horse.jump_strength';
        return 'minecraft:generic.' + k;
      };
      o.push(s.ver >= 1 ? 'attributes:[' + at.map(function (k) { return '{id:"' + name(k) + '",base:' + (+s.attr[k]) + 'd}'; }).join(',') + ']'
        : 'Attributes:[' + at.map(function (k) { return '{Name:"' + name(k) + '",Base:' + (+s.attr[k]) + 'd}'; }).join(',') + ']');
      if (s.attr.max_health && s.health === '') o.push('Health:' + (+s.attr.max_health) + 'f'); // or it spawns at its old max
    }
    // equipment
    var anyEq = SLOTS.some(function (sl) { return s.eq[sl[0]]; });
    if (anyEq) {
      if (s.ver === 3) {
        o.push('equipment:{' + SLOTS.filter(function (sl) { return s.eq[sl[0]]; }).map(function (sl) { return sl[0] + ':' + itemNbt(s.eq[sl[0]]); }).join(',') + '}');
        var dc = SLOTS.filter(function (sl) { return dropOf(sl[0]) != null; });
        if (dc.length) o.push('drop_chances:{' + dc.map(function (sl) { return sl[0] + ':' + dropOf(sl[0]) + 'f'; }).join(',') + '}');
      } else {
        var it = function (sl) { return s.eq[sl] ? itemNbt(s.eq[sl]) : '{}'; };
        o.push('HandItems:[' + it('mainhand') + ',' + it('offhand') + ']');
        o.push('ArmorItems:[' + it('feet') + ',' + it('legs') + ',' + it('chest') + ',' + it('head') + ']');
        var dch = ['mainhand', 'offhand'].map(dropOf), dca = ['feet', 'legs', 'chest', 'head'].map(dropOf);
        if (dch.some(function (x) { return x != null; })) o.push('HandDropChances:[' + dch.map(function (x) { return (x == null ? '0.085' : x) + 'f'; }).join(',') + ']');
        if (dca.some(function (x) { return x != null; })) o.push('ArmorDropChances:[' + dca.map(function (x) { return (x == null ? '0.085' : x) + 'f'; }).join(',') + ']');
      }
    }
    // effects (forever on a mob)
    if (s.fx.length) {
      var newer = 'active_effects:[' + s.fx.map(function (f) { return '{id:"minecraft:' + f.id + '",amplifier:' + (f.lvl - 1) + 'b,duration:' + (s.ver === 0 ? 2147483647 : -1) + (f.hide ? ',show_particles:0b' : '') + '}'; }).join(',') + ']';
      o.push(newer);
      if (s.ver === 0) o.push('ActiveEffects:[' + s.fx.map(function (f) { return '{Id:' + (FX.map(function (x) { return x[0]; }).indexOf(f.id) + 1) + ',Amplifier:' + (f.lvl - 1) + 'b,Duration:2147483647' + (f.hide ? ',ShowParticles:0b' : '') + '}'; }).join(',') + ']');
    }
    // passengers: each one rides the one below
    if (s.riders.length) {
      var nest = '';
      for (var i = s.riders.length - 1; i >= 0; i--) nest = '{id:"minecraft:' + s.riders[i] + '"' + (nest ? ',Passengers:[' + nest + ']' : '') + '}';
      o.push('Passengers:[' + nest + ']');
    }
    return o.join(',');
  }
  function command() {
    var data = entity(s.mob, true), id = 'minecraft:' + s.mob;
    if (s.out === 'bedrock') return '/summon ' + s.mob + (s.name ? ' ' + q(s.name) : '') + ' ~ ~ ~';
    if (s.out === 'summon') return '/summon ' + id + ' ~ ~ ~' + (data ? ' {' + data + '}' : '');
    if (s.out === 'egg') {
      var egg = s.mob === 'armor_stand' ? 'armor_stand' : mob().egg ? s.mob + '_spawn_egg' : 'zombie_spawn_egg';
      if (s.ver === 0) return '/give @p minecraft:' + egg + '{EntityTag:{id:"' + id + '"' + (data ? ',' + data : '') + '}}';
      return '/give @p minecraft:' + egg + '[entity_data={id:"' + id + '"' + (data ? ',' + data : '') + '}]';
    }
    var sp = [];
    if ($('mobSpCount').value) sp.push('SpawnCount:' + (+$('mobSpCount').value) + 's');
    if ($('mobSpRange').value) sp.push('RequiredPlayerRange:' + (+$('mobSpRange').value) + 's');
    if ($('mobSpMax').value) sp.push('MaxNearbyEntities:' + (+$('mobSpMax').value) + 's');
    return '/setblock ~ ~ ~ minecraft:spawner{SpawnData:{entity:{id:"' + id + '"' + (data ? ',' + data : '') + '}}' + (sp.length ? ',' + sp.join(',') : '') + '}';
  }

  // ---- preview ----
  var viewer = null, skin = document.createElement('canvas'); skin.width = 64; skin.height = 64;
  var imgs = {};
  function img(src) { if (!imgs[src]) { imgs[src] = new Image(); imgs[src].src = src; imgs[src].onload = paint3d; } return imgs[src]; }
  function matOf(id) {
    var m = id && id.match(/^(leather|chainmail|copper|iron|golden|diamond|netherite)_/);
    if (!m) return id === 'turtle_helmet' ? 'turtle_scute' : null;
    return m[1] === 'golden' ? 'gold' : m[1];
  }
  function tinted(src, hex) {
    var im = img(src), c = document.createElement('canvas'); c.width = 64; c.height = 32;
    if (!im.naturalWidth) return c;
    var x = c.getContext('2d'); x.drawImage(im, 0, 0);
    if (hex) { var d = x.getImageData(0, 0, 64, 32), p = d.data, n = parseInt(hex, 16); for (var i = 0; i < p.length; i += 4) { p[i] = p[i] * (n >> 16 & 255) / 255; p[i + 1] = p[i + 1] * (n >> 8 & 255) / 255; p[i + 2] = p[i + 2] * (n & 255) / 255; } x.putImageData(d, 0, 0); }
    return c;
  }
  function mirrorLimb(x, src, sx2, sy, dx, dy) {
    [[4, 0, 4, 4, 4], [8, 0, 4, 4, 8], [0, 4, 4, 12, 8], [4, 4, 4, 12, 4], [8, 4, 4, 12, 0], [12, 4, 4, 12, 12]].forEach(function (f) {
      x.save(); x.translate(dx + f[4] + f[2], dy + f[1]); x.scale(-1, 1);
      x.drawImage(src, sx2 + f[0], sy + f[1], f[2], f[3], 0, 0, f[2], f[3]); x.restore();
    });
  }
  // Skeleton-type mobs have 2 x 12 x 2 limbs. Each 2-wide face is stretched to fill the
  // player's 4-wide slot, and the limb mesh is then squeezed to half width, so the
  // pixels come out the right size. w = the limb's width in the mob's sheet (2, or 3 for
  // parched wraps). Faces of a w x 12 x w box: top, bottom, right, front, left, back.
  var THIN = { skeleton: 1, stray: 1, wither_skeleton: 1, bogged: 1, parched: 1 };
  function thinLimb(x, src, sx, sy, dx, dy, w) {
    w = w || 2;
    x.clearRect(dx, dy, 16, 16);
    [[w, 0, w, w, 4, 0, 4, 4], [2 * w, 0, w, w, 8, 0, 4, 4], [0, w, w, 12, 0, 4, 4, 12], [w, w, w, 12, 4, 4, 4, 12], [2 * w, w, w, 12, 8, 4, 4, 12], [3 * w, w, w, 12, 12, 4, 4, 12]].forEach(function (f) {
      x.drawImage(src, sx + f[0], sy + f[1], f[2], f[3], dx + f[4], dy + f[5], f[6], f[7]);
    });
  }
  // Parched keeps body and bandage wraps on one 64 x 64 sheet (SkeletonModel.createSingleModelDualBodyLayer):
  // inner limbs 2 wide, wraps 3 wide, head wrap at 0,32, body wrap at 16,48. Limbs in LIMBS order.
  var DUAL = { parched: { inner: [[40, 16], [56, 16], [0, 16], [0, 16]], outer: [[42, 33], [40, 48], [0, 49], [4, 49]], head: [0, 32], body: [16, 48] } };
  // the four limbs as [right/left, base slot, outer slot, slot of the source in a 64x64 sheet]
  var LIMBS = [['rightArm', 40, 16, 40, 32, 40, 16], ['leftArm', 32, 48, 48, 48, 32, 48], ['rightLeg', 0, 16, 0, 32, 0, 16], ['leftLeg', 16, 48, 0, 48, 16, 48]];
  function blank(src, rx, ry) {
    var c = document.createElement('canvas'); c.width = 16; c.height = 16;
    var t = c.getContext('2d'); t.drawImage(src, rx, ry, 16, 16, 0, 0, 16, 16);
    var d = t.getImageData(0, 0, 16, 16).data;
    for (var i = 3; i < d.length; i += 4) if (d[i]) return false;
    return true;
  }
  function paint3d() {
    var tex = HUMAN[s.mob];
    if (!tex || !viewer) return;
    var base = img('/minecrafticons/mobs/' + tex + '.png');
    if (!base.naturalWidth) return;
    var x = skin.getContext('2d'), thin = !!THIN[tex], dual = DUAL[tex], tall = base.naturalHeight === 64;
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, 64, 64);
    x.drawImage(base, 0, 0, 64, base.naturalHeight, 0, 0, 64, base.naturalHeight);
    if (!tall) x.clearRect(0, 32, 64, 32);
    // outer layer starts empty: only clothing overlays and armor go there
    [[32, 0, 32, 16], [16, 32, 24, 16], [40, 32, 16, 16], [48, 48, 16, 16], [0, 32, 16, 16], [0, 48, 16, 16]].forEach(function (r) { x.clearRect(r[0], r[1], r[2], r[3]); });
    // limbs. The left ones come from the sheet when it has them, else the right ones mirrored (as the game does)
    LIMBS.forEach(function (L, i) {
      if (dual) return thinLimb(x, base, dual.inner[i][0], dual.inner[i][1], L[1], L[2]);
      var left = i === 1 || i === 3, src = left && (!tall || blank(base, L[5], L[6])) ? LIMBS[i - 1] : L;
      if (thin) thinLimb(x, base, src[5], src[6], L[1], L[2]);
      else if (src !== L) mirrorLimb(x, base, src[5], src[6], L[1], L[2]);
    });
    // clothing overlays: stray and bogged (64x32, skeleton layout), drowned (64x64, player layout)
    var overName = tex === 'stray' ? 'stray_overlay' : tex === 'bogged' ? 'bogged_overlay' : tex === 'drowned' ? 'drowned_outer_layer' : null;
    var oi = overName && img('/minecrafticons/mobs/' + overName + '.png');
    var hasOver = oi && oi.naturalWidth;
    function layer(slot, legs) {
      var e = s.eq[slot], mat = e && matOf(e.id);
      if (!mat) return null;
      return tinted('/minecrafticons/armor/' + mat + (legs ? '_legs' : '') + '.png', mat === 'leather' ? 'a06540' : null);
    }
    var L2 = layer('legs', true), C = layer('chest'), B = layer('feet'), H = layer('head');
    if (dual) {
      x.drawImage(base, dual.head[0], dual.head[1], 32, 16, 32, 0, 32, 16); // head wrap -> hat
      x.drawImage(base, dual.body[0], dual.body[1], 24, 16, 16, 32, 24, 16); // body wrap -> jacket
    } else if (hasOver) {
      x.drawImage(oi, 0, 0, 32, 16, 32, 0, 32, 16);   // head -> hat
      x.drawImage(oi, 16, 16, 24, 16, 16, 32, 24, 16); // body -> jacket
    }
    // outer limbs: armor if that limb wears some, else the clothing overlay.
    // outerK = how much to squeeze that outer limb (1 = player width)
    var limbArmor = [C, C, L2 || B, L2 || B], outerK = [];
    LIMBS.forEach(function (L, i) {
      outerK[i] = 1;
      if (limbArmor[i]) return;
      if (dual) { thinLimb(x, base, dual.outer[i][0], dual.outer[i][1], L[3], L[4], 3); outerK[i] = 0.68; return; } // 3 px wrap on a 4.5 px layer
      if (!hasOver) return;
      var left = i === 1 || i === 3, src = left && (oi.naturalHeight === 32 || blank(oi, L[5], L[6])) ? LIMBS[i - 1] : L;
      if (thin) { thinLimb(x, oi, src[5], src[6], L[3], L[4]); outerK[i] = 0.5; }
      else if (src === L) x.drawImage(oi, L[5], L[6], 16, 16, L[3], L[4], 16, 16);
      else mirrorLimb(x, oi, src[5], src[6], L[3], L[4]);
    });
    if (L2) { x.drawImage(L2, 16, 16, 24, 16, 16, 32, 24, 16); x.drawImage(L2, 0, 16, 16, 16, 0, 32, 16, 16); mirrorLimb(x, L2, 0, 16, 0, 48); }
    if (C) { x.drawImage(C, 16, 16, 24, 16, 16, 32, 24, 16); x.drawImage(C, 40, 16, 16, 16, 40, 32, 16, 16); mirrorLimb(x, C, 40, 16, 48, 48); }
    if (B) { x.drawImage(B, 0, 16, 16, 16, 0, 32, 16, 16); mirrorLimb(x, B, 0, 16, 0, 48); }
    if (H) x.drawImage(H, 0, 0, 32, 16, 32, 0, 32, 16);
    viewer.loadSkin(skin, { model: 'default' });
    var sk = viewer.playerObject.skin;
    // skeleton ribs and skulls have see-through gaps: let the base layer show them (it is opaque by default)
    ['head', 'body', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'].forEach(function (p) {
      var m = sk[p].innerLayer.material;
      (Array.isArray(m) ? m : [m]).forEach(function (mm) { if (!mm.alphaTest) { mm.transparent = true; mm.alphaTest = 0.1; mm.needsUpdate = true; } });
    });
    // halve the limb's own scale (the arms are unit boxes scaled to 4 x 12 x 4, the legs are not)
    function squeeze(mesh, k) {
      var b = mesh.userData.base || (mesh.userData.base = mesh.scale.clone());
      mesh.scale.set(b.x * k, b.y, b.z * k);
    }
    LIMBS.forEach(function (L, i) { squeeze(sk[L[0]].innerLayer, thin ? 0.5 : 1); squeeze(sk[L[0]].outerLayer, outerK[i]); });
    var k = s.mob === 'giant' ? 1.25 : s.mob === 'wither_skeleton' ? 1.2 : 1;
    viewer.playerObject.scale.set(k, k, k);
  }
  function boot3d() {
    if (viewer || boot3d.started) return;
    boot3d.started = true;
    var c3 = $('mob3d'), stage = c3.parentNode, sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/skinview3d@3.1.0/bundles/skinview3d.bundle.js';
    sc.onload = function () {
      try {
        viewer = new window.skinview3d.SkinViewer({ canvas: c3, width: stage.clientWidth, height: stage.clientHeight });
        viewer.zoom = 0.82; viewer.fov = 40; viewer.controls.enableZoom = false; c3.style.touchAction = 'pan-y';
        viewer.animation = new window.skinview3d.WalkingAnimation(); viewer.animation.speed = 0.6; viewer.animation.paused = reduced;
        viewer.playerObject.rotation.y = -0.5;
        paint3d();
        new ResizeObserver(function () { viewer.setSize(stage.clientWidth, stage.clientHeight); }).observe(stage);
      } catch (e) { /* the egg card still shows */ }
    };
    document.head.appendChild(sc);
  }
  function hearts(n) {
    var h = Math.ceil(n / 2), full = Math.min(h, 10), more = h - full;
    return '<span class="mob-hearts">' + new Array(full + 1).join('<img src="/minecrafticons/gui/heart_full.png" alt="">') + (more > 0 ? '<b>+' + more + '</b>' : '') + '</span>';
  }
  function preview() {
    var m = mob(), d = m.d, hp = s.attr.max_health || d.max_health || 20, three = !!HUMAN[s.mob];
    $('mobStage').classList.toggle('is-3d', three);
    if (three) boot3d();
    $('mobEgg').src = eggOf(s.mob);
    $('mobCardName').textContent = s.name || m.name;
    $('mobCardName').style.color = s.name && s.ncolor ? '#' + (McFontColor(s.ncolor)) : '';
    $('mobCardType').textContent = m.name + (m.since ? ' · ' + m.since + '+' : '');
    $('mobStats').innerHTML =
      '<div><dt>Health</dt><dd>' + hp + '</dd>' + hearts(hp) + '</div>' +
      (d.attack_damage != null ? '<div><dt>Attack</dt><dd>' + (s.attr.attack_damage || d.attack_damage) + '</dd><span>half hearts a hit</span></div>' : '') +
      '<div><dt>Speed</dt><dd>' + (s.attr.movement_speed || d.movement_speed) + '</dd><span>blocks a tick x 20</span></div>' +
      ((s.attr.armor || d.armor) ? '<div><dt>Armor</dt><dd>' + (s.attr.armor || d.armor) + '</dd><span>points</span></div>' : '');
    $('mobEqRow').innerHTML = SLOTS.map(function (sl) { var e = s.eq[sl[0]]; return '<span class="pt-slot mob-mini' + (e && e.ench ? ' is-ench' : '') + '" title="' + sl[1] + '">' + (e ? '<img src="' + itemIcon(e.id) + '" alt="' + nice(e.id) + '">' : '') + '</span>'; }).join('');
    $('mobTower').innerHTML = s.riders.slice().reverse().map(function (id) { return '<img src="' + eggOf(id) + '" alt="">'; }).join('') + '<img class="is-base" src="' + eggOf(s.mob) + '" alt="">';
    $('mobTower').hidden = !s.riders.length;
    paint3d();
  }
  function McFontColor(n) { return { black: '000000', dark_blue: '0000aa', dark_green: '00aa00', dark_aqua: '00aaaa', dark_red: 'aa0000', dark_purple: 'aa00aa', gold: 'ffaa00', gray: 'aaaaaa', dark_gray: '555555', blue: '5555ff', green: '55ff55', aqua: '55ffff', red: 'ff5555', light_purple: 'ff55ff', yellow: 'ffff55', white: 'ffffff' }[n] || 'ffffff'; }

  function render() {
    var out = command();
    $('mobCmd').textContent = out;
    $('mobCopy').setAttribute('data-copy', out);
    $('mobMeta').innerHTML = out.length + ' characters' + (out.length > 32500 ? ' <span class="mch-term-flags"><em class="is-block">Too long</em></span>' : out.length > 256 ? ' <span class="mch-term-flags"><em class="is-block">Command block only</em></span>' : '');
    $('mobSpawner').hidden = s.out !== 'spawner';
    $('mobVer').hidden = s.out === 'bedrock';
    var notes = [];
    if (s.out === 'bedrock') notes.push('Bedrock /summon can only set the mob and its name. Everything else on this page is Java only.');
    if (s.out === 'spawner' && s.ver === 0) notes.push('This spawner format is for 1.18 and newer. 1.16 and 1.17 used SpawnData:{id:...} without "entity".');
    if (!s.flags.PersistenceRequired && mob().g === 'hostile') notes.push('Hostile mobs despawn when you walk away. Tick "Never despawns" to keep it.');
    if (s.attr.max_health && s.health === '') notes.push('Health is set to the new max health too, or the mob would spawn with its old health.');
    if (SLOTS.some(function (sl) { return s.eq[sl[0]]; }) && !HUMAN[s.mob] && !/piglin|vindicator|pillager|evoker|illusioner|vex|allay|fox|armor_stand|witch|wandering_trader|villager|zombie_villager|giant/.test(s.mob)) notes.push('Most animals don\'t show armor or held items, but they still drop them.');
    if (RANDOM_STATS[s.mob]) notes.push('Horses and llamas roll their own health, speed and jump when they spawn, so the defaults shown are only the starting values.');
    $('mobNotes').innerHTML = notes.map(function (n) { return '<li>' + n + '</li>'; }).join('');
    preview();
  }

  // ---- events ----
  function seg(id, attr, fn) {
    $(id).addEventListener('click', function (e) {
      var b = e.target.closest('[' + attr + ']'); if (!b) return;
      this.querySelectorAll('[' + attr + ']').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      fn(b.getAttribute(attr)); render();
    });
  }
  function init() {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mob]'); if (!b) return;
      s.mob = b.getAttribute('data-mob'); s.opt = {}; s.attr = {};
      if (s.name && /Knight$/.test(s.name)) s.name = '';
      $('mobName').value = s.name;
      drawList(); drawOptions(); drawAttrs(); render();
    });
    $('mobFind').addEventListener('input', function () { s.q = this.value; drawList(); });
    seg('mobGrp', 'data-grp', function (v) { s.grp = v; drawList(); });
    $('mobOpts').addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-opt'); if (!k) return;
      s.opt[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      render();
    });
    $('mobAttrs').addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-attr'); if (!k) return;
      if (e.target.value === '') delete s.attr[k]; else s.attr[k] = e.target.value;
      render();
    });
    $('mobBasics').addEventListener('input', function (e) {
      var f = e.target.getAttribute('data-flag');
      if (f) { s.flags[f] = e.target.checked; render(); }
    });
    $('mobName').addEventListener('input', function () { s.name = this.value; render(); });
    $('mobShowName').addEventListener('change', function () { s.showName = this.checked; render(); });
    $('mobHealth').addEventListener('input', function () { s.health = this.value; render(); });
    $('mobFire').addEventListener('input', function () { s.fire = +this.value || 0; render(); });
    $('mobTags').addEventListener('input', function () { s.tags = this.value; render(); });
    $('mobNameColor').innerHTML = '<button type="button" class="pt-sw pt-sw--none" data-ncolor="" aria-pressed="false" aria-label="White, the default">Aa</button>' +
      ['red', 'gold', 'yellow', 'green', 'aqua', 'blue', 'light_purple', 'dark_red', 'dark_purple', 'gray', 'white', 'black'].map(function (c) { return '<button type="button" class="pt-sw" data-ncolor="' + c + '" aria-pressed="' + (c === s.ncolor) + '" aria-label="' + c.replace('_', ' ') + '" style="background:#' + McFontColor(c) + '"></button>'; }).join('');
    seg('mobNameColor', 'data-ncolor', function (v) { s.ncolor = v; });
    $('mobDoll').addEventListener('click', function (e) { var b = e.target.closest('[data-slot]'); if (!b) return; s.slot = b.getAttribute('data-slot'); drawDoll(); });
    $('mobPick').addEventListener('click', function (e) {
      var b = e.target.closest('[data-item]'); if (!b) return;
      var id = b.getAttribute('data-item');
      if (!id) delete s.eq[s.slot]; else s.eq[s.slot] = { id: id, ench: s.eq[s.slot] ? s.eq[s.slot].ench : false, unb: s.eq[s.slot] ? s.eq[s.slot].unb : false, drop: s.eq[s.slot] ? s.eq[s.slot].drop : '' };
      drawDoll(); render();
    });
    $('mobEnch').addEventListener('change', function () { s.eq[s.slot].ench = this.checked; drawDoll(); render(); });
    $('mobUnb').addEventListener('change', function () { s.eq[s.slot].unb = this.checked; render(); });
    $('mobDrop').addEventListener('input', function () { s.eq[s.slot].drop = +this.value; $('mobDropV').textContent = this.value + '%'; render(); });
    $('mobDropReset').addEventListener('click', function () { s.eq[s.slot].drop = ''; drawDoll(); render(); });
    $('mobGear').addEventListener('click', function () {
      var pick = s.ver === 3 ? 'netherite' : 'diamond';
      s.eq = { head: { id: pick + '_helmet', ench: true, unb: false, drop: '' }, chest: { id: pick + '_chestplate', ench: true, unb: false, drop: '' }, legs: { id: pick + '_leggings', ench: true, unb: false, drop: '' }, feet: { id: pick + '_boots', ench: true, unb: false, drop: '' }, mainhand: { id: pick + '_sword', ench: true, unb: false, drop: '' }, offhand: { id: 'shield', ench: false, unb: false, drop: '' } };
      drawDoll(); render();
    });
    $('mobGearClear').addEventListener('click', function () { s.eq = {}; drawDoll(); render(); });
    $('mobFxAdd').addEventListener('change', function () { if (!this.value) return; s.fx.push({ id: this.value, lvl: 1, hide: true }); drawFx(); render(); });
    $('mobFx').addEventListener('input', function (e) {
      var i = e.target.getAttribute('data-fx'); if (i == null) return;
      var k = e.target.getAttribute('data-k');
      s.fx[i][k] = k === 'hide' ? e.target.checked : Math.max(1, Math.min(255, parseInt(e.target.value, 10) || 1));
      render();
    });
    $('mobFx').addEventListener('click', function (e) { var b = e.target.closest('[data-fxdel]'); if (b) { s.fx.splice(+b.getAttribute('data-fxdel'), 1); drawFx(); render(); } });
    $('mobRiderAdd').addEventListener('change', function () { if (!this.value) return; s.riders.push(this.value); drawRiders(); render(); });
    $('mobRiders').addEventListener('click', function (e) { var b = e.target.closest('[data-rdel]'); if (b) { s.riders.splice(+b.getAttribute('data-rdel'), 1); drawRiders(); render(); } });
    seg('mobOut', 'data-out', function (v) { s.out = v; });
    seg('mobVer', 'data-ver', function (v) {
      s.ver = +v;
      if (!okv(mob().v)) s.mob = 'zombie';
      Object.keys(s.eq).forEach(function (k) { if (!okv(itemVer(s.eq[k].id))) delete s.eq[k]; });
      drawList(); drawOptions(); drawAttrs(); drawDoll(); drawRiders();
    });
    ['mobSpCount', 'mobSpRange', 'mobSpMax'].forEach(function (id) { $(id).addEventListener('input', render); });
    $('mobName').value = s.name;
    drawList(); drawOptions(); drawAttrs(); drawDoll(); drawFx(); drawRiders(); render();
  }
  fetch('/mc-mobs.json').then(function (r) { return r.json(); }).then(function (d) {
    DATA = d;
    MOBS = d.mobs.map(function (m) { return { id: m[0], name: m[1], g: m[2], v: m[3], since: m[4], egg: m[5], d: m[6] }; });
    FX = d.fx;
    init();
  });
})();
