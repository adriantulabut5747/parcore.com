/* Minecraft Java commands (Oct 13 2026), from /mc-commands.json:
   - /minecraft/java/commands: search, filter chips and one terminal per category.
   - /minecraft/java/ home: the Popular commands terminal (entries with "home": 1-5).
   Rows match the home's terminal (.mch-term-row). Copy buttons are handled by
   mc-home.js (.mch-copy[data-copy]); the name opens the full command (openCmd,
   mc-java.js). Styles: COMMANDS PAGE in mc-home.css. */
(function () {
  var groupsBox = document.getElementById('cmdGroups');
  var homeList = document.getElementById('homeCmdList');
  if (!groupsBox && !homeList) return;
  var CHAT_LIMIT = 256; // longer than this and chat cuts it off: command block only

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function row(c) {
    var long = c.cmd.length > CHAT_LIMIT;
    var flags = (long ? '<em class="is-block" title="' + c.cmd.length + ' characters. Chat stops at 256.">Command block</em>' : '') +
      (c.untested ? '<em class="is-new" title="Written for this page, not tested in-game yet.">Untested</em>' : '');
    var ico = c.icon
      ? '<img class="mch-term-ico" src="' + esc(c.icon) + '" alt="" loading="lazy">'
      : '<span class="mch-term-ico mch-term-slash" aria-hidden="true">/</span>';
    return '<li class="mch-term-row">' + ico +
      '<div class="mch-term-main"><div class="mch-term-top">' +
        '<button type="button" class="mch-term-name" onclick="openCmd(this)" data-name="' + esc(c.name) + '" data-sub="' + esc(c.note) + '" data-cmd="' + esc(c.cmd) + '">' + esc(c.name) + '<span>' + esc(c.tag) + '</span></button>' +
        (flags ? '<span class="mch-term-flags">' + flags + '</span>' : '') +
      '</div><code class="mch-term-code">' + esc(c.cmd) + '</code></div>' +
      '<button type="button" class="mch-copy" data-copy="' + esc(c.cmd) + '" aria-label="Copy the ' + esc(c.name) + ' command"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h11v11H9zM5 15H4V4h11v1"/></svg><span>Copy</span></button></li>';
  }

  fetch('/mc-commands.json')
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function (data) {
      var list = data.commands;

      // Home: the five picked commands, in their "home" order.
      if (homeList) {
        homeList.innerHTML = list.filter(function (c) { return c.home; })
          .sort(function (a, b) { return a.home - b.home; }).map(row).join('');
      }
      if (!groupsBox) return;

      var hero = document.getElementById('cmdHeroCount');
      if (hero) hero.textContent = list.length;
      var cats = data.categories.filter(function (c) {
        return list.some(function (x) { return x.cat === c.key; });
      });
      groupsBox.innerHTML = cats.map(function (c) {
        var mine = list.filter(function (x) { return x.cat === c.key; });
        return '<section class="mch-pgroup" id="cat-' + c.key + '" aria-labelledby="cat-' + c.key + '-t">' +
          '<header class="mch-pgroup-head"><h4 id="cat-' + c.key + '-t">' + esc(c.label) + '<span data-n>' + mine.length + '</span></h4><p>' + esc(c.sub) + '</p></header>' +
          '<ul class="mch-term mch-term-list">' + mine.map(row).join('') + '</ul></section>';
      }).join('');

      var chips = document.getElementById('cmdChips');
      var find = document.getElementById('cmdFind');
      chips.innerHTML = '<button type="button" class="mch-chip" data-cat="all" aria-pressed="true">All<span data-n></span></button>' +
        cats.map(function (c) {
          return '<button type="button" class="mch-chip" data-cat="' + c.key + '" aria-pressed="false">' + esc(c.label) + '<span data-n></span></button>';
        }).join('');

      var rows = Array.prototype.slice.call(groupsBox.querySelectorAll('.mch-term-row'));
      var byRow = cats.reduce(function (acc, c) {
        return acc.concat(list.filter(function (x) { return x.cat === c.key; }));
      }, []);
      var hay = byRow.map(function (c) { return (c.name + ' ' + c.tag + ' ' + c.note + ' ' + c.cmd).toLowerCase(); });
      var active = 'all';
      function apply() {
        var q = find.value.trim().toLowerCase();
        rows.forEach(function (el, i) { el.hidden = !!q && hay[i].indexOf(q) < 0; });
        var total = 0;
        var shown = 0;
        cats.forEach(function (c) {
          var g = document.getElementById('cat-' + c.key);
          var n = g.querySelectorAll('.mch-term-row:not([hidden])').length;
          var on = active === 'all' || active === c.key;
          total += n;
          if (on) shown += n;
          g.hidden = !on || !n;
          g.querySelector('[data-n]').textContent = n;
          var chip = chips.querySelector('[data-cat="' + c.key + '"]');
          chip.querySelector('[data-n]').textContent = n;
          chip.disabled = !n && active !== c.key;
        });
        chips.querySelector('[data-cat="all"] [data-n]').textContent = total;
        document.getElementById('cmdCount').textContent = shown === list.length ? list.length + ' commands' : shown + ' of ' + list.length + ' commands';
        document.getElementById('cmdEmpty').hidden = shown > 0;
        document.getElementById('cmdEmptyQ').textContent = q ? '“' + find.value.trim() + '”' : 'this filter';
      }
      chips.addEventListener('click', function (e) {
        var chip = e.target.closest('.mch-chip');
        if (!chip || chip.disabled) return;
        active = chip.getAttribute('data-cat');
        chips.querySelectorAll('.mch-chip').forEach(function (c) {
          c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
        });
        apply();
      });
      find.addEventListener('input', apply);
      document.getElementById('cmdReset').addEventListener('click', function () {
        find.value = '';
        chips.querySelector('[data-cat="all"]').click();
      });
      apply();
    })
    .catch(function () {
      if (groupsBox) groupsBox.innerHTML = '<p class="mch-sfail">The command list did not load. Refresh the page to try again.</p>';
    });
})();
