/* Minecraft lobby hero (Oct 28 2026, v3): the Nether. Styles: mc-lobby.css "HERO".
   FX       live particles over the photo in #mlFx: the portal's purple pixels, lava embers, soul-fire flecks,
            drifting crimson spores, plus soft light pulses. Placed in the SOURCE photo's fractions (REGIONS),
            mapped through the img's object-fit: cover, so they stay on the portal / lava at any width.
            The art and the canvas share .ml-art, which the mouse parallax shifts as one.
   LINES    the Piglin's chat box: a new line every 7 s (hover pauses), a click on the face skips ahead.
   BARTER   throw gold: the ingot flies to the piglin in the picture, it admires it, a random page flies back.
   VERSIONS the release / snapshot strip, copied from the hidden hvs-* spans mc-java.js fills.
   The old 3D floating island hero is saved in _tools/lobby-hero/island/. */
(function () {
  var hero = document.getElementById('mlHero');
  if (!hero) return;
  var REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PHONE = matchMedia('(max-width: 970px)');
  var art = hero.querySelector('.ml-art'), img = hero.querySelector('.ml-art-img'), cv = document.getElementById('mlFx');

  // ---------------- FX ----------------
  // regions in fractions of src/nether.png (1200x675); the phone picture is its x 300-1200 crop (nether.py PHONE_X)
  var REGIONS = {
    portal: [0.655, 0.12, 0.79, 0.55],
    lava: [0.0, 0.05, 0.16, 1.0],
    soul: [0.865, 0.66, 0.985, 0.86],
    piglin: [0.49, 0.66] // where the ingot lands: the piglin's hands
  };
  var box = { ox: 0, oy: 0, dw: 1, dh: 1 };
  function measure() {
    var W = art.clientWidth, H = art.clientHeight, iw = img.naturalWidth || 1920, ih = img.naturalHeight || 1080;
    var s = Math.max(W / iw, H / ih), pos = getComputedStyle(img).objectPosition.split(' ');
    box.dw = iw * s; box.dh = ih * s;
    box.ox = (W - box.dw) * (parseFloat(pos[0]) / 100);
    box.oy = (H - box.dh) * (parseFloat(pos[1]) / 100);
    box.phone = /nether-phone/.test(img.currentSrc || '');
  }
  // a point of the source photo -> px inside .ml-art
  function pt(fx, fy) {
    if (box.phone) fx = (fx * 1200 - 300) / 900;
    return [box.ox + fx * box.dw, box.oy + fy * box.dh];
  }
  function rect(r) { var a = pt(r[0], r[1]), b = pt(r[2], r[3]); return { x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1] }; }

  var ctx = cv.getContext('2d'), dpr = 1, W = 0, H = 0, parts = [], spores = [], running = false, last = 0, T = 0;
  var R = Math.random;
  var PURPLE = ['#b14cff', '#8f2bea', '#d77dff', '#6c1cb8', '#f2b0ff'];
  var EMBER = ['#ffb340', '#ff7a1a', '#ffd36b', '#ff5a14'];
  var SOUL = ['#7ff3ff', '#3fd6f0', '#c4fdff'];
  var GOLD = ['#fff3a0', '#fcd24a', '#e8a524', '#b8760f'];
  function size() {
    dpr = PHONE.matches ? 1 : Math.min(window.devicePixelRatio || 1, 2); // phones: 1x (soft glows, a quarter of the pixels)
    W = art.clientWidth; H = art.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    measure();
  }
  // particle size scales with the picture, so a phone's pixels aren't chunkier than the art's
  function px() { return Math.max(1.4, box.dw / 640); }
  function add(p) { parts.push(p); }
  function spawn(dt) {
    var k = PHONE.matches ? 0.5 : 1, u = px();
    var P = rect(REGIONS.portal), L = rect(REGIONS.lava), S = rect(REGIONS.soul);
    // the portal: most pixels drift out and fade; some are pulled in, like the game's portal particles
    for (var n = Math.random() < dt * 46 * k ? 1 + (R() < 0.4) : 0; n > 0; n--) {
      var inward = R() < 0.4, x = P.x + R() * P.w, y = P.y + R() * P.h, cx = P.x + P.w / 2, cy = P.y + P.h / 2;
      if (inward) { x = cx + (R() - 0.5) * P.w * 2.2; y = cy + (R() - 0.5) * P.h * 1.5; }
      var life = 1.4 + R() * 2;
      add({ x: x, y: y, vx: inward ? (cx - x) / life : (R() - 0.65) * 40 * u, vy: inward ? (cy - y) / life : (R() - 0.5) * 26 * u,
        s: (1.5 + R() * 2.5) * u, c: PURPLE[(R() * 5) | 0], life: life, t: 0, g: 0, glow: 1 });
    }
    // lava embers rise and sway
    if (L.w > 4 && R() < dt * 16 * k) add({ x: L.x + R() * L.w, y: L.y + L.h * (0.3 + R() * 0.7), vx: (R() - 0.3) * 10 * u, vy: -(26 + R() * 46) * u,
      s: (1.2 + R() * 2) * u, c: EMBER[(R() * 4) | 0], life: 2 + R() * 2.5, t: 0, g: 0, sway: R() * 6, glow: 1 });
    // soul fire flecks: short, quick, cyan
    if (S.x < W && R() < dt * 12 * k) add({ x: S.x + R() * S.w, y: S.y + S.h * (0.2 + R() * 0.6), vx: (R() - 0.5) * 8 * u, vy: -(22 + R() * 30) * u,
      s: (1 + R() * 1.6) * u, c: SOUL[(R() * 3) | 0], life: 0.8 + R() * 1.2, t: 0, g: 0, sway: R() * 6, glow: 1 });
  }
  // crimson spores: slow red motes over the whole picture, on our red
  function seedSpores() {
    spores = [];
    var n = PHONE.matches ? 14 : 30;
    for (var i = 0; i < n; i++) spores.push({ x: R() * W, y: R() * H, vx: (R() - 0.5) * 8, vy: -4 - R() * 9, s: 1 + R() * 2, a: 0.25 + R() * 0.45, ph: R() * 6 });
  }
  function glow(x, y, r, color, a) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace('A', a)); g.addColorStop(1, color.replace('A', 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function frame(now) {
    if (!running) return;
    if (PHONE.matches && now - last < 31) { requestAnimationFrame(frame); return; } // phones: 30 fps
    var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; T += dt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    var P = rect(REGIONS.portal), L = rect(REGIONS.lava), S = rect(REGIONS.soul);
    // light: the portal breathes, the lava flickers, the soul fire wavers
    glow(P.x + P.w / 2, P.y + P.h / 2, P.w * 1.15, 'rgba(160,60,255,A)', (0.16 + Math.sin(T * 1.4) * 0.05).toFixed(3));
    if (L.w > 4) glow(L.x + L.w * 0.6, L.y + L.h * 0.5, L.w * 1.6, 'rgba(255,120,30,A)', (0.09 + Math.sin(T * 3.1) * 0.02 + Math.sin(T * 7.3) * 0.015).toFixed(3));
    if (S.x < W) glow(S.x + S.w / 2, S.y + S.h * 0.6, S.w * 0.8, 'rgba(80,220,255,A)', (0.1 + Math.sin(T * 5.2) * 0.03).toFixed(3));
    spawn(dt);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.vy += (p.g || 0) * dt;
      p.x += (p.vx + (p.sway ? Math.sin(p.t * 3 + p.sway) * 12 : 0)) * dt; p.y += p.vy * dt;
      var f = p.t / p.life, a = f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85, s = p.s * (1 - f * 0.5);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      if (p.glow) { ctx.globalAlpha = a * 0.25; ctx.fillRect(p.x - s * 1.5, p.y - s * 1.5, s * 3, s * 3); }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (var j = 0; j < spores.length; j++) {
      var o = spores[j];
      o.x += (o.vx + Math.sin(T * 0.7 + o.ph) * 6) * dt; o.y += o.vy * dt;
      if (o.y < -6) { o.y = H + 6; o.x = R() * W; }
      if (o.x < -6) o.x = W + 6; else if (o.x > W + 6) o.x = -6;
      ctx.globalAlpha = o.a * (0.6 + Math.sin(T * 1.7 + o.ph) * 0.4);
      ctx.fillStyle = '#d4483f';
      ctx.fillRect(o.x, o.y, o.s, o.s);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  function play(on) {
    if (on === running || REDUCE) return;
    running = on;
    if (on) { last = performance.now(); requestAnimationFrame(frame); }
  }
  // gold bursts out of the piglin's hands when the ingot lands
  function burst(x, y) {
    if (REDUCE) return;
    var u = px();
    for (var i = 0; i < 22; i++) {
      var a = R() * Math.PI * 2, v = (40 + R() * 90) * u;
      add({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60 * u, g: 260 * u, s: (1.6 + R() * 2.2) * u, c: GOLD[(R() * 4) | 0], life: 0.7 + R() * 0.6, t: 0, glow: 1 });
    }
  }
  function startFx() {
    size(); seedSpores();
    if (window.IntersectionObserver) new IntersectionObserver(function (e) { play(e[0].isIntersecting && !document.hidden); }).observe(hero);
    else play(true);
    document.addEventListener('visibilitychange', function () { play(!document.hidden && hero.getBoundingClientRect().bottom > 0); });
    var rz = 0;
    var lastW = innerWidth;
    addEventListener('resize', function () {
      if (PHONE.matches && innerWidth === lastW) return; // the address bar sliding, not a real resize
      lastW = innerWidth;
      clearTimeout(rz); rz = setTimeout(function () { size(); seedSpores(); }, 150);
    });
  }
  if (img.complete && img.naturalWidth) startFx(); else img.addEventListener('load', startFx, { once: true });
  // phone <-> desktop swaps the picture: re-measure once the new one is in
  img.addEventListener('load', function () { if (W) measure(); });

  // mouse parallax (desktop): the scene leans a few px away from the pointer
  if (!REDUCE && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var tx = 0, ty = 0, cx = 0, cy = 0, moving = false;
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * -14; ty = ((e.clientY - r.top) / r.height - 0.5) * -10;
      if (!moving) { moving = true; requestAnimationFrame(lean); }
    });
    hero.addEventListener('pointerleave', function () { tx = ty = 0; if (!moving) { moving = true; requestAnimationFrame(lean); } });
    function lean() {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      art.style.transform = 'translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)';
      if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) requestAnimationFrame(lean); else moving = false;
    }
  }

  // ---------------- LINES ----------------
  // Voice (Adrian, Oct 28 2026): the piglin's humour -- gold-obsessed, blunt, scared of soul fire, hates the
  // Overworld (piglins zombify there after 15 s). Short lines, max 2 lines in the box.
  var LINES = [
    "Gold first. Then we talk. That's how it works down here.",
    "Wear one piece of gold and I won't bite. Boots count.",
    'Throw me an ingot. I admire it. You get something. That is a barter.',
    "That blue fire over there? Not scared of it. I'm just not looking at it.",
    "Fifteen seconds in the Overworld and I turn zombie. I'll stay right here.",
    "Don't open that chest. I can see you. I can always see you.",
    'The ghast cries all day. Somebody throw him an ingot.',
    'Hoglin for dinner again. Yes, I danced about it.',
    'Every page here is free. Your gold is still welcome.'
  ];
  var BARTER = [
    'Mine now. You get the {p}.',
    'Hmph. Fair trade. Take the {p}.',
    'Shiny. Very shiny. Here, the {p}.',
    'In the Nether you would get gravel. Here: the {p}.',
    'Gold accepted. The {p} is yours.'
  ];
  var line = document.getElementById('mlLine'), face = document.getElementById('mlFace'), li = 0, timer = 0, hold = false;
  function say(text) {
    if (REDUCE) { line.textContent = text; return; }
    line.classList.add('is-out');
    setTimeout(function () { line.textContent = text; line.classList.remove('is-out'); }, 250);
  }
  function nextLine() { li = (li + 1) % LINES.length; say(LINES[li]); }
  function tick() { clearInterval(timer); if (!REDUCE) timer = setInterval(function () { if (!hold) nextLine(); }, 7000); }
  var sayBox = line.closest('.ml-say');
  sayBox.addEventListener('pointerenter', function () { hold = true; });
  sayBox.addEventListener('pointerleave', function () { hold = false; });
  face.addEventListener('click', function () {
    nextLine(); tick();
    face.classList.remove('is-hop'); void face.offsetWidth; face.classList.add('is-hop');
  });
  tick();

  // ---------------- BARTER ----------------
  var slot = document.getElementById('mlSlot'), go = document.getElementById('mlThrow'), pool = null, lastPick = '';
  var INGOT = '/minecrafticons/items/gold_ingot.png';
  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  function esc(v) { return String(v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // every live Minecraft page in game-nav.json except the lobby and the group pages
  function loadPool() {
    if (pool) return Promise.resolve(pool);
    return (window.pcJSON || function (u) { return fetch(u).then(function (r) { return r.json(); }); })('/game-nav.json').then(function (d) {
      pool = [];
      d.minecraft.groups.forEach(function (g) {
        (g.pages || []).forEach(function (p) {
          if (p.link && !p.soon && !/^All /.test(p.name) && p.link !== '/minecraft/') pool.push({ name: p.name, link: p.link, icon: p.icon, sub: p.sub || '', group: g.name });
        });
      });
      return pool;
    });
  }
  // an arc across the screen with the Web Animations API (sampled parabola + a spin)
  function fly(src, from, to, ms) {
    return new Promise(function (done) {
      if (REDUCE || !Element.prototype.animate) return done();
      var el = document.body.appendChild(document.createElement('img'));
      el.className = 'ml-fly'; el.src = src; el.alt = ''; el.setAttribute('aria-hidden', 'true');
      var frames = [], lift = Math.min(220, Math.abs(to[0] - from[0]) * 0.35 + 60);
      for (var i = 0; i <= 14; i++) {
        var f = i / 14, x = from[0] + (to[0] - from[0]) * f, y = from[1] + (to[1] - from[1]) * f - Math.sin(f * Math.PI) * lift;
        frames.push({ transform: 'translate(' + x + 'px,' + y + 'px) rotate(' + f * 540 + 'deg) scale(' + (1 - f * 0.25) + ')' });
      }
      var a = el.animate(frames, { duration: ms, easing: 'cubic-bezier(.35,.1,.45,1)' });
      a.onfinish = function () { el.remove(); done(); };
    });
  }
  function center(el) { var r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
  // the piglin's hands on screen, or null when that part of the picture is off screen (phones, scrolled)
  function piglinOnScreen() {
    var p = pt(REGIONS.piglin[0], REGIONS.piglin[1]), r = art.getBoundingClientRect(), x = r.left + p[0], y = r.top + p[1];
    return y > 40 && y < innerHeight - 20 && x > 0 && x < innerWidth ? [x, y, p] : null;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, REDUCE ? Math.min(ms, 500) : ms); }); }
  go.addEventListener('click', function () {
    if (go.disabled) return;
    go.disabled = true;
    var target = piglinOnScreen(), ADMIRE = 1800;
    var pick;
    loadPool().then(function (list) {
      var choices = list.filter(function (p) { return p.link !== lastPick; });
      pick = choices[(Math.random() * choices.length) | 0];
      lastPick = pick.link;
      return fly(INGOT, center(go), target ? [target[0], target[1]] : center(slot), 700);
    }).then(function () {
      if (target) burst(target[2][0], target[2][1]);
      say('Hold on. Admiring it.');
      slot.innerHTML = '<div><div class="ml-slot-admire"><img src="/images/minecraft/piglin/face-gold.webp" alt="">' +
        '<span>The Piglin is admiring your gold&hellip;<small>In game that takes 6 seconds. We rushed it.</small></span></div>' +
        '<div class="ml-timer"><i></i></div></div>';
      var bar = slot.querySelector('.ml-timer i');
      if (!REDUCE) { void bar.offsetWidth; bar.style.transition = 'width ' + ADMIRE + 'ms linear'; }
      bar.style.width = '100%';
      return wait(ADMIRE);
    }).then(function () {
      return fly(pick.icon, target ? [target[0], target[1]] : center(go), center(slot), 600);
    }).then(function () {
      slot.innerHTML = '<a class="ml-loot" href="' + esc(pick.link) + '"><span class="ml-loot-ico"><img src="' + esc(pick.icon) + '" alt=""></span>' +
        '<span><em>' + esc(pick.group) + '</em><b>' + esc(pick.name) + '</b>' + (pick.sub ? '<small>' + esc(pick.sub) + '</small>' : '') + '</span>' + ARROW + '</a>';
      say(BARTER[(Math.random() * BARTER.length) | 0].replace('{p}', pick.name));
      tick();
      go.lastChild.textContent = 'Throw again';
      go.disabled = false;
    }).catch(function () {
      slot.innerHTML = '<p class="ml-slot-idle"><img src="' + INGOT + '" alt="">The Piglin dropped it. Try again.</p>';
      go.disabled = false;
    });
  });

  // ---------------- VERSIONS ----------------
  (function () {
    var rel = document.getElementById('hvs-release-version'), snap = document.getElementById('hvs-snapshot-version');
    var relU = document.getElementById('hvs-release-updated'), snapU = document.getElementById('hvs-snapshot-updated');
    var a = document.getElementById('mlRel'), b = document.getElementById('mlSnap');
    function ago(el) { var l = el.querySelector('.hlu-short'); return l && l.textContent ? ' <i>' + esc(l.textContent) + '</i>' : ''; }
    function sync() {
      var r = rel.textContent.trim(), n = snap.textContent.trim();
      if (r && r !== 'N/A') a.innerHTML = esc(r) + ago(relU);
      if (n && n !== 'N/A') b.innerHTML = esc(n) + ago(snapU);
    }
    new MutationObserver(sync).observe(rel.parentNode, { childList: true, subtree: true, characterData: true });
    sync();
  })();
})();
