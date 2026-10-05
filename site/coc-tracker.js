/* Player Tracker (Oct 2026): the search on /coc/tools/player-tracker and the
   profile at /coc/player/<TAG>. Data comes from /api/coc (the Netlify
   function netlify/functions/coc-api.mjs, which holds the API key); icons and
   unit groups come from coc-army-data.json, the army maker's data.

   GitHub Pages can't run that function or the /coc/player/<TAG> rewrite, so
   there the page calls the Netlify test site directly and profiles use
   /coc/player/?tag=<TAG>. Plan: docs/player-tracker-plan.md. */
(function () {
  'use strict';

  var ON_PAGES = location.hostname.endsWith('github.io');
  // Change to the live site once the tracker launches there.
  var API = ON_PAGES ? 'https://extraordinary-donut-f21bde.netlify.app/api/coc' : '/api/coc';
  var RECENT_KEY = 'pt-recent';

  // Same rules as cleanTag in coc-api.mjs: "#abc o" -> "ABC0"; null if it
  // isn't a real tag (tags only use 0289PYLQGRJCUV).
  function cleanTag(raw) {
    var t = String(raw || '')
      .toUpperCase()
      .replace(/O/g, '0')
      .replace(/[^0-9A-Z]/g, '');
    return /^[0289PYLQGRJCUV]{3,12}$/.test(t) ? t : null;
  }

  function playerHref(tag) {
    return ON_PAGES ? '/coc/player/?tag=' + tag : '/coc/player/' + tag;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(n) {
    return (n || 0).toLocaleString('en-US');
  }

  function readRecent() {
    try {
      var list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }
  function saveRecent(p) {
    var list = readRecent().filter(function (r) {
      return r.tag !== p.tag;
    });
    list.unshift(p);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
    } catch (e) {}
  }

  // Town Hall art: coc-army-data.json has TH8-18; TH4-7 follow the same file
  // name; TH1-3 have no icon here.
  function thIcon(th, data) {
    var t = data && data.townHalls && data.townHalls[th];
    if (t && t.icon) return t.icon;
    return th >= 4 ? '/icons/th' + th + 'icon.webp' : '';
  }

  var MESSAGES = {
    badTag: 'That isn&rsquo;t a player tag. Tags start with # and only use the characters 0 2 8 9 P Y L Q G R J C U V.',
    notFound: 'No player has this tag. Copy it from the in-game profile and try again.',
    maintenance: 'Clash of Clans is in maintenance, so player data is unavailable. Try again when the game is back.',
    other: 'The player couldn&rsquo;t be loaded. Check your connection and try again.',
  };

  /* ---------------------------------------------------------------- search */
  function initSearch(form) {
    var input = form.querySelector('input');
    var msg = document.getElementById('ptSearchMsg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var tag = cleanTag(input.value);
      if (!tag) {
        msg.innerHTML = MESSAGES.badTag;
        msg.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      location.href = playerHref(tag);
    });
    input.addEventListener('input', function () {
      msg.hidden = true;
      input.removeAttribute('aria-invalid');
    });

    var box = document.getElementById('ptRecent');
    var recent = readRecent();
    if (!box || !recent.length) return;
    box.querySelector('ul').innerHTML = recent
      .map(function (r) {
        var icon = r.icon;
        return (
          '<li><a class="pt-recent-row" href="' +
          playerHref(r.tag) +
          '">' +
          (icon
            ? '<img src="' + icon + '" alt="" width="36" height="36" loading="lazy" />'
            : '<span class="pt-recent-th">TH' + r.th + '</span>') +
          '<span class="pt-recent-name">' +
          esc(r.name) +
          '</span>' +
          '<span class="pt-recent-tag">#' +
          r.tag +
          '</span></a></li>'
        );
      })
      .join('');
    box.hidden = false;
  }

  /* --------------------------------------------------------------- profile */
  // API names -> the army maker's names, where they differ beyond case,
  // spaces, dots and the word "Spell".
  var ALIAS = { hogriderpuppet: 'hogriderdoll' };
  function key(name) {
    var k = String(name)
      .toLowerCase()
      .replace(/ spell$/, '')
      .replace(/[^a-z0-9]/g, '');
    return ALIAS[k] || k;
  }

  var BB_UNITS = [
    'Battle Machine',
    'Battle Copter',
    'Raged Barbarian',
    'Sneaky Archer',
    'Boxer Giant',
    'Beta Minion',
    'Bomber',
    'Baby Dragon',
    'Cannon Cart',
    'Night Witch',
    'Drop Ship',
    'Power P.E.K.K.A',
    'Hog Glider',
    'Electrofire Wizard',
  ];

  function indexArmy(data) {
    var idx = {};
    ['heroes', 'pets', 'equipment', 'troops', 'sieges', 'spells'].forEach(function (group) {
      (data[group] || []).forEach(function (u) {
        idx[key(u.name)] = { group: group, img: data.imageDir + u.img };
      });
    });
    // Builder Base icons (bb-<name>.webp, from the Clash of Clans wiki) sit
    // in the same folder. Keyed "bb:" so the BB Baby Dragon doesn't take the
    // home one's place.
    BB_UNITS.forEach(function (n) {
      idx['bb:' + key(n)] = { group: 'builderBase', img: data.imageDir + 'bb-' + n.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.webp' };
    });
    return idx;
  }

  // el: 'li' inside a .pt-tiles list; 'div' for the hero portrait, which sits
  // inside the hero's own <li>.
  function tile(u, idx, extraClass, el) {
    el = el || 'li';
    var info = idx[(u.village === 'builderBase' ? 'bb:' : '') + key(u.name)];
    var maxed = u.level >= u.maxLevel;
    var label = u.name + ', level ' + u.level + ' of ' + u.maxLevel + (maxed ? ' (max)' : '');
    return (
      '<' +
      el +
      ' class="pt-tile' +
      (maxed ? ' is-max' : '') +
      (u.superTroopIsActive ? ' is-active' : '') +
      (extraClass ? ' ' + extraClass : '') +
      '" title="' +
      esc(label) +
      '"><span class="pt-tile-art">' +
      (info
        ? '<img src="' + info.img + '" alt="" loading="lazy" decoding="async" />'
        : '<span class="pt-tile-initials">' + esc(u.name.replace(/[^A-Z]/g, '').slice(0, 2)) + '</span>') +
      '<b class="pt-lvl">' +
      u.level +
      '</b></span><span class="pt-sr">' +
      esc(label) +
      '</span></' +
      el +
      '>'
    );
  }

  function tileGroup(title, units, idx) {
    if (!units.length) return '';
    var maxed = units.filter(function (u) {
      return u.level >= u.maxLevel;
    }).length;
    return (
      '<section class="pt-group"><div class="pt-group-head"><h3>' +
      title +
      '</h3><span>' +
      maxed +
      ' of ' +
      units.length +
      ' maxed</span></div>' +
      '<ul class="pt-tiles">' +
      units
        .map(function (u) {
          return tile(u, idx);
        })
        .join('') +
      '</ul></section>'
    );
  }

  // Heroes as cards (portrait, name, level), each with the equipment it has on.
  function heroCards(heroes, idx) {
    if (!heroes.length) return '';
    return (
      '<section class="pt-group"><div class="pt-group-head"><h3>Heroes</h3></div><ul class="pt-heroes">' +
      heroes
        .map(function (h) {
          var gear = (h.equipment || [])
            .map(function (e) {
              return tile(e, idx, 'pt-tile--sm');
            })
            .join('');
          return (
            '<li class="pt-hero">' +
            tile(h, idx, 'pt-tile--lg', 'div') +
            '<div class="pt-hero-text"><b>' +
            esc(h.name) +
            '</b><span>Level ' +
            h.level +
            ' of ' +
            h.maxLevel +
            '</span>' +
            (gear ? '<ul class="pt-tiles pt-gear" aria-label="Equipped">' + gear + '</ul>' : '') +
            '</div></li>'
          );
        })
        .join('') +
      '</ul></section>'
    );
  }

  function statGrid(rows) {
    return (
      '<dl class="pt-stats">' +
      rows
        .map(function (r) {
          return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
        })
        .join('') +
      '</dl>'
    );
  }

  function stars(n) {
    var s = '';
    for (var i = 0; i < 3; i++)
      s +=
        '<svg viewBox="0 0 24 24" class="' +
        (i < n ? 'on' : '') +
        '" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
    return '<span class="pt-stars" role="img" aria-label="' + n + ' of 3 stars">' + s + '</span>';
  }

  function renderProfile(p, data, root) {
    var idx = indexArmy(data);
    var home = function (u) {
      return u.village === 'home';
    };
    var inGroup = function (g) {
      return function (u) {
        var i = idx[key(u.name)];
        return home(u) && i && i.group === g;
      };
    };
    var homeTroops = p.troops.filter(home);
    var troops = homeTroops.filter(function (u) {
      var i = idx[key(u.name)];
      return !i || i.group === 'troops';
    });
    var th = p.townHallLevel;
    var icon = thIcon(th, data);
    var league = p.leagueTier || p.league;
    var tag = p.tag.slice(1);

    // header
    var labels = (p.labels || [])
      .map(function (l) {
        return '<img src="' + l.iconUrls.small + '" alt="' + esc(l.name) + '" title="' + esc(l.name) + '" width="28" height="28" />';
      })
      .join('');
    var clan = p.clan
      ? '<p class="pt-clan"><img src="' +
        p.clan.badgeUrls.small +
        '" alt="" width="28" height="28" /><span><b>' +
        esc(p.clan.name) +
        '</b> ' +
        esc(roleName(p.role)) +
        ' &middot; #' +
        p.clan.tag.slice(1) +
        '</span></p>'
      : '<p class="pt-clan pt-clan--none">Not in a clan</p>';

    // "this season" numbers reset when the season ends; the rest are all time.
    var stats = statGrid([
      ['Experience level', p.expLevel],
      ['Trophies now', num(p.trophies)],
      ['Best trophies ever', num(p.bestTrophies)],
      ['War stars', num(p.warStars)],
      ['Attack wins this season', num(p.attackWins)],
      ['Defense wins this season', num(p.defenseWins)],
      ['Donations this season', num(p.donations) + ' <i>given</i> &middot; ' + num(p.donationsReceived) + ' <i>received</i>'],
      ['Capital gold given', num(p.clanCapitalContributions)],
    ]);

    var heroHtml = heroCards(p.heroes.filter(home), idx);

    var achievements = ['home', 'builderBase', 'clanCapital']
      .map(function (v) {
        var list = p.achievements.filter(function (a) {
          return a.village === v;
        });
        if (!list.length) return '';
        var done = list.filter(function (a) {
          return a.stars === 3;
        }).length;
        return (
          '<section class="pt-group"><div class="pt-group-head"><h3>' +
          { home: 'Home village', builderBase: 'Builder base', clanCapital: 'Clan capital' }[v] +
          '</h3><span>' +
          done +
          ' of ' +
          list.length +
          ' complete</span></div><ul class="pt-ach">' +
          list
            .map(function (a) {
              return (
                '<li>' +
                stars(a.stars) +
                '<div><b>' +
                esc(a.name) +
                '</b><span>' +
                esc(a.stars === 3 ? a.completionInfo || a.info : a.info) +
                '</span></div><em>' +
                num(a.value) +
                (a.stars < 3 ? ' / ' + num(a.target) : '') +
                '</em></li>'
              );
            })
            .join('') +
          '</ul></section>'
        );
      })
      .join('');

    var bb = p.troops.filter(function (u) {
      return u.village === 'builderBase';
    });
    var bbHeroes = p.heroes.filter(function (u) {
      return u.village === 'builderBase';
    });

    root.innerHTML =
      '<header class="pt-head">' +
      '<div class="pt-th">' +
      (icon ? '<img src="' + icon + '" alt="" width="88" height="88" />' : '') +
      '<span>Town Hall ' +
      th +
      (p.townHallWeaponLevel ? ' <i>&middot; weapon ' + p.townHallWeaponLevel + '</i>' : '') +
      '</span></div>' +
      '<div class="pt-id"><h1 class="pt-name">' +
      esc(p.name) +
      '</h1>' +
      '<p class="pt-tagline"><span>#' +
      tag +
      '</span><button type="button" class="pt-copy" data-copy="#' +
      tag +
      '">Copy tag</button>' +
      (labels ? '<span class="pt-labels">' + labels + '</span>' : '') +
      '</p>' +
      clan +
      '</div>' +
      (league
        ? '<div class="pt-league">' +
          (league.iconUrls ? '<img src="' + (league.iconUrls.medium || league.iconUrls.small) + '" alt="" width="64" height="64" />' : '') +
          '<span>' +
          esc(league.name) +
          '</span></div>'
        : '') +
      // "Open in game" only works on a phone with Clash installed, so the row is phones-only (coc-tracker.css)
      '<div class="pt-actions">' +
      '<a class="th-soon-btn th-soon-btn--primary" href="https://link.clashofclans.com/en?action=OpenPlayerProfile&amp;tag=%23' +
      tag +
      '" rel="noopener">Open in game</a>' +
      '</div></header>' +
      stats +
      '<div class="pt-tabs" role="tablist" aria-label="Profile sections">' +
      '<button type="button" role="tab" id="ptTabHome" aria-controls="ptPanelHome" aria-selected="true">Home village</button>' +
      '<button type="button" role="tab" id="ptTabBB" aria-controls="ptPanelBB" aria-selected="false" tabindex="-1">Builder base</button>' +
      '<button type="button" role="tab" id="ptTabAch" aria-controls="ptPanelAch" aria-selected="false" tabindex="-1">Achievements</button>' +
      '</div>' +
      '<div class="pt-panel" id="ptPanelHome" role="tabpanel" aria-labelledby="ptTabHome">' +
      heroHtml +
      tileGroup('Hero equipment', p.heroEquipment.filter(home), idx) +
      tileGroup('Pets', homeTroops.filter(inGroup('pets')), idx) +
      tileGroup('Troops', troops, idx) +
      tileGroup('Siege machines', homeTroops.filter(inGroup('sieges')), idx) +
      tileGroup('Spells', p.spells.filter(home), idx) +
      '</div>' +
      '<div class="pt-panel" id="ptPanelBB" role="tabpanel" aria-labelledby="ptTabBB" hidden>' +
      (p.builderHallLevel
        ? statGrid([
            ['Builder Hall level', p.builderHallLevel],
            ['Trophies now', num(p.builderBaseTrophies)],
            ['Best trophies ever', num(p.bestBuilderBaseTrophies)],
            ['League', p.builderBaseLeague ? esc(p.builderBaseLeague.name) : 'Unranked'],
          ]) +
          heroCards(bbHeroes, idx) +
          tileGroup('Troops', bb, idx)
        : '<p class="pt-empty">This player hasn&rsquo;t unlocked the Builder Base yet.</p>') +
      '</div>' +
      '<div class="pt-panel" id="ptPanelAch" role="tabpanel" aria-labelledby="ptTabAch" hidden>' +
      achievements +
      '</div>' +
      '<p class="pt-source">Live data from the official Clash of Clans API, refreshed every 5 minutes, so a battle you just played can take a few minutes to show up. A red level means that unit is at the game&rsquo;s max level.</p>';

    wireTabs(root);
    root.querySelector('.pt-copy').addEventListener('click', function (e) {
      var btn = e.currentTarget;
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(btn.dataset.copy).then(function () {
        btn.textContent = 'Copied';
        setTimeout(function () {
          btn.textContent = 'Copy tag';
        }, 1600);
      });
    });
  }

  function roleName(r) {
    return { leader: 'Leader', coLeader: 'Co-leader', admin: 'Elder', member: 'Member' }[r] || '';
  }

  function wireTabs(root) {
    var tabs = [].slice.call(root.querySelectorAll('.pt-tabs [role=tab]'));
    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on);
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        select(t);
      });
      t.addEventListener('keydown', function (e) {
        var step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        var next = tabs[(i + step + tabs.length) % tabs.length];
        select(next);
        next.focus();
      });
    });
  }

  function showState(root, kind, tag) {
    root.innerHTML =
      '<section class="th-soon pt-state" role="alert"><h1 class="th-soon-title">' +
      (kind === 'notFound'
        ? 'Player <em>not found</em>'
        : kind === 'badTag'
          ? 'Not a <em>player tag</em>'
          : 'Couldn&rsquo;t <em>load</em>') +
      '</h1><p class="th-soon-text">' +
      MESSAGES[kind] +
      '</p><div class="th-soon-actions">' +
      (kind === 'other' || kind === 'maintenance'
        ? '<button type="button" class="th-soon-btn th-soon-btn--primary" data-retry>Try again</button>'
        : '') +
      '<a class="th-soon-btn" href="/coc/tools/player-tracker">Search another tag</a></div></section>';
    var retry = root.querySelector('[data-retry]');
    if (retry)
      retry.addEventListener('click', function () {
        loadProfile(root, tag);
      });
  }

  var armyData = null;
  function loadProfile(root, tag) {
    root.innerHTML = '<div class="pt-loading" role="status"><span class="parchrome-ring"></span>Loading #' + tag + '&hellip;</div>';
    armyData =
      armyData ||
      fetch('/coc-army-data.json').then(function (r) {
        return r.json();
      });
    Promise.all([fetch(API + '?type=player&tag=' + tag), armyData])
      .then(function (res) {
        return res[0].json().then(function (body) {
          if (!res[0].ok) throw new Error(body.error === 'notFound' || body.error === 'maintenance' ? body.error : 'other');
          return [body, res[1]];
        });
      })
      .then(function (r) {
        var p = r[0];
        document.title = p.name + ' (TH' + p.townHallLevel + ') | Player Tracker | Parchrome';
        renderProfile(p, r[1], root);
        saveRecent({ tag: tag, name: p.name, th: p.townHallLevel, icon: thIcon(p.townHallLevel, r[1]) });
      })
      .catch(function (err) {
        armyData = null; // a failed JSON load gets another go on retry
        showState(root, MESSAGES[err.message] ? err.message : 'other', tag);
      });
  }

  function initProfile(root) {
    var m = location.pathname.match(/\/coc\/player\/([^/]+)/);
    var raw = m ? decodeURIComponent(m[1]) : new URLSearchParams(location.search).get('tag');
    var tag = cleanTag(raw);
    if (!tag) return showState(root, 'badTag');
    // "/coc/player/%239l9glqlj" -> "/coc/player/9L9GLQLJ", so shared links all look the same
    if (m && m[1] !== tag) history.replaceState(null, '', playerHref(tag) + location.hash);
    loadProfile(root, tag);
  }

  var form = document.getElementById('ptSearch');
  if (form) initSearch(form);
  var root = document.getElementById('ptProfile');
  if (root) initProfile(root);
})();
