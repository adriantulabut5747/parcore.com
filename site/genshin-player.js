// Genshin player lookup (/genshin-impact/player/<UID>, Oct 23 2026). One page serves every
// player: site/_redirects sends /genshin-impact/player/* here and the UID comes from the
// address; no UID = the search. Data: /api/genshin (netlify/functions/genshin-api.mjs, which
// asks Enka.Network) + /genshin-enka-map.json (ids -> names/icons, scripts/genshin-feed.py).
// Pictures are Enka's (enka.network/ui/, CORS open). Shared helpers: genshin-core.js.
// Styles: genshin.css + genshin-player.css. Player text (nickname, signature) is
// third-party, so it goes through esc() like everything else.
(function () {
  const { $, esc, EL, NEUTRAL, elIcon, uidServer, lookup, ON_PAGES, playerHref } = window.GI;
  const UI = 'https://enka.network/ui/';
  // GitHub Pages can't run the function, so it calls the Netlify site's (CORS allows it).
  const API = ON_PAGES ? 'https://parchrome.netlify.app/api/genshin' : '/api/genshin';
  // The UID: /genshin-impact/player/<UID> on Netlify, ?uid=<UID> on GitHub Pages.
  const seg = location.pathname.split('/genshin-impact/player/')[1] || '';
  const raw = decodeURIComponent(new URLSearchParams(location.search).get('uid') || seg.replace(/\/$/, ''));
  const uid = /^\d{9,10}$/.test(raw) ? raw : '';

  // ---- recent searches: UIDs only, this browser only ----
  const RECENT = 'gi-uids';
  function recent() {
    try {
      const r = JSON.parse(localStorage.getItem(RECENT));
      return Array.isArray(r) ? r.filter((u) => /^\d{9,10}$/.test(u)) : [];
    } catch (e) {
      return [];
    }
  }
  function remember(u) {
    try {
      localStorage.setItem(RECENT, JSON.stringify([u, ...recent().filter((x) => x !== u)].slice(0, 6)));
    } catch (e) {}
  }

  // ---- no UID: the search ----
  if (!raw) {
    $('gpHome').hidden = false;
    lookup($('gpLook'));
    const r = recent();
    if (r.length) {
      $('gpRecent').hidden = false;
      $('gpRecentList').innerHTML = r.map((u) => `<a class="gi-key" href="${playerHref(u)}">${u}<small>${esc(uidServer(u))}</small></a>`).join('');
    }
    return;
  }

  // ---- a UID: the player ----
  $('gpPlayer').hidden = false;
  lookup($('gpAgain'));
  const card = $('gpCard');
  $('gpShare').dataset.copy = location.origin + playerHref(uid);

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
    card.innerHTML = `<div><p class="gi-eyebrow">UID ${esc(raw)}</p><h1 class="gp-msg-t">${esc(t)}</h1><p>${esc(p)}</p></div>${retry ? '<button type="button" class="gi-key gi-key--red" id="gpRetry">Try again</button>' : ''}`;
    if (retry) $('gpRetry').onclick = load;
    $('showcase').hidden = true;
    $('gpRefresh').hidden = $('gpShare').hidden = true;
  }
  if (!uid) return fail('badUid');

  const mapP = fetch('/genshin-enka-map.json').then((r) => (r.ok ? r.json() : Promise.reject('unreachable')));
  let map = null;

  // Enka asks clients not to re-ask a UID inside its ttl; the CDN holds it that long
  // anyway, so Refresh waits it out.
  let ttlTimer = 0;
  function waitTtl(sec) {
    const btn = $('gpRefresh');
    const t = $('gpRefreshT');
    let left = Math.max(1, sec | 0);
    btn.disabled = true;
    clearInterval(ttlTimer);
    const step = () => {
      if (left <= 0) {
        clearInterval(ttlTimer);
        btn.disabled = false;
        t.textContent = 'Refresh';
        return;
      }
      t.textContent = `Updates in ${left--}s`;
    };
    step();
    ttlTimer = setInterval(step, 1000);
  }
  $('gpRefresh').onclick = load;

  function load() {
    card.className = 'gi-box gp-card is-loading';
    card.innerHTML = '<div class="gp-card-art"></div><div class="gp-card-main"><span class="gp-face"></span><div class="gp-who"><span class="gp-skel"></span><span class="gp-skel gp-skel--s"></span></div></div><ul class="gp-stats"><li></li><li></li><li></li><li></li></ul>';
    const player = fetch(API + '?uid=' + uid).then(async (r) => {
      const d = await r.json().catch(() => ({ error: r.ok ? 'enka5xx' : 'unreachable' }));
      if (!r.ok || d.error) throw d.error || 'unreachable';
      return d;
    });
    Promise.all([player, mapP])
      .then(([d, m]) => {
        map = m;
        render(d);
        remember(uid);
        waitTtl(d.ttl || 60);
      })
      .catch((e) => fail(typeof e === 'string' ? e : 'unreachable'));
  }

  // ---- lookups into the map ----
  const char = (id, depot) => map.c[id + '-' + depot] || map.c[id] || { n: 'Unknown character', e: '', r: 4, i: '', s: [] };
  const face = (c, costume) => (map.cos[costume] ? UI + 'UI_AvatarIcon_' + map.cos[costume] + '.png' : c.i ? UI + 'UI_AvatarIcon_' + c.i + '.png' : '');
  const art = (c, costume) => (map.cos[costume] ? UI + 'UI_Costume_' + map.cos[costume] + '.png' : c.i ? UI + 'UI_Gacha_AvatarImg_' + c.i + '.png' : '');
  // Profile picture: newer profiles send a picture id (pfps), older ones a character.
  function pfp(pp) {
    if (!pp) return '';
    if (pp.id && map.pf[pp.id]) return UI + map.pf[pp.id] + '.png';
    return pp.avatarId ? face(char(pp.avatarId), pp.costumeId) : '';
  }
  const num = (v) => Number(v).toLocaleString('en-US');

  // ---- the profile card: the player's namecard, like the in-game friend card ----
  function render(d) {
    const p = d.playerInfo || {};
    const nick = p.nickname || 'Traveler';
    document.title = `${nick} (${uid}) | Genshin player lookup | Parchrome`;
    const nc = map.nc[p.nameCardId];
    const pic = pfp(p.profilePicture);
    // Only what the profile sends. towerStarIndex / theater* only exist on newer
    // profiles (not in Enka's docs yet), so each shows only when it's there.
    const stars = (n) => (n ? ` <small>&#9733; ${num(n)}</small>` : '');
    const stats = [
      ['Adventure Rank', p.level != null && num(p.level)],
      ['World Level', p.worldLevel != null && num(p.worldLevel)],
      ['Achievements', p.finishAchievementNum != null && num(p.finishAchievementNum)],
      ['Spiral Abyss', p.towerFloorIndex && `${p.towerFloorIndex}-${p.towerLevelIndex || 1}${stars(p.towerStarIndex)}`],
      ['Imaginarium Theater', p.theaterActIndex && `Act ${num(p.theaterActIndex)}${stars(p.theaterStarIndex)}`],
      ['Max friendship', p.fetterCount != null && num(p.fetterCount)],
    ].filter((s) => s[1]);
    card.className = 'gi-box gp-card';
    card.innerHTML = `<div class="gp-card-art">${nc ? `<img src="${UI + esc(nc)}.png" alt="" decoding="async">` : ''}</div>
      <div class="gp-card-main">
        <span class="gp-face">${pic ? `<img src="${esc(pic)}" alt="" decoding="async">` : ''}</span>
        <div class="gp-who">
          <h1 class="gp-name">${esc(nick)}</h1>
          <p class="gp-uid">UID ${uid}${uidServer(uid) ? `<span class="gi-uid-server">${esc(uidServer(uid))}</span>` : ''}</p>
          ${p.signature ? `<p class="gp-sig">${esc(p.signature)}</p>` : ''}
        </div>
      </div>
      <ul class="gp-stats">${stats.map(([k, v]) => `<li><b>${v}</b><span>${k}</span></li>`).join('')}</ul>`;
    $('gpRefresh').hidden = $('gpShare').hidden = false;
    showcase(p.showAvatarInfoList || [], d.avatarInfoList || []);
  }

  // ---- the showcase: a tray of faces, the picked one's build under it ----
  function showcase(shown, details) {
    const sec = $('showcase');
    sec.hidden = false;
    const byId = {};
    details.forEach((a) => (byId[a.avatarId] = a));
    // A showcase list can lag the details, so take the characters from both.
    const list = shown.length ? shown.map((s) => ({ s, a: byId[s.avatarId] })) : details.map((a) => ({ s: { avatarId: a.avatarId }, a }));
    const tray = $('gpChars');
    if (!list.length) {
      tray.hidden = true;
      $('gpShowSub').textContent = "This player isn't showing any characters.";
      $('gpBuild').innerHTML = '';
      return;
    }
    tray.hidden = false;
    $('gpShowSub').textContent = details.length
      ? `${list.length} character${list.length > 1 ? 's' : ''} on show. Pick one for the build.`
      : 'This player shows characters but keeps builds hidden.';
    tray.innerHTML = list
      .map(({ s, a }, i) => {
        const c = char(s.avatarId, a && a.skillDepotId);
        const lv = (a && a.propMap && a.propMap[4001] && a.propMap[4001].val) || s.level;
        return `<button type="button" class="gi-tab gp-ch" role="tab" data-i="${i}" aria-label="${esc(c.n)}"><span class="gi-tile r${c.r}"><img src="${esc(face(c, s.costumeId))}" alt="" loading="lazy" decoding="async"></span><span>${lv ? 'Lv ' + num(lv) : esc(c.n)}</span></button>`;
      })
      .join('');
    const pick = (i) => {
      tray.querySelectorAll('.gp-ch').forEach((b) => {
        const on = +b.dataset.i === i;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on);
      });
      const { s, a } = list[i];
      $('gpBuild').innerHTML = a ? build(a, s) : hidden(s);
    };
    tray.onclick = (e) => {
      const b = e.target.closest('.gp-ch');
      if (b) pick(+b.dataset.i);
    };
    pick(0);
  }

  function hidden(s) {
    const c = char(s.avatarId);
    return `<div class="gi-box gp-hidden"><span class="gi-tile r${c.r}"><img src="${esc(face(c, s.costumeId))}" alt=""></span><div><b>${esc(c.n)}${s.level ? ' &middot; Lv ' + num(s.level) : ''}</b><p>Builds are hidden. The player can show them by turning on "Show Character Details" in their in-game profile.</p></div></div>`;
  }

  // ---- one character's build ----
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
  const stat = (o, short) => {
    if (!o) return null;
    const id = o.appendPropId || o.mainPropId;
    const k = PROP[id] || 'Stat';
    return { k: (short && SHORT[k]) || k, v: FLAT.includes(id) ? num(Math.round(o.statValue)) : (+o.statValue).toFixed(1) + '%' };
  };
  // Final stats (fightPropMap ids, Enka's docs): [id, label, base id] / percent.
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
  const pct = (v) => (v * 100).toFixed(1) + '%';

  function build(a, s) {
    const c = char(a.avatarId, a.skillDepotId);
    const el = c.e;
    const pm = a.propMap || {};
    const lv = +((pm[4001] && pm[4001].val) || s.level || 1);
    const asc = +((pm[1002] && pm[1002].val) || 0);
    const cap = [20, 40, 50, 60, 70, 80, 90][asc] || 90;
    const cons = (a.talentIdList || []).length;
    const fp = a.fightPropMap || {};
    const eq = a.equipList || [];
    const wep = eq.find((e) => e.weapon);
    const pieces = SLOTS.map((slot) => eq.find((e) => e.reliquary && e.flat && e.flat.equipType === slot));

    // Talents: base level + any constellation boost (keyed by the talent's proud id).
    const talents = (c.s || []).slice(0, 3).map(([sk, proud], i) => {
      const up = (a.proudSkillExtraLevelMap || {})[proud] || 0;
      return `<span class="${up ? 'is-up' : ''}" title="${TALENT[i]}${up ? ' (+' + up + ' from constellations)' : ''}"><b>${((a.skillLevelMap || {})[sk] || 1) + up}</b><small>${TALENT[i].split(' ').pop()}</small></span>`;
    });

    // Final stats + the biggest DMG bonus (the character's own element when it's a tie at 0).
    const rows = FINAL.map(([id, k, base, isPct]) => {
      const v = fp[id] || 0;
      const extra = base && fp[base] ? `<small>${num(Math.round(fp[base]))} + ${num(Math.round(v - fp[base]))}</small>` : '';
      return `<li><span>${k}</span><b>${isPct ? pct(v) : num(Math.round(v))}${extra}</b></li>`;
    });
    let best = DMG_ID[el] || 30;
    Object.keys(DMG).forEach((id) => {
      if ((fp[id] || 0) > (fp[best] || 0)) best = +id;
    });
    rows.push(`<li><span>${DMG[best]} DMG Bonus</span><b>${pct(fp[best] || 0)}</b></li>`);
    if (fp[26] > 0) rows.push(`<li><span>Healing Bonus</span><b>${pct(fp[26])}</b></li>`);

    // Weapon.
    let weapon = '<div class="gp-weapon gp-empty">No weapon data</div>';
    if (wep) {
      const f = wep.flat || {};
      const ws = (f.weaponStats || []).map(stat);
      const refine = wep.weapon.affixMap ? Object.values(wep.weapon.affixMap)[0] + 1 : 0;
      weapon = `<div class="gp-weapon"><span class="gi-tile r${f.rankLevel || 4}"><img src="${UI + esc(f.icon)}.png" alt="" loading="lazy" decoding="async"></span>
        <div><b>${esc(map.w[wep.itemId] || 'Weapon')}</b><p>Lv ${num(wep.weapon.level || 1)}${refine ? ' &middot; R' + refine : ''}</p>
        <p class="gp-wep-stats">${ws.map((x) => `<span>${esc(x.k)} <b>${x.v}</b></span>`).join('')}</p></div></div>`;
    }

    // Artifacts: crit value = 2 x CRIT Rate + CRIT DMG from the substats.
    let cvAll = 0;
    const sets = {};
    const arts = pieces.map((e, i) => {
      if (!e) return `<div class="gp-piece gp-empty"><span class="gi-tile"></span><small>No ${SLOT_NAME[i].toLowerCase()}</small></div>`;
      const f = e.flat;
      sets[f.setId] = (sets[f.setId] || 0) + 1;
      const subs = f.reliquarySubstats || [];
      const cv = subs.reduce((t, x) => t + (x.appendPropId === 'FIGHT_PROP_CRITICAL' ? 2 * x.statValue : x.appendPropId === 'FIGHT_PROP_CRITICAL_HURT' ? x.statValue : 0), 0);
      cvAll += cv;
      const m = stat(f.reliquaryMainstat);
      return `<div class="gp-piece"><span class="gi-tile r${f.rankLevel || 4}"><img src="${UI + esc(f.icon)}.png" alt="${SLOT_NAME[i]}" title="${esc(map.set[f.setId] || SLOT_NAME[i])}" loading="lazy" decoding="async"><i>+${Math.max(0, (e.reliquary.level || 1) - 1)}</i></span>
        <div class="gp-main"><span>${esc(m ? m.k : '')}</span><b>${m ? m.v : ''}</b></div>
        <ul>${subs.map((x) => stat(x, true)).map((x) => `<li><span>${esc(x.k)}</span><b>${x.v}</b></li>`).join('')}</ul>
        <small class="gp-piece-cv">CV ${cv.toFixed(1)}</small></div>`;
    });
    const setLine = Object.entries(sets)
      .filter(([, n]) => n >= 2)
      .sort((x, y) => y[1] - x[1])
      .map(([id, n]) => `<span><b>${n >= 4 ? 4 : 2}</b>${esc(map.set[id] || 'Set')}</span>`)
      .join('');

    const fr = a.fetterInfo && a.fetterInfo.expLevel;
    return `<article class="gi-box gp-build" style="--gi-el:${EL[el] || NEUTRAL}">
      <div class="gp-art" aria-hidden="true"><img src="${esc(art(c, s.costumeId || a.costumeId))}" alt="" decoding="async"></div>
      <div class="gp-b-who">
        <p class="gp-b-el">${el ? `<img src="${elIcon(el.toLowerCase())}" alt="">${el}` : ''}<span class="gi-rarity" aria-label="${c.r} stars">${'&#9733;'.repeat(c.r)}</span></p>
        <h3 class="gp-b-name">${esc(c.n)}</h3>
        <p class="gp-b-meta"><span>Lv <b>${lv}</b>/${cap}</span><span><b>C${cons}</b></span>${fr ? `<span>Friendship <b>${fr}</b></span>` : ''}</p>
        <div class="gp-talents" aria-label="Talent levels">${talents.join('')}</div>
      </div>
      <div class="gp-b-mid">
        ${weapon}
        <ul class="gp-final">${rows.join('')}</ul>
      </div>
      <div class="gp-b-arts">
        <div class="gp-arts-head"><span class="gi-label">Artifacts</span><span class="gp-cv" title="Crit value: 2 &times; CRIT Rate + CRIT DMG from substats">CV <b>${cvAll.toFixed(1)}</b></span></div>
        <p class="gp-sets">${setLine || '<span>No set bonus</span>'}</p>
        <div class="gp-pieces">${arts.join('')}</div>
      </div>
    </article>`;
  }

  load();
})();
