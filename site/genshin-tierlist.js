/* =======================================================================
   GENSHIN TIER LIST MAKER (/genshin-impact/tier-list, Oct 26 2026). The CoC tier
   list maker (coc-tierlist.js) in Genshin dress, Adrian: "it should act the same
   way". Three lists, one at a time: characters (default), ?type=weapons,
   ?type=artifacts. LIST below holds everything that differs between them.
   The rows on the page ARE the state; every change copies them into the address
   (replaceState), one r per row, top to bottom, "name:ids":
     ?r=S:2,121&r=Favourites:46&f=hydro
     ?type=weapons&r=S:11515,15509&f=Bow
   The name is split off at the LAST colon (ids never contain one). No r at all =
   the default board. f = the filter chip. "Copy link" just copies the address.
   Ids: characters = feed id minus 10000000 (Ayaka = 2), weapons and artifact sets
   = their game ids. A row's colour goes by its position (PAL), so it isn't stored.
   Moving: drag (mouse at once, touch after a 200ms hold so a swipe still scrolls
   the page), tap a piece then tap a tier / the pool, or Enter then 1-9 / 0.
   Switching lists is a page load; with anything ranked it asks first.
   Data: characters from the feed (GI.feed), genshin-weapons.json, genshin-artifacts.json.
   Styles: genshin-tierlist.css.
   ======================================================================= */
