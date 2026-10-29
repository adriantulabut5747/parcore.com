// Builds the CODM lobby's live data (/call-of-duty-mobile/):
//   site/codm-feed.json    -- latest official videos, app versions, World Championship info
//   site/codm-weapons.json -- every CODM primary gun + its stats (damage, ranges, RPM...), from the CoD Fandom wiki
//   site/codm-weapons-log.json -- the guns' number changes, day by day (diff of the file above)
//
// Run once a day by .github/workflows/codm-feed.yml. No keys: every source is public.
//   YouTube  -- the official channel's RSS feed (no API key needed)
//   Apple    -- iTunes lookup for the Global and Garena apps (version, update date, rating)
//   Liquipedia -- the current World Championship page's infobox (dates, prize, teams, city).
//                 Their API terms: a descriptive User-Agent, gzip, max 1 request / 2 s.
//   Fandom   -- CoD wiki categories "Call of Duty: Mobile <class>", each page's CODM infobox + its picture
//
// Each source is fetched on its own: if one fails, the old value for it is kept, so
// one broken site never blanks a section.
//
// Local test:  node scripts/codm-feed.mjs

import { writeFile, readFile } from 'node:fs/promises';

const OUT = new URL('../site/codm-feed.json', import.meta.url);
const OUT_WEAPONS = new URL('../site/codm-weapons.json', import.meta.url);
const OUT_LOG = new URL('../site/codm-weapons-log.json', import.meta.url);
const UA = 'ParchromeBot/1.0 (https://parchrome.netlify.app; wildparchrome@gmail.com)';
const YT_CHANNEL = 'UCj9bJX9hh3pXjktcsOLJdgw'; // youtube.com/@CallofDutyMobile
const APPS = { global: '1287282214&country=us', garena: '1465688043&country=ph' };
const WIKI = 'https://callofduty.fandom.com/api.php';
const CLASSES = {
  ar: 'Assault Rifles', smg: 'Submachine Guns', sr: 'Sniper Rifles',
  lmg: 'Light Machine Guns', sg: 'Shotguns', marksman: 'Marksman Rifles',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, as = 'json') {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip' } });
  if (!res.ok) throw new Error(url + ' -> HTTP ' + res.status);
  return as === 'json' ? res.json() : res.text();
}
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function videos() {
  const xml = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL}`, 'text');
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    id: e.match(/<yt:videoId>([^<]+)/)[1],
    title: decode(e.match(/<title>([^<]*)/)[1]),
    published: e.match(/<published>([^<]+)/)[1],
    short: /\/shorts\//.test(e),
  }));
}

async function apps() {
  const out = {};
  for (const [k, q] of Object.entries(APPS)) {
    const d = (await get('https://itunes.apple.com/lookup?id=' + q)).results[0];
    out[k] = {
      name: d.trackName, version: d.version, updated: d.currentVersionReleaseDate,
      rating: Math.round(d.averageUserRating * 10) / 10, ratings: d.userRatingCount, url: d.trackViewUrl.split('?')[0],
    };
  }
  return out;
}

// This year's World Championship page; next year's once that page exists and this one is over.
async function esports() {
  const year = new Date().getUTCFullYear();
  let best = null;
  for (const y of [year, year + 1]) {
    const title = `Call_of_Duty_Mobile_World_Championship/${y}`;
    const d = await get(`https://liquipedia.net/callofduty/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${title}&format=json&formatversion=2`);
    await sleep(2500);
    const page = d.query.pages[0];
    if (page.missing) continue;
    const t = page.revisions[0].slots.main.content;
    const f = (k) => ((t.match(new RegExp('\\|' + k + '=([^|\\n}]*)')) || [])[1] || '').trim();
    const info = {
      name: f('name'), start: f('sdate'), end: f('edate'), prizeUsd: +f('prizepoolusd') || null,
      teams: +f('team_number') || null, city: f('city'), country: f('country').toUpperCase(),
      url: 'https://liquipedia.net/callofduty/' + title,
    };
    if (!best || (best.end && new Date(best.end + 'T23:59:59Z') < new Date())) best = info;
  }
  if (!best || !best.start) throw new Error('no World Championship page found');
  return best;
}

