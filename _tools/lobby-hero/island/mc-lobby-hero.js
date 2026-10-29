/* Minecraft lobby hero (Oct 28 2026). Wandy T., our wandering trader, at his stall on a floating island
   with his two trader llamas, drawn live in three.js. mc-mob3d.js (MobView.lib) lends three.js and the
   mob builder; the blocks are the game's own textures (minecrafticons/blocks) drawn with the same flat face
   light the mobs use (top 1, sides 0.8 / 0.6, bottom 0.5), so the two match. Units = pixels, 1 block = 16.
   The model faces -z, so the camera sits on the -z side.

   Behind it (CSS) = a blurred photo of Adrian's Hardcore Parcore at sunset (_tools/lobby-hero/bg.py), so fog,
   grade and clouds are that photo's gold; loose chunks and falling crumbs sell the float.
   Also here: Wandy's lines in the hero's chat strip (#mlLine) and the title screen's splash (#mlSplash).
   Nothing 3D loads until the page has finished loading; the still picture (.ml-poster) shows until the
   scene's textures are all in, and stays for good if WebGL is missing. */
(function () {
  var hero = document.getElementById('mlHero');
  if (!hero) return;
  var REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------- dialogue ----------------
  // Voice (Adrian, Oct 28 2026): a quiet drifter who has walked every biome. Mostly atmosphere and plain
  // help, a short joke only where it fits. Keep each line to the bubble's 2 lines.
  var LINES = [
    'I have walked every world on this page. A few of them walked back.',
    'Seeds remember where they were planted. I only read them.',
    'The llamas carry the shaders. Do not ask what I carry.',
    'Nothing here costs emeralds. Strange times.',
    'I arrive at dusk and leave before you find the good stuff yourself.',
    'Every button below opens a road. I have walked all of them.'
  ];
  var line = document.getElementById('mlLine'), li = 0;
  // one .mcf canvas: set its text and redraw it in the game font (mc-lobby.js lends window.mcfDraw)
  function setMc(el, text) { el.setAttribute('data-mc', text); if (window.mcfDraw) window.mcfDraw(el); }
  function say(text) {
    line.classList.add('is-out');
    setTimeout(function () { setMc(line, '<Wandy T.> ' + text); line.classList.remove('is-out'); }, REDUCE ? 0 : 220);
  }
  // splash text, one per visit like the game's (loud, a wink at Wandy; max ~16 letters or it runs into the title)
  var SPLASH = ['Llamas included!', 'Free trades!', 'Now at dusk!', '0 emeralds!', 'Llama approved!', '100% blocky!', 'Hand-picked!', 'Still floating!'];
  var splash = document.getElementById('mlSplash');
  if (splash) setMc(splash, SPLASH[Math.floor(Math.random() * SPLASH.length)]);
  if (line && !REDUCE) setInterval(function () {
    if (document.hidden) return;
    li = (li + 1) % LINES.length;
    say(LINES[li]);
  }, 7000);

  // ---------------- scene ----------------
  var canvas = document.getElementById('mlScene');
  var scene = {};
  if (!canvas || !window.MobView) return;
  function boot() {
    try { var t = document.createElement('canvas'); if (!(t.getContext('webgl2') || t.getContext('webgl'))) return; } catch (e) { return; }
    MobView.lib(build);
  }
  // after the page's own load (or 2.5 s: a slow outside image mustn't hold Wandy back)
  var booted = false;
  function once() { if (!booted) { booted = true; boot(); } }
  if (document.readyState === 'complete') setTimeout(once, 50);
  else { addEventListener('load', function () { setTimeout(once, 150); }); setTimeout(once, 2500); }

  function build(api) {
    var THREE = api.THREE, V = THREE.Vector3;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true }); } catch (e) { return; }
    var PHONE = matchMedia('(max-width: 970px)');
    renderer.setPixelRatio(Math.min(PHONE.matches ? 1.5 : 2, window.devicePixelRatio || 1));
    var sc = new THREE.Scene();
    sc.fog = new THREE.Fog(0x46351c, 700, 1500); // the backdrop photo's mid tone
    var camera = new THREE.PerspectiveCamera(28, 1, 1, 4000);
    var world = new THREE.Group(); sc.add(world);
    var island = new THREE.Group(); world.add(island);

    // ---- textures: layers drawn in order, each multiplied by its tint (grass + leaves are grey in the files) ----
    var waiting = 0, T = {}, imgs = {};
    function img(src) {
      return imgs[src] || (imgs[src] = new Promise(function (res) {
        var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src;
      }));
    }
    function tex(layers) {
      var k = JSON.stringify(layers);
      if (T[k]) return T[k];
      var c = document.createElement('canvas'); c.width = c.height = 16;
      var t = new THREE.CanvasTexture(c);
      t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
      waiting++;
      Promise.all(layers.map(function (l) { return img('/minecrafticons/' + l[0] + '.png'); })).then(function (ims) {
        var x = c.getContext('2d');
        ims.forEach(function (im, i) {
          if (!im) return;
          if (i === 0 && im.width !== 16) { c.width = im.width; c.height = im.width; } // animated strips: the first frame
          var tint = layers[i][1];
          if (!tint) { x.drawImage(im, 0, 0, c.width, c.width, 0, 0, c.width, c.width); return; }
          var l = document.createElement('canvas'); l.width = l.height = c.width;
          var lx = l.getContext('2d');
          lx.drawImage(im, 0, 0, c.width, c.width, 0, 0, c.width, c.width);
          lx.globalCompositeOperation = 'multiply'; lx.fillStyle = tint; lx.fillRect(0, 0, c.width, c.width);
          lx.globalCompositeOperation = 'destination-in'; lx.drawImage(im, 0, 0, c.width, c.width, 0, 0, c.width, c.width);
          x.drawImage(l, 0, 0);
        });
        t.needsUpdate = true;
        waiting--;
      });
      return (T[k] = t);
    }
    var mats = {};
    function mat(layers, cut) {
      var k = JSON.stringify(layers);
      return mats[k] || (mats[k] = new THREE.MeshBasicMaterial({ map: tex(layers), vertexColors: true, alphaTest: cut ? 0.5 : 0, transparent: false, side: cut ? THREE.DoubleSide : THREE.FrontSide }));
    }

    // ---- blocks ----
    var GRASS = '#86b85a', FOLIAGE = '#5e9a32';
    function all(t) { return { up: t, side: t, down: t }; }
    var BT = {
      grass: { up: [['blocks/grass_block_top', GRASS]], side: [['blocks/grass_block_side'], ['blocks/grass_block_side_overlay', GRASS]], down: [['blocks/dirt']] },
      dirt: all([['blocks/dirt']]),
      coarse: all([['blocks/coarse_dirt']]),
      stone: all([['blocks/stone']]),
      cobble: all([['blocks/cobblestone']]),
      coal: all([['blocks/coal_ore']]),
      iron: all([['blocks/iron_ore']]),
      path: { up: [['blocks/dirt_path_top']], side: [['blocks/dirt_path_side']], down: [['blocks/dirt']], low: 1 },
      log: { up: [['blocks/oak_log_top']], side: [['blocks/oak_log']], down: [['blocks/oak_log_top']] },
      post: { up: [['blocks/spruce_log_top']], side: [['blocks/spruce_log']], down: [['blocks/spruce_log_top']] },
      planks: all([['blocks/spruce_planks']]),
      barrel: { up: [['blocks/barrel_top']], side: [['blocks/barrel_side']], down: [['blocks/barrel_bottom']] },
      hay: { up: [['blocks/hay_block_top']], side: [['blocks/hay_block_side']], down: [['blocks/hay_block_top']] },
      leaves: Object.assign(all([['blocks/oak_leaves', FOLIAGE]]), { cut: 1 }),
      red: all([['blocks/red_wool']]),
      white: all([['blocks/white_wool']])
    };
    var SHADE = { up: 1, down: 0.5, north: 0.8, south: 0.8, east: 0.6, west: 0.6 };
    var DIRS = { up: [0, 1, 0], down: [0, -1, 0], north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0] };
    function corners(f, a, b) {
      var x0 = a[0], y0 = a[1], z0 = a[2], x1 = b[0], y1 = b[1], z1 = b[2];
      return {
        north: [[x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0]],
        south: [[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]],
        east: [[x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1]],
        west: [[x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0]],
        up: [[x1, y1, z1], [x0, y1, z1], [x0, y1, z0], [x1, y1, z0]],
        down: [[x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1]]
      }[f];
    }
    var UVQ = [[0, 1], [1, 1], [1, 0], [0, 0]];
    // vox: {"x,y,z": type}; one mesh per face texture, faces between two solid blocks left out
    function voxels(vox, into, box) {
      var by = {};
      Object.keys(vox).forEach(function (key) {
        var p = key.split(',').map(Number), t = vox[key], d = BT[t];
        var a = [p[0] * 16, p[1] * 16, p[2] * 16], b = [a[0] + 16, a[1] + 16 - (d.low || 0), a[2] + 16];
        if (box) { a = box[0]; b = box[1]; }
        // below the surface the island darkens with depth (it hangs in the dusk)
        var dim = p[1] >= 0 ? 1 : Math.max(0.22, 1 + (p[1] + 1) * 0.16);
        Object.keys(DIRS).forEach(function (f) {
          var o = DIRS[f], n = vox[(p[0] + o[0]) + ',' + (p[1] + o[1]) + ',' + (p[2] + o[2])];
          // a face stays when its neighbour is see-through (leaves) or a path (1 px lower: the grass beside it shows an edge)
          if (n && !box && (BT[n].cut ? n === t : !BT[n].low || d.low) && !(f === 'up' && d.low)) return;
          var layers = d[f === 'up' || f === 'down' ? f : 'side'], mk = JSON.stringify(layers) + (d.cut ? 'c' : '');
          var g = by[mk] || (by[mk] = { layers: layers, cut: d.cut, pos: [], uv: [], col: [] });
          var k = corners(f, a, b), s = SHADE[f] * (f === 'up' ? 1 : dim);
          // corners run clockwise seen from outside; three.js keeps counter-clockwise faces, so each triangle goes 0-2-1
          [0, 2, 1, 0, 3, 2].forEach(function (i) {
            g.pos.push(k[i][0], k[i][1], k[i][2]);
            // side faces of a short block (path): the texture's bottom 15 rows (its top row is empty in the file)
            var v = UVQ[i][1];
            if (f !== 'up' && f !== 'down' && d.low && v === 1) v = 1 - d.low / 16;
            g.uv.push(UVQ[i][0], v);
            g.col.push(s, s, s);
          });
        });
      });
      Object.keys(by).forEach(function (mk) {
        var g = by[mk], geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
        into.add(new THREE.Mesh(geo, mat(g.layers, g.cut)));
      });
    }

    // ---- the island: a hand-placed footprint, tapering into a rough point of dirt and stone ----
    // Seen from the camera (on the -z side), +x is screen-LEFT: hay on the left, the llamas and the oak behind them right.
    var vox = {};
    function put(x, y, z, t) { vox[x + ',' + y + ',' + z] = t; }
    function hash(x, z, s) { var h = Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); }
    var LAYERS = [[4.7, 3.9], [4.0, 3.2], [3.2, 2.5], [2.3, 1.8], [1.4, 1.1], [0.6, 0.5]];
    LAYERS.forEach(function (r, i) {
      var y = -1 - i;
      for (var x = -6; x <= 6; x++) for (var z = -5; z <= 5; z++) {
        var cx = x + 0.5, cz = z + 0.2, e = (cx * cx) / (r[0] * r[0]) + (cz * cz) / (r[1] * r[1]);
        if (e > 1 + (hash(x, z, i) - 0.5) * 0.4) continue;
        var t = i === 0 ? 'grass' : i === 1 ? (hash(x, z, 9) < 0.15 ? 'coarse' : 'dirt') : i === 2 ? (hash(x, z, 8) < 0.5 ? 'dirt' : 'stone') : 'stone';
        if (t === 'stone') { var hh = hash(x, z, i + 20); t = hh < 0.1 ? 'coal' : hh < 0.16 ? 'iron' : hh < 0.3 ? 'cobble' : 'stone'; }
        put(x, y, z, t);
      }
    });
    // path from the front edge up to Wandy
    [[0, -4], [0, -3], [-1, -3], [0, -2], [1, -2], [0, -1], [-1, -1], [1, -1]].forEach(function (p) {
      if (vox[p[0] + ',-1,' + p[1]]) put(p[0], -1, p[1], 'path');
    });
    // the stall behind him: spruce posts, a counter (barrel + planks), a striped wool awning (below)
    put(-2, 0, 1, 'post'); put(-2, 1, 1, 'post'); put(-2, 2, 1, 'post');
    put(1, 0, 1, 'post'); put(1, 1, 1, 'post'); put(1, 2, 1, 'post');
    put(-1, 0, 1, 'barrel'); put(0, 0, 1, 'planks'); put(-1, 0, 2, 'barrel');
    // hay for the llamas; an oak behind the stall
    put(3, 0, 1, 'hay'); put(3, 0, 2, 'hay'); put(3, 1, 2, 'hay');
    for (var ty = 0; ty < 4; ty++) put(-3, ty, 2, 'log');
    for (var lx = -5; lx <= -1; lx++) for (var lz = 0; lz <= 4; lz++) for (var ly = 3; ly <= 4; ly++) {
      if (lx >= -2 && ly === 3 && lz <= 3) continue; // clear of the awning
      var corner = (lx === -5 || lx === -1) && (lz === 0 || lz === 4);
      if (corner && hash(lx, lz, ly) < 0.75) continue;
      if (!vox[lx + ',' + ly + ',' + lz]) put(lx, ly, lz, 'leaves');
    }
    for (lx = -4; lx <= -2; lx++) for (lz = 1; lz <= 3; lz++) put(lx, 5, lz, 'leaves');
    put(-3, 6, 2, 'leaves'); put(-3, 6, 3, 'leaves'); put(-2, 6, 2, 'leaves');
    voxels(vox, island);

    // awning: red/white wool stripes in three 4 px steps, like a player builds a slope (blocks can't tilt):
    // the middle row rests on the posts (top at 48), the front row hangs a step lower in front of them, the back row a step up
    var awn = new THREE.Group();
    [[0, 44], [1, 48], [2, 52]].forEach(function (row) {
      for (var ax = -2; ax <= 1; ax++) {
        var one = {}, z = row[0] * 16; one[ax + ',0,' + row[0]] = (ax & 1) ? 'white' : 'red';
        voxels(one, awn, [[ax * 16, row[1], z], [ax * 16 + 16, row[1] + 4, z + 16]]);
      }
    });
    island.add(awn);

    // ---- flat sprites: plants on the grass, wares on the counter ----
    function plane(src, size, cut) {
      var g = new THREE.PlaneGeometry(size, size);
      var m = new THREE.MeshBasicMaterial({ map: tex([[src]]), alphaTest: 0.5, side: THREE.DoubleSide });
      m.color.setScalar(cut || 0.9);
      return new THREE.Mesh(g, m);
    }
    function plant(src, x, z) {
      var g = new THREE.Group();
      [Math.PI / 4, -Math.PI / 4].forEach(function (r) { var p = plane(src, 16); p.rotation.y = r; g.add(p); });
      g.position.set(x * 16 + 8, 8, z * 16 + 8);
      island.add(g);
    }
    [['items/short_grass', 2, -2], ['items/poppy', 3, -1], ['items/dandelion', -2, -3], ['items/cornflower', 2, -3], ['items/short_grass', -3, -2],
     ['items/fern', -4, 0], ['items/firefly_bush', -4, 3], ['items/short_grass', 4, 0], ['items/poppy', -1, -4], ['items/short_grass', 1, -4]
    ].forEach(function (p) { if (vox[p[1] + ',-1,' + p[2]] === 'grass' && !vox[p[1] + ',0,' + p[2]]) plant(p[0], p[1], p[2]); });
    [['items/emerald', -0.3], ['items/potion', 0.45]].forEach(function (w) {
      var p = plane(w[0], 9, 1); p.position.set(w[1] * 16, 20.5, 16 + 6); p.rotation.y = Math.PI; island.add(p);
    });

    // ---- glow: one soft sprite, reused by the sun, the lantern and the fireflies ----
    function glowTex(rgb) {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(' + rgb + ',1)'); g.addColorStop(0.25, 'rgba(' + rgb + ',0.45)'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    }
    function glow(t, size, op) {
      var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op == null ? 1 : op, fog: false }));
      s.scale.set(size, size, 1); return s;
    }
    var WARM = glowTex('255,190,110');
    // lantern hanging under the awning's front edge
    var lantern = new THREE.Group(), dark = new THREE.MeshBasicMaterial({ color: 0x2b2b30 });
    var core = new THREE.Mesh(new THREE.BoxGeometry(4.4, 5, 4.4), new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }));
    var cap = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 6), dark), base = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 6), dark);
    var chain = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 1), dark);
    cap.position.y = 3.4; base.position.y = -3; chain.position.y = 6.8;
    [core, cap, base, chain].forEach(function (m) { lantern.add(m); });
    var lglow = glow(WARM, 70, 0.85); lantern.add(lglow);
    lantern.position.set(18, 38, 4);
    island.add(lantern);
    // the warm pool it throws on the path
    var pool0 = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ map: WARM, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.22, depthWrite: false, fog: false }));
    pool0.rotation.x = -Math.PI / 2; pool0.position.set(12, 0.4, -6); island.add(pool0);

    // ---- the mobs ----
    function boneOf(m, n) { var b = null; m.g.traverse(function (x) { if (!b && x.userData.bone && x.userData.bone.n === n) b = x; }); return b; }
    var wandy = api.mob({ mob: 'wandering_trader' }), lamA = api.mob({ mob: 'trader_llama' }), lamB = api.mob({ mob: 'trader_llama' });
    wandy.g.position.set(2, 0, -8); wandy.g.rotation.y = 0.12;
    lamA.g.position.set(-38, 0, -14); lamA.g.rotation.y = -0.45;
    lamB.g.position.set(-54, 0, 14); lamB.g.rotation.y = -0.95;
    [wandy, lamA, lamB].forEach(function (m) { island.add(m.g); });
    var head = boneOf(wandy, 'head'), arms = boneOf(wandy, 'arms'), armsY = arms ? arms.position.y : 0;
    var llamas = [lamA, lamB].map(function (m, i) {
      var h = boneOf(m, 'head');
      return { m: m, head: h, rx: h ? h.rotation.x : 0, ry: h ? h.rotation.y : 0, ph: i * 2.3, look: 0, want: 0, next: 2 + i * 3 };
    });

    // leads: a sagging rope from Wandy's hands to each llama's neck
    island.updateMatrixWorld(true);
    var leadMat = new THREE.MeshBasicMaterial({ color: 0x5a3c22 });
    function lead(from, to) {
      var a = island.worldToLocal(from), b = island.worldToLocal(to), mid = a.clone().lerp(b, 0.5);
      mid.y = Math.min(a.y, b.y) - 9;
      var tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 24, 0.45, 4), leadMat);
      island.add(tube);
    }
    var hand = wandy.g.localToWorld(new V(0, 17, -7));
    lead(hand.clone(), lamA.g.localToWorld(new V(0, 18, -9)));
    lead(hand.clone(), lamB.g.localToWorld(new V(0, 18, -9)));

    // ---- name tag, as the game draws one over a named mob ----
    var tag = null;
    if (window.McFont) McFont.load(function () {
      var runs = McFont.parse('Wandy T.'), w = McFont.width(runs), s = 4, pad = 2;
      var c = document.createElement('canvas'); c.width = (w + pad * 2) * s; c.height = (8 + pad * 2) * s;
      var x = c.getContext('2d');
      x.fillStyle = 'rgba(0,0,0,0.32)'; x.fillRect(0, 0, c.width, c.height);
      McFont.draw(x, runs, pad * s, pad * s + s, { scale: s, shadow: false });
      var t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
      tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
      var k = 0.42;
      tag.scale.set(c.width / s * k, c.height / s * k, 1);
      tag.position.set(2, 38, -8);
      island.add(tag);
    });

    // ---- sky: Minecraft's flat, blocky clouds, far behind ----
    var clouds = new THREE.Group(), cloudMat = new THREE.MeshBasicMaterial({ color: 0xffcf9a, transparent: true, opacity: 0.3, depthWrite: false });
    [[-520, 230, 760, 9, 4], [260, 300, 900, 12, 5], [740, 190, 640, 7, 3], [-60, 360, 1100, 10, 6]].forEach(function (c) {
      var g = new THREE.Group();
      for (var i = 0; i < c[3]; i++) for (var j = 0; j < c[4]; j++) {
        if (hash(i, j, c[0]) < 0.32) continue;
        var m = new THREE.Mesh(new THREE.BoxGeometry(48, 8, 48), cloudMat); m.position.set(i * 48, 0, j * 48); g.add(m);
      }
      g.position.set(c[0], c[1], c[2]); clouds.add(g);
    });
    world.add(clouds);

    // ---- the sun behind him: one big warm glow, so the island's edges catch the photo's sunset ----
    var sun = glow(WARM, 760, 0.22); sun.position.set(40, 70, 320); world.add(sun);

    // ---- loose chunks drifting around the island, each on its own bob ----
    var chunks = [
      [{ '0,0,0': 'grass', '1,0,0': 'grass', '0,0,1': 'grass', '0,-1,0': 'dirt', '1,-1,0': 'stone', '0,-2,0': 'stone' }, 80, -100, -10, 0.7],
      [{ '0,0,0': 'stone', '1,0,0': 'cobble', '0,-1,0': 'stone' }, -112, -78, -20, 0.6],
      [{ '0,0,0': 'grass', '0,-1,0': 'dirt' }, -20, -128, 0, 0.5],
      [{ '0,0,0': 'grass', '1,0,0': 'grass', '0,0,1': 'grass', '1,0,1': 'grass', '0,-1,0': 'dirt', '1,-1,1': 'dirt', '0,-2,1': 'stone' }, 30, 70, 240, 0.6]
    ].map(function (c, i) {
      var g = new THREE.Group(); voxels(c[0], g);
      g.scale.setScalar(c[4]); g.position.set(c[1], c[2], c[3]); g.rotation.y = i * 0.9; world.add(g);
      return { g: g, y: c[2], ph: i * 1.7, sp: 0.4 + i * 0.07 };
    });
    // dirt crumbs falling off the island's tip: the game's square particles
    var crumbs = [];
    for (var cb = 0; cb < (PHONE.matches ? 5 : 8); cb++) {
      var cs = new THREE.Sprite(new THREE.SpriteMaterial({ color: cb % 3 ? 0x6b4a2f : 0x7d7d7d, transparent: true, depthWrite: false }));
      cs.scale.setScalar(2 + hash(cb, 1, 7) * 1.6); island.add(cs);
      crumbs.push({ s: cs, x: (hash(cb, 2, 7) - 0.5) * 30, z: (hash(cb, 3, 7) - 0.5) * 20, t: hash(cb, 4, 7) * 5 });
    }

    // ---- fireflies (1.21.5's firefly bush) drifting around the island ----
    var FLY = glowTex('236,240,140'), flies = [];
    for (var f = 0; f < (PHONE.matches ? 9 : 16); f++) {
      var s = glow(FLY, 7, 0);
      var fl = { s: s, x: (hash(f, 1, 3) - 0.5) * 190, y: 8 + hash(f, 2, 3) * 70, z: (hash(f, 3, 3) - 0.5) * 150, ph: hash(f, 4, 3) * 6.28, sp: 0.3 + hash(f, 5, 3) * 0.5 };
      s.position.set(fl.x, fl.y, fl.z); island.add(s); flies.push(fl);
    }
    // ---- camera: framed on the island, the subject to the right on desktop; slow drift + pointer parallax ----
    var TARGET = new V(-6, 26, 0), W = 1, H = 1;
    function size() {
      W = canvas.clientWidth || 1; H = canvas.clientHeight || 1;
      renderer.setSize(W, H, false);
      var wide = !PHONE.matches, fx = wide ? 0.71 : 0.5, full = W * fx * 2;
      camera.aspect = full / H;
      camera.setViewOffset(full, H, 0, 0, W, H);
      // keep the whole island in the frame: phones (narrow) back off further
      var tn = Math.tan(14 * Math.PI / 180);
      // desktop: the whole island fits; phones may crop its sides so Wandy stays big
      dist = wide ? Math.max(116 / tn, 118 / (tn * W / H)) * 1.24 : Math.max(82 / tn, 64 / (tn * W / H));
      TARGET.set(wide ? -6 : -4, wide ? 14 : 26, 0);
      if (REDUCE) draw(performance.now());
    }
    var dist = 470, ptr = { x: 0, y: 0, nx: 0, ny: 0, at: 0, has: false };
    addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = canvas.getBoundingClientRect();
      ptr.nx = ((e.clientX - r.left) / r.width) * 2 - 1; ptr.ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
      ptr.at = performance.now(); ptr.has = true;
      if (REDUCE) draw(ptr.at);
    }, { passive: true });

    // ---- the loop ---- (he looks at the visitor for the first 9 s: the first impression, and the poster)
    var last = 0, lookY = 0, lookX = 0, idleLook = null, idleNext = performance.now() + 9000, tmp = new V(), tmp2 = new V();
    function aimHead(now) {
      if (!head) return;
      var target;
      if (ptr.has && now - ptr.at < 4000) {
        // the point under the pointer, half way between the camera and Wandy
        tmp.set(ptr.nx, ptr.ny, 0.5).unproject(camera).sub(camera.position).normalize();
        target = tmp2.copy(camera.position).addScaledVector(tmp, camera.position.distanceTo(wandy.g.getWorldPosition(new V())) * 0.5);
      } else {
        // no pointer: mostly the visitor (the camera), now and then a llama or the path at his feet
        if (now > idleNext) {
          var r = Math.random();
          idleLook = r < 0.55 ? null : r < 0.8 ? llamas[0].head : 'path';
          idleNext = now + 2500 + Math.random() * 3500;
        }
        if (idleLook === 'path') target = tmp2.set(10, 0, -60).applyMatrix4(island.matrixWorld);
        else if (idleLook) target = idleLook.getWorldPosition(tmp2);
        else target = tmp2.copy(camera.position);
      }
      var hp = head.getWorldPosition(new V()), loc = wandy.g.worldToLocal(target.clone()), hl = wandy.g.worldToLocal(hp);
      var dx = loc.x - hl.x, dy = loc.y - hl.y, dz = loc.z - hl.z;
      var yaw = Math.max(-1, Math.min(1, Math.atan2(-dx, -dz))), pitch = Math.max(-0.45, Math.min(0.5, Math.atan2(dy, Math.hypot(dx, dz))));
      lookY += (yaw - lookY) * 0.12; lookX += (pitch - lookX) * 0.12;
      head.rotation.y = lookY; head.rotation.x = lookX;
    }
    function draw(now) {
      var t = REDUCE ? 0 : now / 1000, dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      // camera
      ptr.x += (ptr.nx * (ptr.has ? 1 : 0) - ptr.x) * 0.05; ptr.y += (ptr.ny * (ptr.has ? 1 : 0) - ptr.y) * 0.05;
      var yaw = 0.28 + Math.sin(t * 0.07) * 0.1 + (REDUCE ? 0 : ptr.x * 0.06), pitch = 0.3 + (REDUCE ? 0 : ptr.y * 0.03);
      camera.position.set(TARGET.x + Math.sin(yaw) * Math.cos(pitch) * dist, TARGET.y + Math.sin(pitch) * dist, TARGET.z - Math.cos(yaw) * Math.cos(pitch) * dist);
      camera.lookAt(TARGET);
      camera.updateMatrixWorld();
      island.position.y = Math.sin(t * 0.55) * 2.5;
      island.updateMatrixWorld(true);
      // Wandy: breathes, follows the pointer
      if (arms) arms.position.y = armsY + Math.sin(t * 1.7) * 0.35;
      aimHead(now);
      // llamas: chew, and glance about now and then
      llamas.forEach(function (l) {
        if (!l.head) return;
        if (t > l.next) { l.want = (Math.random() - 0.5) * 1.1; l.next = t + 3 + Math.random() * 5; }
        l.look += (l.want - l.look) * 0.04;
        l.head.rotation.y = l.ry + l.look;
        l.head.rotation.x = l.rx + Math.sin(t * 2.2 + l.ph) * 0.05;
      });
      lantern.rotation.z = Math.sin(t * 0.9) * 0.05;
      lglow.material.opacity = 0.78 + Math.sin(t * 7.3) * 0.04 + Math.sin(t * 2.1) * 0.05;
      flies.forEach(function (f) {
        var a = t * f.sp + f.ph;
        f.s.position.set(f.x + Math.sin(a) * 14, f.y + Math.sin(a * 1.3) * 6, f.z + Math.cos(a * 0.8) * 12);
        f.s.material.opacity = REDUCE ? 0.6 : Math.max(0, Math.sin(a * 2.4)) * 0.95;
      });
      chunks.forEach(function (c) {
        c.g.position.y = c.y + Math.sin(t * c.sp + c.ph) * 5;
        c.g.rotation.y += REDUCE ? 0 : dt * 0.05;
      });
      crumbs.forEach(function (c) {
        var k = ((REDUCE ? c.t : t + c.t) % 5) / 5; // 5 s from the tip to gone
        c.s.position.set(c.x, -92 - k * 110, c.z);
        c.s.material.opacity = Math.min(1, k * 6) * (1 - k);
      });
      clouds.children.forEach(function (c) { c.position.x += dt * 3; if (c.position.x > 1100) c.position.x = -1300; });
      renderer.render(sc, camera);
    }

    // run only while the hero is on screen and the tab is visible
    var onScreen = true, running = false;
    function loop(now) {
      if (!onScreen || document.hidden) { running = false; return; }
      requestAnimationFrame(loop);
      draw(now);
    }
    function go() { if (REDUCE) { draw(performance.now()); return; } if (!running && onScreen && !document.hidden) { running = true; requestAnimationFrame(loop); } }
    new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; go(); }).observe(canvas);
    document.addEventListener('visibilitychange', go);
    new ResizeObserver(size).observe(canvas);
    PHONE.addEventListener('change', size);
    size();

    // show it once every texture is in (or after 6 s, whatever arrived)
    var t0 = performance.now();
    (function ready() {
      if ((waiting > 0 || api.loading()) && performance.now() - t0 < 6000) return setTimeout(ready, 120);
      // sunset grade: the mobs' materials arrive with their textures, so they're tinted here, once
      sc.traverse(function (o) {
        var m = o.material;
        if (!m || m.blending === THREE.AdditiveBlending || m.userData.graded || m === cloudMat) return;
        m.userData.graded = 1; m.color.multiply(new THREE.Color(1, 0.9, 0.8)); // golden hour, the photo's light
      });
      draw(performance.now());
      hero.classList.add('is-3d');
      go();
    })();
  }
})();
