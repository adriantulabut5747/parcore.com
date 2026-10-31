// Prints the name cr-core.js gives every deck in site/cr-decks.json, so the naming rules can be checked by eye
// against what players call these decks. Run: node _tools/cr-names-test.mjs
import fs from 'fs';
const site = new URL('../site/', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, site), 'utf8');
globalThis.window = globalThis;
globalThis.matchMedia = () => ({ matches: false });
eval(read('cr-core.js'));
const c = JSON.parse(read('cr-cards.json'));
const byId = new Map([...c.cards, ...c.towers].map((x) => [x.id, x]));
const label = (x) => (x[1] === 1 ? 'Evo ' : x[1] === 2 ? 'Hero ' : '') + byId.get(x[0]).name;
for (const d of JSON.parse(read('cr-decks.json')).decks) {
  const n = window.CR.name(d.cards, byId);
  console.assert(n.name && n.style && n.wincon, 'incomplete name', n);
  console.log(n.name.padEnd(26), n.style.padEnd(9), d.cards.map(label).join(', '));
}
