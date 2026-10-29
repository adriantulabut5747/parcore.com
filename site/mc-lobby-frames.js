/* Popular tools on /minecraft/ (Oct 28 2026): item frames on a dark-oak wall, drawn live in three.js behind the
   real links (.ml-fr). Each frame sits exactly behind its link's .ml-fr-hole: the camera stands where one world
   unit is one CSS pixel on the wall. A frame is built in "frame pixels" (12 across, like the game's model:
   birch planks border, leather back); the item is the tool's own 16px sprite extruded the way the game draws
   items (one thin slab per pixel). Point at (or focus) a link and its item turns 45 degrees, like clicking an
   item frame. The enchanted book keeps its glint. Loads when the wall nears the screen; the CSS draws flat
   frames until then (and for good without WebGL). three.js + the loader come from mc-mob3d.js (MobView.lib). */
(function () {
  var wall = document.getElementById('mlWall');
  if (!wall) return;
  var canvas = wall.querySelector('.ml-wall-3d'), links = Array.prototype.slice.call(wall.querySelectorAll('.ml-fr'));
  links.forEach(function (l) { l.querySelector('.ml-fr-hole').style.setProperty('--item', 'url("' + l.getAttribute('data-item') + '")'); });
  // Phones keep the flat CSS frames: no three.js (~600 KB) and no WebGL context just for a hover effect they can't
  // use. Desktop fetches mc-mob3d.js (which lends three.js) only when the wall nears the screen.
  if (!window.IntersectionObserver || matchMedia('(max-width: 970px), (hover: none)').matches) return;
  var REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function withMobView(cb) {
    if (window.MobView) return cb();
    var s = document.createElement('script');
    s.src = '/mc-mob3d.js?v=20261028lib'; s.onload = function () { if (window.MobView) cb(); };
    document.head.appendChild(s);
  }
  var io = new IntersectionObserver(function (e) {
    if (!e[0].isIntersecting) return;
    io.disconnect();
    try { var t = document.createElement('canvas'); if (!(t.getContext('webgl2') || t.getContext('webgl'))) return; } catch (x) { return; }
    withMobView(function () { MobView.lib(build); });
  }, { rootMargin: '400px' });
  io.observe(wall);

  function build(api) {
    var THREE = api.THREE, renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); } catch (e) { return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 1, 5000), root = new THREE.Group();
    scene.add(root);
    var loader = new THREE.TextureLoader(), pend = 0;
    function tex(src, repeat) {
      pend++;
      var t = loader.load(src, function () { pend--; kick(); }, undefined, function () { pend--; });
      t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
      if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    }
    // ---- a box in frame pixels, its texture repeating once every 16 units (one block face), shaded like the game ----
    var SH = { f: 1, b: 0.5, u: 0.92, d: 0.55, l: 0.72, r: 0.72 };
    function box(a, b, uv) {
      var x0 = a[0], y0 = a[1], z0 = a[2], x1 = b[0], y1 = b[1], z1 = b[2], pos = [], uvs = [], col = [];
      var F = {
        f: [[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1], x1 - x0, y1 - y0],
        b: [[x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0], x1 - x0, y1 - y0],
        u: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], x1 - x0, z1 - z0],
        d: [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], x1 - x0, z1 - z0],
        l: [[x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0], z1 - z0, y1 - y0],
        r: [[x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1], z1 - z0, y1 - y0]
      };
      Object.keys(F).forEach(function (k) {
        var q = F[k], u0 = uv ? uv[0] : 0, v0 = uv ? uv[1] : 0, du = uv ? uv[2] : q[4] / 16, dv = uv ? uv[3] : q[5] / 16;
        var t = [[u0, v0 + dv], [u0 + du, v0 + dv], [u0 + du, v0], [u0, v0]];
        // corners run clockwise seen from outside; three.js keeps counter-clockwise faces, so 0-2-1
        [0, 2, 1, 0, 3, 2].forEach(function (i) { pos.push(q[i][0], q[i][1], q[i][2]); uvs.push(t[i][0], t[i][1]); col.push(SH[k], SH[k], SH[k]); });
      });
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      return g;
    }
    var birch = new THREE.MeshBasicMaterial({ map: tex('/minecrafticons/blocks/birch_planks.png', true), vertexColors: true });
    var leather = new THREE.MeshBasicMaterial({ map: tex('/minecrafticons/gui/lobby/item_frame.png'), vertexColors: true });
    var shadowTex = (function () {
      var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d');
      var g = x.createRadialGradient(32, 32, 6, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
    })();
    function frame() {
      var g = new THREE.Group();
      [[[-6, 5, 0], [6, 6, 1]], [[-6, -6, 0], [6, -5, 1]], [[-6, -5, 0], [-5, 5, 1]], [[5, -5, 0], [6, 5, 1]]].forEach(function (b) { g.add(new THREE.Mesh(box(b[0], b[1]), birch)); });
      g.add(new THREE.Mesh(box([-5, -5, 0], [5, 5, 0.4], [3 / 16, 3 / 16, 10 / 16, 10 / 16]), leather));
      var sh = new THREE.Mesh(new THREE.PlaneGeometry(19, 19), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
      sh.position.set(0.6, -1.6, -0.6); g.add(sh);
      return g;
    }
    // ---- an item: the sprite's opaque pixels as slabs (8 frame px across, half a frame px thick) ----
    function item(src, glint, cb) {
      var img = new Image();
      img.onload = function () {
        var n = img.width, c = document.createElement('canvas'); c.width = c.height = n;
        var x = c.getContext('2d'); x.drawImage(img, 0, 0, n, n);
        var d = x.getImageData(0, 0, n, n).data, s = 8 / n, th = 0.5, pos = [], col = [];
        function solid(i, j) { return i >= 0 && j >= 0 && i < n && j < n && d[(j * n + i) * 4 + 3] > 100; }
        function quad(q, r, g, b) { [0, 2, 1, 0, 3, 2].forEach(function (k) { pos.push(q[k][0], q[k][1], q[k][2]); col.push(r, g, b); }); }
        for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) {
          if (!solid(i, j)) continue;
          var o = (j * n + i) * 4, R = Math.pow(d[o] / 255, 2.2), Gc = Math.pow(d[o + 1] / 255, 2.2), B = Math.pow(d[o + 2] / 255, 2.2);
          var x0 = -4 + i * s, x1 = x0 + s, y1 = 4 - j * s, y0 = y1 - s, z0 = 0, z1 = th;
          quad([[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]], R, Gc, B);
          quad([[x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0]], R * 0.6, Gc * 0.6, B * 0.6);
          if (!solid(i, j - 1)) quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], R * 0.9, Gc * 0.9, B * 0.9);
          if (!solid(i, j + 1)) quad([[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], R * 0.5, Gc * 0.5, B * 0.5);
          if (!solid(i - 1, j)) quad([[x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0]], R * 0.7, Gc * 0.7, B * 0.7);
          if (!solid(i + 1, j)) quad([[x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1]], R * 0.7, Gc * 0.7, B * 0.7);
        }
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        var lin = new THREE.Float32BufferAttribute(col, 3); g.setAttribute('color', lin);
        var grp = new THREE.Group();
        grp.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true })));
        if (glint) {
          var gm = new THREE.MeshBasicMaterial({ color: 0x8040cc, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
          var gl = new THREE.Mesh(g, gm); gl.scale.setScalar(1.002); gl.userData.glint = gm; grp.add(gl);
        }
        cb(grp);
        kick();
      };
      img.src = src;
    }
    // vertex colours above are linear (pow 2.2) because three.js treats them as linear
    var frames = links.map(function (l, i) {
      var f = { link: l, g: frame(), turn: 0, at: 0, lift: 0, liftAt: 0, item: null, glint: null };
      root.add(f.g);
      item(l.getAttribute('data-item'), l.hasAttribute('data-glint'), function (it) {
        it.position.z = 0.7; f.item = it; f.g.add(it);
        it.traverse(function (m) { if (m.userData && m.userData.glint) f.glint = m.userData.glint; });
      });
      function on() { f.turn += 1; f.lift = 1; kick(); }
      function off() { f.lift = 0; kick(); }
      l.addEventListener('mouseenter', on); l.addEventListener('focus', on);
      l.addEventListener('mouseleave', off); l.addEventListener('blur', off);
      return f;
    });
    // ---- layout: every frame behind its hole ----
    var W = 1, H = 1;
    function layout() {
      W = canvas.clientWidth || 1; H = canvas.clientHeight || 1;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      var dist = H / 2 / Math.tan((camera.fov / 2) * Math.PI / 180);
      camera.position.set(0, 0, dist); camera.near = dist / 10; camera.far = dist * 3; camera.updateProjectionMatrix();
      var cr = canvas.getBoundingClientRect();
      frames.forEach(function (f) {
        var r = f.link.querySelector('.ml-fr-hole').getBoundingClientRect();
        f.g.position.set(r.left + r.width / 2 - cr.left - W / 2, H / 2 - (r.top + r.height / 2 - cr.top), 0);
        f.g.scale.setScalar(r.width / 12);
      });
      kick();
    }
    var ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    wall.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch' || REDUCE) return;
      var r = wall.getBoundingClientRect();
      ptr.tx = ((e.clientX - r.left) / r.width) * 2 - 1; ptr.ty = ((e.clientY - r.top) / r.height) * 2 - 1; kick();
    });
    wall.addEventListener('pointerleave', function () { ptr.tx = ptr.ty = 0; kick(); });
    // ---- draw only while something moves ----
    var running = false, onScreen = true, t0 = performance.now();
    function step(now) {
      var moving = false;
      ptr.x += (ptr.tx - ptr.x) * 0.08; ptr.y += (ptr.ty - ptr.y) * 0.08;
      if (Math.abs(ptr.tx - ptr.x) > 0.001 || Math.abs(ptr.ty - ptr.y) > 0.001) moving = true;
      root.rotation.y = ptr.x * 0.06; root.rotation.x = ptr.y * 0.04;
      frames.forEach(function (f) {
        var target = -f.turn * Math.PI / 4;
        f.at += (target - f.at) * (REDUCE ? 1 : 0.16);
        f.liftAt += (f.lift - f.liftAt) * (REDUCE ? 1 : 0.15);
        if (Math.abs(target - f.at) > 0.001 || Math.abs(f.lift - f.liftAt) > 0.001) moving = true;
        if (f.item) { f.item.rotation.z = f.at; f.item.position.z = 0.7 + f.liftAt * 0.8; f.item.scale.setScalar(1 + f.liftAt * 0.12); }
        if (f.glint) { f.glint.opacity = 0.22 + Math.sin((now - t0) / 380) * 0.14; moving = moving || !REDUCE; }
      });
      renderer.render(scene, camera);
      return moving;
    }
    function loop(now) {
      if (!onScreen || document.hidden) { running = false; return; }
      if (step(now)) requestAnimationFrame(loop); else running = false;
    }
    function kick() { if (!running && onScreen) { running = true; requestAnimationFrame(loop); } }
    new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; kick(); }).observe(wall);
    document.addEventListener('visibilitychange', kick);
    new ResizeObserver(layout).observe(wall);
    layout();
    (function ready() {
      if (pend > 0 || frames.some(function (f) { return !f.item; })) return setTimeout(ready, 100);
      layout();
      wall.classList.add('is-3d');
    })();
  }
})();
