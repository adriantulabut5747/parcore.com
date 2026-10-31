// Clash Royale: shared by every /clash-royale/ page (Oct 30 2026, plan: docs/clash-royale-plan.md).
// window.CR = card data, card pictures, deck maths and the game's copy-deck link.
// A deck everywhere = [[id] | [id, 1 = evolution / 2 = hero], ...] (the shape cr-decks.json uses).
window.CR = (() => {
  let cardsP;
  // site/cr-cards.json (scripts/cr-meta.mjs): every card + tower troop, keyed by id
  const cards = () =>
    (cardsP ||= fetch('/cr-cards.json')
      .then((r) => r.json())
      .then((d) => ({ ...d, byId: new Map([...d.cards, ...d.towers].map((c) => [c.id, c])) })));

  // pictures baked by scripts/cr-assets.py
  const img = (id, evo) => '/images/clash-royale/cards/' + id + (evo === 1 ? '-evo' : evo === 2 ? '-hero' : '') + '.webp';

  // The game's deck order: its first slots hold the evolution / hero cards (slot 1 evo, slot 2 hero, then
  // any other), then the rest cheapest first.
  const order = (deck, byId) => {
    const cost = (c) => byId.get(c[0])?.elixir ?? 99;
    const evo = deck.filter((c) => c[1] === 1);
    const hero = deck.filter((c) => c[1] === 2);
    const front = [evo.shift(), hero.shift(), ...evo, ...hero].filter(Boolean);
    return front.concat(deck.filter((c) => !c[1]).sort((a, b) => cost(a) - cost(b)));
  };

  // shortcut: Mirror has no fixed cost in the API, so it's left out of both numbers; fine until a Mirror deck clears the floor.
  const costs = (deck, byId) => deck.map((c) => byId.get(c[0])?.elixir).filter((n) => n != null);
  const avgElixir = (deck, byId) => {
    const c = costs(deck, byId);
    return c.length ? c.reduce((a, b) => a + b, 0) / c.length : 0;
  };
  // the 4-card cycle = the 4 cheapest cards' cost (what it takes to get back to a card)
  const cycle = (deck, byId) =>
    costs(deck, byId)
      .sort((a, b) => a - b)
      .slice(0, 4)
      .reduce((a, b) => a + b, 0);

  // The game's own deck link. Supercell doesn't document it: the format comes from open-source deck tools
  // (docs/clash-royale-plan.md 4c). slots: 1 = evolution; 2 for a hero form is a guess (it matches the battle
  // log's evolutionLevel) until Adrian tests it in game. Pass the deck in order() order.
  const copyLink = (deck, tower) =>
    'https://link.clashroyale.com/en/?clashroyale://copyDeck?deck=' +
    deck.map((c) => c[0]).join(';') +
    '&slots=' +
    deck.map((c) => c[1] || 0).join(';') +
    (tower ? '&tt=' + tower : '') +
    '&l=Royals';

  // Phones open the game straight away; a computer can't, so it copies the link to send to a phone.
  const touch = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const copyDeck = async (deck, tower, key) => {
    const link = copyLink(deck, tower);
    if (touch) return void (location.href = link);
    let ok = false;
    try {
      await navigator.clipboard.writeText(link);
      ok = true;
    } catch {}
    if (key) {
      const was = key.innerHTML;
      key.textContent = ok ? 'Link copied' : 'Copy failed';
      setTimeout(() => (key.innerHTML = was), 1600);
    }
  };

  // ---- DECK NAMES (Oct 31 2026): what players call a deck = its win condition, plus the average elixir for
  // cycle decks ("2.6 Hog", "3.0 X-Bow") or the card it's built around ("Giant Graveyard", "PEKKA Bridge Spam").
  // The community's archetype names first, then the win condition + its biggest partner.
  // style = the playstyle tray on the Decks page. Check: _tools/cr-names-test.mjs (prints every deck's name).
  const SHORT = {
    'P.E.K.K.A': 'PEKKA', 'Mini P.E.K.K.A': 'Mini PEKKA', 'Electro Wizard': 'E-Wiz', 'Electro Giant': 'E-Giant',
    'Elite Barbarians': 'E-Barbs', 'Electro Dragon': 'E-Dragon', 'Three Musketeers': '3M', 'Hog Rider': 'Hog', 'Goblin Drill': 'Drill',
  };
  const short = (n) => SHORT[n] || n;
  // win conditions, strongest claim first: [card, playstyle]
  const WINCONS = [
    ['X-Bow', 'siege'], ['Mortar', 'siege'], ['Lava Hound', 'beatdown'], ['Golem', 'beatdown'], ['Electro Giant', 'beatdown'],
    ['Three Musketeers', 'beatdown'], ['Graveyard', 'control'], ['Goblin Barrel', 'bait'], ['Skeleton Barrel', 'bait'],
    ['Royal Hogs', 'cycle'], ['Hog Rider', 'cycle'], ['Goblin Drill', 'cycle'], ['Royal Giant', 'beatdown'], ['Goblin Giant', 'beatdown'],
    ['Elixir Golem', 'beatdown'], ['Ram Rider', 'bridge'], ['Giant', 'beatdown'], ['Rune Giant', 'beatdown'], ['Minion Giant', 'beatdown'],
    ['Balloon', 'beatdown'], ['P.E.K.K.A', 'bridge'], ['Mega Knight', 'bridge'], ['Giant Skeleton', 'bridge'], ['Battle Ram', 'bridge'],
    ['Miner', 'control'], ['Wall Breakers', 'bait'], ['Royal Recruits', 'bridge'], ['Goblin Machine', 'bridge'], ['Boss Bandit', 'bridge'],
    ['Sparky', 'beatdown'], ['Suspicious Bush', 'bait'],
  ];
  const RANK = { champion: 4, legendary: 3, epic: 2, rare: 1, common: 0 };
  const name = (deck, byId) => {
    const cs = deck.map((c) => byId.get(c[0])).filter(Boolean);
    const has = (n) => cs.some((c) => c.name === n);
    const avg = avgElixir(deck, byId).toFixed(1);
    const wc = WINCONS.find(([n]) => has(n));
    const w = wc ? wc[0] : '';
    // the card the deck is built around: its best non-spell (3+ elixir) that isn't the win condition
    const partner = () => {
      const p = cs
        .filter((c) => c.type !== 'spell' && c.name !== w && (c.elixir ?? 0) >= 3)
        .sort((a, b) => RANK[b.rarity] - RANK[a.rarity] || (b.elixir ?? 0) - (a.elixir ?? 0))[0];
      return p ? short(p.name) : '';
    };
    const out = (n, style) => ({ name: n.trim(), style, wincon: wc ? cs.find((c) => c.name === w).id : cs[0]?.id });
    if (!wc) return out(partner() + ' Control', 'control');
    const bridge = ['Battle Ram', 'Bandit', 'Royal Ghost', 'Prince', 'Dark Prince'].some(has);
    if (w === 'Lava Hound') return out(has('Balloon') ? 'LavaLoon' : 'Lava Hound', 'beatdown');
    if (w === 'X-Bow' || (w === 'Mortar' && +avg <= 3.3)) return out(avg + ' ' + w, 'siege');
    if (w === 'Mortar') return out(partner() + ' Mortar', 'siege');
    if (w === 'Golem') return out(has('Night Witch') ? 'Golem Night Witch' : has('Lumberjack') ? 'Lumber Golem' : 'Golem Beatdown', 'beatdown');
    if (w === 'Electro Giant') return out('E-Giant ' + (has('Bowler') ? 'Bowler' : has('Tornado') ? 'Tornado' : partner()), 'beatdown');
    if (w === 'Three Musketeers') return out(has('Elixir Collector') ? '3M Pump' : '3M', 'beatdown');
    if (w === 'Graveyard') {
      const splash = ['Baby Dragon', 'Ice Wizard', 'Tornado', 'Bowler', 'Executioner', 'Wizard'].filter(has).length;
      return out(
        has('Giant') ? 'Giant Graveyard' : has('Freeze') ? 'Freezeyard' : has('Poison') && splash >= 2 ? 'Splashyard' : has('Poison') ? 'Graveyard Poison' : 'Graveyard',
        'control',
      );
    }
    if (w === 'Goblin Barrel') return out(has('Wall Breakers') && !has('Princess') ? 'Wall Breakers Bait' : 'Log Bait', 'bait');
    if (w === 'Skeleton Barrel') return out('Skeleton Barrel Bait', 'bait');
    if (w === 'Hog Rider' || w === 'Royal Hogs') {
      const n = short(w);
      if (has('Earthquake')) return out((w === 'Hog Rider' ? avg + ' ' : '') + n + ' EQ', 'cycle');
      if (has('Executioner')) return out(n + (has('Tornado') ? ' ExeNado' : ' Executioner'), 'cycle');
      if (has('Freeze')) return out(n + ' Freeze', 'cycle');
      return out(w === 'Hog Rider' ? avg + ' Hog' : n, 'cycle');
    }
    if (w === 'Goblin Drill') return out(avg + ' Drill', 'cycle');
    if (['Giant', 'Goblin Giant', 'Royal Giant', 'Rune Giant', 'Minion Giant', 'Elixir Golem'].includes(w)) {
      if (has('Sparky')) return out(short(w) + ' Sparky', 'beatdown');
      if (has('Prince') && has('Dark Prince')) return out(short(w) + ' Double Prince', 'beatdown');
      if (has('Rage')) return out(short(w) + ' Rage', 'beatdown');
      if (+avg <= 3.0) return out(avg + ' ' + short(w), 'cycle');
      return out(short(w) + ' ' + partner(), 'beatdown');
    }
    if (['P.E.K.K.A', 'Mega Knight', 'Giant Skeleton'].includes(w) && bridge) return out(short(w) + ' Bridge Spam', 'bridge');
    if (w === 'Battle Ram' && bridge) return out(has('Elixir Collector') ? 'Bridge Spam Pump' : 'Bridge Spam', 'bridge');
    return out(short(w) + ' ' + partner(), wc[1]);
  };
  // the evo / hero cards = the deck's variant line under its name
  const specials = (deck, byId) => deck.filter((c) => c[1]).map((c) => (c[1] === 1 ? 'Evo ' : 'Hero ') + (byId.get(c[0])?.name || ''));
  // one deck = one key whatever the order (likes): sorted ids, e = evo, h = hero
  const key = (deck) => deck.map((c) => c[0] + (c[1] === 1 ? 'e' : c[1] === 2 ? 'h' : '')).sort().join('_');
  // our own address for a deck: the Deck Builder with it loaded (share links + the edit pen)
  const builderLink = (deck, tower) =>
    '/clash-royale/deck-builder?deck=' + deck.map((c) => c[0]).join(',') + '&slots=' + deck.map((c) => c[1] || 0).join(',') + (tower ? '&tt=' + tower : '');

  // Firestore (the feedback box's project; likes go in layoutLikes like the CoC cards), loaded on first use
  let fbP;
  const script = (src) => new Promise((ok, no) => document.head.appendChild(Object.assign(document.createElement('script'), { src, onload: ok, onerror: no })));
  const firestore = () =>
    (fbP ||= (window.firebase && firebase.firestore
      ? Promise.resolve()
      : script('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js').then(() => script('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-compat.js'))
    ).then(() => {
      if (!firebase.apps.length)
        firebase.initializeApp({
          apiKey: 'AIzaSyAa8B5rIP0Y9w9jBN_mzKzkFW3xMdI9wgo',
          authDomain: 'parchrome-feedback.firebaseapp.com',
          projectId: 'parchrome-feedback',
          storageBucket: 'parchrome-feedback.firebasestorage.app',
          messagingSenderId: '546895020356',
          appId: '1:546895020356:web:f145067c0b71dde2341711',
        });
      return firebase.firestore();
    }));

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
  const num = (n) => Number(n).toLocaleString('en-US');

  return { cards, img, order, avgElixir, cycle, copyLink, copyDeck, touch, esc, num, name, specials, key, builderLink, firestore };
})();
