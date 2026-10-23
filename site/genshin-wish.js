// The wish card (.gw, Oct 23 2026): shared by the Lobby and the Banners page, so both draw the
// same card (moved out of genshin-lobby.js). Markup: #giWish in each page. Styles: genshin-wish.css.
// GI.wishCard(banners, {start, onShow}) fills it; returns {tick} (the clock, for a server switch).
//
// The wishes as a tray (top left), the 5-star's cut-out on its element's backdrop, the six
// constellations as a star chart on the art, and one Inspect panel that shows what the hovered /
// tapped talent, constellation or weapon does. Text: the feed's "kit" (yatta via
// scripts/genshin-feed.py); [[word]] = the game's highlighted words. Chart shapes are decoration
// only (picked by the character id), not the in-game ones.
//
// Weapon wish (v2, Oct 23 2026, Adrian: the weapons page's overview look): the picked 5-star
// weapon's overview (type, name, stars, Base ATK / substat / max level plates) in the info column,
// both weapons standing upright on lit floors in the art (the picked one forward), the 5-star keys
// pick between them, Inspect shows the picked one's passive. Gold, the 5-star rarity light.
(function () {
  const { $, esc, now, EL, NEUTRAL, parts, pad, srvEnd, fit, tile, TBF, SI, SUB_ICON } = window.GI;
  const GOLD = '#d6aa5c'; // the weapons page's 5-star --wr (214, 170, 92)
  const CHARTS = [
    [[10, 82], [28, 60], [20, 34], [46, 20], [72, 10], [88, 38]],
    [[12, 18], [34, 36], [18, 62], [48, 76], [70, 52], [88, 80]],
    [[8, 58], [26, 26], [50, 44], [70, 14], [90, 42], [72, 84]],
  ];
  const DUST = [[4, 30], [38, 6], [60, 34], [94, 8], [40, 92], [84, 62], [16, 8], [58, 66], [96, 92]];
  const TALENT_KIND = ['Normal Attack', 'Elemental Skill', 'Elemental Burst'];
  const TALENT_CAP = ['Normal', 'Skill', 'Burst'];
  const rich = (t) => esc(t).replace(/\[\[(.+?)\]\]/g, '<b>$1</b>').replace(/\n/g, '<br>');
  const si = (k) => `<svg class="gw-si" viewBox="0 0 24 24" aria-hidden="true">${SI[k] || SI.atk}</svg>`;
  const subVal = (s, v) => (s === 'Elemental Mastery' ? String(v) : v.toFixed(1) + '%');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let views = [];
  let cur = -1;
  let wsel = 0; // the picked 5-star on a weapon wish
  let items = {}; // key -> {icon, rarity?, kicker, name, text}
  let pinned = '';
  let onShow = null;

  const label = (b) => {
    const five = (b.characters || []).find((c) => c.rarity === 5);
    return five ? five.name : 'Weapons';
  };

  function wishCard(banners, opts = {}) {
    onShow = opts.onShow;
    views = banners.filter((b) => (b.characters && b.characters.length) || (b.weapons && b.weapons.length));
    const card = $('giWish');
    if (!views.length) {
      $('giMeta').textContent = 'No wish is running right now.';
      return { tick() {} };
    }
    GI.stars(card);
    card.insertAdjacentHTML('afterbegin', `<span class="gi-tbf gw-tbf" aria-hidden="true">${TBF}</span>`);
    $('giSwitch').innerHTML = views
      .map((b, i) => {
        const five = (b.characters || []).find((c) => c.rarity === 5);
        const pic = five ? five.icon : (b.weapons[0] || {}).icon;
        return `<button type="button" class="gi-tab" role="tab" data-i="${i}">${pic ? `<img src="${esc(pic)}" alt="">` : ''}${esc(label(b))}</button>`;
      })
      .join('');
    $('giSwitch').hidden = views.length < 2;
    $('giSwitch').addEventListener('click', (e) => {
      const t = e.target.closest('[data-i]');
      if (t && +t.dataset.i !== cur) show(+t.dataset.i);
    });

    // Inspect: hover / focus previews, a click pins (and is what touch gets). A weapon key's
    // click also picks that weapon.
    const pick = (e) => e.target.closest('[data-k]');
    card.addEventListener('mouseover', (e) => pick(e) && inspect(pick(e).dataset.k));
    card.addEventListener('focusin', (e) => pick(e) && inspect(pick(e).dataset.k));
    card.addEventListener('mouseout', (e) => pick(e) && !pick(e).contains(e.relatedTarget) && inspect(pinned));
    card.addEventListener('focusout', (e) => pick(e) && inspect(pinned));
    card.addEventListener('click', (e) => {
      const k = pick(e);
      if (!k) return;
      pinned = k.dataset.k;
      if (pinned[0] === 'w' && +pinned.slice(1) !== wsel) pickWep(+pinned.slice(1));
      inspect(pinned);
    });

    // The chart draws itself the first time the card is on screen.
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (en) => {
          if (!en[0].isIntersecting) return;
          card.classList.add('is-in');
          io.disconnect();
        },
        { threshold: 0.35 }
      );
      io.observe(card);
    } else card.classList.add('is-in');

    // opts.start: a wish's slug ("weapons", "columbina"...), e.g. from the address's #hash.
    show(Math.max(0, views.findIndex((b) => slug(label(b)) === opts.start)));
    measure();
    // Width only: a phone's URL bar resizes the window on every scroll.
    let w = innerWidth;
    window.addEventListener('resize', () => {
      if (innerWidth === w) return;
      w = innerWidth;
      measure();
      fit($('giName'));
    });
    if (document.fonts) document.fonts.ready.then(measure);
    setInterval(clock, 1000);
    return { tick: clock };
  }

  // The countdown, to the picked wish's end on the picked server.
  function clock() {
    const c = $('giClock');
    if (!c || !c.dataset.srv) return;
    const p = parts(srvEnd(c.dataset.srv) - now());
    c.querySelectorAll('[data-u]').forEach((b) => (b.textContent = pad(p[b.dataset.u])));
  }

  // Phones stack the card, and a weapon wish has no constellation row: keep the
  // tallest wish's height as the card's min-height so switching never moves the page.
  // (The side-by-side card has a fixed height: only the phone grid needs it.)
  function measure() {
    const card = $('giWish');
    card.style.minHeight = '';
    if (views.length < 2 || getComputedStyle(card).display === 'block') return;
    let tall = 0;
    const keep = wsel;
    views.forEach((b) => {
      wsel = 0;
      fill(b);
      tall = Math.max(tall, card.offsetHeight);
    });
    wsel = keep;
    fill(views[cur]);
    inspect(pinned);
    card.style.minHeight = tall + 'px';
  }

  function show(i) {
    const b = views[i];
    const first = cur < 0;
    cur = i;
    wsel = 0;
    const card = $('giWish');
    $('giSwitch').querySelectorAll('[data-i]').forEach((t) => {
      const on = +t.dataset.i === i;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on);
    });
    const five = (b.characters || []).find((c) => c.rarity === 5);
    card.style.setProperty('--gi-el', five ? EL[five.element] || NEUTRAL : GOLD);
    card.classList.toggle('is-wep', !five);
    fill(b);
    pinned = items.t2 ? 't2' : Object.keys(items)[0] || ''; // the Burst, or the picked weapon
    inspect(pinned);
    art(five, b);
    if (!first) replay();
    const c = $('giClock');
    c.dataset.srv = b.end;
    c.hidden = false;
    clock();
    if (onShow) onShow(b, i);
  }

  // Replay the entrance: the info rises in line by line (not on the first paint).
  function replay() {
    const card = $('giWish');
    card.classList.remove('is-swap');
    void card.offsetWidth;
    card.classList.add('is-swap');
  }

  // A weapon wish: bring the other 5-star forward (no slide, the art stays put).
  function pickWep(n) {
    wsel = n;
    fill(views[cur]);
    $('gwArt').querySelectorAll('.gw-wep').forEach((f, j) => f.classList.toggle('is-on', j === n));
    replay();
  }

  // Text, rows and chart for one wish (no art, no animation: measure() calls it too).
  function fill(b) {
    const five = (b.characters || []).find((c) => c.rarity === 5);
    const kit = (five && five.kit) || {};
    items = {};
    // Short eyebrow (Adrian): "7.1 Event Wish" / "7.1 Weapon Wish", not the feed's
    // "Character Event Wish 2 · Version 7.1".
    const kind = /weapon/i.test(b.name) ? 'Weapon Wish' : /chronicled/i.test(b.name) ? 'Chronicled Wish' : 'Event Wish';
    $('giEyebrow').textContent = (b.version ? b.version + ' ' : '') + kind;
    let four;
    let kitRow = '';
    let plates = '';
    if (five) {
      $('giName').textContent = five.name;
      $('giTitle').textContent = five.title || '';
      $('giMeta').innerHTML = [
        `<span class="gw-el">${EL[five.element] ? `<img src="/images/genshin/element/${five.element.toLowerCase()}.webp" alt="">` : ''}${esc(five.element)}</span>`,
        esc(five.weapon),
        esc(five.affiliation),
      ]
        .filter(Boolean)
        .join('<i aria-hidden="true">·</i>');
      (kit.talents || []).forEach((t, n) => {
        items['t' + n] = { icon: t.icon, kicker: TALENT_KIND[n], name: t.name, text: t.text };
        kitRow += `<button type="button" class="gw-tal" data-k="t${n}" aria-label="${esc(TALENT_KIND[n] + ': ' + t.name)}"><span class="gw-tal-ic"><img src="${esc(t.icon)}" alt=""></span><small>${TALENT_CAP[n]}</small></button>`;
      });
      (kit.cons || []).forEach(
        (c, n) => (items['c' + n] = { icon: c.icon, kicker: 'Constellation ' + (n + 1) + (kit.constellation ? ' · ' + kit.constellation : ''), name: c.name, text: c.text })
      );
      $('gwKitLabel').textContent = 'Talents';
      four = b.characters.filter((c) => c.rarity === 4);
      $('giFourLabel').innerHTML = 'Featured 4&#9733;';
      $('giFourRow').innerHTML = four.map((c) => `<figure>${tile(c.icon, 4, c.name)}<figcaption>${esc(c.name)}</figcaption></figure>`).join('');
    } else {
      const top = b.weapons.filter((w) => w.rarity === 5);
      const w = top[wsel] || top[0] || {};
      $('giName').textContent = w.name || 'Epitome Invocation';
      $('giTitle').textContent = w.type || 'Weapon Event Wish';
      $('giMeta').textContent = '';
      // The weapons page's stat plates, at max level (feed: "max" = [level, Base ATK, substat]).
      if (w.max) {
        const [lv, atk, sub] = w.max;
        plates =
          `<div>${si('atk')}<dt>Base ATK</dt><dd>${atk}</dd></div>` +
          (w.sub ? `<div>${si(SUB_ICON[w.sub])}<dt>${esc(w.sub.replace('Physical DMG Bonus', 'Physical DMG'))}</dt><dd>${subVal(w.sub, sub)}</dd></div>` : '') +
          `<div class="gw-plate-lv"><dt>Max level</dt><dd>${lv}</dd></div>`;
      }
      top.forEach((x, n) => {
        if (x.passive) items['w' + n] = { icon: x.icon, rarity: 5, kicker: [x.name, x.sub && x.sub + ' substat'].filter(Boolean).join(' · '), name: x.passive.name, text: x.passive.text + '\n(Refinement 1)' };
        kitRow += `<button type="button" class="gw-tal gw-tal--wep${n === wsel ? ' is-on' : ''}" data-k="w${n}" aria-pressed="${n === wsel}" aria-label="${esc(x.name + (x.passive ? ': ' + x.passive.name : ''))}"><span class="gw-tal-ic">${tile(x.icon, 5, '')}</span><small>${esc(x.type || '')}</small></button>`;
      });
      $('gwKitLabel').textContent = 'Featured 5★ · pick one';
      four = b.weapons.filter((x) => x.rarity === 4);
      $('giFourLabel').innerHTML = 'Featured 4&#9733; weapons';
      $('giFourRow').innerHTML = four.map((x) => `<figure>${tile(x.icon, 4, x.name)}</figure>`).join('');
    }
    $('gwPlates').innerHTML = plates;
    $('gwPlates').hidden = !plates;
    $('giMeta').hidden = !!plates;
    $('gwKit').innerHTML = kitRow;
    $('gwKitBox').hidden = !kitRow;
    $('giFour').hidden = !four.length;
    chart(five, kit);
    fit($('giName'));
  }

  // The star chart: six nodes joined C1 -> C6. Desktop draws it on the art (absolute,
  // % positions); phones lay the same buttons out as a row (CSS ignores --x / --y there).
  function chart(five, kit) {
    const el = $('gwChart');
    const cons = kit.cons || [];
    el.hidden = cons.length < 6;
    if (el.hidden) return (el.innerHTML = '');
    const pts = CHARTS[(five.id || 0) % CHARTS.length];
    const segs = pts
      .slice(1)
      .map((p, n) => `<line pathLength="1" style="--n:${n}" x1="${pts[n][0]}" y1="${pts[n][1]}" x2="${p[0]}" y2="${p[1]}"/>`)
      .join('');
    const dust = DUST.map(([x, y], n) => `<circle cx="${x}" cy="${y}" r="0.7" style="--n:${n}"/>`).join('');
    el.innerHTML = `<p class="gw-chart-name"><span>Constellation</span>${esc(kit.constellation || '')}</p><div class="gw-sky"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${dust}${segs}</svg>${cons
      .map(
        (c, n) =>
          `<button type="button" class="gw-node" data-k="c${n}" style="--x:${pts[n][0]}%;--y:${pts[n][1]}%;--n:${n}" aria-label="${esc('Constellation ' + (n + 1) + ': ' + c.name)}"><img src="${esc(c.icon)}" alt=""><i>C${n + 1}</i></button>`
      )
      .join('')}</div>`;
  }

  // Inspect panel, plus the chart's "path so far": C1..Cn and the lines between light up.
  function inspect(k) {
    const it = items[k];
    const box = $('gwInsp');
    box.hidden = !it;
    if (!it) return;
    if (box.dataset.k !== k || $('gwInspN').textContent !== it.name) {
      box.dataset.k = k;
      $('gwInspIc').innerHTML = it.rarity ? tile(it.icon, it.rarity, '') : `<img src="${esc(it.icon)}" alt="">`;
      $('gwInspK').textContent = it.kicker;
      $('gwInspN').textContent = it.name;
      $('gwInspT').innerHTML = rich(it.text);
      $('gwInspT').scrollTop = 0;
      box.classList.remove('is-new');
      void box.offsetWidth;
      box.classList.add('is-new');
    }
    const upto = k[0] === 'c' ? +k.slice(1) : -1;
    $('gwChart').querySelectorAll('.gw-node').forEach((n, j) => n.classList.toggle('is-lit', j <= upto));
    $('gwChart').querySelectorAll('line').forEach((l, j) => l.classList.toggle('is-lit', j < upto));
    $('giWish').querySelectorAll('[data-k]').forEach((n) => n.classList.toggle('is-pin', n.dataset.k === pinned));
  }

  // Art swap: the new cut-out slides in from the right while the old one drifts out left.
  // A weapon wish: both 5-stars upright (the weapons page's art), each on its own lit floor.
  function art(five, b) {
    const box = $('gwArt');
    const old = [...box.querySelectorAll('.gw-img, .gw-weps')];
    let next;
    if (five) {
      if (!five.splash) return old.forEach((o) => o.remove());
      next = document.createElement('img');
      next.className = 'gw-img';
      next.alt = '';
      next.decoding = 'async';
      next.src = five.splash;
    } else {
      next = document.createElement('div');
      next.className = 'gw-weps';
      next.innerHTML = b.weapons
        .filter((w) => w.rarity === 5)
        .map(
          (w, n) =>
            `<figure class="gw-wep${n === wsel ? ' is-on' : ''}" style="--n:${n}"><span class="gw-pillar"></span><span class="gw-floor"></span><img src="${esc(w.art || w.icon)}" alt=""${w.art ? '' : ' class="is-icon"'}></figure>`
        )
        .join('');
    }
    box.append(next);
    const go = () => {
      next.classList.add('is-in');
      old.forEach((o) => {
        o.classList.add('is-out');
        setTimeout(() => o.remove(), still.matches ? 0 : 500);
      });
    };
    if (next.tagName === 'IMG' && !next.complete) {
      next.addEventListener('load', go, { once: true });
      next.addEventListener('error', go, { once: true });
    } else requestAnimationFrame(go);
  }

  GI.wishCard = wishCard;
})();
