/* =======================================================================
   HUB MENUS (Clash of Clans) -- the lists under Layouts / Armies / Tools in
   the top bar. Loaded on every CoC page, Clash home included. This file
   only supplies the CoC data; the menus themselves (hover, keyboard,
   placement, counts) are the shared engine, window.stbHubMenus in
   11layout.js, styled by HUB MENUS in 11layout.css.
   Reads coc-nav-data.json itself, so it doesn't matter which script built
   the links (th-layouts.js on most pages, an inline copy on Clash home): it
   waits for them to appear in #stbHubNavScroll, then adds the menus.
   ======================================================================= */
(function () {
  var hubScroll = document.getElementById('stbHubNavScroll');
  if (!hubScroll || !window.fetch) return;

  // Which menu a link opens: its data-hub key, else its label.
  var BY_LABEL = { layouts: 'layouts', armies: 'armies', army: 'armies', tools: 'guides', guides: 'guides' };
  function keyOf(link) {
    return link.getAttribute('data-hub') || BY_LABEL[link.textContent.trim().toLowerCase()] || '';
  }

  var data = fetch('/coc-nav-data.json').then(function (r) {
    return r.json();
  });
  function ready() {
    if (!hubScroll.querySelector('.stb-hub-link') || !window.stbHubMenus) return false;
    data.then(build).catch(function () {});
    return true;
  }
  if (!ready()) {
    var mo = new MutationObserver(function () {
      if (ready()) mo.disconnect();
    });
    mo.observe(hubScroll, { childList: true });
  }

  // Town Hall 18 -> 8 (layout or army counts read from each TH's JSON, the
  // same files the Clash home cards count), and the tools (Player Tracker
  // first, coming soon ones tagged).
  function build(data) {
    var ths = data.townhalls || [];
    function num(th) {
      return th.label.replace(/^TH/i, '');
    }
    window.stbHubMenus(hubScroll, {
      keyOf: keyOf,
      labels: { layouts: 'Layouts', armies: 'Armies', guides: 'Tools' },
      countWords: { bases: ['layout', 'layouts'], armies: ['army', 'armies'] },
      lists: {
        layouts: ths.map(function (th) {
          var n = num(th);
          return n === '8'
            ? { href: th.layoutHref, icon: th.layoutIcon, name: 'Town Hall 8', meta: 'Coming soon' }
            : { href: th.layoutHref, icon: th.layoutIcon, name: 'Town Hall ' + n, src: '/th' + n + '-layouts.json', kind: 'bases' };
        }),
        armies: ths.map(function (th) {
          var n = num(th);
          return { href: th.armyHref, icon: th.armyIcon, name: 'Town Hall ' + n, src: '/th' + n + '-army.json', kind: 'armies' };
        }),
        guides: (data.upcoming || [])
          .map(function (u) {
            return { href: u.href, icon: u.icon, name: u.name, sub: u.desc, soon: true };
          })
          .concat(
            (data.guides || []).map(function (g) {
              return { href: g.href, icon: g.icon, name: g.name, sub: g.desc };
            }),
          ),
      },
    });
  }
})();
