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

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
  const num = (n) => Number(n).toLocaleString('en-US');

  return { cards, img, order, avgElixir, cycle, copyLink, copyDeck, touch, esc, num };
})();
