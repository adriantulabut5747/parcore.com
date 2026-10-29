/* /minecraft/java/worlds (Oct 22 2026). Two parts:
   1. The library: cards, filter chips and search built from /mc-worlds.json
      (same engine as mc-seeds.js). Shared links #world-<id> land on the card.
   2. "Install a world": an animated walkthrough. Steps 1-2 are a file window
      (HTML, per OS); steps 3-4 are the game's own screens drawn in a canvas
      the way 26.3 draws them: real sprites (/minecrafticons/gui/menu/, from the
      26.3 jar), real font (McFont), real strings and layout (SelectWorldScreen,
      WorldSelectionList, BackupConfirmScreen). Strings are copied from the
      jar's en_us.json -- don't paraphrase them.
   Styles: mc-worlds.css. */
(function () {
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------------- 1. LIBRARY ---------------- */
  var grid = document.getElementById('worldGrid');
  if (grid) {
    var chipsBox = document.getElementById('worldChips');
    var find = document.getElementById('worldFind');
    var count = document.getElementById('worldCount');
    var empty = document.getElementById('worldEmpty');

    var card = function (w, tags, i) {
      var host = '';
      try { host = new URL(w.url).hostname.replace(/^www\./, ''); } catch (e) {}
      var meta = [];
      if (w.players) meta.push(w.players + ' players');
      if (w.schematic) meta.push('Schematic');
      w.tags.forEach(function (t) { meta.push(tags[t]); });
      return '<a class="mch-mod mwl-card" id="world-' + w.id + '" href="' + esc(w.url) + '" target="_blank" rel="noopener">' +
        '<div class="mch-mod-media"><img src="' + esc(w.img) + '" alt="" loading="lazy" decoding="async">' +
        '<span class="mch-mod-rank">' + (i < 9 ? '0' : '') + (i + 1) + '</span>' +
        (w.version ? '<span class="mwl-ver"><small>Java</small>' + esc(w.version) + '</span>' : '') + '</div>' +
        '<h3 class="mch-mod-name">' + esc(w.name) + '</h3>' +
        (w.by ? '<span class="mch-mod-author">by ' + esc(w.by) + '</span>' : '') +
        '<p class="mch-mod-desc">' + esc(w.desc) + '</p>' +
        '<p class="mch-scard-tags">' + meta.map(esc).join('<i aria-hidden="true"></i>') + '</p>' +
        '<span class="mch-src"><img src="https://www.google.com/s2/favicons?domain=' + esc(host) + '&amp;sz=64" alt="" loading="lazy"><b>' + esc(w.src) + '</b></span></a>';
    };

    fetch('/mc-worlds.json')
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (data) {
        var worlds = data.worlds, tags = data.tags;
        grid.innerHTML = worlds.map(function (w, i) { return card(w, tags, i); }).join('');
        // Chips as on the data packs / shaders / mods pages: counts follow the search, an empty chip greys out.
        chipsBox.innerHTML = '<button type="button" class="mch-chip" data-tag="all" aria-pressed="true">All<span data-n></span></button>' +
          Object.keys(tags).map(function (t) {
            return '<button type="button" class="mch-chip" data-tag="' + t + '" aria-pressed="false">' + esc(tags[t]) + '<span data-n></span></button>';
          }).join('');

        var cards = Array.prototype.slice.call(grid.children);
        var active = 'all';
        var apply = function () {
          var q = find.value.trim().toLowerCase();
          var hitQ = worlds.map(function (w) {
            return !q || [w.name, w.by, w.desc, w.src, w.version, w.schematic ? 'schematic' : ''].concat(w.tags.map(function (t) { return tags[t]; })).join(' ').toLowerCase().indexOf(q) > -1;
          });
          var shown = 0;
          worlds.forEach(function (w, i) {
            var ok = hitQ[i] && (active === 'all' || w.tags.indexOf(active) > -1);
            cards[i].hidden = !ok;
            if (ok) shown++;
          });
          chipsBox.querySelectorAll('.mch-chip').forEach(function (c) {
            var t = c.getAttribute('data-tag');
            var n = worlds.filter(function (w, i) { return hitQ[i] && (t === 'all' || w.tags.indexOf(t) > -1); }).length;
            c.querySelector('[data-n]').textContent = n;
            c.disabled = !n && t !== active;
          });
          count.textContent = shown === worlds.length ? worlds.length + ' worlds' : shown + ' of ' + worlds.length + ' worlds';
          empty.hidden = shown > 0;
          document.getElementById('worldEmptyQ').textContent = q ? '“' + find.value.trim() + '”' : 'this filter';
        };
        chipsBox.addEventListener('click', function (e) {
          var chip = e.target.closest('.mch-chip');
          if (!chip || chip.disabled) return;
          active = chip.getAttribute('data-tag');
          chipsBox.querySelectorAll('.mch-chip').forEach(function (c) {
            c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
          });
          apply();
        });
        find.addEventListener('input', apply);
        document.getElementById('worldReset').addEventListener('click', function (e) {
          e.stopPropagation(); // it wears .mch-copy's look; keep mc-home.js's copy handler off it
          find.value = '';
          chipsBox.querySelector('[data-tag="all"]').click();
        });
        apply();

        var hit = location.hash && document.getElementById(location.hash.slice(1));
        if (hit && hit.classList.contains('mwl-card')) {
          hit.classList.add('is-target');
          hit.scrollIntoView({ block: 'center' });
        }
      })
      .catch(function () {
        grid.innerHTML = '<p class="mch-sfail">The world list did not load. Refresh the page to try again.</p>';
      });
  }

  /* ---------------- 2. INSTALL WALKTHROUGH ---------------- */
  var box = document.getElementById('worldInstall');
  if (!box) return;
  var stage = document.getElementById('mwiStage');
  var win = document.getElementById('mwiWin');
  var rowsEl = document.getElementById('mwiRows');
  var pathEl = document.getElementById('mwiPath');
  var titleEl = document.getElementById('mwiTitle');
  var menuEl = document.getElementById('mwiMenu');
  var ghost = document.getElementById('mwiGhost');
  var tip = document.getElementById('mwiTip');
  var cursor = document.getElementById('mwiCursor');
  var cv = document.getElementById('mwiMc');
  var steps = Array.prototype.slice.call(box.querySelectorAll('.mwi-step'));
  var osBtns = Array.prototype.slice.call(box.querySelectorAll('[data-os]'));
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Our own world, with the facts from /minecraft/java/hcpc: 1.21.6, 1.4 GB, Hardcore.
  // 26.3 asks for a backup below data version 4772 (FileFixerUpper); 1.21.6 is 4435.
  var WORLD = 'Hardcore Parcore';
  var WORLD_VER = '1.21.6';
  var current = '26.3'; // replaced by Mojang's latest release below
  fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d && d.latest && d.latest.release) current = d.latest.release; })
    .catch(function () {});

  var OS = {
    win: {
      path: '%APPDATA%\\.minecraft\\saves', crumbs: ['Roaming', '.minecraft', 'saves'], home: ['This PC', 'Downloads'],
      types: { dir: 'File folder', zip: 'Compressed (zipped) Folder', dat: 'DAT File', png: 'PNG File' },
      menu: ['Open', 'Extract All…', 'Copy as path', 'Delete'], hot: 1
    },
    mac: {
      path: '~/Library/Application Support/minecraft/saves', crumbs: ['minecraft', 'saves'], home: ['Downloads'],
      types: { dir: 'Folder', zip: 'ZIP archive', dat: 'Document', png: 'PNG image' },
      menu: null // a double-click unzips on a Mac
    },
    linux: {
      path: '~/.minecraft/saves', crumbs: ['Home', '.minecraft', 'saves'], home: ['Home', 'Downloads'],
      types: { dir: 'Folder', zip: 'Zip archive', dat: 'Binary', png: 'PNG image' },
      menu: ['Open With Archive Manager', 'Extract Here', 'Extract to…', 'Copy'], hot: 1
    }
  };
  var os = /Mac/i.test(navigator.platform || navigator.userAgent) ? 'mac' : /Linux/i.test(navigator.platform) && !/Android/i.test(navigator.userAgent) ? 'linux' : 'win';

  var ICON = {
    dir: '<svg viewBox="0 0 24 24"><path d="M2 6.5A1.5 1.5 0 0 1 3.5 5h5l2 2h10A1.5 1.5 0 0 1 22 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 18.5z" fill="#e8b84a"/><path d="M2 9h20v9.5a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 18.5z" fill="#f5cd62"/></svg>',
    zip: '<svg viewBox="0 0 24 24"><path d="M2 6.5A1.5 1.5 0 0 1 3.5 5h5l2 2h10A1.5 1.5 0 0 1 22 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 18.5z" fill="#e8b84a"/><path d="M2 9h20v9.5a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 18.5z" fill="#f5cd62"/><path d="M11 9h2v2h-2zm0 3h2v2h-2zm0 3h2v2h-2z" fill="#6b5a2a"/></svg>',
    dat: '<svg viewBox="0 0 24 24"><path d="M5 2h9l5 5v15H5z" fill="#d9dde3"/><path d="M14 2v5h5" fill="#aab1bb"/><path d="M8 12h8M8 15h8M8 18h5" stroke="#7d8591" stroke-width="1.4"/></svg>',
    png: '<svg viewBox="0 0 24 24"><path d="M5 2h9l5 5v15H5z" fill="#d9dde3"/><path d="M14 2v5h5" fill="#aab1bb"/><path d="M7 19l3.5-5 2.5 3 2-2 2 4z" fill="#5aa04a"/><circle cx="9.5" cy="10.5" r="1.6" fill="#e8b84a"/></svg>'
  };
  function row(name, kind, size, cls) {
    return '<div class="mwi-row' + (cls ? ' ' + cls : '') + '" data-name="' + esc(name) + '"><span class="mwi-n">' + ICON[kind] + '<b>' + esc(name) + '</b></span><span>' + OS[os].types[kind] + '</span><span>' + (size || '') + '</span></div>';
  }
  function rows(list) { rowsEl.innerHTML = list.join(''); }
  function rowOf(name) { return rowsEl.querySelector('[data-name="' + name + '"]'); }
  function crumbs(list) {
    pathEl.classList.remove('is-typing');
    pathEl.innerHTML = list.map(esc).join('<i>›</i>');
    titleEl.textContent = list[list.length - 1];
  }
  // Cursor in stage %, or over an element (its centre-left, where a pointer would sit).
  function at(el, fx) {
    var s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    return [((r.left + r.width * (fx || 0.3)) - s.left) / s.width * 100, ((r.top + r.height * 0.55) - s.top) / s.height * 100];
  }
  function move(p) { cursor.style.left = p[0] + '%'; cursor.style.top = p[1] + '%'; }
  function click() {
    cursor.classList.remove('is-click');
    void cursor.offsetWidth;
    cursor.classList.add('is-click');
  }
  function showTip(el, text) {
    var p = at(el, 0.5);
    tip.textContent = text;
    tip.style.left = Math.min(p[0], 62) + '%';
    tip.style.top = p[1] + 7 + '%';
    tip.classList.add('is-on');
  }

  /* ---- the game's screens (canvas) ---- */
  var W = 384, H = 240, S = 1, ctx = cv.getContext('2d');
  var img = {};
  ['button', 'button_highlighted', 'text_field', 'join', 'join_highlighted', 'world-1', 'world-2', 'panorama'].forEach(function (n) {
    var im = new Image();
    im.src = '/minecrafticons/gui/menu/' + n + (/world|panorama/.test(n) ? '.webp' : '.png');
    img[n] = im;
  });
  img.icon = new Image();
  img.icon.src = '/minecrafticons/minecraft-hcpc/hcpc3-compresso.jpg';
  var fontReady = false;
  if (window.McFont) {
    McFont.load(function () {
      fontReady = true;
      if (!playing && SCENES[scene].mode === 'mc') draw(0);
    });
  }

  function size() {
    W = window.matchMedia('(max-width: 600px)').matches ? 320 : 384; // 4:3 on phones, 16:10 wider: same query as mc-worlds.css
    S = Math.max(1, Math.ceil(stage.clientWidth * (window.devicePixelRatio || 1) / W));
    cv.width = W * S;
    cv.height = H * S;
  }
  function fill(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function text(str, x, y, opt) {
    if (!fontReady) return 0;
    opt = opt || {};
    var runs = [{ text: str, color: opt.color || 'ffffff', italic: opt.italic }];
    if (opt.center) x -= McFont.width(runs) / 2;
    McFont.draw(ctx, runs, x, y, { scale: 1, shadow: opt.shadow !== false });
    return McFont.width(runs);
  }
  // 200x20 sprites, nine-slice: for widths up to 200 the game's left + right halves are exact.
  function sprite2(im, x, y, w) {
    if (!im.complete || !im.naturalWidth) return;
    var h = w / 2;
    ctx.drawImage(im, 0, 0, Math.ceil(h), 20, x, y, Math.ceil(h), 20);
    ctx.drawImage(im, 200 - Math.floor(h), 0, Math.floor(h), 20, x + Math.ceil(h), y, Math.floor(h), 20);
  }
  function button(label, x, y, w, state) {
    if (state === 'off') {
      sprite2(img.button, x, y, w);
      fill(x, y, w, 20, 'rgba(0,0,0,0.45)'); // button_disabled reads as a darker, flatter key
      text(label, x + w / 2, y + 6, { center: true, color: 'a0a0a0' });
      return;
    }
    sprite2(state === 'hot' ? img.button_highlighted : img.button, x, y, w);
    text(label, x + w / 2, y + 6, { center: true });
  }
  function background(t) {
    var p = img.panorama;
    if (p.complete && p.naturalWidth) {
      var sh = H, sw = p.naturalWidth * (H / p.naturalHeight);
      var off = (t * 0.004) % sw; // the title panorama turns slowly
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(p, -off, 0, sw, sh);
      ctx.drawImage(p, sw - off, 0, sw, sh);
      ctx.imageSmoothingEnabled = false;
    } else fill(0, 0, W, H, '#2a2a2a');
    fill(0, 0, W, H, 'rgba(0,0,0,0.25)'); // menu_background.png: black at 64/255
  }

  // SelectWorldScreen: title y8, search 200x20 at y22, list y48..H-64 (36px rows,
  // 270 wide), footer buttons at H-52 and H-28.
  var mc = { t: 0, list: 0, hover: false, iconHot: false, sel: false, verGlow: 0, btnHot: '', pressed: '', screen: 'select' };
  function drawSelect(T) {
    var cx = W / 2, top = 48, bottom = H - 64;
    background(T);
    text('Select World', cx, 8, { center: true });
    sprite2(img.text_field, cx - 100, 22, 200);
    text('search for worlds', cx - 96, 28, { color: '707070', shadow: false });
    fill(0, top, W, bottom - top, 'rgba(0,0,0,0.44)'); // menu_list_background: 112/255
    fill(0, top - 2, W, 1, 'rgba(255,255,255,0.2)'); // header_separator
    fill(0, top - 1, W, 1, 'rgba(0,0,0,0.75)');
    fill(0, bottom, W, 1, 'rgba(0,0,0,0.75)'); // footer_separator
    fill(0, bottom + 1, W, 1, 'rgba(255,255,255,0.2)');

    var left = cx - 135, y = top + 4;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, W, bottom - top);
    ctx.clip();
    var list = [];
    // LevelSummary.createInfo: "Hardcore Mode" in 0xFF0000, then ", Version: " and the version.
    if (mc.list) list.push({ name: WORLD, id: WORLD + ' (' + stamp(0) + ')', mode: 'Hardcore Mode', modeColor: 'ff0000', ver: WORLD_VER, old: true, icon: img.icon, isNew: true });
    list.push({ name: 'New World', id: 'New World (' + stamp(1) + ')', mode: 'Survival Mode', ver: current, icon: img['world-1'] });
    list.push({ name: 'Survival World', id: 'Survival World (' + stamp(4) + ')', mode: 'Survival Mode', ver: current, icon: img['world-2'] });
    var slide = mc.list ? Math.min(1, mc.list) : 1;
    list.forEach(function (e, i) {
      var ry = y + i * 36;
      if (e.isNew) ctx.globalAlpha = slide;
      if (e.isNew && mc.sel) {
        fill(left - 2, ry - 2, 274, 36, '#ffffff');
        fill(left - 1, ry - 1, 272, 34, '#000000');
      }
      if (e.icon.complete && e.icon.naturalWidth) {
        ctx.imageSmoothingEnabled = true;
        var iw = e.icon.naturalWidth, ih = e.icon.naturalHeight, m = Math.min(iw, ih);
        ctx.drawImage(e.icon, (iw - m) / 2, (ih - m) / 2, m, m, left, ry, 32, 32);
        ctx.imageSmoothingEnabled = false;
      }
      if (e.isNew && (mc.hover || mc.sel)) {
        fill(left, ry, 32, 32, 'rgba(144,144,144,0.63)'); // 0xA0909090
        var j = mc.iconHot ? img.join_highlighted : img.join;
        if (j.complete) ctx.drawImage(j, left, ry, 32, 32);
      }
      text(e.name, left + 35, ry + 1, { shadow: false });
      text(e.id, left + 35, ry + 12, { color: '808080', shadow: false });
      var w = text(e.mode, left + 35, ry + 21, { color: e.modeColor || '808080', shadow: false });
      w += text(', Version: ', left + 35 + w, ry + 21, { color: '808080', shadow: false });
      if (e.isNew && mc.verGlow) {
        var vw = McFont.width([{ text: e.ver, italic: true }]);
        ctx.globalAlpha = slide * mc.verGlow;
        fill(left + 35 + w - 2, ry + 19, vw + 4, 12, 'rgba(255,215,64,0.28)');
        ctx.strokeStyle = '#ffd740';
        ctx.lineWidth = 1;
        ctx.strokeRect(left + 35 + w - 2.5, ry + 18.5, vw + 5, 13);
        ctx.globalAlpha = slide;
      }
      text(e.ver, left + 35 + w, ry + 21, { color: '808080', shadow: false, italic: e.old }); // a world that needs a backup shows its version in italics
      ctx.globalAlpha = 1;
    });
    ctx.restore();

    button(mc.sel ? 'Upgrade and Play' : 'Play Selected World', cx - 154, H - 52, 150, mc.sel ? (mc.btnHot === 'play' ? 'hot' : '') : 'off');
    button('Create New World', cx + 4, H - 52, 150);
    button('Edit', cx - 154, H - 28, 72, mc.sel ? '' : 'off');
    button('Delete', cx - 76, H - 28, 72, mc.sel ? '' : 'off');
    button('Re-Create', cx + 4, H - 28, 72, mc.sel ? '' : 'off');
    button('Back', cx + 82, H - 28, 72);
  }
  // BackupConfirmScreen: title y50, message from y70 wrapped to width-50,
  // buttons at 100 + (lines + 1) * 9, Cancel 24 below.
  function backupLayout() {
    var lines = fontReady ? McFont.wrap([{ text: 'This world needs to be upgraded before you can play it. We strongly suggest creating a backup before continuing in case you experience world corruption.' }], W - 50) : [];
    return { lines: lines, by: 100 + (lines.length + 1) * 9 };
  }
  function drawBackup(T) {
    var cx = W / 2, L = backupLayout();
    background(T);
    text('Create a backup before upgrading this world?', cx, 50, { center: true });
    L.lines.forEach(function (ln, i) {
      text(ln.map(function (r) { return r.text; }).join(''), cx, 70 + i * 9, { center: true });
    });
    button('Create Backup and Load', cx - 155, L.by, 150, mc.btnHot === 'backup' ? 'hot' : '');
    button("I Know What I'm Doing!", cx + 5, L.by, 150);
    button('Cancel', cx - 75, L.by + 24, 150);
  }
  function drawWaiting(T) {
    var cx = W / 2;
    background(T);
    text('Creating Backup', cx, H / 2 - 30, { center: true });
    var lines = fontReady ? McFont.wrap([{ text: 'Depending on the size of your world, this may take a while. Please do not close the game or shut off your device.' }], W - 50) : [];
    lines.forEach(function (ln, i) {
      text(ln.map(function (r) { return r.text; }).join(''), cx, H / 2 - 10 + i * 9, { center: true, color: 'a0a0a0' });
    });
  }
  function stamp(daysAgo) {
    var d = new Date(Date.now() - daysAgo * 864e5);
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  function draw(T) {
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (mc.screen === 'select') drawSelect(T);
    else if (mc.screen === 'backup') drawBackup(T);
    else drawWaiting(T);
  }
  // GUI px -> stage %
  function gui(x, y) { return [x / W * 100, y / H * 100]; }

  /* ---- the four scenes: [ms, action] cues ---- */
  var SCENES = [
    { dur: 8200, mode: 'win', cues: [
      [0, function () {
        win.className = 'mwi-win';
        crumbs(OS[os].home);
        rows([row('Pictures', 'dir'), row('hardcore-parcore.zip', 'zip', '1.4 GB'), row('Setup', 'dir')]);
        move([78, 88]);
      }],
      [500, function () { move(at(rowsEl.children[1])); }],
      [1300, function () {
        var r = rowsEl.children[1];
        r.classList.add('is-sel');
        click();
        if (!OS[os].menu) return click(); // Mac: double-click
        menuEl.innerHTML = OS[os].menu.map(function (m, i) { return '<span' + (i === OS[os].hot ? ' class="is-hot-later"' : '') + '>' + esc(m) + '</span>'; }).join('');
        var p = at(r, 0.45);
        menuEl.style.left = p[0] + '%';
        menuEl.style.top = p[1] + '%';
        menuEl.classList.add('is-on');
      }],
      [2000, function () { var h = menuEl.querySelector('.is-hot-later'); if (h) move(at(h, 0.4)); }],
      [2400, function () { var h = menuEl.querySelector('.is-hot-later'); if (h) { h.classList.add('is-hot'); click(); } }],
      [2800, function () {
        menuEl.classList.remove('is-on');
        rowsEl.children[1].classList.remove('is-sel');
        rowsEl.insertAdjacentHTML('afterbegin', row(WORLD, 'dir', '', 'is-new'));
      }],
      [3700, function () { move(at(rowOf(WORLD))); }],
      [4300, function () { click(); rowOf(WORLD).classList.add('is-sel'); }],
      [4500, function () { click(); }],
      [4900, function () {
        crumbs(OS[os].home.concat(WORLD));
        rows([row('data', 'dir'), row('DIM-1', 'dir'), row('DIM1', 'dir'), row('entities', 'dir'), row('playerdata', 'dir'), row('region', 'dir'), row('icon.png', 'png'), row('level.dat', 'dat', '', 'is-key')]);
        move([82, 90]);
      }],
      [5600, function () { showTip(rowOf('level.dat'), 'level.dat lives here. This is the world.'); }]
    ] },
    { dur: 7600, mode: 'win', cues: [
      [0, function () {
        win.className = 'mwi-win is-split';
        crumbs(OS[os].home);
        pathEl.textContent = '';
        rows([]);
        move([60, 18]);
      }],
      [400, function () { click(); pathEl.classList.add('is-typing'); }],
      [600, function () {
        var full = OS[os].path, i = 0;
        clearInterval(pathEl._t);
        pathEl._t = setInterval(function () {
          pathEl.textContent = full.slice(0, ++i);
          if (i >= full.length) clearInterval(pathEl._t);
        }, 1300 / full.length);
      }],
      [2200, function () {
        clearInterval(pathEl._t);
        crumbs(OS[os].crumbs);
        rows([row('New World', 'dir'), row('Survival World', 'dir')]);
      }],
      [2700, function () { move(at(document.getElementById('mwiSrc'))); }],
      [3300, function () {
        var p = at(document.getElementById('mwiSrc'));
        ghost.style.transition = 'none';
        ghost.style.left = p[0] + '%';
        ghost.style.top = p[1] + '%';
        ghost.classList.add('is-on');
        void ghost.offsetWidth;
        ghost.style.transition = '';
      }],
      [3500, function () {
        var p = at(rowsEl, 0.4);
        ghost.style.left = p[0] + '%';
        ghost.style.top = p[1] + '%';
        move(p);
      }],
      [4600, function () {
        ghost.classList.remove('is-on');
        var n = rowOf('Survival World');
        n.insertAdjacentHTML('beforebegin', row(WORLD, 'dir', '', 'is-new is-sel'));
      }],
      [5300, function () { showTip(rowOf(WORLD), 'In. 3,000 days, one life, now on your PC.'); }]
    ] },
    { dur: 7400, mode: 'mc', cues: [
      [0, function () { mc.screen = 'select'; mc.list = 0; mc.hover = mc.sel = mc.iconHot = false; mc.verGlow = 0; mc.btnHot = ''; move(gui(W - 30, H - 70)); }],
      [600, function () { mc.list = 0.01; }],
      [1600, function () { move(gui(W / 2 - 40, 62)); }],
      [2200, function () { mc.hover = true; }],
      [2700, function () { click(); mc.sel = true; }],
      [3100, function () { mc.verGlow = 1; move(gui(W / 2 + 40, 78)); }],
      [5300, function () { move(gui(W / 2 - 90, H - 42)); }],
      [5900, function () { mc.btnHot = 'play'; }]
    ] },
    { dur: 7200, mode: 'mc', cues: [
      [0, function () { mc.screen = 'backup'; mc.btnHot = ''; move(gui(W / 2, H - 20)); }],
      [1500, function () { var L = backupLayout(); move(gui(W / 2 - 90, L.by + 12)); }],
      [2200, function () { mc.btnHot = 'backup'; }],
      [3200, function () { click(); }],
      [3500, function () { mc.screen = 'wait'; move(gui(W - 20, H - 20)); }]
    ] }
  ];

  var scene = 0, t0 = 0, fired = 0, playing = false, visible = false, raf = 0;
  function setStep(i) {
    steps.forEach(function (s, k) {
      s.classList.toggle('is-on', k === i);
      s.setAttribute('aria-current', k === i ? 'step' : 'false');
    });
    stage.setAttribute('data-mode', SCENES[i].mode);
  }
  function reset() {
    tip.classList.remove('is-on');
    menuEl.classList.remove('is-on');
    ghost.classList.remove('is-on');
    clearInterval(pathEl._t);
  }
  function start(i) {
    scene = i;
    fired = 0;
    t0 = performance.now();
    reset();
    setStep(i);
    box.style.setProperty('--mwi-dur', SCENES[i].dur + 'ms');
    steps.forEach(function (s) { s.classList.remove('is-run'); });
    void steps[i].offsetWidth;
    if (playing) steps[i].classList.add('is-run');
  }
  // Reduced motion / paused: run every cue at once and show the end state.
  function settle(i) {
    start(i);
    var cues = SCENES[i].cues;
    var saved = click;
    click = function () {};
    cues.forEach(function (c) { c[1](); });
    click = saved;
    clearInterval(pathEl._t);
    if (i === 1) { crumbs(OS[os].crumbs); }
    fired = cues.length;
    if (SCENES[i].mode === 'mc') { mc.list = 1; draw(0); }
  }
  function tick(now) {
    raf = 0;
    if (!playing) return;
    var t = now - t0, sc = SCENES[scene];
    while (fired < sc.cues.length && sc.cues[fired][0] <= t) sc.cues[fired++][1]();
    if (sc.mode === 'mc') {
      if (mc.list && mc.list < 1) mc.list = Math.min(1, mc.list + 0.06);
      if (mc.verGlow) mc.verGlow = 0.6 + 0.4 * Math.abs(Math.sin(t / 300));
      draw(now);
    }
    if (t >= sc.dur) start((scene + 1) % SCENES.length);
    raf = requestAnimationFrame(tick);
  }
  function play() {
    if (reduce || !visible || playing) return;
    playing = true;
    start(scene);
    raf = requestAnimationFrame(tick);
  }
  function pause() {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  steps.forEach(function (s, i) {
    s.querySelector('button').addEventListener('click', function () {
      if (playing) start(i);
      else settle(i);
    });
  });
  function setOs(k) {
    os = k;
    box.setAttribute('data-os', k);
    osBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-os') === k ? 'true' : 'false'); });
    var code = document.getElementById('mwiPathCode');
    code.textContent = OS[k].path;
    document.getElementById('mwiPathCopy').setAttribute('data-copy', OS[k].path);
    if (SCENES[scene].mode === 'win') (playing ? start : settle)(scene);
  }
  osBtns.forEach(function (b) {
    b.addEventListener('click', function () { setOs(b.getAttribute('data-os')); });
  });

  size();
  window.addEventListener('resize', function () {
    size();
    if (!playing && SCENES[scene].mode === 'mc') draw(0);
  });
  setOs(os);
  settle(0);
  if (!reduce && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible) play();
      else pause();
    }, { threshold: 0.35 }).observe(stage);
  }
  // The font and sprites arrive after the first paint; redraw a still canvas once they do.
  window.addEventListener('load', function () { if (!playing && SCENES[scene].mode === 'mc') draw(0); });
})();
