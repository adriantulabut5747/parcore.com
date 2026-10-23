// Genshin Impact banners (/genshin-impact/banners, Oct 22 2026; v2 Oct 23 2026: the Lobby's wish
// card). The card itself is shared with the Lobby (genshin-wish.js, GI.wishCard); this page adds
// the header facts and, under the card, how the picked wish works: the official rates and its
// path to the featured 5-star, drawn. #<wish> in the address (#weapons, #columbina...) opens that
// wish. Shared helpers: genshin-core.js (loaded first). Feed text goes through esc().
(function () {
  const { $, esc, now, srvEnd, srvDate, countdowns } = window.GI;

  // The official rules from each wish's in-game details (wiki: Character / Weapon Event
  // Wish, checked Oct 22 2026). Soft pity isn't official, so it isn't here. Wishes we
  // have no confirmed rules for (Chronicled Wish...) show no rates.
  const RULES = [
    {
      test: /^Character Event Wish/,
      title: 'The 50/50',
      chips: [
        ['0.6%', 'base 5&#9733;'],
        ['90', 'hard pity'],
        ['55%', '50/50 win rate'],
        ['180', 'max to the featured'],
      ],
      path: [
        ['', 'Pull a 5&#9733;', 'At most 90 pulls from your last one.'],
        ['is-point', '55%: it\'s the featured one', 'The 50/50, with Capturing Radiance counted in.'],
        ['is-yours', 'Miss it: the next 5&#9733; is', 'So at most 180 pulls to the featured 5&#9733;.'],
      ],
    },
    {
      test: /^Weapon Event Wish/,
      title: 'Epitomized Path',
      chips: [
        ['0.7%', 'base 5&#9733;'],
        ['80', 'hard pity'],
        ['75%', 'featured 5&#9733;'],
        ['160', 'max to your pick'],
      ],
      path: [
        ['', 'Chart a course', 'Pick one of the two 5&#9733; weapons.'],
        ['is-point', 'Miss it: 1 Fate Point', 'Any other 5&#9733; weapon fills it.'],
        ['is-yours', 'The next 5&#9733; is yours', 'At most 160 pulls. Fate Points reset when this wish ends.'],
      ],
    },
  ];
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const label = (b) => ((b.characters || []).find((c) => c.rarity === 5) || { name: 'Weapons' }).name;

  // How one wish works: rates on the left, its path drawn as three diamonds on a line.
  function rules(b, i) {
    const r = RULES.find((x) => x.test.test(b.name));
    const body = r
      ? `<div class="gb-rule-head"><p class="gi-label">How this wish works</p><h3>${r.title}</h3>
          <ul class="gb-rates">${r.chips.map(([v, t]) => `<li><b>${v}</b>${t}</li>`).join('')}</ul></div>
        <ol class="gb-path">${r.path.map(([pip, t, s]) => `<li><span class="gb-pip ${pip}" aria-hidden="true"></span><b>${t}</b><small>${s}</small></li>`).join('')}</ol>`
      : `<p class="gi-empty">${esc(b.name)}: its rates aren't confirmed on Parchrome yet.</p>`;
    return `<div class="gb-rule" data-i="${i}">${body}</div>`;
  }

  let wish = { tick() {} };
  let first = true;
  GI.serverTray($('gbServer'), () => wish.tick()); // the countdown follows the picked server

  function render(feed) {
    const t = now();
    const live = (feed.banners || []).filter((b) => ((b.characters && b.characters.length) || (b.weapons && b.weapons.length)) && srvEnd(b.end) > t);
    if (!live.length) {
      $('gbRules').hidden = true;
      $('giWish').hidden = true;
      $('gbEmpty').hidden = false;
      return;
    }
    // Every wish's rules sit in one grid cell, so the box is as tall as the tallest and
    // switching wishes never moves the page.
    $('gbRules').innerHTML = live.map(rules).join('');
    wish = GI.wishCard(live, {
      start: location.hash.slice(1),
      onShow(b, i) {
        $('gbRules').querySelectorAll('.gb-rule').forEach((r) => r.classList.toggle('is-on', +r.dataset.i === i));
        if (!first) history.replaceState(null, '', '#' + slug(label(b))); // a switch is shareable; the first paint leaves the address alone
        first = false;
      },
    });

    // Header facts: version, how many wishes, when they end (server time, same on every server).
    const v = live.find((b) => b.version);
    const end = Math.min(...live.map((b) => b.end));
    $('gbFacts').innerHTML =
      (v ? `<li><b>${esc(v.version)}</b>version</li>` : '') + `<li><b>${live.length}</b>wish${live.length === 1 ? '' : 'es'} live</li><li>ends <b>${srvDate(end)}</b></li>`;
    countdowns();
  }

  GI.feed.then(render).catch((err) => {
    console.error('genshin-feed.json failed to load:', err);
    $('giMeta').textContent = "Couldn't load the wishes right now. Try again in a bit.";
  });
})();
