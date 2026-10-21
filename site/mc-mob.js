/* Mob summon generator (Oct 13 2026), /minecraft/tools/mob. Every mob with a spawn egg
   in 26.3 (+ armor stand, giant, illusioner), with:
     - default attributes read from the game's attribute builders (mc-mobs.json), shown
       next to each input so you see what you are changing
     - the mob's own options, using the save-data names in the 26.3 game files
       (Creeper Fuse / ExplosionRadius / powered, Sheep Color, VillagerData, ...)
     - equipment on a paper doll (saddle and body slot for the mobs that take them) with drop chances,
       effects, and a passenger stack where every rider is a whole mob, edited in its own dialog
     - a 3D preview of every mob (and its baby) wearing and holding its gear: mc-mob3d.js
     - per-item enchantments, attribute modifiers, glint and head owner (data: mc-items.js)
     - Oct 19: any item in the armor and hand slots ("More" dialog, mc-item-ids.json), dye on leather and
       wolf armor, effect times + particles (Normal / Faint / None, drawn on the 3D preview), armor trims
       (switch, then pattern + material; textures minecrafticons/armor/trims/, palettes in mc-mob3d.js) and
       the player head owner looked up like "Tamed by" (face + found / not found)
     - Oct 19: drops. The body / saddle slots a mob never shows are "Drop" slots (dropSlots); any item, a mob as a
       spawn egg (edited like a rider), storage with every slot editable down to its own storage (it() + the
       editor dialog's frames), fireworks (McFirework from the firework generator), item names, Always drops
   Outputs: /summon, a spawn egg, a spawner (1.18+ format) and Bedrock /summon, for
     3 = 1.21.5+      equipment:{mainhand:{..}}, drop_chances, attributes ids "max_health"
     2 = 1.21.2-1.21.4  HandItems / ArmorItems, ids "max_health" (generic. dropped in 1.21.2)
     1 = 1.20.5-1.21.1  HandItems / ArmorItems with components, ids "generic.max_health"
     0 = 1.16-1.20.4    HandItems with Count/tag NBT, Attributes [{Name, Base}]
   Copy: mc-home.js. Styles: mc-tool.css (.mt-*, Oct 18 2026 page v4). */
