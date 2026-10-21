/* Shared Minecraft item data (Oct 15 2026), used by the enchanted item generator
   (mc-enchant.js) and the mob summoner's equipment (mc-mob.js). Load it before them.
   ENCH (ids, max levels, which items take them) was read from the 26.3 game files:
   data/minecraft/enchantment/*.json + the enchantable/* item tags. "v" on an item or
   enchantment = the oldest version group it exists in, in the enchanted item page's
   numbering: 0 = before 1.20.5, 1 = 1.20.5 - 1.21.4, 2 = 1.21.5 and newer. */
window.McItems = (function () {
  var TOOL = ['wooden', 'stone', 'copper', 'iron', 'golden', 'diamond', 'netherite'];
  var ARMOR = ['leather', 'chainmail', 'copper', 'iron', 'golden', 'diamond', 'netherite'];
  // slot = where a new attribute defaults to (mainhand when missing).
  var TYPES = [
    { id: 'sword', name: 'Sword', mats: TOOL },
    { id: 'spear', name: 'Spear', mats: TOOL, v: 2 }, // 1.21.11
    { id: 'axe', name: 'Axe', mats: TOOL },
    { id: 'pickaxe', name: 'Pickaxe', mats: TOOL },
    { id: 'shovel', name: 'Shovel', mats: TOOL },
    { id: 'hoe', name: 'Hoe', mats: TOOL },
    { id: 'helmet', name: 'Helmet', mats: ARMOR, slot: 'head' },
    { id: 'chestplate', name: 'Chestplate', mats: ARMOR, slot: 'chest' },
    { id: 'leggings', name: 'Leggings', mats: ARMOR, slot: 'legs' },
    { id: 'boots', name: 'Boots', mats: ARMOR, slot: 'feet' },
    { id: 'turtle_helmet', name: 'Turtle Shell', slot: 'head' },
    { id: 'elytra', name: 'Elytra', slot: 'chest' },
    { id: 'bow', name: 'Bow' },
    { id: 'crossbow', name: 'Crossbow' },
    { id: 'trident', name: 'Trident' },
    { id: 'mace', name: 'Mace', v: 1 }, // 1.21
    { id: 'fishing_rod', name: 'Fishing Rod' },
    { id: 'shears', name: 'Shears' },
    { id: 'shield', name: 'Shield', slot: 'offhand' },
    { id: 'flint_and_steel', name: 'Flint and Steel' },
    { id: 'carrot_on_a_stick', name: 'Carrot on a Stick' },
    { id: 'warped_fungus_on_a_stick', name: 'Warped Fungus on a Stick' },
    { id: 'brush', name: 'Brush' },
    { id: 'compass', name: 'Compass' },
    { id: 'carved_pumpkin', name: 'Carved Pumpkin', slot: 'head' },
    { id: 'player_head', name: 'Player Head', slot: 'head' },
    { id: 'enchanted_book', name: 'Enchanted Book' }
  ];
  var ARM = 'helmet chestplate leggings boots turtle_helmet';
  // wearable without durability: they only take the two curses (mob heads too, which only the mob page offers)
  var WEAR = ' carved_pumpkin player_head skeleton_skull wither_skeleton_skull zombie_head creeper_head';
  var NO_DUR = ' compass enchanted_book' + WEAR + ' ';
  var DUR = TYPES.filter(function (t) { return NO_DUR.indexOf(' ' + t.id + ' ') < 0; }).map(function (t) { return t.id; }).join(' ');
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
    ['unbreaking', 'Unbreaking', 3, DUR],
    ['mending', 'Mending', 1, DUR],
    ['binding_curse', 'Curse of Binding', 1, ARM + ' elytra' + WEAR],
    ['vanishing_curse', 'Curse of Vanishing', 1, DUR + ' compass' + WEAR]
  ].map(function (e) {
    return { id: e[0], name: e[1], max: e[2], on: e[3].split(' '), v: e[4] || 0 };
  });
  // Item attribute modifiers: [id as in 1.21.2+, the game's tooltip name, player base value, flags].
  // Flags: "o" = existed before 1.20.5 (as generic.*), "p" = was player.* in 1.20.5 - 1.21.1 (generic.* otherwise).
  var ATTRS = [
    ['armor', 'Armor', 0, 'o'], ['armor_toughness', 'Armor Toughness', 0, 'o'], ['attack_damage', 'Attack Damage', 1, 'o'],
    ['attack_knockback', 'Attack Knockback', 0, 'o'], ['attack_speed', 'Attack Speed', 4, 'o'], ['block_break_speed', 'Block Break Speed', 1, 'p'],
    ['block_interaction_range', 'Block Interaction Range', 4.5, 'p'], ['entity_interaction_range', 'Entity Interaction Range', 3, 'p'],
    ['burning_time', 'Burning Time', 1], ['explosion_knockback_resistance', 'Explosion Knockback Resistance', 0],
    ['fall_damage_multiplier', 'Fall Damage Multiplier', 1], ['gravity', 'Gravity', 0.08], ['jump_strength', 'Jump Strength', 0.42],
    ['knockback_resistance', 'Knockback Resistance', 0, 'o'], ['luck', 'Luck', 0, 'o'], ['max_absorption', 'Max Absorption', 0],
    ['max_health', 'Max Health', 20, 'o'], ['mining_efficiency', 'Mining Efficiency', 0, 'p'], ['movement_efficiency', 'Movement Efficiency', 0],
    ['movement_speed', 'Speed', 0.1, 'o'], ['oxygen_bonus', 'Oxygen Bonus', 0], ['safe_fall_distance', 'Safe Fall Distance', 3],
    ['scale', 'Scale', 1], ['sneaking_speed', 'Sneaking Speed', 0.3, 'p'], ['step_height', 'Step Height', 0.6],
    ['submerged_mining_speed', 'Submerged Mining Speed', 0.2, 'p'], ['sweeping_damage_ratio', 'Sweeping Damage Ratio', 0, 'p'],
    ['water_movement_efficiency', 'Water Movement Efficiency', 0]
  ];
  return { TOOL: TOOL, ARMOR: ARMOR, TYPES: TYPES, ENCH: ENCH, ATTRS: ATTRS };
})();
