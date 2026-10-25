/* Player Tracker (Oct 2026): the search on /coc/tools/player-tracker, the
   player profile at /coc/player/<TAG> and the clan page at /coc/clan/<TAG>. Data comes from the Cloudflare
   Worker cloudflare/coc-api/worker.js (it holds the API key; every host calls it
   directly); icons and unit groups come from coc-army-data.json, the army maker's data.

   GitHub Pages can't do the /coc/player/<TAG> rewrite, so there profiles use
   /coc/player/?tag=<TAG> (clans: /coc/clan/?tag=<TAG>). Plan: docs/player-tracker-plan.md. */
(function () {
  'use strict';

  var ON_PAGES = location.hostname.endsWith('github.io');
  var API = 'https://parchrome-coc.adriantulabut5747.workers.dev/api/coc'; // Cloudflare Worker: cloudflare/coc-api/worker.js
  var RECENT_KEY = 'pt-recent';

  // Same rules as cleanTag in cloudflare/coc-api/worker.js: "#abc o" -> "ABC0"; null if it
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
  // 'private' | 'down' | 'server' | 'slow' | 'offline'), so the visitor is told
  // WHICH link broke (MESSAGES): down = the Worker answered but Supercell's API
  // (or RoyaleAPI's proxy in front of it) didn't; server = our Worker; slow /
  // offline = the visitor's own connection.
  function api(query) {
    return fetch(API + '?' + query, { signal: AbortSignal.timeout(20000) }).then(function (res) {
      // A Worker error is always JSON with an "error"; anything else (an HTML
      // error page) means the Worker itself broke.
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error(['notFound', 'maintenance', 'private'].indexOf(body.error) !== -1 ? body.error : body.error ? 'down' : 'server');
        return body;
      });
    }, diagnose);
  }
  // The call itself never came back: work out whose end it is. The Worker turns
  // an unknown type down at once without asking Supercell, so it answering =
  // our server is up; our own site answering = the visitor's internet is up.
  function diagnose(err) {
    if (navigator.onLine === false) return Promise.reject(new Error('offline'));
    var timedOut = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
    var t0 = Date.now();
    function kind(k) { throw new Error(k); }
    return fetch(API + '?type=ping', { cache: 'no-store', signal: AbortSignal.timeout(8000) }).then(
      // Our server answered: a quick answer = the hang was Supercell's side.
      function () { kind(!timedOut ? 'server' : Date.now() - t0 > 3000 ? 'slow' : 'down'); },
      function (e) {
        if (e && e.name === 'TimeoutError') kind('slow');
        return fetch('/sidebar.json?ping=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(8000) }).then(
          function () { kind('server'); },
          function () { kind('offline'); },
        );
      },
    );
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

  // Shown under the search, headed "Featured", until this device has opened
  // a player or clan (then it's the real "Recently viewed" list). Badge
  // links come from the API; if a clan changes its badge, update them here.
  var FEATURED = [
    {
      kind: 'clan',
      tag: '2GYPGPJP9',
      name: 'ASCENDERE',
      icon: 'https://api-assets.clashofclans.com/badges/70/hoeu9IEsBCOUOoPkJ6jquo0mG3J8ls4l7zA1wt0AjEA.png',
    },
    { kind: 'player', tag: 'LL9PUCG8V', name: 'Wild_Parkour', icon: '/icons/th18icon.png' },
    {
      kind: 'clan',
      tag: 'YJ9Q9YY0',
      name: 'LIBRA',
      icon: 'https://api-assets.clashofclans.com/badges/70/Im4DlsayRpIdshkgZm9GCV7o2-SRyywwyYPwZxy-a8c.png',
    },
  ];

  // Result rows, shared by the search page and the slim bar's dropdown.
  function recentRow(r) {
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
  }
  function clanResult(c) {
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
  }
  function playerResult(p) {
    var th = p.townHallLevel;
    var icon = thIcon(th);
    var league = p.leagueTier || p.league;
    return (
      '<li><a class="pt-result" href="' +
      playerHref(p.tag.slice(1)) +
      '">' +
      (icon ? '<img src="' + icon + '" alt="" width="40" height="40" />' : '<span class="pt-recent-th">TH' + th + '</span>') +
      '<span class="pt-result-main"><b>' +
      esc(p.name) +
      '</b><span>#' +
      p.tag.slice(1) +
      (p.clan ? ' &middot; ' + esc(p.clan.name) : ' &middot; Not in a clan') +
      '</span></span><span class="pt-result-meta"><b>' +
      num(p.trophies) +
      '</b><span>' +
      (league ? esc(league.name) : 'Trophies') +
      '</span></span></a></li>'
    );
  }

  // Town Hall art: coc-army-data.json has TH8-18; TH4-7 follow the same file
  // name; TH1-3 have no icon here.
  function thIcon(th, data) {
    var t = data && data.townHalls && data.townHalls[th];
    if (t && t.icon) return t.icon;
    return th >= 4 ? '/icons/th' + th + 'icon.' + (th === 18 ? 'png' : 'webp') : '';
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
    maintenance: 'Clash of Clans is on a maintenance break, so its data is unavailable. Try again when the game is back.',
    down: 'Supercell&rsquo;s Clash of Clans API isn&rsquo;t answering right now, so no game data can be loaded. Your connection is fine. Try again in a few minutes.',
    server: 'Parchrome&rsquo;s tracker server can&rsquo;t be reached right now. Your connection is fine. Try again in a few minutes.',
    slow: 'Your connection is too slow to load this right now. Try again on a stronger signal.',
    offline: 'You&rsquo;re offline. Check your internet connection and try again.',
    other: 'This couldn&rsquo;t be loaded. Check your connection and try again.',
  };
  // The error panel's title per kind ("Couldn't load" for the rest).
  var TITLES = {
    maintenance: 'Maintenance <em>break</em>',
    down: 'Clash data <em>is down</em>',
    server: 'Tracker <em>unreachable</em>',
    slow: 'Slow <em>connection</em>',
    offline: 'You&rsquo;re <em>offline</em>',
  };
  // A list that scrolls inside its box (search results, the quick search
  // dropdown): a fade on whichever edge has more (.more-t / .more-b), so
  // reaching the end is visible. The box keeps the scroll to itself
  // (overscroll-behavior in the CSS), so the page doesn't move or refresh.
  function scrollEdges(box) {
    function edges() {
      var max = box.scrollHeight - box.clientHeight;
      box.classList.toggle('more-t', max > 1 && box.scrollTop > 1);
      box.classList.toggle('more-b', max > 1 && box.scrollTop < max - 1);
    }
    box.addEventListener('scroll', edges, { passive: true });
    if (window.MutationObserver) new MutationObserver(edges).observe(box, { childList: true });
    if (window.ResizeObserver) new ResizeObserver(edges).observe(box);
    edges();
  }

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
    if (results) scrollEdges(results);
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
    var q = new URLSearchParams(location.search).get('q');
    if (want === 'clan' && q) {
      input.value = q;
      searchClans(q);
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
          results.innerHTML =
            items.map(clanResult).join('') +
            (items.length > 4 ? '<li class="pt-results-end">End of results &middot; ' + items.length + ' clans</li>' : '');
        })
        .catch(function (err) {
          results.innerHTML = '<li class="pt-results-note">' + message('clan', err.message) + '</li>';
        });
    }

    var box = document.getElementById('ptRecent');
    if (!box) return;
    var recent = readRecent();
    if (!recent.length) box.querySelector('h2').textContent = 'Featured';
    box.querySelector('ul').innerHTML = (recent.length ? recent : FEATURED).map(recentRow).join('');
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
        idx[key(u.name)] = { group: group, img: data.imageDir + u.img, super: !!u.super };
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
      // Maxed for this Town Hall: the level badge turns red (.is-max).
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

  // Heroes as small cards: portrait, name, level. Their equipment isn't
  // repeated here -- it has its own Hero equipment section below.
  function heroCards(heroes, idx) {
    if (!heroes.length) return '';
    return (
      '<section class="pt-group"><div class="pt-group-head"><h3>Heroes</h3></div><ul class="pt-heroes">' +
      heroes
        .map(function (h) {
          return (
            '<li class="pt-hero">' +
            tile(h, idx, 'pt-tile--lg', 'div') +
            '<b class="pt-hero-name">' +
            esc(h.name) +
            '</b><span class="pt-hero-lvl">' +
            h.level +
            '<i>/' +
            (h.cap || h.maxLevel) +
            '</i></span></li>'
          );
        })
        .join('') +
      '</ul></section>'
    );
  }

  // One labelled tray of numbers ("All time: 238 XP level | 2,071 war stars
  // ..."): the group's name in a column on the left, then one even cell per
  // number. The profile header has two (all time, this season), the clan
  // header three; the Builder Base tab has one. dt comes first for screen
  // readers; CSS shows the number above its label.
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
    return {
      hall: 'Town Hall',
      lvl: th,
      groups: PROGRESS_GROUPS,
      rows: rows,
      total: total,
      rushed: prev && prevNeed ? miss / prevNeed : null,
      note: 'Equipment counts only the items this player owns.',
    };
  }

  // The same for the Builder Base: Battle Machine / Battle Copter and the
  // builder troops against coc-max-levels.json "bh" (per Builder Hall).
  var BB_HEROES = ['Battle Machine', 'Battle Copter'];
  function builderUnits(p) {
    return p.troops.concat(p.heroes).filter(function (u) {
      return u.village === 'builderBase';
    });
  }
  function setBuilderCaps(p, maxTable) {
    var table = maxTable && maxTable.bh && maxTable.bh[p.builderHallLevel];
    if (!table) return;
    builderUnits(p).forEach(function (u) {
      if (table[u.name]) u.cap = table[u.name];
    });
  }
  function builderProgress(p, maxTable) {
    var bh = p.builderHallLevel;
    var now = maxTable && maxTable.bh && maxTable.bh[bh];
    if (!now) return null;
    var prev = maxTable.bh[bh - 1];
    var have = {};
    builderUnits(p).forEach(function (u) {
      have[u.name] = u.level;
    });
    var rows = {};
    var total = { done: 0, need: 0 };
    var miss = 0;
    var prevNeed = 0;
    Object.keys(now).forEach(function (name) {
      var cap = now[name];
      var lvl = Math.min(have[name] || 0, cap);
      var g = BB_HEROES.indexOf(name) !== -1 ? 'heroes' : 'troops';
      var r = (rows[g] = rows[g] || { done: 0, need: 0 });
      r.done += lvl;
      r.need += cap;
      total.done += lvl;
      total.need += cap;
      if (prev && prev[name]) {
        prevNeed += prev[name];
        miss += Math.max(0, prev[name] - (have[name] || 0));
      }
    });
    return {
      hall: 'Builder Hall',
      lvl: bh,
      groups: [
        ['heroes', 'Heroes'],
        ['troops', 'Troops'],
      ],
      rows: rows,
      total: total,
      rushed: prev && prevNeed ? miss / prevNeed : null,
      note: 'Max levels per Builder Hall come from the Clash of Clans wiki.',
    };
  }

  // One row: Overall, then each group -- the percentage on top, the name,
  // a hairline bar and what's left. Phones: Overall across the top, the six
  // groups 3 x 2 under it (CSS).
  function progressBox(pr) {
    // floor, so 99.6% never reads as a finished 100%
    function cell(label, r, cls) {
      var left = r.need - r.done;
      return (
        '<li' +
        (cls ? ' class="' + cls + '"' : '') +
        '><b>' +
        Math.floor((r.done / r.need) * 100) +
        '<i>%</i></b><span class="pt-pg-name">' +
        label +
        '</span><span class="pt-pg-bar" aria-hidden="true"><i style="width:' +
        ((r.done / r.need) * 100).toFixed(1) +
        '%"></i></span><span class="pt-pg-left">' +
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
      '<section class="pt-group pt-progress"><div class="pt-group-head"><h3>' +
      pr.hall +
      ' ' +
      pr.lvl +
      ' progress</h3>' +
      verdict +
      '</div><ul class="pt-pg">' +
      cell('Overall', pr.total, 'is-total') +
      pr.groups.filter(function (g) {
        return pr.rows[g[0]];
      })
        .map(function (g) {
          return cell(g[1], pr.rows[g[0]]);
        })
        .join('') +
      '</ul><p class="pt-pg-note">' +
      (pr.rushed !== null
        ? 'Rushed: ' +
          pr.groups
            .map(function (g) {
              return g[1].toLowerCase();
            })
            .filter(function (g) {
              return g !== 'equipment';
            })
            .join(', ') +
          ' below the ' +
          pr.hall +
          ' ' +
          (pr.lvl - 1) +
          ' max. '
        : '') +
      pr.note +
      '</p></section>'
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
    // Super troops are left out: the API lists every one at level 1 (they
    // have no levels of their own -- a boost uses the base troop's), so they
    // only cluttered the list. Only they carry superTroopIsActive.
    var troops = homeTroops.filter(function (u) {
      var i = idx[key(u.name)];
      return !('superTroopIsActive' in u) && !(i && i.super) && (!i || i.group === 'troops');
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

    // An achievement's running total (all-time numbers the profile has no
    // field for: troops donated, attacks won...), or null.
    var achVal = function (name) {
      var a = p.achievements.find(function (x) {
        return x.name === name;
      });
      return a ? a.value : null;
    };
    var allTime = [
      ['Best trophies', num(p.bestTrophies)],
      ['War stars', num(p.warStars)],
      achVal('Conqueror') != null ? ['Attacks won', num(achVal('Conqueror'))] : null,
      achVal('Friend in Need') != null ? ['Troops donated', num(achVal('Friend in Need'))] : null,
      ['Capital gold', num(p.clanCapitalContributions)],
    ].filter(Boolean);

    // "This season" numbers reset when the season ends; the others never do.
    var stats =
      '<div class="pt-wellfacts">' +
      facts('All time', allTime) +
      facts('This season', [
        ['Trophies', num(p.trophies)],
        ['Attack wins', num(p.attackWins)],
        ['Defense wins', num(p.defenseWins)],
        ['Donated', num(p.donations)],
        ['Received', num(p.donationsReceived)],
      ]) +
      '</div>';

    // Builder Base: everything that changes with the village switch.
    var bh = p.builderHallLevel;
    setBuilderCaps(p, maxTable);
    var bb = p.troops.filter(function (u) {
      return u.village === 'builderBase';
    });
    var bbHeroes = p.heroes.filter(function (u) {
      return u.village === 'builderBase';
    });
    var bpr = bh ? builderProgress(p, maxTable) : null;
    var bbStats = bh
      ? '<div class="pt-wellfacts">' +
        facts(
          'Builder base',
          [
            ['Trophies', num(p.builderBaseTrophies)],
            ['Best trophies', num(p.bestBuilderBaseTrophies)],
            achVal('Un-Build It') != null ? ['Halls destroyed', num(achVal('Un-Build It'))] : null,
            ['Troops', bb.length],
          ].filter(Boolean),
        ) +
        '</div>'
      : '';

    // The swap key on the hall's corner shows the OTHER village's hall: tap
    // it to go there. [data-on] pictures fade / scale in and out with the
    // village (CSS), so the hall and the key swap smoothly. Players without
    // a Builder Base don't get one.
    var bhIcon = bh ? '/icons/bh' + bh + 'icon.webp' : '';
    var hallPic = function (src, on) {
      return src ? '<img data-on="' + on + '" src="' + src + '" alt="" width="112" height="112" />' : '';
    };
    var villageSwitch = bh
      ? '<button type="button" class="pt-swap" aria-label="Show the Builder Base" title="Builder Base">' +
        hallPic(bhIcon, 'home') +
        hallPic(icon, 'builder') +
        '</button>'
      : '';

    var tabs = function (village, list) {
      return (
        '<div class="pt-tabs" role="tablist" aria-label="' +
        (village === 'home' ? 'Home village' : 'Builder base') +
        ' sections" data-show="' +
        village +
        '">' +
        list
          .map(function (t, i) {
            var on = i === 0 && village === 'home';
            return (
              '<button type="button" role="tab" id="ptTab' +
              t[0] +
              '" aria-controls="ptPanel' +
              t[0] +
              '" aria-selected="' +
              on +
              '"' +
              (on ? '' : ' tabindex="-1"') +
              '>' +
              t[1] +
              '</button>'
            );
          })
          .join('') +
        '</div>'
      );
    };
    var panel = function (id, html, shown) {
      return (
        '<div class="pt-panel" id="ptPanel' + id + '" role="tabpanel" aria-labelledby="ptTab' + id + '"' + (shown ? '' : ' hidden') + '>' + html + '</div>'
      );
    };

    var heroHtml = heroCards(p.heroes.filter(home), idx);

    root.dataset.village = 'home';
    root.innerHTML =
      quickSearch('player') +
      '<header class="pt-head pt-head--player">' +
      '<div class="pt-th">' +
      '<div class="pt-plinth">' +
      hallPic(icon, 'home') +
      hallPic(bhIcon, 'builder') +
      villageSwitch +
      '</div>' +
      // Both villages' names share one cell (.pt-stack), so swapping never
      // moves the layout. The weapon only exists at Town Hall 17 now.
      '<span class="pt-stack pt-hall"><span data-show="home">Town Hall ' +
      th +
      (th === 17 && p.townHallWeaponLevel ? '<i>Weapon ' + p.townHallWeaponLevel + '</i>' : '') +
      '</span>' +
      (bh ? '<span data-show="builder">Builder Hall ' + bh + '</span>' : '') +
      '</span></div>' +
      '<div class="pt-id"><h1 class="pt-name">' +
      esc(p.name) +
      '<span class="pt-xp" title="XP level ' +
      p.expLevel +
      '"><svg viewBox="-1 -1 26 26" aria-hidden="true"><path d="M12.00 0.40L14.41 3.02L17.80 1.95L18.58 5.42L22.05 6.20L20.98 9.59L23.60 12.00L20.98 14.41L22.05 17.80L18.58 18.58L17.80 22.05L14.41 20.98L12.00 23.60L9.59 20.98L6.20 22.05L5.42 18.58L1.95 17.80L3.02 14.41L0.40 12.00L3.02 9.59L1.95 6.20L5.42 5.42L6.20 1.95L9.59 3.02Z"/></svg><b><span class="pt-sr">XP level </span>' +
      p.expLevel +
      '</b></span></h1>' +
      '<p class="pt-tagline"><span>#' +
      tag +
      '</span><button type="button" class="pt-copy" data-copy="#' +
      tag +
      '">Copy tag</button>' +
      '<button type="button" class="pt-copy pt-share"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" /><path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4" /></svg><span>Share</span></button>' +
      (labels ? '<span class="pt-labels">' + labels + '</span>' : '') +
      '</p>' +
      clan +
      '</div>' +
      '<div class="pt-stack pt-leagues">' +
      (league
        ? '<div class="pt-league" data-show="home">' +
          (league.iconUrls ? '<img src="' + (league.iconUrls.medium || league.iconUrls.small) + '" alt="" width="72" height="72" />' : '') +
          '<span>' +
          esc(league.name) +
          '</span><b>' +
          TROPHY +
          num(p.trophies) +
          '</b></div>'
        : '') +
      (bh
        ? '<div class="pt-league" data-show="builder"><span>' +
          esc(p.builderBaseLeague ? p.builderBaseLeague.name : 'Unranked') +
          '</span><b>' +
          TROPHY +
          num(p.builderBaseTrophies) +
          '</b></div>'
        : '') +
      '</div></header>' +
      tabs('home', [
        ['Home', 'Overview'],
        ['Attacks', 'Attacks'],
        ['Ach', 'Achievements'],
        ['Clans', 'Previous clans'],
        ['Stats', 'Stats'],
      ]) +
      (bh
        ? tabs('builder', [
            ['BB', 'Overview'],
            ['BBAch', 'Achievements'],
          ])
        : '') +
      panel(
        'Home',
        (pr ? progressBox(pr) : '') +
          heroHtml +
          tileGroup('Hero equipment', p.heroEquipment.filter(home), idx) +
          tileGroup('Pets', homeTroops.filter(inGroup('pets')), idx) +
          tileGroup('Troops', troops, idx) +
          tileGroup('Siege machines', homeTroops.filter(inGroup('sieges')), idx) +
          tileGroup('Spells', p.spells.filter(home), idx),
        true,
      ) +
      panel('Attacks', '') +
      panel('Ach', achievementsOf(p, ['home', 'clanCapital'])) +
      panel('Clans', '') +
      // the profile's own numbers at once; ClashKing's war / battle stats
      // load under them the first time the tab opens (loadStats)
      panel('Stats', stats + '<div class="pt-ck-stats"></div>') +
      (bh
        ? panel('BB', bbStats + (bpr ? progressBox(bpr) : '') + heroCards(bbHeroes, idx) + tileGroup('Troops', bb, idx)) +
          panel('BBAch', achievementsOf(p, ['builderBase']))
        : '') +
      '<p class="pt-source">Live data from the official Clash of Clans API, refreshed every 5 minutes, so a battle you just played can take a few minutes to show up. A red level marks a unit that is maxed for this Town Hall or Builder Hall.</p>';

    wireTabs(root);
    wireCopy(root);
    wireShare(root, p.name);
    wireQuick(root);
    wireVillage(root);
    // ClashKing's history tabs load the first time they're opened.
    [
      ['Attacks', loadAttacks],
      ['Stats', loadStats],
      ['Clans', loadClans],
    ].forEach(function (t) {
      onFirstOpen(root.querySelector('#ptTab' + t[0]), function () {
        t[1](root.querySelector('#ptPanel' + t[0]), tag, data, p);
      });
    });
  }

  // The gold trophy before trophy counts.
  var TROPHY =
    '<svg class="pt-trophy" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v2h3.5v2.5A4.5 4.5 0 0 1 16.6 12 5.5 5.5 0 0 1 13 14.8V17h3v4H8v-4h3v-2.2A5.5 5.5 0 0 1 7.4 12 4.5 4.5 0 0 1 3.5 7.5V5H7zm0 4H5.5v.5a2.5 2.5 0 0 0 1.7 2.4A6 6 0 0 1 7 8.5zm10 0v1.5a6 6 0 0 1-.2 1.4 2.5 2.5 0 0 0 1.7-2.4V7z"/></svg>';

  // Home / Builder: root[data-village] shows one village's hall, league,
  // tabs and panels (CSS hides the other's [data-show]); the swap key flips
  // it and opens that village's first tab. #builder in the address opens
  // the Builder Base.
  function wireVillage(root) {
    var key = root.querySelector('.pt-swap');
    if (!key) return;
    function pick(v) {
      root.dataset.village = v;
      key.setAttribute('aria-label', v === 'home' ? 'Show the Builder Base' : 'Show the Home Village');
      key.title = v === 'home' ? 'Builder Base' : 'Home Village';
      root.querySelector('.pt-tabs[data-show="' + v + '"] [role=tab]').click();
      history.replaceState(null, '', location.pathname + location.search + (v === 'builder' ? '#builder' : ''));
    }
    key.addEventListener('click', function () {
      pick(root.dataset.village === 'home' ? 'builder' : 'home');
    });
    if (location.hash === '#builder') pick('builder');
  }

  // Achievement groups for the given villages (home + clanCapital on the
  // Home side, builderBase on the Builder side): stars, name, what it asks,
  // and a bar towards the next star.
  function achievementsOf(p, villages) {
    return villages
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
              var open = a.stars < 3 && a.target;
              return (
                '<li' +
                (a.stars === 3 ? ' class="is-done"' : '') +
                '>' +
                stars(a.stars) +
                '<div><b>' +
                esc(a.name) +
                '</b><span>' +
                esc(a.stars === 3 ? a.completionInfo || a.info : a.info) +
                '</span>' +
                (open ? '<i class="pt-ach-bar"><i style="width:' + Math.min(100, (a.value / a.target) * 100).toFixed(1) + '%"></i></i>' : '') +
                '</div><em>' +
                num(a.value) +
                (open ? ' <i>/ ' + num(a.target) + '</i>' : '') +
                '</em></li>'
              );
            })
            .join('') +
          '</ul></section>'
        );
      })
      .join('');
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

  // Share: the phone's share sheet where there is one, else copy the link.
  function wireShare(root, name) {
    var btn = root.querySelector('.pt-share');
    if (!btn) return;
    var label = btn.querySelector('span');
    btn.addEventListener('click', function () {
      var url = location.origin + location.pathname;
      if (navigator.share) {
        navigator.share({ title: name + ' | Parchrome Player Tracker', url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          label.textContent = 'Link copied';
          setTimeout(function () {
            label.textContent = 'Share';
          }, 1600);
        });
      }
    });
  }

  // Above the profile / clan header: a slim search -- Player / Clan switch,
  // the field and a go button -- so the next lookup happens right here. It
  // starts in this page's mode. A clan name (not a #tag) goes to the search
  // page's name search (?mode=clan&q=).
  function quickSearch(what) {
    function radio(m, label) {
      var on = m === what;
      return (
        '<button type="button" role="radio" aria-checked="' +
        on +
        '" data-mode="' +
        m +
        '"' +
        (on ? '' : ' tabindex="-1"') +
        '>' +
        label +
        '</button>'
      );
    }
    return (
      '<div class="pt-quick-wrap"><form class="pt-quick" role="search" novalidate>' +
      '<div class="pt-quick-mode" role="radiogroup" aria-label="Search for">' +
      radio('player', 'Player') +
      radio('clan', 'Clan') +
      '</div><label class="pt-sr" for="ptQuick">Search another ' +
      what +
      '</label><div class="pt-quick-field"><svg class="pt-quick-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" /></svg>' +
      '<input id="ptQuick" type="text" autocomplete="off" spellcheck="false" placeholder="" aria-controls="ptQuickPanel" />' +
      '<button type="submit" class="pt-quick-go" aria-label="Search"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg></button>' +
      '</div></form><div class="pt-quick-panel" id="ptQuickPanel" hidden><p class="pt-quick-head"></p><ul class="pt-quick-list" aria-live="polite"></ul></div></div>'
    );
  }

  // The dropdown under the slim bar. Empty field focused: Recently viewed
  // (or Featured). Enter: the result -- a player or clan by tag, or up to
  // 10 clans by name -- one API call per search. Esc / click outside closes.
  function wireQuick(root) {
    var wrap = root.querySelector('.pt-quick-wrap');
    if (!wrap) return;
    var form = wrap.querySelector('.pt-quick');
    var input = form.querySelector('input');
    var panel = wrap.querySelector('.pt-quick-panel');
    var head = panel.querySelector('.pt-quick-head');
    var list = panel.querySelector('.pt-quick-list');
    scrollEdges(panel);
    var radios = [].slice.call(form.querySelectorAll('[role=radio]'));
    var mode;
    var seq = 0; // a newer search wins over a slower older one

    function show(title, html) {
      head.textContent = title;
      head.hidden = !title;
      list.innerHTML = html;
      panel.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }
    function hide() {
      seq++;
      panel.hidden = true;
      input.setAttribute('aria-expanded', 'false');
    }
    function note(html) {
      return '<li class="pt-results-note">' + html + '</li>';
    }
    function showRecent() {
      var recent = readRecent();
      show(recent.length ? 'Recently viewed' : 'Featured', (recent.length ? recent : FEATURED).map(recentRow).join(''));
    }
    function setMode(m) {
      mode = m;
      radios.forEach(function (b) {
        var on = b.dataset.mode === m;
        b.setAttribute('aria-checked', on);
        b.tabIndex = on ? 0 : -1;
      });
      input.placeholder = m === 'clan' ? 'Clan name or #tag' : 'Another player tag';
      if (!panel.hidden) input.value.trim() ? hide() : showRecent();
    }
    radios.forEach(function (b, i) {
      b.addEventListener('click', function () {
        setMode(b.dataset.mode);
        input.focus();
      });
      b.addEventListener('keydown', function (e) {
        var step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        var next = radios[(i + step + radios.length) % radios.length];
        setMode(next.dataset.mode);
        next.focus();
      });
    });
    setMode(form.querySelector('[aria-checked=true]').dataset.mode);

    input.addEventListener('focus', function () {
      if (!input.value.trim()) showRecent();
    });
    input.addEventListener('input', function () {
      input.value.trim() ? hide() : showRecent();
    });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) {
        hide();
        input.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) hide();
    });

    function run(title, request) {
      var my = ++seq;
      show(title, '<li class="pt-quick-sk"><i class="pt-sk pt-sk-row"></i></li><li class="pt-quick-sk"><i class="pt-sk pt-sk-row"></i></li>');
      request.then(
        function (html) {
          if (my === seq) show(title, html);
        },
        function (err) {
          if (my === seq) show(title, note(message(mode, err.message)));
        },
      );
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var raw = input.value.trim();
      if (!raw) return showRecent();
      if (mode === 'clan' && raw.charAt(0) !== '#') {
        if (raw.length < 3) return show('', note('Type at least 3 letters of the clan name, or its tag starting with #.'));
        return run(
          'Clans named \u201c' + raw + '\u201d',
          api('type=clansearch&name=' + encodeURIComponent(raw)).then(function (body) {
            var items = (body.items || []).slice(0, 10);
            return items.length ? items.map(clanResult).join('') : note('No clans found with that name.');
          }),
        );
      }
      var tag = cleanTag(raw);
      if (!tag) return show('', note(message(mode, 'badTag')));
      if (mode === 'clan') return run('Clan #' + tag, api('type=clan&tag=' + tag).then(clanResult));
      run('Player #' + tag, api('type=player&tag=' + tag).then(playerResult));
    });
  }

  // ---- loading skeletons: grey shapes in the layout that's coming, with a
  // slow shimmer, so nothing jumps when the data lands. kind: 'player' |
  // 'clan' (whole page) or 'tab' (War / History panels).
  function skeleton(kind, label) {
    function n(count, html) {
      return new Array(count + 1).join(html);
    }
    var sk = function (cls, style) {
      return '<i class="pt-sk' + (cls ? ' ' + cls : '') + '"' + (style ? ' style="' + style + '"' : '') + '></i>';
    };
    var rows = '<div class="pt-sk-card">' + sk('', 'width:160px') + n(6, sk('pt-sk-row')) + '</div>';
    var body =
      kind === 'tab'
        ? rows
        : sk('pt-sk-quick') +
          '<div class="pt-sk-card pt-sk-head">' +
          sk('pt-sk-th') +
          '<div class="pt-sk-lines">' +
          sk('', 'width:44%;height:26px') +
          sk('', 'width:28%') +
          sk('', 'width:36%') +
          '</div><div class="pt-sk-facts">' +
          n(5, '<div>' + sk('', 'width:56px;height:16px') + sk('', 'width:70px;height:9px') + '</div>') +
          '</div></div>' +
          '<div class="pt-sk-tabs">' +
          n(3, sk('', 'width:96px')) +
          '</div>' +
          (kind === 'clan'
            ? rows
            : '<div class="pt-sk-card">' +
              sk('', 'width:200px') +
              '<div class="pt-sk-tiles">' +
              n(16, sk('pt-sk-tile')) +
              '</div></div>');
    return '<div class="pt-skel" role="status"><span class="pt-sr">' + label + '</span>' + body + '</div>';
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
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        select(t);
      });
      t.addEventListener('keydown', function (e) {
        var step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        var order = [].slice.call(t.parentNode.querySelectorAll('[role=tab]')); // DOM order: the clan page can move War first
        var next = order[(order.indexOf(t) + step + order.length) % order.length];
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
          : TITLES[kind] || 'Couldn&rsquo;t <em>load</em>') +
      '</h1><p class="th-soon-text">' +
      message(what, kind) +
      '</p><div class="th-soon-actions">' +
      (retry && kind !== 'notFound' && kind !== 'badTag' && kind !== 'private'
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
    root.innerHTML = skeleton('player', 'Loading player #' + tag);
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
        if (!/^(notFound|maintenance|private|down|server|slow|offline|other)$/.test(err.message)) console.error(err); // a bug, not the API
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

  /* ------------------------------------------------------------- ClashKing */
  // The profile's Attacks, Stats and Previous clans tabs (Oct 25 2026): history the
  // official API doesn't keep (it only knows a player as they are now). It
  // comes from ClashKing's public API (api.clashk.ing: no key, any site may
  // call it), straight from the browser, so it costs the Worker nothing.
  // ClashKing only has what its bot recorded, hence the "may be missing"
  // notes. If ClashKing goes down, only these three tabs say so.
  var CK = 'https://api.clashk.ing/v2/player/%23';
  function ck(path) {
    return fetch(CK + path)
      .then(function (res) {
        if (!res.ok) throw new Error('other');
        return res.json();
      })
      .then(function (b) {
        return b.items || [];
      });
  }
  var CK_FAIL = '<p class="pt-empty">ClashKing couldn&rsquo;t be reached. Reload the page to try again.</p>';
  function ckSource(what) {
    return (
      '<p class="pt-source">' +
      what +
      ' from ClashKing, which only has what its bot recorded, so some may be missing.</p>'
    );
  }
  function onFirstOpen(tab, fn) {
    tab.addEventListener('click', function go() {
      tab.removeEventListener('click', go);
      fn();
    });
  }
  // Mean of fn over list, or null when it's empty.
  function mean(list, fn) {
    return list.length
      ? list.reduce(function (t, x) {
          return t + fn(x);
        }, 0) / list.length
      : null;
  }
  function fixed(v, digits, unit) {
    return v == null ? '&ndash;' : v.toFixed(digits) + (unit || '');
  }
  function shortDay(d) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  // STAR STRIP: one square per hit, oldest on the left, coloured by its
  // stars (3 green, 2 amber, 1 red, 0 grey) -- a season's form at a glance.
  // hits: [{ stars, label, go }]; go = the id of the row it stands for, so
  // a click jumps there (wireStrip).
  // legend (optional): [[stars, label], ...] -- the clan's war log uses
  // 3 / 1 / 0 for win / loss / draw.
  var STAR_KEY = [
    [3, '3 stars'],
    [2, '2 stars'],
    [1, '1 star'],
    [0, '0 stars'],
  ];
  function starStrip(title, hits, legend) {
    legend = legend || STAR_KEY;
    var count = [0, 0, 0, 0];
    hits.forEach(function (h) {
      count[h.stars]++;
    });
    return (
      '<section class="pt-group pt-strip"><div class="pt-group-head"><h3>' +
      title +
      '</h3><span class="pt-strip-key">' +
      legend
        .map(function (k) {
          return '<span><i class="s' + k[0] + '"></i>' + k[1] + ' <b>' + count[k[0]] + '</b></span>';
        })
        .join('') +
      '</span></div><div class="pt-strip-cells" role="img" aria-label="' +
      hits.length +
      ' results, oldest first: ' +
      legend
        .map(function (k) {
          return count[k[0]] + ' ' + k[1];
        })
        .join(', ') +
      '">' +
      hits
        .map(function (h) {
          return '<i class="s' + h.stars + '" title="' + esc(h.label) + '" data-go="' + h.go + '"></i>';
        })
        .join('') +
      '</div></section>'
    );
  }
  // A click on a square: show its row (a war past "Show all" included),
  // bring it into view and flash it.
  function wireStrip(box) {
    var cells = box.querySelector('.pt-strip-cells');
    if (!cells) return;
    cells.addEventListener('click', function (e) {
      var go = e.target.dataset && e.target.dataset.go;
      var row = go && document.getElementById(go);
      if (!row) return;
      if (row.hidden) {
        var more = box.querySelector('.pt-ck-more');
        if (more) more.click();
      }
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.remove('is-flash');
      void row.offsetWidth; // restart the flash on a second click
      row.classList.add('is-flash');
    });
  }

  // Attacks opens on Classic, with a Classic | Clan war switch (modeTab);
  // each view is built the first time it's picked. Stats shows both on one
  // page. The two tabs share one download per player (ckOnce).
  var ckCache = {};
  function ckOnce(path) {
    return (
      ckCache[path] ||
      (ckCache[path] = ck(path).catch(function (err) {
        delete ckCache[path]; // a failed load gets another go
        throw err;
      }))
    );
  }
  function warsOf(tag) {
    return ckOnce(tag + '/war/stats?limit=100');
  }
  // Battles come from two places, merged newest first:
  // - the official API's battle log (Worker type=battlelog): the player's
  //   recent battles (about the last 50), every player, with the opponent;
  // - ClashKing: older battles, but only for players its bot follows (it
  //   allows at most 365 days a request).
  // The same battle in both keeps the official copy. Either source may fail
  // (null); both failing is an error. Attacks only: the official log also
  // lists defenses (attack: false).
  var battleCache = {};
  var LOOT_KEY = { Gold: 'gold', Elixir: 'elixir', DarkElixir: 'darkElixir' };
  // An official entry in ClashKing's shape (battleTime there is the
  // duration in seconds; the date is battleTimestamp).
  function fromApi(a) {
    var t = apiTime(a.battleTimestamp);
    var loot = {};
    (a.lootedResources || []).forEach(function (r) {
      if (LOOT_KEY[r.name]) loot[LOOT_KEY[r.name]] = r.amount;
    });
    return {
      api: true,
      battleMode: a.battleType,
      battleTime: t ? t.toISOString() : null,
      stars: a.stars,
      destructionPercentage: a.destructionPercentage,
      duration: a.battleTime,
      lootedResources: loot,
      shareCode: a.armyShareCode,
      opponent: { tag: a.opponentPlayerTag, name: a.opponentName, th: a.opponentTownHallLevel },
    };
  }
  function battlesOf(tag) {
    if (battleCache[tag]) return battleCache[tag];
    var none = function () {
      return null;
    };
    var official = api('type=battlelog&tag=' + tag).then(function (b) {
      return (b.items || [])
        .filter(function (a) {
          return a.attack;
        })
        .map(fromApi)
        .filter(function (b) {
          return b.battleTime;
        });
    }, none);
    var logged = ckOnce(tag + '/battlelog/history?time%5Bafter%5D=' + new Date(Date.now() - 364 * 864e5).toISOString().slice(0, 10)).then(null, none);
    return (battleCache[tag] = Promise.all([official, logged]).then(function (r) {
      if (!r[0] && !r[1]) {
        delete battleCache[tag]; // a failed load gets another go
        throw new Error('other');
      }
      var list = r[0] || [];
      (r[1] || []).forEach(function (b) {
        var t = Date.parse(b.battleTime);
        var dup = list.some(function (a) {
          return a.api && a.stars === b.stars && Math.abs(Date.parse(a.battleTime) - t) < 60000;
        });
        if (!dup) list.push(b);
      });
      return list.sort(function (a, b) {
        return Date.parse(b.battleTime) - Date.parse(a.battleTime);
      });
    }));
  }
  function modeTab(box, views) {
    box.innerHTML =
      '<div class="pt-ck-mode">' +
      switchKeys('Attack type', [
        ['classic', 'Classic'],
        ['war', 'Clan war'],
      ]) +
      '</div><div class="pt-ck-pane" data-pane="classic"></div><div class="pt-ck-pane" data-pane="war" hidden></div>';
    var built = {};
    function show(v) {
      [].forEach.call(box.querySelectorAll('.pt-ck-pane'), function (p) {
        p.hidden = p.dataset.pane !== v;
      });
      if (built[v]) return;
      built[v] = true;
      views[v](box.querySelector('.pt-ck-pane[data-pane="' + v + '"]'));
    }
    wireSwitch(box.querySelector('.pt-ck-mode'), show);
    show('classic');
  }
  function loadAttacks(box, tag, data, p) {
    modeTab(box, {
      classic: function (pane) {
        battlesView(pane, tag, p);
      },
      war: function (pane) {
        warsView(pane, tag);
      },
    });
  }
  // Stats: the profile's numbers are already in the panel; under them,
  // everything ClashKing has in one place -- clan war (a star bar per side,
  // attacks vs defenses), average stars by month, classic battles (star
  // counts, averages, loot). Each source fails on its own.
  function loadStats(box, tag) {
    box = box.querySelector('.pt-ck-stats');
    box.innerHTML = skeleton('tab', 'Loading stats');
    var soft = function (load) {
      return load.then(null, function () {
        return null; // null = couldn't be loaded, [] = nothing recorded
      });
    };
    Promise.all([soft(warsOf(tag)), soft(battlesOf(tag))]).then(function (r) {
      var wars = r[0];
      var battles = r[1];
      if (!wars && !battles) {
        box.innerHTML = CK_FAIL;
        return;
      }
      var none = function (title, msg) {
        return '<section class="pt-group"><div class="pt-group-head"><h3>' + title + '</h3></div><p class="pt-ck-none">' + msg + '</p></section>';
      };
      box.innerHTML =
        (wars && wars.length
          ? warSummary(wars) + warChart(wars)
          : none('Clan war', wars ? 'ClashKing hasn&rsquo;t recorded any wars for this player.' : 'War stats couldn&rsquo;t be loaded.')) +
        (battles && battles.length
          ? battleSummary(battles)
          : none('Classic battles', battles ? 'No battles found for this player.' : 'Battle stats couldn&rsquo;t be loaded.')) +
        BATTLE_SOURCE +
        ckSource('War stats');
    });
  }

  function starCounts(hits) {
    var n = [0, 0, 0, 0];
    hits.forEach(function (h) {
      n[h.stars]++;
    });
    return n;
  }
  function pctOf(n, total) {
    return total ? Math.round((n / total) * 100) + '%' : '&ndash;';
  }
  // One side's stars as a single split bar (3 / 2 / 1 / 0, the star
  // strip's colours), counts under it.
  var STAR_ORDER = [3, 2, 1, 0];
  function starBar(title, hits) {
    if (!hits.length) return '';
    var n = starCounts(hits);
    return (
      '<div class="pt-st-bar"><div class="pt-st-bar-h"><b>' +
      title +
      '</b><span>' +
      num(hits.length) +
      '</span></div><div class="pt-st-track pt-strip" role="img" aria-label="' +
      STAR_ORDER.map(function (s) {
        return n[s] + ' with ' + s + ' stars';
      }).join(', ') +
      '">' +
      STAR_ORDER.map(function (s) {
        return n[s] ? '<i class="s' + s + '" style="flex-grow:' + n[s] + '"></i>' : '';
      }).join('') +
      '</div><ul class="pt-st-key pt-strip">' +
      STAR_ORDER.map(function (s) {
        return '<li><i class="s' + s + '"></i>' + s + '&#9733; <b>' + n[s] + '</b>' + pctOf(n[s], hits.length) + '</li>';
      }).join('') +
      '</ul></div>'
    );
  }

  // Clan war: a star bar per side, then attacks vs defenses side by side.
  function warSummary(list) {
    var atk = warHits(list, 'attacks');
    var def = warHits(list, 'defenses');
    var slots = list.reduce(function (t, w) {
      return t + (w.attacksPerMember || 1);
    }, 0);
    var side = function (hits) {
      var avg = function (k) {
        return mean(hits, function (h) {
          return h[k];
        });
      };
      var thd = avg('thd');
      return [
        pctOf(starCounts(hits)[3], hits.length),
        fixed(avg('stars'), 2),
        fixed(avg('pct'), 1, '%'),
        hits.length ? mmss(avg('dur')) : '&ndash;',
        thd == null ? '&ndash;' : (thd > 0 ? '+' : '') + thd.toFixed(2),
      ];
    };
    var a = side(atk);
    var d = side(def);
    return (
      '<section class="pt-group pt-st-war"><div class="pt-group-head"><h3>Clan war</h3><span>' +
      list.length +
      ' wars &middot; ' +
      atk.length +
      '/' +
      slots +
      ' attacks used</span></div><div class="pt-st-bars">' +
      starBar('Attacks', atk) +
      starBar('Defenses', def) +
      '</div><table class="pt-st-vs"><thead><tr><th></th><th scope="col">Attacks</th><th scope="col">Defenses</th></tr></thead><tbody>' +
      ['Three-star rate', 'Avg stars', 'Avg destruction', 'Avg time', 'Avg TH difference']
        .map(function (label, i) {
          return '<tr><th scope="row">' + label + '</th><td>' + a[i] + '</td><td>' + d[i] + '</td></tr>';
        })
        .join('') +
      '</tbody></table></section>'
    );
  }

  // Classic battles: star counts, averages, then the loot those battles took.
  function battleSummary(list) {
    var n = starCounts(list);
    var avg = function (k) {
      return mean(list, function (b) {
        return b[k];
      });
    };
    return (
      '<section class="pt-group pt-st-battles"><div class="pt-group-head"><h3>Classic battles</h3><span>' +
      list.length +
      ' attacks</span></div><div class="pt-dist"><ul>' +
      STAR_ORDER.map(function (s) {
        return '<li>' + stars(s) + '<b>' + num(n[s]) + '</b><span>' + pctOf(n[s], list.length) + '</span></li>';
      }).join('') +
      '</ul></div><dl class="pt-st-avg"><div><dt>Avg stars</dt><dd>' +
      fixed(avg('stars'), 2) +
      '</dd></div><div><dt>Avg destruction</dt><dd>' +
      fixed(avg('destructionPercentage'), 1, '%') +
      '</dd></div><div><dt>Avg time</dt><dd>' +
      mmss(avg('duration')) +
      '</dd></div></dl><ul class="pt-st-loot">' +
      LOOT.map(function (l) {
        var total = list.reduce(function (t, b) {
          return t + ((b.lootedResources || {})[l[0]] || 0);
        }, 0);
        return (
          '<li><img src="/clashofclans/articles/clan-games/' +
          l[1] +
          '.webp" alt="" width="32" height="32" /><span><b>' +
          num(total) +
          '</b>' +
          l[2] +
          ' looted &middot; ' +
          num(Math.round(total / list.length)) +
          ' a battle</span></li>'
        );
      }).join('') +
      '</ul></section>'
    );
  }

  // WARS: every war ClashKing saw this player in (newest first): the star
  // strip and each war's attacks and defenses (Attacks tab). Wars carry no
  // army, so these rows have no army sheet.
  var WAR_TYPE = { random: 'Regular', cwl: 'CWL', friendly: 'Friendly' };
  var WARS_SHOWN = 15; // the rest behind "Show all"

  function warsView(pane, tag) {
    pane.innerHTML = skeleton('tab', 'Loading wars');
    warsOf(tag).then(
      function (wars) {
        if (!wars.length) {
          pane.innerHTML = '<p class="pt-empty">ClashKing hasn&rsquo;t recorded any wars for this player.</p>' + ckSource('War history');
          return;
        }
        var types = wars
          .map(function (w) {
            return w.type;
          })
          .filter(function (t, i, all) {
            return all.indexOf(t) === i;
          });
        pane.innerHTML =
          (types.length > 1
            ? switchKeys(
                'War type',
                [['all', 'All wars']].concat(
                  types.map(function (t) {
                    return [t, WAR_TYPE[t] || t];
                  }),
                ),
              )
            : '') +
          '<div class="pt-ck-body"></div>' +
          ckSource('War history');
        var body = pane.querySelector('.pt-ck-body');
        function show(type) {
          var list = wars.filter(function (w) {
            return type === 'all' || w.type === type;
          });
          var hits = [];
          for (var i = list.length - 1; i >= 0; i--) addHits(list[i], i); // oldest war first
          function addHits(w, i) {
            var end = apiTime(w.endTime);
            w.attacks.forEach(function (a) {
              hits.push({
                stars: a.stars,
                go: 'ptWar' + i,
                label:
                  (end ? shortDay(end) + ' · ' : '') +
                  'vs ' +
                  a.player.name +
                  ' (TH' +
                  a.player.townhallLevel +
                  ') · ' +
                  a.stars +
                  ' stars, ' +
                  Math.round(a.destructionPercentage) +
                  '%',
              });
            });
          }
          body.innerHTML = (hits.length ? starStrip('Last ' + hits.length + ' war attacks', hits) : '') + warList(list);
          wireStrip(body);
          var more = body.querySelector('.pt-ck-more');
          if (more)
            more.addEventListener('click', function () {
              [].forEach.call(body.querySelectorAll('.pt-ck-war[hidden]'), function (s) {
                s.hidden = false;
              });
              more.remove();
            });
        }
        wireSwitch(pane, show);
        show('all');
      },
      function () {
        pane.innerHTML = CK_FAIL;
      },
    );
  }

  // side: 'attacks' | 'defenses'. thd = the other player's Town Hall minus ours.
  function warHits(list, side) {
    var out = [];
    list.forEach(function (w) {
      (w[side] || []).forEach(function (a) {
        out.push({ stars: a.stars, pct: a.destructionPercentage, dur: a.duration, thd: a.player.townhallLevel - w.player.townhallLevel });
      });
    });
    return out;
  }
  // Average stars per month, attacks vs defenses: bars on a 0-3 scale.
  function warChart(list) {
    var months = {};
    list.forEach(function (w) {
      var d = apiTime(w.endTime);
      if (!d) return;
      var m = months[d.toISOString().slice(0, 7)] || (months[d.toISOString().slice(0, 7)] = { atk: [], def: [], d: d });
      w.attacks.forEach(function (a) {
        m.atk.push(a.stars);
      });
      w.defenses.forEach(function (a) {
        m.def.push(a.stars);
      });
    });
    var keys = Object.keys(months).sort().slice(-8);
    if (keys.length < 2) return '';
    var bar = function (m, side, label) {
      var v = mean(m[side], Number);
      var name = m.d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return v == null
        ? '<i class="is-' + side + ' is-none"></i>'
        : '<i class="is-' +
            side +
            '" style="height:' +
            (v / 3) * 100 +
            '%" title="' +
            name +
            ', ' +
            label +
            ': ' +
            v.toFixed(2) +
            ' stars on average (' +
            m[side].length +
            ')"></i>';
    };
    return (
      '<section class="pt-group pt-ck-chart"><div class="pt-group-head"><h3>Average stars by month</h3>' +
      '<span class="pt-ck-key"><i class="is-atk"></i>Attacks<i class="is-def"></i>Defenses</span></div>' +
      '<div class="pt-ck-plot"><b style="bottom:21px">0</b><b style="bottom:71px">1</b><b style="bottom:121px">2</b><b style="bottom:171px">3</b>' +
      keys
        .map(function (k) {
          var m = months[k];
          return (
            '<div class="pt-ck-month"><div class="pt-ck-bars">' +
            bar(m, 'atk', 'attacks') +
            bar(m, 'def', 'defenses') +
            '</div><span>' +
            m.d.toLocaleDateString('en-US', { month: 'short' }) +
            '</span></div>'
          );
        })
        .join('') +
      '</div></section>'
    );
  }

  // One box per war: opponent, result, then each attack and defense.
  function warList(list) {
    var hit = function (kind, a) {
      return (
        '<li class="pt-ck-row"><span class="pt-war-res">' +
        kind +
        '</span><span class="pt-war-opp"><span><b><a href="' +
        playerHref(a.player.tag.slice(1)) +
        '">' +
        esc(a.player.name) +
        '</a></b><span>TH' +
        a.player.townhallLevel +
        ' &middot; #' +
        a.player.mapPosition +
        '</span></span></span><span class="pt-war-score"><b>' +
        stars(a.stars) +
        Math.round(a.destructionPercentage) +
        '%</b><span>' +
        mmss(a.duration) +
        '</span></span></li>'
      );
    };
    return (
      list
        .map(function (w, i) {
          var res = outcome(w.clan, w.opponent);
          var end = apiTime(w.endTime);
          var rows = w.attacks
            .map(function (a) {
              return hit('Attack', a);
            })
            .concat(
              w.defenses.map(function (a) {
                return hit('Defense', a);
              }),
            );
          return (
            '<section class="pt-group pt-ck-war is-' +
            res +
            '" id="ptWar' +
            i +
            '"' +
            (i >= WARS_SHOWN ? ' hidden' : '') +
            '><div class="pt-group-head"><h3><img src="' +
            w.opponent.badgeUrls.small +
            '" alt="" width="24" height="24" loading="lazy" />vs ' +
            esc(w.opponent.name) +
            '</h3><span><span class="pt-war-res">' +
            { win: 'Win', lose: 'Loss', tie: 'Draw' }[res] +
            '</span>' +
            (WAR_TYPE[w.type] || 'War') +
            ' &middot; ' +
            w.clan.stars +
            '&ndash;' +
            w.opponent.stars +
            (end ? ' &middot; ' + shortDay(end) : '') +
            '</span></div>' +
            (rows.length ? '<ul class="pt-ck-list">' + rows.join('') + '</ul>' : '<p class="pt-ck-none">No attacks used, none taken.</p>') +
            '</section>'
          );
        })
        .join('') +
      (list.length > WARS_SHOWN ? '<button type="button" class="th-soon-btn pt-ck-more">Show all ' + list.length + ' wars</button>' : '')
    );
  }

  // BATTLES: multiplayer attacks (battlesOf: the official log + ClashKing).
  // Each carries the army's Copy Army code, drawn as the army pages' card
  // (ArmySheet.html, army-sheet.js).
  var BATTLE_MODE = { legend: 'Legend', ranked: 'Ranked', homeVillage: 'Regular' };
  var LOOT = [
    ['gold', 'gold', 'Gold'],
    ['elixir', 'elixir', 'Elixir'],
    ['darkElixir', 'dark-elixir', 'Dark elixir'],
  ];

  var NO_BATTLES =
    '<p class="pt-empty">No battles found for this player. The game only keeps a player&rsquo;s recent battles, and ClashKing only logs older ones for players its bot follows.</p>';
  var BATTLE_SOURCE =
    '<p class="pt-source">Battles from the official Clash of Clans API (the game keeps about the last 50), plus older ones ClashKing&rsquo;s bot logged.</p>';

  // Attacks > Classic: the star strip, then every battle with its loot and army.
  // p: the player (their Town Hall now sets the sheet's slots and caps).
  function battlesView(pane, tag, p) {
    pane.innerHTML = skeleton('tab', 'Loading battles');
    Promise.all([battlesOf(tag), window.ArmySheet ? window.ArmySheet.load() : null]).then(
      function (r) {
        var list = r[0];
        if (!list.length) {
          pane.innerHTML = NO_BATTLES + BATTLE_SOURCE;
          return;
        }
        pane.innerHTML =
          starStrip(
            'Last ' + list.length + ' battles',
            list
              .map(function (b, i) {
                var t = new Date(b.battleTime);
                return {
                  stars: b.stars,
                  go: 'ptBattle' + i,
                  label:
                    shortDay(t) +
                    ' · ' +
                    (BATTLE_MODE[b.battleMode] || 'Battle') +
                    (b.opponent ? ' vs ' + b.opponent.name + ' (TH' + b.opponent.th + ')' : '') +
                    ' · ' +
                    b.stars +
                    ' stars, ' +
                    Math.round(b.destructionPercentage) +
                    '%',
                };
              })
              .reverse(),
          ) +
          '<ul class="pt-wars pt-ck-list">' +
          list
            .map(function (b, i) {
              return battleRow(b, p, i);
            })
            .join('') +
          '</ul>' +
          BATTLE_SOURCE;
        wireStrip(pane);
        if (window.ArmySheet) window.ArmySheet.wire(pane);
      },
      function () {
        pane.innerHTML = CK_FAIL;
      },
    );
  }

  // League emblems in place of a text pill: Legend League battles, and
  // ranked battles from the official log (recent, so the player's league
  // now is the league they were played in).
  function leagueIcon(src, name) {
    return '<img class="pt-ck-league" src="' + src + '" alt="' + esc(name) + '" title="' + esc(name) + '" width="36" height="36" />';
  }
  function battleRow(b, p, i) {
    var t = new Date(b.battleTime);
    var loot = b.lootedResources || {};
    var sheet = b.shareCode && window.ArmySheet ? window.ArmySheet.html(p.townHallLevel, b.shareCode) : '';
    var league = p.leagueTier || p.league;
    var badge =
      b.battleMode === 'legend'
        ? leagueIcon('/clashofclans/coctools/legend-league.png', 'Legend League')
        : b.api && b.battleMode === 'ranked' && league && league.iconUrls
          ? leagueIcon(league.iconUrls.small, 'Ranked · ' + league.name)
          : '<span class="pt-war-res">' + esc(BATTLE_MODE[b.battleMode] || b.battleMode || 'Battle') + '</span>';
    var opp = b.opponent;
    return (
      '<li class="pt-ck-row pt-ck-battle" id="ptBattle' +
      i +
      '">' +
      badge +
      '<span class="pt-war-opp"><span><b>' +
      stars(b.stars) +
      Math.round(b.destructionPercentage) +
      '%</b><span>' +
      (opp ? 'vs <a href="' + playerHref(opp.tag.slice(1)) + '">' + esc(opp.name) + '</a> TH' + opp.th + ' &middot; ' : '') +
      mmss(b.duration) +
      ' &middot; ' +
      shortDay(t) +
      ', ' +
      t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) +
      '</span></span></span><span class="pt-ck-loot">' +
      LOOT.map(function (l) {
        return loot[l[0]]
          ? '<span><img src="/clashofclans/articles/clan-games/' + l[1] + '.webp" alt="' + l[2] + '" width="16" height="16" />' + num(loot[l[0]]) + '</span>'
          : '';
      }).join('') +
      '</span>' +
      (sheet ? '<div class="has-sheet pt-ck-sheet">' + sheet + '</div>' : '') +
      '</li>'
    );
  }

  // CLANS: every clan ClashKing saw this player in, longest stay first.
  function loadClans(box, tag) {
    box.innerHTML = skeleton('tab', 'Loading clans');
    ck(tag + '/join-leave/totals').then(
      function (list) {
        if (!list.length) {
          box.innerHTML = '<p class="pt-empty">ClashKing hasn&rsquo;t seen this player in a clan yet.</p>' + ckSource('Clan history');
          return;
        }
        list.sort(function (a, b) {
          return b.minutes - a.minutes;
        });
        box.innerHTML =
          '<ul class="pt-wars pt-ck-list">' +
          list
            .map(function (c) {
              var m = c.minutes;
              return (
                '<li class="pt-ck-row"><span class="pt-war-opp"><span><b><a href="' +
                clanHref(c.clan.tag.slice(1)) +
                '">' +
                esc(c.clan.name) +
                '</a></b><span>' +
                esc(c.clan.tag) +
                ' &middot; ' +
                c.visits +
                (c.visits === 1 ? ' visit' : ' visits') +
                '</span></span></span><span class="pt-war-score"><b>' +
                Math.floor(m / 1440) +
                'd ' +
                Math.floor((m % 1440) / 60) +
                'h</b><span>in the clan</span></span><i class="pt-ck-bar"><i style="width:' +
                Math.max(1, (m / list[0].minutes) * 100) +
                '%"></i></i></li>'
              );
            })
            .join('') +
          '</ul>' +
          ckSource('Clan history');
      },
      function () {
        box.innerHTML = CK_FAIL;
      },
    );
  }

  // RAID WEEKENDS (clan page): the official API's last 10 Capital raid
  // weekends (Worker type=raids), one at a time with arrows: totals, then
  // members, the clans raided and the clans that raided us.
  function loadRaids(box, tag) {
    box.innerHTML = skeleton('tab', 'Loading raid weekends');
    api('type=raids&tag=' + tag).then(
      function (b) {
        var seasons = b.items || [];
        if (!seasons.length) {
          box.innerHTML = '<p class="pt-empty">This clan hasn&rsquo;t taken part in a raid weekend yet.</p>';
          return;
        }
        var at = 0;
        box.innerHTML =
          '<div class="pt-ck-season"><button type="button" class="th-soon-btn" data-step="1" aria-label="Older weekend">' +
          CHEV_LEFT +
          '</button><b aria-live="polite"></b>' +
          '<button type="button" class="th-soon-btn" data-step="-1" aria-label="Newer weekend">' +
          CHEV_RIGHT +
          '</button></div><div class="pt-ck-body"></div>' +
          '<p class="pt-source">From the official Clash of Clans API: the last ' +
          seasons.length +
          ' raid weekends. Attack medals are per attack, times the 6 attacks a member gets.</p>';
        var label = box.querySelector('.pt-ck-season b');
        var body = box.querySelector('.pt-ck-body');
        var steps = box.querySelectorAll('[data-step]');
        function show() {
          var s = seasons[at];
          var start = apiTime(s.startTime);
          var end = apiTime(s.endTime);
          label.innerHTML = (start ? shortDay(start) : '') + ' &ndash; ' + (end ? shortDay(end) : '') + (s.state === 'ongoing' ? ' <i>Live</i>' : '');
          steps[0].disabled = at === seasons.length - 1;
          steps[1].disabled = at === 0;
          body.innerHTML = raidView(s);
          wireSwitch(body, function (pane) {
            [].forEach.call(body.querySelectorAll('[data-pane]'), function (l) {
              l.hidden = l.dataset.pane !== pane;
            });
          });
        }
        [].forEach.call(steps, function (btn) {
          btn.addEventListener('click', function () {
            at += +btn.dataset.step;
            show();
          });
        });
        show();
      },
      function (err) {
        showTabError(box, err);
      },
    );
  }
  var CHEV_LEFT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var CHEV_RIGHT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  function showTabError(box, err) {
    box.innerHTML =
      '<p class="pt-empty">' +
      (MESSAGES[err.message] || 'This couldn&rsquo;t be loaded. Reload the page to try again.') +
      '</p>';
  }

  function raidView(s) {
    var members = (s.members || []).slice().sort(function (a, b) {
      return b.capitalResourcesLooted - a.capitalResourcesLooted;
    });
    var gold = '<img class="pt-ck-gold" src="/clashofclans/coctools/capital-gold.webp" alt="" width="16" height="16" />';
    var clanRow = function (c, other) {
      return (
        '<li class="pt-ck-row"><span class="pt-war-opp"><img src="' +
        c.badgeUrls.small +
        '" alt="" width="32" height="32" loading="lazy" /><span><b><a href="' +
        clanHref(c.tag.slice(1)) +
        '">' +
        esc(c.name) +
        '</a></b><span>Level ' +
        c.level +
        '</span></span></span><span class="pt-war-score"><b>' +
        other.districtsDestroyed +
        '<i>/' +
        other.districtCount +
        '</i></b><span>districts &middot; ' +
        other.attackCount +
        ' attacks</span></span></li>'
      );
    };
    var list = function (pane, rows, empty, hidden) {
      return (
        '<ul class="pt-wars pt-ck-list" data-pane="' +
        pane +
        '"' +
        (hidden ? ' hidden' : '') +
        '>' +
        (rows.length ? rows.join('') : '<li class="pt-ck-row pt-ck-none">' + empty + '</li>') +
        '</ul>'
      );
    };
    var ended = s.state !== 'ongoing';
    return (
      '<div class="pt-ck-facts">' +
      facts('Raids', [
        ['Capital gold', num(s.capitalTotalLoot)],
        ['Per attack', s.totalAttacks ? num(Math.round(s.capitalTotalLoot / s.totalAttacks)) : '&ndash;'],
        ['Raids done', s.raidsCompleted],
        ['Attacks', s.totalAttacks],
        ['Districts', s.enemyDistrictsDestroyed],
      ]) +
      facts('Medals', [
        ['Attack', ended && s.offensiveReward ? num(s.offensiveReward * 6) + ' <i>' + s.offensiveReward + ' &times; 6</i>' : '&ndash;'],
        ['Defense', ended && s.defensiveReward ? num(s.defensiveReward) : '&ndash;'],
      ]) +
      '</div>' +
      switchKeys('Raid details', [
        ['members', 'Members'],
        ['raids', 'Raids'],
        ['defenses', 'Defenses'],
      ]) +
      list(
        'members',
        members.map(function (m, i) {
          return (
            '<li class="pt-ck-row"><span class="pt-ck-rank">' +
            (i + 1) +
            '</span><span class="pt-war-opp"><span><b><a href="' +
            playerHref(m.tag.slice(1)) +
            '">' +
            esc(m.name) +
            '</a></b><span>' +
            m.attacks +
            '/' +
            (m.attackLimit + m.bonusAttackLimit) +
            ' attacks</span></span></span><span class="pt-war-score"><b>' +
            gold +
            num(m.capitalResourcesLooted) +
            '</b></span></li>'
          );
        }),
        'Nobody has attacked yet.',
      ) +
      list(
        'raids',
        (s.attackLog || []).map(function (r) {
          return clanRow(r.defender, r);
        }),
        'No clans raided yet.',
        true,
      ) +
      list(
        'defenses',
        (s.defenseLog || []).map(function (r) {
          return clanRow(r.attacker, r);
        }),
        'No clan has raided this one yet.',
        true,
      )
    );
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
    var played = [];
    log.forEach(function (w, i) {
      if (w.result) played.unshift({ w: w, i: i }); // oldest first
    });
    return (
      (played.length
        ? starStrip(
            'Last ' + played.length + ' wars',
            played.map(function (x) {
              var d = apiTime(x.w.endTime);
              return {
                stars: { win: 3, lose: 1, tie: 0 }[x.w.result],
                go: 'ptLog' + x.i,
                label:
                  (d ? shortDay(d) + ' · ' : '') +
                  { win: 'Win', lose: 'Loss', tie: 'Draw' }[x.w.result] +
                  ' vs ' +
                  x.w.opponent.name +
                  ' · ' +
                  x.w.clan.stars +
                  '–' +
                  x.w.opponent.stars,
              };
            }),
            [
              [3, 'Win'],
              [1, 'Loss'],
              [0, 'Draw'],
            ],
          )
        : '') +
      '<ul class="pt-wars">' +
      log
        .map(function (w, i) {
          var cwl = !w.result; // Clan War League weeks come without a result or an opponent
          var res = cwl ? 'cwl' : w.result;
          var day = /^(\d{4})(\d{2})(\d{2})/.exec(w.endTime || '');
          var date = day ? new Date(Date.UTC(+day[1], +day[2] - 1, +day[3], 12)) : null;
          return (
            '<li class="pt-war is-' +
            res +
            '" id="ptLog' +
            i +
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

  // The matchup card's comparison rows. Each bar is split down the middle:
  // ours grows left from the centre, theirs right, both against the same
  // ceiling (`max`), and the side ahead is drawn brighter.
  function mmss(sec) {
    if (sec == null) return '&ndash;';
    sec = Math.round(sec);
    return Math.floor(sec / 60) + 'm ' + String(sec % 60).padStart(2, '0') + 's';
  }
  function muBar(label, a, b, max, fmt) {
    var w = function (v) {
      return max ? Math.min(100, (v / max) * 100) : 0;
    };
    var lead = a === b ? '' : a > b ? ' is-us-ahead' : ' is-them-ahead';
    return (
      '<li class="pt-mu-row' +
      lead +
      '"><span class="pt-mu-v">' +
      fmt(a) +
      '</span><span class="pt-mu-label">' +
      label +
      '</span><span class="pt-mu-v">' +
      fmt(b) +
      '</span>' +
      (max
        ? '<span class="pt-mu-bars" aria-hidden="true"><span class="pt-mu-bar"><i style="width:' +
          w(a).toFixed(1) +
          '%"></i></span><span class="pt-mu-bar"><i style="width:' +
          w(b).toFixed(1) +
          '%"></i></span></span>'
        : '') +
      '</li>'
    );
  }

  // Town Halls in a line-up, highest first: [[18, 5], [17, 2], ...]
  function thMix(side) {
    var n = {};
    side.members.forEach(function (m) {
      n[m.townhallLevel] = (n[m.townhallLevel] || 0) + 1;
    });
    return Object.keys(n)
      .map(Number)
      .sort(function (x, y) {
        return y - x;
      })
      .map(function (th) {
        return [th, n[th]];
      });
  }
  function thMixHtml(side, data) {
    return thMix(side)
      .map(function (p) {
        var icon = thIcon(p[0], data);
        return (
          '<span class="pt-mu-th" title="Town Hall ' +
          p[0] +
          '">' +
          (icon ? '<img src="' + icon + '" alt="" width="22" height="22" loading="lazy" />' : '') +
          '<b>TH' +
          p[0] +
          '</b><i>&times;' +
          p[1] +
          '</i></span>'
        );
      })
      .join('');
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
    var team = function (c, cls) {
      return (
        '<div class="pt-mu-team ' +
        cls +
        '"><img src="' +
        c.badgeUrls.small +
        '" alt="" width="44" height="44" /><span><b>' +
        esc(c.name) +
        '</b><i>Level ' +
        c.clanLevel +
        '</i></span></div>'
      );
    };
    var rows = '';
    if (live) {
      var a = attackStats(us);
      var b = attackStats(them);
      var int = function (v) {
        return String(v);
      };
      var pc = function (v) {
        return v.toFixed(1) + '%';
      };
      rows =
        '<ul class="pt-mu-rows">' +
        muBar('Stars <small>of ' + w.teamSize * 3 + '</small>', us.stars, them.stars, w.teamSize * 3, int) +
        muBar('Destruction', us.destructionPercentage, them.destructionPercentage, 100, pc) +
        muBar('Attacks used <small>of ' + total + '</small>', a.n, b.n, total, int) +
        muBar('3-star attacks', a.by[3], b.by[3], Math.max(a.n, b.n, 1), int) +
        muBar(
          'Avg. stars',
          a.stars,
          b.stars,
          3,
          function (v) {
            return v ? v.toFixed(2) : '&ndash;';
          },
        ) +
        muBar('Avg. destruction', a.dest, b.dest, 100, function (v) {
          return v ? v.toFixed(1) + '%' : '&ndash;';
        }) +
        '<li class="pt-mu-row is-text"><span class="pt-mu-v">' +
        [3, 2, 1, 0]
          .map(function (k) {
            return a.by[k];
          })
          .join(' &middot; ') +
        '</span><span class="pt-mu-label">3&#9733; &middot; 2&#9733; &middot; 1&#9733; &middot; 0&#9733;</span><span class="pt-mu-v">' +
        [3, 2, 1, 0]
          .map(function (k) {
            return b.by[k];
          })
          .join(' &middot; ') +
        '</span></li>' +
        '<li class="pt-mu-row is-text"><span class="pt-mu-v">' +
        mmss(a.dur) +
        '</span><span class="pt-mu-label">Avg. attack time</span><span class="pt-mu-v">' +
        mmss(b.dur) +
        '</span></li></ul>';
    }
    return (
      '<section class="pt-mu is-' +
      (w.state === 'warEnded' ? outcome(us, them) : w.state) +
      '"><header class="pt-mu-head"><p class="pt-mu-state">' +
      warStatus(w, us, them) +
      '</p><span class="pt-mu-size">' +
      w.teamSize +
      ' v ' +
      w.teamSize +
      '</span></header><div class="pt-mu-teams">' +
      team(us, 'is-us') +
      (live
        ? '<b class="pt-mu-score">' + us.stars + '<i>&ndash;</i>' + them.stars + '</b>'
        : '<b class="pt-mu-score is-vs">vs</b>') +
      team(them, 'is-them') +
      '</div>' +
      rows +
      '<div class="pt-mu-lineup"><h4>Line-up</h4><div class="pt-mu-ths">' +
      thMixHtml(us, data) +
      '</div><div class="pt-mu-ths is-them">' +
      thMixHtml(them, data) +
      '</div></div></section>' +
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
    wireSwitch(box, function (side) {
      [].forEach.call(box.querySelectorAll('.pt-wms'), function (l) {
        l.hidden = l.dataset.side !== side;
      });
    });
  }

  // A row of switch keys (.pt-war-sides look). opts: [[value, label], ...];
  // the first is picked. wireSwitch calls fn(value) on each pick.
  function switchKeys(label, opts) {
    return (
      '<div class="pt-war-sides" role="tablist" aria-label="' +
      label +
      '">' +
      opts
        .map(function (o, i) {
          return (
            '<button type="button" role="tab" aria-selected="' +
            !i +
            '"' +
            (i ? ' tabindex="-1"' : '') +
            ' data-side="' +
            o[0] +
            '">' +
            o[1] +
            '</button>'
          );
        })
        .join('') +
      '</div>'
    );
  }
  function wireSwitch(box, fn) {
    var btns = [].slice.call(box.querySelectorAll('.pt-war-sides button'));
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) {
          x.setAttribute('aria-selected', x === b);
          x.tabIndex = x === b ? 0 : -1;
        });
        fn(b.dataset.side);
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

  // Star race: each clan's stars as a bar against the leader's, so the gaps
  // read at a glance. Promotion / demotion places colour the rank chip
  // (legend in the header) instead of dividing lines.
  function standingsTable(rows, ourTag, league) {
    var z = cwlZones(league, rows.length);
    var top = rows.length ? rows[0].stars : 0;
    var count = function (r, kind) {
      return r.days.filter(function (d) {
        return d === kind;
      }).length;
    };
    return (
      '<section class="pt-group pt-race"><div class="pt-group-head"><h3>League standings</h3><span>' +
      (league ? esc(league) + ' &middot; ' : '') +
      '+10 stars per war won</span></div>' +
      (z && (z.up || z.down)
        ? '<p class="pt-race-key">' +
          (z.up ? '<span class="is-up">Promotion</span>' : '') +
          (z.down ? '<span class="is-down">Demotion</span>' : '') +
          '</p>'
        : '') +
      '<ol>' +
      rows
        .map(function (r, i) {
          var zone = z && i < z.up ? ' is-up' : z && z.down && i >= rows.length - z.down ? ' is-down' : '';
          var tie = count(r, 'tie');
          return (
            '<li class="' +
            (r.clan.tag === ourTag ? 'is-us' : '') +
            '"><span class="pt-race-rank' +
            zone +
            '">' +
            (i + 1) +
            '</span><img src="' +
            r.clan.badgeUrls.small +
            '" alt="" width="34" height="34" loading="lazy" /><span class="pt-race-main"><a href="' +
            clanHref(r.clan.tag.slice(1)) +
            '">' +
            esc(r.clan.name) +
            '</a><span class="pt-race-track" aria-hidden="true"><i style="width:' +
            (top ? Math.max(2, (r.stars / top) * 100) : 2).toFixed(1) +
            '%"></i></span><span class="pt-race-meta">' +
            count(r, 'win') +
            'W ' +
            (tie ? tie + 'D ' : '') +
            count(r, 'lose') +
            'L &middot; ' +
            Math.round(r.dest).toLocaleString('en-US') +
            '% destruction' +
            '</span></span><b class="pt-race-stars">' +
            r.stars +
            STAR_SVG +
            '<span class="pt-sr"> stars</span></b></li>'
          );
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
    box.innerHTML = skeleton('tab', 'Loading Clan War League');
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
    box.innerHTML = skeleton('tab', 'Loading the war');
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
    box.innerHTML = skeleton('tab', 'Loading history');
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

  // The war card under the clan header: both clans, the score (or the
  // line-up in preparation), the time left and View war.
  var STAR_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
  function liveBanner(box, c, onView) {
    liveWar(c).then(function (f) {
      if (!f) return;
      var w = f.w;
      var s = sides(w, c.tag);
      var prep = w.state === 'preparation';
      var live = w.state === 'inWar';
      function team(t, cls) {
        return (
          '<div class="pt-live-team ' +
          cls +
          '"><img src="' +
          t.badgeUrls.medium +
          '" alt="" width="72" height="72" /><b>' +
          esc(t.name) +
          '</b><span>' +
          (prep ? 'Level ' + t.clanLevel : t.attacks + ' of ' + w.teamSize * (w.attacksPerMember || 1) + ' attacks') +
          '</span></div>'
        );
      }
      box.innerHTML =
        '<section class="pt-live' +
        (prep ? ' is-prep' : live ? ' is-battle' : '') +
        '" aria-label="Current war">' +
        '<p class="pt-live-top"><span class="pt-live-dot" aria-hidden="true"></span><b>' +
        f.label +
        ' &middot; ' +
        (prep ? 'Preparation' : live ? 'Battle day' : 'Ended') +
        '</b><span class="pt-live-time">' +
        (prep
          ? 'Battles start in <em>' + timeLeft(apiTime(w.startTime) - Date.now()) + '</em>'
          : live
            ? 'Ends in <em>' + timeLeft(apiTime(w.endTime) - Date.now()) + '</em>'
            : '') +
        '</span></p>' +
        team(s[0], 'is-us') +
        '<div class="pt-live-mid">' +
        (prep
          ? '<b class="pt-live-score">' + w.teamSize + '<i>v</i>' + w.teamSize + '</b><span>Line-up locked</span>'
          : '<b class="pt-live-score">' +
            STAR_SVG +
            s[0].stars +
            '<i>&ndash;</i>' +
            s[1].stars +
            STAR_SVG +
            '</b><span>' +
            s[0].destructionPercentage.toFixed(1) +
            '% &ndash; ' +
            s[1].destructionPercentage.toFixed(1) +
            '%</span>') +
        '</div>' +
        team(s[1], 'is-them') +
        '<button type="button" class="pt-live-cta">View war<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg></button>' +
        '</section>';
      box.querySelector('.pt-live-cta').addEventListener('click', onView);
    });
  }

  // Above the members table: the clan's Town Hall line-up and this
  // season's donations, summed over the members.
  function clanGlance(members, data) {
    var sum = function (k) {
      return members.reduce(function (t, m) {
        return t + (m[k] || 0);
      }, 0);
    };
    return (
      '<section class="pt-group pt-glance"><div class="pt-group-head"><h3>Town Hall mix</h3><span>Average TH ' +
      (sum('townHallLevel') / members.length).toFixed(1) +
      '</span></div><div class="pt-mu-ths">' +
      thMixHtml(
        {
          members: members.map(function (m) {
            return { townhallLevel: m.townHallLevel };
          }),
        },
        data,
      ) +
      '</div><div class="pt-ck-facts">' +
      facts('This season', [
        ['Donated', num(sum('donations'))],
        ['Received', num(sum('donationsReceived'))],
        ['Avg trophies', num(Math.round(sum('trophies') / members.length))],
        ['Builder trophies', num(Math.round(sum('builderBaseTrophies') / members.length)) + '<i> avg</i>'],
      ]) +
      '</div></section>'
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
      quickSearch('clan') +
      '<header class="pt-head pt-head--clan">' +
      '<div class="pt-th"><div class="pt-plinth"><img src="' +
      c.badgeUrls.large +
      '" alt="" width="112" height="112" /></div><span>Level ' +
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
      '<div class="pt-head-facts pt-wellfacts">' +
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
          ['War frequency', WAR_FREQ[c.warFrequency] || 'Not set'],
        ].filter(Boolean),
      ) +
      facts('Requirements', [
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
      '<button type="button" role="tab" id="ptTabRaids" aria-controls="ptPanelRaids" aria-selected="false" tabindex="-1">Raid weekends</button>' +
      '</div>' +
      '<div class="pt-panel" id="ptPanelMembers" role="tabpanel" aria-labelledby="ptTabMembers">' +
      (members.length ? clanGlance(members, data) + membersTable(members, data) : '<p class="pt-empty">This clan has no members.</p>') +
      '</div>' +
      '<div class="pt-panel" id="ptPanelWar" role="tabpanel" aria-labelledby="ptTabWar" hidden></div>' +
      '<div class="pt-panel" id="ptPanelHist" role="tabpanel" aria-labelledby="ptTabHist" hidden></div>' +
      '<div class="pt-panel" id="ptPanelWars" role="tabpanel" aria-labelledby="ptTabWars" hidden>' +
      warLog(log) +
      '</div>' +
      '<div class="pt-panel" id="ptPanelRaids" role="tabpanel" aria-labelledby="ptTabRaids" hidden></div>' +
      '<p class="pt-source">Live data from the official Clash of Clans API, refreshed every 5 minutes. Donations count this season only. Tap a heading to sort the members.</p>';

    wireTabs(root);
    wireCopy(root);
    wireQuick(root);
    if (members.length) wireSort(root, members, data);
    wireStrip(root.querySelector('#ptPanelWars'));
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
    onFirstOpen(root.querySelector('#ptTabRaids'), function () {
      loadRaids(root.querySelector('#ptPanelRaids'), tag);
    });
    liveBanner(
      root.querySelector('#ptLive'),
      c,
      function () {
        warTab.click();
        root.querySelector('.pt-tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    );
    initTrack(root.querySelector('#ptTrack'), c.tag.slice(1), function () {
      if (histLoaded) loadHistory(histBox, c, data);
    });
  }

  function loadClan(root, tag) {
    root.innerHTML = skeleton('clan', 'Loading clan #' + tag);
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
