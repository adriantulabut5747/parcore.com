// Genshin Impact -- shared helpers (Oct 22 2026). Every /genshin-impact/ page loads this
// first, then its own script (genshin-lobby.js, genshin-banners.js...), which reads
// everything from window.GI. Styles: genshin.css. Also draws the ground's stars.
// Everything from the feed is third-party text, so it goes through esc() before it
// reaches markup.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const now = () => Date.now() / 1000;

  // Element -> wish light. Genshin's own UI colours, a touch muted for the dark ground.
  const EL = {
    Pyro: '#ef8a4c',
    Hydro: '#4cb8ef',
    Anemo: '#5fd3b4',
    Electro: '#b48ef0',
    Dendro: '#a5c83b',
    Cryo: '#98d8f0',
    Geo: '#efc35e',
  };
  const NEUTRAL = '#b9bec6'; // the weapon wish has no element: a plain light glow
  // Server clocks: daily reset is 04:00 server time.
  const SERVERS = { asia: 8, america: -5, europe: 1 };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const PRIMO = '<img src="/images/genshin/primogem.webp" alt="" width="18" height="18">';
  // Nations in release order: feed `region` name, art key (images/genshin/nation/<key>.webp),
  // archon element + ideal. Lobby Nations band + Farm cards, Characters page bands.
  const NATIONS = [
    { name: 'Mondstadt', key: 'mondstadt', el: 'anemo', ideal: 'Freedom' },
    { name: 'Liyue', key: 'liyue', el: 'geo', ideal: 'Contracts' },
    { name: 'Inazuma', key: 'inazuma', el: 'electro', ideal: 'Eternity' },
    { name: 'Sumeru', key: 'sumeru', el: 'dendro', ideal: 'Wisdom' },
    { name: 'Fontaine', key: 'fontaine', el: 'hydro', ideal: 'Justice' },
    { name: 'Natlan', key: 'natlan', el: 'pyro', ideal: 'War' },
    { name: 'Nod-Krai', key: 'nodkrai', el: '', ideal: '', icon: '/images/genshin/element/moonsign.webp' }, // Moonsign: not an element, Nod-Krai's lunar mark (wiki Icon_Moonsign)
    { name: 'Snezhnaya', key: 'snezhnaya', el: 'cryo', ideal: 'Love' },
  ];

  // ---- STARS: dots drifting up and twinkling, mostly pale grey, one in five in the accent
  // red, on a canvas filling `host` (.gi-stars, genshin.css). Was the whole page's ground; since
  // Oct 23 2026 (Adrian) the ground is still and the stars live in the Lobby's wish card.
  // Runs only while the host is on screen; one still frame under reduced motion.
  function stars(host) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    if (!ctx || !host) return;
    c.className = 'gi-stars';
    c.setAttribute('aria-hidden', 'true');
    host.prepend(c);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const TINT = ['226,228,232', '226,228,232', '226,228,232', '190,196,206', '196,108,112'];
    let w = 0;
    let h = 0;
    let list = [];
    let on = false;
    function setup() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = host.clientWidth;
      const ch = host.clientHeight;
      w = c.width = Math.floor(cw * dpr);
      h = c.height = Math.floor(ch * dpr);
      list = Array.from({ length: Math.min(70, Math.floor((cw * ch) / 9000)) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: (Math.random() * 1.2 + 0.4) * dpr,
        a: Math.random() * 0.5 + 0.15,
        tw: Math.random() * 0.016 + 0.003,
        ph: Math.random() * 6.28,
        vy: -(Math.random() * 0.22 + 0.06) * dpr,
        vx: (Math.random() - 0.5) * 0.05 * dpr,
        rgb: TINT[(Math.random() * TINT.length) | 0],
      }));
      draw(false);
    }
    function draw(move) {
      ctx.clearRect(0, 0, w, h);
      for (const s of list) {
        let a = s.a;
        if (move) {
          s.ph += s.tw;
          a *= 0.55 + 0.45 * Math.sin(s.ph);
          s.y += s.vy;
          s.x += s.vx;
          if (s.y < -6) {
            s.y = h + 6;
            s.x = Math.random() * w;
          }
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.283);
        ctx.fillStyle = `rgba(${s.rgb},${a.toFixed(3)})`;
        ctx.fill();
      }
    }
    const loop = () => {
      if (!on) return;
      draw(true);
      requestAnimationFrame(loop);
    };
    new ResizeObserver(setup).observe(host);
    if (still) return;
    new IntersectionObserver(([e]) => {
      const was = on;
      on = e.isIntersecting;
      if (on && !was) requestAnimationFrame(loop);
    }).observe(host);
  }

  // ---- server (saved per viewer; first visit guesses from the time zone) ----
  let server = 'asia';
  try {
    server = localStorage.getItem('gi-server') || '';
  } catch (e) {}
  if (!SERVERS.hasOwnProperty(server)) {
    const off = -new Date().getTimezoneOffset() / 60;
    server = off <= -3 ? 'america' : off <= 4 ? 'europe' : 'asia';
  }

  // A server tray (buttons with data-server): lights the picked one, saves a new pick
  // and calls onChange. Every tray on the page stays in step.
  const trays = [];
  function serverTray(el, onChange) {
    if (!el) return;
    trays.push(el);
    const paint = () =>
      trays.forEach((t) =>
        t.querySelectorAll('[data-server]').forEach((b) => {
          const on = b.dataset.server === server;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', on);
        }),
      );
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-server]');
      if (!b || !SERVERS.hasOwnProperty(b.dataset.server)) return;
      server = b.dataset.server;
      try {
        localStorage.setItem('gi-server', server);
      } catch (err) {}
      paint();
      if (onChange) onChange(server);
      countdowns();
    });
    paint();
  }

  // ---- time helpers ----
  function parts(sec) {
    sec = Math.max(0, Math.floor(sec));
    return { d: Math.floor(sec / 86400), h: Math.floor((sec % 86400) / 3600), m: Math.floor((sec % 3600) / 60), s: sec % 60 };
  }
  function short(sec) {
    if (sec <= 0) return 'Ended';
    const p = parts(sec);
    return p.d ? p.d + 'd ' + p.h + 'h' : p.h ? p.h + 'h ' + p.m + 'm' : p.m + 'm ' + p.s + 's';
  }
  const pad = (n) => String(n).padStart(2, '0');
  // Server-local "now" as a Date whose UTC fields read as server time.
  const serverNow = () => new Date(Date.now() + SERVERS[server] * 3600e3);
  function nextReset() {
    const t = serverNow();
    let r = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 4);
    if (r <= t.getTime()) r += 86400e3;
    return (r - SERVERS[server] * 3600e3) / 1000;
  }
  // The game day flips at 04:00, not midnight.
  const gameDay = () => new Date(serverNow().getTime() - 4 * 3600e3);
  // Wishes end at the same clock time on every server (e.g. 14:59 server time), and the
  // feed's end is the Asia server's (UTC+8). This moves it to the picked server:
  // America ends 13 h later, Europe 7 h later.
  const srvEnd = (t) => +t + (SERVERS.asia - SERVERS[server]) * 3600;
  // "Nov 3, 14:59" in server time, for a feed (Asia) end.
  function srvDate(t) {
    const d = new Date((+t + SERVERS.asia * 3600) * 1000);
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
  }

  // Countdowns: [data-end] = a fixed moment; [data-end-srv] = a wish end (feed time),
  // moved to the picked server. Both say "Ended" once past.
  function countdowns() {
    const t = now();
    document.querySelectorAll('[data-end], [data-end-srv]').forEach((el) => {
      const end = el.dataset.end != null ? +el.dataset.end : srvEnd(el.dataset.endSrv);
      const left = end - t;
      el.textContent = short(left);
      el.classList.toggle('is-ending', left > 0 && left < 86400); // not is-soon: 11layout dims [data-game-nav] .is-soon (the nav's unbuilt pages)
    });
  }

  // Shrink a one-line title until it fits its column (long names, small screens).
  // The line box keeps its full-size height, so a shrunk title never moves what's under it.
  function fit(el) {
    if (!el) return;
    el.style.fontSize = el.style.height = el.style.lineHeight = '';
    const h = el.offsetHeight;
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth + 1 && size > 22) el.style.fontSize = (size -= 2) + 'px';
    el.style.height = el.style.lineHeight = h + 'px';
  }

  const tile = (icon, rarity, name) =>
    `<span class="gi-tile r${rarity || 4}"><img src="${esc(icon)}" alt="${esc(name || '')}" title="${esc(name || '')}" loading="lazy" decoding="async"></span>`;
  const elIcon = (el) => `/images/genshin/element/${el}.webp`;

  // One redeem code row (.gi-code, genshin.css): code, rewards, Primogems, Copy + Redeem.
  // Redeem opens HoYoverse's gift page with the code filled in.
  const codeRow = (
    c,
  ) => `<div class="gi-box gi-code"><div class="gi-code-text"><p class="gi-code-name">${esc(c.code)}</p><p class="gi-code-rw">${esc((c.rewards || []).join(', '))}</p></div>
      ${c.primos ? `<span class="gi-primo">${PRIMO}${c.primos}</span>` : ''}
      <div class="gi-code-acts"><button type="button" class="gi-key" data-copy="${esc(c.code)}" aria-label="Copy ${esc(c.code)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h11v11H9zM5 15H4V4h11v1"/></svg><span>Copy</span></button>
      <a class="gi-key" href="https://genshin.hoyoverse.com/en/gift?code=${encodeURIComponent(c.code)}" target="_blank" rel="noopener" aria-label="Redeem ${esc(c.code)}">Redeem<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M10 6H4v14h14v-6"/></svg></a></div></div>`;
  // Any [data-copy] button on any Genshin page: copies, then reads "Copied" for a moment.
  document.addEventListener('click', (e) => {
    const copy = e.target.closest('[data-copy]');
    if (!copy || !navigator.clipboard) return;
    navigator.clipboard.writeText(copy.dataset.copy).then(
      () => {
        copy.classList.add('is-done');
        copy.querySelector('span').textContent = 'Copied';
        setTimeout(() => {
          copy.classList.remove('is-done');
          copy.querySelector('span').textContent = 'Copy';
        }, 1500);
      },
      () => {},
    );
  });

  // ---- PLAYER LOOKUP BOX (Lobby + /genshin-impact/player). A UID's first digit is its
  // server; 10-digit UIDs carry it in the second digit. Submit opens the player's page.
  const UID_SERVER = { 1: 'China', 2: 'China', 3: 'China', 5: 'China (B)', 6: 'America', 7: 'Europe', 8: 'Asia', 9: 'TW · HK · MO' };
  const uidServer = (v) => UID_SERVER[v.length === 10 && v[0] === '1' ? v[1] : v[0]] || '';
  // GitHub Pages has no rewrite rules or functions (same as the CoC tracker): there a
  // player is /genshin-impact/player/?uid=<UID> and the API is the Netlify site's.
  const ON_PAGES = location.hostname.endsWith('github.io');
  const playerHref = (u) => (ON_PAGES ? '/genshin-impact/player/?uid=' + u : '/genshin-impact/player/' + u);
  const API = ON_PAGES ? 'https://parchrome.netlify.app/api/genshin' : '/api/genshin';
  // go(uid) replaces opening the player's page (the Lobby's hero search shows who it is first).
  function lookup(form, go) {
    if (!form) return;
    const uid = form.querySelector('input');
    const chip = form.querySelector('.gi-uid-server');
    const st = form.parentElement.querySelector('.gi-look-status');
    const paint = () => (chip.textContent = uid.value ? uidServer(uid.value) : '');
    const hint = st.textContent;
    const say = (text, warn) => {
      st.textContent = text;
      st.classList.toggle('is-warn', warn);
    };
    // Letters are dropped as they're typed: say why, or it looks like the box is broken.
    uid.addEventListener('input', () => {
      const typed = uid.value;
      uid.value = typed.replace(/\D/g, '').slice(0, 10);
      if (/\D/.test(typed)) say('UIDs are numbers only, like 800123456. Player names can’t be searched.', true);
      else if (st.classList.contains('is-warn')) say(hint, false);
      paint();
    });
    paint();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!/^\d{9,10}$/.test(uid.value)) return say('A UID is 9 or 10 digits.', true);
      if (go) go(uid.value);
      else location.href = playerHref(uid.value);
    });
  }

  // ---- HEADER FRAME (Oct 23 2026): every page header (.gi-tb) gets the same quiet gold frame
  // (genshin.css "HEADER FRAME"): four cut corners, each with a fainter echo line (one drawing,
  // mirrored by CSS), and the star on the top edge. The edges themselves are CSS gradients.
  const TBF =
    ['tl', 'tr', 'bl', 'br']
      .map(
        (k) =>
          `<i class="gi-tbf-c gi-tbf-c--${k}"><svg viewBox="0 0 32 32"><path d="M.5 12 12 .5"/><path class="i" d="M5 24v-9.5L14.5 5H24"/></svg></i>`,
      )
      .join('') +
    '<i class="gi-tbf-star"><svg viewBox="0 0 12 12"><path d="M6 0c.6 4.2 1.8 5.4 6 6-4.2.6-5.4 1.8-6 6-.6-4.2-1.8-5.4-6-6 4.2-.6 5.4-1.8 6-6z"/></svg></i>';
  document
    .querySelectorAll('.gi-tb')
    .forEach((tb) => tb.insertAdjacentHTML('beforeend', `<span class="gi-tbf" aria-hidden="true">${TBF}</span>`));

  // Stat icons (moved here from genshin-weapons.js, Oct 23 2026; the weapons page and the wish card use them): the player page's drawn set (genshin-player.js SI), the ones a weapon can show.
  const SI = {
    atk: '<path d="M20.8 2.2l1 1-1 4.4-8.7 8.7-3.4-3.4 8.7-8.7zM7.6 13.8l3 3-1.5 1.5 1.1 1.1-1.4 1.4-1.6-1.6-2.7 2.7-1.4-1.4 2.7-2.7-1.6-1.6 1.4-1.4 1.1 1.1z"/>',
    hp: '<path d="M12 2.6c3.7 4.7 6.6 8.3 6.6 11.8a6.6 6.6 0 0 1-13.2 0c0-3.5 2.9-7.1 6.6-11.8z"/>',
    def: '<path d="M12 2.4l8 2.9v6.1c0 5-3.4 8.7-8 10.2-4.6-1.5-8-5.2-8-10.2V5.3z"/>',
    em: '<path d="M12 3.2a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6zM6.4 12.6a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6zM17.6 12.6a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6z"/>',
    cr: '<path d="M12 3.5l1.9 6.6 6.6 1.9-6.6 1.9-1.9 6.6-1.9-6.6L3.5 12l6.6-1.9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    cd: '<path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2-2.2 7.3-2.2-7.3L2.5 12l7.3-2.2z"/>',
    er: '<path d="M12 3.8a8.2 8.2 0 0 1 7.6 5.1h-2.4A6.2 6.2 0 0 0 6.9 9.6L9.2 12H3V5.8l2.3 2.3A8.2 8.2 0 0 1 12 3.8zM4.4 15.1h2.4a6.2 6.2 0 0 0 10.3.7L14.8 13.4H21v6.2l-2.3-2.3A8.2 8.2 0 0 1 4.4 15.1z"/>',
    phys: '<path d="M12 2.5l2.6 6.9 6.9 2.6-6.9 2.6-2.6 6.9-2.6-6.9L2.5 12l6.9-2.6z"/>',
  };
  const SUB_ICON = {
    ATK: 'atk',
    HP: 'hp',
    DEF: 'def',
    'Elemental Mastery': 'em',
    'CRIT Rate': 'cr',
    'CRIT DMG': 'cd',
    'Energy Recharge': 'er',
    'Physical DMG Bonus': 'phys',
  };

  // ---- GLIDE (moved here from genshin-birthdays.js, Oct 24 2026): an eased scroll to `target` instead
  // of the browser's jump, on whichever element actually scrolls (.coc-main on desktop, the page on
  // phones), clear of the fixed bars; then `.gi-arrive` on the target, so its title rises in and a red
  // line sweeps under it (genshin.css "ARRIVAL"). Reduced motion = a plain jump. A newer glide cancels
  // an older one. `done` runs when it lands.
  const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scroller = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    }
    return document.scrollingElement;
  };
  let glideId = 0;
  function glide(target, done) {
    const box = scroller(target);
    const page = box === document.scrollingElement;
    const top0 = page ? 0 : box.getBoundingClientRect().top;
    const gap = window.matchMedia('(max-width: 970px)').matches ? 64 : 84; // clear of the fixed bars
    const from = box.scrollTop;
    const to = Math.max(0, Math.min(box.scrollHeight - box.clientHeight, from + target.getBoundingClientRect().top - top0 - gap));
    const id = ++glideId;
    const arrive = () => {
      target.classList.remove('gi-arrive');
      void target.offsetWidth; // restart the animation if it's the same section again
      target.classList.add('gi-arrive');
      if (done) done();
    };
    if (still() || Math.abs(to - from) < 2) {
      box.scrollTop = to;
      return arrive();
    }
    const dur = Math.min(1100, 450 + Math.abs(to - from) * 0.25);
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // ease in-out cubic
    box.style.scrollBehavior = 'auto'; // .coc-main is smooth, which would swallow each frame's step
    const t0 = performance.now();
    const step = (now) => {
      if (id !== glideId) return; // a newer jump took over (it puts the smooth scrolling back when it lands)
      const t = Math.min(1, (now - t0) / dur);
      box.scrollTop = from + (to - from) * ease(t);
      if (t < 1) requestAnimationFrame(step);
      else {
        box.style.removeProperty('scroll-behavior');
        arrive();
      }
    };
    requestAnimationFrame(step);
  }

  // ---- JUMP NAV (Oct 24 2026, Achievements first): a .gi-tray of #section links. Clicking glides there;
  // scrolling lights the section you're in. The picked key is ONE raised pill (.gi-pill) that slides and
  // resizes from tab to tab instead of each tab lighting up on its own; during a glide it goes straight to
  // the target (the sections passed on the way don't pull it back). On phones the tray scrolls itself so
  // the picked tab stays in view. The first section's link leaves the address clean (no #hash).
  function jumpNav(nav) {
    if (!nav) return;
    const links = [...nav.querySelectorAll('a[href^="#"]')];
    const parts = links.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    const pill = document.createElement('i');
    pill.className = 'gi-pill';
    pill.setAttribute('aria-hidden', 'true');
    nav.prepend(pill);
    nav.classList.add('has-pill');
    let lock = null; // the section a glide is heading to
    function place() {
      const a = links.find((x) => x.classList.contains('active'));
      pill.classList.toggle('is-on', !!a);
      if (!a) return;
      pill.style.width = a.offsetWidth + 'px';
      pill.style.transform = `translateX(${a.offsetLeft}px)`;
      if (nav.scrollWidth > nav.clientWidth + 1)
        nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: still() ? 'auto' : 'smooth' });
    }
    function pick(id) {
      links.forEach((a) => {
        const on = a.getAttribute('href') === '#' + id;
        a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
      place();
    }
    links.forEach((a) =>
      a.addEventListener('click', (e) => {
        const target = document.getElementById(a.getAttribute('href').slice(1));
        if (!target) return;
        e.preventDefault();
        history.replaceState(null, '', location.pathname + location.search + (a === links[0] ? '' : a.getAttribute('href')));
        lock = target.id;
        pick(lock);
        glide(target, () => (lock = null));
      }),
    );
    const spy = new IntersectionObserver((es) => es.forEach((x) => x.isIntersecting && !lock && pick(x.target.id)), {
      rootMargin: '-40% 0px -55% 0px',
    });
    parts.forEach((p) => spy.observe(p));
    pick(parts.length ? parts[0].id : ''); // at the top nothing crosses the spy's band yet: start on the first section
    window.addEventListener('resize', place);
    if (document.fonts) document.fonts.ready.then(place); // tab widths change once Sora loads
    requestAnimationFrame(() => requestAnimationFrame(() => nav.classList.add('is-ready'))); // no slide-in from 0 on load
  }

  // ---- SHEET DRAG (phones; moved here from genshin-weapons.js Oct 24 2026 for Artifacts + Enemies too): drag
  // the grip (.gi-grip) or the header down to close a bottom sheet, like the More sheet; pulling the content
  // down once it's at the top drags it too (also mid-gesture: scroll up to the top and keep going). Touch
  // events for the pull, not pointer: the browser cancels pointers on a scroller. `hide` = the page's
  // animated close; the sheet's inline transform is cleared whenever its <dialog> closes.
  function sheetDrag(sheet, handles, body, hide) {
    const phone = () => matchMedia('(max-width: 970px)').matches;
    let drag = null;
    let last = null;
    const start = (y) => {
      drag = { y, dy: 0, t: performance.now() };
      sheet.classList.add('is-dragging');
    };
    const move = (y) => {
      drag.dy = Math.max(0, y - drag.y);
      sheet.style.transform = `translateY(${drag.dy}px)`;
    };
    const end = () => {
      last = null;
      if (!drag) return;
      const fast = drag.dy / (performance.now() - drag.t) > 0.6;
      sheet.classList.remove('is-dragging');
      if (drag.dy > 120 || (fast && drag.dy > 30)) hide();
      else sheet.style.transform = '';
      drag = null;
    };
    handles.forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button') || !phone()) return;
        start(e.clientY);
        el.setPointerCapture(e.pointerId);
      });
      el.addEventListener('pointermove', (e) => drag && move(e.clientY));
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    });
    body.addEventListener(
      'touchstart',
      (e) => {
        last = e.touches.length === 1 && phone() ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
      },
      { passive: true }
    );
    body.addEventListener(
      'touchmove',
      (e) => {
        if (!last) return;
        const { clientX: x, clientY: y } = e.touches[0];
        if (!drag && body.scrollTop <= 0 && y - last.y > Math.abs(x - last.x)) start(y);
        last = { x, y };
        if (!drag) return;
        if (e.cancelable) e.preventDefault();
        move(y);
      },
      { passive: false }
    );
    body.addEventListener('touchend', end);
    body.addEventListener('touchcancel', end);
    sheet.closest('dialog').addEventListener('close', () => (sheet.style.transform = ''));
  }

  window.GI = {
    sheetDrag,
    glide,
    jumpNav,
    ON_PAGES,
    API,
    playerHref,
    uidServer,
    lookup,
    stars,
    $,
    esc,
    now,
    EL,
    NEUTRAL,
    NATIONS,
    SERVERS,
    MONTHS,
    PRIMO,
    server: () => server,
    serverTray,
    parts,
    short,
    pad,
    serverNow,
    nextReset,
    gameDay,
    srvEnd,
    srvDate,
    countdowns,
    fit,
    tile,
    elIcon,
    codeRow,
    TBF,
    SI,
    SUB_ICON,
    feed: fetch('/genshin-feed.json').then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }),
  };

  // ---- HELP BUTTON "Traveler's notes" (Oct 24 2026, Adrian: CoC's "i" button, Genshin inside). The
  // button, divider, backdrop and panel shell are CoC's (coc-help.css, linked on every Genshin page; same
  // ids, never on the same page as coc-help.js). Open / close / scroll lock / "detach the panel to <body>"
  // copy coc-help.js. The Genshin look is genshin.css "HELP PANEL". Live bits (reset clock, endgame resets,
  // codes) come from the server clock and the feed; the rest is the game's fixed rules (handoff section 10).
  (function help() {
    const bar = document.querySelector('.secondary-top-bar');
    if (!bar || $('stbInfoBtn')) return;
    const N = (k) => `<img src="/images/genshin/nav/${k}.webp" alt="" width="28" height="28">`;
    const row = (icon, title, body, live) =>
      `<li class="gh-row"><span class="gh-ico" aria-hidden="true">${icon}</span><div><h4>${title}</h4><p>${body}</p>${live ? `<p class="gh-live" ${live}></p>` : ''}</div></li>`;
    const actions = document.createElement('div');
    actions.className = 'stb-mobile-actions';
    actions.innerHTML =
      '<div class="stb-help-divider" aria-hidden="true"></div><div class="stb-info-dropdown-wrap" id="stbInfoDropdownWrap">' +
      '<button type="button" class="stb-icon-btn" id="stbInfoBtn" aria-label="Traveler’s notes: what to know about Genshin Impact" aria-haspopup="dialog" aria-expanded="false" aria-controls="stbInfoDropdown">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.25" /><line x1="12" y1="11" x2="12" y2="16.5" stroke-width="2.4" /><circle cx="12" cy="7.6" r="1.3" fill="currentColor" stroke="none" /></svg></button>' +
      '<div class="stb-info-dropdown gh" id="stbInfoDropdown" role="dialog" aria-labelledby="ghTitle" aria-hidden="true">' +
      `<span class="gi-tbf" aria-hidden="true">${TBF}</span>` +
      '<div class="gh-body"><div class="gh-head"><p class="gh-kick">Genshin Impact</p><h3 class="gh-title" id="ghTitle">Traveler’s notes</h3>' +
      '<p class="gh-sub">The rules worth knowing, and the clocks that matter today.</p>' +
      '<div class="gi-tray gi-tray--sm gh-srv" role="tablist" aria-label="Server"><button type="button" class="gi-tab" data-server="asia" role="tab">Asia</button><button type="button" class="gi-tab" data-server="america" role="tab">NA</button><button type="button" class="gi-tab" data-server="europe" role="tab">EU</button></div></div>' +
      '<ul class="gh-list">' +
      row('<img src="/images/genshin/commission.svg" alt="" width="28" height="28">', 'The day starts at 04:00', 'Daily Commissions and the farming domains roll over at 04:00 <b>server time</b>, not midnight. Weekly bosses and the shop reset Monday 04:00.', 'data-gh="reset"') +
      row(N('banners'), 'Wishes and pity', '<b>160</b> Primogems a wish. A 5&#9733; is guaranteed by pull <b>90</b> on the character banner (odds climb from about 74), <b>80</b> on the weapon banner. Lose the 50/50 and your next 5&#9733; is the featured one.') +
      row(N('endgame'), 'Endgame resets', 'Spiral Abyss and Imaginarium Theater pay Primogems every period. Clear them before they reset.', 'data-gh="end"') +
      row(N('codes'), 'Redeem codes', 'You need <b>Adventure Rank 10</b>. Each code works once per account, and livestream codes expire fast.', 'data-gh="codes"') +
      row(N('timers'), 'Original Resin', 'Refills <b>1 every 8 minutes</b>, up to <b>200</b>. Spend it on domains, bosses and ley lines before it caps.') +
      '</ul><div class="gh-foot"><a class="gi-key gi-key--red" href="/genshin-impact/codes">' +
      '<img src="/images/genshin/primogem.webp" alt="" width="18" height="18"><span>Today’s codes</span></a>' +
      '<p class="gh-src">Live data from ennead.cc and Project Amber, refreshed every three hours.</p></div></div></div></div>';
    bar.appendChild(actions);

    let overlay = $('stbDdOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'stb-dd-overlay';
      overlay.id = 'stbDdOverlay';
      overlay.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlay);
    }
    const btn = $('stbInfoBtn');
    const panel = $('stbInfoDropdown');
    const wrap = $('stbInfoDropdownWrap');
    const place = () => {
      const r = wrap.getBoundingClientRect();
      panel.style.top = r.bottom + 10 + 'px';
      panel.style.right = window.innerWidth - r.right - 4 + 'px';
      panel.style.maxHeight = window.innerHeight - r.bottom - 22 + 'px';
    };
    document.body.appendChild(panel);
    window.addEventListener('resize', place);

    // Live lines. The reset follows the server tray (shared with the page's trays via serverTray).
    let feed = null;
    const live = () => {
      const t = now();
      const set = (k, html) => {
        const el = panel.querySelector(`[data-gh="${k}"]`);
        if (el) el.innerHTML = html;
      };
      set('reset', `Next reset in <b>${short(nextReset() - t)}</b>`);
      if (!feed) return;
      const ch = (feed.challenges || []).filter((c) => c.end > t);
      set('end', ch.map((c) => `${c.type === 'ActTypeTower' ? 'Abyss' : 'Theater'} in <b>${short(c.end - t)}</b>`).join(' &middot; '));
      const codes = feed.codes || [];
      const primos = codes.reduce((s, c) => s + (c.primos || 0), 0);
      set('codes', codes.length ? `<b>${codes.length}</b> live now, worth <b>${primos}</b> Primogems` : '');
    };
    window.GI.feed.then((f) => (feed = f)).catch(() => {});
    serverTray(panel.querySelector('.gh-srv'), live);

    // Scroll lock (coc-help.js stbLockScroll, shortened): desktop scrolls .coc-main, phones the page.
    let y = 0;
    const block = (e) => e.preventDefault();
    const lock = (on) => {
      const main = document.querySelector('.coc-main');
      const b = document.body.style;
      if (on) {
        y = window.pageYOffset || 0;
        const sw = window.innerWidth - document.documentElement.clientWidth;
        Object.assign(b, { position: 'fixed', top: -y + 'px', left: '0', right: '0', width: '100%', paddingRight: sw > 0 ? sw + 'px' : '' });
      } else {
        Object.assign(b, { position: '', top: '', left: '', right: '', width: '', paddingRight: '' });
        window.scrollTo(0, y);
      }
      if (main) ['wheel', 'touchmove'].forEach((ev) => main[on ? 'addEventListener' : 'removeEventListener'](ev, block, { passive: false }));
    };
    let timer = 0;
    const isOpen = () => panel.classList.contains('is-open');
    const setOpen = (on) => {
      if (on === isOpen()) return;
      if (on) place();
      panel.classList.toggle('is-open', on);
      panel.setAttribute('aria-hidden', String(!on));
      btn.setAttribute('aria-expanded', String(on));
      overlay.classList.toggle('open', on);
      lock(on);
      clearInterval(timer);
      if (on) {
        live();
        timer = setInterval(live, 1000);
      }
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(!isOpen());
    });
    document.addEventListener('click', (e) => {
      if (isOpen() && !wrap.contains(e.target) && !panel.contains(e.target)) setOpen(false);
    });
    // Wheel inside the panel scrolls it (the page under it is locked).
    panel.addEventListener('wheel', (e) => e.stopPropagation());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) {
        setOpen(false);
        btn.focus();
      }
    });
  })();
  // ---- MORE CARDS (Oct 24 2026, Adrian): every page's .gi-more = 2 random pages from the nav
  // (game-nav.json, the More sheet's list), each with its nav icon and "desc". Never this page, a
  // group page (All events / Full database / All tools) or a "soon" one. The page's own two cards
  // stay in the markup as the fallback if the list doesn't load.
  (function more() {
    const box = document.querySelector('.gi-more');
    if (!box) return;
    const path = (link) => link.replace(/\.html$/, '').replace(/\/$/, '');
    const here = path(location.pathname);
    fetch('/game-nav.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((all) => {
        const groups = all['genshin-impact'].groups;
        const hubs = groups.map((g) => path(g.link));
        const pool = groups
          .flatMap((g) => g.pages || [])
          .filter((p) => !p.soon && !hubs.includes(path(p.link)) && path(p.link) !== here && !(p.activePrefix && here.startsWith(p.activePrefix)));
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        box.innerHTML = pool
          .slice(0, 2)
          .map(
            (p) => `<a class="gi-box gi-card" href="${esc(p.link)}"><img class="gi-more-ico" src="${esc(p.icon)}" alt="" width="44" height="44" loading="lazy">
            <div><b>${esc(p.name)}</b><p>${esc(p.desc || '')}</p></div>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>`
          )
          .join('');
      })
      .catch(() => {});
  })();
})();
