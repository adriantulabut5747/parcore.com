// Genshin Impact banners (/genshin-impact/banners; v3 Oct 27 2026, Adrian: "a fresh restart" of the
// banner box, kleefied like the Lobby). One card per live wish, all on the page (no tabs): the
// 5-star's wish art on its element, who they are, how many banners they've had and how long since
// the last one, the featured 4-stars, the countdown on the picked server, Build guide + Wish
// simulator. The rates under them are static HTML. #<wish> in the address (#skirk, #weapons) scrolls
// to that card; the Lobby's wish cards link that way.
// Data: GI.feed "banners" + /genshin-history.json (paimon.moe + our feed). Helpers: genshin-core.js.
// Counting = the Rerun tracker's rules: a 5-star's banners include Chronicled Wishes, a 4-star's
// are Event Wishes only. Feed text goes through esc().
(function () {
  const { $, esc, now, EL, NEUTRAL, parts, pad, srvEnd, srvDate, tile, elIcon } = window.GI;
  const DAY = 86400;
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const fiveOf = (b) => (b.characters || []).find((c) => c.rarity === 5);
  const label = (b) => (fiveOf(b) || { name: 'Weapons' }).name;
  const kind = (b) => (/weapon/i.test(b.name) ? 'Weapon Wish' : /chronicled/i.test(b.name) ? 'Chronicled Wish' : 'Event Wish');
  const nth = (n) => n + (n % 100 > 10 && n % 100 < 14 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const plural = (n, w) => n.toLocaleString() + ' ' + w + (n === 1 ? '' : 's');
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const CLOCK = '<span><b data-u="d">--</b><small>d</small></span><span><b data-u="h">--</b><small>h</small></span><span><b data-u="m">--</b><small>m</small></span><span><b data-u="s">--</b><small>s</small></span>';

  // ---- HISTORY: a character's banners before this one ----
  let hist = null; // null = history didn't load: no rerun lines then (never a false "New")
  function back(name, b, five) {
    if (!hist) return null;
    const before = hist.filter((h) => h.end < b.start && ((five ? h.five : h.kind === 'event' && h.four) || []).includes(name));
    const last = before[before.length - 1];
    return { n: before.length + 1, gap: last ? Math.round((b.start - last.end) / DAY) : 0 };
  }
  // The phase of this version: Event Wishes of the same version, by start.
  function phase(b) {
    if (!hist || !b.version || kind(b) === 'Chronicled Wish') return 0;
    const starts = [...new Set(hist.filter((h) => h.kind === 'event' && h.version === b.version).map((h) => h.start))].sort((x, y) => x - y);
    return starts.indexOf(+b.start) + 1;
  }
  const runLine = (r) => (!r ? '' : r.n === 1 ? '<b class="gbw-new">New</b><span>Their first banner ever</span>' : `<b>${nth(r.n)} banner</b><span>Back after ${plural(r.gap, 'day')}</span>`);

  // ---- ONE CARD ----
  function head(b, name, title) {
    const p = phase(b);
    return `<p class="gbw-tag"><span class="gi-label">${esc(kind(b))}${b.version ? ' &middot; ' + esc(b.version) : ''}</span>${p ? `<span class="gbw-phase">Phase ${p}</span>` : ''}</p>
      <h3 class="gbw-name">${esc(name)}</h3>${title}`;
  }
  const foot = (b, keys) => `<div class="gbw-foot">
      <div class="gbw-ends"><span class="gi-label">Ends in</span><div class="gi-clock-units" role="timer" aria-live="off" data-clock="${+b.end}">${CLOCK}</div><small>${srvDate(b.end)} server time</small></div>
      <div class="gbw-keys">${keys}<a class="gi-key" href="/genshin-impact/wish-simulator">Wish simulator${ARROW}</a></div></div>`;
  const fours = (list, labelText, sub) =>
    list.length
      ? `<div class="gbw-four"><p class="gi-label">${labelText}</p><ul>${list
          .map((x) => `<li>${tile(x.icon, 4, '')}<span><b>${esc(x.name)}</b><small>${sub(x)}</small></span></li>`)
          .join('')}</ul></div>`
      : '';

  function charCard(b, five) {
    const four = b.characters.filter((c) => c.rarity === 4);
    const el = five.element ? `<img src="${elIcon(five.element.toLowerCase())}" alt="">${esc(five.element)}` : '';
    const meta = [el, esc(five.weapon || ''), esc(five.affiliation || '')].filter(Boolean).join('<i aria-hidden="true">&middot;</i>');
    const sub4 = (c) => {
      const r = back(c.name, b, false);
      return (c.element ? `<img src="${elIcon(c.element.toLowerCase())}" alt="${esc(c.element)}">` : '') + (!r ? esc(c.element || '') : r.n === 1 ? 'First banner' : 'Back after ' + plural(r.gap, 'day'));
    };
    return `<article class="gi-box gbw" id="${slug(five.name)}" style="--gi-el:${EL[five.element] || NEUTRAL}" aria-label="${esc(five.name + ' ' + kind(b))}">
      <div class="gbw-art" aria-hidden="true">${five.splash ? `<img src="${esc(five.splash)}" alt="">` : ''}</div>
      <div class="gbw-info">
        ${head(b, five.name, `<p class="gbw-title">${esc(five.title || '')} <span class="gi-rarity" aria-label="5 stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span></p><p class="gbw-meta">${meta}</p>`)}
        ${hist ? `<p class="gbw-run">${runLine(back(five.name, b, true))}</p>` : ''}
        ${fours(four, 'Featured 4&#9733;', sub4)}
        ${foot(b, `<a class="gi-key" href="/genshin-impact/characters/${slug(five.name)}" data-guide hidden>Build guide${ARROW}</a>`)}
      </div></article>`;
  }

  function wepCard(b) {
    const top = b.weapons.filter((w) => w.rarity === 5);
    const four = b.weapons.filter((w) => w.rarity === 4);
    const sub = (w) => (w.sub === 'Elemental Mastery' ? String(w.max[2]) : w.max[2].toFixed(1) + '%');
    const stats = (w) => [esc(w.type || ''), w.max ? `${w.max[1]} Base ATK` : '', w.max && w.sub ? `${esc(w.sub)} ${sub(w)}` : ''].filter(Boolean).join(' &middot; ');
    return `<article class="gi-box gbw gbw--wep" id="weapons" style="--gi-el:var(--gi-r5)" aria-label="Weapon Wish">
      <div class="gbw-art" aria-hidden="true">${top.map((w) => (w.art ? `<img src="${esc(w.art)}" alt="" decoding="async">` : '')).join('')}</div>
      <div class="gbw-info">
        ${head(b, 'Epitome Invocation', '<p class="gbw-title">Two featured 5&#9733; weapons. Chart a course to one.</p>')}
        <ul class="gbw-weps">${top.map((w) => `<li>${tile(w.icon, 5, '')}<span><b>${esc(w.name)}</b><small>${stats(w)}</small></span></li>`).join('')}</ul>
        ${fours(four, 'Featured 4&#9733; weapons', (w) => esc(w.type || ''))}
        ${foot(b, '')}
      </div></article>`;
  }

  // ---- CLOCKS: d / h / m / s to each wish's end on the picked server ----
  function tick() {
    const t = now();
    document.querySelectorAll('[data-clock]').forEach((c) => {
      const left = srvEnd(c.dataset.clock) - t;
      const p = parts(left);
      c.classList.toggle('is-ending', left > 0 && left < DAY);
      c.querySelectorAll('[data-u]').forEach((u) => (u.textContent = pad(p[u.dataset.u])));
    });
  }

  // Klee's live line: how many wishes, when they leave, who's new. Always true to the feed.
  function klee(live) {
    const ends = live.map((b) => srvEnd(b.end));
    const left = Math.min(...ends) - now();
    const when = left < DAY ? 'in less than a day' : 'in ' + plural(Math.floor(left / DAY), 'day');
    const all = ends.every((e) => e === ends[0]);
    const fresh = live.map(fiveOf).filter((c) => c && hist && back(c.name, live.find((b) => fiveOf(b) === c), true).n === 1);
    const n = live.length === 1 ? 'one wish' : live.length + ' wishes';
    $('gbKlee').textContent =
      `Klee counted ${n}! ${live.length === 1 ? 'It leaves' : all ? 'They all leave' : 'The first one leaves'} ${when}.` +
      (fresh.length ? ` ${fresh.map((c) => c.name).join(' and ')} ${fresh.length === 1 ? 'is' : 'are'} brand new!` : '');
  }

  // Build guide keys: only for character pages that exist (Adrian is building them one by one).
  // GET, not HEAD: _tools/serve.py doesn't answer HEAD.
  function guides() {
    document.querySelectorAll('[data-guide]').forEach((a) =>
      fetch(a.getAttribute('href'))
        .then((r) => (a.hidden = !r.ok))
        .catch(() => {})
    );
  }

  GI.serverTray($('gbServer'), tick); // the clocks follow the picked server

  function render([feed, h]) {
    hist = h ? (h.banners || []).slice().sort((a, b) => a.start - b.start) : null;
    const t = now();
    const live = (feed.banners || []).filter((b) => (fiveOf(b) || (b.weapons || []).some((w) => w.rarity === 5)) && srvEnd(b.end) > t);
    if (!live.length) {
      $('gbList').innerHTML = '<p class="gi-empty">No wish is live right now. New ones show up here within three hours of going live.</p>';
      $('gbKlee').textContent = 'No wishes right now. Klee is waiting for the next ones too!';
      return;
    }
    $('gbList').innerHTML = live.map((b) => (fiveOf(b) ? charCard(b, fiveOf(b)) : wepCard(b))).join('');
    klee(live);
    guides();
    tick();
    setInterval(tick, 1000);

    // Header facts: version, how many wishes, when they end (server time, same on every server).
    const v = live.find((b) => b.version);
    const end = Math.min(...live.map((b) => b.end));
    $('gbFacts').innerHTML =
      (v ? `<li><b>${esc(v.version)}</b>version</li>` : '') + `<li><b>${live.length}</b>wish${live.length === 1 ? '' : 'es'} live</li><li>ends <b>${srvDate(end)}</b></li>`;

    // The cards arrive after load, so the browser's own #hash jump missed them.
    const go = location.hash && document.getElementById(location.hash.slice(1));
    if (go) go.scrollIntoView({ block: 'start' });
  }

  // History is extra (the rerun lines): the cards still draw without it.
  const past = fetch('/genshin-history.json')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  Promise.all([GI.feed, past])
    .then(render)
    .catch((err) => {
      console.error('genshin-feed.json failed to load:', err);
      $('gbList').innerHTML = '<p class="gi-empty">Couldn\'t load the wishes right now. Try again in a bit.</p>';
      $('gbKlee').textContent = "Klee couldn't find the wishes. Try again in a bit!";
    });
})();
