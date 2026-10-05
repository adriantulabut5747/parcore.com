/* Player Tracker (Oct 2026): the search on /coc/tools/player-tracker, the
   player profile at /coc/player/<TAG> and the clan page at /coc/clan/<TAG>. Data comes from /api/coc (the Netlify
   function netlify/functions/coc-api.mjs, which holds the API key); icons and
   unit groups come from coc-army-data.json, the army maker's data.

   GitHub Pages can't run that function or the /coc/player/<TAG> rewrite, so
   there the page calls the Netlify test site directly and profiles use
   /coc/player/?tag=<TAG> (clans: /coc/clan/?tag=<TAG>). Plan: docs/player-tracker-plan.md. */
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
  function clanHref(tag) {
    return ON_PAGES ? '/coc/clan/?tag=' + tag : '/coc/clan/' + tag;
  }

  // GET /api/coc?<query>; rejects with Error('notFound' | 'maintenance' |
  // 'private' | 'other').
  function api(query) {
    return fetch(API + '?' + query).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) throw new Error(['notFound', 'maintenance', 'private'].indexOf(body.error) !== -1 ? body.error : 'other');
        return body;
      });
    });
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
  // Entries: { kind: 'player' | 'clan', tag, name, icon, th }. Entries saved
  // before clans existed have no kind and are players.
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

  // Error text per page kind. maintenance / other read the same for both.
  var MESSAGES = {
    player: {
      badTag: 'That isn&rsquo;t a player tag. Tags start with # and only use the characters 0 2 8 9 P Y L Q G R J C U V.',
      notFound: 'No player has this tag. Copy it from the in-game profile and try again.',
    },
    clan: {
      badTag: 'That isn&rsquo;t a clan tag. Tags start with # and only use the characters 0 2 8 9 P Y L Q G R J C U V.',
      notFound: 'No clan has this tag. Copy it from the clan&rsquo;s in-game profile and try again.',
    },
    maintenance: 'Clash of Clans is in maintenance, so its data is unavailable. Try again when the game is back.',
    other: 'This couldn&rsquo;t be loaded. Check your connection and try again.',
  };
  function message(what, kind) {
    return MESSAGES[what][kind] || MESSAGES[kind] || MESSAGES.other;
  }

  /* ---------------------------------------------------------------- search */
  // Two modes, switched by the Player / Clan control above the field:
  // - player: a tag -> /coc/player/<TAG>
  // - clan: "#TAG" -> /coc/clan/<TAG>; anything else is a clan-name search
  //   (3+ characters), listed under the field. A name search that finds
  //   nothing but is a valid tag goes to that clan.
  function initSearch(form) {
    var input = form.querySelector('input');
    var hash = form.querySelector('.pt-field-hash');
    var label = form.querySelector('label');
    var msg = document.getElementById('ptSearchMsg');
    var results = document.getElementById('ptResults');
    var modes = [].slice.call(document.querySelectorAll('.pt-mode [role=radio]'));
    var mode = 'player';

    function setMode(m) {
      mode = m;
      modes.forEach(function (b) {
        var on = b.dataset.mode === m;
        b.setAttribute('aria-checked', on);
        b.tabIndex = on ? 0 : -1;
      });
      hash.hidden = m === 'clan';
      form.classList.toggle('is-clan', m === 'clan');
      input.placeholder = m === 'clan' ? 'Clan name or #tag' : 'Player tag';
      label.textContent = m === 'clan' ? 'Clan name or tag' : 'Player tag';
      clearMsg();
      results.hidden = true;
    }
    modes.forEach(function (b, i) {
      b.addEventListener('click', function () {
        setMode(b.dataset.mode);
        input.focus();
      });
      b.addEventListener('keydown', function (e) {
        var step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        var next = modes[(i + step + modes.length) % modes.length];
        setMode(next.dataset.mode);
        next.focus();
      });
    });

    function showMsg(html) {
      msg.innerHTML = html;
      msg.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
    function clearMsg() {
      msg.hidden = true;
      input.removeAttribute('aria-invalid');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var raw = input.value.trim();
      if (mode === 'player') {
        var tag = cleanTag(raw);
        if (tag) location.href = playerHref(tag);
        else showMsg(message('player', 'badTag'));
        return;
      }
      if (raw.charAt(0) === '#') {
        var ctag = cleanTag(raw);
        if (ctag) location.href = clanHref(ctag);
        else showMsg(message('clan', 'badTag'));
        return;
      }
      if (raw.length < 3) return showMsg('Type at least 3 letters of the clan name, or its tag starting with #.');
      searchClans(raw);
    });
    input.addEventListener('input', clearMsg);

    function searchClans(name) {
      results.hidden = false;
      results.innerHTML = '<li class="pt-results-note" role="status">Searching&hellip;</li>';
      api('type=clansearch&name=' + encodeURIComponent(name))
        .then(function (body) {
          var items = body.items || [];
          var asTag = cleanTag(name);
          if (!items.length && asTag) {
            location.href = clanHref(asTag);
            return;
          }
          if (!items.length) {
            results.innerHTML = '<li class="pt-results-note">No clans found with that name.</li>';
            return;
          }
          results.innerHTML = items
            .map(function (c) {
              return (
                '<li><a class="pt-result" href="' +
                clanHref(c.tag.slice(1)) +
                '"><img src="' +
                c.badgeUrls.small +
                '" alt="" width="40" height="40" loading="lazy" /><span class="pt-result-main"><b>' +
                esc(c.name) +
                '</b><span>#' +
                c.tag.slice(1) +
                (c.location ? ' &middot; ' + esc(c.location.name) : '') +
                '</span></span><span class="pt-result-meta"><b>Level ' +
                c.clanLevel +
                '</b><span>' +
                c.members +
                '/50 members</span></span></a></li>'
              );
            })
            .join('');
        })
        .catch(function (err) {
          results.innerHTML = '<li class="pt-results-note">' + message('clan', err.message) + '</li>';
        });
    }

    var box = document.getElementById('ptRecent');
    var recent = readRecent();
    if (!box || !recent.length) return;
    box.querySelector('ul').innerHTML = recent
      .map(function (r) {
        var clan = r.kind === 'clan';
        return (
          '<li><a class="pt-recent-row" href="' +
          (clan ? clanHref(r.tag) : playerHref(r.tag)) +
          '">' +
          (r.icon
            ? '<img src="' + r.icon + '" alt="" width="36" height="36" loading="lazy" />'
            : '<span class="pt-recent-th">TH' + r.th + '</span>') +
          '<span class="pt-recent-name">' +
          esc(r.name) +
          '<i>' +
          (clan ? 'Clan' : 'Player') +
          '</i></span>' +
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

  // One labelled row of numbers ("All time: 238 XP level | 2,071 war stars
  // ..."). The profile header has two (all time, this season); the Builder
  // Base tab has one. dt comes first for screen readers; CSS shows the
  // number above its label.
  function facts(title, rows) {
    return (
      '<div class="pt-facts"><span class="pt-facts-h">' +
      title +
      '</span><dl>' +
      rows
        .map(function (r) {
          return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
        })
        .join('') +
      '</dl></div>'
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
        '" alt="" width="28" height="28" /><span><a class="pt-clan-link" href="' +
        clanHref(p.clan.tag.slice(1)) +
        '">' +
        esc(p.clan.name) +
        '</a> ' +
        esc(roleName(p.role)) +
        ' &middot; #' +
        p.clan.tag.slice(1) +
        '</span></p>'
      : '<p class="pt-clan pt-clan--none">Not in a clan</p>';

    // "This season" numbers reset when the season ends; the others never do.
    var stats =
      '<div class="pt-head-facts">' +
      facts('All time', [
        ['XP level', p.expLevel],
        ['Best trophies', num(p.bestTrophies)],
        ['War stars', num(p.warStars)],
        ['Capital gold', num(p.clanCapitalContributions)],
      ]) +
      facts('This season', [
        ['Trophies', num(p.trophies)],
        ['Attack wins', num(p.attackWins)],
        ['Defense wins', num(p.defenseWins)],
        ['Donated', num(p.donations)],
        ['Received', num(p.donationsReceived)],
      ]) +
      '</div>';

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
      stats +
      '</header>' +
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
        ? '<section class="pt-group">' +
          facts('Builder Base', [
            ['Builder Hall', p.builderHallLevel],
            ['Trophies', num(p.builderBaseTrophies)],
            ['Best trophies', num(p.bestBuilderBaseTrophies)],
            ['League', p.builderBaseLeague ? esc(p.builderBaseLeague.name) : 'Unranked'],
          ]) +
          '</section>' +
          heroCards(bbHeroes, idx) +
          tileGroup('Troops', bb, idx)
        : '<p class="pt-empty">This player hasn&rsquo;t unlocked the Builder Base yet.</p>') +
      '</div>' +
      '<div class="pt-panel" id="ptPanelAch" role="tabpanel" aria-labelledby="ptTabAch" hidden>' +
      achievements +
      '</div>' +
      '<p class="pt-source">Live data from the official Clash of Clans API, refreshed every 5 minutes, so a battle you just played can take a few minutes to show up. A red level means that unit is at the game&rsquo;s max level.</p>';

    wireTabs(root);
    wireCopy(root);
  }

  function wireCopy(root) {
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

  // Error panel for the profile and clan pages. what: 'player' | 'clan'.
  function showState(root, what, kind, retry) {
    var noun = what === 'clan' ? 'Clan' : 'Player';
    root.innerHTML =
      '<section class="th-soon pt-state" role="alert"><h1 class="th-soon-title">' +
      (kind === 'notFound'
        ? noun + ' <em>not found</em>'
        : kind === 'badTag'
          ? 'Not a <em>' + noun.toLowerCase() + ' tag</em>'
          : 'Couldn&rsquo;t <em>load</em>') +
      '</h1><p class="th-soon-text">' +
      message(what, kind) +
      '</p><div class="th-soon-actions">' +
      (retry && (kind === 'other' || kind === 'maintenance')
        ? '<button type="button" class="th-soon-btn th-soon-btn--primary" data-retry>Try again</button>'
        : '') +
      '<a class="th-soon-btn" href="/coc/tools/player-tracker">Search again</a></div></section>';
    var btn = root.querySelector('[data-retry]');
    if (btn) btn.addEventListener('click', retry);
  }

  // The tag in /coc/<player|clan>/<TAG> (or ?tag= on GitHub Pages), cleaned;
  // tidies the address so shared links all look the same.
  function tagFromAddress(what) {
    var m = location.pathname.match(new RegExp('/coc/' + what + '/([^/]+)'));
    var tag = cleanTag(m ? decodeURIComponent(m[1]) : new URLSearchParams(location.search).get('tag'));
    if (tag && m && m[1] !== tag) history.replaceState(null, '', (what === 'clan' ? clanHref : playerHref)(tag) + location.hash);
    return tag;
  }

  var armyData = null;
  function loadProfile(root, tag) {
    root.innerHTML = '<div class="pt-loading" role="status"><span class="parchrome-ring"></span>Loading #' + tag + '&hellip;</div>';
    armyData =
      armyData ||
      fetch('/coc-army-data.json').then(function (r) {
        return r.json();
      });
    Promise.all([api('type=player&tag=' + tag), armyData])
      .then(function (r) {
        var p = r[0];
        document.title = p.name + ' (TH' + p.townHallLevel + ') | Player Tracker | Parchrome';
        renderProfile(p, r[1], root);
        saveRecent({ kind: 'player', tag: tag, name: p.name, th: p.townHallLevel, icon: thIcon(p.townHallLevel, r[1]) });
      })
      .catch(function (err) {
        armyData = null; // a failed JSON load gets another go on retry
        showState(root, 'player', err.message, function () {
          loadProfile(root, tag);
        });
      });
  }

  function initProfile(root) {
    var tag = tagFromAddress('player');
    if (!tag) return showState(root, 'player', 'badTag');
    loadProfile(root, tag);
  }

  /* ------------------------------------------------------------------ clan */
  var CLAN_TYPE = { open: 'Anyone can join', inviteOnly: 'Invite only', closed: 'Closed' };
  var WAR_FREQ = {
    always: 'Always',
    moreThanOncePerWeek: 'Twice a week',
    oncePerWeek: 'Once a week',
    lessThanOncePerWeek: 'Rarely',
    never: 'Never',
    unknown: 'Not set',
  };

  // Members table columns: [key, heading, value to sort by, cell html].
  var MEMBER_COLS = [
    [
      'rank',
      '#',
      function (m) {
        return m.clanRank;
      },
      function (m) {
        return m.clanRank;
      },
    ],
    [
      'name',
      'Player',
      function (m) {
        return m.name.toLowerCase();
      },
      function (m) {
        return '<a href="' + playerHref(m.tag.slice(1)) + '">' + esc(m.name) + '</a><span>' + roleName(m.role) + '</span>';
      },
    ],
    [
      'th',
      'TH',
      function (m) {
        return m.townHallLevel;
      },
      function (m, data) {
        var icon = thIcon(m.townHallLevel, data);
        return (icon ? '<img src="' + icon + '" alt="" width="26" height="26" loading="lazy" />' : '') + '<b>' + m.townHallLevel + '</b>';
      },
    ],
    [
      'trophies',
      'Trophies',
      function (m) {
        return m.trophies;
      },
      function (m) {
        return num(m.trophies);
      },
    ],
    [
      'donated',
      'Donated',
      function (m) {
        return m.donations;
      },
      function (m) {
        return num(m.donations);
      },
    ],
    [
      'received',
      'Received',
      function (m) {
        return m.donationsReceived;
      },
      function (m) {
        return num(m.donationsReceived);
      },
    ],
  ];

  function memberRows(members, data) {
    return members
      .map(function (m) {
        return (
          '<tr>' +
          MEMBER_COLS.map(function (c) {
            return '<td class="pt-col-' + c[0] + '">' + c[3](m, data) + '</td>';
          }).join('') +
          '</tr>'
        );
      })
      .join('');
  }
  function membersTable(members, data) {
    return (
      '<div class="pt-table-wrap"><table class="pt-table"><thead><tr>' +
      MEMBER_COLS.map(function (c) {
        return (
          '<th scope="col" class="pt-col-' +
          c[0] +
          '"' +
          (c[0] === 'rank' ? ' aria-sort="ascending"' : '') +
          '><button type="button" data-sort="' +
          c[0] +
          '">' +
          c[1] +
          '</button></th>'
        );
      }).join('') +
      '</tr></thead><tbody>' +
      memberRows(members, data) +
      '</tbody></table></div>'
    );
  }
  // Click a heading to sort by it, again to flip. Rank and names sort up
  // first, numbers down (most trophies first). Ties keep clan rank order.
  function wireSort(root, members, data) {
    var table = root.querySelector('.pt-table');
    var by = 'rank';
    var dir = 1;
    table.querySelector('thead').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-sort]');
      if (!btn) return;
      var col = MEMBER_COLS.filter(function (c) {
        return c[0] === btn.dataset.sort;
      })[0];
      dir = by === col[0] ? -dir : col[0] === 'rank' || col[0] === 'name' ? 1 : -1;
      by = col[0];
      var sorted = members.slice().sort(function (a, b) {
        var x = col[2](a);
        var y = col[2](b);
        return x < y ? -dir : x > y ? dir : a.clanRank - b.clanRank;
      });
      table.querySelector('tbody').innerHTML = memberRows(sorted, data);
      table.querySelectorAll('th').forEach(function (th) {
        th.removeAttribute('aria-sort');
      });
      btn.parentNode.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
    });
  }

  // log: the war list, 'private', or null when it couldn't be loaded.
  function warLog(log) {
    if (log === 'private') return '<p class="pt-empty">This clan keeps its war log private, so its past wars can&rsquo;t be shown.</p>';
    if (!log) return '<p class="pt-empty">The war log couldn&rsquo;t be loaded. Reload the page to try again.</p>';
    if (!log.length) return '<p class="pt-empty">This clan hasn&rsquo;t finished a war yet.</p>';
    return (
      '<ul class="pt-wars">' +
      log
        .map(function (w) {
          var cwl = !w.result; // Clan War League weeks come without a result or an opponent
          var res = cwl ? 'cwl' : w.result;
          var day = /^(\d{4})(\d{2})(\d{2})/.exec(w.endTime || '');
          var date = day ? new Date(Date.UTC(+day[1], +day[2] - 1, +day[3], 12)) : null;
          return (
            '<li class="pt-war is-' +
            res +
            '"><span class="pt-war-res">' +
            { win: 'Win', lose: 'Loss', tie: 'Draw', cwl: 'CWL' }[res] +
            '</span><span class="pt-war-opp">' +
            (cwl
              ? '<span><b>Clan War League</b><span>' + w.teamSize + ' v ' + w.teamSize + '</span></span>'
              : '<img src="' +
                w.opponent.badgeUrls.small +
                '" alt="" width="32" height="32" loading="lazy" /><span><b>' +
                esc(w.opponent.name) +
                '</b><span>' +
                w.teamSize +
                ' v ' +
                w.teamSize +
                '</span></span>') +
            '</span><span class="pt-war-score"><b>' +
            w.clan.stars +
            (cwl ? '' : ' <i>&ndash;</i> ' + w.opponent.stars) +
            '</b><span>' +
            (cwl ? 'stars' : w.clan.destructionPercentage.toFixed(1) + '% &ndash; ' + w.opponent.destructionPercentage.toFixed(1) + '%') +
            '</span></span>' +
            (date
              ? '<time class="pt-war-date" datetime="' +
                date.toISOString().slice(0, 10) +
                '">' +
                date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
                '</time>'
              : '') +
            '</li>'
          );
        })
        .join('') +
      '</ul>'
    );
  }

  function renderClan(c, log, data, root) {
    var tag = c.tag.slice(1);
    var members = (c.memberList || []).slice().sort(function (a, b) {
      return a.clanRank - b.clanRank;
    });
    var labels = (c.labels || [])
      .map(function (l) {
        return '<img src="' + l.iconUrls.small + '" alt="' + esc(l.name) + '" title="' + esc(l.name) + '" width="28" height="28" />';
      })
      .join('');
    // Ties and losses only come with a public war log.
    var full = c.warLosses != null;
    var where = [c.location && esc(c.location.name), c.chatLanguage && esc(c.chatLanguage.name), CLAN_TYPE[c.type]]
      .filter(Boolean)
      .join(' &middot; ');
    var league = c.warLeague && c.warLeague.id !== 48000000 ? c.warLeague : null; // 48000000 = "Unranked"

    root.innerHTML =
      '<header class="pt-head pt-head--clan">' +
      '<div class="pt-th"><img src="' +
      c.badgeUrls.large +
      '" alt="" width="88" height="88" /><span>Level ' +
      c.clanLevel +
      '</span></div>' +
      '<div class="pt-id"><h1 class="pt-name">' +
      esc(c.name) +
      '</h1>' +
      '<p class="pt-tagline"><span>#' +
      tag +
      '</span><button type="button" class="pt-copy" data-copy="#' +
      tag +
      '">Copy tag</button>' +
      (labels ? '<span class="pt-labels">' + labels + '</span>' : '') +
      '</p>' +
      (where ? '<p class="pt-clan">' + where + '</p>' : '') +
      '</div>' +
      (league ? '<div class="pt-league"><span>' + esc(league.name) + '</span><i>War league</i></div>' : '') +
      (c.description ? '<p class="pt-desc">' + esc(c.description) + '</p>' : '') +
      '<div class="pt-head-facts">' +
      facts('Clan', [
        ['Members', c.members + '<i>/50</i>'],
        ['Clan points', num(c.clanPoints)],
        ['Capital Hall', c.clanCapital && c.clanCapital.capitalHallLevel ? c.clanCapital.capitalHallLevel : '&ndash;'],
        ['Capital league', c.capitalLeague ? esc(c.capitalLeague.name) : '&ndash;'],
      ]) +
      facts(
        'War',
        [
          ['Wars won', num(c.warWins)],
          full ? ['Drawn', num(c.warTies)] : null,
          full ? ['Lost', num(c.warLosses)] : null,
          ['Win streak', num(c.warWinStreak)],
          ['Wars', WAR_FREQ[c.warFrequency] || 'Not set'],
        ].filter(Boolean),
      ) +
      facts('To join', [
        ['Town Hall', c.requiredTownhallLevel ? c.requiredTownhallLevel + '<i>+</i>' : 'Any'],
        ['Trophies', num(c.requiredTrophies)],
        ['Builder trophies', num(c.requiredBuilderBaseTrophies)],
      ]) +
      '</div></header>' +
      '<div class="pt-tabs" role="tablist" aria-label="Clan sections">' +
      '<button type="button" role="tab" id="ptTabMembers" aria-controls="ptPanelMembers" aria-selected="true">Members</button>' +
      '<button type="button" role="tab" id="ptTabWars" aria-controls="ptPanelWars" aria-selected="false" tabindex="-1">War log</button>' +
      '</div>' +
      '<div class="pt-panel" id="ptPanelMembers" role="tabpanel" aria-labelledby="ptTabMembers">' +
      (members.length ? membersTable(members, data) : '<p class="pt-empty">This clan has no members.</p>') +
      '</div>' +
      '<div class="pt-panel" id="ptPanelWars" role="tabpanel" aria-labelledby="ptTabWars" hidden>' +
      warLog(log) +
      '</div>' +
      '<p class="pt-source">Live data from the official Clash of Clans API, refreshed every 5 minutes. Donations count this season only. Tap a heading to sort the members.</p>';

    wireTabs(root);
    wireCopy(root);
    if (members.length) wireSort(root, members, data);
  }

  function loadClan(root, tag) {
    root.innerHTML = '<div class="pt-loading" role="status"><span class="parchrome-ring"></span>Loading #' + tag + '&hellip;</div>';
    armyData =
      armyData ||
      fetch('/coc-army-data.json').then(function (r) {
        return r.json();
      });
    // The war log can fail on its own (private, or a hiccup) without taking the page down.
    var log = api('type=warlog&tag=' + tag).then(
      function (b) {
        return b.items || [];
      },
      function (err) {
        return err.message === 'private' ? 'private' : null;
      },
    );
    Promise.all([api('type=clan&tag=' + tag), log, armyData])
      .then(function (r) {
        var c = r[0];
        document.title = c.name + ' (clan) | Player Tracker | Parchrome';
        renderClan(c, r[1], r[2], root);
        saveRecent({ kind: 'clan', tag: tag, name: c.name, icon: c.badgeUrls.small });
      })
      .catch(function (err) {
        armyData = null;
        showState(root, 'clan', err.message, function () {
          loadClan(root, tag);
        });
      });
  }

  function initClan(root) {
    var tag = tagFromAddress('clan');
    if (!tag) return showState(root, 'clan', 'badTag');
    loadClan(root, tag);
  }

  var form = document.getElementById('ptSearch');
  if (form) initSearch(form);
  var root = document.getElementById('ptProfile');
  if (root) initProfile(root);
  var clanRoot = document.getElementById('ptClan');
  if (clanRoot) initClan(clanRoot);
})();
