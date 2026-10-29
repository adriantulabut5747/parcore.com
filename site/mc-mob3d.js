/* Mob 3D preview (Oct 15 2026), used by the mob summoner (mc-mob.js).
   Draws any mob from mc-mob3d.json: Bedrock geometry (bones of boxes) + textures, both built
   from Mojang's sample pack by _tools/mobs3d/build.py. On top: worn armor and mob heads,
   held items as little pixel blocks. Mobs stand still; drag to turn them.

   Coordinates: Bedrock files have x mirrored compared to three.js, so x (and the x/y
   rotations) are flipped on load, the same way Blockbench reads them. Then the mob faces -z
   and its right side is +x, which matches the Java texture layout the box UVs use.

   window.MobView.mount(canvas) once, then .show({ mob, baby, eq: {slot: {id, owner}}, scale }).
   three.js comes from jsDelivr on first use. */
window.MobView = (function () {
  var THREE, renderer, scene, camera, pivot, view, data, canvas, stage, wantShow = null, booting = false;
  var yaw = -0.5, frame = { y: 16, d: 60 };
  var texCache = {};

  // Mobs that wear armor / hold items in Java (others ignore their gear visually).
  var ARMOR = ' zombie husk drowned giant zombie_villager skeleton stray bogged wither_skeleton parched piglin piglin_brute zombified_piglin armor_stand ';
  var HOLD = ARMOR + ' pillager vex allay ';

  function load(src, cb) {
    var s = document.createElement('script');
    s.src = src; s.onload = cb; document.head.appendChild(s);
  }
  function mount(c) {
    canvas = c; stage = c.parentNode;
    if (booting) return;
    booting = true;
    var got = 0;
    function ready() { if (++got === 2) start(); }
    load('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js', ready);
    fetch('/mc-mob3d.json').then(function (r) { return r.json(); }).then(function (d) { data = d; ready(); });
  }
  function start() {
    THREE = window.THREE;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true });
    } catch (e) { stage.classList.add('no-3d'); return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, 1, 0.5, 2000);
    pivot = new THREE.Group(); scene.add(pivot);
    size(); new ResizeObserver(size).observe(stage);
    drag();
    if (wantShow) show(wantShow);
  }
  // The mob is framed in the view box (stage), but the canvas reaches higher, up over the name tag strip
  // (mc-tool.css .mt-view canvas), so a raised spear or trident runs on up instead of being cut off. The
  // camera keeps the view box's framing and only draws more above it (setViewOffset with a negative y).
  function size() {
    var w = stage.clientWidth, h = stage.clientHeight, up = Math.max(0, canvas.clientHeight - h);
    renderer.setSize(w, h + up, false);
    camera.aspect = w / h;
    camera.setViewOffset(w, h, 0, -up, w, h + up);
    place();
  }
  function place() {
    camera.position.set(0, frame.y + frame.d * 0.18, -frame.d);
    camera.lookAt(0, frame.y, 0);
    redraw();
  }
  // drag to turn (pointer events cover mouse and touch). A touch on the model never scrolls the page
  // (touch-action: none in mc-tool.css): a slightly upward swipe used to pull-to-refresh it.
  function drag() {
    var x0 = null;
    canvas.addEventListener('pointerdown', function (e) { x0 = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', function (e) { if (x0 == null) return; yaw += (e.clientX - x0) * 0.012; x0 = e.clientX; redraw(); });
    ['pointerup', 'pointercancel'].forEach(function (t) { canvas.addEventListener(t, function () { x0 = null; }); });
    canvas.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        yaw += e.key === 'ArrowLeft' ? -0.18 : 0.18;
        redraw();
      }
    });
  }
  // Draw only when something changed (new mob, a texture arrived, a drag, a resize): nothing moves
  // on its own, so redrawing every frame would just burn battery.
  var pending = false;
  function redraw() {
    if (pending || !renderer) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      if (!view) return;
      pivot.rotation.y = yaw;
      renderer.render(scene, camera);
    });
  }

  // ---- loading (Oct 19) ----
  // A new model stays hidden until every texture it asked for is in (meshes start with three.js's plain white
  // material, which looked broken), and the last one stays on screen meanwhile. Each show() is a generation;
  // hold() counts one wait in it, and its release reveals the model once the count is back to 0.
  var gen = 0, pend = 0, shown = null, nextFrame = null, loadT = 0;
  function hold() {
    var g = gen, done = false;
    pend++;
    return function () { if (done) return; done = true; if (g === gen && --pend === 0) reveal(); };
  }
  function held(cb) { var rel = hold(); return function (t) { cb(t); rel(); }; } // cb, then release
  function reveal() {
    clearTimeout(loadT);
    if (!view) return;
    if (shown && shown !== view) pivot.remove(shown);
    shown = view;
    view.visible = true;
    if (nextFrame) { frame = nextFrame; nextFrame = null; }
    stage.classList.remove('is-loading');
    place();
  }

  // ---- textures ----
  function texture(src, cb) {
    if (texCache[src]) { if (texCache[src].ready) cb(texCache[src].t); else texCache[src].wait.push(held(cb)); return; }
    var entry = texCache[src] = { wait: [held(cb)] };
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      var t = new THREE.Texture(img);
      t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
      t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
      entry.t = t; entry.ready = true; entry.img = img;
      entry.wait.forEach(function (f) { f(t); });
    };
    img.onerror = function () { entry.ready = true; entry.t = null; entry.wait.forEach(function (f) { f(null); }); };
    img.src = src;
  }
  function tinted(src, hex, cb) {
    texture(src, function (t) {
      if (!t || !hex) return cb(t);
      var key = src + '#' + hex;
      if (texCache[key]) return cb(texCache[key].t);
      var img = t.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      var x = c.getContext('2d'); x.drawImage(img, 0, 0);
      var d = x.getImageData(0, 0, c.width, c.height), p = d.data, n = parseInt(hex, 16);
      for (var i = 0; i < p.length; i += 4) { p[i] = p[i] * (n >> 16 & 255) / 255; p[i + 1] = p[i + 1] * (n >> 8 & 255) / 255; p[i + 2] = p[i + 2] * (n & 255) / 255; }
      x.putImageData(d, 0, 0);
      var tt = new THREE.CanvasTexture(c);
      tt.magFilter = tt.minFilter = THREE.NearestFilter; tt.generateMipmaps = false; tt.colorSpace = THREE.SRGBColorSpace;
      texCache[key] = { t: tt, ready: true };
      cb(tt);
    });
  }
  // Several textures drawn onto one (villager body + biome clothes + job clothes + badge), cached by the list.
  // A layer can end in a tag: "#nohat" leaves out its villager hat, "#rrggbb" tints it (collars, sheep wool),
  // "#gold" (a TRIMPAL name) colours an armor trim pattern.
  // Trim palettes from the 26.3 jar (textures/palettes/trim/*.png, 8 colours each, light to dark). The pattern
  // textures (minecrafticons/armor/trims/) use TRIMKEY's greys. "_darker" = trim on armor of its own material.
  var TRIMKEY = [224, 192, 160, 128, 96, 64, 32, 0];
  var TRIMPAL = {
    amethyst: 'c98ff39a5cc66c49aa523687422776361c6a240c5317063b', copper: 'e3826cb4684d9a472c793c286d34205f2b184c20103d180b',
    copper_darker: '7b41356b3628592a194c2416401e1136190f29140c1b0e08', diamond: 'cbfff56eecd22cbaa81d969a0c788d07657804515f013c47',
    diamond_darker: '15b3a10a9ca1048185027472065d5b09514803464204403e', emerald: '82f6ad0ec75411a036107b240e722209631b035013023d0e',
    gold: 'fffd90ecd93fdeb12db16712a0450a803503712d00572300', gold_darker: 'c29c2aba8327a35f1489470c803503712d005723003e1b03',
    iron: 'c5d2d4bfc9c89daaaa7b8989717d7d657070576363465151', iron_darker: 'a2b0b38a92916f76765763633d4949313b3b2b34341d2828',
    lapis: '416e971c4d9c21497b123365112e630c285a091e45051636', netherite: '5a575a443a3b312e312f2727231e1e1a1616100c0c090707',
    netherite_darker: '2e2829282425281d1d241a1a1f17171d1313140f0f0b0909', quartz: 'f2efedf6eadfe3dbc4b6ad96908e8065615645433c2a2822',
    redstone: 'e62008bd2008971607781101650b01520d063608031d0502', resin: 'ffc354f69f3bf0852aec7214db5f10c7490aa53b11802a1a'
  };
  function layered(srcs, cb) {
    var key = 'layers:' + srcs.join('|'); // not the plain texture's key: a one-layer stack would wait on itself
    if (texCache[key]) { if (texCache[key].ready) cb(texCache[key].t); else texCache[key].wait.push(held(cb)); return; }
    var entry = texCache[key] = { wait: [held(cb)] }, imgs = [], left = srcs.length;
    srcs.forEach(function (src, i) {
      texture(src.split('#')[0], function (t) {
        imgs[i] = t && t.image;
        if (--left) return;
        var tt = null;
        if (imgs[0]) {
          var c = document.createElement('canvas'); c.width = imgs[0].width; c.height = imgs[0].height;
          var x = c.getContext('2d');
          imgs.forEach(function (im, j) {
            if (!im) return;
            var tag = srcs[j].split('#')[1];
            if (!tag) return x.drawImage(im, 0, 0, c.width, c.height);
            var t2 = document.createElement('canvas'); t2.width = c.width; t2.height = c.height;
            var y = t2.getContext('2d'), k = c.width / 64;
            y.drawImage(im, 0, 0, c.width, c.height);
            if (TRIMPAL[tag]) {
              // armor trim: the grey pattern's 8 shades (palettes/trim_base) swapped for the material's 8 colours
              var dt = y.getImageData(0, 0, c.width, c.height), q = dt.data, pal = TRIMPAL[tag];
              for (var a = 0; a < q.length; a += 4) {
                var w = q[a + 3] ? TRIMKEY.indexOf(q[a]) : -1;
                if (w > -1) { var h = parseInt(pal.substr(w * 6, 6), 16); q[a] = h >> 16 & 255; q[a + 1] = h >> 8 & 255; q[a + 2] = h & 255; }
              }
              y.putImageData(dt, 0, 0);
            } else if (tag === 'nohat') {
              // adult villager hat bones: helmet (uv 32,0 / 32x18) + brim (uv 30,47 / 34x17), on a 64x64 sheet
              y.clearRect(32 * k, 0, 32 * k, 18 * k); y.clearRect(30 * k, 47 * k, 34 * k, 17 * k);
            } else {
              var d = y.getImageData(0, 0, c.width, c.height), p = d.data, n = parseInt(tag, 16);
              for (var i = 0; i < p.length; i += 4) { p[i] = p[i] * (n >> 16 & 255) / 255; p[i + 1] = p[i + 1] * (n >> 8 & 255) / 255; p[i + 2] = p[i + 2] * (n & 255) / 255; }
              y.putImageData(d, 0, 0);
            }
            x.drawImage(t2, 0, 0);
          });
          tt = new THREE.CanvasTexture(c);
          tt.magFilter = tt.minFilter = THREE.NearestFilter; tt.generateMipmaps = false; tt.colorSpace = THREE.SRGBColorSpace;
        }
        entry.t = tt; entry.ready = true;
        entry.wait.forEach(function (f) { f(tt); });
      });
    });
  }
  function material(t) {
    return new THREE.MeshBasicMaterial({ map: t, vertexColors: true, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
  }

  // ---- geometry: Bedrock bones -> three.js groups ----
  var SHADE = { up: 1, down: 0.5, north: 0.8, south: 0.8, east: 0.6, west: 0.6 }; // Minecraft's flat face light
  // corners of each face seen from outside: top-left, top-right, bottom-right, bottom-left
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
  // pixel rectangles [u0, v0, u1, v1] of the six faces
  function faceUV(c, mirror) {
    var u = c.u;
    if (!Array.isArray(u)) {                      // per-face uv
      var o = {};
      Object.keys(u).forEach(function (f) { var q = u[f]; if (q && q.uv) o[f] = [q.uv[0], q.uv[1], q.uv[0] + q.uv_size[0], q.uv[1] + q.uv_size[1]]; });
      return o;
    }
    var w = c.s[0], h = c.s[1], d = c.s[2], U = u[0], V = u[1];
    var r = {
      east: [U, V + d, U + d, V + d + h], north: [U + d, V + d, U + d + w, V + d + h],
      west: [U + d + w, V + d, U + 2 * d + w, V + d + h], south: [U + 2 * d + w, V + d, U + 2 * d + 2 * w, V + d + h],
      up: [U + d, V, U + d + w, V + d], down: [U + d + w, V, U + d + 2 * w, V + d]
    };
    if (mirror) {
      var e = r.east; r.east = r.west; r.west = e;
      Object.keys(r).forEach(function (f) { var q = r[f]; r[f] = [q[2], q[1], q[0], q[3]]; });
    }
    return r;
  }
  function rad(v) { return v * Math.PI / 180; }
  function euler(r) { return new THREE.Euler(rad(-r[0]), rad(-r[1]), rad(r[2]), 'ZYX'); }
  function flipP(p) { return p ? [-p[0], p[1], p[2]] : [0, 0, 0]; }
  // all cubes of one bone baked into one BufferGeometry, positions relative to the bone pivot
  // grow = more inflate on every box (gear drawn over the mob's own model, mc-mob3d.js gearParts)
  function boneGeometry(bone, geo, P, extra, grow) {
    var pos = [], uv = [], col = [];
    (bone.c || []).concat(extra || []).forEach(function (c) {
      var i3 = Array.isArray(c.i) ? c.i : [c.i || 0, c.i || 0, c.i || 0], mirror = c.m != null ? !!c.m : !!bone.m;
      var ix = i3[0] + (grow || 0), iy = i3[1] + (grow || 0), iz = i3[2] + (grow || 0);
      var a = [-(c.o[0] + c.s[0]) - ix, c.o[1] - iy, c.o[2] - iz], b = [-c.o[0] + ix, c.o[1] + c.s[1] + iy, c.o[2] + c.s[2] + iz];
      var m = null;
      if (c.r) {
        var cp = flipP(c.v);
        m = new THREE.Matrix4().makeTranslation(cp[0], cp[1], cp[2])
          .multiply(new THREE.Matrix4().makeRotationFromEuler(euler(c.r)))
          .multiply(new THREE.Matrix4().makeTranslation(-cp[0], -cp[1], -cp[2]));
      }
      var tw = c.tw || geo.w, th = c.th || geo.h, rects = faceUV(c, mirror);
      (c.x || []).forEach(function (f) { delete rects[f]; }); // faces this box leaves open (build.py OPEN)
      Object.keys(rects).forEach(function (f) {
        var q = rects[f], k = corners(f, a, b), sh = SHADE[f];
        var t = [[q[0], q[1]], [q[2], q[1]], [q[2], q[3]], [q[0], q[3]]];
        [0, 1, 2, 0, 2, 3].forEach(function (i) {
          var v = new THREE.Vector3(k[i][0], k[i][1], k[i][2]);
          if (m) v.applyMatrix4(m);
          pos.push(v.x - P[0], v.y - P[1], v.z - P[2]);
          uv.push(t[i][0] / tw, 1 - t[i][1] / th);
          col.push(sh, sh, sh);
        });
      });
    });
    if (!pos.length) return null;
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  }
  function wild(list, name) {
    return (list || []).some(function (p) { return p.slice(-1) === '*' ? name.indexOf(p.slice(0, -1)) === 0 : p === name; });
  }
  // Build one model: {root group, bones: {name: group}}. part = [geometry id, texture, {h, o, t, i}]:
  // h = bones left out, o = only these bones, t = texture size, i = extra inflate (gear over the mob).
  // pose = the starting pose baked from the mob's always-on animations: {bone: {p, r, s}}, added on top.
  // order = the part's place in the mob's list: layers draw bottom first, so a see-through outer
  // layer (the slime's jelly) blends over what's inside instead of hiding it.
  function build(part, into, pose, order) {
    var geo = data.geo[part[0]], rule = part[2] || {}, groups = {}, root = new THREE.Group();
    pose = pose || {};
    geo.b.forEach(function (b) {
      var g = new THREE.Group(), a = pose[b.n] || {}, r0 = geo.l ? [0, 0, 0] : b.r || [0, 0, 0], ra = a.r || [0, 0, 0];
      g.userData.P = flipP(b.v); g.userData.bone = b;
      // old (1.8 / 1.10) models: a bone's own rotation turns only its cubes, not its children (see below)
      g.rotation.copy(euler([r0[0] + ra[0], r0[1] + ra[1], r0[2] + ra[2]]));
      if (a.s) g.scale.set(a.s[0], a.s[1], a.s[2]);
      groups[b.n] = g;
    });
    geo.b.forEach(function (b) {
      var g = groups[b.n], parent = b.p && groups[b.p], P = g.userData.P, PP = parent ? parent.userData.P : [0, 0, 0];
      var ap = flipP((pose[b.n] || {}).p);
      g.position.set(P[0] - PP[0] + ap[0], P[1] - PP[1] + ap[1], P[2] - PP[2] + ap[2]);
      (parent || root).add(g);
      var skip = wild(rule.h, b.n) || (rule.o && !wild(rule.o, b.n));
      if (skip) return;
      var bg = boneGeometry(b, rule.t ? { w: rule.t[0], h: rule.t[1] } : geo, P, null, rule.i);
      if (!bg) return;
      var mesh = new THREE.Mesh(bg);
      mesh.renderOrder = order || 0;
      // a rotation of the bone's own cubes only: old models' bone rotation, or a pose "o" fix (build.py FIX)
      var or = [0, 0, 0], br = geo.l && b.r ? b.r : [0, 0, 0], ao = (pose[b.n] || {}).o || [0, 0, 0];
      for (var i = 0; i < 3; i++) or[i] = br[i] + ao[i];
      if (or[0] || or[1] || or[2]) { var own = new THREE.Group(); own.rotation.copy(euler(or)); own.add(mesh); g.add(own); } else g.add(mesh);
      (Array.isArray(part[1]) ? layered : texture)(part[1], function (t) { mesh.material = material(t); redraw(); });
    });
    into.add(root);
    return { root: root, bones: groups };
  }
  function bone(model, names) {
    for (var i = 0; i < names.length; i++) if (model.bones[names[i]]) return model.bones[names[i]];
    return null;
  }

  // ---- gear ----
  var HUMAN = ['head', 'body', 'rightarm', 'leftarm', 'rightleg', 'leftleg'];
  // the player-shaped armor boxes (Bedrock coordinates, like the mob files)
  function armorBox(slot, legsLayer) {
    var inf = legsLayer ? 0.5 : 1;
    return {
      head: [['head', [-4, 24, -4], [8, 8, 8], [0, 0], 1]],
      chest: [['body', [-4, 12, -2], [8, 12, 4], [16, 16], 1], ['rightarm', [-8, 12, -2], [4, 12, 4], [40, 16], 1], ['leftarm', [4, 12, -2], [4, 12, 4], [40, 16], 1, 1]],
      legs: [['body', [-4, 12, -2], [8, 12, 4], [16, 16], 0.5], ['rightleg', [-3.9, 0, -2], [4, 12, 4], [0, 16], 0.5], ['leftleg', [-0.1, 0, -2], [4, 12, 4], [0, 16], 0.5, 1]],
      feet: [['rightleg', [-3.9, 0, -2], [4, 12, 4], [0, 16], 1], ['leftleg', [-0.1, 0, -2], [4, 12, 4], [0, 16], 1, 1]]
    }[slot].map(function (x) { return { bone: x[0], cube: { o: x[1], s: x[2], u: x[3], i: x[4], m: x[5] ? 1 : 0, tw: 64, th: 32 } }; });
  }
  function matOf(id) {
    var m = id.match(/^(leather|chainmail|copper|iron|golden|diamond|netherite)_(helmet|chestplate|leggings|boots)$/);
    if (m) return m[1] === 'golden' ? 'gold' : m[1];
    return id === 'turtle_helmet' ? 'turtle_scute' : null;
  }
  // tex: one picture (tinted by hex), or a layer list for layered() (dyed leather + its untinted buckles)
  function addCubes(model, list, tex, hex) {
    var groups = {};
    list.forEach(function (x) { (groups[x.bone] = groups[x.bone] || []).push(x.cube); });
    Object.keys(groups).forEach(function (bn) {
      var g = model.bones[bn]; if (!g) return;
      var bg = boneGeometry({}, { w: 64, h: 32 }, g.userData.P, groups[bn]);
      var mesh = new THREE.Mesh(bg); g.add(mesh);
      var put = function (t) { mesh.material = material(t); redraw(); };
      if (Array.isArray(tex)) layered(tex, put); else tinted(tex, hex, put);
    });
  }
  // Undyed leather is the game's brown (DyedItemColor's default for leather); the overlay never takes the dye.
  var LEATHER = 'a06540';
  function leather(src, overlay, dye) { return [src + '#' + (dye || LEATHER), overlay]; }
  // e.trim 'pattern:material' -> the trim layer for that armor (none on baby armor: the game has no baby trim textures)
  function trimmed(tex, e, mat, legs) {
    var t = e.trim && e.trim.split(':');
    if (!t || !TRIMPAL[t[1]]) return tex;
    return [].concat(tex, '/minecrafticons/armor/trims/' + t[0] + (legs ? '_legs' : '') + '.png#' + (TRIMPAL[t[1] + '_darker'] && mat === t[1] ? t[1] + '_darker' : t[1]));
  }
  function dressUp(model, eq, mob, baby, glide) {
    if (!HUMAN.every(function (n) { return model.bones[n]; })) return;
    // the adult armor boxes fit adult-sized bodies; baby zombies get the game's own baby armor
    if (Math.abs(model.bones.head.userData.P[1] - 24) > 2) { if (baby && BABY_ARMOR_MOBS.indexOf(' ' + mob + ' ') > -1) babyArmor(model, eq); return; }
    ['head', 'chest', 'legs', 'feet'].forEach(function (slot) {
      var e = eq[slot]; if (!e) return;
      var mat = matOf(e.id), A = '/minecrafticons/armor/' + (slot === 'legs' ? 'leather_legs' : 'leather');
      if (mat) return addCubes(model, armorBox(slot, slot === 'legs'), trimmed(mat === 'leather' ? leather(A + '.png', A + '_overlay.png', e.dye) : '/minecrafticons/armor/' + mat + (slot === 'legs' ? '_legs' : '') + '.png', e, mat, slot === 'legs'));
      if (slot !== 'head') return;
      // mob heads and player heads: a head-sized box with that mob's skin; carved pumpkin: the block
      var skin = { skeleton_skull: 'skeleton', wither_skeleton_skull: 'wither_skeleton', zombie_head: 'zombie', creeper_head: 'creeper' }[e.id];
      if (skin || e.id === 'player_head') {
        var src = skin ? '/minecrafticons/mobs3d/' + skin + '.png' : e.owner ? 'https://mc-heads.net/skin/' + e.owner : '/minecrafticons/skins/steve_wide.png';
        texture(src, function (t) {
          var h = t && t.image.height === 32 ? 32 : 64;
          addCubes(model, [{ bone: 'head', cube: { o: [-4, 24, -4], s: [8, 8, 8], u: [0, 0], i: 0.5, tw: 64, th: h } }], src);
        });
      } else if (e.id === 'carved_pumpkin') pumpkin(model);
      else blockOnHead(model, e.id); // any other block (glass, a beacon...) the way the game wears it
    });
    if (eq.chest && eq.chest.id === 'elytra') wings(model, glide);
  }
  // ---- elytra (Oct 19): ElytraModel + WingsLayer, Java 26.3 ----
  // Two 10 x 20 x 2 wings (uv 22,0, CubeDeformation 1.0), pivots at x +-5 on the neck line, 0.125 block
  // behind the body. Standing: xRot 15 deg, zRot -+15 deg (ElytraAnimationState); gliding (FallFlying, not
  // moving): xRot 20 deg, zRot -+90 deg, spread flat. Built in Java model space (y down, 24 = the ground):
  // turned half a circle on z and lifted 24, that is this renderer's space.
  function javaBox(o, s, uv, g, mirror, tw, th) {
    var x0 = o[0] - g, y0 = o[1] - g, z0 = o[2] - g, x1 = o[0] + s[0] + g, y1 = o[1] + s[1] + g, z1 = o[2] + s[2] + g;
    if (mirror) { var t = x0; x0 = x1; x1 = t; }
    var v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    var dx = s[0], dy = s[1], dz = s[2], u = uv[0], w = uv[1];
    var U = [u, u + dz, u + dz + dx, u + dz + 2 * dx, u + 2 * dz + dx, u + 2 * dz + 2 * dx], V = [w, w + dz, w + dz + dy];
    // ModelPart.Cube: corners, then u1 v1 u2 v2 (corner 0 gets u2 v1, 1 u1 v1, 2 u1 v2, 3 u2 v2), face light
    var F = [[[5, 4, 0, 1], U[1], V[0], U[2], V[1], 0.5], [[2, 3, 7, 6], U[2], V[1], U[3], V[0], 1], [[0, 4, 7, 3], U[0], V[1], U[1], V[2], 0.6],
      [[1, 0, 3, 2], U[1], V[1], U[2], V[2], 0.8], [[5, 1, 2, 6], U[2], V[1], U[4], V[2], 0.6], [[4, 5, 6, 7], U[4], V[1], U[5], V[2], 0.8]];
    var pos = [], uvs = [], col = [];
    F.forEach(function (f) {
      var tc = [[f[3], f[2]], [f[1], f[2]], [f[1], f[4]], [f[3], f[4]]];
      [0, 1, 2, 0, 2, 3].forEach(function (i) {
        var p = v[f[0][i]];
        pos.push(p[0], p[1], p[2]); uvs.push(tc[i][0] / tw, 1 - tc[i][1] / th); col.push(f[5], f[5], f[5]);
      });
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }
  function wings(model, glide) {
    var java = new THREE.Group(), rx = glide ? 0.34906584 : 0.2617994, rz = glide ? -Math.PI / 2 : -0.2617994;
    java.rotation.z = Math.PI;
    java.position.y = 24;
    [[5, -10, false, rz], [-5, 0, true, -rz]].forEach(function (w) {
      var part = new THREE.Group(), mesh = new THREE.Mesh(javaBox([w[1], 0, 0], [10, 20, 2], [22, 0], 1, w[2], 64, 32));
      part.position.set(w[0], 0, 2);
      part.rotation.set(rx, 0, w[3], 'ZYX');
      part.add(mesh);
      java.add(part);
      texture('/minecrafticons/mobs3d/equipment/wings/elytra.png', function (t) { mesh.material = material(t); redraw(); });
    });
    model.root.add(java);
  }
  // Baby zombie armor (the humanoid_baby layer, Java 26.3): HumanoidModel.createBabyArmorMesh, read out by
  // _tools/mobs3d/javamesh.py. Rows: [the mob's bone it follows, box x y z w h d (Java: y points down,
  // from that bone's pivot), uv, legs layer, mirrored]. The game moves each armor part onto the mob's own
  // part (copyPropertiesTo); the waist has none to follow, so it stays at its own spot (Java y 19).
  // Head, chest and feet use CubeDeformation(-0.1, 0.5, 0.3); legs (-0.1, 0.3, 0.3) shrunk 0.1 more.
  var BABY_ARMOR = {
    head: [['head', [-4.5, -7, -4.5, 9, 8, 8], [0, 0]]],
    chest: [['body', [-3, -3, -1.5, 6, 5, 3], [0, 17]], ['rightarm', [-1, 0, -1.53, 2, 5, 3], [30, 25]], ['leftarm', [-1, 0, -1.53, 2, 5, 3], [30, 17]]],
    legs: [['waist', [-3, -1.2, -1.49, 5.9, 2, 2.9], [0, 36], 1], ['leftleg', [-2, -0.2, -2, 3, 4, 3], [18, 24], 1], ['rightleg', [-1, -0.2, -2, 3, 4, 3], [18, 17], 1]],
    feet: [['leftleg', [-2, 2.9, -2, 3, 1, 3], [0, 25]], ['rightleg', [-1, 2.9, -2, 3, 1, 3], [0, 29], 0, 1]]
  };
  var BABY_ARMOR_MOBS = ' zombie husk drowned zombie_villager ';
  function babyArmor(model, eq) {
    ['head', 'chest', 'legs', 'feet'].forEach(function (slot) {
      var e = eq[slot], mat = e && matOf(e.id);
      if (!mat) return;
      var list = BABY_ARMOR[slot].map(function (x) {
        var waist = x[0] === 'waist', bn = waist ? 'body' : x[0], g = model.bones[bn];
        if (!g) return null;
        var v = waist ? [0, 5, 0] : g.userData.bone.v || [0, 0, 0], b = x[1];
        return { bone: bn, cube: { o: [v[0] + b[0], v[1] - b[1] - b[4], v[2] + b[2]], s: [b[3], b[4], b[5]], u: x[2],
          i: x[3] ? [-0.2, 0.2, 0.2] : [-0.1, 0.5, 0.3], m: x[4] ? 1 : 0, tw: 64, th: 64 } };
      }).filter(Boolean);
      var src = '/minecrafticons/mobs3d/equipment/humanoid_baby/' + mat;
      addCubes(model, list, mat === 'leather' ? leather(src + '.png', src + '_overlay.png', e.dye) : src + '.png');
    });
  }

  // ---- saddle and body slot (Java 26.3 equipment layers) ----
  // Most are the mob's own model drawn again a little bigger with the gear picture over it (the game's
  // PIG_SADDLE, HORSE_ARMOR, LLAMA_DECOR, WOLF_ARMOR layers use these inflates). Horse and camel saddles
  // are the saddle / bridle bones the Bedrock model already has; the nautilus has gear models of its own.
  var GEAR = '/minecrafticons/mobs3d/equipment/';
  var EQUINE = ' horse donkey mule skeleton_horse zombie_horse ';
  function gearMat(id) { return id.replace(/_(horse|nautilus)_armor$/, '').replace(/^golden$/, 'gold'); }
  function gearParts(o, base, ridden) {
    var eq = o.eq || {}, out = [], m = o.mob, rule = base[2] || {};
    function over(tex, grow) { out.push([base[0], tex, Object.assign({}, rule, { i: grow })]); }
    if (eq.saddle && !o.baby) {
      var reins = ridden ? ['reins*'] : []; // the reins only show while something rides it
      if (EQUINE.indexOf(' ' + m + ' ') > -1) out.push([base[0], GEAR + m + '_saddle/saddle.png', { o: ['saddle', 'bit*', 'bridle'].concat(reins), t: rule.t }]);
      else if (/^camel/.test(m)) out.push([base[0], GEAR + m + '_saddle/saddle.png', { o: ['saddle', 'bridle'].concat(reins), t: rule.t }]);
      else if (m === 'pig') over(GEAR + 'pig_saddle/saddle.png', 0.5);
      else if (m === 'strider') over(GEAR + 'strider_saddle/saddle.png', 0.02);
      else if (/nautilus$/.test(m)) out.push(['geometry.nautilus_saddle', GEAR + 'nautilus/saddle.png']);
    }
    var b = eq.body && eq.body.id, dye = eq.body && eq.body.dye;
    if (b && !o.baby) {
      if (m === 'horse') over(/^leather/.test(b) ? leather(GEAR + 'horse_body/leather.png', GEAR + 'horse_body/leather_overlay.png', dye) : GEAR + 'horse_body/' + gearMat(b) + '.png', 0.1);
      else if (/llama$/.test(m)) over(GEAR + 'llama_body/' + b.replace(/_carpet$/, '') + '.png', 0.5);
      // wolf armor: the scutes, plus its dyeable layer only once it's dyed (WOLF_ARMOR's dyeable overlay)
      else if (m === 'wolf') over(dye ? [GEAR + 'wolf_body/armadillo_scute.png', GEAR + 'wolf_body/armadillo_scute_overlay.png#' + dye] : GEAR + 'wolf_body/armadillo_scute.png', 0.2);
      else if (/nautilus$/.test(m)) out.push(['geometry.nautilus_armor', GEAR + 'nautilus/' + gearMat(b) + '.png']);
    } else if (m === 'trader_llama') over(GEAR + 'llama_body/trader_llama' + (o.baby ? '_baby' : '') + '.png', 0.5); // its blanket, unless a carpet covers it
    return out;
  }
  // Happy ghast harness (HappyGhastHarnessModel.createHarnessLayer, 26.3): a box over the body and the
  // goggles, at the ghast's 4x. Faces laid out the way the Bedrock ghast body maps its own sheet.
  function boxFaces(U, V, w, h, d) {
    var f = function (x, y, sw, sh) { return { uv: [x, y], uv_size: [sw, sh] }; };
    return { north: f(U + d, V + d, w, h), east: f(U, V + d, d, h), south: f(U + 2 * d + w, V + d, w, h), west: f(U + d + w, V + d, d, h),
      up: f(U + d, V, w, d), down: f(U + d + w, V + d, w, -d) };
  }
  function harness(model, id) {
    if (!model.bones.body) return;
    var tex = GEAR + 'happy_ghast_body/' + id + '.png';
    addCubes(model, [
      { bone: 'body', cube: { o: [-32, 0, -32], s: [64, 64, 64], u: boxFaces(0, 0, 16, 16, 16), i: 0.2, tw: 64, th: 64 } },
      { bone: 'body', cube: { o: [-32, 30, -32], s: [64, 20, 20], u: boxFaces(0, 32, 16, 5, 5), i: 0.6, tw: 64, th: 64 } }
    ], tex);
  }
  // A carved pumpkin worn on the head: a 10 px block (the game draws the block at 0.625) centred on the head box.
  function pumpkin(model) {
    var head = model.bones.head, c = head && (head.userData.bone.c || [])[0];
    if (!c) return;
    var o = [c.o[0] + c.s[0] / 2 - 5, c.o[1] + c.s[1] / 2 - 5, c.o[2] + c.s[2] / 2 - 5];
    ['north', 'south', 'east', 'west', 'up'].forEach(function (f) {
      var src = '/minecrafticons/blocks/' + (f === 'north' ? 'carved_pumpkin' : f === 'up' ? 'pumpkin_top' : 'pumpkin_side') + '.png';
      var one = {}; one[f] = { uv: [0, 0], uv_size: [16, 16] };
      addCubes(model, [{ bone: 'head', cube: { o: o, s: [10, 10, 10], u: one, tw: 16, th: 16 } }], src);
    });
  }
  // ---- any block, worn or held (Oct 19): shapes from mc-blocks3d.json (_tools/items/blocks3d.py) ----
  // Fetched the first time a mob wears or holds something that might be a block, then kept.
  var BLOCKS = null, blocksWait = null;
  function blocks(cb) {
    if (BLOCKS) return cb(BLOCKS);
    if (blocksWait) return blocksWait.push(held(cb));
    blocksWait = [held(cb)];
    var done = function (d) { BLOCKS = d; blocksWait.forEach(function (f) { f(d); }); blocksWait = null; };
    fetch('/mc-blocks3d.json').then(function (r) { return r.json(); }).then(done, function () { done({}); });
  }
  // One block's boxes as cubes for boneGeometry, grouped by texture: {key: {src, hex, cubes}}.
  // at = the block's lowest corner in Bedrock units, k = model units per block pixel.
  function blockCubes(shape, at, k) {
    var out = {};
    shape[1].forEach(function (el) {
      var a = el[0], b = el[1];
      Object.keys(el[2]).forEach(function (f) {
        var d = el[2][f], key = d[0] + (d[5] ? '#' : ''), one = {};
        one[f] = { uv: [d[1], d[2]], uv_size: [d[3] - d[1], d[4] - d[2]] };
        var g = out[key] = out[key] || { src: '/minecrafticons/blocks/' + d[0] + '.png', hex: d[5] ? shape[0] : null, cubes: [] };
        g.cubes.push({ o: [at[0] + a[0] * k, at[1] + a[1] * k, at[2] + a[2] * k], s: [(b[0] - a[0]) * k, (b[1] - a[1]) * k, (b[2] - a[2]) * k], u: one, tw: 16, th: 16 });
      });
    });
    return out;
  }
  // Worn on the head: 10 px (the game draws the block at 0.625), centred on the head box. Not a block: nothing.
  function blockOnHead(model, id) {
    var head = model.bones.head, c = head && (head.userData.bone.c || [])[0];
    if (!c) return;
    blocks(function (all) {
      var shape = all[id]; if (!shape) return;
      var at = [c.o[0] + c.s[0] / 2 - 5, c.o[1] + c.s[1] / 2 - 5, c.o[2] + c.s[2] / 2 - 5], parts = blockCubes(shape, at, 10 / 16);
      Object.keys(parts).forEach(function (key) {
        addCubes(model, parts[key].cubes.map(function (cube) { return { bone: 'head', cube: cube }; }), parts[key].src, parts[key].hex);
      });
    });
  }
  // ---- held items (Oct 19): the game's own chain, read from the 26.3 jar ----
  // ItemInHandLayer: the arm (ArmedModel.translateToHand), X -90, Y 180, then a step to the hand: (+-1, 2, -10) px,
  // a baby's (0, 1, -4.5). Then the item model's thirdperson_righthand / _lefthand display (ItemTransform.apply:
  // translate, rotate XYZ, scale, minus 8 px; the left hand mirrors x, y and z turns) and the model in its 0-16 box.
  // It's all built in Java model space (y down, x = the mob's left): ours turned 180 degrees about z (J2O).
  // DISP: [rotation, translation, scale, (the model's own lefthand entry)], from models/item + models/block.
  var DISP = {
    generated: [[0, 0, 0], [0, 3, 1], 0.55],
    handheld: [[0, -90, 55], [0, 4, 0.5], 0.85, [[0, 90, -55], [0, 4, 0.5], 0.85]],
    rod: [[0, 90, 55], [0, 4, 2.5], 0.85, [[0, -90, -55], [0, 4, 2.5], 0.85]],
    mace: [[0, -90, 55], [0, 4, 1], 1, [[0, 90, -55], [0, 4, 1], 1]],
    bow: [[-80, 260, -40], [-1, -2, 2.5], 0.9, [[-80, -280, 40], [-1, -2, 2.5], 0.9]],
    crossbow: [[-90, 0, -60], [2, 0.1, -3], 0.9, [[-90, 0, 30], [2, 0.1, -3], 0.9]],
    spear: [[5, 270, -40], [0, 2, 2], [1.7, 1.7, 0.85], [[5, -270, 40], [0, 2, 2], [1.7, 1.7, 0.85]]],
    brush: [[0, 0, 45], [0, 4, 0], 0.9, [[0, 0, -45], [0, 4, 0], 0.9]],
    goat_horn: [[0, 180, 0], [0, 3, 1], 0.55, [[0, 0, 0], [0, 3, 1], 0.55]],
    bud: [[0, 0, 0], [0, 4, 1], 0.55],
    hanging_roots: [[0, 0, 0], [0, 0, 1], 0.55],
    spike: [[0, 100, 0], [-1, -1, 0], 0.9],
    shield: [[0, 90, 0], [10, 6, -4], 1, [[0, 90, 0], [10, 6, 12], 1]],
    trident: [[0, 60, 0], [11, 17, -2], 1, [[0, 60, 0], [3, 17, 12], 1]],
    block: [[75, 45, 0], [0, 2.5, 0], 0.375],
    thin: [[75, 45, 0], [0, 2.5, 2], 0.375],
    bed: [[30, 340, 0], [0, 3, -2], 0.23],
    shelf: [[75, 135, 0], [-3, 1, 0], 0.4],
    lightning_rod: [[0, 0, 0], [0, 2, 0.5], 0.4],
    end_rod: [[0, 0, 0], [0, 0, 0], 0.375],
    heavy_core: [[45, 45, 0], [0, 3, 0], 0.5],
    shelf_mushroom: [[53, 0, 0], [0, 2.25, 0.25], 0.375],
    big_dripleaf: [[0, 0, 0], [0, 1, 0], 0.55],
    small_dripleaf: [[0, 0, 0], [0, 4, 1], 0.55],
    spyglass: [[0, 0, 0], [0, -2, 0], 1]
  };
  function dispOf(id, isBlock) {
    var k = /_(sword|axe|pickaxe|shovel|hoe)$|^(bamboo|blaze_rod|bone|breeze_rod|stick|debug_stick)$/.test(id) ? 'handheld'
      : /^(fishing_rod|carrot_on_a_stick|warped_fungus_on_a_stick)$/.test(id) ? 'rod'
      : /_spear$/.test(id) ? 'spear'
      : /_amethyst_bud$/.test(id) ? 'bud'
      : /^(pointed_dripstone|sulfur_spike)$/.test(id) ? 'spike'
      : /_bed$/.test(id) ? 'bed'
      : /_shelf$/.test(id) ? 'shelf'
      : /lightning_rod$/.test(id) ? 'lightning_rod'
      : /_(trapdoor|carpet|pressure_plate)$|^(daylight_detector|snow)$/.test(id) ? 'thin'
      : DISP[id] ? id : isBlock ? 'block' : 'generated';
    return DISP[k];
  }
  function M4() { return new THREE.Matrix4(); }
  function T(x, y, z) { return M4().makeTranslation(x, y, z); }
  function Sc(x, y, z) { return M4().makeScale(x, y == null ? x : y, z == null ? x : z); }
  function Rx(d) { return M4().makeRotationX(rad(d)); }
  function Ry(d) { return M4().makeRotationY(rad(d)); }
  function chain(list) { return list.reduce(function (m, x) { return m.multiply(x); }, M4()); }
  function J2O() { return Sc(-1, -1, 1); }
  function disp(D, left) {
    var d = left && D[3] ? D[3] : D, r = d[0], s = [].concat(d[2]), m = left ? -1 : 1;
    if (s.length === 1) s = [s[0], s[0], s[0]];
    return chain([T(m * d[1][0], d[1][1], d[1][2]), M4().makeRotationFromEuler(new THREE.Euler(rad(r[0]), rad(m * r[1]), rad(m * r[2]), 'XYZ')), Sc(s[0], s[1], s[2]), T(-8, -8, -8)]);
  }
  function geom(pos, uv, col) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  }
  // A block model's boxes in its own 0-16 space. FACEV = Java's FaceInfo corners (0 = from, 1 = to), which take
  // the face's uv as (u0 v0) (u0 v1) (u1 v1) (u1 v0).
  var FACEV = {
    down: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]], up: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
    north: [[1, 1, 0], [1, 0, 0], [0, 0, 0], [0, 1, 0]], south: [[0, 1, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1]],
    west: [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]], east: [[1, 1, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]]
  };
  function blockMesh(shape) {
    var g = new THREE.Group(), by = {};
    shape[1].forEach(function (el) {
      Object.keys(el[2]).forEach(function (f) {
        var d = el[2][f], key = d[0] + (d[5] ? '#' : ''), sh = SHADE[f];
        var q = by[key] = by[key] || { src: '/minecrafticons/blocks/' + d[0] + '.png', hex: d[5] ? shape[0] : null, pos: [], uv: [], col: [] };
        var uv = [[d[1], d[2]], [d[1], d[4]], [d[3], d[4]], [d[3], d[2]]];
        [0, 1, 2, 0, 2, 3].forEach(function (i) {
          var c = FACEV[f][i];
          q.pos.push(el[c[0]][0], el[c[1]][1], el[c[2]][2]);
          q.uv.push(uv[i][0] / 16, 1 - uv[i][1] / 16);
          q.col.push(sh, sh, sh);
        });
      });
    });
    Object.keys(by).forEach(function (key) {
      var q = by[key], mesh = new THREE.Mesh(geom(q.pos, q.uv, q.col));
      tinted(q.src, q.hex, function (t) { mesh.material = material(t); redraw(); });
      g.add(mesh);
    });
    return g;
  }
  // A flat item (item/generated): its picture as a 1 px slab of pixels, z 7.5 to 8.5, filling the 0-16 square.
  function itemMesh(id, cb) {
    var src = '/minecrafticons/items/' + (id === 'crossbow' ? 'crossbow_standby' : /_spear$/.test(id) ? id + '_in_hand' : id) + '.png';
    texture(src, function (t) {
      if (!t) return;
      var img = t.image, n = img.width, c = document.createElement('canvas'); c.width = c.height = n;
      var x = c.getContext('2d'); x.drawImage(img, 0, 0);
      var px = x.getImageData(0, 0, n, n).data, pos = [], col = [], k = 16 / n;
      function on(i, j) { return i >= 0 && j >= 0 && i < n && j < n && px[(j * n + i) * 4 + 3] > 20; }
      function quad(p, s) { [0, 1, 2, 0, 2, 3].forEach(function (i) { pos.push(p[i][0], p[i][1], p[i][2]); col.push(s[0], s[1], s[2]); }); }
      for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) {
        if (!on(i, j)) continue;
        var o = (j * n + i) * 4, rgb = [px[o] / 255, px[o + 1] / 255, px[o + 2] / 255];
        var x0 = i * k, x1 = x0 + k, y1 = 16 - j * k, y0 = y1 - k, z0 = 7.5, z1 = 8.5;
        var dim = function (f) { return [rgb[0] * f, rgb[1] * f, rgb[2] * f]; };
        quad([[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]], dim(0.9));
        quad([[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0]], dim(0.9));
        if (!on(i, j - 1)) quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], dim(1));
        if (!on(i, j + 1)) quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], dim(0.5));
        if (!on(i - 1, j)) quad([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], dim(0.7));
        if (!on(i + 1, j)) quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], dim(0.7));
      }
      cb(new THREE.Mesh(geom(pos, null, col), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    });
  }
  // Shield and trident are drawn by their own models (ShieldModel / TridentModel), in Java model boxes:
  // [x, y, z, w, h, d, u, v, mirror]. The renderer flips them with scale(1, -1, -1) (items/<id>.json).
  // Textures: entity/shield/shield_base_nopattern.png and entity/trident/trident.png from the jar.
  var SHIELD = { tex: '/minecrafticons/entity/shield_base_nopattern.png', w: 64, h: 64, c: [[-6, -11, -2, 12, 22, 1, 0, 0], [-1, -3, -1, 2, 6, 6, 26, 0]] };
  var TRIDENT = { tex: '/minecrafticons/entity/trident.png', w: 32, h: 32, c: [[-0.5, 2, -0.5, 1, 25, 1, 0, 6], [-1.5, 0, -0.5, 3, 2, 1, 4, 0], [-2.5, -3, -0.5, 1, 4, 1, 4, 3], [-0.5, -4, -0.5, 1, 4, 1, 0, 0], [1.5, -3, -0.5, 1, 4, 1, 4, 3, 1]] };
  // boneGeometry reads Bedrock boxes (y up, x drawn mirrored), so a Java box comes out of it already turned by J2O.
  function boxMesh(m) {
    var cubes = m.c.map(function (b) { return { o: [b[0], -(b[1] + b[4]), b[2]], s: [b[3], b[4], b[5]], u: [b[6], b[7]], m: b[8] || 0 }; });
    var mesh = new THREE.Mesh(boneGeometry({}, { w: m.w, h: m.h }, [0, 0, 0], cubes));
    texture(m.tex, function (t) { mesh.material = material(t); redraw(); });
    return mesh;
  }
  // Tools and weapons are never blocks, so those skip the block list.
  var FLAT = /_(sword|axe|pickaxe|shovel|hoe|spear)$|^(bow|crossbow|mace|totem_of_undying|fishing_rod)$/;
  // cb(mesh, its matrix from the model's own space to the hand)
  function heldMesh(id, left, cb) {
    var box = id === 'shield' ? SHIELD : id === 'trident' ? TRIDENT : null;
    if (box) return cb(boxMesh(box), disp(DISP[id], left).multiply(Sc(1, -1, -1)).multiply(J2O()));
    var flat = function () { itemMesh(id, function (mesh) { cb(mesh, disp(dispOf(id, false), left)); }); };
    if (FLAT.test(id)) return flat();
    blocks(function (all) { if (all[id]) cb(blockMesh(all[id]), disp(dispOf(id, true), left)); else flat(); });
  }
  // The arm for what it holds (HumanoidModel ITEM: xRot * 0.5 - 18 degrees, yRot 0), for the mobs whose arms
  // hang; zombies keep theirs out (animateZombieArms runs after). A pillager holds a crossbow like a rifle
  // (AnimationUtils.animateCrossbowHold); an allay holding anything brings both hands forward (AllayModel).
  // LeftHanded: the main hand is the left arm.
  var SKELETONS = ' skeleton stray bogged wither_skeleton parched ', ITEM_POSE = SKELETONS + ' piglin piglin_brute ';
  function holdPose(pose, o) {
    var eq = o.eq || {}, p = JSON.parse(JSON.stringify(pose || {})), main = o.left ? 'left' : 'right', off = o.left ? 'right' : 'left', s = o.left ? -1 : 1;
    function set(n, f) { var a = p[n] = p[n] || {}; a.r = f(a.r || [0, 0, 0]); }
    if (o.mob === 'pillager' && eq.mainhand && eq.mainhand.id === 'crossbow') {
      set(main + 'arm', function (r) { return [-84.27, -17.19 * s, r[2]]; }); // -pi/2 + 0.1, -0.3
      set(off + 'arm', function (r) { return [-85.94, 34.38 * s, r[2]]; }); // -1.5, 0.6
    } else if (ITEM_POSE.indexOf(' ' + o.mob + ' ') > -1) {
      [[main, eq.mainhand], [off, eq.offhand]].forEach(function (h) { if (h[1]) set(h[0] + 'arm', function (r) { return [r[0] * 0.5 - 18, 0, r[2]]; }); });
    } else if (o.mob === 'allay' && eq.mainhand) {
      set('right_arm', function () { return [-60, 16, 25]; });
      set('left_arm', function () { return [-60, -16, -25]; });
    }
    return p;
  }
  function holdItems(model, o) {
    var eq = o.eq || {};
    [['mainhand', !o.left], ['offhand', !!o.left]].forEach(function (h) {
      var e = eq[h[0]], right = h[1];
      if (!e) return;
      var side = right ? 'right' : 'left', arm = bone(model, [side + 'arm', side + '_arm']), at = arm, pre = M4();
      // translateToHand: the allay holds at its chest (body, 1 down, 3 back, turned with its arms, 0.7 size);
      // a vex at 0.55 size, a little in from the hand
      if (o.mob === 'allay') { at = bone(model, ['body']); pre = chain([T(0, 1, 3), Rx(-60), Sc(0.7), T(1, 0, 0)]); }
      if (o.mob === 'vex') pre = chain([Sc(0.55), T(right ? 0.75 : -0.75, -2.5, 1.25)]);
      if (!at) return;
      var m = J2O().multiply(pre).multiply(chain([Rx(-90), Ry(180), o.baby ? T(0, 1, -4.5) : T(right ? 1 : -1, 2, -10)]));
      // SkeletonModel.translateToHand: the arm 1 px further in first (a move in the arm's parent, turned into the arm here)
      if (SKELETONS.indexOf(' ' + o.mob + ' ') > -1) {
        var v = new THREE.Vector3(right ? -1 : 1, 0, 0).applyQuaternion(arm.quaternion.clone().invert());
        m.premultiply(T(v.x, v.y, v.z));
      }
      heldMesh(e.id, !right, function (mesh, M) {
        mesh.matrixAutoUpdate = false;
        mesh.userData.held = true; // left out of the framing (show)
        mesh.matrix.copy(m).multiply(M);
        at.add(mesh);
        redraw();
      });
    });
  }


  // ---- show a mob ----
  // o = { mob, baby, eq: {slot: {id, owner}} (saddle and body too), scale, pumpkin (snow golem),
  //       skin: [texture layers, bottom first] in place of the mob's own texture (villagers, cat looks...),
  //       look: the variant picked; one with its own model (warm cow, puffed pufferfish) swaps the geometry,
  //       chest (donkey / llama bags), flip (Dinnerbone), peek + face (shulker), grow (size from Size / type),
  //       glide: FallFlying (elytra spread), fx: [{ c: effect colour, faint }] its visible effects' particles, invisible: has Invisibility,
  //       riders: [the same for each mob on top, bottom first] }
  //       eq items can carry dye (leather, wolf armor) and be any block (worn or held, mc-blocks3d.json).
  // Size and seat of every mob, from Java 26.3 EntityTypes, in blocks: [height, where a passenger sits,
  // the mob's own riding offset (humanoids sink 0.7 into the saddle), seat z (minus = further back)].
  var SEAT = {"allay":[0.6,0.6,0.04],"armadillo":[0.65,0.65],"armor_stand":[1.975,1.975],"axolotl":[0.42,0.42],"bat":[0.9,0.9],"bee":[0.5,0.5],"blaze":[1.8,1.8],"bogged":[1.99,1.99,-0.7],"breeze":[1.77,1.77],"camel":[2.375,2.0],"camel_husk":[2.375,2.0],"cat":[0.7,0.5125],"cave_spider":[0.5,0.5],"chicken":[0.7,0.7,0,-0.1],"cod":[0.3,0.3],"copper_golem":[0.98,0.98],"cow":[1.4,1.3687],"creaking":[2.7,2.7],"creeper":[1.7,1.7],"dolphin":[0.6,0.6],"donkey":[1.5,1.1125],"drowned":[1.95,2.0125,-0.7],"elder_guardian":[1.9975,2.3506],"enderman":[2.9,2.8062],"endermite":[0.3,0.2375],"ender_dragon":[8.0,3.0],"evoker":[1.95,2.0,-0.6],"fox":[0.7,0.6375,0,-0.25],"frog":[0.5,0.375,0,-0.25],"ghast":[4.0,4.0625,0.5],"happy_ghast":[4.0,4.0,0.5,1.7],"giant":[12.0,12.0,-3.75],"glow_squid":[0.8,0.8],"goat":[1.3,1.1125],"guardian":[0.85,0.975],"hoglin":[1.4,1.4937],"horse":[1.6,1.4438],"husk":[1.95,2.075,-0.7],"illusioner":[1.95,2.0,-0.6],"iron_golem":[2.7,2.7],"llama":[1.87,1.37,0,-0.3],"magma_cube":[0.52,0.52],"mooshroom":[1.4,1.3687],"mule":[1.6,1.2125],"nautilus":[0.95,1.1375],"ocelot":[0.7,0.6375],"panda":[1.25,1.25],"parched":[1.99,1.99,-0.7],"parrot":[0.9,0.4625],"phantom":[0.5,0.3375,-0.125],"pig":[0.9,0.8688],"piglin":[1.95,2.0125,-0.7],"piglin_brute":[1.95,2.0125,-0.7],"pillager":[1.95,2.0,-0.6],"polar_bear":[1.4,1.4],"pufferfish":[0.7,0.7],"rabbit":[0.6,0.6],"ravager":[2.2,2.2625,0,-0.0625],"salmon":[0.4,0.4],"sheep":[1.3,1.2375],"shulker":[1.0,1.0],"silverfish":[0.3,0.2375],"skeleton":[1.99,1.99,-0.7],"skeleton_horse":[1.6,1.3188],"slime":[0.52,0.52],"sniffer":[1.75,2.0938],"snow_golem":[1.9,1.9],"spider":[0.9,0.765],"squid":[0.8,0.8],"stray":[1.99,1.99,-0.7],"strider":[1.7,1.7],"sulfur_cube":[0.49,0.49],"tadpole":[0.3,0.3],"trader_llama":[1.87,1.37,0,-0.3],"tropical_fish":[0.4,0.4],"turtle":[0.4,0.5563,0,-0.25],"vex":[0.8,0.7375,0.04],"villager":[1.95,1.95],"vindicator":[1.95,2.0,-0.6],"wandering_trader":[1.95,1.95],"warden":[2.9,3.15],"witch":[1.95,2.2625],"wither":[3.5,3.5],"wither_skeleton":[2.4,2.4,-0.875],"wolf":[0.85,0.8187,0,-0.0625],"zoglin":[1.4,1.4937],"zombie":[1.95,2.0125,-0.7],"zombie_horse":[1.6,1.3188],"zombie_nautilus":[0.95,1.1375],"zombie_villager":[1.95,2.125,-0.7],"zombified_piglin":[1.95,2.0,-0.7]};
  // Riders that sit with their legs out (the riding pose of HumanoidModel, VillagerModel, IllagerModel,
  // WitchModel). The first group also drops its arms a little (HumanoidModel: arms xRot -= pi/5); zombies
  // keep theirs straight out, because animateZombieArms sets them again after the riding pose.
  var SIT_ARMS = ' skeleton stray bogged wither_skeleton parched piglin piglin_brute enderman ';
  var SIT = SIT_ARMS + ' zombie husk drowned giant zombie_villager zombified_piglin villager wandering_trader witch pillager vindicator evoker illusioner ';
  // Java's riding legs: xRot -1.4137 rad (81 degrees forward), yRot +-pi/10 (18), zRot +-0.0785 (4.5).
  function sitPose(pose, geo, arms) {
    var p = JSON.parse(JSON.stringify(pose || {}));
    function add(n, r) {
      if (!geo.b.some(function (b) { return b.n === n; })) return;
      var a = p[n] = p[n] || {};
      a.r = (a.r || [0, 0, 0]).map(function (v, i) { return v + r[i]; });
    }
    ['rightleg', 'leg0'].forEach(function (n) { add(n, [-81, 18, 4.5]); });
    ['leftleg', 'leg1'].forEach(function (n) { add(n, [-81, -18, -4.5]); });
    if (arms) ['rightarm', 'leftarm'].forEach(function (n) { add(n, [-36, 0, 0]); });
    return p;
  }
  function seat(id) { return SEAT[id] || [1, 1]; }
  // Shulker: the side it's stuck to (AttachFace 0-5: down, up, north, south, west, east) turns the whole box.
  var FACE = [[0, 0, 0], [Math.PI, 0, 0], [-Math.PI / 2, 0, 0], [Math.PI / 2, 0, 0], [0, 0, -Math.PI / 2], [0, 0, Math.PI / 2]];

  // One mob as a group standing on y = 0. ridden: something sits on it (horse reins show); riding: it sits.
  function makeMob(o, ridden, riding) {
    var m = data.mobs[o.mob];
    if (!m) return null;
    var age = o.baby && m.b ? m.b : m.a, pose = age.a || {}, first = age.p[0], rule = first[2] || {};
    var gid = (age.g && age.g[o.look]) || first[0];
    // a donkey, mule or llama carrying a chest shows its bags (Bedrock hides those bones by default)
    if (o.chest && rule.h) rule = Object.assign({}, rule, { h: rule.h.filter(function (b) { return b !== 'bag*' && b !== 'chest*'; }) });
    var base = [gid, o.skin || first[1], rule];
    if (riding && SIT.indexOf(' ' + o.mob + ' ') > -1) pose = sitPose(pose, data.geo[gid], SIT_ARMS.indexOf(' ' + o.mob + ' ') > -1);
    if (HOLD.indexOf(' ' + o.mob + ' ') > -1) pose = holdPose(pose, o);
    // a freshly summoned shulker is shut (Peek 0); Peek 100 lifts the lid half a block
    if (o.mob === 'shulker') { pose = Object.assign({}, pose); pose.lid = Object.assign({}, pose.lid, { p: [0, (o.peek || 0) * 8, 0] }); }
    var parts = [base].concat(age.p.slice(1), gearParts(o, base, ridden));
    var body = new THREE.Group();
    var models = parts.map(function (p, i) { return build(p, body, pose, i); });
    var main = models[age.p.length > 1 && /armor|clothes/.test(age.p[0][0]) ? 1 : 0];
    // old-style baby for mobs without a baby model: half size, big head
    var k = o.baby && m.b ? m.b.z || 1 : (o.mob === 'giant' ? 6 : 1) * m.a.s;
    if (o.baby && !m.b) { k *= 0.5; var hd = bone(main, ['head']); if (hd) hd.scale.setScalar(1.5); }
    var size = (o.grow || 1) * Math.max(0.1, Math.min(3, o.scale || 1));
    var ws = (o.baby ? 0.5 : 1) * size; // the game's size, 1 = a normal adult
    body.scale.setScalar(k * size);
    if (ARMOR.indexOf(' ' + o.mob + ' ') > -1) dressUp(main, o.eq || {}, o.mob, o.baby, o.glide);
    if (HOLD.indexOf(' ' + o.mob + ' ') > -1) holdItems(main, o);
    if (o.pumpkin) pumpkin(main);
    if (o.mob === 'happy_ghast' && !o.baby && o.eq && o.eq.body) harness(main, o.eq.body.id);
    var g = new THREE.Group(), H = seat(o.mob)[0] * 16 * ws;
    if (o.mob === 'shulker' && o.face) {
      // turn around the box's middle
      var turn = new THREE.Group();
      body.position.y = -H / 2; turn.position.y = H / 2;
      turn.rotation.set(FACE[o.face][0], FACE[o.face][1], FACE[o.face][2]);
      turn.add(body); g.add(turn);
    } else g.add(body);
    // Dinnerbone / Grumm: upside down, lifted by its height + 0.1 (LivingEntityRenderer.setupRotations)
    if (o.flip) { g.rotation.z = Math.PI; g.position.y = H + 1.6 * ws; }
    var wrap = new THREE.Group();
    wrap.add(g);
    return { g: wrap, ws: ws };
  }

  // ---- effect particles (Oct 19) ----
  // What the game does for a mob with visible effects (LivingEntity.tickEffects + SpellParticle, 26.3):
  // each tick, a 1 in 4 chance (1 in 15 while invisible, 5x rarer when every effect is ambient) of one
  // swirl from a random effect, somewhere in the mob's box. It drifts up and out, lives 8 to 40 ticks,
  // runs effect_7 down to effect_0, tinted to that effect's colour; ambient ones at 15% alpha.
  // Drawn into the view, so they turn with the mob. Only animates while there are particles.
  var FXT = [], emitters = [], parts = [], looping = false, lastT = 0, acc = 0;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the 8 frames, effect_7 first (particles/entity_effect.json order); cb once they're all in
  var fxWait = null;
  function fxFrames(cb) {
    if (FXT.length === 8) return cb();
    if (fxWait) return fxWait.push(cb);
    fxWait = [cb];
    var left = 8;
    for (var i = 0; i < 8; i++) (function (j) {
      texture('/minecrafticons/particles/effect_' + (7 - j) + '.png', function (t) {
        FXT[j] = t;
        if (--left) return;
        var w = fxWait; fxWait = null; w.forEach(function (f) { f(); });
      });
    })(i);
  }
  function spawn(em, age) {
    var c = em.list[Math.floor(Math.random() * em.list.length)], b = em.box;
    var mat = new THREE.SpriteMaterial({ color: new THREE.Color('#' + c.c), transparent: true, opacity: c.faint ? 0.15 : 1, depthWrite: false });
    var sp = new THREE.Sprite(mat), size = 16 * 2 * 0.1 * (Math.random() * 0.5 + 0.5) * 0.75; // quadSize is half the width
    sp.scale.set(size, size, 1);
    // Particle(): a random push, normalised to a small speed, plus 0.1 up; SpellParticle keeps 1/5 of the rise
    var vx = 0.5 - Math.random() + (Math.random() * 2 - 1) * 0.4, vy = 1 + (Math.random() * 2 - 1) * 0.4, vz = 0.5 - Math.random() + (Math.random() * 2 - 1) * 0.4;
    var d = Math.hypot(vx, vy, vz) || 1, f = (Math.random() + Math.random() + 1) * 0.15 * 0.4;
    var p = { sp: sp, x: b.min.x + Math.random() * (b.max.x - b.min.x), y: b.min.y + Math.random() * (b.max.y - b.min.y), z: b.min.z + Math.random() * (b.max.z - b.min.z),
      vx: vx / d * f * 16, vy: (vy / d * f + 0.1) * 0.2 * 16, vz: vz / d * f * 16, age: age || 0, life: Math.floor(8 / (Math.random() * 0.8 + 0.2)) };
    p.px = p.x; p.py = p.y; p.pz = p.z;
    sp.position.set(p.x, p.y, p.z);
    em.root.add(sp);
    parts.push(p);
    return p;
  }
  function tickFx() {
    emitters.forEach(function (em) { if (Math.random() * em.odds < 1) spawn(em); });
    parts = parts.filter(function (p) {
      if (++p.age >= p.life) { p.sp.parent && p.sp.parent.remove(p.sp); p.sp.material.dispose(); return false; }
      p.px = p.x; p.py = p.y; p.pz = p.z;
      p.vy += 0.004 * 16; // gravity -0.1: it speeds up as it rises
      p.x += p.vx; p.y += p.vy; p.z += p.vz;
      p.vx *= 0.96; p.vy *= 0.96; p.vz *= 0.96;
      return true;
    });
  }
  function frameOf(p) { var t = FXT[Math.min(7, Math.floor(p.age * 7 / Math.max(1, p.life)))]; if (t && p.sp.material.map !== t) { p.sp.material.map = t; p.sp.material.needsUpdate = true; } }
  function loop(t) {
    if (!emitters.length && !parts.length) { looping = false; return; }
    acc += Math.min(250, t - (lastT || t)); lastT = t;
    while (acc >= 50) { tickFx(); acc -= 50; } // 20 ticks a second, like the game
    var k = acc / 50;
    parts.forEach(function (p) { p.sp.position.set(p.px + (p.x - p.px) * k, p.py + (p.y - p.py) * k, p.pz + (p.z - p.pz) * k); frameOf(p); });
    pivot.rotation.y = yaw;
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  // m = { g: the mob's group, ws: its size }, fx = [{ c: 'rrggbb', faint }], inv = the mob is invisible
  function emit(m, fx, inv) {
    if (!fx || !fx.length) return;
    var box = new THREE.Box3().setFromObject(m.g), allFaint = fx.every(function (x) { return x.faint; });
    var em = { root: view, box: box, list: fx, odds: (inv ? 15 : 4) * (allFaint ? 5 : 1) };
    fxFrames(function () {
      if (em.root !== view) return; // another mob was shown while the frames loaded
      emitters.push(em);
      // reduced motion: a few swirls standing still, so the colours still show
      if (still) { for (var i = 0; i < 6; i++) frameOf(spawn(em, 3)); redraw(); return; }
      if (!looping) { looping = true; lastT = 0; acc = 0; requestAnimationFrame(loop); }
    });
  }

  function show(o) {
    wantShow = o;
    if (!THREE || !data) return;
    if (view && view !== shown) pivot.remove(view); // one that never finished loading
    view = null;
    parts.forEach(function (p) { if (p.sp.parent) p.sp.parent.remove(p.sp); p.sp.material.dispose(); });
    parts = []; emitters = [];
    gen++; pend = 0;
    var built = hold(); // released once everything below has asked for its textures
    stage.classList.add('is-loading');
    clearTimeout(loadT);
    loadT = setTimeout(reveal, 6000); // a texture that never answers (a player skin) mustn't hide the mob for good
    var riders = o.riders || [], first = makeMob(o, riders.length > 0, false);
    if (!first) { clearTimeout(loadT); stage.classList.remove('is-loading'); stage.classList.add('no-3d'); return; }
    stage.classList.remove('no-3d');
    view = new THREE.Group();
    view.visible = false;
    view.add(first.g);
    // Riders, bottom first: each sits at the mount's passenger point plus its own riding offset, both
    // scaled by that mob's size (Entity.getPassengerRidingPosition / getVehicleAttachmentPoint).
    var below = { id: o.mob, ws: first.ws, y: 0, z: 0 }, made = [[first, o]];
    riders.forEach(function (r, i) {
      var m = makeMob(r, i < riders.length - 1, true);
      if (!m) return;
      var st = seat(below.id), y = below.y + st[1] * 16 * below.ws + (seat(r.mob)[2] || 0) * 16 * m.ws;
      var z = below.z - (st[3] || 0) * 16 * below.ws; // the model faces -z, so "further back" is +z
      m.g.position.set(0, y, z);
      view.add(m.g);
      below = { id: r.mob, ws: m.ws, y: y, z: z };
      made.push([m, r]);
    });
    // Frame on the plain adult (so a baby shows up smaller, as in game), grown to fit anything bigger:
    // a big slime, a Size attribute, the riders.
    var adult = makeMob({ mob: o.mob }, false, false).g;
    adult.updateMatrixWorld(true);
    view.updateMatrixWorld(true);
    made.forEach(function (x) { emit(x[0], x[1].fx, x[1].invisible); });
    // Held items don't count: a raised sword or a trident mustn't zoom the mob out (they're taken off for the
    // measure; ones whose textures are still loading aren't on yet, so this keeps every item the same).
    var off = [];
    view.traverse(function (x) { if (x.userData.held) off.push([x, x.parent]); });
    off.forEach(function (p) { p[1].remove(p[0]); });
    var box = new THREE.Box3().setFromObject(adult).union(new THREE.Box3().setFromObject(view));
    off.forEach(function (p) { p[1].add(p[0]); });
    // fit the height, and the widest turn (the horizontal diagonal) against the canvas width
    var sz = box.getSize(new THREE.Vector3()), t = Math.tan(rad(camera.fov / 2)), wide = Math.hypot(sz.x, sz.z);
    nextFrame = { y: (box.min.y + box.max.y) / 2, d: Math.max(sz.y / (2 * t), wide / (2 * t * camera.aspect), 12) * 1.15 + wide / 2 };
    pivot.add(view);
    built();
  }
  // The Minecraft lobby hero (mc-lobby-hero.js) draws its own scene: it only borrows three.js and the mob builder.
  // mob(o) = makeMob's group (find bones by userData.bone.n); loading() = textures still on their way.
  var libWait = [];
  function lib(cb) {
    var api = { THREE: null, mob: function (o) { return makeMob(o, false, false); }, loading: function () { return pend > 0; } };
    if (THREE && data) { api.THREE = THREE; return cb(api); }
    libWait.push(cb);
    if (libWait.length > 1) return;
    var got = 0;
    function ready() {
      if (++got < 2) return;
      THREE = api.THREE = window.THREE;
      libWait.forEach(function (f) { f(api); });
    }
    if (window.THREE) ready(); else load('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js', ready);
    fetch('/mc-mob3d.json').then(function (r) { return r.json(); }).then(function (d) { data = d; ready(); });
  }
  return { mount: mount, show: show, lib: lib };
})();
