// Genshin Impact Spiral Abyss (/genshin-impact/abyss, Oct 27 2026). Four arched gates pick a floor
// (9-12), then that floor's ley line disorders and three chambers below (GI.abyssFloor, the same
// markup as the Endgame page). Data: the feed's endgame.abyss (Fandom wiki) + challenges (period,
// reward). Usage stats (teams, characters, weapons, artifacts) are left out on purpose: no public
// source had a real sample on Oct 27 2026 (Snap Hutao's homa API: ~37 players a cycle). Styles:
// genshin-endgame.css (the floor) + genshin-abyss.css (the gates). The picked floor stays in the
// address (?floor=12); Floor 9 first, like Endgame (Adrian's call there).
(function () {
  const { $, now, countdowns, glide } = window.GI;
  const day = (t) => {
    const d = new Date((t + 8 * 3600) * 1000);
    return GI.MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
  };
  const lastDay = (t) => day(t - 4 * 3600); // modes end at 03:59, which still belongs to the day before

  // "Lv. 95-100": the floor's lowest and highest chamber level.
  function levels(f) {
    const l = f.chambers.map((c) => c.level).filter(Boolean);
    if (!l.length) return '';
    const lo = Math.min(...l);
    const hi = Math.max(...l);
    return lo === hi ? lo : lo + '&ndash;' + hi;
  }
  const gate = (f) => {
    const lv = levels(f);
    return `<button type="button" class="ab-gate" role="tab" data-floor="${f.floor}" aria-controls="abFloors" aria-label="Floor ${f.floor}"><span class="ab-gate-in"><span class="ab-gate-art">
      <img src="/images/genshin/endgame/abyss.webp" alt="" decoding="async"><span class="ab-gate-n">${f.floor}</span>
      ${lv ? `<span class="ab-gate-lv"><b>Lv. ${lv}</b><span>Enemy level</span></span>` : ''}</span></span></button>`;
  };

  function render(a, icons, tower) {
    const gates = $('abGates');
    const box = $('abFloors');
    if (!a || !a.floors || !a.floors.length) {
      gates.innerHTML = '';
      box.innerHTML = "<p class=\"gi-box gi-empty\">This period's floors aren't listed yet.</p>";
      return;
    }
    if (tower) $('abSub').textContent = `The Abyssal Moon Spire, ${day(tower.start)} to ${lastDay(tower.end)}${a.version ? ' (version ' + a.version + ')' : ''}.`;
    gates.innerHTML = a.floors.map(gate).join('');
    box.innerHTML = a.floors.map((f) => GI.abyssFloor(f, icons)).join('');
    const pick = (n) => {
      gates.querySelectorAll('.ab-gate').forEach((b) => {
        const on = +b.dataset.floor === n;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on);
      });
      box.querySelectorAll('.eg-floor').forEach((f) => f.classList.toggle('is-on', +f.dataset.floor === n));
      $('abFloorN').textContent = n;
      const url = new URL(location.href);
      if (n === first) url.searchParams.delete('floor');
      else url.searchParams.set('floor', n);
      history.replaceState(null, '', url);
    };
    const first = (a.floors.find((f) => f.floor === 9) || a.floors[0]).floor;
    const asked = +new URLSearchParams(location.search).get('floor');
    pick(a.floors.some((f) => f.floor === asked) ? asked : first);
    gates.addEventListener('click', (e) => {
      const b = e.target.closest('.ab-gate');
      if (!b) return;
      pick(+b.dataset.floor);
      glide($('abFloor'));
    });
  }

  GI.feed
    .then((feed) => {
      const t = now();
      const eg = feed.endgame || {};
      const tower = (feed.challenges || []).find((c) => c.type === 'ActTypeTower' && c.end > t);
      render(eg.abyss, eg.icons || {}, tower);
      const facts = [];
      if (tower) facts.push(`<li>Resets in <b data-end-srv="${+tower.end}"></b></li>`);
      if (tower && tower.primos) facts.push(`<li><b>${tower.primos.toLocaleString()}</b>Primogems</li>`);
      if (eg.abyss && eg.abyss.version) facts.push(`<li>Version <b>${GI.esc(eg.abyss.version)}</b></li>`);
      $('abFacts').innerHTML = facts.join('');
      countdowns();
      setInterval(countdowns, 1000);
    })
    .catch((err) => {
      console.error('Abyss failed to load:', err);
      $('abGates').innerHTML = '';
      $('abFloors').innerHTML = "<p class=\"gi-empty\">Couldn't load the floors right now. Try again in a bit.</p>";
    });
})();
