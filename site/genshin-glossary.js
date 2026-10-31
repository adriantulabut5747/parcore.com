// Genshin Impact -- Glossary (/genshin-impact/glossary, Oct 26 2026). Everything from genshin-glossary.json:
// the Most asked cards (hot: true), the decoder (lines of jargon you tap to read), and every term by topic with
// a search. The search and topic live in the address (?q= / ?s=), a term's link is #t-<id>.
// Styles: genshin-glossary.css. The JSON is our own text, but it still goes through esc().
(function () {
  const { $, esc } = window.GI;
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const norm = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w/+.:-]+/g, ' ').trim();

  fetch('/genshin-glossary.json')
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(run)
    .catch((err) => {
      console.error('genshin-glossary.json failed to load:', err);
      $('glList').innerHTML = '<p class="gi-box gi-empty">Couldn’t load the glossary right now. Try again in a bit.</p>';
      $('glKlee').textContent = "Klee couldn't find the words. Try again in a bit!";
    });

  function run(D) {
    const all = D.sections.flatMap((s) => s.terms.map((t) => ({ ...t, sec: s })));
    const byId = Object.fromEntries(all.map((t) => [t.id, t]));
    // What the search looks through: the term, its other spellings, the definition.
    all.forEach((t) => (t.hay = norm([t.term, ...(t.also || []), t.def].join(' '))));

    $('glFacts').innerHTML = `<li><b>${all.length}</b>terms</li><li><b>${D.sections.length}</b>topics</li><li>Checked for <b>${esc(D.version)}</b></li>`;
    $('glKlee').textContent = `Klee learned all ${all.length} words! Search for one, or jump to a topic.`; // Klee's line under the header (Oct 27 2026)

    // One dictionary row: the word (+ other spellings) left, meaning / example / see also right.
    // Most asked reuses it without the id (the full list owns #t-<id>).
    const row = (t, withId) => `<article class="gl-row"${withId ? ` id="t-${t.id}"` : ''}>
        <div class="gl-row-w"><h4>${esc(t.term)}</h4>${(t.also || []).length ? `<p class="gl-also">${t.also.map(esc).join(', ')}</p>` : ''}</div>
        <div class="gl-row-d">
          <p class="gl-def">${esc(t.def)}</p>
          ${t.ex ? `<q>${esc(t.ex)}</q>` : ''}
          ${
            (t.see || []).length || t.link
              ? `<p class="gl-more">${
                  (t.see || []).length
                    ? `<span>See also ${t.see.map((id) => `<a class="gl-see" href="#t-${id}" data-term="${id}">${esc(byId[id].term)}</a>`).join(', ')}</span>`
                    : ''
                }${t.link ? `<a class="gl-link" href="${esc(t.link)}">${esc(pageName(t.link))}${ARROW}</a>` : ''}</p>`
              : ''
          }
        </div>
      </article>`;

    // ---- MOST ASKED ----
    $('glHot').innerHTML = all
      .filter((t) => t.hot)
      .map((t) => row(t, false))
      .join('');

    // ---- DECODER: a line of jargon; tap a word to read it ----
    const tabs = $('glDecTabs');
    tabs.innerHTML = D.decode.map((d, i) => `<button type="button" class="gi-tab" role="tab" data-i="${i}">${esc(d.label)}</button>`).join('');
    function word(id) {
      const t = byId[id];
      $('glDecLine').querySelectorAll('[data-w]').forEach((b) => b.classList.toggle('is-on', b.dataset.w === id));
      $('glDecOut').innerHTML = `<span class="gi-label">${esc(t.sec.label)}</span><b>${esc(t.term)}</b><p>${esc(t.def)}</p>
        <a class="gi-key gl-dec-go" href="#t-${t.id}" data-term="${t.id}">Full entry${ARROW}</a>`;
    }
    function line(i) {
      const d = D.decode[i];
      tabs.querySelectorAll('.gi-tab').forEach((b) => {
        b.classList.toggle('active', +b.dataset.i === i);
        b.setAttribute('aria-selected', +b.dataset.i === i);
      });
      $('glDecLine').innerHTML = d.line.map(([s, id]) => (id ? `<button type="button" class="gl-w" data-w="${id}">${esc(s)}</button>` : esc(s))).join('');
      $('glDecCount').textContent = d.line.filter(([, id]) => id).length + ' terms in this line';
      word(d.line.find(([, id]) => id)[1]);
    }
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (b) line(+b.dataset.i);
    });
    $('glDecLine').addEventListener('click', (e) => {
      const b = e.target.closest('[data-w]');
      if (b) word(b.dataset.w);
    });
    line(0);

    // ---- EVERY TERM: topic tray + search, grouped by topic ----
    const chips = $('glTopics');
    chips.innerHTML =
      '<button type="button" class="gi-tab" data-s="" role="tab">All</button>' +
      D.sections.map((s) => `<button type="button" class="gi-tab" data-s="${s.id}" role="tab"><img src="${esc(s.icon)}" alt="">${esc(s.label)}</button>`).join('');
    let topic = '';
    let q = '';
    const params = new URLSearchParams(location.search);
    q = params.get('q') || '';
    topic = D.sections.some((s) => s.id === params.get('s')) ? params.get('s') : '';
    $('glQ').value = q;
    function paint() {
      const words = norm(q).split(' ').filter(Boolean);
      const hit = (t) => words.every((w) => t.hay.includes(w));
      let n = 0;
      $('glList').innerHTML = D.sections
        .filter((s) => !topic || s.id === topic)
        .map((s) => {
          const list = s.terms.map((t) => byId[t.id]).filter(hit);
          n += list.length;
          return list.length
            ? `<section class="gl-sec" aria-label="${esc(s.label)}"><h3 class="gl-sec-h"><img src="${esc(s.icon)}" alt="">${esc(s.label)}<small>${list.length}</small></h3><div class="gi-box gl-dict">${list.map((t) => row(t, true)).join('')}</div></section>`
            : '';
        })
        .join('');
      $('glEmpty').hidden = n > 0;
      $('glEmptyQ').textContent = q;
      $('glCount').textContent = q || topic ? `${n} of ${all.length} terms` : `All ${all.length} terms`;
      chips.querySelectorAll('.gi-tab').forEach((b) => {
        b.classList.toggle('active', b.dataset.s === topic);
        b.setAttribute('aria-selected', b.dataset.s === topic);
      });
      const p = new URLSearchParams();
      if (q) p.set('q', q);
      if (topic) p.set('s', topic);
      history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash);
    }
    $('glQ').addEventListener('input', () => {
      q = $('glQ').value;
      paint();
    });
    chips.addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      topic = b.dataset.s;
      paint();
    });
    $('glClear').addEventListener('click', () => {
      q = '';
      topic = '';
      $('glQ').value = '';
      paint();
    });

    // Any link to a term (cards, decoder, "see also"): clear filters that would hide it, glide there, flash it.
    function go(id) {
      if (!byId[id]) return;
      if ((topic && byId[id].sec.id !== topic) || (q && !document.getElementById('t-' + id))) {
        q = '';
        topic = '';
        $('glQ').value = '';
      }
      paint();
      const el = document.getElementById('t-' + id);
      history.replaceState(null, '', location.pathname + location.search + '#t-' + id);
      GI.glide(el, () => {
        el.classList.remove('is-flash');
        void el.offsetWidth;
        el.classList.add('is-flash');
      });
    }
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-term]');
      if (!a) return;
      e.preventDefault();
      go(a.dataset.term);
    });
    paint();
    const start = location.hash.match(/^#t-([\w-]+)$/);
    if (start && byId[start[1]]) requestAnimationFrame(() => go(start[1]));
  }

  // "See also" page links: the page's name from its address.
  function pageName(link) {
    const p = link.split(/[?#]/)[0].replace(/\/$/, '').split('/').pop();
    const NAMES = { '': 'Lobby', 'genshin-impact': 'Lobby', reactions: 'Reactions chart', reruns: 'Rerun tracker', codes: 'Redeem codes', endgame: 'Endgame', farm: 'Daily domains', artifacts: 'Artifacts', banners: 'Banners', nations: 'Nations', 'wish-simulator': 'Wish simulator' };
    return NAMES[p] || p;
  }

})();
