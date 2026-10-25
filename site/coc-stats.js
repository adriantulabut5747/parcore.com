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


  // Region picker (Oct 21 2026): a native select's open list can't be
  // styled (it showed the OS's white list with a blue row), so on screen
  // it's the army maker's drop-down -- the raised .am-th key and its
  // .am-pop menu (coc-armymaker.css). The select stays, hidden, as the
  // state: picking an option sets it and fires its change event. Returns
  // sync(), which redraws the key after the select's value is set in code.
  function regionPicker(sel) {
    var wrap = document.createElement('div');
    wrap.className = 'am-ths st-region';
    wrap.innerHTML =
      '<button type="button" class="am-th" aria-haspopup="listbox" aria-expanded="false" aria-controls="stRegionMenu"><span></span>' +
      '<svg class="am-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
      '<div class="am-pop am-th-menu" id="stRegionMenu" role="listbox" aria-label="Region" hidden>' +
      [...sel.options]
        .map((o) => '<button type="button" role="option" class="am-th-opt" data-v="' + o.value + '"><span>' + o.textContent + '</span></button>')
        .join('') +
      '</div>';
    sel.hidden = true;
    sel.after(wrap);
    var btn = wrap.firstChild;
    var menu = wrap.lastChild;
    var opts = [...menu.children];
    function show(open) {
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', open);
      if (open) menu.querySelector('.is-on').focus({ preventScroll: true });
    }
    btn.addEventListener('click', () => show(menu.hidden));
    menu.addEventListener('click', (e) => {
      var b = e.target.closest('.am-th-opt');
      if (!b) return;
      show(false);
      btn.focus();
      if (b.dataset.v === sel.value) return;
      sel.value = b.dataset.v;
      sel.dispatchEvent(new Event('change'));
    });
    document.addEventListener('click', (e) => !wrap.contains(e.target) && show(false));
    wrap.addEventListener('keydown', (e) => {
      if (menu.hidden) return;
      if (e.key === 'Escape') {
        show(false);
        btn.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var i = opts.indexOf(document.activeElement) + (e.key === 'ArrowDown' ? 1 : -1);
        opts[(i + opts.length) % opts.length].focus();
      }
    });
    return function sync() {
      var name = sel.selectedOptions[0].textContent;
      btn.firstChild.textContent = name;
      btn.setAttribute('aria-label', 'Region: ' + name + ', change region');
      opts.forEach((b) => {
        b.classList.toggle('is-on', b.dataset.v === sel.value);
        b.setAttribute('aria-selected', b.dataset.v === sel.value);
      });
    };
  }

  function leaderboards(data) {
    var tabsEl = $('#stTabs');
    var list = $('#stList');
    var more = $('#stMore');
    var regionEl = $('#stRegion');
    var syncRegion = regionPicker(regionEl);
    var tabs, tab, shown;

    function setRegion(region) {
      tabs = REGIONS[region];
      regionEl.value = region;
      syncRegion();
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
      leaderboards(data);
      equipment(data, eq);
    })
    .catch(() => ($('#stError').hidden = false));
})();
