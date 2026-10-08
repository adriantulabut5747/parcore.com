// Builds the CODM lobby's live data (/call-of-duty-mobile/):
//   site/codm-feed.json    -- latest official videos, app versions, World Championship info
//   site/codm-weapons.json -- every CODM primary weapon by class, from the CoD Fandom wiki
//
// Run once a day by .github/workflows/codm-feed.yml. No keys: every source is public.
//   YouTube  -- the official channel's RSS feed (no API key needed)
//   Apple    -- iTunes lookup for the Global and Garena apps (version, update date, rating)
//   Liquipedia -- the current World Championship page's infobox (dates, prize, teams, city).
//                 Their API terms: a descriptive User-Agent, gzip, max 1 request / 2 s.
//   Fandom   -- CoD wiki categories "Call of Duty: Mobile <class>" + each page's image
//
// Each source is fetched on its own: if one fails, the old value for it is kept, so
// one broken site never blanks a section.
//
// Local test:  node scripts/codm-feed.mjs

import { writeFile, readFile } from 'node:fs/promises';

const OUT = new URL('../site/codm-feed.json', import.meta.url);
const OUT_WEAPONS = new URL('../site/codm-weapons.json', import.meta.url);
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

async function weapons() {
  const out = {};
  for (const [k, cat] of Object.entries(CLASSES)) {
    const d = await get(`${WIKI}?action=query&generator=categorymembers&gcmtitle=Category:Call_of_Duty:_Mobile_${encodeURIComponent(cat.replace(/ /g, '_'))}&gcmtype=page&gcmlimit=100&prop=pageimages|info&piprop=thumbnail&pithumbsize=320&inprop=url&format=json`);
    out[k] = Object.values(d.query?.pages || {})
      .map((p) => ({ name: p.title.replace(/ \([^)]*\)$/, ''), url: p.fullurl, img: p.thumbnail?.source || '' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
    await sleep(500);
  }
  if (Object.values(out).every((l) => !l.length)) throw new Error('wiki returned no weapons');
  return out;
}

const old = JSON.parse(await readFile(OUT, 'utf8').catch(() => '{}'));
const feed = { updated: new Date().toISOString() };
for (const [k, fn] of Object.entries({ videos, apps, esports })) {
  try { feed[k] = await fn(); } catch (e) { console.error(k + ' failed, keeping old data:', e.message); feed[k] = old[k] ?? null; }
}
await writeFile(OUT, JSON.stringify(feed, null, 1) + '\n');

// No timestamp in this file, so it only gets a new commit when the weapon list changes.
try {
  await writeFile(OUT_WEAPONS, JSON.stringify({ source: 'https://callofduty.fandom.com', classes: await weapons() }) + '\n');
} catch (e) { console.error('weapons failed, keeping old file:', e.message); }

console.log('videos', feed.videos?.length, '| apps', Object.keys(feed.apps || {}).join(','), '| esports', feed.esports?.start);