(function () {
  const { esc } = window.GI;
  const NAMES = 'SABCDEFGHI';
  // Row colours top to bottom, as "r, g, b" (the CoC maker's, so both read the same).
  const PAL = ['224, 99, 99', '230, 140, 64', '222, 190, 72', '120, 194, 92', '64, 184, 140', '84, 156, 232', '160, 116, 232', '226, 104, 172', '150, 156, 166', '112, 118, 128'];
  const MAX = PAL.length;
  const NAME_MAX = 20;
  const ROWS = 5; // S to D
  const ELS = ['pyro', 'hydro', 'anemo', 'electro', 'dendro', 'cryo', 'geo'];
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const chip = (f, label, on, extra) =>
    `<button type="button" class="tl-chip${extra ? ' ' + extra.cls : ''}" data-filter="${esc(f)}" aria-pressed="${on}"${extra ? ` title="${esc(label)}" aria-label="${esc(label)}"` : ''}>${extra ? extra.html : ''}<span>${esc(label)}</span></button>`;

  const q0 = new URLSearchParams(location.search);
  const TYPE = ['weapons', 'artifacts'].includes(q0.get('type')) ? q0.get('type') : 'characters';
  const LIST = {
    characters: {
      load: () => GI.feed,
      items: (d) =>
        (d.characters || [])
          .slice()
          .sort((a, b) => (b.release || 0) - (a.release || 0))
          .map((c) => ({ id: String(c.id - 10000000), name: c.name, img: c.icon, r: c.rarity, tag: (c.element || 'none').toLowerCase(), badge: c.element ? GI.elIcon(c.element.toLowerCase()) : '' })),
      filters: ['', ...ELS],
      chips: (f) => chip('', 'All', !f) + ELS.map((e) => chip(e, cap(e), f === e, { cls: 'tl-el', html: `<img src="${GI.elIcon(e)}" alt="" width="64" height="64">` })).join(''),
      what: 'character',
      title: (f) => (f ? cap(f) + ' characters ' : 'Characters ').toUpperCase(),
      file: 'genshin-character-tier-list.png',
    },
    weapons: {
      load: () => fetch('/genshin-weapons.json').then((r) => r.json()),
      items: (d) =>
        (d.weapons || [])
          .filter((w) => w.rarity >= 3)
          .sort((a, b) => b.rarity - a.rarity || a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
          .map((w) => ({ id: String(w.id), name: w.name, img: w.icon || w.art, r: w.rarity, tag: w.type })),
      filters: ['', 'Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst'],
      chips: (f) => ['', 'Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst'].map((t) => chip(t, t || 'All', f === t)).join(''),
      what: 'weapon',
      title: (f) => (f ? f + 's ' : 'Weapons ').toUpperCase(),
      file: 'genshin-weapon-tier-list.png',
    },
    artifacts: {
      load: () => fetch('/genshin-artifacts.json').then((r) => r.json()),
      items: (d) =>
        (d.sets || [])
          .map((s) => ({ s, top: Math.max(...(s.rarity || [4])) }))
          .sort((a, b) => b.top - a.top || a.s.name.localeCompare(b.s.name))
          .map(({ s, top }) => ({ id: String(s.id), name: s.name, img: (s.pieces.find((p) => p.slot === 'Flower of Life') || s.pieces[0] || {}).art || '', r: top, tag: top >= 5 ? 'five' : 'four' })),
      filters: ['', 'five', 'four'],
      chips: (f) => chip('', 'All sets', !f) + chip('five', '5★ sets', f === 'five') + chip('four', '4★ and below', f === 'four'),
      what: 'set',
      title: (f) => (f === 'five' ? '5★ artifact sets ' : f === 'four' ? '4★ artifact sets ' : 'Artifact sets ').toUpperCase(),
      file: 'genshin-artifact-tier-list.png',
    },
  }[TYPE];
  const LAST = NAMES[ROWS - 1];

  const $ = (id) => document.getElementById(id);
  const box = $('tierlist');
  const board = $('tlBoard');
  const addBtn = $('tlAdd');
  const pool = $('tlPool');
  const chipBox = $('tlFilters');
  let items = [];
  const byId = {};
  let filter = ''; // '' = everything
  let picked = null; // tile chosen by a tap, waiting for a tier

  const rows = () => [...board.querySelectorAll('.tl-row')];
  const tileEl = (id) => box.querySelector('.tl-tile[data-id="' + id + '"]');
  const ranked = () => rows().some((r) => r.querySelector('.tl-zone').children.length);

  // This list's copy and keys; the other lists' [data-mode] blocks hide.
  box.dataset.type = TYPE;
  document.querySelectorAll('[data-mode]').forEach((el) => (el.hidden = el.dataset.mode !== TYPE));
  document.querySelectorAll('#tlModes [data-type]').forEach((b) => {
    b.classList.toggle('active', b.dataset.type === TYPE);
    b.setAttribute('aria-selected', b.dataset.type === TYPE);
    b.addEventListener('click', async () => {
      if (b.dataset.type === TYPE) return;
      const other = b.dataset.type;
      if (ranked() && !(await ask('Switch to ' + other + '?', 'One list at a time: your ' + TYPE + ' tier list will be cleared. Copy its link first if you want to keep it.', 'Switch'))) return;
      location.href = location.pathname + (other === 'characters' ? '' : '?type=' + other);
    });
  });

  LIST.load()
    .then((d) => {
      items = LIST.items(d);
      items.forEach((e) => (byId[e.id] = e));
      build();
      load(q0);
    })
    .catch((err) => {
      console.error('tier list data failed to load:', err);
      pool.innerHTML = '<p class="gi-empty">Couldn’t load the list right now. Try again in a bit.</p>';
    });

  function build() {
    chipBox.innerHTML = LIST.chips('');
    pool.innerHTML = items
      .map(
        (e) =>
          `<button type="button" class="tl-tile r${e.r}" data-id="${e.id}" data-tags="${esc(e.tag)}" title="${esc(e.name)}" aria-label="${esc(e.name)}"><img src="${esc(e.img)}" alt="" width="128" height="128" loading="lazy" draggable="false">${
            e.badge ? `<img class="tl-badge" src="${esc(e.badge)}" alt="" draggable="false">` : ''
          }</button>`
      )
      .join('');
  }

  // ---- rows ---------------------------------------------------------------
  function addRow(name) {
    const row = document.createElement('div');
    row.className = 'tl-row';
    row.innerHTML =
      '<div class="tl-plate"><span class="tl-name" spellcheck="false" role="textbox" aria-label="Tier name"></span></div>' +
      '<div class="tl-zone"></div>' +
      '<button type="button" class="tl-del" aria-label="Remove this tier" title="Remove tier">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>';
    const n = row.querySelector('.tl-name');
    n.contentEditable = 'plaintext-only';
    if (n.contentEditable !== 'plaintext-only') n.contentEditable = 'true'; // older Firefox; paste is cleaned below
    n.textContent = name;
    board.insertBefore(row, addBtn);
    return row;
  }
  // Colours and the add/remove buttons follow the row count.
  function refresh() {
    const rs = rows();
    rs.forEach((r, i) => {
      r.style.setProperty('--tl-rgb', PAL[i]);
      sizeName(r.querySelector('.tl-name'));
    });
    addBtn.hidden = rs.length >= MAX;
    box.classList.toggle('tl-one-row', rs.length === 1);
  }
  function defaultRows() {
    rows().forEach((r) => r.remove());
    for (let i = 0; i < ROWS; i++) addRow(NAMES[i]);
  }
  addBtn.addEventListener('click', () => {
    if (rows().length >= MAX) return;
    const r = addRow(NAMES[rows().length]);
    refresh();
    save();
    r.querySelector('.tl-name').focus();
  });
  board.addEventListener('click', (e) => {
    const del = e.target.closest('.tl-del');
    if (!del || rows().length === 1) return;
    const row = del.closest('.tl-row');
    [...row.querySelector('.tl-zone').children].forEach((t) => pool.appendChild(t));
    if (picked && !box.contains(picked)) pick(null);
    row.remove();
    refresh();
    save();
  });

  // Tier names: plain text, one line of input (it wraps on the plate), NAME_MAX letters.
  const sizeName = (el) => el.classList.toggle('tl-long', el.textContent.length > 2);
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
    const n = e.target.closest('.tl-name');
    if (!n) return;
    if (n.textContent.length > NAME_MAX) {
      n.textContent = n.textContent.slice(0, NAME_MAX);
      getSelection().selectAllChildren(n);
      getSelection().collapseToEnd();
    }
    sizeName(n);
  });
  board.addEventListener('focusout', (e) => {
    const n = e.target.closest('.tl-name');
    if (!n) return;
    n.textContent = n.textContent.trim() || NAMES[rows().indexOf(n.closest('.tl-row'))];
    sizeName(n);
    save();
  });

  // ---- state <-> address --------------------------------------------------
  // q: the address's query, or an imported link's (see Import list below).
  function load(q) {
    const rs = q.getAll('r').slice(0, MAX);
    if (!rs.length) defaultRows();
    rs.forEach((v, i) => {
      const cut = v.lastIndexOf(':');
      const name = (cut < 0 ? v : v.slice(0, cut)).trim().slice(0, NAME_MAX) || NAMES[i];
      const zone = addRow(name).querySelector('.tl-zone');
      (cut < 0 ? '' : v.slice(cut + 1)).split(',').forEach((id) => {
        const t = byId[id] && pool.querySelector('[data-id="' + id + '"]');
        if (t) zone.appendChild(t);
      });
    });
    refresh();
    const f = q.get('f');
    setFilter(f && LIST.filters.includes(f) ? f : '');
  }
  function save() {
    const q = new URLSearchParams();
    if (TYPE !== 'characters') q.set('type', TYPE);
    const list = rows().map((r) => ({
      name: r.querySelector('.tl-name').textContent.trim(),
      ids: [...r.querySelector('.tl-zone').children].map((x) => x.dataset.id).join(','),
    }));
    const pristine = list.length === ROWS && list.every((r, i) => r.name === NAMES[i] && !r.ids);
    if (!pristine) list.forEach((r) => q.append('r', r.name + ':' + r.ids));
    if (filter) q.set('f', filter);
    const qs = q.toString().replace(/%2C/g, ',').replace(/%3A/g, ':'); // readable share link
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    const left = [...pool.children].filter((x) => !x.hidden && x.classList.contains('tl-tile')).length;
    $('tlLeft').textContent = left ? '(' + left + ')' : '';
  }

  function setFilter(f) {
    filter = f;
    chipBox.innerHTML = LIST.chips(f);
    box.querySelectorAll('.tl-tile').forEach((t) => (t.hidden = !!f && t.dataset.tags !== f));
    box.classList.toggle('tl-one-filter', !!f);
    if (picked && picked.hidden) pick(null);
    save();
  }
  chipBox.addEventListener('click', (e) => {
    const b = e.target.closest('.tl-chip');
    if (b) setFilter(b.dataset.filter);
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
    let before = null;
    if (x != null)
      before = [...zone.children].find((c) => {
        if (c === tile || c.hidden) return false;
        const r = c.getBoundingClientRect();
        return y < r.top || (y < r.bottom && x < r.left + r.width / 2);
      });
    zone.insertBefore(tile, before || null);
    save();
  }

  let drag = null; // {tile, ghost, x0, y0, timer, on}
  document.addEventListener('pointerdown', (e) => {
    const tile = e.target.closest('.tl-tile');
    if (!tile || e.button) return;
    drag = { tile, x0: e.clientX, y0: e.clientY, on: false, touch: e.pointerType !== 'mouse' };
    if (drag.touch) drag.timer = setTimeout(() => start(e.clientX, e.clientY), 200);
  });
  function start(x, y) {
    if (!drag) return;
    drag.on = true;
    pick(null);
    const r = drag.tile.getBoundingClientRect();
    const g = drag.tile.cloneNode(true);
    g.classList.add('tl-ghost');
    g.style.width = r.width + 'px';
    g.style.height = r.height + 'px';
    drag.dx = x - r.left;
    drag.dy = y - r.top;
    box.appendChild(g); // inside .gi so it keeps the page's tile styles
    drag.ghost = g;
    drag.tile.classList.add('is-dragging');
    move(x, y);
  }
  function move(x, y) {
    drag.ghost.style.transform = 'translate(' + (x - drag.dx) + 'px,' + (y - drag.dy) + 'px) scale(1.06)';
    box.querySelectorAll('.tl-over').forEach((z) => z.classList.remove('tl-over'));
    const z = zoneAt(x, y);
    if (z) z.classList.add('tl-over');
  }
  function zoneAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const row = el && el.closest('.tl-row');
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
    const d = drag;
    drag = null;
    if (!d.on) {
      if (!cancelled) pick(d.tile);
      return;
    }
    d.ghost.remove();
    d.tile.classList.remove('is-dragging');
    box.querySelectorAll('.tl-over').forEach((z) => z.classList.remove('tl-over'));
    const z = !cancelled && zoneAt(e.clientX, e.clientY);
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
    const row = e.target.closest('.tl-row');
    const z = row ? row.querySelector('.tl-zone') : e.target.closest('.tl-zone');
    if (z) {
      place(picked, z);
      pick(null);
    }
  });
  // Keyboard: Enter picks a piece, then 1-9 sends it to that row (top = 1), 0 back to Unranked.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return pick(null);
    if (!picked || e.target.isContentEditable || !/^[0-9]$/.test(e.key)) return;
    const zone = e.key === '0' ? pool : rows()[e.key - 1] && rows()[e.key - 1].querySelector('.tl-zone');
    if (!zone) return;
    const tile = picked;
    place(tile, zone);
    pick(null);
    tile.focus();
  });

  // ---- Import list: paste a tier list link to load it ----------------------
  // Takes the whole link or just its "r=..." part. Everything goes back to the
  // pool first, so pieces the link doesn't rank end up Unranked. A link for
  // another list (its ?type=) opens that list instead.
  const importForm = $('tlImport');
  const importBtn = $('tlImportBtn');
  let toastTimer;
  function toast(msg) {
    const t = $('tlToast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600);
  }
  function importBox(open) {
    importForm.hidden = !open;
    importBtn.setAttribute('aria-expanded', open);
    importBtn.classList.toggle('is-done', open);
    if (open) $('tlImportInput').focus();
  }
  importBtn.addEventListener('click', () => importBox(importForm.hidden));
  importForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('tlImportInput');
    const text = input.value.trim();
    let q;
    try {
      q = new URL(/^r=/.test(text) ? '?' + text : text, location.href).searchParams;
    } catch (err) {}
    if (!q || !q.getAll('r').length) return toast('That doesn’t look like a tier list link');
    const type = ['weapons', 'artifacts'].includes(q.get('type')) ? q.get('type') : 'characters';
    (ranked() ? ask('Replace your tier list?', 'The link’s list takes the place of the one on the board now.', 'Replace') : Promise.resolve(true)).then(
      (ok) => ok && (type !== TYPE ? (location.href = location.pathname + '?' + q) : importList(q, input))
    );
  });
  function importList(q, input) {
    items.forEach((it) => pool.appendChild(tileEl(it.id)));
    rows().forEach((r) => r.remove());
    pick(null);
    load(q);
    input.value = '';
    importBox(false);
    toast('Tier list loaded');
  }

  // Confirm box (.tl-dlg). Resolves true on the red key; Cancel, Escape or a backdrop click = false.
  // The keys answer directly instead of waiting for the dialog's "close" event, which arrives a
  // beat later (and not at all in headless tests).
  const dlg = $('tlConfirm');
  let answer = null;
  function finish(ok) {
    if (answer) answer(ok);
    answer = null;
    if (dlg.open) dlg.close();
  }
  $('tlConfirmOk').addEventListener('click', () => finish(true));
  $('tlConfirmNo').addEventListener('click', () => finish(false));
  dlg.addEventListener('click', (e) => e.target === dlg && finish(false));
  dlg.addEventListener('close', () => !dlg.open && finish(false));
  function ask(title, text, okLabel) {
    $('tlConfirmTitle').textContent = title;
    $('tlConfirmText').textContent = text;
    $('tlConfirmOk').textContent = okLabel;
    dlg.showModal();
    return new Promise((done) => (answer = done));
  }

  // ---- buttons ------------------------------------------------------------
  $('tlReset').addEventListener('click', async () => {
    const ok = await ask('Reset your tier list?', 'Every ' + LIST.what + ' goes back to Unranked and the tiers go back to S to ' + LAST + '. This can’t be undone.', 'Reset');
    if (!ok) return;
    items.forEach((it) => pool.appendChild(tileEl(it.id)));
    defaultRows();
    pick(null);
    refresh();
    save();
  });
  function flash(btn, text) {
    const label = btn.querySelector('span');
    const old = label.textContent;
    label.textContent = text;
    btn.classList.add('is-done');
    setTimeout(() => {
      label.textContent = old;
      btn.classList.remove('is-done');
    }, 1600);
  }
  $('tlCopy').addEventListener('click', function () {
    navigator.clipboard.writeText(location.href).then(
      () => flash(this, 'Copied'),
      () => prompt('Copy this link:', location.href)
    );
  });

  // ---- the picture: drawn on a canvas in the page's own look -------------------
  // Tiles wear the game's rarity backings (genshin.css .gi-tile). Character icons come from
  // Project Amber, which allows cross-origin use (crossOrigin below keeps the canvas exportable).
  const rgba = (rgb, a) => 'rgba(' + rgb + ',' + a + ')';
  const FACE = { 5: ['#c99648', '#8d5d2a'], 4: ['#8a6cc2', '#5b4785'], 3: ['#5a7fa8', '#3a5574'], 2: ['#5a8a6c', '#3a5c47'], 1: ['#3d3f4a', '#2a2b33'] };
  function wrap(x, text, maxW) {
    const lines = [''];
    text.split(' ').forEach((w) => {
      const l = lines[lines.length - 1];
      const next = l ? l + ' ' + w : w;
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
  $('tlPng').addEventListener('click', function () {
    const btn = this;
    const W = 1200;
    const PAD = 40;
    const LABEL = 150;
    const T = 84;
    const GAP = 8;
    const TOP = 120;
    const FOOT = 64;
    const RGAP = 10;
    const sx = PAD + LABEL + RGAP;
    const sw = W - PAD - sx;
    const per = Math.floor((sw - 16 + GAP) / (T + GAP));
    const list = rows().map((r, i) => ({
      rgb: PAL[i],
      name: r.querySelector('.tl-name').textContent.trim().toUpperCase(),
      tiles: [...r.querySelector('.tl-zone').children].filter((t) => !t.hidden).map((t) => byId[t.dataset.id]),
    }));
    const badge = (e) => (e.badge && !filter ? e.badge : '');
    const srcs = new Set();
    list.forEach((r) =>
      r.tiles.forEach((e) => {
        srcs.add(e.img);
        if (badge(e)) srcs.add(badge(e));
      })
    );
    const imgs = {};
    btn.disabled = true;
    Promise.all(
      [document.fonts.load('900 40px Cinzel'), document.fonts.load('800 14px Sora')].concat(
        [...srcs].map(
          (s) =>
            new Promise((ok) => {
              const i = new Image();
              i.crossOrigin = 'anonymous';
              i.onload = i.onerror = () => ok((imgs[s] = i));
              i.src = s;
            })
        )
      )
    ).then(() => {
      const c = document.createElement('canvas');
      const x = c.getContext('2d');
      // Name font + lines first: a long name can make its row taller than its pieces.
      list.forEach((r) => {
        r.long = r.name.length > 2;
        r.font = r.long ? '800 15px Sora' : '900 46px Cinzel';
        x.font = r.font;
        x.letterSpacing = r.long ? '1.5px' : '0px'; // measure with the spacing it's drawn with
        r.lines = r.long ? wrap(x, r.name, LABEL - 24) : [r.name];
        const tilesH = Math.max(1, Math.ceil(r.tiles.length / per)) * (T + GAP) + GAP + 8;
        r.rh = Math.max(tilesH, r.lines.length * 20 + 32);
      });
      const H = TOP + list.reduce((s, r) => s + r.rh + RGAP, 0) + FOOT;
      c.width = W;
      c.height = H;
      // The night-sky ground: near-black, the red glow from the top left.
      const bg = x.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0e0d0f');
      bg.addColorStop(1, '#09090a');
      x.fillStyle = bg;
      x.fillRect(0, 0, W, H);
      const glow = x.createRadialGradient(W * 0.12, 0, 0, W * 0.12, 0, 640);
      glow.addColorStop(0, 'rgba(163,70,75,0.16)');
      glow.addColorStop(1, 'rgba(163,70,75,0)');
      x.fillStyle = glow;
      x.fillRect(0, 0, W, H);
      x.textBaseline = 'middle';
      // Title: the section titles' Cinzel caps, "TIER LIST" in the accent red.
      x.font = '900 40px Cinzel';
      const t1 = LIST.title(filter);
      x.fillStyle = '#eceef1';
      x.fillText(t1, PAD, TOP / 2);
      x.fillStyle = '#d68a8d';
      x.fillText('TIER LIST', PAD + x.measureText(t1).width, TOP / 2);
      let y = TOP;
      list.forEach((r) => {
        // label: the row's colour glowing on a box
        const cx = PAD + LABEL / 2;
        const g = x.createRadialGradient(cx, y + r.rh * 0.3, 4, cx, y + r.rh * 0.3, LABEL * 0.8);
        g.addColorStop(0, rgba(r.rgb, 0.3));
        g.addColorStop(1, rgba(r.rgb, 0.05));
        card(x, PAD, y, LABEL, r.rh, 8, '#141518', 'rgba(255,255,255,0.06)');
        card(x, PAD, y, LABEL, r.rh, 8, g, rgba(r.rgb, 0.4));
        x.fillStyle = rgba(r.rgb, 1);
        x.textAlign = 'center';
        x.font = r.font;
        if (r.long) x.letterSpacing = '1.5px';
        r.lines.forEach((l, i) => x.fillText(l, cx, y + r.rh / 2 + (i - (r.lines.length - 1) / 2) * 20));
        x.letterSpacing = '0px';
        x.textAlign = 'left';
        // slot: the sunken well
        card(x, sx, y, sw, r.rh, 8, '#121317', '#060708');
        r.tiles.forEach((e, i) => {
          const tx = sx + 8 + (i % per) * (T + GAP);
          const ty = y + GAP + 4 + Math.floor(i / per) * (T + GAP);
          const fc = FACE[e.r] || FACE[4];
          const tg = x.createLinearGradient(tx, ty, tx + T, ty + T);
          tg.addColorStop(0, fc[0]);
          tg.addColorStop(1, fc[1]);
          card(x, tx, ty, T, T, 6, tg, '#060708');
          const im = imgs[e.img];
          if (im && im.naturalWidth) x.drawImage(im, tx + 3, ty + 3, T - 6, T - 6);
          const hb = badge(e) && imgs[badge(e)];
          if (hb && hb.naturalWidth) x.drawImage(hb, tx + T - 26, ty + T - 26, 24, 24);
        });
        y += r.rh + RGAP;
      });
      x.font = '800 14px Sora';
      x.letterSpacing = '1.5px';
      x.fillStyle = '#d68a8d';
      x.fillText('PARCHROME', PAD, H - FOOT / 2);
      const bw = x.measureText('PARCHROME  ').width;
      x.fillStyle = '#6f737b';
      x.fillText('MAKE YOURS: PARCORE.COM/GENSHIN-IMPACT/TIER-LIST', PAD + bw, H - FOOT / 2);
      const fail = () => {
        btn.disabled = false;
        toast('Couldn’t draw the picture. Try again in a bit.');
      };
      try {
        // A picture served without CORS would taint the canvas and make toBlob throw.
        c.toBlob((b) => {
          if (!b) return fail();
          btn.disabled = false;
          const a = document.createElement('a');
          a.href = URL.createObjectURL(b);
          a.download = LIST.file;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        });
      } catch (err) {
        fail();
      }
    });
  });
})();
