/* /minecraft/java/ home (Oct 12 2026): command copy buttons, the Packs &
   Shaders tabs, and the block-break image reveals. Styles: mc-home.css. */
(function () {
  // ---- Copy buttons (.mch-copy[data-copy]) ----
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    // http:// (local preview) has no async clipboard: fall back to a textarea.
    return new Promise(function (ok, bad) {
      var t = document.createElement('textarea');
      t.value = text;
      t.setAttribute('readonly', '');
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      try { document.execCommand('copy') ? ok() : bad(); } catch (e) { bad(e); }
      t.remove();
    });
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.mch-copy');
    if (!btn) return;
    var label = btn.querySelector('span');
    copyText(btn.getAttribute('data-copy')).then(function () {
      btn.classList.add('is-done');
      if (label) label.textContent = 'Copied';
      clearTimeout(btn._t);
      btn._t = setTimeout(function () {
        btn.classList.remove('is-done');
        if (label) label.textContent = 'Copy';
      }, 1600);
    }, function () {
      if (label) label.textContent = 'Press Ctrl+C';
    });
  });

  // ---- Tabs (.mch-tabs) ----
  document.querySelectorAll('.mch-tabs').forEach(function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
        document.querySelectorAll('.mch-more[data-for="' + t.getAttribute('aria-controls') + '"]').forEach(function (a) { a.hidden = !on; });
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        var next = tabs[(i + d + tabs.length) % tabs.length], j = i + d;
        while (next.hidden && next !== t) { j += d; next = tabs[(j + tabs.length) % tabs.length]; } // skip tabs a page has hidden
        select(next);
        next.focus();
      });
    });
  });

  // ---- Banner clip: stopped on its poster frame under reduced motion ----
  var clip = document.querySelector('video.mch-hero-bg');
  if (clip && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    clip.removeAttribute('autoplay');
    clip.pause();
  }

  // ---- Block-break reveals (.mch-reveal) ----
  // Visible by default. Only images that start below the fold are hidden,
  // then uncovered in stepped block wipes as they scroll in.
  var items = document.querySelectorAll('.mch-reveal');
  if (!items.length || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var el = en.target;
      if (!el._seen) {
        el._seen = true;
        if (!en.isIntersecting) { el.classList.add('is-pending'); return; }
        io.unobserve(el);
        return;
      }
      if (en.isIntersecting) {
        el.classList.add('is-in');
        el.classList.remove('is-pending');
        io.unobserve(el);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  items.forEach(function (el) { io.observe(el); });
})();

/* ---- Oct 12 additions: chat line, skin lookup, release
   timeline. All live data comes from public APIs that allow browser calls
   (Access-Control-Allow-Origin: *) and need no key:
     Mojang version list  piston-meta.mojang.com (same feed as the hero)
     Player lookup        playerdb.co  (username -> UUID, 400 when unknown)
     Skin files           mc-heads.net (CORS on, so WebGL can read them)
     3D viewer            skinview3d from jsDelivr, loaded only near the skin stage
   Each block bails out on its own when its markup is missing. */
