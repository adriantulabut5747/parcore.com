// Full path of a link or address, e.g. "/coc/town-hall-18/layouts" -- the last
// part alone ("layouts") is the same for every Town Hall. "x.html", "x" and
// "x/index.html" count as the same page.
function cocPagePath(u) {
  var p = new URL(String(u || ''), location.origin + '/').pathname.toLowerCase();
  return p.replace(/\.html$/, '').replace(/\/index$/, '/').replace(/(.)\/$/, '$1');
}

/* coc-more.js -- the Layouts / Armies switch in the More sheet's body
   (every CoC page). One grid of Town Hall tiles per side; the switch shows
   one at a time. It starts on whichever section the page belongs to
   (army pages and the army maker open on Armies). Arrow keys move between
   the two tabs, as a tablist should. Styles: coc-more.css. */
(function () {
  var tabs = [document.getElementById('mxTabLayouts'), document.getElementById('mxTabArmies')];
  if (!tabs[0] || !tabs[1]) return;

  function select(i, focus) {
    tabs.forEach(function (t, j) {
      var on = i === j;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    if (focus) tabs[i].focus();
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () {
      select(i, false);
    });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        select(i === 0 ? 1 : 0, true);
      }
    });
  });

  var page = cocPagePath(location.pathname);
  select(/\/army$|army-maker/.test(page) ? 1 : 0, false);

  // The tiles themselves, from coc-nav-data.json -- the one list every CoC
  // page's sheet is built from (home included), so adding a TH or a tool
  // there updates them all. The Tools hub ("hub": true) is skipped: the
  // bottom nav's Tools button already goes there.
  function fill(role, html) {
    var box = document.querySelector('[data-role="' + role + '"]');
    if (box) box.innerHTML = html;
  }
  function on(href) {
    return cocPagePath(href) === page ? ' active' : '';
  }
  fetch('/coc-nav-data.json')
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      function thTiles(hrefKey, iconKey) {
        return data.townhalls
          .map(function (th) {
            return (
              '<a href="' + th[hrefKey] + '" class="mx-th' + on(th[hrefKey]) + '">' +
              '<img src="' + th[iconKey] + '" alt="' + th.label + '"><span>' + th.label + '</span></a>'
            );
          })
          .join('');
      }
      fill('more-layouts-grid', thTiles('layoutHref', 'layoutIcon'));
      fill('more-armies-grid', thTiles('armyHref', 'armyIcon'));
      fill(
        'more-guides-list',
        data.guides
          .filter(function (g) {
            return !g.hub;
          })
          .map(function (g) {
            var act = (g.activeOn || []).map(cocPagePath).indexOf(page) !== -1 ? ' active' : '';
            return (
              '<a href="' + g.href + '" class="mx-tool' + act + '">' +
              '<span class="mx-tool-ico"><img src="' + g.icon + '" alt=""></span>' +
              '<span class="mx-tool-name">' + g.label + '</span></a>'
            );
          })
          .join(''),
      );
    })
    .catch(function (err) {
      console.error('More sheet failed to load:', err);
    });
})();
