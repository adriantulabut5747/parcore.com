// /coc/tools/stats: Philippines leaderboards + "what the top 200 equip".
// Data: /coc-lobby-stats.json, rebuilt every morning by a GitHub Action
// (scripts/lobby-stats.mjs -- its header lists the file's shape).
// Equipment and hero pictures come from /coc-equipment.json (the Equipments
// page's data), matched by name.
(function () {
  var $ = (s) => document.querySelector(s);
  var ASSETS = 'https://api-assets.clashofclans.com/';
  var UNIT_DIR = '/clashofclans/coctools/units/';
  var PAGE = 50; // rows per "Show more"
  var ON_PAGES = location.hostname.endsWith('github.io'); // same rule as coc-tracker.js

  // Region -> its boards (keys into data.rankings). World has players only.
  // ?region=global in the address opens the World list (the CoC home links there).
  var REGIONS = {
    global: [{ key: 'globalPlayers', label: 'Players', unit: 'trophies', clan: false }],
    ph: [
      { key: 'players', label: 'Players', unit: 'trophies', clan: false },
      { key: 'clans', label: 'Clans', unit: 'points', clan: true },
      { key: 'builderPlayers', label: 'Builder players', unit: 'trophies', clan: false },
      { key: 'builderClans', label: 'Builder clans', unit: 'points', clan: true },
      { key: 'capitals', label: 'Capital', unit: 'points', clan: true }
    ]
  };

  var esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  var num = (n) => n.toLocaleString('en-US');
  var tagHref = (kind, tag) => {
    var t = tag.replace('#', '');
    return ON_PAGES ? '/coc/' + kind + '/?tag=' + t : '/coc/' + kind + '/' + t;
  };

  // ▲3 / ▼12 / NEW / –
  function move(r) {
    if (r.prev == null) return '<span class="st-move">&ndash;</span>';
    if (r.prev < 1) return '<span class="st-move st-new">New</span>';
    var d = r.prev - r.rank;
    if (!d) return '<span class="st-move">&ndash;</span>';
    return '<span class="st-move ' + (d > 0 ? 'st-up">&#9650;' : 'st-down">&#9660;') + Math.abs(d) + '</span>';
  }

  function rowHtml(r, tab) {
    var badge = r.badge ? '<img class="st-badge" src="' + ASSETS + 'badges/70/' + esc(r.badge) + '.png" alt="" loading="lazy" decoding="async">' : '<span class="st-badge"></span>';
    var sub = tab.clan ? 'Level ' + r.level + ' &middot; ' + r.members + '/50' : r.clan ? esc(r.clan) : 'No clan';
    var tier = r.tierIcon
      ? '<img class="st-tier" src="' + ASSETS + 'leaguetiers/125/' + esc(r.tierIcon) + '.png" alt="" title="' + esc(r.tier) + '" loading="lazy" decoding="async">'
      : '';
    return (
      '<li><a class="st-row" href="' + tagHref(tab.clan ? 'clan' : 'player', r.tag) + '">' +
      '<span class="st-rank"><b>' + r.rank + '</b>' + move(r) + '</span>' +
      badge +
      '<span class="st-who"><span class="st-name">' + esc(r.name) + '</span><span class="st-sub">' + sub + '</span></span>' +
      '<span class="st-score">' + tier + '<span><b>' + num(r.score) + '</b><span class="st-unit">' + tab.unit + '</span></span></span>' +
      '</a></li>'
    );
  }

  function ago(iso) {
    var h = Math.round((Date.now() - new Date(iso)) / 36e5);
    return h < 1 ? 'Updated just now' : h < 24 ? 'Updated ' + h + 'h ago' : 'Updated ' + Math.round(h / 24) + 'd ago';
  }
  function fact(id, html) {
    var el = $(id);
    el.innerHTML = html;
    el.hidden = false;
  }

  function leaderboards(data) {
    var tabsEl = $('#stTabs');
    var list = $('#stList');
    var more = $('#stMore');
    var regionEl = $('#stRegion');
    var tabs, tab, shown;

    function setRegion(region) {
      tabs = REGIONS[region];
      regionEl.value = region;
      // One board (World) needs no tabs.
      tabsEl.hidden = tabs.length < 2;
      tabsEl.innerHTML = tabs
        .map((t) => '<button type="button" class="am-btn gd-chip" data-key="' + t.key + '">' + t.label + '</button>')
        .join('');
      open(tabs[0].key);
    }

    function render() {
      var rows = data.rankings[tab.key] || [];
      list.innerHTML = rows.slice(0, shown).map((r) => rowHtml(r, tab)).join('');
      more.hidden = shown >= rows.length;
    }
    function open(key) {
      tab = tabs.find((t) => t.key === key);
      shown = PAGE;
      tabsEl.querySelectorAll('.gd-chip').forEach((b) => b.setAttribute('aria-pressed', b.dataset.key === key));
      render();
    }
    tabsEl.addEventListener('click', (e) => {
      var b = e.target.closest('.gd-chip');
      if (b) open(b.dataset.key);
    });
    more.addEventListener('click', () => {
      shown += PAGE;
      render();
    });
    regionEl.addEventListener('change', () => {
      var url = new URL(location.href);
      url.searchParams.set('region', regionEl.value);
      history.replaceState(null, '', url);
      setRegion(regionEl.value);
    });
    setRegion(new URLSearchParams(location.search).get('region') === 'global' ? 'global' : 'ph');
  }

  function equipment(data, eq) {
    var byName = {};
    (eq.equipment || []).forEach((e) => (byName[e.name] = e));
    var heroImg = {};
    Object.values(eq.heroes || {}).forEach((h) => (heroImg[h.name] = h.img));

    $('#stEqIntro').textContent =
      'The equipment on each hero of the world’s top ' + data.sample + ' players right now. Tap one to see its levels.';

    $('#stHeroes').innerHTML = data.heroes
      .map((h) => {
        var items = h.equipment
          .slice(0, 4)
          .map((e) => {
            var info = byName[e.name];
            var pct = Math.round((e.count / h.owners) * 100);
            var pic = info ? '<img src="' + UNIT_DIR + esc(info.img) + '" alt="" loading="lazy" decoding="async">' : '';
            var inner =
              '<span class="st-eq-pic">' + pic + '</span>' +
              '<span class="st-eq-name">' + esc(e.name) + '</span>' +
              '<span class="st-eq-pct">' + pct + '%</span>' +
              '<span class="st-eq-bar"><i style="width:' + pct + '%"></i></span>';
            return info
              ? '<li><a class="st-eq" href="/coc/tools/equipment#' + esc(info.id) + '">' + inner + '</a></li>'
              : '<li><span class="st-eq">' + inner + '</span></li>';
          })
          .join('');
        var img = heroImg[h.name] ? '<img class="st-hero-pic" src="' + UNIT_DIR + esc(heroImg[h.name]) + '" alt="" loading="lazy" decoding="async">' : '';
        return (
          '<article class="st-hero">' +
          '<header class="st-hero-head">' + img +
          '<div><h3 class="st-hero-name">' + esc(h.name) + '</h3>' +
          '<p class="st-hero-lvl">Average level <b>' + h.avgLevel + '</b> / ' + h.maxLevel + '</p></div></header>' +
          '<ol class="st-eqs">' + items + '</ol></article>'
        );
      })
      .join('');
  }

  Promise.all([fetch('/coc-lobby-stats.json').then((r) => r.json()), fetch('/coc-equipment.json').then((r) => r.json()).catch(() => ({}))])
    .then(([data, eq]) => {
      fact('#stUpdated', ago(data.updated));
      var days = Math.ceil((new Date(data.goldPass.end) - Date.now()) / 864e5);
      if (days > 0) fact('#stSeason', 'Season ends in <b>' + days + '</b> ' + (days === 1 ? 'day' : 'days'));
      leaderboards(data);
      equipment(data, eq);
    })
    .catch(() => ($('#stError').hidden = false));
})();
