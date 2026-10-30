// Valorant Lobby (Oct 30 2026, Adrian: full rebuild on the Weapons shell, player search in the hero).
// Everything on /valorant/ that isn't 11layout's chrome:
// 1. Hero facts: act + patch from /valorant-weapons.json (scripts/valorant-feed.mjs, daily), pool count from 4.
// 2. Player search: HenrikDev through our Worker (cloudflare/valorant-api: the key never reaches the page).
//    Results draw under the hero until /valorant/player/<name>-<tag> exists. Searches are logged to the
//    old tracker's Firestore (trackervalorant-42e14 "searches"), Firebase loaded only on the first search.
// 3. Every page: one card per game-nav.json Valorant page, by tab ("soon" = grey, not a link).
// 4. Map pool, 5. Top of the ladder, 6. Events (vlr.orlandomm.net), 7. News (VLR's RSS via the Worker).
// Real numbers only (Adrian): a source that fails says so, never a hand-typed stand-in.
(function () {
  const API = 'https://parchrome-valorant.adriantulabut5747.workers.dev/api/valorant';
  const api = (type, q) => API + '?type=' + type + (q ? '&' + new URLSearchParams(q) : '');
  const REGIONS = ['na', 'eu', 'ap', 'kr', 'latam', 'br']; // = the Worker's list
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const getJSON = (url, ms = 6000) =>
    fetch(url, { signal: AbortSignal.timeout(ms) }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(url + ' ' + r.status))));
  const shared = (url) => (window.pcJSON ? window.pcJSON(url) : getJSON(url));
  const say = (el, msg) => (el.innerHTML = `<p class="vl-empty">${msg}</p>`);
  const rankIcon = (tier) => (tier >= 3 && tier <= 27 ? `/images/valorant/ranks/${tier}.webp` : '');
  const fact = (id, b, em) => {
    const f = $(id);
    f.querySelector('b').textContent = b;
    f.querySelector('em').innerHTML = em;
    f.hidden = false;
  };

  /* ---- 1. hero facts ---- */
  shared('/valorant-weapons.json')
    .then((d) => {
      const now = Date.now();
      const act = (d.acts || []).find((a) => Date.parse(a.start) <= now && now < Date.parse(a.end));
      if (act) {
        const end = new Date(act.end);
        fact('vlAct', (act.ep ? act.ep + ' ' : '') + act.name,
          `<i>${Math.ceil((end - now) / 864e5)}d left</i> · ends ` + end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      }
      if (d.patch && d.patch.branch) fact('vlPatch', d.patch.branch, 'Live patch');
    })
    .catch((err) => console.warn('Act / patch unavailable:', err));

  /* ---- 2. player search ---- */
  const form = $('vlFind');
  const status = $('vlStatus');
  const out = $('vlPlayer');
  let logSearch = null;
  const log = (name, tag, region) => {
    logSearch = logSearch || Promise.all([
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
      return (doc) => fs.addDoc(fs.collection(db, 'searches'), { ...doc, timestamp: fs.serverTimestamp() });
    });
    logSearch
      .then((add) => add({ name, tag, region, page: 'valorant-home', userAgent: navigator.userAgent }))
      .catch((err) => console.warn('Search log failed:', err)); // logging never blocks the search
  };

  const henrik = async (url) => {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const e = body?.errors?.[0] || {};
      // Henrik 24 = the account exists but has no recent match to read it from
      throw new Error(e.code === 24 ? "That account has no recent matches, so it can't be looked up yet."
        : res.status === 404 ? 'No player with that Riot ID.' : e.message || `The tracker isn't answering (${res.status}).`);
    }
    return res.json();
  };

  // HenrikDev's match shape has moved between versions ("red"/"blue" keys vs an array of {team_id}):
  // these try the known variants instead of trusting one, so win / loss can't silently break.
  const findPlayer = (m, puuid, name, tag) => {
    const ps = m.players || [];
    return ps.find((p) => p.puuid && puuid && p.puuid.toLowerCase() === puuid.toLowerCase())
      || ps.find((p) => p.name?.toLowerCase() === name.toLowerCase() && p.tag?.toLowerCase() === tag.toLowerCase());
  };
  const teamOf = (m, id) => {
    if (!m?.teams || !id) return null;
    id = String(id).toLowerCase();
    if (Array.isArray(m.teams)) return m.teams.find((t) => String(t.team_id || t.id || t.team || '').toLowerCase() === id) || null;
    const k = Object.keys(m.teams).find((x) => x.toLowerCase() === id);
    return k ? m.teams[k] : null;
  };
  const won = (t) => !!(t && (t.has_won ?? t.won ?? t.winner));
  const roundsWon = (t) => (t ? [t.rounds_won, t.rounds?.won, t.rounds, t.score].find((v) => typeof v === 'number') ?? '' : '');

  function summary(matches, puuid, name, tag) {
    const sum = { w: 0, l: 0, k: 0, d: 0, a: 0, score: 0, rounds: 0, hs: 0, shots: 0 };
    const agents = {};
    matches.forEach((m) => {
      const p = findPlayer(m, puuid, name, tag);
      if (!p) return;
      const win = won(teamOf(m, p.team_id || p.team));
      const s = p.stats || {};
      win ? sum.w++ : sum.l++;
      sum.k += s.kills || 0;
      sum.d += s.deaths || 0;
      sum.a += s.assists || 0;
      sum.score += s.score || 0;
      sum.hs += s.headshots || 0;
      sum.shots += (s.headshots || 0) + (s.bodyshots || 0) + (s.legshots || 0);
      sum.rounds += (Number(roundsWon(teamOf(m, 'red'))) || 0) + (Number(roundsWon(teamOf(m, 'blue'))) || 0) || m.metadata?.rounds_played || 0;
      const a = (agents[p.agent?.name || 'Unknown'] ||= { id: p.agent?.id, n: 0, w: 0, k: 0, d: 0 });
      a.n++;
      if (win) a.w++;
      a.k += s.kills || 0;
      a.d += s.deaths || 0;
    });
    sum.top = Object.entries(agents).sort((x, y) => y[1].n - x[1].n).slice(0, 5);
    return sum;
  }

  const agentPic = (id) => (id ? `https://media.valorant-api.com/agents/${encodeURIComponent(id)}/displayicon.png` : '');
  const kd = (k, d) => (d ? k / d : k).toFixed(2);

  function draw(acc, mmr, matches, name, tag, notes) {
    const cur = mmr?.current_data || {};
    const peak = mmr?.highest_rank || {};
    const rank = (label, tier, title, sub) => `
      <div class="vt-rank"><span class="vt-rank-pic">${rankIcon(tier) ? `<img src="${rankIcon(tier)}" alt="" width="48" height="48">` : ''}</span>
        <span><small>${label}</small><b>${esc(title || 'Unranked')}</b><em>${esc(sub)}</em></span></div>`;
    let html = `
      <div class="vt-head">
        <span class="vt-card">${acc?.card?.small ? `<img src="${esc(acc.card.small)}" alt="" width="64" height="64">` : ''}</span>
        <div class="vt-who"><b>${esc(name)}<i>#${esc(tag)}</i></b><span>Level ${esc(acc?.account_level ?? '?')} · ${esc((acc?.region || '').toUpperCase())}</span></div>
        <div class="vt-ranks">
          ${rank('Rank', cur.currenttier, cur.currenttierpatched, cur.ranking_in_tier != null ? cur.ranking_in_tier + ' RR' : '')}
          ${rank('Peak', peak.tier, peak.patched_tier || peak.tier_patched, peak.season ? 'Season ' + peak.season : '')}
        </div>
      </div>`;
    if (notes.length) html += `<p class="vt-note">${esc(notes.join(' · '))}</p>`;
    if (!matches.length) {
      out.innerHTML = html + '<p class="vl-empty">No recent matches found.</p>';
      return;
    }
    const puuid = acc?.puuid;
    const s = summary(matches, puuid, name, tag);
    const played = s.w + s.l;
    const stat = (label, v) => `<div class="vt-stat"><small>${label}</small><b>${v}</b></div>`;
    html += `
      <p class="vt-sub">The last ${matches.length} matches, any mode.</p>
      <div class="vt-stats">
        ${stat('Record', `${s.w}W ${s.l}L`)}${stat('Win %', (played ? (s.w / played) * 100 : 0).toFixed(1) + '%')}
        ${stat('K/D', kd(s.k, s.d))}${stat('ACS', Math.round(s.rounds ? s.score / s.rounds : 0))}
        ${stat('Headshot %', (s.shots ? (s.hs / s.shots) * 100 : 0).toFixed(1) + '%')}
        ${stat('Kills', s.k)}${stat('Deaths', s.d)}${stat('Assists', s.a)}
      </div>
      <div class="vt-cols">
        <div><h3 class="vt-h">Top agents</h3><ol class="vt-list">${s.top.map(([n, a]) => `
          <li class="vt-row"><img src="${agentPic(a.id)}" alt="" width="36" height="36" loading="lazy"><b>${esc(n)}</b>
            <span>${a.n} played</span><span>${Math.round((a.w / a.n) * 100)}% won</span><span>${kd(a.k, a.d)} K/D</span></li>`).join('')}</ol></div>
        <div><h3 class="vt-h">Matches</h3><ol class="vt-list vt-matches">${matches.map((m) => {
          const p = findPlayer(m, puuid, name, tag);
          const st = p?.stats || {};
          const win = won(teamOf(m, p?.team_id || p?.team));
          return `<li class="vt-row vt-match" data-r="${win ? 'w' : 'l'}"><img src="${agentPic(p?.agent?.id)}" alt="" width="36" height="36" loading="lazy">
            <b>${esc(m.metadata?.map?.name || m.metadata?.map || 'Unknown map')}<small>${esc(m.metadata?.queue?.name || m.metadata?.mode || '')}</small></b>
            <span>${esc(roundsWon(teamOf(m, 'blue')))}-${esc(roundsWon(teamOf(m, 'red')))}</span><span>${st.kills ?? '-'}/${st.deaths ?? '-'}/${st.assists ?? '-'}</span></li>`;
        }).join('')}</ol></div>
      </div>`;
    out.innerHTML = html;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('vlName').value.trim();
    const tag = $('vlTag').value.trim().replace(/^#/, '');
    if (!name || !tag) {
      status.textContent = 'Type both the name and the tag.';
      status.dataset.err = '';
      return;
    }
    const key = form.querySelector('button');
    key.disabled = true;
    delete status.dataset.err;
    status.textContent = 'Searching...';
    try {
      const acc = (await henrik(api('account', { name, tag }))).data;
      // the account says where it plays: mmr + matches are per region (the old lobby forced Asia)
      const region = REGIONS.includes(acc?.region) ? acc.region : 'ap';
      log(name, tag, region);
      const q = { region, name, tag };
      // the matches endpoint stops at 10 a call: two pages = 20
      const [mmr, p1, p2] = await Promise.allSettled([
        henrik(api('mmr', q)),
        henrik(api('matches', { ...q, start: 0 })),
        henrik(api('matches', { ...q, start: 10 })),
      ]);
      const page = (r) => (r.status === 'fulfilled' ? r.value.data || [] : []);
      const matches = [...page(p1), ...page(p2)];
      const notes = [];
      if (mmr.status === 'rejected') notes.push('Rank unavailable');
      if (p1.status === 'rejected' && p2.status === 'rejected') notes.push('Match history unavailable');
      draw(acc, mmr.status === 'fulfilled' ? mmr.value.data : null, matches, acc?.name || name, acc?.tag || tag, notes);
      status.textContent = '';
      out.hidden = false;
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      status.textContent = err.message || 'No player with that Riot ID.';
      status.dataset.err = '';
    } finally {
      key.disabled = false;
    }
  });

  /* ---- 3. every page ---- */
  shared('/game-nav.json')
    .then((nav) => {
      const card = (p) => {
        const inner = `<span><b>${esc(p.name)}</b><span>${esc(p.sub || '')}</span></span><span class="ct-art" aria-hidden="true"><svg viewBox="0 0 24 24">${p.icon || ''}</svg></span>`;
        return p.soon || !p.link ? `<div class="ct-card ct-card--soon"><span class="ct-tag">Soon</span>${inner}</div>` : `<a class="ct-card" href="${esc(p.link)}">${inner}</a>`;
      };
      $('vlPages').innerHTML = nav.valorant.groups
        .filter((g) => g.pages && g.pages.length)
        .map((g) => `<div class="vl-group"><h3 class="vl-glabel"><svg viewBox="0 0 24 24" aria-hidden="true">${g.icon || ''}</svg>${esc(g.name)}</h3><div class="ct-grid">${g.pages.map(card).join('')}</div></div>`)
        .join('');
    })
    .catch((err) => console.warn('Page list unavailable:', err)); // the bar's menus need the same file, so they'd be gone too

  /* ---- 4. map pool (the Maps pages ask the same queue) ---- */
  getJSON(api('queue', { region: 'na' }))
    .then((j) => {
      const comp = (j.data || []).find((m) => m.mode_id === 'competitive');
      const live = (comp?.maps || []).filter((m) => m.enabled).map((m) => m.map.name).sort();
      if (!live.length) throw new Error('no competitive queue');
      const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      $('vlPool').innerHTML = live.map((n) => `
        <a class="vl-map" href="/valorant/maps/${slug(n)}"><img src="/images/valorant/maps/${slug(n)}-card.webp" alt="" width="720" height="405" loading="lazy" decoding="async"><b>${esc(n)}</b></a>`).join('');
      fact('vlPoolN', live.length + ' maps', 'In ranked now');
    })
    .catch((err) => {
      say($('vlPool'), 'The live map pool isn\'t answering right now. <a href="/valorant/maps/">Every map</a>');
      console.warn('Map pool unavailable:', err);
    });

  /* ---- 5. top of the ladder ----
     thresholds[].start_index = the leaderboard place a tier starts at (Radiant first), so the gap to the
     next one is that tier's size; the last runs to the end of the board. Same maths as valorant-ranks.js parseBoard(). */
  getJSON(api('leaderboard', { region: 'na' }))
    .then((j) => {
      const TIERS = [[27, 'Radiant'], [26, 'Immortal 3'], [25, 'Immortal 2'], [24, 'Immortal 1']];
      const th = (j.thresholds || []).map((t) => ({ id: Number(t.tier && t.tier.id), start: Number(t.start_index), rr: Number(t.threshold) }))
        .filter((t) => Number.isFinite(t.id) && Number.isFinite(t.start)).sort((a, b) => a.start - b.start);
      const base = th.length ? th[0].start : 1;
      const count = {}, rr = {};
      th.forEach((t, i) => {
        count[t.id] = Math.max(0, th[i + 1] ? th[i + 1].start - t.start : Number(j.total) - (t.start - base));
        rr[t.id] = t.rr;
      });
      const rows = TIERS.filter(([id]) => Number.isFinite(count[id]));
      if (!rows.length) throw new Error('no tiers');
      const most = Math.max(...rows.map(([id]) => count[id]), 1);
      $('vlLadder').innerHTML = rows.map(([id, name]) => `
        <li class="vl-tier" data-t="${id}"><img src="${rankIcon(id)}" alt="" width="28" height="28"><b>${name}</b>
          <span class="vl-bar"><i style="width:${(count[id] / most) * 100}%"></i></span>
          <span class="vl-n">${count[id].toLocaleString('en-US')}<small>${id > 24 && Number.isFinite(rr[id]) ? 'from ' + rr[id] + ' RR' : 'players'}</small></span></li>`).join('');
    })
    .catch((err) => {
      say($('vlLadder'), 'The live leaderboard isn\'t answering right now.');
      console.warn('Top of the ladder unavailable:', err);
    });

  /* ---- 6. events ---- */
  const EV = 'https://vlr.orlandomm.net/api/v1/events?page=1&region=all&status=';
  Promise.all([getJSON(EV + 'ongoing', 5000), getJSON(EV + 'upcoming', 5000)])
    .then(([on, up]) => {
      const evs = [...(on.data || []), ...(up.data || [])].slice(0, 5);
      if (!evs.length) throw new Error('no events');
      const prize = (p) => (parseInt(String(p).replace(/[^0-9]/g, ''), 10) || 0);
      $('vlEvents').innerHTML = evs.map((ev) => `
        <li><a class="vl-ev" href="${/^\d+$/.test(ev.id) ? 'https://www.vlr.gg/event/' + ev.id : 'https://www.vlr.gg/events'}" target="_blank" rel="noopener">
          <span class="vl-ev-pic">${/^https:\/\//.test(ev.img) ? `<img src="${esc(ev.img)}" alt="" width="40" height="40" loading="lazy" onerror="this.remove()">` : ''}</span>
          <span class="vl-ev-txt"><b>${esc(ev.name)}</b><span><i data-s="${esc(ev.status)}">${esc(ev.status)}</i>${esc(ev.dates || '')}${prize(ev.prizepool) ? ' · $' + prize(ev.prizepool).toLocaleString('en-US') : ''}</span></span>
        </a></li>`).join('');
    })
    .catch((err) => {
      say($('vlEvents'), 'The events list isn\'t answering right now. <a href="https://www.vlr.gg/events" target="_blank" rel="noopener">VLR.gg events</a>');
      console.warn('Events unavailable:', err);
    });

  /* ---- 7. news: VLR sends no CORS header, so the Worker fetches the feed (type=news) and an
     article's og:image (type=og) for items the feed ships without a picture ---- */
  fetch(api('news'), { signal: AbortSignal.timeout(6000) })
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error('news ' + r.status))))
    .then((xml) => {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const items = [...doc.querySelectorAll('item')].slice(0, 4);
      if (!items.length) throw new Error('empty feed');
      const txt = (el, t) => el.querySelector(t)?.textContent.trim() || '';
      const box = $('vlNews');
      box.innerHTML = items.map((it) => {
        const raw = txt(it, 'description');
        const desc = new DOMParser().parseFromString(raw, 'text/html').body.textContent.trim();
        const date = new Date(txt(it, 'pubDate'));
        const link = txt(it, 'link');
        const pic = it.querySelector('enclosure')?.getAttribute('url') || '';
        return `<a class="vl-news" href="${/^https:\/\//.test(link) ? esc(link) : 'https://www.vlr.gg/news'}" target="_blank" rel="noopener">
          <span class="vl-news-pic">${/^https:\/\//.test(pic) ? `<img src="${esc(pic)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>
          <b>${esc(txt(it, 'title'))}</b>
          ${desc ? `<span>${esc(desc.length > 140 ? desc.slice(0, 139) + '…' : desc)}</span>` : ''}
          <small>${isNaN(date) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</small></a>`;
      }).join('');
      box.querySelectorAll('.vl-news').forEach((a) => {
        if (a.querySelector('.vl-news-pic img') || !/^https:\/\/www\.vlr\.gg\//.test(a.href)) return;
        getJSON(api('og', { url: a.href }), 4000)
          .then((j) => {
            if (/^https:\/\//.test(j.img)) a.querySelector('.vl-news-pic').innerHTML = `<img src="${esc(j.img)}" alt="" loading="lazy" onerror="this.remove()">`;
          })
          .catch(() => {}); // no picture = the plain well
      });
    })
    .catch((err) => {
      say($('vlNews'), 'The news feed isn\'t answering right now. <a href="https://www.vlr.gg/news" target="_blank" rel="noopener">VLR.gg news</a>');
      console.warn('News unavailable:', err);
    });
})();
