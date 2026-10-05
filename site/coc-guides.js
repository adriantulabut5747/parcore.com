// Full path of a link or address, e.g. "/coc/town-hall-18/layouts" -- the last
// part alone ("layouts") is the same for every Town Hall. "x.html", "x" and
// "x/index.html" count as the same page.
function cocPagePath(u) {
  var p = new URL(String(u || ''), location.origin + '/').pathname.toLowerCase();
  return p
    .replace(/\.html$/, '')
    .replace(/\/index$/, '/')
    .replace(/(.)\/$/, '$1');
}

/* =======================================================================
   GUIDES PAGES (coctools*.html) -- the content inside each page's box.
   One script for all four; each part runs only on the page that has its
   element:
     #gdSites   Web Tools     <- coc-websites.json
     #glossList Glossary      <- coc-glossary.json
     #eqGrid    Equipment     <- coc-equipment.json
     #wallCalc  Wall calculator (costs below, from the wiki)
   The rest of the page (top bar, hero, tabs, Live events, FAQ) is the same
   shell as the Town Hall pages -- th-layouts.js / thz-script.js run it.
   ======================================================================= */
(function guides() {
  'use strict';
  if (!window.fetch) return;

  function $(sel, el) {
    return (el || document).querySelector(sel);
  }
  function esc(t) {
    return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
  function load(url) {
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }
  function failed(box, what) {
    box.removeAttribute('aria-busy');
    box.innerHTML = '<p class="gd-empty">The ' + what + ' could not load. Refresh the page to try again.</p>';
  }
  // Loading skeletons: grey blocks shaped like what's coming (the .sk
  // shimmer from th-layouts.css, the same one the army cards use), so the
  // box never sits empty. Each list replaces them when its file arrives.
  function skeleton(box, shape, n) {
    box.innerHTML = shape.repeat(n);
    box.setAttribute('aria-busy', 'true');
  }
  function line(w, extra) {
    return '<span class="sk sk-line gd-sk-w' + w + (extra ? ' ' + extra : '') + '"></span>';
  }
  var SK = {
    site:
      '<div class="ct-card gd-skel" aria-hidden="true"><span class="sk gd-sk-ico"></span><span class="ct-card-body">' +
      line(55, 'gd-sk-title') +
      line(90) +
      line(70) +
      line(35, 'gd-sk-foot') +
      '</span></div>',
    gloss:
      '<div class="gd-skel gd-sk-gloss" aria-hidden="true"><span class="sk gd-sk-head"></span><span class="gd-sk-list">' +
      ('<span class="gd-sk-row">' + line(35) + line(90) + '</span>').repeat(5) +
      '</span></div>',
    eq: '<div class="gd-eq gd-skel" aria-hidden="true"><span class="sk gd-sk-pic"></span>' + line(70) + line(35) + '</div>',
  };
  var fmt = (n) => Number(n).toLocaleString('en-US');

  // Chip row (the top bar's keycap buttons): one pressed at a time.
  function chips(box, items, current, onPick) {
    box.innerHTML = items
      .map(
        (it) =>
          '<button type="button" class="am-btn gd-chip" data-key="' +
          esc(it.key) +
          '" aria-pressed="' +
          (it.key === current) +
          '">' +
          esc(it.label) +
          '</button>',
      )
      .join('');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.gd-chip');
      if (!b) return;
      box.querySelectorAll('.gd-chip').forEach((x) => x.setAttribute('aria-pressed', x === b));
      onPick(b.dataset.key);
    });
  }

  // ---- Web Tools ------------------------------------------------------------
  // Same card as coc-home's Clash Tools (.ct-card): the site's icon, what it
  // does as the title, one line, and the domain it opens.
  var ARROW =
    '<svg class="ct-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg>';
  var sites = $('#gdSites');
  if (sites) {
    skeleton(sites, SK.site, 6);
    load(sites.dataset.src)
      .then(function (d) {
        sites.removeAttribute('aria-busy');
        sites.innerHTML = d.sites
          .map(function (s) {
            var host = '';
            try {
              host = new URL(s.url).hostname.replace(/^www\./, '');
            } catch (e) {}
            return (
              '<a class="ct-card" href="' +
              esc(s.url) +
              '" target="_blank" rel="noopener noreferrer" title="' +
              esc(s.name) +
              '">' +
              '<span class="ct-card-icon"><img src="' +
              esc(s.icon) +
              '" alt="" width="40" height="40" loading="lazy" decoding="async"></span>' +
              '<div class="ct-card-body"><div class="ct-card-head"><span class="ct-card-name">' +
              esc(s.tag) +
              '</span>' +
              ARROW +
              '</div><p class="ct-card-desc">' +
              esc(s.desc) +
              '</p><span class="ct-card-foot">' +
              esc(host) +
              '</span></div></a>'
            );
          })
          .join('');
      })
      .catch(() => failed(sites, 'websites'));
  }

  // ---- Parchrome tools ------------------------------------------------------
  // The rest of the Tools section, as the same small cards as the websites.
  // Which tools, their order, names, icons and links come from
  // coc-nav-data.json's guides -- the Tools strip -- minus this page, so the
  // box always matches the strip; coc-websites.json only adds each one's
  // line of text. They open in the same tab: they're our pages.
  var tools = $('#gdTools');
  if (tools) {
    skeleton(tools, SK.site, 5);
    var here = cocPagePath(location.pathname);
    Promise.all([load('/coc-nav-data.json'), load(tools.dataset.src)])
      .then(function (r) {
        var text = r[1].tools || {};
        tools.removeAttribute('aria-busy');
        tools.innerHTML = r[0].guides
          .filter((g) => (g.activeOn || []).map(cocPagePath).indexOf(here) === -1)
          .map(function (g) {
            return (
              '<a class="ct-card" href="' +
              esc(g.href) +
              '">' +
              '<span class="ct-card-icon"><img src="' +
              esc(g.icon) +
              '" alt="" width="40" height="40" loading="lazy" decoding="async"></span>' +
              '<div class="ct-card-body"><div class="ct-card-head"><span class="ct-card-name">' +
              esc(g.name || g.label) +
              '</span>' +
              ARROW +
              '</div><p class="ct-card-desc">' +
              esc(text[g.id] || '') +
              '</p><span class="ct-card-foot">On Parchrome</span></div></a>'
            );
          })
          .join('');
      })
      .catch(() => failed(tools, 'tools'));
  }

  // ---- Glossary ---------------------------------------------------------------
  var glossList = $('#glossList');
  if (glossList) {
    skeleton(glossList, SK.gloss, 2);
    load(glossList.dataset.src)
      .then(function (d) {
        glossList.removeAttribute('aria-busy');
        var filter = 'all';
        var input = $('#glossSearch');
        var empty = $('#glossEmpty');
        chips(
          $('#glossFilters'),
          [{ key: 'all', label: 'All' }].concat(
            d.sections.map((s) => ({ key: s.id, label: s.label.replace(/ (Terms|Terminology|Strategies)$/, '') })),
          ),
          filter,
          function (k) {
            filter = k;
            render();
          },
        );
        function render() {
          var q = input.value.trim().toLowerCase();
          var html = '';
          d.sections.forEach(function (sec) {
            if (filter !== 'all' && filter !== sec.id) return;
            var terms = sec.terms.filter((t) => !q || (t.term + ' ' + (t.abbr || '') + ' ' + t.def).toLowerCase().indexOf(q) !== -1);
            if (!terms.length) return;
            html +=
              '<section class="gd-gloss"><h3 class="gd-gloss-head"><img src="' +
              esc(sec.icon) +
              '" alt="" width="28" height="28">' +
              esc(sec.label) +
              '<span class="gd-gloss-n">' +
              terms.length +
              '</span></h3><dl class="gd-gloss-list">' +
              terms
                .map(
                  (t) =>
                    '<div class="gd-term"><dt>' +
                    esc(t.term) +
                    (t.abbr ? ' <span class="gd-abbr">' + esc(t.abbr) + '</span>' : '') +
                    '</dt><dd>' +
                    esc(t.def) +
                    '</dd></div>',
                )
                .join('') +
              '</dl></section>';
          });
          glossList.innerHTML = html;
          empty.hidden = !!html;
          $('#glossQ').textContent = input.value.trim();
        }
        input.addEventListener('input', render);
        render();
      })
      .catch(() => failed(glossList, 'glossary'));
  }

  // ---- Equipment ----------------------------------------------------------------
  var grid = $('#eqGrid');
  if (grid) {
    var UNIT_DIR = '/clashofclans/coctools/units/';
    var ORE = [
      ['Shiny', '/clashofclans/coctools/Shiny_Ore.webp'],
      ['Glowy', '/clashofclans/coctools/Glowy_Ore.webp'],
      ['Starry', '/clashofclans/coctools/Starry_Ore.webp'],
    ];
    var HERO_ORDER = [0, 1, 6, 2, 4, 7]; // the order heroes unlock: King, Queen, Prince, Warden, Champion, Duke
    var SORTS = [
      { key: 'hero', label: 'By hero' },
      { key: 'name', label: 'A–Z' },
      { key: 'epic', label: 'Epic first' },
      { key: 'unlock', label: 'Unlock order' },
    ];
    skeleton(grid, SK.eq, 12);
    load(grid.dataset.src)
      .then(function (d) {
        grid.removeAttribute('aria-busy');
        var list = d.equipment;
        var byId = {};
        list.forEach((e, i) => ((byId[e.id] = e), (e._i = i)));
        var heroRank = (e) => HERO_ORDER.indexOf(e.hero);
        var epicRank = (e) => (e.rarity === 'Epic' ? 1 : 0);
        var CMP = {
          hero: (a, b) => heroRank(a) - heroRank(b) || epicRank(a) - epicRank(b) || a._i - b._i,
          name: (a, b) => a.name.localeCompare(b.name),
          epic: (a, b) => epicRank(b) - epicRank(a) || heroRank(a) - heroRank(b) || a._i - b._i,
          unlock: (a, b) => a.th - b.th || heroRank(a) - heroRank(b) || a._i - b._i,
        };
        var sort = 'hero';
        var open = null; // id of the piece whose panel is open
        var level = 0; // level shown in the open panel
        var showAll = false;

        $('#eqCount').textContent = list.length + ' pieces';
        chips($('#eqSort'), SORTS, sort, function (k) {
          sort = k;
          renderGrid();
        });

        function tile(e) {
          var h = d.heroes[e.hero];
          return (
            '<button type="button" class="gd-eq" data-id="' +
            e.id +
            '" aria-expanded="false" aria-controls="eqPanel">' +
            '<span class="gd-eq-pic"><img src="' +
            UNIT_DIR +
            esc(e.img) +
            '" alt="" width="128" height="128" loading="lazy" decoding="async"><img class="gd-eq-hero" src="' +
            UNIT_DIR +
            esc(h.img) +
            '" alt="" title="' +
            esc(h.name) +
            '" width="128" height="128" loading="lazy"></span>' +
            '<span class="gd-eq-name">' +
            esc(e.name) +
            '</span><span class="gd-eq-meta' +
            (e.rarity === 'Epic' ? ' is-epic' : '') +
            '">' +
            esc(e.rarity) +
            '</span></button>'
          );
        }
        function renderGrid() {
          grid.innerHTML = list.slice().sort(CMP[sort]).map(tile).join('');
          if (open) place();
        }

        // The panel goes right after the last tile in the tapped tile's row.
        var panel = document.createElement('div');
        panel.className = 'gd-eq-panel';
        panel.id = 'eqPanel';
        panel.setAttribute('role', 'region');
        function place() {
          var t = grid.querySelector('.gd-eq[data-id="' + open + '"]');
          if (!t) return;
          var last = t;
          for (var n = t.nextElementSibling; n; n = n.nextElementSibling) {
            if (!n.classList.contains('gd-eq')) continue;
            if (n.offsetTop > t.offsetTop + 4) break;
            last = n;
          }
          last.after(panel);
          grid.querySelectorAll('.gd-eq').forEach((x) => x.setAttribute('aria-expanded', x === t));
          t.classList.add('is-open');
        }

        function cell(v) {
          return v === '' || v == null ? '–' : esc(v);
        }
        function statCards(e, L) {
          return e.cols
            .map(
              (c, i) =>
                '<div class="gd-stat"><span class="gd-stat-k">' +
                esc(c.n) +
                '</span><span class="gd-stat-v">' +
                cell(L.s[i]) +
                '</span><span class="gd-stat-g">' +
                (c.g === 'hero' ? 'Hero boost' : 'Ability') +
                '</span></div>',
            )
            .join('');
        }
        function summonHtml(e, L) {
          var sm = e.summon;
          if (!sm) return '';
          var count = sm.countCol != null && sm.countCol > -1 ? L.s[sm.countCol] : '';
          var ul = sm.levelCol != null && sm.levelCol > -1 ? parseInt(L.s[sm.levelCol], 10) : null;
          var st = ul && sm.stats && sm.stats[ul];
          // How many and what level are already in the stat cards above, so
          // this block only adds the summoned unit's own stats.
          var cards = '';
          if (st)
            cards += sm.cols
              .map(
                (c, i) =>
                  '<div class="gd-stat"><span class="gd-stat-k">' +
                  esc(c) +
                  '</span><span class="gd-stat-v">' +
                  cell(st[i]) +
                  '</span></div>',
              )
              .join('');
          return (
            '<div class="gd-sub"><h4 class="gd-sub-title">' +
            (ul ? 'Each ' + esc(sm.unit) + ' (level ' + ul + ')' : 'Summons ' + (count ? esc(count) + ' ' : '') + esc(sm.unit) + 's') +
            '</h4>' +
            (cards ? '<div class="gd-stats">' + cards + '</div>' : '') +
            (sm.note ? '<p class="gd-note">' + esc(sm.note) + '</p>' : '') +
            '</div>'
          );
        }
        function oreLine(label, ore) {
          var parts = ore
            .map((n, i) =>
              n
                ? '<span class="gd-ore"><img src="' + ORE[i][1] + '" alt="" width="20" height="20">' + fmt(n) + ' ' + ORE[i][0] + '</span>'
                : '',
            )
            .filter(Boolean);
          return (
            '<p class="gd-ore-line"><span class="gd-ore-k">' +
            label +
            '</span>' +
            (parts.length ? parts.join('') : '<span class="gd-ore">Nothing</span>') +
            '</p>'
          );
        }
        function oreFrom(e, from) {
          return e.levels.filter((l) => l.lv > from).reduce((a, l) => [a[0] + l.ore[0], a[1] + l.ore[1], a[2] + l.ore[2]], [0, 0, 0]);
        }
        function tableHtml(e) {
          var hasStarry = e.levels.some((l) => l.ore[2]);
          var rows = showAll ? e.levels : e.levels.filter((l) => Math.abs(l.lv - level) <= 2 || l.lv === e.levels.length);
          var head =
            '<tr><th>Lv</th>' +
            e.cols.map((c) => '<th>' + esc(c.n) + '</th>').join('') +
            ORE.slice(0, hasStarry ? 3 : 2)
              .map((o) => '<th><img src="' + o[1] + '" alt="' + o[0] + ' Ore" title="' + o[0] + ' Ore" width="18" height="18"></th>')
              .join('') +
            '<th title="Blacksmith level required">BS</th></tr>';
          var body = rows
            .map(
              (l) =>
                '<tr' +
                (l.lv === level ? ' class="is-on"' : '') +
                '><td>' +
                l.lv +
                '</td>' +
                l.s.map((v) => '<td>' + cell(v) + '</td>').join('') +
                l.ore
                  .slice(0, hasStarry ? 3 : 2)
                  .map((n) => '<td>' + (n ? fmt(n) : '–') + '</td>')
                  .join('') +
                '<td>' +
                (l.bs || '–') +
                '</td></tr>',
            )
            .join('');
          return (
            '<div class="gd-table-wrap"><table class="gd-table"><thead>' +
            head +
            '</thead><tbody>' +
            body +
            '</tbody></table></div>' +
            '<button type="button" class="am-btn gd-more" data-act="all">' +
            (showAll ? 'Show fewer levels' : 'Show all ' + e.levels.length + ' levels') +
            '</button>'
          );
        }

        function renderPanel() {
          var e = byId[open];
          var h = d.heroes[e.hero];
          var max = e.levels.length;
          panel.setAttribute('aria-label', e.name);
          panel.innerHTML =
            '<div class="gd-eq-top"><img class="gd-eq-big" src="' +
            UNIT_DIR +
            esc(e.img) +
            '" alt="" width="128" height="128">' +
            '<div class="gd-eq-info"><h3 class="gd-eq-title">' +
            esc(e.name) +
            '</h3><div class="gd-pills"><span class="gd-pill"><img src="' +
            UNIT_DIR +
            esc(h.img) +
            '" alt="" width="18" height="18">' +
            esc(h.name) +
            '</span><span class="gd-pill">' +
            esc(e.type) +
            '</span><span class="gd-pill' +
            (e.rarity === 'Epic' ? ' is-epic' : '') +
            '">' +
            esc(e.rarity) +
            '</span></div>' +
            (e.desc ? '<p class="gd-eq-desc">' + esc(e.desc) + '.</p>' : '') +
            '<p class="gd-eq-unlock"><b>Unlock:</b> ' +
            esc(e.unlock) +
            '</p></div>' +
            '<button type="button" class="am-picker-close gd-close" data-act="close" aria-label="Close">&times;</button></div>' +
            // Level picker
            '<div class="gd-level"><label class="gd-level-k" for="eqLevel">Level <b id="eqLv">' +
            level +
            '</b> / ' +
            max +
            '</label><input type="range" id="eqLevel" min="1" max="' +
            max +
            '" value="' +
            level +
            '"></div>' +
            '<div data-part="level">' +
            levelParts(e) +
            '</div>' +
            (e.tips.length
              ? '<div class="gd-sub"><h4 class="gd-sub-title">Tips</h4><ul class="gd-tips">' +
                e.tips.map((t) => '<li>' + esc(t) + '</li>').join('') +
                '</ul></div>'
              : '') +
            (e.images
              ? '<div class="gd-sub"><h4 class="gd-sub-title">' +
                esc(e.images.title) +
                '</h4><div class="gd-shots">' +
                e.images.files
                  .map(
                    (f, i) =>
                      '<figure><img src="' +
                      esc(f) +
                      '" alt="' +
                      esc(e.images.captions[i]) +
                      '" loading="lazy" class="zoomable" onclick="openPalette(this)"><figcaption>' +
                      esc(e.images.captions[i]) +
                      '</figcaption></figure>',
                  )
                  .join('') +
                '</div></div>'
              : '') +
            '<div class="gd-sub"><h4 class="gd-sub-title">Every level</h4><div data-part="table">' +
            tableHtml(e) +
            '</div></div>';
        }
        // What the level slider changes: the stat cards, the summoned unit, the
        // ore still needed, and the rows shown in the table.
        function levelParts(e) {
          var L = e.levels[level - 1];
          var max = e.levels.length;
          return (
            '<div class="gd-stats">' +
            statCards(e, L) +
            '</div>' +
            summonHtml(e, L) +
            (level === max
              ? oreLine('Ore for levels 1 to ' + max, oreFrom(e, 1))
              : oreLine('Ore from level ' + level + ' to ' + max, oreFrom(e, level)))
          );
        }
        function updateLevel() {
          var e = byId[open];
          $('#eqLv', panel).textContent = level;
          $('[data-part="level"]', panel).innerHTML = levelParts(e);
          $('[data-part="table"]', panel).innerHTML = tableHtml(e);
        }

        function openEq(id, scroll) {
          if (!byId[id]) return;
          grid.querySelectorAll('.gd-eq.is-open').forEach((x) => x.classList.remove('is-open'));
          open = id;
          level = byId[id].levels.length;
          showAll = false;
          renderPanel();
          place();
          history.replaceState(null, '', '#' + id);
          if (scroll) panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        function closeEq() {
          var t = grid.querySelector('.gd-eq.is-open');
          open = null;
          panel.remove();
          grid.querySelectorAll('.gd-eq').forEach((x) => {
            x.classList.remove('is-open');
            x.setAttribute('aria-expanded', 'false');
          });
          history.replaceState(null, '', location.pathname + location.search);
          if (t) t.focus({ preventScroll: true });
        }

        grid.addEventListener('click', function (ev) {
          var t = ev.target.closest('.gd-eq');
          if (t) return open === t.dataset.id ? closeEq() : openEq(t.dataset.id, true);
          var a = ev.target.closest('[data-act]');
          if (!a) return;
          if (a.dataset.act === 'close') return closeEq();
          if (a.dataset.act === 'all') {
            showAll = !showAll;
            updateLevel();
          }
        });
        // The level slider: only the numbers are redrawn, never the slider
        // itself (replacing it mid-drag would drop the drag on phones).
        grid.addEventListener('input', function (ev) {
          if (ev.target.id !== 'eqLevel') return;
          level = parseInt(ev.target.value, 10);
          updateLevel();
        });
        document.addEventListener('keydown', function (ev) {
          if (ev.key === 'Escape' && open) closeEq();
        });
        var rt;
        window.addEventListener('resize', function () {
          clearTimeout(rt);
          rt = setTimeout(() => open && place(), 120);
        });

        renderGrid();
        var fromHash = decodeURIComponent(location.hash.slice(1));
        if (byId[fromHash]) setTimeout(() => openEq(fromHash, true), 150);
      })
      .catch(() => failed(grid, 'equipment list'));
  }

  // ---- Wall calculator ------------------------------------------------------------
  var wall = $('#wallCalc');
  if (wall) {
    // Gold (or elixir) to upgrade ONE wall from level i to i+1, i = 1..18.
    // Checked against the wiki's Wall table, Oct 5, 2026 -- unchanged since
    // the TH18 update (Nov 17, 2025) cut level 18 to 7M.
    var COST = [
      0, 1000, 5000, 10000, 20000, 30000, 50000, 75000, 100000, 200000, 500000, 1000000, 1500000, 2000000, 3000000, 4000000, 5000000,
      7000000, 10000000,
    ];
    // Town Hall needed for each wall level (index = level).
    var TH = [0, 2, 2, 3, 4, 5, 6, 7, 8, 9, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    // Level 19 is still capped: Supercell unlocks it in batches (275 of 325
    // pieces since Apr 27, 2026). Raise this when they release more.
    var CAP19 = 275;
    var MAX = COST.length; // 19
    var ART = (l) => '/clashofclans/coctools/walls/wall-' + l + '.webp';
    var GOLD = '/clashofclans/coctools/Gold.webp';
    var ELIXIR = '/clashofclans/coctools/walls/elixir.webp';
    var RING = '/clashofclans/coctools/walls/wall-ring.webp';
    var fromRow = $('#wallFrom');
    var toRow = $('#wallTo');
    var count = $('#wallCount');
    var out = $('#wallOut');
    var err = $('#wallError');
    var short = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M' : fmt(n));

    // The two rows: one radio per level, the wall's art over its number.
    // The radio is the real control (keyboard, screen readers); the tile
    // is its label.
    function buildRow(row) {
      var name = row.dataset.name;
      var html = '';
      for (var l = 1; l <= MAX; l++)
        html +=
          '<label class="wl-tile" data-lvl="' +
          l +
          '"><input type="radio" name="' +
          name +
          '" value="' +
          l +
          '" aria-label="Level ' +
          l +
          '"><img src="' +
          ART(l) +
          '" alt="" width="44" height="44" loading="lazy" decoding="async"><span class="wl-tile-n">' +
          l +
          '</span></label>';
      row.innerHTML = html;
    }
    buildRow(fromRow);
    buildRow(toRow);
    var pick = (name) => +(wall.querySelector('input[name="' + name + '"]:checked') || {}).value || 0;
    var setPick = (name, v) => {
      var r = wall.querySelector('input[name="' + name + '"][value="' + v + '"]');
      if (r) r.checked = true;
    };

    // Gold Pass Builder Boost (gp) and the Hammer Jam event (ev). They
    // multiply: the event comes off first, then the Gold Pass comes off
    // what's left -- 50% then 20% is 60% off, not 70% (checked against
    // Hammer Jam guides, Oct 2026). Fractions round up, the wiki's rule
    // for boosted costs. Wall Rings are never discounted: one per started
    // million of the full cost.
    var cut = (c, gp, ev) => Math.ceil((c * (100 - ev) * (100 - gp)) / 10000);
    var rings = (c) => Math.ceil(c / 1e6);

    // Starting inputs: the address first (a shared link), then this
    // device's remembered Gold Pass, then the defaults.
    var q = new URLSearchParams(location.search);
    var clampLvl = (v, d) => (v >= 1 && v <= MAX ? v : d);
    var a0 = clampLvl(parseInt(q.get('from'), 10), 1);
    var b0 = clampLvl(parseInt(q.get('to'), 10), 10);
    if (b0 <= a0) b0 = Math.min(MAX, a0 + 1);
    setPick('wallFrom', a0);
    setPick('wallTo', b0);
    var n0 = parseInt(q.get('n'), 10);
    if (n0 >= 1 && n0 <= 325) count.value = n0;
    var gp0 = q.get('gp');
    if (gp0 == null)
      try {
        gp0 = localStorage.getItem('wallGp');
      } catch (e) {}
    if (gp0) setPick('wallGp', gp0);
    if (q.get('ev')) setPick('wallEv', q.get('ev'));

    // Keep a row's picked wall in view: on load (no animation) and when
    // the current level pushes the target along. Scrolls only the row,
    // never the page.
    function reveal(row, smooth) {
      var t = row.querySelector('input:checked');
      if (!t) return;
      var tile = t.parentNode;
      var left = tile.offsetLeft - (row.clientWidth - tile.offsetWidth) / 2;
      row.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' });
    }
    // Edge fades on whichever side has more walls to scroll to.
    function edges(row) {
      var max = row.scrollWidth - row.clientWidth;
      row.parentNode.classList.toggle('more-l', max > 1 && row.scrollLeft > 1);
      row.parentNode.classList.toggle('more-r', max > 1 && row.scrollLeft < max - 1);
    }
    [fromRow, toRow].forEach(function (row) {
      row.addEventListener('scroll', () => edges(row), { passive: true });
      if ('ResizeObserver' in window) new ResizeObserver(() => edges(row)).observe(row);
    });

    var coin = (src) => '<img src="' + src + '" alt="" width="22" height="22">';

    function calc(moved) {
      var a = pick('wallFrom');
      var b = pick('wallTo');
      // Picking a current level at or above the target pushes the target
      // one level past it (or back to 19 / 18 at the top).
      if (b <= a) {
        if (a >= MAX) {
          a = MAX - 1;
          setPick('wallFrom', a);
        }
        b = a + 1;
        setPick('wallTo', b);
        if (moved) reveal(toRow, true);
      }
      var n = parseInt(count.value, 10);
      var gp = pick('wallGp');
      var ev = pick('wallEv');

      // Rows: below / at the current level the target walls are greyed out
      // and can't be picked; the walls you'll pay for join into one strip.
      [].forEach.call(toRow.children, function (t) {
        var l = +t.dataset.lvl;
        t.classList.toggle('is-off', l <= a);
        t.firstChild.disabled = l <= a;
        t.classList.toggle('is-path', l > a && l <= b);
        t.classList.toggle('is-end', l === b);
      });
      [].forEach.call(fromRow.children, function (t) {
        var l = +t.dataset.lvl;
        t.classList.toggle('is-done', l < a);
        t.classList.toggle('is-max', l === MAX);
        t.firstChild.disabled = l === MAX;
      });
      $('#wallFromPick').textContent = 'Level ' + a;
      $('#wallToPick').textContent = 'Level ' + b;
      $('#wallToTh').textContent = 'Needs Town Hall ' + TH[b];
      [].forEach.call(wall.querySelectorAll('[data-count]'), (c) => c.setAttribute('aria-pressed', String(+c.dataset.count === n)));

      // How the discounts combine, spelled out with this wall's numbers.
      var disc = $('#wallDisc');
      var off = 100 - ((100 - ev) * (100 - gp)) / 100;
      if (gp && ev) {
        var c10 = COST[b - 1];
        disc.innerHTML =
          '<b>' +
          off +
          '% off in total, not ' +
          (gp + ev) +
          '%.</b> Hammer Jam halves the price first, then the Gold Pass takes ' +
          gp +
          '% off what&rsquo;s left: level ' +
          b +
          ' goes ' +
          short(c10) +
          ' &rarr; ' +
          short(Math.ceil(c10 / 2)) +
          ' &rarr; ' +
          short(cut(c10, gp, ev)) +
          '.';
      } else if (ev)
        disc.innerHTML =
          '<b>Half price on every wall.</b> Not every Hammer Jam has covered walls, so check the wall price in game before you spend.';
      else if (gp)
        disc.innerHTML = '<b>' + gp + '% off every wall.</b> Your Builder Boost from the season challenges. Wall Rings stay the same.';
      else
        disc.innerHTML = 'Turn on your Gold Pass boost or a Hammer Jam. When both are on they multiply: 50% and 20% make 60% off, not 70%.';
      disc.classList.toggle('is-on', !!(gp || ev));

      // The address always holds the inputs, so refresh keeps them and
      // Share sends them. replaceState: no new history entry per tap.
      var p = new URLSearchParams({ from: a, to: b, n: count.value });
      if (gp) p.set('gp', gp);
      if (ev) p.set('ev', ev);
      history.replaceState(null, '', location.pathname + '?' + p + location.hash);

      var msg = '';
      if (!(n >= 1 && n <= 325)) msg = 'Enter between 1 and 325 walls.';
      err.textContent = msg;
      err.hidden = !msg;
      if (msg) {
        out.innerHTML = '';
        return;
      }
      var per = 0;
      var full = 0;
      var goldOnly = 0;
      var ring = 0;
      var rows = '';
      for (var i = a; i < b; i++) {
        var c = cut(COST[i], gp, ev);
        per += c;
        full += COST[i];
        ring += rings(COST[i]);
        // Elixir works from the upgrade to level 5 on; below that it's gold.
        if (i + 1 < 5) goldOnly += c;
        rows +=
          '<tr><td><span class="wl-step"><img src="' +
          ART(i + 1) +
          '" alt="" width="28" height="28" loading="lazy">' +
          i +
          ' → ' +
          (i + 1) +
          '</span></td><td>' +
          fmt(c) +
          (gp || ev ? '<s>' + fmt(COST[i]) + '</s>' : '') +
          '</td><td>' +
          fmt(c * n) +
          '</td><td>' +
          rings(COST[i]) +
          '</td></tr>';
      }
      var total = per * n;
      var saved = (full - per) * n;
      var notes = [];
      if (goldOnly) notes.push(fmt(goldOnly * n) + ' of it has to be gold: elixir only works from level 5 up.');
      if (b === 19 && n > CAP19) notes.push('Only ' + CAP19 + ' walls can reach level 19 for now. Supercell unlocks the rest in batches.');
      var by = [ev ? 'Hammer Jam' : '', gp ? gp + '% Gold Pass' : ''].filter(Boolean).join(' + ');
      out.innerHTML =
        '<div class="wl-result">' +
        '<div class="wl-total">' +
        '<span class="gd-field-label">Total for ' +
        fmt(n) +
        (n === 1 ? ' wall' : ' walls') +
        '</span>' +
        '<div class="wl-total-row"><span class="wl-coins">' +
        coin(GOLD) +
        (b > 4 ? coin(ELIXIR) : '') +
        '</span><b class="wl-total-v">' +
        short(total) +
        '</b></div>' +
        '<span class="wl-total-full">' +
        fmt(total) +
        (b > 4 ? ' gold or elixir' : ' gold') +
        '</span>' +
        (by ? '<span class="wl-save">' + by + ' saves you ' + short(saved) + '</span>' : '') +
        '</div>' +
        '<dl class="wl-facts">' +
        '<div><dt>Per wall</dt><dd>' +
        coin(GOLD) +
        fmt(per) +
        '</dd></div>' +
        '<div><dt>Or in Wall Rings</dt><dd>' +
        coin(RING) +
        fmt(ring * n) +
        '<small>' +
        ring +
        ' per wall</small></dd></div>' +
        '</dl>' +
        (notes.length ? '<ul class="wl-notes">' + notes.map((t) => '<li>' + t + '</li>').join('') + '</ul>' : '') +
        '</div>' +
        '<div class="gd-sub"><h4 class="gd-sub-title">Level by level' +
        (by ? ' <span class="wl-sub-gp">with ' + by + '</span>' : '') +
        '</h4><div class="gd-table-wrap"><table class="gd-table gd-table-wall"><thead><tr><th>Upgrade</th><th>Per wall</th><th>For ' +
        fmt(n) +
        '</th><th>Rings</th></tr></thead><tbody>' +
        rows +
        '</tbody><tfoot><tr><td>Total</td><td>' +
        fmt(per) +
        '</td><td>' +
        fmt(total) +
        '</td><td>' +
        ring +
        '</td></tr></tfoot></table></div></div>';
    }
    wall.addEventListener('input', (e) => e.target === count && calc());
    wall.addEventListener('change', function (e) {
      if (e.target.name === 'wallGp')
        try {
          localStorage.setItem('wallGp', e.target.value);
        } catch (er) {}
      calc(e.target.name === 'wallFrom');
    });
    wall.addEventListener('submit', (e) => e.preventDefault());
    wall.addEventListener('click', function (e) {
      var b = e.target.closest('[data-step], [data-count]');
      if (!b) return;
      count.value = b.dataset.count ? b.dataset.count : Math.min(325, Math.max(1, (parseInt(count.value, 10) || 0) + +b.dataset.step));
      calc();
    });
    calc();
    reveal(fromRow);
    reveal(toRow);

    // Share: the phone's share sheet where there is one, otherwise copy
    // the address. The button says what happened for two seconds.
    var shareBtn = $('#wallShare');
    if (shareBtn) {
      var label = shareBtn.querySelector('span');
      var say = function (t) {
        label.textContent = t;
        clearTimeout(say.t);
        say.t = setTimeout(() => (label.textContent = 'Share'), 2000);
      };
      shareBtn.addEventListener('click', function () {
        var url = location.href;
        if (navigator.share) navigator.share({ title: 'CoC wall upgrade cost', url: url }).catch(function () {});
        else if (navigator.clipboard)
          navigator.clipboard.writeText(url).then(
            () => say('Link copied'),
            () => say('Copy failed'),
          );
      });
    }
  }
})();