(function () {
  var root = document.getElementById('mobList');
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var DATA = null, MOBS = [], FX = [];
  var GROUPS = [['hostile', 'Hostile'], ['boss', 'Bosses'], ['animal', 'Animals'], ['water', 'Water'], ['other', 'Other']];
  var DYE = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
  var HUMAN = { zombie: 'zombie', husk: 'husk', drowned: 'drowned', giant: 'zombie', skeleton: 'skeleton', stray: 'stray', wither_skeleton: 'wither_skeleton', bogged: 'bogged', parched: 'parched' };
  // The mob's own attributes: [id, label, unit, default every living mob has (null = only the mobs that
  // list it in mc-mobs.json), oldest version group]. The 1.20.5+ ones are generic.* there (see entity()).
  var ATTR = [
    ['max_health', 'Max health', 'half hearts', 20, 0], ['movement_speed', 'Speed', '', null, 0],
    ['attack_damage', 'Attack damage', 'half hearts', null, 0], ['armor', 'Armor', 'points', 0, 0],
    ['armor_toughness', 'Armor toughness', '', 0, 0], ['knockback_resistance', 'Knockback resistance', '0 to 1', 0, 0],
    ['follow_range', 'Follow range', 'blocks', null, 0], ['flying_speed', 'Flying speed', '', null, 0],
    ['jump_strength', 'Jump strength', '', 0.42, 1], ['scale', 'Size (scale)', '1 = normal', 1, 1],
    ['step_height', 'Step height', 'blocks', 0.6, 1], ['gravity', 'Gravity', '', 0.08, 1],
    ['safe_fall_distance', 'Safe fall distance', 'blocks', 3, 1], ['fall_damage_multiplier', 'Fall damage multiplier', '', 1, 1],
    ['max_absorption', 'Max absorption', 'half hearts', 0, 1], ['burning_time', 'Burning time', '', 1, 1],
    ['explosion_knockback_resistance', 'Explosion knockback resistance', '0 to 1', 0, 1],
    ['water_movement_efficiency', 'Water movement', '', 0, 1], ['movement_efficiency', 'Movement efficiency', '', 0, 1],
    ['oxygen_bonus', 'Oxygen bonus', '', 0, 1]
  ];
  // Gear enchantments and attribute modifiers are shared with the enchanted item page (mc-items.js).
  var MCI = window.McItems;
  var EV = [0, 1, 1, 2]; // this page's version groups -> mc-items.js "v" numbering
  var RANDOM_STATS = { horse: 1, donkey: 1, mule: 1, llama: 1, trader_llama: 1, skeleton_horse: 1, zombie_horse: 1, camel: 1 };
  // per-mob options: [key, label, kind, values/default, oldest version group]
  function sel(list) { return list.map(function (x, i) { return Array.isArray(x) ? x : [x, x.replace(/_/g, ' ')]; }); }
  var ZOMB = [['IsBaby', 'Baby', 'bool'], ['CanBreakDoors', 'Breaks doors', 'bool']];
  var PROF = sel(['none', 'armorer', 'butcher', 'cartographer', 'cleric', 'farmer', 'fisherman', 'fletcher', 'leatherworker', 'librarian', 'mason', 'nitwit', 'shepherd', 'toolsmith', 'weaponsmith']);
  var VTYPE = sel(['plains', 'desert', 'jungle', 'savanna', 'snow', 'swamp', 'taiga']);
  var VILL = [['prof', 'Job', 'select', PROF], ['vtype', 'Biome look', 'select', VTYPE], ['vlevel', 'Level', 'select', sel([['1', 'Novice'], ['2', 'Apprentice'], ['3', 'Journeyman'], ['4', 'Expert'], ['5', 'Master']])]];
  // Baby: Age = minus the ticks left until it grows up (20 min = -24000). The last three only show while Baby is on
  // (optShown); "stays a baby" hides the timer.
  var BABY = [['baby', 'Baby', 'bool'], ['babyLock', 'Stays a baby forever', 'bool'], ['growMin', 'Grows up in, minutes', 'int', 20], ['growSec', 'Grows up in, seconds', 'int', 0]];
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
  ['cow', 'mooshroom', 'sheep', 'pig', 'chicken', 'horse', 'donkey', 'mule', 'llama', 'cat', 'wolf', 'fox', 'panda', 'rabbit', 'goat', 'turtle', 'polar_bear', 'bee', 'camel', 'sniffer', 'armadillo', 'ocelot', 'strider', 'hoglin', 'axolotl', 'dolphin', 'skeleton_horse', 'zombie_horse'].forEach(function (m) {
    OPTS[m] = OPTS[m] || BABY; if (OPTS[m].indexOf(BABY[0]) < 0) OPTS[m] = OPTS[m].concat(BABY);
  });
  // More save-data, read from the 26.3 classes' readAdditionalSaveData (Oct 19). Kinds on top of bool / int /
  // select: 'time' = minutes + seconds written as ticks (blank = the game's own), 'player' = a Java player
  // looked up to a UUID (s.owner). Index 4 = oldest version group, 5 = a hint after the label.
  function more(id, rows) {
    var had = OPTS[id] || [], baby = had.filter(function (o) { return BABY.indexOf(o) > -1; });
    OPTS[id] = had.filter(function (o) { return BABY.indexOf(o) < 0; }).concat(rows, baby);
  }
  function sound(list) { return ['sound_variant', 'Sound', 'select', sel(list), 3]; }
  var TAME = ['Tame', 'Tamed', 'bool'], TAMED = ['Owner', 'Tamed by', 'player'], CHEST = ['ChestedHorse', 'Carries a chest', 'bool'];
  var ANGRY = ['AngerTime', 'Angry for', 'time', null, 0, 'then it calms down'];
  var BUCKET = ['FromBucket', 'From a bucket (never despawns)', 'bool'];
  more('wolf', [sound(['classic', 'angry', 'big', 'cute', 'grumpy', 'puglin', 'sad']), TAMED, ANGRY]);
  more('cat', [sound(['classic', 'royal']), TAMED]);
  more('parrot', [TAMED]);
  more('pig', [sound(['classic', 'big', 'mini'])]);
  more('cow', [sound(['classic', 'moody'])]);
  more('chicken', [sound(['classic', 'picky']), ['IsChickenJockey', 'Chicken jockey (a monster, lays no eggs)', 'bool'], ['EggLayTime', 'Lays its next egg in', 'time', null, 0, 'random 5 to 10 min']]);
  more('horse', [TAMED]);
  ['donkey', 'mule', 'llama'].forEach(function (m) { more(m, [TAME, TAMED, CHEST]); });
  more('trader_llama', [CHEST, ['DespawnDelay', 'Leaves in', 'time', null, 0, 'blank = with its trader']]);
  more('camel', [TAME, TAMED]);
  more('skeleton_horse', [TAME, TAMED, ['SkeletonTrap', 'Trap horse (lightning brings riders)', 'bool']]);
  more('zombie_horse', [TAME, TAMED]);
  more('fox', [['Trusted', 'Trusts', 'player']]);
  more('bee', [['HasNectar', 'Carries pollen', 'bool'], ['HasStung', 'Has stung (no stinger)', 'bool'], ANGRY]);
  ['iron_golem', 'polar_bear', 'enderman', 'zombified_piglin'].forEach(function (m) { more(m, [ANGRY]); });
  more('enderman', [['carried', 'Holds a block', 'select', []]]); // filled from mc-mob-lists.json
  more('copper_golem', [['weather_state', 'Rust', 'select', sel([['unaffected', 'Shiny'], ['exposed', 'Exposed'], ['weathered', 'Weathered'], ['oxidized', 'Oxidized']])], ['waxed', 'Waxed (never rusts)', 'bool']]);
  more('salmon', [['type', 'Size', 'select', sel(['small', 'medium', 'large']), 2], BUCKET]);
  more('pufferfish', [['PuffState', 'Puffed up', 'select', sel([['0', 'Not puffed'], ['1', 'Half puffed'], ['2', 'Fully puffed']])], BUCKET]);
  ['cod', 'tropical_fish', 'axolotl', 'tadpole'].forEach(function (m) { more(m, [BUCKET]); });
  more('shulker', [['AttachFace', 'Stuck to', 'select', sel([['0', 'Floor'], ['1', 'Ceiling'], ['2', 'North wall'], ['3', 'South wall'], ['4', 'West wall'], ['5', 'East wall']])], ['Peek', 'Lid open (0 to 100)', 'int', 0]]);
  more('phantom', [['psize', 'Size (0 to 64)', 'int', 0]]);
  more('sulfur_cube', [['Size', 'Size (0 = smallest)', 'int', 1], ['from_bucket', 'From a bucket (never despawns)', 'bool']]);
  more('zoglin', [['IsBaby', 'Baby', 'bool']]);
  more('hoglin', [['CannotBeHunted', 'Piglins never hunt it', 'bool']]);
  more('piglin', [['CannotHunt', 'Never hunts hoglins', 'bool']]);
  more('ocelot', [['Trusting', 'Trusts players', 'bool']]);
  more('turtle', [['has_egg', 'Carrying an egg', 'bool']]);
  more('dolphin', [['GotFish', 'Has a fish', 'bool']]);
  more('glow_squid', [['DarkTicksRemaining', 'Stays dark for', 'time', null, 0, 'no glow']]);
  more('wandering_trader', [['DespawnDelay', 'Leaves in', 'time', null, 0, 'blank = stays']]);
  more('mooshroom', [['stew', 'Stew effect', 'select', [], 0, 'brown only'], ['stewSec', 'Stew effect length (seconds)', 'int', 8]]); // effects filled from mc-mobs.json
  more('zombie_villager', [['ConversionTime', 'Turns back into a villager in', 'time', null, 0, 'being cured']]);
  more('wither', [['Invul', 'Charge-up (ticks, 220 = like a built wither)', 'int', 0]]);
  more('vindicator', [['Johnny', 'Attacks every mob (Johnny)', 'bool']]);
  more('zombie_nautilus', [['variant', 'Look', 'select', sel(['temperate', 'warm']), 3]]);
  // How a select's value is written: a minecraft: id, a plain string, or a byte. Others are plain numbers.
  var NBTFMT = { variant: 'id', sound_variant: 'id', Type: 'str', MainGene: 'str', HiddenGene: 'str', weather_state: 'str', type: 'str', Color: 'b', CollarColor: 'b', AttachFace: 'b' };
  var MATS = ['leather', 'chainmail', 'copper', 'iron', 'golden', 'diamond', 'netherite'];
  var SLOTS = [['head', 'Head'], ['chest', 'Chest'], ['legs', 'Legs'], ['feet', 'Feet'], ['mainhand', 'Main hand'], ['offhand', 'Off hand']];
  // The saddle and body slots (1.21.5 made them equipment slots like the rest): who takes what.
  var SADDLED = ' pig strider horse donkey mule skeleton_horse zombie_horse camel camel_husk nautilus zombie_nautilus ';
  var BODYNAME = { horse: 'Armor', wolf: 'Armor', llama: 'Carpet', trader_llama: 'Carpet', happy_ghast: 'Harness', nautilus: 'Armor', zombie_nautilus: 'Armor' };
  function bodyItems(id) {
    if (id === 'horse') return ['leather', 'iron', 'golden', 'diamond', 'copper', 'netherite'].map(function (m) { return m + '_horse_armor'; });
    if (id === 'wolf') return ['wolf_armor'];
    if (/llama$/.test(id)) return DYE.map(function (d) { return d + '_carpet'; });
    if (id === 'happy_ghast') return DYE.map(function (d) { return d + '_harness'; });
    if (/nautilus$/.test(id)) return ['copper', 'iron', 'golden', 'diamond', 'netherite'].map(function (m) { return m + '_nautilus_armor'; });
    return [];
  }
  // this mob's slots, in doll order
  function slotsOf(id) {
    return SLOTS.concat(SADDLED.indexOf(' ' + id + ' ') > -1 ? [['saddle', 'Saddle']] : [], BODYNAME[id] ? [['body', BODYNAME[id]]] : [], dropSlots(id));
  }
  // Drop slots (Oct 19): the body / saddle slots this mob never shows or uses. A mob drops all its slots when it
  // dies (Mob.dropCustomDeathLoot, every EquipmentSlot), so these hold loot nobody sees on it. Only the 1.21.5+
  // equipment map can fill them (older versions had no saddle slot and named the body item per mob).
  function dropSlots(id) {
    if (!top || top.ver !== 3) return [];
    var f = (BODYNAME[id] ? [] : ['body']).concat(SADDLED.indexOf(' ' + id + ' ') > -1 ? [] : ['saddle']);
    return f.map(function (k, i) { return [k, f.length > 1 ? 'Drop ' + (i + 1) : 'Drop']; });
  }
  function isDropOf(sl, id) { return dropSlots(id).some(function (x) { return x[0] === sl; }); }
  function itemsFor(slot, id) { return slot === 'body' ? bodyItems(id) : slot === 'saddle' ? ['saddle'] : ITEMS[slot]; }
  var ITEMS = {
    head: MATS.map(function (m) { return m + '_helmet'; }).concat(['turtle_helmet', 'carved_pumpkin', 'player_head', 'skeleton_skull', 'wither_skeleton_skull', 'zombie_head', 'creeper_head']),
    chest: MATS.map(function (m) { return m + '_chestplate'; }).concat(['elytra']),
    legs: MATS.map(function (m) { return m + '_leggings'; }),
    feet: MATS.map(function (m) { return m + '_boots'; }),
    // one of each tool, all netherite (other materials are under More); armor above stays one row per material
    mainhand: ['sword', 'axe', 'pickaxe', 'shovel', 'hoe', 'spear'].map(function (t) { return 'netherite_' + t; }).concat(['bow', 'crossbow', 'trident', 'mace', 'totem_of_undying', 'fishing_rod']),
    offhand: ['shield', 'totem_of_undying', 'bow', 'diamond_sword', 'netherite_sword', 'trident']
  };
  var BEST = {
    sword: { sharpness: 5, fire_aspect: 2, knockback: 2, unbreaking: 3 }, axe: { sharpness: 5, unbreaking: 3 }, bow: { power: 5, punch: 2, flame: 1 },
    crossbow: { quick_charge: 3, multishot: 1 }, trident: { impaling: 5, loyalty: 3 }, mace: { density: 5, wind_burst: 3 },
    helmet: { protection: 4, respiration: 3, thorns: 3, unbreaking: 3 }, chestplate: { protection: 4, thorns: 3, unbreaking: 3 }, leggings: { protection: 4, thorns: 3, unbreaking: 3 },
    boots: { protection: 4, feather_falling: 4, depth_strider: 3, unbreaking: 3 }
  };
  function itemVer(id) { return /^copper_|^netherite_horse|_harness$|_nautilus_armor$|_spear$/.test(id) ? 3 : id === 'mace' || id === 'wolf_armor' ? 1 : 0; }
  function itemIcon(id) { return '/minecrafticons/items/' + (id === 'crossbow' ? 'crossbow_standby' : id === 'leather_helmet' || id === 'leather_chestplate' || id === 'leather_leggings' || id === 'leather_boots' ? id : id) + '.png'; }
  function nice(id) { return id.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function iconOf(e) { return e.egg ? eggOf(e.egg.mob) : itemIcon(e.id); }
  function itemLabel(e) { return e.name || (e.egg ? mobName(e.egg.mob) + ' Spawn Egg' : nice(e.id)); }
  function kindOf(id) { var m = id.match(/_(sword|axe|pickaxe|shovel|hoe|spear|helmet|chestplate|leggings|boots)$/); return m ? m[1] : id; }

  // One equipped item: ench = {id: level}, attrs = {id: amount added}, glint = shine without enchantments,
  // dye = 'rrggbb' on leather and wolf armor ('' = undyed), trim = 'pattern:material' on armor ('' = none).
  // always = drops on any death (chance 2.0), name = a custom name, inv = storage slots (items or null),
  // fw = {flight, ex: [explosion]} on rockets and stars, egg = the mob in a spawn egg (a mobState).
  function gear(id, best) {
    return { id: id, count: 1, ench: best && BEST[kindOf(id)] ? Object.assign({}, BEST[kindOf(id)]) : {}, attrs: {}, unb: false, glint: false, drop: '', always: false,
      owner: '', dye: '', trim: '', name: '', inv: null, fw: null, egg: null };
  }
  // Dyeable in Java (the dyeable item tag): leather armor, leather horse armor, wolf armor.
  var DYEABLE = /^leather_(helmet|chestplate|leggings|boots|horse_armor)$|^wolf_armor$/;
  // Trims (the trimmable_armor tag = every helmet, chestplate, leggings and boots, turtle shell too). Patterns in
  // creative-menu order, [id, version group]; materials [id, the item shown, version group], like the smithing table.
  var TRIMMABLE = /_(helmet|chestplate|leggings|boots)$/;
  var TRIMP = [['sentry'], ['dune'], ['coast'], ['wild'], ['ward'], ['eye'], ['vex'], ['tide'], ['snout'], ['rib'], ['spire'], ['wayfinder'], ['shaper'], ['silence'], ['raiser'], ['host'], ['flow', 1], ['bolt', 1]];
  var TRIMM = [['amethyst', 'amethyst_shard'], ['copper', 'copper_ingot'], ['diamond', 'diamond'], ['emerald', 'emerald'], ['gold', 'gold_ingot'], ['iron', 'iron_ingot'],
    ['lapis', 'lapis_lazuli'], ['netherite', 'netherite_ingot'], ['quartz', 'quartz'], ['redstone', 'redstone'], ['resin', 'resin_brick', 2]];
  function trimOk(t) {
    var a = String(t).split(':');
    return a.length === 2 && TRIMP.some(function (x) { return x[0] === a[0]; }) && TRIMM.some(function (x) { return x[0] === a[1]; });
  }
  // Storage: how many slots an item holds. Chest-likes keep slot numbers (the container component; before 1.20.5
  // BlockEntityTag.Items), bundles are a plain list (bundle_contents, 1.20.5+). Columns as on the block's screen.
  function invMax(id) { return /^(chest|trapped_chest|barrel)$|shulker_box$/.test(id) ? 27 : /^(dispenser|dropper|crafter)$/.test(id) ? 9 : id === 'hopper' ? 5 : /bundle$/.test(id) ? 16 : 0; }
  function invSize(id) { return /bundle$/.test(id) && s.ver === 0 ? 0 : invMax(id); }
  var INVCOLS = { 27: 9, 9: 3, 5: 5, 16: 8 };
  // A spawn egg holds a whole mob (entity_data), and so can the armor stand item. Giants and illusioners have no
  // egg of their own: they ride in a zombie egg (like the Spawn egg output).
  function eggMob(id) { var m = id.replace(/_spawn_egg$/, ''); return m !== id && MOBS.some(function (x) { return x.id === m; }) ? m : ''; }
  function eggItem(m) { var bm = MOBS.filter(function (x) { return x.id === m; })[0] || {}; return m === 'armor_stand' ? 'armor_stand' : bm.egg ? m + '_spawn_egg' : 'zombie_spawn_egg'; }
  // Fireworks: a rocket = flight + explosions, a star = one explosion (shapes and NBT: McFirework, mc-firework.js)
  function isFw(id) { return id === 'firework_rocket' || id === 'firework_star'; }
  function newEx() { return { shape: 'small_ball', colors: [McDyes.byId('red').fw], fade: [], trail: false, twinkle: false }; }
  // A drop slot or a storage slot offers these first. More = every item, Mob = any mob as a spawn egg.
  var LOOTQ = ['diamond', 'emerald', 'gold_ingot', 'iron_ingot', 'netherite_ingot', 'golden_apple', 'enchanted_golden_apple', 'totem_of_undying',
    'ender_pearl', 'experience_bottle', 'enchanted_book', 'firework_rocket', 'chest', 'barrel', 'shulker_box', 'bundle'];
  // The armor and hand slots take any item in the game (a mob can wear glass or hold dirt); the saddle and
  // body slots only what fits them. ITEM_IDS = every item id (mc-item-ids.json, _tools/items/build.py).
  var ANY = { head: 1, chest: 1, legs: 1, feet: 1, mainhand: 1, offhand: 1 };
  function fits(slot, id, mobId) { return itemsFor(slot, mobId).indexOf(id) > -1 || !!(ANY[slot] || isDropOf(slot, mobId)) && ITEM_IDS.indexOf(id) > -1 && id !== 'air'; }
  var NCOL = ['red', 'gold', 'yellow', 'green', 'aqua', 'blue', 'light_purple', 'dark_red', 'dark_purple', 'gray', 'white', 'black'];
  var FLAGS = ['PersistenceRequired', 'NoAI', 'Invulnerable', 'Silent', 'Glowing', 'NoGravity', 'LeftHanded', 'CanPickUpLoot', 'FallFlying', 'HasVisualFire', 'OnGround'];
  var NFMT = ['bold', 'italic', 'underlined', 'strikethrough', 'obfuscated']; // name styles, whole name
  // One mob's own settings. The page's mob is one, and so is every rider on it (Oct 19: riders are full mobs,
  // edited in the rider dialog). owner = the player picked in a "Tamed by" / "Trusts" field (id = UUID).
  function mobState(id) {
    return { mob: id, name: '', ncolor: '', nfmt: {}, showName: false, health: '', trades: [], flags: {}, opt: {}, attr: {}, eq: {},
      fx: [], riders: [], slot: 'head', tags: '', fire: 0, owner: { name: '', id: '' }, loot: '', x: {} };
  }
  // The page opens on a plain villager: nothing set, the command is just /summon minecraft:villager. Reset returns here.
  // The root mob also holds the command-wide settings (version, output, picker filter), the riders (on top,
  // bottom first) and the mounts (underneath it, nearest first: mounts[0] carries the page's mob).
  function defaults() {
    return Object.assign(mobState('villager'), { ver: 3, out: 'summon', grp: s ? s.grp : '', q: s ? s.q : '', mounts: [] });
  }
  // s = the mob being edited (the root, or a rider while its dialog is open); top = the root mob.
  var s = null, top = null;
  s = top = defaults();
  // Runs fn with s = st (a rider), lending it the root's version and output.
  function as(st, fn) {
    var keep = s;
    s = st; st.ver = top.ver; st.out = top.out;
    try { return fn(); } finally { s = keep; }
  }

  function mob() { return MOBS.filter(function (m) { return m.id === s.mob; })[0]; }
  function fxInfo(id) { return FX.filter(function (x) { return x[0] === id; })[0] || [id, id, '']; } // [id, name, colour]
  function okv(v) { return (v || 0) <= s.ver; }

  // ---- builder ----
  function drawList() {
    var q = s.q.toLowerCase();
    var matches = MOBS.filter(function (m) { return okv(m.v) && (!s.grp || s.grp === m.g) && (!q || m.name.toLowerCase().indexOf(q) > -1); });
    // All: A to Z, one row per first letter. A filter: that group's row.
    var rows = s.grp ? GROUPS.filter(function (g) { return s.grp === g[0]; }).map(function (g) { return [g[0], g[1], matches, '']; }) : [];
    if (!s.grp) {
      matches = matches.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
      matches.forEach(function (m) {
        var L = m.name[0].toUpperCase(), last = rows[rows.length - 1];
        if (last && last[1] === L) last[2].push(m); else rows.push(['az-' + L, L, [m], ' mt-grp--az']);
      });
    }
    var focusMob = matches.some(function (m) { return m.id === s.mob; }) ? s.mob : matches.length ? matches[0].id : '';
    var html = rows.map(function (g) {
      var list = g[2];
      if (!list.length) return '';
      return '<div class="mt-grp' + g[3] + '" role="group" aria-labelledby="mobGroup-' + g[0] + '"><h3 class="mt-grp-h" id="mobGroup-' + g[0] + '">' + g[1] + (g[3] ? '' : ' <span>' + list.length + '</span>') + '</h3><div class="mt-grid">' + list.map(function (m) {
        return '<button type="button" class="mt-mob" data-mob="' + m.id + '" aria-pressed="' + (m.id === s.mob) + '" tabindex="' + (m.id === focusMob ? '0' : '-1') + '">' +
          '<img src="' + eggOf(m.id) + '" alt="" loading="lazy"><span>' + m.name + '</span>' + (m.since && m.v === s.ver ? '<em>' + m.since + '+</em>' : '') + '</button>';
      }).join('') + '</div></div>';
    }).join('');
    root.innerHTML = html || '<p class="mt-empty">No mob matches that search.</p>';
    document.querySelectorAll('#mobFilt [data-n]').forEach(function (b) {
      var g = b.getAttribute('data-n');
      b.textContent = MOBS.filter(function (m) { return okv(m.v) && (!g || m.g === g); }).length;
    });
    var status = $('mobListStatus');
    if (status) status.textContent = matches.length ? matches.length + (matches.length === 1 ? ' mob' : ' mobs') + ' available' : 'No mobs match. Try another search or filter.';
  }
  function eggOf(id) { return id === 'armor_stand' ? '/minecrafticons/items/armor_stand.png' : id === 'giant' ? '/minecrafticons/eggs/zombie.png' : id === 'illusioner' ? '/minecrafticons/eggs/evoker.png' : '/minecrafticons/eggs/' + id + '.png'; }
  // minutes + seconds, saved as k_m / k_s; blank = left out (the game's own timing)
  function timeField(k, label, hint) {
    return '<div class="mt-f"><span class="mt-l">' + label + (hint ? ' <span class="mt-u">' + hint + '</span>' : '') + '</span><div class="mt-time">' + [['_m', 'min', 'minutes'], ['_s', 'sec', 'seconds']].map(function (t) {
      var x = s.opt[k + t[0]];
      return '<label><input class="mt-in" type="number" min="0" data-opt="' + k + t[0] + '" value="' + (x != null && x !== '' ? x : '') + '" placeholder="0" aria-label="' + label + ', ' + t[2] + '"><span>' + t[1] + '</span></label>';
    }).join('') + '</div></div>';
  }
  // an effect's time in ticks, or null = forever (both boxes blank)
  function fxTicks(f) {
    if ((f.m == null || f.m === '') && (f.sec == null || f.sec === '')) return null;
    return Math.max(1, Math.min(2147483647, Math.round((Math.max(0, +f.m || 0) * 60 + Math.max(0, +f.sec || 0)) * 20)));
  }
  function ticks(k) {
    var m = s.opt[k + '_m'], c = s.opt[k + '_s'];
    if ((m == null || m === '') && (c == null || c === '')) return null;
    return Math.min(2147483647, Math.round((Math.max(0, +m || 0) * 60 + Math.max(0, +c || 0)) * 20));
  }
  // ---- "Tamed by" / "Trusts": a Java player, looked up to the UUID the game stores (playerdb.co) ----
  var UUIDRE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i, LOOKED = {}, lookT = 0;
  function dashed(id) { var h = id.replace(/-/g, '').toLowerCase(); return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].join('-'); }
  function uuidNbt(id) { var h = id.replace(/-/g, ''); return '[I;' + [0, 8, 16, 24].map(function (i) { return parseInt(h.substr(i, 8), 16) | 0; }).join(',') + ']'; }
  function headSrc() { return s.owner.id ? 'https://mc-heads.net/avatar/' + s.owner.id.replace(/-/g, '') + '/32' : '/minecrafticons/items/player_head.png'; }
  function playerStatus() {
    var o = s.owner;
    return { look: 'Looking up ' + o.name + '…', ok: 'Found ' + o.name + '.', uuid: 'Using this UUID.', bad: 'No Java player has that name. Check the spelling or paste their UUID.',
      net: 'The name lookup didn\'t answer. Paste the player\'s UUID instead.' }[o.st] || (o.id ? 'Saved player.' : 'Blank leaves it out.');
  }
  function playerField(label) {
    var o = s.owner;
    return '<div class="mt-f mt-player"><label class="mt-l" for="mobPlayer">' + label + ' <span class="mt-u">Java username or UUID</span></label>' +
      '<div class="mt-player-in"><span class="mt-well"><img id="mobPlayerHead" src="' + headSrc() + '" alt="" width="24" height="24"></span>' +
      '<input class="mt-in" id="mobPlayer" type="text" maxlength="36" value="' + esc(o.name || o.id) + '" placeholder="Notch" autocomplete="off" spellcheck="false" aria-describedby="mobPlayerSt"></div>' +
      '<small class="mt-player-st' + (o.st === 'bad' || o.st === 'net' ? ' is-bad' : '') + '" id="mobPlayerSt" role="status">' + playerStatus() + '</small></div>';
  }
  function playerLook() {
    var st = $('mobPlayerSt'), h = $('mobPlayerHead');
    if (st) { st.textContent = playerStatus(); st.classList.toggle('is-bad', s.owner.st === 'bad' || s.owner.st === 'net'); }
    if (h) h.src = headSrc();
  }
  function playerInput(v) {
    var me = s, o = s.owner;
    v = v.trim();
    clearTimeout(lookT);
    if (UUIDRE.test(v)) { o.id = dashed(v); o.name = ''; o.st = 'uuid'; playerLook(); render(); return; }
    o.name = /^\w{1,16}$/.test(v) ? v : ''; o.id = ''; o.st = o.name ? 'look' : v ? 'bad' : '';
    playerLook(); render();
    if (!o.name) return;
    var name = o.name;
    function done(id) {
      if (me.owner.name !== name) return; // typed again since
      o.id = id || ''; o.st = id ? 'ok' : id === null ? 'bad' : 'net';
      if (s === me) playerLook();
      render();
    }
    lookT = setTimeout(function () { lookName(name, done); }, 450);
  }
  // cb(UUID), cb(null) = no such player, cb(undefined) = the lookup didn't answer. Cached per name.
  function lookName(name, cb) {
    var key = name.toLowerCase();
    if (key in LOOKED) return cb(LOOKED[key]);
    fetch('https://playerdb.co/api/player/minecraft/' + encodeURIComponent(name)).then(function (r) { return r.json(); }).then(function (j) {
      var id = j && j.success && j.data && j.data.player && j.data.player.id;
      LOOKED[key] = id && UUIDRE.test(id) ? dashed(id) : null;
      cb(LOOKED[key]);
    }).catch(function () { cb(undefined); });
  }
  function field(o, val) {
    var k = o[0], label = o[1], kind = o[2];
    if (kind === 'time') return timeField(k, label, o[5]);
    if (kind === 'player') return playerField(label);
    if (o[5] && kind === 'select') label += ' <span class="mt-u">' + o[5] + '</span>';
    // the grow-up timer: minutes and seconds in one field
    if (k === 'growSec') return '';
    if (k === 'growMin') return '<div class="mt-f"><span class="mt-l">Grows up in</span><div class="mt-time">' + [['growMin', 'min', 'Minutes'], ['growSec', 'sec', 'Seconds']].map(function (t) {
      var x = s.opt[t[0]];
      return '<label><input class="mt-in" type="number" min="0" data-opt="' + t[0] + '" value="' + (x != null && x !== '' ? x : '') + '" placeholder="' + (t[0] === 'growMin' ? 20 : 0) + '" aria-label="Grows up in, ' + t[2].toLowerCase() + '"><span>' + t[1] + '</span></label>';
    }).join('') + '</div></div>';
    if (kind === 'bool') return '<label class="mt-tg"><input type="checkbox" data-opt="' + k + '"' + (val ? ' checked' : '') + '><span class="mt-sw" aria-hidden="true"></span>' + label + '</label>';
    if (kind === 'int') return '<label class="mt-f"><span class="mt-l">' + label + '</span><input class="mt-in" type="number" data-opt="' + k + '" value="' + (val != null && val !== '' ? val : '') + '" placeholder="' + (o[3] != null ? o[3] : '') + '"></label>';
    return '<label class="mt-f"><span class="mt-l">' + label + '</span><select class="mt-in" data-opt="' + k + '"><option value="">Random / default</option>' + o[3].map(function (v) { return '<option value="' + v[0] + '"' + (String(val) === v[0] ? ' selected' : '') + '>' + v[1].replace(/\b\w/g, function (c) { return c.toUpperCase(); }) + '</option>'; }).join('') + '</select></label>';
  }
  // Any mob with Baby can be locked by command, villagers too: the 26.3 tag entity_type/cannot_be_age_locked only
  // stops the golden dandelion (AgeableMob.canUseGoldenDandelion); loading AgeLocked from NBT doesn't check it.
  function optShown(k) {
    if (k === 'babyLock') return !!s.opt.baby;
    if (k === 'growMin' || k === 'growSec') return !!s.opt.baby && !s.opt.babyLock;
    return true;
  }
  // Locked: AgeLocked is the golden dandelion's lock (26.x). Older versions don't have it, so they get the
  // lowest Age there is instead: a baby grows one tick at a time, about 3.4 years of being loaded.
  function babyAge() {
    if (s.opt.babyLock) return s.ver === 3 ? 'Age:-24000,AgeLocked:1b' : 'Age:-2147483648';
    var m = s.opt.growMin || '', sec = s.opt.growSec || ''; // both empty = the game's 20 minutes
    var t = m === '' && sec === '' ? 1200 : Math.max(0, +m || 0) * 60 + Math.max(0, +sec || 0);
    return 'Age:-' + Math.max(1, Math.min(2147483647, Math.round(t * 20)));
  }
  // An empty minutes box counts as 0 once seconds are typed (babyAge), so its grey hint says so.
  function growHint() {
    var mi = document.querySelector('#mobOpts [data-opt="growMin"]');
    if (mi) mi.placeholder = s.opt.growSec ? '0' : '20';
  }
  // A child option (the lock, the timer) only takes room while it applies: it folds shut under Baby, and
  // is inert while shut so Tab skips it.
  function babySync() {
    document.querySelectorAll('#mobOpts [data-cell]').forEach(function (c) {
      var on = optShown(c.getAttribute('data-cell'));
      c.classList.toggle('is-open', on);
      c.inert = !on;
    });
  }
  function drawOptions() {
    // only selects carry a version (index 4); bools and numbers keep their default at index 3
    var opts = (OPTS[s.mob] || []).filter(function (o) { return okv(o[4] || 0) && (o[2] !== 'select' || o[3].length); });
    $('mobOptsWrap').hidden = !opts.length;
    $('mobOptsH').textContent = mob().name + ' options';
    var draw = function (o) {
      var v = s.opt[o[0]];
      if (v === undefined && o[2] === 'bool' && o[3] === 1) v = true;
      return field(o, v);
    };
    // Three groups, each its own kind of control: pickers and numbers, then switches, then Baby with its
    // lock and timer nested under it (babySync opens them).
    var own = opts.filter(function (o) { return BABY.indexOf(o) < 0; }), baby = opts.filter(function (o) { return BABY.indexOf(o) > -1; });
    var fields = own.filter(function (o) { return o[2] !== 'bool'; }).map(draw).join(''), flags = own.filter(function (o) { return o[2] === 'bool'; }).map(draw).join('');
    $('mobOpts').innerHTML = (fields ? '<div class="mt-grid3 mt-opts">' + fields + '</div>' : '') +
      (flags ? '<div class="mt-grid3">' + flags + '</div>' : '') +
      (baby.length ? '<div class="mt-babyset">' + baby.map(function (o) {
        var h = draw(o);
        return !h ? '' : o === BABY[0] ? h : '<div class="mt-kid" data-cell="' + o[0] + '"><div class="mt-kid-in">' + h + '</div></div>';
      }).join('') + '</div>' : '');
    babySync();
    growHint();
  }
  function attrDef(a) { var d = mob().d; return a[0] in d ? d[a[0]] : a[3]; }
  function mobAttrs() {
    var d = mob().d;
    return ATTR.filter(function (a) {
      if (a[0] === 'flying_speed') return !!d.flying_speed;
      if (a[0] === 'jump_strength') return s.ver >= 1 || !!RANDOM_STATS[s.mob]; // horse.jump_strength before 1.20.5
      return okv(a[4]) && (a[0] in d || a[3] != null);
    });
  }
  // One tick + amount row (.mt-tick in mc-tool.css): tick, name (unit under it), amount, the game default.
  function row(key, id, name, unit, on, val, note) {
    return '<li class="mt-tick' + (on ? ' is-on' : '') + '" ' + key + '="' + id + '">' +
      '<label><input type="checkbox"' + (on ? ' checked' : '') + '><span>' + name + (unit ? '<small>' + unit + '</small>' : '') + '</span></label>' +
      '<input class="mt-in mt-num" type="number" step="any" value="' + val + '" aria-label="' + name + (unit ? ', ' + unit : '') + '">' +
      '<small class="mt-def">' + note + '</small></li>';
  }
  function drawAttrs() {
    $('mobAttrs').innerHTML = mobAttrs().map(function (a) {
      var on = a[0] in s.attr;
      return row('data-attr', a[0], a[1], a[2], on, on ? s.attr[a[0]] : attrDef(a), 'default ' + attrDef(a));
    }).join('');
    $('mobRandom').hidden = !RANDOM_STATS[s.mob];
  }
  // Just the six doll slots (their glint), so a tick in the item editor doesn't redraw the editor itself.
  function drawDollOnly() {
    var list = slotsOf(s.mob);
    $('mobDoll').style.setProperty('--n', list.length);
    $('mobDoll').style.setProperty('--nm', list.length > 6 ? 4 : 3); // phones: two rows
    $('mobDoll').innerHTML = list.map(function (sl) {
      var e = s.eq[sl[0]];
      return '<button type="button" class="mt-slot' + (shiny(e) ? ' is-ench' : '') + '" data-slot="' + sl[0] + '" aria-pressed="' + (s.slot === sl[0]) + '" aria-label="' + sl[1] + (e ? ': ' + esc(itemLabel(e)) : ': empty') + '">' +
        (e ? '<img src="' + iconOf(e) + '" alt="">' : '<i aria-hidden="true"></i>') + '<span>' + sl[1] + '</span></button>';
    }).join('');
  }
  // A new mob keeps only the gear its slots take (a horse's armor doesn't carry over to a llama).
  function fitGear() {
    var ok = slotsOf(s.mob).map(function (x) { return x[0]; });
    Object.keys(s.eq).forEach(function (k) { if (ok.indexOf(k) < 0 || !fits(k, s.eq[k].id, s.mob)) delete s.eq[k]; });
  }
  function drawDoll() {
    if (!slotsOf(s.mob).some(function (x) { return x[0] === s.slot; })) s.slot = 'head';
    drawDollOnly();
    drawItemEd();
  }
  function slotName(sl) { var x = slotsOf(s.mob).filter(function (y) { return y[0] === sl; })[0]; return x ? x[1] : nice(sl); }
  var MORE = '<button type="button" class="mt-it mt-it--more" data-more aria-haspopup="dialog" aria-controls="mtItemDlg" title="Every item in the game">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg><span>More</span></button>';
  // The item editor works on it(): the doll's picked slot, or a slot inside storage (an item frame in the editor dialog).
  function drawItemEd() {
    var f = itemFrame(), e = it(), sl = s.slot, loot = !!f || isDropOf(sl, s.mob);
    $('mobPickK').textContent = f ? 'Slot ' + (f.i + 1) : slotName(sl);
    $('mtPickName').textContent = e ? itemLabel(e) : 'nothing';
    // The usual items for the slot (loot for drops and storage), the picked one if it came from "More", then Mob and More.
    var quick = (loot ? LOOTQ : itemsFor(sl, s.mob)).filter(function (id) { return okv(itemVer(id)); });
    if (e && quick.indexOf(e.id) < 0) quick.push(e.id);
    var tile = function (id) {
      var on = !!e && e.id === id, l = esc(on ? itemLabel(e) : nice(id));
      return '<button type="button" class="mt-it" data-item="' + id + '" aria-pressed="' + on + '" title="' + l + '" aria-label="' + l + '"><img src="' + (on ? iconOf(e) : itemIcon(id)) + '" alt=""></button>';
    };
    $('mobPick').innerHTML = '<button type="button" class="mt-it mt-it--none" data-item="" aria-pressed="' + !e + '" aria-label="Nothing">None</button>' + quick.map(tile).join('') +
      (loot ? '<button type="button" class="mt-it mt-it--more" data-mobegg aria-haspopup="dialog" aria-controls="mtPickDlg" title="Any mob, as its spawn egg"><img src="/minecrafticons/items/zombie_spawn_egg.png" alt=""><span>Mob</span></button>' : '') +
      ((ANY[sl] || loot) && ITEM_IDS.length ? MORE : '');
    drawDye(); drawTrim(); drawOwner(); drawEgg(); drawInv(); drawFw();
    $('mobEqOpts').hidden = !e;
    $('mobQty').hidden = !e;
    $('mobCount').closest('.mt-f').hidden = !loot && (sl === 'saddle' || sl === 'body'); // a saddle or body armor is always one
    $('mobDropWrap').hidden = $('mobAlwaysWrap').hidden = !!f; // things in storage don't drop from the mob
    if (e) {
      $('mobCount').value = e.count;
      $('mobDropPct').value = e.always ? '' : e.drop;
      $('mobDropPct').disabled = e.always;
      $('mobAlways').checked = e.always;
      drawItem();
    }
  }
  // Puts id ('' = nothing) in it()'s place. A new item keeps unbreakable / drop chance / attributes / count / name,
  // the enchantments it can take, the dye or trim if it takes one, and its storage / fireworks / egg's mob.
  // A new item in an empty drop slot always drops.
  function setItem(id) {
    var old = it(), f = itemFrame();
    if (!id) return putIt(null);
    var g = gear(id);
    if (eggMob(id)) g.egg = old && old.egg && eggMob(old.id) === eggMob(id) ? old.egg : mobState(eggMob(id));
    if (invMax(id)) g.inv = old && old.inv || [];
    if (isFw(id)) g.fw = old && old.fw || { flight: 1, ex: [newEx()] };
    putIt(g);
    if (!old) { g.always = !f && isDropOf(s.slot, s.mob); return; }
    ['count', 'unb', 'glint', 'drop', 'always', 'owner', 'attrs', 'name'].forEach(function (k) { g[k] = old[k]; });
    if (DYEABLE.test(id)) g.dye = old.dye || '';
    if (TRIMMABLE.test(id)) g.trim = old.trim || '';
    MCI.ENCH.forEach(function (en) { if (en.id in old.ench && fitsItem(en, id)) g.ench[en.id] = old.ench[en.id]; });
  }
  // "Mob" in a drop or storage slot: the mob picker; picking one puts its spawn egg in the slot.
  var pickFor = null;
  function pickMob() {
    pickFor = function (m) { setItem(eggItem(m)); it().egg = mobState(m); drawItemEd(); render(); say(mobName(m) + ' spawn egg picked'); };
    openPicker('Pick a mob for its spawn egg');
  }
  // ---- spawn egg: which mob, what it has set, Edit opens it like a rider ----
  function drawEgg() {
    var e = it(), on = !!e && !!e.egg;
    $('mobEggWrap').hidden = !on;
    if (!on) return;
    $('mobEggImg').src = eggOf(e.egg.mob);
    $('mobEggName').textContent = mobName(e.egg.mob);
    $('mobEggSum').innerHTML = riderSum(e.egg) || 'Nothing set yet. Edit gives it its own name, stats, gear and effects.';
  }
  // ---- storage: the slots as on the block's screen; a slot opens that item in the editor dialog ----
  function drawInv() {
    var e = it(), n = e ? invSize(e.id) : 0;
    $('mobInvWrap').hidden = !n;
    if (!n) return;
    $('mobInv').style.setProperty('--cols', INVCOLS[n] || 9);
    $('mobInv').innerHTML = invCells(e, n);
    $('mobInvN').textContent = invUsed(e, n);
  }
  function invUsed(e, n) { return (e.inv || []).slice(0, n).filter(Boolean).length + ' of ' + n + ' slots used'; }
  // the n slots of e's storage, each a button that opens it in the editor dialog (data-cell)
  function invCells(e, n) {
    var inv = e.inv || (e.inv = []), cells = [];
    for (var i = 0; i < n; i++) {
      var x = inv[i];
      cells.push('<button type="button" class="mt-it mt-cell' + (shiny(x) ? ' is-ench' : '') + '" data-cell="' + i + '" aria-label="Slot ' + (i + 1) + (x ? ': ' + (x.count > 1 ? x.count + ' ' : '') + esc(itemLabel(x)) : ', empty') + '"' + (x ? ' title="' + esc(itemLabel(x)) + '"' : '') + '>' +
        (x ? '<img src="' + iconOf(x) + '" alt="">' + (x.count > 1 ? '<b aria-hidden="true">' + x.count + '</b>' : '') : '') + '</button>');
    }
    return cells.join('');
  }
  // ---- fireworks: a rocket's flight and explosions, or a star's one explosion ----
  function drawFw() {
    var e = it(), on = !!e && !!e.fw && isFw(e.id);
    $('mobFwWrap').hidden = !on;
    if (!on) return;
    var star = e.id === 'firework_star', ex = star ? e.fw.ex.slice(0, 1) : e.fw.ex;
    $('mobFwFlightWrap').hidden = star;
    $('mobFwAdd').hidden = star || ex.length >= 8;
    pressed('mobFwFlight', 'data-flight', String(e.fw.flight));
    var dyes = function (x, k, label) {
      return '<div class="mt-f"><span class="mt-l">' + label + '</span><div class="mt-dyes" data-key="' + k + '" role="group" aria-label="' + label + '">' + McDyes.LIST.map(function (d) {
        return '<button type="button" class="mt-swc" data-col="' + d.fw + '" aria-pressed="' + (x[k].indexOf(d.fw) > -1) + '" title="' + d.name + '" aria-label="' + d.name + '" style="background:' + McDyes.hex(d.fw) + '"></button>';
      }).join('') + '</div></div>';
    };
    $('mobFwEx').innerHTML = ex.map(function (x, i) {
      return '<li class="mt-fwx" data-ex="' + i + '"><div class="mt-l-row"><b class="mt-fwx-h">' + (star ? 'The star' : 'Explosion ' + (i + 1)) + '</b>' +
        (ex.length > 1 ? '<button type="button" class="mt-link" data-exdel>Remove</button>' : '') + '</div>' +
        '<div class="mt-seg mt-fw-shapes" role="group" aria-label="Shape">' + McFirework.SHAPES.map(function (sh) {
          return '<button type="button" data-shape="' + sh.id + '" aria-pressed="' + (x.shape === sh.id) + '" aria-label="' + sh.name + '" title="' + sh.name + '"><img src="' + itemIcon(sh.item || 'firework_star') + '" alt=""><span>' + sh.name + '</span></button>';
        }).join('') + '</div>' + dyes(x, 'colors', 'Colours') + dyes(x, 'fade', 'Fades to') +
        '<div class="mt-grid2"><label class="mt-tg"><input type="checkbox" data-fwk="trail"' + (x.trail ? ' checked' : '') + '><span class="mt-sw" aria-hidden="true"></span>Trail</label>' +
        '<label class="mt-tg"><input type="checkbox" data-fwk="twinkle"' + (x.twinkle ? ' checked' : '') + '><span class="mt-sw" aria-hidden="true"></span>Twinkle</label></div></li>';
    }).join('');
  }

  // ---- "More": every item in the game, for an armor or hand slot (Oct 19) ----
  // Built once (1,600+ icons, lazy-loaded as they scroll in); the search only hides and shows them.
  var idlg = null, itemsBuilt = false;
  var ITEM_HINT = {
    head: 'Blocks sit on its head, here and in game, the way a carved pumpkin does.',
    mainhand: 'Blocks show as a small cube in its hand, items as they look held.',
    offhand: 'Blocks show as a small cube in its hand, items as they look held.'
  };
  function itemVis() { return Array.prototype.filter.call($('itemList').children, function (b) { return !b.hidden; }); }
  function filterItems() {
    var q = $('itemFind').value.trim().toLowerCase().replace(/^minecraft:/, '').replace(/\s+/g, '_'), n = 0;
    Array.prototype.forEach.call($('itemList').children, function (b) {
      var hit = !q || b.getAttribute('data-id').indexOf(q) > -1;
      b.hidden = !hit; if (hit) n++;
    });
    // Tab into the grid lands on the picked item, or the first match when that one is filtered out
    var v = itemVis();
    if (v.length && !v.some(function (b) { return b.tabIndex === 0; })) { $('itemList').querySelectorAll('[tabindex="0"]').forEach(function (b) { b.tabIndex = -1; }); v[0].tabIndex = 0; }
    $('itemCount').textContent = n ? (q ? n + (n === 1 ? ' match' : ' matches') : n.toLocaleString('en') + ' items') : 'Nothing matches that search.';
  }
  // o (trades): {cur: the id now, title, hint, pick(id), back() = what gets focus after}. No o = the gear slot (it()).
  var itemFor = null;
  function openItems(o) {
    var list = $('itemList'), e = it(), f = itemFrame();
    itemFor = o || null;
    if (!itemsBuilt) {
      itemsBuilt = true;
      list.innerHTML = ITEM_IDS.filter(function (id) { return id !== 'air'; }).map(function (id) {
        return '<button type="button" class="mt-it" data-id="' + id + '" aria-label="' + nice(id) + '" tabindex="-1"><img src="' + itemIcon(id) + '" alt="" loading="lazy" width="30" height="30"></button>';
      }).join('');
    }
    var cur = o ? o.cur : e ? e.id : '';
    Array.prototype.forEach.call(list.children, function (b) { var on = b.getAttribute('data-id') === cur; b.setAttribute('aria-pressed', String(on)); b.tabIndex = on ? 0 : -1; });
    $('mtItemSlot').textContent = o ? o.title : f ? nice(f.c.id) + ', slot ' + (f.i + 1) : slotName(s.slot);
    $('itemHint').textContent = o ? o.hint : f ? 'Anything fits in storage here, as it does in game.' : isDropOf(s.slot, s.mob) ? 'Nobody sees this slot on the mob. It drops when the mob dies.' :
      ITEM_HINT[s.slot] || 'Only armor made for this slot is drawn on the mob. Anything else is still worn, and dropped.';
    $('itemFind').value = '';
    $('itemName').textContent = cur ? nice(cur) : '';
    filterItems();
    idlg.showModal();
    var cur = list.querySelector('[aria-pressed="true"]');
    // a mouse goes straight to the search; touch starts on the grid so the keyboard doesn't cover it
    if (matchMedia('(pointer: fine)').matches || !cur) $('itemFind').focus();
    else cur.focus();
    if (cur) cur.scrollIntoView({ block: 'center' });
  }
  function itemDialog() {
    idlg = $('mtItemDlg');
    var list = $('itemList');
    $('mtItemClose').addEventListener('click', function () { idlg.close(); });
    idlg.addEventListener('click', function (e) {
      if (e.target !== idlg) return;
      var r = idlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) idlg.close();
    });
    // the dialog hands focus back to what opened it, which the redraw replaced: put it on the new one
    idlg.addEventListener('close', function () {
      var m = itemFor ? itemFor.back() : $('mobPick').querySelector('[data-more]');
      itemFor = null;
      if (m) m.focus({ preventScroll: true });
    });
    $('itemFind').addEventListener('input', filterItems);
    $('itemFind').addEventListener('keydown', function (e) {
      var v = itemVis();
      if (e.key === 'Enter' && v.length) { e.preventDefault(); v[0].click(); }
      else if (e.key === 'ArrowDown' && v.length) { e.preventDefault(); v[0].tabIndex = 0; v[0].focus(); }
    });
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-id]'); if (!b) return;
      if (itemFor) { itemFor.pick(b.getAttribute('data-id')); idlg.close(); return; }
      setItem(b.getAttribute('data-id'));
      idlg.close();
      drawDoll(); render();
      say(nice(b.getAttribute('data-id')) + ' picked for ' + $('mtItemSlot').textContent);
    });
    var name = function (e) { var b = e.target.closest && e.target.closest('[data-id]'); if (b) $('itemName').textContent = nice(b.getAttribute('data-id')); };
    list.addEventListener('pointerover', name);
    list.addEventListener('focusin', name);
    // arrows move through the grid as it's laid out (rows = the same top edge)
    list.addEventListener('keydown', function (e) {
      var b = e.target.closest('[data-id]'); if (!b) return;
      var v = itemVis(), i = v.indexOf(b), cols = 1;
      while (cols < v.length && v[cols].offsetTop === v[0].offsetTop) cols++;
      var to = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols, Home: 0, End: v.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      if (to < 0 && e.key === 'ArrowUp') return $('itemFind').focus();
      to = Math.max(0, Math.min(v.length - 1, to));
      b.tabIndex = -1; v[to].tabIndex = 0; v[to].focus();
    });
  }

  // ---- dye (leather and wolf armor): undyed, a dye's colour, or any colour ----
  // A single dye on undyed leather gives exactly that dye's colour (DyedItemColor.applyDyes), so the
  // swatches are the 16 dyes; the colour box is for anything else, like the armor colour tool.
  var LEATHER = 'a06540'; // undyed leather (the dyed_color default)
  function drawDye() {
    var e = it(), on = !!e && DYEABLE.test(e.id);
    $('mobDyeWrap').hidden = !on;
    if (!on) return;
    var cur = e.dye, isDye = !cur || DYEHEX.indexOf(cur) > -1;
    // undyed: the item's own icon (leather's brown, the wolf armor's plain scutes)
    $('mobDye').innerHTML = '<button type="button" class="mt-swc mt-swc--undyed" data-dye="" aria-pressed="' + !cur + '" title="Undyed" aria-label="Undyed"><img src="' + itemIcon(e.id) + '" alt=""></button>' +
      DYEHEX.map(function (h, i) { return '<button type="button" class="mt-swc" data-dye="' + h + '" aria-pressed="' + (cur === h) + '" title="' + nice(DYE[i]) + ' dye" aria-label="' + nice(DYE[i]) + ' dye" style="background:#' + h + '"></button>'; }).join('') +
      '<label class="mt-swc mt-swc--any' + (isDye ? '' : ' is-on') + '" title="Any colour"' + (isDye ? '' : ' style="background:#' + cur + '"') + '><input type="color" id="mobDyeAny" value="#' + (cur || LEATHER) + '" aria-label="Any colour"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></label>';
    $('mobDyeV').textContent = !cur ? 'Undyed' : isDye ? nice(DYE[DYEHEX.indexOf(cur)]) + ' · #' + cur : '#' + cur;
  }
  // ---- armor trim: a switch; on, the pattern (its smithing template) and the material ----
  var lastTrim = 'sentry:gold'; // switching a trim on starts from the last one picked
  function drawTrim() {
    var e = it(), on = !!e && TRIMMABLE.test(e.id);
    $('mobTrimWrap').hidden = !on;
    if (!on) return;
    var t = e.trim ? e.trim.split(':') : null;
    $('mobTrimOn').checked = !!t;
    $('mobTrimSet').hidden = !t;
    if (!t) return;
    // newer patterns and materials hide on older versions, unless already picked
    var tile = function (cur, v, icon, label, attr) {
      return function (x) {
        if (!okv(x[v]) && x[0] !== cur) return '';
        var l = nice(x[0]) + label;
        return '<button type="button" class="mt-it" ' + attr + '="' + x[0] + '" aria-pressed="' + (x[0] === cur) + '" title="' + l + '" aria-label="' + l + '"><img src="' + itemIcon(icon(x)) + '" alt=""></button>';
      };
    };
    $('mobTrimP').innerHTML = TRIMP.map(tile(t[0], 1, function (x) { return x[0] + '_armor_trim_smithing_template'; }, ' trim', 'data-tp')).join('');
    $('mobTrimM').innerHTML = TRIMM.map(tile(t[1], 2, function (x) { return x[1]; }, '', 'data-tm')).join('');
    $('mobTrimPV').textContent = nice(t[0]);
    $('mobTrimMV').textContent = nice(t[1]);
  }
  // ---- player head owner: the name, the face once the lookup finds them, and what it found ----
  var headQ = { k: '', st: '' }, headT = 0;
  function drawOwner() {
    var e = it(), on = !!e && e.id === 'player_head';
    $('mobOwnerWrap').hidden = !on;
    if (!on) return;
    if ($('mobOwner').value !== e.owner) $('mobOwner').value = e.owner;
    var n = owner(e), k = n.toLowerCase();
    if (headQ.k !== k) {
      headQ = { k: k, st: n ? 'look' : '' };
      clearTimeout(headT);
      if (n) headT = setTimeout(function () { lookName(n, function (id) { if (headQ.k !== k) return; headQ.st = id ? 'ok' : id === null ? 'bad' : 'net'; drawOwner(); }); }, k in LOOKED ? 0 : 450);
    }
    var id = n && LOOKED[k], st = $('mobOwnerSt');
    $('mobOwnerHead').src = id ? 'https://mc-heads.net/avatar/' + id.replace(/-/g, '') + '/32' : '/minecrafticons/items/player_head.png';
    st.textContent = { look: 'Looking up ' + n + '…', ok: 'Found ' + n + '.', bad: 'No Java player has that name, so the head shows a default skin.',
      net: 'The name lookup didn\'t answer. The name still goes in the command.' }[headQ.st] || 'Blank gives a Steve head.';
    st.classList.toggle('is-bad', headQ.st === 'bad' || headQ.st === 'net');
  }

  // ---- the picked item's settings (Enchantments / Attributes / Options tabs) ----
  function shiny(e) { return !!e && (e.glint || Object.keys(e.ench).length > 0); }
  function fitsItem(en, id) { return id === 'enchanted_book' || en.on.indexOf(kindOf(id)) > -1; } // a book stores any of them
  function enchOk(en) { return en.v <= EV[s.ver]; }
  function itemAttrs() { return MCI.ATTRS.filter(function (a) { return s.ver > 0 || a[3] === 'o'; }); } // before 1.20.5: the old generic.* set
  function drawItem() {
    var e = it(), f = itemFrame();
    var list = MCI.ENCH.filter(function (en) { return enchOk(en) && (fitsItem(en, e.id) || e.ench[en.id]); });
    $('mobEnHint').textContent = list.length ? '' : 'Nothing enchants this item. The shine alone is in Options.';
    $('mobEnList').innerHTML = list.map(function (en) {
      var on = en.id in e.ench;
      return row('data-ench', en.id, en.name, '', on, on ? e.ench[en.id] : en.max, 'max ' + en.max);
    }).join('');
    $('mobItAtHint').textContent = (f ? 'Added to the stats of whoever holds or wears it.' : 'Added to the mob\'s own stats while it has this in its ' + slotName(s.slot).toLowerCase() + ' slot.') +
      (s.ver === 0 ? ' Before 1.20.5 only these exist.' : '');
    $('mobItAttrs').innerHTML = itemAttrs().map(function (a) {
      var on = a[0] in e.attrs;
      return row('data-iattr', a[0], a[1], '', on, on ? e.attrs[a[0]] : 1, '');
    }).join('');
    $('mobEnN').textContent = Object.keys(e.ench).length || '';
    $('mobItAtN').textContent = Object.keys(e.attrs).length || '';
    $('mobGlintWrap').hidden = list.length > 0;
    $('mobGlint').checked = e.glint;
    $('mobUnb').checked = e.unb;
    if ($('mobItName') !== document.activeElement) $('mobItName').value = e.name;
  }
  function tradeIcon(id) { return '/minecrafticons/items/' + id + '.png'; }
  function ab(id) { return id.split('_').slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase(); } // shown when there's no icon
  var ARROW = '<svg viewBox="0 0 10 9" aria-hidden="true"><path d="M0 3h6V0l4 4.5L6 9V6H0z"/></svg>';
  var SOLD = '<svg viewBox="0 0 9 9" aria-hidden="true"><path d="M0 1l1-1 3.5 3.5L8 0l1 1-3.5 3.5L9 8l-1 1-3.5-3.5L1 9 0 8l3.5-3.5z"/></svg>';
  function rulesSum(t) {
    var r = [];
    if (t.uses !== '') r.push(t.uses + (t.uses === 1 ? ' use' : ' uses'));
    if (!t.xp) r.push('no XP');
    if (t.pm !== '') r.push('price x' + t.pm);
    if (t.sp !== '') r.push((t.sp > 0 ? '+' : '') + t.sp + ' price');
    if (t.dem !== '') r.push('demand ' + t.dem);
    return r.join(' · ') || 'game defaults';
  }
  // A Gives item that is storage (chest, shulker box, bundle...) shows its slots under the trade (Oct 19). Each slot
  // opens in the editor dialog like any storage slot; the costs stay plain items.
  function tradeInv(t, i) {
    var n = invSize(t.sell.id);
    if (!n) return '';
    return '<div class="mt-l-row"><span class="mt-l" id="mobTInvL' + i + '">Inside the ' + esc(nice(t.sell.id)) + ': <b class="mt-pick-name">' + invUsed(t.sell, n) + '</b></span>' +
      '<button type="button" class="mt-link" data-tinvclear="' + i + '">Empty it</button></div>' +
      '<div class="mt-inv-grid" data-tinv="' + i + '" role="group" aria-labelledby="mobTInvL' + i + '" style="--cols:' + (INVCOLS[n] || 9) + '">' + invCells(t.sell, n) + '</div>';
  }
  function drawTrades() {
    var slot = function (t, i, k, label, ph) {
      var x = t[k];
      // the slot and the name both open the item dialog; the optional second cost can be cleared
      return '<div class="mt-tslot" data-k="' + k + '"><span class="mt-l">' + label + (k === 'buyB' && x.id ? ' <button type="button" class="mt-link mt-tclear" data-tclear="' + i + '">Clear</button>' : '') + '</span><div class="mt-tslot-in">' +
        '<span class="mt-well mt-twell" data-tpick="' + i + '" data-k="' + k + '">' + (x.id ? '<img src="' + tradeIcon(x.id) + '" alt="">' : '') + '<em aria-hidden="true">' + ab(x.id) + '</em>' +
        '<b class="mt-tc" aria-hidden="true">' + (x.n > 1 ? x.n : '') + '</b></span>' +
        '<button type="button" class="mt-in mt-tpick' + (x.id ? '' : ' is-blank') + '" data-tpick="' + i + '" data-k="' + k + '" aria-haspopup="dialog" aria-controls="mtItemDlg" aria-label="' + label + ': ' + (x.id ? nice(x.id) : 'nothing') + '. Pick an item">' + (x.id ? nice(x.id) : ph) + '</button>' +
        '<span class="mt-step"><button type="button" data-step="-1" aria-label="One fewer"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 12h12\"/></svg></button>' +
        '<input class="mt-in" type="number" min="1" max="99" step="1" inputmode="numeric" data-t="' + i + '" data-k="' + k + '" data-f="n" value="' + x.n + '" aria-label="' + label + ', how many">' +
        '<button type="button" data-step="1" aria-label="One more"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 12h12M12 6v12\"/></svg></button></span></div></div>';
    };
    var num = function (i, f, label, hint, v, ph) {
      return '<label class="mt-f"><span class="mt-l">' + label + ' <span class="mt-u">' + hint + '</span></span><input class="mt-in" type="number" step="any" data-t="' + i + '" data-f="' + f + '" value="' + v + '" placeholder="' + ph + '"></label>';
    };
    $('mobTrades').innerHTML = s.trades.map(function (t, i) {
      var custom = rulesSum(t) !== 'game defaults';
      return '<li class="mt-trade">' +
        '<div class="mt-trade-top"><b>Trade ' + (i + 1) + '</b><button type="button" class="mt-x" data-trdel="' + i + '" aria-label="Remove trade ' + (i + 1) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
        '<div class="mt-trade-row">' + slot(t, i, 'buy', 'Costs', 'Pick an item') + slot(t, i, 'buyB', 'And', 'optional') +
        '<span class="mt-tarrow' + (t.uses === 0 ? ' is-out' : '') + '" title="' + (t.uses === 0 ? 'Sold out (0 uses)' : '') + '">' + (t.uses === 0 ? SOLD : ARROW) + '</span>' +
        slot(t, i, 'sell', 'Gives', 'Pick an item') + '</div>' +
        '<div class="mt-f mt-tinv">' + tradeInv(t, i) + '</div>' +
        '<details class="mt-trules"' + (custom ? ' open' : '') + '><summary>Trade rules <span>' + rulesSum(t) + '</span></summary><div class="mt-grid3">' +
        num(i, 'uses', 'Max uses', 'then it locks', t.uses, '4') +
        num(i, 'pm', 'Price multiplier', 'demand on price', t.pm, '0') +
        num(i, 'sp', 'Special price', 'minus = cheaper', t.sp, '0') +
        num(i, 'dem', 'Demand', 'starting value', t.dem, '0') +
        '<label class="mt-tg"><input type="checkbox" data-t="' + i + '" data-f="xp"' + (t.xp ? ' checked' : '') + '><span class="mt-sw" aria-hidden="true"></span>Gives the player XP</label>' +
        '</div></details></li>';
    }).join('') || '<li class="mt-empty">No trades yet. Trades you add replace the ones the game would give.</li>';
  }
  // One trade's look after an edit, without a redraw (the field keeps focus).
  function tradeLook(li, t) {
    ['buy', 'buyB', 'sell'].forEach(function (k) {
      var w = li.querySelector('[data-k="' + k + '"] .mt-twell'), img = w.querySelector('img'), id = t[k].id;
      if (!id) { if (img) img.remove(); }
      else if (!img) w.insertAdjacentHTML('afterbegin', '<img src="' + tradeIcon(id) + '" alt="">');
      else if (img.getAttribute('src') !== tradeIcon(id)) { img.hidden = false; img.src = tradeIcon(id); }
      w.querySelector('em').textContent = ab(id);
      w.querySelector('.mt-tc').textContent = t[k].n > 1 ? t[k].n : '';
    });
    var inv = li.querySelector('.mt-tinv'), html = tradeInv(t, +li.querySelector('[data-t]').getAttribute('data-t'));
    if (inv.innerHTML !== html) inv.innerHTML = html; // only when the Gives item turns into storage or out of it
    var a = li.querySelector('.mt-tarrow');
    a.classList.toggle('is-out', t.uses === 0);
    a.title = t.uses === 0 ? 'Sold out (0 uses)' : '';
    a.innerHTML = t.uses === 0 ? SOLD : ARROW;
    li.querySelector('.mt-trules summary span').textContent = rulesSum(t);
  }
  // Effect particles, as the potion tool names them: normal, faint (ambient, like a beacon's) or none.
  var PARTS = [['', 'Normal'], ['amb', 'Faint'], ['hide', 'None']];
  function partsOf(f) { return f.hide ? 'hide' : f.amb ? 'amb' : ''; }
  // One effect: name and remove; level, how long (blank = forever), particles. Edited in place (no redraw).
  function drawFx() {
    $('mobFx').innerHTML = s.fx.map(function (f, i) {
      var fname = fxInfo(f.id)[1], id = 'mobFx' + i;
      var t = function (k, unit, word) {
        return '<label><input class="mt-in" type="number" min="0" step="any" inputmode="decimal" data-fx="' + i + '" data-k="' + k + '" value="' + (f[k] || '') + '" placeholder="' + (k === 'm' ? '∞' : '0') + '" aria-label="' + fname + ' lasts, ' + word + '"><span>' + unit + '</span></label>';
      };
      return '<li class="mt-li mt-fx" style="--fx:#' + (fxInfo(f.id)[2] || 'fff') + '">' +
        '<div class="mt-fx-top"><img src="/minecrafticons/effects/' + f.id + '.png" alt=""><b id="' + id + '">' + fname + '</b>' +
        '<button type="button" class="mt-x" data-fxdel="' + i + '" aria-label="Remove ' + fname + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
        '<div class="mt-fx-ctl">' +
        '<label class="mt-f mt-fx-lvl"><span class="mt-l">Level</span><input class="mt-in" type="number" min="1" max="255" inputmode="numeric" data-fx="' + i + '" data-k="lvl" value="' + f.lvl + '"></label>' +
        '<div class="mt-f mt-fx-dur"><span class="mt-l">Lasts <span class="mt-u">blank = forever</span></span><div class="mt-time">' + t('m', 'min', 'minutes') + t('sec', 'sec', 'seconds') + '</div></div>' +
        '<div class="mt-f mt-fx-parts"><span class="mt-l" id="' + id + 'p">Particles</span><div class="mt-seg" role="group" aria-labelledby="' + id + ' ' + id + 'p">' + PARTS.map(function (p) {
          return '<button type="button" data-fx="' + i + '" data-parts="' + p[0] + '" aria-pressed="' + (partsOf(f) === p[0]) + '">' + p[1] + '</button>';
        }).join('') + '</div></div>' +
        '</div></li>';
    }).join('') || '<li class="mt-empty">No effects yet. They last forever unless you give them a time.</li>';
    $('mobFxAdd').innerHTML = '<option value="">Add an effect…</option>' + FX.map(function (f) { return '<option value="' + f[0] + '">' + f[1] + '</option>'; }).join('');
  }
  function mobName(id) { var m = MOBS.filter(function (x) { return x.id === id; })[0]; return m ? m.name : id; }
  // what a rider has set, in a few words, under its name
  function riderSum(r) {
    var bits = [];
    if (r.name) bits.push('named ' + esc(r.name));
    if (r.opt.baby || r.opt.IsBaby) bits.push('baby');
    var g = Object.keys(r.eq).length, n = Object.keys(r.attr).length;
    if (g) bits.push(g + (g === 1 ? ' item' : ' items'));
    if (r.fx.length) bits.push(r.fx.length + (r.fx.length === 1 ? ' effect' : ' effects'));
    if (n) bits.push(n + (n === 1 ? ' stat' : ' stats'));
    return bits.join(' · ');
  }
  // The whole stack, top first: riders, the page's mob (marked, edited on the page itself), then its mounts.
  // A row's key is 'r:i' (top.riders[i]) or 'm:i' (top.mounts[i]).
  function drawRiders() {
    var R = top.riders, M = top.mounts;
    var row = function (r, key, where) {
      var rname = mobName(r.mob), sum = riderSum(r);
      return '<li class="mt-li mt-li--rider"><button type="button" class="mt-rider" data-redit="' + key + '"><img src="' + eggOf(r.mob) + '" alt="">' +
        '<span class="mt-rider-t"><b>' + rname + '</b><small>' + where + (sum ? ' · ' + sum : '') + '</small></span>' +
        '<span class="mt-rider-go">Edit<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></span></button>' +
        '<button type="button" class="mt-x" data-rdel="' + key + '" aria-label="Remove ' + rname + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>';
    };
    var html = R.map(function (r, i) { return row(r, 'r:' + i, 'on the ' + mobName(i ? R[i - 1].mob : top.mob)); }).reverse().join('');
    if (R.length || M.length) html += '<li class="mt-li mt-li--self"><img src="' + eggOf(top.mob) + '" alt=""><span class="mt-rider-t"><b>' + mobName(top.mob) + '</b><small>The mob you are making' + (M.length ? ', riding the ' + mobName(M[0].mob) : '') + '</small></span></li>';
    html += M.map(function (r, i) { return row(r, 'm:' + i, 'carries the ' + mobName(i ? M[i - 1].mob : top.mob)); }).join('');
    $('mobRiders').innerHTML = html || '<li class="mt-empty">Nothing on top or underneath. Put a mob above it to ride it, or below it to carry it. Edit gives each one its own settings.</li>';
  }
  function stackList(k) { return k === 'm' ? top.mounts : top.riders; }

  // ---- NBT ----
  function q(t) { return JSON.stringify(String(t)); }
  function owner(e) { return e.id === 'player_head' ? e.owner.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16) : ''; }
  // 1.20 - 1.20.4 the Trim tag, 1.20.5+ the minecraft:trim component; same compound inside
  function trim(e) { var t = TRIMMABLE.test(e.id) && e.trim && e.trim.split(':'); return t ? '{pattern:"minecraft:' + t[0] + '",material:"minecraft:' + t[1] + '"}' : ''; }
  function sq(t) { return "'" + t.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; } // an SNBT string in single quotes
  // where an item inside storage counts as worn, for its attribute modifiers
  function nestSlot(id) { var m = id.match(/_(helmet|chestplate|leggings|boots)$/); return m ? { helmet: 'head', chestplate: 'chest', leggings: 'legs', boots: 'feet' }[m[1]] : 'mainhand'; }
  // the set slots of an item's storage, within its size: [[slot number, item], ...]
  function invList(e) { var n = invSize(e.id); return n && e.inv ? e.inv.slice(0, n).map(function (x, i) { return x ? [i, x] : null; }).filter(Boolean) : []; }
  function fwEx(x) { return s.ver === 0 ? McFirework.exOld(x) : McFirework.exNew(x); }
  // A spawn egg's mob as NBT ({id:...,...}), or '' for a plain egg of its own mob. Written with s = that mob.
  function eggData(e) {
    if (!e.egg) return '';
    var d = as(e.egg, entity);
    return d || eggMob(e.id) !== e.egg.mob ? '{id:"minecraft:' + e.egg.mob + '"' + (d ? ',' + d : '') + '}' : '';
  }
  function itemNbt(e, slot) {
    var id = e.id, si = SLOTS.map(function (x) { return x[0]; }).indexOf(slot), book = id === 'enchanted_book';
    var name = e.name ? JSON.stringify({ text: e.name, italic: false }) : '', inv = invList(e), egg = eggData(e), fw = e.fw && isFw(id) ? e.fw : null;
    var ench = MCI.ENCH.filter(function (en) { return en.id in e.ench && enchOk(en); });
    var at = itemAttrs().filter(function (a) { return a[0] in e.attrs; });
    if (s.ver === 0) {
      var tag = [];
      if (ench.length) tag.push((book ? 'StoredEnchantments' : 'Enchantments') + ':[' + ench.map(function (en) { return '{id:"minecraft:' + (en.id === 'sweeping_edge' ? 'sweeping' : en.id) + '",lvl:' + e.ench[en.id] + 's}'; }).join(',') + ']');
      else if (e.glint) tag.push('Enchantments:[{}]');
      if (e.unb) tag.push('Unbreakable:1b');
      if (e.dye || name) tag.push('display:{' + [e.dye ? 'color:' + parseInt(e.dye, 16) : '', name ? 'Name:' + sq(name) : ''].filter(Boolean).join(',') + '}');
      if (fw) tag.push(id === 'firework_star' ? 'Explosion:' + fwEx(fw.ex[0]) : 'Fireworks:{Flight:' + fw.flight + 'b,Explosions:[' + fw.ex.map(fwEx).join(',') + ']}');
      if (inv.length) tag.push('BlockEntityTag:{Items:[' + inv.map(function (p) { return '{Slot:' + p[0] + 'b,' + itemNbt(p[1], nestSlot(p[1].id)).slice(1); }).join(',') + ']}');
      if (egg) tag.push('EntityTag:' + egg);
      if (owner(e)) tag.push('SkullOwner:"' + owner(e) + '"');
      if (trim(e)) tag.push('Trim:' + trim(e));
      // Old modifiers need a UUID; slot + row makes each one unique on this mob.
      if (at.length) tag.push('AttributeModifiers:[' + at.map(function (a, i) {
        return '{AttributeName:"generic.' + a[0] + '",Name:"parcore",Amount:' + e.attrs[a[0]] + 'd,Operation:0,UUID:[I;1347568210,' + si + ',' + i + ',1],Slot:"' + slot + '"}';
      }).join(',') + ']');
      return '{id:"minecraft:' + id + '",Count:' + (e.count || 1) + 'b' + (tag.length ? ',tag:{' + tag.join(',') + '}' : '') + '}';
    }
    var c = [];
    if (ench.length) {
      var map = '{' + ench.map(function (en) { return '"minecraft:' + en.id + '":' + e.ench[en.id]; }).join(',') + '}';
      c.push('"minecraft:' + (book ? 'stored_enchantments' : 'enchantments') + '":' + (s.ver === 3 ? map : '{levels:' + map + '}'));
    } else if (e.glint) c.push('"minecraft:enchantment_glint_override":true');
    if (e.unb) c.push('"minecraft:unbreakable":{}');
    // 1.21.5 made dyed_color a plain number; before that {rgb:...}
    if (e.dye) c.push('"minecraft:dyed_color":' + (s.ver === 3 ? parseInt(e.dye, 16) : '{rgb:' + parseInt(e.dye, 16) + '}'));
    if (owner(e)) c.push('"minecraft:profile":{name:"' + owner(e) + '"}');
    if (trim(e)) c.push('"minecraft:trim":' + trim(e));
    // 1.21.5 made custom_name a text component; before that it was JSON in a string
    if (name) c.push('"minecraft:custom_name":' + (s.ver === 3 ? '{text:' + q(e.name) + ',italic:false}' : sq(name)));
    if (fw) c.push(id === 'firework_star' ? '"minecraft:firework_explosion":' + fwEx(fw.ex[0]) : '"minecraft:fireworks":{flight_duration:' + fw.flight + ',explosions:[' + fw.ex.map(fwEx).join(',') + ']}');
    if (inv.length) c.push(/bundle$/.test(id) ? '"minecraft:bundle_contents":[' + inv.map(function (p) { return itemNbt(p[1], nestSlot(p[1].id)); }).join(',') + ']'
      : '"minecraft:container":[' + inv.map(function (p) { return '{slot:' + p[0] + ',item:' + itemNbt(p[1], nestSlot(p[1].id)) + '}'; }).join(',') + ']');
    if (egg) c.push('"minecraft:entity_data":' + egg);
    if (at.length) {
      // 1.20.5 - 1.21.1 still had the generic. / player. prefixes; 1.21.5 made the component a plain list.
      var mods = '[' + at.map(function (a) {
        var t = s.ver === 1 ? (a[3] === 'p' ? 'player.' : 'generic.') + a[0] : a[0];
        return '{type:"minecraft:' + t + '",amount:' + e.attrs[a[0]] + ',operation:"add_value",slot:"' + slot + '",id:"parcore:' + a[0] + '_' + slot + '"}';
      }).join(',') + ']';
      c.push('"minecraft:attribute_modifiers":' + (s.ver === 3 ? mods : '{modifiers:' + mods + '}'));
    }
    return '{id:"minecraft:' + id + '",count:' + (e.count || 1) + (c.length ? ',components:{' + c.join(',') + '}' : '') + '}';
  }
  // ---- trades (villager, wandering trader) ----
  var TRADER = /^(villager|wandering_trader)$/;
  function tradeId(v) { return String(v || '').toLowerCase().replace(/^minecraft:/, '').replace(/[^a-z0-9_.\/-]/g, '').slice(0, 60); }
  function tradeN(v) { return Math.min(99, Math.max(1, parseInt(v, 10) || 1)); }
  function newTrade() { return { buy: { id: 'emerald', n: 1 }, buyB: { id: '', n: 1 }, sell: { id: '', n: 1 }, uses: '', xp: true, pm: '', sp: '', dem: '' }; }
  function tradesOk() { return s.trades.filter(function (t) { return t.buy.id && t.sell.id; }); }
  function stack(x) { return '{id:"minecraft:' + x.id + '",' + (s.ver === 0 ? 'Count:' + x.n + 'b' : 'count:' + x.n) + '}'; }
  function recipe(t) {
    var r = ['buy:' + stack(t.buy)];
    if (t.buyB.id) r.push('buyB:' + stack(t.buyB));
    // a Gives item with storage is written as a full item (its slots inside); otherwise just id and count
    r.push('sell:' + (invList(t.sell).length ? itemNbt(Object.assign(gear(t.sell.id), { count: t.sell.n, inv: t.sell.inv }), 'mainhand') : stack(t.sell)));
    if (t.uses !== '') r.push('maxUses:' + t.uses);
    if (!t.xp) r.push('rewardExp:0b');
    if (t.pm !== '') r.push('priceMultiplier:' + t.pm + 'f');
    if (t.sp !== '') r.push('specialPrice:' + t.sp);
    if (t.dem !== '') r.push('demand:' + t.dem);
    return '{' + r.join(',') + '}';
  }
  // Above 1 the game "preserves" the item (DropChances.isPreserved): it drops on any death, undamaged. Up to 1 it
  // only drops when a player killed the mob.
  function dropOf(sl) { var e = s.eq[sl]; return !e ? null : e.always ? '2.0' : e.drop !== '' ? (e.drop / 100).toFixed(3).replace(/0+$/, '').replace(/\.$/, '.0') : null; }
  // The mob in s as NBT (no braces). The root mob adds its riders, each a full mob of its own.
  function entity() {
    var o = [];
    var m = mob();
    if (s.name) {
      var nameObj = { text: s.name }, fmt = NFMT.filter(function (k) { return s.nfmt[k]; });
      if (s.ncolor) nameObj.color = s.ncolor;
      fmt.forEach(function (k) { nameObj[k] = true; });
      o.push(s.ver === 3 ? 'CustomName:{text:' + q(s.name) + (s.ncolor ? ',color:' + q(s.ncolor) : '') + fmt.map(function (k) { return ',' + k + ':true'; }).join('') + '}' : "CustomName:'" + JSON.stringify(nameObj).replace(/'/g, "\\'") + "'");
      if (s.showName) o.push('CustomNameVisible:1b');
    }
    if (s.health !== '') o.push('Health:' + (+s.health) + 'f');
    FLAGS.forEach(function (f) { if (s.flags[f]) o.push(f + ':1b'); });
    if (s.fire) o.push('Fire:' + (s.fire * 20) + 's');
    var tags = s.tags.split(/[\s,]+/).filter(Boolean);
    if (tags.length) o.push('Tags:[' + tags.map(q).join(',') + ']');
    var offers = tradesOk();
    if (TRADER.test(s.mob) && offers.length) o.push('Offers:{Recipes:[' + offers.map(recipe).join(',') + ']}');
    // mob options
    var op = s.opt, vd = [];
    (OPTS[s.mob] || []).forEach(function (x) {
      var k = x[0], v = op[k];
      if (!okv(x[4] || 0)) return;
      if (x[2] === 'time') { var t = ticks(k); if (t != null) o.push(k + ':' + t); return; }
      if (x[2] === 'player') { if (s.owner.id) o.push(k === 'Trusted' ? 'Trusted:[' + uuidNbt(s.owner.id) + ']' : 'Owner:' + uuidNbt(s.owner.id)); return; }
      if (v === undefined && x[2] === 'bool' && x[3] === 1) return;
      if (v === undefined || v === '' || v === false && x[3] !== 1) return;
      if (/^(prof|vtype|vlevel|hcolor|hmark|babyLock|growMin|growSec|stewSec)$/.test(k)) return;
      if (k === 'baby') { o.push((/^(zombie|husk|drowned|zombified_piglin|piglin|zombie_villager)$/.test(s.mob) ? 'IsBaby:1b' : babyAge())); return; }
      if (k === 'waxed') { o.push('next_weather_age:-2L'); return; } // CopperGolem IGNORE_WEATHERING_TICK
      if (k === 'psize') { o.push((s.ver === 3 ? 'size:' : 'Size:') + Math.max(0, Math.min(64, Math.round(+v)))); return; }
      if (k === 'Peek') { o.push('Peek:' + Math.max(0, Math.min(100, Math.round(+v))) + 'b'); return; }
      if (k === 'carried') { o.push('carriedBlockState:{Name:"minecraft:' + v + '"}'); return; }
      if (k === 'stew') {
        var d = Math.max(1, Math.round((op.stewSec === undefined || op.stewSec === '' ? 8 : +op.stewSec) * 20));
        o.push(s.ver >= 1 ? 'stew_effects:[{id:"minecraft:' + v + '",duration:' + d + '}]' : 'EffectId:' + (FX.map(function (f) { return f[0]; }).indexOf(v) + 1) + 'b,EffectDuration:' + d);
        return;
      }
      if (x[2] === 'bool') o.push(k + ':' + (v ? '1b' : '0b'));
      else if (x[2] === 'int') o.push(k + ':' + (+v));
      else { var f = NBTFMT[k]; o.push(k + ':' + (f === 'id' ? '"minecraft:' + v + '"' : f === 'str' ? '"' + v + '"' : (+v) + (f === 'b' ? 'b' : ''))); }
    });
    if (op.prof || op.vtype || op.vlevel) vd.push(op.prof ? 'profession:"minecraft:' + op.prof + '"' : '', op.vtype ? 'type:"minecraft:' + op.vtype + '"' : '', op.vlevel ? 'level:' + op.vlevel : '');
    if (vd.length) o.push('VillagerData:{' + vd.filter(Boolean).join(',') + '}');
    if (op.hcolor || op.hmark) o.push('Variant:' + ((+op.hcolor || 0) + 256 * (+op.hmark || 0)));
    // attributes
    var at = mobAttrs().map(function (a) { return a[0]; }).filter(function (k) { return k in s.attr; }); // only what this version has
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
    // equipment: 1.21.5+ one equipment map (saddle and body included); before that the hand / armor lists,
    // and the saddle and body slot each had a field of their own
    var anyEq = SLOTS.some(function (sl) { return s.eq[sl[0]]; }), all = slotsOf(s.mob).filter(function (sl) { return s.eq[sl[0]]; });
    if (s.ver === 3 && all.length) {
      o.push('equipment:{' + all.map(function (sl) { return sl[0] + ':' + itemNbt(s.eq[sl[0]], sl[0]); }).join(',') + '}');
      var dc = all.filter(function (sl) { return dropOf(sl[0]) != null; });
      if (dc.length) o.push('drop_chances:{' + dc.map(function (sl) { return sl[0] + ':' + dropOf(sl[0]) + 'f'; }).join(',') + '}');
    }
    if (s.ver < 3) {
      if (s.eq.saddle && SADDLED.indexOf(' ' + s.mob + ' ') > -1) o.push(/^(pig|strider)$/.test(s.mob) ? 'Saddle:1b' : 'SaddleItem:' + itemNbt(s.eq.saddle, 'saddle'));
      if (s.eq.body && BODYNAME[s.mob]) {
        o.push((s.ver >= 1 ? 'body_armor_item:' : /llama$/.test(s.mob) ? 'DecorItem:' : 'ArmorItem:') + itemNbt(s.eq.body, 'body'));
        if (s.ver >= 1 && dropOf('body') != null) o.push('body_armor_drop_chance:' + dropOf('body') + 'f');
      }
    }
    if (anyEq && s.ver < 3) {
      var it = function (sl) { return s.eq[sl] ? itemNbt(s.eq[sl], sl) : '{}'; };
      o.push('HandItems:[' + it('mainhand') + ',' + it('offhand') + ']');
      o.push('ArmorItems:[' + it('feet') + ',' + it('legs') + ',' + it('chest') + ',' + it('head') + ']');
      var dch = ['mainhand', 'offhand'].map(dropOf), dca = ['feet', 'legs', 'chest', 'head'].map(dropOf);
      if (dch.some(function (x) { return x != null; })) o.push('HandDropChances:[' + dch.map(function (x) { return (x == null ? '0.085' : x) + 'f'; }).join(',') + ']');
      if (dca.some(function (x) { return x != null; })) o.push('ArmorDropChances:[' + dca.map(function (x) { return (x == null ? '0.085' : x) + 'f'; }).join(',') + ']');
    }
    // effects: forever (-1; the old format's longest time) unless a time is set
    if (s.fx.length) {
      var dur = function (f) { var t = fxTicks(f); return t != null ? t : s.ver === 0 ? 2147483647 : -1; };
      o.push('active_effects:[' + s.fx.map(function (f) { return '{id:"minecraft:' + f.id + '",amplifier:' + (f.lvl - 1) + 'b,duration:' + dur(f) + (f.amb && !f.hide ? ',ambient:1b' : '') + (f.hide ? ',show_particles:0b' : '') + '}'; }).join(',') + ']');
      if (s.ver === 0) o.push('ActiveEffects:[' + s.fx.map(function (f) { return '{Id:' + (FX.map(function (x) { return x[0]; }).indexOf(f.id) + 1) + ',Amplifier:' + (f.lvl - 1) + 'b,Duration:' + dur(f) + (f.amb && !f.hide ? ',Ambient:1b' : '') + (f.hide ? ',ShowParticles:0b' : '') + '}'; }).join(',') + ']');
    }
    // death loot, air, freezing, facing and a push
    if (s.loot) o.push('DeathLootTable:"' + (s.loot.indexOf(':') < 0 ? 'minecraft:' : '') + s.loot + '"');
    var x = s.x || {}, has = function (v) { return v !== undefined && v !== ''; }, n = function (v) { return +v || 0; };
    if (has(x.air)) o.push('Air:' + Math.max(-20, Math.min(32767, Math.round(n(x.air)))) + 's');
    if (has(x.frozen)) o.push('TicksFrozen:' + Math.max(0, Math.round(n(x.frozen))));
    if (has(x.yaw) || has(x.pitch)) o.push('Rotation:[' + n(x.yaw) + 'f,' + Math.max(-90, Math.min(90, n(x.pitch))) + 'f]');
    if (has(x.mx) || has(x.my) || has(x.mz)) o.push('Motion:[' + n(x.mx) + 'd,' + n(x.my) + 'd,' + n(x.mz) + 'd]');
    // passengers: each one rides the one below, and each is a whole mob with its own settings
    if (s === top && s.riders.length) {
      var nest = '';
      for (var i = s.riders.length - 1; i >= 0; i--) nest = as(s.riders[i], function () { var d = entity(); return '{id:"minecraft:' + s.mob + '"' + (d ? ',' + d : '') + (nest ? ',Passengers:[' + nest + ']' : '') + '}'; });
      o.push('Passengers:[' + nest + ']');
    }
    return o.join(',');
  }
  function command() { return as(top, command0); }
  function command0() {
    var data = entity(), id = 'minecraft:' + s.mob, base = s.mob;
    // Mounts: the page's mob rides mounts[0], which rides mounts[1]... The bottom one is what gets summoned,
    // with the rest inside it as Passengers.
    top.mounts.forEach(function (m) {
      var inner = '{id:"' + id + '"' + (data ? ',' + data : '') + '}';
      as(m, function () { var d = entity(); data = (d ? d + ',' : '') + 'Passengers:[' + inner + ']'; id = 'minecraft:' + s.mob; base = s.mob; });
    });
    if (s.out === 'bedrock') return '/summon ' + s.mob + (s.name ? ' ' + q(s.name) : '') + ' ~ ~ ~';
    if (s.out === 'summon') return '/summon ' + id + ' ~ ~ ~' + (data ? ' {' + data + '}' : '');
    if (s.out === 'egg') {
      var bm = MOBS.filter(function (m) { return m.id === base; })[0] || {};
      var egg = base === 'armor_stand' ? 'armor_stand' : bm.egg ? base + '_spawn_egg' : 'zombie_spawn_egg';
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
  // Every mob is drawn in 3D by mc-mob3d.js (window.MobView) from mc-mob3d.json, wearing and holding
  // its gear. The egg card only comes back if WebGL is unavailable (.no-3d on the stage).
  var mounted = false, jebT = 0;
  // What the 3D view needs from the mob in s (mc-mob3d.js show()).
  function spec3d() {
    var o = s.opt, eq = {}, grow = 1;
    slotsOf(s.mob).forEach(function (sl) { var e = s.eq[sl[0]]; if (e && !isDropOf(sl[0], s.mob)) eq[sl[0]] = { id: e.id, owner: owner(e), dye: e.dye, trim: TRIMMABLE.test(e.id) ? e.trim : '' }; });
    // drawn size: slimes and cubes by Size (0 = the smallest), phantoms 1 + 0.15 x size, salmon by type
    if (/^(slime|magma_cube|sulfur_cube)$/.test(s.mob) && o.Size !== undefined && o.Size !== '') grow = Math.max(1, Math.min(16, Math.round(+o.Size) + 1));
    if (s.mob === 'phantom' && o.psize) grow = 1 + 0.15 * Math.max(0, Math.min(64, +o.psize));
    if (s.mob === 'salmon' && o.type) grow = { small: 0.5, medium: 1, large: 1.5 }[o.type];
    return {
      mob: s.mob, baby: !!(o.IsBaby || o.baby), skin: mobSkin(), eq: eq, scale: s.ver >= 1 && s.attr.scale != null ? +s.attr.scale : 1,
      look: s.mob === 'pufferfish' ? o.PuffState : s.mob === 'zombie_nautilus' ? o.variant || 'temperate' : o.variant,
      pumpkin: s.mob === 'snow_golem' && o.Pumpkin !== false, chest: !!o.ChestedHorse, grow: grow,
      flip: s.name === 'Dinnerbone' || s.name === 'Grumm', peek: Math.max(0, Math.min(100, +o.Peek || 0)) / 100, face: +o.AttachFace || 0,
      // the swirls its effects give off: every effect with particles on, in its own colour
      fx: s.fx.filter(function (f) { return !f.hide; }).map(function (f) { return { c: fxInfo(f.id)[2] || 'ffffff', faint: !!f.amb }; }),
      invisible: s.fx.some(function (f) { return f.id === 'invisibility'; }),
      glide: !!s.flags.FallFlying, left: !!s.flags.LeftHanded
    };
  }
  function paint3d() {
    if (!window.MobView) return;
    if (!mounted) { mounted = true; MobView.mount($('mob3d')); }
    // the whole stack bottom first: the lowest mount is the base, everything above rides it
    var all = top.mounts.slice().reverse().concat([top], top.riders), list = all.map(function (m) { return as(m, spec3d); });
    var o = list[0];
    o.riders = list.slice(1);
    MobView.show(o);
    // a sheep named jeb_ keeps changing colour: redraw while one is in the stack
    clearTimeout(jebT);
    if (all.some(function (m) { return m.mob === 'sheep' && m.name === 'jeb_'; })) jebT = setTimeout(paint3d, 250);
  }
  // ---- villager skins: the layers in the game's order (VillagerProfessionLayer) ----
  // body, biome clothes (unless the job's hat covers them), job clothes, level badge. Babies have no job.
  // Hats from the 26.3 .png.mcmeta files: "full" hides the biome hat, "partial" only hides a partial one.
  var VHAT = { butcher: 'partial', farmer: 'full', fisherman: 'full', fletcher: 'full', librarian: 'full', shepherd: 'full', desert: 'full', snow: 'full' };
  var BADGE = ['stone', 'iron', 'gold', 'emerald', 'diamond'];
  function villagerSkin() {
    if (!/^(villager|zombie_villager)$/.test(s.mob)) return null;
    var dir = '/minecrafticons/mobs3d/' + s.mob + '/', baby = !!(s.opt.baby || s.opt.IsBaby);
    var type = s.opt.vtype || 'plains', job = baby ? 'none' : s.opt.prof || 'none', jh = VHAT[job];
    var L = [dir + s.mob + (baby ? '_baby' : '') + '.png'];
    // The biome clothes always draw; a job hat only hides the biome's hat (the game hides that bone for this layer).
    L.push(dir + (baby ? 'baby/' : 'type/') + type + '.png' + (!jh || jh === 'partial' && VHAT[type] !== 'full' ? '' : '#nohat'));
    if (job !== 'none') {
      L.push(dir + 'profession/' + job + '.png');
      if (job !== 'nitwit') L.push(dir + 'profession_level/' + BADGE[(+s.opt.vlevel || 1) - 1] + '.png');
    }
    return L;
  }
  // ---- every other picked look: the game's texture for it (_tools/mobs3d/skins.py copies them) ----
  // null = the mob's own texture (the default look). Collars and wool are white in the game files and
  // tinted by the dye's colour (DyeColor's texture colours, same order as DYE).
  var DYEHEX = ['f9fffe', 'f9801d', 'c74ebd', '3ab3da', 'fed83d', '80c71f', 'f38baa', '474f52', '9d9d97', '169c9c', '8932b8', '3c44aa', '835432', '5e7c16', 'b02e26', '1d1d21'];
  var AXO = ['lucy', 'wild', 'gold', 'cyan', 'blue'], PARROT = ['red_blue', 'blue', 'green', 'yellow_blue', 'grey'];
  var RABBIT = { 0: 'brown', 1: 'white', 2: 'black', 3: 'white_splotched', 4: 'gold', 5: 'salt', 99: 'caerbannog' };
  var HORSE = ['white', 'creamy', 'chestnut', 'brown', 'black', 'gray', 'darkbrown'], MARK = ['', 'white', 'whitefield', 'whitedots', 'blackdots'];
  var LLAMA = ['creamy', 'white', 'brown', 'gray'];
  // Weak and brown are recessive: they only show when the hidden gene is the same (Panda.getVariant).
  function pandaLook() { var g = s.opt.MainGene; return (g === 'weak' || g === 'brown') && s.opt.HiddenGene !== g ? 'normal' : g; }
  function mobSkin() {
    var o = s.opt, m = s.mob, v = o.variant, B = o.baby || o.IsBaby ? '_baby' : '', d = '/minecrafticons/mobs3d/' + m + '/';
    var col = o.CollarColor ? '#' + DYEHEX[o.CollarColor] : '', pick = function (f) { return [d + f + B + '.png']; };
    if (/^(villager|zombie_villager)$/.test(m)) return villagerSkin();
    if (m === 'cat' && (v || col)) return pick('cat_' + (v || 'tabby')).concat(col ? [d + 'cat_collar' + B + '.png' + col] : []);
    // wolf: tame (a player or a collar) wears the tame face, else angry the angry one (Wolf.getTexture)
    var tame = !!(s.owner.id || col), mad = (ticks('AngerTime') || 0) > 0;
    if (m === 'wolf' && (v || col || tame || mad)) return pick('wolf' + (v && v !== 'pale' ? '_' + v : '') + (tame ? '_tame' : mad ? '_angry' : '')).concat(col ? [d + 'wolf_collar' + B + '.png' + col] : []);
    if (m === 'bee' && (mad || o.HasNectar)) return pick('bee' + (mad ? '_angry' : '') + (o.HasNectar ? '_nectar' : ''));
    if (m === 'copper_golem' && o.weather_state && o.weather_state !== 'unaffected') return [d + o.weather_state + '.png', d + 'eyes_' + o.weather_state + '.png'];
    if (m === 'zombie_nautilus') return [d + (o.variant === 'warm' ? 'coral' : 'plain') + '.png']; // temperate unless warm (by biome in game)
    // the adult temperate cow / pig / chicken is the mob's own texture
    if (/^(pig|cow|chicken)$/.test(m) && v && (v !== 'temperate' || B)) return pick(m + '_' + v);
    if (m === 'frog' && v) return pick('frog_' + v);
    if (m === 'axolotl' && o.Variant) return pick('axolotl_' + AXO[o.Variant]);
    if (m === 'parrot' && o.Variant) return pick('parrot_' + PARROT[o.Variant]);
    if (m === 'rabbit' && (o.RabbitType || s.name === 'Toast')) return pick('rabbit_' + (s.name === 'Toast' ? 'toast' : RABBIT[o.RabbitType])); // the "Toast" name tag skin
    if (m === 'horse' && (o.hcolor || +o.hmark)) return pick('horse_' + HORSE[+o.hcolor || 0]).concat(+o.hmark ? pick('horse_markings_' + MARK[o.hmark]) : []);
    if (/llama$/.test(m) && o.Variant) return ['/minecrafticons/mobs3d/llama/llama_' + LLAMA[o.Variant] + B + '.png'];
    if (m === 'fox' && o.Type === 'snow') return pick('fox_snow');
    if (m === 'mooshroom' && o.Type === 'brown') return ['/minecrafticons/mobs3d/cow/mooshroom_brown' + B + '.png'];
    if (m === 'panda' && o.MainGene && pandaLook() !== 'normal') return [d + (B ? pandaLook() + '_panda_baby' : 'panda_' + pandaLook()) + '.png'];
    if (m === 'shulker' && o.Color) return [d + 'shulker_' + DYE[o.Color] + '.png'];
    // The wool is its own layer, white unless dyed, over the bare sheep. The baby uses Java's sheets: the
    // Bedrock baby texture has no face or hooves (_tools/mobs3d/skins.py).
    if (m === 'sheep') return [d + 'skin' + B + '.png'].concat(o.Sheared ? [] : [d + 'wool' + B + '.png#' + (s.name === 'jeb_' ? rainbow() : DYEHEX[o.Color || 0])]);
    return null;
  }
  // jeb_: the wool runs through the 16 dye colours, 25 ticks each, blending into the next (SheepRenderer).
  // Five blend steps per colour keep the number of textures it makes small.
  function rainbow() {
    var t = performance.now() / 50, i = Math.floor(t / 25), f = Math.round((t % 25) / 25 * 5) / 5, a = DYEHEX[i % 16], b = DYEHEX[(i + 1) % 16];
    return [0, 2, 4].map(function (k) { var x = parseInt(a.substr(k, 2), 16), y = parseInt(b.substr(k, 2), 16); return ('0' + Math.round(x + (y - x) * f).toString(16)).slice(-2); }).join('');
  }
  // A HUD row the way the game draws it: one icon per 2 points, ten to a row, the rest as "+n".
  function pips(src, points) {
    var n = Math.ceil(points / 2), full = Math.min(n, 10);
    return new Array(full + 1).join('<img src="' + src + '" alt="">') + (n > full ? '<b>+' + (n - full) + '</b>' : '');
  }
  function hx(n) { var h = Math.round(n / 2 * 100) / 100; return h + (h === 1 ? ' heart' : ' hearts'); } // half hearts -> "1.5 hearts"
  function preview() {
    var m = mob(), d = m.d, hp = s.attr.max_health || d.max_health || 20, ar = s.attr.armor || d.armor || 0;
    var atk = s.attr.attack_damage || d.attack_damage, tag = $('mobCardName');
    $('mobEgg').src = eggOf(s.mob);
    $('mobStage').setAttribute('data-hab', habitat(m));
    // The name tag floats over the mob like in game; faint when it only shows while you look at the mob.
    tag.hidden = !s.name;
    tag.classList.toggle('is-faint', !s.showName);
    nameTag(tag);
    $('mobCardType').textContent = m.name + (m.since ? ' · ' + m.since + '+' : '');
    $('mobHearts').innerHTML = pips('/minecrafticons/gui/heart_full.png', hp);
    $('mobArmor').innerHTML = ar ? pips('/minecrafticons/gui/armor_full.png', ar) : '';
    var stat = function (k, label, v, sub) { return '<div class="mt-st mt-st--' + k + '"><dt>' + label + '</dt><dd>' + v + (sub ? ' <small>' + sub + '</small>' : '') + '</dd></div>'; };
    $('mobStats').innerHTML = stat('hp', 'Health', hp, hx(hp)) +
      (atk != null ? stat('atk', 'Attack', atk, hx(atk) + ' a hit') : '') +
      stat('spd', 'Speed', s.attr.movement_speed || d.movement_speed, '') +
      (ar ? stat('arm', 'Armor', ar, 'points') : '');
    paint3d();
  }
  // Where a mob lives, for the preview's backdrop (/minecrafticons/tools/stage-<habitat>.webp):
  // hostile + bosses a cave, animals the overworld, water mobs underwater, the "other" group a village.
  // Nether and End mobs (wherever their group puts them) the Nether; ocean hostiles underwater.
  var NETHER = /^(blaze|ghast|magma_cube|piglin|piglin_brute|hoglin|zoglin|zombified_piglin|wither_skeleton|strider|enderman|endermite|shulker|ender_dragon|wither)$/;
  var OCEAN = /^(guardian|elder_guardian|drowned|zombie_nautilus)$/;
  function habitat(m) {
    if (NETHER.test(m.id)) return 'nether';
    if (OCEAN.test(m.id)) return 'water';
    return { animal: 'overworld', water: 'water', other: 'village' }[m.g] || 'cave';
  }
  // The name tag in the game's own font (mc-font.js), on the game's see-through plate. 2x when it fits.
  var obfTimer = 0;
  function nameTag(tag) {
    var hex = s.ncolor ? McFontColor(s.ncolor) : 'ffffff', name = s.name;
    clearInterval(obfTimer);
    if (window.McFont && s.nfmt.obfuscated && name) obfTimer = setInterval(function () { if (name === s.name) draw(); }, 90);
    if (!window.McFont) { tag.textContent = name; tag.style.color = '#' + hex; return; }
    McFont.load(draw);
    function draw() {
      if (name !== s.name) return; // typed again while the font loaded
      var runs = [{ text: name, color: hex }], w;
      NFMT.forEach(function (k) { if (s.nfmt[k]) runs[0][k] = true; });
      w = McFont.width(runs) + (s.nfmt.italic ? 1 : 0);
      var sc = w * 2 + 16 <= tag.parentNode.clientWidth - 32 ? 2 : 1;
      var c = document.createElement('canvas');
      c.width = (w + 1) * sc;
      c.height = 8 * sc;
      c.setAttribute('aria-hidden', 'true');
      McFont.draw(c.getContext('2d'), runs, sc, 0, { scale: sc, shadow: false });
      tag.replaceChildren(c);
    }
  }
  // The name field shows the name in its own colour and style, like the tag will.
  function nameField() {
    var n = $('mobName'), f = s.nfmt;
    n.style.color = s.ncolor ? '#' + McFontColor(s.ncolor) : '';
    n.style.fontWeight = f.bold ? '800' : '';
    n.style.fontStyle = f.italic ? 'italic' : '';
    n.style.textDecoration = [f.underlined ? 'underline' : '', f.strikethrough ? 'line-through' : ''].join(' ').trim();
    n.classList.toggle('is-dark', /^(black|dark_blue|dark_gray|dark_purple)$/.test(s.ncolor)); // keeps dark colours readable on the black field
    $('mobNameFmt').querySelectorAll('[data-fmt]').forEach(function (b) { b.setAttribute('aria-pressed', String(!!f[b.getAttribute('data-fmt')])); });
  }
  function McFontColor(n) { return { black: '000000', dark_blue: '0000aa', dark_green: '00aa00', dark_aqua: '00aaaa', dark_red: 'aa0000', dark_purple: 'aa00aa', gold: 'ffaa00', gray: 'aaaaaa', dark_gray: '555555', blue: '5555ff', green: '55ff55', aqua: '55ffff', red: 'ff5555', light_purple: 'ff55ff', yellow: 'ffff55', white: 'ffffff' }[n] || 'ffffff'; }

  // Command colouring: strings, minecraft: ids, the command word, NBT keys, numbers. Escaped first.
  var TOK = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(minecraft:[\w.\/]+)|(^\/\w+)|([A-Za-z_][\w.]*)(?=:)|((?<![\w.])-?\d+(?:\.\d+)?[bsfdL]?(?![\w]))/g;
  function esc(x) { return x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function hl(x) {
    var html = '', last = 0;
    x.replace(TOK, function (m, str, id, cmd, key, num, off) {
      html += esc(x.slice(last, off)) + '<span class="hl-' + (str ? 's' : id ? 'i' : cmd ? 'c' : key ? 'k' : 'n') + '">' + esc(m) + '</span>';
      last = off + m.length;
      return m;
    });
    return html + esc(x.slice(last));
  }

  // The picked mob in the picker's header (all designs).
  function current() {
    var m = mob(), g = GROUPS.filter(function (x) { return x[0] === m.g; })[0];
    $('mtPickEgg').src = eggOf(m.id);
    $('mtPickCur').innerHTML = '<b>' + m.name + '</b><span>' + (g ? g[1] : '') + '</span>';
  }

  // ---- Mob picker: "Change mob" opens a modal dialog; picking a mob changes it and closes the dialog. ----
  var dlg = $('mtPickDlg');
  // title: what the pick is for ("Put a mob on top"); none = changing this page's mob
  function openPicker(title) {
    $('mtPickDlgH').textContent = typeof title === 'string' ? title : 'Pick a mob';
    s.q = '';
    $('mobFind').value = '';
    drawList();
    dlg.showModal();
    var cur = root.querySelector('[aria-pressed="true"]') || root.querySelector('[data-mob]');
    if (cur) { cur.focus(); cur.scrollIntoView({ block: 'center' }); }
  }

  function render() {
    var out = command(), code = $('mobCmd');
    if (frames.length) frameHead();
    as(top, current);
    code.innerHTML = hl(out);
    $('mtCodeMore').hidden = !code.classList.contains('is-open') && code.scrollHeight <= code.clientHeight + 2;
    $('mobCopy').setAttribute('data-copy', out);
    var qc = $('mobQCopy'); if (qc) qc.setAttribute('data-copy', out);
    $('mobMeta').innerHTML = out.length + ' characters' + (out.length > 32500 ? ' <em class="is-bad">Too long</em>' : out.length > 256 ? ' <em>Command block only</em>' : '');
    // Tab badges: how much is set on each tab, and the picked mob's egg on the Mob tab.
    badge('mtNSt', mobAttrs().filter(function (a) { return a[0] in s.attr; }).length);
    badge('mtNGr', slotsOf(s.mob).filter(function (sl) { return s.eq[sl[0]]; }).length);
    badge('mtNFx', s.fx.length + (s === top ? top.riders.length + top.mounts.length : 0)); // a rider's dialog has no stack
    var trader = TRADER.test(s.mob);
    $('mtTabTr').hidden = !trader;
    if (!trader && $('mtTabTr').classList.contains('is-on')) $('mtTabDet').click();
    badge('mtNTr', trader ? tradesOk().length : 0);
    $('mobSpawner').hidden = s.out !== 'spawner';
    $('mobVer').hidden = s.out === 'bedrock';
    var notes = as(top, function () {
    var notes = [];
    if (s.out !== 'bedrock' && out.length > 256) notes.push('Chat takes 256 characters at most, so paste this into a command block.');
    if (s.out === 'bedrock') notes.push('Bedrock /summon can only set the mob and its name. Everything else on this page is Java only.');
    if (s.out === 'spawner' && s.ver === 0) notes.push('This spawner format is for 1.18 and newer. 1.16 and 1.17 used SpawnData:{id:...} without "entity".');
    if (!s.flags.PersistenceRequired && mob().g === 'hostile') notes.push('Hostile mobs despawn when you walk away. Tick "Never despawns" to keep it.');
    if (s.attr.max_health && s.health === '') notes.push('Health is set to the new max health too, or the mob would spawn with its old health.');
    if (SLOTS.some(function (sl) { return s.eq[sl[0]]; }) && !HUMAN[s.mob] && !/piglin|vindicator|pillager|evoker|illusioner|vex|allay|fox|armor_stand|witch|wandering_trader|villager|zombie_villager|giant/.test(s.mob)) notes.push('Most animals don\'t show armor or held items, but they still drop them.');
    // attribute_modifiers replaces an item's built-in ones (1.20.5+): a sword given only +health hits for nothing extra
    if (s.ver > 0 && SLOTS.some(function (sl) { var e = s.eq[sl[0]]; return e && Object.keys(e.attrs).length && /_(sword|axe|helmet|chestplate|leggings|boots)$|^(trident|mace|turtle_helmet)$/.test(e.id); })) notes.push('Gear attributes replace the armor or attack values that item has by default. Add Armor or Attack Damage back on it if you need them.');
    if (TRADER.test(s.mob) && s.trades.length > tradesOk().length) notes.push('A trade needs a cost and an item it sells. Unfinished trades are left out of the command.');
    if (s.mob === 'villager' && tradesOk().length && s.opt.vlevel !== '5') notes.push('Set Level to Master on Details, or trading levels the villager up and adds random trades to yours.');
    if (s.mob === 'villager' && tradesOk().length && (s.opt.prof === 'nitwit' || s.opt.baby)) notes.push('Nitwits and baby villagers never open the trade screen.');
    if (s.opt.baby && s.opt.babyLock && OPTS[s.mob] && OPTS[s.mob].indexOf(BABY[1]) > -1) notes.push(s.ver === 3 ? 'Stays a baby uses the golden dandelion lock (AgeLocked). Versions before the golden dandelion ignore it, and the baby grows up after 20 minutes.' : 'This version has no golden dandelion lock, so the baby gets the longest grow-up time there is: about 3.4 years of being loaded.');
    if (/^(cat|wolf)$/.test(s.mob) && s.opt.CollarColor && !s.owner.id) notes.push('The collar only shows on a tamed ' + s.mob + '. Put a player under Tamed by.');
    if ((s.opt.baby || s.opt.IsBaby) && (s.eq.saddle || s.eq.body)) notes.push('Babies don\'t show or use a saddle or body armor.');
    if (s.mob === 'mooshroom' && s.opt.stew && s.opt.Type !== 'brown') notes.push('Only brown mooshrooms give suspicious stew. Set Colour to brown.');
    if ((top.riders.length || top.mounts.length) && s.out === 'bedrock') notes.push('Riders and mounts are left out of the Bedrock command.');
    if (s.mob === 'panda' && s.opt.MainGene && pandaLook() !== s.opt.MainGene) notes.push('A ' + s.opt.MainGene + ' panda only looks ' + s.opt.MainGene + ' when its hidden gene is ' + s.opt.MainGene + ' too.');
    if (s.out !== 'bedrock' && s.ver === 0 && SLOTS.some(function (sl) { var e = s.eq[sl[0]]; return e && trim(e); })) notes.push('Armor trims need 1.20 or newer. 1.16 to 1.19 ignore them.');
    var worn = slotsOf(s.mob).map(function (sl) { return s.eq[sl[0]]; }).filter(Boolean);
    if (worn.some(function (e) { return !e.always && +e.drop === 100; })) notes.push('At 100% an item only drops when a player kills the mob. Tick Always drops for any death.');
    if (s.ver < 3 && (s.eq.body && !BODYNAME[s.mob] || s.eq.saddle && SADDLED.indexOf(' ' + s.mob + ' ') < 0)) notes.push('Drop slots need 1.21.5 or newer, so those drops are left out.');
    if (RANDOM_STATS[s.mob]) notes.push('Horses and llamas roll their own health, speed and jump when they spawn, so the defaults shown are only the starting values.');
    return notes;
    });
    steps();
    ddAll();
    document.querySelectorAll('.mt-dd').forEach(ddSync);
    $('mobNotes').innerHTML = notes.map(function (n) { return '<li>' + n + '</li>'; }).join('');
    preview();
  }

  // ---- dropdowns (Oct 18) ----
  // Every select.mt-in gets a drawn list: icon + name per row. The <select> stays inside, hidden, as the
  // value holder, so all the code that fills, reads, sets and listens to it is unchanged; choosing a row
  // sets it and fires its input + change events like a real pick.
  var JOB = { armorer: 'blast_furnace', butcher: 'smoker', cartographer: 'cartography_table', cleric: 'brewing_stand', farmer: 'composter',
    fisherman: 'barrel', fletcher: 'fletching_table', leatherworker: 'cauldron', librarian: 'lectern', mason: 'stonecutter', shepherd: 'loom',
    toolsmith: 'smithing_table', weaponsmith: 'grindstone' }; // each job's workstation
  var BIOME_ICON = { plains: 'grass_block', desert: 'sand', jungle: 'jungle_log', savanna: 'acacia_log', snow: 'snow_block', swamp: 'lily_pad', taiga: 'spruce_log' };
  var LVL_ICON = ['stone', 'iron_ingot', 'gold_ingot', 'emerald', 'diamond']; // the badge's material
  function optIcon(sel, v) {
    var k = sel.getAttribute('data-opt'), it = function (id) { return id ? '/minecrafticons/items/' + id + '.png' : ''; };
    if (!v) return '';
    if (sel.id === 'mobFxAdd') return '/minecrafticons/effects/' + v + '.png';
    if (k === 'prof') return it(JOB[v]);
    if (k === 'vtype') return it(BIOME_ICON[v]);
    if (k === 'vlevel') return it(LVL_ICON[v - 1]);
    if (/^(Color|CollarColor)$/.test(k)) return it(DYE[v] && DYE[v] + '_dye');
    return '';
  }
  var ddN = 0, ddOpen = null;
  function ddAll() {
    document.querySelectorAll('.mt-wrap select.mt-in:not([data-dd])').forEach(function (sel) {
      sel.setAttribute('data-dd', '');
      var w = document.createElement('div'), id = 'mtdd' + (++ddN), f = sel.closest('.mt-f, .mt-ver-pick');
      w.className = 'mt-dd';
      w.innerHTML = '<button type="button" class="mt-dd-btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + id + '">' +
        '<span class="mt-dd-ico"></span><span class="mt-dd-v"></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button><ul class="mt-pop" role="listbox" id="' + id + '" tabindex="-1" hidden></ul>';
      sel.parentNode.insertBefore(w, sel);
      w.appendChild(sel);
      sel.tabIndex = -1;
      sel.setAttribute('aria-hidden', 'true');
      w._label = sel.getAttribute('aria-label') || (f && f.querySelector('.mt-l') ? f.querySelector('.mt-l').textContent : '');
      ddSync(w);
    });
  }
  function ddSync(w) {
    var sel = w.querySelector('select'), o = sel.options[sel.selectedIndex], ic = optIcon(sel, sel.value), txt = o ? o.text : '';
    w.querySelector('.mt-dd-v').textContent = txt;
    w.querySelector('.mt-dd-ico').innerHTML = ic ? '<img src="' + ic + '" alt="">' : '';
    w.classList.toggle('is-blank', !sel.value);
    w.querySelector('.mt-dd-btn').setAttribute('aria-label', txt.indexOf(w._label.replace(/…$/, '')) === 0 ? txt : w._label + ': ' + txt);
  }
  function ddShow(w) {
    ddHide();
    var sel = w.querySelector('select'), list = w.querySelector('.mt-pop');
    list.innerHTML = Array.prototype.map.call(sel.options, function (o, i) {
      var ic = optIcon(sel, o.value);
      return '<li class="mt-opt' + (o.value ? '' : ' is-blank') + '" role="option" id="' + list.id + '-' + i + '" data-i="' + i + '" aria-selected="' + (i === sel.selectedIndex) + '">' +
        (ic ? '<img src="' + ic + '" alt="">' : '<i></i>') + '<span>' + esc(o.text) + '</span></li>';
    }).join('');
    list.hidden = false;
    w.classList.add('is-open');
    w.querySelector('.mt-dd-btn').setAttribute('aria-expanded', 'true');
    var r = w.getBoundingClientRect(), below = innerHeight - r.bottom;
    w.classList.toggle('is-up', below < Math.min(300, list.scrollHeight) + 16 && r.top > below); // opens upward near the bottom
    ddOpen = w;
    ddActive(w, Math.max(0, sel.selectedIndex));
    list.focus({ preventScroll: true });
  }
  function ddHide(back) {
    if (!ddOpen) return;
    var w = ddOpen;
    ddOpen = null;
    w.classList.remove('is-open');
    w.querySelector('.mt-pop').hidden = true;
    w.querySelector('.mt-dd-btn').setAttribute('aria-expanded', 'false');
    if (back) w.querySelector('.mt-dd-btn').focus();
  }
  function ddActive(w, i) {
    var list = w.querySelector('.mt-pop'), rows = list.children;
    if (!rows.length) return;
    i = Math.max(0, Math.min(rows.length - 1, i));
    Array.prototype.forEach.call(rows, function (r, j) { r.classList.toggle('is-active', j === i); });
    list.setAttribute('aria-activedescendant', rows[i].id);
    w._at = i;
    var row = rows[i];
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
  }
  function ddPick(w, i) {
    var sel = w.querySelector('select');
    sel.selectedIndex = i;
    ddHide(true);
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    ddSync(w);
  }
  function dropdowns() {
    var wrap = document.querySelector('.mt-wrap');
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest('.mt-dd-btn'), row = e.target.closest('.mt-dd .mt-opt');
      // the dropdowns sit inside <label>s: a click in the list would be passed on to the button and reopen it
      if (e.target.closest('.mt-dd .mt-pop')) e.preventDefault();
      if (row) return ddPick(row.closest('.mt-dd'), +row.getAttribute('data-i'));
      if (b) { var w = b.parentNode; if (ddOpen === w) ddHide(true); else ddShow(w); }
    });
    wrap.addEventListener('keydown', function (e) {
      var b = e.target.closest('.mt-dd-btn');
      if (b && /^(ArrowDown|ArrowUp|Enter| )$/.test(e.key)) { e.preventDefault(); ddShow(b.parentNode); return; }
      var list = e.target.closest('.mt-dd .mt-pop'); if (!list) return;
      var w = list.parentNode, at = w._at || 0, n = list.children.length;
      if (e.key === 'ArrowDown') ddActive(w, at + 1);
      else if (e.key === 'ArrowUp') ddActive(w, at - 1);
      else if (e.key === 'Home') ddActive(w, 0);
      else if (e.key === 'End') ddActive(w, n - 1);
      else if (e.key === 'PageDown') ddActive(w, at + 8);
      else if (e.key === 'PageUp') ddActive(w, at - 8);
      else if (e.key === 'Enter' || e.key === ' ') ddPick(w, at);
      else if (e.key === 'Escape') ddHide(true);
      else if (e.key === 'Tab') { ddHide(); return; }
      else if (e.key.length === 1) { // type a letter: the next row starting with it
        var k = e.key.toLowerCase(), rows = list.children;
        for (var j = 1; j <= n; j++) if (rows[(at + j) % n].textContent.trim().toLowerCase().indexOf(k) === 0) { ddActive(w, (at + j) % n); break; }
      } else return;
      e.preventDefault();
    });
    document.addEventListener('pointerdown', function (e) { if (ddOpen && !ddOpen.contains(e.target)) ddHide(); });
  }

  var ITEM_IDS = []; // every item id (mc-item-ids.json): the item dialog and link checks

  function steps() {
    document.querySelectorAll('.mt-step').forEach(function (st) {
      var box = st.querySelector('input'), v = parseInt(box.value, 10) || 0;
      st.querySelector('[data-step="-1"]').disabled = v <= (+box.min || 1);
      st.querySelector('[data-step="1"]').disabled = v >= (+box.max || 99);
    });
  }
  function badge(id, n) { $(id).innerHTML = n ? n + '<span class="mt-vh"> set</span>' : ''; }

  // ---- events ----
  function seg(id, attr, fn) {
    $(id).addEventListener('click', function (e) {
      var b = e.target.closest('[' + attr + ']'); if (!b) return;
      this.querySelectorAll('[' + attr + ']').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      fn(b.getAttribute(attr)); render();
    });
  }
  function init() {
    // The "Drag to turn" hint goes once the mob has been turned (mouse, touch or arrow keys).
    ['pointerdown', 'keydown'].forEach(function (ev) { $('mob3d').addEventListener(ev, function () { $('mobStage').classList.add('is-turned'); }, { once: true }); });
    $('mtPickToggle').addEventListener('click', openPicker);
    $('mtPickClose').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('close', function () { pickFor = null; });
    // a click on the dimmed page around the box closes it
    dlg.addEventListener('click', function (e) {
      if (e.target !== dlg) return;
      var r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
    });
    seg('mobFilt', 'data-grp', function (v) { s.grp = v; drawList(); });
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mob]'); if (!b) return;
      if (pickFor) { var fn = pickFor; pickFor = null; dlg.close(); fn(b.getAttribute('data-mob')); return; }
      s.mob = b.getAttribute('data-mob'); s.opt = {}; s.attr = {};
      fitGear();
      $('mobName').value = s.name;
      root.querySelectorAll('[data-mob]').forEach(function (x) {
        x.setAttribute('aria-pressed', String(x === b));
        x.tabIndex = x === b ? 0 : -1;
      });
      if (dlg.open) dlg.close(); // picking closes the picker; the dialog hands focus back to "Change mob"
      drawOptions(); drawAttrs(); drawDoll(); drawTricks(); render();
      if (frames.length) {
        var tf = frames[frames.length - 1];
        if (tf.item) tf.item.id = eggItem(s.mob); // a spawn egg takes the new mob's egg
        frameHead(); drawTrades();
      }
    });
    root.addEventListener('keydown', function (e) {
      var b = e.target.closest('[data-mob]');
      if (!b) return;
      var items = Array.prototype.slice.call(root.querySelectorAll('[data-mob]'));
      var i = items.indexOf(b), next = i;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(items.length - 1, i + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, i - 1);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = items.length - 1;
      else return;
      e.preventDefault();
      items[i].tabIndex = -1;
      items[next].tabIndex = 0;
      items[next].focus();
    });
    $('mobFind').addEventListener('input', function () { s.q = this.value; drawList(); });
    // Enter in the search picks the first match.
    $('mobFind').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var b = root.querySelector('[data-mob]');
      if (b) { e.preventDefault(); b.click(); }
    });
    $('mobOpts').addEventListener('input', function (e) {
      if (e.target.id === 'mobPlayer') return playerInput(e.target.value);
      var k = e.target.getAttribute('data-opt'); if (!k) return;
      s.opt[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      if (k === 'baby' || k === 'babyLock') babySync(); // shows / hides the lock and the grow-up timer
      growHint();
      render();
    });
    // Tick rows (mob attributes, the item's enchantments and attributes): typing an amount ticks the row.
    // Edited in place, no redraw, so the number box keeps focus.
    function tickRows(box, key, getMap, clamp) {
      $(box).addEventListener('input', function (e) {
        var r = e.target.closest('[' + key + ']'); if (!r) return;
        var id = r.getAttribute(key), map = getMap(), num = r.querySelector('input[type=number]');
        if (e.target.type === 'checkbox' ? e.target.checked : true) map[id] = clamp(num.value);
        else delete map[id];
        r.querySelector('input[type=checkbox]').checked = id in map;
        r.classList.toggle('is-on', id in map);
        if (box !== 'mobAttrs') { $('mobEnN').textContent = Object.keys(it().ench).length || ''; $('mobItAtN').textContent = Object.keys(it().attrs).length || ''; drawDollOnly(); drawInv(); }
        render();
      });
    }
    function num(v) { return parseFloat(v) || 0; }
    tickRows('mobAttrs', 'data-attr', function () { return s.attr; }, num);
    tickRows('mobEnList', 'data-ench', function () { return it().ench; }, function (v) { return Math.min(255, Math.max(1, parseInt(v, 10) || 1)); });
    tickRows('mobItAttrs', 'data-iattr', function () { return it().attrs; }, num);
    $('mobAttrClear').addEventListener('click', function () { s.attr = {}; drawAttrs(); render(); });
    // "Game max" ticks what this item takes at its top level; "Push to 255" lifts the ticked ones. Curses skipped.
    $('mobEnMax').addEventListener('click', function () {
      var e = it();
      MCI.ENCH.forEach(function (en) { if (enchOk(en) && fitsItem(en, e.id) && !/curse/.test(en.id)) e.ench[en.id] = en.max; });
      drawDoll(); render();
    });
    $('mobEn255').addEventListener('click', function () {
      var e = it();
      Object.keys(e.ench).forEach(function (id) { if (!/curse/.test(id)) e.ench[id] = 255; });
      drawDoll(); render();
    });
    $('mobEnClear').addEventListener('click', function () { it().ench = {}; drawDoll(); render(); });
    $('mobGlint').addEventListener('change', function () { it().glint = this.checked; drawDollOnly(); drawInv(); render(); });
    $('mobOwner').addEventListener('input', function () { it().owner = this.value; drawOwner(); render(); });
    $('mobItName').addEventListener('input', function () { it().name = this.value.slice(0, 50); $('mtPickName').textContent = itemLabel(it()); drawDollOnly(); render(); });
    $('mobTrimOn').addEventListener('change', function () { it().trim = this.checked ? lastTrim : ''; drawTrim(); render(); });
    [['mobTrimP', 'data-tp', 0], ['mobTrimM', 'data-tm', 1]].forEach(function (g) {
      $(g[0]).addEventListener('click', function (ev) {
        var b = ev.target.closest('[' + g[1] + ']'); if (!b) return;
        var t = it().trim.split(':');
        t[g[2]] = b.getAttribute(g[1]);
        it().trim = lastTrim = t.join(':');
        keepFocus(g[0], g[1], drawTrim); render();
      });
    });
    $('mobBasics').addEventListener('input', function (e) {
      var f = e.target.getAttribute('data-flag');
      if (f) { s.flags[f] = e.target.checked; render(); }
    });
    $('mobName').addEventListener('input', function () { s.name = this.value; drawTricks(); render(); });
    // name tag tricks: one click names the mob (again = clear)
    $('mobTricks').addEventListener('click', function (e) {
      var b = e.target.closest('[data-trick]'); if (!b) return;
      var t = b.getAttribute('data-trick');
      s.name = s.name === t ? '' : t;
      $('mobName').value = s.name;
      keepFocus('mobTricks', 'data-trick', drawTricks); nameField(); render();
    });
    // Extra: death loot, air, freezing, facing, push
    $('mobLoot').addEventListener('input', function () { s.loot = lootId(this.value); render(); });
    $('mobLootNone').addEventListener('click', function () { s.loot = 'empty'; $('mobLoot').value = 'empty'; render(); });
    $('mobExtra').addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-x'); if (!k) return;
      s.x[k] = e.target.value === '' || !isFinite(+e.target.value) ? '' : e.target.value;
      render();
    });
    $('mobNameFmt').addEventListener('click', function (e) {
      var b = e.target.closest('[data-fmt]'); if (!b) return;
      var k = b.getAttribute('data-fmt');
      if (s.nfmt[k]) delete s.nfmt[k]; else s.nfmt[k] = true;
      nameField(); render();
    });
    $('mobNameClear').addEventListener('click', function () { s.nfmt = {}; s.ncolor = ''; pressed('mobNameColor', 'data-ncolor', ''); nameField(); render(); });
    $('mobShowName').addEventListener('change', function () { s.showName = this.checked; render(); });
    $('mobHealth').addEventListener('input', function () { s.health = this.value; render(); });
    $('mobFire').addEventListener('input', function () { s.fire = +this.value || 0; render(); });
    $('mobTags').addEventListener('input', function () { s.tags = this.value; render(); });
    $('mobNameColor').innerHTML = '<button type="button" class="mt-swc mt-swc--none" data-ncolor="" aria-pressed="false" aria-label="No colour, the default white">Aa</button>' +
      NCOL.map(function (c) { return '<button type="button" class="mt-swc" data-ncolor="' + c + '" aria-pressed="' + (c === s.ncolor) + '" aria-label="' + c.replace('_', ' ') + '" style="background:#' + McFontColor(c) + '"></button>'; }).join('');
    seg('mobNameColor', 'data-ncolor', function (v) { s.ncolor = v; nameField(); });
    $('mobDoll').addEventListener('click', function (e) { var b = e.target.closest('[data-slot]'); if (!b) return; s.slot = b.getAttribute('data-slot'); keepFocus('mobDoll', 'data-slot', drawDoll); });
    $('mobPick').addEventListener('click', function (e) {
      if (e.target.closest('[data-more]')) return openItems();
      if (e.target.closest('[data-mobegg]')) return pickMob();
      var b = e.target.closest('[data-item]'); if (!b) return;
      setItem(b.getAttribute('data-item'));
      keepFocus('mobPick', 'data-item', drawDoll); render();
    });
    // dye: a swatch, or any colour from the + box (live while dragging in the picker)
    $('mobDye').addEventListener('click', function (e) {
      var b = e.target.closest('[data-dye]'); if (!b) return;
      it().dye = b.getAttribute('data-dye');
      keepFocus('mobDye', 'data-dye', drawDye); render();
    });
    $('mobDye').addEventListener('input', function (e) {
      if (e.target.id !== 'mobDyeAny') return;
      var h = e.target.value.slice(1).toLowerCase(), any = e.target.parentNode;
      it().dye = h;
      // the swatch takes the colour; a full redraw would close the browser's colour picker
      any.style.background = '#' + h; any.classList.add('is-on');
      $('mobDye').querySelectorAll('[data-dye]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-dye') === h)); });
      $('mobDyeV').textContent = '#' + h;
      render();
    });
    itemDialog();
    $('mobUnb').addEventListener('change', function () { it().unb = this.checked; render(); });
    // Count, the drop % box, and Always drops (which takes over from the %)
    $('mobCount').addEventListener('input', function () { it().count = Math.min(99, Math.max(1, parseInt(this.value, 10) || 1)); drawInv(); render(); });
    $('mobDropPct').addEventListener('input', function () { it().drop = this.value === '' ? '' : Math.min(100, Math.max(0, +this.value || 0)); render(); });
    $('mobAlways').addEventListener('change', function () { var e = it(); e.always = this.checked; $('mobDropPct').disabled = e.always; $('mobDropPct').value = e.always ? '' : e.drop; render(); });
    // spawn egg: edit its mob in the editor dialog, like a rider
    $('mobEggEdit').addEventListener('click', function () {
      var e = it();
      pushFrame({ kind: 'mob', st: e.egg, item: e, where: function () { return 'In a spawn egg'; } });
      $('mtTabDet').click();
    });
    // storage: a slot opens in the editor dialog (an item frame); Empty it clears every slot
    $('mobInv').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-cell]'); if (!b) return;
      var c = it(), i = +b.getAttribute('data-cell');
      pushFrame({ kind: 'item', c: c, i: i, where: function () { return itemLabel(c) + ', slot ' + (i + 1); } });
    });
    $('mobInvClear').addEventListener('click', function () { it().inv = []; drawInv(); render(); });
    // fireworks: flight, add / remove an explosion, its shape, colours, fade colours, trail and twinkle
    $('mobFwWrap').addEventListener('click', function (ev) {
      var e = it(), b = ev.target.closest('button'); if (!b || !e || !e.fw) return;
      var li = b.closest('[data-ex]'), x = li ? e.fw.ex[+li.getAttribute('data-ex')] : null;
      if (b.hasAttribute('data-flight')) e.fw.flight = +b.getAttribute('data-flight');
      else if (b.id === 'mobFwAdd') { if (e.fw.ex.length < 8) e.fw.ex.push(newEx()); }
      else if (!x) return;
      else if (b.hasAttribute('data-exdel')) e.fw.ex.splice(+li.getAttribute('data-ex'), 1);
      else if (b.hasAttribute('data-shape')) x.shape = b.getAttribute('data-shape');
      else if (b.hasAttribute('data-col')) {
        var k = b.closest('[data-key]').getAttribute('data-key'), n = +b.getAttribute('data-col'), at = x[k].indexOf(n);
        if (at > -1) x[k].splice(at, 1); else x[k].push(n);
      } else return;
      refocus($('mobFwEx'), drawFw); render();
    });
    $('mobFwWrap').addEventListener('change', function (ev) {
      var k = ev.target.getAttribute('data-fwk'), li = ev.target.closest('[data-ex]'); if (!k || !li) return;
      it().fw.ex[+li.getAttribute('data-ex')][k] = ev.target.checked; render();
    });
    $('mobGear').addEventListener('click', function () {
      var pick = s.ver === 3 ? 'netherite' : 'diamond', keep = { saddle: s.eq.saddle, body: s.eq.body };
      s.eq = { saddle: keep.saddle, body: keep.body, head: gear(pick + '_helmet', true), chest: gear(pick + '_chestplate', true), legs: gear(pick + '_leggings', true), feet: gear(pick + '_boots', true), mainhand: gear(pick + '_sword', true), offhand: gear('shield') };
      if (!keep.saddle) delete s.eq.saddle;
      if (!keep.body) delete s.eq.body;
      drawDoll(); render();
    });
    $('mobGearClear').addEventListener('click', function () { s.eq = {}; drawDoll(); render(); });
    dropdowns();
    // - / + steppers (gear count, trade counts): a step edits the box, which fires the box's own input handler
    document.querySelector('.mt-wrap').addEventListener('click', function (e) {
      var b = e.target.closest('.mt-step [data-step]'); if (!b) return;
      var box = b.parentNode.querySelector('input'), min = +box.min || 1, max = +box.max || 99;
      box.value = Math.min(max, Math.max(min, (parseInt(box.value, 10) || min) + +b.getAttribute('data-step')));
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    $('mobTrAdd').addEventListener('click', function () {
      if (s.trades.length >= 30) return;
      s.trades.push(newTrade()); drawTrades(); render();
      var f = $('mobTrades').querySelectorAll('button[data-tpick][data-k="sell"]'); f[f.length - 1].focus();
    });
    $('mobTrades').addEventListener('click', function (e) {
      var c = e.target.closest('[data-tinv] [data-cell]');
      if (c) {
        var ti = +c.parentNode.getAttribute('data-tinv'), sell = s.trades[ti].sell, ci = +c.getAttribute('data-cell');
        return pushFrame({ kind: 'item', c: sell, i: ci, sel: '[data-tinv="' + ti + '"] [data-cell="' + ci + '"]', where: function () { return 'Trade ' + (ti + 1) + ': ' + nice(sell.id) + ', slot ' + (ci + 1); } });
      }
      var tp = e.target.closest('[data-tpick]');
      if (tp) {
        var t = s.trades[+tp.getAttribute('data-tpick')], k = tp.getAttribute('data-k'), ti2 = tp.getAttribute('data-tpick');
        var label = { buy: 'Costs', buyB: 'And', sell: 'Gives' }[k];
        return openItems({ cur: t[k].id, title: 'Trade ' + (+ti2 + 1) + ', ' + label.toLowerCase(), hint: k === 'sell' ? 'What the villager sells.' : 'What the player pays.',
          pick: function (id) { t[k].id = id; drawTrades(); render(); },
          back: function () { return $('mobTrades').querySelector('button[data-tpick="' + ti2 + '"][data-k="' + k + '"]'); } });
      }
      var cl = e.target.closest('[data-tclear]');
      if (cl) { var tc = cl.getAttribute('data-tclear'); s.trades[+tc].buyB = { id: '', n: 1 }; drawTrades(); render(); $('mobTrades').querySelector('button[data-tpick="' + tc + '"][data-k="buyB"]').focus(); return; }
      var x = e.target.closest('[data-tinvclear]');
      if (x) { s.trades[+x.getAttribute('data-tinvclear')].sell.inv = []; drawTrades(); render(); return; }
      var b = e.target.closest('[data-trdel]'); if (!b) return;
      s.trades.splice(+b.getAttribute('data-trdel'), 1); drawTrades(); render(); $('mobTrAdd').focus();
    });
    $('mobTrades').addEventListener('input', function (e) {
      var el = e.target, i = el.getAttribute('data-t'); if (i == null) return;
      var t = s.trades[i], k = el.getAttribute('data-k'), f = el.getAttribute('data-f'), v = el.value;
      if (k) t[k].n = tradeN(v); // counts (items are picked in the dialog)
      else if (f === 'xp') t.xp = el.checked;
      else if (v === '' || !isFinite(+v)) t[f] = '';
      else t[f] = f === 'pm' ? +v : f === 'uses' ? Math.max(0, Math.round(+v)) : Math.round(+v);
      tradeLook(el.closest('.mt-trade'), t); render();
    });
    // an item without an icon on this site shows its initials instead
    $('mobTrades').addEventListener('error', function (e) { if (e.target.tagName === 'IMG') e.target.hidden = true; }, true);
    $('mobFxAdd').addEventListener('change', function () { if (!this.value) return; s.fx.push({ id: this.value, lvl: 1, hide: true, amb: false, m: '', sec: '' }); drawFx(); render(); });
    $('mobFx').addEventListener('input', function (e) {
      var i = e.target.getAttribute('data-fx'), k = e.target.getAttribute('data-k'); if (i == null || !k) return;
      var v = e.target.value;
      if (k === 'lvl') s.fx[i].lvl = Math.max(1, Math.min(255, parseInt(v, 10) || 1));
      else s.fx[i][k] = v === '' || !isFinite(+v) ? '' : String(Math.max(0, +v)); // minutes / seconds
      render();
    });
    $('mobFx').addEventListener('click', function (e) {
      var b = e.target.closest('[data-fxdel]');
      if (b) { s.fx.splice(+b.getAttribute('data-fxdel'), 1); drawFx(); render(); $('mobFxAdd').focus(); return; }
      var p = e.target.closest('[data-parts]'); if (!p) return;
      var f = s.fx[p.getAttribute('data-fx')], v = p.getAttribute('data-parts');
      f.hide = v === 'hide'; f.amb = v === 'amb';
      p.parentNode.querySelectorAll('[data-parts]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === p)); });
      render();
    });
    // on top = the end of riders; underneath = the end of mounts (under the lowest one so far)
    // on top = the end of riders; underneath = the end of mounts. Both pick the mob in the mob picker.
    [['mobRiderAdd', 'riders', 'Put a mob on top'], ['mobMountAdd', 'mounts', 'Put a mob underneath']].forEach(function (a) {
      $(a[0]).addEventListener('click', function () {
        if (top[a[1]].length >= 20) return;
        pickFor = function (m) { top[a[1]].push(mobState(m)); drawRiders(); render(); say(mobName(m) + ' added'); $(a[0]).focus(); };
        openPicker(a[2]);
      });
    });
    $('mobRiders').addEventListener('click', function (e) {
      var b = e.target.closest('[data-rdel]');
      if (b) {
        var k = b.getAttribute('data-rdel').split(':');
        stackList(k[0]).splice(+k[1], 1); drawRiders(); render();
        $(k[0] === 'm' ? 'mobMountAdd' : 'mobRiderAdd').focus();
        return;
      }
      var ed = e.target.closest('[data-redit]');
      if (ed) { var x = ed.getAttribute('data-redit').split(':'); editRider(x[0], +x[1]); }
    });
    // the editor dialog: Back pops a frame; Done, Esc or a click on the dimmed page close it (closeFrames puts things back)
    rdlg = $('mtRiderDlg');
    rdlg.addEventListener('close', closeFrames);
    $('mtRiderBack').addEventListener('click', frameBack);
    $('mtRiderDone').addEventListener('click', function () { rdlg.close(); });
    $('mtRiderClose').addEventListener('click', function () { rdlg.close(); });
    $('mtRiderChange').addEventListener('click', openPicker);
    rdlg.addEventListener('click', function (e) {
      if (e.target !== rdlg) return;
      var r = rdlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) rdlg.close();
    });
    // an option icon that this site doesn't have (some enderman blocks) just stays empty
    document.querySelector('.mt-wrap').addEventListener('error', function (e) { if (e.target.tagName === 'IMG' && e.target.closest('.mt-dd')) e.target.style.visibility = 'hidden'; }, true);
    seg('mobOut', 'data-out', function (v) { s.out = v; });
    $('mobVerSel').addEventListener('change', function () {
      s.ver = +this.value;
      if (!okv(mob().v)) s.mob = 'zombie';
      var known = function (r) { return okv((MOBS.filter(function (m) { return m.id === r.mob; })[0] || {}).v); };
      s.riders = s.riders.filter(known); s.mounts = s.mounts.filter(known);
      [s].concat(s.riders, s.mounts).forEach(function (st) { Object.keys(st.eq).forEach(function (k) { if (!okv(itemVer(st.eq[k].id))) delete st.eq[k]; }); });
      drawList(); drawOptions(); drawAttrs(); drawDoll(); drawRiders(); render();
    });
    // Screen readers: say so when a copy button is pressed (the button's own label flips to "Copied").
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('#mobCopy, #mobQCopy'); if (!btn) return;
      setTimeout(function () { say(btn.classList.contains('is-done') ? 'Command copied' : 'Copy failed. Select the command and press Ctrl+C.'); }, 150);
    });
    ['mobSpCount', 'mobSpRange', 'mobSpMax'].forEach(function (id) { $(id).addEventListener('input', render); });
    $('mtCodeMore').addEventListener('click', function () {
      var open = $('mobCmd').classList.toggle('is-open');
      this.setAttribute('aria-expanded', String(open));
      this.textContent = open ? 'Show less' : 'Show all';
    });
    // Share: the whole build goes in the address (#b=...), which is also copied.
    $('mtShare').addEventListener('click', function () {
      var b = this, label = b.querySelector('span'), link = shareLink();
      history.replaceState(null, '', link);
      copyText(link).then(function () { label.textContent = 'Link copied'; say('Link to this mob copied'); },
        function () { label.textContent = 'Link is in the address bar'; say('Copy failed. The link is in the address bar.'); });
      clearTimeout(b._t);
      b._t = setTimeout(function () { label.textContent = 'Share build'; }, 2200);
    });
    // Reset asks twice: one click arms it for three seconds.
    $('mtReset').addEventListener('click', function () {
      var b = this, label = b.querySelector('span');
      if (!b._armed) {
        b._armed = setTimeout(function () { b._armed = 0; label.textContent = 'Reset'; b.classList.remove('is-armed'); }, 3000);
        label.textContent = 'Click again to reset';
        b.classList.add('is-armed');
        return;
      }
      clearTimeout(b._armed); b._armed = 0; label.textContent = 'Reset'; b.classList.remove('is-armed');
      s = top = defaults();
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      syncUI();
      say('Back to the starting mob');
    });
    var shared = clean(parseLink());
    if (shared) s = top = shared;
    syncUI();
  }

  // ---- the editor dialog (riders Oct 19; spawn eggs and storage Oct 19): a stack of frames. A mob frame (a rider,
  // a mount, a spawn egg's mob) moves the settings tabs and the preview in and points s at that mob; every control
  // already works on s. An item frame (a slot inside storage) moves just the item editor in and points it() at that
  // slot. Back pops one frame; Done, Esc or a click outside close them all and move everything back. ----
  var rdlg = null, frames = [], homes = null;
  function itemFrame() { var f = frames[frames.length - 1]; return f && f.kind === 'item' ? f : null; }
  function it() { var f = itemFrame(); return (f ? f.c.inv[f.i] : s.eq[s.slot]) || null; }
  function putIt(g) { var f = itemFrame(); if (f) f.c.inv[f.i] = g || null; else if (g) s.eq[s.slot] = g; else delete s.eq[s.slot]; }
  function curTab() { var t = document.querySelector('.mt-set .mch-tab.is-on[id^="mtTab"]'); return t ? t.id : 'mtTabDet'; }
  // f = {kind: 'mob', st, item (a spawn egg), rider ('r:0')} or {kind: 'item', c (the storage item), i (its slot)}; where() = its crumb
  function pushFrame(f) {
    if (frames.length >= 12) return;
    if (!frames.length) homes = ['.mt-set', '.mt-prev', '#mobItemEd'].map(function (q) { var el = document.querySelector(q); return [el, el.parentNode, el.nextSibling]; });
    f.back = curTab();
    frames.push(f);
    showFrame();
    if (!rdlg.open) rdlg.showModal();
    $('mtRiderDone').focus();
  }
  function goHome() { homes.slice().reverse().forEach(function (h) { h[1].insertBefore(h[0], h[2]); }); }
  function showFrame() {
    var f = frames[frames.length - 1], m = frames.filter(function (x) { return x.kind === 'mob'; }).pop();
    if (s !== top) { top.grp = s.grp; top.q = s.q; }
    s = m ? m.st : top;
    if (s !== top) { s.ver = top.ver; s.out = top.out; s.grp = top.grp; s.q = top.q; }
    goHome();
    (f.kind === 'mob' ? homes.slice(0, 2) : homes.slice(2)).forEach(function (h) { $('mtRiderBody').appendChild(h[0]); });
    rdlg.classList.toggle('is-item', f.kind === 'item');
    syncUI();
  }
  function frameHead() {
    var f = frames[frames.length - 1], e = f.kind === 'item' ? it() : null;
    $('mtRiderEgg').src = f.kind === 'item' ? (e ? iconOf(e) : itemIcon(f.c.id)) : eggOf(s.mob);
    $('mtRiderH').textContent = f.kind === 'item' ? (e ? itemLabel(e) : 'Empty slot') : mobName(s.mob);
    $('mtRiderK').textContent = frames.map(function (x) { return x.where(); }).join(' › ');
    $('mtRiderBack').hidden = frames.length < 2;
    $('mtRiderChange').hidden = f.kind !== 'mob';
  }
  // after a frame closes, focus goes back to what opened it
  function focusFrom(f) {
    var b = f.sel ? document.querySelector(f.sel) : f.rider ? document.querySelector('[data-redit="' + f.rider + '"]') : f.kind === 'item' ? document.querySelector('#mobInv [data-cell="' + f.i + '"]') : $('mobEggEdit');
    if (b && b.offsetParent) b.focus({ preventScroll: true });
  }
  function frameBack() {
    if (frames.length < 2) return rdlg.close();
    var f = frames.pop();
    showFrame();
    if (f.kind === 'mob') $(f.back).click();
    focusFrom(f);
  }
  function closeFrames() {
    if (!frames.length) return;
    var first = frames[0];
    frames = [];
    goHome();
    rdlg.classList.remove('is-item');
    if (s !== top) { top.grp = s.grp; top.q = s.q; }
    s = top;
    syncUI();
    if (first.kind === 'mob') $(first.back).click();
    focusFrom(first);
  }
  function editRider(kind, i) {
    if (frames.length || !stackList(kind)[i]) return;
    pushFrame({ kind: 'mob', st: stackList(kind)[i], rider: kind + ':' + i, where: function () {
      var list = stackList(kind), next = mobName(i ? list[i - 1].mob : top.mob);
      return (kind === 'm' ? 'Mount ' : 'Rider ') + (i + 1) + ' of ' + list.length + (kind === 'm' ? ', carrying the ' : ', sitting on the ') + next;
    } });
    $('mtTabDet').click();
  }
  // Redraws a box and puts focus back on the control at the same place in it (button groups that repeat).
  function refocus(box, draw) {
    var all = function () { return Array.prototype.slice.call(box.querySelectorAll('button, input')); }, i = all().indexOf(document.activeElement);
    draw();
    if (i > -1 && all()[i]) all()[i].focus({ preventScroll: true });
  }
    // Names the game treats specially. Dinnerbone / Grumm flip any mob; the rest only matter on one mob.
  var TRICKS = [['jeb_', 'Rainbow wool', 'sheep'], ['Dinnerbone', 'Upside down'], ['Grumm', 'Upside down'], ['Toast', 'Toast\'s coat', 'rabbit'], ['Johnny', 'Attacks every mob', 'vindicator']];
  function drawTricks() {
    $('mobTricks').innerHTML = '<span class="mt-l">Name tricks</span>' + TRICKS.filter(function (t) { return !t[2] || t[2] === s.mob; }).map(function (t) {
      return '<button type="button" class="mt-trick" data-trick="' + t[0] + '" aria-pressed="' + (s.name === t[0]) + '"><b>' + t[0] + '</b><span>' + t[1] + '</span></button>';
    }).join('');
  }
  function lootId(v) { return String(v || '').toLowerCase().trim().replace(/^minecraft:/, '').replace(/[^a-z0-9_.\/:-]/g, '').slice(0, 100); }
  var XKEYS = ['air', 'frozen', 'yaw', 'pitch', 'mx', 'my', 'mz'];

  // ---- shared links ----
  // a mob's own settings in a link (the root adds version, output and its riders)
  var MOBKEYS = ['mob', 'name', 'ncolor', 'nfmt', 'showName', 'health', 'flags', 'opt', 'attr', 'eq', 'fx', 'tags', 'fire', 'trades', 'loot', 'x'];
  function linkOf(st) {
    var o = { owner: { name: st.owner.name, id: st.owner.id } };
    MOBKEYS.forEach(function (k) { o[k] = st[k]; });
    return o;
  }
  function shareLink() {
    var o = linkOf(top);
    o.ver = top.ver; o.out = top.out; o.riders = top.riders.map(linkOf); o.mounts = top.mounts.map(linkOf);
    var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return location.origin + location.pathname + '#b=' + b64;
  }
  function parseLink() {
    var m = location.hash.match(/^#b=([\w-]+)$/);
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return null; }
  }
  // A link is outside input: every value is checked against what this page itself could have made,
  // because several of them end up in markup (option values, row amounts) and in the command.
  function clean(o) {
    var isO = function (x) { return !!x && typeof x === 'object' && !Array.isArray(x); };
    var num = function (x) { return typeof x === 'number' && isFinite(x); };
    var known = function (id) { return MOBS.some(function (m) { return m.id === id; }); };
    if (!isO(o) || !known(o.mob)) return null;
    var d = defaults();
    d.mob = o.mob;
    if ([0, 1, 2, 3].indexOf(o.ver) > -1) d.ver = o.ver;
    if (['summon', 'egg', 'spawner', 'bedrock'].indexOf(o.out) > -1) d.out = o.out;
    cleanMob(o, d, 0);
    // riders: old links have bare mob ids, newer ones whole mobs
    d.riders = Array.isArray(o.riders) ? o.riders.map(function (r) {
      if (typeof r === 'string') return known(r) ? mobState(r) : null;
      return isO(r) && known(r.mob) ? cleanMob(r, mobState(r.mob), 0) : null;
    }).filter(Boolean).slice(0, 20) : [];
    d.mounts = Array.isArray(o.mounts) ? o.mounts.map(function (r) { return isO(r) && known(r.mob) ? cleanMob(r, mobState(r.mob), 0) : null; }).filter(Boolean).slice(0, 20) : [];
    return d;
  }
  // depth: how far inside storage and spawn eggs this mob sits (both stop 4 deep)
  function cleanMob(o, d, depth) {
    var isO = function (x) { return !!x && typeof x === 'object' && !Array.isArray(x); };
    var num = function (x) { return typeof x === 'number' && isFinite(x); };
    var nstr = function (v) { return typeof v === 'string' && v !== '' && isFinite(+v) ? String(+v) : ''; };
    d.name = typeof o.name === 'string' ? o.name.slice(0, 50) : '';
    d.ncolor = o.ncolor === '' || NCOL.indexOf(o.ncolor) > -1 ? o.ncolor : '';
    d.showName = o.showName === true;
    d.nfmt = {};
    if (isO(o.nfmt)) NFMT.forEach(function (k) { if (o.nfmt[k] === true) d.nfmt[k] = true; });
    d.health = typeof o.health === 'string' && o.health !== '' && isFinite(+o.health) ? String(+o.health) : '';
    d.tags = typeof o.tags === 'string' ? o.tags.slice(0, 200) : '';
    d.fire = num(o.fire) ? Math.max(0, o.fire) : 0;
    d.flags = {};
    if (isO(o.flags)) FLAGS.forEach(function (f) { if (o.flags[f] === true) d.flags[f] = true; });
    d.opt = {};
    if (isO(o.opt)) (OPTS[d.mob] || []).forEach(function (x) {
      var v = o.opt[x[0]];
      if (x[2] === 'bool' && typeof v === 'boolean') d.opt[x[0]] = v;
      else if (x[2] === 'int' && typeof v === 'string' && (v === '' || isFinite(+v))) d.opt[x[0]] = v === '' ? '' : String(+v);
      else if (x[2] === 'time') ['_m', '_s'].forEach(function (k) { var t = o.opt[x[0] + k]; if (nstr(t)) d.opt[x[0] + k] = String(Math.max(0, +t)); });
      else if (x[2] === 'select' && typeof v === 'string' && (v === '' || x[3].some(function (y) { return y[0] === v; }))) d.opt[x[0]] = v;
    });
    d.attr = {};
    if (isO(o.attr)) ATTR.forEach(function (a) { if (num(o.attr[a[0]])) d.attr[a[0]] = o.attr[a[0]]; });
    d.eq = {};
    if (isO(o.eq)) slotsOf(d.mob).forEach(function (sl) {
      var e = o.eq[sl[0]];
      if (!isO(e) || typeof e.id !== 'string' || !fits(sl[0], e.id, d.mob)) return;
      var g = cleanItem(e, depth);
      if (g) d.eq[sl[0]] = g;
    });
    d.fx = Array.isArray(o.fx) ? o.fx.filter(function (f) { return isO(f) && FX.some(function (x) { return x[0] === f.id; }); }).slice(0, 40)
      .map(function (f) {
        return { id: f.id, lvl: num(f.lvl) ? Math.min(255, Math.max(1, Math.round(f.lvl))) : 1, hide: f.hide !== false, amb: f.amb === true,
          m: nstr(f.m) ? String(Math.max(0, +f.m)) : '', sec: nstr(f.sec) ? String(Math.max(0, +f.sec)) : '' };
      }) : [];
    var ow = isO(o.owner) ? o.owner : {};
    d.owner = { name: typeof ow.name === 'string' && /^\w{1,16}$/.test(ow.name) ? ow.name : '', id: typeof ow.id === 'string' && UUIDRE.test(ow.id) ? dashed(ow.id) : '' };
    d.loot = typeof o.loot === 'string' ? lootId(o.loot) : '';
    d.x = {};
    if (isO(o.x)) XKEYS.forEach(function (k) { if (nstr(o.x[k])) d.x[k] = nstr(o.x[k]); });
    var st = function (x) { return { id: isO(x) ? tradeId(x.id) : '', n: isO(x) && num(x.n) ? tradeN(x.n) : 1 }; };
    d.trades = Array.isArray(o.trades) ? o.trades.filter(isO).slice(0, 30).map(function (t) {
      var sell = st(t.sell);
      if (invMax(sell.id) && isO(t.sell) && Array.isArray(t.sell.inv) && depth < 4) sell.inv = t.sell.inv.slice(0, invMax(sell.id)).map(function (x) { return x ? cleanItem(x, depth + 1) : null; });
      return { buy: st(t.buy), buyB: st(t.buyB), sell: sell, uses: num(t.uses) ? Math.max(0, Math.round(t.uses)) : '', xp: t.xp !== false,
        pm: num(t.pm) ? t.pm : '', sp: num(t.sp) ? Math.round(t.sp) : '', dem: num(t.dem) ? Math.round(t.dem) : '' };
    }) : [];
    return d;
  }
  // One item from a link (gear, or anything inside storage), with its storage, fireworks and egg's mob.
  function cleanItem(e, depth) {
    var isO = function (x) { return !!x && typeof x === 'object' && !Array.isArray(x); };
    var num = function (x) { return typeof x === 'number' && isFinite(x); };
    if (!isO(e) || typeof e.id !== 'string' || !/^[a-z0-9_]{1,60}$/.test(e.id) || e.id === 'air' || ITEM_IDS.length && ITEM_IDS.indexOf(e.id) < 0) return null;
    var g = gear(e.id);
    if (isO(e.ench)) MCI.ENCH.forEach(function (en) { if (num(e.ench[en.id])) g.ench[en.id] = Math.min(255, Math.max(1, Math.round(e.ench[en.id]))); });
    if (isO(e.attrs)) MCI.ATTRS.forEach(function (a) { if (num(e.attrs[a[0]])) g.attrs[a[0]] = e.attrs[a[0]]; });
    g.unb = e.unb === true;
    g.glint = e.glint === true;
    g.drop = num(e.drop) ? Math.min(100, Math.max(0, e.drop)) : '';
    g.always = e.always === true;
    g.count = num(e.count) ? Math.min(99, Math.max(1, Math.round(e.count))) : 1;
    g.owner = typeof e.owner === 'string' ? e.owner.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16) : '';
    g.dye = DYEABLE.test(e.id) && typeof e.dye === 'string' && /^[0-9a-f]{6}$/.test(e.dye) ? e.dye : '';
    g.trim = TRIMMABLE.test(e.id) && trimOk(e.trim) ? e.trim : '';
    g.name = typeof e.name === 'string' ? e.name.slice(0, 50) : '';
    if (invMax(e.id)) g.inv = depth < 4 && Array.isArray(e.inv) ? e.inv.slice(0, invMax(e.id)).map(function (x) { return x ? cleanItem(x, depth + 1) : null; }) : [];
    if (isFw(e.id)) {
      var cols = function (a) { return Array.isArray(a) ? a.filter(function (n) { return num(n) && n >= 0 && n <= 0xffffff && n === Math.round(n); }).slice(0, 16) : []; };
      var f = isO(e.fw) ? e.fw : {}, ex = Array.isArray(f.ex) ? f.ex.filter(isO).slice(0, 8).map(function (x) {
        return { shape: McFirework.SHAPES.some(function (sh) { return sh.id === x.shape; }) ? x.shape : 'small_ball', colors: cols(x.colors), fade: cols(x.fade), trail: x.trail === true, twinkle: x.twinkle === true };
      }) : [];
      g.fw = { flight: [1, 2, 3].indexOf(f.flight) > -1 ? f.flight : 1, ex: ex.length ? ex : [newEx()] };
    }
    var known = isO(e.egg) && MOBS.some(function (m) { return m.id === e.egg.mob; });
    if (known && depth < 4 && (eggMob(e.id) || e.id === 'armor_stand')) g.egg = cleanMob(e.egg, mobState(e.egg.mob), depth + 1);
    else if (eggMob(e.id)) g.egg = mobState(eggMob(e.id));
    return g;
  }
  // Puts every control back in line with s (after Reset or a shared link), then redraws.
  function syncUI() {
    $('mobName').value = s.name;
    $('mobHealth').value = s.health;
    $('mobFire').value = s.fire || '';
    $('mobTags').value = s.tags;
    $('mobLoot').value = s.loot;
    XKEYS.forEach(function (k) { var el = document.querySelector('#mobExtra [data-x="' + k + '"]'); if (el) el.value = s.x[k] || ''; });
    $('mobShowName').checked = s.showName;
    document.querySelectorAll('#mobBasics [data-flag]').forEach(function (c) { c.checked = !!s.flags[c.getAttribute('data-flag')]; });
    pressed('mobNameColor', 'data-ncolor', s.ncolor);
    nameField();
    pressed('mobOut', 'data-out', s.out);
    $('mobVerSel').value = String(s.ver);
    drawList(); drawOptions(); drawAttrs(); drawDoll(); drawFx(); drawRiders(); drawTrades(); drawTricks(); render();
  }
  function pressed(id, attr, v) { $(id).querySelectorAll('[' + attr + ']').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute(attr) === v)); }); }
  // Redraws a button group and puts focus back on the same button if it was there (keyboard users).
  function keepFocus(box, attr, draw) {
    var a = document.activeElement, k = a && $(box).contains(a) ? a.getAttribute(attr) : null;
    draw();
    if (k !== null) { var n = $(box).querySelector('[' + attr + '="' + k + '"]'); if (n) n.focus({ preventScroll: true }); }
  }
  function say(msg) { var l = $('mtLive'); l.textContent = ''; setTimeout(function () { l.textContent = msg; }, 60); }
  function copyText(x) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(x);
    return new Promise(function (ok, bad) {
      var a = document.createElement('textarea');
      a.value = x; a.setAttribute('readonly', ''); a.style.position = 'fixed'; a.style.opacity = '0';
      document.body.appendChild(a); a.select();
      try { document.execCommand('copy') ? ok() : bad(); } catch (e) { bad(e); }
      a.remove();
    });
  }
  var LISTS = { loot: [], holdable: [] };
  Promise.all([
    fetch('/mc-mobs.json').then(function (r) { return r.json(); }),
    fetch('/mc-mob-lists.json').then(function (r) { return r.json(); }).catch(function () { return LISTS; }),
    // every item id in the game (_tools/items/build.py): the trade fields' suggestions, "More" in Gear, and what a
    // shared link's gear is checked against, so it's in before the link is read
    fetch('/mc-item-ids.json').then(function (r) { return r.json(); }).catch(function () { return []; })
  ]).then(function (got) {
    var d = got[0];
    DATA = d;
    LISTS = got[1];
    ITEM_IDS = Array.isArray(got[2]) ? got[2] : [];
    MOBS = d.mobs.map(function (m) { return { id: m[0], name: m[1], g: m[2], v: m[3], since: m[4], egg: m[5], d: m[6] }; });
    FX = d.fx;
    OPTS.mooshroom.filter(function (o) { return o[0] === 'stew'; })[0][3] = FX.map(function (f) { return [f[0], f[1]]; });
    OPTS.enderman.filter(function (o) { return o[0] === 'carried'; })[0][3] = sel(LISTS.holdable || []);
    $('mobLootList').innerHTML = ['empty'].concat(LISTS.loot || []).map(function (id) { return '<option value="' + id + '"></option>'; }).join('');
    init();
  }).catch(function () {
    root.innerHTML = '<p class="mt-empty">The mob list didn\'t load. Check your connection, then refresh the page.</p>';
    $('mobCmd').textContent = '';
  });
})();
