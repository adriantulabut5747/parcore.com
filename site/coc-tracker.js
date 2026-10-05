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
    // "Search another player / clan" on the profile and clan pages land here
    // with ?mode=player|clan: open in that mode, cursor in the field.
    var want = new URLSearchParams(location.search).get('mode');
    if (want === 'player' || want === 'clan') {
      setMode(want);
      input.focus();
    }

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
    // u.cap = this Town Hall's max (setCaps); else the game's overall max
    var top = u.cap || u.maxLevel;
    var maxed = u.level >= top;
    var label = u.name + ', level ' + u.level + ' of ' + top + (u.cap ? ' for this Town Hall' : '') + (maxed ? ', maxed' : '');
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
      return u.level >= (u.cap || u.maxLevel);
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
            (h.cap || h.maxLevel) +
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

  /* -------------------------------------------------------------- progress */
  // Town Hall progress and the rushed check, from coc-max-levels.json (max
  // level of every unit at each Town Hall, built from the wiki by
  // scripts/build-max-levels.py -- re-run after balance patches).
  // - progress: levels done out of the levels this Town Hall allows, per group
  // - rushed: how far below the PREVIOUS Town Hall's max (the usual rule)
  var maxData = null;
  var PROGRESS_GROUPS = [
    ['heroes', 'Heroes'],
    ['equipment', 'Equipment'],
    ['pets', 'Pets'],
    ['troops', 'Troops'],
    ['spells', 'Spells'],
    ['sieges', 'Sieges'],
  ];

  function homeUnits(p) {
    var list = [];
    p.troops.concat(p.heroes, p.heroEquipment, p.spells).forEach(function (u) {
      if (u.village === 'home') list.push(u);
    });
    p.heroes.forEach(function (h) {
      (h.equipment || []).forEach(function (e) {
        list.push(e); // the equipped copies, so their tiles get the cap too
      });
    });
    return list;
  }

  // Give each home unit its cap for this Town Hall (u.cap); tiles and hero
  // cards then count "maxed" against it instead of the game's overall max.
  function setCaps(p, maxTable) {
    var table = maxTable && maxTable.th[p.townHallLevel];
    if (!table) return;
    var caps = {};
    Object.keys(table).forEach(function (n) {
      caps[key(n)] = table[n];
    });
    homeUnits(p).forEach(function (u) {
      if (caps[key(u.name)]) u.cap = caps[key(u.name)];
    });
  }

  function progress(p, idx, maxTable) {
    var th = p.townHallLevel;
    var now = maxTable && maxTable.th[th];
    if (!now) return null;
    var prev = maxTable.th[th - 1];
    var have = {};
    homeUnits(p).forEach(function (u) {
      have[key(u.name)] = Math.max(have[key(u.name)] || 0, u.level);
    });
    var rows = {};
    var total = { done: 0, need: 0 };
    var miss = 0;
    var prevNeed = 0;
    Object.keys(now).forEach(function (name) {
      var k = key(name);
      var info = idx[k];
      if (!info) return;
      // Equipment: only items the player owns -- many come from past events
      // and can't be had any more, so unowned ones would make 100% impossible.
      var equip = info.group === 'equipment';
      if (equip && !have[k]) return;
      var cap = now[name];
      var lvl = Math.min(have[k] || 0, cap); // not unlocked yet counts as 0
      var r = (rows[info.group] = rows[info.group] || { done: 0, need: 0 });
      r.done += lvl;
      r.need += cap;
      total.done += lvl;
      total.need += cap;
      // Rushed leaves equipment out (ore-limited, not builder/lab-limited).
      if (prev && prev[name] && !equip) {
        prevNeed += prev[name];
        miss += Math.max(0, prev[name] - (have[k] || 0));
      }
    });
    return { th: th, rows: rows, total: total, rushed: prev && prevNeed ? miss / prevNeed : null };
  }

  function progressBox(pr) {
    // floor, so 99.6% never reads as a finished 100%
    function row(label, r, cls) {
      var left = r.need - r.done;
      return (
        '<li' +
        (cls ? ' class="' + cls + '"' : '') +
        '><span class="pt-pg-name">' +
        label +
        '</span><span class="pt-pg-bar" aria-hidden="true"><i style="width:' +
        ((r.done / r.need) * 100).toFixed(1) +
        '%"></i></span><b>' +
        Math.floor((r.done / r.need) * 100) +
        '%</b><span class="pt-pg-left">' +
        (left ? num(left) + ' left' : 'Maxed') +
        '</span></li>'
      );
    }
    var verdict = '';
    if (pr.rushed !== null) {
      var pct = Math.ceil(pr.rushed * 100);
      verdict =
        pr.rushed === 0 ? '<span class="pt-verdict is-ok">Not rushed</span>' : '<span class="pt-verdict">Rushed ' + pct + '%</span>';
    }
    return (
      '<section class="pt-group pt-progress"><div class="pt-group-head"><h3>Town Hall ' +
      pr.th +
      ' progress</h3>' +
      verdict +
      '</div><ul class="pt-pg">' +
      row('Overall', pr.total, 'is-total') +
      PROGRESS_GROUPS.filter(function (g) {
        return pr.rows[g[0]];
      })
        .map(function (g) {
          return row(g[1], pr.rows[g[0]]);
        })
        .join('') +
      '</ul><p class="pt-pg-note">' +
      (pr.rushed !== null ? 'Rushed means heroes, pets, troops, spells or sieges below the Town Hall ' + (pr.th - 1) + ' max. ' : '') +
      'Equipment counts the items this player owns. &ldquo;Left&rdquo; is every level still to upgrade to this Town Hall&rsquo;s max.</p></section>'
    );
  }

  function renderProfile(p, data, maxTable, root) {
    var idx = indexArmy(data);
    setCaps(p, maxTable);
    var pr = progress(p, idx, maxTable);
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
      searchAgain('player') +
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
      (pr ? progressBox(pr) : '') +
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
      '<p class="pt-source">Live data from the official Clash of Clans API, refreshed every 5 minutes, so a battle you just played can take a few minutes to show up. A red level means that unit is maxed for this Town Hall.</p>';

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

  // Above the profile / clan header: back to the search, in the same mode.
  function searchAgain(what) {
    return (
      '<div class="pt-bar"><a class="pt-again" href="/coc/tools/player-tracker?mode=' +
      what +
      '"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" /></svg>Search another ' +
      what +
      '</a></div>'
    );
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
        next.click(); // click, not select(): a tab can load its content on first click (War)
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
    // The max-level table is optional: without it the page still works, just
    // without the progress box (and "maxed" falls back to the game's max).
    maxData =
      maxData ||
      fetch('/coc-max-levels.json')
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .catch(function () {
          return null;
        });
    Promise.all([api('type=player&tag=' + tag), armyData, maxData])
      .then(function (r) {
        var p = r[0];
        document.title = p.name + ' (TH' + p.townHallLevel + ') | Player Tracker | Parchrome';
        renderProfile(p, r[1], r[2], root);
        if (window.setCrumbName) window.setCrumbName(p.name);
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
      'league',
      'League',
      function (m) {
        return m.leagueTier ? m.leagueTier.id : 0;
      },
      function (m) {
        var l = m.leagueTier;
        return l
          ? '<img src="' +
              l.iconUrls.small +
              '" alt="" width="26" height="26" loading="lazy" title="' +
              esc(l.name) +
              '" /><span>' +
              esc(l.name) +
              '</span>'
          : '&ndash;';
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

  /* ------------------------------------------------------------ war report */
  // The clan page's War tab, loaded the first time it's opened:
  // - During Clan War League: the clan's war for each day (Day 1-7 chips),
  //   plus the league's standings worked out from every war in the group.
  // - Otherwise: the clan's current war (needs a public war log).
  // One war view serves both: score, who still has attacks left, and both
  // line-ups with every attack.

  // "20261004T210926.000Z" -> Date
  function apiTime(s) {
    var m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(s || '');
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
  }
  function timeLeft(ms) {
    var min = Math.max(0, Math.round(ms / 60000));
    var h = Math.floor(min / 60);
    return h ? h + 'h ' + (min % 60) + 'm' : min + 'm';
  }

  // Ours first, whichever side the API put us on.
  function sides(w, ourTag) {
    return w.clan.tag === ourTag ? [w.clan, w.opponent] : [w.opponent, w.clan];
  }
  function outcome(us, them) {
    if (us.stars !== them.stars) return us.stars > them.stars ? 'win' : 'lose';
    if (us.destructionPercentage !== them.destructionPercentage)
      return us.destructionPercentage > them.destructionPercentage ? 'win' : 'lose';
    return 'tie';
  }
  function warStatus(w, us, them) {
    if (w.state === 'preparation') return 'Preparation day &middot; battles start in ' + timeLeft(apiTime(w.startTime) - Date.now());
    if (w.state === 'inWar') return 'Battle day &middot; ends in ' + timeLeft(apiTime(w.endTime) - Date.now());
    return { win: 'War won', lose: 'War lost', tie: 'War drawn' }[outcome(us, them)];
  }

  function warSide(side, other, apm, data, state) {
    var live = state === 'inWar';
    // Positions 1..N from mapPosition, for "-> #3" on each attack.
    var byPos = function (list) {
      return list.slice().sort(function (a, b) {
        return a.mapPosition - b.mapPosition;
      });
    };
    var pos = {};
    byPos(other.members).forEach(function (m, i) {
      pos[m.tag] = i + 1;
    });
    return byPos(side.members)
      .map(function (m, i) {
        var atks = (m.attacks || []).slice().sort(function (a, b) {
          return a.order - b.order;
        });
        var leftN = apm - atks.length;
        var icon = thIcon(m.townhallLevel, data);
        var def = m.bestOpponentAttack;
        return (
          '<li class="pt-wm' +
          (live && leftN > 0 ? ' is-pending' : '') +
          '"><span class="pt-wm-pos">' +
          (i + 1) +
          '</span>' +
          (icon ? '<img src="' + icon + '" alt="" width="34" height="34" loading="lazy" />' : '<span></span>') +
          '<span class="pt-wm-name"><a href="' +
          playerHref(m.tag.slice(1)) +
          '">' +
          esc(m.name) +
          '</a><span>TH' +
          m.townhallLevel +
          (def
            ? ' &middot; attacked for ' + def.stars + '&#9733; ' + def.destructionPercentage + '%'
            : m.opponentAttacks || state === 'preparation'
              ? ''
              : ' &middot; not attacked yet') +
          '</span></span><span class="pt-wm-atks">' +
          atks
            .map(function (a) {
              return (
                '<span class="pt-atk">' +
                stars(a.stars) +
                '<b>' +
                a.destructionPercentage +
                '%</b><i>&rarr; #' +
                (pos[a.defenderTag] || '?') +
                '</i></span>'
              );
            })
            .join('') +
          // battle day: attacks still to make; after the war: attacks missed; preparation: nothing yet
          (live && leftN > 0 ? '<span class="pt-atk pt-atk--left">' + leftN + ' attack' + (leftN === 1 ? '' : 's') + ' left</span>' : '') +
          (state === 'warEnded' && leftN > 0 ? '<span class="pt-atk pt-atk--none">Missed ' + leftN + '</span>' : '') +
          '</span></li>'
        );
      })
      .join('');
  }

  // One war: score card, missing attacks, both line-ups (switchable).
  // One side's attacks: how the stars split, and the average stars,
  // destruction and duration (the API gives seconds) per attack.
  function attackStats(side) {
    var by = [0, 0, 0, 0];
    var n = 0;
    var dest = 0;
    var dur = 0;
    var durN = 0;
    side.members.forEach(function (m) {
      (m.attacks || []).forEach(function (a) {
        n++;
        by[a.stars]++;
        dest += a.destructionPercentage;
        if (a.duration) {
          dur += a.duration;
          durN++;
        }
      });
    });
    return { n: n, by: by, dest: n ? dest / n : 0, stars: n ? (by[1] + 2 * by[2] + 3 * by[3]) / n : 0, dur: durN ? dur / durN : null };
  }

  function warStats(us, them, total) {
    var a = attackStats(us);
    var b = attackStats(them);
    function pct(x, i) {
      return x.n ? Math.round((x.by[i] / x.n) * 100) + '%<i>' + x.by[i] + '</i>' : '&ndash;';
    }
    function mmss(x) {
      if (x.dur == null) return '&ndash;';
      var sec = Math.round(x.dur);
      return Math.floor(sec / 60) + 'm ' + String(sec % 60).padStart(2, '0') + 's';
    }
    var rows = [
      ['Attacks used', a.n + ' / ' + total, b.n + ' / ' + total],
      ['Avg. stars per attack', a.n ? a.stars.toFixed(2) : '&ndash;', b.n ? b.stars.toFixed(2) : '&ndash;'],
      ['3-star attacks', pct(a, 3), pct(b, 3)],
      ['2-star attacks', pct(a, 2), pct(b, 2)],
      ['1-star attacks', pct(a, 1), pct(b, 1)],
      ['0-star attacks', pct(a, 0), pct(b, 0)],
      ['Avg. destruction', a.n ? a.dest.toFixed(1) + '%' : '&ndash;', b.n ? b.dest.toFixed(1) + '%' : '&ndash;'],
      ['Avg. attack time', mmss(a), mmss(b)],
    ];
    return (
      '<section class="pt-group pt-wstats"><div class="pt-group-head"><h3>War stats</h3></div><table class="pt-wst"><thead><tr><th scope="col">' +
      esc(us.name) +
      '</th><th scope="col"><span class="pt-sr">Stat</span></th><th scope="col">' +
      esc(them.name) +
      '</th></tr></thead><tbody>' +
      rows
        .map(function (r) {
          return '<tr><td>' + r[1] + '</td><th scope="row">' + r[0] + '</th><td>' + r[2] + '</td></tr>';
        })
        .join('') +
      '</tbody></table></section>'
    );
  }

  function warView(w, ourTag, data) {
    var s = sides(w, ourTag);
    var us = s[0];
    var them = s[1];
    var apm = w.attacksPerMember || 1; // CWL wars leave it out: one attack each
    var live = w.state === 'inWar' || w.state === 'warEnded';
    var total = w.teamSize * apm;
    var missing = live
      ? us.members.filter(function (m) {
          return (m.attacks || []).length < apm;
        })
      : [];
    var team = function (c) {
      return (
        '<div class="pt-score-team"><img src="' +
        c.badgeUrls.small +
        '" alt="" width="48" height="48" /><b>' +
        esc(c.name) +
        '</b><span>' +
        (live ? (c.attacks || 0) + ' / ' + total + ' attacks' : 'Level ' + c.clanLevel) +
        '</span></div>'
      );
    };
    return (
      '<section class="pt-score is-' +
      (w.state === 'warEnded' ? outcome(us, them) : w.state) +
      '"><p class="pt-score-state">' +
      warStatus(w, us, them) +
      '</p><div class="pt-score-row">' +
      team(us) +
      '<div class="pt-score-mid"><b>' +
      (live ? us.stars + '<i>&ndash;</i>' + them.stars : w.teamSize + '<i>v</i>' + w.teamSize) +
      '</b>' +
      (live
        ? '<span>' + us.destructionPercentage.toFixed(1) + '% &ndash; ' + them.destructionPercentage.toFixed(1) + '%</span>'
        : '<span>teams</span>') +
      '</div>' +
      team(them) +
      '</div></section>' +
      (missing.length
        ? '<section class="pt-missing"><h3>' +
          (w.state === 'warEnded' ? 'Missed attacks' : 'Still to attack') +
          ' <i>' +
          missing.length +
          '</i></h3><p>' +
          missing
            .map(function (m) {
              return esc(m.name);
            })
            .join(', ') +
          '</p></section>'
        : '') +
      (live ? warStats(us, them, total) : '') +
      '<div class="pt-war-sides" role="tablist" aria-label="Line-up">' +
      '<button type="button" role="tab" aria-selected="true" data-side="us">' +
      esc(us.name) +
      '</button><button type="button" role="tab" aria-selected="false" tabindex="-1" data-side="them">' +
      esc(them.name) +
      '</button></div>' +
      '<ol class="pt-wms" data-side="us">' +
      warSide(us, them, apm, data, w.state) +
      '</ol><ol class="pt-wms" data-side="them" hidden>' +
      warSide(them, us, apm, data, w.state) +
      '</ol>'
    );
  }

  function wireWarSides(box) {
    var btns = [].slice.call(box.querySelectorAll('.pt-war-sides button'));
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) {
          var on = x === b;
          x.setAttribute('aria-selected', on);
          x.tabIndex = on ? 0 : -1;
          box.querySelector('.pt-wms[data-side="' + x.dataset.side + '"]').hidden = !on;
        });
      });
    });
  }

  // At most `n` requests at once: the CWL group can mean 28 war lookups,
  // and a burst can hit the Clash API's rate limit. A failed lookup is
  // tried twice more after a short pause; one that still fails is null.
  function retry(fn, item, left) {
    return fn(item).catch(function (err) {
      if (!left || err.message === 'notFound' || err.message === 'private') throw err;
      return new Promise(function (ok) {
        setTimeout(ok, 700);
      }).then(function () {
        return retry(fn, item, left - 1);
      });
    });
  }
  function pool(items, n, fn) {
    var out = new Array(items.length);
    var next = 0;
    function worker() {
      if (next >= items.length) return Promise.resolve();
      var i = next++;
      return retry(fn, items[i], 2)
        .then(
          function (r) {
            out[i] = r;
          },
          function () {
            out[i] = null;
          },
        )
        .then(worker);
    }
    var workers = [];
    for (var k = 0; k < Math.min(n, items.length); k++) workers.push(worker());
    return Promise.all(workers).then(function () {
      return out;
    });
  }

  // CWL standings from every war so far: stars (+10 for each war won once it
  // has ended), then total destruction -- the game's own ranking rule.
  function standings(group, wars, rounds, byTag) {
    var t = {};
    group.clans.forEach(function (c) {
      // days: each clan's result per war day -- win / lose / tie / live / prep / null
      var days = rounds.map(function (list) {
        for (var i = 0; i < list.length; i++) {
          var w = byTag[list[i]];
          if (!w || (w.clan.tag !== c.tag && w.opponent.tag !== c.tag)) continue;
          if (w.state === 'warEnded') return outcome.apply(null, sides(w, c.tag));
          return w.state === 'inWar' ? 'live' : 'prep';
        }
        return null;
      });
      t[c.tag] = { clan: c, stars: 0, dest: 0, wins: 0, days: days };
    });
    wars.forEach(function (w) {
      if (!w || (w.state !== 'inWar' && w.state !== 'warEnded')) return;
      [
        [w.clan, w.opponent],
        [w.opponent, w.clan],
      ].forEach(function (p) {
        var row = t[p[0].tag];
        if (!row) return;
        row.stars += p[0].stars;
        row.dest += p[0].destructionPercentage * w.teamSize;
        if (w.state === 'warEnded' && outcome(p[0], p[1]) === 'win') {
          row.stars += 10;
          row.wins++;
        }
      });
    });
    return Object.keys(t)
      .map(function (k) {
        return t[k];
      })
      .sort(function (a, b) {
        return b.stars - a.stars || b.dest - a.dest;
      });
  }

  // How many clans go up / down in each war league, from the wiki's CWL
  // medal table. Groups under 8 clans demote fewer, so no demotion line there.
  function cwlZones(league, n) {
    var m = /^(\w+) League(?: (I{1,3}))?$/.exec(league || '');
    if (!m) return null;
    var tier = m[1];
    var div = (m[2] || '').length; // III = 3 ... I = 1
    var up = 2;
    var down = 2;
    if (tier === 'Bronze') {
      up = 3;
      down = div === 3 ? 0 : 1;
    } else if (tier === 'Silver' && div === 3) down = 1;
    else if ((tier === 'Master' && div === 1) || tier === 'Champion' || tier === 'Titan') up = 1;
    else if (tier === 'Legend') up = 0;
    return { up: up, down: n >= 8 ? down : 0 };
  }

  var DAY_TEXT = { win: 'won', lose: 'lost', tie: 'drawn', live: 'in progress', prep: 'preparation' };

  function standingsTable(rows, ourTag, league) {
    var z = cwlZones(league, rows.length);
    var zone = function (kind) {
      return (
        '<li class="pt-zone is-' +
        kind +
        '" role="presentation"><span>' +
        (kind === 'up' ? 'Promotion zone' : 'Demotion zone') +
        '</span></li>'
      );
    };
    return (
      '<section class="pt-group pt-standings"><div class="pt-group-head"><h3>League standings</h3><span>' +
      (league ? esc(league) + ' &middot; ' : '') +
      'stars include +10 per war won</span></div><ol>' +
      rows
        .map(function (r, i) {
          var html =
            '<li' +
            (r.clan.tag === ourTag ? ' class="is-us"' : '') +
            '><span class="pt-st-rank">' +
            (i + 1) +
            '</span><img src="' +
            r.clan.badgeUrls.small +
            '" alt="" width="36" height="36" loading="lazy" /><span class="pt-st-name"><a href="' +
            clanHref(r.clan.tag.slice(1)) +
            '">' +
            esc(r.clan.name) +
            '</a><span class="pt-st-days" role="img" aria-label="' +
            r.days
              .map(function (d, k) {
                return 'Day ' + (k + 1) + ' ' + (DAY_TEXT[d] || 'not played');
              })
              .join(', ') +
            '">' +
            r.days
              .map(function (d) {
                return '<i class="is-' + (d || 'none') + '"></i>';
              })
              .join('') +
            '</span></span><span class="pt-st-pill pt-st-stars">' +
            r.stars +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg><span class="pt-sr"> stars</span></span><span class="pt-st-pill">' +
            Math.round(r.dest).toLocaleString('en-US') +
            '%</span></li>';
          if (z && z.up && i === z.up - 1) html += zone('up');
          if (z && z.down && i === rows.length - z.down - 1) html += zone('down');
          return html;
        })
        .join('') +
      '</ol></section>'
    );
  }

  function loadCwl(box, ourTag, group, data, league) {
    var rounds = group.rounds.map(function (r) {
      return r.warTags.filter(function (t) {
        return t !== '#0';
      });
    });
    var tags = [].concat.apply([], rounds);
    box.innerHTML = '<div class="pt-loading" role="status"><span class="parchrome-ring"></span>Loading Clan War League&hellip;</div>';
    pool(tags, 3, function (t) {
      return api('type=cwlwar&tag=' + t.slice(1));
    }).then(function (wars) {
      var failed = wars.filter(function (w) {
        return !w;
      }).length;
      var byTag = {};
      tags.forEach(function (t, i) {
        byTag[t] = wars[i];
      });
      // our war for each day (null when the day hasn't been drawn yet)
      var ours = rounds.map(function (list) {
        for (var i = 0; i < list.length; i++) {
          var w = byTag[list[i]];
          if (w && (w.clan.tag === ourTag || w.opponent.tag === ourTag)) return w;
        }
        return null;
      });
      // Open on the day being fought; else the latest finished one; else the first drawn.
      var pick = -1;
      ours.forEach(function (w, i) {
        if (w && w.state === 'inWar') pick = i;
      });
      if (pick === -1)
        ours.forEach(function (w, i) {
          if (w && w.state === 'warEnded') pick = i;
        });
      if (pick === -1)
        ours.forEach(function (w, i) {
          if (w && pick === -1) pick = i;
        });
      var days =
        '<div class="pt-days" role="tablist" aria-label="War day">' +
        ours
          .map(function (w, i) {
            return (
              '<button type="button" role="tab" data-day="' +
              i +
              '" aria-selected="' +
              (i === pick) +
              '"' +
              (i === pick ? '' : ' tabindex="-1"') +
              (w ? '' : ' disabled') +
              '>Day ' +
              (i + 1) +
              (w && w.state === 'warEnded' ? '<i class="is-' + outcome.apply(null, sides(w, ourTag)) + '"></i>' : '') +
              (w && w.state === 'inWar' ? '<i class="is-live"></i>' : '') +
              '</button>'
            );
          })
          .join('') +
        '</div>';
      box.innerHTML =
        '<p class="pt-war-kind">Clan War League &middot; ' +
        esc(group.season) +
        '</p>' +
        days +
        '<div class="pt-war-day"></div>' +
        standingsTable(standings(group, wars, rounds, byTag), ourTag, league) +
        (failed
          ? '<p class="pt-empty">' +
            failed +
            ' of ' +
            tags.length +
            ' wars couldn&rsquo;t be loaded, so the standings may be missing some stars. Reload the page to try again.</p>'
          : '');
      var dayBox = box.querySelector('.pt-war-day');
      function show(i) {
        dayBox.innerHTML = ours[i] ? warView(ours[i], ourTag, data) : '';
        wireWarSides(dayBox);
        box.querySelectorAll('.pt-days button').forEach(function (b) {
          var on = +b.dataset.day === i;
          b.setAttribute('aria-selected', on);
          b.tabIndex = on ? 0 : -1;
        });
      }
      box.querySelector('.pt-days').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-day]');
        if (b && !b.disabled) show(+b.dataset.day);
      });
      if (pick !== -1) show(pick);
    });
  }

  function loadWarTab(box, ourTag, data, league) {
    box.innerHTML = '<div class="pt-loading" role="status"><span class="parchrome-ring"></span>Loading the war&hellip;</div>';
    var t = ourTag.slice(1);
    // CWL first: a clan in CWL shows "not in war" in its regular war.
    api('type=cwlgroup&tag=' + t)
      .then(
        function (g) {
          return g;
        },
        function () {
          return null;
        },
      )
      .then(function (group) {
        if (group && group.state !== 'notInWar' && group.rounds) return loadCwl(box, ourTag, group, data, league);
        return api('type=war&tag=' + t).then(
          function (w) {
            if (w.state === 'notInWar') {
              box.innerHTML = '<p class="pt-empty">This clan isn&rsquo;t in a war right now. Its last wars are in the War log tab.</p>';
              return;
            }
            box.innerHTML = '<p class="pt-war-kind">Current war</p>' + warView(w, ourTag, data);
            wireWarSides(box);
          },
          function (err) {
            box.innerHTML =
              err.message === 'private'
                ? '<p class="pt-empty">This clan keeps its war log private, so its current war can&rsquo;t be shown. Clan War League wars are always public and show here while CWL is on.</p>'
                : '<p class="pt-empty">' + message('clan', err.message) + '</p>';
          },
        );
      });
  }

  /* --------------------------------------------------------------- history */
  // Tracked clans' history, written every 15 minutes by scripts/track.mjs
  // (GitHub Actions) into Firestore project parchrome-tracker. Read here
  // straight from Firestore's REST API -- public, read-only data, no SDK.
  // Visitors can write exactly two things (see the rules in the Firebase
  // console): start tracking a clan, and refresh when it was last viewed.
  var FS = 'https://firestore.googleapis.com/v1/projects/parchrome-tracker/databases/(default)/documents';
  var FS_NAME = 'projects/parchrome-tracker/databases/(default)/documents';

  // Firestore REST values -> plain JS
  function fsVal(v) {
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return +v.integerValue;
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('timestampValue' in v) return new Date(v.timestampValue);
    if ('mapValue' in v) return fsFields(v.mapValue.fields);
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsVal);
    return null;
  }
  function fsFields(f) {
    var o = {};
    Object.keys(f || {}).forEach(function (k) {
      o[k] = fsVal(f[k]);
    });
    return o;
  }
  // A document, or null when it doesn't exist.
  function fsGet(path) {
    return fetch(FS + '/' + path).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('other');
      return r.json().then(function (d) {
        return fsFields(d.fields);
      });
    });
  }
  // Newest first: the `limit` latest docs of parent/collection, by `field`.
  function fsLatest(parent, collection, field, limit) {
    return fetch(FS + '/' + parent + ':runQuery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collection }],
          orderBy: [{ field: { fieldPath: field }, direction: 'DESCENDING' }],
          limit: limit,
        },
      }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('other');
        return r.json();
      })
      .then(function (rows) {
        return rows
          .filter(function (r) {
            return r.document;
          })
          .map(function (r) {
            var d = fsFields(r.document.fields);
            d.id = r.document.name.split('/').pop();
            return d;
          });
      });
  }
  // Set addedAt / lastViewed to the server's clock (the rules demand it).
  // create: the doc must not exist yet; otherwise only lastViewed is touched.
  function fsTrack(tag, create) {
    var fields = create ? ['addedAt', 'lastViewed'] : ['lastViewed'];
    var write = {
      update: { name: FS_NAME + '/trackedClans/' + tag, fields: {} },
      updateTransforms: fields.map(function (f) {
        return { fieldPath: f, setToServerValue: 'REQUEST_TIME' };
      }),
      currentDocument: { exists: !create },
    };
    if (!create) write.updateMask = { fieldPaths: [] };
    return fetch(FS + ':commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes: [write] }),
    }).then(function (r) {
      if (!r.ok) throw new Error('other');
    });
  }

  function shortDate(d) {
    return d
      ? d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
        })
      : '';
  }
  function whenText(d) {
    var min = Math.round((Date.now() - d) / 60000);
    if (min < 60) return min <= 1 ? 'just now' : min + ' min ago';
    if (min < 1440) return Math.round(min / 60) + 'h ago';
    return shortDate(d) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  // The header's track control: a button, or nothing once tracked. Opening a
  // tracked clan's page keeps it tracked (lastViewed, once a day per device).
  function initTrack(box, tag, onTracked) {
    fsGet('trackedClans/' + tag)
      .then(function (doc) {
        if (doc) {
          box.innerHTML = ''; // tracked: nothing to show (his call: no "tracked since" badge)
          var seenKey = 'pt-seen-' + tag;
          var today = new Date().toISOString().slice(0, 10);
          var seen;
          try {
            seen = localStorage.getItem(seenKey);
          } catch (e) {}
          if (seen !== today)
            fsTrack(tag, false).then(function () {
              try {
                localStorage.setItem(seenKey, today);
              } catch (e) {}
            });
          return;
        }
        box.innerHTML =
          '<button type="button" class="th-soon-btn th-soon-btn--primary pt-track-btn">Track this clan</button>' +
          '<span class="pt-track-note">Records member changes and every war from now on.</span>';
        box.querySelector('button').addEventListener('click', function (e) {
          var btn = e.currentTarget;
          btn.disabled = true;
          btn.textContent = 'Starting…';
          fsTrack(tag, true).then(
            function () {
              box.innerHTML =
                '<span class="pt-track-note">Tracking started. History fills in from the next check, within 15 minutes.</span>';
              onTracked();
            },
            function () {
              btn.disabled = false;
              btn.textContent = 'Track this clan';
              box.querySelector('.pt-track-note').textContent = 'That didn’t work. Check your connection and try again.';
            },
          );
        });
      })
      .catch(function () {
        box.innerHTML = '';
      });
  }

  var EVENT_TEXT = {
    join: function (e) {
      return 'joined the clan' + (e.th ? ' <i>TH' + e.th + '</i>' : '');
    },
    leave: function () {
      return 'left the clan';
    },
    role: function (e) {
      var up = ROLE_RANK[e.to] > ROLE_RANK[e.from];
      return (up ? 'was promoted to ' : 'was demoted to ') + roleName(e.to);
    },
    name: function (e) {
      return 'changed name from <i>' + esc(e.from) + '</i>';
    },
    th: function (e) {
      return 'upgraded to Town Hall ' + e.to;
    },
  };
  var ROLE_RANK = { member: 0, admin: 1, coLeader: 2, leader: 3 };

  function loadHistory(box, c, data) {
    var tag = c.tag.slice(1);
    box.innerHTML = '<div class="pt-loading" role="status"><span class="parchrome-ring"></span>Loading history&hellip;</div>';
    fsGet('trackedClans/' + tag)
      .then(function (tracked) {
        if (!tracked) {
          box.innerHTML =
            '<section class="pt-group pt-hist-off"><div class="pt-group-head"><h3>No history yet</h3></div>' +
            '<p class="pt-empty">History starts once a clan is tracked: every 15 minutes Parchrome records who joins or leaves, promotions and name changes, and every war attack, so they stay here after the war ends. Use <b>Track this clan</b> at the top of the page.</p></section>';
          return;
        }
        return Promise.all([fsLatest('clans/' + tag, 'events', 't', 60), fsLatest('clans/' + tag, 'wars', 'end', 40)]).then(function (r) {
          var events = r[0];
          var wars = r[1].map(function (d) {
            try {
              d.war = JSON.parse(d.json);
            } catch (e) {
              d.war = null;
            }
            return d;
          });
          var since = 'Updated every 15 minutes.';
          box.innerHTML =
            '<p class="pt-war-kind">' +
            since +
            '</p>' +
            '<section class="pt-group"><div class="pt-group-head"><h3>Member changes</h3><span>' +
            events.length +
            (events.length === 60 ? '+' : '') +
            '</span></div>' +
            (events.length
              ? '<ul class="pt-events">' +
                events
                  .map(function (e) {
                    return (
                      '<li class="is-' +
                      e.type +
                      '"><span class="pt-ev-dot" aria-hidden="true"></span><span class="pt-ev-text"><a href="' +
                      playerHref(String(e.tag).slice(1)) +
                      '">' +
                      esc(e.name) +
                      '</a> ' +
                      (EVENT_TEXT[e.type] ? EVENT_TEXT[e.type](e) : '') +
                      '</span><time datetime="' +
                      e.t.toISOString() +
                      '">' +
                      whenText(e.t) +
                      '</time></li>'
                    );
                  })
                  .join('') +
                '</ul>'
              : '<p class="pt-empty">No changes yet. Joins, leaves, promotions and name changes show up here as they happen.</p>') +
            '</section>' +
            '<section class="pt-group"><div class="pt-group-head"><h3>Recorded wars</h3><span>' +
            wars.length +
            '</span></div>' +
            (wars.length
              ? '<ul class="pt-wars pt-wars--rec">' +
                wars
                  .map(function (d, i) {
                    var w = d.war;
                    if (!w) return '';
                    var s = sides(w, c.tag);
                    var res = w.state === 'warEnded' ? outcome(s[0], s[1]) : w.state === 'inWar' ? 'live' : 'prep';
                    return (
                      '<li><button type="button" class="pt-war is-' +
                      (res === 'lose' ? 'lose' : res === 'tie' ? 'tie' : res === 'win' ? 'win' : 'cwl') +
                      '" data-war="' +
                      i +
                      '" aria-expanded="false"><span class="pt-war-res">' +
                      { win: 'Win', lose: 'Loss', tie: 'Draw', live: 'Live', prep: 'Prep' }[res] +
                      '</span><span class="pt-war-opp"><img src="' +
                      s[1].badgeUrls.small +
                      '" alt="" width="32" height="32" loading="lazy" /><span><b>' +
                      esc(s[1].name) +
                      '</b><span>' +
                      (d.kind === 'cwl' ? 'CWL &middot; ' : '') +
                      w.teamSize +
                      ' v ' +
                      w.teamSize +
                      '</span></span></span><span class="pt-war-score"><b>' +
                      s[0].stars +
                      ' <i>&ndash;</i> ' +
                      s[1].stars +
                      '</b><span>' +
                      s[0].destructionPercentage.toFixed(1) +
                      '% &ndash; ' +
                      s[1].destructionPercentage.toFixed(1) +
                      '%</span></span><span class="pt-war-date">' +
                      shortDate(d.end) +
                      '</span></button><div class="pt-war-open" hidden></div></li>'
                    );
                  })
                  .join('') +
                '</ul>'
              : '<p class="pt-empty">No wars recorded yet. The next war or CWL day this clan fights is saved here with every attack.</p>') +
            '</section>';
          // tap a war to see every attack in it
          box.querySelectorAll('button[data-war]').forEach(function (b) {
            b.addEventListener('click', function () {
              var open = b.nextElementSibling;
              var show = open.hidden;
              if (show && !open.firstChild) {
                open.innerHTML = warView(wars[+b.dataset.war].war, c.tag, data);
                wireWarSides(open);
              }
              open.hidden = !show;
              b.setAttribute('aria-expanded', show);
            });
          });
        });
      })
      .catch(function () {
        box.innerHTML = '<p class="pt-empty">The history couldn&rsquo;t be loaded. Reload the page to try again.</p>';
      });
  }

  // The war the clan is fighting now, for the banner under the clan header:
  // during CWL the latest drawn day (battle day first, else preparation),
  // otherwise the regular war (public war logs only). Resolves null if none.
  function liveWar(c) {
    var t = c.tag.slice(1);
    var regular = function () {
      if (!c.isWarLogPublic) return null;
      return api('type=war&tag=' + t).then(
        function (w) {
          return w.state && w.state !== 'notInWar' ? { w: w, label: 'Clan war' } : null;
        },
        function () {
          return null;
        },
      );
    };
    return api('type=cwlgroup&tag=' + t).then(
      function (g) {
        if (!g || g.state === 'notInWar' || !g.rounds) return regular();
        var drawn = [];
        g.rounds.forEach(function (r, i) {
          var list = r.warTags.filter(function (x) {
            return x !== '#0';
          });
          if (list.length) drawn.push({ day: i + 1, tags: list });
        });
        // newest two days: the newest is often preparation, the one before it the battle
        var check = drawn.slice(-2).reverse();
        var found = [];
        return pool(check, 1, function (d) {
          return pool(d.tags, 4, function (x) {
            return api('type=cwlwar&tag=' + x.slice(1));
          }).then(function (wars) {
            wars.forEach(function (w) {
              if (w && (w.clan.tag === c.tag || w.opponent.tag === c.tag)) found.push({ w: w, label: 'CWL day ' + d.day });
            });
          });
        }).then(function () {
          var live = found.filter(function (f) {
            return f.w.state === 'inWar';
          })[0];
          return (
            live ||
            found.filter(function (f) {
              return f.w.state === 'preparation';
            })[0] ||
            null
          );
        });
      },
      function () {
        return regular();
      },
    );
  }

  function liveBanner(box, c, onView) {
    liveWar(c).then(function (f) {
      if (!f) return;
      var w = f.w;
      var s = sides(w, c.tag);
      var prep = w.state === 'preparation';
      box.innerHTML =
        '<section class="pt-live' +
        (prep ? ' is-prep' : '') +
        '"><span class="pt-live-dot" aria-hidden="true"></span><span class="pt-live-main"><b>' +
        f.label +
        ' &middot; ' +
        (prep ? 'preparation' : w.state === 'inWar' ? 'battle day' : 'ended') +
        '</b><span>vs ' +
        esc(s[1].name) +
        ' &middot; ' +
        (prep
          ? 'battles start in ' + timeLeft(apiTime(w.startTime) - Date.now())
          : w.state === 'inWar'
            ? 'ends in ' + timeLeft(apiTime(w.endTime) - Date.now())
            : '') +
        '</span></span><span class="pt-live-score"><b>' +
        (prep ? w.teamSize + ' v ' + w.teamSize : s[0].stars + ' &ndash; ' + s[1].stars) +
        '</b>' +
        (prep ? '' : '<span>' + s[0].destructionPercentage.toFixed(1) + '% &ndash; ' + s[1].destructionPercentage.toFixed(1) + '%</span>') +
        '</span><button type="button" class="th-soon-btn th-soon-btn--primary">View war</button></section>';
      box.querySelector('button').addEventListener('click', onView);
    });
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
      searchAgain('clan') +
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
      '<div class="pt-track" id="ptTrack"></div>' +
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
      '<div id="ptLive"></div>' +
      '<div class="pt-tabs" role="tablist" aria-label="Clan sections">' +
      '<button type="button" role="tab" id="ptTabMembers" aria-controls="ptPanelMembers" aria-selected="true">Members</button>' +
      '<button type="button" role="tab" id="ptTabWar" aria-controls="ptPanelWar" aria-selected="false" tabindex="-1">War</button>' +
      '<button type="button" role="tab" id="ptTabHist" aria-controls="ptPanelHist" aria-selected="false" tabindex="-1">History</button>' +
      '<button type="button" role="tab" id="ptTabWars" aria-controls="ptPanelWars" aria-selected="false" tabindex="-1">War log</button>' +
      '</div>' +
      '<div class="pt-panel" id="ptPanelMembers" role="tabpanel" aria-labelledby="ptTabMembers">' +
      (members.length ? membersTable(members, data) : '<p class="pt-empty">This clan has no members.</p>') +
      '</div>' +
      '<div class="pt-panel" id="ptPanelWar" role="tabpanel" aria-labelledby="ptTabWar" hidden></div>' +
      '<div class="pt-panel" id="ptPanelHist" role="tabpanel" aria-labelledby="ptTabHist" hidden></div>' +
      '<div class="pt-panel" id="ptPanelWars" role="tabpanel" aria-labelledby="ptTabWars" hidden>' +
      warLog(log) +
      '</div>' +
      '<p class="pt-source">Live data from the official Clash of Clans API, refreshed every 5 minutes. Donations count this season only. Tap a heading to sort the members.</p>';

    wireTabs(root);
    wireCopy(root);
    if (members.length) wireSort(root, members, data);
    // The war report loads the first time its tab is opened (CWL can mean 28 lookups).
    var warTab = root.querySelector('#ptTabWar');
    function openWar() {
      warTab.removeEventListener('click', openWar);
      loadWarTab(root.querySelector('#ptPanelWar'), c.tag, data, c.warLeague && c.warLeague.id !== 48000000 ? c.warLeague.name : '');
    }
    warTab.addEventListener('click', openWar);
    if (location.hash === '#war') warTab.click();
    // History, like War, loads on first open; tracking from the header
    // reloads it if it's already showing.
    var histTab = root.querySelector('#ptTabHist');
    var histBox = root.querySelector('#ptPanelHist');
    var histLoaded = false;
    histTab.addEventListener('click', function () {
      if (histLoaded) return;
      histLoaded = true;
      loadHistory(histBox, c, data);
    });
    if (location.hash === '#history') histTab.click();
    liveBanner(root.querySelector('#ptLive'), c, function () {
      warTab.click();
      root.querySelector('.pt-tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    initTrack(root.querySelector('#ptTrack'), c.tag.slice(1), function () {
      if (histLoaded) loadHistory(histBox, c, data);
    });
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
        if (window.setCrumbName) window.setCrumbName(c.name);
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
