/* Legend Tracker (Oct 25 2026): /coc/tools/legend-tracker[?tag=<TAG>].
   A Legend League player's day: every attack and defense with the trophies
   it won or lost, the day's net, the last 28 days, and a watch list.

   Data:
   - The official API through our Worker (cloudflare/coc-api/worker.js):
     the player (name, trophies, league, rank) and, as a fallback, the battle
     log (battleType "legend", but no trophies per hit).
   - ClashKing's public API (api.clashk.ing: no key, CORS *), straight from
     the browser like the Player Tracker's history tabs:
       v2/player/%23TAG/legend/series          daily net, last 28 days
       v2/player/%23TAG/legend/<day>/battlelog one day's hits, trophies each
       POST v2/legends/days {day, tags[<=100]}  one day's totals, many players
     A player ClashKing doesn't follow comes back as all zeros, not a 404.
   A Legend day runs 05:00 to 05:00 UTC and is named after the UTC date it
   starts on (ClashKing's "day"). Absolute trophies are only shown for today
   (now minus today's net): going further back would cross a season reset
   we can't see, so older days show net changes only.
   Styles: coc-legends.css. */
(function () {
  'use strict';

  var API = 'https://parchrome-coc.adriantulabut5747.workers.dev/api/coc';
  var CK = 'https://api.clashk.ing/v2/';
  var WATCH_KEY = 'lg-watch';
  var RECENT_KEY = 'lg-recent';
  var LEGEND_LEAGUE = 29000022; // the official league id of the Legend League
  var HITS_A_DAY = 8;
  var DAY_MS = 864e5;

  var app = document.getElementById('lgView');
  var form = document.getElementById('lgForm');
  if (!app || !form) return;
  var input = document.getElementById('lgTag');
  var msg = document.getElementById('lgMsg');
  var quick = document.getElementById('lgQuick');

  /* ---------------------------------------------------------------- helpers */
  // Same rules as cleanTag in the Worker: "#abc o" -> "ABC0", null if not a tag.
  function cleanTag(raw) {
    var t = String(raw || '')
      .toUpperCase()
      .replace(/O/g, '0')
      .replace(/[^0-9A-Z]/g, '');
    return /^[0289PYLQGRJCUV]{3,12}$/.test(t) ? t : null;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(n) {
    return (n || 0).toLocaleString('en-US');
  }
  function signed(n) {
    return n > 0 ? '+' + num(n) : n < 0 ? '&minus;' + num(-n) : '0';
  }
  function tone(n) {
    return n > 0 ? 'is-up' : n < 0 ? 'is-down' : 'is-flat';
  }
  function mmss(sec) {
    sec = sec || 0;
    return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
  }
  function thIcon(th) {
    return th >= 4 ? '/icons/th' + th + 'icon.' + (th === 18 ? 'png' : 'webp') : '';
  }
  function stars(n) {
    var s = '';
    for (var i = 0; i < 3; i++)
      s +=
        '<svg viewBox="0 0 24 24" class="' +
        (i < n ? 'on' : '') +
        '" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
    return '<span class="lg-stars" role="img" aria-label="' + n + ' of 3 stars">' + s + '</span>';
  }
  function read(key) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }
  function write(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {}
  }

  // The Legend day an instant belongs to: "2026-10-24" runs from
  // Oct 24 05:00 UTC to Oct 25 05:00 UTC.
  function legendDay(ms) {
    return new Date(ms - 5 * 36e5).toISOString().slice(0, 10);
  }
  function dayStart(day) {
    return Date.parse(day + 'T05:00:00Z');
  }
  function nextReset() {
    return dayStart(legendDay(Date.now())) + DAY_MS;
  }
  function dayName(day) {
    var today = legendDay(Date.now());
    if (day === today) return 'Today';
    if (day === legendDay(Date.now() - DAY_MS)) return 'Yesterday';
    return new Date(day + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  function shortDate(day) {
    return new Date(day + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  function clock(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    return h + 'h ' + ('0' + m).slice(-2) + 'm ' + ('0' + (s % 60)).slice(-2) + 's';
  }

  /* -------------------------------------------------------------- requests */
  // GET the Worker; rejects with Error('notFound' | 'maintenance' | 'other').
  function api(query) {
    return fetch(API + '?' + query).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) throw new Error(body.error === 'notFound' || body.error === 'maintenance' ? body.error : 'other');
        return body;
      });
    });
  }
  function ck(path, body) {
    var opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined;
    return fetch(CK + path, opt).then(function (res) {
      if (!res.ok) throw new Error('ck');
      return res.json();
    });
  }
  // One day's totals for many players at once (watch list, world top 10).
  function dayTotals(day, tags) {
    if (!tags.length) return Promise.resolve({});
    return ck('legends/days', { day: day, tags: tags.slice(0, 100) }).then(function (r) {
      var by = {};
      (r.items || []).forEach(function (x) {
        by[x.tag] = x;
      });
      return by;
    });
  }

  /* ---------------------------------------------------------- reset clock */
  var clockEl = document.getElementById('lgClock');
  function tick() {
    if (clockEl) clockEl.innerHTML = 'Legend day resets in <b>' + clock(nextReset() - Date.now()) + '</b>';
    var live = app.querySelector('[data-reset]');
    if (live) live.textContent = clock(nextReset() - Date.now());
  }
  tick();
  setInterval(tick, 1000);

  /* --------------------------------------------------- watch list + recent */
  function watched(tag) {
    return read(WATCH_KEY).some(function (w) {
      return w.tag === tag;
    });
  }
  function toggleWatch(p) {
    var tag = p.tag.slice(1);
    var list = read(WATCH_KEY);
    if (watched(tag))
      list = list.filter(function (w) {
        return w.tag !== tag;
      });
    else list.unshift({ tag: tag, name: p.name, th: p.townHallLevel });
    write(WATCH_KEY, list.slice(0, 20));
    drawQuick();
    return watched(tag);
  }
  function saveRecent(p) {
    var tag = p.tag.slice(1);
    var list = read(RECENT_KEY).filter(function (r) {
      return r.tag !== tag;
    });
    list.unshift({ tag: tag, name: p.name, th: p.townHallLevel });
    write(RECENT_KEY, list.slice(0, 6));
    drawQuick();
  }
  // Under the search: recently tracked players as chips.
  function drawQuick() {
    var recent = read(RECENT_KEY);
    quick.hidden = !recent.length;
    quick.innerHTML = recent.length
      ? '<span class="lg-quick-label">Recent</span>' +
        recent
          .map(function (r) {
            return (
              '<a class="lg-chip" href="?tag=' +
              r.tag +
              '" data-tag="' +
              r.tag +
              '">' +
              (thIcon(r.th) ? '<img src="' + thIcon(r.th) + '" alt="" width="20" height="20" />' : '') +
              esc(r.name) +
              '</a>'
            );
          })
          .join('')
      : '';
  }

  /* --------------------------------------------------------------- routing */
  function tagInAddress() {
    return cleanTag(new URLSearchParams(location.search).get('tag'));
  }
  function go(tag, push) {
    if (push) history.pushState(null, '', tag ? '?tag=' + tag : location.pathname);
    route();
  }
  function route() {
    clearTimeout(refreshTimer);
    var tag = tagInAddress();
    if (tag) {
      input.value = tag;
      loadPlayer(tag);
    } else {
      input.value = '';
      document.title = 'Legend Tracker: Clash of Clans Legend League Days | Parchrome';
      drawBoard();
    }
  }
  window.addEventListener('popstate', route);

  function say(text) {
    msg.hidden = !text;
    msg.textContent = text || '';
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var tag = cleanTag(input.value);
    if (!tag) return say('That isn’t a player tag. Tags use only 0 2 8 9 P Y L Q G R J C U V.');
    say('');
    input.blur();
    go(tag, true);
  });
  // Every in-app player link (chips, board rows, opponents) opens here, without a reload.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-tag]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    go(a.dataset.tag, true);
    var top = document.getElementById('lgFind');
    if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ------------------------------------------------------------ the board */
  // No tag: the world's top 10 from the weekly leaderboard file (the same
  // one /coc/tools/leaderboards shows), with today's Legend day from
  // ClashKing, plus the watch list. One request each.
  function boardRows(players, totals) {
    return players
      .map(function (p, i) {
        var t = totals['#' + p.tag] || null;
        var atk = t ? t.attacks : 0;
        var def = t ? t.defenses : 0;
        return (
          '<li><a class="lg-row" href="?tag=' +
          p.tag +
          '" data-tag="' +
          p.tag +
          '">' +
          (p.rank ? '<span class="lg-row-rank">' + p.rank + '</span>' : '') +
          '<span class="lg-row-who"><b>' +
          esc(p.name) +
          '</b><span>' +
          (p.clan ? esc(p.clan) : '#' + p.tag) +
          '</span></span>' +
          '<span class="lg-row-pips" aria-label="' +
          atk +
          ' of 8 attacks, ' +
          def +
          ' of 8 defenses">' +
          pips(atk, 'atk') +
          pips(def, 'def') +
          '</span><span class="lg-row-net ' +
          (t ? tone(t.netTrophies) : '') +
          '">' +
          (t ? signed(t.netTrophies) : '&ndash;') +
          '</span></a></li>'
        );
      })
      .join('');
  }
  function pips(n, kind) {
    var s = '<span class="lg-pips lg-pips--' + kind + '">';
    for (var i = 0; i < HITS_A_DAY; i++) s += '<i' + (i < n ? ' class="on"' : '') + '></i>';
    return s + '</span>';
  }
  var boardToken = 0;
  function drawBoard() {
    var token = ++boardToken;
    var today = legendDay(Date.now());
    var watch = read(WATCH_KEY);
    app.innerHTML =
      (watch.length
        ? '<section class="am lg-board" aria-labelledby="lgWatchTitle"><header class="am-head"><div><h2 class="am-title" id="lgWatchTitle">Your watch list</h2><p class="am-intro">Today&rsquo;s Legend day for the players you watch. Saved on this device.</p></div></header><div class="am-part"><ol class="lg-rows" id="lgWatchRows">' +
          skeletonRows(Math.min(watch.length, 5)) +
          '</ol></div></section>'
        : '') +
      '<section class="am lg-board" aria-labelledby="lgTopTitle"><header class="am-head"><div><h2 class="am-title" id="lgTopTitle">The world&rsquo;s top 10, today</h2><p class="am-intro">Ranked by this week&rsquo;s world leaderboard. Bars show today&rsquo;s attacks (top) and defenses (bottom); the number is today&rsquo;s net.</p></div></header><div class="am-part"><ol class="lg-rows" id="lgTopRows">' +
      skeletonRows(10) +
      '</ol></div></section>';

    if (watch.length) {
      dayTotals(today, watch.map((w) => '#' + w.tag)).then(
        function (totals) {
          if (token !== boardToken) return;
          document.getElementById('lgWatchRows').innerHTML = boardRows(watch, totals);
        },
        function () {
          if (token !== boardToken) return;
          document.getElementById('lgWatchRows').innerHTML = boardRows(watch, {});
        },
      );
    }
    fetch('/coc-lobby-stats.json')
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        var top = ((d.rankings && d.rankings.globalPlayers) || []).slice(0, 10).map(function (p) {
          return { tag: p.tag.slice(1), name: p.name, clan: p.clan, rank: p.rank };
        });
        return dayTotals(
          today,
          top.map(function (p) {
            return '#' + p.tag;
          }),
        ).then(
          function (totals) {
            return [top, totals];
          },
          function () {
            return [top, {}];
          },
        );
      })
      .then(
        function (r) {
          if (token !== boardToken) return;
          document.getElementById('lgTopRows').innerHTML = boardRows(r[0], r[1]);
        },
        function () {
          if (token !== boardToken) return;
          document.getElementById('lgTopRows').innerHTML = '<li class="lg-empty">The leaderboard couldn&rsquo;t be loaded. Reload the page to try again.</li>';
        },
      );
  }
  function skeletonRows(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += '<li><span class="lg-row is-skel"><i></i><i></i><i></i></span></li>';
    return s;
  }

  /* ---------------------------------------------------------- the player */
  var state = null; // { p, series, days: {day: dayData}, pick, official }
  var refreshTimer = 0;
  var playerToken = 0;

  function loadPlayer(tag) {
    var token = ++playerToken;
    app.innerHTML = '<section class="am lg-loading" aria-busy="true"><div class="lg-skel-head"></div><div class="lg-skel-lanes"><i></i><i></i></div><p>Loading the Legend day&hellip;</p></section>';
    var today = legendDay(Date.now());
    var none = function () {
      return null;
    };
    Promise.all([
      api('type=player&tag=' + tag),
      ck('player/%23' + tag + '/legend/series').then(null, none),
      ck('player/%23' + tag + '/legend/' + today + '/battlelog').then(null, none),
      window.ArmySheet ? window.ArmySheet.load().then(null, none) : null,
    ]).then(
      function (r) {
        if (token !== playerToken) return;
        var p = r[0];
        document.title = p.name + ' · Legend Tracker | Parchrome';
        saveRecent(p);
        if (!inLegends(p)) return drawNotLegend(p);
        var series = (r[1] && r[1].items) || [];
        var days = {};
        if (r[2]) days[today] = r[2];
        state = { p: p, series: series, days: days, pick: today, official: null, ckDown: !r[1] && !r[2] };
        var tracked =
          (r[2] && (r[2].attacks.length || r[2].defenses.length)) ||
          series.some(function (d) {
            return d.attackTrophies || d.defenseTrophies;
          });
        if (tracked) return drawPlayer();
        // ClashKing has nothing (or is down): the official battle log still
        // has the last ~50 battles, Legend ones marked, without trophies.
        return api('type=battlelog&tag=' + tag).then(
          function (b) {
            if (token !== playerToken) return;
            state.official = officialDays(b.items || []);
            drawPlayer();
          },
          function () {
            if (token !== playerToken) return;
            state.official = {};
            drawPlayer();
          },
        );
      },
      function (err) {
        if (token !== playerToken) return;
        var text =
          err.message === 'notFound'
            ? 'No player has the tag #' + tag + '. Check it in game: tap the player&rsquo;s name, the tag is under it.'
            : err.message === 'maintenance'
              ? 'Clash of Clans is in maintenance, so the game&rsquo;s data can&rsquo;t be reached. Try again when it&rsquo;s over.'
              : 'The player couldn&rsquo;t be loaded. Check your connection and try again.';
        app.innerHTML = '<section class="am lg-state"><p>' + text + '</p><button type="button" class="am-btn" data-retry>Try again</button></section>';
        app.querySelector('[data-retry]').addEventListener('click', function () {
          loadPlayer(tag);
        });
      },
    );
  }
  function inLegends(p) {
    return !!(p.league && p.league.id === LEGEND_LEAGUE);
  }

  // Official battle log -> { day: {attacks, defenses} } in ClashKing's shape
  // (trophies null: the official log doesn't have them).
  function officialDays(items) {
    var out = {};
    items.forEach(function (b) {
      if (b.battleType !== 'legend') return;
      var m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(b.battleTimestamp || '');
      if (!m) return;
      var t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
      var day = legendDay(t);
      var d = out[day] || (out[day] = { day: day, attacks: [], defenses: [], official: true });
      (b.attack ? d.attacks : d.defenses).push({
        time: new Date(t).toISOString(),
        opponent: { tag: b.opponentPlayerTag, name: b.opponentName, townHallLevel: b.opponentTownHallLevel },
        stars: b.stars,
        destructionPercentage: b.destructionPercentage,
        duration: b.battleTime,
        shareCode: b.armyShareCode,
        trophies: null,
      });
    });
    return out;
  }

  function drawNotLegend(p) {
    var tier = p.leagueTier;
    app.innerHTML =
      headHtml(p, null) +
      '<section class="am lg-state lg-state--wide"><h2 class="am-title">Not in the Legend League</h2><p>' +
      esc(p.name) +
      ' is ' +
      (tier ? 'in <b>' + esc(tier.name) + '</b>' : 'not in a league') +
      ' right now, not the Legend League, so there are no Legend days to track. Attacks and defenses show up here from the day they reach it.</p><a class="am-btn" href="/coc/player/' +
      p.tag.slice(1) +
      '">Open their full profile</a></section>';
    wireHead(p);
  }

  /* ---- header: emblem, name, trophies, keys ---- */
  function headHtml(p, todayNet) {
    var tier = p.leagueTier;
    var ls = p.legendStatistics || {};
    var rank = ls.currentSeason && ls.currentSeason.rank;
    var emblem = tier && tier.iconUrls ? tier.iconUrls.large || tier.iconUrls.small : '/icons/legend-tracker.webp';
    var on = watched(p.tag.slice(1));
    return (
      '<section class="lg-head" aria-label="Player">' +
      '<div class="lg-emblem"><img src="' +
      emblem +
      '" alt="' +
      esc(tier ? tier.name : 'League') +
      '" width="112" height="112" /></div>' +
      '<div class="lg-who"><h2 class="lg-name">' +
      esc(p.name) +
      '</h2><p class="lg-meta"><span class="lg-tag">#' +
      p.tag.slice(1) +
      '</span>' +
      (thIcon(p.townHallLevel) ? '<img src="' + thIcon(p.townHallLevel) + '" alt="" width="22" height="22" />' : '') +
      'TH' +
      p.townHallLevel +
      (p.clan ? ' &middot; <a href="/coc/clan/' + p.clan.tag.slice(1) + '">' + esc(p.clan.name) + '</a>' : '') +
      '</p><div class="lg-keys">' +
      '<button type="button" class="am-btn lg-watch" aria-pressed="' +
      on +
      '"><svg class="am-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg><span>' +
      (on ? 'Watching' : 'Watch') +
      '</span></button>' +
      '<button type="button" class="am-btn lg-share"><svg class="am-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg><span>Share</span></button>' +
      '<a class="am-btn" href="/coc/player/' +
      p.tag.slice(1) +
      '">Full profile</a></div></div>' +
      '<div class="lg-cup"><span class="lg-cup-label">Trophies</span><b class="lg-cup-num"><img src="/clashofclans/coctools/legend-league.png" alt="" width="26" height="27" />' +
      num(p.trophies) +
      '</b>' +
      (todayNet != null ? '<span class="lg-cup-sub ' + tone(todayNet) + '">' + signed(todayNet) + ' today</span>' : '') +
      (rank ? '<span class="lg-cup-rank">World #' + num(rank) + '</span>' : '') +
      '</div></section>'
    );
  }
  function wireHead(p) {
    var w = app.querySelector('.lg-watch');
    if (w)
      w.addEventListener('click', function () {
        var on = toggleWatch(p);
        w.setAttribute('aria-pressed', on);
        w.querySelector('span').textContent = on ? 'Watching' : 'Watch';
      });
    var s = app.querySelector('.lg-share');
    if (s)
      s.addEventListener('click', function () {
        var url = location.origin + location.pathname + '?tag=' + p.tag.slice(1);
        var done = function () {
          s.querySelector('span').textContent = 'Link copied';
          setTimeout(function () {
            s.querySelector('span').textContent = 'Share';
          }, 1800);
        };
        if (navigator.share && matchMedia('(pointer: coarse)').matches)
          navigator.share({ title: p.name + ' · Legend Tracker', url: url }).catch(function () {});
        else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () {});
      });
  }

  /* ---- the day ---- */
  // Days the picker offers: ClashKing's 28 + today (its series stops at
  // yesterday), or with only the official log, the days it covers.
  function dayList() {
    var today = legendDay(Date.now());
    var list = state.official
      ? Object.keys(state.official)
      : state.series.map(function (d) {
          return d.day;
        });
    if (list.indexOf(today) === -1) list.push(today);
    return list.sort();
  }
  function dayData(day) {
    if (state.official) return state.official[day] || { day: day, attacks: [], defenses: [], official: true };
    return state.days[day] || null;
  }
  function totalOf(list) {
    return list.reduce(function (t, h) {
      return t + (h.trophies || 0);
    }, 0);
  }

  function drawPlayer() {
    var p = state.p;
    var today = legendDay(Date.now());
    var t = dayData(today);
    var todayNet = t && !state.official ? totalOf(t.attacks) + totalOf(t.defenses) : null;
    app.innerHTML =
      headHtml(p, todayNet) +
      '<section class="am lg-day" aria-labelledby="lgDayTitle"><div id="lgDay"></div></section>' +
      (state.official ? '' : '<section class="am lg-season" aria-labelledby="lgSeasonTitle"><div id="lgSeason"></div></section>') +
      '<p class="lg-source">' +
      (state.official
        ? state.ckDown
          ? 'ClashKing couldn&rsquo;t be reached, so these battles come from the game&rsquo;s own battle log, which doesn&rsquo;t say how many trophies each one won or lost.'
          : 'ClashKing doesn&rsquo;t follow this player yet, so these battles come from the game&rsquo;s own battle log (about the last 50), which doesn&rsquo;t say how many trophies each one won or lost.'
        : 'Trophies per attack and defense from ClashKing, which records Legend players every few minutes; a hit can take a few minutes to appear. Player data from the official Clash of Clans API.') +
      '</p>';
    wireHead(p);
    drawDay();
    if (!state.official) drawSeason();
    scheduleRefresh();
  }

  function drawDay() {
    var box = document.getElementById('lgDay');
    var days = dayList();
    var i = days.indexOf(state.pick);
    var d = dayData(state.pick);
    var today = state.pick === legendDay(Date.now());
    var head =
      '<header class="lg-day-head"><button type="button" class="am-btn lg-step" data-step="-1" aria-label="Previous day"' +
      (i <= 0 ? ' disabled' : '') +
      '><svg class="am-ico" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><div class="lg-day-name"><h2 class="am-title" id="lgDayTitle">' +
      dayName(state.pick) +
      '</h2><span>' +
      (today ? 'Resets in <b data-reset>' + clock(nextReset() - Date.now()) + '</b>' : shortDate(state.pick) + ' &middot; 05:00 to 05:00 UTC') +
      '</span></div><button type="button" class="am-btn lg-step" data-step="1" aria-label="Next day"' +
      (i >= days.length - 1 ? ' disabled' : '') +
      '><svg class="am-ico" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></header>';
    if (!d) {
      box.innerHTML = head + '<div class="lg-loading-day" aria-busy="true"><div class="lg-skel-lanes"><i></i><i></i></div></div>';
      wireDay(box);
      ck('player/%23' + state.p.tag.slice(1) + '/legend/' + state.pick + '/battlelog').then(
        function (r) {
          state.days[r.day || state.pick] = r;
          if (document.getElementById('lgDay') === box) drawDay();
        },
        function () {
          box.querySelector('.lg-loading-day').innerHTML = '<p class="lg-empty">That day couldn&rsquo;t be loaded from ClashKing. Try again in a moment.</p>';
        },
      );
      return;
    }
    var atk = d.attacks.slice();
    var def = d.defenses.slice();
    var known = !d.official;
    var aT = totalOf(atk);
    var dT = totalOf(def);
    var net = aT + dT;
    var flow = '';
    if (known) {
      flow =
        '<div class="lg-flow">' +
        (today
          ? '<div class="lg-flow-end"><span>Started at</span><b>' +
            num(state.p.trophies - net) +
            '</b></div><svg class="lg-flow-arrow" viewBox="0 0 40 12" aria-hidden="true"><path d="M0 6h36M31 1l5 5-5 5"/></svg><div class="lg-flow-end"><span>Now</span><b>' +
            num(state.p.trophies) +
            '</b></div>'
          : '') +
        '<div class="lg-flow-net ' +
        tone(net) +
        '"><span>Day net</span><b>' +
        signed(net) +
        '</b></div></div>';
    }
    box.innerHTML =
      head +
      flow +
      '<div class="lg-lanes">' +
      lane('Attacks', 'atk', atk, known ? aT : null) +
      lane('Defenses', 'def', def, known ? dT : null) +
      '</div>' +
      (atk.length || def.length
        ? '<div class="am-part lg-hits"><div class="am-part-head"><h3 class="am-part-title">Every hit</h3><span class="am-part-note">Times are yours; tap a hit for the army</span></div><ol class="lg-list">' +
          hitRows(atk, def, known) +
          '</ol></div>'
        : '<p class="lg-empty">' +
          (today ? 'No attacks or defenses yet today.' : 'No attacks or defenses recorded this day.') +
          '</p>') +
      (known && atk.length ? dayFacts(atk, def) : '');
    wireDay(box);
    if (window.ArmySheet) window.ArmySheet.wire(box);
  }
  function wireDay(box) {
    box.querySelectorAll('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () {
        var days = dayList();
        var i = days.indexOf(state.pick) + +b.dataset.step;
        if (i < 0 || i >= days.length) return;
        state.pick = days[i];
        drawDay();
        markBar();
      });
    });
    box.querySelectorAll('.lg-hit-main').forEach(function (b) {
      b.addEventListener('click', function () {
        var li = b.closest('.lg-hit');
        var open = li.classList.toggle('is-open');
        b.setAttribute('aria-expanded', open);
      });
    });
  }

  // Eight slots per side, in the order they happened. A slot shows the
  // stars, the destruction and the trophies.
  function lane(title, kind, hits, total) {
    var slots = '';
    var sorted = hits.slice().sort(byTime);
    for (var i = 0; i < HITS_A_DAY; i++) {
      var h = sorted[i];
      slots += h
        ? '<div class="lg-slot is-s' +
          h.stars +
          '"><b class="lg-slot-n">' +
          (h.trophies == null ? Math.round(h.destructionPercentage) + '%' : signed(h.trophies)) +
          '</b>' +
          stars(h.stars) +
          (h.trophies == null ? '' : '<span class="lg-slot-p">' + Math.round(h.destructionPercentage) + '%</span>') +
          '</div>'
        : '<div class="lg-slot is-empty"><span>' + (i + 1) + '</span></div>';
    }
    var extra = sorted.length > HITS_A_DAY ? '<p class="lg-lane-more">+' + (sorted.length - HITS_A_DAY) + ' more in the list below</p>' : '';
    return (
      '<div class="lg-lane lg-lane--' +
      kind +
      '"><div class="lg-lane-head"><h3>' +
      title +
      '</h3><span class="lg-lane-count">' +
      Math.min(hits.length, HITS_A_DAY) +
      '<i>/' +
      HITS_A_DAY +
      '</i></span>' +
      (total != null ? '<b class="lg-lane-total ' + tone(total) + '">' + signed(total) + '</b>' : '') +
      '</div><div class="lg-slots">' +
      slots +
      '</div>' +
      extra +
      '</div>'
    );
  }
  function byTime(a, b) {
    return Date.parse(a.time) - Date.parse(b.time);
  }

  // Attacks and defenses together, oldest first, with the day's running net.
  function hitRows(atk, def, known) {
    var all = atk
      .map(function (h) {
        return { h: h, atk: true };
      })
      .concat(
        def.map(function (h) {
          return { h: h, atk: false };
        }),
      )
      .sort(function (a, b) {
        return byTime(a.h, b.h);
      });
    var run = 0;
    var th = state.p.townHallLevel;
    return all
      .map(function (x, i) {
        var h = x.h;
        run += h.trophies || 0;
        var t = new Date(h.time);
        var o = h.opponent || {};
        var otag = o.tag ? o.tag.replace('#', '') : '';
        // the army belongs to whoever attacked: us, or the opponent on a defense
        var sheet = h.shareCode && window.ArmySheet ? window.ArmySheet.html(x.atk ? th : o.townHallLevel || th, h.shareCode) : '';
        return (
          '<li class="lg-hit ' +
          (x.atk ? 'is-atk' : 'is-def') +
          '"><button type="button" class="lg-hit-main" aria-expanded="false"' +
          (sheet ? '' : ' disabled') +
          '><span class="lg-hit-kind">' +
          (x.atk ? 'Attack' : 'Defense') +
          '</span><span class="lg-hit-time">' +
          t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) +
          '</span><span class="lg-hit-opp">' +
          (thIcon(o.townHallLevel) ? '<img src="' + thIcon(o.townHallLevel) + '" alt="TH' + o.townHallLevel + '" width="26" height="26" />' : '') +
          '<span><b>' +
          esc(o.name || 'Unknown') +
          '</b><i>' +
          (x.atk ? 'their base' : 'attacked you') +
          ' &middot; ' +
          mmss(h.duration) +
          '</i></span></span><span class="lg-hit-res">' +
          stars(h.stars) +
          '<span>' +
          Math.round(h.destructionPercentage) +
          '%</span></span>' +
          (known
            ? '<span class="lg-hit-tro ' + tone(h.trophies) + '">' + signed(h.trophies) + '</span><span class="lg-hit-run">' + signed(run) + '</span>'
            : '') +
          (sheet ? '<svg class="lg-hit-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' : '') +
          '</button>' +
          (sheet
            ? '<div class="lg-hit-army"><div class="has-sheet lg-sheet">' +
              sheet +
              '</div><div class="lg-hit-links">' +
              '<a class="am-btn" href="https://link.clashofclans.com/en?action=CopyArmy&amp;army=' +
              encodeURIComponent(h.shareCode) +
              '" target="_blank" rel="noopener">Copy army in game</a>' +
              (otag ? '<a class="am-btn" href="?tag=' + otag + '" data-tag="' + otag + '">Track ' + esc(o.name) + '</a>' : '') +
              '</div></div>'
            : '') +
          '</li>'
        );
      })
      .join('');
  }

  // Under the hits: what the day's attacks and defenses averaged.
  function dayFacts(atk, def) {
    var three = function (l) {
      return l.filter(function (h) {
        return h.stars === 3;
      }).length;
    };
    var avg = function (l, f) {
      return l.length
        ? l.reduce(function (t, h) {
            return t + f(h);
          }, 0) / l.length
        : null;
    };
    var facts = [
      ['Attack 3-stars', three(atk) + '<i>/' + atk.length + '</i>'],
      ['Avg attack', fmtAvg(avg(atk, (h) => h.trophies), true)],
      ['Defenses held', def.length ? def.length - three(def) + '<i>/' + def.length + '</i>' : '&ndash;'],
      ['Avg defense', fmtAvg(avg(def, (h) => h.trophies), true)],
      ['Avg destruction', fmtAvg(avg(atk, (h) => h.destructionPercentage), false, '%')],
      ['Avg time', avg(atk, (h) => h.duration) == null ? '&ndash;' : mmss(Math.round(avg(atk, (h) => h.duration)))],
    ];
    return (
      '<div class="lg-facts">' +
      facts
        .map(function (f) {
          return '<div class="lg-fact"><span>' + f[0] + '</span><b>' + f[1] + '</b></div>';
        })
        .join('') +
      '</div>'
    );
  }
  function fmtAvg(v, sign, unit) {
    if (v == null) return '&ndash;';
    var r = Math.round(v * 10) / 10;
    var s = r.toFixed(r % 1 ? 1 : 0) + (unit || '');
    return sign && r > 0 ? '+' + s : sign && r < 0 ? '&minus;' + s.slice(1) : s;
  }

  /* ---- the last 28 days ---- */
  function drawSeason() {
    var box = document.getElementById('lgSeason');
    var today = legendDay(Date.now());
    var t = state.days[today];
    var list = state.series.slice();
    if (t && !list.some((d) => d.day === today))
      list.push({ day: today, attackTrophies: totalOf(t.attacks), defenseTrophies: totalOf(t.defenses), trophies: totalOf(t.attacks) + totalOf(t.defenses), live: true });
    var played = list.filter(function (d) {
      return d.attackTrophies || d.defenseTrophies;
    });
    if (!played.length) {
      box.innerHTML = '<header class="am-head"><div><h2 class="am-title" id="lgSeasonTitle">Last 28 days</h2></div></header><p class="lg-empty">No Legend days recorded yet.</p>';
      return;
    }
    var nets = list.map(function (d) {
      return d.trophies;
    });
    var total = nets.reduce(function (a, b) {
      return a + b;
    }, 0);
    var best = played.reduce(function (a, d) {
      return d.trophies > a.trophies ? d : a;
    });
    var worst = played.reduce(function (a, d) {
      return d.trophies < a.trophies ? d : a;
    });
    var avg = function (k) {
      return (
        played.reduce(function (t, d) {
          return t + d[k];
        }, 0) / played.length
      );
    };
    box.innerHTML =
      '<header class="am-head"><div><h2 class="am-title" id="lgSeasonTitle">Last ' +
      list.length +
      ' days</h2><p class="am-intro">Each bar is one Legend day&rsquo;s net; the line adds them up. Tap a bar to open that day.</p></div><div class="lg-total ' +
      tone(total) +
      '"><span>Total</span><b>' +
      signed(total) +
      '</b></div></header>' +
      '<div class="am-part lg-chart-wrap">' +
      chart(list) +
      '</div>' +
      '<div class="lg-facts">' +
      [
        ['Days played', played.length + '<i>/' + list.length + '</i>'],
        ['Avg offense', fmtAvg(avg('attackTrophies'), true)],
        ['Avg defense', fmtAvg(avg('defenseTrophies'), true)],
        ['Avg net', fmtAvg(avg('trophies'), true)],
        ['Best day', signed(best.trophies) + '<i> ' + shortDate(best.day) + '</i>'],
        ['Worst day', signed(worst.trophies) + '<i> ' + shortDate(worst.day) + '</i>'],
      ]
        .map(function (f) {
          return '<div class="lg-fact"><span>' + f[0] + '</span><b>' + f[1] + '</b></div>';
        })
        .join('') +
      '</div>';
    box.querySelectorAll('[data-day]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.pick = b.dataset.day;
        drawDay();
        markBar();
        document.getElementById('lgDay').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    markBar();
  }
  function markBar() {
    document.querySelectorAll('.lg-bar').forEach(function (b) {
      b.classList.toggle('is-pick', b.dataset.day === state.pick);
    });
  }

  // Bars (net per day) around a zero line, plus the running total as a line.
  // Drawn in SVG units 0..W x 0..H; the CSS stretches it to the box width.
  function chart(list) {
    var W = 700;
    var H = 220;
    var padT = 18;
    var padB = 26;
    var n = list.length;
    var step = W / n;
    var run = 0;
    var cum = list.map(function (d) {
      return (run += d.trophies);
    });
    var hi = Math.max.apply(
      null,
      list
        .map(function (d) {
          return Math.abs(d.trophies);
        })
        .concat([40]),
    );
    var cHi = Math.max.apply(null, cum.concat([0]));
    var cLo = Math.min.apply(null, cum.concat([0]));
    var mid = padT + (H - padT - padB) / 2;
    var half = (H - padT - padB) / 2;
    var y = function (v) {
      return mid - (v / hi) * half;
    };
    var cy = function (v) {
      return cHi === cLo ? mid : padT + (1 - (v - cLo) / (cHi - cLo)) * (H - padT - padB);
    };
    var bars = list
      .map(function (d, i) {
        var x = i * step + step * 0.18;
        var w = step * 0.64;
        var v = d.trophies;
        var top = v >= 0 ? y(v) : mid;
        var h = Math.max(1.5, Math.abs(y(v) - mid));
        var label = (d.day === legendDay(Date.now()) ? 'Today (so far)' : shortDate(d.day)) + ': ' + (v > 0 ? '+' : '') + v + ' (attacks ' + d.attackTrophies + ', defenses ' + d.defenseTrophies + ')';
        return (
          '<g class="lg-bar ' +
          (v >= 0 ? 'is-up' : 'is-down') +
          (d.live ? ' is-live' : '') +
          '" data-day="' +
          d.day +
          '" tabindex="0" role="button" aria-label="' +
          label +
          '"><title>' +
          label +
          '</title><rect class="lg-bar-hit" x="' +
          i * step +
          '" y="0" width="' +
          step +
          '" height="' +
          H +
          '"/><rect class="lg-bar-fill" x="' +
          x.toFixed(1) +
          '" y="' +
          top.toFixed(1) +
          '" width="' +
          w.toFixed(1) +
          '" height="' +
          h.toFixed(1) +
          '" rx="1.5"/></g>'
        );
      })
      .join('');
    var line = cum
      .map(function (v, i) {
        return (i ? 'L' : 'M') + (i * step + step / 2).toFixed(1) + ' ' + cy(v).toFixed(1);
      })
      .join(' ');
    var ticks = list
      .map(function (d, i) {
        if (i % 7 && i !== n - 1) return '';
        return '<text x="' + (i * step + step / 2).toFixed(1) + '" y="' + (H - 6) + '">' + shortDate(d.day) + '</text>';
      })
      .join('');
    return (
      '<svg class="lg-chart" viewBox="0 0 ' +
      W +
      ' ' +
      H +
      '" preserveAspectRatio="none" role="group" aria-label="Net trophies per Legend day">' +
      '<line class="lg-zero" x1="0" x2="' +
      W +
      '" y1="' +
      mid +
      '" y2="' +
      mid +
      '"/>' +
      bars +
      '<path class="lg-cum" d="' +
      line +
      '"/>' +
      '</svg><div class="lg-chart-ticks" aria-hidden="true"><svg viewBox="0 0 ' +
      W +
      ' 24" preserveAspectRatio="none">' +
      ticks.replace(/y="\d+"/g, 'y="16"') +
      '</svg></div><div class="lg-chart-key" aria-hidden="true"><span><i class="k-up"></i>Day won</span><span><i class="k-down"></i>Day lost</span><span><i class="k-line"></i>Running total</span></div>'
    );
  }

  /* ---- live: refresh today every 3 minutes while the page is open ---- */
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function again() {
      if (!state || state.official || document.hidden) {
        refreshTimer = setTimeout(again, 180000);
        return;
      }
      var tag = state.p.tag.slice(1);
      var today = legendDay(Date.now());
      var token = playerToken;
      Promise.all([api('type=player&tag=' + tag), ck('player/%23' + tag + '/legend/' + today + '/battlelog')]).then(
        function (r) {
          if (token !== playerToken) return;
          state.p = r[0];
          state.days[today] = r[1];
          var keep = state.pick;
          var y = window.scrollY;
          drawPlayer();
          state.pick = keep;
          drawDay();
          markBar();
          window.scrollTo(0, y);
        },
        function () {
          refreshTimer = setTimeout(again, 180000);
        },
      );
    }, 180000);
  }

  drawQuick();
  route();
})();
