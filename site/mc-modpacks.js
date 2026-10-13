/* /minecraft/java/mods (Oct 13 2026): builds the modpack grid + filter chips,
   the single mods, launchers, essential mods and links from /mc-modpacks.json,
   and the live Modrinth leaderboard with Modpacks / Mods tabs (api.modrinth.com,
   CORS open, no key; rows reuse the home's .mch-st-* standings).
   Styles: MODPACKS PAGE (+ PACKS PAGE, SEEDS PAGE) in mc-home.css. */
(function () {
  var grid = document.getElementById('mpGrid');
  if (!grid) return;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function favicon(site, size) {
    return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(site) + '&sz=' + (size || 64);
  }
  function card(p, tags) {
    var site = /modrinth\.com/.test(p.href) ? 'modrinth.com' : 'curseforge.com';
    return '<a class="mch-mod" href="' + esc(p.href) + '" target="_blank" rel="noopener">' +
      '<div class="mch-mod-media"><img src="' + esc(p.img) + '" alt="" loading="lazy" decoding="async"></div>' +
      '<h3 class="mch-mod-name">' + esc(p.name) + '</h3>' +
      '<p class="mch-mod-by"><img src="' + esc(p.icon) + '" alt="" loading="lazy">' + esc(p.by) + '</p>' +
      '<p class="mch-mod-desc">' + esc(p.desc) + '</p>' +
      '<span class="mch-mod-foot"><span class="mch-src"><img src="' + favicon(site) + '" alt="" loading="lazy">' + (site === 'modrinth.com' ? 'Modrinth' : 'CurseForge') + '</span>' +
      (tags ? '<span class="mch-mod-tags">' + p.tags.map(function (t) { return esc(tags[t] || t); }).join(' · ') + '</span>' : '') + '</span></a>';
  }

  fetch('/mc-modpacks.json')
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function (data) {
      var packs = data.modpacks;
      var tags = data.tags;
      var hero = document.getElementById('mpHeroCount');
      if (hero) hero.textContent = packs.length;

      grid.innerHTML = packs.map(function (p) { return card(p, tags); }).join('');
      document.getElementById('singleGrid').innerHTML = data.mods.map(function (p) { return card(p, tags); }).join('');

      // Chips: All + every tag. A pack with two tags shows under both.
      var chips = document.getElementById('mpChips');
      var find = document.getElementById('mpFind');
      chips.innerHTML = '<button type="button" class="mch-chip" data-tag="all" aria-pressed="true">All<span data-n></span></button>' +
        Object.keys(tags).map(function (t) {
          return '<button type="button" class="mch-chip" data-tag="' + t + '" aria-pressed="false">' + esc(tags[t]) + '<span data-n></span></button>';
        }).join('');
      var cards = Array.prototype.slice.call(grid.children);
      var active = 'all';
      function apply() {
        var q = find.value.trim().toLowerCase();
        var hitsQ = packs.map(function (p) {
          return !q || (p.name + ' ' + p.by + ' ' + p.desc + ' ' + p.tags.join(' ')).toLowerCase().indexOf(q) > -1;
        });
        var shown = 0;
        packs.forEach(function (p, i) {
          var ok = hitsQ[i] && (active === 'all' || p.tags.indexOf(active) > -1);
          cards[i].hidden = !ok;
          if (ok) shown++;
        });
        chips.querySelectorAll('.mch-chip').forEach(function (c) {
          var t = c.getAttribute('data-tag');
          var n = packs.filter(function (p, i) { return hitsQ[i] && (t === 'all' || p.tags.indexOf(t) > -1); }).length;
          c.querySelector('[data-n]').textContent = n;
          c.disabled = !n && t !== active;
        });
        document.getElementById('mpCount').textContent = shown === packs.length ? packs.length + ' modpacks' : shown + ' of ' + packs.length + ' modpacks';
        document.getElementById('mpEmpty').hidden = shown > 0;
        document.getElementById('mpEmptyQ').textContent = q ? '“' + find.value.trim() + '”' : 'this filter';
      }
      chips.addEventListener('click', function (e) {
        var chip = e.target.closest('.mch-chip');
        if (!chip || chip.disabled) return;
        active = chip.getAttribute('data-tag');
        chips.querySelectorAll('.mch-chip').forEach(function (c) {
          c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
        });
        apply();
      });
      find.addEventListener('input', apply);
      document.getElementById('mpReset').addEventListener('click', function () {
        find.value = '';
        chips.querySelector('[data-tag="all"]').click();
      });
      apply();

      document.getElementById('launcherGrid').innerHTML = data.launchers.map(function (l, i) {
        return '<a class="mch-launcher' + (i === 0 ? ' is-top' : '') + '" href="' + esc(l.href) + '" target="_blank" rel="noopener">' +
          '<img src="' + favicon(l.site, 128) + '" alt="" loading="lazy">' +
          '<span class="mch-launcher-tag">' + esc(l.tag) + '</span>' +
          '<h3>' + esc(l.name) + '</h3><p>' + esc(l.desc) + '</p>' +
          '<span class="mch-launcher-go">Download<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M10 6H4v14h14v-6"/></svg></span></a>';
      }).join('');
      document.getElementById('essGrid').innerHTML = data.essentials.map(function (m) {
        return '<a class="mch-ess-item" href="' + esc(m.href) + '" target="_blank" rel="noopener"><img src="' + esc(m.icon) + '" alt="" loading="lazy">' +
          '<span><b>' + esc(m.name) + '</b><small>' + esc(m.desc) + '</small></span></a>';
      }).join('');
      document.getElementById('linkRow').innerHTML = '<span class="mch-linkrow-label">More mods at</span>' + data.links.map(function (l) {
        return '<a class="mch-src mch-linkpill" href="' + esc(l.href) + '" target="_blank" rel="noopener"><img src="' + favicon(l.site) + '" alt="" loading="lazy">' + esc(l.name) + '</a>';
      }).join('');
    })
    .catch(function () {
      grid.innerHTML = '<p class="mch-sfail">The modpack list did not load. Refresh the page to try again.</p>';
    });

  // ---- Live: Modrinth top 10, Modpacks or Mods ----
  var board = document.getElementById('mrBoard');
  if (!board) return;
  var all = document.getElementById('mrAll');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('#mc-modrinth .mch-tab'));
  var compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
  var LOADERS = { fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge', quilt: 'Quilt' };
  var cache = {};
  function ago(iso) {
    var d = Math.max(0, Math.round((Date.now() - new Date(iso)) / 864e5));
    if (d < 1) return 'Today';
    if (d < 31) return d + (d === 1 ? ' day ago' : ' days ago');
    var m = Math.round(d / 30.4);
    if (m < 12) return m + (m === 1 ? ' month ago' : ' months ago');
    var y = Math.round(d / 365);
    return y + (y === 1 ? ' year ago' : ' years ago');
  }
  function draw(type, hits) {
    var max = hits.length ? hits[0].downloads : 1;
    board.innerHTML = hits.map(function (h, i) {
      var loaders = (h.categories || []).filter(function (c) { return LOADERS[c]; }).map(function (c) { return LOADERS[c]; }).join(' · ');
      return '<a class="mch-st-row" role="row" href="https://modrinth.com/' + type + '/' + esc(h.slug) + '" target="_blank" rel="noopener">' +
        '<span class="mch-st-rank" role="cell">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="mch-st-server" role="cell"><img src="' + esc(h.icon_url || '') + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' +
          '<span><b>' + esc(h.title) + '</b><small>' + esc(h.description) + '</small></span></span>' +
        '<span class="mch-st-mode" role="cell">' + (loaders || '&mdash;') + '</span>' +
        '<span class="mch-st-players" role="cell"><span class="mch-st-count"><b>' + compact.format(h.downloads) + '</b> downloads</span>' +
          '<span class="mch-st-bar"><i style="width:' + Math.max(2, Math.round(h.downloads / max * 100)) + '%"></i></span></span>' +
        '<span class="mch-st-when" role="cell">' + ago(h.date_modified) + '</span></a>';
    }).join('');
    board.removeAttribute('aria-busy');
  }
  function load(type) {
    all.href = 'https://modrinth.com/' + type + 's?s=downloads';
    all.firstChild.textContent = type === 'mod' ? 'All mods on Modrinth' : 'All modpacks on Modrinth';
    if (cache[type]) return draw(type, cache[type]);
    board.setAttribute('aria-busy', 'true');
    board.innerHTML = '<div class="mch-st-loading">Loading the Modrinth top 10&hellip;</div>';
    fetch('https://api.modrinth.com/v2/search?limit=10&index=downloads&facets=' + encodeURIComponent('[["project_type:' + type + '"]]'))
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (res) {
        cache[type] = res.hits;
        if (tabs.some(function (t) { return t.classList.contains('is-on') && t.getAttribute('data-type') === type; })) draw(type, res.hits);
      })
      .catch(function () {
        board.removeAttribute('aria-busy');
        board.innerHTML = '<div class="mch-st-loading">Modrinth did not answer. The list will be back when it does.</div>';
      });
  }
  tabs.forEach(function (t, i) {
    function pick() {
      tabs.forEach(function (o) {
        var on = o === t;
        o.classList.toggle('is-on', on);
        o.setAttribute('aria-selected', on ? 'true' : 'false');
        o.tabIndex = on ? 0 : -1;
      });
      board.setAttribute('aria-labelledby', t.id);
      load(t.getAttribute('data-type'));
    }
    t.addEventListener('click', pick);
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      var next = tabs[(i + d + tabs.length) % tabs.length];
      next.click();
      next.focus();
    });
  });
  load('modpack');
})();
