/* /minecraft/java/seeds (Oct 13 2026): builds the featured seed, the filter
   chips and the seed cards from /mc-seeds.json. Copy buttons are handled by
   mc-home.js (.mch-copy[data-copy]); a shot opens the shared lightbox through
   window.openPalette (mc-java.js), which pages through the .pal-card items of
   the clicked .mch-shots group. Styles: the SEEDS PAGE block in mc-home.css. */
(function () {
  var grid = document.getElementById('seedGrid');
  if (!grid) return;
  var feature = document.getElementById('seedFeature');
  var chipsBox = document.getElementById('seedChips');
  var find = document.getElementById('seedFind');
  var count = document.getElementById('seedCount');
  var empty = document.getElementById('seedEmpty');

  var COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9h11v11H9zM5 15H4V4h11v1"/></svg>';
  var MAP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/></svg>';
  var CAM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  var ZOOM = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/></svg>';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  // Chunkbase at this seed, on the Java version the old page's links used.
  function mapUrl(s) {
    var u = 'https://www.chunkbase.com/apps/seed-map#seed=' + encodeURIComponent(s.seed) + '&platform=java_26_2&dimension=overworld';
    if (s.coords) u += '&x=' + s.coords.x + '&z=' + s.coords.z + '&zoom=0.5';
    return u;
  }
  function where(s) {
    return s.coords ? 'X ' + s.coords.x.toLocaleString('en-US') + ', Z ' + s.coords.z.toLocaleString('en-US') : 'At spawn';
  }
  // Every shot is a .pal-card so the lightbox can page through all of them;
  // only the first is drawn, the rest ride along hidden.
  function shots(s, cls) {
    return s.shots.map(function (src, i) {
      var label = '<span class="pal-card-label" hidden>' + esc(s.name) + '</span>';
      if (i === 0) {
        return '<button type="button" class="pal-card ' + cls + '" data-full="' + esc(src) + '" aria-label="View ' + esc(s.name) + ' screenshots">' +
          '<img src="' + esc(src) + '" alt="" loading="lazy" decoding="async">' + label +
          (s.shots.length > 1 ? '<span class="mch-shots-n">' + CAM + s.shots.length + ' shots</span>' : '') + '</button>';
      }
      return '<span class="pal-card" data-full="' + esc(src) + '" hidden>' + label + '</span>';
    }).join('');
  }
  // Seed number on its own line (they run to 20 digits), actions under it.
  function seedRow(s) {
    return '<div class="mch-seedrow"><code class="mch-seedval">' + esc(s.seed) + '</code>' +
      '<div class="mch-seedacts"><button type="button" class="mch-copy" data-copy="' + esc(s.seed) + '" aria-label="Copy seed ' + esc(s.seed) + '">' + COPY + '<span>Copy</span></button>' +
      '<a class="mch-copy mch-maplink" href="' + mapUrl(s) + '" target="_blank" rel="noopener" aria-label="Open ' + esc(s.name) + ' on Chunkbase">' + MAP + 'Map</a></div></div>';
  }

  function renderFeature(s, tags) {
    var thumbs = s.shots.map(function (src, i) {
      return '<button type="button" class="pal-card mch-sfeat-thumb' + (i === 0 ? ' is-on' : '') + '" data-full="' + esc(src) + '" aria-label="Shot ' + (i + 1) + ' of ' + s.shots.length + '">' +
        '<img src="' + esc(src) + '" alt="" loading="lazy" decoding="async"><span class="pal-card-label" hidden>' + esc(s.name) + '</span></button>';
    }).join('');
    feature.innerHTML =
      '<div class="mch-sfeat-media">' +
        '<button type="button" class="mch-sfeat-stage" id="sfeatStage" aria-label="Open ' + esc(s.name) + ' full size"><img id="sfeatImg" src="' + esc(s.shots[0]) + '" alt="' + esc(s.name) + '" decoding="async"><span class="mch-sfeat-zoom">' + ZOOM + 'Full size</span></button>' +
        '<div class="mch-sfeat-thumbs mch-shots" aria-label="Screenshots">' + thumbs + '</div>' +
      '</div>' +
      '<div class="mch-sfeat-info">' +
        '<h3 class="mch-sfeat-name">' + esc(s.name) + '</h3>' +
        '<p class="mch-sfeat-desc">' + esc(s.desc) + '</p>' +
        '<dl class="mch-sfeat-meta"><div><dt>Where</dt><dd>' + where(s) + '</dd></div><div><dt>Shots</dt><dd>' + s.shots.length + '</dd></div>' +
        (s.tags.length ? '<div><dt>Has</dt><dd>' + s.tags.map(function (t) { return esc(tags[t]); }).join(', ') + '</dd></div>' : '') + '</dl>' +
        seedRow(s) +
      '</div>';
    feature.removeAttribute('aria-busy');
    var stage = document.getElementById('sfeatStage');
    var img = document.getElementById('sfeatImg');
    var on = feature.querySelector('.mch-sfeat-thumb');
    // Thumbs pick the big picture; the big picture opens the lightbox on it.
    feature.querySelectorAll('.mch-sfeat-thumb').forEach(function (t) {
      t.addEventListener('click', function () {
        on.classList.remove('is-on');
        on = t;
        t.classList.add('is-on');
        img.src = t.getAttribute('data-full');
      });
    });
    stage.addEventListener('click', function () {
      if (typeof window.openPalette === 'function') window.openPalette(on);
    });
  }

  function card(s, tags) {
    return '<article class="mch-scard" id="seed-' + s.id + '">' +
      '<div class="mch-scard-media mch-shots">' + shots(s, 'mch-scard-shot') + '</div>' +
      '<div class="mch-scard-body">' +
        '<h3 class="mch-scard-name">' + esc(s.name) + '</h3>' +
        '<p class="mch-scard-desc">' + esc(s.desc) + '</p>' +
        // Spawn is the default, so only real coordinates earn a spot in the tag line.
        '<p class="mch-scard-tags">' + (s.coords ? [where(s)] : []).concat(s.tags.map(function (t) { return tags[t]; })).map(esc).join('<i aria-hidden="true"></i>') + '</p>' +
        seedRow(s) +
      '</div></article>';
  }

  fetch('/mc-seeds.json')
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function (data) {
      var seeds = data.seeds;
      var tags = data.tags;
      var heroCount = document.getElementById('seedHeroCount');
      if (heroCount) heroCount.textContent = seeds.length;

      renderFeature(seeds[0], tags);
      grid.innerHTML = seeds.map(function (s) { return card(s, tags); }).join('');
      grid.addEventListener('click', function (e) {
        var shot = e.target.closest('.mch-scard-shot');
        if (shot && typeof window.openPalette === 'function') window.openPalette(shot);
      });

      // Chips: All + every tag, with how many seeds carry it.
      var active = 'all';
      chipsBox.innerHTML = '<button type="button" class="mch-chip" data-tag="all" aria-pressed="true">All<span>' + seeds.length + '</span></button>' +
        Object.keys(tags).map(function (t) {
          var n = seeds.filter(function (s) { return s.tags.indexOf(t) > -1; }).length;
          return '<button type="button" class="mch-chip" data-tag="' + t + '" aria-pressed="false">' + esc(tags[t]) + '<span>' + n + '</span></button>';
        }).join('');

      var cards = Array.prototype.slice.call(grid.children);
      function apply() {
        var q = find.value.trim().toLowerCase();
        var shown = 0;
        seeds.forEach(function (s, i) {
          var hay = (s.name + ' ' + s.desc + ' ' + s.seed + ' ' + s.tags.map(function (t) { return tags[t]; }).join(' ')).toLowerCase();
          var ok = (active === 'all' || s.tags.indexOf(active) > -1) && (!q || hay.indexOf(q) > -1);
          cards[i].hidden = !ok;
          if (ok) shown++;
        });
        count.textContent = shown === seeds.length ? seeds.length + ' seeds' : shown + ' of ' + seeds.length + ' seeds';
        empty.hidden = shown > 0;
        document.getElementById('seedEmptyQ').textContent = q ? '“' + find.value.trim() + '”' : 'this filter';
      }
      chipsBox.addEventListener('click', function (e) {
        var chip = e.target.closest('.mch-chip');
        if (!chip) return;
        active = chip.getAttribute('data-tag');
        chipsBox.querySelectorAll('.mch-chip').forEach(function (c) {
          c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
        });
        apply();
      });
      find.addEventListener('input', apply);
      document.getElementById('seedReset').addEventListener('click', function () {
        find.value = '';
        chipsBox.querySelector('[data-tag="all"]').click();
      });
      apply();

      // Shared links (#seed-12) land on the card and mark it.
      var hit = location.hash && document.getElementById(location.hash.slice(1));
      if (hit && hit.classList.contains('mch-scard')) {
        hit.classList.add('is-target');
        hit.scrollIntoView({ block: 'center' });
      }
    })
    .catch(function () {
      feature.removeAttribute('aria-busy');
      feature.innerHTML = '';
      grid.innerHTML = '<p class="mch-sfail">The seed list did not load. Refresh the page to try again.</p>';
    });
})();
