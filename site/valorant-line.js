// The line (Nov 1 2026, Adrian): when Henrik's 30-calls-a-minute key is full, the player page and the leaderboard
// wait in a real line instead of showing an error. The Worker's Gate (cloudflare/valorant-api/worker.js, THE LINE)
// counts every call for every visitor; this file takes a ticket, polls it while it waits and hands back a pass.
//   const pass = await vlLine.ticket(calls, onWait)   onWait({ place, line, wait }) while waiting, onWait(null) on go
//   vlLine.get(url, getJSON, pass, onWait)            one Worker call with the pass; Henrik's 429 = back in line, again
//   vlLine.done(pass)                                 hands unused calls back (cached answers cost nothing)
// No time limit (Adrian): it waits as long as the tab is open. Closing it stops the polls and the Gate drops the spot.
window.vlLine = (() => {
  const W = 'https://parchrome-valorant.adriantulabut5747.workers.dev/api/valorant?type=ticket';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ask = (q) => fetch(W + q, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('ticket ' + r.status))));

  async function ticket(calls, onWait) {
    let t;
    try {
      t = await ask('&cost=' + calls);
    } catch {
      return ''; // the Gate can't be reached: go without a pass (the Worker lets calls through when there's room)
    }
    while (t.state === 'wait') {
      onWait(t);
      await sleep(t.place === 1 ? 2000 : 4000);
      t = await ask('&id=' + t.id).catch(() => t); // a failed poll keeps the spot: ask again
    }
    if (t.state === 'gone') return ticket(calls, onWait); // dropped (the tab slept past 20 s): back in line
    onWait(null);
    return t.id;
  }

  const done = (pass) => pass && fetch(W + '&done=1&id=' + pass, { cache: 'no-store', keepalive: true }).catch(() => {});

  async function get(url, getJSON, pass, onWait) {
    for (;;) {
      try {
        return await getJSON(pass ? url + '&pass=' + pass : url);
      } catch (e) {
        if (e.status !== 429) throw e;
        pass = await ticket(1, onWait);
      }
    }
  }

  // "about 40 s" / "about 3 min", for the line's message
  const eta = (s) => (s < 60 ? 'about ' + Math.max(5, Math.ceil(s / 5) * 5) + ' s' : 'about ' + Math.ceil(s / 60) + ' min');

  return { ticket, done, get, eta };
})();
