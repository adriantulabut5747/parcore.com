/* =======================================================================
   EQUIPMENT TIER LIST MAKER (/coc/tools/equipment-tier-list)
   Built from coc-equipment.json. The rows on the page ARE the state, and
   every change copies them into the address (replaceState):
     ?r=S:fireball,spiky-ball&r=Ore first:vampstache&r=B:&hero=2
   one r per row, top to bottom: "name:ids". The name is split off at the
   LAST colon (ids never contain one). No r at all = the default S-D board.
   So "Copy link" just copies the address, and the article's "Make your own"
   link pre-fills a ranking. A row's colour goes by its position (PAL),
   so it isn't stored.
   Moving: drag (mouse at once, touch after a 200ms hold so a swipe still
   scrolls the page), or tap a piece then tap a tier / the pool.
   ======================================================================= */
(function () {
  var NAMES = 'SABCDEFGHI';
  // Row colours top to bottom, as "r, g, b" for the CSS rgba(var(--tl-rgb), a).
  // S is the site's tool-card red (#e06363); the rest step through the spectrum.
  var PAL = [
    '224, 99, 99',
    '230, 140, 64',
    '222, 190, 72',
    '120, 194, 92',
    '64, 184, 140',
    '84, 156, 232',
    '160, 116, 232',
    '226, 104, 172',
    '150, 156, 166',
    '112, 118, 128',
  ];
  var MAX = PAL.length;
  var NAME_MAX = 20;
  var DIR = '/clashofclans/coctools/units/';
  var box = document.getElementById('tierlist');
  var board = document.getElementById('tlBoard');
  var addBtn = document.getElementById('tlAdd');
  var pool = document.getElementById('tlPool');
  var heroBox = document.getElementById('tlHeroes');
  var data,
    byId = {};
  var hero = ''; // '' = all heroes
  var picked = null; // tile chosen by a tap, waiting for a tier

  var esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  var rows = () => [...board.querySelectorAll('.tl-row')];
  var tileEl = (id) => box.querySelector('.tl-tile[data-id="' + id + '"]');

  fetch('/coc-equipment.json')
    .then((r) => r.json())
    .then((d) => {
      data = d;
      d.equipment.forEach((e) => (byId[e.id] = e));
      document.getElementById('tlCount').textContent = d.equipment.length;
      build();
      load(new URLSearchParams(location.search));
    });

  function build() {
    var heroes = data.heroes;
    heroBox.innerHTML =
      '<button type="button" class="am-btn gd-chip" data-hero="" aria-pressed="true">All</button>' +
      Object.keys(heroes)
        .map(
          (k) =>
            '<button type="button" class="am-btn gd-chip tl-hero" data-hero="' +
            k +
            '" aria-pressed="false" title="' +
            esc(heroes[k].name) +
            '" aria-label="' +
            esc(heroes[k].name) +
            '"><img src="' +
            DIR +
            esc(heroes[k].img) +
            '" alt="" width="96" height="96"><span>' +
            esc(heroes[k].name) +
            '</span></button>',
        )
        .join('');
    pool.innerHTML = data.equipment
      .map(
        (e) =>
          '<button type="button" class="tl-tile ' +
          (e.rarity === 'Epic' ? 'tl-epic' : 'tl-common') +
          '" data-id="' +
          e.id +
          '" data-hero="' +
          e.hero +
          '" title="' +
          esc(e.name) +
          '" aria-label="' +
          esc(e.name) +
          '"><img src="' +
          DIR +
          esc(e.img) +
          '" alt="" width="128" height="128" draggable="false"><img class="tl-badge" src="' +
          DIR +
          esc(heroes[e.hero].img) +
          '" alt="" draggable="false"></button>',
      )
      .join('');
  }

  // ---- rows ---------------------------------------------------------------
  function addRow(name) {
    var row = document.createElement('div');
    row.className = 'tl-row';
    row.innerHTML =
      '<div class="tl-plate"><span class="tl-name" spellcheck="false" role="textbox" aria-label="Tier name"></span></div>' +
      '<div class="tl-zone"></div>' +
      '<button type="button" class="tl-del" aria-label="Remove this tier" title="Remove tier">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>';
    var n = row.querySelector('.tl-name');
    n.contentEditable = 'plaintext-only';
    if (n.contentEditable !== 'plaintext-only') n.contentEditable = 'true'; // older Firefox; paste is cleaned below
    n.textContent = name;
    board.insertBefore(row, addBtn);
    return row;
  }
  // Colours and the add/remove buttons follow the row count.
  function refresh() {
    var rs = rows();
    rs.forEach((r, i) => {
      r.style.setProperty('--tl-rgb', PAL[i]);
      sizeName(r.querySelector('.tl-name'));
    });
    addBtn.hidden = rs.length >= MAX;
    box.classList.toggle('tl-one-row', rs.length === 1);
  }
  function defaultRows() {
    rows().forEach((r) => r.remove());
    for (var i = 0; i < 5; i++) addRow(NAMES[i]);
  }
  addBtn.addEventListener('click', () => {
    if (rows().length >= MAX) return;
    var r = addRow(NAMES[rows().length]);
    refresh();
    save();
    r.querySelector('.tl-name').focus();
  });
  board.addEventListener('click', (e) => {
    var del = e.target.closest('.tl-del');
    if (!del || rows().length === 1) return;
    var row = del.closest('.tl-row');
    [...row.querySelector('.tl-zone').children].forEach((t) => pool.appendChild(t));
    if (picked && !box.contains(picked)) pick(null);
    row.remove();
    refresh();
    save();
  });

  // Tier names: plain text, one line of input (it wraps on the plate), NAME_MAX letters.
  var sizeName = (el) => el.classList.toggle('tl-long', el.textContent.length > 2);
  board.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('tl-name') && e.key === 'Enter') {
      e.preventDefault();
      e.target.blur();
    }
  });
  board.addEventListener('paste', (e) => {
    if (!e.target.closest('.tl-name')) return;
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\s+/g, ' '));
  });
  board.addEventListener('input', (e) => {
    var n = e.target.closest('.tl-name');
    if (!n) return;
    if (n.textContent.length > NAME_MAX) {
      n.textContent = n.textContent.slice(0, NAME_MAX);
      getSelection().selectAllChildren(n);
      getSelection().collapseToEnd();
    }
    sizeName(n);
  });
  board.addEventListener('focusout', (e) => {
    var n = e.target.closest('.tl-name');
    if (!n) return;
    n.textContent = n.textContent.trim() || NAMES[rows().indexOf(n.closest('.tl-row'))];
    sizeName(n);
    save();
  });

  // ---- state <-> address --------------------------------------------------
  // q: the address's query, or an imported link's (see Import list below).
  function load(q) {
    var rs = q.getAll('r').slice(0, MAX);
    if (!rs.length) defaultRows();
    rs.forEach((v, i) => {
      var cut = v.lastIndexOf(':');
      var name = (cut < 0 ? v : v.slice(0, cut)).trim().slice(0, NAME_MAX) || NAMES[i];
      var zone = addRow(name).querySelector('.tl-zone');
      (cut < 0 ? '' : v.slice(cut + 1)).split(',').forEach((id) => {
        var t = byId[id] && pool.querySelector('[data-id="' + id + '"]');
        if (t) zone.appendChild(t);
      });
    });
    refresh();
    setHero(data.heroes[q.get('hero')] ? q.get('hero') : '');
  }
  function save() {
    var q = new URLSearchParams();
    var list = rows().map((r) => ({
      name: r.querySelector('.tl-name').textContent.trim(),
      ids: [...r.querySelector('.tl-zone').children].map((x) => x.dataset.id).join(','),
    }));
    var pristine = list.length === 5 && list.every((r, i) => r.name === NAMES[i] && !r.ids);
    if (!pristine) list.forEach((r) => q.append('r', r.name + ':' + r.ids));
    if (hero) q.set('hero', hero);
    var qs = q.toString().replace(/%2C/g, ',').replace(/%3A/g, ':'); // readable share link
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    var left = [...pool.children].filter((x) => !x.hidden).length;
    document.getElementById('tlLeft').textContent = left ? '(' + left + ')' : '';
  }

  function setHero(h) {
    hero = h;
    heroBox.querySelectorAll('.gd-chip').forEach((b) => b.setAttribute('aria-pressed', b.dataset.hero === h));
    box.querySelectorAll('.tl-tile').forEach((t) => (t.hidden = !!h && t.dataset.hero !== h));
    box.classList.toggle('tl-one-hero', !!h);
    if (picked && picked.hidden) pick(null);
    save();
  }
  heroBox.addEventListener('click', (e) => {
    var b = e.target.closest('.gd-chip');
    if (b) setHero(b.dataset.hero);
  });

  // ---- moving -------------------------------------------------------------
  function pick(tile) {
    if (picked) picked.classList.remove('is-picked');
    picked = tile === picked ? null : tile;
    if (picked) picked.classList.add('is-picked');
    box.classList.toggle('tl-picking', !!picked);
  }
  // Drop `tile` into `zone`, before the tile whose centre is past (x, y).
  function place(tile, zone, x, y) {
    var before = null;
    if (x != null)
      before = [...zone.children].find((c) => {
        if (c === tile || c.hidden) return false;
        var r = c.getBoundingClientRect();
        return y < r.top || (y < r.bottom && x < r.left + r.width / 2);
      });
    zone.insertBefore(tile, before || null);
    save();
  }

  var drag = null; // {tile, ghost, x0, y0, timer, on}
  document.addEventListener('pointerdown', (e) => {
    var tile = e.target.closest('.tl-tile');
    if (!tile || e.button) return;
    drag = { tile: tile, x0: e.clientX, y0: e.clientY, on: false, touch: e.pointerType !== 'mouse' };
    if (drag.touch) drag.timer = setTimeout(() => start(e.clientX, e.clientY), 200);
  });
  function start(x, y) {
    if (!drag) return;
    drag.on = true;
    pick(null);
    var r = drag.tile.getBoundingClientRect();
    var g = drag.tile.cloneNode(true);
    g.classList.add('tl-ghost');
    g.style.width = r.width + 'px';
    g.style.height = r.height + 'px';
    drag.dx = x - r.left;
    drag.dy = y - r.top;
    document.body.appendChild(g);
    drag.ghost = g;
    drag.tile.classList.add('is-dragging');
    move(x, y);
  }
  function move(x, y) {
    drag.ghost.style.transform = 'translate(' + (x - drag.dx) + 'px,' + (y - drag.dy) + 'px) scale(1.06)';
    box.querySelectorAll('.tl-over').forEach((z) => z.classList.remove('tl-over'));
    var z = zoneAt(x, y);
    if (z) z.classList.add('tl-over');
  }
  function zoneAt(x, y) {
    var el = document.elementFromPoint(x, y);
    var row = el && el.closest('.tl-row');
    return row ? row.querySelector('.tl-zone') : el && el.closest('.tl-zone');
  }
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.on) return move(e.clientX, e.clientY);
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) {
      if (drag.touch) {
        clearTimeout(drag.timer); // moved before the hold: it's a scroll
        drag = null;
      } else start(e.clientX, e.clientY);
    }
  });
  // While dragging by touch, stop the page from scrolling under the finger.
  document.addEventListener('touchmove', (e) => drag && drag.on && e.preventDefault(), { passive: false });
  function end(e, cancelled) {
    if (!drag) return;
    clearTimeout(drag.timer);
    var d = drag;
    drag = null;
    if (!d.on) {
      if (!cancelled) pick(d.tile);
      return;
    }
    d.ghost.remove();
    d.tile.classList.remove('is-dragging');
    box.querySelectorAll('.tl-over').forEach((z) => z.classList.remove('tl-over'));
    var z = !cancelled && zoneAt(e.clientX, e.clientY);
    if (z) place(d.tile, z, e.clientX, e.clientY);
  }
  document.addEventListener('pointerup', (e) => end(e, false));
  document.addEventListener('pointercancel', (e) => end(e, true));
  // A long press on a phone opens the image menu without this.
  document.addEventListener('contextmenu', (e) => e.target.closest('.tl-tile') && e.preventDefault());

  // Tap-to-place: with a piece picked, a tap on a row or the pool moves it.
  // (A tap on another piece picks that one instead -- handled by pointerup.)
  box.addEventListener('click', (e) => {
    if (e.detail === 0 && e.target.closest('.tl-tile')) return pick(e.target.closest('.tl-tile')); // keyboard Enter/Space
    if (!picked || e.target.closest('.tl-tile, .tl-name, button')) return;
    var row = e.target.closest('.tl-row');
    var z = row ? row.querySelector('.tl-zone') : e.target.closest('.tl-zone');
    if (z) {
      place(picked, z);
      pick(null);
    }
  });
  // Keyboard: Enter picks a piece, then 1-9 sends it to that row (top = 1), 0 back to Unranked.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return pick(null);
    if (!picked || e.target.isContentEditable || !/^[0-9]$/.test(e.key)) return;
    var zone = e.key === '0' ? pool : rows()[e.key - 1] && rows()[e.key - 1].querySelector('.tl-zone');
    if (!zone) return;
    var tile = picked;
    place(tile, zone);
    pick(null);
    tile.focus();
  });

  // ---- Import list: paste a tier list link to load it ----------------------
  // Takes the whole link or just its "r=..." part. Everything goes back to
  // the pool first, so pieces the link doesn't rank end up Unranked.
  var importForm = document.getElementById('tlImport');
  var importBtn = document.getElementById('tlImportBtn');
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('tlToast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600);
  }
  function importBox(open) {
    importForm.hidden = !open;
    importBtn.setAttribute('aria-expanded', open);
    importBtn.classList.toggle('active', open);
    if (open) document.getElementById('tlImportInput').focus();
  }
  importBtn.addEventListener('click', () => importBox(importForm.hidden));
  importForm.addEventListener('submit', (e) => {
    e.preventDefault();
    var input = document.getElementById('tlImportInput');
    var text = input.value.trim();
    var q;
    try {
      q = new URL(/^r=/.test(text) ? '?' + text : text, location.href).searchParams;
    } catch (err) {}
    if (!q || !q.getAll('r').length) return toast("That doesn't look like a tier list link");
    var ranked = rows().some((r) => r.querySelector('.tl-zone').children.length);
    (ranked
      ? ask('Replace your tier list?', 'The link\u2019s list takes the place of the one on the board now.', 'Replace')
      : Promise.resolve(true)
    ).then((ok) => ok && importList(q, input));
  });
  function importList(q, input) {
    data.equipment.forEach((eq) => pool.appendChild(tileEl(eq.id)));
    rows().forEach((r) => r.remove());
    pick(null);
    load(q);
    input.value = '';
    importBox(false);
    toast('Tier list loaded');
  }

  // Confirm box: the leaving-Parchrome dialog's look (.lv, coc-tools.css).
  // Resolves true on the red button; Cancel, Escape or a backdrop click = false.
  // The buttons answer directly instead of waiting for the dialog's "close"
  // event, which arrives a beat later (and not at all in headless tests).
  var dlg = document.getElementById('tlConfirm');
  var answer = null;
  function finish(ok) {
    if (answer) answer(ok);
    answer = null;
    if (dlg.open) dlg.close();
  }
  dlg.querySelector('.lv-go').addEventListener('click', () => finish(true));
  dlg.querySelector('.lv-stay').addEventListener('click', () => finish(false));
  dlg.addEventListener('click', (e) => e.target === dlg && finish(false));
  // Escape. A close event arrives a beat after dlg.close(), so one left over
  // from the last answer must not cancel a question asked since (dialog open again).
  dlg.addEventListener('close', () => !dlg.open && finish(false));
  function ask(title, text, okLabel) {
    document.getElementById('tlConfirmTitle').textContent = title;
    document.getElementById('tlConfirmText').textContent = text;
    document.getElementById('tlConfirmOk').textContent = okLabel;
    dlg.showModal();
    return new Promise((done) => (answer = done));
  }

  // ---- buttons ------------------------------------------------------------
  document.getElementById('tlReset').addEventListener('click', async () => {
    var ok = await ask(
      'Reset your tier list?',
      'Every piece goes back to Unranked and the tiers go back to S to D. This can\u2019t be undone.',
      'Reset',
    );
    if (!ok) return;
    data.equipment.forEach((e) => pool.appendChild(tileEl(e.id)));
    defaultRows();
    pick(null);
    refresh();
    save();
  });

  function flash(btn, text) {
    var label = btn.querySelector('.am-btn-text');
    var old = label.textContent;
    label.textContent = text;
    btn.classList.add('is-done');
    setTimeout(() => {
      label.textContent = old;
      btn.classList.remove('is-done');
    }, 1600);
  }
  document.getElementById('tlCopy').addEventListener('click', function () {
    navigator.clipboard.writeText(location.href).then(
      () => flash(this, 'Copied'),
      () => prompt('Copy this link:', location.href),
    );
  });

  // ---- the picture: drawn on a canvas in the page's own look -------------------
  var rgba = (rgb, a) => 'rgba(' + rgb + ',' + a + ')';
  // The army cards' rarity colours (.as-common / .as-epic), as canvas gradients.
  var RARITY = { Common: ['#2f5c9c', '#1b3560', '#142645'], Epic: ['#6e3aa6', '#3f2068', '#2c1649'] };
  function wrap(x, text, maxW) {
    var lines = [''];
    text.split(' ').forEach((w) => {
      var l = lines[lines.length - 1];
      var next = l ? l + ' ' + w : w;
      if (l && x.measureText(next).width > maxW) lines.push(w);
      else lines[lines.length - 1] = next;
    });
    return lines;
  }
  function card(x, X, Y, w, h, r, fill, line) {
    x.beginPath();
    x.roundRect(X, Y, w, h, r);
    x.fillStyle = fill;
    x.fill();
    x.strokeStyle = line;
    x.lineWidth = 1.5;
    x.stroke();
  }
  document.getElementById('tlPng').addEventListener('click', function () {
    var btn = this;
    var W = 1200,
      PAD = 40,
      LABEL = 150,
      T = 84,
      GAP = 8,
      TOP = 120,
      FOOT = 64,
      RGAP = 10;
    var sx = PAD + LABEL + RGAP,
      sw = W - PAD - sx;
    var per = Math.floor((sw - 16 + GAP) / (T + GAP));
    var rs = rows();
    var list = rs.map((r, i) => ({
      rgb: PAL[i],
      name: r.querySelector('.tl-name').textContent.trim().toUpperCase(),
      tiles: [...r.querySelector('.tl-zone').children].filter((t) => !t.hidden).map((t) => byId[t.dataset.id]),
    }));
    var srcs = new Set();
    list.forEach((r) => r.tiles.forEach((e) => srcs.add(DIR + e.img).add(DIR + data.heroes[e.hero].img)));
    var imgs = {};
    btn.disabled = true;
    Promise.all(
      [document.fonts.load('900 40px Orbitron'), document.fonts.load('800 14px Oxanium')].concat(
        [...srcs].map(
          (s) =>
            new Promise((ok) => {
              var i = new Image();
              i.onload = i.onerror = () => ok((imgs[s] = i));
              i.src = s;
            }),
        ),
      ),
    ).then(() => {
      var c = document.createElement('canvas');
      var x = c.getContext('2d');
      // Name font + lines first: a long name can make its row taller than its pieces.
      list.forEach((r) => {
        r.long = r.name.length > 2;
        r.font = r.long ? '800 15px Oxanium' : '900 44px Orbitron';
        x.font = r.font;
        x.letterSpacing = r.long ? '1.5px' : '0px'; // measure with the spacing it's drawn with
        r.lines = r.long ? wrap(x, r.name, LABEL - 24) : [r.name];
        var tilesH = Math.max(1, Math.ceil(r.tiles.length / per)) * (T + GAP) + GAP + 8;
        r.rh = Math.max(tilesH, r.lines.length * 20 + 32);
      });
      var H = TOP + list.reduce((s, r) => s + r.rh + RGAP, 0) + FOOT;
      c.width = W;
      c.height = H;
      var bg = x.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#18191d');
      bg.addColorStop(1, '#131417');
      x.fillStyle = bg;
      x.fillRect(0, 0, W, H);
      x.textBaseline = 'middle';
      // Title: the banner's Orbitron caps, "TIER LIST" in red.
      x.font = '900 40px Orbitron';
      var t1 = (hero ? data.heroes[hero].name : 'Equipment').toUpperCase() + ' ';
      x.fillStyle = '#eff2f5';
      x.fillText(t1, PAD, TOP / 2);
      x.fillStyle = '#c23b3b';
      x.fillText('TIER LIST', PAD + x.measureText(t1).width, TOP / 2);
      var y = TOP;
      list.forEach((r) => {
        // label: the tool card's glow, in the row's colour
        var cx = PAD + LABEL / 2;
        var g = x.createRadialGradient(cx, y + r.rh * 0.3, 4, cx, y + r.rh * 0.3, LABEL * 0.8);
        g.addColorStop(0, rgba(r.rgb, 0.3));
        g.addColorStop(1, rgba(r.rgb, 0.05));
        card(x, PAD, y, LABEL, r.rh, 12, '#141518', 'rgba(255,255,255,0.06)');
        card(x, PAD, y, LABEL, r.rh, 12, g, rgba(r.rgb, 0.4));
        x.fillStyle = rgba(r.rgb, 1);
        x.textAlign = 'center';
        x.font = r.font;
        if (r.long) x.letterSpacing = '1.5px';
        r.lines.forEach((l, i) => x.fillText(l, cx, y + r.rh / 2 + (i - (r.lines.length - 1) / 2) * 20));
        x.letterSpacing = '0px';
        x.textAlign = 'left';
        // slot: the dark card with a hairline
        card(x, sx, y, sw, r.rh, 12, 'rgba(0,0,0,0.28)', 'rgba(255,255,255,0.06)');
        r.tiles.forEach((e, i) => {
          var tx = sx + 8 + (i % per) * (T + GAP);
          var ty = y + GAP + 4 + Math.floor(i / per) * (T + GAP);
          var rc = RARITY[e.rarity] || RARITY.Common;
          var tg = x.createRadialGradient(tx + T / 2, ty, 0, tx + T / 2, ty, T * 1.1);
          tg.addColorStop(0, rc[0]);
          tg.addColorStop(0.6, rc[1]);
          tg.addColorStop(1, rc[2]);
          card(x, tx, ty, T, T, 10, tg, 'rgba(255,255,255,0.06)');
          var im = imgs[DIR + e.img];
          if (im.naturalWidth) x.drawImage(im, tx + 6, ty + 6, T - 12, T - 12);
          var hb = imgs[DIR + data.heroes[e.hero].img];
          if (!hero && hb.naturalWidth) x.drawImage(hb, tx + T - 28, ty + T - 28, 26, 26);
        });
        y += r.rh + RGAP;
      });
      x.font = '800 14px Oxanium';
      x.letterSpacing = '1.5px';
      x.fillStyle = '#c23b3b';
      x.fillText('PARCHROME', PAD, H - FOOT / 2);
      var bw = x.measureText('PARCHROME  ').width;
      x.fillStyle = '#6d7178';
      x.fillText('MAKE YOURS: PARCHROME.NETLIFY.APP/COC/TOOLS/EQUIPMENT-TIER-LIST', PAD + bw, H - FOOT / 2);
      c.toBlob((b) => {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = 'equipment-tier-list.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        btn.disabled = false;
      });
    });
  });
})();
