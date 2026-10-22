// Genshin Impact lobby (/genshin-impact/, Oct 22 2026). Fills every section from
// /genshin-feed.json (scripts/genshin-feed.py, every 3 h). Shared helpers (time, server,
// esc, tiles, the stars): genshin-core.js, loaded first. Styles: genshin.css +
// genshin-lobby.css. Everything from the feed is third-party text, so it goes through
// esc() before it reaches markup.
(function () {
  const { $, esc, now, EL, NEUTRAL, MONTHS, PRIMO, parts, pad, nextReset, gameDay, srvEnd, countdowns, fit, tile, elIcon } = window.GI;
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const FARM_DAY = { monday: 'monday', thursday: 'monday', tuesday: 'tuesday', friday: 'tuesday', wednesday: 'wednesday', saturday: 'wednesday' };

  // Countdowns once a second: the shared [data-end] ones, the wish clock (its end moved
  // to the picked server) and the daily reset.
  function tick() {
    const t = now();
    countdowns();
    const clock = $('giClock');
    if (clock && clock.dataset.srv) {
      const p = parts(srvEnd(clock.dataset.srv) - t);
      clock.querySelectorAll('[data-u]').forEach((b) => (b.textContent = pad(p[b.dataset.u])));
    }
    const left = nextReset() - t;
    const p = parts(left);
    $('giReset').textContent = pad(p.h) + ':' + pad(p.m) + ':' + pad(p.s);
  }
  window.addEventListener('resize', () => fit($('giName')));


  // ---- hero ----
  function hero(banners) {
    const views = banners.filter((b) => (b.characters && b.characters.length) || (b.weapons && b.weapons.length));
    if (!views.length) {
      $('giMeta').textContent = 'No wish is running right now.';
      return;
    }
    const sw = $('giSwitch');
    sw.innerHTML = views
      .map((b, i) => {
        const five = (b.characters || []).find((c) => c.rarity === 5);
        const label = five ? five.name : 'Weapons';
        const pic = five ? five.icon : (b.weapons[0] || {}).icon;
        return `<button type="button" class="gi-ws" role="tab" data-i="${i}" aria-label="${esc(label)}"><span class="gi-ws-pic">${pic ? `<img src="${esc(pic)}" alt="">` : ''}</span><span class="gi-ws-name">${esc(label)}</span></button>`;
      })
      .join('');
    sw.hidden = views.length < 2;
    sw.addEventListener('click', (e) => {
      const b = e.target.closest('.gi-ws');
      if (b) show(views, +b.dataset.i);
    });
    show(views, 0);
  }

  function show(views, i) {
    const b = views[i];
    const five = (b.characters || []).find((c) => c.rarity === 5);
    const sec = $('giWish');
    let art = $('giArt');
    if (!art) {
      art = document.createElement('img');
      art.className = 'gi-wish-img';
      art.id = 'giArt';
      art.alt = '';
      art.decoding = 'async';
      art.hidden = true;
      $('giWeps').before(art);
    }
    const weps = $('giWeps');
    $('giSwitch').querySelectorAll('.gi-ws').forEach((t) => {
      const on = +t.dataset.i === i;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on);
    });
    sec.style.setProperty('--gi-el', five ? EL[five.element] || NEUTRAL : NEUTRAL);
    $('giEyebrow').textContent = b.name + (b.version ? ' · v' + b.version : '');
    let four;
    if (five) {
      $('giName').textContent = five.name;
      $('giTitle').textContent = five.title || '';
      $('giMeta').innerHTML = [`<span class="gi-el">${EL[five.element] ? `<img src="/images/genshin/element/${five.element.toLowerCase()}.webp" alt="">` : ''}${esc(five.element)}</span>`, esc(five.weapon), esc(five.affiliation)].filter(Boolean).join('<span aria-hidden="true">·</span>');
      weps.hidden = true;
      if (five.splash && art.getAttribute('src') !== five.splash) {
        if (art.getAttribute('src')) art.classList.add('is-out'); // fade only when swapping wishes
        art.onload = () => art.classList.remove('is-out');
        art.src = five.splash;
        art.hidden = false;
      }
      four = b.characters.filter((c) => c.rarity === 4);
      $('giFourLabel').innerHTML = 'Featured 4&#9733;';
      $('giFourRow').innerHTML = four.map((c) => `<figure>${tile(c.icon, 4, c.name)}<figcaption>${esc(c.name)}${c.element ? `<small>${esc(c.element)}</small>` : ''}</figcaption></figure>`).join('');
    } else {
      // Same lines and heights as a character wish, so switching never moves the hero:
      // one-line title (the weapon wish's in-game name), one meta line, one row of tiles.
      const top = b.weapons.filter((w) => w.rarity === 5);
      $('giName').textContent = 'Epitome Invocation';
      $('giTitle').textContent = 'Weapon Event Wish';
      $('giMeta').innerHTML = top.map((w) => `<b>${esc(w.name)}</b>`).join('<span aria-hidden="true">·</span>');
      art.hidden = true;
      art.removeAttribute('src');
      weps.innerHTML = top.map((w) => `<img src="${esc(w.icon)}" alt="">`).join('');
      weps.hidden = false;
      four = b.weapons.filter((w) => w.rarity === 4);
      $('giFourLabel').innerHTML = 'Featured 4&#9733; weapons';
      $('giFourRow').innerHTML = four.map((w) => `<figure>${tile(w.icon, w.rarity, w.name)}</figure>`).join('');
    }
    $('giFour').hidden = !four.length;
    fit($('giName'));
    const clock = $('giClock');
    clock.dataset.srv = b.end;
    clock.hidden = false;
    tick();
  }

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

  // In-game shots from the Genshin wiki (Oct 22 2026), cropped to the card's shape:
  // the Spiral Abyss portal, the Imaginarium Theater's room (images/genshin/endgame/).
  const ENDGAME_ART = { ActTypeTower: '/images/genshin/endgame/abyss.webp', ActTypeRoleCombat: '/images/genshin/endgame/theater.webp' };
  function endgame(ch, evs) {
    const t = now();
    const list = (ch || []).filter((c) => c.end > t);
    const stygian = (evs || []).find((e) => e.type === 'ActTypeHardChallenge' && (!e.end || e.end > t));
    const cards = list.map((c) => ({ name: c.name, end: c.end, start: c.start, primos: c.primos, media: ENDGAME_ART[c.type] ? `<img src="${ENDGAME_ART[c.type]}" alt="" loading="lazy">` : '', photo: !!ENDGAME_ART[c.type] }));
    if (stygian) cards.push({ name: stygian.name, end: stygian.end, start: stygian.start, primos: 0, media: stygian.image ? `<img src="${esc(stygian.image)}" alt="">` : '', photo: !!stygian.image });
    if (!cards.length) {
      $('giEnd').innerHTML = '<p class="gi-empty">No endgame data right now.</p>';
      return;
    }
    const day = (s) => {
      const d = new Date(s * 1000);
      return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
    };
    $('giEnd').innerHTML = cards
      .map(
        (c) => `<article class="gi-box gi-end"><div class="gi-end-media${c.photo ? ' has-photo' : ''}">${c.media}</div>
      <div class="gi-end-body"><h3 class="gi-end-name">${esc(c.name)}</h3>${c.start ? `<span class="gi-label">${day(c.start)} – ${day(c.end)}</span>` : ''}
      <div class="gi-end-stats"><div><span class="gi-label">Resets in</span><span class="gi-today-v" data-end="${+c.end}"></span></div>
      ${c.primos ? `<div><span class="gi-label">Reward</span><span class="gi-primo">${PRIMO}${c.primos.toLocaleString()}</span></div>` : ''}</div></div></article>`
      )
      .join('');
  }

  function codes(list) {
    const box = $('giCodes');
    if (!list || !list.length) {
      box.innerHTML = '<p class="gi-empty">No active codes right now.</p>';
      return;
    }
    const sum = list.reduce((a, c) => a + (c.primos || 0), 0);
    $('giCodesSub').textContent = `${list.length} active codes worth ${sum.toLocaleString()} Primogems. Redeem opens the official gift page with the code filled in.`;
    box.innerHTML = list
      .map(
        (c) => `<div class="gi-box gi-code"><div class="gi-code-text"><p class="gi-code-name">${esc(c.code)}</p><p class="gi-code-rw">${esc((c.rewards || []).join(', '))}</p></div>
      ${c.primos ? `<span class="gi-primo">${PRIMO}${c.primos}</span>` : ''}
      <div class="gi-code-acts"><button type="button" class="gi-key" data-copy="${esc(c.code)}" aria-label="Copy ${esc(c.code)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h11v11H9zM5 15H4V4h11v1"/></svg><span>Copy</span></button>
      <a class="gi-key" href="https://genshin.hoyoverse.com/en/gift?code=${encodeURIComponent(c.code)}" target="_blank" rel="noopener" aria-label="Redeem ${esc(c.code)}">Redeem<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M10 6H4v14h14v-6"/></svg></a></div></div>`
      )
      .join('');
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
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      const done = () => {
        copy.classList.add('is-done');
        copy.querySelector('span').textContent = 'Copied';
        setTimeout(() => {
          copy.classList.remove('is-done');
          copy.querySelector('span').textContent = 'Copy';
        }, 1500);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(copy.dataset.copy).then(done, () => {});
    }
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

  // Player lookup (front end only). The UID's first digit is its server; 10-digit
  // UIDs carry it in the second digit.
  const UID_SERVER = { 1: 'China', 2: 'China', 3: 'China', 5: 'China (B)', 6: 'America', 7: 'Europe', 8: 'Asia', 9: 'TW · HK · MO' };
  const uid = $('giUid');
  const uidServer = () => {
    const v = uid.value;
    return UID_SERVER[v.length === 10 && v[0] === '1' ? v[1] : v[0]] || '';
  };
  uid.addEventListener('input', () => {
    uid.value = uid.value.replace(/\D/g, '').slice(0, 10);
    $('giUidServer').textContent = uid.value ? uidServer() : '';
  });
  $('giLook').addEventListener('submit', (e) => {
    e.preventDefault();
    const st = $('giLookStatus');
    if (!/^\d{9,10}$/.test(uid.value)) {
      st.textContent = 'A UID is 9 or 10 digits.';
      st.classList.add('is-warn');
      return;
    }
    st.classList.remove('is-warn');
    st.textContent = `Player lookup is almost ready. Soon this shows ${uidServer() || 'that'} player ${uid.value}'s showcase right here.`;
  });

  // ---- HOW TO REDEEM: the cursor walks the drawn Paimon Menu ----
  // Reward icons the mail shows, by item name (yatta item ids).
  const ITEM = { Primogem: '/images/genshin/primogem.webp', Mora: 202, "Hero's Wit": 104003, "Adventurer's Experience": 104002, 'Mystic Enhancement Ore': 104013, 'Fine Enhancement Ore': 104012 };
  function redeemDemo(code) {
    const stage = $('grStage');
    if (!stage) return;
    const cur = $('grCursor');
    const ring = $('grRing');
    const steps = [...document.querySelectorAll('#grSteps .gr-step')];
    const text = (code && code.code) || 'GENSHINGIFT';
    $('grGifts').innerHTML = ((code && code.rewards) || ['Primogem ×50'])
      .map((r) => {
        const m = r.match(/^(.*?)\s*[×x]\s*([\d,]+)$/);
        if (!m || !ITEM[m[1]]) return '';
        const src = typeof ITEM[m[1]] === 'string' ? ITEM[m[1]] : ASSET_ITEM(ITEM[m[1]]);
        return `<span class="gr-gift"><img src="${esc(src)}" alt=""><b>${esc(m[2])}</b></span>`;
      })
      .join('');
    $('grCap').textContent = 'Drawn for this guide, not a screenshot. Typing: ' + text + ', one of the live codes above.';
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timers = [];
    let step = 0;
    let visible = false;
    const later = (ms, fn) => timers.push(setTimeout(fn, ms));
    const stop = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };
    const move = (el) => {
      const s = stage.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const x = r.left - s.left + r.width / 2;
      const y = r.top - s.top + r.height / 2;
      cur.style.transform = `translate(${x}px, ${y}px)`;
      ring.style.left = x + 'px';
      ring.style.top = y + 'px';
    };
    const click = () => {
      ring.classList.remove('is-on');
      void ring.offsetWidth;
      ring.classList.add('is-on');
    };
    const SCENES = ['menu', 'set', 'dlg', 'mail'];
    function play(i, auto) {
      stop();
      step = i;
      steps.forEach((li, n) => {
        li.classList.toggle('is-on', n === i);
        li.querySelector('button').setAttribute('aria-current', n === i ? 'step' : 'false');
      });
      stage.dataset.scene = SCENES[i];
      const typed = $('grTyped');
      typed.textContent = i === 2 && !reduce ? '' : i >= 2 ? text : '';
      if (reduce) return;
      if (i === 0) {
        later(300, () => move($('grGear')));
        later(1200, click);
      } else if (i === 1) {
        later(300, () => move($('grAccount')));
        later(1100, click);
        later(1500, () => move($('grRedeemNow')));
        later(2300, click);
      } else if (i === 2) {
        [...text].forEach((ch, n) => later(400 + n * 90, () => (typed.textContent += ch)));
        const done = 400 + text.length * 90;
        later(done + 200, () => move($('grExchange')));
        later(done + 1000, click);
      } else {
        later(400, () => move($('grClaim')));
        later(1200, click);
      }
      if (auto) later(i === 2 ? 600 + text.length * 90 + 2200 : 3400, () => visible && play((i + 1) % 4, true));
    }
    steps.forEach((li, n) => li.querySelector('button').addEventListener('click', () => play(n, true)));
    // Only animate while it's on screen.
    new IntersectionObserver((es) => {
      visible = es[0].isIntersecting;
      if (visible) play(step, true);
      else stop();
    }, { threshold: 0.35 }).observe(stage);
    play(0, false);
  }
  const ASSET_ITEM = (id) => 'https://gi.yatta.moe/assets/UI/UI_ItemIcon_' + id + '.png';

  // ---- NATIONS ----
  const NATIONS = [
    { name: 'Mondstadt', key: 'mondstadt', el: 'anemo', ideal: 'Freedom' },
    { name: 'Liyue', key: 'liyue', el: 'geo', ideal: 'Contracts' },
    { name: 'Inazuma', key: 'inazuma', el: 'electro', ideal: 'Eternity' },
    { name: 'Sumeru', key: 'sumeru', el: 'dendro', ideal: 'Wisdom' },
    { name: 'Fontaine', key: 'fontaine', el: 'hydro', ideal: 'Justice' },
    { name: 'Natlan', key: 'natlan', el: 'pyro', ideal: 'War' },
    { name: 'Nod-Krai', key: 'nodkrai', el: '', ideal: '' },
    { name: 'Snezhnaya', key: 'snezhnaya', el: 'cryo', ideal: 'Love' },
  ];
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  function nations(chars) {
    const tabs = $('giNatTabs');
    tabs.innerHTML = NATIONS.map((n, i) => `<button type="button" class="gi-tab" role="tab" data-i="${i}">${n.el ? `<img src="${elIcon(n.el)}" alt="">` : ''}${esc(n.name)}</button>`).join('');
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
        : '<span>An autonomous region of Snezhnaya</span>';
      const list = chars.filter((c) => c.region === n.name).sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
      $('giNatCount').textContent = list.length;
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

  // ---- REACTIONS ----
  const ELS = ['pyro', 'hydro', 'anemo', 'electro', 'dendro', 'cryo', 'geo'];
  const AURA4 = ['pyro', 'hydro', 'electro', 'cryo'];
  const RX = [
    { n: 'Vaporize', e: ['pyro', 'hydro'], k: 'Amplifying', d: 'Hydro hitting Pyro deals 2× damage; Pyro hitting Hydro deals 1.5×. Elemental Mastery raises the multiplier.' },
    { n: 'Melt', e: ['pyro', 'cryo'], k: 'Amplifying', d: 'Pyro hitting Cryo deals 2× damage; Cryo hitting Pyro deals 1.5×. Elemental Mastery raises the multiplier.' },
    { n: 'Overloaded', e: ['pyro', 'electro'], k: 'Transformative', d: 'A Pyro explosion that damages every enemy nearby and knocks them back.' },
    { n: 'Superconduct', e: ['electro', 'cryo'], k: 'Transformative', d: "Area Cryo damage that cuts enemies' Physical RES by 40% for 12 seconds." },
    { n: 'Electro-Charged', e: ['hydro', 'electro'], k: 'Transformative', d: 'Electro damage over time while both elements stay on the target, arcing to wet enemies nearby.' },
    { n: 'Frozen', e: ['hydro', 'cryo'], k: 'Crowd control', d: 'Freezes the target in place. A heavy hit (claymores, plunges, Geo) breaks it with Shatter.' },
    { n: 'Swirl', e: ['anemo'], with: AURA4, k: 'Transformative', d: "Pulls in Pyro, Hydro, Electro or Cryo and spreads it to the enemies around, dealing that element's damage." },
    { n: 'Crystallize', e: ['geo'], with: AURA4, k: 'Shield', d: 'Drops a crystal shard of the element it hit. Pick it up for a shield that absorbs that element best.' },
    { n: 'Bloom', e: ['dendro', 'hydro'], k: 'Transformative', d: 'Spawns a Dendro Core that bursts after a few seconds, damaging enemies around it (and you, a little).' },
    { n: 'Burning', e: ['dendro', 'pyro'], k: 'Transformative', d: 'Sets the ground alight: Pyro damage over time to every enemy standing in it.' },
    { n: 'Quicken', e: ['dendro', 'electro'], k: 'Catalyze', d: 'Leaves the enemy Quickened. More Electro then triggers Aggravate, more Dendro triggers Spread.' },
    { n: 'Aggravate', e: ['dendro', 'electro'], k: 'Catalyze · Additive', d: 'An Electro hit on a Quickened enemy adds flat bonus damage, scaling with level and Elemental Mastery.', extra: true },
    { n: 'Spread', e: ['dendro', 'electro'], k: 'Catalyze · Additive', d: 'A Dendro hit on a Quickened enemy adds flat bonus damage, scaling with level and Elemental Mastery.', extra: true },
    { n: 'Hyperbloom', e: ['dendro', 'hydro', 'electro'], k: 'Transformative', d: 'Electro hits a Dendro Core: it turns into a homing sprawl shot that slams one enemy.', extra: true },
    { n: 'Burgeon', e: ['dendro', 'hydro', 'pyro'], k: 'Transformative', d: 'Pyro hits a Dendro Core: it explodes in a wider blast.', extra: true },
    { n: 'Shatter', e: ['hydro', 'cryo', 'geo'], k: 'Transformative', d: 'Hit a Frozen enemy with something heavy (claymore, plunge, Geo) to break the ice for Physical damage.', extra: true },
  ];
  function rxFor(a, b) {
    if (a === b) return null;
    return RX.find((r) => !r.extra && (r.with ? (r.e[0] === a && r.with.includes(b)) || (r.e[0] === b && r.with.includes(a)) : r.e.includes(a) && r.e.includes(b))) || null;
  }
  function reactions() {
    const svg = $('giWheel');
    const C = 200;
    const R = 140;
    const pos = ELS.map((_, i) => {
      const t = -Math.PI / 2 + (i * 2 * Math.PI) / ELS.length;
      return [C + R * Math.cos(t), C + R * Math.sin(t)];
    });
    svg.innerHTML =
      `<circle class="rx-ring" cx="${C}" cy="${C}" r="${R + 44}"/><circle class="rx-ring" cx="${C}" cy="${C}" r="${R - 44}"/>` +
      `<polygon class="rx-poly" points="${pos.map((p) => p.join(',')).join(' ')}"/><g id="rxLinks"></g>` +
      `<text class="rx-mid-k" x="${C}" y="${C - 8}" id="rxMidK"></text><text class="rx-mid" x="${C}" y="${C + 14}" id="rxMid"></text>` +
      ELS.map(
        (el, i) =>
          `<g class="rx-node" data-el="${el}" tabindex="0" role="button" aria-label="${cap(el)}" transform="translate(${pos[i][0]},${pos[i][1]})"><circle r="30"/><image href="${elIcon(el)}" x="-17" y="-17" width="34" height="34"/><text y="50">${cap(el)}</text></g>`
      ).join('');
    let picked = ['pyro', 'hydro'];
    const draw = (els, r) => {
      svg.querySelectorAll('.rx-node').forEach((g) => g.classList.toggle('is-on', els.includes(g.dataset.el)));
      const pts = els.map((el) => pos[ELS.indexOf(el)]);
      $('rxLinks').innerHTML = pts.length > 1 ? pts.map((p, i) => (i < pts.length - 1 || pts.length > 2 ? `<line class="rx-link" x1="${p[0]}" y1="${p[1]}" x2="${pts[(i + 1) % pts.length][0]}" y2="${pts[(i + 1) % pts.length][1]}"/>` : '')).join('') : '';
      $('rxMidK').textContent = r ? r.k : els.length > 1 ? 'No reaction' : 'Pick one more';
      $('rxMid').textContent = r ? r.n : '';
      $('rxKind').textContent = r ? r.k : els.length > 1 ? 'No reaction' : 'Pick a second element';
      $('rxName').textContent = r ? r.n : els.length > 1 ? 'Nothing happens' : cap(els[0]);
      $('rxEq').innerHTML = els.map((el) => `<img src="${elIcon(el)}" alt="">${cap(el)}`).join('<span aria-hidden="true">+</span>');
      $('rxDesc').textContent = r ? r.d : els.length > 1 ? "Anemo, Geo and Dendro don't react with each other, and no element reacts with itself." : 'Choose another element on the wheel.';
      $('rxList').querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', !!r && b.textContent === r.n));
    };
    $('rxList').innerHTML = RX.map((r) => `<button type="button">${esc(r.n)}</button>`).join('');
    $('rxList').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const r = RX.find((x) => x.n === b.textContent);
      picked = r.with ? [r.e[0], r.with[0]] : r.e.slice();
      draw(picked, r);
    });
    const choose = (el) => {
      // A third pick starts a new pair from the last one.
      picked = picked.length >= 2 ? [el] : picked[0] === el ? [el] : [picked[0], el];
      draw(picked, picked.length === 2 ? rxFor(picked[0], picked[1]) : null);
    };
    svg.addEventListener('click', (e) => {
      const g = e.target.closest('.rx-node');
      if (g) choose(g.dataset.el);
    });
    svg.addEventListener('keydown', (e) => {
      const g = e.target.closest('.rx-node');
      if (g && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        choose(g.dataset.el);
      }
    });
    draw(picked, rxFor('pyro', 'hydro'));
  }

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
  reactions();
  pity();

  // ---- go ----
  GI.feed
    .then((feed) => {
      hero(feed.banners || []);
      lede(feed);
      const v = (feed.banners || []).find((b) => b.version);
      if (v) $('giVer').textContent = v.version;
      today(feed);
      events(feed.events);
      endgame(feed.challenges, feed.events);
      codes(feed.codes);
      redeemDemo((feed.codes || []).find((c) => c.primos) || (feed.codes || [])[0]);
      nations(feed.characters || []);
      GI.serverTray($('giServer'), () => {
        today(feed);
        lede(feed);
        tick();
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
