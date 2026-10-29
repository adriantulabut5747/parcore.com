// Genshin Impact redeem codes (/genshin-impact/codes, Oct 23 2026). Every active code
// (feed `codes`), How to redeem (moved here from the Lobby: the cursor walks a drawn Paimon
// Menu), every expired code (feed `expired`) with a "check a code" box, and the FAQ.
// Shared helpers + the code row + Copy: genshin-core.js. Styles: genshin-codes.css.
(function () {
  const { $, esc, PRIMO, codeRow } = window.GI;
  const SHOW = 24; // expired codes shown before "Show all"

  // The month in the title, so a search result never looks stale.
  document.title = document.title.replace(/\(.*?\)/, '(' + new Date().toLocaleString('en', { month: 'long', year: 'numeric' }) + ')');

  // ---- HOW TO REDEEM: the cursor walks the drawn Paimon Menu ----
  // Reward icons the mail shows, by item name (yatta item ids).
  const ITEM = { Primogem: '/images/genshin/primogem.webp', Mora: 202, "Hero's Wit": 104003, "Adventurer's Experience": 104002, 'Mystic Enhancement Ore': 104013, 'Fine Enhancement Ore': 104012 };
  function redeemDemo(code) {
    const stage = $('grStage');
    if (!stage) return;
    const cur = $('grCursor');
    const ring = $('grRing');
    const steps = [...document.querySelectorAll('#grSteps .gr-step')];
    const text = (code && code.code) || 'GENSHINGIFT';
    $('grGifts').innerHTML = ((code && code.rewards) || ['Primogem ×50'])
      .map((r) => {
        const m = r.match(/^(.*?)\s*[×x]\s*([\d,]+)$/);
        if (!m || !ITEM[m[1]]) return '';
        const src = typeof ITEM[m[1]] === 'string' ? ITEM[m[1]] : ASSET_ITEM(ITEM[m[1]]);
        return `<span class="gr-gift"><img src="${esc(src)}" alt=""><b>${esc(m[2])}</b></span>`;
      })
      .join('');
    $('grCap').textContent = 'Drawn for this guide, not a screenshot. Typing: ' + text + ', one of the live codes above.';
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timers = [];
    let step = 0;
    let visible = false;
    const later = (ms, fn) => timers.push(setTimeout(fn, ms));
    const stop = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };
    const move = (el) => {
      const s = stage.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const x = r.left - s.left + r.width / 2;
      const y = r.top - s.top + r.height / 2;
      cur.style.transform = `translate(${x}px, ${y}px)`;
      ring.style.left = x + 'px';
      ring.style.top = y + 'px';
    };
    const click = () => {
      ring.classList.remove('is-on');
      void ring.offsetWidth;
      ring.classList.add('is-on');
    };
    const SCENES = ['menu', 'set', 'dlg', 'mail'];
    function play(i, auto) {
      stop();
      step = i;
      steps.forEach((li, n) => {
        li.classList.toggle('is-on', n === i);
        li.querySelector('button').setAttribute('aria-current', n === i ? 'step' : 'false');
      });
      stage.dataset.scene = SCENES[i];
      const typed = $('grTyped');
      typed.textContent = i === 2 && !reduce ? '' : i >= 2 ? text : '';
      if (reduce) return;
      if (i === 0) {
        later(300, () => move($('grGear')));
        later(1200, click);
      } else if (i === 1) {
        later(300, () => move($('grAccount')));
        later(1100, click);
        later(1500, () => move($('grRedeemNow')));
        later(2300, click);
      } else if (i === 2) {
        [...text].forEach((ch, n) => later(400 + n * 90, () => (typed.textContent += ch)));
        const done = 400 + text.length * 90;
        later(done + 200, () => move($('grExchange')));
        later(done + 1000, click);
      } else {
        later(400, () => move($('grClaim')));
        later(1200, click);
      }
      if (auto) later(i === 2 ? 600 + text.length * 90 + 2200 : 3400, () => visible && play((i + 1) % 4, true));
    }
    steps.forEach((li, n) => li.querySelector('button').addEventListener('click', () => play(n, true)));
    // Only animate while it's on screen.
    new IntersectionObserver((es) => {
      visible = es[0].isIntersecting;
      if (visible) play(step, true);
      else stop();
    }, { threshold: 0.35 }).observe(stage);
    play(0, false);
  }
  const ASSET_ITEM = (id) => 'https://gi.yatta.moe/assets/UI/UI_ItemIcon_' + id + '.png';

  // ---- EXPIRED + CHECK A CODE ----
  let active = [];
  let expired = [];
  let all = false;
  const norm = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  function renderOld() {
    const q = norm($('cdQ').value);
    const hits = q ? expired.filter((c) => c.code.includes(q)) : expired;
    const list = q || all ? hits : hits.slice(0, SHOW);
    $('cdOld').innerHTML = list
      .map((c) => `<span class="cd-chip${q && c.code === q ? ' is-hit' : ''}"><b>${esc(c.code)}</b>${c.primos ? `<span class="gi-primo">${PRIMO}${c.primos}</span>` : ''}</span>`)
      .join('');
    $('cdMore').hidden = !!q || all || expired.length <= SHOW;
    let msg = '';
    if (q) {
      if (active.some((c) => c.code === q)) msg = `<b>${esc(q)}</b> still works: it's in Active codes above.`;
      else if (expired.some((c) => c.code === q)) msg = `<b>${esc(q)}</b> has expired.`;
      else if (!hits.length) msg = `<b>${esc(q)}</b> isn't on our list. Check the spelling, or it may be too new or never existed.`;
    }
    $('cdCheck').innerHTML = msg;
  }
  $('cdQ').addEventListener('input', renderOld);
  $('cdMore').addEventListener('click', () => {
    all = true;
    renderOld();
  });

  GI.feed
    .then((feed) => {
      active = feed.codes || [];
      expired = feed.expired || [];
      const sum = active.reduce((a, c) => a + (c.primos || 0), 0);
      $('cdFacts').innerHTML =
        `<li><b>${active.length}</b>active code${active.length === 1 ? '' : 's'}</li>` +
        (sum ? `<li><b>${sum.toLocaleString()}</b>Primogems</li>` : '') +
        (expired.length ? `<li><b>${expired.length}</b>expired</li>` : '');
      $('cdList').innerHTML = active.length ? active.map(codeRow).join('') : "<p class=\"gi-box gi-empty\">No active codes right now. New ones usually come with the next version's livestream.</p>";
      // Klee's line: the same live count, in her voice.
      $('cdKlee').textContent = active.length
        ? `Klee found ${active.length} code${active.length === 1 ? '' : 's'}${sum ? ` worth ${sum.toLocaleString()} Primogems` : ''}! Redeem them before they run out.`
        : 'No codes right now. Klee is watching for the next livestream!';
      if (sum) $('cdActiveSub').textContent = `${active.length} codes worth ${sum.toLocaleString()} Primogems, checked every three hours. Redeem opens the official gift page with the code filled in.`;
      $('cdMore').textContent = `Show all ${expired.length}`;
      if (!expired.length) $('cdOldSub').textContent = "The expired list isn't available right now.";
      renderOld();
      redeemDemo(active.find((c) => c.primos) || active[0]);
    })
    .catch((err) => {
      console.error('Codes failed to load:', err);
      $('cdList').innerHTML = "<p class=\"gi-box gi-empty\">Couldn't load the codes right now. Try again in a bit.</p>";
      $('cdKlee').textContent = "Klee couldn't find the codes. Try again in a bit!";
      redeemDemo(null);
    });
})();
