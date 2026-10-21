/* Potion generator (Oct 13 2026), /minecraft/tools/potion.
   Builds the effect picker and writes three kinds of command:
     give    /give with the potion item, in the syntax of the picked version
               2 = 1.21.5 and newer  potion[potion_contents={custom_effects:[..]},custom_name={..}]
               1 = 1.20.5 - 1.21.4   same potion_contents, text as quoted JSON
               0 = 1.14 - 1.20.4     potion{CustomPotionEffects:[{Id:1b,id:"minecraft:speed",..}]}
                   (Id = number up to 1.20.1, id = name from 1.20.2; both are written so
                   the one command works across the whole range)
     java    /effect give lines, one per effect (no item)
     bedrock /effect lines with Bedrock's names (Bedrock has no custom potion /give)
     cloud   /summon area_effect_cloud (Oct 19): the effects, radius, time and a particle colour of its own
   FX (ids, names, colours, good/bad, instant) was read from the 26.3 game files:
   MobEffects.class + lang/en_us.json; Bedrock names from Mojang's bedrock-samples
   command metadata.    The bottle colour is the game's own mix (PotionContents): each visible effect's
   colour weighted by its level; no visible effect = water blue 385dc6.
   Icons: /minecrafticons/effects/ (18px) and items/ (16px), tinted in canvas.
   Copy button: mc-home.js (.mch-copy[data-copy]). Styles: WEB TOOLS in mc-home.css. */