// ---- Gun stats (Oct 29 2026): each gun page's "Call of Duty: Mobile" section has an infobox
// ({{Infobox/Weapon2}} or the older {{Infobox/weapon}}) with damage per range, multipliers, RPM...
// Editors write the same field many ways ("0-14m: 24", "12-17-24m", "Head: 1.2x", "1.2x (head)"),
// so each parser takes a number ONLY when the field states it plainly; anything else stays null
// and the page shows "no stats yet". Never guess a number here.
const NUM = '\\d+(?:\\.\\d+)?';
const clean = (s) => decode(s || '')
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'{2,}/g, '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
function field(box, k) {
  const m = box.match(new RegExp(`^\\|\\s*${k}\\s*=([\\s\\S]*?)(?=^\\||(?![\\s\\S]))`, 'm'));
  return m ? m[1].trim() : '';
}
// "<u>Multiplayer:</u><br>24-22<br><u>Battle Royale:</u><br>25-22" -> { mp, br }. No labels = Multiplayer.
function modes(v) {
  const parts = v.split(/<u>([^<]*)<\/u>\s*:?/i);
  if (parts.length === 1) return { mp: v };
  const out = {};
  for (let i = 1; i < parts.length; i += 2) {
    const label = parts[i].toLowerCase();
    if (label.includes('multiplayer')) out.mp ??= parts[i + 1];
    if (label.includes('battle royale')) out.br ??= parts[i + 1];
  }
  return out;
}
// "24-22-19-16" (the first line) -> [24, 22, 19, 16]; "(x12)" after it = pellets per shot
function damage(v) {
  const line = clean(v).split('\n').find((l) => /\d/.test(l)) || '';
  const m = line.match(new RegExp(`^\\s*${NUM}(?:\\s*-\\s*${NUM})*`));
  if (!m) return null;
  const pellets = line.match(/\(x(\d+)\)/i);
  return { dmg: m[0].split('-').map(Number), pellets: pellets ? +pellets[1] : 1 };
}
// metres where each damage step ends: "0-14m: 24 / 14-23m: 23 / 23+m: 18" or "12-17-24m" or "25m"
function ranges(v, n) {
  const t = clean(v);
  if (n < 2 || !/\d/.test(t)) return null;
  let at;
  if (t.includes(':')) {
    at = [...t.matchAll(new RegExp(`${NUM}\\s*-\\s*(${NUM})\\s*m?\\s*:`, 'g'))].map((m) => +m[1]);
  } else {
    at = (t.split('\n')[0].match(new RegExp(NUM, 'g')) || []).map(Number).slice(0, n - 1);
  }
  const ok = at.length === n - 1 && at.every((x, i) => x > 0 && (i === 0 || x > at[i - 1]));
  return ok ? at : null;
}
// head + chest multipliers from lines like "Head: 1.2x" / "1.7x (upper torso, arms)" / "1x (everywhere else)"
function mults(v) {
  const lines = clean(v).toLowerCase().split('\n')
    .map((l) => ({ l, x: (l.match(new RegExp(`(${NUM})\\s*x`)) || [])[1] }))
    .filter((o) => o.x);
  if (!lines.length) return { head: null, chest: null };
  const find = (re) => lines.filter((o) => re.test(o.l));
  const head = find(/head/)[0];
  const torso = find(/chest|torso|body|belly/);
  const chest = torso.find((o) => !/lower/.test(o.l)) || torso[0] || find(/rest|everywhere|other/)[0];
  return { head: head ? +head.x : null, chest: chest ? +chest.x : 1 };
}
const first = (v, re) => { const m = clean(v).match(re); return m ? +m[1] : null; };
function stats(box) {
  const dmg = modes(field(box, 'damage')), rng = modes(field(box, 'range')), mult = modes(field(box, 'mult'));
  // a "Multiplayer & Battle Royale" damage line shares the unlabelled range / multiplier lines
  const shared = (f, k) => f[k] ?? (k === 'br' && dmg.br === dmg.mp && !f.br ? f.mp : '');
  const mode = (k) => {
    const d = dmg[k] && damage(dmg[k]);
    if (!d) return null;
    return { dmg: d.dmg, pellets: d.pellets, at: ranges(shared(rng, k) || '', d.dmg.length), ...mults(shared(mult, k) || '') };
  };
  return {
    fire: clean(field(box, 'fire')).split('\n')[0] || null,
    rpm: first(field(box, 'rof'), new RegExp(`(${NUM})\\s*RPM`, 'i')),
    mag: first(field(box, 'magazine'), /(\d+)/),
    reload: first(field(box, 'reload'), new RegExp(`Tactical[^:\\n]*:\\s*(${NUM})`, 'i')),
    reloadEmpty: first(field(box, 'reload'), new RegExp(`Empty[^:\\n]*:\\s*(${NUM})`, 'i')),
    mp: mode('mp'),
    br: mode('br'),
  };
}
async function weapons() {
  const guns = [];
  for (const [cls, cat] of Object.entries(CLASSES)) {
    const d = await get(`${WIKI}?action=query&generator=categorymembers&gcmtitle=Category:Call_of_Duty:_Mobile_${encodeURIComponent(cat.replace(/ /g, '_'))}&gcmtype=page&gcmlimit=50&prop=revisions|info&rvprop=content|timestamp&rvslots=main&inprop=url&format=json&formatversion=2`);
    for (const p of d.query?.pages || []) {
      const w = p.revisions?.[0]?.slots?.main?.content || '';
      const i = w.search(/==\s*Call of Duty: Mobile\s*==/);
      const box = ((i >= 0 ? w.slice(i) : w).match(/\{\{Infobox\/[Ww]eapon2?\s*\n([\s\S]*?)\n\}\}/) || [])[1] || '';
      const file = (field(box, 'image').match(/File:([^|\]]+)/) || [])[1];
      // the infobox's name is the CODM one (page "Vector" = Fennec, "Galil" = Grav...)
      guns.push({ name: clean(field(box, 'name')) || p.title.replace(/ \([^)]*\)$/, ''), wiki: p.title, cls, url: p.fullurl, file: file && file.trim(), edited: p.revisions?.[0]?.timestamp?.slice(0, 10), ...stats(box) });
    }
    if (d.continue) console.error(cat + ': more than 50 guns, raise the paging');
    await sleep(500);
  }
  if (!guns.length) throw new Error('wiki returned no weapons');
  // the CODM picture named in each infobox (the category's page image is usually another game's icon)
  const files = [...new Set(guns.map((g) => g.file).filter(Boolean))];
  const img = {};
  for (let i = 0; i < files.length; i += 50) {
    const d = await get(`${WIKI}?action=query&titles=${encodeURIComponent(files.slice(i, i + 50).map((f) => 'File:' + f).join('|'))}&prop=imageinfo&iiprop=url&iiurlwidth=320&format=json&formatversion=2`);
    const norm = Object.fromEntries((d.query?.normalized || []).map((n) => [n.to, n.from]));
    for (const p of d.query?.pages || []) if (p.imageinfo) img[(norm[p.title] || p.title).replace(/^File:/, '')] = p.imageinfo[0].thumburl;
    await sleep(500);
  }
  for (const g of guns) { g.img = (g.file && img[g.file]) || ''; delete g.file; }
  return guns.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
}

