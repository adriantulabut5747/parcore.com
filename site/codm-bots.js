/* BOT CHECKER (/call-of-duty-mobile/bot-checker, Oct 29 2026): one name at a time against the list in
   /codm-bots.json. Matching ignores case, spaces and symbols (and folds look-alike Unicode forms with
   NFKC), so the way a player retypes a name from the scoreboard doesn't matter. "Not on the list" never
   says "player": the list only holds names someone confirmed, so a miss proves nothing. */
(function () {
  const input = document.getElementById('bcName');
  const out = document.getElementById('bcResult');
  if (!input || !out) return;
  const norm = s => String(s).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const MODES = { mp: 'Multiplayer', br: 'Battle Royale' };
  const BOT = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="8" width="16" height="11" rx="2"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16h5"/></svg>';
  const PLAYER = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>';
  let index = null;

  fetch('/codm-bots.json').then(r => r.json()).then(d => {
    const bots = d.bots || [];
    index = new Map(bots.map(b => [norm(b.name), b]));
    const real = bots.filter(b => !b.example).length;
    const count = document.getElementById('cbCount');
    const sub = document.getElementById('cbCountSub');
    if (count) count.textContent = real ? real.toLocaleString() : 'None yet';
    if (sub) sub.textContent = real ? 'updated ' + (d.updated || '') : bots.length + ' example entries for now';
    const note = document.getElementById('bcExampleNote');
    if (note) note.hidden = real > 0;
    check();
  }).catch(() => {
    out.hidden = false;
    out.className = 'bc-result';
    out.innerHTML = '<span class="bc-badge">' + PLAYER + '</span><div><p class="bc-verdict">List unavailable</p><p class="bc-why">The bot list didn\'t load. Check your connection and reload the page.</p></div>';
  });

  function check() {
    const name = input.value.trim();
    // the name rides in the address, so a check can be shared
    const u = new URL(location.href);
    if (name) u.searchParams.set('name', name); else u.searchParams.delete('name');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
    if (!name || !index) { out.hidden = true; return; }
    const hit = index.get(norm(name));
    out.hidden = false;
    out.className = 'bc-result' + (hit ? ' is-bot' : '');
    out.innerHTML = hit
      ? '<span class="bc-badge">' + BOT + '</span><div><p class="bc-verdict">Known bot' + (hit.example ? ' (example entry)' : '') + '</p>' +
        '<p class="bc-why"><q>' + esc(hit.name) + '</q> is on the list' + (MODES[hit.mode] ? ', seen in ' + MODES[hit.mode] : '') + '.' +
        (hit.note ? ' ' + esc(hit.note) : '') + (hit.example ? ' This is a placeholder until the real list is in.' : '') + '</p></div>'
      : '<span class="bc-badge">' + PLAYER + '</span><div><p class="bc-verdict">Not on the list</p>' +
        '<p class="bc-why"><q>' + esc(name) + '</q> isn\'t a known bot name. That doesn\'t prove it\'s a real player: check the signs below.</p></div>';
  }

  let t = 0;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(check, 150); });
  document.getElementById('bcForm').addEventListener('submit', e => { e.preventDefault(); check(); });
  const start = new URLSearchParams(location.search).get('name');
  if (start) input.value = start;
})();
