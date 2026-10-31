// Genshin Impact endgame (Oct 23 2026; since Oct 27 2026 the lower half of /genshin-impact/all-events, the old
// /endgame address 301s there with ?go=abyss). This period's Spiral
// Abyss floors 9-12, the Imaginarium Theater season and Stygian Onslaught. Periods,
// rewards and Stygian come from the feed's ennead data (challenges / events); what's
// inside the Abyss and the Theater comes from feed.endgame (scripts/genshin-feed.py
// reads the Fandom wiki). Shared helpers: genshin-core.js. Styles: genshin-endgame.css.
(function () {
  const { $, esc, MONTHS, PRIMO, now, tile, elIcon, countdowns } = window.GI;
  // Feed times are the Asia server's clock; a reset is 04:00 server time everywhere, so the
  // date reads the same on every server.
  const day = (t) => {
    const d = new Date((t + 8 * 3600) * 1000);
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
  };
  // Modes end at 03:59 server time, which still belongs to the day before (the game day flips at 04:00).
  const lastDay = (t) => day(t - 4 * 3600);
  const primo = (n) => (n ? `<span class="gi-primo">${PRIMO}${n.toLocaleString()}</span>` : '');
  const reset = (id, c) =>
    ($(id).innerHTML = `<div><span class="gi-label">Resets in</span><span class="gi-ends" data-end-srv="${+c.end}"></span></div>${
      c.primos ? `<div><span class="gi-label">Reward</span>${primo(c.primos)}</div>` : ''
    }`);

  // ---- SPIRAL ABYSS ---- (one floor's markup = GI.abyssFloor in genshin-core.js, shared with /genshin-impact/abyss)
  function abyss(a, icons, ch) {
    const box = $('egAbyss');
    if (!a || !a.floors || !a.floors.length) {
      box.innerHTML = "<p class=\"gi-box gi-empty\">This period's floors aren't listed yet.</p>";
      return;
    }
    if (ch) $('egAbyssSub').textContent = `The Abyssal Moon Spire, floors 9 to 12, ${day(ch.start)} to ${lastDay(ch.end)}${a.version ? ' (version ' + a.version + ')' : ''}.`;
    box.innerHTML = a.floors.map((f) => GI.abyssFloor(f, icons)).join('');
    const tabs = $('egFloors');
    tabs.innerHTML = a.floors.map((f) => `<button type="button" class="gi-tab" role="tab" data-floor="${f.floor}">Floor ${f.floor}</button>`).join('');
    const pick = (n) => {
      tabs.querySelectorAll('.gi-tab').forEach((b) => {
        const on = +b.dataset.floor === n;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on);
      });
      box.querySelectorAll('.eg-floor').forEach((f) => f.classList.toggle('is-on', +f.dataset.floor === n));
    };
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-floor]');
      if (b) pick(+b.dataset.floor);
    });
    pick((a.floors.find((f) => f.floor === 9) || a.floors[0]).floor); // Floor 9 first (Adrian's call)
  }

  // ---- IMAGINARIUM THEATER ----
  function theater(t, icons, roster, ch) {
    const box = $('egTheater');
    if (!t || !t.characters) {
      box.innerHTML = '<p class="gi-empty">This season isn\'t listed yet.</p>';
      return;
    }
    if (ch) $('egTheaterSub').textContent = `Season ${t.season}, ${day(ch.start)} to ${lastDay(ch.end)}${t.version ? ' (version ' + t.version + ')' : ''}.`;
    const who = (n) => {
      const c = roster[n];
      return `<figure class="eg-who">${c ? tile(c.icon, c.rarity, n) : '<span class="gi-tile"></span>'}<figcaption>${esc(n)}</figcaption></figure>`;
    };
    box.innerHTML = `<div class="eg-th-main">
        <div><span class="gi-label">Elements</span><div class="eg-els">${t.elements
          .map((e) => `<span class="eg-el"><img src="${elIcon(e.toLowerCase())}" alt="">${esc(e)}</span>`)
          .join('')}</div></div>
        <div><span class="gi-label">Opening characters</span><div class="eg-whos">${t.characters.map(who).join('')}</div>${
          t.blessing ? `<p class="eg-bless">${esc(t.blessing)}</p>` : ''
        }</div>
        ${t.guests.length ? `<div><span class="gi-label">Special guest stars</span><div class="eg-whos">${t.guests.map(who).join('')}</div></div>` : ''}
      </div>
      <div class="eg-th-foes"><span class="gi-label">Featured enemies</span><ul>${t.enemies
        .map((e) => `<li>${icons[e.name] ? `<img src="${esc(icons[e.name])}" alt="" loading="lazy">` : '<i></i>'}<b>${esc(e.name)}</b><span>Lv. ${e.level}</span></li>`)
        .join('')}</ul></div>`;
  }

  // ---- STYGIAN ONSLAUGHT ----
  function stygian(e) {
    if (!e) {
      $('egSty').innerHTML = "<p class=\"gi-box gi-empty\">Stygian Onslaught isn't running right now.</p>";
      return;
    }
    if (e.start) $('egStySub').textContent = `The boss challenge domain in Liyue's Sal Terrae, ${day(e.start)} to ${lastDay(e.end)}.`;
    if (e.end) reset('egStyReset', e);
    $('egSty').innerHTML = `<article class="gi-box eg-sty">${e.image ? `<div class="eg-sty-art"><img src="${esc(e.image)}" alt="" loading="lazy"></div>` : ''}
      <div class="eg-sty-body">${e.description ? `<p>${esc(e.description)}</p>` : ''}</div></article>`;
  }

  GI.feed
    .then((feed) => {
      const t = now();
      const eg = feed.endgame || {};
      const icons = eg.icons || {};
      const roster = Object.fromEntries((feed.characters || []).map((c) => [c.name, c]));
      const ch = (type) => (feed.challenges || []).find((c) => c.type === type && c.end > t);
      const tower = ch('ActTypeTower');
      const role = ch('ActTypeRoleCombat');
      const sty = (feed.events || []).find((e) => e.type === 'ActTypeHardChallenge' && (!e.end || e.end > t));
      if (tower) reset('egAbyssReset', tower);
      if (role) reset('egTheaterReset', role);
      abyss(eg.abyss, icons, tower);
      theater(eg.theater, icons, roster, role);
      stygian(sty);
      countdowns();
      setInterval(countdowns, 1000);
      // A #section or ?go=section in the address (old /endgame links arrive as ?go=abyss): the browser's own
      // jump came before the timeline and these sections were filled, so jump again now that they are.
      const go = new URLSearchParams(location.search).get('go') || location.hash.slice(1);
      if (go && document.getElementById(go)) document.getElementById(go).scrollIntoView();
      if (location.search) history.replaceState(null, '', location.pathname + (go ? '#' + go : ''));
    })
    .catch((err) => {
      console.error('Endgame failed to load:', err);
      ['egAbyss', 'egTheater', 'egSty'].forEach((id) => ($(id).innerHTML = "<p class=\"gi-empty\">Couldn't load this right now. Try again in a bit.</p>"));
    });
})();
