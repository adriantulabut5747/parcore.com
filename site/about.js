/* About pages (/about/*) — Nov 2 2026. Looks: about.css.
   1. [data-copy] keys copy their text (the contact email).
   2. [data-share] keys share / copy the site link (Support page).
   3. #abGames (/about/) = one tile per game, from sidebar.json (games + upcoming),
      art = the home page's Featured Games tiles.
   4. The side rail's "On this page" lights the section you're reading. */
(function () {
  document.addEventListener('click', function (e) {
    var key = e.target.closest('[data-copy], [data-share]');
    if (!key) return;
    e.preventDefault();
    var label = key.querySelector('em') || key.querySelector('span:not(.ab-ico)') || key;
    var was = label.textContent;
    function done(text) {
      label.textContent = text;
      key.classList.add('is-done');
      setTimeout(function () {
        label.textContent = was;
        key.classList.remove('is-done');
      }, 1800);
    }
    if (key.hasAttribute('data-share')) {
      var url = location.origin + '/';
      if (navigator.share) {
        navigator.share({ title: 'Parchrome', url: url }).catch(function () {});
        return;
      }
      navigator.clipboard.writeText(url).then(
        function () {
          done('Link copied');
        },
        function () {
          done(url);
        },
      );
      return;
    }
    navigator.clipboard.writeText(key.getAttribute('data-copy')).then(
      function () {
        done('Copied');
      },
      function () {
        done('Copy failed');
      },
    );
  });

  var games = document.getElementById('abGames');
  if (games) {
    fetch('/sidebar.json')
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        var list = (d.games || []).concat(d.upcoming || []);
        games.innerHTML = list
          .filter(function (g) {
            return g.card;
          })
          .map(function (g) {
            var c = g.card;
            var tag = g.link ? 'a href="' + g.link + '"' : 'div';
            var soon = c.soon || !g.link ? '<i>Coming soon</i>' : '';
            return (
              '<' +
              tag +
              ' class="ab-game" style="background-image:url(\'' +
              (c.tile || c.cover) +
              '\')">' +
              soon +
              '<b>' +
              (c.tileName || c.name) +
              '</b>' +
              (c.sub && !c.soon ? '<span>' + c.sub + '</span>' : '') +
              '</' +
              tag.split(' ')[0] +
              '>'
            );
          })
          .join('');
      })
      .catch(function () {
        games.closest('.ab-sec').hidden = true;
      });
  }

  var toc = document.querySelectorAll('.ab-toc a[href^="#"]');
  if (toc.length && 'IntersectionObserver' in window) {
    var byId = {};
    toc.forEach(function (a) {
      byId[a.getAttribute('href').slice(1)] = a;
    });
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          toc.forEach(function (a) {
            a.classList.remove('is-here');
          });
          if (byId[en.target.id]) byId[en.target.id].classList.add('is-here');
        });
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }
})();
