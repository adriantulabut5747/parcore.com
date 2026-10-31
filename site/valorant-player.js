// Valorant player page (/valorant/player/<name>-<tag>, Oct 30 2026; Adrian: "add everything", agent-page look).
// One page serves every player: site/_redirects sends /valorant/player/* here (GitHub Pages can't rewrite, so
// there it's /valorant/player/?id=<name>-<tag>). Data = HenrikDev through our Worker (cloudflare/valorant-api):
//   account (card, level, region) -> then in parallel: mmr3 (rank, peak, every act; v2 mmr if it fails),
//   rr + rrstored (RR per ranked game, merged by match_id), matches x5 (the last 50 with rounds + kills: the
//   Worker slims them) and stored (100 older one-line games).
// Every source can fail alone: its sections say so, the rest still draw. Real numbers only (Adrian's rule).
// Agents use the agent pages' baked art + colours (/valorant-roster.json, written by scripts/valorant-agents.py).
// Address: ?tab=overview|matches|agents|maps|weapons|acts, ?m=<match id> opens that game.
(function () {
  const API = 'https://parchrome-valorant.adriantulabut5747.workers.dev/api/valorant';
  const ON_PAGES = location.hostname.endsWith('github.io');
  const REGIONS = ['na', 'eu', 'ap', 'kr', 'latam', 'br']; // = the Worker's list
  const TABS = ['overview', 'matches', 'acts', 'agents', 'maps', 'weapons'];
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const api = (type, q) => API + '?type=' + type + '&' + new URLSearchParams(q);
  const num = (n, d = 0) => (Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '-');
  const pct = (a, b, d = 0) => (b ? num((a / b) * 100, d) + '%' : '-');
  const ratio = (a, b) => num(b ? a / b : a, 2);
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const modeKey = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  const NO_ROUNDS = ['deathmatch', 'teamdeathmatch']; // modes whose numbers would skew agent / map stats

  // Riot ID rules = the Worker's cleanName / cleanTag
  const okName = (s) => /^[\p{L}\p{N} _.-]{3,16}$/u.test(s);
  const okTag = (s) => /^[\p{L}\p{N}]{3,5}$/u.test(s);
  const href = (name, tag) => {
    const id = encodeURIComponent(name) + '-' + encodeURIComponent(tag);
    return ON_PAGES ? '/valorant/player/?id=' + id : '/valorant/player/' + id;
  };
  window.vlPlayerHref = href;

  /* ---- ranks: 3 = Iron 1 ... 27 = Radiant (icons baked by the Ranks page) ---- */
  const RANKS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal'];
  const tierName = (id) => (id === 27 ? 'Radiant' : id >= 3 && id < 27 ? RANKS[Math.floor((id - 3) / 3)] + ' ' + (((id - 3) % 3) + 1) : 'Unranked');
  const rankImg = (id, size = 40) =>
    id >= 3 && id <= 27 ? `<img src="/images/valorant/ranks/${id}.webp" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">` : '';
  // Elo = (tier - 3) x 100 + RR up to Ascendant 3; from Immortal 1 (2100) the RR just keeps counting
  const eloTier = (elo) => (elo >= 2100 ? 'Immortal+' : tierName(3 + Math.floor(elo / 100)));

  /* ---- time ---- */
  const ago = (t) => {
    const s = (Date.now() - t) / 1000;
    if (!Number.isFinite(s)) return '';
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    if (s < 86400 * 30) return Math.round(s / 86400) + 'd ago';
    return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const day = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const mins = (ms) => (ms ? Math.round(ms / 60000) + ' min' : '');
  const clock = (ms) => Math.floor(ms / 60000) + ':' + String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  // Henrik's act ids: e<episode>a<act>. From 2025 Riot names acts by year: e10 = V25, e11 = V26 (valorant-weapons.json
  // calls today's act "V26 Act VI" and Henrik calls it e11a6)
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
  const actParts = (short) => String(short || '').match(/^e(\d+)a(\d+)$/i)?.slice(1).map(Number) || null;
  const actName = (short) => {
    const p = actParts(short);
    if (!p) return short || 'Unknown act';
    return p[0] >= 10 ? `V${p[0] + 15} Act ${ROMAN[p[1]] || p[1]}` : `Episode ${p[0]} · Act ${p[1]}`;
  };
  const actOrder = (a, b) => {
    const x = actParts(a.act) || [0, 0], y = actParts(b.act) || [0, 0];
    return x[0] - y[0] || x[1] - y[1];
  };

  /* ---- the address ---- */
  function idFromAddress() {
    const seg = location.pathname.split('/valorant/player/')[1] || '';
    let raw = new URLSearchParams(location.search).get('id') || seg.replace(/\/$/, '');
    try {
      raw = decodeURIComponent(raw);
    } catch {
      return null;
    }
    const cut = raw.lastIndexOf('-'); // tags never hold a dash, names can
    if (cut < 1) return null;
    const name = raw.slice(0, cut).trim(), tag = raw.slice(cut + 1).trim();
    return okName(name) && okTag(tag) ? { name, tag } : null;
  }
  const params = () => new URLSearchParams(location.search);
  function setParam(k, v) {
    const q = params();
    v ? q.set(k, v) : q.delete(k);
    const s = q.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash);
  }

  /* ---- data ---- */
  const getJSON = async (url, ms = 20000) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = body?.errors?.[0] || {};
      throw Object.assign(
        new Error(e.code === 24 ? "That account has no recent matches, so it can't be looked up yet."
          : res.status === 404 ? 'No player with that Riot ID.'
          : res.status === 429 ? 'Too many lookups right now. Try again in a minute.'
          : e.message || `The tracker isn't answering (${res.status}).`),
        { status: res.status },
      );
    }
    return body;
  };
  let roster = {};
  const rosterP = fetch('/valorant-roster.json').then((r) => r.json()).then((list) => (roster = Object.fromEntries(list.map((a) => [a.id.toLowerCase(), a])))).catch(() => {});
  const agentOf = (id, name) => roster[String(id || '').toLowerCase()] || { id, name: name || 'Unknown', slug: '', role: '', ac: '#2a2c35', ac2: '#14151a' };
  const agentIcon = (a, size = 36) => {
    const src = a.slug ? `/images/valorant/agents/${a.slug}-icon.webp` : a.id ? `https://media.valorant-api.com/agents/${encodeURIComponent(a.id)}/displayicon.png` : '';
    return src ? `<img class="vp-ag" src="${src}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async" style="--ac:${a.ac}">` : `<span class="vp-ag vp-ag--none" style="width:${size}px;height:${size}px"></span>`;
  };
  const mapCard = (name) => `/images/valorant/maps/${slug(name)}-card.webp`;
  const gunIcon = (w) => (w?.id && w.type === 'Weapon' ? `https://media.valorant-api.com/weapons/${encodeURIComponent(w.id)}/killstreamicon.png` : '');

  // one game from either source, the same shape: recent games keep their full match as .m
  function fromMatch(m, puuid) {
    const me = (m.players || []).find((p) => p.puuid === puuid);
    if (!me) return null;
    const mine = (m.teams || []).find((t) => t.team_id === me.team_id);
    const other = (m.teams || []).find((t) => t.team_id !== me.team_id);
    // free-for-all (deathmatch): every player is their own "team" with a placement, only 1st has won
    const ffa = (m.teams || []).length > 2;
    const rounds = ffa ? 0 : (m.rounds || []).length || (mine?.rounds ? mine.rounds.won + mine.rounds.lost : 0);
    const won = mine?.won, lost = ffa ? !won : other?.won;
    const s = me.stats || {};
    return {
      id: m.metadata.match_id, t: Date.parse(m.metadata.started_at), map: m.metadata.map?.name || 'Unknown map',
      mode: m.metadata.queue?.name || m.metadata.queue?.id || 'Custom', mk: modeKey(m.metadata.queue?.name || m.metadata.queue?.id),
      ag: agentOf(me.agent?.id, me.agent?.name), res: won ? 'w' : lost || (mine && mine.won === false && !other) ? 'l' : 'd',
      score: ffa ? [] : [mine?.rounds?.won, other?.rounds?.won], place: ffa && mine?.placement ? [mine.placement, m.teams.length] : null, k: s.kills || 0, d: s.deaths || 0, a: s.assists || 0, acs: s.score || 0,
      rounds, hs: s.headshots || 0, bs: s.bodyshots || 0, ls: s.legshots || 0, dmg: s.damage?.dealt ?? s.damage?.made ?? 0,
      dmgIn: s.damage?.received ?? 0, tier: me.tier?.id, len: m.metadata.game_length_in_ms, me, m,
    };
  }
  function fromStored(x) {
    const s = x.stats || {}, meta = x.meta || {};
    const side = String(s.team || '').toLowerCase();
    const mine = x.teams?.[side], other = x.teams?.[side === 'red' ? 'blue' : 'red'];
    const has = Number.isFinite(mine) && Number.isFinite(other);
    return {
      id: meta.id, t: Date.parse(meta.started_at), map: meta.map?.name || 'Unknown map', mode: meta.mode || 'Custom', mk: modeKey(meta.mode),
      ag: agentOf(s.character?.id, s.character?.name), res: !has ? 'd' : mine > other ? 'w' : mine < other ? 'l' : 'd',
      score: has ? [mine, other] : [], k: s.kills || 0, d: s.deaths || 0, a: s.assists || 0, acs: s.score || 0, rounds: has ? mine + other : 0,
      hs: s.shots?.head || 0, bs: s.shots?.body || 0, ls: s.shots?.leg || 0, dmg: s.damage?.made || 0, dmgIn: s.damage?.received || 0, tier: s.tier,
    };
  }

  // the Worker's slim matches carry distance; Henrik's full ones the positions it comes from (100 units = 1 m)
  function dist(k) {
    if (k.distance !== undefined) return k.distance;
    const at = (k.player_locations || []).find((l) => l.player?.puuid === k.killer?.puuid);
    return at && k.location ? Math.hypot(at.location.x - k.location.x, at.location.y - k.location.y) / 100 : null;
  }

  // per-match numbers that need rounds + kills: KAST, first kills / deaths, multi-kills, sides, buys, weapon kills
  function deep(g) {
    const { m, me } = g;
    const id = me.puuid, team = me.team_id;
    const byRound = {};
    (m.kills || []).forEach((k) => (byRound[k.round] ||= []).push(k));
    const out = { kast: 0, fk: 0, fd: 0, k3: 0, k4: 0, k5: 0, atk: [0, 0], def: [0, 0], buys: [], guns: {}, dist: [] };
    (m.rounds || []).forEach((r, i) => {
      const ks = (byRound[r.id ?? i] || []).slice().sort((a, b) => a.time_in_round_in_ms - b.time_in_round_in_ms);
      const mine = ks.filter((k) => k.killer?.puuid === id);
      const death = ks.find((k) => k.victim?.puuid === id);
      const assisted = ks.some((k) => (k.assistants || []).some((x) => x?.puuid === id));
      // traded = a teammate killed my killer within 5 s
      const traded = death && ks.some((k) => k.victim?.puuid === death.killer?.puuid && k.killer?.team === team && k.time_in_round_in_ms - death.time_in_round_in_ms <= 5000 && k.time_in_round_in_ms >= death.time_in_round_in_ms);
      if (mine.length || assisted || !death || traded) out.kast++;
      if (ks[0]?.killer?.puuid === id) out.fk++;
      if (ks[0]?.victim?.puuid === id) out.fd++;
      if (mine.length === 3) out.k3++;
      if (mine.length === 4) out.k4++;
      if (mine.length >= 5) out.k5++;
      mine.forEach((k) => {
        // nameless kills (abilities without a name, the spike, fall damage) group by their type
        const raw = k.weapon || {};
        const w = raw.name ? raw : { name: raw.type === 'Bomb' ? 'Spike' : raw.type === 'Ability' ? 'Abilities' : 'Other', type: raw.type || '' };
        const e = (out.guns[raw.name ? raw.id || raw.name : 'x:' + w.name] ||= { w, n: 0, dist: [] });
        e.n++;
        const d = dist(k);
        if (Number.isFinite(d)) e.dist.push(d), out.dist.push(d);
      });
      // the side: the winners' role is given, mine is it or the other one
      const role = r.winning_team === team ? r.winning_team_role : r.winning_team_role === 'Attacker' ? 'Defender' : 'Attacker';
      const won = r.winning_team === team;
      if (role === 'Attacker') (out.atk[1]++, won && out.atk[0]++);
      else if (role === 'Defender') (out.def[1]++, won && out.def[0]++);
      const st = (r.stats || []).find((s) => s.player?.puuid === id);
      if (st?.economy) out.buys.push({ gun: st.economy.weapon, armor: st.economy.armor, value: st.economy.loadout_value || 0 });
    });
    return out;
  }

  /* ---- shared bits ---- */
  // a section with nothing to show goes away whole, title included (Adrian: no "isn't available" boxes)
  const drop = (el) => {
    const sec = el?.closest('.ct-sec');
    if (sec) sec.hidden = true;
  };
  const tile = (label, value, sub = '') => `<div class="vp-tile"><small>${label}</small><b>${value}</b>${sub ? `<em>${sub}</em>` : ''}</div>`;
  const resWord = (r) => ({ w: 'Win', l: 'Loss', d: 'Draw' })[r];

  /* ============================================================ the page ============================================================ */
  const root = $('vpRoot');
  const who = idFromAddress();
  wireFind();
  drawRecent();
  if (!who) {
    root.dataset.state = 'empty';
    document.title = 'Valorant Player Tracker | Parchrome';
    return;
  }
  document.title = `${who.name}#${who.tag} | Valorant Player | Parchrome`;
  $('cbTitle').innerHTML = `${esc(who.name)}<i>#${esc(who.tag)}</i>`;
  $('vpLoadName').innerHTML = `${esc(who.name)}<i>#${esc(who.tag)}</i>`;
  const showTab = wireTabs();
  const COUNT = 50; // recent games with full data, always (Adrian): 5 Worker pages of 10

  // the loader's steps: each source ticks one off, failed or not; the page shows once all five have
  const step = (k, ok) => {
    const li = $('vpLoadSteps').querySelector(`[data-step="${k}"]`);
    if (!li || li.dataset.s) return;
    li.dataset.s = ok ? 'done' : 'fail';
    $('vpLoadBar').style.transform = `scaleX(${$('vpLoadSteps').querySelectorAll('[data-s]').length / 5})`;
  };
  const track = (k, p) => p.then((v) => (step(k, true), v), (e) => (step(k, false), Promise.reject(e)));

  const S = { acc: null, region: 'ap', mmr: null, mmr3: null, rr: [], recent: [], stored: [], games: [] };
  track('account', getJSON(api('account', who)))
    .then(async (j) => {
      const acc = (S.acc = j.data || {});
      S.region = REGIONS.includes(acc.region) ? acc.region : 'ap';
      const name = acc.name || who.name, tag = acc.tag || who.tag;
      // the Riot ID's real casing goes in the address, so shared links all look the same
      if (name !== who.name || tag !== who.tag) {
        const u = new URL(href(name, tag), location.origin);
        params().forEach((v, k) => k !== 'id' && u.searchParams.set(k, v));
        history.replaceState(null, '', u.pathname + u.search + location.hash);
      }
      drawBanner(acc, name, tag);
      remember(name, tag, acc.card?.small || '');
      log(name, tag, S.region);
      const q = { region: S.region, name, tag };
      await rosterP;
      const rank = track('rank', getJSON(api('mmr3', q)).then((r) => (S.mmr3 = r.data)).catch(() => getJSON(api('mmr', q)).then((r) => (S.mmr = r.data))));
      const rr = track('rr', Promise.allSettled([getJSON(api('rr', q)), getJSON(api('rrstored', q))]).then(([a, b]) => {
        const seen = new Map();
        const add = (h) => h && !seen.has(h.match_id || h.date) && seen.set(h.match_id || h.date, h);
        (a.status === 'fulfilled' ? a.value.data?.history || [] : []).forEach(add);
        (b.status === 'fulfilled' ? b.value.data || [] : []).forEach(add);
        S.rr = [...seen.values()].filter((h) => Number.isFinite(h.elo)).sort((x, y) => Date.parse(x.date) - Date.parse(y.date));
        if (a.status === 'rejected' && b.status === 'rejected') throw a.reason;
      }));
      const pages = Array.from({ length: COUNT / 10 }, (_, i) => getJSON(api('matches', { ...q, start: i * 10 })));
      const recent = track('matches', Promise.allSettled(pages).then((res) => {
        const ms = res.flatMap((r) => (r.status === 'fulfilled' ? r.value.data || [] : []));
        const ids = new Set();
        S.recent = ms.filter((m) => m?.metadata && !ids.has(m.metadata.match_id) && ids.add(m.metadata.match_id))
          .map((m) => fromMatch(m, acc.puuid)).filter(Boolean).sort((x, y) => y.t - x.t);
        S.recent.forEach((g) => g.m.rounds?.length && (g.x = deep(g)));
        if (res.every((r) => r.status === 'rejected')) throw res[0].reason;
      }));
      const stored = track('stored', getJSON(api('stored', q)).then((r) => (S.stored = (r.data || []).map(fromStored).filter((g) => g.id))));

      // every section draws (or drops itself) while the loader is still up; reveal() then shows them all at once
      const drawn = [
        rank.then(drawRank, (e) => (drop($('vpRank')), drop($('vpActs')), console.warn(e))).then(() => (S.mmr3 || S.mmr ? drawActs() : null)),
        rr.then(drawRR, (e) => (drop($('vpRR')), console.warn(e))),
        recent.then(
          () => (drawRecentBits(), drawMatches()),
          (e) => (['vpForm', 'vpHits', 'vpMates', 'vpMatchList', 'vpGuns', 'vpBuys', 'vpDist'].forEach((id) => drop($(id))), console.warn(e)),
        ),
        // agents + maps use every game we have: the recent ones + Henrik's stored copies (recent wins a tie)
        Promise.allSettled([recent, stored]).then(([, st]) => {
          const ids = new Set(S.recent.map((g) => g.id));
          S.games = [...S.recent, ...S.stored.filter((g) => !ids.has(g.id))].sort((x, y) => y.t - x.t);
          if (st.status === 'rejected') console.warn(st.reason);
          drawOld(st.status === 'fulfilled');
          drawAgents();
          drawMaps();
          drawMain();
          drawRoles();
          if (!S.games.length) $('vpSub').textContent += ' · no games found';
        }),
      ];
      // a draw that throws must not keep the loader up forever
      await Promise.allSettled(drawn.map((p) => p.catch(console.warn)));
      reveal();
    })
    .catch((err) => {
      root.dataset.state = 'error';
      $('vpSub').textContent = err.message;
      $('vpErr').textContent = err.message;
      console.warn(err);
    });

  /* ---- banner: their player card stretched behind the name, the numbers in wells ---- */
  function drawBanner(acc, name, tag) {
    $('cbTitle').innerHTML = `${esc(name)}<i>#${esc(tag)}</i>`;
    const wide = acc.card?.wide || (acc.card?.id ? `https://media.valorant-api.com/playercards/${encodeURIComponent(acc.card.id)}/wideart.png` : '');
    if (/^https:\/\//.test(wide)) $('vpArt').style.setProperty('--art', `url("${wide.replace(/"/g, '')}")`);
    if (/^https:\/\//.test(acc.card?.small || '')) $('vpIco').innerHTML = `<img src="${esc(acc.card.small)}" alt="" width="128" height="128" decoding="async">`;
    const last = acc.last_update_raw ? acc.last_update_raw * 1000 : Date.parse(acc.updated_at || '');
    $('vpSub').textContent = [`Level ${acc.account_level ?? '?'}`, S.region.toUpperCase(), Number.isFinite(last) ? 'Updated ' + ago(last) : ''].filter(Boolean).join(' · ');
  }

  /* ---- reveal: tabs left with no section go too, then everything shows at once ---- */
  function reveal() {
    const tray = $('vpTabs');
    let open = 0;
    document.querySelectorAll('.vp-panel').forEach((p) => {
      const has = !!p.querySelector('.ct-sec:not([hidden])');
      tray.querySelector(`[data-tab="${p.dataset.tab}"]`).hidden = !has;
      open += has;
    });
    if (!open) {
      root.dataset.state = 'error';
      $('vpErr').textContent = "We found the account, but none of its rank or match data is available right now. Try again in a few minutes.";
      return;
    }
    const cur = tray.querySelector('[aria-selected="true"]');
    if (cur.hidden) showTab(tray.querySelector('[data-tab]:not([hidden])').dataset.tab, false);
    root.dataset.state = 'ok';
    openFromAddress();
  }

  /* ---- rank: current / peak / this act (mmr v3, or v2's fields) ---- */
  function rankNow() {
    const c = S.mmr3?.current, p = S.mmr3?.peak, v2 = S.mmr;
    if (c) return { tier: c.tier?.id, rr: c.rr, change: c.last_change, elo: c.elo, lb: c.leaderboard_placement?.rank ?? c.leaderboard_placement, peak: p?.tier?.id, peakSeason: p?.season?.short };
    const cd = v2?.current_data || {}, hi = v2?.highest_rank || {};
    return { tier: cd.currenttier, rr: cd.ranking_in_tier, change: cd.mmr_change_to_last_game, elo: cd.elo, peak: hi.tier, peakSeason: hi.season };
  }
  function acts() {
    if (S.mmr3?.seasonal) return S.mmr3.seasonal.map((s) => ({ act: s.season?.short, games: s.games, wins: s.wins, end: s.end_tier?.id, best: (s.act_wins || []).map((t) => t.id), lb: s.leaderboard_placement?.rank })).sort(actOrder);
    return Object.entries(S.mmr?.by_season || {}).filter(([, s]) => !s.error && s.number_of_games).map(([k, s]) => ({
      act: k, games: s.number_of_games, wins: s.wins, end: s.final_rank, best: (s.act_rank_wins || []).map((t) => t.tier),
    })).sort(actOrder);
  }
  function drawRank() {
    const r = rankNow();
    const list = acts();
    const cur = list[list.length - 1];
    const wells = [];
    const well = (label, tier, title, sub) =>
      `<div class="vp-well"><span class="vp-well-ico">${rankImg(tier, 44)}</span><span><small>${label}</small><b>${esc(title)}</b><em>${sub}</em></span></div>`;
    wells.push(well('Rank', r.tier, tierName(r.tier), r.tier >= 3 ? `${num(r.rr)} RR${Number.isFinite(r.change) && r.change ? ` · <i data-sign="${r.change > 0 ? 'up' : 'down'}">${r.change > 0 ? '+' : ''}${r.change}</i> last game` : ''}` : 'No rank this act'));
    if (r.peak >= 3) wells.push(well('Peak', r.peak, tierName(r.peak), esc(actName(r.peakSeason))));
    if (cur?.games) wells.push(`<div class="vp-well"><span class="vp-well-ico vp-well-n">${num(cur.wins)}</span><span><small>This act</small><b>${num(cur.wins)}W ${num(cur.games - cur.wins)}L</b><em>${pct(cur.wins, cur.games)} won · ${num(cur.games)} games</em></span></div>`);
    if (Number.isFinite(r.lb) && r.lb > 0) wells.push(`<div class="vp-well"><span class="vp-well-ico vp-well-n">#</span><span><small>Leaderboard</small><b>#${num(r.lb)}</b><em>${S.region.toUpperCase()} ranked</em></span></div>`);
    $('vpWells').innerHTML = wells.join('');

    // the Rank section: the progress bar to the next rank + the act's best wins
    const toNext = r.tier >= 3 && r.tier < 24 ? Math.max(0, Math.min(100, r.rr)) : null;
    $('vpRank').innerHTML = `
      <div class="vp-rank">
        <div class="vp-rank-now">
          <span class="vp-rank-pic">${rankImg(r.tier, 120) || '<i>?</i>'}</span>
          <div class="vp-rank-txt">
            <small>Current rank</small><b>${tierName(r.tier)}</b>
            ${r.tier >= 3 ? `<span class="vp-rr"><b>${num(r.rr)}</b> RR${Number.isFinite(r.elo) ? ` · ${num(r.elo)} Elo` : ''}</span>` : '<span class="vp-rr">Plays placements or hasn\'t played ranked this act</span>'}
            ${toNext != null ? `<span class="vp-bar" role="img" aria-label="${toNext} of 100 RR to ${tierName(r.tier + 1)}"><i style="width:${toNext}%"></i></span><span class="vp-bar-ends"><span>${tierName(r.tier)}</span><span>${100 - toNext} RR to ${tierName(r.tier + 1)}</span></span>` : ''}
          </div>
        </div>
        <div class="vp-rank-side">
          ${tile('Peak rank', r.peak >= 3 ? `${rankImg(r.peak, 28)} ${tierName(r.peak)}` : '-', r.peak >= 3 ? esc(actName(r.peakSeason)) : '')}
          ${tile('Last game', Number.isFinite(r.change) ? `<span data-sign="${r.change > 0 ? 'up' : r.change < 0 ? 'down' : ''}">${r.change > 0 ? '+' : ''}${r.change} RR</span>` : '-', 'Ranked')}
          ${cur?.games ? tile('This act', `${num(cur.wins)}W ${num(cur.games - cur.wins)}L`, pct(cur.wins, cur.games) + ' won') : ''}
          ${cur?.best?.length ? `<div class="vp-tile vp-tile--wide"><small>Best wins this act</small><span class="vp-best">${cur.best.slice(0, 9).map((t) => rankImg(t, 26)).join('')}</span></div>` : ''}
        </div>
      </div>`;
  }

  /* ---- RR over time: Elo line + the change per game, one crosshair (dataviz: one series, no legend, table view) ---- */
  function drawRR() {
    const box = $('vpRR');
    const H = S.rr;
    if (H.length < 2) return drop(box); // one game is no chart
    box.innerHTML = `<div class="vp-chart" tabindex="0" aria-label="RR over the last ${H.length} ranked games. Use the arrow keys to read each game."><div class="vp-chart-svg"></div><div class="vp-tip" hidden></div></div>
      <details class="vp-table-toggle"><summary>Show as a table</summary><div class="gs-table-wrap"><table class="gs-table vp-rr-table"><thead><tr><th>Date</th><th>Map</th><th>Rank</th><th>Change</th><th>Elo</th></tr></thead><tbody>${H.slice().reverse().map((h) =>
        `<tr><td>${day(Date.parse(h.date))}</td><td>${esc(h.map?.name || '')}</td><td>${esc(h.tier?.name || tierName(h.tier?.id))} · ${num(h.rr)} RR</td><td data-sign="${h.last_change > 0 ? 'up' : h.last_change < 0 ? 'down' : ''}">${h.last_change > 0 ? '+' : ''}${num(h.last_change)}</td><td>${num(h.elo)}</td></tr>`).join('')}</tbody></table></div></details>`;
    const wrap = box.querySelector('.vp-chart'), svgBox = wrap.querySelector('.vp-chart-svg'), tip = wrap.querySelector('.vp-tip');
    let pick = H.length - 1, X;
    const draw = () => {
      const W = Math.max(280, svgBox.clientWidth), top = 12, h1 = 190, gap = 18, h2 = 64, L = 84, R = 12, Htot = top + h1 + gap + h2 + 6;
      const lo = Math.floor(Math.min(...H.map((h) => h.elo)) / 100) * 100, hi = Math.ceil((Math.max(...H.map((h) => h.elo)) + 1) / 100) * 100;
      X = (i) => L + (H.length === 1 ? 0 : (i / (H.length - 1)) * (W - L - R));
      const Y = (e) => top + h1 - ((e - lo) / (hi - lo)) * h1;
      const big = Math.max(10, ...H.map((h) => Math.abs(h.last_change || 0)));
      const Y2 = (c) => top + h1 + gap + h2 / 2 - (c / big) * (h2 / 2);
      let s = `<svg width="${W}" height="${Htot}" viewBox="0 0 ${W} ${Htot}" aria-hidden="true">`;
      for (let e = lo; e <= hi; e += 100) s += `<line class="vp-grid" x1="${L}" x2="${W - R}" y1="${Y(e)}" y2="${Y(e)}"/><text class="vp-axis" x="${L - 8}" y="${Y(e) + 4}" text-anchor="end">${eloTier(e)}</text>`;
      s += `<line class="vp-grid vp-grid--zero" x1="${L}" x2="${W - R}" y1="${Y2(0)}" y2="${Y2(0)}"/><text class="vp-axis" x="${L - 8}" y="${Y2(0) + 4}" text-anchor="end">RR change</text>`;
      const bw = Math.max(2, Math.min(14, ((W - L - R) / H.length) * 0.6));
      H.forEach((h, i) => {
        const c = h.last_change || 0, y = Y2(Math.max(c, 0)), hh = Math.max(1, Math.abs(Y2(c) - Y2(0)));
        s += `<rect class="vp-chg" data-sign="${c >= 0 ? 'up' : 'down'}" x="${X(i) - bw / 2}" y="${c >= 0 ? y : Y2(0)}" width="${bw}" height="${hh}" rx="${Math.min(2, bw / 2)}"/>`;
      });
      s += `<path class="vp-line" d="${H.map((h, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(h.elo).toFixed(1)).join('')}"/>`;
      s += `<line class="vp-cross" x1="0" x2="0" y1="${top}" y2="${Htot - 4}"/><circle class="vp-dot" r="5" cx="-20" cy="-20"/>`;
      svgBox.innerHTML = s + '</svg>';
      wrap._Y = Y;
      show(pick, false);
    };
    const show = (i, tipOn = true) => {
      pick = Math.max(0, Math.min(H.length - 1, i));
      const h = H[pick], x = X(pick), y = wrap._Y(h.elo);
      const svg = svgBox.querySelector('svg');
      svg.querySelector('.vp-cross').setAttribute('transform', `translate(${x},0)`);
      const dot = svg.querySelector('.vp-dot');
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', y);
      tip.hidden = !tipOn;
      if (!tipOn) return;
      tip.innerHTML = `<b>${esc(h.tier?.name || tierName(h.tier?.id))} · ${num(h.rr)} RR</b><span data-sign="${h.last_change > 0 ? 'up' : h.last_change < 0 ? 'down' : ''}">${h.last_change > 0 ? '+' : ''}${num(h.last_change)} RR</span><small>${esc(h.map?.name || '')} · ${day(Date.parse(h.date))}${h.was_derank_protected ? ' · derank shield' : ''}</small>`;
      const left = Math.min(Math.max(0, x - tip.offsetWidth / 2), svgBox.clientWidth - tip.offsetWidth);
      tip.style.transform = `translate(${left}px, ${Math.max(0, y - tip.offsetHeight - 14)}px)`;
    };
    wrap.addEventListener('pointermove', (e) => {
      const rx = e.clientX - svgBox.getBoundingClientRect().left;
      let best = 0;
      H.forEach((_, i) => Math.abs(X(i) - rx) < Math.abs(X(best) - rx) && (best = i));
      show(best);
    });
    wrap.addEventListener('pointerleave', () => (tip.hidden = true));
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') (e.preventDefault(), show(pick + (e.key === 'ArrowLeft' ? -1 : 1)));
    });
    wrap.addEventListener('blur', () => (tip.hidden = true));
    new ResizeObserver(draw).observe(svgBox);
  }

  /* ---- the recent games: form strip + the numbers, hit zones, party mates ---- */
  function drawRecentBits() {
    const G = S.recent;
    if (!G.length) return ['vpForm', 'vpHits', 'vpMates', 'vpGuns', 'vpBuys', 'vpDist'].forEach((id) => drop($(id)));
    $('vpFormTitle').textContent = `Last ${G.length} game${G.length > 1 ? 's' : ''}`;
    $('vpForm').innerHTML = `<div class="vp-strip">${G.slice().reverse().map((g) => `<button type="button" class="vp-sq" data-r="${g.res}" data-m="${esc(g.id)}" title="${esc(resWord(g.res) + ' · ' + g.map + ' · ' + g.mode + ' · ' + ago(g.t))}">${agentIcon(g.ag, 30)}<span class="vl-sr">${resWord(g.res)} on ${esc(g.map)}</span></button>`).join('')}</div>`;
    const R = G.filter((g) => g.rounds && !NO_ROUNDS.includes(g.mk));
    const sum = (arr, f) => arr.reduce((a, g) => a + (f(g) || 0), 0);
    const rounds = sum(R, (g) => g.rounds), shots = sum(G, (g) => g.hs + g.bs + g.ls);
    const D = R.filter((g) => g.x);
    const dr = sum(D, (g) => g.rounds);
    const played = R.length, wins = R.filter((g) => g.res === 'w').length;
    $('vpNums').innerHTML = [
      tile('Win %', pct(wins, played), `${wins}W ${played - wins}L`),
      tile('K/D', ratio(sum(G, (g) => g.k), sum(G, (g) => g.d)), `${num(sum(G, (g) => g.k))} kills`),
      tile('KDA', ratio(sum(G, (g) => g.k + g.a), sum(G, (g) => g.d)), `${num(sum(G, (g) => g.a))} assists`),
      tile('ACS', num(rounds ? sum(R, (g) => g.acs) / rounds : NaN), 'Combat score a round'),
      tile('ADR', num(rounds ? sum(R, (g) => g.dmg) / rounds : NaN), 'Damage a round'),
      tile('Headshot %', pct(sum(G, (g) => g.hs), shots, 1), `${num(shots)} hits`),
      tile('KAST', pct(sum(D, (g) => g.x.kast), dr), 'Kill, assist, survive or trade'),
      tile('Kills a round', num(rounds ? sum(R, (g) => g.k) / rounds : NaN, 2), `${num(rounds)} rounds`),
      tile('First kills', num(sum(D, (g) => g.x.fk)), `${num(sum(D, (g) => g.x.fd))} first deaths`),
      tile('Multi-kills', num(sum(D, (g) => g.x.k3 + g.x.k4 + g.x.k5)), `${sum(D, (g) => g.x.k3)} × 3K · ${sum(D, (g) => g.x.k4)} × 4K · ${sum(D, (g) => g.x.k5)} aces`),
      tile('Damage +/-', (() => { const v = rounds ? (sum(R, (g) => g.dmg) - sum(R, (g) => g.dmgIn)) / rounds : NaN; return Number.isFinite(v) ? (v > 0 ? '+' : '') + num(v) : '-'; })(), 'Dealt minus taken, a round'),
      tile('Average game', num(G.length ? sum(G, (g) => g.k) / G.length : NaN, 1) + ' kills', mins(G.length ? sum(G, (g) => g.len) / G.length : 0)),
    ].join('');

    // hit zones: the Weapons page's body, each zone lit by its share
    const z = { head: sum(G, (g) => g.hs), body: sum(G, (g) => g.bs), leg: sum(G, (g) => g.ls) };
    const share = (k) => (shots ? z[k] / shots : 0);
    if (!shots) drop($('vpHits'));
    else $('vpHits').innerHTML = `<div class="vp-hits">
      <svg class="vp-body" viewBox="0 0 120 236" aria-hidden="true" style="--h:${share('head')};--b:${share('body')};--l:${share('leg')}">
        <circle data-z="head" cx="60" cy="24" r="17"/>
        <path data-z="body" d="M36 48h48a8 8 0 0 1 8 8v74a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6V56a8 8 0 0 1 8-8zM14 54a6 6 0 0 1 11 0v62a5.5 5.5 0 0 1-11 0zM95 54a6 6 0 0 1 11 0v62a5.5 5.5 0 0 1-11 0z"/>
        <path data-z="leg" d="M34 140h24v86a7 7 0 0 1-7 7h-10a7 7 0 0 1-7-7zM62 140h24v86a7 7 0 0 1-7 7H69a7 7 0 0 1-7-7z"/>
      </svg>
      <ol class="vp-zones">${[['head', 'Head'], ['body', 'Body'], ['leg', 'Legs']].map(([k, n]) => `<li><span>${n}</span><span class="vp-zbar"><i style="width:${share(k) * 100}%"></i></span><b>${pct(z[k], shots, 1)}</b><small>${num(z[k])} hits</small></li>`).join('')}</ol>
    </div>`;

    // party mates: same party_id as the player in a game
    const mates = {};
    G.forEach((g) => (g.m.players || []).forEach((p) => {
      if (p.puuid === g.me.puuid || !p.party_id || p.party_id !== g.me.party_id) return;
      const e = (mates[p.puuid] ||= { name: p.name, tag: p.tag, n: 0, w: 0, ag: {} });
      e.n++;
      if (g.res === 'w') e.w++;
      const a = agentOf(p.agent?.id, p.agent?.name);
      e.ag[a.slug || a.name] = a;
    }));
    const list = Object.values(mates).sort((a, b) => b.n - a.n).slice(0, 8);
    if (!list.length) drop($('vpMates'));
    else $('vpMates').innerHTML = `<div class="vp-mates">${list.map((e) => {
      const link = okName(e.name) && okTag(e.tag);
      const inner = `<span class="vp-mate-ags">${Object.values(e.ag).slice(0, 3).map((a) => agentIcon(a, 28)).join('')}</span><span class="vp-mate-txt"><b>${esc(e.name)}<i>#${esc(e.tag)}</i></b><small>${e.n} game${e.n > 1 ? 's' : ''} together · ${pct(e.w, e.n)} won</small></span>`;
      return link ? `<a class="vp-mate" href="${href(e.name, e.tag)}">${inner}</a>` : `<div class="vp-mate">${inner}</div>`;
    }).join('')}</div>`;

    $('vpForm').addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (b) openMatch(b.dataset.m);
    });
    drawWeapons();
  }

  /* ---- main agent: the agent page's stage + file ---- */
  function agentStats(games) {
    const by = {};
    games.forEach((g) => {
      const key = g.ag.slug || g.ag.name;
      const e = (by[key] ||= { ag: g.ag, n: 0, w: 0, k: 0, d: 0, a: 0, acs: 0, r: 0, hs: 0, sh: 0, dmg: 0, maps: {}, casts: [0, 0, 0, 0], ct: 0 });
      e.n++;
      if (g.res === 'w') e.w++;
      e.k += g.k, e.d += g.d, e.a += g.a, e.acs += g.acs, e.r += g.rounds, e.hs += g.hs, e.sh += g.hs + g.bs + g.ls, e.dmg += g.dmg;
      e.maps[g.map] = (e.maps[g.map] || 0) + 1;
      const c = g.me?.ability_casts;
      if (c && g.rounds) (e.casts = [e.casts[0] + (c.grenade || 0), e.casts[1] + (c.ability1 || 0), e.casts[2] + (c.ability2 || 0), e.casts[3] + (c.ultimate || 0)]), (e.ct += g.rounds);
    });
    return Object.values(by).sort((a, b) => b.n - a.n || b.w - a.w);
  }
  const playable = () => S.games.filter((g) => !NO_ROUNDS.includes(g.mk));
  function drawMain() {
    const box = $('vpMain');
    const list = agentStats(playable());
    if (!list.length) return drop(box);
    const e = list[0], a = e.ag;
    const top = Object.entries(e.maps).sort((x, y) => y[1] - x[1])[0];
    const keys = ['c', 'q', 'e', 'x'];
    box.innerHTML = `<div class="va-dossier vp-dossier" style="--ac:${a.ac};--ac2:${a.ac2}">
      <figure class="va-stage vp-stage">
        ${a.slug ? `<img class="va-stage-bg" src="/images/valorant/agents/${a.slug}-bg.webp" alt="" width="420" height="614" loading="lazy" decoding="async"><img class="va-stage-por" src="/images/valorant/agents/${a.slug}.webp" alt="${esc(a.name)}" width="1000" height="908" loading="lazy" decoding="async">` : ''}
        <figcaption>${a.role ? `<span class="va-role"><img src="/images/valorant/agents/role-${a.role.toLowerCase()}.webp" alt="" width="22" height="22" loading="lazy" decoding="async"></span>` : ''}${esc(a.name)}</figcaption>
      </figure>
      <div class="va-file">
        <div class="va-roleline">${agentIcon(a, 40)}<p><b>${esc(a.name)}</b>Picked in ${e.n} of their last ${playable().length} games (${pct(e.n, playable().length)})${a.slug ? `. <a href="/valorant/agents/${a.slug}">${esc(a.name)}'s abilities and history</a>` : ''}.</p></div>
        <dl class="va-facts">
          <div><dt>Record</dt><dd>${e.w}W ${e.n - e.w}L</dd></div>
          <div><dt>Win %</dt><dd>${pct(e.w, e.n)}</dd></div>
          <div><dt>K/D</dt><dd>${ratio(e.k, e.d)}</dd></div>
          <div><dt>KDA</dt><dd>${ratio(e.k + e.a, e.d)}</dd></div>
          <div><dt>ACS</dt><dd>${num(e.r ? e.acs / e.r : NaN)}</dd></div>
          <div><dt>ADR</dt><dd>${num(e.r ? e.dmg / e.r : NaN)}</dd></div>
          <div><dt>Headshot %</dt><dd>${pct(e.hs, e.sh, 1)}</dd></div>
          <div><dt>Top map</dt><dd title="${top ? `${top[1]} game${top[1] > 1 ? 's' : ''} there` : ''}">${top ? esc(top[0]) : '-'}</dd></div>
        </dl>
        ${e.ct && a.slug ? `<div class="vp-casts"><small>Abilities a round (last ${S.recent.length} games)</small><div>${keys.map((k, i) => `<span><img src="/images/valorant/agents/${a.slug}-${k}.webp" alt="" width="36" height="36" loading="lazy" decoding="async"><kbd>${k.toUpperCase()}</kbd><b>${num(e.casts[i] / e.ct, 2)}</b></span>`).join('')}</div></div>` : ''}
      </div>
    </div>`;
  }

  function drawRoles() {
    const box = $('vpRoles');
    const G = playable();
    const n = { Duelist: 0, Initiator: 0, Controller: 0, Sentinel: 0 };
    G.forEach((g) => g.ag.role in n && n[g.ag.role]++);
    const all = Object.values(n).reduce((a, b) => a + b, 0);
    if (!all) return drop(box);
    const most = Math.max(...Object.values(n));
    box.innerHTML = `<ol class="vp-roles">${Object.entries(n).sort((a, b) => b[1] - a[1]).map(([r, v]) =>
      `<li><img src="/images/valorant/agents/role-${r.toLowerCase()}.webp" alt="" width="26" height="26" loading="lazy" decoding="async"><span>${r}</span><span class="vp-zbar"><i style="width:${(v / most) * 100}%"></i></span><b>${pct(v, all)}</b><small>${v} game${v === 1 ? '' : 's'}</small></li>`).join('')}</ol>`;
  }

  /* ---- matches: chips by mode, one row per game, a click opens the scoreboard ---- */
  const rrOf = (id) => S.rr.find((h) => h.match_id === id);
  function row(g, rich = true) {
    const r = rich && rrOf(g.id);
    const kd = g.d ? g.k / g.d : g.k;
    return `<span class="vp-row-map" style="--map:url('${mapCard(g.map)}')"><b>${esc(g.map)}</b><small>${esc(g.mode)}</small></span>
      <span class="vp-row-ag">${agentIcon(g.ag, 40)}</span>
      <span class="vp-row-res" data-r="${g.res}"><b>${resWord(g.res)}</b><small>${g.score.length && Number.isFinite(g.score[0]) ? `${g.score[0]}-${g.score[1]}` : g.place ? `#${g.place[0]} of ${g.place[1]}` : ''}</small></span>
      <span class="vp-row-kda"><b>${g.k} / ${g.d} / ${g.a}</b><small data-kd="${kd >= 1 ? 'up' : 'down'}">${num(kd, 2)} K/D</small></span>
      <span class="vp-row-n vp-hide-s"><b>${g.rounds ? num(g.acs / g.rounds) : '-'}</b><small>ACS</small></span>
      <span class="vp-row-n vp-hide-s"><b>${pct(g.hs, g.hs + g.bs + g.ls)}</b><small>HS</small></span>
      <span class="vp-row-n vp-hide-m"><b>${g.rounds ? num(g.dmg / g.rounds) : '-'}</b><small>ADR</small></span>
      <span class="vp-row-rr">${r ? `<b data-sign="${r.last_change > 0 ? 'up' : r.last_change < 0 ? 'down' : ''}">${r.last_change > 0 ? '+' : ''}${r.last_change}</b>${rankImg(r.tier?.id, 24)}` : g.tier >= 3 ? rankImg(g.tier, 24) : ''}</span>
      <span class="vp-row-when"><b>${ago(g.t)}</b><small>${mins(g.len)}</small></span>`;
  }
  function drawMatches() {
    const G = S.recent;
    const list = $('vpMatchList'), chips = $('vpModes');
    if (!G.length) return drop(list);
    const modes = [...new Map(G.map((g) => [g.mk, g.mode])).entries()];
    let pick = params().get('mode') || '';
    if (!modes.some(([k]) => k === pick)) pick = '';
    chips.innerHTML = [['', 'All'], ...modes].map(([k, n]) => `<button type="button" data-mode="${esc(k)}" aria-pressed="${k === pick}">${esc(n)}<span class="cb-n">${k ? G.filter((g) => g.mk === k).length : G.length}</span></button>`).join('');
    const paint = () => {
      list.innerHTML = G.filter((g) => !pick || g.mk === pick).map((g) => `<li><button type="button" class="vp-row" data-r="${g.res}" data-m="${esc(g.id)}">${row(g)}</button></li>`).join('');
    };
    chips.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      pick = b.dataset.mode;
      chips.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      setParam('mode', pick);
      paint();
    });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (b) openMatch(b.dataset.m);
    });
    paint();
  }
  function drawOld(ok) {
    const box = $('vpOld');
    if (!ok) return drop(box);
    const ids = new Set(S.recent.map((g) => g.id));
    const G = S.stored.filter((g) => !ids.has(g.id));
    if (!G.length) return drop(box);
    $('vpOldN').textContent = `${G.length} games`;
    box.innerHTML = G.map((g) => `<li class="vp-row vp-row--old" data-r="${g.res}">${row(g, false)}</li>`).join('');
  }

  /* ---- one game: header, scoreboard, rounds + their kills ---- */
  const dlg = $('vpDlg');
  function openFromAddress() {
    const id = params().get('m');
    if (id) openMatch(id, false);
  }
  function openMatch(id, push = true) {
    const g = S.recent.find((x) => x.id === id);
    if (!g) return;
    const m = g.m, rounds = m.rounds || [];
    const players = m.players || [];
    const rn = rounds.length || 1;
    // per-player numbers the scoreboard needs from kills: first kills, multi-kills, KAST
    const per = {};
    players.forEach((p) => (per[p.puuid] = { fk: 0, mk: 0, kast: 0 }));
    const byRound = {};
    (m.kills || []).forEach((k) => (byRound[k.round] ||= []).push(k));
    rounds.forEach((r, i) => {
      const ks = (byRound[r.id ?? i] || []).slice().sort((a, b) => a.time_in_round_in_ms - b.time_in_round_in_ms);
      if (ks[0]?.killer && per[ks[0].killer.puuid]) per[ks[0].killer.puuid].fk++;
      const cnt = {};
      ks.forEach((k) => k.killer && (cnt[k.killer.puuid] = (cnt[k.killer.puuid] || 0) + 1));
      Object.entries(cnt).forEach(([p, n]) => n >= 3 && per[p] && per[p].mk++);
      players.forEach((p) => {
        const death = ks.find((k) => k.victim?.puuid === p.puuid);
        const did = ks.some((k) => k.killer?.puuid === p.puuid || (k.assistants || []).some((x) => x?.puuid === p.puuid));
        const traded = death && ks.some((k) => k.victim?.puuid === death.killer?.puuid && k.killer?.team === p.team_id && k.time_in_round_in_ms >= death.time_in_round_in_ms && k.time_in_round_in_ms - death.time_in_round_in_ms <= 5000);
        if (did || !death || traded) per[p.puuid].kast++;
      });
    });
    const teams = [...new Set(players.map((p) => p.team_id))].sort((a, b) => (a === g.me.team_id ? -1 : b === g.me.team_id ? 1 : 0));
    const teamObj = (t) => (m.teams || []).find((x) => x.team_id === t);
    const dm = teams.length > 2;
    const board = (list, title) => `<div class="gs-table-wrap vp-board-wrap"><table class="gs-table vp-board">
      <caption>${title}</caption>
      <thead><tr><th scope="col">Player</th><th scope="col">ACS</th><th scope="col">K</th><th scope="col">D</th><th scope="col">A</th><th scope="col">+/-</th>${rounds.length ? '<th scope="col">KAST</th>' : ''}<th scope="col">ADR</th><th scope="col">HS%</th>${rounds.length ? '<th scope="col">FK</th><th scope="col">MK</th>' : ''}</tr></thead>
      <tbody>${list.sort((a, b) => (b.stats?.score || 0) - (a.stats?.score || 0)).map((p) => {
        const s = p.stats || {}, a = agentOf(p.agent?.id, p.agent?.name), sh = (s.headshots || 0) + (s.bodyshots || 0) + (s.legshots || 0);
        const name = okName(p.name) && okTag(p.tag) && p.puuid !== g.me.puuid ? `<a href="${href(p.name, p.tag)}">${esc(p.name)}<i>#${esc(p.tag)}</i></a>` : `<span>${esc(p.name)}<i>#${esc(p.tag)}</i></span>`;
        const diff = (s.kills || 0) - (s.deaths || 0);
        return `<tr${p.puuid === g.me.puuid ? ' class="is-me"' : ''}><th scope="row"><span class="vp-pl">${agentIcon(a, 32)}<span class="vp-pl-txt">${name}<small>${esc(a.name)}</small></span>${rankImg(p.tier?.id, 22)}</span></th>
          <td>${num((s.score || 0) / rn)}</td><td>${s.kills ?? 0}</td><td>${s.deaths ?? 0}</td><td>${s.assists ?? 0}</td><td data-sign="${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${diff > 0 ? '+' : ''}${diff}</td>
          ${rounds.length ? `<td>${pct(per[p.puuid].kast, rn)}</td>` : ''}<td>${num((s.damage?.dealt || 0) / rn)}</td><td>${pct(s.headshots || 0, sh)}</td>${rounds.length ? `<td>${per[p.puuid].fk}</td><td>${per[p.puuid].mk}</td>` : ''}</tr>`;
      }).join('')}</tbody></table></div>`;
    const boards = dm ? board(players.slice(), 'Everyone')
      : teams.map((t) => board(players.filter((p) => p.team_id === t), `${t === g.me.team_id ? 'Their team' : 'Enemy team'} · ${t} · ${teamObj(t)?.rounds?.won ?? ''} rounds${teamObj(t)?.won ? ' · won' : ''}`)).join('');
    const RES = { Elimination: 'Elim', Eliminated: 'Elim', Defuse: 'Defuse', Defused: 'Defuse', Detonate: 'Spike', Detonated: 'Spike', Surrendered: 'FF' };
    const timeline = rounds.length ? `<div class="vp-rounds" role="group" aria-label="Rounds">${rounds.map((r, i) =>
      `${i === 12 ? '<span class="vp-half" aria-hidden="true">Half</span>' : i === 24 ? '<span class="vp-half" aria-hidden="true">OT</span>' : ''}<button type="button" class="vp-rd" data-i="${i}" data-r="${r.winning_team === g.me.team_id ? 'w' : 'l'}" aria-pressed="${i === 0}" title="Round ${i + 1}: ${esc(r.result || '')}${r.plant ? ' · planted ' + esc(r.plant.site || '') : ''}"><b>${i + 1}</b><small>${esc(RES[r.result] || (r.result || '').slice(0, 6))}</small></button>`).join('')}</div><div class="vp-feed" id="vpFeed"></div>` : '';
    const byId = Object.fromEntries(players.map((p) => [p.puuid, p]));
    const feed = (i) => {
      const r = rounds[i], ks = (byRound[r.id ?? i] || []).slice().sort((a, b) => a.time_in_round_in_ms - b.time_in_round_in_ms);
      const mine = (r.stats || []).find((s) => s.player?.puuid === g.me.puuid);
      const who = (x) => { const p = byId[x?.puuid] || {}; const a = agentOf(p.agent?.id, p.agent?.name); return `<span class="vp-k-who" data-side="${p.team_id === g.me.team_id ? 'us' : 'them'}">${agentIcon(a, 26)}<b>${esc(p.name || '?')}</b></span>`; };
      $('vpFeed').innerHTML = `<p class="vp-feed-head"><b>Round ${i + 1}</b> · ${r.winning_team === g.me.team_id ? 'Won' : 'Lost'} by ${esc((r.result || '').toLowerCase())}${r.plant ? ` · spike planted on ${esc(r.plant.site)} at ${clock(r.plant.round_time_in_ms)}` : ''}${r.defuse ? ` · defused at ${clock(r.defuse.round_time_in_ms)}` : ''}${mine?.economy ? ` · their buy: ${esc(mine.economy.weapon?.name || 'nothing')}${mine.economy.armor?.name ? ' + ' + esc(mine.economy.armor.name) : ''} (${num(mine.economy.loadout_value)} credits)` : ''}</p>
        ${ks.length ? `<ol class="vp-kills">${ks.map((k) => `<li${k.killer?.puuid === g.me.puuid || k.victim?.puuid === g.me.puuid ? ' class="is-me"' : ''}><span class="vp-k-t">${clock(k.time_in_round_in_ms)}</span>${who(k.killer)}<span class="vp-k-gun">${gunIcon(k.weapon) ? `<img src="${gunIcon(k.weapon)}" alt="${esc(k.weapon.name)}" loading="lazy" decoding="async">` : `<small>${esc(k.weapon?.name || '')}</small>`}${Number.isFinite(dist(k)) ? `<small>${num(dist(k), 0)} m</small>` : ''}</span>${who(k.victim)}</li>`).join('')}</ol>` : '<p class="vp-empty">No kills this round.</p>'}`;
    };
    dlg.innerHTML = `<div class="vp-dlg-in">
      <header class="vp-dlg-head" style="--map:url('${mapCard(g.map)}')">
        <button type="button" class="vw-x vp-x" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        <p class="cb-kicker">${esc(g.mode)} · ${new Date(g.t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${mins(g.len)}</p>
        <h2 class="vp-dlg-title" id="vpDlgTitle">${esc(g.map)}</h2>
        <p class="vp-dlg-score" data-r="${g.res}"><b>${resWord(g.res)}</b>${g.score.length && Number.isFinite(g.score[0]) ? ` <span>${g.score[0]} - ${g.score[1]}</span>` : g.place ? ` <span>#${g.place[0]} of ${g.place[1]}</span>` : ''}</p>
        <p class="vp-dlg-me">${agentIcon(g.ag, 32)}<span>${esc(g.ag.name)} · ${g.k} / ${g.d} / ${g.a}${g.rounds ? ` · ${num(g.acs / g.rounds)} ACS` : ''}</span></p>
      </header>
      <div class="vp-dlg-body">
        ${timeline ? `<h3 class="vp-h">Rounds</h3>${timeline}` : ''}
        <h3 class="vp-h">Scoreboard</h3>${boards}
      </div></div>`;
    dlg.setAttribute('aria-labelledby', 'vpDlgTitle');
    if (rounds.length) {
      feed(0);
      dlg.querySelector('.vp-rounds').addEventListener('click', (e) => {
        const b = e.target.closest('[data-i]');
        if (!b) return;
        dlg.querySelectorAll('.vp-rd').forEach((x) => x.setAttribute('aria-pressed', x === b));
        feed(+b.dataset.i);
      });
    }
    dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
    if (push) setParam('m', id);
  }
  dlg.addEventListener('close', () => setParam('m', ''));
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());

  /* ---- agents tab: the agent pages' cards, their numbers on the plate ---- */
  function drawAgents() {
    const box = $('vpAgents'), tbl = $('vpAgentRows');
    const list = agentStats(playable());
    if (!list.length) return drop(box), drop(tbl);
    $('vpAgentsN').textContent = `${playable().length} games`;
    box.innerHTML = list.map((e) => {
      const a = e.ag, tag = a.slug ? 'a' : 'div';
      return `<${tag} class="va-card vp-card"${a.slug ? ` href="/valorant/agents/${a.slug}"` : ''} style="--ac:${a.ac};--ac2:${a.ac2}">
        <span class="va-pic">${a.slug ? `<img class="va-bgtxt" src="/images/valorant/agents/${a.slug}-bg.webp" alt="" width="420" height="614" loading="lazy" decoding="async"><img class="va-por" src="/images/valorant/agents/${a.slug}-card.webp?v=20261030c" alt="" width="480" height="640" loading="lazy" decoding="async">` : ''}
          ${a.role ? `<span class="va-role" title="${a.role}"><img src="/images/valorant/agents/role-${a.role.toLowerCase()}.webp" alt="" width="20" height="20" loading="lazy" decoding="async"></span>` : ''}
          <span class="vp-card-n">${e.n} game${e.n > 1 ? 's' : ''}</span></span>
        <span class="va-plate"><span class="va-head"><span class="va-name"><b>${esc(a.name)}</b><small>${esc(a.role || 'Agent')}</small></span><span class="va-date"><b>${pct(e.w, e.n)}</b>won</span></span>
          <span class="vp-card-stats"><span><b>${ratio(e.k, e.d)}</b><small>K/D</small></span><span><b>${num(e.r ? e.acs / e.r : NaN)}</b><small>ACS</small></span><span><b>${pct(e.hs, e.sh)}</b><small>HS</small></span></span></span>
      </${tag}>`;
    }).join('');
    tbl.innerHTML = list.map((e) => `<tr><th scope="row"><span class="vp-pl">${agentIcon(e.ag, 28)}<span class="vp-pl-txt"><span>${esc(e.ag.name)}</span><small>${esc(e.ag.role)}</small></span></span></th><td>${e.n}</td><td>${e.w}-${e.n - e.w}</td><td>${pct(e.w, e.n)}</td><td>${ratio(e.k, e.d)}</td><td>${ratio(e.k + e.a, e.d)}</td><td>${num(e.r ? e.acs / e.r : NaN)}</td><td>${num(e.r ? e.dmg / e.r : NaN)}</td><td>${pct(e.hs, e.sh, 1)}</td></tr>`).join('');
  }

  /* ---- maps tab: every map they've played, with sides from the recent games ---- */
  function drawMaps() {
    const box = $('vpMaps');
    const by = {};
    playable().forEach((g) => {
      const e = (by[g.map] ||= { map: g.map, n: 0, w: 0, k: 0, d: 0, acs: 0, r: 0, atk: [0, 0], def: [0, 0], ags: {} });
      e.n++;
      if (g.res === 'w') e.w++;
      e.k += g.k, e.d += g.d, e.acs += g.acs, e.r += g.rounds;
      const k = g.ag.slug || g.ag.name;
      (e.ags[k] ||= { ag: g.ag, n: 0 }).n++;
      if (g.x) (e.atk[0] += g.x.atk[0]), (e.atk[1] += g.x.atk[1]), (e.def[0] += g.x.def[0]), (e.def[1] += g.x.def[1]);
    });
    const list = Object.values(by).sort((a, b) => b.n - a.n);
    if (!list.length) return drop(box);
    box.innerHTML = list.map((e) => {
      const best = Object.values(e.ags).sort((a, b) => b.n - a.n).slice(0, 3);
      const side = (lbl, s) => `<span class="vp-side"><small>${lbl}</small><span class="vp-zbar"><i style="width:${s[1] ? (s[0] / s[1]) * 100 : 0}%"></i></span><b>${s[1] ? pct(s[0], s[1]) : '-'}</b></span>`;
      return `<a class="vp-map" href="/valorant/maps/${slug(e.map)}">
        <span class="vp-map-pic"><img src="${mapCard(e.map)}" alt="" width="720" height="405" loading="lazy" decoding="async" onerror="this.remove()"><b>${esc(e.map)}</b><span class="vp-map-wr" data-good="${e.w / e.n >= 0.5}">${pct(e.w, e.n)}</span></span>
        <span class="vp-map-body">
          <span class="vp-map-line"><span>${e.n} game${e.n > 1 ? 's' : ''} · ${e.w}W ${e.n - e.w}L</span><span>${ratio(e.k, e.d)} K/D · ${num(e.r ? e.acs / e.r : NaN)} ACS</span></span>
          ${e.atk[1] || e.def[1] ? side('Attack rounds', e.atk) + side('Defense rounds', e.def) : '<span class="vp-map-note">Sides come from the last ${S.recent.length} games</span>'}
          <span class="vp-map-ags">${best.map((b) => agentIcon(b.ag, 28)).join('')}<small>most played here</small></span>
        </span></a>`;
    }).join('');
  }

  /* ---- weapons tab: kills per gun, kill distances, buys (all from the recent games' kills + rounds) ---- */
  function drawWeapons() {
    const D = S.recent.filter((g) => g.x);
    const guns = {}, dist = [], buys = {}, armor = { Heavy: 0, Light: 0, None: 0 };
    let rounds = 0, value = 0;
    D.forEach((g) => {
      Object.entries(g.x.guns).forEach(([k, v]) => {
        const e = (guns[k] ||= { w: v.w, n: 0, dist: [] });
        e.n += v.n;
        e.dist.push(...v.dist);
      });
      dist.push(...g.x.dist);
      g.x.buys.forEach((b) => {
        rounds++;
        value += b.value;
        const n = b.gun?.name || 'Nothing';
        (buys[n] ||= { w: b.gun, n: 0 }).n++;
        const ar = /heavy/i.test(b.armor?.name || '') ? 'Heavy' : /light|regen/i.test(b.armor?.name || '') ? 'Light' : 'None';
        armor[ar]++;
      });
    });
    const kills = Object.values(guns).reduce((a, e) => a + e.n, 0);
    if (!kills) ['vpGuns', 'vpDist'].forEach((id) => drop($(id)));
    else {
      let list = Object.values(guns).sort((a, b) => b.n - a.n);
      if (list.length > 13) {
        const rest = list.slice(12);
        list = [...list.slice(0, 12), { w: { name: `${rest.length} more`, type: 'Everything else' }, n: rest.reduce((a, e) => a + e.n, 0), dist: rest.flatMap((e) => e.dist) }];
      }
      const most = Math.max(...list.map((e) => e.n));
      const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN);
      $('vpGuns').innerHTML = `<ol class="vp-guns">${list.map((e) => `<li><span class="vp-gun-pic">${gunIcon(e.w) ? `<img src="${gunIcon(e.w)}" alt="" loading="lazy" decoding="async">` : ''}</span><span class="vp-gun-name"><b>${esc(e.w.name || 'Other')}</b><small>${esc(e.w.type === 'Weapon' ? '' : e.w.type || '')}</small></span><span class="vp-zbar"><i style="width:${(e.n / most) * 100}%"></i></span><b class="vp-gun-n">${e.n}</b><small class="vp-gun-s">${pct(e.n, kills)} of kills${e.dist.length ? ` · ${num(avg(e.dist), 0)} m avg` : ''}</small></li>`).join('')}</ol>`;
      // kill distances in 5 m buckets up to 40 m+
      if (dist.length) {
        const B = [0, 5, 10, 15, 20, 25, 30, 40];
        const cnt = B.map((b, i) => dist.filter((d) => d >= b && (i === B.length - 1 || d < B[i + 1])).length);
        const top = Math.max(...cnt);
        $('vpDist').innerHTML = `<div class="vp-hist" role="img" aria-label="Kills by distance">${cnt.map((c, i) => `<span class="vp-hist-col" title="${c} kills at ${B[i]}${i === B.length - 1 ? '+' : '-' + B[i + 1]} m"><b>${c}</b><i style="height:${top ? (c / top) * 100 : 0}%"></i><small>${B[i]}${i === B.length - 1 ? '+' : ''}</small></span>`).join('')}</div>
          <p class="vp-hist-foot">Metres from the killer to the victim, flat on the map. Average <b>${num(avg(dist), 1)} m</b>, longest <b>${num(Math.max(...dist), 0)} m</b>.</p>`;
      } else drop($('vpDist'));
    }
    if (!rounds) return drop($('vpBuys'));
    const bl = Object.entries(buys).sort((a, b) => b[1].n - a[1].n).slice(0, 8);
    $('vpBuys').innerHTML = `<div class="vp-tiles vp-tiles--3">${tile('Average loadout', num(value / rounds), 'Credits on them a round')}${tile('Heavy shields', pct(armor.Heavy, rounds), `${armor.Heavy} of ${rounds} rounds`)}${tile('No shields', pct(armor.None, rounds), 'Saves and pistol rounds')}</div>
      <ol class="vp-guns vp-guns--buys">${bl.map(([n, e]) => `<li><span class="vp-gun-pic">${e.w?.id ? `<img src="https://media.valorant-api.com/weapons/${encodeURIComponent(e.w.id)}/killstreamicon.png" alt="" loading="lazy" decoding="async">` : ''}</span><span class="vp-gun-name"><b>${esc(n)}</b></span><span class="vp-zbar"><i style="width:${(e.n / bl[0][1].n) * 100}%"></i></span><b class="vp-gun-n">${pct(e.n, rounds)}</b><small class="vp-gun-s">${e.n} rounds</small></li>`).join('')}</ol>`;
  }

  /* ---- acts tab ---- */
  function drawActs() {
    const box = $('vpActs');
    const list = acts().filter((a) => a.games).reverse();
    if (!list.length) return drop(box);
    const most = Math.max(...list.map((a) => a.games));
    box.innerHTML = `<ol class="vp-acts">${list.map((a, i) => `<li${i === 0 ? ' class="is-now"' : ''}>
      <span class="vp-act-ico">${rankImg(a.end, 52) || '<i>?</i>'}</span>
      <span class="vp-act-txt"><small>${esc(actName(a.act))}${i === 0 ? ' · latest' : ''}</small><b>${tierName(a.end)}</b>${a.lb ? `<em>#${num(a.lb)} on the leaderboard</em>` : ''}</span>
      <span class="vp-act-rec"><b>${num(a.wins)}W ${num(a.games - a.wins)}L</b><small>${pct(a.wins, a.games)} won</small><span class="vp-zbar"><i style="width:${(a.games / most) * 100}%"></i></span></span>
      <span class="vp-best">${(a.best || []).slice(0, 9).map((t) => rankImg(t, 24)).join('')}</span>
    </li>`).join('')}</ol>`;
  }

  /* ---- tabs (?tab=) ---- */
  function wireTabs() {
    const tray = $('vpTabs');
    const show = (t, push) => {
      if (!TABS.includes(t)) t = 'overview';
      tray.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === t));
      document.querySelectorAll('.vp-panel').forEach((p) => (p.hidden = p.dataset.tab !== t));
      if (push) setParam('tab', t === 'overview' ? '' : t);
    };
    tray.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (b) show(b.dataset.tab, true);
    });
    show(params().get('tab'), false);
    $('vpCopy').addEventListener('click', async (e) => {
      try {
        await navigator.clipboard.writeText(location.href);
        e.currentTarget.dataset.done = '';
        setTimeout(() => delete $('vpCopy').dataset.done, 1600);
      } catch {}
    });
    return show;
  }

  /* ---- find another player + the last ones you opened (localStorage vl-recent) ---- */
  function wireFind() {
    document.querySelectorAll('[data-vp-find]').forEach((form) =>
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = form.querySelector('[name=n]').value.trim(), tag = form.querySelector('[name=t]').value.trim().replace(/^#/, '');
        const st = form.parentElement.querySelector('.vh-status');
        if (!okName(name) || !okTag(tag)) {
          st.textContent = 'A Riot ID is a name of 3-16 characters and a tag of 3-5 letters or numbers.';
          st.dataset.err = '';
          return;
        }
        location.href = href(name, tag);
      }),
    );
  }
  // function declarations, not consts: drawRecent() runs at the top of the page script
  function readRecent() {
    try {
      return JSON.parse(localStorage.getItem('vl-recent') || '[]').filter((x) => okName(x.n) && okTag(x.t));
    } catch {
      return [];
    }
  }
  function remember(n, t, card) {
    try {
      const list = [{ n, t, card }, ...readRecent().filter((x) => (x.n + '#' + x.t).toLowerCase() !== (n + '#' + t).toLowerCase())].slice(0, 6);
      localStorage.setItem('vl-recent', JSON.stringify(list));
    } catch {}
  }
  function drawRecent() {
    const list = readRecent();
    document.querySelectorAll('[data-vp-recent]').forEach((box) => {
      box.innerHTML = list.length ? `<small class="vp-recent-l">Opened lately</small>${list.map((x) => `<a class="vp-recent" href="${href(x.n, x.t)}">${/^https:\/\//.test(x.card) ? `<img src="${esc(x.card)}" alt="" width="28" height="28" loading="lazy">` : ''}<span>${esc(x.n)}<i>#${esc(x.t)}</i></span></a>`).join('')}` : '';
    });
  }

  // the old tracker's Firestore log (trackervalorant-42e14 "searches"), loaded only once a player opens
  function log(name, tag, region) {
    Promise.all([
      import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js'),
    ]).then(([app, fs]) => {
      const db = fs.getFirestore(app.initializeApp({
        apiKey: 'AIzaSyCo88EeZQQW17cXSB97UXz0tuZbB_CgWMo',
        authDomain: 'trackervalorant-42e14.firebaseapp.com',
        projectId: 'trackervalorant-42e14',
        storageBucket: 'trackervalorant-42e14.firebasestorage.app',
        messagingSenderId: '1058942511167',
        appId: '1:1058942511167:web:0c921d734162d881df708a',
      }));
      return fs.addDoc(fs.collection(db, 'searches'), { name, tag, region, page: 'valorant-player', userAgent: navigator.userAgent, timestamp: fs.serverTimestamp() });
    }).catch((err) => console.warn('Search log failed:', err)); // logging never blocks the page
  }
})();
