// Full path of a link or address, e.g. "/coc/town-hall-18/layouts" -- the last
// part alone ("layouts") is the same for every Town Hall. "x.html", "x" and
// "x/index.html" count as the same page.
function cocPagePath(u) {
  var p = new URL(String(u || ''), location.origin + '/').pathname.toLowerCase();
  return p.replace(/\.html$/, '').replace(/\/index$/, '/').replace(/(.)\/$/, '$1');
}

/*
  coc-nav-loader.js
  ------------------
  Builds every TH18->TH8 nav block (desktop-sub-nav dropdowns, the
  more-sheet modal, the bottom nav "bn-item" links, and the desktop
  "dsn-link" primary links) from coc-nav-data.json.

  The current townhall/guide is auto-detected from the page's own
  filename against each entry's "activeOn" list in the JSON — no
  per-page JS variable needed. That also drives the "active" class
  on the matching dsn-mini/th-mini/dsn-guide-box/more-row element.

  HOW TO USE ON EACH PAGE
  ------------------------
  1. Load the data + loader, before thz-script.js:
       <script src="/coc-nav-loader.js"></script>

  2. Give the layouts/armies/guides dropdown grids inside
     .desktop-sub-nav a data-role attribute instead of hardcoded <a> lists:
       <div class="dsn-dropdown-grid" data-role="layouts-grid"></div>
       <div class="dsn-dropdown-grid" data-role="armies-grid"></div>
       <div class="dsn-dropdown-guides-grid" data-role="guides-grid"></div>

  3. Same idea inside the more-sheet modal:
       <div class="th-mini-grid" data-role="more-layouts-grid"></div>
       <div class="th-mini-grid" data-role="more-armies-grid"></div>
       <div class="more-guides-list" data-role="more-guides-list"></div>

  4. Bottom nav + desktop sub nav primary links get data-role too, so the
     script can point them at the CURRENT townhall's pages:
       <a class="bn-item" data-role="bn-home">...</a>
       <a class="bn-item" data-role="bn-layouts">...</a>
       <a class="bn-item" data-role="bn-armies">...</a>
       <a class="bn-item" data-role="bn-guides">...</a>

       <a class="dsn-link" data-role="dsn-home">...</a>
       <a class="dsn-link" data-role="dsn-layouts">...</a>
       <a class="dsn-link" data-role="dsn-armies">...</a>
       <a class="dsn-link" data-role="dsn-guides">...</a>

  Text and icons already inside those tags stay put — only the href
  changes, so nothing about markup/SVGs/styling has to move.

  Now, updating a townhall (new TH, renamed icon, new guide) means
  editing ONE line in coc-nav-data.json instead of 40+ HTML files.
*/
(function () {
  var DATA_URL = "/coc-nav-data.json";
  var currentPage = cocPagePath(location.pathname);

  function isActive(activeOn) {
    return Array.isArray(activeOn) && activeOn.map(cocPagePath).indexOf(currentPage) !== -1;
  }

  function el(tag, className) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    return e;
  }

  function buildThMini(th, variant) {
    // variant: "dsn-mini" (desktop dropdown) or "th-mini" (more-sheet)
    var a = el("a", variant);
    a.href = th.href;
    var img = el("img");
    img.src = th.icon;
    img.alt = th.label;
    var span = el("span");
    span.textContent = th.label;
    a.appendChild(img);
    a.appendChild(span);
    if (isActive(th.activeOn)) a.classList.add("active");
    return a;
  }

  function buildLayoutsGrid(townhalls, variant) {
    var frag = document.createDocumentFragment();
    townhalls.forEach(function (th) {
      frag.appendChild(
        buildThMini({ id: th.id, label: th.label, icon: th.layoutIcon, href: th.layoutHref, activeOn: [th.layoutHref] }, variant)
      );
    });
    return frag;
  }

  function buildArmiesGrid(townhalls, variant) {
    var frag = document.createDocumentFragment();
    townhalls.forEach(function (th) {
      frag.appendChild(
        buildThMini({ id: th.id, label: th.label, icon: th.armyIcon, href: th.armyHref, activeOn: [th.armyHref] }, variant)
      );
    });
    return frag;
  }

  function buildGuidesDropdown(guides) {
    var frag = document.createDocumentFragment();
    guides.forEach(function (g) {
      var a = el("a", "dsn-guide-box");
      a.href = g.href;
      var img = el("img");
      img.src = g.icon;
      img.alt = g.label;
      var span = el("span");
      span.textContent = g.label;
      a.appendChild(img);
      a.appendChild(span);
      if (isActive(g.activeOn)) a.classList.add("active");
      frag.appendChild(a);
    });
    return frag;
  }

  function buildGuidesMoreList(guides) {
    var frag = document.createDocumentFragment();
    guides.forEach(function (g) {
      var a = el("a", "more-row");
      a.href = g.href;

      var iconWrap = el("div", "more-row-icon");
      var img = el("img");
      img.src = g.icon;
      img.alt = g.label;
      img.style.width = "18px";
      img.style.height = "18px";
      img.style.objectFit = "contain";
      iconWrap.appendChild(img);

      var textWrap = el("div", "more-row-text");
      var titleSpan = el("span", "more-row-title");
      titleSpan.textContent = g.label;
      textWrap.appendChild(titleSpan);

      var chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      chevron.setAttribute("class", "more-row-chevron");
      chevron.setAttribute("viewBox", "0 0 24 24");
      chevron.setAttribute("fill", "none");
      chevron.innerHTML = '<path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';

      a.appendChild(iconWrap);
      a.appendChild(textWrap);
      a.appendChild(chevron);
      if (isActive(g.activeOn)) a.classList.add("active");
      frag.appendChild(a);
    });
    return frag;
  }

  function fillByRole(role, buildFn) {
    var nodes = document.querySelectorAll('[data-role="' + role + '"]');
    nodes.forEach(function (node) {
      node.innerHTML = "";
      node.appendChild(buildFn());
    });
  }

  function setPrimaryLinks(data) {
    // Figure out which townhall "owns" the current page (if any), so
    // LAYOUTS/ARMIES in the top nav point at that TH's other page.
    var th = data.townhalls.find(function (t) { return isActive(t.activeOn); }) || null;
    var activeGuide = data.guides.some(function (g) { return isActive(g.activeOn); });
    var onHome = currentPage === cocPagePath(data.primaryNav.home.href);
    var nav = data.primaryNav;

    var map = {
      home: nav.home.href,
      layouts: th ? th.layoutHref : nav.layouts.href,
      armies: th ? th.armyHref : nav.armies.href,
      guides: nav.guides.href
    };

    var activeKey = onHome ? "home"
      : activeGuide ? "guides"
      : th && currentPage === cocPagePath(th.layoutHref) ? "layouts"
      : th && currentPage === cocPagePath(th.armyHref) ? "armies"
      : null;

    Object.keys(map).forEach(function (key) {
      var selector = '[data-role="bn-' + key + '"], [data-role="dsn-' + key + '"]';
      document.querySelectorAll(selector).forEach(function (link) {
        link.setAttribute("href", map[key]);
        link.classList.toggle("active", key === activeKey);
      });
    });
  }

  // ---- First layer (Layouts / Army / Guides tab buttons) ----
  // Mirrors setPrimaryLinks' logic but renders <button onclick="location.href=...">
  // to match the existing first-layer markup exactly.
  function buildFirstLayer(data) {
    var th = data.townhalls.find(function (t) { return isActive(t.activeOn); }) || null;
    var activeGuide = data.guides.some(function (g) { return isActive(g.activeOn); });
    var nav = data.primaryNav;

    var tabs = [
      { key: "layouts", label: "Layouts", href: th ? th.layoutHref : nav.layouts.href },
      { key: "armies", label: "Army", href: th ? th.armyHref : nav.armies.href },
      { key: "guides", label: "Guides", href: nav.guides.href }
    ];

    var activeKey = activeGuide ? "guides"
      : th && currentPage === cocPagePath(th.layoutHref) ? "layouts"
      : th && currentPage === cocPagePath(th.armyHref) ? "armies"
      : null;

    var frag = document.createDocumentFragment();
    tabs.forEach(function (tab) {
      var btn = el("button");
      btn.textContent = tab.label;
      if (tab.key === activeKey) btn.classList.add("active");
      btn.addEventListener("click", function () {
        location.href = tab.href;
      });
      frag.appendChild(btn);
    });
    return frag;
  }

  // ---- Second layer (horizontal-scroll TH8-TH18 buttons) ----
  // Mode follows whichever section (layouts vs armies) the current page
  // belongs to, so clicking a TH button on an army page goes to that TH's
  // army page, and on a layouts page goes to that TH's layouts page.
  function detectMode(data) {
    var onLayout = data.townhalls.some(function (t) { return currentPage === cocPagePath(t.layoutHref); });
    if (onLayout) return "layouts";
    var onArmy = data.townhalls.some(function (t) { return currentPage === cocPagePath(t.armyHref); });
    if (onArmy) return "armies";
    return "layouts"; // sensible default (e.g. guides pages that still show the strip)
  }

  function buildSecondLayer(data) {
    var mode = detectMode(data);
    var frag = document.createDocumentFragment();
    data.townhalls.forEach(function (th) {
      var href = mode === "armies" ? th.armyHref : th.layoutHref;
      var icon = mode === "armies" ? th.armyIcon : th.layoutIcon;

      var btn = el("button", "th-btn");
      btn.setAttribute("data-th", "TH-" + th.label.replace(/^TH/i, ""));
      if (currentPage === cocPagePath(href)) btn.classList.add("active");

      var img = el("img");
      img.src = icon;
      img.alt = th.label;
      btn.appendChild(img);
      btn.appendChild(document.createTextNode(th.label.replace(/^TH/i, "")));

      btn.addEventListener("click", function () {
        if (typeof window.goToTH === "function") {
          window.goToTH(href, btn);
        } else {
          location.href = href;
        }
      });

      frag.appendChild(btn);
    });
    return frag;
  }

  function init(data) {
    fillByRole("layouts-grid", function () { return buildLayoutsGrid(data.townhalls, "dsn-mini"); });
    fillByRole("armies-grid", function () { return buildArmiesGrid(data.townhalls, "dsn-mini"); });
    fillByRole("guides-grid", function () { return buildGuidesDropdown(data.guides); });

    fillByRole("more-layouts-grid", function () { return buildLayoutsGrid(data.townhalls, "th-mini"); });
    fillByRole("more-armies-grid", function () { return buildArmiesGrid(data.townhalls, "th-mini"); });
    fillByRole("more-guides-list", function () { return buildGuidesMoreList(data.guides); });

    fillByRole("first-layer", function () { return buildFirstLayer(data); });
    fillByRole("second-layer", function () { return buildSecondLayer(data); });

    setPrimaryLinks(data);

    document.dispatchEvent(new CustomEvent("parchome:coc-nav-ready", { detail: data }));
  }

  document.addEventListener("DOMContentLoaded", function () {
    fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load " + DATA_URL + " (" + res.status + ")");
        return res.json();
      })
      .then(init)
      .catch(function (err) {
        console.error("[coc-nav-loader]", err);
      });
  });
})();