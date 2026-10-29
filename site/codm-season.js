/* SEASON PAGE (/call-of-duty-mobile/season, Oct 29 2026). The clock = ggseason's season
   (window.codmSeason from codm-banner.js, so the page fetches it once). The rest = codm-season.json,
   written by hand each season from Activision's season post. When ggseason is already on a newer
   season than the file, "Dates" and "What's in" hide (they'd describe the old season) and a note
   points at the official patch notes until the file is updated. */
(async function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const DAY = 864e5;
  // plain dates in the file are UTC calendar days (ggseason's season switch is 00:00 UTC)
  const day = (d, o) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC', ...o });
  const ago = (d) => new Date(d + 'T00:00:00Z');
  const officialUrl = (u) => (u && /^https:\/\/www\.callofduty\.com\//.test(u) ? u : '');

  const [data, s] = await Promise.all([
    fetch('/codm-season.json').then((r) => r.json()).catch(() => null),
    window.codmSeason
  ]);

  /* ---- history: past seasons + the banner's average length ---- */
  const hist = (data && data.history) || [];
  const len = (h) => Math.round((ago(h.end) - ago(h.start)) / DAY);
  if (hist.length) {
    const avg = Math.round(hist.reduce((n, h) => n + len(h), 0) / hist.length);
    $('cbCount').textContent = avg + ' days';
    $('cbCountSub').textContent = `average, last ${hist.length} seasons`;
    $('csPast').innerHTML = hist
      .map(
        (h) => `<li><span class="cs-num">S${+h.season}</span><span class="cs-row-main"><b>${esc(h.name)}</b>` +
          `<small>${day(ago(h.start))} – ${day(ago(h.end), { year: 'numeric' })}</small></span><span class="cs-len">${len(h)} days</span></li>`
      )
      .join('');
  } else {
    $('csPastSec').hidden = true;
    $('cbCount').textContent = '–';
    $('cbCountSub').textContent = 'no past seasons listed';
  }

  /* ---- the clock ---- */
  const box = $('csClock');
  if (s) {
    box.hidden = false;
    $('csNum').textContent = s.num ? 'S' + s.num : '';
    $('csName').textContent = s.title || s.name;
    $('csK').textContent = (s.num ? 'Season ' + s.num : 'The season') + ' ends in';
    const total = Math.round((s.end - s.start) / DAY);
    const time = { hour: 'numeric', minute: '2-digit' };
    $('csFrom').textContent = 'Started ' + s.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...time });
    $('csTo').textContent = (s.est ? 'Ends around ' : 'Ends ') + s.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...time });
    const notes = officialUrl(s.notes);
    $('csSub').innerHTML =
      (s.est
        ? "Activision hasn't dated the end yet. This is GGS's estimate from past season lengths; the official date usually lands on the Call of Duty blog about a week before. "
        : '') +
      (notes ? `<a href="${esc(notes)}" target="_blank" rel="noopener">Patch notes</a> · ` : '') +
      '<a href="https://ggseason.com/codmobile/" target="_blank" rel="noopener">GGS</a>';

    const els = ['days', 'hours', 'mins', 'secs'].map((k) => $('cs-' + k));
    const pad = (n) => String(n).padStart(2, '0');
    const tick = () => {
      const left = s.end - Date.now();
      if (!(left > 0)) {
        box.classList.add('is-over');
        $('csK').textContent = 'Season over';
        $('csDay').textContent = "The next season's dates show here as soon as they're out.";
        clearInterval(timer);
        return;
      }
      const gone = Math.min(1, Math.max(0, (Date.now() - s.start) / (s.end - s.start)));
      $('csBar').style.transform = `scaleX(${gone.toFixed(4)})`;
      $('csDay').textContent = `Day ${Math.min(total, Math.floor((Date.now() - s.start) / DAY) + 1)} of ${s.est ? '~' : ''}${total}`;
      [left / DAY, (left / 36e5) % 24, (left / 6e4) % 60, (left / 1e3) % 60].forEach((v, i) => (els[i].textContent = pad(Math.floor(v))));
    };
    const timer = setInterval(tick, 1000);
    tick();
  } else {
    $('csNoClock').hidden = false;
  }

  /* ---- this season (only while the file matches the live season) ---- */
  if (!data) return;
  if (s && s.num && s.num !== data.season) {
    const n = $('csStale');
    const notes = officialUrl(s.notes);
    n.querySelector('span').innerHTML =
      `Season ${s.num} is live; our notes for it are on the way.` +
      (notes ? ` Until then, read <a href="${esc(notes)}" target="_blank" rel="noopener">Activision's patch notes</a>.` : '');
    n.hidden = false;
    return;
  }

  const title = `Season ${+data.season}: ${data.name}`;
  $('csInTitle').textContent = `What's in Season ${+data.season}`;
  const src = officialUrl(data.source);
  $('csInSub').innerHTML = src
    ? `From <a href="${esc(src)}" target="_blank" rel="noopener">Activision's ${esc(title)} post</a>.`
    : esc(title) + '.';
  $('csIn').innerHTML = (data.groups || [])
    .map(
      (g) => `<div class="cs-group"><h3>${esc(g.title)}</h3><ul>` +
        g.items.map((it) => `<li><b>${esc(it.name)}</b><span>${esc(it.text)}</span></li>`).join('') +
        '</ul></div>'
    )
    .join('');
  $('csInSec').hidden = false;

  // dates: the season's start + end (from the clock) around the file's dated items
  const rows = (data.dates || []).map((d) => ({ name: d.name, text: d.text, from: ago(d.from), to: new Date(ago(d.to).getTime() + DAY) }));
  if (s) {
    rows.push({ name: 'Season starts', text: title, from: s.start, to: s.start, point: true });
    rows.push({ name: s.est ? 'Season ends (estimate)' : 'Season ends', text: 'Battle Pass tiers stop being earnable.', from: s.end, to: s.end, point: true });
  }
  rows.sort((a, b) => a.from - b.from);
  const now = Date.now();
  $('csDates').innerHTML = rows
    .map((r) => {
      const state = r.point ? (now >= r.from ? 'done' : 'soon') : now >= r.to ? 'done' : now >= r.from ? 'live' : 'soon';
      const tag = { done: r.point ? 'Done' : 'Ended', live: 'On now', soon: 'Upcoming' }[state];
      const when = r.point ? r.from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : `${day(r.from)} – ${day(r.to - DAY)}`;
      return `<li class="is-${state}"><span class="cs-when">${when}</span><span class="cs-row-main"><b>${esc(r.name)}</b><small>${esc(r.text)}</small></span><span class="cs-tag">${tag}</span></li>`;
    })
    .join('');
  if (rows.length) $('csDatesSec').hidden = false;
})();
