/* Official clan card script -- shared by coc-home.html and
   th18-layouts.html (styles: coc-clan-clock.css). Load with defer, after
   the card's markup. Moved here from th18-layouts.html, Sep 2026. */

// "Join Our Clan": copies the clan tag, then confirms for ~2s -- the label
// reads "Copied", the icon becomes a green check, and screen readers hear
// "Clan tag copied". Falls back to the old execCommand copy where the
// Clipboard API isn't allowed (older browsers, non-HTTPS pages).
function copyClanTagBtn(btn){
  var tag = btn.dataset.copy;
  var label = btn.querySelector('.clan-btn-label');
  var status = document.getElementById('clanCopyStatus');
  if (label && label._orig == null) label._orig = label.innerHTML;   // keep "Join <span>Our </span>Clan" for the restore
  function done(){
    btn.classList.add('copied');
    if (label) label.textContent = 'Copied';
    if (status) status.textContent = 'Clan tag ' + tag + ' copied';
    clearTimeout(btn._copyTimer);
    btn._copyTimer = setTimeout(function(){
      btn.classList.remove('copied');
      if (label) label.innerHTML = label._orig;
      if (status) status.textContent = '';
    }, 2000);
  }
  function fallback(){
    var ta = document.createElement('textarea');
    ta.value = tag; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { if (document.execCommand('copy')) done(); } catch (e) {}
    document.body.removeChild(ta);
  }
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(tag).then(done, fallback);
  else fallback();
}
// Clan card data: read clan-stats.json (kept fresh by a GitHub Action) and
// fill the fact chips, the stat tiles and the last-10-wars row, then show
// them. Anything missing stays hidden; a failed load leaves title + buttons.
(function(){
  var box = document.getElementById('clanStats');
  if (!box) return;
  function ago(iso){
    var mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (!(mins >= 0)) return '';
    if (mins < 2) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var h = Math.round(mins / 60);
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    var d = Math.round(h / 24);
    return d + (d === 1 ? ' day ago' : ' days ago');
  }
  function fill(d){
    if (!d || typeof d.members !== 'number') return;
    function set(name, html){ var el = box.querySelector('[data-stat="' + name + '"]'); if (el) el.innerHTML = html; }

    // stat tiles
    set('members', d.members + '<small>/' + (d.maxMembers || 50) + '</small>');
    set('level', d.level);
    // war record (wins / losses) and the game's own win streak
    var war = box.querySelector('[data-stat-box="war"]'), streak = box.querySelector('[data-stat-box="streak"]');
    if (d.warLogPublic && typeof d.warWins === 'number' && typeof d.warLosses === 'number') {
      set('record', d.warWins.toLocaleString() + '<small>W</small> ' + d.warLosses.toLocaleString() + '<small>L</small>');
      set('streak', typeof d.warWinStreak === 'number' ? d.warWinStreak : '0');
    } else {
      if (war) war.hidden = true;        // private war log: no war numbers to show
      if (streak) streak.hidden = true;
    }
    box.hidden = false;

    // last 10 wars + when the numbers last changed
    var form = document.getElementById('clanForm');
    var wars = document.getElementById('clanWars');
    if (form && wars && Array.isArray(d.recentWars) && d.recentWars.length) {
      var NAME = { W: 'Win', D: 'Draw', L: 'Loss' };
      wars.innerHTML = d.recentWars.map(function(r){
        return NAME[r] ? '<li class="is-' + r + '" title="' + NAME[r] + '"><span>' + r + '</span></li>' : '';
      }).join('');
      // "Updated 11 min ago · Refreshes every 30 min". clan-stats.json only
      // changes when a number does, so its own timestamp can be hours old
      // even though the updater checks every 30 minutes. The truer "last
      // checked" time is the updater's last successful run, which GitHub's
      // public API gives (60 lookups/hour per visitor, plenty). If that
      // lookup fails, the file's timestamp is used instead.
      var up = document.getElementById('clanUpdated');
      // The "Refreshes every 30 min" promise only shows while it's true:
      // if the last update is over 45 min old (GitHub's schedule stalled,
      // or the updater hasn't run yet) the line is just "Updated X ago".
      function showUpdated(iso){
        if (!up || !iso) return;
        var fresh = (Date.now() - new Date(iso).getTime()) < 45 * 60000;
        up.innerHTML = 'Updated ' + ago(iso) + (fresh ? '<span class="clan-updated-sep" aria-hidden="true">·</span>Refreshes every 30 min' : '');
      }
      showUpdated(d.updated);
      fetch('https://api.github.com/repos/adriantulabut5747/parcore.com/actions/workflows/clan-stats.yml/runs?status=success&per_page=1')
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(function(j){
          var run = j && j.workflow_runs && j.workflow_runs[0];
          if (run && (!d.updated || new Date(run.updated_at) > new Date(d.updated))) showUpdated(run.updated_at);
        })
        .catch(function(){});
      form.hidden = false;
    }
  }
  if (!window.fetch) return;
  fetch('clan-stats.json', { cache: 'no-cache' })   // no-cache: always check for a newer copy
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(fill)
    .catch(function(){});
})();
