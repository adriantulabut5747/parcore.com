// Genshin Impact -- shared helpers (Oct 22 2026). Every /genshin-impact/ page loads this
// first, then its own script (genshin-lobby.js, genshin-banners.js...), which reads
// everything from window.GI. Styles: genshin.css. Also draws the ground's stars.
// Everything from the feed is third-party text, so it goes through esc() before it
// reaches markup.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const now = () => Date.now() / 1000;

  // Element -> wish light. Genshin's own UI colours, a touch muted for the dark ground.
  const EL = { Pyro: '#ef8a4c', Hydro: '#4cb8ef', Anemo: '#5fd3b4', Electro: '#b48ef0', Dendro: '#a5c83b', Cryo: '#98d8f0', Geo: '#efc35e' };
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
        })
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

  const tile = (icon, rarity, name) => `<span class="gi-tile r${rarity || 4}"><img src="${esc(icon)}" alt="${esc(name || '')}" title="${esc(name || '')}" loading="lazy" decoding="async"></span>`;
  const elIcon = (el) => `/images/genshin/element/${el}.webp`;

  // One redeem code row (.gi-code, genshin.css): code, rewards, Primogems, Copy + Redeem.
  // Redeem opens HoYoverse's gift page with the code filled in.
  const codeRow = (c) => `<div class="gi-box gi-code"><div class="gi-code-text"><p class="gi-code-name">${esc(c.code)}</p><p class="gi-code-rw">${esc((c.rewards || []).join(', '))}</p></div>
      ${c.primos ? `<span class="gi-primo">${PRIMO}${c.primos}</span>` : ''}
      <div class="gi-code-acts"><button type="button" class="gi-key" data-copy="${esc(c.code)}" aria-label="Copy ${esc(c.code)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h11v11H9zM5 15H4V4h11v1"/></svg><span>Copy</span></button>
      <a class="gi-key" href="https://genshin.hoyoverse.com/en/gift?code=${encodeURIComponent(c.code)}" target="_blank" rel="noopener" aria-label="Redeem ${esc(c.code)}">Redeem<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M10 6H4v14h14v-6"/></svg></a></div></div>`;
  // Any [data-copy] button on any Genshin page: copies, then reads "Copied" for a moment.
  document.addEventListener('click', (e) => {
    const copy = e.target.closest('[data-copy]');
    if (!copy || !navigator.clipboard) return;
    navigator.clipboard.writeText(copy.dataset.copy).then(() => {
      copy.classList.add('is-done');
      copy.querySelector('span').textContent = 'Copied';
      setTimeout(() => {
        copy.classList.remove('is-done');
        copy.querySelector('span').textContent = 'Copy';
      }, 1500);
    }, () => {});
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
    ['tl', 'tr', 'bl', 'br'].map((k) => `<i class="gi-tbf-c gi-tbf-c--${k}"><svg viewBox="0 0 32 32"><path d="M.5 12 12 .5"/><path class="i" d="M5 24v-9.5L14.5 5H24"/></svg></i>`).join('') +
    '<i class="gi-tbf-star"><svg viewBox="0 0 12 12"><path d="M6 0c.6 4.2 1.8 5.4 6 6-4.2.6-5.4 1.8-6 6-.6-4.2-1.8-5.4-6-6 4.2-.6 5.4-1.8 6-6z"/></svg></i>';
  document.querySelectorAll('.gi-tb').forEach((tb) => tb.insertAdjacentHTML('beforeend', `<span class="gi-tbf" aria-hidden="true">${TBF}</span>`));

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
  const SUB_ICON = { ATK: 'atk', HP: 'hp', DEF: 'def', 'Elemental Mastery': 'em', 'CRIT Rate': 'cr', 'CRIT DMG': 'cd', 'Energy Recharge': 'er', 'Physical DMG Bonus': 'phys' };

  window.GI = {
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
})();
