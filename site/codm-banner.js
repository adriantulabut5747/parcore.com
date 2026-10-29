/* CODM PAGE BANNER: the season fact (codm-banner.css has the why). Same source as the lobby
   hero's battle pass card: ggseason.com publishes the season as schema.org JSON in its CoD
   Mobile page (CORS *); its end date is an estimate. If the fetch fails, the markup changes
   or the season is over, #cbSeason stays hidden. The page's own counts (#cbCount, #cbCountSub)
   are filled by the page script, which has the data. */
(async function () {
  const fact = document.getElementById('cbSeason');
  if (!fact) return;
  let ev;
  try {
    const html = await (await fetch('https://ggseason.com/codmobile/')).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    for (const el of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try { const j = JSON.parse(el.textContent); if (j['@type'] === 'Event') { ev = j; break; } } catch (e) {}
    }
  } catch (e) { return; }
  if (!ev) return;
  const est = [].concat(ev.additionalProperty || []).find(p => p.name === 'estimatedEndDate');
  const end = new Date(ev.endDate || (est && est.value));
  const days = Math.ceil((end - Date.now()) / 864e5);
  if (isNaN(end) || days <= 0) return;
  const name = ev.name.replace(/^.*?(Season)/, '$1');
  const num = (name.match(/Season (\d+)/) || [])[1];
  const title = name.replace(/^Season \d+\s*[:\-–—]?\s*/, '').trim();
  fact.querySelector('small').textContent = num ? 'Season ' + num : 'Season';
  fact.querySelector('b').textContent = title || name;
  fact.querySelector('em').innerHTML = `<i>${days}d left</i> · ends ${est && !ev.endDate ? 'around ' : ''}` +
    end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  fact.hidden = false;
})();