(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // Mojang's version manifest feeds the release timeline.
  var manifest = fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json').then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  });
  // ---- Commands: in-game colours + the chat input line ----
  // Colours follow the game's own command highlighting: selectors aqua,
  // ids green, strings gold, numbers light purple.
  var TOKENS = /("(?:[^"\\]|\\.)*")|(@[parens](?:\[[^\]]*\])?)|([a-z_]+:[a-z0-9_./]+)|(-?\b\d+(?:\.\d+)?\b)|([{}\[\],=])/g;
  function paint(code) {
    var out = '', last = 0, m;
    var head = /^\/?[a-z_]+/.exec(code);
    if (head) { out = '<span class="tk-cmd">' + esc(head[0]) + '</span>'; last = head[0].length; }
    TOKENS.lastIndex = last;
    while ((m = TOKENS.exec(code))) {
      out += esc(code.slice(last, m.index));
      var cls = m[1] ? 'tk-str' : m[2] ? 'tk-sel' : m[3] ? 'tk-id' : m[4] ? 'tk-num' : 'tk-p';
      out += '<span class="' + cls + '">' + esc(m[0]) + '</span>';
      last = TOKENS.lastIndex;
    }
    return out + esc(code.slice(last));
  }
  document.querySelectorAll('.mch-term-code').forEach(function (el) { el.innerHTML = paint(el.textContent); });

  var chat = document.querySelector('.mch-chatline-text');
  if (chat) {
    var shown = null;
    var show = function (row) {
      var btn = row && row.querySelector('.mch-copy');
      if (!btn || row === shown) return;
      shown = row;
      var cmd = btn.getAttribute('data-copy');
      chat.innerHTML = paint(cmd.charAt(0) === '/' ? cmd : '/' + cmd);
      if (reduced) return;
      chat.classList.remove('is-typing');
      void chat.offsetWidth; // restart the typing animation
      chat.classList.add('is-typing');
    };
    var rows = document.querySelectorAll('.mch-term-row');
    rows.forEach(function (row) {
      row.addEventListener('mouseenter', function () { show(row); });
      row.addEventListener('focusin', function () { show(row); });
      row.addEventListener('click', function () { show(row); });
    });
    show(rows[0]);
  }

  // ---- Skin lookup (/minecraft/tools/skin-lookup) ----
  // playerdb gives the official skin + cape URLs and the textures property,
  // whose base64 JSON says whether the skin uses slim arms.
  (function () {
    var form = document.getElementById('skinForm');
    var canvas = document.getElementById('skinCanvas');
    if (!form || !canvas) return;
    var input = document.getElementById('skinInput');
    var msg = document.getElementById('skinMsg');
    var flat = document.getElementById('skinFlat');
    var play = document.getElementById('skinPlay');
    var stage = canvas.parentNode;
    var $ = function (id) { return document.getElementById(id); };
    var viewer = null;
    var player = { name: 'Notch', uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5', skin: '', cape: '', slim: false };
    var pose = 'walk';
    var show = { hat: true, outer: true, cape: true };
    var ver = 2;
    var POSES = { walk: 'WalkingAnimation', run: 'RunningAnimation', idle: 'IdleAnimation', wave: 'WaveAnimation', fly: 'FlyingAnimation' };

    function raw() { return player.uuid.replace(/-/g, ''); }
    function skinSrc() { return player.skin || 'https://mc-heads.net/skin/' + raw(); }
    function useFlat() {
      canvas.hidden = true;
      play.hidden = true;
      flat.hidden = false;
      flat.src = 'https://mc-heads.net/body/' + raw() + '/320';
      document.querySelectorAll('.skl-ctl').forEach(function (el) { el.hidden = true; });
    }
    function pressed(group, attr, val) {
      group.querySelectorAll('.mch-chip').forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute(attr) === String(val) ? 'true' : 'false');
      });
    }
    function setPaused(p) {
      if (!viewer || !viewer.animation) return;
      viewer.animation.paused = p;
      play.setAttribute('aria-pressed', p ? 'false' : 'true');
      play.setAttribute('aria-label', p ? 'Play the animation' : 'Pause the animation');
      play.innerHTML = p
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l12 8-12 8z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
    }
    // Back item: the cape, or an elytra while gliding. The game paints the
    // elytra with the player's cape, so without a cape there is nothing to draw.
    function syncBack() {
      if (!viewer) return;
      var po = viewer.playerObject;
      po.backEquipment = player.cape && show.cape ? (pose === 'fly' ? 'elytra' : 'cape') : null;
    }
    function syncLayers() {
      if (!viewer) return;
      var sk = viewer.playerObject.skin;
      sk.head.outerLayer.visible = show.hat;
      ['body', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'].forEach(function (k) {
        sk[k].outerLayer.visible = show.outer;
      });
      syncBack();
    }
    function setPose(p) {
      pose = p;
      pressed($('skinPose'), 'data-pose', p);
      if (!viewer) return;
      var paused = viewer.animation ? viewer.animation.paused : reduced;
      viewer.animation = new window.skinview3d[POSES[p]]();
      viewer.animation.speed = p === 'run' ? 0.6 : 0.7;
      // Gliding tips the body flat; a higher camera angle keeps it readable.
      viewer.playerObject.rotation.y = p === 'fly' ? -2.4 : -0.5;
      setPaused(paused);
      syncBack();
    }
    function loadTextures() {
      if (!viewer) return;
      // Both load the image first and then reset the back item, so the
      // switches are re-applied once each one lands. loadCape(null) clears.
      [viewer.loadSkin(skinSrc(), { model: player.skin ? (player.slim ? 'slim' : 'default') : 'auto-detect' }),
        viewer.loadCape(player.cape || null)].forEach(function (r) {
        if (r && r.then) r.then(syncLayers, function () {});
      });
      syncLayers();
    }
    function boot() {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/skinview3d@3.1.0/bundles/skinview3d.bundle.js';
      s.onload = function () {
        try {
          viewer = new window.skinview3d.SkinViewer({
            canvas: canvas,
            width: stage.clientWidth,
            height: stage.clientHeight
          });
          viewer.zoom = 0.82;
          viewer.fov = 40;
          viewer.controls.enableZoom = false;
          // OrbitControls sets touch-action: none, which traps phone scrolling
          // on the model. pan-y gives vertical swipes back to the page.
          canvas.style.touchAction = 'pan-y';
          loadTextures();
          setPose(pose);
          setPaused(reduced);
          new ResizeObserver(function () {
            viewer.setSize(stage.clientWidth, stage.clientHeight);
          }).observe(stage);
        } catch (e) { useFlat(); }
      };
      s.onerror = useFlat;
      document.head.appendChild(s);
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting) return;
        io.disconnect();
        boot();
      }, { rootMargin: '600px 0px' });
      io.observe(stage);
    } else boot();

    play.addEventListener('click', function () {
      if (viewer && viewer.animation) setPaused(!viewer.animation.paused);
    });
    $('skinPose').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pose]');
      if (b) setPose(b.getAttribute('data-pose'));
    });
    $('skinShow').addEventListener('click', function (e) {
      var b = e.target.closest('[data-part]');
      if (!b || b.disabled) return;
      var k = b.getAttribute('data-part');
      show[k] = !show[k];
      b.setAttribute('aria-pressed', show[k] ? 'true' : 'false');
      syncLayers();
    });
    $('skinVer').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ver]');
      if (!b) return;
      ver = +b.getAttribute('data-ver');
      pressed($('skinVer'), 'data-ver', ver);
      writeCmd();
    });

    // 1.20.5 moved item data to components; 1.13 renamed skull 1 3 to player_head.
    function writeCmd() {
      var n = player.name;
      var cmd = ver === 2 ? '/give @p minecraft:player_head[minecraft:profile={name:"' + n + '"}]'
        : ver === 1 ? '/give @p minecraft:player_head{SkullOwner:"' + n + '"}'
        : '/give @p minecraft:skull 1 3 {SkullOwner:"' + n + '"}';
      $('skinCode').textContent = cmd;
      $('skinCmd').setAttribute('data-copy', cmd);
    }
    // UUID as NBT stores it since 1.16: four signed 32-bit ints.
    function uuidInts(hex) {
      return '[I;' + hex.match(/.{8}/g).map(function (h) { return parseInt(h, 16) | 0; }).join(',') + ']';
    }
    function writeUuids() {
      var f = { dashed: player.uuid, raw: raw(), ints: uuidInts(raw()) };
      $('skinUuids').querySelectorAll('li').forEach(function (li) {
        var code = li.querySelector('code');
        var v = f[code.getAttribute('data-fmt')];
        code.textContent = v;
        li.querySelector('.mch-copy').setAttribute('data-copy', v);
      });
    }
    function apply(p) {
      player = p;
      $('skinName').textContent = p.name;
      $('skinCmdName').textContent = p.name;
      $('skinAvatar').src = 'https://mc-heads.net/avatar/' + raw() + '/64';
      $('skinModel').textContent = p.slim ? 'Slim' : 'Classic';
      $('skinCape').textContent = p.cape ? 'Official Mojang cape' : 'None';
      var sw = $('skinCapeSw');
      sw.hidden = !p.cape;
      sw.style.backgroundImage = p.cape ? 'url("' + p.cape + '")' : '';
      var capeBtn = $('skinShow').querySelector('[data-part="cape"]');
      capeBtn.disabled = !p.cape;
      $('skinFile').href = skinSrc();
      if ($('skinEdit')) $('skinEdit').href = '/minecraft/tools/skin-editor?player=' + encodeURIComponent(p.name);
      $('skinCapeFile').hidden = !p.cape;
      if (p.cape) $('skinCapeFile').href = p.cape;
      writeCmd();
      writeUuids();
      if (viewer) loadTextures();
      else if (!flat.hidden) useFlat();
    }
    function slimOf(pl) {
      try {
        var t = (pl.properties || []).filter(function (x) { return x.name === 'textures'; })[0];
        var d = JSON.parse(atob(t.value));
        return !!(d.textures.SKIN.metadata && d.textures.SKIN.metadata.model === 'slim');
      } catch (e) { return false; }
    }
    function https(u) { return u ? String(u).replace(/^http:/, 'https:') : ''; }
    function lookup(name, quiet) {
      name = name.trim();
      if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
        msg.textContent = 'Java usernames are 3 to 16 letters, numbers or underscores.';
        msg.className = 'mch-skin-msg is-error';
        return;
      }
      if (!quiet) {
        msg.textContent = 'Looking up ' + name + '…';
        msg.className = 'mch-skin-msg';
      }
      form.setAttribute('aria-busy', 'true');
      fetch('https://playerdb.co/api/player/minecraft/' + encodeURIComponent(name))
        .then(function (r) {
          return r.json().then(function (d) { return { ok: r.ok, d: d }; });
        })
        .then(function (res) {
          var pl = res.d && res.d.data && res.d.data.player;
          if (!res.ok || !pl) {
            msg.textContent = 'No Java account is called ' + name + '. Check the spelling.';
            msg.className = 'mch-skin-msg is-error';
            return;
          }
          msg.textContent = '';
          apply({ name: pl.username, uuid: pl.id, skin: https(pl.skin_texture), cape: https(pl.cape_texture), slim: slimOf(pl) });
        })
        .catch(function () {
          if (quiet) return;
          msg.textContent = 'The player lookup did not answer. Try again in a moment.';
          msg.className = 'mch-skin-msg is-error';
        })
        .then(function () { form.removeAttribute('aria-busy'); });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      lookup(input.value);
    });
    document.querySelectorAll('.mch-skin-picks button').forEach(function (b) {
      b.addEventListener('click', function () {
        input.value = b.getAttribute('data-player');
        lookup(input.value);
      });
    });
    // The markup starts on Notch; fetch him once so the cape and arm model are real.
    lookup(player.name, true);
  })();

  // ---- Release timeline ----
  (function () {
    var chart = document.getElementById('tlChart');
    if (!chart) return;
    var read = document.getElementById('tlRead');
    var sub = document.getElementById('tlSub');
    var MAJOR = /^\d+\.\d+$/;
    // Official update names paired with one item from that release. The 1.1
    // release had no official subtitle, so keep that clear instead of guessing.
    var UPDATE_SPOTLIGHTS = {
      '1.0': { title: 'Adventure Update', item: 'Eye of Ender', icon: 'ender_eye.png' },
      '1.1': { title: 'No official title', item: 'Spawn Egg', icon: 'spawn_egg.png' },
      '1.8': { title: 'Bountiful Update', item: 'Prismarine Shard', icon: 'prismarine_shard.png' },
      '1.9': { title: 'Combat Update', item: 'Elytra', icon: 'elytra.png' },
      '1.10': { title: 'Frostburn Update', item: 'Polar Bear Spawn Egg', icon: 'polar_bear_spawn_egg.png' },
      '1.11': { title: 'Exploration Update', item: 'Totem of Undying', icon: 'totem_of_undying.png' },
      '1.12': { title: 'World of Color Update', item: 'Glazed Terracotta', icon: 'orange_glazed_terracotta.png' },
      '1.13': { title: 'Update Aquatic', item: 'Trident', icon: 'trident.png' },
      '1.14': { title: 'Village & Pillage', item: 'Bell', icon: 'bell.png' },
      '1.15': { title: 'Buzzy Bees', item: 'Honeycomb', icon: 'honeycomb.png' },
      '1.16': { title: 'Nether Update', item: 'Netherite Ingot', icon: 'netherite_ingot.png' },
      '1.17': { title: 'Caves & Cliffs: Part I', item: 'Copper Ingot', icon: 'copper_ingot.png' },
      '1.18': { title: 'Caves & Cliffs: Part II', item: 'Pointed Dripstone', icon: 'pointed_dripstone.png' },
      '1.19': { title: 'The Wild Update', item: 'Echo Shard', icon: 'echo_shard.png' },
      '1.20': { title: 'Trails & Tales', item: 'Brush', icon: 'brush.png' },
      '1.21': { title: 'Tricky Trials', item: 'Mace', icon: 'mace.png' },
      '26.1': { title: 'Tiny Takeover', item: 'Golden Dandelion', icon: 'golden_dandelion.png' },
      '26.2': { title: 'Chaos Cubed', item: 'Sulfur Cube Bucket', icon: 'sulfur_cube_bucket.png' },
      '26.3': { title: 'Wilderness Bound', item: 'Abandoned Camp Map', icon: 'abandoned_camp_map.png' }
    };

    manifest.then(function (d) {
      var rel = d.versions.filter(function (v) { return v.type === 'release'; }).reverse(); // oldest first
      if (!rel.length) return;
      var years = {};
      rel.forEach(function (v, i) {
        v.i = i;
        var y = new Date(v.releaseTime).getFullYear();
        (years[y] = years[y] || []).push(v);
      });
      var first = +Object.keys(years)[0];
      var last = new Date().getFullYear();
      var html = '';
      for (var y = first, c = 0; y <= last; y++, c++) {
        var list = years[y] || [];
        html += '<div class="mch-tl-col" role="listitem" style="--c:' + c + '" aria-label="' + y + ': ' +
          (list.length ? list.map(function (v) { return v.id; }).join(', ') : 'no releases') + '"><div class="mch-tl-stack">';
        list.forEach(function (v, k) {
          var major = MAJOR.test(v.id);
          var spotlight = major && UPDATE_SPOTLIGHTS[v.id];
          var hover = spotlight ? ' title="' + esc(spotlight.title + ' · ' + spotlight.item) + '"' : '';
          html += '<span class="mch-tl-blk' + (major ? ' is-major' : '') + '" data-i="' + v.i + '" style="--k:' + k + '"' + hover + '>' +
            (major ? esc(v.id) : '') + '</span>';
        });
        html += '</div><span class="mch-tl-year">' + y + '</span></div>';
      }
      chart.innerHTML = html;
      chart.tabIndex = 0;
      chart.setAttribute('aria-describedby', 'tlRead');

      var majors = rel.filter(function (v) { return MAJOR.test(v.id); }).length;
      sub.textContent = rel.length + ' releases since ' + rel[0].id + ' on ' + dateFmt.format(new Date(rel[0].releaseTime)) +
        ', ' + majors + ' of them major versions. Straight from Mojang’s version list.';

      var blocks = chart.querySelectorAll('.mch-tl-blk');
      var at = rel.length - 1;
      function focus(i) {
        at = Math.max(0, Math.min(rel.length - 1, i));
        var v = rel[at], prev = rel[at - 1];
        // A patch (1.21.4) shows the update it belongs to (1.21), so the update box
        // is there for every version and the readout never changes height.
        var major = MAJOR.test(v.id);
        var spotlight = UPDATE_SPOTLIGHTS[v.id] || UPDATE_SPOTLIGHTS[v.id.split('.').slice(0, 2).join('.')];
        blocks.forEach(function (b) { b.classList.toggle('is-on', +b.getAttribute('data-i') === at); });
        var gap = prev ? Math.round((new Date(v.releaseTime) - new Date(prev.releaseTime)) / 86400000) : 0;
        read.innerHTML = '<b>' + esc(v.id) + '</b>' + (major ? '<em>Major version</em>' : '') +
          '<span>' + dateFmt.format(new Date(v.releaseTime)) + '</span>' +
          (prev ? '<span>' + gap + (gap === 1 ? ' day' : ' days') + ' after ' + esc(prev.id) + '</span>' : '<span>The first full release</span>') +
          (spotlight ? '<span class="mch-tl-update"><span class="mch-tl-item-icon"><img src="/minecrafticons/java-release-items/' +
            esc(spotlight.icon) + '" alt="" width="32" height="32"></span><span class="mch-tl-update-copy"><small>' + (major ? 'UPDATE TITLE' : 'PART OF') + '</small><strong>' +
            esc(spotlight.title) + '</strong><small class="mch-tl-item-name">Featured item · ' + esc(spotlight.item) + '</small></span></span>'
            : '<span class="mch-tl-update is-empty" aria-hidden="true"><span class="mch-tl-item-icon"></span></span>');
      }
      chart.addEventListener('mouseover', function (e) {
        var b = e.target.closest('.mch-tl-blk');
        if (b) focus(+b.getAttribute('data-i'));
      });
      chart.addEventListener('click', function (e) {
        var b = e.target.closest('.mch-tl-blk');
        if (b) focus(+b.getAttribute('data-i'));
      });
      chart.addEventListener('keydown', function (e) {
        var step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
        if (e.key === 'Home') step = -at;
        if (e.key === 'End') step = rel.length;
        if (step === undefined) return;
        e.preventDefault();
        focus(at + step);
      });
      focus(at);

      // Phones scroll the chart sideways; start at the newest years.
      var scroller = chart.parentNode;
      scroller.scrollLeft = scroller.scrollWidth;

      // The stack builds itself when it scrolls in (only if it starts off screen).
      if (reduced || !('IntersectionObserver' in window)) return;
      var seen = false;
      var io = new IntersectionObserver(function (en) {
        if (!seen) {
          seen = true;
          if (!en[0].isIntersecting) { chart.classList.add('is-pending'); return; }
          io.disconnect();
          return;
        }
        if (en[0].isIntersecting) {
          chart.classList.remove('is-pending');
          chart.classList.add('is-in');
          io.disconnect();
        }
      }, { rootMargin: '0px 0px -12% 0px' });
      io.observe(chart);
    }, function () {
      sub.textContent = 'Mojang’s version list did not load, so the timeline is empty for now.';
    });
  })();
})();