// A gun's numbers changed since yesterday's file -> one row per change in codm-weapons-log.json
// (newest first, last 300 kept). These are WIKI edits, so the page labels them that way.
const sig = {
  'Multiplayer damage': (g) => g.mp?.dmg?.join('-'),
  'Multiplayer ranges': (g) => g.mp?.at?.join('-'),
  'Head multiplier': (g) => g.mp?.head,
  'Chest multiplier': (g) => g.mp?.chest,
  'Battle Royale damage': (g) => g.br?.dmg?.join('-'),
  'Fire rate': (g) => g.rpm,
  Magazine: (g) => g.mag,
};
function changes(oldGuns, guns, day) {
  const before = Object.fromEntries(oldGuns.map((g) => [g.name, g]));
  const rows = [];
  for (const g of guns) {
    const o = before[g.name];
    if (!o) { rows.push({ day, gun: g.name, what: 'Added to the wiki' }); continue; }
    for (const [what, f] of Object.entries(sig)) {
      const a = f(o) ?? null, b = f(g) ?? null;
      if (a !== b && b !== null) rows.push({ day, gun: g.name, what, from: a, to: b });
    }
  }
  return rows;
}

const old = JSON.parse(await readFile(OUT, 'utf8').catch(() => '{}'));
const feed = { updated: new Date().toISOString() };
for (const [k, fn] of Object.entries({ videos, apps, esports })) {
  try { feed[k] = await fn(); } catch (e) { console.error(k + ' failed, keeping old data:', e.message); feed[k] = old[k] ?? null; }
}
await writeFile(OUT, JSON.stringify(feed, null, 1) + '\n');

// No timestamp in these files, so they only get a new commit when a gun's numbers change.
try {
  const guns = await weapons();
  const oldGuns = JSON.parse(await readFile(OUT_WEAPONS, 'utf8').catch(() => '{}')).guns;
  await writeFile(OUT_WEAPONS, JSON.stringify({ source: 'https://callofduty.fandom.com', guns }) + '\n');
  // the first run (old file = the pre-stats list) has nothing to compare against
  if (oldGuns) {
    const log = JSON.parse(await readFile(OUT_LOG, 'utf8').catch(() => '{"changes":[]}'));
    const rows = changes(oldGuns, guns, new Date().toISOString().slice(0, 10));
    if (rows.length) await writeFile(OUT_LOG, JSON.stringify({ changes: [...rows, ...log.changes].slice(0, 300) }) + '\n');
  } else {
    await writeFile(OUT_LOG, JSON.stringify({ changes: [] }) + '\n');
  }
} catch (e) { console.error('weapons failed, keeping old file:', e.message); }

console.log('videos', feed.videos?.length, '| apps', Object.keys(feed.apps || {}).join(','), '| esports', feed.esports?.start);
