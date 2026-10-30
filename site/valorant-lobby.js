// Valorant Lobby (Oct 30 2026, Adrian: full rebuild on the Weapons shell, player search in the hero).
// Everything on /valorant/ that isn't 11layout's chrome:
// 1. Hero facts: act + patch from /valorant-weapons.json (scripts/valorant-feed.mjs, daily), pool count from 4.
// 2. Player search: opens the player page /valorant/player/<name>-<tag> (valorant-player.js).
// 3. Every page: one card per game-nav.json Valorant page, by tab ("soon" = grey, not a link).
// 4. Map pool, 5. Top of the ladder, 6. Events (vlr.orlandomm.net), 7. News (VLR's RSS via the Worker).
// Real numbers only (Adrian): a source that fails says so, never a hand-typed stand-in.
(function () {
  const API = 'https://parchrome-valorant.adriantulabut5747.workers.dev/api/valorant';
  const api = (type, q) => API + '?type=' + type + (q ? '&' + new URLSearchParams(q) : '');
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

  /* ---- 2. player search: opens /valorant/player/<name>-<tag> (valorant-player.js draws it, and logs the search) ---- */
  // Riot ID rules = the Worker's cleanName / cleanTag; Pages can't rewrite addresses, so there it's ?id=
  const ON_PAGES = location.hostname.endsWith('github.io');
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
    const id = encodeURIComponent(name) + '-' + encodeURIComponent(tag);
    location.href = ON_PAGES ? '/valorant/player/?id=' + id : '/valorant/player/' + id;
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
