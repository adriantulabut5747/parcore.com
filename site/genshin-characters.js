// Genshin Impact characters (/genshin-impact/characters, Oct 23 2026). Every playable character
// from the feed's `characters` (scripts/genshin-feed.py; `strip` = their wish-result card, cut
// to the top half). Three views: newest first (the default), nation bands (GI.NATIONS order, then Other),
// A-Z. Filters: element, weapon, rarity, nation, search; every choice lives in the address so a
// filtered list can be shared. Cards aren't links until the character pages exist.
// "On banner" badge = the feed's current event wishes. The last-banner line (shown with the
// hover / tap info, never at rest) comes from /genshin-history.json, as on the Rerun tracker.
// Shared helpers: genshin-core.js. Styles: genshin-characters.css.
(function () {
  const { $, esc, now, elIcon, NATIONS } = window.GI;
  const NEW = 42 * 86400; // "New" = released within about one version
  const ELEMENTS = ['Pyro', 'Hydro', 'Anemo', 'Electro', 'Dendro', 'Cryo', 'Geo'];
  const WEAPONS = ['Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst'];
  const BANDS = NATIONS.concat({ name: 'Other', key: 'other' }); // no nation: Aloy, Skirk, Nicole, Traveler
  const nationKey = (c) => (BANDS.find((n) => n.name === c.region) || BANDS[BANDS.length - 1]).key;
  const els = (c) => c.elements || (c.element ? [c.element] : []);

  // Address <-> state. Unknown values fall back to "all", so a hand-edited link can't break the page.
  const OPTS = {
    view: ['nation', 'new', 'az'],
    el: ELEMENTS.map((e) => e.toLowerCase()),
    weapon: WEAPONS.map((w) => w.toLowerCase()),
    rarity: ['5', '4'],
    nation: BANDS.map((n) => n.key),
  };
  const url = new URLSearchParams(location.search);
  const state = { q: url.get('q') || '' };
  Object.keys(OPTS).forEach((k) => {
    const v = (url.get(k) || '').toLowerCase();
    state[k] = OPTS[k].includes(v) ? v : k === 'view' ? 'new' : '';
  });
  const save = () => {
    const p = new URLSearchParams();
    Object.keys(OPTS).forEach((k) => state[k] && !(k === 'view' && state[k] === 'new') && p.set(k, state[k]));
    if (state.q.trim()) p.set('q', state.q.trim());
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  };

  let roster = [];
  let onBanner = new Set(); // names on a character event wish right now
  let lastRun = {}; // name -> end of their latest finished banner (event or Chronicled)
  const DAY = 86400;
  function waitLine(c) {
    if (onBanner.has(c.name)) return '';
    const r = lastRun[c.name]; // never featured (Traveler, Aloy, most standard 5-stars): no line
    if (!r || !r.end) return '';
    const d = Math.floor((now() - r.end) / DAY);
    return d < 0 ? '' : `Last banner ${d < 1 ? 'ended today' : d + 'd ago'}`;
  }

  const match = (c) => {
    const q = state.q.trim().toLowerCase();
    return (
      (!state.el || els(c).some((e) => e.toLowerCase() === state.el)) &&
      (!state.weapon || c.weapon.toLowerCase() === state.weapon) &&
      (!state.rarity || String(c.rarity) === state.rarity) &&
      (!state.nation || nationKey(c) === state.nation) &&
      (!q || c.name.toLowerCase().includes(q))
    );
  };

  // One card. Focusable, so a tap (phones) or Tab shows the same info line as a hover.
  function card(c) {
    const fresh = now() - c.release < NEW;
    const live = onBanner.has(c.name);
    const wait = waitLine(c);
    const nation = c.region || 'No nation';
    const info = [els(c).length > 1 ? 'Every element' : els(c)[0], c.weapon, nation].filter(Boolean).map(esc).join(' &middot; ');
    const art = c.strip ? `<img class="ch-art" src="${esc(c.strip)}" alt="" loading="lazy" decoding="async" width="320" height="512">` : `<img class="ch-art is-icon" src="${esc(c.icon)}" alt="" loading="lazy" decoding="async">`;
    return `<li class="ch-card r${c.rarity}" tabindex="0">
      ${art}
      <span class="ch-els">${els(c).slice(0, 1).map((e) => `<img src="${elIcon(e.toLowerCase())}" alt="" title="${esc(e)}">`).join('')}${els(c).length > 1 ? `<i>+${els(c).length - 1}</i>` : ''}</span>
      ${fresh || live ? `<span class="ch-tags">${live ? '<span class="ch-live">On banner</span>' : ''}${fresh ? '<span class="ch-new">New</span>' : ''}</span>` : ''}
      <div class="ch-foot"><b>${esc(c.name)}</b><span class="ch-stars" aria-label="${c.rarity} stars">${'&#9733;'.repeat(c.rarity)}</span><span class="ch-info">${info}${wait ? `<span class="ch-wait">${esc(wait)}</span>` : ''}</span></div>
    </li>`;
  }
  const grid = (list) => `<ul class="ch-grid">${list.map(card).join('')}</ul>`;

  // A nation band: its namecard as the head, the count, then its characters (5-stars first).
  function band(n, list, total) {
    const art = n.key !== 'other' ? ` style="--img:url('/images/genshin/nation/${n.key}.webp')"` : '';
    const mark = n.el || n.icon ? `<img src="${n.icon || elIcon(n.el)}" alt="">` : '';
    const sub = n.el ? `${n.el[0].toUpperCase() + n.el.slice(1)} Archon &middot; ${esc(n.ideal)}` : n.key === 'other' ? 'Not tied to a nation' : 'An autonomous region of Snezhnaya';
    return `<section class="ch-nat${art ? '' : ' is-plain'}" aria-label="${esc(n.name)}">
      <header class="ch-nat-head"${art}>${mark}<div><h2>${esc(n.name)}</h2><p>${sub}</p></div>
        <span class="ch-nat-n"><b>${list.length === total ? total : `${list.length}</b> of <b>${total}`}</b> ${total === 1 ? 'character' : 'characters'}</span></header>
      ${grid(list)}
    </section>`;
  }

  function render() {
    const list = roster.filter(match);
    let html = '';
    if (!list.length) {
      html = '<p class="gi-box gi-empty ch-empty">No one matches that. Clear the filters or try another name.</p>';
    } else if (state.view === 'nation') {
      const byRarity = (a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name);
      html = BANDS.map((n) => {
        const all = roster.filter((c) => nationKey(c) === n.key);
        const shown = list.filter((c) => nationKey(c) === n.key).sort(byRarity);
        return shown.length ? band(n, shown, all.length) : '';
      }).join('');
    } else {
      const sort = state.view === 'new' ? (a, b) => b.release - a.release || a.name.localeCompare(b.name) : (a, b) => a.name.localeCompare(b.name);
      html = grid(list.slice().sort(sort));
    }
    $('chList').innerHTML = html;
    $('chList').classList.toggle('is-flat', state.view !== 'nation');
    $('chCount').innerHTML = list.length === roster.length ? `<b>${roster.length}</b> characters` : `<b>${list.length}</b> of ${roster.length}`;
    const hidden = ['weapon', 'rarity', 'nation'].filter((k) => state[k]).length; // filters behind the phone key
    $('chMoreN').hidden = !hidden;
    $('chMoreN').textContent = hidden;
    $('chClear').hidden = !(state.el || state.weapon || state.rarity || state.nation || state.q.trim());
    paint();
    save();
  }

  // Trays: one picked button raised (the shared .gi-tab look); "All" = "".
  const TRAYS = { chView: 'view', chEl: 'el', chWeapon: 'weapon', chRarity: 'rarity', chNation: 'nation' };
  const btn = (v, label, extra = '') => `<button type="button" class="gi-tab" data-v="${v}"${extra}>${label}</button>`;
  $('chEl').innerHTML = btn('', 'All') + ELEMENTS.map((e) => btn(e.toLowerCase(), `<img src="${elIcon(e.toLowerCase())}" alt="">`, ` aria-label="${e}" title="${e}"`)).join('');
  $('chWeapon').innerHTML = btn('', 'All') + WEAPONS.map((w) => btn(w.toLowerCase(), w)).join('');
  $('chRarity').innerHTML = btn('', 'All') + btn('5', '5&#9733;') + btn('4', '4&#9733;');
  $('chNation').innerHTML = btn('', 'All nations') + BANDS.map((n) => btn(n.key, esc(n.name))).join('');
  function paint() {
    Object.entries(TRAYS).forEach(([id, k]) =>
      $(id).querySelectorAll('.gi-tab').forEach((b) => {
        const on = b.dataset.v === state[k];
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on);
      })
    );
  }
  Object.entries(TRAYS).forEach(([id, k]) =>
    $(id).addEventListener('click', (e) => {
      const b = e.target.closest('.gi-tab');
      if (!b || b.dataset.v === state[k]) return;
      state[k] = b.dataset.v;
      render();
    })
  );
  $('chQ').value = state.q;
  $('chQ').addEventListener('input', (e) => {
    state.q = e.target.value;
    render();
  });
  $('chClear').addEventListener('click', () => {
    Object.assign(state, { el: '', weapon: '', rarity: '', nation: '', q: '' });
    $('chQ').value = '';
    render();
  });
  // Phones: weapon / rarity / nation fold behind the Filters key (desktop always shows them).
  $('chMoreKey').addEventListener('click', () => {
    const open = $('chMore').classList.toggle('is-open');
    $('chMoreKey').setAttribute('aria-expanded', open);
  });
  paint();

  // The history is extra: if it fails, the roster still shows, just without the last-banner line.
  const pastWishes = fetch('/genshin-history.json')
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  Promise.all([GI.feed, pastWishes])
    .then(([feed, hist]) => {
      const t = now();
      (feed.banners || []).forEach((b) => b.start <= t && t < b.end && (b.characters || []).forEach((c) => onBanner.add(c.name)));
      (hist.banners || []).forEach((b) =>
        ['five', 'four'].forEach((k) =>
          (b[k] || []).forEach((name) => {
            const r = (lastRun[name] = lastRun[name] || { end: 0 });
            if (b.end <= t) r.end = Math.max(r.end, b.end); // a banner still running isn't "the last one"
          })
        )
      );
      roster = feed.characters || [];
      if (!roster.length) throw new Error('empty roster');
      const fives = roster.filter((c) => c.rarity === 5).length;
      const newest = roster.reduce((a, c) => (c.release > a.release ? c : a));
      const latest = roster.filter((c) => c.release === newest.release).map((c) => esc(c.name));
      $('chFacts').innerHTML =
        `<li><b>${roster.length}</b>characters</li><li><b>${fives}</b>5&#9733;</li><li><b>${roster.length - fives}</b>4&#9733;</li>` +
        `<li>newest <b>${latest.join(' &amp; ')}</b></li>`;
      // Klee's line under the header (Oct 27 2026): the roster count + the newest, in her voice.
      const names = roster.filter((c) => c.release === newest.release).map((c) => c.name);
      $('chKlee').textContent = `Klee knows all ${roster.length} of them! Say hi to ${names.join(' and ')}, the newest ${names.length > 1 ? 'friends' : 'friend'}.`;
      render();
    })
    .catch((err) => {
      console.error('Roster failed to load:', err);
      $('chKlee').textContent = "Klee couldn't find anyone. Try again in a bit!";
      $('chList').innerHTML = "<p class=\"gi-box gi-empty ch-empty\">Couldn't load the roster right now. Try again in a bit.</p>";
    });
})();
