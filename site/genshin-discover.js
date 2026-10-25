// Genshin Impact group pages (Oct 24 2026): /genshin-impact/events, /database and /tools, the first page
// of each nav group ("All events" / "Full database" / "All tools" in the menus). Adrian: banner, then one
// card per page of the group, nothing else. Cards come from game-nav.json (the group's "pages": name,
// icon, "desc"), so a page added to the nav shows up here too; "soon" pages sit last, dimmed.
// Styles: genshin-discover.css. Helpers: window.GI (genshin-core.js).
(function () {
  const { $, esc } = window.GI;
  const box = $('dxDir');
  if (!box) return;
  const path = (link) => link.replace(/\.html$/, '').replace(/\/$/, '');
  const here = path(location.pathname);
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  fetch('/game-nav.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .then((all) => {
      const group = all['genshin-impact'].groups.find((g) => g.link && path(g.link) === here);
      $('dxIcon').innerHTML = group.icon;
      const pages = group.pages.filter((p) => path(p.link) !== here).sort((a, b) => !!a.soon - !!b.soon);
      box.innerHTML = pages
        .map((p) => {
          const inner = `<span class="dx-card-ico"><img src="${esc(p.icon)}" alt="" width="44" height="44" loading="lazy"></span>
            <span class="dx-card-text"><span class="dx-card-name">${esc(p.name)}${p.soon ? '<span class="dx-tag">Soon</span>' : ''}</span>
            <span class="dx-card-desc">${esc(p.desc || '')}</span></span>`;
          return p.soon
            ? `<div class="gi-box dx-card is-later" aria-disabled="true">${inner}</div>`
            : `<a class="gi-box gi-card dx-card" href="${esc(p.link)}">${inner}<span class="dx-card-go">${ARROW}</span></a>`;
        })
        .join('');
    })
    .catch(() => {
      box.innerHTML = '<p class="gi-empty">The page list didn’t load. Use the menu above.</p>';
    });
})();
