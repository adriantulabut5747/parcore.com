/* /minecraft/java/shaders (Oct 13 2026): builds the shader grid + filter chips
   from /mc-shaders.json, then asks Modrinth (one bulk call, CORS open, no key)
   for live downloads and the PC tier of every shader that has a "modrinth" slug.
   Also fills the Modrinth top 10 (rows reuse the home's .mch-st-* standings).
   Styles: SHADERS PAGE (+ MODPACKS / PACKS / SEEDS PAGE) in mc-home.css. */
(function () {
  var grid = document.getElementById('shGrid');
  if (!grid) return;
  var API = 'https://api.modrinth.com/v2/';
  var compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
  // Modrinth's performance categories for shaders, lightest first.
  var TIERS = ['potato', 'low', 'medium', 'high', 'screenshot'];
  var TIER_LABEL = { potato: 'Any PC', low: 'Low-end PC', medium: 'Mid-range PC', high: 'High-end PC', screenshot: 'Screenshots' };
  // Authors often tick a range; their main (featured) categories say which tier
  // the shader is built for, so those win. Extra categories are only a fallback.
  function lightest(cats) {
    for (var i = 0; i < TIERS.length; i++) if (cats.indexOf(TIERS[i]) > -1) return TIERS[i];
    return '';
  }
  function tier(main, extra) {
    return lightest(main || []) || lightest(extra || []);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function favicon(site) {
    return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(site) + '&sz=64';
  }
  function card(p, tags) {
    var site = p.modrinth ? 'modrinth.com' : p.site;
    return '<a class="mch-mod" href="' + esc(p.href) + '" target="_blank" rel="noopener"' + (p.modrinth ? ' data-mr="' + esc(p.modrinth) + '"' : '') + '>' +
      '<div class="mch-mod-media"><img src="' + esc(p.img) + '" alt="" loading="lazy" decoding="async"><span class="mch-tier" hidden></span></div>' +
      '<h3 class="mch-mod-name">' + esc(p.name) + '</h3>' +
      (p.by ? '<p class="mch-mod-by">' + (p.icon ? '<img src="' + esc(p.icon) + '" alt="" loading="lazy">' : '') + esc(p.by) + '</p>' : '') +
      '<p class="mch-mod-desc">' + esc(p.desc) + '</p>' +
      '<span class="mch-mod-foot"><span class="mch-src"><img src="' + favicon(site) + '" alt="" loading="lazy">' + esc(p.modrinth ? 'Modrinth' : p.source) + '</span>' +
      '<span class="mch-mod-tags">' + p.tags.map(function (t) { return esc(tags[t] || t); }).join(' · ') + '</span>' +
      '<span class="mch-mod-dl"></span></span></a>';
  }

  fetch('/mc-shaders.json')
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function (data) {
      var list = data.shaders;
      var tags = data.tags;
      var hero = document.getElementById('shHeroCount');
      if (hero) hero.textContent = list.length;
      grid.innerHTML = list.map(function (p) { return card(p, tags); }).join('');
      var cards = Array.prototype.slice.call(grid.children);

      var chips = document.getElementById('shChips');
      var find = document.getElementById('shFind');
      chips.innerHTML = '<button type="button" class="mch-chip" data-tag="all" aria-pressed="true">All<span data-n></span></button>' +
        Object.keys(tags).map(function (t) {
          return '<button type="button" class="mch-chip" data-tag="' + t + '" aria-pressed="false">' + esc(tags[t]) + '<span data-n></span></button>';
        }).join('');
      var active = 'all';
      function apply() {
        var q = find.value.trim().toLowerCase();
        // Card text includes the live tier once Modrinth answers, so "low-end" finds light shaders.
        var hitQ = cards.map(function (el) { return !q || el.textContent.toLowerCase().indexOf(q) > -1; });
        var shown = 0;
        list.forEach(function (p, i) {
          var ok = hitQ[i] && (active === 'all' || p.tags.indexOf(active) > -1);
          cards[i].hidden = !ok;
          if (ok) shown++;
        });
        chips.querySelectorAll('.mch-chip').forEach(function (c) {
          var t = c.getAttribute('data-tag');
          var n = list.filter(function (p, i) { return hitQ[i] && (t === 'all' || p.tags.indexOf(t) > -1); }).length;
          c.querySelector('[data-n]').textContent = n;
          c.disabled = !n && t !== active;
        });
        document.getElementById('shCount').textContent = shown === list.length ? list.length + ' shaders' : shown + ' of ' + list.length + ' shaders';
        document.getElementById('shEmpty').hidden = shown > 0;
        document.getElementById('shEmptyQ').textContent = q ? '“' + find.value.trim() + '”' : 'this filter';
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
      document.getElementById('shReset').addEventListener('click', function () {
        find.value = '';
        chips.querySelector('[data-tag="all"]').click();
      });
      apply();

      // Live: downloads + PC tier for every Modrinth shader, one request.
      var slugs = list.filter(function (p) { return p.modrinth; }).map(function (p) { return p.modrinth; });
      if (!slugs.length) return;
      fetch(API + 'projects?ids=' + encodeURIComponent(JSON.stringify(slugs)))
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          return r.json();
        })
        .then(function (projects) {
          projects.forEach(function (pr) {
            var el = grid.querySelector('[data-mr="' + pr.slug + '"]');
            if (!el) return;
            el.querySelector('.mch-mod-dl').textContent = compact.format(pr.downloads) + ' downloads';
            var t = tier(pr.categories, pr.additional_categories);
            if (t) {
              var badge = el.querySelector('.mch-tier');
              badge.textContent = TIER_LABEL[t];
              badge.setAttribute('data-tier', t);
              badge.hidden = false;
            }
          });
          apply();
        })
        .catch(function () {});
    })
    .catch(function () {
      grid.innerHTML = '<p class="mch-sfail">The shader list did not load. Refresh the page to try again.</p>';
    });

  // ---- Live: Modrinth's 10 most-downloaded shaders ----
  var board = document.getElementById('mrBoard');
  if (!board) return;
  function ago(iso) {
    var d = Math.max(0, Math.round((Date.now() - new Date(iso)) / 864e5));
    if (d < 1) return 'Today';
    if (d < 31) return d + (d === 1 ? ' day ago' : ' days ago');
    var m = Math.round(d / 30.4);
    if (m < 12) return m + (m === 1 ? ' month ago' : ' months ago');
    var y = Math.round(d / 365);
    return y + (y === 1 ? ' year ago' : ' years ago');
  }
  fetch(API + 'search?limit=10&index=downloads&facets=' + encodeURIComponent('[["project_type:shader"]]'))
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function (res) {
      var max = res.hits.length ? res.hits[0].downloads : 1;
      board.innerHTML = res.hits.map(function (h, i) {
        var t = tier(h.display_categories, h.categories);
        return '<a class="mch-st-row" role="row" href="https://modrinth.com/shader/' + esc(h.slug) + '" target="_blank" rel="noopener">' +
          '<span class="mch-st-rank" role="cell">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<span class="mch-st-server" role="cell"><img src="' + esc(h.icon_url || '') + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' +
            '<span><b>' + esc(h.title) + '</b><small>' + esc(h.author) + '</small></span></span>' +
          '<span class="mch-st-mode" role="cell">' + (t ? '<span class="mch-tier is-inline" data-tier="' + t + '">' + TIER_LABEL[t] + '</span>' : '&mdash;') + '</span>' +
          '<span class="mch-st-players" role="cell"><span class="mch-st-count"><b>' + compact.format(h.downloads) + '</b> downloads</span>' +
            '<span class="mch-st-bar"><i style="width:' + Math.max(2, Math.round(h.downloads / max * 100)) + '%"></i></span></span>' +
          '<span class="mch-st-when" role="cell">' + ago(h.date_modified) + '</span></a>';
      }).join('');
      board.removeAttribute('aria-busy');
    })
    .catch(function () {
      board.removeAttribute('aria-busy');
      board.innerHTML = '<div class="mch-st-loading">Modrinth did not answer. The list will be back when it does.</div>';
    });
})();
