/* /minecraft/java/resource-packs (Oct 13 2026): builds the category grids and
   the filter chips from /mc-packs.json (All by default; a chip shows only its
   group; search works inside the chosen group), and fills the live Modrinth
   leaderboard (api.modrinth.com, CORS open, no key). The leaderboard reuses the
   home's server standings rows (.mch-st-*). Styles: PACKS PAGE in mc-home.css. */
(function () {
  var groupsBox = document.getElementById('packGroups');
  if (!groupsBox) return;
  var chips = document.getElementById('packChips');
  var find = document.getElementById('packFind');
  var count = document.getElementById('packCount');
  var empty = document.getElementById('packEmpty');

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function favicon(site) {
    return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(site) + '&sz=64';
  }
  // Same card as Worlds / shaders / modpacks / data packs ("PACK CARDS" in mc-home.css).
  function card(p, i, label) {
    return '<a class="mch-mod" href="' + esc(p.href) + '" target="_blank" rel="noopener">' +
      '<div class="mch-mod-media"><img src="' + esc(p.img) + '" alt="" loading="lazy" decoding="async"><span class="mch-mod-rank">' + String(i + 1).padStart(2, '0') + '</span></div>' +
      '<h3 class="mch-mod-name">' + esc(p.name) + '</h3>' +
      (p.by ? '<span class="mch-mod-author">by ' + esc(p.by) + '</span>' : '') +
      '<p class="mch-mod-desc">' + esc(p.desc) + '</p>' +
      '<p class="mch-scard-tags">' + esc(label) + '</p>' +
      '<span class="mch-src"><img src="' + favicon(p.site) + '" alt="" loading="lazy"><b>' + esc(p.source) + '</b></span></a>';
  }

  fetch('/mc-packs.json')
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function (data) {
      var packs = data.packs;
      var hero = document.getElementById('packHeroCount');
      if (hero) hero.textContent = packs.length;

      var cats = data.categories.filter(function (c) {
        return packs.some(function (p) { return p.cat === c.key; });
      });
      groupsBox.innerHTML = cats.map(function (c) {
        var mine = packs.filter(function (p) { return p.cat === c.key; });
        return '<section class="mch-pgroup" id="cat-' + c.key + '" aria-labelledby="cat-' + c.key + '-t">' +
          '<header class="mch-pgroup-head"><h4 id="cat-' + c.key + '-t">' + esc(c.label) + '<span data-n>' + mine.length + '</span></h4><p>' + esc(c.sub) + '</p></header>' +
          '<div class="mch-mods mch-mods--grid mch-mods--cards" style="--cols:5">' + mine.map(function (p, i) { return card(p, i, c.label); }).join('') + '</div></section>';
      }).join('');
      chips.innerHTML = '<button type="button" class="mch-chip" data-cat="all" aria-pressed="true">All<span data-n>' + packs.length + '</span></button>' +
        cats.map(function (c) {
          return '<button type="button" class="mch-chip" data-cat="' + c.key + '" aria-pressed="false">' + esc(c.label) + '<span data-n></span></button>';
        }).join('');

      var active = 'all';
      var cards = Array.prototype.slice.call(groupsBox.querySelectorAll('.mch-mod'));
      var hay = cards.map(function (el) { return el.textContent.toLowerCase(); });
      function apply() {
        var q = find.value.trim().toLowerCase();
        cards.forEach(function (el, i) {
          el.hidden = !!q && hay[i].indexOf(q) < 0;
        });
        var total = 0;
        var shown = 0;
        cats.forEach(function (c) {
          var g = document.getElementById('cat-' + c.key);
          var n = g.querySelectorAll('.mch-mod:not([hidden])').length;
          var on = active === 'all' || active === c.key;
          total += n;
          if (on) shown += n;
          g.hidden = !on || !n;
          g.querySelector('[data-n]').textContent = n;
          // Chip counts follow the search, so a chip never promises packs that aren't there.
          var chip = chips.querySelector('[data-cat="' + c.key + '"]');
          chip.querySelector('[data-n]').textContent = n;
          chip.disabled = !n && active !== c.key;
        });
        chips.querySelector('[data-cat="all"] [data-n]').textContent = total;
        count.textContent = shown === packs.length ? packs.length + ' packs' : shown + ' of ' + packs.length + ' packs';
        empty.hidden = shown > 0;
        document.getElementById('packEmptyQ').textContent = q ? '“' + find.value.trim() + '”' : 'this filter';
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
      document.getElementById('packReset').addEventListener('click', function () {
        find.value = '';
        chips.querySelector('[data-cat="all"]').click();
        find.focus();
      });
      apply();
    })
    .catch(function () {
      groupsBox.innerHTML = '<p class="mch-sfail">The pack list did not load. Refresh the page to try again.</p>';
    });

  // ---- Live: Modrinth's most-downloaded resource packs, as a leaderboard ----
  var board = document.getElementById('mrBoard');
  if (!board) return;
  // Asks for 25 and keeps 10: language packs (locale) and add-ons for mods
  // (modded) are resource packs to Modrinth but not what this page lists.
  var url = 'https://api.modrinth.com/v2/search?limit=25&index=downloads&facets=' +
    encodeURIComponent('[["project_type:resourcepack"]]');
  var compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
  var RES = /^(\d+x\+?|8x-|512x\+)$/;
  var LABEL = { 'vanilla-like': 'Vanilla-like', 'core-shaders': 'Core shaders', gui: 'GUI' };
  function style(cats) {
    var res = cats.filter(function (c) { return RES.test(c); });
    var rest = cats.filter(function (c) { return c !== 'minecraft' && !RES.test(c); }).slice(0, 2).map(function (c) {
      return LABEL[c] || c.charAt(0).toUpperCase() + c.slice(1);
    });
    // One resolution is a fact worth showing; a pack listing all of them says "any".
    if (res.length === 1) rest.unshift(res[0]);
    return rest.join(' · ');
  }
  function ago(iso) {
    var d = Math.max(0, Math.round((Date.now() - new Date(iso)) / 864e5));
    if (d < 1) return 'Today';
    if (d < 31) return d + (d === 1 ? ' day ago' : ' days ago');
    var m = Math.round(d / 30.4);
    if (m < 12) return m + (m === 1 ? ' month ago' : ' months ago');
    var y = Math.round(d / 365);
    return y + (y === 1 ? ' year ago' : ' years ago');
  }
  fetch(url)
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function (res) {
      var hits = res.hits.filter(function (h) {
        return !(h.categories || []).some(function (c) { return c === 'locale' || c === 'modded'; });
      }).slice(0, 10);
      var max = hits.length ? hits[0].downloads : 1;
      board.innerHTML = hits.map(function (h, i) {
        var pct = Math.max(2, Math.round(h.downloads / max * 100));
        return '<a class="mch-st-row" role="row" href="https://modrinth.com/resourcepack/' + esc(h.slug) + '" target="_blank" rel="noopener">' +
          '<span class="mch-st-rank" role="cell">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<span class="mch-st-server" role="cell"><img src="' + esc(h.icon_url || '') + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' +
            '<span><b>' + esc(h.title) + '</b><small>' + esc(h.description) + '</small></span></span>' +
          '<span class="mch-st-mode" role="cell">' + esc(style(h.categories || [])) + '</span>' +
          '<span class="mch-st-players" role="cell"><span class="mch-st-count"><b>' + compact.format(h.downloads) + '</b> downloads</span>' +
            '<span class="mch-st-bar"><i style="width:' + pct + '%"></i></span></span>' +
          '<span class="mch-st-when" role="cell">' + ago(h.date_modified) + '</span></a>';
      }).join('');
      board.removeAttribute('aria-busy');
    })
    .catch(function () {
      board.removeAttribute('aria-busy');
      board.innerHTML = '<div class="mch-st-loading">Modrinth did not answer. The list will be back when it does.</div>';
    });
})();
