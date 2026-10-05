/* =======================================================================
   HUB MENUS -- the secondary top bar's Layouts / Armies / Tools links open
   a list on hover (desktop with a mouse). Loaded on every CoC page,
   Clash home included; styles in coc-hub-menus.css. Reads coc-nav-data.json
   itself, so it doesn't matter which script built the links (th-layouts.js
   on most pages, an inline copy on Clash home): it waits for them to appear
   in #stbHubNavScroll, then adds the menus.
   ======================================================================= */
(function () {
  var hubScroll = document.getElementById('stbHubNavScroll');
  if (!hubScroll || !window.fetch) return;

  function normalize(u) {
    var p = new URL(String(u || ''), location.origin + '/').pathname.toLowerCase();
    return p.replace(/\.html$/, '').replace(/\/index$/, '/').replace(/(.)\/$/, '$1');
  }
  var currentPage = normalize(location.pathname);
  // Which menu a link opens: its data-hub key, else its label.
  var BY_LABEL = { layouts: 'layouts', armies: 'armies', army: 'armies', tools: 'guides', guides: 'guides' };
  function keyOf(link) {
    return link.getAttribute('data-hub') || BY_LABEL[link.textContent.trim().toLowerCase()] || '';
  }

  var data = fetch('/coc-nav-data.json').then(function (r) {
    return r.json();
  });
  function ready() {
    if (!hubScroll.querySelector('.stb-hub-link') || hubScroll.dataset.menus) return false;
    hubScroll.dataset.menus = '1';
    data.then(hubMenus).catch(function () {});
    return true;
  }
  if (!ready()) {
    var mo = new MutationObserver(function () {
      if (ready()) mo.disconnect();
    });
    mo.observe(hubScroll, { childList: true });
  }

  // ---- Hub menus (desktop, Oct 2026) ------------------------------------
  // Hovering Layouts / Armies / Tools in the top bar opens a list of what's
  // under it, one row each: Town Hall 18 -> 8 (layout or army counts read
  // from each TH's JSON, the same files the Clash home cards count), or the
  // tools (Player Tracker first, coming soon). Clicking the link itself still
  // navigates. Hover opens after a short pause so sweeping the mouse across
  // the bar doesn't flash menus; the gap between link and panel is bridged
  // by a close delay. Keyboard: Down arrow on a link opens it and moves into
  // the list, Up/Down walk it, Esc closes. Desktop with a mouse only -- the
  // hub links aren't in the phone layout. The panels hang off <body>, not
  // the strip: the strip scrolls sideways and would clip them.
  // Styles: HUB MENUS in th-layouts.css.
  function hubMenus(data) {
    var desk = window.matchMedia('(min-width: 971px) and (hover: hover)');
    var CHEV = '<svg class="hub-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>';
    var counts = {};
    function count(src) {
      if (!counts[src])
        counts[src] = fetch(src)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
      return counts[src];
    }
    function num(th) {
      return th.label.replace(/^TH/i, '');
    }
    function row(o) {
      var on = normalize(o.href) === currentPage;
      return (
        '<a class="stb-dd-row' +
        (on ? ' is-on' : '') +
        (o.soon ? ' is-soon' : '') +
        '" href="' +
        o.href +
        '"' +
        (on ? ' aria-current="page"' : '') +
        '><span class="stb-dd-ico"><img src="' +
        o.icon +
        '" alt="" loading="lazy" decoding="async"></span><span class="stb-dd-text"><span class="stb-dd-name">' +
        o.name +
        '</span>' +
        (o.sub ? '<span class="stb-dd-sub">' + o.sub + '</span>' : '') +
        '</span>' +
        (o.soon
          ? '<span class="stb-dd-tag">Soon</span>'
          : '<span class="stb-dd-meta"' + (o.src ? ' data-src="' + o.src + '" data-kind="' + o.kind + '"' : '') + '>' + (o.meta || '') + '</span>') +
        '</a>'
      );
    }
    var ths = data.townhalls || [];
    var lists = {
      layouts: ths.map(function (th) {
        var n = num(th);
        return row({
          href: th.layoutHref,
          icon: th.layoutIcon,
          name: 'Town Hall ' + n,
          src: n === '8' ? '' : '/th' + n + '-layouts.json',
          kind: 'bases',
          meta: n === '8' ? 'Coming soon' : '',
        });
      }),
      armies: ths.map(function (th) {
        var n = num(th);
        return row({ href: th.armyHref, icon: th.armyIcon, name: 'Town Hall ' + n, src: '/th' + n + '-army.json', kind: 'armies' });
      }),
      guides: (data.upcoming || [])
        .map(function (u) {
          return row({ href: u.href, icon: u.icon, name: u.name, sub: u.desc, soon: true });
        })
        .concat(
          (data.guides || []).map(function (g) {
            return row({ href: g.href, icon: g.icon, name: g.name, sub: g.desc });
          }),
        ),
    };
    var label = { layouts: 'Layouts', armies: 'Armies', guides: 'Tools' };

    var menus = {};
    var openKey = null;
    var openT = 0;
    var closeT = 0;

    hubScroll.querySelectorAll('.stb-hub-link').forEach(function (link) {
      var key = keyOf(link);
      if (!lists[key]) return;
      link.insertAdjacentHTML('beforeend', CHEV);
      var id = 'stbMenu-' + key;
      var panel = document.createElement('div');
      panel.className = 'stb-dd stb-dd--' + key;
      panel.id = id;
      panel.setAttribute('role', 'navigation');
      panel.setAttribute('aria-label', label[key]);
      panel.hidden = true;
      panel.innerHTML = '<div class="stb-dd-list">' + lists[key].join('') + '</div>';
      document.body.appendChild(panel);
      link.setAttribute('aria-controls', id);
      link.setAttribute('aria-expanded', 'false');
      menus[key] = { link: link, panel: panel, filled: false };

      link.addEventListener('mouseenter', function () {
        if (!desk.matches) return;
        clearTimeout(closeT);
        clearTimeout(openT);
        // Moving from one open menu to the next switches at once.
        openT = setTimeout(() => open(key), openKey ? 0 : 110);
      });
      link.addEventListener('mouseleave', function () {
        clearTimeout(openT);
        scheduleClose();
      });
      panel.addEventListener('mouseenter', () => clearTimeout(closeT));
      panel.addEventListener('mouseleave', scheduleClose);
      link.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' && desk.matches) {
          e.preventDefault();
          open(key);
          var first = panel.querySelector('.stb-dd-row');
          if (first) first.focus();
        } else if (e.key === 'Escape') close();
      });
      panel.addEventListener('keydown', function (e) {
        var rows = [].slice.call(panel.querySelectorAll('.stb-dd-row'));
        var i = rows.indexOf(document.activeElement);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          var next = rows[(i + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length];
          if (next) next.focus();
        } else if (e.key === 'Escape') {
          close();
          link.focus();
        }
      });
      panel.addEventListener('focusout', function (e) {
        if (!panel.contains(e.relatedTarget) && e.relatedTarget !== link) close();
      });
    });

    function scheduleClose() {
      clearTimeout(closeT);
      closeT = setTimeout(close, 180);
    }
    function place(m) {
      var r = m.link.getBoundingClientRect();
      var w = m.panel.offsetWidth;
      var left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
      m.panel.style.left = Math.round(left) + 'px';
      m.panel.style.top = Math.round(r.bottom + 8) + 'px';
      m.panel.style.maxHeight = Math.max(200, window.innerHeight - r.bottom - 24) + 'px';
    }
    function fill(m) {
      if (m.filled) return;
      m.filled = true;
      m.panel.querySelectorAll('.stb-dd-meta[data-src]').forEach(function (el) {
        count(el.getAttribute('data-src')).then(function (json) {
          var list = json && json[el.getAttribute('data-kind')];
          if (!Array.isArray(list)) return;
          var word = el.getAttribute('data-kind') === 'bases' ? 'layout' : 'army';
          el.textContent = list.length + ' ' + (list.length === 1 ? word : word === 'army' ? 'armies' : 'layouts');
        });
      });
    }
    function open(key) {
      var m = menus[key];
      if (!m) return;
      if (openKey && openKey !== key) close(true);
      fill(m);
      m.panel.hidden = false;
      place(m);
      // next frame, so the entrance transition runs from its start state
      requestAnimationFrame(() => m.panel.classList.add('is-open'));
      m.link.classList.add('is-open');
      m.link.setAttribute('aria-expanded', 'true');
      openKey = key;
    }
    function close(instant) {
      clearTimeout(closeT);
      if (!openKey) return;
      var m = menus[openKey];
      m.panel.classList.remove('is-open');
      m.link.classList.remove('is-open');
      m.link.setAttribute('aria-expanded', 'false');
      if (instant) m.panel.hidden = true;
      else setTimeout(() => !m.panel.classList.contains('is-open') && (m.panel.hidden = true), 150);
      openKey = null;
    }
    // Anything that moves the bar under the menu closes it.
    window.addEventListener('resize', () => close(true));
    document.addEventListener(
      'scroll',
      function (e) {
        // Only the page itself scrolling (the window, or .coc-main, which
        // scrolls the content on desktop). Sideways strips scroll on their
        // own after load (the TH strip centres its active chip), and that
        // used to snap a just-opened menu shut.
        var t = e.target;
        var page = t === document || t === document.documentElement || t === document.body || (t.classList && t.classList.contains('coc-main'));
        if (openKey && page) close(true);
      },
      { capture: true, passive: true },
    );
    desk.addEventListener && desk.addEventListener('change', () => close(true));
  }
})();