(function () {
  var root = document.getElementById('ptList');
  if (!root) return;

  // [id, name, B/H/N = beneficial/harmful/neutral, colour, old number id,
  //  oldest version group, first version (shown on older groups), Bedrock name ('' = none), instant]
  var FX = [
    ['speed', "Speed", 'B', '33ebff', 1, 0, '', 'speed', 0],
    ['slowness', "Slowness", 'H', '8bafe0', 2, 0, '', 'slowness', 0],
    ['haste', "Haste", 'B', 'd9c043', 3, 0, '', 'haste', 0],
    ['mining_fatigue', "Mining Fatigue", 'H', '4a4217', 4, 0, '', 'mining_fatigue', 0],
    ['strength', "Strength", 'B', 'ffc700', 5, 0, '', 'strength', 0],
    ['instant_health', "Instant Health", 'B', 'f82423', 6, 0, '', 'instant_health', 1],
    ['instant_damage', "Instant Damage", 'H', 'a9656a', 7, 0, '', 'instant_damage', 1],
    ['jump_boost', "Jump Boost", 'B', 'fdff84', 8, 0, '', 'jump_boost', 0],
    ['nausea', "Nausea", 'H', '551d4a', 9, 0, '', 'nausea', 0],
    ['regeneration', "Regeneration", 'B', 'cd5cab', 10, 0, '', 'regeneration', 0],
    ['resistance', "Resistance", 'B', '9146f0', 11, 0, '', 'resistance', 0],
    ['fire_resistance', "Fire Resistance", 'B', 'ff9900', 12, 0, '', 'fire_resistance', 0],
    ['water_breathing', "Water Breathing", 'B', '98dac0', 13, 0, '', 'water_breathing', 0],
    ['invisibility', "Invisibility", 'B', 'f6f6f6', 14, 0, '', 'invisibility', 0],
    ['blindness', "Blindness", 'H', '1f1f23', 15, 0, '', 'blindness', 0],
    ['night_vision', "Night Vision", 'B', 'c2ff66', 16, 0, '', 'night_vision', 0],
    ['hunger', "Hunger", 'H', '587653', 17, 0, '', 'hunger', 0],
    ['weakness', "Weakness", 'H', '484d48', 18, 0, '', 'weakness', 0],
    ['poison', "Poison", 'H', '87a363', 19, 0, '', 'poison', 0],
    ['wither', "Wither", 'H', '736156', 20, 0, '', 'wither', 0],
    ['health_boost', "Health Boost", 'B', 'f87d23', 21, 0, '', 'health_boost', 0],
    ['absorption', "Absorption", 'B', '2552a5', 22, 0, '', 'absorption', 0],
    ['saturation', "Saturation", 'B', 'f82423', 23, 0, '', 'saturation', 1],
    ['glowing', "Glowing", 'N', '94a061', 24, 0, '', '', 0],
    ['levitation', "Levitation", 'H', 'ceffff', 25, 0, '', 'levitation', 0],
    ['luck', "Luck", 'B', '59c106', 26, 0, '', '', 0],
    ['unluck', "Bad Luck", 'H', 'c0a44d', 27, 0, '', '', 0],
    ['slow_falling', "Slow Falling", 'B', 'f3cfb9', 28, 0, '', 'slow_falling', 0],
    ['conduit_power', "Conduit Power", 'B', '1dc2d1', 29, 0, '', 'conduit_power', 0],
    ['dolphins_grace', "Dolphin's Grace", 'B', '88a3be', 30, 0, '', '', 0],
    ['bad_omen', "Bad Omen", 'N', '0b6138', 31, 0, '', 'bad_omen', 0],
    ['hero_of_the_village', "Hero of the Village", 'B', '44ff44', 32, 0, '', 'village_hero', 0],
    ['darkness', "Darkness", 'H', '292721', 33, 0, '1.19', 'darkness', 0],
    ['trial_omen', "Trial Omen", 'N', '16a6a6', 34, 1, '1.21', 'trial_omen', 0],
    ['raid_omen', "Raid Omen", 'N', 'de4058', 35, 1, '1.21', 'raid_omen', 0],
    ['wind_charged', "Wind Charged", 'H', 'bdc9ff', 36, 1, '1.21', 'wind_charged', 0],
    ['weaving', "Weaving", 'H', '78695a', 37, 1, '1.21', 'weaving', 0],
    ['oozing', "Oozing", 'H', '99ffa3', 38, 1, '1.21', 'oozing', 0],
    ['infested', "Infested", 'H', '8c9b8c', 39, 1, '1.21', 'infested', 0],
    ['breath_of_the_nautilus', "Breath of the Nautilus", 'B', '00ffee', 40, 2, '1.21.11', 'breath_of_the_nautilus', 0]
  ].map(function (e) {
    return { id: e[0], name: e[1], cat: e[2], color: e[3], num: e[4], v: e[5], since: e[6], br: e[7], inst: !!e[8] };
  });
  var CATS = [['B', 'Good'], ['H', 'Bad'], ['N', 'Neutral']];
  var TYPES = [
    { id: 'potion', name: 'Potion', base: 'potion_bottle', tint: 'potion_overlay', empty: 'Uncraftable Potion', scale: 1 },
    { id: 'splash_potion', name: 'Splash', base: 'splash_potion', tint: 'potion_overlay', empty: 'Splash Uncraftable Potion', scale: 1 },
    { id: 'lingering_potion', name: 'Lingering', base: 'lingering_potion', tint: 'potion_overlay', empty: 'Lingering Uncraftable Potion', scale: 0.25 },
    { id: 'tipped_arrow', name: 'Tipped Arrow', base: 'tipped_arrow_base', tint: 'tipped_arrow_head', empty: 'Uncraftable Tipped Arrow', scale: 0.125 }
  ];
  var POTENCY = ['', 'II', 'III', 'IV', 'V', 'VI']; // lang/en_us.json potion.potency.0-5
  var WATER = '385dc6';
  var INF = -1;

  var COLORS = {
    white: 'ffffff', gray: 'aaaaaa', dark_gray: '555555', black: '000000',
    red: 'ff5555', dark_red: 'aa0000', gold: 'ffaa00', yellow: 'ffff55',
    green: '55ff55', dark_green: '00aa00', aqua: '55ffff', dark_aqua: '00aaaa',
    blue: '5555ff', dark_blue: '0000aa', light_purple: 'ff55ff', dark_purple: 'aa00aa'
  };

  // fx[id] = { lvl: 1-255, sec: seconds, inf: bool }; order = ids in the order they were added
  // pcolor = the effect cloud's particle colour ('' = the potion's)
  var s = { ver: 2, out: 'give', type: 'potion', fx: {}, order: [], cat: '', parts: 'normal', icon: true, color: '', ncolor: '', pcolor: '' };
  var $ = function (id) { return document.getElementById(id); };

  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function ok(e) { return e.v <= s.ver; }
  function type() { return TYPES.filter(function (t) { return t.id === s.type; })[0]; }
  function picked() {
    return s.order.map(function (id) { return FX.filter(function (e) { return e.id === id; })[0]; })
      .filter(function (e) { return e && s.fx[e.id] && ok(e); });
  }
  function ticks(e) {
    var f = s.fx[e.id];
    if (e.inst) return 1;
    if (f.inf) return INF;
    return Math.max(1, Math.round(f.sec * 20));
  }

  // ---- colour (PotionContents.getColorOptional) ----
  function mix() {
    if (s.color) return s.color;
    if (s.parts === 'none') return WATER;
    return mixOf(picked().map(function (e) { return [e.color, s.fx[e.id].lvl]; }));
  }
  // [[colour hex, level], ..] -> the game's blend
  function mixOf(list) {
    var r = 0, g = 0, b = 0, w = 0;
    list.forEach(function (x) {
      var n = x[1], c = parseInt(x[0], 16);
      r += n * (c >> 16 & 255); g += n * (c >> 8 & 255); b += n * (c & 255); w += n;
    });
    if (!w) return WATER;
    return [r, g, b].map(function (x) { return ('0' + Math.floor(x / w).toString(16)).slice(-2); }).join('');
  }

  // ---- tinted item pictures: base texture over the tinted liquid/head, like the game's layers ----
  var imgs = {};
  function img(name) {
    if (!imgs[name]) {
      imgs[name] = new Image();
      imgs[name].src = '/minecrafticons/items/' + name + '.png';
      imgs[name].onload = paintAll;
    }
    return imgs[name];
  }
  TYPES.forEach(function (t) { img(t.base); img(t.tint); });
  function paint(cv, t, hex) {
    var a = img(t.tint), b = img(t.base);
    if (!a.complete || !b.complete || !a.naturalWidth) return;
    var x = cv.getContext('2d');
    cv.width = 16; cv.height = 16;
    x.clearRect(0, 0, 16, 16);
    x.drawImage(a, 0, 0);
    var d = x.getImageData(0, 0, 16, 16), p = d.data, c = parseInt(hex, 16);
    for (var i = 0; i < p.length; i += 4) {
      p[i] = p[i] * (c >> 16 & 255) / 255;
      p[i + 1] = p[i + 1] * (c >> 8 & 255) / 255;
      p[i + 2] = p[i + 2] * (c & 255) / 255;
    }
    x.putImageData(d, 0, 0);
    x.drawImage(b, 0, 0);
  }
  function paintAll() {
    var hex = mix();
    document.querySelectorAll('canvas[data-paint]').forEach(function (cv) {
      paint(cv, TYPES.filter(function (t) { return t.id === cv.getAttribute('data-paint'); })[0], hex);
    });
  }

  // ---- pickers ----
  var X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var QUICK = [30, 90, 180, 480]; // 0:30 1:30 3:00 8:00, the vanilla brew lengths
  function byId(id) { return FX.filter(function (x) { return x.id === id; })[0]; }
  function lvlName(n) { return n === 1 ? 'I' : POTENCY[n - 1] || String(n); }
  // m:ss for the time field; keeps a .5 when a brew has one (Regeneration II = 0:22.5)
  function mmss(sec) {
    var m = Math.floor(sec / 60), x = Math.round((sec - m * 60) * 100) / 100;
    return m + ':' + (x < 10 ? '0' : '') + x;
  }
  function parseTime(v) {
    v = String(v).trim();
    if (!v) return NaN;
    if (v.indexOf(':') < 0) return parseFloat(v);
    var p = v.split(':').map(parseFloat);
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  }

  function drawTypes() {
    $('ptType').innerHTML = TYPES.map(function (t) {
      return '<button type="button" class="pt-slot pt-slot--item" data-type="' + t.id + '" aria-pressed="' + (t.id === s.type) + '">' +
        '<canvas data-paint="' + t.id + '" width="16" height="16" aria-hidden="true"></canvas><span>' + t.name + '</span></button>';
    }).join('');
  }
  function mineRow(e) {
    var f = s.fx[e.id];
    var time = e.inst
      ? '<span class="pt-instant">Instant, happens once</span>'
      : '<div class="pt-time"><input class="pt-input pt-time-in" type="text" inputmode="decimal" value="' + (f.inf ? '' : mmss(f.sec)) + '" placeholder="' + (f.inf ? '∞' : 'm:ss') + '" data-k="sec" aria-label="' + e.name + ' time, minutes and seconds"' + (f.inf ? ' disabled' : '') + '>' +
        '<div class="pt-quick">' + QUICK.map(function (q) {
          return '<button type="button" data-q="' + q + '" aria-pressed="' + (!f.inf && f.sec === q) + '">' + mmss(q) + '</button>';
        }).join('') + '<button type="button" data-q="inf" aria-pressed="' + f.inf + '" aria-label="Infinite">∞</button></div></div>';
    return '<li class="pt-mine-row is-' + e.cat + '" data-fx="' + e.id + '">' +
      '<span class="pt-slot pt-slot--icon" aria-hidden="true"><img src="/minecrafticons/effects/' + e.id + '.png" alt=""></span>' +
      '<div class="pt-mine-name"><b>' + e.name + ' <em>' + lvlName(f.lvl) + '</em></b><small>' + { B: 'Good', H: 'Bad', N: 'Neutral' }[e.cat] + (e.since ? ' · ' + e.since + '+' : '') + '</small></div>' +
      '<div class="pt-ctl"><div class="pt-step" role="group" aria-label="' + e.name + ' level"><button type="button" data-step="-1" aria-label="Lower level"' + (f.lvl <= 1 ? ' disabled' : '') + '>−</button>' +
      '<input class="pt-input" type="number" min="1" max="255" value="' + f.lvl + '" data-k="lvl" aria-label="' + e.name + ' level, 1 to 255"><button type="button" data-step="1" aria-label="Raise level"' + (f.lvl >= 255 ? ' disabled' : '') + '>+</button></div>' +
      time + '</div>' +
      '<button type="button" class="pt-remove" data-remove aria-label="Remove ' + e.name + '">' + X + '</button></li>';
  }
  function drawMine() {
    var list = picked();
    $('ptMine').innerHTML = list.length ? list.map(mineRow).join('')
      : '<li class="pt-empty"><span class="pt-slot pt-slot--icon" aria-hidden="true"><img src="/minecrafticons/items/potion_bottle.png" alt=""></span><div><b>No effects yet</b><small>Click an effect below to add it.</small></div></li>';
    $('ptPicked').textContent = list.length || '';
    $('ptClear').hidden = !list.length;
  }
  function drawFx() {
    var q = ($('ptFind').value || '').trim().toLowerCase();
    var html = CATS.filter(function (c) { return !s.cat || s.cat === c[0]; }).map(function (c) {
      var list = FX.filter(function (e) { return e.cat === c[0] && ok(e) && (!q || e.name.toLowerCase().indexOf(q) > -1); });
      if (!list.length) return '';
      return '<div class="pt-group"><h5 class="pt-group-h">' + c[1] + ' <span>' + list.length + '</span></h5><div class="pt-slots pt-grid">' + list.map(function (e) {
        var on = !!s.fx[e.id];
        return '<button type="button" class="pt-slot pt-slot--fx" data-add="' + e.id + '" aria-pressed="' + on + '">' +
          (e.since && e.v === s.ver ? '<em class="pt-since">' + e.since + '+</em>' : '') +
          '<img src="/minecrafticons/effects/' + e.id + '.png" alt=""><span>' + e.name + '</span></button>';
      }).join('') + '</div></div>';
    }).join('');
    $('ptList').innerHTML = html || '<p class="pt-nofind">No effect matches “' + esc(q) + '”.</p>';
  }
  function drawColors() {
    $('ptNameColor').innerHTML = '<button type="button" class="pt-sw pt-sw--none" data-ncolor="" aria-pressed="true" aria-label="White, the default">Aa</button>' +
      Object.keys(COLORS).map(function (c) {
        return '<button type="button" class="pt-sw" data-ncolor="' + c + '" aria-pressed="false" aria-label="' + c.replace('_', ' ') + '" title="' + c.replace('_', ' ') + '" style="background:#' + COLORS[c] + '"></button>';
      }).join('');
  }

  // ---- commands ----
  function sq(t) { return "'" + t.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
  function sbyte(n) { return (n > 127 ? n - 256 : n) + 'b'; }
  // One effect, old NBT (1.14 - 1.20.4: Id number up to 1.20.1, id name from 1.20.2, both written)
  function effOld(e) {
    var t = ticks(e), o = ['Id:' + e.num + 'b', 'id:"minecraft:' + e.id + '"'];
    if (s.fx[e.id].lvl > 1) o.push('Amplifier:' + sbyte(s.fx[e.id].lvl - 1));
    o.push('Duration:' + (t === INF ? 2147483647 : t));
    if (s.parts === 'faint') o.push('Ambient:1b');
    if (s.parts === 'none') o.push('ShowParticles:0b');
    if (!s.icon) o.push('ShowIcon:0b');
    return '{' + o.join(',') + '}';
  }
  // potion_contents fields (1.20.5+): the bottle colour and the effects
  function contents() {
    var pc = [], list = picked();
    if (s.color) pc.push('custom_color:' + parseInt(s.color, 16));
    if (list.length) pc.push('custom_effects:[' + list.map(function (e) {
      var o = ['id:"minecraft:' + e.id + '"'];
      if (s.fx[e.id].lvl > 1) o.push('amplifier:' + (s.fx[e.id].lvl - 1));
      o.push('duration:' + ticks(e));
      if (s.parts === 'faint') o.push('ambient:true');
      if (s.parts === 'none') o.push('show_particles:false');
      if (!s.icon) o.push('show_icon:false');
      return '{' + o.join(',') + '}';
    }).join(',') + ']');
    return pc;
  }
  // ---- effect cloud (Oct 19): the one thing in the game whose particle colour is its own setting ----
  // A summoned area_effect_cloud gives its effects to whatever stands in it. Its swirls are entity_effect
  // particles: custom_particle (1.21.5+) / Particle (1.20.5+) take any colour; before 1.20.5, Color did.
  function rgbF(hex) { var n = parseInt(hex, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { return +(v / 255).toFixed(3) + 'f'; }).join(','); }
  function cloudCmd() {
    var r = Math.min(32, Math.max(0.5, +$('ptRadius').value || 3)), sec = Math.max(1, +$('ptCloudSec').value || 30), list = picked();
    var d = ['Radius:' + r + 'f', 'Duration:' + Math.min(2147483647, Math.round(sec * 20))];
    if (s.ver === 0) {
      if (list.length) d.push('Effects:[' + list.map(effOld).join(',') + ']');
      if (s.pcolor || s.color) d.push('Color:' + parseInt(s.pcolor || s.color, 16));
    } else {
      var pc = contents();
      if (pc.length) d.push('potion_contents:{' + pc.join(',') + '}');
      if (s.pcolor) d.push((s.ver === 2 ? 'custom_particle' : 'Particle') + ':{type:"minecraft:entity_effect",color:[' + rgbF(s.pcolor) + ',1f]}');
    }
    return '/summon minecraft:area_effect_cloud ~ ~ ~ {' + d.join(',') + '}';
  }
  function giveCmd() {
    var name = $('ptName').value.trim();
    var lore = $('ptLore').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var nameObj = { text: name, italic: false };
    if (s.ncolor) nameObj.color = s.ncolor;
    var loreObj = lore.map(function (l) { return JSON.stringify({ text: l, italic: false }); });
    var list = picked();
    var col = s.color ? parseInt(s.color, 16) : 0;
    var item;

    if (s.ver === 0) {
      var parts = [];
      if (list.length) parts.push('CustomPotionEffects:[' + list.map(effOld).join(',') + ']');
      if (s.color) parts.push('CustomPotionColor:' + col);
      var disp = [];
      if (name) disp.push('Name:' + sq(JSON.stringify(nameObj)));
      if (lore.length) disp.push('Lore:[' + loreObj.map(sq).join(',') + ']');
      if (disp.length) parts.push('display:{' + disp.join(',') + '}');
      item = 'minecraft:' + s.type + (parts.length ? '{' + parts.join(',') + '}' : '');
    } else {
      var pc = contents();
      var comps = [];
      if (pc.length) comps.push('potion_contents={' + pc.join(',') + '}');
      if (name) comps.push('custom_name=' + (s.ver === 2 ? JSON.stringify(nameObj) : sq(JSON.stringify(nameObj))));
      if (lore.length) comps.push('lore=[' + (s.ver === 2 ? loreObj : loreObj.map(sq)).join(',') + ']');
      item = 'minecraft:' + s.type + (comps.length ? '[' + comps.join(',') + ']' : '');
    }
    var n = Math.min(64, Math.max(1, parseInt($('ptCount').value, 10) || 1));
    return '/give ' + $('ptTarget').value + ' ' + item + (n > 1 ? ' ' + n : '');
  }
  function effectSecs(e, max) {
    var f = s.fx[e.id];
    if (e.inst) return '1';
    if (f.inf) return max ? String(max) : 'infinite';
    return String(Math.max(1, Math.round(f.sec)));
  }
  // Java: /effect give <targets> <effect> [seconds|infinite] [amplifier] [hideParticles]
  // "infinite" arrived in 1.19.4, so the 1.14 group uses the 1000000 second cap.
  function javaCmd() {
    return picked().map(function (e) {
      var c = '/effect give ' + $('ptTarget').value + ' minecraft:' + e.id + ' ' + effectSecs(e, s.ver === 0 ? 1000000 : 0) + ' ' + (s.fx[e.id].lvl - 1);
      return c + (s.parts === 'none' ? ' true' : '');
    }).join('\n');
  }
  // Bedrock: /effect <player> <effect> <seconds|infinite> [amplifier] [hideParticles]
  function bedrockCmd() {
    return picked().filter(function (e) { return e.br; }).map(function (e) {
      var c = '/effect ' + $('ptTarget').value + ' ' + e.br + ' ' + effectSecs(e, 0) + ' ' + (s.fx[e.id].lvl - 1);
      return c + (s.parts === 'none' ? ' true' : '');
    }).join('\n');
  }

  // ---- tooltip (PotionContents.addPotionTooltip, StringUtil.formatTickDuration) ----
  function clock(t) {
    if (t === INF) return '∞';
    var sec = Math.floor(t / 20), h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, x = sec % 60;
    var mm = (h ? ('0' + m).slice(-2) : m) + ':' + ('0' + x).slice(-2);
    return h ? h + ':' + mm : mm;
  }
  function tipLine(e) {
    var amp = s.fx[e.id].lvl - 1;
    var txt = e.name + (amp ? ' ' + (POTENCY[amp] || 'potion.potency.' + amp) : '');
    if (!e.inst) {
      var t = ticks(e);
      txt += ' (' + clock(t === INF ? INF : Math.floor(t * type().scale)) + ')';
    }
    return '<span class="' + (e.cat === 'H' ? 'is-curse' : 'is-unb') + '">' + esc(txt) + '</span>';
  }

  function render() {
    var list = picked();
    var hex = mix();
    var out = s.out === 'give' ? giveCmd() : s.out === 'cloud' ? cloudCmd() : s.out === 'java' ? javaCmd() : bedrockCmd();
    $('ptCmd').textContent = out || (list.length ? 'None of these effects exist on Bedrock.' : 'Add an effect to get a command.');
    $('ptCmd').classList.toggle('is-empty', !out);
    $('ptCopy').setAttribute('data-copy', out);
    $('ptCopy').disabled = !out;
    var lines = out ? out.split('\n') : [];
    var longest = Math.max.apply(null, lines.map(function (l) { return l.length; }).concat(0));
    $('ptMeta').innerHTML = !out ? '' : (s.out === 'give' || s.out === 'cloud' ? out.length + ' characters' : lines.length + (lines.length === 1 ? ' command' : ' commands')) +
      (longest > 256 ? ' <span class="mch-term-flags"><em class="is-block">Command block only</em></span>' : '');
    $('ptHex').textContent = '#' + hex;
    $('ptPHex').textContent = '#' + (s.pcolor || hex);
    // while a colour is automatic its box shows the mix too, so the picker opens on the colour in use
    if (!s.color) $('ptColor').value = '#' + hex;
    if (!s.pcolor) $('ptPColor').value = '#' + hex;

    var name = $('ptName').value.trim();
    var tip = '<div><b style="color:#' + (COLORS[s.ncolor] || 'ffffff') + '">' + esc(name || type().empty) + '</b>';
    tip += list.length ? list.map(tipLine).join('') : '<span class="pt-none">No Effects</span>';
    tip += $('ptLore').value.split('\n').filter(function (l) { return l.trim(); }).map(function (l) {
      return '<span class="is-lore">' + esc(l.trim()) + '</span>';
    }).join('');
    $('ptTip').innerHTML = tip + '</div>';
    document.querySelector('.pt-big').setAttribute('data-paint', s.type);
    paintAll();

    var notes = [];
    if (s.out === 'give' && type().scale < 1) notes.push(type().id === 'tipped_arrow' ? 'An arrow passes on 1/8 of each time, so the tooltip shows the shorter time.' : 'A lingering cloud passes on 1/4 of each time, so the tooltip shows the shorter time.');
    if (s.out === 'give' && s.parts === 'none' && !s.color && list.length) notes.push('With particles off the game mixes no colour, so the bottle stays water blue. Pick a colour to change it.');
    if (s.out === 'give' && /splash|lingering/.test(s.type) && list.length) notes.push('Its splash' + (s.type === 'lingering_potion' ? ' and cloud' : '') + ' use the bottle colour. For particles in a colour of their own, make an Effect cloud.');
    if (s.out === 'cloud') notes.push('Players and mobs standing in the cloud get its effects until it runs out.');
    if (s.out === 'cloud' && s.pcolor && s.ver === 0) notes.push('Before 1.20.5 the cloud has one colour, so the particle colour is used for it.');
    if (s.out === 'give' && !name && list.length) notes.push('Without a name the game calls it ' + type().empty + '.');
    if (s.out === 'give' && list.some(function (e) { return s.fx[e.id].lvl > 6; })) notes.push('The game has no numeral above VI, so higher levels show as potion.potency.N in the tooltip.');
    if ((s.out === 'java' || s.out === 'bedrock') && list.length) notes.push('Run each line on its own, or put one in each command block. /effect can\'t make particles faint or hide the icon.');
    if (s.out === 'bedrock') {
      var skip = list.filter(function (e) { return !e.br; });
      if (skip.length) notes.push(skip.map(function (e) { return e.name; }).join(', ') + ' ' + (skip.length > 1 ? 'are' : 'is') + ' Java only, so ' + (skip.length > 1 ? 'they are' : 'it is') + ' left out.');
    }
    if (s.out === 'java' && s.ver === 0 && list.some(function (e) { return s.fx[e.id].inf; })) notes.push('Infinite is written as 1000000 seconds here, because the word "infinite" only works from 1.19.4.');
    $('ptNote').innerHTML = notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
  }
  function refresh() { drawMine(); drawFx(); render(); }

  // ---- events ----
  function press(box, attr, val) {
    box.querySelectorAll('[' + attr + ']').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute(attr) === val));
    });
  }
  function chips(id, attr, key, after) {
    $(id).addEventListener('click', function (e) {
      var b = e.target.closest('[' + attr + ']');
      if (!b) return;
      var v = b.getAttribute(attr);
      s[key] = key === 'ver' ? +v : v;
      press(this, attr, v);
      if (after) after();
      render();
    });
  }
  // data-give-only: the potion item only, unless it also has data-cloud. data-cloud-only / data-no-cloud: the cloud.
  function setOut() {
    document.querySelectorAll('[data-give-only]').forEach(function (el) { el.hidden = !(s.out === 'give' || s.out === 'cloud' && el.hasAttribute('data-cloud')); });
    document.querySelectorAll('[data-cloud-only]').forEach(function (el) { el.hidden = s.out !== 'cloud'; });
    document.querySelectorAll('[data-no-cloud]').forEach(function (el) { el.hidden = s.out === 'cloud'; });
    if (s.out !== 'give' && s.out !== 'cloud' && s.parts === 'faint') { s.parts = 'normal'; press($('ptParts'), 'data-parts', 'normal'); }
    $('ptVer').hidden = s.out === 'bedrock';
    $('ptVerK').hidden = s.out !== 'bedrock';
  }
  chips('ptOut', 'data-out', 'out', setOut);
  chips('ptVer', 'data-ver', 'ver', function () {
    s.order = s.order.filter(function (id) { return ok(byId(id)); });
    FX.forEach(function (e) { if (!ok(e)) delete s.fx[e.id]; });
    drawMine(); drawFx();
  });
  chips('ptParts', 'data-parts', 'parts');
  chips('ptNameColor', 'data-ncolor', 'ncolor');
  $('ptCat').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]');
    if (!b) return;
    s.cat = b.getAttribute('data-cat');
    press(this, 'data-cat', s.cat);
    drawFx();
  });
  $('ptFind').addEventListener('input', drawFx);
  $('ptType').addEventListener('click', function (e) {
    var b = e.target.closest('[data-type]');
    if (!b) return;
    s.type = b.getAttribute('data-type');
    press(this, 'data-type', s.type);
    render();
  });
  function toggle(id) {
    if (s.fx[id]) {
      delete s.fx[id];
      s.order = s.order.filter(function (x) { return x !== id; });
    } else {
      s.fx[id] = { lvl: 1, sec: 180, inf: false };
      s.order.push(id);
    }
  }
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (!b) return;
    toggle(b.getAttribute('data-add'));
    refresh();
    // Keyboard and screen-reader users stay on the slot they pressed.
    var again = root.querySelector('[data-add="' + b.getAttribute('data-add') + '"]');
    if (again) again.focus();
  });
  // Rows in "Your potion": redraw just that row so typing keeps its place.
  function redrawRow(li, id, focusSel) {
    var html = mineRow(byId(id));
    li.insertAdjacentHTML('afterend', html);
    var fresh = li.nextElementSibling;
    li.remove();
    if (focusSel) { var f = fresh.querySelector(focusSel); if (f) f.focus(); }
    render();
  }
  $('ptMine').addEventListener('click', function (e) {
    var li = e.target.closest('[data-fx]');
    if (!li) return;
    var id = li.getAttribute('data-fx'), f = s.fx[id], b;
    if ((b = e.target.closest('[data-remove]'))) { toggle(id); refresh(); return; }
    if ((b = e.target.closest('[data-step]'))) {
      f.lvl = Math.min(255, Math.max(1, f.lvl + +b.getAttribute('data-step')));
      return redrawRow(li, id, '[data-step="' + b.getAttribute('data-step') + '"]:not(:disabled)');
    }
    if ((b = e.target.closest('[data-q]'))) {
      var q = b.getAttribute('data-q');
      if (q === 'inf') f.inf = !f.inf;
      else { f.inf = false; f.sec = +q; }
      return redrawRow(li, id, '[data-q="' + q + '"]');
    }
  });
  $('ptMine').addEventListener('change', function (e) {
    var li = e.target.closest('[data-fx]');
    if (!li) return;
    var id = li.getAttribute('data-fx'), f = s.fx[id], k = e.target.getAttribute('data-k');
    if (k === 'lvl') f.lvl = Math.min(255, Math.max(1, parseInt(e.target.value, 10) || 1));
    if (k === 'sec') {
      var t = parseTime(e.target.value);
      if (t > 0) f.sec = Math.min(1000000, Math.max(0.05, t));
    }
    redrawRow(li, id);
  });
  $('ptClear').addEventListener('click', function () { s.fx = {}; s.order = []; refresh(); });
  $('ptAuto').addEventListener('change', function () {
    s.color = this.checked ? '' : $('ptColor').value.slice(1);
    render();
  });
  $('ptColor').addEventListener('input', function () {
    $('ptAuto').checked = false;
    s.color = this.value.slice(1);
    render();
  });
  $('ptPAuto').addEventListener('change', function () {
    s.pcolor = this.checked ? '' : $('ptPColor').value.slice(1);
    render();
  });
  $('ptPColor').addEventListener('input', function () {
    $('ptPAuto').checked = false;
    s.pcolor = this.value.slice(1);
    render();
  });
  $('ptIcon').addEventListener('change', function () { s.icon = this.checked; render(); });
  ['ptName', 'ptLore', 'ptCount', 'ptTarget', 'ptRadius', 'ptCloudSec'].forEach(function (id) {
    $(id).addEventListener('input', render);
  });

  drawTypes(); drawColors(); refresh();
})();
