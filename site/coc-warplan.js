/* War Planner (Oct 25 2026): /coc/tools/war-planner[?clan=<TAG>&w=<war>&plan=<pairs>].
   Load a clan's current war (regular or Clan War League), give each of
   your attackers a target, and send the plan to the clan as a link or text.

   Data: the official API through our Worker (cloudflare/coc-api/worker.js):
   type=clan, clansearch, war (public war logs only), cwlgroup + cwlwar
   (CWL wars are readable whatever the war log setting).

   The plan lives in the address, so a link IS the plan:
     w    = the war's preparationStartTime digits (one id per war; a plan
            opened during a later war is ignored, with a note)
     plan = attacker.target[.target]_attacker.target ... by map position,
            e.g. 1-3.4_2-5 = #1 hits #3 and #4, #2 hits #5.
   It's also kept per war in localStorage (wp-plan:<clan>:<w>), so a
   refresh or a later visit keeps it. Nothing is sent anywhere else.
   Styles: coc-warplan.css. */
(function () {
  'use strict';

  var API = 'https://parchrome-coc.adriantulabut5747.workers.dev/api/coc';
  var RECENT_KEY = 'wp-recent';
  var FEATURED = {
    tag: '2GYPGPJP9',
    name: 'ASCENDERE',
    badge: 'https://api-assets.clashofclans.com/badges/70/hoeu9IEsBCOUOoPkJ6jquo0mG3J8ls4l7zA1wt0AjEA.png',
  };

  var app = document.getElementById('wpView');
  var form = document.getElementById('wpForm');
  if (!app || !form) return;
  var input = document.getElementById('wpQuery');
  var msg = document.getElementById('wpMsg');
  var results = document.getElementById('wpResults');
  var quick = document.getElementById('wpQuick');

  /* ---------------------------------------------------------------- helpers */
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
  function thIcon(th) {
    return th >= 4 ? '/icons/th' + th + 'icon.' + (th === 18 ? 'png' : 'webp') : '';
  }
  function apiTime(s) {
    var m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(s || '');
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : 0;
  }
  function timeLeft(ms) {
    var min = Math.max(0, Math.round(ms / 60000));
    var h = Math.floor(min / 60);
    return h ? h + 'h ' + (min % 60) + 'm' : min + 'm';
  }
  var STAR =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
  function stars(n) {
    var s = '';
    for (var i = 0; i < 3; i++) s += STAR.replace('<svg', '<svg class="' + (i < n ? 'on' : '') + '"');
    return '<span class="wp-stars" role="img" aria-label="' + n + ' of 3 stars">' + s + '</span>';
  }
  function read(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, v) {
    try {
      if (v == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(v));
    } catch (e) {}
  }
  // GET the Worker; rejects with Error('notFound' | 'maintenance' | 'private' | 'other').
  function api(query) {
    return fetch(API + '?' + query).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) throw new Error(['notFound', 'maintenance', 'private'].indexOf(body.error) !== -1 ? body.error : 'other');
        return body;
      });
    });
  }
  // fn over items, n at a time (a CWL day is 4 wars; don't fire 8 at once).
  function pool(items, n, fn) {
    var out = [];
    var i = 0;
    function next() {
      if (i >= items.length) return Promise.resolve();
      var k = i++;
      return Promise.resolve(fn(items[k])).then(
        function (v) {
          out[k] = v;
          return next();
        },
        function () {
          out[k] = null;
          return next();
        },
      );
    }
    var runners = [];
    for (var j = 0; j < Math.min(n, items.length); j++) runners.push(next());
    return Promise.all(runners).then(function () {
      return out;
    });
  }

  /* ---------------------------------------------------- search + recent */
  function say(text) {
    msg.hidden = !text;
    msg.innerHTML = text || '';
  }
  function saveRecent(c) {
    var tag = c.tag.slice(1);
    var list = read(RECENT_KEY, []).filter(function (r) {
      return r.tag !== tag;
    });
    list.unshift({ tag: tag, name: c.name, badge: c.badgeUrls.small });
    write(RECENT_KEY, list.slice(0, 6));
    drawQuick();
  }
  function drawQuick() {
    var list = read(RECENT_KEY, []);
    var shown = list.length ? list : [FEATURED];
    quick.innerHTML =
      '<span class="wp-quick-label">' +
      (list.length ? 'Recent' : 'Try') +
      '</span>' +
      shown
        .map(function (r) {
          return (
            '<a class="wp-chip" href="?clan=' +
            r.tag +
            '" data-clan="' +
            r.tag +
            '"><img src="' +
            r.badge +
            '" alt="" width="22" height="22" />' +
            esc(r.name) +
            '</a>'
          );
        })
        .join('');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var raw = input.value.trim();
    results.hidden = true;
    if (!raw) return say('Type a clan tag or a clan name.');
    var tag = cleanTag(raw);
    // A tag: starts with #, or is made of tag letters only and has a digit
    // (a clan name like "LIBRA" uses tag letters too).
    if (tag && (/^#/.test(raw) || /\d/.test(raw))) {
      say('');
      input.blur();
      return go(tag, true);
    }
    if (raw.length < 3) return say('Clan names need at least 3 letters.');
    say('Searching&hellip;');
    api('type=clansearch&name=' + encodeURIComponent(raw)).then(
      function (r) {
        var list = (r.items || []).slice(0, 10);
        if (!list.length) return say('No clan called &ldquo;' + esc(raw) + '&rdquo;. Try its tag instead.');
        say('');
        results.hidden = false;
        results.innerHTML = list
          .map(function (c) {
            return (
              '<li><a class="wp-result" href="?clan=' +
              c.tag.slice(1) +
              '" data-clan="' +
              c.tag.slice(1) +
              '"><img src="' +
              c.badgeUrls.small +
              '" alt="" width="40" height="40" loading="lazy" /><span class="wp-result-main"><b>' +
              esc(c.name) +
              '</b><span>#' +
              c.tag.slice(1) +
              (c.location ? ' &middot; ' + esc(c.location.name) : '') +
              '</span></span><span class="wp-result-meta"><b>' +
              c.members +
              '/50</b><span>' +
              (c.isWarLogPublic ? 'Public war log' : 'Private war log') +
              '</span></span></a></li>'
            );
          })
          .join('');
      },
      function () {
        say('The search didn&rsquo;t work. Try again, or use the clan&rsquo;s tag.');
      },
    );
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-clan]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    results.hidden = true;
    say('');
    go(a.dataset.clan, true);
  });

  /* --------------------------------------------------------------- routing */
  var Q = new URLSearchParams(location.search);
  function go(tag, push) {
    if (push) history.pushState(null, '', '?clan=' + tag);
    Q = new URLSearchParams(location.search);
    route();
  }
  window.addEventListener('popstate', function () {
    Q = new URLSearchParams(location.search);
    route();
  });
  function route() {
    var tag = cleanTag(Q.get('clan'));
    if (!tag) {
      input.value = '';
      app.innerHTML = '';
      S = null;
      document.title = 'War Planner: Clash of Clans War Targets | Parchrome';
      return;
    }
    input.value = '#' + tag;
    loadClan(tag);
  }

  /* ------------------------------------------------------------ the wars */
  // Every war the clan is in right now: during CWL the newest two drawn
  // days (often one in battle, the next in preparation), otherwise the
  // regular war (public war logs only). Battle first, then preparation.
  function findWars(c) {
    var t = c.tag.slice(1);
    var regular = function () {
      if (!c.isWarLogPublic) return Promise.resolve({ wars: [], private: true });
      return api('type=war&tag=' + t).then(
        function (w) {
          return { wars: w.state && w.state !== 'notInWar' ? [{ w: w, label: 'Clan war' }] : [] };
        },
        function (err) {
          return { wars: [], private: err.message === 'private' };
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
        var found = [];
        return pool(drawn.slice(-2), 1, function (d) {
          return pool(d.tags, 4, function (x) {
            return api('type=cwlwar&tag=' + x.slice(1));
          }).then(function (wars) {
            wars.forEach(function (w) {
              if (w && (w.clan.tag === c.tag || w.opponent.tag === c.tag)) found.push({ w: w, label: 'CWL day ' + d.day, cwl: true });
            });
          });
        }).then(function () {
          var order = { inWar: 0, preparation: 1, warEnded: 2 };
          found.sort(function (a, b) {
            return order[a.w.state] - order[b.w.state];
          });
          return found.length ? { wars: found } : regular();
        });
      },
      function () {
        return regular();
      },
    );
  }

  var S = null; // the war being planned
  var loadToken = 0;
  function loadClan(tag) {
    var token = ++loadToken;
    app.innerHTML =
      '<section class="wp-war is-skel" aria-busy="true"><i></i><i></i><i></i></section><section class="am wp-plan" aria-busy="true"><p class="wp-loading">Loading the war&hellip;</p></section>';
    api('type=clan&tag=' + tag)
      .then(function (c) {
        if (token !== loadToken) return;
        saveRecent(c);
        document.title = c.name + ' · War Planner | Parchrome';
        return findWars(c).then(function (r) {
          if (token !== loadToken) return;
          if (!r.wars.length) return drawNoWar(c, r.private);
          var pick = 0;
          var wanted = Q.get('w');
          r.wars.forEach(function (f, i) {
            if (warId(f.w) === wanted) pick = i;
          });
          setWar(c, r.wars, pick);
        });
      })
      .catch(function (err) {
        if (token !== loadToken) return;
        var text =
          err.message === 'notFound'
            ? 'No clan has the tag #' + tag + '.'
            : err.message === 'maintenance'
              ? 'Clash of Clans is in maintenance, so wars can&rsquo;t be loaded right now.'
              : 'The clan couldn&rsquo;t be loaded. Check your connection and try again.';
        app.innerHTML = '<section class="am wp-state"><p>' + text + '</p><button type="button" class="am-btn" data-retry>Try again</button></section>';
        app.querySelector('[data-retry]').addEventListener('click', function () {
          loadClan(tag);
        });
      });
  }
  function drawNoWar(c, priv) {
    app.innerHTML =
      '<section class="am wp-state wp-state--clan"><img src="' +
      c.badgeUrls.medium +
      '" alt="" width="88" height="88" /><div><h2 class="am-title">' +
      esc(c.name) +
      (priv ? ' keeps its war log private' : ' isn&rsquo;t in a war') +
      '</h2><p>' +
      (priv
        ? 'The game only shares a regular war when the clan&rsquo;s war log is public. A leader or co-leader can turn it on in the clan&rsquo;s settings (War log: Public). Clan War League wars always load.'
        : 'There&rsquo;s no war to plan right now. Come back once the clan starts a war search and the preparation day begins.') +
      '</p><div class="wp-state-keys"><button type="button" class="am-btn am-btn-main" data-retry>Check again</button><a class="am-btn" href="/coc/clan/' +
      c.tag.slice(1) +
      '">Open the clan page</a></div></div></section>';
    app.querySelector('[data-retry]').addEventListener('click', function () {
      loadClan(c.tag.slice(1));
    });
  }
  function warId(w) {
    return String(w.preparationStartTime || w.startTime || '').replace(/\D/g, '');
  }

  // The war as two ranked sides. rank = place on the war map (1 = top).
  function buildWar(c, f) {
    var w = f.w;
    var usSide = w.clan.tag === c.tag ? w.clan : w.opponent;
    var themSide = usSide === w.clan ? w.opponent : w.clan;
    var byPos = function (a, b) {
      return a.mapPosition - b.mapPosition;
    };
    var us = (usSide.members || []).slice().sort(byPos);
    var them = (themSide.members || []).slice().sort(byPos);
    var usRank = {};
    var themRank = {};
    us.forEach(function (m, i) {
      usRank[m.tag] = i + 1;
    });
    them.forEach(function (m, i) {
      themRank[m.tag] = i + 1;
    });
    var apm = w.attacksPerMember || 1;
    return {
      w: w,
      label: f.label,
      cwl: !!f.cwl,
      apm: apm,
      id: warId(w),
      usSide: usSide,
      themSide: themSide,
      us: us.map(function (m, i) {
        return {
          rank: i + 1,
          tag: m.tag,
          name: m.name,
          th: m.townhallLevel,
          hits: (m.attacks || []).map(function (a) {
            return { target: themRank[a.defenderTag], stars: a.stars, pct: a.destructionPercentage, order: a.order };
          }),
        };
      }),
      them: them.map(function (m, i) {
        var b = m.bestOpponentAttack;
        return {
          rank: i + 1,
          tag: m.tag,
          name: m.name,
          th: m.townhallLevel,
          best: b ? { stars: b.stars, pct: b.destructionPercentage, by: usRank[b.attackerTag] } : null,
          taken: m.opponentAttacks || 0,
        };
      }),
    };
  }

  /* --------------------------------------------------------------- plan */
  function planKey() {
    return 'wp-plan:' + S.clan.tag.slice(1) + ':' + S.war.id;
  }
  function encodePlan(plan) {
    return Object.keys(plan)
      .filter(function (a) {
        return plan[a].length;
      })
      .sort(function (a, b) {
        return a - b;
      })
      .map(function (a) {
        return a + '-' + plan[a].join('.');
      })
      .join('_');
  }
  // Only pairs that fit this war: ranks 1..n, at most apm targets each.
  function decodePlan(s, n, apm) {
    var plan = {};
    String(s || '')
      .split('_')
      .forEach(function (part) {
        var m = /^(\d{1,2})-([\d.]+)$/.exec(part);
        if (!m) return;
        var a = +m[1];
        if (a < 1 || a > n) return;
        var t = m[2]
          .split('.')
          .map(Number)
          .filter(function (b, i, all) {
            return b >= 1 && b <= n && all.indexOf(b) === i;
          })
          .slice(0, apm);
        if (t.length) plan[a] = t;
      });
    return plan;
  }
  function savePlan() {
    var code = encodePlan(S.plan);
    write(planKey(), code || null);
    var q = '?clan=' + S.clan.tag.slice(1) + '&w=' + S.war.id + (code ? '&plan=' + code : '');
    history.replaceState(null, '', q);
    Q = new URLSearchParams(location.search);
  }

  function setWar(c, wars, pick) {
    var war = buildWar(c, wars[pick]);
    S = { clan: c, wars: wars, pick: pick, war: war, plan: {}, sel: null, undo: null };
    var n = war.us.length;
    var fromLink = Q.get('plan');
    var note = '';
    if (fromLink && Q.get('w') === war.id) S.plan = decodePlan(fromLink, n, war.apm);
    else {
      if (fromLink && Q.get('w') && Q.get('w') !== war.id) note = 'The plan in that link was made for an earlier war, so it was left out.';
      S.plan = decodePlan(read(planKey(), ''), n, war.apm);
    }
    drawWar(note);
    savePlan();
  }

  // What a planned pair has become: done (the attacker hit that base),
  // waste (someone else already took all three stars), or open.
  function pairState(a, b) {
    var att = S.war.us[a - 1];
    var base = S.war.them[b - 1];
    var hit = att.hits.filter(function (h) {
      return h.target === b;
    })[0];
    if (hit) return { kind: 'done', stars: hit.stars };
    if (base.best && base.best.stars === 3) return { kind: 'waste' };
    if (att.hits.length >= S.war.apm) return { kind: 'spent' };
    return { kind: 'open' };
  }
  function attackersOf(b) {
    var out = [];
    Object.keys(S.plan).forEach(function (a) {
      if (S.plan[a].indexOf(b) !== -1) out.push(+a);
    });
    return out.sort(function (x, y) {
      return x - y;
    });
  }
  function left(att) {
    return S.war.apm - att.hits.length;
  }
  function cleared(base) {
    return !!(base.best && base.best.stars === 3);
  }

  function toggle(a, b) {
    S.undo = null;
    var list = (S.plan[a] = S.plan[a] || []);
    var i = list.indexOf(b);
    if (i !== -1) list.splice(i, 1);
    else {
      if (list.length >= S.war.apm) list.shift(); // full: the newest pick replaces the oldest
      list.push(b);
    }
    if (!list.length) delete S.plan[a];
    savePlan();
  }

  // Mirror: #n hits #n (one attack each), skipping spent attackers and
  // bases that already lost three stars.
  function mirrorPlan() {
    var plan = {};
    S.war.us.forEach(function (att) {
      var base = S.war.them[att.rank - 1];
      if (base && left(att) > 0 && !cleared(base)) plan[att.rank] = [base.rank];
    });
    return plan;
  }
  // Best fit: top base first, each gets the attacker with the smallest
  // Town Hall that matches or beats it (ties: the closest map spot), so the
  // strongest players stay free for the bases only they can hit. A base no
  // one left can match gets the strongest attacker left. One attacker per
  // base; a second attack (regular wars) stays free for cleanup.
  function bestFitPlan() {
    var plan = {};
    var spare = {};
    S.war.us.forEach(function (att) {
      spare[att.rank] = left(att);
    });
    S.war.them.forEach(function (base) {
      if (cleared(base)) return;
      var pick = null;
      var score = Infinity;
      S.war.us.forEach(function (att) {
        if (spare[att.rank] < 1 || (plan[att.rank] && plan[att.rank].length)) return;
        var s = att.th >= base.th ? (att.th - base.th) * 100 + Math.abs(att.rank - base.rank) : 10000 + (base.th - att.th) * 100 + att.rank;
        if (s < score) {
          score = s;
          pick = att;
        }
      });
      if (pick) {
        plan[pick.rank] = [base.rank];
        spare[pick.rank]--;
      }
    });
    return plan;
  }
  function replacePlan(next, label) {
    S.undo = { plan: JSON.parse(JSON.stringify(S.plan)), label: label };
    S.plan = next;
    S.sel = null;
    savePlan();
    drawBoard();
  }

  /* --------------------------------------------------------------- draw */
  function drawWar(note) {
    var war = S.war;
    var w = war.w;
    app.innerHTML =
      (S.wars.length > 1
        ? '<div class="wp-pickwar" role="group" aria-label="Which war">' +
          S.wars
            .map(function (f, i) {
              return (
                '<button type="button" class="gd-chip" data-war="' +
                i +
                '" aria-pressed="' +
                (i === S.pick) +
                '">' +
                f.label +
                ' &middot; ' +
                stateName(f.w.state) +
                '</button>'
              );
            })
            .join('') +
          '</div>'
        : '') +
      warHead() +
      (note ? '<p class="wp-note">' + note + '</p>' : '') +
      '<section class="am wp-plan" aria-labelledby="wpPlanTitle">' +
      '<header class="am-head"><div><h2 class="am-title" id="wpPlanTitle">The plan</h2><div class="cv-say"><img class="cv-face" src="/images/coc/villager/face-flat.webp" alt="" width="44" height="44" loading="lazy" decoding="async"><p><b>Villager</b>Tap one of your players, then the enemy base they should hit. Tap it again to take it back. ' +
      (war.apm > 1 ? 'Each player has ' + war.apm + ' attacks.' : 'One attack each in the Clan War League.') +
      '</p></div></div><div class="wp-auto" role="group" aria-label="Fill the plan">' +
      '<button type="button" class="am-btn" data-auto="best" title="Smallest Town Hall that can take each base, top base first">Best fit</button>' +
      '<button type="button" class="am-btn" data-auto="mirror" title="#1 on #1, #2 on #2 ...">Mirror</button>' +
      '<button type="button" class="am-btn" data-auto="clear">Clear</button>' +
      '</div></header>' +
      '<div id="wpSummary"></div>' +
      '<div class="wp-board-wrap"><div class="wp-board" id="wpBoard"></div></div>' +
      '<div id="wpWarn"></div>' +
      '<div class="wp-send"><div class="wp-send-copy"><h3 class="am-part-title">Send it to your clan</h3><p>The link opens this exact plan, live. The text is for clan chat or Discord.</p></div><div class="wp-send-keys">' +
      '<button type="button" class="am-btn am-btn-main" data-send="link"><svg class="am-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg><span>Copy link</span></button>' +
      '<button type="button" class="am-btn" data-send="text"><svg class="am-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h9a2 2 0 0 1 2 2v12M5 8h9a1 1 0 0 1 1 1v11H6a1 1 0 0 1-1-1z"/></svg><span>Copy as text</span></button>' +
      '</div></div>' +
      '</section>' +
      lineupHtml();
    app.querySelectorAll('[data-war]').forEach(function (b) {
      b.addEventListener('click', function () {
        setWar(S.clan, S.wars, +b.dataset.war);
      });
    });
    app.querySelectorAll('[data-auto]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.auto;
        replacePlan(k === 'best' ? bestFitPlan() : k === 'mirror' ? mirrorPlan() : {}, { best: 'Best fit', mirror: 'Mirror', clear: 'Clear' }[k]);
      });
    });
    app.querySelectorAll('[data-send]').forEach(function (b) {
      b.addEventListener('click', function () {
        send(b);
      });
    });
    var r = app.querySelector('[data-refresh]');
    if (r)
      r.addEventListener('click', function () {
        loadClan(S.clan.tag.slice(1));
      });
    drawBoard();
  }

  function stateName(s) {
    return { preparation: 'Preparation', inWar: 'Battle day', warEnded: 'Ended' }[s] || s;
  }
  function clockText(w) {
    if (w.state === 'preparation') return 'Battles start in <em data-left="' + apiTime(w.startTime) + '">' + timeLeft(apiTime(w.startTime) - Date.now()) + '</em>';
    if (w.state === 'inWar') return 'Ends in <em data-left="' + apiTime(w.endTime) + '">' + timeLeft(apiTime(w.endTime) - Date.now()) + '</em>';
    return 'War over';
  }
  setInterval(function () {
    document.querySelectorAll('[data-left]').forEach(function (e) {
      e.textContent = timeLeft(+e.dataset.left - Date.now());
    });
  }, 30000);

  function warHead() {
    var war = S.war;
    var w = war.w;
    var prep = w.state === 'preparation';
    var total = w.teamSize * war.apm;
    function team(side, cls) {
      return (
        '<div class="wp-team ' +
        cls +
        '"><img src="' +
        side.badgeUrls.medium +
        '" alt="" width="84" height="84" /><b>' +
        esc(side.name) +
        '</b><span>' +
        (prep ? 'Level ' + side.clanLevel : (side.attacks || 0) + ' of ' + total + ' attacks') +
        '</span></div>'
      );
    }
    var u = war.usSide;
    var t = war.themSide;
    return (
      '<section class="wp-war is-' +
      w.state +
      '" aria-label="The war">' +
      '<p class="wp-war-top"><span class="wp-dot" aria-hidden="true"></span><b>' +
      war.label +
      ' &middot; ' +
      stateName(w.state) +
      '</b><span class="wp-war-time">' +
      clockText(w) +
      '</span></p>' +
      team(u, 'is-us') +
      '<div class="wp-mid">' +
      (prep
        ? '<b class="wp-score">' + w.teamSize + '<i>v</i>' + w.teamSize + '</b><span>Line-ups locked</span>'
        : '<b class="wp-score">' +
          STAR +
          u.stars +
          '<i>&ndash;</i>' +
          t.stars +
          STAR +
          '</b><span>' +
          (u.destructionPercentage || 0).toFixed(1) +
          '% &ndash; ' +
          (t.destructionPercentage || 0).toFixed(1) +
          '%</span>') +
      '</div>' +
      team(t, 'is-them') +
      '<div class="wp-war-keys"><button type="button" class="am-btn" data-refresh><svg class="am-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/></svg>Refresh</button><a class="am-btn" href="/coc/clan/' +
      S.clan.tag.slice(1) +
      '">Clan page</a></div>' +
      '</section>'
    );
  }

  function attackDots(att) {
    var s = '';
    for (var i = 0; i < S.war.apm; i++) {
      var h = att.hits[i];
      s += h
        ? '<i class="wp-dot-hit s' + h.stars + '" title="Hit #' + h.target + ': ' + h.stars + ' stars, ' + h.pct + '%"></i>'
        : '<i class="wp-dot-free" title="Attack left"></i>';
    }
    return '<span class="wp-dots" aria-label="' + att.hits.length + ' of ' + S.war.apm + ' attacks used">' + s + '</span>';
  }

  function drawBoard() {
    var war = S.war;
    var sel = S.sel;
    var board = document.getElementById('wpBoard');
    var selAtt = sel && sel.side === 'us' ? sel.rank : null;
    var selBase = sel && sel.side === 'them' ? sel.rank : null;
    var usRows = war.us
      .map(function (att) {
        var targets = (S.plan[att.rank] || [])
          .map(function (b) {
            var st = pairState(att.rank, b);
            return '<span class="wp-tgt is-' + st.kind + '">' + (st.kind === 'done' ? stars(st.stars) : '') + '#' + b + '</span>';
          })
          .join('');
        var on = selBase && (S.plan[att.rank] || []).indexOf(selBase) !== -1;
        return (
          '<button type="button" class="wp-row wp-row--us' +
          (selAtt === att.rank ? ' is-sel' : '') +
          (selBase ? ' is-cand' : '') +
          (on ? ' is-on' : '') +
          (left(att) < 1 ? ' is-spent' : '') +
          '" data-side="us" data-rank="' +
          att.rank +
          '" draggable="true" aria-pressed="' +
          (selAtt === att.rank) +
          '"><span class="wp-num">' +
          att.rank +
          '</span><img src="' +
          thIcon(att.th) +
          '" alt="TH' +
          att.th +
          '" width="30" height="30" /><span class="wp-who"><b>' +
          esc(att.name) +
          '</b>' +
          attackDots(att) +
          '</span><span class="wp-tgts">' +
          targets +
          '</span></button>'
        );
      })
      .join('');
    var themRows = war.them
      .map(function (base) {
        var by = attackersOf(base.rank);
        var on = selAtt && by.indexOf(selAtt) !== -1;
        var best = base.best;
        return (
          '<button type="button" class="wp-row wp-row--them' +
          (selBase === base.rank ? ' is-sel' : '') +
          (selAtt ? ' is-cand' : '') +
          (on ? ' is-on' : '') +
          (cleared(base) ? ' is-cleared' : '') +
          '" data-side="them" data-rank="' +
          base.rank +
          '" aria-pressed="' +
          (selBase === base.rank) +
          '"><span class="wp-tgts">' +
          by
            .map(function (a) {
              return '<span class="wp-tgt is-' + pairState(a, base.rank).kind + '">#' + a + '</span>';
            })
            .join('') +
          '</span><span class="wp-who"><b>' +
          esc(base.name) +
          '</b>' +
          (best
            ? '<span class="wp-best">' + stars(best.stars) + '<i>' + best.pct + '%</i></span>'
            : '<span class="wp-best is-none">' + (S.war.w.state === 'preparation' ? 'TH' + base.th : 'Not attacked') + '</span>') +
          '</span><img src="' +
          thIcon(base.th) +
          '" alt="TH' +
          base.th +
          '" width="30" height="30" /><span class="wp-num">' +
          base.rank +
          '</span></button>'
        );
      })
      .join('');
    board.className = 'wp-board' + (sel ? ' has-sel' : '');
    board.innerHTML =
      '<div class="wp-col wp-col--us"><div class="wp-col-head"><img src="' +
      S.war.usSide.badgeUrls.small +
      '" alt="" width="26" height="26" /><b>' +
      esc(S.war.usSide.name) +
      '</b><span>Attackers</span></div>' +
      usRows +
      '</div><svg class="wp-lines" aria-hidden="true"></svg><div class="wp-col wp-col--them"><div class="wp-col-head"><span>Bases</span><b>' +
      esc(S.war.themSide.name) +
      '</b><img src="' +
      S.war.themSide.badgeUrls.small +
      '" alt="" width="26" height="26" /></div>' +
      themRows +
      '</div>';
    wireBoard(board);
    drawLines();
    drawSummary();
  }

  function pick(side, rank) {
    var sel = S.sel;
    if (sel && sel.side === side && sel.rank === rank) S.sel = null;
    else if (sel && sel.side !== side) {
      var a = side === 'us' ? rank : sel.rank;
      var b = side === 'them' ? rank : sel.rank;
      toggle(a, b);
      // an attacker stays picked while they still have room for another target
      if (sel.side === 'us' && (S.plan[a] || []).length < S.war.apm) S.sel = sel;
      else if (sel.side === 'them') S.sel = sel;
      else S.sel = null;
    } else S.sel = { side: side, rank: rank };
    drawBoard();
    var again = document.querySelector('.wp-row[data-side="' + side + '"][data-rank="' + rank + '"]');
    if (again) again.focus({ preventScroll: true });
  }
  function wireBoard(board) {
    board.querySelectorAll('.wp-row').forEach(function (row) {
      row.addEventListener('click', function () {
        pick(row.dataset.side, +row.dataset.rank);
      });
      // Desktop: drag an attacker onto a base.
      if (row.dataset.side === 'us') {
        row.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/plain', row.dataset.rank);
          e.dataTransfer.effectAllowed = 'link';
          S.sel = { side: 'us', rank: +row.dataset.rank };
          board.classList.add('is-dragging');
        });
        row.addEventListener('dragend', function () {
          board.classList.remove('is-dragging');
        });
      } else {
        row.addEventListener('dragover', function (e) {
          e.preventDefault();
          row.classList.add('is-over');
        });
        row.addEventListener('dragleave', function () {
          row.classList.remove('is-over');
        });
        row.addEventListener('drop', function (e) {
          e.preventDefault();
          var a = +e.dataTransfer.getData('text/plain');
          if (!a) return;
          S.sel = null;
          toggle(a, +row.dataset.rank);
          drawBoard();
        });
      }
    });
  }

  // The lines between the columns: one per planned pair, from the
  // attacker's inner edge to the base's. Redrawn on resize.
  function drawLines() {
    var board = document.getElementById('wpBoard');
    var svg = board && board.querySelector('.wp-lines');
    if (!svg) return;
    var box = svg.getBoundingClientRect();
    if (!box.width) return;
    var paths = '';
    var dots = '';
    Object.keys(S.plan).forEach(function (a) {
      var ra = board.querySelector('.wp-row--us[data-rank="' + a + '"]');
      S.plan[a].forEach(function (b) {
        var rb = board.querySelector('.wp-row--them[data-rank="' + b + '"]');
        if (!ra || !rb) return;
        var A = ra.getBoundingClientRect();
        var B = rb.getBoundingClientRect();
        var y1 = A.top + A.height / 2 - box.top;
        var y2 = B.top + B.height / 2 - box.top;
        var x2 = box.width;
        var k = pairState(+a, b).kind;
        var hot = S.sel && ((S.sel.side === 'us' && S.sel.rank === +a) || (S.sel.side === 'them' && S.sel.rank === b));
        var bend = x2 * 0.55;
        paths +=
          '<path class="wp-line is-' +
          k +
          (hot ? ' is-hot' : '') +
          '" d="M0 ' +
          y1.toFixed(1) +
          ' C' +
          bend.toFixed(1) +
          ' ' +
          y1.toFixed(1) +
          ' ' +
          (x2 - bend).toFixed(1) +
          ' ' +
          y2.toFixed(1) +
          ' ' +
          x2.toFixed(1) +
          ' ' +
          y2.toFixed(1) +
          '"/>';
        dots +=
          '<circle class="wp-end is-' + k + '" cx="1.5" cy="' + y1.toFixed(1) + '" r="3"/><circle class="wp-end is-' + k + '" cx="' + (x2 - 1.5).toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="3"/>';
      });
    });
    svg.setAttribute('viewBox', '0 0 ' + box.width.toFixed(1) + ' ' + box.height.toFixed(1));
    svg.innerHTML = paths + dots;
  }
  var resizeT = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      if (S) drawLines();
    }, 80);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && S && S.sel) {
      S.sel = null;
      drawBoard();
    }
  });

  /* ---- summary + warnings ---- */
  function drawSummary() {
    var war = S.war;
    var openBases = war.them.filter(function (b) {
      return !cleared(b) && !attackersOf(b.rank).length;
    });
    var coveredBases = war.them.filter(function (b) {
      return !cleared(b) && attackersOf(b.rank).length;
    }).length;
    var idle = war.us.filter(function (a) {
      var planned = (S.plan[a.rank] || []).filter(function (b) {
        return pairState(a.rank, b).kind === 'open';
      }).length;
      return left(a) - planned > 0;
    });
    var stillOpen = war.them.filter(function (b) {
      return !cleared(b);
    }).length;
    var warns = [];
    Object.keys(S.plan).forEach(function (a) {
      var att = war.us[a - 1];
      S.plan[a].forEach(function (b) {
        var base = war.them[b - 1];
        var k = pairState(+a, b).kind;
        if (k === 'waste') warns.push(['waste', '<b>#' + a + ' ' + esc(att.name) + '</b> is planned on #' + b + ', which already lost three stars.']);
        else if (k === 'spent') warns.push(['spent', '<b>#' + a + ' ' + esc(att.name) + '</b> has no attacks left for #' + b + '.']);
        else if (k === 'open' && att.th < base.th) warns.push(['up', '<b>#' + a + '</b> (TH' + att.th + ') is planned on #' + b + ' (TH' + base.th + '): attacking up.']);
      });
    });
    var sum = document.getElementById('wpSummary');
    sum.innerHTML =
      '<div class="wp-sum">' +
      fact('Bases to 3-star', stillOpen + '<i>/' + war.them.length + '</i>') +
      fact('Covered by the plan', coveredBases + '<i>/' + stillOpen + '</i>') +
      fact('Attacks unplanned', idle.reduce(function (t, a) {
        var planned = (S.plan[a.rank] || []).filter(function (b) {
          return pairState(a.rank, b).kind === 'open';
        }).length;
        return t + left(a) - planned;
      }, 0)) +
      fact('Warnings', warns.length, warns.length ? 'is-warn' : '') +
      '</div>' +
      (S.undo ? '<p class="wp-undo">' + S.undo.label + ' replaced your plan. <button type="button" data-undo>Undo</button></p>' : '');
    var u = sum.querySelector('[data-undo]');
    if (u)
      u.addEventListener('click', function () {
        S.plan = S.undo.plan;
        S.undo = null;
        savePlan();
        drawBoard();
      });
    var warnBox = document.getElementById('wpWarn');
    warnBox.innerHTML =
      warns.length || openBases.length
        ? '<div class="wp-warns">' +
          warns
            .map(function (w) {
              return '<p class="wp-warn is-' + w[0] + '">' + w[1] + '</p>';
            })
            .join('') +
          (openBases.length && openBases.length < war.them.length
            ? '<p class="wp-warn is-open">No one is on ' +
              openBases
                .map(function (b) {
                  return '#' + b.rank;
                })
                .join(', ') +
              ' yet.</p>'
            : '') +
          '</div>'
        : '';
  }
  function fact(label, value, cls) {
    return '<div class="wp-fact ' + (cls || '') + '"><span>' + label + '</span><b>' + value + '</b></div>';
  }

  /* ---- send ---- */
  function planLink() {
    return location.origin + location.pathname + location.search;
  }
  function planText() {
    var war = S.war;
    var w = war.w;
    var when =
      w.state === 'preparation'
        ? 'Battle day starts ' + new Date(apiTime(w.startTime)).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
        : w.state === 'inWar'
          ? 'Ends ' + new Date(apiTime(w.endTime)).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
          : 'War over';
    var lines = ['WAR PLAN: ' + war.usSide.name + ' vs ' + war.themSide.name, war.label + ' · ' + when, ''];
    war.us.forEach(function (att) {
      var t = (S.plan[att.rank] || []).filter(function (b) {
        return pairState(att.rank, b).kind !== 'done';
      });
      if (!t.length) return;
      lines.push(
        att.rank +
          '. ' +
          att.name +
          ' (TH' +
          att.th +
          ') → ' +
          t
            .map(function (b) {
              return '#' + b + ' TH' + war.them[b - 1].th;
            })
            .join(', '),
      );
    });
    var open = war.them.filter(function (b) {
      return !cleared(b) && !attackersOf(b.rank).length;
    });
    if (open.length)
      lines.push(
        '',
        'Free bases: ' +
          open
            .map(function (b) {
              return '#' + b.rank;
            })
            .join(', '),
      );
    lines.push('', 'Live plan: ' + planLink());
    return lines.join('\n');
  }
  function send(b) {
    var label = b.querySelector('span');
    var old = label.textContent;
    var text = b.dataset.send === 'link' ? planLink() : planText();
    var done = function (t) {
      label.textContent = t;
      setTimeout(function () {
        label.textContent = old;
      }, 1800);
    };
    if (!encodePlan(S.plan)) return done('Plan is empty');
    if (navigator.clipboard)
      navigator.clipboard.writeText(text).then(
        function () {
          done('Copied');
        },
        function () {
          done('Couldn’t copy');
        },
      );
    else done('Couldn’t copy');
  }

  /* ---- line-up: Town Hall counts side by side ---- */
  function lineupHtml() {
    var war = S.war;
    var count = function (list) {
      var c = {};
      list.forEach(function (m) {
        c[m.th] = (c[m.th] || 0) + 1;
      });
      return c;
    };
    var a = count(war.us);
    var b = count(war.them);
    var ths = Object.keys(a)
      .concat(Object.keys(b))
      .map(Number)
      .filter(function (t, i, all) {
        return all.indexOf(t) === i;
      })
      .sort(function (x, y) {
        return y - x;
      });
    var max = Math.max.apply(
      null,
      ths.map(function (t) {
        return Math.max(a[t] || 0, b[t] || 0);
      }),
    );
    var avg = function (list) {
      return (
        list.reduce(function (t, m) {
          return t + m.th;
        }, 0) / list.length
      ).toFixed(1);
    };
    return (
      '<section class="am wp-lineup" aria-labelledby="wpLineTitle"><header class="am-head"><div><h2 class="am-title" id="wpLineTitle">Line-up</h2><div class="cv-say"><img class="cv-face" src="/images/coc/villager/face-flat.webp" alt="" width="44" height="44" loading="lazy" decoding="async"><p><b>Villager</b>Town Halls on each side. Average TH ' +
      avg(war.us) +
      ' against ' +
      avg(war.them) +
      '.</p></div></div></header><div class="am-part"><div class="wp-mix">' +
      ths
        .map(function (t) {
          var x = a[t] || 0;
          var y = b[t] || 0;
          return (
            '<div class="wp-mix-row"><span class="wp-mix-n ' +
            (x > y ? 'is-more' : '') +
            '">' +
            x +
            '</span><span class="wp-mix-bar is-us"><i style="width:' +
            ((x / max) * 100).toFixed(1) +
            '%"></i></span><span class="wp-mix-th"><img src="' +
            thIcon(t) +
            '" alt="" width="28" height="28" />TH' +
            t +
            '</span><span class="wp-mix-bar is-them"><i style="width:' +
            ((y / max) * 100).toFixed(1) +
            '%"></i></span><span class="wp-mix-n ' +
            (y > x ? 'is-more' : '') +
            '">' +
            y +
            '</span></div>'
          );
        })
        .join('') +
      '</div><div class="wp-mix-key"><span>' +
      esc(war.usSide.name) +
      '</span><span>' +
      esc(war.themSide.name) +
      '</span></div></div></section>'
    );
  }

  drawQuick();
  route();
})();
