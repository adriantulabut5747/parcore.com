/* CODM PAGE BANNER: the season fact (codm-banner.css has the why). Same source as the lobby
   hero's battle pass card: ggseason.com publishes the season as schema.org JSON in its CoD
   Mobile page (CORS *); its end date is an estimate. If the fetch fails, the markup changes
   or the season is over, #cbSeason stays hidden. The page's own counts (#cbCount, #cbCountSub)
   are filled by the page script, which has the data.
   window.codmSeason = that season, parsed once ({ num, name, title, start, end, est, notes } or
   null): the Season page's clock reads it too, so the page fetches ggseason only once. */
window.codmSeason = (async function () {
  let ev;
  try {
    const html = await (await fetch('https://ggseason.com/codmobile/')).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    for (const el of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try { const j = JSON.parse(el.textContent); if (j['@type'] === 'Event') { ev = j; break; } } catch (e) {}
    }
  } catch (e) { return null; }
  if (!ev) return null;
  const est = [].concat(ev.additionalProperty || []).find(p => p.name === 'estimatedEndDate');
  const end = new Date(ev.endDate || (est && est.value));
  if (isNaN(end)) return null;
  const name = ev.name.replace(/^.*?(Season)/, '$1');
  const num = (name.match(/Season (\d+)/) || [])[1];
  return {
    num: num ? +num : null,
    name,
    title: name.replace(/^Season \d+\s*[:\-–—]?\s*/, '').trim(),
    start: new Date(ev.startDate),
    end,
    est: !!est && !ev.endDate,
    notes: ev.location && ev.location.url
  };
})();

(async function () {
  const fact = document.getElementById('cbSeason');
  if (!fact) return;
  const s = await window.codmSeason;
  if (!s) return;
  const days = Math.ceil((s.end - Date.now()) / 864e5);
  if (days <= 0) return;
  fact.querySelector('small').textContent = s.num ? 'Season ' + s.num : 'Season';
  fact.querySelector('b').textContent = s.title || s.name;
  // .cb-end = the end date, hidden on phones (one compact row there)
  fact.querySelector('em').innerHTML = `<i>${days}d left</i><span class="cb-end"> · ends ${s.est ? 'around ' : ''}` +
    s.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + '</span>';
  fact.hidden = false;
})();
