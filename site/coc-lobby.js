// CoC home (/coc/): fills the Hero meta (.hm) and Top players of the week
// (.gt) sections from /coc-lobby-home.json (scripts/lobby-stats.mjs writes it
// every Monday, before the league reset). Styles: coc-lobby.css. If the file can't be read, both
// sections stay hidden rather than showing empty frames.
(function () {
  var hm = document.getElementById('heroMeta');
  var gt = document.getElementById('worldTop');
  if (!hm || !gt) return;

  var ASSETS = 'https://api-assets.clashofclans.com/';
  var UNITS = '/clashofclans/coctools/units/';
  var ART = '/clashofclans/coctools/dragonscale/'; // Dragon Scale skins (Adrian's pick)
  var FLAGS = '/clashofclans/coctools/banners/'; // each hero's Hero Hall banner (also on the army cards)
  var ON_PAGES = location.hostname.endsWith('github.io'); // same rule as coc-tracker.js

  // Glow behind each hero render, picked from its Dragon Scale skin (r, g, b).
  var GLOW = {
    'Barbarian King': '255, 110, 40', // fire sword
    'Archer Queen': '150, 175, 210', // silver armour
    'Grand Warden': '150, 200, 70', // green key
    'Royal Champion': '230, 70, 60', // red scales
    'Minion Prince': '130, 210, 80', // green glow
    'Dragon Duke': '255, 120, 40' // molten wings
  };

  // Action-pose height (px) per hero, matched by eye so the body is the
  // same size as in the still pose -- the action files include swords,
  // spears and wings, so one shared height made the wide ones look smaller.
  var POSE_H = {
    'Barbarian King': 230,
    'Archer Queen': 196,
    'Grand Warden': 215,
    'Royal Champion': 250,
    'Minion Prince': 215,
    'Dragon Duke': 245
  };

  // Equipment and hero pictures are named after them: "Spiky Ball" ->
  // spiky-ball.webp (checked against coc-equipment.json, Oct 2026). The
  // same slug is the Equipments page's #id.
  var slug = (n) =>
    n
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  var esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  var href = (tag) => {
    var t = tag.replace('#', '');
    return ON_PAGES ? '/coc/player/?tag=' + t : '/coc/player/' + t;
  };
  // size 70 (~16 KB): the board's badges are 30px.
  var badge = (r, cls, size) =>
    r.badge
      ? '<img class="' + cls + '" src="' + ASSETS + 'badges/' + size + '/' + esc(r.badge) + '.png" alt="" loading="lazy" decoding="async">'
      : '<span class="' + cls + '"></span>';
  var score = (r) =>
    '<span class="gt-score">' +
    (r.tierIcon ? '<img src="' + ASSETS + 'leaguetiers/125/' + esc(r.tierIcon) + '.png" alt="" title="' + esc(r.tier) + '">' : '') +
    r.score.toLocaleString('en-US') +
    '</span>';

  // Six sparks per card: start x, sideways drift, duration, delay.
  var SPARKS = [[30, -14, 1.6, 0], [42, 8, 1.9, 0.5], [55, -6, 1.5, 0.9], [63, 16, 2.1, 0.2], [70, -10, 1.7, 1.2], [48, 12, 2.3, 1.6]]
    .map((s) => '<i style="--x:' + s[0] + '%;--dx:' + s[1] + 'px;--t:' + s[2] + 's;--d:' + s[3] + 's"></i>')
    .join('');

  // Phones have no hover: the card nearest the middle of the row powers up
  // instead (.is-on = the same look as :hover).
  function touchPose(grid) {
    if (!('IntersectionObserver' in window) || matchMedia('(hover: hover)').matches) return;
    var io = new IntersectionObserver(
      (es) => es.forEach((e) => e.target.classList.toggle('is-on', e.intersectionRatio > 0.85)),
      { root: grid, threshold: [0, 0.85, 1] }
    );
    grid.querySelectorAll('.hm-card').forEach((c) => io.observe(c));
  }

  // Top 3 per hero (Oct 24 2026: no bars, Adrian): medal rank, the item,
  // its name, and the pick rate as quiet text.
  function heroCard(h) {
    var eqs = h.equipment
      .map((e, i) => {
        var pct = Math.round((e.count / h.owners) * 100);
        return (
          '<li><a class="hm-eq" href="/coc/tools/equipment#' + slug(e.name) + '">' +
          '<span class="hm-eq-rank" aria-label="Rank ' + (i + 1) + '">' + (i + 1) + '</span>' +
          '<span class="hm-eq-pic"><img src="' + UNITS + slug(e.name) + '.webp" alt="" loading="lazy" decoding="async"></span>' +
          '<span class="hm-eq-name">' + esc(e.name) + '</span>' +
          '<span class="hm-eq-pct" title="Equipped by ' + pct + '% of the top 200 who own this hero">' + pct + '%</span></a></li>'
        );
      })
      .join('');
    return (
      '<article class="hm-card" style="--acc:' + (GLOW[h.name] || '194, 59, 59') + '">' +
      '<img class="hm-flag" src="' + FLAGS + slug(h.name) + '.webp" alt="" loading="lazy" decoding="async">' +
      // Two poses: the still one, and an action pose (-action.webp, Fan Kit)
      // that fades in on hover.
      '<div class="hm-art"><img class="hm-still" src="' + ART + slug(h.name) + '.webp" alt="" loading="lazy" decoding="async">' +
      '<img class="hm-pose" src="' + ART + slug(h.name) + '-action.webp" style="height:' + (POSE_H[h.name] || 210) + 'px" alt="" loading="lazy" decoding="async">' +
      // The power-up as the pose changes: a shockwave ring + sparks in the hero's colour.
      '<span class="hm-wave"></span><span class="hm-sparks">' + SPARKS + '</span></div>' +
      '<div class="hm-name"><h3>' + esc(h.name) + '</h3><span class="hm-lvl">Avg level <b>' + h.avgLevel + '</b>/' + h.maxLevel + '</span></div>' +
      '<ol class="hm-eqs">' + eqs + '</ol></article>'
    );
  }

  // Places moved since last week's file: prev null = no baseline yet, -1 =
  // new to the top 200 (same rules as coc-stats.js on the Leaderboards page).
  function move(r) {
    if (r.prev == null) return '<span class="gt-move"></span>';
    if (r.prev < 1) return '<span class="gt-move gt-new">New</span>';
    var d = r.prev - r.rank;
    if (!d) return '<span class="gt-move" aria-label="Same place as last week">&ndash;</span>';
    return (
      '<span class="gt-move ' + (d > 0 ? 'gt-up' : 'gt-down') + '" aria-label="' + (d > 0 ? 'Up ' : 'Down ') + Math.abs(d) + ' since last week">' +
      (d > 0 ? '&#9650;' : '&#9660;') + Math.abs(d) + '</span>'
    );
  }

  function row(r) {
    return (
      '<li><a class="gt-row' + (r.rank < 4 ? ' gt-row--' + r.rank : '') + '" href="' + href(r.tag) + '">' +
      '<span class="gt-rank">' + r.rank + '</span>' +
      badge(r, 'gt-badge', 70) +
      '<span class="gt-who"><b>' + esc(r.name) + '</b><span>' + (r.clan ? esc(r.clan) : 'No clan') + '</span></span>' +
      move(r) +
      score(r) +
      '</a></li>'
    );
  }

  // The league week the file was saved in: Monday 05:00 UTC to the next
  // (the Monday reset). "Oct 19 – 26", or "Oct 26 – Nov 2" across months.
  function weekOf(iso) {
    var WEEK = 7 * 864e5;
    var MON = Date.UTC(2026, 9, 19, 5); // a Monday 05:00 UTC
    var start = MON + Math.floor((new Date(iso) - MON) / WEEK) * WEEK;
    var md = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    var a = md(start).split(' ');
    var b = md(start + WEEK).split(' ');
    return a[0] + ' ' + a[1] + ' – ' + (a[0] === b[0] ? b[1] : b.join(' '));
  }

  // ‹ › scroll the hero row by one card; each greys out at its end.
  function arrows() {
    var grid = document.getElementById('hmGrid');
    var prev = document.getElementById('hmPrev');
    var next = document.getElementById('hmNext');
    var step = () => grid.firstElementChild.offsetWidth + parseFloat(getComputedStyle(grid).columnGap);
    var sync = () => {
      prev.disabled = grid.scrollLeft < 4;
      next.disabled = grid.scrollLeft > grid.scrollWidth - grid.clientWidth - 4;
    };
    prev.addEventListener('click', () => grid.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => grid.scrollBy({ left: step(), behavior: 'smooth' }));
    grid.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }

  // Static tracker links (the Ascendere card): GitHub Pages needs ?tag=.
  document.querySelectorAll('a[data-clan-tag]').forEach((a) => {
    if (ON_PAGES) a.href = '/coc/clan/?tag=' + a.dataset.clanTag;
  });

  fetch('/coc-lobby-home.json')
    .then((r) => r.json())
    .then((d) => {
      var week = 'Week of ' + weekOf(d.updated);
      document.getElementById('hmKicker').textContent = 'Global top ' + d.sample + ' · ' + week;
      document.getElementById('gtKicker').textContent = 'Global · ' + week;

      document.getElementById('hmGrid').innerHTML = d.heroes.map(heroCard).join('');
      document.getElementById('gtBoard').innerHTML = d.top.slice(0, 10).map(row).join('');
      hm.hidden = false;
      gt.hidden = false;
      arrows();
      touchPose(document.getElementById('hmGrid'));
    })
    .catch(() => {});
})();
