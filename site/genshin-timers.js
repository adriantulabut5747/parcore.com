// Genshin Impact -- Resin & timers (/genshin-impact/timers, Oct 26 2026). Three parts:
// 1. ORIGINAL RESIN: a drawn orb that fills. You type what the game shows (and, for the exact
//    second, its "Fully replenished in" time); the page works the rest out from the clock.
// 2. TIMERS: one-tap presets (Parametric Transformer, expeditions, respawns) + the Serenitea Pot's
//    Jar of Riches. Each can go in your calendar (.ics with an alarm: works with the tab closed) or
//    ping you here (Notification API, asked on click only; only while this tab is open).
// 3. RESETS: daily / weekly / Abyss / Theater / Paimon's Bargains for the picked server (GI.serverTray).
// Everything is saved in this browser only (localStorage, always in try/catch).
// Game numbers: the Genshin Impact Wiki's Original Resin, Condensed / Fragile / Transient Resin,
// Parametric Transformer, Realm Currency, Expedition and Reset pages (checked Oct 26 2026).
// Styles: genshin-timers.css.
(function () {
  const { $, esc, SERVERS, short, pad } = window.GI;
  const TICK = 8 * 60; // seconds per Original Resin
  const CAP = 200; // regeneration stops here (refills can go past it, up to 2,000)
  const HARD = 2000;

  const read = (k, d) => {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      return v == null ? d : v;
    } catch (e) {
      return d;
    }
  };
  const write = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  };
  const now = () => Date.now() / 1000;
  const clock = (t) => {
    const d = new Date(t * 1000);
    const day = new Date().toDateString() === d.toDateString() ? 'Today' : new Date(Date.now() + 864e5).toDateString() === d.toDateString() ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    return day + ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };
  const hms = (s) => {
    s = Math.max(0, Math.ceil(s));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return (h ? h + 'h ' : '') + pad(m) + 'm ' + pad(s % 60) + 's';
  };

  // ---- 1. ORIGINAL RESIN ----
  // Saved as {r, at}: r resin at time `at`, where `at` is the moment the current 8-minute tick started.
  // Below the cap, resin(t) = r + floor((t - at) / 480), up to 200. At or over it, nothing changes.
  let rs = read('gi-resin', { r: 100, at: now() });
  const resinAt = (t) => (rs.r >= CAP ? rs.r : Math.min(CAP, rs.r + Math.floor((t - rs.at) / TICK)));
  const fullAt = () => (rs.r >= CAP ? null : rs.at + (CAP - rs.r) * TICK);
  function setResin(r, nextIn) {
    r = Math.max(0, Math.min(HARD, Math.round(r)));
    const t = now();
    // nextIn = seconds until the next point (from the game's timer); without it, assume the tick just began.
    rs = { r, at: r >= CAP ? t : t - (TICK - (nextIn == null ? TICK : Math.min(TICK, Math.max(1, nextIn)))) };
    write('gi-resin', rs);
    resin();
  }
  // Spending keeps the 8-minute phase if it was regenerating; from a full bar the timer starts now.
  function spend(n) {
    const t = now();
    const cur = resinAt(t);
    if (cur < n) return say(`Not enough resin for that (you have ${cur}).`);
    if (cur >= CAP) rs = { r: cur - n, at: t };
    else {
      const ticks = Math.floor((t - rs.at) / TICK);
      rs = { r: cur - n, at: rs.at + ticks * TICK };
    }
    write('gi-resin', rs);
    resin();
  }
  function say(msg) {
    $('rsMsg').textContent = msg;
    clearTimeout(say.t);
    say.t = setTimeout(() => ($('rsMsg').textContent = ''), 4000);
  }
  // The orb: an SVG circle whose liquid rises with the resin (CAP = full; over-cap glows).
  function resin() {
    const t = now();
    const cur = resinAt(t);
    const f = fullAt();
    const level = Math.min(1, cur / CAP);
    $('rsOrb').style.setProperty('--lv', level);
    $('rsOrb').classList.toggle('is-full', cur >= CAP);
    $('rsNow').textContent = cur;
    $('rsCap').textContent = '/' + CAP;
    if (cur >= CAP) {
      // Capped: how long ago, and what that cost (only known when it hit the cap on its own).
      const since = rs.r < CAP ? t - f : 0;
      $('rsNext').innerHTML = '<b>Full</b>';
      $('rsFull').innerHTML = since > 60 ? `Capped <b>${short(since)}</b> ago: about <b>${Math.floor(since / TICK)}</b> resin wasted` : cur > CAP ? `Over the cap: it won't regenerate until you're under ${CAP}` : 'Full: spend some so it keeps regenerating';
    } else {
      const next = TICK - ((t - rs.at) % TICK);
      $('rsNext').innerHTML = `Next in <b>${hms(next)}</b>`;
      $('rsFull').innerHTML = `Full in <b>${short(f - t)}</b> · ${clock(f)}`;
    }
    // Targets: when each amount is reached.
    $('rsTargets').innerHTML = [40, 60, 120, 160, 200]
      .map((n) => {
        const at = cur >= n ? 0 : rs.at + (n - rs.r) * TICK;
        return `<li class="${cur >= n ? 'is-there' : ''}"><b>${n}</b><span>${cur >= n ? 'Ready now' : short(at - t)}</span><small>${cur >= n ? '' : clock(at)}</small>${
          cur >= n ? '' : `<button type="button" class="rs-ics" data-ics-resin="${n}" title="Add ${n} resin to your calendar" aria-label="Add ${n} resin to your calendar"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg></button>`
        }</li>`;
      })
      .join('');
    if (document.activeElement !== $('rsIn')) $('rsIn').value = cur;
  }
  $('rsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const r = parseInt($('rsIn').value, 10);
    if (!(r >= 0)) return say('Type how much Original Resin the game shows.');
    // "Fully replenished in" as h:mm:ss, hh:mm or minutes.
    const raw = $('rsFullIn').value.trim();
    let nextIn = null;
    if (raw && r < CAP) {
      const p = raw.split(':').map(Number);
      const secs = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 3600 + p[1] * 60 : p[0] * 60;
      if (!(secs > 0)) return say('Type the full-in time like 18:40:12.');
      nextIn = secs - (CAP - r - 1) * TICK;
      if (nextIn <= 0 || nextIn > TICK + 1) return say(`That full-in time doesn't match ${r} resin. Check both numbers.`);
    }
    setResin(r, nextIn);
    $('rsFullIn').value = '';
    say(nextIn != null ? 'Saved, to the second.' : 'Saved. Add the full-in time for exact seconds.');
  });
  $('rsSpend').addEventListener('click', (e) => {
    const b = e.target.closest('[data-spend]');
    if (b) spend(+b.dataset.spend);
  });
  $('rsAdd').addEventListener('click', () => {
    const cur = resinAt(now());
    if (cur + 60 > HARD) return say(`Refills stop at ${HARD}.`);
    // A refill over the cap stops regeneration; under it, the tick keeps going.
    if (cur + 60 >= CAP) {
      rs = { r: cur + 60, at: now() };
      write('gi-resin', rs);
      resin();
    } else spend(-60);
  });

  // ---- 2. TIMERS ----
  const PRESETS = [
    { k: 'transformer', n: 'Parametric Transformer', d: 6 * 86400 + 22 * 3600, icon: 'transformer', note: 'Ready to use again' },
    { k: 'exp20', n: 'Expedition · 20 h', d: 20 * 3600, icon: 'expedition', note: 'Expedition back' },
    { k: 'exp12', n: 'Expedition · 12 h', d: 12 * 3600, icon: 'expedition', note: 'Expedition back' },
    { k: 'exp8', n: 'Expedition · 8 h', d: 8 * 3600, icon: 'expedition', note: 'Expedition back' },
    { k: 'exp4', n: 'Expedition · 4 h', d: 4 * 3600, icon: 'expedition', note: 'Expedition back' },
    { k: 'spec', n: 'Local specialties', d: 48 * 3600, icon: 'specialty', note: 'Respawned' },
    { k: 'ore', n: 'White Iron, Electro Crystal, Starsilver', d: 48 * 3600, icon: 'ore', note: 'Respawned' },
    { k: 'crystal', n: 'Crystal Chunks, Amethyst', d: 72 * 3600, icon: 'ore', note: 'Respawned' },
    { k: 'wild', n: 'Wildlife, crystalflies, common enemies', d: 12 * 3600, icon: 'wild', note: 'Respawned' },
  ];
  const presetOf = (k) => PRESETS.find((p) => p.k === k);
  let timers = read('gi-timers', []).filter((x) => x && presetOf(x.k) && x.end > 0);
  const saveTimers = () => write('gi-timers', timers);
  const ICON = {
    transformer: '<path d="M12 3l7 4v10l-7 4-7-4V7z"/><path d="M12 8v8M8 10l4 2 4-2"/>',
    expedition: '<path d="M4 20l5-14 3 7 2-4 6 11z"/>',
    specialty: '<path d="M12 21c-4-3-7-6-7-10a7 7 0 0 1 14 0c0 4-3 7-7 10z"/><circle cx="12" cy="10" r="2.5"/>',
    ore: '<path d="M6 4h8l5 6-7 10L5 10z"/><path d="M5 10h14M10 4l2 6 2-6"/>',
    wild: '<path d="M12 4l2 4 4 .5-3 3 .8 4.5L12 14l-3.8 2 .8-4.5-3-3 4-.5z"/>',
  };
  $('tmAdd').innerHTML = PRESETS.map(
    (p) => `<button type="button" class="gi-key tm-pre" data-add="${p.k}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[p.icon]}</svg><span>${esc(p.n)}</span><small>${p.d >= 86400 ? short(p.d) : p.d / 3600 + 'h'}</small></button>`
  ).join('');
  function addTimer(k, left) {
    const p = presetOf(k);
    const id = Math.random().toString(36).slice(2, 8);
    timers.unshift({ id, k, end: now() + (left || p.d), ping: false });
    saveTimers();
    paintTimers();
  }
  $('tmAdd').addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (b) addTimer(b.dataset.add);
  });
  // "Already running" for the Transformer: the game shows "Xd Yh" left.
  $('tmLeftForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = +$('tmLeftD').value || 0;
    const h = +$('tmLeftH').value || 0;
    if (!(d * 86400 + h * 3600 > 0) || d > 7) return;
    addTimer('transformer', d * 86400 + h * 3600);
    $('tmLeftD').value = $('tmLeftH').value = '';
  });
  function paintTimers() {
    const t = now();
    $('tmList').innerHTML = timers.length
      ? timers
          .map((x) => {
            const p = presetOf(x.k);
            const left = x.end - t;
            const done = left <= 0;
            const pct = Math.min(100, Math.max(0, (1 - left / p.d) * 100));
            return `<li class="gi-box tm-card${done ? ' is-done' : ''}" data-id="${x.id}">
              <span class="tm-ico" aria-hidden="true"><svg viewBox="0 0 24 24">${ICON[p.icon]}</svg></span>
              <div class="tm-main">
                <b>${esc(p.n)}</b>
                <span class="tm-left" data-left="${x.id}">${done ? esc(p.note) : short(left)}</span>
                <span class="tm-bar"><i data-bar="${x.id}" style="width:${pct}%"></i></span>
                <small>${done ? 'Since ' + clock(x.end) : clock(x.end)}</small>
              </div>
              <div class="tm-acts">
                <button type="button" class="gi-key tm-ib" data-ics="${x.id}" title="Add to calendar" aria-label="Add ${esc(p.n)} to your calendar"${done ? ' disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg></button>
                <button type="button" class="gi-key tm-ib${x.ping ? ' is-done' : ''}" data-ping="${x.id}" title="Notify me in this tab" aria-pressed="${!!x.ping}" aria-label="Notify me when ${esc(p.n)} is done"${done ? ' disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/></svg></button>
                <button type="button" class="gi-key tm-ib" data-again="${x.id}" title="Start again" aria-label="Start ${esc(p.n)} again"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8.27"/><path d="M3 3v5.27h5.27"/></svg></button>
                <button type="button" class="gi-key tm-ib" data-del="${x.id}" title="Remove" aria-label="Remove ${esc(p.n)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg></button>
              </div>
            </li>`;
          })
          .join('')
      : '<li class="tm-empty">No timers yet. Tap one above when you start it in the game.</li>';
  }
  $('tmList').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const x = timers.find((y) => y.id === (b.dataset.del || b.dataset.again || b.dataset.ics || b.dataset.ping));
    if (!x) return;
    const p = presetOf(x.k);
    if (b.dataset.del) timers = timers.filter((y) => y !== x);
    if (b.dataset.again) x.end = now() + p.d;
    if (b.dataset.ics) return ics(p.n + ' (Genshin Impact)', p.note + '.', x.end, 'genshin-' + x.k);
    if (b.dataset.ping) {
      if (!x.ping && !(await allowPings())) return;
      x.ping = !x.ping;
    }
    saveTimers();
    paintTimers();
  });

  // Notifications: permission is asked only on this click; they fire while this tab is open.
  async function allowPings() {
    if (!('Notification' in window)) {
      alert('This browser can’t show notifications. Use Add to calendar instead.');
      return false;
    }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') {
      alert('Notifications are blocked for this site. Allow them in your browser settings, or use Add to calendar.');
      return false;
    }
    return (await Notification.requestPermission()) === 'granted';
  }
  function ping(title, body) {
    try {
      new Notification(title, { body, icon: '/images/genshin/nav/timers.webp' });
    } catch (e) {}
  }

  // ---- ADD TO CALENDAR: one event at the end time with an alarm (RFC 5545, CRLF lines) ----
  function ics(title, desc, end, file) {
    const e = (s) => String(s).replace(/[\\,;]/g, (x) => '\\' + x);
    const z = (t) => new Date(t * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const body = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Parchrome//Genshin Impact timers//EN',
      'BEGIN:VEVENT',
      `UID:gi-timer-${Math.round(end)}-${file}@parchrome`,
      `DTSTAMP:${z(now())}`,
      `DTSTART:${z(end)}`,
      `DTEND:${z(end + 900)}`,
      `SUMMARY:${e(title)}`,
      `DESCRIPTION:${e(desc + ' Set on parcore.com/genshin-impact/timers')}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${e(title)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
    a.download = file + '.ics';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  $('rsTargets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ics-resin]');
    if (!b) return;
    const n = +b.dataset.icsResin;
    ics(`${n} Original Resin (Genshin Impact)`, `Your resin reaches ${n}${n >= CAP ? ': full, spend it before it caps' : ''}.`, rs.at + (n - rs.r) * TICK, 'genshin-resin-' + n);
  });

  // ---- JAR OF RICHES: realm currency (rate by Adeptal Energy, cap by Trust Rank) ----
  const RATE = [
    ['Bare-Bones', 0, 4],
    ['Humble Abode', 2000, 8],
    ['Cozy', 3000, 12],
    ['Queen-Size', 4500, 16],
    ['Elegant', 6000, 20],
    ['Exquisite', 8000, 22],
    ['Extraordinary', 10000, 24],
    ['Stately', 12000, 26],
    ['Luxury', 15000, 28],
    ['Fit for a King', 20000, 30],
  ];
  const JCAP = [300, 600, 900, 1200, 1400, 1600, 1800, 2000, 2200, 2400];
  let jar = read('gi-jar', { lv: 9, rank: 10, c: 0, at: 0 });
  $('jrLv').innerHTML = RATE.map(([n, e, r], i) => `<option value="${i}">${esc(n)} · ${e.toLocaleString('en-US')}+ energy · ${r}/h</option>`).join('');
  $('jrRank').innerHTML = JCAP.map((c, i) => `<option value="${i + 1}">Trust Rank ${i + 1} · holds ${c.toLocaleString('en-US')}</option>`).join('');
  $('jrLv').value = jar.lv;
  $('jrRank').value = jar.rank;
  const jarNow = (t) => (jar.at ? Math.min(JCAP[jar.rank - 1], jar.c + ((t - jar.at) / 3600) * RATE[jar.lv][2]) : null);
  function paintJar() {
    const t = now();
    const cap = JCAP[jar.rank - 1];
    const rate = RATE[jar.lv][2];
    $('jrRate').textContent = `${rate} an hour, holds ${cap.toLocaleString('en-US')}: empty to full in ${short((cap / rate) * 3600)}`;
    const c = jarNow(t);
    if (c == null) {
      $('jrOut').innerHTML = 'Type what the Jar holds now (or 0 right after you collect).';
      return;
    }
    const full = jar.at + ((cap - jar.c) / rate) * 3600;
    $('jrOut').innerHTML =
      c >= cap
        ? `<b>Full</b> since ${clock(full)}: collect it, it's not filling.`
        : `About <b>${Math.floor(c).toLocaleString('en-US')}</b> now · full in <b>${short(full - t)}</b> · ${clock(full)} <button type="button" class="gi-key tm-ib" id="jrIcs" title="Add to calendar" aria-label="Add the full Jar to your calendar"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg></button>`;
  }
  $('jrForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const c = Math.max(0, Math.min(JCAP[jar.rank - 1], parseInt($('jrIn').value, 10) || 0));
    jar = { ...jar, c, at: now() };
    write('gi-jar', jar);
    $('jrIn').value = '';
    paintJar();
  });
  $('jrLv').addEventListener('change', () => {
    const c = jarNow(now());
    jar = { ...jar, lv: +$('jrLv').value, ...(c != null ? { c, at: now() } : {}) };
    write('gi-jar', jar);
    paintJar();
  });
  $('jrRank').addEventListener('change', () => {
    const c = jarNow(now());
    jar = { ...jar, rank: +$('jrRank').value, ...(c != null ? { c: Math.min(c, JCAP[+$('jrRank').value - 1]), at: now() } : {}) };
    write('gi-jar', jar);
    paintJar();
  });
  $('jrOut').addEventListener('click', (e) => {
    if (!e.target.closest('#jrIcs')) return;
    const cap = JCAP[jar.rank - 1];
    ics('Jar of Riches full (Genshin Impact)', `Your realm currency reached ${cap}. Collect it from Tubby.`, jar.at + ((cap - jar.c) / RATE[jar.lv][2]) * 3600, 'genshin-jar-of-riches');
  });

  // ---- 3. RESETS (server time: 04:00 every day, Monday for weekly, the 16th / 1st for the Abyss / Theater / shop) ----
  // Next moment server-local (y, m, d, 04:00) comes round, as a real timestamp.
  function nextResets() {
    const off = SERVERS[GI.server()] * 3600;
    const s = new Date(Date.now() + off * 1000); // UTC fields = server clock
    const at = (y, m, d) => Date.UTC(y, m, d, 4) / 1000 - off;
    const t = now();
    let day = at(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
    if (day <= t) day += 86400;
    let week = at(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() + ((8 - s.getUTCDay()) % 7));
    if (week <= t) week += 7 * 86400;
    const monthly = (dom) => {
      let x = at(s.getUTCFullYear(), s.getUTCMonth(), dom);
      if (x <= t) x = at(s.getUTCFullYear(), s.getUTCMonth() + 1, dom);
      return x;
    };
    return { day, week, abyss: monthly(16), first: monthly(1) };
  }
  function paintResets() {
    const r = nextResets();
    document.querySelectorAll('[data-reset]').forEach((el) => {
      const end = r[el.dataset.reset];
      el.querySelector('.rz-left').textContent = short(end - now());
      el.querySelector('.rz-when').textContent = clock(end);
    });
  }
  GI.serverTray($('rzServer'), paintResets);

  // ---- tick ----
  function tick() {
    const t = now();
    resin();
    // Timers: update the countdowns in place; a timer that just ended redraws (and pings if asked).
    let ended = false;
    timers.forEach((x) => {
      const el = document.querySelector(`[data-left="${x.id}"]`);
      const p = presetOf(x.k);
      if (x.end - t <= 0) {
        if (el && !el.closest('.is-done')) ended = true;
        if (x.ping) {
          x.ping = false;
          saveTimers();
          ping(p.n, p.note + '.');
        }
      } else if (el) {
        el.textContent = short(x.end - t);
        document.querySelector(`[data-bar="${x.id}"]`).style.width = Math.min(100, (1 - (x.end - t) / p.d) * 100) + '%';
      }
    });
    if (ended) paintTimers();
    paintJar();
    paintResets();
  }
  paintTimers();
  tick();
  setInterval(tick, 1000);
})();
