// Genshin Impact lobby (/genshin-impact/, Oct 22 2026). Fills every section from
// /genshin-feed.json (scripts/genshin-feed.py, every 3 h). Shared helpers (time, server,
// esc, tiles, the stars): genshin-core.js, loaded first. Styles: genshin.css +
// genshin-lobby.css. Everything from the feed is third-party text, so it goes through
// esc() before it reaches markup.
(function () {
  const { $, esc, now, MONTHS, PRIMO, parts, pad, nextReset, gameDay, srvEnd, countdowns, fit, tile, elIcon, NATIONS } = window.GI;
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const FARM_DAY = { monday: 'monday', thursday: 'monday', tuesday: 'tuesday', friday: 'tuesday', wednesday: 'wednesday', saturday: 'wednesday' };

  // Countdowns once a second: the shared [data-end] ones and the daily reset (the wish
  // card ticks its own clock).
  function tick() {
    const t = now();
    countdowns();
    const left = nextReset() - t;
    const p = parts(left);
    $('giReset').textContent = pad(p.h) + ':' + pad(p.m) + ':' + pad(p.s);
  }


  // ---- CURRENT BANNERS v3: the wish card is shared with the Banners page (genshin-wish.js,
  // GI.wishCard), so it's drawn there. ----
  let wish = { tick() {} };

  // ---- hero lede (Oct 22 2026): one live sentence under the title -- who's on the
  // wishes and for how long, what the codes are worth, when the Abyss resets.
  // Days (or hours on the last day), set once per load; the line has a fixed
  // height in CSS so filling it never moves the hero.
  function lede(feed) {
    const t = now();
    const span = (sec) => {
      const d = Math.floor(sec / 86400);
      const h = Math.max(1, Math.floor(sec / 3600));
      return d >= 1 ? d + (d === 1 ? ' day' : ' days') : h + (h === 1 ? ' hour' : ' hours');
    };
    const out = [];
    const wishes = (feed.banners || []).filter((b) => srvEnd(b.end) > t);
    const fives = [].concat(...wishes.map((b) => (b.characters || []).filter((c) => c.rarity === 5)));
    const end = srvEnd(Math.min(...wishes.map((b) => b.end)));
    if (fives.length) out.push(`<b>${fives.map((c) => esc(c.name)).join(' and ')}</b>${fives.length > 1 ? "'s wishes end" : "'s wish ends"} in ${span(end - t)}.`);
    const codes = feed.codes || [];
    const sum = codes.reduce((a, c) => a + (c.primos || 0), 0);
    if (codes.length) out.push(`<b>${codes.length} code${codes.length === 1 ? '' : 's'}</b> ${codes.length === 1 ? 'is' : 'are'} live${sum ? `, worth ${sum.toLocaleString()} Primogems` : ''}.`);
    const abyss = (feed.challenges || []).find((c) => c.type === 'ActTypeTower' && c.end > t);
    if (abyss) out.push(`The Spiral Abyss resets in ${span(abyss.end - t)}.`);
    if (out.length) $('giLede').innerHTML = out.join(' ');
  }

  // ---- today panel (depends on the picked server) ----
  function today(feed) {
    const d = gameDay();
    const name = DAYS[d.getUTCDay()];
    const books = farmBooks(feed.farm, name);
    $('giFarmDay').textContent = name[0].toUpperCase() + name.slice(1) + (name === 'sunday' ? ' · every domain' : '');
    // Rarity 1 = the plain grey backing: eight purple tiles in a row shout louder than the info.
    $('giTodayBooks').innerHTML = books.map((b) => tile(b.icon, 1, b.series + ' · ' + b.city)).join('');
    farm(feed.farm, name, books);
    birthday(feed.characters || [], d);
  }

  function farmBooks(f, day) {
    if (!f) return [];
    if (day === 'sunday') return [].concat(...Object.values(f).map((x) => x.books));
    return (f[FARM_DAY[day]] || {}).books || [];
  }

  function birthday(chars, d) {
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const has = chars.filter((c) => c.birthday && c.birthday[0]);
    const todays = has.filter((c) => c.birthday[0] === m && c.birthday[1] === day);
    let html;
    if (todays.length) {
      $('giBdayLabel').textContent = 'Birthday today';
      html = todays.map((c) => tile(c.icon, c.rarity, c.name)).join('') + `<p>Happy birthday, <b>${todays.map((c) => esc(c.name)).join(' & ')}</b>!</p>`;
    } else {
      // The next birthday from today, wrapping into next year.
      const base = Date.UTC(d.getUTCFullYear(), m - 1, day);
      const until = (c) => {
        let t = Date.UTC(d.getUTCFullYear(), c.birthday[0] - 1, c.birthday[1]);
        if (t <= base) t = Date.UTC(d.getUTCFullYear() + 1, c.birthday[0] - 1, c.birthday[1]);
        return (t - base) / 86400e3;
      };
      const next = has.slice().sort((a, b) => until(a) - until(b))[0];
      if (!next) return;
      const n = until(next);
      $('giBdayLabel').textContent = 'Next birthday';
      html = tile(next.icon, next.rarity, next.name) + `<p><b>${esc(next.name)}</b><br>${MONTHS[next.birthday[0] - 1]} ${next.birthday[1]} · in ${n} day${n === 1 ? '' : 's'}</p>`;
    }
    $('giBday').innerHTML = html;
  }

  // ---- sections ----
  function events(list) {
    const t = now();
    // Stygian Onslaught is endgame: it's on the Endgame resets cards, not here.
    const live = (list || []).filter((e) => e.image && e.type !== 'ActTypeHardChallenge' && (!e.end || e.end > t)).sort((a, b) => (a.end || 9e9) - (b.end || 9e9));
    const row = $('giEvents');
    if (!live.length) {
      row.innerHTML = '<p class="gi-empty">No events are running right now.</p>';
      return;
    }
    row.innerHTML = live
      .map(
        (e) => `<article class="gi-box gi-ev">
      <div class="gi-ev-media"><img src="${esc(e.image)}" alt="" loading="lazy" decoding="async" onerror="this.closest('.gi-ev').remove()"></div>
      <div class="gi-ev-body"><h3 class="gi-ev-name">${esc(e.name)}</h3>${e.description ? `<p class="gi-ev-desc">${esc(e.description)}</p>` : ''}
      <div class="gi-ev-foot"><span class="gi-label">Ends in</span>${e.end ? `<span class="gi-ends" data-end="${+e.end}"></span>` : '<span class="gi-ends">Ongoing</span>'}</div></div></article>`
      )
      .join('');
  }

  function endgame(ch, evs) {
    const t = now();
    const stygian = (evs || []).find((e) => e.type === 'ActTypeHardChallenge' && (!e.end || e.end > t));
    const rows = (ch || []).filter((c) => c.end > t).concat(stygian ? [stygian] : []);
    const list = $('giEnd');
    if (!rows.length) {
      list.innerHTML = '<p class="gi-empty">No endgame data right now.</p>';
      return;
    }
    const day = (s) => {
      const d = new Date(s * 1000);
      return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
    };
    list.innerHTML = rows
      .map(
        (c) => `<div class="gi-eg-row"><div class="gi-eg-name"><h3>${esc(c.name)}</h3>${c.start ? `<span class="gi-label">${day(c.start)} – ${day(c.end)}</span>` : ''}</div>
      <div class="gi-eg-stat"><span class="gi-label">Resets in</span>${c.end ? `<span class="gi-today-v" data-end="${+c.end}"></span>` : '<span class="gi-today-v">Ongoing</span>'}</div>
      ${c.primos ? `<div class="gi-eg-stat"><span class="gi-label">Reward</span><span class="gi-primo">${PRIMO}${c.primos.toLocaleString()}</span></div>` : ''}</div>`
      )
      .join('');
  }

  // The Lobby shows every code with Primogems (Adrian, Oct 23 2026; the first 3 if none have
  // any); the rest, the expired ones and How to redeem live on /genshin-impact/codes.
  function codes(list) {
    const box = $('giCodes');
    if (!list || !list.length) {
      box.innerHTML = '<p class="gi-empty">No active codes right now.</p>';
      return;
    }
    const primo = list.filter((c) => c.primos);
    const sum = primo.reduce((a, c) => a + c.primos, 0);
    if (primo.length) $('giCodesSub').textContent = `${primo.length} codes worth ${sum.toLocaleString()} Primogems.`;
    $('giCodesAll').firstChild.textContent = `All ${list.length} codes`;
    box.innerHTML = (primo.length ? primo : list.slice(0, 3)).map(GI.codeRow).join('');
  }

  function farm(f, day, books) {
    const box = $('giFarm');
    if (!books.length) {
      box.innerHTML = '<p class="gi-empty">No farm schedule right now.</p>';
      return;
    }
    const nice = day[0].toUpperCase() + day.slice(1);
    const sunday = day === 'sunday';
    $('giFarmSub').textContent = sunday
      ? 'Sunday: every Domain is open, so every book and weapon material, by nation.'
      : `${nice}'s talent books and weapon materials by nation, back again in three days.`;
    const weps = sunday ? [].concat(...Object.values(f).map((x) => x.weapons)) : (f[FARM_DAY[day]] || {}).weapons || [];
    // One card per nation, in NATIONS order; the art is that nation's namecard.
    // Sunday has three books per nation, so it lists them without the faces.
    const MAX = 10;
    const item = (icon, label, name, sub) =>
      `<div class="gi-fc-item">${tile(icon, 4, name)}<div><span class="gi-label">${label}</span><b>${esc(name)}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
    box.innerHTML = NATIONS.map((n) => {
      const bk = books.filter((b) => b.city === n.name);
      const wp = weps.filter((w) => w.city === n.name);
      if (!bk.length && !wp.length) return '';
      const bookHtml = bk
        .map((b) => {
          const users = b.users || [];
          const faces = sunday
            ? ''
            : `<div class="gi-fc-users">${users.slice(0, MAX).map((u) => tile(u.icon, u.rarity, u.name)).join('')}${users.length > MAX ? `<span class="gi-book-more">+${users.length - MAX}</span>` : ''}</div>`;
          return item(b.icon, 'Talent book', b.series, `${users.length} character${users.length === 1 ? '' : 's'}`) + faces;
        })
        .join('');
      return `<article class="gi-box gi-grp gi-fc"><div class="gi-grp-art" style="background-image:url('/images/genshin/nation/${n.key}.webp')"><h3>${esc(n.name)}</h3></div>
      <div class="gi-fc-body">${bookHtml}<div class="gi-fc-weps">${wp.map((w) => item(w.icon, 'Weapon material', w.name)).join('')}</div></div></article>`;
    }).join('');
  }

  // ---- interactions ----
  document.addEventListener('click', (e) => {
    const arrow = e.target.closest('.gi-arrow');
    if (arrow) {
      const row = $(arrow.dataset.row);
      const card = row && row.firstElementChild;
      if (card) row.scrollBy({ left: +arrow.dataset.dir * (card.offsetWidth + 16), behavior: 'smooth' });
    }
  });
  function syncArrows() {
    document.querySelectorAll('.gi-arrow').forEach((a) => {
      const row = $(a.dataset.row);
      const max = row.scrollWidth - row.clientWidth;
      a.disabled = +a.dataset.dir < 0 ? row.scrollLeft < 4 : row.scrollLeft > max - 4;
    });
  }
  document.querySelectorAll('.gi-row').forEach((r) => r.addEventListener('scroll', syncArrows, { passive: true }));

  // ---- PLAYER SEARCH (hero, Oct 23 2026): Search asks /api/genshin who the UID is and shows
  // them as a card; the card opens their page. This is the landing page, so nothing (not even
  // the 66 KB id map) is fetched before the first Search. It's the same request the player page
  // makes, so opening the card is a browser-cache hit (the API sends max-age=60).
  const UI = 'https://enka.network/ui/';
  const LOOK_ERR = {
    notFound: 'No player has this UID. Check the number and try again.',
    maintenance: 'Genshin is under maintenance. Try again once it’s over.',
    busy: 'Too many lookups right now. Try again in a minute.',
    enka5xx: 'Enka.Network isn’t answering. Try again in a few minutes.',
  };
  const hit = $('giHit');
  let enkaMap = null;
  let asked = '';
  const closeHit = () => {
    asked = '';
    hit.hidden = true;
  };
  // Newer profiles send a picture id, older ones a character (+ costume): genshin-player.js pfp().
  function pfp(map, pp) {
    if (!pp) return '';
    if (pp.id && map.pf[pp.id]) return UI + map.pf[pp.id] + '.png';
    const c = map.c[pp.avatarId];
    return map.cos[pp.costumeId] ? UI + 'UI_AvatarIcon_' + map.cos[pp.costumeId] + '.png' : c && c.i ? UI + 'UI_AvatarIcon_' + c.i + '.png' : '';
  }
  function findPlayer(uid) {
    if (uid === asked) return;
    asked = uid;
    hit.hidden = false;
    hit.innerHTML = `<p class="gi-hit-msg">Looking up UID ${uid}&hellip;</p>`;
    enkaMap = enkaMap || fetch('/genshin-enka-map.json').then((r) => (r.ok ? r.json() : Promise.reject('unreachable')));
    const player = fetch(GI.API + '?uid=' + uid).then(async (r) => {
      const d = await r.json().catch(() => ({ error: r.ok ? 'enka5xx' : 'unreachable' }));
      if (!r.ok || d.error) throw d.error || 'unreachable';
      return d;
    });
    Promise.all([player, enkaMap])
      .then(([d, map]) => {
        if (uid !== asked) return;
        const p = d.playerInfo || {};
        const pic = pfp(map, p.profilePicture);
        const facts = [p.level != null && 'AR ' + p.level, p.worldLevel != null && 'WL ' + p.worldLevel, 'UID ' + uid, GI.uidServer(uid)].filter(Boolean).map(esc).join(' &middot; ');
        hit.innerHTML = `<a class="gi-hit-card" href="${GI.playerHref(uid)}"><span class="gi-tile r5">${pic ? `<img src="${esc(pic)}" alt="" decoding="async">` : '<i class="gi-hit-q">?</i>'}</span>
          <span class="gi-hit-who"><b>${esc(p.nickname || 'Traveler')}</b><small>${facts}</small>${p.signature ? `<small class="gi-hit-sig">${esc(p.signature)}</small>` : ''}</span>
          <span class="gi-hit-go">View profile<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></a>`;
      })
      .catch((e) => {
        if (e === 'unreachable') enkaMap = null; // let the next Search try the map again
        if (uid !== asked) return;
        hit.innerHTML = `<p class="gi-hit-msg is-warn">${esc(LOOK_ERR[e] || 'Couldn’t reach the lookup. Check your connection and try again.')}</p>`;
        asked = ''; // Search again retries
      });
  }
  GI.lookup($('giLook'), findPlayer);
  $('giUid').addEventListener('input', closeHit);
  $('giFind').addEventListener('keydown', (e) => e.key === 'Escape' && closeHit());
  document.addEventListener('click', (e) => !hit.hidden && !e.target.closest('#giFind') && closeHit());


  // ---- NATIONS ---- (the list itself: GI.NATIONS in genshin-core.js, shared with the Characters page)
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  function nations(chars) {
    const tabs = $('giNatTabs');
    tabs.innerHTML = NATIONS.map((n, i) => `<button type="button" class="gi-tab" role="tab" data-i="${i}">${n.el || n.icon ? `<img src="${n.icon || elIcon(n.el)}" alt="">` : ''}${esc(n.name)}</button>`).join('');
    const pick = (i) => {
      const n = NATIONS[i];
      tabs.querySelectorAll('.gi-tab').forEach((t) => {
        const on = +t.dataset.i === i;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on);
      });
      $('giNatBg').style.setProperty('--nat-img', `url('/images/genshin/nation/${n.key}.webp')`);
      $('giNatName').textContent = n.name;
      $('giNatIdeal').innerHTML = n.el
        ? `<span><img src="${elIcon(n.el)}" alt="">Home of the <b>${cap(n.el)} Archon</b></span><span>Ideal: <b>${n.ideal}</b></span>`
        : `<span>${n.icon ? `<img src="${n.icon}" alt="">` : ''}An autonomous region of Snezhnaya</span>`;
      const list = chars.filter((c) => c.region === n.name).sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
      $('giNatCount').textContent = list.length;
      $('giNatAll').href = '/genshin-impact/characters?nation=' + n.key;
      fit($('giNatName'));
      $('giNatChars').innerHTML = list.map((c) => `<figure>${tile(c.icon, c.rarity, c.name)}<figcaption>${esc(c.name)}</figcaption></figure>`).join('');
    };
    tabs.addEventListener('click', (e) => {
      const t = e.target.closest('.gi-tab');
      if (t) pick(+t.dataset.i);
    });
    // Fixed height (Adrian: the band grew and shrank between tabs): render every
    // nation once, keep the tallest as the body's min-height, then show the picked
    // one. Tiles have a fixed aspect ratio, so this is right before images load.
    // Re-measured on resize, where the column count changes.
    const body = document.querySelector('.gi-nat-body');
    let cur = 0;
    const size = () => {
      body.style.minHeight = '';
      let h = 0;
      NATIONS.forEach((_, i) => {
        pick(i);
        h = Math.max(h, body.offsetHeight);
      });
      pick(cur);
      body.style.minHeight = h + 'px';
    };
    tabs.addEventListener('click', (e) => {
      const t = e.target.closest('.gi-tab');
      if (t) cur = +t.dataset.i;
    });
    let rt = 0;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(size, 150);
    });
    size();
    if (document.fonts) document.fonts.ready.then(size); // Cinzel changes the name's height
  }

  // ---- REACTIONS: the wheel moved to genshin-reactions.js (Oct 26 2026), shared with the Reactions chart. ----

  // ---- PITY: chance of a 5-star on pull n since the last one (community model) ----
  const P5 = (n) => (n >= 90 ? 1 : n <= 73 ? 0.006 : Math.min(1, 0.006 + 0.06 * (n - 73)));
  function pity() {
    const svg = $('giPitySvg');
    const input = $('giPityIn');
    let lost = false;
    const X0 = 28;
    const W = 600 / 90;
    const H = 250;
    const BASE = 286;
    const x = (n) => X0 + (n - 1) * W;
    let bars = '';
    for (let n = 1; n <= 90; n++) bars += `<rect class="pb" data-n="${n}" x="${x(n) + 0.8}" width="${W - 1.6}" y="${BASE - Math.max(3, P5(n) * H)}" height="${Math.max(3, P5(n) * H)}" rx="1"/>`;
    svg.innerHTML =
      `<rect class="pz" x="${x(74)}" y="16" width="${x(91) - x(74)}" height="${BASE - 16}"/>` +
      `<line class="pl" x1="${x(74)}" x2="${x(74)}" y1="10" y2="${BASE}"/><text class="is-red" x="${x(74) + 6}" y="26">Soft pity 74</text>` +
      `<text x="${x(91) - 4}" y="12" text-anchor="end">90 · sure 5&#9733;</text>` +
      bars +
      `<text x="${X0}" y="${BASE + 20}">Pull 1</text><text x="${x(45)}" y="${BASE + 20}">45</text><text x="${x(91)}" y="${BASE + 20}" text-anchor="end">90</text>` +
      `<text x="${X0}" y="26">Chance per pull</text>`;
    const rects = [...svg.querySelectorAll('.pb')];
    const pct = (p) => (p >= 0.995 ? '100%' : p < 0.1 ? (p * 100).toFixed(1) + '%' : Math.round(p * 100) + '%');
    function update() {
      const c = +input.value;
      input.style.setProperty('--p', (c / 89) * 100 + '%');
      $('giPityOut').textContent = c;
      rects.forEach((r) => {
        const n = +r.dataset.n;
        r.setAttribute('class', 'pb' + (n <= c ? ' is-spent' : n === c + 1 ? ' is-next' : n >= 74 ? ' is-soft' : ''));
      });
      let miss = 1;
      for (let i = 1; i <= 10; i++) miss *= 1 - P5(c + i);
      $('psNext').textContent = pct(P5(c + 1));
      $('ps10').textContent = pct(1 - miss);
      $('psHard').textContent = 90 - c;
      $('psHardP').innerHTML = `pulls to the sure 5&#9733;<span class="gi-primo"><img src="/images/genshin/primogem.webp" alt="">${((90 - c) * 160).toLocaleString()} Primogems</span>`;
      $('psFeat').textContent = lost ? '100%' : '50/50';
      $('psFeatS').innerHTML = lost ? 'it&#39;s the featured 5&#9733; (guaranteed)' : 'that it&#39;s the featured 5&#9733;';
    }
    input.addEventListener('input', update);
    $('giPityG').addEventListener('click', (e) => {
      const t = e.target.closest('.gi-tab');
      if (!t) return;
      lost = t.dataset.g === '1';
      $('giPityG').querySelectorAll('.gi-tab').forEach((b) => {
        b.classList.toggle('active', b === t);
        b.setAttribute('aria-selected', b === t);
      });
      update();
    });
    update();
  }
  pity();

  // ---- go ----
  GI.feed
    .then((feed) => {
      wish = GI.wishCard(feed.banners || []);
      lede(feed);
      const v = (feed.banners || []).find((b) => b.version);
      if (v) $('giVer').textContent = v.version;
      today(feed);
      events(feed.events);
      endgame(feed.challenges, feed.events);
      codes(feed.codes);
      nations(feed.characters || []);
      GI.serverTray($('giServer'), () => {
        today(feed);
        lede(feed);
        tick();
        wish.tick();
      });
      tick();
      syncArrows();
      setInterval(tick, 1000);
    })
    .catch((err) => {
      console.error('genshin-feed.json failed to load:', err);
      $('giMeta').textContent = "Couldn't load the live data right now. Try again in a bit.";
      ['giEvents', 'giEnd', 'giCodes', 'giFarm'].forEach((id) => ($(id).innerHTML = "<p class=\"gi-empty\">Couldn't load this right now.</p>"));
    });
})();
