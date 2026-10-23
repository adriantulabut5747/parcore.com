// Genshin player lookup (/genshin-impact/player/<UID>, Oct 23 2026). One page serves every
// player: site/_redirects sends /genshin-impact/player/* here and the UID comes from the
// address; no UID = the search. Data: /api/genshin (netlify/functions/genshin-api.mjs, which
// asks Enka.Network) + /genshin-enka-map.json (ids -> names/icons, scripts/genshin-feed.py).
// Pictures are Enka's (enka.network/ui/, CORS open). Shared helpers: genshin-core.js.
// Styles: genshin.css + genshin-player.css. Player text (nickname, signature) is
// third-party, so it goes through esc() like everything else.
//
// Page order once a UID loads: profile card (#gpCard, milestones inside) -> bar -> showcase (tray + one build,
// the picked character is in the address as #<name> so a copied link opens it) -> every
// build at a glance (#gpRoster) -> the namecards the player shows (#gpNamecards).
(function () {
  const { $, esc, EL, NEUTRAL, elIcon, uidServer, lookup, playerHref, API } = window.GI;
  const UI = 'https://enka.network/ui/';
  // The UID: /genshin-impact/player/<UID> on Netlify, ?uid=<UID> on GitHub Pages.
  const seg = location.pathname.split('/genshin-impact/player/')[1] || '';
  const raw = decodeURIComponent(new URLSearchParams(location.search).get('uid') || seg.replace(/\/$/, ''));
  const uid = /^\d{9,10}$/.test(raw) ? raw : '';

  // Small line icons for the profile numbers (24-unit boxes, stroked).
  const ICON = {
    ar: '<path d="M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.4l-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>',
    wl: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.4 2.3 3.5 5 3.5 8s-1.1 5.7-3.5 8c-2.4-2.3-3.5-5-3.5-8s1.1-5.7 3.5-8z"/>',
    ach: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
    abyss: '<path d="M12 20a8 8 0 1 1 8-8 6 6 0 0 1-6 6 4.5 4.5 0 0 1-4.5-4.5A3 3 0 0 1 12.5 10a1.6 1.6 0 0 1 1.5 1.6"/>',
    theater: '<path d="M5 4.5h10v6a5 5 0 0 1-10 0zM8 8.5h.01M12 8.5h.01M8.3 12a2.4 2.4 0 0 0 3.4 0M15 9h4v5a5 5 0 0 1-6.5 4.8"/>',
    fr: '<path d="M12 19.5s-7-4.3-7-9.4A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.1c0 5.1-7 9.4-7 9.4z"/>',
  };
  const ico = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
  // The profile card's number tray, in order (the search draws the same tray, empty).
  const STATS = [
    ['ar', 'Adventure Rank'],
    ['wl', 'World Level'],
    ['ach', 'Achievements'],
    ['abyss', 'Spiral Abyss'],
    ['theater', 'Imaginarium Theater'],
    ['fr', 'Max friendship'],
  ];
  // The banner's frame: one corner flourish (drawn top-left, mirrored by CSS for the
  // other three) and the crest at the top centre, after the in-game friend card's gold trim.
  const CORNER = '<svg viewBox="0 0 64 64"><path d="M1 44V15A14 14 0 0 1 15 1h29"/><path d="M8 34V18A10 10 0 0 1 18 8h16"/><path d="M8 8l9 9"/><path d="M20 15.5l4.5 4.5-4.5 4.5-4.5-4.5z" class="f"/></svg>';
  const FRAME = ['tl', 'tr', 'bl', 'br'].map((k) => `<i class="gp-orn gp-orn--${k}">${CORNER}</i>`).join('') +
    '<svg class="gp-crest" viewBox="0 0 160 20"><path d="M0 10h58M102 10h58M62 10h6M92 10h6"/><path d="M80 1l9 9-9 9-9-9z"/><path d="M80 5.5l4.5 4.5-4.5 4.5-4.5-4.5z" class="f"/></svg>';

  // Milestones: the card's right column. Plain facts about the profile's numbers, each with the
  // game's matching achievement category medal (yatta), gold when reached. The search card draws
  // the same medals, grey, each with its requirement (blank = true). Floor / stars = this period's.
  const ACH = (n) => `/images/genshin/achievement/${n}.webp`;
  function medals(p, blank) {
    const floor = +p.towerFloorIndex || 0;
    const room = +p.towerLevelIndex || 1;
    const stars = p.towerStarIndex;
    const B = [
      ['A002', 'Max Adventure Rank', 'Adventure Rank 60', p.level >= 60, p.level != null ? `AR ${p.level}` : ''],
      ['B005', 'Floor 12', 'Reached Spiral Abyss Floor 12 this period', floor >= 12, floor ? `At ${floor}-${room}` : 'No run'],
      ['B004', 'Full stars', 'All 36 Spiral Abyss stars this period', stars >= 36, stars != null ? `${stars} / 36` : 'No stars shown'],
      ['O001', '1,000 achievements', 'Completed 1,000 achievements', p.finishAchievementNum >= 1000, p.finishAchievementNum != null ? `${Number(p.finishAchievementNum).toLocaleString('en-US')} / 1,000` : ''],
      ['E001', 'Close bonds', '10 characters at max friendship', p.fetterCount >= 10, `${p.fetterCount || 0} / 10`],
    ];
    return B.map(
      ([i, t, d, ok, prog]) =>
        `<li class="gp-badge${ok ? ' is-on' : ''}" title="${d}"><span class="gp-medal"><img src="${ACH(i)}" alt="" loading="lazy" decoding="async"></span><span><b>${t}</b><small>${ok ? 'Earned' : (!blank && prog) || d}</small></span></li>`,
    ).join('');
  }

  // ---- recent searches: this browser only. Each = { u: UID, n: nickname, p: profile picture };
  // older entries were bare UID strings, still read. n / p came from Enka, so they're checked
  // and escaped like any player text (p must be an Enka picture URL).
  const RECENT = 'gi-uids';
  function recent() {
    try {
      const r = JSON.parse(localStorage.getItem(RECENT));
      if (!Array.isArray(r)) return [];
      return r
        .map((x) => (typeof x === 'string' ? { u: x } : x || {}))
        .filter((x) => /^\d{9,10}$/.test(x.u))
        .map((x) => ({ u: x.u, n: typeof x.n === 'string' ? x.n.slice(0, 40) : '', p: typeof x.p === 'string' && x.p.startsWith(UI) ? x.p : '' }));
    } catch (e) {
      return [];
    }
  }
  function remember(u, n, p) {
    try {
      localStorage.setItem(RECENT, JSON.stringify([{ u, n, p }, ...recent().filter((x) => x.u !== u)].slice(0, 6)));
    } catch (e) {}
  }

  // ---- no UID: the search = the profile card with nobody in it yet ----
  if (!raw) {
    $('gpHome').hidden = false;
    $('gpBlankStats').innerHTML = STATS.map(([i, k]) => `<li>${ico(i)}<b>&ndash;</b><span>${k}</span></li>`).join('');
    $('gpBlankBadges').innerHTML = medals({}, true);
    const form = $('gpLook');
    lookup(form);
    // The server box lights the row the typed UID belongs to.
    const input = form.querySelector('input');
    const rows = [...document.querySelectorAll('.gp-srv li')];
    input.addEventListener('input', () => {
      const s = input.value ? uidServer(input.value) : '';
      rows.forEach((li) => li.classList.toggle('is-on', li.dataset.s === s));
    });
    const r = recent();
    if (r.length) {
      $('gpRecent').hidden = false;
      $('gpRecentList').innerHTML = r
        .map(({ u, n, p }) => {
          const server = uidServer(u);
          return `<a class="gi-tab gp-ch" href="${playerHref(u)}"><span class="gi-tile${p ? ' r5' : ''}">${p ? `<img src="${esc(p)}" alt="" loading="lazy" decoding="async">` : '<i class="gp-q">?</i>'}</span>
            <span class="gp-ch-t"><b>${esc(n || 'UID ' + u)}</b><small>${n ? u : ''}${n && server ? ' &middot; ' : ''}${esc(server)}</small></span></a>`;
        })
        .join('');
      $('gpRecentClear').onclick = () => {
        try {
          localStorage.removeItem(RECENT);
        } catch (e) {}
        $('gpRecent').hidden = true;
      };
    }
    return;
  }

  // ---- a UID: the player ----
  $('gpPlayer').hidden = false;
  const card = $('gpCard');
  // The profile link Link copies (with the picked character's #hash). The key is redrawn with the card.
  let shareHash = location.hash;
  const share = (hash) => {
    shareHash = hash || '';
    if ($('gpShare')) $('gpShare').dataset.copy = location.origin + playerHref(uid) + shareHash;
  };

  // The UID on the card IS the search (Oct 23 2026, Adrian): at rest it reads "UID 800123456" (the
  // UID is the field's placeholder); type another and Enter looks it up. Replaced the bar under the card.
  const SEARCH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>';
  const finder = (ph, server) => `<form class="gp-find" id="gpAgain" autocomplete="off" novalidate title="Type another UID to look it up">
      <label class="gp-find-box"><span class="gp-find-k">UID</span>
        <input type="text" inputmode="numeric" maxlength="10" placeholder="${esc(ph)}" aria-label="${uid ? 'UID ' + uid + '. Type another UID to look it up' : 'Look up a UID'}" spellcheck="false">
        <span class="gi-uid-server" data-own="${esc(server)}">${esc(server)}</span>
        <button type="submit" class="gp-find-go" aria-label="Look up this UID">${SEARCH_SVG}</button></label></form>`;
  function wireFind() {
    const form = $('gpAgain');
    lookup(form);
    // lookup() shows the TYPED UID's server; with nothing typed, the player's own stays.
    const input = form.querySelector('input');
    const chip = form.querySelector('.gi-uid-server');
    const own = () => !input.value && (chip.textContent = chip.dataset.own);
    input.addEventListener('input', own);
    own();
  }

  const ERR = {
    badUid: ["That isn't a UID", 'A UID is 9 or 10 digits, like 800123456. It sits in the bottom right of the Paimon Menu.'],
    notFound: ['No player with this UID', `Enka.Network has no player ${uid}. Check the number and try again.`],
    maintenance: ['Genshin is under maintenance', 'Profiles come back with the game servers. Try again once the maintenance is over.'],
    busy: ['Too many lookups right now', 'Enka.Network is busy. Try again in a minute.'],
    enka5xx: ["Enka.Network isn't answering", 'Their side is having trouble. Try again in a few minutes.'],
    unreachable: ["Couldn't reach the lookup", 'Check your connection and try again.'],
  };
  function fail(code) {
    const [t, p] = ERR[code] || ERR.unreachable;
    const retry = code !== 'badUid' && code !== 'notFound';
    card.className = 'gi-box gp-card gp-msg';
    card.innerHTML = `<div><p class="gi-eyebrow">UID ${esc(raw)}</p><h1 class="gp-msg-t">${esc(t)}</h1><p>${esc(p)}</p>
      <div class="gp-uid">${finder('Another UID', '')}<p class="gi-look-status gp-find-st" aria-live="polite"></p></div></div>${retry ? '<button type="button" class="gi-key gi-key--red" id="gpRetry">Try again</button>' : ''}`;
    wireFind();
    if (retry) $('gpRetry').onclick = load;
    $('showcase').hidden = $('gpRoster').hidden = $('gpNamecards').hidden = true;
  }
  if (!uid) return fail('badUid');

  const mapP = fetch('/genshin-enka-map.json').then((r) => (r.ok ? r.json() : Promise.reject('unreachable')));
  let map = null;
  let nick = 'Traveler';

  // Enka asks clients not to re-ask a UID inside its ttl; the CDN holds it that long
  // anyway, so Refresh waits it out.
  let ttlTimer = 0;
  function waitTtl(sec) {
    const btn = $('gpRefresh');
    const t = $('gpRefreshT');
    let left = Math.max(1, sec | 0);
    btn.disabled = true;
    btn.title = 'Enka.Network keeps a profile for a short while: Refresh opens up when it can fetch a new one';
    clearInterval(ttlTimer);
    const step = () => {
      if (left <= 0) {
        clearInterval(ttlTimer);
        btn.disabled = false;
        t.textContent = 'Refresh';
        btn.title = '';
        return;
      }
      t.textContent = `${left--}s`;
    };
    step();
    ttlTimer = setInterval(step, 1000);
  }

  function load() {
    card.className = 'gi-box gp-card is-loading';
    card.innerHTML =
      '<div class="gp-card-main"><span class="gp-face"></span><div class="gp-who"><span class="gp-skel"></span><span class="gp-skel gp-skel--s"></span></div></div><ul class="gp-stats"><li></li><li></li><li></li><li></li></ul>';
    const player = fetch(API + '?uid=' + uid).then(async (r) => {
      const d = await r.json().catch(() => ({ error: r.ok ? 'enka5xx' : 'unreachable' }));
      if (!r.ok || d.error) throw d.error || 'unreachable';
      return d;
    });
    Promise.all([player, mapP])
      .then(([d, m]) => {
        map = m;
        render(d);
        remember(uid, nick, pfp((d.playerInfo || {}).profilePicture));
        waitTtl(d.ttl || 60);
      })
      .catch((e) => fail(typeof e === 'string' ? e : 'unreachable'));
  }

  // ---- lookups into the map ----
  const char = (id, depot) => map.c[id + '-' + depot] || map.c[id] || { n: 'Unknown character', e: '', r: 4, i: '', s: [], si: [], k: [], wt: '' };
  const face = (c, costume) => (map.cos[costume] ? UI + 'UI_AvatarIcon_' + map.cos[costume] + '.png' : c.i ? UI + 'UI_AvatarIcon_' + c.i + '.png' : '');
  const art = (c, costume) => (map.cos[costume] ? UI + 'UI_Costume_' + map.cos[costume] + '.png' : c.i ? UI + 'UI_Gacha_AvatarImg_' + c.i + '.png' : '');
  const namecard = (id) => (map.nc[id] ? UI + map.nc[id] + '.png' : '');
  // Profile picture: newer profiles send a picture id (pfps), older ones a character.
  function pfp(pp) {
    if (!pp) return '';
    if (pp.id && map.pf[pp.id]) return UI + map.pf[pp.id] + '.png';
    return pp.avatarId ? face(char(pp.avatarId), pp.costumeId) : '';
  }
  const num = (v) => Number(v).toLocaleString('en-US');
  const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const stars = (r) => `<span class="gi-rarity" aria-label="${r} stars">${'&#9733;'.repeat(r)}</span>`;

  // ---- the profile card: the player's namecard, like the in-game friend card ----
  function render(d) {
    const p = d.playerInfo || {};
    nick = p.nickname || 'Traveler';
    document.title = `${nick} (${uid}) | Genshin player lookup | Parchrome`;
    const pic = pfp(p.profilePicture);
    // Only what the profile sends. towerStarIndex / theater* only exist on newer
    // profiles (not in Enka's docs yet), so each shows only when it's there.
    const star = (n) => (n ? ` <small>&#9733; ${num(n)}</small>` : '');
    const val = {
      ar: p.level != null && num(p.level),
      wl: p.worldLevel != null && num(p.worldLevel),
      ach: p.finishAchievementNum != null && num(p.finishAchievementNum),
      abyss: p.towerFloorIndex && `${p.towerFloorIndex}-${p.towerLevelIndex || 1}${star(p.towerStarIndex)}`,
      theater: p.theaterActIndex && `Act ${num(p.theaterActIndex)}${star(p.theaterStarIndex)}`,
      fr: p.fetterCount != null && num(p.fetterCount),
    };
    const stats = STATS.map(([i, k]) => [i, k, val[i]]).filter((s) => s[2]);
    const server = uidServer(uid);
    card.className = 'gi-box gp-card';
    card.innerHTML = `<div class="gp-card-art" aria-hidden="true"><img src="/images/genshin/art/teyvat-map.webp" alt="" decoding="async"></div>
      <span class="gp-frame" aria-hidden="true">${FRAME}</span>
      <div class="gp-card-main">
        <span class="gp-face">${pic ? `<img src="${esc(pic)}" alt="" decoding="async">` : ''}</span>
        <div class="gp-who">
          <h1 class="gp-name">${esc(nick)}</h1>
          <div class="gp-uid">${finder(uid, server)}
            <button type="button" class="gp-uid-copy" data-copy="${uid}" aria-label="Copy UID ${uid}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h11v11H9zM5 15H4V4h11v1"/></svg><span>Copy</span></button>
            <button type="button" class="gp-uid-copy" id="gpShare" data-copy="" aria-label="Copy the link to this profile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg><span>Link</span></button>
            <button type="button" class="gp-uid-copy" id="gpRefresh" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg><span id="gpRefreshT">Refresh</span></button>
            <p class="gi-look-status gp-find-st" aria-live="polite"></p></div>
          ${p.signature ? `<p class="gp-sig">${esc(p.signature)}</p>` : ''}
        </div>
        <ul class="gp-badges" aria-label="Milestones">${medals(p)}</ul>
      </div>
      <ul class="gp-stats">${stats.map(([i, k, v]) => `<li>${ico(i)}<b>${v}</b><span>${k}</span></li>`).join('')}</ul>`;
    wireFind();
    share(shareHash);
    $('gpRefresh').onclick = load;
    showcase(p.showAvatarInfoList || [], d.avatarInfoList || []);
    namecards(p.showNameCardIdList || [], p.nameCardId);
  }

  // ---- the namecards the player shows: name, type, the one in use first, a viewer ----
  const NC_TYPE = { bond: 'Friendship', achievement: 'Achievement', battlePass: 'Battle Pass', event: 'Event', reputation: 'Reputation', other: 'Other' };
  function namecards(ids, inUse) {
    const all = [...new Set([inUse, ...ids].filter((id) => map.nc[id]))];
    $('gpNamecards').hidden = !ids.length || !all.length;
    if ($('gpNamecards').hidden) return;
    const info = (id) => {
      const [n, t] = (map.ncn || {})[id] || ['Namecard', ''];
      return { n, t: NC_TYPE[t] || 'Namecard' };
    };
    const kinds = {};
    all.forEach((id) => (kinds[info(id).t] = (kinds[info(id).t] || 0) + 1));
    $('gpNcSub').textContent =
      `${all.length} namecard${all.length > 1 ? 's' : ''} on the profile: ` +
      Object.entries(kinds)
        .sort((x, y) => y[1] - x[1])
        .map(([t, n]) => `${n} ${t.toLowerCase()}`)
        .join(', ') +
      '. Pick one for its story.';
    $('gpNcList').innerHTML = all
      .map((id) => {
        const x = info(id);
        return `<li><button type="button" data-id="${id}" aria-label="${esc(x.n)}"><span class="gp-nc-art"><img src="${esc(namecard(id))}" alt="" loading="lazy" decoding="async">${id === inUse ? '<em>In use</em>' : ''}</span>
          <span class="gp-nc-cap"><b>${esc(x.n)}</b><small>${esc(x.t)}</small></span></button></li>`;
      })
      .join('');
    const dlg = $('gpNcDlg');
    $('gpNcList').onclick = (e) => {
      const b = e.target.closest('button[data-id]');
      if (!b) return;
      const id = +b.dataset.id;
      const x = info(id);
      $('gpDlgImg').src = namecard(id);
      $('gpDlgT').textContent = x.n;
      $('gpDlgT').dataset.id = id;
      $('gpDlgType').textContent = x.t + (id === inUse ? ' · In use' : '');
      $('gpDlgSrc').textContent = $('gpDlgDesc').textContent = '';
      dlg.showModal();
      // The in-game text and where it comes from: yatta (CORS open), only when opened; quiet on failure.
      fetch('https://gi.yatta.moe/api/v2/en/namecard/' + id)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(({ data }) => {
          if (+$('gpDlgT').dataset.id !== id || !data) return;
          $('gpDlgSrc').textContent = data.source || '';
          $('gpDlgDesc').textContent = (data.description || '').replace(/\\n/g, '\n').replace(/^Namecard style\.\s*/, '');
        })
        .catch(() => {});
    };
    // A click on the dim backdrop (the dialog itself, outside its box) closes it.
    dlg.onclick = (e) => e.target === dlg && dlg.close();
  }

  // ---- the showcase: a tray of characters, the picked one's build under it ----
  function showcase(shown, details) {
    const sec = $('showcase');
    sec.hidden = false;
    const byId = {};
    details.forEach((a) => (byId[a.avatarId] = a));
    // A showcase list can lag the details, so take the characters from both.
    const list = (shown.length ? shown.map((s) => ({ s, a: byId[s.avatarId] })) : details.map((a) => ({ s: { avatarId: a.avatarId }, a }))).map((x) => ({
      ...x,
      d: x.a ? info(x.a, x.s) : null,
      c: char(x.s.avatarId, x.a && x.a.skillDepotId),
    }));
    const tray = $('gpChars');
    roster(list);
    if (!list.length) {
      tray.hidden = true;
      $('gpShowSub').textContent = "This player isn't showing any characters yet.";
      $('gpBuild').innerHTML = `<div class="gi-box gp-noshow">
        <div class="gp-noshow-art" aria-hidden="true"><img class="gp-noshow-paimon" src="/images/genshin/sticker/paimon-sad.webp" alt="" loading="lazy" decoding="async"><div class="gp-ghosts">${'<span></span>'.repeat(4)}</div><div class="gp-switch"><span>Show Character Details</span><i></i></div></div>
        <div class="gp-noshow-copy"><p class="gi-eyebrow">Showcase empty</p><h3>Nothing on show yet</h3>
          <p>Builds come from the Character Showcase on the player's in-game profile. This one is empty, so there's nothing to read.</p>
          <ol><li><span>Open the Paimon Menu and select your profile.</span></li><li><span>Add characters to the Character Showcase.</span></li><li><span>Turn on <b>Show Character Details</b> so their builds show here.</span></li><li><span>Come back in a few minutes and press Refresh.</span></li></ol></div></div>`;
      return;
    }
    tray.hidden = false;
    $('gpShowSub').textContent = details.length
      ? `${list.length} character${list.length > 1 ? 's' : ''} on show. Pick one for the full build.`
      : 'This player shows characters but keeps builds hidden.';
    tray.innerHTML = list
      .map(({ s, a, c, d }, i) => {
        const lv = d ? d.lv : s.level;
        const el = c.e ? `<img class="gp-ch-el" src="${elIcon(c.e.toLowerCase())}" alt="">` : '';
        return `<button type="button" class="gi-tab gp-ch" role="tab" data-i="${i}" aria-label="${esc(c.n)}" style="--gi-el:${EL[c.e] || NEUTRAL}">
          <span class="gi-tile r${c.r}"><img src="${esc(face(c, s.costumeId || (a && a.costumeId)))}" alt="" loading="lazy" decoding="async">${el}</span>
          <span class="gp-ch-t"><b>${esc(c.n)}</b><small>${lv ? 'Lv ' + num(lv) : ''}${d ? ' &middot; C' + d.cons : ''}</small></span></button>`;
      })
      .join('');
    const tabs = [...tray.querySelectorAll('.gp-ch')];
    let cur = -1;
    const pick = (i, focus) => {
      if (i === cur) return;
      cur = i;
      tabs.forEach((b, j) => {
        b.classList.toggle('active', j === i);
        b.setAttribute('aria-selected', j === i);
        b.tabIndex = j === i ? 0 : -1;
      });
      if (focus) tabs[i].focus({ preventScroll: true });
      // Scroll the tray sideways only: scrollIntoView would also scroll the page (on load it
      // jumped past the profile card on short screens).
      const t = tabs[i];
      if (t.offsetLeft < tray.scrollLeft || t.offsetLeft + t.offsetWidth > tray.scrollLeft + tray.clientWidth)
        tray.scrollLeft = t.offsetLeft - (tray.clientWidth - t.offsetWidth) / 2;
      const x = list[i];
      stopMove();
      showcase.cur = x;
      $('gpBuild').innerHTML = x.d ? build(x) : hidden(x);
      $('gpCardBar').hidden = !x.d;
      say('');
      paint();
      syncStudio();
      // The picked character goes in the address, so Copy (and a reload) keeps it.
      const hash = i ? '#' + slug(x.c.n) : '';
      history.replaceState(null, '', location.pathname + location.search + hash);
      share(hash);
    };
    tray.onclick = (e) => {
      const b = e.target.closest('.gp-ch');
      if (b) pick(+b.dataset.i);
    };
    // Arrow keys move along the tray, like any tab list.
    tray.onkeydown = (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      pick((cur + step + list.length) % list.length, true);
    };
    // The roster's rows pick a character too.
    showcase.pick = (i) => {
      pick(i);
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const want = location.hash.slice(1);
    pick(Math.max(0, list.findIndex((x) => slug(x.c.n) === want)));
  }

  function hidden({ s, c }) {
    return `<div class="gi-box gp-hidden"><span class="gi-tile r${c.r}"><img src="${esc(face(c, s.costumeId))}" alt=""></span><div><b>${esc(c.n)}${s.level ? ' &middot; Lv ' + num(s.level) : ''}</b><p>Builds are hidden. The player can show them by turning on "Show Character Details" in their in-game profile.</p></div></div>`;
  }

  // ---- one character's numbers (the build box and the roster both read these) ----
  const PROP = {
    FIGHT_PROP_HP: 'HP',
    FIGHT_PROP_HP_PERCENT: 'HP',
    FIGHT_PROP_ATTACK: 'ATK',
    FIGHT_PROP_ATTACK_PERCENT: 'ATK',
    FIGHT_PROP_DEFENSE: 'DEF',
    FIGHT_PROP_DEFENSE_PERCENT: 'DEF',
    FIGHT_PROP_CRITICAL: 'CRIT Rate',
    FIGHT_PROP_CRITICAL_HURT: 'CRIT DMG',
    FIGHT_PROP_CHARGE_EFFICIENCY: 'Energy Recharge',
    FIGHT_PROP_ELEMENT_MASTERY: 'Elemental Mastery',
    FIGHT_PROP_HEAL_ADD: 'Healing Bonus',
    FIGHT_PROP_PHYSICAL_ADD_HURT: 'Physical DMG',
    FIGHT_PROP_FIRE_ADD_HURT: 'Pyro DMG',
    FIGHT_PROP_ELEC_ADD_HURT: 'Electro DMG',
    FIGHT_PROP_WATER_ADD_HURT: 'Hydro DMG',
    FIGHT_PROP_GRASS_ADD_HURT: 'Dendro DMG',
    FIGHT_PROP_WIND_ADD_HURT: 'Anemo DMG',
    FIGHT_PROP_ROCK_ADD_HURT: 'Geo DMG',
    FIGHT_PROP_ICE_ADD_HURT: 'Cryo DMG',
    FIGHT_PROP_BASE_ATTACK: 'Base ATK',
  };
  const FLAT = ['FIGHT_PROP_HP', 'FIGHT_PROP_ATTACK', 'FIGHT_PROP_DEFENSE', 'FIGHT_PROP_ELEMENT_MASTERY', 'FIGHT_PROP_BASE_ATTACK'];
  // Artifact rows are narrow: the long names get the game's short ones.
  const SHORT = { 'Elemental Mastery': 'EM', 'Energy Recharge': 'ER' };
  // A substat's rolls: every id in reliquary.appendPropIdList is one roll, and
  // (id % 1000) / 10 is its stat (checked against real pieces: 20 CRIT Rate = 4 rolls at 14.4%).
  const ROLL = {
    FIGHT_PROP_HP: 2,
    FIGHT_PROP_HP_PERCENT: 3,
    FIGHT_PROP_ATTACK: 5,
    FIGHT_PROP_ATTACK_PERCENT: 6,
    FIGHT_PROP_DEFENSE: 8,
    FIGHT_PROP_DEFENSE_PERCENT: 9,
    FIGHT_PROP_CRITICAL: 20,
    FIGHT_PROP_CRITICAL_HURT: 22,
    FIGHT_PROP_CHARGE_EFFICIENCY: 23,
    FIGHT_PROP_ELEMENT_MASTERY: 24,
  };
  const stat = (o, short) => {
    if (!o) return null;
    const id = o.appendPropId || o.mainPropId;
    const k = PROP[id] || 'Stat';
    return { id, k: (short && SHORT[k]) || k, v: FLAT.includes(id) ? num(Math.round(o.statValue)) : (+o.statValue).toFixed(1) + '%' };
  };
  // Final stats (fightPropMap ids, Enka's docs): [id, label, base id, percent].
  const FINAL = [
    [2000, 'Max HP', 1],
    [2001, 'ATK', 4],
    [2002, 'DEF', 7],
    [28, 'Elemental Mastery'],
    [20, 'CRIT Rate', 0, 1],
    [22, 'CRIT DMG', 0, 1],
    [23, 'Energy Recharge', 0, 1],
  ];
  const DMG = { 30: 'Physical', 40: 'Pyro', 41: 'Electro', 42: 'Hydro', 43: 'Dendro', 44: 'Anemo', 45: 'Geo', 46: 'Cryo' };
  const DMG_ID = { Physical: 30, Pyro: 40, Electro: 41, Hydro: 42, Dendro: 43, Anemo: 44, Geo: 45, Cryo: 46 };
  const SLOTS = ['EQUIP_BRACER', 'EQUIP_NECKLACE', 'EQUIP_SHOES', 'EQUIP_RING', 'EQUIP_DRESS'];
  const SLOT_NAME = ['Flower', 'Plume', 'Sands', 'Goblet', 'Circlet'];
  const TALENT = ['Normal Attack', 'Elemental Skill', 'Elemental Burst'];
  const CAP = [20, 40, 50, 60, 70, 80, 90]; // max level by ascension (characters and weapons)
  const pct = (v) => (v * 100).toFixed(1) + '%';

  function info(a, s) {
    const c = char(a.avatarId, a.skillDepotId);
    const pm = a.propMap || {};
    const fp = a.fightPropMap || {};
    const eq = a.equipList || [];
    const lv = +((pm[4001] && pm[4001].val) || s.level || 1);
    // Talents: base level + any constellation boost (keyed by the talent's proud id).
    const talents = (c.s || []).slice(0, 3).map(([sk, proud], i) => {
      const up = (a.proudSkillExtraLevelMap || {})[proud] || 0;
      return { name: TALENT[i], lv: ((a.skillLevelMap || {})[sk] || 1) + up, up, icon: c.si && c.si[i] ? UI + 'Skill_' + c.si[i] + '.png' : '' };
    });

    let wep = null;
    const w = eq.find((e) => e.weapon);
    if (w) {
      const f = w.flat || {};
      const promote = w.weapon.promoteLevel || 0;
      wep = {
        name: map.w[w.itemId] || 'Weapon',
        // From the second ascension on, the game shows the weapon's awakened picture.
        icon: f.icon ? UI + f.icon + (promote >= 2 ? '_Awaken' : '') + '.png' : '',
        r: f.rankLevel || 4,
        lv: w.weapon.level || 1,
        cap: CAP[promote] || 90,
        refine: w.weapon.affixMap ? Object.values(w.weapon.affixMap)[0] + 1 : 0,
        stats: (f.weaponStats || []).map((x) => stat(x)),
      };
    }

    // Artifacts: crit value = 2 x CRIT Rate + CRIT DMG from the substats.
    let cv = 0;
    let rolls = 0;
    let critRolls = 0;
    const sets = {};
    const pieces = SLOTS.map((slot) => {
      const e = eq.find((x) => x.reliquary && x.flat && x.flat.equipType === slot);
      if (!e) return null;
      const f = e.flat;
      sets[f.setId] = (sets[f.setId] || 0) + 1;
      const ids = e.reliquary.appendPropIdList || [];
      const subs = (f.reliquarySubstats || []).map((x) => ({
        ...stat(x, true),
        raw: +x.statValue,
        rolls: ids.filter((id) => Math.floor((id % 1000) / 10) === ROLL[x.appendPropId]).length,
        crit: x.appendPropId === 'FIGHT_PROP_CRITICAL' || x.appendPropId === 'FIGHT_PROP_CRITICAL_HURT',
      }));
      const pcv = (f.reliquarySubstats || []).reduce(
        (t, x) => t + (x.appendPropId === 'FIGHT_PROP_CRITICAL' ? 2 * x.statValue : x.appendPropId === 'FIGHT_PROP_CRITICAL_HURT' ? x.statValue : 0),
        0,
      );
      cv += pcv;
      subs.forEach((x) => {
        rolls += x.rolls;
        if (x.crit) critRolls += x.rolls;
      });
      return {
        icon: UI + f.icon + '.png',
        r: f.rankLevel || 4,
        lv: Math.max(0, (e.reliquary.level || 1) - 1),
        set: map.set[f.setId] || 'Set',
        main: stat(f.reliquaryMainstat),
        subs,
        cv: pcv,
      };
    });
    const setList = Object.entries(sets)
      .filter(([, n]) => n >= 2)
      .sort((x, y) => y[1] - x[1])
      .map(([id, n]) => ({ n: n >= 4 ? 4 : 2, name: map.set[id] || 'Set' }));

    // The biggest DMG bonus (the character's own element when it's a tie at 0).
    let best = DMG_ID[c.e] || 30;
    Object.keys(DMG).forEach((id) => {
      if ((fp[id] || 0) > (fp[best] || 0)) best = +id;
    });

    return {
      c,
      el: c.e,
      lv,
      cap: CAP[+((pm[1002] && pm[1002].val) || 0)] || 90,
      cons: (a.talentIdList || []).length,
      fr: a.fetterInfo && a.fetterInfo.expLevel,
      fp,
      best,
      talents,
      wep,
      pieces,
      sets: setList,
      cv,
      rolls,
      critRolls,
      costume: a.costumeId,
    };
  }

  // ---- the build card: the one people download and share ----
  // Enka-style (art | weapon + stats | artifacts) with Parchrome's own touches: the profile
  // banner's gold trim, the constellations joined like a star chart, the element's light behind
  // the art, a small Parchrome mark. Options (UID, username, roll counts, substat breakdown) are
  // classes on the card, so the page and the downloaded picture always match.

  // Stat icons, drawn after the game's (24-unit boxes; CRIT Rate is the outlined star).
  const SI = {
    hp: '<path d="M12 2.6c3.7 4.7 6.6 8.3 6.6 11.8a6.6 6.6 0 0 1-13.2 0c0-3.5 2.9-7.1 6.6-11.8z"/>',
    atk: '<path d="M20.8 2.2l1 1-1 4.4-8.7 8.7-3.4-3.4 8.7-8.7zM7.6 13.8l3 3-1.5 1.5 1.1 1.1-1.4 1.4-1.6-1.6-2.7 2.7-1.4-1.4 2.7-2.7-1.6-1.6 1.4-1.4 1.1 1.1z"/>',
    def: '<path d="M12 2.4l8 2.9v6.1c0 5-3.4 8.7-8 10.2-4.6-1.5-8-5.2-8-10.2V5.3z"/>',
    em: '<path d="M12 3.2a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6zM6.4 12.6a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6zM17.6 12.6a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6z"/>',
    cr: '<path d="M12 3.5l1.9 6.6 6.6 1.9-6.6 1.9-1.9 6.6-1.9-6.6L3.5 12l6.6-1.9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    cd: '<path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2-2.2 7.3-2.2-7.3L2.5 12l7.3-2.2z"/>',
    er: '<path d="M12 3.8a8.2 8.2 0 0 1 7.6 5.1h-2.4A6.2 6.2 0 0 0 6.9 9.6L9.2 12H3V5.8l2.3 2.3A8.2 8.2 0 0 1 12 3.8zM4.4 15.1h2.4a6.2 6.2 0 0 0 10.3.7L14.8 13.4H21v6.2l-2.3-2.3A8.2 8.2 0 0 1 4.4 15.1z"/>',
    heal: '<path d="M9.4 3h5.2v6.4H21v5.2h-6.4V21H9.4v-6.4H3V9.4h6.4z"/>',
    phys: '<path d="M12 2.5l2.6 6.9 6.9 2.6-6.9 2.6-2.6 6.9-2.6-6.9L2.5 12l6.9-2.6z"/>',
    fr: '<path d="M12 20.3s-7.6-4.6-7.6-10.2A4.1 4.1 0 0 1 12 7.8a4.1 4.1 0 0 1 7.6 2.3c0 5.6-7.6 10.2-7.6 10.2z"/>',
    set: '<path d="M12 2.8c1.8 2.2 1.8 4.6 0 6.7-1.8-2.1-1.8-4.5 0-6.7zm0 11.7c1.8 2.1 1.8 4.5 0 6.7-1.8-2.2-1.8-4.6 0-6.7zM2.8 12c2.2-1.8 4.6-1.8 6.7 0-2.1 1.8-4.5 1.8-6.7 0zm11.7 0c2.1-1.8 4.5-1.8 6.7 0-2.2 1.8-4.6 1.8-6.7 0zM12 9.8a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z"/>',
    lock: '<path d="M7.5 10V7.8a4.5 4.5 0 0 1 9 0V10h1.2v10.5H6.3V10zm2.2 0h4.6V7.8a2.3 2.3 0 0 0-4.6 0z"/>',
  };
  const PICON = {
    FIGHT_PROP_HP: 'hp',
    FIGHT_PROP_HP_PERCENT: 'hp',
    FIGHT_PROP_ATTACK: 'atk',
    FIGHT_PROP_ATTACK_PERCENT: 'atk',
    FIGHT_PROP_BASE_ATTACK: 'atk',
    FIGHT_PROP_DEFENSE: 'def',
    FIGHT_PROP_DEFENSE_PERCENT: 'def',
    FIGHT_PROP_ELEMENT_MASTERY: 'em',
    FIGHT_PROP_CRITICAL: 'cr',
    FIGHT_PROP_CRITICAL_HURT: 'cd',
    FIGHT_PROP_CHARGE_EFFICIENCY: 'er',
    FIGHT_PROP_HEAL_ADD: 'heal',
    FIGHT_PROP_PHYSICAL_ADD_HURT: 'phys',
  };
  const PEL = {
    FIGHT_PROP_FIRE_ADD_HURT: 'Pyro',
    FIGHT_PROP_ELEC_ADD_HURT: 'Electro',
    FIGHT_PROP_WATER_ADD_HURT: 'Hydro',
    FIGHT_PROP_GRASS_ADD_HURT: 'Dendro',
    FIGHT_PROP_WIND_ADD_HURT: 'Anemo',
    FIGHT_PROP_ROCK_ADD_HURT: 'Geo',
    FIGHT_PROP_ICE_ADD_HURT: 'Cryo',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${SI[k]}</svg>`;
  // A stat's icon: the element emblem for elemental DMG, a small "%" on the percent kinds.
  function sicon(id) {
    if (PEL[id]) return `<span class="gp-si"><img src="${elIcon(PEL[id].toLowerCase())}" alt=""></span>`;
    const pct = /_PERCENT$/.test(id) ? ' is-pct' : '';
    return `<span class="gp-si${pct}">${svg(PICON[id] || 'cd')}</span>`;
  }
  // Final stats rows: fightPropMap id -> the matching substat id (for its icon).
  const FINAL_ICON = { 2000: 'FIGHT_PROP_HP', 2001: 'FIGHT_PROP_ATTACK', 2002: 'FIGHT_PROP_DEFENSE', 28: 'FIGHT_PROP_ELEMENT_MASTERY', 20: 'FIGHT_PROP_CRITICAL', 22: 'FIGHT_PROP_CRITICAL_HURT', 23: 'FIGHT_PROP_CHARGE_EFFICIENCY' };
  const DMG_ICON = { 30: 'FIGHT_PROP_PHYSICAL_ADD_HURT', 40: 'FIGHT_PROP_FIRE_ADD_HURT', 41: 'FIGHT_PROP_ELEC_ADD_HURT', 42: 'FIGHT_PROP_WATER_ADD_HURT', 43: 'FIGHT_PROP_GRASS_ADD_HURT', 44: 'FIGHT_PROP_WIND_ADD_HURT', 45: 'FIGHT_PROP_ROCK_ADD_HURT', 46: 'FIGHT_PROP_ICE_ADD_HURT' };
  // A 5-star substat's biggest single roll (handoff section 10), for "average roll" in the breakdown.
  const MAXROLL = {
    FIGHT_PROP_HP: 298.75,
    FIGHT_PROP_HP_PERCENT: 5.83,
    FIGHT_PROP_ATTACK: 19.45,
    FIGHT_PROP_ATTACK_PERCENT: 5.83,
    FIGHT_PROP_DEFENSE: 23.15,
    FIGHT_PROP_DEFENSE_PERCENT: 7.29,
    FIGHT_PROP_CRITICAL: 3.89,
    FIGHT_PROP_CRITICAL_HURT: 7.77,
    FIGHT_PROP_CHARGE_EFFICIENCY: 6.48,
    FIGHT_PROP_ELEMENT_MASTERY: 23.31,
  };

  // ---- card options: remembered in this browser (a convenience, so try/catch) ----
  const OPTS_KEY = 'gi-card-opts';
  // text = the caption on the art, ada = colour from the art instead of the element.
  const opts = { uid: true, name: true, rolls: false, brk: false, port: false, text: '', ada: false };
  try {
    // Roll counts + Substat breakdown start off on every visit (Adrian): not restored from last time.
    const { rolls, brk, ...kept } = JSON.parse(localStorage.getItem(OPTS_KEY)) || {};
    Object.assign(opts, kept);
  } catch (e) {}
  const optCls = () => ['uid', 'name', 'rolls', 'brk'].map((k) => (opts[k] ? '' : ' no-' + k)).join('') + (opts.port ? ' is-portrait' : '');
  const bar = $('gpCardBar');
  const saveOpts = () => {
    try {
      localStorage.setItem(OPTS_KEY, JSON.stringify(opts));
    } catch (e) {}
    const el = $('gpBuild').querySelector('.gp-build');
    if (el) el.className = 'gp-build' + optCls() + (mover ? ' is-moving' : '');
    paint();
    syncStudio();
  };
  // Card shape: Landscape (Enka's wide card) or Portrait (a tall card for phones and stories).
  const shapes = [...bar.querySelectorAll('[data-shape]')];
  const syncShape = () =>
    shapes.forEach((b) => {
      const on = (b.dataset.shape === 'port') === opts.port;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on);
    });
  syncShape();
  shapes.forEach(
    (b) =>
      (b.onclick = () => {
        opts.port = b.dataset.shape === 'port';
        syncShape();
        saveOpts();
      }),
  );
  bar.querySelectorAll('[data-opt]').forEach((b) => {
    const k = b.dataset.opt;
    const sync = () => {
      b.classList.toggle('active', opts[k]);
      b.setAttribute('aria-pressed', opts[k]);
    };
    sync();
    b.onclick = () => {
      opts[k] = !opts[k];
      sync();
      saveOpts();
    };
  });
  bar.querySelectorAll('[data-ada]').forEach(
    (b) =>
      (b.onclick = () => {
        opts.ada = b.dataset.ada === '1';
        saveOpts();
      }),
  );
  $('gpCaption').oninput = (e) => {
    opts.text = e.target.value;
    saveOpts();
  };

  // ---- CARD STUDIO: the player's own picture, where it sits, its artist, the colour ----
  // Enka.Network has these tools in one unlabelled strip; here they're three labelled groups under
  // the card. Per character in localStorage `gi-card-art` = {avatarId: {l, p, cr}}: l / p = where the
  // picture sits in the landscape / portrait card ({x, y} = translate in % of the picture's own box,
  // z = zoom), cr = artist credit. An uploaded picture is its own key, `gi-card-img:<avatarId>` (a
  // data URL shrunk to 1600px), so one big picture can't push the positions out of storage.
  const ART_KEY = 'gi-card-art';
  const IMG_KEY = 'gi-card-img:';
  let arts = {};
  try {
    arts = JSON.parse(localStorage.getItem(ART_KEY)) || {};
  } catch (e) {}
  const store = (k, v) => {
    try {
      v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
      return true;
    } catch (e) {
      return false;
    }
  };
  const imgs = {}; // avatarId -> the uploaded picture's data URL ('' = none), read once
  const mine = (id) => {
    if (!(id in imgs)) {
      try {
        imgs[id] = localStorage.getItem(IMG_KEY + id) || '';
      } catch (e) {
        imgs[id] = '';
      }
    }
    return imgs[id];
  };
  const curId = () => String(showcase.cur.s.avatarId);
  const shapeKey = () => (opts.port ? 'p' : 'l');
  const pos = () => ((arts[curId()] || {})[shapeKey()] || { x: 0, y: 0, z: 1 });
  const setArt = (patch) => {
    const id = curId();
    arts[id] = { ...arts[id], ...patch };
    store(ART_KEY, JSON.stringify(arts));
  };
  const buildEl = () => $('gpBuild').querySelector('.gp-build');
  const say = (t) => {
    $('gpArtHint').textContent = t;
    $('gpArtHint').classList.toggle('is-warn', !!t);
  };

  // Colour from the art: the most common vivid hue (24 bins, each pixel weighted by saturation² x
  // brightness, so a big grey sky can't win), that bin's average colour, then held in a range that
  // reads on the dark card. A separate CORS image, so a failed read can't break the card's own art.
  const tints = {};
  const tint = (src) =>
    tints[src] ||
    (tints[src] = new Promise((ok) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onerror = () => ok('');
      im.onload = () => {
        try {
          const N = 48;
          const g = Object.assign(document.createElement('canvas'), { width: N, height: N }).getContext('2d');
          g.drawImage(im, 0, 0, N, N);
          const px = g.getImageData(0, 0, N, N).data;
          const bins = Array.from({ length: 24 }, () => [0, 0, 0, 0]);
          for (let i = 0; i < px.length; i += 4) {
            const [r, gr, b, a] = px.slice(i, i + 4);
            const mx = Math.max(r, gr, b);
            const d = mx - Math.min(r, gr, b);
            if (a < 128 || !d || mx < 40) continue;
            const h = mx === r ? ((gr - b) / d + 6) % 6 : mx === gr ? (b - r) / d + 2 : (r - gr) / d + 4;
            const w = (d / mx) ** 2 * (mx / 255);
            const bin = bins[Math.floor(h * 4) % 24];
            bin[0] += r * w;
            bin[1] += gr * w;
            bin[2] += b * w;
            bin[3] += w;
          }
          const best = bins.reduce((x, y) => (y[3] > x[3] ? y : x));
          if (best[3] < 2) return ok(''); // a grey picture: keep the element's colour
          const [r, gr, b] = best.slice(0, 3).map((v) => v / best[3] / 255);
          const mx = Math.max(r, gr, b);
          const mn = Math.min(r, gr, b);
          const d = mx - mn;
          const l = (mx + mn) / 2;
          const s = d / (1 - Math.abs(2 * l - 1) || 1);
          const h = 60 * (mx === r ? ((gr - b) / d + 6) % 6 : mx === gr ? (b - r) / d + 2 : (r - gr) / d + 4);
          const clamp = (v, lo, hi) => Math.round(Math.min(hi, Math.max(lo, v * 100)));
          ok(`hsl(${Math.round(h)} ${clamp(s, 35, 75)}% ${clamp(l, 48, 62)}%)`);
        } catch (e) {
          ok('');
        }
      };
      im.src = src;
    }));

  // Puts the studio's state on the card that's showing: picture position, caption, credit, colour.
  function paint() {
    const el = buildEl();
    if (!el) return;
    const p = pos();
    const im = el.querySelector('.gp-art img');
    im.style.translate = `${p.x}% ${p.y}%`;
    im.style.scale = p.z;
    el.querySelector('.gp-cap').textContent = opts.text.trim();
    const cr = mine(curId()) && (arts[curId()] || {}).cr;
    el.querySelector('.gp-credit').textContent = cr ? 'Art: ' + cr : '';
    el.style.setProperty('--gi-el', el.dataset.el);
    if (opts.ada) tint(im.src).then((c) => c && opts.ada && el.style.setProperty('--gi-el', c));
  }

  // The studio's controls follow the character that's showing.
  function syncStudio() {
    if (!showcase.cur || !buildEl()) return;
    const id = curId();
    const own = mine(id);
    const p = pos();
    $('gpArtThumb').style.backgroundImage = `url("${own || buildEl().querySelector('.gp-art img').src}")`;
    $('gpArtSrc').textContent = own ? 'Your picture' : 'Official wish art';
    bar.style.setProperty('--gp-el-dot', buildEl().dataset.el);
    if (!$('gpArtHint').classList.contains('is-warn'))
      $('gpArtHint').textContent = own ? (mover ? 'Drag it on the card.' : 'Only on this browser.') : 'Upload, drop or paste your own.';
    $('gpArtDel').hidden = !own;
    $('gpCreditRow').hidden = !own;
    $('gpCredit').value = (arts[id] || {}).cr || '';
    $('gpCaption').value = opts.text;
    $('gpArtReset').disabled = !p.x && !p.y && p.z === 1;
    $('gpZoom').value = Math.round(p.z * 100);
    $('gpZoomV').textContent = Math.round(p.z * 100) + '%';
    bar.querySelectorAll('[data-ada]').forEach((b) => {
      const on = (b.dataset.ada === '1') === opts.ada;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on);
    });
  }

  // A new or removed picture redraws the card (without its entrance animation).
  function rerender() {
    stopMove();
    $('gpBuild').innerHTML = build(showcase.cur);
    buildEl().style.animation = 'none';
    paint();
    syncStudio();
  }

  // Move: a layer over the art takes the drag (mouse, finger, pen), the wheel zooms, arrow keys
  // nudge (Shift = 5x), +/- zoom, Esc or Enter ends it. Saved when the hand lets go.
  let mover = null;
  function place(p) {
    const c = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    p = { x: +c(p.x, -100, 100).toFixed(2), y: +c(p.y, -100, 100).toFixed(2), z: +c(p.z, 0.5, 3).toFixed(3) };
    setArt({ [shapeKey()]: p });
    paint();
    syncStudio();
  }
  function stopMove() {
    if (!mover) return;
    mover.remove();
    mover = null;
    if (buildEl()) buildEl().classList.remove('is-moving');
    $('gpArtMove').classList.remove('is-done');
    $('gpArtMove').setAttribute('aria-pressed', 'false');
    $('gpArtMove').querySelector('span').textContent = 'Move';
    $('gpZoomRow').hidden = true;
    syncStudio();
  }
  function startMove() {
    const el = buildEl();
    if (!el) return;
    el.classList.add('is-moving');
    mover = document.createElement('div');
    mover.className = 'gp-mover';
    mover.tabIndex = 0;
    mover.setAttribute('role', 'application');
    mover.setAttribute('aria-label', 'Move the picture: drag it or use the arrow keys, plus and minus to zoom, Enter when done');
    mover.innerHTML = '<span>Drag to move &middot; scroll to zoom</span>';
    el.querySelector('.gp-hero').appendChild(mover);
    const im = el.querySelector('.gp-art img');
    let from = null;
    mover.onpointerdown = (e) => {
      mover.setPointerCapture(e.pointerId);
      from = { cx: e.clientX, cy: e.clientY, ...pos() };
    };
    mover.onpointermove = (e) => {
      if (!from) return;
      // translate % is of the picture's own (unscaled) box, and it's applied outside the zoom.
      place({ ...from, x: from.x + ((e.clientX - from.cx) / im.offsetWidth) * 100, y: from.y + ((e.clientY - from.cy) / im.offsetHeight) * 100 });
    };
    mover.onpointerup = mover.onpointercancel = () => (from = null);
    mover.onwheel = (e) => {
      e.preventDefault();
      const p = pos();
      place({ ...p, z: p.z * Math.exp(-e.deltaY * 0.0012) });
    };
    mover.onkeydown = (e) => {
      const p = pos();
      const k = e.shiftKey ? 5 : 1;
      const step = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, -k], ArrowDown: [0, k] }[e.key];
      if (step) place({ ...p, x: p.x + step[0], y: p.y + step[1] });
      else if (e.key === '+' || e.key === '=') place({ ...p, z: p.z * 1.05 });
      else if (e.key === '-') place({ ...p, z: p.z / 1.05 });
      else if (e.key === 'Escape' || e.key === 'Enter') stopMove(), $('gpArtMove').focus();
      else return;
      e.preventDefault();
    };
    $('gpArtMove').classList.add('is-done');
    $('gpArtMove').setAttribute('aria-pressed', 'true');
    $('gpArtMove').querySelector('span').textContent = 'Done';
    $('gpZoomRow').hidden = false;
    mover.focus({ preventScroll: true });
    syncStudio();
  }
  $('gpArtMove').onclick = () => (mover ? stopMove() : startMove());
  $('gpZoom').oninput = (e) => place({ ...pos(), z: e.target.value / 100 });
  $('gpArtReset').onclick = () => {
    setArt({ [shapeKey()]: undefined });
    paint();
    syncStudio();
  };

  // Your own picture: Upload, a file dropped on the card or the studio, or pasted (Ctrl+V).
  // Shrunk to 1600px on its long side and kept as WebP (JPEG where the browser can't write WebP).
  async function upload(f) {
    if (!f || !/^image\//.test(f.type)) return say("That file isn't a picture.");
    say('');
    $('gpArtHint').textContent = 'Loading the picture…';
    try {
      const bmp = await createImageBitmap(f);
      const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const cv = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      let url = cv.toDataURL('image/webp', 0.86);
      // ponytail: Safari can't write WebP, so there a transparent cut-out gets a black ground.
      if (!url.startsWith('data:image/webp')) url = cv.toDataURL('image/jpeg', 0.88);
      const id = curId();
      imgs[id] = url;
      const kept = store(IMG_KEY + id, url);
      setArt({ l: undefined, p: undefined }); // a new picture starts centred
      rerender();
      say(kept ? '' : "This browser's storage is full: the picture stays until you leave the page.");
    } catch (e) {
      say("Couldn't read that picture. Try a PNG, JPG or WebP.");
    }
  }
  $('gpArtUp').onclick = () => $('gpArtFile').click();
  $('gpArtFile').onchange = (e) => {
    upload(e.target.files[0]);
    e.target.value = '';
  };
  $('gpArtDel').onclick = () => {
    const id = curId();
    imgs[id] = '';
    store(IMG_KEY + id, null);
    setArt({ l: undefined, p: undefined, cr: undefined });
    say('');
    rerender();
  };
  $('gpCredit').oninput = (e) => {
    setArt({ cr: e.target.value.trim() || undefined });
    paint();
  };
  [$('gpBuild'), bar].forEach((zone) => {
    zone.ondragover = (e) => {
      if (bar.hidden || ![...e.dataTransfer.types].includes('Files')) return;
      e.preventDefault();
      $('gpBuild').classList.add('is-drop');
    };
    zone.ondragleave = () => $('gpBuild').classList.remove('is-drop');
    zone.ondrop = (e) => {
      $('gpBuild').classList.remove('is-drop');
      if (bar.hidden || !e.dataTransfer.files.length) return;
      e.preventDefault();
      upload(e.dataTransfer.files[0]);
    };
  });
  document.addEventListener('paste', (e) => {
    if (bar.hidden || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    const f = [...((e.clipboardData && e.clipboardData.files) || [])].find((x) => /^image\//.test(x.type));
    if (!f) return;
    e.preventDefault();
    upload(f);
  });

  function build({ s, d }) {
    const { c, el, fp } = d;
    const elc = EL[el] || NEUTRAL;

    // Constellations: six nodes down the art's left edge on a line, like a star chart; locked = padlock.
    const cons = (c.k || [])
      .map((k, i) => {
        const on = i < d.cons;
        return `<li class="${on ? 'is-on' : ''}" title="C${i + 1}${on ? '' : ' (locked)'}"><img src="${UI}UI_Talent_${esc(k)}.png" alt="" decoding="async">${on ? '' : svg('lock')}</li>`;
      })
      .join('');
    const talents = d.talents
      .map((t) => `<span class="gp-tal${t.up ? ' is-up' : ''}" title="${t.name}${t.up ? ' (+' + t.up + ' from constellations)' : ''}"><i>${t.icon ? `<img src="${esc(t.icon)}" alt="" decoding="async">` : ''}</i><b>${t.lv}</b></span>`)
      .join('');

    // Final stats: base in white, the bonus on top of it in the game's green.
    const rows = FINAL.map(([id, k, base, isPct]) => {
      const v = fp[id] || 0;
      const extra = base && fp[base] ? `<small>${num(Math.round(fp[base]))} <em>+${num(Math.round(v - fp[base]))}</em></small>` : '';
      return `<li>${sicon(FINAL_ICON[id])}<span>${k}</span><b>${isPct ? pct(v) : num(Math.round(v))}${extra}</b></li>`;
    });
    rows.push(`<li>${sicon(DMG_ICON[d.best])}<span>${DMG[d.best]} DMG Bonus</span><b>${pct(fp[d.best] || 0)}</b></li>`);
    if (fp[26] > 0) rows.push(`<li>${sicon('FIGHT_PROP_HEAL_ADD')}<span>Healing Bonus</span><b>${pct(fp[26])}</b></li>`);

    const w = d.wep;
    const weapon = w
      ? `<div class="gp-wep"><span class="gp-wep-ico r${w.r}"><img src="${esc(w.icon)}" alt="" decoding="async">${stars(w.r)}</span>
        <div class="gp-wep-who"><b>${esc(w.name)}</b>
          <p class="gp-chips">${w.stats.map((x) => `<span>${sicon(x.id)}${x.v}</span>`).join('')}</p>
          <p class="gp-chips">${w.refine ? `<span class="gp-r">R${w.refine}</span>` : ''}<span>Lv ${num(w.lv)}<small>/${w.cap}</small></span></p></div></div>`
      : '<div class="gp-wep gp-empty">No weapon data</div>';
    const sets = d.sets.length
      ? d.sets.map((x) => `<li><span class="gp-set-ico">${svg('set')}</span><span>${esc(x.name)}</span><b>${x.n}</b></li>`).join('')
      : '<li class="gp-noset"><span>No set bonus</span></li>';

    const arts = d.pieces
      .map((p, i) => {
        if (!p) return `<div class="gp-pc gp-empty"><small>No ${SLOT_NAME[i].toLowerCase()}</small></div>`;
        const subs = p.subs
          .map(
            (x) =>
              `<li class="${x.crit ? 'is-crit' : ''}">${sicon(x.id)}<b>+${x.v}</b><i class="gp-rolls" title="${x.rolls} roll${x.rolls === 1 ? '' : 's'}">${'<i></i>'.repeat(Math.min(x.rolls, 6))}</i></li>`,
          )
          .join('');
        return `<div class="gp-pc"><div class="gp-pc-art"><img src="${esc(p.icon)}" alt="${SLOT_NAME[i]}" title="${esc(p.set)}" decoding="async"></div>
          <div class="gp-pc-main">${p.main ? sicon(p.main.id) : ''}<b>${p.main ? p.main.v : ''}</b><span class="gp-pc-foot">${stars(p.r)}<i>+${p.lv}</i></span></div>
          <ul class="gp-pc-subs">${subs}</ul><small class="gp-pc-cv">CV ${p.cv.toFixed(1)}</small></div>`;
      })
      .join('');

    // Substat breakdown: every substat kind across the five pieces, most rolls first.
    const tot = {};
    d.pieces.forEach((p) =>
      (p ? p.subs : []).forEach((x) => {
        const t = (tot[x.id] = tot[x.id] || { id: x.id, v: 0, n: 0, five: p.r === 5 });
        t.v += x.raw;
        t.n += x.rolls;
        t.five = t.five && p.r === 5;
      }),
    );
    const brk = Object.values(tot)
      .sort((a, b) => b.n - a.n || b.v - a.v)
      .map((t) => {
        const flat = FLAT.includes(t.id);
        const q = t.five && MAXROLL[t.id] && t.n ? Math.round((t.v / MAXROLL[t.id] / t.n) * 100) : 0;
        return `<li>${sicon(t.id)}<b>${flat ? num(Math.round(t.v)) : t.v.toFixed(1) + '%'}</b><small>${t.n} roll${t.n === 1 ? '' : 's'}${q ? ` &middot; avg ${q}%` : ''}</small></li>`;
      })
      .join('');

    return `<article class="gp-build${optCls()}" style="--gi-el:${elc}" data-el="${elc}">
      <span class="gp-frame" aria-hidden="true">${FRAME}</span>
      <div class="gp-hero">
        <div class="gp-art" aria-hidden="true"><img src="${esc(mine(String(s.avatarId)) || art(c, s.costumeId || d.costume))}"${mine(String(s.avatarId)) ? ' class="is-own"' : ''} alt="" decoding="async"></div>
        <div class="gp-b-head">
          <h3 class="gp-b-name">${esc(c.n)}<span class="gp-owner">${esc(nick)}</span></h3>
          <p class="gp-b-meta"><span>Lv <b>${d.lv}</b><small>/${d.cap}</small></span>${d.fr ? `<span class="gp-fr">${svg('fr')}<b>${d.fr}</b></span>` : ''}<span><b>C${d.cons}</b></span></p>
          <p class="gp-b-el">${el ? `<img src="${elIcon(el.toLowerCase())}" alt="">${el}` : ''}${c.wt ? `<span>${esc(c.wt)}</span>` : ''}${stars(c.r)}</p>
        </div>
        ${cons ? `<ol class="gp-cons" aria-label="Constellation ${d.cons} of 6">${cons}</ol>` : ''}
        <div class="gp-talents" aria-label="Talent levels">${talents}</div>
        <p class="gp-tags"><span class="gp-cap"></span><span class="gp-uidtag">UID ${uid}</span><span class="gp-credit"></span></p>
      </div>
      <div class="gp-b-mid">
        ${weapon}
        <ul class="gp-final">${rows.join('')}</ul>
        <ul class="gp-sets">${sets}</ul>
      </div>
      <div class="gp-b-arts">
        <div class="gp-arts-head"><span class="gp-cv" title="Crit value: 2 &times; CRIT Rate + CRIT DMG from substats">CV <b>${d.cv.toFixed(1)}</b></span>${fp[20] > 0 ? `<span class="gp-cv">CRIT ratio <b>1 : ${(fp[22] / fp[20]).toFixed(1)}</b></span>` : ''}<span class="gp-cv">Crit rolls <b>${d.critRolls}<small>/${d.rolls}</small></b></span></div>
        <div class="gp-pieces">${arts}</div>
      </div>
      <ul class="gp-brk" aria-label="Substat breakdown">${brk}</ul>
      <p class="gp-brand"><img src="/icons/home.jpg" alt="">Parchrome</p>
    </article>`;
  }

  // ---- the picture: html-to-image (self-hosted, MIT) draws the card into a PNG. It loads on
  // the first Download. The card is copied into a fixed stage first (1280px landscape, 720px
  // portrait), so the picture is the same card on every screen.
  let lib = null;
  const loadLib = () =>
    lib ||
    (lib = new Promise((ok, no) => {
      const sc = document.createElement('script');
      sc.src = '/html-to-image/html-to-image.js';
      sc.onload = () => ok(window.htmlToImage);
      sc.onerror = () => {
        lib = null;
        no();
      };
      document.head.appendChild(sc);
    }));
  // Fonts for the picture: html-to-image can't read Google's cross-origin stylesheets, so the
  // card's two fonts (Latin glyphs only) are fetched once and inlined as data URLs.
  const FONTS = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@800&family=Sora:wght@400;500;600;700;800&display=swap';
  const toData = (url) =>
    fetch(url)
      .then((r) => r.blob())
      .then((b) => new Promise((ok) => Object.assign(new FileReader(), { onload: (e) => ok(e.target.result) }).readAsDataURL(b)));
  let fontCss = null;
  const loadFonts = () =>
    fontCss ||
    (fontCss = fetch(FONTS)
      .then((r) => r.text())
      .then((css) =>
        Promise.all(
          css
            .split('/* ')
            .filter((b) => b.startsWith('latin */'))
            .map(async (b) => {
              const face = b.slice(b.indexOf('@font-face'));
              const u = (face.match(/url\(([^)]+)\)/) || [])[1];
              return u ? face.replace(u, await toData(u)) : face;
            }),
        ),
      )
      .then((faces) => faces.join('\n'))
      .catch(() => {
        fontCss = null;
        return '';
      }));
  async function picture(scale) {
    stopMove();
    const card = $('gpBuild').querySelector('.gp-build');
    const [H, fontEmbedCSS] = await Promise.all([loadLib(), loadFonts()]);
    const stage = document.createElement('div');
    stage.className = 'gp-stage' + (opts.port ? ' gp-stage--port' : '');
    stage.appendChild(card.cloneNode(true));
    $('showcase').appendChild(stage);
    try {
      await document.fonts.ready;
      await Promise.all([...stage.querySelectorAll('img')].map((im) => (im.complete ? 0 : new Promise((r) => (im.onload = im.onerror = r)))));
      return await H.toBlob(stage.firstChild, { pixelRatio: scale, fontEmbedCSS });
    } finally {
      stage.remove();
    }
  }
  const fileName = () => `${slug(nick) || 'traveler'}-${slug(showcase.cur.c.n)}${opts.port ? '-portrait' : ''}-parchrome.png`;
  async function act(btn, job) {
    if (btn.disabled) return;
    const t = btn.querySelector('span');
    const was = t.textContent;
    btn.disabled = true;
    t.textContent = 'Making…';
    $('gpCardSt').textContent = '';
    try {
      t.textContent = (await job()) || was;
      setTimeout(() => (t.textContent = was), 1600);
    } catch (e) {
      t.textContent = was;
      $('gpCardSt').textContent = "Couldn't make the picture. Try again in a moment.";
    }
    btn.disabled = false;
  }
  const save = (scale) => async () => {
    const blob = await picture(scale);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return 'Saved';
  };
  $('gpDl').onclick = () => act($('gpDl'), save(1.5));
  $('gpDl2').onclick = () => act($('gpDl2'), save(3));
  // Copy (desktop Chrome/Edge/Safari): straight into Discord, a chat, a post.
  if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
    $('gpCopyImg').hidden = false;
    $('gpCopyImg').onclick = () =>
      act($('gpCopyImg'), async () => {
        // Safari wants the ClipboardItem made right away, with the blob as a promise.
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': picture(1.5) })]);
        return 'Copied';
      });
  }
  // Share (phones): the system share sheet with the picture attached.
  if (navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] })) {
    $('gpShareImg').hidden = false;
    $('gpShareImg').onclick = () =>
      act($('gpShareImg'), async () => {
        const file = new File([await picture(1.5)], fileName(), { type: 'image/png' });
        await navigator.share({ files: [file], title: `${nick}'s ${showcase.cur.c.n}` });
        return 'Shared';
      });
  }

  // ---- every build at a glance: one row per character with details ----
  function roster(list) {
    const rows = list.map((x, i) => ({ ...x, i })).filter((x) => x.d);
    $('gpRoster').hidden = rows.length < 2;
    if (rows.length < 2) return;
    $('gpRosterBody').innerHTML = rows
      .map(({ s, c, d, i }) => {
        const t = d.talents.map((x) => `<b class="${x.up ? 'is-up' : ''}">${x.lv}</b>`).join('<i>/</i>');
        const w = d.wep;
        return `<tr data-i="${i}" tabindex="0" style="--gi-el:${EL[c.e] || NEUTRAL}">
          <th scope="row"><span class="gp-r-who"><span class="gi-tile r${c.r}"><img src="${esc(face(c, s.costumeId || d.costume))}" alt="" loading="lazy" decoding="async"></span><span class="gp-r-name"><b>${esc(c.n)}</b><small>${c.e ? `<img src="${elIcon(c.e.toLowerCase())}" alt="">${esc(c.e)}` : ''}</small></span></span></th>
          <td class="gp-r-num">${d.lv}</td>
          <td class="gp-r-num">C${d.cons}</td>
          <td class="gp-r-tal">${t}</td>
          <td>${w ? `<span class="gp-r-wep"><span class="gi-tile r${w.r}"><img src="${esc(w.icon)}" alt="" loading="lazy" decoding="async"></span><span><b>${esc(w.name)}</b><small>Lv ${w.lv}${w.refine ? ' &middot; R' + w.refine : ''}</small></span></span>` : '&mdash;'}</td>
          <td class="gp-r-sets">${d.sets.map((x) => `<span><b>${x.n}</b>${esc(x.name)}</span>`).join('') || '<span class="gp-noset">No set</span>'}</td>
          <td class="gp-r-num">${pct(d.fp[20] || 0)}<small>${pct(d.fp[22] || 0)}</small></td>
          <td class="gp-r-num gp-r-cv">${d.cv.toFixed(1)}</td>
        </tr>`;
      })
      .join('');
    const body = $('gpRosterBody');
    const go = (e) => {
      const tr = e.target.closest('tr[data-i]');
      if (tr && (e.type === 'click' || e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        showcase.pick(+tr.dataset.i);
      }
    };
    body.onclick = body.onkeydown = go;
  }

  load();
})();
