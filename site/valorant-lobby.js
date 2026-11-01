// Valorant Lobby (v3, Nov 1 2026, Adrian: "upgrade it your way"; v1 Oct 30 = the player search in the hero).
// Everything on /valorant/ that isn't 11layout's chrome:
// 1. Hero: the act from /valorant-weapons.json (scripts/valorant-feed.mjs, daily); the facts strip was cut (Nov 1 2026, Adrian).
//    Live card (v4, Nov 1 2026, Adrian picked "live hub"): the act clock (same file's acts) + NA's top 3 (the Ranked
//    leaderboard call).
// 2. Player search: opens the player page /valorant/player/<name>-<tag> (valorant-player.js).
// 3. Map pool (Worker type=queue): tall slices, the pointed one opens up (CSS).
// 4. Agents: valorant-roster.json (written by scripts/valorant-agents.py: colours, release date, patch, origin, bio,
//    C/Q/E/X names), newest first. The hero's agent select (agentSelect, Nov 1 2026, Adrian: one agent centred, < > to
//    step) + the roster by role (drawRoster; it replaced the agent spotlight band, which showed the same agent twice).
// 5. Ranked: the 9 ranks as stairs (keys = valorant-ranks.js ?r=) + Top of the ladder (Worker type=leaderboard).
// 6. Buy menu: valorant-weapons.json in the game's four columns. 7. Tools: each card previews its tool (game-nav.json;
//    "On the way" chips cut Nov 1 2026, Adrian: the lobby shows only what works). 8. Pro scene: events (vlr.orlandomm.net) + news (VLR's RSS via the Worker).
// Real numbers only (Adrian): a source that fails says so, never a hand-typed stand-in.
(function () {
  const API = 'https://parchrome-valorant.adriantulabut5747.workers.dev/api/valorant';
  const api = (type, q) => API + '?type=' + type + (q ? '&' + new URLSearchParams(q) : '');
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const getJSON = (url, ms = 6000) =>
    fetch(url, { signal: AbortSignal.timeout(ms) }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(url + ' ' + r.status))));
  const shared = (url) => (window.pcJSON ? window.pcJSON(url) : getJSON(url));
  const say = (el, msg) => (el.innerHTML = `<p class="vl-empty">${msg}</p>`);
  const rankIcon = (tier) => (tier >= 3 && tier <= 27 ? `/images/valorant/ranks/${tier}.webp` : '');
  const day = (iso, o = { month: 'short', day: 'numeric', year: 'numeric' }) => {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, o);
  };
  const ON_PAGES = location.hostname.endsWith('github.io'); // Pages can't rewrite addresses, so there it's ?id=
  const playerHref = (n, t) =>
    (ON_PAGES ? '/valorant/player/?id=' : '/valorant/player/') + encodeURIComponent(n) + '-' + encodeURIComponent(t);

  const showLive = () => ($('vlLive').hidden = false);

  /* sections rise in as they scroll into view (Nov 1 2026, Adrian: "more alive"); no observer or reduced motion = shown as is */
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add('is-in'), io.unobserve(e.target))),
      { rootMargin: '0px 0px -60px 0px' },
    );
    document.querySelectorAll('.vl-sec').forEach((s) => (s.classList.add('vl-rise'), io.observe(s)));
  }

  /* ---- 1. the act clock + 6. buy menu (one file) ---- */
  shared('/valorant-weapons.json')
    .then((d) => {
      const now = Date.now();
      const act = (d.acts || []).find((a) => Date.parse(a.start) <= now && now < Date.parse(a.end));
      if (act) actClock(act);
      if (d.patch && d.patch.branch) $('vlKickPatch').textContent = '· Patch ' + d.patch.branch;
      drawGuns(d.guns || []);
    })
    .catch((err) => {
      say($('vlGuns'), 'The weapon list didn\'t load. <a href="/valorant/weapons">Weapons</a>');
      console.warn('Act / patch / guns unavailable:', err);
    });

  // the live card's clock: days / hours / mins / secs to the act's end, and how far through the act we are
  function actClock(act) {
    const start = Date.parse(act.start),
      end = Date.parse(act.end);
    const name = (act.ep ? act.ep + ' ' : '') + act.name;
    $('vlKickAct').textContent = '· ' + name;
    $('vlActName').textContent = name;
    $('vlActWhen').textContent = 'Ends ' + day(end, { weekday: 'short', month: 'short', day: 'numeric' });
    $('vlActFrom').textContent = day(start, { month: 'short', day: 'numeric' });
    $('vlActTo').textContent = day(end, { month: 'short', day: 'numeric' });
    const units = {};
    $('vlActBox')
      .querySelectorAll('[data-u]')
      .forEach((b) => (units[b.dataset.u] = b));
    const pad = (n) => String(n).padStart(2, '0');
    const draw = () => {
      const now = Date.now();
      const left = Math.max(0, end - now);
      units.d.textContent = Math.floor(left / 864e5);
      units.h.textContent = pad(Math.floor(left / 36e5) % 24);
      units.m.textContent = pad(Math.floor(left / 6e4) % 60);
      units.s.textContent = pad(Math.floor(left / 1e3) % 60);
      $('vlActBar').style.width = Math.min(100, ((now - start) / (end - start)) * 100).toFixed(1) + '%';
      if (!left) clearInterval(timer);
    };
    const timer = setInterval(draw, 1000);
    draw();
    $('vlActBox').hidden = false;
    showLive();
  }

  // the game's buy screen: Sidearms | SMGs + Shotguns | Rifles | Snipers + Heavy; a shop the file adds later joins the last column
  const COLUMNS = [['Sidearms'], ['SMGs', 'Shotguns'], ['Assault Rifles', 'Rifles'], ['Sniper Rifles', 'Heavy Weapons']];
  function drawGuns(guns) {
    if (!guns.length) throw new Error('no guns');
    const shops = {};
    guns.forEach((g) => (shops[g.shop] = shops[g.shop] || []).push(g));
    const cols = COLUMNS.map((c) => c.filter((s) => shops[s]));
    Object.keys(shops)
      .filter((s) => !COLUMNS.flat().includes(s))
      .forEach((s) => cols[cols.length - 1].push(s));
    const gun = (g) => `
      <a class="vl-gun" href="/valorant/weapons?w=${encodeURIComponent(g.id)}">
        <span class="vl-gun-pic">${/^https:\/\//.test(g.icon) ? `<img src="${esc(g.icon)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}</span>
        <b>${esc(g.name)}</b><span class="vl-cost">${g.cost ? Number(g.cost).toLocaleString('en-US') : 'Free'}</span></a>`;
    // each shop in its own box (desktop: stacked in the columns; phones: one shown at a time under the tabs)
    $('vlGuns').innerHTML = cols
      .filter((c) => c.length)
      .map(
        (c) =>
          `<div class="vl-col">${c.map((s) => `<div class="vl-shop" data-shop="${esc(s)}" style="--n:${shops[s].length}"><h3 class="vl-label">${esc(s)}</h3>${shops[s].map(gun).join('')}</div>`).join('')}</div>`,
      )
      .join('');
    const order = cols.flat();
    const tabs = $('vlShopTabs');
    tabs.innerHTML = order
      .map(
        (s, i) =>
          `<button type="button" class="vl-tab" role="tab" aria-selected="${!i}" data-shop="${esc(s)}">${esc(s)}<i>${shops[s].length}</i></button>`,
      )
      .join('');
    const pick = (s) => {
      tabs.querySelectorAll('.vl-tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.shop === s));
      $('vlGuns')
        .querySelectorAll('.vl-shop')
        .forEach((el) => el.classList.toggle('is-on', el.dataset.shop === s));
    };
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('.vl-tab');
      if (b) pick(b.dataset.shop);
    });
    pick(order[0]);
  }

  /* ---- 2. player search ---- */
  $('vlFind').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('vlName').value.trim();
    const tag = $('vlTag').value.trim().replace(/^#/, '');
    const status = $('vlStatus');
    if (!/^[\p{L}\p{N} _.-]{3,16}$/u.test(name) || !/^[\p{L}\p{N}]{3,5}$/u.test(tag)) {
      status.textContent = 'A Riot ID is a name of 3-16 characters and a tag of 3-5 letters or numbers.';
      status.dataset.err = '';
      return;
    }
    location.href = playerHref(name, tag);
  });

  /* ---- 3. map pool (the Maps pages ask the same queue) ---- */
  getJSON(api('queue', { region: 'na' }))
    .then((j) => {
      const comp = (j.data || []).find((m) => m.mode_id === 'competitive');
      const live = (comp?.maps || [])
        .filter((m) => m.enabled)
        .map((m) => m.map.name)
        .sort();
      if (!live.length) throw new Error('no competitive queue');
      const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      $('vlPool').innerHTML = live
        .map(
          (n, i) => `
        <a class="vl-map" href="/valorant/maps/${slug(n)}" style="--i:${i}">
          <img src="/images/valorant/maps/${slug(n)}-card.webp" alt="" width="720" height="405" ${i ? 'loading="lazy" ' : ''}decoding="async">
          <img class="vl-map-mini" src="/images/valorant/maps/${slug(n)}-minimap.webp" alt="" width="160" height="160" loading="lazy" decoding="async" onerror="this.remove()">
          <span class="vl-map-n">${String(i + 1).padStart(2, '0')}</span>
          <span class="vl-map-txt"><b>${esc(n)}</b><span>Callouts and site guides</span></span></a>`,
        )
        .join('');
    })
    .catch((err) => {
      say($('vlPool'), 'The live map pool isn\'t answering right now. <a href="/valorant/maps/">Every map</a>');
      console.warn('Map pool unavailable:', err);
    });

  /* ---- 4. agents: the hero's agent select + the roster by role (valorant-roster.json, release order) ---- */
  const KEY_NAME = { C: 'Ability', Q: 'Ability', E: 'Signature', X: 'Ultimate' };
  const ROLES = ['Duelist', 'Initiator', 'Controller', 'Sentinel'];
  shared('/valorant-roster.json')
    .then((roster) => {
      if (!roster.length) throw new Error('empty roster');
      const list = roster.slice().reverse(); // the file is in release order: newest first
      agentSelect(list);
      drawRoster(list);
    })
    .catch((err) => {
      $('vlHero').classList.add('is-bare');
      say($('vlRoster'), 'The agent list didn\'t load. <a href="/valorant/agents/">Every agent</a>');
      console.warn('Agents unavailable:', err);
    });

  // hero: one agent centred over their own name art; < > (or the arrow keys, or a swipe) step through the roster newest
  // first, and the card on the right + the hero's light follow. No autoplay: it only moves when you ask.
  function agentSelect(list) {
    const hero = $('vlHero'),
      fig = $('vlFig'),
      card = $('vlCard');
    const n = list.length;
    const art = (a, kind) => `/images/valorant/agents/${esc(a.slug)}${kind}.webp`;
    let at = 0;
    const show = (i, dir) => {
      at = (i + n) % n;
      const a = list[at],
        prev = list[(at - 1 + n) % n],
        next = list[(at + 1) % n];
      hero.style.setProperty('--ac', a.ac || '#3d2c44');
      hero.style.setProperty('--ac2', a.ac2 || '#15161a');
      fig.dataset.dir = dir || '';
      fig.innerHTML = `<a class="vh-agent" href="/valorant/agents/${esc(a.slug)}" aria-label="Open ${esc(a.name)}'s file">
        <span class="vh-bgtxt" style="--m:url('${art(a, '-bg')}')"></span>
        <img class="vh-render" src="${art(a, '')}" alt="" width="1000" height="908" decoding="async"${at ? '' : ' fetchpriority="high"'}></a>`;
      [
        [$('vlPrev'), prev, 'Previous'],
        [$('vlNext'), next, 'Next'],
      ].forEach(([b, x, word]) => {
        b.setAttribute('aria-label', `${word} agent: ${x.name}`);
        b.title = x.name;
      });
      $('vlCount').innerHTML = `<b>${String(at + 1).padStart(2, '0')}</b><i>/ ${String(n).padStart(2, '0')}</i>`;
      const slot = Object.fromEntries(a.ab || []);
      const facts = [
        ['Joined', day(a.released)],
        ['Patch', a.patch],
        ['Origin', a.origin],
      ].filter(([, v]) => v);
      card.innerHTML = `
        <p class="vl-label">${at ? '' : '<i class="vl-new">Newest</i>'}<img src="/images/valorant/agents/role-${esc(a.role.toLowerCase())}.webp" alt="" width="14" height="14">${esc(a.role)}<span>· Agent ${n - at} of ${n}</span></p>
        <p class="vh-card-name">${esc(a.name)}</p>
        ${a.bio ? `<p class="vh-card-bio">${esc(a.bio)}</p>` : ''}
        ${facts.length ? `<dl class="vh-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
        ${
          (a.ab || []).length
            ? `<ul class="vh-kit">${['C', 'Q', 'E', 'X']
                .filter((k) => slot[k])
                .map(
                  (k) =>
                    `<li><span class="vh-kit-ico"><img src="${art(a, '-' + k.toLowerCase())}" alt="" width="96" height="96" decoding="async"></span><span class="vh-kit-txt"><small><kbd>${k}</kbd>${KEY_NAME[k]}</small><b>${esc(slot[k])}</b></span></li>`,
                )
                .join('')}</ul>`
            : ''
        }
        <a class="vl-key vh-card-key" href="/valorant/agents/${esc(a.slug)}">Open ${esc(a.name)}'s file</a>`;
      card.hidden = false;
      [prev, next].forEach((x) => (new Image().src = art(x, ''))); // warm the neighbours so the next press is instant
      cutName();
    };
    // the contour lines sit behind the name art: hand its box to their mask (valorant-lobby.css "BACKDROP"). Layout size +
    // the drawn centre, so the name's entrance zoom (vh-txt) doesn't skew it.
    const lines = hero.querySelector('.vh-fx i');
    const cutName = () => {
      const t = fig.querySelector('.vh-bgtxt');
      if (!t || !lines) return;
      const f = lines.getBoundingClientRect(),
        r = t.getBoundingClientRect(),
        w = t.offsetWidth,
        h = t.offsetHeight;
      lines.style.cssText = `--nm:${t.style.getPropertyValue('--m')};--nx:${r.left + r.width / 2 - f.left - w / 2}px;--ny:${r.top + r.height / 2 - f.top - h / 2}px;--nw:${w}px;--nh:${h}px`;
    };
    new ResizeObserver(cutName).observe(hero);
    $('vlPrev').addEventListener('click', () => show(at - 1, 'prev'));
    $('vlNext').addEventListener('click', () => show(at + 1, 'next'));
    hero.addEventListener('keydown', (e) => {
      if (e.target.closest('input') || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault();
      show(at + (e.key === 'ArrowRight' ? 1 : -1), e.key === 'ArrowRight' ? 'next' : 'prev');
    });
    // touch: swipe the stage sideways (a mouse drag is left alone)
    let x0 = null;
    const stage = $('vlStage');
    stage.addEventListener('pointerdown', (e) => (x0 = e.pointerType === 'mouse' ? null : e.clientX));
    stage.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) show(at + (dx < 0 ? 1 : -1), dx < 0 ? 'next' : 'prev');
    });
    show(0);
  }

  // roster: a box per role, each agent a portrait card in their own colours, newest first (phones: one role under the tabs)
  function drawRoster(list) {
    const roles = ROLES.filter((r) => list.some((a) => a.role === r));
    const box = $('vlRoster');
    box.dataset.show = roles[0];
    box.innerHTML = roles
      .map((r) => {
        const mine = list.filter((a) => a.role === r);
        return `<div class="vl-role" data-role="${r}">
          <h3 class="vl-role-h"><span class="vl-role-ico"><img src="/images/valorant/agents/role-${r.toLowerCase()}.webp" alt="" width="20" height="20" loading="lazy"></span>${r}s<small>${mine.length}</small></h3>
          <div class="vl-cards">${mine
            .map(
              (a) => `<a class="vl-card" href="/valorant/agents/${esc(a.slug)}" style="--ac:${esc(a.ac)};--ac2:${esc(a.ac2)}">
              <img src="/images/valorant/agents/${esc(a.slug)}-card.webp" alt="" width="480" height="640" loading="lazy" decoding="async">
              ${a === list[0] ? '<i class="vl-new">New</i>' : ''}<b>${esc(a.name)}</b></a>`,
            )
            .join('')}</div></div>`;
      })
      .join('');
    const tabs = $('vlRoleTabs');
    tabs.innerHTML = roles
      .map(
        (r, i) =>
          `<button type="button" class="vl-tab" role="tab" aria-selected="${!i}" data-role="${r}"><img src="/images/valorant/agents/role-${r.toLowerCase()}.webp" alt="" width="16" height="16">${r}<i>${list.filter((a) => a.role === r).length}</i></button>`,
      )
      .join('');
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('.vl-tab');
      if (!b) return;
      tabs.querySelectorAll('.vl-tab').forEach((x) => x.setAttribute('aria-selected', x === b));
      box.dataset.show = b.dataset.role;
    });
  }

  /* ---- 5. ranked: stairs (names, keys + colours = valorant-ranks.js RANKS, icon = each rank's first tier) ---- */
  $('vlStairs').innerHTML = [
    ['iron', 'Iron', 3, '#a7aaa7'],
    ['bronze', 'Bronze', 6, '#c19a6b'],
    ['silver', 'Silver', 9, '#cfd5d5'],
    ['gold', 'Gold', 12, '#eccf56'],
    ['platinum', 'Platinum', 15, '#5fc0cf'],
    ['diamond', 'Diamond', 18, '#c69ad6'],
    ['ascendant', 'Ascendant', 21, '#6ae2af'],
    ['immortal', 'Immortal', 24, '#e2577f'],
    ['radiant', 'Radiant', 27, '#ffffaa'],
  ]
    .map(
      ([key, name, t, c], i) => `
    <a class="vl-step" href="/valorant/ranks?r=${key}" style="--s:${i};--rc:${c}"><img src="${rankIcon(t)}" alt="" width="64" height="64" loading="lazy" decoding="async"><span class="vl-step-b"><b>${name}</b></span></a>`,
    )
    .join('');

  /* Top of the ladder: thresholds[].start_index = the leaderboard place a tier starts at (Radiant first), so the gap
     to the next one is that tier's size; the last runs to the end of the board. Same maths as valorant-ranks.js parseBoard(). */
  getJSON(api('leaderboard', { region: 'na' }))
    .then((j) => {
      const TIERS = [
        [27, 'Radiant'],
        [26, 'Immortal 3'],
        [25, 'Immortal 2'],
        [24, 'Immortal 1'],
      ];
      const th = (j.thresholds || [])
        .map((t) => ({ id: Number(t.tier && t.tier.id), start: Number(t.start_index), rr: Number(t.threshold) }))
        .filter((t) => Number.isFinite(t.id) && Number.isFinite(t.start))
        .sort((a, b) => a.start - b.start);
      const base = th.length ? th[0].start : 1;
      const count = {},
        rr = {};
      th.forEach((t, i) => {
        count[t.id] = Math.max(0, th[i + 1] ? th[i + 1].start - t.start : Number(j.total) - (t.start - base));
        rr[t.id] = t.rr;
      });
      topThree(j.players || []);
      const rows = TIERS.filter(([id]) => Number.isFinite(count[id]));
      if (!rows.length) throw new Error('no tiers');
      const all = rows.reduce((n, [id]) => n + count[id], 0) || 1;
      const pct = (n) => {
        const p = (n / all) * 100;
        return (p < 10 ? p.toFixed(1) : Math.round(p)) + '%';
      };
      // one split bar = the whole board, Radiant on the left (a bar per row made Immortal 1 look like the best)
      $('vlSplit').innerHTML = rows
        .map(([id, name]) => `<i data-t="${id}" style="flex-grow:${count[id]}" title="${name}: ${pct(count[id])}"></i>`)
        .join('');
      $('vlLadder').innerHTML = rows
        .map(
          ([id, name]) => `
        <li class="vl-tier" data-t="${id}"><img src="${rankIcon(id)}" alt="" width="28" height="28"><b>${name}</b>
          <span class="vl-tier-rr">${Number.isFinite(rr[id]) ? 'From ' + rr[id] + ' RR' : ''}</span>
          <span class="vl-n">${count[id].toLocaleString('en-US')}<small>${pct(count[id])} of the board</small></span></li>`,
        )
        .join('');
      $('vlBoardN').textContent = all.toLocaleString('en-US') + ' players';
    })
    .catch((err) => {
      say($('vlLadder'), "The live leaderboard isn't answering right now.");
      $('vlSplit').hidden = true;
      console.warn('Top of the ladder unavailable:', err);
    });

  // the live card's lower half: NA's top 3, each a link to their player page (anonymized = Riot's "Secret Agent", no link)
  function topThree(players) {
    const top = players.filter((p) => Number.isFinite(p.rank)).slice(0, 3);
    if (!top.length) return;
    // the player's own card: its wide banner fills the tile behind the name
    const okCard = (c) => /^[0-9a-f-]{36}$/i.test(c || '');
    const card = (c, kind, w, h) =>
      okCard(c)
        ? `<img src="https://media.valorant-api.com/playercards/${c}/${kind}.png" alt="" width="${w}" height="${h}" loading="lazy" onerror="this.remove()">`
        : '';
    $('vlTop3').innerHTML = top
      .map((p) => {
        const wins = Number.isFinite(p.wins) ? `<small class="vh-top-w">${p.wins.toLocaleString('en-US')} wins</small>` : '';
        const inner = `<span class="vh-top-bg" aria-hidden="true">${card(p.card, 'wideart', 452, 128)}</span>
          <span class="vh-top-n">${p.rank}</span>
          <span class="vh-top-who">${p.name ? esc(p.name) + '<small>#' + esc(p.tag) + '</small>' : 'Secret Agent'}</span>
          <span class="vh-top-rr">${rankIcon(p.tier) ? `<img src="${rankIcon(p.tier)}" alt="" width="16" height="16">` : ''}${Number(p.rr).toLocaleString('en-US')}<small>RR</small>${wins}</span>`;
        return `<li>${p.name ? `<a href="${playerHref(p.name, p.tag)}">${inner}</a>` : `<span>${inner}</span>`}</li>`;
      })
      .join('');
    $('vlTopBox').hidden = false;
    showLive();
  }

  /* ---- 7. tools: a live preview per page (unknown tools get their nav icon) ---- */
  const PREVIEW = {
    // the default-style crosshair (4 lines + dot) over a real map shot, drawn in CSS
    '/valorant/crosshairs': () => `<span class="vl-pv vl-pv--xh"><i></i><i></i><i></i><i></i><u></u></span>`,
    // the converter's own maths (valorant-sensitivity.js): Valorant sens = sens x yaw / 0.07, cm/360 = 914.4 / (DPI x sens x 0.07)
    '/valorant/sensitivity': () => {
      const val = (1 * 0.022) / 0.07;
      return `<span class="vl-pv vl-pv--sens"><span><small>CS2</small><b>1.00</b></span><i aria-hidden="true">→</i><span><small>Valorant</small><b>${val.toFixed(3)}</b></span>
        <em>${(914.4 / (800 * val * 0.07)).toFixed(1)} cm / 360 at 800 DPI</em></span>`;
    },
    // a piece the gallery card doesn't show, never the crosshair one (it read as a crosshair, not chat art)
    '/valorant/chat-art': (art) => {
      const pool = art.slice(6).filter((p) => p.id !== 'crosshair');
      const pick = (pool.length ? pool : art)[Math.floor(Math.random() * (pool.length || art.length))];
      return pick ? `<span class="vl-pv vl-pv--px">${pixels(pick)}</span>` : '';
    },
    '/valorant/chat-art-gallery': (art, total) =>
      art.length
        ? `<span class="vl-pv vl-pv--gal">${art
            .slice(0, 6)
            .map((p) => `<span>${pixels(p)}</span>`)
            .join('')}<em>${total} drawings</em></span>`
        : '',
  };
  // a gallery px piece as CSS pixels: # full, + dark, - mid, ^ top half, _ bottom half (valorant-chatart.json's key)
  function pixels(p) {
    const w = Math.max(...p.px.map((r) => r.length));
    return `<span class="vl-px" style="--w:${w}" title="${esc(p.name)}">${p.px.map((r) => [...r.padEnd(w, '.')].map((c) => `<i data-c="${'#+-^_'.includes(c) ? esc(c) : ''}"></i>`).join('')).join('')}</span>`;
  }
  Promise.all([shared('/game-nav.json'), getJSON('/valorant-chatart.json').catch(() => ({}))])
    .then(([nav, gal]) => {
      const art = (gal.art || []).filter((p) => Array.isArray(p.px) && p.px.length);
      const groups = nav.valorant.groups;
      const svg = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p.icon || ''}</svg>`;
      const tools = (groups.find((g) => g.name === 'Tools')?.pages || []).filter((p) => p.link && !p.soon);
      $('vlTools').innerHTML = tools
        .map(
          (p) => `
        <a class="vl-tool" href="${esc(p.link)}">
          <span class="vl-tool-pic" data-t="${esc(p.link.split('/').pop())}">${(PREVIEW[p.link] && PREVIEW[p.link](art, (gal.art || []).length)) || `<span class="vl-pv">${svg(p)}</span>`}</span>
          <b>${esc(p.name)}</b><span>${esc(p.sub || '')}</span></a>`,
        )
        .join('');
    })
    .catch((err) => console.warn('Page list unavailable:', err)); // the bar's menus need the same file, so they'd be gone too

  /* ---- 8. pro scene (phones: Events | News tabs, CSS shows the box named in data-show) ---- */
  $('vlSceneTabs').addEventListener('click', (e) => {
    const b = e.target.closest('.vl-tab');
    if (!b) return;
    $('vlSceneTabs')
      .querySelectorAll('.vl-tab')
      .forEach((x) => x.setAttribute('aria-selected', x === b));
    $('vlScene').dataset.show = b.dataset.p;
  });

  const EV = 'https://vlr.orlandomm.net/api/v1/events?page=1&region=all&status=';
  Promise.all([getJSON(EV + 'ongoing', 5000), getJSON(EV + 'upcoming', 5000)])
    .then(([on, up]) => {
      const evs = [...(on.data || []), ...(up.data || [])].slice(0, 5);
      if (!evs.length) throw new Error('no events');
      const prize = (p) => parseInt(String(p).replace(/[^0-9]/g, ''), 10) || 0;
      $('vlEvents').innerHTML = evs
        .map(
          (ev) => `
        <li><a class="vl-ev" href="${/^\d+$/.test(ev.id) ? 'https://www.vlr.gg/event/' + ev.id : 'https://www.vlr.gg/events'}" target="_blank" rel="noopener">
          <span class="vl-ev-pic">${/^https:\/\//.test(ev.img) ? `<img src="${esc(ev.img)}" alt="" width="40" height="40" loading="lazy" onerror="this.remove()">` : ''}</span>
          <span class="vl-ev-txt"><b>${esc(ev.name)}</b><span><i data-s="${esc(ev.status)}">${esc(ev.status)}</i>${esc(String(ev.dates || '').replace(/^([A-Za-z]{3} \d+) ([A-Za-z]{3} \d+)$/, '$1 - $2'))}${prize(ev.prizepool) ? ' · $' + prize(ev.prizepool).toLocaleString('en-US') : ''}</span></span>
        </a></li>`,
        )
        .join('');
    })
    .catch((err) => {
      say(
        $('vlEvents'),
        'The events list isn\'t answering right now. <a href="https://www.vlr.gg/events" target="_blank" rel="noopener">VLR.gg events</a>',
      );
      console.warn('Events unavailable:', err);
    });

  /* news: VLR sends no CORS header, so the Worker fetches the feed (type=news) and an article's og:image (type=og)
     for items the feed ships without a picture */
  fetch(api('news'), { signal: AbortSignal.timeout(6000) })
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error('news ' + r.status))))
    .then((xml) => {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const items = [...doc.querySelectorAll('item')].slice(0, 4);
      if (!items.length) throw new Error('empty feed');
      const txt = (el, t) => el.querySelector(t)?.textContent.trim() || '';
      const box = $('vlNews');
      box.innerHTML = items
        .map((it) => {
          const link = txt(it, 'link');
          const pic = it.querySelector('enclosure')?.getAttribute('url') || '';
          return `<a class="vl-news" href="${/^https:\/\//.test(link) ? esc(link) : 'https://www.vlr.gg/news'}" target="_blank" rel="noopener">
          <span class="vl-news-pic">${/^https:\/\//.test(pic) ? `<img src="${esc(pic)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>
          <span class="vl-news-txt"><b>${esc(txt(it, 'title'))}</b><small>${day(txt(it, 'pubDate'))}</small></span></a>`;
        })
        .join('');
      box.querySelectorAll('.vl-news').forEach((a) => {
        if (a.querySelector('.vl-news-pic img') || !/^https:\/\/www\.vlr\.gg\//.test(a.href)) return;
        getJSON(api('og', { url: a.href }), 4000)
          .then((j) => {
            if (/^https:\/\//.test(j.img))
              a.querySelector('.vl-news-pic').innerHTML = `<img src="${esc(j.img)}" alt="" loading="lazy" onerror="this.remove()">`;
          })
          .catch(() => {}); // no picture = the plain well
      });
    })
    .catch((err) => {
      say(
        $('vlNews'),
        'The news feed isn\'t answering right now. <a href="https://www.vlr.gg/news" target="_blank" rel="noopener">VLR.gg news</a>',
      );
      console.warn('News unavailable:', err);
    });
})();
