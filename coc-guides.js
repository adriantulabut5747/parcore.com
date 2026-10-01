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
    box.innerHTML = '<p class="gd-empty">The ' + what + ' could not load. Refresh the page to try again.</p>';
  }
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
    load(sites.dataset.src)
      .then(function (d) {
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

  // ---- Glossary ---------------------------------------------------------------
  var glossList = $('#glossList');
  if (glossList) {
    load(glossList.dataset.src)
      .then(function (d) {
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
    var UNIT_DIR = 'clashofclans/coctools/units/';
    var ORE = [
      ['Shiny', 'clashofclans/coctools/Shiny_Ore.webp'],
      ['Glowy', 'clashofclans/coctools/Glowy_Ore.webp'],
      ['Starry', 'clashofclans/coctools/Starry_Ore.webp'],
    ];
    var HERO_ORDER = [0, 1, 6, 2, 4, 7]; // the order heroes unlock: King, Queen, Prince, Warden, Champion, Duke
    var SORTS = [
      { key: 'hero', label: 'By hero' },
      { key: 'name', label: 'A–Z' },
      { key: 'epic', label: 'Epic first' },
      { key: 'unlock', label: 'Unlock order' },
    ];
    load(grid.dataset.src)
      .then(function (d) {
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
    // Gold (or elixir, from level 5) to upgrade ONE wall from level i to i+1,
    // i = 1..18. Checked against the wiki's Wall table, Sep 30, 2026.
    var COST = [
      0, 1000, 5000, 10000, 20000, 30000, 50000, 75000, 100000, 200000, 500000, 1000000, 1500000, 2000000, 3000000, 4000000, 5000000,
      7000000, 10000000,
    ];
    var MAX = COST.length; // 19
    var from = $('#wallFrom');
    var to = $('#wallTo');
    var count = $('#wallCount');
    var out = $('#wallOut');
    var err = $('#wallError');
    var opts = (sel) =>
      Array.from(
        { length: MAX },
        (_, i) => '<option value="' + (i + 1) + '"' + (i + 1 === sel ? ' selected' : '') + '>Level ' + (i + 1) + '</option>',
      ).join('');
    from.innerHTML = opts(1);
    to.innerHTML = opts(10);
    var short = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M' : fmt(n));

    function calc() {
      var a = +from.value;
      var b = +to.value;
      var n = parseInt(count.value, 10);
      var msg = '';
      if (!(n >= 1 && n <= 325)) msg = 'Enter between 1 and 325 walls.';
      else if (b <= a) msg = 'Pick a target level higher than the current one.';
      err.textContent = msg;
      err.hidden = !msg;
      if (msg) {
        out.innerHTML = '';
        return;
      }
      var per = 0;
      var rows = '';
      for (var i = a; i < b; i++) {
        per += COST[i];
        rows += '<tr><td>' + i + ' → ' + (i + 1) + '</td><td>' + fmt(COST[i]) + '</td><td>' + fmt(COST[i] * n) + '</td></tr>';
      }
      out.innerHTML =
        '<div class="gd-stats gd-stats-4">' +
        '<div class="gd-stat gd-stat-main"><span class="gd-stat-k">Total cost</span><span class="gd-stat-v">' +
        short(per * n) +
        '</span><span class="gd-stat-g">' +
        fmt(per * n) +
        ' gold or elixir</span></div>' +
        '<div class="gd-stat"><span class="gd-stat-k">Per wall</span><span class="gd-stat-v">' +
        short(per) +
        '</span></div>' +
        '<div class="gd-stat"><span class="gd-stat-k">Levels</span><span class="gd-stat-v">' +
        a +
        ' → ' +
        b +
        '</span></div>' +
        '<div class="gd-stat"><span class="gd-stat-k">Walls</span><span class="gd-stat-v">' +
        fmt(n) +
        '</span></div></div>' +
        '<div class="gd-sub"><h4 class="gd-sub-title">Level by level</h4><div class="gd-table-wrap"><table class="gd-table gd-table-wall"><thead><tr><th>Upgrade</th><th>Per wall</th><th>For ' +
        fmt(n) +
        ' walls</th></tr></thead><tbody>' +
        rows +
        '</tbody><tfoot><tr><td>Total</td><td>' +
        fmt(per) +
        '</td><td>' +
        fmt(per * n) +
        '</td></tr></tfoot></table></div></div>';
    }
    wall.addEventListener('input', calc);
    wall.addEventListener('change', calc);
    wall.addEventListener('submit', (e) => e.preventDefault());
    wall.addEventListener('click', function (e) {
      var b = e.target.closest('[data-step]');
      if (!b) return;
      count.value = Math.min(325, Math.max(1, (parseInt(count.value, 10) || 0) + +b.dataset.step));
      calc();
    });
    calc();
  }
})();
