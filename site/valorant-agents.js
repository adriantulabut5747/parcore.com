// Valorant Agents (Oct 30 2026): the moving parts of the pages scripts/valorant-agents.py writes. Nothing is
// fetched: every card, row and fact is already in the page.
// 1. Index: the role tray (?role=duelist), the search box and Newest / Oldest / A-Z filter the roster cards
//    and the table rows together; the table's column heads sort it.
// 2. Agent page: the release rail scrolls this agent into view.
(function () {
  const grid = document.getElementById('vaGrid');
  const table = document.getElementById('vaTable');
  if (grid && table) {
    const tabs = document.getElementById('vaTabs');
    const q = document.getElementById('vaQ');
    const none = document.getElementById('vaNone');
    const cards = [...grid.querySelectorAll('.va-card')];
    const rows = [...table.tBodies[0].rows];
    const roles = [...tabs.querySelectorAll('[data-role]')].map((b) => b.dataset.role);
    let role = new URLSearchParams(location.search).get('role') || '';
    if (!roles.includes(role)) role = '';

    const apply = () => {
      const words = q.value.trim().toLowerCase();
      const ok = (el) => (!role || el.dataset.role === role) && (!words || el.dataset.name.includes(words));
      let shown = 0;
      cards.forEach((c) => {
        c.hidden = !ok(c);
        if (!c.hidden) shown++;
      });
      rows.forEach((r) => (r.hidden = !ok(r)));
      none.hidden = shown > 0;
      tabs.querySelectorAll('[data-role]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.role === role)));
    };
    tabs.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-role]');
      if (!b) return;
      role = b.dataset.role;
      const url = new URL(location.href);
      if (role) url.searchParams.set('role', role);
      else url.searchParams.delete('role');
      history.replaceState(null, '', url);
      apply();
    });
    q.addEventListener('input', apply);

    const sort = document.getElementById('vaSort');
    sort.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-sort]');
      if (!b) return;
      sort.querySelectorAll('[data-sort]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const by = {
        new: (a, c) => c.dataset.i - a.dataset.i,
        old: (a, c) => a.dataset.i - c.dataset.i,
        az: (a, c) => a.dataset.name.localeCompare(c.dataset.name),
      }[b.dataset.sort];
      grid.append(...cards.slice().sort(by));
    });

    // the table: a click on a head sorts by that column (each cell carries its sort value in data-v)
    table.tHead.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-col]');
      if (!b) return;
      const th = b.parentElement;
      const col = +b.dataset.col;
      const dir = th.getAttribute('aria-sort') === 'ascending' ? -1 : 1;
      table.tHead.querySelectorAll('th').forEach((x) => x.removeAttribute('aria-sort'));
      th.setAttribute('aria-sort', dir > 0 ? 'ascending' : 'descending');
      const val = (r) => r.cells[col].dataset.v;
      const num = rows.every((r) => !isNaN(val(r)));
      // "not revealed" ('~') always sinks to the bottom, whichever way the column runs
      rows.sort((a, c) => {
        const x = val(a), y = val(c);
        if ((x === '~') !== (y === '~')) return x === '~' ? 1 : -1;
        return dir * (num ? x - y : x.localeCompare(y));
      });
      table.tBodies[0].append(...rows);
    });

    apply();
  }

  const rail = document.getElementById('vaRail');
  const cur = rail && rail.querySelector('[aria-current="page"]');
  if (cur) rail.scrollLeft = cur.offsetLeft - rail.clientWidth / 2 + cur.offsetWidth / 2;
})();
