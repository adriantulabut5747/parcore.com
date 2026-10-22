// Genshin Impact banners (/genshin-impact/banners, Oct 22 2026). Draws every live wish
// from /genshin-feed.json "banners" as a .gi-wish card. Shared helpers: genshin-core.js
// (loaded first). Styles: genshin.css + genshin-banners.css. Feed text goes through esc().
(function () {
  const { $, esc, now, EL, NEUTRAL, srvEnd, srvDate, countdowns, fit, tile, elIcon } = window.GI;
  const STARS = '<span class="gi-rarity" aria-label="5 stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>';

  // The official rules from each wish's in-game details (wiki: Character / Weapon Event
  // Wish, checked Oct 22 2026). Soft pity isn't official, so it isn't here. Wishes we
  // have no confirmed rules for (Chronicled Wish...) show no rates.
  const RATES = [
    {
      test: /^Character Event Wish/,
      chips: [
        ['0.6%', 'base 5&#9733;'],
        ['90', 'hard pity'],
        ['55%', '50/50 win rate'],
        ['180', 'max to the featured'],
      ],
    },
    {
      test: /^Weapon Event Wish/,
      chips: [
        ['0.7%', 'base 5&#9733;'],
        ['80', 'hard pity'],
        ['75%', 'featured 5&#9733;'],
        ['160', 'max to your pick'],
      ],
    },
  ];
  const rates = (b) => {
    const r = RATES.find((x) => x.test.test(b.name));
    return r ? `<ul class="gb-rates">${r.chips.map(([v, t]) => `<li><b>${v}</b>${t}</li>`).join('')}</ul>` : '';
  };
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const tag = (b) => `<span class="gi-wish-tag">${esc(b.name)}${b.version ? ' &middot; v' + esc(b.version) : ''}</span>`;
  const ends = (b) =>
    `<div class="gb-ends"><span class="gi-label">Ends in</span><span class="gi-ends" data-end-srv="${+b.end}"></span><small>${srvDate(b.end)} server time</small></div>`;

  // The card's big art: the first 5-star character, else the 5-star weapons.
  function card(b, i) {
    const five = (b.characters || []).find((c) => c.rarity === 5);
    const flip = i % 2 === 1;
    if (five) {
      const four = b.characters.filter((c) => c.rarity === 4);
      const fourWeps = (b.weapons || []).filter((w) => w.rarity === 4);
      const meta = [`<span class="gi-el">${EL[five.element] ? `<img src="${elIcon(five.element.toLowerCase())}" alt="">` : ''}${esc(five.element)}</span>`, esc(five.weapon), esc(five.affiliation)]
        .filter(Boolean)
        .join('<span aria-hidden="true">&middot;</span>');
      return {
        id: slug(five.name),
        label: five.name,
        pic: five.icon,
        html: `<article class="gi-box gi-wish gb-wish${flip ? ' gb-wish--flip' : ''}" id="${slug(five.name)}" style="--gi-el:${EL[five.element] || NEUTRAL}" aria-label="${esc(b.name)}: ${esc(five.name)}">
          <div class="gi-wish-art" aria-hidden="true">${five.splash ? `<img class="gi-wish-img" src="${esc(five.splash)}" alt="">` : ''}</div>
          <div class="gi-wish-info">${tag(b)}
            <h2 class="gi-name">${esc(five.name)}</h2>
            <p class="gi-wish-title"><span>${esc(five.title || '')}</span>${STARS}</p>
            <p class="gi-meta">${meta}</p>
            ${four.length ? `<div class="gi-four"><p class="gi-label">Featured 4&#9733;</p><div class="gi-four-row">${four.map((c) => `<figure>${tile(c.icon, 4, c.name)}<figcaption>${esc(c.name)}${c.element ? `<small>${esc(c.element)}</small>` : ''}</figcaption></figure>`).join('')}</div></div>` : ''}
            ${fourWeps.length ? `<p class="gb-fourw">Also: ${fourWeps.map((w) => esc(w.name)).join(', ')}</p>` : ''}
            ${rates(b)}${ends(b)}
          </div></article>`,
      };
    }
    const top = (b.weapons || []).filter((w) => w.rarity === 5);
    const four = (b.weapons || []).filter((w) => w.rarity === 4);
    const isEpitome = /^Weapon Event Wish/.test(b.name);
    const name = isEpitome ? 'Epitome Invocation' : b.name;
    return {
      id: isEpitome ? 'weapons' : slug(b.name),
      label: isEpitome ? 'Weapons' : b.name,
      pic: (top[0] || four[0] || {}).icon,
      html: `<article class="gi-box gi-wish gb-wish gb-wep" id="${isEpitome ? 'weapons' : slug(b.name)}" style="--gi-el:${NEUTRAL}" aria-label="${esc(b.name)}">
        <div class="gi-wish-art" aria-hidden="true"><div class="gb-weps">${top
          .map((w) => `<figure><img src="${esc(w.splash || w.icon)}" alt=""><figcaption>${esc(w.name)}${w.type ? `<small>${esc(w.type)}</small>` : ''}</figcaption></figure>`)
          .join('')}</div></div>
        <div class="gi-wish-info">${tag(b)}
          <h2 class="gi-name">${esc(name)}</h2>
          <p class="gi-wish-title"><span>${top.length} featured 5&#9733; weapons</span>${STARS}</p>
          <p class="gi-meta">${top.map((w) => `<b>${esc(w.name)}</b>`).join('<span aria-hidden="true">&middot;</span>')}</p>
          ${four.length ? `<div class="gi-four"><p class="gi-label">Featured 4&#9733; weapons</p><div class="gi-four-row">${four.map((w) => `<figure>${tile(w.icon, 4, w.name)}</figure>`).join('')}</div></div><p class="gb-fourw">${four.map((w) => esc(w.name) + (w.type ? ' (' + esc(w.type) + ')' : '')).join(', ')}</p>` : ''}
          ${rates(b)}${ends(b)}
        </div>
        ${
          isEpitome
            ? `<div class="gb-path">
          <p class="gi-label">Epitomized Path</p>
          <ol>
            <li><span class="gb-pip" aria-hidden="true"></span><b>Chart a course</b><small>Pick one of the two 5&#9733; weapons.</small></li>
            <li><span class="gb-pip is-point" aria-hidden="true"></span><b>Miss it: 1 Fate Point</b><small>Any other 5&#9733; weapon fills it.</small></li>
            <li><span class="gb-pip is-yours" aria-hidden="true"></span><b>The next 5&#9733; is yours</b><small>At most 160 pulls. Fate Points reset when this wish ends.</small></li>
          </ol>
          <p class="gb-path-line"><span class="gb-pip is-point" aria-hidden="true"></span><span><b>Epitomized Path:</b> miss your pick once and the next 5&#9733; is it.</span></p>
        </div>`
            : ''
        }</article>`,
    };
  }

  function render(feed) {
    const t = now();
    const live = (feed.banners || []).filter((b) => ((b.characters && b.characters.length) || (b.weapons && b.weapons.length)) && srvEnd(b.end) > t);
    const list = $('gbList');
    if (!live.length) {
      list.innerHTML = '<p class="gi-empty">No wish is live right now. New ones show up here within three hours of going live.</p>';
      $('gbTabs').hidden = true;
      return;
    }
    const cards = live.map(card);
    list.innerHTML = cards.map((c) => c.html).join('');
    $('gbTabs').innerHTML = cards
      .map((c) => `<button type="button" class="gi-tab" role="tab" data-id="${c.id}" aria-controls="${c.id}">${c.pic ? `<img src="${esc(c.pic)}" alt="">` : ''}${esc(c.label)}</button>`)
      .join('');

    // Header facts: version, how many wishes, when they end (server time, same on every server).
    const v = live.find((b) => b.version);
    const end = Math.min(...live.map((b) => b.end));
    $('gbFacts').innerHTML =
      (v ? `<li><b>${esc(v.version)}</b>version</li>` : '') + `<li><b>${live.length}</b>wish${live.length === 1 ? '' : 'es'} live</li><li>ends <b>${srvDate(end)}</b></li>`;

    list.querySelectorAll('.gi-name').forEach(fit);
    window.addEventListener('resize', () => list.querySelectorAll('.gi-name').forEach(fit));
    if (document.fonts) document.fonts.ready.then(() => list.querySelectorAll('.gi-name').forEach(fit)); // Cinzel changes the width

    // Tabs: phones show one card (the picked one); desktop shows them all and the tabs
    // jump to each, lit by whichever card is on screen.
    const phone = matchMedia('(max-width: 970px)');
    const light = (id) =>
      $('gbTabs').querySelectorAll('.gi-tab').forEach((b) => {
        const on = b.dataset.id === id;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on);
      });
    const pick = (id) => {
      list.querySelectorAll('.gb-wish').forEach((c) => c.classList.toggle('is-on', c.id === id));
      light(id);
    };
    const first = cards.some((c) => '#' + c.id === location.hash) ? location.hash.slice(1) : cards[0].id;
    pick(first);
    $('gbTabs').addEventListener('click', (e) => {
      const b = e.target.closest('.gi-tab');
      if (!b) return;
      pick(b.dataset.id);
      if (!phone.matches) $(b.dataset.id).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (es) => {
          if (phone.matches) return;
          es.forEach((e) => e.isIntersecting && light(e.target.id));
        },
        { rootMargin: '-45% 0px -45% 0px' }
      );
      list.querySelectorAll('.gb-wish').forEach((c) => io.observe(c));
    }
    countdowns();
    setInterval(countdowns, 1000);
  }

  GI.serverTray($('gbServer')); // the countdowns follow the picked server (data-end-srv)
  GI.feed.then(render).catch((err) => {
    console.error('genshin-feed.json failed to load:', err);
    $('gbList').innerHTML = "<p class=\"gi-empty\">Couldn't load the wishes right now. Try again in a bit.</p>";
  });
})();
