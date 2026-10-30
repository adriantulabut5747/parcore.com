// Valorant Maps (Oct 30 2026): the live bits of the pages scripts/valorant-maps.py writes.
// 1. Ranked pool: every [data-pool="<map name>"] says "In the pool" / "Out of the pool", from
//    HenrikDev's queue status through our Worker (the lobby's Map Pool box asks the same). On a
//    failure the badges just stay hidden.
// 2. Callouts: hover or focus a name in the list and its spots light up on the minimap; a click
//    keeps it lit (phones: the only way, and the map shows that one label).
// 3. Index tray: All / Competitive / Team Deathmatch / Other modes, kept in the address as ?mode=.
(function () {
  const QUEUE = 'https://parchrome-valorant.adriantulabut5747.workers.dev/api/valorant?type=queue&region=na';

  const pools = document.querySelectorAll('[data-pool]');
  if (pools.length) {
    fetch(QUEUE)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        const comp = (j.data || []).find((m) => m.mode_id === 'competitive');
        if (!comp || !Array.isArray(comp.maps)) throw new Error('no competitive queue');
        const live = new Set(comp.maps.filter((m) => m.enabled).map((m) => m.map.name));
        pools.forEach((el) => {
          const on = live.has(el.dataset.pool);
          el.dataset.state = on ? 'in' : 'out';
          const card = el.closest('.vm-card');
          if (card) card.dataset.state = el.dataset.state;
          if (el.matches('.cb-fact')) el.querySelector('b').textContent = on ? 'In the pool' : 'Out';
          else el.textContent = on ? 'In the pool' : 'Out of the pool';
          el.hidden = false;
        });
        // the list: maps in today's pool lead (Adrian), the rest follow, both still newest first
        document.querySelectorAll('.vm-grid').forEach((g) => g.append(...g.querySelectorAll('.vm-card[data-state="out"]')));
        const n = document.getElementById('vmPoolN');
        if (n) {
          n.querySelector('b').textContent = live.size + ' maps';
          n.querySelector('em').textContent = [...live].sort().join(', ');
          n.hidden = false;
        }
      })
      .catch((err) => console.warn('Map pool unavailable:', err));
  }

  const co = document.getElementById('vmCallouts');
  if (co) {
    let kept = null;
    const light = (key) => {
      co.querySelectorAll('.is-on').forEach((el) => el.classList.remove('is-on'));
      if (key) co.querySelectorAll('[data-c="' + key + '"]').forEach((el) => el.classList.add('is-on'));
    };
    co.querySelectorAll('button[data-c]').forEach((b) => {
      const key = b.dataset.c;
      b.addEventListener('mouseenter', () => light(key));
      b.addEventListener('focus', () => light(key));
      b.addEventListener('mouseleave', () => light(kept));
      b.addEventListener('blur', () => light(kept));
      b.addEventListener('click', () => {
        kept = kept === key ? null : key;
        b.setAttribute('aria-pressed', kept === key ? 'true' : 'false');
        light(kept);
      });
    });
  }

  // map pages: the tray of maps scrolls itself so this map's tab is in view (Ascent sits far right)
  const here = document.querySelector('.cb-tabs > [aria-current="page"]');
  if (here) here.parentElement.scrollLeft = here.offsetLeft - (here.parentElement.clientWidth - here.offsetWidth) / 2;

  const tabs = document.getElementById('vmTabs');
  if (tabs) {
    const show = (mode) => {
      tabs.querySelectorAll('[data-mode]').forEach((t) => t.setAttribute('aria-selected', t.dataset.mode === mode ? 'true' : 'false'));
      document.querySelectorAll('section[data-mode]').forEach((s) => (s.hidden = !!mode && s.dataset.mode !== mode));
    };
    const start = new URLSearchParams(location.search).get('mode') || '';
    show(tabs.querySelector('[data-mode="' + start + '"]') ? start : '');
    tabs.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-mode]');
      if (!t) return;
      const u = new URL(location.href);
      if (t.dataset.mode) u.searchParams.set('mode', t.dataset.mode);
      else u.searchParams.delete('mode');
      history.replaceState(null, '', u);
      show(t.dataset.mode);
    });
  }
})();
