/* ============================================================
   VALORANT INSTALOCK ROULETTE (Nov 2 2026, Adrian: "spin the wheel but better"; classic disc wheel, agents by default,
   a switch to weapons, filters, team of 5, challenge, history + share link, tick sound with a mute key, Jett reacts).
   /valorant/instalock-roulette. Data = valorant-roster.json (valorant-agents.py) + valorant-weapons.json (the daily feed);
   a source that fails says so. Fair by construction: every slice is the same size and the winner is drawn with
   crypto.getRandomValues BEFORE the wheel moves; the spin only eases to it.
   Address: ?mode=w (Weapons wheel), ?r=<id>[,<id>...] (the roll, 1 or 5), ?c=<challenge id>.
   Device: localStorage vl-rl-out-a / vl-rl-out-w (ids taken off), vl-rl-cost, vl-rl-sound, vl-rl-hist (last 10).
   ============================================================ */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const load = (k, d) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch {
      return d;
    }
  };
  const save = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  };
  // modulo bias is n / 2^32: nothing at 30 slices
  const rand = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const fmt = (n) => n.toLocaleString('en-US');
  const AG = '/images/valorant/agents/';
  const ROLES = ['Duelist', 'Initiator', 'Controller', 'Sentinel'];
  const TEAM = 5;
  const R = 228; // the disc's radius in the SVG's 500-unit box
  const GUN_FILL = [
    ['#2a2c33', '#24262c'],
    ['#3a2226', '#331d21'],
  ];
  // a hex colour mixed toward white by k
  const lift = (hex, k) =>
    '#' +
    [1, 3, 5]
      .map((i) =>
        Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k) + 255 * k)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');

  /* ---- CHALLENGES: our own rules (not stats). gun: true = it changes what you buy, so the Weapons wheel skips it. ---- */
  const CHALLENGES = [
    { id: 'no-ult', name: 'No ultimates', rule: 'Never use your ultimate this match, however full it gets.' },
    { id: 'hipfire', name: 'Hip-fire only', rule: 'Never aim down sights or scope in. Snipers included.' },
    { id: 'tap', name: 'Tap only', rule: 'Never hold the trigger down: single taps and short bursts only.' },
    { id: 'walk', name: 'Silent steps', rule: 'Walk everywhere once the round starts. Running is for the buy phase.' },
    { id: 'no-shields', name: 'No shields', rule: 'Never buy armor. Spend those credits on anything else.' },
    { id: 'sheriff', name: 'Sheriff life', rule: 'Buy a Sheriff and nothing else every round you can afford one.', gun: true },
    { id: 'shotgun', name: 'Up close', rule: 'Buy a shotgun every round you can afford one.', gun: true },
    { id: 'sidearms', name: 'Sidearms only', rule: 'Buy sidearms only, all match long.', gun: true },
    { id: 'saver', name: 'Saver', rule: 'Never spend more than 2,000 credits in one round.', gun: true },
    { id: 'gift', name: 'Team bank', rule: 'Buy a gun for a teammate every round you can afford it.' },
    { id: 'spike', name: 'Spike carrier', rule: 'Pick up the spike and plant it yourself every attack round.' },
    { id: 'entry', name: 'First in', rule: 'Be the first one onto the site every attack round.' },
    { id: 'util', name: 'Utility first', rule: 'Use an ability before you fire your first shot every round.' },
    { id: 'aim', name: 'Aim first', rule: "No abilities until you've fired your first shot of the round." },
    { id: 'calls', name: 'Every callout', rule: 'Call out every enemy you see on voice, with where they are.' },
    { id: 'nice', name: 'Nice chat only', rule: 'Every chat message has to compliment someone. No exceptions.' },
    { id: 'site', name: 'Same site', rule: 'On defense, hold the same site every round, whatever happens.' },
    { id: 'empty', name: 'Empty first', rule: 'Never reload until your magazine is completely empty.' },
    { id: 'knife', name: 'Knife out', rule: 'Run with your knife out between fights. Swap only when you see someone.' },
    { id: 'wallbang', name: 'Through the wall', rule: 'Shoot through a wall at least once every round.' },
    { id: 'jump', name: 'Jump peeks', rule: 'Jump every time you peek an angle.' },
  ];

  /* ---- JETT: one line per roll (.cv-say rules: what to do + what you get, then her joke) ---- */
  const SAY = {
    start: 'Pick agents or guns, then hit Spin and play whatever it lands on. No rerolls. Okay, maybe one.',
    empty: "Your pool is empty, so there's nothing to spin. Put a few back below. Even I need someone to play.",
    team: "Your team is set: everyone locks in what they got, no swapping. I'm watching.",
    fail: "The list didn't load, so the wheel has nothing on it. Try the page again in a minute.",
    Duelist: '{n} it is. Take the first fight on every site and make space for the team. Try to keep up.',
    Initiator: "{n} it is. Find them with your utility first, then let the team swing. I'll take the kills from there.",
    Controller: "{n} it is. Smoke the chokes so the team can cross safely. Somebody has to, and it's not me.",
    Sentinel: '{n} it is. Lock down a site and watch the flank for the team. Boring, but somebody has to.',
    jett: 'Me. Dash in, take the fight and get out before they turn around. Easily the best slice on the wheel.',
    sage: "Sage. Heal the team, wall the choke and save your revive for me. That last part isn't optional.",
    reyna: "Reyna. Take the fights and heal off every kill. Just don't take all of mine.",
    sidearm: "The {n}. Cheap and quick, good for a save round. Aim for the head and it'll do the job.",
    smg: 'The {n}. Hold close angles and keep moving while you shoot. Fast, like me.',
    shotgun: "The {n}. Hug a corner and wait for them to walk into you. Up close, it's not a fair fight.",
    rifle: 'The {n}. Stop, aim at head height and tap. It works anywhere on the map.',
    sniper: "The {n}. Hold a long angle and pick off whoever peeks. Now you're speaking my language.",
    heavy: 'The {n}. Spray through smokes and walls and keep the trigger down. Subtle, it is not.',
    operator: 'The Operator. Hold a long angle and one-shot whatever peeks. Best gun in the game, no notes.',
    classic: "The Classic. It's free, so aim for heads and hope. Bold strategy, I like it.",
  };
  const say = (t) => ($('rlSay').textContent = t);

  /* ---- state ---- */
  const DATA = { a: [], w: [] };
  const out = { a: new Set(load('vl-rl-out-a', [])), w: new Set(load('vl-rl-out-w', [])) };
  let cost = load('vl-rl-cost', 5000);
  let mode = new URLSearchParams(location.search).get('mode') === 'w' ? 'w' : 'a';
  let team = false;
  let rule = true;
  let chal = false;
  let sound = load('vl-rl-sound', false) === true;
  let rot = 0;
  let spinning = false;
  let onWheel = []; // the items the wheel is drawn with right now
  let picks = []; // this roll so far (team = up to 5)
  let roll = null; // the finished roll: { m, r: [ids], c }
  let under = -1; // the slice under the pointer

  const byId = (m, id) => DATA[m].find((x) => x.id === id);
  const pool = (m = mode) => DATA[m].filter((x) => !out[m].has(x.id) && (m === 'a' || x.cost <= cost));
  const groups = (m) => [...new Set(DATA[m].map((x) => x.group))];

  /* ---- SOUND: made here with WebAudio (no game audio); off until the key is pressed ---- */
  let ac = null;
  let lastTick = 0;
  function tone(freq, dur, type, vol, delay = 0) {
    if (!sound) return;
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + dur);
  }
  function tick() {
    const now = performance.now();
    if (now - lastTick < 28) return;
    lastTick = now;
    tone(1500 + rand(400), 0.03, 'square', 0.025);
  }
  function thud() {
    tone(90, 0.4, 'sine', 0.3);
    tone(660, 0.22, 'triangle', 0.07, 0.02);
    tone(990, 0.35, 'triangle', 0.06, 0.11);
  }

  /* ---- THE WHEEL (SVG). Angles = degrees clockwise from the top, where the pointer is. ---- */
  const pt = (a, r) => [+(r * Math.sin((a * Math.PI) / 180)).toFixed(2), +(-r * Math.cos((a * Math.PI) / 180)).toFixed(2)];
  function slicePath(a0, a1) {
    if (a1 - a0 >= 359.99) return `M0 ${-R}A${R} ${R} 0 1 1 0 ${R}A${R} ${R} 0 1 1 0 ${-R}Z`;
    const [x0, y0] = pt(a0, R);
    const [x1, y1] = pt(a1, R);
    return `M0 0L${x0} ${y0}A${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}Z`;
  }
  function drawWheel(items) {
    onWheel = items;
    under = -1;
    const n = items.length;
    const s = 360 / (n || 1);
    const shops = groups('w');
    const chord = (r) => (n === 1 ? 2 * r : 2 * r * Math.sin(((s / 2) * Math.PI) / 180));
    const face = Math.max(26, Math.min(78, chord(R * 0.8) * 0.8));
    // labels run from the hub out to the art: [start, end] radius; the font fits both the slice and the longest name
    const lab = mode === 'a' ? [R * 0.34, R * 0.66] : [R * 0.34, R * 0.55];
    const longest = Math.max(1, ...items.map((x) => x.name.length));
    const font = Math.max(8, Math.min(19, chord(R * 0.36) * 0.66, (lab[1] - lab[0]) / (longest * 0.8)));
    const gunH = Math.max(18, Math.min(44, chord(R * 0.77) * 0.62));
    $('rlSpin').innerHTML =
      items
        .map((x, i) => {
          const mid = (i + 0.5) * s;
          // agents: their own colour, lifted (Riot's are dark under the shade); guns: one grey per shop, a step apart per slice
          const fill = mode === 'a' ? lift(x.ac, 0.2) : GUN_FILL[shops.indexOf(x.group) % 2][i % 2];
          const art =
            mode === 'a'
              ? `<circle class="rl-face-bg" cy="${-R * 0.8}" r="${face / 2 + 2}"/><image href="${x.icon}" x="${-face / 2}" y="${-R * 0.8 - face / 2}" width="${face}" height="${face}"/>`
              : `<image href="${x.icon}" x="${-R * 0.18}" y="${-gunH / 2}" width="${R * 0.36}" height="${gunH}" preserveAspectRatio="xMidYMid meet" transform="translate(0 ${-R * 0.77}) rotate(-90)"/>`;
          return `<g class="rl-sl" data-i="${i}">
          <path d="${slicePath(i * s, (i + 1) * s)}" fill="${fill}"/>
          <g transform="rotate(${mid.toFixed(3)})">${art}
            <text transform="rotate(-90)" x="${lab[1].toFixed(1)}" y="0" font-size="${font.toFixed(1)}">${esc(x.name)}</text></g></g>`;
        })
        .join('') +
      (n > 1 ? items.map((_, i) => `<circle class="rl-peg" cx="${pt(i * s, R - 7)[0]}" cy="${pt(i * s, R - 7)[1]}" r="4"/>`).join('') : '');
    if (!n) $('rlNow').textContent = 'Nothing on the wheel';
    setRot(rot);
    $('rlHub').disabled = !n || spinning;
    $('rlHubSub').textContent = n ? `${n} on the wheel` : 'Empty';
  }
  // the bulbs around the rim: still at rest, they chase while it spins
  $('rlBulbs').innerHTML = Array.from({ length: 36 }, (_, i) => {
    const [x, y] = pt(i * 10 + 5, 246);
    return `<circle cx="${x}" cy="${y}" r="3.2" style="--d:${(i % 2) * -0.18}s"/>`;
  }).join('');

  function setRot(a) {
    rot = a;
    $('rlSpin').setAttribute('transform', `rotate(${a.toFixed(3)})`);
    const n = onWheel.length;
    if (!n) return;
    const s = 360 / n;
    const at = (((360 - (a % 360)) % 360) + 360) % 360; // the wheel angle under the pointer
    const i = Math.min(n - 1, Math.floor(at / s));
    const frac = at / s - i;
    // a peg pushes the pointer's tip as it comes past, then lets go
    const kick = n > 1 && frac < 0.32 ? (1 - frac / 0.32) * 22 : 0;
    $('rlPointer').style.transform = `rotate(${-kick.toFixed(2)}deg)`;
    if (i !== under) {
      under = i;
      const x = onWheel[i];
      $('rlNow').textContent = x.name;
      if (mode === 'a') $('rlStage').style.setProperty('--ac', x.ac);
      if (spinning) tick();
    }
  }

  /* ---- SPIN: the winner first, then the wheel eases onto it ---- */
  function spinTo(w) {
    return new Promise((done) => {
      const n = onWheel.length;
      const s = 360 / n;
      const land = (w + 0.5) * s + (rand(1000) / 1000 - 0.5) * 0.7 * s; // somewhere inside its slice, never on a peg
      const want = (((360 - land) % 360) + 360) % 360;
      const delta = (((want - (rot % 360)) % 360) + 360) % 360;
      const turns = reduce ? 1 : 5 + rand(3);
      const from = rot;
      const to = rot + turns * 360 + delta;
      const dur = reduce ? 700 : (team ? 3400 : 4800) + rand(1200);
      const t0 = performance.now();
      const ease = (t) => 1 - Math.pow(1 - t, 4);
      const frame = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        setRot(from + (to - from) * ease(t));
        if (t < 1) requestAnimationFrame(frame);
        else done();
      };
      requestAnimationFrame(frame);
    });
  }

  // the team's next wheel: everything left, and with Every role on, only the missing roles once the slots run short
  function teamWheel() {
    const left = pool().filter((x) => !picks.includes(x.id));
    if (mode !== 'a' || !rule) return left;
    const have = new Set(picks.map((id) => byId('a', id).group));
    const missing = ROLES.filter((r) => !have.has(r) && left.some((x) => x.group === r));
    return TEAM - picks.length <= missing.length ? left.filter((x) => missing.includes(x.group)) : left;
  }

  async function spin() {
    if (spinning) return;
    const first = team ? ((picks = []), teamWheel()) : pool();
    if (!first.length) return say(SAY.empty);
    spinning = true;
    picks = [];
    roll = null;
    document.body.classList.add('rl-busy');
    $('rlStage').classList.remove('is-locked');
    $('rlChalBox').hidden = true;
    $('rlShare').disabled = true;
    $('rlMsg').textContent = '';
    $('rlHub').disabled = true;
    $('rlStage').classList.add('is-spinning');
    if (team) drawTeam();
    const want = team ? Math.min(TEAM, pool().length) : 1;
    let items = first;
    while (picks.length < want && items.length) {
      drawWheel(items);
      $('rlHubTxt').textContent = team ? `${picks.length + 1} of ${want}` : 'Spin';
      $('rlStage').classList.remove('is-locked');
      const w = rand(items.length);
      await spinTo(w);
      picks.push(items[w].id);
      lock(w);
      if (team) {
        drawTeam();
        if (picks.length < want) await new Promise((r) => setTimeout(r, reduce ? 300 : 1100));
      }
      items = team ? teamWheel() : [];
    }
    $('rlStage').classList.remove('is-spinning');
    roll = { m: mode, r: picks.slice(), c: chal ? drawChallenge() : null };
    show(roll, true);
    spinning = false;
    document.body.classList.remove('rl-busy');
    $('rlHubTxt').textContent = 'Spin';
    $('rlHub').disabled = false;
  }

  function lock(w, quiet) {
    if (!quiet) thud();
    $('rlSpin')
      .querySelectorAll('.rl-sl')
      .forEach((g) => g.classList.toggle('is-win', +g.dataset.i === w));
    const st = $('rlStage');
    st.classList.remove('is-locked');
    void st.offsetWidth; // restart the stamp
    st.classList.add('is-locked');
    $('rlStamp').textContent = team ? `Pick ${picks.length}` : 'Locked in';
  }

  function drawChallenge(not) {
    const list = CHALLENGES.filter((c) => (mode === 'a' || !c.gun) && c.id !== not);
    return list[rand(list.length)].id;
  }

  /* ---- RESULT ---- */
  function agentCard(x) {
    return `<article class="rl-card" style="--ac:${x.ac};--ac2:${x.ac2}">
      <span class="rl-card-name" style="--bg:url('${AG}${x.id}-bg.webp')" aria-hidden="true"></span>
      <img class="rl-card-art" src="${AG}${x.id}.webp" alt="" decoding="async">
      <div class="rl-card-copy">
        <small>Locked in &middot; ${esc(x.group)}</small>
        <h3>${esc(x.name)}</h3>
        <ul class="rl-kit">${x.ab
          .map(
            ([k, name]) =>
              `<li><img src="${AG}${x.id}-${k.toLowerCase()}.webp" alt="" loading="lazy" decoding="async"><i>${esc(k)}</i><span>${esc(name)}</span></li>`,
          )
          .join('')}</ul>
        <a class="rl-key" href="/valorant/agents/${esc(x.id)}">Open ${esc(x.name)}'s file</a>
      </div>
    </article>`;
  }
  function gunCard(x) {
    return `<article class="rl-card rl-card--gun">
      <img class="rl-card-gun" src="${esc(x.icon)}" alt="" decoding="async">
      <div class="rl-card-copy">
        <small>Locked in &middot; ${esc(x.group)}</small>
        <h3>${esc(x.name)}</h3>
        <dl class="rl-facts">
          <div><dt>Cost</dt><dd>${x.cost ? fmt(x.cost) : 'Free'}</dd></div>
          <div><dt>Magazine</dt><dd>${x.raw.mag ?? '-'}</dd></div>
          <div><dt>Fire rate</dt><dd>${x.raw.fire ?? '-'}<small>/s</small></dd></div>
          <div><dt>Wall pen</dt><dd>${esc(x.raw.pen || '-')}</dd></div>
        </dl>
        <a class="rl-key" href="/valorant/weapons?w=${esc(x.id)}">Open its stats</a>
      </div>
    </article>`;
  }
  function slot(m, x, i) {
    if (!x) return `<li class="rl-slot is-empty"><span>${i + 1}</span></li>`;
    const pic =
      m === 'a'
        ? `<img src="${AG}${x.id}-card.webp" alt="" decoding="async">`
        : `<img class="rl-slot-gun" src="${esc(x.icon)}" alt="" decoding="async">`;
    const href = m === 'a' ? `/valorant/agents/${x.id}` : `/valorant/weapons?w=${x.id}`;
    return `<li class="rl-slot" style="--ac:${m === 'a' ? x.ac : '#3a3c44'}"><a href="${esc(href)}">${pic}<b>${esc(x.name)}</b><small>${esc(
      m === 'a' ? x.group : x.cost ? `${fmt(x.cost)} credits` : 'Free',
    )}</small></a></li>`;
  }
  function drawTeam() {
    $('rlOut').innerHTML =
      `<ol class="rl-team">${Array.from({ length: TEAM }, (_, i) => slot(mode, byId(mode, picks[i]), i)).join('')}</ol>`;
  }
  function idle() {
    $('rlOut').innerHTML = `<div class="rl-idle"><b>${team ? 'Five slots, five spins' : 'Nobody locked in yet'}</b><span>${
      team ? 'Press Spin and the wheel fills your team one pick at a time.' : 'Press Spin in the middle of the wheel.'
    }</span></div>`;
  }

  // fresh = a roll just made here (history + Jett); otherwise it came from a link
  function show(r, fresh) {
    const items = r.r.map((id) => byId(r.m, id));
    if (r.r.length > 1) {
      picks = r.r.slice();
      drawTeam();
      say(SAY.team);
    } else {
      const x = items[0];
      $('rlOut').innerHTML = r.m === 'a' ? agentCard(x) : gunCard(x);
      say((SAY[x.id] || SAY[r.m === 'a' ? x.group : x.raw.type] || '').replace('{n}', x.name));
    }
    drawChal(r.c, fresh);
    $('rlShare').disabled = false;
    setAddress(r);
    if (fresh) {
      const hist = load('vl-rl-hist', []).filter((h) => Array.isArray(h.r));
      hist.unshift({ ...r, t: Date.now() });
      save('vl-rl-hist', hist.slice(0, 10));
      drawHist();
    }
  }

  function drawChal(id, flicker) {
    const box = $('rlChalBox');
    const c = CHALLENGES.find((x) => x.id === id);
    box.hidden = !c;
    if (!c) return;
    const paint = (x) =>
      (box.innerHTML = `<span class="rl-chal-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="8.5" cy="8.5" r="1.3"/><circle cx="15.5" cy="15.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/></svg></span>
        <div><small>Challenge</small><b>${esc(x.name)}</b><p>${esc(x.rule)}</p></div>
        <button type="button" class="rl-key" id="rlReChal">New challenge</button>`);
    if (!flicker || reduce) return paint(c);
    // a quick shuffle through the list before it lands
    let k = 0;
    const list = CHALLENGES.filter((x) => mode === 'a' || !x.gun);
    const step = () => {
      if (k++ < 9) {
        paint(list[rand(list.length)]);
        box.classList.add('is-rolling');
        tick();
        setTimeout(step, 45 + k * 12);
      } else {
        box.classList.remove('is-rolling');
        paint(c);
      }
    };
    step();
  }

  function setAddress(r) {
    const q = new URLSearchParams();
    if (mode === 'w') q.set('mode', 'w');
    if (r) {
      q.set('r', r.r.join(','));
      if (r.c) q.set('c', r.c);
    }
    const qs = q.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : ''));
  }

  /* ---- POOL ---- */
  const plural = (g) => (ROLES.includes(g) ? `${g}s` : g);
  function drawPool() {
    const m = mode;
    $('rlPool').classList.toggle('rl-pool--gun', m === 'w');
    $('rlPool').innerHTML = groups(m)
      .map((g) => {
        const all = DATA[m].filter((x) => x.group === g);
        const on = all.filter((x) => !out[m].has(x.id)).length;
        return `<div class="rl-group">
        <div class="rl-ghead">
          <button type="button" class="rl-gname" data-g="${esc(g)}" aria-pressed="${on > 0}"><b>${esc(plural(g))}</b><span>${on} of ${all.length}</span></button>
          <button type="button" class="rl-only" data-only="${esc(g)}">Only these</button>
        </div>
        <div class="rl-items">${all
          .map((x) => {
            const pricey = m === 'w' && x.cost > cost;
            return `<button type="button" class="rl-item${pricey ? ' is-pricey' : ''}" data-id="${esc(x.id)}" aria-pressed="${!out[m].has(x.id)}"${
              pricey ? ' title="Over your price cap"' : ''
            } style="--ac:${m === 'a' ? x.ac : '#3a3c44'}"><img src="${esc(x.icon)}" alt="" loading="lazy" decoding="async"><span>${esc(x.name)}</span>${
              m === 'w' ? `<small>${x.cost ? fmt(x.cost) : 'Free'}</small>` : ''
            }</button>`;
          })
          .join('')}</div></div>`;
      })
      .join('');
    const n = pool().length;
    $('rlPCount').innerHTML = `<b>${n}</b> of ${DATA[m].length} ${m === 'a' ? 'agents' : 'guns'} on the wheel`;
    $('cbPool').textContent = n;
    $('cbPoolOf').textContent = m === 'a' ? 'Agents in your pool' : 'Guns in your pool';
    if (!spinning) drawWheel(pool());
  }
  function changed() {
    save(`vl-rl-out-${mode}`, [...out[mode]]);
    drawPool();
  }
  $('rlPool').addEventListener('click', (e) => {
    if (spinning) return;
    const it = e.target.closest('.rl-item');
    const g = e.target.closest('.rl-gname');
    const only = e.target.closest('.rl-only');
    const set = out[mode];
    if (it) set.has(it.dataset.id) ? set.delete(it.dataset.id) : set.add(it.dataset.id);
    else if (g) {
      const ids = DATA[mode].filter((x) => x.group === g.dataset.g).map((x) => x.id);
      const anyOn = ids.some((id) => !set.has(id));
      ids.forEach((id) => (anyOn ? set.add(id) : set.delete(id)));
    } else if (only) DATA[mode].forEach((x) => (x.group === only.dataset.only ? set.delete(x.id) : set.add(x.id)));
    else return;
    changed();
  });
  $('rlAll').addEventListener('click', () => {
    if (spinning) return;
    out[mode].clear();
    if (mode === 'w') setCost(maxCost());
    changed();
  });
  const maxCost = () => Math.max(0, ...DATA.w.map((x) => x.cost));
  function setCost(v) {
    cost = v;
    $('rlCost').value = v;
    $('rlCost').style.setProperty('--fill', (v / (maxCost() || 1)) * 100 + '%');
    $('rlCostOut').textContent = v >= maxCost() ? 'Any price' : v ? `${fmt(v)} credits` : 'Free only';
    save('vl-rl-cost', v);
  }
  $('rlCost').addEventListener('input', (e) => {
    if (spinning) return;
    setCost(+e.target.value);
    drawPool();
  });

  /* ---- HISTORY ---- */
  function ago(t) {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
  }
  function drawHist() {
    const hist = load('vl-rl-hist', []).filter((h) => Array.isArray(h.r) && h.r.every((id) => byId(h.m, id)));
    $('rlHistClear').hidden = !hist.length;
    $('rlHist').innerHTML = hist.length
      ? hist
          .map((h) => {
            const items = h.r.map((id) => byId(h.m, id));
            const c = CHALLENGES.find((x) => x.id === h.c);
            const q = new URLSearchParams();
            if (h.m === 'w') q.set('mode', 'w');
            q.set('r', h.r.join(','));
            if (h.c) q.set('c', h.c);
            return `<li><a href="?${q}">
            <span class="rl-hpics${h.m === 'w' ? ' rl-hpics--gun' : ''}">${items.map((x) => `<img src="${esc(x.icon)}" alt="" loading="lazy" decoding="async">`).join('')}</span>
            <span class="rl-htxt"><b>${items.map((x) => esc(x.name)).join(', ')}</b><small>${h.r.length > 1 ? 'Team of 5' : h.m === 'a' ? 'Agent' : 'Weapon'}${
              c ? ` &middot; ${esc(c.name)}` : ''
            }</small></span>
            <time datetime="${new Date(h.t).toISOString()}">${ago(h.t)}</time></a></li>`;
          })
          .join('')
      : `<li class="rl-hist-empty">No spins yet. Your first one shows up here.</li>`;
  }
  $('rlHistClear').addEventListener('click', () => {
    save('vl-rl-hist', []);
    drawHist();
  });
  // a history row opens in place (no reload)
  $('rlHist').addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || spinning) return;
    e.preventDefault();
    const r = parseRoll(new URLSearchParams(a.getAttribute('href').slice(1)));
    if (!r) return;
    setMode(r.m, false);
    setTeam(r.r.length > 1, false);
    showAt(r);
    $('rlTitle').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });

  /* ---- CONTROLS ---- */
  function setMode(m, reset = true) {
    mode = m;
    $('rlModes')
      .querySelectorAll('button')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    $('rlStage').classList.toggle('is-gun', m === 'w');
    if (m === 'w') $('rlStage').style.setProperty('--ac', '#c23b3b');
    $('rlCostRow').hidden = m !== 'w';
    $('rlRule').hidden = !(team && m === 'a');
    $('rlStage').classList.remove('is-locked');
    drawPool();
    if (reset) {
      roll = null;
      picks = [];
      $('rlChalBox').hidden = true;
      $('rlShare').disabled = true;
      say(SAY.start);
      setAddress(null);
      idle();
    }
  }
  function setTeam(on, reset = true) {
    team = on;
    $('rlRoll')
      .querySelectorAll('button')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.team === (on ? '1' : '0'))));
    $('rlRule').hidden = !(on && mode === 'a');
    if (reset && !roll) idle();
  }
  $('rlModes').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && !spinning && b.dataset.mode !== mode) setMode(b.dataset.mode);
  });
  $('rlRoll').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && !spinning) setTeam(b.dataset.team === '1');
  });
  const toggle = (id, get, set) =>
    $(id).addEventListener('click', () => {
      set(!get());
      $(id).setAttribute('aria-pressed', String(get()));
    });
  toggle(
    'rlRule',
    () => rule,
    (v) => (rule = v),
  );
  toggle(
    'rlChal',
    () => chal,
    (v) => (chal = v),
  );
  toggle(
    'rlSound',
    () => sound,
    (v) => {
      sound = v;
      save('vl-rl-sound', v);
      if (v) tick();
    },
  );
  $('rlSound').setAttribute('aria-pressed', String(sound));
  $('rlHub').addEventListener('click', spin);
  $('rlChalBox').addEventListener('click', (e) => {
    if (!e.target.closest('#rlReChal') || !roll || spinning) return;
    roll.c = drawChallenge(roll.c);
    drawChal(roll.c, true);
    setAddress(roll);
  });
  $('rlShare').addEventListener('click', () => {
    navigator.clipboard
      ?.writeText(location.href)
      .then(() => ($('rlMsg').textContent = 'Link copied. Send it to your team.'))
      .catch(() => ($('rlMsg').textContent = 'Copy failed: copy the address bar instead.'));
  });

  // ?mode=&r=&c= -> a roll, or null if anything in it is unknown
  function parseRoll(q) {
    const m = q.get('mode') === 'w' ? 'w' : 'a';
    const ids = (q.get('r') || '').split(',').filter(Boolean);
    if (!(ids.length === 1 || (ids.length > 1 && ids.length <= TEAM && new Set(ids).size === ids.length))) return null;
    if (!ids.every((id) => byId(m, id))) return null;
    const c = CHALLENGES.find((x) => x.id === q.get('c'));
    return { m, r: ids, c: c && (m === 'a' || !c.gun) ? c.id : null };
  }

  /* ---- DATA ---- */
  const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${u} ${r.status}`))));
  Promise.allSettled([get('/valorant-roster.json'), get('/valorant-weapons.json')]).then(([ro, we]) => {
    if (ro.status === 'fulfilled' && Array.isArray(ro.value)) {
      DATA.a = ro.value
        .map((a) => ({
          id: a.slug,
          name: a.name,
          group: a.role,
          ac: a.ac || '#2a2c35',
          ac2: a.ac2 || '#141518',
          ab: a.ab || [],
          icon: `${AG}${a.slug}-icon.webp`,
        }))
        .sort((x, y) => x.name.localeCompare(y.name));
      $('cbAgents').textContent = DATA.a.length;
    } else $('cbAgents').textContent = 'Not loaded';
    if (we.status === 'fulfilled' && Array.isArray(we.value?.guns)) {
      DATA.w = we.value.guns.map((g) => ({ id: g.id, name: g.name, group: g.shop, cost: g.cost || 0, icon: g.icon, raw: g }));
      $('cbGuns').textContent = DATA.w.length;
      $('rlCost').max = maxCost();
      setCost(Math.min(cost, maxCost()));
    } else $('cbGuns').textContent = 'Not loaded';
    const q = new URLSearchParams(location.search);
    const r = parseRoll(q);
    if (!DATA[mode].length) mode = DATA.a.length ? 'a' : 'w';
    setTeam(!!r && r.r.length > 1, false);
    setMode(r ? r.m : mode, !r);
    drawHist();
    if (!DATA.a.length && !DATA.w.length) {
      say(SAY.fail);
      $('rlOut').innerHTML =
        `<div class="rl-idle"><b>The wheel could not load</b><span>Neither the agent list nor the gun list answered.</span></div>`;
      return;
    }
    $('rlModes')
      .querySelectorAll('button')
      .forEach((b) => (b.disabled = !DATA[b.dataset.mode].length));
    if (r) showAt(r);
  });

  // a roll from a link or the history: shown as it was, the wheel turned so its (first) pick sits under the pointer
  function showAt(r) {
    roll = r;
    show(r, false);
    const i = onWheel.findIndex((x) => x.id === r.r[0]);
    if (i < 0) return;
    setRot(360 - (i + 0.5) * (360 / onWheel.length));
    lock(i, true);
    $('rlStage').classList.remove('is-locked');
  }
})();
