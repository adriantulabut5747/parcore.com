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
     #gdSites   Outside websites (Tools page) <- coc-websites.json
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
      '<div class="tc-card tc-card--ext gd-skel" aria-hidden="true"><span class="sk tc-icon"></span><span class="tc-text">' +
      line(55, 'gd-sk-title') +
      line(90) +
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
          (it.img ? '<img src="' + esc(it.img) + '" alt="" width="22" height="22">' : '') +
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

  // ---- Outside websites (Tools page) ----------------------------------------
  // The same card as our own tools (.tc-card, coc-cards.css) in grey
  // (.tc-card--ext): favicon, the site's name with its domain beside it,
  // one line on what it is, and the leaving-the-site arrow.
  var EXT =
    '<svg class="tc-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg>';
  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  }
  var sites = $('#gdSites');
  if (sites) {
    skeleton(sites, SK.site, 6);
    load(sites.dataset.src)
      .then(function (d) {
        sites.removeAttribute('aria-busy');
        sites.innerHTML = d.sites
          .map(function (s) {
            return (
              '<a class="tc-card tc-card--ext" href="' +
              esc(s.url) +
              '" target="_blank" rel="noopener noreferrer" data-leave>' +
              '<span class="tc-icon"><img src="' +
              esc(s.icon) +
              '" alt="" width="30" height="30" loading="lazy" decoding="async"></span>' +
              '<span class="tc-text"><span class="tc-name">' +
              esc(s.name) +
              '<span class="tc-host">' +
              esc(hostOf(s.url)) +
              '</span></span><span class="tc-desc">' +
              esc(s.desc) +
              '</span></span>' +
              EXT +
              '</a>'
            );
          })
          .join('');
      })
      .catch(() => failed(sites, 'websites'));
    sites.addEventListener('click', leaving);
  }

  // ---- "You're leaving Parchrome" ---------------------------------------------
  // Clicking an outside website opens this dialog first: which site, that
  // someone else runs it, and Continue / Stay. "Don't show this again" is
  // remembered in this browser (localStorage), after which links open
  // straight away. Ctrl / Cmd / Shift-clicks skip it (the person already
  // chose where it opens). Native <dialog>: Esc, focus and the backdrop
  // come from the browser. Styles: coc-tools.css (.lv).
  var SKIP = 'parchrome-leave-skip';
  var dialog;
  function skipped() {
    try {
      return localStorage.getItem(SKIP) === '1';
    } catch (e) {
      return false;
    }
  }
  function buildDialog() {
    dialog = document.createElement('dialog');
    dialog.className = 'lv';
    dialog.setAttribute('aria-labelledby', 'lvTitle');
    dialog.setAttribute('aria-describedby', 'lvText');
    dialog.innerHTML =
      '<div class="lv-box">' +
      '<h2 class="lv-title" id="lvTitle">You\u2019re leaving Parchrome</h2>' +
      '<div class="lv-site"><img class="lv-ico" alt="" width="40" height="40"><span class="lv-who"><b class="lv-name"></b><span class="lv-host"></span></span></div>' +
      '<p class="lv-text" id="lvText">This website is run by someone else. Parchrome doesn\u2019t own or control it, and its own terms and privacy policy apply.</p>' +
      '<label class="lv-skip"><input type="checkbox"> Don\u2019t show this again</label>' +
      '<div class="lv-actions">' +
      '<button type="button" class="lv-btn lv-stay">Stay here</button>' +
      '<a class="lv-btn lv-go" target="_blank" rel="noopener noreferrer" autofocus>Continue' +
      EXT.replace('tc-arrow', 'lv-go-ico') +
      '</a></div></div>';
    document.body.appendChild(dialog);
    dialog.querySelector('.lv-stay').addEventListener('click', () => dialog.close());
    dialog.querySelector('.lv-go').addEventListener('click', () => dialog.close());
    dialog.querySelector('.lv-skip input').addEventListener('change', function () {
      try {
        if (this.checked) localStorage.setItem(SKIP, '1');
        else localStorage.removeItem(SKIP);
      } catch (e) {}
    });
    // a click on the dimmed backdrop (the <dialog> itself, outside the box)
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) dialog.close();
    });
  }
  function leaving(e) {
    var a = e.target.closest('a[data-leave]');
    if (!a || skipped() || e.ctrlKey || e.metaKey || e.shiftKey || !window.HTMLDialogElement) return;
    e.preventDefault();
    if (!dialog) buildDialog();
    dialog.querySelector('.lv-ico').src = a.querySelector('.tc-icon img').getAttribute('src');
    dialog.querySelector('.lv-name').textContent = a.querySelector('.tc-name').firstChild.textContent;
    dialog.querySelector('.lv-host').textContent = a.querySelector('.tc-host').textContent;
    dialog.querySelector('.lv-go').href = a.href;
    dialog.showModal();
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
              '<section class="gd-gloss"><h3 class="gd-gloss-head"><span class="gd-gloss-ico"><img src="' +
              esc(sec.icon) +
              '" alt="" width="26" height="26"></span>' +
              esc(sec.label) +
              '<span class="gd-gloss-n">' +
              terms.length +
              '</span></h3><dl class="gd-gloss-list">' +
              terms
                .map(
                  (t) =>
                    '<div class="gd-term"><dt>' +
                    hl(t.term, q) +
                    (t.abbr ? ' <span class="gd-abbr">' + hl(t.abbr, q) + '</span>' : '') +
                    '</dt><dd>' +
                    hl(t.def, q) +
                    '</dd></div>',
                )
                .join('') +
              '</dl></section>';
          });
          glossList.innerHTML = html;
          empty.hidden = !!html;
          $('#glossQ').textContent = input.value.trim();
        }
        // Escaped text with each case-insensitive hit of q wrapped in <mark>.
        function hl(text, q) {
          if (!q) return esc(text);
          var low = text.toLowerCase();
          var out = '';
          var i = 0;
          var j;
          while ((j = low.indexOf(q, i)) !== -1) {
            out += esc(text.slice(i, j)) + '<mark>' + esc(text.slice(j, j + q.length)) + '</mark>';
            i = j + q.length;
          }
          return out + esc(text.slice(i));
        }
        input.addEventListener('input', render);
        render();
      })
      .catch(() => failed(glossList, 'glossary'));
  }

  // ---- Equipment ----------------------------------------------------------------
  // Redesigned Oct 25 2026 (Adrian): tiles in their rarity's colour (purple =
  // Epic, blue = Common), filtered by hero and sorted by the chips. A tile opens
  // the INSPECT panel (#eqDlg, the Genshin Artifacts panel in CoC dress;
  // coc-guides.css "EQUIPMENT PANEL"): a modal on desktop, a bottom sheet on
  // phones. #<id> in the address opens one (shared links, the leaderboards
  // and /coc/ link here that way).
  var grid = $('#eqGrid');
  if (grid) {
    var UNIT_DIR = '/clashofclans/coctools/units/';
    var BANNERS = '/clashofclans/coctools/banners/'; // each hero's Hero Hall banner (also on /coc/'s hero cards)
    var ORE = [
      ['Shiny', '/clashofclans/coctools/Shiny_Ore.webp'],
      ['Glowy', '/clashofclans/coctools/Glowy_Ore.webp'],
      ['Starry', '/clashofclans/coctools/Starry_Ore.webp'],
    ];
    var HERO_ORDER = [0, 1, 6, 2, 4, 7]; // the order heroes unlock: King, Queen, Prince, Warden, Champion, Duke
    var HERO_SHORT = { 0: 'King', 1: 'Queen', 2: 'Warden', 4: 'Champion', 6: 'Prince', 7: 'Duke' };
    var SORTS = [
      { key: 'hero', label: 'By hero' },
      { key: 'name', label: 'A–Z' },
      { key: 'epic', label: 'Epic first' },
      { key: 'unlock', label: 'Unlock order' },
      { key: 'picked', label: 'Legend Picks' },
    ];
    var slug = (n) =>
      n
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    var dlg = $('#eqDlg');
    var dBody = $('#eqDBody');
    var box = $('#eqIn');
    skeleton(grid, SK.eq, 12);
    // The top 200's picks (coc-lobby-stats.json, weekly) are a bonus: the page works without them.
    Promise.all([load(grid.dataset.src), load('/coc-lobby-stats.json').catch(() => null)])
      .then(function (res) {
        var d = res[0];
        var stats = res[1];
        grid.removeAttribute('aria-busy');
        var list = d.equipment;
        var byId = {};
        list.forEach((e, i) => ((byId[e.id] = e), (e._i = i)));
        // name -> { n: players equipping it, of: players with that hero }. A hero's
        // list counts every piece equipped, so a piece missing from it has 0.
        var picks = {};
        var counted = {};
        if (stats)
          stats.heroes.forEach(function (h) {
            counted[h.name] = h.owners;
            h.equipment.forEach((x) => (picks[x.name] = x.count));
          });
        var pickPct = function (e) {
          var of = counted[d.heroes[e.hero].name];
          return of ? Math.round(((picks[e.name] || 0) / of) * 100) : null;
        };
        var heroRank = (e) => HERO_ORDER.indexOf(e.hero);
        var epicRank = (e) => (e.rarity === 'Epic' ? 1 : 0);
        var CMP = {
          hero: (a, b) => heroRank(a) - heroRank(b) || epicRank(a) - epicRank(b) || a._i - b._i,
          name: (a, b) => a.name.localeCompare(b.name),
          epic: (a, b) => epicRank(b) - epicRank(a) || heroRank(a) - heroRank(b) || a._i - b._i,
          unlock: (a, b) => a.th - b.th || heroRank(a) - heroRank(b) || a._i - b._i,
          picked: (a, b) => (pickPct(b) || 0) - (pickPct(a) || 0) || CMP.hero(a, b),
        };
        var sort = 'hero';
        var hero = 'all';
        var shown = []; // the grid's pieces in order: the panel's ‹ › walk through these
        var level = 0; // level shown in the open panel
        var showAll = false;

        $('#eqCount').textContent = list.length + ' pieces';
        chips($('#eqSort'), stats ? SORTS : SORTS.slice(0, -1), sort, function (k) {
          sort = k;
          renderGrid();
        });
        chips(
          $('#eqHero'),
          [{ key: 'all', label: 'All heroes' }].concat(
            HERO_ORDER.map((i) => ({ key: String(i), label: HERO_SHORT[i], img: UNIT_DIR + d.heroes[i].img })),
          ),
          hero,
          function (k) {
            hero = k;
            renderGrid();
          },
        );

        function tile(e) {
          var h = d.heroes[e.hero];
          var pct = sort === 'picked' ? pickPct(e) : null;
          return (
            '<button type="button" class="gd-eq ' +
            (e.rarity === 'Epic' ? 'is-epic' : 'is-common') +
            '" data-id="' +
            e.id +
            '" aria-haspopup="dialog">' +
            '<span class="gd-eq-pic"><img src="' +
            UNIT_DIR +
            esc(e.img) +
            '" alt="" width="128" height="128" loading="lazy" decoding="async"><img class="gd-eq-hero" src="' +
            UNIT_DIR +
            esc(h.img) +
            '" alt="" title="' +
            esc(h.name) +
            '" width="128" height="128" loading="lazy"></span>' +
            (pct != null ? '<span class="gd-eq-pct">' + pct + '%</span>' : '') +
            '<span class="gd-eq-name">' +
            esc(e.name) +
            '</span><span class="gd-eq-meta">' +
            esc(e.rarity) +
            '</span></button>'
          );
        }
        function renderGrid() {
          shown = list.filter((e) => hero === 'all' || String(e.hero) === hero).sort(CMP[sort]);
          // By hero, all heroes: a heading over each hero's pieces.
          var html = '';
          var last = null;
          shown.forEach(function (e) {
            if (sort === 'hero' && hero === 'all' && e.hero !== last) {
              last = e.hero;
              var h = d.heroes[e.hero];
              html +=
                '<h3 class="gd-eq-group"><img src="' +
                UNIT_DIR +
                esc(h.img) +
                '" alt="" width="28" height="28">' +
                esc(h.name) +
                '<span>' +
                list.filter((x) => x.hero === e.hero).length +
                '</span></h3>';
            }
            html += tile(e);
          });
          grid.innerHTML = html;
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

        // A piece as a small key (the stage's slot row, pairs): its art on its rarity's colour.
        function chip(e, cls, self) {
          var inner =
            '<img src="' + UNIT_DIR + esc(e.img) + '" alt="" width="64" height="64" loading="lazy"><span class="eq-vh">' + esc(e.name) + '</span>';
          var c = 'eq-chip ' + (e.rarity === 'Epic' ? 'is-epic' : 'is-common') + (cls ? ' ' + cls : '');
          return self
            ? '<span class="' + c + ' is-on" aria-current="true" title="' + esc(e.name) + '">' + inner + '</span>'
            : '<button type="button" class="' + c + '" data-id="' + e.id + '" title="' + esc(e.name) + '">' + inner + '</button>';
        }
        // One pair card: both pieces (the open one not clickable), what the pair is for.
        function pairCard(a, b, why, top, self) {
          return (
            '<div class="eq-pair' +
            (top ? ' is-top' : '') +
            '"><div class="eq-pair-pics">' +
            chip(a, '', a.id === self) +
            '<span class="eq-pair-plus" aria-hidden="true">+</span>' +
            chip(b, '', b.id === self) +
            '</div><div class="eq-pair-txt"><b>' +
            esc(a.name) +
            ' + ' +
            esc(b.name) +
            (top ? '<em>Top pair</em>' : '') +
            '</b><span>' +
            esc(why) +
            '</span></div></div>'
          );
        }
        function pairsHtml(e) {
          var own = (e.pairs || []).slice().sort((x, y) => y.top - x.top);
          if (own.length)
            return own.map((p) => (byId[p.with] ? pairCard(e, byId[p.with], p.for, p.top, e.id) : '')).join('');
          // Not in a pair: show this hero's top pairs instead, so the section still says what to run.
          var seen = {};
          var theirs = [];
          list
            .filter((x) => x.hero === e.hero)
            .forEach((x) =>
              (x.pairs || []).forEach(function (p) {
                var k = [x.id, p.with].sort().join('|');
                if (p.top && !seen[k] && byId[p.with]) (seen[k] = 1), theirs.push(pairCard(x, byId[p.with], p.for, true, e.id));
              }),
            );
          return (
            '<p class="eq-none">Not in a pair worth maxing. The ' +
            esc(HERO_SHORT[e.hero]) +
            '&rsquo;s best pairs:</p>' +
            theirs.join('')
          );
        }

        function inspect(e) {
          var h = d.heroes[e.hero];
          var epic = e.rarity === 'Epic';
          var max = e.levels.length;
          var i = shown.indexOf(e);
          var mates = list.filter((x) => x.hero === e.hero).sort(CMP.hero);
          var pct = pickPct(e);
          dlg.className = 'eq-dlg ' + (epic ? 'is-epic' : 'is-common');
          dlg.dataset.id = e.id;
          $('#eqDPos').textContent = e.rarity + (i >= 0 ? ' · ' + (i + 1) + ' of ' + shown.length : '');
          $('#eqDPrev').disabled = $('#eqDNext').disabled = i < 0 || shown.length < 2;

          var top200 =
            pct == null
              ? ''
              : '<a class="eq-top" href="/coc/tools/leaderboards#equipment" style="--p:' +
                pct +
                '%"><span class="eq-top-n">' +
                pct +
                '<small>%</small></span><span class="eq-top-t"><b>' +
                (pct ? 'of the world&rsquo;s top 200 equip it' : 'None of the world&rsquo;s top 200 equip it') +
                '</b><span>' +
                fmt(picks[e.name] || 0) +
                ' of ' +
                fmt(counted[h.name]) +
                ' ' +
                esc(h.name) +
                's, this week</span><i class="eq-top-bar" aria-hidden="true"></i></span></a>';

          box.innerHTML =
            '<div class="eq-stage">' +
            '<img class="eq-flag" src="' +
            BANNERS +
            slug(h.name) +
            '.webp" alt="" width="64" height="88">' +
            '<div class="eq-stage-art"><img src="' +
            UNIT_DIR +
            esc(e.img) +
            '" alt="" width="128" height="128"></div>' +
            '<div class="eq-stage-k"><span class="eq-rar">' +
            esc(e.rarity) +
            '</span><span>' +
            esc(e.type) +
            '</span></div>' +
            '<div class="eq-slots" role="group" aria-label="' +
            esc(h.name) +
            '&rsquo;s equipment">' +
            mates.map((x) => chip(x, 'eq-slot', x === e)).join('') +
            '</div>' +
            '<p class="eq-stage-h"><img src="' +
            UNIT_DIR +
            esc(h.img) +
            '" alt="" width="24" height="24">' +
            esc(h.name) +
            ' &middot; ' +
            mates.length +
            ' pieces</p>' +
            '</div>' +
            '<div class="eq-info">' +
            '<h2 class="eq-name" id="eqDName">' +
            esc(e.name) +
            '</h2>' +
            '<p class="eq-meta"><span class="eq-tag eq-tag--rar">' +
            esc(e.rarity) +
            '</span><span class="eq-tag">' +
            esc(e.type) +
            '</span><span>' +
            esc(h.name) +
            '</span><span>Town Hall ' +
            e.th +
            '+</span><span>Max level ' +
            max +
            '</span></p>' +
            (e.desc ? '<p class="eq-desc">' + esc(e.desc) + '.</p>' : '') +
            '<p class="eq-unlock"><b>How to get it:</b> ' +
            esc(e.unlock) +
            '</p>' +
            top200 +
            '<section class="eq-sec"><h3 class="eq-h">Stats by level</h3>' +
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
            '</div></section>' +
            '<section class="eq-sec"><h3 class="eq-h">Best paired with</h3><div class="eq-pairs">' +
            pairsHtml(e) +
            '</div></section>' +
            (e.tips.length
              ? '<section class="eq-sec"><h3 class="eq-h">Tips</h3><ol class="eq-tips">' +
                e.tips.map((t, n) => '<li><span class="eq-tip-n">' + (n + 1) + '</span><p>' + esc(t) + '</p></li>').join('') +
                '</ol></section>'
              : '') +
            (e.images
              ? '<section class="eq-sec"><h3 class="eq-h">' +
                esc(e.images.title) +
                '</h3><div class="gd-shots">' +
                e.images.files
                  .map(
                    (f, n) =>
                      '<figure><img src="' +
                      esc(f) +
                      '" alt="' +
                      esc(e.images.captions[n]) +
                      '" loading="lazy" class="zoomable" onclick="openPalette(this)"><figcaption>' +
                      esc(e.images.captions[n]) +
                      '</figcaption></figure>',
                  )
                  .join('') +
                '</div></section>'
              : '') +
            '<section class="eq-sec"><h3 class="eq-h">Every level</h3><div data-part="table">' +
            tableHtml(e) +
            '</div></section>' +
            '</div>';
        }
        function updateLevel() {
          var e = byId[dlg.dataset.id];
          $('#eqLv', box).textContent = level;
          $('[data-part="level"]', box).innerHTML = levelParts(e);
          $('[data-part="table"]', box).innerHTML = tableHtml(e);
        }

        function openEq(id) {
          var e = byId[id];
          if (!e) return;
          level = e.levels.length;
          showAll = false;
          inspect(e);
          dlg.classList.remove('is-closing');
          if (!dlg.open) {
            dlg.showModal();
            dBody.focus({ preventScroll: true });
          }
          dBody.scrollTop = 0;
          history.replaceState(null, '', '#' + id);
        }
        function closeEq() {
          if (!dlg.open || dlg.classList.contains('is-closing')) return;
          var id = dlg.dataset.id;
          var done = function () {
            dlg.close();
            dlg.classList.remove('is-closing');
            history.replaceState(null, '', location.pathname + location.search);
            var t = grid.querySelector('.gd-eq[data-id="' + id + '"]');
            if (t) t.focus({ preventScroll: true });
          };
          if (matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
          dlg.classList.add('is-closing');
          setTimeout(done, 200);
        }
        function step(n) {
          var i = shown.indexOf(byId[dlg.dataset.id]);
          if (i < 0 || shown.length < 2) return;
          openEq(shown[(i + n + shown.length) % shown.length].id);
        }
        // Phones: drag the grip / header down (or pull the content down at its top) to close.
        cocSheetDrag($('#eqPanel'), [$('#eqGrip'), $('#eqDBar')], dBody, closeEq);

        grid.addEventListener('click', function (ev) {
          var t = ev.target.closest('.gd-eq');
          if (t) openEq(t.dataset.id);
        });
        box.addEventListener('click', function (ev) {
          // Only a link inside the panel: the dialog itself carries data-id too, and
          // reopening the open piece reset the table and scrolled to the top.
          var t = ev.target.closest('[data-id]');
          if (t && box.contains(t)) return openEq(t.dataset.id);
          if (ev.target.closest('[data-act="all"]')) {
            showAll = !showAll;
            updateLevel();
          }
        });
        // The level slider: only the numbers are redrawn, never the slider
        // itself (replacing it mid-drag would drop the drag on phones).
        box.addEventListener('input', function (ev) {
          if (ev.target.id !== 'eqLevel') return;
          level = parseInt(ev.target.value, 10);
          updateLevel();
        });
        $('#eqDClose').addEventListener('click', closeEq);
        $('#eqDPrev').addEventListener('click', () => step(-1));
        $('#eqDNext').addEventListener('click', () => step(1));
        $('#eqDCopy').addEventListener('click', function (ev) {
          var b = ev.currentTarget;
          if (!navigator.clipboard) return;
          navigator.clipboard.writeText(location.origin + location.pathname + '#' + dlg.dataset.id).then(
            function () {
              b.classList.add('is-done');
              b.querySelector('span').textContent = 'Copied';
              setTimeout(function () {
                b.classList.remove('is-done');
                b.querySelector('span').textContent = 'Copy link';
              }, 1500);
            },
            function () {},
          );
        });
        dlg.addEventListener('cancel', function (ev) {
          ev.preventDefault();
          closeEq();
        });
        dlg.addEventListener('click', function (ev) {
          if (ev.target === dlg) closeEq(); // the backdrop
        });
        dlg.addEventListener('keydown', function (ev) {
          if (ev.target.closest('input')) return; // the slider uses the arrows
          if (ev.key === 'ArrowLeft') step(-1);
          if (ev.key === 'ArrowRight') step(1);
        });

        renderGrid();
        var fromHash = decodeURIComponent(location.hash.slice(1));
        if (byId[fromHash]) openEq(fromHash);
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