/* ---- Reference desk (#mc-refs): hover or pick a chart to read it whole in
   the preview; the preview and "Full size" open the shared lightbox, which
   pages through all 14 (mcHomeOpenPalette in mc-java.js). Phones have no
   preview: an item opens the lightbox straight away. */
(function () {
  var list = document.querySelector('.mch-ref-list');
  if (!list) return;
  var items = Array.prototype.slice.call(list.querySelectorAll('.mch-ref-item'));
  var img = document.getElementById('refImg');
  var stage = document.getElementById('refOpen');
  var link = document.getElementById('refLink');
  var phone = window.matchMedia('(max-width: 970px)');
  var on = items[0];

  function pick(item) {
    if (item === on) return;
    on.classList.remove('is-on');
    on.setAttribute('aria-pressed', 'false');
    on = item;
    item.classList.add('is-on');
    item.setAttribute('aria-pressed', 'true');
    var name = item.querySelector('.pal-card-label').textContent;
    img.src = item.getAttribute('data-full');
    img.alt = name;
    stage.setAttribute('aria-label', 'Open ' + name + ' full size');
    document.getElementById('refName').textContent = name;
    document.getElementById('refDesc').textContent = item.getAttribute('data-desc');
    document.getElementById('refGroup').textContent = item.getAttribute('data-group');
    var url = item.getAttribute('data-link');
    link.hidden = !url;
    if (url) link.href = url;
  }
  function open() {
    if (typeof window.openPalette === 'function') window.openPalette(on);
  }
  items.forEach(function (item) {
    item.addEventListener('mouseenter', function () { if (!phone.matches) pick(item); });
    item.addEventListener('click', function () {
      pick(item);
      if (phone.matches) open();
    });
  });
  stage.addEventListener('click', open);
  document.getElementById('refZoom').addEventListener('click', open);
})();

// ---- Minecraft pages: on phones "From Mojang" leaves the hero for the page end ----
// so the content is on the first screen. Moved, not copied: mc-java.js fills it by id.
(function () {
  var news = document.querySelector('.mch-hero--page .mch-hero-news');
  if (!news) return;
  var home = news.parentNode;
  var slot = document.createElement('div');
  slot.className = 'mch-frame mct-news';
  document.querySelector('.mch').appendChild(slot);
  var phone = matchMedia('(max-width: 970px)');
  function place() { (phone.matches ? slot : home).appendChild(news); }
  place();
  phone.addEventListener('change', place);
})();
