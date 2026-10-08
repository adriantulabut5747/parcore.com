// CoC home (/coc/): fills the Hero meta (.hm) and World top 10 (.gt)
// sections from /coc-lobby-home.json (scripts/lobby-stats.mjs writes it
// every morning). Styles: coc-lobby.css. If the file can't be read, both
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
  // size 200 (~95 KB each) for the 3 podium cards only; 70 (~16 KB) for rows.
  var badge = (r, cls, size) =>
    r.badge
      ? '<img class="' + cls + '" src="' + ASSETS + 'badges/' + size + '/' + esc(r.badge) + '.png" alt="" loading="lazy" decoding="async">'
      : '<span class="' + cls + '"></span>';
  var score = (r) =>
    '<span class="gt-score">' +
    (r.tierIcon ? '<img src="' + ASSETS + 'leaguetiers/125/' + esc(r.tierIcon) + '.png" alt="" title="' + esc(r.tier) + '">' : '') +
    r.score.toLocaleString('en-US') +
    '</span>';

  function heroCard(h) {
    var eqs = h.equipment
      .map((e, i) => {
        var pct = Math.round((e.count / h.owners) * 100);
        return (
          '<li><a class="hm-eq" href="/coc/tools/equipment#' + slug(e.name) + '">' +
          '<span class="hm-eq-pic"><span class="hm-eq-rank" aria-label="Rank ' + (i + 1) + '">' + (i + 1) + '</span>' +
          '<img src="' + UNITS + slug(e.name) + '.webp" alt="" loading="lazy" decoding="async"></span>' +
          '<span class="hm-eq-name">' + esc(e.name) + '</span>' +
          '<span class="hm-eq-pct">' + pct + '%</span>' +
          '<span class="hm-eq-bar"><i style="width:' + pct + '%"></i></span></a></li>'
        );
      })
      .join('');
    return (
      '<article class="hm-card" style="--acc:' + (GLOW[h.name] || '194, 59, 59') + '">' +
      '<img class="hm-flag" src="' + FLAGS + slug(h.name) + '.webp" alt="" loading="lazy" decoding="async">' +
      // Two poses: the still one, and an action pose (-action.webp, Fan Kit)
      // that fades in on hover.
      '<div class="hm-art"><img class="hm-still" src="' + ART + slug(h.name) + '.webp" alt="" loading="lazy" decoding="async">' +
      '<img class="hm-pose" src="' + ART + slug(h.name) + '-action.webp" style="height:' + (POSE_H[h.name] || 210) + 'px" alt="" loading="lazy" decoding="async"></div>' +
      '<div class="hm-name"><h3>' + esc(h.name) + '</h3><span class="hm-lvl">Avg level <b>' + h.avgLevel + '</b>/' + h.maxLevel + '</span></div>' +
      '<ol class="hm-eqs">' + eqs + '</ol></article>'
    );
  }

  function podium(r) {
    return (
      '<li style="display:contents"><a class="gt-pod gt-pod--' + r.rank + '" href="' + href(r.tag) + '">' +
      '<span class="gt-medal">' + r.rank + '</span>' +
      badge(r, 'gt-pod-badge', 200) +
      '<span class="gt-pod-name">' + esc(r.name) + '</span>' +
      '<span class="gt-pod-clan">' + (r.clan ? esc(r.clan) : 'No clan') + '</span>' +
      score(r) +
      '</a></li>'
    );
  }

  function row(r) {
    return (
      '<li><a class="gt-row" href="' + href(r.tag) + '">' +
      '<span class="gt-rank">' + r.rank + '</span>' +
      badge(r, 'gt-badge', 70) +
      '<span class="gt-who"><b>' + esc(r.name) + '</b><span>' + (r.clan ? esc(r.clan) : 'No clan') + '</span></span>' +
      score(r) +
      '</a></li>'
    );
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
      // hero's Leaderboards tile: today's world #1 (static fallback stays if this fails)
      var lb = document.getElementById('chLb'), p1 = d.top[0];
      if (lb && p1) {
        lb.innerHTML =
          (p1.tierIcon ? '<img src="' + ASSETS + 'leaguetiers/125/' + esc(p1.tierIcon) + '.png" alt="" width="52" height="52">' : '') +
          '<span><span class="ch-lb-rank">World #1</span><b>' + esc(p1.name) + '</b><small>' + p1.score.toLocaleString('en-US') + ' trophies</small></span>';
      }

      var h = Math.round((Date.now() - new Date(d.updated)) / 36e5);
      var when = h < 1 ? 'updated just now' : h < 24 ? 'updated ' + h + 'h ago' : 'updated ' + Math.round(h / 24) + 'd ago';
      document.getElementById('hmKicker').textContent = 'Global top ' + d.sample + ' · ' + when;
      document.getElementById('gtKicker').textContent = 'Global top 10 · ' + when;

      document.getElementById('hmGrid').innerHTML = d.heroes.map(heroCard).join('');
      document.getElementById('gtPodium').innerHTML = d.top.slice(0, 3).map(podium).join('');
      document.getElementById('gtList').innerHTML = d.top.slice(3, 10).map(row).join('');
      hm.hidden = false;
      gt.hidden = false;
      arrows();
    })
    .catch(() => {});
})();
