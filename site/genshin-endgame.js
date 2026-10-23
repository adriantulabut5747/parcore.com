// Genshin Impact endgame (/genshin-impact/endgame, Oct 23 2026). This period's Spiral
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

  // ---- SPIRAL ABYSS ----
  // "Remaining challenge time longer than (60/180/300) sec." -> the three star thresholds spaced out.
  const stars = (t) => t.replace(/\((\d+)\/(\d+)\/(\d+)\)/, '$1 / $2 / $3');
  function foe(e, icons) {
    const pic = icons[e.name] ? `<img src="${esc(icons[e.name])}" alt="" loading="lazy" decoding="async">` : '';
    return `<figure class="eg-foe" title="${esc(e.name)}"><span class="eg-foe-pic">${pic}${e.n > 1 ? `<b>&times;${e.n}</b>` : ''}</span><figcaption>${esc(e.name)}</figcaption></figure>`;
  }
  // A half: its waves left to right, a small arrow between them, then how they spawn (the wiki's note).
  const half = (label, waves, icons, spawn) =>
    `<div class="eg-half"><span class="gi-label">${label}</span><div class="eg-waves">${
      waves.length
        ? waves.map((w) => `<div class="eg-wave">${w.map((e) => foe(e, icons)).join('')}</div>`).join('<i class="eg-then" aria-hidden="true"></i>')
        : '<p class="eg-none">Not listed yet.</p>'
    }</div>${spawn ? `<p class="eg-spawn">${esc(spawn)}</p>` : ''}</div>`;
  const floor = (f, icons) => `<div class="eg-floor" data-floor="${f.floor}" role="tabpanel" aria-label="Floor ${f.floor}">
      <div class="gi-box eg-dis"><span class="gi-label">Ley line disorder</span><ul>${f.disorders.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></div>
      <div class="eg-chambers">${f.chambers
        .map(
          (c, i) => `<article class="gi-box eg-ch"><header><b>Chamber ${i + 1}</b><span>Lv. ${c.level}</span></header>
        <p class="eg-target"><span aria-hidden="true">&#9733;</span>${esc(stars(c.target))}</p>
        ${half('First half', c.halves[0], icons, (c.spawns || [])[0])}${half('Second half', c.halves[1], icons, (c.spawns || [])[1])}</article>`
        )
        .join('')}</div></div>`;

  function abyss(a, icons, ch) {
    const box = $('egAbyss');
    if (!a || !a.floors || !a.floors.length) {
      box.innerHTML = "<p class=\"gi-box gi-empty\">This period's floors aren't listed yet.</p>";
      return;
    }
    if (ch) $('egAbyssSub').textContent = `The Abyssal Moon Spire, floors 9 to 12, ${day(ch.start)} to ${lastDay(ch.end)}${a.version ? ' (version ' + a.version + ')' : ''}.`;
    box.innerHTML = a.floors.map((f) => floor(f, icons)).join('');
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
    pick(a.floors[a.floors.length - 1].floor); // Floor 12 first: it's the one people look up
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

  GI.serverTray($('egServer'));
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
      const facts = [];
      if (tower) facts.push(`<li>Abyss resets in <b data-end-srv="${+tower.end}"></b></li>`);
      if (role) facts.push(`<li>Theater in <b data-end-srv="${+role.end}"></b></li>`);
      const sum = [tower, role].reduce((a, c) => a + ((c && c.primos) || 0), 0);
      if (sum) facts.push(`<li><b>${sum.toLocaleString()}</b>Primogems a month</li>`);
      $('egFacts').innerHTML = facts.join('');
      countdowns();
      setInterval(countdowns, 1000);
    })
    .catch((err) => {
      console.error('Endgame failed to load:', err);
      ['egAbyss', 'egTheater', 'egSty'].forEach((id) => ($(id).innerHTML = "<p class=\"gi-empty\">Couldn't load this right now. Try again in a bit.</p>"));
    });
})();
